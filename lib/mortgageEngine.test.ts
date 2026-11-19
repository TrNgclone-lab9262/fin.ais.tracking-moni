import test from "node:test";
import assert from "node:assert/strict";
import {
  createDefaultSkyOneLoan,
  generateMortgageSchedule,
  simulatePrepayment,
  calculateRealEstateMetrics,
  calculateRateStressTest,
  evaluateSkyOneReminders,
  buildSkyOneAmortizationChartData,
  analyzeSkyOneStrategy,
  reconcileBidvSkyOneContract,
  calculateSkyOneTabMetrics,
  simulateTermReductionStrategy,
  MAX_MORTGAGE_TERM_MONTHS,
  MAX_MORTGAGE_TERM_YEARS,
  REAL_BIDV_SKYONE_SNAPSHOT,
} from "./mortgageEngine";
import { MortgageContract } from "@/types/finance";

test("createDefaultSkyOneLoan khớp chính xác 100% sao kê BIDV thực tế (662.226.193đ, 5.5%/năm, 36 tháng)", () => {
  const contract = createDefaultSkyOneLoan("2026-11-14");
  const schedule = generateMortgageSchedule(contract, "2026-11-14");

  // 3 kỳ chuyển tiếp (09-11/2025) + 12 kỳ sao kê thật (10/12/2025 - 10/11/2026) = 15 kỳ PAID, trong đó 12 kỳ Đã xác thực
  assert.equal(contract.paidRecords.length, 15);
  assert.equal(schedule.paidCount, 15);
  assert.equal(schedule.verifiedCount, 12);
  assert.equal(schedule.rows.find((r) => r.period === 3)?.isVerified, false);
  assert.equal(schedule.rows.find((r) => r.period === 4)?.isVerified, true);
  assert.equal(schedule.rows.find((r) => r.period === 15)?.isVerified, true);
  assert.equal(schedule.remainingBalance, REAL_BIDV_SKYONE_SNAPSHOT.verifiedRemainingBalanceNov2026);
  assert.equal(schedule.totalPrincipalPaid, REAL_BIDV_SKYONE_SNAPSHOT.verifiedPaidPrincipal12M);
  assert.equal(schedule.totalInterestPaid, REAL_BIDV_SKYONE_SNAPSHOT.verifiedPaidInterest12M);

  // Kỳ kế tiếp #16 đến hạn 2026-12-10
  assert.equal(schedule.nextUnpaidInstallment?.period, 16);
  assert.equal(schedule.nextUnpaidInstallment?.dueDate, "2026-12-10");
  assert.equal(schedule.nextUnpaidInstallment?.principal, 3_056_000);
  assert.equal(schedule.overdueCount, 0);

  // Xác minh đồng bộ dữ liệu HĐMB A.12A.07 + Giải ngân Đợt 2 Q3/2027
  assert.equal(contract.propertyValue, 1_573_480_430);
  assert.equal(contract.downPayment, 323_655_950);
  assert.equal(contract.creditLimit, 1_101_436_304);
  assert.equal(contract.plannedDisbursements?.length, 1);
  assert.equal(contract.plannedDisbursements?.[0]?.amount, 393_370_110);
  assert.equal(contract.plannedDisbursements?.[0]?.afterPeriod, 24);

  // Kỳ #36 rơi đúng tháng 08/2028 (cố định 36 tháng) và kỳ #37 (09/2028) chuyển sang thả nổi
  const period36 = schedule.rows.find((r) => r.period === 36);
  const period37 = schedule.rows.find((r) => r.period === 37);
  assert.equal(period36?.dueDate, "2028-08-10");
  assert.equal(period36?.stage, "FIXED");
  assert.equal(period36?.appliedRate, 5.5);
  assert.equal(period37?.dueDate, "2028-09-10");
  assert.equal(period37?.stage, "FLOATING");
});

