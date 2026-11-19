import {
  MortgageContract,
  MortgageInstallmentStatus,
  MortgagePaidInstallmentRecord,
  MortgagePeriodCashflowOverride,
  MortgagePrepayStrategy,
  MortgagePrepaymentPenaltyTier,
  MortgageStage,
  Transaction,
} from "@/types/finance";
import { SKYONE_A12A07_VERIFIED_FACTS } from "@/system_context";

export const MAX_MORTGAGE_TERM_YEARS = 30;
export const MAX_MORTGAGE_TERM_MONTHS = MAX_MORTGAGE_TERM_YEARS * 12;

export interface MortgageScheduleRow {
  period: number;
  dueDate: string;
  monthKey: string;
  yearIndex: number;
  stage: MortgageStage;
  appliedRate: number;
  isCustomRateAdjusted: boolean;
  rateNote?: string;
  openingBalance: number;
  principal: number;
  interest: number;
  totalPayment: number;
  prepaidInPeriod: number;
  disbursedInPeriod: number;
  closingBalance: number;
  cumulativePrincipalPaid: number;
  cumulativeInterestPaid: number;
  status: MortgageInstallmentStatus;
  daysUntilDue: number;
  dayCountUsed: number;
  paidRecord?: MortgagePaidInstallmentRecord;
  isVerified: boolean;
  verifiedSource?: string;
  isCashflowOverridden?: boolean;
  overrideNote?: string;
}

export interface MortgageYearlyAggregate {
  yearIndex: number;
  label: string;
  openingBalance: number;
  principalPaid: number;
  interestPaid: number;
  totalPaid: number;
  endingBalance: number;
  cumulativeEquity: number;
  equityPercent: number;
}

export interface MortgageScheduleSummary {
  rows: MortgageScheduleRow[];
  yearlySummary: MortgageYearlyAggregate[];
  remainingBalance: number;
  totalScheduledMonths: number;
  paidCount: number;
  verifiedCount: number;
  unpaidCount: number;
  overdueCount: number;
  dueSoonCount: number;
  totalPrincipalPaid: number;
  totalInterestPaid: number;
  totalPrepaidAmount: number;
  totalPrepaymentPenaltyPaid: number;
  totalProjectedInterest: number;
  totalProjectedCost: number;
  nextUnpaidInstallment: MortgageScheduleRow | null;
  currentReferencePeriod: number;
  estimatedPayoffDate: string;
  monthsShortenedFromOriginal: number;
  currentApplicableRate: number;
  currentStage: MortgageStage;
  remainingFixedMonths: number;
}

export interface PrepaymentSimulationResult {
  penaltyFeePercent: number;
  penaltyAmount: number;
  grossInterestSaved: number;
  netInterestSaved: number;
  monthsSaved: number;
  baselinePayoffDate: string;
  newPayoffDate: string;
  firstNextPaymentBefore: number;
  firstNextPaymentAfter: number;
  monthlyPaymentReduction: number;
  remainingBalanceBefore: number;
  remainingBalanceAfter: number;
  appliedAfterPeriod: number;
  loanYearAtExecution: number;
}

export interface RealEstateMetrics {
  propertyValue: number;
  currentMarketValue: number;
  equityContractAmount: number;
  equityContractPct: number;
  equityMarketAmount: number;
  equityMarketPct: number;
  ltvPct: number;
  monthlyFamilyIncome: number;
  incomeSourceLabel: string;
  currentMonthlyPayment: number;
  dtiPct: number;
  dtiStatus: "SAFE" | "WATCH" | "HIGH";
  dtiLabel: string;
}

export interface RateStressScenario {
  shockPercent: number;
  label: string;
  floatingRate: number;
  peakMonthlyPayment: number;
  firstFloatingPayment: number;
  monthlyDeltaFromCurrent: number;
  dtiPct: number;
  status: "SAFE" | "WATCH" | "HIGH";
}

export interface SkyOneReminderItem {
  id: string;
  severity: "danger" | "warning" | "info";
  title: string;
  message: string;
  targetPeriod?: number;
}

export function getTodayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addMonthsToDay(
  startDateStr: string,
  monthsToAdd: number,
  targetDay: number
): string {
  const parts = startDateStr.split("-").map((n) => parseInt(n, 10));
  const baseYear = parts[0] || 2025;
  const baseMonth = (parts[1] || 1) - 1; // 0-indexed

  const totalMonths = baseYear * 12 + baseMonth + monthsToAdd;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth = totalMonths % 12;

  const daysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  const clampedDay = Math.min(Math.max(1, targetDay), daysInTargetMonth);

  return `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}-${String(clampedDay).padStart(2, "0")}`;
}

export function diffDaysIso(fromDateStr: string, toDateStr: string): number {
  const [fy, fm, fd] = fromDateStr.split("-").map((n) => parseInt(n, 10));
  const [ty, tm, td] = toDateStr.split("-").map((n) => parseInt(n, 10));
  const fromUtc = Date.UTC(fy, (fm || 1) - 1, fd || 1);
  const toUtc = Date.UTC(ty, (tm || 1) - 1, td || 1);
  return Math.round((toUtc - fromUtc) / (1000 * 60 * 60 * 24));
}

export function getPenaltyRateForYear(
  yearNumber: number,
  tiers: MortgagePrepaymentPenaltyTier[]
): number {
  const matched = tiers.find(
    (t) => yearNumber >= t.fromYear && yearNumber <= t.toYear
  );
  return matched ? matched.feePercent : 0;
}

