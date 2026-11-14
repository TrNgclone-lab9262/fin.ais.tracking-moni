"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  CreditCard,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { CreditCardInfo, useFinance } from "@/context/FinanceContext";
import { formatVNDMasked } from "@/lib/formatters";

interface CreditCardRepaymentSheetProps {
  cardInfo: CreditCardInfo | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CreditCardRepaymentSheet({
  cardInfo,
  isOpen,
  onClose,
  onSuccess,
}: CreditCardRepaymentSheetProps) {
  const { accounts, addTransaction, isPrivacyMode } = useFinance();

  const [paymentOption, setPaymentOption] = useState<"FULL" | "MINIMUM">("FULL");
  const [sourceAccountId, setSourceAccountId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eligibleSourceAccounts = accounts.filter(
    (a) => a.type !== "CREDIT_CARD" && a.currentBalance > 0
  );

  useEffect(() => {
    if (isOpen) {
      setPaymentOption("FULL");
      setError(null);
      if (eligibleSourceAccounts.length > 0) {
        const sameOwner = eligibleSourceAccounts.find(
          (a) => a.owner === cardInfo?.account.owner
        );
        setSourceAccountId(sameOwner ? sameOwner.id : eligibleSourceAccounts[0].id);
      }
    }
  }, [isOpen, cardInfo]);

  if (!isOpen || !cardInfo) return null;

  const fullAmount = cardInfo.usedAmount;
  const minimumAmount = Math.max(50000, Math.round(fullAmount * 0.05));
  const selectedAmount = paymentOption === "FULL" ? fullAmount : minimumAmount;

  const selectedSourceAccount = accounts.find((a) => a.id === sourceAccountId);

  const handleConfirmRepayment = () => {
    if (selectedAmount <= 0) {
      setError("Thẻ này hiện không có dư nợ cần thanh toán!");
      return;
    }

    if (!selectedSourceAccount) {
      setError("Vui lòng chọn tài khoản nguồn trích tiền!");
      return;
    }

    if (selectedSourceAccount.currentBalance < selectedAmount) {
      setError(
        `Số dư ${selectedSourceAccount.name} (${formatVNDMasked(
          selectedSourceAccount.currentBalance,
          isPrivacyMode
        )}) không đủ để thanh toán ${formatVNDMasked(selectedAmount, isPrivacyMode)}!`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      addTransaction({
        amount: selectedAmount,
        date: new Date().toISOString().split("T")[0],
        type: "TRANSFER",
        categoryId: "cat_expense_other",
        accountId: selectedSourceAccount.id,
        toAccountId: cardInfo.account.id,
        memberId: cardInfo.account.owner === "WIFE" ? "WIFE" : "HUSBAND",
        scope: "FAMILY",
        note: `Thanh toán ${paymentOption === "FULL" ? "toàn bộ" : "tối thiểu"} dư nợ sao kê thẻ ${cardInfo.account.name}`,
        tag: "DEBT",
      });

      setIsSubmitting(false);
      if (onSuccess) onSuccess();
      onClose();
    } catch {
      setIsSubmitting(false);
      setError("Đã xảy ra lỗi trong quá trình ghi nhận thanh toán thẻ!");
    }
  };

  const isHusband = cardInfo.account.owner === "HUSBAND";

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end bg-[#0B132B]/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Vùng Backdrop phía trên */}
      <div className="flex-1 flex flex-col items-center pt-3 pb-4 pointer-events-none">
        <div className="w-[126px] h-9 rounded-full bg-black shadow-lg flex items-center justify-center pointer-events-auto">
          <div className="w-3 h-3 rounded-full bg-slate-900 border border-slate-700 mr-2" />
          <div className="w-2.5 h-2.5 rounded-full bg-blue-900/60" />
        </div>
      </div>

      {/* Bottom Sheet Container */}
      <div
        className="w-full max-w-lg mx-auto bg-white dark:bg-slate-900 rounded-t-[32px] shadow-2xl border-t border-slate-200 dark:border-slate-800 p-5 space-y-3.5 animate-in slide-in-from-bottom duration-200 overflow-hidden flex flex-col max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Handle */}
        <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto -mt-1 cursor-grab" />

        {/* Header Bar */}
        <div className="flex items-center justify-between pb-1">
          <h3 className="text-base sm:text-lg font-bold text-[#0F172A] dark:text-slate-100">
            Thanh Toán Dư Nợ Tín Dụng
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-semibold rounded-lg flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Credit Card Hero Card */}
        <div
          className={`rounded-xl p-4 text-white shadow-md relative overflow-hidden space-y-3 ${
            isHusband
              ? "bg-gradient-to-br from-[#0F172A] via-[#172B4D] to-[#1E3A8A]"
              : "bg-gradient-to-br from-[#451A03] via-[#78350F] to-[#B45309]"
          }`}
        >
          {/* Card Top Row */}
          <div className="flex items-center justify-between text-xs">
            <span className="font-extrabold tracking-wider flex items-center gap-1.5">
              <CreditCard className="w-4 h-4" />
              {cardInfo.account.name}
            </span>
            <span className="font-mono text-slate-300 text-[11px]">•••• {cardInfo.account.accountNumber?.slice(-4) || "8868"}</span>
          </div>

          {/* Card Mid: Due Amount */}
          <div>
            <span className="text-[11px] text-blue-200/90 block">
              Dư nợ chốt sao kê ngày {cardInfo.statementDay} hàng tháng:
            </span>
            <span className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {formatVNDMasked(cardInfo.usedAmount, isPrivacyMode)}
            </span>
          </div>

          {/* Card Bottom: Limit & Grace status */}
          <div className="flex items-center justify-between pt-1 border-t border-white/15 text-[11px]">
            <span className="text-slate-300">
              Khả dụng:{" "}
              <strong className="text-white">
                {formatVNDMasked(cardInfo.availableAmount, isPrivacyMode)}
              </strong>
            </span>
            <span className="px-2 py-0.5 rounded-md bg-amber-400/20 text-amber-300 font-bold border border-amber-400/30">
              Hạn trả: {cardInfo.dueDateDisplay} (Miễn lãi)
            </span>
          </div>
        </div>

        {/* Repayment Options Selector */}
        <div className="rounded-xl p-3 bg-[#F8FAFC] dark:bg-slate-800/70 border border-[#E2E8F0] dark:border-slate-700 space-y-2">
          <span className="text-[11px] font-bold text-[#475569] dark:text-slate-400 uppercase tracking-wider block">
            CHỌN SỐ TIỀN THANH TOÁN KỲ NÀY:
          </span>

          {/* Option 1: Full statement */}
          <div
            onClick={() => setPaymentOption("FULL")}
            className={`p-3 rounded-lg border flex items-center justify-between cursor-pointer transition-all ${
              paymentOption === "FULL"
                ? "bg-[#EFF6FF] dark:bg-blue-500/15 border-[#3B82F6] ring-1 ring-blue-500/30 shadow-xs"
                : "bg-white dark:bg-slate-900 border-[#E2E8F0] dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div
                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  paymentOption === "FULL" ? "border-blue-600 bg-blue-600" : "border-slate-300 dark:border-slate-600"
                }`}
              >
                {paymentOption === "FULL" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
              <div>
                <span className="text-xs font-bold text-[#1D4ED8] dark:text-blue-400 block">
                  Toàn bộ dư nợ (Khuyên dùng)
                </span>
                <span className="text-[10px] text-[#047857] dark:text-emerald-400 font-semibold block">
                  Miễn lãi 100% · Bảo vệ CIC tổ ấm
                </span>
              </div>
            </div>
            <span className="text-xs sm:text-sm font-extrabold text-[#1D4ED8] dark:text-blue-400">
              {formatVNDMasked(fullAmount, isPrivacyMode)}
            </span>
          </div>

          {/* Option 2: Minimum payment */}
          <div
            onClick={() => setPaymentOption("MINIMUM")}
            className={`p-3 rounded-lg border flex items-center justify-between cursor-pointer transition-all ${
              paymentOption === "MINIMUM"
                ? "bg-[#EFF6FF] dark:bg-blue-500/15 border-[#3B82F6] ring-1 ring-blue-500/30 shadow-xs"
                : "bg-white dark:bg-slate-900 border-[#E2E8F0] dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div
                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  paymentOption === "MINIMUM" ? "border-blue-600 bg-blue-600" : "border-slate-300 dark:border-slate-600"
                }`}
              >
                {paymentOption === "MINIMUM" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
              <div>
                <span className="text-xs font-medium text-[#334155] dark:text-slate-200 block">
                  Thanh toán tối thiểu (5%)
                </span>
                <span className="text-[10px] text-[#475569] dark:text-slate-400 block">
                  Phát sinh lãi suất thẻ
                </span>
              </div>
            </div>
            <span className="text-xs sm:text-sm font-bold text-[#334155] dark:text-slate-200">
              {formatVNDMasked(minimumAmount, isPrivacyMode)}
            </span>
          </div>
        </div>

        {/* Source Account Selector */}
        <div className="rounded-xl p-3 bg-[#F1F5F9] dark:bg-slate-800/70 border border-[#E2E8F0] dark:border-slate-700 space-y-1.5">
          <label className="text-[11px] font-bold text-[#475569] dark:text-slate-400 uppercase tracking-wider block">
            Nguồn trích tiền thanh toán:
          </label>
          <div className="relative">
            <select
              value={sourceAccountId}
              onChange={(e) => setSourceAccountId(e.target.value)}
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-bold text-[#1E293B] dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
            >
              {eligibleSourceAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} · Số dư: {formatVNDMasked(acc.currentBalance, isPrivacyMode)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Safety Box (Event Sourcing) */}
        <div className="rounded-xl p-2.5 bg-[#ECFDF5] dark:bg-emerald-500/15 border border-[#A7F3D0] dark:border-emerald-500/30 flex items-center gap-2.5 text-xs text-[#047857] dark:text-emerald-300">
          <ShieldCheck className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <p className="text-[11px] font-medium leading-tight">
            Cơ chế <strong>Event Sourcing</strong> tự động trừ tài khoản thanh toán và hoàn lại hạn mức thẻ tức thì, chống lệch sổ cái gia đình.
          </p>
        </div>

        {/* CTA Button */}
        <button
          onClick={handleConfirmRepayment}
          disabled={isSubmitting || fullAmount <= 0}
          className="w-full h-12 rounded-xl bg-[#1D4ED8] hover:bg-blue-800 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-colors cursor-pointer"
        >
          <CreditCard className="w-4 h-4" />
          <span>
            {isSubmitting
              ? "Đang xử lý..."
              : `XÁC NHẬN THANH TOÁN ${formatVNDMasked(selectedAmount, isPrivacyMode)}`}
          </span>
        </button>

        {/* Home Indicator */}
        <div className="w-32 h-1 rounded-full bg-slate-800 dark:bg-slate-600 mx-auto mt-2" />
      </div>
    </div>
  );
}
