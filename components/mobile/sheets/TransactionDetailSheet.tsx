"use client";

import React from "react";
import {
  X,
  Pencil,
  Trash2,
  Calendar,
  CreditCard,
  CheckCircle2,
} from "lucide-react";
import { Transaction } from "@/types/finance";
import { formatVNDMasked, formatDateVN } from "@/lib/formatters";
import { useFinance } from "@/context/FinanceContext";

interface TransactionDetailSheetProps {
  transaction: Transaction | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (tx: Transaction) => void;
  onDelete: (id: string) => void;
}

export function TransactionDetailSheet({
  transaction,
  isOpen,
  onClose,
  onEdit,
  onDelete,
}: TransactionDetailSheetProps) {
  const { getCategoryById, getAccountById, isPrivacyMode } = useFinance();

  if (!isOpen || !transaction) return null;

  const category = getCategoryById(transaction.categoryId);
  const account = getAccountById(transaction.accountId);
  const toAccount = transaction.toAccountId ? getAccountById(transaction.toAccountId) : null;

  const isExpense = transaction.type === "EXPENSE";
  const isIncome = transaction.type === "INCOME";
  const isTransfer = transaction.type === "TRANSFER";

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end bg-[#0B132B]/60 backdrop-blur-xs pt-safe animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Vùng Backdrop phía trên */}
      <div className="flex-1 flex flex-col items-center pt-3 pb-4 pointer-events-none">
        <div className="w-[126px] h-9 rounded-full bg-black shadow-lg flex items-center justify-center pointer-events-auto">
          <div className="w-3 h-3 rounded-full bg-slate-900 border border-slate-700 mr-2" />
          <div className="w-2.5 h-2.5 rounded-full bg-blue-900/60" />
        </div>
      </div>

      {/* Container Bottom Sheet Modal */}
      <div
        className="w-full max-w-lg mx-auto bg-white dark:bg-slate-900 rounded-t-[32px] shadow-2xl border-t border-slate-200 dark:border-slate-800 p-5 pb-safe space-y-3.5 animate-in slide-in-from-bottom duration-200 overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Handle */}
        <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto -mt-1 cursor-grab" />

        {/* Header Bar */}
        <div className="flex items-center justify-between pb-1">
          <h3 className="text-base sm:text-lg font-bold text-[#0F172A] dark:text-slate-100">
            Chi Tiết Giao Dịch
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Amount Hero Card */}
        <div
          className={`rounded-xl p-4 text-center border flex flex-col items-center justify-center gap-1.5 ${
            isExpense
              ? "bg-[#FFF1F2] dark:bg-rose-500/15 border-[#FECDD3] dark:border-rose-500/30 text-[#BE123C] dark:text-rose-300"
              : isIncome
              ? "bg-[#ECFDF5] dark:bg-emerald-500/15 border-[#A7F3D0] dark:border-emerald-500/30 text-[#047857] dark:text-emerald-300"
              : "bg-[#EFF6FF] dark:bg-blue-500/15 border-[#BFDBFE] dark:border-blue-500/30 text-[#1D4ED8] dark:text-blue-300"
          }`}
        >
          {/* Category Chip */}
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold ${
              isExpense
                ? "bg-[#FFE4E6] dark:bg-rose-500/20 text-[#BE123C] dark:text-rose-200"
                : isIncome
                ? "bg-[#D1FAE5] dark:bg-emerald-500/20 text-[#047857] dark:text-emerald-200"
                : "bg-[#DBEAFE] dark:bg-blue-500/20 text-[#1D4ED8] dark:text-blue-200"
            }`}
          >
            {category?.icon || "🏷️"} {isTransfer ? "Chuyển khoản ví" : category?.name || "Chi tiêu"}
          </span>

          {/* Large Amount */}
          <span className="text-2xl sm:text-3xl font-black tracking-tight">
            {isExpense ? "-" : isIncome ? "+" : ""}
            {formatVNDMasked(transaction.amount, isPrivacyMode)}
          </span>

          {/* Time & Verified Status */}
          <span className="text-xs text-[#475569] dark:text-slate-300 font-medium flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            {formatDateVN(transaction.date)} · <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 inline" /> Đã ghi sổ gia đình
          </span>
        </div>

        {/* Bento Details Card */}
        <div className="rounded-xl p-3.5 bg-[#F8FAFC] dark:bg-slate-800/80 border border-[#E2E8F0] dark:border-slate-700 space-y-2.5 text-xs">
          {/* Row 1: Thành viên & Phạm vi */}
          <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0] dark:border-slate-700">
            <div className="flex items-center gap-1.5">
              <span className="text-[#64748B] dark:text-slate-400 font-medium">Người chi:</span>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold ${
                  transaction.memberId === "HUSBAND"
                    ? "bg-[#EFF6FF] dark:bg-blue-500/15 border border-[#BFDBFE] dark:border-blue-500/30 text-[#1D4ED8] dark:text-blue-300"
                    : "bg-[#FDF2F8] dark:bg-pink-500/15 border border-[#FBCFE8] dark:border-pink-500/30 text-[#BE185D] dark:text-pink-300"
                }`}
              >
                <span>{transaction.memberId === "HUSBAND" ? "👨 Anh Chuột" : "👩 Bé Mèo"}</span>
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[#64748B] dark:text-slate-400 font-medium">Phạm vi:</span>
              <span
                className={`px-2 py-0.5 rounded-md font-bold ${
                  transaction.scope === "FAMILY"
                    ? "bg-[#ECFDF5] dark:bg-emerald-500/15 border border-[#A7F3D0] dark:border-emerald-500/30 text-[#047857] dark:text-emerald-300"
                    : "bg-[#FAF5FF] dark:bg-purple-500/15 border border-[#E9D5FF] dark:border-purple-500/30 text-[#7E22CE] dark:text-purple-300"
                }`}
              >
                {transaction.scope === "FAMILY" ? "🏠 Dùng chung 100%" : "👤 Chi riêng"}
              </span>
            </div>
          </div>

          {/* Row 2: Nguồn thanh toán */}
          <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0] dark:border-slate-700">
            <span className="text-[#64748B] dark:text-slate-400 font-medium flex items-center gap-1">
              <CreditCard className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              Nguồn thanh toán:
            </span>
            <span className="font-bold text-[#1E293B] dark:text-slate-100">
              {isTransfer
                ? `${account?.name || "Ví nguồn"} ➔ ${toAccount?.name || "Ví nhận"}`
                : account?.name || "Ví tiền"}
            </span>
          </div>

          {/* Row 3: Ghi chú chi tiết */}
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-[#64748B] dark:text-slate-400 uppercase tracking-wider block">
              Ghi chú tổ ấm
            </span>
            <p className="text-[#1E293B] dark:text-slate-200 font-normal leading-relaxed text-xs">
              {transaction.note || <span className="text-slate-400 dark:text-slate-500 italic">Không có ghi chú thêm</span>}
            </p>
          </div>
        </div>

        {/* Action Buttons Stack */}
        <div className="space-y-2 pt-1">
          <button
            onClick={() => {
              onClose();
              onEdit(transaction);
            }}
            className="w-full h-11 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            <Pencil className="w-4 h-4" />
            <span>Chỉnh Sửa Giao Dịch</span>
          </button>

          <button
            onClick={() => {
              onClose();
              onDelete(transaction.id);
            }}
            className="w-full h-10 rounded-xl bg-[#FEE2E2] dark:bg-rose-500/15 hover:bg-rose-200 dark:hover:bg-rose-500/25 border border-[#FCA5A5] dark:border-rose-500/30 text-[#BE123C] dark:text-rose-300 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>Xóa Giao Dịch Này</span>
          </button>
        </div>

        {/* Home Indicator */}
        <div className="w-32 h-1 rounded-full bg-slate-800 dark:bg-slate-600 mx-auto mt-2" />
      </div>
    </div>
  );
}
