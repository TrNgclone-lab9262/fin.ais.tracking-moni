"use client";

import React, { useState, useEffect } from "react";
import {
  Delete,
  AlertCircle,
  Camera,
  Sparkles,
} from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { FamilyMember, ExpenseScope, TransactionType } from "@/types/finance";
import { ReceiptScannerModal } from "@/components/transactions/ReceiptScannerModal";
import { ParsedReceiptResult, parseNaturalLanguageTransactions } from "@/lib/geminiReceiptService";
import { useHaptic } from "@/src/hooks/useHaptic";

interface MobileNumpadSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function MobileNumpadSheet({
  isOpen,
  onClose,
  onSuccess,
}: MobileNumpadSheetProps) {
  const { accounts, categories, addTransaction, addTransactionsBatch, activePerspective } = useFinance();
  const haptic = useHaptic();

  const [type, setType] = useState<TransactionType>("EXPENSE");
  const [numericAmount, setNumericAmount] = useState<number>(0);
  const [categoryId, setCategoryId] = useState<string>("");
  const [accountId, setAccountId] = useState<string>("");
  const [memberId, setMemberId] = useState<FamilyMember>("HUSBAND");
  const [scope, setScope] = useState<ExpenseScope>("FAMILY");
  const [note, setNote] = useState<string>("");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);

  // Xử lý áp dụng kết quả từ Gemini OCR
  const handleApplyReceipt = (receipt: ParsedReceiptResult) => {
    setNumericAmount(receipt.amount);
    if (receipt.date) setDate(receipt.date);
    setType("EXPENSE");
    if (receipt.suggestedCategoryId) {
      setCategoryId(receipt.suggestedCategoryId);
    }
    const combinedNote = receipt.merchantName + (receipt.notes ? ` - ${receipt.notes}` : "");
    setNote(combinedNote);
  };

  // Khởi tạo giá trị mặc định theo góc nhìn hiện tại
  useEffect(() => {
    if (isOpen) {
      setType("EXPENSE");
      setNumericAmount(0);
      setError(null);

      if (activePerspective === "WIFE") {
        setMemberId("WIFE");
      } else {
        setMemberId("HUSBAND");
      }

      const preferredAccount =
        activePerspective === "WIFE"
          ? accounts.find((a) => a.owner === "WIFE") || accounts[0]
          : accounts.find((a) => a.owner === "HUSBAND") || accounts[0];

      if (preferredAccount) {
        setAccountId(preferredAccount.id);
      }
    }
  }, [isOpen, activePerspective, accounts]);

  // Tự động gán category đầu tiên theo type
  const availableCategories = categories.filter((c) => c.type === type);
  useEffect(() => {
    if (availableCategories.length > 0 && !availableCategories.some((c) => c.id === categoryId)) {
      setCategoryId(availableCategories[0].id);
    }
  }, [type, availableCategories, categoryId]);

  if (!isOpen) return null;

  // Numpad key tap handlers
  const handleDigit = (digit: string) => {
    haptic.light();
    if (numericAmount === 0) {
      setNumericAmount(parseInt(digit, 10));
    } else {
      const nextStr = numericAmount.toString() + digit;
      if (nextStr.length <= 11) {
        setNumericAmount(parseInt(nextStr, 10));
      }
    }
  };

  const handleBackspace = () => {
    haptic.light();
    const s = numericAmount.toString();
    if (s.length <= 1) {
      setNumericAmount(0);
    } else {
      setNumericAmount(parseInt(s.slice(0, -1), 10));
    }
  };

  const handleClear = () => {
    haptic.light();
    setNumericAmount(0);
  };

  const handleAppendZeros = () => {
    haptic.light();
    if (numericAmount > 0) {
      const next = numericAmount * 1000;
      if (next.toString().length <= 12) {
        setNumericAmount(next);
      }
    }
  };

  const handleAddQuick = (delta: number) => {
    haptic.light();
    setNumericAmount((prev) => prev + delta);
  };

  const handleSave = () => {
    if (numericAmount <= 0) {
      haptic.error();
      setError("Vui lòng nhập số tiền lớn hơn 0");
      return;
    }

    try {
      addTransaction({
        amount: numericAmount,
        date: date || new Date().toISOString().split("T")[0],
        type,
        categoryId: categoryId || "cat_expense_food",
        accountId: accountId || accounts[0]?.id || "acc_husband_vietinbank",
        memberId,
        scope,
        note: note.trim() || undefined,
      });

      haptic.success();
      if (onSuccess) onSuccess();
      onClose();
    } catch {
      haptic.error();
      setError("Lỗi khi ghi nhận giao dịch!");
    }
  };

  const isExpense = type === "EXPENSE";

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end bg-[#0B132B]/60 backdrop-blur-xs pt-safe animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Top Backdrop Area with Dynamic Island */}
      <div className="flex-1 flex flex-col items-center pt-3 pb-2 pointer-events-none">
        <div className="w-[126px] h-9 rounded-full bg-black shadow-lg flex items-center justify-center pointer-events-auto">
          <div className="w-3 h-3 rounded-full bg-slate-900 border border-slate-700 mr-2" />
          <div className="w-2.5 h-2.5 rounded-full bg-blue-900/60" />
        </div>
      </div>

      {/* Bottom Sheet Container */}
      <div
        className="w-full max-w-lg mx-auto bg-white dark:bg-slate-900 rounded-t-[32px] shadow-2xl border-t border-slate-200 dark:border-slate-800 p-4 pb-safe space-y-2.5 animate-in slide-in-from-bottom duration-200 overflow-hidden flex flex-col select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Handle */}
        <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto -mt-0.5 cursor-grab" />

        {/* Header Bar */}
        <div className="flex items-center justify-between pb-1">
          <button
            onClick={onClose}
            className="text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-2 py-1 cursor-pointer"
          >
            Hủy
          </button>
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm sm:text-base font-bold text-[#0F172A] dark:text-slate-100 flex items-center gap-1">
              <span>⚡</span>
              <span>Ghi Chép 3 Giây</span>
            </h3>
            <button
              type="button"
              onClick={() => setIsScannerOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 active:scale-95 text-white rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer ml-1"
              title="Quét hóa đơn bằng Gemini AI"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Quét 📷</span>
            </button>
          </div>
          <button
            onClick={handleSave}
            className="text-xs font-bold bg-[#2563EB] text-white px-3 py-1.5 rounded-lg shadow-xs hover:bg-blue-700 transition-all active:scale-95 cursor-pointer"
          >
            Lưu GD
          </button>
        </div>

        {error && (
          <div className="p-2 bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-semibold rounded-lg flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Member & Scope Chooser */}
        <div className="grid grid-cols-3 gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => setMemberId("HUSBAND")}
            className={`py-1.5 rounded-lg font-bold border transition-all flex items-center justify-center gap-1 cursor-pointer ${
              memberId === "HUSBAND"
                ? "bg-blue-50 dark:bg-blue-500/15 border-blue-600 text-blue-700 dark:text-blue-300"
                : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
            }`}
          >
            <span>👨</span>
            <span>Anh Chuột</span>
          </button>

          <button
            type="button"
            onClick={() => setMemberId("WIFE")}
            className={`py-1.5 rounded-lg font-bold border transition-all flex items-center justify-center gap-1 cursor-pointer ${
              memberId === "WIFE"
                ? "bg-rose-50 dark:bg-rose-500/15 border-rose-500 text-rose-700 dark:text-rose-300"
                : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
            }`}
          >
            <span>👩</span>
            <span>Bé Mèo</span>
          </button>

          <button
            type="button"
            onClick={() => setScope(scope === "FAMILY" ? "PERSONAL" : "FAMILY")}
            className={`py-1.5 rounded-lg font-bold border transition-all flex items-center justify-center gap-1 cursor-pointer ${
              scope === "FAMILY"
                ? "bg-emerald-50 dark:bg-emerald-500/15 border-emerald-600 text-emerald-700 dark:text-emerald-300"
                : "bg-purple-50 dark:bg-purple-500/15 border-purple-500 text-purple-700 dark:text-purple-300"
            }`}
          >
            <span>{scope === "FAMILY" ? "🏠 Chung" : "👤 Riêng"}</span>
          </button>
        </div>

        {/* Type Switcher */}
        <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg text-xs font-bold">
          <button
            type="button"
            onClick={() => setType("EXPENSE")}
            className={`py-1 rounded-md transition-all cursor-pointer ${
              type === "EXPENSE" ? "bg-rose-600 text-white shadow-xs" : "text-slate-600 dark:text-slate-300"
            }`}
          >
            Chi tiêu
          </button>
          <button
            type="button"
            onClick={() => setType("INCOME")}
            className={`py-1 rounded-md transition-all cursor-pointer ${
              type === "INCOME" ? "bg-emerald-600 text-white shadow-xs" : "text-slate-600 dark:text-slate-300"
            }`}
          >
            Thu nhập
          </button>
          <button
            type="button"
            onClick={() => setType("TRANSFER")}
            className={`py-1 rounded-md transition-all cursor-pointer ${
              type === "TRANSFER" ? "bg-blue-600 text-white shadow-xs" : "text-slate-600 dark:text-slate-300"
            }`}
          >
            Chuyển ví
          </button>
        </div>

        {/* Large Amount Display */}
        <div className="bg-[#F8FAFC] dark:bg-slate-800/80 border border-[#E2E8F0] dark:border-slate-700 rounded-xl p-3 text-center">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-widest block mb-0.5">
            SỐ TIỀN GIAO DỊCH
          </span>
          <div
            className={`text-3xl font-black tracking-tight ${
              isExpense ? "text-[#BE123C] dark:text-rose-400" : "text-[#047857] dark:text-emerald-400"
            }`}
          >
            {numericAmount > 0 ? (
              <>
                {isExpense ? "-" : "+"} {numericAmount.toLocaleString("vi-VN")} ₫
              </>
            ) : (
              <span className="text-slate-300 dark:text-slate-600">0 ₫</span>
            )}
          </div>
        </div>

        {/* Account & Category Quick Row */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-bold text-slate-800 dark:text-slate-100 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none cursor-pointer"
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-bold text-slate-800 dark:text-slate-100 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none cursor-pointer"
            >
              {availableCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon || "🏷️"} {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Ghi chú hoặc nhập nhanh AI */}
        <div className="flex gap-1.5">
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ghi chú nhanh (VD: Cafe 55k bằng ACB)..."
            className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500"
          />
          <button
            type="button"
            onClick={async () => {
              if (!note.trim()) return;
              const list = await parseNaturalLanguageTransactions(note, accounts, categories, memberId);
              if (list.length > 0) {
                const first = list[0];
                setType(first.type);
                setNumericAmount(first.amount);
                setCategoryId(first.categoryId);
                setAccountId(first.accountId);
                setMemberId(first.memberId);
                setScope(first.scope);
              }
            }}
            className="px-2.5 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI</span>
          </button>
        </div>

        {/* Quick Amount Chips */}
        <div className="grid grid-cols-5 gap-1.5">
          <button
            type="button"
            onClick={handleAppendZeros}
            className="h-8 rounded-lg bg-blue-50 dark:bg-blue-500/15 hover:bg-blue-100 dark:hover:bg-blue-500/25 text-blue-700 dark:text-blue-300 text-xs font-black border border-blue-200 dark:border-blue-500/30 transition-colors cursor-pointer"
          >
            +000
          </button>
          <button
            type="button"
            onClick={() => handleAddQuick(50000)}
            className="h-8 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
          >
            +50k
          </button>
          <button
            type="button"
            onClick={() => handleAddQuick(100000)}
            className="h-8 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
          >
            +100k
          </button>
          <button
            type="button"
            onClick={() => handleAddQuick(200000)}
            className="h-8 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
          >
            +200k
          </button>
          <button
            type="button"
            onClick={() => handleAddQuick(500000)}
            className="h-8 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
          >
            +500k
          </button>
        </div>

        {/* 4x3 Ergonomic Numpad Grid (Thumb-Zone) */}
        <div className="grid grid-cols-3 gap-1.5 pt-1">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigit(digit)}
              className="h-11 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 active:bg-slate-200 dark:active:bg-slate-600 active:scale-95 border border-slate-200/80 dark:border-slate-700 text-lg font-black text-[#172B4D] dark:text-slate-100 shadow-2xs transition-all flex items-center justify-center cursor-pointer"
            >
              {digit}
            </button>
          ))}

          {/* Row 4: Clear, 0, Backspace */}
          <button
            type="button"
            onClick={handleClear}
            className="h-11 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 active:bg-slate-300 dark:active:bg-slate-600 active:scale-95 text-sm font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-all flex items-center justify-center cursor-pointer"
          >
            C
          </button>

          <button
            type="button"
            onClick={() => handleDigit("0")}
            className="h-11 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 active:bg-slate-200 dark:active:bg-slate-600 active:scale-95 border border-slate-200/80 dark:border-slate-700 text-lg font-black text-[#172B4D] dark:text-slate-100 shadow-2xs transition-all flex items-center justify-center cursor-pointer"
          >
            0
          </button>

          <button
            type="button"
            onClick={handleBackspace}
            className="h-11 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 active:bg-slate-300 dark:active:bg-slate-600 active:scale-95 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-all flex items-center justify-center cursor-pointer"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        {/* Home Indicator */}
        <div className="w-32 h-1 rounded-full bg-slate-800 dark:bg-slate-600 mx-auto mt-1" />
      </div>

      {/* Modal Quét Hóa Đơn Bằng Gemini AI */}
      <ReceiptScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onApplyReceipt={handleApplyReceipt}
        onApplyTransactions={(batch) => {
          addTransactionsBatch(batch);
          if (onSuccess) onSuccess();
          onClose();
        }}
      />
    </div>
  );
}