export function generateMortgageSchedule(
  contract: MortgageContract,
  referenceDate: string = getTodayIsoDate()
): MortgageScheduleSummary {
  const effectiveTermMonths = Math.max(
    1,
    Math.min(MAX_MORTGAGE_TERM_MONTHS, Math.round(contract.termMonths || MAX_MORTGAGE_TERM_MONTHS))
  );
  const effectiveFixedMonths = Math.max(0, Math.min(effectiveTermMonths, contract.fixedRateMonths));

  const paidMap = new Map<number, MortgagePaidInstallmentRecord>();
  contract.paidRecords.forEach((rec) => paidMap.set(rec.period, rec));

  const overrideMap = new Map<number, MortgagePeriodCashflowOverride>();
  (contract.periodOverrides || []).forEach((ov) => overrideMap.set(ov.period, ov));

  const sortedAdjustments = [...contract.rateAdjustments].sort(
    (a, b) => a.effectiveFromPeriod - b.effectiveFromPeriod
  );

  const prepayByPeriod = new Map<number, typeof contract.prepayments>();
  contract.prepayments.forEach((p) => {
    const arr = prepayByPeriod.get(p.afterPeriod) || [];
    arr.push(p);
    prepayByPeriod.set(p.afterPeriod, arr);
  });

  const plannedByPeriod = new Map<
    number,
    NonNullable<MortgageContract["plannedDisbursements"]>
  >();
  (contract.plannedDisbursements || []).forEach((d) => {
    const arr = plannedByPeriod.get(d.afterPeriod) || [];
    arr.push(d);
    plannedByPeriod.set(d.afterPeriod, arr);
  });

  const rows: MortgageScheduleRow[] = [];
  let remainingBalance = Math.max(0, contract.loanAmount);
  let scheduledMonthlyPrincipal =
    contract.monthlyPrincipalOverride && contract.monthlyPrincipalOverride > 0
      ? Math.round(contract.monthlyPrincipalOverride)
      : Math.round(contract.loanAmount / effectiveTermMonths);
  let totalPrepaidAmount = 0;
  let cumulativeDisbursed = Math.max(0, contract.loanAmount);

  // Handle period 0 prepayments if recorded before period 1
  const prepayZero = prepayByPeriod.get(0);
  if (prepayZero && prepayZero.length > 0) {
    for (const p of prepayZero) {
      const applied = Math.min(remainingBalance, p.amount);
      remainingBalance = Math.max(0, remainingBalance - applied);
      totalPrepaidAmount += applied;
      if (p.strategy === "REDUCE_MONTHLY" && remainingBalance > 0) {
        scheduledMonthlyPrincipal = Math.round(
          remainingBalance / effectiveTermMonths
        );
      }
    }
  }

  let cumulativePrincipalPaid = totalPrepaidAmount;
  let cumulativeInterestPaid = 0;
  let totalPrincipalPaidActual = totalPrepaidAmount;
  let totalInterestPaidActual = 0;
  let totalProjectedInterest = 0;
  let paidCount = 0;
  let verifiedCount = 0;
  let overdueCount = 0;
  let dueSoonCount = 0;
  let prevDueDateForDays = contract.disbursementDate;

  for (
    let period = 1;
    period <= effectiveTermMonths && remainingBalance > 0;
    period++
  ) {
    const periodOverride = overrideMap.get(period);
    const defaultDueDate = addMonthsToDay(
      contract.disbursementDate,
      period,
      contract.paymentDayOfMonth
    );
    const dueDate = periodOverride?.paidAt || defaultDueDate;
    const dayCountUsed = Math.max(1, diffDaysIso(prevDueDateForDays, dueDate));
    const monthKey = dueDate.slice(0, 7);
    const yearIndex = Math.ceil(period / 12);
    const stage: MortgageStage =
      period <= effectiveFixedMonths ? "FIXED" : "FLOATING";

    const paidRec = paidMap.get(period);
    const openingBalance = remainingBalance;

    let appliedRate =
      stage === "FIXED"
        ? contract.fixedInterestRate
        : contract.floatingBaseRate + contract.floatingSpread;
    let isCustomRateAdjusted = false;
    let rateNote: string | undefined;

    let principal = 0;
    let interest = 0;

    if (paidRec) {
      // Preserve historical snapshot unless explicitly overridden by unlocked cashflow edit
      appliedRate =
        periodOverride?.appliedRate !== undefined
          ? periodOverride.appliedRate
          : paidRec.appliedRate;
      principal = Math.min(
        openingBalance,
        Math.max(
          0,
          Math.round(
            periodOverride?.principal !== undefined
              ? periodOverride.principal
              : paidRec.paidPrincipal
          )
        )
      );
      interest = Math.max(
        0,
        Math.round(
          periodOverride?.interest !== undefined
            ? periodOverride.interest
            : paidRec.paidInterest
        )
      );
    } else {
      const activeAdj = [...sortedAdjustments]
        .reverse()
        .find((a) => a.effectiveFromPeriod <= period);
      if (activeAdj) {
        appliedRate = activeAdj.annualRate;
        isCustomRateAdjusted = true;
        rateNote = activeAdj.note;
      }

      if (periodOverride?.appliedRate !== undefined) {
        appliedRate = periodOverride.appliedRate;
        isCustomRateAdjusted = true;
        rateNote = periodOverride.note || "Điều chỉnh lãi suất thủ công";
      }

      if (periodOverride?.interest !== undefined) {
        interest = Math.max(0, Math.round(periodOverride.interest));
      } else if (contract.interestBasis === "ACTUAL_365") {
        interest = Math.round(
          (openingBalance * (appliedRate / 100) * dayCountUsed) / 365
        );
      } else {
        interest = Math.round((openingBalance * (appliedRate / 100)) / 12);
      }

      if (periodOverride?.principal !== undefined) {
        principal = Math.min(openingBalance, Math.max(0, Math.round(periodOverride.principal)));
      } else {
        const isFinalTerm = period === effectiveTermMonths;
        if (isFinalTerm || scheduledMonthlyPrincipal >= openingBalance) {
          principal = openingBalance;
        } else {
          principal = scheduledMonthlyPrincipal;
        }
      }
    }

    const closingBeforePrepay = Math.max(0, openingBalance - principal);
    let prepaidInPeriod = 0;
    const periodPrepays = prepayByPeriod.get(period);

    let closingBalance = closingBeforePrepay;
    if (periodPrepays && periodPrepays.length > 0 && closingBalance > 0) {
      for (const p of periodPrepays) {
        const applied = Math.min(closingBalance, p.amount);
        prepaidInPeriod += applied;
        closingBalance = Math.max(0, closingBalance - applied);
        totalPrepaidAmount += applied;

        if (p.strategy === "REDUCE_MONTHLY" && closingBalance > 0) {
          const remainingMonths = Math.max(1, effectiveTermMonths - period);
          scheduledMonthlyPrincipal = Math.round(closingBalance / remainingMonths);
        }
      }
    }

    // Planned progressive disbursement tranche (e.g. project handover tranche)
    let disbursedInPeriod = 0;
    const periodPlanned = plannedByPeriod.get(period);
    if (periodPlanned && periodPlanned.length > 0) {
      for (const d of periodPlanned) {
        if (d.amount > 0) {
          disbursedInPeriod += d.amount;
          closingBalance += d.amount;
          cumulativeDisbursed += d.amount;
          if (!contract.monthlyPrincipalOverride) {
            const remainingMonths = Math.max(1, effectiveTermMonths - period);
            scheduledMonthlyPrincipal = Math.round(closingBalance / remainingMonths);
          }
        }
      }
    }

    const totalPayment = principal + interest;
    cumulativeInterestPaid += interest;
    totalProjectedInterest += interest;

    if (paidRec) {
      cumulativePrincipalPaid += principal + prepaidInPeriod;
      totalPrincipalPaidActual += principal;
      totalInterestPaidActual += interest;
      paidCount += 1;
      if (paidRec.isVerified) {
        verifiedCount += 1;
      }
    } else {
      cumulativePrincipalPaid += prepaidInPeriod;
    }

    const daysUntilDue = diffDaysIso(referenceDate, dueDate);
    let status: MortgageInstallmentStatus = "UPCOMING";
    if (paidRec) {
      status = "PAID";
    } else if (daysUntilDue < 0) {
      status = "OVERDUE";
      overdueCount += 1;
    } else if (daysUntilDue <= 10) {
      status = "DUE_SOON";
      dueSoonCount += 1;
    }

    rows.push({
      period,
      dueDate,
      monthKey,
      yearIndex,
      stage,
      appliedRate,
      isCustomRateAdjusted,
      rateNote,
      openingBalance,
      principal,
      interest,
      totalPayment,
      prepaidInPeriod,
      disbursedInPeriod,
      closingBalance,
      cumulativePrincipalPaid,
      cumulativeInterestPaid,
      status,
      daysUntilDue,
      dayCountUsed,
      paidRecord: paidRec,
      isVerified: Boolean(paidRec?.isVerified),
      verifiedSource: paidRec?.verifiedSource,
      isCashflowOverridden: Boolean(periodOverride),
      overrideNote: periodOverride?.note,
    });

    remainingBalance = closingBalance;
    prevDueDateForDays = dueDate;
  }

  // Aggregate by Loan Year for Recharts
  const yearlyMap = new Map<number, MortgageYearlyAggregate>();
  let runningDisbursed = Math.max(0, contract.loanAmount);

  for (const row of rows) {
    runningDisbursed += row.disbursedInPeriod;
    const existing = yearlyMap.get(row.yearIndex) || {
      yearIndex: row.yearIndex,
      label: `Năm ${row.yearIndex}`,
      openingBalance: row.openingBalance,
      principalPaid: 0,
      interestPaid: 0,
      totalPaid: 0,
      endingBalance: row.closingBalance,
      cumulativeEquity: 0,
      equityPercent: 0,
    };

    existing.principalPaid += row.principal + row.prepaidInPeriod;
    existing.interestPaid += row.interest;
    existing.totalPaid += row.totalPayment + row.prepaidInPeriod;
    existing.endingBalance = row.closingBalance;
    const equityAmt = Math.min(
      contract.propertyValue,
      Math.max(0, contract.downPayment + (runningDisbursed - row.closingBalance))
    );
    existing.cumulativeEquity = equityAmt;
    existing.equityPercent =
      contract.propertyValue > 0
        ? Math.min(100, Math.round((equityAmt / contract.propertyValue) * 1000) / 10)
        : 0;

    yearlyMap.set(row.yearIndex, existing);
  }

  const yearlySummary = Array.from(yearlyMap.values()).sort(
    (a, b) => a.yearIndex - b.yearIndex
  );

  const nextUnpaidInstallment =
    rows.find((r) => r.status !== "PAID") || null;

  const actualRemainingBalance = nextUnpaidInstallment
    ? nextUnpaidInstallment.openingBalance
    : 0;

  const lastPaidPeriod =
    contract.paidRecords.length > 0
      ? Math.max(...contract.paidRecords.map((r) => r.period))
      : 0;

  const currentReferencePeriod = nextUnpaidInstallment
    ? nextUnpaidInstallment.period
    : rows[rows.length - 1]?.period || 1;

  const currentApplicableRate = nextUnpaidInstallment
    ? nextUnpaidInstallment.appliedRate
    : rows[rows.length - 1]?.appliedRate ?? contract.fixedInterestRate;

  const currentStage: MortgageStage = nextUnpaidInstallment
    ? nextUnpaidInstallment.stage
    : currentReferencePeriod <= contract.fixedRateMonths
    ? "FIXED"
    : "FLOATING";

  const remainingFixedMonths =
    currentStage === "FIXED"
      ? Math.max(0, contract.fixedRateMonths - lastPaidPeriod)
      : 0;

  const totalPrepaymentPenaltyPaid = contract.prepayments.reduce(
    (s, p) => s + p.penaltyAmount,
    0
  );

  return {
    rows,
    yearlySummary,
    remainingBalance: actualRemainingBalance,
    totalScheduledMonths: rows.length,
    paidCount,
    verifiedCount,
    unpaidCount: rows.length - paidCount,
    overdueCount,
    dueSoonCount,
    totalPrincipalPaid: totalPrincipalPaidActual,
    totalInterestPaid: totalInterestPaidActual,
    totalPrepaidAmount,
    totalPrepaymentPenaltyPaid,
    totalProjectedInterest,
    totalProjectedCost:
      cumulativeDisbursed + totalProjectedInterest + totalPrepaymentPenaltyPaid,
    nextUnpaidInstallment,
    currentReferencePeriod,
    estimatedPayoffDate:
      rows[rows.length - 1]?.dueDate || contract.disbursementDate,
    monthsShortenedFromOriginal: Math.max(0, effectiveTermMonths - rows.length),
    currentApplicableRate,
    currentStage,
    remainingFixedMonths,
  };
}

export function simulatePrepayment(
  contract: MortgageContract,
  params: {
    amount: number;
    afterPeriod?: number;
    strategy: MortgagePrepayStrategy;
    referenceDate?: string;
  }
): PrepaymentSimulationResult {
  const refDate = params.referenceDate || getTodayIsoDate();
  const baseline = generateMortgageSchedule(contract, refDate);
  const lastPaid =
    contract.paidRecords.length > 0
      ? Math.max(...contract.paidRecords.map((p) => p.period))
      : 0;

  const appliedAfterPeriod =
    params.afterPeriod !== undefined ? params.afterPeriod : lastPaid;

  const nextRowBefore =
    baseline.rows.find((r) => r.period > appliedAfterPeriod) ||
    baseline.nextUnpaidInstallment;

  const remainingBalanceBefore = nextRowBefore
    ? nextRowBefore.openingBalance
    : baseline.remainingBalance;

  const effectiveAmount = Math.max(
    0,
    Math.min(params.amount, remainingBalanceBefore)
  );

  const loanYearAtExecution = Math.max(1, Math.ceil((appliedAfterPeriod + 1) / 12));
  const penaltyFeePercent = getPenaltyRateForYear(
    loanYearAtExecution,
    contract.prepaymentPenaltyTiers
  );
  const penaltyAmount = Math.round(effectiveAmount * (penaltyFeePercent / 100));

  const simulatedContract: MortgageContract = {
    ...contract,
    prepayments: [
      ...contract.prepayments,
      {
        id: "sim_prepay",
        date: refDate,
        afterPeriod: appliedAfterPeriod,
        amount: effectiveAmount,
        penaltyAmount,
        feePercent: penaltyFeePercent,
        strategy: params.strategy,
      },
    ],
  };

  const simulated = generateMortgageSchedule(simulatedContract, refDate);
  const grossInterestSaved = Math.max(
    0,
    baseline.totalProjectedInterest - simulated.totalProjectedInterest
  );
  const netInterestSaved = grossInterestSaved - penaltyAmount;

  const nextRowAfter =
    simulated.rows.find((r) => r.period > appliedAfterPeriod) || null;

  const firstNextPaymentBefore = nextRowBefore?.totalPayment || 0;
  const firstNextPaymentAfter = nextRowAfter?.totalPayment || 0;

  return {
    penaltyFeePercent,
    penaltyAmount,
    grossInterestSaved,
    netInterestSaved,
    monthsSaved: Math.max(0, baseline.rows.length - simulated.rows.length),
    baselinePayoffDate: baseline.estimatedPayoffDate,
    newPayoffDate: simulated.estimatedPayoffDate,
    firstNextPaymentBefore,
    firstNextPaymentAfter,
    monthlyPaymentReduction: Math.max(
      0,
      firstNextPaymentBefore - firstNextPaymentAfter
    ),
    remainingBalanceBefore,
    remainingBalanceAfter: Math.max(0, remainingBalanceBefore - effectiveAmount),
    appliedAfterPeriod,
    loanYearAtExecution,
  };
}

export function calculateFamilyMonthlyIncome(
  transactions: Transaction[],
  selectedMonth: string
): { monthlyIncome: number; sourceLabel: string } {
  if (selectedMonth !== "ALL") {
    const monthIncome = transactions
      .filter((t) => t.type === "INCOME" && t.date.startsWith(selectedMonth))
      .reduce((s, t) => s + t.amount, 0);
    if (monthIncome > 0) {
      return {
        monthlyIncome: monthIncome,
        sourceLabel: `Thu nhập thực tế tháng ${selectedMonth}`,
      };
    }
  }

  const byMonth = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.type === "INCOME") {
      const m = tx.date.slice(0, 7);
      byMonth.set(m, (byMonth.get(m) || 0) + tx.amount);
    }
  }

  const monthTotals = Array.from(byMonth.values()).filter((v) => v > 0);
  if (monthTotals.length === 0) {
    return {
      monthlyIncome: 50_000_000,
      sourceLabel: "Ước tính mặc định gia đình (chưa có dữ liệu thu)",
    };
  }

  const avg = Math.round(
    monthTotals.reduce((s, v) => s + v, 0) / monthTotals.length
  );
  return {
    monthlyIncome: avg,
    sourceLabel: `Thu nhập bình quân ${monthTotals.length} tháng trong HOME MONI`,
  };
}

