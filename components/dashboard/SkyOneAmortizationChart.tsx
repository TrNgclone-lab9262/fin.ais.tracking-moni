"use client";

import React, { useEffect, useMemo, useState } from "react";
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
import { BarChart3 } from "lucide-react";
import {
  buildSkyOneAmortizationChartData,
  MortgageScheduleSummary,
  SkyOneYearlyChartPoint,
} from "@/lib/mortgageEngine";
import { formatShortVNDMasked, formatVNDMasked } from "@/lib/formatters";
import { useFinance } from "@/context/FinanceContext";
import { MortgageContract } from "@/types/finance";
import { computeResponsiveXAxisInterval } from "@/lib/viewport";
import { useResponsive } from "@/src/hooks/useResponsive";

export type SkyOneChartUnitMode = "VND" | "PERCENT";

/**
 * Bảng màu tương phản cao chuẩn Calm Slate Fintech (Xanh dương / Hổ phách / Đỏ / Ngọc lục bảo).
 */
export const SKYONE_CHART_PALETTE = {
  principal: "#1D4ED8", // Xanh dương (Trả Gốc)
  interest: "#F59E0B", // Vàng hổ phách (Trả Lãi)
  debtRatio: "#DC2626", // Đỏ sắc nét (Đường tỷ lệ dư nợ còn lại %)
  milestoneFixedEnd: "#D97706", // Hổ phách nét đứt (Hết lãi cố định)
  milestoneCurrent: "#1E3A8A", // Navy đậm nét liền (Năm hiện tại)
  milestoneEquity50: "#059669", // Xanh ngọc nét đứt (Điểm Equity 50%)
  gridStroke: "#E2E8F0",
  axisLineStroke: "#CBD5E1",
} as const;

export interface SkyOneAmortizationChartProps {
  contract: MortgageContract;
  schedule: MortgageScheduleSummary;
  isPrivacyMode: boolean;
}

interface TooltipPayloadItem {
  payload?: SkyOneYearlyChartPoint;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string | number;
  isPrivacyMode: boolean;
  fixedEndYearLabel: string | null;
  currentYearLabel: string | null;
  equity50YearLabel: string | null;
}

