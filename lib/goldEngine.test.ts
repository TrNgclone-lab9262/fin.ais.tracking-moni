import test from "node:test";
import assert from "node:assert/strict";
import {
  GoldWeightUnit,
  LY_PER_CHI,
  MICRO_CHI_SCALE,
  allocateBatchGoldSale,
  allocateFifoGoldSale,
  allocateSpecificLotSale,
  allocateWacGoldSale,
  buildGoldNavHistorySeries,
  buildGoldVaultCsvContent,
  calculateLedgerIntegrity,
  chiToLy,
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
  fromMicroChi,
  gramsToChi,
  lyToChi,
  phanToChi,
  reconcileGoldPortfolioIntegrity,
  revertGoldSaleAllocation,
  roundGoldDecimal,
  simulateGoldLiquidation,
  subtractChiExact,
  sumChiExact,
  toMicroChi,
  troyOzToChi,
  upsertGoldPriceSnapshot,
  verifyGoldPortfolioIntegrity,
} from "./goldEngine";
import { computeMonthsUntilHandover } from "./interiorBoqEngine";
import {
  GoldLotSchema,
  GoldPriceQuoteSchema,
  GoldPriceSnapshotSchema,
  optionalTrimmedString,
  parseGoldPortfolioSafely,
} from "./validations";

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

test("6x6 gold unit round-trip matrix (LUONG, CHI, PHAN, LY, GRAM, TROY_OZ) preserves precision across edge weights", () => {
  const units: GoldWeightUnit[] = ["LUONG", "CHI", "PHAN", "LY", "GRAM", "TROY_OZ"];
  const metricUnits = new Set<GoldWeightUnit>(["LUONG", "CHI", "PHAN", "LY", "GRAM"]);
  const edgeWeightsChi = [0.01, 1.25, 8.2943, 1000];

  for (const weightChi of edgeWeightsChi) {
    for (const from of units) {
      const startVal = convertGoldUnit(weightChi, "CHI", from, 8);
      for (const to of units) {
        const intermediate = convertGoldUnit(startVal, from, to, 8);
        const back = convertGoldUnit(intermediate, to, from, 8);
        const relTolerance = metricUnits.has(from) && metricUnits.has(to) ? 1e-6 : 1e-5;
        const absDiff = Math.abs(back - startVal);
        const maxAllowed = Math.max(1e-6, Math.abs(startVal) * relTolerance);
        assert.ok(
          absDiff <= maxAllowed,
          `Round-trip failed for ${weightChi} chỉ (${from} -> ${to} -> ${from}): start=${startVal}, back=${back}, diff=${absDiff}`
        );
      }
    }
  }
});