export function calculateRealEstateMetrics(
  contract: MortgageContract,
  schedule: MortgageScheduleSummary,
  monthlyFamilyIncome: number,
  incomeSourceLabel: string
): RealEstateMetrics {
  const remainingBalance = schedule.remainingBalance;
  const paidPrincipalViaLoan = Math.max(0, contract.loanAmount - remainingBalance);
  const equityContractAmount = Math.min(
    contract.propertyValue,
    contract.downPayment + paidPrincipalViaLoan
  );
  const equityContractPct =
    contract.propertyValue > 0
      ? Math.min(
          100,
          Math.round((equityContractAmount / contract.propertyValue) * 1000) / 10
        )
      : 0;

  const equityMarketAmount = Math.max(
    0,
    contract.currentMarketValue - remainingBalance
  );
  const equityMarketPct =
    contract.currentMarketValue > 0
      ? Math.min(
          100,
          Math.round((equityMarketAmount / contract.currentMarketValue) * 1000) /
            10
        )
      : 0;

  const ltvPct =
    contract.currentMarketValue > 0
      ? Math.round((remainingBalance / contract.currentMarketValue) * 1000) / 10
      : 0;

  const currentMonthlyPayment = schedule.nextUnpaidInstallment?.totalPayment || 0;
  const dtiPct =
    monthlyFamilyIncome > 0
      ? Math.round((currentMonthlyPayment / monthlyFamilyIncome) * 1000) / 10
      : 0;

  let dtiStatus: RealEstateMetrics["dtiStatus"] = "SAFE";
  let dtiLabel = "An toàn (≤ 30%)";
  if (dtiPct > 40) {
    dtiStatus = "HIGH";
    dtiLabel = "Áp lực cao (> 40%)";
  } else if (dtiPct > 30) {
    dtiStatus = "WATCH";
    dtiLabel = "Cân nhắc (31–40%)";
  }

  return {
    propertyValue: contract.propertyValue,
    currentMarketValue: contract.currentMarketValue,
    equityContractAmount,
    equityContractPct,
    equityMarketAmount,
    equityMarketPct,
    ltvPct,
    monthlyFamilyIncome,
    incomeSourceLabel,
    currentMonthlyPayment,
    dtiPct,
    dtiStatus,
    dtiLabel,
  };
}

export function calculateRateStressTest(
  contract: MortgageContract,
  baselineSchedule: MortgageScheduleSummary,
  monthlyFamilyIncome: number,
  shocks: number[] = [0, 1, 2, 3],
  referenceDate: string = getTodayIsoDate()
): RateStressScenario[] {
  const baseFloating = contract.floatingBaseRate + contract.floatingSpread;
  const currentPayment =
    baselineSchedule.nextUnpaidInstallment?.totalPayment || 0;

  return shocks.map((shock) => {
    const shockedContract: MortgageContract = {
      ...contract,
      floatingBaseRate: contract.floatingBaseRate + shock,
    };
    const shockedSchedule = generateMortgageSchedule(shockedContract, referenceDate);
    const floatingRows = shockedSchedule.rows.filter(
      (r) => r.status !== "PAID" && r.stage === "FLOATING"
    );
    const fallbackRows = shockedSchedule.rows.filter((r) => r.status !== "PAID");
    const targetRows = floatingRows.length > 0 ? floatingRows : fallbackRows;

    const firstFloatingPayment = targetRows[0]?.totalPayment || 0;
    const peakMonthlyPayment = targetRows.reduce(
      (max, r) => (r.totalPayment > max ? r.totalPayment : max),
      0
    );

    const refPay = peakMonthlyPayment || firstFloatingPayment;
    const dtiPct =
      monthlyFamilyIncome > 0
        ? Math.round((refPay / monthlyFamilyIncome) * 1000) / 10
        : 0;
    const status: RateStressScenario["status"] =
      dtiPct > 40 ? "HIGH" : dtiPct > 30 ? "WATCH" : "SAFE";

    return {
      shockPercent: shock,
      label: shock === 0 ? "Kịch bản chuẩn (+0%)" : `Biến động +${shock}%`,
      floatingRate: Math.round((baseFloating + shock) * 100) / 100,
      peakMonthlyPayment,
      firstFloatingPayment,
      monthlyDeltaFromCurrent: refPay - currentPayment,
      dtiPct,
      status,
    };
  });
}

export function evaluateSkyOneReminders(
  contract: MortgageContract,
  schedule: MortgageScheduleSummary
): SkyOneReminderItem[] {
  const reminders: SkyOneReminderItem[] = [];

  if (schedule.overdueCount > 0) {
    const firstOverdue = schedule.rows.find((r) => r.status === "OVERDUE");
    reminders.push({
      id: "skyone_overdue",
      severity: "danger",
      title: `Có ${schedule.overdueCount} kỳ trả góp đã quá hạn`,
      message: firstOverdue
        ? `Kỳ #${firstOverdue.period} (${firstOverdue.dueDate}) đang quá hạn ${Math.abs(
            firstOverdue.daysUntilDue
          )} ngày. Vui lòng đối soát và bấm Xác nhận đóng để tránh phí phạt chậm trả.`
        : "Có kỳ trả góp quá hạn cần xử lý.",
      targetPeriod: firstOverdue?.period,
    });
  }

  const nextRow = schedule.nextUnpaidInstallment;
  if (nextRow && nextRow.status === "DUE_SOON") {
    reminders.push({
      id: `skyone_due_soon_${nextRow.period}`,
      severity: "warning",
      title:
        nextRow.daysUntilDue === 0
          ? `Hôm nay đến hạn đóng kỳ #${nextRow.period}`
          : `Còn ${nextRow.daysUntilDue} ngày đến hạn kỳ #${nextRow.period} (${nextRow.dueDate})`,
      message: `Chuẩn bị nguồn tiền thanh toán cho ngân hàng ${contract.bankName} (kỳ thứ ${nextRow.period}/${schedule.totalScheduledMonths}).`,
      targetPeriod: nextRow.period,
    });
  }

  if (
    schedule.currentStage === "FIXED" &&
    schedule.remainingFixedMonths > 0 &&
    schedule.remainingFixedMonths <= 6
  ) {
    reminders.push({
      id: "skyone_fixed_ending",
      severity: "warning",
      title: `Sắp hết ưu đãi lãi cố định (còn ${schedule.remainingFixedMonths} tháng)`,
      message: `Từ kỳ #${
        contract.fixedRateMonths + 1
      }, lãi suất dự kiến chuyển sang thả nổi ${(
        contract.floatingBaseRate + contract.floatingSpread
      ).toFixed(2)}%/năm. Cân nhắc trích quỹ dự phòng hoặc trả bớt gốc trước hạn.`,
    });
  }

  return reminders;
}

export interface SkyOneTabSpecificMetrics {
  totalProjectedPrincipal: number;
  interestToPrincipalRatioPct: number;
  principalExceedsInterestPeriod: { period: number; dueDate: string } | null;
  currentLoanYear: number;
  currentPenaltyPercent: number;
  zeroPenaltyFromYear: number | null;
  actualPrepaymentInterestSaved: number;
  creditLimit: number;
  disbursedRatioPct: number;
  remainingCreditHeadroom: number;
}

export function calculateSkyOneTabMetrics(
  contract: MortgageContract,
  schedule: MortgageScheduleSummary,
  referenceDate: string = getTodayIsoDate()
): SkyOneTabSpecificMetrics {
  const totalProjectedPrincipal = schedule.rows.reduce(
    (sum, r) => sum + r.principal + r.prepaidInPeriod,
    0
  );
  const interestToPrincipalRatioPct =
    totalProjectedPrincipal > 0
      ? Math.round((schedule.totalProjectedInterest / totalProjectedPrincipal) * 1000) / 10
      : 0;

  const crossoverRow = schedule.rows.find(
    (r) => r.principal > 0 && r.principal > r.interest
  );
  const principalExceedsInterestPeriod = crossoverRow
    ? { period: crossoverRow.period, dueDate: crossoverRow.dueDate }
    : null;

  const currentLoanYear = schedule.nextUnpaidInstallment
    ? schedule.nextUnpaidInstallment.yearIndex
    : Math.max(1, Math.ceil(schedule.currentReferencePeriod / 12));
  const currentPenaltyPercent = getPenaltyRateForYear(
    currentLoanYear,
    contract.prepaymentPenaltyTiers
  );
  const zeroPenaltyTier = [...contract.prepaymentPenaltyTiers]
    .sort((a, b) => a.fromYear - b.fromYear)
    .find((t) => t.feePercent === 0);
  const zeroPenaltyFromYear = zeroPenaltyTier ? zeroPenaltyTier.fromYear : null;

  let actualPrepaymentInterestSaved = 0;
  if (contract.prepayments.length > 0) {
    const noPrepaySchedule = generateMortgageSchedule(
      { ...contract, prepayments: [] },
      referenceDate
    );
    actualPrepaymentInterestSaved = Math.max(
      0,
      noPrepaySchedule.totalProjectedInterest -
        schedule.totalProjectedInterest -
        schedule.totalPrepaymentPenaltyPaid
    );
  }

  const creditLimit = Math.max(
    contract.loanAmount,
    contract.creditLimit ?? contract.loanAmount
  );
  const disbursedRatioPct =
    creditLimit > 0
      ? Math.min(100, Math.round((contract.loanAmount / creditLimit) * 1000) / 10)
      : 100;
  const remainingCreditHeadroom = Math.max(0, creditLimit - contract.loanAmount);

  return {
    totalProjectedPrincipal,
    interestToPrincipalRatioPct,
    principalExceedsInterestPeriod,
    currentLoanYear,
    currentPenaltyPercent,
    zeroPenaltyFromYear,
    actualPrepaymentInterestSaved,
    creditLimit,
    disbursedRatioPct,
    remainingCreditHeadroom,
  };
}

export const SKYONE_TRANCHE2_ID = "skyone_tranche2_q3_2027";
export const SKYONE_PINKBOOK_5PCT_ID = "skyone_pinkbook_5pct_q3_2027";
export const SKYONE_SHORT_UNIT_LABEL = "Căn hộ A.12A.07";

