import test from "node:test";
import assert from "node:assert/strict";
import {
  createDefaultInteriorStudio,
  createScenarioAGuestBedroom,
  createScenarioBDualGrowthStudio,
} from "./interiorFloorplan";
import {
  calculateHandoverReadiness,
  calculateScenarioBoq,
  evaluateErgonomicClearances,
} from "./interiorBoqEngine";

test("Scenario A (~118M) and Scenario B Dual Growth Studio (~140M) both fit inside 100-150M turnkey budget", () => {
  const scA = createScenarioAGuestBedroom();
  const scB = createScenarioBDualGrowthStudio();
  const boqA = calculateScenarioBoq(scA);
  const boqB = calculateScenarioBoq(scB);

  assert.equal(boqA.budgetStatus, "IN_TARGET_RANGE");
  assert.equal(boqB.budgetStatus, "IN_TARGET_RANGE");
  assert.ok(boqA.grandTotalWithContingency >= 100_000_000 && boqA.grandTotalWithContingency <= 150_000_000);
  assert.ok(boqB.grandTotalWithContingency >= 100_000_000 && boqB.grandTotalWithContingency <= 150_000_000);
  assert.ok(boqB.grandTotalWithContingency > boqA.grandTotalWithContingency);

  // Developer-included Hafele kitchen & WC must always cost 0 VND
  assert.equal(boqA.byGroup.DEVELOPER_INCLUDED, 0);
  assert.equal(boqB.byGroup.DEVELOPER_INCLUDED, 0);
  assert.equal(boqB.developerIncludedCount, 2);
});

test("Scenario B Dual Growth Studio contains dual workstation desk and 2 ergonomic chairs in Room 05", () => {
  const studio = createDefaultInteriorStudio();
  const scB = studio.scenarios.find((s) => s.code === "B");
  assert.ok(scB);
  assert.equal(studio.activeScenarioId, scB.id);

  const dualDesk = scB.items.find((i) => i.catalogKey === "dual_workstation_desk");
  const chairs = scB.items.filter((i) => i.catalogKey === "ergonomic_chair");
  assert.ok(dualDesk);
  assert.equal(dualDesk.roomId, "room_05");
  assert.equal(chairs.length, 2);
});

test("Default Scenario A and Scenario B layouts pass ergonomic clearance check without danger errors", () => {
  const scA = createScenarioAGuestBedroom();
  const scB = createScenarioBDualGrowthStudio();

  const dangerA = evaluateErgonomicClearances(scA).filter((w) => w.severity === "DANGER");
  const dangerB = evaluateErgonomicClearances(scB).filter((w) => w.severity === "DANGER");
  assert.equal(dangerA.length, 0);
  assert.equal(dangerB.length, 0);
});

test("calculateHandoverReadiness bridges FINANCE cash, GOLD Bid, SKYONE PBT 2% and INTERIOR BOQ", () => {
  const readyWithGold = calculateHandoverReadiness({
    liquidCashVnd: 40_000_000,
    monthlyNetSurplusVnd: 10_000_000,
    goldLiquidationValueBidVnd: 80_000_000,
    goldNhan9999BidPerChiVnd: 8_350_000,
    interiorBoqTotalVnd: 140_000_000,
    includePinkBook5Pct: false,
    monthsUntilHandover: 9,
  });

  // Need = 28.93M + 140M = ~168.93M; Projected cash = 40M + 90M = 130M => cash gap ~38.93M covered by 80M gold
  assert.equal(readyWithGold.status, "READY_WITH_GOLD");
  assert.ok(readyWithGold.cashOnlyGapVnd > 0);
  assert.ok(readyWithGold.combinedSurplusOrGapVnd > 0);
  assert.ok(readyWithGold.suggestedGoldChiToSell > 0);
});
