"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  ReactNode,
} from "react";
import { flushSync } from "react-dom";
import {
  runThemeCircularReveal,
  ThemeTransitionTriggerEvent,
} from "@/lib/themeTransition";
import {
  Category,
  Account,
  Transaction,
  CategoryBudget,
  SavingsGoal,
  DebtItem,
  InvestmentItem,
  AppSettings,
  AppNotification,
  TransactionType,
  FinancialSummary,
  CategoryExpenseStat,
  FamilyMember,
  ExpenseScope,
  RecurringRule,
  AuthMemberId,
  MemberAuthConfig,
  MortgageContract,
  MortgagePaidInstallmentRecord,
  MortgagePrepayStrategy,
  MortgageRateAdjustment,
  ThemeMode,
  SubAppId,
  FinanceTab,
  SkyOneRouteTab,
  GoldRouteTab,
  InteriorRouteTab,
  SkyOneTransactionLink,
  BudgetProgressItem,
  MortgagePeriodCashflowOverride,
  QuickAuthViewId,
  SavingsChallenge,
  GoldCategory,
  GoldDcaPlan,
  GoldLot,
  GoldMacroContext,
  GoldPortfolioState,
  GoldPriceQuote,
  GoldSaleEvent,
  GoldSalePurpose,
  InteriorBoqPaymentRecord,
  InteriorBoqPaymentStage,
  InteriorDesignScenario,
  InteriorDoorMode,
  InteriorExtraBoqItem,
  InteriorFloorPattern,
  InteriorFurnitureItem,
  InteriorLightingZones,
  InteriorMepPoint,
  InteriorProcurementStatus,
  InteriorStudioState,
  InteriorStylePreset,
  InteriorWallOverride,
} from "@/types/finance";
import {
  loadStoredDataV3,
  saveStoredDataV3,
  seedInitialDataV3,
  exportDataToJsonV3,
  exportTransactionsToCsv,
  importDataFromJsonV3,
  recalculateAccountBalances,
  buildSyncBundleJson,
  parseSyncBundleText,
  previewMergeDiff,
  mergeFinanceData,
  MergeDiffPreview,
  MergeOptions,
  StoredAppStateV3,
} from "@/lib/storage";
import { formatVNDMasked, getCurrentMonthKey } from "@/lib/formatters";
import { DEFAULT_CATEGORIES } from "@/constants/defaultCategories";
import {
  DEFAULT_ACCOUNTS,
  DEFAULT_BUDGETS,
  DEFAULT_SAVINGS_GOALS,
  DEFAULT_DEBTS,
  DEFAULT_INVESTMENTS,
  DEFAULT_SETTINGS,
  DEFAULT_RECURRING_RULES,
  DEFAULT_SAVINGS_CHALLENGES,
} from "@/constants/mockData";
import {
  calculateDaysRemainingInMonth,
  calculateTodaySpent,
  calculateCreditCardCycleInfo,
  calculateCoupleSettlement,
  shiftMonthKey,
  CoupleSettlementResult,
  CreditCardCycleStatus,
} from "@/lib/financeEngine";
import { restoreDefaultCategoriesList } from "@/lib/categoryUtils";
import {
  hashPasscode,
  verifyPasscode,
  hasAnyAppPasscode,
  hasAnyAuthCredential,
  isQuickAuthViewProtected,
  getMemberAuthConfig,
} from "@/lib/authSecurity";
import {
  MAX_MORTGAGE_TERM_MONTHS,
  applyActualPaymentDateOverrides,
  createDefaultSkyOneLoan,
  generateMortgageSchedule,
  getTodayIsoDate,
  reconcileBidvSkyOneContract,
  simulatePrepayment,
  togglePinkBook5PctDisbursement,
} from "@/lib/mortgageEngine";
import {
  allocateFifoGoldSale,
  allocateSpecificLotSale,
  computeGoldPortfolioMetrics,
  createDefaultGoldPortfolio,
} from "@/lib/goldEngine";
import {
  DEFAULT_LIGHTING_ZONES,
  createDefaultInteriorStudio,
  createDefaultSkyOneA2MepPoints,
  resolveFinishForStylePreset,
} from "@/lib/interiorFloorplan";
import { calculateFurnitureItemCostVnd } from "@/lib/interiorBoqEngine";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import {
  supabaseService,
  CloudUser,
  CloudProfile,
  HouseholdInfo,
  CloudFullData,
} from "@/lib/supabaseService";
import { mergeSharedSettingsWithLocal } from "@/lib/supabaseMappers";
import {
  CloudMutation,
  enqueueOutboxMutation,
  loadOutboxQueue,
  saveOutboxQueue,
  clearOutboxQueue,
} from "@/lib/offlineOutbox";
import {
  parseAppRoute,
  buildAppPath,
  getAppDocumentTitle,
  saveActiveApp,
} from "@/lib/appRouting";
import {
  BrowserNotificationStatus,
  UnifiedDueReminder,
  buildUnifiedDueReminders,
  findInstallmentReminders,
  findRecurringExpenseReminders,
  getBrowserNotificationPermission,
  isBrowserNotificationOptedIn,
  requestBrowserNotificationAccess,
  setBrowserNotificationOptIn,
  triggerBudgetThresholdNotifications,
  triggerRecurringExpenseNotifications,
} from "@/lib/browserNotifications";
import {
  RecurringHistorySuggestion,
  detectRecurringSuggestionsFromHistory,
  evaluateAutoPostCandidates,
} from "@/lib/recurringAutomation";

export interface AutoPostNotice {
  monthKey: string;
  postedNames: string[];
  skippedNames: string[];
  postedCount: number;
  skippedCount: number;
}

export interface QuickRecordUndoEntry {
  id: string;
  kind: "RECURRING_RULE" | "MORTGAGE_INSTALLMENT";
  label: string;
  amount: number;
  monthKey: string;
  ruleId?: string;
  transactionId?: string;
  previousLastAppliedMonth?: string;
  installmentPeriod?: number;
  createdAt: number;
}

export type NavTab = FinanceTab;

export type PerspectiveMode = "ALL" | "HUSBAND" | "WIFE";

export interface TransactionInput {
  amount: number;
  date: string;
  type: TransactionType;
  categoryId: string;
  accountId: string;
  toAccountId?: string;
  memberId: FamilyMember;
  scope: ExpenseScope;
  note?: string;
  tag?: "NORMAL" | "DEBT" | "INVESTMENT" | "RECURRING";
}

interface MonthlyTrendItem {
  month: string;
  label: string;
  income: number;
  expense: number;
}

interface BudgetSummary {
  totalBudget: number;
  totalSpent: number;
  remaining: number;
  daysRemaining: number;
  dailyAllowance: number;
  items: BudgetProgressItem[];
}

export type CreditCardInfo = CreditCardCycleStatus;

interface FinanceContextType {
  isLoaded: boolean;
  activeApp: SubAppId;
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  skyoneTab: SkyOneRouteTab;
  setSkyoneTab: (tab: SkyOneRouteTab, highlightPeriod?: number | null) => void;
  skyoneHighlightPeriod: number | null;
  clearSkyoneHighlightPeriod: () => void;
  goldTab: GoldRouteTab;
  setGoldTab: (tab: GoldRouteTab) => void;
  interiorTab: InteriorRouteTab;
  setInteriorTab: (tab: InteriorRouteTab) => void;
  switchSubApp: (
    app: SubAppId,
    options?: {
      financeTab?: FinanceTab;
      skyoneTab?: SkyOneRouteTab;
      goldTab?: GoldRouteTab;
      interiorTab?: InteriorRouteTab;
      highlightPeriod?: number | null;
    }
  ) => void;
  openAppLauncher: () => void;
  getSkyOneLinkForTransaction: (txId: string) => SkyOneTransactionLink | undefined;

  // Trạng thái Cloud Database, Hồ sơ Profile, Tổ ấm & Realtime
  isSupabaseEnvReady: boolean;
  cloudUser: CloudUser | null;
  cloudProfile: CloudProfile | null;
  household: HouseholdInfo | null;
  isCloudConnected: boolean;
  isSyncing: boolean;
  lastSyncedAt: Date | null;
  pendingOutboxCount: number;
  cloudError: string | null;
  clearCloudError: () => void;
  syncWithCloud: () => Promise<void>;
  signInCloud: (email: string, password: string) => Promise<boolean>;
  signUpCloud: (
    email: string,
    password: string,
    profileMeta?: { displayName?: string; memberSlot?: AuthMemberId }
  ) => Promise<{ ok: boolean; needsEmailConfirm?: boolean; alreadyRegistered?: boolean }>;
  resendSignupConfirmationCloud: (email: string) => Promise<boolean>;
  updateCloudProfile: (patch: {
    displayName?: string;
    memberSlot?: AuthMemberId;
  }) => Promise<boolean>;
  sendMagicLinkCloud: (email: string) => Promise<boolean>;
  signOutCloud: () => Promise<void>;
  createCloudHousehold: (name: string, memberSlot: AuthMemberId) => Promise<boolean>;
  joinCloudHousehold: (inviteCode: string, memberSlot: AuthMemberId) => Promise<boolean>;
  rotateHouseholdInviteCode: () => Promise<string | null>;
  leaveCloudHousehold: () => Promise<boolean>;
  pushLocalStateToCloud: () => Promise<boolean>;

  // Góc nhìn thành viên (Cả nhà / Chồng / Vợ)
  activePerspective: PerspectiveMode;
  setActivePerspective: (mode: PerspectiveMode) => void;

  // Chế độ sáng/tối & Riêng tư, /login & Khóa bảo mật đa thành viên
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode, event?: ThemeTransitionTriggerEvent) => void;
  toggleThemeMode: (event?: ThemeTransitionTriggerEvent) => void;
  isPrivacyMode: boolean;
  togglePrivacyMode: () => void;
  isAppLocked: boolean;
  hasPasscodeProtection: boolean;
  hasAuthCredential: boolean;
  unlockedProtectedViews: QuickAuthViewId[];
  isViewProtectedByQuickAuth: (view: QuickAuthViewId) => boolean;
  isViewUnlockedInSession: (view: QuickAuthViewId) => boolean;
  unlockProtectedView: (view: QuickAuthViewId) => void;
  toggleQuickAuthView: (view: QuickAuthViewId, enabled: boolean) => void;
  verifyMemberPasscode: (member: AuthMemberId, code: string) => Promise<boolean>;
  unlockWithPasscode: (member: AuthMemberId, code: string) => Promise<boolean>;
  unlockWithBiometricSuccess: (member: AuthMemberId, switchPerspective?: boolean) => void;
  setMemberPasscode: (
    member: AuthMemberId,
    newCode: string,
    options?: { enableEntryLock?: boolean }
  ) => Promise<void>;
  clearMemberPasscode: (member: AuthMemberId) => void;
  updateMemberAuthConfig: (member: AuthMemberId, patch: Partial<MemberAuthConfig>) => void;
  lockApp: () => void;
  bypassLockForFirstSetup: (member: AuthMemberId) => void;

  categories: Category[];
  accounts: Account[];
  transactions: Transaction[];
  budgets: CategoryBudget[];
  goals: SavingsGoal[];
  debts: DebtItem[];
  investments: InvestmentItem[];
  recurringRules: RecurringRule[];
  savingsChallenges: SavingsChallenge[];
  settings: AppSettings;
  notifications: AppNotification[];
  unifiedDueReminders: UnifiedDueReminder[];
  quickRecordUndo: QuickRecordUndoEntry | null;
  quickApplyRecurringNotification: (ruleId: string, monthKey?: string) => Transaction | null;
  quickPayInstallmentNotification: (period: number) => boolean;
  undoLastQuickRecord: () => boolean;
  dismissQuickRecordUndo: () => void;

  // Browser Notifications (>80% hạn mức ngân sách tháng)
  browserNotifStatus: BrowserNotificationStatus;
  browserNotifEnabled: boolean;
  enableBrowserNotifications: () => Promise<boolean>;
  disableBrowserNotifications: () => void;

  // Bộ lọc
  selectedMonth: string;
  selectedCategory: string;
  selectedType: "ALL" | TransactionType;
  selectedAccount: string;
  searchQuery: string;

  setSelectedMonth: (month: string) => void;
  setSelectedCategory: (catId: string) => void;
  setSelectedType: (type: "ALL" | TransactionType) => void;
  setSelectedAccount: (accId: string) => void;
  setSearchQuery: (query: string) => void;

  // CRUD Danh mục
  addCategory: (cat: Omit<Category, "id">) => Category;
  updateCategory: (id: string, cat: Partial<Category>) => void;
  deleteCategory: (id: string) => void;
  toggleCategoryVisibility: (id: string) => void;
  restoreDefaultCategories: () => number;

  // CRUD Giao dịch
  addTransaction: (data: TransactionInput) => Transaction;
  addTransactionsBatch: (items: TransactionInput[]) => Transaction[];
  updateTransaction: (id: string, data: Partial<TransactionInput>) => void;
  deleteTransaction: (id: string) => void;
  deleteTransactionsBatch: (ids: string[]) => void;

  // Quản lý Tài khoản (Ví)
  addAccount: (acc: Omit<Account, "id" | "currentBalance">) => void;
  updateAccount: (id: string, acc: Partial<Account>) => void;
  deleteAccount: (id: string) => void;

  // Quản lý Ngân sách & Mục tiêu
  setCategoryBudget: (categoryId: string, limitAmount: number, month?: string) => void;
  deleteBudget: (categoryId: string, month?: string) => void;
  copyBudgetsFromMonth: (fromMonth: string, toMonth: string) => number;
  addGoal: (goal: Omit<SavingsGoal, "id" | "isCompleted">) => void;
  updateGoal: (id: string, goal: Partial<SavingsGoal>) => void;
  deleteGoal: (id: string) => void;
  depositGoal: (id: string, amount: number, sourceAccountId?: string) => void;
  addSavingsChallenge: (
    challenge: Omit<SavingsChallenge, "id" | "createdAt">
  ) => SavingsChallenge;
  updateSavingsChallenge: (id: string, patch: Partial<SavingsChallenge>) => void;
  deleteSavingsChallenge: (id: string) => void;
  contributeSavingsChallenge: (id: string, deltaAmount: number) => void;

  // Quản lý Nợ & Đầu tư
  addDebt: (debt: Omit<DebtItem, "id">) => void;
  updateDebt: (id: string, debt: Partial<DebtItem>) => void;
  payDebt: (id: string, amount: number, sourceAccountId?: string) => void;
  deleteDebt: (id: string) => void;

  addInvestment: (inv: Omit<InvestmentItem, "id">) => void;
  updateInvestment: (id: string, inv: Partial<InvestmentItem>) => void;
  deleteInvestment: (id: string) => void;

  // Quản lý Giao dịch Định kỳ & Tự động ghi sổ
  addRecurringRule: (rule: Omit<RecurringRule, "id">) => void;
  updateRecurringRule: (id: string, rule: Partial<RecurringRule>) => void;
  deleteRecurringRule: (id: string) => void;
  applyRecurringRule: (id: string, targetMonth?: string) => Transaction | null;
  applyAllPendingRecurringRules: (targetMonth?: string) => number;
  autoPostNotice: AutoPostNotice | null;
  dismissAutoPostNotice: () => void;
  runAutoPostForDueRules: () => { postedCount: number; skippedCount: number };
  recurringHistorySuggestions: RecurringHistorySuggestion[];
  acceptRecurringSuggestion: (
    suggestion: RecurringHistorySuggestion,
    options?: { autoPost?: boolean }
  ) => RecurringRule;
  dismissRecurringSuggestion: (signature: string) => void;

  // Quản lý Vay căn hộ Phú Đông SKYONE
  skyoneLoan: MortgageContract;
  skyoneAutoSyncedNotice: string | null;
  dismissSkyoneAutoSyncedNotice: () => void;
  updateSkyOneContract: (patch: Partial<MortgageContract>) => void;
  confirmSkyOnePeriods: (
    periods: number[],
    options?: { linkAccountId?: string; paidAt?: string; note?: string }
  ) => number;
  undoSkyOnePeriod: (period: number) => void;
  addSkyOnePrepayment: (input: {
    amount: number;
    afterPeriod?: number;
    strategy: MortgagePrepayStrategy;
    date: string;
    note?: string;
    linkAccountId?: string;
  }) => void;
  deleteSkyOnePrepayment: (id: string) => void;
  addSkyOneRateAdjustment: (adj: Omit<MortgageRateAdjustment, "id">) => void;
  deleteSkyOneRateAdjustment: (id: string) => void;
  setSkyOneCashflowLocked: (locked: boolean) => void;
  saveAndLockSkyOneCashflow: (input: {
    contractPatch?: Partial<MortgageContract>;
    periodOverrides: MortgagePeriodCashflowOverride[];
  }) => void;
  toggleSkyOnePinkBook5Pct: (enabled?: boolean) => void;
  resetSkyOneLoan: () => void;

  // Quản lý Kho Tích Sản Vàng (GOLD Sub-App)
  goldPortfolio: GoldPortfolioState;
  addGoldLot: (
    lot: Omit<GoldLot, "id" | "remainingChi" | "status" | "createdAt" | "updatedAt">,
    options?: { linkAccountId?: string }
  ) => GoldLot;
  updateGoldLot: (id: string, patch: Partial<GoldLot>) => void;
  deleteGoldLot: (id: string) => void;
  recordGoldSale: (input: {
    saleDate: string;
    category: GoldCategory;
    quantityChi: number;
    unitSellPricePerChi: number;
    mode: "FIFO" | "SPECIFIC_LOT";
    specificLotId?: string;
    purpose: GoldSalePurpose;
    note?: string;
    linkAccountId?: string;
  }) => { ok: boolean; saleEvent?: GoldSaleEvent; error?: string };
  updateGoldPriceQuote: (
    category: GoldCategory,
    patch: Partial<Pick<GoldPriceQuote, "brandLabel" | "buyPricePerChi" | "sellPricePerChi" | "source">>
  ) => void;
  updateGoldMacro: (patch: Partial<Pick<GoldMacroContext, "worldXauUsdPerOz" | "usdVndRate">>) => void;
  updateGoldDcaPlan: (patch: Partial<GoldDcaPlan>) => void;
  toggleGoldIncludeInNetWorth: (include: boolean) => void;
  fetchReferenceGoldPrices: (force?: boolean) => Promise<{ ok: boolean; mode?: string; note?: string; error?: string }>;
  resetGoldPortfolio: () => void;

  // Quản lý Thiết kế Nội thất 3D & Dự toán BOQ (INTERIOR Sub-App)
  interiorStudio: InteriorStudioState;
  setActiveInteriorScenario: (scenarioId: string) => void;
  updateInteriorScenarioMeta: (
    scenarioId: string,
    patch: Partial<
      Pick<
        InteriorDesignScenario,
        "name" | "shortLabel" | "description" | "stylePreset" | "targetBudgetMinVnd" | "targetBudgetMaxVnd" | "contingencyPercent"
      >
    >
  ) => void;
  duplicateInteriorScenario: (sourceScenarioId: string, newName?: string) => InteriorDesignScenario | null;
  addInteriorFurnitureItem: (item: Omit<InteriorFurnitureItem, "id">) => InteriorFurnitureItem;
  updateInteriorFurnitureItem: (
    id: string,
    patch: Partial<InteriorFurnitureItem>,
    options?: { skipUndoHistory?: boolean }
  ) => void;
  deleteInteriorFurnitureItem: (id: string) => void;
  addInteriorExtraBoqItem: (item: Omit<InteriorExtraBoqItem, "id">) => InteriorExtraBoqItem;
  updateInteriorExtraBoqItem: (id: string, patch: Partial<InteriorExtraBoqItem>) => void;
  deleteInteriorExtraBoqItem: (id: string) => void;
  updateBoqItemStatus: (
    origin: "3D_ITEM" | "EXTRA_LINE",
    id: string,
    status: InteriorProcurementStatus
  ) => void;
  recordBoqPaymentToFinance: (input: {
    origin: "3D_ITEM" | "EXTRA_LINE";
    itemId: string;
    itemName: string;
    amountVnd: number;
    accountId: string;
    memberId: FamilyMember;
    date: string;
    stage?: InteriorBoqPaymentStage;
    statusAfter?: "DEPOSITED" | "INSTALLED";
    note?: string;
  }) => Transaction;
  applyInteriorStylePaletteToAllFurniture: (
    scenarioId: string,
    preset: InteriorStylePreset
  ) => void;
  addInteriorMepPoint: (point: Omit<InteriorMepPoint, "id">) => InteriorMepPoint;
  updateInteriorMepPoint: (
    id: string,
    patch: Partial<InteriorMepPoint>,
    options?: { skipUndoHistory?: boolean }
  ) => void;
  deleteInteriorMepPoint: (id: string) => void;
  resetInteriorMepPoints: () => void;
  updateInteriorWallOverride: (wallId: string, patch: Partial<InteriorWallOverride>) => void;
  updateInteriorDoorOverride: (openingId: string, mode: InteriorDoorMode) => void;
  updateInteriorFloorPattern: (roomId: string, pattern: InteriorFloorPattern) => void;
  updateInteriorLightingZones: (patch: Partial<InteriorLightingZones>) => void;
  updateInteriorCurtainOpenRatio: (ratio: number) => void;
  commitInteriorUndoSnapshot: (snapshot: InteriorStudioState) => void;
  toggleHandoverChecklistItem: (id: string) => void;
  updateHandoverChecklistNote: (id: string, note: string) => void;
  undoInteriorChange: () => void;
  redoInteriorChange: () => void;
  canUndoInterior: boolean;
  canRedoInterior: boolean;
  resetInteriorStudio: () => void;

  // Cài đặt & Sao lưu
  updateSettings: (settings: Partial<AppSettings>) => void;
  markNotificationRead: (id: string) => void;
  resetToMockData: () => void;
  exportBackup: () => void;
  exportCsvReport: () => void;
  importBackup: (file: File) => Promise<{ success: boolean; error?: string }>;
  getSyncBundleJson: () => string;
  previewSyncBundle: (rawText: string) => {
    success: boolean;
    preview?: MergeDiffPreview;
    parsedState?: StoredAppStateV3;
    error?: string;
  };
  importSyncBundle: (
    incoming: StoredAppStateV3,
    options: MergeOptions
  ) => { success: boolean; diff: MergeDiffPreview };

  // Dữ liệu tính toán & Helpers
  availableMonths: string[];
  summary: FinancialSummary;
  budgetSummary: BudgetSummary;
  todaySpentInfo: { amount: number; referenceDate: string; isCurrentDay: boolean };
  coupleSettlement: CoupleSettlementResult;
  filteredTransactions: Transaction[];
  categoryExpenseStats: CategoryExpenseStat[];
  monthlyTrendData: MonthlyTrendItem[];
  getCategoryById: (id: string) => Category | undefined;
  getAccountById: (id: string) => Account | undefined;

  // Thông tin 2 thẻ BIDV Credit
  husbandCreditCard: CreditCardInfo | null;
  wifeCreditCard: CreditCardInfo | null;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

