"use client";

import React, { useMemo, useState } from "react";
import {
  CheckCircle2,
  Download,
  FileText,
  GitCompareArrows,
  History,
  Lock,
  Plus,
  Trash2,
  Wallet,
  X,
  SlidersHorizontal,
} from "lucide-react";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { InteriorBoqAiAndPaymentPanel } from "@/components/interior/InteriorBoqAiAndPaymentPanel";
import { useFinance } from "@/context/FinanceContext";
import {
  FamilyMember,
  InteriorBoqGroup,
  InteriorBoqPaymentStage,
  InteriorDesignScenario,
  InteriorExecutionPhase,
  InteriorProcurementStatus,
} from "@/types/finance";
import {
  BOQ_GROUP_META,
  BOQ_PAYMENT_STAGE_META,
  BoqUnifiedRow,
  EXECUTION_PHASE_META,
  ScenarioBoqSummary,
  compareInteriorScenarios,
  exportBoqToCsv,
} from "@/lib/interiorBoqEngine";
import { formatChiWeight } from "@/lib/goldEngine";
import { formatShortVNDMasked, formatVNDMasked } from "@/lib/formatters";

const PROCUREMENT_STATUS_META: Record<
  InteriorProcurementStatus,
  { label: string; colorClass: string }
> = {
  PLANNED: { label: "Dự kiến", colorClass: "text-slate-600 dark:text-slate-300" },
  QUOTED: { label: "Đã báo giá", colorClass: "text-amber-700 dark:text-amber-300" },
  DEPOSITED: { label: "Đã đặt cọc", colorClass: "text-blue-700 dark:text-blue-300" },
  INSTALLED: { label: "Đã nghiệm thu", colorClass: "text-emerald-700 dark:text-emerald-300" },
};

interface BoqProcurementTabProps {
  activeScenario: InteriorDesignScenario;
  allScenarioBoqs: { scenario: InteriorDesignScenario; boq: ScenarioBoqSummary }[];
  activeBoq: ScenarioBoqSummary;
  onRequestPrintSpecSheet: () => void;
}

