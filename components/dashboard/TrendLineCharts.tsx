"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { useFinance } from "@/context/FinanceContext";
import { formatVND, formatShortVND, getMonthDisplayLabel } from "@/lib/formatters";
import { calculateBalanceAndCumulativeTrends } from "@/lib/financeEngine";
import { Activity } from "lucide-react";

export function TrendLineCharts() {
  const {
    accounts,
    transactions,
    selectedMonth,
    activePerspective,
    budgetSummary,
  } = useFinance();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const {
    balanceTrend,
    expenseCumulative,
    incomeCumulative,
    targetMonth,
  } = useMemo(
    () =>
      calculateBalanceAndCumulativeTrends(
        accounts,
        transactions,
        selectedMonth,
        activePerspective
      ),
    [accounts, transactions, selectedMonth, activePerspective]
  );

  const firstRangeLabel = balanceTrend[0]?.key || "T5";
  const lastRangeLabel = balanceTrend[balanceTrend.length - 1]?.key || "T10";
  const monthLabel = getMonthDisplayLabel(targetMonth);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
        <Activity className="w-4 h-4 text-blue-600" />
        Xu hướng tích lũy & Lũy kế ({monthLabel})
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Biểu đồ 1: Số dư theo thời gian */}
        <div className="bg-white rounded-xl p-5 border border-[#DCE4EE] shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-slate-700">Số dư thanh khoản 6 tháng</h4>
            <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
              {firstRangeLabel} - {lastRangeLabel}
            </span>
          </div>
          <div className="h-40 w-full pt-2">
            {isMounted && (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <LineChart data={balanceTrend}>
                  <XAxis dataKey="key" stroke="#94A3B8" fontSize={11} tickLine={false} />
                  <YAxis
                    stroke="#94A3B8"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => formatShortVND(v)}
                  />
                  <Tooltip
                    formatter={(v: unknown) => [formatVND(Number(v)), "Số dư"]}
                    contentStyle={{ borderRadius: 12, fontSize: 12 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="balance"
                    stroke="#2563EB"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: "#2563EB" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Biểu đồ 2: Chi tiêu lũy kế trong tháng */}
        <div className="bg-white rounded-xl p-5 border border-[#DCE4EE] shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-slate-700">Chi tiêu lũy kế trong tháng</h4>
            <span className="text-[10px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md">
              Mốc {formatShortVND(budgetSummary.totalBudget)}
            </span>
          </div>
          <div className="h-40 w-full pt-2">
            {isMounted && (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <LineChart data={expenseCumulative}>
                  <XAxis dataKey="day" stroke="#94A3B8" fontSize={11} tickLine={false} />
                  <YAxis
                    stroke="#94A3B8"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => formatShortVND(v)}
                  />
                  <Tooltip
                    formatter={(v: unknown) => [formatVND(Number(v)), "Đã chi lũy kế"]}
                    labelFormatter={(d) => `Ngày ${d}`}
                    contentStyle={{ borderRadius: 12, fontSize: 12 }}
                  />
                  {budgetSummary.totalBudget > 0 && (
                    <ReferenceLine
                      y={budgetSummary.totalBudget}
                      stroke="#F59E0B"
                      strokeDasharray="3 3"
                    />
                  )}
                  <Line
                    type="monotone"
                    dataKey="amount"
                    stroke="#F43F5E"
                    strokeWidth={2.5}
                    dot={{ r: 2, fill: "#F43F5E" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Biểu đồ 3: Thu lũy kế trong tháng */}
        <div className="bg-white rounded-xl p-5 border border-[#DCE4EE] shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-slate-700">Thu lũy kế trong tháng</h4>
            <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
              {monthLabel}
            </span>
          </div>
          <div className="h-40 w-full pt-2">
            {isMounted && (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <LineChart data={incomeCumulative}>
                  <XAxis dataKey="day" stroke="#94A3B8" fontSize={11} tickLine={false} />
                  <YAxis
                    stroke="#94A3B8"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => formatShortVND(v)}
                  />
                  <Tooltip
                    formatter={(v: unknown) => [formatVND(Number(v)), "Thu nhập lũy kế"]}
                    labelFormatter={(d) => `Ngày ${d}`}
                    contentStyle={{ borderRadius: 12, fontSize: 12 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="amount"
                    stroke="#10B981"
                    strokeWidth={2.5}
                    dot={{ r: 2, fill: "#10B981" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
