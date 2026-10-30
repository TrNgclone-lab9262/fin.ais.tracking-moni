/**
 * @file PWAInstallBanner.tsx
 * @description Banner gợi ý cài đặt HOME MONI lên màn hình chính cho 2 vợ chồng (Calm Slate Fintech)
 */

import React, { useState } from 'react';
import { usePWAInstall } from '@/src/hooks/usePWAInstall';
import { IOSInstallModal } from '@/components/common/IOSInstallModal';
import { Download, Smartphone, X } from 'lucide-react';

export function PWAInstallBanner() {
  const { isInstallable, isInstalled, isIOS, isBannerDismissed, installApp, dismissBanner } =
    usePWAInstall();
  const [isIOSModalOpen, setIsIOSModalOpen] = useState(false);

  // Không hiển thị nếu đã cài đặt hoặc người dùng đã bấm tắt
  if (isInstalled || isBannerDismissed) {
    return null;
  }

  // Chỉ hiển thị khi có thể cài đặt (Chromium) hoặc thiết bị iOS
  if (!isInstallable && !isIOS) {
    return null;
  }

  const handleAction = async () => {
    if (isIOS) {
      setIsIOSModalOpen(true);
    } else {
      await installApp();
    }
  };

  return (
    <>
      <div className="bg-gradient-to-r from-[#1E3A8A] via-[#1E40AF] to-[#2563EB] text-white px-3 sm:px-4 py-2 sm:py-2.5 shadow-md flex items-center justify-between gap-3 text-xs border-b border-blue-800 animate-in slide-in-from-top duration-300">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white/10 backdrop-blur-xs flex items-center justify-center shrink-0 border border-white/20">
            {isIOS ? (
              <Smartphone className="w-4 h-4 text-sky-200" />
            ) : (
              <Download className="w-4 h-4 text-sky-200" />
            )}
          </div>
          <div className="truncate">
            <span className="font-bold tracking-tight">Cài đặt HOME MONI</span>
            <span className="hidden sm:inline text-blue-100 font-medium ml-1.5">
              • Trải nghiệm ứng dụng toàn màn hình mượt mà cho 2 vợ chồng
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleAction}
            className="px-3 py-1.5 bg-white text-[#1E3A8A] hover:bg-blue-50 active:scale-95 text-xs font-bold rounded-lg transition-all shadow-xs cursor-pointer"
          >
            {isIOS ? 'Xem hướng dẫn iOS' : 'Cài đặt ngay'}
          </button>
          <button
            onClick={dismissBanner}
            aria-label="Đóng banner"
            className="p-1 text-white/70 hover:text-white hover:bg-white/10 rounded-md transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Modal Hướng Dẫn Dành Riêng Cho iPhone/iPad */}
      <IOSInstallModal isOpen={isIOSModalOpen} onClose={() => setIsIOSModalOpen(false)} />
    </>
  );
}
