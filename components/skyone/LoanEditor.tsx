"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Lock, RotateCcw, Save, SlidersHorizontal, Unlock, X } from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import {
  generateMortgageSchedule,
  MAX_MORTGAGE_TERM_MONTHS,
  MAX_MORTGAGE_TERM_YEARS,
} from "@/lib/mortgageEngine";
import { formatDateVN, formatVNDMasked } from "@/lib/formatters";
import {
  MortgageContract,
  MortgageInterestBasis,
  MortgagePeriodCashflowOverride,
} from "@/types/finance";

export interface LoanEditorProps {
  onSaved?: (message: string) => void;
}

export function LoanEditor({ onSaved }: LoanEditorProps) {
  const {
    skyoneLoan,
    isPrivacyMode,
    setSkyOneCashflowLocked,
    saveAndLockSkyOneCashflow,
  } = useFinance();

  const isLocked = skyoneLoan.cashflowLocked !== false;

  const [loanAmount, setLoanAmount] = useState<number>(skyoneLoan.loanAmount);
  const [termMonths, setTermMonths] = useState<number>(
    Math.min(MAX_MORTGAGE_TERM_MONTHS, Math.max(12, skyoneLoan.termMonths || 360))
  );
  const [fixedRateMonths, setFixedRateMonths] = useState<number>(skyoneLoan.fixedRateMonths);
  const [fixedInterestRate, setFixedInterestRate] = useState<number>(
    skyoneLoan.fixedInterestRate
  );
  const [floatingBaseRate, setFloatingBaseRate] = useState<number>(skyoneLoan.floatingBaseRate);
  const [floatingSpread, setFloatingSpread] = useState<number>(skyoneLoan.floatingSpread);
  const [monthlyPrincipalOverride, setMonthlyPrincipalOverride] = useState<number>(
    skyoneLoan.monthlyPrincipalOverride ?? 0
  );
  const [paymentDayOfMonth, setPaymentDayOfMonth] = useState<number>(
    skyoneLoan.paymentDayOfMonth
  );
  const [interestBasis, setInterestBasis] = useState<MortgageInterestBasis>(
    skyoneLoan.interestBasis || "ACTUAL_365"
  );
  const [draftOverrides, setDraftOverrides] = useState<MortgagePeriodCashflowOverride[]>(
    () => skyoneLoan.periodOverrides || []
  );

  const currentSchedule = useMemo(() => generateMortgageSchedule(skyoneLoan), [skyoneLoan]);

  const [selectedPeriod, setSelectedPeriod] = useState<number>(() => {
    const nextDue = currentSchedule.rows.find((r) => r.status !== "PAID");
    return nextDue?.period ?? 1;
  });

  useEffect(() => {
    const cleanTerm = Math.min(
      MAX_MORTGAGE_TERM_MONTHS,
      Math.max(12, skyoneLoan.termMonths || 360)
    );
    setLoanAmount(skyoneLoan.loanAmount);
    setTermMonths(cleanTerm);
    setFixedRateMonths(Math.min(cleanTerm, Math.max(0, skyoneLoan.fixedRateMonths)));
    setFixedInterestRate(skyoneLoan.fixedInterestRate);
    setFloatingBaseRate(skyoneLoan.floatingBaseRate);
    setFloatingSpread(skyoneLoan.floatingSpread);
    setMonthlyPrincipalOverride(skyoneLoan.monthlyPrincipalOverride ?? 0);
    setPaymentDayOfMonth(skyoneLoan.paymentDayOfMonth);
    setInterestBasis(skyoneLoan.interestBasis || "ACTUAL_365");
    setDraftOverrides(skyoneLoan.periodOverrides || []);
  }, [skyoneLoan, isLocked]);

  const draftContract = useMemo<MortgageContract>(() => {
    const cleanTerm = Math.max(
      12,
      Math.min(MAX_MORTGAGE_TERM_MONTHS, Math.round(termMonths))
    );
    return {
      ...skyoneLoan,
      loanAmount: Math.max(1_000_000, Math.round(loanAmount)),
      termMonths: cleanTerm,
      fixedRateMonths: Math.max(0, Math.min(cleanTerm, Math.round(fixedRateMonths))),
      fixedInterestRate: Math.max(0, fixedInterestRate),
      floatingBaseRate: Math.max(0, floatingBaseRate),
      floatingSpread: Math.max(0, floatingSpread),
      monthlyPrincipalOverride: Math.max(0, Math.round(monthlyPrincipalOverride)),
      paymentDayOfMonth: Math.max(1, Math.min(28, Math.round(paymentDayOfMonth))),
      interestBasis,
      periodOverrides: draftOverrides,
    };
  }, [
    skyoneLoan,
    loanAmount,
    termMonths,
    fixedRateMonths,
    fixedInterestRate,
    floatingBaseRate,
    floatingSpread,
    monthlyPrincipalOverride,
    paymentDayOfMonth,
    interestBasis,
    draftOverrides,
  ]);

  const previewSchedule = useMemo(
    () => (isLocked ? currentSchedule : generateMortgageSchedule(draftContract)),
    [isLocked, currentSchedule, draftContract]
  );

  useEffect(() => {
    const maxP = Math.max(1, previewSchedule.rows.length);
    if (selectedPeriod > maxP) {
      setSelectedPeriod(maxP);
    }
  }, [previewSchedule.rows.length, selectedPeriod]);

  const activePeriodRow = useMemo(
    () =>
      previewSchedule.rows.find((r) => r.period === selectedPeriod) ||
      previewSchedule.rows[0] ||
      null,
    [previewSchedule.rows, selectedPeriod]
  );

  const activePeriodOverride = useMemo(
    () => draftOverrides.find((ov) => ov.period === selectedPeriod),
    [draftOverrides, selectedPeriod]
  );

  const upsertSelectedPeriodOverride = (
    patch: Partial<MortgagePeriodCashflowOverride>
  ) => {
    if (isLocked) return;
    setDraftOverrides((prev) => {
      const idx = prev.findIndex((ov) => ov.period === selectedPeriod);
      if (idx === -1) {
        return [...prev, { period: selectedPeriod, ...patch }].sort(
          (a, b) => a.period - b.period
        );
      }
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  const clearSelectedPeriodOverride = () => {
    if (isLocked) return;
    setDraftOverrides((prev) => prev.filter((ov) => ov.period !== selectedPeriod));
  };

  const interestDelta =
    previewSchedule.totalProjectedInterest - currentSchedule.totalProjectedInterest;

  const handleUnlock = () => {
    setSkyOneCashflowLocked(false);
  };

  const handleCancelAndLock = () => {
    const cleanTerm = Math.min(
      MAX_MORTGAGE_TERM_MONTHS,
      Math.max(12, skyoneLoan.termMonths || 360)
    );
    setLoanAmount(skyoneLoan.loanAmount);
    setTermMonths(cleanTerm);
    setFixedRateMonths(Math.min(cleanTerm, Math.max(0, skyoneLoan.fixedRateMonths)));
    setFixedInterestRate(skyoneLoan.fixedInterestRate);
    setFloatingBaseRate(skyoneLoan.floatingBaseRate);
    setFloatingSpread(skyoneLoan.floatingSpread);
    setMonthlyPrincipalOverride(skyoneLoan.monthlyPrincipalOverride ?? 0);
    setPaymentDayOfMonth(skyoneLoan.paymentDayOfMonth);
    setInterestBasis(skyoneLoan.interestBasis || "ACTUAL_365");
    setDraftOverrides(skyoneLoan.periodOverrides || []);
    setSkyOneCashflowLocked(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTerm = Math.max(
      12,
      Math.min(MAX_MORTGAGE_TERM_MONTHS, Math.round(termMonths))
    );
    const cleanFixedMonths = Math.max(0, Math.min(cleanTerm, Math.round(fixedRateMonths)));

    saveAndLockSkyOneCashflow({
      contractPatch: {
        loanAmount: Math.max(1_000_000, Math.round(loanAmount)),
        termMonths: cleanTerm,
        fixedRateMonths: cleanFixedMonths,
        fixedInterestRate: Math.max(0, fixedInterestRate),
        floatingBaseRate: Math.max(0, floatingBaseRate),
        floatingSpread: Math.max(0, floatingSpread),
        monthlyPrincipalOverride: Math.max(0, Math.round(monthlyPrincipalOverride)),
        paymentDayOfMonth: Math.max(1, Math.min(28, Math.round(paymentDayOfMonth))),
        interestBasis,
      },
      periodOverrides: draftOverrides,
    });

    onSaved?.(
      "Đã lưu gốc hợp đồng, lãi suất & điều chỉnh dòng tiền từng kỳ vào FinanceContext và khóa lại."
    );
  };

  return (
    <section
      data-testid="skyone-loan-editor"
      aria-label="Trình điều chỉnh Gốc vay, Lãi suất & Dòng tiền SKYONE"
      className="bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 shadow-xs p-4 sm:p-5 space-y-4"
    >
      {/* Header + Unlock / Save Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E9EEF5] dark:border-slate-800">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 text-[#1E3A8A] dark:text-blue-300 flex items-center justify-center shrink-0 mt-0.5">
            {isLocked ? <Lock className="w-4 h-4" /> : <SlidersHorizontal className="w-4 h-4" />}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-bold text-[#172B4D] dark:text-slate-100 leading-snug">
              Điều chỉnh Gốc vay, Lãi suất &amp; Dòng tiền từng kỳ
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 tabular-nums">
              {isLocked ? (
                <>
                  Đang khóa mặc định để bảo vệ số liệu sao kê · Bấm Mở khóa (Unlock) để sửa gốc vay, lãi suất và dòng tiền từng kỳ (≤ {MAX_MORTGAGE_TERM_YEARS} năm).
                </>
              ) : (
                <>
                  Đang mở khóa chỉnh sửa · Dự kiến tất toán{" "}
                  <strong className="text-slate-800 dark:text-slate-100">
                    {formatDateVN(previewSchedule.estimatedPayoffDate)}
                  </strong>
                  {interestDelta !== 0 && (
                    <span
                      className={`ml-1.5 font-bold ${
                        interestDelta < 0
                          ? "text-emerald-700 dark:text-emerald-400"
                          : "text-amber-700 dark:text-amber-300"
                      }`}
                    >
                      · Chênh lệch tổng lãi: {interestDelta > 0 ? "+" : "-"}
                      {formatVNDMasked(Math.abs(interestDelta), isPrivacyMode)}
                    </span>
                  )}
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {isLocked ? (
            <button
              type="button"
              data-testid="loan-editor-unlock-btn"
              onClick={handleUnlock}
              className="min-h-[40px] px-4 py-2 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-200 text-xs font-bold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>Mở khóa (Unlock)</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                data-testid="loan-editor-cancel-btn"
                onClick={handleCancelAndLock}
                className="min-h-[40px] px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Hủy &amp; Khóa</span>
              </button>
              <button
                type="submit"
                form="skyone-loan-editor-form"
                data-testid="loan-editor-save-btn"
                className="min-h-[40px] px-4 py-2 rounded-lg bg-[#1E3A8A] hover:bg-blue-900 dark:bg-blue-600 dark:hover:bg-blue-700 text-white text-xs font-extrabold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Lưu &amp; Khóa (Save)</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Contract + Per-Period Cashflow Form */}
      <form
        id="skyone-loan-editor-form"
        onSubmit={handleSave}
        className="space-y-4 text-xs"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label
              htmlFor="loan-editor-loan-amount"
              className="font-bold text-slate-600 dark:text-slate-300 block mb-1"
            >
              Gốc vay hợp đồng (VND)
            </label>
            <input
              id="loan-editor-loan-amount"
              data-testid="loan-editor-loan-amount"
              type="number"
              min={1_000_000}
              step={1_000_000}
              disabled={isLocked}
              value={loanAmount}
              onChange={(e) => setLoanAmount(Math.max(1_000_000, Number(e.target.value) || 0))}
              className="w-full min-h-[40px] px-3 rounded-lg border border-[#DCE4EE] dark:border-slate-700 bg-slate-50 dark:bg-slate-800 disabled:opacity-65 disabled:cursor-not-allowed font-bold text-[#1E3A8A] dark:text-blue-300 tabular-nums"
            />
          </div>

          <div>
            <label
              htmlFor="loan-editor-term-months"
              className="font-bold text-slate-600 dark:text-slate-300 block mb-1"
            >
              Kỳ hạn vay (tháng · ≤ {MAX_MORTGAGE_TERM_MONTHS})
            </label>
            <input
              id="loan-editor-term-months"
              type="number"
              min={12}
              max={MAX_MORTGAGE_TERM_MONTHS}
              disabled={isLocked}
              value={termMonths}
              onChange={(e) =>
                setTermMonths(
                  Math.min(MAX_MORTGAGE_TERM_MONTHS, Math.max(12, Number(e.target.value) || 12))
                )
              }
              className="w-full min-h-[40px] px-3 rounded-lg border border-[#DCE4EE] dark:border-slate-700 bg-slate-50 dark:bg-slate-800 disabled:opacity-65 disabled:cursor-not-allowed font-bold text-[#0F172A] dark:text-slate-100 tabular-nums"
            />
          </div>

          <div>
            <label
              htmlFor="loan-editor-monthly-principal"
              className="font-bold text-slate-600 dark:text-slate-300 block mb-1"
            >
              Gốc đều / tháng (VND, 0 = tự chia)
            </label>
            <input
              id="loan-editor-monthly-principal"
              type="number"
              min={0}
              step={50_000}
              disabled={isLocked}
              value={monthlyPrincipalOverride}
              onChange={(e) => setMonthlyPrincipalOverride(Math.max(0, Number(e.target.value) || 0))}
              className="w-full min-h-[40px] px-3 rounded-lg border border-[#DCE4EE] dark:border-slate-700 bg-slate-50 dark:bg-slate-800 disabled:opacity-65 disabled:cursor-not-allowed font-bold text-[#1E3A8A] dark:text-blue-300 tabular-nums"
            />
          </div>

          <div>
            <label
              htmlFor="loan-editor-fixed-rate"
              className="font-bold text-slate-600 dark:text-slate-300 block mb-1"
            >
              Lãi cố định ưu đãi (%/năm)
            </label>
            <input
              id="loan-editor-fixed-rate"
              type="number"
              min={0}
              max={30}
              step={0.05}
              disabled={isLocked}
              value={fixedInterestRate}
              onChange={(e) => setFixedInterestRate(Math.max(0, Number(e.target.value) || 0))}
              className="w-full min-h-[40px] px-3 rounded-lg border border-[#DCE4EE] dark:border-slate-700 bg-slate-50 dark:bg-slate-800 disabled:opacity-65 disabled:cursor-not-allowed font-bold text-emerald-700 dark:text-emerald-300 tabular-nums"
            />
          </div>

          <div>
            <label
              htmlFor="loan-editor-fixed-months"
              className="font-bold text-slate-600 dark:text-slate-300 block mb-1"
            >
              Thời gian ưu đãi (tháng)
            </label>
            <input
              id="loan-editor-fixed-months"
              type="number"
              min={0}
              max={termMonths}
              disabled={isLocked}
              value={fixedRateMonths}
              onChange={(e) =>
                setFixedRateMonths(Math.min(termMonths, Math.max(0, Number(e.target.value) || 0)))
              }
              className="w-full min-h-[40px] px-3 rounded-lg border border-[#DCE4EE] dark:border-slate-700 bg-slate-50 dark:bg-slate-800 disabled:opacity-65 disabled:cursor-not-allowed font-bold text-[#0F172A] dark:text-slate-100 tabular-nums"
            />
          </div>

          <div>
            <label
              htmlFor="loan-editor-floating-base"
              className="font-bold text-slate-600 dark:text-slate-300 block mb-1"
            >
              Lãi cơ sở thả nổi (%/năm)
            </label>
            <input
              id="loan-editor-floating-base"
              type="number"
              min={0}
              max={35}
              step={0.05}
              disabled={isLocked}
              value={floatingBaseRate}
              onChange={(e) => setFloatingBaseRate(Math.max(0, Number(e.target.value) || 0))}
              className="w-full min-h-[40px] px-3 rounded-lg border border-[#DCE4EE] dark:border-slate-700 bg-slate-50 dark:bg-slate-800 disabled:opacity-65 disabled:cursor-not-allowed font-bold text-amber-700 dark:text-amber-300 tabular-nums"
            />
          </div>

          <div>
            <label
              htmlFor="loan-editor-floating-spread"
              className="font-bold text-slate-600 dark:text-slate-300 block mb-1"
            >
              Biên độ thả nổi (%/năm)
            </label>
            <input
              id="loan-editor-floating-spread"
              type="number"
              min={0}
              max={20}
              step={0.05}
              disabled={isLocked}
              value={floatingSpread}
              onChange={(e) => setFloatingSpread(Math.max(0, Number(e.target.value) || 0))}
              className="w-full min-h-[40px] px-3 rounded-lg border border-[#DCE4EE] dark:border-slate-700 bg-slate-50 dark:bg-slate-800 disabled:opacity-65 disabled:cursor-not-allowed font-bold text-amber-700 dark:text-amber-300 tabular-nums"
            />
          </div>

          <div>
            <label
              htmlFor="loan-editor-pay-day"
              className="font-bold text-slate-600 dark:text-slate-300 block mb-1"
            >
              Ngày trả hàng tháng (1–28)
            </label>
            <input
              id="loan-editor-pay-day"
              type="number"
              min={1}
              max={28}
              disabled={isLocked}
              value={paymentDayOfMonth}
              onChange={(e) =>
                setPaymentDayOfMonth(Math.min(28, Math.max(1, Number(e.target.value) || 10)))
              }
              className="w-full min-h-[40px] px-3 rounded-lg border border-[#DCE4EE] dark:border-slate-700 bg-slate-50 dark:bg-slate-800 disabled:opacity-65 disabled:cursor-not-allowed font-bold text-[#0F172A] dark:text-slate-100 tabular-nums"
            />
          </div>

          <div>
            <label
              htmlFor="loan-editor-basis"
              className="font-bold text-slate-600 dark:text-slate-300 block mb-1"
            >
              Chuẩn đếm ngày tính lãi
            </label>
            <select
              id="loan-editor-basis"
              disabled={isLocked}
              value={interestBasis}
              onChange={(e) =>
                setInterestBasis(
                  e.target.value === "THIRTY_360" ? "THIRTY_360" : "ACTUAL_365"
                )
              }
              className="w-full min-h-[40px] px-3 rounded-lg border border-[#DCE4EE] dark:border-slate-700 bg-slate-50 dark:bg-slate-800 disabled:opacity-65 disabled:cursor-not-allowed font-semibold text-[#0F172A] dark:text-slate-100"
            >
              <option value="ACTUAL_365">Actual/365 (Chuẩn BIDV)</option>
              <option value="THIRTY_360">30/360 (Chia đều 12 tháng)</option>
            </select>
          </div>
        </div>

        {/* Per-Period Cashflow Override Block */}
        <div className="pt-3 border-t border-[#E9EEF5] dark:border-slate-800 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-bold text-[#172B4D] dark:text-slate-100">
                Điều chỉnh dòng tiền từng kỳ (Lãi trả nợ · Gốc · Lãi suất kỳ)
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                Đang áp dụng tùy chỉnh cho {draftOverrides.length} kỳ{" "}
                {activePeriodRow
                  ? `· Kỳ #${activePeriodRow.period} (${formatDateVN(activePeriodRow.dueDate)}) · Tổng kỳ: ${formatVNDMasked(activePeriodRow.totalPayment, isPrivacyMode)}`
                  : ""}
              </p>
            </div>
            {!isLocked && activePeriodOverride && (
              <button
                type="button"
                data-testid="loan-editor-clear-period-btn"
                onClick={clearSelectedPeriodOverride}
                className="min-h-[34px] px-3 py-1 rounded-lg border border-slate-300 dark:border-slate-600 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Khôi phục kỳ #{selectedPeriod}</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label
                htmlFor="loan-editor-period-select"
                className="font-bold text-slate-600 dark:text-slate-300 block mb-1"
              >
                Chọn kỳ điều chỉnh
              </label>
              <select
                id="loan-editor-period-select"
                data-testid="loan-editor-period-select"
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(Number(e.target.value) || 1)}
                className="w-full min-h-[40px] px-3 rounded-lg border border-[#DCE4EE] dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold text-[#0F172A] dark:text-slate-100 tabular-nums"
              >
                {previewSchedule.rows.map((row) => (
                  <option key={row.period} value={row.period}>
                    Kỳ #{row.period} · {formatDateVN(row.dueDate)}
                    {draftOverrides.some((ov) => ov.period === row.period) ? " (Đã sửa)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="loan-editor-period-principal"
                className="font-bold text-slate-600 dark:text-slate-300 block mb-1"
              >
                Gốc trả kỳ #{selectedPeriod} (VND)
              </label>
              <input
                id="loan-editor-period-principal"
                data-testid="loan-editor-period-principal"
                type="number"
                min={0}
                step={10_000}
                disabled={isLocked}
                value={activePeriodOverride?.principal ?? activePeriodRow?.principal ?? 0}
                onChange={(e) =>
                  upsertSelectedPeriodOverride({
                    principal: Math.max(0, Math.round(Number(e.target.value) || 0)),
                  })
                }
                className="w-full min-h-[40px] px-3 rounded-lg border border-[#DCE4EE] dark:border-slate-700 bg-slate-50 dark:bg-slate-800 disabled:opacity-65 disabled:cursor-not-allowed font-bold text-[#1E3A8A] dark:text-blue-300 tabular-nums"
              />
            </div>

            <div>
              <label
                htmlFor="loan-editor-period-interest"
                className="font-bold text-slate-600 dark:text-slate-300 block mb-1"
              >
                Lãi trả nợ kỳ #{selectedPeriod} (VND)
              </label>
              <input
                id="loan-editor-period-interest"
                data-testid="loan-editor-period-interest"
                type="number"
                min={0}
                step={10_000}
                disabled={isLocked}
                value={activePeriodOverride?.interest ?? activePeriodRow?.interest ?? 0}
                onChange={(e) =>
                  upsertSelectedPeriodOverride({
                    interest: Math.max(0, Math.round(Number(e.target.value) || 0)),
                  })
                }
                className="w-full min-h-[40px] px-3 rounded-lg border border-[#DCE4EE] dark:border-slate-700 bg-slate-50 dark:bg-slate-800 disabled:opacity-65 disabled:cursor-not-allowed font-bold text-amber-700 dark:text-amber-300 tabular-nums"
              />
            </div>

            <div>
              <label
                htmlFor="loan-editor-period-rate"
                className="font-bold text-slate-600 dark:text-slate-300 block mb-1"
              >
                Lãi suất kỳ #{selectedPeriod} (%/năm)
              </label>
              <input
                id="loan-editor-period-rate"
                data-testid="loan-editor-period-rate"
                type="number"
                min={0}
                max={35}
                step={0.05}
                disabled={isLocked}
                value={activePeriodOverride?.appliedRate ?? activePeriodRow?.appliedRate ?? 0}
                onChange={(e) =>
                  upsertSelectedPeriodOverride({
                    appliedRate: Math.max(0, Number(e.target.value) || 0),
                  })
                }
                className="w-full min-h-[40px] px-3 rounded-lg border border-[#DCE4EE] dark:border-slate-700 bg-slate-50 dark:bg-slate-800 disabled:opacity-65 disabled:cursor-not-allowed font-bold text-emerald-700 dark:text-emerald-300 tabular-nums"
              />
            </div>

            <div>
              <label
                htmlFor="loan-editor-period-note"
                className="font-bold text-slate-600 dark:text-slate-300 block mb-1"
              >
                Ghi chú dòng tiền kỳ #{selectedPeriod}
              </label>
              <input
                id="loan-editor-period-note"
                data-testid="loan-editor-period-note"
                type="text"
                disabled={isLocked}
                placeholder="VD: Sao kê điều chỉnh lãi BIDV"
                value={activePeriodOverride?.note ?? activePeriodRow?.overrideNote ?? ""}
                onChange={(e) =>
                  upsertSelectedPeriodOverride({
                    note: e.target.value,
                  })
                }
                className="w-full min-h-[40px] px-3 rounded-lg border border-[#DCE4EE] dark:border-slate-700 bg-slate-50 dark:bg-slate-800 disabled:opacity-65 disabled:cursor-not-allowed font-medium text-[#0F172A] dark:text-slate-100"
              />
            </div>
          </div>
        </div>
      </form>
    </section>
  );
}