export const REAL_BIDV_SKYONE_SNAPSHOT = {
  accountNumber: "8866102943",
  branchName: "PGD Nguyễn Đình Chiểu · 181 Nguyễn Đình Chiểu, TP.HCM",
  unitCode: SKYONE_A12A07_VERIFIED_FACTS.property.unitCode,
  shortUnitLabel: SKYONE_SHORT_UNIT_LABEL,
  propertyValueHdmb: SKYONE_A12A07_VERIFIED_FACTS.pricing.totalContractPriceWithVat,
  maintenanceFee2Pct: SKYONE_A12A07_VERIFIED_FACTS.pricing.maintenanceFee2Pct,
  downPaymentActual5Tranches: SKYONE_A12A07_VERIFIED_FACTS.totalActualDownPayment,
  tranche1DisbursedAmount: SKYONE_A12A07_VERIFIED_FACTS.bidvLoan.tranche1DisbursedAmount,
  tranche2PlannedAmount: SKYONE_A12A07_VERIFIED_FACTS.bidvLoan.tranche2PlannedAmount,
  tranche2PlannedAfterPeriod: SKYONE_A12A07_VERIFIED_FACTS.bidvLoan.tranche2PlannedAfterPeriod,
  tranche2PlannedDate: SKYONE_A12A07_VERIFIED_FACTS.bidvLoan.tranche2PlannedDate,
  pinkBook5PctAmount: SKYONE_A12A07_VERIFIED_FACTS.bidvLoan.pinkBook5PctAmount,
  openingBalanceBeforeDec2025: 698_898_193,
  verifiedRemainingBalanceNov2026: 662_226_193,
  initial3PeriodsPrincipal: 9_168_001,
  verifiedPaidPrincipal12M: 36_672_000,
  verifiedPaidPrincipal15M: 45_840_001,
  verifiedPaidInterest12M: 37_501_005,
  verifiedTotalCashPaid12M: 74_173_005,
  fixedInterestRate: 5.5,
  fixedRateMonths: 36,
  monthlyPrincipal: 3_056_000,
  creditLimit: SKYONE_A12A07_VERIFIED_FACTS.bidvLoan.totalPlannedDisbursementCap,
  noticeLetterMaxCeiling: SKYONE_A12A07_VERIFIED_FACTS.bidvLoan.noticeLetterMaxCeiling,
  verifiedInstallmentsCount: 12,
  firstVerifiedPeriod: 4,
  lastVerifiedPeriod: 15,
  nextDuePeriod: 16,
  nextDueDate: "2026-12-10",
  fixedEndDate: "2028-08-10",
} as const;

export const VERIFIED_BIDV_PAID_RECORDS: MortgagePaidInstallmentRecord[] = [
  // 3 kỳ gốc đầu sau giải ngân Đợt 1 (708.066.194 đ - 9.168.001 đ = 698.898.193 đ đầu sao kê 10/12/2025)
  {
    period: 1,
    paidAt: "2025-09-10",
    paidPrincipal: 3_056_001,
    paidInterest: 0,
    appliedRate: 5.5,
    isVerified: false,
    note: "Kỳ #1 sau giải ngân Đợt 1 (26/08/2025 · Gốc cố định trước sao kê 10/12/2025)",
  },
  {
    period: 2,
    paidAt: "2025-10-10",
    paidPrincipal: 3_056_000,
    paidInterest: 0,
    appliedRate: 5.5,
    isVerified: false,
    note: "Kỳ #2 sau giải ngân Đợt 1 (Gốc cố định trước sao kê 10/12/2025)",
  },
  {
    period: 3,
    paidAt: "2025-11-10",
    paidPrincipal: 3_056_000,
    paidInterest: 0,
    appliedRate: 5.5,
    isVerified: false,
    note: "Kỳ #3 sau giải ngân Đợt 1 · Khớp dư nợ đầu sao kê 10/12/2025: 698.898.193 đ",
  },
  // 12 kỳ sao kê BIDV SmartBanking thực tế từ 10/12/2025 đến 10/11/2026
  { period: 4, paidAt: "2025-12-10", paidPrincipal: 3_056_000, paidInterest: 3_159_403, appliedRate: 5.5, isVerified: true, verifiedSource: "BIDV SmartBanking · TK 8866102943", note: "Sao kê BIDV TK 8866102943 · Dư nợ sau kỳ: 695.842.193 đ" },
  { period: 5, paidAt: "2026-01-12", paidPrincipal: 3_056_000, paidInterest: 3_460_146, appliedRate: 5.5, isVerified: true, verifiedSource: "BIDV SmartBanking · TK 8866102943", note: "Sao kê BIDV TK 8866102943 · Dư nợ sau kỳ: 692.786.193 đ" },
  { period: 6, paidAt: "2026-02-10", paidPrincipal: 3_056_000, paidInterest: 3_027_381, appliedRate: 5.5, isVerified: true, verifiedSource: "BIDV SmartBanking · TK 8866102943", note: "Sao kê BIDV TK 8866102943 · Dư nợ sau kỳ: 689.730.193 đ" },
  { period: 7, paidAt: "2026-03-10", paidPrincipal: 3_056_000, paidInterest: 2_910_095, appliedRate: 5.5, isVerified: true, verifiedSource: "BIDV SmartBanking · TK 8866102943", note: "Sao kê BIDV TK 8866102943 · Dư nợ sau kỳ: 686.674.193 đ" },
  { period: 8, paidAt: "2026-04-11", paidPrincipal: 3_056_000, paidInterest: 3_194_351, appliedRate: 5.5, isVerified: true, verifiedSource: "BIDV SmartBanking · TK 8866102943", note: "Sao kê BIDV TK 8866102943 · Dư nợ sau kỳ: 683.618.193 đ" },
  { period: 9, paidAt: "2026-05-11", paidPrincipal: 3_056_000, paidInterest: 3_193_800, appliedRate: 5.5, isVerified: true, verifiedSource: "BIDV SmartBanking · TK 8866102943", note: "Sao kê BIDV TK 8866102943 · Dư nợ sau kỳ: 680.562.193 đ" },
  { period: 10, paidAt: "2026-06-10", paidPrincipal: 3_056_000, paidInterest: 3_076_514, appliedRate: 5.5, isVerified: true, verifiedSource: "BIDV SmartBanking · TK 8866102943", note: "Sao kê BIDV TK 8866102943 · Dư nợ sau kỳ: 677.506.193 đ" },
  { period: 11, paidAt: "2026-07-10", paidPrincipal: 3_056_000, paidInterest: 3_062_699, appliedRate: 5.5, isVerified: true, verifiedSource: "BIDV SmartBanking · TK 8866102943", note: "Sao kê BIDV TK 8866102943 · Dư nợ sau kỳ: 674.450.193 đ" },
  { period: 12, paidAt: "2026-08-10", paidPrincipal: 3_056_000, paidInterest: 3_150_514, appliedRate: 5.5, isVerified: true, verifiedSource: "BIDV SmartBanking · TK 8866102943", note: "Sao kê BIDV TK 8866102943 · Dư nợ sau kỳ: 671.394.193 đ" },
  { period: 13, paidAt: "2026-09-10", paidPrincipal: 3_056_000, paidInterest: 3_136_239, appliedRate: 5.5, isVerified: true, verifiedSource: "BIDV SmartBanking · TK 8866102943", note: "Sao kê BIDV TK 8866102943 · Dư nợ sau kỳ: 668.338.193 đ" },
  { period: 14, paidAt: "2026-10-12", paidPrincipal: 3_056_000, paidInterest: 3_222_671, appliedRate: 5.5, isVerified: true, verifiedSource: "BIDV SmartBanking · TK 8866102943", note: "Sao kê BIDV TK 8866102943 · Dư nợ sau kỳ: 665.282.193 đ" },
  { period: 15, paidAt: "2026-11-10", paidPrincipal: 3_056_000, paidInterest: 2_907_192, appliedRate: 5.5, isVerified: true, verifiedSource: "BIDV SmartBanking · TK 8866102943", note: "Sao kê BIDV TK 8866102943 · Dư nợ sau kỳ: 662.226.193 đ" },
];

export function hasPinkBook5PctEnabled(contract: MortgageContract): boolean {
  return (contract.plannedDisbursements || []).some(
    (d) => d.id === SKYONE_PINKBOOK_5PCT_ID
  );
}

export function togglePinkBook5PctDisbursement(
  contract: MortgageContract,
  enabled?: boolean
): MortgageContract {
  const currentlyEnabled = hasPinkBook5PctEnabled(contract);
  const nextEnabled = enabled !== undefined ? enabled : !currentlyEnabled;
  const existing = (contract.plannedDisbursements || []).filter(
    (d) => d.id !== SKYONE_PINKBOOK_5PCT_ID
  );

  const nextDisbursements = nextEnabled
    ? [
        ...existing,
        {
          id: SKYONE_PINKBOOK_5PCT_ID,
          afterPeriod: SKYONE_A12A07_VERIFIED_FACTS.bidvLoan.tranche2PlannedAfterPeriod,
          date: SKYONE_A12A07_VERIFIED_FACTS.bidvLoan.tranche2PlannedDate,
          amount: SKYONE_A12A07_VERIFIED_FACTS.bidvLoan.pinkBook5PctAmount,
          note: "Giải ngân bổ sung 5% nhận Giấy chứng nhận QSHNƠ (Sổ hồng · Q3/2027)",
        },
      ]
    : existing;

  return {
    ...contract,
    plannedDisbursements: nextDisbursements,
  };
}

export function getPlannedDisbursementSummary(contract: MortgageContract): {
  totalAmount: number;
  primaryPeriod: number;
  hasPinkBook5Pct: boolean;
  pinkBookAmount: number;
  tranche2Amount: number;
} {
  const list = contract.plannedDisbursements || [];
  const totalAmount = list.reduce((sum, item) => sum + Math.max(0, item.amount), 0);
  const tranche2 = list.find((d) => d.id === SKYONE_TRANCHE2_ID);
  const pinkBook = list.find((d) => d.id === SKYONE_PINKBOOK_5PCT_ID);
  const primaryPeriod =
    tranche2?.afterPeriod ??
    list[0]?.afterPeriod ??
    SKYONE_A12A07_VERIFIED_FACTS.bidvLoan.tranche2PlannedAfterPeriod;

  return {
    totalAmount,
    primaryPeriod,
    hasPinkBook5Pct: Boolean(pinkBook),
    pinkBookAmount: pinkBook?.amount ?? 0,
    tranche2Amount: tranche2?.amount ?? 0,
  };
}

export function isRealBidvProfileSynced(contract: MortgageContract): boolean {
  const verifiedPeriods = new Set(
    contract.paidRecords.filter((r) => r.isVerified).map((r) => r.period)
  );
  let hasAll12Verified = true;
  for (let p = 4; p <= 15; p++) {
    if (!verifiedPeriods.has(p)) {
      hasAll12Verified = false;
      break;
    }
  }
  const hasInitial3Principals = [1, 2, 3].every((p) => {
    const rec = contract.paidRecords.find((r) => r.period === p);
    return Boolean(rec && rec.paidPrincipal > 0);
  });

  return (
    contract.accountNumber === REAL_BIDV_SKYONE_SNAPSHOT.accountNumber &&
    contract.disbursementDate === "2025-08-26" &&
    contract.loanAmount === REAL_BIDV_SKYONE_SNAPSHOT.tranche1DisbursedAmount &&
    contract.propertyValue === REAL_BIDV_SKYONE_SNAPSHOT.propertyValueHdmb &&
    contract.downPayment === REAL_BIDV_SKYONE_SNAPSHOT.downPaymentActual5Tranches &&
    contract.fixedRateMonths === 36 &&
    Math.abs(contract.fixedInterestRate - 5.5) < 0.01 &&
    contract.paidRecords.length >= 15 &&
    hasInitial3Principals &&
    hasAll12Verified
  );
}

