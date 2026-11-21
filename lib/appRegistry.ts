import {
  BudgetProgressItem,
  GoldPortfolioState,
  InteriorStudioState,
  MortgageContract,
  SubAppId,
} from "@/types/finance";
import { generateMortgageSchedule } from "@/lib/mortgageEngine";
import {
  computeGoldPortfolioMetrics,
  evaluateGoldAlerts,
  verifyGoldPortfolioIntegrity,
} from "@/lib/goldEngine";
import {
  evaluateErgonomicClearances,
  calculateScenarioBoq,
} from "@/lib/interiorBoqEngine";
import { formatDateVN } from "@/lib/formatters";

export type EcosystemAppId = Exclude<SubAppId, "LAUNCHER">;

export interface EcosystemAppDefinition {
  id: EcosystemAppId;
  title: string;
  waffleSubtitle: string;
  launcherDescription: string;
  ctaLabel: string;
  accentTone: "blue" | "indigo" | "amber" | "teal";
  testIdKey: "finance" | "skyone" | "gold" | "interior";
  shortcutDigit: "1" | "2" | "3" | "4";
  shortcutLabel: "Alt+1" | "Alt+2" | "Alt+3" | "Alt+4";
  defaultRoute: string;
}

export interface UrgentSkyOneAlert {
  kind: "danger" | "warning";
  compactLabel: string;
  detailLabel: string;
}

export interface EcosystemAppBadge {
  severity: "danger" | "warning" | "info";
  count: number;
  compactLabel: string;
  detailLabel: string;
}

/**
 * Danh mục khai báo tập trung cho hệ sinh thái 4 Sub-App (Single Source of Truth).
 */
export const APP_ECOSYSTEM_REGISTRY: readonly EcosystemAppDefinition[] = [
  {
    id: "FINANCE",
    title: "Thu Chi Tổ Ấm",
    waffleSubtitle: "Sổ giao dịch, thẻ & ngân sách",
    launcherDescription: "Sổ giao dịch, thẻ tín dụng và ngân sách gia đình",
    ctaLabel: "Mở Thu Chi",
    accentTone: "blue",
    testIdKey: "finance",
    shortcutDigit: "1",
    shortcutLabel: "Alt+1",
    defaultRoute: "/finance/overview",
  },
  {
    id: "SKYONE",
    title: "Phú Đông SKYONE",
    waffleSubtitle: "Khoản vay BIDV & Cố vấn 08/2028",
    launcherDescription: "Khoản vay căn hộ BIDV, sao kê và cố vấn 08/2028",
    ctaLabel: "Mở SKYONE",
    accentTone: "indigo",
    testIdKey: "skyone",
    shortcutDigit: "2",
    shortcutLabel: "Alt+2",
    defaultRoute: "/skyone/overview",
  },
  {
    id: "GOLD",
    title: "Kho Tích Sản Vàng",
    waffleSubtitle: "Nhẫn 9999, SJC & Thanh khoản Q3/2027",
    launcherDescription: "Định giá Bid thực thu, giá vốn WAC/FIFO & mô phỏng bán vàng",
    ctaLabel: "Mở Kho Vàng",
    accentTone: "amber",
    testIdKey: "gold",
    shortcutDigit: "3",
    shortcutLabel: "Alt+3",
    defaultRoute: "/gold/overview",
  },
  {
    id: "INTERIOR",
    title: "SKYONE 3D Interior",
    waffleSubtitle: "Phối cảnh 3D A.12A.07 & Dự toán BOQ",
    launcherDescription: "Thiết kế 3D Three.js căn hộ A.12A.07 (51m²) & dự toán trọn gói",
    ctaLabel: "Mở 3D Studio",
    accentTone: "teal",
    testIdKey: "interior",
    shortcutDigit: "4",
    shortcutLabel: "Alt+4",
    defaultRoute: "/interior/studio",
  },
] as const;

export const SUB_APP_REGISTRY = APP_ECOSYSTEM_REGISTRY;

export function getEcosystemAppByShortcutDigit(digit: string): EcosystemAppId | null {
  const found = APP_ECOSYSTEM_REGISTRY.find((app) => app.shortcutDigit === digit);
  return found ? found.id : null;
}

export function getUrgentSkyOneAlert(
  contract: MortgageContract,
  referenceDate?: string
): UrgentSkyOneAlert | null {
  const schedule = generateMortgageSchedule(contract, referenceDate);

  if (schedule.overdueCount > 0) {
    return {
      kind: "danger",
      compactLabel: `Quá hạn ${schedule.overdueCount} kỳ`,
      detailLabel: `Có ${schedule.overdueCount} kỳ quá hạn cần đối soát`,
    };
  }

  const nextDue = schedule.nextUnpaidInstallment;
  if (nextDue && nextDue.status === "DUE_SOON") {
    return {
      kind: "warning",
      compactLabel:
        nextDue.daysUntilDue === 0
          ? `Hôm nay hạn kỳ #${nextDue.period}`
          : `Còn ${nextDue.daysUntilDue} ngày (${formatDateVN(nextDue.dueDate)})`,
      detailLabel:
        nextDue.daysUntilDue === 0
          ? `Hôm nay đến hạn đóng kỳ #${nextDue.period}`
          : `Còn ${nextDue.daysUntilDue} ngày đến hạn kỳ #${nextDue.period}`,
    };
  }

  return null;
}

