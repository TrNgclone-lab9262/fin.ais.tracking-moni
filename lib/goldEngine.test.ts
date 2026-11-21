import test from "node:test";
import assert from "node:assert/strict";
import {
  LY_PER_CHI,
  allocateBatchGoldSale,
  allocateFifoGoldSale,
  allocateSpecificLotSale,
  allocateWacGoldSale,
  buildGoldNavHistorySeries,
  buildGoldVaultCsvContent,
  computeDomesticPremium,
  computeGoldPortfolioMetrics,
  computeGoldStressTestMatrix,
  computeGoldVsMortgageBenchmark,
  computeNetWorthAllocationGuardrail,
  convertGoldUnit,
  createDefaultGoldPortfolio,
  createGoldPriceSnapshot,
  decomposeChiToVietnameseUnits,
  evaluateGoldAlerts,
  gramsToChi,
  phanToChi,
  reconcileGoldPortfolioIntegrity,
  revertGoldSaleAllocation,
  simulateGoldLiquidation,
  troyOzToChi,
  upsertGoldPriceSnapshot,
  verifyGoldPortfolioIntegrity,
} from "./goldEngine";
import { computeMonthsUntilHandover } from "./interiorBoqEngine";
import { GoldLotSchema, parseGoldPortfolioSafely } from "./validations";

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
  assert.equal(
    res.spreadPerChiVnd,
    portfolio.quotes.NHAN_9999.sellPricePerChi - portfolio.quotes.NHAN_9999.buyPricePerChi
  );
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

test("allocateWacGoldSale allocates weighted-average cost basis accurately across category lots", () => {
  const portfolio = createDefaultGoldPortfolio();
  const metrics = computeGoldPortfolioMetrics(portfolio);

  const wacRes = allocateWacGoldSale(portfolio.lots, "NHAN_9999", 2.5);
  assert.equal(wacRes.ok, true);
  assert.ok(Math.abs(wacRes.wacPerChi - metrics.weightedAvgCostPerChi) <= 5);
  const totalAllocatedChi = wacRes.allocations.reduce((s, a) => s + a.soldChi, 0);
  assert.equal(Number(totalAllocatedChi.toFixed(4)), 2.5);
});

test("allocateBatchGoldSale + revertGoldSaleAllocation restores lot remainingChi and status identically", () => {
  const portfolio = createDefaultGoldPortfolio();
  const sim = simulateGoldLiquidation(portfolio, 40_000_000, "FIFO");
  assert.ok(sim.steps.length >= 2);

  const batchRes = allocateBatchGoldSale(
    portfolio.lots,
    sim.steps.map((s) => ({ lotId: s.lotId, sellChi: s.sellChi }))
  );
  assert.equal(batchRes.ok, true);

  const costBasisAllocated = batchRes.allocations.reduce((s, a) => s + a.costBasisAllocated, 0);
  const saleEvent = {
    id: "test_sale_batch",
    saleDate: "2026-11-21",
    category: "NHAN_9999" as const,
    allocationMode: "SPECIFIC_LOT" as const,
    allocations: batchRes.allocations,
    totalSoldChi: sim.totalSellChi,
    unitSellPricePerChi: portfolio.quotes.NHAN_9999.buyPricePerChi,
    totalProceeds: sim.totalProceedsVnd,
    costBasisAllocated,
    realizedPnl: sim.totalProceedsVnd - costBasisAllocated,
    purpose: "INTERIOR_HANDOVER" as const,
    createdAt: "2026-11-21T00:00:00.000Z",
  };

  const integrityAfterSale = verifyGoldPortfolioIntegrity({
    ...portfolio,
    lots: batchRes.updatedLots,
    sales: [saleEvent],
  });
  assert.equal(integrityAfterSale.ok, true);
  assert.equal(integrityAfterSale.errorCount, 0);

  const restoredLots = revertGoldSaleAllocation(batchRes.updatedLots, saleEvent);
  for (const origLot of portfolio.lots) {
    const restored = restoredLots.find((l) => l.id === origLot.id);
    assert.ok(restored);
    assert.equal(restored.remainingChi, origLot.remainingChi);
    assert.equal(restored.status, origLot.status);
  }
});

test("computeGoldStressTestMatrix produces adverse, base, and bullish scenarios", () => {
  const portfolio = createDefaultGoldPortfolio();
  const matrix = computeGoldStressTestMatrix(portfolio);
  assert.ok(matrix.length >= 5);
  const bear = matrix.find((m) => m.xauShockPct < 0);
  const bull = matrix.find((m) => m.xauShockPct > 0);
  const base = matrix.find((m) => m.id === "stress_base");
  assert.ok(bear && bull && base);
  assert.ok(bear.projectedBidValueVnd < base.projectedBidValueVnd);
  assert.ok(bull.projectedBidValueVnd > base.projectedBidValueVnd);
});

