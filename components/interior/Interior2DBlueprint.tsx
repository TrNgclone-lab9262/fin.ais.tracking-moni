"use client";

import React, { useMemo, useRef, useState } from "react";
import { Layers, Eye, EyeOff, Lock } from "lucide-react";
import { InteriorDesignScenario, InteriorFurnitureItem } from "@/types/finance";
import {
  MATERIAL_FINISH_META,
  SKYONE_A2_BOUNDS,
  SKYONE_A2_OPENINGS,
  SKYONE_A2_ROOMS,
  SKYONE_A2_WALLS,
} from "@/lib/interiorFloorplan";
import { ErgonomicWarning } from "@/lib/interiorBoqEngine";

interface Interior2DBlueprintProps {
  scenario: InteriorDesignScenario;
  selectedItemId: string | null;
  warnings: ErgonomicWarning[];
  onSelectItem: (id: string | null) => void;
  onItemMoved: (id: string, x: number, z: number) => void;
  className?: string;
}

const SCALE = 84; // 84px per meter
const PAD = 38;
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

type UnderlayMode = "NONE" | "CAD_A2" | "TOP_RENDER";

export function Interior2DBlueprint({
  scenario,
  selectedItemId,
  warnings,
  onSelectItem,
  onItemMoved,
  className = "",
}: Interior2DBlueprintProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [underlay, setUnderlay] = useState<UnderlayMode>("NONE");
  const [underlayOpacity, setUnderlayOpacity] = useState<number>(0.35);
  const [dragging, setDragging] = useState<{
    id: string;
    offsetX: number;
    offsetZ: number;
    curX: number;
    curZ: number;
  } | null>(null);

  const warningItemIds = useMemo(() => new Set(warnings.map((w) => w.itemId)), [warnings]);

  const getSvgCoords = (e: React.PointerEvent<SVGSVGElement>): { x: number; y: number } => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * VIEW_W;
    const y = ((e.clientY - rect.top) / rect.height) * VIEW_H;
    return { x, y };
  };

  const handleItemPointerDown = (
    e: React.PointerEvent<SVGGElement>,
    item: InteriorFurnitureItem
  ) => {
    e.stopPropagation();
    onSelectItem(item.id);
    if (item.isLocked) return;

    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * VIEW_W;
    const py = ((e.clientY - rect.top) / rect.height) * VIEW_H;
    const wx = svgToWorldX(px);
    const wz = svgToWorldZ(py);

    setDragging({
      id: item.id,
      offsetX: item.position.x - wx,
      offsetZ: item.position.z - wz,
      curX: item.position.x,
      curZ: item.position.z,
    });
  };

  const handleSvgPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragging) return;
    const { x, y } = getSvgCoords(e);
    const rawX = svgToWorldX(x) + dragging.offsetX;
    const rawZ = svgToWorldZ(y) + dragging.offsetZ;
    // Snap to 5cm architectural grid
    const snappedX = Math.max(
      SKYONE_A2_BOUNDS.minX + 0.25,
      Math.min(SKYONE_A2_BOUNDS.maxX - 0.25, Math.round(rawX * 20) / 20)
    );
    const snappedZ = Math.max(
      SKYONE_A2_BOUNDS.minZ + 0.25,
      Math.min(SKYONE_A2_BOUNDS.maxZ - 0.25, Math.round(rawZ * 20) / 20)
    );
    setDragging((prev) => (prev ? { ...prev, curX: snappedX, curZ: snappedZ } : null));
  };

  const handleSvgPointerUp = () => {
    if (!dragging) return;
    onItemMoved(
      dragging.id,
      Number(dragging.curX.toFixed(2)),
      Number(dragging.curZ.toFixed(2))
    );
    setDragging(null);
  };

  const roomFill = (mat: string) => {
    switch (mat) {
      case "WOOD_TILE":
        return "#F3E4D2";
      case "BATH_MARBLE":
        return "#EEF2F6";
      case "LOGGIA_GREY":
        return "#E2E6EC";
      default:
        return "#F7F4EE";
    }
  };

  return (
    <div
      className={`rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden flex flex-col ${className}`}
    >
      {/* Top 2D Toolbar */}
      <div className="px-3.5 py-2.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 bg-slate-50/80 dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100">
            Bản vẽ 2D CAD · Kéo thả lưới 5cm
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setUnderlay(underlay === "CAD_A2" ? "NONE" : "CAD_A2")}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
              underlay === "CAD_A2"
                ? "bg-teal-600 border-teal-600 text-white"
                : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
            }`}
          >
            {underlay === "CAD_A2" ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            <span>Nền CAD A2</span>
          </button>
          <button
            type="button"
            onClick={() => setUnderlay(underlay === "TOP_RENDER" ? "NONE" : "TOP_RENDER")}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
              underlay === "TOP_RENDER"
                ? "bg-teal-600 border-teal-600 text-white"
                : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
            }`}
          >
            {underlay === "TOP_RENDER" ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            <span>Nền 2D CĐT</span>
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
              className="w-20 accent-teal-600"
            />
          )}
        </div>
      </div>

      {/* Interactive SVG Canvas */}
      <div className="relative flex-1 bg-slate-100/80 dark:bg-slate-950 p-2 flex items-center justify-center overflow-auto">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="w-full h-auto max-h-[540px] select-none touch-none"
          onPointerMove={handleSvgPointerMove}
          onPointerUp={handleSvgPointerUp}
          onPointerLeave={handleSvgPointerUp}
          onClick={() => onSelectItem(null)}
        >
          {/* Architectural 0.5m Grid */}
          <defs>
            <pattern id="grid50cm" width={SCALE / 2} height={SCALE / 2} patternUnits="userSpaceOnUse">
              <path
                d={`M ${SCALE / 2} 0 L 0 0 0 ${SCALE / 2}`}
                fill="none"
                stroke="#CBD5E1"
                strokeWidth="0.6"
                strokeOpacity="0.45"
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
                  fill={roomFill(room.floorMaterial)}
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

          {/* Walls */}
          {SKYONE_A2_WALLS.map((w) => (
            <line
              key={w.id}
              x1={worldToSvgX(w.x1)}
              y1={worldToSvgY(w.z1)}
              x2={worldToSvgX(w.x2)}
              y2={worldToSvgY(w.z2)}
              stroke={w.id === "w_north_balcony_rail" ? "#0F766E" : "#334155"}
              strokeWidth={Math.max(3, w.thickness * SCALE)}
              strokeLinecap="round"
              strokeDasharray={w.id === "w_north_balcony_rail" ? "6 4" : undefined}
            />
          ))}

          {/* Openings */}
          {SKYONE_A2_OPENINGS.map((op) => {
            const cx = worldToSvgX(op.x);
            const cy = worldToSvgY(op.z);
            const len = op.width * SCALE;
            const isVertical = Math.abs(op.rotationY) > 0.5;
            return (
              <g key={op.id}>
                <line
                  x1={isVertical ? cx : cx - len / 2}
                  y1={isVertical ? cy - len / 2 : cy}
                  x2={isVertical ? cx : cx + len / 2}
                  y2={isVertical ? cy + len / 2 : cy}
                  stroke={op.kind === "MAIN_DOOR" ? "#B45309" : "#0284C7"}
                  strokeWidth={6}
                  strokeLinecap="round"
                />
              </g>
            );
          })}

          {/* Furniture Items */}
          {scenario.items.map((item) => {
            const isDraggingThis = dragging?.id === item.id;
            const cx = worldToSvgX(isDraggingThis ? dragging.curX : item.position.x);
            const cy = worldToSvgY(isDraggingThis ? dragging.curZ : item.position.z);
            const rw = (item.dimensionsCm.width / 100) * SCALE;
            const rh = (item.dimensionsCm.depth / 100) * SCALE;
            const isSelected = selectedItemId === item.id;
            const hasWarning = warningItemIds.has(item.id);
            const finishHex = MATERIAL_FINISH_META[item.materialFinish]?.hex || "#BA8756";

            return (
              <g
                key={item.id}
                transform={`translate(${cx}, ${cy}) rotate(${-item.rotationDeg})`}
                onPointerDown={(e) => handleItemPointerDown(e, item)}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectItem(item.id);
                }}
                style={{ cursor: item.isLocked ? "pointer" : "grab" }}
              >
                <rect
                  x={-rw / 2}
                  y={-rh / 2}
                  width={rw}
                  height={rh}
                  rx={4}
                  fill={finishHex}
                  fillOpacity={item.catalogKey === "area_rug" ? 0.32 : 0.86}
                  stroke={hasWarning ? "#E11D48" : isSelected ? "#0D9488" : "#1E293B"}
                  strokeWidth={isSelected || hasWarning ? 3 : 1.2}
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

          {/* Compass & Entrance Legend */}
          <text
            x={worldToSvgX(2.25)}
            y={18}
            textAnchor="middle"
            fill="#0F766E"
            fontSize="10.5"
            fontWeight="800"
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
          >
            ▲ CỬA CHÍNH LECMAX 1.2M
          </text>
        </svg>
      </div>

      {/* Bottom Hint */}
      <div className="px-3.5 py-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
        <span>Chạm chọn để chỉnh kích thước / xoay góc · Kéo để dời vị trí (bước 5cm)</span>
        <span className="inline-flex items-center gap-1 font-semibold">
          <Lock className="w-3 h-3" /> Bếp & WC CĐT khóa cố định
        </span>
      </div>
    </div>
  );
}
