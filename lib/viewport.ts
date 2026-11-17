export const MOBILE_BREAKPOINT_PX = 640;
export const MOBILE_SHELL_BREAKPOINT_PX = 768;
export const TABLET_BREAKPOINT_PX = 1024;
export const WIDE_BREAKPOINT_PX = 1280;

export type ViewportBreakpoint = "mobile" | "tablet" | "desktop" | "wide";

export interface ViewportState {
  width: number;
  height: number;
  breakpoint: ViewportBreakpoint;
  /** Viewport width < 640px */
  isMobile: boolean;
  /** Viewport width < 768px (matches Tailwind md: shell threshold) */
  isMobileShell: boolean;
  /** 640px <= Viewport width < 1024px */
  isTablet: boolean;
  /** Viewport width < 1024px (Mobile or Tablet) */
  isCompact: boolean;
  /** Viewport width >= 1024px */
  isDesktop: boolean;
}

export function classifyViewport(width: number, height = 800): ViewportState {
  const safeWidth = Number.isFinite(width) && width > 0 ? Math.round(width) : 1280;
  const safeHeight = Number.isFinite(height) && height > 0 ? Math.round(height) : 800;

  const isMobile = safeWidth < MOBILE_BREAKPOINT_PX;
  const isMobileShell = safeWidth < MOBILE_SHELL_BREAKPOINT_PX;
  const isTablet = safeWidth >= MOBILE_BREAKPOINT_PX && safeWidth < TABLET_BREAKPOINT_PX;
  const isCompact = safeWidth < TABLET_BREAKPOINT_PX;
  const isDesktop = safeWidth >= TABLET_BREAKPOINT_PX;

  let breakpoint: ViewportBreakpoint = "desktop";
  if (safeWidth < MOBILE_BREAKPOINT_PX) {
    breakpoint = "mobile";
  } else if (safeWidth < TABLET_BREAKPOINT_PX) {
    breakpoint = "tablet";
  } else if (safeWidth >= WIDE_BREAKPOINT_PX) {
    breakpoint = "wide";
  }

  return {
    width: safeWidth,
    height: safeHeight,
    breakpoint,
    isMobile,
    isMobileShell,
    isTablet,
    isCompact,
    isDesktop,
  };
}

/**
 * Tính interval tối ưu cho Recharts XAxis để tự động ẩn bớt ticks trên màn hình hẹp.
 */
export function computeResponsiveXAxisInterval(
  dataLength: number,
  isMobile: boolean,
  maxMobileTicks = 5
): number | "preserveStartEnd" {
  if (!isMobile) {
    return "preserveStartEnd";
  }
  if (dataLength <= maxMobileTicks) {
    return 0;
  }
  return Math.max(1, Math.ceil(dataLength / Math.max(2, maxMobileTicks)) - 1);
}
