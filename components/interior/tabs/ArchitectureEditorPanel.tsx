"use client";

import React, { useMemo } from "react";
import {
  DoorOpen,
  Grid2x2,
  Hammer,
  Lock,
  PaintBucket,
  Sparkles,
  Unlock,
  X,
} from "lucide-react";
import {
  InteriorDesignScenario,
  InteriorDoorMode,
  InteriorFloorPattern,
  InteriorWallAccentFinish,
  InteriorWallMode,
  InteriorWallOverride,
} from "@/types/finance";
import {
  DOOR_MODE_META,
  FLOOR_PATTERN_META,
  SKYONE_A2_OPENINGS,
  SKYONE_A2_WALLS,
  WALL_ACCENT_META,
  WALL_MODE_META,
} from "@/lib/interiorFloorplan";
import { InteriorArchTarget } from "@/lib/three/interiorSceneController";
import { formatShortVNDMasked } from "@/lib/formatters";

interface ArchitectureEditorPanelProps {
  scenario: InteriorDesignScenario;
  selectedTarget: InteriorArchTarget | null;
  isPrivacyMode: boolean;
  onSelectTarget: (target: InteriorArchTarget | null) => void;
  onUpdateWallOverride: (wallId: string, patch: Partial<InteriorWallOverride>) => void;
  onUpdateDoorOverride: (openingId: string, mode: InteriorDoorMode) => void;
  onUpdateFloorPattern: (roomId: string, pattern: InteriorFloorPattern) => void;
  onClose: () => void;
  className?: string;
}

const BEDROOM_FLOOR_TARGETS = [
  { roomId: "room_master_bed", label: "04 · Phòng ngủ Master" },
  { roomId: "room_05_office", label: "05 · Phòng 05 / Studio" },
];

