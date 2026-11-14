"use client";

import React, { useState } from "react";
import {
  Trash2,
  ArrowDownLeft,
  ArrowUpRight,
  Receipt,
  AlertCircle,
} from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { formatVNDMasked, formatDateVN } from "@/lib/formatters";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { CategoryIcon } from "@/components/common/CategoryIcon";

export function TransactionList() {
  const { filteredTransactions, getCategoryById, deleteTransaction, isPrivacyMode } =
    useFinance();
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const targetTransaction = filteredTransactions.find((tx) => tx.id === deleteTargetId);

  const handleConfirmDelete = () => {
    if (deleteTargetId) {
      deleteTransaction(deleteTargetId);
      setDeleteTargetId(null);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 shadow-xs overflow-hidden flex flex-col">
      {/* Header Danh sách */}
      <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Receipt className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Lịch sử giao dịch</h3>
            <p className="text-xs text-slate-400 dark:text-slate-400 font-medium">
              Sắp xếp theo ngày phát sinh mới nhất
            </p>
          </div>
        </div>
        <div className="text-xs font-semibold px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-md">
          {filteredTransactions.length} giao dịch
        </div>
      </div>

      {/* Nội dung danh sách */}
      {filteredTransactions.length === 0 ? (
        <div className="p-12 text-center">
          <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-xl flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="w-8 h-8" />
          </div>
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Không tìm thấy giao dịch nào</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-sm mx-auto">
            Không có bản ghi nào khớp với tiêu chí tìm kiếm hoặc bộ lọc hiện tại. Thử đổi bộ lọc hoặc thêm giao dịch mới.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">Mã GD</th>
                  <th className="py-3.5 px-4">Ngày</th>
                  <th className="py-3.5 px-4">Loại</th>
                  <th className="py-3.5 px-4">Danh mục</th>
                  <th className="py-3.5 px-4">Ghi chú</th>
                  <th className="py-3.5 px-4 text-right">Số tiền</th>
                  <th className="py-3.5 px-4 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredTransactions.map((tx) => {
                  const category = getCategoryById(tx.categoryId);
                  const isExpense = tx.type === "EXPENSE";

                  return (
                    <tr
                      key={tx.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition-colors group"
                    >
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                        {tx.id.length > 14 ? `${tx.id.substring(0, 12)}...` : tx.id}
                      </td>

                      <td className="py-3.5 px-4 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {formatDateVN(tx.date)}
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            isExpense
                              ? "bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-300 border border-rose-100 dark:border-rose-500/30"
                              : "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-500/30"
                          }`}
                        >
                          {isExpense ? (
                            <>
                              <ArrowUpRight className="w-3 h-3" />
                              Chi
                            </>
                          ) : (
                            <>
                              <ArrowDownLeft className="w-3 h-3" />
                              Thu
                            </>
                          )}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-800 dark:text-slate-100 bg-slate-100/90 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: category?.color || "#94A3B8" }}
                          />
                          <CategoryIcon
                            name={category?.icon}
                            className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400"
                          />
                          <span>{category?.name || "Khác"}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 max-w-xs truncate text-slate-600 dark:text-slate-300 font-medium">
                        {tx.note || <span className="text-slate-300 dark:text-slate-600 italic">Không có</span>}
                      </td>

                      <td
                        className={`py-3.5 px-4 text-right font-bold text-sm whitespace-nowrap ${
                          isExpense ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        {isExpense ? "-" : "+"} {formatVNDMasked(tx.amount, isPrivacyMode)}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => setDeleteTargetId(tx.id)}
                          title="Xóa giao dịch này"
                          className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/15 rounded-md transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
            {filteredTransactions.map((tx) => {
              const category = getCategoryById(tx.categoryId);
              const isExpense = tx.type === "EXPENSE";

              return (
                <div
                  key={tx.id}
                  className="p-4 flex items-center justify-between gap-3 hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0 text-white shadow-xs"
                      style={{ backgroundColor: category?.color || "#94A3B8" }}
                    >
                      <CategoryIcon name={category?.icon} className="w-5 h-5" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">
                          {category?.name || "Khác"}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-400 font-medium">
                          {formatDateVN(tx.date)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {tx.note || (isExpense ? "Chi tiêu" : "Thu nhập")}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <p
                        className={`text-sm font-bold whitespace-nowrap ${
                          isExpense ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        {isExpense ? "-" : "+"} {formatVNDMasked(tx.amount, isPrivacyMode)}
                      </p>
                      <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                        {isExpense ? "Khoản chi" : "Khoản thu"}
                      </span>
                    </div>

                    <button
                      onClick={() => setDeleteTargetId(tx.id)}
                      className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/15 rounded-md transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <ConfirmDialog
        isOpen={deleteTargetId !== null}
        title="Xóa giao dịch này?"
        message={`Bạn có chắc chắn muốn xóa giao dịch ${
          targetTransaction ? formatVNDMasked(targetTransaction.amount, isPrivacyMode) : ""
        } khỏi lịch sử chi tiêu? Thao tác này không thể hoàn tác.`}
        confirmLabel="Xóa vĩnh viễn"
        cancelLabel="Hủy"
        isDanger={true}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTargetId(null)}
      />
    </div>
  );
}
