"use client";

import React, { useState } from "react";
import { CreditCard } from "lucide-react";
import { useFinance, CreditCardInfo } from "@/context/FinanceContext";
import { formatVNDMasked, formatDateVN, getMonthDisplayLabel } from "@/lib/formatters";
import { Transaction } from "@/types/finance";
import { TransactionDetailSheet } from "@/components/mobile/sheets/TransactionDetailSheet";
import { CreditCardRepaymentSheet } from "@/components/mobile/sheets/CreditCardRepaymentSheet";
import { TransactionFormModal } from "@/components/transactions/TransactionFormModal";

export function MobileOverviewView() {
  const {
    summary,
    husbandCreditCard,
    wifeCreditCard,
    filteredTransactions,
    budgetSummary,
    todaySpentInfo,
    selectedMonth,
    isPrivacyMode,
    settings,
    setActiveTab,
    deleteTransaction,
  } = useFinance();

  const totalNetWorth = summary.netWorth;
  const monthlyIncome = summary.monthlyIncome;
  const monthlyExpense = summary.monthlyExpense;

  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [repayingCard, setRepayingCard] = useState<CreditCardInfo | null>(null);

  const savingsRate =
    monthlyIncome > 0
      ? Math.max(0, Math.round(((monthlyIncome - monthlyExpense) / monthlyIncome) * 100))
      : 0;

  const recentTransactions = filteredTransactions.slice(0, 4);

  const dailyAllowance = budgetSummary?.dailyAllowance || 0;
  const todaySpent = todaySpentInfo.amount;
  const todayRemaining = Math.max(0, dailyAllowance - todaySpent);
  const dailyPct = dailyAllowance > 0 ? Math.min(100, Math.round((todaySpent / dailyAllowance) * 100)) : 0;
  const isDailyOver = dailyAllowance > 0 && todaySpent > dailyAllowance;

  const getBarColor = (level: CreditCardInfo["statusLevel"]) => {
    if (level === "DANGER") return "bg-rose-400";
    if (level === "WARNING") return "bg-orange-400";
    if (level === "WATCH") return "bg-amber-400";
    return "bg-emerald-400";
  };

  return (
    <div className="space-y-3.5 animate-in fade-in duration-200">
      {/* 1. HERO NET WORTH NAVY CARD */}
      <div className="rounded-xl p-4 bg-gradient-to-br from-[#0F172A] via-[#1E3A8A] to-[#1D4ED8] text-white shadow-md relative overflow-hidden space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-blue-200 uppercase tracking-widest font-bold text-[10px]">
            TỔNG TÀI SẢN RÒNG GIA ĐÌNH
          </span>
          <span className="px-2 py-0.5 rounded-full bg-white/15 text-blue-100 font-semibold text-[10px]">
            {selectedMonth === "ALL" ? "Toàn thời gian" : getMonthDisplayLabel(selectedMonth)}
          </span>
        </div>

        <div>
          <div className="text-3xl font-black tracking-tight text-white">
            {formatVNDMasked(totalNetWorth, isPrivacyMode)}
          </div>
        </div>

        {/* Inline Sub-metrics Strip */}
        <div className="grid grid-cols-3 gap-2 pt-2.5 border-t border-white/15 text-xs">
          <div>
            <span className="text-[10px] text-blue-200/80 block">Thu nhập</span>
            <span className="font-extrabold text-emerald-400 text-xs sm:text-sm">
              +{formatVNDMasked(monthlyIncome, isPrivacyMode)}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-blue-200/80 block">Chi tiêu</span>
            <span className="font-extrabold text-rose-300 text-xs sm:text-sm">
              -{formatVNDMasked(monthlyExpense, isPrivacyMode)}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-blue-200/80 block">Tích lũy</span>
            <span className="font-extrabold text-blue-200 text-xs sm:text-sm">
              {savingsRate}%
            </span>
          </div>
        </div>
      </div>

      {/* 2. DUAL BIDV CREDIT CARDS MINI WIDGET */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-slate-700 px-0.5">
          <span className="flex items-center gap-1.5">
            <CreditCard className="w-3.5 h-3.5 text-blue-600" />
            <span>
              Thẻ Tín Dụng BIDV (Sao kê ngày {husbandCreditCard?.statementDay || 20})
            </span>
          </span>
          <button
            onClick={() => setActiveTab("accounts")}
            className="text-[11px] text-blue-600 font-semibold hover:underline cursor-pointer"
          >
            Quản trị ➔
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {/* Thẻ Anh Chuột */}
          {husbandCreditCard && (
            <div className="p-3 rounded-xl bg-gradient-to-br from-[#0F172A] to-[#1E3A8A] text-white shadow-xs flex flex-col justify-between space-y-2">
              <div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-bold text-blue-300 truncate">👨 {settings.husbandName}</span>
                  <span className="text-[9px] text-slate-300 shrink-0">
                    {Math.round(husbandCreditCard.creditLimit / 1_000_000)}M
                  </span>
                </div>
                <div className="mt-1">
                  <span className="text-[10px] text-slate-300 block">Dư nợ kỳ này:</span>
                  <span className="font-black text-sm text-white">
                    {formatVNDMasked(husbandCreditCard.usedAmount, isPrivacyMode)}
                  </span>
                </div>
              </div>

              <div>
                <div className="relative w-full h-1.5 rounded-full bg-white/20 overflow-hidden mb-1">
                  <div
                    className={`h-full rounded-full ${getBarColor(husbandCreditCard.statusLevel)}`}
                    style={{ width: `${Math.min(husbandCreditCard.usagePercentage, 100)}%` }}
                  />
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-white/80"
                    style={{ left: "30%" }}
                    title="Mốc an toàn 30%"
                  />
                </div>
                <div className="flex items-center justify-between text-[9px] text-blue-200 mb-1.5">
                  <span>{husbandCreditCard.usagePercentage}%</span>
                  <span>{husbandCreditCard.statusLabel}</span>
                </div>
                <button
                  onClick={() => setRepayingCard(husbandCreditCard)}
                  className="w-full py-1 rounded-md bg-blue-600 hover:bg-blue-500 text-[10px] font-bold text-white transition-colors cursor-pointer"
                >
                  Thanh toán
                </button>
              </div>
            </div>
          )}

          {/* Thẻ Bé Mèo */}
          {wifeCreditCard && (
            <div className="p-3 rounded-xl bg-gradient-to-br from-[#451A03] to-[#78350F] text-white shadow-xs flex flex-col justify-between space-y-2">
              <div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-bold text-amber-300 truncate">👩 {settings.wifeName}</span>
                  <span className="text-[9px] text-amber-200 shrink-0">
                    {Math.round(wifeCreditCard.creditLimit / 1_000_000)}M
                  </span>
                </div>
                <div className="mt-1">
                  <span className="text-[10px] text-amber-200/80 block">Dư nợ kỳ này:</span>
                  <span className="font-black text-sm text-white">
                    {formatVNDMasked(wifeCreditCard.usedAmount, isPrivacyMode)}
                  </span>
                </div>
              </div>

              <div>
                <div className="relative w-full h-1.5 rounded-full bg-white/20 overflow-hidden mb-1">
                  <div
                    className={`h-full rounded-full ${getBarColor(wifeCreditCard.statusLevel)}`}
                    style={{ width: `${Math.min(wifeCreditCard.usagePercentage, 100)}%` }}
                  />
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-white/80"
                    style={{ left: "30%" }}
                    title="Mốc an toàn 30%"
                  />
                </div>
                <div className="flex items-center justify-between text-[9px] text-amber-200 mb-1.5">
                  <span>{wifeCreditCard.usagePercentage}%</span>
                  <span>{wifeCreditCard.statusLabel}</span>
                </div>
                <button
                  onClick={() => setRepayingCard(wifeCreditCard)}
                  className="w-full py-1 rounded-md bg-amber-600 hover:bg-amber-500 text-[10px] font-bold text-white transition-colors cursor-pointer"
                >
                  Thanh toán
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. DAILY ALLOWANCE MINI CARD */}
      <div className="p-3.5 rounded-xl bg-white border border-[#DCE4EE] shadow-xs flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-base shrink-0 ${
              isDailyOver ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"
            }`}
          >
            🛡️
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Hạn Mức Ngày ({budgetSummary.daysRemaining} ngày còn lại)
            </span>
            <span className="text-xs sm:text-sm font-black text-slate-800 block truncate">
              Còn {formatVNDMasked(todayRemaining, isPrivacyMode)} /{" "}
              {formatVNDMasked(dailyAllowance, isPrivacyMode)}
            </span>
          </div>
        </div>

        <span
          className={`px-2.5 py-1 rounded-full font-bold text-[11px] shrink-0 ${
            isDailyOver
              ? "bg-rose-100 text-rose-700"
              : dailyPct >= 75
              ? "bg-amber-100 text-amber-800"
              : "bg-emerald-100 text-emerald-800"
          }`}
        >
          {isDailyOver ? "Vượt ngày" : `Đã dùng ${dailyPct}%`}
        </span>
      </div>

      {/* 4. RECENT TRANSACTIONS */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-slate-700 px-0.5">
          <span>Giao Dịch Gần Nhất</span>
          <button
            onClick={() => setActiveTab("transactions")}
            className="text-[11px] text-blue-600 font-semibold hover:underline cursor-pointer"
          >
            Xem tất cả ➔
          </button>
        </div>

        <div className="bg-white rounded-xl border border-[#DCE4EE] shadow-xs divide-y divide-slate-100 overflow-hidden">
          {recentTransactions.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400 font-semibold">
              Chưa có giao dịch nào trong kỳ này
            </div>
          ) : (
            recentTransactions.map((tx) => {
              const isExpense = tx.type === "EXPENSE";
              const isTransfer = tx.type === "TRANSFER";

              return (
                <div
                  key={tx.id}
                  onClick={() => setSelectedTx(tx)}
                  className="p-3 flex items-center justify-between hover:bg-slate-50 active:bg-blue-50/50 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm shrink-0 ${
                        isExpense
                          ? "bg-rose-50 text-rose-600"
                          : isTransfer
                          ? "bg-blue-50 text-blue-600"
                          : "bg-emerald-50 text-emerald-600"
                      }`}
                    >
                      {isExpense ? "🛒" : isTransfer ? "⇄" : "💰"}
                    </div>

                    <div className="min-w-0">
                      <span className="text-xs font-bold text-slate-800 block truncate">
                        {tx.note || (isExpense ? "Chi tiêu" : isTransfer ? "Chuyển tiền" : "Thu nhập")}
                      </span>
                      <span className="text-[10px] text-slate-400 block font-medium">
                        {tx.memberId === "HUSBAND"
                          ? `👨 ${settings.husbandName}`
                          : `👩 ${settings.wifeName}`}{" "}
                        · {formatDateVN(tx.date)}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span
                      className={`text-xs sm:text-sm font-black block ${
                        isExpense
                          ? "text-[#BE123C]"
                          : isTransfer
                          ? "text-blue-600"
                          : "text-[#047857]"
                      }`}
                    >
                      {isExpense ? "-" : isTransfer ? "" : "+"}
                      {formatVNDMasked(tx.amount, isPrivacyMode)}
                    </span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                        tx.scope === "FAMILY"
                          ? "bg-slate-100 text-slate-600"
                          : "bg-purple-50 text-purple-700"
                      }`}
                    >
                      {tx.scope === "FAMILY" ? "🏠 Chung" : "👤 Riêng"}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Action Sheets liên kết */}
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

      <CreditCardRepaymentSheet
        cardInfo={repayingCard}
        isOpen={repayingCard !== null}
        onClose={() => setRepayingCard(null)}
      />
    </div>
  );
}
