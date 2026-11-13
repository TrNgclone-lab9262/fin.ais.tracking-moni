"use client";

import React, { useState } from "react";
import { X, Bell, Check, Repeat, AlertTriangle } from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { getCurrentMonthKey } from "@/lib/formatters";

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
    applyAllPendingRecurringRules,
  } = useFinance();

  const [appliedMsg, setAppliedMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const activeMonth = selectedMonth === "ALL" ? getCurrentMonthKey() : selectedMonth;
  const pendingCount = recurringRules.filter(
    (r) => r.isActive && r.lastAppliedMonth !== activeMonth
  ).length;

  const handleApplyAllRecurring = () => {
    const count = applyAllPendingRecurringRules(activeMonth);
    if (count > 0) {
      setAppliedMsg(`Đã ghi sổ ${count} giao dịch định kỳ cho kỳ ${activeMonth}.`);
      setTimeout(() => setAppliedMsg(null), 3500);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-end justify-center md:hidden animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Cảnh báo và nhắc nhở gia đình"
        className="w-full bg-white rounded-t-3xl shadow-2xl border-t border-slate-200 max-h-[82vh] flex flex-col animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1.5 bg-slate-300 rounded-full mx-auto mt-3 mb-1" />

        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-extrabold text-[#172B4D]">
              Cảnh báo & Nhắc nhở ({notifications.length})
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng thông báo"
            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-3">
          {appliedMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{appliedMsg}</span>
            </div>
          )}

          {pendingCount > 0 && (
            <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-extrabold text-[#1E3A8A]">
                  {pendingCount} giao dịch định kỳ chờ ghi sổ
                </div>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Áp dụng nhanh cho kỳ {activeMonth}
                </p>
              </div>
              <button
                type="button"
                onClick={handleApplyAllRecurring}
                className="min-h-[40px] px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <Repeat className="w-3.5 h-3.5" />
                <span>Ghi sổ hết</span>
              </button>
            </div>
          )}

          {notifications.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <AlertTriangle className="w-6 h-6 text-slate-300 mx-auto" />
              <p className="text-xs text-slate-500 font-medium">
                Không còn cảnh báo nào chưa đọc.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
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
                    <p className="text-xs font-bold text-slate-800">{n.title}</p>
                    <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                      {n.message}
                    </p>
                    <span className="text-[10px] text-slate-400 mt-1 block">{n.date}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => markNotificationRead(n.id)}
                    aria-label="Đánh dấu đã đọc"
                    className="min-w-[36px] min-h-[36px] rounded-lg bg-slate-100 hover:bg-emerald-50 text-slate-500 hover:text-emerald-600 flex items-center justify-center cursor-pointer shrink-0"
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
