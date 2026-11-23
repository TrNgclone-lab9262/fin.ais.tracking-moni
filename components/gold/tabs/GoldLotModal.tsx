"use client";

import React, { useEffect, useRef, useState } from "react";
import { Camera, Check, Loader2, ShieldCheck, Sparkles, X } from "lucide-react";
import {
  Account,
  FamilyMember,
  GoldCategory,
  GoldLot,
  GoldPortfolioState,
  GoldStorageLocation,
} from "@/types/finance";
import { GOLD_CATEGORY_META, GOLD_STORAGE_LABELS } from "@/lib/goldEngine";
import { postAiJson } from "@/lib/aiFetch";
import {
  BRAND_SUGGESTIONS,
  GOLD_CATEGORIES,
  PURITY_SUGGESTIONS,
} from "./goldConstants";

interface GoldLotModalProps {
  open: boolean;
  editingLot: GoldLot | null;
  goldPortfolio: GoldPortfolioState;
  nonCreditAccounts: Account[];
  husbandName: string;
  wifeName: string;
  onClose: () => void;
  onAddLot: (
    lot: Omit<GoldLot, "id" | "createdAt" | "updatedAt" | "remainingChi" | "status">,
    options?: { linkAccountId?: string }
  ) => void;
  onUpdateLot: (id: string, patch: Partial<GoldLot>) => void;
}

