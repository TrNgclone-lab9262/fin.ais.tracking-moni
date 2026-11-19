"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDownRight, ArrowUpRight, ExternalLink, TrendingUp } from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import {
  buildSpendingTrendSeries,
  SpendingTrendPoint,
  SpendingTrendRange,
} from "@/lib/dashboardAnalytics";
import { formatShortVNDMasked, formatVNDMasked } from "@/lib/formatters";
import { useResponsive } from "@/src/hooks/useResponsive";
import { computeResponsiveXAxisInterval } from "@/lib/viewport";

interface TooltipEntry {
  payload?: SpendingTrendPoint;
}

function SpendingTrendTooltip({
  active,
  payload,
  isPrivacyMode,
  showMovingAvg,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  isPrivacyMode: boolean;
  showMovingAvg: boolean;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const pt = payload[0]?.payload;
  if (!pt) return null;

  return (
    <div className="bg-slate-900/95 backdrop-blur-md text-white text-xs p-3 rounded-xl shadow-xl border border-slate-800 space-y-1.5 min-w-[205px] tabular-nums">
      <div className="font-bold text-slate-100 border-b border-slate-700/80 pb-1 flex items-center justify-between gap-3">
        <span>{pt.fullLabel}</span>
        <span className="text-[11px] font-medium text-slate-400">{pt.txCount} GD</span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-slate-300">Chi tiêu thực tế</span>
        <span className="font-extrabold text-rose-400">
          {formatVNDMasked(pt.amount, isPrivacyMode)}
        </span>
      </div>
      {showMovingAvg && (
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-300">Trung bình trượt</span>
          <span className="font-bold text-indigo-300">
            {formatVNDMasked(pt.movingAvg, isPrivacyMode)}
          </span>
        </div>
      )}
      {pt.budgetLimit !== null && pt.budgetLimit > 0 && (
        <div className="pt-1 border-t border-slate-700/80 flex items-center justify-between gap-4">
          <span className="text-slate-400">Ngân sách chuẩn</span>
          <span
            className={`font-bold ${
              pt.amount > pt.budgetLimit ? "text-amber-300" : "text-emerald-300"
            }`}
          >
            {formatVNDMasked(pt.budgetLimit, isPrivacyMode)}
          </span>
        </div>
      )}
    </div>
  );
}

const RANGE_OPTIONS: { id: SpendingTrendRange; label: string }[] = [
  { id: "30D", label: "30 ngày" },
  { id: "3M", label: "3 tháng" },
  { id: "6M", label: "6 tháng" },
  { id: "12M", label: "12 tháng" },
];

export function SpendingTrendsOverTimeWidget({ compact = false }: { compact?: boolean }) {
  const {
    transactions,
    categories,
    budgets,
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
  const [range, setRange] = useState<SpendingTrendRange>("6M");
  const [categoryId, setCategoryId] = useState<string>("ALL");
  const [showMovingAvg, setShowMovingAvg] = useState<boolean>(true);
  const [showReferenceLine, setShowReferenceLine] = useState<boolean>(true);
  const [selectedPointKey, setSelectedPointKey] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const expenseCategories = useMemo(
    () => categories.filter((c) => c.type === "EXPENSE" && !c.isHidden),
    [categories]
  );

  const trend = useMemo(
    () =>
      buildSpendingTrendSeries({
        transactions,
        categories,
        budgets,
        perspective: activePerspective,
        range,
        categoryId,
        selectedMonth,
      }),
    [transactions, categories, budgets, activePerspective, range, categoryId, selectedMonth]
  );

  const activePoint = useMemo(() => {
    if (selectedPointKey) {
      const found = trend.points.find((p) => p.key === selectedPointKey);
      if (found) return found;
    }
    return trend.points[trend.points.length - 1] || null;
  }, [trend.points, selectedPointKey]);

  const referenceValue = trend.budgetCeiling ?? (trend.averagePerBucket > 0 ? trend.averagePerBucket : null);
  const referenceLabel = trend.budgetCeiling ? "Ngân sách" : "TB kỳ";

  const handleDrillDown = (point: SpendingTrendPoint | null) => {
    if (!point) return;
    const monthKey = point.isMonthKey ? point.key : point.key.slice(0, 7);
    setSelectedMonth(monthKey);
    setSelectedType("EXPENSE");
    setSelectedCategory(categoryId === "ALL" ? "ALL" : categoryId);
    setActiveTab("transactions");
  };

  return (
    <section
      data-testid="spending-trends-widget"
      aria-label="Xu hướng chi tiêu theo thời gian"
      className="bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 p-4 sm:p-5 flex flex-col justify-between gap-4 h-full"
    >
      {/* Header & Controls */}
      <div className="space-y-3 pb-3 border-b border-[#E9EEF5] dark:border-slate-800">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 mt-0.5">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-[#172B4D] dark:text-slate-100 leading-snug">
                Xu hướng Chi tiêu theo Thời gian
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate tabular-nums">
                {trend.categoryName} · {trend.totalTxCount} giao dịch chi
              </p>
            </div>
          </div>

          {/* Timeframe Segmented Control */}
          <div
            role="group"
            aria-label="Chọn khung thời gian xu hướng chi tiêu"
            className="inline-flex items-center rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 border border-[#DCE4EE] dark:border-slate-700 shrink-0"
          >
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setRange(opt.id);
                  setSelectedPointKey(null);
                }}
                aria-pressed={range === opt.id}
                className={`min-h-[32px] px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  range === opt.id
                    ? "bg-white dark:bg-slate-900 text-[#1E3A8A] dark:text-blue-300 shadow-2xs"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Category Filter + Overlay Toggles */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <select
            aria-label="Lọc theo hạng mục chi tiêu"
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              setSelectedPointKey(null);
            }}
            className="min-h-[38px] max-w-full sm:max-w-[230px] px-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-blue-600 cursor-pointer"
          >
            <option value="ALL">Tất cả hạng mục chi</option>
            {expenseCategories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowMovingAvg((v) => !v)}
              aria-pressed={showMovingAvg}
              className={`min-h-[34px] px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                showMovingAvg
                  ? "bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300"
                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400"
              }`}
            >
              TB trượt ({range === "30D" ? "7 ngày" : "3 tháng"})
            </button>
            {referenceValue !== null && (
              <button
                type="button"
                onClick={() => setShowReferenceLine((v) => !v)}
                aria-pressed={showReferenceLine}
                className={`min-h-[34px] px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  showReferenceLine
                    ? "bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300"
                    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400"
                }`}
              >
                Mốc {referenceLabel}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Inline KPI Strip (Flat, No Nested Card Borders) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs tabular-nums">
        <div>
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
            Tổng chi giai đoạn
          </span>
          <span className="text-sm sm:text-base font-black text-[#0F172A] dark:text-slate-100">
            {formatShortVNDMasked(trend.totalSpent, isPrivacyMode)}
          </span>
        </div>
        <div>
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
            Trung bình / {range === "30D" ? "ngày" : "tháng"}
          </span>
          <span className="text-sm sm:text-base font-black text-indigo-700 dark:text-indigo-300">
            {formatShortVNDMasked(trend.averagePerBucket, isPrivacyMode)}
          </span>
        </div>
        <div>
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
            Đỉnh chi tiêu
          </span>
          <span className="text-sm sm:text-base font-black text-rose-600 dark:text-rose-400">
            {trend.peakPoint ? formatShortVNDMasked(trend.peakPoint.amount, isPrivacyMode) : "0 ₫"}
          </span>
          {trend.peakPoint && (
            <span className="block text-[10px] text-slate-500 dark:text-slate-400 truncate">
              {trend.peakPoint.label}
            </span>
          )}
        </div>
        <div>
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
            Nhịp tăng / giảm
          </span>
          {trend.trendDeltaPct !== null ? (
            <span
              className={`text-sm sm:text-base font-black inline-flex items-center gap-0.5 ${
                trend.trendDeltaPct > 0
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-emerald-600 dark:text-emerald-400"
              }`}
            >
              {trend.trendDeltaPct > 0 ? (
                <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <ArrowDownRight className="w-3.5 h-3.5 shrink-0" />
              )}
              {trend.trendDeltaPct > 0 ? "+" : ""}
              {trend.trendDeltaPct}%
            </span>
          ) : (
            <span className="text-sm sm:text-base font-bold text-slate-400">—</span>
          )}
        </div>
      </div>

      {/* Main Responsive Recharts ComposedChart */}
      <div className={compact ? "h-[225px] w-full" : "h-[260px] w-full"}>
        {!isMounted ? (
          <div className="h-full flex items-center justify-center text-xs text-slate-400">
            Đang dựng biểu đồ xu hướng chi tiêu...
          </div>
        ) : trend.totalSpent === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4 text-xs text-slate-500 dark:text-slate-400">
            <p className="font-semibold text-slate-700 dark:text-slate-200">
              Chưa có giao dịch chi cho bộ lọc này
            </p>
            <p className="mt-1">
              Chọn hạng mục khác hoặc mở rộng khung thời gian để xem đường xu hướng.
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <ComposedChart
              data={trend.points}
              margin={{ top: 10, right: isMobile ? 6 : 12, left: isMobile ? -12 : -4, bottom: 0 }}
              onClick={(state) => {
                const label = state?.activeLabel;
                if (typeof label === "string") {
                  const found = trend.points.find((p) => p.label === label);
                  if (found) setSelectedPointKey(found.key);
                }
              }}
            >
              <defs>
                <linearGradient id="homeMoniSpendingGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F43F5E" stopOpacity={isDark ? 0.32 : 0.22} />
                  <stop offset="95%" stopColor="#F43F5E" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke={isDark ? "#1E293B" : "#E2E8F0"}
              />
              <XAxis
                dataKey="label"
                interval={computeResponsiveXAxisInterval(
                  trend.points.length,
                  isMobile,
                  range === "30D" ? 5 : 6
                )}
                minTickGap={isMobile ? 22 : 12}
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
                  <SpendingTrendTooltip
                    isPrivacyMode={isPrivacyMode}
                    showMovingAvg={showMovingAvg}
                  />
                }
              />
              {showReferenceLine && referenceValue !== null && (
                <ReferenceLine
                  y={referenceValue}
                  stroke={isDark ? "#F59E0B" : "#D97706"}
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                />
              )}
              <Area
                type="monotone"
                dataKey="amount"
                name="Chi tiêu"
                stroke="#F43F5E"
                strokeWidth={2.2}
                fill="url(#homeMoniSpendingGrad)"
                activeDot={{ r: 5, strokeWidth: 2, stroke: isDark ? "#0F172A" : "#FFFFFF" }}
              />
              {showMovingAvg && (
                <Line
                  type="monotone"
                  dataKey="movingAvg"
                  name="Trung bình trượt"
                  stroke={isDark ? "#818CF8" : "#4F46E5"}
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Interactive Drill-Down Footer */}
      {activePoint && (
        <div className="pt-3 border-t border-[#E9EEF5] dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs tabular-nums">
          <div className="min-w-0 text-slate-600 dark:text-slate-300">
            <span className="font-bold text-[#172B4D] dark:text-slate-100">
              {activePoint.fullLabel}
            </span>
            <span aria-hidden="true" className="mx-1.5 text-slate-400">
              ·
            </span>
            <span className="font-extrabold text-rose-600 dark:text-rose-400">
              {formatVNDMasked(activePoint.amount, isPrivacyMode)}
            </span>
            <span aria-hidden="true" className="mx-1.5 text-slate-400">
              ·
            </span>
            <span>{activePoint.txCount} giao dịch</span>
          </div>
          <button
            type="button"
            onClick={() => handleDrillDown(activePoint)}
            className="min-h-[34px] px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/60 text-[#1E3A8A] dark:text-blue-300 text-[11px] font-bold inline-flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
          >
            <span>Xem giao dịch</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      )}
    </section>
  );
}
