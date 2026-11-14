import {
  Category,
  Account,
  Transaction,
  CategoryBudget,
  SavingsGoal,
  DebtItem,
  InvestmentItem,
  AppSettings,
  AppDataBackup,
  RecurringRule,
  MortgageContract,
} from "@/types/finance";
import { DEFAULT_CATEGORIES } from "@/constants/defaultCategories";
import {
  DEFAULT_ACCOUNTS,
  DEFAULT_TRANSACTIONS,
  DEFAULT_BUDGETS,
  DEFAULT_SAVINGS_GOALS,
  DEFAULT_DEBTS,
  DEFAULT_INVESTMENTS,
  DEFAULT_SETTINGS,
  DEFAULT_RECURRING_RULES,
} from "@/constants/mockData";
import { AppDataBackupSchema, MortgageContractSchema } from "./validations";
import { createDefaultSkyOneLoan, reconcileBidvSkyOneContract } from "./mortgageEngine";

export const STORAGE_KEY_V3 = "HOME_MONI_DATA_V4";

export interface StoredAppStateV3 {
  categories: Category[];
  accounts: Account[];
  transactions: Transaction[];
  budgets: CategoryBudget[];
  goals: SavingsGoal[];
  debts: DebtItem[];
  investments: InvestmentItem[];
  recurringRules: RecurringRule[];
  settings: AppSettings;
  skyoneLoan: MortgageContract;
}

