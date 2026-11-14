"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  LayoutGrid,
  Check,
  AlertTriangle,
  Clock,
  X,
} from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { generateMortgageSchedule } from "@/lib/mortgageEngine";
import { formatDateVN } from "@/lib/formatters";
import {
  FinanceAppIconSvg,
  SkyOneAppIconSvg,
} from "@/components/common/SubAppIcons";

interface AppSwitcherWaffleProps {
  variant?: "default" | "compact";
  align?: "left" | "right";
}

function NineDotsWaffleSvg({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <circle cx="4" cy="4" r="1.65" />
      <circle cx="10" cy="4" r="1.65" />
      <circle cx="16" cy="4" r="1.65" />
      <circle cx="4" cy="10" r="1.65" />
      <circle cx="10" cy="10" r="1.65" />
      <circle cx="16" cy="10" r="1.65" />
      <circle cx="4" cy="16" r="1.65" />
      <circle cx="10" cy="16" r="1.65" />
      <circle cx="16" cy="16" r="1.65" />
    </svg>
  );
}

export function AppSwitcherWaffle({
  variant = "default",
  align = "left",
}: AppSwitcherWaffleProps) {
  const { activeApp, switchSubApp, openAppLauncher, skyoneLoan } = useFinance();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const urgentSkyoneStatus = useMemo(() => {
    const schedule = generateMortgageSchedule(skyoneLoan);
    if (schedule.overdueCount > 0) {
      return {
        kind: "danger" as const,
        label: `Quá hạn ${schedule.overdueCount} kỳ`,
      };
    }
    const nextDue = schedule.nextUnpaidInstallment;
    if (nextDue && nextDue.status === "DUE_SOON") {
      return {
        kind: "warning" as const,
        label:
          nextDue.daysUntilDue === 0
            ? `Hôm nay hạn kỳ #${nextDue.period}`
            : `Còn ${nextDue.daysUntilDue} ngày (${formatDateVN(nextDue.dueDate)})`,
      };
    }
    return null;
  }, [skyoneLoan]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.altKey && event.key.toLowerCase() === "m") {
        event.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleOpenLauncher = () => {
    setIsOpen(false);
    openAppLauncher();
  };

  const handleSelectFinance = () => {
    setIsOpen(false);
    if (activeApp !== "FINANCE") {
      switchSubApp("FINANCE", { financeTab: "overview" });
    }
  };

  const handleSelectSkyOne = () => {
    setIsOpen(false);
    if (activeApp !== "SKYONE") {
      switchSubApp("SKYONE", { skyoneTab: "OVERVIEW" });
    }
  };

  const isCompact = variant === "compact";

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Mở App Switcher (Alt+M)"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        data-testid="waffle-menu-trigger"
        title="Chuyển phân hệ / Về App Launcher (Alt+M)"
        className={`relative flex items-center justify-center rounded-lg border transition-colors duration-150 cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
          isCompact ? "w-8 h-8" : "w-9 h-9"
        } ${
          isOpen
            ? "bg-blue-50 dark:bg-slate-800 border-blue-400 dark:border-indigo-500 text-blue-700 dark:text-indigo-300"
            : "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border-[#DCE4EE] dark:border-slate-700 text-slate-700 dark:text-slate-200"
        }`}
      >
        <NineDotsWaffleSvg className={isCompact ? "w-4 h-4" : "w-[18px] h-[18px]"} />
        {urgentSkyoneStatus && activeApp !== "SKYONE" && (
          <span
            title={urgentSkyoneStatus.label}
            className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-slate-900 ${
              urgentSkyoneStatus.kind === "danger" ? "bg-rose-500" : "bg-amber-400"
            }`}
          />
        )}
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label="Chuyển đổi phân hệ ứng dụng"
          data-testid="waffle-menu-popover"
          className={`absolute top-full mt-2 w-72 sm:w-80 bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-700 shadow-xl z-50 overflow-hidden animate-in fade-in duration-150 ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-[#E9EEF5] dark:border-slate-800 flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-extrabold text-[#0F172A] dark:text-slate-100">
                App Switcher
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Chuyển nhanh giữa các không gian làm việc
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Đóng App Switcher"
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-2 space-y-1">
            {/* Về App Launcher */}
            <button
              type="button"
              role="menuitem"
              data-testid="waffle-item-launcher"
              onClick={handleOpenLauncher}
              className="w-full p-2.5 rounded-lg flex items-center gap-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors cursor-pointer"
            >
              <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-[#DCE4EE] dark:border-slate-700 flex items-center justify-center shrink-0">
                <LayoutGrid className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-[#0F172A] dark:text-slate-100">
                  App Launcher
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  Quay về trang chọn ứng dụng trung tâm
                </p>
              </div>
            </button>

            <div className="my-1 border-t border-[#E9EEF5] dark:border-slate-800" />

            {/* Sub-app 1: Thu Chi */}
            <button
              type="button"
              role="menuitem"
              data-testid="waffle-item-finance"
              onClick={handleSelectFinance}
              className={`w-full p-2.5 rounded-lg flex items-center gap-3 text-left transition-colors cursor-pointer ${
                activeApp === "FINANCE"
                  ? "bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800"
                  : "hover:bg-slate-50 dark:hover:bg-slate-800/80 border border-transparent"
              }`}
            >
              <div className="w-10 h-10 rounded-lg bg-slate-50 dark:bg-slate-800 border border-[#E9EEF5] dark:border-slate-700 flex items-center justify-center shrink-0">
                <FinanceAppIconSvg className="w-7 h-7" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-extrabold text-[#0F172A] dark:text-slate-100 truncate">
                    Thu Chi Tổ Ấm
                  </p>
                  {activeApp === "FINANCE" && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 dark:text-blue-300 shrink-0">
                      <Check className="w-3 h-3" />
                      Đang mở
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  Sổ giao dịch, thẻ &amp; ngân sách
                </p>
              </div>
            </button>

            {/* Sub-app 2: SKYONE */}
            <button
              type="button"
              role="menuitem"
              data-testid="waffle-item-skyone"
              onClick={handleSelectSkyOne}
              className={`w-full p-2.5 rounded-lg flex items-center gap-3 text-left transition-colors cursor-pointer ${
                activeApp === "SKYONE"
                  ? "bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800"
                  : "hover:bg-slate-50 dark:hover:bg-slate-800/80 border border-transparent"
              }`}
            >
              <div className="w-10 h-10 rounded-lg bg-slate-50 dark:bg-slate-800 border border-[#E9EEF5] dark:border-slate-700 flex items-center justify-center shrink-0">
                <SkyOneAppIconSvg className="w-7 h-7" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-extrabold text-[#0F172A] dark:text-slate-100 truncate">
                    Phú Đông SKYONE
                  </p>
                  {activeApp === "SKYONE" && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 dark:text-indigo-300 shrink-0">
                      <Check className="w-3 h-3" />
                      Đang mở
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  Khoản vay BIDV &amp; Cố vấn 08/2028
                </p>
                {urgentSkyoneStatus && (
                  <p
                    className={`mt-1 inline-flex items-center gap-1 text-[10px] font-bold tabular-nums ${
                      urgentSkyoneStatus.kind === "danger"
                        ? "text-rose-700 dark:text-rose-300"
                        : "text-amber-700 dark:text-amber-300"
                    }`}
                  >
                    {urgentSkyoneStatus.kind === "danger" ? (
                      <AlertTriangle className="w-3 h-3 shrink-0" />
                    ) : (
                      <Clock className="w-3 h-3 shrink-0" />
                    )}
                    <span>{urgentSkyoneStatus.label}</span>
                  </p>
                )}
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
