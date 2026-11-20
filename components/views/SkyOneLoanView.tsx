"use client";

import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Calendar,
  CheckCircle2,
  Clock,
  Wallet,
  X,
} from "lucide-react";
import { SkyOneAdvisorView } from "@/components/views/SkyOneAdvisorView";
import { SkyOneOverviewTab } from "@/components/skyone/tabs/SkyOneOverviewTab";
import { SkyOneScheduleTab } from "@/components/skyone/tabs/SkyOneScheduleTab";
import { SkyOnePrepaymentTab } from "@/components/skyone/tabs/SkyOnePrepaymentTab";
import { SkyOneContractTab } from "@/components/skyone/tabs/SkyOneContractTab";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { useFinance } from "@/context/FinanceContext";
import { useResponsive } from "@/src/hooks/useResponsive";
import { formatDateVN, formatVNDMasked } from "@/lib/formatters";
import {
  applyActualPaymentDateOverrides,
  calculateFamilyMonthlyIncome,
  calculateRateStressTest,
  calculateRealEstateMetrics,
  calculateSkyOneTabMetrics,
  evaluateSkyOneReminders,
  generateMortgageSchedule,
  getTodayIsoDate,
  isValidIsoDate,
} from "@/lib/mortgageEngine";
import { MortgagePrepayStrategy, SkyOneSubTab } from "@/types/finance";

interface PendingConfirmState {
  kind: "PERIODS" | "PREPAYMENT";
  periods?: number[];
  prepayAmount?: number;
  prepayAfterPeriod?: number;
  prepayStrategy?: MortgagePrepayStrategy;
  title: string;
  description: string;
  totalCashOutflow: number;
}

