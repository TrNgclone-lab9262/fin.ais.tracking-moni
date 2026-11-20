"use client";

import React from "react";
import { Coins, Layers, TrendingUp, Target, Scale } from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { GoldRouteTab } from "@/types/finance";
import { useHaptic } from "@/src/hooks/useHaptic";

export function GoldBottomNavBar() {
  const { goldTab, setGoldTab } = useFinance();
  const haptic = useHaptic();

  const items: {
    id: GoldRouteTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: "OVERVIEW", label: "Kho Vàng", icon: Coins },
    { id: "LOTS", label: "Sổ Lô", icon: Layers },
    { id: "PRICES", label: "Bảng Giá", icon: TrendingUp },
    { id: "DCA", label: "DCA", icon: Target },
    { id: "SIMULATOR", label: "Bán 2027", icon: Scale },
  ];

  return (
    <nav
      aria-label="Điều hướng Kho Vàng"
      className="fixed bottom-0 inset-x-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-[#DCE4EE] dark:border-slate-800 pb-safe md:hidden"
    >
      <div className="grid grid-cols-5 h-15 px-1">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = goldTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                haptic.light();
                setGoldTab(item.id);
              }}
              className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition-colors cursor-pointer ${
                isActive
                  ? "text-amber-700 dark:text-amber-400"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? "scale-105" : ""}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
