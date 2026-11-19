"use client";

import React, { useEffect, useState } from "react";
import {
  Building2,
  FileCheck2,
  Lock,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Unlock,
  X,
} from "lucide-react";
import {
  formatDateVN,
  formatShortVNDMasked,
  formatVNDMasked,
} from "@/lib/formatters";
import {
  getTodayIsoDate,
  hasPinkBook5PctEnabled,
  isRealBidvProfileSynced,
  MAX_MORTGAGE_TERM_MONTHS,
  MAX_MORTGAGE_TERM_YEARS,
  MortgageScheduleSummary,
  SkyOneTabSpecificMetrics,
} from "@/lib/mortgageEngine";
import { MortgageContract } from "@/types/finance";
import { SKYONE_A12A07_VERIFIED_FACTS } from "@/system_context";

interface SkyOneContractTabProps {
  contract: MortgageContract;
  schedule: MortgageScheduleSummary;
  tabMetrics: SkyOneTabSpecificMetrics;
  isPrivacyMode: boolean;
  onUpdateContract: (patch: Partial<MortgageContract>) => void;
  onTogglePinkBook5Pct: (enabled?: boolean) => void;
  onAddRateAdjustment: (input: {
    effectiveFromPeriod: number;
    annualRate: number;
    effectiveDate: string;
    note?: string;
  }) => void;
  onDeleteRateAdjustment: (id: string) => void;
  onRequestResetBidv: () => void;
  onShowToast: (message: string) => void;
}

