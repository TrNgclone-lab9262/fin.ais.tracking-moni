"use client";

import React, { useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  FileScan,
  Loader2,
  Plus,
  Upload,
} from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { formatVNDMasked } from "@/lib/formatters";
import { calculateScenarioBoq } from "@/lib/interiorBoqEngine";
import { scanBoqQuoteWithGemini, ScannedBoqQuoteResult } from "@/lib/interiorAiService";
import { FamilyMember, InteriorBoqPaymentStage } from "@/types/finance";

export function InteriorBoqAiAndPaymentPanel() {
  const {
    interiorStudio,
    accounts,
    isPrivacyMode,
    addInteriorExtraBoqItem,
    recordBoqPaymentToFinance,
  } = useFinance();

  const activeScenario = useMemo(
    () =>
      interiorStudio.scenarios.find((s) => s.id === interiorStudio.activeScenarioId) ||
      interiorStudio.scenarios[0],
    [interiorStudio]
  );

  const boqSummary = useMemo(
    () => (activeScenario ? calculateScenarioBoq(activeScenario) : null),
    [activeScenario]
  );

  // --- OCR Contractor Quote State ---
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [quote, setQuote] = useState<ScannedBoqQuoteResult | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<Set<number>>(new Set());
  const [importFeedback, setImportFeedback] = useState<string | null>(null);

  // --- Quick Settlement to FINANCE State ---
  const [showPayForm, setShowPayForm] = useState(false);
  const [payTargetKey, setPayTargetKey] = useState<string>("");
  const [payStage, setPayStage] = useState<InteriorBoqPaymentStage>("DEPOSIT");
  const [payAmount, setPayAmount] = useState<string>("");
  const [payAccountId, setPayAccountId] = useState<string>(
    () => accounts.find((a) => a.type === "BANK")?.id || accounts[0]?.id || "acc_husband_bidv"
  );
  const [payMemberId, setPayMemberId] = useState<FamilyMember>("HUSBAND");
  const [payDate, setPayDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [payNote, setPayNote] = useState<string>("");
  const [payFeedback, setPayFeedback] = useState<string | null>(null);

  if (!activeScenario || !boqSummary) return null;

  const settledPct =
    boqSummary.grandTotalWithContingency > 0
      ? Math.min(
          100,
          Math.round(
            (boqSummary.paidOrDepositedVnd / boqSummary.grandTotalWithContingency) * 100
          )
        )
      : 0;

  const selectableItems = [
    ...activeScenario.items.map((it) => ({
      key: `3D_ITEM::${it.id}`,
      origin: "3D_ITEM" as const,
      id: it.id,
      label: `[3D] ${it.name}`,
    })),
    ...activeScenario.extraBoqItems.map((ex) => ({
      key: `EXTRA_LINE::${ex.id}`,
      origin: "EXTRA_LINE" as const,
      id: ex.id,
      label: `[Hạng mục] ${ex.name}`,
    })),
  ];

  const handleScanQuote = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanLoading(true);
    setScanError(null);
    setImportFeedback(null);
    try {
      const existingItems = [
        ...activeScenario.items.map((it) => ({
          name: it.name,
          roomId: it.roomId || "living_kitchen",
          estimatedVnd: Math.round(it.unitPriceVnd),
        })),
        ...activeScenario.extraBoqItems.map((ex) => ({
          name: ex.name,
          roomId: ex.roomId || "living_kitchen",
          estimatedVnd: Math.round(ex.quantity * ex.unitPriceVnd),
        })),
      ].slice(0, 100);

      const res = await scanBoqQuoteWithGemini(file, {
        scenarioName: activeScenario.name,
        existingItems,
      });
      setQuote(res);
      setSelectedIdx(new Set(res.items.map((_, i) => i)));
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "Không thể quét báo giá nhà thầu.");
    } finally {
      setScanLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const toggleQuoteItem = (idx: number) => {
    setSelectedIdx((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleImportSelectedQuoteItems = () => {
    if (!quote) return;
    let imported = 0;
    quote.items.forEach((item, idx) => {
      if (!selectedIdx.has(idx)) return;
      addInteriorExtraBoqItem({
        name: item.name,
        boqGroup: item.boqGroup || "FINISHING_DECOR",
        source: "NEW_PURCHASE",
        roomId: item.roomId || "living_kitchen",
        unit: item.unit || "bộ",
        quantity: item.quantity > 0 ? item.quantity : 1,
        unitPriceVnd: Math.max(0, Math.round(item.unitPriceVnd)),
        procurementStatus: "QUOTED",
        vendorName: quote.vendorName || undefined,
        note: item.matchedExistingName
          ? `Đối chiếu với "${item.matchedExistingName}" (${item.varianceVnd >= 0 ? "+" : ""}${item.varianceVnd.toLocaleString("vi-VN")} đ)`
          : "Quét báo giá AI",
      });
      imported += 1;
    });
    setImportFeedback(`Đã nhập ${imported} hạng mục báo giá vào Phương án "${activeScenario.name}".`);
  };

  const handleRecordMilestonePayment = (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = Math.max(0, Number(payAmount.replace(/[^\d]/g, "")) || 0);
    if (numericAmount <= 0) return;

    const picked =
      selectableItems.find((s) => s.key === payTargetKey) || selectableItems[0];
    if (!picked) return;

    recordBoqPaymentToFinance({
      origin: picked.origin,
      itemId: picked.id,
      itemName: picked.label.replace(/^\[(3D|Hạng mục)\]\s*/, ""),
      amountVnd: numericAmount,
      accountId: payAccountId,
      memberId: payMemberId,
      date: payDate,
      stage: payStage,
      note: payNote.trim() || undefined,
    });

    setPayFeedback(
      `Đã ghi nhận thanh toán ${formatVNDMasked(numericAmount, isPrivacyMode)} vào sổ chi FINANCE và cập nhật tiến độ BOQ.`
    );
    setPayAmount("");
    setPayNote("");
    setShowPayForm(false);
  };

  const quoteVarianceVnd = quote
    ? quote.totalQuotedVnd - boqSummary.grandTotalWithContingency
    : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Panel 1: Tiến độ Quyết toán Nội thất <-> FINANCE */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Quyết toán Nội thất ↔ FINANCE
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ghi nhận cọc / giao hàng / nghiệm thu trực tiếp sang sổ chi tiêu gia đình.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowPayForm((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            {showPayForm ? "Đóng form" : "Ghi thanh toán"}
          </button>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs tabular-nums">
            <span className="text-slate-600 dark:text-slate-300">
              Đã thanh toán:{" "}
              <strong className="text-emerald-600 dark:text-emerald-400">
                {formatVNDMasked(boqSummary.paidOrDepositedVnd, isPrivacyMode)}
              </strong>{" "}
              ({settledPct}%)
            </span>
            <span className="text-slate-500 dark:text-slate-400">
              Còn phải chi:{" "}
              <strong className="text-slate-900 dark:text-slate-100">
                {formatVNDMasked(boqSummary.remainingToPayVnd, isPrivacyMode)}
              </strong>
            </span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-300"
              style={{ width: `${settledPct}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
            Tổng dự toán PA (gồm dự phòng):{" "}
            {formatVNDMasked(boqSummary.grandTotalWithContingency, isPrivacyMode)}
          </p>
        </div>

        {payFeedback && (
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{payFeedback}</span>
          </div>
        )}

        {showPayForm && (
          <form
            onSubmit={handleRecordMilestonePayment}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3.5 space-y-2.5"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Hạng mục quyết toán
                </label>
                <select
                  value={payTargetKey || selectableItems[0]?.key || ""}
                  onChange={(e) => setPayTargetKey(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                >
                  {selectableItems.map((it) => (
                    <option key={it.key} value={it.key}>
                      {it.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Đợt thanh toán
                </label>
                <select
                  value={payStage}
                  onChange={(e) => setPayStage(e.target.value as InteriorBoqPaymentStage)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                >
                  <option value="DEPOSIT">Đặt cọc (Deposit)</option>
                  <option value="DELIVERY">Giao hàng / Lắp đặt</option>
                  <option value="ACCEPTANCE">Nghiệm thu bàn giao</option>
                  <option value="OTHER">Thanh toán khác</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Số tiền (VNĐ)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="15000000"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 tabular-nums"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Tài khoản chi (FINANCE)
                </label>
                <select
                  value={payAccountId}
                  onChange={(e) => setPayAccountId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Người thanh toán
                </label>
                <select
                  value={payMemberId}
                  onChange={(e) => setPayMemberId(e.target.value as FamilyMember)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                >
                  <option value="HUSBAND">Anh Chuột</option>
                  <option value="WIFE">Bé Mèo</option>
                  <option value="SHARED">Quỹ Chung</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Ngày chi
                </label>
                <input
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 tabular-nums"
                />
              </div>
            </div>
            <input
              type="text"
              value={payNote}
              onChange={(e) => setPayNote(e.target.value)}
              placeholder="Ghi chú đợt thanh toán (VD: Cọc 30% xưởng gỗ An Cường)..."
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100"
            />
            <div className="flex justify-end">
              <button
                type="submit"
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
              >
                Xác nhận ghi vào FINANCE &amp; BOQ
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Panel 2: AI OCR Quét Báo giá Nhà thầu */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <FileScan className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Quét Báo giá Nhà thầu (AI OCR)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Bóc tách tự động từng hạng mục báo giá gỗ/điện máy &amp; so sánh chênh lệch BOQ.
              </p>
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => void handleScanQuote(e)}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={scanLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50 shrink-0 transition-colors cursor-pointer"
          >
            {scanLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5" />
            )}
            Tải báo giá
          </button>
        </div>

        {scanError && (
          <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 px-3 py-2 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{scanError}</span>
          </div>
        )}

        {importFeedback && (
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{importFeedback}</span>
          </div>
        )}

        {quote ? (
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs">
              <div>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {quote.vendorName || "Báo giá nhà thầu"}
                </span>
                <span className="ml-2 text-slate-500 dark:text-slate-400 tabular-nums">
                  Tổng: {formatVNDMasked(quote.totalQuotedVnd, isPrivacyMode)}
                </span>
              </div>
              <span
                className={`text-[11px] font-semibold tabular-nums ${
                  quoteVarianceVnd > 0
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-emerald-600 dark:text-emerald-400"
                }`}
              >
                {quoteVarianceVnd > 0 ? "+" : ""}
                {formatVNDMasked(quoteVarianceVnd, isPrivacyMode)} so với PA
              </span>
            </div>

            <div className="max-h-44 overflow-y-auto space-y-1.5 pr-0.5">
              {quote.items.map((item, idx) => (
                <label
                  key={idx}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-200/80 dark:border-slate-800 px-2.5 py-1.5 text-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <input
                      type="checkbox"
                      checked={selectedIdx.has(idx)}
                      onChange={() => toggleQuoteItem(idx)}
                      className="rounded border-slate-300 text-amber-600"
                    />
                    <span className="truncate font-medium text-slate-800 dark:text-slate-200">
                      {item.name}
                    </span>
                    <span className="text-[11px] text-slate-400 shrink-0 tabular-nums">
                      ({item.quantity} {item.unit})
                    </span>
                  </div>
                  <span className="font-semibold text-slate-900 dark:text-slate-100 shrink-0 tabular-nums">
                    {formatVNDMasked(item.totalVnd, isPrivacyMode)}
                  </span>
                </label>
              ))}
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleImportSelectedQuoteItems}
                disabled={selectedIdx.size === 0}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50 cursor-pointer"
              >
                Nhập {selectedIdx.size} hạng mục vào BOQ
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 px-4 py-5 text-center text-xs text-slate-500 dark:text-slate-400">
            Tải ảnh chụp bảng báo giá từ xưởng mộc / điện máy (JPG, PNG, PDF) để tự động trích xuất đơn giá và so sánh với dự toán căn A.12A.07.
          </div>
        )}
      </div>
    </div>
  );
}
