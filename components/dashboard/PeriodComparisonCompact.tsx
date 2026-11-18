"use client";

import React, { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, BarChart3, Minus } from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import {
  formatShortVNDMasked,
  formatVNDMasked,
  getCurrentMonthKey,
} from "@/lib/formatters";
import {
  calculatePeriodComparison,
  MetricComparison,
  PeriodComparisonMode,
} from "@/lib/periodComparison";

function formatPct(m: MetricComparison): string {
  if (m.isNewBaseline) return "Mới";
  if (m.deltaPercent === null) return "—";
  if (m.deltaPercent === 0) return "0%";
  return `${m.deltaPercent > 0 ? "+" : ""}${m.deltaPercent.toLocaleString("vi-VN")}%`;
}

export function PeriodComparisonCompact() {
  const {
    transactions,
    categories,
    selectedMonth,
    activePerspective,
    isPrivacyMode,
  } = useFinance();

  const [mode, setMode] = useState<PeriodComparisonMode>("MOM");

  const activeMonthKey =
    selectedMonth === "ALL" ? getCurrentMonthKey() : selectedMonth;

  const comparison = useMemo(
    () =>
      calculatePeriodComparison({
        transactions,
        categories,
        currentMonthKey: activeMonthKey,
        mode,
        perspective: activePerspective,
        topLimit: 4,
      }),
    [transactions, categories, activeMonthKey, mode, activePerspective]
  );

  const maxCat = useMemo(() => {
    if (comparison.topCategories.length === 0) return 1;
    return Math.max(
      1,
      ...comparison.topCategories.map((c) =>
        Math.max(c.currentAmount, c.previousAmount)
      )
    );
  }, [comparison.topCategories]);

  return (
    <div
      data-testid="mobile-period-comparison-card"
      className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-[#DCE4EE] dark:border-slate-800 shadow-xs space-y-3"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <BarChart3 className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-extrabold text-[#172B4D] dark:text-slate-100 truncate">
              So Sánh Cùng Kỳ
            </h4>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate tabular-nums">
              {comparison.currentLabel} vs {comparison.previousLabel}
            </p>
          </div>
        </div>

        <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-[#E9EEF5] dark:border-slate-700 shrink-0">
          <button
            type="button"
            onClick={() => setMode("MOM")}
            className={`min-h-[32px] px-2.5 py-1 rounded-md text-[11px] font-bold whitespace-nowrap cursor-pointer ${
              mode === "MOM"
                ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs"
                : "text-slate-500 dark:text-slate-400"
            }`}
          >
            Tháng trước
          </button>
          <button
            type="button"
            onClick={() => setMode("YOY")}
            className={`min-h-[32px] px-2.5 py-1 rounded-md text-[11px] font-bold whitespace-nowrap cursor-pointer ${
              mode === "YOY"
                ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs"
                : "text-slate-500 dark:text-slate-400"
            }`}
          >
            Năm ngoái
          </button>
        </div>
      </div>

      {/* 3 Compact Metric Tiles */}
      <div className="grid grid-cols-3 gap-2">
        {(
          [
            {
              key: "income",
              label: "Thu",
              metric: comparison.income,
              invert: false,
            },
            {
              key: "expense",
              label: "Chi",
              metric: comparison.expense,
              invert: true,
            },
            {
              key: "savings",
              label: "Tiết kiệm",
              metric: comparison.savings,
              invert: false,
            },
          ] as const
        ).map((item) => {
          const isGood = item.invert
            ? item.metric.deltaAmount < 0
            : item.metric.deltaAmount > 0;
          const tone =
            item.metric.deltaAmount === 0
              ? "text-slate-500 dark:text-slate-400"
              : isGood
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-rose-600 dark:text-rose-400";

          return (
            <div
              key={item.key}
              className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-[#E9EEF5] dark:border-slate-700/80 space-y-0.5"
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                  {item.label}
                </span>
                <span className={`inline-flex items-center text-[10px] font-bold tabular-nums ${tone}`}>
                  {item.metric.deltaAmount > 0 ? (
                    <ArrowUpRight className="w-3 h-3" />
                  ) : item.metric.deltaAmount < 0 ? (
                    <ArrowDownRight className="w-3 h-3" />
                  ) : (
                    <Minus className="w-2.5 h-2.5" />
                  )}
                  {formatPct(item.metric)}
                </span>
              </div>
              <p className="text-xs font-black text-[#172B4D] dark:text-slate-100 tabular-nums truncate">
                {item.key === "savings" && item.metric.current < 0 ? "-" : ""}
                {formatShortVNDMasked(Math.abs(item.metric.current), isPrivacyMode)}
              </p>
            </div>
          );
        })}
      </div>

      {!comparison.hasPreviousData && (
        <p className="text-[10px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 rounded-lg px-2.5 py-1.5">
          Chưa có giao dịch trong {comparison.previousLabel} (đối chiếu từ 0 ₫).
        </p>
      )}

      {/* Top Expense Categories */}
      {comparison.topCategories.length > 0 && (
        <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
          <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Danh mục chi chính
          </p>
          {comparison.topCategories.map((cat) => {
            const curPct = Math.round((cat.currentAmount / maxCat) * 100);
            const prevPct = Math.round((cat.previousAmount / maxCat) * 100);
            const tone =
              cat.deltaAmount === 0
                ? "text-slate-500 dark:text-slate-400"
                : cat.deltaAmount < 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-rose-600 dark:text-rose-400";

            return (
              <div key={cat.categoryId} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="inline-flex items-center gap-1.5 min-w-0 font-bold text-slate-700 dark:text-slate-200">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: cat.categoryColor }}
                    />
                    <span className="truncate">{cat.categoryName}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 shrink-0 tabular-nums">
                    <span className="font-bold text-slate-800 dark:text-slate-100">
                      {formatVNDMasked(cat.currentAmount, isPrivacyMode)}
                    </span>
                    <span className={`text-[10px] font-bold ${tone}`}>
                      {cat.isNewBaseline
                        ? "Mới"
                        : cat.deltaPercent === null
                        ? "—"
                        : `${cat.deltaPercent > 0 ? "+" : ""}${cat.deltaPercent}%`}
                    </span>
                  </span>
                </div>
                <div className="space-y-0.5">
                  <div className="w-full h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${curPct}%`,
                        backgroundColor: cat.categoryColor,
                      }}
                    />
                  </div>
                  <div className="w-full h-0.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-slate-400 dark:bg-slate-500"
                      style={{ width: `${prevPct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
