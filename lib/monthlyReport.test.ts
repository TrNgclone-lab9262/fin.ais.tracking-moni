import test from "node:test";
import assert from "node:assert/strict";
import { buildMonthlyPdfReport, normalizeReportMonthKey } from "./monthlyReport";
import { Account, Category, Transaction } from "@/types/finance";

const TEST_CATEGORIES: Category[] = [
  { id: "cat_food", name: "Ăn uống", type: "EXPENSE", color: "#ef4444" },
  { id: "cat_bills", name: "Hóa đơn & Điện nước", type: "EXPENSE", color: "#f59e0b" },
  { id: "cat_salary", name: "Lương chính", type: "INCOME", color: "#10b981" },
];

const TEST_ACCOUNTS: Account[] = [
  {
    id: "acc_h",
    name: "VietinBank Chồng",
    type: "BANK",
    owner: "HUSBAND",
    initialBalance: 0,
    currentBalance: 0,
  },
  {
    id: "acc_w",
    name: "Vietcombank Vợ",
    type: "BANK",
    owner: "WIFE",
    initialBalance: 0,
    currentBalance: 0,
  },
];

const TEST_TXS: Transaction[] = [
  {
    id: "tx_1",
    amount: 30_000_000,
    date: "2026-11-05",
    type: "INCOME",
    categoryId: "cat_salary",
    accountId: "acc_h",
    memberId: "HUSBAND",
    scope: "FAMILY",
    note: "Lương tháng 11",
    createdAt: "2026-11-05T08:00:00Z",
    updatedAt: "2026-11-05T08:00:00Z",
  },
  {
    id: "tx_2",
    amount: 6_000_000,
    date: "2026-11-10",
    type: "EXPENSE",
    categoryId: "cat_bills",
    accountId: "acc_h",
    memberId: "HUSBAND",
    scope: "FAMILY",
    note: "Tiền nhà & điện",
    createdAt: "2026-11-10T10:00:00Z",
    updatedAt: "2026-11-10T10:00:00Z",
  },
  {
    id: "tx_3",
    amount: 2_000_000,
    date: "2026-11-12",
    type: "EXPENSE",
    categoryId: "cat_food",
    accountId: "acc_w",
    memberId: "WIFE",
    scope: "FAMILY",
    note: "Đi siêu thị tuần",
    createdAt: "2026-11-12T18:00:00Z",
    updatedAt: "2026-11-12T18:00:00Z",
  },
  {
    id: "tx_4",
    amount: 500_000,
    date: "2026-11-14",
    type: "EXPENSE",
    categoryId: "cat_food",
    accountId: "acc_w",
    memberId: "WIFE",
    scope: "PERSONAL",
    note: "Trà sữa riêng",
    createdAt: "2026-11-14T15:00:00Z",
    updatedAt: "2026-11-14T15:00:00Z",
  },
  {
    id: "tx_prev",
    amount: 999_000,
    date: "2026-10-28",
    type: "EXPENSE",
    categoryId: "cat_food",
    accountId: "acc_h",
    memberId: "HUSBAND",
    scope: "FAMILY",
    note: "Tháng trước",
    createdAt: "2026-10-28T12:00:00Z",
    updatedAt: "2026-10-28T12:00:00Z",
  },
];

test("normalizeReportMonthKey falls back to current month when ALL or invalid", () => {
  const fixed = new Date("2026-11-17T10:00:00Z");
  assert.equal(normalizeReportMonthKey("2026-11", fixed), "2026-11");
  assert.match(normalizeReportMonthKey("ALL", fixed), /^\d{4}-\d{2}$/);
});

test("buildMonthlyPdfReport aggregates monthly summary, couple settlement, categories, and rows", () => {
  const report = buildMonthlyPdfReport({
    transactions: TEST_TXS,
    categories: TEST_CATEGORIES,
    accounts: TEST_ACCOUNTS,
    monthKey: "2026-11",
    perspective: "ALL",
    settings: {
      husbandName: "Anh Chuột",
      wifeName: "Bé Mèo",
      sharedSplitRatioHusband: 50,
    },
    now: new Date("2026-11-17T12:30:00Z"),
  });

  assert.equal(report.monthKey, "2026-11");
  assert.equal(report.monthLabel, "Tháng 11/2026");
  assert.equal(report.summary.totalIncome, 30_000_000);
  assert.equal(report.summary.totalExpense, 8_500_000);
  assert.equal(report.summary.netSavings, 21_500_000);
  assert.equal(report.summary.savingsRate, 72);
  assert.equal(report.summary.transactionCount, 4);

  // Couple settlement on shared FAMILY expenses (6M husband + 2M wife = 8M total -> wife owes husband 2M)
  assert.equal(report.coupleSettlement.totalSharedExpense, 8_000_000);
  assert.equal(report.coupleSettlement.husbandPaid, 6_000_000);
  assert.equal(report.coupleSettlement.wifePaid, 2_000_000);
  assert.equal(report.coupleSettlement.fromMember, "WIFE");
  assert.equal(report.coupleSettlement.toMember, "HUSBAND");
  assert.equal(report.coupleSettlement.transferAmount, 2_000_000);

  // Top category breakdown sorted descending
  assert.equal(report.topExpenseCategories[0].categoryId, "cat_bills");
  assert.equal(report.topExpenseCategories[0].amount, 6_000_000);
  assert.equal(report.topExpenseCategories[1].categoryId, "cat_food");
  assert.equal(report.topExpenseCategories[1].amount, 2_500_000);

  // Rows sorted newest first and exclude October tx
  assert.equal(report.rows[0].id, "tx_4");
  assert.equal(report.rows[3].id, "tx_1");
  assert.ok(!report.rows.some((r) => r.id === "tx_prev"));
});

test("buildMonthlyPdfReport filters transaction rows by perspective while keeping couple settlement intact", () => {
  const report = buildMonthlyPdfReport({
    transactions: TEST_TXS,
    categories: TEST_CATEGORIES,
    accounts: TEST_ACCOUNTS,
    monthKey: "2026-11",
    perspective: "WIFE",
    settings: {
      husbandName: "Anh Chuột",
      wifeName: "Bé Mèo",
      sharedSplitRatioHusband: 50,
    },
  });

  assert.equal(report.summary.totalIncome, 0);
  assert.equal(report.summary.totalExpense, 2_500_000);
  assert.equal(report.rows.length, 2);
  assert.equal(report.coupleSettlement.totalSharedExpense, 8_000_000);
});
