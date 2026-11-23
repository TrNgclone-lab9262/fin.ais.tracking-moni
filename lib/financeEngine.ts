import {
  Account,
  Category,
  DebtItem,
  FamilyMember,
  GoldPortfolioState,
  InvestmentItem,
  MortgageContract,
  Transaction,
} from "@/types/finance";
import { recalculateAccountBalances } from "./storage";
import { computeGoldPortfolioMetrics } from "./goldEngine";
import { generateMortgageSchedule } from "./mortgageEngine";

export type PerspectiveFilter = "ALL" | "HUSBAND" | "WIFE";

export interface CreditCardCycleStatus {
  account: Account;
  creditLimit: number;
  usedAmount: number;
  availableAmount: number;
  usagePercentage: number;
  statementDay: number;
  dueDay: number;
  dueDateDisplay: string;
  statusLevel: "SAFE" | "WATCH" | "WARNING" | "DANGER";
  statusLabel: string;
  safeCapAmount: number; // 30% guardrail amount
}

export interface BalanceTrendPoint {
  monthKey: string;
  key: string;
  balance: number;
}

export interface DailyCumulativePoint {
  day: string;
  amount: number;
}

export interface HeatmapDay {
  day: number;
  amount: number;
  level: "zero" | "low" | "medium" | "high";
}

export interface CoupleSettlementResult {
  totalSharedExpense: number;
  husbandPaid: number;
  wifePaid: number;
  husbandSharePct: number;
  wifeSharePct: number;
  husbandExpected: number;
  wifeExpected: number;
  fromMember: "HUSBAND" | "WIFE" | "BALANCED";
  toMember: "HUSBAND" | "WIFE" | "BALANCED";
  transferAmount: number;
}

export interface LedgerIntegrityResult {
  isValid: boolean;
  checkedAccounts: number;
  mismatches: {
    accountId: string;
    accountName: string;
    storedBalance: number;
    computedBalance: number;
  }[];
}

export function formatMonthKeyFromDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function formatISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getDaysInMonth(monthKey: string): number {
  const parts = monthKey.split("-");
  if (parts.length !== 2) return 30;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) return 30;
  return new Date(year, month, 0).getDate();
}

export function shiftMonthKey(monthKey: string, deltaMonths: number): string {
  const [yStr, mStr] = monthKey.split("-");
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(y) || isNaN(m)) return monthKey;
  const d = new Date(y, m - 1 + deltaMonths, 1);
  return formatMonthKeyFromDate(d);
}

export function matchesPerspectiveMember(
  memberId: FamilyMember,
  perspective: PerspectiveFilter
): boolean {
  if (perspective === "ALL") return true;
  return memberId === perspective;
}

export function matchesPerspectiveAccount(
  account: Account,
  perspective: PerspectiveFilter
): boolean {
  if (perspective === "ALL") return true;
  return account.owner === perspective || account.owner === "SHARED";
}

/**
 * Tính số ngày còn lại thích ứng trong tháng theo PROJECT_STATE.md
 * - Nếu tháng đang chọn là tháng hiện tại: DaysInMonth - CurrentDay + 1
 * - Nếu tháng đang chọn là tháng quá khứ: dựa trên ngày phát sinh GD cuối cùng trong tháng (tối thiểu 1 ngày)
 * - Nếu là tháng tương lai: toàn bộ số ngày của tháng
 */
export function calculateDaysRemainingInMonth(
  selectedMonth: string,
  transactions: Transaction[],
  now: Date = new Date()
): number {
  const currentMonthKey = formatMonthKeyFromDate(now);
  const targetMonth = selectedMonth === "ALL" ? currentMonthKey : selectedMonth;
  const daysInMonth = getDaysInMonth(targetMonth);

  if (targetMonth === currentMonthKey) {
    return Math.max(1, daysInMonth - now.getDate() + 1);
  }

  if (targetMonth < currentMonthKey) {
    let maxDay = 0;
    for (const tx of transactions) {
      if (tx.date.startsWith(targetMonth)) {
        const d = parseInt(tx.date.split("-")[2] || "0", 10);
        if (d > maxDay) maxDay = d;
      }
    }
    if (maxDay > 0) {
      return Math.max(1, daysInMonth - maxDay + 1);
    }
    return 1;
  }

  return daysInMonth;
}

