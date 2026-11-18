"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Sparkles,
  TrendingUp,
  RefreshCw,
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import {
  formatShortVNDMasked,
  formatVNDMasked,
  getCurrentMonthKey,
} from "@/lib/formatters";
import {
  buildSpendingForecast,
  ForecastChartPoint,
} from "@/lib/spendingForecast";
import {
  generateSpendingForecastInsights,
  SpendingForecastAIResponse,
} from "@/lib/geminiReceiptService";
import { useResponsive } from "@/src/hooks/useResponsive";
import { computeResponsiveXAxisInterval } from "@/lib/viewport";

interface SpendingForecastCardProps {
  compact?: boolean;
}

interface ForecastTooltipPayloadEntry {
  payload?: ForecastChartPoint;
}

interface ForecastTooltipProps {
  active?: boolean;
  payload?: ForecastTooltipPayloadEntry[];
  isPrivacyMode: boolean;
}

function CustomForecastTooltip({
  active,
  payload,
  isPrivacyMode,
}: ForecastTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  const incomeVal = point.isForecast
    ? point.forecastIncome || 0
    : point.actualIncome || 0;
  const expenseVal = point.isForecast
    ? point.forecastExpense || 0
    : point.actualExpense || 0;
  const netVal = incomeVal - expenseVal;

  return (
    <div className="bg-slate-900/95 backdrop-blur-md text-white text-xs p-3 rounded-xl shadow-xl border border-slate-800 space-y-1.5 min-w-[215px]">
      <div className="font-bold text-slate-100 border-b border-slate-700 pb-1 flex items-center justify-between gap-2">
        <span>{point.monthLabel}</span>
        <span
          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
            point.isForecast
              ? "bg-amber-500/20 text-amber-300"
              : "bg-slate-700 text-slate-300"
          }`}
        >
          {point.isForecast ? "Dự báo" : "Thực tế"}
        </span>
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-slate-300">
          {point.isForecast ? "Thu dự kiến:" : "Thu thực tế:"}
        </span>
        <span className="font-bold text-emerald-400 tabular-nums">
          {formatVNDMasked(incomeVal, isPrivacyMode)}
        </span>
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-slate-300">
          {point.isForecast ? "Chi dự kiến:" : "Chi thực tế:"}
        </span>
        <span
          className={`font-bold tabular-nums ${
            point.isForecast ? "text-amber-400" : "text-rose-400"
          }`}
        >
          {formatVNDMasked(expenseVal, isPrivacyMode)}
        </span>
      </div>

      {(point.recurringExpense > 0 || point.discretionaryExpense > 0) && (
        <div className="text-[11px] text-slate-400 pl-2 border-l border-slate-700 space-y-0.5 tabular-nums">
          <div className="flex justify-between gap-2">
            <span>Định kỳ:</span>
            <span>{formatVNDMasked(point.recurringExpense, isPrivacyMode)}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span>Linh hoạt:</span>
            <span>{formatVNDMasked(point.discretionaryExpense, isPrivacyMode)}</span>
          </div>
        </div>
      )}

      <div className="pt-1 border-t border-slate-700/80 flex items-center justify-between gap-3">
        <span className="text-slate-300 font-medium">
          {point.isForecast ? "Tiết kiệm dự kiến:" : "Chênh lệch:"}
        </span>
        <span
          className={`font-extrabold tabular-nums ${
            netVal >= 0 ? "text-blue-300" : "text-rose-300"
          }`}
        >
          {netVal >= 0 ? "+" : "-"}
          {formatVNDMasked(Math.abs(netVal), isPrivacyMode)}
        </span>
      </div>
    </div>
  );
}

export function SpendingForecastCard({ compact = false }: SpendingForecastCardProps) {
  const {
    transactions,
    recurringRules,
    categories,
    budgets,
    selectedMonth,
    activePerspective,
    husbandCreditCard,
    wifeCreditCard,
    settings,
    isPrivacyMode,
  } = useFinance();

  const { isMobile } = useResponsive();
  const [isMounted, setIsMounted] = useState(false);
  const [aiForecast, setAiForecast] = useState<SpendingForecastAIResponse | null>(null);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const anchorMonth = selectedMonth === "ALL" ? getCurrentMonthKey() : selectedMonth;

  const perspectiveLabel =
    activePerspective === "HUSBAND"
      ? settings.husbandName
      : activePerspective === "WIFE"
      ? settings.wifeName
      : "Cả nhà";

  useEffect(() => {
    setAiForecast(null);
    setAiError(null);
  }, [anchorMonth, activePerspective]);

  const forecast = useMemo(
    () =>
      buildSpendingForecast({
        transactions,
        recurringRules,
        categories,
        budgets,
        anchorMonth,
        perspective: activePerspective,
      }),
    [transactions, recurringRules, categories, budgets, anchorMonth, activePerspective]
  );

  const handleGenerateAICommentary = async () => {
    if (!forecast.hasHistoricalData || isLoadingAI) return;
    setIsLoadingAI(true);
    setAiError(null);

    try {
      const creditCards: { name: string; usagePercentage: number; usedAmount: number }[] = [];
      if (husbandCreditCard) {
        creditCards.push({
          name: husbandCreditCard.account.name,
          usagePercentage: husbandCreditCard.usagePercentage,
          usedAmount: husbandCreditCard.usedAmount,
        });
      }
      if (wifeCreditCard) {
        creditCards.push({
          name: wifeCreditCard.account.name,
          usagePercentage: wifeCreditCard.usagePercentage,
          usedAmount: wifeCreditCard.usedAmount,
        });
      }

      const result = await generateSpendingForecastInsights({
        anchorMonthLabel: forecast.anchorMonthLabel,
        perspectiveLabel,
        monthsAnalyzed: forecast.monthsAnalyzed,
        historicalAvgIncome: forecast.historicalAvgIncome,
        historicalAvgExpense: forecast.historicalAvgExpense,
        recurringExpenseBaseline: forecast.recurringExpenseBaseline,
        discretionaryExpenseBaseline: forecast.discretionaryExpenseBaseline,
        monthlyGrowthRatePct: forecast.monthlyGrowthRatePct,
        forecastMonths: forecast.forecastMonths.map((m) => ({
          month: m.month,
          monthLabel: m.monthLabel,
          predictedIncome: m.predictedIncome,
          recurringExpense: m.recurringExpense,
          discretionaryExpense: m.discretionaryExpense,
          predictedExpense: m.predictedExpense,
          projectedSavings: m.projectedSavings,
          savingsRate: m.savingsRate,
          riskLabel: m.riskLabel,
        })),
        topDrivers: forecast.topDrivers.map((d) => ({
          categoryName: d.categoryName,
          avgMonthlyAmount: d.avgMonthlyAmount,
          sharePct: d.sharePct,
          isRecurringDominant: d.isRecurringDominant,
        })),
        budgetWarnings: forecast.budgetWarnings,
        creditCards,
      });

      setAiForecast(result);
    } catch (err) {
      setAiError(
        err instanceof Error
          ? err.message
          : "Không thể nhận xét dự báo 3 tháng với Gemini AI lúc này."
      );
    } finally {
      setIsLoadingAI(false);
    }
  };

  const firstForecast = forecast.forecastMonths[0];
  const lastForecast = forecast.forecastMonths[2];
  const anchorShortLabel =
    forecast.chartSeries.find((p) => !p.isForecast && p.month === anchorMonth)?.shortLabel || "";

  const xInterval = computeResponsiveXAxisInterval(
    forecast.chartSeries.length,
    isMobile || compact,
    4
  );

  return (
    <div
      data-testid="spending-forecast-card"
      className={`bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 shadow-xs space-y-5 ${
        compact ? "p-4" : "p-5 sm:p-6"
      }`}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-[#E9EEF5] dark:border-slate-800">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-500/15 text-[#1E3A8A] dark:text-blue-400 flex items-center justify-center shrink-0">
            <CalendarClock className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-bold text-[#172B4D] dark:text-slate-100">
              Dự Báo Xu Hướng Chi Tiêu 3 Tháng Tới
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5 tabular-nums">
              {firstForecast?.monthLabel} – {lastForecast?.monthLabel} · {perspectiveLabel} ·{" "}
              {forecast.monthsAnalyzed > 0
                ? `Dựa trên ${forecast.monthsAnalyzed} tháng lịch sử & định kỳ`
                : "Dựa trên quy tắc định kỳ"}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void handleGenerateAICommentary()}
          disabled={!forecast.hasHistoricalData || isLoadingAI}
          data-testid="forecast-ai-btn"
          className="min-h-[38px] px-3.5 py-2 rounded-lg bg-[#1E3A8A] hover:bg-blue-900 dark:bg-blue-600 dark:hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-xs cursor-pointer transition-colors"
        >
          {isLoadingAI ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Gemini đang phân tích...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              <span>{aiForecast ? "Nhận xét lại AI" : "Nhận xét xu hướng AI"}</span>
            </>
          )}
        </button>
      </div>

      {!forecast.hasHistoricalData ? (
        <div className="p-6 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-dashed border-slate-200 dark:border-slate-700 text-center space-y-1.5">
          <TrendingUp className="w-6 h-6 text-slate-400 mx-auto" />
          <p className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200">
            Chưa đủ dữ liệu lịch sử hoặc quy tắc định kỳ để dự báo
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Hãy ghi nhận thêm giao dịch hoặc thiết lập khoản thu/chi định kỳ trong mục Lập kế hoạch.
          </p>
        </div>
      ) : (
        <>
          {/* Chart Legend & 3-Month Horizon Summary Strip */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-semibold">
              <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                <span className="w-3 h-0.5 bg-emerald-500 inline-block" />
                Thu thực tế
              </span>
              <span className="inline-flex items-center gap-1.5 text-rose-700 dark:text-rose-400">
                <span className="w-3 h-0.5 bg-rose-500 inline-block" />
                Chi thực tế
              </span>
              <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                <span className="w-3.5 border-t-2 border-dashed border-amber-500 inline-block" />
                Chi dự báo (+3T)
              </span>
              <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                <span className="w-3.5 border-t-2 border-dashed border-emerald-500 inline-block" />
                Thu dự kiến (+3T)
              </span>
            </div>

            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 tabular-nums">
              Tiết kiệm dự kiến 3 tháng:{" "}
              <strong
                className={
                  forecast.total3MonthProjectedSavings >= 0
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                }
              >
                {forecast.total3MonthProjectedSavings >= 0 ? "+" : "-"}
                {formatVNDMasked(Math.abs(forecast.total3MonthProjectedSavings), isPrivacyMode)}
              </strong>
            </span>
          </div>

          {/* Recharts Historical + 3-Month Forecast Line Chart */}
          <div className={compact ? "h-52 w-full" : "h-64 w-full"}>
            {isMounted ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <LineChart
                  data={forecast.chartSeries}
                  margin={{ top: 10, right: 12, left: -12, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#E2E8F0"
                    className="dark:opacity-20"
                  />
                  <XAxis
                    dataKey="shortLabel"
                    interval={xInterval}
                    tick={{ fontSize: 11, fill: "#64748B", fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(v) => formatShortVNDMasked(Number(v), isPrivacyMode)}
                    tick={{ fontSize: 11, fill: "#64748B", fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    content={<CustomForecastTooltip isPrivacyMode={isPrivacyMode} />}
                  />
                  {anchorShortLabel && (
                    <ReferenceLine
                      x={anchorShortLabel}
                      stroke="#94A3B8"
                      strokeDasharray="3 3"
                      label={{
                        value: "Kỳ neo",
                        position: "top",
                        fill: "#64748B",
                        fontSize: 10,
                        fontWeight: 700,
                      }}
                    />
                  )}
                  <Line
                    type="monotone"
                    dataKey="actualIncome"
                    name="Thu thực tế"
                    stroke="#10B981"
                    strokeWidth={2.5}
                    dot={{ r: 3.5, fill: "#10B981", strokeWidth: 0 }}
                    connectNulls={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="actualExpense"
                    name="Chi thực tế"
                    stroke="#F43F5E"
                    strokeWidth={2.5}
                    dot={{ r: 3.5, fill: "#F43F5E", strokeWidth: 0 }}
                    connectNulls={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="forecastIncome"
                    name="Thu dự kiến"
                    stroke="#10B981"
                    strokeWidth={2.5}
                    strokeDasharray="5 4"
                    dot={{ r: 3.5, fill: "#FFFFFF", stroke: "#10B981", strokeWidth: 2 }}
                    connectNulls={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="forecastExpense"
                    name="Chi dự báo"
                    stroke="#F59E0B"
                    strokeWidth={2.5}
                    strokeDasharray="5 4"
                    dot={{ r: 4, fill: "#FFFFFF", stroke: "#F59E0B", strokeWidth: 2 }}
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full rounded-lg bg-slate-50 dark:bg-slate-800/50 animate-pulse" />
            )}
          </div>

          {/* 3 Summary Cards (Month +1, +2, +3) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {forecast.forecastMonths.map((item) => {
              const aiNote =
                aiForecast?.monthlyNotes.find((n) => n.month === item.month) ||
                aiForecast?.monthlyNotes[item.horizonIndex - 1];

              const statusColor =
                item.riskLevel === "TIGHT"
                  ? "text-rose-600 dark:text-rose-400"
                  : item.riskLevel === "WATCH"
                  ? "text-amber-700 dark:text-amber-300"
                  : "text-emerald-700 dark:text-emerald-400";

              const statusDot =
                item.riskLevel === "TIGHT"
                  ? "bg-rose-500"
                  : item.riskLevel === "WATCH"
                  ? "bg-amber-500"
                  : "bg-emerald-500";

              return (
                <div
                  key={item.month}
                  data-testid={`forecast-month-card-${item.horizonIndex}`}
                  className="rounded-xl p-4 bg-slate-50/80 dark:bg-slate-800/70 border border-[#E9EEF5] dark:border-slate-700 space-y-2.5 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-extrabold text-[#172B4D] dark:text-slate-100">
                        {item.monthLabel}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1.5 text-[11px] font-bold whitespace-nowrap ${statusColor}`}
                      >
                        <span className={`w-2 h-2 rounded-full ${statusDot}`} />
                        <span>{item.riskLabel}</span>
                      </span>
                    </div>

                    <div>
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
                        Chi tiêu dự báo
                      </span>
                      <span className="text-lg font-black text-amber-700 dark:text-amber-400 tabular-nums">
                        {formatVNDMasked(item.predictedExpense, isPrivacyMode)}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-2 gap-y-0.5 tabular-nums">
                      <span>Cố định: {formatShortVNDMasked(item.recurringExpense, isPrivacyMode)}</span>
                      <span>·</span>
                      <span>Linh hoạt: {formatShortVNDMasked(item.discretionaryExpense, isPrivacyMode)}</span>
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-slate-200/80 dark:border-slate-700 space-y-1.5">
                    <div className="flex items-center justify-between text-xs tabular-nums">
                      <span className="text-slate-500 dark:text-slate-400">Thu dự kiến:</span>
                      <span className="font-bold text-emerald-700 dark:text-emerald-400">
                        +{formatVNDMasked(item.predictedIncome, isPrivacyMode)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs tabular-nums">
                      <span className="text-slate-500 dark:text-slate-400">Tích lũy dự kiến:</span>
                      <span
                        className={`font-extrabold ${
                          item.projectedSavings >= 0
                            ? "text-blue-700 dark:text-blue-400"
                            : "text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        {item.projectedSavings >= 0 ? "+" : "-"}
                        {formatVNDMasked(Math.abs(item.projectedSavings), isPrivacyMode)} ({item.savingsRate}%)
                      </span>
                    </div>

                    {aiNote && (
                      <div className="pt-2 border-t border-slate-200/70 dark:border-slate-700/80 space-y-0.5">
                        <p className="text-[11px] font-bold text-[#1E3A8A] dark:text-blue-300">
                          {aiNote.focus}
                        </p>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug">
                          {aiNote.advice}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Gemini AI Forecast Narrative / Error / Prompt */}
          {aiError ? (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 flex flex-wrap items-center justify-between gap-2 text-xs text-rose-700 dark:text-rose-300">
              <div className="flex items-center gap-2 min-w-0">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="font-semibold">{aiError}</span>
              </div>
              <button
                type="button"
                onClick={() => void handleGenerateAICommentary()}
                className="px-3 py-1 rounded-md bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] whitespace-nowrap cursor-pointer"
              >
                Thử lại
              </button>
            </div>
          ) : isLoadingAI ? (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-[#E9EEF5] dark:border-slate-700 space-y-2 animate-pulse">
              <div className="h-3.5 bg-slate-200 dark:bg-slate-700 rounded w-2/3" />
              <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-full" />
              <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-5/6" />
            </div>
          ) : aiForecast ? (
            <div className="p-4 rounded-xl bg-blue-50/60 dark:bg-blue-500/10 border border-blue-200/70 dark:border-blue-500/30 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 text-xs sm:text-sm font-extrabold text-[#1E3A8A] dark:text-blue-300">
                  <Sparkles className="w-4 h-4 shrink-0" />
                  <span>{aiForecast.headline}</span>
                </div>
                <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 shrink-0">
                  Gemini AI
                </span>
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                {aiForecast.overallTrend}
              </p>
              {aiForecast.savingActions.length > 0 && (
                <ul className="space-y-1 pt-1.5 border-t border-blue-200/60 dark:border-blue-500/20 text-xs text-slate-700 dark:text-slate-200">
                  {aiForecast.savingActions.map((act, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <span>{act}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div className="px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-dashed border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>
                Số liệu 3 tháng được tính từ lịch sử giao dịch + {recurringRules.filter((r) => r.isActive).length} quy tắc định kỳ.
                {forecast.budgetWarnings.length > 0 && (
                  <span className="text-amber-700 dark:text-amber-300 font-semibold ml-1 inline-flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 inline" />
                    Lưu ý ngân sách: {forecast.budgetWarnings.slice(0, 2).join(", ")}.
                  </span>
                )}
              </span>
              <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                Nhấn &ldquo;Nhận xét xu hướng AI&rdquo; để xem phân tích chi tiết
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
