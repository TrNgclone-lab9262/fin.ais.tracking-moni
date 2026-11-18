import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCategoryUsageStats,
  getSelectableCategories,
  restoreDefaultCategoriesList,
} from "./categoryUtils";
import { DEFAULT_CATEGORIES } from "@/constants/defaultCategories";
import { Category, CategoryBudget, RecurringRule, Transaction } from "@/types/finance";

test("getSelectableCategories excludes hidden categories for new entries but preserves includeCategoryId when editing", () => {
  const sampleCategories: Category[] = [
    { ...DEFAULT_CATEGORIES[0], isHidden: false },
    { ...DEFAULT_CATEGORIES[1], isHidden: true }, // Tiền nhà bị ẩn
    {
      id: "cat_custom_pet",
      name: "Thú cưng",
      type: "EXPENSE",
      color: "#14B8A6",
      icon: "Dog",
      isDefault: false,
      isHidden: false,
    },
    { ...DEFAULT_CATEGORIES[8], isHidden: true }, // Lương bị ẩn
  ];

  // Ghi sổ mới: không hiện Tiền nhà
  const newExpenseList = getSelectableCategories(sampleCategories, "EXPENSE");
  assert.deepEqual(
    newExpenseList.map((c) => c.id),
    ["cat_expense_food", "cat_custom_pet"]
  );

  // Chỉnh sửa giao dịch cũ gắn Tiền nhà: giữ Tiền nhà trong danh sách
  const editExpenseList = getSelectableCategories(
    sampleCategories,
    "EXPENSE",
    "cat_expense_rent"
  );
  assert.deepEqual(
    editExpenseList.map((c) => c.id),
    ["cat_expense_food", "cat_expense_rent", "cat_custom_pet"]
  );
});

test("buildCategoryUsageStats counts transactions, budgets, and recurring rules while skipping TRANSFER", () => {
  const txs: Transaction[] = [
    {
      id: "t1",
      amount: 100000,
      date: "2026-10-01",
      type: "EXPENSE",
      categoryId: "cat_expense_food",
      accountId: "acc1",
      memberId: "HUSBAND",
      scope: "FAMILY",
      createdAt: "2026-10-01T00:00:00Z",
      updatedAt: "2026-10-01T00:00:00Z",
    },
    {
      id: "t2",
      amount: 500000,
      date: "2026-10-02",
      type: "TRANSFER",
      categoryId: "cat_expense_other",
      accountId: "acc1",
      toAccountId: "acc2",
      memberId: "HUSBAND",
      scope: "FAMILY",
      createdAt: "2026-10-02T00:00:00Z",
      updatedAt: "2026-10-02T00:00:00Z",
    },
  ];
  const budgets: CategoryBudget[] = [
    { categoryId: "cat_expense_food", month: "2026-10", limitAmount: 5000000 },
  ];
  const rules: RecurringRule[] = [
    {
      id: "r1",
      name: "Tiền nhà",
      amount: 8000000,
      type: "EXPENSE",
      categoryId: "cat_expense_rent",
      accountId: "acc1",
      memberId: "HUSBAND",
      scope: "FAMILY",
      dayOfMonth: 5,
      isActive: true,
    },
  ];

  const stats = buildCategoryUsageStats(txs, budgets, rules);
  assert.deepEqual(stats.get("cat_expense_food"), {
    txCount: 1,
    budgetCount: 1,
    ruleCount: 0,
  });
  assert.equal(stats.get("cat_expense_other"), undefined);
  assert.deepEqual(stats.get("cat_expense_rent"), {
    txCount: 0,
    budgetCount: 0,
    ruleCount: 1,
  });
});

test("restoreDefaultCategoriesList unhides defaults, restores missing defaults, and keeps custom categories", () => {
  const custom: Category = {
    id: "cat_custom_baby",
    name: "Em bé",
    type: "EXPENSE",
    color: "#EC4899",
    icon: "Baby",
    isDefault: false,
    isHidden: false,
  };
  const current: Category[] = [
    { ...DEFAULT_CATEGORIES[0], isHidden: true },
    custom,
  ];

  const restored = restoreDefaultCategoriesList(current, DEFAULT_CATEGORIES);
  assert.equal(
    restored.find((c) => c.id === DEFAULT_CATEGORIES[0].id)?.isHidden,
    false
  );
  assert.ok(restored.some((c) => c.id === "cat_custom_baby"));
  assert.equal(restored.length, DEFAULT_CATEGORIES.length + 1);
});
