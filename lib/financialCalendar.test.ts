import test from "node:test";
import assert from "node:assert/strict";
import { buildFinancialCalendarMonth } from "./financialCalendar";
import { createDefaultSkyOneLoan } from "./mortgageEngine";
import { Account, RecurringRule } from "@/types/finance";

const sampleAccounts: Account[] = [
  {
    id: "acc_bank",
    name: "Vietinbank",
    type: "BANK",
    owner: "HUSBAND",
    initialBalance: 10_000_000,
    currentBalance: 10_000_000,
  },
  {
    id: "acc_cc_husband",
    name: "BIDV Credit (Anh Chuột)",
    type: "CREDIT_CARD",
    owner: "HUSBAND",
    creditLimit: 50_000_000,
    statementDay: 20,
    dueDay: 6,
    initialBalance: 0,
    currentBalance: 12_500_000,
  },
];

const sampleRules: RecurringRule[] = [
  {
    id: "rec_rent",
    name: "Tiền thuê chung cư",
    amount: 6_500_000,
    type: "EXPENSE",
    categoryId: "cat_expense_rent",
    accountId: "acc_bank",
    memberId: "HUSBAND",
    scope: "FAMILY",
    dayOfMonth: 6,
    isActive: true,
    autoPost: true,
    lastAppliedMonth: "2026-12",
  },
  {
    id: "rec_internet",
    name: "Internet gia đình",
    amount: 250_000,
    type: "EXPENSE",
    categoryId: "cat_expense_bills",
    accountId: "acc_bank",
    memberId: "HUSBAND",
    scope: "FAMILY",
    dayOfMonth: 9,
    isActive: true,
    autoPost: false,
    lastAppliedMonth: "2026-11",
  },
];

test("buildFinancialCalendarMonth combines recurring rules, SKYONE loan installments, and credit card dates", () => {
  const loan = createDefaultSkyOneLoan("2026-12-07"); // Period #16 due 2026-12-10
  const cal = buildFinancialCalendarMonth({
    monthKey: "2026-12",
    rules: sampleRules,
    contract: loan,
    accounts: sampleAccounts,
    transactions: [],
    now: new Date(2026, 11, 7, 9, 0, 0), // 2026-12-07
    defaultInstallmentAccountId: "acc_bank",
  });

  assert.equal(cal.monthKey, "2026-12");
  assert.equal(cal.daysInMonth, 31);
  // Dec 1, 2026 is Tuesday -> Monday-first offset = 1
  assert.equal(cal.firstWeekdayOffset, 1);

  // Day 6 has both paid rent (APPLIED) and credit card due date
  const day6 = cal.cells.find((c) => c.day === 6);
  assert.ok(day6);
  assert.ok(day6.events.some((e) => e.kind === "RECURRING" && e.status === "APPLIED"));
  assert.ok(day6.events.some((e) => e.kind === "CREDIT_DUE"));

  // Day 9 has internet due in 2 days (DUE_SOON) and canQuickRecord
  const day9 = cal.cells.find((c) => c.day === 9);
  assert.ok(day9);
  const netEv = day9.events.find((e) => e.recurringRuleId === "rec_internet");
  assert.ok(netEv);
  assert.equal(netEv.status, "DUE_SOON");
  assert.equal(netEv.canQuickRecord, true);

  // Day 10 has SKYONE installment #16 due in 3 days (DUE_SOON) and canQuickRecord
  const day10 = cal.cells.find((c) => c.day === 10);
  assert.ok(day10);
  const instEv = day10.events.find((e) => e.kind === "INSTALLMENT");
  assert.ok(instEv);
  assert.equal(instEv.installmentPeriod, 16);
  assert.equal(instEv.status, "DUE_SOON");
  assert.equal(instEv.canQuickRecord, true);

  // Day 20 has credit card statement date
  const day20 = cal.cells.find((c) => c.day === 20);
  assert.ok(day20);
  assert.ok(day20.events.some((e) => e.kind === "CREDIT_STATEMENT"));

  // Day 7 is today
  const day7 = cal.cells.find((c) => c.day === 7);
  assert.ok(day7);
  assert.equal(day7.isToday, true);
});
