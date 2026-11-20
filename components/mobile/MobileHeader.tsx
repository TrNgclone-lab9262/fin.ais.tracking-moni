"use client";

import React from "react";
import { Menu, Home, RefreshCw, Camera, Eye, EyeOff, Bell, Lock, Sun, Moon } from "lucide-react";
import { useFinance, PerspectiveMode } from "@/context/FinanceContext";
import { usePWAUpdate } from "@/context/PWAUpdateContext";
import { AppSwitcherWaffle } from "@/components/common/AppSwitcherWaffle";
import { useHaptic } from "@/src/hooks/useHaptic";

interface MobileHeaderProps {
  onOpenDrawer: () => void;
  onOpenScanner?: () => void;
  onOpenNotifications?: () => void;
}

export function MobileHeader({
  onOpenDrawer,
  onOpenScanner,
  onOpenNotifications,
}: MobileHeaderProps) {
  const {
    activePerspective,
    setActivePerspective,
    isCloudConnected,
    isSyncing,
    pendingOutboxCount,
    themeMode,
    toggleThemeMode,
    isPrivacyMode,
    togglePrivacyMode,
    notifications,
    hasPasscodeProtection,
    lockApp,
  } = useFinance();

  const { hasUpdate } = usePWAUpdate();
  const haptic = useHaptic();

  const perspectives: { id: PerspectiveMode; label: string; icon: string }[] = [
    { id: "ALL", label: "Chung", icon: "🏡" },
    { id: "HUSBAND", label: "Chuột", icon: "👨" },
    { id: "WIFE", label: "Mèo", icon: "👩" },
  ];

  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-[#DCE4EE] dark:border-slate-800 pt-safe shadow-xs transition-colors">
      <div className="px-2 min-[390px]:px-2.5 py-2 flex items-center justify-between gap-1">
      {/* Nút Hamburger + Logo Brand */}
      <div className="flex items-center gap-1 min-[390px]:gap-1.5 shrink-0">
        <button
          onClick={() => {
            haptic.light();
            onOpenDrawer();
          }}
          aria-label={hasUpdate ? "Mở menu tổ ấm (Có bản cập nhật mới)" : "Mở menu tổ ấm"}
          className="relative w-7 h-7 min-[390px]:w-8 min-[390px]:h-8 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 active:bg-slate-300 active:scale-95 text-slate-700 dark:text-slate-200 flex items-center justify-center transition-all cursor-pointer shrink-0"
        >
          <Menu className="w-4 h-4" />
          {hasUpdate && (
            <span
              className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-blue-600 ring-2 ring-white dark:ring-slate-900"
              title="Có bản cập nhật ứng dụng mới"
            />
          )}
        </button>

        <AppSwitcherWaffle variant="compact" align="left" />

        <div className="flex items-center gap-1 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <Home className="w-3.5 h-3.5 stroke-[2.5]" />
          </div>
          <span className="hidden min-[440px]:inline font-black text-[11px] tracking-wide text-[#1E3A8A] dark:text-blue-300">
            MONI
          </span>
        </div>
      </div>

      {/* Perspective Switcher */}
      <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200/80 dark:border-slate-700 shrink-0">
        {perspectives.map((p) => {
          const isActive = activePerspective === p.id;
          return (
            <button
              key={p.id}
              onClick={() => {
                haptic.light();
                setActivePerspective(p.id);
              }}
              className={`flex items-center gap-0.5 px-1.5 py-1 rounded-md text-[10px] font-bold transition-all active:scale-95 cursor-pointer ${
                isActive
                  ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-300 shadow-xs"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <span className="hidden min-[410px]:inline">{p.icon}</span>
              <span>{p.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {/* Light / Dark Toggle */}
        <button
          type="button"
          onClick={(e) => {
            haptic.light();
            toggleThemeMode(e);
          }}
          data-testid="mobile-theme-toggle"
          aria-label={themeMode === "dark" ? "Chuyển sang Light Mode" : "Chuyển sang Dark Mode"}
          title={themeMode === "dark" ? "Chuyển sang Light Mode" : "Chuyển sang Dark Mode"}
          className={`w-7 h-7 min-[390px]:w-8 min-[390px]:h-8 rounded-lg flex items-center justify-center transition-all active:scale-95 cursor-pointer border ${
            themeMode === "dark"
              ? "bg-slate-800 text-amber-300 border-slate-700"
              : "bg-slate-100 text-slate-700 border-slate-200/80"
          }`}
        >
          {themeMode === "dark" ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
        </button>

        {/* Privacy Eye Toggle */}
        <button
          onClick={() => {
            haptic.light();
            togglePrivacyMode();
          }}
          aria-label={isPrivacyMode ? "Hiện số tiền" : "Ẩn số tiền nhạy cảm"}
          title={isPrivacyMode ? "Hiện số tiền" : "Ẩn số tiền nhạy cảm"}
          className={`w-7 h-7 min-[390px]:w-8 min-[390px]:h-8 rounded-lg flex items-center justify-center transition-all active:scale-95 cursor-pointer border ${
            isPrivacyMode
              ? "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-slate-700"
          }`}
        >
          {isPrivacyMode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>

        {/* Chuông thông báo di động */}
        {onOpenNotifications && (
          <button
            type="button"
            onClick={() => {
              haptic.light();
              onOpenNotifications();
            }}
            aria-label="Thông báo & cảnh báo"
            title="Cảnh báo gia đình"
            className="relative w-7 h-7 min-[390px]:w-8 min-[390px]:h-8 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700 flex items-center justify-center transition-all active:scale-95 cursor-pointer"
          >
            <Bell className="w-3.5 h-3.5" />
            {notifications.length > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-0.5 rounded-full bg-rose-500 text-white text-[9px] font-extrabold flex items-center justify-center border border-white dark:border-slate-900">
                {notifications.length > 9 ? "9+" : notifications.length}
              </span>
            )}
          </button>
        )}

        {/* Khóa /login */}
        <button
          type="button"
          onClick={() => {
            haptic.medium();
            lockApp();
          }}
          aria-label="Khóa ứng dụng"
          title="Mở màn hình khóa /login"
          className={`w-7 h-7 min-[390px]:w-8 min-[390px]:h-8 rounded-lg flex items-center justify-center transition-all active:scale-95 cursor-pointer border ${
            hasPasscodeProtection
              ? "bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 border-blue-200 dark:border-blue-800"
              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-slate-700"
          }`}
        >
          <Lock className="w-3.5 h-3.5" />
        </button>

        {/* Nút Quét Hóa Đơn AI Nhanh */}
        {onOpenScanner && (
          <button
            onClick={() => {
              haptic.light();
              onOpenScanner();
            }}
            aria-label="Quét hóa đơn bằng AI"
            className="w-7 h-7 min-[390px]:w-8 min-[390px]:h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 active:bg-indigo-100 text-indigo-600 dark:text-indigo-300 flex items-center justify-center transition-all active:scale-95 cursor-pointer border border-indigo-200/80 dark:border-indigo-800"
            title="Quét hóa đơn thông minh"
          >
            <Camera className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Sync dot */}
        <div className="hidden min-[410px]:flex items-center pl-0.5">
          {isSyncing ? (
            <RefreshCw className="w-3 h-3 text-blue-600 dark:text-blue-400 animate-spin" />
          ) : isCloudConnected && pendingOutboxCount > 0 ? (
            <span
              className="w-2 h-2 rounded-full bg-amber-500 ring-2 ring-amber-100 dark:ring-amber-900"
              title={`Đang chờ đẩy ${pendingOutboxCount} thay đổi lên Cloud`}
            />
          ) : isCloudConnected ? (
            <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-100 dark:ring-emerald-900" title="Cloud Sync Hoạt động" />
          ) : (
            <span className="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-500" title="Local-first Storage" />
          )}
        </div>
      </div>
      </div>
    </header>
  );
}
