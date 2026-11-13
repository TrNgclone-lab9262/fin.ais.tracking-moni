import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateDaysRemainingInMonth,
  calculateTodaySpent,
  calculateCreditCardCycleInfo,
  calculateBalanceAndCumulativeTrends,
  calculateHeatmapDays,
  calculateCoupleSettlement,
  calculateLedgerIntegrity,
  resolveCategorySlugToId,
} from "./financeEngine";
import { DEFAULT_CATEGORIES } from "@/constants/defaultCategories";
import { DEFAULT_ACCOUNTS, DEFAULT_TRANSACTIONS } from "@/constants/mockData";
import { recalculateAccountBalances } from "./storage";
import { Account, Transaction } from "@/types/finance";

test("calculateDaysRemainingInMonth computes dynamic days for active & historical months", () => {
  // Active month: 2026-11 has 30 days. On Nov 12 -> 30 - 12 + 1 = 19
  const now = new Date(2026, 10, 12);
  assert.equal(calculateDaysRemainingInMonth("2026-11", DEFAULT_TRANSACTIONS, now), 19);

  // Historical month 2026-10: 31 days, latest tx on Oct 20 -> 31 - 20 + 1 = 12
  assert.equal(calculateDaysRemainingInMonth("2026-10", DEFAULT_TRANSACTIONS, now), 12);

  // Future month 2026-12: 31 days
  assert.equal(calculateDaysRemainingInMonth("2026-12", DEFAULT_TRANSACTIONS, now), 31);
});

test("calculateTodaySpent respects perspective and falls back to latest expense day for historical month", () => {
  const now = new Date(2026, 10, 12);
  // In DEFAULT_TRANSACTIONS (2026-10), latest expense date is 2026-10-20 (250,000 by HUSBAND)
  const allRes = calculateTodaySpent(DEFAULT_TRANSACTIONS, "ALL", "2026-10", now);
  assert.equal(allRes.referenceDate, "2026-10-20");
  assert.equal(allRes.amount, 250000);

  // For WIFE perspective, latest expense in 2026-10 is 2026-10-18 (1,350,000)
  const wifeRes = calculateTodaySpent(DEFAULT_TRANSACTIONS, "WIFE", "2026-10", now);
  assert.equal(wifeRes.referenceDate, "2026-10-18");
  assert.equal(wifeRes.amount, 1350000);
});

test("calculateCreditCardCycleInfo enforces 30% guardrail and configurable due day", () => {
  const baseCard: Account = {
    id: "card_test",
    name: "BIDV Credit",
    type: "CREDIT_CARD",
    owner: "HUSBAND",
    creditLimit: 50_000_000,
    statementDay: 20,
    dueDay: 6,
    initialBalance: 0,
    currentBalance: 12_500_000, // 25% -> SAFE
  };

  const safeInfo = calculateCreditCardCycleInfo(baseCard, "2026-10");
  assert.equal(safeInfo.usagePercentage, 25);
  assert.equal(safeInfo.statusLevel, "SAFE");
  assert.equal(safeInfo.dueDateDisplay, "06/11");
  assert.equal(safeInfo.safeCapAmount, 15_000_000);

  const watchInfo = calculateCreditCardCycleInfo({ ...baseCard, currentBalance: 20_000_000 }, "2026-10");
  assert.equal(watchInfo.statusLevel, "WATCH");

  const warnInfo = calculateCreditCardCycleInfo({ ...baseCard, currentBalance: 36_000_000 }, "2026-10");
  assert.equal(warnInfo.statusLevel, "WARNING");

  const dangerInfo = calculateCreditCardCycleInfo({ ...baseCard, currentBalance: 46_000_000 }, "2026-10");
  assert.equal(dangerInfo.statusLevel, "DANGER");
});

