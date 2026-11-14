"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  ReactNode,
} from "react";
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
  SkyOneTransactionLink,
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
import { getCurrentMonthKey } from "@/lib/formatters";
import { DEFAULT_CATEGORIES } from "@/constants/defaultCategories";
import {
  DEFAULT_ACCOUNTS,
  DEFAULT_BUDGETS,
  DEFAULT_SAVINGS_GOALS,
  DEFAULT_DEBTS,
  DEFAULT_INVESTMENTS,
  DEFAULT_SETTINGS,
  DEFAULT_RECURRING_RULES,
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
import {
  hashPasscode,
  verifyPasscode,
  hasAnyAppPasscode,
  getMemberAuthConfig,
} from "@/lib/authSecurity";
import {
  createDefaultSkyOneLoan,
  generateMortgageSchedule,
  getTodayIsoDate,
  reconcileBidvSkyOneContract,
  simulatePrepayment,
} from "@/lib/mortgageEngine";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { supabaseService } from "@/lib/supabaseService";
import {
  parseAppRoute,
  buildAppPath,
  getAppDocumentTitle,
  saveActiveApp,
} from "@/lib/appRouting";

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

interface BudgetProgressItem {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  limitAmount: number;
  spentAmount: number;
  remainingAmount: number;
  percentage: number;
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
  switchSubApp: (
    app: SubAppId,
    options?: {
      financeTab?: FinanceTab;
      skyoneTab?: SkyOneRouteTab;
      highlightPeriod?: number | null;
    }
  ) => void;
  openAppLauncher: () => void;
  getSkyOneLinkForTransaction: (txId: string) => SkyOneTransactionLink | undefined;

  // Trạng thái Cloud Database & Realtime
  isCloudConnected: boolean;
  isSyncing: boolean;
  lastSyncedAt: Date | null;
  syncWithCloud: () => Promise<void>;

  // Góc nhìn thành viên (Cả nhà / Chồng / Vợ)
  activePerspective: PerspectiveMode;
  setActivePerspective: (mode: PerspectiveMode) => void;

  // Chế độ sáng/tối & Riêng tư, /login & Khóa bảo mật đa thành viên
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  toggleThemeMode: () => void;
  isPrivacyMode: boolean;
  togglePrivacyMode: () => void;
  isAppLocked: boolean;
  hasPasscodeProtection: boolean;
  unlockWithPasscode: (member: AuthMemberId, code: string) => Promise<boolean>;
  unlockWithBiometricSuccess: (member: AuthMemberId, switchPerspective?: boolean) => void;
  setMemberPasscode: (member: AuthMemberId, newCode: string) => Promise<void>;
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
  settings: AppSettings;
  notifications: AppNotification[];

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

  // Quản lý Nợ & Đầu tư
  addDebt: (debt: Omit<DebtItem, "id">) => void;
  updateDebt: (id: string, debt: Partial<DebtItem>) => void;
  payDebt: (id: string, amount: number, sourceAccountId?: string) => void;
  deleteDebt: (id: string) => void;

  addInvestment: (inv: Omit<InvestmentItem, "id">) => void;
  updateInvestment: (id: string, inv: Partial<InvestmentItem>) => void;
  deleteInvestment: (id: string) => void;

  // Quản lý Giao dịch Định kỳ
  addRecurringRule: (rule: Omit<RecurringRule, "id">) => void;
  updateRecurringRule: (id: string, rule: Partial<RecurringRule>) => void;
  deleteRecurringRule: (id: string) => void;
  applyRecurringRule: (id: string, targetMonth?: string) => Transaction | null;
  applyAllPendingRecurringRules: (targetMonth?: string) => number;

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
  resetSkyOneLoan: () => void;

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
  const [activePerspective, setActivePerspective] = useState<PerspectiveMode>("ALL");

  // Supabase Cloud State
  const [isCloudConnected, setIsCloudConnected] = useState<boolean>(isSupabaseConfigured);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [accounts, setAccounts] = useState<Account[]>(DEFAULT_ACCOUNTS);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<CategoryBudget[]>(DEFAULT_BUDGETS);
  const [goals, setGoals] = useState<SavingsGoal[]>(DEFAULT_SAVINGS_GOALS);
  const [debts, setDebts] = useState<DebtItem[]>(DEFAULT_DEBTS);
  const [investments, setInvestments] = useState<InvestmentItem[]>(DEFAULT_INVESTMENTS);
  const [recurringRules, setRecurringRules] = useState<RecurringRule[]>(DEFAULT_RECURRING_RULES);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [skyoneLoan, setSkyoneLoan] = useState<MortgageContract>(() => createDefaultSkyOneLoan());
  const [skyoneAutoSyncedNotice, setSkyoneAutoSyncedNotice] = useState<string | null>(null);
  const [readNotifIds, setReadNotifIds] = useState<Set<string>>(new Set());
  const [isAppLocked, setIsAppLocked] = useState<boolean>(false);

  // Bộ lọc
  const [selectedMonth, setSelectedMonth] = useState<string>(() => getCurrentMonthKey());
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedType, setSelectedType] = useState<"ALL" | TransactionType>("ALL");
  const [selectedAccount, setSelectedAccount] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Hàm đồng bộ dữ liệu từ Supabase Cloud về Local State
  const syncWithCloud = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setIsCloudConnected(false);
      return;
    }

    setIsSyncing(true);
    try {
      const cloudData = await supabaseService.fetchAllData();
      if (cloudData) {
        setIsCloudConnected(true);
        setLastSyncedAt(new Date());

        if (cloudData.accounts.length > 0 || cloudData.transactions.length > 0) {
          if (cloudData.categories.length > 0) setCategories(cloudData.categories);
          if (cloudData.budgets.length > 0) setBudgets(cloudData.budgets);
          if (cloudData.goals.length > 0) setGoals(cloudData.goals);
          if (cloudData.debts.length > 0) setDebts(cloudData.debts);
          if (cloudData.investments.length > 0) setInvestments(cloudData.investments);
          if (cloudData.settings) setSettings(cloudData.settings);

          const recalcAccounts = recalculateAccountBalances(
            cloudData.accounts,
            cloudData.transactions
          );
          setTransactions(cloudData.transactions);
          setAccounts(recalcAccounts);
        }
      } else {
        setIsCloudConnected(false);
      }
    } catch (err) {
      console.error("Cloud sync error:", err);
      setIsCloudConnected(false);
    } finally {
      setIsSyncing(false);
    }
  }, []);

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
    setSettings(data.settings);
    const { contract: reconciledOnLoad } = reconcileBidvSkyOneContract(data.skyoneLoan);
    setSkyoneLoan(reconciledOnLoad);

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
      setSkyoneHighlightPeriod(initialRoute.highlightPeriod);
      saveActiveApp(initialRoute.app);
    }

    const isDirectLoginRoute = Boolean(initialRoute?.isLoginRoute);
    if (hasAnyAppPasscode(data.settings) || data.settings.requireAuthOnOpen || isDirectLoginRoute) {
      setIsAppLocked(true);
    }

    const updatedAccounts = recalculateAccountBalances(data.accounts, data.transactions);
    setAccounts(updatedAccounts);

    setIsLoaded(true);

    if (isSupabaseConfigured) {
      syncWithCloud();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      setSkyoneHighlightPeriod(parsed.highlightPeriod);
      saveActiveApp(parsed.app);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [isLoaded]);

  useEffect(() => {
    if (!isLoaded || typeof document === "undefined") return;
    document.title = getAppDocumentTitle(activeApp, activeTab, skyoneTab);
  }, [isLoaded, activeApp, activeTab, skyoneTab]);

  const switchSubApp = useCallback(
    (
      app: SubAppId,
      options?: {
        financeTab?: FinanceTab;
        skyoneTab?: SkyOneRouteTab;
        highlightPeriod?: number | null;
      }
    ) => {
      const nextFinanceTab = options?.financeTab ?? activeTab;
      const nextSkyoneTab = options?.skyoneTab ?? skyoneTab;
      const nextHighlight =
        options?.highlightPeriod !== undefined ? options.highlightPeriod : null;

      if (app === "SKYONE") {
        setSkyoneLoan((prev) => {
          const { contract: reconciled, didAutoSync } = reconcileBidvSkyOneContract(prev);
          if (didAutoSync) {
            setSkyoneAutoSyncedNotice(
              "Đã tự động nhận diện hồ sơ BIDV TK 8866102943 (5,5%/năm · 36 tháng) và đồng bộ 12 kỳ sao kê Đã xác thực."
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
      setSkyoneHighlightPeriod(nextHighlight);
      saveActiveApp(app);

      if (typeof window !== "undefined") {
        const targetPath = buildAppPath(app, nextFinanceTab, nextSkyoneTab, nextHighlight);
        const currentFull = `${window.location.pathname}${window.location.search}`;
        if (currentFull !== targetPath) {
          window.history.pushState(null, "", targetPath);
        }
      }
    },
    [activeTab, skyoneTab]
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
      settings,
      skyoneLoan,
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
    settings,
    skyoneLoan,
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

  useEffect(() => {
    if (typeof document === "undefined") return;
    const isDark = themeMode === "dark";
    document.documentElement.classList.toggle("dark", isDark);
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute("content", isDark ? "#0F172A" : "#1E3A8A");
    }
  }, [themeMode]);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setSettings((prev) => {
      const next = { ...prev, themeMode: mode };
      if (isSupabaseConfigured) {
        supabaseService.updateSettings(next);
      }
      return next;
    });
  }, []);

  const toggleThemeMode = useCallback(() => {
    setSettings((prev) => {
      const nextMode: ThemeMode = prev.themeMode === "dark" ? "light" : "dark";
      const next = { ...prev, themeMode: nextMode };
      if (isSupabaseConfigured) {
        supabaseService.updateSettings(next);
      }
      return next;
    });
  }, []);

  // Privacy, /login Route & Multi-Member Security Lock
  const isPrivacyMode = Boolean(settings.privacyMode);
  const hasPasscodeProtection = useMemo(() => hasAnyAppPasscode(settings), [settings]);

  const togglePrivacyMode = useCallback(() => {
    setSettings((prev) => ({ ...prev, privacyMode: !prev.privacyMode }));
  }, []);

  const unlockWithPasscode = useCallback(
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
    [settings]
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

  const setMemberPasscode = useCallback(async (member: AuthMemberId, newCode: string) => {
    const { hash, salt } = await hashPasscode(newCode);
    setSettings((prev) => ({
      ...prev,
      pinCode: "",
      requireAuthOnOpen: true,
      authActiveProfile: member,
      [member === "HUSBAND" ? "husbandAuth" : "wifeAuth"]: {
        ...getMemberAuthConfig(prev, member),
        passcodeHash: hash,
        passcodeSalt: salt,
        updatedAt: new Date().toISOString(),
      },
    }));
  }, []);

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
      if (!hasAnyAppPasscode(nextSettings)) {
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
        setIsAppLocked(true);
      } else if (!hasAnyAppPasscode(settings)) {
        setIsAppLocked(false);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [settings]);

  // Tự động khóa theo thời gian không thao tác (autoLockMinutes) & khi ẩn ứng dụng (lockOnBackground)
  useEffect(() => {
    if (!isLoaded || isAppLocked || !hasPasscodeProtection) return;

    const timeoutMinutes = settings.autoLockMinutes ?? 0;
    let inactivityTimer: number | undefined;

    const resetTimer = () => {
      if (inactivityTimer) window.clearTimeout(inactivityTimer);
      if (timeoutMinutes > 0) {
        inactivityTimer = window.setTimeout(() => {
          lockApp();
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
        lockApp();
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
    hasPasscodeProtection,
    settings.autoLockMinutes,
    settings.lockOnBackground,
    lockApp,
  ]);

  // CRUD Danh mục
  const addCategory = useCallback((cat: Omit<Category, "id">): Category => {
    const newCat: Category = {
      ...cat,
      id: `cat_${cat.type.toLowerCase()}_${Date.now()}`,
      isDefault: false,
    };
    setCategories((prev) => [...prev, newCat]);
    return newCat;
  }, []);

  const updateCategory = useCallback((id: string, cat: Partial<Category>) => {
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, ...cat } : c)));
  }, []);

  const deleteCategory = useCallback((id: string) => {
    setCategories((prev) => prev.filter((c) => c.id !== id));
  }, []);

  // CRUD Giao dịch
  const addTransaction = useCallback((input: TransactionInput): Transaction => {
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
        if (isSupabaseConfigured) {
          supabaseService.upsertTransaction(newTx);
          supabaseService.updateAccounts(recalc);
        }
        return recalc;
      });
      return next;
    });

    return newTx;
  }, []);

  const addTransactionsBatch = useCallback((inputs: TransactionInput[]): Transaction[] => {
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
      setAccounts((prevAccs) => recalculateAccountBalances(prevAccs, next));
      return next;
    });

    return created;
  }, []);

  const updateTransaction = useCallback((id: string, input: Partial<TransactionInput>) => {
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
        if (isSupabaseConfigured && updatedTx) {
          supabaseService.upsertTransaction(updatedTx);
          supabaseService.updateAccounts(recalc);
        }
        return recalc;
      });

      return next;
    });
  }, []);

  const deleteTransaction = useCallback((id: string) => {
    setTransactions((prev) => {
      const next = prev.filter((tx) => tx.id !== id);
      setAccounts((prevAccs) => {
        const recalc = recalculateAccountBalances(prevAccs, next);
        if (isSupabaseConfigured) {
          supabaseService.deleteTransaction(id);
          supabaseService.updateAccounts(recalc);
        }
        return recalc;
      });
      return next;
    });
  }, []);

  const deleteTransactionsBatch = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    setTransactions((prev) => {
      const next = prev.filter((tx) => !idSet.has(tx.id));
      setAccounts((prevAccs) => recalculateAccountBalances(prevAccs, next));
      return next;
    });
  }, []);

  // Quản lý Tài khoản (Ví)
  const addAccount = useCallback((acc: Omit<Account, "id" | "currentBalance">) => {
    const newId = `acc_${Date.now()}`;
    const newAccount: Account = {
      ...acc,
      id: newId,
      currentBalance: acc.initialBalance,
    };
    setAccounts((prev) => {
      const next = [...prev, newAccount];
      if (isSupabaseConfigured) {
        supabaseService.upsertAccount(newAccount);
      }
      return next;
    });
  }, []);

  const updateAccount = useCallback(
    (id: string, acc: Partial<Account>) => {
      setAccounts((prev) => {
        const mapped = prev.map((a) => (a.id === id ? { ...a, ...acc } : a));
        const recalc = recalculateAccountBalances(mapped, transactions);
        if (isSupabaseConfigured) {
          const target = recalc.find((a) => a.id === id);
          if (target) supabaseService.upsertAccount(target);
        }
        return recalc;
      });
    },
    [transactions]
  );

  const deleteAccount = useCallback((id: string) => {
    setAccounts((prev) => {
      const next = prev.filter((a) => a.id !== id);
      if (isSupabaseConfigured) {
        supabaseService.updateAccounts(next);
      }
      return next;
    });
  }, []);

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

      if (isSupabaseConfigured) {
        supabaseService.upsertBudget(targetBudget);
      }
    },
    [selectedMonth]
  );

  const deleteBudget = useCallback(
    (categoryId: string, month?: string) => {
      const targetMonth = month || (selectedMonth === "ALL" ? getCurrentMonthKey() : selectedMonth);
      setBudgets((prev) =>
        prev.filter((b) => !(b.categoryId === categoryId && b.month === targetMonth))
      );
    },
    [selectedMonth]
  );

  const copyBudgetsFromMonth = useCallback((fromMonth: string, toMonth: string): number => {
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
      return [...prev, ...additions];
    });
    return copied;
  }, []);

  // Mục tiêu
  const addGoal = useCallback((goal: Omit<SavingsGoal, "id" | "isCompleted">) => {
    const newGoal: SavingsGoal = {
      ...goal,
      id: `goal_${Date.now()}`,
      isCompleted: goal.currentAmount >= goal.targetAmount,
    };
    setGoals((prev) => [...prev, newGoal]);
    if (isSupabaseConfigured) {
      supabaseService.upsertGoal(newGoal);
    }
  }, []);

  const updateGoal = useCallback((id: string, goal: Partial<SavingsGoal>) => {
    setGoals((prev) => {
      let target: SavingsGoal | undefined;
      const next = prev.map((g) => {
        if (g.id !== id) return g;
        target = { ...g, ...goal };
        target.isCompleted = target.currentAmount >= target.targetAmount;
        return target;
      });
      if (isSupabaseConfigured && target) {
        supabaseService.upsertGoal(target);
      }
      return next;
    });
  }, []);

  const deleteGoal = useCallback((id: string) => {
    setGoals((prev) => prev.filter((g) => g.id !== id));
    if (isSupabaseConfigured) {
      supabaseService.deleteGoal(id);
    }
  }, []);

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
        if (isSupabaseConfigured && target) {
          supabaseService.upsertGoal(target);
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
    [accounts, addTransaction]
  );

  // Nợ & Đầu tư
  const addDebt = useCallback((debt: Omit<DebtItem, "id">) => {
    const newDebt: DebtItem = { ...debt, id: `debt_${Date.now()}` };
    setDebts((prev) => [...prev, newDebt]);
    if (isSupabaseConfigured) {
      supabaseService.upsertDebt(newDebt);
    }
  }, []);

  const updateDebt = useCallback((id: string, debt: Partial<DebtItem>) => {
    setDebts((prev) => {
      let target: DebtItem | undefined;
      const next = prev.map((d) => {
        if (d.id !== id) return d;
        target = { ...d, ...debt };
        target.status = target.paidAmount >= target.totalAmount ? "PAID" : (debt.status || target.status);
        return target;
      });
      if (isSupabaseConfigured && target) {
        supabaseService.upsertDebt(target);
      }
      return next;
    });
  }, []);

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
        if (isSupabaseConfigured && target) {
          supabaseService.upsertDebt(target);
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
    [debts, accounts, addTransaction]
  );

  const deleteDebt = useCallback((id: string) => {
    setDebts((prev) => prev.filter((d) => d.id !== id));
    if (isSupabaseConfigured) {
      supabaseService.deleteDebt(id);
    }
  }, []);

  const addInvestment = useCallback((inv: Omit<InvestmentItem, "id">) => {
    const newInv: InvestmentItem = { ...inv, id: `inv_${Date.now()}` };
    setInvestments((prev) => [...prev, newInv]);
    if (isSupabaseConfigured) {
      supabaseService.upsertInvestment(newInv);
    }
  }, []);

  const updateInvestment = useCallback((id: string, inv: Partial<InvestmentItem>) => {
    setInvestments((prev) => {
      let target: InvestmentItem | undefined;
      const next = prev.map((i) => {
        if (i.id === id) {
          target = { ...i, ...inv };
          return target;
        }
        return i;
      });
      if (isSupabaseConfigured && target) {
        supabaseService.upsertInvestment(target);
      }
      return next;
    });
  }, []);

  const deleteInvestment = useCallback((id: string) => {
    setInvestments((prev) => prev.filter((i) => i.id !== id));
    if (isSupabaseConfigured) {
      supabaseService.deleteInvestment(id);
    }
  }, []);

  // Giao dịch Định kỳ (Recurring Rules)
  const addRecurringRule = useCallback((rule: Omit<RecurringRule, "id">) => {
    const newRule: RecurringRule = { ...rule, id: `rec_${Date.now()}` };
    setRecurringRules((prev) => [...prev, newRule]);
  }, []);

  const updateRecurringRule = useCallback((id: string, rule: Partial<RecurringRule>) => {
    setRecurringRules((prev) => prev.map((r) => (r.id === id ? { ...r, ...rule } : r)));
  }, []);

  const deleteRecurringRule = useCallback((id: string) => {
    setRecurringRules((prev) => prev.filter((r) => r.id !== id));
  }, []);

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

      setRecurringRules((prev) =>
        prev.map((r) => (r.id === id ? { ...r, lastAppliedMonth: month } : r))
      );

      return created;
    },
    [recurringRules, selectedMonth, addTransaction]
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
      setRecurringRules((prev) =>
        prev.map((r) => (pendingIds.has(r.id) ? { ...r, lastAppliedMonth: month } : r))
      );

      return pending.length;
    },
    [recurringRules, selectedMonth, addTransactionsBatch]
  );

  const updateSkyOneContract = useCallback((patch: Partial<MortgageContract>) => {
    setSkyoneLoan((prev) => ({
      ...prev,
      ...patch,
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const confirmSkyOnePeriods = useCallback(
    (
      periods: number[],
      options?: { linkAccountId?: string; paidAt?: string; note?: string }
    ): number => {
      if (periods.length === 0) return 0;
      const periodSet = new Set(periods);
      const schedule = generateMortgageSchedule(skyoneLoan);
      const targets = schedule.rows.filter(
        (r) => periodSet.has(r.period) && r.status !== "PAID"
      );
      if (targets.length === 0) return 0;

      const paidDate = options?.paidAt || getTodayIsoDate();
      let createdTxs: Transaction[] = [];

      if (options?.linkAccountId) {
        const srcAcc = accounts.find((a) => a.id === options.linkAccountId);
        const ownerMember: FamilyMember =
          srcAcc?.owner && srcAcc.owner !== "SHARED" ? srcAcc.owner : "HUSBAND";
        const txInputs: TransactionInput[] = targets.map((row) => ({
          amount: row.totalPayment,
          date: paidDate,
          type: "EXPENSE",
          categoryId: "cat_expense_rent",
          accountId: options.linkAccountId!,
          memberId: ownerMember,
          scope: "FAMILY",
          tag: "DEBT",
          note: `${skyoneLoan.projectName} · Kỳ #${row.period} (Gốc ${row.principal.toLocaleString(
            "vi-VN"
          )}đ + Lãi ${row.interest.toLocaleString("vi-VN")}đ)`,
        }));
        createdTxs = addTransactionsBatch(txInputs);
      }

      const newRecords: MortgagePaidInstallmentRecord[] = targets.map((row, idx) => ({
        period: row.period,
        paidAt: paidDate,
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
        return {
          ...prev,
          paidRecords: merged,
          updatedAt: new Date().toISOString(),
        };
      });

      return newRecords.length;
    },
    [skyoneLoan, accounts, addTransactionsBatch]
  );

  const undoSkyOnePeriod = useCallback(
    (period: number) => {
      const targetRecord = skyoneLoan.paidRecords.find((r) => r.period === period);
      if (targetRecord?.linkedTransactionId) {
        deleteTransaction(targetRecord.linkedTransactionId);
      }
      setSkyoneLoan((prev) => ({
        ...prev,
        paidRecords: prev.paidRecords.filter((r) => r.period !== period),
        updatedAt: new Date().toISOString(),
      }));
    },
    [skyoneLoan.paidRecords, deleteTransaction]
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

      setSkyoneLoan((prev) => ({
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
      }));
    },
    [skyoneLoan, accounts, addTransaction]
  );

  const deleteSkyOnePrepayment = useCallback(
    (id: string) => {
      const targetPrepay = skyoneLoan.prepayments.find((p) => p.id === id);
      if (targetPrepay?.linkedTransactionId) {
        deleteTransaction(targetPrepay.linkedTransactionId);
      }
      setSkyoneLoan((prev) => ({
        ...prev,
        prepayments: prev.prepayments.filter((p) => p.id !== id),
        updatedAt: new Date().toISOString(),
      }));
    },
    [skyoneLoan.prepayments, deleteTransaction]
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

  const addSkyOneRateAdjustment = useCallback((adj: Omit<MortgageRateAdjustment, "id">) => {
    setSkyoneLoan((prev) => ({
      ...prev,
      rateAdjustments: [
        ...prev.rateAdjustments,
        {
          ...adj,
          id: `rate_adj_${Date.now()}`,
        },
      ].sort((a, b) => a.effectiveFromPeriod - b.effectiveFromPeriod),
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const deleteSkyOneRateAdjustment = useCallback((id: string) => {
    setSkyoneLoan((prev) => ({
      ...prev,
      rateAdjustments: prev.rateAdjustments.filter((r) => r.id !== id),
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const resetSkyOneLoan = useCallback(() => {
    setSkyoneLoan(createDefaultSkyOneLoan());
  }, []);

  const updateSettings = useCallback((newSettings: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...newSettings };
      if (isSupabaseConfigured) {
        supabaseService.updateSettings(next);
      }
      return next;
    });
  }, []);

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
    setSettings(seeded.settings);
    setSkyoneLoan(seeded.skyoneLoan);
    setSelectedMonth("2026-10");
    setActivePerspective("ALL");
    setIsAppLocked(false);
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
      settings,
      skyoneLoan,
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
    settings,
    skyoneLoan,
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
        setSettings(res.data.settings);
        setSkyoneLoan(reconcileBidvSkyOneContract(res.data.skyoneLoan).contract);
        saveStoredDataV3(res.data);

        if (isSupabaseConfigured) {
          res.data.accounts.forEach((a) => supabaseService.upsertAccount(a));
          res.data.transactions.forEach((t) => supabaseService.upsertTransaction(t));
          res.data.budgets.forEach((b) => supabaseService.upsertBudget(b));
          res.data.goals.forEach((g) => supabaseService.upsertGoal(g));
          res.data.debts.forEach((d) => supabaseService.upsertDebt(d));
          res.data.investments.forEach((i) => supabaseService.upsertInvestment(i));
          supabaseService.updateSettings(res.data.settings);
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
      settings,
      skyoneLoan,
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
    settings,
    skyoneLoan,
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
          settings,
          skyoneLoan,
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
      settings,
      skyoneLoan,
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
        settings,
        skyoneLoan,
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
      setSettings(nextState.settings);
      setSkyoneLoan(nextState.skyoneLoan);
      saveStoredDataV3(nextState);

      if (isSupabaseConfigured) {
        nextState.accounts.forEach((a) => supabaseService.upsertAccount(a));
        nextState.transactions.forEach((t) => supabaseService.upsertTransaction(t));
        nextState.budgets.forEach((b) => supabaseService.upsertBudget(b));
        nextState.goals.forEach((g) => supabaseService.upsertGoal(g));
        nextState.debts.forEach((d) => supabaseService.upsertDebt(d));
        nextState.investments.forEach((i) => supabaseService.upsertInvestment(i));
        supabaseService.updateSettings(nextState.settings);
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
      settings,
      skyoneLoan,
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

    const totalInvested = investments
      .filter((i) => i.status === "ACTIVE")
      .filter((i) => {
        if (activePerspective === "ALL") return true;
        if (activePerspective === "HUSBAND") return i.memberId === "HUSBAND" || i.memberId === "SHARED";
        if (activePerspective === "WIFE") return i.memberId === "WIFE" || i.memberId === "SHARED";
        return true;
      })
      .reduce((sum, i) => sum + (i.currentValue || i.amount), 0);

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
  }, [accounts, debts, investments, transactions, selectedMonth, activePerspective]);

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
      if (b.percentage >= 90) {
        const nid = `budget_warn_${b.categoryId}_${activeMonth}`;
        list.push({
          id: nid,
          title: `Ngân sách "${b.categoryName}" đạt ${b.percentage}%`,
          message:
            b.percentage >= 100
              ? `Danh mục ${b.categoryName} đã vượt ngân sách tháng ${activeMonth}.`
              : `Danh mục ${b.categoryName} đã dùng ${b.percentage}% hạn mức tháng.`,
          type: b.percentage >= 100 ? "danger" : "warning",
          date: today,
          read: readNotifIds.has(nid),
        });
      }
    });

    const pendingRecurring = recurringRules.filter(
      (r) => r.isActive && r.lastAppliedMonth !== activeMonth
    );
    if (pendingRecurring.length > 0) {
      list.push({
        id: `rec_pending_${activeMonth}`,
        title: `${pendingRecurring.length} giao dịch định kỳ chờ ghi sổ`,
        message: `Có ${pendingRecurring.length} khoản thu/chi định kỳ chưa áp dụng cho kỳ ${activeMonth}. Vào Kế hoạch hoặc Quản trị Dữ liệu để ghi sổ 1 chạm.`,
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
    budgetSummary.items,
    recurringRules,
    selectedMonth,
    readNotifIds,
  ]);

  const markNotificationRead = useCallback((id: string) => {
    setReadNotifIds((prev) => new Set(prev).add(id));
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
    switchSubApp,
    openAppLauncher,
    getSkyOneLinkForTransaction,
    isCloudConnected,
    isSyncing,
    lastSyncedAt,
    syncWithCloud,
    activePerspective,
    setActivePerspective,
    themeMode,
    setThemeMode,
    toggleThemeMode,
    isPrivacyMode,
    togglePrivacyMode,
    isAppLocked,
    hasPasscodeProtection,
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
    resetSkyOneLoan,
    updateSettings,
    markNotificationRead,
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
