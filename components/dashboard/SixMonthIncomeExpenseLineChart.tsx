"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDownRight, ArrowUpRight, Minus, TrendingUp } from "lucide-react";
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
import { useResponsive } from "@/src/hooks/useResponsive";
import { computeResponsiveXAxisInterval } from "@/lib/viewport";

type ChartViewMode = "TREND_6M" | PeriodComparisonMode;

interface LineTooltipPayloadEntry {
  dataKey?: string;
  name?: string;
  value?: number | string;
  color?: string;
  payload?: {
    month: string;
    label: string;
    income: number;
    expense: number;
    net: number;
  };
}

interface CustomLineTooltipProps {
  active?: boolean;
  payload?: LineTooltipPayloadEntry[];
  label?: string;
  isPrivacyMode: boolean;
}

function CustomComparisonTooltip({
  active,
  payload,
  label,
  isPrivacyMode,
}: CustomLineTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  const isPositiveNet = row.net >= 0;

  return (
    <div className="bg-slate-900/95 backdrop-blur-md text-white text-xs p-3 rounded-xl shadow-xl border border-slate-800 space-y-1.5 min-w-[190px]">
      <div className="font-bold text-slate-200 border-b border-slate-700 pb-1 flex items-center justify-between gap-3">
        <span>{label}</span>
        <span className="text-[11px] font-medium text-slate-400 tabular-nums">{row.month}</span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="flex items-center gap-1.5 text-slate-300">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
          Thu nhập:
        </span>
        <span className="font-bold text-emerald-400 tabular-nums">
          {formatVNDMasked(row.income, isPrivacyMode)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="flex items-center gap-1.5 text-slate-300">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
          Chi tiêu:
        </span>
        <span className="font-bold text-rose-400 tabular-nums">
          {formatVNDMasked(row.expense, isPrivacyMode)}
        </span>
      </div>
      <div className="pt-1 border-t border-slate-700/80 flex items-center justify-between gap-4">
        <span className="text-slate-300 font-medium">Chênh lệch:</span>
        <span
          className={`font-extrabold tabular-nums ${
            isPositiveNet ? "text-blue-300" : "text-amber-300"
          }`}
        >
          {isPositiveNet ? "+" : "-"}
          {formatVNDMasked(Math.abs(row.net), isPrivacyMode)}
        </span>
      </div>
    </div>
  );
}

interface BarTooltipPayloadEntry {
  payload?: {
    metric: string;
    current: number;
    previous: number;
  };
}

function CustomPeriodBarTooltip({
  active,
  payload,
  currentLabel,
  previousLabel,
  isPrivacyMode,
}: {
  active?: boolean;
  payload?: BarTooltipPayloadEntry[];
  currentLabel: string;
  previousLabel: string;
  isPrivacyMode: boolean;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  const delta = row.current - row.previous;
  const isUp = delta > 0;

  return (
    <div className="bg-slate-900/95 backdrop-blur-md text-white text-xs p-3 rounded-xl shadow-xl border border-slate-800 space-y-1.5 min-w-[205px]">
      <div className="font-bold text-slate-100 border-b border-slate-700 pb-1">
        {row.metric}
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="flex items-center gap-1.5 text-slate-300">
          <span className="w-2.5 h-2.5 rounded-sm bg-blue-500 shrink-0" />
          {currentLabel}:
        </span>
        <span className="font-bold text-blue-300 tabular-nums">
          {formatVNDMasked(row.current, isPrivacyMode)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="flex items-center gap-1.5 text-slate-300">
          <span className="w-2.5 h-2.5 rounded-sm bg-slate-400 shrink-0" />
          {previousLabel}:
        </span>
        <span className="font-bold text-slate-300 tabular-nums">
          {formatVNDMasked(row.previous, isPrivacyMode)}
        </span>
      </div>
      <div className="pt-1 border-t border-slate-700/80 flex items-center justify-between gap-4">
        <span className="text-slate-400">Chênh lệch:</span>
        <span className="font-extrabold text-white tabular-nums">
          {delta === 0 ? "0 ₫" : `${isUp ? "+" : "-"}${formatVNDMasked(Math.abs(delta), isPrivacyMode)}`}
        </span>
      </div>
    </div>
  );
}

function formatDeltaPctLabel(metric: MetricComparison): string {
  if (metric.isNewBaseline) return "Mới phát sinh";
  if (metric.deltaPercent === null) return "—";
  if (metric.deltaPercent === 0) return "0%";
  const sign = metric.deltaPercent > 0 ? "+" : "";
  return `${sign}${metric.deltaPercent.toLocaleString("vi-VN")}%`;
}

function getDeltaToneClass(
  deltaAmount: number,
  invertGoodness: boolean
): string {
  if (deltaAmount === 0) {
    return "text-slate-500 dark:text-slate-400";
  }
  const isGood = invertGoodness ? deltaAmount < 0 : deltaAmount > 0;
  return isGood
    ? "text-emerald-700 dark:text-emerald-400"
    : "text-rose-600 dark:text-rose-400";
}

export function SixMonthIncomeExpenseLineChart() {
  const {
    monthlyTrendData,
    transactions,
    categories,
    selectedMonth,
    isPrivacyMode,
    activePerspective,
    settings,
  } = useFinance();
  const { isMobile } = useResponsive();
  const [isMounted, setIsMounted] = useState(false);
  const [viewMode, setViewMode] = useState<ChartViewMode>("TREND_6M");

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const activeMonthKey =
    selectedMonth === "ALL" ? getCurrentMonthKey() : selectedMonth;

  const chartData = useMemo(
    () =>
      monthlyTrendData.map((item) => ({
        ...item,
        net: item.income - item.expense,
      })),
    [monthlyTrendData]
  );

  const stats = useMemo(() => {
    const count = Math.max(1, chartData.length);
    const totalIncome = chartData.reduce((sum, item) => sum + item.income, 0);
    const totalExpense = chartData.reduce((sum, item) => sum + item.expense, 0);
    const avgIncome = Math.round(totalIncome / count);
    const avgExpense = Math.round(totalExpense / count);
    const avgNet = avgIncome - avgExpense;
    const hasAnyData = totalIncome > 0 || totalExpense > 0;
    return { avgIncome, avgExpense, avgNet, hasAnyData };
  }, [chartData]);

  const comparison = useMemo(() => {
    if (viewMode === "TREND_6M") return null;
    return calculatePeriodComparison({
      transactions,
      categories,
      currentMonthKey: activeMonthKey,
      mode: viewMode,
      perspective: activePerspective,
      topLimit: 6,
    });
  }, [viewMode, transactions, categories, activeMonthKey, activePerspective]);

  const comparisonBarData = useMemo(() => {
    if (!comparison) return [];
    return [
      {
        metric: "Thu nhập",
        current: comparison.income.current,
        previous: comparison.income.previous,
      },
      {
        metric: "Chi tiêu",
        current: comparison.expense.current,
        previous: comparison.expense.previous,
      },
      {
        metric: "Tiết kiệm",
        current: Math.max(0, comparison.savings.current),
        previous: Math.max(0, comparison.savings.previous),
      },
    ];
  }, [comparison]);

  const maxCategoryAmount = useMemo(() => {
    if (!comparison || comparison.topCategories.length === 0) return 1;
    return Math.max(
      1,
      ...comparison.topCategories.map((c) =>
        Math.max(c.currentAmount, c.previousAmount)
      )
    );
  }, [comparison]);

  const perspectiveLabel =
    activePerspective === "HUSBAND"
      ? settings.husbandName
      : activePerspective === "WIFE"
      ? settings.wifeName
      : "Cả nhà";

  const rangeStart = chartData[0]?.month || "";
  const rangeEnd = chartData[chartData.length - 1]?.month || "";

  const headerTitle =
    viewMode === "TREND_6M"
      ? "So Sánh Thu Nhập & Chi Tiêu 6 Tháng"
      : viewMode === "MOM"
      ? `So Sánh Cùng Kỳ · ${comparison?.currentLabel} vs Tháng Trước`
      : `So Sánh Cùng Kỳ · ${comparison?.currentLabel} vs Năm Ngoái`;

  const headerSubtitle =
    viewMode === "TREND_6M"
      ? `${rangeStart} – ${rangeEnd} · ${perspectiveLabel}`
      : `${comparison?.currentLabel} đối chiếu ${comparison?.previousLabel} · ${perspectiveLabel}${
          selectedMonth === "ALL" ? " (Tháng chuẩn hiện tại)" : ""
        }`;

  return (
    <div
      data-testid="six-month-income-expense-line-chart"
      className="bg-white dark:bg-slate-900 rounded-xl p-5 sm:p-6 border border-[#DCE4EE] dark:border-slate-800 shadow-xs space-y-4"
    >
      {/* Header + Segmented Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3.5 border-b border-[#E9EEF5] dark:border-slate-800">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-bold text-[#172B4D] dark:text-slate-100 truncate">
              {headerTitle}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5 tabular-nums truncate">
              {headerSubtitle}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between lg:justify-end gap-3">
          {viewMode === "TREND_6M" && (
            <div className="flex items-center gap-4 text-xs font-semibold whitespace-nowrap shrink-0">
              <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                <span className="w-3 h-0.5 bg-emerald-500 inline-block" />
                Thu nhập
              </span>
              <span className="inline-flex items-center gap-1.5 text-rose-700 dark:text-rose-400">
                <span className="w-3 h-0.5 bg-rose-500 inline-block" />
                Chi tiêu
              </span>
            </div>
          )}

          {/* Segmented Control */}
          <div
            role="tablist"
            aria-label="Chế độ xem biểu đồ thu chi"
            data-testid="period-comparison-switcher"
            className="inline-flex items-center p-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-[#E9EEF5] dark:border-slate-700 shrink-0"
          >
            {(
              [
                { id: "TREND_6M", label: "6 tháng", testId: "chart-mode-6m" },
                { id: "MOM", label: "Tháng trước", testId: "chart-mode-mom" },
                { id: "YOY", label: "Năm ngoái", testId: "chart-mode-yoy" },
              ] as const
            ).map((tab) => {
              const active = viewMode === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  data-testid={tab.testId}
                  onClick={() => setViewMode(tab.id)}
                  className={`min-h-[32px] px-3 py-1 rounded-md text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer transition-all ${
                    active
                      ? "bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-xs"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {viewMode === "TREND_6M" ? (
        <>
          {/* 6-month average comparative strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pb-3 border-b border-[#E9EEF5] dark:border-slate-800">
            <div className="flex items-baseline justify-between sm:block">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">
                Thu nhập TB / tháng
              </span>
              <span className="text-sm sm:text-base font-extrabold text-emerald-700 dark:text-emerald-400 tabular-nums">
                {formatVNDMasked(stats.avgIncome, isPrivacyMode)}
              </span>
            </div>
            <div className="flex items-baseline justify-between sm:block">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">
                Chi tiêu TB / tháng
              </span>
              <span className="text-sm sm:text-base font-extrabold text-rose-700 dark:text-rose-400 tabular-nums">
                {formatVNDMasked(stats.avgExpense, isPrivacyMode)}
              </span>
            </div>
            <div className="flex items-baseline justify-between sm:block">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">
                Chênh lệch TB / tháng
              </span>
              <span
                className={`text-sm sm:text-base font-extrabold tabular-nums ${
                  stats.avgNet >= 0
                    ? "text-blue-700 dark:text-blue-400"
                    : "text-amber-600 dark:text-amber-400"
                }`}
              >
                {stats.avgNet >= 0 ? "+" : "-"}
                {formatVNDMasked(Math.abs(stats.avgNet), isPrivacyMode)}
              </span>
            </div>
          </div>

          {/* Recharts LineChart */}
          <div className="h-[260px] sm:h-[290px] w-full">
            {!isMounted ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Đang tải biểu đồ so sánh 6 tháng...
              </div>
            ) : !stats.hasAnyData ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-500 dark:text-slate-400">
                Chưa có dữ liệu thu nhập hoặc chi tiêu trong 6 tháng gần nhất.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <LineChart
                  data={chartData}
                  margin={{ top: 10, right: isMobile ? 8 : 16, left: isMobile ? -12 : 0, bottom: 4 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#94A3B8"
                    strokeOpacity={0.2}
                  />
                  <XAxis
                    dataKey="label"
                    interval={computeResponsiveXAxisInterval(chartData.length, isMobile, 5)}
                    minTickGap={isMobile ? 20 : 12}
                    stroke="#94A3B8"
                    fontSize={isMobile ? 11 : 12}
                    tickLine={false}
                    axisLine={{ stroke: "#94A3B8", strokeOpacity: 0.3 }}
                  />
                  <YAxis
                    tickCount={isMobile ? 4 : 5}
                    width={isMobile ? 46 : 56}
                    stroke="#94A3B8"
                    fontSize={isMobile ? 10 : 11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => formatShortVNDMasked(Number(val), isPrivacyMode)}
                  />
                  <Tooltip content={<CustomComparisonTooltip isPrivacyMode={isPrivacyMode} />} />
                  <Line
                    type="monotone"
                    dataKey="income"
                    name="Thu nhập"
                    stroke="#10B981"
                    strokeWidth={2.5}
                    dot={{ r: 3.5, fill: "#10B981", strokeWidth: 0 }}
                    activeDot={{ r: 5.5, fill: "#10B981", stroke: "#FFFFFF", strokeWidth: 2 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="expense"
                    name="Chi tiêu"
                    stroke="#F43F5E"
                    strokeWidth={2.5}
                    dot={{ r: 3.5, fill: "#F43F5E", strokeWidth: 0 }}
                    activeDot={{ r: 5.5, fill: "#F43F5E", stroke: "#FFFFFF", strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </>
      ) : comparison ? (
        <div data-testid="period-comparison-panel" className="space-y-5">
          {/* 3 Highlighted KPI Delta Metrics: Tổng Thu, Tổng Chi, Tiết kiệm ròng */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pb-4 border-b border-[#E9EEF5] dark:border-slate-800">
            {(
              [
                {
                  key: "income",
                  label: "Tổng Thu nhập",
                  metric: comparison.income,
                  invertGoodness: false,
                  extraNote: null,
                },
                {
                  key: "expense",
                  label: "Tổng Chi tiêu",
                  metric: comparison.expense,
                  invertGoodness: true,
                  extraNote: null,
                },
                {
                  key: "savings",
                  label: "Tiết kiệm ròng",
                  metric: comparison.savings,
                  invertGoodness: false,
                  extraNote: `Tỷ lệ ${comparison.currentSavingsRate}% vs ${comparison.previousSavingsRate}%`,
                },
              ] as const
            ).map((item) => {
              const tone = getDeltaToneClass(
                item.metric.deltaAmount,
                item.invertGoodness
              );
              const pctText = formatDeltaPctLabel(item.metric);
              const deltaSign =
                item.metric.deltaAmount > 0
                  ? "+"
                  : item.metric.deltaAmount < 0
                  ? "-"
                  : "";

              return (
                <div
                  key={item.key}
                  data-testid={`comparison-kpi-${item.key}`}
                  className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/60 border border-[#E9EEF5] dark:border-slate-700/80 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {item.label}
                    </span>
                    <span
                      className={`inline-flex items-center gap-0.5 text-xs font-extrabold tabular-nums ${tone}`}
                    >
                      {item.metric.deltaAmount > 0 ? (
                        <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                      ) : item.metric.deltaAmount < 0 ? (
                        <ArrowDownRight className="w-3.5 h-3.5 shrink-0" />
                      ) : (
                        <Minus className="w-3 h-3 shrink-0" />
                      )}
                      <span>{pctText}</span>
                    </span>
                  </div>

                  <p className="text-base sm:text-lg font-black text-[#172B4D] dark:text-slate-100 tabular-nums">
                    {item.key === "savings" && item.metric.current < 0 ? "-" : ""}
                    {formatVNDMasked(Math.abs(item.metric.current), isPrivacyMode)}
                  </p>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                    {comparison.previousLabel}:{" "}
                    <strong className="text-slate-700 dark:text-slate-200">
                      {item.key === "savings" && item.metric.previous < 0 ? "-" : ""}
                      {formatVNDMasked(Math.abs(item.metric.previous), isPrivacyMode)}
                    </strong>
                    {" · "}
                    <span className={`font-bold ${tone}`}>
                      {item.metric.deltaAmount === 0
                        ? "Không đổi"
                        : `${deltaSign}${formatShortVNDMasked(
                            Math.abs(item.metric.deltaAmount),
                            isPrivacyMode
                          )}`}
                    </span>
                  </p>

                  {item.extraNote && (
                    <p className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 tabular-nums">
                      {item.extraNote}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {!comparison.hasPreviousData && (
            <div className="px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-dashed border-slate-300 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300">
              Chưa có giao dịch ghi nhận trong kỳ{" "}
              <strong>{comparison.previousLabel}</strong> — biểu đồ đang đối chiếu từ mốc 0 ₫.
            </div>
          )}

          {/* Side-by-Side Comparison BarChart + Top Expense Categories */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left: Grouped Bar Chart */}
            <div className="lg:col-span-5 space-y-2.5">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-bold text-[#172B4D] dark:text-slate-100">
                  Biểu đồ Thu · Chi · Tiết kiệm
                </span>
                <div className="flex items-center gap-3 text-[11px] font-semibold whitespace-nowrap">
                  <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400">
                    <span className="w-2.5 h-2.5 rounded-xs bg-blue-600 inline-block" />
                    {comparison.currentLabel}
                  </span>
                  <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
                    <span className="w-2.5 h-2.5 rounded-xs bg-slate-400 inline-block" />
                    {comparison.previousLabel}
                  </span>
                </div>
              </div>

              <div className="h-[245px] w-full">
                {!isMounted ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400">
                    Đang tải biểu đồ đối chiếu...
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <BarChart
                      data={comparisonBarData}
                      margin={{ top: 10, right: 8, left: isMobile ? -12 : 0, bottom: 4 }}
                      barGap={6}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#94A3B8"
                        strokeOpacity={0.2}
                      />
                      <XAxis
                        dataKey="metric"
                        stroke="#94A3B8"
                        fontSize={12}
                        tickLine={false}
                        axisLine={{ stroke: "#94A3B8", strokeOpacity: 0.3 }}
                      />
                      <YAxis
                        tickCount={5}
                        width={isMobile ? 46 : 56}
                        stroke="#94A3B8"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(val) =>
                          formatShortVNDMasked(Number(val), isPrivacyMode)
                        }
                      />
                      <Tooltip
                        cursor={{ fill: "rgba(148, 163, 184, 0.1)" }}
                        content={
                          <CustomPeriodBarTooltip
                            currentLabel={comparison.currentLabel}
                            previousLabel={comparison.previousLabel}
                            isPrivacyMode={isPrivacyMode}
                          />
                        }
                      />
                      <Bar
                        dataKey="previous"
                        name={comparison.previousLabel}
                        fill="#94A3B8"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={32}
                      />
                      <Bar
                        dataKey="current"
                        name={comparison.currentLabel}
                        fill="#2563EB"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={32}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Right: Top Expense Categories Comparison */}
            <div className="lg:col-span-7 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-xs sm:text-sm font-bold text-[#172B4D] dark:text-slate-100">
                  Các danh mục chi chính ({comparison.topCategories.length}
                  {comparison.totalExpenseCategoriesCount > comparison.topCategories.length
                    ? `/${comparison.totalExpenseCategoriesCount}`
                    : ""}
                  )
                </h4>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  Thanh trên: {comparison.currentLabel} · Thanh dưới: {comparison.previousLabel}
                </span>
              </div>

              {comparison.topCategories.length === 0 ? (
                <div className="p-6 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-dashed border-slate-200 dark:border-slate-700 text-center text-xs text-slate-500 dark:text-slate-400">
                  Chưa có khoản chi tiêu nào trong hai kỳ đối chiếu.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {comparison.topCategories.map((cat) => {
                    const currentWidthPct = Math.round(
                      (cat.currentAmount / maxCategoryAmount) * 100
                    );
                    const previousWidthPct = Math.round(
                      (cat.previousAmount / maxCategoryAmount) * 100
                    );
                    const catTone = getDeltaToneClass(cat.deltaAmount, true);
                    const pctLabel = cat.isNewBaseline
                      ? "Mới phát sinh"
                      : cat.deltaPercent === null
                      ? "—"
                      : cat.deltaPercent === 0
                      ? "0%"
                      : `${cat.deltaPercent > 0 ? "+" : ""}${cat.deltaPercent.toLocaleString("vi-VN")}%`;

                    return (
                      <div
                        key={cat.categoryId}
                        data-testid={`comparison-category-row-${cat.categoryId}`}
                        className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/50 border border-[#E9EEF5] dark:border-slate-700/80 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: cat.categoryColor }}
                            />
                            <span className="font-bold text-[#172B4D] dark:text-slate-100 truncate">
                              {cat.categoryName}
                            </span>
                            {cat.shareOfCurrentPct > 0 && (
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
                                ({cat.shareOfCurrentPct}%)
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0 tabular-nums">
                            <span className="font-extrabold text-[#172B4D] dark:text-slate-100">
                              {formatVNDMasked(cat.currentAmount, isPrivacyMode)}
                            </span>
                            <span className={`text-[11px] font-bold ${catTone}`}>
                              {pctLabel}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="w-full h-1.5 bg-slate-200/70 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-300"
                              style={{
                                width: `${currentWidthPct}%`,
                                backgroundColor: cat.categoryColor,
                              }}
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1 bg-slate-200/60 dark:bg-slate-700/70 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full bg-slate-400 dark:bg-slate-500 transition-all duration-300"
                                style={{ width: `${previousWidthPct}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
                              {comparison.previousLabel}:{" "}
                              {formatShortVNDMasked(cat.previousAmount, isPrivacyMode)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
