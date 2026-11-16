"use client";

import React, { useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpDown,
  ArrowUpRight,
  Building2,
  ChevronDown,
  ChevronUp,
  Pencil,
  Trash2,
} from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { formatDateVN, formatVNDMasked } from "@/lib/formatters";
import { Transaction } from "@/types/finance";

export type TransactionSortField = "date" | "note" | "category" | "amount";
export type SortDirection = "asc" | "desc";

export interface TransactionListProps {
  transactions: Transaction[];
  onEdit?: (tx: Transaction) => void;
  onDelete?: (tx: Transaction) => void;
  onSelect?: (tx: Transaction) => void;
  compact?: boolean;
  maxItems?: number;
  defaultSortField?: TransactionSortField;
  defaultSortDirection?: SortDirection;
  emptyMessage?: string;
  className?: string;
}

export function TransactionList({
  transactions,
  onEdit,
  onDelete,
  onSelect,
  compact = false,
  maxItems,
  defaultSortField = "date",
  defaultSortDirection = "desc",
  emptyMessage = "Chưa có giao dịch nào phù hợp",
  className = "",
}: TransactionListProps) {
  const {
    getCategoryById,
    getAccountById,
    isPrivacyMode,
    settings,
    getSkyOneLinkForTransaction,
    switchSubApp,
  } = useFinance();

  const [sortField, setSortField] = useState<TransactionSortField>(defaultSortField);
  const [sortDirection, setSortDirection] = useState<SortDirection>(defaultSortDirection);

  const handleSort = (field: TransactionSortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection(field === "date" || field === "amount" ? "desc" : "asc");
    }
  };

  const sortedTransactions = useMemo(() => {
    const dir = sortDirection === "asc" ? 1 : -1;

    const getCategoryLabel = (tx: Transaction): string => {
      if (tx.type === "TRANSFER") return "Chuyển khoản ví";
      return getCategoryById(tx.categoryId)?.name || "Khác";
    };

    const getDescriptionLabel = (tx: Transaction): string => {
      if (tx.note?.trim()) return tx.note.trim();
      return getCategoryLabel(tx);
    };

    const copy = [...transactions].sort((a, b) => {
      let cmp = 0;
      if (sortField === "date") {
        cmp = a.date.localeCompare(b.date);
      } else if (sortField === "amount") {
        cmp = a.amount - b.amount;
      } else if (sortField === "category") {
        cmp = getCategoryLabel(a).localeCompare(getCategoryLabel(b), "vi");
      } else {
        cmp = getDescriptionLabel(a).localeCompare(getDescriptionLabel(b), "vi");
      }

      if (cmp !== 0) return cmp * dir;
      const dateFallback = b.date.localeCompare(a.date);
      if (dateFallback !== 0) return dateFallback;
      return (b.createdAt || "").localeCompare(a.createdAt || "");
    });

    return typeof maxItems === "number" ? copy.slice(0, maxItems) : copy;
  }, [transactions, sortField, sortDirection, maxItems, getCategoryById]);

  const renderSortIcon = (field: TransactionSortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-400 shrink-0" />;
    }
    return sortDirection === "asc" ? (
      <ChevronUp className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
    ) : (
      <ChevronDown className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
    );
  };

  const getAriaSort = (
    field: TransactionSortField
  ): "ascending" | "descending" | "none" => {
    if (sortField !== field) return "none";
    return sortDirection === "asc" ? "ascending" : "descending";
  };

  const showActions = Boolean(onEdit || onDelete);

  if (transactions.length === 0) {
    return (
      <div className={`p-10 text-center ${className}`}>
        <AlertCircle className="w-9 h-9 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
        <p className="text-xs font-bold text-slate-600 dark:text-slate-400">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={`w-full ${className}`} data-testid="transaction-list">
      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-50/90 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-bold border-b border-[#E9EEF5] dark:border-slate-800">
            <tr>
              <th aria-sort={getAriaSort("date")} className="py-3 px-3.5 whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => handleSort("date")}
                  className="inline-flex items-center gap-1 hover:text-[#172B4D] dark:hover:text-slate-100 cursor-pointer whitespace-nowrap"
                >
                  <span>Ngày</span>
                  {renderSortIcon("date")}
                </button>
              </th>

              <th aria-sort={getAriaSort("note")} className="py-3 px-3.5">
                <button
                  type="button"
                  onClick={() => handleSort("note")}
                  className="inline-flex items-center gap-1 hover:text-[#172B4D] dark:hover:text-slate-100 cursor-pointer whitespace-nowrap"
                >
                  <span>Mô tả</span>
                  {renderSortIcon("note")}
                </button>
              </th>

              <th aria-sort={getAriaSort("category")} className="py-3 px-3.5 whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => handleSort("category")}
                  className="inline-flex items-center gap-1 hover:text-[#172B4D] dark:hover:text-slate-100 cursor-pointer whitespace-nowrap"
                >
                  <span>Danh mục</span>
                  {renderSortIcon("category")}
                </button>
              </th>

              {!compact && (
                <th className="py-3 px-3.5 whitespace-nowrap hidden lg:table-cell">
                  Thành viên · Ví
                </th>
              )}

              <th
                aria-sort={getAriaSort("amount")}
                className="py-3 px-3.5 text-right whitespace-nowrap"
              >
                <button
                  type="button"
                  onClick={() => handleSort("amount")}
                  className="inline-flex items-center justify-end gap-1 ml-auto hover:text-[#172B4D] dark:hover:text-slate-100 cursor-pointer whitespace-nowrap"
                >
                  <span>Số tiền</span>
                  {renderSortIcon("amount")}
                </button>
              </th>

              {showActions && (
                <th className="py-3 px-3 text-center whitespace-nowrap">Thao tác</th>
              )}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {sortedTransactions.map((tx) => {
              const cat = getCategoryById(tx.categoryId);
              const acc = getAccountById(tx.accountId);
              const toAcc = tx.toAccountId ? getAccountById(tx.toAccountId) : undefined;
              const isExpense = tx.type === "EXPENSE";
              const isTransfer = tx.type === "TRANSFER";
              const memberLabel =
                tx.memberId === "HUSBAND" ? settings.husbandName : settings.wifeName;
              const accountLabel = isTransfer
                ? `${acc?.name || "Ví nguồn"} → ${toAcc?.name || "Ví đích"}`
                : acc?.name || "Ví tiền";
              const skyoneLink = getSkyOneLinkForTransaction(tx.id);

              return (
                <tr
                  key={tx.id}
                  onClick={onSelect ? () => onSelect(tx) : undefined}
                  className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition-colors ${
                    onSelect ? "cursor-pointer" : ""
                  }`}
                >
                  <td className="py-3 px-3.5 font-medium text-slate-600 dark:text-slate-300 tabular-nums whitespace-nowrap">
                    {formatDateVN(tx.date)}
                  </td>

                  <td className="py-3 px-3.5 max-w-[260px]">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        aria-hidden="true"
                        className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 text-white ${
                          isTransfer
                            ? "bg-blue-500"
                            : isExpense
                            ? "bg-rose-500"
                            : "bg-emerald-500"
                        }`}
                      >
                        {isTransfer ? (
                          <ArrowLeftRight className="w-3.5 h-3.5" />
                        ) : isExpense ? (
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        ) : (
                          <ArrowDownLeft className="w-3.5 h-3.5" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <p
                          title={tx.note || ""}
                          className="font-semibold text-[#172B4D] dark:text-slate-100 truncate"
                        >
                          {tx.note?.trim() ||
                            (isTransfer ? "Chuyển khoản nội bộ" : cat?.name || "Giao dịch")}
                        </p>
                        {compact && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {memberLabel} · {accountLabel}
                          </p>
                        )}
                        {skyoneLink && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              switchSubApp("SKYONE", {
                                skyoneTab:
                                  skyoneLink.kind === "PREPAYMENT" ? "PREPAYMENT" : "SCHEDULE",
                                highlightPeriod: skyoneLink.period ?? null,
                              });
                            }}
                            className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                          >
                            <Building2 className="w-3 h-3 shrink-0" />
                            <span>{skyoneLink.label} →</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </td>

                  <td className="py-3 px-3.5 whitespace-nowrap">
                    <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200 font-semibold">
                      <span
                        aria-hidden="true"
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: cat?.color || "#94A3B8" }}
                      />
                      <span className="truncate max-w-[140px]">
                        {isTransfer ? "Chuyển khoản" : cat?.name || "Khác"}
                      </span>
                    </div>
                  </td>

                  {!compact && (
                    <td className="py-3 px-3.5 text-slate-600 dark:text-slate-300 whitespace-nowrap hidden lg:table-cell">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {memberLabel}
                      </span>
                      <span className="mx-1.5 text-slate-300 dark:text-slate-600" aria-hidden="true">
                        ·
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        {accountLabel}
                      </span>
                      {tx.scope === "PERSONAL" && (
                        <>
                          <span
                            className="mx-1.5 text-slate-300 dark:text-slate-600"
                            aria-hidden="true"
                          >
                            ·
                          </span>
                          <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400">
                            Riêng
                          </span>
                        </>
                      )}
                    </td>
                  )}

                  <td
                    className={`py-3 px-3.5 text-right font-black tabular-nums whitespace-nowrap ${
                      isTransfer
                        ? "text-blue-600 dark:text-blue-400"
                        : isExpense
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-emerald-600 dark:text-emerald-400"
                    }`}
                  >
                    {isExpense ? "-" : isTransfer ? "" : "+"}{" "}
                    {formatVNDMasked(tx.amount, isPrivacyMode)}
                  </td>

                  {showActions && (
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <div className="inline-flex items-center justify-center gap-1">
                        {onEdit && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEdit(tx);
                            }}
                            title="Chỉnh sửa giao dịch"
                            aria-label="Chỉnh sửa giao dịch"
                            className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/15 rounded-md transition-colors cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {onDelete && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDelete(tx);
                            }}
                            title="Xóa giao dịch"
                            aria-label="Xóa giao dịch"
                            className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/15 rounded-md transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile & Compact Sort Controls + Cards */}
      <div className="md:hidden">
        <div className="px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/70 border-b border-[#E9EEF5] dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 shrink-0 mr-1">
            Sắp xếp:
          </span>
          {(
            [
              { id: "date", label: "Ngày" },
              { id: "note", label: "Mô tả" },
              { id: "category", label: "Danh mục" },
              { id: "amount", label: "Số tiền" },
            ] as const
          ).map((item) => {
            const active = sortField === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSort(item.id)}
                className={`min-h-[32px] px-2.5 py-1 rounded-md text-[11px] font-bold inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                  active
                    ? "bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 border border-[#DCE4EE] dark:border-slate-700 shadow-2xs"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <span>{item.label}</span>
                {renderSortIcon(item.id)}
              </button>
            );
          })}
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {sortedTransactions.map((tx) => {
            const cat = getCategoryById(tx.categoryId);
            const acc = getAccountById(tx.accountId);
            const toAcc = tx.toAccountId ? getAccountById(tx.toAccountId) : undefined;
            const isExpense = tx.type === "EXPENSE";
            const isTransfer = tx.type === "TRANSFER";
            const memberLabel =
              tx.memberId === "HUSBAND" ? settings.husbandName : settings.wifeName;
            const accountLabel = isTransfer
              ? `${acc?.name || "Ví nguồn"} → ${toAcc?.name || "Ví đích"}`
              : acc?.name || "Ví tiền";

            return (
              <div
                key={tx.id}
                onClick={onSelect ? () => onSelect(tx) : undefined}
                className={`p-3.5 space-y-2 hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition-colors ${
                  onSelect ? "cursor-pointer" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span
                      aria-hidden="true"
                      className="w-2.5 h-2.5 rounded-full shrink-0 mt-1.5"
                      style={{ backgroundColor: cat?.color || "#94A3B8" }}
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#172B4D] dark:text-slate-100 truncate">
                        {tx.note?.trim() ||
                          (isTransfer ? "Chuyển khoản ví" : cat?.name || "Giao dịch")}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {isTransfer ? "Chuyển khoản" : cat?.name || "Khác"} · {formatDateVN(tx.date)}
                      </p>
                    </div>
                  </div>

                  <p
                    className={`text-sm font-black tabular-nums whitespace-nowrap shrink-0 ${
                      isTransfer
                        ? "text-blue-600 dark:text-blue-400"
                        : isExpense
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-emerald-600 dark:text-emerald-400"
                    }`}
                  >
                    {isExpense ? "-" : isTransfer ? "" : "+"}{" "}
                    {formatVNDMasked(tx.amount, isPrivacyMode)}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="truncate">
                    {memberLabel} · {accountLabel}
                    {tx.scope === "PERSONAL" ? " · Riêng" : ""}
                  </span>

                  {showActions && (
                    <div className="flex items-center gap-1 shrink-0">
                      {onEdit && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEdit(tx);
                          }}
                          aria-label="Sửa giao dịch"
                          className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-md text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/15 hover:bg-blue-100 dark:hover:bg-blue-500/25 cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {onDelete && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(tx);
                          }}
                          aria-label="Xóa giao dịch"
                          className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-md text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/15 hover:bg-rose-100 dark:hover:bg-rose-500/25 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
