import { Account, AppSettings, Category, FamilyMember, Transaction } from "@/types/finance";
import {
  CoupleSettlementResult,
  PerspectiveFilter,
  calculateCoupleSettlement,
  matchesPerspectiveMember,
} from "./financeEngine";
import { formatDateVN, getCurrentMonthKey, getMonthDisplayLabel } from "./formatters";

export interface MonthlyReportCategoryBreakdown {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  amount: number;
  percentage: number;
  count: number;
}

export interface MonthlyReportTransactionRow {
  id: string;
  date: string;
  dateDisplay: string;
  type: Transaction["type"];
  typeLabel: string;
  categoryName: string;
  categoryColor: string;
  accountName: string;
  toAccountName?: string;
  memberId: FamilyMember;
  memberLabel: string;
  scope: Transaction["scope"];
  scopeLabel: string;
  amount: number;
  note: string;
}

export interface MonthlyPdfReportData {
  monthKey: string;
  monthLabel: string;
  perspective: PerspectiveFilter;
  perspectiveLabel: string;
  husbandName: string;
  wifeName: string;
  generatedAtDisplay: string;
  summary: {
    totalIncome: number;
    totalExpense: number;
    totalTransfer: number;
    netSavings: number;
    savingsRate: number;
    transactionCount: number;
  };
  memberBreakdown: {
    husbandIncome: number;
    husbandExpense: number;
    husbandSharedExpense: number;
    husbandPersonalExpense: number;
    wifeIncome: number;
    wifeExpense: number;
    wifeSharedExpense: number;
    wifePersonalExpense: number;
  };
  coupleSettlement: CoupleSettlementResult;
  topExpenseCategories: MonthlyReportCategoryBreakdown[];
  rows: MonthlyReportTransactionRow[];
}

export interface BuildMonthlyPdfReportParams {
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  monthKey: string;
  perspective: PerspectiveFilter;
  settings: Pick<AppSettings, "husbandName" | "wifeName" | "sharedSplitRatioHusband">;
  now?: Date;
}

export function normalizeReportMonthKey(monthKey: string, now: Date = new Date()): string {
  if (!monthKey || monthKey === "ALL" || !/^\d{4}-\d{2}$/.test(monthKey)) {
    return getCurrentMonthKey();
  }
  const [y, m] = monthKey.split("-").map((v) => parseInt(v, 10));
  if (!y || !m || m < 1 || m > 12) {
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  }
  return monthKey;
}

