"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  APP_BUILD_ID,
  APP_CHANGELOG,
  APP_RELEASE_DATE,
  APP_VERSION,
  AppReleaseEntry,
  CURRENT_RELEASE,
  compareSemver,
} from '@/constants/appVersion';

export type PWAUpdateStatus =
  | 'IDLE'
  | 'CHECKING'
  | 'UP_TO_DATE'
  | 'UPDATE_AVAILABLE'
  | 'UPDATING'
  | 'JUST_UPDATED'
  | 'OFFLINE'
  | 'ERROR';

export type DevicePlatform = 'ios' | 'android' | 'desktop';

interface RemoteVersionPayload {
  version?: string;
  buildId?: string;
  releasedAt?: string;
  title?: string;
  highlights?: unknown;
  mandatory?: boolean;
}

interface PWAUpdateContextValue {
  status: PWAUpdateStatus;
  currentVersion: string;
  currentBuildId: string;
  currentReleaseDate: string;
  latestRelease: AppReleaseEntry | null;
  changelog: AppReleaseEntry[];
  lastCheckedAt: Date | null;
  isChecking: boolean;
  hasUpdate: boolean;
  hasWaitingWorker: boolean;
  isDismissedForSession: boolean;
  isReleaseNotesOpen: boolean;
  isOnline: boolean;
  isStandalone: boolean;
  platform: DevicePlatform;
  justUpdatedVersion: string | null;
  errorMessage: string | null;
  checkForUpdate: (options?: { silent?: boolean }) => Promise<PWAUpdateStatus>;
  applyUpdateNow: () => Promise<void>;
  dismissUpdateBanner: () => void;
  dismissJustUpdatedToast: () => void;
  openReleaseNotes: () => void;
  closeReleaseNotes: () => void;
}

const PWAUpdateContext = createContext<PWAUpdateContextValue | undefined>(undefined);

const JUST_UPDATED_STORAGE_KEY = 'HOME_MONI_JUST_UPDATED_VERSION';
const AUTO_CHECK_INTERVAL_MS = 15 * 60 * 1000;
const VISIBILITY_THROTTLE_MS = 15 * 1000;

function detectPlatform(): DevicePlatform {
  if (typeof window === 'undefined') return 'desktop';
  const ua = window.navigator.userAgent || '';
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  if (/android/i.test(ua)) return 'android';
  return 'desktop';
}

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    nav.standalone === true
  );
}

function normalizeRemoteRelease(payload: RemoteVersionPayload): AppReleaseEntry | null {
  if (!payload || typeof payload.version !== 'string' || !payload.version.trim()) {
    return null;
  }
  const highlights = Array.isArray(payload.highlights)
    ? payload.highlights.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];

  return {
    version: payload.version.trim(),
    buildId: typeof payload.buildId === 'string' && payload.buildId.trim()
      ? payload.buildId.trim()
      : `v${payload.version.trim()}`,
    releasedAt: typeof payload.releasedAt === 'string' && payload.releasedAt.trim()
      ? payload.releasedAt.trim()
      : new Date().toISOString().slice(0, 10),
    title: typeof payload.title === 'string' && payload.title.trim()
      ? payload.title.trim()
      : `Bản cập nhật HOME MONI v${payload.version.trim()}`,
    highlights: highlights.length > 0
      ? highlights
      : ['Cải thiện hiệu năng, độ ổn định và tối ưu trải nghiệm sử dụng trên thiết bị di động.'],
    mandatory: Boolean(payload.mandatory),
  };
}

async function fetchLatestReleaseManifest(): Promise<AppReleaseEntry | null> {
  const endpoints = [
    `/api/app-version?t=${Date.now()}`,
    `/version.json?t=${Date.now()}`,
  ];

  for (const url of endpoints) {
    try {
      const response = await fetch(url, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
      if (!response.ok) continue;
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) continue;
      const data = (await response.json()) as RemoteVersionPayload;
      const normalized = normalizeRemoteRelease(data);
      if (normalized) return normalized;
    } catch {
      // Thử endpoint dự phòng tiếp theo
    }
  }
  return null;
}

