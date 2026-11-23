import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_IMAGE_BASE64_CHARS,
  ScanReceiptRequestSchema,
  ScanLoanStatementRequestSchema,
  SkyOneStrategyRequestSchema,
  ScanBoqQuoteRequestSchema,
  GoldReferenceQuerySchema,
  SlidingWindowRateLimiter,
  buildApiError,
  formatZodApiError,
} from "./apiSchemas";

test("ScanReceiptRequestSchema accepts valid receipt payload and rejects oversized base64", () => {
  const valid = ScanReceiptRequestSchema.safeParse({
    imageBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ",
    mimeType: "image/png",
    categories: [{ id: "cat_food", name: "Ăn uống", type: "EXPENSE" }],
  });
  assert.equal(valid.success, true);

  const oversized = ScanReceiptRequestSchema.safeParse({
    imageBase64: "A".repeat(MAX_IMAGE_BASE64_CHARS + 10),
    mimeType: "image/jpeg",
  });
  assert.equal(oversized.success, false);
  if (!oversized.success) {
    const formatted = formatZodApiError(oversized.error);
    assert.equal(formatted.ok, false);
    assert.equal(formatted.code, "VALIDATION_ERROR");
    assert.ok(formatted.details && formatted.details.length > 0);
  }
});

test("ScanLoanStatementRequestSchema and ScanBoqQuoteRequestSchema enforce MIME allowlist", () => {
  const okPdf = ScanLoanStatementRequestSchema.safeParse({
    imageBase64: "JVBERi0xLjQKJcOkw7zDtsOfCjIgMCBvYmo=",
    mimeType: "application/pdf",
  });
  assert.equal(okPdf.success, true);

  const badMime = ScanBoqQuoteRequestSchema.safeParse({
    imageBase64: "AAAA1234567890",
    mimeType: "application/x-msdownload",
  });
  assert.equal(badMime.success, false);
});

test("SkyOneStrategyRequestSchema validates numeric bounds and optional fields", () => {
  const valid = SkyOneStrategyRequestSchema.safeParse({
    projectName: "Phú Đông SKYONE A.12A.07",
    remainingBalanceVnd: 1_540_000_000,
    currentInterestRatePct: 5.5,
    projectedFloatingRatePct: 9.8,
    remainingMonths: 230,
    monthlyPaymentVnd: 13_500_000,
    prepaymentPenaltyPct: 1,
    dtiPct: 27,
    equityPct: 35,
    liquidCashVnd: 220_000_000,
    monthlyNetSurplusVnd: 18_000_000,
    goldBidValueVnd: 185_000_000,
    goldUnrealizedPnlVnd: 22_000_000,
    goldTotalChi: 20,
    interiorBudgetRemainingVnd: 120_000_000,
    targetExtraPrepayVnd: 50_000_000,
  });
  assert.equal(valid.success, true);

  const invalidRate = SkyOneStrategyRequestSchema.safeParse({
    projectName: "Phú Đông SKYONE A.12A.07",
    remainingBalanceVnd: 1_540_000_000,
    currentInterestRatePct: 45, // unrealistic > 30%
    projectedFloatingRatePct: 10,
    remainingMonths: 230,
    monthlyPaymentVnd: 13_500_000,
    prepaymentPenaltyPct: 1,
    dtiPct: 27,
    equityPct: 35,
    liquidCashVnd: 100_000_000,
    monthlyNetSurplusVnd: 10_000_000,
    goldBidValueVnd: 0,
    goldUnrealizedPnlVnd: 0,
    goldTotalChi: 0,
    interiorBudgetRemainingVnd: 0,
  });
  assert.equal(invalidRate.success, false);
});

test("GoldReferenceQuerySchema coerces calibration numbers and rejects out-of-range premiums", () => {
  const parsed = GoldReferenceQuerySchema.safeParse({
    force: "1",
    nhanPremiumPct: "6.5",
    sjcPremiumPct: "9.0",
    nhanSpreadVnd: "180000",
    sjcSpreadVnd: "250000",
  });
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.nhanPremiumPct, 6.5);
    assert.equal(parsed.data.sjcPremiumPct, 9);
  }

  const bad = GoldReferenceQuerySchema.safeParse({
    nhanPremiumPct: "99",
  });
  assert.equal(bad.success, false);
});

test("SlidingWindowRateLimiter enforces per-key window limits and resets after window", () => {
  const limiter = new SlidingWindowRateLimiter({ maxRequests: 2, windowMs: 10_000 });

  const r1 = limiter.check("ip-1", 1000);
  const r2 = limiter.check("ip-1", 2000);
  const r3 = limiter.check("ip-1", 3000);
  const otherIp = limiter.check("ip-2", 3000);

  assert.equal(r1.allowed, true);
  assert.equal(r1.remaining, 1);
  assert.equal(r2.allowed, true);
  assert.equal(r2.remaining, 0);
  assert.equal(r3.allowed, false);
  assert.ok(r3.retryAfterSeconds >= 1);
  assert.equal(otherIp.allowed, true);

  // After window expires (t = 12_500 > 1000 + 10_000)
  const r4 = limiter.check("ip-1", 12_500);
  assert.equal(r4.allowed, true);
});

test("buildApiError produces unified contract with backward-compatible error alias", () => {
  const payload = buildApiError("GEMINI_TIMEOUT", "Quá thời gian phản hồi", {
    fallbackAvailable: true,
  });
  assert.equal(payload.ok, false);
  assert.equal(payload.code, "GEMINI_TIMEOUT");
  assert.equal(payload.message, "Quá thời gian phản hồi");
  assert.equal(payload.error, "Quá thời gian phản hồi");
  assert.equal(payload.fallbackAvailable, true);
});
