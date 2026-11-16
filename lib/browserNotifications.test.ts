import test from "node:test";
import assert from "node:assert/strict";
import {
  BUDGET_WARNING_THRESHOLD_RATIO,
  findBudgetExceedingThreshold,
  isBrowserNotificationSupported,
  getBrowserNotificationPermission,
  triggerBudgetThresholdNotifications,
} from "./browserNotifications";
import { BudgetProgressItem } from "@/types/finance";

const sampleBudgets: BudgetProgressItem[] = [
  {
    categoryId: "cat_food",
    categoryName: "Ăn uống",
    categoryColor: "#f97316",
    limitAmount: 5_000_000,
    spentAmount: 4_000_000, // Exact 80.0% -> must NOT trigger strict >80%
    remainingAmount: 1_000_000,
    percentage: 80,
  },
  {
    categoryId: "cat_shop",
    categoryName: "Mua sắm",
    categoryColor: "#ec4899",
    limitAmount: 5_000_000,
    spentAmount: 4_050_000, // 81% -> MUST trigger
    remainingAmount: 950_000,
    percentage: 81,
  },
  {
    categoryId: "cat_rent",
    categoryName: "Nhà ở",
    categoryColor: "#6366f1",
    limitAmount: 6_000_000,
    spentAmount: 6_500_000, // >100% -> MUST trigger
    remainingAmount: -500_000,
    percentage: 100,
  },
  {
    categoryId: "cat_zero",
    categoryName: "Chưa đặt hạn mức",
    categoryColor: "#64748b",
    limitAmount: 0,
    spentAmount: 1_000_000, // limit 0 -> ignored
    remainingAmount: -1_000_000,
    percentage: 0,
  },
];

test("findBudgetExceedingThreshold enforces strict >80% ratio and ignores zero limits", () => {
  assert.equal(BUDGET_WARNING_THRESHOLD_RATIO, 0.8);
  const matched = findBudgetExceedingThreshold(sampleBudgets);
  assert.deepEqual(
    matched.map((item) => item.categoryId),
    ["cat_shop", "cat_rent"]
  );
});

test("browserNotifications helpers fail safely in non-browser Node runtime", () => {
  assert.equal(isBrowserNotificationSupported(), false);
  assert.equal(getBrowserNotificationPermission(), "unsupported");

  const res = triggerBudgetThresholdNotifications({
    monthKey: "2026-11",
    items: sampleBudgets,
    isPrivacyMode: false,
  });
  assert.deepEqual(res, { sentCount: 0, sentCategories: [] });
});
