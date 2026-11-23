"use client";

import React, { useMemo } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Compass,
  Percent,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { SkyOneAmortizationChart } from "@/components/dashboard/SkyOneAmortizationChart";
import { SkyOneAiToolsPanel } from "@/components/skyone/SkyOneAiToolsPanel";
import { computeResponsiveXAxisInterval } from "@/lib/viewport";
import {
  formatDateVN,
  formatShortVNDMasked,
  formatVNDMasked,
} from "@/lib/formatters";
import {
  getPlannedDisbursementSummary,
  MortgageScheduleSummary,
  RateStressScenario,
  RealEstateMetrics,
} from "@/lib/mortgageEngine";
import { MortgageContract } from "@/types/finance";
import { SKYONE_A12A07_VERIFIED_FACTS } from "@/system_context";

interface SkyOneOverviewTabProps {
  contract: MortgageContract;
  schedule: MortgageScheduleSummary;
  realEstateMetrics: RealEstateMetrics;
  stressScenarios: RateStressScenario[];
  isPrivacyMode: boolean;
  isDark: boolean;
  isMobile: boolean;
  onConfirmNextPeriod: (period: number) => void;
  onOpenAdvisor: () => void;
  onOpenContract: () => void;
}

export function SkyOneOverviewTab({
  contract,
  schedule,
  realEstateMetrics,
  stressScenarios,
  isPrivacyMode,
  isDark,
  isMobile,
  onConfirmNextPeriod,
  onOpenAdvisor,
  onOpenContract,
}: SkyOneOverviewTabProps) {
  const chartYearlyData = useMemo(
    () =>
      schedule.yearlySummary.map((y) => ({
        name: y.label,
        principal: y.principalPaid,
        interest: y.interestPaid,
        remainingBalance: y.endingBalance,
        equity: y.cumulativeEquity,
      })),
    [schedule.yearlySummary]
  );

  const principalProgressPct = useMemo(() => {
    if (contract.loanAmount <= 0) return 0;
    const paidLoanPrincipal = Math.max(0, contract.loanAmount - schedule.remainingBalance);
    return Math.min(100, Math.round((paidLoanPrincipal / contract.loanAmount) * 1000) / 10);
  }, [contract.loanAmount, schedule.remainingBalance]);

  const plannedSummary = useMemo(
    () => getPlannedDisbursementSummary(contract),
    [contract]
  );

  const dtiColorClass =
    realEstateMetrics.dtiStatus === "HIGH"
      ? "text-rose-700 dark:text-rose-300"
      : realEstateMetrics.dtiStatus === "WATCH"
      ? "text-amber-700 dark:text-amber-300"
      : "text-emerald-700 dark:text-emerald-300";

  return (
    <div className="space-y-6">
      {/* EXECUTIVE 4-KPI STRIP */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5 sm:gap-4">
        {/* KPI 1 */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 shadow-xs p-4 sm:p-5 space-y-2.5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
            <span>Dư nợ gốc còn lại</span>
            <span className="tabular-nums font-bold text-blue-700 dark:text-blue-400">
              Đã trả {principalProgressPct}%
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-black text-[#0F172A] dark:text-slate-100 tabular-nums">
            {formatVNDMasked(schedule.remainingBalance, isPrivacyMode)}
          </p>
          <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full transition-all"
              style={{ width: `${principalProgressPct}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
            Đợt 1: {formatShortVNDMasked(contract.loanAmount, isPrivacyMode)} · Dự kiến tất toán{" "}
            {formatDateVN(schedule.estimatedPayoffDate)}
          </p>
        </div>

        {/* KPI 2 */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 shadow-xs p-4 sm:p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
            <span>Vốn chủ sở hữu (Equity)</span>
            <span className="tabular-nums font-bold text-emerald-700 dark:text-emerald-400">
              LTV {realEstateMetrics.ltvPct}%
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-xl sm:text-2xl font-black text-emerald-700 dark:text-emerald-400 tabular-nums">
              {realEstateMetrics.equityContractPct}%
            </p>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 tabular-nums">
              ({formatShortVNDMasked(realEstateMetrics.equityContractAmount, isPrivacyMode)})
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug tabular-nums">
            Gồm {formatShortVNDMasked(contract.downPayment, isPrivacyMode)} tự có (5 đợt) +{" "}
            {formatShortVNDMasked(
              Math.max(0, contract.loanAmount - schedule.remainingBalance),
              isPrivacyMode
            )}{" "}
            gốc đã trả
          </p>
        </div>

        {/* KPI 3 */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 shadow-xs p-4 sm:p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
            <span>
              {schedule.nextUnpaidInstallment
                ? `Kỳ sắp tới #${schedule.nextUnpaidInstallment.period}`
                : "Trạng thái hợp đồng"}
            </span>
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 tabular-nums">
              {schedule.currentApplicableRate.toFixed(2)}%/năm
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xl sm:text-2xl font-black text-[#1E3A8A] dark:text-blue-300 tabular-nums">
              {schedule.nextUnpaidInstallment
                ? formatVNDMasked(schedule.nextUnpaidInstallment.totalPayment, isPrivacyMode)
                : "Đã tất toán 100%"}
            </p>
            {schedule.nextUnpaidInstallment && (
              <button
                type="button"
                onClick={() => onConfirmNextPeriod(schedule.nextUnpaidInstallment!.period)}
                className="min-h-[32px] px-2.5 py-1 rounded-lg bg-[#1E3A8A] hover:bg-blue-900 dark:bg-blue-600 dark:hover:bg-blue-700 text-white text-[11px] font-bold inline-flex items-center gap-1 shrink-0 transition-colors whitespace-nowrap cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Đóng kỳ #{schedule.nextUnpaidInstallment.period}</span>
              </button>
            )}
          </div>
          {schedule.nextUnpaidInstallment ? (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
              Hạn {formatDateVN(schedule.nextUnpaidInstallment.dueDate)} · Gốc{" "}
              {formatShortVNDMasked(schedule.nextUnpaidInstallment.principal, isPrivacyMode)} + Lãi{" "}
              {formatShortVNDMasked(schedule.nextUnpaidInstallment.interest, isPrivacyMode)}
            </p>
          ) : (
            <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">
              Chúc mừng gia đình đã hoàn thành toàn bộ dư nợ!
            </p>
          )}
        </div>

        {/* KPI 4 */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 shadow-xs p-4 sm:p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
            <span>Áp lực trả nợ / Thu nhập (DTI)</span>
            <span className={`font-bold ${dtiColorClass}`}>{realEstateMetrics.dtiLabel}</span>
          </div>
          <div className="flex items-baseline gap-2">
            <p className={`text-xl sm:text-2xl font-black tabular-nums ${dtiColorClass}`}>
              {realEstateMetrics.dtiPct}%
            </p>
            <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              / {formatShortVNDMasked(realEstateMetrics.monthlyFamilyIncome, isPrivacyMode)} thu nhập
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
            {realEstateMetrics.incomeSourceLabel}
          </p>
        </div>
      </section>

      {/* A.12A.07 FUNDING PROGRESS & STRATEGY BRIDGE (Replaces duplicate Term Reduction panel) */}
      <section className="bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 shadow-xs p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-bold text-[#172B4D] dark:text-slate-100">
              Tiến độ nguồn vốn Căn hộ {SKYONE_A12A07_VERIFIED_FACTS.property.unitCode} &amp; Lộ trình chiến lược
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
              HĐMB {formatVNDMasked(contract.propertyValue, isPrivacyMode)} · Hạn mức kế hoạch BIDV{" "}
              {formatVNDMasked(contract.creditLimit ?? contract.loanAmount, isPrivacyMode)} · Còn{" "}
              {schedule.remainingFixedMonths} tháng lãi cố định {contract.fixedInterestRate}%
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenAdvisor}
              className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-[#1E3A8A] hover:bg-blue-900 dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Mở Cố vấn &amp; Rút ngắn kỳ hạn</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onOpenContract}
              className="min-h-[38px] px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Hồ sơ HĐMB</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs tabular-nums">
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 space-y-1">
            <span className="text-slate-500 dark:text-slate-400 font-medium block">
              Vốn tự có 5 đợt (2024)
            </span>
            <span className="text-sm font-extrabold text-emerald-700 dark:text-emerald-400 block">
              {formatVNDMasked(contract.downPayment, isPrivacyMode)}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
              Đã hoàn tất ~20,6% HĐMB
            </span>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 space-y-1">
            <span className="text-slate-500 dark:text-slate-400 font-medium block">
              BIDV Đợt 1 đã giải ngân
            </span>
            <span className="text-sm font-extrabold text-[#1E3A8A] dark:text-blue-300 block">
              {formatVNDMasked(contract.loanAmount, isPrivacyMode)}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
              Đã trả {formatShortVNDMasked(schedule.totalPrincipalPaid, isPrivacyMode)} gốc qua {schedule.paidCount} kỳ
            </span>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 space-y-1">
            <span className="text-slate-500 dark:text-slate-400 font-medium block">
              Giải ngân dự kiến Q3/2027
            </span>
            <span className="text-sm font-extrabold text-indigo-700 dark:text-indigo-300 block">
              +{formatVNDMasked(plannedSummary.totalAmount, isPrivacyMode)}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
              Kỳ #{plannedSummary.primaryPeriod} ·{" "}
              {plannedSummary.hasPinkBook5Pct ? "Đợt 2 + 5% Sổ hồng" : "Đợt 2 bàn giao"}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 space-y-1">
            <span className="text-slate-500 dark:text-slate-400 font-medium block">
              Mốc 5% Sổ hồng ({formatShortVNDMasked(SKYONE_A12A07_VERIFIED_FACTS.bidvLoan.pinkBook5PctAmount, isPrivacyMode)})
            </span>
            <span
              className={`text-sm font-extrabold block ${
                plannedSummary.hasPinkBook5Pct
                  ? "text-indigo-700 dark:text-indigo-300"
                  : "text-amber-700 dark:text-amber-300"
              }`}
            >
              {plannedSummary.hasPinkBook5Pct ? "Gộp vào giải ngân BIDV" : "Dự phòng tiền mặt riêng"}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
              Bật/tắt linh hoạt tại Cố vấn hoặc Hợp đồng
            </span>
          </div>
        </div>
      </section>

      {/* Primary Combined Amortization Chart */}
      <SkyOneAmortizationChart
        contract={contract}
        schedule={schedule}
        isPrivacyMode={isPrivacyMode}
      />

      {/* Companion Chart: Balance Decline vs Equity Accumulation (VND) */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 shadow-xs p-4 sm:p-5 space-y-3">
        <div>
          <h3 className="text-sm sm:text-base font-bold text-[#172B4D] dark:text-slate-100">
            Đường cong Dư nợ giảm dần &amp; Tích lũy Vốn chủ
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Giao điểm giữa giảm dư nợ ngân hàng (đã tính Đợt 2 Q3/2027) và tăng tỷ trọng sở hữu căn hộ thực tế
          </p>
        </div>
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height={260} minWidth={0} minHeight={0}>
            <AreaChart
              data={chartYearlyData}
              margin={{ top: 10, right: isMobile ? 6 : 12, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis
                dataKey="name"
                interval={computeResponsiveXAxisInterval(chartYearlyData.length, isMobile, 5)}
                minTickGap={isMobile ? 28 : 14}
                tick={{ fontSize: isMobile ? 10 : 11, fill: "var(--chart-tick)" }}
                axisLine={{ stroke: "var(--chart-grid)" }}
                tickLine={false}
              />
              <YAxis
                tickCount={isMobile ? 4 : 6}
                width={isMobile ? 44 : 56}
                tick={{ fontSize: isMobile ? 10 : 11, fill: "var(--chart-tick)" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => formatShortVNDMasked(Number(v), isPrivacyMode)}
              />
              <Tooltip
                formatter={(value) => formatVNDMasked(Number(value), isPrivacyMode)}
                contentStyle={{
                  backgroundColor: isDark ? "#0F172A" : "#FFFFFF",
                  borderColor: isDark ? "#334155" : "#DCE4EE",
                  color: isDark ? "#F1F5F9" : "#172B4D",
                  borderRadius: "0.75rem",
                  fontSize: "12px",
                }}
              />
              <Legend wrapperStyle={{ fontSize: isMobile ? 11 : 12, color: "var(--chart-tick)" }} />
              <Area
                type="monotone"
                dataKey="remainingBalance"
                name="Dư nợ còn lại"
                stroke={isDark ? "#F87171" : "#DC2626"}
                fill={isDark ? "rgba(248, 113, 113, 0.22)" : "#FEE2E2"}
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="equity"
                name="Vốn chủ sở hữu"
                stroke={isDark ? "#34D399" : "#059669"}
                fill={isDark ? "rgba(52, 211, 153, 0.22)" : "#D1FAE5"}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Real Estate Equity Metrics & Cost Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 shadow-xs p-5 space-y-3">
          <h3 className="text-sm font-bold text-[#172B4D] dark:text-slate-100 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Sức khỏe tài sản căn hộ SKYONE</span>
          </h3>
          <dl className="space-y-2.5 text-xs">
            <div className="flex justify-between gap-2 py-1 border-b border-slate-100 dark:border-slate-800">
              <dt className="text-slate-500 dark:text-slate-400">Giá hợp đồng mua (gồm VAT)</dt>
              <dd className="font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                {formatVNDMasked(contract.propertyValue, isPrivacyMode)}
              </dd>
            </div>
            <div className="flex justify-between gap-2 py-1 border-b border-slate-100 dark:border-slate-800">
              <dt className="text-slate-500 dark:text-slate-400">Định giá thị trường hiện tại</dt>
              <dd className="font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
                {formatVNDMasked(contract.currentMarketValue, isPrivacyMode)}
              </dd>
            </div>
            <div className="flex justify-between gap-2 py-1 border-b border-slate-100 dark:border-slate-800">
              <dt className="text-slate-500 dark:text-slate-400">Vốn chủ theo thị trường (Equity)</dt>
              <dd className="font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
                {formatVNDMasked(realEstateMetrics.equityMarketAmount, isPrivacyMode)} (
                {realEstateMetrics.equityMarketPct}%)
              </dd>
            </div>
            <div className="flex justify-between gap-2 py-1 border-b border-slate-100 dark:border-slate-800">
              <dt className="text-slate-500 dark:text-slate-400">Tổng lãi đã trả thực tế</dt>
              <dd className="font-bold text-amber-700 dark:text-amber-300 tabular-nums">
                {formatVNDMasked(schedule.totalInterestPaid, isPrivacyMode)}
              </dd>
            </div>
            <div className="flex justify-between gap-2 py-1">
              <dt className="text-slate-500 dark:text-slate-400">Tổng lãi dự kiến toàn kỳ hạn</dt>
              <dd className="font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                {formatVNDMasked(schedule.totalProjectedInterest, isPrivacyMode)}
              </dd>
            </div>
          </dl>
        </div>

        {/* Floating Rate Stress-Test Table */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 shadow-xs p-5 space-y-3">
          <div>
            <h3 className="text-sm font-bold text-[#172B4D] dark:text-slate-100 flex items-center gap-2">
              <Percent className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Stress-Test biến động lãi thả nổi &amp; Chỉ số DTI</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Giả lập áp lực dòng tiền nếu lãi suất thả nổi tăng thêm +1%, +2%, +3% so với kịch bản gốc (
              {(contract.floatingBaseRate + contract.floatingSpread).toFixed(2)}%/năm)
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-bold">
                  <th className="py-2.5 pr-3">Kịch bản</th>
                  <th className="py-2.5 px-3 text-right">Lãi thả nổi</th>
                  <th className="py-2.5 px-3 text-right">Đỉnh trả/tháng</th>
                  <th className="py-2.5 px-3 text-right">Chênh lệch hiện tại</th>
                  <th className="py-2.5 px-3 text-right">DTI %</th>
                  <th className="py-2.5 pl-3 text-right">Đánh giá</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {stressScenarios.map((sc) => (
                  <tr key={sc.shockPercent} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                    <td className="py-2.5 pr-3 font-bold text-slate-800 dark:text-slate-100">{sc.label}</td>
                    <td className="py-2.5 px-3 text-right font-semibold text-slate-700 dark:text-slate-200 tabular-nums">
                      {sc.floatingRate.toFixed(2)}%
                    </td>
                    <td className="py-2.5 px-3 text-right font-extrabold text-[#1E3A8A] dark:text-blue-300 tabular-nums">
                      {formatVNDMasked(sc.peakMonthlyPayment, isPrivacyMode)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold text-slate-600 dark:text-slate-300 tabular-nums">
                      {sc.monthlyDeltaFromCurrent >= 0 ? "+" : ""}
                      {formatVNDMasked(sc.monthlyDeltaFromCurrent, isPrivacyMode)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-800 dark:text-slate-100 tabular-nums">
                      {sc.dtiPct}%
                    </td>
                    <td className="py-2.5 pl-3 text-right font-bold">
                      <span
                        className={
                          sc.status === "HIGH"
                            ? "text-rose-700 dark:text-rose-300"
                            : sc.status === "WATCH"
                            ? "text-amber-700 dark:text-amber-300"
                            : "text-emerald-700 dark:text-emerald-300"
                        }
                      >
                        {sc.status === "HIGH"
                          ? "Áp lực cao"
                          : sc.status === "WATCH"
                          ? "Cân nhắc"
                          : "An toàn"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* AI OCR Thông báo BIDV & Cố vấn Chiến lược Liên thông SKYONE x GOLD x FINANCE */}
      <SkyOneAiToolsPanel />
    </div>
  );
}
