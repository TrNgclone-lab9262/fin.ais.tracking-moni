"use client";

import React, { useState } from "react";
import {
  Bell,
  Plus,
  Download,
  Calendar,
  X,
  AlertTriangle,
  RotateCcw,
  CloudOff,
  RefreshCw,
  Camera,
  Eye,
  EyeOff,
  Lock,
  Check,
  Sun,
  Moon,
} from "lucide-react";
import { useFinance, NavTab } from "@/context/FinanceContext";
import { getMonthDisplayLabel } from "@/lib/formatters";
import { AppSwitcherWaffle } from "@/components/common/AppSwitcherWaffle";
import { CloudAuthModal } from "@/components/auth/CloudAuthModal";

interface TopBarProps {
  onOpenAddModal: () => void;
  onOpenBackupModal: () => void;
  onOpenResetConfirm: () => void;
  onOpenScanner?: () => void;
}

export function TopBar({
  onOpenAddModal,
  onOpenBackupModal,
  onOpenResetConfirm,
  onOpenScanner,
}: TopBarProps) {
  const {
    selectedMonth,
    setSelectedMonth,
    availableMonths,
    notifications,
    markNotificationRead,
    activeTab,
    activePerspective,
    setActivePerspective,
    isSupabaseEnvReady,
    cloudUser,
    isCloudConnected,
    isSyncing,
    lastSyncedAt,
    pendingOutboxCount,
    syncWithCloud,
    setActiveTab,
    themeMode,
    toggleThemeMode,
    isPrivacyMode,
    togglePrivacyMode,
    settings,
    hasPasscodeProtection,
    lockApp,
    recurringRules,
    applyAllPendingRecurringRules,
  } = useFinance();

  const [showNotifications, setShowNotifications] = useState(false);
  const [isCloudAuthOpen, setIsCloudAuthOpen] = useState(false);

  const pendingRecurringCount = recurringRules.filter(
    (r) => r.isActive && r.lastAppliedMonth !== (selectedMonth === "ALL" ? availableMonths[0] : selectedMonth)
  ).length;

  const tabTitles: Record<NavTab, string> = {
    overview: "Tổng quan tổ ấm (My Home)",
    transactions: "Sổ giao dịch gia đình",
    accounts: "Tài khoản & Thẻ tín dụng",
    planning: "Kế hoạch & Ngân sách tổ ấm",
    debts_invest: "Nợ & Đầu tư gia đình",
    data_admin: "Quản trị Dữ liệu (Data Studio)",
    guide: "Cẩm nang tài chính tổ ấm",
    settings: "Cài đặt & Tùy biến",
  };

  return (
    <header className="bg-white dark:bg-slate-900 border-b border-[#DCE4EE] dark:border-slate-800 sticky top-0 z-20 shadow-xs transition-colors">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-18 sm:h-20 gap-3">
          {/* Bên Trái */}
          <div className="flex items-center gap-3 min-w-0">
            <AppSwitcherWaffle align="left" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 min-w-0">
                <h1 className="text-base sm:text-lg xl:text-xl font-black text-[#172B4D] dark:text-slate-100 tracking-tight truncate">
                  {tabTitles[activeTab]}
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
                    className="hidden 2xl:inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/60 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800 transition-all cursor-pointer shadow-2xs shrink-0"
                  >
                    <RefreshCw
                      className={`w-3 h-3 text-emerald-600 dark:text-emerald-400 ${isSyncing ? "animate-spin" : ""}`}
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
                    <CloudOff className="w-3.5 h-3.5" />
                    <span>{cloudUser ? "Ghép FamilyHub" : "Đăng nhập Cloud"}</span>
                  </button>
                ) : (
                  <span
                    title="Đang hoạt động chế độ lưu máy (Offline-first)"
                    className="hidden 2xl:inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 shrink-0"
                  >
                    <CloudOff className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                    Lưu máy
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Giữa: Bộ Chuyển Đổi Góc Nhìn */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-[#E9EEF5] dark:border-slate-700 shrink-0">
            <button
              type="button"
              onClick={() => setActivePerspective("ALL")}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                activePerspective === "ALL"
                  ? "bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 shadow-xs"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <span>🏡</span>
              <span className="hidden lg:inline">My Home</span>
            </button>
            <button
              type="button"
              onClick={() => setActivePerspective("HUSBAND")}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                activePerspective === "HUSBAND"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <span>👨</span>
              <span className="hidden lg:inline">{settings.husbandName}</span>
            </button>
            <button
              type="button"
              onClick={() => setActivePerspective("WIFE")}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                activePerspective === "WIFE"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <span>👩</span>
              <span className="hidden lg:inline">{settings.wifeName}</span>
            </button>
          </div>

          {/* Bên Phải */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Bộ chọn tháng */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-2.5 py-1.5 rounded-md text-xs font-semibold border border-[#E9EEF5] dark:border-slate-700">
              <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 mr-1.5 shrink-0" />
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                aria-label="Chọn tháng"
                className="bg-transparent border-none outline-none cursor-pointer pr-1 font-semibold text-slate-800 dark:text-slate-100 text-xs [&>option]:bg-white [&>option]:text-slate-900 dark:[&>option]:bg-slate-900 dark:[&>option]:text-slate-100"
              >
                <option value="ALL">Toàn thời gian</option>
                {availableMonths.map((m) => (
                  <option key={m} value={m}>
                    {getMonthDisplayLabel(m)}
                  </option>
                ))}
              </select>
            </div>

            {/* Light / Dark Theme Toggle */}
            <button
              type="button"
              onClick={toggleThemeMode}
              data-testid="desktop-theme-toggle"
              aria-label={themeMode === "dark" ? "Chuyển sang giao diện Sáng" : "Chuyển sang giao diện Tối"}
              title={themeMode === "dark" ? "Chuyển sang Light Mode" : "Chuyển sang Dark Mode"}
              className={`p-2 rounded-md border transition-colors cursor-pointer ${
                themeMode === "dark"
                  ? "bg-slate-800 border-slate-700 text-amber-300 hover:bg-slate-700"
                  : "bg-slate-100 border-[#E9EEF5] text-slate-700 hover:bg-slate-200"
              }`}
            >
              {themeMode === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Privacy Toggle */}
            <button
              type="button"
              onClick={togglePrivacyMode}
              aria-label={isPrivacyMode ? "Hiện số tiền" : "Ẩn số tiền nhạy cảm"}
              title={isPrivacyMode ? "Hiện số tiền" : "Ẩn số tiền nhạy cảm"}
              className={`p-2 rounded-md border transition-colors cursor-pointer ${
                isPrivacyMode
                  ? "bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300"
                  : "bg-slate-100 dark:bg-slate-800 border-[#E9EEF5] dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {isPrivacyMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>

            {/* Lock /login screen button */}
            <button
              type="button"
              onClick={lockApp}
              aria-label="Mở màn hình khóa /login"
              title={
                hasPasscodeProtection
                  ? "Khóa ứng dụng & mở màn hình /login"
                  : "Mở màn hình khóa /login để thiết lập mã Code & Face ID"
              }
              className={`p-2 rounded-md border transition-colors cursor-pointer ${
                hasPasscodeProtection
                  ? "bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                  : "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border-[#E9EEF5] dark:border-slate-700"
              }`}
            >
              <Lock className="w-4 h-4" />
            </button>

            {/* Chuông Thông Báo */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                aria-label="Cảnh báo và nhắc nhở"
                className="relative p-2 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-[#E9EEF5] dark:border-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                title="Cảnh báo & Nhắc nhở"
              >
                <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-xs">
                    {notifications.length}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div
                  className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-[#DCE4EE] dark:border-slate-700 py-3 z-50 animate-in fade-in slide-in-from-top-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="px-4 py-2 border-b border-[#E9EEF5] dark:border-slate-800 flex items-center justify-between">
                    <span className="text-sm font-bold text-[#172B4D] dark:text-slate-100 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      Cảnh báo gia đình ({notifications.length})
                    </span>
                    <button
                      onClick={() => setShowNotifications(false)}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {pendingRecurringCount > 0 && (
                    <div className="mx-3 mt-2.5 p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-[#1E3A8A] dark:text-blue-200">
                        {pendingRecurringCount} khoản định kỳ chưa ghi sổ
                      </span>
                      <button
                        type="button"
                        onClick={() => applyAllPendingRecurringRules()}
                        className="px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold cursor-pointer shrink-0"
                      >
                        Ghi hết
                      </button>
                    </div>
                  )}

                  <div className="max-h-72 overflow-y-auto divide-y divide-[#E9EEF5] dark:divide-slate-800 p-2">
                    {notifications.length === 0 ? (
                      <p className="py-6 text-center text-xs text-slate-400 font-medium">
                        Không còn thông báo nào chưa đọc
                      </p>
                    ) : (
                      notifications.map((notif) => (
                        <div
                          key={notif.id}
                          className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800/70 rounded-lg transition-colors flex items-start gap-2.5"
                        >
                          <span
                            className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${
                              notif.type === "danger"
                                ? "bg-rose-500"
                                : notif.type === "warning"
                                ? "bg-amber-500"
                                : "bg-blue-500"
                            }`}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{notif.title}</p>
                            <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300 mt-0.5">{notif.message}</p>
                            <span className="text-[10px] text-slate-400 mt-1 block">
                              {notif.date}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => markNotificationRead(notif.id)}
                            title="Đánh dấu đã đọc"
                            className="p-1 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded cursor-pointer shrink-0"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Sao lưu */}
            <button
              onClick={onOpenBackupModal}
              title="Sao lưu / Khôi phục dữ liệu JSON"
              aria-label="Sao lưu / Khôi phục dữ liệu JSON"
              className="hidden xl:flex items-center gap-1.5 px-2.5 2xl:px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-[#DCE4EE] dark:border-slate-700 rounded-md transition-all shadow-xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <span className="hidden 2xl:inline">Sao lưu</span>
            </button>

            {/* Mẫu demo */}
            <button
              onClick={onOpenResetConfirm}
              title="Nạp lại bộ dữ liệu mẫu gia đình chuẩn"
              aria-label="Nạp lại bộ dữ liệu mẫu gia đình chuẩn"
              className="hidden xl:flex items-center gap-1.5 px-2.5 2xl:px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-[#DCE4EE] dark:border-slate-700 rounded-md transition-all shadow-xs cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <span className="hidden 2xl:inline">Mẫu demo</span>
            </button>

            {/* Quét hóa đơn AI */}
            {onOpenScanner && (
              <button
                onClick={onOpenScanner}
                title="Quét hóa đơn thông minh bằng Gemini Vision AI"
                className="flex items-center gap-1.5 px-3 py-1.5 sm:py-2 text-xs font-bold text-indigo-700 dark:text-indigo-200 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 rounded-md transition-all shadow-xs cursor-pointer active:scale-95"
              >
                <Camera className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span className="hidden 2xl:inline">Quét hóa đơn AI</span>
                <span className="2xl:hidden">Quét AI</span>
              </button>
            )}

            {/* Thêm giao dịch */}
            <button
              onClick={onOpenAddModal}
              className="flex items-center gap-1.5 px-3.5 py-1.5 sm:py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-md transition-all shadow-xs active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Thêm giao dịch</span>
              <span className="sm:hidden">Thêm</span>
            </button>
          </div>
        </div>
      </div>

      <CloudAuthModal
        isOpen={isCloudAuthOpen}
        onClose={() => setIsCloudAuthOpen(false)}
        onOpenFamilyHub={() => setActiveTab("settings")}
      />
    </header>
  );
}
