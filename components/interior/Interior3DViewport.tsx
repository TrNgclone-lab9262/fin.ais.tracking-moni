"use client";

import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import {
  Camera,
  Sun,
  Sunset,
  Moon,
  Sunrise,
  Eye,
  Compass,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Layers,
  AlertTriangle,
  Zap,
  Lightbulb,
  Blinds,
  Aperture,
  Armchair,
  Hammer,
  Ruler,
  Sparkles,
  Bookmark,
  Plus,
  X,
} from "lucide-react";
import {
  InteriorCameraBookmark,
  InteriorCameraSnapshot,
  InteriorDesignScenario,
  InteriorLightingZones,
} from "@/types/finance";
import { FullscreenToggle } from "@/components/common/FullscreenToggle";
import { DEFAULT_LIGHTING_ZONES } from "@/lib/interiorFloorplan";
import {
  Interior3DMeasurement,
  InteriorArchTarget,
  InteriorCameraPreset,
  InteriorInteractionMode,
  InteriorNavMode,
  InteriorSceneController,
  InteriorTimeOfDay,
} from "@/lib/three/interiorSceneController";
import { useFinance } from "@/context/FinanceContext";

export interface Interior3DViewportHandle {
  captureSnapshotPng: () => string | null;
  captureHighResPng: (scale?: number) => string | null;
  focusCameraPreset: (preset: InteriorCameraPreset) => void;
  getCameraSnapshot: () => InteriorCameraSnapshot | null;
  applyCameraTarget: (
    position: [number, number, number],
    target: [number, number, number]
  ) => void;
}

interface Interior3DViewportProps {
  scenario: InteriorDesignScenario;
  selectedItemId: string | null;
  interactionMode?: InteriorInteractionMode;
  onChangeInteractionMode?: (mode: InteriorInteractionMode) => void;
  selectedArchTarget?: InteriorArchTarget | null;
  onSelectArchTarget?: (target: InteriorArchTarget | null) => void;
  showMepLayer?: boolean;
  onToggleMepLayer?: () => void;
  onSelectItem: (id: string | null) => void;
  onItemMoved: (id: string, x: number, z: number, elevationCm?: number) => void;
  onUpdateLightingZones?: (patch: Partial<InteriorLightingZones>) => void;
  onUpdateCurtainOpenRatio?: (ratio: number) => void;
  initialCameraState?: InteriorCameraSnapshot | null;
  onCameraStateChange?: (snapshot: InteriorCameraSnapshot) => void;
  bookmarks?: InteriorCameraBookmark[];
  onAddBookmark?: (
    label: string,
    position: [number, number, number],
    target: [number, number, number]
  ) => void;
  onDeleteBookmark?: (bookmarkId: string) => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onFallbackTo2D?: () => void;
  className?: string;
}

const CAMERA_PRESET_BUTTONS: { id: InteriorCameraPreset; label: string }[] = [
  { id: "DOLLHOUSE", label: "Toàn cảnh 3D" },
  { id: "ROOM_05_STUDIO", label: "Phòng 05" },
  { id: "LIVING_BALCONY", label: "Khách & Ban công" },
  { id: "KITCHEN_DINING", label: "Bếp & Ăn" },
  { id: "MASTER_BEDROOM", label: "PN Master" },
  { id: "ENTRANCE", label: "Cửa chính" },
];

const TIME_BUTTONS: {
  id: InteriorTimeOfDay;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "MORNING_08", label: "08:00", icon: Sunrise },
  { id: "NOON_12", label: "12:00", icon: Sun },
  { id: "AFTERNOON_1630", label: "16:30", icon: Sunset },
  { id: "EVENING_20", label: "20:00", icon: Moon },
];

const LIGHTING_ZONE_BUTTONS: { key: keyof InteriorLightingZones; label: string }[] = [
  { key: "living", label: "Khách" },
  { key: "kitchen", label: "Bếp" },
  { key: "master", label: "Master" },
  { key: "room05", label: "P.05" },
];

const CURTAIN_PRESETS: { label: string; ratio: number }[] = [
  { label: "Đóng", ratio: 0.1 },
  { label: "50%", ratio: 0.5 },
  { label: "Mở", ratio: 0.88 },
];

const FOV_PRESETS: { label: string; fov: number }[] = [
  { label: "36°", fov: 36 },
  { label: "44°", fov: 44 },
  { label: "54°", fov: 54 },
];

