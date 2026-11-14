"use client";

import React, { useMemo, useState } from "react";
import { Users, Heart, Calendar as CalendarIcon, Scale, CheckCircle2 } from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { formatVNDMasked, getMonthDisplayLabel } from "@/lib/formatters";
import { calculateHeatmapDays } from "@/lib/financeEngine";

export function FamilyCashflowWidget() {
  const {
    summary,
    transactions,
    selectedMonth,
    activePerspective,
    settings,
    isPrivacyMode,
    coupleSettlement,
    accounts,
    addTransaction,
  } = useFinance();

  const [settledToast, setSettledToast] = useState(false);

  const heatmap = useMemo(
    () => calculateHeatmapDays(transactions, selectedMonth, activePerspective),
    [transactions, selectedMonth, activePerspective]
  );

  const totalIncome = summary.husbandIncome + summary.wifeIncome;
  const denom = totalIncome > 0 ? totalIncome : 1;
  const husbandPct = totalIncome > 0 ? Math.round((summary.husbandIncome / denom) * 100) : 50;
  const wifePct = 100 - husbandPct;

  const monthNum = parseInt(heatmap.targetMonth.split("-")[1] || "10", 10);

  const handleSettleCouple = () => {
    if (coupleSettlement.fromMember === "BALANCED" || coupleSettlement.transferAmount <= 0) return;

    const fromAcc =
      accounts.find((a) => a.owner === coupleSettlement.fromMember && a.type !== "CREDIT_CARD") ||
      accounts.find((a) => a.type !== "CREDIT_CARD");
    const toAcc =
      accounts.find((a) => a.owner === coupleSettlement.toMember && a.type !== "CREDIT_CARD") ||
      accounts.find((a) => a.id !== fromAcc?.id && a.type !== "CREDIT_CARD");

    if (!fromAcc || !toAcc) return;

    addTransaction({
      amount: coupleSettlement.transferAmount,
      date: new Date().toISOString().slice(0, 10),
      type: "TRANSFER",
      categoryId: "cat_expense_other",
      accountId: fromAcc.id,
      toAccountId: toAcc.id,
      memberId: coupleSettlement.fromMember,
      scope: "FAMILY",
      note: `Quyết toán chia chi chung ${getMonthDisplayLabel(heatmap.targetMonth)}`,
    });

    setSettledToast(true);
    setTimeout(() => setSettledToast(false), 3000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* 1. CƠ CẤU ĐÓNG GÓP THU NHẬP & QUYẾT TOÁN QUỸ CHUNG */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-[#DCE4EE] dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#E9EEF5] dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-[#172B4D] dark:text-slate-100">
                Đóng Góp Thu Nhập & Bù Trừ Tổ Ấm
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Tỷ trọng {settings.husbandName} vs {settings.wifeName} · Quỹ chung {coupleSettlement.husbandSharePct}/{coupleSettlement.wifeSharePct}%
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/15 px-2.5 py-1 rounded-md border border-indigo-100 dark:border-indigo-500/30">
            Tổng {formatVNDMasked(totalIncome, isPrivacyMode)}
          </span>
        </div>

        {/* Thanh tỷ lệ thu nhập */}
        <div className="space-y-2.5">
          <div className="w-full h-3.5 bg-slate-100 dark:bg-slate-800 rounded-md overflow-hidden flex shadow-inner">
            <div
              className="h-full bg-blue-600 transition-all flex items-center justify-center text-[10px] text-white font-bold"
              style={{ width: `${husbandPct}%` }}
            >
              {husbandPct}%
            </div>
            <div
              className="h-full bg-emerald-600 transition-all flex items-center justify-center text-[10px] text-white font-bold"
              style={{ width: `${wifePct}%` }}
            >
              {wifePct}%
            </div>
          </div>

          <div className="flex justify-between items-center text-xs pt-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
              <div>
                <span className="font-bold text-slate-800 dark:text-slate-100">👨 {settings.husbandName}</span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  Thu: {formatVNDMasked(summary.husbandIncome, isPrivacyMode)} · Chi chung: {formatVNDMasked(coupleSettlement.husbandPaid, isPrivacyMode)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-right">
              <div>
                <span className="font-bold text-slate-800 dark:text-slate-100">👩 {settings.wifeName}</span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  Thu: {formatVNDMasked(summary.wifeIncome, isPrivacyMode)} · Chi chung: {formatVNDMasked(coupleSettlement.wifePaid, isPrivacyMode)}
                </p>
              </div>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
            </div>
          </div>
        </div>

        {/* Khối Quyết Toán Chi Tiêu Chung (Couple Settlement) */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-lg border border-[#E9EEF5] dark:border-slate-700 space-y-2">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-bold text-[#172B4D] dark:text-slate-100 flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              Đối soát chi chung ({formatVNDMasked(coupleSettlement.totalSharedExpense, isPrivacyMode)})
            </span>
            {settledToast && (
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Đã ghi chuyển khoản!
              </span>
            )}
          </div>

          {coupleSettlement.fromMember === "BALANCED" ? (
            <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 font-medium">
              <Heart className="w-4 h-4 text-rose-500 shrink-0" />
              <span>
                Chi tiêu chung giữa 2 vợ chồng đang cân bằng theo tỷ lệ {coupleSettlement.husbandSharePct}/{coupleSettlement.wifeSharePct}%!
              </span>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300">
              <span>
                <strong className="text-slate-800 dark:text-slate-100">
                  {coupleSettlement.fromMember === "WIFE"
                    ? `👩 ${settings.wifeName}`
                    : `👨 ${settings.husbandName}`}
                </strong>{" "}
                chuyển bù{" "}
                <strong className="text-blue-700 dark:text-blue-400">
                  {formatVNDMasked(coupleSettlement.transferAmount, isPrivacyMode)}
                </strong>{" "}
                cho{" "}
                <strong className="text-slate-800 dark:text-slate-100">
                  {coupleSettlement.toMember === "HUSBAND"
                    ? `👨 ${settings.husbandName}`
                    : `👩 ${settings.wifeName}`}
                </strong>
              </span>
              <button
                type="button"
                onClick={handleSettleCouple}
                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-[11px] font-bold shadow-xs transition-colors cursor-pointer"
              >
                Ghi nhận bù trừ
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 2. LỊCH CHI TIÊU GIA ĐÌNH (CALENDAR HEATMAP ĐỘNG THEO THÁNG) */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-[#DCE4EE] dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-3">
        <div className="flex items-center justify-between pb-3 border-b border-[#E9EEF5] dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <CalendarIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-[#172B4D] dark:text-slate-100">
                Lịch Chi Tiêu {getMonthDisplayLabel(heatmap.targetMonth)}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                {heatmap.activeDaysCount} ngày phát sinh chi tiêu · Bản đồ nhiệt theo ngày
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400 dark:text-slate-400">
            <span className="w-2 h-2 rounded-xs bg-slate-100 dark:bg-slate-800" /> 0₫
            <span className="w-2 h-2 rounded-xs bg-emerald-400" /> &lt;500k
            <span className="w-2 h-2 rounded-xs bg-amber-400" /> &lt;2tr
            <span className="w-2 h-2 rounded-xs bg-rose-500" /> &gt;2tr
          </div>
        </div>

        {/* Ô Ngày Trong Tháng */}
        <div className="grid grid-cols-7 gap-1.5 pt-1">
          {heatmap.days.map((d) => {
            let bgClass = "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500";
            if (d.level === "low") bgClass = "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-semibold";
            if (d.level === "medium") bgClass = "bg-amber-100 dark:bg-amber-500/20 text-amber-900 dark:text-amber-300 font-semibold";
            if (d.level === "high") bgClass = "bg-rose-500 text-white font-bold shadow-xs";

            return (
              <div
                key={d.day}
                title={`Ngày ${d.day}/${monthNum}: ${
                  d.amount > 0 ? formatVNDMasked(d.amount, isPrivacyMode) : "Không chi tiêu"
                }`}
                className={`h-8 rounded-md flex flex-col items-center justify-center text-xs transition-transform hover:scale-105 cursor-pointer ${bgClass}`}
              >
                <span>{d.day}</span>
              </div>
            );
          })}
        </div>

        <p className="text-[10px] text-slate-500 dark:text-slate-400 text-center font-medium">
          {heatmap.peakDay && heatmap.peakAmount > 0
            ? `💡 Ngày cao điểm: Ngày ${heatmap.peakDay}/${monthNum} với tổng chi ${formatVNDMasked(heatmap.peakAmount, isPrivacyMode)}.`
            : `💡 Chưa phát sinh khoản chi nào trong ${getMonthDisplayLabel(heatmap.targetMonth)}.`}
        </p>
      </div>
    </div>
  );
}
