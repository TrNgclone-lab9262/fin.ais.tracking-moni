import {
  Account,
  AccountType,
  AppSettings,
  Category,
  CategoryBudget,
  DebtItem,
  DebtType,
  ExpenseScope,
  FamilyMember,
  GoldPortfolioState,
  InteriorStudioState,
  InvestmentItem,
  InvestmentType,
  MortgageContract,
  RecurringRule,
  SavingsGoal,
  ThemeColor,
  Transaction,
  TransactionType,
} from "@/types/finance";
import {
  GoldPortfolioStateSchema,
  InteriorStudioStateSchema,
  MortgageContractSchema,
} from "@/lib/validations";

export interface DbCategory {
  household_id: string;
  id: string;
  name: string;
  type: string;
  color: string;
  icon: string | null;
  is_default: boolean;
  updated_at?: string;
}

export function mapDbToCategory(row: DbCategory): Category {
  return {
    id: row.id,
    name: row.name,
    type: row.type === "INCOME" ? "INCOME" : "EXPENSE",
    color: row.color,
    icon: row.icon || undefined,
    isDefault: Boolean(row.is_default),
  };
}

export function mapCategoryToDb(cat: Category, householdId: string): DbCategory {
  return {
    household_id: householdId,
    id: cat.id,
    name: cat.name,
    type: cat.type,
    color: cat.color,
    icon: cat.icon || null,
    is_default: Boolean(cat.isDefault),
    updated_at: new Date().toISOString(),
  };
}

export interface DbAccount {
  household_id: string;
  id: string;
  name: string;
  type: string;
  owner: string;
  is_salary_account: boolean;
  credit_limit: number | string;
  statement_day: number | null;
  due_day: number | null;
  initial_balance: number | string;
  current_balance: number | string;
  account_number: string | null;
  color: string | null;
  icon: string | null;
  updated_at?: string;
}

export function mapDbToAccount(row: DbAccount): Account {
  return {
    id: row.id,
    name: row.name,
    type: row.type as AccountType,
    owner: row.owner as FamilyMember,
    isSalaryAccount: Boolean(row.is_salary_account),
    creditLimit: Number(row.credit_limit) || 0,
    statementDay: row.statement_day ?? undefined,
    dueDay: row.due_day ?? undefined,
    initialBalance: Number(row.initial_balance) || 0,
    currentBalance: Number(row.current_balance) || 0,
    accountNumber: row.account_number || undefined,
    color: row.color || undefined,
    icon: row.icon || undefined,
  };
}

export function mapAccountToDb(acc: Account, householdId: string): DbAccount {
  return {
    household_id: householdId,
    id: acc.id,
    name: acc.name,
    type: acc.type,
    owner: acc.owner,
    is_salary_account: Boolean(acc.isSalaryAccount),
    credit_limit: acc.creditLimit ?? 0,
    statement_day: acc.statementDay ?? null,
    due_day: acc.dueDay ?? null,
    initial_balance: acc.initialBalance,
    current_balance: acc.currentBalance,
    account_number: acc.accountNumber || null,
    color: acc.color || null,
    icon: acc.icon || null,
    updated_at: new Date().toISOString(),
  };
}

export interface DbTransaction {
  household_id: string;
  id: string;
  amount: number | string;
  date: string;
  type: string;
  category_id: string | null;
  account_id: string;
  to_account_id: string | null;
  member_id: string;
  scope: string;
  note: string | null;
  tag: string | null;
  created_at: string;
  updated_at: string;
}

