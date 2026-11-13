"use client";

import React, { useState, useMemo } from "react";
import { CreditCard, Plus, Pencil, Trash2, X, Eye } from "lucide-react";
import { useFinance, CreditCardInfo } from "@/context/FinanceContext";
import { Account, AccountType, FamilyMember } from "@/types/finance";
import { formatVNDMasked, formatDateVN } from "@/lib/formatters";
import { CreditCardRepaymentSheet } from "@/components/mobile/sheets/CreditCardRepaymentSheet";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";

interface MobileAccountsViewProps {
  onOpenAddAccount?: () => void;
}

export function MobileAccountsView({ onOpenAddAccount: _onOpenAddAccount }: MobileAccountsViewProps) {
  const {
    accounts,
    transactions,
    husbandCreditCard,
    wifeCreditCard,
    activePerspective,
    isPrivacyMode,
    settings,
    addAccount,
    updateAccount,
    deleteAccount,
    getCategoryById,
  } = useFinance();

  const [repayingCard, setRepayingCard] = useState<CreditCardInfo | null>(null);
  const [detailAccount, setDetailAccount] = useState<Account | null>(null);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [owner, setOwner] = useState<FamilyMember>("HUSBAND");
  const [type, setType] = useState<AccountType>("BANK");
  const [initialBalance, setInitialBalance] = useState("");
  const [creditLimit, setCreditLimit] = useState("");
  const [statementDay, setStatementDay] = useState("20");
  const [dueDay, setDueDay] = useState("6");

  const filteredAccounts = useMemo(() => {
    if (activePerspective === "HUSBAND") {
      return accounts.filter((a) => a.owner === "HUSBAND");
    }
    if (activePerspective === "WIFE") {
      return accounts.filter((a) => a.owner === "WIFE");
    }
    return accounts;
  }, [accounts, activePerspective]);

  const totalAvailable = useMemo(() => {
    return filteredAccounts
      .filter((a) => a.type !== "CREDIT_CARD")
      .reduce((sum, a) => sum + Math.max(0, a.currentBalance), 0);
  }, [filteredAccounts]);

  const totalCreditDebt = useMemo(() => {
    return filteredAccounts
      .filter((a) => a.type === "CREDIT_CARD")
      .reduce((sum, a) => sum + Math.max(0, a.currentBalance), 0);
  }, [filteredAccounts]);

  const bankAndCashAccounts = filteredAccounts.filter((a) => a.type !== "CREDIT_CARD");

  const openAdd = () => {
    setEditingAccount(null);
    setName("");
    setOwner(activePerspective === "WIFE" ? "WIFE" : "HUSBAND");
    setType("BANK");
    setInitialBalance("0");
    setCreditLimit("50.000.000");
    setStatementDay("20");
    setDueDay("6");
    setIsAccountModalOpen(true);
  };

  const openEdit = (acc: Account) => {
    setEditingAccount(acc);
    setName(acc.name);
    setOwner(acc.owner);
    setType(acc.type);
    setInitialBalance(new Intl.NumberFormat("vi-VN").format(acc.initialBalance));
    setCreditLimit(acc.creditLimit ? new Intl.NumberFormat("vi-VN").format(acc.creditLimit) : "");
    setStatementDay(String(acc.statementDay || 20));
    setDueDay(String(acc.dueDay || 6));
    setIsAccountModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
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
      });
    }
    setIsAccountModalOpen(false);
  };

  const accountTxList = useMemo(() => {
    if (!detailAccount) return [];
    return transactions
      .filter((tx) => tx.accountId === detailAccount.id || tx.toAccountId === detailAccount.id)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [detailAccount, transactions]);

  const getBarColor = (level: CreditCardInfo["statusLevel"]) => {
    if (level === "DANGER") return "bg-rose-400";
    if (level === "WARNING") return "bg-orange-400";
    if (level === "WATCH") return "bg-amber-400";
    return "bg-emerald-400";
  };

  return (
    <div className="space-y-3.5 animate-in fade-in duration-200">
      {/* 1. HEADER 2 CHỈ SỐ TÀI CHÍNH TỔNG */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="p-3.5 rounded-xl bg-white border border-[#DCE4EE] shadow-xs space-y-1">
          <span className="text-[10px] text-blue-600 font-bold uppercase tracking-wider block">
            Tổng khả dụng (Ví & Bank)
          </span>
          <span className="text-base sm:text-lg font-black text-blue-600 block">
            {formatVNDMasked(totalAvailable, isPrivacyMode)}
          </span>
          <span className="text-[10px] text-slate-400 font-medium block">
            Sẵn sàng chi tiêu sinh hoạt
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-[#DCE4EE] shadow-xs space-y-1">
          <span className="text-[10px] text-amber-600 font-bold uppercase tracking-wider block">
            Dư nợ thẻ tín dụng
          </span>
          <span className="text-base sm:text-lg font-black text-amber-600 block">
            {formatVNDMasked(totalCreditDebt, isPrivacyMode)}
          </span>
          <span className="text-[10px] text-slate-400 font-medium block">
            Sao kê {husbandCreditCard?.statementDay || 20} · Hạn {husbandCreditCard?.dueDateDisplay || "06"}
          </span>
        </div>
      </div>

      {/* 2. KHỐI QUẢN TRỊ 2 THẺ TÍN DỤNG BIDV CREDIT */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-slate-700 px-0.5">
          <span className="flex items-center gap-1.5">
            <CreditCard className="w-3.5 h-3.5 text-blue-600" />
            <span>Thẻ Tín Dụng BIDV Gia Đình</span>
          </span>
          <span className="text-[10px] text-slate-400 font-medium">Mốc an toàn ≤ 30%</span>
        </div>

        <div className="space-y-2.5">
          {husbandCreditCard && (activePerspective === "ALL" || activePerspective === "HUSBAND") && (
            <div className="rounded-xl p-4 bg-gradient-to-br from-[#0F172A] via-[#172B4D] to-[#1E3A8A] text-white shadow-xs space-y-3">
              <div className="flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] text-blue-300 font-bold uppercase tracking-widest block">
                    BIDV PLATINUM CASHBACK
                  </span>
                  <span className="font-extrabold text-white text-sm">
                    {husbandCreditCard.account.name} ({Math.round(husbandCreditCard.creditLimit / 1_000_000)}M)
                  </span>
                </div>
                <span className="font-mono text-slate-300 text-xs">
                  {husbandCreditCard.account.accountNumber || "•••• 8868"}
                </span>
              </div>

              <div>
                <div className="flex items-baseline justify-between text-xs mb-1">
                  <span className="text-slate-300 text-[11px]">Dư nợ đã dùng:</span>
                  <span className="font-black text-base text-amber-300">
                    {formatVNDMasked(husbandCreditCard.usedAmount, isPrivacyMode)}
                  </span>
                </div>
                <div className="relative w-full h-2 rounded-full bg-white/20 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${getBarColor(husbandCreditCard.statusLevel)}`}
                    style={{ width: `${Math.min(husbandCreditCard.usagePercentage, 100)}%` }}
                  />
                  <div className="absolute top-0 bottom-0 w-0.5 bg-white/80" style={{ left: "30%" }} />
                </div>
                <div className="flex justify-between text-[10px] text-slate-300 mt-1.5">
                  <span>Khả dụng: {formatVNDMasked(husbandCreditCard.availableAmount, isPrivacyMode)}</span>
                  <span className="font-bold text-amber-300">
                    {husbandCreditCard.usagePercentage}% ({husbandCreditCard.statusLabel})
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-white/15 flex items-center justify-between gap-2">
                <span className="text-[10px] text-slate-300">
                  Sao kê: ngày {husbandCreditCard.statementDay} · Hạn trả:{" "}
                  <strong>{husbandCreditCard.dueDateDisplay}</strong>
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setDetailAccount(husbandCreditCard.account)}
                    aria-label="Xem sao kê thẻ"
                    className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setRepayingCard(husbandCreditCard)}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                  >
                    Thanh toán
                  </button>
                </div>
              </div>
            </div>
          )}

          {wifeCreditCard && (activePerspective === "ALL" || activePerspective === "WIFE") && (
            <div className="rounded-xl p-4 bg-gradient-to-br from-[#451A03] via-[#78350F] to-[#B45309] text-white shadow-xs space-y-3">
              <div className="flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] text-amber-200 font-bold uppercase tracking-widest block">
                    BIDV GOLD FLEXI
                  </span>
                  <span className="font-extrabold text-white text-sm">
                    {wifeCreditCard.account.name} ({Math.round(wifeCreditCard.creditLimit / 1_000_000)}M)
                  </span>
                </div>
                <span className="font-mono text-amber-200 text-xs">
                  {wifeCreditCard.account.accountNumber || "•••• 2020"}
                </span>
              </div>

              <div>
                <div className="flex items-baseline justify-between text-xs mb-1">
                  <span className="text-amber-100 text-[11px]">Dư nợ đã dùng:</span>
                  <span className="font-black text-base text-amber-200">
                    {formatVNDMasked(wifeCreditCard.usedAmount, isPrivacyMode)}
                  </span>
                </div>
                <div className="relative w-full h-2 rounded-full bg-white/20 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${getBarColor(wifeCreditCard.statusLevel)}`}
                    style={{ width: `${Math.min(wifeCreditCard.usagePercentage, 100)}%` }}
                  />
                  <div className="absolute top-0 bottom-0 w-0.5 bg-white/80" style={{ left: "30%" }} />
                </div>
                <div className="flex justify-between text-[10px] text-amber-100 mt-1.5">
                  <span>Khả dụng: {formatVNDMasked(wifeCreditCard.availableAmount, isPrivacyMode)}</span>
                  <span className="font-bold text-amber-200">
                    {wifeCreditCard.usagePercentage}% ({wifeCreditCard.statusLabel})
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-white/15 flex items-center justify-between gap-2">
                <span className="text-[10px] text-amber-100">
                  Sao kê: ngày {wifeCreditCard.statementDay} · Hạn trả:{" "}
                  <strong>{wifeCreditCard.dueDateDisplay}</strong>
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setDetailAccount(wifeCreditCard.account)}
                    aria-label="Xem sao kê thẻ vợ"
                    className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setRepayingCard(wifeCreditCard)}
                    className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                  >
                    Thanh toán
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. DANH SÁCH VÍ & TÀI KHOẢN THANH TOÁN */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-slate-700 px-0.5">
          <span>Tài Khoản & Tiền Mặt ({bankAndCashAccounts.length})</span>
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 text-white text-[11px] font-bold shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm ví/thẻ</span>
          </button>
        </div>

        <div className="bg-white rounded-xl border border-[#DCE4EE] shadow-xs divide-y divide-slate-100 overflow-hidden">
          {bankAndCashAccounts.map((acc) => {
            const isHusband = acc.owner === "HUSBAND";
            const isCash = acc.type === "CASH";

            return (
              <div
                key={acc.id}
                className="p-3.5 flex items-center justify-between gap-2 hover:bg-slate-50 transition-colors"
              >
                <div
                  onClick={() => setDetailAccount(acc)}
                  className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                >
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${
                      isCash
                        ? "bg-amber-50 text-amber-600"
                        : isHusband
                        ? "bg-blue-50 text-blue-600"
                        : "bg-emerald-50 text-emerald-600"
                    }`}
                  >
                    {isCash ? "💵" : "🏦"}
                  </div>

                  <div className="min-w-0">
                    <span className="font-bold text-xs sm:text-sm text-slate-800 block truncate">
                      {acc.name}
                    </span>
                    <span className="text-[10px] text-slate-400 block font-medium">
                      {isHusband
                        ? `👨 ${settings.husbandName}`
                        : acc.owner === "WIFE"
                        ? `👩 ${settings.wifeName}`
                        : "🏠 Tổ Ấm"}
                      {acc.accountNumber ? ` · ${acc.accountNumber}` : ""}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <span className="font-black text-xs sm:text-sm text-blue-600 block">
                      {formatVNDMasked(acc.currentBalance, isPrivacyMode)}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium block">Khả dụng</span>
                  </div>
                  <button
                    onClick={() => openEdit(acc)}
                    aria-label={`Sửa tài khoản ${acc.name}`}
                    className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:text-blue-600 cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteTargetId(acc.id)}
                    aria-label={`Xóa tài khoản ${acc.name}`}
                    className="p-1.5 rounded-lg bg-slate-100 text-slate-400 hover:text-rose-600 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sheet Chi tiết sổ giao dịch của ví */}
      {detailAccount && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-xs"
          onClick={() => setDetailAccount(null)}
        >
          <div
            className="w-full max-w-lg mx-auto bg-white rounded-t-3xl p-5 max-h-[80vh] flex flex-col space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-800">{detailAccount.name}</h3>
                <p className="text-xs font-bold text-blue-600">
                  {detailAccount.type === "CREDIT_CARD" ? "Dư nợ hiện tại: " : "Số dư hiện tại: "}
                  {formatVNDMasked(detailAccount.currentBalance, isPrivacyMode)}
                </p>
              </div>
              <button
                onClick={() => setDetailAccount(null)}
                className="p-1.5 rounded-full bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {accountTxList.length === 0 ? (
                <p className="py-10 text-center text-xs text-slate-400">Chưa có giao dịch phát sinh</p>
              ) : (
                accountTxList.map((tx) => {
                  const cat = getCategoryById(tx.categoryId);
                  return (
                    <div key={tx.id} className="py-2.5 flex items-center justify-between text-xs gap-2">
                      <div className="min-w-0">
                        <span className="font-bold text-slate-800 block truncate">
                          {tx.note || cat?.name || "Giao dịch"}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {formatDateVN(tx.date)} · {cat?.name || tx.type}
                        </span>
                      </div>
                      <span
                        className={`font-black shrink-0 ${
                          tx.type === "EXPENSE"
                            ? "text-rose-600"
                            : tx.type === "INCOME"
                            ? "text-emerald-600"
                            : "text-blue-600"
                        }`}
                      >
                        {formatVNDMasked(tx.amount, isPrivacyMode)}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Thêm / Sửa Tài khoản */}
      {isAccountModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={() => setIsAccountModalOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-2xl p-5 border border-[#DCE4EE] shadow-2xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800">
                {editingAccount ? "Sửa ví / thẻ" : "Thêm ví / thẻ mới"}
              </h3>
              <button onClick={() => setIsAccountModalOpen(false)} className="text-slate-400 p-1 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Chủ sở hữu</label>
                <div className="grid grid-cols-3 gap-1.5 text-xs font-bold">
                  {(["HUSBAND", "WIFE", "SHARED"] as FamilyMember[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setOwner(m)}
                      className={`py-1.5 rounded-lg border cursor-pointer ${
                        owner === m ? "bg-blue-600 text-white border-blue-600" : "border-slate-200 text-slate-600"
                      }`}
                    >
                      {m === "HUSBAND" ? "👨 Chồng" : m === "WIFE" ? "👩 Vợ" : "🏡 Chung"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Tên tài khoản</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Loại</label>
                <select
                  disabled={editingAccount !== null}
                  value={type}
                  onChange={(e) => setType(e.target.value as AccountType)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold"
                >
                  <option value="BANK">Ngân hàng</option>
                  <option value="CREDIT_CARD">Thẻ tín dụng</option>
                  <option value="CASH">Tiền mặt</option>
                  <option value="E_WALLET">Ví điện tử</option>
                </select>
              </div>

              {type === "CREDIT_CARD" ? (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Hạn mức thẻ (VND)</label>
                    <input
                      type="text"
                      required
                      value={creditLimit}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^0-9]/g, "");
                        setCreditLimit(raw ? new Intl.NumberFormat("vi-VN").format(parseInt(raw, 10)) : "");
                      }}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Ngày sao kê</label>
                      <input
                        type="number"
                        min={1}
                        max={28}
                        value={statementDay}
                        onChange={(e) => setStatementDay(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Ngày đáo hạn</label>
                      <input
                        type="number"
                        min={1}
                        max={28}
                        value={dueDay}
                        onChange={(e) => setDueDay(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Số dư đầu kỳ (VND)</label>
                  <input
                    type="text"
                    value={initialBalance}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9]/g, "");
                      setInitialBalance(raw ? new Intl.NumberFormat("vi-VN").format(parseInt(raw, 10)) : "");
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold"
                  />
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAccountModalOpen(false)}
                  className="flex-1 py-2 rounded-lg bg-slate-100 text-xs font-bold text-slate-600 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-lg bg-blue-600 text-xs font-bold text-white cursor-pointer"
                >
                  Lưu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Action Sheet trả nợ thẻ BIDV */}
      <CreditCardRepaymentSheet
        cardInfo={repayingCard}
        isOpen={repayingCard !== null}
        onClose={() => setRepayingCard(null)}
      />

      <ConfirmDialog
        isOpen={deleteTargetId !== null}
        title="Xóa tài khoản này?"
        message="Tài khoản sẽ bị xóa khỏi danh sách ví của gia đình."
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
