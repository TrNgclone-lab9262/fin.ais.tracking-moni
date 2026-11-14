import {
  MortgageContract,
  MortgageInstallmentStatus,
  MortgagePaidInstallmentRecord,
  MortgagePrepayStrategy,
  MortgagePrepaymentPenaltyTier,
  MortgageStage,
  Transaction,
} from "@/types/finance";

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
  closingBalance: number;
  cumulativePrincipalPaid: number;
  cumulativeInterestPaid: number;
  status: MortgageInstallmentStatus;
  daysUntilDue: number;
  paidRecord?: MortgagePaidInstallmentRecord;
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
  const paidMap = new Map<number, MortgagePaidInstallmentRecord>();
  contract.paidRecords.forEach((rec) => paidMap.set(rec.period, rec));

  const sortedAdjustments = [...contract.rateAdjustments].sort(
    (a, b) => a.effectiveFromPeriod - b.effectiveFromPeriod
  );

  const prepayByPeriod = new Map<number, typeof contract.prepayments>();
  contract.prepayments.forEach((p) => {
    const arr = prepayByPeriod.get(p.afterPeriod) || [];
    arr.push(p);
    prepayByPeriod.set(p.afterPeriod, arr);
  });

  const rows: MortgageScheduleRow[] = [];
  let remainingBalance = Math.max(0, contract.loanAmount);
  let scheduledMonthlyPrincipal = Math.round(
    contract.loanAmount / Math.max(1, contract.termMonths)
  );
  let totalPrepaidAmount = 0;

  // Handle period 0 prepayments if recorded before period 1
  const prepayZero = prepayByPeriod.get(0);
  if (prepayZero && prepayZero.length > 0) {
    for (const p of prepayZero) {
      const applied = Math.min(remainingBalance, p.amount);
      remainingBalance = Math.max(0, remainingBalance - applied);
      totalPrepaidAmount += applied;
      if (p.strategy === "REDUCE_MONTHLY" && remainingBalance > 0) {
        scheduledMonthlyPrincipal = Math.round(
          remainingBalance / Math.max(1, contract.termMonths)
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
  let overdueCount = 0;
  let dueSoonCount = 0;

  for (
    let period = 1;
    period <= contract.termMonths && remainingBalance > 0;
    period++
  ) {
    const dueDate = addMonthsToDay(
      contract.disbursementDate,
      period,
      contract.paymentDayOfMonth
    );
    const monthKey = dueDate.slice(0, 7);
    const yearIndex = Math.ceil(period / 12);
    const stage: MortgageStage =
      period <= contract.fixedRateMonths ? "FIXED" : "FLOATING";

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
      // Preserve historical snapshot untouched
      appliedRate = paidRec.appliedRate;
      principal = Math.min(openingBalance, Math.round(paidRec.paidPrincipal));
      interest = Math.round(paidRec.paidInterest);
    } else {
      const activeAdj = [...sortedAdjustments]
        .reverse()
        .find((a) => a.effectiveFromPeriod <= period);
      if (activeAdj) {
        appliedRate = activeAdj.annualRate;
        isCustomRateAdjusted = true;
        rateNote = activeAdj.note;
      }

      interest = Math.round((openingBalance * (appliedRate / 100)) / 12);
      const isFinalTerm = period === contract.termMonths;
      if (isFinalTerm || scheduledMonthlyPrincipal >= openingBalance) {
        principal = openingBalance;
      } else {
        principal = scheduledMonthlyPrincipal;
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
          const remainingMonths = Math.max(1, contract.termMonths - period);
          scheduledMonthlyPrincipal = Math.round(closingBalance / remainingMonths);
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
      closingBalance,
      cumulativePrincipalPaid,
      cumulativeInterestPaid,
      status,
      daysUntilDue,
      paidRecord: paidRec,
    });

    remainingBalance = closingBalance;
  }

  // Aggregate by Loan Year for Recharts
  const yearlyMap = new Map<number, MortgageYearlyAggregate>();
  let runningEquityPrincipal = totalPrepaidAmount;

  for (const row of rows) {
    runningEquityPrincipal += row.principal;
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
      contract.downPayment + (contract.loanAmount - row.closingBalance)
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
    unpaidCount: rows.length - paidCount,
    overdueCount,
    dueSoonCount,
    totalPrincipalPaid: totalPrincipalPaidActual,
    totalInterestPaid: totalInterestPaidActual,
    totalPrepaidAmount,
    totalPrepaymentPenaltyPaid,
    totalProjectedInterest,
    totalProjectedCost:
      contract.loanAmount + totalProjectedInterest + totalPrepaymentPenaltyPaid,
    nextUnpaidInstallment,
    currentReferencePeriod,
    estimatedPayoffDate:
      rows[rows.length - 1]?.dueDate || contract.disbursementDate,
    monthsShortenedFromOriginal: Math.max(0, contract.termMonths - rows.length),
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
  } else if (nextRow && nextRow.status === "UPCOMING") {
    reminders.push({
      id: `skyone_upcoming_${nextRow.period}`,
      severity: "info",
      title: `Kỳ tiếp theo #${nextRow.period} đến hạn ngày ${nextRow.dueDate}`,
      message: `Còn ${nextRow.daysUntilDue} ngày tới kỳ thanh toán kế tiếp (${
        nextRow.stage === "FIXED" ? "giai đoạn lãi cố định" : "giai đoạn lãi thả nổi"
      }).`,
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

export function createDefaultSkyOneLoan(
  referenceDate: string = getTodayIsoDate()
): MortgageContract {
  const baseContract: MortgageContract = {
    id: "skyone_apartment_loan",
    projectName: "Phú Đông SKYONE",
    unitCode: "Căn hộ 2PN · 68m² · Tháp A",
    bankName: "BIDV Liên kết CĐT",
    propertyValue: 2_150_000_000,
    currentMarketValue: 2_280_000_000,
    downPayment: 645_000_000,
    loanAmount: 1_505_000_000,
    termMonths: 240,
    disbursementDate: "2025-11-15",
    paymentDayOfMonth: 15,
    fixedRateMonths: 24,
    fixedInterestRate: 6.8,
    floatingBaseRate: 7.0,
    floatingSpread: 3.5,
    prepayStrategyDefault: "SHORTEN_TERM",
    prepaymentPenaltyTiers: [
      { fromYear: 1, toYear: 1, feePercent: 2.0 },
      { fromYear: 2, toYear: 2, feePercent: 1.5 },
      { fromYear: 3, toYear: 3, feePercent: 1.0 },
      { fromYear: 4, toYear: 30, feePercent: 0 },
    ],
    rateAdjustments: [],
    paidRecords: [],
    prepayments: [],
    updatedAt: `${referenceDate}T08:00:00.000Z`,
  };

  const baseline = generateMortgageSchedule(baseContract, referenceDate);
  const autoPaidRecords: MortgagePaidInstallmentRecord[] = baseline.rows
    .filter((row) => row.dueDate < referenceDate)
    .map((row) => ({
      period: row.period,
      paidAt: row.dueDate,
      paidPrincipal: row.principal,
      paidInterest: row.interest,
      appliedRate: row.appliedRate,
      note: "Khởi tạo lịch sử đã đóng đúng hạn",
    }));

  return {
    ...baseContract,
    paidRecords: autoPaidRecords,
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
  const points: SkyOneYearlyChartPoint[] = schedule.yearlySummary.map((y) => {
    const remainingDebtRatioPct =
      contract.loanAmount > 0
        ? Math.min(100, Math.max(0, Number(((y.endingBalance / contract.loanAmount) * 100).toFixed(1))))
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

