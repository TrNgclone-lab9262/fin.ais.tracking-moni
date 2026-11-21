"use client";

import React, { useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  Check,
  CheckCircle2,
  Coins,
  Download,
  FileText,
  Layers,
  Scale,
  TrendingUp,
  X,
} from "lucide-react";
import {
  Account,
  GoldCategory,
  GoldLiquidationStrategy,
  GoldPortfolioState,
  GoldSalePurpose,
  MortgageContract,
} from "@/types/finance";
import {
  GOLD_CATEGORY_META,
  GoldPortfolioMetrics,
  computeGoldStressTestMatrix,
  computeGoldVsMortgageBenchmark,
  exportGoldVaultToCsv,
  formatChiWeight,
  simulateGoldLiquidation,
} from "@/lib/goldEngine";
import {
  ConstructionMilestonesPlan,
  HandoverReadinessResult,
} from "@/lib/interiorBoqEngine";
import { formatDateVN, formatShortVNDMasked, formatVNDMasked } from "@/lib/formatters";
import { GoldSellPrefill } from "./GoldSellModal";

interface GoldSimulatorTabProps {
  goldPortfolio: GoldPortfolioState;
  metrics: GoldPortfolioMetrics;
  skyoneLoan: MortgageContract | null;
  handoverReadiness: HandoverReadinessResult;
  milestonesPlan: ConstructionMilestonesPlan;
  simTargetVnd: number;
  simPresetLabel: string | null;
  onChangeSimTargetVnd: (val: number, label?: string | null) => void;
  nonCreditAccounts: Account[];
  isPrivacyMode: boolean;
  onExecuteSimulatedSale: (prefill: GoldSellPrefill) => void;
  onExecuteBatchSale: (input: {
    saleDate: string;
    steps: Array<{
      lotId: string;
      category: GoldCategory;
      sellChi: number;
      unitSellPricePerChi: number;
    }>;
    purpose: GoldSalePurpose;
    note?: string;
    linkAccountId?: string;
  }) => { ok: boolean; error?: string };
  onPrintVaultAudit: () => void;
}

const STRATEGIES: { id: GoldLiquidationStrategy; label: string; hint: string }[] = [
  {
    id: "MIN_SPREAD_FIRST",
    label: "Ưu tiên Spread thấp nhất",
    hint: "Bán Nhẫn 9999 trước để ít mất chênh lệch Mua–Bán",
  },
  {
    id: "HIGHEST_PROFIT_FIRST",
    label: "Chốt lô lãi % cao nhất",
    hint: "Tối đa hóa lợi nhuận thực nhận trên mỗi chỉ bán ra",
  },
  {
    id: "FIFO",
    label: "FIFO (Lô cũ nhất trước)",
    hint: "Tuân thủ chuẩn kế toán nhập trước – xuất trước",
  },
];

