/**
 * @file IOSInstallModal.tsx
 * @description Modal hướng dẫn cài đặt HOME MONI lên màn hình chính cho iPhone/iPad (Safari iOS)
 */

import React from 'react';
import { X, Share, PlusSquare, Smartphone } from 'lucide-react';

interface IOSInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function IOSInstallModal({ isOpen, onClose }: IOSInstallModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in slide-in-from-bottom duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-[#F6F8FB]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#1E3A8A] flex items-center justify-center shadow-xs">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Cài đặt HOME MONI trên iPhone</h3>
              <p className="text-xs text-slate-500 font-medium">Sử dụng mượt mà không thanh địa chỉ</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Thân hướng dẫn 3 bước */}
        <div className="p-5 space-y-4">
          <div className="flex items-start gap-3.5 p-3 rounded-xl bg-blue-50/60 border border-blue-100/80">
            <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
              1
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                Bấm nút Chia sẻ <Share className="w-3.5 h-3.5 text-blue-600 inline" />
              </p>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                Trên thanh công cụ phía dưới màn hình của trình duyệt Safari.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5 p-3 rounded-xl bg-blue-50/60 border border-blue-100/80">
            <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
              2
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                Chọn &quot;Thêm vào MH chính&quot; <PlusSquare className="w-3.5 h-3.5 text-blue-600 inline" />
              </p>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                Cuộn xuống danh sách tùy chọn và nhấn vào dòng có dấu cộng.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5 p-3 rounded-xl bg-emerald-50/60 border border-emerald-100/80">
            <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
              3
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">
                Nhấn &quot;Thêm&quot; (Add) ở góc trên bên phải
              </p>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                Icon HOME MONI sẽ xuất hiện trên màn hình chính như một ứng dụng thật!
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="w-full py-2.5 px-4 bg-[#1E3A8A] hover:bg-blue-800 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer"
          >
            Đã hiểu, đóng hướng dẫn
          </button>
        </div>
      </div>
    </div>
  );
}
