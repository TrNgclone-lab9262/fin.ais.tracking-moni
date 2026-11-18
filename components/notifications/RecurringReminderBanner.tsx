"use client";

import React, { useMemo, useState } from "react";
import {
  BellRing,
  Check,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  X,
  Zap,
  CalendarClock,
} from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { formatVNDMasked, getCurrentMonthKey } from "@/lib/formatters";
import { UnifiedDueReminder } from "@/lib/browserNotifications";
import { useHaptic } from "@/src/hooks/useHaptic";

function getTimingBadgeText(item: UnifiedDueReminder): string {
  if (item.status === "OVERDUE") {
    return `Quá hạn ${Math.abs(item.daysUntilDue)} ngày (${item.dueDateLabel})`;
  }
  if (item.status === "DUE_TODAY") {
    return `Hôm nay đến hạn (${item.dueDateLabel})`;
  }
  return `Còn ${item.daysUntilDue} ngày · Hạn ${item.dueDateLabel}`;
}

export function RecurringReminderBanner() {
  const {
    unifiedDueReminders,
    quickRecordUndo,
    quickApplyRecurringNotification,
    quickPayInstallmentNotification,
    undoLastQuickRecord,
    dismissQuickRecordUndo,
    applyRecurringRule,
    confirmSkyOnePeriods,
    accounts,
    getAccountById,
    isPrivacyMode,
    setActiveTab,
    switchSubApp,
  } = useFinance();

  const haptic = useHaptic();
  const [isSessionDismissed, setIsSessionDismissed] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [batchMessage, setBatchMessage] = useState<string | null>(null);

  const overdueCount = useMemo(
    () => unifiedDueReminders.filter((item) => item.status === "OVERDUE").length,
    [unifiedDueReminders]
  );

  const hasOverdue = overdueCount > 0;
  const showReminderCard = unifiedDueReminders.length > 0 && !isSessionDismissed;

  if (!quickRecordUndo && !showReminderCard && !batchMessage) {
    return null;
  }

  const visibleItems = showAll ? unifiedDueReminders : unifiedDueReminders.slice(0, 3);
  const hiddenCount = Math.max(0, unifiedDueReminders.length - visibleItems.length);

  const handleQuickRecordItem = (item: UnifiedDueReminder) => {
    if (item.source === "RECURRING_RULE" && item.rule) {
      const tx = quickApplyRecurringNotification(item.rule.id, item.monthKey);
      if (tx) {
        haptic.success();
        setBatchMessage(null);
      }
      return;
    }

    if (item.source === "MORTGAGE_INSTALLMENT" && item.installmentPeriod !== undefined) {
      const ok = quickPayInstallmentNotification(item.installmentPeriod);
      if (ok) {
        haptic.success();
        setBatchMessage(null);
      }
    }
  };

  const handleQuickRecordAllDue = () => {
    let recordedCount = 0;
    const installmentPeriods: number[] = [];

    for (const item of unifiedDueReminders) {
      if (item.source === "RECURRING_RULE" && item.rule) {
        const tx = applyRecurringRule(item.rule.id, item.monthKey || getCurrentMonthKey());
        if (tx) recordedCount += 1;
      } else if (item.source === "MORTGAGE_INSTALLMENT" && item.installmentPeriod !== undefined) {
        installmentPeriods.push(item.installmentPeriod);
      }
    }

    if (installmentPeriods.length > 0) {
      const fallbackAcc =
        accounts.find((a) => a.owner === "HUSBAND" && a.type !== "CREDIT_CARD") ||
        accounts.find((a) => a.type !== "CREDIT_CARD") ||
        accounts[0];
      recordedCount += confirmSkyOnePeriods(installmentPeriods, {
        linkAccountId: fallbackAcc?.id,
      });
    }

    if (recordedCount > 0) {
      haptic.success();
      setBatchMessage(`Đã ghi sổ nhanh ${recordedCount} khoản đến hạn.`);
      window.setTimeout(() => setBatchMessage(null), 5000);
    }
  };

  return (
    <div className="space-y-2.5 mb-4 sm:mb-6" data-testid="recurring-reminder-banner-root">
      {/* Thanh hoàn tác nhanh ngay sau khi Ghi sổ nhanh */}
      {quickRecordUndo && (
        <div
          role="status"
          data-testid="quick-record-undo-toast"
          className="rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-4 py-3 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 shadow-xs animate-in fade-in slide-in-from-top-1 duration-150"
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <span className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <Check className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-bold text-emerald-900 dark:text-emerald-100 truncate">
                Đã ghi sổ nhanh: {quickRecordUndo.label}
              </p>
              <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300 tabular-nums">
                {formatVNDMasked(quickRecordUndo.amount, isPrivacyMode)} · Kỳ {quickRecordUndo.monthKey} · Đã cập nhật số dư ví
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              data-testid="quick-record-undo-btn"
              onClick={() => {
                const ok = undoLastQuickRecord();
                if (ok) haptic.light();
              }}
              className="min-h-[38px] px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 text-xs font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Hoàn tác</span>
            </button>
            <button
              type="button"
              onClick={dismissQuickRecordUndo}
              aria-label="Đóng thông báo hoàn tác"
              className="p-2 rounded-lg text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Thông báo gọn khi ghi tất cả */}
      {!quickRecordUndo && batchMessage && (
        <div
          role="status"
          className="rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-4 py-2.5 flex items-center justify-between gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-200"
        >
          <span className="flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            {batchMessage}
          </span>
          <button
            type="button"
            onClick={() => setBatchMessage(null)}
            className="p-1 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900/50 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Thanh nhắc nổi các khoản sắp đến hạn (≤ 3 ngày) & quá hạn chưa ghi sổ */}
      {showReminderCard && (
        <section
          aria-label="Nhắc nhở chi tiêu định kỳ sắp đến hạn"
          data-testid="recurring-reminder-banner"
          className={`rounded-xl border shadow-xs overflow-hidden transition-colors ${
            hasOverdue
              ? "bg-rose-50/75 dark:bg-rose-950/35 border-rose-200 dark:border-rose-800/70"
              : "bg-amber-50/80 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/70"
          }`}
        >
          {/* Header */}
          <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-2 border-b border-black/5 dark:border-white/10">
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  hasOverdue
                    ? "bg-rose-600 text-white"
                    : "bg-amber-500 text-white"
                }`}
              >
                <BellRing className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <h2 className="text-xs sm:text-sm font-extrabold text-[#172B4D] dark:text-slate-100 tabular-nums">
                  {hasOverdue
                    ? `Nhắc thanh toán: ${overdueCount} khoản quá hạn & ${
                        unifiedDueReminders.length - overdueCount
                      } khoản sắp đến hạn`
                    : `Sắp đến hạn thanh toán trong 3 ngày (${unifiedDueReminders.length} khoản)`}
                </h2>
                <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                  Tiền nhà, internet, hóa đơn &amp; kỳ trả góp · Ghi sổ 1 chạm ngay trên nhắc nhở
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {unifiedDueReminders.length > 1 && (
                <button
                  type="button"
                  onClick={handleQuickRecordAllDue}
                  className="min-h-[34px] px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 text-[#172B4D] dark:text-slate-100 text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                >
                  Ghi tất cả ({unifiedDueReminders.length})
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsSessionDismissed(true)}
                aria-label="Tạm ẩn thanh nhắc nhở"
                title="Tạm ẩn trong phiên này"
                className="min-h-[34px] px-2.5 py-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-black/5 dark:hover:bg-white/10 text-xs font-semibold inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
              >
                <span>Tạm ẩn</span>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Danh sách khoản đến hạn / quá hạn */}
          <div className="divide-y divide-black/5 dark:divide-white/10 bg-white/80 dark:bg-slate-900/75">
            {visibleItems.map((item) => {
              const acc = item.accountId ? getAccountById(item.accountId) : undefined;
              const isOverdue = item.status === "OVERDUE";
              const isToday = item.status === "DUE_TODAY";

              return (
                <div
                  key={item.id}
                  data-testid={`banner-reminder-row-${item.id}`}
                  className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span
                        className={`inline-block w-2 h-2 rounded-full shrink-0 ${
                          isOverdue
                            ? "bg-rose-500"
                            : isToday
                            ? "bg-amber-500"
                            : "bg-blue-500"
                        }`}
                      />
                      <span className="text-sm font-bold text-[#172B4D] dark:text-slate-100 truncate">
                        {item.title}
                      </span>
                      <span className="text-sm font-extrabold text-rose-600 dark:text-rose-400 tabular-nums whitespace-nowrap">
                        {formatVNDMasked(item.amount, isPrivacyMode)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-0.5 pl-4 text-[11px] font-medium text-slate-600 dark:text-slate-400 tabular-nums">
                      <span
                        className={
                          isOverdue
                            ? "font-bold text-rose-600 dark:text-rose-400"
                            : isToday
                            ? "font-bold text-amber-700 dark:text-amber-300"
                            : "font-semibold text-blue-700 dark:text-blue-300"
                        }
                      >
                        <CalendarClock className="w-3 h-3 inline mr-1 -mt-0.5" />
                        {getTimingBadgeText(item)}
                      </span>
                      <span>·</span>
                      <span>
                        {item.source === "MORTGAGE_INSTALLMENT" ? "Trả góp SKYONE" : "Chi định kỳ"}
                      </span>
                      {acc && (
                        <>
                          <span>·</span>
                          <span className="truncate">Ví: {acc.name}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pl-4 sm:pl-0 shrink-0">
                    {item.source === "MORTGAGE_INSTALLMENT" && item.installmentPeriod !== undefined ? (
                      <button
                        type="button"
                        onClick={() =>
                          switchSubApp("SKYONE", {
                            skyoneTab: "SCHEDULE",
                            highlightPeriod: item.installmentPeriod,
                          })
                        }
                        className="min-h-[40px] sm:min-h-[36px] px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                      >
                        Xem lịch
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setActiveTab("planning")}
                        className="min-h-[40px] sm:min-h-[36px] px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                      >
                        Chi tiết
                      </button>
                    )}

                    <button
                      type="button"
                      data-testid={`banner-quick-record-${item.id}`}
                      onClick={() => handleQuickRecordItem(item)}
                      className={`min-h-[44px] sm:min-h-[36px] px-3.5 py-1.5 rounded-lg text-white text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer shadow-2xs active:scale-95 transition-all ${
                        isOverdue
                          ? "bg-rose-600 hover:bg-rose-700"
                          : "bg-blue-600 hover:bg-blue-700"
                      }`}
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>Ghi sổ nhanh</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {unifiedDueReminders.length > 3 && (
            <div className="px-4 py-2 bg-white/90 dark:bg-slate-900/90 border-t border-black/5 dark:border-white/10 flex justify-center">
              <button
                type="button"
                onClick={() => setShowAll((prev) => !prev)}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 cursor-pointer py-1"
              >
                {showAll ? (
                  <>
                    <ChevronUp className="w-3.5 h-3.5" />
                    <span>Thu gọn danh sách</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5" />
                    <span>Xem thêm {hiddenCount} khoản sắp đến hạn</span>
                  </>
                )}
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
