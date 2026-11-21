"use client";

import React, { useMemo } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  Coins,
  Download,
  FileText,
  Plus,
  Scale,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  GoldPortfolioState,
  GoldRouteTab,
  InteriorRouteTab,
  SkyOneRouteTab,
  SubAppId,
} from "@/types/finance";
import {
  EvaluatedGoldAlert,
  GOLD_CATEGORY_META,
  GOLD_STORAGE_LABELS,
  GoldPortfolioMetrics,
  NetWorthAllocationGuardrail,
  buildGoldNavHistorySeries,
  chiToGrams,
  exportGoldVaultToCsv,
  formatChiWeight,
  formatLuongWeight,
} from "@/lib/goldEngine";
import { HandoverReadinessResult } from "@/lib/interiorBoqEngine";
import { formatShortVNDMasked, formatVNDMasked } from "@/lib/formatters";

interface GoldOverviewTabProps {
  goldPortfolio: GoldPortfolioState;
  metrics: GoldPortfolioMetrics;
  evaluatedAlerts: EvaluatedGoldAlert[];
  guardrail: NetWorthAllocationGuardrail;
  handoverReadiness: HandoverReadinessResult;
  husbandName: string;
  wifeName: string;
  isPrivacyMode: boolean;
  onOpenAddLot: () => void;
  onOpenSellModal: () => void;
  onPrintVaultAudit: () => void;
  onSwitchGoldTab: (tab: GoldRouteTab) => void;
  onSwitchSubApp: (
    app: SubAppId,
    options?: { interiorTab?: InteriorRouteTab; skyoneTab?: SkyOneRouteTab }
  ) => void;
}

