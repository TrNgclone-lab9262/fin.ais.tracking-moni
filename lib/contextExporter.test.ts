import test from "node:test";
import assert from "node:assert/strict";
import { generateAiContextMarkdown, maskAccountNumber } from "./contextExporter";
import {
  DEFAULT_ACCOUNTS,
  DEFAULT_BUDGETS,
  DEFAULT_DEBTS,
  DEFAULT_INVESTMENTS,
  DEFAULT_RECURRING_RULES,
  DEFAULT_SAVINGS_CHALLENGES,
  DEFAULT_SAVINGS_GOALS,
  DEFAULT_SETTINGS,
  DEFAULT_TRANSACTIONS,
} from "@/constants/mockData";
import { DEFAULT_CATEGORIES } from "@/constants/defaultCategories";
import { createDefaultSkyOneLoan } from "./mortgageEngine";

test("maskAccountNumber masks sensitive digits and keeps last 4 characters", () => {
  assert.equal(maskAccountNumber("8866102943", true), "****2943");
  assert.equal(maskAccountNumber("383.988.999.999", true), "****9999");
  assert.equal(maskAccountNumber("8866102943", false), "8866102943");
  assert.equal(maskAccountNumber(undefined, true), "Chưa khai báo");
});

test("generateAiContextMarkdown includes verified SKYONE A.12A.07 facts and masks sensitive account numbers by default", () => {
  const skyoneLoan = createDefaultSkyOneLoan("2026-11-18");
  const md = generateAiContextMarkdown(
    {
      accounts: DEFAULT_ACCOUNTS,
      categories: DEFAULT_CATEGORIES,
      transactions: DEFAULT_TRANSACTIONS,
      budgets: DEFAULT_BUDGETS,
      goals: DEFAULT_SAVINGS_GOALS,
      savingsChallenges: DEFAULT_SAVINGS_CHALLENGES,
      debts: DEFAULT_DEBTS,
      investments: DEFAULT_INVESTMENTS,
      recurringRules: DEFAULT_RECURRING_RULES,
      skyoneLoan,
      settings: DEFAULT_SETTINGS,
      selectedMonth: "2026-11",
      generatedAt: new Date(2026, 10, 18, 9, 0, 0),
    },
    { maskSensitiveInfo: true }
  );

  // Keeps unit code and exact verified HDMB & BIDV numbers
  assert.ok(md.includes("A.12A.07"));
  assert.ok(md.includes("1.573.480.430 đ"));
  assert.ok(md.includes("323.655.950 đ"));
  assert.ok(md.includes("1.101.436.304 đ"));
  assert.ok(md.includes("393.370.110 đ"));
  assert.ok(md.includes("28.925.479 đ"));
  assert.ok(md.includes("72.313.698 đ"));
  assert.ok(md.includes("662.226.193 đ"));

  // Masks BIDV account number (must not expose full 8866102943 when masked)
  assert.ok(md.includes("****2943"));
  assert.equal(md.includes("8866102943"), false);

  // Includes core financial sections
  assert.ok(md.includes("## 3. Tài Sản, Ví Ngân Hàng & Thẻ Tín Dụng"));
  assert.ok(md.includes("## 5. Khoản Cố Định Tự Động, Mục Tiêu, Nợ Ngoài & Đầu Tư"));
  assert.ok(md.includes("system_context.ts"));
});
