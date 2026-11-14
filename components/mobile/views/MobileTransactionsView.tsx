"use client";

import React, { useState, useMemo } from "react";
import { Search, Plus, Sparkles } from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { formatVNDMasked, formatDateVN } from "@/lib/formatters";
import { Transaction } from "@/types/finance";
import { MobileMonthSelector } from "@/components/mobile/MobileMonthSelector";
import { TransactionDetailSheet } from "@/components/mobile/sheets/TransactionDetailSheet";
import { TransactionFormModal } from "@/components/transactions/TransactionFormModal";

interface MobileTransactionsViewProps {
  onOpenAddModal: () => void;
}

type QuickFilter = "ALL" | "HUSBAND" | "WIFE" | "FAMILY";

export function MobileTransactionsView({ onOpenAddModal }: MobileTransactionsViewProps) {
  const {
    filteredTransactions,
    budgetSummary,
    todaySpentInfo,
    isPrivacyMode,
    settings,
    deleteTransaction,
    getCategoryById,
    getAccountById,
  } = useFinance();

  const [quickFilter, setQuickFilter] = useState<QuickFilter>("ALL");
  const [search, setSearch] = useState("");
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  const displayedTransactions = useMemo(() => {
    return filteredTransactions.filter((tx) => {
      if (quickFilter === "HUSBAND" && tx.memberId !== "HUSBAND") return false;
      if (quickFilter === "WIFE" && tx.memberId !== "WIFE") return false;
      if (quickFilter === "FAMILY" && tx.scope !== "FAMILY") return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const noteMatch = (tx.note || "").toLowerCase().includes(q);
        const cat = getCategoryById(tx.categoryId);
        const catMatch = (cat?.name || "").toLowerCase().includes(q);
        const acc = getAccountById(tx.accountId);
        const accMatch = (acc?.name || "").toLowerCase().includes(q);
        return noteMatch || catMatch || accMatch;
      }
      return true;
    });
  }, [filteredTransactions, quickFilter, search, getCategoryById, getAccountById]);

  const totalExpense = useMemo(() => {
    return displayedTransactions
      .filter((tx) => tx.type === "EXPENSE")
      .reduce((sum, tx) => sum + tx.amount, 0);
  }, [displayedTransactions]);

  const counts = useMemo(() => {
    return {
      all: filteredTransactions.length,
      husband: filteredTransactions.filter((t) => t.memberId === "HUSBAND").length,
      wife: filteredTransactions.filter((t) => t.memberId === "WIFE").length,
      family: filteredTransactions.filter((t) => t.scope === "FAMILY").length,
    };
  }, [filteredTransactions]);

  const dailyAllowance = budgetSummary?.dailyAllowance || 0;
  const todayRemaining = Math.max(0, dailyAllowance - todaySpentInfo.amount);

  return (
    <div className="space-y-3 animate-in fade-in duration-200">
      {/* 1. Header Tìm Kiếm & Lọc Nhanh */}
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo ghi chú, danh mục, ví..."
            className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-[#DCE4EE] dark:border-slate-800 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={onOpenAddModal}
          className="h-9 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs shrink-0 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Ghi 3s</span>
        </button>
      </div>

      {/* 1B. CHỌN KỲ / THÁNG */}
      <MobileMonthSelector />

      {/* 2. KHỐI LỌC 4 VIÊN */}
      <div className="grid grid-cols-4 gap-1.5 text-xs font-bold">
        <button
          onClick={() => setQuickFilter("ALL")}
          className={`py-2 px-1 rounded-xl transition-all text-center border cursor-pointer ${
            quickFilter === "ALL"
              ? "bg-blue-600 border-blue-600 text-white shadow-xs"
              : "bg-white dark:bg-slate-900 border-[#DCE4EE] dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          }`}
        >
          Tất cả ({counts.all})
        </button>

        <button
          onClick={() => setQuickFilter("HUSBAND")}
          className={`py-2 px-1 rounded-xl transition-all text-center border cursor-pointer truncate ${
            quickFilter === "HUSBAND"
              ? "bg-blue-600 border-blue-600 text-white shadow-xs"
              : "bg-white dark:bg-slate-900 border-[#DCE4EE] dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          }`}
        >
          👨 Chuột ({counts.husband})
        </button>

        <button
          onClick={() => setQuickFilter("WIFE")}
          className={`py-2 px-1 rounded-xl transition-all text-center border cursor-pointer truncate ${
            quickFilter === "WIFE"
              ? "bg-blue-600 border-blue-600 text-white shadow-xs"
              : "bg-white dark:bg-slate-900 border-[#DCE4EE] dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          }`}
        >
          👩 Mèo ({counts.wife})
        </button>

        <button
          onClick={() => setQuickFilter("FAMILY")}
          className={`py-2 px-1 rounded-xl transition-all text-center border cursor-pointer truncate ${
            quickFilter === "FAMILY"
              ? "bg-blue-600 border-blue-600 text-white shadow-xs"
              : "bg-white dark:bg-slate-900 border-[#DCE4EE] dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          }`}
        >
          🏠 Chung ({counts.family})
        </button>
      </div>

      {/* 3. THẺ TÓM TẮT BỘ LỌC */}
      <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 shadow-xs flex items-center justify-between text-xs gap-2">
        <div>
          <span className="text-[10px] text-slate-400 dark:text-slate-400 font-bold uppercase tracking-wider block">
            Tổng chi trong bộ lọc
          </span>
          <span className="text-base font-black text-[#BE123C] dark:text-rose-400">
            -{formatVNDMasked(totalExpense, isPrivacyMode)}
          </span>
        </div>

        <div className="text-right">
          <span className="text-[10px] text-slate-400 dark:text-slate-400 font-bold uppercase tracking-wider block">
            Hạn mức ngày ({todaySpentInfo.isCurrentDay ? "Hôm nay" : formatDateVN(todaySpentInfo.referenceDate)})
          </span>
          <span
            className={`text-xs font-black ${
              todaySpentInfo.amount > dailyAllowance ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
            }`}
          >
            Còn {formatVNDMasked(todayRemaining, isPrivacyMode)} / {formatVNDMasked(dailyAllowance, isPrivacyMode)}
          </span>
        </div>
      </div>

      {/* 4. DANH SÁCH BENTO CARDS HOẶC TRẠNG THÁI RỖNG */}
      {displayedTransactions.length === 0 ? (
        <div className="p-8 bg-white dark:bg-slate-900 rounded-2xl border border-[#DCE4EE] dark:border-slate-800 shadow-xs text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center text-3xl mx-auto shadow-inner">
            🧾
          </div>

          <div className="space-y-1">
            <h4 className="font-extrabold text-slate-800 dark:text-slate-100 text-base">
              Chưa Có Giao Dịch Nào
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs mx-auto">
              Không tìm thấy giao dịch phù hợp với bộ lọc hiện tại. Hãy ghi chép ngay để bảo toàn mục tiêu gia đình!
            </p>
          </div>

          <button
            onClick={onOpenAddModal}
            className="w-full max-w-xs mx-auto py-3 bg-[#2563EB] hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>+ GHI CHÉP GIAO DỊCH (3S)</span>
          </button>

          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-left text-xs text-emerald-800 dark:text-emerald-300 space-y-0.5">
            <span className="font-bold flex items-center gap-1 text-[11px]">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              Mẹo tài chính tổ ấm:
            </span>
            <p className="text-[10px] text-emerald-700 dark:text-emerald-300/90 leading-relaxed">
              Ghi chép trong 3 giây sau khi quẹt thẻ giúp 2 vợ chồng bảo vệ điểm tín dụng CIC và tiến độ Quỹ Mua Nhà 2028.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {displayedTransactions.map((tx) => {
            const cat = getCategoryById(tx.categoryId);
            const acc = getAccountById(tx.accountId);
            const isExpense = tx.type === "EXPENSE";
            const isTransfer = tx.type === "TRANSFER";

            return (
              <div
                key={tx.id}
                onClick={() => setSelectedTx(tx)}
                className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 shadow-xs hover:border-blue-400 dark:hover:border-blue-500 active:bg-blue-50/50 dark:active:bg-slate-800 cursor-pointer transition-all space-y-2"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        tx.memberId === "HUSBAND"
                          ? "bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30"
                          : "bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30"
                      }`}
                    >
                      {tx.memberId === "HUSBAND"
                        ? `👨 ${settings.husbandName}`
                        : `👩 ${settings.wifeName}`}
                    </span>

                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                        tx.scope === "FAMILY"
                          ? "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                          : "bg-purple-50 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30"
                      }`}
                    >
                      {tx.scope === "FAMILY" ? "🏠 Chung" : "👤 Riêng"}
                    </span>
                  </div>

                  <span className="text-[11px] text-slate-400 dark:text-slate-400 font-medium">
                    {formatDateVN(tx.date)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm shrink-0 ${
                        isExpense
                          ? "bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400"
                          : isTransfer
                          ? "bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400"
                          : "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {isExpense ? "🛒" : isTransfer ? "⇄" : "💰"}
                    </div>

                    <div className="min-w-0">
                      <span className="font-bold text-xs text-slate-800 dark:text-slate-100 block truncate">
                        {tx.note || (isExpense ? "Chi tiêu" : isTransfer ? "Chuyển tiền" : "Thu nhập")}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium block truncate">
                        {isTransfer ? "Chuyển khoản ví" : cat?.name || "Chi tiêu"} · {acc?.name || "Ví"}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`text-sm sm:text-base font-black shrink-0 ${
                      isExpense
                        ? "text-[#BE123C] dark:text-rose-400"
                        : isTransfer
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-[#047857] dark:text-emerald-400"
                    }`}
                  >
                    {isExpense ? "-" : isTransfer ? "" : "+"}
                    {formatVNDMasked(tx.amount, isPrivacyMode)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Action Sheet chi tiết giao dịch */}
      <TransactionDetailSheet
        transaction={selectedTx}
        isOpen={selectedTx !== null}
        onClose={() => setSelectedTx(null)}
        onEdit={(tx) => {
          setSelectedTx(null);
          setEditingTx(tx);
        }}
        onDelete={(id) => {
          setSelectedTx(null);
          deleteTransaction(id);
        }}
      />

      <TransactionFormModal
        isOpen={editingTx !== null}
        onClose={() => setEditingTx(null)}
        editTransaction={editingTx}
      />
    </div>
  );
}