export function BoqProcurementTab({
  activeScenario,
  allScenarioBoqs,
  activeBoq,
  onRequestPrintSpecSheet,
}: BoqProcurementTabProps) {
  const {
    setActiveInteriorScenario,
    updateInteriorScenarioMeta,
    updateInteriorFurnitureItem,
    addInteriorExtraBoqItem,
    updateInteriorExtraBoqItem,
    deleteInteriorExtraBoqItem,
    updateBoqItemStatus,
    recordBoqPaymentToFinance,
    deleteBoqPaymentRecord,
    accounts,
    goldPortfolio,
    isPrivacyMode,
  } = useFinance();

  const isScenarioLocked = Boolean(activeScenario.isLockedBaseline);
  const [boqGroupFilter, setBoqGroupFilter] = useState<InteriorBoqGroup | "ALL">("ALL");
  const [phaseFilter, setPhaseFilter] = useState<InteriorExecutionPhase | "ALL">("ALL");
  const [expandedVendorRowKey, setExpandedVendorRowKey] = useState<string | null>(null);
  const [expandedPaymentsRowKey, setExpandedPaymentsRowKey] = useState<string | null>(null);
  const [pendingDeletePayment, setPendingDeletePayment] = useState<{
    origin: "3D_ITEM" | "EXTRA_LINE";
    itemId: string;
    itemName: string;
    paymentId: string;
    amountVnd: number;
    stageLabel: string;
    hasLinkedTx: boolean;
  } | null>(null);
  const [deleteLinkedWalletTx, setDeleteLinkedWalletTx] = useState<boolean>(true);
  const [isAddExtraModalOpen, setIsAddExtraModalOpen] = useState<boolean>(false);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState<boolean>(false);
  const [compareTargetId, setCompareTargetId] = useState<string>(() => {
    const other = allScenarioBoqs.find((x) => x.scenario.id !== activeScenario.id);
    return other ? other.scenario.id : activeScenario.id;
  });

  // Add extra BOQ modal fields
  const [extraName, setExtraName] = useState("");
  const [extraGroup, setExtraGroup] = useState<InteriorBoqGroup>("FINISHING_DECOR");
  const [extraUnit, setExtraUnit] = useState("gói");
  const [extraQty, setExtraQty] = useState("1");
  const [extraPrice, setExtraPrice] = useState("2500000");
  const [extraVendor, setExtraVendor] = useState("");
  const [extraLeadDays, setExtraLeadDays] = useState("");
  const [extraWarranty, setExtraWarranty] = useState("");
  const [extraNote, setExtraNote] = useState("");

  // Multi-tranche Payment modal fields
  const [payRow, setPayRow] = useState<BoqUnifiedRow | null>(null);
  const [payStage, setPayStage] = useState<InteriorBoqPaymentStage>("DEPOSIT");
  const [payAmount, setPayAmount] = useState("");
  const [payAccountId, setPayAccountId] = useState(
    () => accounts.find((a) => a.type !== "CREDIT_CARD")?.id || accounts[0]?.id || ""
  );
  const [payMemberId, setPayMemberId] = useState<FamilyMember>("HUSBAND");
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [payNote, setPayNote] = useState("");
  const [payNotice, setPayNotice] = useState<string | null>(null);

  const nhanBidPerChi = goldPortfolio.quotes.NHAN_9999?.buyPricePerChi || 9_050_000;

  const filteredRows = useMemo(
    () =>
      activeBoq.rows.filter((r) => {
        const groupOk = boqGroupFilter === "ALL" || r.boqGroup === boqGroupFilter;
        const phaseOk = phaseFilter === "ALL" || r.executionPhase === phaseFilter;
        return groupOk && phaseOk;
      }),
    [activeBoq.rows, boqGroupFilter, phaseFilter]
  );

  const compareTargetScenario = useMemo(() => {
    const found = allScenarioBoqs.find((x) => x.scenario.id === compareTargetId)?.scenario;
    if (found && found.id !== activeScenario.id) return found;
    return allScenarioBoqs.find((x) => x.scenario.id !== activeScenario.id)?.scenario || null;
  }, [allScenarioBoqs, compareTargetId, activeScenario.id]);

  const diffSummary = useMemo(() => {
    if (!isCompareModalOpen || !compareTargetScenario) return null;
    return compareInteriorScenarios(activeScenario, compareTargetScenario);
  }, [isCompareModalOpen, activeScenario, compareTargetScenario]);

  const handleOpenPayModal = (row: BoqUnifiedRow) => {
    setPayRow(row);
    const remaining = Math.max(0, row.remainingAmountVnd);
    const defaultStage: InteriorBoqPaymentStage =
      row.payments.length === 0
        ? "DEPOSIT"
        : row.payments.length === 1
          ? "DELIVERY"
          : "ACCEPTANCE";
    setPayStage(defaultStage);
    const suggested =
      row.payments.length === 0
        ? Math.round(row.totalPriceVnd * 0.4)
        : remaining > 0
          ? remaining
          : row.totalPriceVnd;
    setPayAmount(String(suggested));
    setPayAccountId(accounts.find((a) => a.type !== "CREDIT_CARD")?.id || accounts[0]?.id || "");
    setPayNote("");
  };

  const handleConfirmBoqPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payRow || !payAccountId) return;
    const amountNum = Number(payAmount.replace(/[^0-9]/g, ""));
    if (!Number.isFinite(amountNum) || amountNum <= 0) return;

    recordBoqPaymentToFinance({
      origin: payRow.origin,
      itemId: payRow.id,
      itemName: payRow.name,
      amountVnd: amountNum,
      accountId: payAccountId,
      memberId: payMemberId,
      date: payDate,
      stage: payStage,
      note:
        payNote.trim() ||
        `${BOQ_PAYMENT_STAGE_META[payStage].label} · SKYONE A.12A.07 (${activeScenario.shortLabel})`,
    });

    setPayRow(null);
    setPayNotice(
      `Đã ghi nhận ${BOQ_PAYMENT_STAGE_META[payStage].label} ${formatShortVNDMasked(amountNum, isPrivacyMode)} cho "${payRow.name}" vào Sổ Thu Chi.`
    );
    window.setTimeout(() => setPayNotice(null), 4500);
  };

  const handleCreateExtraBoq = (e: React.FormEvent) => {
    e.preventDefault();
    const qty = Math.max(1, Number(extraQty) || 1);
    const unitPrice = Math.max(0, Number(extraPrice.replace(/[^0-9]/g, "")) || 0);
    if (!extraName.trim()) return;

    addInteriorExtraBoqItem({
      name: extraName.trim(),
      roomId: "room_living_dining",
      boqGroup: extraGroup,
      source: extraGroup === "DEVELOPER_INCLUDED" ? "DEVELOPER_INCLUDED" : "NEW_PURCHASE",
      unit: extraUnit.trim() || "gói",
      quantity: qty,
      unitPriceVnd: unitPrice,
      procurementStatus: "PLANNED",
      vendorName: extraVendor.trim() || undefined,
      leadTimeDays: extraLeadDays ? Math.max(0, Number(extraLeadDays)) : undefined,
      warrantyMonths: extraWarranty ? Math.max(0, Number(extraWarranty)) : undefined,
      note: extraNote.trim() || undefined,
    });
    setExtraName("");
    setExtraVendor("");
    setExtraLeadDays("");
    setExtraWarranty("");
    setExtraNote("");
    setIsAddExtraModalOpen(false);
  };

  const handleRowUnitPriceChange = (row: BoqUnifiedRow, rawValue: string) => {
    const val = Math.max(0, Number(rawValue.replace(/[^0-9]/g, "")) || 0);
    if (row.origin === "3D_ITEM") {
      updateInteriorFurnitureItem(row.id, { unitPriceVnd: val });
    } else {
      updateInteriorExtraBoqItem(row.id, { unitPriceVnd: val });
    }
  };

  const handleRowVendorPatch = (
    row: BoqUnifiedRow,
    patch: { vendorName?: string; leadTimeDays?: number; warrantyMonths?: number }
  ) => {
    if (row.origin === "3D_ITEM") {
      updateInteriorFurnitureItem(row.id, patch);
    } else {
      updateInteriorExtraBoqItem(row.id, patch);
    }
  };

  const handleToggleRowPhase = (row: BoqUnifiedRow) => {
    if (row.source === "DEVELOPER_INCLUDED") return;
    const nextPhase: InteriorExecutionPhase =
      row.executionPhase === "PHASE_2_UPGRADE" ? "PHASE_1_MOVE_IN" : "PHASE_2_UPGRADE";
    if (row.origin === "3D_ITEM") {
      updateInteriorFurnitureItem(row.id, { executionPhase: nextPhase });
    } else {
      updateInteriorExtraBoqItem(row.id, { executionPhase: nextPhase });
    }
  };

  return (
    <div className="space-y-5">
      {payNotice && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{payNotice}</span>
        </div>
      )}

      {isScenarioLocked && (
        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs font-bold flex items-center gap-2">
          <Lock className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>
            Phương án &ldquo;{activeScenario.shortLabel}&rdquo; đã chốt thi công — Đơn giá và danh mục BOQ đang ở chế độ khóa (vẫn cho phép ghi đợt thanh toán &amp; cập nhật trạng thái mua sắm).
          </span>
        </div>
      )}

      {/* AI OCR Báo giá Nhà thầu & Quyết toán Nội thất <-> FINANCE */}
      <InteriorBoqAiAndPaymentPanel />

      {/* Scenario Comparison Strip */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {allScenarioBoqs.map(({ scenario: sc, boq }) => {
          const isActive = sc.id === activeScenario.id;
          return (
            <div
              key={sc.id}
              onClick={() => setActiveInteriorScenario(sc.id)}
              className={`p-4 rounded-xl border transition-colors cursor-pointer ${
                isActive
                  ? "bg-teal-50/60 dark:bg-teal-950/30 border-teal-500"
                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-teal-300"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-black text-slate-900 dark:text-white">{sc.name}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                    Dự phòng {sc.contingencyPercent}% · Đã chi{" "}
                    {formatShortVNDMasked(boq.paidOrDepositedVnd, isPrivacyMode)} · Còn{" "}
                    {formatShortVNDMasked(boq.remainingToPayVnd, isPrivacyMode)}
                  </p>
                </div>
                <p className="text-lg font-black text-teal-700 dark:text-teal-300 tabular-nums">
                  {formatShortVNDMasked(boq.grandTotalWithContingency, isPrivacyMode)}
                </p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-200/70 dark:border-slate-800 grid grid-cols-3 gap-2 text-[11px] tabular-nums">
                <div>
                  <span className="text-slate-500 block">Nội thất gỗ</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {formatShortVNDMasked(boq.woodFurnitureTotal, isPrivacyMode)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Điện máy</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {formatShortVNDMasked(boq.appliancesTotal, isPrivacyMode)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Biên vs 150tr</span>
                  <span
                    className={`font-bold ${
                      boq.varianceFromMaxVnd >= 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-rose-600"
                    }`}
                  >
                    {boq.varianceFromMaxVnd >= 0 ? "Dư " : "Vượt "}
                    {formatShortVNDMasked(Math.abs(boq.varianceFromMaxVnd), isPrivacyMode)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Value Engineering Split Strip (Phase 1 Move-In vs Phase 2 Upgrade) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Value Engineering · GĐ 1 Nhận nhà ở ngay
          </p>
          <p className="text-lg font-black text-teal-700 dark:text-teal-300 tabular-nums mt-0.5">
            {formatShortVNDMasked(activeBoq.phase1GrandTotalWithContingency, isPrivacyMode)}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
            Đã gồm {activeScenario.contingencyPercent}% dự phòng · ưu tiên ở ngay Q3/2027
          </p>
        </div>

        <div className="md:border-l md:border-slate-200 dark:md:border-slate-800 md:pl-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            GĐ 2 Hoãn nâng cấp sau ({activeBoq.phase2ItemCount} hạng mục)
          </p>
          <p className="text-lg font-black text-amber-700 dark:text-amber-300 tabular-nums mt-0.5">
            {activeBoq.phase2DeferredTotal > 0
              ? `Tiết kiệm ngay ${formatShortVNDMasked(activeBoq.phase2DeferredTotal, isPrivacyMode)}`
              : "Chưa hoãn hạng mục nào"}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
            {activeBoq.phase2DeferredTotal > 0
              ? `Giữ lại ~${formatChiWeight(activeBoq.phase2DeferredTotal / nhanBidPerChi, isPrivacyMode)} vàng không phải bán sớm`
              : "Chạm nút GĐ 1 ở từng dòng bên dưới để chuyển sang GĐ 2"}
          </p>
        </div>

        <div className="flex flex-wrap items-center md:justify-end gap-1.5">
          {(
            [
              { id: "ALL", label: "Cả 2 GĐ" },
              { id: "PHASE_1_MOVE_IN", label: "Chỉ GĐ 1" },
              { id: "PHASE_2_UPGRADE", label: `Chỉ GĐ 2 (${activeBoq.phase2ItemCount})` },
            ] as { id: InteriorExecutionPhase | "ALL"; label: string }[]
          ).map((pf) => (
            <button
              key={pf.id}
              type="button"
              onClick={() => setPhaseFilter(pf.id)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border whitespace-nowrap transition-colors cursor-pointer ${
                phaseFilter === pf.id
                  ? "bg-teal-600 border-teal-600 text-white"
                  : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
              }`}
            >
              {pf.label}
            </button>
          ))}
        </div>
      </div>

      {/* Action Bar & BOQ Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              ["ALL", "WOOD_FURNITURE", "APPLIANCES", "FINISHING_DECOR", "DEVELOPER_INCLUDED"] as const
            ).map((grp) => (
              <button
                key={grp}
                type="button"
                onClick={() => setBoqGroupFilter(grp)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  boqGroupFilter === grp
                    ? "bg-slate-900 dark:bg-teal-500 text-white dark:text-slate-950"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                }`}
              >
                {grp === "ALL" ? `Tất cả (${activeBoq.rows.length})` : BOQ_GROUP_META[grp].shortLabel}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {allScenarioBoqs.length >= 2 && (
              <button
                type="button"
                onClick={() => setIsCompareModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-teal-300 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-200 hover:bg-teal-100 dark:hover:bg-teal-900/50 cursor-pointer"
              >
                <GitCompareArrows className="w-3.5 h-3.5" />
                <span>So sánh PA</span>
              </button>
            )}
            <button
              type="button"
              disabled={isScenarioLocked}
              onClick={() => setIsAddExtraModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-teal-600 hover:bg-teal-700 disabled:opacity-45 text-white cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm hạng mục BOQ</span>
            </button>
            <button
              type="button"
              onClick={() => exportBoqToCsv(activeScenario, activeBoq)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Xuất CSV</span>
            </button>
            <button
              type="button"
              onClick={onRequestPrintSpecSheet}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              <span>Xuất Hồ sơ PDF</span>
            </button>
          </div>
        </div>

        {/* BOQ Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-2.5 pr-3">Hạng mục & NCC</th>
                <th className="py-2.5 px-3">Quy cách</th>
                <th className="py-2.5 px-3 text-right">Đơn giá</th>
                <th className="py-2.5 px-3 text-right">Thành tiền</th>
                <th className="py-2.5 px-3 text-right">Đã chi / Còn</th>
                <th className="py-2.5 px-3">Trạng thái</th>
                <th className="py-2.5 pl-3 text-right">Thu Chi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
              {filteredRows.map((row) => {
                const rowKey = `${row.origin}_${row.id}`;
                const isVendorOpen = expandedVendorRowKey === rowKey;
                const isPaymentsOpen = expandedPaymentsRowKey === rowKey;
                return (
                  <React.Fragment key={rowKey}>
                    <tr className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="py-3 pr-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <p className="font-bold text-slate-900 dark:text-white">{row.name}</p>
                              {row.source !== "DEVELOPER_INCLUDED" && (
                                <button
                                  type="button"
                                  disabled={isScenarioLocked}
                                  onClick={() => handleToggleRowPhase(row)}
                                  title="Chuyển giữa Giai đoạn 1 (Nhận nhà) và Giai đoạn 2 (Hoãn nâng cấp)"
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold border whitespace-nowrap disabled:opacity-45 cursor-pointer transition-colors ${
                                    row.executionPhase === "PHASE_2_UPGRADE"
                                      ? "bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300"
                                      : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-teal-400"
                                  }`}
                                >
                                  {EXECUTION_PHASE_META[row.executionPhase].shortLabel}
                                </button>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              {BOQ_GROUP_META[row.boqGroup].shortLabel}
                              {row.vendorName ? ` · NCC: ${row.vendorName}` : ""}
                              {row.leadTimeDays ? ` · ${row.leadTimeDays} ngày` : ""}
                              {row.warrantyMonths ? ` · BH ${row.warrantyMonths}T` : ""}
                              {!row.vendorName && row.note ? ` · ${row.note}` : ""}
                            </p>
                          </div>
                          {row.source !== "DEVELOPER_INCLUDED" && (
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedVendorRowKey(isVendorOpen ? null : rowKey)
                              }
                              title="Chỉnh NCC, tiến độ, bảo hành"
                              className="p-1 rounded text-slate-400 hover:text-teal-600 cursor-pointer shrink-0"
                            >
                              <SlidersHorizontal className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-300 tabular-nums whitespace-nowrap">
                        {row.specLabel}
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        {row.source === "DEVELOPER_INCLUDED" ? (
                          <span className="text-slate-400 tabular-nums">0 đ</span>
                        ) : (
                          <input
                            type="number"
                            min={0}
                            step={100_000}
                            disabled={isScenarioLocked}
                            value={row.unitPriceVnd}
                            onChange={(e) => handleRowUnitPriceChange(row, e.target.value)}
                            aria-label={`Đơn giá ${row.name}`}
                            className="w-28 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-right text-xs font-bold text-slate-800 dark:text-slate-100 tabular-nums disabled:opacity-50"
                          />
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-extrabold text-slate-900 dark:text-white tabular-nums whitespace-nowrap">
                        {row.totalPriceVnd === 0
                          ? "0 đ"
                          : formatVNDMasked(row.totalPriceVnd, isPrivacyMode)}
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap">
                        {row.totalPriceVnd === 0 ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          <div>
                            <div className="inline-flex items-center justify-end gap-1">
                              <span className="font-bold text-emerald-700 dark:text-emerald-400">
                                {formatShortVNDMasked(row.paidAmountVnd, isPrivacyMode)}
                              </span>
                              {row.payments.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedPaymentsRowKey(isPaymentsOpen ? null : rowKey)
                                  }
                                  title="Xem / hủy các đợt thanh toán đã ghi"
                                  className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                                    isPaymentsOpen
                                      ? "bg-teal-600 text-white"
                                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-teal-50 hover:text-teal-700"
                                  }`}
                                >
                                  <History className="w-2.5 h-2.5" />
                                  <span>{row.payments.length} đợt</span>
                                </button>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-500">
                              Còn: {formatShortVNDMasked(row.remainingAmountVnd, isPrivacyMode)}
                            </p>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <select
                          value={row.procurementStatus}
                          disabled={row.source === "DEVELOPER_INCLUDED"}
                          onChange={(e) =>
                            updateBoqItemStatus(
                              row.origin,
                              row.id,
                              e.target.value as InteriorProcurementStatus
                            )
                          }
                          className={`bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1 text-xs font-bold ${PROCUREMENT_STATUS_META[row.procurementStatus].colorClass}`}
                        >
                          <option value="PLANNED">Dự kiến</option>
                          <option value="QUOTED">Đã báo giá</option>
                          <option value="DEPOSITED">Đã đặt cọc</option>
                          <option value="INSTALLED">Đã nghiệm thu</option>
                        </select>
                      </td>
                      <td className="py-3 pl-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {row.totalPriceVnd > 0 && (
                            <button
                              type="button"
                              onClick={() => handleOpenPayModal(row)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 cursor-pointer"
                            >
                              <Wallet className="w-3 h-3" />
                              <span>{row.payments.length > 0 ? "Ghi đợt tiếp" : "Ghi chi"}</span>
                            </button>
                          )}
                          {row.origin === "EXTRA_LINE" && !isScenarioLocked && (
                            <button
                              type="button"
                              onClick={() => deleteInteriorExtraBoqItem(row.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                              title="Xóa dòng BOQ này"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {isPaymentsOpen && row.payments.length > 0 && (
                      <tr className="bg-teal-50/40 dark:bg-teal-950/20">
                        <td colSpan={7} className="px-3 py-2.5">
                          <div className="space-y-1.5">
                            <p className="text-[11px] font-extrabold text-teal-800 dark:text-teal-300 flex items-center gap-1.5">
                              <History className="w-3.5 h-3.5" />
                              <span>Lịch sử {row.payments.length} đợt thanh toán cho &ldquo;{row.name}&rdquo;</span>
                            </p>
                            <div className="divide-y divide-slate-200/70 dark:divide-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                              {row.payments.map((pm) => (
                                <div
                                  key={pm.id}
                                  className="px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs"
                                >
                                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                                    <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                                      {pm.date}
                                    </span>
                                    <span className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[10px] font-extrabold">
                                      {BOQ_PAYMENT_STAGE_META[pm.stage].label}
                                    </span>
                                    {pm.note && (
                                      <span className="text-[11px] text-slate-600 dark:text-slate-300 truncate max-w-xs">
                                        {pm.note}
                                      </span>
                                    )}
                                    {pm.linkedTransactionId && (
                                      <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                                        · Đã nối Sổ Thu Chi
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 shrink-0">
                                    <span className="font-black text-slate-900 dark:text-white tabular-nums">
                                      {formatVNDMasked(pm.amountVnd, isPrivacyMode)}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setDeleteLinkedWalletTx(Boolean(pm.linkedTransactionId));
                                        setPendingDeletePayment({
                                          origin: row.origin,
                                          itemId: row.id,
                                          itemName: row.name,
                                          paymentId: pm.id,
                                          amountVnd: pm.amountVnd,
                                          stageLabel: BOQ_PAYMENT_STAGE_META[pm.stage].label,
                                          hasLinkedTx: Boolean(pm.linkedTransactionId),
                                        });
                                      }}
                                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-rose-200 dark:border-rose-900 text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                      <span>Hủy đợt</span>
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}

                    {isVendorOpen && (
                      <tr className="bg-slate-50/80 dark:bg-slate-800/40">
                        <td colSpan={7} className="px-3 py-2.5">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                            <input
                              type="text"
                              value={row.vendorName || ""}
                              onChange={(e) =>
                                handleRowVendorPatch(row, {
                                  vendorName: e.target.value || undefined,
                                })
                              }
                              placeholder="Tên xưởng / Nhà cung cấp"
                              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                            />
                            <input
                              type="number"
                              min={0}
                              max={180}
                              value={row.leadTimeDays ?? ""}
                              onChange={(e) =>
                                handleRowVendorPatch(row, {
                                  leadTimeDays:
                                    e.target.value === ""
                                      ? undefined
                                      : Math.max(0, Number(e.target.value)),
                                })
                              }
                              placeholder="Tiến độ sản xuất (ngày)"
                              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs tabular-nums"
                            />
                            <input
                              type="number"
                              min={0}
                              max={120}
                              value={row.warrantyMonths ?? ""}
                              onChange={(e) =>
                                handleRowVendorPatch(row, {
                                  warrantyMonths:
                                    e.target.value === ""
                                      ? undefined
                                      : Math.max(0, Number(e.target.value)),
                                })
                              }
                              placeholder="Bảo hành (tháng)"
                              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs tabular-nums"
                            />
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300">
                <td colSpan={3} className="py-2.5">
                  <div className="inline-flex items-center gap-2">
                    <span>Dự phòng phát sinh</span>
                    <input
                      type="number"
                      min={0}
                      max={30}
                      step={1}
                      disabled={isScenarioLocked}
                      value={activeScenario.contingencyPercent}
                      onChange={(e) => {
                        const pct = Math.max(0, Math.min(30, Number(e.target.value) || 0));
                        updateInteriorScenarioMeta(activeScenario.id, {
                          contingencyPercent: pct,
                        });
                      }}
                      aria-label="Phần trăm dự phòng phát sinh"
                      className="w-16 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-center font-extrabold text-slate-900 dark:text-white tabular-nums disabled:opacity-50"
                    />
                    <span>%</span>
                  </div>
                </td>
                <td className="py-2.5 px-3 text-right tabular-nums">
                  {formatVNDMasked(activeBoq.contingencyAmount, isPrivacyMode)}
                </td>
                <td colSpan={3} />
              </tr>
              <tr className="border-t-2 border-slate-300 dark:border-slate-700 text-sm font-black text-slate-900 dark:text-white">
                <td colSpan={3} className="py-3">
                  TỔNG DỰ TOÁN TRỌN GÓI ({activeScenario.shortLabel})
                </td>
                <td className="py-3 px-3 text-right text-teal-700 dark:text-teal-300 tabular-nums">
                  {formatVNDMasked(activeBoq.grandTotalWithContingency, isPrivacyMode)}
                </td>
                <td className="py-3 px-3 text-right text-xs font-bold tabular-nums">
                  <span className="text-emerald-700 dark:text-emerald-400 block">
                    Đã chi: {formatShortVNDMasked(activeBoq.paidOrDepositedVnd, isPrivacyMode)}
                  </span>
                  <span className="text-slate-500 block">
                    Còn: {formatShortVNDMasked(activeBoq.remainingToPayVnd, isPrivacyMode)}
                  </span>
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Modal: Scenario Diff (PA-A vs PA-B) */}
      {isCompareModalOpen && compareTargetScenario && diffSummary && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl max-h-[85vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Đối chiếu Chênh lệch Phương án Thiết kế
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Đang so <strong>{activeScenario.shortLabel}</strong> với{" "}
                  <select
                    value={compareTargetScenario.id}
                    onChange={(e) => setCompareTargetId(e.target.value)}
                    className="ml-1 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold text-slate-800 dark:text-slate-100"
                  >
                    {allScenarioBoqs
                      .filter((x) => x.scenario.id !== activeScenario.id)
                      .map((x) => (
                        <option key={x.scenario.id} value={x.scenario.id}>
                          {x.scenario.shortLabel}
                        </option>
                      ))}
                  </select>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCompareModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs tabular-nums">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/70">
                  <span className="text-slate-500 block">{activeScenario.shortLabel}</span>
                  <span className="text-sm font-black text-slate-900 dark:text-white block">
                    {formatShortVNDMasked(diffSummary.baseTotalVnd, isPrivacyMode)}
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    GĐ 1: {formatShortVNDMasked(diffSummary.basePhase1TotalVnd, isPrivacyMode)} · Công thái học {diffSummary.ergonomicPassCountA}/{diffSummary.ergonomicTotalChecks}
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/70">
                  <span className="text-slate-500 block">{compareTargetScenario.shortLabel}</span>
                  <span className="text-sm font-black text-slate-900 dark:text-white block">
                    {formatShortVNDMasked(diffSummary.compareTotalVnd, isPrivacyMode)}
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    GĐ 1: {formatShortVNDMasked(diffSummary.comparePhase1TotalVnd, isPrivacyMode)} · Công thái học {diffSummary.ergonomicPassCountB}/{diffSummary.ergonomicTotalChecks}
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800">
                  <span className="text-teal-700 dark:text-teal-300 block">Chênh lệch ròng (Trọn gói)</span>
                  <span
                    className={`text-sm font-black block ${
                      diffSummary.netDeltaVnd > 0
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-emerald-700 dark:text-emerald-300"
                    }`}
                  >
                    {diffSummary.netDeltaVnd > 0 ? "+" : ""}
                    {formatShortVNDMasked(diffSummary.netDeltaVnd, isPrivacyMode)}
                  </span>
                  <span className="text-[10px] text-teal-800 dark:text-teal-300 block mt-0.5">
                    ≈ {formatChiWeight(Math.abs(diffSummary.netDeltaVnd) / nhanBidPerChi, isPrivacyMode)} vàng · GĐ 1: {diffSummary.phase1DeltaVnd > 0 ? "+" : ""}{formatShortVNDMasked(diffSummary.phase1DeltaVnd, isPrivacyMode)}
                  </span>
                </div>
              </div>

              {diffSummary.entries.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6">
                  Hai phương án hiện có cấu trúc hạng mục & đơn giá giống hệt nhau.
                </p>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 uppercase">
                      <th className="py-2 pr-2">Hạng mục khác biệt</th>
                      <th className="py-2 px-2 text-right">{activeScenario.shortLabel}</th>
                      <th className="py-2 px-2 text-right">{compareTargetScenario.shortLabel}</th>
                      <th className="py-2 pl-2 text-right">Chênh lệch</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {diffSummary.entries.map((entry) => (
                      <tr key={entry.key}>
                        <td className="py-2 pr-2">
                          <p className="font-bold text-slate-900 dark:text-white">{entry.name}</p>
                          <p className="text-[10px] text-slate-500">
                            {entry.kind === "ONLY_IN_BASE"
                              ? `Chỉ có ở ${activeScenario.shortLabel}`
                              : entry.kind === "ONLY_IN_COMPARE"
                                ? `Chỉ có ở ${compareTargetScenario.shortLabel}`
                                : "Thay đổi kích thước / đơn giá"}
                          </p>
                        </td>
                        <td className="py-2 px-2 text-right tabular-nums">
                          {entry.baseCostVnd > 0
                            ? formatShortVNDMasked(entry.baseCostVnd, isPrivacyMode)
                            : "—"}
                        </td>
                        <td className="py-2 px-2 text-right tabular-nums">
                          {entry.compareCostVnd > 0
                            ? formatShortVNDMasked(entry.compareCostVnd, isPrivacyMode)
                            : "—"}
                        </td>
                        <td
                          className={`py-2 pl-2 text-right font-extrabold tabular-nums ${
                            entry.deltaVnd > 0
                              ? "text-rose-600 dark:text-rose-400"
                              : "text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          {entry.deltaVnd > 0 ? "+" : ""}
                          {formatShortVNDMasked(entry.deltaVnd, isPrivacyMode)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Extra BOQ Line */}
      {isAddExtraModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateExtraBoq}
            className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3.5 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                Thêm hạng mục BOQ ngoài 3D
              </h3>
              <button
                type="button"
                onClick={() => setIsAddExtraModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                Tên hạng mục
              </label>
              <input
                type="text"
                required
                value={extraName}
                onChange={(e) => setExtraName(e.target.value)}
                placeholder="VD: Robot hút bụi lau nhà / Lưới an toàn ban công"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  Nhóm chi phí
                </label>
                <select
                  value={extraGroup}
                  onChange={(e) => setExtraGroup(e.target.value as InteriorBoqGroup)}
                  className="w-full px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                >
                  <option value="WOOD_FURNITURE">Nội thất gỗ</option>
                  <option value="APPLIANCES">Điện máy</option>
                  <option value="FINISHING_DECOR">Hoàn thiện & Decor</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  Đơn vị & SL
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="number"
                    min={1}
                    value={extraQty}
                    onChange={(e) => setExtraQty(e.target.value)}
                    className="w-16 px-2 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs tabular-nums"
                  />
                  <input
                    type="text"
                    value={extraUnit}
                    onChange={(e) => setExtraUnit(e.target.value)}
                    className="flex-1 px-2 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                Đơn giá (VNĐ)
              </label>
              <input
                type="number"
                min={0}
                step={100000}
                value={extraPrice}
                onChange={(e) => setExtraPrice(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs tabular-nums"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="text"
                value={extraVendor}
                onChange={(e) => setExtraVendor(e.target.value)}
                placeholder="NCC / Xưởng"
                className="px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
              />
              <input
                type="number"
                min={0}
                value={extraLeadDays}
                onChange={(e) => setExtraLeadDays(e.target.value)}
                placeholder="Ngày giao"
                className="px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs tabular-nums"
              />
              <input
                type="number"
                min={0}
                value={extraWarranty}
                onChange={(e) => setExtraWarranty(e.target.value)}
                placeholder="BH (tháng)"
                className="px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs tabular-nums"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                Ghi chú (tùy chọn)
              </label>
              <input
                type="text"
                value={extraNote}
                onChange={(e) => setExtraNote(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddExtraModalOpen(false)}
                className="px-3.5 py-2 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg text-xs font-extrabold bg-teal-600 hover:bg-teal-700 text-white cursor-pointer"
              >
                Lưu hạng mục
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Multi-tranche BOQ Payment to Finance Ledger */}
      {payRow && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmBoqPayment}
            className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3.5 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                Ghi chi theo đợt (40 / 40 / 20) sang Sổ Thu Chi
              </h3>
              <button
                type="button"
                onClick={() => setPayRow(null)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/70 text-xs space-y-1">
              <p className="font-extrabold text-slate-900 dark:text-white">{payRow.name}</p>
              <div className="flex justify-between text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                <span>Tổng: {formatVNDMasked(payRow.totalPriceVnd, isPrivacyMode)}</span>
                <span>Đã chi: {formatShortVNDMasked(payRow.paidAmountVnd, isPrivacyMode)}</span>
                <span className="font-bold text-teal-700 dark:text-teal-300">
                  Còn: {formatShortVNDMasked(payRow.remainingAmountVnd, isPrivacyMode)}
                </span>
              </div>
              {payRow.payments.length > 0 && (
                <div className="pt-1.5 mt-1.5 border-t border-slate-200 dark:border-slate-700 space-y-0.5 max-h-20 overflow-y-auto">
                  {payRow.payments.map((p) => (
                    <div
                      key={p.id}
                      className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 tabular-nums"
                    >
                      <span>
                        {p.date} · {BOQ_PAYMENT_STAGE_META[p.stage].shortLabel}
                      </span>
                      <span className="font-bold text-emerald-700 dark:text-emerald-400">
                        {formatShortVNDMasked(p.amountVnd, isPrivacyMode)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Stage Selector + Quick % presets */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                Đợt thanh toán
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {(["DEPOSIT", "DELIVERY", "ACCEPTANCE", "OTHER"] as InteriorBoqPaymentStage[]).map(
                  (st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setPayStage(st)}
                      className={`py-1.5 px-1 rounded-lg text-[11px] font-bold border cursor-pointer ${
                        payStage === st
                          ? "bg-blue-600 border-blue-600 text-white"
                          : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      {BOQ_PAYMENT_STAGE_META[st].shortLabel}
                    </button>
                  )
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {[
                  { label: "40% cọc/giao", val: Math.round(payRow.totalPriceVnd * 0.4) },
                  { label: "20% nghiệm thu", val: Math.round(payRow.totalPriceVnd * 0.2) },
                  {
                    label: "Thanh toán đủ phần còn lại",
                    val: Math.max(10_000, payRow.remainingAmountVnd),
                  },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setPayAmount(String(preset.val))}
                    className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-teal-50 dark:hover:bg-teal-950/40 text-[10px] font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  Số tiền đợt này (VNĐ)
                </label>
                <input
                  type="number"
                  min={10000}
                  step={50000}
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold tabular-nums"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  Ngày chi
                </label>
                <input
                  type="date"
                  required
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs tabular-nums"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  Tài khoản chi
                </label>
                <select
                  value={payAccountId}
                  onChange={(e) => setPayAccountId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  Người chi
                </label>
                <select
                  value={payMemberId}
                  onChange={(e) => setPayMemberId(e.target.value as FamilyMember)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                >
                  <option value="HUSBAND">Anh Chuột</option>
                  <option value="WIFE">Bé Mèo</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                Ghi chú giao dịch (tùy chọn)
              </label>
              <input
                type="text"
                value={payNote}
                onChange={(e) => setPayNote(e.target.value)}
                placeholder="VD: Chuyển khoản cọc xưởng đợt 1"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPayRow(null)}
                className="px-3.5 py-2 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg text-xs font-extrabold bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
              >
                Xác nhận ghi chi
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog
        isOpen={Boolean(pendingDeletePayment)}
        title="Hủy đợt thanh toán BOQ?"
        message={
          pendingDeletePayment
            ? `Bạn muốn hủy đợt "${pendingDeletePayment.stageLabel}" (${formatVNDMasked(
                pendingDeletePayment.amountVnd,
                isPrivacyMode
              )}) của hạng mục "${pendingDeletePayment.itemName}"? Tiến độ thanh toán BOQ sẽ được tính lại tự động.`
            : ""
        }
        confirmLabel="Xác nhận hủy đợt"
        cancelLabel="Giữ lại"
        isDanger
        onCancel={() => setPendingDeletePayment(null)}
        onConfirm={() => {
          if (!pendingDeletePayment) return;
          const target = pendingDeletePayment;
          const deleteWalletTx = target.hasLinkedTx && deleteLinkedWalletTx;
          const res = deleteBoqPaymentRecord(
            target.origin,
            target.itemId,
            target.paymentId,
            { deleteLinkedFinanceTx: deleteWalletTx }
          );
          setPendingDeletePayment(null);
          if (res.ok) {
            setPayNotice(
              deleteWalletTx
                ? `Đã hủy đợt "${target.stageLabel}" của "${target.itemName}" và xóa kèm giao dịch ví FINANCE.`
                : `Đã hủy đợt "${target.stageLabel}" của "${target.itemName}" (giữ nguyên giao dịch trong Sổ Thu Chi).`
            );
            setTimeout(() => setPayNotice(null), 5000);
          }
        }}
      >
        {pendingDeletePayment?.hasLinkedTx && (
          <label className="mt-2 flex items-start gap-2.5 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-[#DCE4EE] dark:border-slate-700 cursor-pointer text-left">
            <input
              type="checkbox"
              checked={deleteLinkedWalletTx}
              onChange={(e) => setDeleteLinkedWalletTx(e.target.checked)}
              className="mt-0.5 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
            />
            <span className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
              <strong>Xóa kèm giao dịch chi tương ứng trong Sổ Thu Chi (FINANCE)</strong> để hoàn lại số dư ví. Bỏ chọn nếu bạn chỉ muốn chỉnh sửa lịch sử BOQ và giữ nguyên sao kê ví.
            </span>
          </label>
        )}
      </ConfirmDialog>
    </div>
  );
}