export function reconcileBidvSkyOneContract(
  contract?: MortgageContract | null,
  referenceDate: string = getTodayIsoDate()
): { contract: MortgageContract; didAutoSync: boolean } {
  if (!contract) {
    return { contract: createDefaultSkyOneLoan(referenceDate), didAutoSync: true };
  }

  // Bảo toàn tuyệt đối các chỉnh sửa dòng tiền thủ công hoặc trạng thái đang mở điều chỉnh
  const hasManualCashflowAdjustments =
    (contract.periodOverrides && contract.periodOverrides.length > 0) ||
    contract.cashflowLocked === false;
  if (hasManualCashflowAdjustments) {
    // Vẫn rút gọn nhãn hiển thị dài cũ nếu trùng chính xác chuỗi dài A.12A.07 trước đây
    if (contract.unitCode === SKYONE_A12A07_VERIFIED_FACTS.property.unitDisplayLabel) {
      return {
        contract: { ...contract, unitCode: SKYONE_SHORT_UNIT_LABEL },
        didAutoSync: false,
      };
    }
    return { contract, didAutoSync: false };
  }

  const isLegacyMockDefault =
    contract.id === "skyone_apartment_loan" &&
    ((contract.loanAmount === 1_505_000_000 &&
      Math.abs(contract.fixedInterestRate - 6.8) < 0.01 &&
      contract.disbursementDate === "2025-11-15") ||
      (!contract.accountNumber &&
        contract.disbursementDate === "2025-11-15" &&
        contract.paidRecords.length <= 3));

  const isLegacyEstimatedSkyOneProperty =
    contract.accountNumber === REAL_BIDV_SKYONE_SNAPSHOT.accountNumber &&
    contract.propertyValue === 2_150_000_000 &&
    contract.downPayment === 645_000_000 &&
    contract.unitCode.includes("68m²");

  const isLegacyZeroInitialPeriodsProfile =
    contract.accountNumber === REAL_BIDV_SKYONE_SNAPSHOT.accountNumber &&
    contract.loanAmount === REAL_BIDV_SKYONE_SNAPSHOT.openingBalanceBeforeDec2025 &&
    contract.paidRecords.some((r) => r.period === 1 && r.paidPrincipal === 0);

  const hasLongUnitCodeLabel =
    contract.accountNumber === REAL_BIDV_SKYONE_SNAPSHOT.accountNumber &&
    contract.unitCode === SKYONE_A12A07_VERIFIED_FACTS.property.unitDisplayLabel;

  const isBidvUnverifiedOrIncomplete =
    contract.accountNumber === REAL_BIDV_SKYONE_SNAPSHOT.accountNumber &&
    (!isRealBidvProfileSynced(contract) ||
      isLegacyEstimatedSkyOneProperty ||
      isLegacyZeroInitialPeriodsProfile ||
      hasLongUnitCodeLabel);

  if (!isLegacyMockDefault && !isBidvUnverifiedOrIncomplete) {
    return { contract, didAutoSync: false };
  }

  const base = createDefaultSkyOneLoan(referenceDate);
  const existingByPeriod = new Map(contract.paidRecords.map((r) => [r.period, r]));

  const reconciledBaseRecords = VERIFIED_BIDV_PAID_RECORDS.map((rec) => {
    const existing = existingByPeriod.get(rec.period);
    return existing?.linkedTransactionId
      ? { ...rec, linkedTransactionId: existing.linkedTransactionId }
      : rec;
  });

  // Preserve any future paid periods (>= 16) that the user may have already recorded
  const extraFuturePaid = contract.paidRecords.filter((r) => r.period >= 16);
  const mergedPaidRecords = [...reconciledBaseRecords, ...extraFuturePaid].sort(
    (a, b) => a.period - b.period
  );

  const mergedPlannedDisbursements =
    !isLegacyMockDefault &&
    contract.plannedDisbursements &&
    contract.plannedDisbursements.length > 0
      ? contract.plannedDisbursements
      : base.plannedDisbursements;

  const mergedContract: MortgageContract = {
    ...base,
    paidRecords: mergedPaidRecords,
    prepayments: isLegacyMockDefault ? [] : contract.prepayments,
    rateAdjustments: isLegacyMockDefault ? [] : contract.rateAdjustments,
    plannedDisbursements: mergedPlannedDisbursements,
    cashflowLocked: contract.cashflowLocked ?? true,
    periodOverrides: contract.periodOverrides || [],
    updatedAt: `${referenceDate}T08:00:00.000Z`,
  };

  return { contract: mergedContract, didAutoSync: true };
}

export function createDefaultSkyOneLoan(
  referenceDate: string = getTodayIsoDate()
): MortgageContract {
  return {
    id: "skyone_apartment_loan",
    projectName: SKYONE_A12A07_VERIFIED_FACTS.property.projectName,
    unitCode: SKYONE_SHORT_UNIT_LABEL,
    bankName: SKYONE_A12A07_VERIFIED_FACTS.bidvLoan.bankName,
    accountNumber: REAL_BIDV_SKYONE_SNAPSHOT.accountNumber,
    branchName: REAL_BIDV_SKYONE_SNAPSHOT.branchName,
    propertyValue: SKYONE_A12A07_VERIFIED_FACTS.pricing.totalContractPriceWithVat,
    currentMarketValue: SKYONE_A12A07_VERIFIED_FACTS.pricing.estimatedMarketValue,
    downPayment: SKYONE_A12A07_VERIFIED_FACTS.totalActualDownPayment,
    creditLimit: REAL_BIDV_SKYONE_SNAPSHOT.creditLimit,
    loanAmount: REAL_BIDV_SKYONE_SNAPSHOT.tranche1DisbursedAmount,
    termMonths: MAX_MORTGAGE_TERM_MONTHS,
    disbursementDate: SKYONE_A12A07_VERIFIED_FACTS.bidvLoan.disbursementDate,
    paymentDayOfMonth: SKYONE_A12A07_VERIFIED_FACTS.bidvLoan.paymentDayOfMonth,
    fixedRateMonths: SKYONE_A12A07_VERIFIED_FACTS.bidvLoan.fixedRateMonths,
    fixedInterestRate: SKYONE_A12A07_VERIFIED_FACTS.bidvLoan.fixedRatePercent,
    floatingBaseRate: 6.5,
    floatingSpread: 3.5,
    monthlyPrincipalOverride: REAL_BIDV_SKYONE_SNAPSHOT.monthlyPrincipal,
    interestBasis: "ACTUAL_365",
    prepayStrategyDefault: "REDUCE_MONTHLY",
    prepaymentPenaltyTiers: [
      { fromYear: 1, toYear: 1, feePercent: 2.0 },
      { fromYear: 2, toYear: 2, feePercent: 1.5 },
      { fromYear: 3, toYear: 3, feePercent: 1.0 },
      { fromYear: 4, toYear: MAX_MORTGAGE_TERM_YEARS, feePercent: 0 },
    ],
    rateAdjustments: [],
    paidRecords: [...VERIFIED_BIDV_PAID_RECORDS],
    prepayments: [],
    plannedDisbursements: [
      {
        id: SKYONE_TRANCHE2_ID,
        afterPeriod: SKYONE_A12A07_VERIFIED_FACTS.bidvLoan.tranche2PlannedAfterPeriod,
        date: SKYONE_A12A07_VERIFIED_FACTS.bidvLoan.tranche2PlannedDate,
        amount: SKYONE_A12A07_VERIFIED_FACTS.bidvLoan.tranche2PlannedAmount,
        note: "Giải ngân Đợt 2 (Quý III/2027 · Bàn giao căn hộ A.12A.07)",
      },
    ],
    cashflowLocked: true,
    periodOverrides: [],
    updatedAt: `${referenceDate}T08:00:00.000Z`,
  };
}

export interface SkyOneYearlyChartPoint {
  yearIndex: number;
  name: string;
  openingBalance: number;
  principal: number;
  interest: number;
  totalPaid: number;
  endingBalance: number;
  cumulativeEquity: number;
  equityPercent: number;
  remainingDebtRatioPct: number;
  principalSharePct: number;
  interestSharePct: number;
}

export interface SkyOneChartMilestones {
  fixedEndYearIndex: number | null;
  fixedEndYearLabel: string | null;
  currentYearIndex: number | null;
  currentYearLabel: string | null;
  equity50YearIndex: number | null;
  equity50YearLabel: string | null;
  alreadyAtEquity50AtStart: boolean;
}

export interface SkyOneAmortizationChartDataset {
  points: SkyOneYearlyChartPoint[];
  milestones: SkyOneChartMilestones;
}

export function buildSkyOneAmortizationChartData(
  contract: MortgageContract,
  schedule: MortgageScheduleSummary
): SkyOneAmortizationChartDataset {
  const peakDebtBase = Math.max(
    contract.loanAmount,
    ...schedule.yearlySummary.map((y) => Math.max(y.openingBalance, y.endingBalance))
  );

  const points: SkyOneYearlyChartPoint[] = schedule.yearlySummary.map((y) => {
    const remainingDebtRatioPct =
      peakDebtBase > 0
        ? Math.min(100, Math.max(0, Number(((y.endingBalance / peakDebtBase) * 100).toFixed(1))))
        : 0;

    const principalSharePct =
      y.totalPaid > 0
        ? Math.min(100, Math.max(0, Number(((y.principalPaid / y.totalPaid) * 100).toFixed(1))))
        : 0;
    const interestSharePct =
      y.totalPaid > 0 ? Number(Math.max(0, 100 - principalSharePct).toFixed(1)) : 0;

    return {
      yearIndex: y.yearIndex,
      name: y.label,
      openingBalance: y.openingBalance,
      principal: y.principalPaid,
      interest: y.interestPaid,
      totalPaid: y.totalPaid,
      endingBalance: y.endingBalance,
      cumulativeEquity: y.cumulativeEquity,
      equityPercent: Math.min(100, Math.max(0, Number(y.equityPercent.toFixed(1)))),
      remainingDebtRatioPct,
      principalSharePct,
      interestSharePct,
    };
  });

  if (points.length === 0) {
    return {
      points: [],
      milestones: {
        fixedEndYearIndex: null,
        fixedEndYearLabel: null,
        currentYearIndex: null,
        currentYearLabel: null,
        equity50YearIndex: null,
        equity50YearLabel: null,
        alreadyAtEquity50AtStart: false,
      },
    };
  }

  const fixedCandidate =
    contract.fixedRateMonths > 0 ? Math.max(1, Math.ceil(contract.fixedRateMonths / 12)) : null;
  const fixedPoint = fixedCandidate
    ? points.find((p) => p.yearIndex === fixedCandidate)
    : undefined;

  const lastYearIndex = points[points.length - 1].yearIndex;
  const currentCandidate = Math.min(
    lastYearIndex,
    Math.max(1, Math.ceil(schedule.currentReferencePeriod / 12))
  );
  const currentPoint = points.find((p) => p.yearIndex === currentCandidate) ?? points[0];

  const alreadyAtEquity50AtStart =
    contract.propertyValue > 0 && contract.downPayment / contract.propertyValue >= 0.5;
  const equity50Point = points.find((p) => p.equityPercent >= 50);

  return {
    points,
    milestones: {
      fixedEndYearIndex: fixedPoint?.yearIndex ?? null,
      fixedEndYearLabel: fixedPoint?.name ?? null,
      currentYearIndex: currentPoint?.yearIndex ?? null,
      currentYearLabel: currentPoint?.name ?? null,
      equity50YearIndex: equity50Point?.yearIndex ?? null,
      equity50YearLabel: equity50Point?.name ?? null,
      alreadyAtEquity50AtStart,
    },
  };
}

