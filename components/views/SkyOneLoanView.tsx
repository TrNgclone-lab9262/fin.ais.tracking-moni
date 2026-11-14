"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Building2,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  SlidersHorizontal,
  Plus,
  Trash2,
  RotateCcw,
  ArrowRight,
  Check,
  Undo2,
  Percent,
  Wallet,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { SkyOneAmortizationChart } from "@/components/dashboard/SkyOneAmortizationChart";
import { SkyOneCashflowScheduleTable } from "@/components/dashboard/SkyOneCashflowScheduleTable";
import { useFinance } from "@/context/FinanceContext";
import {
  formatVNDMasked,
  formatShortVNDMasked,
  formatDateVN,
} from "@/lib/formatters";
import {
  generateMortgageSchedule,
  simulatePrepayment,
  calculateFamilyMonthlyIncome,
  calculateRealEstateMetrics,
  calculateRateStressTest,
  evaluateSkyOneReminders,
  getTodayIsoDate,
  MortgageScheduleRow,
} from "@/lib/mortgageEngine";
import {
  MortgageContract,
  MortgagePrepayStrategy,
  MortgageStage,
  SkyOneSubTab,
} from "@/types/finance";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";

type ScheduleStatusFilter = "ALL" | "UNPAID" | "PAID" | "DUE_OR_OVERDUE";
type ScheduleStageFilter = "ALL" | MortgageStage;

interface PendingConfirmState {
  kind: "PERIODS" | "PREPAYMENT";
  periods?: number[];
  prepayAmount?: number;
  prepayAfterPeriod?: number;
  prepayStrategy?: MortgagePrepayStrategy;
  prepayDate?: string;
  prepayNote?: string;
  title: string;
  description: string;
  totalCashOutflow: number;
}

function parseNumericInput(val: string): number {
  const cleaned = val.replace(/[^0-9]/g, "");
  return cleaned ? parseInt(cleaned, 10) : 0;
}