function formatDateTimeVN(date: Date): string {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${d}/${m}/${y} ${hh}:${mm}`;
}

export function buildMonthlyPdfReport({
  transactions,
  categories,
  accounts,
  monthKey,
  perspective,
  settings,
  now = new Date(),
}: BuildMonthlyPdfReportParams): MonthlyPdfReportData {
  const targetMonth = normalizeReportMonthKey(monthKey, now);
  const husbandName = settings.husbandName || "Chồng";
  const wifeName = settings.wifeName || "Vợ";
  const husbandSharePct = settings.sharedSplitRatioHusband ?? 50;

  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const accountMap = new Map(accounts.map((a) => [a.id, a]));

  const monthAllTxs = transactions
    .filter((tx) => tx.date.startsWith(targetMonth))
    .sort((a, b) => {
      const dateCmp = b.date.localeCompare(a.date);
      if (dateCmp !== 0) return dateCmp;
      return (b.createdAt || "").localeCompare(a.createdAt || "");
    });

  const scopedTxs = monthAllTxs.filter((tx) =>
    matchesPerspectiveMember(tx.memberId, perspective)
  );

  let totalIncome = 0;
  let totalExpense = 0;
  let totalTransfer = 0;

  let husbandIncome = 0;
  let husbandExpense = 0;
  let husbandSharedExpense = 0;
  let husbandPersonalExpense = 0;
  let wifeIncome = 0;
  let wifeExpense = 0;
  let wifeSharedExpense = 0;
  let wifePersonalExpense = 0;

  for (const tx of monthAllTxs) {
    if (tx.type === "INCOME") {
      if (tx.memberId === "HUSBAND") husbandIncome += tx.amount;
      else if (tx.memberId === "WIFE") wifeIncome += tx.amount;
    } else if (tx.type === "EXPENSE") {
      if (tx.memberId === "HUSBAND") {
        husbandExpense += tx.amount;
        if (tx.scope === "FAMILY") husbandSharedExpense += tx.amount;
        else husbandPersonalExpense += tx.amount;
      } else if (tx.memberId === "WIFE") {
        wifeExpense += tx.amount;
        if (tx.scope === "FAMILY") wifeSharedExpense += tx.amount;
        else wifePersonalExpense += tx.amount;
      }
    }
  }

  const expenseCategoryTotals = new Map<string, { amount: number; count: number }>();

  const rows: MonthlyReportTransactionRow[] = scopedTxs.map((tx) => {
    if (tx.type === "INCOME") totalIncome += tx.amount;
    else if (tx.type === "EXPENSE") {
      totalExpense += tx.amount;
      const prev = expenseCategoryTotals.get(tx.categoryId) || { amount: 0, count: 0 };
      expenseCategoryTotals.set(tx.categoryId, {
        amount: prev.amount + tx.amount,
        count: prev.count + 1,
      });
    } else {
      totalTransfer += tx.amount;
    }

    const cat = categoryMap.get(tx.categoryId);
    const acc = accountMap.get(tx.accountId);
    const toAcc = tx.toAccountId ? accountMap.get(tx.toAccountId) : undefined;

    const typeLabel =
      tx.type === "INCOME"
        ? "Thu nhập"
        : tx.type === "EXPENSE"
        ? "Chi tiêu"
        : "Chuyển khoản";

    const memberLabel =
      tx.memberId === "HUSBAND"
        ? husbandName
        : tx.memberId === "WIFE"
        ? wifeName
        : "Gia đình";

    const scopeLabel = tx.scope === "FAMILY" ? "Chung" : "Riêng";

    return {
      id: tx.id,
      date: tx.date,
      dateDisplay: formatDateVN(tx.date),
      type: tx.type,
      typeLabel,
      categoryName: cat?.name || (tx.type === "TRANSFER" ? "Chuyển ví / Trả thẻ" : "Khác"),
      categoryColor: cat?.color || "#64748b",
      accountName: acc?.name || tx.accountId,
      toAccountName: toAcc?.name,
      memberId: tx.memberId,
      memberLabel,
      scope: tx.scope,
      scopeLabel,
      amount: tx.amount,
      note: tx.note?.trim() || "",
    };
  });

  const netSavings = totalIncome - totalExpense;
  const savingsRate =
    totalIncome > 0 ? Math.round((netSavings / totalIncome) * 100) : 0;

  const topExpenseCategories: MonthlyReportCategoryBreakdown[] = Array.from(
    expenseCategoryTotals.entries()
  )
    .map(([categoryId, stats]) => {
      const cat = categoryMap.get(categoryId);
      return {
        categoryId,
        categoryName: cat?.name || "Khác",
        categoryColor: cat?.color || "#64748b",
        amount: stats.amount,
        percentage:
          totalExpense > 0 ? Math.round((stats.amount / totalExpense) * 100) : 0,
        count: stats.count,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  const coupleSettlement = calculateCoupleSettlement(
    monthAllTxs,
    targetMonth,
    husbandSharePct
  );

  const perspectiveLabel =
    perspective === "ALL"
      ? "Cả gia đình (My Home)"
      : perspective === "HUSBAND"
      ? `Góc nhìn: ${husbandName}`
      : `Góc nhìn: ${wifeName}`;

  return {
    monthKey: targetMonth,
    monthLabel: getMonthDisplayLabel(targetMonth),
    perspective,
    perspectiveLabel,
    husbandName,
    wifeName,
    generatedAtDisplay: formatDateTimeVN(now),
    summary: {
      totalIncome,
      totalExpense,
      totalTransfer,
      netSavings,
      savingsRate,
      transactionCount: rows.length,
    },
    memberBreakdown: {
      husbandIncome,
      husbandExpense,
      husbandSharedExpense,
      husbandPersonalExpense,
      wifeIncome,
      wifeExpense,
      wifeSharedExpense,
      wifePersonalExpense,
    },
    coupleSettlement,
    topExpenseCategories,
    rows,
  };
}
