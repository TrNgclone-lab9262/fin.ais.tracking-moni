"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFinance } from "@/context/FinanceContext";
import {
  InteriorCameraSnapshot,
  InteriorDesignScenario,
  InteriorDoorMode,
  InteriorFloorPattern,
  InteriorFurnitureItem,
  InteriorLightingZones,
  InteriorWallOverride,
} from "@/types/finance";
import {
  calculateScenarioBoq,
  evaluateErgonomicClearances,
  ErgonomicWarning,
  ScenarioBoqSummary,
} from "@/lib/interiorBoqEngine";
import {
  InteriorArchTarget,
  InteriorInteractionMode,
} from "@/lib/three/interiorSceneController";

export type InteriorViewportMode = "3D" | "2D" | "SPLIT";

export interface InteriorPersistedViewState {
  version: 1;
  viewportMode: InteriorViewportMode;
  showMepLayer: boolean;
  interactionMode: InteriorInteractionMode;
  camerasByScenario: Record<string, InteriorCameraSnapshot>;
  updatedAt: string;
}

export const INTERIOR_VIEW_STORAGE_KEY = "skyone_studio_view_state_v1";

export const DEFAULT_INTERIOR_VIEW_STATE: InteriorPersistedViewState = {
  version: 1,
  viewportMode: "3D",
  showMepLayer: false,
  interactionMode: "FURNITURE",
  camerasByScenario: {},
  updatedAt: "",
};

function isFiniteTriple(val: unknown): val is [number, number, number] {
  return (
    Array.isArray(val) &&
    val.length === 3 &&
    val.every((n) => typeof n === "number" && Number.isFinite(n))
  );
}

function sanitizeCameraSnapshot(raw: unknown): InteriorCameraSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (!isFiniteTriple(obj.position) || !isFiniteTriple(obj.target)) return null;

  const snap: InteriorCameraSnapshot = {
    position: [
      Number(obj.position[0].toFixed(3)),
      Number(obj.position[1].toFixed(3)),
      Number(obj.position[2].toFixed(3)),
    ],
    target: [
      Number(obj.target[0].toFixed(3)),
      Number(obj.target[1].toFixed(3)),
      Number(obj.target[2].toFixed(3)),
    ],
  };

  if (
    obj.preset === "DOLLHOUSE" ||
    obj.preset === "ENTRANCE" ||
    obj.preset === "LIVING_BALCONY" ||
    obj.preset === "KITCHEN_DINING" ||
    obj.preset === "MASTER_BEDROOM" ||
    obj.preset === "ROOM_05_STUDIO"
  ) {
    snap.preset = obj.preset;
  }
  if (obj.navMode === "ORBIT" || obj.navMode === "WALKTHROUGH") {
    snap.navMode = obj.navMode;
  }
  if (
    obj.timeOfDay === "MORNING_08" ||
    obj.timeOfDay === "NOON_12" ||
    obj.timeOfDay === "AFTERNOON_1630" ||
    obj.timeOfDay === "EVENING_20"
  ) {
    snap.timeOfDay = obj.timeOfDay;
  }
  if (typeof obj.fov === "number" && Number.isFinite(obj.fov)) {
    snap.fov = Math.max(25, Math.min(80, Math.round(obj.fov)));
  }
  if (typeof obj.autoCutaway === "boolean") {
    snap.autoCutaway = obj.autoCutaway;
  }
  return snap;
}

export function serializeInteriorViewState(state: InteriorPersistedViewState): string {
  return JSON.stringify(state);
}

export function parseInteriorViewState(rawText: string | null): InteriorPersistedViewState {
  if (!rawText) return { ...DEFAULT_INTERIOR_VIEW_STATE, camerasByScenario: {} };
  try {
    const parsed = JSON.parse(rawText) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") {
      return { ...DEFAULT_INTERIOR_VIEW_STATE, camerasByScenario: {} };
    }
    const viewportMode: InteriorViewportMode =
      parsed.viewportMode === "2D" || parsed.viewportMode === "SPLIT"
        ? parsed.viewportMode
        : "3D";
    const showMepLayer = Boolean(parsed.showMepLayer);
    const interactionMode: InteriorInteractionMode =
      parsed.interactionMode === "ARCHITECTURE" ? "ARCHITECTURE" : "FURNITURE";

    const camerasByScenario: Record<string, InteriorCameraSnapshot> = {};
    if (parsed.camerasByScenario && typeof parsed.camerasByScenario === "object") {
      for (const [scId, rawCam] of Object.entries(
        parsed.camerasByScenario as Record<string, unknown>
      )) {
        const clean = sanitizeCameraSnapshot(rawCam);
        if (clean) camerasByScenario[scId] = clean;
      }
    }

    return {
      version: 1,
      viewportMode,
      showMepLayer,
      interactionMode,
      camerasByScenario,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : "",
    };
  } catch {
    return { ...DEFAULT_INTERIOR_VIEW_STATE, camerasByScenario: {} };
  }
}

