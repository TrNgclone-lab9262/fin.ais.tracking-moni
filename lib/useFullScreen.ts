"use client";

import { RefObject, useCallback, useEffect, useState } from "react";

interface VendorDocument extends Document {
  webkitFullscreenEnabled?: boolean;
  mozFullScreenEnabled?: boolean;
  msFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
  mozFullScreenElement?: Element | null;
  msFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
  mozCancelFullScreen?: () => Promise<void> | void;
  msExitFullscreen?: () => Promise<void> | void;
}

interface VendorElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
  mozRequestFullScreen?: () => Promise<void> | void;
  msRequestFullscreen?: () => Promise<void> | void;
}

export interface UseFullScreenOptions {
  /**
   * Optional target container element to enter fullscreen.
   * When omitted, targets `document.documentElement` (entire app window).
   */
  targetRef?: RefObject<HTMLElement | null>;
  /**
   * When true, activates a resilient `100dvh × 100vw` CSS fullscreen fallback state
   * if the browser (e.g. iOS Safari) or embedded iframe denies native Fullscreen API.
   * Defaults to `true` when `targetRef` is provided, and `false` for document-level fullscreen.
   */
  allowFallbackOverlay?: boolean;
}

export interface UseFullScreenResult {
  /** True when either native Fullscreen API OR fallback overlay fullscreen is active. */
  isFullscreen: boolean;
  /** True strictly when `document.fullscreenElement` matches this hook's scope. */
  isNativeFullscreen: boolean;
  /** True when the browser exposes native Fullscreen API (`fullscreenEnabled`). */
  isSupported: boolean;
  enterFullscreen: () => Promise<void>;
  exitFullscreen: () => Promise<void>;
  toggleFullscreen: () => Promise<void>;
}

export function getDocumentFullscreenElement(docOverride?: Document | null): Element | null {
  const rawDoc =
    docOverride !== undefined
      ? docOverride
      : typeof document !== "undefined"
        ? document
        : null;
  if (!rawDoc) return null;
  const doc = rawDoc as VendorDocument;
  return (
    doc.fullscreenElement ??
    doc.webkitFullscreenElement ??
    doc.mozFullScreenElement ??
    doc.msFullscreenElement ??
    null
  );
}

export function checkFullscreenApiSupport(docOverride?: Document | null): boolean {
  const rawDoc =
    docOverride !== undefined
      ? docOverride
      : typeof document !== "undefined"
        ? document
        : null;
  if (!rawDoc) return false;
  const doc = rawDoc as VendorDocument;
  const root = doc.documentElement as VendorElement | null;
  const enabled = Boolean(
    doc.fullscreenEnabled ||
      doc.webkitFullscreenEnabled ||
      doc.mozFullScreenEnabled ||
      doc.msFullscreenEnabled
  );
  const hasRequestMethod = Boolean(
    root &&
      (typeof root.requestFullscreen === "function" ||
        typeof root.webkitRequestFullscreen === "function" ||
        typeof root.mozRequestFullScreen === "function" ||
        typeof root.msRequestFullscreen === "function")
  );
  return enabled && hasRequestMethod;
}

export const getActiveFullscreenElement = getDocumentFullscreenElement;
export const isFullscreenApiSupported = checkFullscreenApiSupport;

/**
 * Reusable browser Fullscreen API hook with full document compatibility checks,
 * vendor-prefix fallbacks, `document.fullscreenElement` state tracking, and optional
 * `100dvh × 100vw` overlay fallback for iOS Safari / iframe previews.
 */
