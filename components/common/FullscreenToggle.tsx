"use client";

import React, { RefObject } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { useFullScreen } from "@/lib/useFullScreen";

export interface FullscreenToggleProps {
  /** Optional controlled fullscreen state. When omitted, manages document/target fullscreen via `useFullScreen`. */
  isFullscreen?: boolean;
  /** Optional controlled toggle callback. */
  onToggle?: () => void;
  /** Optional target element ref when running in self-managed mode. Defaults to `document.documentElement`. */
  targetRef?: RefObject<HTMLElement | null>;
  /** Enable CSS `100dvh × 100vw` fallback when using self-managed mode with a `targetRef`. */
  allowFallbackOverlay?: boolean;
  /** Visual density variant. */
  variant?: "icon" | "compact" | "labeled";
  /** Surface color tone (`dark` for dark teal mobile headers, `default` for standard light/dark surfaces). */
  tone?: "default" | "dark";
  labelEnter?: string;
  labelExit?: string;
  titleEnter?: string;
  titleExit?: string;
  className?: string;
}

/**
 * Reusable FullscreenToggle button.
 * Renders a crisp Maximize2/Minimize2 icon synced with `document.fullscreenElement`
 * (or controlled hybrid fullscreen state) with full keyboard accessibility.
 */
export function FullscreenToggle({
  isFullscreen: controlledIsFullscreen,
  onToggle: controlledOnToggle,
  targetRef,
  allowFallbackOverlay,
  variant = "icon",
  tone = "default",
  labelEnter = "Toàn màn hình",
  labelExit = "Thu gọn",
  titleEnter = "Bật chế độ toàn màn hình",
  titleExit = "Thoát chế độ toàn màn hình (Esc)",
  className = "",
}: FullscreenToggleProps) {
  const internal = useFullScreen({
    targetRef,
    allowFallbackOverlay: allowFallbackOverlay ?? Boolean(targetRef),
  });

  const isControlled = typeof controlledIsFullscreen === "boolean" && Boolean(controlledOnToggle);
  const isFullscreen = isControlled ? controlledIsFullscreen : internal.isFullscreen;
  const handleToggle = isControlled ? controlledOnToggle! : () => void internal.toggleFullscreen();

  const label = isFullscreen ? labelExit : labelEnter;
  const tooltip = isFullscreen ? titleExit : titleEnter;

  if (variant === "icon") {
    const toneClasses =
      tone === "dark"
        ? isFullscreen
          ? "bg-teal-500 border-teal-400 text-slate-950 hover:bg-teal-400"
          : "bg-teal-950/70 border-teal-800/80 text-teal-200 hover:bg-teal-900/70"
        : isFullscreen
          ? "bg-teal-600 border-teal-600 text-white hover:bg-teal-700"
          : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800";

    return (
      <button
        type="button"
        onClick={handleToggle}
        title={tooltip}
        aria-label={tooltip}
        aria-pressed={isFullscreen}
        className={`p-2 rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 shrink-0 cursor-pointer ${toneClasses} ${className}`}
      >
        {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
      </button>
    );
  }

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={handleToggle}
        title={tooltip}
        aria-label={tooltip}
        aria-pressed={isFullscreen}
        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border shadow-sm whitespace-nowrap shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 cursor-pointer ${
          isFullscreen
            ? "bg-teal-600 border-teal-600 text-white hover:bg-teal-700"
            : "bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
        } ${className}`}
      >
        {isFullscreen ? (
          <Minimize2 className="w-3.5 h-3.5" />
        ) : (
          <Maximize2 className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
        )}
        <span className="hidden sm:inline">{label}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      title={tooltip}
      aria-label={tooltip}
      aria-pressed={isFullscreen}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border whitespace-nowrap shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 cursor-pointer ${
        isFullscreen
          ? "bg-teal-600 border-teal-600 text-white hover:bg-teal-700"
          : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:border-teal-500 hover:text-teal-700 dark:hover:text-teal-300"
      } ${className}`}
    >
      {isFullscreen ? (
        <Minimize2 className="w-3.5 h-3.5" />
      ) : (
        <Maximize2 className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
      )}
      <span>{label}</span>
    </button>
  );
}
