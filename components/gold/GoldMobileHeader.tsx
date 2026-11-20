"use client";

import React from "react";
import { Menu, Eye, EyeOff, Sun, Moon } from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { AppSwitcherWaffle } from "@/components/common/AppSwitcherWaffle";

interface GoldMobileHeaderProps {
  onOpenDrawer: () => void;
}

export function GoldMobileHeader({ onOpenDrawer }: GoldMobileHeaderProps) {
  const { isPrivacyMode, togglePrivacyMode, themeMode, toggleThemeMode } = useFinance();

  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-[#DCE4EE] dark:border-slate-800 pt-safe">
      <div className="h-14 px-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onOpenDrawer}
            aria-label="Mở menu"
            className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 cursor-pointer shrink-0"
          >
            <Menu className="w-4 h-4" />
          </button>
          <AppSwitcherWaffle variant="compact" />
          <div className="min-w-0">
            <p className="text-sm font-black text-[#0F172A] dark:text-slate-100 truncate">
              Kho Vàng 9999
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={togglePrivacyMode}
            aria-label="Chế độ riêng tư"
            className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            {isPrivacyMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={(e) => toggleThemeMode(e)}
            aria-label="Đổi giao diện sáng tối"
            className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-amber-300 cursor-pointer"
          >
            {themeMode === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </header>
  );
}
