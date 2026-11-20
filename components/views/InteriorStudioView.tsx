"use client";

import React, { useMemo, useState } from "react";
import {
  Box,
  Layers,
  Columns2,
  Undo2,
  Redo2,
  Plus,
  RotateCw,
  RotateCcw,
  Trash2,
  Copy,
  Lock,
  Unlock,
  Download,
  AlertTriangle,
  CheckCircle2,
  Wallet,
  ArrowUpRight,
  Image as ImageIcon,
  X,
  CheckSquare,
  Square,
  RotateCcw as ResetIcon,
} from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import {
  FamilyMember,
  InteriorBoqGroup,
  InteriorFurnitureItem,
  InteriorMaterialFinish,
  InteriorProcurementStatus,
  InteriorStylePreset,
} from "@/types/finance";
import {
  CatalogItemTemplate,
  INTERIOR_CATALOG,
  INTERIOR_STYLE_PRESETS,
  MATERIAL_FINISH_META,
  SKYONE_A2_ROOMS,
} from "@/lib/interiorFloorplan";
import {
  BOQ_GROUP_META,
  BoqUnifiedRow,
  calculateFurnitureItemCostVnd,
  calculateHandoverReadiness,
  calculateScenarioBoq,
  evaluateErgonomicClearances,
  exportBoqToCsv,
} from "@/lib/interiorBoqEngine";
import { computeGoldPortfolioMetrics, formatChiWeight } from "@/lib/goldEngine";
import { formatShortVNDMasked, formatVNDMasked } from "@/lib/formatters";
import { Interior3DViewport } from "@/components/interior/Interior3DViewport";
import { Interior2DBlueprint } from "@/components/interior/Interior2DBlueprint";

type ViewportMode = "3D" | "2D" | "SPLIT";

const PROCUREMENT_STATUS_META: Record<
  InteriorProcurementStatus,
  { label: string; colorClass: string }
> = {
  PLANNED: { label: "Dự kiến", colorClass: "text-slate-600 dark:text-slate-300" },
  QUOTED: { label: "Đã báo giá", colorClass: "text-amber-700 dark:text-amber-300" },
  DEPOSITED: { label: "Đã đặt cọc", colorClass: "text-blue-700 dark:text-blue-300" },
  INSTALLED: { label: "Đã nghiệm thu", colorClass: "text-emerald-700 dark:text-emerald-300" },
};

