"use client";

import React, { useState, useEffect } from "react";
import { Lock } from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { usePWAUpdate } from "@/context/PWAUpdateContext";
import { Sidebar } from "@/components/common/Sidebar";
import { TopBar } from "@/components/common/TopBar";
import { MobileDrawer } from "@/components/common/MobileDrawer";
import { BottomNavBar } from "@/components/common/BottomNavBar";

// 1. Desktop Shell Views
import { OverviewView } from "@/components/views/OverviewView";
import { TransactionsView } from "@/components/views/TransactionsView";
import { AccountsView } from "@/components/views/AccountsView";
import { PlanningView } from "@/components/views/PlanningView";
import { DebtsInvestView } from "@/components/views/DebtsInvestView";
import { DataAdminView } from "@/components/views/DataAdminView";
import { GuideView } from "@/components/views/GuideView";
import { SettingsView } from "@/components/views/SettingsView";

// 2. Mobile Shell Views
import { MobileHeader } from "@/components/mobile/MobileHeader";
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
import { ParsedReceiptResult } from "@/lib/geminiReceiptService";

export default function HomePage() {
  const {
    isLoaded,
    activeTab,
    activePerspective,
    resetToMockData,
    addTransaction,
    addTransactionsBatch,
    accounts,
    isAppLocked,
    unlockApp,
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
  const [isGlobalScannerOpen, setIsGlobalScannerOpen] = useState(false);
  const [pinEntry, setPinEntry] = useState("");
  const [pinError, setPinError] = useState(false);

  // Responsive layout detection to prevent mounting hidden DOM tree with 0x0 Recharts containers
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkIsMobile();
    window.addEventListener("resize", checkIsMobile);
    return () => window.removeEventListener("resize", checkIsMobile);
  }, []);

  // Skeleton Loader khi chờ hydrate từ LocalStorage hoặc xác định viewport
  if (!isLoaded || isMobile === null) {
    return (
      <div className="min-h-screen bg-[#F6F8FB] flex">
        <aside className="w-64 bg-[#1E3A8A] hidden md:block animate-pulse" />
        <div className="flex-1 flex flex-col">
          <header className="h-20 bg-white border-b border-slate-200 animate-pulse" />
          <main className="p-8 space-y-6">
            <div className="grid grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-32 bg-slate-200/80 rounded-xl animate-pulse" />
              ))}
            </div>
            <div className="h-80 bg-slate-200/80 rounded-xl animate-pulse" />
          </main>
        </div>
      </div>
    );
  }

  // PIN Lock Gate
  if (isAppLocked) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0F172A] via-[#1E3A8A] to-[#1D4ED8] flex items-center justify-center p-4">
        <div className="w-full max-w-xs bg-white rounded-2xl p-6 shadow-2xl space-y-4 text-center">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-black text-[#172B4D]">HOME MONI Đang Khóa</h1>
            <p className="text-xs text-slate-500 mt-1">
              Nhập mã PIN 4 số để mở sổ tài chính tổ ấm
            </p>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (unlockApp(pinEntry)) {
                setPinEntry("");
                setPinError(false);
              } else {
                setPinError(true);
              }
            }}
            className="space-y-3"
          >
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              autoFocus
              value={pinEntry}
              onChange={(e) => {
                setPinEntry(e.target.value.replace(/[^0-9]/g, "").slice(0, 4));
                setPinError(false);
              }}
              placeholder="••••"
              className="w-full text-center text-2xl font-black tracking-[0.5em] bg-slate-50 border border-slate-200 rounded-xl py-3 outline-none focus:border-blue-600"
            />
            {pinError && (
              <p className="text-xs font-bold text-rose-600">Mã PIN không đúng, vui lòng thử lại.</p>
            )}
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
            >
              Mở khóa
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Luồng render View cho Desktop
  const renderActiveDesktopView = () => {
    switch (activeTab) {
      case "overview":
        return <OverviewView />;
      case "transactions":
        return (
          <TransactionsView
            onOpenAddModal={() => setIsAddModalOpen(true)}
            onOpenBackupModal={() => setIsBackupModalOpen(true)}
          />
        );
      case "accounts":
        return <AccountsView />;
      case "planning":
        return <PlanningView />;
      case "debts_invest":
        return <DebtsInvestView />;
      case "data_admin":
        return <DataAdminView />;
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
        return <OverviewView />;
    }
  };

  // Luồng render View cho Mobile
  const renderActiveMobileView = () => {
    switch (activeTab) {
      case "overview":
        return <MobileOverviewView />;
      case "transactions":
        return (
          <MobileTransactionsView
            onOpenAddModal={() => setIsMobileNumpadOpen(true)}
          />
        );
      case "accounts":
        return <MobileAccountsView />;
      case "planning":
        return <MobilePlanningView />;
      case "debts_invest":
        return <DebtsInvestView />;
      case "data_admin":
        return <DataAdminView />;
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
        return <MobileOverviewView />;
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

  return (
    <>
      {showUpdateBanner ? <PWAUpdateBanner /> : <PWAInstallBanner />}

      {/* 1. DESKTOP VIEW SHELL (>= 768px) */}
      {!isMobile && (
        <div className="flex min-h-screen bg-[#F6F8FB] text-slate-900 font-sans antialiased">
          <Sidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <TopBar
              onOpenAddModal={() => setIsAddModalOpen(true)}
              onOpenBackupModal={() => setIsBackupModalOpen(true)}
              onOpenResetConfirm={() => setIsResetConfirmOpen(true)}
              onToggleMobileMenu={() => setIsMobileMenuOpen(true)}
              onOpenScanner={() => setIsGlobalScannerOpen(true)}
            />
            <main className="flex-1 max-w-7xl w-full mx-auto px-6 lg:px-8 py-8">
              {renderActiveDesktopView()}
            </main>
          </div>
        </div>
      )}

      {/* 2. MOBILE VIEW SHELL (< 768px) */}
      {isMobile && (
        <div className="min-h-screen bg-[#F6F8FB] text-slate-900 font-sans antialiased pb-24">
          <MobileHeader
            onOpenDrawer={() => setIsMobileMenuOpen(true)}
            onOpenScanner={() => setIsGlobalScannerOpen(true)}
          />

          <main className="p-3.5 space-y-3.5">
            {renderActiveMobileView()}
          </main>

          <BottomNavBar onOpenAddModal={() => setIsMobileNumpadOpen(true)} />
        </div>
      )}

      {/* 3. GLOBAL MODALS & BOTTOM SHEETS */}
      <ReceiptScannerModal
        isOpen={isGlobalScannerOpen}
        onClose={() => setIsGlobalScannerOpen(false)}
        onApplyReceipt={handleApplyGlobalReceipt}
        onApplyTransactions={(batch) => addTransactionsBatch(batch)}
      />

      <MobileDrawer
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />

      <MobileNumpadSheet
        isOpen={isMobileNumpadOpen}
        onClose={() => setIsMobileNumpadOpen(false)}
      />

      <TransactionFormModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />

      <ExportImportModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        onOpenResetDemo={() => setIsResetConfirmOpen(true)}
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
          resetToMockData();
          setIsResetConfirmOpen(false);
        }}
        onCancel={() => setIsResetConfirmOpen(false)}
      />
    </>
  );
}
