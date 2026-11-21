import test from "node:test";
import assert from "node:assert/strict";
import {
  createDefaultInteriorStudio,
  createScenarioAGuestBedroom,
  createScenarioBDualGrowthStudio,
  resolveFinishForStylePreset,
} from "./interiorFloorplan";
import {
  calculateHandoverReadiness,
  calculateScenarioBoq,
  compareInteriorScenarios,
  evaluateErgonomicClearances,
} from "./interiorBoqEngine";
import { InteriorDesignScenarioSchema } from "./validations";

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
  assert.ok((scB.mepPoints?.length ?? 0) >= 12);
});

test("Default Scenario A and Scenario B layouts pass ergonomic clearance check without danger errors", () => {
  const scA = createScenarioAGuestBedroom();
  const scB = createScenarioBDualGrowthStudio();

  const dangerA = evaluateErgonomicClearances(scA).filter((w) => w.severity === "DANGER");
  const dangerB = evaluateErgonomicClearances(scB).filter((w) => w.severity === "DANGER");
  assert.equal(dangerA.length, 0, `Unexpected DANGER in Scenario A: ${dangerA.map((w) => w.message).join("; ")}`);
  assert.equal(dangerB.length, 0, `Unexpected DANGER in Scenario B: ${dangerB.map((w) => w.message).join("; ")}`);
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

test("calculateHandoverReadiness eliminates double-counting when BOQ deposit is paid from liquid cash", () => {
  const beforePayment = calculateHandoverReadiness({
    liquidCashVnd: 100_000_000,
    monthlyNetSurplusVnd: 15_000_000,
    goldLiquidationValueBidVnd: 80_000_000,
    goldNhan9999BidPerChiVnd: 9_000_000,
    interiorBoqTotalVnd: 140_000_000,
    interiorBoqPaidVnd: 0,
    includePinkBook5Pct: false,
    monthsUntilHandover: 9,
  });

  // User pays 50M deposit from cash: cash drops 100M -> 50M, BOQ paid rises 0 -> 50M
  const afterPayment = calculateHandoverReadiness({
    liquidCashVnd: 50_000_000,
    monthlyNetSurplusVnd: 15_000_000,
    goldLiquidationValueBidVnd: 80_000_000,
    goldNhan9999BidPerChiVnd: 9_000_000,
    interiorBoqTotalVnd: 140_000_000,
    interiorBoqPaidVnd: 50_000_000,
    includePinkBook5Pct: false,
    monthsUntilHandover: 9,
  });

  assert.equal(afterPayment.interiorBoqGrossTotalVnd, 140_000_000);
  assert.equal(afterPayment.interiorBoqPaidVnd, 50_000_000);
  assert.equal(afterPayment.interiorBoqTotalVnd, 90_000_000);
  assert.equal(afterPayment.cashOnlyGapVnd, beforePayment.cashOnlyGapVnd);
  assert.equal(afterPayment.combinedSurplusOrGapVnd, beforePayment.combinedSurplusOrGapVnd);
});

test("Multi-tranche BOQ payments (40% deposit + 40% delivery + 20% acceptance) compute exact paid & remaining", () => {
  const scB = createScenarioBDualGrowthStudio();
  const sofa = scB.items.find((i) => i.catalogKey === "sofa_3seat");
  assert.ok(sofa);

  const totalSofa = sofa.unitPriceVnd; // FIXED_UNIT pricing
  const dep = Math.round(totalSofa * 0.4);
  const deliv = Math.round(totalSofa * 0.4);

  sofa.procurementStatus = "DEPOSITED";
  sofa.payments = [
    {
      id: "pay_1",
      date: "2027-06-01",
      amountVnd: dep,
      stage: "DEPOSIT",
      accountId: "acc_main",
      memberId: "HUSBAND",
      linkedTransactionId: "tx_1",
    },
    {
      id: "pay_2",
      date: "2027-07-01",
      amountVnd: deliv,
      stage: "DELIVERY",
      accountId: "acc_main",
      memberId: "WIFE",
      linkedTransactionId: "tx_2",
    },
  ];

  const boq = calculateScenarioBoq(scB);
  const sofaRow = boq.rows.find((r) => r.id === sofa.id);
  assert.ok(sofaRow);
  assert.equal(sofaRow.paidAmountVnd, dep + deliv);
  assert.equal(sofaRow.remainingAmountVnd, totalSofa - dep - deliv);
  assert.equal(boq.paidOrDepositedVnd, dep + deliv);
  assert.equal(boq.remainingToPayVnd, boq.grandTotalWithContingency - (dep + deliv));
});

test("compareInteriorScenarios computes accurate netDeltaVnd and Room 05 differences between PA-A and PA-B", () => {
  const scA = createScenarioAGuestBedroom();
  const scB = createScenarioBDualGrowthStudio();
  const diff = compareInteriorScenarios(scA, scB);

  const boqA = calculateScenarioBoq(scA);
  const boqB = calculateScenarioBoq(scB);

  assert.equal(diff.baseTotalVnd, boqA.grandTotalWithContingency);
  assert.equal(diff.compareTotalVnd, boqB.grandTotalWithContingency);
  assert.equal(diff.netDeltaVnd, boqB.grandTotalWithContingency - boqA.grandTotalWithContingency);
  assert.ok(diff.entries.length > 0);

  // Dual workstation desk exists only in PA-B
  const dualDeskDiff = diff.entries.find((e) => e.key === "3D_ITEM_it_pb_dual_desk");
  assert.ok(dualDeskDiff);
  assert.equal(dualDeskDiff.kind, "ONLY_IN_COMPARE");
  assert.ok(dualDeskDiff.deltaVnd > 0);
});

test("resolveFinishForStylePreset preserves developer finishes and updates wood & fabric finishes", () => {
  const scB = createScenarioBDualGrowthStudio();
  const dualDesk = scB.items.find((i) => i.catalogKey === "dual_workstation_desk");
  const sofa = scB.items.find((i) => i.catalogKey === "sofa_3seat");
  const kitchen = scB.items.find((i) => i.source === "DEVELOPER_INCLUDED");
  assert.ok(dualDesk && sofa && kitchen);

  assert.equal(resolveFinishForStylePreset(dualDesk, "MINIMALIST_SLATE"), "LIGHT_WALNUT");
  assert.equal(resolveFinishForStylePreset(sofa, "WARM_SCANDINAVIAN"), "SAGE_LINEN");
  // Developer-included items never change finish
  assert.equal(resolveFinishForStylePreset(kitchen, "MINIMALIST_SLATE"), kitchen.materialFinish);
});

test("Zod InteriorDesignScenarioSchema validates architecture overrides, lighting, mountType, custom GLB, MEP & payments while staying backwards compatible", () => {
  const scB = createScenarioBDualGrowthStudio();
  scB.wallOverrides = {
    w_room05_corridor: { mode: "GLASS_PARTITION", accentFinish: "DEFAULT" },
    w_east_main: { accentFinish: "WOOD_SLAT_PANEL" },
  };
  scB.doorOverrides = { op_room05_door: "SLIDING_POCKET" };
  scB.roomFloorOverrides = { room_master_bed: "HERRINGBONE" };
  scB.lightingZones = { living: true, kitchen: false, master: true, room05: true };
  scB.curtainOpenRatio = 0.5;
  scB.items[0].vendorName = "Xưởng An Cường";
  scB.items[0].leadTimeDays = 14;
  scB.items[0].warrantyMonths = 24;
  scB.items[0].mountType = "FLOOR";
  scB.items[0].elevationCm = 0;
  scB.items[0].payments = [
    {
      id: "pay_zod_1",
      date: "2027-05-15",
      amountVnd: 5_000_000,
      stage: "DEPOSIT",
      accountId: "acc_main",
      memberId: "HUSBAND",
      linkedTransactionId: "tx_zod_1",
    },
  ];
  scB.items.push({
    ...scB.items[0],
    id: "it_custom_glb_test",
    catalogKey: "custom_glb_model",
    name: "Ghế Lounge Custom",
    mountType: "FLOOR",
    elevationCm: 0,
    customGlbId: "glb_123456",
    customGlbName: "lounge.glb",
  });

  const parsedModern = InteriorDesignScenarioSchema.safeParse(scB);
  assert.equal(parsedModern.success, true);

  // Backwards compatibility: strip mepPoints and all new architecture/lighting optional fields
  const legacyScenario = {
    ...scB,
    items: scB.items.filter((i) => i.id !== "it_custom_glb_test"),
    mepPoints: undefined,
    wallOverrides: undefined,
    doorOverrides: undefined,
    roomFloorOverrides: undefined,
    lightingZones: undefined,
    curtainOpenRatio: undefined,
  };
  const parsedLegacy = InteriorDesignScenarioSchema.safeParse(legacyScenario);
  assert.equal(parsedLegacy.success, true);
});

test("Architecture customization (Glass partition, Accent Wall, Sliding door, Herringbone floor) auto-updates BOQ renovation subtotal", () => {
  const base = createScenarioBDualGrowthStudio();
  const baseBoq = calculateScenarioBoq(base);

  const customized = createScenarioBDualGrowthStudio();
  customized.wallOverrides = {
    w_room05_corridor: { mode: "GLASS_PARTITION" }, // +8,500,000
    w_east_main: { accentFinish: "WOOD_SLAT_PANEL" }, // +5,400,000
  };
  customized.doorOverrides = {
    op_room05_door: "SLIDING_POCKET", // +4,500,000
  };
  customized.roomFloorOverrides = {
    room_master_bed: "HERRINGBONE", // +4,800,000
  };

  const customBoq = calculateScenarioBoq(customized);
  const expectedDeltaSubtotal = 8_500_000 + 5_400_000 + 4_500_000 + 4_800_000;
  assert.equal(customBoq.subtotalNewPurchase - baseBoq.subtotalNewPurchase, expectedDeltaSubtotal);
  assert.ok(customBoq.rows.some((r) => r.id.startsWith("arch_wall_mode_")));
  assert.ok(customBoq.rows.some((r) => r.id.startsWith("arch_wall_accent_")));
  assert.ok(customBoq.rows.some((r) => r.id.startsWith("arch_door_")));
  assert.ok(customBoq.rows.some((r) => r.id.startsWith("arch_floor_")));
});

