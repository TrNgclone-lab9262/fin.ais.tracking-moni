"use client";

import { useCallback, useMemo } from "react";
import {
  HapticPreset,
  HAPTIC_PATTERNS,
  isHapticSupported,
  triggerHaptic,
} from "@/lib/haptic";

export type { HapticPreset } from "@/lib/haptic";
export { HAPTIC_PATTERNS, isHapticSupported, triggerHaptic } from "@/lib/haptic";

export interface UseHapticResult {
  isSupported: boolean;
  trigger: (preset?: HapticPreset) => boolean;
  light: () => boolean;
  medium: () => boolean;
  success: () => boolean;
  warning: () => boolean;
  error: () => boolean;
}

/**
 * Hook phản hồi xúc giác (Haptic Feedback) qua `window.navigator.vibrate`.
 * Tự động kiểm tra tương thích và giữ tham chiếu hàm ổn định giữa các lần render.
 */
export function useHaptic(): UseHapticResult {
  const isSupported = isHapticSupported();

  const trigger = useCallback((preset: HapticPreset = "light") => {
    return triggerHaptic(preset);
  }, []);

  const light = useCallback(() => triggerHaptic("light"), []);
  const medium = useCallback(() => triggerHaptic("medium"), []);
  const success = useCallback(() => triggerHaptic("success"), []);
  const warning = useCallback(() => triggerHaptic("warning"), []);
  const error = useCallback(() => triggerHaptic("error"), []);

  return useMemo(
    () => ({
      isSupported,
      trigger,
      light,
      medium,
      success,
      warning,
      error,
    }),
    [isSupported, trigger, light, medium, success, warning, error]
  );
}
