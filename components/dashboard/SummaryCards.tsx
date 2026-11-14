"use client";

import React from "react";
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  PiggyBank,
  Sparkles,
} from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { formatVNDMasked, getMonthDisplayLabel } from "@/lib/formatters";

export function SummaryCards() {
  const { summary, selectedMonth, activePerspective, settings, isPrivacyMode } = useFinance();
  const periodLabel =
    selectedMonth === "ALL" ? "Toàn thời gian" : getMonthDisplayLabel(selectedMonth);

  const perspectiveLabel =
    activePerspective === "ALL"
      ? "My Home"
      : activePerspective === "HUSBAND"
      ? settings.husbandName
      : settings.wifeName;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. THẺ HERO TÀI SẢN RÒNG (Navy Gradient) */}
      <div className="relative overflow-hidden rounded-xl p-5 bg-gradient-to-br from-[#172B4D] via-[#1E3A8A] to-[#1E40AF] text-white shadow-xs">
        <div className="absolute -right-3 -bottom-3 w-24 h-24 bg-white/10 rounded-full blur-lg pointer-events-none" />
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-200 flex items-center gap-1.5">
            <Wallet className="w-4 h-4 text-blue-300" />
            Tài sản ròng ({perspectiveLabel})
          </span>
          <span className="p-1.5 rounded-lg bg-white/15 text-white backdrop-blur-xs">
            <Sparkles className="w-3.5 h-3.5" />
          </span>
        </div>
        <div className="mt-3">
          <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            {formatVNDMasked(summary.netWorth, isPrivacyMode)}
          </h3>
          <p className="text-[11px] text-blue-200/90 mt-1.5 font-medium">
            Ví: {formatVNDMasked(summary.currentBalance, isPrivacyMode)} · Nợ thẻ: {formatVNDMasked(summary.totalCreditDebt, isPrivacyMode)}
          </p>
        </div>
      </div>

      {/* 2. THẺ THU NHẬP (Flat White Card + Emerald Accent) */}
      <div className="relative rounded-xl p-5 bg-white dark:bg-slate-900 border border-[#DCE4EE] dark:border-slate-800 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <ArrowDownLeft className="w-3.5 h-3.5" />
            </div>
            Thu nhập ({perspectiveLabel})
          </span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-500/30">
            {periodLabel}
          </span>
        </div>
        <div className="mt-3">
          <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#172B4D] dark:text-slate-100">
            {formatVNDMasked(summary.monthlyIncome, isPrivacyMode)}
          </h3>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
              {activePerspective === "ALL"
                ? `Chồng: ${formatVNDMasked(summary.husbandIncome, isPrivacyMode)} · Vợ: ${formatVNDMasked(summary.wifeIncome, isPrivacyMode)}`
                : "Thu nhập ghi nhận theo kỳ"}
            </span>
          </div>
        </div>
      </div>

      {/* 3. THẺ CHI TIÊU (Flat White Card + Rose Accent) */}
      <div className="relative rounded-xl p-5 bg-white dark:bg-slate-900 border border-[#DCE4EE] dark:border-slate-800 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-lg bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <ArrowUpRight className="w-3.5 h-3.5" />
            </div>
            Chi tiêu ({perspectiveLabel})
          </span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-100 dark:border-rose-500/30">
            {periodLabel}
          </span>
        </div>
        <div className="mt-3">
          <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#172B4D] dark:text-slate-100">
            {formatVNDMasked(summary.monthlyExpense, isPrivacyMode)}
          </h3>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
              {activePerspective === "ALL"
                ? `Sinh hoạt chung: ${formatVNDMasked(summary.familySharedExpense, isPrivacyMode)}`
                : `Tổng chi trong ${periodLabel}`}
            </span>
          </div>
        </div>
      </div>

      {/* 4. THẺ TIẾT KIỆM (Flat White Card + Amber Accent) */}
      <div className="relative rounded-xl p-5 bg-white dark:bg-slate-900 border border-[#DCE4EE] dark:border-slate-800 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-lg bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <PiggyBank className="w-3.5 h-3.5" />
            </div>
            Tiết kiệm tích lũy
          </span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-100 dark:border-amber-500/30">
            {summary.savingsRate}% tích lũy
          </span>
        </div>
        <div className="mt-3">
          <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#172B4D] dark:text-slate-100">
            {formatVNDMasked(summary.savingsAmount, isPrivacyMode)}
          </h3>
          <div className="mt-2 w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-amber-500 h-full rounded-full transition-all"
              style={{ width: `${Math.min(Math.max(summary.savingsRate, 0), 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
