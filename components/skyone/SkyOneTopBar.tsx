"use client";

import React, { useState } from "react";
import {
  Download,
  RefreshCw,
  CloudOff,
  Eye,
  EyeOff,
  Lock,
  Sun,
  Moon,
  Building2,
} from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { SkyOneRouteTab } from "@/types/finance";
import { AppSwitcherWaffle } from "@/components/common/AppSwitcherWaffle";
import { CloudAuthModal } from "@/components/auth/CloudAuthModal";

interface SkyOneTopBarProps {
  onOpenBackupModal: () => void;
}

const SKYONE_TITLES: Record<SkyOneRouteTab, string> = {
  OVERVIEW: "Tổng quan & Stress-Test Khoản vay",
  ADVISOR: "Cố vấn Chiến lược Tài chính & BĐS",
  SCHEDULE: "Lịch trả nợ & Dòng tiền",
  PREPAYMENT: "Mô phỏng & Trả gốc trước hạn",
  CONTRACT: "Hợp đồng & Hồ sơ Pháp lý",
  DATA_ADMIN: "Quản trị Dữ liệu Hệ thống",
  SETTINGS: "Cài đặt & Bảo mật Tổ ấm",
};

export function SkyOneTopBar({ onOpenBackupModal }: SkyOneTopBarProps) {
  const {
    skyoneTab,
    setSkyoneTab,
    skyoneLoan,
    isSupabaseEnvReady,
    cloudUser,
    isCloudConnected,
    isSyncing,
    lastSyncedAt,
    pendingOutboxCount,
    syncWithCloud,
    themeMode,
    toggleThemeMode,
    isPrivacyMode,
    togglePrivacyMode,
    hasPasscodeProtection,
    lockApp,
  } = useFinance();

  const [isCloudAuthOpen, setIsCloudAuthOpen] = useState(false);

  return (
    <header className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-[#DCE4EE] dark:border-slate-800 sticky top-0 z-20 pt-safe shadow-xs transition-colors">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-18 sm:h-20 gap-3">
          {/* Left: Waffle Switcher + Context Title & Unit Metadata */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <AppSwitcherWaffle align="left" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2.5 min-w-0">
              <h1 className="text-base sm:text-lg xl:text-xl font-black text-[#172B4D] dark:text-slate-100 tracking-tight truncate">
                {SKYONE_TITLES[skyoneTab]}
              </h1>

              {isCloudConnected ? (
                <button
                  type="button"
                  onClick={() => syncWithCloud()}
                  title={
                    lastSyncedAt
                      ? `Cloud Sync • Bấm để đồng bộ (Lần cuối: ${lastSyncedAt.toLocaleTimeString("vi-VN")})`
                      : "Cloud Sync • Bấm để đồng bộ lại"
                  }
                  className="hidden 2xl:inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/60 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800 transition-all cursor-pointer shrink-0"
                >
                  <RefreshCw
                    className={`w-3 h-3 text-emerald-600 dark:text-emerald-400 ${
                      isSyncing ? "animate-spin" : ""
                    }`}
                  />
                  <span>
                    {isSyncing
                      ? "Đang đồng bộ..."
                      : pendingOutboxCount > 0
                      ? `Chờ đẩy (${pendingOutboxCount})`
                      : "Cloud Realtime"}
                  </span>
                </button>
              ) : isSupabaseEnvReady ? (
                <button
                  type="button"
                  onClick={() => setIsCloudAuthOpen(true)}
                  className="hidden 2xl:inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-800 cursor-pointer shrink-0"
                >
                  <CloudOff className="w-3 h-3" />
                  <span>{cloudUser ? "Ghép FamilyHub" : "Đăng nhập Cloud"}</span>
                </button>
              ) : (
                <span
                  title="Đang hoạt động chế độ lưu máy (Offline-first)"
                  className="hidden 2xl:inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 shrink-0"
                >
                  <CloudOff className="w-3 h-3" />
                  Local
                </span>
              )}
            </div>

            <div className="hidden lg:flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              <span className="inline-flex items-center gap-1 font-semibold text-indigo-700 dark:text-indigo-300 whitespace-nowrap">
                <Building2 className="w-3.5 h-3.5" />
                {skyoneLoan.projectName}
              </span>
              <span aria-hidden="true">·</span>
              <span className="whitespace-nowrap font-medium text-slate-700 dark:text-slate-300">
                {skyoneLoan.unitCode.toLowerCase().startsWith("căn")
                  ? skyoneLoan.unitCode
                  : `Căn ${skyoneLoan.unitCode}`}
              </span>
              <span aria-hidden="true">·</span>
              <span className="truncate">{skyoneLoan.bankName}</span>
            </div>
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-2 shrink-0">

            <button
              type="button"
              onClick={onOpenBackupModal}
              title="Sao lưu & Khôi phục dữ liệu"
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-[#DCE4EE] dark:border-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Sao lưu</span>
            </button>

            <button
              type="button"
              onClick={toggleThemeMode}
              data-testid="skyone-desktop-theme-toggle"
              aria-label={themeMode === "dark" ? "Chuyển sang Light Mode" : "Chuyển sang Dark Mode"}
              title={themeMode === "dark" ? "Chuyển sang Light Mode" : "Chuyển sang Dark Mode"}
              className={`inline-flex items-center justify-center w-9 h-9 rounded-lg border transition-colors cursor-pointer shrink-0 ${
                themeMode === "dark"
                  ? "bg-slate-800 border-slate-700 text-amber-300 hover:bg-slate-700"
                  : "bg-slate-100 border-[#E9EEF5] text-slate-700 hover:bg-slate-200"
              }`}
            >
              {themeMode === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={togglePrivacyMode}
              aria-label={isPrivacyMode ? "Hiện số tiền" : "Ẩn số tiền nhạy cảm"}
              title={isPrivacyMode ? "Hiện số tiền" : "Ẩn số tiền nhạy cảm"}
              className={`inline-flex items-center justify-center w-9 h-9 rounded-lg border transition-colors cursor-pointer shrink-0 ${
                isPrivacyMode
                  ? "bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300"
                  : "bg-slate-100 dark:bg-slate-800 border-[#E9EEF5] dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {isPrivacyMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>

            {hasPasscodeProtection && (
              <button
                type="button"
                onClick={lockApp}
                aria-label="Khóa ứng dụng"
                title="Khóa ứng dụng (/login)"
                className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-[#E9EEF5] dark:border-slate-700 transition-colors cursor-pointer shrink-0"
              >
                <Lock className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
      <CloudAuthModal
        isOpen={isCloudAuthOpen}
        onClose={() => setIsCloudAuthOpen(false)}
        onOpenFamilyHub={() => setSkyoneTab("SETTINGS")}
      />
    </header>
  );
}