test("zero-double-rounding unit conversions, LY decomposition, and NaN/negative guards work accurately", () => {
  assert.equal(LY_PER_CHI, 100);
  assert.equal(gramsToChi(37.5), 10);
  assert.equal(phanToChi(25), 2.5);
  assert.equal(troyOzToChi(1, 4), 8.2943);
  assert.equal(convertGoldUnit(1, "LUONG", "CHI"), 10);
  assert.equal(convertGoldUnit(10, "CHI", "GRAM"), 37.5);
  assert.equal(convertGoldUnit(10, "CHI", "PHAN"), 100);
  assert.equal(convertGoldUnit(1, "CHI", "LY"), 100);

  // Zero double-rounding: 1 Troy Oz -> GRAM must equal exact 31.1035 (at precision 4) / 31.103 (at precision 3)
  assert.equal(convertGoldUnit(1, "TROY_OZ", "GRAM", 4), 31.1035);
  assert.equal(convertGoldUnit(1, "TROY_OZ", "GRAM", 3), 31.103);

  // NaN / Infinity / negative safety
  assert.equal(convertGoldUnit(Number.NaN, "CHI", "GRAM"), 0);
  assert.equal(convertGoldUnit(Number.POSITIVE_INFINITY, "GRAM", "CHI"), 0);
  assert.equal(convertGoldUnit(-5, "CHI", "LUONG"), 0);

  // Vietnamese physical unit decomposition: 12.34 chỉ = 1 lượng, 2 chỉ, 3 phân, 4 ly
  assert.deepEqual(decomposeChiToVietnameseUnits(12.34), {
    luong: 1,
    chi: 2,
    phan: 3,
    ly: 4,
  });
  assert.deepEqual(decomposeChiToVietnameseUnits(-1), {
    luong: 0,
    chi: 0,
    phan: 0,
    ly: 0,
  });
});

test("verifyGoldPortfolioIntegrity detects all 7 invariants and reconcileGoldPortfolioIntegrity repairs lot drift", () => {
  const base = createDefaultGoldPortfolio();
  const cleanAudit = verifyGoldPortfolioIntegrity(base);
  assert.equal(cleanAudit.ok, true);
  assert.equal(cleanAudit.errorCount, 0);
  assert.equal(cleanAudit.warningCount, 0);

  // Inject violations across all 7 invariant categories
  const broken = structuredClone(base);
  // #1 Ledger conservation + #3 Status mismatch on lot 0
  broken.lots[0].remainingChi = 1.25; // bought 2, sold 0, status still HOLDING
  // #5 Duplicate lot ID
  broken.lots.push({ ...structuredClone(broken.lots[1]), remainingChi: broken.lots[1].quantityChi });
  // #6 Inverted Bid > Ask quote
  broken.quotes.SJC_BAR.buyPricePerChi = 9_900_000;
  broken.quotes.SJC_BAR.sellPricePerChi = 9_500_000;
  // #4 Broken sale event (P&L mismatch + orphan allocation)
  broken.sales.push({
    id: "sale_broken_1",
    saleDate: "2026-11-20",
    category: "NHAN_9999",
    allocationMode: "FIFO",
    allocations: [{ lotId: "lot_missing_999", soldChi: 1, costBasisAllocated: 8_000_000 }],
    totalSoldChi: 1.5, // mismatches alloc sum 1
    unitSellPricePerChi: 9_000_000,
    totalProceeds: 13_500_000,
    costBasisAllocated: 8_000_000,
    realizedPnl: 1_000_000, // wrong P&L (expected 5,500,000)
    purpose: "OTHER",
    createdAt: "2026-11-20T00:00:00.000Z",
  });
  // #7 Negative makingFee
  broken.lots[1].makingFee = -50_000;

  const audit = verifyGoldPortfolioIntegrity(broken);
  assert.equal(audit.ok, false);
  assert.ok(audit.errorCount >= 5);
  const codes = new Set(audit.issues.map((i) => i.code));
  assert.ok(codes.has("LEDGER_CONSERVATION_MISMATCH"));
  assert.ok(codes.has("STATUS_MISMATCH_PARTIAL"));
  assert.ok(codes.has("DUPLICATE_LOT_ID"));
  assert.ok(codes.has("INVERTED_BID_ASK_SPREAD"));
  assert.ok(codes.has("SALE_ALLOCATION_SUM_MISMATCH"));
  assert.ok(codes.has("SALE_PNL_EQUATION_MISMATCH"));
  assert.ok(codes.has("ORPHAN_SALE_ALLOCATION"));
  assert.ok(codes.has("NEGATIVE_MAKING_FEE"));

  // Reconcile pure lot drift cleanly on an otherwise valid portfolio
  const drifted = structuredClone(base);
  drifted.lots[0].remainingChi = 1.0; // should be 2.0 (0 sold)
  drifted.lots[0].status = "SOLD";
  const rec = reconcileGoldPortfolioIntegrity(drifted);
  assert.deepEqual(rec.fixedLotIds, [drifted.lots[0].id]);
  assert.equal(rec.reconciledPortfolio.lots[0].remainingChi, drifted.lots[0].quantityChi);
  assert.equal(rec.reconciledPortfolio.lots[0].status, "HOLDING");
  assert.equal(rec.remainingIssues.length, 0);
});

