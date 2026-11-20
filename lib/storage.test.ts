import test from 'node:test';
import assert from 'node:assert/strict';
import {
  recalculateAccountBalances,
  parseSyncBundleText,
  previewMergeDiff,
  mergeFinanceData,
  StoredAppStateV3,
} from './storage';
import { Account, Transaction } from '@/types/finance';
import { DEFAULT_CATEGORIES } from '@/constants/defaultCategories';
import { DEFAULT_SETTINGS } from '@/constants/mockData';
import { createDefaultSkyOneLoan } from './mortgageEngine';
import { createDefaultGoldPortfolio } from './goldEngine';
import { createDefaultInteriorStudio } from './interiorFloorplan';

test('recalculateAccountBalances calculates bank and credit card balances accurately', () => {
  const accounts: Account[] = [
    {
      id: 'bank_1',
      name: 'Bank 1',
      owner: 'HUSBAND',
      type: 'BANK',
      initialBalance: 10000000,
      currentBalance: 0,
    },
    {
      id: 'credit_1',
      name: 'BIDV Credit',
      owner: 'HUSBAND',
      type: 'CREDIT_CARD',
      creditLimit: 50000000,
      initialBalance: 0,
      currentBalance: 0,
    },
  ];

  const transactions: Transaction[] = [
    {
      id: 'tx_1',
      amount: 2000000,
      date: '2026-10-01',
      type: 'EXPENSE',
      categoryId: 'cat_food',
      accountId: 'credit_1',
      memberId: 'HUSBAND',
      scope: 'FAMILY',
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
    },
    {
      id: 'tx_2',
      amount: 5000000,
      date: '2026-10-02',
      type: 'INCOME',
      categoryId: 'cat_salary',
      accountId: 'bank_1',
      memberId: 'HUSBAND',
      scope: 'FAMILY',
      createdAt: '2026-10-02T00:00:00Z',
      updatedAt: '2026-10-02T00:00:00Z',
    },
  ];

  const recalculated = recalculateAccountBalances(accounts, transactions);
  const bankAcc = recalculated.find(a => a.id === 'bank_1');
  const creditAcc = recalculated.find(a => a.id === 'credit_1');

  // Bank: 10M initial + 5M income = 15M
  assert.equal(bankAcc?.currentBalance, 15000000);
  // Credit: 0 initial + 2M expense = 2M used debt
  assert.equal(creditAcc?.currentBalance, 2000000);
});

function createBaseState(): StoredAppStateV3 {
  return {
    categories: DEFAULT_CATEGORIES,
    accounts: [
      {
        id: 'acc_h',
        name: 'Vietinbank Chồng',
        owner: 'HUSBAND',
        type: 'BANK',
        initialBalance: 10000000,
        currentBalance: 10000000,
      },
    ],
    transactions: [
      {
        id: 'tx_shared_1',
        amount: 500000,
        date: '2026-11-01',
        type: 'EXPENSE',
        categoryId: 'cat_expense_food',
        accountId: 'acc_h',
        memberId: 'HUSBAND',
        scope: 'FAMILY',
        note: 'Ăn tối',
        createdAt: '2026-11-01T12:00:00Z',
        updatedAt: '2026-11-01T12:00:00Z',
      },
    ],
    budgets: [{ categoryId: 'cat_expense_food', month: '2026-11', limitAmount: 5000000 }],
    goals: [],
    debts: [],
    investments: [],
    recurringRules: [],
    settings: {
      ...DEFAULT_SETTINGS,
      requireAuthOnOpen: true,
      requireAuthForDangerActions: true,
      husbandAuth: {
        passcodeHash: 'local_hash',
        passcodeSalt: 'local_salt',
        webauthnCredentialId: 'cred_local',
      },
    },
    skyoneLoan: createDefaultSkyOneLoan('2026-11-13'),
    goldPortfolio: createDefaultGoldPortfolio(),
    interiorStudio: createDefaultInteriorStudio(),
  };
}

