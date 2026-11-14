"use client";

import React, { useMemo } from "react";
import { Building2, Wallet } from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { SubAppId } from "@/types/finance";
import { generateMortgageSchedule } from "@/lib/mortgageEngine";
import { formatDateVN, formatShortVNDMasked } from "@/lib/formatters";

interface AppSwitcherProps {
  collapsed?: boolean;
  onSwitched?: () => void;
}

export function AppSwitcher({ collapsed = false, onSwitched }: AppSwitcherProps) {
  const { activeApp, switchSubApp, skyoneLoan, isPrivacyMode } = useFinance();

  const deadlineStatus = useMemo(() => {
    const schedule = generateMortgageSchedule(skyoneLoan);
    const overdueCount = schedule.overdueCount;
    const nextDue = schedule.nextUnpaidInstallment;

    if (overdueCount > 0) {
      return {
        tone: "danger" as const,
        badgeText: `${overdueCount} trễ`,
        compactBadge: `${overdueCount}!`,
        tooltip: `Phú Đông SKYONE: ${overdueCount} kỳ quá hạn${
          nextDue
            ? ` · Kỳ #${nextDue.period} (${formatDateVN(nextDue.dueDate)} · ${formatShortVNDMasked(
                nextDue.totalPayment,
                isPrivacyMode
              )})`
            : ""
        }`,
      };
    }

    if (!nextDue) {
      return {
        tone: "success" as const,
        badgeText: "Xong",
        compactBadge: "✓",
        tooltip: "Phú Đông SKYONE: Đã tất toán 100% dư nợ",
      };
    }

    const shortDate = `${nextDue.dueDate.slice(8, 10)}/${nextDue.dueDate.slice(5, 7)}`;
    const isDueSoon = nextDue.status === "DUE_SOON";
    const daysText =
      nextDue.daysUntilDue === 0
        ? "hôm nay"
        : nextDue.daysUntilDue === 1
        ? "ngày mai"
        : `còn ${nextDue.daysUntilDue} ngày`;

    return {
      tone: isDueSoon ? ("warning" as const) : ("neutral" as const),
      badgeText: shortDate,
      compactBadge: isDueSoon ? shortDate : null,
      tooltip: `Kỳ #${nextDue.period} (${daysText}) · Hạn ${formatDateVN(
        nextDue.dueDate
      )} · ${formatShortVNDMasked(nextDue.totalPayment, isPrivacyMode)}`,
    };
  }, [skyoneLoan, isPrivacyMode]);

  const handleSelect = (app: SubAppId) => {
    if (app !== activeApp) {
      switchSubApp(app);
    }
    onSwitched?.();
  };

  const badgeClass =
    deadlineStatus.tone === "danger"
      ? "bg-rose-500 text-white"
      : deadlineStatus.tone === "warning"
      ? "bg-amber-400 text-amber-950"
      : deadlineStatus.tone === "success"
      ? "bg-emerald-500 text-white"
      : activeApp === "SKYONE"
      ? "bg-indigo-800/80 text-indigo-100 border border-indigo-300/30"
      : "bg-white/15 text-blue-100";

  if (collapsed) {
    return (
      <div
        role="tablist"
        aria-label="Chuyển đổi phân hệ ứng dụng"
        className="px-2.5 pt-3 pb-1 flex flex-col items-center gap-1.5 shrink-0"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeApp === "FINANCE"}
          data-testid="app-switcher-finance"
          onClick={() => handleSelect("FINANCE")}
          title="HOME MONI · Thu chi tổ ấm"
          aria-label="Chuyển sang HOME MONI Thu chi tổ ấm"
          className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
            activeApp === "FINANCE"
              ? "bg-white text-blue-800 shadow-md"
              : "bg-white/10 text-blue-100 hover:bg-white/20"
          }`}
        >
          <Wallet className="w-4 h-4" />
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeApp === "SKYONE"}
          data-testid="app-switcher-skyone"
          onClick={() => handleSelect("SKYONE")}
          title={deadlineStatus.tooltip}
          aria-label={deadlineStatus.tooltip}
          className={`relative w-10 h-10 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
            activeApp === "SKYONE"
              ? "bg-indigo-500 text-white shadow-md ring-1 ring-white/30"
              : "bg-white/10 text-blue-100 hover:bg-white/20"
          }`}
        >
          <Building2 className="w-4 h-4" />
          {deadlineStatus.compactBadge && (
            <span
              data-testid="app-switcher-skyone-status"
              className={`absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-black flex items-center justify-center shadow-sm tabular-nums ring-2 ring-[#1E3A8A] dark:ring-slate-900 ${
                deadlineStatus.tone === "danger"
                  ? "bg-rose-500 text-white"
                  : deadlineStatus.tone === "success"
                  ? "bg-emerald-500 text-white"
                  : "bg-amber-400 text-amber-950"
              }`}
            >
              {deadlineStatus.compactBadge}
            </span>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="px-3 pt-3 pb-1 shrink-0">
      <div
        role="tablist"
        aria-label="Chuyển đổi phân hệ ứng dụng"
        className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-black/25 border border-white/10"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeApp === "FINANCE"}
          data-testid="app-switcher-finance"
          onClick={() => handleSelect("FINANCE")}
          className={`min-h-[36px] px-2.5 py-1.5 rounded-lg text-[11px] font-bold inline-flex items-center justify-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
            activeApp === "FINANCE"
              ? "bg-white text-blue-900 shadow-sm"
              : "text-white/75 hover:text-white hover:bg-white/10"
          }`}
        >
          <Wallet className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Thu chi</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeApp === "SKYONE"}
          data-testid="app-switcher-skyone"
          title={deadlineStatus.tooltip}
          onClick={() => handleSelect("SKYONE")}
          className={`min-h-[36px] px-2 py-1.5 rounded-lg text-[11px] font-bold inline-flex items-center justify-center gap-1 transition-all whitespace-nowrap cursor-pointer ${
            activeApp === "SKYONE"
              ? "bg-indigo-500 text-white shadow-sm ring-1 ring-white/25"
              : "text-white/75 hover:text-white hover:bg-white/10"
          }`}
        >
          <Building2 className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">SKYONE</span>
          <span
            data-testid="app-switcher-skyone-status"
            className={`px-1.5 py-0.5 rounded-md text-[9px] font-extrabold leading-none shrink-0 tabular-nums ${badgeClass}`}
          >
            {deadlineStatus.badgeText}
          </span>
        </button>
      </div>
    </div>
  );
}
