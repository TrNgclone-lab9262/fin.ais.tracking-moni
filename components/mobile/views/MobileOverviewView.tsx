"use client";

import React, { useState } from "react";
import {
  CreditCard,
  Scale,
  Heart,
  CheckCircle2,
  Sparkles,
  Loader2,
  Repeat,
  ChevronDown,
  ChevronUp,
  FileText,
} from "lucide-react";
import { useFinance, CreditCardInfo } from "@/context/FinanceContext";
import {
  formatVNDMasked,
  formatShortVNDMasked,
  formatDateVN,
  getCurrentMonthKey,
  getMonthDisplayLabel,
} from "@/lib/formatters";
import { generateMonthlyDigest, MonthlyAIDigest } from "@/lib/geminiReceiptService";
import { Transaction } from "@/types/finance";
import { MobileMonthSelector } from "@/components/mobile/MobileMonthSelector";
import { TransactionDetailSheet } from "@/components/mobile/sheets/TransactionDetailSheet";
import { CreditCardRepaymentSheet } from "@/components/mobile/sheets/CreditCardRepaymentSheet";
import { TransactionFormModal } from "@/components/transactions/TransactionFormModal";
import { FinancialInsightsCard } from "@/components/dashboard/FinancialInsightsCard";
import { SpendingForecastCard } from "@/components/dashboard/SpendingForecastCard";
import { PeriodComparisonCompact } from "@/components/dashboard/PeriodComparisonCompact";
import { QuickAddCard } from "@/components/dashboard/QuickAddCard";
import { FinancialCalendarCard } from "@/components/dashboard/FinancialCalendarCard";
import { AdvancedAnalyticsSuite } from "@/components/dashboard/AdvancedAnalyticsSuite";
import { UnifiedNetWorthBanner } from "@/components/dashboard/UnifiedNetWorthBanner";

interface MobileOverviewViewProps {
  onOpenPdfReport?: () => void;
  onOpenNumpad?: () => void;
}

