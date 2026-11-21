"use client";

import React, { useMemo, useRef, useState } from "react";
import {
  Layers,
  Eye,
  EyeOff,
  Lock,
  Magnet,
  Ruler,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Zap,
  Plus,
  Trash2,
  X,
  Scan,
  Armchair,
  Hammer,
} from "lucide-react";
import { FullscreenToggle } from "@/components/common/FullscreenToggle";
import {
  InteriorDesignScenario,
  InteriorFurnitureItem,
  InteriorMepPoint,
  InteriorMepPointKind,
} from "@/types/finance";
import {
  MATERIAL_FINISH_META,
  MEP_KIND_META,
  SKYONE_A2_BOUNDS,
  SKYONE_A2_OPENINGS,
  SKYONE_A2_ROOMS,
  SKYONE_A2_SHAFTS,
  SKYONE_A2_WALLS,
  WALL_ACCENT_META,
  createDefaultSkyOneA2MepPoints,
} from "@/lib/interiorFloorplan";
import { ErgonomicWarning } from "@/lib/interiorBoqEngine";
import {
  computeClearanceZones,
  computeSmartGuides,
  snapPositionToWalls,
} from "@/lib/interiorCadEngine";
import {
  InteriorArchTarget,
  InteriorInteractionMode,
} from "@/lib/three/interiorSceneController";

interface Interior2DBlueprintProps {
  scenario: InteriorDesignScenario;
  selectedItemId: string | null;
  warnings: ErgonomicWarning[];
  showMepLayer: boolean;
  onToggleMepLayer: () => void;
  interactionMode?: InteriorInteractionMode;
  onChangeInteractionMode?: (mode: InteriorInteractionMode) => void;
  selectedArchTarget?: InteriorArchTarget | null;
  onSelectArchTarget?: (target: InteriorArchTarget | null) => void;
  onSelectItem: (id: string | null) => void;
  onItemMoved: (id: string, x: number, z: number) => void;
  onAddMepPoint?: (point: Omit<InteriorMepPoint, "id">) => InteriorMepPoint;
  onUpdateMepPoint?: (
    id: string,
    patch: Partial<InteriorMepPoint>,
    options?: { skipUndoHistory?: boolean }
  ) => void;
  onDeleteMepPoint?: (id: string) => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  className?: string;
}

const SCALE = 84; // 84px per meter
const PAD = 42;
const VIEW_W = SKYONE_A2_BOUNDS.totalWidth * SCALE + PAD * 2;
const VIEW_H = SKYONE_A2_BOUNDS.totalDepth * SCALE + PAD * 2;

function worldToSvgX(x: number): number {
  return (x - SKYONE_A2_BOUNDS.minX) * SCALE + PAD;
}

function worldToSvgY(z: number): number {
  return (z - SKYONE_A2_BOUNDS.minZ) * SCALE + PAD;
}

function svgToWorldX(px: number): number {
  return (px - PAD) / SCALE + SKYONE_A2_BOUNDS.minX;
}

function svgToWorldZ(py: number): number {
  return (py - PAD) / SCALE + SKYONE_A2_BOUNDS.minZ;
}

function buildDoorSwingPath(
  hingeX: number,
  hingeZ: number,
  radius: number,
  startAngleDeg: number,
  endAngleDeg: number
): string {
  const hx = worldToSvgX(hingeX);
  const hy = worldToSvgY(hingeZ);
  const rPx = radius * SCALE;
  const a1 = (startAngleDeg * Math.PI) / 180;
  const a2 = (endAngleDeg * Math.PI) / 180;
  const x1 = hx + Math.cos(a1) * rPx;
  const y1 = hy + Math.sin(a1) * rPx;
  const x2 = hx + Math.cos(a2) * rPx;
  const y2 = hy + Math.sin(a2) * rPx;
  return `M ${hx} ${hy} L ${x1} ${y1} A ${rPx} ${rPx} 0 0 1 ${x2} ${y2} Z`;
}

function findRoomIdForCoord(x: number, z: number): string {
  for (const room of SKYONE_A2_ROOMS) {
    if (
      x >= room.x - room.width / 2 &&
      x <= room.x + room.width / 2 &&
      z >= room.z - room.depth / 2 &&
      z <= room.z + room.depth / 2
    ) {
      return room.id;
    }
  }
  return "room_living_dining";
}

type UnderlayMode = "NONE" | "CAD_A2" | "TOP_RENDER";
type CadToolMode = "SELECT" | "MEASURE" | "ADD_MEP";

