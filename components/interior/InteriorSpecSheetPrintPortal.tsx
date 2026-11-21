"use client";

import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { InteriorDesignScenario } from "@/types/finance";
import {
  INTERIOR_STYLE_PRESETS,
  MATERIAL_FINISH_META,
  MEP_KIND_META,
  SKYONE_A2_BOUNDS,
  SKYONE_A2_OPENINGS,
  SKYONE_A2_ROOMS,
  SKYONE_A2_WALLS,
  createDefaultSkyOneA2MepPoints,
} from "@/lib/interiorFloorplan";
import {
  BOQ_GROUP_META,
  ErgonomicWarning,
  ScenarioBoqSummary,
} from "@/lib/interiorBoqEngine";
import { formatVNDMasked } from "@/lib/formatters";

interface InteriorSpecSheetPrintPortalProps {
  scenario: InteriorDesignScenario;
  boq: ScenarioBoqSummary;
  warnings: ErgonomicWarning[];
  snapshot3DDataUrl: string | null;
  isPrivacyMode: boolean;
  onDone: () => void;
}

const SCALE = 64;
const PAD = 28;
const VIEW_W = SKYONE_A2_BOUNDS.totalWidth * SCALE + PAD * 2;
const VIEW_H = SKYONE_A2_BOUNDS.totalDepth * SCALE + PAD * 2;

const wx = (x: number) => (x - SKYONE_A2_BOUNDS.minX) * SCALE + PAD;
const wy = (z: number) => (z - SKYONE_A2_BOUNDS.minZ) * SCALE + PAD;

