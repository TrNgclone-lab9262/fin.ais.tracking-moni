import {
  Category,
  CategoryBudget,
  FamilyMember,
  RecurringRule,
  Transaction,
} from "@/types/finance";
import { shiftMonthKey } from "@/lib/financeEngine";
import { getMonthDisplayLabel } from "@/lib/formatters";

export type ForecastPerspective = "ALL" | "HUSBAND" | "WIFE";
export type ForecastRiskLevel = "SAFE" | "WATCH" | "TIGHT";

export interface ForecastMonthProjection {
  month: string; // YYYY-MM
  shortLabel: string; // T11/26
  monthLabel: string; // Tháng 11/2026
  horizonIndex: 1 | 2 | 3;
  predictedIncome: number;
  recurringIncome: number;
  discretionaryIncome: number;
  predictedExpense: number;
  recurringExpense: number;
  discretionaryExpense: number;
  projectedSavings: number;
  savingsRate: number;
  riskLevel: ForecastRiskLevel;
  riskLabel: string;
}

export interface ForecastChartPoint {
  month: string;
  shortLabel: string;
  monthLabel: string;
  isForecast: boolean;
  actualIncome: number | null;
  actualExpense: number | null;
  forecastIncome: number | null;
  forecastExpense: number | null;
  recurringExpense: number;
  discretionaryExpense: number;
  projectedSavings: number;
}

export interface ForecastCategoryDriver {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  avgMonthlyAmount: number;
  sharePct: number;
  isRecurringDominant: boolean;
}

export interface SpendingForecastResult {
  anchorMonth: string;
  anchorMonthLabel: string;
  perspective: ForecastPerspective;
  hasHistoricalData: boolean;
  monthsAnalyzed: number;
  historicalAvgIncome: number;
  historicalAvgExpense: number;
  recurringIncomeBaseline: number;
  recurringExpenseBaseline: number;
  discretionaryExpenseBaseline: number;
  monthlyGrowthRatePct: number;
  forecastMonths: ForecastMonthProjection[];
  chartSeries: ForecastChartPoint[];
  topDrivers: ForecastCategoryDriver[];
  budgetWarnings: string[];
  total3MonthProjectedIncome: number;
  total3MonthProjectedExpense: number;
  total3MonthProjectedSavings: number;
}

function matchesPerspective(memberId: FamilyMember, perspective: ForecastPerspective): boolean {
  if (perspective === "ALL") return true;
  return memberId === perspective;
}

function formatShortMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-");
  if (!y || !m) return monthKey;
  return `T${parseInt(m, 10)}/${y.slice(-2)}`;
}

/**
 * Tách phần chi/thu cố định đã khớp quy tắc định kỳ khỏi phần linh hoạt trong 1 tháng
 * nhằm tránh tính trùng (double counting) giữa lịch sử giao dịch và recurringRules đang bật.
 */
function splitMonthRecurringVsDiscretionary(
  monthTxs: Transaction[],
  activeRules: RecurringRule[],
  type: "INCOME" | "EXPENSE"
): { total: number; discretionary: number; recurringMatched: number } {
  const typedTxs = monthTxs.filter((tx) => tx.type === type);
  const total = typedTxs.reduce((sum, tx) => sum + tx.amount, 0);
  if (total === 0) {
    return { total: 0, discretionary: 0, recurringMatched: 0 };
  }

  const usedTxIds = new Set<string>();
  let recurringMatched = 0;

  // 1. Giao dịch được gắn thẻ RECURRING trực tiếp
  for (const tx of typedTxs) {
    if (tx.tag === "RECURRING") {
      usedTxIds.add(tx.id);
      recurringMatched += tx.amount;
    }
  }

  // 2. Đối chiếu các giao dịch khớp active recurringRule (tránh tính trùng nếu giao dịch chưa gắn tag RECURRING)
  for (const rule of activeRules) {
    if (rule.type !== type) continue;
    const match = typedTxs.find(
      (tx) =>
        !usedTxIds.has(tx.id) &&
        tx.categoryId === rule.categoryId &&
        Math.abs(tx.amount - rule.amount) <= Math.max(10_000, rule.amount * 0.05)
    );
    if (match) {
      usedTxIds.add(match.id);
      recurringMatched += match.amount;
    }
  }

  const discretionary = Math.max(0, total - recurringMatched);
  return { total, discretionary, recurringMatched };
}

