"use client";

import React, { useMemo, useState } from "react";
import { Bell, Plus, RefreshCw, Trash2 } from "lucide-react";
import {
  GoldAlertCondition,
  GoldCategory,
  GoldPortfolioState,
} from "@/types/finance";
import {
  EvaluatedGoldAlert,
  GOLD_ALERT_CONDITION_META,
  GOLD_CATEGORY_META,
  computeDomesticPremium,
  computeWorldGoldPricePerChiVnd,
} from "@/lib/goldEngine";
import { formatVNDMasked } from "@/lib/formatters";
import { GOLD_CATEGORIES } from "./goldConstants";

interface GoldPricesTabProps {
  goldPortfolio: GoldPortfolioState;
  evaluatedAlerts: EvaluatedGoldAlert[];
  isPrivacyMode: boolean;
  isFetchingRef: boolean;
  refStatusMsg: string | null;
  onFetchReferencePrices: () => void;
  onUpdateQuote: (
    category: GoldCategory,
    patch: { buyPricePerChi?: number; sellPricePerChi?: number; source?: "MANUAL" | "SERVER_REFERENCE" }
  ) => void;
  onUpdateMacro: (patch: { worldXauUsdPerOz?: number; usdVndRate?: number }) => void;
  onAddAlertRule: (rule: {
    label: string;
    category: GoldCategory;
    condition: GoldAlertCondition;
    threshold: number;
    enabled: boolean;
  }) => void;
  onToggleAlertRule: (id: string) => void;
  onDeleteAlertRule: (id: string) => void;
}

