"use client";

import React, { useState } from "react";
import { ArrowUpRight, Building2, Coins, Landmark, Layers, Wallet } from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { formatVNDMasked } from "@/lib/formatters";

interface UnifiedNetWorthBannerProps {
  compact?: boolean;
}

export function UnifiedNetWorthBanner({ compact = false }: UnifiedNetWorthBannerProps) {
  const { unifiedNetWorth, isPrivacyMode, switchSubApp } = useFinance();
  const [includeRealEstate, setIncludeRealEstate] = useState<boolean>(true);

  const displayTotal = includeRealEstate
    ? unifiedNetWorth.totalHouseholdNetWorthVnd
    : unifiedNetWorth.liquidNetWorthVnd;

  // Tính tỷ trọng thanh cấu trúc tương ứng với chế độ đang chọn
  const denom = includeRealEstate
    ? Math.max(1, unifiedNetWorth.grossAssetsVnd)
    : Math.max(
        1,
        Math.max(0, unifiedNetWorth.liquidCashVnd) +
          unifiedNetWorth.otherInvestmentsVnd +
          unifiedNetWorth.goldBidValueVnd +
          unifiedNetWorth.receivablesVnd
      );

  const cashPct = Math.round((Math.max(0, unifiedNetWorth.liquidCashVnd) / denom) * 100);
  const invPct = Math.round((unifiedNetWorth.otherInvestmentsVnd / denom) * 100);
  const goldPct = Math.round((unifiedNetWorth.goldBidValueVnd / denom) * 100);
  const realEstatePct = includeRealEstate
    ? Math.max(0, 100 - cashPct - invPct - goldPct)
    : 0;

  return (
    <section
      aria-label="Tổng Gia Sản Hợp Nhất 4 Sub-App"
      className={`rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950 text-white shadow-sm ${
        compact ? "p-4" : "p-5"
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-medium text-emerald-300/90">
            <Layers className="w-3.5 h-3.5" />
            <span>Tổng Gia Sản Hộ Gia Đình Hợp Nhất</span>
          </div>
          <div className="flex items-baseline gap-2.5 flex-wrap">
            <p
              className={`${
                compact ? "text-2xl" : "text-3xl"
              } font-bold tracking-tight tabular-nums text-white`}
            >
              {formatVNDMasked(displayTotal, isPrivacyMode)}
            </p>
            <span className="text-xs text-slate-300/80 tabular-nums">
              {includeRealEstate ? "(Gồm vốn chủ BĐS SKYONE)" : "(Tài sản thanh khoản ngay)"}
            </span>
          </div>
        </div>

        {/* Toggle Chế độ */}
        <div
          role="tablist"
          aria-label="Chế độ xem tổng tài sản"
          className="inline-flex rounded-xl bg-white/10 p-1 self-start shrink-0 border border-white/10"
        >
          <button
            type="button"
            role="tab"
            aria-selected={!includeRealEstate}
            onClick={() => setIncludeRealEstate(false)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              !includeRealEstate
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-200 hover:text-white"
            }`}
          >
            Thanh khoản ngay
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={includeRealEstate}
            onClick={() => setIncludeRealEstate(true)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              includeRealEstate
                ? "bg-emerald-400 text-slate-950 shadow-sm"
                : "text-slate-200 hover:text-white"
            }`}
          >
            Tổng gia sản (+ BĐS)
          </button>
        </div>
      </div>

      {/* Thanh phân bổ tỷ trọng */}
      <div className="mt-4 space-y-2">
        <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden flex">
          {cashPct > 0 && (
            <div
              className="bg-emerald-400 h-full transition-all duration-300"
              style={{ width: `${cashPct}%` }}
              title={`Tiền & Ví: ${cashPct}%`}
            />
          )}
          {invPct > 0 && (
            <div
              className="bg-sky-400 h-full transition-all duration-300"
              style={{ width: `${invPct}%` }}
              title={`Đầu tư khác: ${invPct}%`}
            />
          )}
          {goldPct > 0 && (
            <div
              className="bg-amber-400 h-full transition-all duration-300"
              style={{ width: `${goldPct}%` }}
              title={`Kho Vàng (Bid): ${goldPct}%`}
            />
          )}
          {includeRealEstate && realEstatePct > 0 && (
            <div
              className="bg-indigo-400 h-full transition-all duration-300"
              style={{ width: `${realEstatePct}%` }}
              title={`Vốn chủ BĐS SKYONE: ${realEstatePct}%`}
            />
          )}
        </div>

        {/* 4 Khối tài sản + Nợ ngắn hạn */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 pt-1">
          <button
            type="button"
            onClick={() => switchSubApp("FINANCE", { financeTab: "accounts" })}
            className="group text-left rounded-xl bg-white/[0.06] hover:bg-white/[0.11] border border-white/10 px-3 py-2.5 transition-colors"
          >
            <div className="flex items-center justify-between text-[11px] text-slate-300">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                Tiền & Ví
              </span>
              <Wallet className="w-3.5 h-3.5 text-emerald-300 opacity-75 group-hover:opacity-100" />
            </div>
            <p className="mt-1 text-sm font-semibold tabular-nums text-white">
              {formatVNDMasked(unifiedNetWorth.liquidCashVnd, isPrivacyMode)}
            </p>
            <p className="text-[11px] text-slate-400 tabular-nums">
              Nợ thẻ & ngắn hạn: -{formatVNDMasked(unifiedNetWorth.totalShortTermLiabilitiesVnd, isPrivacyMode)}
            </p>
          </button>

          <button
            type="button"
            onClick={() => switchSubApp("FINANCE", { financeTab: "debts_invest" })}
            className="group text-left rounded-xl bg-white/[0.06] hover:bg-white/[0.11] border border-white/10 px-3 py-2.5 transition-colors"
          >
            <div className="flex items-center justify-between text-[11px] text-slate-300">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-sky-400" />
                Đầu tư khác
              </span>
              <Landmark className="w-3.5 h-3.5 text-sky-300 opacity-75 group-hover:opacity-100" />
            </div>
            <p className="mt-1 text-sm font-semibold tabular-nums text-white">
              {formatVNDMasked(unifiedNetWorth.otherInvestmentsVnd, isPrivacyMode)}
            </p>
            <p className="text-[11px] text-slate-400 tabular-nums">
              Cho vay chờ thu: {formatVNDMasked(unifiedNetWorth.receivablesVnd, isPrivacyMode)}
            </p>
          </button>

          <button
            type="button"
            onClick={() => switchSubApp("GOLD", { goldTab: "OVERVIEW" })}
            className="group text-left rounded-xl bg-white/[0.06] hover:bg-white/[0.11] border border-white/10 px-3 py-2.5 transition-colors"
          >
            <div className="flex items-center justify-between text-[11px] text-slate-300">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                Kho Vàng (Bid)
              </span>
              <Coins className="w-3.5 h-3.5 text-amber-300 opacity-75 group-hover:opacity-100" />
            </div>
            <p className="mt-1 text-sm font-semibold tabular-nums text-white">
              {formatVNDMasked(unifiedNetWorth.goldBidValueVnd, isPrivacyMode)}
            </p>
            <p className="text-[11px] text-amber-200/80 inline-flex items-center gap-0.5 tabular-nums">
              Tỷ trọng {goldPct}% <ArrowUpRight className="w-3 h-3" />
            </p>
          </button>

          <button
            type="button"
            onClick={() => switchSubApp("SKYONE", { skyoneTab: "OVERVIEW" })}
            className="group text-left rounded-xl bg-white/[0.06] hover:bg-white/[0.11] border border-white/10 px-3 py-2.5 transition-colors"
          >
            <div className="flex items-center justify-between text-[11px] text-slate-300">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-400" />
                Vốn chủ SKYONE
              </span>
              <Building2 className="w-3.5 h-3.5 text-indigo-300 opacity-75 group-hover:opacity-100" />
            </div>
            <p className="mt-1 text-sm font-semibold tabular-nums text-white">
              {formatVNDMasked(unifiedNetWorth.skyoneEquityVnd, isPrivacyMode)}
            </p>
            <p className="text-[11px] text-slate-400 tabular-nums">
              Dư nợ BIDV: {formatVNDMasked(unifiedNetWorth.skyoneRemainingDebtVnd, isPrivacyMode)}
            </p>
          </button>
        </div>
      </div>
    </section>
  );
}
