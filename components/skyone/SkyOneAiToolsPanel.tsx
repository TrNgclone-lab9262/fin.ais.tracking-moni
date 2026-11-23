"use client";

import React, { useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  FileScan,
  Loader2,
  Sparkles,
  TrendingDown,
  Upload,
} from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { formatVNDMasked } from "@/lib/formatters";
import { generateMortgageSchedule } from "@/lib/mortgageEngine";
import { computeGoldPortfolioMetrics } from "@/lib/goldEngine";
import { calculateScenarioBoq } from "@/lib/interiorBoqEngine";
import {
  requestSkyOneStrategy,
  scanLoanStatementWithGemini,
  ScannedLoanStatementResult,
  SkyOneStrategyResponse,
} from "@/lib/skyoneAiService";

const ACTION_LABEL_MAP: Record<SkyOneStrategyResponse["recommendedAction"], string> = {
  PREPAY_SKYONE: "Ưu tiên trả gốc SKYONE",
  HOLD_GOLD_AND_CASH: "Giữ Vàng & Thanh khoản",
  HYBRID_SPLIT: "Phân bổ kết hợp linh hoạt",
  RESERVE_FOR_INTERIOR: "Ưu tiên quỹ Nội thất bàn giao",
};

export function SkyOneAiToolsPanel() {
  const {
    skyoneLoan,
    goldPortfolio,
    interiorStudio,
    unifiedNetWorth,
    summary,
    accounts,
    isPrivacyMode,
    confirmSkyOnePeriods,
    addSkyOneRateAdjustment,
  } = useFinance();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<ScannedLoanStatementResult | null>(null);
  const [applyFeedback, setApplyFeedback] = useState<string | null>(null);

  const [strategyLoading, setStrategyLoading] = useState(false);
  const [strategyError, setStrategyError] = useState<string | null>(null);
  const [strategyResult, setStrategyResult] = useState<SkyOneStrategyResponse | null>(null);
  const [extraCashInput, setExtraCashInput] = useState<string>("50000000");

  const scheduleSummary = useMemo(() => generateMortgageSchedule(skyoneLoan), [skyoneLoan]);
  const goldMetrics = useMemo(() => computeGoldPortfolioMetrics(goldPortfolio), [goldPortfolio]);
  const activeScenario = useMemo(
    () =>
      interiorStudio.scenarios.find((s) => s.id === interiorStudio.activeScenarioId) ||
      interiorStudio.scenarios[0],
    [interiorStudio]
  );
  const boqSummary = useMemo(
    () => (activeScenario ? calculateScenarioBoq(activeScenario) : null),
    [activeScenario]
  );

  const defaultBankAccountId = useMemo(
    () =>
      accounts.find((a) => a.type === "BANK" && a.owner === "HUSBAND")?.id ||
      accounts.find((a) => a.type === "BANK")?.id ||
      accounts[0]?.id ||
      "acc_husband_bidv",
    [accounts]
  );

  const handleScanFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanLoading(true);
    setScanError(null);
    setApplyFeedback(null);
    try {
      const res = await scanLoanStatementWithGemini(file, {
        currentPeriodHint: scheduleSummary.nextUnpaidInstallment?.period,
        currentBalanceVnd: Math.round(scheduleSummary.remainingBalance),
      });
      setScanResult(res);
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "Không thể quét thông báo BIDV.");
    } finally {
      setScanLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleApplyPaidInstallment = () => {
    if (!scanResult) return;
    const targetPeriod =
      scanResult.period > 0
        ? scanResult.period
        : scheduleSummary.nextUnpaidInstallment?.period ?? 1;
    const payDate = scanResult.paymentDate || new Date().toISOString().slice(0, 10);
    confirmSkyOnePeriods([targetPeriod], {
      linkAccountId: defaultBankAccountId,
      paidAt: payDate,
      note: scanResult.bankNote || "Quét thông báo thu nợ BIDV",
    });
    setApplyFeedback(`Đã ghi nhận tất toán Kỳ #${targetPeriod} và đồng bộ sổ chi FINANCE.`);
  };

  const handleApplyRateAdjustment = () => {
    if (!scanResult || scanResult.newInterestRatePct <= 0) return;
    const fromPeriod =
      scanResult.period > 0
        ? scanResult.period
        : scheduleSummary.nextUnpaidInstallment?.period ?? 1;
    addSkyOneRateAdjustment({
      effectiveFromPeriod: fromPeriod,
      annualRate: scanResult.newInterestRatePct,
      effectiveDate: scanResult.effectiveFromDate || new Date().toISOString().slice(0, 10),
      note: scanResult.bankNote || "Cập nhật lãi suất từ thông báo BIDV",
    });
    setApplyFeedback(
      `Đã thêm mốc lãi suất ${scanResult.newInterestRatePct}%/năm áp dụng từ Kỳ #${fromPeriod}.`
    );
  };

  const handleRunStrategy = async () => {
    setStrategyLoading(true);
    setStrategyError(null);
    try {
      const extraCash = Math.max(0, Number(extraCashInput.replace(/[^\d]/g, "")) || 100_000_000);
      const nextRow = scheduleSummary.nextUnpaidInstallment;
      const monthlyPaymentVnd = Math.round(nextRow?.totalPayment ?? 15_000_000);
      const monthlySurplusVnd = Math.round(summary.monthlyIncome - summary.monthlyExpense);
      const dtiPct =
        summary.monthlyIncome > 0
          ? Math.min(200, Math.round((monthlyPaymentVnd / summary.monthlyIncome) * 1000) / 10)
          : 30;
      const equityPct =
        unifiedNetWorth.skyonePropertyValueVnd > 0
          ? Math.min(
              100,
              Math.max(
                0,
                Math.round(
                  (unifiedNetWorth.skyoneEquityVnd / unifiedNetWorth.skyonePropertyValueVnd) * 1000
                ) / 10
              )
            )
          : 30;

      const res = await requestSkyOneStrategy({
        projectName: skyoneLoan.projectName,
        remainingBalanceVnd: Math.round(scheduleSummary.remainingBalance),
        currentInterestRatePct:
          scheduleSummary.currentApplicableRate || skyoneLoan.fixedInterestRate || 5.5,
        projectedFloatingRatePct:
          Math.round((skyoneLoan.floatingBaseRate + skyoneLoan.floatingSpread) * 100) / 100,
        remainingMonths: Math.max(0, scheduleSummary.unpaidCount),
        monthlyPaymentVnd,
        prepaymentPenaltyPct: skyoneLoan.prepaymentPenaltyTiers?.[0]?.feePercent ?? 1,
        dtiPct,
        equityPct,
        liquidCashVnd: Math.round(unifiedNetWorth.liquidCashVnd),
        monthlyNetSurplusVnd: monthlySurplusVnd,
        goldBidValueVnd: Math.round(goldMetrics.totalLiquidationValueBid),
        goldUnrealizedPnlVnd: Math.round(goldMetrics.unrealizedPnl),
        goldTotalChi: Number(goldMetrics.totalRemainingChi.toFixed(4)),
        interiorBudgetRemainingVnd: Math.max(
          0,
          Math.round(boqSummary?.remainingToPayVnd ?? 0)
        ),
        targetExtraPrepayVnd: extraCash,
      });
      setStrategyResult(res);
    } catch (err) {
      setStrategyError(
        err instanceof Error ? err.message : "Chưa thể phân tích chiến lược lúc này."
      );
    } finally {
      setStrategyLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Card 1: OCR Thông báo thu nợ BIDV */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
              <FileScan className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Quét Thông báo BIDV (AI OCR)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tải ảnh hoặc PDF thông báo thu nợ / điều chỉnh lãi suất để đối soát 1 chạm.
              </p>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => void handleScanFile(e)}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={scanLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white disabled:opacity-50 shrink-0 transition-colors cursor-pointer"
          >
            {scanLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5" />
            )}
            Tải thông báo
          </button>
        </div>

        {scanError && (
          <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 px-3 py-2 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{scanError}</span>
          </div>
        )}

        {applyFeedback && (
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{applyFeedback}</span>
          </div>
        )}

        {scanResult ? (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3.5 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
              <div>
                <span className="text-slate-500 dark:text-slate-400">Kỳ / Ngày trả</span>
                <p className="font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                  {scanResult.period > 0 ? `Kỳ #${scanResult.period}` : "Theo lịch tới"} ·{" "}
                  {scanResult.paymentDate || "—"}
                </p>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400">Tổng phải thu</span>
                <p className="font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                  {scanResult.totalPaidVnd > 0
                    ? formatVNDMasked(scanResult.totalPaidVnd, isPrivacyMode)
                    : "—"}
                </p>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400">Lãi suất áp dụng</span>
                <p className="font-semibold text-amber-600 dark:text-amber-400 tabular-nums">
                  {scanResult.newInterestRatePct > 0
                    ? `${scanResult.newInterestRatePct}% / năm`
                    : "Chưa ghi rõ"}
                </p>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400">Tiền gốc</span>
                <p className="font-medium text-slate-800 dark:text-slate-200 tabular-nums">
                  {scanResult.principalPaidVnd > 0
                    ? formatVNDMasked(scanResult.principalPaidVnd, isPrivacyMode)
                    : "—"}
                </p>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400">Tiền lãi</span>
                <p className="font-medium text-slate-800 dark:text-slate-200 tabular-nums">
                  {scanResult.interestPaidVnd > 0
                    ? formatVNDMasked(scanResult.interestPaidVnd, isPrivacyMode)
                    : "—"}
                </p>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400">Độ tin cậy OCR</span>
                <p className="font-medium text-slate-800 dark:text-slate-200 tabular-nums">
                  {Math.round((scanResult.confidence || 0.85) * 100)}%
                </p>
              </div>
            </div>

            {scanResult.bankNote && (
              <p className="text-[11px] text-slate-600 dark:text-slate-300 border-t border-slate-200 dark:border-slate-700 pt-2">
                {scanResult.bankNote}
              </p>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={handleApplyPaidInstallment}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer"
              >
                Ghi nhận đã đóng kỳ này
              </button>
              {scanResult.newInterestRatePct > 0 && (
                <button
                  type="button"
                  onClick={handleApplyRateAdjustment}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950/70 transition-colors cursor-pointer"
                >
                  Áp dụng lãi suất {scanResult.newInterestRatePct}%
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 px-4 py-5 text-center text-xs text-slate-500 dark:text-slate-400">
            Hỗ trợ ảnh chụp màn hình SmartBanking BIDV hoặc file PDF thông báo thu nợ định kỳ. Dữ liệu chỉ dùng để bóc tách và đối chiếu.
          </div>
        )}
      </div>

      {/* Card 2: Cố vấn Chiến lược Liên thông SKYONE × GOLD × FINANCE */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Cố vấn Liên thông SKYONE × Vàng × Nội thất
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Phân tích trả nợ trước hạn dựa trên Tiền mặt, Kho Vàng Bid &amp; ngân sách Nội thất còn lại.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
              Số tiền dự kiến phân bổ / trả gốc trước hạn (VNĐ)
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={extraCashInput}
              onChange={(e) => setExtraCashInput(e.target.value)}
              placeholder="50000000"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button
            type="button"
            onClick={() => void handleRunStrategy()}
            disabled={strategyLoading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 transition-colors cursor-pointer"
          >
            {strategyLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5" />
            )}
            Phân tích chiến lược AI
          </button>
        </div>

        <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
          Ngữ cảnh tự nạp: Vàng Bid{" "}
          <strong className="text-slate-700 dark:text-slate-200">
            {formatVNDMasked(goldMetrics.totalLiquidationValueBid, isPrivacyMode)}
          </strong>{" "}
          · Nội thất còn chi{" "}
          <strong className="text-slate-700 dark:text-slate-200">
            {formatVNDMasked(boqSummary?.remainingToPayVnd ?? 0, isPrivacyMode)}
          </strong>
        </div>

        {strategyError && (
          <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 px-3 py-2 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{strategyError}</span>
          </div>
        )}

        {strategyResult && (
          <div className="rounded-xl border border-indigo-200/80 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/25 p-3.5 space-y-2.5 text-xs">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="font-semibold text-indigo-950 dark:text-indigo-100">
                {strategyResult.headline}
              </p>
              <span className="px-2 py-0.5 rounded-md bg-indigo-600 text-white text-[10px] font-semibold">
                {ACTION_LABEL_MAP[strategyResult.recommendedAction]}
              </span>
            </div>
            <p className="text-slate-700 dark:text-slate-300">{strategyResult.rationale}</p>
            {strategyResult.allocationPlan.length > 0 && (
              <div className="space-y-1.5">
                {strategyResult.allocationPlan.map((alloc, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-2 rounded-lg bg-white/80 dark:bg-slate-900/60 px-2.5 py-1.5 border border-indigo-100 dark:border-indigo-900/50"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 dark:text-slate-100">
                        {alloc.bucket}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {alloc.reason}
                      </p>
                    </div>
                    <span className="font-bold text-indigo-700 dark:text-indigo-300 shrink-0 tabular-nums">
                      {formatVNDMasked(alloc.amountVnd, isPrivacyMode)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {strategyResult.nextStepChecklist.length > 0 && (
              <ul className="list-disc pl-4 space-y-1 text-slate-700 dark:text-slate-300">
                {strategyResult.nextStepChecklist.map((pt, idx) => (
                  <li key={idx}>{pt}</li>
                ))}
              </ul>
            )}
            {strategyResult.riskWarnings.length > 0 && (
              <p className="text-[11px] text-amber-800 dark:text-amber-300 bg-amber-50/80 dark:bg-amber-950/40 rounded-lg px-2.5 py-1.5">
                <strong>Lưu ý rủi ro:</strong> {strategyResult.riskWarnings.join(" · ")}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