export function useFullScreen(options: UseFullScreenOptions = {}): UseFullScreenResult {
  const { targetRef, allowFallbackOverlay = Boolean(targetRef) } = options;

  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [isNativeFullscreen, setIsNativeFullscreen] = useState<boolean>(false);
  const [isFallbackActive, setIsFallbackActive] = useState<boolean>(false);

  const notifyViewportResize = useCallback(() => {
    if (typeof window === "undefined") return;
    window.requestAnimationFrame(() => {
      window.dispatchEvent(new Event("resize"));
      window.setTimeout(() => {
        window.dispatchEvent(new Event("resize"));
      }, 120);
    });
  }, []);

  const readMatchingNativeState = useCallback((): boolean => {
    const activeEl = getDocumentFullscreenElement();
    if (!activeEl) return false;
    if (targetRef?.current) {
      return activeEl === targetRef.current || activeEl.contains(targetRef.current);
    }
    return true;
  }, [targetRef]);

  useEffect(() => {
    setIsSupported(checkFullscreenApiSupport());
    setIsNativeFullscreen(readMatchingNativeState());
  }, [readMatchingNativeState]);

  const enterFullscreen = useCallback(async () => {
    if (typeof document === "undefined") return;

    if (allowFallbackOverlay) {
      setIsFallbackActive(true);
    }

    const target = (targetRef?.current ?? document.documentElement) as VendorElement | null;
    if (target && checkFullscreenApiSupport() && !getDocumentFullscreenElement()) {
      try {
        if (typeof target.requestFullscreen === "function") {
          await target.requestFullscreen();
        } else if (typeof target.webkitRequestFullscreen === "function") {
          await target.webkitRequestFullscreen();
        } else if (typeof target.mozRequestFullScreen === "function") {
          await target.mozRequestFullScreen();
        } else if (typeof target.msRequestFullscreen === "function") {
          await target.msRequestFullscreen();
        }
        setIsNativeFullscreen(readMatchingNativeState());
      } catch {
        // Native fullscreen may be blocked by iframe permissions or iOS Safari;
        // fallback overlay remains active when allowFallbackOverlay is true.
        if (!allowFallbackOverlay) {
          setIsNativeFullscreen(false);
        }
      }
    }

    notifyViewportResize();
  }, [allowFallbackOverlay, targetRef, readMatchingNativeState, notifyViewportResize]);

  const exitFullscreen = useCallback(async () => {
    setIsFallbackActive(false);

    if (typeof document !== "undefined" && getDocumentFullscreenElement()) {
      const doc = document as VendorDocument;
      try {
        if (typeof doc.exitFullscreen === "function") {
          await doc.exitFullscreen();
        } else if (typeof doc.webkitExitFullscreen === "function") {
          await doc.webkitExitFullscreen();
        } else if (typeof doc.mozCancelFullScreen === "function") {
          await doc.mozCancelFullScreen();
        } else if (typeof doc.msExitFullscreen === "function") {
          await doc.msExitFullscreen();
        }
      } catch {
        // Ignore native exit errors
      }
    }

    setIsNativeFullscreen(false);
    notifyViewportResize();
  }, [notifyViewportResize]);

  const isFullscreen = isNativeFullscreen || (allowFallbackOverlay && isFallbackActive);

  const toggleFullscreen = useCallback(async () => {
    if (isFullscreen) {
      await exitFullscreen();
    } else {
      await enterFullscreen();
    }
  }, [isFullscreen, enterFullscreen, exitFullscreen]);

  // Keep React state strictly synced with browser `document.fullscreenElement` changes
  useEffect(() => {
    if (typeof document === "undefined") return;

    const handleFullscreenChange = () => {
      const nativeNow = readMatchingNativeState();
      setIsNativeFullscreen(nativeNow);
      if (!nativeNow) {
        setIsFallbackActive(false);
      }
      notifyViewportResize();
    };

    const handleFullscreenError = () => {
      setIsNativeFullscreen(readMatchingNativeState());
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("MSFullscreenChange", handleFullscreenChange);
    document.addEventListener("fullscreenerror", handleFullscreenError);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.removeEventListener("mozfullscreenchange", handleFullscreenChange);
      document.removeEventListener("MSFullscreenChange", handleFullscreenChange);
      document.removeEventListener("fullscreenerror", handleFullscreenError);
    };
  }, [readMatchingNativeState, notifyViewportResize]);

  // Lock background scroll & support Escape key when fallback CSS overlay is active
  useEffect(() => {
    if (!allowFallbackOverlay || !isFallbackActive || typeof document === "undefined") return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        void exitFullscreen();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    notifyViewportResize();

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      notifyViewportResize();
    };
  }, [allowFallbackOverlay, isFallbackActive, exitFullscreen, notifyViewportResize]);

  return {
    isFullscreen,
    isNativeFullscreen,
    isSupported,
    enterFullscreen,
    exitFullscreen,
    toggleFullscreen,
  };
}
