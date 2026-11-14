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
  REAL_BIDV_SKYONE_SNAPSHOT,
} from "./mortgageEngine";
import { MortgageContract } from "@/types/finance";

test("createDefaultSkyOneLoan khớp chính xác 100% sao kê BIDV thực tế (662.226.193đ, 5.5%/năm, 36 tháng)", () => {
  const contract = createDefaultSkyOneLoan("2026-11-14");
  const schedule = generateMortgageSchedule(contract, "2026-11-14");

  // 3 kỳ chuyển tiếp (09-11/2025) + 12 kỳ sao kê thật (10/12/2025 - 10/11/2026) = 15 kỳ PAID
  assert.equal(contract.paidRecords.length, 15);
  assert.equal(schedule.paidCount, 15);
  assert.equal(schedule.remainingBalance, REAL_BIDV_SKYONE_SNAPSHOT.verifiedRemainingBalanceNov2026);
  assert.equal(schedule.totalPrincipalPaid, REAL_BIDV_SKYONE_SNAPSHOT.verifiedPaidPrincipal12M);
  assert.equal(schedule.totalInterestPaid, REAL_BIDV_SKYONE_SNAPSHOT.verifiedPaidInterest12M);

  // Kỳ kế tiếp #16 đến hạn 2026-12-10
  assert.equal(schedule.nextUnpaidInstallment?.period, 16);
  assert.equal(schedule.nextUnpaidInstallment?.dueDate, "2026-12-10");
  assert.equal(schedule.nextUnpaidInstallment?.principal, 3_056_000);
  assert.equal(schedule.overdueCount, 0);

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

  assert.ok(metrics.equityContractPct > 30);
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

  // Điều chỉnh ngày tham chiếu gần kỳ #16 (2026-12-10) để kích hoạt DUE_SOON
  const nearDueSchedule = generateMortgageSchedule(contract, "2026-12-05");
  const reminders = evaluateSkyOneReminders(contract, nearDueSchedule);
  assert.ok(reminders.some((r) => r.id.startsWith("skyone_due_soon_")));
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
});

test("buildSkyOneAmortizationChartData chuẩn hóa tỷ lệ Gốc/Lãi, dư nợ giảm dần và 3 mốc tham chiếu", () => {
  const contract = createDefaultSkyOneLoan("2026-11-14");
  const schedule = generateMortgageSchedule(contract, "2026-11-14");
  const dataset = buildSkyOneAmortizationChartData(contract, schedule);

  assert.equal(dataset.points.length, 20);
  assert.equal(dataset.points[0].name, "Năm 1");
  assert.equal(dataset.points[0].openingBalance, contract.loanAmount);
  assert.equal(dataset.points[1].openingBalance, dataset.points[0].endingBalance);
  assert.equal(dataset.points[19].remainingDebtRatioPct, 0);

  for (const pt of dataset.points) {
    assert.ok(Math.abs(pt.principalSharePct + pt.interestSharePct - 100) < 0.05);
    assert.ok(pt.remainingDebtRatioPct >= 0 && pt.remainingDebtRatioPct <= 100);
  }
  assert.ok(dataset.points[19].principalSharePct > dataset.points[0].principalSharePct);

  // 3 mốc tham chiếu chuẩn: Hết cố định 36T -> Năm 3, Hiện tại kỳ #16 -> Năm 2
  assert.equal(dataset.milestones.fixedEndYearIndex, 3);
  assert.equal(dataset.milestones.fixedEndYearLabel, "Năm 3");
  assert.equal(dataset.milestones.currentYearIndex, 2);
  assert.equal(dataset.milestones.currentYearLabel, "Năm 2");
  assert.ok(dataset.milestones.equity50YearIndex !== null);
  assert.equal(dataset.milestones.alreadyAtEquity50AtStart, false);
});
