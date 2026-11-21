"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Box,
  CheckCircle2,
  Columns2,
  Copy,
  FileText,
  Layers,
  Paintbrush,
  Plus,
  Redo2,
  Undo2,
  X,
  Zap,
} from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import {
  InteriorDesignScenario,
  InteriorFurnitureItem,
  InteriorStylePreset,
} from "@/types/finance";
import {
  CatalogItemTemplate,
  INTERIOR_CATALOG,
  INTERIOR_STYLE_PRESETS,
  SKYONE_A2_BOUNDS,
  SKYONE_A2_ROOMS,
} from "@/lib/interiorFloorplan";
import { ErgonomicWarning, ScenarioBoqSummary } from "@/lib/interiorBoqEngine";
import { formatShortVNDMasked, formatVNDMasked } from "@/lib/formatters";
import {
  Interior3DViewport,
  Interior3DViewportHandle,
} from "@/components/interior/Interior3DViewport";
import { Interior2DBlueprint } from "@/components/interior/Interior2DBlueprint";
import { FurnitureInspectorPanel } from "./FurnitureInspectorPanel";

export type StudioViewportMode = "3D" | "2D" | "SPLIT";

interface StudioWorkspaceTabProps {
  activeScenario: InteriorDesignScenario;
  allScenarioBoqs: { scenario: InteriorDesignScenario; boq: ScenarioBoqSummary }[];
  activeBoq: ScenarioBoqSummary;
  warnings: ErgonomicWarning[];
  viewportMode: StudioViewportMode;
  onChangeViewportMode: (mode: StudioViewportMode) => void;
  selectedItemId: string | null;
  onSelectItem: (id: string | null) => void;
  showMepLayer: boolean;
  onToggleMepLayer: () => void;
  viewport3DRef: React.RefObject<Interior3DViewportHandle | null>;
  onRequestPrintSpecSheet: () => void;
}

