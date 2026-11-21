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
} from "lucide-react";
import { InteriorDesignScenario } from "@/types/finance";
import {
  InteriorCameraPreset,
  InteriorNavMode,
  InteriorSceneController,
  InteriorTimeOfDay,
} from "@/lib/three/interiorSceneController";
import { useFinance } from "@/context/FinanceContext";

export interface Interior3DViewportHandle {
  captureSnapshotPng: () => string | null;
}

interface Interior3DViewportProps {
  scenario: InteriorDesignScenario;
  selectedItemId: string | null;
  showMepLayer?: boolean;
  onToggleMepLayer?: () => void;
  onSelectItem: (id: string | null) => void;
  onItemMoved: (id: string, x: number, z: number) => void;
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
      showMepLayer = false,
      onToggleMepLayer,
      onSelectItem,
      onItemMoved,
      onFallbackTo2D,
      className = "",
    },
    ref
  ) {
    const { themeMode } = useFinance();
    const mountRef = useRef<HTMLDivElement | null>(null);
    const controllerRef = useRef<InteriorSceneController | null>(null);
    const callbacksRef = useRef({ onSelectItem, onItemMoved });
    callbacksRef.current = { onSelectItem, onItemMoved };

    const [webglError, setWebglError] = useState<string | null>(null);
    const [activePreset, setActivePreset] = useState<InteriorCameraPreset>("DOLLHOUSE");
    const [timeOfDay, setTimeOfDay] = useState<InteriorTimeOfDay>("MORNING_08");
    const [navMode, setNavMode] = useState<InteriorNavMode>("ORBIT");
    const [autoCutaway, setAutoCutaway] = useState<boolean>(true);
    const [dockExpanded, setDockExpanded] = useState<boolean>(true);
    const [snapshotFlash, setSnapshotFlash] = useState<boolean>(false);

    const isDarkMode = themeMode === "dark";

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
            onItemMoved: (id, x, z) => callbacksRef.current.onItemMoved(id, x, z),
            onContextLost: () => {
              setWebglError(
                "Trình duyệt tạm giải phóng ngữ cảnh WebGL 3D. Bạn có thể chuyển sang Bản vẽ 2D CAD."
              );
            },
          },
          isDarkMode
        );
        ctrl.setShowMepLayer(showMepLayer);
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

    useEffect(() => {
      controllerRef.current?.setSelectedItem(selectedItemId);
    }, [selectedItemId]);

    useEffect(() => {
      controllerRef.current?.setDarkMode(isDarkMode);
    }, [isDarkMode]);

    useEffect(() => {
      controllerRef.current?.setShowMepLayer(showMepLayer);
    }, [showMepLayer]);

    const handleSelectCamera = (preset: InteriorCameraPreset) => {
      setActivePreset(preset);
      controllerRef.current?.applyCameraPreset(preset);
    };

    const handleSelectTime = (tod: InteriorTimeOfDay) => {
      setTimeOfDay(tod);
      controllerRef.current?.setTimeOfDay(tod);
    };

    const handleToggleNavMode = (mode: InteriorNavMode) => {
      setNavMode(mode);
      controllerRef.current?.setNavMode(mode);
    };

    const handleToggleCutaway = () => {
      const next = !autoCutaway;
      setAutoCutaway(next);
      controllerRef.current?.setAutoCutaway(next);
    };

    const handleSnapshot = () => {
      const ctrl = controllerRef.current;
      if (!ctrl) return;
      try {
        const dataUrl = ctrl.captureSnapshotPng();
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = `skyone_a12a07_3d_${scenario.code.toLowerCase()}_${Date.now()}.png`;
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
        className={`relative rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-[#EFECE6] dark:bg-[#171A21] ${className}`}
      >
        {/* WebGL Canvas Mount */}
        <div ref={mountRef} className="w-full h-full min-h-[420px] sm:min-h-[540px]" />

        {/* Minimal Top-Left Apartment Tag (Solid surface, no backdrop-filter over WebGL) */}
        <div className="pointer-events-none absolute top-3 left-3 flex flex-col gap-1">
          <div className="bg-slate-900 text-white px-3 py-1.5 rounded-lg border border-slate-700/80 shadow-sm">
            <p className="text-[11px] font-black tracking-tight leading-tight">
              A.12A.07 · Loại A2 (51.0 m²)
            </p>
            <p className="text-[10px] text-teal-300 font-semibold leading-tight mt-0.5">
              {scenario.shortLabel} · Ban công Đông Nam
            </p>
          </div>
          {navMode === "WALKTHROUGH" && (
            <div className="bg-teal-900 text-teal-100 px-2.5 py-1 rounded-md text-[10px] font-bold border border-teal-700">
              Đi bộ 1.60m (Chống xuyên tường) · Xoay bằng kéo tay · WASD / Joystick
            </div>
          )}
        </div>

        {/* Top-Right Compact Snapshot + Dock Collapse */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleSnapshot}
            title="Chụp phối cảnh 3D (PNG)"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm cursor-pointer"
          >
            <Camera className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            <span className="hidden sm:inline">{snapshotFlash ? "Đã lưu PNG" : "Chụp ảnh"}</span>
          </button>
          <button
            type="button"
            onClick={() => setDockExpanded((v) => !v)}
            aria-label={dockExpanded ? "Thu gọn thanh điều khiển 3D" : "Mở thanh điều khiển 3D"}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm cursor-pointer"
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
            className={`absolute left-3 z-20 ${dockExpanded ? "bottom-32 sm:bottom-28" : "bottom-4"}`}
          >
            <WalkthroughTouchJoystick
              onMove={(vx, vz) => controllerRef.current?.setWalkthroughJoystickVector(vx, vz)}
            />
          </div>
        )}

        {/* Collapsible Bottom Control Dock (Solid surface, no backdrop-filter) */}
        {dockExpanded && !webglError && (
          <div className="absolute bottom-3 left-3 right-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 shadow-lg space-y-2">
            {/* Row 1: Camera Presets */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0 px-1">
                Góc nhìn
              </span>
              {CAMERA_PRESET_BUTTONS.map((btn) => (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => handleSelectCamera(btn.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 transition-colors cursor-pointer ${
                    activePreset === btn.id
                      ? "bg-teal-600 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>

            {/* Row 2: Lighting Time + Nav Mode + Cutaway + MEP */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1 hidden sm:inline">
                  Ánh nắng
                </span>
                {TIME_BUTTONS.map((tb) => {
                  const Icon = tb.icon;
                  const active = timeOfDay === tb.id;
                  return (
                    <button
                      key={tb.id}
                      type="button"
                      onClick={() => handleSelectTime(tb.id)}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold tabular-nums transition-colors cursor-pointer ${
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
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold cursor-pointer ${
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
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold cursor-pointer ${
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
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
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
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
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
