"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Home,
  Repeat,
  RotateCcw,
  Zap,
} from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import {
  formatShortVNDMasked,
  formatVNDMasked,
  getCurrentMonthKey,
  getMonthDisplayLabel,
} from "@/lib/formatters";
import { shiftMonthKey } from "@/lib/financeEngine";
import {
  FinancialCalendarEvent,
  FinancialCalendarEventStatus,
  buildFinancialCalendarMonth,
} from "@/lib/financialCalendar";
import { useHaptic } from "@/src/hooks/useHaptic";

interface FinancialCalendarCardProps {
  compact?: boolean;
}

type CalendarKindFilter = "ALL" | "RECURRING" | "INSTALLMENT" | "CREDIT_CARD";

const WEEKDAY_LABELS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

function getStatusLabel(status: FinancialCalendarEventStatus): string {
  switch (status) {
    case "APPLIED":
      return "Đã ghi sổ";
    case "OVERDUE":
      return "Quá hạn";
    case "DUE_TODAY":
      return "Hôm nay";
    case "DUE_SOON":
      return "Sắp đến hạn";
    case "CARD_INFO":
      return "Mốc thẻ";
    default:
      return "Dự kiến";
  }
}

function getStatusTextClass(status: FinancialCalendarEventStatus): string {
  switch (status) {
    case "APPLIED":
      return "text-emerald-700 dark:text-emerald-400";
    case "OVERDUE":
      return "text-rose-600 dark:text-rose-400";
    case "DUE_TODAY":
    case "DUE_SOON":
      return "text-amber-700 dark:text-amber-300";
    case "CARD_INFO":
      return "text-indigo-700 dark:text-indigo-300";
    default:
      return "text-blue-700 dark:text-blue-300";
  }
}

function getKindIcon(kind: FinancialCalendarEvent["kind"]) {
  if (kind === "INSTALLMENT") return <Home className="w-3.5 h-3.5 shrink-0" />;
  if (kind === "CREDIT_DUE" || kind === "CREDIT_STATEMENT") {
    return <CreditCard className="w-3.5 h-3.5 shrink-0" />;
  }
  return <Repeat className="w-3.5 h-3.5 shrink-0" />;
}