export function GoldOverviewTab({
  goldPortfolio,
  metrics,
  evaluatedAlerts,
  guardrail,
  handoverReadiness,
  husbandName,
  wifeName,
  isPrivacyMode,
  onOpenAddLot,
  onOpenSellModal,
  onPrintVaultAudit,
  onSwitchGoldTab,
  onSwitchSubApp,
}: GoldOverviewTabProps) {
  const triggeredAlerts = useMemo(
    () => evaluatedAlerts.filter((a) => a.triggered),
    [evaluatedAlerts]
  );

  const navSeries = useMemo(
    () =>
      buildGoldNavHistorySeries(goldPortfolio).map((pt) => ({
        ...pt,
        bidM: Number((pt.bidValueVnd / 1_000_000).toFixed(2)),
        costM: Number((pt.costBasisVnd / 1_000_000).toFixed(2)),
      })),
    [goldPortfolio]
  );

  const categoryChartData = useMemo(
    () =>
      metrics.byCategory.map((item) => ({
        name: GOLD_CATEGORY_META[item.category].shortLabel,
        costM: Number((item.costBasis / 1_000_000).toFixed(1)),
        bidM: Number((item.liquidationValueBid / 1_000_000).toFixed(1)),
        color: GOLD_CATEGORY_META[item.category].color,
      })),
    [metrics.byCategory]
  );

  const storageBreakdown = useMemo(() => {
    const map = new Map<string, { label: string; chi: number; bidVnd: number }>();
    for (const ev of metrics.lotEvaluations) {
      const loc = ev.lot.storageLocation;
      const cur = map.get(loc) || { label: GOLD_STORAGE_LABELS[loc], chi: 0, bidVnd: 0 };
      cur.chi += ev.lot.remainingChi;
      cur.bidVnd += ev.liquidationValueBid;
      map.set(loc, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.bidVnd - a.bidVnd);
  }, [metrics.lotEvaluations]);

  const memberBreakdown = useMemo(() => {
    const labelMap: Record<string, string> = {
      SHARED: "Chung 2 vợ chồng",
      HUSBAND: husbandName,
      WIFE: wifeName,
    };
    const map = new Map<string, { label: string; chi: number; bidVnd: number }>();
    for (const ev of metrics.lotEvaluations) {
      const m = ev.lot.memberId;
      const cur = map.get(m) || { label: labelMap[m] || m, chi: 0, bidVnd: 0 };
      cur.chi += ev.lot.remainingChi;
      cur.bidVnd += ev.liquidationValueBid;
      map.set(m, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.bidVnd - a.bidVnd);
  }, [metrics.lotEvaluations, husbandName, wifeName]);

  const totalPnl = metrics.unrealizedPnl + metrics.realizedPnl;

  return (
    <div className="space-y-5">
      {/* Top Action Bar & Triggered Alerts */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-black text-slate-900 dark:text-slate-100">
            Tổng quan Kho Tích Sản Vàng (Định giá Thu mua Bid)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {metrics.lotEvaluations.length} lô đang nắm giữ · XAU/USD{" "}
            {goldPortfolio.macro.worldXauUsdPerOz.toLocaleString("en-US")} $/oz · USD/VND{" "}
            {goldPortfolio.macro.usdVndRate.toLocaleString("vi-VN")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => exportGoldVaultToCsv(goldPortfolio, metrics)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Xuất CSV</span>
          </button>
          <button
            type="button"
            onClick={onPrintVaultAudit}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>In Kiểm kê PDF</span>
          </button>
          <button
            type="button"
            onClick={onOpenSellModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
          >
            <span>Ghi bán</span>
          </button>
          <button
            type="button"
            onClick={onOpenAddLot}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-extrabold bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm lô mua</span>
          </button>
        </div>
      </div>

      {/* Triggered Price/Spread Alerts Strip */}
      {triggeredAlerts.length > 0 && (
        <div className="bg-amber-50/70 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-black text-amber-900 dark:text-amber-200">
              <Bell className="w-3.5 h-3.5" />
              <span>{triggeredAlerts.length} cảnh báo thị trường vàng đang kích hoạt</span>
            </div>
            <div className="space-y-0.5 text-xs text-amber-900/90 dark:text-amber-200/90">
              {triggeredAlerts.map((a) => (
                <p key={a.rule.id} className="tabular-nums">
                  • <strong>{a.rule.label}:</strong> {a.summary}
                </p>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onSwitchGoldTab("PRICES")}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white cursor-pointer shrink-0"
          >
            Quản lý cảnh báo
          </button>
        </div>
      )}

      {/* 4-Column Private Banking KPI Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-amber-200 dark:border-amber-900/70 p-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold text-amber-800 dark:text-amber-300">
            <span>Giá trị thu mua thực (Bid)</span>
            <ShieldCheck className="w-4 h-4" />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-slate-100 tabular-nums">
            {formatShortVNDMasked(metrics.totalLiquidationValueBid, isPrivacyMode)}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
            Giá mua thay thế (Ask): {formatShortVNDMasked(metrics.totalAskReplacementValue, isPrivacyMode)}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
            <span>Tổng lượng nắm giữ</span>
            <Coins className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-slate-100 tabular-nums">
            {formatChiWeight(metrics.totalRemainingChi, isPrivacyMode)}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
            {formatLuongWeight(metrics.totalRemainingChi, isPrivacyMode)} ·{" "}
            {isPrivacyMode ? "••• g" : `${chiToGrams(metrics.totalRemainingChi)} g`}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
            <span>Lãi/Lỗ ròng theo giá Bid</span>
            <TrendingUp
              className={`w-4 h-4 ${
                metrics.unrealizedPnl >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600"
              }`}
            />
          </div>
          <p
            className={`text-2xl font-black tabular-nums ${
              metrics.unrealizedPnl >= 0
                ? "text-emerald-700 dark:text-emerald-400"
                : "text-rose-600 dark:text-rose-400"
            }`}
          >
            {metrics.unrealizedPnl >= 0 ? "+" : ""}
            {formatShortVNDMasked(metrics.unrealizedPnl, isPrivacyMode)}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
            <span className="inline-flex items-center gap-0.5 font-bold">
              {metrics.unrealizedPnl >= 0 ? (
                <ArrowUpRight className="w-3 h-3 text-emerald-600" />
              ) : (
                <ArrowDownRight className="w-3 h-3 text-rose-600" />
              )}
              {metrics.unrealizedPnlPct >= 0 ? "+" : ""}
              {metrics.unrealizedPnlPct}%
            </span>{" "}
            · Đã chốt: {formatShortVNDMasked(metrics.realizedPnl, isPrivacyMode)} · Tổng:{" "}
            {formatShortVNDMasked(totalPnl, isPrivacyMode)}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
            <span>Giá vốn BQ / Hòa vốn thực</span>
            <Scale className="w-4 h-4 text-slate-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-slate-100 tabular-nums">
            {formatShortVNDMasked(metrics.weightedAvgCostPerChi, isPrivacyMode)}
            <span className="text-xs font-bold text-slate-400">/chỉ</span>
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
            Bid BQ: {formatShortVNDMasked(metrics.weightedBidPerChi, isPrivacyMode)} · Phí Spread:{" "}
            {formatShortVNDMasked(metrics.totalSpreadCostVnd, isPrivacyMode)}
          </p>
        </div>
      </section>

      {/* Net Worth Allocation Guardrail */}
      <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
              Kiểm Soát Tỷ Trọng Vàng Trong Tổng Tài Sản Ròng (Guardrail ±5%)
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
              {guardrail.headline}
            </p>
          </div>
          <span
            className={`text-xs font-black tabular-nums ${
              guardrail.status === "BALANCED"
                ? "text-emerald-700 dark:text-emerald-400"
                : guardrail.status === "UNDERWEIGHT"
                  ? "text-blue-700 dark:text-blue-400"
                  : "text-amber-700 dark:text-amber-300"
            }`}
          >
            Thực tế {guardrail.actualSharePct}% · Mục tiêu {guardrail.targetSharePct}% (vùng{" "}
            {guardrail.minBandPct}%–{guardrail.maxBandPct}%)
          </span>
        </div>

        <div className="relative h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
          {/* Target safe band */}
          <div
            className="absolute top-0 bottom-0 bg-emerald-200/70 dark:bg-emerald-900/50"
            style={{
              left: `${Math.min(100, (guardrail.minBandPct / 40) * 100)}%`,
              width: `${Math.min(100, ((guardrail.maxBandPct - guardrail.minBandPct) / 40) * 100)}%`,
            }}
          />
          {/* Actual allocation fill */}
          <div
            className={`relative h-full rounded-full transition-all ${
              guardrail.status === "BALANCED"
                ? "bg-emerald-600"
                : guardrail.status === "UNDERWEIGHT"
                  ? "bg-blue-600"
                  : "bg-amber-500"
            }`}
            style={{ width: `${Math.min(100, (guardrail.actualSharePct / 40) * 100)}%` }}
          />
        </div>
      </section>

      {/* Charts Row: NAV History Area Chart + Allocation by Category */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
                Biểu Đồ Lịch Sử NAV: Giá Trị Thu Mua (Bid) vs Giá Vốn Tích Lũy
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Tổng hợp từ các mốc mua/bán thực tế & lịch sử chốt giá hàng ngày (đơn vị: Triệu VNĐ)
              </p>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-bold">
              <span className="text-amber-600 dark:text-amber-400">■ Giá trị Bid</span>
              <span className="text-slate-500 dark:text-slate-400">■ Giá vốn gốc</span>
            </div>
          </div>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={navSeries} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="goldNavBidGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D97706" stopOpacity={0.32} />
                    <stop offset="95%" stopColor="#D97706" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" opacity={0.5} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} unit="tr" />
                <Tooltip
                  formatter={(value, name) => [
                    isPrivacyMode ? "•••• tr" : `${Number(value ?? 0).toLocaleString("vi-VN")} tr đ`,
                    name === "bidM" ? "Giá trị thu mua Bid" : "Giá vốn tích lũy",
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="costM"
                  stroke="#64748B"
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  fill="none"
                />
                <Area
                  type="monotone"
                  dataKey="bidM"
                  stroke="#D97706"
                  strokeWidth={2.4}
                  fill="url(#goldNavBidGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
              Cơ Cấu Theo Chủng Loại (Triệu VNĐ)
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              So sánh Giá trị thu mua thực (Bid) giữa Nhẫn 9999, SJC & Trang sức
            </p>
          </div>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryChartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" opacity={0.5} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} unit="tr" />
                <Tooltip
                  formatter={(value) =>
                    isPrivacyMode ? "•••• tr" : `${Number(value ?? 0).toLocaleString("vi-VN")} tr đ`
                  }
                />
                <Bar dataKey="bidM" name="Giá trị Bid" radius={[6, 6, 0, 0]}>
                  {categoryChartData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Bottom Row: Storage + Member + Handover Bridge */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2.5">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
            Phân Bổ Nơi Cất Trữ
          </h3>
          <div className="space-y-2 text-xs tabular-nums">
            {storageBreakdown.map((st) => (
              <div
                key={st.label}
                className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0"
              >
                <span className="font-semibold text-slate-700 dark:text-slate-200">{st.label}</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {formatChiWeight(st.chi, isPrivacyMode)} ·{" "}
                  {formatShortVNDMasked(st.bidVnd, isPrivacyMode)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2.5">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
            Sở Hữu Theo Thành Viên
          </h3>
          <div className="space-y-2 text-xs tabular-nums">
            {memberBreakdown.map((mb) => (
              <div
                key={mb.label}
                className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0"
              >
                <span className="font-semibold text-slate-700 dark:text-slate-200">{mb.label}</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {formatChiWeight(mb.chi, isPrivacyMode)} ·{" "}
                  {formatShortVNDMasked(mb.bidVnd, isPrivacyMode)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-teal-200 dark:border-teal-900/70 p-4 flex flex-col justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-teal-800 dark:text-teal-300">
                Cầu Nối Nhận Nhà SKYONE Q3/2027
              </h3>
              {handoverReadiness.status === "NEED_MORE_SAVINGS" && (
                <AlertTriangle className="w-4 h-4 text-rose-600" />
              )}
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 tabular-nums leading-relaxed">
              Tổng nhu cầu nhận nhà + BOQ:{" "}
              <strong>{formatVNDMasked(handoverReadiness.totalHandoverNeedVnd, isPrivacyMode)}</strong>.
              Sẵn sàng hợp nhất (Tiền mặt + Vàng):{" "}
              <strong className="text-teal-700 dark:text-teal-300">
                {handoverReadiness.readinessPctWithGold}%
              </strong>
              .
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onSwitchSubApp("INTERIOR", { interiorTab: "READINESS" })}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white cursor-pointer"
            >
              Xem Quỹ Nhận Nhà
            </button>
            <button
              type="button"
              onClick={() => onSwitchGoldTab("SIMULATOR")}
              className="px-3 py-1.5 rounded-lg text-xs font-bold border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 cursor-pointer"
            >
              Mô phỏng Bán & So Lãi Vay
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
