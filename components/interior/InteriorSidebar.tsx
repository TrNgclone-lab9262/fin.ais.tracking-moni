"use client";

import React, { useMemo } from "react";
import {
  Box,
  ClipboardList,
  ShieldCheck,
  CheckSquare,
  ArrowUpRight,
  Lock,
  LayoutGrid,
} from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { InteriorRouteTab } from "@/types/finance";
import { calculateScenarioBoq } from "@/lib/interiorBoqEngine";
import { formatShortVNDMasked } from "@/lib/formatters";
import { InteriorAppIconSvg } from "@/components/common/SubAppIcons";

export function InteriorSidebar() {
  const {
    interiorTab,
    setInteriorTab,
    interiorStudio,
    isPrivacyMode,
    switchSubApp,
    openAppLauncher,
    hasPasscodeProtection,
    lockApp,
  } = useFinance();

  const activeScenario = useMemo(
    () =>
      interiorStudio.scenarios.find((s) => s.id === interiorStudio.activeScenarioId) ||
      interiorStudio.scenarios[0],
    [interiorStudio]
  );

  const boq = useMemo(() => calculateScenarioBoq(activeScenario), [activeScenario]);

  const checklistDone = useMemo(
    () => interiorStudio.handoverChecklist.filter((c) => c.checked).length,
    [interiorStudio.handoverChecklist]
  );

  const navItems: {
    id: InteriorRouteTab;
    label: string;
    subtitle: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    {
      id: "STUDIO",
      label: "Không gian 3D & 2D",
      subtitle: `${activeScenario.shortLabel} · Three.js`,
      icon: Box,
    },
    {
      id: "BOQ",
      label: "Dự toán BOQ & Mua sắm",
      subtitle: `${boq.rows.length} hạng mục gỗ & điện máy`,
      icon: ClipboardList,
    },
    {
      id: "READINESS",
      label: "Cầu Nối Nhận Nhà Q3/27",
      subtitle: "Tiền + Vàng vs PBT + Nội thất",
      icon: ShieldCheck,
    },
    {
      id: "CHECKLIST",
      label: "Nghiệm Thu A.12A.07",
      subtitle: `${checklistDone}/${interiorStudio.handoverChecklist.length} hạng mục CĐT`,
      icon: CheckSquare,
    },
  ];

  return (
    <aside className="w-68 shrink-0 bg-[#0F2426] dark:bg-[#081517] text-slate-100 border-r border-teal-950/80 hidden md:flex flex-col justify-between min-h-screen sticky top-0 h-screen">
      <div className="flex flex-col min-h-0 flex-1 overflow-y-auto">
        {/* Brand Header */}
        <div className="h-20 px-5 flex items-center gap-3 border-b border-teal-900/60 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-teal-500/15 border border-teal-400/30 flex items-center justify-center shrink-0">
            <InteriorAppIconSvg className="w-7 h-7" />
          </div>
          <div className="min-w-0">
            <span className="font-black text-base tracking-tight text-white block leading-tight">
              SKYONE STUDIO
            </span>
            <span className="text-[11px] font-semibold text-teal-300/90 block truncate">
              Nội thất 3D · A.12A.07 (51.0 m²)
            </span>
          </div>
        </div>

        {/* Live BOQ Budget Card */}
        <div className="mx-4 mt-4 p-4 rounded-xl bg-[#132E31] border border-teal-500/25 space-y-2">
          <div className="flex items-center justify-between text-[11px] text-teal-200/80 font-semibold">
            <span>Dự toán {activeScenario.code === "B" ? "PA-B Studio" : `PA-${activeScenario.code}`}</span>
            <span
              className={`font-bold ${
                boq.budgetStatus === "OVER_BUDGET" ? "text-rose-300" : "text-emerald-300"
              }`}
            >
              {boq.budgetStatus === "OVER_BUDGET" ? "Vượt 150tr" : "Trong khung"}
            </span>
          </div>
          <p className="text-xl font-black text-white tabular-nums tracking-tight">
            {formatShortVNDMasked(boq.grandTotalWithContingency, isPrivacyMode)}
          </p>
          <div className="flex items-center justify-between text-[11px] pt-1 border-t border-teal-900/80 text-teal-200/75 tabular-nums">
            <span>Gỗ {formatShortVNDMasked(boq.woodFurnitureTotal, isPrivacyMode)}</span>
            <span>Điện máy {formatShortVNDMasked(boq.appliancesTotal, isPrivacyMode)}</span>
          </div>
        </div>

        {/* Nav Items */}
        <nav className="px-3 py-4 space-y-1 flex-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = interiorTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setInteriorTab(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                  isActive
                    ? "bg-teal-500 text-slate-950 font-black"
                    : "text-slate-300 hover:bg-teal-950/70 hover:text-white"
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? "text-slate-950" : "text-teal-400"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-extrabold truncate">{item.label}</p>
                  <p
                    className={`text-[10px] truncate ${
                      isActive ? "text-slate-900/80 font-semibold" : "text-slate-400"
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
          <p className="text-[10px] font-bold uppercase tracking-wider text-teal-300/60 px-1">
            Liên thông nguồn tiền
          </p>
          <button
            type="button"
            onClick={() => switchSubApp("GOLD", { goldTab: "SIMULATOR" })}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-amber-300 bg-[#132E31] hover:bg-teal-900/70 border border-teal-900/80 transition-colors cursor-pointer"
          >
            <span>Kho Vàng · Bán nhận nhà</span>
            <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
          </button>
          <button
            type="button"
            onClick={() => switchSubApp("SKYONE", { skyoneTab: "OVERVIEW" })}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-indigo-300 bg-[#132E31] hover:bg-teal-900/70 border border-teal-900/80 transition-colors cursor-pointer"
          >
            <span>Khoản vay BIDV SKYONE</span>
            <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
          </button>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-3 border-t border-teal-900/60 space-y-1.5 shrink-0">
        <button
          type="button"
          onClick={openAppLauncher}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-slate-200 hover:text-white bg-[#132E31] hover:bg-teal-900/70 border border-teal-900/80 transition-colors cursor-pointer"
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          <span>Về App Launcher</span>
        </button>
        {hasPasscodeProtection && (
          <button
            type="button"
            onClick={lockApp}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-teal-950 transition-colors cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Khóa ứng dụng</span>
          </button>
        )}
      </div>
    </aside>
  );
}