export interface SkyOneStrategySimulationParams {
  nextDisbursementAmount: number;
  nextDisbursementAfterPeriod: number;
  projectedFloatingRate: number;
  safeSavingsYieldRate: number;
  monthlyBufferContribution: number;
  expectedMonthlyRent: number;
  monthlyFamilyIncome: number;
  referenceDate?: string;
}

export interface SkyOneStrategyTimelinePoint {
  period: number;
  label: string;
  dueDate: string;
  stage: "FIXED_CURRENT" | "FIXED_DISBURSED" | "FLOATING";
  paymentNoStrategy: number;
  paymentWithStrike: number;
  dtiThreshold30: number;
  expectedRent: number;
  balanceNoStrategy: number;
  balanceWithStrike: number;
}

export type SkyOneDtiStatus = "SAFE" | "WATCH" | "HIGH";

export interface SkyOneDtiDiagnostics {
  monthlyIncome: number;
  safeMonthlyCeiling: number;
  watchMonthlyCeiling: number;
  currentStatus: SkyOneDtiStatus;
  postDisbursementStatus: SkyOneDtiStatus;
  noStrikeStatus: SkyOneDtiStatus;
  withStrikeStatus: SkyOneDtiStatus;
  hasWarningAtAnyStage: boolean;
  worstStageLabel: string;
  worstDtiPct: number;
  recommendedMonthlyContributionForSafeDti: number;
  requiredRentForSafeDti: number;
  requiredIncomeForSafeDti: number;
}

export interface SkyOneStrategyAnalysis {
  monthsRemainingFixed: number;
  fixedEndPeriod: number;
  fixedEndDate: string;
  firstFloatingPeriod: number;
  firstFloatingDate: string;
  currentMonthlyPayment: number;
  postDisbursementMonthlyPayment: number;
  postResetMonthlyPaymentNoStrike: number;
  postResetMonthlyPaymentWithStrike: number;
  monthlyShockIncreaseNoStrike: number;
  monthlySavingsPostResetWithStrike: number;
  dtiCurrentPct: number;
  dtiPostDisbursementPct: number;
  dtiNoStrikePct: number;
  dtiWithStrikePct: number;
  dtiDiagnostics: SkyOneDtiDiagnostics;
  balanceAtResetBeforeStrike: number;
  balanceAtResetAfterStrike: number;
  bufferPrincipalSaved: number;
  bufferInterestEarned: number;
  totalBufferAtReset: number;
  penaltyAtResetPct: number;
  penaltyAtResetAmount: number;
  earlyPenaltyAvoidedAmount: number;
  rateCarryGainAmount: number;
  netStrategyAdvantage: number;
  lifetimeInterestSavedByStrike: number;
  positiveCarrySpreadPct: number;
  rentCoverageCurrentPct: number;
  rentCoveragePostDisbursementPct: number;
  rentCoveragePostResetPct: number;
  netMonthlyCarryWithRent: number;
  timelinePoints: SkyOneStrategyTimelinePoint[];
}

