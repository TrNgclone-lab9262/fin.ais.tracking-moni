import {
  Account,
  AppSettings,
  Category,
  CategoryBudget,
  DebtItem,
  GoldPortfolioState,
  InteriorStudioState,
  InvestmentItem,
  MortgageContract,
  RecurringRule,
  SavingsGoal,
  Transaction,
} from "@/types/finance";

export const OUTBOX_STORAGE_KEY = "HOME_MONI_OUTBOX_V1";
export const MAX_OUTBOX_RETRIES = 3;

export type OutboxEntryStatus = "PENDING" | "FAILED";

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
  | { type: "UPSERT_GOLD_PORTFOLIO"; payload: GoldPortfolioState }
  | { type: "UPSERT_INTERIOR_STUDIO"; payload: InteriorStudioState }
  | { type: "UPSERT_SETTINGS"; payload: AppSettings };

export interface OutboxEntry {
  key: string;
  queuedAt: string;
  mutation: CloudMutation;
  status: OutboxEntryStatus;
  retryCount: number;
  lastError?: string;
  lastAttemptAt?: string;
}

export interface OutboxFlushReport {
  succeeded: number;
  retried: number;
  deadLettered: number;
  remainingEntries: OutboxEntry[];
  lastError: string | null;
}

function isStorageAvailable(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function normalizeOutboxEntry(raw: unknown): OutboxEntry | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.key !== "string" || !obj.key || !obj.mutation || typeof obj.mutation !== "object") {
    return null;
  }
  const status: OutboxEntryStatus = obj.status === "FAILED" ? "FAILED" : "PENDING";
  const retryCount =
    typeof obj.retryCount === "number" && Number.isFinite(obj.retryCount) && obj.retryCount >= 0
      ? Math.floor(obj.retryCount)
      : 0;
  return {
    key: obj.key,
    queuedAt: typeof obj.queuedAt === "string" ? obj.queuedAt : new Date().toISOString(),
    mutation: obj.mutation as CloudMutation,
    status,
    retryCount,
    lastError: typeof obj.lastError === "string" ? obj.lastError : undefined,
    lastAttemptAt: typeof obj.lastAttemptAt === "string" ? obj.lastAttemptAt : undefined,
  };
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
    case "UPSERT_GOLD_PORTFOLIO":
      return "gold:default";
    case "UPSERT_INTERIOR_STUDIO":
      return "interior:a12a07";
    case "UPSERT_SETTINGS":
      return "settings:household";
  }
}

export function describeOutboxMutation(mutation: CloudMutation): string {
  switch (mutation.type) {
    case "UPSERT_CATEGORY":
      return `Cập nhật danh mục "${mutation.payload.name}"`;
    case "DELETE_CATEGORY":
      return `Xóa danh mục (${mutation.id})`;
    case "UPSERT_ACCOUNT":
      return `Cập nhật ví/thẻ "${mutation.payload.name}"`;
    case "UPSERT_ACCOUNTS_BATCH":
      return `Đồng bộ ${mutation.payload.length} ví/thẻ`;
    case "DELETE_ACCOUNT":
      return `Xóa ví/thẻ (${mutation.id})`;
    case "UPSERT_TRANSACTION":
      return `Ghi giao dịch ${mutation.payload.amount.toLocaleString("vi-VN")} đ`;
    case "UPSERT_TRANSACTIONS_BATCH":
      return `Ghi hàng loạt ${mutation.payload.length} giao dịch`;
    case "DELETE_TRANSACTION":
      return `Xóa giao dịch (${mutation.id})`;
    case "DELETE_TRANSACTIONS_BATCH":
      return `Xóa ${mutation.ids.length} giao dịch`;
    case "UPSERT_BUDGET":
      return `Cập nhật ngân sách ${mutation.payload.month}`;
    case "UPSERT_BUDGETS_BATCH":
      return `Cập nhật ${mutation.payload.length} ngân sách`;
    case "DELETE_BUDGET":
      return `Xóa ngân sách ${mutation.month}`;
    case "UPSERT_GOAL":
      return `Cập nhật mục tiêu "${mutation.payload.name}"`;
    case "DELETE_GOAL":
      return `Xóa mục tiêu (${mutation.id})`;
    case "UPSERT_DEBT":
      return `Cập nhật sổ nợ "${mutation.payload.name}"`;
    case "DELETE_DEBT":
      return `Xóa sổ nợ (${mutation.id})`;
    case "UPSERT_INVESTMENT":
      return `Cập nhật đầu tư "${mutation.payload.name}"`;
    case "DELETE_INVESTMENT":
      return `Xóa đầu tư (${mutation.id})`;
    case "UPSERT_RECURRING_RULE":
      return `Cập nhật định kỳ "${mutation.payload.name}"`;
    case "UPSERT_RECURRING_RULES_BATCH":
      return `Đồng bộ ${mutation.payload.length} lịch định kỳ`;
    case "DELETE_RECURRING_RULE":
      return `Xóa lịch định kỳ (${mutation.id})`;
    case "UPSERT_SKYONE_LOAN":
      return `Đồng bộ hợp đồng vay SKYONE (${mutation.payload.projectName})`;
    case "UPSERT_GOLD_PORTFOLIO":
      return `Đồng bộ Kho Vàng (${mutation.payload.lots.length} lô)`;
    case "UPSERT_INTERIOR_STUDIO":
      return `Đồng bộ Studio Nội thất 3D (${mutation.payload.scenarios.length} PA)`;
    case "UPSERT_SETTINGS":
      return "Đồng bộ cài đặt Tổ ấm";
  }
}