export function InteriorSpecSheetPrintPortal({
  scenario,
  boq,
  warnings,
  snapshot3DDataUrl,
  isPrivacyMode,
  onDone,
}: InteriorSpecSheetPrintPortalProps) {
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

  const stylePreset = INTERIOR_STYLE_PRESETS[scenario.stylePreset];
  const mepPoints = scenario.mepPoints ?? createDefaultSkyOneA2MepPoints();
  const printDate = new Date().toLocaleDateString("vi-VN");

  return createPortal(
    <div className="pdf-print-portal fixed inset-0 z-[9999] bg-white text-slate-900 overflow-auto p-6">
      {/* Screen-only toolbar in case user cancels print dialog */}
      <div className="pdf-no-print mb-4 flex items-center justify-between p-3 rounded-lg bg-slate-100 border border-slate-300">
        <span className="text-xs font-bold text-slate-700">
          Đang chuẩn bị Hồ sơ Kỹ thuật PDF gửi xưởng... Chọn &ldquo;Lưu dưới dạng PDF&rdquo; trong hộp thoại in.
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3 py-1.5 rounded bg-teal-600 text-white text-xs font-bold cursor-pointer"
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

      {/* A4 Spec Sheet Content */}
      <div className="max-w-[900px] mx-auto space-y-5 text-slate-900">
        {/* Document Header */}
        <div className="border-b-2 border-slate-900 pb-3 flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-teal-700">
              PHÚ ĐÔNG SKYONE · HỒ SƠ KỸ THUẬT NỘI THẤT & DỰ TOÁN BOQ
            </p>
            <h1 className="text-xl font-black text-slate-950 mt-0.5">
              Căn hộ A.12A.07 · Loại A2 (51.0 m² thông thủy) — {scenario.name}
            </h1>
            <p className="text-xs text-slate-600 mt-1">
              Phong cách: <strong>{stylePreset.name}</strong> ({stylePreset.subtitle}) · Ban công Đông Nam
            </p>
          </div>
          <div className="text-right text-xs tabular-nums shrink-0">
            <p className="font-bold text-slate-700">Ngày xuất: {printDate}</p>
            <p className="text-base font-black text-teal-700 mt-0.5">
              {formatVNDMasked(boq.grandTotalWithContingency, isPrivacyMode)}
            </p>
            <p className="text-[10px] text-slate-500">
              Đã gồm {scenario.contingencyPercent}% dự phòng
            </p>
          </div>
        </div>

        {/* Visual Drawings Row: 2D CAD Blueprint + 3D Perspective Snapshot */}
        <div className="grid grid-cols-2 gap-4 items-start">
          <div className="border border-slate-300 rounded-lg p-2.5">
            <p className="text-[11px] font-black uppercase text-slate-800 mb-1.5">
              1. Mặt bằng 2D CAD Bố trí Nội thất & Điểm MEP (Tỷ lệ chuẩn A2)
            </p>
            <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="w-full h-auto">
              {SKYONE_A2_ROOMS.map((r) => (
                <g key={r.id}>
                  <rect
                    x={wx(r.x - r.width / 2)}
                    y={wy(r.z - r.depth / 2)}
                    width={r.width * SCALE}
                    height={r.depth * SCALE}
                    fill="#F8FAFC"
                    stroke="#CBD5E1"
                    strokeWidth="0.8"
                  />
                  <text
                    x={wx(r.x)}
                    y={wy(r.z)}
                    textAnchor="middle"
                    fill="#64748B"
                    fontSize="8"
                    fontWeight="700"
                  >
                    {r.code}·{r.shortName}
                  </text>
                </g>
              ))}
              {SKYONE_A2_WALLS.map((w) => (
                <line
                  key={w.id}
                  x1={wx(w.x1)}
                  y1={wy(w.z1)}
                  x2={wx(w.x2)}
                  y2={wy(w.z2)}
                  stroke="#1E293B"
                  strokeWidth={Math.max(2.5, w.thickness * SCALE)}
                  strokeLinecap="round"
                />
              ))}
              {SKYONE_A2_OPENINGS.map((op) => {
                const cx = wx(op.x);
                const cy = wy(op.z);
                const len = op.width * SCALE;
                const isVert = Math.abs(op.rotationY) > 0.5;
                return (
                  <line
                    key={op.id}
                    x1={isVert ? cx : cx - len / 2}
                    y1={isVert ? cy - len / 2 : cy}
                    x2={isVert ? cx : cx + len / 2}
                    y2={isVert ? cy + len / 2 : cy}
                    stroke={op.kind === "MAIN_DOOR" ? "#B45309" : "#0284C7"}
                    strokeWidth={4}
                  />
                );
              })}
              {scenario.items.map((it) => {
                const cx = wx(it.position.x);
                const cy = wy(it.position.z);
                const rw = (it.dimensionsCm.width / 100) * SCALE;
                const rh = (it.dimensionsCm.depth / 100) * SCALE;
                return (
                  <g
                    key={it.id}
                    transform={`translate(${cx}, ${cy}) rotate(${-it.rotationDeg})`}
                  >
                    <rect
                      x={-rw / 2}
                      y={-rh / 2}
                      width={rw}
                      height={rh}
                      rx={2}
                      fill={MATERIAL_FINISH_META[it.materialFinish]?.hex || "#BA8756"}
                      fillOpacity={it.catalogKey === "area_rug" ? 0.25 : 0.78}
                      stroke="#0F172A"
                      strokeWidth="0.9"
                    />
                  </g>
                );
              })}
              {mepPoints.map((pt) => (
                <circle
                  key={pt.id}
                  cx={wx(pt.x)}
                  cy={wy(pt.z)}
                  r={5.5}
                  fill={MEP_KIND_META[pt.kind].colorHex}
                  stroke="#FFFFFF"
                  strokeWidth="1.2"
                />
              ))}
            </svg>
          </div>

          <div className="space-y-3">
            <div className="border border-slate-300 rounded-lg p-2.5">
              <p className="text-[11px] font-black uppercase text-slate-800 mb-1.5">
                2. Phối cảnh 3D Phương án {scenario.code}
              </p>
              {snapshot3DDataUrl ? (
                <img
                  src={snapshot3DDataUrl}
                  alt="Phối cảnh 3D SKYONE A.12A.07"
                  className="w-full rounded border border-slate-200"
                />
              ) : (
                <div className="h-44 rounded bg-slate-50 border border-dashed border-slate-300 flex items-center justify-center text-xs text-slate-500 text-center p-4">
                  Mở chế độ 3D trước khi xuất PDF để đính kèm ảnh phối cảnh 3D sắc nét.
                </div>
              )}
            </div>

            <div className="border border-slate-300 rounded-lg p-2.5 space-y-1.5">
              <p className="text-[11px] font-black uppercase text-slate-800">
                3. Tóm tắt Ngân sách & Công thái học
              </p>
              <div className="grid grid-cols-2 gap-1.5 text-[11px] tabular-nums">
                <div>Nội thất gỗ: <strong>{formatVNDMasked(boq.woodFurnitureTotal, isPrivacyMode)}</strong></div>
                <div>Điện máy: <strong>{formatVNDMasked(boq.appliancesTotal, isPrivacyMode)}</strong></div>
                <div>Hoàn thiện/Decor: <strong>{formatVNDMasked(boq.finishingDecorTotal, isPrivacyMode)}</strong></div>
                <div>Dự phòng ({scenario.contingencyPercent}%): <strong>{formatVNDMasked(boq.contingencyAmount, isPrivacyMode)}</strong></div>
                <div>Đã thanh toán/cọc: <strong className="text-emerald-700">{formatVNDMasked(boq.paidOrDepositedVnd, isPrivacyMode)}</strong></div>
                <div>Còn phải trả: <strong className="text-teal-700">{formatVNDMasked(boq.remainingToPayVnd, isPrivacyMode)}</strong></div>
              </div>
              <p className="text-[10px] text-slate-600 pt-1 border-t border-slate-200">
                Kiểm tra công thái học: {warnings.length === 0 ? "Đạt 100% chuẩn lối đi & không chồng lấn." : `${warnings.length} lưu ý kỹ thuật cần rà soát tại công trình.`}
              </p>
            </div>
          </div>
        </div>

        {/* BOQ Detail Table */}
        <div>
          <p className="text-xs font-black uppercase text-slate-900 mb-1.5">
            4. Bảng Bóc Tách Khối Lượng & Quy Cách Thi Công (BOQ)
          </p>
          <table className="w-full text-left border-collapse text-[10.5px]">
            <thead>
              <tr className="border-y-2 border-slate-800 bg-slate-100">
                <th className="py-1.5 px-2">STT</th>
                <th className="py-1.5 px-2">Hạng mục / Quy cách</th>
                <th className="py-1.5 px-2">Nhóm</th>
                <th className="py-1.5 px-2">NCC / Tiến độ / BH</th>
                <th className="py-1.5 px-2 text-right">Thành tiền</th>
                <th className="py-1.5 px-2 text-right">Đã chi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {boq.rows.map((r, i) => (
                <tr key={`${r.origin}_${r.id}`}>
                  <td className="py-1.5 px-2 tabular-nums">{i + 1}</td>
                  <td className="py-1.5 px-2">
                    <p className="font-bold text-slate-900">{r.name}</p>
                    <p className="text-[9.5px] text-slate-600">
                      {r.specLabel}
                      {r.note ? ` · ${r.note}` : ""}
                    </p>
                  </td>
                  <td className="py-1.5 px-2 whitespace-nowrap">
                    {BOQ_GROUP_META[r.boqGroup].shortLabel}
                  </td>
                  <td className="py-1.5 px-2 text-[9.5px] text-slate-600">
                    {r.vendorName || "—"}
                    {r.leadTimeDays ? ` · ${r.leadTimeDays} ngày` : ""}
                    {r.warrantyMonths ? ` · BH ${r.warrantyMonths}T` : ""}
                  </td>
                  <td className="py-1.5 px-2 text-right font-bold tabular-nums whitespace-nowrap">
                    {r.totalPriceVnd === 0 ? "0 đ (CĐT)" : formatVNDMasked(r.totalPriceVnd, isPrivacyMode)}
                  </td>
                  <td className="py-1.5 px-2 text-right tabular-nums whitespace-nowrap">
                    {r.paidAmountVnd > 0 ? formatVNDMasked(r.paidAmountVnd, isPrivacyMode) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-400 font-bold">
                <td colSpan={4} className="py-1.5 px-2">
                  Dự phòng phát sinh ({scenario.contingencyPercent}%)
                </td>
                <td className="py-1.5 px-2 text-right tabular-nums">
                  {formatVNDMasked(boq.contingencyAmount, isPrivacyMode)}
                </td>
                <td />
              </tr>
              <tr className="border-t-2 border-slate-900 text-xs font-black bg-slate-50">
                <td colSpan={4} className="py-2 px-2">
                  TỔNG CỘNG DỰ TOÁN TRỌN GÓI
                </td>
                <td className="py-2 px-2 text-right tabular-nums text-teal-800">
                  {formatVNDMasked(boq.grandTotalWithContingency, isPrivacyMode)}
                </td>
                <td className="py-2 px-2 text-right tabular-nums">
                  {formatVNDMasked(boq.paidOrDepositedVnd, isPrivacyMode)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* MEP Schedule Table */}
        <div>
          <p className="text-xs font-black uppercase text-slate-900 mb-1.5">
            5. Danh mục Điểm Kỹ Thuật Điện – Nước – Lạnh (MEP · {mepPoints.length} điểm)
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
            {mepPoints.map((pt, idx) => (
              <div
                key={pt.id}
                className="flex items-start justify-between gap-2 py-1 border-b border-slate-200"
              >
                <div>
                  <span className="font-bold">
                    {idx + 1}. [{MEP_KIND_META[pt.kind].shortLabel}] {pt.label}
                  </span>
                  {pt.note && <span className="text-slate-500 block">{pt.note}</span>}
                </div>
                <span className="font-bold tabular-nums whitespace-nowrap text-slate-700">
                  H={pt.heightCm}cm
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
