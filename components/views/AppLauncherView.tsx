"use client";

import React, { useMemo } from "react";
import {
  ArrowRight,
  Sun,
  Moon,
  Lock,
  Download,
  RefreshCw,
  CloudOff,
  AlertTriangle,
  Clock,
  LayoutGrid,
} from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { generateMortgageSchedule } from "@/lib/mortgageEngine";
import {
  FinanceAppIconSvg,
  SkyOneAppIconSvg,
} from "@/components/common/SubAppIcons";

interface AppLauncherViewProps {
  onOpenBackupModal: () => void;
}

export function AppLauncherView({ onOpenBackupModal }: AppLauncherViewProps) {
  const {
    settings,
    skyoneLoan,
    switchSubApp,
    themeMode,
    toggleThemeMode,
    isCloudConnected,
    isSyncing,
    lastSyncedAt,
    syncWithCloud,
    hasPasscodeProtection,
    lockApp,
  } = useFinance();

  const urgentSkyoneAlert = useMemo(() => {
    const schedule = generateMortgageSchedule(skyoneLoan);
    if (schedule.overdueCount > 0) {
      return {
        kind: "danger" as const,
        text: `Có ${schedule.overdueCount} kỳ quá hạn cần đối soát`,
      };
    }
    const nextInstallment = schedule.nextUnpaidInstallment;
    if (nextInstallment && nextInstallment.status === "DUE_SOON") {
      return {
        kind: "warning" as const,
        text:
          nextInstallment.daysUntilDue === 0
            ? `Hôm nay đến hạn đóng kỳ #${nextInstallment.period}`
            : `Còn ${nextInstallment.daysUntilDue} ngày đến hạn kỳ #${nextInstallment.period}`,
      };
    }
    return null;
  }, [skyoneLoan]);

  return (
    <div className="min-h-screen bg-[#F6F8FB] dark:bg-[#0B1220] text-[#172B4D] dark:text-slate-100 flex flex-col transition-colors duration-200">
      {/* Top Utility Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-[#DCE4EE] dark:border-slate-800 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-18 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-[#0F172A] dark:bg-blue-600 text-white flex items-center justify-center shrink-0">
              <LayoutGrid className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-base sm:text-lg font-black tracking-tight text-[#0F172A] dark:text-slate-100 whitespace-nowrap shrink-0">
                HOME MONI
              </span>
              <span
                className="hidden sm:inline text-slate-300 dark:text-slate-700"
                aria-hidden="true"
              >
                ·
              </span>
              <span className="hidden sm:inline text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">
                {settings.husbandName} &amp; {settings.wifeName}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isCloudConnected ? (
              <button
                type="button"
                onClick={() => syncWithCloud()}
                title={
                  lastSyncedAt
                    ? `Cloud Sync · Bấm để đồng bộ (Lần cuối: ${lastSyncedAt.toLocaleTimeString("vi-VN")})`
                    : "Cloud Sync · Bấm để đồng bộ"
                }
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 cursor-pointer whitespace-nowrap shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                <span>{isSyncing ? "Đang đồng bộ..." : "Cloud Sync"}</span>
              </button>
            ) : (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 whitespace-nowrap shrink-0">
                <CloudOff className="w-3.5 h-3.5" />
                <span>Local</span>
              </span>
            )}

            <button
              type="button"
              onClick={onOpenBackupModal}
              title="Sao lưu & Khôi phục JSON"
              aria-label="Sao lưu & Khôi phục JSON"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-[#DCE4EE] dark:border-slate-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Sao lưu</span>
            </button>

            <button
              type="button"
              onClick={toggleThemeMode}
              data-testid="launcher-theme-toggle"
              aria-label={themeMode === "dark" ? "Chuyển sang Light Mode" : "Chuyển sang Dark Mode"}
              className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-[#DCE4EE] dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-amber-300 transition-colors cursor-pointer shrink-0"
            >
              {themeMode === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {hasPasscodeProtection && (
              <button
                type="button"
                onClick={lockApp}
                aria-label="Khóa ứng dụng"
                title="Khóa ứng dụng (/login)"
                className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-[#DCE4EE] dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 transition-colors cursor-pointer shrink-0"
              >
                <Lock className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Streamlined Centered App Launcher Hub */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 flex flex-col justify-center">
        <div className="text-center space-y-2 mb-10">
          <h1 className="text-2xl sm:text-3xl font-black text-[#0F172A] dark:text-slate-100 tracking-tight text-balance">
            Chọn không gian làm việc
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Mỗi ứng dụng được tách biệt hoàn toàn để tập trung thực thi nghiệp vụ chuyên sâu.
          </p>
        </div>

        {/* 2 Streamlined App Cards */}
        <section
          aria-label="Danh sách ứng dụng"
          className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-stretch"
        >
          {/* App Card 1: Thu Chi Tổ Ấm */}
          <button
            type="button"
            data-testid="launcher-card-finance"
            onClick={() => switchSubApp("FINANCE", { financeTab: "overview" })}
            className="group bg-white dark:bg-slate-900 rounded-2xl border border-[#DCE4EE] dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500 p-7 sm:p-8 text-center flex flex-col items-center justify-between gap-6 transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <div className="flex flex-col items-center space-y-5">
              <div className="w-24 h-24 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-[#E9EEF5] dark:border-slate-700/80 flex items-center justify-center transition-transform duration-150 group-hover:scale-105">
                <FinanceAppIconSvg className="w-16 h-16" />
              </div>

              <div className="space-y-1.5">
                <h2 className="text-xl font-black text-[#0F172A] dark:text-slate-100">
                  Thu Chi Tổ Ấm
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  Sổ giao dịch, thẻ tín dụng và ngân sách gia đình
                </p>
              </div>
            </div>

            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1E3A8A] dark:text-blue-400 group-hover:translate-x-0.5 transition-transform duration-150">
              <span>Mở Thu Chi</span>
              <ArrowRight className="w-4 h-4" />
            </span>
          </button>

          {/* App Card 2: Phú Đông SKYONE */}
          <button
            type="button"
            data-testid="launcher-card-skyone"
            onClick={() => switchSubApp("SKYONE", { skyoneTab: "OVERVIEW" })}
            className="group bg-white dark:bg-slate-900 rounded-2xl border border-[#DCE4EE] dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500 p-7 sm:p-8 text-center flex flex-col items-center justify-between gap-6 transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
          >
            <div className="flex flex-col items-center space-y-5">
              <div className="w-24 h-24 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-[#E9EEF5] dark:border-slate-700/80 flex items-center justify-center transition-transform duration-150 group-hover:scale-105">
                <SkyOneAppIconSvg className="w-16 h-16" />
              </div>

              <div className="space-y-1.5">
                <h2 className="text-xl font-black text-[#0F172A] dark:text-slate-100">
                  {skyoneLoan.projectName}
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  Khoản vay căn hộ BIDV, sao kê và cố vấn 08/2028
                </p>

                {urgentSkyoneAlert && (
                  <p
                    className={`pt-1 inline-flex items-center justify-center gap-1.5 text-xs font-bold tabular-nums ${
                      urgentSkyoneAlert.kind === "danger"
                        ? "text-rose-700 dark:text-rose-300"
                        : "text-amber-700 dark:text-amber-300"
                    }`}
                  >
                    {urgentSkyoneAlert.kind === "danger" ? (
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span>{urgentSkyoneAlert.text}</span>
                  </p>
                )}
              </div>
            </div>

            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#312E81] dark:text-indigo-300 group-hover:translate-x-0.5 transition-transform duration-150">
              <span>Mở SKYONE</span>
              <ArrowRight className="w-4 h-4" />
            </span>
          </button>
        </section>

        {/* Quiet Shared Workspace Links */}
        <div className="mt-10 pt-5 border-t border-[#E9EEF5] dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span>
            Nhấn lưới 9 chấm (hoặc phím Alt+M) trong Header để đổi ứng dụng hoặc quay về đây.
          </span>
          <div className="flex flex-wrap items-center gap-4 font-semibold">
            <button
              type="button"
              onClick={() => switchSubApp("FINANCE", { financeTab: "data_admin" })}
              className="hover:text-[#0F172A] dark:hover:text-slate-100 hover:underline cursor-pointer"
            >
              Quản trị Dữ liệu
            </button>
            <button
              type="button"
              onClick={() => switchSubApp("FINANCE", { financeTab: "settings" })}
              className="hover:text-[#0F172A] dark:hover:text-slate-100 hover:underline cursor-pointer"
            >
              Cài đặt &amp; Bảo mật
            </button>
            <button
              type="button"
              onClick={() => switchSubApp("FINANCE", { financeTab: "guide" })}
              className="hover:text-[#0F172A] dark:hover:text-slate-100 hover:underline cursor-pointer"
            >
              Cẩm nang tổ ấm
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