/**
 * Thêm một mutation vào hàng đợi ngoại tuyến với cơ chế gộp (coalesce):
 * nếu cùng một thực thể bị sửa nhiều lần khi mất mạng, chỉ giữ bản cập nhật cuối cùng
 * và đưa trạng thái về PENDING với retryCount = 0.
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
      status: "PENDING",
      retryCount: 0,
    },
  ];
}

/**
 * Ghi nhận một mục trong hàng đợi gặp lỗi khi xả lên Cloud.
 * Nếu vượt ngưỡng MAX_OUTBOX_RETRIES thì chuyển sang FAILED (Dead-Letter) để không chặn các mục hợp lệ phía sau.
 */
export function recordOutboxFailure(
  entry: OutboxEntry,
  errorMessage: string,
  maxRetries: number = MAX_OUTBOX_RETRIES,
  nowIso: string = new Date().toISOString()
): OutboxEntry {
  const nextRetryCount = entry.retryCount + 1;
  const status: OutboxEntryStatus = nextRetryCount >= maxRetries ? "FAILED" : "PENDING";
  return {
    ...entry,
    retryCount: nextRetryCount,
    status,
    lastError: errorMessage,
    lastAttemptAt: nowIso,
  };
}

/**
 * Xả hàng đợi không chặn đầu hàng (Non-blocking Dead-Letter Flush):
 * - Chỉ thử chạy các mục PENDING.
 * - Mục nào thành công sẽ bị gỡ khỏi hàng đợi.
 * - Mục nào lỗi sẽ tăng retryCount (chuyển FAILED khi >= maxRetries) nhưng KHÔNG chặn các mục hợp lệ phía sau!
 */
export async function flushOutboxEntriesPure(
  entries: OutboxEntry[],
  executor: (mutation: CloudMutation) => Promise<void>,
  options?: { maxRetries?: number; nowIso?: string }
): Promise<OutboxFlushReport> {
  const maxRetries = options?.maxRetries ?? MAX_OUTBOX_RETRIES;
  const nowIso = options?.nowIso ?? new Date().toISOString();

  let succeeded = 0;
  let retried = 0;
  let deadLettered = 0;
  let lastError: string | null = null;
  const remainingEntries: OutboxEntry[] = [];

  for (const entry of entries) {
    if (entry.status === "FAILED") {
      remainingEntries.push(entry);
      continue;
    }

    try {
      await executor(entry.mutation);
      succeeded += 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Lỗi đồng bộ không xác định";
      lastError = msg;
      const updated = recordOutboxFailure(entry, msg, maxRetries, nowIso);
      if (updated.status === "FAILED") {
        deadLettered += 1;
      } else {
        retried += 1;
      }
      remainingEntries.push(updated);
    }
  }

  return {
    succeeded,
    retried,
    deadLettered,
    remainingEntries,
    lastError,
  };
}

export function resetOutboxEntryForRetry(entries: OutboxEntry[], key: string): OutboxEntry[] {
  return entries.map((item) =>
    item.key === key
      ? { ...item, status: "PENDING", retryCount: 0, lastError: undefined }
      : item
  );
}

export function resetAllFailedOutboxEntries(entries: OutboxEntry[]): OutboxEntry[] {
  return entries.map((item) =>
    item.status === "FAILED"
      ? { ...item, status: "PENDING", retryCount: 0, lastError: undefined }
      : item
  );
}

export function removeOutboxEntryByKey(entries: OutboxEntry[], key: string): OutboxEntry[] {
  return entries.filter((item) => item.key !== key);
}

export function loadOutboxQueue(): OutboxEntry[] {
  if (!isStorageAvailable()) return [];
  try {
    const raw = window.localStorage.getItem(OUTBOX_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const normalized: OutboxEntry[] = [];
    for (const item of parsed) {
      const valid = normalizeOutboxEntry(item);
      if (valid) normalized.push(valid);
    }
    return normalized;
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
