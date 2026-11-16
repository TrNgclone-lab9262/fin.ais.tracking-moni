"use client";

import React, { useMemo, useState } from "react";
import {
  Area,
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
import { ArrowDownRight, CheckCircle2, SlidersHorizontal, TrendingDown } from "lucide-react";
import {
  MAX_MORTGAGE_TERM_YEARS,
  simulateTermReductionStrategy,
  TermReductionTransitionPoint,
} from "@/lib/mortgageEngine";
import { formatDateVN, formatShortVNDMasked, formatVNDMasked } from "@/lib/formatters";
import { MortgageContract } from "@/types/finance";

export interface SkyOneTermReductionPanelProps {
  contract: MortgageContract;
  isPrivacyMode: boolean;
  isDark: boolean;
  projectedFloatingRate?: number;
  extraDisbursementAmount?: number;
  extraDisbursementAfterPeriod?: number;
  onApplyTermPlan?: (params: { years: number; months: number; monthlyPrincipal: number }) => void;
}

type TransitionChartMode = "VND" | "PERCENT";

function TransitionTooltip({
  active,
  payload,
  isPrivacyMode,
}: {
  active?: boolean;
  payload?: Array<{ payload?: TermReductionTransitionPoint }>;
  isPrivacyMode: boolean;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const pt = payload[0]?.payload;
  if (!pt) return null;

  const stageText =
    pt.stage === "PAID_OFF"
      ? "Đã tất toán xong"
      : pt.stage === "FIXED"
      ? "Ưu đãi cố định"
      : pt.stage === "TRANSITION"
      ? "Dải chuyển Cố định → Thả nổi"
      : "Giai đoạn thả nổi";

  return (
    <div className="bg-slate-900/95 backdrop-blur-md text-white text-xs p-3.5 rounded-xl shadow-xl border border-slate-700/80 min-w-[240px] space-y-2">
      <div className="flex items-center justify-between gap-3 border-b border-slate-700 pb-1.5">
        <span className="font-bold text-slate-100">{pt.name}</span>
        <span className="text-[11px] font-semibold text-indigo-300">{stageText}</span>
      </div>

      <div className="space-y-1 tabular-nums">
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-300">Gốc trả (Mục tiêu):</span>
          <span className="font-bold text-blue-300">
            {formatVNDMasked(pt.targetPrincipal, isPrivacyMode)} ({pt.targetPrincipalSharePct}%)
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-300">Lãi trả (Mục tiêu):</span>
          <span className="font-bold text-amber-300">
            {formatVNDMasked(pt.targetInterest, isPrivacyMode)} ({pt.targetInterestSharePct}%)
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 pt-1 border-t border-slate-800">
          <span className="text-slate-400">Lãi trả nếu vay 30 năm:</span>
          <span className="font-semibold text-rose-300">
            {formatVNDMasked(pt.baselineInterest, isPrivacyMode)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-400">Lãi tiết kiệm lũy kế:</span>
          <span className="font-bold text-emerald-300">
            +{formatShortVNDMasked(pt.cumulativeInterestSaved, isPrivacyMode)}
          </span>
        </div>
      </div>
    </div>
  );
}

export function SkyOneTermReductionPanel({
  contract,
  isPrivacyMode,
  isDark,
  projectedFloatingRate,
  extraDisbursementAmount = 0,
  extraDisbursementAfterPeriod,
  onApplyTermPlan,
}: SkyOneTermReductionPanelProps) {
  const initialYears = Math.min(
    MAX_MORTGAGE_TERM_YEARS,
    Math.max(5, Math.round((contract.termMonths || 360) / 12))
  );
  const [targetYears, setTargetYears] = useState<number>(() =>
    initialYears >= 25 ? 20 : initialYears
  );
  const [chartMode, setChartMode] = useState<TransitionChartMode>("VND");
  const [appliedBanner, setAppliedBanner] = useState<string | null>(null);

  const sim = useMemo(
    () =>
      simulateTermReductionStrategy(contract, {
        targetYears,
        projectedFloatingRate,
        extraDisbursementAmount,
        extraDisbursementAfterPeriod,
      }),
    [
      contract,
      targetYears,
      projectedFloatingRate,
      extraDisbursementAmount,
      extraDisbursementAfterPeriod,
    ]
  );

  const presetYears = useMemo(() => {
    const raw = [30, 25, 20, 15, 10, 5].filter(
      (y) => y >= sim.minSelectableYears && y <= MAX_MORTGAGE_TERM_YEARS
    );
    if (!raw.includes(sim.minSelectableYears)) {
      raw.push(sim.minSelectableYears);
    }
    return raw.sort((a, b) => b - a);
  }, [sim.minSelectableYears]);

  const fixedEndYearLabel =
    contract.fixedRateMonths > 0
      ? `Năm ${Math.max(1, Math.ceil(contract.fixedRateMonths / 12))}`
      : null;
  const targetPayoffYearLabel = `Năm ${Math.max(1, Math.ceil(sim.targetMonths / 12))}`;

  const handleApplyTerm = () => {
    if (!onApplyTermPlan) return;
    onApplyTermPlan({
      years: sim.targetYears,
      months: sim.targetYears * 12,
      monthlyPrincipal: sim.requiredMonthlyPrincipal,
    });
    setAppliedBanner(
      `Đã áp dụng mục tiêu ${sim.targetYears} năm (${sim.targetYears * 12} tháng) vào hợp đồng SKYONE.`
    );
    setTimeout(() => setAppliedBanner(null), 4000);
  };

  return (
    <section
      data-testid="skyone-term-reduction-panel"
      aria-label="Chiến lược giảm số năm vay tối đa 30 năm và chuyển động Lãi/Gốc"
      className="bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 shadow-xs p-5 space-y-5"
    >
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-[#E9EEF5] dark:border-slate-800">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 text-xs font-bold text-indigo-700 dark:text-indigo-300">
            <TrendingDown className="w-4 h-4 shrink-0" />
            <span>Chiến lược Giảm số năm vay · Trần tối đa {MAX_MORTGAGE_TERM_YEARS} năm (360 tháng)</span>
          </div>
          <h3 className="text-base sm:text-lg font-extrabold text-[#0F172A] dark:text-slate-100">
            Chuyển động Dòng Lãi / Gốc khi rút ngắn kỳ hạn trong Dải chuyển
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            Kéo thanh trượt từ trần {MAX_MORTGAGE_TERM_YEARS} năm xuống để quan sát tốc độ giảm tiền Lãi và dịch chuyển điểm đảo chiều Gốc vượt Lãi.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div
            role="group"
            aria-label="Chế độ hiển thị biểu đồ dải chuyển"
            className="inline-flex items-center rounded-lg bg-slate-100 dark:bg-slate-800 p-1 border border-[#DCE4EE] dark:border-slate-700"
          >
            <button
              type="button"
              onClick={() => setChartMode("VND")}
              aria-pressed={chartMode === "VND"}
              className={`min-h-[34px] px-3 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                chartMode === "VND"
                  ? "bg-white dark:bg-slate-900 text-[#1D4ED8] dark:text-blue-300 shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Dòng tiền (VNĐ)
            </button>
            <button
              type="button"
              onClick={() => setChartMode("PERCENT")}
              aria-pressed={chartMode === "PERCENT"}
              className={`min-h-[34px] px-3 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                chartMode === "PERCENT"
                  ? "bg-white dark:bg-slate-900 text-[#1D4ED8] dark:text-blue-300 shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Tỷ trọng Lãi / Gốc (%)
            </button>
          </div>

          {onApplyTermPlan && (
            <button
              type="button"
              onClick={handleApplyTerm}
              className="min-h-[40px] px-3.5 py-2 rounded-lg bg-[#1E3A8A] hover:bg-blue-900 dark:bg-blue-600 dark:hover:bg-blue-700 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Áp dụng mốc {sim.targetYears} năm</span>
            </button>
          )}
        </div>
      </div>

      {appliedBanner && (
        <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{appliedBanner}</span>
        </div>
      )}

      {/* Interactive Year Slider + Quick Milestones */}
      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <label
            htmlFor="skyone-target-years-slider"
            className="font-bold text-slate-700 dark:text-slate-200"
          >
            Số năm vay mục tiêu (Dải {sim.minSelectableYears} – {MAX_MORTGAGE_TERM_YEARS} năm tối đa)
          </label>
          <div className="flex items-center gap-2 tabular-nums">
            <span className="text-slate-500 dark:text-slate-400">Đang chọn:</span>
            <span className="text-base font-black text-indigo-700 dark:text-indigo-300">
              {sim.targetYears} năm ({sim.targetMonths} kỳ)
            </span>
            {sim.yearsSavedVs30Y > 0 && (
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-0.5">
                <ArrowDownRight className="w-3.5 h-3.5" />
                Giảm {sim.yearsSavedVs30Y} năm
              </span>
            )}
          </div>
        </div>

        <input
          id="skyone-target-years-slider"
          data-testid="skyone-target-years-slider"
          type="range"
          min={sim.minSelectableYears}
          max={MAX_MORTGAGE_TERM_YEARS}
          step={1}
          value={sim.targetYears}
          onChange={(e) => setTargetYears(Number(e.target.value))}
          className="w-full accent-indigo-600 cursor-pointer"
        />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {presetYears.map((yrs) => (
              <button
                key={yrs}
                type="button"
                onClick={() => setTargetYears(yrs)}
                className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-bold tabular-nums transition-colors whitespace-nowrap cursor-pointer ${
                  sim.targetYears === yrs
                    ? "bg-indigo-600 text-white"
                    : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                {yrs === MAX_MORTGAGE_TERM_YEARS ? `${yrs} năm (Tối đa)` : `${yrs} năm`}
              </button>
            ))}
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
            Tất toán: <strong className="text-slate-800 dark:text-slate-100">{formatDateVN(sim.targetPayoffDate)}</strong>{" "}
            <span aria-hidden="true">·</span>{" "}
            Trần 30 năm: {formatDateVN(sim.baseline30PayoffDate)}
          </span>
        </div>
      </div>

      {/* 4 Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5 text-xs tabular-nums">
        <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 space-y-1">
          <span className="text-slate-500 dark:text-slate-400 font-semibold block">
            Gốc trả đều / tháng mới
          </span>
          <p className="text-lg font-black text-[#1E3A8A] dark:text-blue-300">
            {formatVNDMasked(sim.requiredMonthlyPrincipal, isPrivacyMode)}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            +{formatShortVNDMasked(sim.monthlyPrincipalDelta, isPrivacyMode)}/th so với vay 30 năm
          </p>
        </div>

        <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 space-y-1">
          <span className="text-slate-500 dark:text-slate-400 font-semibold block">
            Tổng lãi tiết kiệm vs 30 năm
          </span>
          <p className="text-lg font-black text-emerald-700 dark:text-emerald-400">
            {formatVNDMasked(sim.interestSavedVs30Y, isPrivacyMode)}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Tổng lãi mới: {formatShortVNDMasked(sim.targetTotalInterest, isPrivacyMode)}
          </p>
        </div>

        <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 space-y-1">
          <span className="text-slate-500 dark:text-slate-400 font-semibold block">
            Nghĩa vụ tháng đầu / Đỉnh thả nổi
          </span>
          <p className="text-lg font-black text-[#0F172A] dark:text-slate-100">
            {formatShortVNDMasked(sim.firstTargetMonthlyPayment, isPrivacyMode)} /{" "}
            <span className="text-amber-700 dark:text-amber-300">
              {formatShortVNDMasked(sim.peakTargetMonthlyPayment, isPrivacyMode)}
            </span>
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Mốc 30 năm kỳ tới: {formatShortVNDMasked(sim.firstBaselineMonthlyPayment, isPrivacyMode)}/th
          </p>
        </div>

        <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 space-y-1">
          <span className="text-slate-500 dark:text-slate-400 font-semibold block">
            Điểm đảo chiều Gốc &gt; Lãi
          </span>
          <p className="text-lg font-black text-indigo-700 dark:text-indigo-300">
            {sim.crossoverYearTarget ? `Năm ${sim.crossoverYearTarget}` : "Chưa đảo chiều"}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Nếu vay 30 năm:{" "}
            {sim.crossoverYearBaseline ? `Năm ${sim.crossoverYearBaseline}` : "Cuối kỳ hạn"}
          </p>
        </div>
      </div>

      {/* Transition P/I Movement Chart */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
          <div className="flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#1D4ED8] inline-block" />
              {chartMode === "VND" ? "Gốc trả mục tiêu" : "Tỷ trọng Gốc (%)"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#D97706] inline-block" />
              {chartMode === "VND" ? "Lãi trả mục tiêu" : "Tỷ trọng Lãi (%)"}
            </span>
            {chartMode === "VND" && (
              <span className="inline-flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                <span className="w-3.5 border-t-2 border-dashed border-rose-500 inline-block" />
                Lãi trả nếu giữ trần 30 năm
              </span>
            )}
          </div>
          <span className="text-slate-500 dark:text-slate-400 tabular-nums">
            Dải chuyển ưu đãi → thả nổi: Năm {sim.transitionStartYear} – Năm {sim.transitionEndYear}
          </span>
        </div>

        <div className="h-[280px] sm:h-[310px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={sim.transitionPoints}
              margin={{ top: 20, right: 12, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="skyoneTargetInterestFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#D97706" stopOpacity={0.28} />
                  <stop offset="95%" stopColor="#D97706" stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke={isDark ? "#1E293B" : "#E2E8F0"}
              />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: isDark ? "#94A3B8" : "#64748B" }}
                tickLine={false}
                axisLine={{ stroke: isDark ? "#334155" : "#CBD5E1" }}
                minTickGap={16}
              />
              <YAxis
                domain={chartMode === "PERCENT" ? [0, 100] : [0, "auto"]}
                tick={{ fontSize: 11, fill: isDark ? "#94A3B8" : "#64748B" }}
                tickLine={false}
                axisLine={false}
                width={chartMode === "VND" ? 56 : 40}
                tickFormatter={(v) =>
                  chartMode === "VND"
                    ? formatShortVNDMasked(Number(v), isPrivacyMode)
                    : `${Math.round(Number(v))}%`
                }
              />
              <Tooltip content={<TransitionTooltip isPrivacyMode={isPrivacyMode} />} />

              {fixedEndYearLabel && (
                <ReferenceLine
                  x={fixedEndYearLabel}
                  stroke={isDark ? "#FBBF24" : "#D97706"}
                  strokeDasharray="4 4"
                  label={{
                    value: "Hết 5,5%",
                    position: "top",
                    fill: isDark ? "#FBBF24" : "#B45309",
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                />
              )}
              <ReferenceLine
                x={targetPayoffYearLabel}
                stroke={isDark ? "#34D399" : "#059669"}
                strokeWidth={2}
                label={{
                  value: `Xong (${sim.targetYears}N)`,
                  position: "insideTopRight",
                  fill: isDark ? "#34D399" : "#047857",
                  fontSize: 10,
                  fontWeight: 700,
                }}
              />

              <Bar
                dataKey={chartMode === "VND" ? "targetPrincipal" : "targetPrincipalSharePct"}
                name="Gốc trả mục tiêu"
                stackId="targetFlow"
                fill="#1D4ED8"
                maxBarSize={24}
                radius={chartMode === "PERCENT" ? [0, 0, 0, 0] : [0, 0, 0, 0]}
              />
              {chartMode === "PERCENT" ? (
                <Bar
                  dataKey="targetInterestSharePct"
                  name="Lãi trả mục tiêu"
                  stackId="targetFlow"
                  fill="#D97706"
                  maxBarSize={24}
                  radius={[4, 4, 0, 0]}
                />
              ) : (
                <>
                  <Area
                    type="monotone"
                    dataKey="targetInterest"
                    name="Lãi trả mục tiêu"
                    stroke="#D97706"
                    strokeWidth={2}
                    fill="url(#skyoneTargetInterestFill)"
                  />
                  <Line
                    type="monotone"
                    dataKey="baselineInterest"
                    name="Lãi vay 30 năm"
                    stroke="#E11D48"
                    strokeWidth={2}
                    strokeDasharray="5 4"
                    dot={false}
                  />
                </>
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Quick Comparison Matrix across 30Y -> 5Y */}
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="w-full min-w-[640px] text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold">
              <th className="py-2.5 px-3">Kịch bản kỳ hạn</th>
              <th className="py-2.5 px-3 text-right">Gốc đều / tháng</th>
              <th className="py-2.5 px-3 text-right">Kỳ tiếp theo</th>
              <th className="py-2.5 px-3 text-right">Tổng lãi toàn kỳ</th>
              <th className="py-2.5 px-3 text-right">Tiết kiệm vs 30 năm</th>
              <th className="py-2.5 px-3 text-right">Năm Gốc &gt; Lãi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 tabular-nums">
            {sim.sweepByYears.map((row) => {
              const isSelected = row.years === sim.targetYears;
              return (
                <tr
                  key={row.years}
                  onClick={() => setTargetYears(row.years)}
                  className={`transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-indigo-50/80 dark:bg-indigo-950/40 font-bold"
                      : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  }`}
                >
                  <td className="py-2 px-3 text-[#0F172A] dark:text-slate-100 whitespace-nowrap">
                    {row.years} năm ({row.months} kỳ)
                    {row.years === MAX_MORTGAGE_TERM_YEARS && (
                      <span className="ml-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        · Trần tối đa
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-right text-blue-700 dark:text-blue-300">
                    {formatVNDMasked(row.requiredMonthlyPrincipal, isPrivacyMode)}
                  </td>
                  <td className="py-2 px-3 text-right text-slate-700 dark:text-slate-200">
                    {formatVNDMasked(row.firstTargetMonthlyPayment, isPrivacyMode)}
                  </td>
                  <td className="py-2 px-3 text-right text-amber-700 dark:text-amber-300">
                    {formatShortVNDMasked(row.totalProjectedInterest, isPrivacyMode)}
                  </td>
                  <td className="py-2 px-3 text-right text-emerald-700 dark:text-emerald-400">
                    {row.interestSavedVs30Y > 0
                      ? `+${formatShortVNDMasked(row.interestSavedVs30Y, isPrivacyMode)}`
                      : "Mốc chuẩn"}
                  </td>
                  <td className="py-2 px-3 text-right text-indigo-700 dark:text-indigo-300">
                    {row.crossoverYear ? `Năm ${row.crossoverYear}` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
