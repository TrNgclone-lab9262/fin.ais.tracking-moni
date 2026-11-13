"use client";

import React, { useState } from "react";
import { CreditCardRepaymentSheet } from "@/components/mobile/sheets/CreditCardRepaymentSheet";
import { CreditCard, ArrowRight, ShieldCheck, AlertTriangle } from "lucide-react";
import { useFinance, CreditCardInfo } from "@/context/FinanceContext";
import { formatVNDMasked } from "@/lib/formatters";

export function DualCreditCardsWidget() {
  const [repayingCard, setRepayingCard] = useState<CreditCardInfo | null>(null);
  const { husbandCreditCard, wifeCreditCard, setActiveTab, settings, isPrivacyMode } = useFinance();

  const getStatusBadge = (statusLevel: CreditCardInfo["statusLevel"], statusLabel: string) => {
    if (statusLevel === "DANGER") {
      return { text: statusLabel, color: "text-rose-300", bar: "bg-rose-500" };
    }
    if (statusLevel === "WARNING") {
      return { text: statusLabel, color: "text-amber-300", bar: "bg-amber-400" };
    }
    if (statusLevel === "WATCH") {
      return { text: statusLabel, color: "text-yellow-300", bar: "bg-yellow-400" };
    }
    return { text: statusLabel, color: "text-emerald-300", bar: "bg-emerald-400" };
  };

  return (
    <div className="bg-white rounded-xl p-5 border border-[#DCE4EE] shadow-xs space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-[#E9EEF5]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <CreditCard className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-[#172B4D]">
              Quản lý 2 Thẻ Tín Dụng BIDV Credit
            </h3>
            <p className="text-[11px] text-slate-500 font-medium">
              Chốt sao kê ngày {husbandCreditCard?.statementDay || 20} · Hạn trả ngày{" "}
              {String(husbandCreditCard?.dueDay || 6).padStart(2, "0")} tháng sau · Ngưỡng an toàn ≤ 30%
            </p>
          </div>
        </div>

        <button
          onClick={() => setActiveTab("accounts")}
          className="text-xs font-semibold px-2.5 py-1.5 rounded-md text-blue-600 hover:text-blue-700 hover:bg-blue-50/70 transition-all flex items-center gap-1 cursor-pointer"
        >
          <span>Chi tiết ví</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1. THẺ BIDV CREDIT (ANH CHUỘT) */}
        {husbandCreditCard && (() => {
          const badge = getStatusBadge(husbandCreditCard.statusLevel, husbandCreditCard.statusLabel);
          return (
            <div className="relative overflow-hidden rounded-xl p-4 bg-gradient-to-br from-[#0F172A] via-[#172B4D] to-[#1E3A8A] text-white shadow-xs">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-bold text-blue-300 uppercase tracking-widest block">
                    BIDV PLATINUM CREDIT
                  </span>
                  <h4 className="text-sm font-extrabold text-white mt-0.5">
                    Thẻ 👨 {settings.husbandName}
                  </h4>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white/15 text-blue-200">
                  Hạn mức {Math.round(husbandCreditCard.creditLimit / 1_000_000)} Triệu
                </span>
              </div>

              <div className="mt-4">
                <div className="flex justify-between items-baseline text-xs mb-1">
                  <span className="text-slate-300">Dư nợ đã dùng:</span>
                  <span className="font-black text-amber-300 text-sm">
                    {formatVNDMasked(husbandCreditCard.usedAmount, isPrivacyMode)}
                  </span>
                </div>

                {/* Thanh đo hạn mức kèm vạch mốc an toàn 30% */}
                <div className="relative w-full h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${badge.bar}`}
                    style={{ width: `${Math.min(husbandCreditCard.usagePercentage, 100)}%` }}
                  />
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-white/70"
                    style={{ left: "30%" }}
                    title="Mốc an toàn 30%"
                  />
                </div>

                <div className="flex justify-between items-center text-[10px] text-slate-300 mt-2 font-medium">
                  <span>Khả dụng: {formatVNDMasked(husbandCreditCard.availableAmount, isPrivacyMode)}</span>
                  <span className={`font-bold flex items-center gap-1 ${badge.color}`}>
                    {husbandCreditCard.statusLevel === "SAFE" ? (
                      <ShieldCheck className="w-3 h-3" />
                    ) : (
                      <AlertTriangle className="w-3 h-3" />
                    )}
                    {husbandCreditCard.usagePercentage}% ({badge.text})
                  </span>
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-[10px] text-slate-300">
                <span>
                  Sao kê ngày {husbandCreditCard.statementDay} · Hạn trả: {husbandCreditCard.dueDateDisplay}
                </span>
                <button
                  type="button"
                  onClick={() => setRepayingCard(husbandCreditCard)}
                  className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] transition-colors cursor-pointer"
                >
                  Trả nợ thẻ
                </button>
              </div>
            </div>
          );
        })()}

        {/* 2. THẺ BIDV CREDIT (BÉ MÈO) */}
        {wifeCreditCard && (() => {
          const badge = getStatusBadge(wifeCreditCard.statusLevel, wifeCreditCard.statusLabel);
          return (
            <div className="relative overflow-hidden rounded-xl p-4 bg-gradient-to-br from-[#451A03] via-[#78350F] to-[#B45309] text-white shadow-xs">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-bold text-amber-200 uppercase tracking-widest block">
                    BIDV GOLD FLEXI
                  </span>
                  <h4 className="text-sm font-extrabold text-white mt-0.5">
                    Thẻ 👩 {settings.wifeName}
                  </h4>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white/15 text-amber-200">
                  Hạn mức {Math.round(wifeCreditCard.creditLimit / 1_000_000)} Triệu
                </span>
              </div>

              <div className="mt-4">
                <div className="flex justify-between items-baseline text-xs mb-1">
                  <span className="text-amber-100">Dư nợ đã dùng:</span>
                  <span className="font-black text-amber-200 text-sm">
                    {formatVNDMasked(wifeCreditCard.usedAmount, isPrivacyMode)}
                  </span>
                </div>

                <div className="relative w-full h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${badge.bar}`}
                    style={{ width: `${Math.min(wifeCreditCard.usagePercentage, 100)}%` }}
                  />
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-white/70"
                    style={{ left: "30%" }}
                    title="Mốc an toàn 30%"
                  />
                </div>

                <div className="flex justify-between items-center text-[10px] text-amber-100 mt-2 font-medium">
                  <span>Khả dụng: {formatVNDMasked(wifeCreditCard.availableAmount, isPrivacyMode)}</span>
                  <span className={`font-bold flex items-center gap-1 ${badge.color}`}>
                    {wifeCreditCard.statusLevel === "SAFE" ? (
                      <ShieldCheck className="w-3 h-3" />
                    ) : (
                      <AlertTriangle className="w-3 h-3" />
                    )}
                    {wifeCreditCard.usagePercentage}% ({badge.text})
                  </span>
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-[10px] text-amber-100">
                <span>
                  Sao kê ngày {wifeCreditCard.statementDay} · Hạn trả: {wifeCreditCard.dueDateDisplay}
                </span>
                <button
                  type="button"
                  onClick={() => setRepayingCard(wifeCreditCard)}
                  className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white font-bold text-[10px] transition-colors cursor-pointer"
                >
                  Trả nợ thẻ
                </button>
              </div>
            </div>
          );
        })()}
      </div>

      <CreditCardRepaymentSheet
        cardInfo={repayingCard}
        isOpen={repayingCard !== null}
        onClose={() => setRepayingCard(null)}
      />
    </div>
  );
}
