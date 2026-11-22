"use client";

import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  RefreshCw,
  RotateCcw,
  Scale,
} from "lucide-react";
import { GoldCategory, GoldPortfolioState } from "@/types/finance";
import {
  GOLD_CATEGORY_META,
  GoldWeightUnit,
  calculateLedgerIntegrity,
  convertGoldUnit,
  decomposeChiToVietnameseUnits,
} from "@/lib/goldEngine";
import { formatVNDMasked } from "@/lib/formatters";

interface GoldStocktakePanelProps {
  goldPortfolio: GoldPortfolioState;
  isPrivacyMode: boolean;
  onRequestReconcile: () => void;
}

const STOCKTAKE_UNIT_OPTIONS: { value: GoldWeightUnit; label: string; short: string }[] = [
  { value: "CHI", label: "Chỉ", short: "chỉ" },
  { value: "LUONG", label: "Lượng (Cây)", short: "lượng" },
  { value: "PHAN", label: "Phân", short: "phân" },
  { value: "LY", label: "Ly", short: "ly" },
  { value: "GRAM", label: "Gram (g)", short: "g" },
];

function formatQty(val: number, maxDigits = 4): string {
  return val.toLocaleString("vi-VN", { maximumFractionDigits: maxDigits });
}

export function GoldStocktakePanel({
  goldPortfolio,
  isPrivacyMode,
  onRequestReconcile,
}: GoldStocktakePanelProps) {
  const [inputUnit, setInputUnit] = useState<GoldWeightUnit>("CHI");
  const [rawInputs, setRawInputs] = useState<Partial<Record<GoldCategory, string>>>({});

  // Quy đổi toàn bộ số đếm két người dùng nhập sang đơn vị Chỉ bằng số học nguyên tỷ lệ
  const physicalCountByCategory = useMemo(() => {
    const mapped: Partial<Record<GoldCategory, number>> = {};
    for (const [catKey, rawStr] of Object.entries(rawInputs)) {
      if (rawStr === undefined || rawStr.trim() === "") continue;
      const numeric = Number(rawStr);
      if (Number.isFinite(numeric) && numeric >= 0) {
        mapped[catKey as GoldCategory] = convertGoldUnit(numeric, inputUnit, "CHI", 4);
      }
    }
    return mapped;
  }, [rawInputs, inputUnit]);

  const ledger = useMemo(
    () => calculateLedgerIntegrity(goldPortfolio, physicalCountByCategory),
    [goldPortfolio, physicalCountByCategory]
  );

  const bookDecomposition = useMemo(
    () => decomposeChiToVietnameseUnits(ledger.recordedLotsRemainingChi),
    [ledger.recordedLotsRemainingChi]
  );

  const physicalDecomposition = useMemo(
    () =>
      ledger.totalPhysicalCountChi !== null
        ? decomposeChiToVietnameseUnits(ledger.totalPhysicalCountChi)
        : null,
    [ledger.totalPhysicalCountChi]
  );

  const activeUnitShort =
    STOCKTAKE_UNIT_OPTIONS.find((u) => u.value === inputUnit)?.short ?? "chỉ";

  const handleChangeInputUnit = (nextUnit: GoldWeightUnit) => {
    if (nextUnit === inputUnit) return;
    // Quy đổi giữ nguyên khối lượng đang nhập sang đơn vị mới
    const converted: Partial<Record<GoldCategory, string>> = {};
    for (const [catKey, rawStr] of Object.entries(rawInputs)) {
      if (rawStr === undefined || rawStr.trim() === "") continue;
      const numeric = Number(rawStr);
      if (Number.isFinite(numeric) && numeric >= 0) {
        const nextVal = convertGoldUnit(numeric, inputUnit, nextUnit, 4);
        converted[catKey as GoldCategory] = String(nextVal);
      }
    }
    setInputUnit(nextUnit);
    setRawInputs(converted);
  };

  const handleFillMatchBook = () => {
    const next: Partial<Record<GoldCategory, string>> = {};
    for (const row of ledger.byCategory) {
      const converted = convertGoldUnit(row.recordedLotsRemainingChi, "CHI", inputUnit, 4);
      next[row.category] = String(converted);
    }
    setRawInputs(next);
  };

  const handleClearStocktake = () => {
    setRawInputs({});
  };

  return (
    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
              Đối Soát Sổ Sách & Kiểm Đếm Két Vật Lý
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {ledger.summary}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-semibold">
            <span>Đơn vị đếm:</span>
            <select
              value={inputUnit}
              onChange={(e) => handleChangeInputUnit(e.target.value as GoldWeightUnit)}
              aria-label="Đơn vị nhập kiểm đếm két vật lý"
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold"
            >
              {STOCKTAKE_UNIT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={handleFillMatchBook}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ClipboardCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Điền khớp sổ sách</span>
          </button>

          {ledger.hasPhysicalAudit && (
            <button
              type="button"
              onClick={handleClearStocktake}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-bold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Đặt lại</span>
            </button>
          )}

          {!ledger.isBookBalanced && (
            <button
              type="button"
              onClick={onRequestReconcile}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-extrabold bg-rose-600 hover:bg-rose-700 text-white whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Tự đối soát sổ cái</span>
            </button>
          )}
        </div>
      </div>

      {/* Quantitative Book Summary Row (Hairline dividers, zero nested bordered cards) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-3 border-y border-slate-100 dark:border-slate-800 tabular-nums">
        <div>
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
            Tổng mua gốc
          </span>
          <strong className="text-sm font-black text-slate-900 dark:text-white">
            {formatQty(ledger.totalPurchasedChi)} chỉ
          </strong>
        </div>
        <div>
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
            Đã bán theo phân bổ
          </span>
          <strong className="text-sm font-black text-slate-900 dark:text-white">
            {formatQty(ledger.totalSoldAllocatedChi)} chỉ
          </strong>
        </div>
        <div>
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
            Tồn sổ sách (Kỳ vọng / Ghi nhận)
          </span>
          <strong className="text-sm font-black text-slate-900 dark:text-white">
            {formatQty(ledger.expectedBookRemainingChi)} / {formatQty(ledger.recordedLotsRemainingChi)} chỉ
          </strong>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
            {bookDecomposition.luong} Lượng · {bookDecomposition.chi} Chỉ ·{" "}
            {bookDecomposition.phan} Phân · {bookDecomposition.ly} Ly
          </span>
        </div>
        <div>
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
            Sai lệch sổ cái / Két vật lý
          </span>
          {!ledger.isBookBalanced ? (
            <strong className="text-sm font-black text-rose-600 dark:text-rose-400 inline-flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>
                Lệch sổ {ledger.bookDriftChi > 0 ? "+" : ""}
                {formatQty(ledger.bookDriftChi)} chỉ
              </span>
            </strong>
          ) : !ledger.hasPhysicalAudit ? (
            <strong className="text-sm font-black text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Sổ sách khớp 0 chỉ</span>
            </strong>
          ) : ledger.isPhysicallyBalanced ? (
            <strong className="text-sm font-black text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Két khớp 100%</span>
            </strong>
          ) : (
            <div>
              <strong
                className={`text-sm font-black inline-flex items-center gap-1 ${
                  (ledger.totalPhysicalVarianceChi ?? 0) > 0
                    ? "text-amber-700 dark:text-amber-300"
                    : "text-rose-600 dark:text-rose-400"
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>
                  {(ledger.totalPhysicalVarianceChi ?? 0) > 0 ? "Thừa +" : "Thiếu "}
                  {formatQty(ledger.totalPhysicalVarianceChi ?? 0)} chỉ
                </span>
              </strong>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                Giá trị Bid:{" "}
                {formatVNDMasked(ledger.totalPhysicalVarianceVnd ?? 0, isPrivacyMode)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Category Ledger & Physical Stocktake Table */}
      {ledger.byCategory.length === 0 ? (
        <p className="text-xs text-slate-500 dark:text-slate-400 py-2">
          Chưa có lô vàng nào trong sổ cái để đối soát. Hãy thêm lô mua đầu tiên để bắt đầu theo dõi.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                <th className="py-2 pr-3">Loại vàng</th>
                <th className="py-2 px-2.5 text-right">Mua gốc (chỉ)</th>
                <th className="py-2 px-2.5 text-right">Đã bán (chỉ)</th>
                <th className="py-2 px-2.5 text-right">Tồn sổ sách (chỉ)</th>
                <th className="py-2 px-2.5 text-right">Lệch sổ (chỉ)</th>
                <th className="py-2 px-2.5 text-right">Kiểm đếm két ({activeUnitShort})</th>
                <th className="py-2 pl-2.5 text-right">Kết quả đối soát</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 tabular-nums">
              {ledger.byCategory.map((row) => {
                const meta = GOLD_CATEGORY_META[row.category];
                const inputVal = rawInputs[row.category] ?? "";

                return (
                  <tr
                    key={row.category}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="py-2.5 pr-3">
                      <span className="font-bold text-slate-900 dark:text-white block">
                        {meta.label}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        Giá thu mua Bid: {formatVNDMasked(row.bidPricePerChi, isPrivacyMode)}/chỉ
                      </span>
                    </td>
                    <td className="py-2.5 px-2.5 text-right text-slate-700 dark:text-slate-300">
                      {formatQty(row.purchasedChi)}
                    </td>
                    <td className="py-2.5 px-2.5 text-right text-slate-700 dark:text-slate-300">
                      {formatQty(row.soldAllocatedChi)}
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-bold text-slate-900 dark:text-white">
                      {formatQty(row.recordedLotsRemainingChi)}
                    </td>
                    <td
                      className={`py-2.5 px-2.5 text-right font-bold ${
                        Math.abs(row.bookDriftChi) > 0.0001
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      {row.bookDriftChi > 0 ? "+" : ""}
                      {formatQty(row.bookDriftChi)}
                    </td>
                    <td className="py-2.5 px-2.5 text-right">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={inputVal}
                        onChange={(e) =>
                          setRawInputs((prev) => ({
                            ...prev,
                            [row.category]: e.target.value,
                          }))
                        }
                        placeholder={formatQty(
                          convertGoldUnit(row.recordedLotsRemainingChi, "CHI", inputUnit, 4)
                        )}
                        aria-label={`Kiểm đếm thực tế ${meta.shortLabel}`}
                        className="w-28 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-right font-bold text-slate-900 dark:text-white tabular-nums"
                      />
                    </td>
                    <td className="py-2.5 pl-2.5 text-right whitespace-nowrap">
                      {row.status === "BOOK_DRIFT" ? (
                        <span className="font-bold text-rose-600 dark:text-rose-400">
                          Lệch sổ {row.bookDriftChi > 0 ? "+" : ""}
                          {formatQty(row.bookDriftChi)} chỉ
                        </span>
                      ) : row.physicalCountChi === null ? (
                        <span className="text-slate-400 dark:text-slate-500 font-medium">
                          Chưa nhập đếm
                        </span>
                      ) : row.status === "MATCHED" ? (
                        <span className="font-bold text-emerald-700 dark:text-emerald-400">
                          Khớp tuyệt đối
                        </span>
                      ) : row.status === "PHYSICAL_SURPLUS" ? (
                        <div>
                          <span className="font-bold text-amber-700 dark:text-amber-300 block">
                            Thừa +{formatQty(row.physicalVarianceChi ?? 0)} chỉ
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            +{formatVNDMasked(row.physicalVarianceVnd ?? 0, isPrivacyMode)}
                          </span>
                        </div>
                      ) : (
                        <div>
                          <span className="font-bold text-rose-600 dark:text-rose-400 block">
                            Thiếu {formatQty(row.physicalVarianceChi ?? 0)} chỉ
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            {formatVNDMasked(row.physicalVarianceVnd ?? 0, isPrivacyMode)}
                          </span>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Physical Total Decomposition Footnote */}
      {physicalDecomposition && ledger.totalPhysicalCountChi !== null && (
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs tabular-nums text-slate-600 dark:text-slate-300">
          <span>
            Tổng vàng đếm thực tế quy đổi:{" "}
            <strong className="text-slate-900 dark:text-white">
              {formatQty(ledger.totalPhysicalCountChi)} chỉ
            </strong>
          </span>
          <span className="font-bold text-slate-900 dark:text-white">
            {physicalDecomposition.luong} Lượng · {physicalDecomposition.chi} Chỉ ·{" "}
            {physicalDecomposition.phan} Phân · {physicalDecomposition.ly} Ly
          </span>
        </div>
      )}
    </section>
  );
}
