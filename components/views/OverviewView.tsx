"use client";

import React, { useState } from "react";
import { Sparkles, Repeat, CheckCircle2, ArrowRight, Loader2, FileText } from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import {
  formatVNDMasked,
  getCurrentMonthKey,
  getMonthDisplayLabel,
} from "@/lib/formatters";
import { generateMonthlyDigest, MonthlyAIDigest } from "@/lib/geminiReceiptService";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { QuickAddCard } from "@/components/dashboard/QuickAddCard";
import { DualCreditCardsWidget } from "@/components/dashboard/DualCreditCardsWidget";
import { FamilyCashflowWidget } from "@/components/dashboard/FamilyCashflowWidget";
import { MonthlyTrendChart } from "@/components/dashboard/MonthlyTrendChart";
import { ExpensePieChart } from "@/components/dashboard/ExpensePieChart";
import { IncomePieChart } from "@/components/dashboard/IncomePieChart";
import { TrendLineCharts } from "@/components/dashboard/TrendLineCharts";
import { SixMonthIncomeExpenseLineChart } from "@/components/dashboard/SixMonthIncomeExpenseLineChart";
import { FinancialInsightsCard } from "@/components/dashboard/FinancialInsightsCard";
import { SpendingForecastCard } from "@/components/dashboard/SpendingForecastCard";
import { FinancialCalendarCard } from "@/components/dashboard/FinancialCalendarCard";
import { AssetDebtGoalsWidgets } from "@/components/dashboard/AssetDebtGoalsWidgets";
import { RecentActivitySection } from "@/components/dashboard/RecentActivitySection";

interface OverviewViewProps {
  onOpenPdfReport?: () => void;
  onOpenAddModal?: () => void;
}

