export type TransactionType = 'INCOME' | 'EXPENSE' | 'TRANSFER';

export type AccountType = 'BANK' | 'CASH' | 'E_WALLET' | 'CREDIT_CARD';

export type DebtType = 'BORROW' | 'LEND';

export type InvestmentType = 'GOLD' | 'SAVINGS' | 'STOCK' | 'OTHER';

export type ThemeColor = 'blue' | 'purple' | 'pink' | 'green' | 'orange';

export type ThemeMode = 'light' | 'dark';

export type FamilyMember = 'HUSBAND' | 'WIFE' | 'SHARED';

export type ExpenseScope = 'FAMILY' | 'PERSONAL';

export interface Category {
  id: string;
  name: string;
  type: 'INCOME' | 'EXPENSE';
  color: string;
  icon?: string;
  isDefault?: boolean;
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  owner: FamilyMember;       // Chồng | Vợ | Chung
  isSalaryAccount?: boolean; // Tài khoản nhận lương chính
  creditLimit?: number;      // Hạn mức thẻ tín dụng (50tr Chồng, 20tr Vợ)
  statementDay?: number;     // Ngày chốt sao kê (mặc định 20)
  dueDay?: number;           // Ngày đến hạn thanh toán (mặc định 6)
  initialBalance: number;
  currentBalance: number;    // Với thẻ tín dụng: dư nợ đang dùng
  accountNumber?: string;
  icon?: string;
  color?: string;
}

export interface Transaction {
  id: string;
  amount: number;
  date: string;               // YYYY-MM-DD
  type: TransactionType;
  categoryId: string;
  accountId: string;          // Ví nguồn
  toAccountId?: string;       // Ví đích
  memberId: FamilyMember;     // Ai là người thực hiện (Chồng hay Vợ)
  scope: ExpenseScope;        // Chi cho việc chung gia đình hay cá nhân
  note?: string;
  tag?: 'NORMAL' | 'DEBT' | 'INVESTMENT' | 'RECURRING';
  createdAt: string;
  updatedAt: string;
}

export interface RecurringRule {
  id: string;
  name: string;
  amount: number;
  type: TransactionType;
  categoryId: string;
  accountId: string;
  toAccountId?: string;
  memberId: FamilyMember;
  scope: ExpenseScope;
  dayOfMonth: number;
  isActive: boolean;
  lastAppliedMonth?: string;
  note?: string;
}

export interface CategoryBudget {
  categoryId: string;
  month: string;              // YYYY-MM
  limitAmount: number;
}

export interface BudgetProgressItem {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  limitAmount: number;
  spentAmount: number;
  remainingAmount: number;
  percentage: number;
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string;
  icon?: string;
  isCompleted: boolean;
  memberId?: FamilyMember;
}

export interface DebtItem {
  id: string;
  name: string;
  type: DebtType;
  totalAmount: number;
  paidAmount: number;
  interestRate: number;
  startDate: string;
  dueDate: string;
  status: 'ACTIVE' | 'PAID';
  memberId?: FamilyMember;
}

export interface InvestmentItem {
  id: string;
  name: string;
  type: InvestmentType;
  amount: number;
  currentValue?: number;
  expectedProfitRate: number;
  startDate: string;
  status: 'ACTIVE' | 'CLOSED';
  memberId?: FamilyMember;
}

export type AuthMemberId = 'HUSBAND' | 'WIFE';

export interface MemberAuthConfig {
  passcodeHash?: string;
  passcodeSalt?: string;
  webauthnCredentialId?: string;
  webauthnDeviceLabel?: string;
  wallpaperBlur?: number;  // 0 | 8 | 16 px
  wallpaperDim?: number;   // 35 | 55 | 75 %
  updatedAt?: string;
}

export interface AppSettings {
  themeColor: ThemeColor;
  themeMode?: ThemeMode;
  currency: 'VND';
  notificationsEnabled: boolean;
  husbandName: string;
  wifeName: string;
  sharedSplitRatioHusband?: number; // % đóng góp quỹ chung của Chồng (mặc định 50)
  privacyMode?: boolean;            // Ẩn số tiền nhạy cảm
  pinCode?: string;                 // Legacy PIN 4 số (tự động nâng cấp sang passcodeHash)
  requireAuthOnOpen?: boolean;      // Yêu cầu xác thực /login mỗi khi mở ứng dụng
  autoLockMinutes?: number;         // Tự động khóa sau X phút không thao tác (0 = tắt)
  lockOnBackground?: boolean;       // Tự động khóa khi ẩn ứng dụng xuống nền
  authActiveProfile?: AuthMemberId; // Hồ sơ đăng nhập gần nhất trên /login
  husbandAuth?: MemberAuthConfig;   // Cấu hình Code, Face ID & nền khóa của Anh Chuột
  wifeAuth?: MemberAuthConfig;      // Cấu hình Code, Face ID & nền khóa của Bé Mèo
  requireAuthForDangerActions?: boolean; // Hỏi mã Code / Face ID cho thao tác nguy hiểm (Reset, xóa hàng loạt, ghi đè)
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'warning' | 'info' | 'danger';
  date: string;
  read: boolean;
}

