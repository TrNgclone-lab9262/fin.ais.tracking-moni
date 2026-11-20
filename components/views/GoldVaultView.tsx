"use client";

import React, { useMemo, useState } from "react";
import {
  Plus,
  RefreshCw,
  Trash2,
  ArrowUpRight,
  ArrowDownRight,
  Coins,
  Scale,
  TrendingUp,
  Target,
  ShieldCheck,
  AlertTriangle,
  X,
  Check,
  Wallet,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";
import { useFinance } from "@/context/FinanceContext";
import {
  FamilyMember,
  GoldCategory,
  GoldLiquidationStrategy,
  GoldSalePurpose,
  GoldStorageLocation,
} from "@/types/finance";
import {
  GOLD_CATEGORY_META,
  GOLD_STORAGE_LABELS,
  chiToGrams,
  computeDomesticPremium,
  computeGoldPortfolioMetrics,
  computeWorldGoldPricePerChiVnd,
  formatChiWeight,
  formatLuongWeight,
  simulateGoldLiquidation,
} from "@/lib/goldEngine";
import {
  calculateHandoverReadiness,
  calculateScenarioBoq,
} from "@/lib/interiorBoqEngine";
import {
  formatDateVN,
  formatShortVNDMasked,
  formatVNDMasked,
} from "@/lib/formatters";

const GOLD_CATEGORIES: GoldCategory[] = [
  "NHAN_9999",
  "SJC_BAR",
  "GOLD_24K_JEWELRY",
  "GOLD_18K",
  "DIGITAL_GOLD",
];

const BRAND_SUGGESTIONS: Record<GoldCategory, string[]> = {
  NHAN_9999: ["PNJ 9999", "SJC 9999", "BTMC Rồng Thăng Long", "DOJI Hưng Thịnh Vượng"],
  SJC_BAR: ["SJC Miếng 1 lượng", "SJC Miếng 5 chỉ", "SJC Miếng 2 chỉ"],
  GOLD_24K_JEWELRY: ["PNJ 24K", "SJC 24K", "Mi Hồng 999"],
  GOLD_18K: ["PNJ 18K (750)", "DOJI 18K"],
  DIGITAL_GOLD: ["DOJI eGold", "Tích lũy PNJ"],
};

const SALE_PURPOSE_LABELS: Record<GoldSalePurpose, string> = {
  INTERIOR_HANDOVER: "Hoàn thiện Nội thất Q3/2027",
  SKYONE_PREPAY: "Tất toán gốc SKYONE 08/2028",
  REBALANCE: "Chốt lời / Tái cơ cấu danh mục",
  OTHER: "Nhu cầu gia đình khác",
};

export function GoldVaultView() {
  const {
    goldTab,
    setGoldTab,
    goldPortfolio,
    addGoldLot,
    deleteGoldLot,
    recordGoldSale,
    updateGoldPriceQuote,
    updateGoldMacro,
    updateGoldDcaPlan,
    toggleGoldIncludeInNetWorth,
    fetchReferenceGoldPrices,
    accounts,
    summary,
    interiorStudio,
    settings,
    isPrivacyMode,
    switchSubApp,
  } = useFinance();

  const metrics = useMemo(
    () => computeGoldPortfolioMetrics(goldPortfolio),
    [goldPortfolio]
  );

  // Handover Readiness bridge (4-app integration)
  const activeInteriorScenario = useMemo(
    () =>
      interiorStudio.scenarios.find((s) => s.id === interiorStudio.activeScenarioId) ||
      interiorStudio.scenarios[0],
    [interiorStudio]
  );

  const activeBoqSummary = useMemo(
    () => (activeInteriorScenario ? calculateScenarioBoq(activeInteriorScenario) : null),
    [activeInteriorScenario]
  );

  const handoverReadiness = useMemo(() => {
    const monthlySurplus = Math.max(0, summary.savingsAmount || 18_000_000);
    return calculateHandoverReadiness({
      liquidCashVnd: summary.currentBalance,
      monthlyNetSurplusVnd: monthlySurplus,
      monthsUntilHandover: 10,
      goldLiquidationValueBidVnd: metrics.totalLiquidationValueBid,
      goldNhan9999BidPerChiVnd: goldPortfolio.quotes.NHAN_9999?.buyPricePerChi || 9_050_000,
      interiorBoqTotalVnd: activeBoqSummary?.grandTotalWithContingency ?? 140_000_000,
      includePinkBook5Pct: false,
    });
  }, [
    summary.currentBalance,
    summary.savingsAmount,
    metrics.totalLiquidationValueBid,
    goldPortfolio.quotes.NHAN_9999?.buyPricePerChi,
    activeBoqSummary,
  ]);

  // Modals state
  const [isAddLotOpen, setIsAddLotOpen] = useState(false);
  const [isSellModalOpen, setIsSellModalOpen] = useState(false);

  // Add Lot Form State (default Nhẫn trơn 9999)
  const [lotCategory, setLotCategory] = useState<GoldCategory>("NHAN_9999");
  const [lotBrand, setLotBrand] = useState("PNJ 9999");
  const [lotUnit, setLotUnit] = useState<"CHI" | "LUONG">("CHI");
  const [lotQtyInput, setLotQtyInput] = useState("2");
  const [lotBuyPriceInput, setLotBuyPriceInput] = useState(
    String(goldPortfolio.quotes.NHAN_9999.sellPricePerChi)
  );
  const [lotMakingFeeInput, setLotMakingFeeInput] = useState("0");
  const [lotDate, setLotDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [lotMember, setLotMember] = useState<FamilyMember>("SHARED");
  const [lotStorage, setLotStorage] = useState<GoldStorageLocation>("HOME_SAFE");
  const [lotNote, setLotNote] = useState("");
  const [lotLinkAccountId, setLotLinkAccountId] = useState<string>("");

  // Sell Lot Form State
  const [sellCategory, setSellCategory] = useState<GoldCategory>("NHAN_9999");
  const [sellMode, setSellMode] = useState<"FIFO" | "SPECIFIC_LOT">("FIFO");
  const [sellSpecificLotId, setSellSpecificLotId] = useState<string>("");
  const [sellQtyInput, setSellQtyInput] = useState("1");
  const [sellPriceInput, setSellPriceInput] = useState(
    String(goldPortfolio.quotes.NHAN_9999.buyPricePerChi)
  );
  const [sellDate, setSellDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [sellPurpose, setSellPurpose] = useState<GoldSalePurpose>("INTERIOR_HANDOVER");
  const [sellNote, setSellNote] = useState("");
  const [sellLinkAccountId, setSellLinkAccountId] = useState<string>("");
  const [sellError, setSellError] = useState<string | null>(null);

  // Prices tab server fetch feedback
  const [isFetchingRef, setIsFetchingRef] = useState(false);
  const [refStatusMsg, setRefStatusMsg] = useState<string | null>(null);

  // Simulator state
  const [simTargetVnd, setSimTargetVnd] = useState<number>(() =>
    Math.max(50_000_000, handoverReadiness.cashOnlyGapVnd || 90_000_000)
  );
  const [simStrategy, setSimStrategy] =
    useState<GoldLiquidationStrategy>("MIN_SPREAD_FIRST");

  const simulation = useMemo(
    () => simulateGoldLiquidation(goldPortfolio, simTargetVnd, simStrategy),
    [goldPortfolio, simTargetVnd, simStrategy]
  );

  const nonCreditAccounts = useMemo(
    () => accounts.filter((a) => a.type !== "CREDIT_CARD"),
    [accounts]
  );

  const openAddLotModal = () => {
    setLotCategory("NHAN_9999");
    setLotBrand("PNJ 9999");
    setLotUnit("CHI");
    setLotQtyInput("2");
    setLotBuyPriceInput(String(goldPortfolio.quotes.NHAN_9999.sellPricePerChi));
    setLotMakingFeeInput("0");
    setLotDate(new Date().toISOString().slice(0, 10));
    setLotNote("");
    setLotLinkAccountId("");
    setIsAddLotOpen(true);
  };

  const openSellModal = (preselectCat?: GoldCategory, preselectLotId?: string) => {
    const cat = preselectCat ?? "NHAN_9999";
    setSellCategory(cat);
    setSellMode(preselectLotId ? "SPECIFIC_LOT" : "FIFO");
    setSellSpecificLotId(preselectLotId || "");
    setSellQtyInput("1");
    setSellPriceInput(String(goldPortfolio.quotes[cat].buyPricePerChi));
    setSellDate(new Date().toISOString().slice(0, 10));
    setSellPurpose("INTERIOR_HANDOVER");
    setSellNote("");
    setSellLinkAccountId("");
    setSellError(null);
    setIsSellModalOpen(true);
  };

  const handleSubmitAddLot = (e: React.FormEvent) => {
    e.preventDefault();
    const rawQty = Number(lotQtyInput);
    const buyPrice = Number(lotBuyPriceInput);
    const makingFee = Math.max(0, Number(lotMakingFeeInput) || 0);
    if (!Number.isFinite(rawQty) || rawQty <= 0 || !Number.isFinite(buyPrice) || buyPrice <= 0) {
      return;
    }
    const quantityChi = lotUnit === "LUONG" ? rawQty * 10 : rawQty;
    addGoldLot(
      {
        category: lotCategory,
        brand: lotBrand.trim() || GOLD_CATEGORY_META[lotCategory].defaultBrand,
        purchaseDate: lotDate,
        quantityChi: Math.round(quantityChi * 1000) / 1000,
        unitBuyPricePerChi: Math.round(buyPrice),
        makingFee: Math.round(makingFee),
        memberId: lotMember,
        storageLocation: lotStorage,
        invoiceNote: lotNote.trim() || undefined,
      },
      { linkAccountId: lotLinkAccountId || undefined }
    );
    setIsAddLotOpen(false);
  };

  const handleSubmitSellLot = (e: React.FormEvent) => {
    e.preventDefault();
    setSellError(null);
    const qty = Number(sellQtyInput);
    const unitPrice = Number(sellPriceInput);
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(unitPrice) || unitPrice <= 0) {
      setSellError("Vui lòng nhập số chỉ và giá tiệm mua lại hợp lệ.");
      return;
    }

    const res = recordGoldSale({
      saleDate: sellDate,
      category: sellCategory,
      quantityChi: qty,
      unitSellPricePerChi: Math.round(unitPrice),
      mode: sellMode,
      specificLotId: sellMode === "SPECIFIC_LOT" ? sellSpecificLotId : undefined,
      purpose: sellPurpose,
      note: sellNote.trim() || undefined,
      linkAccountId: sellLinkAccountId || undefined,
    });

    if (!res.ok) {
      setSellError(res.error || "Không thể ghi nhận giao dịch bán vàng.");
      return;
    }
    setIsSellModalOpen(false);
  };

  const handleServerPriceFetch = async () => {
    setIsFetchingRef(true);
    setRefStatusMsg(null);
    const res = await fetchReferenceGoldPrices(true);
    setIsFetchingRef(false);
    setRefStatusMsg(res.ok ? res.note || "Đã cập nhật bảng giá tham khảo." : res.error || "Lỗi kết nối.");
  };

  const chartData = useMemo(
    () =>
      metrics.byCategory.map((item) => ({
        name: GOLD_CATEGORY_META[item.category].shortLabel,
        costVnd: Math.round(item.costBasis / 1_000_000),
        bidVnd: Math.round(item.liquidationValueBid / 1_000_000),
        color: GOLD_CATEGORY_META[item.category].color,
      })),
    [metrics.byCategory]
  );

  const holdingLots = useMemo(
    () => goldPortfolio.lots.filter((l) => l.remainingChi > 0.0001),
    [goldPortfolio.lots]
  );

  const worldPerChi = useMemo(
    () => computeWorldGoldPricePerChiVnd(goldPortfolio.macro),
    [goldPortfolio.macro]
  );

  const nhanPremium = useMemo(
    () => computeDomesticPremium(goldPortfolio.quotes.NHAN_9999, goldPortfolio.macro),
    [goldPortfolio.quotes.NHAN_9999, goldPortfolio.macro]
  );

  const sjcPremium = useMemo(
    () => computeDomesticPremium(goldPortfolio.quotes.SJC_BAR, goldPortfolio.macro),
    [goldPortfolio.quotes.SJC_BAR, goldPortfolio.macro]
  );

  return (
    <div className="space-y-6 pb-8">
      {/* =================================================================== */}
      {/* TAB 1: OVERVIEW                                                      */}
      {/* =================================================================== */}
      {goldTab === "OVERVIEW" && (
        <>
          {/* Hero KPI Strip */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-[#DCE4EE] dark:border-slate-800 p-5 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                <span>Tổng lượng nắm giữ</span>
                <Coins className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <p className="text-2xl font-black text-[#0F172A] dark:text-slate-100 tabular-nums">
                {formatChiWeight(metrics.totalRemainingChi, isPrivacyMode)}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                {formatLuongWeight(metrics.totalRemainingChi, isPrivacyMode)} ·{" "}
                {isPrivacyMode ? "••• g" : `${chiToGrams(metrics.totalRemainingChi)} g`}
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-amber-200 dark:border-amber-900/60 p-5 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold text-amber-800 dark:text-amber-300">
                <span>Giá trị thanh khoản (Bid)</span>
                <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <p className="text-2xl font-black text-amber-800 dark:text-amber-300 tabular-nums">
                {formatShortVNDMasked(metrics.totalLiquidationValueBid, isPrivacyMode)}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                Tiệm mua lại thực thu · Spread{" "}
                {formatShortVNDMasked(metrics.totalSpreadCostVnd, isPrivacyMode)}
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-[#DCE4EE] dark:border-slate-800 p-5 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                <span>Tổng vốn mua &amp; WAC</span>
                <Wallet className="w-4 h-4 text-slate-500" />
              </div>
              <p className="text-2xl font-black text-[#0F172A] dark:text-slate-100 tabular-nums">
                {formatShortVNDMasked(metrics.totalCostBasis, isPrivacyMode)}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                Giá vốn BQ: {formatShortVNDMasked(metrics.weightedAvgCostPerChi, isPrivacyMode)}/chỉ
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-[#DCE4EE] dark:border-slate-800 p-5 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                <span>Lãi/Lỗ thực tế (sau Spread)</span>
                {metrics.unrealizedPnl >= 0 ? (
                  <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                ) : (
                  <ArrowDownRight className="w-4 h-4 text-rose-600" />
                )}
              </div>
              <p
                className={`text-2xl font-black tabular-nums ${
                  metrics.unrealizedPnl >= 0
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-rose-700 dark:text-rose-400"
                }`}
              >
                {metrics.unrealizedPnl >= 0 ? "+" : ""}
                {formatShortVNDMasked(metrics.unrealizedPnl, isPrivacyMode)}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                {metrics.unrealizedPnl >= 0 ? "+" : ""}
                {metrics.unrealizedPnlPct.toFixed(2)}% · Đã chốt:{" "}
                {formatShortVNDMasked(metrics.realizedPnl, isPrivacyMode)}
              </p>
            </div>
          </section>

          {/* Action Bar & Net Worth Toggle */}
          <section className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 rounded-2xl border border-[#DCE4EE] dark:border-slate-800 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={openAddLotModal}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Ghi mua vàng (Nhẫn 9999)</span>
              </button>
              <button
                type="button"
                onClick={() => openSellModal()}
                disabled={metrics.totalRemainingChi <= 0}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-[#DCE4EE] dark:border-slate-700 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Scale className="w-4 h-4" />
                <span>Ghi bán / Thanh khoản</span>
              </button>
              <button
                type="button"
                onClick={() => setGoldTab("SIMULATOR")}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 transition-colors cursor-pointer"
              >
                <TrendingUp className="w-4 h-4" />
                <span>Mô phỏng bán Q3/2027</span>
              </button>
            </div>

            <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={goldPortfolio.includeInNetWorth}
                onChange={(e) => toggleGoldIncludeInNetWorth(e.target.checked)}
                className="w-4 h-4 rounded accent-amber-600 cursor-pointer"
              />
              <span>Cộng giá trị Bid vào Tài sản ròng HOME MONI</span>
            </label>
          </section>

          {/* Chart & Category Breakdown */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-[#DCE4EE] dark:border-slate-800 p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-black text-[#0F172A] dark:text-slate-100">
                    So sánh Vốn mua vs Giá trị thanh khoản Bid (Triệu VNĐ)
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Mọi khoản định giá đều áp dụng giá tiệm mua lại để tránh ảo giác lợi nhuận
                  </p>
                </div>
              </div>

              {chartData.length > 0 ? (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <BarChart data={chartData} margin={{ top: 10, right: 16, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" opacity={0.4} />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 11 }} unit="tr" />
                      <Tooltip
                        formatter={(value: unknown, name: unknown) => [
                          isPrivacyMode ? "••• tr" : `${Number(value).toLocaleString("vi-VN")} tr`,
                          name === "costVnd" ? "Vốn mua" : "Thanh khoản Bid",
                        ]}
                      />
                      <Bar dataKey="costVnd" name="costVnd" fill="#94A3B8" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="bidVnd" name="bidVnd" radius={[6, 6, 0, 0]}>
                        {chartData.map((entry, idx) => (
                          <Cell key={idx} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-56 flex flex-col items-center justify-center text-center text-slate-500 text-sm">
                  <p>Chưa có lô vàng nào đang nắm giữ.</p>
                </div>
              )}
            </div>

            {/* Q3/2027 Handover Shield Card */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-[#DCE4EE] dark:border-slate-800 p-5 flex flex-col justify-between gap-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-black text-[#0F172A] dark:text-slate-100">
                    Lá chắn Nhận nhà Q3/2027
                  </h2>
                  <span className="text-xs font-bold text-teal-700 dark:text-teal-300">
                    A.12A.07
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Liên thông trực tiếp với dự toán nội thất{" "}
                  <strong className="text-slate-700 dark:text-slate-200">
                    {activeInteriorScenario?.shortLabel}
                  </strong>{" "}
                  và nghĩa vụ PBT 2% + 5% Sổ hồng.
                </p>

                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Tổng nhu cầu Q3/2027</span>
                    <span className="font-bold tabular-nums">
                      {formatShortVNDMasked(handoverReadiness.totalHandoverNeedVnd, isPrivacyMode)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Tiền mặt + tích lũy dự kiến</span>
                    <span className="font-bold tabular-nums text-blue-700 dark:text-blue-400">
                      {formatShortVNDMasked(handoverReadiness.projectedCashAtHandoverVnd, isPrivacyMode)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Kho Vàng (Bid thực thu)</span>
                    <span className="font-bold tabular-nums text-amber-700 dark:text-amber-400">
                      {formatShortVNDMasked(metrics.totalLiquidationValueBid, isPrivacyMode)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span className="font-bold text-slate-700 dark:text-slate-200">
                      Đệm an toàn sau nhận nhà
                    </span>
                    <span
                      className={`font-black tabular-nums ${
                        handoverReadiness.combinedSurplusOrGapVnd >= 0
                          ? "text-emerald-700 dark:text-emerald-400"
                          : "text-rose-700 dark:text-rose-400"
                      }`}
                    >
                      {handoverReadiness.combinedSurplusOrGapVnd >= 0 ? "+" : ""}
                      {formatShortVNDMasked(handoverReadiness.combinedSurplusOrGapVnd, isPrivacyMode)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => switchSubApp("INTERIOR", { interiorTab: "READINESS" })}
                  className="w-full py-2.5 px-3 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white transition-colors cursor-pointer"
                >
                  Xem độ sẵn sàng Q3/2027 (4 Sub-App)
                </button>
                <button
                  type="button"
                  onClick={() => setGoldTab("PRICES")}
                  className="w-full py-2 px-3 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                >
                  Chênh lệch Nhẫn 9999 vs Thế giới: {nhanPremium.premiumOverWorldPct >= 0 ? "+" : ""}
                  {nhanPremium.premiumOverWorldPct.toFixed(1)}%
                </button>
              </div>
            </div>
          </section>

          {/* Breakdown Table by Category */}
          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-[#DCE4EE] dark:border-slate-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E9EEF5] dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-sm font-black text-[#0F172A] dark:text-slate-100">
                Cơ cấu danh mục theo loại vàng
              </h2>
              <span className="text-xs font-semibold text-slate-500">
                Ưu tiên tích lũy: Nhẫn trơn 9999
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                    <th className="py-3 px-5 font-bold">Loại vàng</th>
                    <th className="py-3 px-4 font-bold text-right">Khối lượng</th>
                    <th className="py-3 px-4 font-bold text-right">Giá vốn BQ (WAC)</th>
                    <th className="py-3 px-4 font-bold text-right">Giá Bid hiện tại</th>
                    <th className="py-3 px-4 font-bold text-right">Thanh khoản thực</th>
                    <th className="py-3 px-5 font-bold text-right">Lãi/Lỗ ròng</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {metrics.byCategory.map((row) => {
                    const wacPerChi =
                      row.remainingChi > 0 ? Math.round(row.costBasis / row.remainingChi) : 0;
                    const currentBidPerChi =
                      goldPortfolio.quotes[row.category]?.buyPricePerChi || 0;
                    const pnlPct =
                      row.costBasis > 0 ? (row.unrealizedPnl / row.costBasis) * 100 : 0;
                    return (
                      <tr key={row.category} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="py-3 px-5 font-bold text-[#0F172A] dark:text-slate-100">
                          <span className="inline-flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: GOLD_CATEGORY_META[row.category].color }}
                            />
                            <span>{GOLD_CATEGORY_META[row.category].label}</span>
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-bold tabular-nums">
                          {formatChiWeight(row.remainingChi, isPrivacyMode)}{" "}
                          <span className="text-slate-400 font-normal">
                            ({row.sharePct.toFixed(0)}%)
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums text-slate-600 dark:text-slate-300">
                          {formatVNDMasked(wacPerChi, isPrivacyMode)}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums font-semibold text-amber-700 dark:text-amber-300">
                          {formatVNDMasked(currentBidPerChi, isPrivacyMode)}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums font-bold">
                          {formatVNDMasked(row.liquidationValueBid, isPrivacyMode)}
                        </td>
                        <td
                          className={`py-3 px-5 text-right tabular-nums font-bold ${
                            row.unrealizedPnl >= 0
                              ? "text-emerald-700 dark:text-emerald-400"
                              : "text-rose-700 dark:text-rose-400"
                          }`}
                        >
                          {row.unrealizedPnl >= 0 ? "+" : ""}
                          {formatShortVNDMasked(row.unrealizedPnl, isPrivacyMode)} (
                          {pnlPct.toFixed(1)}%)
                        </td>
                      </tr>
                    );
                  })}
                  {metrics.byCategory.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        Chưa có lô vàng nào đang nắm giữ. Bấm &ldquo;Ghi mua vàng&rdquo; để bắt đầu.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {/* =================================================================== */}
      {/* TAB 2: LOTS & TRANSACTIONS                                           */}
      {/* =================================================================== */}
      {goldTab === "LOTS" && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-[#0F172A] dark:text-slate-100">
                Sổ Lô Vàng Vật Chất ({goldPortfolio.lots.length} lô)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Quản trị giá vốn riêng từng hóa đơn · hỗ trợ xuất bán FIFO hoặc chọn lô cụ thể
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={openAddLotModal}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm lô mua mới</span>
              </button>
              <button
                type="button"
                onClick={() => openSellModal()}
                disabled={holdingLots.length === 0}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 cursor-pointer disabled:opacity-50"
              >
                <Scale className="w-4 h-4" />
                <span>Ghi bán vàng</span>
              </button>
            </div>
          </div>

          {/* Lots Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-[#DCE4EE] dark:border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                    <th className="py-3 px-4 font-bold">Ngày mua</th>
                    <th className="py-3 px-4 font-bold">Loại / Thương hiệu</th>
                    <th className="py-3 px-4 font-bold text-right">Còn lại / Ban đầu</th>
                    <th className="py-3 px-4 font-bold text-right">Giá mua/chỉ</th>
                    <th className="py-3 px-4 font-bold text-right">Định giá Bid</th>
                    <th className="py-3 px-4 font-bold text-right">Lãi/Lỗ lô</th>
                    <th className="py-3 px-4 font-bold">Nơi cất trữ</th>
                    <th className="py-3 px-4 font-bold text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {goldPortfolio.lots.map((lot) => {
                    const quote = goldPortfolio.quotes[lot.category];
                    const effectiveUnitCost =
                      lot.unitBuyPricePerChi +
                      (lot.quantityChi > 0 ? lot.makingFee / lot.quantityChi : 0);
                    const costRem = Math.round(lot.remainingChi * effectiveUnitCost);
                    const bidVal = Math.round(lot.remainingChi * (quote?.buyPricePerChi || 0));
                    const pnl = bidVal - costRem;
                    return (
                      <tr key={lot.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="py-3 px-4 tabular-nums font-semibold">
                          {formatDateVN(lot.purchaseDate)}
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-bold text-[#0F172A] dark:text-slate-100">
                            {lot.brand}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {GOLD_CATEGORY_META[lot.category].label}
                            {lot.invoiceNote ? ` · ${lot.invoiceNote}` : ""}
                          </p>
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums font-bold">
                          {formatChiWeight(lot.remainingChi, isPrivacyMode)}
                          {lot.remainingChi !== lot.quantityChi && (
                            <span className="block text-[10px] text-slate-400 font-normal">
                              Gốc: {formatChiWeight(lot.quantityChi, isPrivacyMode)}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums">
                          {formatVNDMasked(lot.unitBuyPricePerChi, isPrivacyMode)}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums font-bold text-amber-700 dark:text-amber-300">
                          {formatVNDMasked(bidVal, isPrivacyMode)}
                        </td>
                        <td
                          className={`py-3 px-4 text-right tabular-nums font-bold ${
                            pnl >= 0
                              ? "text-emerald-700 dark:text-emerald-400"
                              : "text-rose-700 dark:text-rose-400"
                          }`}
                        >
                          {lot.remainingChi > 0
                            ? `${pnl >= 0 ? "+" : ""}${formatShortVNDMasked(pnl, isPrivacyMode)}`
                            : "Đã bán hết"}
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                          {GOLD_STORAGE_LABELS[lot.storageLocation]}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            {lot.remainingChi > 0 && (
                              <button
                                type="button"
                                onClick={() => openSellModal(lot.category, lot.id)}
                                className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 hover:bg-amber-100 cursor-pointer"
                              >
                                Bán lô
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => deleteGoldLot(lot.id)}
                              aria-label="Xóa lô vàng"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Realized Sales History */}
          {goldPortfolio.sales.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-[#DCE4EE] dark:border-slate-800 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-sm font-black text-[#0F172A] dark:text-slate-100">
                  Lịch sử bán &amp; chốt lời ({goldPortfolio.sales.length} lần)
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-500">
                      <th className="py-2.5 px-4 font-bold">Ngày bán</th>
                      <th className="py-2.5 px-4 font-bold">Loại / Mục đích</th>
                      <th className="py-2.5 px-4 font-bold text-right">Số chỉ bán</th>
                      <th className="py-2.5 px-4 font-bold text-right">Thực thu (VND)</th>
                      <th className="py-2.5 px-4 font-bold text-right">Lãi/Lỗ chốt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {goldPortfolio.sales.map((sale) => (
                      <tr key={sale.id}>
                        <td className="py-2.5 px-4 tabular-nums">{formatDateVN(sale.saleDate)}</td>
                        <td className="py-2.5 px-4">
                          <span className="font-bold">
                            {GOLD_CATEGORY_META[sale.category].label}
                          </span>
                          <span className="block text-[11px] text-slate-500">
                            {SALE_PURPOSE_LABELS[sale.purpose]}
                            {sale.note ? ` · ${sale.note}` : ""}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-right tabular-nums font-bold">
                          {formatChiWeight(sale.totalSoldChi, isPrivacyMode)}
                        </td>
                        <td className="py-2.5 px-4 text-right tabular-nums font-bold">
                          {formatVNDMasked(sale.totalProceeds, isPrivacyMode)}
                        </td>
                        <td
                          className={`py-2.5 px-4 text-right tabular-nums font-bold ${
                            sale.realizedPnl >= 0 ? "text-emerald-700" : "text-rose-700"
                          }`}
                        >
                          {sale.realizedPnl >= 0 ? "+" : ""}
                          {formatVNDMasked(sale.realizedPnl, isPrivacyMode)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 3: PRICES & DOMESTIC-WORLD SPREAD                                */}
      {/* =================================================================== */}
      {goldTab === "PRICES" && (
        <div className="space-y-6">
          {/* Macro & Server Refresh Banner */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-[#DCE4EE] dark:border-slate-800 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-black text-[#0F172A] dark:text-slate-100">
                  Cập nhật bảng giá vàng (Đơn vị: VNĐ / 1 Chỉ)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Chỉnh trực tiếp theo bảng giá tiệm bạn mua hoặc bấm lấy giá tham khảo từ máy chủ
                </p>
              </div>
              <button
                type="button"
                onClick={handleServerPriceFetch}
                disabled={isFetchingRef}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white cursor-pointer disabled:opacity-60"
              >
                <RefreshCw className={`w-4 h-4 ${isFetchingRef ? "animate-spin" : ""}`} />
                <span>Lấy giá tham khảo từ server</span>
              </button>
            </div>

            {refStatusMsg && (
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl px-3.5 py-2.5">
                {refStatusMsg}
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Giá vàng thế giới XAU/USD (USD/oz)
                </label>
                <input
                  type="number"
                  step="1"
                  value={goldPortfolio.macro.worldXauUsdPerOz}
                  onChange={(e) =>
                    updateGoldMacro({ worldXauUsdPerOz: Math.max(0, Number(e.target.value) || 0) })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-[#DCE4EE] dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-bold tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Tỷ giá USD/VND tham chiếu
                </label>
                <input
                  type="number"
                  step="10"
                  value={goldPortfolio.macro.usdVndRate}
                  onChange={(e) =>
                    updateGoldMacro({ usdVndRate: Math.max(1000, Number(e.target.value) || 25450) })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-[#DCE4EE] dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-bold tabular-nums"
                />
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/70 rounded-xl p-3 border border-slate-200 dark:border-slate-700 flex flex-col justify-center">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  Quy đổi Thế giới (1 Chỉ · chưa thuế/phí)
                </span>
                <span className="text-lg font-black text-[#0F172A] dark:text-slate-100 tabular-nums">
                  {formatVNDMasked(worldPerChi, isPrivacyMode)}
                </span>
              </div>
            </div>
          </div>

          {/* Editable Quote Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {GOLD_CATEGORIES.map((cat) => {
              const quote = goldPortfolio.quotes[cat];
              const prem = computeDomesticPremium(quote, goldPortfolio.macro);
              const isPrimary = cat === "NHAN_9999";
              return (
                <div
                  key={cat}
                  className={`bg-white dark:bg-slate-900 rounded-2xl border p-5 space-y-3 ${
                    isPrimary
                      ? "border-amber-400 dark:border-amber-700"
                      : "border-[#DCE4EE] dark:border-slate-800"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-black text-[#0F172A] dark:text-slate-100">
                        {GOLD_CATEGORY_META[cat].label}
                        {isPrimary && (
                          <span className="ml-2 text-[11px] font-bold text-amber-700 dark:text-amber-300">
                            · Ưu tiên chính
                          </span>
                        )}
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        {quote.brandLabel} ·{" "}
                        {quote.source === "SERVER_REFERENCE" ? "Tham khảo Server" : "Nhập thủ công"}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-bold tabular-nums ${
                        prem.riskLevel === "HIGH"
                          ? "text-rose-600 dark:text-rose-400"
                          : prem.riskLevel === "MODERATE"
                            ? "text-amber-700 dark:text-amber-300"
                            : "text-emerald-700 dark:text-emerald-400"
                      }`}
                    >
                      Chênh TG {prem.premiumOverWorldPct >= 0 ? "+" : ""}
                      {prem.premiumOverWorldPct.toFixed(1)}%
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">
                        Tiệm MUA VÀO (Bid / chỉ)
                      </label>
                      <input
                        type="number"
                        step="10000"
                        value={quote.buyPricePerChi}
                        onChange={(e) =>
                          updateGoldPriceQuote(cat, {
                            buyPricePerChi: Math.max(100000, Number(e.target.value) || 0),
                            source: "MANUAL",
                          })
                        }
                        className="w-full px-3 py-2 rounded-xl border border-[#DCE4EE] dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-bold tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">
                        Tiệm BÁN RA (Ask / chỉ)
                      </label>
                      <input
                        type="number"
                        step="10000"
                        value={quote.sellPricePerChi}
                        onChange={(e) =>
                          updateGoldPriceQuote(cat, {
                            sellPricePerChi: Math.max(100000, Number(e.target.value) || 0),
                            source: "MANUAL",
                          })
                        }
                        className="w-full px-3 py-2 rounded-xl border border-[#DCE4EE] dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-bold tabular-nums"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800 tabular-nums">
                    <span>
                      Spread mua–bán: <strong>{formatVNDMasked(prem.spreadPerChiVnd, isPrivacyMode)}</strong> (
                      {prem.spreadPct.toFixed(2)}%)
                    </span>
                    <span>
                      Chênh TG:{" "}
                      <strong>
                        {prem.premiumOverWorldVnd >= 0 ? "+" : ""}
                        {formatShortVNDMasked(prem.premiumOverWorldVnd, isPrivacyMode)}/chỉ
                      </strong>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Insight Box comparing Nhẫn 9999 vs SJC */}
          <div className="bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-2xl p-4 text-xs text-amber-950 dark:text-amber-200 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>Góc nhìn Fintech:</strong> Hiện tại chênh lệch nội–ngoại của{" "}
              <strong>Nhẫn trơn 9999</strong> là{" "}
              <span className="font-black tabular-nums">
                {nhanPremium.premiumOverWorldPct.toFixed(1)}%
              </span>{" "}
              (Spread {nhanPremium.spreadPct.toFixed(2)}%), so với{" "}
              <strong>Vàng miếng SJC</strong> là{" "}
              <span className="font-black tabular-nums">
                {sjcPremium.premiumOverWorldPct.toFixed(1)}%
              </span>
              . Tích lũy đều bằng Nhẫn 9999 giúp tối ưu điểm hòa vốn và thanh khoản linh hoạt từng
              1–2 chỉ khi giải ngân nội thất Q3/2027.
            </p>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 4: DCA PLANNER                                                   */}
      {/* =================================================================== */}
      {goldTab === "DCA" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-[#DCE4EE] dark:border-slate-800 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-[#0F172A] dark:text-slate-100">
                Thiết lập kỷ luật tích lũy DCA
              </h2>
              <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer">
                <input
                  type="checkbox"
                  checked={goldPortfolio.dcaPlan.enabled}
                  onChange={(e) => updateGoldDcaPlan({ enabled: e.target.checked })}
                  className="w-4 h-4 accent-amber-600"
                />
                <span>Đang kích hoạt</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Loại vàng ưu tiên mua định kỳ
                </label>
                <select
                  value={goldPortfolio.dcaPlan.targetCategory}
                  onChange={(e) =>
                    updateGoldDcaPlan({ targetCategory: e.target.value as GoldCategory })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-[#DCE4EE] dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold"
                >
                  {GOLD_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {GOLD_CATEGORY_META[c].label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Mục tiêu mua hàng tháng (Chỉ)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={goldPortfolio.dcaPlan.monthlyTargetChi}
                  onChange={(e) => {
                    const chi = Math.max(0, Number(e.target.value) || 0);
                    const ask = goldPortfolio.quotes[goldPortfolio.dcaPlan.targetCategory].sellPricePerChi;
                    updateGoldDcaPlan({
                      monthlyTargetChi: chi,
                      monthlyBudgetVnd: Math.round(chi * ask),
                    });
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-[#DCE4EE] dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-bold tabular-nums"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Mục tiêu tích trữ đến Q3/2027 (Chỉ)
                </label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  value={goldPortfolio.dcaPlan.targetReserveChiFor2027}
                  onChange={(e) =>
                    updateGoldDcaPlan({
                      targetReserveChiFor2027: Math.max(1, Number(e.target.value) || 10),
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-[#DCE4EE] dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-bold tabular-nums"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Tỷ trọng Vàng mục tiêu / Net Worth (%)
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  max="60"
                  value={goldPortfolio.dcaPlan.targetAllocationPercentOfNetWorth}
                  onChange={(e) =>
                    updateGoldDcaPlan({
                      targetAllocationPercentOfNetWorth: Math.min(
                        60,
                        Math.max(0, Number(e.target.value) || 0)
                      ),
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-[#DCE4EE] dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-bold tabular-nums"
                />
              </div>
            </div>
          </div>

          {/* Progress & Pace Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-[#DCE4EE] dark:border-slate-800 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-[#0F172A] dark:text-slate-100">
                Tiến độ mục tiêu Q3/2027
              </h2>
              <Target className="w-4 h-4 text-amber-600" />
            </div>

            {(() => {
              const targetChi = Math.max(1, goldPortfolio.dcaPlan.targetReserveChiFor2027);
              const progressPct = Math.min(100, Math.round((metrics.totalRemainingChi / targetChi) * 100));
              const remainingChi = Math.max(0, targetChi - metrics.totalRemainingChi);
              const monthlyChi = Math.max(0.1, goldPortfolio.dcaPlan.monthlyTargetChi || 1);
              const monthsToReach = Math.ceil(remainingChi / monthlyChi);
              const currentAllocationPct =
                summary.netWorth > 0
                  ? (metrics.totalLiquidationValueBid / summary.netWorth) * 100
                  : 0;
              return (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold tabular-nums">
                      <span>
                        Hiện có: {formatChiWeight(metrics.totalRemainingChi, isPrivacyMode)}
                      </span>
                      <span className="text-amber-700 dark:text-amber-300">
                        Mục tiêu: {formatChiWeight(targetChi, isPrivacyMode)} ({progressPct}%)
                      </span>
                    </div>
                    <div className="h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full transition-all duration-300"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70">
                      <p className="text-slate-500">Cần tích lũy thêm</p>
                      <p className="text-base font-black tabular-nums mt-0.5">
                        {formatChiWeight(remainingChi, isPrivacyMode)}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        ~{monthsToReach} tháng theo tốc độ DCA hiện tại
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70">
                      <p className="text-slate-500">Tỷ trọng Vàng / Net Worth</p>
                      <p className="text-base font-black tabular-nums mt-0.5">
                        {isPrivacyMode ? "••%" : `${currentAllocationPct.toFixed(1)}%`}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Khung mục tiêu: {goldPortfolio.dcaPlan.targetAllocationPercentOfNetWorth}%
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Ngân sách DCA dự kiến mỗi tháng:{" "}
                    <strong className="text-[#0F172A] dark:text-slate-100 tabular-nums">
                      {formatVNDMasked(goldPortfolio.dcaPlan.monthlyBudgetVnd, isPrivacyMode)}
                    </strong>{" "}
                    ({formatChiWeight(goldPortfolio.dcaPlan.monthlyTargetChi, isPrivacyMode)}{" "}
                    {GOLD_CATEGORY_META[goldPortfolio.dcaPlan.targetCategory].shortLabel}).
                  </p>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 5: HANDOVER LIQUIDITY SIMULATOR                                  */}
      {/* =================================================================== */}
      {goldTab === "SIMULATOR" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-[#DCE4EE] dark:border-slate-800 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-black text-[#0F172A] dark:text-slate-100">
                  Mô phỏng bán vàng lấy tiền mặt (Nhận nhà Q3/2027 &amp; Tất toán 08/2028)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Kéo thanh trượt số tiền cần huy động để xem chính xác nên bán lô nào trước
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setSimTargetVnd(
                    Math.max(20_000_000, activeBoqSummary?.grandTotalWithContingency ?? 140_000_000)
                  )
                }
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800 cursor-pointer"
              >
                Nạp đúng ngân sách BOQ ({formatShortVNDMasked(activeBoqSummary?.grandTotalWithContingency ?? 140_000_000, isPrivacyMode)})
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold">
                  <span>Số tiền mặt cần huy động từ kho vàng</span>
                  <span className="text-amber-700 dark:text-amber-300 tabular-nums text-sm">
                    {formatVNDMasked(simTargetVnd, isPrivacyMode)}
                  </span>
                </div>
                <input
                  type="range"
                  min={10_000_000}
                  max={Math.max(250_000_000, metrics.totalLiquidationValueBid + 50_000_000)}
                  step={5_000_000}
                  value={simTargetVnd}
                  onChange={(e) => setSimTargetVnd(Number(e.target.value))}
                  className="w-full accent-amber-600 cursor-pointer"
                />
                <div className="flex justify-between text-[11px] text-slate-400 tabular-nums">
                  <span>10 tr</span>
                  <span>Kho tối đa: {formatShortVNDMasked(metrics.totalLiquidationValueBid, isPrivacyMode)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <span className="block text-xs font-bold">Chiến lược ưu tiên xuất lô</span>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: "MIN_SPREAD_FIRST", label: "Ít lỗ Spread nhất" },
                      { id: "HIGHEST_PROFIT_FIRST", label: "Lãi cao bán trước" },
                      { id: "FIFO", label: "FIFO (Cũ trước)" },
                    ] as const
                  ).map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setSimStrategy(st.id)}
                      className={`py-2 px-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                        simStrategy === st.id
                          ? "bg-amber-600 text-white border-amber-600"
                          : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-[#DCE4EE] dark:border-slate-700"
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Simulation KPI Output */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70">
                <p className="text-[11px] text-slate-500">Số chỉ cần bán</p>
                <p className="text-lg font-black tabular-nums mt-0.5">
                  {formatChiWeight(simulation.totalSellChi, isPrivacyMode)}
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40">
                <p className="text-[11px] text-amber-800 dark:text-amber-300">Tiền thực thu (Bid)</p>
                <p className="text-lg font-black text-amber-800 dark:text-amber-300 tabular-nums mt-0.5">
                  {formatShortVNDMasked(simulation.totalProceedsVnd, isPrivacyMode)}
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70">
                <p className="text-[11px] text-slate-500">Lãi/Lỗ chốt ước tính</p>
                <p
                  className={`text-lg font-black tabular-nums mt-0.5 ${
                    simulation.totalRealizedPnlVnd >= 0
                      ? "text-emerald-700 dark:text-emerald-400"
                      : "text-rose-700 dark:text-rose-400"
                  }`}
                >
                  {simulation.totalRealizedPnlVnd >= 0 ? "+" : ""}
                  {formatShortVNDMasked(simulation.totalRealizedPnlVnd, isPrivacyMode)}
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70">
                <p className="text-[11px] text-slate-500">Vàng giữ lại cho 08/2028</p>
                <p className="text-lg font-black tabular-nums mt-0.5 text-indigo-700 dark:text-indigo-300">
                  {formatChiWeight(simulation.remainingChiAfterSale, isPrivacyMode)}
                </p>
              </div>
            </div>

            {simulation.shortfallVnd > 0 && (
              <p className="text-xs font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl px-3.5 py-2.5">
                Kho vàng hiện tại thiếu{" "}
                {formatVNDMasked(simulation.shortfallVnd, isPrivacyMode)} so với mục tiêu mô phỏng.
                Cần bổ sung bằng tiền mặt tiết kiệm hoặc tăng tốc kế hoạch DCA.
              </p>
            )}
          </div>

          {/* Recommended Lot Execution Plan */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-[#DCE4EE] dark:border-slate-800 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-black text-[#0F172A] dark:text-slate-100">
                Đề xuất thứ tự bán từng lô ({simulation.steps.length} lô)
              </h3>
              <span className="text-xs text-slate-500 tabular-nums">
                Còn lại sau bán:{" "}
                {formatShortVNDMasked(simulation.remainingLiquidationValueVnd, isPrivacyMode)}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-500">
                    <th className="py-2.5 px-4 font-bold">Lô vàng</th>
                    <th className="py-2.5 px-4 font-bold">Ngày mua</th>
                    <th className="py-2.5 px-4 font-bold text-right">Bán / Còn</th>
                    <th className="py-2.5 px-4 font-bold text-right">Spread %</th>
                    <th className="py-2.5 px-4 font-bold text-right">Thu về (Bid)</th>
                    <th className="py-2.5 px-4 font-bold text-right">Lãi/Lỗ chốt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {simulation.steps.map((rec) => (
                    <tr key={rec.lotId}>
                      <td className="py-2.5 px-4 font-bold">
                        {rec.brand}
                        <span className="block text-[11px] text-slate-500 font-normal">
                          {GOLD_CATEGORY_META[rec.category].label}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 tabular-nums">{formatDateVN(rec.purchaseDate)}</td>
                      <td className="py-2.5 px-4 text-right tabular-nums font-bold">
                        {formatChiWeight(rec.sellChi, isPrivacyMode)} /{" "}
                        {formatChiWeight(rec.lotRemainingAfterChi, isPrivacyMode)}
                      </td>
                      <td className="py-2.5 px-4 text-right tabular-nums">
                        {rec.spreadPct.toFixed(2)}%
                      </td>
                      <td className="py-2.5 px-4 text-right tabular-nums font-bold text-amber-700 dark:text-amber-300">
                        {formatVNDMasked(rec.proceedsVnd, isPrivacyMode)}
                      </td>
                      <td
                        className={`py-2.5 px-4 text-right tabular-nums font-bold ${
                          rec.realizedPnlVnd >= 0 ? "text-emerald-700" : "text-rose-700"
                        }`}
                      >
                        {rec.realizedPnlVnd >= 0 ? "+" : ""}
                        {formatVNDMasked(rec.realizedPnlVnd, isPrivacyMode)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: ADD GOLD LOT                                                  */}
      {/* =================================================================== */}
      {isAddLotOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setIsAddLotOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl border border-[#DCE4EE] dark:border-slate-700 shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-black text-[#0F172A] dark:text-slate-100">
                Ghi nhận lô mua vàng mới
              </h3>
              <button
                type="button"
                onClick={() => setIsAddLotOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitAddLot} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Loại vàng
                  </label>
                  <select
                    value={lotCategory}
                    onChange={(e) => {
                      const nextCat = e.target.value as GoldCategory;
                      setLotCategory(nextCat);
                      setLotBrand(BRAND_SUGGESTIONS[nextCat][0]);
                      setLotBuyPriceInput(String(goldPortfolio.quotes[nextCat].sellPricePerChi));
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-[#DCE4EE] dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
                  >
                    {GOLD_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {GOLD_CATEGORY_META[c].label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Thương hiệu / Quy cách
                  </label>
                  <input
                    type="text"
                    required
                    value={lotBrand}
                    onChange={(e) => setLotBrand(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#DCE4EE] dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold"
                  />
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {BRAND_SUGGESTIONS[lotCategory].map((b) => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setLotBrand(b)}
                        className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-amber-100 dark:hover:bg-amber-950/60 text-[11px] font-semibold cursor-pointer"
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Số lượng ({lotUnit === "CHI" ? "Chỉ" : "Lượng"})
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      required
                      value={lotQtyInput}
                      onChange={(e) => setLotQtyInput(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-[#DCE4EE] dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold tabular-nums"
                    />
                    <button
                      type="button"
                      onClick={() => setLotUnit((u) => (u === "CHI" ? "LUONG" : "CHI"))}
                      className="px-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-bold border border-amber-200 dark:border-amber-800 cursor-pointer shrink-0"
                    >
                      {lotUnit === "CHI" ? "Chỉ" : "Lượng"}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Giá mua thực tế (VNĐ / 1 Chỉ)
                  </label>
                  <input
                    type="number"
                    step="10000"
                    min="100000"
                    required
                    value={lotBuyPriceInput}
                    onChange={(e) => setLotBuyPriceInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#DCE4EE] dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold tabular-nums"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Tiền công / phí (VNĐ)
                  </label>
                  <input
                    type="number"
                    step="10000"
                    min="0"
                    value={lotMakingFeeInput}
                    onChange={(e) => setLotMakingFeeInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#DCE4EE] dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold tabular-nums"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Ngày mua
                  </label>
                  <input
                    type="date"
                    required
                    value={lotDate}
                    onChange={(e) => setLotDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#DCE4EE] dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Thành viên
                  </label>
                  <select
                    value={lotMember}
                    onChange={(e) => setLotMember(e.target.value as FamilyMember)}
                    className="w-full px-3 py-2 rounded-xl border border-[#DCE4EE] dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold"
                  >
                    <option value="SHARED">Chung 2 vợ chồng</option>
                    <option value="HUSBAND">{settings.husbandName}</option>
                    <option value="WIFE">{settings.wifeName}</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Nơi cất trữ
                  </label>
                  <select
                    value={lotStorage}
                    onChange={(e) => setLotStorage(e.target.value as GoldStorageLocation)}
                    className="w-full px-3 py-2 rounded-xl border border-[#DCE4EE] dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold"
                  >
                    {(Object.keys(GOLD_STORAGE_LABELS) as GoldStorageLocation[]).map((loc) => (
                      <option key={loc} value={loc}>
                        {GOLD_STORAGE_LABELS[loc]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Ghi chú hóa đơn / Số seri (tùy chọn)
                  </label>
                  <input
                    type="text"
                    value={lotNote}
                    onChange={(e) => setLotNote(e.target.value)}
                    placeholder="VD: Hóa đơn PNJ Thủ Đức, ép vỉ nguyên vẹn"
                    className="w-full px-3 py-2 rounded-xl border border-[#DCE4EE] dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>

                <div className="col-span-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Liên thông Sổ Thu Chi (trừ tiền từ tài khoản nếu mua mới hôm nay)
                  </label>
                  <select
                    value={lotLinkAccountId}
                    onChange={(e) => setLotLinkAccountId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#DCE4EE] dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold"
                  >
                    <option value="">Chỉ ghi vào Kho Vàng (không trừ ví Thu Chi)</option>
                    {nonCreditAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        Trừ từ ví: {acc.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddLotOpen(false)}
                  className="px-4 py-2 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl font-bold bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Lưu lô vàng</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: SELL GOLD                                                     */}
      {/* =================================================================== */}
      {isSellModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setIsSellModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl border border-[#DCE4EE] dark:border-slate-700 shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-black text-[#0F172A] dark:text-slate-100">
                Ghi nhận bán vàng / Thanh khoản
              </h3>
              <button
                type="button"
                onClick={() => setIsSellModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitSellLot} className="p-5 space-y-4 text-xs">
              {sellError && (
                <p className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-bold">
                  {sellError}
                </p>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Phương thức xuất lô
                  </label>
                  <select
                    value={sellMode}
                    onChange={(e) => setSellMode(e.target.value as "FIFO" | "SPECIFIC_LOT")}
                    className="w-full px-3 py-2 rounded-xl border border-[#DCE4EE] dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
                  >
                    <option value="FIFO">FIFO (Bán lô mua cũ nhất)</option>
                    <option value="SPECIFIC_LOT">Chọn lô cụ thể</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Loại vàng bán
                  </label>
                  <select
                    value={sellCategory}
                    onChange={(e) => {
                      const nextCat = e.target.value as GoldCategory;
                      setSellCategory(nextCat);
                      setSellPriceInput(String(goldPortfolio.quotes[nextCat].buyPricePerChi));
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-[#DCE4EE] dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
                  >
                    {GOLD_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {GOLD_CATEGORY_META[c].label}
                      </option>
                    ))}
                  </select>
                </div>

                {sellMode === "SPECIFIC_LOT" && (
                  <div className="col-span-2">
                    <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
                      Chọn lô cần bán
                    </label>
                    <select
                      value={sellSpecificLotId}
                      onChange={(e) => {
                        const lot = holdingLots.find((l) => l.id === e.target.value);
                        setSellSpecificLotId(e.target.value);
                        if (lot) {
                          setSellCategory(lot.category);
                          setSellPriceInput(String(goldPortfolio.quotes[lot.category].buyPricePerChi));
                        }
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-[#DCE4EE] dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold"
                    >
                      <option value="">-- Chọn lô đang giữ --</option>
                      {holdingLots.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.brand} ({formatDateVN(l.purchaseDate)}) · Còn {l.remainingChi} chỉ
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Số chỉ bán
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    required
                    value={sellQtyInput}
                    onChange={(e) => setSellQtyInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#DCE4EE] dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold tabular-nums"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Giá tiệm mua lại (Bid / chỉ)
                  </label>
                  <input
                    type="number"
                    step="10000"
                    min="100000"
                    required
                    value={sellPriceInput}
                    onChange={(e) => setSellPriceInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#DCE4EE] dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold tabular-nums"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Ngày bán
                  </label>
                  <input
                    type="date"
                    required
                    value={sellDate}
                    onChange={(e) => setSellDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#DCE4EE] dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Mục đích sử dụng tiền
                  </label>
                  <select
                    value={sellPurpose}
                    onChange={(e) => setSellPurpose(e.target.value as GoldSalePurpose)}
                    className="w-full px-3 py-2 rounded-xl border border-[#DCE4EE] dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold"
                  >
                    {(Object.keys(SALE_PURPOSE_LABELS) as GoldSalePurpose[]).map((p) => (
                      <option key={p} value={p}>
                        {SALE_PURPOSE_LABELS[p]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Liên thông Sổ Thu Chi (nạp tiền bán vàng vào ví ngân hàng)
                  </label>
                  <select
                    value={sellLinkAccountId}
                    onChange={(e) => setSellLinkAccountId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#DCE4EE] dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold"
                  >
                    <option value="">Chỉ ghi nhận trong Kho Vàng</option>
                    {nonCreditAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        Nạp tiền vào ví: {acc.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Ghi chú (tùy chọn)
                  </label>
                  <input
                    type="text"
                    value={sellNote}
                    onChange={(e) => setSellNote(e.target.value)}
                    placeholder="VD: Bán tại PNJ để thanh toán đợt 1 nội thất"
                    className="w-full px-3 py-2 rounded-xl border border-[#DCE4EE] dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSellModalOpen(false)}
                  className="px-4 py-2 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl font-bold bg-slate-900 dark:bg-amber-600 hover:opacity-90 text-white cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Xác nhận bán vàng</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
