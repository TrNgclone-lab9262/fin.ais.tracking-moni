import test from "node:test";
import assert from "node:assert/strict";
import { buildSpendingForecast } from "./spendingForecast";
import { DEFAULT_CATEGORIES } from "@/constants/defaultCategories";
import {
  DEFAULT_BUDGETS,
  DEFAULT_RECURRING_RULES,
  DEFAULT_TRANSACTIONS,
} from "@/constants/mockData";
import { Transaction } from "@/types/finance";

test("buildSpendingForecast prevents double counting active recurring rules on anchor month", () => {
  const result = buildSpendingForecast({
    transactions: DEFAULT_TRANSACTIONS,
    recurringRules: DEFAULT_RECURRING_RULES,
    categories: DEFAULT_CATEGORIES,
    budgets: DEFAULT_BUDGETS,
    anchorMonth: "2026-10",
    perspective: "ALL",
  });

  assert.equal(result.hasHistoricalData, true);
  assert.equal(result.monthsAnalyzed, 1);
  assert.equal(result.recurringIncomeBaseline, 50_000_000);
  assert.equal(result.recurringExpenseBaseline, 6_750_000);
  // Total Oct 2026 expenses = 17.08M -> 6.75M recurring + 10.33M discretionary
  assert.equal(result.discretionaryExpenseBaseline, 10_330_000);
  assert.equal(result.forecastMonths.length, 3);
  assert.deepEqual(
    result.forecastMonths.map((m) => m.month),
    ["2026-11", "2026-12", "2027-01"]
  );
  assert.equal(result.forecastMonths[0].predictedIncome, 50_000_000);
  assert.equal(result.forecastMonths[0].predictedExpense, 17_080_000);
  assert.equal(result.forecastMonths[0].riskLevel, "SAFE");
  assert.equal(result.chartSeries.length, 6);
  // Anchor point (index 2) bridges actual and forecast series seamlessly
  assert.equal(result.chartSeries[2].actualExpense, 17_080_000);
  assert.equal(result.chartSeries[2].forecastExpense, 17_080_000);
  assert.equal(result.chartSeries[3].isForecast, true);
  assert.equal(result.chartSeries[3].actualExpense, null);
});

test("buildSpendingForecast filters strictly by perspective and detects growth slope", () => {
  const txs: Transaction[] = [
    {
      id: "t1",
      amount: 20_000_000,
      date: "2026-08-05",
      type: "INCOME",
      categoryId: "cat_income_salary",
      accountId: "acc_husband_vietinbank",
      memberId: "HUSBAND",
      scope: "FAMILY",
      createdAt: "2026-08-05T08:00:00Z",
      updatedAt: "2026-08-05T08:00:00Z",
    },
    {
      id: "t2",
      amount: 4_000_000,
      date: "2026-08-15",
      type: "EXPENSE",
      categoryId: "cat_expense_food",
      accountId: "acc_husband_bidv",
      memberId: "HUSBAND",
      scope: "PERSONAL",
      createdAt: "2026-08-15T08:00:00Z",
      updatedAt: "2026-08-15T08:00:00Z",
    },
    {
      id: "t3",
      amount: 5_000_000,
      date: "2026-09-15",
      type: "EXPENSE",
      categoryId: "cat_expense_food",
      accountId: "acc_husband_bidv",
      memberId: "HUSBAND",
      scope: "PERSONAL",
      createdAt: "2026-09-15T08:00:00Z",
      updatedAt: "2026-09-15T08:00:00Z",
    },
    {
      id: "t4",
      amount: 12_000_000,
      date: "2026-09-18",
      type: "EXPENSE",
      categoryId: "cat_expense_shopping",
      accountId: "acc_wife_acb",
      memberId: "WIFE",
      scope: "PERSONAL",
      createdAt: "2026-09-18T08:00:00Z",
      updatedAt: "2026-09-18T08:00:00Z",
    },
  ];

  const husbandForecast = buildSpendingForecast({
    transactions: txs,
    recurringRules: [],
    categories: DEFAULT_CATEGORIES,
    anchorMonth: "2026-09",
    perspective: "HUSBAND",
  });

  // WIFE 12M expense must not leak into HUSBAND forecast
  assert.equal(husbandForecast.monthsAnalyzed, 2);
  assert.equal(husbandForecast.topDrivers[0].categoryId, "cat_expense_food");
  // Positive momentum capped cleanly at <= +5% per month
  assert.ok(husbandForecast.monthlyGrowthRatePct > 0);
  assert.ok(husbandForecast.monthlyGrowthRatePct <= 5);
  assert.ok(
    husbandForecast.forecastMonths[1].predictedExpense >
      husbandForecast.forecastMonths[0].predictedExpense
  );
});