export function analyzeSkyOneStrategy(
  contract: MortgageContract,
  params: SkyOneStrategySimulationParams
): SkyOneStrategyAnalysis {
  const refDate = params.referenceDate || getTodayIsoDate();
  const baseSchedule = generateMortgageSchedule(contract, refDate);
  const currentPeriod = baseSchedule.currentReferencePeriod;
  const fixedEndPeriod = Math.max(currentPeriod, contract.fixedRateMonths);
  const firstFloatingPeriod = fixedEndPeriod + 1;
  const monthsRemainingFixed = Math.max(0, fixedEndPeriod - currentPeriod + 1);

  const floatingRate = Math.max(1, params.projectedFloatingRate);
  const tranchePeriod = Math.max(
    currentPeriod,
    Math.min(fixedEndPeriod, params.nextDisbursementAfterPeriod)
  );
  const trancheAmount = Math.max(0, params.nextDisbursementAmount);

  const noStrategyContract: MortgageContract = {
    ...contract,
    floatingBaseRate: floatingRate,
    floatingSpread: 0,
    plannedDisbursements:
      trancheAmount > 0
        ? [
            {
              id: "sim_tranche_future",
              afterPeriod: tranchePeriod,
              date: addMonthsToDay(
                contract.disbursementDate,
                tranchePeriod,
                contract.paymentDayOfMonth
              ),
              amount: trancheAmount,
              note: "Giải ngân bổ sung theo tiến độ dự án",
            },
          ]
        : [],
  };

  const noStrategySchedule = generateMortgageSchedule(noStrategyContract, refDate);

  // Compound monthly buffer accumulation until Period fixedRateMonths (e.g., 08/2028)
  const contrib = Math.max(0, params.monthlyBufferContribution);
  const monthlySaveRate = Math.max(0, params.safeSavingsYieldRate) / 100 / 12;
  let bufferFund = 0;
  let immediatePrepayInterestCost = 0;
  let immediatePenaltySum = 0;

  for (let i = 0; i < monthsRemainingFixed; i++) {
    bufferFund = (bufferFund + contrib) * (1 + monthlySaveRate);

    // Compare against immediate monthly prepayments losing early-penalty + 5.5% rate
    const simPeriod = currentPeriod + i;
    const simYear = Math.max(1, Math.ceil(simPeriod / 12));
    const earlyPenaltyRate = getPenaltyRateForYear(
      simYear,
      contract.prepaymentPenaltyTiers
    );
    immediatePenaltySum += Math.round(contrib * (earlyPenaltyRate / 100));
    const monthsToFixedEnd = Math.max(0, monthsRemainingFixed - i);
    immediatePrepayInterestCost += Math.round(
      contrib * (contract.fixedInterestRate / 100 / 12) * monthsToFixedEnd
    );
  }

  const bufferPrincipalSaved = contrib * monthsRemainingFixed;
  const totalBufferAtReset = Math.round(bufferFund);
  const bufferInterestEarned = Math.max(
    0,
    totalBufferAtReset - bufferPrincipalSaved
  );

  const fixedEndRowNoStrategy =
    noStrategySchedule.rows.find((r) => r.period === fixedEndPeriod) ||
    noStrategySchedule.rows[noStrategySchedule.rows.length - 1];
  const balanceAtResetBeforeStrike = fixedEndRowNoStrategy?.closingBalance || 0;

  const yearAtReset = Math.max(1, Math.ceil(firstFloatingPeriod / 12));
  const penaltyAtResetPct = getPenaltyRateForYear(
    yearAtReset,
    contract.prepaymentPenaltyTiers
  );
  const strikePrincipal = Math.min(
    balanceAtResetBeforeStrike,
    Math.round(totalBufferAtReset / (1 + penaltyAtResetPct / 100))
  );
  const penaltyAtResetAmount = Math.round(
    strikePrincipal * (penaltyAtResetPct / 100)
  );

  const strikeContract: MortgageContract = {
    ...noStrategyContract,
    prepayments: [
      ...noStrategyContract.prepayments,
      ...(strikePrincipal > 0
        ? [
            {
              id: "sim_strike_reset",
              date: addMonthsToDay(
                contract.disbursementDate,
                fixedEndPeriod,
                contract.paymentDayOfMonth
              ),
              afterPeriod: fixedEndPeriod,
              amount: strikePrincipal,
              penaltyAmount: penaltyAtResetAmount,
              feePercent: penaltyAtResetPct,
              strategy: "REDUCE_MONTHLY" as const,
              note: "Đánh chặn Quỹ Đệm ngay trước thả nổi",
            },
          ]
        : []),
    ],
  };

  const strikeSchedule = generateMortgageSchedule(strikeContract, refDate);

  const currentRow =
    noStrategySchedule.rows.find((r) => r.period === currentPeriod) ||
    noStrategySchedule.nextUnpaidInstallment;
  const currentMonthlyPayment = currentRow?.totalPayment || 0;

  const postTranchePeriod = Math.min(fixedEndPeriod, tranchePeriod + 1);
  const postDisbursementRow = noStrategySchedule.rows.find(
    (r) => r.period === postTranchePeriod
  );
  const postDisbursementMonthlyPayment =
    postDisbursementRow?.totalPayment || currentMonthlyPayment;

  const firstFloatNoStrike = noStrategySchedule.rows.find(
    (r) => r.period === firstFloatingPeriod
  );
  const firstFloatWithStrike = strikeSchedule.rows.find(
    (r) => r.period === firstFloatingPeriod
  );

  const postResetMonthlyPaymentNoStrike = firstFloatNoStrike?.totalPayment || 0;
  const postResetMonthlyPaymentWithStrike =
    firstFloatWithStrike?.totalPayment || 0;

  const monthlyShockIncreaseNoStrike = Math.max(
    0,
    postResetMonthlyPaymentNoStrike - currentMonthlyPayment
  );
  const monthlySavingsPostResetWithStrike = Math.max(
    0,
    postResetMonthlyPaymentNoStrike - postResetMonthlyPaymentWithStrike
  );

  const income = Math.max(1, params.monthlyFamilyIncome);
  const dtiCurrentPct = Math.round((currentMonthlyPayment / income) * 1000) / 10;
  const dtiPostDisbursementPct =
    Math.round((postDisbursementMonthlyPayment / income) * 1000) / 10;
  const dtiNoStrikePct =
    Math.round((postResetMonthlyPaymentNoStrike / income) * 1000) / 10;
  const dtiWithStrikePct =
    Math.round((postResetMonthlyPaymentWithStrike / income) * 1000) / 10;

  const balanceAtResetAfterStrike = Math.max(
    0,
    balanceAtResetBeforeStrike - strikePrincipal
  );

  const earlyPenaltyAvoidedAmount = Math.max(
    0,
    immediatePenaltySum - penaltyAtResetAmount
  );
  const rateCarryGainAmount = bufferInterestEarned - immediatePrepayInterestCost;
  const netStrategyAdvantage = earlyPenaltyAvoidedAmount + rateCarryGainAmount;
  const lifetimeInterestSavedByStrike = Math.max(
    0,
    noStrategySchedule.totalProjectedInterest -
      strikeSchedule.totalProjectedInterest -
      penaltyAtResetAmount
  );

  const rent = Math.max(0, params.expectedMonthlyRent);
  const rentCoverageCurrentPct =
    currentMonthlyPayment > 0
      ? Math.round((rent / currentMonthlyPayment) * 1000) / 10
      : 0;
  const rentCoveragePostDisbursementPct =
    postDisbursementMonthlyPayment > 0
      ? Math.round((rent / postDisbursementMonthlyPayment) * 1000) / 10
      : 0;
  const rentCoveragePostResetPct =
    postResetMonthlyPaymentWithStrike > 0
      ? Math.round((rent / postResetMonthlyPaymentWithStrike) * 1000) / 10
      : 0;

  const dtiThreshold30 = Math.round(income * 0.3);
  const timelineEndPeriod = Math.min(
    contract.termMonths,
    Math.max(firstFloatingPeriod + 24, currentPeriod + 48)
  );
  const strikeMap = new Map(strikeSchedule.rows.map((r) => [r.period, r]));

  const timelinePoints: SkyOneStrategyTimelinePoint[] = noStrategySchedule.rows
    .filter((r) => r.period >= currentPeriod && r.period <= timelineEndPeriod)
    .map((r) => {
      const sRow = strikeMap.get(r.period);
      const stage: SkyOneStrategyTimelinePoint["stage"] =
        r.period > fixedEndPeriod
          ? "FLOATING"
          : trancheAmount > 0 && r.period > tranchePeriod
          ? "FIXED_DISBURSED"
          : "FIXED_CURRENT";
      return {
        period: r.period,
        label: `${r.dueDate.slice(5, 7)}/${r.dueDate.slice(2, 4)}`,
        dueDate: r.dueDate,
        stage,
        paymentNoStrategy: r.totalPayment,
        paymentWithStrike: sRow?.totalPayment ?? r.totalPayment,
        dtiThreshold30,
        expectedRent: rent,
        balanceNoStrategy: r.closingBalance,
        balanceWithStrike: sRow?.closingBalance ?? r.closingBalance,
      };
    });

  const classifyDti = (pct: number): SkyOneDtiStatus =>
    pct > 40 ? "HIGH" : pct > 30 ? "WATCH" : "SAFE";

  const currentStatus = classifyDti(dtiCurrentPct);
  const postDisbursementStatus = classifyDti(dtiPostDisbursementPct);
  const noStrikeStatus = classifyDti(dtiNoStrikePct);
  const withStrikeStatus = classifyDti(dtiWithStrikePct);

  const stageRank: { label: string; pct: number }[] = [
    { label: "Hiện tại (5,5%)", pct: dtiCurrentPct },
    { label: "Sau giải ngân thêm (5,5%)", pct: dtiPostDisbursementPct },
    {
      label: `Thả nổi ${floatingRate.toFixed(1)}% (09/2028)`,
      pct: dtiNoStrikePct,
    },
  ];
  const worstStage = stageRank.reduce(
    (max, item) => (item.pct > max.pct ? item : max),
    stageRank[0]
  );

  const safeMonthlyCeiling = Math.round(income * 0.3);
  const watchMonthlyCeiling = Math.round(income * 0.4);

  // Find minimum monthly buffer (in 500k steps) so post-reset floating payment <= safeMonthlyCeiling
  let recommendedMonthlyContributionForSafeDti = 0;
  if (
    postResetMonthlyPaymentNoStrike > safeMonthlyCeiling &&
    monthsRemainingFixed > 0 &&
    balanceAtResetBeforeStrike > 0
  ) {
    let unitAcc = 0;
    for (let i = 0; i < monthsRemainingFixed; i++) {
      unitAcc = (unitAcc + 1) * (1 + monthlySaveRate);
    }
    const maxContribNeeded = Math.ceil(
      (balanceAtResetBeforeStrike * (1 + penaltyAtResetPct / 100)) /
        Math.max(1, unitAcc) /
        500_000
    ) * 500_000;

    // Step search in 500k increments with fast mathematical check on period firstFloatingPeriod
    const basePrincipalAtReset =
      firstFloatNoStrike?.principal ??
      (contract.monthlyPrincipalOverride ||
        Math.round(
          balanceAtResetBeforeStrike /
            Math.max(1, contract.termMonths - fixedEndPeriod)
        ));
    const dayCountAtFirstFloat = firstFloatNoStrike?.dayCountUsed || 31;

    let found = Math.min(30_000_000, maxContribNeeded);
    for (let cand = 500_000; cand <= Math.min(35_000_000, maxContribNeeded); cand += 500_000) {
      const candBuffer = Math.round(cand * unitAcc);
      const candStrike = Math.min(
        balanceAtResetBeforeStrike,
        Math.round(candBuffer / (1 + penaltyAtResetPct / 100))
      );
      const remainingAtReset = Math.max(0, balanceAtResetBeforeStrike - candStrike);
      const candPrincipal =
        remainingAtReset <= 0
          ? 0
          : Math.min(
              remainingAtReset,
              contract.monthlyPrincipalOverride && contract.monthlyPrincipalOverride > 0
                ? contract.monthlyPrincipalOverride
                : Math.round(
                    remainingAtReset /
                      Math.max(1, contract.termMonths - fixedEndPeriod)
                  )
            );
      const candInterest =
        contract.interestBasis === "THIRTY_360"
          ? Math.round((remainingAtReset * (floatingRate / 100)) / 12)
          : Math.round(
              (remainingAtReset * (floatingRate / 100) * dayCountAtFirstFloat) / 365
            );
      if (candPrincipal + candInterest <= safeMonthlyCeiling) {
        found = cand;
        break;
      }
      // Keep baseline principal reference used when remaining > basePrincipalAtReset
      void basePrincipalAtReset;
    }
    recommendedMonthlyContributionForSafeDti = found;
  }

  const requiredRentForSafeDti =
    postResetMonthlyPaymentNoStrike > safeMonthlyCeiling
      ? Math.ceil((postResetMonthlyPaymentNoStrike - safeMonthlyCeiling) / 500_000) *
        500_000
      : 0;

  const requiredIncomeForSafeDti =
    postResetMonthlyPaymentNoStrike > 0
      ? Math.ceil(postResetMonthlyPaymentNoStrike / 0.3 / 1_000_000) * 1_000_000
      : income;

  const dtiDiagnostics: SkyOneDtiDiagnostics = {
    monthlyIncome: income,
    safeMonthlyCeiling,
    watchMonthlyCeiling,
    currentStatus,
    postDisbursementStatus,
    noStrikeStatus,
    withStrikeStatus,
    hasWarningAtAnyStage:
      currentStatus !== "SAFE" ||
      postDisbursementStatus !== "SAFE" ||
      noStrikeStatus !== "SAFE",
    worstStageLabel: worstStage.label,
    worstDtiPct: worstStage.pct,
    recommendedMonthlyContributionForSafeDti,
    requiredRentForSafeDti,
    requiredIncomeForSafeDti,
  };

  return {
    monthsRemainingFixed,
    fixedEndPeriod,
    fixedEndDate: addMonthsToDay(
      contract.disbursementDate,
      fixedEndPeriod,
      contract.paymentDayOfMonth
    ),
    firstFloatingPeriod,
    firstFloatingDate: addMonthsToDay(
      contract.disbursementDate,
      firstFloatingPeriod,
      contract.paymentDayOfMonth
    ),
    currentMonthlyPayment,
    postDisbursementMonthlyPayment,
    postResetMonthlyPaymentNoStrike,
    postResetMonthlyPaymentWithStrike,
    monthlyShockIncreaseNoStrike,
    monthlySavingsPostResetWithStrike,
    dtiCurrentPct,
    dtiPostDisbursementPct,
    dtiNoStrikePct,
    dtiWithStrikePct,
    dtiDiagnostics,
    balanceAtResetBeforeStrike,
    balanceAtResetAfterStrike,
    bufferPrincipalSaved,
    bufferInterestEarned,
    totalBufferAtReset,
    penaltyAtResetPct,
    penaltyAtResetAmount,
    earlyPenaltyAvoidedAmount,
    rateCarryGainAmount,
    netStrategyAdvantage,
    lifetimeInterestSavedByStrike,
    positiveCarrySpreadPct:
      Math.round((params.safeSavingsYieldRate - contract.fixedInterestRate) * 100) /
      100,
    rentCoverageCurrentPct,
    rentCoveragePostDisbursementPct,
    rentCoveragePostResetPct,
    netMonthlyCarryWithRent: postDisbursementMonthlyPayment - rent,
    timelinePoints,
  };
}

export interface TermReductionSimulationParams {
  targetYears: number;
  projectedFloatingRate?: number;
  extraDisbursementAmount?: number;
  extraDisbursementAfterPeriod?: number;
  referenceDate?: string;
}

export interface TermReductionTransitionPoint {
  yearIndex: number;
  name: string;
  stage: "FIXED" | "TRANSITION" | "FLOATING" | "PAID_OFF";
  baselinePrincipal: number;
  baselineInterest: number;
  baselineTotalPayment: number;
  baselineEndingBalance: number;
  baselinePrincipalSharePct: number;
  baselineInterestSharePct: number;
  targetPrincipal: number;
  targetInterest: number;
  targetTotalPayment: number;
  targetEndingBalance: number;
  targetPrincipalSharePct: number;
  targetInterestSharePct: number;
  cumulativeBaselineInterest: number;
  cumulativeInterestSaved: number;
}

export interface TermReductionSweepPoint {
  years: number;
  months: number;
  requiredMonthlyPrincipal: number;
  firstTargetMonthlyPayment: number;
  totalProjectedInterest: number;
  interestSavedVs30Y: number;
  crossoverYear: number | null;
}

export interface TermReductionSimulationResult {
  maxTermYears: number;
  minSelectableYears: number;
  targetYears: number;
  targetMonths: number;
  baseline30PayoffDate: string;
  targetPayoffDate: string;
  yearsSavedVs30Y: number;
  monthsSavedVs30Y: number;
  baseline30TotalInterest: number;
  targetTotalInterest: number;
  interestSavedVs30Y: number;
  baselineMonthlyPrincipal: number;
  requiredMonthlyPrincipal: number;
  monthlyPrincipalDelta: number;
  firstBaselineMonthlyPayment: number;
  firstTargetMonthlyPayment: number;
  peakTargetMonthlyPayment: number;
  crossoverYearBaseline: number | null;
  crossoverYearTarget: number | null;
  transitionStartYear: number;
  transitionEndYear: number;
  transitionPoints: TermReductionTransitionPoint[];
  sweepByYears: TermReductionSweepPoint[];
}

