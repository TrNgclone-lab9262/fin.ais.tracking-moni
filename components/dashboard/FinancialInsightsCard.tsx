"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Sparkles, RefreshCw, AlertCircle, ArrowRight, Wallet } from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import {
  formatVNDMasked,
  getCurrentMonthKey,
  getMonthDisplayLabel,
} from "@/lib/formatters";
import { shiftMonthKey } from "@/lib/financeEngine";
import {
  analyzeFinancialInsights,
  FinancialInsightsResponse,
} from "@/lib/geminiReceiptService";

interface FinancialInsightsCardProps {
  compact?: boolean;
}

export function FinancialInsightsCard({ compact = false }: FinancialInsightsCardProps) {
  const {
    transactions,
    categories,
    selectedMonth,
    activePerspective,
    summary,
    budgetSummary,
    husbandCreditCard,
    wifeCreditCard,
    settings,
    isPrivacyMode,
    setActiveTab,
  } = useFinance();

  const [insights, setInsights] = useState<FinancialInsightsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetMonth = selectedMonth === "ALL" ? getCurrentMonthKey() : selectedMonth;
  const previousMonth = shiftMonthKey(targetMonth, -1);
  const monthLabel =
    selectedMonth === "ALL" ? "Toàn thời gian" : getMonthDisplayLabel(selectedMonth);

  const perspectiveLabel =
    activePerspective === "HUSBAND"
      ? settings.husbandName
      : activePerspective === "WIFE"
      ? settings.wifeName
      : "Cả nhà";

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );

  // Reset kết quả cũ khi đổi tháng hoặc đổi góc nhìn thành viên
  useEffect(() => {
    setInsights(null);
    setError(null);
  }, [selectedMonth, activePerspective]);

  const spendingProfile = useMemo(() => {
    const matchesPerspective = (memberId: string) =>
      activePerspective === "ALL" || memberId === activePerspective;

    const currentExpenses = transactions.filter(
      (tx) =>
        tx.type === "EXPENSE" &&
        (selectedMonth === "ALL" || tx.date.startsWith(selectedMonth)) &&
        matchesPerspective(tx.memberId)
    );

    const prevExpenses =
      selectedMonth === "ALL"
        ? []
        : transactions.filter(
            (tx) =>
              tx.type === "EXPENSE" &&
              tx.date.startsWith(previousMonth) &&
              matchesPerspective(tx.memberId)
          );

    const totalExpense = currentExpenses.reduce((sum, tx) => sum + tx.amount, 0);
    const previousMonthExpense = prevExpenses.reduce((sum, tx) => sum + tx.amount, 0);

    const currentByCat = new Map<string, number>();
    const prevByCat = new Map<string, number>();
    const merchantMap = new Map<string, { label: string; count: number; totalAmount: number }>();

    let recurringTotal = 0;
    let discretionaryTotal = 0;

    for (const tx of currentExpenses) {
      currentByCat.set(tx.categoryId, (currentByCat.get(tx.categoryId) || 0) + tx.amount);

      if (tx.tag === "RECURRING") {
        recurringTotal += tx.amount;
      } else {
        discretionaryTotal += tx.amount;
      }

      const rawLabel = (tx.note || categoryMap.get(tx.categoryId)?.name || "Chi tiêu khác").trim();
      const normalizedKey = rawLabel.toLowerCase();
      const existing = merchantMap.get(normalizedKey);
      if (existing) {
        existing.count += 1;
        existing.totalAmount += tx.amount;
      } else {
        merchantMap.set(normalizedKey, {
          label: rawLabel.slice(0, 60),
          count: 1,
          totalAmount: tx.amount,
        });
      }
    }

    for (const tx of prevExpenses) {
      prevByCat.set(tx.categoryId, (prevByCat.get(tx.categoryId) || 0) + tx.amount);
    }

    const categoryBreakdown = Array.from(currentByCat.entries())
      .map(([catId, amount]) => {
        const cat = categoryMap.get(catId);
        return {
          name: cat?.name || "Khác",
          amount,
          percentage: totalExpense > 0 ? Math.round((amount / totalExpense) * 100) : 0,
          prevAmount: prevByCat.get(catId) || 0,
        };
      })
      .sort((a, b) => b.amount - a.amount);

    const topMerchants = Array.from(merchantMap.values())
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 8);

    const recentTransactions = [...currentExpenses]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 25)
      .map((tx) => ({
        date: tx.date,
        amount: tx.amount,
        category: categoryMap.get(tx.categoryId)?.name || "Khác",
        note: (tx.note || "Không có ghi chú").slice(0, 80),
        scope: tx.scope === "FAMILY" ? "Chung" : "Riêng",
      }));

    return {
      expenseCount: currentExpenses.length,
      totalExpense,
      previousMonthExpense,
      categoryBreakdown,
      topMerchants,
      recurringTotal,
      discretionaryTotal,
      recentTransactions,
    };
  }, [transactions, selectedMonth, previousMonth, activePerspective, categoryMap]);

  const handleAnalyze = async () => {
    if (spendingProfile.expenseCount === 0 || isLoading) return;
    setIsLoading(true);
    setError(null);

    try {
      const creditCards: { name: string; usagePercentage: number; usedAmount: number }[] = [];
      if (husbandCreditCard) {
        creditCards.push({
          name: husbandCreditCard.account.name,
          usagePercentage: husbandCreditCard.usagePercentage,
          usedAmount: husbandCreditCard.usedAmount,
        });
      }
      if (wifeCreditCard) {
        creditCards.push({
          name: wifeCreditCard.account.name,
          usagePercentage: wifeCreditCard.usagePercentage,
          usedAmount: wifeCreditCard.usedAmount,
        });
      }

      const result = await analyzeFinancialInsights({
        monthLabel,
        perspectiveLabel,
        totalIncome: summary.monthlyIncome,
        totalExpense: spendingProfile.totalExpense,
        savingsRate: summary.savingsRate,
        previousMonthExpense: spendingProfile.previousMonthExpense,
        categoryBreakdown: spendingProfile.categoryBreakdown,
        topMerchants: spendingProfile.topMerchants,
        recurringTotal: spendingProfile.recurringTotal,
        discretionaryTotal: spendingProfile.discretionaryTotal,
        recentTransactions: spendingProfile.recentTransactions,
        budgetOverruns: budgetSummary.items
          .filter((b) => b.percentage >= 85)
          .map((b) => `${b.categoryName} (${b.percentage}%)`),
        creditCards,
      });

      setInsights(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Không thể phân tích dữ liệu chi tiêu lúc này. Vui lòng thử lại."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const totalEstimatedSavings = insights
    ? insights.tips.reduce((sum, tip) => sum + (tip.estimatedMonthlySavings || 0), 0)
    : 0;

  return (
    <div
      data-testid="financial-insights-card"
      className={`bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 shadow-xs ${
        compact ? "p-4 space-y-3" : "p-5 sm:p-6 space-y-4"
      }`}
    >
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-[#E9EEF5] dark:border-slate-800">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-bold text-[#172B4D] dark:text-slate-100">
              Phân Tích Chi Tiêu &amp; Mẹo Tiết Kiệm
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5 tabular-nums">
              {monthLabel} · {perspectiveLabel} · {spendingProfile.expenseCount} khoản chi
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void handleAnalyze()}
          disabled={isLoading || spendingProfile.expenseCount === 0}
          className="min-h-[40px] px-4 py-2 rounded-lg bg-[#1E3A8A] hover:bg-blue-800 disabled:opacity-50 text-white text-xs font-bold inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          {isLoading ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Đang phân tích...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              <span>{insights ? "Phân tích lại" : "Phân tích chi tiêu"}</span>
            </>
          )}
        </button>
      </div>

      {/* State 1: Empty */}
      {spendingProfile.expenseCount === 0 ? (
        <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-2.5 text-slate-600 dark:text-slate-300">
            <Wallet className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-700 dark:text-slate-200">
                Chưa có giao dịch chi tiêu trong {monthLabel}
              </p>
              <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                Ghi nhận giao dịch chi tiêu để Gemini phân tích thói quen và đề xuất 3 mẹo tiết kiệm.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab("transactions")}
            className="min-h-[40px] px-3.5 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>Ghi giao dịch</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : isLoading ? (
        /* State 2: Loading Skeleton */
        <div className="space-y-3 animate-pulse" aria-busy="true">
          <div className="space-y-2 pb-3 border-b border-[#E9EEF5] dark:border-slate-800">
            <div className="h-3.5 w-3/4 bg-slate-200 dark:bg-slate-800 rounded" />
            <div className="h-3 w-1/2 bg-slate-100 dark:bg-slate-800/70 rounded" />
          </div>
          {[1, 2, 3].map((idx) => (
            <div
              key={idx}
              className="py-2.5 border-b last:border-b-0 border-[#E9EEF5] dark:border-slate-800 space-y-2"
            >
              <div className="h-3.5 w-2/5 bg-slate-200 dark:bg-slate-800 rounded" />
              <div className="h-3 w-11/12 bg-slate-100 dark:bg-slate-800/70 rounded" />
            </div>
          ))}
        </div>
      ) : error ? (
        /* State 3: Error with explicit retry */
        <div
          role="alert"
          className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
        >
          <div className="flex items-start gap-2.5 text-rose-700 dark:text-rose-300">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Chưa thể tạo phân tích Gemini AI</p>
              <p className="text-rose-600/90 dark:text-rose-300/90 mt-0.5 leading-relaxed">
                {error}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void handleAnalyze()}
            className="min-h-[40px] px-3.5 py-2 rounded-lg bg-rose-50 dark:bg-rose-500/15 hover:bg-rose-100 dark:hover:bg-rose-500/25 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30 text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Thử lại</span>
          </button>
        </div>
      ) : insights ? (
        /* State 4: Populated Gemini Insights & 3 Actionable Tips */
        <div className="space-y-4">
          {/* Pattern Summary */}
          <div className="space-y-1.5 pb-3.5 border-b border-[#E9EEF5] dark:border-slate-800">
            <p className="text-xs sm:text-sm font-semibold text-[#172B4D] dark:text-slate-100 leading-relaxed">
              {insights.patternSummary}
            </p>
            {insights.comparisonNote && (
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {insights.comparisonNote}
              </p>
            )}
            {totalEstimatedSavings > 0 && (
              <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 pt-1 tabular-nums">
                Tiềm năng tiết kiệm tổng cộng ~{formatVNDMasked(totalEstimatedSavings, isPrivacyMode)}/tháng nếu áp dụng cả 3 gợi ý
              </p>
            )}
          </div>

          {/* 3 Actionable Money-Saving Tips separated by subtle hairline dividers */}
          <div className="divide-y divide-[#E9EEF5] dark:divide-slate-800">
            {insights.tips.map((tip, index) => (
              <div
                key={`${tip.title}-${index}`}
                className="py-3 first:pt-0 last:pb-0 flex items-start gap-3"
              >
                <span className="text-xs font-black text-blue-600 dark:text-blue-400 tabular-nums pt-0.5 shrink-0">
                  {String(index + 1).padStart(2, "0")}.
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <h4 className="text-xs sm:text-sm font-bold text-[#172B4D] dark:text-slate-100">
                      {tip.title}
                    </h4>
                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 tabular-nums whitespace-nowrap">
                      Tiết kiệm ~{formatVNDMasked(tip.estimatedMonthlySavings, isPrivacyMode)}/tháng
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {tip.action}
                  </p>
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Danh mục mục tiêu: {tip.targetCategory}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* State 5: Idle */
        <div className="py-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-300">
          <p className="leading-relaxed">
            Nhấn <strong className="text-[#172B4D] dark:text-slate-100">Phân tích chi tiêu</strong> để Gemini rà soát{" "}
            <span className="font-bold text-[#172B4D] dark:text-slate-100 tabular-nums">
              {spendingProfile.expenseCount} giao dịch
            </span>{" "}
            (tổng{" "}
            <span className="font-bold text-rose-600 dark:text-rose-400 tabular-nums">
              {formatVNDMasked(spendingProfile.totalExpense, isPrivacyMode)}
            </span>
            ) và đề xuất 3 mẹo tiết kiệm thực tế cho kỳ {monthLabel}.
          </p>
        </div>
      )}
    </div>
  );
}
