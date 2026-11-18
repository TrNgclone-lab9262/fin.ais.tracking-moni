import { Category, Transaction } from "@/types/finance";
import {
  PerspectiveFilter,
  matchesPerspectiveMember,
  shiftMonthKey,
} from "./financeEngine";
import { getMonthDisplayLabel } from "./formatters";

export type PeriodComparisonMode = "MOM" | "YOY";

export interface MetricComparison {
  current: number;
  previous: number;
  deltaAmount: number;
  deltaPercent: number | null; // null khi previous === 0 (mốc 0 đ)
  isNewBaseline: boolean; // previous === 0 && current > 0
}

export interface CategoryComparisonRow {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  currentAmount: number;
  previousAmount: number;
  deltaAmount: number;
  deltaPercent: number | null;
  isNewBaseline: boolean;
  shareOfCurrentPct: number;
}

export interface PeriodComparisonResult {
  mode: PeriodComparisonMode;
  currentMonthKey: string;
  previousMonthKey: string;
  currentLabel: string;
  previousLabel: string;
  hasCurrentData: boolean;
  hasPreviousData: boolean;
  income: MetricComparison;
  expense: MetricComparison;
  savings: MetricComparison;
  currentSavingsRate: number;
  previousSavingsRate: number;
  topCategories: CategoryComparisonRow[];
  totalExpenseCategoriesCount: number;
}

function buildMetricComparison(
  current: number,
  previous: number
): MetricComparison {
  const deltaAmount = current - previous;
  if (previous === 0) {
    return {
      current,
      previous,
      deltaAmount,
      deltaPercent: current === 0 ? 0 : null,
      isNewBaseline: current > 0,
    };
  }
  const rawPct = ((current - previous) / Math.abs(previous)) * 100;
  return {
    current,
    previous,
    deltaAmount,
    deltaPercent: Math.round(rawPct * 10) / 10,
    isNewBaseline: false,
  };
}

function aggregateMonthTotals(
  transactions: Transaction[],
  monthKey: string,
  perspective: PerspectiveFilter
): {
  income: number;
  expense: number;
  expenseByCategory: Map<string, number>;
  txCount: number;
} {
  let income = 0;
  let expense = 0;
  let txCount = 0;
  const expenseByCategory = new Map<string, number>();

  for (const tx of transactions) {
    if (!tx.date.startsWith(monthKey)) continue;
    if (!matchesPerspectiveMember(tx.memberId, perspective)) continue;

    if (tx.type === "INCOME") {
      income += tx.amount;
      txCount += 1;
    } else if (tx.type === "EXPENSE") {
      expense += tx.amount;
      txCount += 1;
      expenseByCategory.set(
        tx.categoryId,
        (expenseByCategory.get(tx.categoryId) || 0) + tx.amount
      );
    }
  }

  return { income, expense, expenseByCategory, txCount };
}

export function calculatePeriodComparison(params: {
  transactions: Transaction[];
  categories: Category[];
  currentMonthKey: string;
  mode: PeriodComparisonMode;
  perspective: PerspectiveFilter;
  topLimit?: number;
}): PeriodComparisonResult {
  const {
    transactions,
    categories,
    currentMonthKey,
    mode,
    perspective,
    topLimit = 6,
  } = params;

  const deltaMonths = mode === "MOM" ? -1 : -12;
  const previousMonthKey = shiftMonthKey(currentMonthKey, deltaMonths);

  const cur = aggregateMonthTotals(transactions, currentMonthKey, perspective);
  const prev = aggregateMonthTotals(transactions, previousMonthKey, perspective);

  const curSavings = cur.income - cur.expense;
  const prevSavings = prev.income - prev.expense;

  const currentSavingsRate =
    cur.income > 0 ? Math.round((curSavings / cur.income) * 1000) / 10 : 0;
  const previousSavingsRate =
    prev.income > 0 ? Math.round((prevSavings / prev.income) * 1000) / 10 : 0;

  // Hợp nhất mọi danh mục chi tiêu có phát sinh ở kỳ hiện tại hoặc kỳ đối chiếu
  // (kể cả danh mục đã ẩn để bảo toàn báo cáo lịch sử)
  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const involvedIds = new Set<string>([
    ...cur.expenseByCategory.keys(),
    ...prev.expenseByCategory.keys(),
  ]);

  const allCategoryRows: CategoryComparisonRow[] = Array.from(involvedIds)
    .map((categoryId) => {
      const cat = categoryMap.get(categoryId);
      const currentAmount = cur.expenseByCategory.get(categoryId) || 0;
      const previousAmount = prev.expenseByCategory.get(categoryId) || 0;
      const deltaAmount = currentAmount - previousAmount;
      const deltaPercent =
        previousAmount === 0
          ? currentAmount === 0
            ? 0
            : null
          : Math.round(((currentAmount - previousAmount) / previousAmount) * 1000) / 10;

      return {
        categoryId,
        categoryName: cat?.name || "Danh mục khác",
        categoryColor: cat?.color || "#64748B",
        currentAmount,
        previousAmount,
        deltaAmount,
        deltaPercent,
        isNewBaseline: previousAmount === 0 && currentAmount > 0,
        shareOfCurrentPct:
          cur.expense > 0 ? Math.round((currentAmount / cur.expense) * 100) : 0,
      };
    })
    .filter((row) => row.currentAmount > 0 || row.previousAmount > 0)
    .sort((a, b) => {
      const peakA = Math.max(a.currentAmount, a.previousAmount);
      const peakB = Math.max(b.currentAmount, b.previousAmount);
      if (peakB !== peakA) return peakB - peakA;
      return b.currentAmount - a.currentAmount;
    });

  return {
    mode,
    currentMonthKey,
    previousMonthKey,
    currentLabel: getMonthDisplayLabel(currentMonthKey),
    previousLabel: getMonthDisplayLabel(previousMonthKey),
    hasCurrentData: cur.txCount > 0,
    hasPreviousData: prev.txCount > 0,
    income: buildMetricComparison(cur.income, prev.income),
    expense: buildMetricComparison(cur.expense, prev.expense),
    savings: buildMetricComparison(curSavings, prevSavings),
    currentSavingsRate,
    previousSavingsRate,
    topCategories: allCategoryRows.slice(0, topLimit),
    totalExpenseCategoriesCount: allCategoryRows.length,
  };
}
