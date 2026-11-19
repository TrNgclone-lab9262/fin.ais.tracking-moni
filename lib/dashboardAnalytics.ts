import { Category, CategoryBudget, Transaction } from "@/types/finance";
import { getCurrentMonthKey, getMonthDisplayLabel } from "@/lib/formatters";

export type AnalyticsPerspective = "ALL" | "HUSBAND" | "WIFE";
export type SpendingTrendRange = "30D" | "3M" | "6M" | "12M";
export type IncomeExpenseRange = "6M" | "12M" | "ALL";

export interface SpendingTrendPoint {
  key: string;
  label: string;
  fullLabel: string;
  amount: number;
  movingAvg: number;
  txCount: number;
  budgetLimit: number | null;
  isMonthKey: boolean;
}

export interface SpendingTrendResult {
  range: SpendingTrendRange;
  categoryId: string;
  categoryName: string;
  points: SpendingTrendPoint[];
  totalSpent: number;
  averagePerBucket: number;
  budgetCeiling: number | null;
  peakPoint: SpendingTrendPoint | null;
  trendDeltaPct: number | null;
  totalTxCount: number;
}

export interface CategoryComparisonRow {
  categoryId: string;
  categoryName: string;
  color: string;
  amountA: number;
  amountB: number;
  delta: number;
  deltaPct: number | null;
  txCountA: number;
  txCountB: number;
}

export interface StackedCategoryMeta {
  key: string;
  categoryId: string;
  name: string;
  color: string;
}

export interface StackedMonthRow {
  month: string;
  label: string;
  fullLabel: string;
  total: number;
  values: Record<string, number>;
  [key: string]: string | number | Record<string, number>;
}

export interface MonthlyExpenseComparisonResult {
  monthA: string;
  monthB: string;
  monthALabel: string;
  monthBLabel: string;
  totalA: number;
  totalB: number;
  deltaAmount: number;
  deltaPct: number | null;
  categoryRows: CategoryComparisonRow[];
  stackedSeries: StackedCategoryMeta[];
  stackedMonths: StackedMonthRow[];
  availableMonths: string[];
}

export interface IncomeExpensePoint {
  month: string;
  label: string;
  fullLabel: string;
  income: number;
  expense: number;
  net: number;
  savingsRate: number;
  expenseRatio: number;
  txCount: number;
}

export interface IncomeVsExpenseResult {
  range: IncomeExpenseRange;
  points: IncomeExpensePoint[];
  totalIncome: number;
  totalExpense: number;
  totalNet: number;
  avgSavingsRate: number;
  surplusMonthsCount: number;
  bestSavingsMonth: IncomeExpensePoint | null;
  highestExpenseMonth: IncomeExpensePoint | null;
}

const FALLBACK_PALETTE = [
  "#2563EB",
  "#10B981",
  "#F59E0B",
  "#EC4899",
  "#8B5CF6",
  "#06B6D4",
  "#F97316",
  "#64748B",
];

export function filterTransactionsByPerspective(
  transactions: Transaction[],
  perspective: AnalyticsPerspective
): Transaction[] {
  if (perspective === "ALL") return transactions;
  return transactions.filter((tx) => tx.memberId === perspective);
}

export function shiftMonthKey(monthKey: string, deltaMonths: number): string {
  const [yStr, mStr] = monthKey.split("-");
  const year = Number(yStr) || new Date().getFullYear();
  const monthIdx = (Number(mStr) || 1) - 1;
  const total = year * 12 + monthIdx + deltaMonths;
  const nextYear = Math.floor(total / 12);
  const nextMonth = ((total % 12) + 12) % 12;
  return `${nextYear}-${String(nextMonth + 1).padStart(2, "0")}`;
}

export function formatShortMonthTick(monthKey: string): string {
  const [y, m] = monthKey.split("-");
  if (!y || !m) return monthKey;
  return `T${Number(m)}/${y.slice(2)}`;
}

export function formatShortDayTick(isoDate: string): string {
  const [, m, d] = isoDate.split("-");
  if (!m || !d) return isoDate;
  return `${d}/${m}`;
}

function getTodayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
}

