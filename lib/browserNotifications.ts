import { BudgetProgressItem, RecurringRule } from "@/types/finance";
import { formatVNDMasked } from "./formatters";
import { formatMonthKeyFromDate, getDaysInMonth } from "./financeEngine";

export type BrowserNotificationStatus = "unsupported" | "denied" | "default" | "granted";
export type BudgetAlertLevel = "SAFE" | "WARNING" | "DANGER";
export type RecurringDueStatus = "APPLIED" | "OVERDUE" | "DUE_TODAY" | "DUE_SOON" | "UPCOMING";

export interface BudgetWarningStatus {
  level: BudgetAlertLevel;
  exactRatio: number;
  percentage: number;
  label: string;
}

export interface RecurringDueEvaluation {
  status: RecurringDueStatus;
  dueDay: number;
  daysUntilDue: number;
}

export interface RecurringReminderCandidate {
  rule: RecurringRule;
  monthKey: string;
  dueDay: number;
  daysUntilDue: number;
  status: "OVERDUE" | "DUE_TODAY" | "DUE_SOON";
}

const OPT_IN_STORAGE_KEY = "HOME_MONI_BROWSER_NOTIF_ENABLED_V1";
const SENT_LEDGER_STORAGE_KEY = "HOME_MONI_BUDGET_NOTIF_SENT_V1";
const SENT_RECURRING_LEDGER_STORAGE_KEY = "HOME_MONI_RECURRING_NOTIF_SENT_V1";
const NOTIFICATION_ICON_PATH = "/icons/icon-192.png";

export const BUDGET_WARNING_THRESHOLD_RATIO = 0.8;
export const BUDGET_DANGER_THRESHOLD_RATIO = 1.0;
export const RECURRING_REMINDER_LEAD_DAYS = 3;

export function isBrowserNotificationSupported(): boolean {
  return typeof window !== "undefined" && typeof window.Notification !== "undefined";
}

export function getBrowserNotificationPermission(): BrowserNotificationStatus {
  if (!isBrowserNotificationSupported()) return "unsupported";
  return window.Notification.permission;
}

export function isBrowserNotificationOptedIn(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(OPT_IN_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function setBrowserNotificationOptIn(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(OPT_IN_STORAGE_KEY, enabled ? "true" : "false");
  } catch {
    // Ignore storage quota / restricted iframe errors
  }
}

export async function requestBrowserNotificationAccess(): Promise<{
  granted: boolean;
  status: BrowserNotificationStatus;
}> {
  if (!isBrowserNotificationSupported()) {
    return { granted: false, status: "unsupported" };
  }

  const current = window.Notification.permission;
  if (current === "granted") {
    setBrowserNotificationOptIn(true);
    return { granted: true, status: "granted" };
  }

  if (current === "denied") {
    setBrowserNotificationOptIn(false);
    return { granted: false, status: "denied" };
  }

  try {
    const result = await window.Notification.requestPermission();
    const granted = result === "granted";
    setBrowserNotificationOptIn(granted);
    return { granted, status: result };
  } catch {
    return { granted: false, status: getBrowserNotificationPermission() };
  }
}

/**
 * 3-tier budget warning classifier for UI status bars:
 * - SAFE: < 80%
 * - WARNING: 80% - 99.9%
 * - DANGER: >= 100%
 */
export function getBudgetWarningStatus(item: BudgetProgressItem): BudgetWarningStatus {
  const exactRatio = item.limitAmount > 0 ? item.spentAmount / item.limitAmount : 0;
  const percentage = item.limitAmount > 0 ? Math.round(exactRatio * 100) : 0;

  if (item.limitAmount > 0 && exactRatio >= BUDGET_DANGER_THRESHOLD_RATIO) {
    return {
      level: "DANGER",
      exactRatio,
      percentage,
      label: item.spentAmount > item.limitAmount ? "Vượt hạn mức" : "Chạm trần 100%",
    };
  }

  if (item.limitAmount > 0 && exactRatio >= BUDGET_WARNING_THRESHOLD_RATIO) {
    return {
      level: "WARNING",
      exactRatio,
      percentage,
      label: "Gần chạm ngưỡng",
    };
  }

  return {
    level: "SAFE",
    exactRatio,
    percentage,
    label: "Trong hạn mức",
  };
}

/**
 * Pure predicate returning categories strictly exceeding thresholdRatio (default > 80%).
 */
export function findBudgetExceedingThreshold(
  items: BudgetProgressItem[],
  thresholdRatio: number = BUDGET_WARNING_THRESHOLD_RATIO
): BudgetProgressItem[] {
  return items.filter(
    (item) => item.limitAmount > 0 && item.spentAmount / item.limitAmount > thresholdRatio
  );
}

type SentLedger = Record<string, string[]>;

function readLedger(storageKey: string): SentLedger {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as SentLedger) : {};
  } catch {
    return {};
  }
}

