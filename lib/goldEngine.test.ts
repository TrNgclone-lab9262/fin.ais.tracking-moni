import test from "node:test";
import assert from "node:assert/strict";
import {
  allocateFifoGoldSale,
  allocateSpecificLotSale,
  buildGoldNavHistorySeries,
  computeDomesticPremium,
  computeGoldPortfolioMetrics,
  computeGoldVsMortgageBenchmark,
  computeNetWorthAllocationGuardrail,
  createDefaultGoldPortfolio,
  createGoldPriceSnapshot,
  evaluateGoldAlerts,
  simulateGoldLiquidation,
  upsertGoldPriceSnapshot,
} from "./goldEngine";

test("createDefaultGoldPortfolio seeds Nhẫn 9999 holdings and Bid valuation", () => {
  const portfolio = createDefaultGoldPortfolio();
  const metrics = computeGoldPortfolioMetrics(portfolio);

  assert.ok(metrics.totalRemainingChi > 0);
  assert.ok(metrics.totalLiquidationValueBid > 0);
  assert.ok(metrics.totalAskReplacementValue >= metrics.totalLiquidationValueBid);
  assert.ok(metrics.totalSpreadCostVnd >= 0);

  const nhanRow = metrics.byCategory.find((r) => r.category === "NHAN_9999");
  assert.ok(nhanRow);
  assert.equal(nhanRow.remainingChi, metrics.totalRemainingChi);
});

test("allocateFifoGoldSale consumes oldest lots first and updates remaining chỉ accurately", () => {
  const portfolio = createDefaultGoldPortfolio();
  const totalBefore = portfolio.lots.reduce((sum, l) => sum + l.remainingChi, 0);
  const sellQty = 3;

  const result = allocateFifoGoldSale(portfolio.lots, "NHAN_9999", sellQty);

  assert.equal(result.ok, true);
  assert.ok(result.allocations.length >= 2);
  const allocatedChi = result.allocations.reduce((s, a) => s + a.soldChi, 0);
  assert.equal(Number(allocatedChi.toFixed(4)), sellQty);

  const totalAfter = result.updatedLots.reduce((sum, l) => sum + l.remainingChi, 0);
  assert.equal(Number((totalBefore - totalAfter).toFixed(4)), sellQty);

  // Oldest lot (2025-09-15, 2 chỉ) should be fully sold first
  const oldest = result.updatedLots.find((l) => l.id === "gold_lot_nhan_2025_09");
  assert.ok(oldest);
  assert.equal(oldest.remainingChi, 0);
  assert.equal(oldest.status, "SOLD");
});

test("allocateSpecificLotSale rejects overselling a single lot", () => {
  const portfolio = createDefaultGoldPortfolio();
  const res = allocateSpecificLotSale(portfolio.lots, "gold_lot_nhan_2025_09", 99);
  assert.equal(res.ok, false);
});

test("computeDomesticPremium calculates domestic vs XAU/USD spread accurately", () => {
  const portfolio = createDefaultGoldPortfolio();
  const res = computeDomesticPremium(portfolio.quotes.NHAN_9999, portfolio.macro);
  assert.ok(res.worldPricePerChiVnd > 7_000_000);
  assert.equal(res.domesticAskPerChiVnd, portfolio.quotes.NHAN_9999.sellPricePerChi);
  assert.equal(res.spreadPerChiVnd, portfolio.quotes.NHAN_9999.sellPricePerChi - portfolio.quotes.NHAN_9999.buyPricePerChi);
});

test("simulateGoldLiquidation calculates chỉ needed for Q3/2027 handover target", () => {
  const portfolio = createDefaultGoldPortfolio();
  const sim = simulateGoldLiquidation(portfolio, 45_000_000, "MIN_SPREAD_FIRST");

  assert.ok(sim.totalSellChi > 0);
  assert.equal(sim.isFullyCovered, true);
  assert.ok(sim.totalProceedsVnd >= 45_000_000);
  assert.ok(sim.steps.length > 0);
});

