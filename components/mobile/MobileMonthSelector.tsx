"use client";

import React from "react";
import { CalendarDays } from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { getMonthDisplayLabel } from "@/lib/formatters";

export function MobileMonthSelector() {
  const { availableMonths, selectedMonth, setSelectedMonth } = useFinance();

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-0.5 px-0.5 no-scrollbar">
      <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-900 border border-[#DCE4EE] dark:border-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center shrink-0">
        <CalendarDays className="w-4 h-4" />
      </div>

      <button
        type="button"
        onClick={() => setSelectedMonth("ALL")}
        className={`min-h-[36px] px-3 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 border transition-all cursor-pointer ${
          selectedMonth === "ALL"
            ? "bg-[#1E3A8A] dark:bg-blue-600 border-[#1E3A8A] dark:border-blue-600 text-white shadow-xs"
            : "bg-white dark:bg-slate-900 border-[#DCE4EE] dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
        }`}
      >
        Tất cả
      </button>

      {availableMonths.map((monthKey) => {
        const isActive = selectedMonth === monthKey;
        return (
          <button
            key={monthKey}
            type="button"
            onClick={() => setSelectedMonth(monthKey)}
            className={`min-h-[36px] px-3 rounded-xl text-xs font-bold whitespace-nowrap tabular-nums shrink-0 border transition-all cursor-pointer ${
              isActive
                ? "bg-[#1E3A8A] dark:bg-blue-600 border-[#1E3A8A] dark:border-blue-600 text-white shadow-xs"
                : "bg-white dark:bg-slate-900 border-[#DCE4EE] dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            }`}
          >
            {getMonthDisplayLabel(monthKey)}
          </button>
        );
      })}
    </div>
  );
}
