"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Check, Info, X } from "lucide-react";
import {
  Account,
  GoldCategory,
  GoldLot,
  GoldPortfolioState,
  GoldSaleAllocationMode,
  GoldSalePurpose,
} from "@/types/finance";
import {
  GOLD_CATEGORY_META,
  allocateFifoGoldSale,
  allocateSpecificLotSale,
  allocateWacGoldSale,
  formatChiWeight,
} from "@/lib/goldEngine";
import { formatDateVN, formatShortVNDMasked, formatVNDMasked } from "@/lib/formatters";
import { GOLD_CATEGORIES, SALE_PURPOSE_LABELS } from "./goldConstants";

export interface GoldSellPrefill {
  category: GoldCategory;
  mode: GoldSaleAllocationMode;
  specificLotId?: string;
  quantityChi?: number;
  purpose?: GoldSalePurpose;
  note?: string;
}

interface GoldSellModalProps {
  open: boolean;
  prefill: GoldSellPrefill | null;
  goldPortfolio: GoldPortfolioState;
  holdingLots: GoldLot[];
  nonCreditAccounts: Account[];
  isPrivacyMode: boolean;
  onClose: () => void;
  onRecordSale: (input: {
    saleDate: string;
    category: GoldCategory;
    quantityChi: number;
    unitSellPricePerChi: number;
    mode: GoldSaleAllocationMode;
    specificLotId?: string;
    purpose: GoldSalePurpose;
    note?: string;
    linkAccountId?: string;
  }) => { ok: boolean; error?: string };
}

