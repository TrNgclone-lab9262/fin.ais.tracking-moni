import { supabase, isSupabaseConfigured } from './supabaseClient';
import {
  Account,
  Category,
  Transaction,
  CategoryBudget,
  SavingsGoal,
  DebtItem,
  InvestmentItem,
  AppSettings,
  AppNotification,
} from '@/types/finance';

export interface SupabaseFullData {
  categories: Category[];
  accounts: Account[];
  transactions: Transaction[];
  budgets: CategoryBudget[];
  goals: SavingsGoal[];
  debts: DebtItem[];
  investments: InvestmentItem[];
  settings?: AppSettings;
  notifications?: AppNotification[];
}

export const supabaseService = {
  async fetchAllData(): Promise<SupabaseFullData | null> {
    return null;
  },
  async upsertTransaction(_tx: Transaction): Promise<boolean> {
    return true;
  },
  async deleteTransaction(_id: string): Promise<boolean> {
    return true;
  },
  async updateAccounts(_accounts: Account[]): Promise<boolean> {
    return true;
  },
  async upsertAccount(_account: Account): Promise<boolean> {
    return true;
  },
  async upsertBudget(_budget: CategoryBudget): Promise<boolean> {
    return true;
  },
  async upsertGoal(_goal: SavingsGoal): Promise<boolean> {
    return true;
  },
  async deleteGoal(_id: string): Promise<boolean> {
    return true;
  },
  async upsertDebt(_debt: DebtItem): Promise<boolean> {
    return true;
  },
  async deleteDebt(_id: string): Promise<boolean> {
    return true;
  },
  async upsertInvestment(_inv: InvestmentItem): Promise<boolean> {
    return true;
  },
  async deleteInvestment(_id: string): Promise<boolean> {
    return true;
  },
  async updateSettings(_settings: AppSettings): Promise<boolean> {
    return true;
  },
  async markNotificationRead(_id: string): Promise<boolean> {
    return true;
  },
};
