import test from 'node:test';
import assert from 'node:assert/strict';
import {
  recalculateAccountBalances,
  buildSyncBundleJson,
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

test('Zod validation preserves Gold serial/certificate/priceHistory/alerts and Interior executionPhase/targetHandoverDate', () => {
  const base = createBaseState();
  base.goldPortfolio.lots[0] = {
    ...base.goldPortfolio.lots[0],
    serialNumber: 'SJC-999888',
    certificateCode: 'HD-PNJ-2026-101',
    storeName: 'PNJ Next Thủ Đức',
    purityLabel: '999.9 (24K)',
  };
  base.goldPortfolio.priceHistory = [
    {
      date: '2026-11-15',
      nhan9999BidPerChi: 9050000,
      nhan9999AskPerChi: 9200000,
      sjcBidPerChi: 9100000,
      sjcAskPerChi: 9300000,
      worldXauUsdPerOz: 2740,
      usdVndRate: 25450,
      portfolioBidValueVnd: 54300000,
      portfolioCostBasisVnd: 50000000,
      totalRemainingChi: 6,
      recordedAt: '2026-11-15T10:00:00.000Z',
    },
  ];
  base.goldPortfolio.alerts = [
    {
      id: 'alert_test_1',
      label: 'Chốt lời 9.8tr',
      category: 'NHAN_9999',
      condition: 'TARGET_BID_ABOVE',
      threshold: 9800000,
      enabled: true,
      createdAt: '2026-11-15T10:00:00.000Z',
    },
  ];
  base.interiorStudio.targetHandoverDate = '2027-09-15';
  base.interiorStudio.scenarios[0] = {
    ...base.interiorStudio.scenarios[0],
    isLockedBaseline: true,
    items: base.interiorStudio.scenarios[0].items.map((item, idx) =>
      idx === 0 ? { ...item, executionPhase: 'PHASE_2_UPGRADE' as const } : item
    ),
  };

  const parsed = parseSyncBundleText(buildSyncBundleJson(base));
  assert.equal(parsed.success, true, parsed.error);
  assert.ok(parsed.data);
  assert.equal(parsed.data.goldPortfolio.lots[0]?.serialNumber, 'SJC-999888');
  assert.equal(parsed.data.goldPortfolio.lots[0]?.certificateCode, 'HD-PNJ-2026-101');
  assert.equal(parsed.data.goldPortfolio.lots[0]?.storeName, 'PNJ Next Thủ Đức');
  assert.equal(parsed.data.goldPortfolio.lots[0]?.purityLabel, '999.9 (24K)');
  assert.equal(parsed.data.goldPortfolio.priceHistory?.length, 1);
  assert.equal(parsed.data.goldPortfolio.alerts?.length, 1);
  assert.equal(parsed.data.interiorStudio.targetHandoverDate, '2027-09-15');
  assert.equal(parsed.data.interiorStudio.scenarios[0]?.isLockedBaseline, true);
  assert.equal(
    parsed.data.interiorStudio.scenarios[0]?.items[0]?.executionPhase,
    'PHASE_2_UPGRADE'
  );
});

test('mergeFinanceData performs granular 2-device Smart Merge for Gold priceHistory/alerts and Interior scenarios/checklist', () => {
  const local = createBaseState();
  const partner = createBaseState();

  local.goldPortfolio.priceHistory = [
    {
      date: '2026-11-10',
      nhan9999BidPerChi: 9000000,
      nhan9999AskPerChi: 9150000,
      sjcBidPerChi: 9050000,
      sjcAskPerChi: 9250000,
      worldXauUsdPerOz: 2700,
      usdVndRate: 25400,
      portfolioBidValueVnd: 54000000,
      portfolioCostBasisVnd: 50000000,
      totalRemainingChi: 6,
      recordedAt: '2026-11-10T08:00:00.000Z',
    },
  ];
  partner.goldPortfolio.priceHistory = [
    {
      date: '2026-11-10',
      nhan9999BidPerChi: 9120000,
      nhan9999AskPerChi: 9260000,
      sjcBidPerChi: 9150000,
      sjcAskPerChi: 9350000,
      worldXauUsdPerOz: 2735,
      usdVndRate: 25450,
      portfolioBidValueVnd: 54720000,
      portfolioCostBasisVnd: 50000000,
      totalRemainingChi: 6,
      recordedAt: '2026-11-10T18:00:00.000Z',
    },
    {
      date: '2026-11-11',
      nhan9999BidPerChi: 9150000,
      nhan9999AskPerChi: 9300000,
      sjcBidPerChi: 9180000,
      sjcAskPerChi: 9380000,
      worldXauUsdPerOz: 2750,
      usdVndRate: 25460,
      portfolioBidValueVnd: 54900000,
      portfolioCostBasisVnd: 50000000,
      totalRemainingChi: 6,
      recordedAt: '2026-11-11T09:00:00.000Z',
    },
  ];
  partner.goldPortfolio.alerts = [
    ...(partner.goldPortfolio.alerts || []),
    {
      id: 'alert_partner_new',
      label: 'Cảnh báo vợ thêm',
      category: 'SJC_BAR',
      condition: 'SPREAD_ABOVE_PCT',
      threshold: 3.5,
      enabled: true,
      createdAt: '2026-11-11T10:00:00.000Z',
    },
  ];

  // Husband checks item 0, Wife checks item 1 on another device
  local.interiorStudio.handoverChecklist[0] = {
    ...local.interiorStudio.handoverChecklist[0],
    checked: true,
    note: 'Chồng đã kiểm cửa Lecmax',
    updatedAt: '2026-11-12T08:00:00.000Z',
  };
  partner.interiorStudio.handoverChecklist[1] = {
    ...partner.interiorStudio.handoverChecklist[1],
    checked: true,
    note: 'Vợ đã kiểm kính ban công',
    updatedAt: '2026-11-12T09:00:00.000Z',
  };

  // Partner adds a custom scenario
  const partnerScenario = {
    ...partner.interiorStudio.scenarios[0],
    id: 'scenario_partner_custom',
    name: 'Phương án C - Vợ đề xuất',
    updatedAt: '2026-11-12T10:00:00.000Z',
  };
  partner.interiorStudio.scenarios = [...partner.interiorStudio.scenarios, partnerScenario];

  const merged = mergeFinanceData(local, partner, {
    mode: 'MERGE',
    keepLocalSecurity: true,
  });

  // Gold priceHistory merged by date preferring newer recordedAt
  assert.equal(merged.goldPortfolio.priceHistory?.length, 2);
  const nov10 = merged.goldPortfolio.priceHistory?.find((p) => p.date === '2026-11-10');
  assert.equal(nov10?.nhan9999BidPerChi, 9120000);
  assert.ok(merged.goldPortfolio.alerts?.some((a) => a.id === 'alert_partner_new'));

  // Interior checklist retains BOTH husband's and wife's checks
  assert.equal(merged.interiorStudio.handoverChecklist[0]?.checked, true);
  assert.equal(merged.interiorStudio.handoverChecklist[1]?.checked, true);
  assert.equal(
    merged.interiorStudio.handoverChecklist[1]?.note,
    'Vợ đã kiểm kính ban công'
  );
  // Interior scenarios keeps partner's new scenario
  assert.ok(
    merged.interiorStudio.scenarios.some((s) => s.id === 'scenario_partner_custom')
  );
});

