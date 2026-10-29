import test from 'node:test';
import assert from 'node:assert/strict';
import { recalculateAccountBalances } from './storage';
import { Account, Transaction } from '@/types/finance';

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
