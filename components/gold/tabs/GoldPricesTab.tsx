"use client";

import React, { useMemo, useState } from "react";
import { AlertTriangle, ArrowLeftRight, Bell, Plus, RefreshCw, Trash2 } from "lucide-react";
import {
  GoldAlertCondition,
  GoldCategory,
  GoldPortfolioState,
} from "@/types/finance";
import {
  EvaluatedGoldAlert,
  GOLD_ALERT_CONDITION_META,
  GOLD_CATEGORY_META,
  GoldWeightUnit,
  computeDomesticPremium,
  computeWorldGoldPricePerChiVnd,
  convertGoldUnit,
  decomposeChiToVietnameseUnits,
} from "@/lib/goldEngine";
import { formatVNDMasked } from "@/lib/formatters";
import { useFinance } from "@/context/FinanceContext";
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

  const { fetchReferenceGoldPrices } = useFinance();
  const [convAmount, setConvAmount] = useState("1");
  const [convUnit, setConvUnit] = useState<GoldWeightUnit>("LUONG");
  const [convCategory, setConvCategory] = useState<GoldCategory>("NHAN_9999");
  const [quoteGuardWarning, setQuoteGuardWarning] = useState<string | null>(null);
  const [nhanPremiumPct, setNhanPremiumPct] = useState<string>("5.5");
  const [sjcPremiumPct, setSjcPremiumPct] = useState<string>("8.5");
  const [isCalibratingRef, setIsCalibratingRef] = useState<boolean>(false);
  const [calibrationNote, setCalibrationNote] = useState<string | null>(null);

  const handleCalibratedFetch = async () => {
    setIsCalibratingRef(true);
    setCalibrationNote(null);
    try {
      const nhan = Number(nhanPremiumPct);
      const sjc = Number(sjcPremiumPct);
      const res = await fetchReferenceGoldPrices(true, {
        nhanPremiumPct: Number.isFinite(nhan) ? nhan : undefined,
        sjcPremiumPct: Number.isFinite(sjc) ? sjc : undefined,
      });
      setCalibrationNote(
        res.ok
          ? res.note || "Đã đồng bộ giá tham khảo theo biên độ nội địa tùy chỉnh."
          : res.error || "Chưa thể cập nhật giá tham khảo."
      );
    } finally {
      setIsCalibratingRef(false);
    }
  };

  const worldPerChi = useMemo(
    () => computeWorldGoldPricePerChiVnd(goldPortfolio.macro),
    [goldPortfolio.macro]
  );

  const unitConversion = useMemo(() => {
    const val = Math.max(0, Number(convAmount) || 0);
    const chi = convertGoldUnit(val, convUnit, "CHI");
    const quote = goldPortfolio.quotes[convCategory];
    return {
      chi,
      luong: convertGoldUnit(val, convUnit, "LUONG"),
      phan: convertGoldUnit(val, convUnit, "PHAN"),
      ly: convertGoldUnit(val, convUnit, "LY"),
      gram: convertGoldUnit(val, convUnit, "GRAM"),
      troyOz: convertGoldUnit(val, convUnit, "TROY_OZ"),
      vietnameseBreakdown: decomposeChiToVietnameseUnits(chi),
      bidValueVnd: Math.round(chi * (quote?.buyPricePerChi || 0)),
      askValueVnd: Math.round(chi * (quote?.sellPricePerChi || 0)),
    };
  }, [convAmount, convUnit, convCategory, goldPortfolio.quotes]);

  const handleQuotePriceChange = (
    cat: GoldCategory,
    field: "buyPricePerChi" | "sellPricePerChi",
    rawValue: string
  ) => {
    const numeric = Math.max(0, Number(rawValue) || 0);
    if (!Number.isFinite(numeric) || numeric <= 0) return;

    const current = goldPortfolio.quotes[cat];
    const catLabel = GOLD_CATEGORY_META[cat].shortLabel;

    if (field === "buyPricePerChi" && numeric > current.sellPricePerChi) {
      setQuoteGuardWarning(
        `Chặn ngược giá (${catLabel}): Giá tiệm mua vào (Bid) không được cao hơn giá bán ra (Ask ${current.sellPricePerChi.toLocaleString("vi-VN")} đ/chỉ). Vui lòng tăng giá Ask trước hoặc nhập Bid ≤ Ask.`
      );
      return;
    }

    if (field === "sellPricePerChi" && numeric < current.buyPricePerChi) {
      setQuoteGuardWarning(
        `Chặn ngược giá (${catLabel}): Giá tiệm bán ra (Ask) không được thấp hơn giá mua vào (Bid ${current.buyPricePerChi.toLocaleString("vi-VN")} đ/chỉ). Vui lòng giảm giá Bid trước hoặc nhập Ask ≥ Bid.`
      );
      return;
    }

    setQuoteGuardWarning(null);
    onUpdateQuote(cat, { [field]: numeric, source: "MANUAL" });
  };

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

        {(calibrationNote || refStatusMsg) && (
          <p className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200">
            {calibrationNote || refStatusMsg}
          </p>
        )}

        {/* Hiệu chỉnh Premium nội địa so với XAU/USD thế giới */}
        <div className="flex flex-wrap items-end gap-3 rounded-lg bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/50 px-3 py-2.5 text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-amber-900 dark:text-amber-300 mb-1">
              Chênh lệch Nhẫn 9999 vs Thế giới (%)
            </label>
            <input
              type="number"
              step="0.5"
              min="-10"
              max="35"
              value={nhanPremiumPct}
              onChange={(e) => setNhanPremiumPct(e.target.value)}
              className="w-28 rounded-md border border-amber-300 dark:border-amber-800 bg-white dark:bg-slate-900 px-2 py-1 text-xs font-bold tabular-nums text-slate-900 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-amber-900 dark:text-amber-300 mb-1">
              Chênh lệch SJC vs Thế giới (%)
            </label>
            <input
              type="number"
              step="0.5"
              min="-10"
              max="45"
              value={sjcPremiumPct}
              onChange={(e) => setSjcPremiumPct(e.target.value)}
              className="w-28 rounded-md border border-amber-300 dark:border-amber-800 bg-white dark:bg-slate-900 px-2 py-1 text-xs font-bold tabular-nums text-slate-900 dark:text-slate-100"
            />
          </div>
          <button
            type="button"
            disabled={isCalibratingRef || isFetchingRef}
            onClick={() => void handleCalibratedFetch()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-amber-700 hover:bg-amber-800 disabled:opacity-60 text-white cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isCalibratingRef ? "animate-spin" : ""}`} />
            <span>Áp dụng biên độ &amp; Kéo giá</span>
          </button>
        </div>

        {quoteGuardWarning && (
          <div className="px-3 py-2 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-800 flex items-center justify-between gap-2 text-xs font-semibold text-rose-800 dark:text-rose-200">
            <span className="inline-flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>{quoteGuardWarning}</span>
            </span>
            <button
              type="button"
              onClick={() => setQuoteGuardWarning(null)}
              className="text-[11px] font-bold underline shrink-0 cursor-pointer"
            >
              Đã hiểu
            </button>
          </div>
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
                          handleQuotePriceChange(cat, "buyPricePerChi", e.target.value)
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
                          handleQuotePriceChange(cat, "sellPricePerChi", e.target.value)
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

      {/* Bidirectional Gold Unit Converter (Chỉ ↔ Lượng ↔ Phân ↔ Ly ↔ Gram ↔ Troy Oz) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
                Quy Đổi Đơn Vị Vàng 2 Chiều (6 Đơn Vị) & Đối Chiếu Hóa Đơn Vật Lý
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Chuẩn đo lường Việt Nam & Quốc tế: 1 Lượng = 10 Chỉ = 100 Phân = 1.000 Ly = 37,5 Gram ≈ 1,2057 Troy Oz
              </p>
            </div>
          </div>
          <select
            value={convCategory}
            onChange={(e) => setConvCategory(e.target.value as GoldCategory)}
            aria-label="Loại vàng quy đổi giá"
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold"
          >
            {GOLD_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                Định giá theo: {GOLD_CATEGORY_META[c].shortLabel}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center text-xs">
          <div className="lg:col-span-4 flex items-center gap-2">
            <input
              type="number"
              min="0"
              step="0.1"
              value={convAmount}
              onChange={(e) => setConvAmount(e.target.value)}
              aria-label="Số lượng vàng cần quy đổi"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-black tabular-nums"
            />
            <select
              value={convUnit}
              onChange={(e) => setConvUnit(e.target.value as GoldWeightUnit)}
              aria-label="Đơn vị nhập vào"
              className="px-2.5 py-2 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 font-bold shrink-0"
            >
              <option value="CHI">Chỉ</option>
              <option value="LUONG">Lượng (Cây)</option>
              <option value="PHAN">Phân</option>
              <option value="LY">Ly</option>
              <option value="GRAM">Gram (g)</option>
              <option value="TROY_OZ">Troy Oz</option>
            </select>
          </div>

          <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2 tabular-nums">
            {[
              { key: "CHI", label: "Chỉ", val: unitConversion.chi },
              { key: "LUONG", label: "Lượng", val: unitConversion.luong },
              { key: "PHAN", label: "Phân", val: unitConversion.phan },
              { key: "LY", label: "Ly", val: unitConversion.ly },
              { key: "GRAM", label: "Gram", val: unitConversion.gram },
              { key: "TROY_OZ", label: "Troy Oz", val: unitConversion.troyOz },
            ].map((u) => (
              <div
                key={u.key}
                className={`px-2.5 py-2 rounded-lg border ${
                  convUnit === u.key
                    ? "bg-amber-50/70 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800"
                    : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800"
                }`}
              >
                <span className="text-[10px] font-semibold text-slate-500 block">{u.label}</span>
                <strong className="text-xs font-black text-slate-900 dark:text-white">
                  {u.val.toLocaleString("vi-VN", { maximumFractionDigits: 4 })}
                </strong>
              </div>
            ))}
          </div>
        </div>

        {/* Vietnamese Physical Receipt Decomposition */}
        <div className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs tabular-nums">
          <span className="text-slate-500 dark:text-slate-400 font-semibold">
            Đọc chuẩn hóa đơn vật lý Việt Nam:
          </span>
          <span className="font-black text-slate-900 dark:text-white">
            {unitConversion.vietnameseBreakdown.luong} Lượng ·{" "}
            {unitConversion.vietnameseBreakdown.chi} Chỉ ·{" "}
            {unitConversion.vietnameseBreakdown.phan} Phân ·{" "}
            {unitConversion.vietnameseBreakdown.ly} Ly
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs tabular-nums">
          <span className="text-slate-600 dark:text-slate-300">
            Bán ra tiệm thu mua (Bid):{" "}
            <strong className="text-emerald-700 dark:text-emerald-400">
              {formatVNDMasked(unitConversion.bidValueVnd, isPrivacyMode)}
            </strong>
          </span>
          <span className="text-slate-600 dark:text-slate-300">
            Mua mới từ tiệm (Ask):{" "}
            <strong className="text-slate-900 dark:text-white">
              {formatVNDMasked(unitConversion.askValueVnd, isPrivacyMode)}
            </strong>
          </span>
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
