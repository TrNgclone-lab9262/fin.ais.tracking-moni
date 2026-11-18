import test from "node:test";
import assert from "node:assert/strict";
import {
  BUDGET_WARNING_THRESHOLD_RATIO,
  findBudgetExceedingThreshold,
  findRecurringExpenseReminders,
  evaluateRecurringRuleDueStatus,
  getBudgetWarningStatus,
  isBrowserNotificationSupported,
  getBrowserNotificationPermission,
  triggerBudgetThresholdNotifications,
  triggerRecurringExpenseNotifications,
} from "./browserNotifications";
import { BudgetProgressItem, RecurringRule } from "@/types/finance";

const sampleBudgets: BudgetProgressItem[] = [
  {
    categoryId: "cat_food",
    categoryName: "Ăn uống",
    categoryColor: "#f97316",
    limitAmount: 5_000_000,
    spentAmount: 4_000_000, // Exact 80.0% -> UI WARNING, strict >80% push NOT triggered
    remainingAmount: 1_000_000,
    percentage: 80,
  },
  {
    categoryId: "cat_shop",
    categoryName: "Mua sắm",
    categoryColor: "#ec4899",
    limitAmount: 5_000_000,
    spentAmount: 4_050_000, // 81% -> UI WARNING, strict >80% push triggered
    remainingAmount: 950_000,
    percentage: 81,
  },
  {
    categoryId: "cat_rent",
    categoryName: "Nhà ở",
    categoryColor: "#6366f1",
    limitAmount: 6_000_000,
    spentAmount: 6_500_000, // >100% -> UI DANGER, strict >80% push triggered
    remainingAmount: -500_000,
    percentage: 108,
  },
  {
    categoryId: "cat_fun",
    categoryName: "Giải trí",
    categoryColor: "#14b8a6",
    limitAmount: 2_000_000,
    spentAmount: 1_000_000, // 50% -> UI SAFE
    remainingAmount: 1_000_000,
    percentage: 50,
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

const sampleRules: RecurringRule[] = [
  {
    id: "rec_rent",
    name: "Tiền thuê nhà",
    amount: 6_500_000,
    type: "EXPENSE",
    categoryId: "cat_expense_rent",
    accountId: "acc_1",
    memberId: "HUSBAND",
    scope: "FAMILY",
    dayOfMonth: 15,
    isActive: true,
    lastAppliedMonth: "2026-10",
  },
  {
    id: "rec_internet",
    name: "Cước Internet",
    amount: 250_000,
    type: "EXPENSE",
    categoryId: "cat_expense_bills",
    accountId: "acc_1",
    memberId: "HUSBAND",
    scope: "FAMILY",
    dayOfMonth: 20, // +3 days from 2026-11-17 -> DUE_SOON
    isActive: true,
    lastAppliedMonth: "2026-10",
  },
  {
    id: "rec_gym",
    name: "Phòng gym",
    amount: 500_000,
    type: "EXPENSE",
    categoryId: "cat_expense_health",
    accountId: "acc_1",
    memberId: "WIFE",
    scope: "PERSONAL",
    dayOfMonth: 17, // Exact day 2026-11-17 -> DUE_TODAY
    isActive: true,
    lastAppliedMonth: "2026-10",
  },
  {
    id: "rec_water",
    name: "Tiền nước",
    amount: 150_000,
    type: "EXPENSE",
    categoryId: "cat_expense_bills",
    accountId: "acc_1",
    memberId: "HUSBAND",
    scope: "FAMILY",
    dayOfMonth: 25, // +8 days -> UPCOMING (outside 3-day lead)
    isActive: true,
    lastAppliedMonth: "2026-10",
  },
  {
    id: "rec_applied",
    name: "Tiền điện đã đóng",
    amount: 800_000,
    type: "EXPENSE",
    categoryId: "cat_expense_bills",
    accountId: "acc_1",
    memberId: "HUSBAND",
    scope: "FAMILY",
    dayOfMonth: 18,
    isActive: true,
    lastAppliedMonth: "2026-11", // Already applied -> APPLIED
  },
  {
    id: "rec_salary",
    name: "Lương tháng",
    amount: 25_000_000,
    type: "INCOME", // Income -> excluded from expense reminders
    categoryId: "cat_income_salary",
    accountId: "acc_1",
    memberId: "HUSBAND",
    scope: "FAMILY",
    dayOfMonth: 18,
    isActive: true,
    lastAppliedMonth: "2026-10",
  },
  {
    id: "rec_paused",
    name: "Gói truyền hình tạm tắt",
    amount: 120_000,
    type: "EXPENSE",
    categoryId: "cat_expense_bills",
    accountId: "acc_1",
    memberId: "HUSBAND",
    scope: "FAMILY",
    dayOfMonth: 18,
    isActive: false,
    lastAppliedMonth: "2026-10",
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

test("getBudgetWarningStatus classifies SAFE (<80%), WARNING (80-99%), and DANGER (>=100%)", () => {
  assert.equal(getBudgetWarningStatus(sampleBudgets[3]).level, "SAFE");
  assert.equal(getBudgetWarningStatus(sampleBudgets[0]).level, "WARNING");
  assert.equal(getBudgetWarningStatus(sampleBudgets[1]).level, "WARNING");
  assert.equal(getBudgetWarningStatus(sampleBudgets[2]).level, "DANGER");
  assert.equal(getBudgetWarningStatus(sampleBudgets[2]).label, "Vượt hạn mức");
});

test("evaluateRecurringRuleDueStatus and findRecurringExpenseReminders enforce 3-day lead window", () => {
  const now = new Date(2026, 10, 17, 10, 0, 0); // 2026-11-17 local
  assert.equal(evaluateRecurringRuleDueStatus(sampleRules[0], "2026-11", now).status, "OVERDUE");
  assert.equal(evaluateRecurringRuleDueStatus(sampleRules[2], "2026-11", now).status, "DUE_TODAY");
  assert.equal(evaluateRecurringRuleDueStatus(sampleRules[1], "2026-11", now).status, "DUE_SOON");
  assert.equal(evaluateRecurringRuleDueStatus(sampleRules[1], "2026-11", now).daysUntilDue, 3);
  assert.equal(evaluateRecurringRuleDueStatus(sampleRules[3], "2026-11", now).status, "UPCOMING");
  assert.equal(evaluateRecurringRuleDueStatus(sampleRules[4], "2026-11", now).status, "APPLIED");

  const reminders = findRecurringExpenseReminders(sampleRules, "2026-11", now);
  assert.deepEqual(
    reminders.map((r) => ({ id: r.rule.id, status: r.status, days: r.daysUntilDue })),
    [
      { id: "rec_rent", status: "OVERDUE", days: -2 },
      { id: "rec_gym", status: "DUE_TODAY", days: 0 },
      { id: "rec_internet", status: "DUE_SOON", days: 3 },
    ]
  );
});

test("browserNotifications helpers fail safely in non-browser Node runtime", () => {
  assert.equal(isBrowserNotificationSupported(), false);
  assert.equal(getBrowserNotificationPermission(), "unsupported");

  const budgetRes = triggerBudgetThresholdNotifications({
    monthKey: "2026-11",
    items: sampleBudgets,
    isPrivacyMode: false,
  });
  assert.deepEqual(budgetRes, { sentCount: 0, sentCategories: [] });

  const recurringRes = triggerRecurringExpenseNotifications({
    monthKey: "2026-11",
    rules: sampleRules,
    isPrivacyMode: false,
    now: new Date(2026, 10, 17),
  });
  assert.deepEqual(recurringRes, { sentCount: 0, sentRuleNames: [] });
});
