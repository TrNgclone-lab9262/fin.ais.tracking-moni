"use client";

import { useEffect, useState } from "react";
import {
  classifyViewport,
  MOBILE_BREAKPOINT_PX,
  TABLET_BREAKPOINT_PX,
  ViewportState,
} from "@/lib/viewport";

export type { ViewportBreakpoint, ViewportState } from "@/lib/viewport";

const DEFAULT_SSR_VIEWPORT = classifyViewport(1280, 800);

/**
 * Hook phát hiện thông minh kích thước màn hình dùng chung toàn dự án.
 * Xác định trạng thái `isMobile` (< 640px), `isTablet` (640px–1023px),
 * `isCompact` (< 1024px) và `isDesktop` (>= 1024px).
 */
export function useResponsive(): ViewportState {
  const [viewport, setViewport] = useState<ViewportState>(() => {
    if (typeof window !== "undefined") {
      return classifyViewport(window.innerWidth, window.innerHeight);
    }
    return DEFAULT_SSR_VIEWPORT;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    let rafId: number | null = null;

    const syncViewport = () => {
      const next = classifyViewport(window.innerWidth, window.innerHeight);
      setViewport((prev) => {
        if (
          prev.width === next.width &&
          prev.height === next.height &&
          prev.breakpoint === next.breakpoint
        ) {
          return prev;
        }
        return next;
      });
    };

    const scheduleSync = () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        syncViewport();
      });
    };

    syncViewport();
    window.addEventListener("resize", scheduleSync, { passive: true });
    window.addEventListener("orientationchange", scheduleSync);

    const mobileMq =
      typeof window.matchMedia === "function"
        ? window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX - 1}px)`)
        : null;
    const tabletMq =
      typeof window.matchMedia === "function"
        ? window.matchMedia(`(max-width: ${TABLET_BREAKPOINT_PX - 1}px)`)
        : null;

    const attachMq = (mq: MediaQueryList | null) => {
      if (!mq) return () => {};
      if (typeof mq.addEventListener === "function") {
        mq.addEventListener("change", scheduleSync);
        return () => mq.removeEventListener("change", scheduleSync);
      }
      mq.addListener(scheduleSync);
      return () => mq.removeListener(scheduleSync);
    };

    const detachMobile = attachMq(mobileMq);
    const detachTablet = attachMq(tabletMq);

    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      window.removeEventListener("resize", scheduleSync);
      window.removeEventListener("orientationchange", scheduleSync);
      detachMobile();
      detachTablet();
    };
  }, []);

  return viewport;
}
