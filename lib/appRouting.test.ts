import test from "node:test";
import assert from "node:assert/strict";
import { buildAppPath, parseAppRoute } from "./appRouting";
import {
  APP_ECOSYSTEM_REGISTRY,
  SUB_APP_REGISTRY,
  computeEcosystemAlertBadges,
  getEcosystemAppByShortcutDigit,
} from "./appRegistry";
import { createDefaultSkyOneLoan } from "./mortgageEngine";
import { createDefaultGoldPortfolio } from "./goldEngine";
import { createDefaultInteriorStudio } from "./interiorFloorplan";

test("parseAppRoute & buildAppPath round-trip GOLD ?target= and INTERIOR ?scenario= deep links", () => {
  const goldPath = buildAppPath("GOLD", "overview", "OVERVIEW", null, "SIMULATOR", "STUDIO", {
    goldTargetAmount: 185_000_000,
  });
  assert.equal(goldPath, "/gold/simulator?target=185000000");

  const parsedGold = parseAppRoute("/gold/simulator", "?target=185000000");
  assert.equal(parsedGold.app, "GOLD");
  assert.equal(parsedGold.goldTab, "SIMULATOR");
  assert.equal(parsedGold.goldTargetAmount, 185_000_000);

  const interiorPath = buildAppPath("INTERIOR", "overview", "OVERVIEW", null, "OVERVIEW", "BOQ", {
    interiorScenarioId: "scenario_pa_b",
  });
  assert.equal(interiorPath, "/interior/boq?scenario=scenario_pa_b");

  const parsedInterior = parseAppRoute("/interior/boq", "?scenario=scenario_pa_b");
  assert.equal(parsedInterior.app, "INTERIOR");
  assert.equal(parsedInterior.interiorTab, "BOQ");
  assert.equal(parsedInterior.interiorScenarioId, "scenario_pa_b");
});

test("SUB_APP_REGISTRY registers all 4 top-level apps and resolves Alt+1..4 shortcuts", () => {
  assert.equal(SUB_APP_REGISTRY, APP_ECOSYSTEM_REGISTRY);
  assert.equal(SUB_APP_REGISTRY.length, 4);
  assert.equal(getEcosystemAppByShortcutDigit("1"), "FINANCE");
  assert.equal(getEcosystemAppByShortcutDigit("2"), "SKYONE");
  assert.equal(getEcosystemAppByShortcutDigit("3"), "GOLD");
  assert.equal(getEcosystemAppByShortcutDigit("4"), "INTERIOR");
  assert.equal(getEcosystemAppByShortcutDigit("9"), null);
});

test("computeEcosystemAlertBadges aggregates privacy-safe alerts across FINANCE, SKYONE, GOLD, and INTERIOR", () => {
  const skyoneLoan = createDefaultSkyOneLoan("2026-11-21");
  const goldPortfolio = createDefaultGoldPortfolio();
  const interiorStudio = createDefaultInteriorStudio();

  // Trigger a GOLD alert (TARGET_BID_ABOVE)
  goldPortfolio.quotes.NHAN_9999.buyPricePerChi = 10_500_000;
  goldPortfolio.quotes.NHAN_9999.sellPricePerChi = 10_700_000;

  // Trigger a critical snag in INTERIOR
  interiorStudio.handoverChecklist[0] = {
    ...interiorStudio.handoverChecklist[0],
    status: "DEFECT_CRITICAL",
  };

  const badges = computeEcosystemAlertBadges({
    skyoneLoan,
    goldPortfolio,
    interiorStudio,
    budgetItems: [
      {
        categoryId: "cat_food",
        categoryName: "Ăn uống",
        categoryColor: "#f59e0b",
        limitAmount: 5_000_000,
        spentAmount: 6_200_000,
        remainingAmount: -1_200_000,
        percentage: 124,
      },
    ],
    referenceDate: "2026-11-21",
  });

  assert.equal(badges.FINANCE?.severity, "danger");
  assert.equal(badges.GOLD?.severity, "warning");
  assert.equal(badges.INTERIOR?.severity, "danger");
  assert.equal(badges.INTERIOR?.count, 1);

  // Privacy-safe guarantee: badges must never leak raw VND numbers
  for (const badge of Object.values(badges)) {
    if (!badge) continue;
    assert.equal(badge.compactLabel.includes("000.000"), false);
    assert.equal(badge.detailLabel.includes("000.000"), false);
  }
});
