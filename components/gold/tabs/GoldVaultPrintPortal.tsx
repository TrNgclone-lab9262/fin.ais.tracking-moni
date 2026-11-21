"use client";

import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { GoldPortfolioState } from "@/types/finance";
import {
  GOLD_CATEGORY_META,
  GOLD_STORAGE_LABELS,
  GoldPortfolioMetrics,
  chiToGrams,
  formatChiWeight,
  formatLuongWeight,
} from "@/lib/goldEngine";
import { formatDateVN, formatVNDMasked } from "@/lib/formatters";
import { SALE_PURPOSE_LABELS } from "./goldConstants";

interface GoldVaultPrintPortalProps {
  portfolio: GoldPortfolioState;
  metrics: GoldPortfolioMetrics;
  isPrivacyMode: boolean;
  onDone: () => void;
}

export function GoldVaultPrintPortal({
  portfolio,
  metrics,
  isPrivacyMode,
  onDone,
}: GoldVaultPrintPortalProps) {
  useEffect(() => {
    document.body.classList.add("pdf-printing");
    const timer = window.setTimeout(() => {
      window.print();
    }, 180);

    const handleAfterPrint = () => {
      document.body.classList.remove("pdf-printing");
      onDone();
    };
    window.addEventListener("afterprint", handleAfterPrint);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("afterprint", handleAfterPrint);
      document.body.classList.remove("pdf-printing");
    };
  }, [onDone]);

  const printDate = new Date().toLocaleDateString("vi-VN");

  return createPortal(
    <div className="pdf-print-portal fixed inset-0 z-[9999] bg-white text-slate-900 overflow-auto p-6">
      <div className="pdf-no-print mb-4 flex items-center justify-between p-3 rounded-lg bg-slate-100 border border-slate-300">
        <span className="text-xs font-bold text-slate-700">
          Đang chuẩn bị Hồ sơ Kiểm kê Kho Vàng & Két Chứng từ Seri... Chọn &ldquo;Lưu dưới dạng PDF&rdquo; trong hộp thoại in.
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3 py-1.5 rounded bg-amber-600 text-white text-xs font-bold cursor-pointer"
          >
            In / Lưu PDF lại
          </button>
          <button
            type="button"
            onClick={onDone}
            className="px-3 py-1.5 rounded bg-slate-800 text-white text-xs font-bold cursor-pointer"
          >
            Đóng bản xem trước
          </button>
        </div>
      </div>

      <div className="max-w-[900px] mx-auto space-y-5 text-slate-900">
        {/* Header */}
        <div className="border-b-2 border-slate-900 pb-3 flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">
              GOLD VAULT · HỒ SƠ KIỂM KÊ KHO TÍCH SẢN VÀNG & CHỨNG TỪ SERI
            </p>
            <h1 className="text-xl font-black text-slate-950 mt-0.5">
              Báo Cáo Định Giá Thu Mua Thực (Bid) & Sổ Chứng Từ Lô Vàng
            </h1>
            <p className="text-xs text-slate-600 mt-1 tabular-nums">
              Khối lượng nắm giữ: <strong>{formatChiWeight(metrics.totalRemainingChi, isPrivacyMode)}</strong> (
              {formatLuongWeight(metrics.totalRemainingChi, isPrivacyMode)} ·{" "}
              {isPrivacyMode ? "••• g" : `${chiToGrams(metrics.totalRemainingChi)} g`}) · XAU/USD{" "}
              {portfolio.macro.worldXauUsdPerOz.toLocaleString("en-US")} $/oz · USD/VND{" "}
              {portfolio.macro.usdVndRate.toLocaleString("vi-VN")}
            </p>
          </div>
          <div className="text-right text-xs tabular-nums shrink-0">
            <p className="font-bold text-slate-700">Ngày kiểm kê: {printDate}</p>
            <p className="text-base font-black text-amber-800 mt-0.5">
              {formatVNDMasked(metrics.totalLiquidationValueBid, isPrivacyMode)}
            </p>
            <p className="text-[10px] text-slate-500">
              Giá vốn: {formatVNDMasked(metrics.totalCostBasis, isPrivacyMode)}
            </p>
          </div>
        </div>

        {/* Summary Strip */}
        <div className="grid grid-cols-4 gap-2.5 text-xs tabular-nums">
          <div className="p-2.5 rounded border border-slate-300">
            <span className="text-[10px] text-slate-500 block">Giá trị thu mua (Bid)</span>
            <strong className="text-sm text-slate-950">
              {formatVNDMasked(metrics.totalLiquidationValueBid, isPrivacyMode)}
            </strong>
          </div>
          <div className="p-2.5 rounded border border-slate-300">
            <span className="text-[10px] text-slate-500 block">Tổng giá vốn còn lại</span>
            <strong className="text-sm text-slate-950">
              {formatVNDMasked(metrics.totalCostBasis, isPrivacyMode)}
            </strong>
          </div>
          <div className="p-2.5 rounded border border-slate-300">
            <span className="text-[10px] text-slate-500 block">Lãi/Lỗ tạm tính (Bid)</span>
            <strong className={`text-sm ${metrics.unrealizedPnl >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
              {metrics.unrealizedPnl >= 0 ? "+" : ""}
              {formatVNDMasked(metrics.unrealizedPnl, isPrivacyMode)} ({metrics.unrealizedPnlPct}%)
            </strong>
          </div>
          <div className="p-2.5 rounded border border-slate-300">
            <span className="text-[10px] text-slate-500 block">Giá vốn BQ / chỉ</span>
            <strong className="text-sm text-slate-950">
              {formatVNDMasked(metrics.weightedAvgCostPerChi, isPrivacyMode)}
            </strong>
          </div>
        </div>

        {/* Holding Lots Inventory Table */}
        <div>
          <p className="text-xs font-black uppercase text-slate-900 mb-1.5">
            1. Danh mục Lô Vàng Đang Nắm Giữ & Chứng Từ Seri ({metrics.lotEvaluations.length} lô)
          </p>
          <table className="w-full text-left border-collapse text-[10px]">
            <thead>
              <tr className="border-y-2 border-slate-800 bg-slate-100">
                <th className="py-1.5 px-2">STT</th>
                <th className="py-1.5 px-2">Thương hiệu / Loại</th>
                <th className="py-1.5 px-2">Seri / Hóa đơn / Cửa hàng</th>
                <th className="py-1.5 px-2">Ngày mua</th>
                <th className="py-1.5 px-2 text-right">Còn (chỉ)</th>
                <th className="py-1.5 px-2 text-right">Giá vốn/chỉ</th>
                <th className="py-1.5 px-2 text-right">Giá trị Bid</th>
                <th className="py-1.5 px-2 text-right">Lãi/Lỗ</th>
                <th className="py-1.5 px-2">Nơi cất</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 tabular-nums">
              {metrics.lotEvaluations.map((ev, idx) => (
                <tr key={ev.lot.id}>
                  <td className="py-1.5 px-2">{idx + 1}</td>
                  <td className="py-1.5 px-2">
                    <p className="font-bold text-slate-900">{ev.lot.brand}</p>
                    <p className="text-[9px] text-slate-500">
                      {GOLD_CATEGORY_META[ev.lot.category].shortLabel}
                      {ev.lot.purityLabel ? ` · ${ev.lot.purityLabel}` : ""}
                    </p>
                  </td>
                  <td className="py-1.5 px-2 text-[9.5px] text-slate-600">
                    {ev.lot.serialNumber ? `Seri: ${ev.lot.serialNumber}` : "—"}
                    {ev.lot.certificateCode ? ` · HĐ: ${ev.lot.certificateCode}` : ""}
                    {ev.lot.storeName ? ` · ${ev.lot.storeName}` : ""}
                  </td>
                  <td className="py-1.5 px-2 whitespace-nowrap">{formatDateVN(ev.lot.purchaseDate)}</td>
                  <td className="py-1.5 px-2 text-right font-bold">{ev.lot.remainingChi}</td>
                  <td className="py-1.5 px-2 text-right">
                    {formatVNDMasked(ev.lot.unitBuyPricePerChi, isPrivacyMode)}
                  </td>
                  <td className="py-1.5 px-2 text-right font-bold">
                    {formatVNDMasked(ev.liquidationValueBid, isPrivacyMode)}
                  </td>
                  <td className={`py-1.5 px-2 text-right font-bold ${ev.unrealizedPnl >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                    {ev.unrealizedPnl >= 0 ? "+" : ""}
                    {ev.unrealizedPnlPct}%
                  </td>
                  <td className="py-1.5 px-2 whitespace-nowrap">
                    {GOLD_STORAGE_LABELS[ev.lot.storageLocation]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Realized Sales */}
        {portfolio.sales.length > 0 && (
          <div>
            <p className="text-xs font-black uppercase text-slate-900 mb-1.5">
              2. Lịch Sử Chốt Lời / Thanh Khoản Đã Thực Hiện ({portfolio.sales.length} giao dịch)
            </p>
            <table className="w-full text-left border-collapse text-[10px] tabular-nums">
              <thead>
                <tr className="border-y-2 border-slate-800 bg-slate-100">
                  <th className="py-1.5 px-2">Ngày bán</th>
                  <th className="py-1.5 px-2">Loại vàng</th>
                  <th className="py-1.5 px-2 text-right">Số chỉ</th>
                  <th className="py-1.5 px-2 text-right">Giá bán/chỉ</th>
                  <th className="py-1.5 px-2 text-right">Thu về</th>
                  <th className="py-1.5 px-2 text-right">Lãi thực nhận</th>
                  <th className="py-1.5 px-2">Mục đích</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {portfolio.sales.map((s) => (
                  <tr key={s.id}>
                    <td className="py-1.5 px-2">{formatDateVN(s.saleDate)}</td>
                    <td className="py-1.5 px-2 font-bold">
                      {GOLD_CATEGORY_META[s.category].shortLabel}
                    </td>
                    <td className="py-1.5 px-2 text-right">{s.totalSoldChi}</td>
                    <td className="py-1.5 px-2 text-right">
                      {formatVNDMasked(s.unitSellPricePerChi, isPrivacyMode)}
                    </td>
                    <td className="py-1.5 px-2 text-right font-bold">
                      {formatVNDMasked(s.totalProceeds, isPrivacyMode)}
                    </td>
                    <td className={`py-1.5 px-2 text-right font-bold ${s.realizedPnl >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                      {s.realizedPnl >= 0 ? "+" : ""}
                      {formatVNDMasked(s.realizedPnl, isPrivacyMode)}
                    </td>
                    <td className="py-1.5 px-2">{SALE_PURPOSE_LABELS[s.purpose]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
