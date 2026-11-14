"use client";

import React, { useState, useMemo } from "react";
import {
  CreditCard,
  Plus,
  Building2,
  Eye,
  Trash2,
  Pencil,
  X,
} from "lucide-react";
import { useFinance, CreditCardInfo } from "@/context/FinanceContext";
import { Account, AccountType, FamilyMember } from "@/types/finance";
import { formatVNDMasked, formatDateVN } from "@/lib/formatters";
import { calculateCreditCardCycleInfo } from "@/lib/financeEngine";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { CreditCardRepaymentSheet } from "@/components/mobile/sheets/CreditCardRepaymentSheet";

export function AccountsView() {
  const {
    accounts,
    transactions,
    selectedMonth,
    isPrivacyMode,
    settings,
    addAccount,
    updateAccount,
    deleteAccount,
    getCategoryById,
  } = useFinance();

  const [selectedAccountForDetail, setSelectedAccountForDetail] = useState<Account | null>(null);
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [repayingCardInfo, setRepayingCardInfo] = useState<CreditCardInfo | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [owner, setOwner] = useState<FamilyMember>("HUSBAND");
  const [type, setType] = useState<AccountType>("BANK");
  const [initialBalance, setInitialBalance] = useState("");
  const [creditLimit, setCreditLimit] = useState("");
  const [statementDay, setStatementDay] = useState("20");
  const [dueDay, setDueDay] = useState("6");
  const [accountNumber, setAccountNumber] = useState("");

  const husbandAccounts = accounts.filter((a) => a.owner === "HUSBAND");
  const wifeAccounts = accounts.filter((a) => a.owner === "WIFE");
  const sharedAccounts = accounts.filter((a) => a.owner === "SHARED");

  const totalAvailable = useMemo(() => {
    return accounts
      .filter((a) => a.type !== "CREDIT_CARD")
      .reduce((sum, a) => sum + Math.max(0, a.currentBalance), 0);
  }, [accounts]);

  const totalCreditDebt = useMemo(() => {
    return accounts
      .filter((a) => a.type === "CREDIT_CARD")
      .reduce((sum, a) => sum + Math.max(0, a.currentBalance), 0);
  }, [accounts]);

  const handleOpenAddAccount = () => {
    setEditingAccount(null);
    setName("");
    setInitialBalance("");
    setCreditLimit("");
    setStatementDay("20");
    setDueDay("6");
    setAccountNumber("");
    setOwner("HUSBAND");
    setType("BANK");
    setIsAddAccountModalOpen(true);
  };

  const handleOpenEditAccount = (acc: Account) => {
    setEditingAccount(acc);
    setName(acc.name);
    setOwner(acc.owner);
    setType(acc.type);
    setInitialBalance(new Intl.NumberFormat("vi-VN").format(acc.initialBalance));
    setCreditLimit(acc.creditLimit ? new Intl.NumberFormat("vi-VN").format(acc.creditLimit) : "");
    setStatementDay(String(acc.statementDay || 20));
    setDueDay(String(acc.dueDay || 6));
    setAccountNumber(acc.accountNumber || "");
    setIsAddAccountModalOpen(true);
  };

  const handleSubmitAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const initVal = parseFloat(initialBalance.replace(/[^0-9]/g, "")) || 0;
    const limitVal = type === "CREDIT_CARD" ? parseFloat(creditLimit.replace(/[^0-9]/g, "")) || 0 : undefined;
    const stDay = type === "CREDIT_CARD" ? Math.min(28, Math.max(1, parseInt(statementDay, 10) || 20)) : undefined;
    const duDay = type === "CREDIT_CARD" ? Math.min(28, Math.max(1, parseInt(dueDay, 10) || 6)) : undefined;

    if (editingAccount) {
      updateAccount(editingAccount.id, {
        name: name.trim(),
        owner,
        initialBalance: initVal,
        creditLimit: limitVal,
        statementDay: stDay,
        dueDay: duDay,
        accountNumber: accountNumber.trim() || undefined,
      });
    } else {
      addAccount({
        name: name.trim(),
        owner,
        type,
        initialBalance: initVal,
        creditLimit: limitVal,
        statementDay: stDay,
        dueDay: duDay,
        accountNumber: accountNumber.trim() || undefined,
      });
    }

    setName("");
    setInitialBalance("");
    setCreditLimit("");
    setAccountNumber("");
    setIsAddAccountModalOpen(false);
    setEditingAccount(null);
  };

  const detailTransactions = useMemo(() => {
    if (!selectedAccountForDetail) return [];

    const accId = selectedAccountForDetail.id;
    const isCredit = selectedAccountForDetail.type === "CREDIT_CARD";

    const list = transactions.filter(
      (tx) => tx.accountId === accId || tx.toAccountId === accId
    );

    const sortedAsc = [...list].sort((a, b) => a.date.localeCompare(b.date));

    let runningBalance = selectedAccountForDetail.initialBalance;
    const computed = sortedAsc.map((tx) => {
      let change = 0;
      let oppositeAccId: string | undefined = undefined;

      if (isCredit) {
        if (tx.type === "EXPENSE" && tx.accountId === accId) {
          change = tx.amount;
        } else if (tx.type === "TRANSFER" && tx.toAccountId === accId) {
          change = -tx.amount;
        }
      } else {
        if (tx.type === "INCOME" && tx.accountId === accId) {
          change = tx.amount;
        } else if (tx.type === "EXPENSE" && tx.accountId === accId) {
          change = -tx.amount;
        } else if (tx.type === "TRANSFER") {
          if (tx.accountId === accId) {
            change = -tx.amount;
            oppositeAccId = tx.toAccountId;
          } else if (tx.toAccountId === accId) {
            change = tx.amount;
            oppositeAccId = tx.accountId;
          }
        }
      }

      runningBalance += change;
      return {
        ...tx,
        change,
        balanceAfter: runningBalance,
        oppositeAccId,
      };
    });

    return computed.reverse();
  }, [selectedAccountForDetail, transactions]);

  const renderAccountCard = (acc: Account) => {
    const isCredit = acc.type === "CREDIT_CARD";
    const cycleInfo = isCredit ? calculateCreditCardCycleInfo(acc, selectedMonth) : null;

    return (
      <div
        key={acc.id}
        className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-[#DCE4EE] dark:border-slate-800 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
      >
        <div>
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-11 h-11 rounded-lg flex items-center justify-center text-white shrink-0 shadow-xs"
                style={{ backgroundColor: acc.color || "#0284C7" }}
              >
                {isCredit ? <CreditCard className="w-6 h-6" /> : <Building2 className="w-6 h-6" />}
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-[#172B4D] dark:text-slate-100 text-sm truncate">{acc.name}</h4>
                <p className="text-[11px] text-slate-400 font-medium truncate">
                  {acc.accountNumber || (isCredit ? "Thẻ tín dụng" : "Tài khoản thanh toán")}
                </p>
              </div>
            </div>

            {cycleInfo && (
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                  cycleInfo.statusLevel === "DANGER"
                    ? "bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300"
                    : cycleInfo.statusLevel === "WARNING"
                    ? "bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300"
                    : cycleInfo.statusLevel === "WATCH"
                    ? "bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300"
                    : "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                }`}
              >
                {cycleInfo.usagePercentage}% · {cycleInfo.statusLabel}
              </span>
            )}
          </div>

          <div className="mt-4 space-y-1.5 pt-3 border-t border-[#E9EEF5] dark:border-slate-800 text-xs">
            {isCredit && cycleInfo ? (
              <>
                <div className="flex justify-between text-slate-400">
                  <span>Hạn mức thẻ:</span>
                  <span className="font-bold text-slate-700 dark:text-slate-200">
                    {formatVNDMasked(cycleInfo.creditLimit, isPrivacyMode)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-800 dark:text-slate-100">
                  <span className="font-bold text-amber-600 dark:text-amber-400">Dư nợ đã dùng:</span>
                  <span className="text-sm font-black text-amber-600 dark:text-amber-400">
                    {formatVNDMasked(cycleInfo.usedAmount, isPrivacyMode)}
                  </span>
                </div>
                <div className="relative w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden my-1">
                  <div
                    className={`h-full rounded-full ${
                      cycleInfo.statusLevel === "DANGER"
                        ? "bg-rose-500"
                        : cycleInfo.statusLevel === "WARNING"
                        ? "bg-orange-500"
                        : cycleInfo.statusLevel === "WATCH"
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                    }`}
                    style={{ width: `${Math.min(100, cycleInfo.usagePercentage)}%` }}
                  />
                  <div className="absolute top-0 bottom-0 w-0.5 bg-slate-700 dark:bg-slate-300" style={{ left: "30%" }} />
                </div>
                <div className="flex justify-between text-slate-500 dark:text-slate-400 font-medium">
                  <span>Còn khả dụng:</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                    {formatVNDMasked(cycleInfo.availableAmount, isPrivacyMode)}
                  </span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>Sao kê: Ngày {cycleInfo.statementDay}</span>
                  <span>Hạn trả: {cycleInfo.dueDateDisplay}</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between text-slate-400">
                  <span>Số dư đầu kỳ:</span>
                  <span className="font-semibold text-slate-600 dark:text-slate-300">
                    {formatVNDMasked(acc.initialBalance, isPrivacyMode)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-800 dark:text-slate-100">
                  <span className="font-bold">Số dư hiện tại:</span>
                  <span className="text-sm font-black text-blue-600 dark:text-blue-400">
                    {formatVNDMasked(acc.currentBalance, isPrivacyMode)}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-[#E9EEF5] dark:border-slate-800 flex items-center justify-between">
          <button
            onClick={() => setSelectedAccountForDetail(acc)}
            className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 bg-blue-50 dark:bg-blue-500/15 hover:bg-blue-100 dark:hover:bg-blue-500/25 px-3 py-1.5 rounded-md transition-colors cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Xem sổ giao dịch</span>
          </button>

          <div className="flex items-center gap-1">
            {isCredit && cycleInfo && (
              <button
                onClick={() => setRepayingCardInfo(cycleInfo)}
                title="Trả nợ thẻ"
                className="px-2 py-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/15 hover:bg-blue-100 dark:hover:bg-blue-500/25 rounded-md transition-colors cursor-pointer"
              >
                Trả nợ
              </button>
            )}
            <button
              onClick={() => handleOpenEditAccount(acc)}
              title="Chỉnh sửa tài khoản"
              className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/15 rounded-md transition-colors cursor-pointer"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={() => setDeleteTargetId(acc.id)}
              title="Xóa tài khoản"
              className="p-1.5 text-slate-300 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/15 rounded-md transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-[#DCE4EE] dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-6 sm:gap-12">
          <div>
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block">
              Tổng số dư khả dụng (Ví & Bank)
            </span>
            <span className="text-xl sm:text-2xl font-black text-blue-600 dark:text-blue-400 mt-1 block">
              {formatVNDMasked(totalAvailable, isPrivacyMode)}
            </span>
          </div>
          <div>
            <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
              Tổng dư nợ thẻ BIDV Credit
            </span>
            <span className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 mt-1 block">
              {formatVNDMasked(totalCreditDebt, isPrivacyMode)}
            </span>
          </div>
        </div>

        <button
          onClick={handleOpenAddAccount}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs sm:text-sm font-bold shadow-xs active:scale-95 transition-all self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Thêm ví / thẻ</span>
        </button>
      </div>

      {/* NHÓM 1 */}
      <section className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
          <span>👨</span>
          <span>Tài khoản của {settings.husbandName}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {husbandAccounts.map((acc) => renderAccountCard(acc))}
        </div>
      </section>

      {/* NHÓM 2 */}
      <section className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
          <span>👩</span>
          <span>Tài khoản của {settings.wifeName}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {wifeAccounts.map((acc) => renderAccountCard(acc))}
        </div>
      </section>

      {/* NHÓM 3 */}
      {sharedAccounts.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            <span>🏡</span>
            <span>Quỹ chung tổ ấm (My Home)</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sharedAccounts.map((acc) => renderAccountCard(acc))}
          </div>
        </section>
      )}

      {/* Modal Sổ chi tiết */}
      {selectedAccountForDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-xl shadow-2xl overflow-hidden border border-[#DCE4EE] dark:border-slate-800 flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-[#E9EEF5] dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/60">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-[#172B4D] dark:text-slate-100">
                  Sổ chi tiết giao dịch - {selectedAccountForDetail.name}
                </h3>
                <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold mt-0.5">
                  {selectedAccountForDetail.type === "CREDIT_CARD"
                    ? `Dư nợ hiện tại: ${formatVNDMasked(selectedAccountForDetail.currentBalance, isPrivacyMode)}`
                    : `Số dư lũy kế: ${formatVNDMasked(selectedAccountForDetail.currentBalance, isPrivacyMode)}`}
                </p>
              </div>
              <button
                onClick={() => setSelectedAccountForDetail(null)}
                className="w-8 h-8 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {detailTransactions.length === 0 ? (
                <p className="text-center py-12 text-xs text-slate-400 font-semibold">
                  Tài khoản này chưa có giao dịch phát sinh nào
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                      <tr>
                        <th className="py-3 px-3">Ngày</th>
                        <th className="py-3 px-3">Người chi</th>
                        <th className="py-3 px-3">Loại</th>
                        <th className="py-3 px-3">Danh mục</th>
                        <th className="py-3 px-3 text-right">Số tiền</th>
                        <th className="py-3 px-3">Ví đối ứng</th>
                        <th className="py-3 px-3">Ghi chú</th>
                        <th className="py-3 px-3 text-right">Số dư sau GD</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {detailTransactions.map((item) => {
                        const cat = getCategoryById(item.categoryId);
                        const oppAcc = item.oppositeAccId
                          ? accounts.find((a) => a.id === item.oppositeAccId)
                          : undefined;

                        return (
                          <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                            <td className="py-3 px-3 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                              {formatDateVN(item.date)}
                            </td>
                            <td className="py-3 px-3 font-bold text-slate-700 dark:text-slate-200">
                              {item.memberId === "HUSBAND" ? `👨 ${settings.husbandName}` : `👩 ${settings.wifeName}`}
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  item.type === "TRANSFER"
                                    ? "bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-300"
                                    : item.change < 0
                                    ? "bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-300"
                                    : "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
                                }`}
                              >
                                {item.type === "TRANSFER" ? "Chuyển khoản" : item.type === "EXPENSE" ? "Chi" : "Thu"}
                              </span>
                            </td>
                            <td className="py-3 px-3 font-semibold text-slate-700 dark:text-slate-200">
                              {cat?.name || "Khác"}
                            </td>
                            <td
                              className={`py-3 px-3 text-right font-bold whitespace-nowrap ${
                                item.change < 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
                              }`}
                            >
                              {item.change < 0 ? "-" : "+"} {formatVNDMasked(item.amount, isPrivacyMode)}
                            </td>
                            <td className="py-3 px-3 text-slate-500 dark:text-slate-400 font-medium">
                              {oppAcc?.name || "—"}
                            </td>
                            <td className="py-3 px-3 text-slate-600 dark:text-slate-300 max-w-xs truncate">
                              {item.note || "—"}
                            </td>
                            <td className="py-3 px-3 text-right font-black text-slate-800 dark:text-slate-100 whitespace-nowrap">
                              {formatVNDMasked(item.balanceAfter, isPrivacyMode)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Thêm / Chỉnh sửa tài khoản */}
      {isAddAccountModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl shadow-2xl p-6 border border-[#DCE4EE] dark:border-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#E9EEF5] dark:border-slate-800">
              <h3 className="text-base font-bold text-[#172B4D] dark:text-slate-100">
                {editingAccount ? "Chỉnh sửa tài khoản / thẻ" : "Thêm tài khoản / thẻ mới"}
              </h3>
              <button
                onClick={() => {
                  setIsAddAccountModalOpen(false);
                  setEditingAccount(null);
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitAccount} className="space-y-3.5 pt-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Chủ sở hữu</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setOwner("HUSBAND")}
                    className={`py-2 text-xs font-bold rounded-md border cursor-pointer ${
                      owner === "HUSBAND" ? "bg-blue-600 text-white border-blue-600" : "border-[#DCE4EE] dark:border-slate-700 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    👨 {settings.husbandName}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOwner("WIFE")}
                    className={`py-2 text-xs font-bold rounded-md border cursor-pointer ${
                      owner === "WIFE" ? "bg-emerald-600 text-white border-emerald-600" : "border-[#DCE4EE] dark:border-slate-700 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    👩 {settings.wifeName}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOwner("SHARED")}
                    className={`py-2 text-xs font-bold rounded-md border cursor-pointer ${
                      owner === "SHARED" ? "bg-purple-600 text-white border-purple-600" : "border-[#DCE4EE] dark:border-slate-700 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    🏡 Chung
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Tên tài khoản / Ví</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="VD: Vietinbank Lương, BIDV Credit..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 rounded-lg px-3.5 py-2 text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Loại tài khoản {editingAccount && <span className="text-[10px] text-slate-400 font-normal">(Cố định)</span>}
                </label>
                <select
                  disabled={editingAccount !== null}
                  value={type}
                  onChange={(e) => setType(e.target.value as AccountType)}
                  className={`w-full bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 rounded-lg px-3.5 py-2 text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500 font-semibold cursor-pointer ${
                    editingAccount ? "opacity-75 cursor-not-allowed bg-slate-100 dark:bg-slate-800/50" : ""
                  }`}
                >
                  <option value="BANK">Tài khoản ngân hàng</option>
                  <option value="CREDIT_CARD">Thẻ tín dụng (Credit Card)</option>
                  <option value="CASH">Tiền mặt</option>
                  <option value="E_WALLET">Ví điện tử</option>
                </select>
              </div>

              {type === "CREDIT_CARD" ? (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Hạn mức thẻ tín dụng (VND)</label>
                    <input
                      type="text"
                      required
                      value={creditLimit}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^0-9]/g, "");
                        setCreditLimit(raw ? new Intl.NumberFormat("vi-VN").format(parseInt(raw, 10)) : "");
                      }}
                      placeholder="VD: 50.000.000"
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 rounded-lg px-3.5 py-2 text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500 font-bold"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Ngày sao kê</label>
                      <input
                        type="number"
                        min={1}
                        max={28}
                        value={statementDay}
                        onChange={(e) => setStatementDay(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 rounded-lg px-3.5 py-2 text-sm text-slate-800 dark:text-slate-100 font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Ngày đáo hạn</label>
                      <input
                        type="number"
                        min={1}
                        max={28}
                        value={dueDay}
                        onChange={(e) => setDueDay(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 rounded-lg px-3.5 py-2 text-sm text-slate-800 dark:text-slate-100 font-bold"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Số dư ban đầu (VND)</label>
                  <input
                    type="text"
                    value={initialBalance}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9]/g, "");
                      setInitialBalance(raw ? new Intl.NumberFormat("vi-VN").format(parseInt(raw, 10)) : "");
                    }}
                    placeholder="0"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 rounded-lg px-3.5 py-2 text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500 font-bold"
                  />
                </div>
              )}

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddAccountModalOpen(false);
                    setEditingAccount(null);
                  }}
                  className="flex-1 py-2.5 rounded-md text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-md text-xs font-bold bg-blue-600 text-white shadow-xs hover:bg-blue-700 cursor-pointer"
                >
                  {editingAccount ? "Lưu thay đổi" : "Lưu tài khoản"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <CreditCardRepaymentSheet
        cardInfo={repayingCardInfo}
        isOpen={repayingCardInfo !== null}
        onClose={() => setRepayingCardInfo(null)}
      />

      <ConfirmDialog
        isOpen={deleteTargetId !== null}
        title="Xóa tài khoản này?"
        message="Thao tác này sẽ xóa tài khoản khỏi danh sách ví của gia đình bạn."
        confirmLabel="Xóa"
        cancelLabel="Hủy"
        isDanger={true}
        onConfirm={() => {
          if (deleteTargetId) {
            deleteAccount(deleteTargetId);
            setDeleteTargetId(null);
          }
        }}
        onCancel={() => setDeleteTargetId(null)}
      />
    </div>
  );
}
