import test from "node:test";
import assert from "node:assert/strict";
import { calculatePeriodComparison } from "./periodComparison";
import { DEFAULT_CATEGORIES } from "@/constants/defaultCategories";
import { Category, Transaction } from "@/types/finance";

const sampleCategories: Category[] = [
  ...DEFAULT_CATEGORIES.slice(0, 4),
  { ...DEFAULT_CATEGORIES[4], isHidden: true }, // Danh mục ẩn vẫn giữ trong báo cáo lịch sử
];

const sampleTransactions: Transaction[] = [
  // Tháng hiện tại: 2026-10
  {
    id: "tx1",
    amount: 40_000_000,
    date: "2026-10-05",
    type: "INCOME",
    categoryId: "cat_income_salary",
    accountId: "acc1",
    memberId: "HUSBAND",
    scope: "FAMILY",
    createdAt: "2026-10-05T08:00:00Z",
    updatedAt: "2026-10-05T08:00:00Z",
  },
  {
    id: "tx2",
    amount: 10_000_000,
    date: "2026-10-06",
    type: "INCOME",
    categoryId: "cat_income_salary",
    accountId: "acc2",
    memberId: "WIFE",
    scope: "FAMILY",
    createdAt: "2026-10-06T08:00:00Z",
    updatedAt: "2026-10-06T08:00:00Z",
  },
  {
    id: "tx3",
    amount: 6_000_000,
    date: "2026-10-10",
    type: "EXPENSE",
    categoryId: "cat_expense_food",
    accountId: "acc1",
    memberId: "HUSBAND",
    scope: "FAMILY",
    createdAt: "2026-10-10T08:00:00Z",
    updatedAt: "2026-10-10T08:00:00Z",
  },
  {
    id: "tx4",
    amount: 4_000_000,
    date: "2026-10-12",
    type: "EXPENSE",
    categoryId: "cat_expense_health", // Hidden category
    accountId: "acc2",
    memberId: "WIFE",
    scope: "FAMILY",
    createdAt: "2026-10-12T08:00:00Z",
    updatedAt: "2026-10-12T08:00:00Z",
  },
  // Chuyển tiền nội bộ không tính vào thu chi
  {
    id: "tx_tr",
    amount: 5_000_000,
    date: "2026-10-13",
    type: "TRANSFER",
    categoryId: "cat_expense_other",
    accountId: "acc1",
    toAccountId: "acc2",
    memberId: "HUSBAND",
    scope: "FAMILY",
    createdAt: "2026-10-13T08:00:00Z",
    updatedAt: "2026-10-13T08:00:00Z",
  },
  // Tháng trước: 2026-09
  {
    id: "tx5",
    amount: 40_000_000,
    date: "2026-09-05",
    type: "INCOME",
    categoryId: "cat_income_salary",
    accountId: "acc1",
    memberId: "HUSBAND",
    scope: "FAMILY",
    createdAt: "2026-09-05T08:00:00Z",
    updatedAt: "2026-09-05T08:00:00Z",
  },
  {
    id: "tx6",
    amount: 5_000_000,
    date: "2026-09-10",
    type: "EXPENSE",
    categoryId: "cat_expense_food",
    accountId: "acc1",
    memberId: "HUSBAND",
    scope: "FAMILY",
    createdAt: "2026-09-10T08:00:00Z",
    updatedAt: "2026-09-10T08:00:00Z",
  },
  {
    id: "tx7",
    amount: 7_500_000,
    date: "2026-09-15",
    type: "EXPENSE",
    categoryId: "cat_expense_rent",
    accountId: "acc1",
    memberId: "HUSBAND",
    scope: "FAMILY",
    createdAt: "2026-09-15T08:00:00Z",
    updatedAt: "2026-09-15T08:00:00Z",
  },
  // Cùng kỳ năm ngoái: 2025-10
  {
    id: "tx8",
    amount: 32_000_000,
    date: "2025-10-05",
    type: "INCOME",
    categoryId: "cat_income_salary",
    accountId: "acc1",
    memberId: "HUSBAND",
    scope: "FAMILY",
    createdAt: "2025-10-05T08:00:00Z",
    updatedAt: "2025-10-05T08:00:00Z",
  },
  {
    id: "tx9",
    amount: 8_000_000,
    date: "2025-10-12",
    type: "EXPENSE",
    categoryId: "cat_expense_food",
    accountId: "acc1",
    memberId: "HUSBAND",
    scope: "FAMILY",
    createdAt: "2025-10-12T08:00:00Z",
    updatedAt: "2025-10-12T08:00:00Z",
  },
];

test("calculatePeriodComparison computes MoM deltas and preserves hidden categories in history", () => {
  const result = calculatePeriodComparison({
    transactions: sampleTransactions,
    categories: sampleCategories,
    currentMonthKey: "2026-10",
    mode: "MOM",
    perspective: "ALL",
  });

  assert.equal(result.previousMonthKey, "2026-09");
  assert.equal(result.hasCurrentData, true);
  assert.equal(result.hasPreviousData, true);

  // Income: 50M vs 40M (+25%)
  assert.equal(result.income.current, 50_000_000);
  assert.equal(result.income.previous, 40_000_000);
  assert.equal(result.income.deltaAmount, 10_000_000);
  assert.equal(result.income.deltaPercent, 25);

  // Expense: 10M vs 12.5M (-20%)
  assert.equal(result.expense.current, 10_000_000);
  assert.equal(result.expense.previous, 12_500_000);
  assert.equal(result.expense.deltaAmount, -2_500_000);
  assert.equal(result.expense.deltaPercent, -20);

  // Savings: 40M vs 27.5M
  assert.equal(result.savings.current, 40_000_000);
  assert.equal(result.savings.previous, 27_500_000);

  // Top categories includes hidden category "Sức khoẻ" (4M) and previous-only "Tiền nhà" (7.5M)
  assert.equal(result.topCategories.length, 3);
  assert.equal(result.topCategories[0].categoryId, "cat_expense_rent");
  assert.equal(result.topCategories[0].previousAmount, 7_500_000);
  assert.equal(result.topCategories[0].currentAmount, 0);
  assert.ok(result.topCategories.some((c) => c.categoryId === "cat_expense_health"));
});

test("calculatePeriodComparison computes YoY and handles perspective + zero-baseline cleanly", () => {
  const yoyAll = calculatePeriodComparison({
    transactions: sampleTransactions,
    categories: sampleCategories,
    currentMonthKey: "2026-10",
    mode: "YOY",
    perspective: "ALL",
  });
  assert.equal(yoyAll.previousMonthKey, "2025-10");
  assert.equal(yoyAll.income.previous, 32_000_000);
  assert.equal(yoyAll.expense.previous, 8_000_000);
  assert.equal(yoyAll.expense.deltaPercent, 25); // 10M vs 8M

  // Wife had no data in 2025-10 -> isNewBaseline true, deltaPercent null (no NaN/Infinity)
  const yoyWife = calculatePeriodComparison({
    transactions: sampleTransactions,
    categories: sampleCategories,
    currentMonthKey: "2026-10",
    mode: "YOY",
    perspective: "WIFE",
  });
  assert.equal(yoyWife.hasPreviousData, false);
  assert.equal(yoyWife.income.current, 10_000_000);
  assert.equal(yoyWife.income.previous, 0);
  assert.equal(yoyWife.income.isNewBaseline, true);
  assert.equal(yoyWife.income.deltaPercent, null);
});
