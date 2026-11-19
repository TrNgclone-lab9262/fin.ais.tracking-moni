import test from "node:test";
import assert from "node:assert/strict";
import {
  buildIncomeVsExpenseAnalytics,
  buildMonthlyExpenseComparison,
  buildSpendingTrendSeries,
  shiftMonthKey,
} from "./dashboardAnalytics";
import { Category, CategoryBudget, Transaction } from "../types/finance";

const CATEGORIES: Category[] = [
  { id: "cat_food", name: "Ăn uống", type: "EXPENSE", icon: "Utensils", color: "#F59E0B" },
  { id: "cat_home", name: "Nhà cửa", type: "EXPENSE", icon: "Home", color: "#2563EB" },
  { id: "cat_play", name: "Giải trí", type: "EXPENSE", icon: "Film", color: "#EC4899" },
  { id: "cat_salary", name: "Lương", type: "INCOME", icon: "Wallet", color: "#10B981" },
];

const BUDGETS: CategoryBudget[] = [
  { categoryId: "cat_food", month: "2026-11", limitAmount: 8_000_000 },
  { categoryId: "cat_home", month: "2026-11", limitAmount: 10_000_000 },
];

function makeTx(
  partial: Omit<Transaction, "createdAt" | "updatedAt">
): Transaction {
  return {
    ...partial,
    createdAt: `${partial.date}T08:00:00.000Z`,
    updatedAt: `${partial.date}T08:00:00.000Z`,
  };
}

const TRANSACTIONS: Transaction[] = [
  // Sep 2026
  makeTx({
    id: "t1",
    amount: 40_000_000,
    date: "2026-09-05",
    type: "INCOME",
    categoryId: "cat_salary",
    accountId: "a1",
    memberId: "HUSBAND",
    scope: "FAMILY",
  }),
  makeTx({
    id: "t2",
    amount: 6_000_000,
    date: "2026-09-12",
    type: "EXPENSE",
    categoryId: "cat_food",
    accountId: "a1",
    memberId: "HUSBAND",
    scope: "FAMILY",
  }),
  makeTx({
    id: "t3",
    amount: 8_000_000,
    date: "2026-09-15",
    type: "EXPENSE",
    categoryId: "cat_home",
    accountId: "a1",
    memberId: "WIFE",
    scope: "FAMILY",
  }),
  // Oct 2026
  makeTx({
    id: "t4",
    amount: 42_000_000,
    date: "2026-10-05",
    type: "INCOME",
    categoryId: "cat_salary",
    accountId: "a1",
    memberId: "HUSBAND",
    scope: "FAMILY",
  }),
  makeTx({
    id: "t5",
    amount: 7_500_000,
    date: "2026-10-14",
    type: "EXPENSE",
    categoryId: "cat_food",
    accountId: "a1",
    memberId: "WIFE",
    scope: "FAMILY",
  }),
  makeTx({
    id: "t6",
    amount: 9_000_000,
    date: "2026-10-16",
    type: "EXPENSE",
    categoryId: "cat_home",
    accountId: "a1",
    memberId: "HUSBAND",
    scope: "FAMILY",
  }),
  // Transfer should NEVER be counted in expense or income
  makeTx({
    id: "t_transfer",
    amount: 15_000_000,
    date: "2026-10-20",
    type: "TRANSFER",
    categoryId: "cat_home",
    accountId: "a1",
    toAccountId: "a2",
    memberId: "HUSBAND",
    scope: "FAMILY",
  }),
  // Nov 2026
  makeTx({
    id: "t7",
    amount: 50_000_000,
    date: "2026-11-05",
    type: "INCOME",
    categoryId: "cat_salary",
    accountId: "a1",
    memberId: "HUSBAND",
    scope: "FAMILY",
  }),
  makeTx({
    id: "t8",
    amount: 9_000_000,
    date: "2026-11-10",
    type: "EXPENSE",
    categoryId: "cat_food",
    accountId: "a1",
    memberId: "WIFE",
    scope: "FAMILY",
  }),
  makeTx({
    id: "t9",
    amount: 10_000_000,
    date: "2026-11-12",
    type: "EXPENSE",
    categoryId: "cat_home",
    accountId: "a1",
    memberId: "HUSBAND",
    scope: "FAMILY",
  }),
  makeTx({
    id: "t10",
    amount: 2_000_000,
    date: "2026-11-15",
    type: "EXPENSE",
    categoryId: "cat_play",
    accountId: "a1",
    memberId: "HUSBAND",
    scope: "PERSONAL",
  }),
];