export function SkyOneContractTab({
  contract,
  schedule,
  tabMetrics,
  isPrivacyMode,
  onUpdateContract,
  onTogglePinkBook5Pct,
  onAddRateAdjustment,
  onDeleteRateAdjustment,
  onRequestResetBidv,
  onShowToast,
}: SkyOneContractTabProps) {
  const [isFormUnlocked, setIsFormUnlocked] = useState(false);
  const [contractDraft, setContractDraft] = useState<MortgageContract>(() => contract);
  const [isDirty, setIsDirty] = useState(false);

  // Rate Adjustment Form State
  const [adjFromPeriod, setAdjFromPeriod] = useState<string>(() =>
    String(contract.fixedRateMonths + 1)
  );
  const [adjRate, setAdjRate] = useState<string>("10.0");
  const [adjDate, setAdjDate] = useState<string>(() => getTodayIsoDate());
  const [adjNote, setAdjNote] = useState<string>("");

  useEffect(() => {
    if (!isFormUnlocked || !isDirty) {
      setContractDraft(contract);
    }
  }, [contract, isFormUnlocked, isDirty]);

  const pinkBookEnabled = hasPinkBook5PctEnabled(contract);
  const syncedWithA12A07 = isRealBidvProfileSynced(contract);

  const updateDraftField = <K extends keyof MortgageContract>(
    key: K,
    value: MortgageContract[K]
  ) => {
    setContractDraft((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  const handleSaveContract = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTerm = Math.max(
      12,
      Math.min(MAX_MORTGAGE_TERM_MONTHS, Math.round(contractDraft.termMonths || 360))
    );
    const cleanPayDay = Math.max(1, Math.min(28, Math.round(contractDraft.paymentDayOfMonth || 10)));
    const cleanFixedMonths = Math.max(
      0,
      Math.min(cleanTerm, Math.round(contractDraft.fixedRateMonths || 0))
    );

    onUpdateContract({
      projectName: contractDraft.projectName.trim() || contract.projectName,
      unitCode: contractDraft.unitCode.trim() || contract.unitCode,
      bankName: contractDraft.bankName.trim() || contract.bankName,
      disbursementDate: contractDraft.disbursementDate,
      propertyValue: Math.max(0, Math.round(contractDraft.propertyValue)),
      currentMarketValue: Math.max(0, Math.round(contractDraft.currentMarketValue)),
      downPayment: Math.max(0, Math.round(contractDraft.downPayment)),
      creditLimit: Math.max(
        Math.round(contractDraft.loanAmount),
        Math.round(contractDraft.creditLimit ?? contractDraft.loanAmount)
      ),
      loanAmount: Math.max(0, Math.round(contractDraft.loanAmount)),
      termMonths: cleanTerm,
      paymentDayOfMonth: cleanPayDay,
      fixedRateMonths: cleanFixedMonths,
      fixedInterestRate: Math.max(0, contractDraft.fixedInterestRate),
      floatingBaseRate: Math.max(0, contractDraft.floatingBaseRate),
      floatingSpread: Math.max(0, contractDraft.floatingSpread),
      monthlyPrincipalOverride: Math.max(0, Math.round(contractDraft.monthlyPrincipalOverride ?? 0)),
      interestBasis: contractDraft.interestBasis || "ACTUAL_365",
    });

    setIsDirty(false);
    setIsFormUnlocked(false);
    onShowToast("Đã lưu thông số gốc hợp đồng SKYONE và khóa bảo vệ trở lại.");
  };

  const handleCancelEdit = () => {
    setContractDraft(contract);
    setIsDirty(false);
    setIsFormUnlocked(false);
  };

  const handleAddRateAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    const fromP = Math.max(1, parseInt(adjFromPeriod, 10) || 1);
    const rateVal = Math.max(0.1, Math.min(35, parseFloat(adjRate) || 0));
    onAddRateAdjustment({
      effectiveFromPeriod: fromP,
      annualRate: rateVal,
      effectiveDate: adjDate || getTodayIsoDate(),
      note: adjNote.trim() || `Điều chỉnh lãi suất từ kỳ #${fromP}`,
    });
    setAdjNote("");
    onShowToast(
      `Đã lưu mốc điều chỉnh ${rateVal}% từ kỳ #${fromP}. Các kỳ đã đóng giữ nguyên lịch sử.`
    );
  };

  const facts = SKYONE_A12A07_VERIFIED_FACTS;

  return (
    <div className="space-y-5">
      {/* Contract Terms 4-KPI Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5 sm:gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 shadow-xs p-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
            <span>Tỷ lệ đã giải ngân</span>
            <span className="text-[11px] font-bold text-blue-700 dark:text-blue-400 tabular-nums">
              {formatShortVNDMasked(contract.loanAmount, isPrivacyMode)} /{" "}
              {formatShortVNDMasked(tabMetrics.creditLimit, isPrivacyMode)}
            </span>
          </div>
          <p className="text-lg sm:text-xl font-black text-[#1E3A8A] dark:text-blue-300 tabular-nums">
            {tabMetrics.disbursedRatioPct}% hạn mức
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
            Chờ Đợt 2: {formatShortVNDMasked(tabMetrics.remainingCreditHeadroom, isPrivacyMode)}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 shadow-xs p-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
            <span>Chuẩn tính lãi &amp; Ngày thu</span>
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 tabular-nums">
              Ngày {contract.paymentDayOfMonth}
            </span>
          </div>
          <p className="text-lg sm:text-xl font-black text-[#0F172A] dark:text-slate-100 tabular-nums">
            {contract.interestBasis === "THIRTY_360" ? "30 / 360" : "Actual / 365"}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
            Giải ngân đầu: {formatDateVN(contract.disbursementDate)} · {contract.termMonths} tháng
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 shadow-xs p-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
            <span>Ưu đãi cố định còn lại</span>
            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
              {contract.fixedInterestRate.toFixed(2)}%/năm
            </span>
          </div>
          <p className="text-lg sm:text-xl font-black text-emerald-700 dark:text-emerald-400 tabular-nums">
            {schedule.remainingFixedMonths}/{contract.fixedRateMonths} tháng
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Giai đoạn: {schedule.currentStage === "FIXED" ? "Ưu đãi cố định" : "Thả nổi"}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 shadow-xs p-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
            <span>Lãi thả nổi dự kiến</span>
            <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300">Sau ưu đãi</span>
          </div>
          <p className="text-lg sm:text-xl font-black text-amber-700 dark:text-amber-300 tabular-nums">
            {(contract.floatingBaseRate + contract.floatingSpread).toFixed(2)}%/năm
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
            Cơ sở {contract.floatingBaseRate.toFixed(2)}% + Biên độ {contract.floatingSpread.toFixed(2)}%
          </p>
        </div>
      </section>

      {/* LEGAL DOSSIER & BIDV DISBURSEMENT PROGRESS (A.12A.07) */}
      <section className="bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 shadow-xs p-5 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 flex items-center justify-center shrink-0">
              <FileCheck2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-[#172B4D] dark:text-slate-100">
                Hồ sơ Pháp lý HĐMB &amp; Tiến độ Giải ngân BIDV
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {facts.property.unitDisplayLabel} · {facts.property.developerName}
              </p>
            </div>
          </div>

          <button
            type="button"
            data-testid="contract-sync-bidv-btn"
            onClick={onRequestResetBidv}
            className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>
              {syncedWithA12A07
                ? "Khôi phục chuẩn HĐMB A.12A.07"
                : "Nạp chuẩn HĐMB A.12A.07 & BIDV"}
            </span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 text-xs">
          {/* Left: HDMB Pricing + 5 Self-Funded Tranches */}
          <div className="lg:col-span-6 space-y-4">
            <div className="space-y-2">
              <h4 className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Cấu trúc giá bán theo Điều 3 HĐMB</span>
              </h4>
              <dl className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200/80 dark:border-slate-800 rounded-lg px-3.5 tabular-nums">
                <div className="py-2 flex justify-between gap-2">
                  <dt className="text-slate-500 dark:text-slate-400">Giá bán chưa VAT</dt>
                  <dd className="font-semibold text-slate-800 dark:text-slate-200">
                    {formatVNDMasked(facts.pricing.priceBeforeVat, isPrivacyMode)}
                  </dd>
                </div>
                <div className="py-2 flex justify-between gap-2">
                  <dt className="text-slate-500 dark:text-slate-400">Thuế GTGT (VAT tạm tính)</dt>
                  <dd className="font-semibold text-slate-800 dark:text-slate-200">
                    {formatVNDMasked(facts.pricing.vatEstimated, isPrivacyMode)}
                  </dd>
                </div>
                <div className="py-2 flex justify-between gap-2">
                  <dt className="font-bold text-slate-800 dark:text-slate-100">
                    Tổng giá trị HĐMB (gồm VAT)
                  </dt>
                  <dd className="font-black text-[#1E3A8A] dark:text-blue-300">
                    {formatVNDMasked(facts.pricing.totalContractPriceWithVat, isPrivacyMode)}
                  </dd>
                </div>
                <div className="py-2 flex justify-between gap-2">
                  <dt className="text-slate-500 dark:text-slate-400">Kinh phí bảo trì 2% (nộp Q3/2027)</dt>
                  <dd className="font-bold text-amber-700 dark:text-amber-300">
                    {formatVNDMasked(facts.pricing.maintenanceFee2Pct, isPrivacyMode)}
                  </dd>
                </div>
              </dl>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Bảo lãnh: {facts.property.guaranteeBank} · {facts.property.eligibilityNotice}.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-700 dark:text-slate-200">
                  5 đợt vốn tự có đã đóng (2024)
                </h4>
                <span className="font-extrabold text-emerald-700 dark:text-emerald-400 tabular-nums">
                  {formatVNDMasked(facts.totalActualDownPayment, isPrivacyMode)}
                </span>
              </div>
              <div className="overflow-x-auto rounded-lg border border-slate-200/80 dark:border-slate-800">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                      <th className="py-2 px-3 font-semibold">Đợt</th>
                      <th className="py-2 px-3 font-semibold">Ngày nộp</th>
                      <th className="py-2 px-3 font-semibold">Nội dung</th>
                      <th className="py-2 px-3 font-semibold text-right">Số tiền</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 tabular-nums">
                    {facts.actualSelfFundedTranches2024.map((item) => (
                      <tr key={item.tranche}>
                        <td className="py-1.5 px-3 font-bold text-slate-700 dark:text-slate-200">
                          Đợt {item.tranche}
                        </td>
                        <td className="py-1.5 px-3 text-slate-600 dark:text-slate-300">
                          {formatDateVN(item.date)}
                        </td>
                        <td className="py-1.5 px-3 text-slate-600 dark:text-slate-300">
                          {item.label}
                        </td>
                        <td className="py-1.5 px-3 text-right font-bold text-slate-800 dark:text-slate-100">
                          {formatVNDMasked(item.amount, isPrivacyMode)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right: BIDV Disbursement Tranches + 5% Pink Book Toggle */}
          <div className="lg:col-span-6 space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-bold text-slate-700 dark:text-slate-200">
                  Tiến độ giải ngân BIDV (TK ****{facts.bidvLoan.accountMasked.slice(-4)})
                </h4>
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                  Trần thông báo: {formatShortVNDMasked(facts.bidvLoan.noticeLetterMaxCeiling, isPrivacyMode)}
                </span>
              </div>

              <div className="space-y-2.5">
                <div className="p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/70 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-900 dark:text-slate-100">
                      Đợt 1 · Đã giải ngân ({formatDateVN(facts.bidvLoan.disbursementDate)})
                    </p>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                      Gốc đều 3,056tr/tháng · 3 kỳ đầu + 12 kỳ sao kê → Dư nợ 662,23tr
                    </p>
                  </div>
                  <span className="font-black text-emerald-700 dark:text-emerald-300 tabular-nums whitespace-nowrap">
                    {formatVNDMasked(facts.bidvLoan.tranche1DisbursedAmount, isPrivacyMode)}
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-800/70 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-900 dark:text-slate-100">
                      Đợt 2 · Kế hoạch bàn giao (Quý III/2027 · Kỳ #{facts.bidvLoan.tranche2PlannedAfterPeriod})
                    </p>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                      Tự động cộng vào dư nợ trên Lịch trả nợ, Biểu đồ &amp; Cố vấn
                    </p>
                  </div>
                  <span className="font-black text-[#1E3A8A] dark:text-blue-300 tabular-nums whitespace-nowrap">
                    +{formatVNDMasked(facts.bidvLoan.tranche2PlannedAmount, isPrivacyMode)}
                  </span>
                </div>

                {/* Interactive Toggle for 5% Pink Book Tranche */}
                <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-[#DCE4EE] dark:border-slate-700 space-y-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 dark:text-slate-100">
                        Mốc 5% nhận Sổ hồng ({formatVNDMasked(facts.bidvLoan.pinkBook5PctAmount, isPrivacyMode)})
                      </p>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                        {pinkBookEnabled
                          ? "Đang BẬT: gộp thêm +72,31tr vào lịch giải ngân Q3/2027 (tổng giải ngân bổ sung 465,68tr)."
                          : "Đang TẮT: giữ riêng như khoản tiền mặt gia đình tự chuẩn bị cùng PBT 2% (tổng 101,24tr)."}
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={pinkBookEnabled}
                      data-testid="contract-pinkbook-toggle"
                      onClick={() => {
                        onTogglePinkBook5Pct(!pinkBookEnabled);
                        onShowToast(
                          !pinkBookEnabled
                            ? "Đã bật gộp mốc 5% Sổ hồng (+72,31tr) vào lịch giải ngân Q3/2027."
                            : "Đã tắt mốc 5% Sổ hồng khỏi dư nợ vay (chuyển về dự phòng tiền mặt)."
                        );
                      }}
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                        pinkBookEnabled
                          ? "bg-indigo-600 dark:bg-indigo-500"
                          : "bg-slate-300 dark:bg-slate-600"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          pinkBookEnabled ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SINGLE PROTECTED CONTRACT PARAMETER FORM + RATE ADJUSTMENTS / PENALTY TIERS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form
          onSubmit={handleSaveContract}
          className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 shadow-xs p-5 space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-base font-bold text-[#172B4D] dark:text-slate-100">
                Thông số gốc Hợp đồng vay &amp; Tài sản
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Nguồn chỉnh sửa duy nhất cho toàn bộ Sub-app SKYONE (khóa mặc định để tránh sửa nhầm)
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {!isFormUnlocked ? (
                <button
                  type="button"
                  data-testid="contract-form-unlock-btn"
                  onClick={() => setIsFormUnlocked(true)}
                  className="min-h-[38px] px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-200 text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <Unlock className="w-3.5 h-3.5" />
                  <span>Mở khóa sửa hợp đồng</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="min-h-[38px] px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Hủy</span>
                  </button>
                  <button
                    type="submit"
                    disabled={!isDirty}
                    className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-[#1E3A8A] hover:bg-blue-900 dark:bg-blue-600 dark:hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Lưu &amp; Khóa</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {!isFormUnlocked && (
            <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 rounded-lg px-3 py-2">
              <Lock className="w-3.5 h-3.5 shrink-0" />
              <span>
                Các ô thông số gốc đang khóa. Bấm <strong>Mở khóa sửa hợp đồng</strong> để cập nhật giá trị vay, kỳ hạn hoặc lãi suất; nếu cần chỉnh tay từng kỳ, thực hiện tại tab <strong>Lịch trả nợ</strong>.
              </span>
            </div>
          )}

          <fieldset disabled={!isFormUnlocked} className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs disabled:opacity-80">
            <div>
              <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Tên dự án</label>
              <input
                type="text"
                value={contractDraft.projectName}
                onChange={(e) => updateDraftField("projectName", e.target.value)}
                className="w-full min-h-[40px] px-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 font-semibold text-slate-800 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">
                Mã căn hiển thị (Header/Sidebar)
              </label>
              <input
                type="text"
                value={contractDraft.unitCode}
                onChange={(e) => updateDraftField("unitCode", e.target.value)}
                className="w-full min-h-[40px] px-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 font-semibold text-slate-800 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Ngân hàng giải ngân</label>
              <input
                type="text"
                value={contractDraft.bankName}
                onChange={(e) => updateDraftField("bankName", e.target.value)}
                className="w-full min-h-[40px] px-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 font-semibold text-slate-800 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Ngày giải ngân Đợt 1</label>
              <input
                type="date"
                value={contractDraft.disbursementDate}
                onChange={(e) => updateDraftField("disbursementDate", e.target.value)}
                className="w-full min-h-[40px] px-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 font-semibold text-slate-800 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Giá trị HĐMB (gồm VAT · VND)</label>
              <input
                type="number"
                value={contractDraft.propertyValue}
                onChange={(e) => updateDraftField("propertyValue", Number(e.target.value) || 0)}
                className="w-full min-h-[40px] px-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 font-bold text-slate-800 dark:text-slate-100 tabular-nums"
              />
            </div>
            <div>
              <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Định giá thị trường (VND)</label>
              <input
                type="number"
                value={contractDraft.currentMarketValue}
                onChange={(e) =>
                  updateDraftField("currentMarketValue", Number(e.target.value) || 0)
                }
                className="w-full min-h-[40px] px-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 font-bold text-slate-800 dark:text-slate-100 tabular-nums"
              />
            </div>
            <div>
              <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Vốn tự có 5 đợt (VND)</label>
              <input
                type="number"
                value={contractDraft.downPayment}
                onChange={(e) => updateDraftField("downPayment", Number(e.target.value) || 0)}
                className="w-full min-h-[40px] px-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 font-bold text-slate-800 dark:text-slate-100 tabular-nums"
              />
            </div>
            <div>
              <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Hạn mức kế hoạch giải ngân (VND)</label>
              <input
                type="number"
                value={contractDraft.creditLimit ?? contractDraft.loanAmount}
                onChange={(e) => updateDraftField("creditLimit", Number(e.target.value) || 0)}
                className="w-full min-h-[40px] px-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 font-bold text-slate-800 dark:text-slate-100 tabular-nums"
              />
            </div>
            <div>
              <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Giải ngân Đợt 1 thực tế (VND)</label>
              <input
                type="number"
                value={contractDraft.loanAmount}
                onChange={(e) => updateDraftField("loanAmount", Number(e.target.value) || 0)}
                className="w-full min-h-[40px] px-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 font-bold text-slate-800 dark:text-slate-100 tabular-nums"
              />
            </div>
            <div>
              <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">
                Kỳ hạn vay (tháng · ≤ {MAX_MORTGAGE_TERM_YEARS} năm)
              </label>
              <input
                type="number"
                min={12}
                max={MAX_MORTGAGE_TERM_MONTHS}
                value={contractDraft.termMonths}
                onChange={(e) =>
                  updateDraftField(
                    "termMonths",
                    Math.min(MAX_MORTGAGE_TERM_MONTHS, Number(e.target.value) || 12)
                  )
                }
                className="w-full min-h-[40px] px-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 font-bold text-slate-800 dark:text-slate-100 tabular-nums"
              />
            </div>
            <div>
              <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Ngày trả hàng tháng (1–28)</label>
              <input
                type="number"
                min={1}
                max={28}
                value={contractDraft.paymentDayOfMonth}
                onChange={(e) =>
                  updateDraftField("paymentDayOfMonth", Number(e.target.value) || 10)
                }
                className="w-full min-h-[40px] px-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 font-bold text-slate-800 dark:text-slate-100 tabular-nums"
              />
            </div>
            <div>
              <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Số tháng lãi cố định</label>
              <input
                type="number"
                min={0}
                max={Math.min(MAX_MORTGAGE_TERM_MONTHS, contractDraft.termMonths)}
                value={contractDraft.fixedRateMonths}
                onChange={(e) =>
                  updateDraftField("fixedRateMonths", Number(e.target.value) || 0)
                }
                className="w-full min-h-[40px] px-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 font-bold text-slate-800 dark:text-slate-100 tabular-nums"
              />
            </div>
            <div>
              <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Lãi cố định ưu đãi (%/năm)</label>
              <input
                type="number"
                step="0.05"
                value={contractDraft.fixedInterestRate}
                onChange={(e) =>
                  updateDraftField("fixedInterestRate", Number(e.target.value) || 0)
                }
                className="w-full min-h-[40px] px-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 font-bold text-slate-800 dark:text-slate-100 tabular-nums"
              />
            </div>
            <div>
              <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Lãi cơ sở thả nổi (%/năm)</label>
              <input
                type="number"
                step="0.05"
                value={contractDraft.floatingBaseRate}
                onChange={(e) =>
                  updateDraftField("floatingBaseRate", Number(e.target.value) || 0)
                }
                className="w-full min-h-[40px] px-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 font-bold text-slate-800 dark:text-slate-100 tabular-nums"
              />
            </div>
            <div>
              <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Biên độ thả nổi (%/năm)</label>
              <input
                type="number"
                step="0.05"
                value={contractDraft.floatingSpread}
                onChange={(e) =>
                  updateDraftField("floatingSpread", Number(e.target.value) || 0)
                }
                className="w-full min-h-[40px] px-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 font-bold text-slate-800 dark:text-slate-100 tabular-nums"
              />
            </div>
            <div>
              <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">
                Gốc đều hợp đồng/tháng (0 = tự chia đều)
              </label>
              <input
                type="number"
                min={0}
                value={contractDraft.monthlyPrincipalOverride ?? 0}
                onChange={(e) =>
                  updateDraftField("monthlyPrincipalOverride", Number(e.target.value) || 0)
                }
                className="w-full min-h-[40px] px-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 font-bold text-slate-800 dark:text-slate-100 tabular-nums"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">
                Chuẩn đếm ngày tính lãi
              </label>
              <select
                value={contractDraft.interestBasis || "ACTUAL_365"}
                onChange={(e) =>
                  updateDraftField(
                    "interestBasis",
                    e.target.value === "THIRTY_360" ? "THIRTY_360" : "ACTUAL_365"
                  )
                }
                className="w-full min-h-[40px] px-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 font-semibold text-slate-800 dark:text-slate-100"
              >
                <option value="ACTUAL_365">Actual/365 (Chuẩn BIDV thực tế)</option>
                <option value="THIRTY_360">30/360 (Chia đều 12 tháng)</option>
              </select>
            </div>
          </fieldset>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 text-xs">
            <span className="text-slate-500 dark:text-slate-400">
              Lãi suất thả nổi dự kiến:{" "}
              <strong className="text-slate-800 dark:text-slate-100 tabular-nums">
                {(contractDraft.floatingBaseRate + contractDraft.floatingSpread).toFixed(2)}%/năm
              </strong>
            </span>
            {isFormUnlocked && (
              <button
                type="submit"
                disabled={!isDirty}
                className="min-h-[40px] px-4 py-2 rounded-lg bg-[#1E3A8A] hover:bg-blue-900 dark:bg-blue-600 dark:hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-extrabold cursor-pointer"
              >
                Lưu thông số hợp đồng
              </button>
            )}
          </div>
        </form>

        {/* Right Column: Bank Rate Adjustment Milestones + Penalty Tiers */}
        <div className="lg:col-span-5 space-y-6">
          <form
            onSubmit={handleAddRateAdjustment}
            className="bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 shadow-xs p-5 space-y-3.5"
          >
            <div>
              <h3 className="text-sm font-bold text-[#172B4D] dark:text-slate-100">
                Mốc điều chỉnh lãi suất thực tế từ ngân hàng
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Các kỳ đã xác nhận <strong>Đã đóng</strong> luôn giữ nguyên snapshot lịch sử, chỉ tính lãi mới từ kỳ áp dụng trở đi.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div>
                <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Từ kỳ số #</label>
                <input
                  type="number"
                  min={1}
                  max={contract.termMonths}
                  value={adjFromPeriod}
                  onChange={(e) => setAdjFromPeriod(e.target.value)}
                  className="w-full min-h-[40px] px-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 font-bold text-slate-800 dark:text-slate-100 tabular-nums"
                />
              </div>
              <div>
                <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Lãi suất mới (%/năm)</label>
                <input
                  type="number"
                  step="0.05"
                  value={adjRate}
                  onChange={(e) => setAdjRate(e.target.value)}
                  className="w-full min-h-[40px] px-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 font-bold text-slate-800 dark:text-slate-100 tabular-nums"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div>
                <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Ngày thông báo</label>
                <input
                  type="date"
                  value={adjDate}
                  onChange={(e) => setAdjDate(e.target.value)}
                  className="w-full min-h-[40px] px-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 font-semibold text-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Ghi chú ngân hàng</label>
                <input
                  type="text"
                  value={adjNote}
                  onChange={(e) => setAdjNote(e.target.value)}
                  placeholder="VD: BIDV điều chỉnh thả nổi Q4"
                  className="w-full min-h-[40px] px-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 font-semibold text-slate-800 dark:text-slate-100"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full min-h-[42px] px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm mốc điều chỉnh lãi suất</span>
            </button>

            {contract.rateAdjustments.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                {contract.rateAdjustments.map((adj) => (
                  <div
                    key={adj.id}
                    className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-[#E9EEF5] dark:border-slate-700 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 dark:text-slate-100 tabular-nums">
                        Từ kỳ #{adj.effectiveFromPeriod}: {adj.annualRate.toFixed(2)}%/năm
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {formatDateVN(adj.effectiveDate)}
                        {adj.note ? ` · ${adj.note}` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onDeleteRateAdjustment(adj.id)}
                      aria-label="Xóa mốc lãi suất"
                      className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </form>

          {/* Penalty Tier Table */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 shadow-xs p-5 space-y-2.5">
            <h3 className="text-sm font-bold text-[#172B4D] dark:text-slate-100">
              Biểu phí phạt trả nợ trước hạn theo năm
            </h3>
            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {contract.prepaymentPenaltyTiers.map((tier, idx) => (
                <div key={idx} className="py-2 flex items-center justify-between tabular-nums">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {tier.fromYear === tier.toYear
                      ? `Năm thứ ${tier.fromYear}`
                      : `Từ năm ${tier.fromYear} đến năm ${tier.toYear}`}
                  </span>
                  <span className="font-black text-slate-900 dark:text-slate-100">{tier.feePercent}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
