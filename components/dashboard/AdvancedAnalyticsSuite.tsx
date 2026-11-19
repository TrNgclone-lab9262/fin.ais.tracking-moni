"use client";

import React, { useState } from "react";
import { SpendingTrendsOverTimeWidget } from "@/components/dashboard/SpendingTrendsOverTimeWidget";
import { MonthlyExpenseComparisonWidget } from "@/components/dashboard/MonthlyExpenseComparisonWidget";
import { IncomeVsExpenseAnalyticsWidget } from "@/components/dashboard/IncomeVsExpenseAnalyticsWidget";

type MobileAnalyticsTab = "INCOME_EXPENSE" | "SPENDING_TREND" | "MONTHLY_COMPARE";

const MOBILE_TABS: { id: MobileAnalyticsTab; label: string }[] = [
  { id: "INCOME_EXPENSE", label: "Thu vs Chi" },
  { id: "SPENDING_TREND", label: "Xu hướng chi" },
  { id: "MONTHLY_COMPARE", label: "So sánh tháng" },
];

export function AdvancedAnalyticsSuite({ compact = false }: { compact?: boolean }) {
  const [activeMobileTab, setActiveMobileTab] =
    useState<MobileAnalyticsTab>("INCOME_EXPENSE");

  if (compact) {
    return (
      <section
        data-testid="mobile-advanced-analytics-suite"
        aria-label="Biểu đồ trực quan chuyên sâu"
        className="space-y-2.5"
      >
        <div
          role="tablist"
          aria-label="Chọn biểu đồ phân tích"
          className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-[#DCE4EE] dark:border-slate-700"
        >
          {MOBILE_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeMobileTab === tab.id}
              onClick={() => setActiveMobileTab(tab.id)}
              className={`min-h-[36px] px-2 py-1.5 rounded-lg text-[11px] font-bold transition-colors whitespace-nowrap truncate cursor-pointer ${
                activeMobileTab === tab.id
                  ? "bg-white dark:bg-slate-900 text-[#1E3A8A] dark:text-blue-300 shadow-2xs"
                  : "text-slate-600 dark:text-slate-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeMobileTab === "INCOME_EXPENSE" && <IncomeVsExpenseAnalyticsWidget compact />}
        {activeMobileTab === "SPENDING_TREND" && <SpendingTrendsOverTimeWidget compact />}
        {activeMobileTab === "MONTHLY_COMPARE" && <MonthlyExpenseComparisonWidget compact />}
      </section>
    );
  }

  return (
    <section
      data-testid="desktop-advanced-analytics-suite"
      aria-label="Bộ biểu đồ phân tích trực quan tương tác"
      className="space-y-6"
    >
      <IncomeVsExpenseAnalyticsWidget />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch">
        <SpendingTrendsOverTimeWidget />
        <MonthlyExpenseComparisonWidget />
      </div>
    </section>
  );
}
