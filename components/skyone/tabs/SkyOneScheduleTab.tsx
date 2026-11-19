"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Check,
  CheckCircle2,
  Clock,
  Lock,
  Save,
  Undo2,
  Unlock,
  X,
} from "lucide-react";
import {
  formatDateVN,
  formatShortVNDMasked,
  formatVNDMasked,
} from "@/lib/formatters";
import {
  buildSkyOneAmortizationChartData,
  generateMortgageSchedule,
  MortgageScheduleRow,
  MortgageScheduleSummary,
  SkyOneTabSpecificMetrics,
} from "@/lib/mortgageEngine";
import {
  MortgageContract,
  MortgagePeriodCashflowOverride,
  MortgageStage,
} from "@/types/finance";

type ScheduleStatusFilter = "ALL" | "VERIFIED" | "UNPAID" | "PAID" | "DUE_OR_OVERDUE";
type ScheduleStageFilter = "ALL" | MortgageStage;
type ScheduleViewMode = "MONTHLY" | "YEARLY";

interface SkyOneScheduleTabProps {
  contract: MortgageContract;
  schedule: MortgageScheduleSummary;
  tabMetrics: SkyOneTabSpecificMetrics;
  isPrivacyMode: boolean;
  highlightPeriod: number | null;
  onClearHighlightPeriod: () => void;
  onSetCashflowLocked: (locked: boolean) => void;
  onSaveAndLockOverrides: (overrides: MortgagePeriodCashflowOverride[]) => void;
  onOpenConfirmPeriods: (periods: number[]) => void;
  onUndoPeriod: (period: number) => void;
}

