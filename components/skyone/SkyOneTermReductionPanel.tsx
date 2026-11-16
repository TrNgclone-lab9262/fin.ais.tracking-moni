"use client";

import React, { useMemo, useState } from "react";
import { ArrowDownRight, CheckCircle2, SlidersHorizontal, TrendingDown } from "lucide-react";
import { LoanChart, LoanChartMode } from "@/components/skyone/LoanChart";
import {
  MAX_MORTGAGE_TERM_YEARS,
  simulateTermReductionStrategy,
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
  const [chartMode, setChartMode] = useState<LoanChartMode>("VND");
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
              data-testid="skyone-term-chart-mode-vnd"
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
              data-testid="skyone-term-chart-mode-percent"
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

      {/* Transition P/I Movement Chart powered by LoanChart */}
      <LoanChart
        data={sim.transitionPoints}
        chartMode={chartMode}
        fixedEndYearLabel={fixedEndYearLabel}
        targetPayoffYearLabel={targetPayoffYearLabel}
        targetYears={sim.targetYears}
        transitionStartYear={sim.transitionStartYear}
        transitionEndYear={sim.transitionEndYear}
        isDark={isDark}
        isPrivacyMode={isPrivacyMode}
      />

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
