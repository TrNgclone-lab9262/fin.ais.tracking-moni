"use client";

import React from "react";
import { ShieldCheck, Target } from "lucide-react";
import { GoldCategory, GoldDcaPlan, GoldPortfolioState } from "@/types/finance";
import {
  GOLD_CATEGORY_META,
  GoldPortfolioMetrics,
  NetWorthAllocationGuardrail,
  formatChiWeight,
} from "@/lib/goldEngine";
import { formatShortVNDMasked, formatVNDMasked } from "@/lib/formatters";
import { GOLD_CATEGORIES } from "./goldConstants";

interface GoldDcaTabProps {
  goldPortfolio: GoldPortfolioState;
  metrics: GoldPortfolioMetrics;
  guardrail: NetWorthAllocationGuardrail;
  isPrivacyMode: boolean;
  onUpdateDcaPlan: (patch: Partial<GoldDcaPlan>) => void;
  onToggleIncludeInNetWorth: (include: boolean) => void;
}

export function GoldDcaTab({
  goldPortfolio,
  metrics,
  guardrail,
  isPrivacyMode,
  onUpdateDcaPlan,
  onToggleIncludeInNetWorth,
}: GoldDcaTabProps) {
  const { dcaPlan } = goldPortfolio;
  const targetReserveChi = Math.max(1, dcaPlan.targetReserveChiFor2027 || 12);
  const reserveProgressPct = Math.min(
    100,
    Math.round((metrics.totalRemainingChi / targetReserveChi) * 100)
  );
  const remainingChiToGoal = Math.max(
    0,
    Number((targetReserveChi - metrics.totalRemainingChi).toFixed(2))
  );
  const targetQuoteAsk =
    goldPortfolio.quotes[dcaPlan.targetCategory]?.sellPricePerChi || 9_230_000;
  const estimatedMonthsToGoal =
    dcaPlan.monthlyTargetChi > 0
      ? Math.ceil(remainingChiToGoal / dcaPlan.monthlyTargetChi)
      : 0;
  const estimatedRemainingVnd = Math.round(remainingChiToGoal * targetQuoteAsk);

  return (
    <div className="space-y-5">
      {/* DCA Progress Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">
              <Target className="w-4 h-4" />
              <span>Kế Hoạch Tích Sản Định Kỳ (DCA) & Quỹ Phòng Vệ 2027</span>
            </div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white mt-1 tabular-nums">
              Đạt {formatChiWeight(metrics.totalRemainingChi, isPrivacyMode)} /{" "}
              {formatChiWeight(targetReserveChi, isPrivacyMode)} ({reserveProgressPct}%)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
              {remainingChiToGoal > 0
                ? `Còn thiếu ${formatChiWeight(remainingChiToGoal, isPrivacyMode)} (~${formatShortVNDMasked(estimatedRemainingVnd, isPrivacyMode)} theo giá Ask hiện tại) · Dự kiến hoàn thành sau ~${estimatedMonthsToGoal} tháng với nhịp ${dcaPlan.monthlyTargetChi} chỉ/tháng.`
                : "Đã hoàn thành mục tiêu tích lũy vàng phòng vệ cho mốc nhận nhà Q3/2027."}
            </p>
          </div>

          <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold cursor-pointer">
            <input
              type="checkbox"
              checked={goldPortfolio.includeInNetWorth}
              onChange={(e) => onToggleIncludeInNetWorth(e.target.checked)}
              className="w-4 h-4 accent-amber-600"
            />
            <span>Tính Kho Vàng vào Tổng Tài Sản Ròng</span>
          </label>
        </div>

        <div className="h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <div
            className="h-full bg-amber-500 rounded-full transition-all"
            style={{ width: `${reserveProgressPct}%` }}
          />
        </div>
      </div>

      {/* DCA Parameters + Net Worth Guardrail Control */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 text-xs">
          <h3 className="text-sm font-black text-slate-900 dark:text-white">
            Thiết Lập Nhịp Mua Đều Hàng Tháng
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
                Loại vàng ưu tiên DCA
              </label>
              <select
                value={dcaPlan.targetCategory}
                onChange={(e) =>
                  onUpdateDcaPlan({ targetCategory: e.target.value as GoldCategory })
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
              >
                {GOLD_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {GOLD_CATEGORY_META[c].label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
                Mục tiêu dự trữ 2027 (chỉ)
              </label>
              <input
                type="number"
                step="0.5"
                min="1"
                value={dcaPlan.targetReserveChiFor2027}
                onChange={(e) =>
                  onUpdateDcaPlan({
                    targetReserveChiFor2027: Math.max(1, Number(e.target.value) || 1),
                  })
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold tabular-nums"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
                Khối lượng mua / tháng (chỉ)
              </label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={dcaPlan.monthlyTargetChi}
                onChange={(e) => {
                  const chi = Math.max(0.1, Number(e.target.value) || 0.1);
                  onUpdateDcaPlan({
                    monthlyTargetChi: chi,
                    monthlyBudgetVnd: Math.round(chi * targetQuoteAsk),
                  });
                }}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold tabular-nums"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
                Ngân sách DCA dự kiến / tháng
              </label>
              <div className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/70 font-black tabular-nums text-amber-800 dark:text-amber-300">
                {formatVNDMasked(
                  Math.round(dcaPlan.monthlyTargetChi * targetQuoteAsk),
                  isPrivacyMode
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-900 dark:text-white inline-flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Kỷ Luật Tỷ Trọng Tài Sản Ròng (Guardrail)</span>
            </h3>
            <span className="font-black text-amber-700 dark:text-amber-300 tabular-nums">
              Mục tiêu: {dcaPlan.targetAllocationPercentOfNetWorth}%
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] font-bold text-slate-500">
              <span>5% (Thận trọng)</span>
              <span>15% (Khuyến nghị gia đình trẻ)</span>
              <span>35% (Phòng vệ mạnh)</span>
            </div>
            <input
              type="range"
              min={5}
              max={35}
              step={1}
              value={dcaPlan.targetAllocationPercentOfNetWorth}
              onChange={(e) =>
                onUpdateDcaPlan({
                  targetAllocationPercentOfNetWorth: Number(e.target.value),
                })
              }
              className="w-full accent-amber-600"
            />
          </div>

          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5 tabular-nums">
            <p className="font-bold text-slate-800 dark:text-slate-100">{guardrail.headline}</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Tỷ trọng thực tế: <strong>{guardrail.actualSharePct}%</strong> · Biên độ an toàn:{" "}
              <strong>
                {guardrail.minBandPct}% – {guardrail.maxBandPct}%
              </strong>{" "}
              · Chênh lệch:{" "}
              <strong>
                {guardrail.deltaVndToTarget > 0 ? "Cần thêm " : "Đang dư "}
                {formatShortVNDMasked(Math.abs(guardrail.deltaVndToTarget), isPrivacyMode)} (~
                {formatChiWeight(guardrail.deltaChiToTarget, isPrivacyMode)})
              </strong>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