function writeLedger(storageKey: string, ledger: SentLedger): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(ledger));
  } catch {
    // Ignore localStorage restrictions
  }
}

export function getSentBudgetAlertsForMonth(monthKey: string): string[] {
  const ledger = readLedger(SENT_LEDGER_STORAGE_KEY);
  return Array.isArray(ledger[monthKey]) ? ledger[monthKey] : [];
}

export function markBudgetAlertSent(monthKey: string, categoryId: string): void {
  const ledger = readLedger(SENT_LEDGER_STORAGE_KEY);
  const current = new Set(Array.isArray(ledger[monthKey]) ? ledger[monthKey] : []);
  current.add(categoryId);
  ledger[monthKey] = Array.from(current);
  writeLedger(SENT_LEDGER_STORAGE_KEY, ledger);
}

export function getSentRecurringAlertsForMonth(monthKey: string): string[] {
  const ledger = readLedger(SENT_RECURRING_LEDGER_STORAGE_KEY);
  return Array.isArray(ledger[monthKey]) ? ledger[monthKey] : [];
}

export function markRecurringAlertSent(monthKey: string, ruleId: string): void {
  const ledger = readLedger(SENT_RECURRING_LEDGER_STORAGE_KEY);
  const current = new Set(Array.isArray(ledger[monthKey]) ? ledger[monthKey] : []);
  current.add(ruleId);
  ledger[monthKey] = Array.from(current);
  writeLedger(SENT_RECURRING_LEDGER_STORAGE_KEY, ledger);
}

/**
 * Evaluates whether a recurring rule is applied, overdue, due today, due within leadDays (default 3), or upcoming.
 */
export function evaluateRecurringRuleDueStatus(
  rule: RecurringRule,
  targetMonthKey: string,
  now: Date = new Date(),
  leadDays: number = RECURRING_REMINDER_LEAD_DAYS
): RecurringDueEvaluation {
  const daysInTargetMonth = getDaysInMonth(targetMonthKey);
  const dueDay = Math.min(daysInTargetMonth, Math.max(1, rule.dayOfMonth));

  if (rule.lastAppliedMonth === targetMonthKey) {
    return { status: "APPLIED", dueDay, daysUntilDue: 0 };
  }

  const [yStr, mStr] = targetMonthKey.split("-");
  const targetYear = parseInt(yStr, 10);
  const targetMonthIndex = parseInt(mStr, 10) - 1;

  if (Number.isNaN(targetYear) || Number.isNaN(targetMonthIndex)) {
    return { status: "UPCOMING", dueDay, daysUntilDue: 30 };
  }

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDate = new Date(targetYear, targetMonthIndex, dueDay);
  const diffMs = dueDate.getTime() - todayStart.getTime();
  const daysUntilDue = Math.round(diffMs / (1000 * 60 * 60 * 24));

  const currentMonthKey = formatMonthKeyFromDate(now);
  if (targetMonthKey < currentMonthKey || daysUntilDue < 0) {
    return { status: "OVERDUE", dueDay, daysUntilDue };
  }
  if (daysUntilDue === 0) {
    return { status: "DUE_TODAY", dueDay, daysUntilDue: 0 };
  }
  if (daysUntilDue <= leadDays) {
    return { status: "DUE_SOON", dueDay, daysUntilDue };
  }
  return { status: "UPCOMING", dueDay, daysUntilDue };
}

/**
 * Returns active EXPENSE recurring rules for monthKey that are due within leadDays (default 3) or overdue and not yet applied.
 */
export function findRecurringExpenseReminders(
  rules: RecurringRule[],
  monthKey: string,
  now: Date = new Date(),
  leadDays: number = RECURRING_REMINDER_LEAD_DAYS
): RecurringReminderCandidate[] {
  const candidates: RecurringReminderCandidate[] = [];

  for (const rule of rules) {
    if (!rule.isActive || rule.type !== "EXPENSE" || rule.lastAppliedMonth === monthKey) {
      continue;
    }

    const evaluation = evaluateRecurringRuleDueStatus(rule, monthKey, now, leadDays);
    if (
      evaluation.status === "OVERDUE" ||
      evaluation.status === "DUE_TODAY" ||
      evaluation.status === "DUE_SOON"
    ) {
      candidates.push({
        rule,
        monthKey,
        dueDay: evaluation.dueDay,
        daysUntilDue: evaluation.daysUntilDue,
        status: evaluation.status,
      });
    }
  }

  return candidates.sort((a, b) => a.daysUntilDue - b.daysUntilDue);
}

/**
 * Sends at most one browser notification per category per month once spending exceeds 80%.
 */
