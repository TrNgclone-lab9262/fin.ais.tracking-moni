"use client";

import React from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  History,
  ChevronRight,
} from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { formatVNDMasked, formatDateVN } from "@/lib/formatters";

export function RecentActivitySection() {
  const {
    filteredTransactions,
    budgetSummary,
    getCategoryById,
    getAccountById,
    setActiveTab,
    isPrivacyMode,
  } = useFinance();

  const recentList = filteredTransactions.slice(0, 8);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
        <History className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        Hoạt động gần đây
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* CỘT 1 & 2: GIAO DỊCH GẦN ĐÂY */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl p-5 sm:p-6 border border-[#DCE4EE] dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-4 border-b border-[#E9EEF5] dark:border-slate-800">
            <h3 className="text-sm sm:text-base font-bold text-[#172B4D] dark:text-slate-100">
              Giao dịch gần đây
            </h3>
            <button
              onClick={() => setActiveTab("transactions")}
              className="text-xs font-semibold px-2 py-1 rounded-md text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50/50 dark:hover:bg-blue-500/15 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>Xem tất cả</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-3">
            {recentList.map((tx) => {
              const cat = getCategoryById(tx.categoryId);
              const acc = getAccountById(tx.accountId);
              const toAcc = tx.toAccountId ? getAccountById(tx.toAccountId) : undefined;
              const isExpense = tx.type === "EXPENSE";
              const isTransfer = tx.type === "TRANSFER";

              return (
                <div
                  key={tx.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg bg-slate-50/80 dark:bg-slate-800/70 hover:bg-slate-100/80 dark:hover:bg-slate-800 transition-colors border border-[#E9EEF5] dark:border-slate-700/80"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-white ${
                        isTransfer
                          ? "bg-blue-500"
                          : isExpense
                          ? "bg-rose-500"
                          : "bg-emerald-500"
                      }`}
                    >
                      {isTransfer ? (
                        <ArrowLeftRight className="w-4 h-4" />
                      ) : isExpense ? (
                        <ArrowUpRight className="w-4 h-4" />
                      ) : (
                        <ArrowDownLeft className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-[#172B4D] dark:text-slate-100 truncate">
                          {isTransfer ? "Chuyển khoản" : cat?.name || "Khác"}
                        </span>
                        {tx.tag === "RECURRING" && (
                          <span className="text-[9px] font-bold text-blue-600 dark:text-blue-300 bg-blue-100 dark:bg-blue-500/20 px-1 rounded-xs">
                            Định kỳ
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 dark:text-slate-400 truncate mt-0.5">
                        {formatDateVN(tx.date)} ·{" "}
                        {isTransfer
                          ? `${acc?.name} → ${toAcc?.name}`
                          : acc?.name || "Ví tiền"}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span
                      className={`text-xs font-extrabold whitespace-nowrap ${
                        isTransfer
                          ? "text-blue-600 dark:text-blue-400"
                          : isExpense
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {isExpense ? "-" : isTransfer ? "" : "+"} {formatVNDMasked(tx.amount, isPrivacyMode)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* CỘT 3: NGÂN SÁCH THÁNG NÀY (PROGRESS BARS) */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 sm:p-6 border border-[#DCE4EE] dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100">
              Ngân sách tháng này
            </h3>
            <button
              onClick={() => setActiveTab("planning")}
              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>Chi tiết</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-4 py-3">
            {budgetSummary.items.slice(0, 4).map((item) => {
              const isOver = item.percentage >= 100;
              return (
                <div key={item.categoryId} className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: item.categoryColor }}
                      />
                      {item.categoryName}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                      {formatVNDMasked(item.spentAmount, isPrivacyMode)} /{" "}
                      {formatVNDMasked(item.limitAmount, isPrivacyMode)}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isOver ? "bg-amber-500" : "bg-emerald-500"
                      }`}
                      style={{ width: `${Math.min(100, item.percentage)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                    <span>
                      {isOver
                        ? "Hết ngân sách"
                        : `Còn ${formatVNDMasked(item.remainingAmount, isPrivacyMode)}`}
                    </span>
                    <span className="font-bold">{item.percentage}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
