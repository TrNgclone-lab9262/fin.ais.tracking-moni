"use client";

import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { HandoverChecklistItem, HandoverChecklistStatus } from "@/types/finance";

interface SnagListPrintPortalProps {
  apartmentCode: string;
  targetHandoverDate?: string;
  items: HandoverChecklistItem[];
  photoMap: Record<string, string | null>;
  onDone: () => void;
}

export function resolveChecklistItemStatus(
  item: Pick<HandoverChecklistItem, "checked" | "status">
): HandoverChecklistStatus {
  if (item.status) return item.status;
  return item.checked ? "PASSED" : "PENDING";
}

const STATUS_PRINT_LABEL: Record<HandoverChecklistStatus, string> = {
  PENDING: "Chờ kiểm tra",
  PASSED: "Đạt chuẩn",
  DEFECT_MINOR: "Lỗi nhẹ (CĐT xử lý)",
  DEFECT_CRITICAL: "Lỗi nghiêm trọng (Bắt buộc khắc phục)",
};

export function SnagListPrintPortal({
  apartmentCode,
  targetHandoverDate,
  items,
  photoMap,
  onDone,
}: SnagListPrintPortalProps) {
  useEffect(() => {
    document.body.classList.add("pdf-printing");
    const timer = window.setTimeout(() => {
      window.print();
    }, 200);

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

  const counts = items.reduce(
    (acc, item) => {
      const st = resolveChecklistItemStatus(item);
      acc[st] += 1;
      return acc;
    },
    { PENDING: 0, PASSED: 0, DEFECT_MINOR: 0, DEFECT_CRITICAL: 0 }
  );

  const groupedZones = Array.from(
    items.reduce((map, item) => {
      const key = `${item.zoneCode} · ${item.zoneName}`;
      const list = map.get(key) || [];
      list.push(item);
      map.set(key, list);
      return map;
    }, new Map<string, HandoverChecklistItem[]>())
  );

  const printDate = new Date().toLocaleDateString("vi-VN");

  return createPortal(
    <div className="pdf-print-portal fixed inset-0 z-[9999] bg-white text-slate-900 overflow-auto p-6">
      <div className="pdf-no-print mb-4 flex items-center justify-between p-3 rounded-lg bg-slate-100 border border-slate-300">
        <span className="text-xs font-bold text-slate-700">
          Biên bản Nghiệm thu Bàn giao &amp; Danh sách Lỗi (Snag List) sẵn sàng in / lưu PDF gửi Chủ đầu tư Phú Đông.
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

      <div className="max-w-[900px] mx-auto space-y-5 text-slate-900">
        {/* Header */}
        <div className="border-b-2 border-slate-900 pb-3 flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-teal-700">
              PHÚ ĐÔNG SKYONE · BIÊN BẢN NGHIỆM THU BÀN GIAO (SNAG LIST)
            </p>
            <h1 className="text-xl font-black text-slate-950 mt-0.5">
              Căn hộ {apartmentCode}
            </h1>
            <p className="text-xs text-slate-600 mt-1">
              Mốc bàn giao dự kiến: <strong>{targetHandoverDate || "2027-08-31"}</strong> · Chủ căn hộ: Anh Chuột &amp; Bé Mèo
            </p>
          </div>
          <div className="text-right text-xs tabular-nums shrink-0">
            <p className="font-bold text-slate-700">Ngày lập: {printDate}</p>
            <p className="text-[11px] text-slate-600 mt-0.5">
              Tổng cộng: <strong>{items.length}</strong> hạng mục
            </p>
          </div>
        </div>

        {/* Summary Strip */}
        <div className="grid grid-cols-4 gap-3 text-xs tabular-nums">
          <div className="p-2.5 rounded-lg border border-emerald-300 bg-emerald-50">
            <p className="text-[10px] font-bold uppercase text-emerald-700">Đạt chuẩn</p>
            <p className="text-lg font-black text-emerald-800">{counts.PASSED}</p>
          </div>
          <div className="p-2.5 rounded-lg border border-amber-300 bg-amber-50">
            <p className="text-[10px] font-bold uppercase text-amber-800">Lỗi nhẹ</p>
            <p className="text-lg font-black text-amber-900">{counts.DEFECT_MINOR}</p>
          </div>
          <div className="p-2.5 rounded-lg border border-rose-300 bg-rose-50">
            <p className="text-[10px] font-bold uppercase text-rose-700">Lỗi nghiêm trọng</p>
            <p className="text-lg font-black text-rose-800">{counts.DEFECT_CRITICAL}</p>
          </div>
          <div className="p-2.5 rounded-lg border border-slate-300 bg-slate-50">
            <p className="text-[10px] font-bold uppercase text-slate-600">Chờ kiểm tra</p>
            <p className="text-lg font-black text-slate-800">{counts.PENDING}</p>
          </div>
        </div>

        {/* Grouped Zones */}
        {groupedZones.map(([zoneHeader, zoneItems]) => (
          <div key={zoneHeader} className="space-y-1.5">
            <h2 className="text-xs font-black uppercase tracking-wide text-slate-900 bg-slate-100 px-2.5 py-1.5 rounded border border-slate-300">
              Khu {zoneHeader} ({zoneItems.length} hạng mục)
            </h2>
            <table className="w-full text-left border-collapse text-[10.5px]">
              <thead>
                <tr className="border-b border-slate-400 text-slate-700">
                  <th className="py-1.5 px-2 w-8">STT</th>
                  <th className="py-1.5 px-2">Hạng mục &amp; Tiêu chuẩn</th>
                  <th className="py-1.5 px-2 w-36">Trạng thái</th>
                  <th className="py-1.5 px-2 w-56">Ghi chú hiện trường &amp; Ảnh</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {zoneItems.map((item, idx) => {
                  const st = resolveChecklistItemStatus(item);
                  const photoSrc = item.localPhotoKey ? photoMap[item.localPhotoKey] : null;
                  return (
                    <tr key={item.id} className="align-top">
                      <td className="py-2 px-2 tabular-nums">{idx + 1}</td>
                      <td className="py-2 px-2">
                        <p className="font-bold text-slate-900">
                          {item.title}
                          {item.isCustom ? " [Bổ sung hiện trường]" : ""}
                        </p>
                        <p className="text-[9.5px] text-slate-600">{item.specDetail}</p>
                      </td>
                      <td className="py-2 px-2 font-bold whitespace-nowrap">
                        <span
                          className={
                            st === "PASSED"
                              ? "text-emerald-700"
                              : st === "DEFECT_CRITICAL"
                                ? "text-rose-700"
                                : st === "DEFECT_MINOR"
                                  ? "text-amber-700"
                                  : "text-slate-500"
                          }
                        >
                          {STATUS_PRINT_LABEL[st]}
                        </span>
                      </td>
                      <td className="py-2 px-2 space-y-1.5">
                        <p className="text-[10px] text-slate-700">
                          {item.note?.trim() || "—"}
                        </p>
                        {photoSrc ? (
                          <img
                            src={photoSrc}
                            alt={`Ảnh hiện trường: ${item.title}`}
                            className="w-28 h-20 object-cover rounded border border-slate-300"
                          />
                        ) : item.localPhotoKey ? (
                          <p className="text-[9px] italic text-slate-500">
                            (Ảnh gốc lưu cục bộ trên máy chụp)
                          </p>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}

        {/* Signature Block */}
        <div className="pt-6 grid grid-cols-2 gap-8 text-center text-xs">
          <div className="space-y-12">
            <p className="font-bold uppercase">Đại diện Chủ căn hộ (Bên nhận bàn giao)</p>
            <p className="text-slate-500">(Ký và ghi rõ họ tên)</p>
          </div>
          <div className="space-y-12">
            <p className="font-bold uppercase">Đại diện Ban QLDA / Chủ đầu tư Phú Đông</p>
            <p className="text-slate-500">(Ký xác nhận &amp; Cam kết thời hạn khắc phục)</p>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