function CustomSkyOneAmortizationTooltip({
  active,
  payload,
  label,
  isPrivacyMode,
  fixedEndYearLabel,
  currentYearLabel,
  equity50YearLabel,
}: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  const labelStr = String(label ?? point.name);
  const yearMilestones: string[] = [];
  if (fixedEndYearLabel === point.name) yearMilestones.push("Hết lãi cố định");
  if (currentYearLabel === point.name) yearMilestones.push("Năm hiện tại");
  if (equity50YearLabel === point.name) yearMilestones.push("Đạt Equity ≥ 50%");

  return (
    <div className="bg-slate-900/95 backdrop-blur-md text-white text-xs p-3.5 rounded-xl shadow-xl border border-slate-700/80 min-w-[240px] max-w-[290px] space-y-2">
      <div className="border-b border-slate-700 pb-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="font-bold text-slate-100">{labelStr}</span>
          <span className="text-[11px] font-semibold text-slate-300 tabular-nums">
            Dư nợ: {point.remainingDebtRatioPct.toFixed(1)}%
          </span>
        </div>
        {yearMilestones.length > 0 && (
          <p className="text-[10px] font-semibold text-amber-300 mt-1">
            Mốc: {yearMilestones.join(" · ")}
          </p>
        )}
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-slate-300">
            <span
              className="w-2.5 h-2.5 rounded-xs shrink-0"
              style={{ backgroundColor: SKYONE_CHART_PALETTE.principal }}
            />
            Trả Gốc:
          </span>
          <span className="font-semibold text-white tabular-nums text-right">
            {formatVNDMasked(point.principal, isPrivacyMode)}{" "}
            <span className="text-blue-300">({point.principalSharePct.toFixed(1)}%)</span>
          </span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-slate-300">
            <span
              className="w-2.5 h-2.5 rounded-xs shrink-0"
              style={{ backgroundColor: SKYONE_CHART_PALETTE.interest }}
            />
            Trả Lãi:
          </span>
          <span className="font-semibold text-white tabular-nums text-right">
            {formatVNDMasked(point.interest, isPrivacyMode)}{" "}
            <span className="text-amber-300">({point.interestSharePct.toFixed(1)}%)</span>
          </span>
        </div>

        <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-800">
          <span className="text-slate-400">Tổng chi năm:</span>
          <span className="font-bold text-slate-100 tabular-nums">
            {formatVNDMasked(point.totalPaid, isPrivacyMode)}
          </span>
        </div>
      </div>

      <div className="space-y-1 pt-1 border-t border-slate-700/80">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-slate-300">
            <span
              className="w-2.5 h-0.5 shrink-0"
              style={{ backgroundColor: SKYONE_CHART_PALETTE.debtRatio }}
            />
            Dư nợ cuối năm:
          </span>
          <span className="font-semibold text-rose-300 tabular-nums">
            {formatVNDMasked(point.endingBalance, isPrivacyMode)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-slate-300">Vốn chủ (Equity):</span>
          <span className="font-semibold text-emerald-300 tabular-nums">
            {point.equityPercent.toFixed(1)}% (
            {formatShortVNDMasked(point.cumulativeEquity, isPrivacyMode)})
          </span>
        </div>
      </div>
    </div>
  );
}

interface ActiveReferenceMarker {
  key: string;
  xLabel: string;
  shortTag: string;
  stroke: string;
  strokeDasharray?: string;
  overlapIndex: number;
}

export function SkyOneAmortizationChart({
  contract,
  schedule,
  isPrivacyMode,
}: SkyOneAmortizationChartProps) {
  const { themeMode } = useFinance();
  const isDark = themeMode === "dark";
  const { isMobile } = useResponsive();
  const [unitMode, setUnitMode] = useState<SkyOneChartUnitMode>("VND");
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const { points, milestones } = useMemo(
    () => buildSkyOneAmortizationChartData(contract, schedule),
    [contract, schedule]
  );

  const equity50Point = useMemo(
    () =>
      milestones.equity50YearIndex !== null
        ? points.find((p) => p.yearIndex === milestones.equity50YearIndex) ?? null
        : null,
    [points, milestones.equity50YearIndex]
  );

  const activeReferenceMarkers = useMemo<ActiveReferenceMarker[]>(() => {
    const raw: Array<{
      key: string;
      xLabel: string;
      shortTag: string;
      stroke: string;
      strokeDasharray?: string;
    }> = [];

    if (milestones.fixedEndYearLabel) {
      raw.push({
        key: "fixed_end",
        xLabel: milestones.fixedEndYearLabel,
        shortTag: "Hết CĐ",
        stroke: SKYONE_CHART_PALETTE.milestoneFixedEnd,
        strokeDasharray: "4 4",
      });
    }
    if (milestones.currentYearLabel) {
      raw.push({
        key: "current_year",
        xLabel: milestones.currentYearLabel,
        shortTag: "Hiện tại",
        stroke: isDark ? "#60A5FA" : SKYONE_CHART_PALETTE.milestoneCurrent,
      });
    }
    if (milestones.equity50YearLabel) {
      raw.push({
        key: "equity_50",
        xLabel: milestones.equity50YearLabel,
        shortTag: "Equity 50%",
        stroke: isDark ? "#34D399" : SKYONE_CHART_PALETTE.milestoneEquity50,
        strokeDasharray: "5 3",
      });
    }

    const seenByLabel = new Map<string, number>();
    return raw.map((item) => {
      const count = seenByLabel.get(item.xLabel) ?? 0;
      seenByLabel.set(item.xLabel, count + 1);
      return {
        ...item,
        overlapIndex: count,
      };
    });
  }, [milestones, isDark]);

  const lastPoint = points[points.length - 1];

  return (
    <section
      aria-label="Biểu đồ tỷ lệ dư nợ giảm dần và cơ cấu Gốc/Lãi theo năm"
      className="bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 shadow-xs p-4 sm:p-5 space-y-4"
    >
      {/* Header + Segmented Unit Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-[#E9EEF5] dark:border-slate-800">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-800/70 text-[#2563EB] dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-bold text-[#172B4D] dark:text-slate-100 leading-snug">
              Tỷ lệ dư nợ giảm dần &amp; Cơ cấu Gốc / Lãi theo năm
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              Theo dõi {points.length} năm kỳ hạn vay: cột xếp chồng Trả Gốc/Lãi kết hợp đường tỷ lệ dư nợ còn lại (%)
            </p>
          </div>
        </div>

        <div
          role="group"
          aria-label="Chuyển đổi đơn vị biểu đồ"
          className="inline-flex items-center rounded-lg bg-slate-100 dark:bg-slate-800 p-1 border border-[#DCE4EE] dark:border-slate-700 self-start sm:self-auto shrink-0"
        >
          <button
            type="button"
            data-testid="skyone-chart-unit-vnd"
            aria-pressed={unitMode === "VND"}
            onClick={() => setUnitMode("VND")}
            className={`min-h-[38px] sm:min-h-[34px] px-3 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              unitMode === "VND"
                ? "bg-white dark:bg-slate-900 text-[#1D4ED8] dark:text-blue-300 shadow-xs"
                : "text-slate-600 dark:text-slate-300 hover:text-[#172B4D] dark:hover:text-white"
            }`}
          >
            Số tiền (VNĐ)
          </button>
          <button
            type="button"
            data-testid="skyone-chart-unit-percent"
            aria-pressed={unitMode === "PERCENT"}
            onClick={() => setUnitMode("PERCENT")}
            className={`min-h-[38px] sm:min-h-[34px] px-3 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              unitMode === "PERCENT"
                ? "bg-white dark:bg-slate-900 text-[#1D4ED8] dark:text-blue-300 shadow-xs"
                : "text-slate-600 dark:text-slate-300 hover:text-[#172B4D] dark:hover:text-white"
            }`}
          >
            Tỷ lệ (%)
          </button>
        </div>
      </div>

      {/* Series Legend + 3 Milestone Reference Callouts */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2.5 bg-slate-50/90 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 rounded-lg px-3 py-2.5 text-[11px]">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 font-semibold text-slate-700 dark:text-slate-200">
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <span
              className="w-2.5 h-2.5 rounded-xs shrink-0"
              style={{ backgroundColor: SKYONE_CHART_PALETTE.principal }}
            />
            {unitMode === "VND" ? "Trả Gốc (VNĐ)" : "Tỷ trọng Gốc (%)"}
          </span>
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <span
              className="w-2.5 h-2.5 rounded-xs shrink-0"
              style={{ backgroundColor: SKYONE_CHART_PALETTE.interest }}
            />
            {unitMode === "VND" ? "Trả Lãi (VNĐ)" : "Tỷ trọng Lãi (%)"}
          </span>
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <span
              className="w-3.5 h-0.5 shrink-0"
              style={{ backgroundColor: SKYONE_CHART_PALETTE.debtRatio }}
            />
            Tỷ lệ dư nợ còn lại (%)
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-slate-600 dark:text-slate-300 tabular-nums">
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <span
              className="w-3.5 border-t-2 border-dashed shrink-0"
              style={{ borderColor: SKYONE_CHART_PALETTE.milestoneFixedEnd }}
            />
            <span>
              Hết cố định:{" "}
              <strong className="text-amber-700 dark:text-amber-300">
                {milestones.fixedEndYearLabel
                  ? `${milestones.fixedEndYearLabel} (${contract.fixedRateMonths}T)`
                  : "Không áp dụng"}
              </strong>
            </span>
          </span>

          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <span
              className="w-3.5 border-t-2 shrink-0"
              style={{ borderColor: isDark ? "#60A5FA" : SKYONE_CHART_PALETTE.milestoneCurrent }}
            />
            <span>
              Hiện tại:{" "}
              <strong className="text-[#1E3A8A] dark:text-blue-300">
                {milestones.currentYearLabel
                  ? `${milestones.currentYearLabel} (Kỳ ${schedule.currentReferencePeriod})`
                  : "—"}
              </strong>
            </span>
          </span>

          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <span
              className="w-3.5 border-t-2 border-dashed shrink-0"
              style={{ borderColor: isDark ? "#34D399" : SKYONE_CHART_PALETTE.milestoneEquity50 }}
            />
            <span>
              Equity 50%:{" "}
              <strong className="text-emerald-700 dark:text-emerald-300">
                {milestones.alreadyAtEquity50AtStart
                  ? "Từ đầu (≥50%)"
                  : milestones.equity50YearLabel && equity50Point
                    ? `${milestones.equity50YearLabel} (${equity50Point.equityPercent.toFixed(1)}%)`
                    : "Ngoài kỳ hạn"}
              </strong>
            </span>
          </span>
        </div>
      </div>

      {/* Main Recharts ComposedChart */}
      <div className="h-[310px] sm:h-[340px] w-full">
        {isMounted && points.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <ComposedChart
              data={points}
              margin={{ top: 26, right: unitMode === "VND" ? 8 : 10, left: -4, bottom: 2 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--chart-grid)"
                vertical={false}
              />

              <XAxis
                dataKey="name"
                tick={{ fontSize: isMobile ? 10 : 11, fill: "var(--chart-tick)" }}
                interval={computeResponsiveXAxisInterval(points.length, isMobile, 5)}
                minTickGap={isMobile ? 28 : 18}
                tickLine={false}
                axisLine={{ stroke: "var(--chart-grid)" }}
              />

              <YAxis
                yAxisId="left"
                domain={unitMode === "PERCENT" ? [0, 100] : [0, "auto"]}
                tickCount={isMobile ? 4 : 6}
                tick={{ fontSize: isMobile ? 10 : 11, fill: "var(--chart-tick)" }}
                tickLine={false}
                axisLine={false}
                width={
                  unitMode === "VND"
                    ? isMobile
                      ? 44
                      : isPrivacyMode
                        ? 48
                        : 56
                    : isMobile
                      ? 34
                      : 42
                }
                tickFormatter={(val) =>
                  unitMode === "VND"
                    ? formatShortVNDMasked(Number(val), isPrivacyMode)
                    : `${Math.round(Number(val))}%`
                }
              />

              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[0, 100]}
                hide={unitMode === "PERCENT" || isMobile}
                tickCount={isMobile ? 4 : 6}
                tick={{ fontSize: 11, fill: isDark ? "#F87171" : SKYONE_CHART_PALETTE.debtRatio }}
                tickLine={false}
                axisLine={false}
                width={isMobile ? 0 : 42}
                tickFormatter={(val) => `${Math.round(Number(val))}%`}
              />

              <Tooltip
                content={
                  <CustomSkyOneAmortizationTooltip
                    isPrivacyMode={isPrivacyMode}
                    fixedEndYearLabel={milestones.fixedEndYearLabel}
                    currentYearLabel={milestones.currentYearLabel}
                    equity50YearLabel={milestones.equity50YearLabel}
                  />
                }
              />

              {activeReferenceMarkers.map((marker) => (
                <ReferenceLine
                  key={marker.key}
                  yAxisId="left"
                  x={marker.xLabel}
                  stroke={marker.stroke}
                  strokeWidth={marker.key === "current_year" ? 2 : 1.75}
                  strokeDasharray={marker.strokeDasharray}
                  label={{
                    value: marker.shortTag,
                    position: marker.overlapIndex === 0 ? "top" : "insideTop",
                    dy: marker.overlapIndex === 0 ? -4 : 6 + (marker.overlapIndex - 1) * 16,
                    fill: marker.stroke,
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                />
              ))}

              <Bar
                yAxisId="left"
                dataKey={unitMode === "VND" ? "principal" : "principalSharePct"}
                name="Trả Gốc"
                stackId="cashflow"
                fill={SKYONE_CHART_PALETTE.principal}
                maxBarSize={isMobile ? 18 : 28}
                radius={[0, 0, 0, 0]}
              />
              <Bar
                yAxisId="left"
                dataKey={unitMode === "VND" ? "interest" : "interestSharePct"}
                name="Trả Lãi"
                stackId="cashflow"
                fill={SKYONE_CHART_PALETTE.interest}
                maxBarSize={isMobile ? 18 : 28}
                radius={[4, 4, 0, 0]}
              />

              <Line
                yAxisId={unitMode === "VND" ? "right" : "left"}
                type="monotone"
                dataKey="remainingDebtRatioPct"
                name="Tỷ lệ dư nợ còn lại (%)"
                stroke={SKYONE_CHART_PALETTE.debtRatio}
                strokeWidth={2.5}
                dot={{
                  r: 3,
                  fill: SKYONE_CHART_PALETTE.debtRatio,
                  stroke: "#FFFFFF",
                  strokeWidth: 1.5,
                }}
                activeDot={{
                  r: 5,
                  fill: SKYONE_CHART_PALETTE.debtRatio,
                  stroke: "#FFFFFF",
                  strokeWidth: 2,
                }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-xs text-slate-500 dark:text-slate-400">
            {points.length === 0 ? "Chưa có dữ liệu lịch trả nợ theo năm" : "Đang tải dữ liệu biểu đồ..."}
          </div>
        )}
      </div>

      {/* Compact Footer Metrics (Privacy-Aware) */}
      {lastPoint && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-[#E9EEF5] dark:border-slate-800 text-xs">
          <div className="rounded-lg bg-[#F8FAFC] dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 px-3 py-2 flex items-center justify-between gap-2">
            <span className="text-slate-500 dark:text-slate-400">Gốc vay ban đầu</span>
            <span className="font-bold text-[#172B4D] dark:text-slate-100 tabular-nums">
              {formatVNDMasked(contract.loanAmount, isPrivacyMode)}
            </span>
          </div>
          <div className="rounded-lg bg-[#F8FAFC] dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 px-3 py-2 flex items-center justify-between gap-2">
            <span className="text-slate-500 dark:text-slate-400">Tổng lãi dự kiến</span>
            <span className="font-bold text-amber-700 dark:text-amber-300 tabular-nums">
              {formatVNDMasked(schedule.totalProjectedInterest, isPrivacyMode)}
            </span>
          </div>
          <div className="rounded-lg bg-[#F8FAFC] dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 px-3 py-2 flex items-center justify-between gap-2">
            <span className="text-slate-500 dark:text-slate-400">Dư nợ năm cuối ({lastPoint.name})</span>
            <span className="font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
              {formatVNDMasked(lastPoint.endingBalance, isPrivacyMode)} ({lastPoint.remainingDebtRatioPct}%)
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