export function OverviewView({ onOpenPdfReport, onOpenAddModal }: OverviewViewProps) {
  const {
    selectedMonth,
    summary,
    categoryExpenseStats,
    husbandCreditCard,
    wifeCreditCard,
    budgetSummary,
    recurringRules,
    recurringHistorySuggestions,
    applyRecurringRule,
    setActiveTab,
    isPrivacyMode,
  } = useFinance();

  const [digest, setDigest] = useState<MonthlyAIDigest | null>(null);
  const [isGeneratingDigest, setIsGeneratingDigest] = useState(false);

  const activeMonthKey = selectedMonth === "ALL" ? getCurrentMonthKey() : selectedMonth;
  const monthLabel = selectedMonth === "ALL" ? "Toàn thời gian" : getMonthDisplayLabel(selectedMonth);

  const pendingRecurring = recurringRules.filter(
    (r) => r.isActive && r.lastAppliedMonth !== activeMonthKey
  );

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
    } finally {
      setIsGeneratingDigest(false);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-200">
      {/* 0. Thanh Tác Vụ Báo Cáo Tháng & Xuất PDF */}
      {onOpenPdfReport && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 rounded-xl px-5 py-3.5 border border-[#DCE4EE] dark:border-slate-800 shadow-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/15 text-[#1E3A8A] dark:text-blue-400 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-extrabold text-[#172B4D] dark:text-slate-100 truncate">
                Đối soát & Lưu trữ kỳ {getMonthDisplayLabel(activeMonthKey)}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                Xuất bản A4 gồm tổng kết thu chi, đối soát vợ chồng và bảng chi tiết giao dịch
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenPdfReport}
            data-testid="overview-export-pdf-btn"
            className="min-h-[38px] px-3.5 py-2 rounded-lg bg-[#1E3A8A] hover:bg-blue-900 dark:bg-blue-600 dark:hover:bg-blue-700 text-white text-xs font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-xs cursor-pointer transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Xuất PDF tháng</span>
          </button>
        </div>
      )}

      {/* 1. Bốn Thẻ Chỉ Số Gradient Tổng quan */}
      <section aria-label="Thống kê tổng quan">
        <SummaryCards />
      </section>

      {/* 1A. Chế độ Ghi Nhanh (Quick Add) ngay trên Tổng quan */}
      <section aria-label="Nhập nhanh giao dịch">
        <QuickAddCard onOpenFullForm={onOpenAddModal} />
      </section>

      {/* 1B. Trợ lý AI Phân Tích Kỳ & Giao Dịch Định Kỳ Chờ Ghi Sổ */}
      <section aria-label="Phân tích AI và định kỳ" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl p-5 border border-[#DCE4EE] dark:border-slate-800 shadow-xs flex flex-col justify-between gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#172B4D] dark:text-slate-100">
                  Tổng Kết Thông Minh · {monthLabel}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  Phân tích sức khỏe dòng tiền, tỷ lệ tiết kiệm và cảnh báo thẻ tín dụng BIDV
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGenerateDigest}
              disabled={isGeneratingDigest}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
            >
              {isGeneratingDigest ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang phân tích...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{digest ? "Phân tích lại" : "Phân tích AI kỳ này"}</span>
                </>
              )}
            </button>
          </div>

          {digest ? (
            <div className="bg-slate-50 dark:bg-slate-800/80 border border-[#E9EEF5] dark:border-slate-700 rounded-xl p-4 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs sm:text-sm font-bold text-[#1E3A8A] dark:text-blue-300">{digest.headline}</p>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 shrink-0">
                  {digest.source === "gemini" ? "Gemini AI" : "Phân tích nội bộ"}
                </span>
              </div>
              <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                {digest.highlights.map((h, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-blue-600 dark:text-blue-400 font-bold">•</span>
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                💡 Gợi ý hành động: {digest.actionTip}
              </div>
            </div>
          ) : (
            <div className="bg-slate-50/70 dark:bg-slate-800/60 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
              Nhấn <strong>&ldquo;Phân tích AI kỳ này&rdquo;</strong> để nhận bản tóm tắt tài chính cho {monthLabel} (hoạt động ngay cả khi offline).
            </div>
          )}
        </div>

        {/* Recurring Quick Strip */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-[#DCE4EE] dark:border-slate-800 shadow-xs flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Repeat className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#172B4D] dark:text-slate-100">Định Kỳ ({activeMonthKey})</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {pendingRecurring.length > 0
                    ? `${pendingRecurring.length} khoản chờ ghi sổ`
                    : "Đã ghi đủ kỳ này"}
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveTab("planning")}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Quản lý</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-2 max-h-40 overflow-y-auto">
            {pendingRecurring.length === 0 ? (
              <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Tất cả thu/chi định kỳ đã được ghi nhận cho kỳ {activeMonthKey}.</span>
              </div>
            ) : (
              pendingRecurring.slice(0, 3).map((rule) => (
                <div
                  key={rule.id}
                  className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-[#E9EEF5] dark:border-slate-700 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{rule.name}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                      Ngày {rule.dayOfMonth} ·{" "}
                      <span className={rule.type === "INCOME" ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-rose-600 dark:text-rose-400 font-bold"}>
                        {formatVNDMasked(rule.amount, isPrivacyMode)}
                      </span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => applyRecurringRule(rule.id, activeMonthKey)}
                    className="px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold shrink-0 cursor-pointer"
                  >
                    Ghi sổ
                  </button>
                </div>
              ))
            )}
          </div>

          {recurringHistorySuggestions.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveTab("planning")}
              className="w-full text-left px-3 py-2 rounded-lg bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/70 text-[11px] font-bold text-indigo-700 dark:text-indigo-300 flex items-center justify-between gap-2 cursor-pointer hover:bg-indigo-100/70 dark:hover:bg-indigo-900/40 transition-colors"
            >
              <span className="truncate tabular-nums">
                Phát hiện {recurringHistorySuggestions.length} mẫu cố định từ lịch sử
              </span>
              <span className="shrink-0 underline">Xem gợi ý</span>
            </button>
          )}
        </div>
      </section>

      {/* 1B-2. Lịch Tài Chính Tương Tác (Định kỳ, Trả góp SKYONE & Hạn thẻ) */}
      <FinancialCalendarCard />

      {/* 1C. Phân tích chi tiêu AI & 3 mẹo tiết kiệm hàng tháng */}
      <section aria-label="Phân tích chi tiêu và mẹo tiết kiệm AI">
        <FinancialInsightsCard />
      </section>

      {/* 1D. Dự báo xu hướng chi tiêu 3 tháng tiếp theo */}
      <section aria-label="Dự báo xu hướng chi tiêu 3 tháng tới">
        <SpendingForecastCard />
      </section>

      {/* 2. Widget Quản lý 2 Thẻ Tín Dụng BIDV Credit */}
      <section aria-label="Quản lý thẻ tín dụng BIDV">
        <DualCreditCardsWidget />
      </section>

      {/* 3. Phân Tích Dòng Tiền & Heatmap */}
      <section aria-label="Dòng tiền gia đình">
        <FamilyCashflowWidget />
      </section>

      {/* 4. Hàng Biểu Đồ */}
      <section aria-label="Biểu đồ phân tích" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <MonthlyTrendChart />
        </div>
        <div className="lg:col-span-1">
          <ExpensePieChart />
        </div>
        <div className="lg:col-span-1">
          <IncomePieChart />
        </div>
      </section>

      {/* 4B. So sánh Thu nhập vs Chi tiêu 6 tháng (Recharts LineChart) */}
      <section aria-label="Xu hướng thu chi 6 tháng">
        <SixMonthIncomeExpenseLineChart />
      </section>

      {/* 5. Xu hướng tích lũy */}
      <section aria-label="Xu hướng lũy kế">
        <TrendLineCharts />
      </section>

      {/* 6. Tài sản nợ & mục tiêu */}
      <section aria-label="Tài sản nợ và mục tiêu">
        <AssetDebtGoalsWidgets />
      </section>

      {/* 7. Hoạt động gần đây & Ngân sách tháng */}
      <section aria-label="Hoạt động gần đây">
        <RecentActivitySection />
      </section>
    </div>
  );
}
