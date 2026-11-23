"use client";

import React, { useMemo, useState } from "react";
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
import {
  APP_ECOSYSTEM_REGISTRY,
  EcosystemAppId,
  computeEcosystemAlertBadges,
} from "@/lib/appRegistry";
import {
  FinanceAppIconSvg,
  SkyOneAppIconSvg,
  GoldAppIconSvg,
  InteriorAppIconSvg,
} from "@/components/common/SubAppIcons";
import { CloudAuthModal } from "@/components/auth/CloudAuthModal";
import { computeGoldPortfolioMetrics, formatChiWeight } from "@/lib/goldEngine";
import { calculateScenarioBoq } from "@/lib/interiorBoqEngine";
import { formatShortVNDMasked } from "@/lib/formatters";
import { UnifiedNetWorthBanner } from "@/components/dashboard/UnifiedNetWorthBanner";

interface AppLauncherViewProps {
  onOpenBackupModal: () => void;
}

const APP_ICON_MAP: Record<
  EcosystemAppId,
  React.ComponentType<{ className?: string }>
> = {
  FINANCE: FinanceAppIconSvg,
  SKYONE: SkyOneAppIconSvg,
  GOLD: GoldAppIconSvg,
  INTERIOR: InteriorAppIconSvg,
};

export function AppLauncherView({ onOpenBackupModal }: AppLauncherViewProps) {
  const {
    settings,
    skyoneLoan,
    goldPortfolio,
    interiorStudio,
    budgetSummary,
    isPrivacyMode,
    switchSubApp,
    themeMode,
    toggleThemeMode,
    isSupabaseEnvReady,
    cloudUser,
    isCloudConnected,
    isSyncing,
    lastSyncedAt,
    pendingOutboxCount,
    syncWithCloud,
    hasPasscodeProtection,
    lockApp,
  } = useFinance();

  const [isCloudAuthModalOpen, setIsCloudAuthModalOpen] = useState(false);

  const ecosystemBadges = useMemo(
    () =>
      computeEcosystemAlertBadges({
        skyoneLoan,
        goldPortfolio,
        interiorStudio,
        budgetItems: budgetSummary.items,
      }),
    [skyoneLoan, goldPortfolio, interiorStudio, budgetSummary.items]
  );

  const goldMetrics = useMemo(
    () => computeGoldPortfolioMetrics(goldPortfolio),
    [goldPortfolio]
  );

  const activeInteriorSummary = useMemo(() => {
    const activeScenario =
      interiorStudio.scenarios.find((s) => s.id === interiorStudio.activeScenarioId) ||
      interiorStudio.scenarios[0];
    if (!activeScenario) return null;
    return {
      scenario: activeScenario,
      boq: calculateScenarioBoq(activeScenario),
    };
  }, [interiorStudio]);

  const handleOpenSubApp = (appId: EcosystemAppId) => {
    switchSubApp(appId, { restoreLastTab: true });
  };

  return (
    <div className="min-h-screen bg-[#F6F8FB] dark:bg-[#0B1220] text-[#172B4D] dark:text-slate-100 flex flex-col transition-colors duration-200">
      {/* Top Utility Header */}
      <header className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-[#DCE4EE] dark:border-slate-800 sticky top-0 z-20 pt-safe">
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
                <span>
                  {isSyncing
                    ? "Đang đồng bộ..."
                    : pendingOutboxCount > 0
                    ? `Chờ đẩy (${pendingOutboxCount})`
                    : "Cloud Sync"}
                </span>
              </button>
            ) : isSupabaseEnvReady ? (
              <button
                type="button"
                onClick={() => setIsCloudAuthModalOpen(true)}
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 cursor-pointer whitespace-nowrap shrink-0"
              >
                <CloudOff className="w-3.5 h-3.5" />
                <span>{cloudUser ? "Ghép Tổ ấm" : "Đăng nhập Cloud"}</span>
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
              onClick={(e) => toggleThemeMode(e)}
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
        <div className="text-center space-y-2 mb-6">
          <h1 className="text-2xl sm:text-3xl font-black text-[#0F172A] dark:text-slate-100 tracking-tight text-balance">
            Chọn không gian làm việc
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Mỗi ứng dụng được tách biệt hoàn toàn để tập trung thực thi nghiệp vụ chuyên sâu.
          </p>
        </div>

        {/* Tổng Gia Sản Hộ Gia Đình Hợp Nhất 4 Sub-App */}
        <div className="mb-6">
          <UnifiedNetWorthBanner compact />
        </div>

        {/* 4 Streamlined App Cards (2x2 Grid) driven by Declarative Registry */}
        <section
          aria-label="Danh sách ứng dụng"
          className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6 items-stretch"
        >
          {APP_ECOSYSTEM_REGISTRY.map((app) => {
            const IconComponent = APP_ICON_MAP[app.id];
            const isSkyOne = app.id === "SKYONE";
            const isGold = app.id === "GOLD";
            const isInterior = app.id === "INTERIOR";
            const appBadge = ecosystemBadges[app.id];
            const displayTitle = isSkyOne ? skyoneLoan.projectName : app.title;
            const hoverBorderClass =
              app.accentTone === "indigo"
                ? "hover:border-indigo-500 dark:hover:border-indigo-500 focus-visible:ring-indigo-600"
                : app.accentTone === "amber"
                  ? "hover:border-amber-500 dark:hover:border-amber-500 focus-visible:ring-amber-600"
                  : app.accentTone === "teal"
                    ? "hover:border-teal-500 dark:hover:border-teal-500 focus-visible:ring-teal-600"
                    : "hover:border-blue-500 dark:hover:border-blue-500 focus-visible:ring-blue-600";
            const ctaTextClass =
              app.accentTone === "indigo"
                ? "text-[#312E81] dark:text-indigo-300"
                : app.accentTone === "amber"
                  ? "text-amber-800 dark:text-amber-300"
                  : app.accentTone === "teal"
                    ? "text-teal-800 dark:text-teal-300"
                    : "text-[#1E3A8A] dark:text-blue-400";

            return (
              <button
                key={app.id}
                type="button"
                data-testid={`launcher-card-${app.testIdKey}`}
                onClick={() => handleOpenSubApp(app.id)}
                className={`relative group bg-white dark:bg-slate-900 rounded-2xl border border-[#DCE4EE] dark:border-slate-800 ${hoverBorderClass} p-6 sm:p-7 text-center flex flex-col items-center justify-between gap-5 transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2`}
              >
                <kbd
                  aria-label={`Phím tắt ${app.shortcutLabel}`}
                  className="hidden sm:inline-block absolute top-3.5 right-3.5 px-1.5 py-0.5 text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/80 border border-[#E9EEF5] dark:border-slate-700/80 rounded"
                >
                  {app.shortcutLabel}
                </kbd>

                <div className="flex flex-col items-center space-y-4">
                  <div className="w-20 h-20 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-[#E9EEF5] dark:border-slate-700/80 flex items-center justify-center transition-transform duration-150 group-hover:scale-105">
                    <IconComponent className="w-14 h-14" />
                  </div>

                  <div className="space-y-1.5">
                    <h2 className="text-lg sm:text-xl font-black text-[#0F172A] dark:text-slate-100">
                      {displayTitle}
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                      {app.launcherDescription}
                    </p>

                    {isGold && (
                      <p className="pt-1 text-xs font-bold text-amber-700 dark:text-amber-300 tabular-nums">
                        {formatChiWeight(goldMetrics.totalRemainingChi, isPrivacyMode)} · Bid{" "}
                        {formatShortVNDMasked(goldMetrics.totalLiquidationValueBid, isPrivacyMode)}
                      </p>
                    )}

                    {isInterior && activeInteriorSummary && (
                      <p className="pt-1 text-xs font-bold text-teal-700 dark:text-teal-300 tabular-nums">
                        {activeInteriorSummary.scenario.shortLabel} · BOQ{" "}
                        {formatShortVNDMasked(
                          activeInteriorSummary.boq.grandTotalWithContingency,
                          isPrivacyMode
                        )}
                      </p>
                    )}

                    {appBadge && (
                      <p
                        data-testid={`launcher-badge-${app.testIdKey}`}
                        className={`pt-1 inline-flex items-center justify-center gap-1.5 text-xs font-bold tabular-nums ${
                          appBadge.severity === "danger"
                            ? "text-rose-700 dark:text-rose-300"
                            : "text-amber-700 dark:text-amber-300"
                        }`}
                      >
                        {appBadge.severity === "danger" ? (
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        ) : (
                          <Clock className="w-3.5 h-3.5 shrink-0" />
                        )}
                        <span>{appBadge.detailLabel}</span>
                      </p>
                    )}
                  </div>
                </div>

                <span
                  className={`inline-flex items-center gap-1.5 text-xs font-bold whitespace-nowrap shrink-0 group-hover:translate-x-0.5 transition-transform duration-150 ${ctaTextClass}`}
                >
                  <span>{app.ctaLabel}</span>
                  <ArrowRight className="w-4 h-4" />
                </span>
              </button>
            );
          })}
        </section>

        {/* Quiet Shared Workspace Links */}
        <div className="mt-10 pt-5 border-t border-[#E9EEF5] dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span>
            Dùng phím <kbd className="font-mono font-bold">Alt+1..4</kbd> để chuyển nhanh giữa 4 ứng dụng, hoặc <kbd className="font-mono font-bold">Alt+M</kbd> mở lưới 9 chấm.
          </span>
          <div className="flex flex-wrap items-center gap-4 font-semibold">
            <button
              type="button"
              onClick={() => switchSubApp("FINANCE", { financeTab: "data_admin" })}
              className="hover:text-[#0F172A] dark:hover:text-slate-100 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              Quản trị Dữ liệu
            </button>
            <button
              type="button"
              onClick={() => switchSubApp("FINANCE", { financeTab: "settings" })}
              className="hover:text-[#0F172A] dark:hover:text-slate-100 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              Cài đặt &amp; Bảo mật
            </button>
            <button
              type="button"
              onClick={() => switchSubApp("FINANCE", { financeTab: "guide" })}
              className="hover:text-[#0F172A] dark:hover:text-slate-100 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              Cẩm nang tổ ấm
            </button>
          </div>
        </div>
      </main>

      <CloudAuthModal
        isOpen={isCloudAuthModalOpen}
        onClose={() => setIsCloudAuthModalOpen(false)}
        onOpenFamilyHub={() => switchSubApp("FINANCE", { financeTab: "settings" })}
      />
    </div>
  );
}