test("multi-event Ledger Conservation lifecycle (FIFO + WAC + Specific-Lot + Undo) maintains 0 errors and 0 warnings", () => {
  let portfolio = createDefaultGoldPortfolio();
  const baseBid = portfolio.quotes.NHAN_9999.buyPricePerChi;

  // 1) FIFO sale of 1.5 chỉ
  const fifoRes = allocateFifoGoldSale(portfolio.lots, "NHAN_9999", 1.5);
  assert.equal(fifoRes.ok, true);
  const fifoCost = fifoRes.allocations.reduce((s, a) => s + a.costBasisAllocated, 0);
  const fifoProceeds = Math.round(1.5 * baseBid);
  const saleFifo = {
    id: "sale_lc_fifo",
    saleDate: "2026-11-15",
    category: "NHAN_9999" as const,
    allocationMode: "FIFO" as const,
    allocations: fifoRes.allocations,
    totalSoldChi: 1.5,
    unitSellPricePerChi: baseBid,
    totalProceeds: fifoProceeds,
    costBasisAllocated: fifoCost,
    realizedPnl: fifoProceeds - fifoCost,
    purpose: "REBALANCE" as const,
    createdAt: "2026-11-15T10:00:00.000Z",
  };
  portfolio = { ...portfolio, lots: fifoRes.updatedLots, sales: [...portfolio.sales, saleFifo] };

  // 2) WAC sale of 1.0 chỉ
  const wacRes = allocateWacGoldSale(portfolio.lots, "NHAN_9999", 1.0);
  assert.equal(wacRes.ok, true);
  const wacCost = wacRes.allocations.reduce((s, a) => s + a.costBasisAllocated, 0);
  const wacProceeds = Math.round(1.0 * baseBid);
  const saleWac = {
    id: "sale_lc_wac",
    saleDate: "2026-11-18",
    category: "NHAN_9999" as const,
    allocationMode: "WAC" as const,
    allocations: wacRes.allocations,
    totalSoldChi: 1.0,
    unitSellPricePerChi: baseBid,
    totalProceeds: wacProceeds,
    costBasisAllocated: wacCost,
    realizedPnl: wacProceeds - wacCost,
    purpose: "INTERIOR_HANDOVER" as const,
    createdAt: "2026-11-18T10:00:00.000Z",
  };
  portfolio = { ...portfolio, lots: wacRes.updatedLots, sales: [...portfolio.sales, saleWac] };

  // 3) Specific-Lot sale of 0.5 chỉ on any lot that still has >= 0.5 chỉ
  const targetLot = portfolio.lots.find((l) => l.remainingChi >= 0.5);
  assert.ok(targetLot);
  const specRes = allocateSpecificLotSale(portfolio.lots, targetLot.id, 0.5);
  assert.equal(specRes.ok, true);
  const specCost = specRes.allocations.reduce((s, a) => s + a.costBasisAllocated, 0);
  const specProceeds = Math.round(0.5 * baseBid);
  const saleSpec = {
    id: "sale_lc_spec",
    saleDate: "2026-11-20",
    category: targetLot.category,
    allocationMode: "SPECIFIC_LOT" as const,
    allocations: specRes.allocations,
    totalSoldChi: 0.5,
    unitSellPricePerChi: baseBid,
    totalProceeds: specProceeds,
    costBasisAllocated: specCost,
    realizedPnl: specProceeds - specCost,
    purpose: "SKYONE_PREPAY" as const,
    createdAt: "2026-11-20T10:00:00.000Z",
  };
  portfolio = { ...portfolio, lots: specRes.updatedLots, sales: [...portfolio.sales, saleSpec] };

  const auditMid = verifyGoldPortfolioIntegrity(portfolio);
  assert.equal(auditMid.ok, true, auditMid.summary);
  assert.equal(auditMid.errorCount, 0);
  assert.equal(auditMid.warningCount, 0);

  // 4) Undo the WAC sale and re-verify Ledger Conservation
  const restoredLots = revertGoldSaleAllocation(portfolio.lots, saleWac);
  const afterUndo = {
    ...portfolio,
    lots: restoredLots,
    sales: portfolio.sales.filter((s) => s.id !== saleWac.id),
  };
  const auditAfterUndo = verifyGoldPortfolioIntegrity(afterUndo);
  assert.equal(auditAfterUndo.ok, true, auditAfterUndo.summary);
  assert.equal(auditAfterUndo.errorCount, 0);
  assert.equal(auditAfterUndo.warningCount, 0);
});

test("GoldPriceQuoteSchema strictly rejects Bid > Ask while parseGoldPortfolioSafely & reconcile gently repair legacy quotes", () => {
  const base = createDefaultGoldPortfolio();
  const invertedQuote = {
    ...base.quotes.SJC_BAR,
    buyPricePerChi: 9_850_000,
    sellPricePerChi: 9_600_000, // Bid > Ask
  };

  // Strict schema blocks new/manual inverted input
  const strictRes = GoldPriceQuoteSchema.safeParse(invertedQuote);
  assert.equal(strictRes.success, false);

  // Safe legacy parser gently repairs Ask = Bid instead of wiping to defaults
  const legacyRaw = {
    ...structuredClone(base),
    quotes: {
      ...structuredClone(base.quotes),
      SJC_BAR: invertedQuote,
    },
  };
  const parsed = parseGoldPortfolioSafely(legacyRaw, createDefaultGoldPortfolio);
  assert.equal(parsed.recovered, true);
  assert.equal(parsed.data.quotes.SJC_BAR.buyPricePerChi, 9_850_000);
  assert.equal(parsed.data.quotes.SJC_BAR.sellPricePerChi, 9_850_000);
  assert.ok(parsed.repairedItems.includes("quotes.SJC_BAR:repaired_inverted_spread"));
  assert.equal(parsed.droppedItems.length, 0);

  // Reconcile also repairs inverted spread cleanly
  const reconciled = reconcileGoldPortfolioIntegrity(legacyRaw);
  assert.deepEqual(reconciled.repairedQuoteCategories, ["SJC_BAR"]);
  assert.equal(reconciled.reconciledPortfolio.quotes.SJC_BAR.sellPricePerChi, 9_850_000);
  assert.equal(reconciled.remainingIssues.length, 0);
});

