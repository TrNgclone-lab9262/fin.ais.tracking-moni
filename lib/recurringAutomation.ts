import {
  ExpenseScope,
  FamilyMember,
  RecurringRule,
  Transaction,
  TransactionType,
} from "@/types/finance";

export interface AutoPostRuleCandidate {
  rule: RecurringRule;
  monthKey: string;
  dueDay: number;
  txDate: string;
}

export interface AutoPostSkippedDuplicate {
  rule: RecurringRule;
  monthKey: string;
  matchedTransaction: Transaction;
}

export interface AutoPostEvaluationResult {
  monthKey: string;
  toPost: AutoPostRuleCandidate[];
  skippedDuplicates: AutoPostSkippedDuplicate[];
}

export interface RecurringHistorySuggestion {
  signature: string;
  suggestedName: string;
  type: TransactionType;
  categoryId: string;
  accountId: string;
  memberId: FamilyMember;
  scope: ExpenseScope;
  amount: number;
  dayOfMonth: number;
  occurrenceMonths: string[];
  confidenceLabel: string;
  alreadyLoggedCurrentMonth: boolean;
}

function getDaysInMonth(monthKey: string): number {
  const [yStr, mStr] = monthKey.split("-");
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10);
  if (Number.isNaN(y) || Number.isNaN(m) || m < 1 || m > 12) return 30;
  return new Date(y, m, 0).getDate();
}

export function formatMonthKeyFromDate(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function normalizeTextForMatch(text?: string): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(thang|ky|t)\s*\d{1,2}(\/\d{2,4})?\b/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractMeaningfulTokens(text?: string): string[] {
  const stopwords = new Set([
    "tien",
    "chi",
    "thu",
    "phi",
    "hoa",
    "don",
    "hang",
    "thang",
    "gia",
    "dinh",
    "thanh",
    "toan",
    "tu",
    "dong",
    "ghi",
    "so",
    "cua",
    "va",
    "cho",
  ]);
  return normalizeTextForMatch(text)
    .split(" ")
    .filter((token) => token.length >= 2 && !stopwords.has(token));
}

function shareKeywordOverlap(a?: string, b?: string): boolean {
  const normA = normalizeTextForMatch(a);
  const normB = normalizeTextForMatch(b);
  if (!normA || !normB) return false;
  if (normA.includes(normB) || normB.includes(normA)) return true;

  const tokensA = extractMeaningfulTokens(a);
  const tokensB = new Set(extractMeaningfulTokens(b));
  if (tokensA.length === 0 || tokensB.size === 0) return false;

  let hits = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) hits += 1;
  }
  return hits >= Math.min(2, tokensA.length, tokensB.size);
}

/**
 * Checks whether `transactions` in `monthKey` already contains a transaction matching `rule`
 * (either explicitly tagged/noted for this rule or entered manually with matching type/category/amount/keyword).
 */
export function hasMatchingManualTransactionForRule(
  rule: RecurringRule,
  monthKey: string,
  transactions: Transaction[]
): Transaction | null {
  const monthTxs = transactions.filter(
    (tx) => tx.date.startsWith(monthKey) && tx.type === rule.type
  );

  for (const tx of monthTxs) {
    const amountDiff = Math.abs(tx.amount - rule.amount);
    const amountCloseStrict = amountDiff <= Math.max(15_000, rule.amount * 0.1);
    const amountCloseLoose = amountDiff <= Math.max(30_000, rule.amount * 0.2);

    const sameCategory = tx.categoryId === rule.categoryId;
    const textMatches = shareKeywordOverlap(tx.note, rule.name);

    if (textMatches && amountCloseLoose) {
      return tx;
    }

    if (
      sameCategory &&
      amountCloseStrict &&
      (tx.tag === "RECURRING" ||
        tx.accountId === rule.accountId ||
        tx.memberId === rule.memberId)
    ) {
      return tx;
    }
  }

  return null;
}

/**
 * Evaluates active autoPost rules whose fixed day in the current calendar month has arrived.
 * Skips creating duplicates if a matching manual transaction already exists in that month.
 */
export function evaluateAutoPostCandidates(params: {
  rules: RecurringRule[];
  transactions: Transaction[];
  now?: Date;
}): AutoPostEvaluationResult {
  const now = params.now ?? new Date();
  const monthKey = formatMonthKeyFromDate(now);
  const todayDay = now.getDate();
  const daysInMonth = getDaysInMonth(monthKey);

  const toPost: AutoPostRuleCandidate[] = [];
  const skippedDuplicates: AutoPostSkippedDuplicate[] = [];

  for (const rule of params.rules) {
    if (!rule.isActive || !rule.autoPost) continue;
    if (rule.lastAppliedMonth === monthKey) continue;

    const dueDay = Math.min(daysInMonth, Math.max(1, rule.dayOfMonth));
    if (todayDay < dueDay) continue;

    const existingMatch = hasMatchingManualTransactionForRule(
      rule,
      monthKey,
      params.transactions
    );

    if (existingMatch) {
      skippedDuplicates.push({
        rule,
        monthKey,
        matchedTransaction: existingMatch,
      });
      continue;
    }

    const txDate = `${monthKey}-${String(dueDay).padStart(2, "0")}`;
    toPost.push({
      rule,
      monthKey,
      dueDay,
      txDate,
    });
  }

  return {
    monthKey,
    toPost,
    skippedDuplicates,
  };
}

