export const THEME_TRANSITION_DURATION_MS = 700;
export const THEME_TRANSITION_EASING = "cubic-bezier(0.4, 0, 0.2, 1)";
export const THEME_TRANSITIONING_CLASS = "theme-transitioning";

export interface ThemeTransitionOrigin {
  x: number;
  y: number;
}

export interface ViewportSize {
  width: number;
  height: number;
}

export interface RectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ElementWithRectLike {
  getBoundingClientRect?: () => RectLike;
}

export interface ThemeTransitionTriggerEvent {
  clientX?: number;
  clientY?: number;
  detail?: number;
  currentTarget?: EventTarget | ElementWithRectLike | null;
}

export interface ViewTransitionLike {
  ready: Promise<unknown>;
  finished: Promise<unknown>;
  updateCallbackDone?: Promise<unknown>;
  skipTransition?: () => void;
}

export interface DocumentRootLike {
  classList: {
    add: (token: string) => void;
    remove: (token: string) => void;
  };
  animate?: (
    keyframes: Keyframe[] | PropertyIndexedKeyframes | null,
    options?: KeyframeAnimationOptions
  ) => unknown;
}

export interface DocumentWithViewTransition {
  documentElement: DocumentRootLike;
  activeElement?: ElementWithRectLike | EventTarget | null;
  startViewTransition?: (callback: () => void | Promise<void>) => ViewTransitionLike;
}

export interface WindowForThemeTransition {
  innerWidth: number;
  innerHeight: number;
  matchMedia?: (query: string) => { matches: boolean };
}

export type ThemeTransitionOutcome = "view-transition" | "reduced-motion" | "fallback";

let activeTransitionSequence = 0;

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

function getElementCenter(
  target: EventTarget | ElementWithRectLike | null | undefined,
  viewport: ViewportSize
): ThemeTransitionOrigin | null {
  if (!target || typeof target !== "object") return null;
  const candidate = target as ElementWithRectLike;
  if (typeof candidate.getBoundingClientRect !== "function") return null;

  const rect = candidate.getBoundingClientRect();
  if (
    !rect ||
    !Number.isFinite(rect.left) ||
    !Number.isFinite(rect.top) ||
    !Number.isFinite(rect.width) ||
    !Number.isFinite(rect.height)
  ) {
    return null;
  }

  if (rect.width <= 0 && rect.height <= 0) {
    return null;
  }

  return {
    x: clamp(rect.left + rect.width / 2, 0, viewport.width),
    y: clamp(rect.top + rect.height / 2, 0, viewport.height),
  };
}

/**
 * Resolves the circular reveal center:
 * 1. Pointer click/tap coordinates when triggered by mouse/touch.
 * 2. Geometric center of the active/focused trigger button when activated via keyboard (Enter/Space).
 * 3. Viewport center as final fallback.
 */
export function resolveThemeTransitionOrigin(
  event: ThemeTransitionTriggerEvent | undefined,
  viewport: ViewportSize,
  fallbackActiveElement?: EventTarget | ElementWithRectLike | null
): ThemeTransitionOrigin {
  const width = Math.max(0, viewport.width);
  const height = Math.max(0, viewport.height);
  const safeViewport: ViewportSize = { width, height };

  if (event) {
    const hasFiniteCoords =
      typeof event.clientX === "number" &&
      Number.isFinite(event.clientX) &&
      typeof event.clientY === "number" &&
      Number.isFinite(event.clientY);

    const isKeyboardZeroClick =
      hasFiniteCoords &&
      event.clientX === 0 &&
      event.clientY === 0 &&
      (event.detail === 0 || event.detail === undefined);

    if (hasFiniteCoords && !isKeyboardZeroClick) {
      return {
        x: clamp(event.clientX as number, 0, width),
        y: clamp(event.clientY as number, 0, height),
      };
    }

    const buttonCenter = getElementCenter(event.currentTarget, safeViewport);
    if (buttonCenter) {
      return buttonCenter;
    }
  }

  const activeCenter = getElementCenter(fallbackActiveElement, safeViewport);
  if (activeCenter) {
    return activeCenter;
  }

  return {
    x: width / 2,
    y: height / 2,
  };
}

/**
 * Computes the exact Euclidean distance from the reveal origin to the farthest corner of the viewport.
 */
export function computeRevealRadius(
  origin: ThemeTransitionOrigin,
  viewport: ViewportSize
): number {
  const maxX = Math.max(origin.x, Math.max(0, viewport.width) - origin.x);
  const maxY = Math.max(origin.y, Math.max(0, viewport.height) - origin.y);
  return Math.hypot(maxX, maxY);
}

/**
 * Checks whether the user prefers reduced motion.
 */
export function isReducedMotionPreferred(
  win: WindowForThemeTransition | undefined
): boolean {
  try {
    return Boolean(win?.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
  } catch {
    return false;
  }
}

export interface RunThemeCircularRevealOptions {
  event?: ThemeTransitionTriggerEvent;
  commitTheme: () => void;
  doc?: DocumentWithViewTransition;
  win?: WindowForThemeTransition;
}

/**
 * Orchestrates a 700ms View Transitions API Circular Reveal from the pointer/button origin
 * with automatic fallback for older browsers and full prefers-reduced-motion compliance.
 */
export function runThemeCircularReveal(
  options: RunThemeCircularRevealOptions
): ThemeTransitionOutcome {
  const { event, commitTheme } = options;
  const doc =
    options.doc ??
    (typeof document !== "undefined"
      ? (document as unknown as DocumentWithViewTransition)
      : undefined);
  const win =
    options.win ??
    (typeof window !== "undefined"
      ? (window as unknown as WindowForThemeTransition)
      : undefined);

  if (!doc || !win) {
    commitTheme();
    return "fallback";
  }

  if (isReducedMotionPreferred(win)) {
    commitTheme();
    return "reduced-motion";
  }

  if (typeof doc.startViewTransition !== "function") {
    commitTheme();
    return "fallback";
  }

  const viewport: ViewportSize = {
    width: win.innerWidth,
    height: win.innerHeight,
  };
  const origin = resolveThemeTransitionOrigin(event, viewport, doc.activeElement);
  const endRadius = computeRevealRadius(origin, viewport);

  const transitionId = ++activeTransitionSequence;
  const root = doc.documentElement;
  root.classList.add(THEME_TRANSITIONING_CLASS);

  const cleanupClass = () => {
    if (transitionId === activeTransitionSequence) {
      root.classList.remove(THEME_TRANSITIONING_CLASS);
    }
  };

  let transition: ViewTransitionLike;
  try {
    transition = doc.startViewTransition(() => {
      commitTheme();
    });
  } catch {
    cleanupClass();
    commitTheme();
    return "fallback";
  }

  Promise.resolve(transition.ready)
    .then(() => {
      if (transitionId !== activeTransitionSequence) return;
      if (typeof root.animate !== "function") return;
      root.animate(
        {
          clipPath: [
            `circle(0px at ${origin.x}px ${origin.y}px)`,
            `circle(${endRadius}px at ${origin.x}px ${origin.y}px)`,
          ],
        },
        {
          duration: THEME_TRANSITION_DURATION_MS,
          easing: THEME_TRANSITION_EASING,
          pseudoElement: "::view-transition-new(root)",
        }
      );
    })
    .catch(() => {
      // Ignore AbortError when rapid successive clicks supersede an in-flight transition.
    });

  Promise.resolve(transition.finished)
    .catch(() => {
      // Ignore transition interruption errors while ensuring class cleanup.
    })
    .finally(cleanupClass);

  return "view-transition";
}
