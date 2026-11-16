import { BudgetProgressItem } from "@/types/finance";
import { formatVNDMasked } from "./formatters";

export type BrowserNotificationStatus = "unsupported" | "denied" | "default" | "granted";

const OPT_IN_STORAGE_KEY = "HOME_MONI_BROWSER_NOTIF_ENABLED_V1";
const SENT_LEDGER_STORAGE_KEY = "HOME_MONI_BUDGET_NOTIF_SENT_V1";

export const BUDGET_WARNING_THRESHOLD_RATIO = 0.8;

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

type SentBudgetLedger = Record<string, string[]>;

function readSentLedger(): SentBudgetLedger {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(SENT_LEDGER_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as SentBudgetLedger) : {};
  } catch {
    return {};
  }
}

function writeSentLedger(ledger: SentBudgetLedger): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SENT_LEDGER_STORAGE_KEY, JSON.stringify(ledger));
  } catch {
    // Ignore localStorage restrictions
  }
}

export function getSentBudgetAlertsForMonth(monthKey: string): string[] {
  const ledger = readSentLedger();
  return Array.isArray(ledger[monthKey]) ? ledger[monthKey] : [];
}

export function markBudgetAlertSent(monthKey: string, categoryId: string): void {
  const ledger = readSentLedger();
  const current = new Set(Array.isArray(ledger[monthKey]) ? ledger[monthKey] : []);
  current.add(categoryId);
  ledger[monthKey] = Array.from(current);
  writeSentLedger(ledger);
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
        icon: "/icon-192x192.png",
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