/**
 * Tổng hợp cảnh báo hành động thống nhất cho cả 4 Sub-App (100% Privacy-Safe: không lộ số tiền VND).
 */
export function computeEcosystemAlertBadges(input: {
  skyoneLoan: MortgageContract;
  goldPortfolio: GoldPortfolioState;
  interiorStudio: InteriorStudioState;
  budgetItems?: BudgetProgressItem[];
  referenceDate?: string;
}): Record<EcosystemAppId, EcosystemAppBadge | null> {
  // 1. FINANCE: Ngân sách vượt 100% hoặc cảnh báo > 80%
  let financeBadge: EcosystemAppBadge | null = null;
  if (input.budgetItems && input.budgetItems.length > 0) {
    const over100 = input.budgetItems.filter((b) => b.percentage >= 100).length;
    const over80 = input.budgetItems.filter((b) => b.percentage > 80 && b.percentage < 100).length;
    if (over100 > 0) {
      financeBadge = {
        severity: "danger",
        count: over100,
        compactLabel: `${over100} nhóm vượt ngân sách`,
        detailLabel: `${over100} danh mục chi tiêu đã vượt 100% ngân sách tháng`,
      };
    } else if (over80 > 0) {
      financeBadge = {
        severity: "warning",
        count: over80,
        compactLabel: `${over80} nhóm > 80% hạn mức`,
        detailLabel: `${over80} danh mục chi tiêu đã chạm ngưỡng cảnh báo > 80%`,
      };
    }
  }

  // 2. SKYONE: Kỳ trả góp quá hạn / sắp đến hạn
  const skyoneUrgent = getUrgentSkyOneAlert(input.skyoneLoan, input.referenceDate);
  const skyoneBadge: EcosystemAppBadge | null = skyoneUrgent
    ? {
        severity: skyoneUrgent.kind,
        count: 1,
        compactLabel: skyoneUrgent.compactLabel,
        detailLabel: skyoneUrgent.detailLabel,
      }
    : null;

  // 3. GOLD: Lỗi toàn vẹn sổ lô vàng hoặc cảnh báo giá/spread đã kích hoạt
  let goldBadge: EcosystemAppBadge | null = null;
  const goldIntegrity = verifyGoldPortfolioIntegrity(input.goldPortfolio);
  const goldMetrics = computeGoldPortfolioMetrics(input.goldPortfolio);
  const triggeredAlerts = evaluateGoldAlerts(input.goldPortfolio, goldMetrics).filter(
    (a) => a.triggered
  );
  if (goldIntegrity.errorCount > 0) {
    goldBadge = {
      severity: "danger",
      count: goldIntegrity.errorCount,
      compactLabel: `${goldIntegrity.errorCount} lỗi sổ vàng`,
      detailLabel: `Phát hiện ${goldIntegrity.errorCount} bất thường cần đối soát sổ lô vàng`,
    };
  } else if (triggeredAlerts.length > 0) {
    goldBadge = {
      severity: "warning",
      count: triggeredAlerts.length,
      compactLabel: `${triggeredAlerts.length} cảnh báo giá`,
      detailLabel: `${triggeredAlerts.length} quy tắc cảnh báo giá vàng / spread đang kích hoạt`,
    };
  }

  // 4. INTERIOR: Lỗi nghiêm trọng Snag List / Vượt ngân sách BOQ / Xung đột công thái học
  let interiorBadge: EcosystemAppBadge | null = null;
  const criticalSnags = input.interiorStudio.handoverChecklist.filter(
    (c) => c.status === "DEFECT_CRITICAL"
  ).length;
  const activeScenario =
    input.interiorStudio.scenarios.find((s) => s.id === input.interiorStudio.activeScenarioId) ||
    input.interiorStudio.scenarios[0];
  const boq = activeScenario ? calculateScenarioBoq(activeScenario) : null;
  const dangerWarnings = activeScenario
    ? evaluateErgonomicClearances(activeScenario).filter((w) => w.severity === "DANGER").length
    : 0;

  if (criticalSnags > 0) {
    interiorBadge = {
      severity: "danger",
      count: criticalSnags,
      compactLabel: `${criticalSnags} lỗi nghiệm thu nặng`,
      detailLabel: `Biên bản Snag List A.12A.07 có ${criticalSnags} lỗi nghiêm trọng cần CĐT xử lý`,
    };
  } else if (boq && boq.budgetStatus === "OVER_BUDGET") {
    interiorBadge = {
      severity: "warning",
      count: 1,
      compactLabel: "Vượt trần ngân sách BOQ",
      detailLabel: `${activeScenario.shortLabel} hiện vượt trần ngân sách mục tiêu đã đặt`,
    };
  } else if (dangerWarnings > 0) {
    interiorBadge = {
      severity: "warning",
      count: dangerWarnings,
      compactLabel: `${dangerWarnings} lỗi bố trí 3D`,
      detailLabel: `Có ${dangerWarnings} xung đột lối đi / cánh cửa cần chỉnh trên mặt bằng`,
    };
  }

  return {
    FINANCE: financeBadge,
    SKYONE: skyoneBadge,
    GOLD: goldBadge,
    INTERIOR: interiorBadge,
  };
}
