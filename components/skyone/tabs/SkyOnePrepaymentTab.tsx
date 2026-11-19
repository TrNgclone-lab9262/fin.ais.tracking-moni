"use client";

import React, { useMemo, useState } from "react";
import { CheckCircle2, Trash2 } from "lucide-react";
import {
  formatDateVN,
  formatShortVNDMasked,
  formatVNDMasked,
} from "@/lib/formatters";
import {
  getTodayIsoDate,
  MortgageScheduleSummary,
  simulatePrepayment,
  SkyOneTabSpecificMetrics,
} from "@/lib/mortgageEngine";
import {
  MortgageContract,
  MortgagePrepayStrategy,
} from "@/types/finance";

interface SkyOnePrepaymentTabProps {
  contract: MortgageContract;
  schedule: MortgageScheduleSummary;
  tabMetrics: SkyOneTabSpecificMetrics;
  isPrivacyMode: boolean;
  onRequestConfirmPrepayment: (input: {
    amount: number;
    afterPeriod: number;
    strategy: MortgagePrepayStrategy;
    date: string;
    note: string;
    penaltyAmount: number;
    penaltyFeePercent: number;
    netInterestSaved: number;
    remainingBalanceBefore: number;
  }) => void;
  onDeletePrepayment: (id: string) => void;
}

function parseNumericInput(val: string): number {
  const cleaned = val.replace(/[^0-9]/g, "");
  return cleaned ? parseInt(cleaned, 10) : 0;
}

