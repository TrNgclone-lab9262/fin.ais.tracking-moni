/**
 * @file usePWAInstall.ts
 * @description Hook quản lý cài đặt PWA đa nền tảng (Android/Chromium & iOS Safari)
 */

import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isBannerDismissed, setIsBannerDismissed] = useState(false);

  useEffect(() => {
    // 1. Kiểm tra xem app đã được chạy ở chế độ Standalone (đã cài đặt) chưa
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // 2. Kiểm tra xem có phải thiết bị iOS (iPhone/iPad) không
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isAppleDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isAppleDevice);

    // 3. Kiểm tra xem người dùng đã bấm tắt banner trước đó chưa (LocalStorage)
    const dismissedTime = localStorage.getItem('homemoni_pwa_dismissed');
    if (dismissedTime) {
      const parsedTime = parseInt(dismissedTime, 10);
      // Hiển thị lại sau 3 ngày nếu người dùng chưa cài
      if (Date.now() - parsedTime < 3 * 24 * 60 * 60 * 1000) {
        setIsBannerDismissed(true);
      }
    }

    // 4. Bắt sự kiện beforeinstallprompt trên trình duyệt Chromium / Android
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
      localStorage.removeItem('homemoni_pwa_dismissed');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const installApp = useCallback(async () => {
    if (!deferredPrompt) return false;

    try {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setIsInstalled(true);
        setIsInstallable(false);
        setDeferredPrompt(null);
        return true;
      }
    } catch (err) {
      console.warn('[PWA Install Error]', err);
    }
    return false;
  }, [deferredPrompt]);

  const dismissBanner = useCallback(() => {
    setIsBannerDismissed(true);
    localStorage.setItem('homemoni_pwa_dismissed', Date.now().toString());
  }, []);

  return {
    isInstallable,
    isInstalled,
    isIOS,
    isBannerDismissed,
    installApp,
    dismissBanner,
  };
}
