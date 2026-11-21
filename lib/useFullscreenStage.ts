"use client";

import { RefObject } from "react";
import { useFullScreen, UseFullScreenResult } from "./useFullScreen";

/**
 * Convenience wrapper around `useFullScreen` configured for studio canvas/stage containers
 * with hybrid CSS `100dvh × 100vw` fallback enabled for iOS Safari & embedded iframes.
 */
export function useFullscreenStage(
  containerRef: RefObject<HTMLElement | null>
): UseFullScreenResult {
  return useFullScreen({
    targetRef: containerRef,
    allowFallbackOverlay: true,
  });
}
