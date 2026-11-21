"use client";

import React, { useMemo, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { InteriorDesignScenario } from "@/types/finance";
import {
  ScenarioBoqSummary,
  calculateHandoverReadiness,
} from "@/lib/interiorBoqEngine";
import { computeGoldPortfolioMetrics, formatChiWeight } from "@/lib/goldEngine";
import { formatShortVNDMasked, formatVNDMasked } from "@/lib/formatters";

interface HandoverReadinessTabProps {
  activeScenario: InteriorDesignScenario;
  activeBoq: ScenarioBoqSummary;
}

export function HandoverReadinessTab({
  activeScenario,
  activeBoq,
}: HandoverReadinessTabProps) {
  const { goldPortfolio, summary, isPrivacyMode, switchSubApp } = useFinance();

  const [monthlySurplusInput, setMonthlySurplusInput] = useState<number>(() =>
    Math.max(
      10_000_000,
      Math.round((summary.savingsAmount > 5_000_000 ? summary.savingsAmount : 18_000_000) / 1_000_000) *
        1_000_000
    )
  );
  const [monthsUntilHandover, setMonthsUntilHandover] = useState<number>(9);
  const [includePinkBook5Pct, setIncludePinkBook5Pct] = useState<boolean>(false);

  const goldMetrics = useMemo(() => computeGoldPortfolioMetrics(goldPortfolio), [goldPortfolio]);

  const readiness = useMemo(
    () =>
      calculateHandoverReadiness({
        liquidCashVnd: summary.currentBalance,
        monthlyNetSurplusVnd: monthlySurplusInput,
        goldLiquidationValueBidVnd: goldMetrics.totalLiquidationValueBid,
        goldNhan9999BidPerChiVnd:
          goldPortfolio.quotes.NHAN_9999?.buyPricePerChi || 9_050_000,
        interiorBoqTotalVnd: activeBoq.grandTotalWithContingency,
        interiorBoqPaidVnd: activeBoq.paidOrDepositedVnd,
        includePinkBook5Pct,
        monthsUntilHandover,
      }),
    [
      summary.currentBalance,
      monthlySurplusInput,
      goldMetrics.totalLiquidationValueBid,
      goldPortfolio.quotes,
      activeBoq.grandTotalWithContingency,
      activeBoq.paidOrDepositedVnd,
      includePinkBook5Pct,
      monthsUntilHandover,
    ]
  );

  return (
    <div className="space-y-5">
      {/* Status Headline Banner */}
      <div
        className={`rounded-xl border p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
          readiness.status === "READY_CASH_ONLY"
            ? "bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800"
            : readiness.status === "READY_WITH_GOLD"
              ? "bg-amber-50/70 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800"
              : "bg-rose-50/70 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800"
        }`}
      >
        <div className="space-y-1">
          <p className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
            Cầu nối 4 Sub-App · Mốc Nhận Bàn Giao Căn A.12A.07 (Q3/2027)
          </p>
          <h2 className="text-lg font-black text-slate-900 dark:text-white">
            {readiness.status === "READY_CASH_ONLY"
              ? "An toàn tuyệt đối bằng Tiền mặt — Giữ nguyên Kho Vàng cho mốc 08/2028"
              : readiness.status === "READY_WITH_GOLD"
                ? `Đủ lực nhận nhà khi kích hoạt ~${formatChiWeight(readiness.suggestedGoldChiToSell, isPrivacyMode)} từ Kho Vàng`
                : `Cần tăng tích lũy thêm ${formatShortVNDMasked(Math.abs(readiness.combinedSurplusOrGapVnd), isPrivacyMode)} trước Q3/2027`}
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-300 tabular-nums">
            Đang áp dụng phương án <strong>{activeScenario.name}</strong> (Tổng BOQ{" "}
            {formatShortVNDMasked(readiness.interiorBoqGrossTotalVnd, isPrivacyMode)}
            {readiness.interiorBoqPaidVnd > 0
              ? ` · đã chi ${formatShortVNDMasked(readiness.interiorBoqPaidVnd, isPrivacyMode)} · còn phải chuẩn bị ${formatShortVNDMasked(readiness.interiorBoqTotalVnd, isPrivacyMode)}`
              : ""}
            ).
          </p>
        </div>

        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            type="button"
            onClick={() => switchSubApp("GOLD", { goldTab: "SIMULATOR" })}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-extrabold bg-amber-500 hover:bg-amber-600 text-stone-950 cursor-pointer"
          >
            <span>Mở Mô phỏng Bán Vàng</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => switchSubApp("SKYONE", { skyoneTab: "ADVISOR" })}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-extrabold bg-slate-900 dark:bg-slate-800 text-white cursor-pointer"
          >
            <span>Cố vấn Vay 08/2028</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Interactive Controls */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="font-bold text-slate-700 dark:text-slate-200">
              Thặng dư tiết kiệm / tháng
            </span>
            <span className="font-black text-teal-700 dark:text-teal-300 tabular-nums">
              {formatShortVNDMasked(monthlySurplusInput, isPrivacyMode)}
            </span>
          </div>
          <input
            type="range"
            min={5_000_000}
            max={45_000_000}
            step={1_000_000}
            value={monthlySurplusInput}
            onChange={(e) => setMonthlySurplusInput(Number(e.target.value))}
            className="w-full accent-teal-600"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="font-bold text-slate-700 dark:text-slate-200">
              Số tháng tích lũy tới Q3/2027
            </span>
            <span className="font-black text-teal-700 dark:text-teal-300 tabular-nums">
              {monthsUntilHandover} tháng
            </span>
          </div>
          <input
            type="range"
            min={3}
            max={18}
            step={1}
            value={monthsUntilHandover}
            onChange={(e) => setMonthsUntilHandover(Number(e.target.value))}
            className="w-full accent-teal-600"
          />
        </div>

        <label className="flex items-center gap-2.5 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={includePinkBook5Pct}
            onChange={(e) => setIncludePinkBook5Pct(e.target.checked)}
            className="w-4 h-4 accent-teal-600"
          />
          <div className="text-xs">
            <p className="font-bold text-slate-800 dark:text-slate-100">
              Gộp luôn 5% Sổ hồng (72,3 tr)
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Mặc định đóng riêng khi có thông báo làm sổ
            </p>
          </div>
        </label>
      </div>

      {/* 2-Column Ledger: Needs vs Resources */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-black text-slate-900 dark:text-white">
            Tổng Nhu Cầu Tiền Mặt Còn Lại Khi Nhận Nhà (Q3/2027)
          </h3>
          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-600 dark:text-slate-300">
                Phí bảo trì 2% (SKYONE A.12A.07)
              </span>
              <span className="font-bold tabular-nums">
                {formatVNDMasked(readiness.maintenanceFee2PctVnd, isPrivacyMode)}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-600 dark:text-slate-300">
                Đợt cuối 5% Sổ hồng (tùy chọn gộp)
              </span>
              <span className="font-bold tabular-nums">
                {formatVNDMasked(readiness.pinkBook5PctVnd, isPrivacyMode)}
              </span>
            </div>

            {/* Zero double-counting breakdown for BOQ */}
            <div className="py-2 border-b border-slate-100 dark:border-slate-800 space-y-1.5">
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Tổng BOQ trọn gói ({activeScenario.shortLabel})</span>
                <span className="tabular-nums">
                  {formatVNDMasked(readiness.interiorBoqGrossTotalVnd, isPrivacyMode)}
                </span>
              </div>
              <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                <span>Trừ: Đã chi / đặt cọc (đã trừ khỏi Ví)</span>
                <span className="font-bold tabular-nums">
                  -{formatVNDMasked(readiness.interiorBoqPaidVnd, isPrivacyMode)}
                </span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="font-bold text-slate-700 dark:text-slate-200">
                  Nội thất còn phải chuẩn bị thêm
                </span>
                <span className="font-extrabold text-teal-700 dark:text-teal-300 tabular-nums">
                  {formatVNDMasked(readiness.interiorBoqTotalVnd, isPrivacyMode)}
                </span>
              </div>
            </div>

            <div className="flex justify-between pt-2 text-sm font-black">
              <span>TỔNG CẦN CHUẨN BỊ THÊM</span>
              <span className="tabular-nums">
                {formatVNDMasked(readiness.totalHandoverNeedVnd, isPrivacyMode)}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-black text-slate-900 dark:text-white">
            Tổng Nguồn Lực Liên Thông (FINANCE + GOLD)
          </h3>
          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-600 dark:text-slate-300">
                Số dư ví thanh khoản hiện có (FINANCE)
              </span>
              <span className="font-bold tabular-nums">
                {formatVNDMasked(readiness.currentLiquidCashVnd, isPrivacyMode)}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-600 dark:text-slate-300">
                Thặng dư dự phóng ({readiness.monthsUntilHandover} tháng)
              </span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                +{formatVNDMasked(readiness.projectedCashSurplusVnd, isPrivacyMode)}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-600 dark:text-slate-300">
                Kho Vàng định giá thu mua thực Bid (GOLD)
              </span>
              <span className="font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                +{formatVNDMasked(readiness.goldLiquidationValueBidVnd, isPrivacyMode)}
              </span>
            </div>
            <div className="flex justify-between pt-2 text-sm font-black">
              <span>TỔNG NGUỒN LỰC DỰ KIẾN</span>
              <span className="text-emerald-700 dark:text-emerald-300 tabular-nums">
                {formatVNDMasked(readiness.totalResourcesWithGoldVnd, isPrivacyMode)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Bars */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-bold">
            <span>Độ sẵn sàng chỉ bằng Tiền mặt (giữ nguyên 100% Vàng)</span>
            <span className="tabular-nums">{readiness.readinessPctCashOnly}%</span>
          </div>
          <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-teal-600 rounded-full transition-all"
              style={{ width: `${Math.min(100, readiness.readinessPctCashOnly)}%` }}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-bold">
            <span>Độ sẵn sàng hợp nhất (Tiền mặt + Kho Vàng Bid)</span>
            <span className="tabular-nums">{readiness.readinessPctWithGold}%</span>
          </div>
          <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full transition-all"
              style={{ width: `${Math.min(100, readiness.readinessPctWithGold)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