export interface UseInteriorStateResult {
  // Single Source of Truth domain state (localStorage + Supabase via FinanceContext)
  activeScenario: InteriorDesignScenario;
  allScenarioBoqs: { scenario: InteriorDesignScenario; boq: ScenarioBoqSummary }[];
  activeBoq: ScenarioBoqSummary;
  warnings: ErgonomicWarning[];
  hiddenItems: InteriorFurnitureItem[];
  hiddenItemsCount: number;

  // Persistent View & Camera state (localStorage instant + Supabase camera snapshot)
  viewportMode: InteriorViewportMode;
  setViewportMode: (mode: InteriorViewportMode) => void;
  showMepLayer: boolean;
  setShowMepLayer: (visible: boolean) => void;
  toggleMepLayer: () => void;
  interactionMode: InteriorInteractionMode;
  setInteractionMode: (mode: InteriorInteractionMode) => void;
  selectedItemId: string | null;
  setSelectedItemId: (id: string | null) => void;
  selectedArchTarget: InteriorArchTarget | null;
  setSelectedArchTarget: (target: InteriorArchTarget | null) => void;

  /** Resolved camera state for the currently active scenario (localStorage -> Supabase fallback). */
  activeCameraState: InteriorCameraSnapshot | null;
  saveCameraState: (snapshot: InteriorCameraSnapshot) => void;

  // Unified Wall / Door / Floor / Visibility / Lighting mutations
  updateWallOverride: (wallId: string, patch: Partial<InteriorWallOverride>) => void;
  updateDoorOverride: (openingId: string, mode: InteriorDoorMode) => void;
  updateFloorPattern: (roomId: string, pattern: InteriorFloorPattern) => void;
  updateLightingZones: (patch: Partial<InteriorLightingZones>) => void;
  updateCurtainOpenRatio: (ratio: number) => void;
  toggleItemVisibility: (itemId: string) => void;
  showAllHiddenItems: () => void;
}

/**
 * Unified Interior Studio State Hook (`useInteriorState`).
 * - Wraps `FinanceContext` as the Single Source of Truth for modified wall structures,
 *   door modes, bedroom floor patterns, lighting/curtains, and furniture items/visibility
 *   so localStorage, Supabase (`interior_studios`), BOQ pricing, and Undo/Redo stay 100% synced.
 * - Persists 3D camera state (position, target, preset, navMode, FOV, sun time, cutaway) and
 *   workspace layout (3D/2D/Split, MEP layer, interaction mode) to `localStorage` with debouncing
 *   and syncs the latest camera view onto the active scenario for cross-device Supabase continuity.
 */
