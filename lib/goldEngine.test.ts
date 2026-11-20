import test from "node:test";
import assert from "node:assert/strict";
import {
  allocateFifoGoldSale,
  allocateSpecificLotSale,
  computeDomesticPremium,
  computeGoldPortfolioMetrics,
  createDefaultGoldPortfolio,
  simulateGoldLiquidation,
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
