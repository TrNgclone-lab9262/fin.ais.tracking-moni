import { z } from "zod";

export const FamilyMemberSchema = z.enum(["HUSBAND", "WIFE", "SHARED"]);
export const ExpenseScopeSchema = z.enum(["FAMILY", "PERSONAL"]);

export const TransactionInputSchema = z.object({
  amount: z
    .number()
    .positive("Số tiền phải lớn hơn 0")
    .max(1_000_000_000_000, "Số tiền quá lớn"),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày giao dịch phải có định dạng YYYY-MM-DD"),
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
  categoryId: z.string().min(1, "Vui lòng chọn danh mục"),
  accountId: z.string().min(1, "Vui lòng chọn tài khoản nguồn"),
  toAccountId: z.string().optional(),
  memberId: FamilyMemberSchema,
  scope: ExpenseScopeSchema,
  note: z.string().max(255, "Ghi chú không vượt quá 255 ký tự").optional(),
  tag: z.enum(["NORMAL", "DEBT", "INVESTMENT", "RECURRING"]).optional(),
});

export const CategorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(["INCOME", "EXPENSE"]),
  color: z.string().min(1),
  icon: z.string().optional(),
  isDefault: z.boolean().optional(),
});

export const AccountSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(["BANK", "CASH", "E_WALLET", "CREDIT_CARD"]),
  owner: FamilyMemberSchema,
  isSalaryAccount: z.boolean().optional(),
  creditLimit: z.number().optional(),
  statementDay: z.number().int().min(1).max(31).optional(),
  dueDay: z.number().int().min(1).max(31).optional(),
  initialBalance: z.number(),
  currentBalance: z.number(),
  accountNumber: z.string().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
});

export const TransactionSchema = z.object({
  id: z.string().min(1),
  amount: z.number().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
  categoryId: z.string().min(1),
  accountId: z.string().min(1),
  toAccountId: z.string().optional(),
  memberId: FamilyMemberSchema,
  scope: ExpenseScopeSchema,
  note: z.string().optional(),
  tag: z.enum(["NORMAL", "DEBT", "INVESTMENT", "RECURRING"]).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const RecurringRuleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  amount: z.number().positive(),
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
  categoryId: z.string().min(1),
  accountId: z.string().min(1),
  toAccountId: z.string().optional(),
  memberId: FamilyMemberSchema,
  scope: ExpenseScopeSchema,
  dayOfMonth: z.number().int().min(1).max(31),
  isActive: z.boolean(),
  lastAppliedMonth: z.string().optional(),
  note: z.string().optional(),
});

export const BudgetSchema = z.object({
  categoryId: z.string().min(1),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  limitAmount: z.number().positive(),
});

export const SavingsGoalSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  targetAmount: z.number().positive(),
  currentAmount: z.number().nonnegative(),
  deadline: z.string().optional(),
  icon: z.string().optional(),
  isCompleted: z.boolean(),
  memberId: FamilyMemberSchema.optional(),
});

export const DebtItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(["BORROW", "LEND"]),
  totalAmount: z.number().positive(),
  paidAmount: z.number().nonnegative(),
  interestRate: z.number().nonnegative(),
  startDate: z.string(),
  dueDate: z.string(),
  status: z.enum(["ACTIVE", "PAID"]),
  memberId: FamilyMemberSchema.optional(),
});

export const InvestmentItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(["GOLD", "SAVINGS", "STOCK", "OTHER"]),
  amount: z.number().positive(),
  currentValue: z.number().optional(),
  expectedProfitRate: z.number(),
  startDate: z.string(),
  status: z.enum(["ACTIVE", "CLOSED"]),
  memberId: FamilyMemberSchema.optional(),
});

export const MemberAuthConfigSchema = z.object({
  passcodeHash: z.string().optional(),
  passcodeSalt: z.string().optional(),
  webauthnCredentialId: z.string().optional(),
  webauthnDeviceLabel: z.string().optional(),
  wallpaperBlur: z.number().min(0).max(24).optional(),
  wallpaperDim: z.number().min(10).max(90).optional(),
  updatedAt: z.string().optional(),
});

