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
} from "./mortgageEngine";
import { MortgageContract } from "@/types/finance";

test("createDefaultSkyOneLoan đánh dấu sẵn các kỳ đã qua đến ngày hiện tại và giữ kỳ kế tiếp chờ đóng", () => {
  const contract = createDefaultSkyOneLoan("2026-11-13");
  const schedule = generateMortgageSchedule(contract, "2026-11-13");

  // Giải ngân 2025-11-15 -> kỳ 1 (2025-12-15) đến kỳ 11 (2026-10-15) đã qua => 11 kỳ PAID
  assert.equal(contract.paidRecords.length, 11);
  assert.equal(schedule.paidCount, 11);
  assert.equal(schedule.nextUnpaidInstallment?.period, 12);
  assert.equal(schedule.nextUnpaidInstallment?.dueDate, "2026-11-15");
  assert.equal(schedule.nextUnpaidInstallment?.status, "DUE_SOON");
  assert.equal(schedule.overdueCount, 0);
});

test("generateMortgageSchedule áp dụng chuẩn dư nợ giảm dần không ân hạn gốc và giữ nguyên lịch sử khi chỉnh lãi suất tương lai", () => {
  const contract: MortgageContract = {
    ...createDefaultSkyOneLoan("2026-11-13"),
    loanAmount: 1_200_000_000,
    termMonths: 120,
    fixedRateMonths: 12,
    fixedInterestRate: 6.0,
    floatingBaseRate: 7.0,
    floatingSpread: 3.0,
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
  };

  const schedule = generateMortgageSchedule(contract, "2026-01-10");
  // Kỳ 1 đã đóng giữ nguyên lãi suất 6.0% và lãi 6.000.000đ
  assert.equal(schedule.rows[0].appliedRate, 6.0);
  assert.equal(schedule.rows[0].interest, 6_000_000);
  assert.equal(schedule.rows[0].principal, 10_000_000);

  // Kỳ 2 chưa đóng áp dụng mốc 9.0%/năm trên dư nợ 1.190.000.000đ => lãi = 1.19B * 9% / 12 = 8.925.000đ
  assert.equal(schedule.rows[1].appliedRate, 9.0);
  assert.equal(schedule.rows[1].openingBalance, 1_190_000_000);
  assert.equal(schedule.rows[1].interest, 8_925_000);
});

test("simulatePrepayment tính đúng phí phạt theo năm, lãi tiết kiệm ròng và rút ngắn kỳ hạn", () => {
  const contract = createDefaultSkyOneLoan("2026-11-13");

  const simShorten = simulatePrepayment(contract, {
    amount: 200_000_000,
    strategy: "SHORTEN_TERM",
    referenceDate: "2026-11-13",
  });

  // Đang ở kỳ 12 (cuối năm 1) => phí phạt năm 1 là 2.0% của 200tr = 4.000.000đ
  assert.equal(simShorten.penaltyFeePercent, 2.0);
  assert.equal(simShorten.penaltyAmount, 4_000_000);
  assert.ok(simShorten.monthsSaved > 20);
  assert.ok(simShorten.netInterestSaved > 100_000_000);

  const simReduce = simulatePrepayment(contract, {
    amount: 200_000_000,
    strategy: "REDUCE_MONTHLY",
    referenceDate: "2026-11-13",
  });

  assert.equal(simReduce.monthsSaved, 0);
  assert.ok(simReduce.monthlyPaymentReduction > 1_500_000);
});

test("calculateRealEstateMetrics & calculateRateStressTest tính chuẩn Equity %, DTI % và kịch bản +1/+2/+3%", () => {
  const contract = createDefaultSkyOneLoan("2026-11-13");
  const schedule = generateMortgageSchedule(contract, "2026-11-13");

  const metrics = calculateRealEstateMetrics(
    contract,
    schedule,
    50_000_000,
    "Thu nhập mẫu 2 vợ chồng"
  );

  assert.ok(metrics.equityContractPct > 30);
  assert.ok(metrics.dtiPct > 20 && metrics.dtiPct < 40);

  const stress = calculateRateStressTest(
    contract,
    schedule,
    50_000_000,
    [0, 1, 2, 3],
    "2026-11-13"
  );
  assert.equal(stress.length, 4);
  assert.ok(stress[1].peakMonthlyPayment > stress[0].peakMonthlyPayment);
  assert.ok(stress[3].dtiPct > stress[0].dtiPct);

  const reminders = evaluateSkyOneReminders(contract, schedule);
  assert.ok(reminders.some((r) => r.id.startsWith("skyone_due_soon_")));
});

test("buildSkyOneAmortizationChartData chuẩn hóa tỷ lệ Gốc/Lãi, dư nợ giảm dần và 3 mốc tham chiếu", () => {
  const contract = createDefaultSkyOneLoan("2026-11-13");
  const schedule = generateMortgageSchedule(contract, "2026-11-13");
  const dataset = buildSkyOneAmortizationChartData(contract, schedule);

  assert.equal(dataset.points.length, 20);
  assert.equal(dataset.points[0].name, "Năm 1");
  assert.equal(dataset.points[0].openingBalance, contract.loanAmount);
  assert.equal(dataset.points[1].openingBalance, dataset.points[0].endingBalance);
  assert.equal(dataset.points[19].name, "Năm 20");
  assert.equal(dataset.points[19].remainingDebtRatioPct, 0);

  // Mỗi năm tổng % Gốc + % Lãi = 100%, và tỷ trọng Gốc năm cuối > năm đầu
  for (const pt of dataset.points) {
    assert.ok(Math.abs(pt.principalSharePct + pt.interestSharePct - 100) < 0.05);
    assert.ok(pt.remainingDebtRatioPct >= 0 && pt.remainingDebtRatioPct <= 100);
  }
  assert.ok(dataset.points[19].principalSharePct > dataset.points[0].principalSharePct);

  // 3 mốc tham chiếu chuẩn: Hết cố định (24T -> Năm 2), Hiện tại (Kỳ 12 -> Năm 1), Equity 50%
  assert.equal(dataset.milestones.fixedEndYearIndex, 2);
  assert.equal(dataset.milestones.fixedEndYearLabel, "Năm 2");
  assert.equal(dataset.milestones.currentYearIndex, 1);
  assert.equal(dataset.milestones.currentYearLabel, "Năm 1");
  assert.ok(dataset.milestones.equity50YearIndex !== null && dataset.milestones.equity50YearIndex > 1);
  assert.equal(dataset.milestones.alreadyAtEquity50AtStart, false);

  // Trả gốc trước hạn lớn đẩy mốc Equity 50% về sớm hơn
  const prepaidContract: MortgageContract = {
    ...contract,
    prepayments: [
      {
        id: "prepay_test_1",
        date: "2026-11-13",
        afterPeriod: 11,
        amount: 500_000_000,
        feePercent: 2.0,
        penaltyAmount: 10_000_000,
        strategy: "SHORTEN_TERM",
      },
    ],
  };
  const prepaidSchedule = generateMortgageSchedule(prepaidContract, "2026-11-13");
  const prepaidDataset = buildSkyOneAmortizationChartData(prepaidContract, prepaidSchedule);
  assert.ok(prepaidDataset.points.length < dataset.points.length);
  assert.ok(
    prepaidDataset.milestones.equity50YearIndex !== null &&
      dataset.milestones.equity50YearIndex !== null &&
      prepaidDataset.milestones.equity50YearIndex < dataset.milestones.equity50YearIndex
  );
});