test("generateMortgageSchedule giữ nguyên lịch sử và hỗ trợ 30/360 hoặc Actual/365 + giải ngân bổ sung", () => {
  const contract: MortgageContract = {
    ...createDefaultSkyOneLoan("2026-11-13"),
    loanAmount: 1_200_000_000,
    termMonths: 120,
    fixedRateMonths: 12,
    fixedInterestRate: 6.0,
    floatingBaseRate: 7.0,
    floatingSpread: 3.0,
    monthlyPrincipalOverride: 0,
    interestBasis: "THIRTY_360",
    paidRecords: [
      {
        period: 1,
        paidAt: "2025-12-15",
        paidPrincipal: 10_000_000,
        paidInterest: 6_000_000,
        appliedRate: 6.0,
      },
    ],
    rateAdjustments: [
      {
        id: "adj_1",
        effectiveFromPeriod: 2,
        annualRate: 9.0,
        effectiveDate: "2026-01-15",
        note: "Điều chỉnh thử",
      },
    ],
    plannedDisbursements: [
      {
        id: "tranche_test",
        afterPeriod: 2,
        date: "2025-10-10",
        amount: 200_000_000,
      },
    ],
  };

  const schedule = generateMortgageSchedule(contract, "2026-01-10");
  assert.equal(schedule.rows[0].appliedRate, 6.0);
  assert.equal(schedule.rows[0].interest, 6_000_000);
  assert.equal(schedule.rows[0].principal, 10_000_000);

  // Kỳ 2 chưa đóng áp dụng 9%/năm trên dư nợ 1.190.000.000đ
  assert.equal(schedule.rows[1].appliedRate, 9.0);
  assert.equal(schedule.rows[1].openingBalance, 1_190_000_000);
  assert.equal(schedule.rows[1].interest, 8_925_000);
  // Sau kỳ 2 cộng thêm giải ngân 200tr -> đầu kỳ 3 = 1.180tr + 200tr = 1.380tr
  assert.equal(schedule.rows[1].disbursedInPeriod, 200_000_000);
  assert.equal(schedule.rows[2].openingBalance, 1_380_000_000);
});

test("simulatePrepayment tính đúng phí phạt theo năm, lãi tiết kiệm ròng và rút ngắn kỳ hạn", () => {
  const contract = createDefaultSkyOneLoan("2026-11-14");

  const simShorten = simulatePrepayment(contract, {
    amount: 200_000_000,
    strategy: "SHORTEN_TERM",
    referenceDate: "2026-11-14",
  });

  // Đang sau kỳ 15 (năm vay thứ 2) => phí phạt năm 2 là 1.5% của 200tr = 3.000.000đ
  assert.equal(simShorten.penaltyFeePercent, 1.5);
  assert.equal(simShorten.penaltyAmount, 3_000_000);
  assert.ok(simShorten.monthsSaved > 20);
  assert.ok(simShorten.netInterestSaved > 50_000_000);

  const simReduce = simulatePrepayment(contract, {
    amount: 200_000_000,
    strategy: "REDUCE_MONTHLY",
    referenceDate: "2026-11-14",
  });

  assert.equal(simReduce.monthsSaved, 0);
  assert.ok(simReduce.monthlyPaymentReduction > 500_000);
});

test("calculateRealEstateMetrics & calculateRateStressTest tính chuẩn Equity %, DTI % và kịch bản +1/+2/+3%", () => {
  const contract = createDefaultSkyOneLoan("2026-11-14");
  const schedule = generateMortgageSchedule(contract, "2026-11-14");

  const metrics = calculateRealEstateMetrics(
    contract,
    schedule,
    50_000_000,
    "Thu nhập mẫu 2 vợ chồng"
  );

  assert.ok(metrics.equityContractPct > 20 && metrics.equityContractPct < 30);
  assert.ok(metrics.dtiPct > 5 && metrics.dtiPct < 25);

  const stress = calculateRateStressTest(
    contract,
    schedule,
    50_000_000,
    [0, 1, 2, 3],
    "2026-11-14"
  );
  assert.equal(stress.length, 4);
  assert.ok(stress[1].peakMonthlyPayment > stress[0].peakMonthlyPayment);
  assert.ok(stress[3].dtiPct > stress[0].dtiPct);

  // > 10 ngày trước hạn (2026-11-14 -> 2026-12-10 là 26 ngày): không hiện thanh nhắc liên trang
  const farReminders = evaluateSkyOneReminders(contract, schedule);
  assert.equal(farReminders.length, 0);

  // Điều chỉnh ngày tham chiếu gần kỳ #16 (2026-12-10, <= 10 ngày) để kích hoạt DUE_SOON
  const nearDueSchedule = generateMortgageSchedule(contract, "2026-12-05");
  const reminders = evaluateSkyOneReminders(contract, nearDueSchedule);
  assert.ok(reminders.some((r) => r.id.startsWith("skyone_due_soon_")));

  // Kiểm tra các chỉ số chuyên biệt từng tab SKYONE
  const tabMetrics = calculateSkyOneTabMetrics(contract, schedule, "2026-11-14");
  assert.equal(tabMetrics.creditLimit, 1_101_436_304);
  assert.ok(tabMetrics.disbursedRatioPct > 60 && tabMetrics.disbursedRatioPct < 70);
  assert.equal(tabMetrics.currentLoanYear, 2);
  assert.equal(tabMetrics.currentPenaltyPercent, 1.5);
  assert.equal(tabMetrics.zeroPenaltyFromYear, 4);
  assert.ok(tabMetrics.interestToPrincipalRatioPct > 0);
  assert.ok(tabMetrics.principalExceedsInterestPeriod !== null);
});