export function GoldPricesTab({
  goldPortfolio,
  evaluatedAlerts,
  isPrivacyMode,
  isFetchingRef,
  refStatusMsg,
  onFetchReferencePrices,
  onUpdateQuote,
  onUpdateMacro,
  onAddAlertRule,
  onToggleAlertRule,
  onDeleteAlertRule,
}: GoldPricesTabProps) {
  const [newAlertLabel, setNewAlertLabel] = useState("");
  const [newAlertCat, setNewAlertCat] = useState<GoldCategory>("NHAN_9999");
  const [newAlertCond, setNewAlertCond] = useState<GoldAlertCondition>("TARGET_BID_ABOVE");
  const [newAlertThreshold, setNewAlertThreshold] = useState("9800000");

  const worldPerChi = useMemo(
    () => computeWorldGoldPricePerChiVnd(goldPortfolio.macro),
    [goldPortfolio.macro]
  );

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(newAlertThreshold);
    if (!Number.isFinite(num) || num <= 0) return;
    onAddAlertRule({
      label:
        newAlertLabel.trim() ||
        `${GOLD_CATEGORY_META[newAlertCat].shortLabel} · ${GOLD_ALERT_CONDITION_META[newAlertCond].shortLabel}`,
      category: newAlertCat,
      condition: newAlertCond,
      threshold: num,
      enabled: true,
    });
    setNewAlertLabel("");
  };

  return (
    <div className="space-y-5">
      {/* Live Market Quotes & Spread Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-black text-slate-900 dark:text-slate-100">
              Bảng Giá Vàng Bid / Ask, Chênh Lệch Spread & Giá Thế Giới Quy Đổi
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
              Thế giới quy đổi:{" "}
              <strong>{formatVNDMasked(worldPerChi, isPrivacyMode)} / chỉ</strong> (XAU/USD{" "}
              {goldPortfolio.macro.worldXauUsdPerOz.toLocaleString("en-US")} $/oz · USD/VND{" "}
              {goldPortfolio.macro.usdVndRate.toLocaleString("vi-VN")})
            </p>
          </div>

          <button
            type="button"
            disabled={isFetchingRef}
            onClick={onFetchReferencePrices}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-extrabold bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetchingRef ? "animate-spin" : ""}`} />
            <span>{isFetchingRef ? "Đang đồng bộ..." : "Cập nhật giá tham khảo"}</span>
          </button>
        </div>

        {refStatusMsg && (
          <p className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200">
            {refStatusMsg}
          </p>
        )}

        {/* Macro XAU & USD/VND Inline Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-xs">
          <label className="flex items-center justify-between gap-3">
            <span className="font-bold text-slate-700 dark:text-slate-200">
              Giá vàng thế giới XAU/USD ($/oz)
            </span>
            <input
              type="number"
              step="5"
              min="1000"
              value={goldPortfolio.macro.worldXauUsdPerOz}
              onChange={(e) =>
                onUpdateMacro({ worldXauUsdPerOz: Math.max(1000, Number(e.target.value) || 0) })
              }
              className="w-28 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-right font-bold tabular-nums"
            />
          </label>
          <label className="flex items-center justify-between gap-3">
            <span className="font-bold text-slate-700 dark:text-slate-200">
              Tỷ giá USD/VND (Ngân hàng)
            </span>
            <input
              type="number"
              step="50"
              min="20000"
              value={goldPortfolio.macro.usdVndRate}
              onChange={(e) =>
                onUpdateMacro({ usdVndRate: Math.max(20000, Number(e.target.value) || 0) })
              }
              className="w-28 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-right font-bold tabular-nums"
            />
          </label>
        </div>

        {/* Quotes Editable Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase text-slate-500">
                <th className="py-2 pr-3">Loại vàng</th>
                <th className="py-2 px-3 text-right">Tiệm Mua vào · Bid (đ/chỉ)</th>
                <th className="py-2 px-3 text-right">Tiệm Bán ra · Ask (đ/chỉ)</th>
                <th className="py-2 px-3 text-right">Biên độ Spread</th>
                <th className="py-2 pl-3 text-right">Chênh vs Thế giới</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 tabular-nums">
              {GOLD_CATEGORIES.map((cat) => {
                const q = goldPortfolio.quotes[cat];
                const prem = computeDomesticPremium(q, goldPortfolio.macro);
                return (
                  <tr key={cat}>
                    <td className="py-2.5 pr-3">
                      <p className="font-bold text-slate-900 dark:text-white">
                        {GOLD_CATEGORY_META[cat].label}
                      </p>
                      <p className="text-[10.5px] text-slate-500">
                        {q.brandLabel}
                      </p>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <input
                        type="number"
                        step="10000"
                        min="100000"
                        value={q.buyPricePerChi}
                        onChange={(e) =>
                          onUpdateQuote(cat, {
                            buyPricePerChi: Math.max(0, Number(e.target.value) || 0),
                            source: "MANUAL",
                          })
                        }
                        aria-label={`Giá mua vào ${GOLD_CATEGORY_META[cat].shortLabel}`}
                        className="w-32 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-right font-bold"
                      />
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <input
                        type="number"
                        step="10000"
                        min="100000"
                        value={q.sellPricePerChi}
                        onChange={(e) =>
                          onUpdateQuote(cat, {
                            sellPricePerChi: Math.max(0, Number(e.target.value) || 0),
                            source: "MANUAL",
                          })
                        }
                        aria-label={`Giá bán ra ${GOLD_CATEGORY_META[cat].shortLabel}`}
                        className="w-32 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-right font-bold"
                      />
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <span
                        className={`font-bold ${
                          prem.spreadPct >= 3
                            ? "text-rose-600 dark:text-rose-400"
                            : "text-slate-700 dark:text-slate-200"
                        }`}
                      >
                        {formatVNDMasked(prem.spreadPerChiVnd, isPrivacyMode)} ({prem.spreadPct}%)
                      </span>
                    </td>
                    <td className="py-2.5 pl-3 text-right whitespace-nowrap">
                      <span
                        className={`font-bold ${
                          prem.premiumOverWorldPct <= 6
                            ? "text-emerald-700 dark:text-emerald-400"
                            : prem.premiumOverWorldPct >= 14
                              ? "text-amber-700 dark:text-amber-300"
                              : "text-slate-700 dark:text-slate-200"
                        }`}
                      >
                        {prem.premiumOverWorldPct > 0 ? "+" : ""}
                        {prem.premiumOverWorldPct}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Price, Spread & Premium Alert Rules Manager */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
              Quy Tắc Cảnh Báo Giá Chốt Lời, Chênh Lệch Thế Giới & Spread
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Tự động kiểm tra trên bảng giá Bid/Ask hiện tại và báo nổi bật ngay tại Tổng quan
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {evaluatedAlerts.map((ev) => (
            <div
              key={ev.rule.id}
              className={`p-3 rounded-lg border flex flex-wrap items-center justify-between gap-3 text-xs ${
                ev.triggered
                  ? "bg-amber-50/70 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800"
                  : "bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800"
              }`}
            >
              <div className="space-y-0.5 min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-slate-900 dark:text-white">{ev.rule.label}</span>
                  <span className="text-[11px] font-bold tabular-nums text-slate-500 dark:text-slate-400">
                    {GOLD_CATEGORY_META[ev.rule.category].shortLabel} · Hiện tại {ev.currentValueLabel} · Ngưỡng {ev.thresholdLabel}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300">{ev.summary}</p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={`text-[11px] font-black ${
                    !ev.rule.enabled
                      ? "text-slate-400"
                      : ev.triggered
                        ? "text-amber-800 dark:text-amber-300"
                        : "text-emerald-700 dark:text-emerald-400"
                  }`}
                >
                  {!ev.rule.enabled ? "Đang tắt" : ev.triggered ? "Đang kích hoạt" : "Đang theo dõi"}
                </span>
                <button
                  type="button"
                  onClick={() => onToggleAlertRule(ev.rule.id)}
                  className="px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] font-bold cursor-pointer"
                >
                  {ev.rule.enabled ? "Tắt" : "Bật"}
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteAlertRule(ev.rule.id)}
                  title="Xóa quy tắc cảnh báo"
                  className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Inline Add Alert Rule Form */}
        <form
          onSubmit={handleAddRule}
          className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs items-end"
        >
          <div className="sm:col-span-4 space-y-1">
            <label className="font-bold text-slate-600 dark:text-slate-300 block">
              Tên quy tắc cảnh báo
            </label>
            <input
              type="text"
              value={newAlertLabel}
              onChange={(e) => setNewAlertLabel(e.target.value)}
              placeholder="VD: Chốt 2 chỉ khi Nhẫn 9999 lên 9.8tr"
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
            />
          </div>
          <div className="sm:col-span-2 space-y-1">
            <label className="font-bold text-slate-600 dark:text-slate-300 block">Loại vàng</label>
            <select
              value={newAlertCat}
              onChange={(e) => setNewAlertCat(e.target.value as GoldCategory)}
              className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold"
            >
              {GOLD_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {GOLD_CATEGORY_META[c].shortLabel}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-3 space-y-1">
            <label className="font-bold text-slate-600 dark:text-slate-300 block">Điều kiện</label>
            <select
              value={newAlertCond}
              onChange={(e) => {
                const next = e.target.value as GoldAlertCondition;
                setNewAlertCond(next);
                setNewAlertThreshold(
                  next === "TARGET_BID_ABOVE"
                    ? "9800000"
                    : next === "WORLD_PREMIUM_BELOW_PCT"
                      ? "6"
                      : next === "SPREAD_ABOVE_PCT"
                        ? "3"
                        : "15"
                );
              }}
              className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold"
            >
              {(Object.keys(GOLD_ALERT_CONDITION_META) as GoldAlertCondition[]).map((k) => (
                <option key={k} value={k}>
                  {GOLD_ALERT_CONDITION_META[k].shortLabel}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2 space-y-1">
            <label className="font-bold text-slate-600 dark:text-slate-300 block">
              Ngưỡng ({GOLD_ALERT_CONDITION_META[newAlertCond].unit})
            </label>
            <input
              type="number"
              step={newAlertCond === "TARGET_BID_ABOVE" ? "50000" : "0.5"}
              value={newAlertThreshold}
              onChange={(e) => setNewAlertThreshold(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold tabular-nums"
            />
          </div>
          <div className="sm:col-span-1">
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
