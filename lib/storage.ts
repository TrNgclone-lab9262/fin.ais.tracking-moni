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
  SavingsChallenge,
  GoldPortfolioState,
  GoldPriceSnapshot,
  HandoverChecklistItem,
  InteriorDesignScenario,
  InteriorStudioState,
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
  DEFAULT_SAVINGS_CHALLENGES,
} from "@/constants/mockData";
import {
  AppDataBackupSchema,
  InteriorStudioStateSchema,
  MortgageContractSchema,
  parseGoldPortfolioSafely,
} from "./validations";
import { createDefaultSkyOneLoan, reconcileBidvSkyOneContract } from "./mortgageEngine";
import { createDefaultGoldPortfolio } from "./goldEngine";
import { createDefaultInteriorStudio } from "./interiorFloorplan";

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
  savingsChallenges?: SavingsChallenge[];
  settings: AppSettings;
  skyoneLoan: MortgageContract;
  goldPortfolio: GoldPortfolioState;
  interiorStudio: InteriorStudioState;
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
    savingsChallenges: DEFAULT_SAVINGS_CHALLENGES,
    settings: DEFAULT_SETTINGS,
    skyoneLoan: createDefaultSkyOneLoan(),
    goldPortfolio: createDefaultGoldPortfolio(),
    interiorStudio: createDefaultInteriorStudio(),
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
        const goldRecovered = parseGoldPortfolioSafely(
          parsed.goldPortfolio,
          createDefaultGoldPortfolio
        );
        const interiorParsed = InteriorStudioStateSchema.safeParse(parsed.interiorStudio);
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
          savingsChallenges: Array.isArray(parsed.savingsChallenges)
            ? parsed.savingsChallenges
            : DEFAULT_SAVINGS_CHALLENGES,
          settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
          skyoneLoan: reconciledSkyOne,
          goldPortfolio: goldRecovered.data,
          interiorStudio: interiorParsed.success
            ? interiorParsed.data
            : createDefaultInteriorStudio(),
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
    savingsChallenges: state.savingsChallenges ?? [],
    settings: state.settings,
    skyoneLoan: state.skyoneLoan,
    goldPortfolio: state.goldPortfolio,
    interiorStudio: state.interiorStudio,
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
    let candidateJson: unknown = rawJson;
    let recoveredGoldPortfolio: GoldPortfolioState | undefined;

    // Nếu gói backup có goldPortfolio nhưng bị lỗi cục bộ 1 phần, phục hồi phần hợp lệ trước khi parse toàn gói
    if (
      rawJson &&
      typeof rawJson === "object" &&
      !Array.isArray(rawJson) &&
      "goldPortfolio" in rawJson &&
      (rawJson as Record<string, unknown>).goldPortfolio !== undefined
    ) {
      const recovered = parseGoldPortfolioSafely(
        (rawJson as Record<string, unknown>).goldPortfolio,
        createDefaultGoldPortfolio
      );
      recoveredGoldPortfolio = recovered.data;
      if (recovered.recovered) {
        candidateJson = {
          ...(rawJson as Record<string, unknown>),
          goldPortfolio: recovered.data,
        };
      }
    }

    const validation = AppDataBackupSchema.safeParse(candidateJson);

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
      savingsChallenges: validData.savingsChallenges ?? DEFAULT_SAVINGS_CHALLENGES,
      settings: { ...DEFAULT_SETTINGS, ...(validData.settings || {}) },
      skyoneLoan: reconcileBidvSkyOneContract(validData.skyoneLoan).contract,
      goldPortfolio:
        validData.goldPortfolio ?? recoveredGoldPortfolio ?? createDefaultGoldPortfolio(),
      interiorStudio: validData.interiorStudio ?? createDefaultInteriorStudio(),
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
  newSavingsChallenges?: number;
  newMortgagePaidRecords: number;
  newMortgagePrepayments: number;
  newMortgageRateAdjustments: number;
  newGoldLots?: number;
  newGoldSales?: number;
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

function mergeByIdPreferNewer<T extends { id: string; updatedAt?: string }>(
  existing: T[],
  incoming: T[]
): T[] {
  const map = new Map<string, T>();
  for (const item of existing) {
    map.set(item.id, item);
  }
  for (const item of incoming) {
    const prev = map.get(item.id);
    if (!prev) {
      map.set(item.id, item);
    } else {
      const incTs = item.updatedAt || "";
      const prevTs = prev.updatedAt || "";
      if (incTs.localeCompare(prevTs) > 0) {
        map.set(item.id, item);
      }
    }
  }
  return Array.from(map.values());
}