export function FinancialCalendarCard({ compact = false }: FinancialCalendarCardProps) {
  const {
    selectedMonth,
    recurringRules,
    skyoneLoan,
    accounts,
    transactions,
    isPrivacyMode,
    getAccountById,
    quickApplyRecurringNotification,
    quickPayInstallmentNotification,
    quickRecordUndo,
    undoLastQuickRecord,
    setActiveTab,
    switchSubApp,
  } = useFinance();

  const haptic = useHaptic();
  const initialMonth = selectedMonth === "ALL" ? getCurrentMonthKey() : selectedMonth;
  const [calendarMonth, setCalendarMonth] = useState<string>(initialMonth);
  const [kindFilter, setKindFilter] = useState<CalendarKindFilter>("ALL");

  // Keep synced when user changes global month filter
  useEffect(() => {
    if (selectedMonth !== "ALL") {
      setCalendarMonth(selectedMonth);
    }
  }, [selectedMonth]);

  const defaultInstallmentAccountId = useMemo(() => {
    const acc =
      accounts.find((a) => a.owner === "HUSBAND" && a.type !== "CREDIT_CARD") ||
      accounts.find((a) => a.type !== "CREDIT_CARD") ||
      accounts[0];
    return acc?.id;
  }, [accounts]);

  const calendarData = useMemo(
    () =>
      buildFinancialCalendarMonth({
        monthKey: calendarMonth,
        rules: recurringRules,
        contract: skyoneLoan,
        accounts,
        transactions,
        defaultInstallmentAccountId,
      }),
    [
      calendarMonth,
      recurringRules,
      skyoneLoan,
      accounts,
      transactions,
      defaultInstallmentAccountId,
    ]
  );

  const matchesFilter = (ev: FinancialCalendarEvent): boolean => {
    if (kindFilter === "ALL") return true;
    if (kindFilter === "CREDIT_CARD") {
      return ev.kind === "CREDIT_DUE" || ev.kind === "CREDIT_STATEMENT";
    }
    return ev.kind === kindFilter;
  };

  // Pick smart default day whenever month changes: today (if in month & has events or today itself) -> first event day -> day 1
  const smartDefaultDateIso = useMemo(() => {
    const todayCell = calendarData.cells.find((c) => c.isToday);
    if (todayCell && todayCell.events.length > 0) return todayCell.dateIso;
    const firstEventCell = calendarData.cells.find((c) => c.events.length > 0);
    if (todayCell) return todayCell.dateIso;
    return firstEventCell?.dateIso || calendarData.cells[0]?.dateIso || `${calendarMonth}-01`;
  }, [calendarData, calendarMonth]);

  const [selectedDateIso, setSelectedDateIso] = useState<string>(smartDefaultDateIso);

  useEffect(() => {
    if (!selectedDateIso.startsWith(calendarMonth)) {
      setSelectedDateIso(smartDefaultDateIso);
    }
  }, [calendarMonth, selectedDateIso, smartDefaultDateIso]);

  const selectedDayCell = useMemo(
    () =>
      calendarData.cells.find((c) => c.dateIso === selectedDateIso) ||
      calendarData.cells[0],
    [calendarData.cells, selectedDateIso]
  );

  const selectedDayEvents = useMemo(
    () => (selectedDayCell?.events || []).filter(matchesFilter),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedDayCell, kindFilter]
  );

  const scheduledDaysQuickJump = useMemo(
    () =>
      calendarData.cells.filter((cell) => cell.events.some(matchesFilter)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [calendarData.cells, kindFilter]
  );

  const handleJumpToday = () => {
    const todayMonth = getCurrentMonthKey();
    const now = new Date();
    const todayIso = `${todayMonth}-${String(now.getDate()).padStart(2, "0")}`;
    setCalendarMonth(todayMonth);
    setSelectedDateIso(todayIso);
  };

  const handleQuickRecordEvent = (ev: FinancialCalendarEvent) => {
    if (!ev.canQuickRecord) return;
    if (ev.kind === "RECURRING" && ev.recurringRuleId) {
      const tx = quickApplyRecurringNotification(ev.recurringRuleId, ev.monthKey);
      if (tx) haptic.success();
      return;
    }
    if (ev.kind === "INSTALLMENT" && ev.installmentPeriod !== undefined) {
      const ok = quickPayInstallmentNotification(ev.installmentPeriod);
      if (ok) haptic.success();
    }
  };

  const leadingEmptySlots = Array.from(
    { length: calendarData.firstWeekdayOffset },
    (_, i) => i
  );

  const [, selMonthPart, selDayPart] = (selectedDayCell?.dateIso || "").split("-");

  return (
    <section
      aria-label="Lịch tài chính hàng tháng"
      data-testid={compact ? "mobile-financial-calendar" : "desktop-financial-calendar"}
      className="bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 shadow-xs overflow-hidden"
    >
      {/* Top Toolbar */}
      <div className="px-4 sm:px-5 py-4 border-b border-[#E9EEF5] dark:border-slate-800 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <CalendarDays className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-extrabold text-[#172B4D] dark:text-slate-100 truncate">
                Lịch Tài Chính · {getMonthDisplayLabel(calendarMonth)}
              </h3>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 tabular-nums truncate">
                {calendarData.summary.paidCount} đã ghi · {calendarData.summary.pendingCount} chờ ghi
                {calendarData.summary.overdueCount > 0
                  ? ` · ${calendarData.summary.overdueCount} quá hạn`
                  : ""}
                {" · "}
                {calendarData.summary.cardEventCount} mốc thẻ tín dụng
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setCalendarMonth((m) => shiftMonthKey(m, -1))}
              aria-label="Tháng trước"
              className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleJumpToday}
              className="min-h-[36px] px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
            >
              Hôm nay
            </button>
            <button
              type="button"
              onClick={() => setCalendarMonth((m) => shiftMonthKey(m, 1))}
              aria-label="Tháng sau"
              className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter Bar + Legend */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg border border-[#E9EEF5] dark:border-slate-700 overflow-x-auto max-w-full">
            {(
              [
                { id: "ALL", label: "Tất cả" },
                { id: "RECURRING", label: "Định kỳ" },
                { id: "INSTALLMENT", label: "Trả góp" },
                { id: "CREDIT_CARD", label: "Thẻ tín dụng" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setKindFilter(tab.id)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                  kindFilter === tab.id
                    ? "bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 shadow-2xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Đã ghi
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Sắp hạn (3 ngày)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              Quá hạn
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              Dự kiến / Thẻ
            </span>
          </div>
        </div>
      </div>

      {/* Main Split: Calendar Grid + Inline Day Detail Panel */}
      <div className={compact ? "flex flex-col" : "grid grid-cols-1 lg:grid-cols-12"}>
        {/* Left: 7-column Calendar Month Grid */}
        <div className={compact ? "p-3.5" : "lg:col-span-7 p-4 sm:p-5"}>
          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1 mb-1.5">
            {WEEKDAY_LABELS.map((wd) => (
              <div
                key={wd}
                className="text-center text-[11px] font-bold text-slate-400 dark:text-slate-500 py-1"
              >
                {wd}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1">
            {leadingEmptySlots.map((idx) => (
              <div
                key={`empty_${idx}`}
                className={compact ? "min-h-[44px]" : "min-h-[54px] sm:min-h-[60px]"}
              />
            ))}

            {calendarData.cells.map((cell) => {
              const filtered = cell.events.filter(matchesFilter);
              const isSelected = cell.dateIso === selectedDayCell?.dateIso;
              const hasEvents = filtered.length > 0;
              const hasOverdue = filtered.some((e) => e.status === "OVERDUE");
              const hasDueSoon = filtered.some(
                (e) => e.status === "DUE_TODAY" || e.status === "DUE_SOON"
              );
              const hasPending = filtered.some(
                (e) => e.status === "UPCOMING" || e.status === "CARD_INFO"
              );
              const hasPaid = filtered.some((e) => e.status === "APPLIED");

              // Summary numeric preview on desktop cells when space allows
              const primaryAmountEvent = filtered.find(
                (e) => e.kind === "RECURRING" || e.kind === "INSTALLMENT"
              );

              return (
                <button
                  key={cell.dateIso}
                  type="button"
                  data-testid={`calendar-day-${cell.day}`}
                  onClick={() => setSelectedDateIso(cell.dateIso)}
                  aria-label={`Ngày ${cell.day} tháng ${calendarData.monthNumber}, ${filtered.length} sự kiện`}
                  aria-pressed={isSelected}
                  className={`relative rounded-lg p-1.5 flex flex-col items-center justify-between transition-all cursor-pointer border ${
                    compact ? "min-h-[44px]" : "min-h-[54px] sm:min-h-[60px]"
                  } ${
                    isSelected
                      ? "bg-blue-50 dark:bg-blue-950/60 border-blue-600 dark:border-blue-400 ring-1 ring-blue-600/30 dark:ring-blue-400/30"
                      : cell.isToday
                      ? "bg-slate-50 dark:bg-slate-800/80 border-blue-300 dark:border-blue-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                      : hasEvents
                      ? "bg-white dark:bg-slate-900 border-[#E9EEF5] dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/70"
                      : "bg-transparent border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  }`}
                >
                  <span
                    className={`text-xs font-bold tabular-nums leading-none ${
                      isSelected
                        ? "text-blue-700 dark:text-blue-300 font-black"
                        : cell.isToday
                        ? "text-blue-600 dark:text-blue-400 font-black"
                        : hasEvents
                        ? "text-[#172B4D] dark:text-slate-100"
                        : "text-slate-400 dark:text-slate-500"
                    }`}
                  >
                    {cell.day}
                  </span>

                  {/* Event Indicators */}
                  {hasEvents ? (
                    <div className="flex flex-col items-center gap-0.5 w-full mt-1">
                      <div className="flex items-center justify-center gap-1">
                        {hasOverdue && <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />}
                        {hasDueSoon && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
                        {hasPending && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                        {hasPaid && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                      </div>
                      {!compact && primaryAmountEvent && (
                        <span className="hidden sm:block text-[9px] font-bold text-slate-500 dark:text-slate-400 tabular-nums truncate max-w-full">
                          {formatShortVNDMasked(primaryAmountEvent.amount, isPrivacyMode)}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="h-2" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Quick Jump Strip to Scheduled Days */}
          {scheduledDaysQuickJump.length > 0 && (
            <div className="mt-3 pt-2.5 border-t border-[#E9EEF5] dark:border-slate-800 flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="font-semibold text-slate-500 dark:text-slate-400 mr-0.5">
                Ngày có lịch:
              </span>
              {scheduledDaysQuickJump.map((cell) => {
                const active = cell.dateIso === selectedDayCell?.dateIso;
                return (
                  <button
                    key={cell.dateIso}
                    type="button"
                    onClick={() => setSelectedDateIso(cell.dateIso)}
                    className={`px-2 py-0.5 rounded-md font-bold tabular-nums cursor-pointer transition-colors ${
                      active
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
                    }`}
                  >
                    {cell.day}/{calendarData.monthNumber}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right / Bottom: Selected Day Detail Panel */}
        <div
          data-testid="calendar-day-detail-panel"
          className={`${
            compact
              ? "border-t border-[#E9EEF5] dark:border-slate-800 p-4"
              : "lg:col-span-5 border-t lg:border-t-0 lg:border-l border-[#E9EEF5] dark:border-slate-800 p-5"
          } bg-slate-50/60 dark:bg-slate-900/40 flex flex-col justify-between gap-4`}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[#E9EEF5] dark:border-slate-800">
              <div className="min-w-0">
                <h4 className="text-sm font-extrabold text-[#172B4D] dark:text-slate-100 tabular-nums truncate">
                  Ngày {selDayPart}/{selMonthPart}/{calendarData.year}
                  {selectedDayCell?.isToday ? " · Hôm nay" : ""}
                </h4>
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 tabular-nums">
                  {selectedDayEvents.length > 0
                    ? `${selectedDayEvents.length} mốc tài chính trong ngày`
                    : "Không có khoản cố định hay hạn thẻ"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab("planning")}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
              >
                Quản lý định kỳ
              </button>
            </div>

            {/* Inline Quick-Record Undo confirmation right inside calendar detail */}
            {quickRecordUndo && (
              <div
                role="status"
                className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between gap-2 text-xs"
              >
                <div className="flex items-center gap-1.5 min-w-0 text-emerald-800 dark:text-emerald-200 font-bold">
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{quickRecordUndo.label}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const ok = undoLastQuickRecord();
                    if (ok) haptic.light();
                  }}
                  className="px-2.5 py-1 rounded-md bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 text-[11px] font-extrabold inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Hoàn tác</span>
                </button>
              </div>
            )}

            {selectedDayEvents.length === 0 ? (
              <div className="py-6 text-center space-y-2">
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Ngày {selDayPart}/{selMonthPart} chưa có khoản chi định kỳ, trả góp hoặc hạn thẻ nào.
                </p>
                {scheduledDaysQuickJump.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedDateIso(scheduledDaysQuickJump[0].dateIso)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-700 cursor-pointer transition-colors"
                  >
                    Đến ngày có lịch gần nhất ({scheduledDaysQuickJump[0].day}/
                    {calendarData.monthNumber})
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-[#E9EEF5] dark:divide-slate-800">
                {selectedDayEvents.map((ev) => {
                  const acc = ev.accountId ? getAccountById(ev.accountId) : undefined;
                  return (
                    <div
                      key={ev.id}
                      data-testid={`calendar-event-${ev.id}`}
                      className="py-3 first:pt-1 last:pb-1 flex flex-col gap-2"
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 text-[#172B4D] dark:text-slate-100">
                            <span className={getStatusTextClass(ev.status)}>
                              {getKindIcon(ev.kind)}
                            </span>
                            <p className="text-xs sm:text-sm font-bold truncate">
                              {ev.title}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                            <span className={`font-bold ${getStatusTextClass(ev.status)}`}>
                              {getStatusLabel(ev.status)}
                            </span>
                            <span>·</span>
                            <span>{ev.subtitle}</span>
                            {acc && (
                              <>
                                <span>·</span>
                                <span className="truncate">{acc.name}</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span
                            className={`text-xs sm:text-sm font-black tabular-nums ${
                              ev.amount === 0
                                ? "text-slate-500 dark:text-slate-400"
                                : ev.transactionType === "INCOME"
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-rose-600 dark:text-rose-400"
                            }`}
                          >
                            {ev.amount > 0
                              ? ev.transactionType === "INCOME"
                                ? "+"
                                : "-"
                              : ""}
                            {formatVNDMasked(ev.amount, isPrivacyMode)}
                          </span>
                        </div>
                      </div>

                      {/* Event Action Row */}
                      <div className="flex items-center justify-end gap-2">
                        {ev.canQuickRecord ? (
                          <button
                            type="button"
                            data-testid={
                              ev.kind === "RECURRING" && ev.recurringRuleId
                                ? `calendar-quick-record-${ev.recurringRuleId}`
                                : ev.installmentPeriod !== undefined
                                ? `calendar-quick-installment-${ev.installmentPeriod}`
                                : undefined
                            }
                            onClick={() => handleQuickRecordEvent(ev)}
                            className={`min-h-[38px] sm:min-h-[34px] px-3 py-1.5 rounded-lg text-white text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer active:scale-95 transition-all ${
                              ev.status === "OVERDUE"
                                ? "bg-rose-600 hover:bg-rose-700"
                                : "bg-blue-600 hover:bg-blue-700"
                            }`}
                          >
                            <Zap className="w-3.5 h-3.5" />
                            <span>Ghi sổ nhanh</span>
                          </button>
                        ) : ev.kind === "CREDIT_DUE" || ev.kind === "CREDIT_STATEMENT" ? (
                          <button
                            type="button"
                            onClick={() => setActiveTab("accounts")}
                            className="min-h-[34px] px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            Xem thẻ BIDV
                          </button>
                        ) : ev.kind === "INSTALLMENT" ? (
                          <button
                            type="button"
                            onClick={() =>
                              switchSubApp("SKYONE", {
                                skyoneTab: "SCHEDULE",
                                highlightPeriod: ev.installmentPeriod,
                              })
                            }
                            className="min-h-[34px] px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            Xem kỳ SKYONE
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                            <Check className="w-3.5 h-3.5" />
                            Đã hạch toán kỳ {ev.monthKey}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Monthly Fixed Cashflow Footer Summary */}
          <div className="pt-3 border-t border-[#E9EEF5] dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold text-slate-600 dark:text-slate-300 tabular-nums">
            <span>
              Tổng chi cố định kỳ:{" "}
              <strong className="text-rose-600 dark:text-rose-400">
                {formatVNDMasked(calendarData.summary.totalScheduledExpense, isPrivacyMode)}
              </strong>
            </span>
            {calendarData.summary.totalScheduledIncome > 0 && (
              <span>
                Thu định kỳ:{" "}
                <strong className="text-emerald-600 dark:text-emerald-400">
                  +{formatVNDMasked(calendarData.summary.totalScheduledIncome, isPrivacyMode)}
                </strong>
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
