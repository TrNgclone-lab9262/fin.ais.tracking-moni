import test from "node:test";
import assert from "node:assert/strict";
import {
  THEME_TRANSITION_DURATION_MS,
  THEME_TRANSITION_EASING,
  THEME_TRANSITIONING_CLASS,
  computeRevealRadius,
  resolveThemeTransitionOrigin,
  runThemeCircularReveal,
  type DocumentWithViewTransition,
  type WindowForThemeTransition,
} from "./themeTransition.ts";

function createMockRoot() {
  const classes = new Set<string>();
  const animateCalls: Array<{ keyframes: unknown; options: unknown }> = [];
  return {
    classes,
    animateCalls,
    element: {
      classList: {
        add(token: string) {
          classes.add(token);
        },
        remove(token: string) {
          classes.delete(token);
        },
      },
      animate(keyframes: unknown, options?: unknown) {
        animateCalls.push({ keyframes, options });
        return {};
      },
    },
  };
}

test("resolveThemeTransitionOrigin uses pointer click coordinates when clicked with mouse/touch", () => {
  const origin = resolveThemeTransitionOrigin(
    {
      clientX: 1240,
      clientY: 36,
      detail: 1,
      currentTarget: {
        getBoundingClientRect: () => ({ left: 1220, top: 16, width: 40, height: 40 }),
      },
    },
    { width: 1440, height: 900 }
  );

  assert.deepEqual(origin, { x: 1240, y: 36 });
});

test("resolveThemeTransitionOrigin uses button geometric center for keyboard Enter/Space clicks", () => {
  const origin = resolveThemeTransitionOrigin(
    {
      clientX: 0,
      clientY: 0,
      detail: 0,
      currentTarget: {
        getBoundingClientRect: () => ({ left: 1200, top: 20, width: 36, height: 36 }),
      },
    },
    { width: 1440, height: 900 }
  );

  assert.deepEqual(origin, { x: 1218, y: 38 });
});

test("resolveThemeTransitionOrigin falls back to viewport center when no coordinates or target exist", () => {
  const origin = resolveThemeTransitionOrigin(undefined, { width: 1440, height: 900 });
  assert.deepEqual(origin, { x: 720, y: 450 });
});

test("computeRevealRadius calculates exact Euclidean distance to farthest viewport corner", () => {
  // From top-right corner (1440, 0) on a 1440x900 viewport, farthest corner is (0, 900)
  const radius = computeRevealRadius({ x: 1440, y: 0 }, { width: 1440, height: 900 });
  assert.equal(radius, Math.hypot(1440, 900));

  // From center (720, 450), farthest distance is hypot(720, 450)
  const centerRadius = computeRevealRadius({ x: 720, y: 450 }, { width: 1440, height: 900 });
  assert.equal(centerRadius, Math.hypot(720, 450));
});

test("runThemeCircularReveal executes 700ms cubic-bezier(0.4, 0, 0.2, 1) circular reveal on ::view-transition-new(root)", async () => {
  const mockRoot = createMockRoot();
  let committed = 0;
  let resolveReady!: () => void;
  let resolveFinished!: () => void;

  const ready = new Promise<void>((r) => {
    resolveReady = r;
  });
  const finished = new Promise<void>((r) => {
    resolveFinished = r;
  });

  const doc: DocumentWithViewTransition = {
    documentElement: mockRoot.element,
    startViewTransition(cb) {
      cb();
      return { ready, finished };
    },
  };

  const win: WindowForThemeTransition = {
    innerWidth: 1440,
    innerHeight: 900,
    matchMedia: () => ({ matches: false }),
  };

  const outcome = runThemeCircularReveal({
    event: { clientX: 1300, clientY: 40, detail: 1 },
    commitTheme: () => {
      committed += 1;
    },
    doc,
    win,
  });

  assert.equal(outcome, "view-transition");
  assert.equal(committed, 1);
  assert.equal(mockRoot.classes.has(THEME_TRANSITIONING_CLASS), true);

  resolveReady();
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(mockRoot.animateCalls.length, 1);
  const expectedRadius = Math.hypot(1300, 860);
  assert.deepEqual(mockRoot.animateCalls[0], {
    keyframes: {
      clipPath: [
        "circle(0px at 1300px 40px)",
        `circle(${expectedRadius}px at 1300px 40px)`,
      ],
    },
    options: {
      duration: THEME_TRANSITION_DURATION_MS,
      easing: THEME_TRANSITION_EASING,
      pseudoElement: "::view-transition-new(root)",
    },
  });
  assert.equal(THEME_TRANSITION_DURATION_MS, 700);
  assert.equal(THEME_TRANSITION_EASING, "cubic-bezier(0.4, 0, 0.2, 1)");

  resolveFinished();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(mockRoot.classes.has(THEME_TRANSITIONING_CLASS), false);
});