test('mergeFinanceData deduplicates by id, recomputes balances, and preserves local security', () => {
  const local = createBaseState();
  const wifeBundle = createBaseState();
  wifeBundle.transactions.push({
    id: 'tx_wife_new',
    amount: 1500000,
    date: '2026-11-02',
    type: 'EXPENSE',
    categoryId: 'cat_expense_shopping',
    accountId: 'acc_h',
    memberId: 'WIFE',
    scope: 'FAMILY',
    note: 'Mua đồ nhà',
    createdAt: '2026-11-02T09:00:00Z',
    updatedAt: '2026-11-02T09:00:00Z',
  });
  wifeBundle.budgets.push({
    categoryId: 'cat_expense_shopping',
    month: '2026-11',
    limitAmount: 3000000,
  });
  wifeBundle.settings = {
    ...DEFAULT_SETTINGS,
    requireAuthOnOpen: false,
    husbandAuth: {
      passcodeHash: 'remote_hash_should_not_overwrite',
      passcodeSalt: 'remote_salt',
    },
  };

  const diff = previewMergeDiff(local, wifeBundle);
  assert.equal(diff.newTransactions, 1);
  assert.equal(diff.newBudgets, 1);
  assert.equal(diff.totalNewItems, 2);

  const merged = mergeFinanceData(local, wifeBundle, {
    mode: 'MERGE',
    keepLocalSecurity: true,
  });

  // Should contain tx_shared_1 (once) + tx_wife_new
  assert.equal(merged.transactions.length, 2);
  // Balance: 10,000,000 - 500,000 - 1,500,000 = 8,000,000
  assert.equal(merged.accounts[0]?.currentBalance, 8000000);
  // Local security preserved
  assert.equal(merged.settings.husbandAuth?.passcodeHash, 'local_hash');
  assert.equal(merged.settings.husbandAuth?.webauthnCredentialId, 'cred_local');
  assert.equal(merged.settings.requireAuthForDangerActions, true);
});

test('parseSyncBundleText rejects malformed JSON and accepts valid backup JSON', () => {
  const bad = parseSyncBundleText('not-json');
  assert.equal(bad.success, false);

  const validJson = JSON.stringify({
    version: '4.0',
    exportedAt: '2026-11-13T00:00:00Z',
    categories: DEFAULT_CATEGORIES,
    transactions: [],
  });
  const good = parseSyncBundleText(validJson);
  assert.equal(good.success, true);
  assert.ok(good.data);
  assert.ok(good.data.skyoneLoan);
});

test('mergeFinanceData merges skyoneLoan paidRecords and prepayments without duplicates', () => {
  const local = createBaseState();
  const partner = createBaseState();

  const nextPeriod =
    (local.skyoneLoan.paidRecords[local.skyoneLoan.paidRecords.length - 1]?.period || 0) + 1;

  partner.skyoneLoan = {
    ...partner.skyoneLoan,
    paidRecords: [
      ...partner.skyoneLoan.paidRecords,
      {
        period: nextPeriod,
        paidAt: '2026-11-15',
        paidPrincipal: 6270833,
        paidInterest: 8172639,
        appliedRate: 6.8,
        note: 'Vợ xác nhận đóng trên máy khác',
      },
    ],
    prepayments: [
      {
        id: 'prepay_partner_1',
        date: '2026-11-16',
        afterPeriod: nextPeriod,
        amount: 50000000,
        penaltyAmount: 750000,
        feePercent: 1.5,
        strategy: 'SHORTEN_TERM',
        note: 'Thưởng cuối năm',
      },
    ],
    updatedAt: '2026-11-16T10:00:00Z',
  };

  const diff = previewMergeDiff(local, partner);
  assert.equal(diff.newMortgagePaidRecords, 1);
  assert.equal(diff.newMortgagePrepayments, 1);
  assert.equal(diff.totalNewItems, 2);

  const merged = mergeFinanceData(local, partner, {
    mode: 'MERGE',
    keepLocalSecurity: true,
  });

  assert.equal(merged.skyoneLoan.paidRecords.length, local.skyoneLoan.paidRecords.length + 1);
  assert.equal(merged.skyoneLoan.prepayments.length, 1);
  assert.equal(merged.skyoneLoan.prepayments[0]?.id, 'prepay_partner_1');
});
