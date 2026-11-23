/**
 * @file unifiedAlertsEngine.ts
 * @description Bộ tổng hợp cảnh báo thuần túy (100% Node-Testable) cho cả 4 Sub-App
 * trong hệ sinh thái HOME MONI: FINANCE, SKYONE, GOLD, INTERIOR.
 */

import {
  Account,
  BudgetProgressItem,
  GoldPortfolioState,
  InteriorStudioState,
  MortgageContract,
  RecurringRule,
  SubAppId,
} from '@/types/finance';
import { calculateCreditCardCycleInfo } from './financeEngine';
import {
  computeGoldPortfolioMetrics,
  evaluateGoldAlerts,
  verifyGoldPortfolioIntegrity,
} from './goldEngine';
import { calculateScenarioBoq } from './interiorBoqEngine';
import { generateMortgageSchedule } from './mortgageEngine';

export type UnifiedAlertSeverity = 'critical' | 'warning' | 'info';

export interface UnifiedEcosystemAlert {
  id: string;
  app: SubAppId;
  severity: UnifiedAlertSeverity;
  title: string;
  description: string;
  actionLabel: string;
  targetTab: string;
  /** Nếu có liên kết sang một thao tác nội bộ (VD: 'outbox' | 'recurring') */
  metaKey?: string;
}

export interface UnifiedAlertsInput {
  accounts: Account[];
  budgetItems: BudgetProgressItem[];
  recurringRules: RecurringRule[];
  currentMonthKey: string; // YYYY-MM
  skyoneLoan: MortgageContract;
  goldPortfolio: GoldPortfolioState;
  interiorStudio: InteriorStudioState;
  failedOutboxCount?: number;
  now?: Date;
}

const SEVERITY_RANK: Record<UnifiedAlertSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

