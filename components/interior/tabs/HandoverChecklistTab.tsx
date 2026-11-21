"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock,
  FileText,
  Image as ImageIcon,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { HandoverChecklistStatus } from "@/types/finance";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import {
  SnagListPrintPortal,
  resolveChecklistItemStatus,
} from "@/components/interior/SnagListPrintPortal";
import {
  deleteSnagPhoto,
  loadSnagPhoto,
  saveSnagPhoto,
} from "@/lib/snagPhotoVault";

const ZONE_OPTIONS: { code: string; name: string }[] = [
  { code: "01", name: "Cửa chính & Khóa điện tử" },
  { code: "02", name: "Phòng Khách & Ăn" },
  { code: "03", name: "Khu Bếp (An Cường & Hafele)" },
  { code: "04", name: "Phòng Ngủ Master" },
  { code: "05", name: "Phòng 05 / Studio" },
  { code: "06", name: "Phòng Tắm / WC (TOTO)" },
  { code: "07", name: "Ban công & Lô gia Giặt phơi" },
  { code: "08", name: "Hệ thống Điện, Nước, Máy lạnh & PCCC" },
];

const STATUS_META: Record<
  HandoverChecklistStatus,
  { label: string; shortLabel: string; activeClass: string; badgeClass: string }
> = {
  PENDING: {
    label: "Chờ kiểm tra",
    shortLabel: "Chờ kiểm",
    activeClass: "bg-slate-700 text-white border-slate-700",
    badgeClass:
      "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700",
  },
  PASSED: {
    label: "Đạt chuẩn",
    shortLabel: "Đạt",
    activeClass: "bg-emerald-600 text-white border-emerald-600",
    badgeClass:
      "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
  },
  DEFECT_MINOR: {
    label: "Lỗi nhẹ",
    shortLabel: "Lỗi nhẹ",
    activeClass: "bg-amber-500 text-stone-950 border-amber-500",
    badgeClass:
      "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800",
  },
  DEFECT_CRITICAL: {
    label: "Lỗi nghiêm trọng",
    shortLabel: "Nghiêm trọng",
    activeClass: "bg-rose-600 text-white border-rose-600",
    badgeClass:
      "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800",
  },
};

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
    updateHandoverChecklistStatus,
    updateHandoverChecklistNote,
    updateHandoverChecklistPhoto,
    addHandoverChecklistItem,
    deleteHandoverChecklistItem,
    resetInteriorStudio,
  } = useFinance();

  const [checklistZoneFilter, setChecklistZoneFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<HandoverChecklistStatus | "ALL">("ALL");
  const [showDeveloperSpecSheet, setShowDeveloperSpecSheet] = useState<boolean>(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState<boolean>(false);
  const [pendingDeleteItemId, setPendingDeleteItemId] = useState<string | null>(null);
  const [printSnagOpen, setPrintSnagOpen] = useState<boolean>(false);

  // Add custom snag form state
  const [showAddSnagForm, setShowAddSnagForm] = useState<boolean>(false);
  const [newZoneCode, setNewZoneCode] = useState<string>("02");
  const [newTitle, setNewTitle] = useState<string>("");
  const [newSpecDetail, setNewSpecDetail] = useState<string>("");
  const [newStatus, setNewStatus] = useState<HandoverChecklistStatus>("DEFECT_MINOR");
  const [newNote, setNewNote] = useState<string>("");

  // Local compressed snag photos cache: key -> dataUrl | null (missing on this device)
  const [photoMap, setPhotoMap] = useState<Record<string, string | null>>({});
  const [uploadingPhotoItemId, setUploadingPhotoItemId] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<{ src: string; title: string } | null>(null);
  const photoInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Hydrate local photos from IndexedDB/localStorage vault
  useEffect(() => {
    let active = true;
    const keys = interiorStudio.handoverChecklist
      .map((i) => i.localPhotoKey)
      .filter((k): k is string => Boolean(k));

    if (keys.length === 0) return;

    void Promise.all(
      keys.map(async (key) => {
        const dataUrl = await loadSnagPhoto(key);
        return [key, dataUrl] as const;
      })
    ).then((entries) => {
      if (!active) return;
      setPhotoMap((prev) => {
        const next = { ...prev };
        for (const [k, v] of entries) {
          next[k] = v;
        }
        return next;
      });
    });

    return () => {
      active = false;
    };
  }, [interiorStudio.handoverChecklist]);

  const counts = useMemo(() => {
    const res = {
      total: interiorStudio.handoverChecklist.length,
      PASSED: 0,
      DEFECT_MINOR: 0,
      DEFECT_CRITICAL: 0,
      PENDING: 0,
    };
    for (const item of interiorStudio.handoverChecklist) {
      res[resolveChecklistItemStatus(item)] += 1;
    }
    return res;
  }, [interiorStudio.handoverChecklist]);

  const inspectedCount = counts.PASSED + counts.DEFECT_MINOR + counts.DEFECT_CRITICAL;
  const passPct = counts.total > 0 ? Math.round((counts.PASSED / counts.total) * 100) : 0;

  const filteredItems = useMemo(() => {
    return interiorStudio.handoverChecklist.filter((item) => {
      const zoneOk = checklistZoneFilter === "ALL" || item.zoneCode === checklistZoneFilter;
      const statusOk =
        statusFilter === "ALL" || resolveChecklistItemStatus(item) === statusFilter;
      return zoneOk && statusOk;
    });
  }, [interiorStudio.handoverChecklist, checklistZoneFilter, statusFilter]);

  const handlePhotoPicked = async (itemId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingPhotoItemId(itemId);
    setPhotoError(null);
    try {
      const saved = await saveSnagPhoto(file);
      if (!saved.ok || !saved.key || !saved.dataUrl) {
        setPhotoError(saved.error || "Không thể nén và lưu ảnh hiện trường.");
        return;
      }
      // Remove previous local photo if replacing
      const existing = interiorStudio.handoverChecklist.find((i) => i.id === itemId);
      if (existing?.localPhotoKey && existing.localPhotoKey !== saved.key) {
        await deleteSnagPhoto(existing.localPhotoKey);
      }
      setPhotoMap((prev) => ({ ...prev, [saved.key!]: saved.dataUrl! }));
      updateHandoverChecklistPhoto(itemId, saved.key);
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : "Lỗi xử lý ảnh.");
    } finally {
      setUploadingPhotoItemId(null);
    }
  };

  const handleRemovePhoto = async (itemId: string, photoKey?: string) => {
    if (photoKey) {
      await deleteSnagPhoto(photoKey);
    }
    updateHandoverChecklistPhoto(itemId, undefined);
  };

  const handleCreateCustomSnag = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const zoneMeta = ZONE_OPTIONS.find((z) => z.code === newZoneCode) || ZONE_OPTIONS[0];
    addHandoverChecklistItem({
      zoneCode: zoneMeta.code,
      zoneName: zoneMeta.name,
      title: newTitle.trim(),
      specDetail: newSpecDetail.trim() || "Ghi nhận hiện trường ngày nghiệm thu bàn giao Q3/2027",
      status: newStatus,
      note: newNote.trim() || undefined,
    });
    setNewTitle("");
    setNewSpecDetail("");
    setNewNote("");
    setNewStatus("DEFECT_MINOR");
    setShowAddSnagForm(false);
  };

  const pendingDeleteItem = useMemo(
    () => interiorStudio.handoverChecklist.find((i) => i.id === pendingDeleteItemId) || null,
    [interiorStudio.handoverChecklist, pendingDeleteItemId]
  );

  return (
    <div className="space-y-4">
      {/* Top Progress + Snag KPI Summary + Actions */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1 flex-1 min-w-[240px]">
            <div className="flex items-center justify-between text-xs font-extrabold">
              <span>Biên bản Nghiệm thu Bàn giao &amp; Snag List · Căn A.12A.07</span>
              <span className="text-teal-700 dark:text-teal-300 tabular-nums">
                Đã kiểm {inspectedCount}/{counts.total} · Đạt {counts.PASSED} ({passPct}%)
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex">
              <div
                className="h-full bg-emerald-600 transition-all"
                style={{ width: `${counts.total > 0 ? (counts.PASSED / counts.total) * 100 : 0}%` }}
              />
              <div
                className="h-full bg-amber-500 transition-all"
                style={{
                  width: `${counts.total > 0 ? (counts.DEFECT_MINOR / counts.total) * 100 : 0}%`,
                }}
              />
              <div
                className="h-full bg-rose-600 transition-all"
                style={{
                  width: `${counts.total > 0 ? (counts.DEFECT_CRITICAL / counts.total) * 100 : 0}%`,
                }}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAddSnagForm((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-extrabold bg-teal-600 hover:bg-teal-700 text-white cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm lỗi hiện trường</span>
            </button>
            <button
              type="button"
              onClick={() => setPrintSnagOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border border-teal-300 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-200 hover:bg-teal-100 dark:hover:bg-teal-900/50 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Xuất Biên Bản PDF</span>
            </button>
            <button
              type="button"
              onClick={() => setShowDeveloperSpecSheet((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              <ImageIcon className="w-3.5 h-3.5 text-teal-600" />
              <span>{showDeveloperSpecSheet ? "Ẩn bảng CĐT" : "Tiêu chuẩn CĐT"}</span>
            </button>
            <button
              type="button"
              onClick={() => setConfirmResetOpen(true)}
              className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-600 cursor-pointer"
              title="Khôi phục cấu hình Studio mặc định"
              aria-label="Khôi phục cấu hình Studio mặc định"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 4-Status KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs tabular-nums">
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === "PASSED" ? "ALL" : "PASSED")}
            className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
              statusFilter === "PASSED"
                ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50"
                : "border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50"
            }`}
          >
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="w-3.5 h-3.5" /> Đạt chuẩn
            </span>
            <p className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
              {counts.PASSED}
            </p>
          </button>

          <button
            type="button"
            onClick={() =>
              setStatusFilter(statusFilter === "DEFECT_MINOR" ? "ALL" : "DEFECT_MINOR")
            }
            className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
              statusFilter === "DEFECT_MINOR"
                ? "border-amber-500 bg-amber-50 dark:bg-amber-950/50"
                : "border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50"
            }`}
          >
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-300">
              <AlertTriangle className="w-3.5 h-3.5" /> Lỗi nhẹ
            </span>
            <p className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
              {counts.DEFECT_MINOR}
            </p>
          </button>

          <button
            type="button"
            onClick={() =>
              setStatusFilter(statusFilter === "DEFECT_CRITICAL" ? "ALL" : "DEFECT_CRITICAL")
            }
            className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
              statusFilter === "DEFECT_CRITICAL"
                ? "border-rose-500 bg-rose-50 dark:bg-rose-950/50"
                : "border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50"
            }`}
          >
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 dark:text-rose-300">
              <AlertTriangle className="w-3.5 h-3.5" /> Lỗi nghiêm trọng
            </span>
            <p className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
              {counts.DEFECT_CRITICAL}
            </p>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === "PENDING" ? "ALL" : "PENDING")}
            className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
              statusFilter === "PENDING"
                ? "border-slate-500 bg-slate-100 dark:bg-slate-800"
                : "border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50"
            }`}
          >
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 dark:text-slate-400">
              <Clock className="w-3.5 h-3.5" /> Chờ kiểm tra
            </span>
            <p className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
              {counts.PENDING}
            </p>
          </button>
        </div>

        {photoError && (
          <div className="px-3 py-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs font-bold text-rose-700 dark:text-rose-300 flex items-center justify-between gap-2">
            <span>{photoError}</span>
            <button
              type="button"
              onClick={() => setPhotoError(null)}
              className="p-0.5 cursor-pointer"
              aria-label="Đóng thông báo lỗi ảnh"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Inline Collapsible Add Custom Snag Item Form */}
      {showAddSnagForm && (
        <form
          onSubmit={handleCreateCustomSnag}
          className="bg-white dark:bg-slate-900 border border-teal-300 dark:border-teal-800 rounded-xl p-4 space-y-3 shadow-xs"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-900 dark:text-white">
              Ghi nhận thêm lỗi hiện trường (Snag List)
            </h3>
            <button
              type="button"
              onClick={() => setShowAddSnagForm(false)}
              className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              aria-label="Đóng biểu mẫu thêm lỗi"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                Khu vực căn hộ
              </label>
              <select
                value={newZoneCode}
                onChange={(e) => setNewZoneCode(e.target.value)}
                className="w-full px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold"
              >
                {ZONE_OPTIONS.map((z) => (
                  <option key={z.code} value={z.code}>
                    Khu {z.code} · {z.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                Mức độ đánh giá
              </label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as HandoverChecklistStatus)}
                className="w-full px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold"
              >
                <option value="DEFECT_MINOR">Lỗi nhẹ (yêu cầu CĐT dặm/chỉnh)</option>
                <option value="DEFECT_CRITICAL">Lỗi nghiêm trọng (thấm, nứt, điện nước)</option>
                <option value="PENDING">Chờ kiểm tra lại</option>
                <option value="PASSED">Đạt chuẩn</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                Tên hạng mục / lỗi phát hiện
              </label>
              <input
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="VD: Gạch nền ban công bị bộp góc trái"
                className="w-full px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              value={newSpecDetail}
              onChange={(e) => setNewSpecDetail(e.target.value)}
              placeholder="Vị trí / quy chuẩn đối chiếu (VD: Cách cửa lùa 30cm)"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
            />
            <input
              type="text"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Yêu cầu khắc phục gửi CĐT trước khi ký nhận"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddSnagForm(false)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-extrabold cursor-pointer"
            >
              Lưu vào Snag List
            </button>
          </div>
        </form>
      )}

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

      {/* Zone + Status Filters */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {["ALL", "01", "02", "03", "04", "05", "06", "07", "08"].map((z) => (
            <button
              key={z}
              type="button"
              onClick={() => setChecklistZoneFilter(z)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                checklistZoneFilter === z
                  ? "bg-teal-600 text-white"
                  : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300"
              }`}
            >
              {z === "ALL" ? "Tất cả khu 01–08" : `Khu ${z}`}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1">
          {(
            [
              { id: "ALL", label: "Mọi trạng thái" },
              { id: "DEFECT_CRITICAL", label: "Nghiêm trọng" },
              { id: "DEFECT_MINOR", label: "Lỗi nhẹ" },
              { id: "PENDING", label: "Chờ kiểm" },
              { id: "PASSED", label: "Đạt" },
            ] as { id: HandoverChecklistStatus | "ALL"; label: string }[]
          ).map((st) => (
            <button
              key={st.id}
              type="button"
              onClick={() => setStatusFilter(st.id)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold border cursor-pointer ${
                statusFilter === st.id
                  ? "bg-slate-900 dark:bg-teal-500 text-white dark:text-slate-950 border-slate-900 dark:border-teal-500"
                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300"
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* Checklist Items */}
      <div className="space-y-2.5">
        {filteredItems.map((item) => {
          const itemStatus = resolveChecklistItemStatus(item);
          const photoDataUrl = item.localPhotoKey ? photoMap[item.localPhotoKey] : undefined;
          const isUploading = uploadingPhotoItemId === item.id;

          return (
            <div
              key={item.id}
              className={`bg-white dark:bg-slate-900 border rounded-xl p-4 space-y-3 ${
                itemStatus === "DEFECT_CRITICAL"
                  ? "border-rose-300 dark:border-rose-800"
                  : itemStatus === "DEFECT_MINOR"
                    ? "border-amber-300 dark:border-amber-800"
                    : "border-slate-200 dark:border-slate-800"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex-1 min-w-[220px]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-bold text-teal-700 dark:text-teal-400">
                      Khu {item.zoneCode} · {item.zoneName}
                    </span>
                    {item.isCustom && (
                      <span className="px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-extrabold">
                        Lỗi hiện trường tự thêm
                      </span>
                    )}
                  </div>
                  <p
                    className={`text-sm font-extrabold mt-0.5 ${
                      itemStatus === "PASSED"
                        ? "line-through text-slate-400"
                        : "text-slate-900 dark:text-white"
                    }`}
                  >
                    {item.title}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {item.specDetail}
                  </p>
                </div>

                {/* 4-Status Segmented Selector + Delete Custom */}
                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  <div
                    role="group"
                    aria-label={`Trạng thái kiểm tra ${item.title}`}
                    className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-50 dark:bg-slate-800/70 p-0.5 gap-0.5"
                  >
                    {(
                      ["PENDING", "PASSED", "DEFECT_MINOR", "DEFECT_CRITICAL"] as HandoverChecklistStatus[]
                    ).map((st) => {
                      const active = itemStatus === st;
                      return (
                        <button
                          key={st}
                          type="button"
                          onClick={() => updateHandoverChecklistStatus(item.id, st)}
                          className={`px-2 py-1 rounded-md text-[11px] font-bold whitespace-nowrap transition-colors cursor-pointer ${
                            active
                              ? STATUS_META[st].activeClass
                              : "text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700"
                          }`}
                        >
                          {STATUS_META[st].shortLabel}
                        </button>
                      );
                    })}
                  </div>

                  {item.isCustom && (
                    <button
                      type="button"
                      onClick={() => setPendingDeleteItemId(item.id)}
                      title="Xóa mục lỗi tự thêm này"
                      aria-label={`Xóa lỗi ${item.title}`}
                      className="p-1.5 rounded-lg border border-rose-200 dark:border-rose-900 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Note + Compressed Local Photo Attachment Row */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input
                  type="text"
                  value={item.note || ""}
                  onChange={(e) => updateHandoverChecklistNote(item.id, e.target.value)}
                  placeholder="Ghi chú lỗi cần CĐT khắc phục (vết xước, độ dốc thoát nước, keo ron...)"
                  className="flex-1 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200"
                />

                <input
                  ref={(el) => {
                    photoInputRefs.current[item.id] = el;
                  }}
                  type="file"
                  accept="image/*"
                  onChange={(e) => void handlePhotoPicked(item.id, e)}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => photoInputRefs.current[item.id]?.click()}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:border-teal-500 text-xs font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap cursor-pointer disabled:opacity-50"
                >
                  <Camera className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                  <span>
                    {isUploading
                      ? "Đang nén..."
                      : item.localPhotoKey
                        ? "Đổi ảnh"
                        : "Đính ảnh lỗi"}
                  </span>
                </button>
              </div>

              {/* Local Photo Preview or 2nd-Device Fallback */}
              {item.localPhotoKey && (
                <div className="flex items-center gap-3 pt-1">
                  {photoDataUrl ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setLightboxPhoto({ src: photoDataUrl, title: item.title })}
                        className="relative group rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 cursor-pointer shrink-0"
                        title="Phóng to ảnh hiện trường"
                      >
                        <img
                          src={photoDataUrl}
                          alt={`Ảnh hiện trường: ${item.title}`}
                          className="w-24 h-16 object-cover"
                        />
                      </button>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
                        <p className="font-semibold text-slate-700 dark:text-slate-200">
                          Ảnh hiện trường đã nén &amp; lưu cục bộ trên máy này (≤ 150KB)
                        </p>
                        <button
                          type="button"
                          onClick={() => void handleRemovePhoto(item.id, item.localPhotoKey)}
                          className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-bold hover:underline cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" /> Gỡ ảnh đính kèm
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-between gap-2 w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-dashed border-slate-300 dark:border-slate-700 text-[11px] text-slate-500 dark:text-slate-400">
                      <span>Ảnh gốc lưu cục bộ trên máy chụp (tải lại nếu cần in trên máy này).</span>
                      <button
                        type="button"
                        onClick={() => void handleRemovePhoto(item.id, item.localPhotoKey)}
                        className="text-rose-600 dark:text-rose-400 font-bold hover:underline cursor-pointer shrink-0"
                      >
                        Xóa liên kết
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {filteredItems.length === 0 && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center text-xs text-slate-500 dark:text-slate-400">
            Không có hạng mục nào khớp bộ lọc khu vực / trạng thái hiện tại.
          </div>
        )}
      </div>

      {/* Lightbox Preview */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4"
          onClick={() => setLightboxPhoto(null)}
        >
          <div
            className="max-w-3xl w-full bg-white dark:bg-slate-900 rounded-xl overflow-hidden shadow-2xl border border-slate-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
              <p className="text-xs font-black text-slate-900 dark:text-white truncate">
                {lightboxPhoto.title}
              </p>
              <button
                type="button"
                onClick={() => setLightboxPhoto(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-700 cursor-pointer"
                aria-label="Đóng xem ảnh"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 bg-slate-950 flex items-center justify-center">
              <img
                src={lightboxPhoto.src}
                alt={lightboxPhoto.title}
                className="max-h-[75vh] w-auto rounded object-contain"
              />
            </div>
          </div>
        </div>
      )}

      {/* Printable Snag List A4 Portal */}
      {printSnagOpen && (
        <SnagListPrintPortal
          apartmentCode={interiorStudio.apartmentCode}
          items={interiorStudio.handoverChecklist}
          photoMap={photoMap}
          onDone={() => setPrintSnagOpen(false)}
        />
      )}

      <ConfirmDialog
        isOpen={Boolean(pendingDeleteItem)}
        isDanger
        title="Xóa mục lỗi hiện trường này?"
        message={
          pendingDeleteItem
            ? `Hạng mục "${pendingDeleteItem.title}" và ảnh đính kèm cục bộ (nếu có) sẽ bị xóa khỏi biên bản nghiệm thu.`
            : ""
        }
        confirmLabel="Xóa mục lỗi"
        cancelLabel="Hủy"
        onCancel={() => setPendingDeleteItemId(null)}
        onConfirm={() => {
          if (pendingDeleteItem) {
            if (pendingDeleteItem.localPhotoKey) {
              void deleteSnagPhoto(pendingDeleteItem.localPhotoKey);
            }
            deleteHandoverChecklistItem(pendingDeleteItem.id);
          }
          setPendingDeleteItemId(null);
        }}
      />

      <ConfirmDialog
        isOpen={confirmResetOpen}
        isDanger
        title="Khôi phục Studio Nội Thất về mặc định?"
        message="Toàn bộ tùy chỉnh đồ nội thất 3D, dự toán BOQ phát sinh, bản đồ điện nước MEP và ghi chú nghiệm thu sẽ được đặt lại về cấu hình gốc ban đầu của căn A.12A.07."
        confirmLabel="Khôi phục mặc định"
        cancelLabel="Hủy bỏ"
        onCancel={() => setConfirmResetOpen(false)}
        onConfirm={() => {
          resetInteriorStudio();
          setConfirmResetOpen(false);
        }}
      />
    </div>
  );
}