export function ArchitectureEditorPanel({
  scenario,
  selectedTarget,
  isPrivacyMode,
  onSelectTarget,
  onUpdateWallOverride,
  onUpdateDoorOverride,
  onUpdateFloorPattern,
  onClose,
  className = "xl:col-span-4",
}: ArchitectureEditorPanelProps) {
  const nonStructuralWalls = useMemo(
    () => SKYONE_A2_WALLS.filter((w) => !w.structural),
    []
  );

  const customizableDoors = useMemo(
    () => SKYONE_A2_OPENINGS.filter((op) => op.customizableDoor),
    []
  );

  // Default to the primary non-structural wall (Room 05 partition) if nothing is explicitly clicked yet
  const activeWall = useMemo(() => {
    if (selectedTarget?.kind === "WALL") {
      return SKYONE_A2_WALLS.find((w) => w.id === selectedTarget.id) || nonStructuralWalls[0];
    }
    return nonStructuralWalls[0] || SKYONE_A2_WALLS[0];
  }, [selectedTarget, nonStructuralWalls]);

  const activeWallOverride = activeWall ? scenario.wallOverrides?.[activeWall.id] : undefined;
  const activeWallMode: InteriorWallMode =
    activeWall && !activeWall.structural && activeWallOverride?.mode
      ? activeWallOverride.mode
      : "SOLID";
  const activeWallAccent: InteriorWallAccentFinish =
    activeWallOverride?.accentFinish ?? "DEFAULT";

  return (
    <aside
      className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-4 ${className}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
            <Hammer className="w-3.5 h-3.5" />
            <span>Tùy biến Kết cấu & Vật liệu A2</span>
          </p>
          <h3 className="text-sm font-black text-slate-900 dark:text-white leading-snug mt-0.5">
            Chỉnh sửa Tường, Cửa & Sàn
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Chạm trực tiếp tường/cửa trên 3D hoặc 2D CAD — tự động tính dự toán cải tạo BOQ
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
          aria-label="Đóng bảng tùy biến kết cấu"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Quick Wall Selector */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor="arch-wall-selector"
            className="text-xs font-extrabold text-slate-700 dark:text-slate-200"
          >
            Mảng tường đang chọn
          </label>
          {activeWall && (
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-bold ${
                activeWall.structural
                  ? "text-slate-500 dark:text-slate-400"
                  : "text-teal-700 dark:text-teal-300"
              }`}
            >
              {activeWall.structural ? (
                <>
                  <Lock className="w-3 h-3" /> Chịu lực (chỉ đổi ốp bề mặt)
                </>
              ) : (
                <>
                  <Unlock className="w-3 h-3" /> Vách phi kết cấu
                </>
              )}
            </span>
          )}
        </div>

        <select
          id="arch-wall-selector"
          value={activeWall?.id ?? ""}
          onChange={(e) => onSelectTarget({ kind: "WALL", id: e.target.value })}
          className="w-full px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100"
        >
          <optgroup label="Vách ngăn phi kết cấu (Tùy biến mở thông / kính / lam gỗ)">
            {nonStructuralWalls.map((w) => (
              <option key={w.id} value={w.id}>
                ★ {w.label}
              </option>
            ))}
          </optgroup>
          <optgroup label="Tường bao & Tường chịu lực (Đổi ốp Accent Wall)">
            {SKYONE_A2_WALLS.filter((w) => w.structural).map((w) => (
              <option key={w.id} value={w.id}>
                {w.label}
              </option>
            ))}
          </optgroup>
        </select>
      </div>

      {/* Section 1: Non-Structural Wall Modes */}
      {activeWall && !activeWall.structural && (
        <div className="space-y-2">
          <p className="text-xs font-extrabold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            <span>Kiểu vách ngăn ({activeWall.label})</span>
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {(Object.keys(WALL_MODE_META) as InteriorWallMode[]).map((mode) => {
              const meta = WALL_MODE_META[mode];
              const active = activeWallMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onUpdateWallOverride(activeWall.id, { mode })}
                  className={`p-2 rounded-lg border text-left transition-colors cursor-pointer ${
                    active
                      ? "border-teal-600 bg-teal-50 dark:bg-teal-950/50 text-teal-900 dark:text-teal-100"
                      : "border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-200 hover:border-slate-400"
                  }`}
                >
                  <p className="text-xs font-extrabold leading-tight">{meta.shortLabel}</p>
                  <p className="text-[10px] font-bold text-teal-700 dark:text-teal-300 tabular-nums mt-0.5">
                    {meta.estimatedCostVnd === 0
                      ? "0 đ (CĐT)"
                      : `+${formatShortVNDMasked(meta.estimatedCostVnd, isPrivacyMode)}`}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Section 2: Accent Wall Surface Finish */}
      {activeWall && activeWallMode !== "OPEN" && (
        <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <p className="text-xs font-extrabold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
            <PaintBucket className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>Vật liệu ốp điểm nhấn (Accent Wall)</span>
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {(Object.keys(WALL_ACCENT_META) as InteriorWallAccentFinish[]).map((finishKey) => {
              const meta = WALL_ACCENT_META[finishKey];
              const active = activeWallAccent === finishKey;
              return (
                <button
                  key={finishKey}
                  type="button"
                  onClick={() =>
                    onUpdateWallOverride(activeWall.id, { accentFinish: finishKey })
                  }
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border text-left transition-colors cursor-pointer ${
                    active
                      ? "border-teal-600 bg-teal-50 dark:bg-teal-950/50 text-teal-900 dark:text-teal-100"
                      : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-400"
                  }`}
                >
                  <span
                    className="w-3.5 h-3.5 rounded-full border border-black/20 shrink-0"
                    style={{ backgroundColor: meta.hex }}
                  />
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold truncate leading-tight">
                      {meta.shortLabel}
                    </p>
                    <p className="text-[9.5px] font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                      {meta.estimatedCostVnd === 0
                        ? "0 đ"
                        : `+${formatShortVNDMasked(meta.estimatedCostVnd, isPrivacyMode)}`}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Section 3: Customizable Interior Doors */}
      <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
        <p className="text-xs font-extrabold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
          <DoorOpen className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
          <span>Kiểu cửa đi nội bộ (Giải phóng góc mở 90°)</span>
        </p>
        <div className="space-y-2">
          {customizableDoors.map((op) => {
            const currentMode: InteriorDoorMode =
              scenario.doorOverrides?.[op.id] ?? "SWING_90";
            const isSelectedDoor =
              selectedTarget?.kind === "DOOR" && selectedTarget.id === op.id;

            return (
              <div
                key={op.id}
                onClick={() => onSelectTarget({ kind: "DOOR", id: op.id })}
                className={`p-2.5 rounded-lg border transition-colors ${
                  isSelectedDoor
                    ? "border-teal-500 bg-teal-50/40 dark:bg-teal-950/30"
                    : "border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-[11px] font-extrabold text-slate-800 dark:text-slate-100">
                    {op.label}
                  </span>
                  <span className="text-[10px] font-bold text-teal-700 dark:text-teal-300 tabular-nums">
                    {DOOR_MODE_META[currentMode].estimatedCostVnd === 0
                      ? "0 đ"
                      : `+${formatShortVNDMasked(DOOR_MODE_META[currentMode].estimatedCostVnd, isPrivacyMode)}`}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {(Object.keys(DOOR_MODE_META) as InteriorDoorMode[]).map((mode) => {
                    const active = currentMode === mode;
                    return (
                      <button
                        key={mode}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectTarget({ kind: "DOOR", id: op.id });
                          onUpdateDoorOverride(op.id, mode);
                        }}
                        className={`py-1 px-1.5 rounded text-[10.5px] font-bold border transition-colors cursor-pointer ${
                          active
                            ? "bg-teal-600 border-teal-600 text-white"
                            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-teal-400"
                        }`}
                      >
                        {DOOR_MODE_META[mode].shortLabel}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 4: Bedroom Wood Floor Pattern */}
      <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
        <p className="text-xs font-extrabold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
          <Grid2x2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          <span>Kiểu lát sàn gỗ Phòng ngủ</span>
        </p>
        <div className="space-y-1.5">
          {BEDROOM_FLOOR_TARGETS.map((room) => {
            const currentPattern: InteriorFloorPattern =
              scenario.roomFloorOverrides?.[room.roomId] ?? "STRAIGHT";
            return (
              <div
                key={room.roomId}
                className="flex items-center justify-between gap-2 p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40"
              >
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                  {room.label}
                </span>
                <div className="inline-flex rounded-md bg-slate-200/70 dark:bg-slate-900 p-0.5">
                  {(Object.keys(FLOOR_PATTERN_META) as InteriorFloorPattern[]).map((pat) => {
                    const active = currentPattern === pat;
                    return (
                      <button
                        key={pat}
                        type="button"
                        onClick={() => onUpdateFloorPattern(room.roomId, pat)}
                        className={`px-2 py-0.5 rounded text-[10.5px] font-bold whitespace-nowrap cursor-pointer ${
                          active
                            ? "bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-300 shadow-xs"
                            : "text-slate-600 dark:text-slate-400"
                        }`}
                      >
                        {FLOOR_PATTERN_META[pat].shortLabel}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
