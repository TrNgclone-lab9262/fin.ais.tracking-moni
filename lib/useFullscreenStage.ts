"use client";

import { RefObject, useCallback, useEffect, useState } from "react";

interface UseFullscreenStageResult {
  isFullscreen: boolean;
  enterFullscreen: () => void;
  exitFullscreen: () => void;
  toggleFullscreen: () => void;
}

/**
 * Cross-device Fullscreen Stage hook for 3D WebGL Viewport & 2D CAD Blueprint.
 * Uses a hybrid strategy:
 * 1. Immediate React fullscreen overlay (`fixed inset-0 z-50 h-[100dvh] w-[100vw]`) so iOS Safari,
 *    mobile webviews, and restricted iframes always work reliably.
 * 2. Best-effort native Fullscreen API (`requestFullscreen` / `exitFullscreen`) when supported
 *    by the browser, synced with `fullscreenchange` and `Escape` key.
 */
export function useFullscreenStage(
  containerRef: RefObject<HTMLElement | null>
): UseFullscreenStageResult {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const notifyResize = useCallback(() => {
    if (typeof window === "undefined") return;
    window.requestAnimationFrame(() => {
      window.dispatchEvent(new Event("resize"));
      window.setTimeout(() => {
        window.dispatchEvent(new Event("resize"));
      }, 120);
    });
  }, []);

  const enterFullscreen = useCallback(() => {
    setIsFullscreen(true);
    const el = containerRef.current as
      | (HTMLElement & {
          webkitRequestFullscreen?: () => Promise<void> | void;
        })
      | null;
    if (el && typeof document !== "undefined" && !document.fullscreenElement) {
      try {
        if (typeof el.requestFullscreen === "function") {
          const maybePromise = el.requestFullscreen();
          if (maybePromise && typeof maybePromise.catch === "function") {
            maybePromise.catch(() => {
              // Fallback to CSS 100dvh overlay cleanly
            });
          }
        } else if (typeof el.webkitRequestFullscreen === "function") {
          el.webkitRequestFullscreen();
        }
      } catch {
        // Safe fallback to CSS overlay (e.g., iframe without allow="fullscreen" or iOS Safari)
      }
    }
    notifyResize();
  }, [containerRef, notifyResize]);

  const exitFullscreen = useCallback(() => {
    setIsFullscreen(false);
    if (typeof document !== "undefined") {
      const doc = document as Document & {
        webkitExitFullscreen?: () => Promise<void> | void;
        webkitFullscreenElement?: Element | null;
      };
      try {
        if (doc.fullscreenElement && typeof doc.exitFullscreen === "function") {
          const maybePromise = doc.exitFullscreen();
          if (maybePromise && typeof maybePromise.catch === "function") {
            maybePromise.catch(() => {});
          }
        } else if (
          doc.webkitFullscreenElement &&
          typeof doc.webkitExitFullscreen === "function"
        ) {
          doc.webkitExitFullscreen();
        }
      } catch {
        // ignore native fullscreen exit errors
      }
    }
    notifyResize();
  }, [notifyResize]);

  const toggleFullscreen = useCallback(() => {
    if (isFullscreen) {
      exitFullscreen();
    } else {
      enterFullscreen();
    }
  }, [isFullscreen, enterFullscreen, exitFullscreen]);

  // Lock background page scroll while fullscreen overlay is active + Esc shortcut
  useEffect(() => {
    if (!isFullscreen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        exitFullscreen();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    notifyResize();

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      notifyResize();
    };
  }, [isFullscreen, exitFullscreen, notifyResize]);

  // Sync if user presses browser native Esc to leave native fullscreen
  useEffect(() => {
    if (typeof document === "undefined") return;
    const handleFsChange = () => {
      const doc = document as Document & { webkitFullscreenElement?: Element | null };
      const nativeActive = Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);
      if (!nativeActive) {
        setIsFullscreen((prev) => {
          if (prev) notifyResize();
          return false;
        });
      }
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    document.addEventListener("webkitfullscreenchange", handleFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFsChange);
      document.removeEventListener("webkitfullscreenchange", handleFsChange);
    };
  }, [notifyResize]);

  return {
    isFullscreen,
    enterFullscreen,
    exitFullscreen,
    toggleFullscreen,
  };
}