test("scaled-integer micro-chi arithmetic, roundGoldDecimal IEEE-754 edge cases, and lyToChi/chiToLy work with zero float drift", () => {
  assert.equal(MICRO_CHI_SCALE, 10_000);
  // Classic IEEE-754 binary float rounding traps
  assert.equal(roundGoldDecimal(1.005, 2), 1.01);
  assert.equal(roundGoldDecimal(35.855, 2), 35.86);
  assert.equal(roundGoldDecimal(0.1 + 0.2, 4), 0.3);
  assert.equal(roundGoldDecimal(-1.005, 2), -1.01);
  assert.equal(roundGoldDecimal(1e-7, 4), 0);

  // Scaled integer micro-chi exact summation & subtraction
  assert.equal(toMicroChi(1.2345), 12345);
  assert.equal(fromMicroChi(12345), 1.2345);
  assert.equal(sumChiExact([0.1, 0.2, 0.3, 0.15, 0.25]), 1);
  assert.equal(subtractChiExact(1.0, 0.3), 0.7);
  assert.equal(subtractChiExact(0.3, 0.1), 0.2);

  // Direct Ly conversion helpers
  assert.equal(chiToLy(1.25), 125);
  assert.equal(lyToChi(125), 1.25);
  assert.equal(lyToChi(1), 0.01);
  assert.equal(chiToLy(0.01), 1);
});

test("calculateLedgerIntegrity reconciles book ledger and physical vault stocktake (MATCHED, BOOK_DRIFT, SURPLUS, SHORTAGE)", () => {
  const base = createDefaultGoldPortfolio();
  const totalBookChi = sumChiExact(base.lots.map((l) => l.remainingChi));

  // 1) Clean book without physical counts
  const bookOnly = calculateLedgerIntegrity(base);
  assert.equal(bookOnly.isBookBalanced, true);
  assert.equal(bookOnly.bookDriftChi, 0);
  assert.equal(bookOnly.expectedBookRemainingChi, totalBookChi);
  assert.equal(bookOnly.recordedLotsRemainingChi, totalBookChi);
  assert.equal(bookOnly.hasPhysicalAudit, false);
  assert.equal(bookOnly.totalPhysicalCountChi, null);

  // 2) Physical stocktake MATCHED 100%
  const matched = calculateLedgerIntegrity(base, { NHAN_9999: totalBookChi });
  assert.equal(matched.hasPhysicalAudit, true);
  assert.equal(matched.isPhysicallyBalanced, true);
  assert.equal(matched.totalPhysicalVarianceChi, 0);
  assert.equal(matched.totalPhysicalVarianceVnd, 0);
  assert.equal(matched.byCategory[0]?.status, "MATCHED");

  // 3) Physical stocktake SURPLUS (+0.5 chỉ)
  const surplus = calculateLedgerIntegrity(base, { NHAN_9999: totalBookChi + 0.5 });
  assert.equal(surplus.isPhysicallyBalanced, false);
  assert.equal(surplus.totalPhysicalVarianceChi, 0.5);
  assert.equal(
    surplus.totalPhysicalVarianceVnd,
    Math.round(0.5 * base.quotes.NHAN_9999.buyPricePerChi)
  );
  assert.equal(surplus.byCategory[0]?.status, "PHYSICAL_SURPLUS");

  // 4) Physical stocktake SHORTAGE (-0.25 chỉ)
  const shortage = calculateLedgerIntegrity(base, { NHAN_9999: totalBookChi - 0.25 });
  assert.equal(shortage.isPhysicallyBalanced, false);
  assert.equal(shortage.totalPhysicalVarianceChi, -0.25);
  assert.equal(
    shortage.totalPhysicalVarianceVnd,
    Math.round(-0.25 * base.quotes.NHAN_9999.buyPricePerChi)
  );
  assert.equal(shortage.byCategory[0]?.status, "PHYSICAL_SHORTAGE");

  // 5) Book ledger drift detected accurately
  const drifted = structuredClone(base);
  drifted.lots[0].remainingChi = drifted.lots[0].quantityChi - 0.4;
  const driftReport = calculateLedgerIntegrity(drifted);
  assert.equal(driftReport.isBookBalanced, false);
  assert.equal(driftReport.bookDriftChi, -0.4);
  assert.equal(driftReport.byCategory[0]?.status, "BOOK_DRIFT");
});