export function buildSpendingForecast(params: {
  transactions: Transaction[];
  recurringRules: RecurringRule[];
  categories: Category[];
  budgets?: CategoryBudget[];
  anchorMonth: string;
  perspective: ForecastPerspective;
}): SpendingForecastResult {
  const {
    transactions,
    recurringRules,
    categories,
    budgets = [],
    anchorMonth,
    perspective,
  } = params;

  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  const scopedTxs = transactions.filter(
    (tx) =>
      (tx.type === "INCOME" || tx.type === "EXPENSE") &&
      matchesPerspective(tx.memberId, perspective)
  );

  const activeRules = recurringRules.filter(
    (r) => r.isActive && matchesPerspective(r.memberId, perspective)
  );

  const recurringIncomeBaseline = activeRules
    .filter((r) => r.type === "INCOME")
    .reduce((sum, r) => sum + r.amount, 0);

  const recurringExpenseBaseline = activeRules
    .filter((r) => r.type === "EXPENSE")
    .reduce((sum, r) => sum + r.amount, 0);

  // Thu thập 3 tháng gần nhất tính đến anchorMonth để vẽ biểu đồ lịch sử
  const recent3MonthKeys = [-2, -1, 0].map((offset) => shiftMonthKey(anchorMonth, offset));

  // Thu thập tối đa 6 tháng tính đến anchorMonth để tìm các tháng có dữ liệu thực tế
  const lookback6Keys = [-5, -4, -3, -2, -1, 0].map((offset) => shiftMonthKey(anchorMonth, offset));

  interface MonthBucket {
    month: string;
    income: number;
    expense: number;
    discretionaryIncome: number;
    discretionaryExpense: number;
    recurringExpense: number;
  }

  const bucketsByMonth = new Map<string, MonthBucket>();

  for (const mKey of lookback6Keys) {
    const mTxs = scopedTxs.filter((tx) => tx.date.startsWith(mKey));
    const incSplit = splitMonthRecurringVsDiscretionary(mTxs, activeRules, "INCOME");
    const expSplit = splitMonthRecurringVsDiscretionary(mTxs, activeRules, "EXPENSE");

    bucketsByMonth.set(mKey, {
      month: mKey,
      income: incSplit.total,
      expense: expSplit.total,
      discretionaryIncome: incSplit.discretionary,
      discretionaryExpense: expSplit.discretionary,
      recurringExpense: expSplit.recurringMatched,
    });
  }

  const activeBuckets = lookback6Keys
    .map((m) => bucketsByMonth.get(m)!)
    .filter((b) => b.income > 0 || b.expense > 0);

  const weightingBuckets = activeBuckets.slice(-3);
  const hasHistoricalData = weightingBuckets.length > 0 || activeRules.length > 0;
  const monthsAnalyzed = weightingBuckets.length;

  // Trọng số ưu tiên tháng gần nhất: [0.2, 0.3, 0.5]
  const rawWeights =
    weightingBuckets.length === 1
      ? [1]
      : weightingBuckets.length === 2
      ? [0.35, 0.65]
      : weightingBuckets.length === 3
      ? [0.2, 0.3, 0.5]
      : [];

  let weightedDiscretionaryIncome = 0;
  let weightedDiscretionaryExpense = 0;
  let historicalAvgIncome = 0;
  let historicalAvgExpense = 0;

  if (weightingBuckets.length > 0) {
    for (let i = 0; i < weightingBuckets.length; i++) {
      const w = rawWeights[i];
      const b = weightingBuckets[i];
      weightedDiscretionaryIncome += b.discretionaryIncome * w;
      weightedDiscretionaryExpense += b.discretionaryExpense * w;
      historicalAvgIncome += b.income / weightingBuckets.length;
      historicalAvgExpense += b.expense / weightingBuckets.length;
    }
  }

  weightedDiscretionaryIncome = Math.round(weightedDiscretionaryIncome);
  weightedDiscretionaryExpense = Math.round(weightedDiscretionaryExpense);
  historicalAvgIncome = Math.round(historicalAvgIncome);
  historicalAvgExpense = Math.round(historicalAvgExpense);

  // Tính hệ số xu hướng tháng trên phần chi linh hoạt (nếu có >= 2 tháng có chi tiêu)
  const expenseActiveBuckets = weightingBuckets.filter((b) => b.expense > 0);
  let monthlyMomentum = 0;
  if (expenseActiveBuckets.length >= 2) {
    const first = expenseActiveBuckets[0].expense;
    const last = expenseActiveBuckets[expenseActiveBuckets.length - 1].expense;
    const steps = expenseActiveBuckets.length - 1;
    if (first > 0) {
      const rawSlope = (last - first) / (first * steps);
      // Giới hạn an toàn [-5%, +5%] mỗi tháng để dự báo thực tế, không bị nhiễu quá mức
      monthlyMomentum = Math.max(-0.05, Math.min(0.05, rawSlope));
    }
  }

  const baseIncome =
    recurringIncomeBaseline > 0
      ? recurringIncomeBaseline + weightedDiscretionaryIncome
      : historicalAvgIncome;

  const forecastMonths: ForecastMonthProjection[] = ([1, 2, 3] as const).map((horizon) => {
    const mKey = shiftMonthKey(anchorMonth, horizon);
    const discretionaryAdjusted = Math.max(
      0,
      Math.round(weightedDiscretionaryExpense * Math.pow(1 + monthlyMomentum, horizon))
    );
    const predictedExpense = recurringExpenseBaseline + discretionaryAdjusted;
    const predictedIncome = Math.max(0, Math.round(baseIncome));
    const projectedSavings = predictedIncome - predictedExpense;
    const savingsRate =
      predictedIncome > 0 ? Math.round((projectedSavings / predictedIncome) * 100) : 0;

    let riskLevel: ForecastRiskLevel = "SAFE";
    let riskLabel = "Cân đối tốt";
    if (predictedIncome > 0 && (projectedSavings < 0 || savingsRate < 10)) {
      riskLevel = "TIGHT";
      riskLabel = projectedSavings < 0 ? "Nguy cơ bội chi" : "Biên tiết kiệm mỏng";
    } else if (predictedIncome > 0 && savingsRate < 25) {
      riskLevel = "WATCH";
      riskLabel = "Cần theo dõi";
    } else if (predictedIncome === 0 && predictedExpense > 0) {
      riskLevel = "WATCH";
      riskLabel = "Chưa có nguồn thu";
    }

    return {
      month: mKey,
      shortLabel: formatShortMonthLabel(mKey),
      monthLabel: getMonthDisplayLabel(mKey),
      horizonIndex: horizon,
      predictedIncome,
      recurringIncome: recurringIncomeBaseline,
      discretionaryIncome: weightedDiscretionaryIncome,
      predictedExpense,
      recurringExpense: recurringExpenseBaseline,
      discretionaryExpense: discretionaryAdjusted,
      projectedSavings,
      savingsRate,
      riskLevel,
      riskLabel,
    };
  });

  // Xây dựng chuỗi dữ liệu 6 điểm cho Recharts (3 tháng lịch sử + 3 tháng dự báo nối tiếp mượt tại anchorMonth)
  const chartSeries: ForecastChartPoint[] = [
    ...recent3MonthKeys.map((mKey, idx) => {
      const b = bucketsByMonth.get(mKey) || {
        month: mKey,
        income: 0,
        expense: 0,
        discretionaryIncome: 0,
        discretionaryExpense: 0,
        recurringExpense: 0,
      };
      const isAnchor = idx === recent3MonthKeys.length - 1;
      return {
        month: mKey,
        shortLabel: formatShortMonthLabel(mKey),
        monthLabel: getMonthDisplayLabel(mKey),
        isForecast: false,
        actualIncome: b.income,
        actualExpense: b.expense,
        forecastIncome: isAnchor ? b.income : null,
        forecastExpense: isAnchor ? b.expense : null,
        recurringExpense: b.recurringExpense,
        discretionaryExpense: b.discretionaryExpense,
        projectedSavings: b.income - b.expense,
      };
    }),
    ...forecastMonths.map((f) => ({
      month: f.month,
      shortLabel: f.shortLabel,
      monthLabel: f.monthLabel,
      isForecast: true,
      actualIncome: null,
      actualExpense: null,
      forecastIncome: f.predictedIncome,
      forecastExpense: f.predictedExpense,
      recurringExpense: f.recurringExpense,
      discretionaryExpense: f.discretionaryExpense,
      projectedSavings: f.projectedSavings,
    })),
  ];

  // Top danh mục dẫn dắt chi tiêu từ dữ liệu lịch sử (Financial Insights drivers)
  const driverWindowKeys = new Set(weightingBuckets.map((b) => b.month));
  const categorySums = new Map<string, number>();
  const recurringCatIds = new Set(
    activeRules.filter((r) => r.type === "EXPENSE").map((r) => r.categoryId)
  );
  let totalWindowExpense = 0;

  for (const tx of scopedTxs) {
    if (tx.type !== "EXPENSE") continue;
    const txMonth = tx.date.slice(0, 7);
    if (!driverWindowKeys.has(txMonth)) continue;
    categorySums.set(tx.categoryId, (categorySums.get(tx.categoryId) || 0) + tx.amount);
    totalWindowExpense += tx.amount;
  }

  const divisor = Math.max(1, weightingBuckets.length);
  const topDrivers: ForecastCategoryDriver[] = Array.from(categorySums.entries())
    .map(([categoryId, sum]) => {
      const cat = categoryMap.get(categoryId);
      const avgMonthlyAmount = Math.round(sum / divisor);
      return {
        categoryId,
        categoryName: cat?.name || "Khác",
        categoryColor: cat?.color || "#64748B",
        avgMonthlyAmount,
        sharePct: totalWindowExpense > 0 ? Math.round((sum / totalWindowExpense) * 100) : 0,
        isRecurringDominant: recurringCatIds.has(categoryId),
      };
    })
    .sort((a, b) => b.avgMonthlyAmount - a.avgMonthlyAmount)
    .slice(0, 5);

  // Kiểm tra ngân sách tháng neo có danh mục sắp chạm/vượt ngưỡng >= 80%
  const anchorCatSpend = new Map<string, number>();
  for (const tx of scopedTxs) {
    if (tx.type === "EXPENSE" && tx.date.startsWith(anchorMonth)) {
      anchorCatSpend.set(tx.categoryId, (anchorCatSpend.get(tx.categoryId) || 0) + tx.amount);
    }
  }
  const budgetWarnings = budgets
    .filter((b) => b.month === anchorMonth && b.limitAmount > 0)
    .map((b) => {
      const spent = anchorCatSpend.get(b.categoryId) || 0;
      const pct = Math.round((spent / b.limitAmount) * 100);
      return {
        pct,
        name: categoryMap.get(b.categoryId)?.name || b.categoryId,
      };
    })
    .filter((x) => x.pct >= 80)
    .sort((a, b) => b.pct - a.pct)
    .map((x) => `${x.name} (${x.pct}%)`);

  const total3MonthProjectedIncome = forecastMonths.reduce((s, m) => s + m.predictedIncome, 0);
  const total3MonthProjectedExpense = forecastMonths.reduce((s, m) => s + m.predictedExpense, 0);
  const total3MonthProjectedSavings = total3MonthProjectedIncome - total3MonthProjectedExpense;

  return {
    anchorMonth,
    anchorMonthLabel: getMonthDisplayLabel(anchorMonth),
    perspective,
    hasHistoricalData,
    monthsAnalyzed,
    historicalAvgIncome,
    historicalAvgExpense,
    recurringIncomeBaseline,
    recurringExpenseBaseline,
    discretionaryExpenseBaseline: weightedDiscretionaryExpense,
    monthlyGrowthRatePct: Math.round(monthlyMomentum * 1000) / 10,
    forecastMonths,
    chartSeries,
    topDrivers,
    budgetWarnings,
    total3MonthProjectedIncome,
    total3MonthProjectedExpense,
    total3MonthProjectedSavings,
  };
}
