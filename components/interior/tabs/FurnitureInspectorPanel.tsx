"use client";

import React, { useRef, useState } from "react";
import {
  Copy,
  Lock,
  RotateCcw,
  RotateCw,
  Trash2,
  Unlock,
  X,
  Building2,
  Clock,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  InteriorFurnitureItem,
  InteriorMaterialFinish,
  InteriorStudioState,
} from "@/types/finance";
import { MATERIAL_FINISH_META } from "@/lib/interiorFloorplan";
import {
  BOQ_GROUP_META,
  calculateFurnitureItemCostVnd,
} from "@/lib/interiorBoqEngine";
import { formatVNDMasked } from "@/lib/formatters";

interface FurnitureInspectorPanelProps {
  item: InteriorFurnitureItem;
  interiorStudio: InteriorStudioState;
  isPrivacyMode: boolean;
  onUpdateItem: (
    id: string,
    patch: Partial<InteriorFurnitureItem>,
    options?: { skipUndoHistory?: boolean }
  ) => void;
  onCommitUndoSnapshot: (snapshot: InteriorStudioState) => void;
  onDuplicate: (item: InteriorFurnitureItem) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

const PRICING_RULE_SUFFIX: Record<InteriorFurnitureItem["pricingRule"], string> = {
  FIXED_UNIT: "VNĐ / món",
  PER_LINEAR_METER: "VNĐ / md",
  PER_SQUARE_METER: "VNĐ / m²",
};

export function FurnitureInspectorPanel({
  item,
  interiorStudio,
  isPrivacyMode,
  onUpdateItem,
  onCommitUndoSnapshot,
  onDuplicate,
  onDelete,
  onClose,
}: FurnitureInspectorPanelProps) {
  const sliderSnapshotRef = useRef<InteriorStudioState | null>(null);
  const [showVendorFields, setShowVendorFields] = useState<boolean>(
    Boolean(item.vendorName || item.leadTimeDays || item.warrantyMonths)
  );

  const captureSnapshotIfIdle = () => {
    if (!sliderSnapshotRef.current) {
      sliderSnapshotRef.current = interiorStudio;
    }
  };

  const flushSnapshot = () => {
    if (sliderSnapshotRef.current) {
      onCommitUndoSnapshot(sliderSnapshotRef.current);
      sliderSnapshotRef.current = null;
    }
  };

  const liveCost = calculateFurnitureItemCostVnd(item);

  return (
    <aside className="xl:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-4">
      <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="min-w-0">
          <p className="text-[11px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider">
            {BOQ_GROUP_META[item.boqGroup].shortLabel}
          </p>
          <h3 className="text-sm font-black text-slate-900 dark:text-white leading-snug mt-0.5">
            {item.name}
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
            Tọa độ: X {item.position.x.toFixed(2)}m · Z {item.position.z.toFixed(2)}m
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
          aria-label="Đóng bảng thuộc tính"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Live Cost Preview + Editable Unit Price */}
      <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/70 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Dự toán món này
          </span>
          <span className="text-base font-black text-teal-700 dark:text-teal-300 tabular-nums">
            {item.source === "DEVELOPER_INCLUDED"
              ? "0 đ (CĐT bàn giao)"
              : formatVNDMasked(liveCost, isPrivacyMode)}
          </span>
        </div>

        {item.source !== "DEVELOPER_INCLUDED" && (
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/70 dark:border-slate-700/70">
            <label
              htmlFor={`unit-price-${item.id}`}
              className="text-[11px] font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap"
            >
              Đơn giá ({PRICING_RULE_SUFFIX[item.pricingRule]})
            </label>
            <input
              id={`unit-price-${item.id}`}
              type="number"
              min={0}
              step={100_000}
              value={item.unitPriceVnd}
              onChange={(e) => {
                const next = Math.max(0, Number(e.target.value) || 0);
                onUpdateItem(item.id, { unitPriceVnd: next });
              }}
              className="w-32 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-right text-slate-800 dark:text-slate-100 tabular-nums"
            />
          </div>
        )}
      </div>

      {/* Dimensions Sliders (cm) with batched Undo */}
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
                {item.dimensionsCm[dim.key]} cm
              </span>
            </div>
            <input
              type="range"
              min={dim.min}
              max={dim.max}
              step={5}
              disabled={Boolean(item.isLocked)}
              value={item.dimensionsCm[dim.key]}
              onPointerDown={captureSnapshotIfIdle}
              onFocus={captureSnapshotIfIdle}
              onChange={(e) =>
                onUpdateItem(
                  item.id,
                  {
                    dimensionsCm: {
                      ...item.dimensionsCm,
                      [dim.key]: Number(e.target.value),
                    },
                  },
                  { skipUndoHistory: true }
                )
              }
              onPointerUp={flushSnapshot}
              onBlur={flushSnapshot}
              className="w-full accent-teal-600 disabled:opacity-50"
            />
          </div>
        ))}
      </div>

      {/* Rotation Controls */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-slate-700 dark:text-slate-200">
            Góc xoay <span className="text-slate-400 font-normal">(Phím R: +90°)</span>
          </span>
          <span className="font-bold tabular-nums text-slate-500">{item.rotationDeg}°</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <button
            type="button"
            disabled={Boolean(item.isLocked)}
            onClick={() =>
              onUpdateItem(item.id, {
                rotationDeg: (((item.rotationDeg - 15) % 360) + 360) % 360,
              })
            }
            className="inline-flex items-center justify-center gap-1 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" /> -15°
          </button>
          <button
            type="button"
            disabled={Boolean(item.isLocked)}
            onClick={() =>
              onUpdateItem(item.id, {
                rotationDeg: (item.rotationDeg + 15) % 360,
              })
            }
            className="inline-flex items-center justify-center gap-1 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
          >
            <RotateCw className="w-3.5 h-3.5" /> +15°
          </button>
          <button
            type="button"
            disabled={Boolean(item.isLocked)}
            onClick={() =>
              onUpdateItem(item.id, {
                rotationDeg: (item.rotationDeg + 90) % 360,
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
            const active = item.materialFinish === fk;
            return (
              <button
                key={fk}
                type="button"
                onClick={() => onUpdateItem(item.id, { materialFinish: fk })}
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

      {/* Collapsible Vendor / Lead Time / Warranty */}
      {item.source !== "DEVELOPER_INCLUDED" && (
        <div className="border-t border-slate-100 dark:border-slate-800 pt-2.5 space-y-2">
          <button
            type="button"
            onClick={() => setShowVendorFields((v) => !v)}
            className="w-full flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-teal-600 cursor-pointer"
          >
            <span className="inline-flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-teal-600" />
              <span>Xưởng / NCC, Tiến độ & Bảo hành</span>
            </span>
            {showVendorFields ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>

          {showVendorFields && (
            <div className="space-y-2 pt-1">
              <input
                type="text"
                value={item.vendorName || ""}
                onChange={(e) =>
                  onUpdateItem(item.id, { vendorName: e.target.value || undefined })
                }
                placeholder="Tên xưởng gỗ / NCC (VD: Xưởng An Cường Thủ Đức)"
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100"
              />
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-0.5">
                  <label className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                    <Clock className="w-3 h-3" /> Lead time (ngày)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={180}
                    value={item.leadTimeDays ?? ""}
                    onChange={(e) =>
                      onUpdateItem(item.id, {
                        leadTimeDays: e.target.value === "" ? undefined : Math.max(0, Number(e.target.value)),
                      })
                    }
                    placeholder="VD: 15"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs tabular-nums"
                  />
                </div>
                <div className="space-y-0.5">
                  <label className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                    <ShieldCheck className="w-3 h-3" /> Bảo hành (tháng)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={120}
                    value={item.warrantyMonths ?? ""}
                    onChange={(e) =>
                      onUpdateItem(item.id, {
                        warrantyMonths:
                          e.target.value === "" ? undefined : Math.max(0, Number(e.target.value)),
                      })
                    }
                    placeholder="VD: 24"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs tabular-nums"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Actions: Lock, Duplicate, Delete */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
        <button
          type="button"
          onClick={() => onUpdateItem(item.id, { isLocked: !item.isLocked })}
          className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
        >
          {item.isLocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
          <span>{item.isLocked ? "Mở khóa" : "Khóa vị trí"}</span>
        </button>
        <button
          type="button"
          onClick={() => onDuplicate(item)}
          className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
          title="Nhân bản món này"
        >
          <Copy className="w-4 h-4" />
        </button>
        {item.source !== "DEVELOPER_INCLUDED" && (
          <button
            type="button"
            onClick={() => onDelete(item.id)}
            className="p-2 rounded-lg border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
            title="Xóa món này (Phím Delete)"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </aside>
  );
}
