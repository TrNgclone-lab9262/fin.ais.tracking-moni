"use client";

import React, { useMemo, useState } from "react";
import {
  Download,
  FileText,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import {
  GoldCategory,
  GoldLot,
  GoldPortfolioState,
  GoldStorageLocation,
} from "@/types/finance";
import {
  GOLD_CATEGORY_META,
  GOLD_STORAGE_LABELS,
  GoldPortfolioMetrics,
  exportGoldVaultToCsv,
  formatChiWeight,
} from "@/lib/goldEngine";
import { formatDateVN, formatShortVNDMasked, formatVNDMasked } from "@/lib/formatters";
import { GOLD_CATEGORIES, SALE_PURPOSE_LABELS } from "./goldConstants";

interface GoldLotsTabProps {
  goldPortfolio: GoldPortfolioState;
  metrics: GoldPortfolioMetrics;
  isPrivacyMode: boolean;
  onOpenAddLot: () => void;
  onEditLot: (lot: GoldLot) => void;
  onSellLot: (lot: GoldLot) => void;
  onDeleteLot: (id: string) => void;
  onPrintVaultAudit: () => void;
}

type LotSortKey = "DATE_DESC" | "PNL_DESC" | "WEIGHT_DESC";

export function GoldLotsTab({
  goldPortfolio,
  metrics,
  isPrivacyMode,
  onOpenAddLot,
  onEditLot,
  onSellLot,
  onDeleteLot,
  onPrintVaultAudit,
}: GoldLotsTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<GoldCategory | "ALL">("ALL");
  const [storageFilter, setStorageFilter] = useState<GoldStorageLocation | "ALL">("ALL");
  const [sortKey, setSortKey] = useState<LotSortKey>("DATE_DESC");

  const filteredEvaluations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = metrics.lotEvaluations.filter((ev) => {
      if (categoryFilter !== "ALL" && ev.lot.category !== categoryFilter) return false;
      if (storageFilter !== "ALL" && ev.lot.storageLocation !== storageFilter) return false;
      if (!q) return true;
      return (
        ev.lot.brand.toLowerCase().includes(q) ||
        (ev.lot.serialNumber || "").toLowerCase().includes(q) ||
        (ev.lot.certificateCode || "").toLowerCase().includes(q) ||
        (ev.lot.storeName || "").toLowerCase().includes(q) ||
        (ev.lot.invoiceNote || "").toLowerCase().includes(q)
      );
    });

    return [...list].sort((a, b) => {
      if (sortKey === "PNL_DESC") return b.unrealizedPnlPct - a.unrealizedPnlPct;
      if (sortKey === "WEIGHT_DESC") return b.lot.remainingChi - a.lot.remainingChi;
      return b.lot.purchaseDate.localeCompare(a.lot.purchaseDate);
    });
  }, [metrics.lotEvaluations, searchQuery, categoryFilter, storageFilter, sortKey]);

  const documentedLotsCount = useMemo(
    () =>
      metrics.lotEvaluations.filter(
        (ev) => Boolean(ev.lot.serialNumber || ev.lot.certificateCode || ev.lot.storeName)
      ).length,
    [metrics.lotEvaluations]
  );

  return (
    <div className="space-y-5">
      {/* Toolbar & Filters */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-black text-slate-900 dark:text-slate-100">
              Sổ Lô Nắm Giữ & Két Chứng Từ Seri ({metrics.lotEvaluations.length} lô)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
              <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" />
                {documentedLotsCount}/{metrics.lotEvaluations.length} lô có hồ sơ chứng từ / cửa hàng
              </span>{" "}
              · Định giá từng lô theo giá tiệm thu mua (Bid)
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => exportGoldVaultToCsv(goldPortfolio, metrics)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>
            <button
              type="button"
              onClick={onPrintVaultAudit}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>In Kiểm kê</span>
            </button>
            <button
              type="button"
              onClick={onOpenAddLot}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-extrabold bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm lô mua</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm thương hiệu, số seri, hóa đơn, cửa hàng..."
              className="w-full pl-8 pr-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as GoldCategory | "ALL")}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold"
          >
            <option value="ALL">Tất cả loại vàng</option>
            {GOLD_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {GOLD_CATEGORY_META[c].label}
              </option>
            ))}
          </select>

          <select
            value={storageFilter}
            onChange={(e) => setStorageFilter(e.target.value as GoldStorageLocation | "ALL")}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold"
          >
            <option value="ALL">Tất cả nơi cất giữ</option>
            {(Object.keys(GOLD_STORAGE_LABELS) as GoldStorageLocation[]).map((loc) => (
              <option key={loc} value={loc}>
                {GOLD_STORAGE_LABELS[loc]}
              </option>
            ))}
          </select>

          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as LotSortKey)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold"
          >
            <option value="DATE_DESC">Sắp xếp: Ngày mua mới nhất</option>
            <option value="PNL_DESC">Sắp xếp: Lãi % cao nhất</option>
            <option value="WEIGHT_DESC">Sắp xếp: Khối lượng lớn nhất</option>
          </select>
        </div>
      </div>

      {/* Active Holding Lots Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-2.5 px-3">Lô vàng & Chứng từ Seri</th>
                <th className="py-2.5 px-3">Ngày mua</th>
                <th className="py-2.5 px-3 text-right">Khối lượng</th>
                <th className="py-2.5 px-3 text-right">Giá vốn / chỉ</th>
                <th className="py-2.5 px-3 text-right">Giá trị Bid</th>
                <th className="py-2.5 px-3 text-right">Lãi/Lỗ tạm tính</th>
                <th className="py-2.5 px-3">Nơi cất</th>
                <th className="py-2.5 px-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {filteredEvaluations.map((ev) => (
                <tr key={ev.lot.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                  <td className="py-3 px-3">
                    <p className="font-bold text-slate-900 dark:text-white">{ev.lot.brand}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {GOLD_CATEGORY_META[ev.lot.category].shortLabel}
                      {ev.lot.purityLabel ? ` · ${ev.lot.purityLabel}` : ""}
                      {ev.lot.serialNumber ? ` · Seri: ${ev.lot.serialNumber}` : ""}
                      {ev.lot.certificateCode ? ` · HĐ: ${ev.lot.certificateCode}` : ""}
                      {ev.lot.storeName ? ` · ${ev.lot.storeName}` : ""}
                    </p>
                    {ev.lot.invoiceNote && (
                      <p className="text-[10.5px] text-slate-400 dark:text-slate-500 mt-0.5">
                        {ev.lot.invoiceNote}
                      </p>
                    )}
                  </td>
                  <td className="py-3 px-3 tabular-nums whitespace-nowrap text-slate-600 dark:text-slate-300">
                    {formatDateVN(ev.lot.purchaseDate)}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap">
                    <span className="font-extrabold text-slate-900 dark:text-white block">
                      {formatChiWeight(ev.lot.remainingChi, isPrivacyMode)}
                    </span>
                    {ev.lot.remainingChi < ev.lot.quantityChi && (
                      <span className="text-[10px] text-slate-400">
                        Gốc {ev.lot.quantityChi} chỉ
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap text-slate-700 dark:text-slate-200">
                    {formatShortVNDMasked(ev.lot.unitBuyPricePerChi, isPrivacyMode)}
                    {ev.lot.makingFee > 0 && (
                      <span className="block text-[10px] text-slate-400">
                        +công {formatShortVNDMasked(ev.lot.makingFee, isPrivacyMode)}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right font-extrabold text-slate-900 dark:text-white tabular-nums whitespace-nowrap">
                    {formatVNDMasked(ev.liquidationValueBid, isPrivacyMode)}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap">
                    <span
                      className={`font-extrabold block ${
                        ev.unrealizedPnl >= 0
                          ? "text-emerald-700 dark:text-emerald-400"
                          : "text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {ev.unrealizedPnl >= 0 ? "+" : ""}
                      {formatShortVNDMasked(ev.unrealizedPnl, isPrivacyMode)}
                    </span>
                    <span
                      className={`text-[10px] font-bold ${
                        ev.unrealizedPnl >= 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {ev.unrealizedPnlPct >= 0 ? "+" : ""}
                      {ev.unrealizedPnlPct}%
                    </span>
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap text-slate-600 dark:text-slate-300">
                    {GOLD_STORAGE_LABELS[ev.lot.storageLocation]}
                  </td>
                  <td className="py-3 px-3 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onEditLot(ev.lot)}
                        title="Chỉnh sửa lô vàng & số seri"
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        <Pencil className="w-3 h-3" />
                        <span>Sửa</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onSellLot(ev.lot)}
                        className="px-2 py-1 rounded-md text-[11px] font-bold bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 hover:bg-amber-100 cursor-pointer"
                      >
                        Bán
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteLot(ev.lot.id)}
                        title="Xóa lô vàng"
                        className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredEvaluations.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500 dark:text-slate-400">
                    Không tìm thấy lô vàng nào phù hợp với bộ lọc hiện tại.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Realized Sales Ledger */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
            Lịch Sử Chốt Lời / Thanh Khoản Đã Thực Hiện ({goldPortfolio.sales.length})
          </h3>
          <span className="text-xs font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
            Tổng lãi đã chốt: {formatShortVNDMasked(metrics.realizedPnl, isPrivacyMode)}
          </span>
        </div>

        {goldPortfolio.sales.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400 py-3">
            Chưa có giao dịch bán vàng nào. Khi bán theo FIFO hoặc theo lô cụ thể, lãi thực nhận sẽ được hạch toán tự động tại đây.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs tabular-nums">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase text-slate-500">
                  <th className="py-2 pr-3">Ngày bán</th>
                  <th className="py-2 px-3">Loại vàng</th>
                  <th className="py-2 px-3 text-right">Số chỉ</th>
                  <th className="py-2 px-3 text-right">Giá bán / chỉ</th>
                  <th className="py-2 px-3 text-right">Tiền thu về</th>
                  <th className="py-2 px-3 text-right">Lãi/Lỗ thực nhận</th>
                  <th className="py-2 pl-3">Mục đích</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {goldPortfolio.sales.map((s) => (
                  <tr key={s.id}>
                    <td className="py-2.5 pr-3">{formatDateVN(s.saleDate)}</td>
                    <td className="py-2.5 px-3 font-bold">
                      {GOLD_CATEGORY_META[s.category].shortLabel}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold">{s.totalSoldChi} chỉ</td>
                    <td className="py-2.5 px-3 text-right">
                      {formatShortVNDMasked(s.unitSellPricePerChi, isPrivacyMode)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-extrabold">
                      {formatVNDMasked(s.totalProceeds, isPrivacyMode)}
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right font-extrabold ${
                        s.realizedPnl >= 0
                          ? "text-emerald-700 dark:text-emerald-400"
                          : "text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {s.realizedPnl >= 0 ? "+" : ""}
                      {formatVNDMasked(s.realizedPnl, isPrivacyMode)}
                    </td>
                    <td className="py-2.5 pl-3 text-slate-600 dark:text-slate-300">
                      {SALE_PURPOSE_LABELS[s.purpose]}
                      {s.note ? ` · ${s.note}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
