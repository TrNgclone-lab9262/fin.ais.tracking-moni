/**
 * @file IOSInstallModal.tsx
 * @description Modal hướng dẫn cài đặt HOME MONI lên màn hình chính cho iPhone/iPad (Safari iOS)
 */

import React, { useMemo } from 'react';
import { X, Share, PlusSquare, Smartphone, AlertTriangle } from 'lucide-react';

interface IOSInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function IOSInstallModal({ isOpen, onClose }: IOSInstallModalProps) {
  const { isInIframe, isNonSafariBrowser } = useMemo(() => {
    if (typeof window === 'undefined') {
      return { isInIframe: false, isNonSafariBrowser: false };
    }
    let inIframe = false;
    try {
      inIframe = window.self !== window.top;
    } catch {
      inIframe = true;
    }
    const ua = window.navigator.userAgent.toLowerCase();
    const isApple = /iphone|ipad|ipod/.test(ua);
    const nonSafari =
      isApple && /(crios|fxios|edgios|opios|zalo|fban|fbav|instagram|line)/.test(ua);
    return { isInIframe: inIframe, isNonSafariBrowser: nonSafari };
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 pb-safe bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in slide-in-from-bottom duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-[#F6F8FB] dark:bg-slate-800/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#1E3A8A] flex items-center justify-center shadow-xs">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Cài đặt HOME MONI trên iPhone</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Sử dụng toàn màn hình chuẩn PWA</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Thân hướng dẫn */}
        <div className="p-5 space-y-3.5">
          {(isInIframe || isNonSafariBrowser) && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70 text-amber-900 dark:text-amber-200">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <p className="text-xs leading-relaxed">
                {isInIframe
                  ? 'Bạn đang xem ứng dụng trong khung xem trước. Hãy mở liên kết trực tiếp của HOME MONI bằng Safari rồi mới thực hiện 3 bước dưới đây để cài đúng chế độ toàn màn hình.'
                  : 'Hãy mở liên kết HOME MONI bằng trình duyệt Safari (biểu tượng la bàn) trước khi thêm vào màn hình chính.'}
              </p>
            </div>
          )}

          <div className="flex items-start gap-3.5 p-3 rounded-xl bg-blue-50/60 dark:bg-blue-500/15 border border-blue-100/80 dark:border-blue-500/30">
            <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
              1
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                Mở link trực tiếp trong Safari &amp; bấm Chia sẻ <Share className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 inline" />
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                Trên thanh công cụ phía dưới màn hình của trình duyệt Safari.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5 p-3 rounded-xl bg-blue-50/60 dark:bg-blue-500/15 border border-blue-100/80 dark:border-blue-500/30">
            <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
              2
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                Chọn &quot;Thêm vào MH chính&quot; <PlusSquare className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 inline" />
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                Cuộn xuống danh sách tùy chọn và nhấn vào dòng có dấu cộng.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5 p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-500/15 border border-emerald-100/80 dark:border-emerald-500/30">
            <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
              3
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                Nhấn &quot;Thêm&quot; (Add) ở góc trên bên phải
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                Icon HOME MONI sẽ xuất hiện trên màn hình chính với giao diện tràn viền chuẩn Dynamic Island!
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-800/70 border-t border-slate-100 dark:border-slate-800 flex justify-end">
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