export function useInteriorState(): UseInteriorStateResult {
  const {
    interiorStudio,
    updateInteriorScenarioMeta,
    updateInteriorFurnitureItem,
    updateInteriorWallOverride,
    updateInteriorDoorOverride,
    updateInteriorFloorPattern,
    updateInteriorLightingZones,
    updateInteriorCurtainOpenRatio,
  } = useFinance();

  const [viewState, setViewState] = useState<InteriorPersistedViewState>(() => {
    if (typeof window === "undefined") {
      return { ...DEFAULT_INTERIOR_VIEW_STATE, camerasByScenario: {} };
    }
    try {
      return parseInteriorViewState(window.localStorage.getItem(INTERIOR_VIEW_STORAGE_KEY));
    } catch {
      return { ...DEFAULT_INTERIOR_VIEW_STATE, camerasByScenario: {} };
    }
  });

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedArchTarget, setSelectedArchTarget] = useState<InteriorArchTarget | null>(null);

  const cloudSyncTimerRef = useRef<number | null>(null);
  const localWriteTimerRef = useRef<number | null>(null);

  const activeScenario = useMemo(
    () =>
      interiorStudio.scenarios.find((s) => s.id === interiorStudio.activeScenarioId) ||
      interiorStudio.scenarios[0],
    [interiorStudio]
  );

  const allScenarioBoqs = useMemo(
    () =>
      interiorStudio.scenarios.map((sc) => ({
        scenario: sc,
        boq: calculateScenarioBoq(sc),
      })),
    [interiorStudio.scenarios]
  );

  const activeBoq = useMemo(() => calculateScenarioBoq(activeScenario), [activeScenario]);

  const warnings = useMemo(
    () => evaluateErgonomicClearances(activeScenario),
    [activeScenario]
  );

  const hiddenItems = useMemo(
    () => activeScenario.items.filter((i) => Boolean(i.isHidden)),
    [activeScenario.items]
  );

  // Debounced write of workspace view & camera state to localStorage (prevents 60fps jitter)
  const scheduleLocalPersist = useCallback((next: InteriorPersistedViewState) => {
    if (typeof window === "undefined") return;
    if (localWriteTimerRef.current !== null) {
      window.clearTimeout(localWriteTimerRef.current);
    }
    localWriteTimerRef.current = window.setTimeout(() => {
      try {
        window.localStorage.setItem(
          INTERIOR_VIEW_STORAGE_KEY,
          serializeInteriorViewState(next)
        );
      } catch {
        // Ignore storage quota / private mode errors gracefully
      }
      localWriteTimerRef.current = null;
    }, 250);
  }, []);

  useEffect(() => {
    return () => {
      if (localWriteTimerRef.current !== null) {
        window.clearTimeout(localWriteTimerRef.current);
      }
      if (cloudSyncTimerRef.current !== null) {
        window.clearTimeout(cloudSyncTimerRef.current);
      }
    };
  }, []);

  const setViewportMode = useCallback(
    (viewportMode: InteriorViewportMode) => {
      setViewState((prev) => {
        const next: InteriorPersistedViewState = {
          ...prev,
          viewportMode,
          updatedAt: new Date().toISOString(),
        };
        scheduleLocalPersist(next);
        return next;
      });
    },
    [scheduleLocalPersist]
  );

  const setShowMepLayer = useCallback(
    (showMepLayer: boolean) => {
      setViewState((prev) => {
        const next: InteriorPersistedViewState = {
          ...prev,
          showMepLayer,
          updatedAt: new Date().toISOString(),
        };
        scheduleLocalPersist(next);
        return next;
      });
    },
    [scheduleLocalPersist]
  );

  const toggleMepLayer = useCallback(() => {
    setViewState((prev) => {
      const next: InteriorPersistedViewState = {
        ...prev,
        showMepLayer: !prev.showMepLayer,
        updatedAt: new Date().toISOString(),
      };
      scheduleLocalPersist(next);
      return next;
    });
  }, [scheduleLocalPersist]);

  const setInteractionMode = useCallback(
    (interactionMode: InteriorInteractionMode) => {
      if (interactionMode === "ARCHITECTURE") {
        setSelectedItemId(null);
      } else {
        setSelectedArchTarget(null);
      }
      setViewState((prev) => {
        const next: InteriorPersistedViewState = {
          ...prev,
          interactionMode,
          updatedAt: new Date().toISOString(),
        };
        scheduleLocalPersist(next);
        return next;
      });
    },
    [scheduleLocalPersist]
  );

  // Save camera snapshot immediately to debounced localStorage and gently (1800ms debounce)
  // to FinanceContext -> Supabase without adding Undo steps.
  const saveCameraState = useCallback(
    (rawSnapshot: InteriorCameraSnapshot) => {
      const clean = sanitizeCameraSnapshot(rawSnapshot);
      if (!clean) return;
      const scenarioId = activeScenario.id;

      setViewState((prev) => {
        const next: InteriorPersistedViewState = {
          ...prev,
          camerasByScenario: {
            ...prev.camerasByScenario,
            [scenarioId]: clean,
          },
          updatedAt: new Date().toISOString(),
        };
        scheduleLocalPersist(next);
        return next;
      });

      if (typeof window !== "undefined") {
        if (cloudSyncTimerRef.current !== null) {
          window.clearTimeout(cloudSyncTimerRef.current);
        }
        cloudSyncTimerRef.current = window.setTimeout(() => {
          updateInteriorScenarioMeta(
            scenarioId,
            { lastCameraView: clean },
            { skipUndoHistory: true }
          );
          cloudSyncTimerRef.current = null;
        }, 1800);
      }
    },
    [activeScenario.id, scheduleLocalPersist, updateInteriorScenarioMeta]
  );

  // Prefer fresh local session camera state, falling back to Supabase-synced lastCameraView
  const activeCameraState = useMemo(() => {
    return (
      viewState.camerasByScenario[activeScenario.id] ??
      activeScenario.lastCameraView ??
      null
    );
  }, [viewState.camerasByScenario, activeScenario.id, activeScenario.lastCameraView]);

  const toggleItemVisibility = useCallback(
    (itemId: string) => {
      const target = activeScenario.items.find((i) => i.id === itemId);
      if (!target) return;
      const nextHidden = !Boolean(target.isHidden);
      updateInteriorFurnitureItem(itemId, { isHidden: nextHidden });
      if (nextHidden && selectedItemId === itemId) {
        setSelectedItemId(null);
      }
    },
    [activeScenario.items, selectedItemId, updateInteriorFurnitureItem]
  );

  const showAllHiddenItems = useCallback(() => {
    for (const item of activeScenario.items) {
      if (item.isHidden) {
        updateInteriorFurnitureItem(item.id, { isHidden: false });
      }
    }
  }, [activeScenario.items, updateInteriorFurnitureItem]);

  return {
    activeScenario,
    allScenarioBoqs,
    activeBoq,
    warnings,
    hiddenItems,
    hiddenItemsCount: hiddenItems.length,
    viewportMode: viewState.viewportMode,
    setViewportMode,
    showMepLayer: viewState.showMepLayer,
    setShowMepLayer,
    toggleMepLayer,
    interactionMode: viewState.interactionMode,
    setInteractionMode,
    selectedItemId,
    setSelectedItemId,
    selectedArchTarget,
    setSelectedArchTarget,
    activeCameraState,
    saveCameraState,
    updateWallOverride: updateInteriorWallOverride,
    updateDoorOverride: updateInteriorDoorOverride,
    updateFloorPattern: updateInteriorFloorPattern,
    updateLightingZones: updateInteriorLightingZones,
    updateCurtainOpenRatio: updateInteriorCurtainOpenRatio,
    toggleItemVisibility,
    showAllHiddenItems,
  };
}