test("runThemeCircularReveal bypasses animation when prefers-reduced-motion is enabled", () => {
  const mockRoot = createMockRoot();
  let startCalled = false;
  let committed = 0;

  const doc: DocumentWithViewTransition = {
    documentElement: mockRoot.element,
    startViewTransition(cb) {
      startCalled = true;
      cb();
      return { ready: Promise.resolve(), finished: Promise.resolve() };
    },
  };

  const win: WindowForThemeTransition = {
    innerWidth: 1440,
    innerHeight: 900,
    matchMedia: (q) => ({ matches: q.includes("prefers-reduced-motion: reduce") }),
  };

  const outcome = runThemeCircularReveal({
    event: { clientX: 500, clientY: 500, detail: 1 },
    commitTheme: () => {
      committed += 1;
    },
    doc,
    win,
  });

  assert.equal(outcome, "reduced-motion");
  assert.equal(committed, 1);
  assert.equal(startCalled, false);
  assert.equal(mockRoot.classes.has(THEME_TRANSITIONING_CLASS), false);
});

test("runThemeCircularReveal safely falls back on older browsers without startViewTransition", () => {
  const mockRoot = createMockRoot();
  let committed = 0;

  const doc: DocumentWithViewTransition = {
    documentElement: mockRoot.element,
  };

  const win: WindowForThemeTransition = {
    innerWidth: 1280,
    innerHeight: 720,
    matchMedia: () => ({ matches: false }),
  };

  const outcome = runThemeCircularReveal({
    event: { clientX: 100, clientY: 100, detail: 1 },
    commitTheme: () => {
      committed += 1;
    },
    doc,
    win,
  });

  assert.equal(outcome, "fallback");
  assert.equal(committed, 1);
  assert.equal(mockRoot.classes.has(THEME_TRANSITIONING_CLASS), false);
});

test("runThemeCircularReveal handles rapid double-click transitions without premature class removal", async () => {
  const mockRoot = createMockRoot();
  const resolvers: Array<{
    rejectReady: (err: Error) => void;
    resolveReady: () => void;
    resolveFinished: () => void;
  }> = [];

  const doc: DocumentWithViewTransition = {
    documentElement: mockRoot.element,
    startViewTransition(cb) {
      cb();
      let resolveReady!: () => void;
      let rejectReady!: (err: Error) => void;
      let resolveFinished!: () => void;
      const ready = new Promise<void>((res, rej) => {
        resolveReady = res;
        rejectReady = rej;
      });
      const finished = new Promise<void>((res) => {
        resolveFinished = res;
      });
      resolvers.push({ resolveReady, rejectReady, resolveFinished });
      return { ready, finished };
    },
  };

  const win: WindowForThemeTransition = {
    innerWidth: 1000,
    innerHeight: 800,
    matchMedia: () => ({ matches: false }),
  };

  runThemeCircularReveal({
    event: { clientX: 200, clientY: 100, detail: 1 },
    commitTheme: () => {},
    doc,
    win,
  });

  // Rapid second toggle supersedes the first before it finishes
  runThemeCircularReveal({
    event: { clientX: 220, clientY: 100, detail: 1 },
    commitTheme: () => {},
    doc,
    win,
  });

  // First transition aborts & finishes early
  resolvers[0].rejectReady(new Error("AbortError"));
  resolvers[0].resolveFinished();
  await new Promise((r) => setTimeout(r, 0));

  // Class must remain active for the in-flight second transition
  assert.equal(mockRoot.classes.has(THEME_TRANSITIONING_CLASS), true);

  // Second transition animates and finishes
  resolvers[1].resolveReady();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(mockRoot.animateCalls.length, 1);

  resolvers[1].resolveFinished();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(mockRoot.classes.has(THEME_TRANSITIONING_CLASS), false);
});