export function StudioWorkspaceTab({
  activeScenario,
  allScenarioBoqs,
  activeBoq,
  warnings,
  viewportMode,
  onChangeViewportMode,
  selectedItemId,
  onSelectItem,
  showMepLayer,
  onToggleMepLayer,
  viewport3DRef,
  onRequestPrintSpecSheet,
}: StudioWorkspaceTabProps) {
  const {
    interiorStudio,
    setActiveInteriorScenario,
    updateInteriorScenarioMeta,
    duplicateInteriorScenario,
    addInteriorFurnitureItem,
    updateInteriorFurnitureItem,
    deleteInteriorFurnitureItem,
    applyInteriorStylePaletteToAllFurniture,
    addInteriorMepPoint,
    updateInteriorMepPoint,
    deleteInteriorMepPoint,
    commitInteriorUndoSnapshot,
    undoInteriorChange,
    redoInteriorChange,
    canUndoInterior,
    canRedoInterior,
    isPrivacyMode,
  } = useFinance();

  const [isCatalogOpen, setIsCatalogOpen] = useState<boolean>(false);
  const [catalogCategoryFilter, setCatalogCategoryFilter] = useState<string>("ALL");
  const [paletteToast, setPaletteToast] = useState<string | null>(null);

  const selectedItem = useMemo(
    () => activeScenario.items.find((i) => i.id === selectedItemId) || null,
    [activeScenario.items, selectedItemId]
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

  const dangerCount = useMemo(
    () => warnings.filter((w) => w.severity === "DANGER").length,
    [warnings]
  );

  // Desktop CAD Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      if (mod && key === "z" && !e.shiftKey) {
        if (canUndoInterior) {
          e.preventDefault();
          undoInteriorChange();
        }
        return;
      }
      if ((mod && key === "z" && e.shiftKey) || (mod && key === "y")) {
        if (canRedoInterior) {
          e.preventDefault();
          redoInteriorChange();
        }
        return;
      }

      if (key === "escape") {
        if (isCatalogOpen) {
          setIsCatalogOpen(false);
        } else if (selectedItemId) {
          onSelectItem(null);
        }
        return;
      }

      if (!selectedItem || selectedItem.isLocked) return;

      if (key === "r" && !mod) {
        e.preventDefault();
        updateInteriorFurnitureItem(selectedItem.id, {
          rotationDeg: (selectedItem.rotationDeg + 90) % 360,
        });
        return;
      }

      if ((e.key === "Delete" || e.key === "Backspace") && !mod) {
        if (selectedItem.source !== "DEVELOPER_INCLUDED") {
          e.preventDefault();
          deleteInteriorFurnitureItem(selectedItem.id);
          onSelectItem(null);
        }
        return;
      }

      const nudgeStep = 0.05; // 5 cm
      let dx = 0;
      let dz = 0;
      if (e.key === "ArrowLeft") dx = -nudgeStep;
      else if (e.key === "ArrowRight") dx = nudgeStep;
      else if (e.key === "ArrowUp") dz = -nudgeStep;
      else if (e.key === "ArrowDown") dz = nudgeStep;

      if (dx !== 0 || dz !== 0) {
        e.preventDefault();
        const nextX = Number(
          Math.max(
            SKYONE_A2_BOUNDS.minX + 0.2,
            Math.min(SKYONE_A2_BOUNDS.maxX - 0.2, selectedItem.position.x + dx)
          ).toFixed(2)
        );
        const nextZ = Number(
          Math.max(
            SKYONE_A2_BOUNDS.minZ + 0.2,
            Math.min(SKYONE_A2_BOUNDS.maxZ - 0.2, selectedItem.position.z + dz)
          ).toFixed(2)
        );
        updateInteriorFurnitureItem(selectedItem.id, { position: { x: nextX, z: nextZ } });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    canUndoInterior,
    canRedoInterior,
    undoInteriorChange,
    redoInteriorChange,
    isCatalogOpen,
    selectedItemId,
    selectedItem,
    onSelectItem,
    updateInteriorFurnitureItem,
    deleteInteriorFurnitureItem,
  ]);

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
    onSelectItem(created.id);
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
      payments: undefined,
    });
    onSelectItem(created.id);
  };

  const handleApplyStyleToAllFurniture = () => {
    const presetMeta = INTERIOR_STYLE_PRESETS[activeScenario.stylePreset];
    applyInteriorStylePaletteToAllFurniture(activeScenario.id, activeScenario.stylePreset);
    setPaletteToast(`Đã đồng bộ vật liệu toàn bộ đồ nội thất theo phong cách ${presetMeta.name}.`);
    window.setTimeout(() => setPaletteToast(null), 3200);
  };

  return (
    <div className="space-y-4">
      {/* Studio Control Strip */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Scenario Selector */}
          <div className="flex flex-wrap items-center gap-2">
            {allScenarioBoqs.map(({ scenario: sc, boq }) => {
              const active = sc.id === activeScenario.id;
              return (
                <button
                  key={sc.id}
                  type="button"
                  onClick={() => {
                    setActiveInteriorScenario(sc.id);
                    onSelectItem(null);
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

          {/* Right Toolbar */}
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700">
              {(
                [
                  { id: "3D", label: "3D", icon: Box },
                  { id: "2D", label: "2D CAD", icon: Layers },
                  { id: "SPLIT", label: "Song song", icon: Columns2 },
                ] as {
                  id: StudioViewportMode;
                  label: string;
                  icon: React.ComponentType<{ className?: string }>;
                }[]
              ).map((m) => {
                const Icon = m.icon;
                const active = viewportMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onChangeViewportMode(m.id)}
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
              onClick={onToggleMepLayer}
              title="Bật/tắt lớp kỹ thuật MEP (Ổ cắm PC, LAN, ống đồng AC, cấp thoát nước)"
              className={`inline-flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                showMepLayer
                  ? "bg-amber-500 border-amber-500 text-slate-950"
                  : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>MEP</span>
            </button>

            <button
              type="button"
              disabled={!canUndoInterior}
              onClick={undoInteriorChange}
              title="Hoàn tác (Ctrl+Z)"
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={!canRedoInterior}
              onClick={redoInteriorChange}
              title="Làm lại (Ctrl+Shift+Z)"
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <Redo2 className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onRequestPrintSpecSheet}
              title="Xuất Hồ sơ Kỹ thuật PDF (Mặt bằng 2D + 3D + BOQ + MEP)"
              className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              <span className="hidden md:inline">Xuất PDF</span>
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

        {/* Second Strip: Style Presets + 1-click Apply All Colors + Live Budget */}
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

            <button
              type="button"
              onClick={handleApplyStyleToAllFurniture}
              title="Đồng bộ vật liệu gỗ/vải cho toàn bộ đồ nội thất mới theo phong cách đang chọn"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold border border-teal-300 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-200 hover:bg-teal-100 dark:hover:bg-teal-900/60 transition-colors cursor-pointer"
            >
              <Paintbrush className="w-3 h-3" />
              <span>Áp màu cho toàn bộ đồ</span>
            </button>
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

        {paletteToast && (
          <div className="px-3 py-2 rounded-lg bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 text-xs font-bold text-teal-800 dark:text-teal-200 flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>{paletteToast}</span>
          </div>
        )}
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
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
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
              ref={viewport3DRef}
              scenario={activeScenario}
              selectedItemId={selectedItemId}
              showMepLayer={showMepLayer}
              onToggleMepLayer={onToggleMepLayer}
              onSelectItem={onSelectItem}
              onItemMoved={(id, x, z) =>
                updateInteriorFurnitureItem(id, { position: { x, z } })
              }
              onFallbackTo2D={() => onChangeViewportMode("2D")}
              className="h-[480px] sm:h-[580px]"
            />
          )}

          {viewportMode === "2D" && (
            <Interior2DBlueprint
              scenario={activeScenario}
              selectedItemId={selectedItemId}
              warnings={warnings}
              showMepLayer={showMepLayer}
              onToggleMepLayer={onToggleMepLayer}
              onSelectItem={onSelectItem}
              onItemMoved={(id, x, z) =>
                updateInteriorFurnitureItem(id, { position: { x, z } })
              }
              onAddMepPoint={addInteriorMepPoint}
              onUpdateMepPoint={updateInteriorMepPoint}
              onDeleteMepPoint={deleteInteriorMepPoint}
            />
          )}

          {viewportMode === "SPLIT" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Interior3DViewport
                ref={viewport3DRef}
                scenario={activeScenario}
                selectedItemId={selectedItemId}
                showMepLayer={showMepLayer}
                onToggleMepLayer={onToggleMepLayer}
                onSelectItem={onSelectItem}
                onItemMoved={(id, x, z) =>
                  updateInteriorFurnitureItem(id, { position: { x, z } })
                }
                onFallbackTo2D={() => onChangeViewportMode("2D")}
                className="h-[460px] sm:h-[540px]"
              />
              <Interior2DBlueprint
                scenario={activeScenario}
                selectedItemId={selectedItemId}
                warnings={warnings}
                showMepLayer={showMepLayer}
                onToggleMepLayer={onToggleMepLayer}
                onSelectItem={onSelectItem}
                onItemMoved={(id, x, z) =>
                  updateInteriorFurnitureItem(id, { position: { x, z } })
                }
                onAddMepPoint={addInteriorMepPoint}
                onUpdateMepPoint={updateInteriorMepPoint}
                onDeleteMepPoint={deleteInteriorMepPoint}
              />
            </div>
          )}
        </div>

        {/* Selected Furniture Inspector */}
        {selectedItem && (
          <FurnitureInspectorPanel
            item={selectedItem}
            interiorStudio={interiorStudio}
            isPrivacyMode={isPrivacyMode}
            onUpdateItem={updateInteriorFurnitureItem}
            onCommitUndoSnapshot={commitInteriorUndoSnapshot}
            onDuplicate={handleDuplicateSelected}
            onDelete={(id) => {
              deleteInteriorFurnitureItem(id);
              onSelectItem(null);
            }}
            onClose={() => onSelectItem(null)}
          />
        )}
      </div>

      {/* Scenario Description & Ergonomic Clearances */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2">
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
          <p className="text-[11px] text-slate-400 dark:text-slate-500 pt-1 border-t border-slate-100 dark:border-slate-800">
            Phím tắt CAD: <strong className="text-slate-600 dark:text-slate-300">R</strong> xoay 90° ·{" "}
            <strong className="text-slate-600 dark:text-slate-300">Mũi tên</strong> dịch 5 cm ·{" "}
            <strong className="text-slate-600 dark:text-slate-300">Ctrl+Z / Ctrl+Y</strong> hoàn tác ·{" "}
            <strong className="text-slate-600 dark:text-slate-300">Del</strong> xóa món chọn
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
              Kiểm tra Công thái học & Vách ngăn (A.12A.07)
            </h3>
            {warnings.length === 0 ? (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" /> Đạt chuẩn lối đi
              </span>
            ) : dangerCount > 0 ? (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                <AlertTriangle className="w-3.5 h-3.5" /> {dangerCount} lỗi đè vách/cửa · {warnings.length} tổng
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                <AlertTriangle className="w-3.5 h-3.5" /> {warnings.length} lưu ý
              </span>
            )}
          </div>
          {warnings.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Tất cả đồ nội thất nằm gọn trong mặt bằng 51.0 m², không đè vách ngăn, không chắn cung mở 90° cửa Lecmax/Master/Phòng 05/WC và đạt chuẩn khoảng nhìn TV & mở tủ.
            </p>
          ) : (
            <div className="space-y-1.5 max-h-28 overflow-y-auto">
              {warnings.map((w) => {
                const isDanger = w.severity === "DANGER";
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => onSelectItem(w.itemId)}
                    className={`w-full text-left text-xs px-2.5 py-1.5 rounded-lg border cursor-pointer transition-colors ${
                      isDanger
                        ? "bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200 hover:bg-rose-100 dark:hover:bg-rose-950/70 font-semibold"
                        : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-950/60"
                    }`}
                  >
                    {w.message}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
