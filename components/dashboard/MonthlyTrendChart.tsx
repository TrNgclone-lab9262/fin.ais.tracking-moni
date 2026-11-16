"use client";

import React, { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useFinance } from "@/context/FinanceContext";
import { formatVNDMasked, formatShortVNDMasked } from "@/lib/formatters";
import { BarChart3 } from "lucide-react";
import { useResponsive } from "@/src/hooks/useResponsive";
import { computeResponsiveXAxisInterval } from "@/lib/viewport";

interface BarTooltipEntry {
  color?: string;
  name?: string;
  value?: number | string;
}

interface CustomBarTooltipProps {
  active?: boolean;
  payload?: BarTooltipEntry[];
  label?: string;
  isPrivacyMode: boolean;
}

function CustomBarTooltip({
  active,
  payload,
  label,
  isPrivacyMode,
}: CustomBarTooltipProps) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900/95 backdrop-blur-md text-white text-xs p-3 rounded-xl shadow-xl border border-slate-800">
        <p className="font-bold text-slate-200 mb-1.5 border-b border-slate-700 pb-1">
          {label}
        </p>
        {payload.map((item, idx) => (
          <div key={idx} className="flex items-center justify-between gap-4 py-0.5">
            <span className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-slate-300">{item.name}:</span>
            </span>
            <span className="font-semibold text-white">
              {formatVNDMasked(Number(item.value ?? 0), isPrivacyMode)}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
}

export function MonthlyTrendChart() {
  const { monthlyTrendData, isPrivacyMode } = useFinance();
  const { isMobile } = useResponsive();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl p-5 sm:p-6 border border-[#DCE4EE] dark:border-slate-800 shadow-xs flex flex-col h-full">
      <div className="flex items-center justify-between pb-4 border-b border-[#E9EEF5] dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#172B4D] dark:text-slate-100">Thu - Chi các tháng</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Xu hướng thu nhập & chi tiêu</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs font-semibold shrink-0 whitespace-nowrap">
          <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
            Thu nhập
          </span>
          <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 whitespace-nowrap">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
            Chi tiêu
          </span>
        </div>
      </div>

      <div className="flex-1 min-h-[260px] pt-4">
        {isMounted ? (
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <BarChart
              data={monthlyTrendData}
              margin={{ top: 10, right: isMobile ? 6 : 10, left: isMobile ? -18 : -10, bottom: 0 }}
            >
              <XAxis
                dataKey="label"
                interval={computeResponsiveXAxisInterval(monthlyTrendData.length, isMobile, 4)}
                minTickGap={isMobile ? 20 : 10}
                stroke="#94A3B8"
                fontSize={isMobile ? 10 : 12}
                tickLine={false}
                axisLine={{ stroke: "#334155", strokeOpacity: 0.3 }}
              />
              <YAxis
                tickCount={isMobile ? 4 : 6}
                width={isMobile ? 42 : 52}
                stroke="#94A3B8"
                fontSize={isMobile ? 10 : 11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => formatShortVNDMasked(Number(val), isPrivacyMode)}
              />
              <Tooltip content={<CustomBarTooltip isPrivacyMode={isPrivacyMode} />} />
              <Bar
                dataKey="income"
                name="Thu nhập"
                fill="#10B981"
                radius={[6, 6, 0, 0]}
                maxBarSize={isMobile ? 22 : 32}
              />
              <Bar
                dataKey="expense"
                name="Chi tiêu"
                fill="#F43F5E"
                radius={[6, 6, 0, 0]}
                maxBarSize={isMobile ? 22 : 32}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-xs text-slate-400">
            Đang tải dữ liệu biểu đồ...
          </div>
        )}
      </div>
    </div>
  );
}
