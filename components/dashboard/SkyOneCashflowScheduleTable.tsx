"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Lock,
  RotateCcw,
  Save,
  SlidersHorizontal,
  Table2,
  Unlock,
  X,
} from "lucide-react";
import {
  buildSkyOneAmortizationChartData,
  generateMortgageSchedule,
  MAX_MORTGAGE_TERM_MONTHS,
  MAX_MORTGAGE_TERM_YEARS,
  MortgageScheduleRow,
  MortgageScheduleSummary,
} from "@/lib/mortgageEngine";
import { formatDateVN, formatVNDMasked } from "@/lib/formatters";
import {
  MortgageContract,
  MortgageInterestBasis,
  MortgagePeriodCashflowOverride,
} from "@/types/finance";

export type CashflowGranularity = "YEARLY" | "MONTHLY";

export interface SkyOneCashflowScheduleTableProps {
  contract: MortgageContract;
  schedule: MortgageScheduleSummary;
  isPrivacyMode: boolean;
  isLocked?: boolean;
  onSetLocked?: (locked: boolean) => void;
  onSaveAndLock?: (input: {
    contractPatch?: Partial<MortgageContract>;
    periodOverrides: MortgagePeriodCashflowOverride[];
  }) => void;
}

const MONTHS_PAGE_SIZE = 12;

function getStatusLabel(status: MortgageScheduleRow["status"]): {
  text: string;
  className: string;
} {
  switch (status) {
    case "PAID":
      return {
        text: "Đã đóng",
        className: "text-emerald-700 dark:text-emerald-300",
      };
    case "OVERDUE":
      return {
        text: "Quá hạn",
        className: "text-rose-700 dark:text-rose-300",
      };
    case "DUE_SOON":
      return {
        text: "Sắp đến hạn",
        className: "text-amber-700 dark:text-amber-300",
      };
    default:
      return {
        text: "Chờ đóng",
        className: "text-slate-500 dark:text-slate-400",
      };
  }
}

