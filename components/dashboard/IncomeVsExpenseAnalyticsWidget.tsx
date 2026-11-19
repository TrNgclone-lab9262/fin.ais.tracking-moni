"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, ExternalLink } from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import {
  buildIncomeVsExpenseAnalytics,
  IncomeExpensePoint,
  IncomeExpenseRange,
} from "@/lib/dashboardAnalytics";
import { formatShortVNDMasked, formatVNDMasked } from "@/lib/formatters";
import { useResponsive } from "@/src/hooks/useResponsive";
import { computeResponsiveXAxisInterval } from "@/lib/viewport";

function IncomeExpenseTooltip({
  active,
  payload,
  isPrivacyMode,
}: {
  active?: boolean;
  payload?: { payload?: IncomeExpensePoint }[];
  isPrivacyMode: boolean;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const pt = payload[0]?.payload;
  if (!pt) return null;

  const isSurplus = pt.net >= 0;

  return (
    <div className="bg-slate-900/95 backdrop-blur-md text-white text-xs p-3 rounded-xl shadow-xl border border-slate-800 space-y-1.5 min-w-[220px] tabular-nums">
      <div className="font-bold text-slate-100 border-b border-slate-700/80 pb-1 flex items-center justify-between gap-3">
        <span>{pt.fullLabel}</span>
        <span className="text-[11px] font-medium text-slate-400">{pt.txCount} GD</span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-slate-300">Thu nhập</span>
        <span className="font-bold text-emerald-400">
          {formatVNDMasked(pt.income, isPrivacyMode)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-slate-300">Chi tiêu</span>
        <span className="font-bold text-rose-400">
          {formatVNDMasked(pt.expense, isPrivacyMode)}
        </span>
      </div>
      <div className="pt-1 border-t border-slate-700/80 flex items-center justify-between gap-4">
        <span className="text-slate-300 font-medium">Dòng tiền ròng</span>
        <span
          className={`font-extrabold ${
            isSurplus ? "text-blue-300" : "text-amber-300"
          }`}
        >
          {isSurplus ? "+" : "-"}
          {formatVNDMasked(Math.abs(pt.net), isPrivacyMode)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-slate-400">Tỷ lệ tiết kiệm</span>
        <span
          className={`font-extrabold ${
            pt.savingsRate >= 20
              ? "text-emerald-300"
              : pt.savingsRate >= 0
              ? "text-blue-300"
              : "text-rose-300"
          }`}
        >
          {pt.savingsRate > 0 ? "+" : ""}
          {pt.savingsRate}%
        </span>
      </div>
    </div>
  );
}

const RANGE_TABS: { id: IncomeExpenseRange; label: string }[] = [
  { id: "6M", label: "6 tháng" },
  { id: "12M", label: "12 tháng" },
  { id: "ALL", label: "Toàn bộ" },
];

export function IncomeVsExpenseAnalyticsWidget({ compact = false }: { compact?: boolean }) {
  const {
    transactions,
    activePerspective,
    selectedMonth,
    isPrivacyMode,
    themeMode,
    setSelectedMonth,
    setSelectedCategory,
    setSelectedType,
    setActiveTab,
  } = useFinance();

  const { isMobile } = useResponsive();
  const isDark = themeMode === "dark";

  const [isMounted, setIsMounted] = useState(false);
  const [range, setRange] = useState<IncomeExpenseRange>("6M");
  const [showIncome, setShowIncome] = useState(true);
  const [showExpense, setShowExpense] = useState(true);
  const [showSavingsRate, setShowSavingsRate] = useState(true);
  const [pinnedMonth, setPinnedMonth] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const analytics = useMemo(
    () =>
      buildIncomeVsExpenseAnalytics({
        transactions,
        perspective: activePerspective,
        range,
        selectedMonth,
      }),
    [transactions, activePerspective, range, selectedMonth]
  );

  const activePoint = useMemo(() => {
    if (pinnedMonth) {
      const found = analytics.points.find((p) => p.month === pinnedMonth);
      if (found) return found;
    }
    const lastWithActivity = [...analytics.points]
      .reverse()
      .find((p) => p.income > 0 || p.expense > 0);
    return lastWithActivity || analytics.points[analytics.points.length - 1] || null;
  }, [analytics.points, pinnedMonth]);

  const handleOpenMonthLedger = (monthKey: string) => {
    setSelectedMonth(monthKey);
    setSelectedType("ALL");
    setSelectedCategory("ALL");
    setActiveTab("transactions");
  };

  return (
    <section
      data-testid="income-vs-expense-analytics-widget"
      aria-label="Phân tích Thu nhập so với Chi tiêu và Tỷ lệ tiết kiệm"
      className="bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 p-4 sm:p-5 space-y-4"
    >
      {/* Header Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-[#E9EEF5] dark:border-slate-800">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-bold text-[#172B4D] dark:text-slate-100 leading-snug">
              Thu nhập vs Chi tiêu &amp; Tỷ lệ Tiết kiệm
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {analytics.surplusMonthsCount}/{analytics.points.length} tháng thặng dư · Nhấn vào cột tháng để soi chi tiết dòng tiền
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Interactive Series Toggles */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowIncome((v) => !v)}
              aria-pressed={showIncome}
              className={`min-h-[34px] px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                showIncome
                  ? "bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300"
                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-400"
              }`}
            >
              Thu nhập
            </button>
            <button
              type="button"
              onClick={() => setShowExpense((v) => !v)}
              aria-pressed={showExpense}
              className={`min-h-[34px] px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                showExpense
                  ? "bg-rose-50 dark:bg-rose-950/50 border-rose-300 dark:border-rose-700 text-rose-700 dark:text-rose-300"
                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-400"
              }`}
            >
              Chi tiêu
            </button>
            <button
              type="button"
              onClick={() => setShowSavingsRate((v) => !v)}
              aria-pressed={showSavingsRate}
              className={`min-h-[34px] px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                showSavingsRate
                  ? "bg-blue-50 dark:bg-blue-950/50 border-blue-300 dark:border-blue-700 text-[#1E3A8A] dark:text-blue-300"
                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-400"
              }`}
            >
              Tỷ lệ tiết kiệm %
            </button>
          </div>

          {/* Range Tabs */}
          <div
            role="group"
            aria-label="Khung thời gian Thu vs Chi"
            className="inline-flex items-center rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 border border-[#DCE4EE] dark:border-slate-700"
          >
            {RANGE_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setRange(t.id);
                  setPinnedMonth(null);
                }}
                aria-pressed={range === t.id}
                className={`min-h-[32px] px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  range === t.id
                    ? "bg-white dark:bg-slate-900 text-[#1E3A8A] dark:text-blue-300 shadow-2xs"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Metric Strip (Single-Elevation) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 text-xs tabular-nums">
        <div>
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
            Tổng thu nhập kỳ chọn
          </span>
          <span className="text-base sm:text-lg font-black text-emerald-700 dark:text-emerald-400">
            {formatVNDMasked(analytics.totalIncome, isPrivacyMode)}
          </span>
        </div>
        <div>
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
            Tổng chi tiêu kỳ chọn
          </span>
          <span className="text-base sm:text-lg font-black text-rose-600 dark:text-rose-400">
            {formatVNDMasked(analytics.totalExpense, isPrivacyMode)}
          </span>
        </div>
        <div>
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
            Tích lũy ròng (Thu − Chi)
          </span>
          <span
            className={`text-base sm:text-lg font-black ${
              analytics.totalNet >= 0
                ? "text-[#1E3A8A] dark:text-blue-300"
                : "text-amber-700 dark:text-amber-300"
            }`}
          >
            {analytics.totalNet >= 0 ? "+" : "-"}
            {formatVNDMasked(Math.abs(analytics.totalNet), isPrivacyMode)}
          </span>
        </div>
        <div>
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
            Tỷ lệ tiết kiệm bình quân
          </span>
          <span
            className={`text-base sm:text-lg font-black ${
              analytics.avgSavingsRate >= 20
                ? "text-emerald-700 dark:text-emerald-400"
                : analytics.avgSavingsRate >= 0
                ? "text-blue-700 dark:text-blue-300"
                : "text-rose-600 dark:text-rose-400"
            }`}
          >
            {analytics.avgSavingsRate}%
          </span>
          <span className="block text-[10px] text-slate-500 dark:text-slate-400">
            Mốc khỏe mạnh: ≥ 20%
          </span>
        </div>
      </div>

      {/* Dual-Axis ComposedChart */}
      <div className={compact ? "h-[240px] w-full" : "h-[290px] w-full"}>
        {!isMounted ? (
          <div className="h-full flex items-center justify-center text-xs text-slate-400">
            Đang dựng biểu đồ Thu nhập vs Chi tiêu...
          </div>
        ) : analytics.totalIncome === 0 && analytics.totalExpense === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-slate-500 dark:text-slate-400">
            Chưa có dữ liệu thu chi trong khung thời gian đã chọn.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <ComposedChart
              data={analytics.points}
              margin={{
                top: 10,
                right: showSavingsRate && !isMobile ? 8 : 4,
                left: isMobile ? -12 : -4,
                bottom: 0,
              }}
              barGap={4}
              onClick={(state) => {
                const label = state?.activeLabel;
                if (typeof label === "string") {
                  const found = analytics.points.find((p) => p.label === label);
                  if (found) setPinnedMonth(found.month);
                }
              }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke={isDark ? "#1E293B" : "#E2E8F0"}
              />
              <XAxis
                dataKey="label"
                interval={computeResponsiveXAxisInterval(analytics.points.length, isMobile, 6)}
                minTickGap={isMobile ? 18 : 10}
                tick={{ fontSize: isMobile ? 10 : 11, fill: isDark ? "#94A3B8" : "#64748B" }}
                axisLine={{ stroke: isDark ? "#334155" : "#CBD5E1" }}
                tickLine={false}
              />
              <YAxis
                yAxisId="vnd"
                tickCount={isMobile ? 4 : 5}
                width={isMobile ? 46 : 56}
                tick={{ fontSize: isMobile ? 10 : 11, fill: isDark ? "#94A3B8" : "#64748B" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => formatShortVNDMasked(Number(v), isPrivacyMode)}
              />
              {showSavingsRate && (
                <YAxis
                  yAxisId="pct"
                  orientation="right"
                  hide={isMobile}
                  domain={[-40, 100]}
                  tickCount={5}
                  width={42}
                  tick={{ fontSize: 11, fill: isDark ? "#93C5FD" : "#1D4ED8" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v}%`}
                />
              )}
              <Tooltip content={<IncomeExpenseTooltip isPrivacyMode={isPrivacyMode} />} />
              {showSavingsRate && (
                <ReferenceLine
                  yAxisId="pct"
                  y={20}
                  stroke={isDark ? "#60A5FA" : "#2563EB"}
                  strokeDasharray="4 4"
                  strokeOpacity={0.55}
                />
              )}
              {showIncome && (
                <Bar
                  yAxisId="vnd"
                  dataKey="income"
                  name="Thu nhập"
                  fill="#10B981"
                  radius={[5, 5, 0, 0]}
                  maxBarSize={isMobile ? 16 : 26}
                  className="cursor-pointer"
                />
              )}
              {showExpense && (
                <Bar
                  yAxisId="vnd"
                  dataKey="expense"
                  name="Chi tiêu"
                  fill="#F43F5E"
                  radius={[5, 5, 0, 0]}
                  maxBarSize={isMobile ? 16 : 26}
                  className="cursor-pointer"
                />
              )}
              {showSavingsRate && (
                <Line
                  yAxisId="pct"
                  type="monotone"
                  dataKey="savingsRate"
                  name="Tỷ lệ tiết kiệm (%)"
                  stroke={isDark ? "#60A5FA" : "#1D4ED8"}
                  strokeWidth={2.4}
                  dot={{ r: 3.5, fill: isDark ? "#0F172A" : "#FFFFFF", strokeWidth: 2 }}
                  activeDot={{ r: 5.5 }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Pinned Month Inspector + 1-Click Drill-Down */}
      {activePoint && (
        <div className="pt-3 border-t border-[#E9EEF5] dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs tabular-nums">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-slate-600 dark:text-slate-300">
            <span className="font-extrabold text-[#172B4D] dark:text-slate-100">
              {activePoint.fullLabel}
            </span>
            <span aria-hidden="true" className="text-slate-400">
              ·
            </span>
            <span>
              Thu{" "}
              <strong className="text-emerald-700 dark:text-emerald-400">
                {formatShortVNDMasked(activePoint.income, isPrivacyMode)}
              </strong>
            </span>
            <span aria-hidden="true" className="text-slate-400">
              ·
            </span>
            <span>
              Chi{" "}
              <strong className="text-rose-600 dark:text-rose-400">
                {formatShortVNDMasked(activePoint.expense, isPrivacyMode)}
              </strong>
            </span>
            <span aria-hidden="true" className="text-slate-400">
              ·
            </span>
            <span>
              Ròng{" "}
              <strong
                className={
                  activePoint.net >= 0
                    ? "text-[#1E3A8A] dark:text-blue-300"
                    : "text-amber-700 dark:text-amber-300"
                }
              >
                {activePoint.net >= 0 ? "+" : "-"}
                {formatShortVNDMasked(Math.abs(activePoint.net), isPrivacyMode)} ({activePoint.savingsRate}%)
              </strong>
            </span>
          </div>

          <button
            type="button"
            onClick={() => handleOpenMonthLedger(activePoint.month)}
            className="min-h-[34px] px-3 py-1 rounded-lg bg-[#1E3A8A] hover:bg-blue-900 dark:bg-blue-600 dark:hover:bg-blue-700 text-white text-[11px] font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
          >
            <span>Mở sổ giao dịch tháng này</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      )}
    </section>
  );
}