/**
 * Tính số tiền đã chi hôm nay (hoặc ngày phát sinh gần nhất trong tháng đang xem)
 */
export function calculateTodaySpent(
  transactions: Transaction[],
  perspective: PerspectiveFilter,
  selectedMonth: string,
  now: Date = new Date()
): { amount: number; referenceDate: string; isCurrentDay: boolean } {
  const currentMonthKey = formatMonthKeyFromDate(now);
  const todayISO = formatISODate(now);
  const targetMonth = selectedMonth === "ALL" ? currentMonthKey : selectedMonth;

  if (targetMonth === currentMonthKey || selectedMonth === "ALL") {
    const todayExpenses = transactions.filter(
      (tx) =>
        tx.type === "EXPENSE" &&
        tx.date === todayISO &&
        matchesPerspectiveMember(tx.memberId, perspective)
    );
    if (todayExpenses.length > 0 || targetMonth === currentMonthKey) {
      return {
        amount: todayExpenses.reduce((s, t) => s + t.amount, 0),
        referenceDate: todayISO,
        isCurrentDay: true,
      };
    }
  }

  // Fallback sang ngày chi tiêu gần nhất của tháng được chọn (hữu ích cho dữ liệu lịch sử)
  let latestDate = "";
  for (const tx of transactions) {
    if (
      tx.type === "EXPENSE" &&
      (selectedMonth === "ALL" || tx.date.startsWith(targetMonth)) &&
      matchesPerspectiveMember(tx.memberId, perspective)
    ) {
      if (tx.date > latestDate) latestDate = tx.date;
    }
  }

  if (!latestDate) {
    return { amount: 0, referenceDate: `${targetMonth}-01`, isCurrentDay: false };
  }

  const amount = transactions
    .filter(
      (tx) =>
        tx.type === "EXPENSE" &&
        tx.date === latestDate &&
        matchesPerspectiveMember(tx.memberId, perspective)
    )
    .reduce((s, t) => s + t.amount, 0);

  return { amount, referenceDate: latestDate, isCurrentDay: false };
}

/**
 * Tính trạng thái an toàn thẻ tín dụng BIDV theo Invariant 2 (Mốc an toàn <= 30%)
 */
export function calculateCreditCardCycleInfo(
  account: Account,
  selectedMonth?: string
): CreditCardCycleStatus {
  const limit = account.creditLimit || (account.owner === "WIFE" ? 20_000_000 : 50_000_000);
  const used = Math.max(0, account.currentBalance);
  const available = Math.max(0, limit - used);
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const statementDay = account.statementDay || 20;
  const dueDay = account.dueDay || 6;

  // Tính ngày đến hạn thanh toán (tháng kế tiếp nếu là sao kê ngày 20 -> hạn trả ngày 06 tháng sau)
  let dueDateDisplay = `${String(dueDay).padStart(2, "0")} hàng tháng`;
  if (selectedMonth && /^\d{4}-\d{2}$/.test(selectedMonth)) {
    const nextMonth = shiftMonthKey(selectedMonth, 1);
    const nextMonthNum = nextMonth.split("-")[1];
    dueDateDisplay = `${String(dueDay).padStart(2, "0")}/${nextMonthNum}`;
  }

  let statusLevel: CreditCardCycleStatus["statusLevel"] = "SAFE";
  let statusLabel = "An toàn ≤30%";

  if (pct >= 90) {
    statusLevel = "DANGER";
    statusLabel = "Nguy cơ cao";
  } else if (pct >= 70) {
    statusLevel = "WARNING";
    statusLabel = "Cảnh báo >70%";
  } else if (pct > 30) {
    statusLevel = "WATCH";
    statusLabel = "Chú ý >30%";
  }

  return {
    account,
    creditLimit: limit,
    usedAmount: used,
    availableAmount: available,
    usagePercentage: pct,
    statementDay,
    dueDay,
    dueDateDisplay,
    statusLevel,
    statusLabel,
    safeCapAmount: Math.round(limit * 0.3),
  };
}