export function InteriorStudioView() {
  const {
    interiorTab,
    interiorStudio,
    setActiveInteriorScenario,
    updateInteriorScenarioMeta,
    duplicateInteriorScenario,
    addInteriorFurnitureItem,
    updateInteriorFurnitureItem,
    deleteInteriorFurnitureItem,
    addInteriorExtraBoqItem,
    deleteInteriorExtraBoqItem,
    updateBoqItemStatus,
    recordBoqPaymentToFinance,
    toggleHandoverChecklistItem,
    updateHandoverChecklistNote,
    undoInteriorChange,
    redoInteriorChange,
    canUndoInterior,
    canRedoInterior,
    resetInteriorStudio,
    goldPortfolio,
    summary,
    accounts,
    isPrivacyMode,
    switchSubApp,
  } = useFinance();

  const [viewportMode, setViewportMode] = useState<ViewportMode>("3D");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [isCatalogOpen, setIsCatalogOpen] = useState<boolean>(false);
  const [catalogCategoryFilter, setCatalogCategoryFilter] = useState<string>("ALL");

  // BOQ state
  const [boqGroupFilter, setBoqGroupFilter] = useState<InteriorBoqGroup | "ALL">("ALL");
  const [isAddExtraModalOpen, setIsAddExtraModalOpen] = useState<boolean>(false);
  const [extraName, setExtraName] = useState("");
  const [extraGroup, setExtraGroup] = useState<InteriorBoqGroup>("FINISHING_DECOR");
  const [extraUnit, setExtraUnit] = useState("gói");
  const [extraQty, setExtraQty] = useState("1");
  const [extraPrice, setExtraPrice] = useState("2500000");
  const [extraNote, setExtraNote] = useState("");

  // Payment to Finance bridge modal
  const [payRow, setPayRow] = useState<BoqUnifiedRow | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payAccountId, setPayAccountId] = useState(() => accounts.find((a) => a.type !== "CREDIT_CARD")?.id || accounts[0]?.id || "");
  const [payMemberId, setPayMemberId] = useState<FamilyMember>("HUSBAND");
  const [payStatusAfter, setPayStatusAfter] = useState<"DEPOSITED" | "INSTALLED">("DEPOSITED");
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [payNotice, setPayNotice] = useState<string | null>(null);

  // Readiness simulator state
  const [monthlySurplusInput, setMonthlySurplusInput] = useState<number>(() =>
    Math.max(10_000_000, Math.round((summary.savingsAmount > 5_000_000 ? summary.savingsAmount : 18_000_000) / 1_000_000) * 1_000_000)
  );
  const [monthsUntilHandover, setMonthsUntilHandover] = useState<number>(9);
  const [includePinkBook5Pct, setIncludePinkBook5Pct] = useState<boolean>(false);

  // Checklist state
  const [checklistZoneFilter, setChecklistZoneFilter] = useState<string>("ALL");
  const [showDeveloperSpecSheet, setShowDeveloperSpecSheet] = useState<boolean>(false);

  const activeScenario = useMemo(
    () =>
      interiorStudio.scenarios.find((s) => s.id === interiorStudio.activeScenarioId) ||
      interiorStudio.scenarios[0],
    [interiorStudio]
  );

  const allScenarioBoqs = useMemo(
    () =>
      interiorStudio.scenarios.map((sc) => ({
        scenario: sc,
        boq: calculateScenarioBoq(sc),
      })),
    [interiorStudio.scenarios]
  );

  const activeBoq = useMemo(() => calculateScenarioBoq(activeScenario), [activeScenario]);

  const warnings = useMemo(() => evaluateErgonomicClearances(activeScenario), [activeScenario]);

  const selectedItem = useMemo(
    () => activeScenario.items.find((i) => i.id === selectedItemId) || null,
    [activeScenario.items, selectedItemId]
  );

  const goldMetrics = useMemo(() => computeGoldPortfolioMetrics(goldPortfolio), [goldPortfolio]);

  const readiness = useMemo(
    () =>
      calculateHandoverReadiness({
        liquidCashVnd: summary.currentBalance,
        monthlyNetSurplusVnd: monthlySurplusInput,
        goldLiquidationValueBidVnd: goldMetrics.totalLiquidationValueBid,
        goldNhan9999BidPerChiVnd:
          goldPortfolio.quotes.NHAN_9999?.buyPricePerChi || 9_050_000,
        interiorBoqTotalVnd: activeBoq.grandTotalWithContingency,
        includePinkBook5Pct,
        monthsUntilHandover,
      }),
    [
      summary.currentBalance,
      monthlySurplusInput,
      goldMetrics.totalLiquidationValueBid,
      goldPortfolio.quotes,
      activeBoq.grandTotalWithContingency,
      includePinkBook5Pct,
      monthsUntilHandover,
    ]
  );

  const catalogCategories = useMemo(
    () => ["ALL", ...Array.from(new Set(INTERIOR_CATALOG.map((c) => c.categoryLabel)))],
    []
  );

  const filteredCatalog = useMemo(
    () =>
      catalogCategoryFilter === "ALL"
        ? INTERIOR_CATALOG
        : INTERIOR_CATALOG.filter((c) => c.categoryLabel === catalogCategoryFilter),
    [catalogCategoryFilter]
  );

  const handleAddFromCatalog = (tpl: CatalogItemTemplate) => {
    const room = SKYONE_A2_ROOMS.find((r) => r.id === tpl.defaultRoomId) || SKYONE_A2_ROOMS[0];
    const created = addInteriorFurnitureItem({
      catalogKey: tpl.catalogKey,
      name: tpl.name,
      roomId: room.id,
      source: tpl.source,
      position: { x: Number(room.x.toFixed(2)), z: Number(room.z.toFixed(2)) },
      rotationDeg: 0,
      dimensionsCm: { ...tpl.defaultDimensionsCm },
      materialFinish: tpl.defaultFinish,
      pricingRule: tpl.pricingRule,
      unitPriceVnd: tpl.unitPriceVnd,
      boqGroup: tpl.boqGroup,
      procurementStatus: tpl.source === "DEVELOPER_INCLUDED" ? "INSTALLED" : "PLANNED",
      note: tpl.note,
    });
    setSelectedItemId(created.id);
    setIsCatalogOpen(false);
  };

  const handleDuplicateSelected = (item: InteriorFurnitureItem) => {
    const created = addInteriorFurnitureItem({
      ...item,
      name: `${item.name} (bản sao)`,
      position: {
        x: Number(Math.min(3.3, item.position.x + 0.35).toFixed(2)),
        z: Number(Math.min(3.2, item.position.z + 0.25).toFixed(2)),
      },
      isLocked: false,
      linkedTransactionId: undefined,
    });
    setSelectedItemId(created.id);
  };

  const handleOpenPayModal = (row: BoqUnifiedRow) => {
    setPayRow(row);
    setPayAmount(String(row.totalPriceVnd));
    setPayAccountId(accounts.find((a) => a.type !== "CREDIT_CARD")?.id || accounts[0]?.id || "");
    setPayStatusAfter(row.procurementStatus === "DEPOSITED" ? "INSTALLED" : "DEPOSITED");
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
      statusAfter: payStatusAfter,
      note: `BOQ SKYONE A.12A.07 (${activeScenario.shortLabel})`,
    });
    setPayRow(null);
    setPayNotice(`Đã ghi nhận chi ${formatShortVNDMasked(amountNum, isPrivacyMode)} cho "${payRow.name}" vào Sổ Thu Chi.`);
    window.setTimeout(() => setPayNotice(null), 4000);
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
      note: extraNote.trim() || undefined,
    });
    setExtraName("");
    setExtraNote("");
    setIsAddExtraModalOpen(false);
  };

  // ==================== TAB 1: STUDIO 3D & 2D ====================
  const renderStudioTab = () => (
    <div className="space-y-4">
      {/* Studio Control Strip: Scenario Switcher + Style + Viewport + Undo/Redo */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Scenario Selector (PA-A vs PA-B Dual Growth Studio) */}
          <div className="flex flex-wrap items-center gap-2">
            {allScenarioBoqs.map(({ scenario: sc, boq }) => {
              const active = sc.id === activeScenario.id;
              return (
                <button
                  key={sc.id}
                  type="button"
                  onClick={() => {
                    setActiveInteriorScenario(sc.id);
                    setSelectedItemId(null);
                  }}
                  className={`px-3 py-2 rounded-lg text-left border transition-colors cursor-pointer ${
                    active
                      ? "bg-teal-600 border-teal-600 text-white"
                      : "bg-slate-50 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-teal-400"
                  }`}
                >
                  <p className="text-xs font-black leading-tight">{sc.shortLabel}</p>
                  <p
                    className={`text-[10px] font-semibold tabular-nums mt-0.5 ${
                      active ? "text-teal-100" : "text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    BOQ: {formatShortVNDMasked(boq.grandTotalWithContingency, isPrivacyMode)}
                  </p>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => duplicateInteriorScenario(activeScenario.id)}
              title="Nhân bản phương án hiện tại để thử nghiệm"
              className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-bold border border-dashed border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-teal-500 hover:text-teal-600 cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Nhân bản PA</span>
            </button>
          </div>

          {/* Right Toolbar: Viewport Mode + Undo/Redo + Catalog */}
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700">
              {(
                [
                  { id: "3D", label: "3D", icon: Box },
                  { id: "2D", label: "2D CAD", icon: Layers },
                  { id: "SPLIT", label: "Song song", icon: Columns2 },
                ] as { id: ViewportMode; label: string; icon: React.ComponentType<{ className?: string }> }[]
              ).map((m) => {
                const Icon = m.icon;
                const active = viewportMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setViewportMode(m.id)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                      active
                        ? "bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-300 shadow-xs"
                        : "text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              disabled={!canUndoInterior}
              onClick={undoInteriorChange}
              title="Hoàn tác (Undo)"
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={!canRedoInterior}
              onClick={redoInteriorChange}
              title="Làm lại (Redo)"
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <Redo2 className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setIsCatalogOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-extrabold bg-teal-600 hover:bg-teal-700 text-white transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm nội thất</span>
            </button>
          </div>
        </div>

        {/* Second Strip: Style Presets + Active Scenario Note + Live Budget Meter */}
        <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mr-1">
              Phong cách:
            </span>
            {(Object.keys(INTERIOR_STYLE_PRESETS) as InteriorStylePreset[]).map((presetKey) => {
              const p = INTERIOR_STYLE_PRESETS[presetKey];
              const active = activeScenario.stylePreset === presetKey;
              return (
                <button
                  key={presetKey}
                  type="button"
                  onClick={() =>
                    updateInteriorScenarioMeta(activeScenario.id, { stylePreset: presetKey })
                  }
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold border transition-colors cursor-pointer ${
                    active
                      ? "bg-slate-900 dark:bg-teal-500 text-white dark:text-slate-950 border-slate-900 dark:border-teal-500"
                      : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400"
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full border border-black/20"
                    style={{ backgroundColor: p.primaryWoodHex }}
                  />
                  <span>{p.name}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-3 text-xs tabular-nums">
            <span className="text-slate-500 dark:text-slate-400 font-semibold">
              Ngân sách 100–150tr:
            </span>
            <span
              className={`font-black ${
                activeBoq.budgetStatus === "OVER_BUDGET"
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-teal-700 dark:text-teal-300"
              }`}
            >
              {formatVNDMasked(activeBoq.grandTotalWithContingency, isPrivacyMode)}
            </span>
          </div>
        </div>
      </div>

      {/* Collapsible Catalog Drawer */}
      {isCatalogOpen && (
        <div className="bg-white dark:bg-slate-900 border border-teal-300 dark:border-teal-800 rounded-xl p-4 space-y-3 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                Thư viện 26 món Nội thất & Điện máy SKYONE A.12A.07
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Chọn món để đặt ngay vào mặt bằng 3D & tự động cộng vào bảng dự toán BOQ
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsCatalogOpen(false)}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {catalogCategories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCatalogCategoryFilter(cat)}
                className={`px-2.5 py-1 rounded-md text-xs font-bold cursor-pointer ${
                  catalogCategoryFilter === cat
                    ? "bg-teal-600 text-white"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                }`}
              >
                {cat === "ALL" ? "Tất cả" : cat}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-72 overflow-y-auto pr-1">
            {filteredCatalog.map((tpl) => (
              <button
                key={tpl.catalogKey}
                type="button"
                onClick={() => handleAddFromCatalog(tpl)}
                className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-teal-500 bg-slate-50/60 dark:bg-slate-800/50 text-left transition-colors cursor-pointer flex flex-col justify-between gap-1.5"
              >
                <div>
                  <p className="text-xs font-extrabold text-slate-900 dark:text-white">
                    {tpl.name}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {tpl.defaultDimensionsCm.width}×{tpl.defaultDimensionsCm.depth}×
                    {tpl.defaultDimensionsCm.height} cm · {tpl.categoryLabel}
                  </p>
                </div>
                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/70 dark:border-slate-700/70">
                  <span className="font-bold text-teal-700 dark:text-teal-300 tabular-nums">
                    {tpl.unitPriceVnd === 0
                      ? "CĐT bàn giao (0 đ)"
                      : `${formatShortVNDMasked(tpl.unitPriceVnd, isPrivacyMode)}${tpl.pricingRule === "PER_LINEAR_METER" ? "/md" : ""}`}
                  </span>
                  <span className="text-teal-600 dark:text-teal-400 font-bold">+ Đặt vào 3D</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Spatial Canvas + Side Inspector */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        <div className={selectedItem ? "xl:col-span-8" : "xl:col-span-12"}>
          {viewportMode === "3D" && (
            <Interior3DViewport
              scenario={activeScenario}
              selectedItemId={selectedItemId}
              onSelectItem={setSelectedItemId}
              onItemMoved={(id, x, z) =>
                updateInteriorFurnitureItem(id, { position: { x, z } })
              }
              onFallbackTo2D={() => setViewportMode("2D")}
              className="h-[480px] sm:h-[580px]"
            />
          )}

          {viewportMode === "2D" && (
            <Interior2DBlueprint
              scenario={activeScenario}
              selectedItemId={selectedItemId}
              warnings={warnings}
              onSelectItem={setSelectedItemId}
              onItemMoved={(id, x, z) =>
                updateInteriorFurnitureItem(id, { position: { x, z } })
              }
            />
          )}

          {viewportMode === "SPLIT" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Interior3DViewport
                scenario={activeScenario}
                selectedItemId={selectedItemId}
                onSelectItem={setSelectedItemId}
                onItemMoved={(id, x, z) =>
                  updateInteriorFurnitureItem(id, { position: { x, z } })
                }
                onFallbackTo2D={() => setViewportMode("2D")}
                className="h-[460px] sm:h-[540px]"
              />
              <Interior2DBlueprint
                scenario={activeScenario}
                selectedItemId={selectedItemId}
                warnings={warnings}
                onSelectItem={setSelectedItemId}
                onItemMoved={(id, x, z) =>
                  updateInteriorFurnitureItem(id, { position: { x, z } })
                }
              />
            </div>
          )}
        </div>

        {/* Selected Furniture Inspector */}
        {selectedItem && (
          <aside className="xl:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-4">
            <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider">
                  {BOQ_GROUP_META[selectedItem.boqGroup].shortLabel}
                </p>
                <h3 className="text-sm font-black text-slate-900 dark:text-white leading-snug mt-0.5">
                  {selectedItem.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItemId(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Price Preview */}
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/70 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Dự toán món này
              </span>
              <span className="text-base font-black text-teal-700 dark:text-teal-300 tabular-nums">
                {selectedItem.source === "DEVELOPER_INCLUDED"
                  ? "0 đ (CĐT bàn giao)"
                  : formatVNDMasked(calculateFurnitureItemCostVnd(selectedItem), isPrivacyMode)}
              </span>
            </div>

            {/* Dimensions Sliders (cm) */}
            <div className="space-y-2.5">
              <p className="text-xs font-extrabold text-slate-700 dark:text-slate-200">
                Kích thước chuẩn (cm) — cập nhật 3D & giá trực tiếp
              </p>
              {(
                [
                  { key: "width", label: "Chiều rộng (W)", min: 30, max: 280 },
                  { key: "depth", label: "Chiều sâu (D)", min: 15, max: 230 },
                  { key: "height", label: "Chiều cao (H)", min: 2, max: 280 },
                ] as const
              ).map((dim) => (
                <div key={dim.key} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400">{dim.label}</span>
                    <span className="font-bold text-slate-800 dark:text-slate-100 tabular-nums">
                      {selectedItem.dimensionsCm[dim.key]} cm
                    </span>
                  </div>
                  <input
                    type="range"
                    min={dim.min}
                    max={dim.max}
                    step={5}
                    disabled={Boolean(selectedItem.isLocked)}
                    value={selectedItem.dimensionsCm[dim.key]}
                    onChange={(e) =>
                      updateInteriorFurnitureItem(selectedItem.id, {
                        dimensionsCm: {
                          ...selectedItem.dimensionsCm,
                          [dim.key]: Number(e.target.value),
                        },
                      })
                    }
                    className="w-full accent-teal-600 disabled:opacity-50"
                  />
                </div>
              ))}
            </div>

            {/* Rotation Controls */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700 dark:text-slate-200">Góc xoay</span>
                <span className="font-bold tabular-nums text-slate-500">
                  {selectedItem.rotationDeg}°
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  disabled={Boolean(selectedItem.isLocked)}
                  onClick={() =>
                    updateInteriorFurnitureItem(selectedItem.id, {
                      rotationDeg: ((selectedItem.rotationDeg - 15) % 360 + 360) % 360,
                    })
                  }
                  className="inline-flex items-center justify-center gap-1 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> -15°
                </button>
                <button
                  type="button"
                  disabled={Boolean(selectedItem.isLocked)}
                  onClick={() =>
                    updateInteriorFurnitureItem(selectedItem.id, {
                      rotationDeg: (selectedItem.rotationDeg + 15) % 360,
                    })
                  }
                  className="inline-flex items-center justify-center gap-1 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                >
                  <RotateCw className="w-3.5 h-3.5" /> +15°
                </button>
                <button
                  type="button"
                  disabled={Boolean(selectedItem.isLocked)}
                  onClick={() =>
                    updateInteriorFurnitureItem(selectedItem.id, {
                      rotationDeg: (selectedItem.rotationDeg + 90) % 360,
                    })
                  }
                  className="inline-flex items-center justify-center gap-1 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                >
                  +90°
                </button>
              </div>
            </div>

            {/* 8 Material Swatches */}
            <div className="space-y-1.5">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                Vật liệu hoàn thiện
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {(Object.keys(MATERIAL_FINISH_META) as InteriorMaterialFinish[]).map((fk) => {
                  const meta = MATERIAL_FINISH_META[fk];
                  const active = selectedItem.materialFinish === fk;
                  return (
                    <button
                      key={fk}
                      type="button"
                      onClick={() =>
                        updateInteriorFurnitureItem(selectedItem.id, { materialFinish: fk })
                      }
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border text-left text-[11px] font-bold transition-colors cursor-pointer ${
                        active
                          ? "border-teal-600 bg-teal-50 dark:bg-teal-950/50 text-teal-900 dark:text-teal-200"
                          : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-400"
                      }`}
                    >
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-black/20 shrink-0"
                        style={{ backgroundColor: meta.hex }}
                      />
                      <span className="truncate">{meta.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Actions: Lock, Duplicate, Delete */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  updateInteriorFurnitureItem(selectedItem.id, {
                    isLocked: !selectedItem.isLocked,
                  })
                }
                className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                {selectedItem.isLocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                <span>{selectedItem.isLocked ? "Mở khóa" : "Khóa vị trí"}</span>
              </button>
              <button
                type="button"
                onClick={() => handleDuplicateSelected(selectedItem)}
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                title="Nhân bản món này"
              >
                <Copy className="w-4 h-4" />
              </button>
              {selectedItem.source !== "DEVELOPER_INCLUDED" && (
                <button
                  type="button"
                  onClick={() => {
                    deleteInteriorFurnitureItem(selectedItem.id);
                    setSelectedItemId(null);
                  }}
                  className="p-2 rounded-lg border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                  title="Xóa món này"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Scenario Description & Ergonomic Clearances */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-1.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-wider text-teal-700 dark:text-teal-400">
              {activeScenario.name}
            </h3>
            <span className="text-xs font-bold text-slate-500 tabular-nums">
              {activeScenario.items.length} vật thể 3D
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            {activeScenario.description}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
              Kiểm tra Công thái học & Lối đi (A.12A.07)
            </h3>
            {warnings.length === 0 ? (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" /> Đạt chuẩn lối đi
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-3.5 h-3.5" /> {warnings.length} lưu ý
              </span>
            )}
          </div>
          {warnings.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Tất cả đồ nội thất đều nằm gọn trong mặt bằng 51.0 m², không chắn cửa Lecmax 1.2m, cửa lùa ban công 2.4m hay chồng lấn nhau.
            </p>
          ) : (
            <div className="space-y-1.5 max-h-24 overflow-y-auto">
              {warnings.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => setSelectedItemId(w.itemId)}
                  className="w-full text-left text-xs px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-950/60 cursor-pointer"
                >
                  {w.message}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // ==================== TAB 2: BOQ & PROCUREMENT ====================
  const renderBoqTab = () => {
    const filteredRows =
      boqGroupFilter === "ALL"
        ? activeBoq.rows
        : activeBoq.rows.filter((r) => r.boqGroup === boqGroupFilter);

    return (
      <div className="space-y-5">
        {payNotice && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{payNotice}</span>
          </div>
        )}

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
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Dự phòng {sc.contingencyPercent}% · Bếp & WC CĐT = 0 đ
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
                        boq.varianceFromMaxVnd >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600"
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

        {/* Action Bar & Filters */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {(["ALL", "WOOD_FURNITURE", "APPLIANCES", "FINISHING_DECOR", "DEVELOPER_INCLUDED"] as const).map(
                (grp) => (
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
                )
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsAddExtraModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white cursor-pointer"
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
            </div>
          </div>

          {/* BOQ Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-2.5 pr-3">Hạng mục</th>
                  <th className="py-2.5 px-3">Quy cách</th>
                  <th className="py-2.5 px-3 text-right">Thành tiền</th>
                  <th className="py-2.5 px-3">Trạng thái</th>
                  <th className="py-2.5 pl-3 text-right">Thu Chi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                {filteredRows.map((row) => (
                  <tr key={`${row.origin}_${row.id}`} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="py-3 pr-3">
                      <p className="font-bold text-slate-900 dark:text-white">{row.name}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {BOQ_GROUP_META[row.boqGroup].shortLabel}
                        {row.note ? ` · ${row.note}` : ""}
                      </p>
                    </td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-300 tabular-nums whitespace-nowrap">
                      {row.specLabel}
                    </td>
                    <td className="py-3 px-3 text-right font-extrabold text-slate-900 dark:text-white tabular-nums whitespace-nowrap">
                      {row.totalPriceVnd === 0
                        ? "0 đ"
                        : formatVNDMasked(row.totalPriceVnd, isPrivacyMode)}
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
                            <span>{row.linkedTransactionId ? "Ghi thêm" : "Ghi chi"}</span>
                          </button>
                        )}
                        {row.origin === "EXTRA_LINE" && (
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
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300">
                  <td colSpan={2} className="py-2.5">
                    Dự phòng phát sinh ({activeScenario.contingencyPercent}%)
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums">
                    {formatVNDMasked(activeBoq.contingencyAmount, isPrivacyMode)}
                  </td>
                  <td colSpan={2} />
                </tr>
                <tr className="border-t-2 border-slate-300 dark:border-slate-700 text-sm font-black text-slate-900 dark:text-white">
                  <td colSpan={2} className="py-3">
                    TỔNG DỰ TOÁN TRỌN GÓI ({activeScenario.shortLabel})
                  </td>
                  <td className="py-3 px-3 text-right text-teal-700 dark:text-teal-300 tabular-nums">
                    {formatVNDMasked(activeBoq.grandTotalWithContingency, isPrivacyMode)}
                  </td>
                  <td colSpan={2} className="py-3 pl-3 text-right text-xs font-semibold text-slate-500 tabular-nums">
                    Đã chi/cọc: {formatShortVNDMasked(activeBoq.paidOrDepositedVnd, isPrivacyMode)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // ==================== TAB 3: HANDOVER READINESS BRIDGE (4 SUB-APPS) ====================
  const renderReadinessTab = () => (
    <div className="space-y-5">
      {/* Status Headline Banner */}
      <div
        className={`rounded-xl border p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
          readiness.status === "READY_CASH_ONLY"
            ? "bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800"
            : readiness.status === "READY_WITH_GOLD"
              ? "bg-amber-50/70 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800"
              : "bg-rose-50/70 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800"
        }`}
      >
        <div className="space-y-1">
          <p className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
            Cầu nối 4 Sub-App · Mốc Nhận Bàn Giao Căn A.12A.07 (Q3/2027)
          </p>
          <h2 className="text-lg font-black text-slate-900 dark:text-white">
            {readiness.status === "READY_CASH_ONLY"
              ? "An toàn tuyệt đối bằng Tiền mặt — Giữ nguyên Kho Vàng cho mốc 08/2028"
              : readiness.status === "READY_WITH_GOLD"
                ? `Đủ lực nhận nhà khi kích hoạt ~${formatChiWeight(readiness.suggestedGoldChiToSell, isPrivacyMode)} từ Kho Vàng`
                : `Cần tăng tích lũy thêm ${formatShortVNDMasked(Math.abs(readiness.combinedSurplusOrGapVnd), isPrivacyMode)} trước Q3/2027`}
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            Đang áp dụng phương án <strong>{activeScenario.name}</strong> (BOQ{" "}
            {formatShortVNDMasked(readiness.interiorBoqTotalVnd, isPrivacyMode)}).
          </p>
        </div>

        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            type="button"
            onClick={() => switchSubApp("GOLD", { goldTab: "SIMULATOR" })}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-extrabold bg-amber-500 hover:bg-amber-600 text-stone-950 cursor-pointer"
          >
            <span>Mở Mô phỏng Bán Vàng</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => switchSubApp("SKYONE", { skyoneTab: "ADVISOR" })}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-extrabold bg-slate-900 dark:bg-slate-800 text-white cursor-pointer"
          >
            <span>Cố vấn Vay 08/2028</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Interactive Controls */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="font-bold text-slate-700 dark:text-slate-200">Thặng dư tiết kiệm / tháng</span>
            <span className="font-black text-teal-700 dark:text-teal-300 tabular-nums">
              {formatShortVNDMasked(monthlySurplusInput, isPrivacyMode)}
            </span>
          </div>
          <input
            type="range"
            min={5_000_000}
            max={45_000_000}
            step={1_000_000}
            value={monthlySurplusInput}
            onChange={(e) => setMonthlySurplusInput(Number(e.target.value))}
            className="w-full accent-teal-600"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="font-bold text-slate-700 dark:text-slate-200">Số tháng tích lũy tới Q3/2027</span>
            <span className="font-black text-teal-700 dark:text-teal-300 tabular-nums">
              {monthsUntilHandover} tháng
            </span>
          </div>
          <input
            type="range"
            min={3}
            max={18}
            step={1}
            value={monthsUntilHandover}
            onChange={(e) => setMonthsUntilHandover(Number(e.target.value))}
            className="w-full accent-teal-600"
          />
        </div>

        <label className="flex items-center gap-2.5 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={includePinkBook5Pct}
            onChange={(e) => setIncludePinkBook5Pct(e.target.checked)}
            className="w-4 h-4 accent-teal-600"
          />
          <div className="text-xs">
            <p className="font-bold text-slate-800 dark:text-slate-100">Gộp luôn 5% Sổ hồng (72,3 tr)</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Mặc định đóng riêng khi có thông báo làm sổ
            </p>
          </div>
        </label>
      </div>

      {/* 2-Column Ledger: Needs vs Resources */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-black text-slate-900 dark:text-white">
            Tổng Nhu Cầu Tiền Mặt Nhận Nhà (Q3/2027)
          </h3>
          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-600 dark:text-slate-300">Phí bảo trì 2% (SKYONE A.12A.07)</span>
              <span className="font-bold tabular-nums">
                {formatVNDMasked(readiness.maintenanceFee2PctVnd, isPrivacyMode)}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-600 dark:text-slate-300">Đợt cuối 5% Sổ hồng (tùy chọn gộp)</span>
              <span className="font-bold tabular-nums">
                {formatVNDMasked(readiness.pinkBook5PctVnd, isPrivacyMode)}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-600 dark:text-slate-300">
                Dự toán Nội thất & Điện máy ({activeScenario.shortLabel})
              </span>
              <span className="font-bold text-teal-700 dark:text-teal-300 tabular-nums">
                {formatVNDMasked(readiness.interiorBoqTotalVnd, isPrivacyMode)}
              </span>
            </div>
            <div className="flex justify-between pt-2 text-sm font-black">
              <span>TỔNG CẦN CHUẨN BỊ</span>
              <span className="tabular-nums">
                {formatVNDMasked(readiness.totalHandoverNeedVnd, isPrivacyMode)}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-black text-slate-900 dark:text-white">
            Tổng Nguồn Lực Liên Thông (FINANCE + GOLD)
          </h3>
          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-600 dark:text-slate-300">Số dư ví thanh khoản hiện có (FINANCE)</span>
              <span className="font-bold tabular-nums">
                {formatVNDMasked(readiness.currentLiquidCashVnd, isPrivacyMode)}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-600 dark:text-slate-300">
                Thặng dư dự phóng ({readiness.monthsUntilHandover} tháng)
              </span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                +{formatVNDMasked(readiness.projectedCashSurplusVnd, isPrivacyMode)}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-600 dark:text-slate-300">
                Kho Vàng định giá thu mua thực Bid (GOLD)
              </span>
              <span className="font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                +{formatVNDMasked(readiness.goldLiquidationValueBidVnd, isPrivacyMode)}
              </span>
            </div>
            <div className="flex justify-between pt-2 text-sm font-black">
              <span>TỔNG NGUỒN LỰC DỰ KIẾN</span>
              <span className="text-emerald-700 dark:text-emerald-300 tabular-nums">
                {formatVNDMasked(readiness.totalResourcesWithGoldVnd, isPrivacyMode)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Bars */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-bold">
            <span>Độ sẵn sàng chỉ bằng Tiền mặt (giữ nguyên 100% Vàng)</span>
            <span className="tabular-nums">{readiness.readinessPctCashOnly}%</span>
          </div>
          <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-teal-600 rounded-full transition-all"
              style={{ width: `${Math.min(100, readiness.readinessPctCashOnly)}%` }}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-bold">
            <span>Độ sẵn sàng hợp nhất (Tiền mặt + Kho Vàng Bid)</span>
            <span className="tabular-nums">{readiness.readinessPctWithGold}%</span>
          </div>
          <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full transition-all"
              style={{ width: `${Math.min(100, readiness.readinessPctWithGold)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );

  // ==================== TAB 4: HANDOVER CHECKLIST (8 ZONES) ====================
  const renderChecklistTab = () => {
    const zones = ["ALL", "01", "02", "03", "04", "05", "06", "07", "08"];
    const total = interiorStudio.handoverChecklist.length;
    const done = interiorStudio.handoverChecklist.filter((i) => i.checked).length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const items =
      checklistZoneFilter === "ALL"
        ? interiorStudio.handoverChecklist
        : interiorStudio.handoverChecklist.filter((i) => i.zoneCode === checklistZoneFilter);

    return (
      <div className="space-y-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1 flex-1 min-w-[240px]">
            <div className="flex items-center justify-between text-xs font-extrabold">
              <span>Tiến độ nghiệm thu bàn giao Căn A.12A.07</span>
              <span className="text-teal-700 dark:text-teal-300 tabular-nums">
                {done}/{total} hạng mục ({pct}%)
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-teal-600 rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowDeveloperSpecSheet((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              <ImageIcon className="w-3.5 h-3.5 text-teal-600" />
              <span>{showDeveloperSpecSheet ? "Ẩn bảng CĐT" : "Xem ảnh tiêu chuẩn CĐT"}</span>
            </button>
            <button
              type="button"
              onClick={resetInteriorStudio}
              className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-600 cursor-pointer"
              title="Khôi phục cấu hình Studio mặc định"
            >
              <ResetIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {showDeveloperSpecSheet && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <div className="space-y-1.5">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                Tiêu chuẩn bàn giao 8 phân khu Phú Đông SKYONE
              </p>
              <img
                src="/assets/aistudio/mat-bang-noi-that-chi-tiet_24defd59.jpg"
                alt="Tiêu chuẩn bàn giao Phú Đông SKYONE"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700"
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                Mặt bằng CAD Loại A2 (51.0 m² sử dụng / 55.3 m² xây dựng)
              </p>
              <img
                src="/assets/aistudio/image_25391d5d.png"
                alt="Mặt bằng CAD Loại A2"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700"
              />
            </div>
          </div>
        )}

        {/* Zone Filter */}
        <div className="flex flex-wrap gap-1.5">
          {zones.map((z) => (
            <button
              key={z}
              type="button"
              onClick={() => setChecklistZoneFilter(z)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                checklistZoneFilter === z
                  ? "bg-teal-600 text-white"
                  : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300"
              }`}
            >
              {z === "ALL" ? "Tất cả khu 01–08" : `Khu ${z}`}
            </button>
          ))}
        </div>

        {/* Checklist Items */}
        <div className="space-y-2.5">
          {items.map((item) => (
            <div
              key={item.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2.5"
            >
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => toggleHandoverChecklistItem(item.id)}
                  className="mt-0.5 text-teal-600 dark:text-teal-400 cursor-pointer shrink-0"
                >
                  {item.checked ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5 text-slate-400" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold text-teal-700 dark:text-teal-400">
                    Khu {item.zoneCode} · {item.zoneName}
                  </p>
                  <p
                    className={`text-sm font-extrabold mt-0.5 ${
                      item.checked ? "line-through text-slate-400" : "text-slate-900 dark:text-white"
                    }`}
                  >
                    {item.title}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{item.specDetail}</p>
                </div>
              </div>
              <input
                type="text"
                value={item.note || ""}
                onChange={(e) => updateHandoverChecklistNote(item.id, e.target.value)}
                placeholder="Ghi chú lỗi cần CĐT khắc phục (vết xước, độ dốc thoát nước, keo ron...)"
                className="w-full px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200"
              />
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {interiorTab === "STUDIO" && renderStudioTab()}
      {interiorTab === "BOQ" && renderBoqTab()}
      {interiorTab === "READINESS" && renderReadinessTab()}
      {interiorTab === "CHECKLIST" && renderChecklistTab()}

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
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Tên hạng mục</label>
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
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Nhóm chi phí</label>
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
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Đơn vị & SL</label>
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
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Đơn giá (VNĐ)</label>
              <input
                type="number"
                min={0}
                step={100000}
                value={extraPrice}
                onChange={(e) => setExtraPrice(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs tabular-nums"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Ghi chú (tùy chọn)</label>
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

      {/* Modal: Record BOQ Payment to Finance Ledger */}
      {payRow && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmBoqPayment}
            className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3.5 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                Ghi chi nội thất sang Sổ Thu Chi
              </h3>
              <button
                type="button"
                onClick={() => setPayRow(null)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 font-semibold">{payRow.name}</p>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Số tiền thanh toán (VNĐ)</label>
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
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Ngày chi</label>
                <input
                  type="date"
                  required
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs tabular-nums"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Tài khoản chi (Event Sourcing)</label>
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

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Người chi</label>
                <select
                  value={payMemberId}
                  onChange={(e) => setPayMemberId(e.target.value as FamilyMember)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                >
                  <option value="HUSBAND">Anh Chuột</option>
                  <option value="WIFE">Bé Mèo</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Trạng thái BOQ sau chi</label>
                <select
                  value={payStatusAfter}
                  onChange={(e) => setPayStatusAfter(e.target.value as "DEPOSITED" | "INSTALLED")}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                >
                  <option value="DEPOSITED">Đã đặt cọc</option>
                  <option value="INSTALLED">Đã nghiệm thu / Thanh toán đủ</option>
                </select>
              </div>
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
    </div>
  );
}

export default InteriorStudioView;
