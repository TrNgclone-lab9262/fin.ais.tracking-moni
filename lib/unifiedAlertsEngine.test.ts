import test from "node:test";
import assert from "node:assert/strict";
import { buildUnifiedEcosystemAlerts } from "./unifiedAlertsEngine";
import { createDefaultSkyOneLoan } from "./mortgageEngine";
import { createDefaultGoldPortfolio } from "./goldEngine";
import { createDefaultInteriorStudio } from "./interiorFloorplan";
import { Account, BudgetProgressItem, RecurringRule } from "@/types/finance";

test("buildUnifiedEcosystemAlerts aggregates alerts across all 4 Sub-Apps and Outbox DLQ sorted by severity", () => {
  const now = new Date("2026-11-22T09:00:00");

  const accounts: Account[] = [
    {
      id: "acc_card_1",
      name: "BIDV JCB Anh Chuột",
      type: "CREDIT_CARD",
      owner: "HUSBAND",
      initialBalance: 0,
      currentBalance: 42_000_000, // 84% of 50M limit -> critical!
      creditLimit: 50_000_000,
      statementDay: 20,
      dueDay: 25, // due in 3 days!
      color: "#2563EB",
    },
  ];

  const budgetItems: BudgetProgressItem[] = [
    {
      categoryId: "cat_expense_food",
      categoryName: "Ăn uống",
      categoryColor: "#EF4444",
      limitAmount: 10_000_000,
      spentAmount: 11_500_000,
      remainingAmount: -1_500_000,
      percentage: 115,
    },
  ];

  const recurringRules: RecurringRule[] = [
    {
      id: "rec_1",
      name: "Tiền điện nước",
      amount: 1_500_000,
      type: "EXPENSE",
      categoryId: "cat_expense_bills",
      accountId: "acc_husband_bidv",
      memberId: "SHARED",
      scope: "FAMILY",
      dayOfMonth: 25,
      isActive: true,
      lastAppliedMonth: "2026-10",
    },
  ];

  const skyoneLoan = createDefaultSkyOneLoan();
  const goldPortfolio = createDefaultGoldPortfolio();
  // Trigger a gold price alert rule: set Bid above rule threshold
  goldPortfolio.quotes.NHAN_9999.buyPricePerChi = 10_500_000;
  goldPortfolio.quotes.NHAN_9999.sellPricePerChi = 10_700_000;
  goldPortfolio.alerts = [
    {
      id: "alert_test_gold",
      label: "Chốt lời Nhẫn 9999",
      category: "NHAN_9999",
      condition: "TARGET_BID_ABOVE",
      threshold: 9_800_000,
      enabled: true,
      createdAt: "2026-11-01T00:00:00Z",
    },
  ];

  const interiorStudio = createDefaultInteriorStudio();
  // Force a critical Snag List defect
  interiorStudio.handoverChecklist[0] = {
    ...interiorStudio.handoverChecklist[0],
    checked: false,
    status: "DEFECT_CRITICAL",
  };

  const alerts = buildUnifiedEcosystemAlerts({
    accounts,
    budgetItems,
    recurringRules,
    currentMonthKey: "2026-11",
    skyoneLoan,
    goldPortfolio,
    interiorStudio,
    failedOutboxCount: 2,
    now,
  });

  // Must include Outbox DLQ, FINANCE card & budget, GOLD price alert, INTERIOR snag defect
  assert.ok(alerts.some((a) => a.id === "sys-outbox-failed" && a.targetTab === "data_admin"));
  assert.ok(alerts.some((a) => a.app === "FINANCE" && a.targetTab === "accounts"));
  assert.ok(alerts.some((a) => a.app === "FINANCE" && a.targetTab === "planning"));
  assert.ok(alerts.some((a) => a.app === "GOLD" && a.targetTab === "PRICES"));
  assert.ok(alerts.some((a) => a.app === "INTERIOR" && a.targetTab === "CHECKLIST"));

  // Verify strict severity ordering: critical (0) <= warning (1) <= info (2)
  const rank = { critical: 0, warning: 1, info: 2 };
  for (let i = 1; i < alerts.length; i++) {
    assert.ok(
      rank[alerts[i - 1].severity] <= rank[alerts[i].severity],
      `Expected ${alerts[i - 1].severity} before ${alerts[i].severity}`
    );
  }
});
