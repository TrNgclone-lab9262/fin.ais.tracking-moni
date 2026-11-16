"use client";

import React, { useState, useEffect } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useFinance } from "@/context/FinanceContext";
import {
  formatVNDMasked,
  formatShortVNDMasked,
  getMonthDisplayLabel,
} from "@/lib/formatters";
import { PieChart as PieIcon, Info } from "lucide-react";
import { useResponsive } from "@/src/hooks/useResponsive";

interface ExpenseTooltipEntry {
  payload: {
    categoryName: string;
    categoryColor: string;
    totalAmount: number;
    percentage: number;
  };
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: ExpenseTooltipEntry[];
  isPrivacyMode: boolean;
}

function CustomTooltip({ active, payload, isPrivacyMode }: CustomTooltipProps) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900/95 backdrop-blur-md text-white text-xs p-3 rounded-xl shadow-xl border border-slate-800">
        <div className="flex items-center gap-2 mb-1.5">
          <span
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: data.categoryColor }}
          />
          <span className="font-bold text-sm text-slate-100">{data.categoryName}</span>
        </div>
        <div className="flex justify-between gap-4 text-slate-300">
          <span>Số tiền chi:</span>
          <span className="font-semibold text-white">
            {formatVNDMasked(data.totalAmount, isPrivacyMode)}
          </span>
        </div>
        <div className="flex justify-between gap-4 text-slate-300 mt-1">
          <span>Tỷ trọng:</span>
          <span className="font-bold text-amber-400">{data.percentage}%</span>
        </div>
      </div>
    );
  }
  return null;
}

export function ExpensePieChart() {
  const { categoryExpenseStats, summary, selectedMonth, isPrivacyMode } = useFinance();
  const { isMobile } = useResponsive();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const periodLabel =
    selectedMonth === "ALL" ? "Toàn thời gian" : getMonthDisplayLabel(selectedMonth);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl p-5 sm:p-6 border border-[#DCE4EE] dark:border-slate-800 shadow-xs flex flex-col h-full">
      {/* Tiêu đề Box */}
      <div className="flex items-center justify-between pb-4 border-b border-[#E9EEF5] dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center">
            <PieIcon className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#172B4D] dark:text-slate-100">Chi tiêu theo danh mục</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Tỷ trọng phân bổ ngân sách ({periodLabel.toLowerCase()})
            </p>
          </div>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-md whitespace-nowrap shrink-0">
          {categoryExpenseStats.length} danh mục
        </span>
      </div>

      {/* Nội dung Biểu đồ */}
      <div className="flex-1 flex flex-col justify-center items-center py-4">
        {categoryExpenseStats.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-lg flex items-center justify-center mx-auto mb-3">
              <Info className="w-7 h-7" />
            </div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Chưa có dữ liệu chi tiêu</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-xs mx-auto">
              Không có khoản chi nào trong {periodLabel.toLowerCase()}. Thêm một khoản chi để xem tỷ trọng.
            </p>
          </div>
        ) : (
          <div className="w-full flex flex-col items-center">
            {/* Vùng vẽ Recharts Donut */}
            <div className="relative w-full h-64 sm:h-72 max-w-xs mx-auto flex items-center justify-center">
              {isMounted && (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <PieChart>
                    <Tooltip content={<CustomTooltip isPrivacyMode={isPrivacyMode} />} />
                    <Pie
                      data={categoryExpenseStats}
                      dataKey="totalAmount"
                      nameKey="categoryName"
                      cx="50%"
                      cy="50%"
                      innerRadius={isMobile ? 54 : 65}
                      outerRadius={isMobile ? 80 : 95}
                      paddingAngle={3}
                      stroke="none"
                    >
                      {categoryExpenseStats.map((entry) => (
                        <Cell key={`cell-${entry.categoryId}`} fill={entry.categoryColor} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              )}

              {/* Tâm của Donut Chart */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Tổng chi
                </span>
                <span className="text-xl sm:text-2xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">
                  {formatShortVNDMasked(summary.monthlyExpense, isPrivacyMode)}
                </span>
              </div>
            </div>

            {/* Danh mục chi tiết (Legend badges) */}
            <div className="w-full mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
              {categoryExpenseStats.map((cat) => (
                <div
                  key={cat.categoryId}
                  className="flex items-center gap-2 p-2 rounded-xl bg-slate-50/80 dark:bg-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: cat.categoryColor }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">
                        {cat.categoryName}
                      </p>
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                        {cat.percentage}%
                      </span>
                    </div>
                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                      {formatVNDMasked(cat.totalAmount, isPrivacyMode)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
