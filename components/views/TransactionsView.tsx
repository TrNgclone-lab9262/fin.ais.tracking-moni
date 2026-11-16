"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Search,
  Download,
  Plus,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { formatVNDMasked, getMonthDisplayLabel } from "@/lib/formatters";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { TransactionFormModal } from "@/components/transactions/TransactionFormModal";
import { TransactionDetailSheet } from "@/components/mobile/sheets/TransactionDetailSheet";
import { TransactionList } from "@/components/dashboard/TransactionList";
import { SelectInput, TextInput } from "@/components/common/inputs";
import { Transaction, TransactionType } from "@/types/finance";

interface TransactionsViewProps {
  onOpenAddModal: () => void;
  onOpenBackupModal: () => void;
}

export function TransactionsView({
  onOpenAddModal,
  onOpenBackupModal,
}: TransactionsViewProps) {
  const {
    filteredTransactions,
    categories,
    accounts,
    selectedMonth,
    setSelectedMonth,
    availableMonths,
    selectedType,
    setSelectedType,
    selectedCategory,
    setSelectedCategory,
    selectedAccount,
    setSelectedAccount,
    searchQuery,
    setSearchQuery,
    deleteTransaction,
    activePerspective,
    isPrivacyMode,
  } = useFinance();

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [selectedTxForDetail, setSelectedTxForDetail] = useState<Transaction | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / pageSize));
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const filterSummary = useMemo(() => {
    let income = 0;
    let expense = 0;

    filteredTransactions.forEach((tx) => {
      if (tx.type === "INCOME") income += tx.amount;
      if (tx.type === "EXPENSE") expense += tx.amount;
    });

    return {
      count: filteredTransactions.length,
      income,
      expense,
      diff: income - expense,
    };
  }, [filteredTransactions]);

  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTransactions.slice(start, start + pageSize);
  }, [filteredTransactions, currentPage]);

  const targetTx = filteredTransactions.find((tx) => tx.id === deleteTargetId);

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* 1. Thanh Lọc & Tìm kiếm Toàn diện */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-[#DCE4EE] dark:border-slate-800 shadow-xs space-y-4">
        {/* Quick Month Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setSelectedMonth("ALL")}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                selectedMonth === "ALL"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
              }`}
            >
              Tất cả thời gian
            </button>
            {availableMonths.map((m) => (
              <button
                key={m}
                onClick={() => setSelectedMonth(m)}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  selectedMonth === m
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
                }`}
              >
                {getMonthDisplayLabel(m)}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenBackupModal}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-md transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Xuất dữ liệu</span>
            </button>
            <button
              onClick={onOpenAddModal}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-md shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm giao dịch</span>
            </button>
          </div>
        </div>

        {/* Dòng Dropdowns: Loại, Tài khoản, Danh mục, Search dùng bộ Input tái sử dụng */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-[#E9EEF5] dark:border-slate-800">
          <SelectInput
            value={selectedType}
            onChange={(val) => {
              setSelectedType(val as "ALL" | TransactionType);
              setCurrentPage(1);
            }}
            options={[
              { value: "ALL", label: "Tất cả loại giao dịch" },
              { value: "INCOME", label: "Thu nhập" },
              { value: "EXPENSE", label: "Chi tiêu" },
              { value: "TRANSFER", label: "Chuyển khoản" },
            ]}
          />

          <SelectInput
            value={selectedAccount}
            onChange={(val) => {
              setSelectedAccount(val);
              setCurrentPage(1);
            }}
            options={[
              { value: "ALL", label: "Tất cả tài khoản (Ví)" },
              ...accounts.map((a) => ({ value: a.id, label: a.name })),
            ]}
          />

          <SelectInput
            value={selectedCategory}
            onChange={(val) => {
              setSelectedCategory(val);
              setCurrentPage(1);
            }}
            options={[
              { value: "ALL", label: "Tất cả danh mục" },
              ...categories.map((c) => ({
                value: c.id,
                label: `${c.type === "INCOME" ? "[Thu] " : "[Chi] "}${c.name}`,
              })),
            ]}
          />

          <TextInput
            value={searchQuery}
            onChange={(val) => {
              setSearchQuery(val);
              setCurrentPage(1);
            }}
            placeholder="Tìm theo ghi chú..."
            leadingIcon={<Search className="w-4 h-4" />}
            trailingElement={
              searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  aria-label="Xóa từ khóa tìm kiếm"
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : undefined
            }
          />
        </div>
      </div>

      {/* 2. Dòng Tóm tắt Chỉ số */}
      <div className="flex flex-wrap items-center gap-4 sm:gap-8 px-2 text-xs font-bold text-slate-600 dark:text-slate-400">
        <span className="text-slate-700 dark:text-slate-200">
          📋 <strong>{filterSummary.count}</strong> giao dịch {activePerspective !== "ALL" ? `(${activePerspective === "HUSBAND" ? "Anh Chuột" : "Bé Mèo"})` : "(My Home)"}
        </span>
        <span className="text-emerald-600 dark:text-emerald-400">
          Thu: <strong>{formatVNDMasked(filterSummary.income, isPrivacyMode)}</strong>
        </span>
        <span className="text-rose-600 dark:text-rose-400">
          Chi: <strong>{formatVNDMasked(filterSummary.expense, isPrivacyMode)}</strong>
        </span>
        <span className="text-blue-600 dark:text-blue-400">
          Chênh lệch: <strong>{formatVNDMasked(filterSummary.diff, isPrivacyMode)}</strong>
        </span>
      </div>

      {/* 3. Bảng Giao Dịch Chi Tiết Đa Thiết Bị (TransactionList có sắp xếp) */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 shadow-xs overflow-hidden">
        <TransactionList
          transactions={paginatedList}
          onEdit={(tx) => setEditingTx(tx)}
          onDelete={(tx) => setDeleteTargetId(tx.id)}
          onSelect={(tx) => setSelectedTxForDetail(tx)}
          emptyMessage="Không tìm thấy giao dịch nào phù hợp"
        />

        {/* Phân trang */}
        {filteredTransactions.length > pageSize && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-1">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setCurrentPage(p)}
                  className={`w-7 h-7 rounded-lg font-bold text-xs cursor-pointer ${
                    currentPage === p ? "bg-blue-600 text-white" : "hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <span>
              Hiển thị {(currentPage - 1) * pageSize + 1}-
              {Math.min(currentPage * pageSize, filteredTransactions.length)} của{" "}
              {filteredTransactions.length} giao dịch
            </span>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={deleteTargetId !== null}
        title="Xóa giao dịch này?"
        message={`Bạn có chắc muốn xóa giao dịch ${
          targetTx ? formatVNDMasked(targetTx.amount, isPrivacyMode) : ""
        }?`}
        confirmLabel="Xóa"
        cancelLabel="Hủy"
        isDanger={true}
        onConfirm={() => {
          if (deleteTargetId) {
            deleteTransaction(deleteTargetId);
            setDeleteTargetId(null);
          }
        }}
        onCancel={() => setDeleteTargetId(null)}
      />

      {/* Mobile Transaction Detail Bottom Sheet */}
      <TransactionDetailSheet
        transaction={selectedTxForDetail}
        isOpen={selectedTxForDetail !== null}
        onClose={() => setSelectedTxForDetail(null)}
        onEdit={(tx) => {
          setSelectedTxForDetail(null);
          setEditingTx(tx);
        }}
        onDelete={(id) => {
          setSelectedTxForDetail(null);
          setDeleteTargetId(id);
        }}
      />

      {/* Modal Chỉnh Sửa Giao Dịch */}
      {editingTx && (
        <TransactionFormModal
          isOpen={editingTx !== null}
          onClose={() => setEditingTx(null)}
          editTransaction={editingTx}
        />
      )}
    </div>
  );
}