export function MobileOverviewView({
  onOpenPdfReport,
  onOpenNumpad,
}: MobileOverviewViewProps) {
  const {
    summary,
    husbandCreditCard,
    wifeCreditCard,
    filteredTransactions,
    budgetSummary,
    todaySpentInfo,
    selectedMonth,
    isPrivacyMode,
    settings,
    coupleSettlement,
    accounts,
    categoryExpenseStats,
    recurringRules,
    addTransaction,
    applyAllPendingRecurringRules,
    setActiveTab,
    deleteTransaction,
  } = useFinance();

  const totalNetWorth = summary.netWorth;
  const monthlyIncome = summary.monthlyIncome;
  const monthlyExpense = summary.monthlyExpense;

  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [repayingCard, setRepayingCard] = useState<CreditCardInfo | null>(null);
  const [settledToast, setSettledToast] = useState(false);
  const [recurringToast, setRecurringToast] = useState<string | null>(null);

  const [digest, setDigest] = useState<MonthlyAIDigest | null>(null);
  const [isGeneratingDigest, setIsGeneratingDigest] = useState(false);
  const [isDigestExpanded, setIsDigestExpanded] = useState(true);

  const activeMonthKey = selectedMonth === "ALL" ? getCurrentMonthKey() : selectedMonth;
  const monthLabel =
    selectedMonth === "ALL" ? "Toàn thời gian" : getMonthDisplayLabel(selectedMonth);

  const pendingRecurring = recurringRules.filter(
    (r) => r.isActive && r.lastAppliedMonth !== activeMonthKey
  );

  const savingsRate =
    monthlyIncome > 0
      ? Math.max(0, Math.round(((monthlyIncome - monthlyExpense) / monthlyIncome) * 100))
      : 0;

  const recentTransactions = filteredTransactions.slice(0, 4);

  const dailyAllowance = budgetSummary?.dailyAllowance || 0;
  const todaySpent = todaySpentInfo.amount;
  const todayRemaining = Math.max(0, dailyAllowance - todaySpent);
  const dailyPct =
    dailyAllowance > 0 ? Math.min(100, Math.round((todaySpent / dailyAllowance) * 100)) : 0;
  const isDailyOver = dailyAllowance > 0 && todaySpent > dailyAllowance;

  const getBarColor = (level: CreditCardInfo["statusLevel"]) => {
    if (level === "DANGER") return "bg-rose-400";
    if (level === "WARNING") return "bg-orange-400";
    if (level === "WATCH") return "bg-amber-400";
    return "bg-emerald-400";
  };

  const handleSettleCouple = () => {
    if (coupleSettlement.fromMember === "BALANCED" || coupleSettlement.transferAmount <= 0)
      return;

    const fromAcc =
      accounts.find(
        (a) => a.owner === coupleSettlement.fromMember && a.type !== "CREDIT_CARD"
      ) || accounts.find((a) => a.type !== "CREDIT_CARD");
    const toAcc =
      accounts.find(
        (a) => a.owner === coupleSettlement.toMember && a.type !== "CREDIT_CARD"
      ) || accounts.find((a) => a.id !== fromAcc?.id && a.type !== "CREDIT_CARD");

    if (!fromAcc || !toAcc) return;

    addTransaction({
      amount: coupleSettlement.transferAmount,
      date: new Date().toISOString().slice(0, 10),
      type: "TRANSFER",
      categoryId: "cat_expense_other",
      accountId: fromAcc.id,
      toAccountId: toAcc.id,
      memberId: coupleSettlement.fromMember,
      scope: "FAMILY",
      note: `Quyết toán chia chi chung ${getMonthDisplayLabel(activeMonthKey)}`,
    });

    setSettledToast(true);
    setTimeout(() => setSettledToast(false), 3000);
  };

  const handleGenerateDigest = async () => {
    setIsGeneratingDigest(true);
    try {
      const cards: { name: string; usagePercentage: number; usedAmount: number }[] = [];
      if (husbandCreditCard) {
        cards.push({
          name: husbandCreditCard.account.name,
          usagePercentage: husbandCreditCard.usagePercentage,
          usedAmount: husbandCreditCard.usedAmount,
        });
      }
      if (wifeCreditCard) {
        cards.push({
          name: wifeCreditCard.account.name,
          usagePercentage: wifeCreditCard.usagePercentage,
          usedAmount: wifeCreditCard.usedAmount,
        });
      }

      const result = await generateMonthlyDigest({
        monthLabel,
        summary: {
          monthlyIncome: summary.monthlyIncome,
          monthlyExpense: summary.monthlyExpense,
          savingsAmount: summary.savingsAmount,
          savingsRate: summary.savingsRate,
          netWorth: summary.netWorth,
        },
        topCategories: categoryExpenseStats.slice(0, 4).map((c) => ({
          name: c.categoryName,
          amount: c.totalAmount,
          percentage: c.percentage,
        })),
        creditCards: cards,
        budgetOverruns: budgetSummary.items
          .filter((b) => b.percentage >= 90)
          .map((b) => `${b.categoryName} (${b.percentage}%)`),
      });
      setDigest(result);
      setIsDigestExpanded(true);
    } finally {
      setIsGeneratingDigest(false);
    }
  };

  const handleApplyAllRecurring = () => {
    const count = applyAllPendingRecurringRules(activeMonthKey);
    if (count > 0) {
      setRecurringToast(`Đã ghi sổ ${count} khoản định kỳ cho ${getMonthDisplayLabel(activeMonthKey)}!`);
      setTimeout(() => setRecurringToast(null), 3000);
    }
  };

  return (
    <div className="space-y-3.5 animate-in fade-in duration-200">
      {/* 0. HORIZONTAL MONTH SELECTOR */}
      <MobileMonthSelector />

      {/* 0B. TỔNG GIA SẢN HỢP NHẤT 4 SUB-APP */}
      <UnifiedNetWorthBanner compact />

      {/* 1. HERO NET WORTH NAVY CARD */}
      <div className="rounded-xl p-4 bg-gradient-to-br from-[#0F172A] via-[#1E3A8A] to-[#1D4ED8] text-white shadow-md relative overflow-hidden space-y-3">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="text-blue-200 uppercase tracking-widest font-bold text-[10px] truncate">
            TỔNG TÀI SẢN RÒNG GIA ĐÌNH
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="px-2 py-0.5 rounded-md bg-white/15 text-blue-100 font-semibold text-[10px]">
              {monthLabel}
            </span>
            {onOpenPdfReport && (
              <button
                type="button"
                onClick={onOpenPdfReport}
                data-testid="mobile-overview-pdf-btn"
                className="min-h-[28px] px-2 py-0.5 rounded-md bg-white text-[#1E3A8A] hover:bg-blue-50 font-extrabold text-[10px] inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer shadow-2xs"
                title="Xem trước & xuất báo cáo PDF tháng chuẩn A4"
              >
                <FileText className="w-3 h-3" />
                <span>Xuất PDF</span>
              </button>
            )}
          </div>
        </div>

        <div>
          <div className="text-3xl font-black tracking-tight text-white tabular-nums">
            {formatVNDMasked(totalNetWorth, isPrivacyMode)}
          </div>
        </div>

        {/* Inline Sub-metrics Strip */}
        <div className="grid grid-cols-3 gap-2 pt-2.5 border-t border-white/15 text-xs">
          <div>
            <span className="text-[10px] text-blue-200/80 block">Thu nhập</span>
            <span className="font-extrabold text-emerald-400 text-xs sm:text-sm tabular-nums">
              +{formatVNDMasked(monthlyIncome, isPrivacyMode)}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-blue-200/80 block">Chi tiêu</span>
            <span className="font-extrabold text-rose-300 text-xs sm:text-sm tabular-nums">
              -{formatVNDMasked(monthlyExpense, isPrivacyMode)}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-blue-200/80 block">Tích lũy</span>
            <span className="font-extrabold text-blue-200 text-xs sm:text-sm tabular-nums">
              {savingsRate}%
            </span>
          </div>
        </div>
      </div>

      {/* 1B. PENDING RECURRING 1-TAP SHORTCUT */}
      {(pendingRecurring.length > 0 || recurringToast) && (
        <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-500/30 flex items-center justify-between gap-2 text-xs">
          {recurringToast ? (
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-bold">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{recurringToast}</span>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-500/25 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0">
                  <Repeat className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-[#1E3A8A] dark:text-blue-200 truncate">
                    {pendingRecurring.length} khoản định kỳ kỳ {activeMonthKey}
                  </p>
                  <p className="text-[10px] text-blue-700/80 dark:text-blue-300/80 truncate">
                    Chờ ghi nhận tự động vào sổ sách
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleApplyAllRecurring}
                className="min-h-[34px] px-3 py-1.5 rounded-lg bg-[#1E3A8A] dark:bg-blue-600 hover:bg-blue-900 dark:hover:bg-blue-700 text-white text-[11px] font-bold shrink-0 cursor-pointer"
              >
                Ghi sổ ngay
              </button>
            </>
          )}
        </div>
      )}

      {/* 1C. QUICK ADD NHẬP NHANH NGAY TRÊN MÀN HÌNH CHÍNH */}
      <QuickAddCard compact onOpenFullForm={onOpenNumpad} />

      {/* 1D. LỊCH TÀI CHÍNH GIA ĐÌNH */}
      <FinancialCalendarCard compact />

      {/* 2. DUAL BIDV CREDIT CARDS MINI WIDGET */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-200 px-0.5">
          <span className="flex items-center gap-1.5">
            <CreditCard className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>
              Thẻ Tín Dụng BIDV (Sao kê ngày {husbandCreditCard?.statementDay || 20})
            </span>
          </span>
          <button
            type="button"
            onClick={() => setActiveTab("accounts")}
            className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold hover:underline cursor-pointer"
          >
            Quản trị ➔
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {husbandCreditCard && (
            <div className="p-3 rounded-xl bg-gradient-to-br from-[#0F172A] to-[#1E3A8A] text-white shadow-xs flex flex-col justify-between space-y-2">
              <div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-bold text-blue-300 truncate">
                    👨 {settings.husbandName}
                  </span>
                  <span className="text-[9px] text-slate-300 shrink-0 tabular-nums">
                    {Math.round(husbandCreditCard.creditLimit / 1_000_000)}M
                  </span>
                </div>
                <div className="mt-1">
                  <span className="text-[10px] text-slate-300 block">Dư nợ kỳ này:</span>
                  <span className="font-black text-sm text-white tabular-nums">
                    {formatVNDMasked(husbandCreditCard.usedAmount, isPrivacyMode)}
                  </span>
                </div>
              </div>

              <div>
                <div className="relative w-full h-1.5 rounded-full bg-white/20 overflow-hidden mb-1">
                  <div
                    className={`h-full rounded-full ${getBarColor(husbandCreditCard.statusLevel)}`}
                    style={{ width: `${Math.min(husbandCreditCard.usagePercentage, 100)}%` }}
                  />
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-white/80"
                    style={{ left: "30%" }}
                    title="Mốc an toàn 30%"
                  />
                </div>
                <div className="flex items-center justify-between text-[9px] text-blue-200 mb-1.5">
                  <span>{husbandCreditCard.usagePercentage}%</span>
                  <span>{husbandCreditCard.statusLabel}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setRepayingCard(husbandCreditCard)}
                  className="w-full py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-[10px] font-bold text-white transition-colors cursor-pointer"
                >
                  Thanh toán
                </button>
              </div>
            </div>
          )}

          {wifeCreditCard && (
            <div className="p-3 rounded-xl bg-gradient-to-br from-[#451A03] to-[#78350F] text-white shadow-xs flex flex-col justify-between space-y-2">
              <div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-bold text-amber-300 truncate">
                    👩 {settings.wifeName}
                  </span>
                  <span className="text-[9px] text-amber-200 shrink-0 tabular-nums">
                    {Math.round(wifeCreditCard.creditLimit / 1_000_000)}M
                  </span>
                </div>
                <div className="mt-1">
                  <span className="text-[10px] text-amber-200/80 block">Dư nợ kỳ này:</span>
                  <span className="font-black text-sm text-white tabular-nums">
                    {formatVNDMasked(wifeCreditCard.usedAmount, isPrivacyMode)}
                  </span>
                </div>
              </div>

              <div>
                <div className="relative w-full h-1.5 rounded-full bg-white/20 overflow-hidden mb-1">
                  <div
                    className={`h-full rounded-full ${getBarColor(wifeCreditCard.statusLevel)}`}
                    style={{ width: `${Math.min(wifeCreditCard.usagePercentage, 100)}%` }}
                  />
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-white/80"
                    style={{ left: "30%" }}
                    title="Mốc an toàn 30%"
                  />
                </div>
                <div className="flex items-center justify-between text-[9px] text-amber-200 mb-1.5">
                  <span>{wifeCreditCard.usagePercentage}%</span>
                  <span>{wifeCreditCard.statusLabel}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setRepayingCard(wifeCreditCard)}
                  className="w-full py-1.5 rounded-md bg-amber-600 hover:bg-amber-500 text-[10px] font-bold text-white transition-colors cursor-pointer"
                >
                  Thanh toán
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. COUPLE SETTLEMENT COMPACT CARD */}
      <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-[#DCE4EE] dark:border-slate-800 shadow-xs space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Scale className="w-3.5 h-3.5" />
            </div>
            <div>
              <h4 className="text-xs font-extrabold text-[#172B4D] dark:text-slate-100">
                Đối soát quỹ chung ({coupleSettlement.husbandSharePct}/{coupleSettlement.wifeSharePct}%)
              </h4>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 tabular-nums">
                Tổng chi chung: {formatVNDMasked(coupleSettlement.totalSharedExpense, isPrivacyMode)}
              </p>
            </div>
          </div>

          {settledToast && (
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1 shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Đã bù trừ!
            </span>
          )}
        </div>

        {coupleSettlement.fromMember === "BALANCED" ? (
          <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-100 dark:border-emerald-500/30 flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300 font-semibold">
            <Heart className="w-4 h-4 text-rose-500 shrink-0" />
            <span>Chi chung 2 vợ chồng đang cân bằng trong kỳ này.</span>
          </div>
        ) : (
          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-[#E9EEF5] dark:border-slate-700 flex items-center justify-between gap-2 text-xs">
            <div className="min-w-0 text-slate-700 dark:text-slate-300 leading-snug">
              <strong className="text-slate-900 dark:text-slate-100">
                {coupleSettlement.fromMember === "WIFE"
                  ? `👩 ${settings.wifeName}`
                  : `👨 ${settings.husbandName}`}
              </strong>{" "}
              chuyển bù{" "}
              <strong className="text-blue-700 dark:text-blue-400 tabular-nums">
                {formatVNDMasked(coupleSettlement.transferAmount, isPrivacyMode)}
              </strong>{" "}
              cho{" "}
              <strong className="text-slate-900 dark:text-slate-100">
                {coupleSettlement.toMember === "HUSBAND"
                  ? `👨 ${settings.husbandName}`
                  : `👩 ${settings.wifeName}`}
              </strong>
            </div>
            <button
              type="button"
              onClick={handleSettleCouple}
              className="min-h-[34px] px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold shrink-0 cursor-pointer"
            >
              Tất toán ngay
            </button>
          </div>
        )}
      </div>

      {/* 4. AI MONTHLY DIGEST COMPACT CARD */}
      <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-[#DCE4EE] dark:border-slate-800 shadow-xs space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <h4 className="text-xs font-extrabold text-[#172B4D] dark:text-slate-100 truncate">
                Tổng kết AI · {monthLabel}
              </h4>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                Phân tích dòng tiền & cảnh báo thẻ BIDV
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {digest && (
              <button
                type="button"
                onClick={() => setIsDigestExpanded((v) => !v)}
                aria-label="Thu gọn hoặc mở rộng phân tích AI"
                className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center cursor-pointer"
              >
                {isDigestExpanded ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
            )}
            <button
              type="button"
              onClick={() => void handleGenerateDigest()}
              disabled={isGeneratingDigest}
              className="min-h-[34px] px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
            >
              {isGeneratingDigest ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang tạo...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3 h-3" />
                  <span>{digest ? "Phân tích lại" : "Tóm tắt AI"}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {digest && isDigestExpanded && (
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-[#E9EEF5] dark:border-slate-700 space-y-2 text-xs">
            <div className="flex items-start justify-between gap-2">
              <p className="font-bold text-[#1E3A8A] dark:text-blue-300 leading-snug">{digest.headline}</p>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 shrink-0">
                {digest.source === "gemini" ? "Gemini" : "Nội bộ"}
              </span>
            </div>
            <ul className="space-y-1 text-[11px] text-slate-600 dark:text-slate-300">
              {digest.highlights.map((h, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-blue-600 dark:text-blue-400 font-bold">•</span>
                  <span>{h}</span>
                </li>
              ))}
            </ul>
            <p className="pt-1.5 border-t border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
              💡 {digest.actionTip}
            </p>
          </div>
        )}
      </div>

      {/* 4B. GEMINI FINANCIAL INSIGHTS (3 MONEY-SAVING TIPS) */}
      <FinancialInsightsCard compact />

      {/* 4C. DỰ BÁO CHI TIÊU 3 THÁNG TỚI */}
      <SpendingForecastCard compact />

      {/* 4D. SO SÁNH CÙNG KỲ (THÁNG TRƯỚC / NĂM NGOÁI) */}
      <PeriodComparisonCompact />

      {/* 4E. BIỂU ĐỒ TRỰC QUAN TƯƠNG TÁC (THU VS CHI · XU HƯỚNG · SO SÁNH THÁNG) */}
      <AdvancedAnalyticsSuite compact />

      {/* 5. DAILY ALLOWANCE MINI CARD */}
      <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-[#DCE4EE] dark:border-slate-800 shadow-xs flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-base shrink-0 ${
              isDailyOver ? "bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400" : "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
            }`}
          >
            🛡️
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Hạn Mức Ngày ({budgetSummary.daysRemaining} ngày còn lại)
            </span>
            <span className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100 block truncate tabular-nums">
              Còn {formatVNDMasked(todayRemaining, isPrivacyMode)} /{" "}
              {formatVNDMasked(dailyAllowance, isPrivacyMode)}
            </span>
          </div>
        </div>

        <span
          className={`px-2.5 py-1 rounded-full font-bold text-[11px] shrink-0 ${
            isDailyOver
              ? "bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300"
              : dailyPct >= 75
              ? "bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300"
              : "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300"
          }`}
        >
          {isDailyOver ? "Vượt ngày" : `Đã dùng ${dailyPct}%`}
        </span>
      </div>

      {/* 6. RECENT TRANSACTIONS */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-200 px-0.5">
          <span>Giao Dịch Gần Nhất</span>
          <button
            type="button"
            onClick={() => setActiveTab("transactions")}
            className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold hover:underline cursor-pointer"
          >
            Xem tất cả ➔
          </button>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 shadow-xs divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
          {recentTransactions.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400 dark:text-slate-500 font-semibold">
              Chưa có giao dịch nào trong kỳ này
            </div>
          ) : (
            recentTransactions.map((tx) => {
              const isExpense = tx.type === "EXPENSE";
              const isTransfer = tx.type === "TRANSFER";

              return (
                <div
                  key={tx.id}
                  onClick={() => setSelectedTx(tx)}
                  className="p-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/60 active:bg-blue-50/50 dark:active:bg-slate-800 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm shrink-0 ${
                        isExpense
                          ? "bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400"
                          : isTransfer
                          ? "bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400"
                          : "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {isExpense ? "🛒" : isTransfer ? "⇄" : "💰"}
                    </div>

                    <div className="min-w-0">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block truncate">
                        {tx.note || (isExpense ? "Chi tiêu" : isTransfer ? "Chuyển tiền" : "Thu nhập")}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-400 block font-medium">
                        {tx.memberId === "HUSBAND"
                          ? `👨 ${settings.husbandName}`
                          : `👩 ${settings.wifeName}`}{" "}
                        · {formatDateVN(tx.date)}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span
                      className={`text-xs sm:text-sm font-black block tabular-nums ${
                        isExpense
                          ? "text-[#BE123C] dark:text-rose-400"
                          : isTransfer
                          ? "text-blue-600 dark:text-blue-400"
                          : "text-[#047857] dark:text-emerald-400"
                      }`}
                    >
                      {isExpense ? "-" : isTransfer ? "" : "+"}
                      {formatVNDMasked(tx.amount, isPrivacyMode)}
                    </span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                        tx.scope === "FAMILY"
                          ? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                          : "bg-purple-50 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300"
                      }`}
                    >
                      {tx.scope === "FAMILY" ? "🏠 Chung" : "👤 Riêng"}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Action Sheets liên kết */}
      <TransactionDetailSheet
        transaction={selectedTx}
        isOpen={selectedTx !== null}
        onClose={() => setSelectedTx(null)}
        onEdit={(tx) => {
          setSelectedTx(null);
          setEditingTx(tx);
        }}
        onDelete={(id) => {
          setSelectedTx(null);
          deleteTransaction(id);
        }}
      />

      <TransactionFormModal
        isOpen={editingTx !== null}
        onClose={() => setEditingTx(null)}
        editTransaction={editingTx}
      />

      <CreditCardRepaymentSheet
        cardInfo={repayingCard}
        isOpen={repayingCard !== null}
        onClose={() => setRepayingCard(null)}
      />
    </div>
  );
}