function shiftIsoDate(isoDate: string, deltaDays: number): string {
  const [y, m, d] = isoDate.split("-").map((n) => Number(n));
  const dt = new Date(Date.UTC(y || 2026, (m || 1) - 1, d || 1));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(
    dt.getUTCDate()
  ).padStart(2, "0")}`;
}

export function resolveAnchorMonth(
  transactions: Transaction[],
  selectedMonth: string
): string {
  if (selectedMonth && selectedMonth !== "ALL" && /^\d{4}-\d{2}$/.test(selectedMonth)) {
    return selectedMonth;
  }
  let latest = "";
  for (const tx of transactions) {
    if (tx.date && tx.date.length >= 7) {
      const m = tx.date.slice(0, 7);
      if (m > latest) latest = m;
    }
  }
  return latest || getCurrentMonthKey();
}

export function listAvailableMonths(
  transactions: Transaction[],
  selectedMonth: string,
  minWindowCount = 12
): string[] {
  const anchor = resolveAnchorMonth(transactions, selectedMonth);
  const monthSet = new Set<string>();
  for (const tx of transactions) {
    if (tx.date && tx.date.length >= 7 && /^\d{4}-\d{2}$/.test(tx.date.slice(0, 7))) {
      monthSet.add(tx.date.slice(0, 7));
    }
  }
  for (let i = 0; i < minWindowCount; i++) {
    monthSet.add(shiftMonthKey(anchor, -i));
  }
  return Array.from(monthSet).sort((a, b) => (a > b ? -1 : a < b ? 1 : 0));
}

function resolveBudgetCeilingForMonth(
  budgets: CategoryBudget[],
  monthKey: string,
  categoryId: string
): number | null {
  const monthBudgets = budgets.filter((b) => b.month === monthKey);
  const fallbackBudgets = monthBudgets.length > 0 ? monthBudgets : budgets;
  if (fallbackBudgets.length === 0) return null;

  if (categoryId !== "ALL") {
    const exact = monthBudgets.find((b) => b.categoryId === categoryId);
    if (exact && exact.limitAmount > 0) return exact.limitAmount;
    const latestCat = budgets
      .filter((b) => b.categoryId === categoryId && b.limitAmount > 0)
      .sort((a, b) => b.month.localeCompare(a.month))[0];
    return latestCat ? latestCat.limitAmount : null;
  }

  const targetMonth =
    monthBudgets.length > 0
      ? monthKey
      : [...budgets].sort((a, b) => b.month.localeCompare(a.month))[0]?.month;
  if (!targetMonth) return null;

  const total = budgets
    .filter((b) => b.month === targetMonth && b.limitAmount > 0)
    .reduce((sum, b) => sum + b.limitAmount, 0);
  return total > 0 ? total : null;
}

export function buildSpendingTrendSeries(input: {
  transactions: Transaction[];
  categories: Category[];
  budgets: CategoryBudget[];
  perspective: AnalyticsPerspective;
  range: SpendingTrendRange;
  categoryId: string;
  selectedMonth: string;
  referenceDate?: string;
}): SpendingTrendResult {
  const {
    transactions,
    categories,
    budgets,
    perspective,
    range,
    categoryId,
    selectedMonth,
    referenceDate,
  } = input;

  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const categoryName =
    categoryId === "ALL"
      ? "Tất cả hạng mục chi"
      : categoryMap.get(categoryId)?.name || "Danh mục đã chọn";

  const scopedExpenses = filterTransactionsByPerspective(transactions, perspective).filter(
    (tx) =>
      tx.type === "EXPENSE" &&
      (categoryId === "ALL" || tx.categoryId === categoryId)
  );

  const anchorMonth = resolveAnchorMonth(transactions, selectedMonth);

  if (range === "30D") {
    let endIso = referenceDate || getTodayIso();
    if (selectedMonth !== "ALL" && /^\d{4}-\d{2}$/.test(selectedMonth)) {
      const todayIso = referenceDate || getTodayIso();
      if (!todayIso.startsWith(selectedMonth)) {
        const [y, m] = selectedMonth.split("-").map(Number);
        const lastDay = new Date(y, m, 0).getDate();
        endIso = `${selectedMonth}-${String(lastDay).padStart(2, "0")}`;
      }
    }

    const dayBuckets = new Map<string, { amount: number; txCount: number }>();
    const dayKeys: string[] = [];
    for (let i = 29; i >= 0; i--) {
      const k = shiftIsoDate(endIso, -i);
      dayKeys.push(k);
      dayBuckets.set(k, { amount: 0, txCount: 0 });
    }

    for (const tx of scopedExpenses) {
      const bucket = dayBuckets.get(tx.date);
      if (bucket) {
        bucket.amount += tx.amount;
        bucket.txCount += 1;
      }
    }

    const monthlyBudget = resolveBudgetCeilingForMonth(budgets, anchorMonth, categoryId);
    const dailyBudget = monthlyBudget ? Math.round(monthlyBudget / 30) : null;

    const rawPoints: SpendingTrendPoint[] = dayKeys.map((k, idx) => {
      const b = dayBuckets.get(k)!;
      const winStart = Math.max(0, idx - 6);
      let winSum = 0;
      for (let j = winStart; j <= idx; j++) {
        winSum += dayBuckets.get(dayKeys[j])!.amount;
      }
      const movingAvg = Math.round(winSum / (idx - winStart + 1));
      const [y, m, d] = k.split("-");
      return {
        key: k,
        label: formatShortDayTick(k),
        fullLabel: `Ngày ${d}/${m}/${y}`,
        amount: b.amount,
        movingAvg,
        txCount: b.txCount,
        budgetLimit: dailyBudget,
        isMonthKey: false,
      };
    });

    const totalSpent = rawPoints.reduce((s, p) => s + p.amount, 0);
    const totalTxCount = rawPoints.reduce((s, p) => s + p.txCount, 0);
    const averagePerBucket = Math.round(totalSpent / rawPoints.length);
    const peakPoint =
      rawPoints.reduce<SpendingTrendPoint | null>(
        (max, p) => (!max || p.amount > max.amount ? p : max),
        null
      );

    const firstHalf = rawPoints.slice(0, 15).reduce((s, p) => s + p.amount, 0);
    const secondHalf = rawPoints.slice(15).reduce((s, p) => s + p.amount, 0);
    const trendDeltaPct =
      firstHalf > 0
        ? Math.round(((secondHalf - firstHalf) / firstHalf) * 1000) / 10
        : null;

    return {
      range,
      categoryId,
      categoryName,
      points: rawPoints,
      totalSpent,
      averagePerBucket,
      budgetCeiling: dailyBudget,
      peakPoint: peakPoint && peakPoint.amount > 0 ? peakPoint : null,
      trendDeltaPct,
      totalTxCount,
    };
  }

  const monthCount = range === "3M" ? 3 : range === "6M" ? 6 : 12;
  const monthKeys: string[] = [];
  for (let i = monthCount - 1; i >= 0; i--) {
    monthKeys.push(shiftMonthKey(anchorMonth, -i));
  }

  const bucketMap = new Map<string, { amount: number; txCount: number }>();
  monthKeys.forEach((m) => bucketMap.set(m, { amount: 0, txCount: 0 }));

  for (const tx of scopedExpenses) {
    const m = tx.date.slice(0, 7);
    const bucket = bucketMap.get(m);
    if (bucket) {
      bucket.amount += tx.amount;
      bucket.txCount += 1;
    }
  }

  const points: SpendingTrendPoint[] = monthKeys.map((m, idx) => {
    const b = bucketMap.get(m)!;
    const winStart = Math.max(0, idx - 2);
    let winSum = 0;
    for (let j = winStart; j <= idx; j++) {
      winSum += bucketMap.get(monthKeys[j])!.amount;
    }
    const movingAvg = Math.round(winSum / (idx - winStart + 1));
    return {
      key: m,
      label: formatShortMonthTick(m),
      fullLabel: getMonthDisplayLabel(m),
      amount: b.amount,
      movingAvg,
      txCount: b.txCount,
      budgetLimit: resolveBudgetCeilingForMonth(budgets, m, categoryId),
      isMonthKey: true,
    };
  });

  const totalSpent = points.reduce((s, p) => s + p.amount, 0);
  const totalTxCount = points.reduce((s, p) => s + p.txCount, 0);
  const averagePerBucket = points.length > 0 ? Math.round(totalSpent / points.length) : 0;
  const peakPoint = points.reduce<SpendingTrendPoint | null>(
    (max, p) => (!max || p.amount > max.amount ? p : max),
    null
  );

  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  const trendDeltaPct =
    last && prev && prev.amount > 0
      ? Math.round(((last.amount - prev.amount) / prev.amount) * 1000) / 10
      : null;

  const budgetCeiling = resolveBudgetCeilingForMonth(budgets, anchorMonth, categoryId);

  return {
    range,
    categoryId,
    categoryName,
    points,
    totalSpent,
    averagePerBucket,
    budgetCeiling,
    peakPoint: peakPoint && peakPoint.amount > 0 ? peakPoint : null,
    trendDeltaPct,
    totalTxCount,
  };
}

export function buildMonthlyExpenseComparison(input: {
  transactions: Transaction[];
  categories: Category[];
  perspective: AnalyticsPerspective;
  monthA: string;
  monthB: string;
  stackedMonthCount?: number;
}): MonthlyExpenseComparisonResult {
  const {
    transactions,
    categories,
    perspective,
    monthA,
    monthB,
    stackedMonthCount = 6,
  } = input;

  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const scopedExpenses = filterTransactionsByPerspective(transactions, perspective).filter(
    (tx) => tx.type === "EXPENSE"
  );

  const mapA = new Map<string, { amount: number; count: number }>();
  const mapB = new Map<string, { amount: number; count: number }>();
  let totalA = 0;
  let totalB = 0;

  for (const tx of scopedExpenses) {
    const m = tx.date.slice(0, 7);
    if (m === monthA) {
      totalA += tx.amount;
      const cur = mapA.get(tx.categoryId) || { amount: 0, count: 0 };
      cur.amount += tx.amount;
      cur.count += 1;
      mapA.set(tx.categoryId, cur);
    } else if (m === monthB) {
      totalB += tx.amount;
      const cur = mapB.get(tx.categoryId) || { amount: 0, count: 0 };
      cur.amount += tx.amount;
      cur.count += 1;
      mapB.set(tx.categoryId, cur);
    }
  }

  const allCatIds = new Set<string>([...mapA.keys(), ...mapB.keys()]);
  const categoryRows: CategoryComparisonRow[] = Array.from(allCatIds)
    .map((catId, idx) => {
      const cat = categoryMap.get(catId);
      const a = mapA.get(catId) || { amount: 0, count: 0 };
      const b = mapB.get(catId) || { amount: 0, count: 0 };
      const delta = a.amount - b.amount;
      const deltaPct =
        b.amount > 0 ? Math.round((delta / b.amount) * 1000) / 10 : null;
      return {
        categoryId: catId,
        categoryName: cat?.name || "Hạng mục khác",
        color: cat?.color || FALLBACK_PALETTE[idx % FALLBACK_PALETTE.length],
        amountA: a.amount,
        amountB: b.amount,
        delta,
        deltaPct,
        txCountA: a.count,
        txCountB: b.count,
      };
    })
    .sort((x, y) => Math.max(y.amountA, y.amountB) - Math.max(x.amountA, x.amountB));

  // Build N-month stacked breakdown anchored at monthA
  const stackedKeys: string[] = [];
  for (let i = stackedMonthCount - 1; i >= 0; i--) {
    stackedKeys.push(shiftMonthKey(monthA, -i));
  }
  const stackedKeySet = new Set(stackedKeys);

  const totalsByCategoryInWindow = new Map<string, number>();
  const monthCatMatrix = new Map<string, Map<string, number>>();
  stackedKeys.forEach((m) => monthCatMatrix.set(m, new Map()));

  for (const tx of scopedExpenses) {
    const m = tx.date.slice(0, 7);
    if (!stackedKeySet.has(m)) continue;
    totalsByCategoryInWindow.set(
      tx.categoryId,
      (totalsByCategoryInWindow.get(tx.categoryId) || 0) + tx.amount
    );
    const mMap = monthCatMatrix.get(m)!;
    mMap.set(tx.categoryId, (mMap.get(tx.categoryId) || 0) + tx.amount);
  }

  const sortedTopCatIds = Array.from(totalsByCategoryInWindow.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);

  const top5Ids = sortedTopCatIds.slice(0, 5);
  const hasOther = sortedTopCatIds.length > 5;

  const stackedSeries: StackedCategoryMeta[] = top5Ids.map((catId, idx) => {
    const cat = categoryMap.get(catId);
    return {
      key: `cat_${idx}`,
      categoryId: catId,
      name: cat?.name || "Danh mục khác",
      color: cat?.color || FALLBACK_PALETTE[idx % FALLBACK_PALETTE.length],
    };
  });

  if (hasOther) {
    stackedSeries.push({
      key: "cat_other",
      categoryId: "OTHER",
      name: "Danh mục khác",
      color: "#94A3B8",
    });
  }

  const top5IndexMap = new Map(top5Ids.map((id, idx) => [id, `cat_${idx}`]));

  const stackedMonths: StackedMonthRow[] = stackedKeys.map((m) => {
    const mMap = monthCatMatrix.get(m)!;
    const values: Record<string, number> = {};
    stackedSeries.forEach((s) => {
      values[s.key] = 0;
    });

    let total = 0;
    for (const [catId, amt] of mMap.entries()) {
      total += amt;
      const mappedKey = top5IndexMap.get(catId);
      if (mappedKey) {
        values[mappedKey] = (values[mappedKey] || 0) + amt;
      } else if (hasOther) {
        values.cat_other = (values.cat_other || 0) + amt;
      }
    }

    return {
      month: m,
      label: formatShortMonthTick(m),
      fullLabel: getMonthDisplayLabel(m),
      total,
      values,
      ...values,
    };
  });

  const deltaAmount = totalA - totalB;
  const deltaPct = totalB > 0 ? Math.round((deltaAmount / totalB) * 1000) / 10 : null;
  const availableMonths = listAvailableMonths(transactions, monthA, 12);

  return {
    monthA,
    monthB,
    monthALabel: getMonthDisplayLabel(monthA),
    monthBLabel: getMonthDisplayLabel(monthB),
    totalA,
    totalB,
    deltaAmount,
    deltaPct,
    categoryRows,
    stackedSeries,
    stackedMonths,
    availableMonths,
  };
}

export function buildIncomeVsExpenseAnalytics(input: {
  transactions: Transaction[];
  perspective: AnalyticsPerspective;
  range: IncomeExpenseRange;
  selectedMonth: string;
}): IncomeVsExpenseResult {
  const { transactions, perspective, range, selectedMonth } = input;
  const scoped = filterTransactionsByPerspective(transactions, perspective).filter(
    (tx) => tx.type === "INCOME" || tx.type === "EXPENSE"
  );

  const anchorMonth = resolveAnchorMonth(transactions, selectedMonth);

  let monthKeys: string[] = [];
  if (range === "ALL") {
    const uniqueMonths = Array.from(
      new Set(
        scoped
          .map((t) => t.date.slice(0, 7))
          .filter((m) => /^\d{4}-\d{2}$/.test(m))
      )
    ).sort();
    if (uniqueMonths.length >= 2) {
      // Fill continuous months between earliest and latest (capped at 24 most recent)
      const earliest = uniqueMonths[0];
      const latest = uniqueMonths[uniqueMonths.length - 1];
      const allContinuous: string[] = [];
      let cursor = earliest;
      let guard = 0;
      while (cursor <= latest && guard < 36) {
        allContinuous.push(cursor);
        cursor = shiftMonthKey(cursor, 1);
        guard++;
      }
      monthKeys = allContinuous.slice(-24);
    } else {
      for (let i = 5; i >= 0; i--) {
        monthKeys.push(shiftMonthKey(anchorMonth, -i));
      }
    }
  } else {
    const count = range === "6M" ? 6 : 12;
    for (let i = count - 1; i >= 0; i--) {
      monthKeys.push(shiftMonthKey(anchorMonth, -i));
    }
  }

  const bucketMap = new Map<string, { income: number; expense: number; txCount: number }>();
  monthKeys.forEach((m) => bucketMap.set(m, { income: 0, expense: 0, txCount: 0 }));

  for (const tx of scoped) {
    const m = tx.date.slice(0, 7);
    const b = bucketMap.get(m);
    if (!b) continue;
    if (tx.type === "INCOME") b.income += tx.amount;
    else if (tx.type === "EXPENSE") b.expense += tx.amount;
    b.txCount += 1;
  }

  const points: IncomeExpensePoint[] = monthKeys.map((m) => {
    const b = bucketMap.get(m)!;
    const net = b.income - b.expense;
    const savingsRate =
      b.income > 0 ? Math.round((net / b.income) * 1000) / 10 : 0;
    const expenseRatio =
      b.income > 0 ? Math.round((b.expense / b.income) * 1000) / 10 : 0;
    return {
      month: m,
      label: formatShortMonthTick(m),
      fullLabel: getMonthDisplayLabel(m),
      income: b.income,
      expense: b.expense,
      net,
      savingsRate,
      expenseRatio,
      txCount: b.txCount,
    };
  });

  const totalIncome = points.reduce((s, p) => s + p.income, 0);
  const totalExpense = points.reduce((s, p) => s + p.expense, 0);
  const totalNet = totalIncome - totalExpense;
  const avgSavingsRate =
    totalIncome > 0 ? Math.round((totalNet / totalIncome) * 1000) / 10 : 0;
  const surplusMonthsCount = points.filter((p) => p.income > 0 && p.net >= 0).length;

  const activePoints = points.filter((p) => p.income > 0 || p.expense > 0);
  const bestSavingsMonth = activePoints.reduce<IncomeExpensePoint | null>(
    (best, p) => (!best || p.net > best.net ? p : best),
    null
  );
  const highestExpenseMonth = activePoints.reduce<IncomeExpensePoint | null>(
    (max, p) => (!max || p.expense > max.expense ? p : max),
    null
  );

  return {
    range,
    points,
    totalIncome,
    totalExpense,
    totalNet,
    avgSavingsRate,
    surplusMonthsCount,
    bestSavingsMonth,
    highestExpenseMonth,
  };
}
