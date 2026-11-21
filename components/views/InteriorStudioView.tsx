"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import { useFinance } from "@/context/FinanceContext";
import {
  calculateScenarioBoq,
  evaluateErgonomicClearances,
} from "@/lib/interiorBoqEngine";
import { Interior3DViewportHandle } from "@/components/interior/Interior3DViewport";
import { InteriorSpecSheetPrintPortal } from "@/components/interior/InteriorSpecSheetPrintPortal";
import {
  StudioViewportMode,
  StudioWorkspaceTab,
} from "@/components/interior/tabs/StudioWorkspaceTab";
import { BoqProcurementTab } from "@/components/interior/tabs/BoqProcurementTab";
import { HandoverReadinessTab } from "@/components/interior/tabs/HandoverReadinessTab";
import { HandoverChecklistTab } from "@/components/interior/tabs/HandoverChecklistTab";

export function InteriorStudioView() {
  const { interiorTab, interiorStudio, isPrivacyMode } = useFinance();

  const [viewportMode, setViewportMode] = useState<StudioViewportMode>("3D");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [showMepLayer, setShowMepLayer] = useState<boolean>(false);

  const viewport3DRef = useRef<Interior3DViewportHandle | null>(null);
  const lastCapturedSnapshotRef = useRef<string | null>(null);
  const [printSpecOpen, setPrintSpecOpen] = useState<boolean>(false);
  const [captured3DSnapshot, setCaptured3DSnapshot] = useState<string | null>(null);

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

  const handleToggleMepLayer = useCallback(() => {
    setShowMepLayer((prev) => !prev);
  }, []);

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
    <div className="space-y-4">
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
          onToggleMepLayer={handleToggleMepLayer}
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
