"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDownRight, ArrowUpRight, Layers } from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import {
  buildMonthlyExpenseComparison,
  CategoryComparisonRow,
  resolveAnchorMonth,
  shiftMonthKey,
  StackedCategoryMeta,
} from "@/lib/dashboardAnalytics";
import {
  formatShortVNDMasked,
  formatVNDMasked,
  getMonthDisplayLabel,
} from "@/lib/formatters";
import { useResponsive } from "@/src/hooks/useResponsive";

type ComparisonViewMode = "COMPARE_2M" | "STACKED_6M";

function GroupedComparisonTooltip({
  active,
  payload,
  monthALabel,
  monthBLabel,
  isPrivacyMode,
}: {
  active?: boolean;
  payload?: { payload?: CategoryComparisonRow }[];
  monthALabel: string;
  monthBLabel: string;
  isPrivacyMode: boolean;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  return (
    <div className="bg-slate-900/95 backdrop-blur-md text-white text-xs p-3 rounded-xl shadow-xl border border-slate-800 space-y-1.5 min-w-[215px] tabular-nums">
      <div className="font-bold text-slate-100 border-b border-slate-700/80 pb-1">
        {row.categoryName}
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-slate-300">{monthALabel}</span>
        <span className="font-extrabold text-blue-300">
          {formatVNDMasked(row.amountA, isPrivacyMode)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-slate-300">{monthBLabel}</span>
        <span className="font-bold text-slate-300">
          {formatVNDMasked(row.amountB, isPrivacyMode)}
        </span>
      </div>
      <div className="pt-1 border-t border-slate-700/80 flex items-center justify-between gap-4">
        <span className="text-slate-400">Chênh lệch</span>
        <span
          className={`font-extrabold ${
            row.delta > 0 ? "text-rose-400" : row.delta < 0 ? "text-emerald-400" : "text-slate-300"
          }`}
        >
          {row.delta > 0 ? "+" : row.delta < 0 ? "-" : ""}
          {formatVNDMasked(Math.abs(row.delta), isPrivacyMode)}
          {row.deltaPct !== null ? ` (${row.deltaPct > 0 ? "+" : ""}${row.deltaPct}%)` : ""}
        </span>
      </div>
    </div>
  );
}

function StackedExpenseTooltip({
  active,
  payload,
  series,
  isPrivacyMode,
}: {
  active?: boolean;
  payload?: { payload?: { fullLabel: string; total: number; values: Record<string, number> } }[];
  series: StackedCategoryMeta[];
  isPrivacyMode: boolean;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  return (
    <div className="bg-slate-900/95 backdrop-blur-md text-white text-xs p-3 rounded-xl shadow-xl border border-slate-800 space-y-1.5 min-w-[215px] tabular-nums">
      <div className="font-bold text-slate-100 border-b border-slate-700/80 pb-1 flex items-center justify-between gap-3">
        <span>{row.fullLabel}</span>
        <span className="text-rose-300 font-extrabold">
          {formatShortVNDMasked(row.total, isPrivacyMode)}
        </span>
      </div>
      {series.map((s) => {
        const val = row.values[s.key] || 0;
        if (val <= 0) return null;
        return (
          <div key={s.key} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-slate-300 truncate">
              <span
                className="w-2 h-2 rounded-xs shrink-0"
                style={{ backgroundColor: s.color }}
              />
              <span className="truncate">{s.name}</span>
            </span>
            <span className="font-bold text-white shrink-0">
              {formatVNDMasked(val, isPrivacyMode)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function MonthlyExpenseComparisonWidget({ compact = false }: { compact?: boolean }) {
  const {
    transactions,
    categories,
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
  const [mode, setMode] = useState<ComparisonViewMode>("COMPARE_2M");

  const defaultMonthA = useMemo(
    () => resolveAnchorMonth(transactions, selectedMonth),
    [transactions, selectedMonth]
  );

  const [monthA, setMonthA] = useState<string>(defaultMonthA);
  const [monthB, setMonthB] = useState<string>(() => shiftMonthKey(defaultMonthA, -1));

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    setMonthA(defaultMonthA);
    setMonthB(shiftMonthKey(defaultMonthA, -1));
  }, [defaultMonthA]);

  const comparison = useMemo(
    () =>
      buildMonthlyExpenseComparison({
        transactions,
        categories,
        perspective: activePerspective,
        monthA,
        monthB,
        stackedMonthCount: 6,
      }),
    [transactions, categories, activePerspective, monthA, monthB]
  );

  const topChartRows = useMemo(
    () => comparison.categoryRows.slice(0, isMobile ? 5 : 6),
    [comparison.categoryRows, isMobile]
  );

  const handleOpenCategory = (catId: string) => {
    setSelectedMonth(monthA);
    setSelectedType("EXPENSE");
    setSelectedCategory(catId);
    setActiveTab("transactions");
  };

  return (
    <section
      data-testid="monthly-expense-comparison-widget"
      aria-label="So sánh chi tiêu theo tháng và hạng mục"
      className="bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 p-4 sm:p-5 flex flex-col justify-between gap-4 h-full"
    >
      {/* Header & Mode Switcher */}
      <div className="space-y-3 pb-3 border-b border-[#E9EEF5] dark:border-slate-800">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/15 text-[#1E3A8A] dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
              <Layers className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-[#172B4D] dark:text-slate-100 leading-snug">
                So sánh Chi tiêu Hàng tháng
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate tabular-nums">
                {mode === "COMPARE_2M"
                  ? `${comparison.monthALabel} vs ${comparison.monthBLabel}`
                  : `Cơ cấu Top ${Math.min(5, comparison.stackedSeries.length)} hạng mục 6 tháng`}
              </p>
            </div>
          </div>

          <div
            role="group"
            aria-label="Chế độ so sánh chi tiêu"
            className="inline-flex items-center rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 border border-[#DCE4EE] dark:border-slate-700 shrink-0"
          >
            <button
              type="button"
              onClick={() => setMode("COMPARE_2M")}
              aria-pressed={mode === "COMPARE_2M"}
              className={`min-h-[32px] px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                mode === "COMPARE_2M"
                  ? "bg-white dark:bg-slate-900 text-[#1E3A8A] dark:text-blue-300 shadow-2xs"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              So sánh 2 tháng
            </button>
            <button
              type="button"
              onClick={() => setMode("STACKED_6M")}
              aria-pressed={mode === "STACKED_6M"}
              className={`min-h-[32px] px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                mode === "STACKED_6M"
                  ? "bg-white dark:bg-slate-900 text-[#1E3A8A] dark:text-blue-300 shadow-2xs"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Cơ cấu 6 tháng
            </button>
          </div>
        </div>

        {/* Month Pair Pickers */}
        {mode === "COMPARE_2M" && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Chọn tháng chính để so sánh"
                value={monthA}
                onChange={(e) => setMonthA(e.target.value)}
                className="min-h-[36px] px-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 font-bold text-[#1E3A8A] dark:text-blue-300 tabular-nums cursor-pointer"
              >
                {comparison.availableMonths.map((m) => (
                  <option key={m} value={m}>
                    {getMonthDisplayLabel(m)}
                  </option>
                ))}
              </select>
              <span className="text-slate-400 font-semibold">so với</span>
              <select
                aria-label="Chọn tháng đối chiếu"
                value={monthB}
                onChange={(e) => setMonthB(e.target.value)}
                className="min-h-[36px] px-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-200 tabular-nums cursor-pointer"
              >
                {comparison.availableMonths.map((m) => (
                  <option key={m} value={m}>
                    {getMonthDisplayLabel(m)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setMonthB(shiftMonthKey(monthA, -1))}
                className="min-h-[32px] px-2 py-1 rounded-md text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap cursor-pointer"
              >
                Tháng trước
              </button>
              <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                ·
              </span>
              <button
                type="button"
                onClick={() => setMonthB(shiftMonthKey(monthA, -12))}
                className="min-h-[32px] px-2 py-1 rounded-md text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap cursor-pointer"
              >
                Cùng kỳ năm trước
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Headline Delta Strip */}
      <div className="flex flex-wrap items-baseline justify-between gap-3 text-xs tabular-nums">
        <div className="flex flex-wrap items-baseline gap-4">
          <div>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
              {comparison.monthALabel}
            </span>
            <span className="text-sm sm:text-base font-black text-[#1E3A8A] dark:text-blue-300">
              {formatVNDMasked(comparison.totalA, isPrivacyMode)}
            </span>
          </div>
          <div>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
              {comparison.monthBLabel}
            </span>
            <span className="text-sm sm:text-base font-bold text-slate-600 dark:text-slate-300">
              {formatVNDMasked(comparison.totalB, isPrivacyMode)}
            </span>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
            Biến động chi tiêu
          </span>
          <span
            className={`text-sm font-black inline-flex items-center gap-0.5 ${
              comparison.deltaAmount > 0
                ? "text-rose-600 dark:text-rose-400"
                : comparison.deltaAmount < 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-slate-500"
            }`}
          >
            {comparison.deltaAmount > 0 ? (
              <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
            ) : comparison.deltaAmount < 0 ? (
              <ArrowDownRight className="w-3.5 h-3.5 shrink-0" />
            ) : null}
            {comparison.deltaAmount > 0 ? "+" : comparison.deltaAmount < 0 ? "-" : ""}
            {formatShortVNDMasked(Math.abs(comparison.deltaAmount), isPrivacyMode)}
            {comparison.deltaPct !== null
              ? ` (${comparison.deltaPct > 0 ? "+" : ""}${comparison.deltaPct}%)`
              : ""}
          </span>
        </div>
      </div>

      {/* Responsive Bar Chart */}
      <div className={compact ? "h-[225px] w-full" : "h-[250px] w-full"}>
        {!isMounted ? (
          <div className="h-full flex items-center justify-center text-xs text-slate-400">
            Đang dựng biểu đồ so sánh tháng...
          </div>
        ) : mode === "COMPARE_2M" ? (
          topChartRows.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-slate-500 dark:text-slate-400">
              Chưa có dữ liệu chi tiêu trong 2 tháng đã chọn.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart
                data={topChartRows}
                margin={{ top: 8, right: 8, left: isMobile ? -12 : -4, bottom: 0 }}
                barGap={4}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke={isDark ? "#1E293B" : "#E2E8F0"}
                />
                <XAxis
                  dataKey="categoryName"
                  interval={0}
                  tick={{ fontSize: isMobile ? 10 : 11, fill: isDark ? "#94A3B8" : "#64748B" }}
                  axisLine={{ stroke: isDark ? "#334155" : "#CBD5E1" }}
                  tickLine={false}
                  tickFormatter={(name: string) =>
                    name.length > (isMobile ? 9 : 12)
                      ? `${name.slice(0, isMobile ? 8 : 11)}…`
                      : name
                  }
                />
                <YAxis
                  tickCount={isMobile ? 4 : 5}
                  width={isMobile ? 46 : 54}
                  tick={{ fontSize: isMobile ? 10 : 11, fill: isDark ? "#94A3B8" : "#64748B" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => formatShortVNDMasked(Number(v), isPrivacyMode)}
                />
                <Tooltip
                  content={
                    <GroupedComparisonTooltip
                      monthALabel={comparison.monthALabel}
                      monthBLabel={comparison.monthBLabel}
                      isPrivacyMode={isPrivacyMode}
                    />
                  }
                />
                <Bar
                  dataKey="amountA"
                  name={comparison.monthALabel}
                  fill={isDark ? "#3B82F6" : "#1E3A8A"}
                  radius={[5, 5, 0, 0]}
                  maxBarSize={isMobile ? 18 : 26}
                  className="cursor-pointer"
                  onClick={(entry) => {
                    const catId = (entry as unknown as { categoryId?: string })?.categoryId;
                    if (catId) handleOpenCategory(catId);
                  }}
                />
                <Bar
                  dataKey="amountB"
                  name={comparison.monthBLabel}
                  fill={isDark ? "#475569" : "#CBD5E1"}
                  radius={[5, 5, 0, 0]}
                  maxBarSize={isMobile ? 18 : 26}
                />
              </BarChart>
            </ResponsiveContainer>
          )
        ) : (
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <BarChart
              data={comparison.stackedMonths}
              margin={{ top: 8, right: 8, left: isMobile ? -12 : -4, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke={isDark ? "#1E293B" : "#E2E8F0"}
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: isMobile ? 10 : 11, fill: isDark ? "#94A3B8" : "#64748B" }}
                axisLine={{ stroke: isDark ? "#334155" : "#CBD5E1" }}
                tickLine={false}
              />
              <YAxis
                tickCount={isMobile ? 4 : 5}
                width={isMobile ? 46 : 54}
                tick={{ fontSize: isMobile ? 10 : 11, fill: isDark ? "#94A3B8" : "#64748B" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => formatShortVNDMasked(Number(v), isPrivacyMode)}
              />
              <Tooltip
                content={
                  <StackedExpenseTooltip
                    series={comparison.stackedSeries}
                    isPrivacyMode={isPrivacyMode}
                  />
                }
              />
              {comparison.stackedSeries.map((s, idx) => (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  name={s.name}
                  stackId="expenses"
                  fill={s.color}
                  maxBarSize={isMobile ? 28 : 38}
                  radius={
                    idx === comparison.stackedSeries.length - 1 ? [5, 5, 0, 0] : [0, 0, 0, 0]
                  }
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Interactive Top Movers Footer / Legend */}
      {mode === "COMPARE_2M" && topChartRows.length > 0 ? (
        <div className="pt-3 border-t border-[#E9EEF5] dark:border-slate-800 space-y-1.5">
          <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            Nhấn hạng mục để xem giao dịch {comparison.monthALabel}:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs tabular-nums">
            {topChartRows.slice(0, 4).map((row) => (
              <button
                key={row.categoryId}
                type="button"
                onClick={() => handleOpenCategory(row.categoryId)}
                className="flex items-center justify-between gap-2 py-1 px-1.5 -mx-1.5 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors text-left cursor-pointer"
              >
                <span className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="w-2 h-2 rounded-xs shrink-0"
                    style={{ backgroundColor: row.color }}
                  />
                  <span className="font-semibold text-slate-700 dark:text-slate-200 truncate">
                    {row.categoryName}
                  </span>
                </span>
                <span
                  className={`font-bold whitespace-nowrap shrink-0 ${
                    row.delta > 0
                      ? "text-rose-600 dark:text-rose-400"
                      : row.delta < 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-slate-500"
                  }`}
                >
                  {formatShortVNDMasked(row.amountA, isPrivacyMode)}
                  {row.deltaPct !== null
                    ? ` (${row.deltaPct > 0 ? "+" : ""}${row.deltaPct}%)`
                    : ""}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        comparison.stackedSeries.length > 0 && (
          <div className="pt-3 border-t border-[#E9EEF5] dark:border-slate-800 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-slate-600 dark:text-slate-300">
            {comparison.stackedSeries.map((s) => (
              <span key={s.key} className="inline-flex items-center gap-1.5 whitespace-nowrap">
                <span
                  className="w-2.5 h-2.5 rounded-xs shrink-0"
                  style={{ backgroundColor: s.color }}
                />
                <span className="font-semibold">{s.name}</span>
              </span>
            ))}
          </div>
        )
      )}
    </section>
  );
}