export function GoldSellModal({
  open,
  prefill,
  goldPortfolio,
  holdingLots,
  nonCreditAccounts,
  isPrivacyMode,
  onClose,
  onRecordSale,
}: GoldSellModalProps) {
  const [sellCategory, setSellCategory] = useState<GoldCategory>("NHAN_9999");
  const [sellMode, setSellMode] = useState<GoldSaleAllocationMode>("FIFO");
  const [sellSpecificLotId, setSellSpecificLotId] = useState("");
  const [sellQtyInput, setSellQtyInput] = useState("1");
  const [sellPriceInput, setSellPriceInput] = useState(
    String(goldPortfolio.quotes.NHAN_9999.buyPricePerChi)
  );
  const [sellDate, setSellDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [sellPurpose, setSellPurpose] = useState<GoldSalePurpose>("INTERIOR_HANDOVER");
  const [sellNote, setSellNote] = useState("");
  const [sellLinkAccountId, setSellLinkAccountId] = useState("");
  const [sellError, setSellError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const cat = prefill?.category ?? "NHAN_9999";
    setSellCategory(cat);
    setSellMode(prefill?.mode ?? (prefill?.specificLotId ? "SPECIFIC_LOT" : "FIFO"));
    setSellSpecificLotId(prefill?.specificLotId || "");
    setSellQtyInput(String(prefill?.quantityChi ?? 1));
    setSellPriceInput(String(goldPortfolio.quotes[cat].buyPricePerChi));
    setSellDate(new Date().toISOString().slice(0, 10));
    setSellPurpose(prefill?.purpose ?? "INTERIOR_HANDOVER");
    setSellNote(prefill?.note || "");
    setSellLinkAccountId("");
    setSellError(null);
  }, [open, prefill, goldPortfolio.quotes]);

  const livePreview = useMemo(() => {
    const qty = Number(sellQtyInput);
    const unitPrice = Number(sellPriceInput);
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(unitPrice) || unitPrice <= 0) {
      return null;
    }

    if (sellMode === "SPECIFIC_LOT" && !sellSpecificLotId) {
      return {
        ok: false as const,
        error: "Vui lòng chọn lô vàng cụ thể để xem trước lãi/lỗ.",
      };
    }

    const res =
      sellMode === "SPECIFIC_LOT"
        ? allocateSpecificLotSale(goldPortfolio.lots, sellSpecificLotId, qty)
        : sellMode === "WAC"
          ? allocateWacGoldSale(goldPortfolio.lots, sellCategory, qty)
          : allocateFifoGoldSale(goldPortfolio.lots, sellCategory, qty);

    if (!res.ok) {
      return { ok: false as const, error: res.error || "Không đủ tồn kho khả dụng." };
    }

    const totalProceeds = Math.round(qty * unitPrice);
    const totalCostBasis = res.allocations.reduce((s, a) => s + a.costBasisAllocated, 0);
    const realizedPnl = totalProceeds - totalCostBasis;
    const realizedPnlPct =
      totalCostBasis > 0 ? Number(((realizedPnl / totalCostBasis) * 100).toFixed(2)) : 0;

    const impactedLots = res.allocations.map((alloc) => {
      const before = goldPortfolio.lots.find((l) => l.id === alloc.lotId);
      const after = res.updatedLots.find((l) => l.id === alloc.lotId);
      return {
        lotId: alloc.lotId,
        brand: before?.brand || "Lô vàng",
        purchaseDate: before?.purchaseDate || "",
        soldChi: alloc.soldChi,
        costBasis: alloc.costBasisAllocated,
        remainingAfterChi: after?.remainingChi ?? 0,
      };
    });

    return {
      ok: true as const,
      totalProceeds,
      totalCostBasis,
      realizedPnl,
      realizedPnlPct,
      impactedLots,
      wacPerChi:
        "wacPerChi" in res && typeof res.wacPerChi === "number" ? res.wacPerChi : undefined,
    };
  }, [sellQtyInput, sellPriceInput, sellMode, sellSpecificLotId, sellCategory, goldPortfolio.lots]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSellError(null);
    const qty = Number(sellQtyInput);
    const unitPrice = Number(sellPriceInput);
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(unitPrice) || unitPrice <= 0) {
      setSellError("Vui lòng nhập số chỉ và giá tiệm mua lại hợp lệ.");
      return;
    }

    const res = onRecordSale({
      saleDate: sellDate,
      category: sellCategory,
      quantityChi: qty,
      unitSellPricePerChi: Math.round(unitPrice),
      mode: sellMode,
      specificLotId: sellMode === "SPECIFIC_LOT" ? sellSpecificLotId : undefined,
      purpose: sellPurpose,
      note: sellNote.trim() || undefined,
      linkAccountId: sellLinkAccountId || undefined,
    });

    if (!res.ok) {
      setSellError(res.error || "Không thể ghi nhận giao dịch bán vàng.");
      return;
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
              Ghi nhận bán vàng / Thanh khoản
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Hỗ trợ xuất lô FIFO, Bình quân gia quyền (WAC) hoặc chỉ định lô cụ thể kèm xem trước lãi/lỗ.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng hộp thoại bán vàng"
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {sellError && (
            <p className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-bold">
              {sellError}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
                Phương thức xuất lô
              </label>
              <select
                value={sellMode}
                onChange={(e) => setSellMode(e.target.value as GoldSaleAllocationMode)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
              >
                <option value="FIFO">FIFO (Bán lô mua cũ nhất)</option>
                <option value="WAC">WAC (Giá vốn bình quân gia quyền)</option>
                <option value="SPECIFIC_LOT">Chọn lô cụ thể</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
                Loại vàng bán
              </label>
              <select
                value={sellCategory}
                onChange={(e) => {
                  const nextCat = e.target.value as GoldCategory;
                  setSellCategory(nextCat);
                  setSellPriceInput(String(goldPortfolio.quotes[nextCat].buyPricePerChi));
                }}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
              >
                {GOLD_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {GOLD_CATEGORY_META[c].label}
                  </option>
                ))}
              </select>
            </div>

            {sellMode === "SPECIFIC_LOT" && (
              <div className="col-span-2">
                <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Chọn lô cần bán
                </label>
                <select
                  value={sellSpecificLotId}
                  onChange={(e) => {
                    const lot = holdingLots.find((l) => l.id === e.target.value);
                    setSellSpecificLotId(e.target.value);
                    if (lot) {
                      setSellCategory(lot.category);
                      setSellPriceInput(String(goldPortfolio.quotes[lot.category].buyPricePerChi));
                    }
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold"
                >
                  <option value="">-- Chọn lô đang giữ --</option>
                  {holdingLots.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.brand} ({formatDateVN(l.purchaseDate)}) · Còn {l.remainingChi} chỉ
                      {l.serialNumber ? ` · Seri ${l.serialNumber}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
                Số chỉ bán
              </label>
              <input
                type="number"
                step="0.05"
                min="0.05"
                required
                value={sellQtyInput}
                onChange={(e) => setSellQtyInput(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold tabular-nums"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
                Giá tiệm mua lại (Bid / chỉ)
              </label>
              <input
                type="number"
                step="10000"
                min="100000"
                required
                value={sellPriceInput}
                onChange={(e) => setSellPriceInput(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold tabular-nums"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
                Ngày bán
              </label>
              <input
                type="date"
                required
                value={sellDate}
                onChange={(e) => setSellDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
                Mục đích sử dụng tiền
              </label>
              <select
                value={sellPurpose}
                onChange={(e) => setSellPurpose(e.target.value as GoldSalePurpose)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold"
              >
                {(Object.keys(SALE_PURPOSE_LABELS) as GoldSalePurpose[]).map((p) => (
                  <option key={p} value={p}>
                    {SALE_PURPOSE_LABELS[p]}
                  </option>
                ))}
              </select>
            </div>

            {/* Live Sale Preview Panel */}
            {livePreview && (
              <div className="col-span-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/90 dark:bg-slate-800/60 p-3 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                    <Info className="w-3.5 h-3.5 text-amber-600" />
                    <span>Xem trước hạch toán thực nhận ({sellMode})</span>
                  </span>
                  {livePreview.ok && livePreview.wacPerChi && (
                    <span className="text-[10.5px] font-bold text-slate-500 dark:text-slate-400 tabular-nums">
                      WAC: {formatShortVNDMasked(livePreview.wacPerChi, isPrivacyMode)}/chỉ
                    </span>
                  )}
                </div>

                {!livePreview.ok ? (
                  <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                    {livePreview.error}
                  </p>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-2 tabular-nums">
                      <div className="p-2 rounded-md bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700">
                        <span className="text-[10px] text-slate-500 block">Tiền thực thu (Bid)</span>
                        <strong className="text-xs font-black text-slate-900 dark:text-white">
                          {formatVNDMasked(livePreview.totalProceeds, isPrivacyMode)}
                        </strong>
                      </div>
                      <div className="p-2 rounded-md bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700">
                        <span className="text-[10px] text-slate-500 block">Giá vốn phân bổ</span>
                        <strong className="text-xs font-black text-slate-700 dark:text-slate-200">
                          {formatVNDMasked(livePreview.totalCostBasis, isPrivacyMode)}
                        </strong>
                      </div>
                      <div className="p-2 rounded-md bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700">
                        <span className="text-[10px] text-slate-500 block">Lãi/Lỗ thực nhận</span>
                        <strong
                          className={`text-xs font-black ${
                            livePreview.realizedPnl >= 0
                              ? "text-emerald-700 dark:text-emerald-400"
                              : "text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          {livePreview.realizedPnl >= 0 ? "+" : ""}
                          {formatShortVNDMasked(livePreview.realizedPnl, isPrivacyMode)} (
                          {livePreview.realizedPnlPct >= 0 ? "+" : ""}
                          {livePreview.realizedPnlPct}%)
                        </strong>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <p className="text-[10.5px] font-bold text-slate-500 dark:text-slate-400">
                        Các lô bị khấu trừ ({livePreview.impactedLots.length} lô):
                      </p>
                      <div className="divide-y divide-slate-200/60 dark:divide-slate-700/60 rounded-md border border-slate-200/70 dark:border-slate-700 bg-white dark:bg-slate-900">
                        {livePreview.impactedLots.map((row) => (
                          <div
                            key={row.lotId}
                            className="px-2.5 py-1.5 flex items-center justify-between gap-2 text-[11px] tabular-nums"
                          >
                            <span className="truncate font-semibold text-slate-700 dark:text-slate-200">
                              {row.brand}
                              {row.purchaseDate ? ` (${formatDateVN(row.purchaseDate)})` : ""}
                            </span>
                            <span className="shrink-0 text-slate-600 dark:text-slate-300">
                              Trừ <strong>{formatChiWeight(row.soldChi, isPrivacyMode)}</strong> · Còn{" "}
                              <strong className="text-teal-700 dark:text-teal-300">
                                {formatChiWeight(row.remainingAfterChi, isPrivacyMode)}
                              </strong>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="col-span-2">
              <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
                Liên thông Sổ Thu Chi (nạp tiền bán vàng vào ví ngân hàng)
              </label>
              <select
                value={sellLinkAccountId}
                onChange={(e) => setSellLinkAccountId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold"
              >
                <option value="">Chỉ ghi nhận trong Kho Vàng</option>
                {nonCreditAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    Nạp tiền vào ví: {acc.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-span-2">
              <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
                Ghi chú (tùy chọn)
              </label>
              <input
                type="text"
                value={sellNote}
                onChange={(e) => setSellNote(e.target.value)}
                placeholder="VD: Bán tại PNJ để thanh toán đợt 1 nội thất"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={Boolean(livePreview && !livePreview.ok)}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg font-bold bg-slate-900 dark:bg-amber-600 hover:opacity-90 disabled:opacity-50 text-white cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Xác nhận bán vàng</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