test("calculateBalanceAndCumulativeTrends dynamically reflects transactions", () => {
  const accounts = recalculateAccountBalances(DEFAULT_ACCOUNTS, DEFAULT_TRANSACTIONS);
  const res = calculateBalanceAndCumulativeTrends(accounts, DEFAULT_TRANSACTIONS, "2026-10", "ALL");

  assert.equal(res.balanceTrend.length, 6);
  const octPoint = res.balanceTrend[5];
  assert.equal(octPoint.monthKey, "2026-10");

  // Sum of non-credit accounts should equal octPoint.balance
  const actualLiquid = accounts
    .filter((a) => a.type !== "CREDIT_CARD")
    .reduce((s, a) => s + a.currentBalance, 0);
  assert.equal(octPoint.balance, actualLiquid);

  // Final cumulative income & expense in Oct match transaction sums
  const lastInc = res.incomeCumulative[res.incomeCumulative.length - 1].amount;
  const lastExp = res.expenseCumulative[res.expenseCumulative.length - 1].amount;
  assert.equal(lastInc, 50_000_000);
  assert.equal(lastExp, 17_080_000);
});

test("calculateHeatmapDays computes exact month day count and peak day", () => {
  const feb = calculateHeatmapDays([], "2026-02", "ALL");
  assert.equal(feb.days.length, 28);

  const oct = calculateHeatmapDays(DEFAULT_TRANSACTIONS, "2026-10", "ALL");
  assert.equal(oct.days.length, 31);
  assert.equal(oct.peakDay, 6); // Oct 6 Rent 6.5M
  assert.equal(oct.peakAmount, 6_500_000);
});

test("calculateCoupleSettlement computes net transfer for FAMILY expenses", () => {
  const txs: Transaction[] = [
    {
      id: "t1",
      amount: 6_000_000,
      date: "2026-10-05",
      type: "EXPENSE",
      categoryId: "cat_expense_rent",
      accountId: "a1",
      memberId: "HUSBAND",
      scope: "FAMILY",
      createdAt: "",
      updatedAt: "",
    },
    {
      id: "t2",
      amount: 2_000_000,
      date: "2026-10-08",
      type: "EXPENSE",
      categoryId: "cat_expense_food",
      accountId: "a2",
      memberId: "WIFE",
      scope: "FAMILY",
      createdAt: "",
      updatedAt: "",
    },
    {
      id: "t3",
      amount: 500_000,
      date: "2026-10-09",
      type: "EXPENSE",
      categoryId: "cat_expense_food",
      accountId: "a1",
      memberId: "HUSBAND",
      scope: "PERSONAL", // Ignored in family settlement
      createdAt: "",
      updatedAt: "",
    },
  ];

  // 50/50 split: total shared = 8M, each expects 4M -> Wife owes Husband 2M
  const split50 = calculateCoupleSettlement(txs, "2026-10", 50);
  assert.equal(split50.totalSharedExpense, 8_000_000);
  assert.equal(split50.fromMember, "WIFE");
  assert.equal(split50.toMember, "HUSBAND");
  assert.equal(split50.transferAmount, 2_000_000);

  // 75/25 split: Husband expects 6M, Wife expects 2M -> BALANCED
  const split75 = calculateCoupleSettlement(txs, "2026-10", 75);
  assert.equal(split75.fromMember, "BALANCED");
  assert.equal(split75.transferAmount, 0);
});

test("calculateLedgerIntegrity detects Event Sourcing drift", () => {
  const cleanAccounts = recalculateAccountBalances(DEFAULT_ACCOUNTS, DEFAULT_TRANSACTIONS);
  const ok = calculateLedgerIntegrity(cleanAccounts, DEFAULT_TRANSACTIONS);
  assert.equal(ok.isValid, true);
  assert.equal(ok.mismatches.length, 0);

  const tampered = cleanAccounts.map((a, i) => (i === 0 ? { ...a, currentBalance: 999 } : a));
  const bad = calculateLedgerIntegrity(tampered, DEFAULT_TRANSACTIONS);
  assert.equal(bad.isValid, false);
  assert.equal(bad.mismatches.length, 1);
});

test("resolveCategorySlugToId maps AI/legacy category hints to valid IDs", () => {
  assert.equal(resolveCategorySlugToId("cat_food", DEFAULT_CATEGORIES), "cat_expense_food");
  assert.equal(resolveCategorySlugToId("cat_medical", DEFAULT_CATEGORIES), "cat_expense_health");
  assert.equal(resolveCategorySlugToId("cat_expense_bills", DEFAULT_CATEGORIES), "cat_expense_bills");
});
