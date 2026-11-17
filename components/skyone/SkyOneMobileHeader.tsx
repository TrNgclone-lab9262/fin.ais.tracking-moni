"use client";

import React from "react";
import { Menu, Building2, Eye, EyeOff, Lock, Sun, Moon, Sparkles } from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { usePWAUpdate } from "@/context/PWAUpdateContext";
import { AppSwitcherWaffle } from "@/components/common/AppSwitcherWaffle";
import { useHaptic } from "@/src/hooks/useHaptic";

interface SkyOneMobileHeaderProps {
  onOpenDrawer: () => void;
  onOpenChatbot?: () => void;
}

export function SkyOneMobileHeader({ onOpenDrawer, onOpenChatbot }: SkyOneMobileHeaderProps) {
  const {
    skyoneLoan,
    themeMode,
    toggleThemeMode,
    isPrivacyMode,
    togglePrivacyMode,
    hasPasscodeProtection,
    lockApp,
  } = useFinance();

  const { hasUpdate } = usePWAUpdate();
  const haptic = useHaptic();

  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-[#DCE4EE] dark:border-slate-800 pt-safe shadow-xs transition-colors">
      <div className="px-2.5 py-2 flex items-center justify-between gap-2">
      {/* Left: Drawer + SKYONE Brand */}
      <div className="flex items-center gap-1.5 min-w-0">
        <button
          type="button"
          onClick={() => {
            haptic.light();
            onOpenDrawer();
          }}
          aria-label="Mở menu ứng dụng"
          className="relative w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center transition-all active:scale-95 cursor-pointer shrink-0"
        >
          <Menu className="w-4 h-4" />
          {hasUpdate && (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-indigo-600 ring-2 ring-white dark:ring-slate-900" />
          )}
        </button>

        <AppSwitcherWaffle variant="compact" align="left" />

        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <Building2 className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="font-black text-xs text-[#172B4D] dark:text-slate-100 block truncate leading-tight">
              SKYONE
            </span>
            <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-300 block truncate">
              {skyoneLoan.unitCode}
            </span>
          </div>
        </div>
      </div>

      {/* Right: AI + Theme + Privacy + Lock */}
      <div className="flex items-center gap-1 shrink-0">
        {onOpenChatbot && (
          <button
            type="button"
            onClick={() => {
              haptic.light();
              onOpenChatbot();
            }}
            aria-label="Mở Trợ lý AI SKYONE"
            title="Trợ lý AI Gemini"
            className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-blue-600 text-white flex items-center justify-center transition-all active:scale-95 cursor-pointer shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5" />
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            haptic.light();
            toggleThemeMode();
          }}
          aria-label={themeMode === "dark" ? "Chuyển sang Light Mode" : "Chuyển sang Dark Mode"}
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all active:scale-95 cursor-pointer border ${
            themeMode === "dark"
              ? "bg-slate-800 text-amber-300 border-slate-700"
              : "bg-slate-100 text-slate-700 border-slate-200/80"
          }`}
        >
          {themeMode === "dark" ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
        </button>

        <button
          type="button"
          onClick={() => {
            haptic.light();
            togglePrivacyMode();
          }}
          aria-label={isPrivacyMode ? "Hiện số tiền" : "Ẩn số tiền"}
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all active:scale-95 cursor-pointer border ${
            isPrivacyMode
              ? "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-slate-700"
          }`}
        >
          {isPrivacyMode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>

        {hasPasscodeProtection && (
          <button
            type="button"
            onClick={() => {
              haptic.medium();
              lockApp();
            }}
            aria-label="Khóa ứng dụng"
            className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700 flex items-center justify-center transition-all active:scale-95 cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      </div>
    </header>
  );
}
