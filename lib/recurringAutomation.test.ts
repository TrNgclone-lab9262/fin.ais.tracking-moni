import test from "node:test";
import assert from "node:assert/strict";
import {
  detectRecurringSuggestionsFromHistory,
  evaluateAutoPostCandidates,
  hasMatchingManualTransactionForRule,
} from "./recurringAutomation";
import { RecurringRule, Transaction } from "@/types/finance";

function makeTx(overrides: Partial<Transaction>): Transaction {
  return {
    id: `tx_${Math.random()}`,
    amount: 260_000,
    date: "2026-10-15",
    type: "EXPENSE",
    categoryId: "cat_expense_entertainment",
    accountId: "acc_husband_bidv",
    memberId: "HUSBAND",
    scope: "FAMILY",
    note: "Netflix Gia Đình",
    createdAt: "2026-10-15T08:00:00.000Z",
    updatedAt: "2026-10-15T08:00:00.000Z",
    ...overrides,
  };
}

test("evaluateAutoPostCandidates posts due autoPost rules and skips matching manual transactions", () => {
  const rules: RecurringRule[] = [
    {
      id: "rule_rent",
      name: "Tiền thuê chung cư",
      amount: 6_500_000,
      type: "EXPENSE",
      categoryId: "cat_expense_rent",
      accountId: "acc_husband_vietinbank",
      memberId: "HUSBAND",
      scope: "FAMILY",
      dayOfMonth: 6,
      isActive: true,
      autoPost: true,
      lastAppliedMonth: "2026-10",
    },
    {
      id: "rule_netflix",
      name: "Gói Netflix Family",
      amount: 260_000,
      type: "EXPENSE",
      categoryId: "cat_expense_entertainment",
      accountId: "acc_husband_bidv",
      memberId: "HUSBAND",
      scope: "FAMILY",
      dayOfMonth: 15,
      isActive: true,
      autoPost: true,
      lastAppliedMonth: "2026-10",
    },
    {
      id: "rule_internet_future",
      name: "Internet FPT",
      amount: 250_000,
      type: "EXPENSE",
      categoryId: "cat_expense_bills",
      accountId: "acc_husband_bidv",
      memberId: "HUSBAND",
      scope: "FAMILY",
      dayOfMonth: 25,
      isActive: true,
      autoPost: true,
      lastAppliedMonth: "2026-10",
    },
    {
      id: "rule_manual_only",
      name: "Quỹ dự phòng",
      amount: 1_000_000,
      type: "EXPENSE",
      categoryId: "cat_expense_other",
      accountId: "acc_husband_bidv",
      memberId: "HUSBAND",
      scope: "FAMILY",
      dayOfMonth: 5,
      isActive: true,
      autoPost: false,
      lastAppliedMonth: "2026-10",
    },
  ];

  // User already entered rent manually on 2026-11-04
  const txs: Transaction[] = [
    makeTx({
      id: "manual_rent_nov",
      amount: 6_500_000,
      date: "2026-11-04",
      categoryId: "cat_expense_rent",
      accountId: "acc_husband_vietinbank",
      note: "Đóng tiền thuê chung cư tháng 11",
    }),
  ];

  // Evaluate on 2026-11-18:
  // - rule_rent (day 6 <= 18): should be SKIPPED as duplicate because manual_rent_nov exists
  // - rule_netflix (day 15 <= 18): should be AUTO-POSTED on 2026-11-15
  // - rule_internet_future (day 25 > 18): not due yet
  // - rule_manual_only (autoPost: false): ignored
  const result = evaluateAutoPostCandidates({
    rules,
    transactions: txs,
    now: new Date(2026, 10, 18, 9, 0, 0),
  });

  assert.equal(result.monthKey, "2026-11");
  assert.equal(result.skippedDuplicates.length, 1);
  assert.equal(result.skippedDuplicates[0].rule.id, "rule_rent");
  assert.equal(result.skippedDuplicates[0].matchedTransaction.id, "manual_rent_nov");

  assert.equal(result.toPost.length, 1);
  assert.equal(result.toPost[0].rule.id, "rule_netflix");
  assert.equal(result.toPost[0].txDate, "2026-11-15");
});

test("hasMatchingManualTransactionForRule detects Vietnamese unaccented or slight variance matches", () => {
  const rule: RecurringRule = {
    id: "rule_water",
    name: "Tiền nước sinh hoạt",
    amount: 200_000,
    type: "EXPENSE",
    categoryId: "cat_expense_bills",
    accountId: "acc_wife_acb",
    memberId: "WIFE",
    scope: "FAMILY",
    dayOfMonth: 12,
    isActive: true,
    autoPost: true,
  };

  const match = hasMatchingManualTransactionForRule(rule, "2026-11", [
    makeTx({
      amount: 205_000,
      date: "2026-11-10",
      categoryId: "cat_expense_bills",
      accountId: "acc_wife_acb",
      memberId: "WIFE",
      note: "Tien nuoc T11",
    }),
  ]);
  assert.ok(match);
});

test("detectRecurringSuggestionsFromHistory detects fixed patterns like Netflix across >=2 months and excludes existing/dismissed rules", () => {
  const transactions: Transaction[] = [
    // Netflix across 3 months around day 15
    makeTx({ id: "nf_1", date: "2026-09-15", amount: 260_000, note: "Thanh toán Netflix T9" }),
    makeTx({ id: "nf_2", date: "2026-10-15", amount: 260_000, note: "Thanh toán Netflix T10" }),
    makeTx({ id: "nf_3", date: "2026-11-14", amount: 260_000, note: "Thanh toán Netflix T11" }),
    // Gym across 2 months around day 1
    makeTx({
      id: "gym_1",
      date: "2026-09-02",
      amount: 550_000,
      categoryId: "cat_expense_health",
      note: "Hội viên California Gym",
    }),
    makeTx({
      id: "gym_2",
      date: "2026-10-01",
      amount: 550_000,
      categoryId: "cat_expense_health",
      note: "Hội viên California Gym",
    }),
    // One-off expense (only 1 month) -> ignored
    makeTx({
      id: "one_off",
      date: "2026-10-22",
      amount: 1_500_000,
      categoryId: "cat_expense_shopping",
      note: "Mua quạt mới",
    }),
  ];

  const existingRules: RecurringRule[] = [
    {
      id: "existing_gym",
      name: "Hội viên California Gym",
      amount: 550_000,
      type: "EXPENSE",
      categoryId: "cat_expense_health",
      accountId: "acc_husband_bidv",
      memberId: "HUSBAND",
      scope: "FAMILY",
      dayOfMonth: 1,
      isActive: true,
    },
  ];

  const suggestions = detectRecurringSuggestionsFromHistory({
    transactions,
    existingRules,
    now: new Date(2026, 10, 18),
  });

  assert.equal(suggestions.length, 1);
  assert.match(suggestions[0].suggestedName.toLowerCase(), /netflix/);
  assert.equal(suggestions[0].amount, 260_000);
  assert.equal(suggestions[0].dayOfMonth, 15);
  assert.equal(suggestions[0].alreadyLoggedCurrentMonth, true);
  assert.equal(suggestions[0].occurrenceMonths.length, 3);

  // Dismissed signature should suppress suggestion
  const afterDismiss = detectRecurringSuggestionsFromHistory({
    transactions,
    existingRules,
    dismissedSignatures: [suggestions[0].signature],
    now: new Date(2026, 10, 18),
  });
  assert.equal(afterDismiss.length, 0);
});