test("buildGoldVaultCsvContent defends against CWE-1236 CSV formula injection and supports maskSensitive & includeSoldLots", () => {
  const portfolio = createDefaultGoldPortfolio();
  portfolio.lots[0].serialNumber = "=CMD|' /C calc'!A0";
  portfolio.lots[0].storeName = "+SUM(A1:A5)";
  portfolio.lots[0].invoiceNote = "-1+1";
  portfolio.lots[0].certificateCode = "@SUM(1+1)";
  portfolio.lots.push({
    ...structuredClone(portfolio.lots[0]),
    id: "gold_lot_sold_archive",
    brand: "SJC Archive Sold",
    remainingChi: 0,
    status: "SOLD",
    serialNumber: "SN-SOLD-01",
    storeName: "SJC Q3",
    invoiceNote: "Đã bán hết",
  });

  const csvDefault = buildGoldVaultCsvContent(portfolio, undefined, {
    generatedAtIso: "2026-11-21T00:00:00.000Z",
  });
  assert.ok(csvDefault.startsWith("\uFEFF"));
  assert.ok(csvDefault.includes("XAU/USD:"));
  assert.ok(csvDefault.includes("Còn nắm giữ (lượng)"));
  assert.ok(csvDefault.includes("Còn nắm giữ (gram)"));
  // CWE-1236 neutralization: dangerous prefixes must be quoted with leading apostrophe
  assert.ok(csvDefault.includes(`"'=CMD|' /C calc'!A0"`));
  assert.ok(csvDefault.includes(`"'+SUM(A1:A5)"`));
  assert.ok(csvDefault.includes(`"'-1+1"`));
  assert.ok(csvDefault.includes(`"'@SUM(1+1)"`));
  assert.equal(csvDefault.includes("SJC Archive Sold"), false);

  const csvWithSoldAndMasked = buildGoldVaultCsvContent(portfolio, undefined, {
    includeSoldLots: true,
    maskSensitive: true,
    generatedAtIso: "2026-11-21T00:00:00.000Z",
  });
  assert.ok(csvWithSoldAndMasked.includes("SJC Archive Sold"));
  assert.equal(csvWithSoldAndMasked.includes("SN-SOLD-01"), false);
  assert.ok(csvWithSoldAndMasked.includes("•••"));
});

test("GoldLotSchema normalizes null/blank strings and parseGoldPortfolioSafely recovers valid lots when 1 lot is corrupted", () => {
  const base = createDefaultGoldPortfolio();

  // Null / whitespace-only optional fields normalize cleanly to undefined
  const normalizedLot = GoldLotSchema.parse({
    ...base.lots[0],
    serialNumber: "   ",
    certificateCode: null,
    storeName: "  PNJ Thủ Đức  ",
    purityLabel: "",
  });
  assert.equal(normalizedLot.serialNumber, undefined);
  assert.equal(normalizedLot.certificateCode, undefined);
  assert.equal(normalizedLot.storeName, "PNJ Thủ Đức");
  assert.equal(normalizedLot.purityLabel, undefined);

  // Cross-field refinement blocks remainingChi > quantityChi
  const invalidRemaining = GoldLotSchema.safeParse({
    ...base.lots[0],
    quantityChi: 2,
    remainingChi: 3,
  });
  assert.equal(invalidRemaining.success, false);

  // Graceful Partial Recovery: 1 corrupted lot does NOT wipe out remaining valid lots
  const corruptedRaw = {
    ...structuredClone(base),
    lots: [
      base.lots[0],
      {
        ...base.lots[1],
        id: "lot_corrupt_999",
        quantityChi: -5, // invalid
      },
      base.lots[2],
    ],
  };

  const recovered = parseGoldPortfolioSafely(corruptedRaw, createDefaultGoldPortfolio);
  assert.equal(recovered.recovered, true);
  assert.equal(recovered.data.lots.length, 2);
  assert.ok(recovered.droppedItems.includes("lots[lot_corrupt_999]"));
  assert.equal(recovered.data.lots[0].id, base.lots[0].id);
  assert.equal(recovered.data.lots[1].id, base.lots[2].id);
});

test("computeMonthsUntilHandover computes dynamic months relative to 2027-08-31", () => {
  assert.equal(computeMonthsUntilHandover("2027-08-31", "2026-11-30"), 9);
  assert.equal(computeMonthsUntilHandover("2027-08-31", "2027-02-28"), 6);
  assert.equal(computeMonthsUntilHandover("2027-08-31", "2027-08-31"), 1);
});