function daysBetweenIso(fromDate: Date, targetIso: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetIso)) return null;
  const target = new Date(`${targetIso}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const start = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
  return Math.round((target.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

function daysUntilDayOfMonth(now: Date, dueDay: number): number {
  const safeDay = Math.min(28, Math.max(1, dueDay));
  const thisMonthDue = new Date(now.getFullYear(), now.getMonth(), safeDay);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let diff = Math.round((thisMonthDue.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) {
    const nextMonthDue = new Date(now.getFullYear(), now.getMonth() + 1, safeDay);
    diff = Math.round((nextMonthDue.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  }
  return diff;
}

export function buildUnifiedEcosystemAlerts(
  input: UnifiedAlertsInput
): UnifiedEcosystemAlert[] {
  const now = input.now ?? new Date();
  const alerts: UnifiedEcosystemAlert[] = [];

  // -------------------------------------------------------------------------
  // 0. HỆ THỐNG ĐỒNG BỘ (OUTBOX DEAD-LETTER)
  // -------------------------------------------------------------------------
  if ((input.failedOutboxCount ?? 0) > 0) {
    alerts.push({
      id: 'sys-outbox-failed',
      app: 'FINANCE',
      severity: 'critical',
      title: `${input.failedOutboxCount} thay đổi đồng bộ Cloud đang chờ xử lý`,
      description:
        'Một số thao tác ngoại tuyến gặp lỗi sau nhiều lần thử lại. Mở Quản trị dữ liệu → Sync Outbox để thử lại hoặc bỏ qua.',
      actionLabel: 'Mở Outbox',
      targetTab: 'data_admin',
      metaKey: 'outbox',
    });
  }

  // -------------------------------------------------------------------------
  // 1. SUB-APP FINANCE: Thẻ tín dụng BIDV, Ngân sách, Định kỳ chờ ghi sổ
  // -------------------------------------------------------------------------
  for (const acc of input.accounts) {
    if (acc.type !== 'CREDIT_CARD') continue;
    const status = calculateCreditCardCycleInfo(acc, input.currentMonthKey);
    if (status.usagePercentage > 30) {
      alerts.push({
        id: `fin-card-util-${acc.id}`,
        app: 'FINANCE',
        severity: status.usagePercentage >= 60 ? 'critical' : 'warning',
        title: `${acc.name} vượt mốc an toàn 30% (${status.usagePercentage}%)`,
        description: `Đã dùng ${status.usedAmount.toLocaleString('vi-VN')} đ / ${status.creditLimit.toLocaleString('vi-VN')} đ. Ưu tiên tất toán sớm trước ngày sao kê ${status.statementDay}.`,
        actionLabel: 'Xem ví & thẻ',
        targetTab: 'accounts',
      });
    }
    const daysToDue = daysUntilDayOfMonth(now, status.dueDay);
    if (status.usedAmount > 0 && daysToDue <= 5) {
      alerts.push({
        id: `fin-card-due-${acc.id}`,
        app: 'FINANCE',
        severity: daysToDue <= 2 ? 'critical' : 'warning',
        title: `Sắp đến hạn thanh toán ${acc.name} (còn ${daysToDue} ngày)`,
        description: `Hạn chót miễn lãi: ngày ${String(status.dueDay).padStart(2, '0')} (${status.dueDateDisplay}). Dư nợ hiện tại: ${status.usedAmount.toLocaleString('vi-VN')} đ.`,
        actionLabel: 'Thanh toán thẻ',
        targetTab: 'accounts',
      });
    }
  }

  for (const b of input.budgetItems) {
    if (b.percentage >= 100) {
      alerts.push({
        id: `fin-budget-over-${b.categoryId}`,
        app: 'FINANCE',
        severity: 'critical',
        title: `Vượt trần ngân sách "${b.categoryName}" (${Math.round(b.percentage)}%)`,
        description: `Đã chi ${b.spentAmount.toLocaleString('vi-VN')} đ / hạn mức ${b.limitAmount.toLocaleString('vi-VN')} đ.`,
        actionLabel: 'Xem kế hoạch',
        targetTab: 'planning',
      });
    } else if (b.percentage >= 80) {
      alerts.push({
        id: `fin-budget-warn-${b.categoryId}`,
        app: 'FINANCE',
        severity: 'warning',
        title: `Gần chạm trần ngân sách "${b.categoryName}" (${Math.round(b.percentage)}%)`,
        description: `Còn lại ${Math.max(0, b.limitAmount - b.spentAmount).toLocaleString('vi-VN')} đ cho đến cuối tháng.`,
        actionLabel: 'Xem kế hoạch',
        targetTab: 'planning',
      });
    }
  }

  const pendingRecurring = input.recurringRules.filter(
    (r) => r.isActive && r.lastAppliedMonth !== input.currentMonthKey
  );
  if (pendingRecurring.length > 0) {
    alerts.push({
      id: `fin-recurring-pending-${input.currentMonthKey}`,
      app: 'FINANCE',
      severity: 'info',
      title: `${pendingRecurring.length} khoản thu/chi định kỳ kỳ ${input.currentMonthKey} chưa ghi sổ`,
      description: pendingRecurring
        .slice(0, 3)
        .map((r) => r.name)
        .join(', '),
      actionLabel: 'Ghi sổ định kỳ',
      targetTab: 'planning',
      metaKey: 'recurring',
    });
  }

  // -------------------------------------------------------------------------
  // 2. SUB-APP SKYONE: Kỳ trả nợ sắp đến hạn & Chuyển sang lãi thả nổi
  // -------------------------------------------------------------------------
  const skySummary = generateMortgageSchedule(input.skyoneLoan);
  const nextRow = skySummary.nextUnpaidInstallment;
  if (nextRow) {
    const diffDays = daysBetweenIso(now, nextRow.dueDate);
    if (diffDays !== null && diffDays <= 7) {
      alerts.push({
        id: `skyone-due-p${nextRow.period}`,
        app: 'SKYONE',
        severity: diffDays <= 2 ? 'critical' : 'warning',
        title:
          diffDays < 0
            ? `Quá hạn kỳ #${nextRow.period} vay SKYONE (${Math.abs(diffDays)} ngày)`
            : `Sắp đến kỳ #${nextRow.period} vay SKYONE (còn ${diffDays} ngày)`,
        description: `Ngày thu nợ ${nextRow.dueDate} · Tổng gốc + lãi dự kiến ${nextRow.totalPayment.toLocaleString('vi-VN')} đ.`,
        actionLabel: 'Mở SKYONE',
        targetTab: 'SCHEDULE',
      });
    }

    if (skySummary.remainingFixedMonths > 0 && skySummary.remainingFixedMonths <= 3) {
      alerts.push({
        id: 'skyone-floating-soon',
        app: 'SKYONE',
        severity: 'warning',
        title: `Sắp hết ưu đãi lãi cố định SKYONE (còn ${skySummary.remainingFixedMonths} kỳ)`,
        description: `Sau kỳ #${input.skyoneLoan.fixedRateMonths}, khoản vay chuyển sang lãi thả nổi dự kiến ${(input.skyoneLoan.floatingBaseRate + input.skyoneLoan.floatingSpread).toFixed(2)}%/năm.`,
        actionLabel: 'Mô phỏng lãi',
        targetTab: 'PREPAYMENT',
      });
    }
  }

  // -------------------------------------------------------------------------
  // 3. SUB-APP GOLD: Quy tắc GoldAlertRule (SSOT evaluateGoldAlerts) & Toàn vẹn Sổ cái Vàng
  // -------------------------------------------------------------------------
  const goldMetrics = computeGoldPortfolioMetrics(input.goldPortfolio);
  const evaluatedGoldAlerts = evaluateGoldAlerts(input.goldPortfolio, goldMetrics);

  for (const evaluated of evaluatedGoldAlerts) {
    if (!evaluated.triggered) continue;
    alerts.push({
      id: `gold-rule-${evaluated.rule.id}`,
      app: 'GOLD',
      severity: evaluated.rule.condition === 'SPREAD_ABOVE_PCT' ? 'warning' : 'info',
      title: `Kho Vàng chạm mốc: ${evaluated.rule.label}`,
      description: `Hiện tại ${evaluated.currentValueLabel} (ngưỡng cài đặt ${evaluated.thresholdLabel}).`,
      actionLabel: 'Mở Kho Vàng',
      targetTab: 'PRICES',
    });
  }

  if (input.goldPortfolio.dcaPlan?.enabled && input.goldPortfolio.dcaPlan.monthlyBudgetVnd > 0) {
    const targetDay = 10;
    const dayDiff = targetDay - now.getDate();
    if (dayDiff >= 0 && dayDiff <= 3) {
      alerts.push({
        id: 'gold-dca-due',
        app: 'GOLD',
        severity: 'info',
        title: `Sắp đến lịch DCA vàng định kỳ (ngày ${targetDay})`,
        description: `Mục tiêu tháng: ${input.goldPortfolio.dcaPlan.monthlyBudgetVnd.toLocaleString('vi-VN')} đ ưu tiên Nhẫn trơn 9999.`,
        actionLabel: 'Mở kế hoạch DCA',
        targetTab: 'DCA',
      });
    }
  }

  const goldAudit = verifyGoldPortfolioIntegrity(input.goldPortfolio);
  if (!goldAudit.ok) {
    alerts.push({
      id: 'gold-integrity-error',
      app: 'GOLD',
      severity: 'critical',
      title: `Phát hiện ${goldAudit.errorCount} sai lệch sổ cái Kho Vàng`,
      description: goldAudit.summary,
      actionLabel: 'Kiểm toán Kho Vàng',
      targetTab: 'LOTS',
    });
  }

  // -------------------------------------------------------------------------
  // 4. SUB-APP INTERIOR: Lỗi Snag mức nghiêm trọng chưa đóng & Vượt trần BOQ
  // -------------------------------------------------------------------------
  const activeScenario =
    input.interiorStudio.scenarios.find((s) => s.id === input.interiorStudio.activeScenarioId) ||
    input.interiorStudio.scenarios[0];

  if (activeScenario) {
    const boq = calculateScenarioBoq(activeScenario);
    if (boq.budgetStatus === 'OVER_BUDGET' && boq.varianceFromMaxVnd > 0) {
      alerts.push({
        id: `interior-boq-over-${activeScenario.id}`,
        app: 'INTERIOR',
        severity: 'warning',
        title: `Dự toán BOQ "${activeScenario.name}" vượt trần ngân sách`,
        description: `Tổng BOQ ${boq.grandTotalWithContingency.toLocaleString('vi-VN')} đ vượt trần ${boq.targetBudgetMaxVnd.toLocaleString('vi-VN')} đ (+${boq.varianceFromMaxVnd.toLocaleString('vi-VN')} đ).`,
        actionLabel: 'Mở dự toán BOQ',
        targetTab: 'BOQ',
      });
    }
  }

  const criticalSnags = (input.interiorStudio.handoverChecklist || []).filter(
    (item) => !item.checked && item.status === 'DEFECT_CRITICAL'
  );
  if (criticalSnags.length > 0) {
    alerts.push({
      id: 'interior-snags-high',
      app: 'INTERIOR',
      severity: 'warning',
      title: `${criticalSnags.length} lỗi nghiệm thu bàn giao nghiêm trọng chưa xử lý`,
      description: criticalSnags
        .slice(0, 2)
        .map((s) => s.title)
        .join(' · '),
      actionLabel: 'Xem Snag List',
      targetTab: 'CHECKLIST',
    });
  }

  return alerts.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}