export function GoldLotModal({
  open,
  editingLot,
  goldPortfolio,
  nonCreditAccounts,
  husbandName,
  wifeName,
  onClose,
  onAddLot,
  onUpdateLot,
}: GoldLotModalProps) {
  const [lotCategory, setLotCategory] = useState<GoldCategory>("NHAN_9999");
  const [lotBrand, setLotBrand] = useState("PNJ 9999");
  const [lotUnit, setLotUnit] = useState<"CHI" | "LUONG">("CHI");
  const [lotQtyInput, setLotQtyInput] = useState("2");
  const [lotBuyPriceInput, setLotBuyPriceInput] = useState(
    String(goldPortfolio.quotes.NHAN_9999.sellPricePerChi)
  );
  const [lotMakingFeeInput, setLotMakingFeeInput] = useState("0");
  const [lotDate, setLotDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [lotMember, setLotMember] = useState<FamilyMember>("SHARED");
  const [lotStorage, setLotStorage] = useState<GoldStorageLocation>("HOME_SAFE");
  const [lotPurity, setLotPurity] = useState("999.9 (24K)");
  const [lotSerial, setLotSerial] = useState("");
  const [lotCertificate, setLotCertificate] = useState("");
  const [lotStoreName, setLotStoreName] = useState("");
  const [lotNote, setLotNote] = useState("");
  const [lotLinkAccountId, setLotLinkAccountId] = useState("");
  const [isScanningInvoice, setIsScanningInvoice] = useState(false);
  const [scanStatus, setScanStatus] = useState<{
    type: "success" | "warning" | "error";
    message: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    if (editingLot) {
      setLotCategory(editingLot.category);
      setLotBrand(editingLot.brand);
      setLotUnit("CHI");
      setLotQtyInput(String(editingLot.quantityChi));
      setLotBuyPriceInput(String(editingLot.unitBuyPricePerChi));
      setLotMakingFeeInput(String(editingLot.makingFee || 0));
      setLotDate(editingLot.purchaseDate);
      setLotMember(editingLot.memberId);
      setLotStorage(editingLot.storageLocation);
      setLotPurity(editingLot.purityLabel || PURITY_SUGGESTIONS[editingLot.category]);
      setLotSerial(editingLot.serialNumber || "");
      setLotCertificate(editingLot.certificateCode || "");
      setLotStoreName(editingLot.storeName || "");
      setLotNote(editingLot.invoiceNote || "");
      setLotLinkAccountId("");
    } else {
      setLotCategory("NHAN_9999");
      setLotBrand("PNJ 9999");
      setLotUnit("CHI");
      setLotQtyInput("2");
      setLotBuyPriceInput(String(goldPortfolio.quotes.NHAN_9999.sellPricePerChi));
      setLotMakingFeeInput("0");
      setLotDate(new Date().toISOString().slice(0, 10));
      setLotMember("SHARED");
      setLotStorage("HOME_SAFE");
      setLotPurity(PURITY_SUGGESTIONS.NHAN_9999);
      setLotSerial("");
      setLotCertificate("");
      setLotStoreName("");
      setLotNote("");
      setLotLinkAccountId("");
    }
    setScanStatus(null);
    setIsScanningInvoice(false);
  }, [open, editingLot, goldPortfolio.quotes]);

  if (!open) return null;

  const isEdit = Boolean(editingLot);

  const compressImageToJpegBase64 = (file: File): Promise<{ base64: string; mimeType: string }> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Không thể đọc tệp ảnh hóa đơn."));
      reader.onload = () => {
        const dataUrl = String(reader.result || "");
        const img = new Image();
        img.onerror = () => reject(new Error("Ảnh không hợp lệ hoặc bị hỏng."));
        img.onload = () => {
          const maxDim = 1400;
          const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            const rawBase64 = dataUrl.split(",")[1] || "";
            resolve({ base64: rawBase64, mimeType: file.type || "image/jpeg" });
            return;
          }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const compressed = canvas.toDataURL("image/jpeg", 0.82);
          resolve({
            base64: compressed.split(",")[1] || "",
            mimeType: "image/jpeg",
          });
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    });

  const handleInvoiceFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setIsScanningInvoice(true);
    setScanStatus(null);
    try {
      const { base64, mimeType } = await compressImageToJpegBase64(file);
      const res = await postAiJson("/api/ai/scan-gold-invoice", {
        imageBase64: base64,
        mimeType,
      });

      if (!res.ok) {
        const errPayload = (await res.json().catch(() => ({}))) as {
          message?: string;
          error?: string;
        };
        throw new Error(errPayload.message || errPayload.error || `HTTP ${res.status}`);
      }

      const payload = (await res.json()) as {
        source?: string;
        reason?: string;
        result?: {
          category?: GoldCategory;
          brand?: string;
          purchaseDate?: string;
          quantityChi?: number;
          unitBuyPricePerChi?: number;
          makingFee?: number;
          serialNumber?: string;
          certificateCode?: string;
          storeName?: string;
          purityLabel?: string;
          invoiceNote?: string;
          confidence?: number;
        };
      };

      if (payload.source !== "gemini" || !payload.result) {
        setScanStatus({
          type: "warning",
          message:
            payload.reason === "GEMINI_API_KEY_NOT_CONFIGURED"
              ? "Chưa cấu hình GEMINI_API_KEY trên server — vui lòng nhập tay thông tin hóa đơn bên dưới."
              : "Không thể nhận diện rõ ảnh hóa đơn vàng. Bạn có thể chụp nét hơn hoặc nhập tay trực tiếp.",
        });
        return;
      }

      const r = payload.result;
      if (r.category && GOLD_CATEGORIES.includes(r.category)) {
        setLotCategory(r.category);
      }
      if (r.brand) setLotBrand(r.brand);
      if (r.purchaseDate) setLotDate(r.purchaseDate);
      if (r.quantityChi && r.quantityChi > 0) {
        setLotUnit("CHI");
        setLotQtyInput(String(r.quantityChi));
      }
      if (r.unitBuyPricePerChi && r.unitBuyPricePerChi > 0) {
        setLotBuyPriceInput(String(r.unitBuyPricePerChi));
      }
      if (typeof r.makingFee === "number" && r.makingFee >= 0) {
        setLotMakingFeeInput(String(r.makingFee));
      }
      if (r.serialNumber) setLotSerial(r.serialNumber);
      if (r.certificateCode) setLotCertificate(r.certificateCode);
      if (r.storeName) setLotStoreName(r.storeName);
      if (r.purityLabel) setLotPurity(r.purityLabel);
      if (r.invoiceNote) setLotNote(r.invoiceNote);

      const pct = Math.round((r.confidence ?? 0.85) * 100);
      setScanStatus({
        type: "success",
        message: `Đã tự động điền từ hóa đơn vàng (độ tin cậy ~${pct}%). Vui lòng kiểm tra lại số chỉ, đơn giá & số seri trước khi lưu.`,
      });
    } catch {
      setScanStatus({
        type: "error",
        message: "Lỗi kết nối khi quét hóa đơn vàng. Bạn vẫn có thể nhập thủ công bình thường.",
      });
    } finally {
      setIsScanningInvoice(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const rawQty = Number(lotQtyInput);
    const buyPrice = Number(lotBuyPriceInput);
    const makingFee = Math.max(0, Number(lotMakingFeeInput) || 0);
    if (!Number.isFinite(rawQty) || rawQty <= 0 || !Number.isFinite(buyPrice) || buyPrice <= 0) {
      return;
    }

    const quantityChi = Math.round((lotUnit === "LUONG" ? rawQty * 10 : rawQty) * 1000) / 1000;
    const cleanBrand = lotBrand.trim() || GOLD_CATEGORY_META[lotCategory].defaultBrand;

    if (editingLot) {
      const soldAlready = Math.max(0, editingLot.quantityChi - editingLot.remainingChi);
      const nextRemaining = Math.max(0, Number((quantityChi - soldAlready).toFixed(4)));
      const nextStatus: GoldLot["status"] =
        nextRemaining <= 0.0001
          ? "SOLD"
          : soldAlready > 0.0001
            ? "PARTIAL_SOLD"
            : "HOLDING";

      onUpdateLot(editingLot.id, {
        category: lotCategory,
        brand: cleanBrand,
        purchaseDate: lotDate,
        quantityChi,
        remainingChi: nextRemaining,
        status: nextStatus,
        unitBuyPricePerChi: Math.round(buyPrice),
        makingFee: Math.round(makingFee),
        memberId: lotMember,
        storageLocation: lotStorage,
        purityLabel: lotPurity.trim() || undefined,
        serialNumber: lotSerial.trim() || undefined,
        certificateCode: lotCertificate.trim() || undefined,
        storeName: lotStoreName.trim() || undefined,
        invoiceNote: lotNote.trim() || undefined,
      });
    } else {
      onAddLot(
        {
          category: lotCategory,
          brand: cleanBrand,
          purchaseDate: lotDate,
          quantityChi,
          unitBuyPricePerChi: Math.round(buyPrice),
          makingFee: Math.round(makingFee),
          memberId: lotMember,
          storageLocation: lotStorage,
          purityLabel: lotPurity.trim() || undefined,
          serialNumber: lotSerial.trim() || undefined,
          certificateCode: lotCertificate.trim() || undefined,
          storeName: lotStoreName.trim() || undefined,
          invoiceNote: lotNote.trim() || undefined,
        },
        { linkAccountId: lotLinkAccountId || undefined }
      );
    }

    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
              {isEdit ? "Chỉnh sửa lô vàng & Chứng từ Seri" : "Ghi nhận lô mua vàng mới"}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {isEdit
                ? "Cập nhật thông tin giá vốn, nơi cất giữ hoặc số seri / hóa đơn ép vỉ."
                : "Nhập khối lượng, giá mua thực tế và lưu thông tin két chứng từ."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng hộp thoại lô vàng"
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {/* AI Gold Invoice Scanner */}
          <div className="p-3 rounded-lg bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/70 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <div>
                  <p className="font-extrabold text-amber-950 dark:text-amber-200">
                    Quét hóa đơn / giấy đảm bảo vàng bằng AI
                  </p>
                  <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80">
                    Tự trích xuất loại vàng, số chỉ, đơn giá, tiền công, số seri & cửa hàng (PNJ, SJC, DOJI...)
                  </p>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleInvoiceFileChange}
                className="hidden"
              />
              <button
                type="button"
                disabled={isScanningInvoice}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white font-bold cursor-pointer shrink-0"
              >
                {isScanningInvoice ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Camera className="w-3.5 h-3.5" />
                )}
                <span>{isScanningInvoice ? "Đang đọc hóa đơn..." : "Chụp / Tải ảnh hóa đơn"}</span>
              </button>
            </div>
            {scanStatus && (
              <p
                className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-md ${
                  scanStatus.type === "success"
                    ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                    : scanStatus.type === "warning"
                      ? "bg-white/80 dark:bg-slate-900/80 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800"
                      : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                }`}
              >
                {scanStatus.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
                Loại vàng
              </label>
              <select
                value={lotCategory}
                onChange={(e) => {
                  const nextCat = e.target.value as GoldCategory;
                  setLotCategory(nextCat);
                  if (!isEdit) {
                    setLotBrand(BRAND_SUGGESTIONS[nextCat][0]);
                    setLotBuyPriceInput(String(goldPortfolio.quotes[nextCat].sellPricePerChi));
                    setLotPurity(PURITY_SUGGESTIONS[nextCat]);
                  }
                }}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
              >
                {GOLD_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {GOLD_CATEGORY_META[c].label}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-span-2">
              <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
                Thương hiệu / Quy cách
              </label>
              <input
                type="text"
                required
                value={lotBrand}
                onChange={(e) => setLotBrand(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold"
              />
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {BRAND_SUGGESTIONS[lotCategory].map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setLotBrand(b)}
                    className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-amber-100 dark:hover:bg-amber-950/60 text-[11px] font-semibold cursor-pointer"
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
                Số lượng gốc ({lotUnit === "CHI" ? "Chỉ" : "Lượng"})
              </label>
              <div className="flex gap-1.5">
                <input
                  type="number"
                  step="0.05"
                  min="0.05"
                  required
                  value={lotQtyInput}
                  onChange={(e) => setLotQtyInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold tabular-nums"
                />
                {!isEdit && (
                  <button
                    type="button"
                    onClick={() => setLotUnit((u) => (u === "CHI" ? "LUONG" : "CHI"))}
                    className="px-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-bold border border-amber-200 dark:border-amber-800 cursor-pointer shrink-0"
                  >
                    {lotUnit === "CHI" ? "Chỉ" : "Lượng"}
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
                Giá mua thực tế (VNĐ / 1 Chỉ)
              </label>
              <input
                type="number"
                step="10000"
                min="100000"
                required
                value={lotBuyPriceInput}
                onChange={(e) => setLotBuyPriceInput(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold tabular-nums"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
                Tiền công / phí (VNĐ)
              </label>
              <input
                type="number"
                step="10000"
                min="0"
                value={lotMakingFeeInput}
                onChange={(e) => setLotMakingFeeInput(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold tabular-nums"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
                Ngày mua
              </label>
              <input
                type="date"
                required
                value={lotDate}
                onChange={(e) => setLotDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
                Thành viên
              </label>
              <select
                value={lotMember}
                onChange={(e) => setLotMember(e.target.value as FamilyMember)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold"
              >
                <option value="SHARED">Chung 2 vợ chồng</option>
                <option value="HUSBAND">{husbandName}</option>
                <option value="WIFE">{wifeName}</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
                Nơi cất trữ
              </label>
              <select
                value={lotStorage}
                onChange={(e) => setLotStorage(e.target.value as GoldStorageLocation)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold"
              >
                {(Object.keys(GOLD_STORAGE_LABELS) as GoldStorageLocation[]).map((loc) => (
                  <option key={loc} value={loc}>
                    {GOLD_STORAGE_LABELS[loc]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Két Chứng Từ & Seri */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Két Chứng Từ, Seri & Nguồn gốc (Chống mất giá khi bán lại)</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Số seri vỉ / miếng
                </label>
                <input
                  type="text"
                  value={lotSerial}
                  onChange={(e) => setLotSerial(e.target.value)}
                  placeholder="VD: SJC-A889241"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Mã hóa đơn / Giấy đảm bảo
                </label>
                <input
                  type="text"
                  value={lotCertificate}
                  onChange={(e) => setLotCertificate(e.target.value)}
                  placeholder="VD: HD-PNJ-2026-0412"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Cửa hàng / Chi nhánh mua
                </label>
                <input
                  type="text"
                  value={lotStoreName}
                  onChange={(e) => setLotStoreName(e.target.value)}
                  placeholder="VD: PNJ Next Thủ Đức"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Tuổi vàng / Độ tinh khiết
                </label>
                <input
                  type="text"
                  value={lotPurity}
                  onChange={(e) => setLotPurity(e.target.value)}
                  placeholder="999.9 (24K)"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
              <div className="col-span-2">
                <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Ghi chú tình trạng ép vỉ / mục đích tích sản
                </label>
                <input
                  type="text"
                  value={lotNote}
                  onChange={(e) => setLotNote(e.target.value)}
                  placeholder="VD: Ép vỉ nguyên vẹn, giữ quỹ nhận nhà Q3/2027"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
            </div>
          </div>

          {!isEdit && (
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
              <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
                Liên thông Sổ Thu Chi (trừ tiền từ tài khoản nếu mua mới hôm nay)
              </label>
              <select
                value={lotLinkAccountId}
                onChange={(e) => setLotLinkAccountId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold"
              >
                <option value="">Chỉ ghi vào Kho Vàng (không trừ ví Thu Chi)</option>
                {nonCreditAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    Trừ từ ví: {acc.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg font-bold bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{isEdit ? "Lưu cập nhật" : "Lưu lô vàng"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