/**
 * Tính 3 chuỗi đồ thị đường động từ Event Sourcing thực tế
 */
export function calculateBalanceAndCumulativeTrends(
  accounts: Account[],
  transactions: Transaction[],
  selectedMonth: string,
  perspective: PerspectiveFilter
): {
  balanceTrend: BalanceTrendPoint[];
  expenseCumulative: DailyCumulativePoint[];
  incomeCumulative: DailyCumulativePoint[];
  targetMonth: string;
} {
  // Xác định tháng đích
  let targetMonth = selectedMonth;
  if (targetMonth === "ALL") {
    const sorted = [...transactions].sort((a, b) => b.date.localeCompare(a.date));
    targetMonth = sorted[0]?.date.slice(0, 7) || formatMonthKeyFromDate(new Date());
  }

  // 1. Xu hướng số dư thanh khoản 6 tháng gần nhất kết thúc ở targetMonth
  const liquidAccounts = accounts.filter(
    (a) => a.type !== "CREDIT_CARD" && matchesPerspectiveAccount(a, perspective)
  );
  const liquidAccountIds = new Set(liquidAccounts.map((a) => a.id));
  const initialTotal = liquidAccounts.reduce((sum, a) => sum + a.initialBalance, 0);

  const monthKeys: string[] = [];
  for (let i = -5; i <= 0; i++) {
    monthKeys.push(shiftMonthKey(targetMonth, i));
  }

  const balanceTrend: BalanceTrendPoint[] = monthKeys.map((mk) => {
    const endDate = `${mk}-${String(getDaysInMonth(mk)).padStart(2, "0")}`;
    let netDelta = 0;

    for (const tx of transactions) {
      if (tx.date > endDate) continue;
      if (tx.type === "INCOME" && liquidAccountIds.has(tx.accountId)) {
        netDelta += tx.amount;
      } else if (tx.type === "EXPENSE" && liquidAccountIds.has(tx.accountId)) {
        netDelta -= tx.amount;
      } else if (tx.type === "TRANSFER") {
        if (liquidAccountIds.has(tx.accountId)) netDelta -= tx.amount;
        if (tx.toAccountId && liquidAccountIds.has(tx.toAccountId)) netDelta += tx.amount;
      }
    }

    const monthNum = parseInt(mk.split("-")[1], 10);
    return {
      monthKey: mk,
      key: `T${monthNum}`,
      balance: Math.max(0, initialTotal + netDelta),
    };
  });

  // 2 & 3. Lũy kế chi & thu theo ngày trong targetMonth
  const daysInMonth = getDaysInMonth(targetMonth);
  const checkpoints = [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, daysInMonth].filter(
    (d, idx, arr) => d <= daysInMonth && arr.indexOf(d) === idx
  );

  const monthTxs = transactions.filter(
    (tx) =>
      tx.date.startsWith(targetMonth) &&
      matchesPerspectiveMember(tx.memberId, perspective)
  );

  const expenseCumulative: DailyCumulativePoint[] = checkpoints.map((day) => {
    const cutoff = `${targetMonth}-${String(day).padStart(2, "0")}`;
    const total = monthTxs
      .filter((tx) => tx.type === "EXPENSE" && tx.date <= cutoff)
      .reduce((s, t) => s + t.amount, 0);
    return { day: `${day}`, amount: total };
  });

  const incomeCumulative: DailyCumulativePoint[] = checkpoints.map((day) => {
    const cutoff = `${targetMonth}-${String(day).padStart(2, "0")}`;
    const total = monthTxs
      .filter((tx) => tx.type === "INCOME" && tx.date <= cutoff)
      .reduce((s, t) => s + t.amount, 0);
    return { day: `${day}`, amount: total };
  });

  return {
    balanceTrend,
    expenseCumulative,
    incomeCumulative,
    targetMonth,
  };
}

/**
 * Bản đồ nhiệt chi tiêu các ngày trong tháng (28/29/30/31 ngày động)
 */