export function Interior2DBlueprint({
  scenario,
  selectedItemId,
  warnings,
  showMepLayer,
  onToggleMepLayer,
  interactionMode = "FURNITURE",
  onChangeInteractionMode,
  selectedArchTarget = null,
  onSelectArchTarget,
  onSelectItem,
  onItemMoved,
  onAddMepPoint,
  onUpdateMepPoint,
  onDeleteMepPoint,
  isFullscreen = false,
  onToggleFullscreen,
  className = "",
}: Interior2DBlueprintProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [underlay, setUnderlay] = useState<UnderlayMode>("NONE");
  const [underlayOpacity, setUnderlayOpacity] = useState<number>(0.35);
  const [snapToWall, setSnapToWall] = useState<boolean>(true);
  const [showClearances, setShowClearances] = useState<boolean>(true);
  const [toolMode, setToolMode] = useState<CadToolMode>("SELECT");
  const [newMepKind, setNewMepKind] = useState<InteriorMepPointKind>("OUTLET_DOUBLE");
  const [selectedMepId, setSelectedMepId] = useState<string | null>(null);

  // Zoom & Pan (viewBox centered)
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [panning, setPanning] = useState<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startPanX: number;
    startPanY: number;
  } | null>(null);

  // 2-Point Tape Measure state (world meters)
  const [measurePts, setMeasurePts] = useState<{
    p1: { x: number; z: number } | null;
    p2: { x: number; z: number } | null;
  }>({ p1: null, p2: null });

  // Furniture dragging
  const [dragging, setDragging] = useState<{
    pointerId: number;
    id: string;
    item: InteriorFurnitureItem;
    offsetX: number;
    offsetZ: number;
    curX: number;
    curZ: number;
    snappedX: boolean;
    snappedZ: boolean;
  } | null>(null);

  // MEP dragging
  const [draggingMep, setDraggingMep] = useState<{
    pointerId: number;
    id: string;
    curX: number;
    curZ: number;
  } | null>(null);

  const mepPoints = useMemo(
    () => scenario.mepPoints ?? createDefaultSkyOneA2MepPoints(),
    [scenario.mepPoints]
  );

  const selectedMep = useMemo(
    () => mepPoints.find((m) => m.id === selectedMepId) || null,
    [mepPoints, selectedMepId]
  );

  const warningSeverityByItem = useMemo(() => {
    const map = new Map<string, "WARNING" | "DANGER">();
    for (const w of warnings) {
      const prev = map.get(w.itemId);
      if (!prev || w.severity === "DANGER") {
        map.set(w.itemId, w.severity);
      }
    }
    return map;
  }, [warnings]);

  const clearanceZones = useMemo(() => computeClearanceZones(scenario), [scenario]);

  // Compute current viewBox from zoom & pan
  const vbW = VIEW_W / zoom;
  const vbH = VIEW_H / zoom;
  const vbX = (VIEW_W - vbW) / 2 + pan.x;
  const vbY = (VIEW_H - vbH) / 2 + pan.y;

  const clientToSvgCoords = (clientX: number, clientY: number): { x: number; y: number } => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const normX = (clientX - rect.left) / Math.max(1, rect.width);
    const normY = (clientY - rect.top) / Math.max(1, rect.height);
    return {
      x: vbX + normX * vbW,
      y: vbY + normY * vbH,
    };
  };

  const smartGuides = useMemo(() => {
    if (!dragging) return [];
    return computeSmartGuides(
      dragging.item,
      { x: dragging.curX, z: dragging.curZ },
      scenario.wallOverrides
    );
  }, [dragging, scenario.wallOverrides]);

  const handleItemPointerDown = (
    e: React.PointerEvent<SVGGElement>,
    item: InteriorFurnitureItem
  ) => {
    if (toolMode !== "SELECT" || interactionMode === "ARCHITECTURE") return;
    e.stopPropagation();
    setSelectedMepId(null);
    onSelectItem(item.id);
    if (item.isLocked) return;

    const { x, y } = clientToSvgCoords(e.clientX, e.clientY);
    const wx = svgToWorldX(x);
    const wz = svgToWorldZ(y);

    svgRef.current?.setPointerCapture?.(e.pointerId);
    setDragging({
      pointerId: e.pointerId,
      id: item.id,
      item,
      offsetX: item.position.x - wx,
      offsetZ: item.position.z - wz,
      curX: item.position.x,
      curZ: item.position.z,
      snappedX: false,
      snappedZ: false,
    });
  };

  const handleMepPointerDown = (
    e: React.PointerEvent<SVGGElement>,
    pt: InteriorMepPoint
  ) => {
    if (toolMode === "MEASURE") return;
    e.stopPropagation();
    onSelectItem(null);
    setSelectedMepId(pt.id);
    svgRef.current?.setPointerCapture?.(e.pointerId);
    setDraggingMep({
      pointerId: e.pointerId,
      id: pt.id,
      curX: pt.x,
      curZ: pt.z,
    });
  };

  const handleSvgPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const { x, y } = clientToSvgCoords(e.clientX, e.clientY);
    const wx = Number(
      Math.max(SKYONE_A2_BOUNDS.minX, Math.min(SKYONE_A2_BOUNDS.maxX, svgToWorldX(x))).toFixed(2)
    );
    const wz = Number(
      Math.max(SKYONE_A2_BOUNDS.minZ, Math.min(SKYONE_A2_BOUNDS.maxZ, svgToWorldZ(y))).toFixed(2)
    );

    if (toolMode === "MEASURE") {
      setMeasurePts((prev) => {
        if (!prev.p1 || prev.p2) {
          return { p1: { x: wx, z: wz }, p2: null };
        }
        return { p1: prev.p1, p2: { x: wx, z: wz } };
      });
      return;
    }

    if (toolMode === "ADD_MEP" && onAddMepPoint) {
      const meta = MEP_KIND_META[newMepKind];
      const created = onAddMepPoint({
        kind: newMepKind,
        label: meta.shortLabel,
        roomId: findRoomIdForCoord(wx, wz),
        x: Math.round(wx * 20) / 20,
        z: Math.round(wz * 20) / 20,
        heightCm: meta.defaultHeightCm,
      });
      if (!showMepLayer) onToggleMepLayer();
      setSelectedMepId(created.id);
      setToolMode("SELECT");
      return;
    }

    // Pan when zoomed in and clicking background
    if (zoom > 1.02) {
      svgRef.current?.setPointerCapture?.(e.pointerId);
      setPanning({
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startPanX: pan.x,
        startPanY: pan.y,
      });
    } else {
      onSelectItem(null);
      setSelectedMepId(null);
      if (interactionMode === "ARCHITECTURE") {
        onSelectArchTarget?.(null);
      }
    }
  };

  const handleSvgPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (dragging) {
      const { x, y } = clientToSvgCoords(e.clientX, e.clientY);
      const rawX = svgToWorldX(x) + dragging.offsetX;
      const rawZ = svgToWorldZ(y) + dragging.offsetZ;
      const snapped = snapPositionToWalls(dragging.item, rawX, rawZ, {
        snapToWall,
        wallOverrides: scenario.wallOverrides,
      });
      setDragging((prev) =>
        prev
          ? {
              ...prev,
              curX: snapped.x,
              curZ: snapped.z,
              snappedX: snapped.snappedX,
              snappedZ: snapped.snappedZ,
            }
          : null
      );
      return;
    }

    if (draggingMep) {
      const { x, y } = clientToSvgCoords(e.clientX, e.clientY);
      const wx = Math.max(
        SKYONE_A2_BOUNDS.minX + 0.1,
        Math.min(SKYONE_A2_BOUNDS.maxX - 0.1, Math.round(svgToWorldX(x) * 20) / 20)
      );
      const wz = Math.max(
        SKYONE_A2_BOUNDS.minZ + 0.1,
        Math.min(SKYONE_A2_BOUNDS.maxZ - 0.1, Math.round(svgToWorldZ(y) * 20) / 20)
      );
      setDraggingMep((prev) => (prev ? { ...prev, curX: wx, curZ: wz } : null));
      return;
    }

    if (panning) {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const dxSvg = ((e.clientX - panning.startClientX) / Math.max(1, rect.width)) * vbW;
      const dySvg = ((e.clientY - panning.startClientY) / Math.max(1, rect.height)) * vbH;
      const maxPanX = (VIEW_W - vbW) / 2 + 40;
      const maxPanY = (VIEW_H - vbH) / 2 + 40;
      setPan({
        x: Math.max(-maxPanX, Math.min(maxPanX, panning.startPanX - dxSvg)),
        y: Math.max(-maxPanY, Math.min(maxPanY, panning.startPanY - dySvg)),
      });
    }
  };

  const handleSvgPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    try {
      svgRef.current?.releasePointerCapture?.(e.pointerId);
    } catch {
      // ignore
    }

    if (dragging) {
      onItemMoved(
        dragging.id,
        Number(dragging.curX.toFixed(2)),
        Number(dragging.curZ.toFixed(2))
      );
      setDragging(null);
      return;
    }

    if (draggingMep) {
      onUpdateMepPoint?.(draggingMep.id, {
        x: Number(draggingMep.curX.toFixed(2)),
        z: Number(draggingMep.curZ.toFixed(2)),
        roomId: findRoomIdForCoord(draggingMep.curX, draggingMep.curZ),
      });
      setDraggingMep(null);
      return;
    }

    if (panning) {
      setPanning(null);
    }
  };

  const roomFill = (mat: string, roomId: string) => {
    const isHerringbone = scenario.roomFloorOverrides?.[roomId] === "HERRINGBONE";
    switch (mat) {
      case "WOOD_TILE":
        return isHerringbone ? "url(#herringboneWood)" : "#F3E4D2";
      case "BATH_MARBLE":
        return "#EEF2F6";
      case "LOGGIA_GREY":
        return "#E2E6EC";
      default:
        return "#F7F4EE";
    }
  };

  const measuredDistanceCm =
    measurePts.p1 && measurePts.p2
      ? Math.round(
          Math.hypot(measurePts.p2.x - measurePts.p1.x, measurePts.p2.z - measurePts.p1.z) * 100
        )
      : null;

  return (
    <div
      className={`bg-white dark:bg-slate-900 overflow-hidden flex flex-col ${
        isFullscreen
          ? "w-full h-full rounded-none border-0"
          : "rounded-xl border border-slate-200 dark:border-slate-800"
      } ${className}`}
    >
      {/* Top 2D CAD Toolbar */}
      <div className="px-3.5 py-2.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 bg-slate-50/80 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="inline-flex items-center gap-1.5 mr-1">
            <Layers className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100">
              2D CAD
            </span>
          </div>

          {onChangeInteractionMode && (
            <div className="inline-flex rounded-lg bg-slate-200/70 dark:bg-slate-800 p-0.5">
              <button
                type="button"
                onClick={() => onChangeInteractionMode("FURNITURE")}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold whitespace-nowrap cursor-pointer ${
                  interactionMode === "FURNITURE"
                    ? "bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-300 shadow-xs"
                    : "text-slate-600 dark:text-slate-400"
                }`}
              >
                <Armchair className="w-3 h-3" />
                <span>Nội thất</span>
              </button>
              <button
                type="button"
                onClick={() => onChangeInteractionMode("ARCHITECTURE")}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold whitespace-nowrap cursor-pointer ${
                  interactionMode === "ARCHITECTURE"
                    ? "bg-amber-500 text-stone-950 shadow-xs"
                    : "text-slate-600 dark:text-slate-400"
                }`}
              >
                <Hammer className="w-3 h-3" />
                <span>Tường & Cửa</span>
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setSnapToWall((v) => !v)}
            title="Tự động hít sát tường (<= 12 cm)"
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold border whitespace-nowrap transition-colors cursor-pointer ${
              snapToWall
                ? "bg-teal-600 border-teal-600 text-white"
                : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
            }`}
          >
            <Magnet className="w-3 h-3" />
            <span>Hít tường</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const next = toolMode === "MEASURE" ? "SELECT" : "MEASURE";
              setToolMode(next);
              setMeasurePts({ p1: null, p2: null });
            }}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold border whitespace-nowrap transition-colors cursor-pointer ${
              toolMode === "MEASURE"
                ? "bg-amber-500 border-amber-500 text-stone-950"
                : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
            }`}
          >
            <Ruler className="w-3 h-3" />
            <span>Thước đo</span>
          </button>

          <button
            type="button"
            onClick={() => setShowClearances((v) => !v)}
            title="Hiển thị cung cửa 90°, vùng mở cánh tủ 60cm & lùi ghế 80cm"
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold border whitespace-nowrap transition-colors cursor-pointer ${
              showClearances
                ? "bg-slate-900 dark:bg-slate-200 border-slate-900 dark:border-slate-200 text-white dark:text-slate-950"
                : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
            }`}
          >
            <Scan className="w-3 h-3" />
            <span className="hidden sm:inline">Vùng thao tác</span>
          </button>

          <button
            type="button"
            onClick={onToggleMepLayer}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold border whitespace-nowrap transition-colors cursor-pointer ${
              showMepLayer
                ? "bg-orange-500 border-orange-500 text-white"
                : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
            }`}
          >
            <Zap className="w-3 h-3" />
            <span>MEP ({mepPoints.length})</span>
          </button>

          {onAddMepPoint && (
            <button
              type="button"
              onClick={() => {
                if (toolMode === "ADD_MEP") {
                  setToolMode("SELECT");
                } else {
                  if (!showMepLayer) onToggleMepLayer();
                  setToolMode("ADD_MEP");
                }
              }}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold border whitespace-nowrap transition-colors cursor-pointer ${
                toolMode === "ADD_MEP"
                  ? "bg-blue-600 border-blue-600 text-white"
                  : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
              }`}
            >
              <Plus className="w-3 h-3" />
              <span>Thêm MEP</span>
            </button>
          )}
        </div>

        {/* Right: Zoom, Underlay & Fullscreen controls */}
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.75, Number((z - 0.25).toFixed(2))))}
              aria-label="Thu nhỏ bản vẽ 2D"
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-1.5 text-[10px] font-bold tabular-nums text-slate-600 dark:text-slate-300">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(2.4, Number((z + 0.25).toFixed(2))))}
              aria-label="Phóng to bản vẽ 2D"
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            {(zoom !== 1 || pan.x !== 0 || pan.y !== 0) && (
              <button
                type="button"
                onClick={() => {
                  setZoom(1);
                  setPan({ x: 0, y: 0 });
                }}
                aria-label="Đặt lại khung nhìn 2D"
                className="p-1.5 border-l border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-teal-600 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setUnderlay(underlay === "CAD_A2" ? "NONE" : "CAD_A2")}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold border whitespace-nowrap transition-colors cursor-pointer ${
              underlay === "CAD_A2"
                ? "bg-teal-600 border-teal-600 text-white"
                : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
            }`}
          >
            {underlay === "CAD_A2" ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            <span className="hidden sm:inline">Nền CAD</span>
          </button>
          <button
            type="button"
            onClick={() => setUnderlay(underlay === "TOP_RENDER" ? "NONE" : "TOP_RENDER")}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold border whitespace-nowrap transition-colors cursor-pointer ${
              underlay === "TOP_RENDER"
                ? "bg-teal-600 border-teal-600 text-white"
                : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
            }`}
          >
            {underlay === "TOP_RENDER" ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            <span className="hidden sm:inline">Nền CĐT</span>
          </button>
          {underlay !== "NONE" && (
            <input
              type="range"
              min={0.15}
              max={0.75}
              step={0.05}
              value={underlayOpacity}
              onChange={(e) => setUnderlayOpacity(Number(e.target.value))}
              aria-label="Độ mờ ảnh nền mặt bằng"
              className="w-16 accent-teal-600"
            />
          )}

          {onToggleFullscreen && (
            <FullscreenToggle
              variant="compact"
              isFullscreen={isFullscreen}
              onToggle={onToggleFullscreen}
              titleEnter="Xem toàn màn hình bản vẽ 2D CAD"
              titleExit="Thu gọn toàn màn hình (Esc)"
              className="!py-1 !px-2 !text-[11px]"
            />
          )}
        </div>
      </div>

      {/* Contextual Sub-Bar: Architecture Mode Hint */}
      {interactionMode === "ARCHITECTURE" && toolMode === "SELECT" && (
        <div className="px-3.5 py-2 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-bold text-amber-900 dark:text-amber-200">
            Chế độ Tường & Cửa · Chạm vào bất kỳ mảng tường hoặc cửa đi nào trên bản vẽ 2D để tùy biến kết cấu, Accent Wall hoặc cửa lùa.
          </span>
          {onChangeInteractionMode && (
            <button
              type="button"
              onClick={() => onChangeInteractionMode("FURNITURE")}
              className="text-[11px] font-bold text-amber-800 dark:text-amber-300 underline cursor-pointer"
            >
              Về chế độ Nội thất
            </button>
          )}
        </div>
      )}

      {/* Contextual Sub-Bar: Tape Measure OR Add MEP Picker */}
      {toolMode === "MEASURE" && (
        <div className="px-3.5 py-2 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-bold text-amber-900 dark:text-amber-200">
            {measuredDistanceCm !== null
              ? `Khoảng cách đo được: ${measuredDistanceCm} cm (${(measuredDistanceCm / 100).toFixed(2)} m)`
              : measurePts.p1
                ? "Chạm điểm thứ 2 trên mặt bằng để đo khoảng cách..."
                : "Chạm điểm bắt đầu bất kỳ trên mặt bằng để đo khoảng cách (cm)"}
          </span>
          <button
            type="button"
            onClick={() => {
              setMeasurePts({ p1: null, p2: null });
              setToolMode("SELECT");
            }}
            className="text-[11px] font-bold text-amber-800 dark:text-amber-300 underline cursor-pointer"
          >
            Thoát thước đo
          </button>
        </div>
      )}

      {toolMode === "ADD_MEP" && (
        <div className="px-3.5 py-2 bg-blue-50 dark:bg-blue-950/40 border-b border-blue-200 dark:border-blue-900 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-bold text-blue-900 dark:text-blue-200">
              Chọn loại điểm MEP rồi chạm vào mặt bằng để đặt:
            </span>
            {(Object.keys(MEP_KIND_META) as InteriorMepPointKind[]).map((kind) => {
              const meta = MEP_KIND_META[kind];
              const active = newMepKind === kind;
              return (
                <button
                  key={kind}
                  type="button"
                  onClick={() => setNewMepKind(kind)}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold border cursor-pointer ${
                    active
                      ? "bg-blue-600 border-blue-600 text-white"
                      : "bg-white dark:bg-slate-800 border-blue-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                  }`}
                >
                  {meta.shortLabel}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setToolMode("SELECT")}
            className="text-[11px] font-bold text-blue-800 dark:text-blue-300 underline cursor-pointer"
          >
            Hủy
          </button>
        </div>
      )}

      {/* Selected MEP Quick Editor Bar */}
      {selectedMep && showMepLayer && (
        <div className="px-3.5 py-2 bg-orange-50/80 dark:bg-orange-950/30 border-b border-orange-200 dark:border-orange-900/70 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[200px]">
            <span
              className="px-1.5 py-0.5 rounded text-[10px] font-black text-white"
              style={{ backgroundColor: MEP_KIND_META[selectedMep.kind].colorHex }}
            >
              {MEP_KIND_META[selectedMep.kind].symbol}
            </span>
            <input
              type="text"
              value={selectedMep.label}
              onChange={(e) => onUpdateMepPoint?.(selectedMep.id, { label: e.target.value })}
              aria-label="Tên điểm MEP"
              className="px-2 py-1 rounded border border-orange-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100 w-44"
            />
            <label className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
              <span>Cao độ:</span>
              <input
                type="number"
                min={10}
                max={260}
                step={5}
                value={selectedMep.heightCm}
                onChange={(e) =>
                  onUpdateMepPoint?.(selectedMep.id, {
                    heightCm: Math.max(10, Math.min(260, Number(e.target.value) || 40)),
                  })
                }
                className="w-14 px-1.5 py-0.5 rounded border border-orange-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold tabular-nums"
              />
              <span>cm</span>
            </label>
          </div>
          <div className="flex items-center gap-1.5">
            {onDeleteMepPoint && (
              <button
                type="button"
                onClick={() => {
                  onDeleteMepPoint(selectedMep.id);
                  setSelectedMepId(null);
                }}
                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-[11px] font-bold cursor-pointer"
              >
                <Trash2 className="w-3 h-3" /> Xóa
              </button>
            )}
            <button
              type="button"
              onClick={() => setSelectedMepId(null)}
              className="p-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Interactive SVG Canvas */}
      <div className="relative flex-1 min-h-0 bg-slate-100/80 dark:bg-slate-950 p-2 flex items-center justify-center overflow-hidden">
        <svg
          ref={svgRef}
          viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
          className={`w-full select-none touch-none ${
            isFullscreen ? "h-full max-h-full" : "h-auto max-h-[540px]"
          } ${
            toolMode === "MEASURE" || toolMode === "ADD_MEP"
              ? "cursor-crosshair"
              : zoom > 1.02
                ? "cursor-move"
                : "cursor-default"
          }`}
          onPointerDown={handleSvgPointerDown}
          onPointerMove={handleSvgPointerMove}
          onPointerUp={handleSvgPointerUp}
          onPointerCancel={handleSvgPointerUp}
        >
          <defs>
            <pattern
              id="grid50cm"
              width={SCALE / 2}
              height={SCALE / 2}
              patternUnits="userSpaceOnUse"
            >
              <path
                d={`M ${SCALE / 2} 0 L 0 0 0 ${SCALE / 2}`}
                fill="none"
                stroke="#CBD5E1"
                strokeWidth="0.6"
                strokeOpacity="0.45"
              />
            </pattern>
            <pattern
              id="shaftHatch"
              width="8"
              height="8"
              patternTransform="rotate(45 0 0)"
              patternUnits="userSpaceOnUse"
            >
              <rect width="8" height="8" fill="#CBD5E1" />
              <line x1="0" y1="0" x2="0" y2="8" stroke="#475569" strokeWidth="2.2" />
            </pattern>
            <pattern
              id="herringboneWood"
              width="14"
              height="14"
              patternUnits="userSpaceOnUse"
            >
              <rect width="14" height="14" fill="#EBD3B9" />
              <path
                d="M 0 7 L 7 0 L 14 7 M 0 14 L 7 7 L 14 14"
                fill="none"
                stroke="#C99E72"
                strokeWidth="0.9"
                strokeOpacity="0.65"
              />
            </pattern>
          </defs>
          <rect x="0" y="0" width={VIEW_W} height={VIEW_H} fill="url(#grid50cm)" />

          {/* Room Zones (01..08) */}
          {SKYONE_A2_ROOMS.map((room) => {
            const rx = worldToSvgX(room.x - room.width / 2);
            const ry = worldToSvgY(room.z - room.depth / 2);
            const rw = room.width * SCALE;
            const rh = room.depth * SCALE;
            return (
              <g key={room.id}>
                <rect
                  x={rx}
                  y={ry}
                  width={rw}
                  height={rh}
                  fill={roomFill(room.floorMaterial, room.id)}
                  stroke="#CBD5E1"
                  strokeWidth="1"
                />
                <text
                  x={rx + rw / 2}
                  y={ry + rh / 2 - 4}
                  textAnchor="middle"
                  fill="#64748B"
                  fontSize="10"
                  fontWeight="800"
                  pointerEvents="none"
                >
                  {room.code} · {room.shortName}
                </text>
              </g>
            );
          })}

          {/* Optional Underlay Reference Image */}
          {underlay !== "NONE" && (
            <image
              href={
                underlay === "CAD_A2"
                  ? "/assets/aistudio/image_25391d5d.png"
                  : "/assets/aistudio/mat-bang-noi-that-2D_6b5776c8.jpg"
              }
              x={PAD - 16}
              y={PAD - 14}
              width={SKYONE_A2_BOUNDS.totalWidth * SCALE + 32}
              height={SKYONE_A2_BOUNDS.totalDepth * SCALE + 28}
              preserveAspectRatio="xMidYMid meet"
              opacity={underlayOpacity}
              pointerEvents="none"
            />
          )}

          {/* Structural MEP Technical Shafts (Hộp gen kỹ thuật CĐT) */}
          {SKYONE_A2_SHAFTS.map((shaft) => {
            const sx = worldToSvgX(shaft.x - shaft.width / 2);
            const sy = worldToSvgY(shaft.z - shaft.depth / 2);
            const sw = shaft.width * SCALE;
            const sh = shaft.depth * SCALE;
            return (
              <g key={shaft.id} pointerEvents="none">
                <rect
                  x={sx}
                  y={sy}
                  width={sw}
                  height={sh}
                  fill="url(#shaftHatch)"
                  stroke="#334155"
                  strokeWidth="1.4"
                />
                <title>{shaft.label}</title>
              </g>
            );
          })}

          {/* Ergonomic Clearance Zones (Wardrobe 60cm & Desk chair pull-back 80cm) */}
          {showClearances &&
            clearanceZones.map((cz) => {
              const cx = worldToSvgX(cz.cx);
              const cy = worldToSvgY(cz.cz);
              const rw = cz.widthM * SCALE;
              const rh = cz.depthM * SCALE;
              const isWardrobe = cz.kind === "WARDROBE_SWING";
              return (
                <g
                  key={cz.id}
                  transform={`translate(${cx}, ${cy}) rotate(${-cz.rotationDeg})`}
                  pointerEvents="none"
                >
                  <rect
                    x={-rw / 2}
                    y={-rh / 2}
                    width={rw}
                    height={rh}
                    rx={3}
                    fill={isWardrobe ? "#0EA5E9" : "#10B981"}
                    fillOpacity={0.11}
                    stroke={isWardrobe ? "#0284C7" : "#059669"}
                    strokeWidth={1}
                    strokeDasharray="4 3"
                  />
                  <text
                    x="0"
                    y="3"
                    textAnchor="middle"
                    fill={isWardrobe ? "#0369A1" : "#047857"}
                    fontSize="7.5"
                    fontWeight="700"
                  >
                    {cz.label}
                  </text>
                </g>
              );
            })}

          {/* Door 90° Swing Arcs (only for SWING_90 mode) */}
          {showClearances &&
            SKYONE_A2_OPENINGS.filter((op) => {
              if (!op.swingArc) return false;
              const mode = scenario.doorOverrides?.[op.id] ?? "SWING_90";
              return mode === "SWING_90";
            }).map((op) => {
              const sa = op.swingArc!;
              return (
                <path
                  key={`arc_${op.id}`}
                  d={buildDoorSwingPath(
                    sa.hingeX,
                    sa.hingeZ,
                    sa.radius,
                    sa.startAngleDeg,
                    sa.endAngleDeg
                  )}
                  fill={op.kind === "MAIN_DOOR" ? "#F59E0B" : "#0D9488"}
                  fillOpacity={0.12}
                  stroke={op.kind === "MAIN_DOOR" ? "#D97706" : "#0F766E"}
                  strokeWidth={1.1}
                  strokeDasharray="4 3"
                  pointerEvents="none"
                />
              );
            })}

          {/* Walls (Dynamic modes + Accent Finish + Architecture Clickable) */}
          {SKYONE_A2_WALLS.map((w) => {
            const x1 = worldToSvgX(w.x1);
            const y1 = worldToSvgY(w.z1);
            const x2 = worldToSvgX(w.x2);
            const y2 = worldToSvgY(w.z2);
            const ov = scenario.wallOverrides?.[w.id];
            const effectiveMode = !w.structural && ov?.mode ? ov.mode : "SOLID";
            const accentMeta =
              ov?.accentFinish && ov.accentFinish !== "DEFAULT"
                ? WALL_ACCENT_META[ov.accentFinish]
                : null;
            const isSelectedWall =
              interactionMode === "ARCHITECTURE" &&
              selectedArchTarget?.kind === "WALL" &&
              selectedArchTarget.id === w.id;

            let strokeColor =
              w.id === "w_north_balcony_rail"
                ? "#0F766E"
                : w.isLouverWall
                  ? "#475569"
                  : "#334155";
            let strokeWidth = Math.max(3, w.thickness * SCALE);
            let strokeDasharray: string | undefined =
              w.id === "w_north_balcony_rail"
                ? "6 4"
                : w.isLouverWall
                  ? "3 3"
                  : undefined;
            let strokeOpacity = 1;

            if (effectiveMode === "OPEN") {
              strokeColor = "#94A3B8";
              strokeWidth = 2;
              strokeDasharray = "4 4";
              strokeOpacity = 0.55;
            } else if (effectiveMode === "GLASS_PARTITION") {
              strokeColor = "#0891B2";
              strokeWidth = 4.5;
              strokeDasharray = undefined;
            } else if (effectiveMode === "WOOD_SLAT") {
              strokeColor = "#B45309";
              strokeWidth = 5;
              strokeDasharray = "5 4";
            }

            if (isSelectedWall) {
              strokeColor = "#0D9488";
              strokeWidth = Math.max(strokeWidth + 3, 9);
            }

            return (
              <g key={w.id}>
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeDasharray={strokeDasharray}
                  strokeOpacity={strokeOpacity}
                  pointerEvents="none"
                />
                {accentMeta && effectiveMode === "SOLID" && (
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={accentMeta.hex}
                    strokeWidth={3.2}
                    strokeLinecap="round"
                    pointerEvents="none"
                  />
                )}
                {interactionMode === "ARCHITECTURE" && (
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="transparent"
                    strokeWidth={18}
                    strokeLinecap="round"
                    style={{ cursor: "pointer" }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      onSelectItem(null);
                      onSelectArchTarget?.({ kind: "WALL", id: w.id });
                    }}
                  >
                    <title>{w.label}</title>
                  </line>
                )}
              </g>
            );
          })}

          {/* Openings (Respecting SLIDING_POCKET / OPEN_ARCH + Clickable in Architecture mode) */}
          {SKYONE_A2_OPENINGS.map((op) => {
            const cx = worldToSvgX(op.x);
            const cy = worldToSvgY(op.z);
            const len = op.width * SCALE;
            const isVertical = Math.abs(op.rotationY) > 0.5;
            const doorMode = op.customizableDoor
              ? scenario.doorOverrides?.[op.id] ?? "SWING_90"
              : "SWING_90";
            const isSelectedDoor =
              interactionMode === "ARCHITECTURE" &&
              selectedArchTarget?.kind === "DOOR" &&
              selectedArchTarget.id === op.id;

            const x1 = isVertical ? cx : cx - len / 2;
            const y1 = isVertical ? cy - len / 2 : cy;
            const x2 = isVertical ? cx : cx + len / 2;
            const y2 = isVertical ? cy + len / 2 : cy;

            const baseColor = isSelectedDoor
              ? "#0D9488"
              : op.kind === "MAIN_DOOR"
                ? "#B45309"
                : op.kind === "INTERIOR_DOOR"
                  ? doorMode === "SLIDING_POCKET"
                    ? "#0284C7"
                    : doorMode === "OPEN_ARCH"
                      ? "#94A3B8"
                      : "#92400E"
                  : "#0284C7";

            return (
              <g key={op.id}>
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={baseColor}
                  strokeWidth={isSelectedDoor ? 8 : op.kind === "INTERIOR_DOOR" ? 4.5 : 6}
                  strokeLinecap="round"
                  strokeDasharray={doorMode === "OPEN_ARCH" ? "4 4" : undefined}
                  pointerEvents="none"
                />
                {doorMode === "SLIDING_POCKET" && (
                  <line
                    x1={isVertical ? cx + 5 : cx - len * 0.4}
                    y1={isVertical ? cy - len * 0.4 : cy + 5}
                    x2={isVertical ? cx + 5 : cx + len * 0.4}
                    y2={isVertical ? cy + len * 0.4 : cy + 5}
                    stroke="#0369A1"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    pointerEvents="none"
                  />
                )}
                {interactionMode === "ARCHITECTURE" && op.customizableDoor && (
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="transparent"
                    strokeWidth={20}
                    strokeLinecap="round"
                    style={{ cursor: "pointer" }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      onSelectItem(null);
                      onSelectArchTarget?.({ kind: "DOOR", id: op.id });
                    }}
                  >
                    <title>{op.label}</title>
                  </line>
                )}
              </g>
            );
          })}

          {/* Furniture Items (skip temporarily hidden items) */}
          {scenario.items
            .filter((item) => !item.isHidden)
            .map((item) => {
            const isDraggingThis = dragging?.id === item.id;
            const cx = worldToSvgX(isDraggingThis ? dragging.curX : item.position.x);
            const cy = worldToSvgY(isDraggingThis ? dragging.curZ : item.position.z);
            const rw = (item.dimensionsCm.width / 100) * SCALE;
            const rh = (item.dimensionsCm.depth / 100) * SCALE;
            const isSelected = selectedItemId === item.id;
            const warnSeverity = warningSeverityByItem.get(item.id);
            const finishHex = MATERIAL_FINISH_META[item.materialFinish]?.hex || "#BA8756";
            const isElevated = item.mountType === "WALL" || item.mountType === "SURFACE";

            return (
              <g
                key={item.id}
                transform={`translate(${cx}, ${cy}) rotate(${-item.rotationDeg})`}
                onPointerDown={(e) => handleItemPointerDown(e, item)}
                onClick={(e) => {
                  if (toolMode !== "SELECT" || interactionMode === "ARCHITECTURE") return;
                  e.stopPropagation();
                  setSelectedMepId(null);
                  onSelectItem(item.id);
                }}
                style={{
                  cursor:
                    interactionMode === "ARCHITECTURE"
                      ? "default"
                      : toolMode !== "SELECT"
                        ? "crosshair"
                        : item.isLocked
                          ? "pointer"
                          : "grab",
                  opacity: interactionMode === "ARCHITECTURE" ? 0.55 : 1,
                }}
              >
                <rect
                  x={-rw / 2}
                  y={-rh / 2}
                  width={rw}
                  height={rh}
                  rx={4}
                  fill={warnSeverity === "DANGER" ? "#FDA4AF" : finishHex}
                  fillOpacity={
                    item.catalogKey === "area_rug" ? 0.32 : isElevated ? 0.72 : 0.88
                  }
                  stroke={
                    warnSeverity === "DANGER"
                      ? "#E11D48"
                      : warnSeverity === "WARNING"
                        ? "#D97706"
                        : isSelected
                          ? "#0D9488"
                          : "#1E293B"
                  }
                  strokeWidth={isSelected || warnSeverity ? 3 : 1.2}
                  strokeDasharray={isElevated ? "4 2" : undefined}
                />
                {/* Front facing direction marker */}
                <line
                  x1={-Math.min(10, rw * 0.25)}
                  y1={rh / 2 - 3}
                  x2={Math.min(10, rw * 0.25)}
                  y2={rh / 2 - 3}
                  stroke="#FFFFFF"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                {rw >= 34 && rh >= 20 && (
                  <text
                    x="0"
                    y="3"
                    textAnchor="middle"
                    fill="#0F172A"
                    fontSize="8.5"
                    fontWeight="800"
                    pointerEvents="none"
                  >
                    {item.name.length > 14 ? `${item.name.slice(0, 13)}…` : item.name}
                  </text>
                )}
              </g>
            );
          })}

          {/* Live Smart Guides (cm to nearest walls while dragging) */}
          {smartGuides.map((g) => {
            const x1 = worldToSvgX(g.x1);
            const y1 = worldToSvgY(g.z1);
            const x2 = worldToSvgX(g.x2);
            const y2 = worldToSvgY(g.z2);
            const mx = (x1 + x2) / 2;
            const my = (y1 + y2) / 2;
            return (
              <g key={g.id} pointerEvents="none">
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="#0D9488"
                  strokeWidth="1.6"
                  strokeDasharray="4 3"
                />
                <rect x={mx - 20} y={my - 9} width={40} height={16} rx={3} fill="#0F766E" />
                <text
                  x={mx}
                  y={my + 2.5}
                  textAnchor="middle"
                  fill="#FFFFFF"
                  fontSize="8.5"
                  fontWeight="800"
                >
                  {g.distanceCm} cm
                </text>
              </g>
            );
          })}

          {/* Interactive MEP Points Layer */}
          {showMepLayer &&
            mepPoints.map((pt) => {
              const isDraggingThis = draggingMep?.id === pt.id;
              const cx = worldToSvgX(isDraggingThis ? draggingMep.curX : pt.x);
              const cy = worldToSvgY(isDraggingThis ? draggingMep.curZ : pt.z);
              const meta = MEP_KIND_META[pt.kind];
              const isSel = selectedMepId === pt.id;

              return (
                <g
                  key={pt.id}
                  transform={`translate(${cx}, ${cy})`}
                  onPointerDown={(e) => handleMepPointerDown(e, pt)}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectItem(null);
                    setSelectedMepId(pt.id);
                  }}
                  style={{ cursor: "grab" }}
                >
                  <circle
                    r={isSel ? 11 : 9}
                    fill={meta.colorHex}
                    stroke="#FFFFFF"
                    strokeWidth={isSel ? 2.6 : 1.8}
                  />
                  <text
                    x="0"
                    y="3"
                    textAnchor="middle"
                    fill="#FFFFFF"
                    fontSize="6.8"
                    fontWeight="900"
                    pointerEvents="none"
                  >
                    {meta.symbol}
                  </text>
                  <title>
                    {pt.label} · Cao độ {pt.heightCm}cm{pt.note ? ` · ${pt.note}` : ""}
                  </title>
                </g>
              );
            })}

          {/* 2-Point Tape Measure Line */}
          {measurePts.p1 && (
            <g pointerEvents="none">
              <circle
                cx={worldToSvgX(measurePts.p1.x)}
                cy={worldToSvgY(measurePts.p1.z)}
                r={4.5}
                fill="#D97706"
                stroke="#FFFFFF"
                strokeWidth="1.5"
              />
              {measurePts.p2 && (
                <>
                  <line
                    x1={worldToSvgX(measurePts.p1.x)}
                    y1={worldToSvgY(measurePts.p1.z)}
                    x2={worldToSvgX(measurePts.p2.x)}
                    y2={worldToSvgY(measurePts.p2.z)}
                    stroke="#D97706"
                    strokeWidth="2.4"
                    strokeDasharray="6 3"
                  />
                  <circle
                    cx={worldToSvgX(measurePts.p2.x)}
                    cy={worldToSvgY(measurePts.p2.z)}
                    r={4.5}
                    fill="#D97706"
                    stroke="#FFFFFF"
                    strokeWidth="1.5"
                  />
                  {measuredDistanceCm !== null && (
                    <>
                      <rect
                        x={(worldToSvgX(measurePts.p1.x) + worldToSvgX(measurePts.p2.x)) / 2 - 28}
                        y={(worldToSvgY(measurePts.p1.z) + worldToSvgY(measurePts.p2.z)) / 2 - 11}
                        width={56}
                        height={18}
                        rx={4}
                        fill="#B45309"
                      />
                      <text
                        x={(worldToSvgX(measurePts.p1.x) + worldToSvgX(measurePts.p2.x)) / 2}
                        y={(worldToSvgY(measurePts.p1.z) + worldToSvgY(measurePts.p2.z)) / 2 + 1.5}
                        textAnchor="middle"
                        fill="#FFFFFF"
                        fontSize="9"
                        fontWeight="900"
                      >
                        {measuredDistanceCm} cm
                      </text>
                    </>
                  )}
                </>
              )}
            </g>
          )}

          {/* Compass & Entrance Legend */}
          <text
            x={worldToSvgX(2.25)}
            y={18}
            textAnchor="middle"
            fill="#0F766E"
            fontSize="10.5"
            fontWeight="800"
            pointerEvents="none"
          >
            ↑ BAN CÔNG ĐÔNG NAM (NẮNG SÁNG DỊU)
          </text>
          <text
            x={worldToSvgX(0.55)}
            y={VIEW_H - 12}
            textAnchor="middle"
            fill="#B45309"
            fontSize="10.5"
            fontWeight="800"
            pointerEvents="none"
          >
            ▲ CỬA CHÍNH LECMAX 1.2M (BẢN LỀ TRÁI)
          </text>
        </svg>
      </div>

      {/* Bottom Hint */}
      <div className="px-3.5 py-2 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
        <span>
          {interactionMode === "ARCHITECTURE"
            ? "Đang ở chế độ Tường & Cửa · Chạm tường/cửa để đổi kết cấu & vật liệu"
            : snapToWall
              ? "Đang bật Hít tường (<=12cm) & Smart Guides · Kéo đồ hoặc điểm MEP để dời vị trí"
              : "Lưới tự do 5cm · Phím R xoay 90°, Mũi tên nhích 5cm"}
        </span>
        <span className="inline-flex items-center gap-1 font-semibold">
          <Lock className="w-3 h-3" /> Hộp gen kỹ thuật, Bếp & WC CĐT khóa cố định
        </span>
      </div>
    </div>
  );
}