function mergeGoldPriceHistory(
  existing: GoldPriceSnapshot[] | undefined,
  incoming: GoldPriceSnapshot[] | undefined,
  maxPoints = 90
): GoldPriceSnapshot[] {
  const byDate = new Map<string, GoldPriceSnapshot>();
  for (const snap of existing || []) {
    byDate.set(snap.date, snap);
  }
  for (const snap of incoming || []) {
    const prev = byDate.get(snap.date);
    if (!prev || snap.recordedAt.localeCompare(prev.recordedAt) > 0) {
      byDate.set(snap.date, snap);
    }
  }
  return Array.from(byDate.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-maxPoints);
}

function mergeInteriorScenarios(
  existing: InteriorDesignScenario[],
  incoming: InteriorDesignScenario[]
): InteriorDesignScenario[] {
  const map = new Map<string, InteriorDesignScenario>();
  for (const sc of existing) {
    map.set(sc.id, sc);
  }
  for (const inc of incoming) {
    const prev = map.get(inc.id);
    if (!prev) {
      map.set(inc.id, inc);
      continue;
    }
    const incNewer = (inc.updatedAt || "").localeCompare(prev.updatedAt || "") > 0;
    const primary = incNewer ? inc : prev;
    const secondary = incNewer ? prev : inc;

    // Hợp nhất mảng payments[] chống trùng id trên cả nội thất 3D lẫn dòng BOQ phụ
    const secondaryItemsById = new Map((secondary.items || []).map((f) => [f.id, f]));
    const mergedItems = (primary.items || []).map((item) => {
      const peer = secondaryItemsById.get(item.id);
      if (!peer?.payments?.length) return item;
      const mergedPayments = mergeById(item.payments || [], peer.payments);
      return {
        ...item,
        payments: mergedPayments,
      };
    });

    const secondaryExtraById = new Map((secondary.extraBoqItems || []).map((e) => [e.id, e]));
    const primaryExtraMerged = (primary.extraBoqItems || []).map((item) => {
      const peer = secondaryExtraById.get(item.id);
      if (!peer?.payments?.length) return item;
      const mergedPayments = mergeById(item.payments || [], peer.payments);
      return {
        ...item,
        payments: mergedPayments,
      };
    });
    const mergedExtraBoq = mergeById(primaryExtraMerged, secondary.extraBoqItems || []);
    const mergedBookmarks = mergeById(
      primary.cameraBookmarks || [],
      secondary.cameraBookmarks || []
    ).slice(0, 6);
    map.set(inc.id, {
      ...primary,
      items: mergedItems,
      extraBoqItems: mergedExtraBoq,
      cameraBookmarks: mergedBookmarks.length > 0 ? mergedBookmarks : primary.cameraBookmarks,
    });
  }
  return Array.from(map.values());
}