export function calculateHeatmapDays(
  transactions: Transaction[],
  selectedMonth: string,
  perspective: PerspectiveFilter
): {
  days: HeatmapDay[];
  targetMonth: string;
  peakDay: number | null;
  peakAmount: number;
  activeDaysCount: number;
} {
  let targetMonth = selectedMonth;
  if (targetMonth === "ALL") {
    const sorted = [...transactions].sort((a, b) => b.date.localeCompare(a.date));
    targetMonth = sorted[0]?.date.slice(0, 7) || formatMonthKeyFromDate(new Date());
  }

  const totalDays = getDaysInMonth(targetMonth);
  const daysMap = new Map<number, number>();
  for (let i = 1; i <= totalDays; i++) daysMap.set(i, 0);

  for (const tx of transactions) {
    if (
      tx.type === "EXPENSE" &&
      tx.date.startsWith(targetMonth) &&
      matchesPerspectiveMember(tx.memberId, perspective)
    ) {
      const day = parseInt(tx.date.split("-")[2] || "0", 10);
      if (day >= 1 && day <= totalDays) {
        daysMap.set(day, (daysMap.get(day) || 0) + tx.amount);
      }
    }
  }

  let peakDay: number | null = null;
  let peakAmount = 0;
  let activeDaysCount = 0;

  const days: HeatmapDay[] = Array.from(daysMap.entries()).map(([day, amount]) => {
    if (amount > 0) activeDaysCount++;
    if (amount > peakAmount) {
      peakAmount = amount;
      peakDay = day;
    }

    let level: HeatmapDay["level"] = "zero";
    if (amount > 0 && amount <= 500_000) level = "low";
    else if (amount > 500_000 && amount <= 2_000_000) level = "medium";
    else if (amount > 2_000_000) level = "high";

    return { day, amount, level };
  });

  return { days, targetMonth, peakDay, peakAmount, activeDaysCount };
}

/**
 * Tính toán bù trừ chi tiêu chung (Shared Couple Settlement)
 */
export function calculateCoupleSettlement(
  transactions: Transaction[],
  selectedMonth: string,
  husbandSharePct: number = 50
): CoupleSettlementResult {
  const clampedPct = Math.min(100, Math.max(0, husbandSharePct));
  const wifeSharePct = 100 - clampedPct;

  let husbandPaid = 0;
  let wifePaid = 0;

  for (const tx of transactions) {
    if (tx.type !== "EXPENSE" || tx.scope !== "FAMILY") continue;
    if (selectedMonth !== "ALL" && !tx.date.startsWith(selectedMonth)) continue;

    if (tx.memberId === "HUSBAND") husbandPaid += tx.amount;
    else if (tx.memberId === "WIFE") wifePaid += tx.amount;
  }

  const totalSharedExpense = husbandPaid + wifePaid;
  const husbandExpected = Math.round((totalSharedExpense * clampedPct) / 100);
  const wifeExpected = totalSharedExpense - husbandExpected;

  const diff = husbandPaid - husbandExpected;
  if (Math.abs(diff) < 1000) {
    return {
      totalSharedExpense,
      husbandPaid,
      wifePaid,
      husbandSharePct: clampedPct,
      wifeSharePct,
      husbandExpected,
      wifeExpected,
      fromMember: "BALANCED",
      toMember: "BALANCED",
      transferAmount: 0,
    };
  }

  return {
    totalSharedExpense,
    husbandPaid,
    wifePaid,
    husbandSharePct: clampedPct,
    wifeSharePct,
    husbandExpected,
    wifeExpected,
    fromMember: diff > 0 ? "WIFE" : "HUSBAND",
    toMember: diff > 0 ? "HUSBAND" : "WIFE",
    transferAmount: Math.abs(diff),
  };
}

/**
 * Kiểm toán tính toàn vẹn Event Sourcing giữa số dư ví và chuỗi giao dịch
 */
export function calculateLedgerIntegrity(
  accounts: Account[],
  transactions: Transaction[]
): LedgerIntegrityResult {
  const recomputed = recalculateAccountBalances(accounts, transactions);
  const mismatches: LedgerIntegrityResult["mismatches"] = [];

  for (let i = 0; i < accounts.length; i++) {
    const stored = accounts[i];
    const calc = recomputed[i];
    if (Math.round(stored.currentBalance) !== Math.round(calc.currentBalance)) {
      mismatches.push({
        accountId: stored.id,
        accountName: stored.name,
        storedBalance: stored.currentBalance,
        computedBalance: calc.currentBalance,
      });
    }
  }

  return {
    isValid: mismatches.length === 0,
    checkedAccounts: accounts.length,
    mismatches,
  };
}

