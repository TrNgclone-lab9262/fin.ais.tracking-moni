"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
  Tag,
  CreditCard,
  FileText,
  Users,
  Check,
  Sparkles,
  Loader2,
} from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { formatVND } from "@/lib/formatters";
import { parseNaturalLanguageTransactions } from "@/lib/geminiReceiptService";
import { DatePicker, SelectInput, TextInput } from "@/components/common/inputs";
import { triggerHaptic } from "@/lib/haptic";
import { FamilyMember, ExpenseScope, TransactionType, Transaction } from "@/types/finance";

interface TransactionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultType?: TransactionType;
  editTransaction?: Transaction | null;
}

export function TransactionFormModal({
  isOpen,
  onClose,
  defaultType = "EXPENSE",
  editTransaction = null,
}: TransactionFormModalProps) {
  const {
    accounts,
    categories,
    addTransaction,
    addTransactionsBatch,
    updateTransaction,
    activePerspective,
    settings,
  } = useFinance();

  const [type, setType] = useState<TransactionType>(defaultType);
  const [amountInput, setAmountInput] = useState("");
  const [numericAmount, setNumericAmount] = useState<number>(0);
  const [categoryId, setCategoryId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [note, setNote] = useState("");
  const [memberId, setMemberId] = useState<FamilyMember>("HUSBAND");
  const [scope, setScope] = useState<ExpenseScope>("FAMILY");
  const [error, setError] = useState<string | null>(null);
  const [smartText, setSmartText] = useState("");
  const [isParsingAI, setIsParsingAI] = useState(false);

  // Khởi tạo giá trị mặc định theo góc nhìn hiện tại hoặc nạp dữ liệu chỉnh sửa
  useEffect(() => {
    if (isOpen) {
      setSmartText("");
      if (editTransaction) {
        setType(editTransaction.type);
        setAmountInput(new Intl.NumberFormat("vi-VN").format(editTransaction.amount));
        setNumericAmount(editTransaction.amount);
        setDate(editTransaction.date);
        setCategoryId(editTransaction.categoryId);
        setAccountId(editTransaction.accountId);
        if (editTransaction.toAccountId) setToAccountId(editTransaction.toAccountId);
        setNote(editTransaction.note || "");
        setMemberId(editTransaction.memberId || "HUSBAND");
        setScope(editTransaction.scope || "FAMILY");
        setError(null);
      } else {
        setType(defaultType);
        setAmountInput("");
        setNumericAmount(0);
        setDate(new Date().toISOString().split("T")[0]);
        setNote("");
        setError(null);

        if (activePerspective === "WIFE") {
          setMemberId("WIFE");
        } else {
          setMemberId("HUSBAND");
        }

        if (accounts.length > 0) {
          const preferred =
            activePerspective === "WIFE"
              ? accounts.find((a) => a.owner === "WIFE") || accounts[0]
              : accounts.find((a) => a.owner === "HUSBAND") || accounts[0];
          setAccountId(preferred.id);
          const second = accounts.find((a) => a.id !== preferred.id);
          if (second) setToAccountId(second.id);
        }
      }
    }
  }, [isOpen, defaultType, editTransaction, activePerspective, accounts]);

  const availableCategories = categories.filter((c) => c.type === type);

  useEffect(() => {
    if (!editTransaction && availableCategories.length > 0 && !availableCategories.some((c) => c.id === categoryId)) {
      setCategoryId(availableCategories[0].id);
    }
  }, [type, availableCategories, categoryId, editTransaction]);

  if (!isOpen) return null;

  const handleAmountChange = (val: string) => {
    const rawNumber = val.replace(/[^0-9]/g, "");
    if (!rawNumber) {
      setAmountInput("");
      setNumericAmount(0);
      return;
    }
    const num = parseInt(rawNumber, 10);
    setNumericAmount(num);
    setAmountInput(num.toLocaleString("vi-VN"));
  };

  const addQuickAmount = (delta: number) => {
    const next = numericAmount + delta;
    setNumericAmount(next);
    setAmountInput(next.toLocaleString("vi-VN"));
  };

  const appendZeros = () => {
    if (numericAmount <= 0) return;
    const next = numericAmount * 1000;
    setNumericAmount(next);
    setAmountInput(next.toLocaleString("vi-VN"));
  };

  const handleSmartParse = async () => {
    if (!smartText.trim()) return;
    setIsParsingAI(true);
    setError(null);
    try {
      const parsedList = await parseNaturalLanguageTransactions(
        smartText,
        accounts,
        categories,
        memberId
      );
      if (parsedList.length === 0) {
        setError("Chưa nhận diện được số tiền từ câu nhập. VD: 'Mèo ăn trưa 120k bằng ACB'");
      } else if (parsedList.length === 1) {
        const first = parsedList[0];
        setType(first.type);
        setNumericAmount(first.amount);
        setAmountInput(first.amount.toLocaleString("vi-VN"));
        setCategoryId(first.categoryId);
        setAccountId(first.accountId);
        setMemberId(first.memberId);
        setScope(first.scope);
        setDate(first.date);
        setNote(first.note);
      } else {
        addTransactionsBatch(
          parsedList.map((item) => ({
            amount: item.amount,
            date: item.date,
            type: item.type,
            categoryId: item.categoryId,
            accountId: item.accountId,
            memberId: item.memberId,
            scope: item.scope,
            note: item.note,
          }))
        );
        onClose();
      }
    } finally {
      setIsParsingAI(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (numericAmount <= 0) {
      triggerHaptic("error");
      setError("Vui lòng nhập số tiền lớn hơn 0");
      return;
    }

    if (type === "TRANSFER" && accountId === toAccountId) {
      triggerHaptic("error");
      setError("Tài khoản nguồn và tài khoản nhận phải khác nhau");
      return;
    }

    const payload = {
      amount: numericAmount,
      date,
      type,
      categoryId: type === "TRANSFER" ? "cat_expense_other" : categoryId,
      accountId,
      toAccountId: type === "TRANSFER" ? toAccountId : undefined,
      note: note.trim() || undefined,
      memberId,
      scope,
    };

    if (editTransaction) {
      updateTransaction(editTransaction.id, payload);
    } else {
      addTransaction(payload);
    }
    triggerHaptic("success");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-xl shadow-2xl overflow-hidden border border-[#DCE4EE] dark:border-slate-800 flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="px-6 py-4 border-b border-[#E9EEF5] dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/70">
          <div className="flex items-center gap-2">
            <span className="text-xl">🏡</span>
            <h2 className="text-base sm:text-lg font-bold text-[#172B4D] dark:text-slate-100">
              {editTransaction ? "Chỉnh sửa giao dịch" : "Ghi chép giao dịch gia đình"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {!editTransaction && (
            <div className="p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-500/15 border border-indigo-200/80 dark:border-indigo-500/30 space-y-1.5">
              <label className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Nhập nhanh bằng câu tự nhiên (VD: &quot;{settings.wifeName} đi WinMart 350k bằng BIDV Credit&quot;)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={smartText}
                  onChange={(e) => setSmartText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSmartParse();
                    }
                  }}
                  placeholder="Gõ mô tả giao dịch hoặc nhiều khoản cách nhau bằng 'và'..."
                  className="flex-1 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-500/40 rounded-lg px-3 py-1.5 text-xs text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-500 placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={handleSmartParse}
                  disabled={isParsingAI || !smartText.trim()}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0"
                >
                  {isParsingAI ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  <span>Điền AI</span>
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-semibold rounded-lg">
              {error}
            </div>
          )}

          {/* 1. Chọn Ai là người chi/thu? */}
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              Thành viên thực hiện
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMemberId("HUSBAND")}
                className={`flex items-center justify-center gap-2 py-2 rounded-md text-xs sm:text-sm font-bold border transition-all cursor-pointer ${
                  memberId === "HUSBAND"
                    ? "bg-blue-50 dark:bg-blue-500/20 border-blue-600 text-blue-700 dark:text-blue-300 shadow-xs"
                    : "border-[#DCE4EE] dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
              >
                <span>👨</span>
                <span>Anh Chuột</span>
              </button>
              <button
                type="button"
                onClick={() => setMemberId("WIFE")}
                className={`flex items-center justify-center gap-2 py-2 rounded-md text-xs sm:text-sm font-bold border transition-all cursor-pointer ${
                  memberId === "WIFE"
                    ? "bg-emerald-50 dark:bg-emerald-500/20 border-emerald-600 text-emerald-700 dark:text-emerald-300 shadow-xs"
                    : "border-[#DCE4EE] dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
              >
                <span>👩</span>
                <span>Bé Mèo</span>
              </button>
            </div>
          </div>

          {/* 2. Loại giao dịch */}
          <div className="grid grid-cols-3 gap-1.5 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-lg border border-[#E9EEF5] dark:border-slate-700">
            <button
              type="button"
              onClick={() => setType("EXPENSE")}
              className={`flex items-center justify-center gap-1 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                type === "EXPENSE"
                  ? "bg-rose-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              Chi tiêu
            </button>
            <button
              type="button"
              onClick={() => setType("INCOME")}
              className={`flex items-center justify-center gap-1 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                type === "INCOME"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <ArrowDownLeft className="w-3.5 h-3.5" />
              Thu nhập
            </button>
            <button
              type="button"
              onClick={() => setType("TRANSFER")}
              className={`flex items-center justify-center gap-1 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                type === "TRANSFER"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              Chuyển khoản
            </button>
          </div>

          {/* 3. Ô Nhập Số Tiền & Numpad Quick Buttons */}
          <div className="bg-slate-50 dark:bg-slate-800/80 rounded-lg p-4 border border-[#DCE4EE] dark:border-slate-700 text-center">
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Số tiền giao dịch (VND)
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={amountInput}
              onChange={(e) => handleAmountChange(e.target.value)}
              placeholder="0"
              autoFocus
              className="w-full text-center text-3xl sm:text-4xl font-black bg-transparent outline-none text-[#172B4D] dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-600"
            />
            <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mt-1">
              {numericAmount > 0 ? formatVND(numericAmount) : "Nhập số tiền..."}
            </p>

            {/* Quick Numpad Shortcuts */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 mt-3 pt-3 border-t border-[#E9EEF5] dark:border-slate-700">
              <button
                type="button"
                onClick={appendZeros}
                className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-[#DCE4EE] dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md text-xs font-black text-slate-700 dark:text-slate-200 shadow-2xs cursor-pointer"
              >
                +000
              </button>
              <button
                type="button"
                onClick={() => addQuickAmount(50000)}
                className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-[#DCE4EE] dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md text-xs font-bold text-slate-700 dark:text-slate-200 shadow-2xs cursor-pointer"
              >
                +50k
              </button>
              <button
                type="button"
                onClick={() => addQuickAmount(100000)}
                className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-[#DCE4EE] dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md text-xs font-bold text-slate-700 dark:text-slate-200 shadow-2xs cursor-pointer"
              >
                +100k
              </button>
              <button
                type="button"
                onClick={() => addQuickAmount(200000)}
                className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-[#DCE4EE] dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md text-xs font-bold text-slate-700 dark:text-slate-200 shadow-2xs cursor-pointer"
              >
                +200k
              </button>
              <button
                type="button"
                onClick={() => addQuickAmount(500000)}
                className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-[#DCE4EE] dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md text-xs font-bold text-slate-700 dark:text-slate-200 shadow-2xs cursor-pointer"
              >
                +500k
              </button>
            </div>
          </div>

          {/* 4. Mục đích chi tiêu */}
          {type === "EXPENSE" && (
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/80 p-2 rounded-lg border border-[#DCE4EE] dark:border-slate-700 text-xs">
              <span className="font-bold text-slate-600 dark:text-slate-300 shrink-0">Mục đích:</span>
              <button
                type="button"
                onClick={() => setScope("FAMILY")}
                className={`flex-1 py-1 px-2 rounded-md font-bold transition-all cursor-pointer ${
                  scope === "FAMILY"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                🏠 Chung gia đình
              </button>
              <button
                type="button"
                onClick={() => setScope("PERSONAL")}
                className={`flex-1 py-1 px-2 rounded-md font-bold transition-all cursor-pointer ${
                  scope === "PERSONAL"
                    ? "bg-purple-600 text-white shadow-xs"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                👤 Cá nhân riêng
              </button>
            </div>
          )}

          {/* 5. Chọn Tài Khoản Nguồn */}
          <SelectInput
            label={
              type === "TRANSFER"
                ? "Từ tài khoản (Nguồn)"
                : "Tài khoản / Thẻ thanh toán"
            }
            value={accountId}
            onChange={(val) => setAccountId(val)}
            leadingIcon={<CreditCard className="w-3.5 h-3.5" />}
            options={accounts.map((acc) => ({
              value: acc.id,
              label: `${acc.name} ${
                acc.type === "CREDIT_CARD"
                  ? `(Dư nợ: ${formatVND(acc.currentBalance)})`
                  : `(Số dư: ${formatVND(acc.currentBalance)})`
              }`,
            }))}
          />

          {/* Nếu là Chuyển Khoản -> Chọn Tài Khoản Nhận */}
          {type === "TRANSFER" ? (
            <SelectInput
              label="Đến tài khoản (Đích)"
              value={toAccountId}
              onChange={(val) => setToAccountId(val)}
              leadingIcon={<CreditCard className="w-3.5 h-3.5" />}
              options={accounts
                .filter((a) => a.id !== accountId)
                .map((acc) => ({
                  value: acc.id,
                  label: acc.name,
                }))}
            />
          ) : (
            <SelectInput
              label="Chọn danh mục"
              value={categoryId}
              onChange={(val) => setCategoryId(val)}
              leadingIcon={<Tag className="w-3.5 h-3.5" />}
              options={availableCategories.map((cat) => ({
                value: cat.id,
                label: cat.name,
              }))}
            />
          )}

          {/* Ngày Giao dịch & Ghi chú */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <DatePicker
              label="Ngày giao dịch"
              value={date}
              onChange={(val) => setDate(val)}
            />
            <TextInput
              label="Ghi chú"
              value={note}
              onChange={(val) => setNote(val)}
              placeholder="VD: Tiền chợ, Tiền nhà..."
              leadingIcon={<FileText className="w-3.5 h-3.5" />}
            />
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-md text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              className={`flex-1 py-2.5 px-4 rounded-md text-xs sm:text-sm font-bold text-white shadow-xs transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer ${
                type === "EXPENSE"
                  ? "bg-rose-600 hover:bg-rose-700"
                  : type === "INCOME"
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              <Check className="w-4 h-4" />
              {editTransaction ? "Lưu thay đổi" : "Lưu giao dịch"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
