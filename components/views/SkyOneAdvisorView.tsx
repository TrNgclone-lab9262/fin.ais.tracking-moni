"use client";

import React, { useMemo, useState } from "react";
import {
  Compass,
  Building2,
  ShieldCheck,
  TrendingDown,
  ArrowRight,
  CheckCircle2,
  RefreshCw,
  AlertTriangle,
  SlidersHorizontal,
  Calendar,
  BadgeCheck,
  X,
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { useFinance } from "@/context/FinanceContext";
import {
  formatVNDMasked,
  formatShortVNDMasked,
  formatDateVN,
} from "@/lib/formatters";
import {
  REAL_BIDV_SKYONE_SNAPSHOT,
  SkyOneDtiStatus,
  analyzeSkyOneStrategy,
  calculateFamilyMonthlyIncome,
  generateMortgageSchedule,
  isRealBidvProfileSynced,
} from "@/lib/mortgageEngine";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";

function getDtiStatusMeta(status: SkyOneDtiStatus): {
  label: string;
  toneClass: string;
  badgeClass: string;
  barClass: string;
} {
  if (status === "HIGH") {
    return {
      label: "Áp lực cao (> 40%)",
      toneClass: "text-rose-700 dark:text-rose-300",
      badgeClass: "bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300",
      barClass: "bg-rose-500",
    };
  }
  if (status === "WATCH") {
    return {
      label: "Cảnh báo (31–40%)",
      toneClass: "text-amber-700 dark:text-amber-300",
      badgeClass: "bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300",
      barClass: "bg-amber-500",
    };
  }
  return {
    label: "An toàn (≤ 30%)",
    toneClass: "text-emerald-700 dark:text-emerald-300",
    badgeClass: "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300",
    barClass: "bg-emerald-500",
  };
}

const TRANCHE_PRESETS = [
  { label: "Không vay thêm", amount: 0 },
  { label: "+300 triệu", amount: 300_000_000 },
  { label: "+438tr (Đủ 1,1 tỷ)", amount: 437_933_807 },
  { label: "+600 triệu", amount: 600_000_000 },
];

const FLOATING_RATE_PRESETS = [8.5, 9.5, 10.0, 11.0];

export function SkyOneAdvisorView() {
  const {
    skyoneLoan,
    skyoneAutoSyncedNotice,
    dismissSkyoneAutoSyncedNotice,
    setSkyoneTab,
    transactions,
    summary,
    selectedMonth,
    themeMode,
    isPrivacyMode,
    resetSkyOneLoan,
    switchSubApp,
  } = useFinance();

  const isDark = themeMode === "dark";
  const isSyncedWithRealBidv = isRealBidvProfileSynced(skyoneLoan);

  const schedule = useMemo(() => generateMortgageSchedule(skyoneLoan), [skyoneLoan]);
  const incomeInfo = useMemo(
    () => calculateFamilyMonthlyIncome(transactions, selectedMonth),
    [transactions, selectedMonth]
  );

  // Interactive Strategy Parameters (default grounded in BIDV data + Phase 1 answers)
  const [nextTrancheAmount, setNextTrancheAmount] = useState<number>(437_933_807);
  const [nextTranchePeriod, setNextTranchePeriod] = useState<number>(21); // Tháng 05/2027 (bàn giao)
  const [projectedFloatingRate, setProjectedFloatingRate] = useState<number>(10.0);
  const [safeYieldRate, setSafeYieldRate] = useState<number>(6.2);

  // Default buffer contribution anchored to family monthly surplus (safe 40% of surplus or 8tr)
  const defaultContribution = useMemo(() => {
    const rawSurplus = Math.max(0, summary.savingsAmount);
    if (rawSurplus >= 10_000_000) {
      return Math.min(25_000_000, Math.round((rawSurplus * 0.45) / 500_000) * 500_000);
    }
    return 8_000_000;
  }, [summary.savingsAmount]);

  const [monthlyBufferContribution, setMonthlyBufferContribution] = useState<number>(
    defaultContribution
  );
  const [expectedMonthlyRent, setExpectedMonthlyRent] = useState<number>(7_500_000);
  const [isSyncConfirmOpen, setIsSyncConfirmOpen] = useState(false);
  const [syncSuccessToast, setSyncSuccessToast] = useState<string | null>(null);

  const strategy = useMemo(
    () =>
      analyzeSkyOneStrategy(skyoneLoan, {
        nextDisbursementAmount: nextTrancheAmount,
        nextDisbursementAfterPeriod: nextTranchePeriod,
        projectedFloatingRate,
        safeSavingsYieldRate: safeYieldRate,
        monthlyBufferContribution,
        expectedMonthlyRent,
        monthlyFamilyIncome: incomeInfo.monthlyIncome,
      }),
    [
      skyoneLoan,
      nextTrancheAmount,
      nextTranchePeriod,
      projectedFloatingRate,
      safeYieldRate,
      monthlyBufferContribution,
      expectedMonthlyRent,
      incomeInfo.monthlyIncome,
    ]
  );

  const surplusSharePct =
    summary.savingsAmount > 0
      ? Math.round((monthlyBufferContribution / summary.savingsAmount) * 100)
      : null;

  const dtiNoStrikeTone =
    strategy.dtiNoStrikePct > 40
      ? "text-rose-600 dark:text-rose-400"
      : strategy.dtiNoStrikePct > 30
      ? "text-amber-600 dark:text-amber-400"
      : "text-emerald-600 dark:text-emerald-400";

  const dtiWithStrikeTone =
    strategy.dtiWithStrikePct > 40
      ? "text-rose-600 dark:text-rose-400"
      : strategy.dtiWithStrikePct > 30
      ? "text-amber-600 dark:text-amber-400"
      : "text-emerald-600 dark:text-emerald-400";

  const trancheTargetDateLabel = useMemo(() => {
    const matched = schedule.rows.find((r) => r.period === nextTranchePeriod);
    return matched ? formatDateVN(matched.dueDate) : `Kỳ #${nextTranchePeriod}`;
  }, [schedule.rows, nextTranchePeriod]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. HEADER & REAL BIDV ACCOUNT DIAGNOSTIC STRIP */}
      <section className="bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 p-5 sm:p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-700 dark:text-indigo-300">
              <Compass className="w-4 h-4 shrink-0" />
              <span>Cố vấn Định lượng Tài chính & Bất động sản</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-[#0F172A] dark:text-slate-100 tracking-tight">
              Chiến lược Tối ưu Dòng tiền trước mốc Thả nổi 08/2028
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 tabular-nums">
              {skyoneLoan.bankName}
              {skyoneLoan.accountNumber ? ` · TK nguồn ${skyoneLoan.accountNumber}` : ""}
              <span aria-hidden="true"> · </span>
              Giải ngân {formatDateVN(skyoneLoan.disbursementDate)}
              <span aria-hidden="true"> · </span>
              Ưu đãi {skyoneLoan.fixedInterestRate}% đến{" "}
              {formatDateVN(strategy.fixedEndDate)}
              <span aria-hidden="true"> · </span>
              {skyoneLoan.interestBasis === "ACTUAL_365" ? "Actual/365" : "30/360"}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {!isSyncedWithRealBidv && (
              <button
                type="button"
                data-testid="sync-real-bidv-btn"
                onClick={() => setIsSyncConfirmOpen(true)}
                className="min-h-[42px] px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Nạp hồ sơ BIDV thực tế (662,2tr · 5,5%)</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setSkyoneTab("SCHEDULE")}
              className="min-h-[42px] px-3.5 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Calendar className="w-4 h-4" />
              <span>Lịch 12 kỳ đã đóng</span>
            </button>
            <button
              type="button"
              onClick={() => setSkyoneTab("CONTRACT")}
              className="min-h-[42px] px-3.5 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>Thông số Hợp đồng</span>
            </button>
          </div>
        </div>

        {skyoneAutoSyncedNotice && (
          <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200 text-xs font-semibold flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <BadgeCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span>{skyoneAutoSyncedNotice}</span>
            </div>
            <button
              type="button"
              onClick={dismissSkyoneAutoSyncedNotice}
              aria-label="Đóng thông báo đồng bộ BIDV"
              className="p-1 rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-900/60 shrink-0 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {syncSuccessToast && (
          <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{syncSuccessToast}</span>
          </div>
        )}

        {!isSyncedWithRealBidv ? (
          <div className="p-3.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-950 dark:text-amber-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                Hồ sơ đang lưu trên máy khác với sao kê BIDV bạn vừa tải lên ({" "}
                <strong className="tabular-nums">662.226.193 VND</strong>, lãi{" "}
                <strong className="tabular-nums">5,5%/năm</strong>, 12 kỳ đã trả{" "}
                <strong className="tabular-nums">74.173.005 VND</strong>). Bấm{" "}
                <strong>Nạp hồ sơ BIDV thực tế</strong> để đồng bộ ngay mà không ảnh hưởng sổ thu chi HOME MONI.
              </p>
            </div>
          </div>
        ) : (
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <BadgeCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Đã xác thực ({schedule.verifiedCount} kỳ sao kê)</span>
              </span>
              <span className="font-extrabold text-[#0F172A] dark:text-slate-100 tabular-nums mt-0.5 block">
                {formatVNDMasked(REAL_BIDV_SKYONE_SNAPSHOT.verifiedTotalCashPaid12M, isPrivacyMode)}
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block">
                Gốc đã giảm (12 × 3,056tr)
              </span>
              <span className="font-extrabold text-emerald-700 dark:text-emerald-400 tabular-nums mt-0.5 block">
                {formatVNDMasked(REAL_BIDV_SKYONE_SNAPSHOT.verifiedPaidPrincipal12M, isPrivacyMode)}
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block">
                Tự động nhận diện hợp đồng
              </span>
              <span className="font-extrabold text-slate-800 dark:text-slate-200 tabular-nums mt-0.5 block">
                TK {REAL_BIDV_SKYONE_SNAPSHOT.accountNumber} · 5,5% / 36T
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block">
                Kỳ tiếp theo · Tháng 12/2026
              </span>
              <span className="font-extrabold text-indigo-700 dark:text-indigo-300 tabular-nums mt-0.5 block">
                {formatDateVN(REAL_BIDV_SKYONE_SNAPSHOT.nextDueDate)} ·{" "}
                {formatShortVNDMasked(strategy.currentMonthlyPayment, isPrivacyMode)}
              </span>
            </div>
          </div>
        )}
      </section>

      {/* 2. 4-KPI QUANTITATIVE DIAGNOSIS STRIP */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 p-4 sm:p-5 space-y-1.5">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">
            Cửa sổ vốn rẻ {skyoneLoan.fixedInterestRate}%
          </span>
          <p className="text-2xl font-black text-indigo-700 dark:text-indigo-300 tabular-nums">
            {strategy.monthsRemainingFixed} tháng
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
            Hết ưu đãi kỳ #{strategy.fixedEndPeriod} ({formatDateVN(strategy.fixedEndDate)})
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 p-4 sm:p-5 space-y-1.5">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">
            Nghĩa vụ sau giải ngân thêm ({skyoneLoan.fixedInterestRate}%)
          </span>
          <p className="text-2xl font-black text-[#0F172A] dark:text-slate-100 tabular-nums">
            {formatShortVNDMasked(strategy.postDisbursementMonthlyPayment, isPrivacyMode)}/th
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
            Hiện tại: {formatShortVNDMasked(strategy.currentMonthlyPayment, isPrivacyMode)}/th · DTI{" "}
            {strategy.dtiPostDisbursementPct}%
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 p-4 sm:p-5 space-y-1.5">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">
            Áp lực thả nổi {projectedFloatingRate.toFixed(1)}% (từ 09/2028)
          </span>
          <p className="text-2xl font-black text-[#0F172A] dark:text-slate-100 tabular-nums">
            {formatShortVNDMasked(strategy.postResetMonthlyPaymentNoStrike, isPrivacyMode)}/th
          </p>
          <p className={`text-[11px] font-bold tabular-nums ${dtiNoStrikeTone}`}>
            DTI {strategy.dtiNoStrikePct}% · Tăng +{formatShortVNDMasked(strategy.monthlyShockIncreaseNoStrike, isPrivacyMode)}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 p-4 sm:p-5 space-y-1.5">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">
            Hiệu quả Đánh chặn Quỹ Đệm 08/2028
          </span>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
            {formatShortVNDMasked(strategy.postResetMonthlyPaymentWithStrike, isPrivacyMode)}/th
          </p>
          <p className={`text-[11px] font-bold tabular-nums ${dtiWithStrikeTone}`}>
            DTI hạ còn {strategy.dtiWithStrikePct}% · Giảm{" "}
            {formatShortVNDMasked(strategy.monthlySavingsPostResetWithStrike, isPrivacyMode)}/tháng
          </p>
        </div>
      </section>

      {/* 2B. 3-MILESTONE DTI HEALTH WARNINGS & ACTIONABLE REDUCTION RECOMMENDATIONS */}
      {(() => {
        const { dtiDiagnostics } = strategy;
        const m1 = getDtiStatusMeta(dtiDiagnostics.currentStatus);
        const m2 = getDtiStatusMeta(dtiDiagnostics.postDisbursementStatus);
        const m3Before = getDtiStatusMeta(dtiDiagnostics.noStrikeStatus);
        const m3After = getDtiStatusMeta(dtiDiagnostics.withStrikeStatus);
        const targetRentApplied = Math.min(15_000_000, dtiDiagnostics.requiredRentForSafeDti);

        return (
          <section
            data-testid="dti-3milestone-panel"
            className="bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 p-5 space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  {dtiDiagnostics.hasWarningAtAnyStage ? (
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  ) : (
                    <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  )}
                  <h3 className="text-base font-extrabold text-[#0F172A] dark:text-slate-100">
                    Cảnh báo Sức khỏe DTI Gia đình (3 Mốc) &amp; Gợi ý giảm áp lực
                  </h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  Đo trên thu nhập hiện tại:{" "}
                  <strong className="text-slate-700 dark:text-slate-200">
                    {formatVNDMasked(dtiDiagnostics.monthlyIncome, isPrivacyMode)}/tháng
                  </strong>{" "}
                  ({incomeInfo.sourceLabel}) · Trần an toàn 30%:{" "}
                  <strong className="text-emerald-700 dark:text-emerald-400">
                    ≤ {formatShortVNDMasked(dtiDiagnostics.safeMonthlyCeiling, isPrivacyMode)}/th
                  </strong>
                </p>
              </div>
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-lg border whitespace-nowrap self-start sm:self-center ${
                  dtiDiagnostics.hasWarningAtAnyStage
                    ? m3Before.badgeClass
                    : m1.badgeClass
                }`}
              >
                {dtiDiagnostics.hasWarningAtAnyStage
                  ? `Đỉnh áp lực: ${dtiDiagnostics.worstDtiPct}% tại ${dtiDiagnostics.worstStageLabel}`
                  : "An toàn ≤ 30% xuyên suốt 3 mốc"}
              </span>
            </div>

            {/* 3 Milestones Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              {/* Milestone 1 */}
              <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-600 dark:text-slate-300">
                    Mốc 1 · Hiện tại ({skyoneLoan.fixedInterestRate}%)
                  </span>
                  <span className={`font-extrabold ${m1.toneClass}`}>{m1.label}</span>
                </div>
                <div className="flex items-baseline justify-between tabular-nums">
                  <span className={`text-xl font-black ${m1.toneClass}`}>
                    {strategy.dtiCurrentPct}%
                  </span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    {formatVNDMasked(strategy.currentMonthlyPayment, isPrivacyMode)}/th
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${m1.barClass}`}
                    style={{ width: `${Math.min(100, strategy.dtiCurrentPct)}%` }}
                  />
                </div>
              </div>

              {/* Milestone 2 */}
              <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-600 dark:text-slate-300">
                    Mốc 2 · Sau giải ngân thêm
                  </span>
                  <span className={`font-extrabold ${m2.toneClass}`}>{m2.label}</span>
                </div>
                <div className="flex items-baseline justify-between tabular-nums">
                  <span className={`text-xl font-black ${m2.toneClass}`}>
                    {strategy.dtiPostDisbursementPct}%
                  </span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    {formatVNDMasked(strategy.postDisbursementMonthlyPayment, isPrivacyMode)}/th
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${m2.barClass}`}
                    style={{ width: `${Math.min(100, strategy.dtiPostDisbursementPct)}%` }}
                  />
                </div>
              </div>

              {/* Milestone 3 */}
              <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-600 dark:text-slate-300">
                    Mốc 3 · Thả nổi {projectedFloatingRate.toFixed(1)}% (09/2028)
                  </span>
                  <span className={`font-extrabold ${m3Before.toneClass}`}>
                    {m3Before.label}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-2 tabular-nums">
                  <span className={`text-xl font-black ${m3Before.toneClass}`}>
                    {strategy.dtiNoStrikePct}%
                  </span>
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    Sau Quỹ Đệm:{" "}
                    <strong className={m3After.toneClass}>{strategy.dtiWithStrikePct}%</strong>
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${m3Before.barClass}`}
                    style={{ width: `${Math.min(100, strategy.dtiNoStrikePct)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Actionable Recommendations to Lower DTI */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              {/* Rec 1: Buffer strike */}
              <div className="flex flex-col justify-between gap-2 p-3 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/30">
                <div className="space-y-1">
                  <p className="font-extrabold text-emerald-900 dark:text-emerald-200">
                    1. Hạ DTI bằng Quỹ Đệm 08/2028
                  </p>
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed tabular-nums">
                    {dtiDiagnostics.recommendedMonthlyContributionForSafeDti > 0 ? (
                      <>
                        Trích tối thiểu{" "}
                        <strong className="text-emerald-700 dark:text-emerald-300">
                          {formatShortVNDMasked(
                            dtiDiagnostics.recommendedMonthlyContributionForSafeDti,
                            isPrivacyMode
                          )}
                          /tháng
                        </strong>{" "}
                        để tất toán gốc đúng mốc 08/2028, đưa DTI thả nổi về ≤ 30%.
                      </>
                    ) : (
                      <>DTI ở cả 3 mốc đã ở mức an toàn ≤ 30% ngay cả khi chưa dùng Quỹ Đệm.</>
                    )}
                  </p>
                </div>
                {dtiDiagnostics.recommendedMonthlyContributionForSafeDti > 0 && (
                  <button
                    type="button"
                    data-testid="apply-recommended-buffer-btn"
                    onClick={() =>
                      setMonthlyBufferContribution(
                        dtiDiagnostics.recommendedMonthlyContributionForSafeDti
                      )
                    }
                    disabled={
                      monthlyBufferContribution ===
                      dtiDiagnostics.recommendedMonthlyContributionForSafeDti
                    }
                    className="self-start min-h-[34px] px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-[11px] transition-colors cursor-pointer"
                  >
                    {monthlyBufferContribution ===
                    dtiDiagnostics.recommendedMonthlyContributionForSafeDti
                      ? "Đang áp dụng mức này"
                      : "Áp dụng mức trích này"}
                  </button>
                )}
              </div>

              {/* Rec 2: Rental offset */}
              <div className="flex flex-col justify-between gap-2 p-3 rounded-lg bg-blue-50/60 dark:bg-blue-950/30">
                <div className="space-y-1">
                  <p className="font-extrabold text-blue-900 dark:text-blue-200">
                    2. Bù dòng tiền bằng Cho thuê căn hộ
                  </p>
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed tabular-nums">
                    {dtiDiagnostics.requiredRentForSafeDti > 0 ? (
                      <>
                        Doanh thu thuê từ{" "}
                        <strong className="text-blue-700 dark:text-blue-300">
                          {formatShortVNDMasked(dtiDiagnostics.requiredRentForSafeDti, isPrivacyMode)}
                          /tháng
                        </strong>{" "}
                        giúp bù trực tiếp phần trả vượt trần 30% tại mốc thả nổi.
                      </>
                    ) : (
                      <>Thu nhập gia đình hiện tại đủ gánh nghĩa vụ tháng mà không phụ thuộc tiền thuê.</>
                    )}
                  </p>
                </div>
                {dtiDiagnostics.requiredRentForSafeDti > 0 && (
                  <button
                    type="button"
                    data-testid="apply-recommended-rent-btn"
                    onClick={() => setExpectedMonthlyRent(targetRentApplied)}
                    disabled={expectedMonthlyRent === targetRentApplied}
                    className="self-start min-h-[34px] px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-[11px] transition-colors cursor-pointer"
                  >
                    {expectedMonthlyRent === targetRentApplied
                      ? "Đang áp dụng giá thuê này"
                      : "Áp dụng giá thuê này"}
                  </button>
                )}
              </div>

              {/* Rec 3: Income milestone */}
              <div className="flex flex-col justify-between gap-2 p-3 rounded-lg bg-indigo-50/60 dark:bg-indigo-950/30">
                <div className="space-y-1">
                  <p className="font-extrabold text-indigo-900 dark:text-indigo-200">
                    3. Mốc Thu nhập Gia đình trước 09/2028
                  </p>
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed tabular-nums">
                    Để giữ DTI thả nổi ≤ 30% mà không cần trả gốc sớm, tổng thu nhập 2 vợ chồng cần đạt{" "}
                    <strong className="text-indigo-700 dark:text-indigo-300">
                      {formatShortVNDMasked(dtiDiagnostics.requiredIncomeForSafeDti, isPrivacyMode)}
                      /tháng
                    </strong>
                    .
                  </p>
                </div>
              </div>
            </div>
          </section>
        );
      })()}

      {/* 3. INTERACTIVE DUAL-INFLECTION SIMULATOR + TIMELINE CHART */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Controls Column */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 p-5 space-y-5">
          <div>
            <h3 className="text-base font-extrabold text-[#0F172A] dark:text-slate-100">
              01. Tham số 2 Điểm gãy & Quỹ Đệm
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Điều chỉnh tiến độ giải ngân tiếp theo và mức tích lũy hàng tháng để tìm điểm cân bằng an toàn.
            </p>
          </div>

          {/* Planned Tranche Amount */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="advisor-tranche-range" className="font-bold text-slate-700 dark:text-slate-200">
                Đợt giải ngân tiếp theo (theo tiến độ)
              </label>
              <span className="font-black text-indigo-700 dark:text-indigo-300 tabular-nums">
                {formatShortVNDMasked(nextTrancheAmount, isPrivacyMode)}
              </span>
            </div>
            <input
              id="advisor-tranche-range"
              type="range"
              min={0}
              max={800_000_000}
              step={25_000_000}
              value={nextTrancheAmount}
              onChange={(e) => setNextTrancheAmount(Number(e.target.value))}
              className="w-full accent-indigo-600 cursor-pointer"
            />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {TRANCHE_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setNextTrancheAmount(preset.amount)}
                  className={`min-h-[34px] px-2 py-1 rounded-lg text-[11px] font-bold transition-colors whitespace-nowrap truncate cursor-pointer ${
                    Math.abs(nextTrancheAmount - preset.amount) < 1_000_000
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tranche Timing + Floating Rate */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="advisor-tranche-period" className="font-bold text-slate-700 dark:text-slate-200">
                  Thời điểm giải ngân
                </label>
                <span className="font-bold text-slate-600 dark:text-slate-300 tabular-nums">
                  {trancheTargetDateLabel}
                </span>
              </div>
              <input
                id="advisor-tranche-period"
                type="range"
                min={schedule.currentReferencePeriod}
                max={Math.max(schedule.currentReferencePeriod, skyoneLoan.fixedRateMonths - 1)}
                step={1}
                value={nextTranchePeriod}
                onChange={(e) => setNextTranchePeriod(Number(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700 dark:text-slate-200">Lãi thả nổi sau 08/2028</span>
                <span className="font-black text-amber-600 dark:text-amber-400 tabular-nums">
                  {projectedFloatingRate.toFixed(1)}%/năm
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1">
                {FLOATING_RATE_PRESETS.map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => setProjectedFloatingRate(rate)}
                    className={`min-h-[34px] rounded-lg text-[11px] font-bold tabular-nums transition-colors whitespace-nowrap cursor-pointer ${
                      Math.abs(projectedFloatingRate - rate) < 0.05
                        ? "bg-amber-500 text-slate-950"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    {rate}%
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-4">
            {/* Buffer Monthly Contribution */}
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <label htmlFor="advisor-buffer-contrib" className="font-bold text-slate-700 dark:text-slate-200">
                  Trích Quỹ Đệm SKYONE mỗi tháng
                </label>
                <span className="font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {formatShortVNDMasked(monthlyBufferContribution, isPrivacyMode)}/th
                </span>
              </div>
              <input
                id="advisor-buffer-contrib"
                type="range"
                min={0}
                max={Math.max(30_000_000, monthlyBufferContribution)}
                step={500_000}
                value={monthlyBufferContribution}
                onChange={(e) => setMonthlyBufferContribution(Number(e.target.value))}
                className="w-full accent-emerald-600 cursor-pointer"
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                Thặng dư thu chi HOME MONI hiện tại:{" "}
                <strong className="text-slate-700 dark:text-slate-200">
                  {formatShortVNDMasked(Math.max(0, summary.savingsAmount), isPrivacyMode)}/th
                </strong>
                {surplusSharePct !== null && (
                  <span> · Tương đương {surplusSharePct}% tiền dư hàng tháng</span>
                )}
              </p>
            </div>

            {/* Safe Yield + Rental Income */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="advisor-yield-rate" className="font-bold text-slate-700 dark:text-slate-200">
                    Lãi suất gửi Quỹ Đệm
                  </label>
                  <span className="font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {safeYieldRate.toFixed(1)}%/năm
                  </span>
                </div>
                <input
                  id="advisor-yield-rate"
                  type="range"
                  min={4.0}
                  max={8.5}
                  step={0.1}
                  value={safeYieldRate}
                  onChange={(e) => setSafeYieldRate(Number(e.target.value))}
                  className="w-full accent-emerald-600 cursor-pointer"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="advisor-rent-slider" className="font-bold text-slate-700 dark:text-slate-200">
                    Giá thuê dự kiến (Dĩ An)
                  </label>
                  <span className="font-extrabold text-blue-700 dark:text-blue-400 tabular-nums">
                    {expectedMonthlyRent === 0
                      ? "Ở thực (0đ)"
                      : `${formatShortVNDMasked(expectedMonthlyRent, isPrivacyMode)}/th`}
                  </span>
                </div>
                <input
                  id="advisor-rent-slider"
                  type="range"
                  min={0}
                  max={15_000_000}
                  step={500_000}
                  value={expectedMonthlyRent}
                  onChange={(e) => setExpectedMonthlyRent(Number(e.target.value))}
                  className="w-full accent-blue-600 cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Chart Column */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 p-5 flex flex-col justify-between space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-extrabold text-[#0F172A] dark:text-slate-100">
                02. Quỹ đạo Dòng tiền 48 tháng tới & Cú đánh chặn 08/2028
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                So sánh tiền trả ngân hàng nếu giữ nguyên vs sau khi tất toán bằng Quỹ Đệm {formatShortVNDMasked(strategy.totalBufferAtReset, isPrivacyMode)} tại kỳ #{strategy.fixedEndPeriod}.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold shrink-0">
              <span className="inline-flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                <span className="w-2.5 h-2.5 rounded-xs bg-rose-500 inline-block" />
                Không có Quỹ Đệm
              </span>
              <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 inline-block" />
                Đánh chặn 08/2028
              </span>
            </div>
          </div>

          <div className="h-[300px] sm:h-[330px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={strategy.timelinePoints}
                margin={{ top: 10, right: 12, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="skyoneNoStrikeFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.22} />
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
                  tick={{ fontSize: 11, fill: isDark ? "#94A3B8" : "#64748B" }}
                  tickLine={false}
                  axisLine={{ stroke: isDark ? "#334155" : "#CBD5E1" }}
                  minTickGap={20}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: isDark ? "#94A3B8" : "#64748B" }}
                  tickLine={false}
                  axisLine={false}
                  width={56}
                  tickFormatter={(val: number) =>
                    isPrivacyMode ? "•••" : `${(val / 1_000_000).toFixed(1)}tr`
                  }
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || payload.length === 0) return null;
                    const pt = payload[0].payload as (typeof strategy.timelinePoints)[number];
                    return (
                      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-3 text-xs space-y-1.5 min-w-[215px]">
                        <div className="font-extrabold text-slate-900 dark:text-slate-100 flex items-center justify-between gap-3 tabular-nums">
                          <span>Kỳ #{pt.period} ({formatDateVN(pt.dueDate)})</span>
                          <span className="text-[11px] text-indigo-600 dark:text-indigo-400">
                            {pt.stage === "FLOATING"
                              ? "Thả nổi"
                              : pt.stage === "FIXED_DISBURSED"
                              ? "Sau giải ngân"
                              : "Ưu đãi hiện tại"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4 tabular-nums">
                          <span className="text-slate-500 dark:text-slate-400">Không có Quỹ Đệm:</span>
                          <span className="font-bold text-rose-600 dark:text-rose-400">
                            {formatVNDMasked(pt.paymentNoStrategy, isPrivacyMode)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4 tabular-nums">
                          <span className="text-slate-500 dark:text-slate-400">Sau đánh chặn 08/28:</span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            {formatVNDMasked(pt.paymentWithStrike, isPrivacyMode)}
                          </span>
                        </div>
                        {pt.expectedRent > 0 && (
                          <div className="flex items-center justify-between gap-4 pt-1 border-t border-slate-100 dark:border-slate-800 tabular-nums">
                            <span className="text-slate-500 dark:text-slate-400">Tiền thuê bù đắp:</span>
                            <span className="font-bold text-blue-600 dark:text-blue-400">
                              {formatVNDMasked(pt.expectedRent, isPrivacyMode)}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  }}
                />
                <ReferenceLine
                  y={Math.round(incomeInfo.monthlyIncome * 0.3)}
                  stroke={isDark ? "#F59E0B" : "#D97706"}
                  strokeDasharray="4 4"
                  label={{
                    value: "Trần DTI an toàn 30%",
                    position: "insideTopRight",
                    fill: isDark ? "#FBBF24" : "#B45309",
                    fontSize: 11,
                  }}
                />
                {expectedMonthlyRent > 0 && (
                  <ReferenceLine
                    y={expectedMonthlyRent}
                    stroke={isDark ? "#60A5FA" : "#2563EB"}
                    strokeDasharray="2 3"
                  />
                )}
                <Area
                  type="monotone"
                  dataKey="paymentNoStrategy"
                  stroke="#F43F5E"
                  strokeWidth={2}
                  fill="url(#skyoneNoStrikeFill)"
                />
                <Line
                  type="monotone"
                  dataKey="paymentWithStrike"
                  stroke="#10B981"
                  strokeWidth={2.5}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs tabular-nums">
            <div>
              <span className="text-slate-500 dark:text-slate-400 block">
                Dư nợ tại 08/2028 (trước đánh chặn)
              </span>
              <span className="font-extrabold text-[#0F172A] dark:text-slate-100">
                {formatShortVNDMasked(strategy.balanceAtResetBeforeStrike, isPrivacyMode)}
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block">
                Tổng Quỹ Đệm tích lũy ({strategy.monthsRemainingFixed} tháng)
              </span>
              <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                {formatShortVNDMasked(strategy.totalBufferAtReset, isPrivacyMode)}
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block">
                Dư nợ sau cú đánh chặn (từ 09/2028)
              </span>
              <span className="font-extrabold text-indigo-700 dark:text-indigo-300">
                {formatShortVNDMasked(strategy.balanceAtResetAfterStrike, isPrivacyMode)}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 4. POSITIVE CARRY COMPARISON TABLE + REAL ESTATE YIELD COMPASS */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Strategy Matrix Comparison */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-extrabold text-[#0F172A] dark:text-slate-100">
                03. So sánh Định lượng: Trả sớm ngay vs Giữ 5,5% & Đánh chặn 08/2028
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Chênh lệch lãi suất ròng (Arbitrage):{" "}
                <strong
                  className={
                    strategy.positiveCarrySpreadPct >= 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-amber-600 dark:text-amber-400"
                  }
                >
                  {strategy.positiveCarrySpreadPct >= 0 ? "+" : ""}
                  {strategy.positiveCarrySpreadPct.toFixed(2)}%/năm
                </strong>{" "}
                ({safeYieldRate.toFixed(1)}% gửi tích lũy so với {skyoneLoan.fixedInterestRate}% lãi vay)
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                  <th className="py-2.5 pr-3 font-semibold">Chỉ tiêu tài chính</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Trả sớm từng tháng ngay</th>
                  <th className="py-2.5 pl-3 font-bold text-right text-emerald-700 dark:text-emerald-400">
                    Quỹ Đệm → Đánh chặn 08/2028
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 tabular-nums">
                <tr>
                  <td className="py-3 pr-3 font-medium text-slate-700 dark:text-slate-300">
                    Tổng vốn tích lũy góp vào ({strategy.monthsRemainingFixed} tháng)
                  </td>
                  <td className="py-3 px-3 text-right text-slate-700 dark:text-slate-300">
                    {formatVNDMasked(strategy.bufferPrincipalSaved, isPrivacyMode)}
                  </td>
                  <td className="py-3 pl-3 text-right font-bold text-slate-900 dark:text-slate-100">
                    {formatVNDMasked(strategy.bufferPrincipalSaved, isPrivacyMode)}
                  </td>
                </tr>
                <tr>
                  <td className="py-3 pr-3 font-medium text-slate-700 dark:text-slate-300">
                    Lãi kép sinh ra trên Quỹ Đệm ({safeYieldRate.toFixed(1)}%/năm)
                  </td>
                  <td className="py-3 px-3 text-right text-slate-500 dark:text-slate-400">
                    0 đ (tiền mất thanh khoản ngay)
                  </td>
                  <td className="py-3 pl-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                    +{formatVNDMasked(strategy.bufferInterestEarned, isPrivacyMode)}
                  </td>
                </tr>
                <tr>
                  <td className="py-3 pr-3 font-medium text-slate-700 dark:text-slate-300">
                    Phí phạt trả trước hạn tránh được (năm 2–3 phạt 1,5% → 1,0%)
                  </td>
                  <td className="py-3 px-3 text-right text-rose-600 dark:text-rose-400">
                    Chịu phạt 1,0% – 1,5%
                  </td>
                  <td className="py-3 pl-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                    +{formatVNDMasked(strategy.earlyPenaltyAvoidedAmount, isPrivacyMode)} (năm 4 phí {strategy.penaltyAtResetPct}%)
                  </td>
                </tr>
                <tr>
                  <td className="py-3 pr-3 font-medium text-slate-700 dark:text-slate-300">
                    Lãi vay toàn kỳ tiết kiệm được nhờ giảm dư nợ trước thả nổi
                  </td>
                  <td className="py-3 px-3 text-right text-slate-600 dark:text-slate-300">
                    Thấp hơn (bị mòn bởi phí phạt)
                  </td>
                  <td className="py-3 pl-3 text-right font-bold text-indigo-700 dark:text-indigo-300">
                    {formatShortVNDMasked(strategy.lifetimeInterestSavedByStrike, isPrivacyMode)}
                  </td>
                </tr>
                <tr>
                  <td className="py-3 pr-3 font-bold text-slate-900 dark:text-slate-100">
                    Chênh lệch lợi thế tiền mặt ròng trước kỳ thả nổi
                  </td>
                  <td className="py-3 px-3 text-right text-slate-500 dark:text-slate-400">
                    Mốc đối chiếu
                  </td>
                  <td className="py-3 pl-3 text-right text-sm font-black text-emerald-600 dark:text-emerald-400">
                    {strategy.netStrategyAdvantage >= 0 ? "+" : ""}
                    {formatVNDMasked(strategy.netStrategyAdvantage, isPrivacyMode)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Real Estate Yield & 3-Phase Roadmap */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 p-5 space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-base font-extrabold text-[#0F172A] dark:text-slate-100">
                  04. La bàn BĐS & Lộ trình Hành động
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Phú Đông SKYONE · Mặt tiền ĐT 743C, Dĩ An · Bàn giao dự kiến 2026–2027
                </p>
              </div>
              <Building2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            </div>

            {expectedMonthlyRent > 0 ? (
              <div className="grid grid-cols-3 gap-2.5 text-xs tabular-nums">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/70">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                    Tự nuôi hiện tại
                  </span>
                  <span className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                    {strategy.rentCoverageCurrentPct}%
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/70">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                    Sau giải ngân thêm
                  </span>
                  <span className="text-base font-black text-blue-700 dark:text-blue-400 mt-0.5 block">
                    {strategy.rentCoveragePostDisbursementPct}%
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/70">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                    Sau đánh chặn 08/28
                  </span>
                  <span className="text-base font-black text-indigo-700 dark:text-indigo-300 mt-0.5 block">
                    {strategy.rentCoveragePostResetPct}%
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/70 text-xs text-slate-600 dark:text-slate-300">
                Đang ở chế độ <strong>Ở thực</strong> (kéo thanh Giá thuê dự kiến lên 6,5–9 triệu để mô phỏng phương án cho thuê bù lãi trong 2 năm đầu).
              </div>
            )}

            <ol className="space-y-3 text-xs divide-y divide-slate-100 dark:divide-slate-800">
              <li className="pt-1 space-y-1">
                <p className="font-extrabold text-[#0F172A] dark:text-slate-100">
                  Giai đoạn 1 (Nay – Bàn giao 2027): Giữ thanh khoản tối đa
                </p>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  Không trả gốc sớm khi lãi chỉ {skyoneLoan.fixedInterestRate}% và vẫn còn đợt giải ngân tiếp theo. Trích đều{" "}
                  <strong className="text-slate-800 dark:text-slate-200 tabular-nums">
                    {formatShortVNDMasked(monthlyBufferContribution, isPrivacyMode)}/tháng
                  </strong>{" "}
                  vào sổ tích lũy thanh khoản cao để dự phòng vốn nhận nhà & nội thất.
                </p>
              </li>
              <li className="pt-3 space-y-1">
                <p className="font-extrabold text-[#0F172A] dark:text-slate-100">
                  Giai đoạn 2 (Đúng mốc 08/2028 · Kỳ #36): Cú đánh chặn 1 cục
                </p>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  Tất toán toàn bộ{" "}
                  <strong className="text-emerald-700 dark:text-emerald-400 tabular-nums">
                    {formatShortVNDMasked(strategy.totalBufferAtReset, isPrivacyMode)}
                  </strong>{" "}
                  vào gốc đúng thời điểm sang năm vay thứ 4 (phí phạt {strategy.penaltyAtResetPct}%) ngay trước khi lãi suất thả nổi {projectedFloatingRate.toFixed(1)}% kích hoạt.
                </p>
              </li>
              <li className="pt-3 space-y-1">
                <p className="font-extrabold text-[#0F172A] dark:text-slate-100">
                  Giai đoạn 3 (Từ 09/2028 trở đi): Đàm phán lại hoặc Chuyển nợ (Refinance)
                </p>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  Khi nhận sổ hồng và lãi thả nổi vượt 9,5%, có quyền yêu cầu BIDV PGD Nguyễn Đình Chiểu giữ biên độ ưu đãi hoặc so sánh chuyển ngân hàng khi phí phạt trả trước hạn đã về 0%.
                </p>
              </li>
            </ol>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => switchSubApp("FINANCE", { financeTab: "planning" })}
              className="flex-1 min-h-[40px] px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Lập Quỹ Đệm tại HOME MONI</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setSkyoneTab("PREPAYMENT")}
              className="min-h-[40px] px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
            >
              <TrendingDown className="w-4 h-4" />
              <span>Thử trả gốc trước hạn</span>
            </button>
          </div>
        </div>
      </section>

      <ConfirmDialog
        isOpen={isSyncConfirmOpen}
        title="Nạp hồ sơ BIDV thực tế từ sao kê vào SKYONE?"
        message="Hệ thống sẽ cập nhật thông số vay BIDV PGD Nguyễn Đình Chiểu (TK 8866102943, lãi 5,5%/năm cố định 36 tháng tới 08/2028, gốc đều 3.056.000đ/tháng, Actual/365) và 12 kỳ sao kê đã trả (dư nợ 662.226.193 VND). Toàn bộ giao dịch thu chi trên HOME MONI vẫn được giữ nguyên."
        confirmLabel="Nạp hồ sơ BIDV"
        cancelLabel="Hủy"
        isDanger={false}
        onConfirm={() => {
          resetSkyOneLoan();
          setIsSyncConfirmOpen(false);
          setSyncSuccessToast(
            "Đã đồng bộ trọn bộ hồ sơ BIDV thực tế (662.226.193 VND · 5,5%/năm · 12 kỳ đã thanh toán)."
          );
          setTimeout(() => setSyncSuccessToast(null), 5000);
        }}
        onCancel={() => setIsSyncConfirmOpen(false)}
      />
    </div>
  );
}