const SCENE_MOOD_PRESETS: {
  id: string;
  label: string;
  timeOfDay: InteriorTimeOfDay;
  curtainOpenRatio: number;
  lightingZones: InteriorLightingZones;
}[] = [
  {
    id: "BRIGHT_MORNING",
    label: "Sáng thoáng",
    timeOfDay: "MORNING_08",
    curtainOpenRatio: 0.9,
    lightingZones: { living: false, kitchen: false, master: false, room05: false },
  },
  {
    id: "WARM_AFTERNOON",
    label: "Chiều ấm",
    timeOfDay: "AFTERNOON_1630",
    curtainOpenRatio: 0.52,
    lightingZones: { living: true, kitchen: true, master: false, room05: true },
  },
  {
    id: "EVENING_LED",
    label: "Tối LED 3000K",
    timeOfDay: "EVENING_20",
    curtainOpenRatio: 0.12,
    lightingZones: { living: true, kitchen: true, master: true, room05: true },
  },
];

/**
 * Compact solid-surface Touch Joystick for First-Person Walkthrough on Mobile & Desktop.
 * Zero backdrop-filter to preserve smooth WebGL frame pacing.
 */
function WalkthroughTouchJoystick({
  onMove,
}: {
  onMove: (vx: number, vz: number) => void;
}) {
  const padRef = useRef<HTMLDivElement | null>(null);
  const [knob, setKnob] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const activePointerIdRef = useRef<number | null>(null);
  const MAX_R = 32;

  const updateFromClient = (clientX: number, clientY: number) => {
    const el = padRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > MAX_R) {
      dx = (dx / dist) * MAX_R;
      dy = (dy / dist) * MAX_R;
    }
    setKnob({ x: dx, y: dy });
    onMove(dx / MAX_R, dy / MAX_R);
  };

  const reset = () => {
    activePointerIdRef.current = null;
    setKnob({ x: 0, y: 0 });
    onMove(0, 0);
  };

  return (
    <div className="flex flex-col items-center gap-1 select-none">
      <div
        ref={padRef}
        role="slider"
        aria-label="Cần điều khiển đi bộ 3D"
        aria-valuemin={-1}
        aria-valuemax={1}
        aria-valuenow={0}
        onPointerDown={(e) => {
          e.stopPropagation();
          activePointerIdRef.current = e.pointerId;
          e.currentTarget.setPointerCapture(e.pointerId);
          updateFromClient(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (activePointerIdRef.current !== e.pointerId) return;
          e.stopPropagation();
          updateFromClient(e.clientX, e.clientY);
        }}
        onPointerUp={(e) => {
          if (activePointerIdRef.current !== e.pointerId) return;
          e.stopPropagation();
          try {
            e.currentTarget.releasePointerCapture(e.pointerId);
          } catch {
            // ignore
          }
          reset();
        }}
        onPointerCancel={reset}
        className="relative w-24 h-24 rounded-full bg-slate-900 border-2 border-teal-500/80 shadow-lg flex items-center justify-center touch-none cursor-grab active:cursor-grabbing"
      >
        <div className="w-10 h-10 rounded-full border border-slate-700 pointer-events-none" />
        <div
          className="absolute w-9 h-9 rounded-full bg-teal-500 border-2 border-white shadow-md pointer-events-none"
          style={{
            transform: `translate(${knob.x}px, ${knob.y}px)`,
          }}
        />
      </div>
      <span className="px-2 py-0.5 rounded bg-slate-900 text-[10px] font-bold text-teal-200 border border-slate-700">
        Kéo để đi bộ
      </span>
    </div>
  );
}