export function GoldSimulatorTab({
  goldPortfolio,
  metrics,
  skyoneLoan,
  handoverReadiness,
  milestonesPlan,
  simTargetVnd,
  simPresetLabel,
  onChangeSimTargetVnd,
  nonCreditAccounts,
  isPrivacyMode,
  onExecuteSimulatedSale,
  onExecuteBatchSale,
  onPrintVaultAudit,
}: GoldSimulatorTabProps) {
  const [simStrategy, setSimStrategy] =
    useState<GoldLiquidationStrategy>("MIN_SPREAD_FIRST");
  const [expectedGoldGrowthPct, setExpectedGoldGrowthPct] = useState<number>(9.5);
  const [prepaymentPenaltyPct, setPrepaymentPenaltyPct] = useState<number>(1.0);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [batchSaleDate, setBatchSaleDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [batchLinkAccountId, setBatchLinkAccountId] = useState("");
  const [batchError, setBatchError] = useState<string | null>(null);
  const [batchSuccessMsg, setBatchSuccessMsg] = useState<string | null>(null);

  const benchmark = useMemo(
    () =>
      computeGoldVsMortgageBenchmark(goldPortfolio, metrics, skyoneLoan, {
        expectedGoldGrowthPct,
        prepaymentPenaltyPct,
        bankDepositRatePct: 6.0,
      }),
    [goldPortfolio, metrics, skyoneLoan, expectedGoldGrowthPct, prepaymentPenaltyPct]
  );

  const simulation = useMemo(
    () => simulateGoldLiquidation(goldPortfolio, simTargetVnd, simStrategy),
    [goldPortfolio, simTargetVnd, simStrategy]
  );

  const stressMatrix = useMemo(
    () => computeGoldStressTestMatrix(goldPortfolio, metrics),
    [goldPortfolio, metrics]
  );

  const handleTriggerExecuteSale = () => {
    const firstStep = simulation.steps[0];
    if (!firstStep) return;
    onExecuteSimulatedSale({
      category: firstStep.category,
      mode: "SPECIFIC_LOT",
      specificLotId: firstStep.lotId,
      quantityChi: firstStep.sellChi,
      purpose: simPresetLabel?.includes("08/2028") ? "SKYONE_PREPAY" : "INTERIOR_HANDOVER",
      note: simPresetLabel
        ? `Chốt bán theo mô phỏng: ${simPresetLabel}`
        : `Chốt bán theo mô phỏng mục tiêu ${formatShortVNDMasked(simTargetVnd, false)}`,
    });
  };

  const handleConfirmBatchSale = (e: React.FormEvent) => {
    e.preventDefault();
    setBatchError(null);
    if (simulation.steps.length === 0) return;

    const res = onExecuteBatchSale({
      saleDate: batchSaleDate,
      steps: simulation.steps.map((s) => ({
        lotId: s.lotId,
        category: s.category,
        sellChi: s.sellChi,
        unitSellPricePerChi: s.bidPricePerChi,
      })),
      purpose: simPresetLabel?.includes("08/2028") ? "SKYONE_PREPAY" : "INTERIOR_HANDOVER",
      note: simPresetLabel
        ? `Chốt bán ${simulation.steps.length} lô theo kế hoạch: ${simPresetLabel}`
        : `Chốt bán hàng loạt ${simulation.steps.length} lô (mục tiêu ${formatShortVNDMasked(simTargetVnd, false)})`,
      linkAccountId: batchLinkAccountId || undefined,
    });

    if (!res.ok) {
      setBatchError(res.error || "Không thể chốt bán hàng loạt.");
      return;
    }

    setIsBatchModalOpen(false);
    setBatchSuccessMsg(
      `Đã chốt bán thành công ${simulation.steps.length} lô (${simulation.totalSellChi} chỉ) theo kế hoạch mô phỏng.`
    );
  };

  return (
    <div className="space-y-6">
      {/* ================================================================= */}
      {/* PART A: GOLD VS SKYONE MORTGAGE & BANK DEPOSIT OPPORTUNITY COST   */}
      {/* ================================================================= */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">
              <Scale className="w-4 h-4" />
              <span>Phân Tích Chi Phí Cơ Hội: Giữ Vàng vs Trả Nợ Vay SKYONE & Tiết Kiệm</span>
            </div>
            <h2 className="text-base font-black text-slate-900 dark:text-white mt-1">
              {benchmark.verdictTitle}
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed max-w-3xl">
              {benchmark.verdictDetail}
            </p>
          </div>
          <span
            className={`px-3 py-1 rounded-lg text-xs font-black border shrink-0 ${
              benchmark.verdict === "HOLD_GOLD"
                ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
                : benchmark.verdict === "PREPAY_MORTGAGE"
                  ? "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200"
                  : "bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200"
            }`}
          >
            {benchmark.verdict === "HOLD_GOLD"
              ? "Khuyến nghị: Giữ Vàng"
              : benchmark.verdict === "PREPAY_MORTGAGE"
                ? "Khuyến nghị: Trả gốc thả nổi"
                : "Khuyến nghị: Chia đôi cân bằng"}
          </span>
        </div>

        {/* Benchmark Sliders */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-xs">
          <div className="space-y-1">
            <div className="flex justify-between font-bold">
              <span className="text-slate-700 dark:text-slate-200">
                Kỳ vọng tăng giá vàng 12 tháng tới (%/năm)
              </span>
              <span className="text-amber-700 dark:text-amber-300 tabular-nums">
                {expectedGoldGrowthPct.toFixed(1)}%/năm
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={20}
              step={0.5}
              value={expectedGoldGrowthPct}
              onChange={(e) => setExpectedGoldGrowthPct(Number(e.target.value))}
              className="w-full accent-amber-600"
            />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between font-bold">
              <span className="text-slate-700 dark:text-slate-200">
                Phí phạt trả nợ trước hạn SKYONE (%)
              </span>
              <span className="text-slate-800 dark:text-slate-200 tabular-nums">
                {prepaymentPenaltyPct.toFixed(1)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={3}
              step={0.5}
              value={prepaymentPenaltyPct}
              onChange={(e) => setPrepaymentPenaltyPct(Number(e.target.value))}
              className="w-full accent-amber-600"
            />
          </div>
        </div>

        {/* 4-Metric Comparison Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs tabular-nums">
          <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1">
            <span className="text-slate-500 dark:text-slate-400 block font-semibold">
              CAGR thực tế Kho Vàng ({benchmark.weightedAvgHoldingDays} ngày)
            </span>
            <span className="text-lg font-black text-emerald-700 dark:text-emerald-400 block">
              {benchmark.actualAnnualizedReturnPct >= 0 ? "+" : ""}
              {benchmark.actualAnnualizedReturnPct}%/năm
            </span>
            <span className="text-[10.5px] text-slate-500 block">
              Lãi đơn hiện tại: {benchmark.actualSimpleReturnPct >= 0 ? "+" : ""}
              {benchmark.actualSimpleReturnPct}% · Tiết kiệm NH: {benchmark.bankDepositRatePct}%
            </span>
          </div>

          <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1">
            <span className="text-slate-500 dark:text-slate-400 block font-semibold">
              Lãi suất SKYONE (Cố định / Thả nổi)
            </span>
            <span className="text-lg font-black text-slate-900 dark:text-white block">
              {benchmark.skyoneFixedRatePct}% / {benchmark.skyoneFloatingRatePct}%
            </span>
            <span className="text-[10.5px] text-slate-500 block">
              Thả nổi sau 08/2028 · Phí Spread vàng: {benchmark.currentSpreadPct}%
            </span>
          </div>

          <div className="p-3.5 rounded-lg border border-amber-200 dark:border-amber-900/70 bg-amber-50/40 dark:bg-amber-950/20 space-y-1">
            <span className="text-amber-800 dark:text-amber-300 block font-semibold">
              Ngưỡng hòa vốn Giữ Vàng (sau phí phạt)
            </span>
            <span className="text-lg font-black text-amber-800 dark:text-amber-300 block">
              {benchmark.breakEvenGoldGrowthVsFloatingPct}%/năm
            </span>
            <span className="text-[10.5px] text-slate-600 dark:text-slate-400 block">
              Vs lãi cố định: {benchmark.breakEvenGoldGrowthVsFixedPct}%/năm
            </span>
          </div>

          <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1">
            <span className="text-slate-500 dark:text-slate-400 block font-semibold">
              Lợi thế ròng 1 năm (Giữ Vàng vs Trả gốc)
            </span>
            <span
              className={`text-lg font-black block ${
                benchmark.netAdvantageHoldingGold1YrVnd >= 0
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400"
              }`}
            >
              {benchmark.netAdvantageHoldingGold1YrVnd >= 0 ? "+" : ""}
              {formatShortVNDMasked(benchmark.netAdvantageHoldingGold1YrVnd, isPrivacyMode)}
            </span>
            <span className="text-[10.5px] text-slate-500 block">
              Tiết kiệm lãi nếu trả ngay:{" "}
              {formatShortVNDMasked(benchmark.projectedInterestSaved1YrIfPrepayVnd, isPrivacyMode)}
            </span>
          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* PART B: LIQUIDATION SIMULATOR & 4-MILESTONE SKYONE PRESETS        */}
      {/* ================================================================= */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-teal-700 dark:text-teal-400">
              <TrendingUp className="w-4 h-4" />
              <span>Mô Phỏng Thanh Khoản Tối Ưu Lô & Nạp Nhanh 4 Đợt Thi Công SKYONE</span>
            </div>
            {simPresetLabel && (
              <p className="text-xs font-bold text-amber-800 dark:text-amber-300 mt-1">
                Đang mô phỏng theo mục tiêu: {simPresetLabel}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => exportGoldVaultToCsv(goldPortfolio, metrics)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>
            <button
              type="button"
              onClick={onPrintVaultAudit}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-amber-600" />
              <span>In Kiểm kê</span>
            </button>
          </div>
        </div>

        {/* Quick Preset Chips: 4 Construction Milestones + Handover Gap + 08/2028 Prepay */}
        <div className="flex flex-wrap gap-1.5 text-xs">
          {milestonesPlan.milestones.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() =>
                onChangeSimTargetVnd(
                  m.goldNeededVnd > 0 ? m.goldNeededVnd : m.milestoneAmountVnd,
                  `${m.title} (T+${m.monthsFromNow} tháng)`
                )
              }
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:border-amber-500 font-bold text-slate-700 dark:text-slate-200 tabular-nums cursor-pointer"
            >
              {m.title}:{" "}
              <span className="text-amber-700 dark:text-amber-300">
                {formatShortVNDMasked(
                  m.goldNeededVnd > 0 ? m.goldNeededVnd : m.milestoneAmountVnd,
                  isPrivacyMode
                )}
              </span>
            </button>
          ))}
          <button
            type="button"
            onClick={() =>
              onChangeSimTargetVnd(
                Math.max(20_000_000, handoverReadiness.cashOnlyGapVnd || 50_000_000),
                "Bù thiếu Nhận nhà Q3/2027"
              )
            }
            className="px-2.5 py-1.5 rounded-lg border border-teal-300 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/40 font-bold text-teal-800 dark:text-teal-200 tabular-nums cursor-pointer"
          >
            Bù thiếu Q3/2027 (
            {formatShortVNDMasked(
              Math.max(20_000_000, handoverReadiness.cashOnlyGapVnd || 50_000_000),
              isPrivacyMode
            )}
            )
          </button>
          <button
            type="button"
            onClick={() =>
              onChangeSimTargetVnd(150_000_000, "Tất toán một phần gốc SKYONE 08/2028")
            }
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:border-amber-500 font-bold text-slate-700 dark:text-slate-200 tabular-nums cursor-pointer"
          >
            Tất toán gốc 08/2028 (150tr)
          </button>
        </div>

        {/* Target Amount Input + Strategy Picker */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
          <div className="lg:col-span-5 space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block">
              Số tiền mặt cần huy động từ Kho Vàng (VNĐ)
            </label>
            <input
              type="number"
              step={5_000_000}
              min={1_000_000}
              value={simTargetVnd}
              onChange={(e) =>
                onChangeSimTargetVnd(Math.max(0, Number(e.target.value) || 0), null)
              }
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-black tabular-nums"
            />
          </div>

          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-2">
            {STRATEGIES.map((st) => {
              const active = simStrategy === st.id;
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setSimStrategy(st.id)}
                  title={st.hint}
                  className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                    active
                      ? "bg-amber-600 border-amber-600 text-white"
                      : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                  }`}
                >
                  <p className="text-xs font-black leading-tight">{st.label}</p>
                  <p
                    className={`text-[10px] mt-0.5 leading-tight ${
                      active ? "text-amber-100" : "text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    {st.hint}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Simulation Summary Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs tabular-nums">
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
            <span className="text-slate-500 block">Tổng chỉ cần bán</span>
            <strong className="text-base font-black text-slate-900 dark:text-white">
              {formatChiWeight(simulation.totalSellChi, isPrivacyMode)}
            </strong>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
            <span className="text-slate-500 block">Tiền thu về thực (Bid)</span>
            <strong className="text-base font-black text-amber-700 dark:text-amber-300">
              {formatShortVNDMasked(simulation.totalProceedsVnd, isPrivacyMode)}
            </strong>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
            <span className="text-slate-500 block">Lãi thực nhận dự kiến</span>
            <strong
              className={`text-base font-black ${
                simulation.totalRealizedPnlVnd >= 0
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-rose-600"
              }`}
            >
              {simulation.totalRealizedPnlVnd >= 0 ? "+" : ""}
              {formatShortVNDMasked(simulation.totalRealizedPnlVnd, isPrivacyMode)}
            </strong>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
            <span className="text-slate-500 block">Vàng còn giữ lại sau bán</span>
            <strong className="text-base font-black text-teal-700 dark:text-teal-300">
              {formatChiWeight(simulation.remainingChiAfterSale, isPrivacyMode)}
            </strong>
          </div>
        </div>

        {/* Optimal Lots Table */}
        {simulation.steps.length > 0 ? (
          <div className="space-y-3">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs tabular-nums">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase text-slate-500">
                    <th className="py-2 pr-3">Lô đề xuất bán</th>
                    <th className="py-2 px-3">Ngày mua</th>
                    <th className="py-2 px-3 text-right">Bán (chỉ)</th>
                    <th className="py-2 px-3 text-right">Giá Bid / chỉ</th>
                    <th className="py-2 px-3 text-right">Spread</th>
                    <th className="py-2 px-3 text-right">Thu về</th>
                    <th className="py-2 pl-3 text-right">Lãi thực nhận</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {simulation.steps.map((step) => (
                    <tr key={step.lotId}>
                      <td className="py-2.5 pr-3">
                        <p className="font-bold text-slate-900 dark:text-white">{step.brand}</p>
                        <p className="text-[10.5px] text-slate-500">
                          {GOLD_CATEGORY_META[step.category].shortLabel} · Còn lại sau bán{" "}
                          {step.lotRemainingAfterChi} chỉ
                        </p>
                      </td>
                      <td className="py-2.5 px-3">{formatDateVN(step.purchaseDate)}</td>
                      <td className="py-2.5 px-3 text-right font-black">
                        {formatChiWeight(step.sellChi, isPrivacyMode)}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {formatShortVNDMasked(step.bidPricePerChi, isPrivacyMode)}
                      </td>
                      <td className="py-2.5 px-3 text-right">{step.spreadPct}%</td>
                      <td className="py-2.5 px-3 text-right font-extrabold">
                        {formatVNDMasked(step.proceedsVnd, isPrivacyMode)}
                      </td>
                      <td
                        className={`py-2.5 pl-3 text-right font-extrabold ${
                          step.realizedPnlVnd >= 0
                            ? "text-emerald-700 dark:text-emerald-400"
                            : "text-rose-600"
                        }`}
                      >
                        {step.realizedPnlVnd >= 0 ? "+" : ""}
                        {formatVNDMasked(step.realizedPnlVnd, isPrivacyMode)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <p className="text-xs text-slate-600 dark:text-slate-300 inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                {simulation.isFullyCovered
                  ? "Đủ thanh khoản 100% mục tiêu từ Kho Vàng hiện tại."
                  : `Còn thiếu ${formatShortVNDMasked(simulation.shortfallVnd, isPrivacyMode)} so với mục tiêu — cần kết hợp thêm tiền mặt.`}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleTriggerExecuteSale}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <Coins className="w-3.5 h-3.5" />
                  <span>Bán riêng lô đầu</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBatchError(null);
                    setBatchSuccessMsg(null);
                    setIsBatchModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-extrabold bg-slate-900 dark:bg-amber-600 hover:opacity-90 text-white cursor-pointer"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Chốt bán toàn bộ kế hoạch ({simulation.steps.length} lô)</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {batchSuccessMsg && (
              <p className="px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                {batchSuccessMsg}
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-500 py-4 text-center">
            Chưa có lô vàng khả dụng để mô phỏng thanh khoản.
          </p>
        )}
      </section>

      {/* ================================================================= */}
      {/* PART C: GOLD PRICE STRESS-TEST MATRIX (XAU ±10%, FX ±3%, SPREAD)  */}
      {/* ================================================================= */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
              <Activity className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>Ma Trận Stress-Test Giá Vàng & Rủi Ro Giãn Spread Trước Mốc Nhận Nhà</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Kiểm tra sức chịu đựng của Kho Vàng ({formatChiWeight(metrics.totalRemainingChi, isPrivacyMode)}) khi XAU/USD biến động ±10%, tỷ giá USD/VND ±3% hoặc tiệm vàng giãn biên độ Mua–Bán lên 3,5%.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs tabular-nums">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-[11px] font-bold uppercase text-slate-500">
                <th className="py-2.5 px-3">Kịch bản Stress-Test</th>
                <th className="py-2.5 px-3 text-right">XAU/USD</th>
                <th className="py-2.5 px-3 text-right">USD/VND</th>
                <th className="py-2.5 px-3 text-right">Spread</th>
                <th className="py-2.5 px-3 text-right">Giá trị Bid dự phóng</th>
                <th className="py-2.5 px-3 text-right">Chênh vs Hiện tại</th>
                <th className="py-2.5 px-3 text-right">Lãi/Lỗ tạm tính</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {stressMatrix.map((row) => (
                <tr
                  key={row.id}
                  className={
                    row.id === "stress_base"
                      ? "bg-amber-50/50 dark:bg-amber-950/20 font-semibold"
                      : "hover:bg-slate-50/70 dark:hover:bg-slate-800/30"
                  }
                >
                  <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                    {row.label}
                  </td>
                  <td className="py-2.5 px-3 text-right whitespace-nowrap">
                    ${row.projectedXauUsd.toLocaleString("en-US")}
                    <span className="ml-1 text-[10px] text-slate-400">
                      ({row.xauShockPct >= 0 ? "+" : ""}
                      {row.xauShockPct}%)
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right whitespace-nowrap">
                    {row.projectedUsdVnd.toLocaleString("vi-VN")}
                    <span className="ml-1 text-[10px] text-slate-400">
                      ({row.fxShockPct >= 0 ? "+" : ""}
                      {row.fxShockPct}%)
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right whitespace-nowrap">{row.spreadPct}%</td>
                  <td className="py-2.5 px-3 text-right font-extrabold text-slate-900 dark:text-white whitespace-nowrap">
                    {formatVNDMasked(row.projectedBidValueVnd, isPrivacyMode)}
                  </td>
                  <td
                    className={`py-2.5 px-3 text-right font-bold whitespace-nowrap ${
                      row.deltaVsCurrentBidVnd > 0
                        ? "text-emerald-700 dark:text-emerald-400"
                        : row.deltaVsCurrentBidVnd < 0
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-slate-500"
                    }`}
                  >
                    {row.deltaVsCurrentBidVnd >= 0 ? "+" : ""}
                    {formatShortVNDMasked(row.deltaVsCurrentBidVnd, isPrivacyMode)}
                  </td>
                  <td
                    className={`py-2.5 px-3 text-right font-extrabold whitespace-nowrap ${
                      row.projectedUnrealizedPnlVnd >= 0
                        ? "text-emerald-700 dark:text-emerald-400"
                        : "text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    {row.projectedUnrealizedPnlVnd >= 0 ? "+" : ""}
                    {formatShortVNDMasked(row.projectedUnrealizedPnlVnd, isPrivacyMode)} (
                    {row.projectedUnrealizedPnlPct >= 0 ? "+" : ""}
                    {row.projectedUnrealizedPnlPct}%)
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Batch Multi-Lot Execution Confirmation Modal */}
      {isBatchModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4"
          onClick={() => setIsBatchModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                  Xác nhận chốt bán hàng loạt ({simulation.steps.length} lô)
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Trừ đồng loạt {formatChiWeight(simulation.totalSellChi, isPrivacyMode)} theo đúng phương án tối ưu đã mô phỏng.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsBatchModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmBatchSale} className="p-5 space-y-4 text-xs">
              {batchError && (
                <p className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-bold">
                  {batchError}
                </p>
              )}

              <div className="grid grid-cols-3 gap-2 tabular-nums">
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10.5px] text-slate-500 block">Tổng bán</span>
                  <strong className="text-sm font-black text-slate-900 dark:text-white">
                    {formatChiWeight(simulation.totalSellChi, isPrivacyMode)}
                  </strong>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10.5px] text-slate-500 block">Thực thu (Bid)</span>
                  <strong className="text-sm font-black text-amber-700 dark:text-amber-300">
                    {formatShortVNDMasked(simulation.totalProceedsVnd, isPrivacyMode)}
                  </strong>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10.5px] text-slate-500 block">Lãi thực nhận</span>
                  <strong
                    className={`text-sm font-black ${
                      simulation.totalRealizedPnlVnd >= 0
                        ? "text-emerald-700 dark:text-emerald-400"
                        : "text-rose-600"
                    }`}
                  >
                    {simulation.totalRealizedPnlVnd >= 0 ? "+" : ""}
                    {formatShortVNDMasked(simulation.totalRealizedPnlVnd, isPrivacyMode)}
                  </strong>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block font-bold text-slate-600 dark:text-slate-300">
                  Ngày chốt bán
                </label>
                <input
                  type="date"
                  required
                  value={batchSaleDate}
                  onChange={(e) => setBatchSaleDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block font-bold text-slate-600 dark:text-slate-300">
                  Liên thông Sổ Thu Chi (nạp tổng tiền thu về vào ví)
                </label>
                <select
                  value={batchLinkAccountId}
                  onChange={(e) => setBatchLinkAccountId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold"
                >
                  <option value="">Chỉ ghi nhận trong Kho Vàng</option>
                  {nonCreditAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      Nạp tiền vào ví: {acc.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsBatchModalOpen(false)}
                  className="px-4 py-2 rounded-lg font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg font-bold bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Xác nhận chốt bán {simulation.steps.length} lô</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