test("analyzeSkyOneStrategy lượng hóa đúng lợi thế Positive Carry + Đánh chặn Quỹ Đệm 08/2028", () => {
  const contract = createDefaultSkyOneLoan("2026-11-14");
  const result = analyzeSkyOneStrategy(contract, {
    nextDisbursementAmount: 437_933_807,
    nextDisbursementAfterPeriod: 21,
    projectedFloatingRate: 10.0,
    safeSavingsYieldRate: 6.2,
    monthlyBufferContribution: 8_000_000,
    expectedMonthlyRent: 7_500_000,
    monthlyFamilyIncome: 50_000_000,
    referenceDate: "2026-11-14",
  });

  // Từ kỳ 16 đến kỳ 36 là 21 tháng còn lại ở mức 5.5%
  assert.equal(result.monthsRemainingFixed, 21);
  assert.equal(result.fixedEndDate, "2028-08-10");
  assert.equal(result.firstFloatingDate, "2028-09-10");
  assert.equal(result.penaltyAtResetPct, 0);
  assert.ok(result.totalBufferAtReset > 168_000_000);
  // Gửi 6.2% > vay 5.5% + tránh phạt năm 2-3 => chênh lệch lợi thế ròng > 0
  assert.ok(result.netStrategyAdvantage > 0);
  assert.ok(result.postResetMonthlyPaymentWithStrike < result.postResetMonthlyPaymentNoStrike);
  assert.ok(result.timelinePoints.length >= 40);

  // Kiểm tra cảnh báo DTI 3 mốc + gợi ý giảm DTI (thu nhập 25tr để kích hoạt mốc 3 > 30%)
  const tightIncomeResult = analyzeSkyOneStrategy(contract, {
    nextDisbursementAmount: 437_933_807,
    nextDisbursementAfterPeriod: 21,
    projectedFloatingRate: 10.0,
    safeSavingsYieldRate: 6.2,
    monthlyBufferContribution: 8_000_000,
    expectedMonthlyRent: 7_500_000,
    monthlyFamilyIncome: 25_000_000,
    referenceDate: "2026-11-14",
  });
  assert.equal(tightIncomeResult.dtiDiagnostics.currentStatus, "SAFE");
  assert.equal(tightIncomeResult.dtiDiagnostics.hasWarningAtAnyStage, true);
  assert.equal(tightIncomeResult.dtiDiagnostics.noStrikeStatus, "HIGH");
  assert.ok(tightIncomeResult.dtiDiagnostics.recommendedMonthlyContributionForSafeDti > 0);
  assert.ok(tightIncomeResult.dtiDiagnostics.requiredRentForSafeDti > 0);
  assert.ok(tightIncomeResult.dtiDiagnostics.requiredIncomeForSafeDti > 25_000_000);
});

