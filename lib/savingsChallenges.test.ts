import test from "node:test";
import assert from "node:assert/strict";
import { evaluateSavingsChallenges } from "./savingsChallenges";
import { DEFAULT_SAVINGS_CHALLENGES, DEFAULT_TRANSACTIONS } from "@/constants/mockData";
import { SavingsChallenge } from "@/types/finance";

test("evaluateSavingsChallenges computes MANUAL and AUTO_SURPLUS challenges accurately", () => {
  const result = evaluateSavingsChallenges({
    challenges: DEFAULT_SAVINGS_CHALLENGES,
    monthKey: "2026-10",
    transactions: DEFAULT_TRANSACTIONS,
    perspective: "ALL",
  });

  // Oct 2026 income = 50,000,000; expense = 17,080,000 -> surplus = 32,920,000
  assert.equal(result.monthSurplusAll, 32_920_000);
  assert.equal(result.items.length, 3);
  assert.equal(result.ringItems.length, 3);
  assert.equal(result.overflowCount, 0);

  // First challenge: MANUAL 900k / 1.2M = 75%
  assert.equal(result.items[0].savedAmount, 900_000);
  assert.equal(result.items[0].progressPct, 75);
  assert.equal(result.items[0].isCompleted, false);

  // Second challenge: MANUAL 1.5M / 1.5M = 100%
  assert.equal(result.items[1].progressPct, 100);
  assert.equal(result.items[1].isCompleted, true);

  // Third challenge: AUTO_SURPLUS (32.92M / 25M -> clamped 100%, completed)
  assert.equal(result.items[2].autoSurplusAmount, 32_920_000);
  assert.equal(result.items[2].progressPct, 100);
  assert.equal(result.items[2].isCompleted, true);
  assert.equal(result.completedCount, 2);
});

test("evaluateSavingsChallenges caps concentric ringItems at 5 and reports overflowCount", () => {
  const manyChallenges: SavingsChallenge[] = Array.from({ length: 7 }, (_, i) => ({
    id: `chg_${i + 1}`,
    name: `Thử thách ${i + 1}`,
    month: "2026-10",
    targetAmount: 1_000_000,
    manualSavedAmount: (i + 1) * 100_000,
    trackingMode: "MANUAL",
    color: "#2563EB",
    memberId: "SHARED",
    createdAt: `2026-10-0${i + 1}T08:00:00Z`,
  }));

  const result = evaluateSavingsChallenges({
    challenges: manyChallenges,
    monthKey: "2026-10",
    transactions: DEFAULT_TRANSACTIONS,
    perspective: "ALL",
  });

  assert.equal(result.items.length, 7);
  assert.equal(result.ringItems.length, 5);
  assert.equal(result.overflowCount, 2);
});
