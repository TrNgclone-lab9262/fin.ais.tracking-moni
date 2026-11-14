"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Sparkles,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";
import { SavingsGoal } from "@/types/finance";
import { formatVNDMasked } from "@/lib/formatters";
import { useFinance } from "@/context/FinanceContext";

interface GoalDepositSheetProps {
  goal: SavingsGoal | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const QUICK_CHIPS = [
  { label: "+1Tr", value: 1000000 },
  { label: "+2Tr", value: 2000000 },
  { label: "+5Tr", value: 5000000 },
  { label: "+10Tr", value: 10000000 },
  { label: "+20Tr", value: 20000000 },
];

export function GoalDepositSheet({
  goal,
  isOpen,
  onClose,
  onSuccess,
}: GoalDepositSheetProps) {
  const { accounts, depositGoal, isPrivacyMode } = useFinance();

  const [amount, setAmount] = useState<number>(5000000);
  const [sourceAccountId, setSourceAccountId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eligibleAccounts = accounts.filter(
    (a) => a.type !== "CREDIT_CARD" && a.currentBalance > 0
  );

  useEffect(() => {
    if (isOpen) {
      setAmount(5000000);
      setError(null);
      if (eligibleAccounts.length > 0) {
        setSourceAccountId(eligibleAccounts[0].id);
      }
    }
  }, [isOpen]);

  if (!isOpen || !goal) return null;

  const currentAmount = goal.currentAmount;
  const targetAmount = goal.targetAmount;
  const currentPct = Math.min(100, Math.round((currentAmount / targetAmount) * 1000) / 10);

  const nextAmount = currentAmount + amount;
  const nextPct = Math.min(100, Math.round((nextAmount / targetAmount) * 1000) / 10);
  const diffPct = Math.max(0, Math.round((nextPct - currentPct) * 10) / 10);

  const selectedSourceAccount = accounts.find((a) => a.id === sourceAccountId);

  const handleConfirmDeposit = () => {
    if (amount <= 0) {
      setError("Vui lòng chọn số tiền nạp lớn hơn 0!");
      return;
    }

    if (selectedSourceAccount && selectedSourceAccount.currentBalance < amount) {
      setError(
        `Số dư ${selectedSourceAccount.name} (${formatVNDMasked(
          selectedSourceAccount.currentBalance,
          isPrivacyMode
        )}) không đủ để nạp ${formatVNDMasked(amount, isPrivacyMode)}!`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      depositGoal(goal.id, amount, sourceAccountId || undefined);
      setIsSubmitting(false);
      if (onSuccess) onSuccess();
      onClose();
    } catch {
      setIsSubmitting(false);
      setError("Đã xảy ra lỗi khi nạp tiền vào mục tiêu!");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end bg-[#0B132B]/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Dynamic Island Backdrop Area */}
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
            Nạp Tiền Mục Tiêu Tích Lũy
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

        {/* Target Goal Mini Card (Indigo Theme) */}
        <div className="rounded-xl p-3.5 bg-[#F5F3FF] dark:bg-indigo-500/15 border border-[#DDD6FE] dark:border-indigo-500/30 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">🏡</span>
              <span className="font-bold text-xs sm:text-sm text-[#4338CA] dark:text-indigo-300">
                {goal.name}
              </span>
            </div>
            <span className="text-xs sm:text-sm font-extrabold text-[#6366F1] dark:text-indigo-400">
              {currentPct}%
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2 rounded-full bg-[#E0E7FF] dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-[#4F46E5] transition-all duration-300"
              style={{ width: `${Math.min(currentPct, 100)}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] font-semibold text-[#312E81] dark:text-indigo-200">
            <span>
              {formatVNDMasked(currentAmount, isPrivacyMode)} /{" "}
              {formatVNDMasked(targetAmount, isPrivacyMode)}
            </span>
            <span className="text-[#6366F1] dark:text-indigo-400 font-medium">
              {goal.deadline ? `Hạn: ${goal.deadline}` : "Tổ ấm tương lai"}
            </span>
          </div>
        </div>

        {/* Amount Input Display */}
        <div className="rounded-xl p-3 bg-[#F8FAFC] dark:bg-slate-800/80 border border-[#E2E8F0] dark:border-slate-700 text-center space-y-1">
          <span className="text-[11px] font-bold text-[#475569] dark:text-slate-400 uppercase tracking-wider block">
            SỐ TIỀN MUỐN NẠP VÀO HŨ:
          </span>
          <div className="text-2xl sm:text-3xl font-black text-[#4F46E5] dark:text-indigo-400 tracking-tight">
            +{formatVNDMasked(amount, isPrivacyMode)}
          </div>
        </div>

        {/* Quick Shortcut Chips Row */}
        <div className="grid grid-cols-5 gap-1.5">
          {QUICK_CHIPS.map((chip) => {
            const isActive = amount === chip.value;
            return (
              <button
                key={chip.value}
                type="button"
                onClick={() => setAmount(chip.value)}
                className={`h-9 rounded-lg text-xs font-bold transition-all flex items-center justify-center border cursor-pointer ${
                  isActive
                    ? "bg-[#4F46E5] border-[#4338CA] text-white shadow-xs"
                    : "bg-[#F1F5F9] dark:bg-slate-800 border-[#E2E8F0] dark:border-slate-700 text-[#334155] dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>

        {/* Source Wallet Selector */}
        <div className="rounded-xl p-3 bg-[#F1F5F9] dark:bg-slate-800/80 border border-[#E2E8F0] dark:border-slate-700 space-y-1.5">
          <label className="text-[11px] font-bold text-[#475569] dark:text-slate-400 uppercase tracking-wider block">
            Trích tiền từ tài khoản tích lũy:
          </label>
          <select
            value={sourceAccountId}
            onChange={(e) => setSourceAccountId(e.target.value)}
            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-bold text-[#1E293B] dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
          >
            {eligibleAccounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name} · Số dư: {formatVNDMasked(acc.currentBalance, isPrivacyMode)}
              </option>
            ))}
          </select>
        </div>

        {/* Milestone Impact Badge */}
        <div className="rounded-xl p-2.5 bg-[#ECFDF5] dark:bg-emerald-500/15 border border-[#A7F3D0] dark:border-emerald-500/30 flex items-center gap-2.5 text-xs text-[#047857] dark:text-emerald-300">
          <TrendingUp className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div>
            <span className="font-bold block text-xs">
              Sau khi nạp: {formatVNDMasked(nextAmount, isPrivacyMode)} (Đạt {nextPct}% mục tiêu)
            </span>
            <span className="text-[10px] text-[#059669] dark:text-emerald-400 block font-medium">
              +{diffPct}% tiến độ · Rút ngắn thêm những bước đi trên hành trình cán mốc tổ ấm!
            </span>
          </div>
        </div>

        {/* CTA Button */}
        <button
          onClick={handleConfirmDeposit}
          disabled={isSubmitting || amount <= 0}
          className="w-full h-12 rounded-xl bg-[#4F46E5] hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-colors cursor-pointer"
        >
          <Sparkles className="w-4 h-4" />
          <span>
            {isSubmitting
              ? "Đang xử lý..."
              : `XÁC NHẬN NẠP ${formatVNDMasked(amount, isPrivacyMode)} VÀO HŨ`}
          </span>
        </button>

        {/* Home Indicator */}
        <div className="w-32 h-1 rounded-full bg-slate-800 dark:bg-slate-600 mx-auto mt-2" />
      </div>
    </div>
  );
}