export function SkyOneLoanView() {
  const {
    skyoneLoan,
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
    confirmSkyOnePeriods,
    undoSkyOnePeriod,
    addSkyOnePrepayment,
    deleteSkyOnePrepayment,
    addSkyOneRateAdjustment,
    deleteSkyOneRateAdjustment,
    resetSkyOneLoan,
  } = useFinance();
  const isDark = themeMode === "dark";

  const subTab: SkyOneSubTab =
    skyoneTab === "CASHFLOW" ||
    skyoneTab === "SCHEDULE" ||
    skyoneTab === "PREPAYMENT" ||
    skyoneTab === "CONTRACT"
      ? skyoneTab
      : "OVERVIEW";

  const setSubTab = (tab: SkyOneSubTab) => {
    if (tab === "CONTRACT") {
      setContractDraft(skyoneLoan);
      setIsContractDirty(false);
    }
    setSkyoneTab(tab);
  };

  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);

  // Schedule Filters & Batch selection
  const [statusFilter, setStatusFilter] = useState<ScheduleStatusFilter>("ALL");
  const [stageFilter, setStageFilter] = useState<ScheduleStageFilter>("ALL");
  const [yearFilter, setYearFilter] = useState<string>("ALL");
  const [selectedPeriods, setSelectedPeriods] = useState<number[]>([]);
  const [highlightedPeriod, setHighlightedPeriod] = useState<number | null>(null);
  const rowRefs = useRef<Record<number, HTMLElement | null>>({});

  // Prepayment Simulator State
  const [prepayAmountStr, setPrepayAmountStr] = useState<string>("100.000.000");
  const [prepayStrategy, setPrepayStrategy] = useState<MortgagePrepayStrategy>(
    skyoneLoan.prepayStrategyDefault
  );
  const [prepayDate, setPrepayDate] = useState<string>(() => getTodayIsoDate());
  const [prepayNote, setPrepayNote] = useState<string>("");

  // Contract Editing State (Draft synced lazily via button or reset)
  const [contractDraft, setContractDraft] = useState<MortgageContract>(() => skyoneLoan);
  const [isContractDirty, setIsContractDirty] = useState(false);

  useEffect(() => {
    if (skyoneHighlightPeriod && skyoneHighlightPeriod > 0) {
      setStatusFilter("ALL");
      setStageFilter("ALL");
      setYearFilter("ALL");
      setHighlightedPeriod(skyoneHighlightPeriod);
      const scrollTimer = setTimeout(() => {
        const targetEl = rowRefs.current[skyoneHighlightPeriod];
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        clearSkyoneHighlightPeriod();
      }, 150);
      const clearTimer = setTimeout(() => setHighlightedPeriod(null), 3500);
      return () => {
        clearTimeout(scrollTimer);
        clearTimeout(clearTimer);
      };
    }
  }, [skyoneHighlightPeriod, clearSkyoneHighlightPeriod]);

  // Bank Rate Adjustment Form State
  const [adjFromPeriod, setAdjFromPeriod] = useState<string>(() =>
    String(skyoneLoan.fixedRateMonths + 1)
  );
  const [adjRate, setAdjRate] = useState<string>("10.2");
  const [adjDate, setAdjDate] = useState<string>(() => getTodayIsoDate());
  const [adjNote, setAdjNote] = useState<string>("");

  // Payment Confirmation Modal (Independent default + Opt-in Wallet link)
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirmState | null>(null);
  const [confirmPaidDate, setConfirmPaidDate] = useState<string>(() => getTodayIsoDate());
  const [confirmNote, setConfirmNote] = useState<string>("");
  const [linkToWallet, setLinkToWallet] = useState<boolean>(false);
  const [linkAccountId, setLinkAccountId] = useState<string>("");

  // Reset confirmation
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  const nonCreditAccounts = useMemo(
    () => accounts.filter((a) => a.type !== "CREDIT_CARD"),
    [accounts]
  );

  // Core Calculations
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

  const prepayAmount = parseNumericInput(prepayAmountStr);
  const prepayAfterPeriod = useMemo(() => {
    if (skyoneLoan.paidRecords.length === 0) return 0;
    return Math.max(...skyoneLoan.paidRecords.map((r) => r.period));
  }, [skyoneLoan.paidRecords]);

  const prepaySimulation = useMemo(
    () =>
      simulatePrepayment(skyoneLoan, {
        amount: prepayAmount,
        afterPeriod: prepayAfterPeriod,
        strategy: prepayStrategy,
        referenceDate: prepayDate,
      }),
    [skyoneLoan, prepayAmount, prepayAfterPeriod, prepayStrategy, prepayDate]
  );

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    schedule.rows.forEach((r) => years.add(r.yearIndex));
    return Array.from(years).sort((a, b) => a - b);
  }, [schedule.rows]);

  const filteredRows = useMemo(() => {
    return schedule.rows.filter((row) => {
      if (statusFilter === "UNPAID" && row.status === "PAID") return false;
      if (statusFilter === "PAID" && row.status !== "PAID") return false;
      if (
        statusFilter === "DUE_OR_OVERDUE" &&
        row.status !== "OVERDUE" &&
        row.status !== "DUE_SOON"
      ) {
        return false;
      }
      if (stageFilter !== "ALL" && row.stage !== stageFilter) return false;
      if (yearFilter !== "ALL" && String(row.yearIndex) !== yearFilter) return false;
      return true;
    });
  }, [schedule.rows, statusFilter, stageFilter, yearFilter]);

  const chartYearlyData = useMemo(() => {
    return schedule.yearlySummary.map((y) => ({
      name: y.label,
      principal: y.principalPaid,
      interest: y.interestPaid,
      remainingBalance: y.endingBalance,
      equity: y.cumulativeEquity,
    }));
  }, [schedule.yearlySummary]);

  const principalProgressPct = useMemo(() => {
    if (skyoneLoan.loanAmount <= 0) return 0;
    const paidLoanPrincipal = Math.max(0, skyoneLoan.loanAmount - schedule.remainingBalance);
    return Math.min(100, Math.round((paidLoanPrincipal / skyoneLoan.loanAmount) * 1000) / 10);
  }, [skyoneLoan.loanAmount, schedule.remainingBalance]);

  const showToast = (msg: string) => {
    setStatusFeedback(msg);
    setTimeout(() => setStatusFeedback(null), 4000);
  };

  const jumpToPeriod = (period: number) => {
    setSubTab("SCHEDULE");
    setStatusFilter("ALL");
    setStageFilter("ALL");
    setYearFilter("ALL");
    setHighlightedPeriod(period);
    setTimeout(() => {
      const targetEl = rowRefs.current[period];
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 100);
    setTimeout(() => setHighlightedPeriod(null), 3500);
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

    setConfirmPaidDate(getTodayIsoDate());
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
          ? `Kỳ hạn ${formatDateVN(unpaidTargets[0].dueDate)} · Gốc ${formatVNDMasked(
              unpaidTargets[0].principal,
              isPrivacyMode
            )} + Lãi ${formatVNDMasked(unpaidTargets[0].interest, isPrivacyMode)}.`
          : `Tổng thanh toán ${unpaidTargets.length} kỳ từ kỳ #${unpaidTargets[0].period} đến kỳ #${
              unpaidTargets[unpaidTargets.length - 1].period
            }.`,
      totalCashOutflow: totalCash,
    });
  };

  const openConfirmPrepaymentModal = () => {
    if (prepayAmount <= 0 || schedule.remainingBalance <= 0) return;
    const defaultAccId =
      nonCreditAccounts.find((a) => a.owner === "HUSBAND")?.id ||
      nonCreditAccounts[0]?.id ||
      "";
    setConfirmPaidDate(prepayDate);
    setConfirmNote(prepayNote);
    setLinkToWallet(false);
    setLinkAccountId(defaultAccId);
    setPendingConfirm({
      kind: "PREPAYMENT",
      prepayAmount,
      prepayAfterPeriod,
      prepayStrategy,
      prepayDate,
      prepayNote,
      title: "Xác nhận lưu đợt trả gốc trước hạn",
      description: `Trả gốc ${formatVNDMasked(
        Math.min(prepayAmount, prepaySimulation.remainingBalanceBefore),
        isPrivacyMode
      )} + phí phạt ${formatVNDMasked(
        prepaySimulation.penaltyAmount,
        isPrivacyMode
      )} (${prepaySimulation.penaltyFeePercent}%). Tiết kiệm lãi ròng dự kiến ${formatVNDMasked(
        prepaySimulation.netInterestSaved,
        isPrivacyMode
      )}.`,
      totalCashOutflow:
        Math.min(prepayAmount, prepaySimulation.remainingBalanceBefore) +
        prepaySimulation.penaltyAmount,
    });
  };

  const executePendingConfirm = () => {
    if (!pendingConfirm) return;
    const accountToLink = linkToWallet && linkAccountId ? linkAccountId : undefined;

    if (pendingConfirm.kind === "PERIODS" && pendingConfirm.periods) {
      const count = confirmSkyOnePeriods(pendingConfirm.periods, {
        paidAt: confirmPaidDate,
        note: confirmNote.trim() || undefined,
        linkAccountId: accountToLink,
      });
      setSelectedPeriods([]);
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
      setPrepayNote("");
      showToast(
        accountToLink
          ? "Đã ghi nhận đợt trả gốc trước hạn và trừ ví trong Sổ giao dịch."
          : "Đã ghi nhận đợt trả gốc trước hạn vào lịch sử căn hộ."
      );
    }

    setPendingConfirm(null);
  };

  const togglePeriodSelection = (period: number) => {
    setSelectedPeriods((prev) =>
      prev.includes(period) ? prev.filter((p) => p !== period) : [...prev, period]
    );
  };

  const selectUpToCurrentPeriods = () => {
    const dueRows = schedule.rows
      .filter((r) => r.status === "OVERDUE" || r.status === "DUE_SOON")
      .map((r) => r.period);
    if (dueRows.length > 0) {
      setSelectedPeriods(dueRows);
    } else if (schedule.nextUnpaidInstallment) {
      setSelectedPeriods([schedule.nextUnpaidInstallment.period]);
    }
  };

  const handleSaveContract = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTerm = Math.max(12, Math.min(420, contractDraft.termMonths));
    const cleanPayDay = Math.max(1, Math.min(28, contractDraft.paymentDayOfMonth));
    const cleanFixedMonths = Math.max(0, Math.min(cleanTerm, contractDraft.fixedRateMonths));

    updateSkyOneContract({
      ...contractDraft,
      termMonths: cleanTerm,
      paymentDayOfMonth: cleanPayDay,
      fixedRateMonths: cleanFixedMonths,
    });
    setIsContractDirty(false);
    showToast("Đã cập nhật thông số hợp đồng vay Phú Đông SKYONE.");
  };

  const handleAddRateAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    const fromP = Math.max(1, parseInt(adjFromPeriod, 10) || 1);
    const rateVal = Math.max(0.1, Math.min(35, parseFloat(adjRate) || 0));
    addSkyOneRateAdjustment({
      effectiveFromPeriod: fromP,
      annualRate: rateVal,
      effectiveDate: adjDate || getTodayIsoDate(),
      note: adjNote.trim() || `Điều chỉnh lãi suất từ kỳ #${fromP}`,
    });
    setAdjNote("");
    showToast(
      `Đã lưu mốc điều chỉnh ${rateVal}% từ kỳ #${fromP}. Các kỳ đã đóng trước đó giữ nguyên lịch sử.`
    );
  };

  const updateDraftField = <K extends keyof MortgageContract>(
    key: K,
    value: MortgageContract[K]
  ) => {
    setContractDraft((prev) => ({ ...prev, [key]: value }));
    setIsContractDirty(true);
  };

  const renderStatusLabel = (row: MortgageScheduleRow) => {
    if (row.status === "PAID") {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          Đã đóng
        </span>
      );
    }
    if (row.status === "OVERDUE") {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 dark:text-rose-300">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          Quá hạn {Math.abs(row.daysUntilDue)}n
        </span>
      );
    }
    if (row.status === "DUE_SOON") {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-300">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          {row.daysUntilDue === 0 ? "Hôm nay" : `Còn ${row.daysUntilDue} ngày`}
        </span>
      );
    }
    return <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Chưa đến kỳ</span>;
  };

  const dtiColorClass =
    realEstateMetrics.dtiStatus === "HIGH"
      ? "text-rose-700 dark:text-rose-300"
      : realEstateMetrics.dtiStatus === "WATCH"
      ? "text-amber-700 dark:text-amber-300"
      : "text-emerald-700 dark:text-emerald-300";

  return (
    <div className="space-y-5 sm:space-y-6 animate-in fade-in duration-200">
      {/* 1. HERO HEADER STRIP */}
      <section className="bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 shadow-xs p-4 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-[#0F172A] dark:bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg sm:text-xl font-black text-[#0F172A] dark:text-slate-100 tracking-tight">
                {skyoneLoan.projectName}
              </h2>
              <span className="text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 px-2 py-0.5 rounded-md tabular-nums">
                {schedule.paidCount}/{schedule.totalScheduledMonths} kỳ
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium tabular-nums truncate">
              {skyoneLoan.unitCode} · {skyoneLoan.bankName} · Giải ngân{" "}
              {formatDateVN(skyoneLoan.disbursementDate)} · Ngày trả hàng tháng:{" "}
              <strong className="text-slate-700 dark:text-slate-200">{skyoneLoan.paymentDayOfMonth}</strong>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {schedule.nextUnpaidInstallment && (
            <button
              type="button"
              onClick={() =>
                openConfirmPeriodsModal([schedule.nextUnpaidInstallment!.period])
              }
              className="min-h-[44px] px-4 py-2 rounded-lg bg-[#1E3A8A] hover:bg-blue-900 dark:bg-blue-600 dark:hover:bg-blue-700 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Đóng kỳ #{schedule.nextUnpaidInstallment.period}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setContractDraft(skyoneLoan);
              setIsContractDirty(false);
              setSubTab("CONTRACT");
            }}
            className="min-h-[44px] px-3.5 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Hợp đồng & Lãi suất</span>
          </button>
        </div>
      </section>

      {/* Toast Feedback */}
      {statusFeedback && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs sm:text-sm font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{statusFeedback}</span>
        </div>
      )}

      {/* 2. INTERNAL REMINDER STACK */}
      {internalReminders.length > 0 && (
        <section aria-label="Nhắc lịch thanh toán Phú Đông SKYONE" className="space-y-2">
          {internalReminders.map((item) => (
            <div
              key={item.id}
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
              {item.targetPeriod && (
                <button
                  type="button"
                  onClick={() => jumpToPeriod(item.targetPeriod!)}
                  className="min-h-[40px] px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-xs font-bold inline-flex items-center gap-1.5 shrink-0 cursor-pointer self-start sm:self-center"
                >
                  <span>Tới kỳ #{item.targetPeriod}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </section>
      )}

      {/* 3. 4-KPI EXECUTIVE STRIP */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5 sm:gap-4">
        {/* KPI 1 */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 shadow-xs p-4 sm:p-5 space-y-2.5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
            <span>Dư nợ gốc còn lại</span>
            <span className="tabular-nums font-bold text-blue-700 dark:text-blue-400">Đã trả {principalProgressPct}%</span>
          </div>
          <p className="text-xl sm:text-2xl font-black text-[#0F172A] dark:text-slate-100 tabular-nums">
            {formatVNDMasked(schedule.remainingBalance, isPrivacyMode)}
          </p>
          <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full transition-all"
              style={{ width: `${principalProgressPct}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
            Vay ban đầu: {formatShortVNDMasked(skyoneLoan.loanAmount, isPrivacyMode)} · Dự kiến tất toán{" "}
            {formatDateVN(schedule.estimatedPayoffDate)}
          </p>
        </div>

        {/* KPI 2 */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 shadow-xs p-4 sm:p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
            <span>Vốn chủ sở hữu (Equity)</span>
            <span className="tabular-nums font-bold text-emerald-700 dark:text-emerald-400">
              LTV {realEstateMetrics.ltvPct}%
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-xl sm:text-2xl font-black text-emerald-700 dark:text-emerald-400 tabular-nums">
              {realEstateMetrics.equityContractPct}%
            </p>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 tabular-nums">
              ({formatShortVNDMasked(realEstateMetrics.equityContractAmount, isPrivacyMode)})
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug tabular-nums">
            Gồm {formatShortVNDMasked(skyoneLoan.downPayment, isPrivacyMode)} tự có +{" "}
            {formatShortVNDMasked(
              Math.max(0, skyoneLoan.loanAmount - schedule.remainingBalance),
              isPrivacyMode
            )}{" "}
            gốc đã trả
          </p>
        </div>

        {/* KPI 3 */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 shadow-xs p-4 sm:p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
            <span>
              {schedule.nextUnpaidInstallment
                ? `Kỳ sắp tới #${schedule.nextUnpaidInstallment.period}`
                : "Trạng thái hợp đồng"}
            </span>
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 tabular-nums">
              {schedule.currentApplicableRate.toFixed(2)}%/năm
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-black text-[#1E3A8A] dark:text-blue-300 tabular-nums">
            {schedule.nextUnpaidInstallment
              ? formatVNDMasked(schedule.nextUnpaidInstallment.totalPayment, isPrivacyMode)
              : "Đã tất toán 100%"}
          </p>
          {schedule.nextUnpaidInstallment ? (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
              Hạn {formatDateVN(schedule.nextUnpaidInstallment.dueDate)} · Gốc{" "}
              {formatShortVNDMasked(schedule.nextUnpaidInstallment.principal, isPrivacyMode)} + Lãi{" "}
              {formatShortVNDMasked(schedule.nextUnpaidInstallment.interest, isPrivacyMode)}
            </p>
          ) : (
            <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">
              Chúc mừng gia đình đã hoàn thành toàn bộ dư nợ!
            </p>
          )}
        </div>

        {/* KPI 4 */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 shadow-xs p-4 sm:p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
            <span>Áp lực trả nợ / Thu nhập (DTI)</span>
            <span className={`font-bold ${dtiColorClass}`}>{realEstateMetrics.dtiLabel}</span>
          </div>
          <div className="flex items-baseline gap-2">
            <p className={`text-xl sm:text-2xl font-black tabular-nums ${dtiColorClass}`}>
              {realEstateMetrics.dtiPct}%
            </p>
            <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              / {formatShortVNDMasked(realEstateMetrics.monthlyFamilyIncome, isPrivacyMode)} thu nhập
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{realEstateMetrics.incomeSourceLabel}</p>
        </div>
      </section>

      {/* 4. SUB-TAB CONTENT */}
      {subTab === "OVERVIEW" && (
        <div className="space-y-6">
          {/* Primary Combined Amortization Chart */}
          <SkyOneAmortizationChart
            contract={skyoneLoan}
            schedule={schedule}
            isPrivacyMode={isPrivacyMode}
          />

          {/* Companion Chart: Balance Decline vs Equity Accumulation (VND) */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 shadow-xs p-4 sm:p-5 space-y-3">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-[#172B4D] dark:text-slate-100">
                Đường cong Dư nợ giảm dần &amp; Tích lũy Vốn chủ
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Giao điểm giữa giảm dư nợ ngân hàng và tăng tỷ trọng sở hữu căn hộ thực tế
              </p>
            </div>
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height={260} minWidth={0} minHeight={0}>
                <AreaChart
                  data={chartYearlyData}
                  margin={{ top: 10, right: 12, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--chart-tick)" }} axisLine={{ stroke: "var(--chart-grid)" }} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--chart-tick)" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => formatShortVNDMasked(Number(v), isPrivacyMode)}
                  />
                  <Tooltip
                    formatter={(value) => formatVNDMasked(Number(value), isPrivacyMode)}
                    contentStyle={{
                      backgroundColor: isDark ? "#0F172A" : "#FFFFFF",
                      borderColor: isDark ? "#334155" : "#DCE4EE",
                      color: isDark ? "#F1F5F9" : "#172B4D",
                      borderRadius: "0.75rem",
                      fontSize: "12px",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, color: "var(--chart-tick)" }} />
                  <Area
                    type="monotone"
                    dataKey="remainingBalance"
                    name="Dư nợ còn lại"
                    stroke={isDark ? "#F87171" : "#DC2626"}
                    fill={isDark ? "rgba(248, 113, 113, 0.22)" : "#FEE2E2"}
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="equity"
                    name="Vốn chủ sở hữu"
                    stroke={isDark ? "#34D399" : "#059669"}
                    fill={isDark ? "rgba(52, 211, 153, 0.22)" : "#D1FAE5"}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Real Estate Equity Metrics & Cost Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 shadow-xs p-5 space-y-3">
              <h3 className="text-sm font-bold text-[#172B4D] dark:text-slate-100 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Sức khỏe tài sản căn hộ SKYONE</span>
              </h3>
              <dl className="space-y-2.5 text-xs">
                <div className="flex justify-between gap-2 py-1 border-b border-slate-100 dark:border-slate-800">
                  <dt className="text-slate-500 dark:text-slate-400">Giá hợp đồng mua</dt>
                  <dd className="font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                    {formatVNDMasked(skyoneLoan.propertyValue, isPrivacyMode)}
                  </dd>
                </div>
                <div className="flex justify-between gap-2 py-1 border-b border-slate-100 dark:border-slate-800">
                  <dt className="text-slate-500 dark:text-slate-400">Định giá thị trường hiện tại</dt>
                  <dd className="font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
                    {formatVNDMasked(skyoneLoan.currentMarketValue, isPrivacyMode)}
                  </dd>
                </div>
                <div className="flex justify-between gap-2 py-1 border-b border-slate-100 dark:border-slate-800">
                  <dt className="text-slate-500 dark:text-slate-400">Vốn chủ theo thị trường (Equity)</dt>
                  <dd className="font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
                    {formatVNDMasked(realEstateMetrics.equityMarketAmount, isPrivacyMode)} (
                    {realEstateMetrics.equityMarketPct}%)
                  </dd>
                </div>
                <div className="flex justify-between gap-2 py-1 border-b border-slate-100 dark:border-slate-800">
                  <dt className="text-slate-500 dark:text-slate-400">Tổng lãi đã trả thực tế</dt>
                  <dd className="font-bold text-amber-700 dark:text-amber-300 tabular-nums">
                    {formatVNDMasked(schedule.totalInterestPaid, isPrivacyMode)}
                  </dd>
                </div>
                <div className="flex justify-between gap-2 py-1">
                  <dt className="text-slate-500 dark:text-slate-400">Tổng lãi dự kiến toàn kỳ hạn</dt>
                  <dd className="font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                    {formatVNDMasked(schedule.totalProjectedInterest, isPrivacyMode)}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Floating Rate Stress-Test Table */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 shadow-xs p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-[#172B4D] dark:text-slate-100 flex items-center gap-2">
                    <Percent className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>Stress-Test biến động lãi thả nổi & Chỉ số DTI</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Giả lập áp lực dòng tiền nếu lãi suất thả nổi tăng thêm +1%, +2%, +3% so với kịch bản gốc (
                    {(skyoneLoan.floatingBaseRate + skyoneLoan.floatingSpread).toFixed(2)}%/năm)
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-bold">
                      <th className="py-2.5 pr-3">Kịch bản</th>
                      <th className="py-2.5 px-3 text-right">Lãi thả nổi</th>
                      <th className="py-2.5 px-3 text-right">Đỉnh trả/tháng</th>
                      <th className="py-2.5 px-3 text-right">Chênh lệch hiện tại</th>
                      <th className="py-2.5 px-3 text-right">DTI %</th>
                      <th className="py-2.5 pl-3 text-right">Đánh giá</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {stressScenarios.map((sc) => (
                      <tr key={sc.shockPercent} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                        <td className="py-2.5 pr-3 font-bold text-slate-800 dark:text-slate-100">{sc.label}</td>
                        <td className="py-2.5 px-3 text-right font-semibold text-slate-700 dark:text-slate-200 tabular-nums">
                          {sc.floatingRate.toFixed(2)}%
                        </td>
                        <td className="py-2.5 px-3 text-right font-extrabold text-[#1E3A8A] dark:text-blue-300 tabular-nums">
                          {formatVNDMasked(sc.peakMonthlyPayment, isPrivacyMode)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold text-slate-600 dark:text-slate-300 tabular-nums">
                          {sc.monthlyDeltaFromCurrent >= 0 ? "+" : ""}
                          {formatVNDMasked(sc.monthlyDeltaFromCurrent, isPrivacyMode)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-800 dark:text-slate-100 tabular-nums">
                          {sc.dtiPct}%
                        </td>
                        <td className="py-2.5 pl-3 text-right font-bold">
                          <span
                            className={
                              sc.status === "HIGH"
                                ? "text-rose-700 dark:text-rose-300"
                                : sc.status === "WATCH"
                                ? "text-amber-700 dark:text-amber-300"
                                : "text-emerald-700 dark:text-emerald-300"
                            }
                          >
                            {sc.status === "HIGH"
                              ? "Áp lực cao"
                              : sc.status === "WATCH"
                              ? "Cân nhắc"
                              : "An toàn"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {subTab === "SCHEDULE" && (
        <div className="space-y-4">
          {/* Filter & Action Toolbar */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 shadow-xs p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              <div>
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                  Trạng thái kỳ
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as ScheduleStatusFilter)}
                  className="w-full min-h-[42px] px-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-blue-600"
                >
                  <option value="ALL">Tất cả ({schedule.rows.length} kỳ)</option>
                  <option value="UNPAID">Chưa đóng ({schedule.unpaidCount})</option>
                  <option value="PAID">Đã đóng ({schedule.paidCount})</option>
                  <option value="DUE_OR_OVERDUE">
                    Sắp đến hạn / Quá hạn ({schedule.overdueCount + schedule.dueSoonCount})
                  </option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                  Giai đoạn lãi suất
                </label>
                <select
                  value={stageFilter}
                  onChange={(e) => setStageFilter(e.target.value as ScheduleStageFilter)}
                  className="w-full min-h-[42px] px-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-blue-600"
                >
                  <option value="ALL">Tất cả giai đoạn</option>
                  <option value="FIXED">Lãi cố định ưu đãi</option>
                  <option value="FLOATING">Lãi thả nổi</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                  Năm vay
                </label>
                <select
                  value={yearFilter}
                  onChange={(e) => setYearFilter(e.target.value)}
                  className="w-full min-h-[42px] px-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-blue-600"
                >
                  <option value="ALL">Tất cả {availableYears.length} năm</option>
                  {availableYears.map((yr) => (
                    <option key={yr} value={String(yr)}>
                      Năm thứ {yr}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-end gap-2">
                <button
                  type="button"
                  onClick={() => jumpToPeriod(schedule.currentReferencePeriod)}
                  className="w-full min-h-[42px] px-3 rounded-lg bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200 text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>Nhảy tới kỳ #{schedule.currentReferencePeriod}</span>
                </button>
              </div>
            </div>

            {/* Batch Confirmation Bar */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <button
                  type="button"
                  onClick={selectUpToCurrentPeriods}
                  className="min-h-[38px] px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-bold text-xs cursor-pointer"
                >
                  Chọn các kỳ đến hạn hiện tại
                </button>
                {selectedPeriods.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedPeriods([])}
                    className="min-h-[38px] px-2.5 py-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 font-semibold text-xs cursor-pointer"
                  >
                    Bỏ chọn ({selectedPeriods.length})
                  </button>
                )}
              </div>

              {selectedPeriods.length > 0 && (
                <button
                  type="button"
                  onClick={() => openConfirmPeriodsModal(selectedPeriods)}
                  className="min-h-[42px] px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold inline-flex items-center gap-2 shadow-xs cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Xác nhận đóng {selectedPeriods.length} kỳ đã chọn</span>
                </button>
              )}
            </div>
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="overflow-x-auto max-h-[600px]">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0 z-10 border-b border-[#DCE4EE] dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold">
                  <tr>
                    <th className="py-3 pl-4 pr-2 w-8" />
                    <th className="py-3 px-2">Kỳ</th>
                    <th className="py-3 px-2">Ngày hạn</th>
                    <th className="py-3 px-2">Giai đoạn</th>
                    <th className="py-3 px-2 text-right">Lãi suất</th>
                    <th className="py-3 px-2 text-right">Dư đầu kỳ</th>
                    <th className="py-3 px-2 text-right">Trả Gốc</th>
                    <th className="py-3 px-2 text-right">Trả Lãi</th>
                    <th className="py-3 px-2 text-right">Tổng đóng</th>
                    <th className="py-3 px-2 text-right">Dư cuối kỳ</th>
                    <th className="py-3 px-2">Trạng thái</th>
                    <th className="py-3 pl-2 pr-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="py-10 text-center text-slate-400 font-semibold">
                        Không có kỳ trả nợ nào khớp với bộ lọc hiện tại.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row) => {
                      const isChecked = selectedPeriods.includes(row.period);
                      const isHighlighted = highlightedPeriod === row.period;
                      return (
                        <tr
                          key={row.period}
                          ref={(el) => {
                            rowRefs.current[row.period] = el;
                          }}
                          className={`transition-colors ${
                            isHighlighted
                              ? "bg-blue-100/80 dark:bg-blue-900/40 ring-1 ring-inset ring-blue-400"
                              : row.status === "PAID"
                              ? "bg-emerald-50/25 dark:bg-emerald-950/25 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/40"
                              : row.status === "OVERDUE"
                              ? "bg-rose-50/40 dark:bg-rose-950/30 hover:bg-rose-50/70 dark:hover:bg-rose-950/50"
                              : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                          }`}
                        >
                          <td className="py-2.5 pl-4 pr-2">
                            {row.status !== "PAID" && (
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => togglePeriodSelection(row.period)}
                                aria-label={`Chọn kỳ ${row.period}`}
                                className="w-4 h-4 accent-blue-600 cursor-pointer"
                              />
                            )}
                          </td>
                          <td className="py-2.5 px-2 font-extrabold text-slate-900 dark:text-slate-100 tabular-nums">
                            #{row.period}
                          </td>
                          <td className="py-2.5 px-2 text-slate-700 dark:text-slate-300 tabular-nums">
                            {formatDateVN(row.dueDate)}
                          </td>
                          <td className="py-2.5 px-2">
                            <span
                              className={`text-[11px] font-bold ${
                                row.stage === "FIXED" ? "text-blue-700 dark:text-blue-300" : "text-amber-700 dark:text-amber-300"
                              }`}
                            >
                              {row.stage === "FIXED" ? "Cố định" : "Thả nổi"}
                            </span>
                          </td>
                          <td className="py-2.5 px-2 text-right font-semibold text-slate-700 dark:text-slate-200 tabular-nums">
                            {row.appliedRate.toFixed(2)}%
                            {row.isCustomRateAdjusted && (
                              <span
                                title={row.rateNote || "Mốc điều chỉnh lãi suất ngân hàng"}
                                className="ml-1 text-[10px] text-indigo-600 dark:text-indigo-400 font-bold"
                              >
                                *
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-2 text-right text-slate-600 dark:text-slate-300 tabular-nums">
                            {formatVNDMasked(row.openingBalance, isPrivacyMode, false)}
                          </td>
                          <td className="py-2.5 px-2 text-right font-semibold text-blue-700 dark:text-blue-400 tabular-nums">
                            {formatVNDMasked(row.principal, isPrivacyMode, false)}
                            {row.prepaidInPeriod > 0 && (
                              <span className="block text-[10px] text-emerald-700 dark:text-emerald-300 font-bold">
                                +{formatShortVNDMasked(row.prepaidInPeriod, isPrivacyMode)} trước hạn
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-2 text-right font-semibold text-amber-700 dark:text-amber-300 tabular-nums">
                            {formatVNDMasked(row.interest, isPrivacyMode, false)}
                          </td>
                          <td className="py-2.5 px-2 text-right font-black text-slate-900 dark:text-slate-100 tabular-nums">
                            {formatVNDMasked(row.totalPayment, isPrivacyMode, false)}
                          </td>
                          <td className="py-2.5 px-2 text-right text-slate-700 dark:text-slate-300 tabular-nums">
                            {formatVNDMasked(row.closingBalance, isPrivacyMode, false)}
                          </td>
                          <td className="py-2.5 px-2">{renderStatusLabel(row)}</td>
                          <td className="py-2.5 pl-2 pr-4 text-right">
                            {row.status === "PAID" ? (
                              <button
                                type="button"
                                onClick={() => undoSkyOnePeriod(row.period)}
                                className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Undo2 className="w-3 h-3" />
                                Hoàn tác
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => openConfirmPeriodsModal([row.period])}
                                className="px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold cursor-pointer"
                              >
                                Xác nhận đóng
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Touch Card Stack */}
          <div className="md:hidden space-y-2.5">
            {filteredRows.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 p-6 text-center text-xs text-slate-400 font-semibold">
                Không có kỳ trả nợ nào khớp với bộ lọc hiện tại.
              </div>
            ) : (
              filteredRows.slice(0, 60).map((row) => {
                const isChecked = selectedPeriods.includes(row.period);
                const isHighlighted = highlightedPeriod === row.period;
                return (
                  <div
                    key={row.period}
                    ref={(el) => {
                      rowRefs.current[row.period] = el;
                    }}
                    className={`rounded-xl border p-3.5 space-y-2.5 bg-white dark:bg-slate-900 ${
                      isHighlighted
                        ? "border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800"
                        : row.status === "OVERDUE"
                        ? "border-rose-200 dark:border-rose-800 bg-rose-50/30 dark:bg-rose-950/30"
                        : "border-[#DCE4EE] dark:border-slate-800"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        {row.status !== "PAID" && (
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => togglePeriodSelection(row.period)}
                            aria-label={`Chọn kỳ ${row.period}`}
                            className="w-4 h-4 accent-blue-600"
                          />
                        )}
                        <div>
                          <span className="text-sm font-black text-slate-900 dark:text-slate-100 tabular-nums">
                            Kỳ #{row.period} · {formatDateVN(row.dueDate)}
                          </span>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                            {row.stage === "FIXED" ? "Lãi cố định" : "Lãi thả nổi"} ·{" "}
                            {row.appliedRate.toFixed(2)}%/năm
                          </p>
                        </div>
                      </div>
                      {renderStatusLabel(row)}
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Trả Gốc</span>
                        <span className="font-bold text-blue-700 dark:text-blue-400 tabular-nums">
                          {formatVNDMasked(row.principal, isPrivacyMode)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Trả Lãi</span>
                        <span className="font-bold text-amber-700 dark:text-amber-300 tabular-nums">
                          {formatVNDMasked(row.interest, isPrivacyMode)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block">Tổng đóng</span>
                        <span className="font-black text-slate-900 dark:text-slate-100 tabular-nums">
                          {formatVNDMasked(row.totalPayment, isPrivacyMode)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                        Dư cuối kỳ: {formatVNDMasked(row.closingBalance, isPrivacyMode)}
                      </span>
                      {row.status === "PAID" ? (
                        <button
                          type="button"
                          onClick={() => undoSkyOnePeriod(row.period)}
                          className="min-h-[40px] px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold inline-flex items-center gap-1"
                        >
                          <Undo2 className="w-3.5 h-3.5" />
                          Hoàn tác
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openConfirmPeriodsModal([row.period])}
                          className="min-h-[40px] px-3.5 py-1.5 rounded-lg bg-[#1E3A8A] dark:bg-blue-600 text-white text-xs font-bold"
                        >
                          Xác nhận đóng
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            {filteredRows.length > 60 && (
              <p className="text-center text-xs text-slate-500 dark:text-slate-400 py-2">
                Đang hiển thị 60 kỳ đầu theo bộ lọc. Dùng bộ lọc Năm vay để xem nhanh các năm sau.
              </p>
            )}
          </div>
        </div>
      )}

      {subTab === "PREPAYMENT" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Simulator Form + Comparison */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 shadow-xs p-5 space-y-5">
            <div>
              <h3 className="text-base font-bold text-[#172B4D] dark:text-slate-100">
                Mô phỏng Trả gốc trước hạn & Tất toán sớm
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Tính tự động phí phạt theo biểu năm vay thực tế, tiền lãi tiết kiệm ròng và số tháng rút ngắn
              </p>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block">
                Số tiền muốn trả gốc trước hạn (VND)
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={prepayAmountStr}
                onChange={(e) => {
                  const n = parseNumericInput(e.target.value);
                  setPrepayAmountStr(n > 0 ? new Intl.NumberFormat("vi-VN").format(n) : "");
                }}
                className="w-full min-h-[46px] px-3.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 text-base font-black text-[#1E3A8A] dark:text-blue-300 tabular-nums outline-none focus:border-blue-600"
              />
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "50 triệu", amount: 50_000_000 },
                  { label: "100 triệu", amount: 100_000_000 },
                  { label: "200 triệu", amount: 200_000_000 },
                  { label: "Tất toán 100%", amount: schedule.remainingBalance },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() =>
                      setPrepayAmountStr(
                        new Intl.NumberFormat("vi-VN").format(Math.max(0, preset.amount))
                      )
                    }
                    className="min-h-[38px] px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/60 hover:text-blue-700 dark:hover:text-blue-300 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPrepayStrategy("SHORTEN_TERM")}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                  prepayStrategy === "SHORTEN_TERM"
                    ? "bg-blue-50 dark:bg-blue-950/60 border-blue-600 ring-1 ring-blue-600"
                    : "bg-slate-50 dark:bg-slate-800/70 border-[#DCE4EE] dark:border-slate-700"
                }`}
              >
                <p className="text-xs font-extrabold text-slate-900 dark:text-slate-100">Rút ngắn thời gian vay</p>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1">
                  Giữ mức trả gốc hàng tháng, về đích tất toán sớm hơn để tối đa lãi tiết kiệm.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setPrepayStrategy("REDUCE_MONTHLY")}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                  prepayStrategy === "REDUCE_MONTHLY"
                    ? "bg-blue-50 dark:bg-blue-950/60 border-blue-600 ring-1 ring-blue-600"
                    : "bg-slate-50 dark:bg-slate-800/70 border-[#DCE4EE] dark:border-slate-700"
                }`}
              >
                <p className="text-xs font-extrabold text-slate-900 dark:text-slate-100">Giảm tiền đóng hàng tháng</p>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1">
                  Chia lại dư nợ còn lại cho số tháng cũ, giảm ngay áp lực DTI hàng tháng.
                </p>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                  Ngày dự kiến thực hiện
                </label>
                <input
                  type="date"
                  value={prepayDate}
                  onChange={(e) => setPrepayDate(e.target.value)}
                  className="w-full min-h-[42px] px-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-blue-600"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                  Ghi chú nguồn tiền (tùy chọn)
                </label>
                <input
                  type="text"
                  value={prepayNote}
                  onChange={(e) => setPrepayNote(e.target.value)}
                  placeholder="Ví dụ: Thưởng Tết / Tất toán sổ tiết kiệm"
                  className="w-full min-h-[42px] px-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-blue-600"
                />
              </div>
            </div>

            {/* Simulation Output Box */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-[#DCE4EE] dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-600 dark:text-slate-300">
                  Áp dụng sau kỳ #{prepayAfterPeriod} (Năm vay thứ {prepaySimulation.loanYearAtExecution})
                </span>
                <span className="font-bold text-amber-700 dark:text-amber-300 tabular-nums">
                  Phí phạt: {prepaySimulation.penaltyFeePercent}%
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-white dark:bg-slate-900 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Phí trả trước hạn</span>
                  <span className="text-sm font-black text-rose-700 dark:text-rose-300 tabular-nums">
                    {formatVNDMasked(prepaySimulation.penaltyAmount, isPrivacyMode)}
                  </span>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Lãi tiết kiệm ròng</span>
                  <span className="text-sm font-black text-emerald-700 dark:text-emerald-300 tabular-nums">
                    {formatVNDMasked(prepaySimulation.netInterestSaved, isPrivacyMode)}
                  </span>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                    {prepayStrategy === "SHORTEN_TERM" ? "Rút ngắn kỳ hạn" : "Giảm đóng kỳ tới"}
                  </span>
                  <span className="text-sm font-black text-blue-700 dark:text-blue-300 tabular-nums">
                    {prepayStrategy === "SHORTEN_TERM"
                      ? `${prepaySimulation.monthsSaved} tháng`
                      : `-${formatShortVNDMasked(prepaySimulation.monthlyPaymentReduction, isPrivacyMode)}/th`}
                  </span>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Ngày tất toán mới</span>
                  <span className="text-sm font-black text-slate-900 dark:text-slate-100 tabular-nums">
                    {formatDateVN(prepaySimulation.newPayoffDate)}
                  </span>
                </div>
              </div>

              <button
                type="button"
                disabled={prepayAmount <= 0 || schedule.remainingBalance <= 0}
                onClick={openConfirmPrepaymentModal}
                className="w-full min-h-[46px] px-4 py-2.5 rounded-lg bg-[#1E3A8A] hover:bg-blue-900 dark:bg-blue-600 dark:hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-extrabold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Lưu đợt trả gốc trước hạn thực tế</span>
              </button>
            </div>
          </div>

          {/* Prepayment History Log */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#172B4D] dark:text-slate-100">
                  Lịch sử các đợt trả gốc trước hạn ({skyoneLoan.prepayments.length})
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  Tổng đã trả thêm: {formatVNDMasked(schedule.totalPrepaidAmount, isPrivacyMode)}
                </p>
              </div>
            </div>

            {skyoneLoan.prepayments.length === 0 ? (
              <div className="p-6 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-dashed border-slate-200 dark:border-slate-700 text-center text-xs text-slate-500 dark:text-slate-400">
                Chưa có đợt trả gốc trước hạn nào được ghi nhận. Bạn có thể mô phỏng bên trái và lưu thực tế khi thực hiện giao dịch với ngân hàng.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[440px] overflow-y-auto">
                {skyoneLoan.prepayments.map((p) => (
                  <div
                    key={p.id}
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-[#E9EEF5] dark:border-slate-700 flex items-start justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1 min-w-0">
                      <p className="font-black text-emerald-700 dark:text-emerald-300 text-sm tabular-nums">
                        +{formatVNDMasked(p.amount, isPrivacyMode)}
                      </p>
                      <p className="text-slate-600 dark:text-slate-300 font-semibold tabular-nums">
                        Ngày {formatDateVN(p.date)} · Sau kỳ #{p.afterPeriod} ·{" "}
                        {p.strategy === "SHORTEN_TERM" ? "Rút ngắn kỳ" : "Giảm đóng tháng"}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                        Phí phạt {p.feePercent}% ({formatVNDMasked(p.penaltyAmount, isPrivacyMode)})
                        {p.note ? ` · ${p.note}` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteSkyOnePrepayment(p.id)}
                      aria-label="Xóa đợt trả gốc trước hạn"
                      className="p-2 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {subTab === "CONTRACT" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Editable Contract Parameters */}
          <form
            onSubmit={handleSaveContract}
            className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 shadow-xs p-5 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-[#172B4D] dark:text-slate-100">
                  Thông số hợp đồng vay & Tài sản
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Mọi thay đổi được lưu tự động cùng sao lưu JSON & đồng bộ 2 máy
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsResetModalOpen(true)}
                className="min-h-[38px] px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Khôi phục mẫu SKYONE</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Tên dự án</label>
                <input
                  type="text"
                  value={contractDraft.projectName}
                  onChange={(e) => updateDraftField("projectName", e.target.value)}
                  className="w-full min-h-[40px] px-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 font-semibold text-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Mã căn / Thông tin căn hộ</label>
                <input
                  type="text"
                  value={contractDraft.unitCode}
                  onChange={(e) => updateDraftField("unitCode", e.target.value)}
                  className="w-full min-h-[40px] px-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 font-semibold text-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Ngân hàng giải ngân</label>
                <input
                  type="text"
                  value={contractDraft.bankName}
                  onChange={(e) => updateDraftField("bankName", e.target.value)}
                  className="w-full min-h-[40px] px-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 font-semibold text-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Ngày giải ngân đầu</label>
                <input
                  type="date"
                  value={contractDraft.disbursementDate}
                  onChange={(e) => updateDraftField("disbursementDate", e.target.value)}
                  className="w-full min-h-[40px] px-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 font-semibold text-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Giá trị hợp đồng (VND)</label>
                <input
                  type="number"
                  value={contractDraft.propertyValue}
                  onChange={(e) => updateDraftField("propertyValue", Number(e.target.value) || 0)}
                  className="w-full min-h-[40px] px-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 font-bold text-slate-800 dark:text-slate-100 tabular-nums"
                />
              </div>
              <div>
                <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Định giá thị trường hiện tại (VND)</label>
                <input
                  type="number"
                  value={contractDraft.currentMarketValue}
                  onChange={(e) =>
                    updateDraftField("currentMarketValue", Number(e.target.value) || 0)
                  }
                  className="w-full min-h-[40px] px-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 font-bold text-slate-800 dark:text-slate-100 tabular-nums"
                />
              </div>
              <div>
                <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Vốn tự có ban đầu (VND)</label>
                <input
                  type="number"
                  value={contractDraft.downPayment}
                  onChange={(e) => updateDraftField("downPayment", Number(e.target.value) || 0)}
                  className="w-full min-h-[40px] px-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 font-bold text-slate-800 dark:text-slate-100 tabular-nums"
                />
              </div>
              <div>
                <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Số tiền vay gốc (VND)</label>
                <input
                  type="number"
                  value={contractDraft.loanAmount}
                  onChange={(e) => updateDraftField("loanAmount", Number(e.target.value) || 0)}
                  className="w-full min-h-[40px] px-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 font-bold text-slate-800 dark:text-slate-100 tabular-nums"
                />
              </div>
              <div>
                <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Kỳ hạn vay (tháng)</label>
                <input
                  type="number"
                  min={12}
                  max={420}
                  value={contractDraft.termMonths}
                  onChange={(e) => updateDraftField("termMonths", Number(e.target.value) || 12)}
                  className="w-full min-h-[40px] px-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 font-bold text-slate-800 dark:text-slate-100 tabular-nums"
                />
              </div>
              <div>
                <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Ngày trả hàng tháng (1–28)</label>
                <input
                  type="number"
                  min={1}
                  max={28}
                  value={contractDraft.paymentDayOfMonth}
                  onChange={(e) =>
                    updateDraftField("paymentDayOfMonth", Number(e.target.value) || 15)
                  }
                  className="w-full min-h-[40px] px-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 font-bold text-slate-800 dark:text-slate-100 tabular-nums"
                />
              </div>
              <div>
                <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Số tháng lãi cố định</label>
                <input
                  type="number"
                  min={0}
                  value={contractDraft.fixedRateMonths}
                  onChange={(e) =>
                    updateDraftField("fixedRateMonths", Number(e.target.value) || 0)
                  }
                  className="w-full min-h-[40px] px-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 font-bold text-slate-800 dark:text-slate-100 tabular-nums"
                />
              </div>
              <div>
                <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Lãi cố định ưu đãi (%/năm)</label>
                <input
                  type="number"
                  step="0.05"
                  value={contractDraft.fixedInterestRate}
                  onChange={(e) =>
                    updateDraftField("fixedInterestRate", Number(e.target.value) || 0)
                  }
                  className="w-full min-h-[40px] px-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 font-bold text-slate-800 dark:text-slate-100 tabular-nums"
                />
              </div>
              <div>
                <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Lãi cơ sở thả nổi (%/năm)</label>
                <input
                  type="number"
                  step="0.05"
                  value={contractDraft.floatingBaseRate}
                  onChange={(e) =>
                    updateDraftField("floatingBaseRate", Number(e.target.value) || 0)
                  }
                  className="w-full min-h-[40px] px-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 font-bold text-slate-800 dark:text-slate-100 tabular-nums"
                />
              </div>
              <div>
                <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Biên độ thả nổi (%/năm)</label>
                <input
                  type="number"
                  step="0.05"
                  value={contractDraft.floatingSpread}
                  onChange={(e) =>
                    updateDraftField("floatingSpread", Number(e.target.value) || 0)
                  }
                  className="w-full min-h-[40px] px-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 font-bold text-slate-800 dark:text-slate-100 tabular-nums"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between gap-3">
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Lãi suất thả nổi dự kiến:{" "}
                <strong className="text-slate-800 dark:text-slate-100">
                  {(contractDraft.floatingBaseRate + contractDraft.floatingSpread).toFixed(2)}%/năm
                </strong>
              </span>
              <button
                type="submit"
                disabled={!isContractDirty}
                className="min-h-[44px] px-5 py-2 rounded-lg bg-[#1E3A8A] hover:bg-blue-900 dark:bg-blue-600 dark:hover:bg-blue-700 disabled:opacity-50 text-white text-xs sm:text-sm font-extrabold cursor-pointer"
              >
                Lưu thông số hợp đồng
              </button>
            </div>
          </form>

          {/* Right Column: Bank Rate Adjustment Milestones + Penalty Tiers */}
          <div className="lg:col-span-5 space-y-6">
            <form
              onSubmit={handleAddRateAdjustment}
              className="bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 shadow-xs p-5 space-y-3.5"
            >
              <div>
                <h3 className="text-sm font-bold text-[#172B4D] dark:text-slate-100">
                  Mốc điều chỉnh lãi suất thực tế từ ngân hàng
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Các kỳ đã xác nhận <strong>Đã đóng</strong> luôn giữ nguyên snapshot lịch sử, chỉ tính lãi mới từ kỳ áp dụng trở đi.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div>
                  <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Từ kỳ số #</label>
                  <input
                    type="number"
                    min={1}
                    max={skyoneLoan.termMonths}
                    value={adjFromPeriod}
                    onChange={(e) => setAdjFromPeriod(e.target.value)}
                    className="w-full min-h-[40px] px-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 font-bold text-slate-800 dark:text-slate-100 tabular-nums"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Lãi suất mới (%/năm)</label>
                  <input
                    type="number"
                    step="0.05"
                    value={adjRate}
                    onChange={(e) => setAdjRate(e.target.value)}
                    className="w-full min-h-[40px] px-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 font-bold text-slate-800 dark:text-slate-100 tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <div>
                  <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Ngày thông báo</label>
                  <input
                    type="date"
                    value={adjDate}
                    onChange={(e) => setAdjDate(e.target.value)}
                    className="w-full min-h-[40px] px-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 font-semibold text-slate-800 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Ghi chú ngân hàng</label>
                  <input
                    type="text"
                    value={adjNote}
                    onChange={(e) => setAdjNote(e.target.value)}
                    placeholder="VD: BIDV điều chỉnh thả nổi Q4"
                    className="w-full min-h-[40px] px-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 font-semibold text-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full min-h-[42px] px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm mốc điều chỉnh lãi suất</span>
              </button>

              {skyoneLoan.rateAdjustments.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  {skyoneLoan.rateAdjustments.map((adj) => (
                    <div
                      key={adj.id}
                      className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-[#E9EEF5] dark:border-slate-700 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 dark:text-slate-100 tabular-nums">
                          Từ kỳ #{adj.effectiveFromPeriod}: {adj.annualRate.toFixed(2)}%/năm
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {formatDateVN(adj.effectiveDate)}
                          {adj.note ? ` · ${adj.note}` : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteSkyOneRateAdjustment(adj.id)}
                        aria-label="Xóa mốc lãi suất"
                        className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </form>

            {/* Penalty Tier Table */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 shadow-xs p-5 space-y-2.5">
              <h3 className="text-sm font-bold text-[#172B4D] dark:text-slate-100">
                Biểu phí phạt trả nợ trước hạn theo năm
              </h3>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {skyoneLoan.prepaymentPenaltyTiers.map((tier, idx) => (
                  <div key={idx} className="py-2 flex items-center justify-between tabular-nums">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {tier.fromYear === tier.toYear
                        ? `Năm thứ ${tier.fromYear}`
                        : `Từ năm ${tier.fromYear} đến năm ${tier.toYear}`}
                    </span>
                    <span className="font-black text-slate-900 dark:text-slate-100">{tier.feePercent}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {subTab === "CASHFLOW" && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 shadow-xs p-4">
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Gốc vay ban đầu</p>
              <p className="text-base sm:text-lg font-extrabold text-[#172B4D] dark:text-slate-100 tabular-nums mt-1">
                {formatVNDMasked(skyoneLoan.loanAmount, isPrivacyMode)}
              </p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 shadow-xs p-4">
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Tổng lãi dự kiến toàn kỳ</p>
              <p className="text-base sm:text-lg font-extrabold text-indigo-700 dark:text-indigo-300 tabular-nums mt-1">
                {formatVNDMasked(schedule.totalProjectedInterest, isPrivacyMode)}
              </p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 shadow-xs p-4">
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Tổng nghĩa vụ thanh toán</p>
              <p className="text-base sm:text-lg font-extrabold text-blue-700 dark:text-blue-300 tabular-nums mt-1">
                {formatVNDMasked(schedule.totalProjectedCost, isPrivacyMode)}
              </p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 shadow-xs p-4">
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Thời gian vay thực tế</p>
              <p className="text-base sm:text-lg font-extrabold text-[#172B4D] dark:text-slate-100 tabular-nums mt-1">
                {schedule.yearlySummary.length} năm ({schedule.totalScheduledMonths} kỳ)
              </p>
            </div>
          </div>

          <SkyOneCashflowScheduleTable
            contract={skyoneLoan}
            schedule={schedule}
            isPrivacyMode={isPrivacyMode}
          />
        </div>
      )}

      {/* PAYMENT / PREPAYMENT CONFIRMATION MODAL */}
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
              <h3 className="text-base font-extrabold text-[#0F172A] dark:text-slate-100">{pendingConfirm.title}</h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                {pendingConfirm.description}
              </p>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 flex items-center justify-between">
                <span className="font-bold text-blue-900 dark:text-blue-200">Tổng số tiền thực chi</span>
                <span className="text-base font-black text-[#1E3A8A] dark:text-blue-300 tabular-nums">
                  {formatVNDMasked(pendingConfirm.totalCashOutflow, isPrivacyMode)}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Ngày thanh toán</label>
                  <input
                    type="date"
                    value={confirmPaidDate}
                    onChange={(e) => setConfirmPaidDate(e.target.value)}
                    className="w-full min-h-[40px] px-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 font-semibold text-slate-800 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Ghi chú</label>
                  <input
                    type="text"
                    value={confirmNote}
                    onChange={(e) => setConfirmNote(e.target.value)}
                    className="w-full min-h-[40px] px-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 font-semibold text-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              {/* Opt-in Cashflow Ledger Link */}
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
                      Ghi kèm khoản chi vào Sổ giao dịch & trừ ví sinh hoạt
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
                  onClick={executePendingConfirm}
                  className="flex-1 min-h-[44px] px-4 py-2 rounded-lg bg-[#1E3A8A] hover:bg-blue-900 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-extrabold cursor-pointer"
                >
                  Xác nhận lưu
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={isResetModalOpen}
        title="Khôi phục hợp đồng mẫu Phú Đông SKYONE?"
        message="Hệ thống sẽ đặt lại hợp đồng vay Phú Đông SKYONE về thông số mẫu mặc định kèm lịch sử đã đóng tới tháng hiện tại."
        confirmLabel="Khôi phục mẫu"
        cancelLabel="Hủy"
        isDanger={false}
        onConfirm={() => {
          resetSkyOneLoan();
          setIsResetModalOpen(false);
          setIsContractDirty(false);
          showToast("Đã khôi phục hợp đồng mẫu Phú Đông SKYONE.");
        }}
        onCancel={() => setIsResetModalOpen(false)}
      />
    </div>
  );
}