export const AppSettingsSchema = z.object({
  themeColor: z.enum(["blue", "purple", "pink", "green", "orange"]),
  themeMode: z.enum(["light", "dark"]).optional(),
  currency: z.literal("VND"),
  notificationsEnabled: z.boolean(),
  husbandName: z.string(),
  wifeName: z.string(),
  sharedSplitRatioHusband: z.number().min(0).max(100).optional(),
  privacyMode: z.boolean().optional(),
  pinCode: z.string().optional(),
  requireAuthOnOpen: z.boolean().optional(),
  autoLockMinutes: z.number().min(0).max(120).optional(),
  lockOnBackground: z.boolean().optional(),
  authActiveProfile: z.enum(["HUSBAND", "WIFE"]).optional(),
  husbandAuth: MemberAuthConfigSchema.optional(),
  wifeAuth: MemberAuthConfigSchema.optional(),
  requireAuthForDangerActions: z.boolean().optional(),
});

export const MortgagePrepaymentPenaltyTierSchema = z.object({
  fromYear: z.number().int().min(1),
  toYear: z.number().int().min(1),
  feePercent: z.number().min(0).max(20),
});

export const MortgageRateAdjustmentSchema = z.object({
  id: z.string().min(1),
  effectiveFromPeriod: z.number().int().min(1),
  annualRate: z.number().min(0).max(50),
  effectiveDate: z.string(),
  note: z.string().optional(),
});

export const MortgagePaidInstallmentRecordSchema = z.object({
  period: z.number().int().min(1),
  paidAt: z.string(),
  paidPrincipal: z.number().nonnegative(),
  paidInterest: z.number().nonnegative(),
  appliedRate: z.number().min(0).max(50),
  linkedTransactionId: z.string().optional(),
  note: z.string().optional(),
});

export const MortgagePrepaymentEventSchema = z.object({
  id: z.string().min(1),
  date: z.string(),
  afterPeriod: z.number().int().min(0),
  amount: z.number().positive(),
  penaltyAmount: z.number().nonnegative(),
  feePercent: z.number().min(0).max(20),
  strategy: z.enum(["SHORTEN_TERM", "REDUCE_MONTHLY"]),
  linkedTransactionId: z.string().optional(),
  note: z.string().optional(),
});

export const MortgagePlannedDisbursementSchema = z.object({
  id: z.string().min(1),
  afterPeriod: z.number().int().min(0),
  date: z.string(),
  amount: z.number().nonnegative(),
  note: z.string().optional(),
});

export const MortgageContractSchema = z.object({
  id: z.string().min(1),
  projectName: z.string().min(1),
  unitCode: z.string().min(1),
  bankName: z.string().min(1),
  accountNumber: z.string().optional(),
  branchName: z.string().optional(),
  propertyValue: z.number().positive(),
  currentMarketValue: z.number().positive(),
  downPayment: z.number().nonnegative(),
  creditLimit: z.number().positive().optional(),
  loanAmount: z.number().positive(),
  termMonths: z.number().int().min(1).max(480),
  disbursementDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  paymentDayOfMonth: z.number().int().min(1).max(31),
  fixedRateMonths: z.number().int().min(0).max(480),
  fixedInterestRate: z.number().min(0).max(50),
  floatingBaseRate: z.number().min(0).max(50),
  floatingSpread: z.number().min(0).max(30),
  monthlyPrincipalOverride: z.number().nonnegative().optional(),
  interestBasis: z.enum(["ACTUAL_365", "THIRTY_360"]).optional(),
  prepayStrategyDefault: z.enum(["SHORTEN_TERM", "REDUCE_MONTHLY"]),
  prepaymentPenaltyTiers: z.array(MortgagePrepaymentPenaltyTierSchema),
  rateAdjustments: z.array(MortgageRateAdjustmentSchema),
  paidRecords: z.array(MortgagePaidInstallmentRecordSchema),
  prepayments: z.array(MortgagePrepaymentEventSchema),
  plannedDisbursements: z.array(MortgagePlannedDisbursementSchema).optional(),
  updatedAt: z.string(),
});

export const AppDataBackupSchema = z.object({
  version: z.string(),
  exportedAt: z.string(),
  categories: z.array(CategorySchema),
  accounts: z.array(AccountSchema).optional(),
  transactions: z.array(TransactionSchema),
  budgets: z.array(BudgetSchema).optional(),
  goals: z.array(SavingsGoalSchema).optional(),
  debts: z.array(DebtItemSchema).optional(),
  investments: z.array(InvestmentItemSchema).optional(),
  recurringRules: z.array(RecurringRuleSchema).optional(),
  settings: AppSettingsSchema.optional(),
  skyoneLoan: MortgageContractSchema.optional(),
});

export type TransactionInput = z.infer<typeof TransactionInputSchema>;
export type AppDataBackupValid = z.infer<typeof AppDataBackupSchema>;
