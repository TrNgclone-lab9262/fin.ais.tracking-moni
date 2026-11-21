"use client";

import React, { useState } from "react";
import {
  CheckSquare,
  Image as ImageIcon,
  RotateCcw,
  Square,
} from "lucide-react";
import { useFinance } from "@/context/FinanceContext";

function SafeSpecImage({
  src,
  alt,
  fallbackTitle,
  fallbackDetail,
}: {
  src: string;
  alt: string;
  fallbackTitle: string;
  fallbackDetail: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="w-full rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-6 text-center space-y-1.5">
        <ImageIcon className="w-6 h-6 mx-auto text-slate-400" />
        <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{fallbackTitle}</p>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">{fallbackDetail}</p>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
      className="w-full rounded-lg border border-slate-200 dark:border-slate-700"
    />
  );
}

export function HandoverChecklistTab() {
  const {
    interiorStudio,
    toggleHandoverChecklistItem,
    updateHandoverChecklistNote,
    resetInteriorStudio,
  } = useFinance();

  const [checklistZoneFilter, setChecklistZoneFilter] = useState<string>("ALL");
  const [showDeveloperSpecSheet, setShowDeveloperSpecSheet] = useState<boolean>(false);

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
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {showDeveloperSpecSheet && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="space-y-1.5">
            <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
              Tiêu chuẩn bàn giao 8 phân khu Phú Đông SKYONE
            </p>
            <SafeSpecImage
              src="/assets/aistudio/mat-bang-noi-that-chi-tiet_24defd59.jpg"
              alt="Tiêu chuẩn bàn giao Phú Đông SKYONE"
              fallbackTitle="Ảnh tiêu chuẩn bàn giao CĐT chưa khả dụng"
              fallbackDetail="Tài liệu PDF gốc gồm 8 khu vực (Lecmax, Changyih, An Cường, Hafele, Ariston) đã được số hóa đầy đủ vào danh mục kiểm tra bên dưới."
            />
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
              Mặt bằng CAD Loại A2 (51.0 m² sử dụng / 55.3 m² xây dựng)
            </p>
            <SafeSpecImage
              src="/assets/aistudio/image_25391d5d.png"
              alt="Mặt bằng CAD Loại A2"
              fallbackTitle="Ảnh mặt bằng CAD Loại A2 chưa khả dụng"
              fallbackDetail="Bạn có thể xem mặt bằng CAD vector độ nét cao kèm kích thước & điểm MEP ngay trong tab Studio 3D/2D."
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
                aria-label={`Đánh dấu ${item.title}`}
              >
                {item.checked ? (
                  <CheckSquare className="w-5 h-5" />
                ) : (
                  <Square className="w-5 h-5 text-slate-400" />
                )}
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
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {item.specDetail}
                </p>
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
}