test("optionalTrimmedString, GoldPriceSnapshotSchema Bid<=Ask guard, and 3-layer parseGoldPortfolioSafely auto-repair work end-to-end", () => {
  // Exported optionalTrimmedString helper
  const noteSchema = optionalTrimmedString(20);
  assert.equal(noteSchema.parse("  Ghi chú vàng  "), "Ghi chú vàng");
  assert.equal(noteSchema.parse("   "), undefined);
  assert.equal(noteSchema.parse(null), undefined);

  // Strict GoldPriceSnapshotSchema rejects inverted Bid > Ask
  const badSnap = {
    date: "2026-11-18",
    recordedAt: "2026-11-18T09:00:00.000Z",
    nhan9999BidPerChi: 9_600_000,
    nhan9999AskPerChi: 9_400_000, // inverted!
    sjcBidPerChi: 9_800_000,
    sjcAskPerChi: 9_500_000, // inverted!
    worldXauUsdPerOz: 2890,
    usdVndRate: 25450,
    portfolioBidValueVnd: 60_000_000,
    portfolioCostBasisVnd: 55_000_000,
    totalRemainingChi: 7,
  };
  assert.equal(GoldPriceSnapshotSchema.safeParse(badSnap).success, false);

  // Strict GoldLotSchema rejects status inconsistent with remainingChi
  const base = createDefaultGoldPortfolio();
  assert.equal(
    GoldLotSchema.safeParse({
      ...base.lots[0],
      quantityChi: 2,
      remainingChi: 1.5,
      status: "SOLD",
    }).success,
    false
  );

  // 3-layer gentle auto-repair in parseGoldPortfolioSafely:
  // Layer 1: Quote Bid > Ask
  // Layer 2: Snapshot Bid > Ask + duplicate date
  // Layer 3: Legacy lot status mismatch & ledger balance reconciled from sales
  const saleForLot0 = {
    id: "sale_legacy_1",
    saleDate: "2026-11-19",
    category: "NHAN_9999" as const,
    allocationMode: "SPECIFIC_LOT" as const,
    allocations: [
      {
        lotId: base.lots[0].id,
        soldChi: 0.5,
        costBasisAllocated: Math.round(0.5 * base.lots[0].unitBuyPricePerChi),
      },
    ],
    totalSoldChi: 0.5,
    unitSellPricePerChi: 9_050_000,
    totalProceeds: 4_525_000,
    costBasisAllocated: Math.round(0.5 * base.lots[0].unitBuyPricePerChi),
    realizedPnl: 4_525_000 - Math.round(0.5 * base.lots[0].unitBuyPricePerChi),
    purpose: "REBALANCE" as const,
    createdAt: "2026-11-19T10:00:00.000Z",
  };

  const legacyRaw = {
    ...structuredClone(base),
    lots: [
      {
        ...base.lots[0],
        remainingChi: 2, // drifted: should be 1.5 after saleForLot0
        status: "SOLD", // wrong status
      },
      base.lots[1],
      base.lots[2],
    ],
    sales: [saleForLot0],
    quotes: {
      ...structuredClone(base.quotes),
      NHAN_9999: {
        ...base.quotes.NHAN_9999,
        buyPricePerChi: 9_400_000,
        sellPricePerChi: 9_200_000, // inverted
      },
    },
    priceHistory: [
      badSnap,
      {
        ...badSnap,
        recordedAt: "2026-11-18T17:00:00.000Z",
        nhan9999BidPerChi: 9_500_000,
        nhan9999AskPerChi: 9_650_000,
        sjcBidPerChi: 9_600_000,
        sjcAskPerChi: 9_800_000,
      },
    ],
  };

  const repaired = parseGoldPortfolioSafely(legacyRaw, createDefaultGoldPortfolio);
  assert.equal(repaired.recovered, true);
  assert.equal(repaired.droppedItems.length, 0);
  // Layer 1 repaired
  assert.equal(repaired.data.quotes.NHAN_9999.sellPricePerChi, 9_400_000);
  assert.ok(repaired.repairedItems.includes("quotes.NHAN_9999:repaired_inverted_spread"));
  // Layer 2 repaired & deduplicated (keeps newer 17:00 snapshot)
  assert.equal(repaired.data.priceHistory?.length, 1);
  assert.equal(repaired.data.priceHistory?.[0]?.recordedAt, "2026-11-18T17:00:00.000Z");
  assert.ok(repaired.repairedItems.includes("priceHistory[2026-11-18]:repaired_inverted_spread"));
  assert.ok(repaired.repairedItems.includes("priceHistory[2026-11-18]:deduplicated"));
  // Layer 3 repaired from sales allocation
  assert.equal(repaired.data.lots[0]?.remainingChi, 1.5);
  assert.equal(repaired.data.lots[0]?.status, "PARTIAL_SOLD");
  assert.ok(repaired.repairedItems.includes(`lots[${base.lots[0].id}]:repaired_status_or_balance`));

  // Final repaired portfolio must pass calculateLedgerIntegrity with 0 errors and 0 drift
  const integrity = calculateLedgerIntegrity(repaired.data);
  assert.equal(integrity.isBookBalanced, true, integrity.summary);
  assert.equal(integrity.bookDriftChi, 0);
});




