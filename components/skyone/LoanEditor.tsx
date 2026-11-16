"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Lock, Save, SlidersHorizontal, Unlock, X } from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import {
  generateMortgageSchedule,
  MAX_MORTGAGE_TERM_MONTHS,
  MAX_MORTGAGE_TERM_YEARS,
} from "@/lib/mortgageEngine";
import { formatDateVN, formatVNDMasked } from "@/lib/formatters";
import { MortgageContract, MortgageInterestBasis } from "@/types/finance";

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

  useEffect(() => {
    const cleanTerm = Math.min(
      MAX_MORTGAGE_TERM_MONTHS,
      Math.max(12, skyoneLoan.termMonths || 360)
    );
    setTermMonths(cleanTerm);
    setFixedRateMonths(Math.min(cleanTerm, Math.max(0, skyoneLoan.fixedRateMonths)));
    setFixedInterestRate(skyoneLoan.fixedInterestRate);
    setFloatingBaseRate(skyoneLoan.floatingBaseRate);
    setFloatingSpread(skyoneLoan.floatingSpread);
    setMonthlyPrincipalOverride(skyoneLoan.monthlyPrincipalOverride ?? 0);
    setPaymentDayOfMonth(skyoneLoan.paymentDayOfMonth);
    setInterestBasis(skyoneLoan.interestBasis || "ACTUAL_365");
  }, [skyoneLoan, isLocked]);

  const currentSchedule = useMemo(() => generateMortgageSchedule(skyoneLoan), [skyoneLoan]);

  const draftContract = useMemo<MortgageContract>(() => {
    const cleanTerm = Math.max(
      12,
      Math.min(MAX_MORTGAGE_TERM_MONTHS, Math.round(termMonths))
    );
    return {
      ...skyoneLoan,
      termMonths: cleanTerm,
      fixedRateMonths: Math.max(0, Math.min(cleanTerm, Math.round(fixedRateMonths))),
      fixedInterestRate: Math.max(0, fixedInterestRate),
      floatingBaseRate: Math.max(0, floatingBaseRate),
      floatingSpread: Math.max(0, floatingSpread),
      monthlyPrincipalOverride: Math.max(0, Math.round(monthlyPrincipalOverride)),
      paymentDayOfMonth: Math.max(1, Math.min(28, Math.round(paymentDayOfMonth))),
      interestBasis,
    };
  }, [
    skyoneLoan,
    termMonths,
    fixedRateMonths,
    fixedInterestRate,
    floatingBaseRate,
    floatingSpread,
    monthlyPrincipalOverride,
    paymentDayOfMonth,
    interestBasis,
  ]);

  const previewSchedule = useMemo(
    () => (isLocked ? currentSchedule : generateMortgageSchedule(draftContract)),
    [isLocked, currentSchedule, draftContract]
  );

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
    setTermMonths(cleanTerm);
    setFixedRateMonths(Math.min(cleanTerm, Math.max(0, skyoneLoan.fixedRateMonths)));
    setFixedInterestRate(skyoneLoan.fixedInterestRate);
    setFloatingBaseRate(skyoneLoan.floatingBaseRate);
    setFloatingSpread(skyoneLoan.floatingSpread);
    setMonthlyPrincipalOverride(skyoneLoan.monthlyPrincipalOverride ?? 0);
    setPaymentDayOfMonth(skyoneLoan.paymentDayOfMonth);
    setInterestBasis(skyoneLoan.interestBasis || "ACTUAL_365");
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
        termMonths: cleanTerm,
        fixedRateMonths: cleanFixedMonths,
        fixedInterestRate: Math.max(0, fixedInterestRate),
        floatingBaseRate: Math.max(0, floatingBaseRate),
        floatingSpread: Math.max(0, floatingSpread),
        monthlyPrincipalOverride: Math.max(0, Math.round(monthlyPrincipalOverride)),
        paymentDayOfMonth: Math.max(1, Math.min(28, Math.round(paymentDayOfMonth))),
        interestBasis,
      },
      periodOverrides: skyoneLoan.periodOverrides || [],
    });

    onSaved?.(
      "Đã lưu thông số lãi suất, gốc & dòng tiền vào hồ sơ SKYONE và khóa bảo vệ trở lại."
    );
  };

  return (
    <section
      data-testid="skyone-loan-editor"
      aria-label="Trình điều chỉnh Lãi suất, Gốc & Dòng tiền SKYONE"
      className="bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 shadow-xs p-4 sm:p-5 space-y-4"
    >
      {/* Header + Lock / Unlock Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E9EEF5] dark:border-slate-800">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 text-[#1E3A8A] dark:text-blue-300 flex items-center justify-center shrink-0 mt-0.5">
            {isLocked ? <Lock className="w-4 h-4" /> : <SlidersHorizontal className="w-4 h-4" />}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-bold text-[#172B4D] dark:text-slate-100 leading-snug">
              Điều chỉnh Lãi suất, Gốc trả &amp; Dòng tiền hợp đồng
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 tabular-nums">
              {isLocked ? (
                <>
                  Đang khóa mặc định để bảo vệ số liệu sao kê · Bấm Mở khóa để sửa lãi suất, gốc đều và kỳ hạn (≤ {MAX_MORTGAGE_TERM_YEARS} năm).
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

      {/* Form Body */}
      <form
        id="skyone-loan-editor-form"
        onSubmit={handleSave}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs"
      >
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
            step={50000}
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
      </form>
    </section>
  );
}
