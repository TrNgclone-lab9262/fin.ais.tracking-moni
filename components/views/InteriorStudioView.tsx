"use client";

import React, { useCallback, useRef, useState } from "react";
import { Eye } from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { useFullScreen } from "@/lib/useFullScreen";
import { useInteriorState } from "@/lib/useInteriorState";
import { Interior3DViewportHandle } from "@/components/interior/Interior3DViewport";
import { InteriorSpecSheetPrintPortal } from "@/components/interior/InteriorSpecSheetPrintPortal";
import { FullscreenToggle } from "@/components/common/FullscreenToggle";
import { StudioWorkspaceTab } from "@/components/interior/tabs/StudioWorkspaceTab";
import { BoqProcurementTab } from "@/components/interior/tabs/BoqProcurementTab";
import { HandoverReadinessTab } from "@/components/interior/tabs/HandoverReadinessTab";
import { HandoverChecklistTab } from "@/components/interior/tabs/HandoverChecklistTab";

export function InteriorStudioView() {
  const { interiorTab, isPrivacyMode } = useFinance();
  const {
    activeScenario,
    allScenarioBoqs,
    activeBoq,
    warnings,
    hiddenItemsCount,
    viewportMode,
    setViewportMode,
    showMepLayer,
    toggleMepLayer,
    interactionMode,
    setInteractionMode,
    selectedItemId,
    setSelectedItemId,
    selectedArchTarget,
    setSelectedArchTarget,
    activeCameraState,
    saveCameraState,
    toggleItemVisibility,
    showAllHiddenItems,
  } = useInteriorState();

  const stageRef = useRef<HTMLDivElement | null>(null);
  const stageFullscreen = useFullScreen({
    targetRef: stageRef,
    allowFallbackOverlay: true,
  });

  const viewport3DRef = useRef<Interior3DViewportHandle | null>(null);
  const lastCapturedSnapshotRef = useRef<string | null>(null);
  const [printSpecOpen, setPrintSpecOpen] = useState<boolean>(false);
  const [captured3DSnapshot, setCaptured3DSnapshot] = useState<string | null>(null);

  const handleToggleStageFullscreen = useCallback(() => {
    void stageFullscreen.toggleFullscreen();
  }, [stageFullscreen]);

  const handleExitStageFullscreen = useCallback(() => {
    void stageFullscreen.exitFullscreen();
  }, [stageFullscreen]);

  const handleRequestPrintSpecSheet = useCallback(() => {
    const freshSnap = viewport3DRef.current?.captureSnapshotPng() || null;
    if (freshSnap) {
      lastCapturedSnapshotRef.current = freshSnap;
    }
    setCaptured3DSnapshot(freshSnap || lastCapturedSnapshotRef.current);
    setPrintSpecOpen(true);
  }, []);

  const handlePrintDone = useCallback(() => {
    setPrintSpecOpen(false);
  }, []);

  return (
    <div className="relative space-y-3">
      {/* Top-Right Corner Studio Fullscreen Anchor + Hidden Items Restore */}
      {interiorTab === "STUDIO" && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 truncate">
            SKYONE STUDIO · A.12A.07 · {activeScenario.shortLabel}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {hiddenItemsCount > 0 && (
              <button
                type="button"
                onClick={showAllHiddenItems}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/50 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Hiện lại {hiddenItemsCount} món đang ẩn</span>
              </button>
            )}
            <FullscreenToggle
              variant="labeled"
              isFullscreen={stageFullscreen.isFullscreen}
              onToggle={handleToggleStageFullscreen}
              labelEnter="Toàn màn hình Studio"
              labelExit="Thu gọn Studio"
              titleEnter="Phóng to toàn màn hình khung 3D / 2D CAD"
              titleExit="Thu gọn khung 3D / 2D CAD (Esc)"
            />
          </div>
        </div>
      )}

      {interiorTab === "STUDIO" && (
        <StudioWorkspaceTab
          activeScenario={activeScenario}
          allScenarioBoqs={allScenarioBoqs}
          activeBoq={activeBoq}
          warnings={warnings}
          viewportMode={viewportMode}
          onChangeViewportMode={setViewportMode}
          selectedItemId={selectedItemId}
          onSelectItem={setSelectedItemId}
          showMepLayer={showMepLayer}
          onToggleMepLayer={toggleMepLayer}
          interactionMode={interactionMode}
          onChangeInteractionMode={setInteractionMode}
          selectedArchTarget={selectedArchTarget}
          onSelectArchTarget={setSelectedArchTarget}
          activeCameraState={activeCameraState}
          onSaveCameraState={saveCameraState}
          hiddenItemsCount={hiddenItemsCount}
          onToggleItemVisibility={toggleItemVisibility}
          onShowAllHiddenItems={showAllHiddenItems}
          stageRef={stageRef}
          isStageFullscreen={stageFullscreen.isFullscreen}
          onToggleStageFullscreen={handleToggleStageFullscreen}
          onExitStageFullscreen={handleExitStageFullscreen}
          viewport3DRef={viewport3DRef}
          onRequestPrintSpecSheet={handleRequestPrintSpecSheet}
        />
      )}

      {interiorTab === "BOQ" && (
        <BoqProcurementTab
          activeScenario={activeScenario}
          allScenarioBoqs={allScenarioBoqs}
          activeBoq={activeBoq}
          onRequestPrintSpecSheet={handleRequestPrintSpecSheet}
        />
      )}

      {interiorTab === "READINESS" && (
        <HandoverReadinessTab
          activeScenario={activeScenario}
          activeBoq={activeBoq}
        />
      )}

      {interiorTab === "CHECKLIST" && <HandoverChecklistTab />}

      {printSpecOpen && (
        <InteriorSpecSheetPrintPortal
          scenario={activeScenario}
          boq={activeBoq}
          warnings={warnings}
          snapshot3DDataUrl={captured3DSnapshot}
          isPrivacyMode={isPrivacyMode}
          onDone={handlePrintDone}
        />
      )}
    </div>
  );
}

export default InteriorStudioView;