export function SkyOneCashflowScheduleTable({
  contract,
  schedule,
  isPrivacyMode,
  isLocked: controlledLocked,
  onSetLocked,
  onSaveAndLock,
}: SkyOneCashflowScheduleTableProps) {
  const isLocked =
    controlledLocked !== undefined ? controlledLocked : contract.cashflowLocked !== false;
  const canAdjustLock = Boolean(onSaveAndLock);

  const [granularity, setGranularity] = useState<CashflowGranularity>("YEARLY");
  const [selectedYear, setSelectedYear] = useState<string>("ALL");
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Draft state active while unlocked
  const [draftTermMonths, setDraftTermMonths] = useState<number>(
    Math.min(MAX_MORTGAGE_TERM_MONTHS, Math.max(12, contract.termMonths || 360))
  );
  const [draftMonthlyPrincipal, setDraftMonthlyPrincipal] = useState<number>(
    contract.monthlyPrincipalOverride ?? 0
  );
  const [draftFixedRate, setDraftFixedRate] = useState<number>(contract.fixedInterestRate);
  const [draftFloatingBase, setDraftFloatingBase] = useState<number>(contract.floatingBaseRate);
  const [draftFloatingSpread, setDraftFloatingSpread] = useState<number>(contract.floatingSpread);
  const [draftBasis, setDraftBasis] = useState<MortgageInterestBasis>(
    contract.interestBasis || "ACTUAL_365"
  );
  const [draftOverrides, setDraftOverrides] = useState<MortgagePeriodCashflowOverride[]>(
    contract.periodOverrides || []
  );

  // Sync draft when contract changes or lock state resets to locked
  useEffect(() => {
    setDraftTermMonths(
      Math.min(MAX_MORTGAGE_TERM_MONTHS, Math.max(12, contract.termMonths || 360))
    );
    setDraftMonthlyPrincipal(contract.monthlyPrincipalOverride ?? 0);
    setDraftFixedRate(contract.fixedInterestRate);
    setDraftFloatingBase(contract.floatingBaseRate);
    setDraftFloatingSpread(contract.floatingSpread);
    setDraftBasis(contract.interestBasis || "ACTUAL_365");
    setDraftOverrides(contract.periodOverrides || []);
  }, [contract, isLocked]);

  const draftContract = useMemo<MortgageContract>(() => {
    if (isLocked) return contract;
    const cleanTerm = Math.max(12, Math.min(MAX_MORTGAGE_TERM_MONTHS, Math.round(draftTermMonths)));
    return {
      ...contract,
      termMonths: cleanTerm,
      fixedRateMonths: Math.min(contract.fixedRateMonths, cleanTerm),
      monthlyPrincipalOverride: Math.max(0, Math.round(draftMonthlyPrincipal)),
      fixedInterestRate: Math.max(0, draftFixedRate),
      floatingBaseRate: Math.max(0, draftFloatingBase),
      floatingSpread: Math.max(0, draftFloatingSpread),
      interestBasis: draftBasis,
      periodOverrides: draftOverrides,
      cashflowLocked: false,
    };
  }, [
    isLocked,
    contract,
    draftTermMonths,
    draftMonthlyPrincipal,
    draftFixedRate,
    draftFloatingBase,
    draftFloatingSpread,
    draftBasis,
    draftOverrides,
  ]);

  const activeSchedule = useMemo(
    () => (isLocked ? schedule : generateMortgageSchedule(draftContract)),
    [isLocked, schedule, draftContract]
  );

  const overrideMap = useMemo(
    () => new Map(draftOverrides.map((ov) => [ov.period, ov])),
    [draftOverrides]
  );

  const { milestones } = useMemo(
    () => buildSkyOneAmortizationChartData(draftContract, activeSchedule),
    [draftContract, activeSchedule]
  );

  const availableYears = useMemo(
    () => activeSchedule.yearlySummary.map((y) => y.yearIndex),
    [activeSchedule.yearlySummary]
  );

  const filteredMonthlyRows = useMemo(() => {
    if (selectedYear === "ALL") return activeSchedule.rows;
    const yr = parseInt(selectedYear, 10);
    return activeSchedule.rows.filter((r) => r.yearIndex === yr);
  }, [activeSchedule.rows, selectedYear]);

  const totalMonthPages = Math.max(
    1,
    Math.ceil(filteredMonthlyRows.length / MONTHS_PAGE_SIZE)
  );
  const safePage = Math.min(currentPage, totalMonthPages);

  const pagedMonthlyRows = useMemo(() => {
    const start = (safePage - 1) * MONTHS_PAGE_SIZE;
    return filteredMonthlyRows.slice(start, start + MONTHS_PAGE_SIZE);
  }, [filteredMonthlyRows, safePage]);

  const yearlyTotals = useMemo(() => {
    return activeSchedule.yearlySummary.reduce(
      (acc, y) => ({
        principalPaid: acc.principalPaid + y.principalPaid,
        interestPaid: acc.interestPaid + y.interestPaid,
        totalPaid: acc.totalPaid + y.totalPaid,
        endingBalance: y.endingBalance,
      }),
      { principalPaid: 0, interestPaid: 0, totalPaid: 0, endingBalance: 0 }
    );
  }, [activeSchedule.yearlySummary]);

  const monthlyTotals = useMemo(() => {
    return filteredMonthlyRows.reduce(
      (acc, r) => ({
        principalPaid: acc.principalPaid + r.principal + r.prepaidInPeriod,
        interestPaid: acc.interestPaid + r.interest,
        totalPaid: acc.totalPaid + r.totalPayment + r.prepaidInPeriod,
        endingBalance: r.closingBalance,
      }),
      { principalPaid: 0, interestPaid: 0, totalPaid: 0, endingBalance: 0 }
    );
  }, [filteredMonthlyRows]);

  const handleGranularityChange = (next: CashflowGranularity) => {
    setGranularity(next);
    setCurrentPage(1);
  };

  const handleYearFilterChange = (val: string) => {
    setSelectedYear(val);
    setCurrentPage(1);
  };

  const handleJumpToCurrentYear = () => {
    const targetYear = milestones.currentYearIndex ?? 1;
    setSelectedYear(String(targetYear));
    setCurrentPage(1);
  };

  const handleUnlockClick = () => {
    onSetLocked?.(false);
    setGranularity("MONTHLY");
    setCurrentPage(1);
  };

  const handleCancelAndLock = () => {
    setDraftOverrides(contract.periodOverrides || []);
    setDraftTermMonths(
      Math.min(MAX_MORTGAGE_TERM_MONTHS, Math.max(12, contract.termMonths || 360))
    );
    setDraftMonthlyPrincipal(contract.monthlyPrincipalOverride ?? 0);
    setDraftFixedRate(contract.fixedInterestRate);
    setDraftFloatingBase(contract.floatingBaseRate);
    setDraftFloatingSpread(contract.floatingSpread);
    setDraftBasis(contract.interestBasis || "ACTUAL_365");
    onSetLocked?.(true);
  };

  const handleSaveAndLockClick = () => {
    if (!onSaveAndLock) return;
    const cleanTerm = Math.max(12, Math.min(MAX_MORTGAGE_TERM_MONTHS, Math.round(draftTermMonths)));
    onSaveAndLock({
      contractPatch: {
        termMonths: cleanTerm,
        fixedRateMonths: Math.min(contract.fixedRateMonths, cleanTerm),
        monthlyPrincipalOverride: Math.max(0, Math.round(draftMonthlyPrincipal)),
        fixedInterestRate: Math.max(0, draftFixedRate),
        floatingBaseRate: Math.max(0, draftFloatingBase),
        floatingSpread: Math.max(0, draftFloatingSpread),
        interestBasis: draftBasis,
      },
      periodOverrides: draftOverrides,
    });
  };

  const upsertPeriodOverride = (
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

  const clearPeriodOverride = (period: number) => {
    setDraftOverrides((prev) => prev.filter((ov) => ov.period !== period));
  };

  const activeTotals = granularity === "YEARLY" ? yearlyTotals : monthlyTotals;
  const savedOverrideCount = (contract.periodOverrides || []).length;
  const draftOverrideCount = draftOverrides.length;
  const interestDelta = activeSchedule.totalProjectedInterest - schedule.totalProjectedInterest;

  return (
    <section
      aria-label="Bảng chi tiết dòng tiền (Amortization Schedule)"
      className="bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 shadow-xs p-4 sm:p-5 space-y-4"
    >
      {/* Header + Yearly/Monthly Segmented Switch + Lock Status */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pb-3 border-b border-[#E9EEF5] dark:border-slate-800">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800/70 text-[#4F46E5] dark:text-indigo-300 flex items-center justify-center shrink-0 mt-0.5">
            <Table2 className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-bold text-[#172B4D] dark:text-slate-100 leading-snug">
              Bảng chi tiết dòng tiền (Amortization Schedule)
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 tabular-nums">
              {granularity === "YEARLY"
                ? `Tổng hợp ${activeSchedule.yearlySummary.length} năm vay · Đối chiếu Dư nợ đầu kỳ, Gốc trả, Lãi trả và Dư nợ cuối kỳ`
                : `Chi tiết ${filteredMonthlyRows.length} kỳ thanh toán hàng tháng · Lãi suất thực tế theo từng kỳ`}
              {savedOverrideCount > 0 && isLocked && (
                <span> · Đã tùy chỉnh {savedOverrideCount} kỳ</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {canAdjustLock && isLocked && (
            <button
              type="button"
              data-testid="skyone-cashflow-unlock-btn"
              onClick={handleUnlockClick}
              className="min-h-[38px] px-3.5 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-200 text-xs font-bold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>Mở khóa điều chỉnh</span>
            </button>
          )}

          <div
            role="group"
            aria-label="Chuyển đổi góc nhìn bảng dòng tiền"
            className="inline-flex items-center rounded-lg bg-slate-100 dark:bg-slate-800 p-1 border border-[#DCE4EE] dark:border-slate-700"
          >
            <button
              type="button"
              data-testid="skyone-cashflow-mode-yearly"
              aria-pressed={granularity === "YEARLY"}
              onClick={() => handleGranularityChange("YEARLY")}
              className={`min-h-[36px] sm:min-h-[34px] px-3 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                granularity === "YEARLY"
                  ? "bg-white dark:bg-slate-900 text-[#1D4ED8] dark:text-blue-300 shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:text-[#172B4D] dark:hover:text-white"
              }`}
            >
              Theo Năm
            </button>
            <button
              type="button"
              data-testid="skyone-cashflow-mode-monthly"
              aria-pressed={granularity === "MONTHLY"}
              onClick={() => handleGranularityChange("MONTHLY")}
              className={`min-h-[36px] sm:min-h-[34px] px-3 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                granularity === "MONTHLY"
                  ? "bg-white dark:bg-slate-900 text-[#1D4ED8] dark:text-blue-300 shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:text-[#172B4D] dark:hover:text-white"
              }`}
            >
              Theo Tháng
            </button>
          </div>
        </div>
      </div>

      {/* Lock Status Strip (Locked) OR Unlocked General Cashflow & Period Editing Controls */}
      {canAdjustLock && isLocked && (
        <div
          data-testid="skyone-cashflow-locked-banner"
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 px-3.5 py-2 text-xs text-slate-600 dark:text-slate-300"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Lock className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
            <span>
              Đang khóa chỉnh sửa số liệu <strong className="text-slate-800 dark:text-slate-100">Lãi trả nợ</strong>, Gốc &amp; Dòng tiền để bảo toàn đối soát sao kê.
            </span>
          </div>
          {savedOverrideCount > 0 && (
            <span className="font-semibold text-indigo-700 dark:text-indigo-300 tabular-nums whitespace-nowrap">
              {savedOverrideCount} kỳ đang dùng số điều chỉnh
            </span>
          )}
        </div>
      )}

      {canAdjustLock && !isLocked && (
        <div
          data-testid="skyone-cashflow-unlocked-editor"
          className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/45 dark:bg-indigo-950/35 p-4 space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2 min-w-0">
              <SlidersHorizontal className="w-4 h-4 text-indigo-600 dark:text-indigo-300 shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-extrabold text-indigo-950 dark:text-indigo-100">
                  Chế độ Mở khóa Điều chỉnh Lãi trả nợ &amp; Dòng tiền
                </p>
                <p className="text-slate-600 dark:text-slate-300 mt-0.5 tabular-nums">
                  Sửa trực tiếp tham số dòng tiền chung bên dưới hoặc nhập số tiền <strong>Lãi trả nợ</strong>, <strong>Trả Gốc</strong>, <strong>Lãi suất (%)</strong> từng kỳ ở bảng Theo Tháng ({draftOverrideCount} kỳ đã chỉnh).
                  {interestDelta !== 0 && (
                    <span
                      className={`ml-1.5 font-bold ${
                        interestDelta < 0
                          ? "text-emerald-700 dark:text-emerald-300"
                          : "text-amber-700 dark:text-amber-300"
                      }`}
                    >
                      · Chênh lệch tổng lãi: {interestDelta > 0 ? "+" : "-"}
                      {formatVNDMasked(Math.abs(interestDelta), isPrivacyMode)}
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                data-testid="skyone-cashflow-cancel-lock-btn"
                onClick={handleCancelAndLock}
                className="min-h-[38px] px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Hủy &amp; Khóa lại</span>
              </button>
              <button
                type="button"
                data-testid="skyone-cashflow-save-lock-btn"
                onClick={handleSaveAndLockClick}
                className="min-h-[38px] px-4 py-1.5 rounded-lg bg-[#1E3A8A] hover:bg-blue-900 dark:bg-blue-600 dark:hover:bg-blue-700 text-white text-xs font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Lưu &amp; Khóa điều chỉnh</span>
              </button>
            </div>
          </div>

          {/* General Cashflow Parameters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
            <div>
              <label
                htmlFor="cashflow-edit-term-years"
                className="font-bold text-slate-700 dark:text-slate-200 block mb-1"
              >
                Số năm vay (≤ {MAX_MORTGAGE_TERM_YEARS} năm)
              </label>
              <input
                id="cashflow-edit-term-years"
                type="number"
                min={1}
                max={MAX_MORTGAGE_TERM_YEARS}
                value={Math.max(1, Math.min(MAX_MORTGAGE_TERM_YEARS, Math.round(draftTermMonths / 12)))}
                onChange={(e) => {
                  const yrs = Math.max(
                    1,
                    Math.min(MAX_MORTGAGE_TERM_YEARS, Number(e.target.value) || 1)
                  );
                  setDraftTermMonths(yrs * 12);
                }}
                className="w-full min-h-[38px] px-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-[#0F172A] dark:text-slate-100 font-bold tabular-nums"
              />
            </div>

            <div>
              <label
                htmlFor="cashflow-edit-monthly-principal"
                className="font-bold text-slate-700 dark:text-slate-200 block mb-1"
              >
                Gốc đều / tháng (VNĐ)
              </label>
              <input
                id="cashflow-edit-monthly-principal"
                type="number"
                min={0}
                step={50000}
                value={draftMonthlyPrincipal}
                onChange={(e) => setDraftMonthlyPrincipal(Math.max(0, Number(e.target.value) || 0))}
                className="w-full min-h-[38px] px-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-[#0F172A] dark:text-slate-100 font-bold tabular-nums"
              />
            </div>

            <div>
              <label
                htmlFor="cashflow-edit-fixed-rate"
                className="font-bold text-slate-700 dark:text-slate-200 block mb-1"
              >
                Lãi cố định (%/năm)
              </label>
              <input
                id="cashflow-edit-fixed-rate"
                type="number"
                min={0}
                max={30}
                step={0.1}
                value={draftFixedRate}
                onChange={(e) => setDraftFixedRate(Math.max(0, Number(e.target.value) || 0))}
                className="w-full min-h-[38px] px-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-[#0F172A] dark:text-slate-100 font-bold tabular-nums"
              />
            </div>

            <div>
              <label
                htmlFor="cashflow-edit-floating-rate"
                className="font-bold text-slate-700 dark:text-slate-200 block mb-1"
              >
                Lãi thả nổi (%/năm)
              </label>
              <input
                id="cashflow-edit-floating-rate"
                type="number"
                min={0}
                max={35}
                step={0.1}
                value={Number((draftFloatingBase + draftFloatingSpread).toFixed(2))}
                onChange={(e) => {
                  const nextTotal = Math.max(0, Number(e.target.value) || 0);
                  setDraftFloatingBase(Math.max(0, Number((nextTotal - draftFloatingSpread).toFixed(2))));
                }}
                className="w-full min-h-[38px] px-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-[#0F172A] dark:text-slate-100 font-bold tabular-nums"
              />
            </div>

            <div>
              <label
                htmlFor="cashflow-edit-basis"
                className="font-bold text-slate-700 dark:text-slate-200 block mb-1"
              >
                Chuẩn tính lãi
              </label>
              <select
                id="cashflow-edit-basis"
                value={draftBasis}
                onChange={(e) =>
                  setDraftBasis(
                    e.target.value === "THIRTY_360" ? "THIRTY_360" : "ACTUAL_365"
                  )
                }
                className="w-full min-h-[38px] px-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-[#0F172A] dark:text-slate-100 font-semibold"
              >
                <option value="ACTUAL_365">Actual/365</option>
                <option value="THIRTY_360">30/360</option>
              </select>
            </div>
          </div>

          {granularity === "YEARLY" && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-indigo-200/70 dark:border-indigo-800/70 text-xs">
              <span className="text-indigo-900 dark:text-indigo-200">
                Đang xem tổng hợp theo Năm. Chuyển sang bảng <strong>Theo Tháng</strong> để nhập trực tiếp số tiền <strong>Lãi trả nợ</strong>, Gốc và Lãi suất từng kỳ.
              </span>
              <button
                type="button"
                onClick={() => handleGranularityChange("MONTHLY")}
                className="min-h-[34px] px-3 py-1 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-bold whitespace-nowrap cursor-pointer"
              >
                Mở bảng Theo Tháng để sửa từng kỳ
              </button>
            </div>
          )}
        </div>
      )}

      {/* Monthly Filter & Pagination Toolbar */}
      {granularity === "MONTHLY" && (
        <div className="flex flex-wrap items-center justify-between gap-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-lg px-3 py-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <label
              htmlFor="skyone-cashflow-year-select"
              className="text-slate-600 dark:text-slate-300 font-medium inline-flex items-center gap-1.5"
            >
              <CalendarRange className="w-3.5 h-3.5 text-[#4F46E5] dark:text-indigo-300" />
              <span>Lọc năm:</span>
            </label>
            <select
              id="skyone-cashflow-year-select"
              data-testid="skyone-cashflow-year-select"
              value={selectedYear}
              onChange={(e) => handleYearFilterChange(e.target.value)}
              className="min-h-[34px] rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-[#172B4D] dark:text-slate-100 px-2.5 py-1 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            >
              <option value="ALL">Tất cả ({activeSchedule.rows.length} tháng)</option>
              {availableYears.map((yr) => (
                <option key={yr} value={String(yr)}>
                  Năm {yr}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleJumpToCurrentYear}
              className="min-h-[34px] px-2.5 py-1 rounded-md border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/60 text-[#1D4ED8] dark:text-blue-300 font-semibold hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors whitespace-nowrap cursor-pointer"
            >
              Năm hiện tại (Năm {milestones.currentYearIndex ?? 1})
            </button>
          </div>

          {totalMonthPages > 1 && (
            <div className="flex items-center gap-1.5 tabular-nums">
              <button
                type="button"
                aria-label="Trang trước"
                disabled={safePage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="min-h-[34px] min-w-[34px] inline-flex items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 font-semibold text-slate-700 dark:text-slate-200">
                Trang {safePage} / {totalMonthPages}
              </span>
              <button
                type="button"
                aria-label="Trang sau"
                disabled={safePage >= totalMonthPages}
                onClick={() => setCurrentPage((p) => Math.min(totalMonthPages, p + 1))}
                className="min-h-[34px] min-w-[34px] inline-flex items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Data Table */}
      {(granularity === "YEARLY" && activeSchedule.yearlySummary.length === 0) ||
      (granularity === "MONTHLY" && filteredMonthlyRows.length === 0) ? (
        <div className="py-10 text-center text-xs text-slate-500 dark:text-slate-400">
          Chưa có dữ liệu lịch trả nợ để hiển thị.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="w-full min-w-[740px] text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold">
                <th className="py-2.5 px-3">
                  {granularity === "YEARLY" ? "Năm vay" : "Kỳ / Tháng"}
                </th>
                <th className="py-2.5 px-3 text-right">Dư nợ đầu kỳ</th>
                <th className="py-2.5 px-3 text-right">Gốc trả</th>
                <th className="py-2.5 px-3 text-right">Lãi trả nợ</th>
                <th className="py-2.5 px-3 text-right">Tổng đóng</th>
                <th className="py-2.5 px-3 text-right">Dư nợ cuối kỳ</th>
                {!isLocked && granularity === "MONTHLY" && (
                  <th className="py-2.5 px-3 text-right">Khôi phục</th>
                )}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {granularity === "YEARLY"
                ? activeSchedule.yearlySummary.map((yr) => {
                    const remainingRatioPct =
                      draftContract.loanAmount > 0
                        ? Math.max(
                            0,
                            Math.min(100, (yr.endingBalance / draftContract.loanAmount) * 100)
                          )
                        : 0;
                    const isCurrentYear = milestones.currentYearIndex === yr.yearIndex;
                    const isFixedEndYear = milestones.fixedEndYearIndex === yr.yearIndex;
                    const isEquity50Year = milestones.equity50YearIndex === yr.yearIndex;

                    const markers: string[] = [];
                    if (isCurrentYear) markers.push("Hiện tại");
                    if (isFixedEndYear) markers.push("Hết CĐ");
                    if (isEquity50Year) markers.push("Equity ≥50%");

                    return (
                      <tr
                        key={yr.yearIndex}
                        className={`transition-colors hover:bg-slate-50/90 dark:hover:bg-slate-800/50 ${
                          isCurrentYear ? "bg-blue-50/45 dark:bg-blue-950/30" : ""
                        }`}
                      >
                        <td className="py-2.5 px-3 align-middle">
                          <div className="font-bold text-[#172B4D] dark:text-slate-100 whitespace-nowrap">
                            {yr.label}
                          </div>
                          {markers.length > 0 && (
                            <div className="text-[10px] font-semibold text-[#4F46E5] dark:text-indigo-300 mt-0.5 whitespace-nowrap">
                              {markers.join(" · ")}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium text-slate-700 dark:text-slate-300 tabular-nums whitespace-nowrap">
                          {formatVNDMasked(yr.openingBalance, isPrivacyMode)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold text-[#2563EB] dark:text-blue-400 tabular-nums whitespace-nowrap">
                          {formatVNDMasked(yr.principalPaid, isPrivacyMode)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold text-[#4F46E5] dark:text-indigo-300 tabular-nums whitespace-nowrap">
                          {formatVNDMasked(yr.interestPaid, isPrivacyMode)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-[#172B4D] dark:text-slate-100 tabular-nums whitespace-nowrap">
                          {formatVNDMasked(yr.totalPaid, isPrivacyMode)}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">
                          <div className="font-semibold text-[#A21CAF] dark:text-fuchsia-300">
                            {formatVNDMasked(yr.endingBalance, isPrivacyMode)}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">
                            Còn {remainingRatioPct.toFixed(1)}% · Equity {yr.equityPercent.toFixed(1)}%
                          </div>
                        </td>
                      </tr>
                    );
                  })
                : pagedMonthlyRows.map((row) => {
                    const statusInfo = getStatusLabel(row.status);
                    const totalPrincipalOut = row.principal + row.prepaidInPeriod;
                    const totalCashOut = row.totalPayment + row.prepaidInPeriod;
                    const isCurrentPeriod = activeSchedule.currentReferencePeriod === row.period;
                    const ov = overrideMap.get(row.period);
                    const isEditedRow = Boolean(ov) || Boolean(row.isCashflowOverridden);

                    return (
                      <tr
                        key={row.period}
                        className={`transition-colors hover:bg-slate-50/90 dark:hover:bg-slate-800/50 ${
                          isEditedRow
                            ? "bg-indigo-50/40 dark:bg-indigo-950/30"
                            : isCurrentPeriod
                            ? "bg-blue-50/45 dark:bg-blue-950/30"
                            : ""
                        }`}
                      >
                        <td className="py-2.5 px-3 align-middle">
                          <div className="font-bold text-[#172B4D] dark:text-slate-100 tabular-nums whitespace-nowrap">
                            Kỳ #{row.period} · {formatDateVN(row.dueDate)}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 flex flex-wrap items-center gap-1.5 whitespace-nowrap">
                            <span className={`font-semibold ${statusInfo.className}`}>
                              {statusInfo.text}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{row.stage === "FIXED" ? "Cố định" : "Thả nổi"}</span>
                            <span aria-hidden="true">·</span>
                            {!isLocked ? (
                              <label className="inline-flex items-center gap-1">
                                <span>LS</span>
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
                                    upsertPeriodOverride(row.period, {
                                      appliedRate: Math.max(0, Number(e.target.value) || 0),
                                    })
                                  }
                                  className="w-14 h-6 px-1 rounded border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-900 text-[#0F172A] dark:text-slate-100 text-[11px] font-bold text-right tabular-nums"
                                />
                                <span>%</span>
                              </label>
                            ) : (
                              <span className="tabular-nums">{row.appliedRate.toFixed(2)}%</span>
                            )}
                            {row.isCashflowOverridden && (
                              <span
                                title={row.overrideNote || "Đã điều chỉnh số liệu dòng tiền"}
                                className="font-bold text-indigo-700 dark:text-indigo-300"
                              >
                                · Đã chỉnh tay
                              </span>
                            )}
                          </div>
                          {!isLocked && (
                            <input
                              type="text"
                              placeholder="Ghi chú kỳ (tùy chọn)..."
                              value={ov?.note ?? row.overrideNote ?? ""}
                              onChange={(e) =>
                                upsertPeriodOverride(row.period, { note: e.target.value })
                              }
                              className="mt-1.5 w-full max-w-[210px] h-7 px-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] text-slate-700 dark:text-slate-200"
                            />
                          )}
                        </td>

                        <td className="py-2.5 px-3 text-right font-medium text-slate-700 dark:text-slate-300 tabular-nums whitespace-nowrap">
                          {formatVNDMasked(row.openingBalance, isPrivacyMode)}
                        </td>

                        <td className="py-2.5 px-3 text-right font-semibold text-[#2563EB] dark:text-blue-400 tabular-nums whitespace-nowrap">
                          {!isLocked ? (
                            <input
                              type="number"
                              min={0}
                              step={10000}
                              aria-label={`Trả gốc kỳ ${row.period}`}
                              value={ov?.principal !== undefined ? ov.principal : row.principal}
                              onChange={(e) =>
                                upsertPeriodOverride(row.period, {
                                  principal: Math.max(0, Math.round(Number(e.target.value) || 0)),
                                })
                              }
                              className="w-28 min-h-[34px] px-2 rounded-md border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-900 text-right font-bold text-[#1E3A8A] dark:text-blue-300 tabular-nums"
                            />
                          ) : (
                            <div>{formatVNDMasked(totalPrincipalOut, isPrivacyMode)}</div>
                          )}
                          {row.prepaidInPeriod > 0 && (
                            <div className="text-[10px] text-emerald-700 dark:text-emerald-300 font-medium mt-0.5">
                              Gồm trả trước {formatVNDMasked(row.prepaidInPeriod, isPrivacyMode)}
                            </div>
                          )}
                        </td>

                        <td className="py-2.5 px-3 text-right font-semibold text-[#4F46E5] dark:text-indigo-300 tabular-nums whitespace-nowrap">
                          {!isLocked ? (
                            <input
                              type="number"
                              min={0}
                              step={10000}
                              aria-label={`Lãi trả nợ kỳ ${row.period}`}
                              data-testid={`cashflow-interest-input-${row.period}`}
                              value={ov?.interest !== undefined ? ov.interest : row.interest}
                              onChange={(e) =>
                                upsertPeriodOverride(row.period, {
                                  interest: Math.max(0, Math.round(Number(e.target.value) || 0)),
                                })
                              }
                              className="w-28 min-h-[34px] px-2 rounded-md border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-900 text-right font-bold text-[#4F46E5] dark:text-indigo-300 tabular-nums"
                            />
                          ) : (
                            formatVNDMasked(row.interest, isPrivacyMode)
                          )}
                        </td>

                        <td className="py-2.5 px-3 text-right font-bold text-[#172B4D] dark:text-slate-100 tabular-nums whitespace-nowrap">
                          {formatVNDMasked(totalCashOut, isPrivacyMode)}
                        </td>

                        <td className="py-2.5 px-3 text-right font-semibold text-[#A21CAF] dark:text-fuchsia-300 tabular-nums whitespace-nowrap">
                          {formatVNDMasked(row.closingBalance, isPrivacyMode)}
                        </td>

                        {!isLocked && (
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            {ov ? (
                              <button
                                type="button"
                                onClick={() => clearPeriodOverride(row.period)}
                                title="Khôi phục số mặc định cho kỳ này"
                                className="min-h-[32px] px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>Mặc định</span>
                              </button>
                            ) : (
                              <span className="text-[11px] text-slate-400">—</span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
            </tbody>

            <tfoot>
              <tr className="bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 font-bold text-xs">
                <td className="py-2.5 px-3 text-[#172B4D] dark:text-slate-100 whitespace-nowrap">
                  {granularity === "YEARLY"
                    ? `Tổng cộng (${activeSchedule.yearlySummary.length} năm)`
                    : selectedYear === "ALL"
                    ? `Tổng toàn kỳ (${filteredMonthlyRows.length} kỳ)`
                    : `Tổng Năm ${selectedYear} (${filteredMonthlyRows.length} kỳ)`}
                </td>
                <td className="py-2.5 px-3 text-right text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
                  —
                </td>
                <td className="py-2.5 px-3 text-right text-[#2563EB] dark:text-blue-400 tabular-nums whitespace-nowrap">
                  {formatVNDMasked(activeTotals.principalPaid, isPrivacyMode)}
                </td>
                <td className="py-2.5 px-3 text-right text-[#4F46E5] dark:text-indigo-300 tabular-nums whitespace-nowrap">
                  {formatVNDMasked(activeTotals.interestPaid, isPrivacyMode)}
                </td>
                <td className="py-2.5 px-3 text-right text-[#172B4D] dark:text-slate-100 tabular-nums whitespace-nowrap">
                  {formatVNDMasked(activeTotals.totalPaid, isPrivacyMode)}
                </td>
                <td className="py-2.5 px-3 text-right text-[#A21CAF] dark:text-fuchsia-300 tabular-nums whitespace-nowrap">
                  {formatVNDMasked(activeTotals.endingBalance, isPrivacyMode)}
                </td>
                {!isLocked && granularity === "MONTHLY" && <td />}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
