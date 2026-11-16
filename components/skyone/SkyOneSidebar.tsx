"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Building2,
  TrendingDown,
  Table2,
  Calendar,
  Calculator,
  SlidersHorizontal,
  Database,
  Settings,
  ChevronLeft,
  ChevronRight,
  Lock,
  Compass,
} from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { usePWAUpdate } from "@/context/PWAUpdateContext";
import { APP_VERSION } from "@/constants/appVersion";
import { SkyOneRouteTab } from "@/types/finance";
import { generateMortgageSchedule } from "@/lib/mortgageEngine";
import { useResponsive } from "@/src/hooks/useResponsive";

interface SkyOneNavItemDef {
  id: SkyOneRouteTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: {
    text: string;
    variant: "warning" | "danger" | "info";
  };
}

interface SkyOneNavGroup {
  title: string;
  items: SkyOneNavItemDef[];
}

export function SkyOneSidebar() {
  const {
    skyoneTab,
    setSkyoneTab,
    skyoneLoan,
    lockApp,
  } = useFinance();

  const { hasUpdate } = usePWAUpdate();
  const { isCompact } = useResponsive();
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("HOME_MONI_SIDEBAR_COLLAPSED");
      if (saved !== null) {
        setIsCollapsed(saved === "true");
      } else {
        setIsCollapsed(isCompact);
      }
    } catch {
      setIsCollapsed(isCompact);
    }
  }, [isCompact]);

  const toggleCollapse = () => {
    const nextState = !isCollapsed;
    setIsCollapsed(nextState);
    try {
      localStorage.setItem("HOME_MONI_SIDEBAR_COLLAPSED", String(nextState));
    } catch {
      // ignore
    }
  };

  const scheduleSummary = useMemo(() => generateMortgageSchedule(skyoneLoan), [skyoneLoan]);

  const urgentCount = useMemo(
    () =>
      scheduleSummary.rows.filter(
        (r) => r.status === "OVERDUE" || r.status === "DUE_SOON"
      ).length,
    [scheduleSummary.rows]
  );

  const NAV_GROUPS: SkyOneNavGroup[] = [
    {
      title: "Quản trị Khoản vay",
      items: [
        { id: "OVERVIEW", label: "Tổng quan & Stress-Test", icon: TrendingDown },
        {
          id: "ADVISOR",
          label: "Cố vấn Chiến lược",
          icon: Compass,
          badge: { text: "08/2028", variant: "info" },
        },
        { id: "CASHFLOW", label: "Chi tiết Dòng tiền", icon: Table2 },
        {
          id: "SCHEDULE",
          label: "Lịch trả nợ",
          icon: Calendar,
          badge:
            urgentCount > 0
              ? { text: `${urgentCount} kỳ`, variant: "warning" }
              : {
                  text: `${scheduleSummary.paidCount}/${scheduleSummary.totalScheduledMonths}`,
                  variant: "info",
                },
        },
        { id: "PREPAYMENT", label: "Trả gốc trước hạn", icon: Calculator },
        { id: "CONTRACT", label: "Hợp đồng & Lãi suất", icon: SlidersHorizontal },
      ],
    },
    {
      title: "Hệ thống & Liên kết",
      items: [
        { id: "DATA_ADMIN", label: "Quản trị Dữ liệu", icon: Database },
        {
          id: "SETTINGS",
          label: "Cài đặt chung",
          icon: Settings,
          badge: hasUpdate ? { text: "Bản mới", variant: "info" } : undefined,
        },
      ],
    },
  ];

  return (
    <aside
      className={`hidden md:flex flex-col bg-gradient-to-b from-[#1E1B4B] via-[#312E81] to-[#0F172A] dark:from-[#0F172A] dark:via-[#111827] dark:to-[#090F1D] text-white transition-all duration-300 relative z-30 shrink-0 border-r border-indigo-900/40 dark:border-slate-800 shadow-xl shadow-indigo-950/25 sticky top-0 h-screen select-none ${
        isCollapsed ? "w-20" : "w-64"
      }`}
    >
      {/* Floating Edge Toggle */}
      <button
        type="button"
        onClick={toggleCollapse}
        aria-label={isCollapsed ? "Mở rộng menu SKYONE" : "Thu gọn menu SKYONE"}
        title={isCollapsed ? "Mở rộng menu" : "Thu gọn menu"}
        className="absolute -right-3.5 top-7 z-40 w-7 h-7 rounded-full bg-indigo-600 border-2 border-white dark:border-slate-900 text-white flex items-center justify-center shadow-lg hover:bg-indigo-500 hover:scale-110 active:scale-95 transition-all cursor-pointer"
      >
        {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>

      {/* Brand Header */}
      <div className="h-20 flex items-center justify-between px-4 border-b border-indigo-800/40 dark:border-slate-800 shrink-0">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-indigo-500 via-blue-600 to-cyan-500 flex items-center justify-center text-white shrink-0 shadow-lg shadow-indigo-500/25 ring-2 ring-white/20">
            <Building2 className="w-5 h-5" />
          </div>
          {!isCollapsed && (
            <div className="min-w-0">
              <span className="font-black text-base tracking-wide text-white block truncate leading-tight">
                SKYONE LOAN
              </span>
              <span className="text-[10px] text-indigo-200 uppercase tracking-widest font-bold block mt-0.5 truncate">
                {skyoneLoan.unitCode} · HOME MONI
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Groups */}
      <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto" aria-label="Điều hướng SKYONE">
        {NAV_GROUPS.map((group, gIdx) => (
          <div key={gIdx} className="space-y-1.5">
            {!isCollapsed && (
              <h4 className="px-3 text-[10px] font-bold text-indigo-200/65 uppercase tracking-widest mb-1.5">
                {group.title}
              </h4>
            )}

            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = skyoneTab === item.id;

              return (
                <div key={item.id} className="relative group">
                  <button
                    type="button"
                    data-testid={`skyone-nav-${item.id.toLowerCase()}`}
                    onClick={() => setSkyoneTab(item.id)}
                    className={`w-full flex items-center gap-3.5 px-3 py-2.5 rounded-md text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer ${
                      isActive
                        ? "bg-white dark:bg-indigo-600 text-indigo-950 dark:text-white shadow-md shadow-indigo-950/25 font-black"
                        : "text-indigo-100 dark:text-slate-300 hover:bg-white/10 hover:text-white hover:translate-x-1"
                    } ${isCollapsed ? "justify-center px-0 hover:translate-x-0" : ""}`}
                  >
                    <Icon
                      className={`w-5 h-5 shrink-0 transition-transform ${
                        isActive
                          ? "text-indigo-700 dark:text-white scale-110"
                          : "text-indigo-200 dark:text-slate-400 group-hover:text-white"
                      }`}
                    />

                    {!isCollapsed && (
                      <span className="truncate flex-1 text-left">{item.label}</span>
                    )}

                    {!isCollapsed && item.badge && (
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 shadow-xs tabular-nums ${
                          item.badge.variant === "warning"
                            ? "bg-amber-400 text-amber-950"
                            : item.badge.variant === "danger"
                            ? "bg-rose-500 text-white"
                            : "bg-indigo-950/70 text-indigo-100 border border-indigo-400/30"
                        }`}
                      >
                        {item.badge.text}
                      </span>
                    )}
                  </button>

                  {isCollapsed && (
                    <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-2 bg-slate-900/95 backdrop-blur-md text-white text-xs font-semibold rounded-md shadow-2xl whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 z-50 border border-slate-700/60 flex items-center gap-2">
                      <span>{item.label}</span>
                      {item.badge && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-indigo-600 text-white tabular-nums">
                          {item.badge.text}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer: Lock & Module Info */}
      {!isCollapsed ? (
        <div className="p-4 border-t border-indigo-800/40 dark:border-slate-800 text-[11px] text-indigo-200 bg-black/20 shrink-0 space-y-2.5">
          <button
            type="button"
            onClick={lockApp}
            className="w-full py-2 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Khóa màn hình (/login)</span>
          </button>

          <div className="flex items-center justify-between text-[10px] text-indigo-200/75">
            <span>SKYONE Module · v{APP_VERSION}</span>
            <span className="text-indigo-200 font-medium">Độc lập</span>
          </div>
        </div>
      ) : (
        <div className="p-3 border-t border-indigo-800/40 dark:border-slate-800 flex flex-col items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={lockApp}
            title="Khóa màn hình (/login)"
            aria-label="Khóa màn hình /login"
            className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer transition-colors"
          >
            <Lock className="w-4 h-4" />
          </button>
        </div>
      )}
    </aside>
  );
}