export type MortgageStage = 'FIXED' | 'FLOATING';

export type MortgagePrepayStrategy = 'SHORTEN_TERM' | 'REDUCE_MONTHLY';

export type MortgageInstallmentStatus = 'PAID' | 'DUE_SOON' | 'OVERDUE' | 'UPCOMING';

export type MortgageInterestBasis = 'ACTUAL_365' | 'THIRTY_360';

export interface MortgagePrepaymentPenaltyTier {
  fromYear: number;
  toYear: number;
  feePercent: number;
}

export interface MortgageRateAdjustment {
  id: string;
  effectiveFromPeriod: number;
  annualRate: number;
  effectiveDate: string;
  note?: string;
}

export interface MortgagePaidInstallmentRecord {
  period: number;
  paidAt: string;
  paidPrincipal: number;
  paidInterest: number;
  appliedRate: number;
  linkedTransactionId?: string;
  note?: string;
  isVerified?: boolean;
  verifiedSource?: string;
}

export interface MortgagePrepaymentEvent {
  id: string;
  date: string;
  afterPeriod: number;
  amount: number;
  penaltyAmount: number;
  feePercent: number;
  strategy: MortgagePrepayStrategy;
  linkedTransactionId?: string;
  note?: string;
}

export interface MortgagePlannedDisbursement {
  id: string;
  afterPeriod: number;
  date: string;
  amount: number;
  note?: string;
}

export interface MortgagePeriodCashflowOverride {
  period: number;
  principal?: number;
  interest?: number;
  appliedRate?: number;
  paidAt?: string;
  note?: string;
}

export interface MortgageContract {
  id: string;
  projectName: string;
  unitCode: string;
  bankName: string;
  accountNumber?: string;
  branchName?: string;
  propertyValue: number;
  currentMarketValue: number;
  downPayment: number;
  creditLimit?: number;
  loanAmount: number;
  termMonths: number;
  disbursementDate: string;
  paymentDayOfMonth: number;
  fixedRateMonths: number;
  fixedInterestRate: number;
  floatingBaseRate: number;
  floatingSpread: number;
  monthlyPrincipalOverride?: number;
  interestBasis?: MortgageInterestBasis;
  prepayStrategyDefault: MortgagePrepayStrategy;
  prepaymentPenaltyTiers: MortgagePrepaymentPenaltyTier[];
  rateAdjustments: MortgageRateAdjustment[];
  paidRecords: MortgagePaidInstallmentRecord[];
  prepayments: MortgagePrepaymentEvent[];
  plannedDisbursements?: MortgagePlannedDisbursement[];
  cashflowLocked?: boolean;
  periodOverrides?: MortgagePeriodCashflowOverride[];
  updatedAt: string;
}

export interface AppDataBackup {
  version: '3.0' | '4.0';
  exportedAt: string;
  categories: Category[];
  accounts: Account[];
  transactions: Transaction[];
  budgets: CategoryBudget[];
  goals: SavingsGoal[];
  debts: DebtItem[];
  investments: InvestmentItem[];
  recurringRules?: RecurringRule[];
  settings: AppSettings;
  skyoneLoan?: MortgageContract;
}

export interface FinancialSummary {
  currentBalance: number;   // Số dư khả dụng (Tiền trong các ví ngân hàng + tiền mặt)
  netWorth: number;         // Tài sản ròng = Số dư ví + Đầu tư - Nợ - Dư nợ thẻ tín dụng
  monthlyIncome: number;    // Tổng thu nhập gia đình
  monthlyExpense: number;   // Tổng chi tiêu gia đình
  savingsAmount: number;    // Tiết kiệm tháng = Thu - Chi
  savingsRate: number;      // % Tiết kiệm
  totalDebt: number;        // Nợ ngoài
  totalInvested: number;    // Tiền đang đầu tư

  // Phân tích thành viên
  husbandIncome: number;
  wifeIncome: number;
  husbandExpense: number;
  wifeExpense: number;
  familySharedExpense: number;
  totalCreditDebt: number;  // Tổng dư nợ thẻ BIDV Credit của cả 2
}

export interface CategoryExpenseStat {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  totalAmount: number;
  percentage: number;
}

export type SubAppId = 'LAUNCHER' | 'FINANCE' | 'SKYONE';

export type FinanceTab =
  | 'overview'
  | 'transactions'
  | 'accounts'
  | 'planning'
  | 'debts_invest'
  | 'data_admin'
  | 'guide'
  | 'settings';

export type SkyOneSubTab = 'OVERVIEW' | 'ADVISOR' | 'CASHFLOW' | 'SCHEDULE' | 'PREPAYMENT' | 'CONTRACT';

export type SkyOneRouteTab = SkyOneSubTab | 'DATA_ADMIN' | 'SETTINGS';

export interface SkyOneTransactionLink {
  kind: 'INSTALLMENT' | 'PREPAYMENT';
  period?: number;
  prepaymentId?: string;
  label: string;
}