export function triggerBudgetThresholdNotifications(params: {
  monthKey: string;
  items: BudgetProgressItem[];
  isPrivacyMode?: boolean;
}): { sentCount: number; sentCategories: string[] } {
  if (!isBrowserNotificationSupported()) {
    return { sentCount: 0, sentCategories: [] };
  }
  if (window.Notification.permission !== "granted" || !isBrowserNotificationOptedIn()) {
    return { sentCount: 0, sentCategories: [] };
  }

  const candidates = findBudgetExceedingThreshold(params.items, BUDGET_WARNING_THRESHOLD_RATIO);
  if (candidates.length === 0) {
    return { sentCount: 0, sentCategories: [] };
  }

  const alreadySent = new Set(getSentBudgetAlertsForMonth(params.monthKey));
  const sentCategories: string[] = [];

  for (const item of candidates) {
    if (alreadySent.has(item.categoryId)) continue;

    const exactPct = Math.round((item.spentAmount / item.limitAmount) * 100);
    const isOver = item.spentAmount >= item.limitAmount;
    const title = isOver
      ? `Vượt ngân sách: ${item.categoryName} (${exactPct}%)`
      : `Cảnh báo ngân sách >80%: ${item.categoryName}`;

    const spentFormatted = formatVNDMasked(item.spentAmount, Boolean(params.isPrivacyMode));
    const limitFormatted = formatVNDMasked(item.limitAmount, Boolean(params.isPrivacyMode));
    const body = isOver
      ? `Chi tiêu tháng ${params.monthKey} đã đạt ${spentFormatted} / ${limitFormatted}.`
      : `Đã chi ${spentFormatted} / ${limitFormatted} (${exactPct}% hạn mức tháng ${params.monthKey}).`;

    try {
      new window.Notification(title, {
        body,
        tag: `home-moni-budget-${params.monthKey}-${item.categoryId}`,
        icon: NOTIFICATION_ICON_PATH,
      });
      markBudgetAlertSent(params.monthKey, item.categoryId);
      sentCategories.push(item.categoryName);
    } catch {
      // Ignore Notification constructor errors in restricted webviews
    }
  }

  return {
    sentCount: sentCategories.length,
    sentCategories,
  };
}

/**
 * Sends at most one browser notification per recurring expense rule per month
 * when due within 3 days, due today, or overdue.
 */
export function triggerRecurringExpenseNotifications(params: {
  monthKey: string;
  rules: RecurringRule[];
  isPrivacyMode?: boolean;
  now?: Date;
  leadDays?: number;
}): { sentCount: number; sentRuleNames: string[] } {
  if (!isBrowserNotificationSupported()) {
    return { sentCount: 0, sentRuleNames: [] };
  }
  if (window.Notification.permission !== "granted" || !isBrowserNotificationOptedIn()) {
    return { sentCount: 0, sentRuleNames: [] };
  }

  const candidates = findRecurringExpenseReminders(
    params.rules,
    params.monthKey,
    params.now,
    params.leadDays
  );
  if (candidates.length === 0) {
    return { sentCount: 0, sentRuleNames: [] };
  }

  const alreadySent = new Set(getSentRecurringAlertsForMonth(params.monthKey));
  const sentRuleNames: string[] = [];

  for (const item of candidates) {
    if (alreadySent.has(item.rule.id)) continue;

    const amountFormatted = formatVNDMasked(item.rule.amount, Boolean(params.isPrivacyMode));
    const timingLabel =
      item.status === "OVERDUE"
        ? `Đã quá hạn ${Math.abs(item.daysUntilDue)} ngày (ngày ${item.dueDay})`
        : item.status === "DUE_TODAY"
        ? `Đến hạn hôm nay (ngày ${item.dueDay})`
        : `Còn ${item.daysUntilDue} ngày đến hạn (ngày ${item.dueDay})`;

    const title =
      item.status === "OVERDUE"
        ? `Quá hạn chi định kỳ: ${item.rule.name}`
        : item.status === "DUE_TODAY"
        ? `Đến hạn hôm nay: ${item.rule.name}`
        : `Nhắc chi định kỳ: ${item.rule.name}`;

    const body = `${timingLabel} · ${amountFormatted} cho kỳ ${params.monthKey}. Mở HOME MONI để ghi sổ 1 chạm.`;

    try {
      new window.Notification(title, {
        body,
        tag: `home-moni-recurring-${params.monthKey}-${item.rule.id}`,
        icon: NOTIFICATION_ICON_PATH,
      });
      markRecurringAlertSent(params.monthKey, item.rule.id);
      sentRuleNames.push(item.rule.name);
    } catch {
      // Ignore Notification constructor errors in restricted webviews
    }
  }

  return {
    sentCount: sentRuleNames.length,
    sentRuleNames,
  };
}
