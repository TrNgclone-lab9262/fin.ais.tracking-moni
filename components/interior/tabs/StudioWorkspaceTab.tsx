"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Armchair,
  Box,
  CheckCircle2,
  Columns2,
  Copy,
  Eye,
  FileText,
  Hammer,
  Layers,
  Paintbrush,
  PanelRight,
  Plus,
  Redo2,
  Search,
  Undo2,
  Upload,
  X,
  Zap,
} from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import {
  InteriorCameraSnapshot,
  InteriorDesignScenario,
  InteriorFurnitureItem,
  InteriorMountType,
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
import { saveCustomGlbFile } from "@/lib/interiorGlbVault";
import {
  InteriorArchTarget,
  InteriorInteractionMode,
} from "@/lib/three/interiorSceneController";
import { FullscreenToggle } from "@/components/common/FullscreenToggle";
import {
  Interior3DViewport,
  Interior3DViewportHandle,
} from "@/components/interior/Interior3DViewport";
import { Interior2DBlueprint } from "@/components/interior/Interior2DBlueprint";
import { FurnitureInspectorPanel } from "./FurnitureInspectorPanel";
import { ArchitectureEditorPanel } from "./ArchitectureEditorPanel";

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
  interactionMode: InteriorInteractionMode;
  onChangeInteractionMode: (mode: InteriorInteractionMode) => void;
  selectedArchTarget: InteriorArchTarget | null;
  onSelectArchTarget: (target: InteriorArchTarget | null) => void;
  activeCameraState: InteriorCameraSnapshot | null;
  onSaveCameraState: (snapshot: InteriorCameraSnapshot) => void;
  hiddenItemsCount: number;
  onToggleItemVisibility: (id: string) => void;
  onShowAllHiddenItems: () => void;
  stageRef: React.RefObject<HTMLDivElement | null>;
  isStageFullscreen: boolean;
  onToggleStageFullscreen: () => void;
  onExitStageFullscreen: () => void;
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
  interactionMode,
  onChangeInteractionMode,
  selectedArchTarget,
  onSelectArchTarget,
  activeCameraState,
  onSaveCameraState,
  hiddenItemsCount,
  onToggleItemVisibility,
  onShowAllHiddenItems,
  stageRef,
  isStageFullscreen,
  onToggleStageFullscreen,
  onExitStageFullscreen,
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
    updateInteriorWallOverride,
    updateInteriorDoorOverride,
    updateInteriorFloorPattern,
    updateInteriorLightingZones,
    updateInteriorCurtainOpenRatio,
    commitInteriorUndoSnapshot,
    undoInteriorChange,
    redoInteriorChange,
    canUndoInterior,
    canRedoInterior,
    isPrivacyMode,
  } = useFinance();

  const isFullscreen = isStageFullscreen;
  const toggleFullscreen = onToggleStageFullscreen;
  const exitFullscreen = onExitStageFullscreen;

  const [isCatalogOpen, setIsCatalogOpen] = useState<boolean>(false);
  const [catalogCategoryFilter, setCatalogCategoryFilter] = useState<string>("ALL");
  const [catalogSearch, setCatalogSearch] = useState<string>("");
  const [showGlbForm, setShowGlbForm] = useState<boolean>(false);
  const [paletteToast, setPaletteToast] = useState<string | null>(null);
  const [fsDrawerOpen, setFsDrawerOpen] = useState<boolean>(false);

  // Custom GLB Upload Form State
  const [glbFile, setGlbFile] = useState<File | null>(null);
  const [glbName, setGlbName] = useState<string>("");
  const [glbW, setGlbW] = useState<number>(100);
  const [glbD, setGlbD] = useState<number>(60);
  const [glbH, setGlbH] = useState<number>(80);
  const [glbPrice, setGlbPrice] = useState<number>(3_500_000);
  const [glbMount, setGlbMount] = useState<InteriorMountType>("FLOOR");
  const [glbBusy, setGlbBusy] = useState<boolean>(false);
  const [glbError, setGlbError] = useState<string | null>(null);

  const selectedItem = useMemo(
    () => activeScenario.items.find((i) => i.id === selectedItemId) || null,
    [activeScenario.items, selectedItemId]
  );

  const catalogCategories = useMemo(
    () => ["ALL", ...Array.from(new Set(INTERIOR_CATALOG.map((c) => c.categoryLabel)))],
    []
  );

  const filteredCatalog = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    return INTERIOR_CATALOG.filter((c) => {
      const catOk = catalogCategoryFilter === "ALL" || c.categoryLabel === catalogCategoryFilter;
      if (!catOk) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.categoryLabel.toLowerCase().includes(q) ||
        (c.note || "").toLowerCase().includes(q)
      );
    });
  }, [catalogCategoryFilter, catalogSearch]);

  const dangerCount = useMemo(
    () => warnings.filter((w) => w.severity === "DANGER").length,
    [warnings]
  );

  const handleChangeInteractionMode = (mode: InteriorInteractionMode) => {
    onChangeInteractionMode(mode);
    if (mode === "ARCHITECTURE") {
      onSelectItem(null);
      if (isFullscreen) setFsDrawerOpen(true);
    } else {
      onSelectArchTarget(null);
    }
  };

  // Auto-open fullscreen side drawer when user picks an item or architecture target in fullscreen
  useEffect(() => {
    if (isFullscreen && (selectedItemId || selectedArchTarget)) {
      setFsDrawerOpen(true);
    }
  }, [isFullscreen, selectedItemId, selectedArchTarget]);

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
        } else if (!isFullscreen && selectedItemId) {
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
    isFullscreen,
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
      mountType: tpl.defaultMountType ?? "FLOOR",
      elevationCm: tpl.defaultElevationCm ?? 0,
      note: tpl.note,
    });
    onChangeInteractionMode("FURNITURE");
    onSelectItem(created.id);
    setIsCatalogOpen(false);
  };

  const handleGlbFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0] || null;
    setGlbError(null);
    setGlbFile(picked);
    if (picked) {
      const cleanBase = picked.name.replace(/\.(glb|gltf)$/i, "").replace(/[_-]+/g, " ");
      setGlbName(cleanBase.slice(0, 60));
    }
  };

  const handleImportCustomGlb = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!glbFile) {
      setGlbError("Vui lòng chọn file .glb hoặc .gltf từ máy tính/điện thoại.");
      return;
    }
    setGlbBusy(true);
    setGlbError(null);
    try {
      const saved = await saveCustomGlbFile(glbFile);
      if (!saved.ok || !saved.id) {
        setGlbError(saved.error || "Không thể lưu file 3D vào bộ nhớ cục bộ.");
        return;
      }
      const displayFileName = saved.fileName || glbFile.name;
      const created = addInteriorFurnitureItem({
        catalogKey: "custom_glb_model",
        name: glbName.trim() || displayFileName,
        roomId: "room_living_dining",
        source: "NEW_PURCHASE",
        position: { x: 1.9, z: -0.4 },
        rotationDeg: 0,
        dimensionsCm: {
          width: Math.max(10, Math.min(300, Math.round(glbW) || 100)),
          depth: Math.max(4, Math.min(250, Math.round(glbD) || 60)),
          height: Math.max(4, Math.min(280, Math.round(glbH) || 80)),
        },
        materialFinish: "WARM_OAK",
        pricingRule: "FIXED_UNIT",
        unitPriceVnd: Math.max(0, Math.round(glbPrice) || 0),
        boqGroup: "WOOD_FURNITURE",
        procurementStatus: "PLANNED",
        mountType: glbMount,
        elevationCm: glbMount === "WALL" ? 130 : glbMount === "SURFACE" ? 75 : 0,
        customGlbId: saved.id,
        customGlbName: displayFileName,
        note: `Mô hình 3D cá nhân (${(glbFile.size / (1024 * 1024)).toFixed(2)} MB)`,
      });
      onChangeInteractionMode("FURNITURE");
      onSelectItem(created.id);
      setGlbFile(null);
      setGlbName("");
      setShowGlbForm(false);
      setIsCatalogOpen(false);
      setPaletteToast(`Đã nạp mẫu 3D "${created.name}" vào mặt bằng & bảng dự toán BOQ.`);
      window.setTimeout(() => setPaletteToast(null), 3500);
    } catch (err) {
      setGlbError(err instanceof Error ? err.message : "Không thể nạp file 3D.");
    } finally {
      setGlbBusy(false);
    }
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

  const handleItemMoved = (id: string, x: number, z: number, elevationCm?: number) => {
    if (elevationCm !== undefined) {
      updateInteriorFurnitureItem(id, { position: { x, z }, elevationCm });
    } else {
      updateInteriorFurnitureItem(id, { position: { x, z } });
    }
  };

  const hasSideInspector =
    interactionMode === "ARCHITECTURE" || Boolean(selectedItem);

  const renderInspectorPanel = (panelClassName: string) => {
    if (interactionMode === "ARCHITECTURE") {
      return (
        <ArchitectureEditorPanel
          scenario={activeScenario}
          selectedTarget={selectedArchTarget}
          isPrivacyMode={isPrivacyMode}
          onSelectTarget={onSelectArchTarget}
          onUpdateWallOverride={updateInteriorWallOverride}
          onUpdateDoorOverride={updateInteriorDoorOverride}
          onUpdateFloorPattern={updateInteriorFloorPattern}
          onClose={() => {
            if (isFullscreen) {
              setFsDrawerOpen(false);
            } else {
              onChangeInteractionMode("FURNITURE");
            }
          }}
          className={panelClassName}
        />
      );
    }
    if (selectedItem) {
      return (
        <FurnitureInspectorPanel
          item={selectedItem}
          interiorStudio={interiorStudio}
          isPrivacyMode={isPrivacyMode}
          onUpdateItem={updateInteriorFurnitureItem}
          onCommitUndoSnapshot={commitInteriorUndoSnapshot}
          onToggleVisibility={onToggleItemVisibility}
          onDuplicate={handleDuplicateSelected}
          onDelete={(id) => {
            deleteInteriorFurnitureItem(id);
            onSelectItem(null);
          }}
          onClose={() => {
            if (isFullscreen) {
              setFsDrawerOpen(false);
            } else {
              onSelectItem(null);
            }
          }}
          className={panelClassName}
        />
      );
    }
    return null;
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
              className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-bold border border-dashed border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-teal-500 hover:text-teal-600 whitespace-nowrap cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Nhân bản PA</span>
            </button>
          </div>

          {/* Right Toolbar */}
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Viewport Switcher: 3D / 2D / Split */}
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
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
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

            {/* Interaction Mode: Furniture vs Architecture */}
            <button
              type="button"
              onClick={() =>
                handleChangeInteractionMode(
                  interactionMode === "ARCHITECTURE" ? "FURNITURE" : "ARCHITECTURE"
                )
              }
              title="Tùy biến vách kính, mở thông, lam gỗ, Accent Wall & cửa lùa"
              className={`inline-flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-bold border whitespace-nowrap transition-colors cursor-pointer ${
                interactionMode === "ARCHITECTURE"
                  ? "bg-amber-500 border-amber-500 text-stone-950"
                  : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <Hammer className="w-3.5 h-3.5" />
              <span>Tường & Cửa</span>
            </button>

            <button
              type="button"
              onClick={onToggleMepLayer}
              title="Bật/tắt lớp kỹ thuật MEP (Ổ cắm PC, LAN, ống đồng AC, cấp thoát nước)"
              className={`inline-flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-bold border whitespace-nowrap transition-colors cursor-pointer ${
                showMepLayer
                  ? "bg-orange-500 border-orange-500 text-white"
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
              className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              <span className="hidden md:inline">Xuất PDF</span>
            </button>

            <button
              type="button"
              onClick={() => setIsCatalogOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-extrabold bg-teal-600 hover:bg-teal-700 text-white whitespace-nowrap transition-colors cursor-pointer"
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
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold border whitespace-nowrap transition-colors cursor-pointer ${
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
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold border border-teal-300 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-200 hover:bg-teal-100 dark:hover:bg-teal-900/60 whitespace-nowrap transition-colors cursor-pointer"
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

      {/* Collapsible 46-Item + Custom GLB Catalog Drawer */}
      {isCatalogOpen && (
        <div className="bg-white dark:bg-slate-900 border border-teal-300 dark:border-teal-800 rounded-xl p-4 space-y-3 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                Thư viện {INTERIOR_CATALOG.length} món Nội thất 3D mượt & Cổng nạp .GLB
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Chọn món chuẩn kích thước căn A2 (51m²) hoặc nạp file 3D `.glb / .gltf` cá nhân
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowGlbForm((v) => !v)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border whitespace-nowrap cursor-pointer ${
                  showGlbForm
                    ? "bg-indigo-600 border-indigo-600 text-white"
                    : "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800 text-indigo-800 dark:text-indigo-200 hover:bg-indigo-100"
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{showGlbForm ? "Xem thư viện có sẵn" : "Nạp mẫu 3D (.GLB)"}</span>
              </button>
              <button
                type="button"
                onClick={() => setIsCatalogOpen(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                aria-label="Đóng thư viện nội thất"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {showGlbForm ? (
            <form
              onSubmit={handleImportCustomGlb}
              className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-extrabold text-slate-800 dark:text-slate-100">
                  Nạp mô hình 3D cá nhân (.GLB / .GLTF · tối đa 15 MB · lưu cục bộ trên máy)
                </p>
                <span className="text-[11px] font-semibold text-slate-500">
                  Tự chuẩn hóa kích thước theo W×D×H cm
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                    Chọn file mô hình (.glb / .gltf)
                  </label>
                  <input
                    type="file"
                    accept=".glb,.gltf"
                    onChange={handleGlbFilePicked}
                    className="w-full text-xs file:mr-2.5 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-teal-600 file:text-white hover:file:bg-teal-700 cursor-pointer"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                    Tên hiển thị trong BOQ
                  </label>
                  <input
                    type="text"
                    value={glbName}
                    onChange={(e) => setGlbName(e.target.value)}
                    placeholder="VD: Ghế thư giãn Lounge nhập khẩu"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <label className="space-y-0.5 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                  <span>Rộng W (cm)</span>
                  <input
                    type="number"
                    min={10}
                    max={300}
                    value={glbW}
                    onChange={(e) => setGlbW(Number(e.target.value))}
                    className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold tabular-nums"
                  />
                </label>
                <label className="space-y-0.5 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                  <span>Sâu D (cm)</span>
                  <input
                    type="number"
                    min={4}
                    max={250}
                    value={glbD}
                    onChange={(e) => setGlbD(Number(e.target.value))}
                    className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold tabular-nums"
                  />
                </label>
                <label className="space-y-0.5 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                  <span>Cao H (cm)</span>
                  <input
                    type="number"
                    min={4}
                    max={280}
                    value={glbH}
                    onChange={(e) => setGlbH(Number(e.target.value))}
                    className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold tabular-nums"
                  />
                </label>
                <label className="space-y-0.5 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                  <span>Kiểu neo</span>
                  <select
                    value={glbMount}
                    onChange={(e) => setGlbMount(e.target.value as InteriorMountType)}
                    className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold"
                  >
                    <option value="FLOOR">Đặt sàn</option>
                    <option value="WALL">Gắn tường</option>
                    <option value="SURFACE">Đặt mặt bàn</option>
                  </select>
                </label>
                <label className="space-y-0.5 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                  <span>Đơn giá (VNĐ)</span>
                  <input
                    type="number"
                    min={0}
                    step={100_000}
                    value={glbPrice}
                    onChange={(e) => setGlbPrice(Number(e.target.value))}
                    className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold tabular-nums"
                  />
                </label>
              </div>

              {glbError && (
                <p className="text-xs font-bold text-rose-600 dark:text-rose-400">{glbError}</p>
              )}

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowGlbForm(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={glbBusy || !glbFile}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-extrabold cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{glbBusy ? "Đang nạp 3D..." : "Đặt mô hình vào 3D & BOQ"}</span>
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1.5">
                  {catalogCategories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCatalogCategoryFilter(cat)}
                      className={`px-2.5 py-1 rounded-md text-xs font-bold whitespace-nowrap cursor-pointer ${
                        catalogCategoryFilter === cat
                          ? "bg-teal-600 text-white"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      {cat === "ALL" ? `Tất cả (${INTERIOR_CATALOG.length})` : cat}
                    </button>
                  ))}
                </div>
                <div className="relative min-w-[200px] flex-1 sm:flex-initial">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    placeholder="Tìm bàn nâng hạ, tủ kính, đèn..."
                    className="w-full pl-8 pr-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-80 overflow-y-auto pr-1">
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
                        {tpl.defaultMountType === "WALL"
                          ? " · Gắn tường"
                          : tpl.defaultMountType === "SURFACE"
                            ? " · Đặt mặt bàn"
                            : ""}
                      </p>
                    </div>
                    <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/70 dark:border-slate-700/70">
                      <span className="font-bold text-teal-700 dark:text-teal-300 tabular-nums">
                        {tpl.unitPriceVnd === 0
                          ? "CĐT bàn giao (0 đ)"
                          : `${formatShortVNDMasked(tpl.unitPriceVnd, isPrivacyMode)}${tpl.pricingRule === "PER_LINEAR_METER" ? "/md" : ""}`}
                      </span>
                      <span className="text-teal-600 dark:text-teal-400 font-bold">
                        + Đặt vào 3D
                      </span>
                    </div>
                  </button>
                ))}
                {filteredCatalog.length === 0 && (
                  <p className="col-span-full py-6 text-center text-xs text-slate-500">
                    Không tìm thấy món nội thất phù hợp với từ khóa &ldquo;{catalogSearch}&rdquo;.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Main Spatial Stage (Cross-Device Fullscreen Wrapper) + Side Inspector */}
      <div
        ref={stageRef}
        className={
          isFullscreen
            ? "fixed inset-0 z-50 h-[100dvh] w-[100vw] bg-slate-100 dark:bg-slate-950 flex flex-col overflow-hidden"
            : "grid grid-cols-1 xl:grid-cols-12 gap-4 items-start"
        }
      >
        {/* Compact Floating Top Bar inside Fullscreen Mode */}
        {isFullscreen && (
          <div className="shrink-0 h-12 px-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 overflow-x-auto">
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-black text-slate-900 dark:text-white whitespace-nowrap">
                SKYONE A.12A.07 · {activeScenario.shortLabel}
              </span>
              <span className="hidden md:inline text-xs font-bold text-teal-700 dark:text-teal-300 tabular-nums">
                ({formatShortVNDMasked(activeBoq.grandTotalWithContingency, isPrivacyMode)})
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {/* Viewport switcher in Fullscreen */}
              <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700">
                {(
                  [
                    { id: "3D", label: "3D" },
                    { id: "2D", label: "2D CAD" },
                    { id: "SPLIT", label: "Song song" },
                  ] as { id: StudioViewportMode; label: string }[]
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onChangeViewportMode(m.id)}
                    className={`px-2 py-1 rounded text-[11px] font-bold whitespace-nowrap cursor-pointer ${
                      viewportMode === m.id
                        ? "bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-300 shadow-xs"
                        : "text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() =>
                  handleChangeInteractionMode(
                    interactionMode === "ARCHITECTURE" ? "FURNITURE" : "ARCHITECTURE"
                  )
                }
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold border whitespace-nowrap cursor-pointer ${
                  interactionMode === "ARCHITECTURE"
                    ? "bg-amber-500 border-amber-500 text-stone-950"
                    : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                }`}
              >
                {interactionMode === "ARCHITECTURE" ? (
                  <Hammer className="w-3.5 h-3.5" />
                ) : (
                  <Armchair className="w-3.5 h-3.5" />
                )}
                <span className="hidden sm:inline">
                  {interactionMode === "ARCHITECTURE" ? "Tường & Cửa" : "Nội thất"}
                </span>
              </button>

              <button
                type="button"
                disabled={!canUndoInterior}
                onClick={undoInteriorChange}
                title="Hoàn tác (Ctrl+Z)"
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-40 cursor-pointer"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                disabled={!canRedoInterior}
                onClick={redoInteriorChange}
                title="Làm lại"
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-40 cursor-pointer"
              >
                <Redo2 className="w-3.5 h-3.5" />
              </button>

              {hiddenItemsCount > 0 && (
                <button
                  type="button"
                  onClick={onShowAllHiddenItems}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 whitespace-nowrap cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Hiện {hiddenItemsCount} món ẩn</span>
                </button>
              )}

              {hasSideInspector && (
                <button
                  type="button"
                  onClick={() => setFsDrawerOpen((v) => !v)}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold border whitespace-nowrap cursor-pointer ${
                    fsDrawerOpen
                      ? "bg-teal-600 border-teal-600 text-white"
                      : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                  }`}
                >
                  <PanelRight className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Thuộc tính</span>
                </button>
              )}

              <FullscreenToggle
                variant="compact"
                isFullscreen={isFullscreen}
                onToggle={exitFullscreen}
                labelExit="Thoát (Esc)"
                titleExit="Thu gọn khung Studio (Esc)"
                className="!py-1 !text-[11px]"
              />
            </div>
          </div>
        )}

        {/* Viewport Container */}
        <div
          className={
            isFullscreen
              ? "relative flex-1 min-h-0 flex overflow-hidden"
              : hasSideInspector
                ? "xl:col-span-8"
                : "xl:col-span-12"
          }
        >
          <div className={isFullscreen ? "flex-1 min-w-0 h-full" : "w-full"}>
            {viewportMode === "3D" && (
              <Interior3DViewport
                ref={viewport3DRef}
                scenario={activeScenario}
                selectedItemId={selectedItemId}
                interactionMode={interactionMode}
                onChangeInteractionMode={handleChangeInteractionMode}
                selectedArchTarget={selectedArchTarget}
                onSelectArchTarget={onSelectArchTarget}
                showMepLayer={showMepLayer}
                onToggleMepLayer={onToggleMepLayer}
                onSelectItem={onSelectItem}
                onItemMoved={handleItemMoved}
                onUpdateLightingZones={updateInteriorLightingZones}
                onUpdateCurtainOpenRatio={updateInteriorCurtainOpenRatio}
                initialCameraState={activeCameraState}
                onCameraStateChange={onSaveCameraState}
                isFullscreen={isFullscreen}
                onToggleFullscreen={toggleFullscreen}
                onFallbackTo2D={() => onChangeViewportMode("2D")}
                className={isFullscreen ? "h-full" : "h-[480px] sm:h-[580px]"}
              />
            )}

            {viewportMode === "2D" && (
              <Interior2DBlueprint
                scenario={activeScenario}
                selectedItemId={selectedItemId}
                warnings={warnings}
                showMepLayer={showMepLayer}
                onToggleMepLayer={onToggleMepLayer}
                interactionMode={interactionMode}
                onChangeInteractionMode={handleChangeInteractionMode}
                selectedArchTarget={selectedArchTarget}
                onSelectArchTarget={onSelectArchTarget}
                onSelectItem={onSelectItem}
                onItemMoved={(id, x, z) =>
                  updateInteriorFurnitureItem(id, { position: { x, z } })
                }
                onAddMepPoint={addInteriorMepPoint}
                onUpdateMepPoint={updateInteriorMepPoint}
                onDeleteMepPoint={deleteInteriorMepPoint}
                isFullscreen={isFullscreen}
                onToggleFullscreen={toggleFullscreen}
                className={isFullscreen ? "h-full" : ""}
              />
            )}

            {viewportMode === "SPLIT" && (
              <div
                className={
                  isFullscreen
                    ? "grid grid-cols-1 lg:grid-cols-2 h-full divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800"
                    : "grid grid-cols-1 lg:grid-cols-2 gap-4"
                }
              >
                <Interior3DViewport
                  ref={viewport3DRef}
                  scenario={activeScenario}
                  selectedItemId={selectedItemId}
                  interactionMode={interactionMode}
                  onChangeInteractionMode={handleChangeInteractionMode}
                  selectedArchTarget={selectedArchTarget}
                  onSelectArchTarget={onSelectArchTarget}
                  showMepLayer={showMepLayer}
                  onToggleMepLayer={onToggleMepLayer}
                  onSelectItem={onSelectItem}
                  onItemMoved={handleItemMoved}
                  onUpdateLightingZones={updateInteriorLightingZones}
                  onUpdateCurtainOpenRatio={updateInteriorCurtainOpenRatio}
                  initialCameraState={activeCameraState}
                  onCameraStateChange={onSaveCameraState}
                  isFullscreen={isFullscreen}
                  onToggleFullscreen={toggleFullscreen}
                  onFallbackTo2D={() => onChangeViewportMode("2D")}
                  className={isFullscreen ? "h-full min-h-0" : "h-[460px] sm:h-[540px]"}
                />
                <Interior2DBlueprint
                  scenario={activeScenario}
                  selectedItemId={selectedItemId}
                  warnings={warnings}
                  showMepLayer={showMepLayer}
                  onToggleMepLayer={onToggleMepLayer}
                  interactionMode={interactionMode}
                  onChangeInteractionMode={handleChangeInteractionMode}
                  selectedArchTarget={selectedArchTarget}
                  onSelectArchTarget={onSelectArchTarget}
                  onSelectItem={onSelectItem}
                  onItemMoved={(id, x, z) =>
                    updateInteriorFurnitureItem(id, { position: { x, z } })
                  }
                  onAddMepPoint={addInteriorMepPoint}
                  onUpdateMepPoint={updateInteriorMepPoint}
                  onDeleteMepPoint={deleteInteriorMepPoint}
                  isFullscreen={isFullscreen}
                  onToggleFullscreen={toggleFullscreen}
                  className={isFullscreen ? "h-full min-h-0" : ""}
                />
              </div>
            )}
          </div>

          {/* Slide-over Inspector Drawer in Fullscreen Mode */}
          {isFullscreen && fsDrawerOpen && hasSideInspector && (
            <div className="w-80 sm:w-96 shrink-0 h-full overflow-y-auto border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
              {renderInspectorPanel("w-full border-0 p-1")}
            </div>
          )}
        </div>

        {/* Standard Side Inspector (Non-Fullscreen) */}
        {!isFullscreen && renderInspectorPanel("xl:col-span-4")}
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
            <strong className="text-slate-600 dark:text-slate-300">Esc</strong> thoát toàn màn hình
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
              Tất cả đồ nội thất nằm gọn trong mặt bằng 51.0 m², không đè vách ngăn hay hộp gen kỹ thuật, không chắn cung mở 90° cửa Lecmax/Master/Phòng 05/WC và đạt chuẩn khoảng nhìn TV & mở tủ.
            </p>
          ) : (
            <div className="space-y-1.5 max-h-28 overflow-y-auto">
              {warnings.map((w) => {
                const isDanger = w.severity === "DANGER";
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => {
                      onChangeInteractionMode("FURNITURE");
                      onSelectItem(w.itemId);
                    }}
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
