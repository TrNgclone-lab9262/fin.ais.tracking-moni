"use client";

import React, { useState } from "react";
import {
  Bell,
  Plus,
  Download,
  Calendar,
  Menu,
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
} from "lucide-react";
import { useFinance, NavTab } from "@/context/FinanceContext";
import { getMonthDisplayLabel } from "@/lib/formatters";

interface TopBarProps {
  onOpenAddModal: () => void;
  onOpenBackupModal: () => void;
  onOpenResetConfirm: () => void;
  onToggleMobileMenu: () => void;
  onOpenScanner?: () => void;
}

export function TopBar({
  onOpenAddModal,
  onOpenBackupModal,
  onOpenResetConfirm,
  onToggleMobileMenu,
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
    isCloudConnected,
    isSyncing,
    lastSyncedAt,
    syncWithCloud,
    isPrivacyMode,
    togglePrivacyMode,
    settings,
    hasPasscodeProtection,
    lockApp,
    recurringRules,
    applyAllPendingRecurringRules,
  } = useFinance();

  const [showNotifications, setShowNotifications] = useState(false);

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
    <header className="bg-white border-b border-[#DCE4EE] sticky top-0 z-20 shadow-xs">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-18 sm:h-20 gap-3">
          {/* Bên Trái */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onToggleMobileMenu}
              className="md:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
              aria-label="Mở menu"
            >
              <Menu className="w-6 h-6" />
            </button>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 min-w-0">
                <h1 className="text-base sm:text-lg xl:text-xl font-black text-[#172B4D] tracking-tight truncate">
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
                    className="hidden 2xl:inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100/80 px-2 py-0.5 rounded-md border border-emerald-200 transition-all cursor-pointer shadow-2xs shrink-0"
                  >
                    <RefreshCw
                      className={`w-3 h-3 text-emerald-600 ${isSyncing ? "animate-spin" : ""}`}
                    />
                    <span>{isSyncing ? "Đang đồng bộ..." : "🟢 Cloud Realtime"}</span>
                  </button>
                ) : (
                  <span
                    title="Đang hoạt động chế độ lưu máy (Offline-first)"
                    className="hidden 2xl:inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 shrink-0"
                  >
                    <CloudOff className="w-3.5 h-3.5 text-slate-500" />
                    Lưu máy
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Giữa: Bộ Chuyển Đổi Góc Nhìn */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-[#E9EEF5] shrink-0">
            <button
              type="button"
              onClick={() => setActivePerspective("ALL")}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                activePerspective === "ALL"
                  ? "bg-white text-blue-700 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
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
                  : "text-slate-500 hover:text-slate-800"
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
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <span>👩</span>
              <span className="hidden lg:inline">{settings.wifeName}</span>
            </button>
          </div>

          {/* Bên Phải */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Bộ chọn tháng */}
            <div className="flex items-center bg-slate-100 text-slate-700 px-2.5 py-1.5 rounded-md text-xs font-semibold border border-[#E9EEF5]">
              <Calendar className="w-3.5 h-3.5 text-blue-600 mr-1.5 shrink-0" />
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                aria-label="Chọn tháng"
                className="bg-transparent border-none outline-none cursor-pointer pr-1 font-semibold text-slate-800 text-xs"
              >
                <option value="ALL">Toàn thời gian</option>
                {availableMonths.map((m) => (
                  <option key={m} value={m}>
                    {getMonthDisplayLabel(m)}
                  </option>
                ))}
              </select>
            </div>

            {/* Privacy Toggle */}
            <button
              type="button"
              onClick={togglePrivacyMode}
              aria-label={isPrivacyMode ? "Hiện số tiền" : "Ẩn số tiền nhạy cảm"}
              title={isPrivacyMode ? "Hiện số tiền" : "Ẩn số tiền nhạy cảm"}
              className={`p-2 rounded-md border transition-colors cursor-pointer ${
                isPrivacyMode
                  ? "bg-amber-50 border-amber-200 text-amber-700"
                  : "bg-slate-100 border-[#E9EEF5] text-slate-600 hover:bg-slate-200"
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
                  ? "bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-600 border-[#E9EEF5]"
              }`}
            >
              <Lock className="w-4 h-4" />
            </button>

            {/* Chuông Thông Báo */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                aria-label="Cảnh báo và nhắc nhở"
                className="relative p-2 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
                title="Cảnh báo & Nhắc nhở"
              >
                <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center border-2 border-white shadow-xs">
                    {notifications.length}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div
                  className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-[#DCE4EE] py-3 z-50 animate-in fade-in slide-in-from-top-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="px-4 py-2 border-b border-[#E9EEF5] flex items-center justify-between">
                    <span className="text-sm font-bold text-[#172B4D] flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      Cảnh báo gia đình ({notifications.length})
                    </span>
                    <button
                      onClick={() => setShowNotifications(false)}
                      className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {pendingRecurringCount > 0 && (
                    <div className="mx-3 mt-2.5 p-2.5 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-[#1E3A8A]">
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

                  <div className="max-h-72 overflow-y-auto divide-y divide-[#E9EEF5] p-2">
                    {notifications.length === 0 ? (
                      <p className="py-6 text-center text-xs text-slate-400 font-medium">
                        Không còn thông báo nào chưa đọc
                      </p>
                    ) : (
                      notifications.map((notif) => (
                        <div
                          key={notif.id}
                          className="p-3 hover:bg-slate-50 rounded-lg transition-colors flex items-start gap-2.5"
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
                            <p className="text-xs font-bold text-slate-800">{notif.title}</p>
                            <p className="text-[11px] font-medium text-slate-600 mt-0.5">{notif.message}</p>
                            <span className="text-[10px] text-slate-400 mt-1 block">
                              {notif.date}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => markNotificationRead(notif.id)}
                            title="Đánh dấu đã đọc"
                            className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer shrink-0"
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
              className="hidden xl:flex items-center gap-1.5 px-2.5 2xl:px-3 py-1.5 text-xs font-medium text-slate-600 bg-white hover:bg-slate-50 border border-[#DCE4EE] rounded-md transition-all shadow-xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden 2xl:inline">Sao lưu</span>
            </button>

            {/* Mẫu demo */}
            <button
              onClick={onOpenResetConfirm}
              title="Nạp lại bộ dữ liệu mẫu gia đình chuẩn"
              aria-label="Nạp lại bộ dữ liệu mẫu gia đình chuẩn"
              className="hidden xl:flex items-center gap-1.5 px-2.5 2xl:px-3 py-1.5 text-xs font-medium text-slate-600 bg-white hover:bg-slate-50 border border-[#DCE4EE] rounded-md transition-all shadow-xs cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden 2xl:inline">Mẫu demo</span>
            </button>

            {/* Quét hóa đơn AI */}
            {onOpenScanner && (
              <button
                onClick={onOpenScanner}
                title="Quét hóa đơn thông minh bằng Gemini Vision AI"
                className="flex items-center gap-1.5 px-3 py-1.5 sm:py-2 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-md transition-all shadow-xs cursor-pointer active:scale-95"
              >
                <Camera className="w-4 h-4 text-indigo-600" />
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
    </header>
  );
}