/**
 * Chuẩn hóa mã danh mục từ AI / alias cũ về ID chuẩn trong DEFAULT_CATEGORIES
 */
export function resolveCategorySlugToId(
  rawCategory: string | undefined,
  categories: Category[]
): string {
  if (!rawCategory) return "cat_expense_food";

  const exact = categories.find((c) => c.id === rawCategory);
  if (exact) return exact.id;

  const aliasMap: Record<string, string> = {
    cat_food: "cat_expense_food",
    cat_shopping: "cat_expense_shopping",
    cat_transport: "cat_expense_transport",
    cat_bills: "cat_expense_bills",
    cat_house: "cat_expense_rent",
    cat_rent: "cat_expense_rent",
    cat_medical: "cat_expense_health",
    cat_health: "cat_expense_health",
    cat_entertainment: "cat_expense_entertainment",
    cat_education: "cat_expense_other",
    cat_other: "cat_expense_other",
  };

  const mapped = aliasMap[rawCategory.toLowerCase()];
  if (mapped && categories.some((c) => c.id === mapped)) {
    return mapped;
  }

  const byName = categories.find((c) =>
    c.name.toLowerCase().includes(rawCategory.toLowerCase())
  );
  if (byName) return byName.id;

  return categories.find((c) => c.type === "EXPENSE")?.id || "cat_expense_food";
}

// ---------------------------------------------------------------------------
// UNIFIED HOUSEHOLD NET WORTH SELECTOR (FINANCE + GOLD + SKYONE)
// ---------------------------------------------------------------------------
export interface UnifiedHouseholdNetWorth {
  /** Tiền mặt, tài khoản ngân hàng, ví điện tử (không gồm thẻ tín dụng) */
  liquidCashVnd: number;
  /** Danh mục đầu tư khác trong FINANCE (tránh cộng trùng nếu người dùng đang quản vàng tại Sub-App GOLD) */
  otherInvestmentsVnd: number;
  /** Giá trị thanh khoản Kho Vàng theo giá Mua vào (Bid Valuation) */
  goldBidValueVnd: number;
  /** Khoản cho vay đang chờ thu hồi (LEND) */
  receivablesVnd: number;
  /** Vốn chủ sở hữu BĐS SKYONE = Giá trị thị trường ước tính - Dư nợ vay còn lại */
  skyoneEquityVnd: number;
  skyonePropertyValueVnd: number;
  skyoneRemainingDebtVnd: number;
  /** Tổng dư nợ thẻ tín dụng BIDV */
  creditCardDebtVnd: number;
  /** Khoản nợ ngắn hạn khác (BORROW chưa trả) */
  shortTermDebtVnd: number;
  /** Tổng nợ ngắn hạn (Thẻ tín dụng + Nợ vay ngoài BĐS) */
  totalShortTermLiabilitiesVnd: number;
  /** Tài sản ròng thanh khoản nhanh (Tiền + Đầu tư + Kho Vàng Bid + Cho vay - Nợ thẻ & Nợ ngắn hạn) */
  liquidNetWorthVnd: number;
  /** Tổng Gia Sản Hộ Gia Đình Hợp Nhất (gồm cả Vốn chủ sở hữu BĐS SKYONE) */
  totalHouseholdNetWorthVnd: number;
  /** Tổng gộp tài sản dương (mẫu số tính tỷ trọng) */
  grossAssetsVnd: number;
  /** Tỷ trọng từng khối tài sản (%) */
  sharesPct: {
    cash: number;
    investments: number;
    gold: number;
    realEstateEquity: number;
  };
}