export function mapDbToTransaction(row: DbTransaction): Transaction {
  return {
    id: row.id,
    amount: Number(row.amount),
    date: row.date,
    type: row.type as TransactionType,
    categoryId: row.category_id || "",
    accountId: row.account_id,
    toAccountId: row.to_account_id || undefined,
    memberId: row.member_id as FamilyMember,
    scope: row.scope as ExpenseScope,
    note: row.note || undefined,
    tag: (row.tag as Transaction["tag"]) || "NORMAL",
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

export function mapTransactionToDb(tx: Transaction, householdId: string): DbTransaction {
  return {
    household_id: householdId,
    id: tx.id,
    amount: tx.amount,
    date: tx.date,
    type: tx.type,
    category_id: tx.categoryId || null,
    account_id: tx.accountId,
    to_account_id: tx.toAccountId || null,
    member_id: tx.memberId,
    scope: tx.scope,
    note: tx.note || null,
    tag: tx.tag || "NORMAL",
    created_at: tx.createdAt,
    updated_at: tx.updatedAt || new Date().toISOString(),
  };
}

export interface DbCategoryBudget {
  household_id: string;
  category_id: string;
  month: string;
  limit_amount: number | string;
  updated_at?: string;
}

export function mapDbToBudget(row: DbCategoryBudget): CategoryBudget {
  return {
    categoryId: row.category_id,
    month: row.month,
    limitAmount: Number(row.limit_amount),
  };
}

export function mapBudgetToDb(b: CategoryBudget, householdId: string): DbCategoryBudget {
  return {
    household_id: householdId,
    category_id: b.categoryId,
    month: b.month,
    limit_amount: b.limitAmount,
    updated_at: new Date().toISOString(),
  };
}

export interface DbSavingsGoal {
  household_id: string;
  id: string;
  name: string;
  target_amount: number | string;
  current_amount: number | string;
  deadline: string | null;
  icon: string | null;
  is_completed: boolean;
  member_id: string;
  updated_at?: string;
}

export function mapDbToGoal(row: DbSavingsGoal): SavingsGoal {
  return {
    id: row.id,
    name: row.name,
    targetAmount: Number(row.target_amount),
    currentAmount: Number(row.current_amount),
    deadline: row.deadline || undefined,
    icon: row.icon || undefined,
    isCompleted: Boolean(row.is_completed),
    memberId: (row.member_id as FamilyMember) || "SHARED",
  };
}

export function mapGoalToDb(g: SavingsGoal, householdId: string): DbSavingsGoal {
  return {
    household_id: householdId,
    id: g.id,
    name: g.name,
    target_amount: g.targetAmount,
    current_amount: g.currentAmount,
    deadline: g.deadline || null,
    icon: g.icon || null,
    is_completed: Boolean(g.isCompleted),
    member_id: g.memberId || "SHARED",
    updated_at: new Date().toISOString(),
  };
}

export interface DbDebt {
  household_id: string;
  id: string;
  name: string;
  type: string;
  total_amount: number | string;
  paid_amount: number | string;
  interest_rate: number | string;
  start_date: string;
  due_date: string;
  status: string;
  member_id: string;
  updated_at?: string;
}

export function mapDbToDebt(row: DbDebt): DebtItem {
  return {
    id: row.id,
    name: row.name,
    type: row.type as DebtType,
    totalAmount: Number(row.total_amount),
    paidAmount: Number(row.paid_amount),
    interestRate: Number(row.interest_rate) || 0,
    startDate: row.start_date,
    dueDate: row.due_date,
    status: row.status === "PAID" ? "PAID" : "ACTIVE",
    memberId: (row.member_id as FamilyMember) || "SHARED",
  };
}

export function mapDebtToDb(d: DebtItem, householdId: string): DbDebt {
  return {
    household_id: householdId,
    id: d.id,
    name: d.name,
    type: d.type,
    total_amount: d.totalAmount,
    paid_amount: d.paidAmount,
    interest_rate: d.interestRate,
    start_date: d.startDate,
    due_date: d.dueDate,
    status: d.status,
    member_id: d.memberId || "SHARED",
    updated_at: new Date().toISOString(),
  };
}

export interface DbInvestment {
  household_id: string;
  id: string;
  name: string;
  type: string;
  amount: number | string;
  current_value: number | string | null;
  expected_profit_rate: number | string;
  start_date: string;
  status: string;
  member_id: string;
  updated_at?: string;
}

export function mapDbToInvestment(row: DbInvestment): InvestmentItem {
  return {
    id: row.id,
    name: row.name,
    type: row.type as InvestmentType,
    amount: Number(row.amount),
    currentValue: row.current_value !== null ? Number(row.current_value) : undefined,
    expectedProfitRate: Number(row.expected_profit_rate) || 0,
    startDate: row.start_date,
    status: row.status === "CLOSED" ? "CLOSED" : "ACTIVE",
    memberId: (row.member_id as FamilyMember) || "SHARED",
  };
}

export function mapInvestmentToDb(inv: InvestmentItem, householdId: string): DbInvestment {
  return {
    household_id: householdId,
    id: inv.id,
    name: inv.name,
    type: inv.type,
    amount: inv.amount,
    current_value: inv.currentValue !== undefined ? inv.currentValue : null,
    expected_profit_rate: inv.expectedProfitRate,
    start_date: inv.startDate,
    status: inv.status,
    member_id: inv.memberId || "SHARED",
    updated_at: new Date().toISOString(),
  };
}

export interface DbRecurringRule {
  household_id: string;
  id: string;
  name: string;
  amount: number | string;
  type: string;
  category_id: string;
  account_id: string;
  to_account_id: string | null;
  member_id: string;
  scope: string;
  day_of_month: number;
  is_active: boolean;
  last_applied_month: string | null;
  note: string | null;
  updated_at?: string;
}

export function mapDbToRecurringRule(row: DbRecurringRule): RecurringRule {
  return {
    id: row.id,
    name: row.name,
    amount: Number(row.amount),
    type: row.type as TransactionType,
    categoryId: row.category_id,
    accountId: row.account_id,
    toAccountId: row.to_account_id || undefined,
    memberId: row.member_id as FamilyMember,
    scope: row.scope as ExpenseScope,
    dayOfMonth: Number(row.day_of_month) || 1,
    isActive: Boolean(row.is_active),
    lastAppliedMonth: row.last_applied_month || undefined,
    note: row.note || undefined,
  };
}

export function mapRecurringRuleToDb(
  rule: RecurringRule,
  householdId: string
): DbRecurringRule {
  return {
    household_id: householdId,
    id: rule.id,
    name: rule.name,
    amount: rule.amount,
    type: rule.type,
    category_id: rule.categoryId,
    account_id: rule.accountId,
    to_account_id: rule.toAccountId || null,
    member_id: rule.memberId,
    scope: rule.scope,
    day_of_month: rule.dayOfMonth,
    is_active: Boolean(rule.isActive),
    last_applied_month: rule.lastAppliedMonth || null,
    note: rule.note || null,
    updated_at: new Date().toISOString(),
  };
}

export interface DbSkyOneLoan {
  household_id: string;
  id: string;
  contract_data: unknown;
  updated_at?: string;
}

export function mapDbToSkyOneLoan(row: DbSkyOneLoan): MortgageContract | null {
  const parsed = MortgageContractSchema.safeParse(row.contract_data);
  if (!parsed.success) return null;
  return parsed.data;
}

export function mapSkyOneLoanToDb(
  contract: MortgageContract,
  householdId: string
): DbSkyOneLoan {
  return {
    household_id: householdId,
    id: contract.id || "skyone_default",
    contract_data: contract,
    updated_at: contract.updatedAt || new Date().toISOString(),
  };
}

export interface DbGoldPortfolio {
  household_id: string;
  id: string;
  portfolio_data: unknown;
  updated_at?: string;
}

export function mapDbToGoldPortfolio(row: DbGoldPortfolio): GoldPortfolioState | null {
  const parsed = GoldPortfolioStateSchema.safeParse(row.portfolio_data);
  if (!parsed.success) return null;
  return parsed.data;
}

export function mapGoldPortfolioToDb(
  portfolio: GoldPortfolioState,
  householdId: string
): DbGoldPortfolio {
  return {
    household_id: householdId,
    id: "gold_default",
    portfolio_data: portfolio,
    updated_at: portfolio.updatedAt || new Date().toISOString(),
  };
}

export interface DbInteriorStudio {
  household_id: string;
  id: string;
  studio_data: unknown;
  updated_at?: string;
}

export function mapDbToInteriorStudio(row: DbInteriorStudio): InteriorStudioState | null {
  const parsed = InteriorStudioStateSchema.safeParse(row.studio_data);
  if (!parsed.success) return null;
  return parsed.data;
}

export function mapInteriorStudioToDb(
  studio: InteriorStudioState,
  householdId: string
): DbInteriorStudio {
  return {
    household_id: householdId,
    id: "interior_a12a07",
    studio_data: studio,
    updated_at: studio.updatedAt || new Date().toISOString(),
  };
}

export interface DbHouseholdSettings {
  household_id: string;
  theme_color: string;
  currency: string;
  notifications_enabled: boolean;
  husband_name: string;
  wife_name: string;
  shared_split_ratio_husband: number | string;
  updated_at?: string;
}

export type SharedHouseholdSettings = Pick<
  AppSettings,
  | "themeColor"
  | "currency"
  | "notificationsEnabled"
  | "husbandName"
  | "wifeName"
  | "sharedSplitRatioHusband"
>;

export function extractSharedSettings(settings: AppSettings): SharedHouseholdSettings {
  return {
    themeColor: settings.themeColor,
    currency: "VND",
    notificationsEnabled: settings.notificationsEnabled,
    husbandName: settings.husbandName,
    wifeName: settings.wifeName,
    sharedSplitRatioHusband: settings.sharedSplitRatioHusband ?? 50,
  };
}

export function mapDbToSharedSettings(row: DbHouseholdSettings): SharedHouseholdSettings {
  return {
    themeColor: (row.theme_color as ThemeColor) || "blue",
    currency: "VND",
    notificationsEnabled: Boolean(row.notifications_enabled),
    husbandName: row.husband_name || "Anh Chuột",
    wifeName: row.wife_name || "Bé Mèo",
    sharedSplitRatioHusband: Number(row.shared_split_ratio_husband) || 50,
  };
}

export function mapSharedSettingsToDb(
  settings: AppSettings,
  householdId: string
): DbHouseholdSettings {
  return {
    household_id: householdId,
    theme_color: settings.themeColor,
    currency: settings.currency,
    notifications_enabled: settings.notificationsEnabled,
    husband_name: settings.husbandName,
    wife_name: settings.wifeName,
    shared_split_ratio_husband: settings.sharedSplitRatioHusband ?? 50,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Hợp nhất cài đặt chung từ Cloud nhưng bảo toàn tuyệt đối bảo mật cục bộ từng thiết bị
 * (Passcode SHA-256, WebAuthn Face ID, chế độ sáng/tối & ẩn số tiền riêng tư).
 */
export function mergeSharedSettingsWithLocal(
  local: AppSettings,
  remoteShared: SharedHouseholdSettings
): AppSettings {
  return {
    ...local,
    themeColor: remoteShared.themeColor,
    currency: remoteShared.currency,
    notificationsEnabled: remoteShared.notificationsEnabled,
    husbandName: remoteShared.husbandName,
    wifeName: remoteShared.wifeName,
    sharedSplitRatioHusband: remoteShared.sharedSplitRatioHusband,
  };
}