test("reconcileBidvSkyOneContract tự động nâng cấp hồ sơ mẫu cũ hoặc thiếu nhãn Đã xác thực nhưng bảo toàn hợp đồng tùy chỉnh", () => {
  // 1. Hồ sơ mẫu cũ 1.505 tỷ / 6.8%
  const legacyMock: MortgageContract = {
    ...createDefaultSkyOneLoan("2026-11-14"),
    accountNumber: undefined,
    loanAmount: 1_505_000_000,
    fixedInterestRate: 6.8,
    disbursementDate: "2025-11-15",
    paidRecords: [],
  };
  const upgraded = reconcileBidvSkyOneContract(legacyMock, "2026-11-14");
  assert.equal(upgraded.didAutoSync, true);
  assert.equal(upgraded.contract.accountNumber, "8866102943");
  assert.equal(upgraded.contract.paidRecords.filter((r) => r.isVerified).length, 12);

  // 2. Nâng cấp hồ sơ tham chiếu cũ 2.15 tỷ / 68m² sang HĐMB thật A.12A.07 (1.573 tỷ / 323.65tr)
  const legacyEstimatedSkyOne: MortgageContract = {
    ...createDefaultSkyOneLoan("2026-11-14"),
    unitCode: "Căn hộ 2PN · 68m² · Tháp A",
    propertyValue: 2_150_000_000,
    downPayment: 645_000_000,
    plannedDisbursements: [],
  };
  const syncedHdmb = reconcileBidvSkyOneContract(legacyEstimatedSkyOne, "2026-11-14");
  assert.equal(syncedHdmb.didAutoSync, true);
  assert.equal(syncedHdmb.contract.propertyValue, 1_573_480_430);
  assert.equal(syncedHdmb.contract.downPayment, 323_655_950);
  assert.equal(syncedHdmb.contract.plannedDisbursements?.[0]?.amount, 393_370_110);

  // 3. Hợp đồng tùy chỉnh của ngân hàng khác không bị ghi đè
  const customLoan: MortgageContract = {
    ...createDefaultSkyOneLoan("2026-11-14"),
    id: "custom_vcb",
    bankName: "Vietcombank",
    accountNumber: "999888777",
    loanAmount: 900_000_000,
    paidRecords: [],
  };
  const untouched = reconcileBidvSkyOneContract(customLoan, "2026-11-14");
  assert.equal(untouched.didAutoSync, false);
  assert.equal(untouched.contract.bankName, "Vietcombank");
  assert.equal(untouched.contract.loanAmount, 900_000_000);
});

test("buildSkyOneAmortizationChartData chuẩn hóa tỷ lệ Gốc/Lãi, dư nợ giảm dần và 3 mốc tham chiếu", () => {
  const contract = createDefaultSkyOneLoan("2026-11-14");
  const schedule = generateMortgageSchedule(contract, "2026-11-14");
  const dataset = buildSkyOneAmortizationChartData(contract, schedule);

  const lastIdx = dataset.points.length - 1;
  assert.ok(dataset.points.length >= 20 && dataset.points.length <= 30);
  assert.equal(dataset.points[0].name, "Năm 1");
  assert.equal(dataset.points[0].openingBalance, contract.loanAmount);
  assert.equal(dataset.points[1].openingBalance, dataset.points[0].endingBalance);
  assert.equal(dataset.points[lastIdx].remainingDebtRatioPct, 0);

  for (const pt of dataset.points) {
    assert.ok(Math.abs(pt.principalSharePct + pt.interestSharePct - 100) < 0.05);
    assert.ok(pt.remainingDebtRatioPct >= 0 && pt.remainingDebtRatioPct <= 100);
  }
  assert.ok(dataset.points[lastIdx].principalSharePct > dataset.points[0].principalSharePct);

  // 3 mốc tham chiếu chuẩn: Hết cố định 36T -> Năm 3, Hiện tại kỳ #16 -> Năm 2
  assert.equal(dataset.milestones.fixedEndYearIndex, 3);
  assert.equal(dataset.milestones.fixedEndYearLabel, "Năm 3");
  assert.equal(dataset.milestones.currentYearIndex, 2);
  assert.equal(dataset.milestones.currentYearLabel, "Năm 2");
  assert.ok(dataset.milestones.equity50YearIndex !== null);
  assert.equal(dataset.milestones.alreadyAtEquity50AtStart, false);
});

test("giới hạn trần vay tối đa 30 năm (360 tháng) trong generateMortgageSchedule", () => {
  assert.equal(MAX_MORTGAGE_TERM_YEARS, 30);
  assert.equal(MAX_MORTGAGE_TERM_MONTHS, 360);

  const oversized: MortgageContract = {
    ...createDefaultSkyOneLoan("2026-11-14"),
    loanAmount: 1_800_000_000,
    termMonths: 420,
    fixedRateMonths: 400,
    monthlyPrincipalOverride: 0,
    paidRecords: [],
  };

  const schedule = generateMortgageSchedule(oversized, "2026-11-14");
  assert.equal(schedule.totalScheduledMonths, 360);
  assert.equal(schedule.rows.length, 360);
  assert.equal(schedule.rows[359].closingBalance, 0);
});