function createTxId(): string {
  const datePart = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  const randPart = Math.floor(100000 + Math.random() * 900000);
  return `TX${datePart}${randPart}`;
}

export function FinanceProvider({ children }: { children: ReactNode }) {
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [activeApp, setActiveApp] = useState<SubAppId>("LAUNCHER");
  const [activeTab, setActiveTabState] = useState<NavTab>("overview");
  const [skyoneTab, setSkyoneTabState] = useState<SkyOneRouteTab>("OVERVIEW");
  const [skyoneHighlightPeriod, setSkyoneHighlightPeriod] = useState<number | null>(null);
  const [goldTab, setGoldTabState] = useState<GoldRouteTab>("OVERVIEW");
  const [interiorTab, setInteriorTabState] = useState<InteriorRouteTab>("STUDIO");
  const [activePerspective, setActivePerspective] = useState<PerspectiveMode>("ALL");

  // Supabase Cloud, Profile, Household & Outbox State
  const [cloudUser, setCloudUser] = useState<CloudUser | null>(null);
  const [cloudProfile, setCloudProfile] = useState<CloudProfile | null>(null);
  const [household, setHousehold] = useState<HouseholdInfo | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [pendingOutboxCount, setPendingOutboxCount] = useState<number>(0);
  const [cloudError, setCloudError] = useState<string | null>(null);

  const isCloudConnected = Boolean(isSupabaseConfigured && cloudUser && household);

  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [accounts, setAccounts] = useState<Account[]>(DEFAULT_ACCOUNTS);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<CategoryBudget[]>(DEFAULT_BUDGETS);
  const [goals, setGoals] = useState<SavingsGoal[]>(DEFAULT_SAVINGS_GOALS);
  const [debts, setDebts] = useState<DebtItem[]>(DEFAULT_DEBTS);
  const [investments, setInvestments] = useState<InvestmentItem[]>(DEFAULT_INVESTMENTS);
  const [recurringRules, setRecurringRules] = useState<RecurringRule[]>(DEFAULT_RECURRING_RULES);
  const [savingsChallenges, setSavingsChallenges] = useState<SavingsChallenge[]>(
    DEFAULT_SAVINGS_CHALLENGES
  );
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [skyoneLoan, setSkyoneLoan] = useState<MortgageContract>(() => createDefaultSkyOneLoan());
  const [goldPortfolio, setGoldPortfolio] = useState<GoldPortfolioState>(() =>
    createDefaultGoldPortfolio()
  );
  const [interiorStudio, setInteriorStudio] = useState<InteriorStudioState>(() =>
    createDefaultInteriorStudio()
  );
  const [interiorUndoStack, setInteriorUndoStack] = useState<InteriorStudioState[]>([]);
  const [interiorRedoStack, setInteriorRedoStack] = useState<InteriorStudioState[]>([]);
  const [skyoneAutoSyncedNotice, setSkyoneAutoSyncedNotice] = useState<string | null>(null);
  const [readNotifIds, setReadNotifIds] = useState<Set<string>>(new Set());
  const [isAppLocked, setIsAppLocked] = useState<boolean>(false);
  const [unlockedProtectedViews, setUnlockedProtectedViews] = useState<QuickAuthViewId[]>([]);
  const [browserNotifStatus, setBrowserNotifStatus] =
    useState<BrowserNotificationStatus>("default");
  const [browserNotifEnabled, setBrowserNotifEnabled] = useState<boolean>(false);

  const householdRef = useRef<HouseholdInfo | null>(null);
  const ignoreRealtimeUntilRef = useRef<number>(0);
  const syncDebounceRef = useRef<number | null>(null);
  const stateSnapshotRef = useRef<StoredAppStateV3>({
    categories: DEFAULT_CATEGORIES,
    accounts: DEFAULT_ACCOUNTS,
    transactions: [],
    budgets: DEFAULT_BUDGETS,
    goals: DEFAULT_SAVINGS_GOALS,
    debts: DEFAULT_DEBTS,
    investments: DEFAULT_INVESTMENTS,
    recurringRules: DEFAULT_RECURRING_RULES,
    savingsChallenges: DEFAULT_SAVINGS_CHALLENGES,
    settings: DEFAULT_SETTINGS,
    skyoneLoan: createDefaultSkyOneLoan(),
    goldPortfolio: createDefaultGoldPortfolio(),
    interiorStudio: createDefaultInteriorStudio(),
  });

  useEffect(() => {
    householdRef.current = household;
  }, [household]);

  useEffect(() => {
    stateSnapshotRef.current = {
      categories,
      accounts,
      transactions,
      budgets,
      goals,
      debts,
      investments,
      recurringRules,
      savingsChallenges,
      settings,
      skyoneLoan,
      goldPortfolio,
      interiorStudio,
    };
  }, [
    categories,
    accounts,
    transactions,
    budgets,
    goals,
    debts,
    investments,
    recurringRules,
    savingsChallenges,
    settings,
    skyoneLoan,
    goldPortfolio,
    interiorStudio,
  ]);

  // Bộ lọc
  const [selectedMonth, setSelectedMonth] = useState<string>(() => getCurrentMonthKey());
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedType, setSelectedType] = useState<"ALL" | TransactionType>("ALL");
  const [selectedAccount, setSelectedAccount] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const clearCloudError = useCallback(() => {
    setCloudError(null);
  }, []);

  const applyCloudDataToState = useCallback((cloudData: CloudFullData) => {
    const hasRemotePayload =
      cloudData.accounts.length > 0 ||
      cloudData.transactions.length > 0 ||
      Boolean(cloudData.skyoneLoan) ||
      Boolean(cloudData.goldPortfolio) ||
      Boolean(cloudData.interiorStudio);

    if (!hasRemotePayload) {
      return;
    }

    if (cloudData.categories.length > 0) setCategories(cloudData.categories);
    if (cloudData.budgets.length > 0) setBudgets(cloudData.budgets);
    if (cloudData.goals.length > 0) setGoals(cloudData.goals);
    if (cloudData.debts.length > 0) setDebts(cloudData.debts);
    if (cloudData.investments.length > 0) setInvestments(cloudData.investments);
    if (cloudData.recurringRules.length > 0) setRecurringRules(cloudData.recurringRules);
    if (cloudData.skyoneLoan) {
      setSkyoneLoan(reconcileBidvSkyOneContract(cloudData.skyoneLoan).contract);
    }
    if (cloudData.goldPortfolio) {
      setGoldPortfolio(cloudData.goldPortfolio);
    }
    if (cloudData.interiorStudio) {
      setInteriorStudio(cloudData.interiorStudio);
    }
    if (cloudData.sharedSettings) {
      const shared = cloudData.sharedSettings;
      setSettings((prev) => mergeSharedSettingsWithLocal(prev, shared));
    }

    const nextAccounts =
      cloudData.accounts.length > 0 ? cloudData.accounts : stateSnapshotRef.current.accounts;
    const recalcAccounts = recalculateAccountBalances(nextAccounts, cloudData.transactions);
    setTransactions(cloudData.transactions);
    setAccounts(recalcAccounts);
  }, []);

  const flushOutboxQueue = useCallback(async (targetHouseholdId: string): Promise<boolean> => {
    const queue = loadOutboxQueue();
    if (queue.length === 0) {
      setPendingOutboxCount(0);
      return true;
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setPendingOutboxCount(queue.length);
      return false;
    }

    for (let i = 0; i < queue.length; i++) {
      try {
        await supabaseService.executeMutation(targetHouseholdId, queue[i].mutation);
      } catch (err) {
        const remaining = queue.slice(i);
        saveOutboxQueue(remaining);
        setPendingOutboxCount(remaining.length);
        setCloudError(
          err instanceof Error ? err.message : "Chưa thể đẩy hàng đợi đồng bộ lên Cloud."
        );
        return false;
      }
    }

    clearOutboxQueue();
    setPendingOutboxCount(0);
    return true;
  }, []);

  const queueCloudMutation = useCallback((mutation: CloudMutation) => {
    ignoreRealtimeUntilRef.current = Date.now() + 2500;
    const hh = householdRef.current;
    if (!isSupabaseConfigured || !hh) return;

    const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
    if (isOffline) {
      const next = enqueueOutboxMutation(mutation);
      setPendingOutboxCount(next.length);
      return;
    }

    void supabaseService
      .executeMutation(hh.id, mutation)
      .then(() => {
        setLastSyncedAt(new Date());
      })
      .catch(() => {
        const next = enqueueOutboxMutation(mutation);
        setPendingOutboxCount(next.length);
      });
  }, []);

  // Hàm đồng bộ dữ liệu 2 chiều (Xả hàng đợi ngoại tuyến -> Kéo trạng thái Cloud)
  const syncWithCloud = useCallback(async () => {
    const hh = householdRef.current;
    if (!isSupabaseConfigured || !hh) {
      return;
    }

    setIsSyncing(true);
    setCloudError(null);
    try {
      await flushOutboxQueue(hh.id);
      const cloudData = await supabaseService.fetchAllData(hh.id);
      if (cloudData) {
        applyCloudDataToState(cloudData);
        setLastSyncedAt(new Date());
      }
    } catch (err) {
      console.error("Cloud sync error:", err);
      setCloudError(err instanceof Error ? err.message : "Lỗi đồng bộ với Supabase.");
    } finally {
      setIsSyncing(false);
    }
  }, [flushOutboxQueue, applyCloudDataToState]);

  const signInCloud = useCallback(async (email: string, password: string): Promise<boolean> => {
    setCloudError(null);
    const res = await supabaseService.signInWithPassword(email, password);
    if (res.error || !res.user) {
      setCloudError(res.error || "Đăng nhập thất bại.");
      return false;
    }
    setCloudUser(res.user);
    return true;
  }, []);

  const signUpCloud = useCallback(
    async (
      email: string,
      password: string,
      profileMeta?: { displayName?: string; memberSlot?: AuthMemberId }
    ): Promise<{ ok: boolean; needsEmailConfirm?: boolean; alreadyRegistered?: boolean }> => {
      setCloudError(null);
      const res = await supabaseService.signUpWithPassword(email, password, profileMeta);
      if (res.error) {
        setCloudError(res.error);
        return { ok: false };
      }
      if (res.alreadyRegistered) {
        return { ok: false, alreadyRegistered: true };
      }
      if (!res.needsEmailConfirm && res.user) {
        setCloudUser(res.user);
        const profile = await supabaseService.fetchMyProfile(res.user.id);
        if (profile) {
          setCloudProfile(profile);
        }
      }
      return { ok: true, needsEmailConfirm: res.needsEmailConfirm };
    },
    []
  );

  const resendSignupConfirmationCloud = useCallback(async (email: string): Promise<boolean> => {
    setCloudError(null);
    const res = await supabaseService.resendConfirmationEmail(email);
    if (!res.success) {
      setCloudError(res.error || "Không gửi lại được email xác nhận.");
      return false;
    }
    return true;
  }, []);

  const updateCloudProfile = useCallback(
    async (patch: { displayName?: string; memberSlot?: AuthMemberId }): Promise<boolean> => {
      if (!cloudUser) return false;
      setCloudError(null);
      const updated = await supabaseService.updateMyProfile(cloudUser.id, patch);
      if (!updated) {
        setCloudError("Không thể cập nhật hồ sơ cá nhân trên Cloud.");
        return false;
      }
      setCloudProfile(updated);
      return true;
    },
    [cloudUser]
  );

  const sendMagicLinkCloud = useCallback(async (email: string): Promise<boolean> => {
    setCloudError(null);
    const res = await supabaseService.sendMagicLink(email);
    if (!res.success) {
      setCloudError(res.error || "Không gửi được liên kết đăng nhập.");
      return false;
    }
    return true;
  }, []);

  const signOutCloud = useCallback(async () => {
    await supabaseService.signOut();
    setCloudUser(null);
    setCloudProfile(null);
    setHousehold(null);
    setLastSyncedAt(null);
    setCloudError(null);
  }, []);

  const pushLocalStateToCloud = useCallback(async (): Promise<boolean> => {
    const hh = householdRef.current;
    if (!isSupabaseConfigured || !hh) return false;

    setIsSyncing(true);
    setCloudError(null);
    ignoreRealtimeUntilRef.current = Date.now() + 3000;
    try {
      await supabaseService.pushFullState(hh.id, stateSnapshotRef.current);
      clearOutboxQueue();
      setPendingOutboxCount(0);
      setLastSyncedAt(new Date());
      return true;
    } catch (err) {
      setCloudError(err instanceof Error ? err.message : "Không thể đẩy dữ liệu lên Cloud.");
      return false;
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const createCloudHousehold = useCallback(
    async (name: string, memberSlot: AuthMemberId): Promise<boolean> => {
      if (!cloudUser) return false;
      setIsSyncing(true);
      setCloudError(null);
      try {
        const displayName =
          memberSlot === "HUSBAND"
            ? stateSnapshotRef.current.settings.husbandName
            : stateSnapshotRef.current.settings.wifeName;
        const created = await supabaseService.createHousehold(name, memberSlot, displayName);
        if (created.error || !created.household) {
          setCloudError(created.error || "Không tạo được Tổ ấm Cloud.");
          return false;
        }
        ignoreRealtimeUntilRef.current = Date.now() + 3000;
        await supabaseService.pushFullState(created.household.id, stateSnapshotRef.current);
        clearOutboxQueue();
        setPendingOutboxCount(0);

        const [refreshed, refreshedProfile] = await Promise.all([
          supabaseService.fetchMyHousehold(cloudUser.id),
          supabaseService.fetchMyProfile(cloudUser.id),
        ]);
        setHousehold(refreshed);
        setCloudProfile(refreshedProfile);
        setLastSyncedAt(new Date());
        return true;
      } catch (err) {
        setCloudError(err instanceof Error ? err.message : "Lỗi khi khởi tạo Tổ ấm Cloud.");
        return false;
      } finally {
        setIsSyncing(false);
      }
    },
    [cloudUser]
  );

  const joinCloudHousehold = useCallback(
    async (inviteCode: string, memberSlot: AuthMemberId): Promise<boolean> => {
      if (!cloudUser) return false;
      setIsSyncing(true);
      setCloudError(null);
      try {
        const displayName =
          memberSlot === "HUSBAND"
            ? stateSnapshotRef.current.settings.husbandName
            : stateSnapshotRef.current.settings.wifeName;
        const joined = await supabaseService.joinHouseholdByCode(
          inviteCode,
          memberSlot,
          displayName
        );
        if (joined.error || !joined.household) {
          setCloudError(joined.error || "Mã mời không hợp lệ.");
          return false;
        }

        const [refreshed, refreshedProfile] = await Promise.all([
          supabaseService.fetchMyHousehold(cloudUser.id),
          supabaseService.fetchMyProfile(cloudUser.id),
        ]);
        setHousehold(refreshed);
        setCloudProfile(refreshedProfile);

        const remoteData = await supabaseService.fetchAllData(joined.household.id);
        if (remoteData) {
          const hasRemotePayload =
            remoteData.accounts.length > 0 ||
            remoteData.transactions.length > 0 ||
            Boolean(remoteData.skyoneLoan);

          if (hasRemotePayload) {
            const remoteAsStored: StoredAppStateV3 = {
              categories:
                remoteData.categories.length > 0
                  ? remoteData.categories
                  : stateSnapshotRef.current.categories,
              accounts:
                remoteData.accounts.length > 0
                  ? remoteData.accounts
                  : stateSnapshotRef.current.accounts,
              transactions: remoteData.transactions,
              budgets: remoteData.budgets,
              goals: remoteData.goals,
              debts: remoteData.debts,
              investments: remoteData.investments,
              recurringRules: remoteData.recurringRules,
              settings: remoteData.sharedSettings
                ? mergeSharedSettingsWithLocal(
                    stateSnapshotRef.current.settings,
                    remoteData.sharedSettings
                  )
                : stateSnapshotRef.current.settings,
              skyoneLoan: remoteData.skyoneLoan || stateSnapshotRef.current.skyoneLoan,
              goldPortfolio: remoteData.goldPortfolio || stateSnapshotRef.current.goldPortfolio,
              interiorStudio: remoteData.interiorStudio || stateSnapshotRef.current.interiorStudio,
            };

            const merged = mergeFinanceData(remoteAsStored, stateSnapshotRef.current, {
              mode: "MERGE",
              keepLocalSecurity: true,
            });

            setCategories(merged.categories);
            setAccounts(merged.accounts);
            setTransactions(merged.transactions);
            setBudgets(merged.budgets);
            setGoals(merged.goals);
            setDebts(merged.debts);
            setInvestments(merged.investments);
            setRecurringRules(merged.recurringRules);
            setSettings(merged.settings);
            setSkyoneLoan(merged.skyoneLoan);
            setGoldPortfolio(merged.goldPortfolio);
            setInteriorStudio(merged.interiorStudio);
            saveStoredDataV3(merged);

            ignoreRealtimeUntilRef.current = Date.now() + 3000;
            await supabaseService.pushFullState(joined.household.id, merged);
          } else {
            ignoreRealtimeUntilRef.current = Date.now() + 3000;
            await supabaseService.pushFullState(joined.household.id, stateSnapshotRef.current);
          }
        }

        clearOutboxQueue();
        setPendingOutboxCount(0);
        setLastSyncedAt(new Date());
        return true;
      } catch (err) {
        setCloudError(err instanceof Error ? err.message : "Lỗi ghép đôi Tổ ấm.");
        return false;
      } finally {
        setIsSyncing(false);
      }
    },
    [cloudUser]
  );

  const rotateHouseholdInviteCode = useCallback(async (): Promise<string | null> => {
    if (!household) return null;
    setCloudError(null);
    const res = await supabaseService.regenerateInviteCode(household.id);
    if (res.error || !res.inviteCode) {
      setCloudError(res.error || "Không thể đổi mã mời.");
      return null;
    }
    setHousehold((prev) => (prev ? { ...prev, inviteCode: res.inviteCode! } : null));
    return res.inviteCode;
  }, [household]);

  const leaveCloudHousehold = useCallback(async (): Promise<boolean> => {
    if (!household) return false;
    setCloudError(null);
    const res = await supabaseService.leaveHousehold(household.id);
    if (!res.success) {
      setCloudError(res.error || "Không thể rời Tổ ấm.");
      return false;
    }
    clearOutboxQueue();
    setPendingOutboxCount(0);
    setHousehold(null);
    setCloudProfile((prev) =>
      prev ? { ...prev, householdId: null, role: null } : null
    );
    setLastSyncedAt(null);
    return true;
  }, [household]);

  // Khởi tạo từ LocalStorage khi mount (0ms)
  useEffect(() => {
    const data = loadStoredDataV3();
    setCategories(data.categories);
    setTransactions(data.transactions);
    setBudgets(data.budgets);
    setGoals(data.goals);
    setDebts(data.debts);
    setInvestments(data.investments);
    setRecurringRules(data.recurringRules || DEFAULT_RECURRING_RULES);
    setSavingsChallenges(data.savingsChallenges || DEFAULT_SAVINGS_CHALLENGES);
    setSettings(data.settings);
    const { contract: reconciledOnLoad } = reconcileBidvSkyOneContract(data.skyoneLoan);
    setSkyoneLoan(reconciledOnLoad);
    setGoldPortfolio(data.goldPortfolio || createDefaultGoldPortfolio());
    setInteriorStudio(data.interiorStudio || createDefaultInteriorStudio());

    // Chọn tháng mặc định thông minh: ưu tiên tháng hiện tại nếu có dữ liệu, ngược lại dùng tháng gần nhất có giao dịch
    const currentKey = getCurrentMonthKey();
    const hasCurrentData =
      data.transactions.some((tx) => tx.date.startsWith(currentKey)) ||
      data.budgets.some((b) => b.month === currentKey);
    if (hasCurrentData) {
      setSelectedMonth(currentKey);
    } else if (data.transactions.length > 0) {
      const sortedMonths = data.transactions
        .map((tx) => tx.date.slice(0, 7))
        .filter((m) => /^\d{4}-\d{2}$/.test(m))
        .sort((a, b) => b.localeCompare(a));
      if (sortedMonths[0]) {
        setSelectedMonth(sortedMonths[0]);
      }
    }

    const initialRoute =
      typeof window !== "undefined"
        ? parseAppRoute(window.location.pathname, window.location.search)
        : null;

    if (initialRoute) {
      setActiveApp(initialRoute.app);
      setActiveTabState(initialRoute.financeTab);
      setSkyoneTabState(initialRoute.skyoneTab);
      setGoldTabState(initialRoute.goldTab);
      setInteriorTabState(initialRoute.interiorTab);
      setSkyoneHighlightPeriod(initialRoute.highlightPeriod);
      saveActiveApp(initialRoute.app);
    }

    const isDirectLoginRoute = Boolean(initialRoute?.isLoginRoute);
    const hasConfiguredCredential = hasAnyAuthCredential(data.settings);
    const shouldLockOnStartup =
      data.settings.requireAuthOnOpen !== undefined
        ? Boolean(data.settings.requireAuthOnOpen) && hasConfiguredCredential
        : hasAnyAppPasscode(data.settings);
    if (shouldLockOnStartup || isDirectLoginRoute) {
      setIsAppLocked(true);
    }

    const updatedAccounts = recalculateAccountBalances(data.accounts, data.transactions);
    setAccounts(updatedAccounts);

    setPendingOutboxCount(loadOutboxQueue().length);
    setIsLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Khởi tạo phiên Supabase Auth & theo dõi trạng thái đăng nhập
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    void supabaseService.getCurrentSessionUser().then((user) => {
      setCloudUser(user);
    });

    const unsubscribeAuth = supabaseService.onAuthChange((user) => {
      setCloudUser(user);
      if (!user) {
        setCloudProfile(null);
        setHousehold(null);
      }
    });

    return () => {
      unsubscribeAuth();
    };
  }, []);

  // Nạp hồ sơ cá nhân (profiles) và thông tin Tổ ấm (households) khi người dùng đăng nhập Cloud
  useEffect(() => {
    if (!isSupabaseConfigured || !cloudUser) {
      setCloudProfile(null);
      setHousehold(null);
      return;
    }

    let cancelled = false;
    void Promise.all([
      supabaseService.fetchMyProfile(cloudUser.id),
      supabaseService.fetchMyHousehold(cloudUser.id),
    ]).then(([profile, hh]) => {
      if (!cancelled) {
        setCloudProfile(profile);
        setHousehold(hh);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [cloudUser]);

  // Đăng ký Supabase Realtime & tự động xả hàng đợi khi có mạng trở lại
  useEffect(() => {
    if (!isSupabaseConfigured || !cloudUser || !household) return;

    void syncWithCloud();

    const unsubscribeRealtime = supabaseService.subscribeHouseholdRealtime(
      household.id,
      (changedTable) => {
        if (
          changedTable === "household_members" ||
          changedTable === "households" ||
          changedTable === "profiles"
        ) {
          void Promise.all([
            supabaseService.fetchMyHousehold(cloudUser.id),
            supabaseService.fetchMyProfile(cloudUser.id),
          ]).then(([hh, profile]) => {
            if (hh) setHousehold(hh);
            if (profile) setCloudProfile(profile);
          });
          return;
        }

        if (Date.now() < ignoreRealtimeUntilRef.current) {
          return;
        }

        if (syncDebounceRef.current) {
          window.clearTimeout(syncDebounceRef.current);
        }
        syncDebounceRef.current = window.setTimeout(() => {
          void syncWithCloud();
        }, 450);
      }
    );

    const handleOnline = () => {
      void syncWithCloud();
    };
    window.addEventListener("online", handleOnline);

    return () => {
      unsubscribeRealtime();
      window.removeEventListener("online", handleOnline);
      if (syncDebounceRef.current) {
        window.clearTimeout(syncDebounceRef.current);
      }
    };
  }, [cloudUser, household?.id, syncWithCloud]);

  // Đồng bộ URL route, document.title và nút Back/Forward của trình duyệt
  useEffect(() => {
    if (!isLoaded || typeof window === "undefined") return;

    const handlePopState = () => {
      const parsed = parseAppRoute(window.location.pathname, window.location.search);
      if (parsed.isLoginRoute) {
        setIsAppLocked(true);
        return;
      }
      setActiveApp(parsed.app);
      setActiveTabState(parsed.financeTab);
      setSkyoneTabState(parsed.skyoneTab);
      setGoldTabState(parsed.goldTab);
      setInteriorTabState(parsed.interiorTab);
      setSkyoneHighlightPeriod(parsed.highlightPeriod);
      saveActiveApp(parsed.app);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [isLoaded]);

  useEffect(() => {
    if (!isLoaded || typeof document === "undefined") return;
    document.title = getAppDocumentTitle(activeApp, activeTab, skyoneTab, goldTab, interiorTab);
  }, [isLoaded, activeApp, activeTab, skyoneTab, goldTab, interiorTab]);

  const switchSubApp = useCallback(
    (
      app: SubAppId,
      options?: {
        financeTab?: FinanceTab;
        skyoneTab?: SkyOneRouteTab;
        goldTab?: GoldRouteTab;
        interiorTab?: InteriorRouteTab;
        highlightPeriod?: number | null;
      }
    ) => {
      const nextFinanceTab = options?.financeTab ?? activeTab;
      const nextSkyoneTab = options?.skyoneTab ?? skyoneTab;
      const nextGoldTab = options?.goldTab ?? goldTab;
      const nextInteriorTab = options?.interiorTab ?? interiorTab;
      const nextHighlight =
        options?.highlightPeriod !== undefined ? options.highlightPeriod : null;

      if (app === "SKYONE") {
        setSkyoneLoan((prev) => {
          const { contract: reconciled, didAutoSync } = reconcileBidvSkyOneContract(prev);
          if (didAutoSync) {
            setSkyoneAutoSyncedNotice(
              "Đã tự động đồng bộ chuẩn HĐMB A.12A.07 (Đợt 1: 708,07tr · 15 kỳ khớp sao kê BIDV 662,23tr) và bảo toàn các kỳ/tùy chỉnh cá nhân."
            );
            return reconciled;
          }
          return prev;
        });
      }

      setActiveApp(app);
      if (options?.financeTab) {
        setActiveTabState(options.financeTab);
      }
      if (options?.skyoneTab) {
        setSkyoneTabState(options.skyoneTab);
      }
      if (options?.goldTab) {
        setGoldTabState(options.goldTab);
      }
      if (options?.interiorTab) {
        setInteriorTabState(options.interiorTab);
      }
      setSkyoneHighlightPeriod(nextHighlight);
      saveActiveApp(app);

      if (typeof window !== "undefined") {
        const targetPath = buildAppPath(
          app,
          nextFinanceTab,
          nextSkyoneTab,
          nextHighlight,
          nextGoldTab,
          nextInteriorTab
        );
        const currentFull = `${window.location.pathname}${window.location.search}`;
        if (currentFull !== targetPath) {
          window.history.pushState(null, "", targetPath);
        }
      }
    },
    [activeTab, skyoneTab, goldTab, interiorTab]
  );

  const setActiveTab = useCallback(
    (tab: NavTab) => {
      switchSubApp("FINANCE", { financeTab: tab, highlightPeriod: null });
    },
    [switchSubApp]
  );

  const setSkyoneTab = useCallback(
    (tab: SkyOneRouteTab, highlightPeriod?: number | null) => {
      switchSubApp("SKYONE", {
        skyoneTab: tab,
        highlightPeriod: highlightPeriod ?? null,
      });
    },
    [switchSubApp]
  );

  const setGoldTab = useCallback(
    (tab: GoldRouteTab) => {
      switchSubApp("GOLD", { goldTab: tab });
    },
    [switchSubApp]
  );

  const setInteriorTab = useCallback(
    (tab: InteriorRouteTab) => {
      switchSubApp("INTERIOR", { interiorTab: tab });
    },
    [switchSubApp]
  );

  const openAppLauncher = useCallback(() => {
    switchSubApp("LAUNCHER");
  }, [switchSubApp]);

  const clearSkyoneHighlightPeriod = useCallback(() => {
    setSkyoneHighlightPeriod(null);
  }, []);

  const dismissSkyoneAutoSyncedNotice = useCallback(() => {
    setSkyoneAutoSyncedNotice(null);
  }, []);

  // Tự động lưu vào LocalStorage
  useEffect(() => {
    if (!isLoaded) return;
    saveStoredDataV3({
      categories,
      accounts,
      transactions,
      budgets,
      goals,
      debts,
      investments,
      recurringRules,
      savingsChallenges,
      settings,
      skyoneLoan,
      goldPortfolio,
      interiorStudio,
    });
  }, [
    categories,
    accounts,
    transactions,
    budgets,
    goals,
    debts,
    investments,
    recurringRules,
    savingsChallenges,
    settings,
    skyoneLoan,
    goldPortfolio,
    interiorStudio,
    isLoaded,
  ]);

  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    set.add("2026-10");
    set.add(getCurrentMonthKey());
    transactions.forEach((tx) => {
      if (tx.date && tx.date.length >= 7) {
        set.add(tx.date.substring(0, 7));
      }
    });
    budgets.forEach((b) => {
      if (b.month) set.add(b.month);
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [transactions, budgets]);

  const getCategoryById = useCallback(
    (id: string) => categories.find((c) => c.id === id),
    [categories]
  );

  const getAccountById = useCallback(
    (id: string) => accounts.find((a) => a.id === id),
    [accounts]
  );

  // Light / Dark Mode synchronization (mặc định Light Mode)
  const themeMode: ThemeMode = settings.themeMode === "dark" ? "dark" : "light";

  const syncThemeDocumentState = useCallback(
    (mode: ThemeMode, locked: boolean) => {
      if (typeof document === "undefined") return;
      const isDark = mode === "dark";
      document.documentElement.classList.toggle("dark", isDark);
      let metaTheme = document.querySelector('meta[name="theme-color"]');
      if (!metaTheme) {
        metaTheme = document.createElement("meta");
        metaTheme.setAttribute("name", "theme-color");
        document.head.appendChild(metaTheme);
      }
      metaTheme.setAttribute("content", isDark || locked ? "#0f172a" : "#ffffff");
    },
    []
  );

  useEffect(() => {
    syncThemeDocumentState(themeMode, isAppLocked);
  }, [themeMode, isAppLocked, syncThemeDocumentState]);

  const setThemeMode = useCallback(
    (mode: ThemeMode, event?: ThemeTransitionTriggerEvent) => {
      if (mode === themeMode) return;
      runThemeCircularReveal({
        event,
        commitTheme: () => {
          syncThemeDocumentState(mode, isAppLocked);
          flushSync(() => {
            setSettings((prev) => ({ ...prev, themeMode: mode }));
          });
        },
      });
    },
    [themeMode, isAppLocked, syncThemeDocumentState]
  );

  const toggleThemeMode = useCallback(
    (event?: ThemeTransitionTriggerEvent) => {
      const nextMode: ThemeMode = themeMode === "dark" ? "light" : "dark";
      runThemeCircularReveal({
        event,
        commitTheme: () => {
          syncThemeDocumentState(nextMode, isAppLocked);
          flushSync(() => {
            setSettings((prev) => ({ ...prev, themeMode: nextMode }));
          });
        },
      });
    },
    [themeMode, isAppLocked, syncThemeDocumentState]
  );

  // Privacy, /login Route & Multi-Member Security Lock
  const isPrivacyMode = Boolean(settings.privacyMode);
  const hasPasscodeProtection = useMemo(() => hasAnyAppPasscode(settings), [settings]);
  const hasAuthCredential = useMemo(() => hasAnyAuthCredential(settings), [settings]);

  const isViewProtectedByQuickAuth = useCallback(
    (view: QuickAuthViewId) => isQuickAuthViewProtected(settings, view),
    [settings]
  );

  const isViewUnlockedInSession = useCallback(
    (view: QuickAuthViewId) => unlockedProtectedViews.includes(view),
    [unlockedProtectedViews]
  );

  const unlockProtectedView = useCallback((view: QuickAuthViewId) => {
    setUnlockedProtectedViews((prev) => (prev.includes(view) ? prev : [...prev, view]));
  }, []);

  const toggleQuickAuthView = useCallback((view: QuickAuthViewId, enabled: boolean) => {
    setSettings((prev) => {
      const currentViews = prev.quickAuth?.protectedViews || [];
      const nextViews = enabled
        ? Array.from(new Set([...currentViews, view]))
        : currentViews.filter((v) => v !== view);
      return {
        ...prev,
        quickAuth: {
          enabled: nextViews.length > 0,
          protectedViews: nextViews,
        },
      };
    });
    if (!enabled) {
      setUnlockedProtectedViews((prev) => prev.filter((v) => v !== view));
    }
  }, []);

  const togglePrivacyMode = useCallback(() => {
    setSettings((prev) => ({ ...prev, privacyMode: !prev.privacyMode }));
  }, []);

  const verifyMemberPasscode = useCallback(
    async (member: AuthMemberId, code: string): Promise<boolean> => {
      const cleaned = code.trim();
      const memberCfg = getMemberAuthConfig(settings, member);
      const otherMember: AuthMemberId = member === "HUSBAND" ? "WIFE" : "HUSBAND";
      const otherCfg = getMemberAuthConfig(settings, otherMember);

      let isValid = false;
      if (memberCfg.passcodeHash && memberCfg.passcodeSalt) {
        isValid = await verifyPasscode(cleaned, memberCfg.passcodeHash, memberCfg.passcodeSalt);
      } else if (otherCfg.passcodeHash && otherCfg.passcodeSalt) {
        // Cho phép dùng mã gia đình của thành viên còn lại nếu thành viên này chưa đặt mã riêng
        isValid = await verifyPasscode(cleaned, otherCfg.passcodeHash, otherCfg.passcodeSalt);
      } else if (settings.pinCode && cleaned === settings.pinCode) {
        isValid = true;
        // Tự động nâng cấp PIN thuần văn bản cũ sang băm SHA-256 + salt
        const upgraded = await hashPasscode(cleaned);
        setSettings((prev) => ({
          ...prev,
          pinCode: "",
          authActiveProfile: member,
          [member === "HUSBAND" ? "husbandAuth" : "wifeAuth"]: {
            ...getMemberAuthConfig(prev, member),
            passcodeHash: upgraded.hash,
            passcodeSalt: upgraded.salt,
            updatedAt: new Date().toISOString(),
          },
        }));
      } else if (!hasAnyAppPasscode(settings)) {
        isValid = true;
      }

      return isValid;
    },
    [settings]
  );

  const unlockWithPasscode = useCallback(
    async (member: AuthMemberId, code: string): Promise<boolean> => {
      const isValid = await verifyMemberPasscode(member, code);
      if (isValid) {
        setIsAppLocked(false);
        setActiveApp("LAUNCHER");
        saveActiveApp("LAUNCHER");
        setSettings((prev) => ({ ...prev, authActiveProfile: member }));
        if (typeof window !== "undefined") {
          window.history.replaceState(null, "", "/launcher");
        }
        return true;
      }
      return false;
    },
    [verifyMemberPasscode]
  );

  const unlockWithBiometricSuccess = useCallback(
    (member: AuthMemberId, switchPerspective = false) => {
      setIsAppLocked(false);
      setActiveApp("LAUNCHER");
      saveActiveApp("LAUNCHER");
      setSettings((prev) => ({ ...prev, authActiveProfile: member }));
      if (switchPerspective) {
        setActivePerspective(member);
      }
      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", "/launcher");
      }
    },
    []
  );

  const setMemberPasscode = useCallback(
    async (member: AuthMemberId, newCode: string, options?: { enableEntryLock?: boolean }) => {
      const { hash, salt } = await hashPasscode(newCode);
      setSettings((prev) => {
        const hasQuickAuthViews = Boolean(
          prev.quickAuth?.enabled && (prev.quickAuth?.protectedViews?.length ?? 0) > 0
        );
        const nextRequireOnOpen =
          options?.enableEntryLock !== undefined
            ? options.enableEntryLock
            : prev.requireAuthOnOpen !== undefined
            ? prev.requireAuthOnOpen
            : !hasQuickAuthViews;
        return {
          ...prev,
          pinCode: "",
          requireAuthOnOpen: nextRequireOnOpen,
          authActiveProfile: member,
          [member === "HUSBAND" ? "husbandAuth" : "wifeAuth"]: {
            ...getMemberAuthConfig(prev, member),
            passcodeHash: hash,
            passcodeSalt: salt,
            updatedAt: new Date().toISOString(),
          },
        };
      });
    },
    []
  );

  const clearMemberPasscode = useCallback((member: AuthMemberId) => {
    setSettings((prev) => {
      const targetKey = member === "HUSBAND" ? "husbandAuth" : "wifeAuth";
      const currentTarget = getMemberAuthConfig(prev, member);
      const updatedTarget: MemberAuthConfig = {
        ...currentTarget,
        passcodeHash: undefined,
        passcodeSalt: undefined,
        updatedAt: new Date().toISOString(),
      };
      const nextSettings: AppSettings = {
        ...prev,
        pinCode: "",
        [targetKey]: updatedTarget,
      };
      if (!hasAnyAuthCredential(nextSettings)) {
        nextSettings.requireAuthOnOpen = false;
      }
      return nextSettings;
    });
  }, []);

  const updateMemberAuthConfig = useCallback(
    (member: AuthMemberId, patch: Partial<MemberAuthConfig>) => {
      setSettings((prev) => {
        const key = member === "HUSBAND" ? "husbandAuth" : "wifeAuth";
        const current = getMemberAuthConfig(prev, member);
        return {
          ...prev,
          [key]: {
            ...current,
            ...patch,
            updatedAt: new Date().toISOString(),
          },
        };
      });
    },
    []
  );

  const lockApp = useCallback(() => {
    setUnlockedProtectedViews([]);
    setIsAppLocked(true);
    if (typeof window !== "undefined" && window.location.pathname !== "/login") {
      window.history.pushState(null, "", "/login");
    }
  }, []);

  const bypassLockForFirstSetup = useCallback((member: AuthMemberId) => {
    setIsAppLocked(false);
    setActiveApp("LAUNCHER");
    saveActiveApp("LAUNCHER");
    setSettings((prev) => ({ ...prev, authActiveProfile: member }));
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", "/launcher");
    }
  }, []);

  // Đồng bộ nút Back/Forward của trình duyệt với tuyến /login
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handlePopState = () => {
      if (window.location.pathname === "/login") {
        setUnlockedProtectedViews([]);
        setIsAppLocked(true);
      } else if (!hasAnyAuthCredential(settings) || !settings.requireAuthOnOpen) {
        setIsAppLocked(false);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [settings]);

  // Tự động khóa theo thời gian không thao tác (autoLockMinutes) & khi ẩn ứng dụng (lockOnBackground)
  useEffect(() => {
    const hasQuickAuthActive = Boolean(
      settings.quickAuth?.enabled && (settings.quickAuth?.protectedViews?.length ?? 0) > 0
    );
    if (
      !isLoaded ||
      isAppLocked ||
      !hasAuthCredential ||
      (!settings.requireAuthOnOpen && !hasQuickAuthActive)
    ) {
      return;
    }

    const triggerLock = () => {
      setUnlockedProtectedViews([]);
      if (settings.requireAuthOnOpen) {
        lockApp();
      }
    };

    const timeoutMinutes = settings.autoLockMinutes ?? 0;
    let inactivityTimer: number | undefined;

    const resetTimer = () => {
      if (inactivityTimer) window.clearTimeout(inactivityTimer);
      if (timeoutMinutes > 0) {
        inactivityTimer = window.setTimeout(() => {
          triggerLock();
        }, timeoutMinutes * 60 * 1000);
      }
    };

    const events: (keyof WindowEventMap)[] = ["pointerdown", "keydown", "touchstart"];
    if (timeoutMinutes > 0) {
      resetTimer();
      events.forEach((ev) => window.addEventListener(ev, resetTimer, { passive: true }));
    }

    const handleVisibility = () => {
      if (document.visibilityState === "hidden" && settings.lockOnBackground) {
        triggerLock();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      if (inactivityTimer) window.clearTimeout(inactivityTimer);
      events.forEach((ev) => window.removeEventListener(ev, resetTimer));
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [
    isLoaded,
    isAppLocked,
    hasAuthCredential,
    settings.requireAuthOnOpen,
    settings.quickAuth,
    settings.autoLockMinutes,
    settings.lockOnBackground,
    lockApp,
  ]);

  // CRUD Danh mục
  const addCategory = useCallback(
    (cat: Omit<Category, "id">): Category => {
      const newCat: Category = {
        ...cat,
        id: `cat_${cat.type.toLowerCase()}_${Date.now()}`,
        isDefault: false,
      };
      setCategories((prev) => [...prev, newCat]);
      queueCloudMutation({ type: "UPSERT_CATEGORY", payload: newCat });
      return newCat;
    },
    [queueCloudMutation]
  );

  const updateCategory = useCallback(
    (id: string, cat: Partial<Category>) => {
      setCategories((prev) => {
        let updated: Category | undefined;
        const next = prev.map((c) => {
          if (c.id !== id) return c;
          updated = { ...c, ...cat };
          return updated;
        });
        if (updated) {
          queueCloudMutation({ type: "UPSERT_CATEGORY", payload: updated });
        }
        return next;
      });
    },
    [queueCloudMutation]
  );

  const deleteCategory = useCallback(
    (id: string) => {
      setCategories((prev) => prev.filter((c) => c.id !== id));
      queueCloudMutation({ type: "DELETE_CATEGORY", id });
    },
    [queueCloudMutation]
  );

  const toggleCategoryVisibility = useCallback(
    (id: string) => {
      setCategories((prev) => {
        let updated: Category | undefined;
        const next = prev.map((c) => {
          if (c.id !== id) return c;
          updated = { ...c, isHidden: !c.isHidden };
          return updated;
        });
        if (updated) {
          queueCloudMutation({ type: "UPSERT_CATEGORY", payload: updated });
        }
        return next;
      });
    },
    [queueCloudMutation]
  );

  const restoreDefaultCategories = useCallback((): number => {
    let restoredCount = 0;
    setCategories((prev) => {
      const hiddenDefaults = prev.filter((c) => c.isDefault && c.isHidden).length;
      const existingIds = new Set(prev.map((c) => c.id));
      const missingDefaults = DEFAULT_CATEGORIES.filter((d) => !existingIds.has(d.id)).length;
      restoredCount = hiddenDefaults + missingDefaults;
      if (restoredCount === 0) return prev;
      return restoreDefaultCategoriesList(prev, DEFAULT_CATEGORIES);
    });
    return restoredCount;
  }, []);

  // CRUD Giao dịch
  const addTransaction = useCallback(
    (input: TransactionInput): Transaction => {
      const now = new Date().toISOString();
      const newTx: Transaction = {
        id: createTxId(),
        amount: Math.abs(input.amount),
        date: input.date,
        type: input.type,
        categoryId: input.categoryId,
        accountId: input.accountId,
        toAccountId: input.toAccountId,
        memberId: input.memberId,
        scope: input.scope,
        note: input.note?.trim() || "",
        tag: input.tag || "NORMAL",
        createdAt: now,
        updatedAt: now,
      };

      setTransactions((prev) => {
        const next = [newTx, ...prev];
        setAccounts((prevAccs) => {
          const recalc = recalculateAccountBalances(prevAccs, next);
          queueCloudMutation({ type: "UPSERT_TRANSACTION", payload: newTx });
          queueCloudMutation({ type: "UPSERT_ACCOUNTS_BATCH", payload: recalc });
          return recalc;
        });
        return next;
      });

      return newTx;
    },
    [queueCloudMutation]
  );

  const addTransactionsBatch = useCallback(
    (inputs: TransactionInput[]): Transaction[] => {
      if (inputs.length === 0) return [];
      const now = new Date().toISOString();
      const created: Transaction[] = inputs.map((input, idx) => ({
        id: `${createTxId()}_${idx}`,
        amount: Math.abs(input.amount),
        date: input.date,
        type: input.type,
        categoryId: input.categoryId,
        accountId: input.accountId,
        toAccountId: input.toAccountId,
        memberId: input.memberId,
        scope: input.scope,
        note: input.note?.trim() || "",
        tag: input.tag || "NORMAL",
        createdAt: now,
        updatedAt: now,
      }));

      setTransactions((prev) => {
        const next = [...created, ...prev];
        setAccounts((prevAccs) => {
          const recalc = recalculateAccountBalances(prevAccs, next);
          queueCloudMutation({ type: "UPSERT_TRANSACTIONS_BATCH", payload: created });
          queueCloudMutation({ type: "UPSERT_ACCOUNTS_BATCH", payload: recalc });
          return recalc;
        });
        return next;
      });

      return created;
    },
    [queueCloudMutation]
  );

  const updateTransaction = useCallback(
    (id: string, input: Partial<TransactionInput>) => {
      let updatedTx: Transaction | undefined;
      setTransactions((prev) => {
        const next = prev.map((tx) => {
          if (tx.id !== id) return tx;
          updatedTx = {
            ...tx,
            amount: input.amount !== undefined ? Math.abs(input.amount) : tx.amount,
            date: input.date !== undefined ? input.date : tx.date,
            type: input.type !== undefined ? input.type : tx.type,
            categoryId: input.categoryId !== undefined ? input.categoryId : tx.categoryId,
            accountId: input.accountId !== undefined ? input.accountId : tx.accountId,
            toAccountId: input.toAccountId !== undefined ? input.toAccountId : tx.toAccountId,
            memberId: input.memberId !== undefined ? input.memberId : tx.memberId,
            scope: input.scope !== undefined ? input.scope : tx.scope,
            note: input.note !== undefined ? input.note.trim() : tx.note,
            tag: input.tag !== undefined ? input.tag : tx.tag,
            updatedAt: new Date().toISOString(),
          };
          return updatedTx;
        });

        setAccounts((prevAccs) => {
          const recalc = recalculateAccountBalances(prevAccs, next);
          if (updatedTx) {
            queueCloudMutation({ type: "UPSERT_TRANSACTION", payload: updatedTx });
            queueCloudMutation({ type: "UPSERT_ACCOUNTS_BATCH", payload: recalc });
          }
          return recalc;
        });

        return next;
      });
    },
    [queueCloudMutation]
  );

  const deleteTransaction = useCallback(
    (id: string) => {
      setTransactions((prev) => {
        const next = prev.filter((tx) => tx.id !== id);
        setAccounts((prevAccs) => {
          const recalc = recalculateAccountBalances(prevAccs, next);
          queueCloudMutation({ type: "DELETE_TRANSACTION", id });
          queueCloudMutation({ type: "UPSERT_ACCOUNTS_BATCH", payload: recalc });
          return recalc;
        });
        return next;
      });
    },
    [queueCloudMutation]
  );

  const deleteTransactionsBatch = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      const idSet = new Set(ids);
      setTransactions((prev) => {
        const next = prev.filter((tx) => !idSet.has(tx.id));
        setAccounts((prevAccs) => {
          const recalc = recalculateAccountBalances(prevAccs, next);
          queueCloudMutation({ type: "DELETE_TRANSACTIONS_BATCH", ids });
          queueCloudMutation({ type: "UPSERT_ACCOUNTS_BATCH", payload: recalc });
          return recalc;
        });
        return next;
      });
    },
    [queueCloudMutation]
  );

  // Quản lý Tài khoản (Ví)
  const addAccount = useCallback(
    (acc: Omit<Account, "id" | "currentBalance">) => {
      const newId = `acc_${Date.now()}`;
      const newAccount: Account = {
        ...acc,
        id: newId,
        currentBalance: acc.initialBalance,
      };
      setAccounts((prev) => {
        const next = [...prev, newAccount];
        queueCloudMutation({ type: "UPSERT_ACCOUNT", payload: newAccount });
        return next;
      });
    },
    [queueCloudMutation]
  );

  const updateAccount = useCallback(
    (id: string, acc: Partial<Account>) => {
      setAccounts((prev) => {
        const mapped = prev.map((a) => (a.id === id ? { ...a, ...acc } : a));
        const recalc = recalculateAccountBalances(mapped, transactions);
        const target = recalc.find((a) => a.id === id);
        if (target) {
          queueCloudMutation({ type: "UPSERT_ACCOUNT", payload: target });
        }
        return recalc;
      });
    },
    [transactions, queueCloudMutation]
  );

  const deleteAccount = useCallback(
    (id: string) => {
      setAccounts((prev) => prev.filter((a) => a.id !== id));
      queueCloudMutation({ type: "DELETE_ACCOUNT", id });
    },
    [queueCloudMutation]
  );

  // Ngân sách
  const setCategoryBudget = useCallback(
    (categoryId: string, limitAmount: number, month?: string) => {
      const targetMonth = month || (selectedMonth === "ALL" ? getCurrentMonthKey() : selectedMonth);
      const targetBudget: CategoryBudget = { categoryId, limitAmount, month: targetMonth };

      setBudgets((prev) => {
        const exists = prev.some(
          (b) => b.categoryId === categoryId && b.month === targetMonth
        );
        if (exists) {
          return prev.map((b) =>
            b.categoryId === categoryId && b.month === targetMonth
              ? { ...b, limitAmount }
              : b
          );
        }
        return [...prev, targetBudget];
      });

      queueCloudMutation({ type: "UPSERT_BUDGET", payload: targetBudget });
    },
    [selectedMonth, queueCloudMutation]
  );

  const deleteBudget = useCallback(
    (categoryId: string, month?: string) => {
      const targetMonth = month || (selectedMonth === "ALL" ? getCurrentMonthKey() : selectedMonth);
      setBudgets((prev) =>
        prev.filter((b) => !(b.categoryId === categoryId && b.month === targetMonth))
      );
      queueCloudMutation({ type: "DELETE_BUDGET", categoryId, month: targetMonth });
    },
    [selectedMonth, queueCloudMutation]
  );

  const copyBudgetsFromMonth = useCallback(
    (fromMonth: string, toMonth: string): number => {
      let copied = 0;
      setBudgets((prev) => {
        const source = prev.filter((b) => b.month === fromMonth);
        if (source.length === 0) return prev;
        const existingKeys = new Set(
          prev.filter((b) => b.month === toMonth).map((b) => b.categoryId)
        );
        const additions = source
          .filter((b) => !existingKeys.has(b.categoryId))
          .map((b) => ({ ...b, month: toMonth }));
        copied = additions.length;
        if (additions.length > 0) {
          queueCloudMutation({ type: "UPSERT_BUDGETS_BATCH", payload: additions });
        }
        return [...prev, ...additions];
      });
      return copied;
    },
    [queueCloudMutation]
  );

  // Mục tiêu
  const addGoal = useCallback(
    (goal: Omit<SavingsGoal, "id" | "isCompleted">) => {
      const newGoal: SavingsGoal = {
        ...goal,
        id: `goal_${Date.now()}`,
        isCompleted: goal.currentAmount >= goal.targetAmount,
      };
      setGoals((prev) => [...prev, newGoal]);
      queueCloudMutation({ type: "UPSERT_GOAL", payload: newGoal });
    },
    [queueCloudMutation]
  );

  const updateGoal = useCallback(
    (id: string, goal: Partial<SavingsGoal>) => {
      setGoals((prev) => {
        let target: SavingsGoal | undefined;
        const next = prev.map((g) => {
          if (g.id !== id) return g;
          target = { ...g, ...goal };
          target.isCompleted = target.currentAmount >= target.targetAmount;
          return target;
        });
        if (target) {
          queueCloudMutation({ type: "UPSERT_GOAL", payload: target });
        }
        return next;
      });
    },
    [queueCloudMutation]
  );

  const deleteGoal = useCallback(
    (id: string) => {
      setGoals((prev) => prev.filter((g) => g.id !== id));
      queueCloudMutation({ type: "DELETE_GOAL", id });
    },
    [queueCloudMutation]
  );

  // Event-sourced goal deposit: deducts from sourceAccountId via TRANSFER transaction
  const depositGoal = useCallback(
    (id: string, amount: number, sourceAccountId?: string) => {
      let targetGoalName = "Mục tiêu";
      setGoals((prev) => {
        let target: SavingsGoal | undefined;
        const next = prev.map((g) => {
          if (g.id !== id) return g;
          targetGoalName = g.name;
          const newCurrent = g.currentAmount + amount;
          target = {
            ...g,
            currentAmount: newCurrent,
            isCompleted: newCurrent >= g.targetAmount,
          };
          return target;
        });
        if (target) {
          queueCloudMutation({ type: "UPSERT_GOAL", payload: target });
        }
        return next;
      });

      if (sourceAccountId) {
        const srcAcc = accounts.find((a) => a.id === sourceAccountId);
        addTransaction({
          amount,
          date: new Date().toISOString().slice(0, 10),
          type: "TRANSFER",
          categoryId: "cat_expense_other",
          accountId: sourceAccountId,
          toAccountId: `goal_${id}`,
          memberId: srcAcc?.owner && srcAcc.owner !== "SHARED" ? srcAcc.owner : "HUSBAND",
          scope: "FAMILY",
          tag: "INVESTMENT",
          note: `Nạp hũ tích lũy: ${targetGoalName}`,
        });
      }
    },
    [accounts, addTransaction, queueCloudMutation]
  );

  // Thử thách tiết kiệm hàng tháng
  const addSavingsChallenge = useCallback(
    (challenge: Omit<SavingsChallenge, "id" | "createdAt">): SavingsChallenge => {
      const created: SavingsChallenge = {
        ...challenge,
        id: `chg_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`,
        createdAt: new Date().toISOString(),
      };
      setSavingsChallenges((prev) => [...prev, created]);
      return created;
    },
    []
  );

  const updateSavingsChallenge = useCallback(
    (id: string, patch: Partial<SavingsChallenge>) => {
      setSavingsChallenges((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...patch } : c))
      );
    },
    []
  );

  const deleteSavingsChallenge = useCallback((id: string) => {
    setSavingsChallenges((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const contributeSavingsChallenge = useCallback((id: string, deltaAmount: number) => {
    setSavingsChallenges((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, manualSavedAmount: Math.max(0, (c.manualSavedAmount || 0) + deltaAmount) }
          : c
      )
    );
  }, []);

  // Nợ & Đầu tư
  const addDebt = useCallback(
    (debt: Omit<DebtItem, "id">) => {
      const newDebt: DebtItem = { ...debt, id: `debt_${Date.now()}` };
      setDebts((prev) => [...prev, newDebt]);
      queueCloudMutation({ type: "UPSERT_DEBT", payload: newDebt });
    },
    [queueCloudMutation]
  );

  const updateDebt = useCallback(
    (id: string, debt: Partial<DebtItem>) => {
      setDebts((prev) => {
        let target: DebtItem | undefined;
        const next = prev.map((d) => {
          if (d.id !== id) return d;
          target = { ...d, ...debt };
          target.status =
            target.paidAmount >= target.totalAmount ? "PAID" : debt.status || target.status;
          return target;
        });
        if (target) {
          queueCloudMutation({ type: "UPSERT_DEBT", payload: target });
        }
        return next;
      });
    },
    [queueCloudMutation]
  );

  const payDebt = useCallback(
    (id: string, amount: number, sourceAccountId?: string) => {
      const targetDebt = debts.find((d) => d.id === id);
      setDebts((prev) => {
        let target: DebtItem | undefined;
        const next = prev.map((d) => {
          if (d.id !== id) return d;
          const newPaid = d.paidAmount + amount;
          target = {
            ...d,
            paidAmount: newPaid,
            status: newPaid >= d.totalAmount ? "PAID" : "ACTIVE",
          };
          return target;
        });
        if (target) {
          queueCloudMutation({ type: "UPSERT_DEBT", payload: target });
        }
        return next;
      });

      if (sourceAccountId && targetDebt) {
        const srcAcc = accounts.find((a) => a.id === sourceAccountId);
        const isBorrow = targetDebt.type === "BORROW";
        addTransaction({
          amount,
          date: new Date().toISOString().slice(0, 10),
          type: isBorrow ? "EXPENSE" : "INCOME",
          categoryId: isBorrow ? "cat_expense_other" : "cat_income_investment",
          accountId: sourceAccountId,
          memberId: srcAcc?.owner && srcAcc.owner !== "SHARED" ? srcAcc.owner : "HUSBAND",
          scope: "FAMILY",
          tag: "DEBT",
          note: `${isBorrow ? "Trả nợ" : "Thu nợ"}: ${targetDebt.name}`,
        });
      }
    },
    [debts, accounts, addTransaction, queueCloudMutation]
  );

  const deleteDebt = useCallback(
    (id: string) => {
      setDebts((prev) => prev.filter((d) => d.id !== id));
      queueCloudMutation({ type: "DELETE_DEBT", id });
    },
    [queueCloudMutation]
  );

  const addInvestment = useCallback(
    (inv: Omit<InvestmentItem, "id">) => {
      const newInv: InvestmentItem = { ...inv, id: `inv_${Date.now()}` };
      setInvestments((prev) => [...prev, newInv]);
      queueCloudMutation({ type: "UPSERT_INVESTMENT", payload: newInv });
    },
    [queueCloudMutation]
  );

  const updateInvestment = useCallback(
    (id: string, inv: Partial<InvestmentItem>) => {
      setInvestments((prev) => {
        let target: InvestmentItem | undefined;
        const next = prev.map((i) => {
          if (i.id === id) {
            target = { ...i, ...inv };
            return target;
          }
          return i;
        });
        if (target) {
          queueCloudMutation({ type: "UPSERT_INVESTMENT", payload: target });
        }
        return next;
      });
    },
    [queueCloudMutation]
  );

  const deleteInvestment = useCallback(
    (id: string) => {
      setInvestments((prev) => prev.filter((i) => i.id !== id));
      queueCloudMutation({ type: "DELETE_INVESTMENT", id });
    },
    [queueCloudMutation]
  );

  // Giao dịch Định kỳ (Recurring Rules)
  const addRecurringRule = useCallback(
    (rule: Omit<RecurringRule, "id">) => {
      const newRule: RecurringRule = { ...rule, id: `rec_${Date.now()}` };
      setRecurringRules((prev) => [...prev, newRule]);
      queueCloudMutation({ type: "UPSERT_RECURRING_RULE", payload: newRule });
    },
    [queueCloudMutation]
  );

  const updateRecurringRule = useCallback(
    (id: string, rule: Partial<RecurringRule>) => {
      if (rule.autoPost) {
        pausedAutoPostKeysRef.current.delete(`${id}_${getCurrentMonthKey()}`);
      }
      setRecurringRules((prev) => {
        let target: RecurringRule | undefined;
        const next = prev.map((r) => {
          if (r.id !== id) return r;
          target = { ...r, ...rule };
          return target;
        });
        if (target) {
          queueCloudMutation({ type: "UPSERT_RECURRING_RULE", payload: target });
        }
        return next;
      });
    },
    [queueCloudMutation]
  );

  const deleteRecurringRule = useCallback(
    (id: string) => {
      setRecurringRules((prev) => prev.filter((r) => r.id !== id));
      queueCloudMutation({ type: "DELETE_RECURRING_RULE", id });
    },
    [queueCloudMutation]
  );

  const applyRecurringRule = useCallback(
    (id: string, targetMonth?: string): Transaction | null => {
      const rule = recurringRules.find((r) => r.id === id);
      if (!rule) return null;

      const month =
        targetMonth ||
        (selectedMonth !== "ALL" ? selectedMonth : getCurrentMonthKey());
      const safeDay = Math.min(28, Math.max(1, rule.dayOfMonth));
      const txDate = `${month}-${String(safeDay).padStart(2, "0")}`;

      const created = addTransaction({
        amount: rule.amount,
        date: txDate,
        type: rule.type,
        categoryId: rule.categoryId,
        accountId: rule.accountId,
        toAccountId: rule.toAccountId,
        memberId: rule.memberId,
        scope: rule.scope,
        tag: "RECURRING",
        note: rule.note ? `${rule.name} (${rule.note})` : rule.name,
      });

      setRecurringRules((prev) => {
        let updated: RecurringRule | undefined;
        const next = prev.map((r) => {
          if (r.id !== id) return r;
          updated = { ...r, lastAppliedMonth: month };
          return updated;
        });
        if (updated) {
          queueCloudMutation({ type: "UPSERT_RECURRING_RULE", payload: updated });
        }
        return next;
      });

      return created;
    },
    [recurringRules, selectedMonth, addTransaction, queueCloudMutation]
  );

  const applyAllPendingRecurringRules = useCallback(
    (targetMonth?: string): number => {
      const month =
        targetMonth ||
        (selectedMonth !== "ALL" ? selectedMonth : getCurrentMonthKey());
      const pending = recurringRules.filter(
        (r) => r.isActive && r.lastAppliedMonth !== month
      );
      if (pending.length === 0) return 0;

      const batchInputs: TransactionInput[] = pending.map((rule) => {
        const safeDay = Math.min(28, Math.max(1, rule.dayOfMonth));
        return {
          amount: rule.amount,
          date: `${month}-${String(safeDay).padStart(2, "0")}`,
          type: rule.type,
          categoryId: rule.categoryId,
          accountId: rule.accountId,
          toAccountId: rule.toAccountId,
          memberId: rule.memberId,
          scope: rule.scope,
          tag: "RECURRING",
          note: rule.note ? `${rule.name} (${rule.note})` : rule.name,
        };
      });

      addTransactionsBatch(batchInputs);

      const pendingIds = new Set(pending.map((p) => p.id));
      setRecurringRules((prev) => {
        const updatedList: RecurringRule[] = [];
        const next = prev.map((r) => {
          if (!pendingIds.has(r.id)) return r;
          const updated = { ...r, lastAppliedMonth: month };
          updatedList.push(updated);
          return updated;
        });
        if (updatedList.length > 0) {
          queueCloudMutation({
            type: "UPSERT_RECURRING_RULES_BATCH",
            payload: updatedList,
          });
        }
        return next;
      });

      return pending.length;
    },
    [recurringRules, selectedMonth, addTransactionsBatch, queueCloudMutation]
  );

  const [quickRecordUndo, setQuickRecordUndo] = useState<QuickRecordUndoEntry | null>(null);
  const undoTimerRef = useRef<number | null>(null);
  const pausedAutoPostKeysRef = useRef<Set<string>>(new Set());
  const [autoPostNotice, setAutoPostNotice] = useState<AutoPostNotice | null>(null);

  const dismissAutoPostNotice = useCallback(() => {
    setAutoPostNotice(null);
  }, []);

  const scheduleUndoAutoDismiss = useCallback(() => {
    if (typeof window === "undefined") return;
    if (undoTimerRef.current !== null) {
      window.clearTimeout(undoTimerRef.current);
    }
    undoTimerRef.current = window.setTimeout(() => {
      setQuickRecordUndo(null);
      undoTimerRef.current = null;
    }, 12000);
  }, []);

  const dismissQuickRecordUndo = useCallback(() => {
    if (typeof window !== "undefined" && undoTimerRef.current !== null) {
      window.clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    setQuickRecordUndo(null);
  }, []);

  const quickApplyRecurringNotification = useCallback(
    (ruleId: string, monthKey?: string): Transaction | null => {
      const targetRule = recurringRules.find((r) => r.id === ruleId);
      if (!targetRule) return null;
      const targetMonth =
        monthKey || (selectedMonth !== "ALL" ? selectedMonth : getCurrentMonthKey());
      const prevApplied = targetRule.lastAppliedMonth;
      const created = applyRecurringRule(ruleId, targetMonth);
      if (!created) return null;

      setQuickRecordUndo({
        id: `undo_rec_${ruleId}_${Date.now()}`,
        kind: "RECURRING_RULE",
        label: targetRule.name,
        amount: created.amount,
        monthKey: targetMonth,
        ruleId,
        transactionId: created.id,
        previousLastAppliedMonth: prevApplied,
        createdAt: Date.now(),
      });
      scheduleUndoAutoDismiss();
      return created;
    },
    [recurringRules, selectedMonth, applyRecurringRule, scheduleUndoAutoDismiss]
  );

  const updateSkyOneContract = useCallback(
    (patch: Partial<MortgageContract>) => {
      setSkyoneLoan((prev) => {
        const rawTerm = patch.termMonths ?? prev.termMonths;
        const cleanTerm = Math.max(12, Math.min(MAX_MORTGAGE_TERM_MONTHS, Math.round(rawTerm)));
        const rawFixed = patch.fixedRateMonths ?? prev.fixedRateMonths;
        const cleanFixed = Math.max(0, Math.min(cleanTerm, Math.round(rawFixed)));
        const next: MortgageContract = {
          ...prev,
          ...patch,
          termMonths: cleanTerm,
          fixedRateMonths: cleanFixed,
          updatedAt: new Date().toISOString(),
        };
        queueCloudMutation({ type: "UPSERT_SKYONE_LOAN", payload: next });
        return next;
      });
    },
    [queueCloudMutation]
  );

  const setSkyOneCashflowLocked = useCallback(
    (locked: boolean) => {
      setSkyoneLoan((prev) => {
        const next: MortgageContract = {
          ...prev,
          cashflowLocked: locked,
          updatedAt: new Date().toISOString(),
        };
        queueCloudMutation({ type: "UPSERT_SKYONE_LOAN", payload: next });
        return next;
      });
    },
    [queueCloudMutation]
  );

  const saveAndLockSkyOneCashflow = useCallback(
    (input: {
      contractPatch?: Partial<MortgageContract>;
      periodOverrides: MortgagePeriodCashflowOverride[];
    }) => {
      const cleanedOverrides = input.periodOverrides
        .filter(
          (ov) =>
            ov.principal !== undefined ||
            ov.interest !== undefined ||
            ov.appliedRate !== undefined ||
            ov.paidAt !== undefined ||
            (ov.note !== undefined && ov.note.trim().length > 0)
        )
        .sort((a, b) => a.period - b.period);

      const overrideByPeriod = new Map(cleanedOverrides.map((ov) => [ov.period, ov]));

      // Sync linked HOME MONI transactions if any paid record changed principal/interest
      skyoneLoan.paidRecords.forEach((rec) => {
        const ov = overrideByPeriod.get(rec.period);
        if (!ov || !rec.linkedTransactionId) return;
        const nextPrincipal =
          ov.principal !== undefined ? Math.max(0, Math.round(ov.principal)) : rec.paidPrincipal;
        const nextInterest =
          ov.interest !== undefined ? Math.max(0, Math.round(ov.interest)) : rec.paidInterest;
        updateTransaction(rec.linkedTransactionId, {
          amount: nextPrincipal + nextInterest,
          date: ov.paidAt || rec.paidAt,
          note: `${skyoneLoan.projectName} · Kỳ #${rec.period} (Gốc ${nextPrincipal.toLocaleString(
            "vi-VN"
          )}đ + Lãi ${nextInterest.toLocaleString("vi-VN")}đ${ov.note ? ` · ${ov.note}` : ""})`,
        });
      });

      setSkyoneLoan((prev) => {
        const patch = input.contractPatch || {};
        const rawTerm = patch.termMonths ?? prev.termMonths;
        const cleanTerm = Math.max(12, Math.min(MAX_MORTGAGE_TERM_MONTHS, Math.round(rawTerm)));
        const rawFixed = patch.fixedRateMonths ?? prev.fixedRateMonths;
        const cleanFixed = Math.max(0, Math.min(cleanTerm, Math.round(rawFixed)));

        const updatedPaidRecords = prev.paidRecords.map((rec) => {
          const ov = overrideByPeriod.get(rec.period);
          if (!ov) return rec;
          return {
            ...rec,
            paidPrincipal:
              ov.principal !== undefined ? Math.max(0, Math.round(ov.principal)) : rec.paidPrincipal,
            paidInterest:
              ov.interest !== undefined ? Math.max(0, Math.round(ov.interest)) : rec.paidInterest,
            appliedRate: ov.appliedRate !== undefined ? ov.appliedRate : rec.appliedRate,
            paidAt: ov.paidAt || rec.paidAt,
            note: ov.note !== undefined ? ov.note : rec.note,
          };
        });

        const next: MortgageContract = {
          ...prev,
          ...patch,
          termMonths: cleanTerm,
          fixedRateMonths: cleanFixed,
          paidRecords: updatedPaidRecords,
          periodOverrides: cleanedOverrides,
          cashflowLocked: true,
          updatedAt: new Date().toISOString(),
        };
        queueCloudMutation({ type: "UPSERT_SKYONE_LOAN", payload: next });
        return next;
      });
    },
    [skyoneLoan.paidRecords, skyoneLoan.projectName, updateTransaction, queueCloudMutation]
  );

  const confirmSkyOnePeriods = useCallback(
    (
      periods: number[],
      options?: { linkAccountId?: string; paidAt?: string; note?: string }
    ): number => {
      if (periods.length === 0) return 0;
      const periodSet = new Set(periods);
      const paidDate = options?.paidAt || getTodayIsoDate();
      // Tái lập lịch với Ngày trả thực tế để đảm bảo tiền lãi Actual/365 khớp tuyệt đối 100%
      const effectiveContract = applyActualPaymentDateOverrides(
        skyoneLoan,
        periods,
        paidDate
      );
      const schedule = generateMortgageSchedule(effectiveContract);
      const targets = schedule.rows.filter(
        (r) => periodSet.has(r.period) && r.status !== "PAID"
      );
      if (targets.length === 0) return 0;

      let createdTxs: Transaction[] = [];

      if (options?.linkAccountId) {
        const srcAcc = accounts.find((a) => a.id === options.linkAccountId);
        const ownerMember: FamilyMember =
          srcAcc?.owner && srcAcc.owner !== "SHARED" ? srcAcc.owner : "HUSBAND";
        const txInputs: TransactionInput[] = targets.map((row) => ({
          amount: row.totalPayment,
          date: row.dueDate,
          type: "EXPENSE",
          categoryId: "cat_expense_rent",
          accountId: options.linkAccountId!,
          memberId: ownerMember,
          scope: "FAMILY",
          tag: "DEBT",
          note: `${skyoneLoan.projectName} · Kỳ #${row.period} (Gốc ${row.principal.toLocaleString(
            "vi-VN"
          )}đ + Lãi ${row.interest.toLocaleString("vi-VN")}đ · ${row.dayCountUsed} ngày Actual/365)`,
        }));
        createdTxs = addTransactionsBatch(txInputs);
      }

      const newRecords: MortgagePaidInstallmentRecord[] = targets.map((row, idx) => ({
        period: row.period,
        paidAt: row.dueDate,
        paidPrincipal: row.principal,
        paidInterest: row.interest,
        appliedRate: row.appliedRate,
        linkedTransactionId: createdTxs[idx]?.id,
        note: options?.note,
      }));

      setSkyoneLoan((prev) => {
        const existingPeriods = new Set(prev.paidRecords.map((r) => r.period));
        const merged = [
          ...prev.paidRecords,
          ...newRecords.filter((r) => !existingPeriods.has(r.period)),
        ].sort((a, b) => a.period - b.period);

        // Làm sạch override paidAt/interest thừa trên các kỳ vừa chốt (vì đã lưu cứng vào paidRecords)
        const confirmedSet = new Set(newRecords.map((r) => r.period));
        const cleanedOverrides = (prev.periodOverrides || [])
          .map((ov) => {
            if (confirmedSet.has(ov.period)) {
              return { ...ov, paidAt: undefined, interest: undefined };
            }
            if (confirmedSet.has(ov.period - 1) && ov.interest !== undefined) {
              return { ...ov, interest: undefined };
            }
            return ov;
          })
          .filter(
            (ov) =>
              ov.principal !== undefined ||
              ov.interest !== undefined ||
              ov.appliedRate !== undefined ||
              Boolean(ov.paidAt) ||
              Boolean(ov.note)
          );

        const next: MortgageContract = {
          ...prev,
          paidRecords: merged,
          periodOverrides: cleanedOverrides,
          updatedAt: new Date().toISOString(),
        };
        queueCloudMutation({ type: "UPSERT_SKYONE_LOAN", payload: next });
        return next;
      });

      return newRecords.length;
    },
    [skyoneLoan, accounts, addTransactionsBatch, queueCloudMutation]
  );

  const undoSkyOnePeriod = useCallback(
    (period: number) => {
      const targetRecord = skyoneLoan.paidRecords.find((r) => r.period === period);
      if (targetRecord?.linkedTransactionId) {
        deleteTransaction(targetRecord.linkedTransactionId);
      }
      setSkyoneLoan((prev) => {
        const next: MortgageContract = {
          ...prev,
          paidRecords: prev.paidRecords.filter((r) => r.period !== period),
          updatedAt: new Date().toISOString(),
        };
        queueCloudMutation({ type: "UPSERT_SKYONE_LOAN", payload: next });
        return next;
      });
    },
    [skyoneLoan.paidRecords, deleteTransaction, queueCloudMutation]
  );

  const addSkyOnePrepayment = useCallback(
    (input: {
      amount: number;
      afterPeriod?: number;
      strategy: MortgagePrepayStrategy;
      date: string;
      note?: string;
      linkAccountId?: string;
    }) => {
      const sim = simulatePrepayment(skyoneLoan, {
        amount: input.amount,
        afterPeriod: input.afterPeriod,
        strategy: input.strategy,
        referenceDate: input.date,
      });

      const appliedAmount = Math.min(
        Math.max(0, Math.round(input.amount)),
        sim.remainingBalanceBefore
      );
      if (appliedAmount <= 0) return;

      let linkedTransactionId: string | undefined;
      if (input.linkAccountId) {
        const srcAcc = accounts.find((a) => a.id === input.linkAccountId);
        const totalOutflow = appliedAmount + sim.penaltyAmount;
        const tx = addTransaction({
          amount: totalOutflow,
          date: input.date,
          type: "EXPENSE",
          categoryId: "cat_expense_rent",
          accountId: input.linkAccountId,
          memberId: srcAcc?.owner && srcAcc.owner !== "SHARED" ? srcAcc.owner : "HUSBAND",
          scope: "FAMILY",
          tag: "DEBT",
          note: `Trả gốc trước hạn ${skyoneLoan.projectName}${
            sim.penaltyAmount > 0
              ? ` (gồm phí phạt ${sim.penaltyAmount.toLocaleString("vi-VN")}đ)`
              : ""
          }${input.note ? ` · ${input.note}` : ""}`,
        });
        linkedTransactionId = tx.id;
      }

      setSkyoneLoan((prev) => {
        const next: MortgageContract = {
          ...prev,
          prepayments: [
            ...prev.prepayments,
            {
              id: `prepay_${Date.now()}`,
              date: input.date,
              afterPeriod: sim.appliedAfterPeriod,
              amount: appliedAmount,
              penaltyAmount: sim.penaltyAmount,
              feePercent: sim.penaltyFeePercent,
              strategy: input.strategy,
              linkedTransactionId,
              note: input.note?.trim() || undefined,
            },
          ].sort((a, b) => a.afterPeriod - b.afterPeriod || a.date.localeCompare(b.date)),
          updatedAt: new Date().toISOString(),
        };
        queueCloudMutation({ type: "UPSERT_SKYONE_LOAN", payload: next });
        return next;
      });
    },
    [skyoneLoan, accounts, addTransaction, queueCloudMutation]
  );

  const deleteSkyOnePrepayment = useCallback(
    (id: string) => {
      const targetPrepay = skyoneLoan.prepayments.find((p) => p.id === id);
      if (targetPrepay?.linkedTransactionId) {
        deleteTransaction(targetPrepay.linkedTransactionId);
      }
      setSkyoneLoan((prev) => {
        const next: MortgageContract = {
          ...prev,
          prepayments: prev.prepayments.filter((p) => p.id !== id),
          updatedAt: new Date().toISOString(),
        };
        queueCloudMutation({ type: "UPSERT_SKYONE_LOAN", payload: next });
        return next;
      });
    },
    [skyoneLoan.prepayments, deleteTransaction, queueCloudMutation]
  );

  const skyoneLinkedTxMap = useMemo(() => {
    const map = new Map<string, SkyOneTransactionLink>();
    skyoneLoan.paidRecords.forEach((rec) => {
      if (rec.linkedTransactionId) {
        map.set(rec.linkedTransactionId, {
          kind: "INSTALLMENT",
          period: rec.period,
          label: `Xem kỳ #${rec.period} trong SKYONE`,
        });
      }
    });
    skyoneLoan.prepayments.forEach((prep) => {
      if (prep.linkedTransactionId) {
        map.set(prep.linkedTransactionId, {
          kind: "PREPAYMENT",
          prepaymentId: prep.id,
          label: "Xem trả trước hạn SKYONE",
        });
      }
    });
    return map;
  }, [skyoneLoan.paidRecords, skyoneLoan.prepayments]);

  const getSkyOneLinkForTransaction = useCallback(
    (txId: string) => skyoneLinkedTxMap.get(txId),
    [skyoneLinkedTxMap]
  );

  const addSkyOneRateAdjustment = useCallback(
    (adj: Omit<MortgageRateAdjustment, "id">) => {
      setSkyoneLoan((prev) => {
        const next: MortgageContract = {
          ...prev,
          rateAdjustments: [
            ...prev.rateAdjustments,
            {
              ...adj,
              id: `rate_adj_${Date.now()}`,
            },
          ].sort((a, b) => a.effectiveFromPeriod - b.effectiveFromPeriod),
          updatedAt: new Date().toISOString(),
        };
        queueCloudMutation({ type: "UPSERT_SKYONE_LOAN", payload: next });
        return next;
      });
    },
    [queueCloudMutation]
  );

  const deleteSkyOneRateAdjustment = useCallback(
    (id: string) => {
      setSkyoneLoan((prev) => {
        const next: MortgageContract = {
          ...prev,
          rateAdjustments: prev.rateAdjustments.filter((r) => r.id !== id),
          updatedAt: new Date().toISOString(),
        };
        queueCloudMutation({ type: "UPSERT_SKYONE_LOAN", payload: next });
        return next;
      });
    },
    [queueCloudMutation]
  );

  const toggleSkyOnePinkBook5Pct = useCallback(
    (enabled?: boolean) => {
      setSkyoneLoan((prev) => {
        const next: MortgageContract = {
          ...togglePinkBook5PctDisbursement(prev, enabled),
          updatedAt: new Date().toISOString(),
        };
        queueCloudMutation({ type: "UPSERT_SKYONE_LOAN", payload: next });
        return next;
      });
    },
    [queueCloudMutation]
  );

  const resetSkyOneLoan = useCallback(() => {
    const next = createDefaultSkyOneLoan();
    setSkyoneLoan(next);
    queueCloudMutation({ type: "UPSERT_SKYONE_LOAN", payload: next });
  }, [queueCloudMutation]);

  const updateSettings = useCallback(
    (newSettings: Partial<AppSettings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...newSettings };
        const touchesShared =
          newSettings.themeColor !== undefined ||
          newSettings.notificationsEnabled !== undefined ||
          newSettings.husbandName !== undefined ||
          newSettings.wifeName !== undefined ||
          newSettings.sharedSplitRatioHusband !== undefined;

        if (touchesShared) {
          queueCloudMutation({ type: "UPSERT_SETTINGS", payload: next });
        }
        return next;
      });
    },
    [queueCloudMutation]
  );

  const runAutoPostForDueRules = useCallback((): {
    postedCount: number;
    skippedCount: number;
  } => {
    if (!isLoaded) return { postedCount: 0, skippedCount: 0 };

    const currentMonth = getCurrentMonthKey();
    const eligibleRules = recurringRules.filter(
      (r) => !pausedAutoPostKeysRef.current.has(`${r.id}_${currentMonth}`)
    );

    const evalResult = evaluateAutoPostCandidates({
      rules: eligibleRules,
      transactions,
    });

    if (evalResult.toPost.length === 0 && evalResult.skippedDuplicates.length === 0) {
      return { postedCount: 0, skippedCount: 0 };
    }

    let createdTxs: Transaction[] = [];
    if (evalResult.toPost.length > 0) {
      const inputs: TransactionInput[] = evalResult.toPost.map(({ rule, txDate }) => ({
        amount: rule.amount,
        date: txDate,
        type: rule.type,
        categoryId: rule.categoryId,
        accountId: rule.accountId,
        toAccountId: rule.toAccountId,
        memberId: rule.memberId,
        scope: rule.scope,
        tag: "RECURRING",
        note: rule.note ? `${rule.name} (${rule.note})` : rule.name,
      }));
      createdTxs = addTransactionsBatch(inputs);
    }

    const postedIdSet = new Set(evalResult.toPost.map((p) => p.rule.id));
    const skippedIdSet = new Set(evalResult.skippedDuplicates.map((s) => s.rule.id));

    setRecurringRules((prev) => {
      const updatedBatch: RecurringRule[] = [];
      const next = prev.map((r) => {
        if (postedIdSet.has(r.id)) {
          const updated: RecurringRule = {
            ...r,
            lastAppliedMonth: evalResult.monthKey,
            lastSkippedDuplicateMonth: undefined,
          };
          updatedBatch.push(updated);
          return updated;
        }
        if (skippedIdSet.has(r.id)) {
          const updated: RecurringRule = {
            ...r,
            lastAppliedMonth: evalResult.monthKey,
            lastSkippedDuplicateMonth: evalResult.monthKey,
          };
          updatedBatch.push(updated);
          return updated;
        }
        return r;
      });
      if (updatedBatch.length > 0) {
        queueCloudMutation({
          type: "UPSERT_RECURRING_RULES_BATCH",
          payload: updatedBatch,
        });
      }
      return next;
    });

    if (evalResult.toPost.length === 1 && createdTxs[0]) {
      const single = evalResult.toPost[0];
      setQuickRecordUndo({
        id: `undo_auto_${single.rule.id}_${Date.now()}`,
        kind: "RECURRING_RULE",
        label: `Tự ghi: ${single.rule.name}`,
        amount: createdTxs[0].amount,
        monthKey: evalResult.monthKey,
        ruleId: single.rule.id,
        transactionId: createdTxs[0].id,
        previousLastAppliedMonth: single.rule.lastAppliedMonth,
        createdAt: Date.now(),
      });
      scheduleUndoAutoDismiss();
    }

    if (evalResult.toPost.length > 0 || evalResult.skippedDuplicates.length > 0) {
      setAutoPostNotice({
        monthKey: evalResult.monthKey,
        postedNames: evalResult.toPost.map((p) => p.rule.name),
        skippedNames: evalResult.skippedDuplicates.map((s) => s.rule.name),
        postedCount: evalResult.toPost.length,
        skippedCount: evalResult.skippedDuplicates.length,
      });
    }

    return {
      postedCount: evalResult.toPost.length,
      skippedCount: evalResult.skippedDuplicates.length,
    };
  }, [
    isLoaded,
    recurringRules,
    transactions,
    addTransactionsBatch,
    queueCloudMutation,
    scheduleUndoAutoDismiss,
  ]);

  useEffect(() => {
    if (!isLoaded) return;
    runAutoPostForDueRules();
  }, [isLoaded, runAutoPostForDueRules]);

  const recurringHistorySuggestions = useMemo(() => {
    const categoryNameMap = new Map(categories.map((c) => [c.id, c.name]));
    return detectRecurringSuggestionsFromHistory({
      transactions,
      existingRules: recurringRules,
      dismissedSignatures: settings.dismissedRecurringSuggestionKeys,
      categoryNameMap,
    });
  }, [
    transactions,
    recurringRules,
    categories,
    settings.dismissedRecurringSuggestionKeys,
  ]);

  const acceptRecurringSuggestion = useCallback(
    (
      suggestion: RecurringHistorySuggestion,
      options?: { autoPost?: boolean }
    ): RecurringRule => {
      const currentMonth = getCurrentMonthKey();
      const newRule: RecurringRule = {
        id: `rec_${Date.now()}`,
        name: suggestion.suggestedName,
        amount: suggestion.amount,
        type: suggestion.type,
        categoryId: suggestion.categoryId,
        accountId: suggestion.accountId,
        memberId: suggestion.memberId,
        scope: suggestion.scope,
        dayOfMonth: suggestion.dayOfMonth,
        isActive: true,
        autoPost: options?.autoPost ?? true,
        lastAppliedMonth: suggestion.alreadyLoggedCurrentMonth
          ? currentMonth
          : undefined,
        note: `Tạo từ lịch sử (${suggestion.confidenceLabel})`,
      };
      setRecurringRules((prev) => [...prev, newRule]);
      queueCloudMutation({ type: "UPSERT_RECURRING_RULE", payload: newRule });
      return newRule;
    },
    [queueCloudMutation]
  );

  const dismissRecurringSuggestion = useCallback(
    (signature: string) => {
      const current = settings.dismissedRecurringSuggestionKeys || [];
      if (current.includes(signature)) return;
      updateSettings({
        dismissedRecurringSuggestionKeys: [...current, signature],
      });
    },
    [settings.dismissedRecurringSuggestionKeys, updateSettings]
  );

  // =========================================================================
  // KHO TÍCH SẢN VÀNG (GOLD SUB-APP) ACTIONS
  // =========================================================================
  const updateGoldPortfolioState = useCallback(
    (updater: (prev: GoldPortfolioState) => GoldPortfolioState) => {
      setGoldPortfolio((prev) => {
        const next = {
          ...updater(prev),
          updatedAt: new Date().toISOString(),
        };
        queueCloudMutation({ type: "UPSERT_GOLD_PORTFOLIO", payload: next });
        return next;
      });
    },
    [queueCloudMutation]
  );

  const addGoldLot = useCallback(
    (
      lot: Omit<GoldLot, "id" | "remainingChi" | "status" | "createdAt" | "updatedAt">,
      options?: { linkAccountId?: string }
    ): GoldLot => {
      const nowIso = new Date().toISOString();
      let linkedTransactionId = lot.linkedTransactionId;
      const totalBuyCost = Math.round(lot.quantityChi * lot.unitBuyPricePerChi + lot.makingFee);

      if (options?.linkAccountId && totalBuyCost > 0) {
        const tx = addTransaction({
          amount: totalBuyCost,
          date: lot.purchaseDate,
          type: "EXPENSE",
          categoryId:
            categories.find((c) => c.type === "EXPENSE" && c.name.toLowerCase().includes("đầu tư"))?.id ||
            "cat_expense_other",
          accountId: options.linkAccountId,
          memberId: lot.memberId,
          scope: "FAMILY",
          tag: "INVESTMENT",
          note: `Mua ${lot.quantityChi} chỉ ${lot.brand} (${lot.category})${lot.invoiceNote ? ` · ${lot.invoiceNote}` : ""}`,
        });
        linkedTransactionId = tx.id;
      }

      const newLot: GoldLot = {
        ...lot,
        id: `gold_lot_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        remainingChi: lot.quantityChi,
        status: "HOLDING",
        linkedTransactionId,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      updateGoldPortfolioState((prev) => ({
        ...prev,
        lots: [newLot, ...prev.lots],
      }));
      return newLot;
    },
    [addTransaction, categories, updateGoldPortfolioState]
  );

  const updateGoldLot = useCallback(
    (id: string, patch: Partial<GoldLot>) => {
      updateGoldPortfolioState((prev) => ({
        ...prev,
        lots: prev.lots.map((l) =>
          l.id === id ? { ...l, ...patch, updatedAt: new Date().toISOString() } : l
        ),
      }));
    },
    [updateGoldPortfolioState]
  );

  const deleteGoldLot = useCallback(
    (id: string) => {
      updateGoldPortfolioState((prev) => ({
        ...prev,
        lots: prev.lots.filter((l) => l.id !== id),
      }));
    },
    [updateGoldPortfolioState]
  );

  const recordGoldSale = useCallback(
    (input: {
      saleDate: string;
      category: GoldCategory;
      quantityChi: number;
      unitSellPricePerChi: number;
      mode: "FIFO" | "SPECIFIC_LOT";
      specificLotId?: string;
      purpose: GoldSalePurpose;
      note?: string;
      linkAccountId?: string;
    }): { ok: boolean; saleEvent?: GoldSaleEvent; error?: string } => {
      const allocationResult =
        input.mode === "SPECIFIC_LOT" && input.specificLotId
          ? allocateSpecificLotSale(goldPortfolio.lots, input.specificLotId, input.quantityChi)
          : allocateFifoGoldSale(goldPortfolio.lots, input.category, input.quantityChi);

      if (!allocationResult.ok) {
        return { ok: false, error: allocationResult.error };
      }

      const totalCostBasis = allocationResult.allocations.reduce(
        (sum, alloc) => sum + alloc.costBasisAllocated,
        0
      );
      const totalProceeds = Math.round(input.quantityChi * input.unitSellPricePerChi);
      const realizedPnl = totalProceeds - totalCostBasis;

      let linkedTransactionId: string | undefined;
      if (input.linkAccountId && totalProceeds > 0) {
        const tx = addTransaction({
          amount: totalProceeds,
          date: input.saleDate,
          type: "INCOME",
          categoryId:
            categories.find((c) => c.type === "INCOME" && c.name.toLowerCase().includes("đầu tư"))?.id ||
            categories.find((c) => c.type === "INCOME")?.id ||
            "cat_income_other",
          accountId: input.linkAccountId,
          memberId: "SHARED",
          scope: "FAMILY",
          tag: "INVESTMENT",
          note: `Bán ${input.quantityChi} chỉ vàng (${input.category}) · ${input.purpose}${input.note ? ` · ${input.note}` : ""}`,
        });
        linkedTransactionId = tx.id;
      }

      const saleEvent: GoldSaleEvent = {
        id: `gold_sale_${Date.now()}`,
        saleDate: input.saleDate,
        category: input.category,
        allocations: allocationResult.allocations,
        totalSoldChi: input.quantityChi,
        unitSellPricePerChi: input.unitSellPricePerChi,
        totalProceeds,
        costBasisAllocated: totalCostBasis,
        realizedPnl,
        purpose: input.purpose,
        linkedTransactionId,
        note: input.note,
        createdAt: new Date().toISOString(),
      };

      updateGoldPortfolioState((prev) => ({
        ...prev,
        lots: allocationResult.updatedLots,
        sales: [saleEvent, ...prev.sales],
      }));

      return { ok: true, saleEvent };
    },
    [goldPortfolio.lots, addTransaction, categories, updateGoldPortfolioState]
  );

  const updateGoldPriceQuote = useCallback(
    (
      category: GoldCategory,
      patch: Partial<Pick<GoldPriceQuote, "brandLabel" | "buyPricePerChi" | "sellPricePerChi" | "source">>
    ) => {
      updateGoldPortfolioState((prev) => ({
        ...prev,
        quotes: {
          ...prev.quotes,
          [category]: {
            ...prev.quotes[category],
            ...patch,
            source: patch.source ?? "MANUAL",
            updatedAt: new Date().toISOString(),
          },
        },
      }));
    },
    [updateGoldPortfolioState]
  );

  const updateGoldMacro = useCallback(
    (patch: Partial<Pick<GoldMacroContext, "worldXauUsdPerOz" | "usdVndRate">>) => {
      updateGoldPortfolioState((prev) => ({
        ...prev,
        macro: {
          ...prev.macro,
          ...patch,
          updatedAt: new Date().toISOString(),
        },
      }));
    },
    [updateGoldPortfolioState]
  );

  const updateGoldDcaPlan = useCallback(
    (patch: Partial<GoldDcaPlan>) => {
      updateGoldPortfolioState((prev) => ({
        ...prev,
        dcaPlan: {
          ...prev.dcaPlan,
          ...patch,
        },
      }));
    },
    [updateGoldPortfolioState]
  );

  const toggleGoldIncludeInNetWorth = useCallback(
    (include: boolean) => {
      updateGoldPortfolioState((prev) => ({
        ...prev,
        includeInNetWorth: include,
      }));
    },
    [updateGoldPortfolioState]
  );

  const fetchReferenceGoldPrices = useCallback(
    async (
      force = false
    ): Promise<{ ok: boolean; mode?: string; note?: string; error?: string }> => {
      try {
        const res = await fetch(`/api/gold/reference-prices${force ? "?force=1" : ""}`);
        if (!res.ok) {
          return { ok: false, error: "Không thể lấy giá tham khảo từ máy chủ." };
        }
        const data = (await res.json()) as {
          mode?: string;
          fetchedAt?: string;
          note?: string;
          macro?: { worldXauUsdPerOz: number; usdVndRate: number };
          quotes?: Record<
            GoldCategory,
            { brandLabel: string; buyPricePerChi: number; sellPricePerChi: number }
          >;
        };
        const ts = data.fetchedAt || new Date().toISOString();
        updateGoldPortfolioState((prev) => {
          const nextQuotes = { ...prev.quotes };
          if (data.quotes) {
            (Object.keys(data.quotes) as GoldCategory[]).forEach((cat) => {
              const incoming = data.quotes![cat];
              if (incoming) {
                nextQuotes[cat] = {
                  category: cat,
                  brandLabel: incoming.brandLabel,
                  buyPricePerChi: incoming.buyPricePerChi,
                  sellPricePerChi: incoming.sellPricePerChi,
                  updatedAt: ts,
                  source: "SERVER_REFERENCE",
                };
              }
            });
          }
          return {
            ...prev,
            quotes: nextQuotes,
            macro: data.macro
              ? {
                  worldXauUsdPerOz: data.macro.worldXauUsdPerOz,
                  usdVndRate: data.macro.usdVndRate,
                  updatedAt: ts,
                }
              : prev.macro,
          };
        });
        return { ok: true, mode: data.mode, note: data.note };
      } catch {
        return { ok: false, error: "Đang ngoại tuyến hoặc máy chủ không phản hồi." };
      }
    },
    [updateGoldPortfolioState]
  );

  const resetGoldPortfolio = useCallback(() => {
    const fresh = createDefaultGoldPortfolio();
    setGoldPortfolio(fresh);
    queueCloudMutation({ type: "UPSERT_GOLD_PORTFOLIO", payload: fresh });
  }, [queueCloudMutation]);

  // =========================================================================
  // SKYONE 3D INTERIOR STUDIO ACTIONS (WITH UNDO / REDO)
  // =========================================================================
  const updateInteriorState = useCallback(
    (
      updater: (prev: InteriorStudioState) => InteriorStudioState,
      options?: { skipUndoHistory?: boolean }
    ) => {
      setInteriorStudio((prev) => {
        if (!options?.skipUndoHistory) {
          setInteriorUndoStack((stack) => [...stack.slice(-24), prev]);
          setInteriorRedoStack([]);
        }
        const next: InteriorStudioState = {
          ...updater(prev),
          updatedAt: new Date().toISOString(),
        };
        queueCloudMutation({ type: "UPSERT_INTERIOR_STUDIO", payload: next });
        return next;
      });
    },
    [queueCloudMutation]
  );

  const setActiveInteriorScenario = useCallback(
    (scenarioId: string) => {
      updateInteriorState(
        (prev) => ({
          ...prev,
          activeScenarioId: prev.scenarios.some((s) => s.id === scenarioId)
            ? scenarioId
            : prev.activeScenarioId,
        }),
        { skipUndoHistory: true }
      );
    },
    [updateInteriorState]
  );

  const updateInteriorScenarioMeta = useCallback(
    (
      scenarioId: string,
      patch: Partial<
        Pick<
          InteriorDesignScenario,
          "name" | "shortLabel" | "description" | "stylePreset" | "targetBudgetMinVnd" | "targetBudgetMaxVnd" | "contingencyPercent"
        >
      >
    ) => {
      updateInteriorState((prev) => ({
        ...prev,
        scenarios: prev.scenarios.map((sc) =>
          sc.id === scenarioId
            ? { ...sc, ...patch, updatedAt: new Date().toISOString() }
            : sc
        ),
      }));
    },
    [updateInteriorState]
  );

  const duplicateInteriorScenario = useCallback(
    (sourceScenarioId: string, newName?: string): InteriorDesignScenario | null => {
      const source = interiorStudio.scenarios.find((s) => s.id === sourceScenarioId);
      if (!source) return null;
      const nowIso = new Date().toISOString();
      const nextCode = String.fromCharCode(65 + interiorStudio.scenarios.length);
      const clone: InteriorDesignScenario = {
        ...source,
        id: `scenario_${Date.now()}`,
        code: nextCode,
        name: newName?.trim() || `${source.name} (Bản sao)`,
        shortLabel: `Phương án ${nextCode}`,
        items: source.items.map((it) => ({
          ...it,
          position: { ...it.position },
          dimensionsCm: { ...it.dimensionsCm },
          payments: it.payments ? it.payments.map((p) => ({ ...p })) : undefined,
        })),
        extraBoqItems: source.extraBoqItems.map((ex) => ({
          ...ex,
          payments: ex.payments ? ex.payments.map((p) => ({ ...p })) : undefined,
        })),
        mepPoints: (source.mepPoints ?? createDefaultSkyOneA2MepPoints()).map((m) => ({ ...m })),
        wallOverrides: source.wallOverrides
          ? Object.fromEntries(
              Object.entries(source.wallOverrides).map(([k, v]) => [k, { ...v }])
            )
          : undefined,
        doorOverrides: source.doorOverrides ? { ...source.doorOverrides } : undefined,
        roomFloorOverrides: source.roomFloorOverrides ? { ...source.roomFloorOverrides } : undefined,
        lightingZones: source.lightingZones ? { ...source.lightingZones } : undefined,
        curtainOpenRatio: source.curtainOpenRatio,
        updatedAt: nowIso,
      };
      updateInteriorState((prev) => ({
        ...prev,
        activeScenarioId: clone.id,
        scenarios: [...prev.scenarios, clone],
      }));
      return clone;
    },
    [interiorStudio.scenarios, updateInteriorState]
  );

  const addInteriorFurnitureItem = useCallback(
    (item: Omit<InteriorFurnitureItem, "id">): InteriorFurnitureItem => {
      const created: InteriorFurnitureItem = {
        ...item,
        id: `furn_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      };
      updateInteriorState((prev) => ({
        ...prev,
        scenarios: prev.scenarios.map((sc) =>
          sc.id === prev.activeScenarioId
            ? { ...sc, items: [...sc.items, created], updatedAt: new Date().toISOString() }
            : sc
        ),
      }));
      return created;
    },
    [updateInteriorState]
  );

  const updateInteriorFurnitureItem = useCallback(
    (
      id: string,
      patch: Partial<InteriorFurnitureItem>,
      options?: { skipUndoHistory?: boolean }
    ) => {
      updateInteriorState(
        (prev) => ({
          ...prev,
          scenarios: prev.scenarios.map((sc) =>
            sc.id === prev.activeScenarioId
              ? {
                  ...sc,
                  items: sc.items.map((it) => (it.id === id ? { ...it, ...patch } : it)),
                  updatedAt: new Date().toISOString(),
                }
              : sc
          ),
        }),
        options
      );
    },
    [updateInteriorState]
  );

  const deleteInteriorFurnitureItem = useCallback(
    (id: string) => {
      updateInteriorState((prev) => ({
        ...prev,
        scenarios: prev.scenarios.map((sc) =>
          sc.id === prev.activeScenarioId
            ? {
                ...sc,
                items: sc.items.filter((it) => it.id !== id),
                updatedAt: new Date().toISOString(),
              }
            : sc
        ),
      }));
    },
    [updateInteriorState]
  );

  const addInteriorExtraBoqItem = useCallback(
    (item: Omit<InteriorExtraBoqItem, "id">): InteriorExtraBoqItem => {
      const created: InteriorExtraBoqItem = {
        ...item,
        id: `boq_extra_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      };
      updateInteriorState((prev) => ({
        ...prev,
        scenarios: prev.scenarios.map((sc) =>
          sc.id === prev.activeScenarioId
            ? {
                ...sc,
                extraBoqItems: [...sc.extraBoqItems, created],
                updatedAt: new Date().toISOString(),
              }
            : sc
        ),
      }));
      return created;
    },
    [updateInteriorState]
  );

  const updateInteriorExtraBoqItem = useCallback(
    (id: string, patch: Partial<InteriorExtraBoqItem>) => {
      updateInteriorState((prev) => ({
        ...prev,
        scenarios: prev.scenarios.map((sc) =>
          sc.id === prev.activeScenarioId
            ? {
                ...sc,
                extraBoqItems: sc.extraBoqItems.map((ex) =>
                  ex.id === id ? { ...ex, ...patch } : ex
                ),
                updatedAt: new Date().toISOString(),
              }
            : sc
        ),
      }));
    },
    [updateInteriorState]
  );

  const deleteInteriorExtraBoqItem = useCallback(
    (id: string) => {
      updateInteriorState((prev) => ({
        ...prev,
        scenarios: prev.scenarios.map((sc) =>
          sc.id === prev.activeScenarioId
            ? {
                ...sc,
                extraBoqItems: sc.extraBoqItems.filter((ex) => ex.id !== id),
                updatedAt: new Date().toISOString(),
              }
            : sc
        ),
      }));
    },
    [updateInteriorState]
  );

  const updateBoqItemStatus = useCallback(
    (origin: "3D_ITEM" | "EXTRA_LINE", id: string, status: InteriorProcurementStatus) => {
      if (origin === "3D_ITEM") {
        updateInteriorFurnitureItem(id, { procurementStatus: status });
      } else {
        updateInteriorExtraBoqItem(id, { procurementStatus: status });
      }
    },
    [updateInteriorFurnitureItem, updateInteriorExtraBoqItem]
  );

  const recordBoqPaymentToFinance = useCallback(
    (input: {
      origin: "3D_ITEM" | "EXTRA_LINE";
      itemId: string;
      itemName: string;
      amountVnd: number;
      accountId: string;
      memberId: FamilyMember;
      date: string;
      stage?: InteriorBoqPaymentStage;
      statusAfter?: "DEPOSITED" | "INSTALLED";
      note?: string;
    }): Transaction => {
      const stage: InteriorBoqPaymentStage = input.stage ?? "DEPOSIT";
      const stagePrefix =
        stage === "DEPOSIT"
          ? "Đặt cọc"
          : stage === "DELIVERY"
            ? "Giao hàng"
            : stage === "ACCEPTANCE"
              ? "Nghiệm thu"
              : "Thanh toán";

      const tx = addTransaction({
        amount: input.amountVnd,
        date: input.date,
        type: "EXPENSE",
        categoryId:
          categories.find((c) => c.type === "EXPENSE" && c.name.toLowerCase().includes("mua sắm"))?.id ||
          "cat_expense_shopping",
        accountId: input.accountId,
        memberId: input.memberId,
        scope: "FAMILY",
        tag: "NORMAL",
        note: `[Nội thất A.12A.07 · ${stagePrefix}] ${input.itemName}${input.note ? ` · ${input.note}` : ""}`,
      });

      const paymentRecord: InteriorBoqPaymentRecord = {
        id: `boq_pay_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        stage,
        amountVnd: input.amountVnd,
        date: input.date,
        accountId: input.accountId,
        memberId: input.memberId,
        linkedTransactionId: tx.id,
        note: input.note,
      };

      updateInteriorState((prev) => ({
        ...prev,
        scenarios: prev.scenarios.map((sc) => {
          if (sc.id !== prev.activeScenarioId) return sc;
          if (input.origin === "3D_ITEM") {
            return {
              ...sc,
              items: sc.items.map((it) => {
                if (it.id !== input.itemId) return it;
                const nextPayments = [...(it.payments ?? []), paymentRecord];
                const totalPaid = nextPayments.reduce((s, p) => s + p.amountVnd, 0);
                const rowTotal = calculateFurnitureItemCostVnd(it);
                const computedStatus: InteriorProcurementStatus =
                  input.statusAfter ??
                  (rowTotal > 0 && totalPaid >= rowTotal ? "INSTALLED" : "DEPOSITED");
                return {
                  ...it,
                  payments: nextPayments,
                  linkedTransactionId: tx.id,
                  procurementStatus: computedStatus,
                };
              }),
              updatedAt: new Date().toISOString(),
            };
          }
          return {
            ...sc,
            extraBoqItems: sc.extraBoqItems.map((ex) => {
              if (ex.id !== input.itemId) return ex;
              const nextPayments = [...(ex.payments ?? []), paymentRecord];
              const totalPaid = nextPayments.reduce((s, p) => s + p.amountVnd, 0);
              const rowTotal = Math.round(ex.quantity * ex.unitPriceVnd);
              const computedStatus: InteriorProcurementStatus =
                input.statusAfter ??
                (rowTotal > 0 && totalPaid >= rowTotal ? "INSTALLED" : "DEPOSITED");
              return {
                ...ex,
                payments: nextPayments,
                linkedTransactionId: tx.id,
                procurementStatus: computedStatus,
              };
            }),
            updatedAt: new Date().toISOString(),
          };
        }),
      }));

      return tx;
    },
    [addTransaction, categories, updateInteriorState]
  );

  const applyInteriorStylePaletteToAllFurniture = useCallback(
    (scenarioId: string, preset: InteriorStylePreset) => {
      updateInteriorState((prev) => ({
        ...prev,
        scenarios: prev.scenarios.map((sc) =>
          sc.id === scenarioId
            ? {
                ...sc,
                stylePreset: preset,
                items: sc.items.map((it) => ({
                  ...it,
                  materialFinish: resolveFinishForStylePreset(it, preset),
                })),
                updatedAt: new Date().toISOString(),
              }
            : sc
        ),
      }));
    },
    [updateInteriorState]
  );

  const addInteriorMepPoint = useCallback(
    (point: Omit<InteriorMepPoint, "id">): InteriorMepPoint => {
      const created: InteriorMepPoint = {
        ...point,
        id: `mep_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      };
      updateInteriorState((prev) => ({
        ...prev,
        scenarios: prev.scenarios.map((sc) =>
          sc.id === prev.activeScenarioId
            ? {
                ...sc,
                mepPoints: [...(sc.mepPoints ?? createDefaultSkyOneA2MepPoints()), created],
                updatedAt: new Date().toISOString(),
              }
            : sc
        ),
      }));
      return created;
    },
    [updateInteriorState]
  );

  const updateInteriorMepPoint = useCallback(
    (
      id: string,
      patch: Partial<InteriorMepPoint>,
      options?: { skipUndoHistory?: boolean }
    ) => {
      updateInteriorState(
        (prev) => ({
          ...prev,
          scenarios: prev.scenarios.map((sc) => {
            if (sc.id !== prev.activeScenarioId) return sc;
            const currentMep = sc.mepPoints ?? createDefaultSkyOneA2MepPoints();
            return {
              ...sc,
              mepPoints: currentMep.map((m) => (m.id === id ? { ...m, ...patch } : m)),
              updatedAt: new Date().toISOString(),
            };
          }),
        }),
        options
      );
    },
    [updateInteriorState]
  );

  const deleteInteriorMepPoint = useCallback(
    (id: string) => {
      updateInteriorState((prev) => ({
        ...prev,
        scenarios: prev.scenarios.map((sc) => {
          if (sc.id !== prev.activeScenarioId) return sc;
          const currentMep = sc.mepPoints ?? createDefaultSkyOneA2MepPoints();
          return {
            ...sc,
            mepPoints: currentMep.filter((m) => m.id !== id),
            updatedAt: new Date().toISOString(),
          };
        }),
      }));
    },
    [updateInteriorState]
  );

  const resetInteriorMepPoints = useCallback(() => {
    updateInteriorState((prev) => ({
      ...prev,
      scenarios: prev.scenarios.map((sc) =>
        sc.id === prev.activeScenarioId
          ? {
              ...sc,
              mepPoints: createDefaultSkyOneA2MepPoints(),
              updatedAt: new Date().toISOString(),
            }
          : sc
      ),
    }));
  }, [updateInteriorState]);

  const updateInteriorWallOverride = useCallback(
    (wallId: string, patch: Partial<InteriorWallOverride>) => {
      updateInteriorState((prev) => ({
        ...prev,
        scenarios: prev.scenarios.map((sc) => {
          if (sc.id !== prev.activeScenarioId) return sc;
          const currentMap = sc.wallOverrides ?? {};
          const existing = currentMap[wallId] ?? { mode: "SOLID" as const, accentFinish: "DEFAULT" as const };
          const nextEntry: InteriorWallOverride = {
            mode: patch.mode ?? existing.mode,
            accentFinish: patch.accentFinish ?? existing.accentFinish,
          };
          const nextMap = { ...currentMap };
          if (nextEntry.mode === "SOLID" && (!nextEntry.accentFinish || nextEntry.accentFinish === "DEFAULT")) {
            delete nextMap[wallId];
          } else {
            nextMap[wallId] = nextEntry;
          }
          return {
            ...sc,
            wallOverrides: Object.keys(nextMap).length > 0 ? nextMap : undefined,
            updatedAt: new Date().toISOString(),
          };
        }),
      }));
    },
    [updateInteriorState]
  );

  const updateInteriorDoorOverride = useCallback(
    (openingId: string, mode: InteriorDoorMode) => {
      updateInteriorState((prev) => ({
        ...prev,
        scenarios: prev.scenarios.map((sc) => {
          if (sc.id !== prev.activeScenarioId) return sc;
          const nextMap = { ...(sc.doorOverrides ?? {}) };
          if (mode === "SWING_90") {
            delete nextMap[openingId];
          } else {
            nextMap[openingId] = mode;
          }
          return {
            ...sc,
            doorOverrides: Object.keys(nextMap).length > 0 ? nextMap : undefined,
            updatedAt: new Date().toISOString(),
          };
        }),
      }));
    },
    [updateInteriorState]
  );

  const updateInteriorFloorPattern = useCallback(
    (roomId: string, pattern: InteriorFloorPattern) => {
      updateInteriorState((prev) => ({
        ...prev,
        scenarios: prev.scenarios.map((sc) => {
          if (sc.id !== prev.activeScenarioId) return sc;
          const nextMap = { ...(sc.roomFloorOverrides ?? {}) };
          if (pattern === "STRAIGHT") {
            delete nextMap[roomId];
          } else {
            nextMap[roomId] = pattern;
          }
          return {
            ...sc,
            roomFloorOverrides: Object.keys(nextMap).length > 0 ? nextMap : undefined,
            updatedAt: new Date().toISOString(),
          };
        }),
      }));
    },
    [updateInteriorState]
  );

  const updateInteriorLightingZones = useCallback(
    (patch: Partial<InteriorLightingZones>) => {
      updateInteriorState(
        (prev) => ({
          ...prev,
          scenarios: prev.scenarios.map((sc) => {
            if (sc.id !== prev.activeScenarioId) return sc;
            return {
              ...sc,
              lightingZones: {
                ...(sc.lightingZones ?? DEFAULT_LIGHTING_ZONES),
                ...patch,
              },
              updatedAt: new Date().toISOString(),
            };
          }),
        }),
        { skipUndoHistory: true }
      );
    },
    [updateInteriorState]
  );

  const updateInteriorCurtainOpenRatio = useCallback(
    (ratio: number) => {
      const clamped = Math.max(0, Math.min(1, Number(ratio.toFixed(2))));
      updateInteriorState(
        (prev) => ({
          ...prev,
          scenarios: prev.scenarios.map((sc) =>
            sc.id === prev.activeScenarioId
              ? { ...sc, curtainOpenRatio: clamped, updatedAt: new Date().toISOString() }
              : sc
          ),
        }),
        { skipUndoHistory: true }
      );
    },
    [updateInteriorState]
  );

  const commitInteriorUndoSnapshot = useCallback((snapshot: InteriorStudioState) => {
    setInteriorUndoStack((stack) => [...stack.slice(-24), snapshot]);
    setInteriorRedoStack([]);
  }, []);

  const toggleHandoverChecklistItem = useCallback(
    (id: string) => {
      updateInteriorState(
        (prev) => ({
          ...prev,
          handoverChecklist: prev.handoverChecklist.map((it) =>
            it.id === id ? { ...it, checked: !it.checked } : it
          ),
        }),
        { skipUndoHistory: true }
      );
    },
    [updateInteriorState]
  );

  const updateHandoverChecklistNote = useCallback(
    (id: string, note: string) => {
      updateInteriorState(
        (prev) => ({
          ...prev,
          handoverChecklist: prev.handoverChecklist.map((it) =>
            it.id === id ? { ...it, note } : it
          ),
        }),
        { skipUndoHistory: true }
      );
    },
    [updateInteriorState]
  );

  const undoInteriorChange = useCallback(() => {
    setInteriorUndoStack((stack) => {
      if (stack.length === 0) return stack;
      const previous = stack[stack.length - 1];
      setInteriorRedoStack((redo) => [...redo.slice(-24), interiorStudio]);
      setInteriorStudio(previous);
      queueCloudMutation({ type: "UPSERT_INTERIOR_STUDIO", payload: previous });
      return stack.slice(0, -1);
    });
  }, [interiorStudio, queueCloudMutation]);

  const redoInteriorChange = useCallback(() => {
    setInteriorRedoStack((stack) => {
      if (stack.length === 0) return stack;
      const next = stack[stack.length - 1];
      setInteriorUndoStack((undo) => [...undo.slice(-24), interiorStudio]);
      setInteriorStudio(next);
      queueCloudMutation({ type: "UPSERT_INTERIOR_STUDIO", payload: next });
      return stack.slice(0, -1);
    });
  }, [interiorStudio, queueCloudMutation]);

  const resetInteriorStudio = useCallback(() => {
    const fresh = createDefaultInteriorStudio();
    setInteriorUndoStack([]);
    setInteriorRedoStack([]);
    setInteriorStudio(fresh);
    queueCloudMutation({ type: "UPSERT_INTERIOR_STUDIO", payload: fresh });
  }, [queueCloudMutation]);

  const resetToMockData = useCallback(() => {
    const seeded = seedInitialDataV3();
    setCategories(seeded.categories);
    setAccounts(seeded.accounts);
    setTransactions(seeded.transactions);
    setBudgets(seeded.budgets);
    setGoals(seeded.goals);
    setDebts(seeded.debts);
    setInvestments(seeded.investments);
    setRecurringRules(seeded.recurringRules || DEFAULT_RECURRING_RULES);
    setSavingsChallenges(seeded.savingsChallenges || DEFAULT_SAVINGS_CHALLENGES);
    setSettings(seeded.settings);
    setSkyoneLoan(seeded.skyoneLoan);
    setGoldPortfolio(seeded.goldPortfolio);
    setInteriorStudio(seeded.interiorStudio);
    setInteriorUndoStack([]);
    setInteriorRedoStack([]);
    setSelectedMonth("2026-10");
    setActivePerspective("ALL");
    setIsAppLocked(false);

    if (isSupabaseConfigured && householdRef.current) {
      ignoreRealtimeUntilRef.current = Date.now() + 3000;
      void supabaseService.pushFullState(householdRef.current.id, seeded);
    }
  }, []);

  const exportBackup = useCallback(() => {
    exportDataToJsonV3({
      categories,
      accounts,
      transactions,
      budgets,
      goals,
      debts,
      investments,
      recurringRules,
      savingsChallenges,
      settings,
      skyoneLoan,
      goldPortfolio,
      interiorStudio,
    });
  }, [
    categories,
    accounts,
    transactions,
    budgets,
    goals,
    debts,
    investments,
    recurringRules,
    savingsChallenges,
    settings,
    skyoneLoan,
    goldPortfolio,
    interiorStudio,
  ]);

  const exportCsvReport = useCallback(() => {
    exportTransactionsToCsv(
      transactions,
      categories,
      accounts,
      selectedMonth,
      settings.husbandName,
      settings.wifeName
    );
  }, [transactions, categories, accounts, selectedMonth, settings.husbandName, settings.wifeName]);

  const importBackup = useCallback(
    async (file: File): Promise<{ success: boolean; error?: string }> => {
      const res = await importDataFromJsonV3(file);
      if (res.success && res.data) {
        setCategories(res.data.categories);
        setAccounts(res.data.accounts);
        setTransactions(res.data.transactions);
        setBudgets(res.data.budgets);
        setGoals(res.data.goals);
        setDebts(res.data.debts);
        setInvestments(res.data.investments);
        setRecurringRules(res.data.recurringRules || DEFAULT_RECURRING_RULES);
        setSavingsChallenges(res.data.savingsChallenges || DEFAULT_SAVINGS_CHALLENGES);
        setSettings(res.data.settings);
        setSkyoneLoan(reconcileBidvSkyOneContract(res.data.skyoneLoan).contract);
        setGoldPortfolio(res.data.goldPortfolio || createDefaultGoldPortfolio());
        setInteriorStudio(res.data.interiorStudio || createDefaultInteriorStudio());
        saveStoredDataV3(res.data);

        if (isSupabaseConfigured && householdRef.current) {
          ignoreRealtimeUntilRef.current = Date.now() + 3000;
          void supabaseService.pushFullState(householdRef.current.id, res.data);
        }

        return { success: true };
      }
      return { success: false, error: res.error || "Nhập file thất bại" };
    },
    []
  );

  const getSyncBundleJson = useCallback(() => {
    return buildSyncBundleJson({
      categories,
      accounts,
      transactions,
      budgets,
      goals,
      debts,
      investments,
      recurringRules,
      savingsChallenges,
      settings,
      skyoneLoan,
      goldPortfolio,
      interiorStudio,
    });
  }, [
    categories,
    accounts,
    transactions,
    budgets,
    goals,
    debts,
    investments,
    recurringRules,
    savingsChallenges,
    settings,
    skyoneLoan,
    goldPortfolio,
    interiorStudio,
  ]);

  const previewSyncBundle = useCallback(
    (rawText: string) => {
      const parsed = parseSyncBundleText(rawText);
      if (!parsed.success || !parsed.data) {
        return { success: false, error: parsed.error || "Gói đồng bộ không hợp lệ." };
      }
      const preview = previewMergeDiff(
        {
          categories,
          accounts,
          transactions,
          budgets,
          goals,
          debts,
          investments,
          recurringRules,
          savingsChallenges,
          settings,
          skyoneLoan,
          goldPortfolio,
          interiorStudio,
        },
        parsed.data
      );
      return { success: true, preview, parsedState: parsed.data };
    },
    [
      categories,
      accounts,
      transactions,
      budgets,
      goals,
      debts,
      investments,
      recurringRules,
      savingsChallenges,
      settings,
      skyoneLoan,
      goldPortfolio,
      interiorStudio,
    ]
  );

  const importSyncBundle = useCallback(
    (incoming: StoredAppStateV3, options: MergeOptions) => {
      const currentState: StoredAppStateV3 = {
        categories,
        accounts,
        transactions,
        budgets,
        goals,
        debts,
        investments,
        recurringRules,
        savingsChallenges,
        settings,
        skyoneLoan,
        goldPortfolio,
        interiorStudio,
      };
      const diff = previewMergeDiff(currentState, incoming);
      const nextState = mergeFinanceData(currentState, incoming, options);

      setCategories(nextState.categories);
      setAccounts(nextState.accounts);
      setTransactions(nextState.transactions);
      setBudgets(nextState.budgets);
      setGoals(nextState.goals);
      setDebts(nextState.debts);
      setInvestments(nextState.investments);
      setRecurringRules(nextState.recurringRules);
      setSavingsChallenges(nextState.savingsChallenges || DEFAULT_SAVINGS_CHALLENGES);
      setSettings(nextState.settings);
      setSkyoneLoan(nextState.skyoneLoan);
      setGoldPortfolio(nextState.goldPortfolio);
      setInteriorStudio(nextState.interiorStudio);
      saveStoredDataV3(nextState);

      if (isSupabaseConfigured && householdRef.current) {
        ignoreRealtimeUntilRef.current = Date.now() + 3000;
        void supabaseService.pushFullState(householdRef.current.id, nextState);
      }

      return { success: true, diff };
    },
    [
      categories,
      accounts,
      transactions,
      budgets,
      goals,
      debts,
      investments,
      recurringRules,
      savingsChallenges,
      settings,
      skyoneLoan,
      goldPortfolio,
      interiorStudio,
    ]
  );

  // Thông tin 2 thẻ BIDV Credit (chuẩn hóa theo 30% guardrail & ngày sao kê/đáo hạn cấu hình)
  const husbandCreditCard = useMemo<CreditCardInfo | null>(() => {
    const acc =
      accounts.find((a) => a.id === "acc_husband_bidv_credit") ||
      accounts.find((a) => a.type === "CREDIT_CARD" && a.owner === "HUSBAND");
    if (!acc) return null;
    return calculateCreditCardCycleInfo(acc, selectedMonth);
  }, [accounts, selectedMonth]);

  const wifeCreditCard = useMemo<CreditCardInfo | null>(() => {
    const acc =
      accounts.find((a) => a.id === "acc_wife_bidv_credit") ||
      accounts.find((a) => a.type === "CREDIT_CARD" && a.owner === "WIFE");
    if (!acc) return null;
    return calculateCreditCardCycleInfo(acc, selectedMonth);
  }, [accounts, selectedMonth]);

  // Tổng hợp Tài chính
  const summary = useMemo<FinancialSummary>(() => {
    const filteredAccounts = accounts.filter((a) => {
      if (activePerspective === "ALL") return true;
      if (activePerspective === "HUSBAND") return a.owner === "HUSBAND" || a.owner === "SHARED";
      if (activePerspective === "WIFE") return a.owner === "WIFE" || a.owner === "SHARED";
      return true;
    });

    const currentBalance = filteredAccounts
      .filter((a) => a.type !== "CREDIT_CARD")
      .reduce((sum, a) => sum + Math.max(0, a.currentBalance), 0);

    const totalCreditDebt = filteredAccounts
      .filter((a) => a.type === "CREDIT_CARD")
      .reduce((sum, a) => sum + Math.max(0, a.currentBalance), 0);

    // Chỉ trừ nợ BORROW (mình đi vay), không trừ LEND (cho vay)
    const totalDebt = debts
      .filter((d) => d.status === "ACTIVE" && d.type !== "LEND")
      .filter((d) => {
        if (activePerspective === "ALL") return true;
        if (activePerspective === "HUSBAND") return d.memberId === "HUSBAND" || d.memberId === "SHARED";
        if (activePerspective === "WIFE") return d.memberId === "WIFE" || d.memberId === "SHARED";
        return true;
      })
      .reduce((sum, d) => sum + Math.max(0, d.totalAmount - d.paidAmount), 0);

    const goldBidValuation = goldPortfolio.includeInNetWorth
      ? computeGoldPortfolioMetrics(goldPortfolio).totalLiquidationValueBid
      : 0;

    const totalInvested =
      investments
        .filter((i) => i.status === "ACTIVE")
        .filter((i) => {
          if (activePerspective === "ALL") return true;
          if (activePerspective === "HUSBAND") return i.memberId === "HUSBAND" || i.memberId === "SHARED";
          if (activePerspective === "WIFE") return i.memberId === "WIFE" || i.memberId === "SHARED";
          return true;
        })
        .reduce((sum, i) => sum + (i.currentValue || i.amount), 0) +
      (activePerspective === "ALL" ? goldBidValuation : 0);

    const netWorth = currentBalance + totalInvested - totalDebt - totalCreditDebt;

    let monthlyIncome = 0;
    let monthlyExpense = 0;
    let husbandIncome = 0;
    let wifeIncome = 0;
    let husbandExpense = 0;
    let wifeExpense = 0;
    let familySharedExpense = 0;

    for (const tx of transactions) {
      const matchMonth = selectedMonth === "ALL" || tx.date.startsWith(selectedMonth);
      if (!matchMonth) continue;

      if (tx.type === "INCOME") {
        if (tx.memberId === "HUSBAND") husbandIncome += tx.amount;
        if (tx.memberId === "WIFE") wifeIncome += tx.amount;

        if (activePerspective === "ALL") monthlyIncome += tx.amount;
        else if (activePerspective === "HUSBAND" && tx.memberId === "HUSBAND") monthlyIncome += tx.amount;
        else if (activePerspective === "WIFE" && tx.memberId === "WIFE") monthlyIncome += tx.amount;
      } else if (tx.type === "EXPENSE") {
        if (tx.memberId === "HUSBAND") husbandExpense += tx.amount;
        if (tx.memberId === "WIFE") wifeExpense += tx.amount;
        if (tx.scope === "FAMILY") familySharedExpense += tx.amount;

        if (activePerspective === "ALL") monthlyExpense += tx.amount;
        else if (activePerspective === "HUSBAND" && tx.memberId === "HUSBAND") monthlyExpense += tx.amount;
        else if (activePerspective === "WIFE" && tx.memberId === "WIFE") monthlyExpense += tx.amount;
      }
    }

    const savingsAmount = monthlyIncome - monthlyExpense;
    const savingsRate =
      monthlyIncome > 0 ? Math.max(0, Math.round((savingsAmount / monthlyIncome) * 100)) : 0;

    return {
      currentBalance,
      netWorth,
      monthlyIncome,
      monthlyExpense,
      savingsAmount,
      savingsRate,
      totalDebt,
      totalInvested,
      husbandIncome,
      wifeIncome,
      husbandExpense,
      wifeExpense,
      familySharedExpense,
      totalCreditDebt,
    };
  }, [accounts, debts, investments, transactions, selectedMonth, activePerspective, goldPortfolio]);

  // Ngân sách tháng (Dynamic daysRemaining)
  const budgetSummary = useMemo<BudgetSummary>(() => {
    const monthKey = selectedMonth === "ALL" ? getCurrentMonthKey() : selectedMonth;
    const currentMonthBudgets = budgets.filter((b) => b.month === monthKey);

    const categorySpentMap = new Map<string, number>();
    for (const tx of transactions) {
      if (tx.type === "EXPENSE" && tx.date.startsWith(monthKey)) {
        if (activePerspective === "HUSBAND" && tx.memberId !== "HUSBAND") continue;
        if (activePerspective === "WIFE" && tx.memberId !== "WIFE") continue;

        const cur = categorySpentMap.get(tx.categoryId) || 0;
        categorySpentMap.set(tx.categoryId, cur + tx.amount);
      }
    }

    let totalBudget = 0;
    let totalSpent = 0;

    const items: BudgetProgressItem[] = currentMonthBudgets.map((b) => {
      const cat = getCategoryById(b.categoryId);
      const spent = categorySpentMap.get(b.categoryId) || 0;
      totalBudget += b.limitAmount;
      totalSpent += spent;

      const remaining = Math.max(0, b.limitAmount - spent);
      const percentage = b.limitAmount > 0 ? Math.round((spent / b.limitAmount) * 100) : 0;

      return {
        categoryId: b.categoryId,
        categoryName: cat?.name || "Danh mục",
        categoryColor: cat?.color || "#94A3B8",
        limitAmount: b.limitAmount,
        spentAmount: spent,
        remainingAmount: remaining,
        percentage,
      };
    });

    const remaining = Math.max(0, totalBudget - totalSpent);
    const daysRemaining = calculateDaysRemainingInMonth(monthKey, transactions);
    const dailyAllowance = daysRemaining > 0 ? Math.round(remaining / daysRemaining) : 0;

    return {
      totalBudget,
      totalSpent,
      remaining,
      daysRemaining,
      dailyAllowance,
      items,
    };
  }, [budgets, transactions, selectedMonth, activePerspective, getCategoryById]);

  const todaySpentInfo = useMemo(
    () => calculateTodaySpent(transactions, activePerspective, selectedMonth),
    [transactions, activePerspective, selectedMonth]
  );

  const coupleSettlement = useMemo(
    () =>
      calculateCoupleSettlement(
        transactions,
        selectedMonth,
        settings.sharedSplitRatioHusband ?? 50
      ),
    [transactions, selectedMonth, settings.sharedSplitRatioHusband]
  );

  // Danh sách giao dịch được lọc
  const filteredTransactions = useMemo(() => {
    return transactions
      .filter((tx) => {
        if (selectedMonth !== "ALL" && !tx.date.startsWith(selectedMonth)) return false;
        if (selectedType !== "ALL" && tx.type !== selectedType) return false;
        if (selectedCategory !== "ALL" && tx.categoryId !== selectedCategory) return false;
        if (
          selectedAccount !== "ALL" &&
          tx.accountId !== selectedAccount &&
          tx.toAccountId !== selectedAccount
        )
          return false;

        if (activePerspective === "HUSBAND" && tx.memberId !== "HUSBAND") return false;
        if (activePerspective === "WIFE" && tx.memberId !== "WIFE") return false;

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const category = getCategoryById(tx.categoryId);
          const account = getAccountById(tx.accountId);
          const matchNote = tx.note?.toLowerCase().includes(q);
          const matchCat = category?.name.toLowerCase().includes(q);
          const matchAcc = account?.name.toLowerCase().includes(q);
          const matchAmount = tx.amount.toString().includes(q);
          if (!matchNote && !matchCat && !matchAcc && !matchAmount) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const dateCompare = b.date.localeCompare(a.date);
        if (dateCompare !== 0) return dateCompare;
        return (b.createdAt || "").localeCompare(a.createdAt || "");
      });
  }, [
    transactions,
    selectedMonth,
    selectedType,
    selectedCategory,
    selectedAccount,
    activePerspective,
    searchQuery,
    getCategoryById,
    getAccountById,
  ]);

  // Thống kê Donut chi tiêu
  const categoryExpenseStats = useMemo<CategoryExpenseStat[]>(() => {
    const expenseMap = new Map<string, number>();
    let totalExpense = 0;

    for (const tx of transactions) {
      if (tx.type !== "EXPENSE") continue;
      if (selectedMonth !== "ALL" && !tx.date.startsWith(selectedMonth)) continue;
      if (activePerspective === "HUSBAND" && tx.memberId !== "HUSBAND") continue;
      if (activePerspective === "WIFE" && tx.memberId !== "WIFE") continue;

      const current = expenseMap.get(tx.categoryId) || 0;
      expenseMap.set(tx.categoryId, current + tx.amount);
      totalExpense += tx.amount;
    }

    if (totalExpense === 0) return [];

    const stats: CategoryExpenseStat[] = [];
    expenseMap.forEach((amount, catId) => {
      const cat = getCategoryById(catId);
      stats.push({
        categoryId: catId,
        categoryName: cat?.name || "Chi khác",
        categoryColor: cat?.color || "#94A3B8",
        totalAmount: amount,
        percentage: Math.round((amount / totalExpense) * 100),
      });
    });

    return stats.sort((a, b) => b.totalAmount - a.totalAmount);
  }, [transactions, selectedMonth, activePerspective, getCategoryById]);

  // Xu hướng thu chi 6 tháng gần nhất (trượt động theo tháng đang xem / hiện tại)
  const monthlyTrendData = useMemo<MonthlyTrendItem[]>(() => {
    const anchorMonth =
      selectedMonth !== "ALL"
        ? selectedMonth
        : availableMonths[0] || getCurrentMonthKey();

    const months = [-5, -4, -3, -2, -1, 0].map((offset) => shiftMonthKey(anchorMonth, offset));
    const map = new Map<string, { income: number; expense: number }>();

    months.forEach((m) => map.set(m, { income: 0, expense: 0 }));

    for (const tx of transactions) {
      const m = tx.date.substring(0, 7);
      if (map.has(m)) {
        if (activePerspective === "HUSBAND" && tx.memberId !== "HUSBAND") continue;
        if (activePerspective === "WIFE" && tx.memberId !== "WIFE") continue;

        const item = map.get(m)!;
        if (tx.type === "INCOME") item.income += tx.amount;
        if (tx.type === "EXPENSE") item.expense += tx.amount;
      }
    }

    return months.map((m) => {
      const item = map.get(m)!;
      const monthNum = parseInt(m.split("-")[1], 10);
      return {
        month: m,
        label: `Tháng ${monthNum}`,
        income: item.income,
        expense: item.expense,
      };
    });
  }, [transactions, activePerspective, selectedMonth, availableMonths]);

  // Thông báo động theo 30% Credit Guardrail, Ngân sách & Định kỳ
  const notifications = useMemo<AppNotification[]>(() => {
    const list: AppNotification[] = [];
    const today = new Date().toISOString().slice(0, 10);
    const activeMonth = selectedMonth === "ALL" ? getCurrentMonthKey() : selectedMonth;

    if (husbandCreditCard) {
      if (husbandCreditCard.usagePercentage >= 70) {
        list.push({
          id: "warn_husband_credit_high",
          title: "Cảnh báo hạn mức thẻ Anh Chuột",
          message: `Thẻ BIDV Credit (${settings.husbandName}) đã dùng ${husbandCreditCard.usagePercentage}% hạn mức (vượt 70%). Nên trả bớt trước sao kê ngày ${husbandCreditCard.statementDay}.`,
          type: "danger",
          date: today,
          read: readNotifIds.has("warn_husband_credit_high"),
        });
      } else if (husbandCreditCard.usagePercentage > 30) {
        list.push({
          id: "watch_husband_credit_30",
          title: "Thẻ Anh Chuột vượt ngưỡng an toàn 30%",
          message: `Thẻ BIDV Credit (${settings.husbandName}) đang ở mức ${husbandCreditCard.usagePercentage}% (mốc an toàn ≤ 30%). Hạn trả: ${husbandCreditCard.dueDateDisplay}.`,
          type: "warning",
          date: today,
          read: readNotifIds.has("watch_husband_credit_30"),
        });
      } else {
        list.push({
          id: "info_husband_credit_cycle",
          title: "Chu kỳ thẻ BIDV Credit Anh Chuột",
          message: `Sao kê ngày ${husbandCreditCard.statementDay}, hạn trả ${husbandCreditCard.dueDateDisplay}. Tỷ lệ dùng ${husbandCreditCard.usagePercentage}% (An toàn ≤ 30%).`,
          type: "info",
          date: today,
          read: readNotifIds.has("info_husband_credit_cycle"),
        });
      }
    }

    if (wifeCreditCard) {
      if (wifeCreditCard.usagePercentage >= 70) {
        list.push({
          id: "warn_wife_credit_high",
          title: "Cảnh báo hạn mức thẻ Bé Mèo",
          message: `Thẻ BIDV Credit (${settings.wifeName}) đã dùng ${wifeCreditCard.usagePercentage}% hạn mức (vượt 70%).`,
          type: "danger",
          date: today,
          read: readNotifIds.has("warn_wife_credit_high"),
        });
      } else if (wifeCreditCard.usagePercentage > 30) {
        list.push({
          id: "watch_wife_credit_30",
          title: "Thẻ Bé Mèo vượt ngưỡng an toàn 30%",
          message: `Thẻ BIDV Credit (${settings.wifeName}) đang dùng ${wifeCreditCard.usagePercentage}%. Hạn trả: ${wifeCreditCard.dueDateDisplay}.`,
          type: "warning",
          date: today,
          read: readNotifIds.has("watch_wife_credit_30"),
        });
      }
    }

    budgetSummary.items.forEach((b) => {
      const ratio = b.limitAmount > 0 ? b.spentAmount / b.limitAmount : 0;
      if (ratio > 0.8) {
        const nid = `budget_warn_${b.categoryId}_${activeMonth}`;
        list.push({
          id: nid,
          title:
            b.percentage >= 100
              ? `Ngân sách "${b.categoryName}" đạt ${b.percentage}%`
              : `Cảnh báo "${b.categoryName}" vượt 80% (${b.percentage}%)`,
          message:
            b.percentage >= 100
              ? `Danh mục ${b.categoryName} đã vượt ngân sách tháng ${activeMonth}.`
              : `Danh mục ${b.categoryName} đã dùng ${b.percentage}% hạn mức tháng ${activeMonth}.`,
          type: b.percentage >= 100 ? "danger" : "warning",
          date: today,
          read: readNotifIds.has(nid),
        });
      }
    });

    const reminderMonth = getCurrentMonthKey();
    const dueRecurringReminders = findRecurringExpenseReminders(recurringRules, reminderMonth);
    const remindedRuleIds = new Set<string>();

    dueRecurringReminders.forEach(({ rule, dueDay, daysUntilDue, status, monthKey }) => {
      remindedRuleIds.add(rule.id);
      const nid = `rec_due_${rule.id}_${monthKey}`;
      const monthPart = monthKey.split("-")[1] || monthKey;
      const amountText = formatVNDMasked(rule.amount, Boolean(settings.privacyMode));

      const title =
        status === "OVERDUE"
          ? `Quá hạn định kỳ: ${rule.name}`
          : status === "DUE_TODAY"
          ? `Đến hạn hôm nay: ${rule.name}`
          : `Sắp đến hạn (${daysUntilDue} ngày): ${rule.name}`;

      const timingDetail =
        status === "OVERDUE"
          ? `Đã quá hạn ${Math.abs(daysUntilDue)} ngày (ngày ${dueDay}/${monthPart})`
          : status === "DUE_TODAY"
          ? `Đến hạn thanh toán hôm nay (ngày ${dueDay}/${monthPart})`
          : `Còn ${daysUntilDue} ngày đến hạn (ngày ${dueDay}/${monthPart})`;

      list.push({
        id: nid,
        title,
        message: `${timingDetail} · ${amountText}. Bấm Ghi sổ nhanh để hạch toán ngay kỳ ${monthKey}.`,
        type: status === "OVERDUE" ? "danger" : "warning",
        date: today,
        read: readNotifIds.has(nid),
        actionType: "APPLY_RECURRING",
        recurringRuleId: rule.id,
        monthKey,
      });
    });

    const dueInstallments = findInstallmentReminders(skyoneLoan);
    dueInstallments.forEach((inst) => {
      const nid = `inst_due_${inst.period}`;
      const amountText = formatVNDMasked(inst.amount, Boolean(settings.privacyMode));
      const [, mPart, dPart] = inst.dueDate.split("-");
      const dateDisp = `${dPart || inst.dueDay}/${mPart || ""}`;
      const title =
        inst.status === "OVERDUE"
          ? `Quá hạn trả góp: ${inst.projectName} · Kỳ #${inst.period}`
          : inst.status === "DUE_TODAY"
          ? `Đến hạn trả góp hôm nay: Kỳ #${inst.period}`
          : `Sắp đến hạn trả góp (${inst.daysUntilDue} ngày): Kỳ #${inst.period}`;

      const timingDetail =
        inst.status === "OVERDUE"
          ? `Đã quá hạn ${Math.abs(inst.daysUntilDue)} ngày (${dateDisp})`
          : inst.status === "DUE_TODAY"
          ? `Đến hạn thanh toán hôm nay (${dateDisp})`
          : `Còn ${inst.daysUntilDue} ngày đến hạn (${dateDisp})`;

      list.push({
        id: nid,
        title,
        message: `${timingDetail} · ${amountText}. Bấm Ghi sổ nhanh để hạch toán kỳ trả góp.`,
        type: inst.status === "OVERDUE" ? "danger" : "warning",
        date: today,
        read: readNotifIds.has(nid),
        actionType: "PAY_INSTALLMENT",
        installmentPeriod: inst.period,
        installmentDueDate: inst.dueDate,
        installmentAmount: inst.amount,
        monthKey: inst.monthKey,
      });
    });

    const otherPendingRecurring = recurringRules.filter(
      (r) => r.isActive && r.lastAppliedMonth !== activeMonth && !remindedRuleIds.has(r.id)
    );
    if (otherPendingRecurring.length > 0) {
      list.push({
        id: `rec_pending_${activeMonth}`,
        title: `${otherPendingRecurring.length} khoản định kỳ khác chờ ghi sổ`,
        message: `Còn ${otherPendingRecurring.length} khoản thu/chi định kỳ chưa áp dụng cho kỳ ${activeMonth}. Vào Kế hoạch để ghi sổ 1 chạm.`,
        type: "info",
        date: today,
        read: readNotifIds.has(`rec_pending_${activeMonth}`),
      });
    }

    return list.filter((n) => !n.read);
  }, [
    husbandCreditCard,
    wifeCreditCard,
    settings.husbandName,
    settings.wifeName,
    settings.privacyMode,
    budgetSummary.items,
    recurringRules,
    skyoneLoan,
    selectedMonth,
    readNotifIds,
  ]);

  const defaultInstallmentAccount = useMemo(
    () =>
      accounts.find((a) => a.owner === "HUSBAND" && a.type !== "CREDIT_CARD") ||
      accounts.find((a) => a.type !== "CREDIT_CARD") ||
      accounts[0],
    [accounts]
  );

  const unifiedDueReminders = useMemo(
    () =>
      buildUnifiedDueReminders({
        rules: recurringRules,
        monthKey: getCurrentMonthKey(),
        contract: skyoneLoan,
        defaultInstallmentAccountId: defaultInstallmentAccount?.id,
      }),
    [recurringRules, skyoneLoan, defaultInstallmentAccount?.id]
  );

  const quickPayInstallmentNotification = useCallback(
    (period: number): boolean => {
      const target = unifiedDueReminders.find(
        (item) => item.source === "MORTGAGE_INSTALLMENT" && item.installmentPeriod === period
      );
      const count = confirmSkyOnePeriods([period], {
        linkAccountId: defaultInstallmentAccount?.id,
        paidAt: getTodayIsoDate(),
      });
      if (count <= 0) return false;

      setQuickRecordUndo({
        id: `undo_inst_${period}_${Date.now()}`,
        kind: "MORTGAGE_INSTALLMENT",
        label: target?.title || `Trả góp ${skyoneLoan.projectName} · Kỳ #${period}`,
        amount: target?.amount || 0,
        monthKey: target?.monthKey || getCurrentMonthKey(),
        installmentPeriod: period,
        createdAt: Date.now(),
      });
      scheduleUndoAutoDismiss();
      return true;
    },
    [
      unifiedDueReminders,
      confirmSkyOnePeriods,
      defaultInstallmentAccount?.id,
      skyoneLoan.projectName,
      scheduleUndoAutoDismiss,
    ]
  );

  const undoLastQuickRecord = useCallback((): boolean => {
    if (!quickRecordUndo) return false;
    const entry = quickRecordUndo;

    if (entry.kind === "RECURRING_RULE" && entry.ruleId) {
      pausedAutoPostKeysRef.current.add(`${entry.ruleId}_${entry.monthKey}`);
      if (entry.transactionId) {
        deleteTransaction(entry.transactionId);
      }
      setRecurringRules((prev) => {
        let updated: RecurringRule | undefined;
        const next = prev.map((r) => {
          if (r.id !== entry.ruleId) return r;
          updated = { ...r, lastAppliedMonth: entry.previousLastAppliedMonth };
          return updated;
        });
        if (updated) {
          queueCloudMutation({ type: "UPSERT_RECURRING_RULE", payload: updated });
        }
        return next;
      });
      dismissQuickRecordUndo();
      return true;
    }

    if (entry.kind === "MORTGAGE_INSTALLMENT" && entry.installmentPeriod !== undefined) {
      undoSkyOnePeriod(entry.installmentPeriod);
      dismissQuickRecordUndo();
      return true;
    }

    return false;
  }, [
    quickRecordUndo,
    deleteTransaction,
    queueCloudMutation,
    undoSkyOnePeriod,
    dismissQuickRecordUndo,
  ]);

  const markNotificationRead = useCallback((id: string) => {
    setReadNotifIds((prev) => new Set(prev).add(id));
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    setBrowserNotifStatus(getBrowserNotificationPermission());
    setBrowserNotifEnabled(
      isBrowserNotificationOptedIn() && getBrowserNotificationPermission() === "granted"
    );
  }, [isLoaded]);

  useEffect(() => {
    if (!isLoaded || !browserNotifEnabled || browserNotifStatus !== "granted") return;
    const activeMonth = selectedMonth === "ALL" ? getCurrentMonthKey() : selectedMonth;
    const currentCalendarMonth = getCurrentMonthKey();

    triggerBudgetThresholdNotifications({
      monthKey: activeMonth,
      items: budgetSummary.items,
      isPrivacyMode,
    });
    triggerRecurringExpenseNotifications({
      monthKey: currentCalendarMonth,
      rules: recurringRules,
      contract: skyoneLoan,
      isPrivacyMode,
    });
  }, [
    isLoaded,
    browserNotifEnabled,
    browserNotifStatus,
    budgetSummary.items,
    recurringRules,
    skyoneLoan,
    selectedMonth,
    isPrivacyMode,
  ]);

  const enableBrowserNotifications = useCallback(async (): Promise<boolean> => {
    const res = await requestBrowserNotificationAccess();
    setBrowserNotifStatus(res.status);
    setBrowserNotifEnabled(res.granted);
    if (res.granted) {
      const activeMonth = selectedMonth === "ALL" ? getCurrentMonthKey() : selectedMonth;
      const currentCalendarMonth = getCurrentMonthKey();
      triggerBudgetThresholdNotifications({
        monthKey: activeMonth,
        items: budgetSummary.items,
        isPrivacyMode,
      });
      triggerRecurringExpenseNotifications({
        monthKey: currentCalendarMonth,
        rules: recurringRules,
        contract: skyoneLoan,
        isPrivacyMode,
      });
    }
    return res.granted;
  }, [selectedMonth, budgetSummary.items, recurringRules, skyoneLoan, isPrivacyMode]);

  const disableBrowserNotifications = useCallback(() => {
    setBrowserNotificationOptIn(false);
    setBrowserNotifEnabled(false);
  }, []);

  const value: FinanceContextType = {
    isLoaded,
    activeApp,
    activeTab,
    setActiveTab,
    skyoneTab,
    setSkyoneTab,
    skyoneHighlightPeriod,
    clearSkyoneHighlightPeriod,
    goldTab,
    setGoldTab,
    interiorTab,
    setInteriorTab,
    switchSubApp,
    openAppLauncher,
    getSkyOneLinkForTransaction,
    isSupabaseEnvReady: isSupabaseConfigured,
    cloudUser,
    cloudProfile,
    household,
    isCloudConnected,
    isSyncing,
    lastSyncedAt,
    pendingOutboxCount,
    cloudError,
    clearCloudError,
    syncWithCloud,
    signInCloud,
    signUpCloud,
    resendSignupConfirmationCloud,
    updateCloudProfile,
    sendMagicLinkCloud,
    signOutCloud,
    createCloudHousehold,
    joinCloudHousehold,
    rotateHouseholdInviteCode,
    leaveCloudHousehold,
    pushLocalStateToCloud,
    activePerspective,
    setActivePerspective,
    themeMode,
    setThemeMode,
    toggleThemeMode,
    isPrivacyMode,
    togglePrivacyMode,
    isAppLocked,
    hasPasscodeProtection,
    hasAuthCredential,
    unlockedProtectedViews,
    isViewProtectedByQuickAuth,
    isViewUnlockedInSession,
    unlockProtectedView,
    toggleQuickAuthView,
    verifyMemberPasscode,
    unlockWithPasscode,
    unlockWithBiometricSuccess,
    setMemberPasscode,
    clearMemberPasscode,
    updateMemberAuthConfig,
    lockApp,
    bypassLockForFirstSetup,
    categories,
    accounts,
    transactions,
    budgets,
    goals,
    debts,
    investments,
    recurringRules,
    savingsChallenges,
    settings,
    notifications,
    selectedMonth,
    selectedCategory,
    selectedType,
    selectedAccount,
    searchQuery,
    setSelectedMonth,
    setSelectedCategory,
    setSelectedType,
    setSelectedAccount,
    setSearchQuery,
    addCategory,
    updateCategory,
    deleteCategory,
    toggleCategoryVisibility,
    restoreDefaultCategories,
    addTransaction,
    addTransactionsBatch,
    updateTransaction,
    deleteTransaction,
    deleteTransactionsBatch,
    addAccount,
    updateAccount,
    deleteAccount,
    setCategoryBudget,
    deleteBudget,
    copyBudgetsFromMonth,
    addGoal,
    updateGoal,
    deleteGoal,
    depositGoal,
    addSavingsChallenge,
    updateSavingsChallenge,
    deleteSavingsChallenge,
    contributeSavingsChallenge,
    addDebt,
    updateDebt,
    payDebt,
    deleteDebt,
    addInvestment,
    updateInvestment,
    deleteInvestment,
    addRecurringRule,
    updateRecurringRule,
    deleteRecurringRule,
    applyRecurringRule,
    applyAllPendingRecurringRules,
    autoPostNotice,
    dismissAutoPostNotice,
    runAutoPostForDueRules,
    recurringHistorySuggestions,
    acceptRecurringSuggestion,
    dismissRecurringSuggestion,
    skyoneLoan,
    skyoneAutoSyncedNotice,
    dismissSkyoneAutoSyncedNotice,
    updateSkyOneContract,
    confirmSkyOnePeriods,
    undoSkyOnePeriod,
    addSkyOnePrepayment,
    deleteSkyOnePrepayment,
    addSkyOneRateAdjustment,
    deleteSkyOneRateAdjustment,
    setSkyOneCashflowLocked,
    saveAndLockSkyOneCashflow,
    toggleSkyOnePinkBook5Pct,
    resetSkyOneLoan,
    goldPortfolio,
    addGoldLot,
    updateGoldLot,
    deleteGoldLot,
    recordGoldSale,
    updateGoldPriceQuote,
    updateGoldMacro,
    updateGoldDcaPlan,
    toggleGoldIncludeInNetWorth,
    fetchReferenceGoldPrices,
    resetGoldPortfolio,
    interiorStudio,
    setActiveInteriorScenario,
    updateInteriorScenarioMeta,
    duplicateInteriorScenario,
    addInteriorFurnitureItem,
    updateInteriorFurnitureItem,
    deleteInteriorFurnitureItem,
    addInteriorExtraBoqItem,
    updateInteriorExtraBoqItem,
    deleteInteriorExtraBoqItem,
    updateBoqItemStatus,
    recordBoqPaymentToFinance,
    applyInteriorStylePaletteToAllFurniture,
    addInteriorMepPoint,
    updateInteriorMepPoint,
    deleteInteriorMepPoint,
    resetInteriorMepPoints,
    updateInteriorWallOverride,
    updateInteriorDoorOverride,
    updateInteriorFloorPattern,
    updateInteriorLightingZones,
    updateInteriorCurtainOpenRatio,
    commitInteriorUndoSnapshot,
    toggleHandoverChecklistItem,
    updateHandoverChecklistNote,
    undoInteriorChange,
    redoInteriorChange,
    canUndoInterior: interiorUndoStack.length > 0,
    canRedoInterior: interiorRedoStack.length > 0,
    resetInteriorStudio,
    updateSettings,
    markNotificationRead,
    unifiedDueReminders,
    quickRecordUndo,
    quickApplyRecurringNotification,
    quickPayInstallmentNotification,
    undoLastQuickRecord,
    dismissQuickRecordUndo,
    browserNotifStatus,
    browserNotifEnabled,
    enableBrowserNotifications,
    disableBrowserNotifications,
    resetToMockData,
    exportBackup,
    exportCsvReport,
    importBackup,
    getSyncBundleJson,
    previewSyncBundle,
    importSyncBundle,
    availableMonths,
    summary,
    budgetSummary,
    todaySpentInfo,
    coupleSettlement,
    filteredTransactions,
    categoryExpenseStats,
    monthlyTrendData,
    getCategoryById,
    getAccountById,
    husbandCreditCard,
    wifeCreditCard,
  };

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance() {
  const context = useContext(FinanceContext);
  if (!context) {
    throw new Error("useFinance phải được sử dụng bên trong FinanceProvider");
  }
  return context;
}