test("buildGoldNavHistorySeries constructs deterministic chronological NAV points and overlays daily snapshots", () => {
  const portfolio = createDefaultGoldPortfolio();
  const snap = createGoldPriceSnapshot(portfolio, "2026-10-01T08:00:00.000Z");
  portfolio.priceHistory = upsertGoldPriceSnapshot(portfolio.priceHistory, snap);

  const series = buildGoldNavHistorySeries(portfolio);
  assert.ok(series.length >= 4);
  for (let i = 1; i < series.length; i++) {
    assert.ok(series[i].date >= series[i - 1].date);
  }
  const latest = series[series.length - 1];
  const metrics = computeGoldPortfolioMetrics(portfolio);
  assert.equal(latest.source, "CURRENT");
  assert.equal(latest.bidValueVnd, metrics.totalLiquidationValueBid);
  assert.equal(latest.costBasisVnd, metrics.totalCostBasis);
});

test("evaluateGoldAlerts triggers TARGET_BID_ABOVE and SPREAD_ABOVE_PCT when quotes cross thresholds", () => {
  const portfolio = createDefaultGoldPortfolio();
  portfolio.quotes.NHAN_9999.buyPricePerChi = 9_750_000;
  portfolio.quotes.NHAN_9999.sellPricePerChi = 9_920_000;
  portfolio.quotes.SJC_BAR.buyPricePerChi = 9_000_000;
  portfolio.quotes.SJC_BAR.sellPricePerChi = 9_400_000; // ~4.25% spread

  const alerts = evaluateGoldAlerts(portfolio);
  const targetBidAlert = alerts.find((a) => a.rule.condition === "TARGET_BID_ABOVE");
  const spreadAlert = alerts.find((a) => a.rule.condition === "SPREAD_ABOVE_PCT");

  assert.ok(targetBidAlert);
  assert.equal(targetBidAlert.triggered, true);
  assert.ok(spreadAlert);
  assert.equal(spreadAlert.triggered, true);
});

test("computeGoldVsMortgageBenchmark computes break-even rate and switches verdict cleanly", () => {
  const portfolio = createDefaultGoldPortfolio();
  const metrics = computeGoldPortfolioMetrics(portfolio);

  const holdCase = computeGoldVsMortgageBenchmark(portfolio, metrics, null, {
    expectedGoldGrowthPct: 12.0,
    prepaymentPenaltyPct: 1.0,
    referenceDateIso: "2026-11-20T08:00:00.000Z",
  });
  assert.equal(holdCase.breakEvenGoldGrowthVsFloatingPct, 9.5);
  assert.equal(holdCase.verdict, "HOLD_GOLD");
  assert.ok(holdCase.netAdvantageHoldingGold1YrVnd > 0);

  const prepayCase = computeGoldVsMortgageBenchmark(portfolio, metrics, null, {
    expectedGoldGrowthPct: 6.0,
    prepaymentPenaltyPct: 1.0,
    referenceDateIso: "2026-11-20T08:00:00.000Z",
  });
  assert.equal(prepayCase.verdict, "PREPAY_MORTGAGE");
  assert.ok(prepayCase.netAdvantageHoldingGold1YrVnd < 0);
});

test("computeNetWorthAllocationGuardrail classifies UNDERWEIGHT, BALANCED, and OVERWEIGHT accurately", () => {
  const under = computeNetWorthAllocationGuardrail(50_000_000, 1_000_000_000, 15, 9_050_000);
  assert.equal(under.status, "UNDERWEIGHT");
  assert.equal(under.actualSharePct, 5);
  assert.ok(under.deltaVndToTarget > 0);

  const balanced = computeNetWorthAllocationGuardrail(160_000_000, 1_000_000_000, 15, 9_050_000);
  assert.equal(balanced.status, "BALANCED");

  const over = computeNetWorthAllocationGuardrail(260_000_000, 1_000_000_000, 15, 9_050_000);
  assert.equal(over.status, "OVERWEIGHT");
  assert.ok(over.deltaVndToTarget < 0);
});