test("periodOverrides điều chỉnh trực tiếp Lãi trả nợ, Gốc, Lãi suất từng kỳ và được reconcile bảo toàn", () => {
  const base = createDefaultSkyOneLoan("2026-11-14");
  const modified: MortgageContract = {
    ...base,
    cashflowLocked: true,
    periodOverrides: [
      {
        period: 15,
        interest: 2_950_000,
        note: "Điều chỉnh lãi kỳ 15",
      },
      {
        period: 16,
        principal: 5_000_000,
        interest: 3_100_000,
        appliedRate: 5.8,
        note: "Trả thêm gốc kỳ 16",
      },
    ],
  };

  const schedule = generateMortgageSchedule(modified, "2026-11-14");
  const p15 = schedule.rows.find((r) => r.period === 15);
  const p16 = schedule.rows.find((r) => r.period === 16);
  const p17 = schedule.rows.find((r) => r.period === 17);

  assert.equal(p15?.interest, 2_950_000);
  assert.equal(p15?.isCashflowOverridden, true);
  assert.equal(p15?.overrideNote, "Điều chỉnh lãi kỳ 15");

  assert.equal(p16?.principal, 5_000_000);
  assert.equal(p16?.interest, 3_100_000);
  assert.equal(p16?.appliedRate, 5.8);
  assert.equal(p16?.totalPayment, 8_100_000);
  assert.equal(p16?.isCashflowOverridden, true);
  // Kiểm tra dư nợ chuyển tiếp từ kỳ 16 -> 17 khớp chính xác
  assert.equal(p17?.openingBalance, p16?.closingBalance);

  // Bảo toàn khi reconcile chạy
  const recResult = reconcileBidvSkyOneContract(modified, "2026-11-14");
  assert.equal(recResult.didAutoSync, false);
  assert.equal(recResult.contract.periodOverrides?.length, 2);

  // Cũng bảo toàn khi đang mở khóa (cashflowLocked === false)
  const unlockedResult = reconcileBidvSkyOneContract(
    { ...base, cashflowLocked: false, periodOverrides: [] },
    "2026-11-14"
  );
  assert.equal(unlockedResult.didAutoSync, false);
});

test("simulateTermReductionStrategy mô phỏng giảm số năm vay từ trần 30 năm và chuyển động Lãi/Gốc trong dải chuyển", () => {
  const contract = createDefaultSkyOneLoan("2026-11-14");

  const sim20 = simulateTermReductionStrategy(contract, {
    targetYears: 20,
    projectedFloatingRate: 10.0,
    extraDisbursementAmount: 437_933_807,
    extraDisbursementAfterPeriod: 21,
    referenceDate: "2026-11-14",
  });

  const sim10 = simulateTermReductionStrategy(contract, {
    targetYears: 10,
    projectedFloatingRate: 10.0,
    extraDisbursementAmount: 437_933_807,
    extraDisbursementAfterPeriod: 21,
    referenceDate: "2026-11-14",
  });

  assert.equal(sim20.maxTermYears, 30);
  assert.equal(sim20.targetYears, 20);
  assert.equal(sim20.yearsSavedVs30Y, 10);
  assert.ok(sim20.interestSavedVs30Y > 0);
  assert.ok(sim10.interestSavedVs30Y > sim20.interestSavedVs30Y);
  assert.ok(sim10.requiredMonthlyPrincipal > sim20.requiredMonthlyPrincipal);
  assert.ok(sim20.transitionPoints.length === 30);
  assert.ok(sim20.transitionPoints.some((pt) => pt.stage === "TRANSITION"));
  assert.ok(sim20.transitionPoints.some((pt) => pt.stage === "PAID_OFF"));
  assert.ok(sim20.sweepByYears.some((s) => s.years === 30 && s.interestSavedVs30Y === 0));
  assert.ok(
    (sim10.crossoverYearTarget ?? 99) <= (sim20.crossoverYearTarget ?? 99)
  );
  assert.ok(
    sim20.transitionPoints[29].cumulativeBaselineInterest >=
      sim20.transitionPoints[0].cumulativeBaselineInterest
  );
  assert.equal(
    sim20.transitionPoints[29].cumulativeBaselineInterest,
    sim20.baseline30TotalInterest
  );
});