function cleanDisplayLabel(note?: string, fallbackName = "Khoản cố định"): string {
  if (!note) return fallbackName;
  const cleaned = note
    .replace(/\([^)]*\)/g, "")
    .replace(/\b(tháng|t)\s*\d{1,2}(\/\d{2,4})?\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length >= 2 ? cleaned : fallbackName;
}

function computeMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function hasExistingRuleForPattern(
  pattern: {
    type: TransactionType;
    categoryId: string;
    amount: number;
    suggestedName: string;
  },
  rules: RecurringRule[]
): boolean {
  return rules.some((rule) => {
    if (rule.type !== pattern.type) return false;
    const amountClose =
      Math.abs(rule.amount - pattern.amount) <= Math.max(30_000, pattern.amount * 0.2);
    if (rule.categoryId === pattern.categoryId && amountClose) return true;
    if (shareKeywordOverlap(rule.name, pattern.suggestedName) && amountClose) return true;
    return false;
  });
}

/**
 * Analyzes transaction history across >= 2 distinct months to detect recurring fixed payments
 * (such as rent, Netflix, internet, subscriptions) that don't yet have a RecurringRule.
 */
export function detectRecurringSuggestionsFromHistory(params: {
  transactions: Transaction[];
  existingRules: RecurringRule[];
  dismissedSignatures?: string[];
  categoryNameMap?: Map<string, string>;
  now?: Date;
}): RecurringHistorySuggestion[] {
  const {
    transactions,
    existingRules,
    dismissedSignatures = [],
    categoryNameMap,
    now = new Date(),
  } = params;

  const dismissedSet = new Set(dismissedSignatures);
  const currentMonthKey = formatMonthKeyFromDate(now);

  interface Bucket {
    type: TransactionType;
    categoryId: string;
    normKey: string;
    txs: Transaction[];
  }

  const buckets = new Map<string, Bucket>();

  for (const tx of transactions) {
    if (tx.type === "TRANSFER") continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tx.date)) continue;

    const tokens = extractMeaningfulTokens(tx.note);
    const normKey =
      tokens.length > 0 ? tokens.slice(0, 3).join("_") : `cat_${tx.categoryId}`;
    const bucketId = `${tx.type}|${tx.categoryId}|${normKey}`;

    const existing = buckets.get(bucketId);
    if (existing) {
      existing.txs.push(tx);
    } else {
      buckets.set(bucketId, {
        type: tx.type,
        categoryId: tx.categoryId,
        normKey,
        txs: [tx],
      });
    }
  }

  const suggestions: RecurringHistorySuggestion[] = [];

  for (const [, bucket] of buckets) {
    // Keep at most one representative tx per month (the latest in that month)
    const byMonth = new Map<string, Transaction>();
    for (const tx of bucket.txs) {
      const mKey = tx.date.slice(0, 7);
      const prev = byMonth.get(mKey);
      if (!prev || tx.date > prev.date) {
        byMonth.set(mKey, tx);
      }
    }

    const distinctMonths = Array.from(byMonth.keys()).sort();
    if (distinctMonths.length < 2) continue;

    const monthlyTxs = distinctMonths.map((m) => byMonth.get(m)!);
    const amounts = monthlyTxs.map((t) => t.amount);
    const days = monthlyTxs.map((t) => parseInt(t.date.slice(8, 10), 10) || 1);

    const medianAmount = computeMedian(amounts);
    const medianDay = Math.min(28, Math.max(1, computeMedian(days)));

    // Validate amount stability: at least 2 months within ±20% of median amount
    const stableAmountTxs = monthlyTxs.filter(
      (t) => Math.abs(t.amount - medianAmount) <= Math.max(25_000, medianAmount * 0.2)
    );
    if (stableAmountTxs.length < 2) continue;

    // Validate fixed-day consistency: at least 2 months within ±4 days of medianDay
    const stableDayTxs = stableAmountTxs.filter((t) => {
      const d = Math.min(28, Math.max(1, parseInt(t.date.slice(8, 10), 10) || 1));
      return Math.abs(d - medianDay) <= 4;
    });
    if (stableDayTxs.length < 2) continue;

    const latestTx = stableDayTxs[stableDayTxs.length - 1];
    const fallbackCatName = categoryNameMap?.get(bucket.categoryId) || "Khoản cố định";
    const suggestedName = cleanDisplayLabel(latestTx.note, fallbackCatName);
    const signature = `${bucket.type}_${bucket.categoryId}_${bucket.normKey}`;

    if (dismissedSet.has(signature)) continue;
    if (
      hasExistingRuleForPattern(
        {
          type: bucket.type,
          categoryId: bucket.categoryId,
          amount: medianAmount,
          suggestedName,
        },
        existingRules
      )
    ) {
      continue;
    }

    const monthsList = stableDayTxs.map((t) => t.date.slice(0, 7));

    suggestions.push({
      signature,
      suggestedName,
      type: bucket.type,
      categoryId: bucket.categoryId,
      accountId: latestTx.accountId,
      memberId: latestTx.memberId,
      scope: latestTx.scope,
      amount: medianAmount,
      dayOfMonth: medianDay,
      occurrenceMonths: monthsList,
      confidenceLabel: `Lặp lại ${monthsList.length} tháng · quanh ngày ${medianDay}`,
      alreadyLoggedCurrentMonth: monthsList.includes(currentMonthKey),
    });
  }

  return suggestions.sort(
    (a, b) =>
      b.occurrenceMonths.length - a.occurrenceMonths.length ||
      b.amount - a.amount
  );
}
