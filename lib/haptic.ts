export type HapticPreset = "light" | "medium" | "success" | "warning" | "error";

export const HAPTIC_PATTERNS: Record<HapticPreset, number | number[]> = {
  light: 10,
  medium: 16,
  success: [12, 30, 18],
  warning: [20, 40, 20],
  error: [30, 45, 30],
};

export interface NavigatorWithVibrate {
  vibrate?: (pattern: number | number[]) => boolean;
}

export function isHapticSupported(
  nav: NavigatorWithVibrate | undefined = typeof window !== "undefined"
    ? window.navigator
    : undefined
): boolean {
  return Boolean(nav && typeof nav.vibrate === "function");
}

/**
 * Kích hoạt phản hồi rung (Haptic Feedback) qua Web Vibration API.
 * An toàn 100% trên iOS Safari / SSR / thiết bị không hỗ trợ `navigator.vibrate`.
 */
export function triggerHaptic(
  preset: HapticPreset = "light",
  nav: NavigatorWithVibrate | undefined = typeof window !== "undefined"
    ? window.navigator
    : undefined
): boolean {
  if (!isHapticSupported(nav)) {
    return false;
  }

  try {
    const pattern = HAPTIC_PATTERNS[preset] ?? HAPTIC_PATTERNS.light;
    return Boolean(nav!.vibrate!(pattern));
  } catch {
    return false;
  }
}
