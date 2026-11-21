"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useFinance } from "@/context/FinanceContext";
import { GoldLot } from "@/types/finance";
import {
  computeGoldPortfolioMetrics,
  computeNetWorthAllocationGuardrail,
  evaluateGoldAlerts,
} from "@/lib/goldEngine";
import {
  calculateConstructionMilestones,
  calculateHandoverReadiness,
  calculateScenarioBoq,
} from "@/lib/interiorBoqEngine";
import { GoldOverviewTab } from "@/components/gold/tabs/GoldOverviewTab";
import { GoldLotsTab } from "@/components/gold/tabs/GoldLotsTab";
import { GoldPricesTab } from "@/components/gold/tabs/GoldPricesTab";
import { GoldDcaTab } from "@/components/gold/tabs/GoldDcaTab";
import { GoldSimulatorTab } from "@/components/gold/tabs/GoldSimulatorTab";
import { GoldLotModal } from "@/components/gold/tabs/GoldLotModal";
import { GoldSellModal, GoldSellPrefill } from "@/components/gold/tabs/GoldSellModal";
import { GoldVaultPrintPortal } from "@/components/gold/tabs/GoldVaultPrintPortal";

export function GoldVaultView() {
  const {
    goldTab,
    setGoldTab,
    goldPortfolio,
    addGoldLot,
    updateGoldLot,
    deleteGoldLot,
    recordGoldSale,
    updateGoldPriceQuote,
    updateGoldMacro,
    updateGoldDcaPlan,
    toggleGoldIncludeInNetWorth,
    addGoldAlertRule,
    toggleGoldAlertRule,
    deleteGoldAlertRule,
    fetchReferenceGoldPrices,
    goldSimulatorPresetTarget,
    setGoldSimulatorPresetTarget,
    accounts,
    summary,
    skyoneLoan,
    interiorStudio,
    settings,
    isPrivacyMode,
    switchSubApp,
  } = useFinance();

  const metrics = useMemo(
    () => computeGoldPortfolioMetrics(goldPortfolio),
    [goldPortfolio]
  );

  const evaluatedAlerts = useMemo(
    () => evaluateGoldAlerts(goldPortfolio, metrics),
    [goldPortfolio, metrics]
  );

  const activeInteriorScenario = useMemo(
    () =>
      interiorStudio.scenarios.find((s) => s.id === interiorStudio.activeScenarioId) ||
      interiorStudio.scenarios[0],
    [interiorStudio]
  );

  const activeBoqSummary = useMemo(
    () => (activeInteriorScenario ? calculateScenarioBoq(activeInteriorScenario) : null),
    [activeInteriorScenario]
  );

  const nhanBidPerChi = goldPortfolio.quotes.NHAN_9999?.buyPricePerChi || 9_050_000;
  const monthlySurplus = Math.max(10_000_000, summary.savingsAmount || 18_000_000);

  const handoverReadiness = useMemo(
    () =>
      calculateHandoverReadiness({
        liquidCashVnd: summary.currentBalance,
        monthlyNetSurplusVnd: monthlySurplus,
        monthsUntilHandover: 9,
        goldLiquidationValueBidVnd: metrics.totalLiquidationValueBid,
        goldNhan9999BidPerChiVnd: nhanBidPerChi,
        interiorBoqTotalVnd: activeBoqSummary?.grandTotalWithContingency ?? 140_000_000,
        interiorBoqPaidVnd: activeBoqSummary?.paidOrDepositedVnd ?? 0,
        includePinkBook5Pct: false,
      }),
    [
      summary.currentBalance,
      monthlySurplus,
      metrics.totalLiquidationValueBid,
      nhanBidPerChi,
      activeBoqSummary,
    ]
  );

  const milestonesPlan = useMemo(
    () =>
      calculateConstructionMilestones({
        boqTotalVnd: activeBoqSummary?.grandTotalWithContingency ?? 140_000_000,
        boqPaidVnd: activeBoqSummary?.paidOrDepositedVnd ?? 0,
        currentLiquidCashVnd: summary.currentBalance,
        monthlyNetSurplusVnd: monthlySurplus,
        monthsUntilHandover: 9,
        goldPortfolio,
      }),
    [activeBoqSummary, summary.currentBalance, monthlySurplus, goldPortfolio]
  );

  // Household Net Worth estimate for Allocation Guardrail
  const estimatedHouseholdNetWorthVnd = useMemo(() => {
    const liquidCash = Math.max(0, summary.currentBalance);
    const goldBid = metrics.totalLiquidationValueBid;
    const baseNetWorth = goldPortfolio.includeInNetWorth
      ? Math.max(liquidCash, goldBid)
      : liquidCash + goldBid;
    return Math.max(goldBid, baseNetWorth);
  }, [summary.currentBalance, metrics.totalLiquidationValueBid, goldPortfolio.includeInNetWorth]);

  const guardrail = useMemo(
    () =>
      computeNetWorthAllocationGuardrail(
        metrics.totalLiquidationValueBid,
        estimatedHouseholdNetWorthVnd,
        goldPortfolio.dcaPlan.targetAllocationPercentOfNetWorth,
        nhanBidPerChi
      ),
    [
      metrics.totalLiquidationValueBid,
      estimatedHouseholdNetWorthVnd,
      goldPortfolio.dcaPlan.targetAllocationPercentOfNetWorth,
      nhanBidPerChi,
    ]
  );

  // Modals & Print Portal State
  const [isLotModalOpen, setIsLotModalOpen] = useState(false);
  const [editingLot, setEditingLot] = useState<GoldLot | null>(null);
  const [isSellModalOpen, setIsSellModalOpen] = useState(false);
  const [sellPrefill, setSellPrefill] = useState<GoldSellPrefill | null>(null);
  const [isPrintPortalOpen, setIsPrintPortalOpen] = useState(false);

  // Prices tab reference fetch state
  const [isFetchingRef, setIsFetchingRef] = useState(false);
  const [refStatusMsg, setRefStatusMsg] = useState<string | null>(null);

  // Simulator target state (syncs with cross-app preset from SkyOne Studio)
  const [simTargetVnd, setSimTargetVnd] = useState<number>(() =>
    Math.max(50_000_000, handoverReadiness.cashOnlyGapVnd || 90_000_000)
  );
  const [simPresetLabel, setSimPresetLabel] = useState<string | null>(null);

  useEffect(() => {
    if (goldSimulatorPresetTarget && goldSimulatorPresetTarget.amountVnd > 0) {
      setSimTargetVnd(goldSimulatorPresetTarget.amountVnd);
      setSimPresetLabel(goldSimulatorPresetTarget.label);
      setGoldSimulatorPresetTarget(null);
    }
  }, [goldSimulatorPresetTarget, setGoldSimulatorPresetTarget]);

  const nonCreditAccounts = useMemo(
    () => accounts.filter((a) => a.type !== "CREDIT_CARD"),
    [accounts]
  );

  const holdingLots = useMemo(
    () => goldPortfolio.lots.filter((l) => l.remainingChi > 0.0001),
    [goldPortfolio.lots]
  );

  const handleOpenAddLot = () => {
    setEditingLot(null);
    setIsLotModalOpen(true);
  };

  const handleEditLot = (lot: GoldLot) => {
    setEditingLot(lot);
    setIsLotModalOpen(true);
  };

  const handleOpenSellModal = (prefill?: GoldSellPrefill) => {
    setSellPrefill(prefill ?? null);
    setIsSellModalOpen(true);
  };

  const handleServerPriceFetch = async () => {
    setIsFetchingRef(true);
    setRefStatusMsg(null);
    const res = await fetchReferenceGoldPrices(true);
    setIsFetchingRef(false);
    setRefStatusMsg(
      res.ok ? res.note || "Đã cập nhật bảng giá tham khảo." : res.error || "Lỗi kết nối."
    );
  };

  return (
    <div className="space-y-6 pb-8">
      {goldTab === "OVERVIEW" && (
        <GoldOverviewTab
          goldPortfolio={goldPortfolio}
          metrics={metrics}
          evaluatedAlerts={evaluatedAlerts}
          guardrail={guardrail}
          handoverReadiness={handoverReadiness}
          husbandName={settings.husbandName}
          wifeName={settings.wifeName}
          isPrivacyMode={isPrivacyMode}
          onOpenAddLot={handleOpenAddLot}
          onOpenSellModal={() => handleOpenSellModal()}
          onPrintVaultAudit={() => setIsPrintPortalOpen(true)}
          onSwitchGoldTab={setGoldTab}
          onSwitchSubApp={switchSubApp}
        />
      )}

      {goldTab === "LOTS" && (
        <GoldLotsTab
          goldPortfolio={goldPortfolio}
          metrics={metrics}
          isPrivacyMode={isPrivacyMode}
          onOpenAddLot={handleOpenAddLot}
          onEditLot={handleEditLot}
          onSellLot={(lot) =>
            handleOpenSellModal({
              category: lot.category,
              mode: "SPECIFIC_LOT",
              specificLotId: lot.id,
              quantityChi: lot.remainingChi,
            })
          }
          onDeleteLot={deleteGoldLot}
          onPrintVaultAudit={() => setIsPrintPortalOpen(true)}
        />
      )}

      {goldTab === "PRICES" && (
        <GoldPricesTab
          goldPortfolio={goldPortfolio}
          evaluatedAlerts={evaluatedAlerts}
          isPrivacyMode={isPrivacyMode}
          isFetchingRef={isFetchingRef}
          refStatusMsg={refStatusMsg}
          onFetchReferencePrices={handleServerPriceFetch}
          onUpdateQuote={updateGoldPriceQuote}
          onUpdateMacro={updateGoldMacro}
          onAddAlertRule={addGoldAlertRule}
          onToggleAlertRule={toggleGoldAlertRule}
          onDeleteAlertRule={deleteGoldAlertRule}
        />
      )}

      {goldTab === "DCA" && (
        <GoldDcaTab
          goldPortfolio={goldPortfolio}
          metrics={metrics}
          guardrail={guardrail}
          isPrivacyMode={isPrivacyMode}
          onUpdateDcaPlan={updateGoldDcaPlan}
          onToggleIncludeInNetWorth={toggleGoldIncludeInNetWorth}
        />
      )}

      {goldTab === "SIMULATOR" && (
        <GoldSimulatorTab
          goldPortfolio={goldPortfolio}
          metrics={metrics}
          skyoneLoan={skyoneLoan}
          handoverReadiness={handoverReadiness}
          milestonesPlan={milestonesPlan}
          simTargetVnd={simTargetVnd}
          simPresetLabel={simPresetLabel}
          onChangeSimTargetVnd={(val, label) => {
            setSimTargetVnd(val);
            if (label !== undefined) setSimPresetLabel(label);
          }}
          isPrivacyMode={isPrivacyMode}
          onExecuteSimulatedSale={(prefill) => handleOpenSellModal(prefill)}
          onPrintVaultAudit={() => setIsPrintPortalOpen(true)}
        />
      )}

      <GoldLotModal
        open={isLotModalOpen}
        editingLot={editingLot}
        goldPortfolio={goldPortfolio}
        nonCreditAccounts={nonCreditAccounts}
        husbandName={settings.husbandName}
        wifeName={settings.wifeName}
        onClose={() => setIsLotModalOpen(false)}
        onAddLot={addGoldLot}
        onUpdateLot={updateGoldLot}
      />

      <GoldSellModal
        open={isSellModalOpen}
        prefill={sellPrefill}
        goldPortfolio={goldPortfolio}
        holdingLots={holdingLots}
        nonCreditAccounts={nonCreditAccounts}
        onClose={() => setIsSellModalOpen(false)}
        onRecordSale={recordGoldSale}
      />

      {isPrintPortalOpen && (
        <GoldVaultPrintPortal
          portfolio={goldPortfolio}
          metrics={metrics}
          isPrivacyMode={isPrivacyMode}
          onDone={() => setIsPrintPortalOpen(false)}
        />
      )}
    </div>
  );
}
