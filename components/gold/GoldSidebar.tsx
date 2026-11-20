"use client";

import React, { useMemo } from "react";
import {
  Coins,
  Layers,
  TrendingUp,
  Target,
  Scale,
  ArrowUpRight,
  Lock,
  LayoutGrid,
} from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { GoldRouteTab } from "@/types/finance";
import { computeGoldPortfolioMetrics, formatChiWeight, formatLuongWeight } from "@/lib/goldEngine";
import { formatShortVNDMasked } from "@/lib/formatters";
import { GoldAppIconSvg } from "@/components/common/SubAppIcons";

export function GoldSidebar() {
  const {
    goldTab,
    setGoldTab,
    goldPortfolio,
    isPrivacyMode,
    switchSubApp,
    openAppLauncher,
    hasPasscodeProtection,
    lockApp,
  } = useFinance();

  const metrics = useMemo(
    () => computeGoldPortfolioMetrics(goldPortfolio),
    [goldPortfolio]
  );

  const navItems: {
    id: GoldRouteTab;
    label: string;
    subtitle: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    {
      id: "OVERVIEW",
      label: "Tổng quan Kho Vàng",
      subtitle: "Định giá Bid & Lãi/Lỗ thực",
      icon: Coins,
    },
    {
      id: "LOTS",
      label: "Sổ Lô & Giao dịch",
      subtitle: `${goldPortfolio.lots.filter((l) => l.remainingChi > 0).length} lô nắm giữ · WAC/FIFO`,
      icon: Layers,
    },
    {
      id: "PRICES",
      label: "Bảng Giá & Chênh lệch",
      subtitle: "Nhẫn 9999 · SJC · XAU/USD",
      icon: TrendingUp,
    },
    {
      id: "DCA",
      label: "Kế hoạch DCA",
      subtitle: "Tích lũy cho mốc Q3/2027",
      icon: Target,
    },
    {
      id: "SIMULATOR",
      label: "Mô phỏng Thanh khoản",
      subtitle: "Tính bán vàng nhận nhà",
      icon: Scale,
    },
  ];

  return (
    <aside className="w-68 shrink-0 bg-[#1C1917] dark:bg-[#0C0A09] text-stone-100 border-r border-stone-800/80 hidden md:flex flex-col justify-between min-h-screen sticky top-0 h-screen">
      <div className="flex flex-col min-h-0 flex-1 overflow-y-auto">
        {/* Brand Header */}
        <div className="h-20 px-5 flex items-center gap-3 border-b border-stone-800/80 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
            <GoldAppIconSvg className="w-7 h-7" />
          </div>
          <div className="min-w-0">
            <span className="font-black text-base tracking-tight text-white block leading-tight">
              GOLD VAULT
            </span>
            <span className="text-[11px] font-semibold text-amber-300/90 block truncate">
              Kho Tích Sản · Nhẫn 9999
            </span>
          </div>
        </div>

        {/* Live Bullion Balance Card */}
        <div className="mx-4 mt-4 p-4 rounded-xl bg-stone-900/90 border border-amber-500/25 space-y-2">
          <div className="flex items-center justify-between text-[11px] text-stone-400 font-semibold">
            <span>Thanh khoản thực (Bid)</span>
            <span className="text-amber-400 font-bold tabular-nums">
              {formatChiWeight(metrics.totalRemainingChi, isPrivacyMode)}
            </span>
          </div>
          <p className="text-xl font-black text-white tabular-nums tracking-tight">
            {formatShortVNDMasked(metrics.totalLiquidationValueBid, isPrivacyMode)}
          </p>
          <div className="flex items-center justify-between text-[11px] pt-1 border-t border-stone-800">
            <span className="text-stone-400 tabular-nums">
              {formatLuongWeight(metrics.totalRemainingChi, isPrivacyMode)}
            </span>
            <span
              className={`font-bold tabular-nums ${
                metrics.unrealizedPnl >= 0 ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {metrics.unrealizedPnl >= 0 ? "+" : ""}
              {metrics.unrealizedPnlPct.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Nav Items */}
        <nav className="px-3 py-4 space-y-1 flex-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = goldTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setGoldTab(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                  isActive
                    ? "bg-amber-500 text-stone-950 font-black"
                    : "text-stone-300 hover:bg-stone-800/80 hover:text-white"
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? "text-stone-950" : "text-amber-400/90"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-extrabold truncate">{item.label}</p>
                  <p
                    className={`text-[10px] truncate ${
                      isActive ? "text-stone-900/80 font-semibold" : "text-stone-400"
                    }`}
                  >
                    {item.subtitle}
                  </p>
                </div>
              </button>
            );
          })}
        </nav>

        {/* Cross-App Quick Bridges */}
        <div className="px-4 pb-4 space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500 px-1">
            Liên thông hệ sinh thái
          </p>
          <button
            type="button"
            onClick={() => switchSubApp("INTERIOR", { interiorTab: "READINESS" })}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-teal-300 bg-stone-900 hover:bg-stone-800 border border-stone-800 transition-colors cursor-pointer"
          >
            <span>Dự toán Nội thất Q3/2027</span>
            <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
          </button>
          <button
            type="button"
            onClick={() => switchSubApp("SKYONE", { skyoneTab: "ADVISOR" })}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-indigo-300 bg-stone-900 hover:bg-stone-800 border border-stone-800 transition-colors cursor-pointer"
          >
            <span>Cố vấn Vay SKYONE 08/2028</span>
            <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
          </button>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-3 border-t border-stone-800/80 space-y-1.5 shrink-0">
        <button
          type="button"
          onClick={openAppLauncher}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-stone-300 hover:text-white bg-stone-900 hover:bg-stone-800 border border-stone-800 transition-colors cursor-pointer"
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          <span>Về App Launcher</span>
        </button>
        {hasPasscodeProtection && (
          <button
            type="button"
            onClick={lockApp}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-stone-400 hover:text-white hover:bg-stone-800 transition-colors cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Khóa ứng dụng</span>
          </button>
        )}
      </div>
    </aside>
  );
}