export function PWAUpdateProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<PWAUpdateStatus>('IDLE');
  const [latestRelease, setLatestRelease] = useState<AppReleaseEntry | null>(CURRENT_RELEASE);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);
  const [hasWaitingWorker, setHasWaitingWorker] = useState(false);
  const [isDismissedForSession, setIsDismissedForSession] = useState(false);
  const [isReleaseNotesOpen, setIsReleaseNotesOpen] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [platform, setPlatform] = useState<DevicePlatform>('desktop');
  const [justUpdatedVersion, setJustUpdatedVersion] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const isCheckingRef = useRef(false);
  const isApplyingUpdateRef = useRef(false);
  const lastCheckTimestampRef = useRef<number>(0);
  const lastAnnouncedVersionRef = useRef<string | null>(null);
  const reloadTriggeredRef = useRef(false);

  const markUpdateAvailable = useCallback((candidateRelease: AppReleaseEntry | null, hasWaiting: boolean) => {
    setHasWaitingWorker(hasWaiting);
    if (candidateRelease) {
      setLatestRelease(candidateRelease);
      // Nếu có phiên bản mới hơn phiên bản đã tạm ẩn trong phiên này, hiện lại thông báo
      if (
        lastAnnouncedVersionRef.current &&
        compareSemver(candidateRelease.version, lastAnnouncedVersionRef.current) > 0
      ) {
        setIsDismissedForSession(false);
      }
      lastAnnouncedVersionRef.current = candidateRelease.version;
    }
    setErrorMessage(null);
    setStatus('UPDATE_AVAILABLE');
  }, []);

  const attachWorkerLifecycleListeners = useCallback(
    (reg: ServiceWorkerRegistration) => {
      if (reg.waiting && navigator.serviceWorker.controller) {
        markUpdateAvailable(latestRelease, true);
      }

      reg.addEventListener('updatefound', () => {
        const installing = reg.installing;
        if (!installing) return;

        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            markUpdateAvailable(latestRelease, true);
          }
        });
      });
    },
    [latestRelease, markUpdateAvailable]
  );

  const checkForUpdate = useCallback(
    async (options?: { silent?: boolean }): Promise<PWAUpdateStatus> => {
      const silent = options?.silent ?? false;
      if (isCheckingRef.current || isApplyingUpdateRef.current) {
        return status;
      }

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setIsOnline(false);
        if (hasWaitingWorker) {
          return 'UPDATE_AVAILABLE';
        }
        if (!silent) {
          setErrorMessage('Thiết bị đang ngoại tuyến. Hệ thống sẽ tự kiểm tra lại khi có mạng.');
          setStatus('OFFLINE');
        }
        return 'OFFLINE';
      }

      isCheckingRef.current = true;
      lastCheckTimestampRef.current = Date.now();
      setErrorMessage(null);

      if (!silent) {
        setStatus('CHECKING');
        setIsDismissedForSession(false);
      }

      try {
        // 1. Yêu cầu trình duyệt kiểm tra Service Worker mới trên mạng
        const reg = registrationRef.current;
        if (reg) {
          try {
            await reg.update();
          } catch {
            // Bỏ qua lỗi mạng nhất thời khi update SW
          }
        }

        // 2. Đối chiếu trực tiếp manifest phiên bản no-store từ máy chủ
        const remote = await fetchLatestReleaseManifest();
        const now = new Date();
        setLastCheckedAt(now);

        const waitingNow = Boolean(registrationRef.current?.waiting && navigator.serviceWorker.controller);
        const hasNewerSemver = Boolean(remote && compareSemver(remote.version, APP_VERSION) > 0);

        if (hasNewerSemver || waitingNow) {
          const resolvedRelease = remote || {
            ...CURRENT_RELEASE,
            title: 'Đã có bản cập nhật mới cho HOME MONI',
          };
          markUpdateAvailable(resolvedRelease, waitingNow);
          return 'UPDATE_AVAILABLE';
        }

        setHasWaitingWorker(false);
        if (remote) {
          setLatestRelease(remote);
        }

        if (!silent || status === 'CHECKING' || status === 'ERROR' || status === 'OFFLINE' || status === 'IDLE') {
          setStatus('UP_TO_DATE');
        }
        return 'UP_TO_DATE';
      } catch {
        setErrorMessage('Không thể kết nối máy chủ kiểm tra bản mới. Vui lòng thử lại.');
        if (!silent) {
          setStatus('ERROR');
        }
        return 'ERROR';
      } finally {
        isCheckingRef.current = false;
      }
    },
    [hasWaitingWorker, markUpdateAvailable, status]
  );

  const performSafeReload = useCallback(() => {
    if (reloadTriggeredRef.current) return;
    reloadTriggeredRef.current = true;
    window.location.reload();
  }, []);

  const applyUpdateNow = useCallback(async () => {
    if (isApplyingUpdateRef.current) return;
    isApplyingUpdateRef.current = true;
    setStatus('UPDATING');
    setErrorMessage(null);

    const targetVersion = latestRelease?.version || APP_VERSION;
    try {
      sessionStorage.setItem(JUST_UPDATED_STORAGE_KEY, targetVersion);
    } catch {
      // Bỏ qua nếu sessionStorage bị hạn chế
    }

    const reg = registrationRef.current;
    const waitingWorker = reg?.waiting;

    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
      // Fallback an toàn nếu trình duyệt mobile không phát controllerchange đúng hạn
      window.setTimeout(async () => {
        if (typeof caches !== 'undefined') {
          const keys = await caches.keys();
          await Promise.all(
            keys
              .filter((k) => k.startsWith('homemoni-pwa-'))
              .map((k) => caches.delete(k))
          );
        }
        performSafeReload();
      }, 2200);
      return;
    }

    // Trường hợp phát hiện bản mới qua version manifest nhưng chưa có waiting worker (hoặc iOS standalone)
    try {
      if (typeof caches !== 'undefined') {
        const keys = await caches.keys();
        await Promise.all(
          keys
            .filter((k) => k.startsWith('homemoni-pwa-'))
            .map((k) => caches.delete(k))
        );
      }
      if (reg) {
        await reg.update();
      }
    } catch {
      // Tiếp tục reload an toàn
    }

    performSafeReload();
  }, [latestRelease, performSafeReload]);

  // Khởi tạo nhận diện thiết bị, kiểm tra toast sau nâng cấp & đăng ký Service Worker
  useEffect(() => {
    if (typeof window === 'undefined') return;

    setPlatform(detectPlatform());
    setIsStandalone(detectStandalone());

    try {
      const upgradedTo = sessionStorage.getItem(JUST_UPDATED_STORAGE_KEY);
      if (upgradedTo) {
        sessionStorage.removeItem(JUST_UPDATED_STORAGE_KEY);
        setJustUpdatedVersion(upgradedTo);
        setStatus('JUST_UPDATED');
      }
    } catch {
      // ignore
    }

    const handleControllerChange = () => {
      if (isApplyingUpdateRef.current) {
        performSafeReload();
      }
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

      navigator.serviceWorker
        .register('/sw.js', { updateViaCache: 'none' })
        .then((reg) => {
          registrationRef.current = reg;
          attachWorkerLifecycleListeners(reg);
          void checkForUpdate({ silent: true });
        })
        .catch(() => {
          // Vẫn chạy kiểm tra qua endpoint phiên bản ngay cả khi SW chưa khả dụng
          void checkForUpdate({ silent: true });
        });
    } else {
      void checkForUpdate({ silent: true });
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastCheckTimestampRef.current < VISIBILITY_THROTTLE_MS) return;
      void checkForUpdate({ silent: true });
    };

    const handleOnline = () => {
      setIsOnline(true);
      void checkForUpdate({ silent: true });
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const intervalId = window.setInterval(() => {
      void checkForUpdate({ silent: true });
    }, AUTO_CHECK_INTERVAL_MS);

    return () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tự ẩn thông báo xác nhận "Đã cập nhật" sau 7 giây
  useEffect(() => {
    if (status !== 'JUST_UPDATED') return;
    const timer = window.setTimeout(() => {
      setJustUpdatedVersion(null);
      setStatus('UP_TO_DATE');
    }, 7000);
    return () => window.clearTimeout(timer);
  }, [status]);

  const dismissUpdateBanner = useCallback(() => {
    setIsDismissedForSession(true);
  }, []);

  const dismissJustUpdatedToast = useCallback(() => {
    setJustUpdatedVersion(null);
    setStatus('UP_TO_DATE');
  }, []);

  const openReleaseNotes = useCallback(() => {
    setIsReleaseNotesOpen(true);
  }, []);

  const closeReleaseNotes = useCallback(() => {
    setIsReleaseNotesOpen(false);
  }, []);

  const changelog: AppReleaseEntry[] =
    latestRelease &&
    compareSemver(latestRelease.version, APP_VERSION) > 0 &&
    !APP_CHANGELOG.some((entry) => entry.version === latestRelease.version)
      ? [latestRelease, ...APP_CHANGELOG]
      : APP_CHANGELOG;

  return (
    <PWAUpdateContext.Provider
      value={{
        status,
        currentVersion: APP_VERSION,
        currentBuildId: APP_BUILD_ID,
        currentReleaseDate: APP_RELEASE_DATE,
        latestRelease,
        changelog,
        lastCheckedAt,
        isChecking: status === 'CHECKING',
        hasUpdate: status === 'UPDATE_AVAILABLE' || hasWaitingWorker,
        hasWaitingWorker,
        isDismissedForSession,
        isReleaseNotesOpen,
        isOnline,
        isStandalone,
        platform,
        justUpdatedVersion,
        errorMessage,
        checkForUpdate,
        applyUpdateNow,
        dismissUpdateBanner,
        dismissJustUpdatedToast,
        openReleaseNotes,
        closeReleaseNotes,
      }}
    >
      {children}
    </PWAUpdateContext.Provider>
  );
}

export function usePWAUpdate(): PWAUpdateContextValue {
  const ctx = useContext(PWAUpdateContext);
  if (!ctx) {
    throw new Error('usePWAUpdate phải được dùng bên trong PWAUpdateProvider');
  }
  return ctx;
}