test("buildSpendingTrendSeries aggregates monthly/daily spending, moving average, category filter and excludes TRANSFER", () => {
  const res3M = buildSpendingTrendSeries({
    transactions: TRANSACTIONS,
    categories: CATEGORIES,
    budgets: BUDGETS,
    perspective: "ALL",
    range: "3M",
    categoryId: "ALL",
    selectedMonth: "2026-11",
  });

  assert.equal(res3M.points.length, 3);
  assert.equal(res3M.points[0].key, "2026-09");
  assert.equal(res3M.points[0].amount, 14_000_000);
  assert.equal(res3M.points[1].amount, 16_500_000);
  assert.equal(res3M.points[2].amount, 21_000_000);
  assert.equal(res3M.totalSpent, 51_500_000);
  assert.equal(res3M.budgetCeiling, 18_000_000);
  assert.equal(res3M.peakPoint?.key, "2026-11");
  // Moving avg of 3 months = (14M + 16.5M + 21M) / 3 = 17,166,667
  assert.equal(res3M.points[2].movingAvg, 17_166_667);

  // Category filter + perspective filter (WIFE only)
  const foodWife = buildSpendingTrendSeries({
    transactions: TRANSACTIONS,
    categories: CATEGORIES,
    budgets: BUDGETS,
    perspective: "WIFE",
    range: "3M",
    categoryId: "cat_food",
    selectedMonth: "2026-11",
  });
  assert.equal(foodWife.points[0].amount, 0);
  assert.equal(foodWife.points[1].amount, 7_500_000);
  assert.equal(foodWife.points[2].amount, 9_000_000);
  assert.equal(foodWife.budgetCeiling, 8_000_000);

  // 30D daily mode
  const daily = buildSpendingTrendSeries({
    transactions: TRANSACTIONS,
    categories: CATEGORIES,
    budgets: BUDGETS,
    perspective: "ALL",
    range: "30D",
    categoryId: "ALL",
    selectedMonth: "2026-11",
    referenceDate: "2026-11-18",
  });
  assert.equal(daily.points.length, 30);
  assert.equal(daily.totalSpent, 21_000_000);
  assert.equal(daily.points.find((p) => p.key === "2026-11-12")?.amount, 10_000_000);
});

test("buildMonthlyExpenseComparison computes MoM category deltas and 6-month stacked breakdown", () => {
  const cmp = buildMonthlyExpenseComparison({
    transactions: TRANSACTIONS,
    categories: CATEGORIES,
    perspective: "ALL",
    monthA: "2026-11",
    monthB: "2026-10",
    stackedMonthCount: 6,
  });

  assert.equal(cmp.totalA, 21_000_000);
  assert.equal(cmp.totalB, 16_500_000);
  assert.equal(cmp.deltaAmount, 4_500_000);
  assert.equal(cmp.deltaPct, 27.3);

  const foodRow = cmp.categoryRows.find((r) => r.categoryId === "cat_food");
  assert.ok(foodRow);
  assert.equal(foodRow.amountA, 9_000_000);
  assert.equal(foodRow.amountB, 7_500_000);
  assert.equal(foodRow.delta, 1_500_000);
  assert.equal(foodRow.deltaPct, 20);

  assert.equal(cmp.stackedMonths.length, 6);
  const novStack = cmp.stackedMonths[cmp.stackedMonths.length - 1];
  assert.equal(novStack.month, "2026-11");
  assert.equal(novStack.total, 21_000_000);
});

test("buildIncomeVsExpenseAnalytics calculates net cashflow, savings rate, and surplus months accurately", () => {
  const analytics = buildIncomeVsExpenseAnalytics({
    transactions: TRANSACTIONS,
    perspective: "ALL",
    range: "6M",
    selectedMonth: "2026-11",
  });

  assert.equal(analytics.points.length, 6);
  assert.equal(analytics.totalIncome, 132_000_000);
  assert.equal(analytics.totalExpense, 51_500_000);
  assert.equal(analytics.totalNet, 80_500_000);
  assert.equal(analytics.surplusMonthsCount, 3);
  assert.equal(analytics.bestSavingsMonth?.month, "2026-11");
  assert.equal(analytics.highestExpenseMonth?.month, "2026-11");

  const novPoint = analytics.points.find((p) => p.month === "2026-11");
  assert.ok(novPoint);
  assert.equal(novPoint.net, 29_000_000);
  assert.equal(novPoint.savingsRate, 58);
  assert.equal(shiftMonthKey("2026-01", -1), "2025-12");
});