function mergeHandoverChecklist(
  existing: HandoverChecklistItem[],
  incoming: HandoverChecklistItem[]
): HandoverChecklistItem[] {
  const map = new Map<string, HandoverChecklistItem>();
  for (const item of existing) {
    map.set(item.id, item);
  }
  for (const inc of incoming) {
    const prev = map.get(inc.id);
    if (!prev) {
      map.set(inc.id, inc);
      continue;
    }
    const incTs = inc.updatedAt || "";
    const prevTs = prev.updatedAt || "";
    if (incTs && prevTs) {
      const winner = incTs.localeCompare(prevTs) > 0 ? inc : prev;
      const loser = winner === inc ? prev : inc;
      map.set(inc.id, {
        ...winner,
        localPhotoKey: winner.localPhotoKey || loser.localPhotoKey,
        note: winner.note?.trim() ? winner.note : loser.note,
      });
    } else {
      const preferInc =
        (inc.checked && !prev.checked) ||
        Boolean(inc.status && inc.status !== "PENDING" && (!prev.status || prev.status === "PENDING")) ||
        Boolean(inc.note?.trim() && !prev.note?.trim());
      map.set(inc.id, {
        ...(preferInc ? inc : prev),
        checked: prev.checked || inc.checked,
        note: (preferInc ? inc.note : prev.note) || (preferInc ? prev.note : inc.note),
        localPhotoKey: prev.localPhotoKey || inc.localPhotoKey,
      });
    }
  }
  return Array.from(map.values());
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
  const newSavingsChallenges = countNewById(
    current.savingsChallenges || [],
    incoming.savingsChallenges || []
  );

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

  const newGoldLots = countNewById(
    current.goldPortfolio?.lots || [],
    incoming.goldPortfolio?.lots || []
  );
  const newGoldSales = countNewById(
    current.goldPortfolio?.sales || [],
    incoming.goldPortfolio?.sales || []
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
    newSavingsChallenges +
    newMortgagePaidRecords +
    newMortgagePrepayments +
    newMortgageRateAdjustments +
    newGoldLots +
    newGoldSales;

  return {
    newTransactions,
    newAccounts,
    newGoals,
    newDebts,
    newInvestments,
    newBudgets,
    newCategories,
    newRecurringRules,
    newSavingsChallenges,
    newMortgagePaidRecords,
    newMortgagePrepayments,
    newMortgageRateAdjustments,
    newGoldLots,
    newGoldSales,
    totalNewItems,
    totalIncomingTransactions: incoming.transactions.length,
  };
}

export function mergeSkyOneContracts(
  current: MortgageContract,
  incoming: MortgageContract
): MortgageContract {
  const incomingIsNewer = incoming.updatedAt.localeCompare(current.updatedAt) > 0;
  const baseContract = incomingIsNewer ? incoming : current;

  const paidPeriodSet = new Set(current.paidRecords.map((r) => r.period));
  const mergedPaidRecords = [
    ...current.paidRecords,
    ...incoming.paidRecords.filter((r) => !paidPeriodSet.has(r.period)),
  ].sort((a, b) => a.period - b.period);

  const mergedPrepayments = mergeById(current.prepayments, incoming.prepayments).sort(
    (a, b) => a.afterPeriod - b.afterPeriod || a.date.localeCompare(b.date)
  );

  const mergedRateAdjustments = mergeById(
    current.rateAdjustments,
    incoming.rateAdjustments
  ).sort((a, b) => a.effectiveFromPeriod - b.effectiveFromPeriod);

  return {
    ...baseContract,
    paidRecords: mergedPaidRecords,
    prepayments: mergedPrepayments,
    rateAdjustments: mergedRateAdjustments,
    updatedAt: new Date().toISOString(),
  };
}

export function mergeGoldPortfolios(
  current: GoldPortfolioState,
  incoming: GoldPortfolioState
): GoldPortfolioState {
  const incomingGoldNewer = incoming.updatedAt.localeCompare(current.updatedAt) > 0;
  return {
    ...(incomingGoldNewer ? incoming : current),
    lots: mergeByIdPreferNewer(current.lots, incoming.lots),
    sales: mergeById(current.sales, incoming.sales),
    priceHistory: mergeGoldPriceHistory(current.priceHistory, incoming.priceHistory),
    alerts: mergeById(current.alerts || [], incoming.alerts || []),
    updatedAt: new Date().toISOString(),
  };
}

export function mergeInteriorStudios(
  current: InteriorStudioState,
  incoming: InteriorStudioState
): InteriorStudioState {
  const incomingInteriorNewer = incoming.updatedAt.localeCompare(current.updatedAt) > 0;
  const mergedScenarios = mergeInteriorScenarios(current.scenarios, incoming.scenarios);
  const preferredActiveId = incomingInteriorNewer
    ? incoming.activeScenarioId
    : current.activeScenarioId;
  const resolvedActiveId = mergedScenarios.some((s) => s.id === preferredActiveId)
    ? preferredActiveId
    : mergedScenarios[0]?.id || current.activeScenarioId;

  return {
    ...(incomingInteriorNewer ? incoming : current),
    targetHandoverDate:
      (incomingInteriorNewer ? incoming.targetHandoverDate : current.targetHandoverDate) ||
      current.targetHandoverDate ||
      incoming.targetHandoverDate ||
      "2027-08-31",
    activeScenarioId: resolvedActiveId,
    scenarios: mergedScenarios,
    handoverChecklist: mergeHandoverChecklist(
      current.handoverChecklist,
      incoming.handoverChecklist
    ),
    updatedAt: new Date().toISOString(),
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
        quickAuth: current.settings.quickAuth,
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
  const mergedChallenges = mergeById(
    current.savingsChallenges || [],
    incoming.savingsChallenges || []
  );

  const mergedSkyOneLoan = mergeSkyOneContracts(current.skyoneLoan, incoming.skyoneLoan);
  const mergedGoldPortfolio = mergeGoldPortfolios(
    current.goldPortfolio || createDefaultGoldPortfolio(),
    incoming.goldPortfolio || createDefaultGoldPortfolio()
  );
  const mergedInteriorStudio = mergeInteriorStudios(
    current.interiorStudio || createDefaultInteriorStudio(),
    incoming.interiorStudio || createDefaultInteriorStudio()
  );

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
    savingsChallenges: mergedChallenges,
    settings: {
      ...DEFAULT_SETTINGS,
      ...current.settings,
      ...securitySlice,
    },
    skyoneLoan: mergedSkyOneLoan,
    goldPortfolio: mergedGoldPortfolio,
    interiorStudio: mergedInteriorStudio,
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