export function SkyOneScheduleTab({
  contract,
  schedule: lockedSchedule,
  tabMetrics,
  isPrivacyMode,
  highlightPeriod,
  onClearHighlightPeriod,
  onSetCashflowLocked,
  onSaveAndLockOverrides,
  onOpenConfirmPeriods,
  onUndoPeriod,
}: SkyOneScheduleTabProps) {
  const isCashflowLocked = contract.cashflowLocked !== false;
  const [viewMode, setViewMode] = useState<ScheduleViewMode>("MONTHLY");
  const [statusFilter, setStatusFilter] = useState<ScheduleStatusFilter>("ALL");
  const [stageFilter, setStageFilter] = useState<ScheduleStageFilter>("ALL");
  const [yearFilter, setYearFilter] = useState<string>("ALL");
  const [selectedPeriods, setSelectedPeriods] = useState<number[]>([]);
  const [highlightedPeriod, setHighlightedPeriod] = useState<number | null>(null);
  const rowRefs = useRef<Record<number, HTMLElement | null>>({});

  // Draft overrides active while unlocked (per-period editing ONLY — contract terms live in Contract tab)
  const [draftOverrides, setDraftOverrides] = useState<MortgagePeriodCashflowOverride[]>(
    () => contract.periodOverrides || []
  );

  useEffect(() => {
    setDraftOverrides(contract.periodOverrides || []);
  }, [contract.periodOverrides, isCashflowLocked]);

  const overrideMap = useMemo(
    () => new Map(draftOverrides.map((ov) => [ov.period, ov])),
    [draftOverrides]
  );

  const effectiveContract = useMemo(
    () => (isCashflowLocked ? contract : { ...contract, periodOverrides: draftOverrides }),
    [isCashflowLocked, contract, draftOverrides]
  );

  const schedule = useMemo(
    () => (isCashflowLocked ? lockedSchedule : generateMortgageSchedule(effectiveContract)),
    [isCashflowLocked, lockedSchedule, effectiveContract]
  );

  const { milestones } = useMemo(
    () => buildSkyOneAmortizationChartData(effectiveContract, schedule),
    [effectiveContract, schedule]
  );

  // Determine disbursement years for clean yearly markers
  const disbursementByYear = useMemo(() => {
    const map = new Map<number, number>();
    schedule.rows.forEach((row) => {
      if (row.disbursedInPeriod > 0) {
        map.set(row.yearIndex, (map.get(row.yearIndex) || 0) + row.disbursedInPeriod);
      }
    });
    return map;
  }, [schedule.rows]);

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    schedule.rows.forEach((r) => years.add(r.yearIndex));
    return Array.from(years).sort((a, b) => a - b);
  }, [schedule.rows]);

  const filteredRows = useMemo(() => {
    return schedule.rows.filter((row) => {
      if (statusFilter === "VERIFIED" && !row.isVerified) return false;
      if (statusFilter === "UNPAID" && row.status === "PAID") return false;
      if (statusFilter === "PAID" && row.status !== "PAID") return false;
      if (
        statusFilter === "DUE_OR_OVERDUE" &&
        row.status !== "OVERDUE" &&
        row.status !== "DUE_SOON"
      ) {
        return false;
      }
      if (stageFilter !== "ALL" && row.stage !== stageFilter) return false;
      if (yearFilter !== "ALL" && String(row.yearIndex) !== yearFilter) return false;
      return true;
    });
  }, [schedule.rows, statusFilter, stageFilter, yearFilter]);

  const yearlyTotals = useMemo(
    () =>
      schedule.yearlySummary.reduce(
        (acc, y) => ({
          principalPaid: acc.principalPaid + y.principalPaid,
          interestPaid: acc.interestPaid + y.interestPaid,
          totalPaid: acc.totalPaid + y.totalPaid,
          endingBalance: y.endingBalance,
        }),
        { principalPaid: 0, interestPaid: 0, totalPaid: 0, endingBalance: 0 }
      ),
    [schedule.yearlySummary]
  );

  useEffect(() => {
    if (highlightPeriod && highlightPeriod > 0) {
      setViewMode("MONTHLY");
      setStatusFilter("ALL");
      setStageFilter("ALL");
      setYearFilter("ALL");
      setHighlightedPeriod(highlightPeriod);
      const scrollTimer = setTimeout(() => {
        const targetEl = rowRefs.current[highlightPeriod];
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        onClearHighlightPeriod();
      }, 150);
      const clearTimer = setTimeout(() => setHighlightedPeriod(null), 3500);
      return () => {
        clearTimeout(scrollTimer);
        clearTimeout(clearTimer);
      };
    }
  }, [highlightPeriod, onClearHighlightPeriod]);

  const jumpToPeriod = (period: number) => {
    setViewMode("MONTHLY");
    setStatusFilter("ALL");
    setStageFilter("ALL");
    setYearFilter("ALL");
    setHighlightedPeriod(period);
    setTimeout(() => {
      const targetEl = rowRefs.current[period];
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 100);
    setTimeout(() => setHighlightedPeriod(null), 3500);
  };

  const upsertOverride = (
    period: number,
    patch: Partial<MortgagePeriodCashflowOverride>
  ) => {
    setDraftOverrides((prev) => {
      const idx = prev.findIndex((ov) => ov.period === period);
      if (idx === -1) {
        return [...prev, { period, ...patch }].sort((a, b) => a.period - b.period);
      }
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  const clearOverride = (period: number) => {
    setDraftOverrides((prev) => prev.filter((ov) => ov.period !== period));
  };

  const togglePeriodSelection = (period: number) => {
    setSelectedPeriods((prev) =>
      prev.includes(period) ? prev.filter((p) => p !== period) : [...prev, period]
    );
  };

  const selectUpToCurrentPeriods = () => {
    const dueRows = schedule.rows
      .filter((r) => r.status === "OVERDUE" || r.status === "DUE_SOON")
      .map((r) => r.period);
    if (dueRows.length > 0) {
      setSelectedPeriods(dueRows);
    } else if (schedule.nextUnpaidInstallment) {
      setSelectedPeriods([schedule.nextUnpaidInstallment.period]);
    }
  };

  const interestDelta = schedule.totalProjectedInterest - lockedSchedule.totalProjectedInterest;

  const renderStatusLabel = (row: MortgageScheduleRow) => {
    if (row.status === "PAID") {
      if (row.isVerified) {
        return (
          <span
            data-testid="installment-verified-badge"
            title={row.verifiedSource || "Đối soát sao kê BIDV SmartBanking · TK ****2943"}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 whitespace-nowrap"
          >
            <BadgeCheck className="w-3.5 h-3.5 shrink-0" />
            Đã xác thực
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 whitespace-nowrap">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          Đã đóng
        </span>
      );
    }
    if (row.status === "OVERDUE") {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 dark:text-rose-300 whitespace-nowrap">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          Quá hạn {Math.abs(row.daysUntilDue)}n
        </span>
      );
    }
    if (row.status === "DUE_SOON") {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-300 whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          {row.daysUntilDue === 0 ? "Hôm nay" : `Còn ${row.daysUntilDue} ngày`}
        </span>
      );
    }
    return (
      <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
        Chưa đến kỳ
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Statement Reconciliation 4-KPI Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5 sm:gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 shadow-xs p-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
            <span>Tiến độ đối soát</span>
            <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 tabular-nums">
              {schedule.verifiedCount} Đã xác thực
            </span>
          </div>
          <p className="text-lg sm:text-xl font-black text-[#0F172A] dark:text-slate-100 tabular-nums">
            {schedule.paidCount}/{schedule.totalScheduledMonths} kỳ
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
            3 kỳ đầu Đợt 1 + {schedule.verifiedCount} kỳ sao kê · Còn {schedule.unpaidCount} kỳ
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 shadow-xs p-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
            <span>Tổng gốc &amp; lãi đã trả</span>
            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">Thực tế</span>
          </div>
          <p className="text-lg sm:text-xl font-black text-emerald-700 dark:text-emerald-400 tabular-nums">
            {formatVNDMasked(schedule.totalPrincipalPaid + schedule.totalInterestPaid, isPrivacyMode)}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
            Gốc {formatShortVNDMasked(schedule.totalPrincipalPaid, isPrivacyMode)} · Lãi{" "}
            {formatShortVNDMasked(schedule.totalInterestPaid, isPrivacyMode)}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 shadow-xs p-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
            <span>Chi phí lãi toàn vòng đời</span>
            <span className="text-[11px] font-bold text-blue-700 dark:text-blue-400 tabular-nums">
              {tabMetrics.interestToPrincipalRatioPct}% / gốc
            </span>
          </div>
          <p className="text-lg sm:text-xl font-black text-[#1E3A8A] dark:text-blue-300 tabular-nums">
            {formatVNDMasked(schedule.totalProjectedInterest, isPrivacyMode)}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
            {tabMetrics.principalExceedsInterestPeriod
              ? `Gốc vượt lãi từ kỳ #${tabMetrics.principalExceedsInterestPeriod.period}`
              : "Lãi lớn hơn gốc hàng kỳ"}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 shadow-xs p-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
            <span>
              {schedule.nextUnpaidInstallment
                ? `Kỳ đối soát tiếp theo #${schedule.nextUnpaidInstallment.period}`
                : "Trạng thái đối soát"}
            </span>
            {schedule.nextUnpaidInstallment && (
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 tabular-nums">
                {formatDateVN(schedule.nextUnpaidInstallment.dueDate)}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-lg sm:text-xl font-black text-[#0F172A] dark:text-slate-100 tabular-nums">
              {schedule.nextUnpaidInstallment
                ? formatVNDMasked(schedule.nextUnpaidInstallment.totalPayment, isPrivacyMode)
                : "Hoàn tất 100%"}
            </p>
            {schedule.nextUnpaidInstallment && (
              <button
                type="button"
                onClick={() => onOpenConfirmPeriods([schedule.nextUnpaidInstallment!.period])}
                className="min-h-[30px] px-2.5 py-1 rounded-lg bg-[#1E3A8A] hover:bg-blue-900 dark:bg-blue-600 dark:hover:bg-blue-700 text-white text-[11px] font-bold inline-flex items-center gap-1 shrink-0 transition-colors whitespace-nowrap cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Đóng kỳ #{schedule.nextUnpaidInstallment.period}</span>
              </button>
            )}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
            {schedule.nextUnpaidInstallment
              ? `Gốc ${formatShortVNDMasked(schedule.nextUnpaidInstallment.principal, isPrivacyMode)} + Lãi ${formatShortVNDMasked(schedule.nextUnpaidInstallment.interest, isPrivacyMode)}`
              : "Toàn bộ các kỳ đã được đối soát hoàn chỉnh"}
          </p>
        </div>
      </section>

      {/* Unified View Switcher + Filter & Per-Period Lock Toolbar */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 shadow-xs p-4 space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          {/* Segmented View Switcher: Monthly vs Yearly */}
          <div
            role="group"
            aria-label="Chuyển đổi góc nhìn lịch trả nợ"
            className="inline-flex items-center rounded-lg bg-slate-100 dark:bg-slate-800 p-1 border border-[#DCE4EE] dark:border-slate-700 self-start"
          >
            <button
              type="button"
              data-testid="skyone-schedule-mode-monthly"
              aria-pressed={viewMode === "MONTHLY"}
              onClick={() => setViewMode("MONTHLY")}
              className={`min-h-[36px] px-3.5 py-1.5 rounded-md text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                viewMode === "MONTHLY"
                  ? "bg-white dark:bg-slate-900 text-[#1E3A8A] dark:text-blue-300 shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Theo Tháng ({schedule.rows.length} kỳ)
            </button>
            <button
              type="button"
              data-testid="skyone-schedule-mode-yearly"
              aria-pressed={viewMode === "YEARLY"}
              onClick={() => setViewMode("YEARLY")}
              className={`min-h-[36px] px-3.5 py-1.5 rounded-md text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                viewMode === "YEARLY"
                  ? "bg-white dark:bg-slate-900 text-[#1E3A8A] dark:text-blue-300 shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Theo Năm ({schedule.yearlySummary.length} năm)
            </button>
          </div>

          {/* Single Per-Period Lock Control */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {isCashflowLocked ? (
              <button
                type="button"
                data-testid="skyone-schedule-unlock-btn"
                onClick={() => {
                  onSetCashflowLocked(false);
                  setViewMode("MONTHLY");
                }}
                className="min-h-[38px] px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-200 text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <Unlock className="w-3.5 h-3.5" />
                <span>Mở khóa sửa từng kỳ</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  data-testid="skyone-schedule-cancel-lock-btn"
                  onClick={() => {
                    setDraftOverrides(contract.periodOverrides || []);
                    onSetCashflowLocked(true);
                  }}
                  className="min-h-[38px] px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Hủy &amp; Khóa lại</span>
                </button>
                <button
                  type="button"
                  data-testid="skyone-schedule-save-lock-btn"
                  onClick={() => onSaveAndLockOverrides(draftOverrides)}
                  className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-[#1E3A8A] hover:bg-blue-900 dark:bg-blue-600 dark:hover:bg-blue-700 text-white text-xs font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Lưu &amp; Khóa lại</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Status notice for per-period lock */}
        {!isCashflowLocked ? (
          <div className="rounded-lg bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 px-3 py-2 text-xs text-indigo-950 dark:text-indigo-100 flex flex-wrap items-center justify-between gap-2 tabular-nums">
            <span>
              Đang mở khóa sửa từng kỳ: nhập trực tiếp <strong>Lãi suất (%)</strong>,{" "}
              <strong>Trả Gốc</strong>, <strong>Lãi trả nợ</strong> bên dưới (tham số gốc hợp đồng chỉnh tại tab{" "}
              <strong>Hợp đồng</strong>).
            </span>
            <span className="font-bold">
              {draftOverrides.length} kỳ chỉnh tay
              {interestDelta !== 0 && (
                <span
                  className={`ml-1.5 ${
                    interestDelta < 0
                      ? "text-emerald-700 dark:text-emerald-300"
                      : "text-amber-700 dark:text-amber-300"
                  }`}
                >
                  · Lãi {interestDelta > 0 ? "+" : "-"}
                  {formatVNDMasked(Math.abs(interestDelta), isPrivacyMode)}
                </span>
              )}
            </span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 shrink-0" />
              <span>
                Đang khóa chỉnh tay từng kỳ để bảo vệ đối soát sao kê BIDV.
                {(contract.periodOverrides || []).length > 0 && (
                  <strong className="ml-1 text-indigo-700 dark:text-indigo-300">
                    ({contract.periodOverrides!.length} kỳ đang dùng số điều chỉnh)
                  </strong>
                )}
              </span>
            </span>
            {viewMode === "YEARLY" && (
              <span>Bấm vào bất kỳ năm nào bên dưới để xem chi tiết từng tháng của năm đó.</span>
            )}
          </div>
        )}

        {/* Monthly Filters & Batch Actions */}
        {viewMode === "MONTHLY" && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              <div>
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                  Trạng thái kỳ
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as ScheduleStatusFilter)}
                  className="w-full min-h-[40px] px-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-blue-600"
                >
                  <option value="ALL">Tất cả ({schedule.rows.length} kỳ)</option>
                  <option value="VERIFIED">Đã xác thực ({schedule.verifiedCount} kỳ sao kê BIDV)</option>
                  <option value="UNPAID">Chưa đóng ({schedule.unpaidCount})</option>
                  <option value="PAID">Đã đóng ({schedule.paidCount})</option>
                  <option value="DUE_OR_OVERDUE">
                    Sắp đến hạn / Quá hạn ({schedule.overdueCount + schedule.dueSoonCount})
                  </option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                  Giai đoạn lãi suất
                </label>
                <select
                  value={stageFilter}
                  onChange={(e) => setStageFilter(e.target.value as ScheduleStageFilter)}
                  className="w-full min-h-[40px] px-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-blue-600"
                >
                  <option value="ALL">Tất cả giai đoạn</option>
                  <option value="FIXED">Lãi cố định ưu đãi</option>
                  <option value="FLOATING">Lãi thả nổi</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                  Năm vay
                </label>
                <select
                  value={yearFilter}
                  onChange={(e) => setYearFilter(e.target.value)}
                  className="w-full min-h-[40px] px-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-blue-600"
                >
                  <option value="ALL">Tất cả {availableYears.length} năm</option>
                  {availableYears.map((yr) => (
                    <option key={yr} value={String(yr)}>
                      Năm thứ {yr}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => jumpToPeriod(schedule.currentReferencePeriod)}
                  className="w-full min-h-[40px] px-3 rounded-lg bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200 text-xs font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>Nhảy tới kỳ #{schedule.currentReferencePeriod}</span>
                </button>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {schedule.verifiedCount > 0 && (
                  <button
                    type="button"
                    data-testid="filter-verified-quick-btn"
                    onClick={() =>
                      setStatusFilter((prev) => (prev === "VERIFIED" ? "ALL" : "VERIFIED"))
                    }
                    className={`min-h-[36px] px-3 py-1.5 rounded-lg font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap ${
                      statusFilter === "VERIFIED"
                        ? "bg-emerald-600 text-white"
                        : "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
                    }`}
                  >
                    <BadgeCheck className="w-3.5 h-3.5 shrink-0" />
                    <span>Sao kê Đã xác thực ({schedule.verifiedCount})</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={selectUpToCurrentPeriods}
                  className="min-h-[36px] px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-bold text-xs whitespace-nowrap cursor-pointer"
                >
                  Chọn các kỳ đến hạn
                </button>
                {selectedPeriods.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedPeriods([])}
                    className="min-h-[36px] px-2.5 py-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 font-semibold text-xs whitespace-nowrap cursor-pointer"
                  >
                    Bỏ chọn ({selectedPeriods.length})
                  </button>
                )}
              </div>

              {selectedPeriods.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenConfirmPeriods(selectedPeriods);
                    setSelectedPeriods([]);
                  }}
                  className="min-h-[38px] px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold inline-flex items-center gap-1.5 shadow-xs whitespace-nowrap cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Xác nhận đóng {selectedPeriods.length} kỳ đã chọn</span>
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* YEARLY AMORTIZATION TABLE */}
      {viewMode === "YEARLY" && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold">
                  <th className="py-3 px-4">Năm vay</th>
                  <th className="py-3 px-3 text-right">Dư nợ đầu kỳ</th>
                  <th className="py-3 px-3 text-right">Gốc trả</th>
                  <th className="py-3 px-3 text-right">Lãi trả nợ</th>
                  <th className="py-3 px-3 text-right">Tổng đóng</th>
                  <th className="py-3 px-4 text-right">Dư nợ cuối kỳ &amp; Equity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {schedule.yearlySummary.map((yr) => {
                  const isCurrentYear = milestones.currentYearIndex === yr.yearIndex;
                  const isFixedEndYear = milestones.fixedEndYearIndex === yr.yearIndex;
                  const isEquity50Year = milestones.equity50YearIndex === yr.yearIndex;
                  const disbursedAmt = disbursementByYear.get(yr.yearIndex) || 0;

                  const markers: string[] = [];
                  if (isCurrentYear) markers.push("Hiện tại");
                  if (disbursedAmt > 0) {
                    markers.push(`+Giải ngân ${formatShortVNDMasked(disbursedAmt, isPrivacyMode)}`);
                  }
                  if (isFixedEndYear) markers.push("Hết ưu đãi 5,5%");
                  if (isEquity50Year) markers.push("Equity ≥50%");

                  return (
                    <tr
                      key={yr.yearIndex}
                      onClick={() => {
                        setYearFilter(String(yr.yearIndex));
                        setViewMode("MONTHLY");
                      }}
                      title={`Xem chi tiết các tháng của ${yr.label}`}
                      className={`transition-colors cursor-pointer hover:bg-slate-50/90 dark:hover:bg-slate-800/50 ${
                        isCurrentYear ? "bg-blue-50/45 dark:bg-blue-950/30" : ""
                      }`}
                    >
                      <td className="py-3 px-4 align-middle">
                        <div className="font-bold text-[#172B4D] dark:text-slate-100 whitespace-nowrap">
                          {yr.label}
                        </div>
                        {markers.length > 0 && (
                          <div className="text-[10px] font-semibold text-indigo-700 dark:text-indigo-300 mt-0.5 whitespace-nowrap">
                            {markers.join(" · ")}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-medium text-slate-700 dark:text-slate-300 tabular-nums whitespace-nowrap">
                        {formatVNDMasked(yr.openingBalance, isPrivacyMode)}
                      </td>
                      <td className="py-3 px-3 text-right font-semibold text-[#2563EB] dark:text-blue-400 tabular-nums whitespace-nowrap">
                        {formatVNDMasked(yr.principalPaid, isPrivacyMode)}
                      </td>
                      <td className="py-3 px-3 text-right font-semibold text-amber-700 dark:text-amber-300 tabular-nums whitespace-nowrap">
                        {formatVNDMasked(yr.interestPaid, isPrivacyMode)}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-[#172B4D] dark:text-slate-100 tabular-nums whitespace-nowrap">
                        {formatVNDMasked(yr.totalPaid, isPrivacyMode)}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums whitespace-nowrap">
                        <div className="font-semibold text-[#A21CAF] dark:text-fuchsia-300">
                          {formatVNDMasked(yr.endingBalance, isPrivacyMode)}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">
                          Equity {yr.equityPercent.toFixed(1)}%
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 font-bold text-xs tabular-nums">
                  <td className="py-3 px-4 text-[#172B4D] dark:text-slate-100 whitespace-nowrap">
                    Tổng cộng ({schedule.yearlySummary.length} năm)
                  </td>
                  <td className="py-3 px-3 text-right text-slate-400">—</td>
                  <td className="py-3 px-3 text-right text-[#2563EB] dark:text-blue-400 whitespace-nowrap">
                    {formatVNDMasked(yearlyTotals.principalPaid, isPrivacyMode)}
                  </td>
                  <td className="py-3 px-3 text-right text-amber-700 dark:text-amber-300 whitespace-nowrap">
                    {formatVNDMasked(yearlyTotals.interestPaid, isPrivacyMode)}
                  </td>
                  <td className="py-3 px-3 text-right text-[#172B4D] dark:text-slate-100 whitespace-nowrap">
                    {formatVNDMasked(yearlyTotals.totalPaid, isPrivacyMode)}
                  </td>
                  <td className="py-3 px-4 text-right text-[#A21CAF] dark:text-fuchsia-300 whitespace-nowrap">
                    {formatVNDMasked(yearlyTotals.endingBalance, isPrivacyMode)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* MONTHLY SCHEDULE: DESKTOP TABLE + MOBILE CARDS */}
      {viewMode === "MONTHLY" && (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="overflow-x-auto max-h-[620px]">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0 z-10 border-b border-[#DCE4EE] dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold">
                  <tr>
                    <th className="py-3 pl-4 pr-2 w-8" />
                    <th className="py-3 px-2">Kỳ</th>
                    <th className="py-3 px-2">Ngày hạn</th>
                    <th className="py-3 px-2">Giai đoạn</th>
                    <th className="py-3 px-2 text-right">Lãi suất</th>
                    <th className="py-3 px-2 text-right">Dư đầu kỳ</th>
                    <th className="py-3 px-2 text-right">Trả Gốc</th>
                    <th className="py-3 px-2 text-right">Trả Lãi</th>
                    <th className="py-3 px-2 text-right">Tổng đóng</th>
                    <th className="py-3 px-2 text-right">Dư cuối kỳ</th>
                    <th className="py-3 px-2">Trạng thái</th>
                    <th className="py-3 pl-2 pr-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="py-10 text-center text-slate-400 font-semibold">
                        Không có kỳ trả nợ nào khớp với bộ lọc hiện tại.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row) => {
                      const isChecked = selectedPeriods.includes(row.period);
                      const isHighlighted = highlightedPeriod === row.period;
                      const ov = overrideMap.get(row.period);
                      return (
                        <tr
                          key={row.period}
                          ref={(el) => {
                            rowRefs.current[row.period] = el;
                          }}
                          className={`transition-colors ${
                            isHighlighted
                              ? "bg-blue-100/80 dark:bg-blue-900/40 ring-1 ring-inset ring-blue-400"
                              : row.disbursedInPeriod > 0
                              ? "bg-indigo-50/50 dark:bg-indigo-950/35 hover:bg-indigo-50/80 dark:hover:bg-indigo-950/55"
                              : ov || row.isCashflowOverridden
                              ? "bg-indigo-50/35 dark:bg-indigo-950/25 hover:bg-indigo-50/60"
                              : row.status === "PAID"
                              ? "bg-emerald-50/20 dark:bg-emerald-950/20 hover:bg-emerald-50/40"
                              : row.status === "OVERDUE"
                              ? "bg-rose-50/40 dark:bg-rose-950/30 hover:bg-rose-50/60"
                              : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                          }`}
                        >
                          <td className="py-2.5 pl-4 pr-2">
                            {row.status !== "PAID" && (
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => togglePeriodSelection(row.period)}
                                aria-label={`Chọn kỳ ${row.period}`}
                                className="w-4 h-4 accent-blue-600 cursor-pointer"
                              />
                            )}
                          </td>
                          <td className="py-2.5 px-2 font-extrabold text-slate-900 dark:text-slate-100 tabular-nums">
                            #{row.period}
                            {row.period <= 3 && (
                              <span className="block text-[10px] font-medium text-slate-500 dark:text-slate-400">
                                3 kỳ đầu Đ1
                              </span>
                            )}
                            {row.isCashflowOverridden && (
                              <span
                                title={row.overrideNote || "Đã chỉnh tay dòng tiền"}
                                className="block text-[10px] font-bold text-indigo-700 dark:text-indigo-300"
                              >
                                Đã chỉnh tay
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-2 text-slate-700 dark:text-slate-300 tabular-nums whitespace-nowrap">
                            {formatDateVN(row.dueDate)}
                          </td>
                          <td className="py-2.5 px-2 whitespace-nowrap">
                            <span
                              className={`text-[11px] font-bold ${
                                row.stage === "FIXED"
                                  ? "text-blue-700 dark:text-blue-300"
                                  : "text-amber-700 dark:text-amber-300"
                              }`}
                            >
                              {row.stage === "FIXED" ? "Cố định" : "Thả nổi"}
                            </span>
                          </td>
                          <td className="py-2.5 px-2 text-right font-semibold text-slate-700 dark:text-slate-200 tabular-nums">
                            {!isCashflowLocked ? (
                              <input
                                type="number"
                                step="0.05"
                                min={0}
                                max={35}
                                aria-label={`Lãi suất kỳ ${row.period}`}
                                value={
                                  ov?.appliedRate !== undefined
                                    ? ov.appliedRate
                                    : Number(row.appliedRate.toFixed(2))
                                }
                                onChange={(e) =>
                                  upsertOverride(row.period, {
                                    appliedRate: Math.max(0, Number(e.target.value) || 0),
                                  })
                                }
                                className="w-16 h-8 px-1.5 rounded border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-900 text-right font-bold tabular-nums"
                              />
                            ) : (
                              <>
                                {row.appliedRate.toFixed(2)}%
                                {row.isCustomRateAdjusted && (
                                  <span
                                    title={row.rateNote || "Mốc điều chỉnh lãi suất ngân hàng"}
                                    className="ml-1 text-[10px] text-indigo-600 dark:text-indigo-400 font-bold"
                                  >
                                    *
                                  </span>
                                )}
                              </>
                            )}
                          </td>
                          <td className="py-2.5 px-2 text-right text-slate-600 dark:text-slate-300 tabular-nums whitespace-nowrap">
                            {formatVNDMasked(row.openingBalance, isPrivacyMode, false)}
                          </td>
                          <td className="py-2.5 px-2 text-right font-semibold text-blue-700 dark:text-blue-400 tabular-nums whitespace-nowrap">
                            {!isCashflowLocked ? (
                              <input
                                type="number"
                                min={0}
                                step={10000}
                                aria-label={`Trả gốc kỳ ${row.period}`}
                                value={ov?.principal !== undefined ? ov.principal : row.principal}
                                onChange={(e) =>
                                  upsertOverride(row.period, {
                                    principal: Math.max(0, Math.round(Number(e.target.value) || 0)),
                                  })
                                }
                                className="w-28 h-8 px-2 rounded border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-900 text-right font-bold tabular-nums"
                              />
                            ) : (
                              formatVNDMasked(row.principal, isPrivacyMode, false)
                            )}
                            {row.prepaidInPeriod > 0 && (
                              <span className="block text-[10px] text-emerald-700 dark:text-emerald-300 font-bold">
                                +{formatShortVNDMasked(row.prepaidInPeriod, isPrivacyMode)} trước hạn
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-2 text-right font-semibold text-amber-700 dark:text-amber-300 tabular-nums whitespace-nowrap">
                            {!isCashflowLocked ? (
                              <input
                                type="number"
                                min={0}
                                step={10000}
                                aria-label={`Lãi trả nợ kỳ ${row.period}`}
                                value={ov?.interest !== undefined ? ov.interest : row.interest}
                                onChange={(e) =>
                                  upsertOverride(row.period, {
                                    interest: Math.max(0, Math.round(Number(e.target.value) || 0)),
                                  })
                                }
                                className="w-28 h-8 px-2 rounded border border-amber-400 dark:border-amber-700 bg-white dark:bg-slate-900 text-right font-bold tabular-nums"
                              />
                            ) : (
                              formatVNDMasked(row.interest, isPrivacyMode, false)
                            )}
                          </td>
                          <td className="py-2.5 px-2 text-right font-black text-slate-900 dark:text-slate-100 tabular-nums whitespace-nowrap">
                            {formatVNDMasked(row.totalPayment, isPrivacyMode, false)}
                          </td>
                          <td className="py-2.5 px-2 text-right text-slate-700 dark:text-slate-300 tabular-nums whitespace-nowrap">
                            <div>{formatVNDMasked(row.closingBalance, isPrivacyMode, false)}</div>
                            {row.disbursedInPeriod > 0 && (
                              <div
                                data-testid={`schedule-disbursement-note-${row.period}`}
                                className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 mt-0.5"
                              >
                                +Giải ngân {formatShortVNDMasked(row.disbursedInPeriod, isPrivacyMode)}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-2">{renderStatusLabel(row)}</td>
                          <td className="py-2.5 pl-2 pr-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              {!isCashflowLocked && ov && (
                                <button
                                  type="button"
                                  onClick={() => clearOverride(row.period)}
                                  title="Khôi phục số mặc định cho kỳ này"
                                  className="px-2 py-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 text-[11px] font-semibold cursor-pointer"
                                >
                                  Mặc định
                                </button>
                              )}
                              {row.status === "PAID" ? (
                                <button
                                  type="button"
                                  onClick={() => onUndoPeriod(row.period)}
                                  className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <Undo2 className="w-3 h-3" />
                                  Hoàn tác
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => onOpenConfirmPeriods([row.period])}
                                  className="px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold cursor-pointer"
                                >
                                  Xác nhận đóng
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Touch Card Stack */}
          <div className="md:hidden space-y-2.5">
            {filteredRows.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 p-6 text-center text-xs text-slate-400 font-semibold">
                Không có kỳ trả nợ nào khớp với bộ lọc hiện tại.
              </div>
            ) : (
              filteredRows.slice(0, 60).map((row) => {
                const isChecked = selectedPeriods.includes(row.period);
                const isHighlighted = highlightedPeriod === row.period;
                const ov = overrideMap.get(row.period);
                return (
                  <div
                    key={row.period}
                    ref={(el) => {
                      rowRefs.current[row.period] = el;
                    }}
                    className={`rounded-xl border p-3.5 space-y-2.5 bg-white dark:bg-slate-900 ${
                      isHighlighted
                        ? "border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800"
                        : row.disbursedInPeriod > 0
                        ? "border-indigo-300 dark:border-indigo-700 bg-indigo-50/30 dark:bg-indigo-950/30"
                        : ov || row.isCashflowOverridden
                        ? "border-indigo-300 dark:border-indigo-700 bg-indigo-50/20"
                        : row.status === "OVERDUE"
                        ? "border-rose-200 dark:border-rose-800 bg-rose-50/30 dark:bg-rose-950/30"
                        : "border-[#DCE4EE] dark:border-slate-800"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        {row.status !== "PAID" && (
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => togglePeriodSelection(row.period)}
                            aria-label={`Chọn kỳ ${row.period}`}
                            className="w-4 h-4 accent-blue-600"
                          />
                        )}
                        <div>
                          <span className="text-sm font-black text-slate-900 dark:text-slate-100 tabular-nums">
                            Kỳ #{row.period} · {formatDateVN(row.dueDate)}
                          </span>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                            {row.stage === "FIXED" ? "Lãi cố định" : "Lãi thả nổi"} ·{" "}
                            {row.appliedRate.toFixed(2)}%/năm
                            {row.isCashflowOverridden && (
                              <span className="ml-1.5 font-bold text-indigo-700 dark:text-indigo-300">
                                · Đã chỉnh tay
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      {renderStatusLabel(row)}
                    </div>

                    {row.disbursedInPeriod > 0 && (
                      <div className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 rounded-lg px-2.5 py-1.5 tabular-nums">
                        +Giải ngân trong kỳ: {formatVNDMasked(row.disbursedInPeriod, isPrivacyMode)}
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Trả Gốc</span>
                        {!isCashflowLocked ? (
                          <input
                            type="number"
                            min={0}
                            step={10000}
                            aria-label={`Trả gốc kỳ ${row.period}`}
                            value={ov?.principal !== undefined ? ov.principal : row.principal}
                            onChange={(e) =>
                              upsertOverride(row.period, {
                                principal: Math.max(0, Math.round(Number(e.target.value) || 0)),
                              })
                            }
                            className="mt-0.5 w-full h-8 px-1.5 rounded border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-900 font-bold text-blue-700 dark:text-blue-400 tabular-nums"
                          />
                        ) : (
                          <span className="font-bold text-blue-700 dark:text-blue-400 tabular-nums">
                            {formatVNDMasked(row.principal, isPrivacyMode)}
                          </span>
                        )}
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Lãi trả nợ</span>
                        {!isCashflowLocked ? (
                          <input
                            type="number"
                            min={0}
                            step={10000}
                            aria-label={`Lãi trả nợ kỳ ${row.period}`}
                            value={ov?.interest !== undefined ? ov.interest : row.interest}
                            onChange={(e) =>
                              upsertOverride(row.period, {
                                interest: Math.max(0, Math.round(Number(e.target.value) || 0)),
                              })
                            }
                            className="mt-0.5 w-full h-8 px-1.5 rounded border border-amber-400 dark:border-amber-700 bg-white dark:bg-slate-900 font-bold text-amber-700 dark:text-amber-300 tabular-nums"
                          />
                        ) : (
                          <span className="font-bold text-amber-700 dark:text-amber-300 tabular-nums">
                            {formatVNDMasked(row.interest, isPrivacyMode)}
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block">Tổng đóng</span>
                        <span className="font-black text-slate-900 dark:text-slate-100 tabular-nums">
                          {formatVNDMasked(row.totalPayment, isPrivacyMode)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                        Dư cuối kỳ: {formatVNDMasked(row.closingBalance, isPrivacyMode)}
                      </span>
                      {row.status === "PAID" ? (
                        <button
                          type="button"
                          onClick={() => onUndoPeriod(row.period)}
                          className="min-h-[40px] px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold inline-flex items-center gap-1"
                        >
                          <Undo2 className="w-3.5 h-3.5" />
                          Hoàn tác
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onOpenConfirmPeriods([row.period])}
                          className="min-h-[40px] px-3.5 py-1.5 rounded-lg bg-[#1E3A8A] dark:bg-blue-600 text-white text-xs font-bold"
                        >
                          Xác nhận đóng
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            {filteredRows.length > 60 && (
              <p className="text-center text-xs text-slate-500 dark:text-slate-400 py-2">
                Đang hiển thị 60 kỳ đầu theo bộ lọc. Dùng bộ lọc Năm vay hoặc chế độ Theo Năm để xem nhanh các năm sau.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
