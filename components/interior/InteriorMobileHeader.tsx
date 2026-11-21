"use client";

import React from "react";
import { Menu, Eye, EyeOff, Sun, Moon } from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { InteriorAppIconSvg } from "@/components/common/SubAppIcons";
import { FullscreenToggle } from "@/components/common/FullscreenToggle";

interface InteriorMobileHeaderProps {
  onOpenDrawer: () => void;
}

export function InteriorMobileHeader({ onOpenDrawer }: InteriorMobileHeaderProps) {
  const { isPrivacyMode, togglePrivacyMode, themeMode, toggleThemeMode, interiorStudio } =
    useFinance();
  const activeScenario =
    interiorStudio.scenarios.find((s) => s.id === interiorStudio.activeScenarioId) ||
    interiorStudio.scenarios[0];

  return (
    <header className="sticky top-0 z-30 bg-[#0F2426] dark:bg-[#081517] text-white border-b border-teal-900/70 pt-safe">
      <div className="h-14 px-3.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onOpenDrawer}
            aria-label="Mở menu ứng dụng"
            className="p-2 -ml-1 rounded-lg hover:bg-teal-900/60 transition-colors cursor-pointer"
          >
            <Menu className="w-5 h-5 text-teal-200" />
          </button>
          <div className="w-8 h-8 rounded-lg bg-teal-500/15 border border-teal-400/30 flex items-center justify-center shrink-0">
            <InteriorAppIconSvg className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-black tracking-tight leading-tight truncate">
              SKYONE 3D Studio
            </p>
            <p className="text-[10px] font-semibold text-teal-300 truncate">
              A.12A.07 · {activeScenario.shortLabel}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <FullscreenToggle
            variant="icon"
            tone="dark"
            titleEnter="Toàn màn hình ứng dụng"
            titleExit="Thoát toàn màn hình"
          />

          <button
            type="button"
            onClick={(e) => toggleThemeMode(e)}
            aria-label={themeMode === "dark" ? "Chuyển sang giao diện Sáng" : "Chuyển sang giao diện Tối"}
            title={themeMode === "dark" ? "Chế độ Sáng" : "Chế độ Tối"}
            className="p-2 rounded-lg bg-teal-950/70 border border-teal-800/80 text-teal-200 hover:bg-teal-900/70 transition-colors cursor-pointer"
          >
            {themeMode === "dark" ? (
              <Sun className="w-4 h-4 text-amber-300" />
            ) : (
              <Moon className="w-4 h-4 text-teal-200" />
            )}
          </button>

          <button
            type="button"
            onClick={togglePrivacyMode}
            aria-label="Ẩn/hiện số tiền"
            className="p-2 rounded-lg bg-teal-950/70 border border-teal-800/80 text-teal-200 hover:bg-teal-900/70 transition-colors cursor-pointer"
          >
            {isPrivacyMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </header>
  );
}
