/**
 * @file ReceiptScannerModal.tsx
 * @description Modal quét bóc tách hóa đơn tự động bằng Gemini Vision AI cho HOME MONI
 */

import React, { useState, useRef } from 'react';
import { Camera, Upload, CheckCircle2, Sparkles, X, RefreshCw, AlertCircle } from 'lucide-react';
import { parseReceiptWithGemini, ParsedReceiptResult } from '@/lib/geminiReceiptService';
import { formatVND } from '@/lib/formatters';

interface ReceiptScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyReceipt: (result: ParsedReceiptResult) => void;
}

export function ReceiptScannerModal({ isOpen, onClose, onApplyReceipt }: ReceiptScannerModalProps) {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ParsedReceiptResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    setScanResult(null);

    // Tạo preview ảnh
    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Tiến hành quét bằng Gemini
    setIsScanning(true);
    try {
      const result = await parseReceiptWithGemini(file);
      setScanResult(result);
    } catch {
      setErrorMsg('Không thể bóc tách hóa đơn. Vui lòng thử lại với ảnh rõ nét hơn.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleReset = () => {
    setImagePreview(null);
    setScanResult(null);
    setErrorMsg(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleConfirm = () => {
    if (scanResult) {
      onApplyReceipt(scanResult);
      onClose();
      handleReset();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-[#F6F8FB]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-600 flex items-center justify-center text-white shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                Quét Hóa Đơn Thông Minh
              </h3>
              <p className="text-[11px] text-blue-600 font-semibold">Gemini 2.5 Flash Vision AI</p>
            </div>
          </div>
          <button
            onClick={() => {
              onClose();
              handleReset();
            }}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Vùng chụp / Chọn ảnh nếu chưa có ảnh */}
          {!imagePreview && (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 bg-slate-50/70 hover:bg-blue-50/30 transition-all cursor-pointer group"
            >
              <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform shadow-xs">
                <Camera className="w-7 h-7" />
              </div>
              <div className="text-center">
                <p className="text-xs font-bold text-slate-700">Chụp ảnh hoặc tải hóa đơn lên</p>
                <p className="text-[11px] text-slate-400 mt-1">Hỗ trợ JPG, PNG, WebP từ camera hoặc thư viện</p>
              </div>
              <button
                type="button"
                className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all pointer-events-none"
              >
                <Upload className="w-3.5 h-3.5" />
                Chọn ảnh hóa đơn
              </button>
            </div>
          )}

          {/* Vùng hiển thị ảnh đã chọn & Quá trình quét */}
          {imagePreview && (
            <div className="space-y-4">
              <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-900 max-h-56 flex items-center justify-center">
                <img src={imagePreview} alt="Hóa đơn" className="w-full h-auto object-contain max-h-56 opacity-90" />
                {isScanning && (
                  <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-2xs flex flex-col items-center justify-center text-white gap-2.5 p-4 text-center">
                    <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
                    <p className="text-xs font-bold text-slate-100">Gemini Vision AI đang đọc hóa đơn...</p>
                    <p className="text-[10px] text-slate-300">Đang nhận diện số tiền, cửa hàng & ngày chi</p>
                  </div>
                )}
              </div>

              {/* Thông báo lỗi nếu có */}
              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Kết quả bóc tách được */}
              {scanResult && !isScanning && (
                <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-xl space-y-2.5 animate-in fade-in duration-300">
                  <div className="flex items-center justify-between pb-2 border-b border-emerald-200/80">
                    <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Bóc tách thành công
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                      Độ tin cậy {Math.round(scanResult.confidence * 100)}%
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-500 font-semibold block">Số tiền:</span>
                      <span className="text-base font-black text-rose-600">{formatVND(scanResult.amount)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 font-semibold block">Ngày phát sinh:</span>
                      <span className="font-bold text-slate-700">{scanResult.date}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-[10px] text-slate-500 font-semibold block">Địa điểm / Cửa hàng:</span>
                      <span className="font-bold text-slate-800">{scanResult.merchantName}</span>
                    </div>
                    {scanResult.notes && (
                      <div className="col-span-2">
                        <span className="text-[10px] text-slate-500 font-semibold block">Ghi chú trích xuất:</span>
                        <span className="text-slate-600 italic text-[11px]">{scanResult.notes}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="image/*"
            capture="environment"
            className="hidden"
          />
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
          {imagePreview ? (
            <>
              <button
                type="button"
                onClick={handleReset}
                disabled={isScanning}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Chụp lại
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!scanResult || isScanning}
                className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:scale-95 disabled:opacity-50 disabled:pointer-events-none text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                Xác nhận & Điền giao dịch
              </button>
            </>
          ) : (
            <p className="text-[11px] text-slate-400 mx-auto text-center">
              Chụp rõ hóa đơn có số tiền và tên cửa hàng để AI nhận diện chuẩn xác nhất.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
