"use client";

import React from "react";
import {
  TrendingDown,
  Compass,
  Calendar,
  Calculator,
  SlidersHorizontal,
} from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { SkyOneSubTab } from "@/types/finance";

export function SkyOneBottomNavBar() {
  const { skyoneTab, setSkyoneTab } = useFinance();

  const items: {
    id: SkyOneSubTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: "OVERVIEW", label: "Tổng quan", icon: TrendingDown },
    { id: "ADVISOR", label: "Cố vấn", icon: Compass },
    { id: "SCHEDULE", label: "Lịch trả", icon: Calendar },
    { id: "PREPAYMENT", label: "Trả trước", icon: Calculator },
    { id: "CONTRACT", label: "Hợp đồng", icon: SlidersHorizontal },
  ];

  return (
    <nav
      aria-label="Điều hướng SKYONE di động"
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-[#DCE4EE] dark:border-slate-800 px-1.5 py-1.5 grid grid-cols-5 gap-1 shadow-lg transition-colors"
    >
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = skyoneTab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            data-testid={`skyone-mobile-tab-${item.id.toLowerCase()}`}
            onClick={() => setSkyoneTab(item.id)}
            className={`flex flex-col items-center justify-center gap-0.5 py-1 px-1 rounded-lg min-h-[44px] transition-colors cursor-pointer ${
              isActive
                ? "text-indigo-700 dark:text-indigo-300 font-bold"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <div
              className={`p-1 rounded-md transition-colors ${
                isActive ? "bg-indigo-50 dark:bg-indigo-500/20" : ""
              }`}
            >
              <Icon className="w-4 h-4" />
            </div>
            <span className="text-[10px] tracking-tight whitespace-nowrap truncate max-w-full">
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