export function computeUnifiedHouseholdNetWorth(input: {
  accounts: Account[];
  investments: InvestmentItem[];
  debts: DebtItem[];
  goldPortfolio: GoldPortfolioState;
  skyoneLoan: MortgageContract;
}): UnifiedHouseholdNetWorth {
  const liquidCashVnd = input.accounts
    .filter((a) => a.type !== "CREDIT_CARD")
    .reduce((sum, a) => sum + (Number.isFinite(a.currentBalance) ? a.currentBalance : 0), 0);

  const creditCardDebtVnd = input.accounts
    .filter((a) => a.type === "CREDIT_CARD")
    .reduce((sum, a) => sum + Math.max(0, Number.isFinite(a.currentBalance) ? a.currentBalance : 0), 0);

  const goldMetrics = computeGoldPortfolioMetrics(input.goldPortfolio);
  const goldBidValueVnd = Math.max(0, Math.round(goldMetrics.totalLiquidationValueBid));
  const hasGoldVaultHoldings = goldMetrics.totalRemainingChi > 0.0001;

  // Nếu gia đình đã quản trị vàng chuyên sâu tại Sub-App GOLD, loại trừ mục type === 'GOLD'
  // cũ trong bảng investments để tuyệt đối không đếm trùng tài sản vàng.
  const otherInvestmentsVnd = input.investments
    .filter((inv) => inv.status === "ACTIVE" && (!hasGoldVaultHoldings || inv.type !== "GOLD"))
    .reduce((sum, inv) => {
      const val = inv.currentValue !== undefined ? inv.currentValue : inv.amount;
      return sum + Math.max(0, Number.isFinite(val) ? val : 0);
    }, 0);

  const shortTermDebtVnd = input.debts
    .filter((d) => d.status === "ACTIVE" && d.type === "BORROW")
    .reduce((sum, d) => sum + Math.max(0, d.totalAmount - d.paidAmount), 0);

  const receivablesVnd = input.debts
    .filter((d) => d.status === "ACTIVE" && d.type === "LEND")
    .reduce((sum, d) => sum + Math.max(0, d.totalAmount - d.paidAmount), 0);

  const skySchedule = generateMortgageSchedule(input.skyoneLoan);
  const skyoneRemainingDebtVnd = Math.max(0, Math.round(skySchedule.remainingBalance));
  const skyonePropertyValueVnd = Math.max(
    0,
    Math.round(
      input.skyoneLoan.currentMarketValue && input.skyoneLoan.currentMarketValue > 0
        ? input.skyoneLoan.currentMarketValue
        : input.skyoneLoan.propertyValue
    )
  );
  const skyoneEquityVnd = Math.max(0, skyonePropertyValueVnd - skyoneRemainingDebtVnd);

  const totalShortTermLiabilitiesVnd = creditCardDebtVnd + shortTermDebtVnd;
  const liquidNetWorthVnd = Math.round(
    liquidCashVnd +
      otherInvestmentsVnd +
      goldBidValueVnd +
      receivablesVnd -
      totalShortTermLiabilitiesVnd
  );
  const totalHouseholdNetWorthVnd = Math.round(liquidNetWorthVnd + skyoneEquityVnd);

  const positiveCash = Math.max(0, liquidCashVnd);
  const grossAssetsVnd =
    positiveCash + otherInvestmentsVnd + goldBidValueVnd + skyoneEquityVnd;

  const pct = (part: number): number =>
    grossAssetsVnd > 0 ? Math.round((part / grossAssetsVnd) * 1000) / 10 : 0;

  return {
    liquidCashVnd: Math.round(liquidCashVnd),
    otherInvestmentsVnd: Math.round(otherInvestmentsVnd),
    goldBidValueVnd,
    receivablesVnd: Math.round(receivablesVnd),
    skyoneEquityVnd,
    skyonePropertyValueVnd,
    skyoneRemainingDebtVnd,
    creditCardDebtVnd: Math.round(creditCardDebtVnd),
    shortTermDebtVnd: Math.round(shortTermDebtVnd),
    totalShortTermLiabilitiesVnd: Math.round(totalShortTermLiabilitiesVnd),
    liquidNetWorthVnd,
    totalHouseholdNetWorthVnd,
    grossAssetsVnd: Math.round(grossAssetsVnd),
    sharesPct: {
      cash: pct(positiveCash),
      investments: pct(otherInvestmentsVnd),
      gold: pct(goldBidValueVnd),
      realEstateEquity: pct(skyoneEquityVnd),
    },
  };
}

