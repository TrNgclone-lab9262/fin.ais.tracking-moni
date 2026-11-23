"use client";

import React, { Suspense, lazy, useEffect, useState } from "react";
import { useFinance } from "@/context/FinanceContext";
import { getEcosystemAppByShortcutDigit } from "@/lib/appRegistry";
import { usePWAUpdate } from "@/context/PWAUpdateContext";
import { useResponsive } from "@/src/hooks/useResponsive";
import { Sidebar } from "@/components/common/Sidebar";
import { TopBar } from "@/components/common/TopBar";
import { MobileDrawer } from "@/components/common/MobileDrawer";
import { BottomNavBar } from "@/components/common/BottomNavBar";
import { MobileHeader } from "@/components/mobile/MobileHeader";
import { SkyOneSidebar } from "@/components/skyone/SkyOneSidebar";
import { SkyOneTopBar } from "@/components/skyone/SkyOneTopBar";
import { SkyOneMobileHeader } from "@/components/skyone/SkyOneMobileHeader";
import { SkyOneBottomNavBar } from "@/components/skyone/SkyOneBottomNavBar";
import { GoldSidebar } from "@/components/gold/GoldSidebar";
import { GoldTopBar } from "@/components/gold/GoldTopBar";
import { GoldMobileHeader } from "@/components/gold/GoldMobileHeader";
import { GoldBottomNavBar } from "@/components/gold/GoldBottomNavBar";
import { InteriorSidebar } from "@/components/interior/InteriorSidebar";
import { InteriorTopBar } from "@/components/interior/InteriorTopBar";
import { InteriorMobileHeader } from "@/components/interior/InteriorMobileHeader";
import { InteriorBottomNavBar } from "@/components/interior/InteriorBottomNavBar";

// 1. Sub-App & Shared Views
import { OverviewView } from "@/components/views/OverviewView";
import { TransactionsView } from "@/components/views/TransactionsView";
import { AccountsView } from "@/components/views/AccountsView";
import { PlanningView } from "@/components/views/PlanningView";
import { DebtsInvestView } from "@/components/views/DebtsInvestView";
import { SkyOneLoanView } from "@/components/views/SkyOneLoanView";
import { GoldVaultView } from "@/components/views/GoldVaultView";
import { DataAdminView } from "@/components/views/DataAdminView";
import { GuideView } from "@/components/views/GuideView";
import { SettingsView } from "@/components/views/SettingsView";
import { AppLauncherView } from "@/components/views/AppLauncherView";

function lazyWithRetry<T extends React.ComponentType<unknown>>(
  importer: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      return await importer();
    } catch (firstErr) {
      // Xóa cache SW cũ nếu có rồi thử tải lại module một lần trước khi báo lỗi
      try {
        if (typeof caches !== "undefined") {
          const keys = await caches.keys();
          await Promise.all(
            keys.filter((k) => k.startsWith("homemoni-pwa-")).map((k) => caches.delete(k))
          );
        }
      } catch {
        // ignore cache cleanup error
      }
      try {
        return await importer();
      } catch {
        throw firstErr;
      }
    }
  });
}

const LazyInteriorStudioView = lazyWithRetry(
  () => import("@/components/views/InteriorStudioView")
);

class InteriorChunkErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: unknown) {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : "Không thể tải module Studio 3D.",
    };
  }

  componentDidCatch(error: unknown) {
    console.warn("InteriorStudioView load error:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-2xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/70 dark:bg-amber-950/30 p-6 text-center space-y-3">
          <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Không thể tải phân hệ SKYONE 3D Interior
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto">
            Kết nối mạng bị gián đoạn hoặc trình duyệt đang giữ bản nhớ đệm cũ ({this.state.message}).
          </p>
          <div className="flex items-center justify-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, message: "" })}
              className="px-3.5 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold cursor-pointer"
            >
              Thử tải lại
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer"
            >
              Làm mới trang
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// 2. Mobile-Specific Views (Thu chi)
import { MobileOverviewView } from "@/components/mobile/views/MobileOverviewView";
import { MobileTransactionsView } from "@/components/mobile/views/MobileTransactionsView";
import { MobileAccountsView } from "@/components/mobile/views/MobileAccountsView";
import { MobilePlanningView } from "@/components/mobile/views/MobilePlanningView";

// 3. Modals & Action Sheets
import { TransactionFormModal } from "@/components/transactions/TransactionFormModal";
import { MobileNumpadSheet } from "@/components/mobile/sheets/MobileNumpadSheet";
import { ExportImportModal } from "@/components/common/ExportImportModal";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { PWAInstallBanner } from "@/components/common/PWAInstallBanner";
import { PWAUpdateBanner } from "@/components/common/PWAUpdateBanner";
import { ReleaseNotesModal } from "@/components/common/ReleaseNotesModal";
import { ReceiptScannerModal } from "@/components/transactions/ReceiptScannerModal";
import { LoginGateView } from "@/components/auth/LoginGateView";
import { StepUpAuthModal } from "@/components/auth/StepUpAuthModal";
import { QuickAuthGate } from "@/components/auth/QuickAuthGate";
import { MobileNotificationSheet } from "@/components/mobile/sheets/MobileNotificationSheet";
import { MonthlyPdfReportModal } from "@/components/reports/MonthlyPdfReportModal";
import { RecurringReminderBanner } from "@/components/notifications/RecurringReminderBanner";
import { ParsedReceiptResult } from "@/lib/geminiReceiptService";

export default function HomePage() {
  const {
    isLoaded,
    activeApp,
    activeTab,
    skyoneTab,
    activePerspective,
    resetToMockData,
    addTransaction,
    addTransactionsBatch,
    accounts,
    settings,
    isAppLocked,
    hasPasscodeProtection,
    switchSubApp,
  } = useFinance();

  const {
    hasUpdate: hasPWAUpdate,
    isDismissedForSession: isUpdateDismissed,
    status: pwaUpdateStatus,
  } = usePWAUpdate();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isMobileNumpadOpen, setIsMobileNumpadOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isResetStepUpOpen, setIsResetStepUpOpen] = useState(false);
  const [isGlobalScannerOpen, setIsGlobalScannerOpen] = useState(false);
  const [isMobileNotifOpen, setIsMobileNotifOpen] = useState(false);
  const [isPdfReportOpen, setIsPdfReportOpen] = useState(false);

  const { isMobileShell } = useResponsive();

  // Global Alt+1..4 sub-app switcher shortcut (works from Launcher & all 4 Sub-Apps)
  useEffect(() => {
    if (!isLoaded || isAppLocked) return;
    const handleGlobalSubAppShortcut = (event: KeyboardEvent) => {
      if (!event.altKey || event.ctrlKey || event.metaKey) return;
      const targetEl = event.target as HTMLElement | null;
      if (
        targetEl &&
        (targetEl.tagName === "INPUT" ||
          targetEl.tagName === "TEXTAREA" ||
          targetEl.tagName === "SELECT" ||
          targetEl.isContentEditable)
      ) {
        return;
      }
      const targetApp = getEcosystemAppByShortcutDigit(event.key);
      if (targetApp && targetApp !== activeApp) {
        event.preventDefault();
        switchSubApp(targetApp, { restoreLastTab: true });
      }
    };
    window.addEventListener("keydown", handleGlobalSubAppShortcut);
    return () => window.removeEventListener("keydown", handleGlobalSubAppShortcut);
  }, [isLoaded, isAppLocked, activeApp, switchSubApp]);

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-[#F6F8FB] dark:bg-[#0B1220] flex pt-safe pb-safe">
        <aside className="w-64 bg-[#1E3A8A] dark:bg-[#0F172A] dark:border-r dark:border-slate-800 hidden md:block pt-safe pb-safe animate-pulse" />
        <div className="flex-1 flex flex-col">
          <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 pt-safe animate-pulse">
            <div className="h-16 md:h-20" />
          </header>
          <main className="p-4 sm:p-8 space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-28 sm:h-32 bg-slate-200/80 dark:bg-slate-800/80 rounded-xl animate-pulse" />
              ))}
            </div>
            <div className="h-80 bg-slate-200/80 dark:bg-slate-800/80 rounded-xl animate-pulse" />
          </main>
        </div>
      </div>
    );
  }

  if (isAppLocked) {
    return <LoginGateView />;
  }

  const renderMainView = (mobileViewport: boolean) => {
    if (activeApp === "GOLD") {
      return <GoldVaultView />;
    }

    if (activeApp === "INTERIOR") {
      return (
        <InteriorChunkErrorBoundary>
          <Suspense
            fallback={
              <div className="space-y-4">
                <div className="h-20 rounded-xl bg-slate-200/70 dark:bg-slate-800/70 animate-pulse" />
                <div className="h-[520px] rounded-xl bg-slate-200/70 dark:bg-slate-800/70 animate-pulse flex items-center justify-center text-xs font-bold text-slate-500">
                  Đang khởi tạo không gian 3D SKYONE A.12A.07…
                </div>
              </div>
            }
          >
            <LazyInteriorStudioView />
          </Suspense>
        </InteriorChunkErrorBoundary>
      );
    }

    if (activeApp === "SKYONE") {
      if (skyoneTab === "DATA_ADMIN") {
        return (
          <QuickAuthGate viewId="data_admin">
            <DataAdminView />
          </QuickAuthGate>
        );
      }
      if (skyoneTab === "SETTINGS") {
        return (
          <SettingsView
            onOpenBackupModal={() => setIsBackupModalOpen(true)}
            onOpenResetConfirm={() => setIsResetConfirmOpen(true)}
          />
        );
      }
      return <SkyOneLoanView />;
    }

    switch (activeTab) {
      case "overview":
        return mobileViewport ? (
          <MobileOverviewView
            onOpenPdfReport={() => setIsPdfReportOpen(true)}
            onOpenNumpad={() => setIsMobileNumpadOpen(true)}
          />
        ) : (
          <OverviewView
            onOpenPdfReport={() => setIsPdfReportOpen(true)}
            onOpenAddModal={() => setIsAddModalOpen(true)}
          />
        );
      case "transactions":
        return mobileViewport ? (
          <MobileTransactionsView onOpenAddModal={() => setIsMobileNumpadOpen(true)} />
        ) : (
          <TransactionsView
            onOpenAddModal={() => setIsAddModalOpen(true)}
            onOpenBackupModal={() => setIsBackupModalOpen(true)}
          />
        );
      case "accounts":
        return (
          <QuickAuthGate viewId="accounts">
            {mobileViewport ? <MobileAccountsView /> : <AccountsView />}
          </QuickAuthGate>
        );
      case "planning":
        return mobileViewport ? <MobilePlanningView /> : <PlanningView />;
      case "debts_invest":
        return (
          <QuickAuthGate viewId="debts_invest">
            <DebtsInvestView />
          </QuickAuthGate>
        );
      case "data_admin":
        return (
          <QuickAuthGate viewId="data_admin">
            <DataAdminView />
          </QuickAuthGate>
        );
      case "guide":
        return <GuideView />;
      case "settings":
        return (
          <SettingsView
            onOpenBackupModal={() => setIsBackupModalOpen(true)}
            onOpenResetConfirm={() => setIsResetConfirmOpen(true)}
          />
        );
      default:
        return mobileViewport ? (
          <MobileOverviewView
            onOpenPdfReport={() => setIsPdfReportOpen(true)}
            onOpenNumpad={() => setIsMobileNumpadOpen(true)}
          />
        ) : (
          <OverviewView
            onOpenPdfReport={() => setIsPdfReportOpen(true)}
            onOpenAddModal={() => setIsAddModalOpen(true)}
          />
        );
    }
  };

  const handleApplyGlobalReceipt = (receipt: ParsedReceiptResult) => {
    try {
      const targetMember = activePerspective === "WIFE" ? "WIFE" : "HUSBAND";
      const preferredAcc =
        accounts.find((a) => a.owner === targetMember && a.type !== "CREDIT_CARD") || accounts[0];
      addTransaction({
        amount: receipt.amount,
        date: receipt.date || new Date().toISOString().slice(0, 10),
        type: "EXPENSE",
        categoryId: receipt.suggestedCategoryId || "cat_expense_food",
        accountId: preferredAcc?.id || "acc_husband_vietinbank",
        memberId: targetMember,
        scope: "FAMILY",
        note: `${receipt.merchantName}${receipt.notes ? " - " + receipt.notes : ""}`,
      });
    } catch {
      console.warn("Lỗi thêm giao dịch từ hóa đơn");
    }
  };

  const showUpdateBanner =
    pwaUpdateStatus === "UPDATING" ||
    pwaUpdateStatus === "JUST_UPDATED" ||
    (hasPWAUpdate && !isUpdateDismissed);

  const renderDesktopSidebar = () => {
    if (activeApp === "SKYONE") return <SkyOneSidebar />;
    if (activeApp === "GOLD") return <GoldSidebar />;
    if (activeApp === "INTERIOR") return <InteriorSidebar />;
    return <Sidebar />;
  };

  const renderDesktopTopBar = () => {
    if (activeApp === "SKYONE") {
      return <SkyOneTopBar onOpenBackupModal={() => setIsBackupModalOpen(true)} />;
    }
    if (activeApp === "GOLD") {
      return <GoldTopBar onOpenBackupModal={() => setIsBackupModalOpen(true)} />;
    }
    if (activeApp === "INTERIOR") {
      return <InteriorTopBar onOpenBackupModal={() => setIsBackupModalOpen(true)} />;
    }
    return (
      <TopBar
        onOpenAddModal={() => setIsAddModalOpen(true)}
        onOpenBackupModal={() => setIsBackupModalOpen(true)}
        onOpenResetConfirm={() => setIsResetConfirmOpen(true)}
        onOpenScanner={() => setIsGlobalScannerOpen(true)}
      />
    );
  };

  const renderMobileHeader = () => {
    if (activeApp === "SKYONE") {
      return <SkyOneMobileHeader onOpenDrawer={() => setIsMobileMenuOpen(true)} />;
    }
    if (activeApp === "GOLD") {
      return <GoldMobileHeader onOpenDrawer={() => setIsMobileMenuOpen(true)} />;
    }
    if (activeApp === "INTERIOR") {
      return <InteriorMobileHeader onOpenDrawer={() => setIsMobileMenuOpen(true)} />;
    }
    return (
      <MobileHeader
        onOpenDrawer={() => setIsMobileMenuOpen(true)}
        onOpenScanner={() => setIsGlobalScannerOpen(true)}
        onOpenNotifications={() => setIsMobileNotifOpen(true)}
      />
    );
  };

  const renderMobileBottomNav = () => {
    if (activeApp === "SKYONE") return <SkyOneBottomNavBar />;
    if (activeApp === "GOLD") return <GoldBottomNavBar />;
    if (activeApp === "INTERIOR") return <InteriorBottomNavBar />;
    return <BottomNavBar onOpenAddModal={() => setIsMobileNumpadOpen(true)} />;
  };

  return (
    <>
      {showUpdateBanner ? <PWAUpdateBanner /> : <PWAInstallBanner />}

      {activeApp === "LAUNCHER" ? (
        <AppLauncherView onOpenBackupModal={() => setIsBackupModalOpen(true)} />
      ) : !isMobileShell ? (
        /* 1. UNIFIED DESKTOP SHELL (>= 768px) */
        <div className="flex min-h-screen bg-[#F6F8FB] dark:bg-[#0B1220] text-[#172B4D] dark:text-slate-100 font-sans antialiased transition-colors duration-200">
          {renderDesktopSidebar()}
          <div className="flex-1 flex flex-col min-w-0">
            {renderDesktopTopBar()}
            <main className="flex-1 max-w-7xl w-full mx-auto px-6 lg:px-8 py-8">
              {activeApp === "FINANCE" && <RecurringReminderBanner />}
              {renderMainView(false)}
            </main>
          </div>
        </div>
      ) : (
        /* 2. UNIFIED MOBILE SHELL (< 768px) */
        <div className="min-h-screen bg-[#F6F8FB] dark:bg-[#0B1220] text-[#172B4D] dark:text-slate-100 font-sans antialiased pb-safe-main transition-colors duration-200">
          {renderMobileHeader()}

          <main className="p-3.5 space-y-3.5">
            {activeApp === "FINANCE" && <RecurringReminderBanner />}
            {renderMainView(true)}
          </main>

          {renderMobileBottomNav()}
        </div>
      )}

      {/* 3. FINANCE-SCOPED MODALS & SHEETS */}
      {activeApp === "FINANCE" && (
        <>
          <ReceiptScannerModal
            isOpen={isGlobalScannerOpen}
            onClose={() => setIsGlobalScannerOpen(false)}
            onApplyReceipt={handleApplyGlobalReceipt}
            onApplyTransactions={(batch) => addTransactionsBatch(batch)}
          />

          <MobileNotificationSheet
            isOpen={isMobileNotifOpen}
            onClose={() => setIsMobileNotifOpen(false)}
          />

          <MobileNumpadSheet
            isOpen={isMobileNumpadOpen}
            onClose={() => setIsMobileNumpadOpen(false)}
          />

          <TransactionFormModal
            isOpen={isAddModalOpen}
            onClose={() => setIsAddModalOpen(false)}
          />
        </>
      )}

      {/* 4. SHARED SYSTEM MODALS & DRAWER */}
      <MobileDrawer
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />

      <ExportImportModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        onOpenResetDemo={() => setIsResetConfirmOpen(true)}
        onOpenPdfReport={() => setIsPdfReportOpen(true)}
      />

      <MonthlyPdfReportModal
        isOpen={isPdfReportOpen}
        onClose={() => setIsPdfReportOpen(false)}
      />

      <ReleaseNotesModal />

      <ConfirmDialog
        isOpen={isResetConfirmOpen}
        title="Khôi phục toàn bộ dữ liệu mẫu?"
        message="Hệ thống sẽ nạp lại toàn bộ dữ liệu mẫu chuẩn (Tài khoản, Khoản nợ, Đầu tư, Kế hoạch & Giao dịch) theo bộ thiết kế tham khảo. Các thay đổi của bạn sẽ được thiết lập lại."
        confirmLabel="Nạp lại mẫu chuẩn"
        cancelLabel="Hủy"
        isDanger={false}
        onConfirm={() => {
          setIsResetConfirmOpen(false);
          if (settings.requireAuthForDangerActions && hasPasscodeProtection) {
            setIsResetStepUpOpen(true);
          } else {
            resetToMockData();
          }
        }}
        onCancel={() => setIsResetConfirmOpen(false)}
      />

      <StepUpAuthModal
        isOpen={isResetStepUpOpen}
        title="Xác thực khôi phục dữ liệu mẫu"
        description="Thao tác này sẽ đặt lại toàn bộ sổ sách về mẫu mặc định. Nhập mã Code hoặc Face ID để xác nhận."
        onVerified={() => {
          setIsResetStepUpOpen(false);
          resetToMockData();
        }}
        onCancel={() => setIsResetStepUpOpen(false)}
      />
    </>
  );
}
