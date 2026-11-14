import {
  Account,
  AppSettings,
  Category,
  CategoryBudget,
  DebtItem,
  InvestmentItem,
  MortgageContract,
  RecurringRule,
  SavingsGoal,
  Transaction,
} from "@/types/finance";

export const OUTBOX_STORAGE_KEY = "HOME_MONI_OUTBOX_V1";

export type CloudMutation =
  | { type: "UPSERT_CATEGORY"; payload: Category }
  | { type: "DELETE_CATEGORY"; id: string }
  | { type: "UPSERT_ACCOUNT"; payload: Account }
  | { type: "UPSERT_ACCOUNTS_BATCH"; payload: Account[] }
  | { type: "DELETE_ACCOUNT"; id: string }
  | { type: "UPSERT_TRANSACTION"; payload: Transaction }
  | { type: "UPSERT_TRANSACTIONS_BATCH"; payload: Transaction[] }
  | { type: "DELETE_TRANSACTION"; id: string }
  | { type: "DELETE_TRANSACTIONS_BATCH"; ids: string[] }
  | { type: "UPSERT_BUDGET"; payload: CategoryBudget }
  | { type: "UPSERT_BUDGETS_BATCH"; payload: CategoryBudget[] }
  | { type: "DELETE_BUDGET"; categoryId: string; month: string }
  | { type: "UPSERT_GOAL"; payload: SavingsGoal }
  | { type: "DELETE_GOAL"; id: string }
  | { type: "UPSERT_DEBT"; payload: DebtItem }
  | { type: "DELETE_DEBT"; id: string }
  | { type: "UPSERT_INVESTMENT"; payload: InvestmentItem }
  | { type: "DELETE_INVESTMENT"; id: string }
  | { type: "UPSERT_RECURRING_RULE"; payload: RecurringRule }
  | { type: "UPSERT_RECURRING_RULES_BATCH"; payload: RecurringRule[] }
  | { type: "DELETE_RECURRING_RULE"; id: string }
  | { type: "UPSERT_SKYONE_LOAN"; payload: MortgageContract }
  | { type: "UPSERT_SETTINGS"; payload: AppSettings };

export interface OutboxEntry {
  key: string;
  queuedAt: string;
  mutation: CloudMutation;
}

function isStorageAvailable(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function getOutboxMutationKey(mutation: CloudMutation): string {
  switch (mutation.type) {
    case "UPSERT_CATEGORY":
      return `category:${mutation.payload.id}`;
    case "DELETE_CATEGORY":
      return `category:${mutation.id}`;
    case "UPSERT_ACCOUNT":
      return `account:${mutation.payload.id}`;
    case "DELETE_ACCOUNT":
      return `account:${mutation.id}`;
    case "UPSERT_ACCOUNTS_BATCH":
      return `accounts_batch:${mutation.payload.map((a) => a.id).sort().join(",")}`;
    case "UPSERT_TRANSACTION":
      return `tx:${mutation.payload.id}`;
    case "DELETE_TRANSACTION":
      return `tx:${mutation.id}`;
    case "UPSERT_TRANSACTIONS_BATCH":
      return `tx_batch:${mutation.payload.map((t) => t.id).sort().join(",")}`;
    case "DELETE_TRANSACTIONS_BATCH":
      return `tx_del_batch:${mutation.ids.slice().sort().join(",")}`;
    case "UPSERT_BUDGET":
      return `budget:${mutation.payload.categoryId}:${mutation.payload.month}`;
    case "DELETE_BUDGET":
      return `budget:${mutation.categoryId}:${mutation.month}`;
    case "UPSERT_BUDGETS_BATCH":
      return `budgets_batch:${mutation.payload
        .map((b) => `${b.categoryId}_${b.month}`)
        .sort()
        .join(",")}`;
    case "UPSERT_GOAL":
      return `goal:${mutation.payload.id}`;
    case "DELETE_GOAL":
      return `goal:${mutation.id}`;
    case "UPSERT_DEBT":
      return `debt:${mutation.payload.id}`;
    case "DELETE_DEBT":
      return `debt:${mutation.id}`;
    case "UPSERT_INVESTMENT":
      return `inv:${mutation.payload.id}`;
    case "DELETE_INVESTMENT":
      return `inv:${mutation.id}`;
    case "UPSERT_RECURRING_RULE":
      return `rec:${mutation.payload.id}`;
    case "DELETE_RECURRING_RULE":
      return `rec:${mutation.id}`;
    case "UPSERT_RECURRING_RULES_BATCH":
      return `rec_batch:${mutation.payload.map((r) => r.id).sort().join(",")}`;
    case "UPSERT_SKYONE_LOAN":
      return `skyone:${mutation.payload.id || "skyone_default"}`;
    case "UPSERT_SETTINGS":
      return "settings:household";
  }
}

/**
 * Thêm một mutation vào hàng đợi ngoại tuyến với cơ chế gộp (coalesce):
 * nếu cùng một thực thể bị sửa nhiều lần khi mất mạng, chỉ giữ bản cập nhật cuối cùng.
 */
export function coalesceOutboxEntries(
  current: OutboxEntry[],
  mutation: CloudMutation,
  nowIso: string = new Date().toISOString()
): OutboxEntry[] {
  const key = getOutboxMutationKey(mutation);
  const filtered = current.filter((item) => item.key !== key);
  return [
    ...filtered,
    {
      key,
      queuedAt: nowIso,
      mutation,
    },
  ];
}

export function loadOutboxQueue(): OutboxEntry[] {
  if (!isStorageAvailable()) return [];
  try {
    const raw = window.localStorage.getItem(OUTBOX_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as OutboxEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveOutboxQueue(entries: OutboxEntry[]): void {
  if (!isStorageAvailable()) return;
  try {
    if (entries.length === 0) {
      window.localStorage.removeItem(OUTBOX_STORAGE_KEY);
    } else {
      window.localStorage.setItem(OUTBOX_STORAGE_KEY, JSON.stringify(entries));
    }
  } catch (err) {
    console.warn("Không thể lưu hàng đợi đồng bộ ngoại tuyến:", err);
  }
}

export function enqueueOutboxMutation(mutation: CloudMutation): OutboxEntry[] {
  const current = loadOutboxQueue();
  const next = coalesceOutboxEntries(current, mutation);
  saveOutboxQueue(next);
  return next;
}

export function clearOutboxQueue(): void {
  saveOutboxQueue([]);
}