export function SkyOnePrepaymentTab({
  contract,
  schedule,
  tabMetrics,
  isPrivacyMode,
  onRequestConfirmPrepayment,
  onDeletePrepayment,
}: SkyOnePrepaymentTabProps) {
  const defaultAfterPeriod = useMemo(() => {
    if (contract.paidRecords.length === 0) return 0;
    return Math.max(...contract.paidRecords.map((r) => r.period));
  }, [contract.paidRecords]);

  const [prepayAmountStr, setPrepayAmountStr] = useState<string>("100.000.000");
  const [prepayStrategy, setPrepayStrategy] = useState<MortgagePrepayStrategy>(
    contract.prepayStrategyDefault
  );
  const [selectedAfterPeriod, setSelectedAfterPeriod] = useState<number>(defaultAfterPeriod);
  const [prepayDate, setPrepayDate] = useState<string>(() => getTodayIsoDate());
  const [prepayNote, setPrepayNote] = useState<string>("");

  const effectiveAfterPeriod = Math.max(
    defaultAfterPeriod,
    Math.min(contract.termMonths, selectedAfterPeriod)
  );
  const prepayAmount = parseNumericInput(prepayAmountStr);

  const prepaySimulation = useMemo(
    () =>
      simulatePrepayment(contract, {
        amount: prepayAmount,
        afterPeriod: effectiveAfterPeriod,
        strategy: prepayStrategy,
        referenceDate: prepayDate,
      }),
    [contract, prepayAmount, effectiveAfterPeriod, prepayStrategy, prepayDate]
  );

  // Strategic A.12A.07 execution milestones
  const milestonePresets = useMemo(
    () => [
      {
        label: `Hiện tại (sau kỳ #${defaultAfterPeriod})`,
        period: defaultAfterPeriod,
      },
      {
        label: "Sau Đợt 2 Q3/2027 (#24)",
        period: Math.max(defaultAfterPeriod, 24),
      },
      {
        label: `Trước thả nổi (#${contract.fixedRateMonths})`,
        period: Math.max(defaultAfterPeriod, contract.fixedRateMonths),
      },
      {
        label: `Miễn phạt 0% (#${Math.max(37, contract.fixedRateMonths + 1)})`,
        period: Math.max(defaultAfterPeriod, Math.max(37, contract.fixedRateMonths + 1)),
      },
    ],
    [defaultAfterPeriod, contract.fixedRateMonths]
  );

  const handleOpenConfirm = () => {
    if (prepayAmount <= 0 || prepaySimulation.remainingBalanceBefore <= 0) return;
    onRequestConfirmPrepayment({
      amount: prepayAmount,
      afterPeriod: effectiveAfterPeriod,
      strategy: prepayStrategy,
      date: prepayDate,
      note: prepayNote,
      penaltyAmount: prepaySimulation.penaltyAmount,
      penaltyFeePercent: prepaySimulation.penaltyFeePercent,
      netInterestSaved: prepaySimulation.netInterestSaved,
      remainingBalanceBefore: prepaySimulation.remainingBalanceBefore,
    });
  };

  return (
    <div className="space-y-5">
      {/* Prepayment Impact 4-KPI Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5 sm:gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 shadow-xs p-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
            <span>Phí phạt năm vay thứ {tabMetrics.currentLoanYear}</span>
            <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300">
              Biểu phí BIDV
            </span>
          </div>
          <p className="text-lg sm:text-xl font-black text-amber-700 dark:text-amber-300 tabular-nums">
            {tabMetrics.currentPenaltyPercent}%
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
            Tính trên số gốc trả trước hạn tại kỳ hiện tại
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 shadow-xs p-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
            <span>Tổng gốc đã trả thêm</span>
            <span className="text-[11px] font-bold text-blue-700 dark:text-blue-400 tabular-nums">
              {contract.prepayments.length} đợt
            </span>
          </div>
          <p className="text-lg sm:text-xl font-black text-[#1E3A8A] dark:text-blue-300 tabular-nums">
            {formatVNDMasked(schedule.totalPrepaidAmount, isPrivacyMode)}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
            Phí phạt đã đóng: {formatShortVNDMasked(schedule.totalPrepaymentPenaltyPaid, isPrivacyMode)}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 shadow-xs p-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
            <span>Lãi tiết kiệm ròng thực tế</span>
            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
              -{schedule.monthsShortenedFromOriginal} tháng
            </span>
          </div>
          <p className="text-lg sm:text-xl font-black text-emerald-700 dark:text-emerald-400 tabular-nums">
            {formatVNDMasked(tabMetrics.actualPrepaymentInterestSaved, isPrivacyMode)}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
            Sau khi trừ toàn bộ phí phạt trả sớm
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 shadow-xs p-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
            <span>Mốc miễn phí phạt 0%</span>
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Chiến lược</span>
          </div>
          <p className="text-lg sm:text-xl font-black text-[#0F172A] dark:text-slate-100 tabular-nums">
            {tabMetrics.zeroPenaltyFromYear
              ? `Từ năm thứ ${tabMetrics.zeroPenaltyFromYear}`
              : "Theo hợp đồng"}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
            {tabMetrics.currentPenaltyPercent === 0
              ? "Hiện đã bước vào vùng miễn phí phạt"
              : `Còn ${Math.max(1, (tabMetrics.zeroPenaltyFromYear ?? 4) - tabMetrics.currentLoanYear)} năm tới mốc 0%`}
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Simulator Form + Comparison */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 shadow-xs p-5 space-y-5">
          <div>
            <h3 className="text-base font-bold text-[#172B4D] dark:text-slate-100">
              Mô phỏng Trả gốc trước hạn &amp; Tất toán sớm
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Chọn số tiền và mốc thời điểm trả gốc (kể cả sau Đợt 2 Q3/2027 hoặc mốc miễn phạt 0%) để tính lãi tiết kiệm ròng
            </p>
          </div>

          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block">
              Số tiền muốn trả gốc trước hạn (VND)
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={prepayAmountStr}
              onChange={(e) => {
                const n = parseNumericInput(e.target.value);
                setPrepayAmountStr(n > 0 ? new Intl.NumberFormat("vi-VN").format(n) : "");
              }}
              className="w-full min-h-[46px] px-3.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 text-base font-black text-[#1E3A8A] dark:text-blue-300 tabular-nums outline-none focus:border-blue-600"
            />
            <div className="flex flex-wrap gap-2">
              {[
                { label: "50 triệu", amount: 50_000_000 },
                { label: "100 triệu", amount: 100_000_000 },
                { label: "200 triệu", amount: 200_000_000 },
                { label: "Tất toán 100%", amount: prepaySimulation.remainingBalanceBefore },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() =>
                    setPrepayAmountStr(
                      new Intl.NumberFormat("vi-VN").format(Math.max(0, preset.amount))
                    )
                  }
                  className="min-h-[36px] px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/60 hover:text-blue-700 dark:hover:text-blue-300 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors whitespace-nowrap cursor-pointer"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* A.12A.07 Strategic Timing Selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 text-xs">
              <label className="font-bold text-slate-700 dark:text-slate-200">
                Thời điểm thực hiện (Sau kỳ số #)
              </label>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                Dư nợ tại mốc: {formatShortVNDMasked(prepaySimulation.remainingBalanceBefore, isPrivacyMode)}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {milestonePresets.map((preset) => {
                const active = effectiveAfterPeriod === preset.period;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setSelectedAfterPeriod(preset.period)}
                    className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-bold border transition-colors whitespace-nowrap cursor-pointer ${
                      active
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "bg-slate-50 dark:bg-slate-800 border-[#DCE4EE] dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/50"
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setPrepayStrategy("SHORTEN_TERM")}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                prepayStrategy === "SHORTEN_TERM"
                  ? "bg-blue-50 dark:bg-blue-950/60 border-blue-600 ring-1 ring-blue-600"
                  : "bg-slate-50 dark:bg-slate-800/70 border-[#DCE4EE] dark:border-slate-700"
              }`}
            >
              <p className="text-xs font-extrabold text-slate-900 dark:text-slate-100">
                Rút ngắn thời gian vay
              </p>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1">
                Giữ mức trả gốc hàng tháng, về đích tất toán sớm hơn để tối đa lãi tiết kiệm.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setPrepayStrategy("REDUCE_MONTHLY")}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                prepayStrategy === "REDUCE_MONTHLY"
                  ? "bg-blue-50 dark:bg-blue-950/60 border-blue-600 ring-1 ring-blue-600"
                  : "bg-slate-50 dark:bg-slate-800/70 border-[#DCE4EE] dark:border-slate-700"
              }`}
            >
              <p className="text-xs font-extrabold text-slate-900 dark:text-slate-100">
                Giảm tiền đóng hàng tháng
              </p>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1">
                Chia lại dư nợ còn lại cho số tháng cũ, giảm ngay áp lực DTI hàng tháng.
              </p>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                Ngày dự kiến thực hiện
              </label>
              <input
                type="date"
                value={prepayDate}
                onChange={(e) => setPrepayDate(e.target.value)}
                className="w-full min-h-[42px] px-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-blue-600"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                Ghi chú nguồn tiền (tùy chọn)
              </label>
              <input
                type="text"
                value={prepayNote}
                onChange={(e) => setPrepayNote(e.target.value)}
                placeholder="Ví dụ: Quỹ Đệm 08/2028 / Thưởng Tết"
                className="w-full min-h-[42px] px-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-blue-600"
              />
            </div>
          </div>

          {/* Simulation Output Box */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-[#DCE4EE] dark:border-slate-700 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-bold text-slate-600 dark:text-slate-300 tabular-nums">
                Áp dụng sau kỳ #{effectiveAfterPeriod} (Năm vay thứ {prepaySimulation.loanYearAtExecution})
              </span>
              <span
                className={`font-bold tabular-nums ${
                  prepaySimulation.penaltyFeePercent === 0
                    ? "text-emerald-700 dark:text-emerald-300"
                    : "text-amber-700 dark:text-amber-300"
                }`}
              >
                Phí phạt: {prepaySimulation.penaltyFeePercent}%
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-white dark:bg-slate-900 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                  Phí trả trước hạn
                </span>
                <span className="text-sm font-black text-rose-700 dark:text-rose-300 tabular-nums">
                  {formatVNDMasked(prepaySimulation.penaltyAmount, isPrivacyMode)}
                </span>
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                  Lãi tiết kiệm ròng
                </span>
                <span className="text-sm font-black text-emerald-700 dark:text-emerald-300 tabular-nums">
                  {formatVNDMasked(prepaySimulation.netInterestSaved, isPrivacyMode)}
                </span>
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                  {prepayStrategy === "SHORTEN_TERM" ? "Rút ngắn kỳ hạn" : "Giảm đóng kỳ tới"}
                </span>
                <span className="text-sm font-black text-blue-700 dark:text-blue-300 tabular-nums">
                  {prepayStrategy === "SHORTEN_TERM"
                    ? `${prepaySimulation.monthsSaved} tháng`
                    : `-${formatShortVNDMasked(prepaySimulation.monthlyPaymentReduction, isPrivacyMode)}/th`}
                </span>
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                  Ngày tất toán mới
                </span>
                <span className="text-sm font-black text-slate-900 dark:text-slate-100 tabular-nums">
                  {formatDateVN(prepaySimulation.newPayoffDate)}
                </span>
              </div>
            </div>

            <button
              type="button"
              disabled={prepayAmount <= 0 || prepaySimulation.remainingBalanceBefore <= 0}
              onClick={handleOpenConfirm}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-lg bg-[#1E3A8A] hover:bg-blue-900 dark:bg-blue-600 dark:hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-extrabold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Lưu đợt trả gốc trước hạn thực tế</span>
            </button>
          </div>
        </div>

        {/* Prepayment History Log */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 shadow-xs p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-[#172B4D] dark:text-slate-100">
              Lịch sử các đợt trả gốc trước hạn ({contract.prepayments.length})
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              Tổng đã trả thêm: {formatVNDMasked(schedule.totalPrepaidAmount, isPrivacyMode)}
            </p>
          </div>

          {contract.prepayments.length === 0 ? (
            <div className="p-6 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-dashed border-slate-200 dark:border-slate-700 text-center text-xs text-slate-500 dark:text-slate-400">
              Chưa có đợt trả gốc trước hạn nào được ghi nhận. Bạn có thể chọn mốc chiến lược bên trái (VD: Trước thả nổi #36) để mô phỏng.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[440px] overflow-y-auto">
              {contract.prepayments.map((p) => (
                <div
                  key={p.id}
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-[#E9EEF5] dark:border-slate-700 flex items-start justify-between gap-3 text-xs"
                >
                  <div className="space-y-1 min-w-0">
                    <p className="font-black text-emerald-700 dark:text-emerald-300 text-sm tabular-nums">
                      +{formatVNDMasked(p.amount, isPrivacyMode)}
                    </p>
                    <p className="text-slate-600 dark:text-slate-300 font-semibold tabular-nums">
                      Ngày {formatDateVN(p.date)} · Sau kỳ #{p.afterPeriod} ·{" "}
                      {p.strategy === "SHORTEN_TERM" ? "Rút ngắn kỳ" : "Giảm đóng tháng"}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                      Phí phạt {p.feePercent}% ({formatVNDMasked(p.penaltyAmount, isPrivacyMode)})
                      {p.note ? ` · ${p.note}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeletePrepayment(p.id)}
                    aria-label="Xóa đợt trả gốc trước hạn"
                    className="p-2 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