export const Interior3DViewport = forwardRef<Interior3DViewportHandle, Interior3DViewportProps>(
  function Interior3DViewport(
    {
      scenario,
      selectedItemId,
      interactionMode = "FURNITURE",
      onChangeInteractionMode,
      selectedArchTarget = null,
      onSelectArchTarget,
      showMepLayer = false,
      onToggleMepLayer,
      onSelectItem,
      onItemMoved,
      onUpdateLightingZones,
      onUpdateCurtainOpenRatio,
      initialCameraState = null,
      onCameraStateChange,
      bookmarks = [],
      onAddBookmark,
      onDeleteBookmark,
      isFullscreen = false,
      onToggleFullscreen,
      onFallbackTo2D,
      className = "",
    },
    ref
  ) {
    const { themeMode } = useFinance();
    const mountRef = useRef<HTMLDivElement | null>(null);
    const controllerRef = useRef<InteriorSceneController | null>(null);
    const lastRestoredScenarioIdRef = useRef<string | null>(null);
    const callbacksRef = useRef({
      onSelectItem,
      onItemMoved,
      onSelectArchTarget,
      onCameraStateChange,
    });
    callbacksRef.current = {
      onSelectItem,
      onItemMoved,
      onSelectArchTarget,
      onCameraStateChange,
    };

    const [webglError, setWebglError] = useState<string | null>(null);
    const [activePreset, setActivePreset] = useState<InteriorCameraPreset>(
      initialCameraState?.preset ?? "DOLLHOUSE"
    );
    const [timeOfDay, setTimeOfDay] = useState<InteriorTimeOfDay>(
      initialCameraState?.timeOfDay ?? "MORNING_08"
    );
    const [navMode, setNavMode] = useState<InteriorNavMode>(
      initialCameraState?.navMode ?? "ORBIT"
    );
    const [autoCutaway, setAutoCutaway] = useState<boolean>(
      initialCameraState?.autoCutaway ?? true
    );
    const [cameraFov, setCameraFov] = useState<number>(initialCameraState?.fov ?? 44);
    const [dockExpanded, setDockExpanded] = useState<boolean>(true);
    const [snapshotFlash, setSnapshotFlash] = useState<boolean>(false);
    const [measureMode, setMeasureMode] = useState<boolean>(false);
    const [measurement3D, setMeasurement3D] = useState<Interior3DMeasurement | null>(null);
    const [addingBookmark, setAddingBookmark] = useState<boolean>(false);
    const [bookmarkDraftLabel, setBookmarkDraftLabel] = useState<string>("");
    const [activeBookmarkId, setActiveBookmarkId] = useState<string | null>(null);

    const isDarkMode = themeMode === "dark";
    const lightingZones: InteriorLightingZones = {
      ...DEFAULT_LIGHTING_ZONES,
      ...(scenario.lightingZones ?? {}),
    };
    const curtainRatio = scenario.curtainOpenRatio ?? 0.85;

    useImperativeHandle(
      ref,
      () => ({
        captureSnapshotPng: () => {
          const ctrl = controllerRef.current;
          if (!ctrl) return null;
          try {
            return ctrl.captureSnapshotPng();
          } catch {
            return null;
          }
        },
        captureHighResPng: (scale = 2) => {
          const ctrl = controllerRef.current;
          if (!ctrl) return null;
          try {
            return ctrl.captureHighResPng(scale);
          } catch {
            return null;
          }
        },
        focusCameraPreset: (preset: InteriorCameraPreset) => {
          setActivePreset(preset);
          setActiveBookmarkId(null);
          controllerRef.current?.applyCameraPreset(preset);
        },
        getCameraSnapshot: () => controllerRef.current?.getCameraSnapshot() ?? null,
        applyCameraTarget: (
          position: [number, number, number],
          target: [number, number, number]
        ) => {
          controllerRef.current?.applyCameraTarget(position, target);
        },
      }),
      []
    );

    // Mount Three.js controller once
    useEffect(() => {
      const container = mountRef.current;
      if (!container) return;

      try {
        const ctrl = new InteriorSceneController(
          container,
          scenario,
          {
            onSelectItem: (id) => callbacksRef.current.onSelectItem(id),
            onItemMoved: (id, x, z, elevationCm) =>
              callbacksRef.current.onItemMoved(id, x, z, elevationCm),
            onSelectArchitecture: (target) =>
              callbacksRef.current.onSelectArchTarget?.(target),
            onCameraChanged: (snapshot) =>
              callbacksRef.current.onCameraStateChange?.(snapshot),
            onMeasurementChange: (m) => setMeasurement3D(m),
            onContextLost: () => {
              setWebglError(
                "Trình duyệt tạm giải phóng ngữ cảnh WebGL 3D. Bạn có thể chuyển sang Bản vẽ 2D CAD."
              );
            },
          },
          isDarkMode
        );
        ctrl.setShowMepLayer(showMepLayer);
        ctrl.setInteractionMode(interactionMode);
        ctrl.setSelectedArchTarget(selectedArchTarget);
        if (initialCameraState) {
          ctrl.restoreCameraState(initialCameraState);
        } else {
          ctrl.setCameraFov(cameraFov);
        }
        lastRestoredScenarioIdRef.current = scenario.id;
        controllerRef.current = ctrl;
        setWebglError(null);

        return () => {
          ctrl.dispose();
          controllerRef.current = null;
        };
      } catch {
        setWebglError(
          "Thiết bị hiện không hỗ trợ WebGL 3D. Hệ thống sẵn sàng chuyển sang Bản vẽ 2D CAD chuẩn tỷ lệ."
        );
        return undefined;
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
      controllerRef.current?.syncScenario(scenario);
    }, [scenario]);

    // Restore saved camera state when switching between scenarios (PA-A <-> PA-B)
    useEffect(() => {
      const ctrl = controllerRef.current;
      if (!ctrl || lastRestoredScenarioIdRef.current === scenario.id) return;
      lastRestoredScenarioIdRef.current = scenario.id;
      if (initialCameraState) {
        ctrl.restoreCameraState(initialCameraState);
        if (initialCameraState.preset) setActivePreset(initialCameraState.preset);
        if (initialCameraState.timeOfDay) setTimeOfDay(initialCameraState.timeOfDay);
        if (initialCameraState.navMode) setNavMode(initialCameraState.navMode);
        if (typeof initialCameraState.autoCutaway === "boolean") {
          setAutoCutaway(initialCameraState.autoCutaway);
        }
        if (typeof initialCameraState.fov === "number") {
          setCameraFov(initialCameraState.fov);
        }
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scenario.id]);

    useEffect(() => {
      controllerRef.current?.setSelectedItem(selectedItemId);
    }, [selectedItemId]);

    useEffect(() => {
      controllerRef.current?.setInteractionMode(interactionMode);
    }, [interactionMode]);

    useEffect(() => {
      controllerRef.current?.setSelectedArchTarget(selectedArchTarget);
    }, [selectedArchTarget]);

    useEffect(() => {
      controllerRef.current?.setDarkMode(isDarkMode);
    }, [isDarkMode]);

    useEffect(() => {
      controllerRef.current?.setShowMepLayer(showMepLayer);
    }, [showMepLayer]);

    useEffect(() => {
      controllerRef.current?.resize();
    }, [isFullscreen]);

    // Exit 3D Laser Measurement Mode cleanly on Escape
    useEffect(() => {
      if (!measureMode) return;
      const handleKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          setMeasureMode(false);
          controllerRef.current?.setMeasureMode(false);
        }
      };
      window.addEventListener("keydown", handleKey);
      return () => window.removeEventListener("keydown", handleKey);
    }, [measureMode]);

    const handleSelectCamera = (preset: InteriorCameraPreset) => {
      setActivePreset(preset);
      setActiveBookmarkId(null);
      controllerRef.current?.applyCameraPreset(preset);
    };

    const handleSaveCurrentBookmark = (e: React.FormEvent) => {
      e.preventDefault();
      if (!onAddBookmark) return;
      const snap = controllerRef.current?.getCameraSnapshot();
      if (!snap) return;
      const label =
        bookmarkDraftLabel.trim() || `Góc lưu ${bookmarks.length + 1}`;
      onAddBookmark(label, snap.position, snap.target);
      setBookmarkDraftLabel("");
      setAddingBookmark(false);
    };

    const handleJumpToBookmark = (bm: InteriorCameraBookmark) => {
      setActiveBookmarkId(bm.id);
      controllerRef.current?.applyCameraTarget(bm.position, bm.target);
    };

    const handleSelectTime = (tod: InteriorTimeOfDay) => {
      setTimeOfDay(tod);
      controllerRef.current?.setTimeOfDay(tod);
    };

    const handleToggleNavMode = (mode: InteriorNavMode) => {
      setNavMode(mode);
      if (mode === "WALKTHROUGH" && measureMode) {
        setMeasureMode(false);
        controllerRef.current?.setMeasureMode(false);
      }
      controllerRef.current?.setNavMode(mode);
    };

    const handleToggleMeasureMode = () => {
      const next = !measureMode;
      setMeasureMode(next);
      if (next && navMode === "WALKTHROUGH") {
        setNavMode("ORBIT");
        controllerRef.current?.setNavMode("ORBIT");
      }
      controllerRef.current?.setMeasureMode(next);
    };

    const handleApplySceneMood = (mood: (typeof SCENE_MOOD_PRESETS)[number]) => {
      setTimeOfDay(mood.timeOfDay);
      controllerRef.current?.setTimeOfDay(mood.timeOfDay);
      onUpdateCurtainOpenRatio?.(mood.curtainOpenRatio);
      onUpdateLightingZones?.(mood.lightingZones);
    };

    const handleToggleCutaway = () => {
      const next = !autoCutaway;
      setAutoCutaway(next);
      controllerRef.current?.setAutoCutaway(next);
    };

    const handleSelectFov = (fov: number) => {
      setCameraFov(fov);
      controllerRef.current?.setCameraFov(fov);
    };

    const handleSnapshotHD = () => {
      const ctrl = controllerRef.current;
      if (!ctrl) return;
      try {
        const dataUrl = ctrl.captureHighResPng(2);
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = `skyone_a12a07_3d_hd_${scenario.code.toLowerCase()}_${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setSnapshotFlash(true);
        window.setTimeout(() => setSnapshotFlash(false), 1200);
      } catch {
        // ignore snapshot failure
      }
    };

    return (
      <div
        className={`relative overflow-hidden bg-[#EFECE6] dark:bg-[#171A21] ${
          isFullscreen
            ? "w-full h-full rounded-none border-0"
            : "rounded-xl border border-slate-200 dark:border-slate-800"
        } ${className}`}
      >
        {/* WebGL Canvas Mount */}
        <div
          ref={mountRef}
          className={`w-full h-full ${isFullscreen ? "min-h-0" : "min-h-[420px] sm:min-h-[540px]"}`}
        />

        {/* Minimal Top-Left Apartment Tag (Solid surface, no backdrop-filter over WebGL) */}
        <div className="pointer-events-none absolute top-3 left-3 flex flex-col gap-1 max-w-[65%]">
          <div className="bg-slate-900 text-white px-3 py-1.5 rounded-lg border border-slate-700/80 shadow-sm">
            <p className="text-[11px] font-black tracking-tight leading-tight">
              A.12A.07 · Loại A2 (51.0 m²)
            </p>
            <p className="text-[10px] text-teal-300 font-semibold leading-tight mt-0.5">
              {scenario.shortLabel} · Ban công Đông Nam · Tầng 12A
            </p>
          </div>
          {navMode === "WALKTHROUGH" && (
            <div className="bg-teal-900 text-teal-100 px-2.5 py-1 rounded-md text-[10px] font-bold border border-teal-700">
              Đi bộ 1.60m · Tự hiện trần LED & bầu trời tầng 12A · Kéo tay xoay góc nhìn
            </div>
          )}
          {interactionMode === "ARCHITECTURE" && navMode === "ORBIT" && !measureMode && (
            <div className="bg-amber-950 text-amber-100 px-2.5 py-1 rounded-md text-[10px] font-bold border border-amber-700">
              Chế độ Kết cấu · Chạm vào tường hoặc cửa để đổi vách kính, lam gỗ, Accent Wall hoặc cửa lùa
            </div>
          )}
          {measureMode && (
            <div className="bg-amber-950 text-amber-100 px-2.5 py-1 rounded-md text-[10px] font-bold border border-amber-600">
              {measurement3D?.distanceMm != null
                ? `Thước Laser 3D · ${measurement3D.distanceMm.toLocaleString("vi-VN")} mm (${(measurement3D.distanceMm / 10).toFixed(1)} cm) · Chạm điểm mới để đo lại`
                : measurement3D?.p1
                  ? "Thước Laser 3D · Đã chấm điểm 1, chạm điểm thứ 2 trên đồ/tường/sàn..."
                  : "Thước Laser 3D · Chạm 2 điểm bất kỳ trong không gian 3D để đo mm"}
            </div>
          )}
        </div>

        {/* 3D Laser Measurement Semantic Floating Readout (Solid surface, no backdrop-filter) */}
        {measureMode && measurement3D?.distanceMm != null && (
          <div
            className="absolute z-20 pointer-events-auto"
            style={
              measurement3D.labelScreen
                ? {
                    left: `${Math.max(16, Math.min(measurement3D.labelScreen.x, 760))}px`,
                    top: `${Math.max(72, Math.min(measurement3D.labelScreen.y - 44, 420))}px`,
                    transform: "translateX(-50%)",
                  }
                : { top: "76px", left: "50%", transform: "translateX(-50%)" }
            }
          >
            <div className="bg-slate-900 text-white border border-amber-500 rounded-lg px-2.5 py-1.5 shadow-lg flex items-center gap-2 text-[11px] tabular-nums whitespace-nowrap">
              <Ruler className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <div>
                <p className="font-black leading-tight">
                  {measurement3D.distanceMm.toLocaleString("vi-VN")} mm{" "}
                  <span className="text-amber-300 font-bold">
                    ({(measurement3D.distanceMm / 10).toFixed(0)} cm)
                  </span>
                </p>
                <p className="text-[10px] text-slate-300 leading-tight mt-0.5">
                  {measurement3D.distanceMm >= 800
                    ? "Đạt lối đi chính (≥ 800 mm)"
                    : measurement3D.distanceMm >= 600
                      ? "Lối đi phụ (600–799 mm)"
                      : "Khoảng hẹp (< 600 mm)"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => controllerRef.current?.clearMeasurement()}
                title="Xóa đường đo"
                className="p-0.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {/* Top-Right Compact Mode + 3D Measure + HD Snapshot + Fullscreen + Dock Collapse */}
        <div className="absolute top-3 right-3 flex flex-wrap items-center justify-end gap-1.5">
          {onChangeInteractionMode && (
            <div className="inline-flex rounded-lg bg-white dark:bg-slate-900 p-0.5 border border-slate-200 dark:border-slate-700 shadow-sm">
              <button
                type="button"
                onClick={() => onChangeInteractionMode("FURNITURE")}
                title="Chọn & di chuyển đồ nội thất"
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold whitespace-nowrap cursor-pointer ${
                  interactionMode === "FURNITURE"
                    ? "bg-teal-600 text-white"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <Armchair className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Nội thất</span>
              </button>
              <button
                type="button"
                onClick={() => onChangeInteractionMode("ARCHITECTURE")}
                title="Chỉnh sửa vách ngăn, Accent Wall & cửa lùa"
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold whitespace-nowrap cursor-pointer ${
                  interactionMode === "ARCHITECTURE"
                    ? "bg-amber-500 text-stone-950"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <Hammer className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Tường & Cửa</span>
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={handleToggleMeasureMode}
            title="Thước Laser 3D đo khoảng cách thực (mm)"
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border shadow-sm whitespace-nowrap cursor-pointer ${
              measureMode
                ? "bg-amber-500 border-amber-500 text-stone-950"
                : "bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
            }`}
          >
            <Ruler className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{measureMode ? "Đang đo mm" : "Thước 3D"}</span>
          </button>

          <button
            type="button"
            onClick={handleSnapshotHD}
            title="Xuất ảnh Render 3D HD (2× PNG)"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm whitespace-nowrap cursor-pointer"
          >
            <Camera className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            <span className="hidden sm:inline">{snapshotFlash ? "Đã lưu HD" : "Ảnh HD"}</span>
          </button>

          {onToggleFullscreen && (
            <FullscreenToggle
              variant="compact"
              isFullscreen={isFullscreen}
              onToggle={onToggleFullscreen}
              titleEnter="Xem toàn màn hình 3D"
              titleExit="Thu gọn toàn màn hình (Esc)"
            />
          )}

          <button
            type="button"
            onClick={() => setDockExpanded((v) => !v)}
            aria-label={dockExpanded ? "Thu gọn thanh điều khiển 3D" : "Mở thanh điều khiển 3D"}
            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            {dockExpanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronUp className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* Mobile / Touch Walkthrough Joystick (Bottom-left above dock, solid surface) */}
        {navMode === "WALKTHROUGH" && !webglError && (
          <div
            className={`absolute left-3 z-20 ${dockExpanded ? "bottom-44 sm:bottom-36" : "bottom-4"}`}
          >
            <WalkthroughTouchJoystick
              onMove={(vx, vz) => controllerRef.current?.setWalkthroughJoystickVector(vx, vz)}
            />
          </div>
        )}

        {/* Collapsible Bottom Control Dock (Solid surface, no backdrop-filter) */}
        {dockExpanded && !webglError && (
          <div className="absolute bottom-3 left-3 right-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 shadow-lg space-y-2">
            {/* Row 1: Camera Presets + Custom Saved Camera Bookmarks */}
            <div className="flex flex-wrap items-center gap-1.5 pb-0.5">
              <div className="flex items-center gap-1.5 overflow-x-auto max-w-full">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0 px-1">
                  Góc nhìn
                </span>
                {CAMERA_PRESET_BUTTONS.map((btn) => (
                  <button
                    key={btn.id}
                    type="button"
                    onClick={() => handleSelectCamera(btn.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 whitespace-nowrap transition-colors cursor-pointer ${
                      activePreset === btn.id && !activeBookmarkId
                        ? "bg-teal-600 text-white"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    {btn.label}
                  </button>
                ))}

                {bookmarks.map((bm) => (
                  <div
                    key={bm.id}
                    className={`inline-flex items-center rounded-lg border shrink-0 overflow-hidden ${
                      activeBookmarkId === bm.id
                        ? "bg-indigo-600 border-indigo-600 text-white"
                        : "bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800 text-indigo-800 dark:text-indigo-200"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleJumpToBookmark(bm)}
                      className="inline-flex items-center gap-1 pl-2 pr-1.5 py-1 text-[11px] font-bold whitespace-nowrap cursor-pointer"
                      title={`Di chuyển tới góc nhìn đã lưu: ${bm.name}`}
                    >
                      <Bookmark className="w-3 h-3 shrink-0" />
                      <span>{bm.name}</span>
                    </button>
                    {onDeleteBookmark && (
                      <button
                        type="button"
                        onClick={() => {
                          if (activeBookmarkId === bm.id) setActiveBookmarkId(null);
                          onDeleteBookmark(bm.id);
                        }}
                        aria-label={`Xóa góc nhìn ${bm.name}`}
                        className={`pr-1.5 pl-0.5 py-1 cursor-pointer ${
                          activeBookmarkId === bm.id
                            ? "text-indigo-200 hover:text-white"
                            : "text-indigo-400 hover:text-rose-600"
                        }`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}

                {onAddBookmark && bookmarks.length < 6 && !addingBookmark && (
                  <button
                    type="button"
                    onClick={() => setAddingBookmark(true)}
                    title="Lưu góc nhìn 3D hiện tại (tối đa 6 góc/phương án)"
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-dashed border-indigo-300 dark:border-indigo-700 text-[11px] font-bold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 shrink-0 whitespace-nowrap cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Lưu góc ({bookmarks.length}/6)</span>
                  </button>
                )}

                {onAddBookmark && addingBookmark && (
                  <form
                    onSubmit={handleSaveCurrentBookmark}
                    className="inline-flex items-center gap-1 shrink-0"
                  >
                    <input
                      type="text"
                      value={bookmarkDraftLabel}
                      onChange={(e) => setBookmarkDraftLabel(e.target.value)}
                      placeholder="VD: Góc bàn làm việc"
                      maxLength={32}
                      autoFocus
                      className="w-32 px-2 py-0.5 rounded-md border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-800 text-[11px] font-bold text-slate-800 dark:text-slate-100"
                    />
                    <button
                      type="submit"
                      className="px-2 py-0.5 rounded-md bg-indigo-600 text-white text-[10px] font-bold cursor-pointer"
                    >
                      Lưu
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAddingBookmark(false);
                        setBookmarkDraftLabel("");
                      }}
                      className="p-0.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                      aria-label="Hủy lưu góc nhìn"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </form>
                )}
              </div>
            </div>

            {/* Row 2: Sun Time + Nav Mode + Cutaway + MEP */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1 hidden sm:inline">
                  Nắng
                </span>
                {TIME_BUTTONS.map((tb) => {
                  const Icon = tb.icon;
                  const active = timeOfDay === tb.id;
                  return (
                    <button
                      key={tb.id}
                      type="button"
                      onClick={() => handleSelectTime(tb.id)}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold tabular-nums whitespace-nowrap transition-colors cursor-pointer ${
                        active
                          ? "bg-amber-500 text-stone-950"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                      }`}
                    >
                      <Icon className="w-3 h-3" />
                      <span>{tb.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5">
                  <button
                    type="button"
                    onClick={() => handleToggleNavMode("ORBIT")}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold whitespace-nowrap cursor-pointer ${
                      navMode === "ORBIT"
                        ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                        : "text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    <Compass className="w-3 h-3" />
                    <span>Xoay 3D</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleNavMode("WALKTHROUGH")}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold whitespace-nowrap cursor-pointer ${
                      navMode === "WALKTHROUGH"
                        ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                        : "text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    <Eye className="w-3 h-3" />
                    <span>Đi bộ 1.6m</span>
                  </button>
                </div>

                {navMode === "ORBIT" && (
                  <button
                    type="button"
                    onClick={handleToggleCutaway}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold border whitespace-nowrap transition-colors cursor-pointer ${
                      autoCutaway
                        ? "bg-teal-50 dark:bg-teal-950/50 border-teal-300 dark:border-teal-700 text-teal-800 dark:text-teal-200"
                        : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    <Layers className="w-3 h-3" />
                    <span>Cắt tường</span>
                  </button>
                )}

                {onToggleMepLayer && (
                  <button
                    type="button"
                    onClick={onToggleMepLayer}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold border whitespace-nowrap transition-colors cursor-pointer ${
                      showMepLayer
                        ? "bg-orange-500 border-orange-500 text-white"
                        : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    <Zap className="w-3 h-3" />
                    <span>MEP</span>
                  </button>
                )}
              </div>
            </div>

            {/* Row 3: 1-Click Scene Moods + 4-Zone Smart Lights + Curtains + Camera Lens FOV */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-100 dark:border-slate-800">
              <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto">
                <div className="inline-flex items-center gap-1 pr-1.5 border-r border-slate-200 dark:border-slate-700">
                  <Sparkles className="w-3 h-3 text-teal-600 dark:text-teal-400 shrink-0" />
                  {SCENE_MOOD_PRESETS.map((mood) => {
                    const active =
                      timeOfDay === mood.timeOfDay &&
                      Math.abs(curtainRatio - mood.curtainOpenRatio) < 0.2;
                    return (
                      <button
                        key={mood.id}
                        type="button"
                        onClick={() => handleApplySceneMood(mood)}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold border whitespace-nowrap transition-colors cursor-pointer ${
                          active
                            ? "bg-teal-600 border-teal-600 text-white"
                            : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-teal-400"
                        }`}
                      >
                        {mood.label}
                      </button>
                    );
                  })}
                </div>

                {onUpdateLightingZones && (
                  <div className="flex items-center gap-1">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1 shrink-0">
                      <Lightbulb className="w-3 h-3 text-amber-500" />
                      <span>Đèn</span>
                    </span>
                    {LIGHTING_ZONE_BUTTONS.map((z) => {
                      const isOn = lightingZones[z.key];
                      return (
                        <button
                          key={z.key}
                          type="button"
                          onClick={() => onUpdateLightingZones({ [z.key]: !isOn })}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold border whitespace-nowrap transition-colors cursor-pointer ${
                            isOn
                              ? "bg-amber-100 dark:bg-amber-950/60 border-amber-400 dark:border-amber-700 text-amber-900 dark:text-amber-200"
                              : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 line-through"
                          }`}
                        >
                          {z.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {onUpdateCurtainOpenRatio && (
                  <div className="inline-flex items-center gap-1">
                    <Blinds className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 hidden sm:inline">
                      Rèm
                    </span>
                    <div className="inline-flex rounded-md bg-slate-100 dark:bg-slate-800 p-0.5">
                      {CURTAIN_PRESETS.map((cp) => {
                        const active = Math.abs(curtainRatio - cp.ratio) < 0.2;
                        return (
                          <button
                            key={cp.label}
                            type="button"
                            onClick={() => onUpdateCurtainOpenRatio(cp.ratio)}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap cursor-pointer ${
                              active
                                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                                : "text-slate-500 dark:text-slate-400"
                            }`}
                          >
                            {cp.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="inline-flex items-center gap-1">
                  <Aperture className="w-3 h-3 text-slate-400 shrink-0" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 hidden sm:inline">
                    FOV
                  </span>
                  <div className="inline-flex rounded-md bg-slate-100 dark:bg-slate-800 p-0.5">
                    {FOV_PRESETS.map((fp) => (
                      <button
                        key={fp.fov}
                        type="button"
                        onClick={() => handleSelectFov(fp.fov)}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold tabular-nums whitespace-nowrap cursor-pointer ${
                          cameraFov === fp.fov
                            ? "bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-300 shadow-xs"
                            : "text-slate-500 dark:text-slate-400"
                        }`}
                      >
                        {fp.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* WebGL Error Fallback */}
        {webglError && (
          <div className="absolute inset-0 bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center p-6 text-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center text-amber-700 dark:text-amber-300">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-100 max-w-md">
              {webglError}
            </p>
            {onFallbackTo2D && (
              <button
                type="button"
                onClick={onFallbackTo2D}
                className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold cursor-pointer"
              >
                Mở Bản vẽ 2D CAD chuẩn tỷ lệ
              </button>
            )}
          </div>
        )}
      </div>
    );
  }
);
