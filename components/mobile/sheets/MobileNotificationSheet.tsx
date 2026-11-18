"use client";

import React, { useState } from "react";
import { X, Bell, Check, Repeat, AlertTriangle, BellRing, BellOff } from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { getCurrentMonthKey } from "@/lib/formatters";
import { useHaptic } from "@/src/hooks/useHaptic";

interface MobileNotificationSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileNotificationSheet({
  isOpen,
  onClose,
}: MobileNotificationSheetProps) {
  const {
    notifications,
    markNotificationRead,
    recurringRules,
    selectedMonth,
    applyRecurringRule,
    applyAllPendingRecurringRules,
    browserNotifStatus,
    browserNotifEnabled,
    enableBrowserNotifications,
    disableBrowserNotifications,
  } = useFinance();

  const [appliedMsg, setAppliedMsg] = useState<string | null>(null);
  const haptic = useHaptic();

  if (!isOpen) return null;

  const activeMonth = selectedMonth === "ALL" ? getCurrentMonthKey() : selectedMonth;
  const pendingCount = recurringRules.filter(
    (r) => r.isActive && r.lastAppliedMonth !== activeMonth
  ).length;

  const showFeedback = (msg: string) => {
    setAppliedMsg(msg);
    window.setTimeout(() => setAppliedMsg(null), 3500);
  };

  const handleApplySingleRecurring = (ruleId: string, monthKey?: string) => {
    const targetMonth = monthKey || activeMonth;
    const tx = applyRecurringRule(ruleId, targetMonth);
    if (tx) {
      haptic.success();
      showFeedback(`Đã ghi sổ "${tx.note || "khoản định kỳ"}" cho kỳ ${targetMonth}.`);
    }
  };

  const handleApplyAllRecurring = () => {
    const count = applyAllPendingRecurringRules(activeMonth);
    if (count > 0) {
      haptic.success();
      showFeedback(`Đã ghi sổ ${count} giao dịch định kỳ cho kỳ ${activeMonth}.`);
    }
  };

  const handleToggleBrowserPush = async () => {
    if (browserNotifEnabled) {
      disableBrowserNotifications();
      showFeedback("Đã tắt thông báo đẩy trình duyệt.");
      return;
    }
    const granted = await enableBrowserNotifications();
    if (granted) {
      haptic.success();
      showFeedback("Đã bật thông báo đẩy nhắc chi định kỳ & ngân sách.");
    } else if (browserNotifStatus === "unsupported") {
      showFeedback("Trình duyệt này không hỗ trợ thông báo đẩy.");
    } else {
      showFeedback("Quyền thông báo đang bị chặn trong cài đặt trình duyệt.");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-end justify-center pt-safe md:hidden animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Cảnh báo và nhắc nhở gia đình"
        className="w-full bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl border-t border-slate-200 dark:border-slate-800 max-h-[82vh] pb-safe flex flex-col animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-3 mb-1" />

        <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h3 className="text-sm font-extrabold text-[#172B4D] dark:text-slate-100 tabular-nums">
              Cảnh báo & Nhắc nhở ({notifications.length})
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng thông báo"
            className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-3">
          {/* Toggle thông báo đẩy trình duyệt */}
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              {browserNotifEnabled ? (
                <BellRing className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <BellOff className="w-4 h-4 text-slate-400 shrink-0" />
              )}
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                  Thông báo đẩy trình duyệt
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {browserNotifStatus === "unsupported"
                    ? "Trình duyệt chưa hỗ trợ Notification API"
                    : browserNotifStatus === "denied"
                    ? "Quyền thông báo đang bị chặn"
                    : browserNotifEnabled
                    ? "Đang bật · Nhắc định kỳ trước 3 ngày & ngân sách"
                    : "Nhắc chi định kỳ & ngân sách vượt ngưỡng"}
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={browserNotifStatus === "unsupported"}
              onClick={() => void handleToggleBrowserPush()}
              className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 ${
                browserNotifEnabled
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
              }`}
            >
              {browserNotifEnabled ? "Đang bật" : "Bật đẩy"}
            </button>
          </div>

          {appliedMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{appliedMsg}</span>
            </div>
          )}

          {pendingCount > 0 && (
            <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-500/30 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-extrabold text-[#1E3A8A] dark:text-blue-300 tabular-nums">
                  {pendingCount} giao dịch định kỳ chờ ghi sổ
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                  Áp dụng nhanh cho kỳ {activeMonth}
                </p>
              </div>
              <button
                type="button"
                onClick={handleApplyAllRecurring}
                className="min-h-[40px] px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Repeat className="w-3.5 h-3.5" />
                <span>Ghi sổ hết</span>
              </button>
            </div>
          )}

          {notifications.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <AlertTriangle className="w-6 h-6 text-slate-300 dark:text-slate-600 mx-auto" />
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Không còn cảnh báo nào chưa đọc.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {notifications.map((n) => (
                <div key={n.id} className="py-3 flex items-start gap-3">
                  <span
                    className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${
                      n.type === "danger"
                        ? "bg-rose-500"
                        : n.type === "warning"
                        ? "bg-amber-500"
                        : "bg-blue-500"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{n.title}</p>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                      {n.message}
                    </p>
                    <div className="flex items-center justify-between gap-2 mt-2">
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 tabular-nums">
                        {n.date}
                      </span>
                      {n.actionType === "APPLY_RECURRING" && n.recurringRuleId && (
                        <button
                          type="button"
                          onClick={() => handleApplySingleRecurring(n.recurringRuleId!, n.monthKey)}
                          className="min-h-[36px] px-3 py-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Repeat className="w-3.5 h-3.5" />
                          <span>Ghi sổ</span>
                        </button>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      haptic.light();
                      markNotificationRead(n.id);
                    }}
                    aria-label="Đánh dấu đã đọc"
                    className="min-w-[40px] min-h-[40px] rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-500/20 text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center justify-center transition-all active:scale-95 cursor-pointer shrink-0"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
