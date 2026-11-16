"use client";

import React from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TermReductionTransitionPoint } from "@/lib/mortgageEngine";
import { formatShortVNDMasked, formatVNDMasked } from "@/lib/formatters";

export type LoanChartMode = "VND" | "PERCENT";

export interface LoanChartProps {
  data: TermReductionTransitionPoint[];
  chartMode: LoanChartMode;
  fixedEndYearLabel?: string | null;
  targetPayoffYearLabel?: string;
  targetYears: number;
  transitionStartYear: number;
  transitionEndYear: number;
  isDark: boolean;
  isPrivacyMode: boolean;
}

function LoanChartTooltip({
  active,
  payload,
  isPrivacyMode,
}: {
  active?: boolean;
  payload?: Array<{ payload?: TermReductionTransitionPoint }>;
  isPrivacyMode: boolean;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const pt = payload[0]?.payload;
  if (!pt) return null;

  const stageText =
    pt.stage === "PAID_OFF"
      ? "Đã tất toán xong"
      : pt.stage === "FIXED"
      ? "Ưu đãi cố định"
      : pt.stage === "TRANSITION"
      ? "Dải chuyển Cố định → Thả nổi"
      : "Giai đoạn thả nổi";

  return (
    <div className="bg-slate-900/95 backdrop-blur-md text-white text-xs p-3.5 rounded-xl shadow-xl border border-slate-700/80 min-w-[240px] space-y-2">
      <div className="flex items-center justify-between gap-3 border-b border-slate-700 pb-1.5">
        <span className="font-bold text-slate-100">{pt.name}</span>
        <span className="text-[11px] font-semibold text-indigo-300">{stageText}</span>
      </div>

      <div className="space-y-1 tabular-nums">
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-300">Gốc trả (Mục tiêu):</span>
          <span className="font-bold text-blue-300">
            {formatVNDMasked(pt.targetPrincipal, isPrivacyMode)} ({pt.targetPrincipalSharePct}%)
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-300">Lãi trả (Mục tiêu):</span>
          <span className="font-bold text-amber-300">
            {formatVNDMasked(pt.targetInterest, isPrivacyMode)} ({pt.targetInterestSharePct}%)
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 pt-1 border-t border-slate-800">
          <span className="text-slate-400">Lãi trả nếu vay 30 năm:</span>
          <span className="font-semibold text-rose-300">
            {formatVNDMasked(pt.baselineInterest, isPrivacyMode)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-400">Lãi tiết kiệm lũy kế:</span>
          <span className="font-bold text-emerald-300">
            +{formatShortVNDMasked(pt.cumulativeInterestSaved, isPrivacyMode)}
          </span>
        </div>
      </div>
    </div>
  );
}

export function LoanChart({
  data,
  chartMode,
  fixedEndYearLabel,
  targetPayoffYearLabel,
  targetYears,
  transitionStartYear,
  transitionEndYear,
  isDark,
  isPrivacyMode,
}: LoanChartProps) {
  if (data.length === 0) {
    return (
      <div
        data-testid="skyone-loan-chart-empty"
        className="h-[280px] sm:h-[310px] w-full rounded-lg border border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-center text-xs text-slate-500 dark:text-slate-400"
      >
        Chưa có dữ liệu mô phỏng chuyển động Lãi / Gốc.
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="skyone-loan-chart">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
        <div className="flex flex-wrap items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#1D4ED8] inline-block" />
            {chartMode === "VND" ? "Gốc trả mục tiêu" : "Tỷ trọng Gốc (%)"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#D97706] inline-block" />
            {chartMode === "VND" ? "Lãi trả mục tiêu" : "Tỷ trọng Lãi (%)"}
          </span>
          {chartMode === "VND" && (
            <span className="inline-flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
              <span className="w-3.5 border-t-2 border-dashed border-rose-500 inline-block" />
              Lãi vay chuẩn 30 năm
            </span>
          )}
        </div>
        <span className="text-slate-500 dark:text-slate-400 tabular-nums">
          Dải chuyển ưu đãi → thả nổi: Năm {transitionStartYear} – Năm {transitionEndYear}
        </span>
      </div>

      <div className="h-[280px] sm:h-[310px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 20, right: 12, left: 0, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke={isDark ? "#1E293B" : "#E2E8F0"}
            />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: isDark ? "#94A3B8" : "#64748B" }}
              tickLine={false}
              axisLine={{ stroke: isDark ? "#334155" : "#CBD5E1" }}
              minTickGap={16}
            />
            <YAxis
              domain={chartMode === "PERCENT" ? [0, 100] : [0, "auto"]}
              tick={{ fontSize: 11, fill: isDark ? "#94A3B8" : "#64748B" }}
              tickLine={false}
              axisLine={false}
              width={chartMode === "VND" ? 56 : 40}
              tickFormatter={(v) =>
                chartMode === "VND"
                  ? formatShortVNDMasked(Number(v), isPrivacyMode)
                  : `${Math.round(Number(v))}%`
              }
            />
            <Tooltip content={<LoanChartTooltip isPrivacyMode={isPrivacyMode} />} />

            {fixedEndYearLabel && (
              <ReferenceLine
                x={fixedEndYearLabel}
                stroke={isDark ? "#FBBF24" : "#D97706"}
                strokeDasharray="4 4"
                label={{
                  value: "Hết ưu đãi",
                  position: "top",
                  fill: isDark ? "#FBBF24" : "#B45309",
                  fontSize: 10,
                  fontWeight: 700,
                }}
              />
            )}
            {targetPayoffYearLabel && (
              <ReferenceLine
                x={targetPayoffYearLabel}
                stroke={isDark ? "#34D399" : "#059669"}
                strokeWidth={2}
                label={{
                  value: `Xong (${targetYears}N)`,
                  position: "insideTopRight",
                  fill: isDark ? "#34D399" : "#047857",
                  fontSize: 10,
                  fontWeight: 700,
                }}
              />
            )}

            <Bar
              dataKey={chartMode === "VND" ? "targetPrincipal" : "targetPrincipalSharePct"}
              name="Gốc trả mục tiêu"
              stackId="targetFlow"
              fill="#1D4ED8"
              maxBarSize={26}
              radius={[0, 0, 0, 0]}
            />
            {chartMode === "PERCENT" ? (
              <Bar
                dataKey="targetInterestSharePct"
                name="Lãi trả mục tiêu"
                stackId="targetFlow"
                fill="#D97706"
                maxBarSize={26}
                radius={[4, 4, 0, 0]}
              />
            ) : (
              <>
                <Bar
                  dataKey="targetInterest"
                  name="Lãi trả mục tiêu"
                  stackId="targetFlow"
                  fill="#D97706"
                  maxBarSize={26}
                  radius={[4, 4, 0, 0]}
                />
                <Line
                  type="monotone"
                  dataKey="baselineInterest"
                  name="Lãi vay chuẩn 30 năm"
                  stroke="#E11D48"
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  dot={false}
                />
              </>
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