export function SkyOneLoanView() {
  const {
    skyoneLoan,
    skyoneAutoSyncedNotice,
    dismissSkyoneAutoSyncedNotice,
    skyoneTab,
    setSkyoneTab,
    skyoneHighlightPeriod,
    clearSkyoneHighlightPeriod,
    transactions,
    accounts,
    selectedMonth,
    themeMode,
    isPrivacyMode,
    updateSkyOneContract,
    setSkyOneCashflowLocked,
    saveAndLockSkyOneCashflow,
    toggleSkyOnePinkBook5Pct,
    confirmSkyOnePeriods,
    undoSkyOnePeriod,
    addSkyOnePrepayment,
    deleteSkyOnePrepayment,
    addSkyOneRateAdjustment,
    deleteSkyOneRateAdjustment,
    resetSkyOneLoan,
  } = useFinance();

  const isDark = themeMode === "dark";
  const { isMobile } = useResponsive();

  const subTab: SkyOneSubTab =
    skyoneTab === "ADVISOR" ||
    skyoneTab === "SCHEDULE" ||
    skyoneTab === "PREPAYMENT" ||
    skyoneTab === "CONTRACT"
      ? skyoneTab
      : "OVERVIEW";

  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);
  const [dismissedReminderIds, setDismissedReminderIds] = useState<string[]>([]);

  // Payment / Prepayment Confirmation Modal (Independent default + Opt-in Wallet link)
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirmState | null>(null);
  const [confirmPaidDate, setConfirmPaidDate] = useState<string>(() => getTodayIsoDate());
  const [confirmNote, setConfirmNote] = useState<string>("");
  const [linkToWallet, setLinkToWallet] = useState<boolean>(false);
  const [linkAccountId, setLinkAccountId] = useState<string>("");

  // Single BIDV A.12A.07 Reset / Sync Confirmation Modal (triggered from Contract tab)
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  const nonCreditAccounts = useMemo(
    () => accounts.filter((a) => a.type !== "CREDIT_CARD"),
    [accounts]
  );

  // Core Shared Calculations (Single Source of Truth across all 5 tabs)
  const schedule = useMemo(() => generateMortgageSchedule(skyoneLoan), [skyoneLoan]);

  const incomeInfo = useMemo(
    () => calculateFamilyMonthlyIncome(transactions, selectedMonth),
    [transactions, selectedMonth]
  );

  const realEstateMetrics = useMemo(
    () =>
      calculateRealEstateMetrics(
        skyoneLoan,
        schedule,
        incomeInfo.monthlyIncome,
        incomeInfo.sourceLabel
      ),
    [skyoneLoan, schedule, incomeInfo]
  );

  const stressScenarios = useMemo(
    () =>
      calculateRateStressTest(
        skyoneLoan,
        schedule,
        incomeInfo.monthlyIncome,
        [0, 1, 2, 3]
      ),
    [skyoneLoan, schedule, incomeInfo.monthlyIncome]
  );

  const internalReminders = useMemo(
    () => evaluateSkyOneReminders(skyoneLoan, schedule),
    [skyoneLoan, schedule]
  );

  const visibleReminders = useMemo(
    () => internalReminders.filter((item) => !dismissedReminderIds.includes(item.id)),
    [internalReminders, dismissedReminderIds]
  );

  const tabMetrics = useMemo(
    () => calculateSkyOneTabMetrics(skyoneLoan, schedule),
    [skyoneLoan, schedule]
  );

  const showToast = (msg: string) => {
    setStatusFeedback(msg);
    setTimeout(() => setStatusFeedback(null), 4500);
  };

  const openConfirmPeriodsModal = (periods: number[]) => {
    const unpaidTargets = schedule.rows.filter(
      (r) => periods.includes(r.period) && r.status !== "PAID"
    );
    if (unpaidTargets.length === 0) return;

    const totalCash = unpaidTargets.reduce((s, r) => s + r.totalPayment, 0);
    const defaultAccId =
      nonCreditAccounts.find((a) => a.owner === "HUSBAND")?.id ||
      nonCreditAccounts[0]?.id ||
      "";

    // Mặc định lấy đúng Ngày trả của kỳ khi xác nhận đơn kỳ để tính Actual/365 chuẩn ngay từ đầu
    setConfirmPaidDate(
      unpaidTargets.length === 1 ? unpaidTargets[0].dueDate : getTodayIsoDate()
    );
    setConfirmNote(
      unpaidTargets.length === 1
        ? `Thanh toán kỳ #${unpaidTargets[0].period}`
        : `Thanh toán gộp ${unpaidTargets.length} kỳ`
    );
    setLinkToWallet(false);
    setLinkAccountId(defaultAccId);
    setPendingConfirm({
      kind: "PERIODS",
      periods: unpaidTargets.map((r) => r.period),
      title:
        unpaidTargets.length === 1
          ? `Xác nhận đóng kỳ #${unpaidTargets[0].period}`
          : `Xác nhận đóng ${unpaidTargets.length} kỳ đã chọn`,
      description:
        unpaidTargets.length === 1
          ? `Ngày trả ${formatDateVN(unpaidTargets[0].dueDate)} · Gốc ${formatVNDMasked(
              unpaidTargets[0].principal,
              isPrivacyMode
            )} + Lãi ${formatVNDMasked(unpaidTargets[0].interest, isPrivacyMode)}.`
          : `Tổng thanh toán ${unpaidTargets.length} kỳ từ kỳ #${unpaidTargets[0].period} đến kỳ #${
              unpaidTargets[unpaidTargets.length - 1].period
            }.`,
      totalCashOutflow: totalCash,
    });
  };

  // Tính lại trực tiếp số tiền gốc + lãi Actual/365 khi người dùng đổi Ngày thanh toán trong hộp thoại
  const confirmPeriodsPreview = useMemo(() => {
    if (!pendingConfirm || pendingConfirm.kind !== "PERIODS" || !pendingConfirm.periods?.length) {
      return null;
    }
    const validDate = isValidIsoDate(confirmPaidDate);
    if (!validDate) {
      return {
        rows: [],
        totalPrincipal: 0,
        totalInterest: 0,
        totalCashOutflow: pendingConfirm.totalCashOutflow,
        invalidRow: null as (typeof schedule.rows)[number] | null,
        isDateInvalid: true,
        invalidMessage: "Vui lòng chọn Ngày thanh toán hợp lệ.",
      };
    }

    const previewContract = applyActualPaymentDateOverrides(
      skyoneLoan,
      pendingConfirm.periods,
      confirmPaidDate
    );
    const previewSchedule = generateMortgageSchedule(previewContract);
    const periodSet = new Set(pendingConfirm.periods);
    const targetRows = previewSchedule.rows.filter(
      (r) => periodSet.has(r.period) && r.status !== "PAID"
    );
    const invalidRow = targetRows.find((r) => r.isDateOrderInvalid) || null;
    const totalPrincipal = targetRows.reduce((s, r) => s + r.principal, 0);
    const totalInterest = targetRows.reduce((s, r) => s + r.interest, 0);

    return {
      rows: targetRows,
      totalPrincipal,
      totalInterest,
      totalCashOutflow: totalPrincipal + totalInterest,
      invalidRow,
      isDateInvalid: Boolean(invalidRow),
      invalidMessage: invalidRow
        ? `Ngày thanh toán kỳ #${invalidRow.period} phải sau ${formatDateVN(
            invalidRow.interestStartDate
          )} để tính lãi Actual/365.`
        : null,
    };
  }, [pendingConfirm, confirmPaidDate, skyoneLoan]);

  const openConfirmPrepaymentModal = (input: {
    amount: number;
    afterPeriod: number;
    strategy: MortgagePrepayStrategy;
    date: string;
    note: string;
    penaltyAmount: number;
    penaltyFeePercent: number;
    netInterestSaved: number;
    remainingBalanceBefore: number;
  }) => {
    const defaultAccId =
      nonCreditAccounts.find((a) => a.owner === "HUSBAND")?.id ||
      nonCreditAccounts[0]?.id ||
      "";
    const appliedPrincipal = Math.min(input.amount, input.remainingBalanceBefore);
    setConfirmPaidDate(input.date);
    setConfirmNote(input.note);
    setLinkToWallet(false);
    setLinkAccountId(defaultAccId);
    setPendingConfirm({
      kind: "PREPAYMENT",
      prepayAmount: input.amount,
      prepayAfterPeriod: input.afterPeriod,
      prepayStrategy: input.strategy,
      title: "Xác nhận lưu đợt trả gốc trước hạn",
      description: `Trả gốc ${formatVNDMasked(appliedPrincipal, isPrivacyMode)} (sau kỳ #${
        input.afterPeriod
      }) + phí phạt ${formatVNDMasked(input.penaltyAmount, isPrivacyMode)} (${
        input.penaltyFeePercent
      }%). Tiết kiệm lãi ròng dự kiến ${formatVNDMasked(
        input.netInterestSaved,
        isPrivacyMode
      )}.`,
      totalCashOutflow: appliedPrincipal + input.penaltyAmount,
    });
  };

  const executePendingConfirm = () => {
    if (!pendingConfirm) return;
    if (pendingConfirm.kind === "PERIODS" && confirmPeriodsPreview?.isDateInvalid) {
      return;
    }
    const accountToLink = linkToWallet && linkAccountId ? linkAccountId : undefined;

    if (pendingConfirm.kind === "PERIODS" && pendingConfirm.periods) {
      const count = confirmSkyOnePeriods(pendingConfirm.periods, {
        paidAt: confirmPaidDate,
        note: confirmNote.trim() || undefined,
        linkAccountId: accountToLink,
      });
      showToast(
        accountToLink
          ? `Đã xác nhận ${count} kỳ và ghi khoản chi vào Sổ giao dịch.`
          : `Đã xác nhận ${count} kỳ trên lịch vay Phú Đông SKYONE (theo dõi độc lập).`
      );
    } else if (pendingConfirm.kind === "PREPAYMENT" && pendingConfirm.prepayAmount) {
      addSkyOnePrepayment({
        amount: pendingConfirm.prepayAmount,
        afterPeriod: pendingConfirm.prepayAfterPeriod,
        strategy: pendingConfirm.prepayStrategy || "SHORTEN_TERM",
        date: confirmPaidDate,
        note: confirmNote.trim() || undefined,
        linkAccountId: accountToLink,
      });
      showToast(
        accountToLink
          ? "Đã ghi nhận đợt trả gốc trước hạn và trừ ví trong Sổ giao dịch."
          : "Đã ghi nhận đợt trả gốc trước hạn vào lịch sử căn hộ."
      );
    }

    setPendingConfirm(null);
  };

  return (
    <div className="space-y-5 sm:space-y-6 animate-in fade-in duration-200">
      {/* Toast Feedback */}
      {statusFeedback && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs sm:text-sm font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{statusFeedback}</span>
        </div>
      )}

      {/* Auto-Synced A.12A.07 / BIDV Banner */}
      {skyoneAutoSyncedNotice && (
        <div className="p-3.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200 text-xs sm:text-sm font-semibold flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <BadgeCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span>{skyoneAutoSyncedNotice}</span>
          </div>
          <button
            type="button"
            onClick={dismissSkyoneAutoSyncedNotice}
            aria-label="Đóng thông báo đồng bộ BIDV"
            className="p-1 rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-900/60 shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Cross-Tab Urgent Reminder Stack */}
      {visibleReminders.length > 0 && (
        <section aria-label="Nhắc lịch thanh toán Phú Đông SKYONE" className="space-y-2">
          {visibleReminders.map((item) => (
            <div
              key={item.id}
              data-testid="skyone-reminder-banner"
              className={`rounded-xl border p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                item.severity === "danger"
                  ? "bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200"
                  : item.severity === "warning"
                  ? "bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800 text-amber-950 dark:text-amber-200"
                  : "bg-slate-50 dark:bg-slate-900 border-[#DCE4EE] dark:border-slate-800 text-slate-800 dark:text-slate-200"
              }`}
            >
              <div className="flex items-start gap-2.5 min-w-0">
                {item.severity === "danger" ? (
                  <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                ) : item.severity === "warning" ? (
                  <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                ) : (
                  <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-extrabold">{item.title}</p>
                  <p className="text-xs opacity-90 mt-0.5 leading-relaxed">{item.message}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                {item.targetPeriod && (
                  <button
                    type="button"
                    onClick={() => setSkyoneTab("SCHEDULE", item.targetPeriod)}
                    className="min-h-[38px] px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                  >
                    <span>Tới kỳ #{item.targetPeriod}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDismissedReminderIds((prev) => [...prev, item.id])}
                  aria-label="Đóng thông báo nhắc lịch"
                  data-testid="skyone-reminder-close"
                  className="min-h-[38px] min-w-[38px] p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 inline-flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* 5 UNIFIED MODULAR SUB-TABS */}
      {subTab === "OVERVIEW" && (
        <SkyOneOverviewTab
          contract={skyoneLoan}
          schedule={schedule}
          realEstateMetrics={realEstateMetrics}
          stressScenarios={stressScenarios}
          isPrivacyMode={isPrivacyMode}
          isDark={isDark}
          isMobile={isMobile}
          onConfirmNextPeriod={(period) => openConfirmPeriodsModal([period])}
          onOpenAdvisor={() => setSkyoneTab("ADVISOR")}
          onOpenContract={() => setSkyoneTab("CONTRACT")}
        />
      )}

      {subTab === "ADVISOR" && <SkyOneAdvisorView hideAutoSyncNotice />}

      {subTab === "SCHEDULE" && (
        <SkyOneScheduleTab
          contract={skyoneLoan}
          schedule={schedule}
          tabMetrics={tabMetrics}
          isPrivacyMode={isPrivacyMode}
          highlightPeriod={skyoneHighlightPeriod}
          onClearHighlightPeriod={clearSkyoneHighlightPeriod}
          onSetCashflowLocked={setSkyOneCashflowLocked}
          onSaveAndLockOverrides={(overrides) => {
            saveAndLockSkyOneCashflow({ periodOverrides: overrides });
            showToast("Đã lưu điều chỉnh từng kỳ và khóa bảo vệ số liệu sao kê.");
          }}
          onOpenConfirmPeriods={openConfirmPeriodsModal}
          onUndoPeriod={undoSkyOnePeriod}
        />
      )}

      {subTab === "PREPAYMENT" && (
        <SkyOnePrepaymentTab
          contract={skyoneLoan}
          schedule={schedule}
          tabMetrics={tabMetrics}
          isPrivacyMode={isPrivacyMode}
          onRequestConfirmPrepayment={openConfirmPrepaymentModal}
          onDeletePrepayment={deleteSkyOnePrepayment}
        />
      )}

      {subTab === "CONTRACT" && (
        <SkyOneContractTab
          contract={skyoneLoan}
          schedule={schedule}
          tabMetrics={tabMetrics}
          isPrivacyMode={isPrivacyMode}
          onUpdateContract={updateSkyOneContract}
          onTogglePinkBook5Pct={toggleSkyOnePinkBook5Pct}
          onAddRateAdjustment={addSkyOneRateAdjustment}
          onDeleteRateAdjustment={deleteSkyOneRateAdjustment}
          onRequestResetBidv={() => setIsResetModalOpen(true)}
          onShowToast={showToast}
        />
      )}

      {/* SHARED PAYMENT / PREPAYMENT CONFIRMATION MODAL */}
      {pendingConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setPendingConfirm(null)}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-700 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-[#E9EEF5] dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60">
              <h3 className="text-base font-extrabold text-[#0F172A] dark:text-slate-100">
                {pendingConfirm.title}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed tabular-nums">
                {confirmPeriodsPreview && confirmPeriodsPreview.rows.length === 1
                  ? `Ngày trả ${formatDateVN(confirmPeriodsPreview.rows[0].dueDate)} (${
                      confirmPeriodsPreview.rows[0].dayCountUsed
                    } ngày Actual/365) · Gốc ${formatVNDMasked(
                      confirmPeriodsPreview.rows[0].principal,
                      isPrivacyMode
                    )} + Lãi ${formatVNDMasked(
                      confirmPeriodsPreview.rows[0].interest,
                      isPrivacyMode
                    )}.`
                  : pendingConfirm.description}
              </p>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-blue-900 dark:text-blue-200">
                    Tổng số tiền thực chi
                  </span>
                  <span className="text-base font-black text-[#1E3A8A] dark:text-blue-300 tabular-nums">
                    {formatVNDMasked(
                      confirmPeriodsPreview
                        ? confirmPeriodsPreview.totalCashOutflow
                        : pendingConfirm.totalCashOutflow,
                      isPrivacyMode
                    )}
                  </span>
                </div>
                {confirmPeriodsPreview && confirmPeriodsPreview.rows.length > 0 && (
                  <p className="text-[11px] text-blue-800/85 dark:text-blue-300/85 tabular-nums">
                    Gốc {formatVNDMasked(confirmPeriodsPreview.totalPrincipal, isPrivacyMode)} + Lãi{" "}
                    {formatVNDMasked(confirmPeriodsPreview.totalInterest, isPrivacyMode)} (tự tính theo Actual/365)
                  </p>
                )}
              </div>

              {confirmPeriodsPreview?.invalidMessage && (
                <div
                  role="alert"
                  className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-semibold flex items-start gap-2 tabular-nums"
                >
                  <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <span>{confirmPeriodsPreview.invalidMessage}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">
                    Ngày thanh toán (Ngày trả)
                  </label>
                  <input
                    type="date"
                    value={confirmPaidDate}
                    onChange={(e) => setConfirmPaidDate(e.target.value)}
                    className={`w-full min-h-[40px] px-3 rounded-lg bg-slate-50 dark:bg-slate-800 border font-semibold tabular-nums ${
                      confirmPeriodsPreview?.isDateInvalid
                        ? "border-rose-500 text-rose-700 dark:text-rose-300"
                        : "border-[#DCE4EE] dark:border-slate-700 text-slate-800 dark:text-slate-100"
                    }`}
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">
                    Ghi chú
                  </label>
                  <input
                    type="text"
                    value={confirmNote}
                    onChange={(e) => setConfirmNote(e.target.value)}
                    className="w-full min-h-[40px] px-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 font-semibold text-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-[#E9EEF5] dark:border-slate-700 space-y-2.5">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={linkToWallet}
                    onChange={(e) => setLinkToWallet(e.target.checked)}
                    className="w-4 h-4 accent-blue-600 mt-0.5 shrink-0"
                  />
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-100 block">
                      Ghi kèm khoản chi vào Sổ giao dịch &amp; trừ ví sinh hoạt
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                      {linkToWallet
                        ? "Sẽ tự động tạo giao dịch Chi (tag Nợ) và trừ số dư ví bên dưới."
                        : "Mặc định tắt: chỉ theo dõi độc lập trên lịch Phú Đông SKYONE, không làm lệch ví chi tiêu."}
                    </span>
                  </div>
                </label>

                {linkToWallet && (
                  <div className="pt-1">
                    <label className="font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5 mb-1">
                      <Wallet className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      <span>Chọn ví thanh toán</span>
                    </label>
                    <select
                      value={linkAccountId}
                      onChange={(e) => setLinkAccountId(e.target.value)}
                      className="w-full min-h-[40px] px-3 rounded-lg bg-white dark:bg-slate-900 border border-[#DCE4EE] dark:border-slate-700 font-semibold text-slate-800 dark:text-slate-100"
                    >
                      {nonCreditAccounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name} ({formatVNDMasked(acc.currentBalance, isPrivacyMode)})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setPendingConfirm(null)}
                  className="min-h-[44px] px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={Boolean(confirmPeriodsPreview?.isDateInvalid)}
                  onClick={executePendingConfirm}
                  className="flex-1 min-h-[44px] px-4 py-2 rounded-lg bg-[#1E3A8A] hover:bg-blue-900 dark:bg-blue-600 dark:hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold cursor-pointer"
                >
                  Xác nhận lưu
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SINGLE CENTRALIZED A.12A.07 & BIDV RESET CONFIRMATION MODAL */}
      <ConfirmDialog
        isOpen={isResetModalOpen}
        title="Khôi phục chuẩn HĐMB A.12A.07 & BIDV?"
        message="Hệ thống sẽ đặt lại thông số gốc căn hộ A.12A.07 (HĐMB 1.573.480.430 đ · Tự có 5 đợt 323.655.950 đ · Đợt 1 BIDV 708.066.194 đ · Đợt 2 Q3/2027 393.370.110 đ · Lãi 5,5%/năm cố định 36 tháng tới 08/2028) cùng đủ 15 kỳ gốc đều 3.056.000 đ/kỳ (3 kỳ đầu + 12 kỳ sao kê xác thực → dư nợ 662.226.194 đ). Giao dịch trên HOME MONI không bị ảnh hưởng."
        confirmLabel="Khôi phục chuẩn A.12A.07"
        cancelLabel="Hủy"
        isDanger={false}
        onConfirm={() => {
          resetSkyOneLoan();
          setIsResetModalOpen(false);
          showToast(
            "Đã khôi phục chuẩn hồ sơ HĐMB A.12A.07 & BIDV (Đợt 1: 708,07tr · 15 kỳ khớp dư nợ 662,23tr)."
          );
        }}
        onCancel={() => setIsResetModalOpen(false)}
      />
    </div>
  );
}