function isStorageAvailable(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

/**
 * Tự động tính toán lại số dư của từng tài khoản:
 * - Với tài khoản ngân hàng / tiền mặt: Số dư = Đầu kỳ + Thu - Chi - Chuyển đi + Chuyển đến
 * - Với thẻ tín dụng: Dư nợ = Đầu kỳ + Chi tiêu bằng thẻ - Thanh toán thẻ (chuyển vào)
 */
export function recalculateAccountBalances(
  accounts: Account[],
  transactions: Transaction[]
): Account[] {
  return accounts.map((acc) => {
    let balance = acc.initialBalance;
    const isCredit = acc.type === "CREDIT_CARD";

    for (const tx of transactions) {
      if (isCredit) {
        // Thẻ tín dụng: Chi tiêu làm TĂNG dư nợ, chuyển tiền vào làm GIẢM dư nợ
        if (tx.type === "EXPENSE" && tx.accountId === acc.id) {
          balance += tx.amount;
        } else if (tx.type === "TRANSFER" && tx.toAccountId === acc.id) {
          balance -= tx.amount;
        }
      } else {
        // Tài khoản thanh toán thường:
        if (tx.type === "INCOME" && tx.accountId === acc.id) {
          balance += tx.amount;
        } else if (tx.type === "EXPENSE" && tx.accountId === acc.id) {
          balance -= tx.amount;
        } else if (tx.type === "TRANSFER") {
          if (tx.accountId === acc.id) {
            balance -= tx.amount;
          }
          if (tx.toAccountId === acc.id) {
            balance += tx.amount;
          }
        }
      }
    }

    return {
      ...acc,
      currentBalance: balance,
    };
  });
}

/**
 * Khởi tạo dữ liệu mẫu chuẩn HOME MONI cho gia đình
 */
export function seedInitialDataV3(): StoredAppStateV3 {
  const initialData: StoredAppStateV3 = {
    categories: DEFAULT_CATEGORIES,
    accounts: DEFAULT_ACCOUNTS,
    transactions: DEFAULT_TRANSACTIONS,
    budgets: DEFAULT_BUDGETS,
    goals: DEFAULT_SAVINGS_GOALS,
    debts: DEFAULT_DEBTS,
    investments: DEFAULT_INVESTMENTS,
    recurringRules: DEFAULT_RECURRING_RULES,
    settings: DEFAULT_SETTINGS,
    skyoneLoan: createDefaultSkyOneLoan(),
  };

  initialData.accounts = recalculateAccountBalances(initialData.accounts, initialData.transactions);

  if (isStorageAvailable()) {
    try {
      window.localStorage.setItem(STORAGE_KEY_V3, JSON.stringify(initialData));
    } catch (e) {
      console.warn("Không thể lưu trữ vào localStorage:", e);
    }
  }

  return initialData;
}

/**
 * Đọc dữ liệu từ LocalStorage V3
 */
export function loadStoredDataV3(): StoredAppStateV3 {
  if (!isStorageAvailable()) {
    return seedInitialDataV3();
  }

  try {
    const rawV3 = window.localStorage.getItem(STORAGE_KEY_V3);
    if (rawV3) {
      const parsed = JSON.parse(rawV3);
      if (parsed.transactions && Array.isArray(parsed.transactions)) {
        const skyoneParsed = MortgageContractSchema.safeParse(parsed.skyoneLoan);
        const { contract: reconciledSkyOne, didAutoSync } = reconcileBidvSkyOneContract(
          skyoneParsed.success ? skyoneParsed.data : undefined
        );
        const nextState: StoredAppStateV3 = {
          categories: parsed.categories?.length ? parsed.categories : DEFAULT_CATEGORIES,
          accounts: parsed.accounts?.length ? parsed.accounts : DEFAULT_ACCOUNTS,
          transactions: parsed.transactions || [],
          budgets: parsed.budgets || DEFAULT_BUDGETS,
          goals: parsed.goals || DEFAULT_SAVINGS_GOALS,
          debts: parsed.debts || DEFAULT_DEBTS,
          investments: parsed.investments || DEFAULT_INVESTMENTS,
          recurringRules: Array.isArray(parsed.recurringRules)
            ? parsed.recurringRules
            : DEFAULT_RECURRING_RULES,
          settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
          skyoneLoan: reconciledSkyOne,
        };
        if (didAutoSync) {
          saveStoredDataV3(nextState);
        }
        return nextState;
      }
    }

    return seedInitialDataV3();
  } catch (err) {
    console.error("Lỗi khi đọc LocalStorage V3:", err);
    return seedInitialDataV3();
  }
}

/**
 * Lưu trạng thái vào LocalStorage V3
 */
export function saveStoredDataV3(state: StoredAppStateV3): boolean {
  if (!isStorageAvailable()) return false;
  try {
    window.localStorage.setItem(STORAGE_KEY_V3, JSON.stringify(state));
    return true;
  } catch (error) {
    console.error("Lỗi khi lưu LocalStorage V3:", error);
    return false;
  }
}

export function buildSyncBundlePayload(state: StoredAppStateV3): AppDataBackup {
  return {
    version: "4.0",
    exportedAt: new Date().toISOString(),
    categories: state.categories,
    accounts: state.accounts,
    transactions: state.transactions,
    budgets: state.budgets,
    goals: state.goals,
    debts: state.debts,
    investments: state.investments,
    recurringRules: state.recurringRules,
    settings: state.settings,
    skyoneLoan: state.skyoneLoan,
  };
}

export function buildSyncBundleJson(state: StoredAppStateV3): string {
  return JSON.stringify(buildSyncBundlePayload(state), null, 2);
}

/**
 * Xuất dữ liệu sao lưu JSON
 */
export function exportDataToJsonV3(state: StoredAppStateV3): void {
  const jsonString = buildSyncBundleJson(state);
  const blob = new Blob([jsonString], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const now = new Date();
  const dateFormatted = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
  const filename = `home_moni_family_backup_${dateFormatted}.json`;

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function escapeCsvCell(value: string): string {
  const safe = value.replace(/"/g, '""');
  return `"${safe}"`;
}

/**
 * Xuất danh sách giao dịch ra tệp CSV chuẩn UTF-8 BOM (mở trực tiếp bằng Excel / Google Sheets)
 */
export function exportTransactionsToCsv(
  transactions: Transaction[],
  categories: Category[],
  accounts: Account[],
  monthFilter: string,
  husbandName = "Anh Chuột",
  wifeName = "Bé Mèo"
): void {
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));
  const accountMap = new Map(accounts.map((a) => [a.id, a.name]));

  const filtered = transactions
    .filter((tx) => monthFilter === "ALL" || tx.date.startsWith(monthFilter))
    .sort((a, b) => b.date.localeCompare(a.date));

  const headers = [
    "Mã GD",
    "Ngày",
    "Loại",
    "Số tiền (VND)",
    "Danh mục",
    "Tài khoản nguồn",
    "Tài khoản đích",
    "Thành viên",
    "Phạm vi",
    "Ghi chú",
  ];

  const rows = filtered.map((tx) => {
    const typeLabel =
      tx.type === "INCOME" ? "Thu nhập" : tx.type === "EXPENSE" ? "Chi tiêu" : "Chuyển khoản";
    const memberLabel =
      tx.memberId === "HUSBAND" ? husbandName : tx.memberId === "WIFE" ? wifeName : "Chung";
    const scopeLabel = tx.scope === "FAMILY" ? "Chung gia đình" : "Cá nhân";

    return [
      escapeCsvCell(tx.id),
      escapeCsvCell(tx.date),
      escapeCsvCell(typeLabel),
      String(tx.amount),
      escapeCsvCell(categoryMap.get(tx.categoryId) || tx.categoryId),
      escapeCsvCell(accountMap.get(tx.accountId) || tx.accountId),
      escapeCsvCell(tx.toAccountId ? accountMap.get(tx.toAccountId) || tx.toAccountId : ""),
      escapeCsvCell(memberLabel),
      escapeCsvCell(scopeLabel),
      escapeCsvCell(tx.note || ""),
    ].join(",");
  });

  const csvContent = "\uFEFF" + [headers.map(escapeCsvCell).join(","), ...rows].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const label = monthFilter === "ALL" ? "toan_thoi_gian" : monthFilter;
  const link = document.createElement("a");
  link.href = url;
  link.download = `home_moni_bao_cao_${label}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Phân tích chuỗi JSON gói đồng bộ / sao lưu thành StoredAppStateV3 chuẩn hóa
 */
export function parseSyncBundleText(text: string): {
  success: boolean;
  data?: StoredAppStateV3;
  error?: string;
} {
  const trimmed = text.trim();
  if (!trimmed) {
    return { success: false, error: "Dữ liệu gói đồng bộ đang rỗng." };
  }

  try {
    const rawJson: unknown = JSON.parse(trimmed);
    const validation = AppDataBackupSchema.safeParse(rawJson);

    if (!validation.success) {
      const firstError = validation.error.issues?.[0]?.message || "Cấu trúc gói JSON không hợp lệ";
      return { success: false, error: `Lỗi định dạng: ${firstError}` };
    }

    const validData = validation.data;
    const appState: StoredAppStateV3 = {
      categories: validData.categories,
      accounts: validData.accounts ?? DEFAULT_ACCOUNTS,
      transactions: validData.transactions,
      budgets: validData.budgets ?? DEFAULT_BUDGETS,
      goals: validData.goals ?? DEFAULT_SAVINGS_GOALS,
      debts: validData.debts ?? DEFAULT_DEBTS,
      investments: validData.investments ?? DEFAULT_INVESTMENTS,
      recurringRules: validData.recurringRules ?? DEFAULT_RECURRING_RULES,
      settings: { ...DEFAULT_SETTINGS, ...(validData.settings || {}) },
      skyoneLoan: reconcileBidvSkyOneContract(validData.skyoneLoan).contract,
    };

    appState.accounts = recalculateAccountBalances(appState.accounts, appState.transactions);
    return { success: true, data: appState };
  } catch {
    return { success: false, error: "Không thể đọc chuỗi JSON. Vui lòng kiểm tra lại định dạng." };
  }
}

export interface MergeDiffPreview {
  newTransactions: number;
  newAccounts: number;
  newGoals: number;
  newDebts: number;
  newInvestments: number;
  newBudgets: number;
  newCategories: number;
  newRecurringRules: number;
  newMortgagePaidRecords: number;
  newMortgagePrepayments: number;
  newMortgageRateAdjustments: number;
  totalNewItems: number;
  totalIncomingTransactions: number;
}

export interface MergeOptions {
  mode: "MERGE" | "REPLACE";
  keepLocalSecurity: boolean;
}

function mergeById<T extends { id: string }>(existing: T[], incoming: T[]): T[] {
  const seen = new Set(existing.map((item) => item.id));
  const additions = incoming.filter((item) => !seen.has(item.id));
  return [...existing, ...additions];
}

function budgetKey(b: CategoryBudget): string {
  return `${b.categoryId}__${b.month}`;
}

export function previewMergeDiff(
  current: StoredAppStateV3,
  incoming: StoredAppStateV3
): MergeDiffPreview {
  const countNewById = <T extends { id: string }>(a: T[], b: T[]) => {
    const ids = new Set(a.map((x) => x.id));
    return b.filter((x) => !ids.has(x.id)).length;
  };

  const budgetKeys = new Set(current.budgets.map(budgetKey));
  const newBudgets = incoming.budgets.filter((b) => !budgetKeys.has(budgetKey(b))).length;

  const newTransactions = countNewById(current.transactions, incoming.transactions);
  const newAccounts = countNewById(current.accounts, incoming.accounts);
  const newGoals = countNewById(current.goals, incoming.goals);
  const newDebts = countNewById(current.debts, incoming.debts);
  const newInvestments = countNewById(current.investments, incoming.investments);
  const newCategories = countNewById(current.categories, incoming.categories);
  const newRecurringRules = countNewById(current.recurringRules, incoming.recurringRules);

  const curPaidPeriods = new Set(current.skyoneLoan.paidRecords.map((r) => r.period));
  const newMortgagePaidRecords = incoming.skyoneLoan.paidRecords.filter(
    (r) => !curPaidPeriods.has(r.period)
  ).length;
  const newMortgagePrepayments = countNewById(
    current.skyoneLoan.prepayments,
    incoming.skyoneLoan.prepayments
  );
  const newMortgageRateAdjustments = countNewById(
    current.skyoneLoan.rateAdjustments,
    incoming.skyoneLoan.rateAdjustments
  );

  const totalNewItems =
    newTransactions +
    newAccounts +
    newGoals +
    newDebts +
    newInvestments +
    newBudgets +
    newCategories +
    newRecurringRules +
    newMortgagePaidRecords +
    newMortgagePrepayments +
    newMortgageRateAdjustments;

  return {
    newTransactions,
    newAccounts,
    newGoals,
    newDebts,
    newInvestments,
    newBudgets,
    newCategories,
    newRecurringRules,
    newMortgagePaidRecords,
    newMortgagePrepayments,
    newMortgageRateAdjustments,
    totalNewItems,
    totalIncomingTransactions: incoming.transactions.length,
  };
}

export function mergeFinanceData(
  current: StoredAppStateV3,
  incoming: StoredAppStateV3,
  options: MergeOptions
): StoredAppStateV3 {
  const securitySlice: Partial<AppSettings> = options.keepLocalSecurity
    ? {
        pinCode: current.settings.pinCode,
        requireAuthOnOpen: current.settings.requireAuthOnOpen,
        autoLockMinutes: current.settings.autoLockMinutes,
        lockOnBackground: current.settings.lockOnBackground,
        requireAuthForDangerActions: current.settings.requireAuthForDangerActions,
        authActiveProfile: current.settings.authActiveProfile,
        husbandAuth: current.settings.husbandAuth,
        wifeAuth: current.settings.wifeAuth,
      }
    : {};

  if (options.mode === "REPLACE") {
    const nextAccounts = recalculateAccountBalances(incoming.accounts, incoming.transactions);
    return {
      ...incoming,
      accounts: nextAccounts,
      settings: {
        ...DEFAULT_SETTINGS,
        ...incoming.settings,
        ...securitySlice,
      },
    };
  }

  const mergedCategories = mergeById(current.categories, incoming.categories);
  const mergedAccountsRaw = mergeById(current.accounts, incoming.accounts);
  const mergedTransactions = mergeById(current.transactions, incoming.transactions);
  const existingBudgetKeys = new Set(current.budgets.map(budgetKey));
  const mergedBudgets = [
    ...current.budgets,
    ...incoming.budgets.filter((b) => !existingBudgetKeys.has(budgetKey(b))),
  ];
  const mergedGoals = mergeById(current.goals, incoming.goals);
  const mergedDebts = mergeById(current.debts, incoming.debts);
  const mergedInvestments = mergeById(current.investments, incoming.investments);
  const mergedRules = mergeById(current.recurringRules, incoming.recurringRules);

  const incomingIsNewer =
    incoming.skyoneLoan.updatedAt.localeCompare(current.skyoneLoan.updatedAt) > 0;
  const baseContract = incomingIsNewer ? incoming.skyoneLoan : current.skyoneLoan;

  const paidPeriodSet = new Set(current.skyoneLoan.paidRecords.map((r) => r.period));
  const mergedPaidRecords = [
    ...current.skyoneLoan.paidRecords,
    ...incoming.skyoneLoan.paidRecords.filter((r) => !paidPeriodSet.has(r.period)),
  ].sort((a, b) => a.period - b.period);

  const mergedPrepayments = mergeById(
    current.skyoneLoan.prepayments,
    incoming.skyoneLoan.prepayments
  ).sort((a, b) => a.afterPeriod - b.afterPeriod || a.date.localeCompare(b.date));

  const mergedRateAdjustments = mergeById(
    current.skyoneLoan.rateAdjustments,
    incoming.skyoneLoan.rateAdjustments
  ).sort((a, b) => a.effectiveFromPeriod - b.effectiveFromPeriod);

  const mergedSkyOneLoan: MortgageContract = {
    ...baseContract,
    paidRecords: mergedPaidRecords,
    prepayments: mergedPrepayments,
    rateAdjustments: mergedRateAdjustments,
    updatedAt: new Date().toISOString(),
  };

  const mergedAccounts = recalculateAccountBalances(mergedAccountsRaw, mergedTransactions);

  return {
    categories: mergedCategories,
    accounts: mergedAccounts,
    transactions: mergedTransactions,
    budgets: mergedBudgets,
    goals: mergedGoals,
    debts: mergedDebts,
    investments: mergedInvestments,
    recurringRules: mergedRules,
    settings: {
      ...DEFAULT_SETTINGS,
      ...current.settings,
      ...securitySlice,
    },
    skyoneLoan: mergedSkyOneLoan,
  };
}

/**
 * Nhập dữ liệu sao lưu JSON từ tệp
 */
export async function importDataFromJsonV3(file: File): Promise<{
  success: boolean;
  data?: StoredAppStateV3;
  error?: string;
}> {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      const text = (event.target?.result as string) || "";
      if (!text.trim()) {
        resolve({ success: false, error: "Tệp tin rỗng" });
        return;
      }
      resolve(parseSyncBundleText(text));
    };

    reader.onerror = () => {
      resolve({ success: false, error: "Đã xảy ra lỗi khi tải tệp từ thiết bị." });
    };

    reader.readAsText(file);
  });
}