function buildScenarioScheduleForYears(
  contract: MortgageContract,
  years: number,
  remainingBalanceAtRef: number,
  lastPaidPeriod: number,
  floatingRate: number,
  extraDisbursementAmount: number,
  extraDisbursementAfterPeriod: number,
  refDate: string
): {
  schedule: MortgageScheduleSummary;
  monthlyPrincipal: number;
  months: number;
} {
  const months = Math.max(
    lastPaidPeriod + 1,
    Math.min(MAX_MORTGAGE_TERM_MONTHS, Math.round(years * 12))
  );
  const remainingMonths = Math.max(1, months - lastPaidPeriod);
  const totalRemainingPool = Math.max(0, remainingBalanceAtRef + extraDisbursementAmount);
  const monthlyPrincipal = Math.max(1, Math.round(totalRemainingPool / remainingMonths));

  const scenarioContract: MortgageContract = {
    ...contract,
    termMonths: months,
    floatingBaseRate: floatingRate,
    floatingSpread: 0,
    monthlyPrincipalOverride: monthlyPrincipal,
    plannedDisbursements:
      extraDisbursementAmount > 0
        ? [
            {
              id: "term_sim_tranche",
              afterPeriod: Math.max(
                lastPaidPeriod,
                Math.min(months - 1, extraDisbursementAfterPeriod)
              ),
              date: addMonthsToDay(
                contract.disbursementDate,
                Math.max(lastPaidPeriod, Math.min(months - 1, extraDisbursementAfterPeriod)),
                contract.paymentDayOfMonth
              ),
              amount: extraDisbursementAmount,
              note: "Giải ngân bổ sung mô phỏng dải chuyển",
            },
          ]
        : [],
  };

  return {
    schedule: generateMortgageSchedule(scenarioContract, refDate),
    monthlyPrincipal,
    months,
  };
}

/**
 * Mô phỏng chiến lược giảm số năm vay (trần tối đa 30 năm / 360 tháng)
 * và chuyển động Lãi trả nợ / Gốc trả khi chạy trong dải chuyển.
 */
export function simulateTermReductionStrategy(
  contract: MortgageContract,
  params: TermReductionSimulationParams
): TermReductionSimulationResult {
  const refDate = params.referenceDate || getTodayIsoDate();
  const baseSchedule = generateMortgageSchedule(contract, refDate);
  const lastPaidPeriod =
    contract.paidRecords.length > 0
      ? Math.max(...contract.paidRecords.map((r) => r.period))
      : 0;
  const currentPeriod = baseSchedule.currentReferencePeriod;
  const remainingAtRef = baseSchedule.remainingBalance;
  const extraAmount = Math.max(0, params.extraDisbursementAmount ?? 0);
  const extraPeriod = Math.max(
    currentPeriod,
    params.extraDisbursementAfterPeriod ?? Math.max(currentPeriod, contract.fixedRateMonths - 15)
  );
  const floatingRate = Math.max(
    1,
    params.projectedFloatingRate ?? contract.floatingBaseRate + contract.floatingSpread
  );

  const minSelectableYears = Math.min(
    MAX_MORTGAGE_TERM_YEARS,
    Math.max(3, Math.ceil((lastPaidPeriod + 6) / 12))
  );
  const clampedTargetYears = Math.min(
    MAX_MORTGAGE_TERM_YEARS,
    Math.max(minSelectableYears, Math.round(params.targetYears))
  );

  const baseline30 = buildScenarioScheduleForYears(
    contract,
    MAX_MORTGAGE_TERM_YEARS,
    remainingAtRef,
    lastPaidPeriod,
    floatingRate,
    extraAmount,
    extraPeriod,
    refDate
  );

  const targetScenario = buildScenarioScheduleForYears(
    contract,
    clampedTargetYears,
    remainingAtRef,
    lastPaidPeriod,
    floatingRate,
    extraAmount,
    extraPeriod,
    refDate
  );

  const fixedEndYear =
    contract.fixedRateMonths > 0 ? Math.max(1, Math.ceil(contract.fixedRateMonths / 12)) : 1;
  const transitionStartYear = Math.max(1, Math.ceil(currentPeriod / 12));
  const transitionEndYear = Math.min(MAX_MORTGAGE_TERM_YEARS, fixedEndYear + 1);

  const baselineByYear = new Map(
    baseline30.schedule.yearlySummary.map((y) => [y.yearIndex, y])
  );
  const targetByYear = new Map(
    targetScenario.schedule.yearlySummary.map((y) => [y.yearIndex, y])
  );

  const maxChartYears = Math.max(
    baseline30.schedule.yearlySummary.length,
    targetScenario.schedule.yearlySummary.length
  );

  const transitionPoints: TermReductionTransitionPoint[] = [];
  let runningSaved = 0;
  let runningBaselineInterest = 0;

  for (let yr = 1; yr <= maxChartYears; yr++) {
    const b = baselineByYear.get(yr);
    const t = targetByYear.get(yr);

    const bPrincipal = b?.principalPaid ?? 0;
    const bInterest = b?.interestPaid ?? 0;
    const bTotal = b?.totalPaid ?? 0;
    const bEnd = b?.endingBalance ?? 0;

    const tPrincipal = t?.principalPaid ?? 0;
    const tInterest = t?.interestPaid ?? 0;
    const tTotal = t?.totalPaid ?? 0;
    const tEnd = t?.endingBalance ?? 0;

    runningBaselineInterest += bInterest;
    runningSaved += bInterest - tInterest;

    const bPrincipalShare =
      bTotal > 0 ? Number(((bPrincipal / bTotal) * 100).toFixed(1)) : 0;
    const bInterestShare =
      bTotal > 0 ? Number(Math.max(0, 100 - bPrincipalShare).toFixed(1)) : 0;
    const tPrincipalShare =
      tTotal > 0 ? Number(((tPrincipal / tTotal) * 100).toFixed(1)) : 0;
    const tInterestShare =
      tTotal > 0 ? Number(Math.max(0, 100 - tPrincipalShare).toFixed(1)) : 0;

    let stage: TermReductionTransitionPoint["stage"] = "FLOATING";
    if (!t) {
      stage = "PAID_OFF";
    } else if (yr < fixedEndYear) {
      stage = "FIXED";
    } else if (yr >= fixedEndYear && yr <= transitionEndYear) {
      stage = "TRANSITION";
    }

    transitionPoints.push({
      yearIndex: yr,
      name: `Năm ${yr}`,
      stage,
      baselinePrincipal: bPrincipal,
      baselineInterest: bInterest,
      baselineTotalPayment: bTotal,
      baselineEndingBalance: bEnd,
      baselinePrincipalSharePct: bPrincipalShare,
      baselineInterestSharePct: bInterestShare,
      targetPrincipal: tPrincipal,
      targetInterest: tInterest,
      targetTotalPayment: tTotal,
      targetEndingBalance: tEnd,
      targetPrincipalSharePct: tPrincipalShare,
      targetInterestSharePct: tInterestShare,
      cumulativeBaselineInterest: runningBaselineInterest,
      cumulativeInterestSaved: Math.max(0, runningSaved),
    });
  }

  const crossoverBaselineRow = baseline30.schedule.yearlySummary.find(
    (y) => y.principalPaid > y.interestPaid
  );
  const crossoverTargetRow = targetScenario.schedule.yearlySummary.find(
    (y) => y.principalPaid > y.interestPaid
  );

  const firstBaselineUnpaid = baseline30.schedule.rows.find(
    (r) => r.period > lastPaidPeriod
  );
  const firstTargetUnpaid = targetScenario.schedule.rows.find(
    (r) => r.period > lastPaidPeriod
  );
  const peakTargetMonthlyPayment = targetScenario.schedule.rows
    .filter((r) => r.period > lastPaidPeriod)
    .reduce((max, r) => (r.totalPayment > max ? r.totalPayment : max), 0);

  const monthsSavedVs30Y = Math.max(
    0,
    baseline30.schedule.rows.length - targetScenario.schedule.rows.length
  );
  const yearsSavedVs30Y = Math.round((monthsSavedVs30Y / 12) * 10) / 10;

  const interestSavedVs30Y = Math.max(
    0,
    baseline30.schedule.totalProjectedInterest -
      targetScenario.schedule.totalProjectedInterest
  );

  const candidateYears = [5, 10, 15, 20, 25, 30].filter(
    (y) => y >= minSelectableYears && y <= MAX_MORTGAGE_TERM_YEARS
  );
  if (!candidateYears.includes(minSelectableYears)) {
    candidateYears.unshift(minSelectableYears);
  }

  const sweepByYears: TermReductionSweepPoint[] = candidateYears.map((yrs) => {
    const s = buildScenarioScheduleForYears(
      contract,
      yrs,
      remainingAtRef,
      lastPaidPeriod,
      floatingRate,
      extraAmount,
      extraPeriod,
      refDate
    );
    const firstRow = s.schedule.rows.find((r) => r.period > lastPaidPeriod);
    const cross = s.schedule.yearlySummary.find(
      (y) => y.principalPaid > y.interestPaid
    );
    return {
      years: yrs,
      months: s.schedule.rows.length,
      requiredMonthlyPrincipal: s.monthlyPrincipal,
      firstTargetMonthlyPayment: firstRow?.totalPayment || 0,
      totalProjectedInterest: s.schedule.totalProjectedInterest,
      interestSavedVs30Y: Math.max(
        0,
        baseline30.schedule.totalProjectedInterest - s.schedule.totalProjectedInterest
      ),
      crossoverYear: cross?.yearIndex ?? null,
    };
  });

  return {
    maxTermYears: MAX_MORTGAGE_TERM_YEARS,
    minSelectableYears,
    targetYears: clampedTargetYears,
    targetMonths: targetScenario.schedule.rows.length,
    baseline30PayoffDate: baseline30.schedule.estimatedPayoffDate,
    targetPayoffDate: targetScenario.schedule.estimatedPayoffDate,
    yearsSavedVs30Y,
    monthsSavedVs30Y,
    baseline30TotalInterest: baseline30.schedule.totalProjectedInterest,
    targetTotalInterest: targetScenario.schedule.totalProjectedInterest,
    interestSavedVs30Y,
    baselineMonthlyPrincipal: baseline30.monthlyPrincipal,
    requiredMonthlyPrincipal: targetScenario.monthlyPrincipal,
    monthlyPrincipalDelta: Math.max(
      0,
      targetScenario.monthlyPrincipal - baseline30.monthlyPrincipal
    ),
    firstBaselineMonthlyPayment: firstBaselineUnpaid?.totalPayment || 0,
    firstTargetMonthlyPayment: firstTargetUnpaid?.totalPayment || 0,
    peakTargetMonthlyPayment,
    crossoverYearBaseline: crossoverBaselineRow?.yearIndex ?? null,
    crossoverYearTarget: crossoverTargetRow?.yearIndex ?? null,
    transitionStartYear,
    transitionEndYear,
    transitionPoints,
    sweepByYears,
  };
}



