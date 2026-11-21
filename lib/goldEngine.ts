import {
  FamilyMember,
  GoldAlertCondition,
  GoldAlertRule,
  GoldCategory,
  GoldLiquidationStrategy,
  GoldLot,
  GoldMacroContext,
  GoldPortfolioState,
  GoldPriceQuote,
  GoldPriceSnapshot,
  GoldSaleAllocation,
  GoldStorageLocation,
  MortgageContract,
} from "@/types/finance";

export const GRAMS_PER_LUONG = 37.5;
export const GRAMS_PER_CHI = 3.75;
export const CHI_PER_LUONG = 10;
export const PHAN_PER_CHI = 10;
export const GRAMS_PER_TROY_OZ = 31.1034768;
export const TROY_OZ_PER_LUONG = GRAMS_PER_LUONG / GRAMS_PER_TROY_OZ; // ~1.205653027

export const GOLD_CATEGORY_META: Record<
  GoldCategory,
  { label: string; shortLabel: string; color: string; defaultBrand: string }
> = {
  NHAN_9999: {
    label: "Nhẫn trơn 9999",
    shortLabel: "Nhẫn 9999",
    color: "#D97706",
    defaultBrand: "PNJ / SJC 9999",
  },
  SJC_BAR: {
    label: "Vàng miếng SJC",
    shortLabel: "SJC Miếng",
    color: "#B45309",
    defaultBrand: "SJC",
  },
  GOLD_24K_JEWELRY: {
    label: "Vàng 24K Trang sức",
    shortLabel: "24K TS",
    color: "#F59E0B",
    defaultBrand: "PNJ 24K",
  },
  GOLD_18K: {
    label: "Vàng 18K (750)",
    shortLabel: "Vàng 18K",
    color: "#92400E",
    defaultBrand: "PNJ 18K",
  },
  DIGITAL_GOLD: {
    label: "Vàng tích lũy / Chứng chỉ",
    shortLabel: "Tích lũy",
    color: "#0284C7",
    defaultBrand: "DOJI eGold",
  },
};

export const GOLD_STORAGE_LABELS: Record<GoldStorageLocation, string> = {
  HOME_SAFE: "Két gia đình",
  BANK_VAULT: "Gửi két ngân hàng",
  STORE_KEEP: "Gửi giữ hộ tại tiệm",
  PARENTS: "Gửi nhà nội/ngoại",
};

export function chiToLuong(chi: number): number {
  return Number((chi / CHI_PER_LUONG).toFixed(4));
}

export function luongToChi(luong: number): number {
  return Number((luong * CHI_PER_LUONG).toFixed(4));
}

export function chiToGrams(chi: number): number {
  return Number((chi * GRAMS_PER_CHI).toFixed(3));
}

export function chiToPhan(chi: number): number {
  return Number((chi * PHAN_PER_CHI).toFixed(2));
}

export function chiToTroyOz(chi: number): number {
  return Number(((chi * GRAMS_PER_CHI) / GRAMS_PER_TROY_OZ).toFixed(4));
}

export function formatChiWeight(chi: number, masked = false): string {
  if (masked) return "••• chỉ";
  const rounded = Math.round(chi * 100) / 100;
  return `${rounded.toLocaleString("vi-VN", { maximumFractionDigits: 2 })} chỉ`;
}

export function formatLuongWeight(chi: number, masked = false): string {
  if (masked) return "••• lượng";
  const luong = chi / CHI_PER_LUONG;
  return `${luong.toLocaleString("vi-VN", { maximumFractionDigits: 2 })} lượng`;
}

export function computeWorldGoldPricePerChiVnd(macro: GoldMacroContext): number {
  if (macro.worldXauUsdPerOz <= 0 || macro.usdVndRate <= 0) return 0;
  const perLuong = macro.worldXauUsdPerOz * macro.usdVndRate * TROY_OZ_PER_LUONG;
  return Math.round(perLuong / CHI_PER_LUONG);
}

export interface DomesticPremiumMetric {
  category: GoldCategory;
  worldPricePerChiVnd: number;
  domesticAskPerChiVnd: number;
  domesticBidPerChiVnd: number;
  spreadPerChiVnd: number;
  spreadPct: number;
  premiumOverWorldVnd: number;
  premiumOverWorldPct: number;
  riskLevel: "LOW" | "MODERATE" | "HIGH";
}

export function computeDomesticPremium(
  quote: GoldPriceQuote,
  macro: GoldMacroContext
): DomesticPremiumMetric {
  const worldPricePerChiVnd = computeWorldGoldPricePerChiVnd(macro);
  const spreadPerChiVnd = Math.max(0, quote.sellPricePerChi - quote.buyPricePerChi);
  const spreadPct =
    quote.sellPricePerChi > 0 ? (spreadPerChiVnd / quote.sellPricePerChi) * 100 : 0;
  const premiumOverWorldVnd = quote.sellPricePerChi - worldPricePerChiVnd;
  const premiumOverWorldPct =
    worldPricePerChiVnd > 0 ? (premiumOverWorldVnd / worldPricePerChiVnd) * 100 : 0;

  let riskLevel: "LOW" | "MODERATE" | "HIGH" = "LOW";
  if (premiumOverWorldPct >= 12 || spreadPct >= 3.5) {
    riskLevel = "HIGH";
  } else if (premiumOverWorldPct >= 6 || spreadPct >= 2.2) {
    riskLevel = "MODERATE";
  }

  return {
    category: quote.category,
    worldPricePerChiVnd,
    domesticAskPerChiVnd: quote.sellPricePerChi,
    domesticBidPerChiVnd: quote.buyPricePerChi,
    spreadPerChiVnd,
    spreadPct: Number(spreadPct.toFixed(2)),
    premiumOverWorldVnd,
    premiumOverWorldPct: Number(premiumOverWorldPct.toFixed(2)),
    riskLevel,
  };
}

export function getLotRemainingCostBasis(lot: GoldLot): number {
  if (lot.quantityChi <= 0 || lot.remainingChi <= 0) return 0;
  const totalOriginalCost = lot.quantityChi * lot.unitBuyPricePerChi + (lot.makingFee || 0);
  const ratio = Math.min(1, lot.remainingChi / lot.quantityChi);
  return Math.round(totalOriginalCost * ratio);
}

export interface GoldLotEvaluation {
  lot: GoldLot;
  remainingCostBasis: number;
  wacPerChi: number;
  currentBidPerChi: number;
  currentAskPerChi: number;
  liquidationValueBid: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  trueBreakevenAskPerChi: number;
  spreadPerChi: number;
}

export interface GoldCategoryBreakdown {
  category: GoldCategory;
  label: string;
  color: string;
  remainingChi: number;
  costBasis: number;
  liquidationValueBid: number;
  unrealizedPnl: number;
  sharePct: number;
}

export interface GoldPortfolioMetrics {
  totalRemainingChi: number;
  totalRemainingLuong: number;
  totalRemainingGrams: number;
  totalRemainingTroyOz: number;
  totalCostBasis: number;
  totalLiquidationValueBid: number;
  totalAskReplacementValue: number;
  totalSpreadCostVnd: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  realizedPnl: number;
  combinedPnl: number;
  weightedAvgCostPerChi: number;
  weightedBidPerChi: number;
  weightedSpreadPerChi: number;
  trueBreakevenAskPerChi: number;
  holdingLotCount: number;
  lotEvaluations: GoldLotEvaluation[];
  byCategory: GoldCategoryBreakdown[];
  byMember: Record<FamilyMember, { chi: number; liquidationValue: number }>;
  byStorage: Record<GoldStorageLocation, { chi: number; liquidationValue: number }>;
  worldPricePerChiVnd: number;
  nhan9999Premium: DomesticPremiumMetric;
  sjcPremium: DomesticPremiumMetric;
  dcaProgressPct: number;
  netWorthSharePct: number;
}

export function computeGoldPortfolioMetrics(
  portfolio: GoldPortfolioState,
  totalHouseholdNetWorthVnd = 0
): GoldPortfolioMetrics {
  const activeLots = portfolio.lots.filter((l) => l.remainingChi > 0 && l.status !== "SOLD");

  let totalRemainingChi = 0;
  let totalCostBasis = 0;
  let totalLiquidationValueBid = 0;
  let totalAskReplacementValue = 0;

  const byMember: Record<FamilyMember, { chi: number; liquidationValue: number }> = {
    HUSBAND: { chi: 0, liquidationValue: 0 },
    WIFE: { chi: 0, liquidationValue: 0 },
    SHARED: { chi: 0, liquidationValue: 0 },
  };

  const byStorage: Record<GoldStorageLocation, { chi: number; liquidationValue: number }> = {
    HOME_SAFE: { chi: 0, liquidationValue: 0 },
    BANK_VAULT: { chi: 0, liquidationValue: 0 },
    STORE_KEEP: { chi: 0, liquidationValue: 0 },
    PARENTS: { chi: 0, liquidationValue: 0 },
  };

  const categoryMap = new Map<
    GoldCategory,
    { remainingChi: number; costBasis: number; liquidationValueBid: number }
  >();

  const lotEvaluations: GoldLotEvaluation[] = activeLots.map((lot) => {
    const quote = portfolio.quotes[lot.category] || portfolio.quotes.NHAN_9999;
    const currentBidPerChi = quote?.buyPricePerChi || 0;
    const currentAskPerChi = quote?.sellPricePerChi || currentBidPerChi;
    const spreadPerChi = Math.max(0, currentAskPerChi - currentBidPerChi);
    const remainingCostBasis = getLotRemainingCostBasis(lot);
    const wacPerChi = lot.remainingChi > 0 ? Math.round(remainingCostBasis / lot.remainingChi) : 0;
    const liquidationValueBid = Math.round(lot.remainingChi * currentBidPerChi);
    const askReplacement = Math.round(lot.remainingChi * currentAskPerChi);
    const unrealizedPnl = liquidationValueBid - remainingCostBasis;
    const unrealizedPnlPct =
      remainingCostBasis > 0 ? (unrealizedPnl / remainingCostBasis) * 100 : 0;

    totalRemainingChi += lot.remainingChi;
    totalCostBasis += remainingCostBasis;
    totalLiquidationValueBid += liquidationValueBid;
    totalAskReplacementValue += askReplacement;

    byMember[lot.memberId].chi += lot.remainingChi;
    byMember[lot.memberId].liquidationValue += liquidationValueBid;

    byStorage[lot.storageLocation].chi += lot.remainingChi;
    byStorage[lot.storageLocation].liquidationValue += liquidationValueBid;

    const prevCat = categoryMap.get(lot.category) || {
      remainingChi: 0,
      costBasis: 0,
      liquidationValueBid: 0,
    };
    categoryMap.set(lot.category, {
      remainingChi: prevCat.remainingChi + lot.remainingChi,
      costBasis: prevCat.costBasis + remainingCostBasis,
      liquidationValueBid: prevCat.liquidationValueBid + liquidationValueBid,
    });

    return {
      lot,
      remainingCostBasis,
      wacPerChi,
      currentBidPerChi,
      currentAskPerChi,
      liquidationValueBid,
      unrealizedPnl,
      unrealizedPnlPct: Number(unrealizedPnlPct.toFixed(2)),
      trueBreakevenAskPerChi: wacPerChi + spreadPerChi,
      spreadPerChi,
    };
  });

  const realizedPnl = portfolio.sales.reduce((sum, s) => sum + s.realizedPnl, 0);
  const unrealizedPnl = totalLiquidationValueBid - totalCostBasis;
  const unrealizedPnlPct = totalCostBasis > 0 ? (unrealizedPnl / totalCostBasis) * 100 : 0;
  const totalSpreadCostVnd = Math.max(0, totalAskReplacementValue - totalLiquidationValueBid);
  const weightedAvgCostPerChi =
    totalRemainingChi > 0 ? Math.round(totalCostBasis / totalRemainingChi) : 0;
  const weightedBidPerChi =
    totalRemainingChi > 0 ? Math.round(totalLiquidationValueBid / totalRemainingChi) : 0;
  const weightedSpreadPerChi =
    totalRemainingChi > 0 ? Math.round(totalSpreadCostVnd / totalRemainingChi) : 0;
  const trueBreakevenAskPerChi = weightedAvgCostPerChi + weightedSpreadPerChi;

  const byCategory: GoldCategoryBreakdown[] = Array.from(categoryMap.entries())
    .map(([category, agg]) => ({
      category,
      label: GOLD_CATEGORY_META[category].label,
      color: GOLD_CATEGORY_META[category].color,
      remainingChi: Number(agg.remainingChi.toFixed(3)),
      costBasis: agg.costBasis,
      liquidationValueBid: agg.liquidationValueBid,
      unrealizedPnl: agg.liquidationValueBid - agg.costBasis,
      sharePct:
        totalLiquidationValueBid > 0
          ? Number(((agg.liquidationValueBid / totalLiquidationValueBid) * 100).toFixed(1))
          : 0,
    }))
    .sort((a, b) => b.liquidationValueBid - a.liquidationValueBid);

  const worldPricePerChiVnd = computeWorldGoldPricePerChiVnd(portfolio.macro);
  const nhan9999Premium = computeDomesticPremium(portfolio.quotes.NHAN_9999, portfolio.macro);
  const sjcPremium = computeDomesticPremium(portfolio.quotes.SJC_BAR, portfolio.macro);

  const dcaProgressPct =
    portfolio.dcaPlan.targetReserveChiFor2027 > 0
      ? Math.min(
          100,
          Number(((totalRemainingChi / portfolio.dcaPlan.targetReserveChiFor2027) * 100).toFixed(1))
        )
      : 0;

  const netWorthSharePct =
    totalHouseholdNetWorthVnd > 0
      ? Number(((totalLiquidationValueBid / totalHouseholdNetWorthVnd) * 100).toFixed(1))
      : 0;

  return {
    totalRemainingChi: Number(totalRemainingChi.toFixed(3)),
    totalRemainingLuong: chiToLuong(totalRemainingChi),
    totalRemainingGrams: chiToGrams(totalRemainingChi),
    totalRemainingTroyOz: chiToTroyOz(totalRemainingChi),
    totalCostBasis,
    totalLiquidationValueBid,
    totalAskReplacementValue,
    totalSpreadCostVnd,
    unrealizedPnl,
    unrealizedPnlPct: Number(unrealizedPnlPct.toFixed(2)),
    realizedPnl,
    combinedPnl: unrealizedPnl + realizedPnl,
    weightedAvgCostPerChi,
    weightedBidPerChi,
    weightedSpreadPerChi,
    trueBreakevenAskPerChi,
    holdingLotCount: activeLots.length,
    lotEvaluations,
    byCategory,
    byMember,
    byStorage,
    worldPricePerChiVnd,
    nhan9999Premium,
    sjcPremium,
    dcaProgressPct,
    netWorthSharePct,
  };
}

export interface GoldLiquidationPlanStep {
  lotId: string;
  brand: string;
  category: GoldCategory;
  purchaseDate: string;
  sellChi: number;
  lotRemainingAfterChi: number;
  bidPricePerChi: number;
  proceedsVnd: number;
  costBasisAllocatedVnd: number;
  realizedPnlVnd: number;
  spreadPct: number;
}

export interface GoldLiquidationSimulationResult {
  targetCashVnd: number;
  strategy: GoldLiquidationStrategy;
  steps: GoldLiquidationPlanStep[];
  totalSellChi: number;
  totalProceedsVnd: number;
  totalCostBasisVnd: number;
  totalRealizedPnlVnd: number;
  remainingChiAfterSale: number;
  remainingLiquidationValueVnd: number;
  shortfallVnd: number;
  isFullyCovered: boolean;
}

export function simulateGoldLiquidation(
  portfolio: GoldPortfolioState,
  targetCashVnd: number,
  strategy: GoldLiquidationStrategy = "MIN_SPREAD_FIRST"
): GoldLiquidationSimulationResult {
  const metrics = computeGoldPortfolioMetrics(portfolio);
  const safeTarget = Math.max(0, Math.round(targetCashVnd));

  if (safeTarget === 0 || metrics.lotEvaluations.length === 0) {
    return {
      targetCashVnd: safeTarget,
      strategy,
      steps: [],
      totalSellChi: 0,
      totalProceedsVnd: 0,
      totalCostBasisVnd: 0,
      totalRealizedPnlVnd: 0,
      remainingChiAfterSale: metrics.totalRemainingChi,
      remainingLiquidationValueVnd: metrics.totalLiquidationValueBid,
      shortfallVnd: safeTarget,
      isFullyCovered: safeTarget === 0,
    };
  }

  const sorted = [...metrics.lotEvaluations].sort((a, b) => {
    if (strategy === "FIFO") {
      return a.lot.purchaseDate.localeCompare(b.lot.purchaseDate);
    }
    if (strategy === "HIGHEST_PROFIT_FIRST") {
      return b.unrealizedPnlPct - a.unrealizedPnlPct;
    }
    // MIN_SPREAD_FIRST: ưu tiên lô có % spread thấp nhất (Nhẫn 9999 ít thiệt spread), sau đó đến lãi cao hơn
    const spreadPctA = a.currentAskPerChi > 0 ? a.spreadPerChi / a.currentAskPerChi : 1;
    const spreadPctB = b.currentAskPerChi > 0 ? b.spreadPerChi / b.currentAskPerChi : 1;
    if (Math.abs(spreadPctA - spreadPctB) > 0.002) {
      return spreadPctA - spreadPctB;
    }
    return b.unrealizedPnlPct - a.unrealizedPnlPct;
  });

  let remainingNeed = safeTarget;
  const steps: GoldLiquidationPlanStep[] = [];
  let totalSellChi = 0;
  let totalProceedsVnd = 0;
  let totalCostBasisVnd = 0;

  for (const item of sorted) {
    if (remainingNeed <= 0) break;
    if (item.currentBidPerChi <= 0 || item.lot.remainingChi <= 0) continue;

    // Làm tròn theo bước 0.5 chỉ (vì vàng vật chất nhẫn 9999 tối thiểu bán lẻ 0.5 chỉ, hoặc hết lô)
    const rawNeededChi = remainingNeed / item.currentBidPerChi;
    const steppedChi = Math.ceil(rawNeededChi * 2) / 2;
    const sellChi = Math.min(item.lot.remainingChi, Math.max(0.5, steppedChi));
    const sellRatio = sellChi / item.lot.remainingChi;

    const proceedsVnd = Math.round(sellChi * item.currentBidPerChi);
    const costBasisAllocatedVnd = Math.round(item.remainingCostBasis * sellRatio);
    const realizedPnlVnd = proceedsVnd - costBasisAllocatedVnd;
    const spreadPct =
      item.currentAskPerChi > 0
        ? Number(((item.spreadPerChi / item.currentAskPerChi) * 100).toFixed(2))
        : 0;

    steps.push({
      lotId: item.lot.id,
      brand: item.lot.brand,
      category: item.lot.category,
      purchaseDate: item.lot.purchaseDate,
      sellChi: Number(sellChi.toFixed(3)),
      lotRemainingAfterChi: Number(Math.max(0, item.lot.remainingChi - sellChi).toFixed(3)),
      bidPricePerChi: item.currentBidPerChi,
      proceedsVnd,
      costBasisAllocatedVnd,
      realizedPnlVnd,
      spreadPct,
    });

    totalSellChi += sellChi;
    totalProceedsVnd += proceedsVnd;
    totalCostBasisVnd += costBasisAllocatedVnd;
    remainingNeed = Math.max(0, safeTarget - totalProceedsVnd);
  }

  return {
    targetCashVnd: safeTarget,
    strategy,
    steps,
    totalSellChi: Number(totalSellChi.toFixed(3)),
    totalProceedsVnd,
    totalCostBasisVnd,
    totalRealizedPnlVnd: totalProceedsVnd - totalCostBasisVnd,
    remainingChiAfterSale: Number(Math.max(0, metrics.totalRemainingChi - totalSellChi).toFixed(3)),
    remainingLiquidationValueVnd: Math.max(0, metrics.totalLiquidationValueBid - totalProceedsVnd),
    shortfallVnd: Math.max(0, safeTarget - totalProceedsVnd),
    isFullyCovered: totalProceedsVnd >= safeTarget,
  };
}

export function allocateFifoGoldSale(
  lots: GoldLot[],
  category: GoldCategory,
  sellChi: number
): { allocations: GoldSaleAllocation[]; updatedLots: GoldLot[]; ok: boolean; error?: string } {
  const candidates = lots
    .filter((l) => l.category === category && l.remainingChi > 0 && l.status !== "SOLD")
    .sort((a, b) => a.purchaseDate.localeCompare(b.purchaseDate));

  const available = candidates.reduce((s, l) => s + l.remainingChi, 0);
  if (sellChi <= 0 || sellChi > available + 0.0001) {
    return {
      allocations: [],
      updatedLots: lots,
      ok: false,
      error: `Số chỉ bán (${sellChi} chỉ) vượt quá tồn kho khả dụng (${available.toFixed(2)} chỉ).`,
    };
  }

  let left = sellChi;
  const allocations: GoldSaleAllocation[] = [];
  const updateMap = new Map<string, { remainingChi: number; status: GoldLot["status"] }>();

  for (const lot of candidates) {
    if (left <= 0.0001) break;
    const take = Math.min(lot.remainingChi, left);
    const remainingBasis = getLotRemainingCostBasis(lot);
    const allocatedBasis = Math.round(remainingBasis * (take / lot.remainingChi));
    const nextRemaining = Number(Math.max(0, lot.remainingChi - take).toFixed(4));

    allocations.push({
      lotId: lot.id,
      soldChi: Number(take.toFixed(4)),
      costBasisAllocated: allocatedBasis,
    });
    updateMap.set(lot.id, {
      remainingChi: nextRemaining,
      status: nextRemaining <= 0.0001 ? "SOLD" : "PARTIAL_SOLD",
    });

    left = Number(Math.max(0, left - take).toFixed(4));
  }

  const nowIso = new Date().toISOString();
  const updatedLots = lots.map((lot) => {
    const patch = updateMap.get(lot.id);
    if (!patch) return lot;
    return {
      ...lot,
      remainingChi: patch.remainingChi,
      status: patch.status,
      updatedAt: nowIso,
    };
  });

  return { allocations, updatedLots, ok: true };
}

export function allocateSpecificLotSale(
  lots: GoldLot[],
  lotId: string,
  sellChi: number
): { allocations: GoldSaleAllocation[]; updatedLots: GoldLot[]; ok: boolean; error?: string } {
  const target = lots.find((l) => l.id === lotId);
  if (!target || target.remainingChi <= 0) {
    return { allocations: [], updatedLots: lots, ok: false, error: "Không tìm thấy lô vàng khả dụng." };
  }
  if (sellChi <= 0 || sellChi > target.remainingChi + 0.0001) {
    return {
      allocations: [],
      updatedLots: lots,
      ok: false,
      error: `Lô này chỉ còn ${target.remainingChi} chỉ.`,
    };
  }

  const remainingBasis = getLotRemainingCostBasis(target);
  const allocatedBasis = Math.round(remainingBasis * (sellChi / target.remainingChi));
  const nextRemaining = Number(Math.max(0, target.remainingChi - sellChi).toFixed(4));
  const nowIso = new Date().toISOString();

  const updatedLots = lots.map((lot) =>
    lot.id === lotId
      ? {
          ...lot,
          remainingChi: nextRemaining,
          status: nextRemaining <= 0.0001 ? ("SOLD" as const) : ("PARTIAL_SOLD" as const),
          updatedAt: nowIso,
        }
      : lot
  );

  return {
    allocations: [
      {
        lotId,
        soldChi: Number(sellChi.toFixed(4)),
        costBasisAllocated: allocatedBasis,
      },
    ],
    updatedLots,
    ok: true,
  };
}

export function createDefaultGoldQuotes(nowIso = "2026-11-20T08:00:00.000Z"): Record<GoldCategory, GoldPriceQuote> {
  return {
    NHAN_9999: {
      category: "NHAN_9999",
      brandLabel: "Nhẫn trơn 9999 (PNJ / SJC)",
      buyPricePerChi: 9_050_000,
      sellPricePerChi: 9_230_000,
      updatedAt: nowIso,
      source: "MANUAL",
    },
    SJC_BAR: {
      category: "SJC_BAR",
      brandLabel: "Vàng miếng SJC",
      buyPricePerChi: 9_150_000,
      sellPricePerChi: 9_380_000,
      updatedAt: nowIso,
      source: "MANUAL",
    },
    GOLD_24K_JEWELRY: {
      category: "GOLD_24K_JEWELRY",
      brandLabel: "Vàng 24K Trang sức",
      buyPricePerChi: 8_920_000,
      sellPricePerChi: 9_180_000,
      updatedAt: nowIso,
      source: "MANUAL",
    },
    GOLD_18K: {
      category: "GOLD_18K",
      brandLabel: "Vàng 18K (750)",
      buyPricePerChi: 6_350_000,
      sellPricePerChi: 6_850_000,
      updatedAt: nowIso,
      source: "MANUAL",
    },
    DIGITAL_GOLD: {
      category: "DIGITAL_GOLD",
      brandLabel: "Vàng tích lũy eGold",
      buyPricePerChi: 9_040_000,
      sellPricePerChi: 9_220_000,
      updatedAt: nowIso,
      source: "MANUAL",
    },
  };
}

export function createDefaultGoldPortfolio(): GoldPortfolioState {
  const nowIso = "2026-11-20T08:00:00.000Z";
  return {
    lots: [
      {
        id: "gold_lot_nhan_2025_09",
        category: "NHAN_9999",
        brand: "PNJ 9999",
        purchaseDate: "2025-09-15",
        quantityChi: 2,
        remainingChi: 2,
        unitBuyPricePerChi: 8_150_000,
        makingFee: 0,
        memberId: "SHARED",
        storageLocation: "HOME_SAFE",
        purityLabel: "999.9 (24K)",
        storeName: "PNJ Next",
        invoiceNote: "Tích sản đợt 1 sau khi ký HĐMB SKYONE",
        status: "HOLDING",
        createdAt: "2025-09-15T10:00:00.000Z",
        updatedAt: "2025-09-15T10:00:00.000Z",
      },
      {
        id: "gold_lot_nhan_2026_02",
        category: "NHAN_9999",
        brand: "SJC 9999",
        purchaseDate: "2026-02-10",
        quantityChi: 3,
        remainingChi: 3,
        unitBuyPricePerChi: 8_620_000,
        makingFee: 0,
        memberId: "WIFE",
        storageLocation: "HOME_SAFE",
        purityLabel: "999.9 (24K)",
        storeName: "SJC Nguyễn Thị Minh Khai",
        invoiceNote: "Thưởng Tết Bính Ngọ — Nhẫn trơn ép vỉ",
        status: "HOLDING",
        createdAt: "2026-02-10T09:30:00.000Z",
        updatedAt: "2026-02-10T09:30:00.000Z",
      },
      {
        id: "gold_lot_nhan_2026_08",
        category: "NHAN_9999",
        brand: "PNJ 9999",
        purchaseDate: "2026-08-20",
        quantityChi: 2,
        remainingChi: 2,
        unitBuyPricePerChi: 8_940_000,
        makingFee: 0,
        memberId: "HUSBAND",
        storageLocation: "HOME_SAFE",
        purityLabel: "999.9 (24K)",
        storeName: "PNJ Next",
        invoiceNote: "DCA Quý 3/2026 — Quỹ phòng vệ bàn giao Q3/2027",
        status: "HOLDING",
        createdAt: "2026-08-20T14:00:00.000Z",
        updatedAt: "2026-08-20T14:00:00.000Z",
      },
    ],
    sales: [],
    quotes: createDefaultGoldQuotes(nowIso),
    macro: {
      worldXauUsdPerOz: 2890,
      usdVndRate: 25_450,
      updatedAt: nowIso,
    },
    dcaPlan: {
      enabled: true,
      targetCategory: "NHAN_9999",
      monthlyTargetChi: 0.5,
      monthlyBudgetVnd: 4_600_000,
      targetAllocationPercentOfNetWorth: 15,
      targetReserveChiFor2027: 12,
    },
    includeInNetWorth: true,
    priceHistory: [],
    alerts: createDefaultGoldAlerts(nowIso),
    updatedAt: nowIso,
  };
}

// ============================================================================
// PRIORITY 1, 2 & 3 — GOLD MARKET INTELLIGENCE, NAV HISTORY, ALERTS & AUDIT
// ============================================================================

export const GOLD_ALERT_CONDITION_META: Record<
  GoldAlertCondition,
  { label: string; unit: string; shortLabel: string }
> = {
  TARGET_BID_ABOVE: {
    label: "Giá thu mua (Bid) đạt mục tiêu chốt lời",
    unit: "đ/chỉ",
    shortLabel: "Bid ≥ mục tiêu",
  },
  WORLD_PREMIUM_BELOW_PCT: {
    label: "Chênh lệch Trong nước / Thế giới hạ nhiệt (Vùng mua tốt)",
    unit: "%",
    shortLabel: "Premium ≤ ngưỡng",
  },
  SPREAD_ABOVE_PCT: {
    label: "Biên độ Mua – Bán (Spread) giãn rộng (Tránh bán tháo)",
    unit: "%",
    shortLabel: "Spread ≥ ngưỡng",
  },
  UNREALIZED_PNL_PCT_ABOVE: {
    label: "Lãi tạm tính danh mục đạt ngưỡng khóa lợi nhuận",
    unit: "%",
    shortLabel: "Lãi danh mục ≥ %",
  },
};

export function createDefaultGoldAlerts(nowIso = new Date().toISOString()): GoldAlertRule[] {
  return [
    {
      id: "alert_nhan_target_bid",
      label: "Chốt lời Nhẫn 9999 cho quỹ Nội thất Q3/2027",
      category: "NHAN_9999",
      condition: "TARGET_BID_ABOVE",
      threshold: 9_600_000,
      enabled: true,
      createdAt: nowIso,
    },
    {
      id: "alert_nhan_premium_low",
      label: "Chênh lệch Nhẫn 9999 / Thế giới về vùng hấp dẫn DCA",
      category: "NHAN_9999",
      condition: "WORLD_PREMIUM_BELOW_PCT",
      threshold: 6,
      enabled: true,
      createdAt: nowIso,
    },
    {
      id: "alert_sjc_spread_wide",
      label: "Cảnh báo Spread Vàng miếng SJC giãn rộng bất thường",
      category: "SJC_BAR",
      condition: "SPREAD_ABOVE_PCT",
      threshold: 3.0,
      enabled: true,
      createdAt: nowIso,
    },
  ];
}

export function createGoldPriceSnapshot(
  portfolio: GoldPortfolioState,
  nowIso = new Date().toISOString()
): GoldPriceSnapshot {
  const metrics = computeGoldPortfolioMetrics(portfolio);
  return {
    date: nowIso.slice(0, 10),
    recordedAt: nowIso,
    nhan9999BidPerChi: portfolio.quotes.NHAN_9999?.buyPricePerChi || 0,
    nhan9999AskPerChi: portfolio.quotes.NHAN_9999?.sellPricePerChi || 0,
    sjcBidPerChi: portfolio.quotes.SJC_BAR?.buyPricePerChi || 0,
    sjcAskPerChi: portfolio.quotes.SJC_BAR?.sellPricePerChi || 0,
    worldXauUsdPerOz: portfolio.macro.worldXauUsdPerOz,
    usdVndRate: portfolio.macro.usdVndRate,
    portfolioBidValueVnd: metrics.totalLiquidationValueBid,
    portfolioCostBasisVnd: metrics.totalCostBasis,
    totalRemainingChi: metrics.totalRemainingChi,
  };
}

export function upsertGoldPriceSnapshot(
  existing: GoldPriceSnapshot[] | undefined,
  snapshot: GoldPriceSnapshot,
  maxPoints = 90
): GoldPriceSnapshot[] {
  const list = [...(existing ?? [])];
  const idx = list.findIndex((p) => p.date === snapshot.date);
  if (idx >= 0) {
    list[idx] = snapshot;
  } else {
    list.push(snapshot);
  }
  return list
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-maxPoints);
}

export interface GoldNavTimelinePoint {
  date: string;
  label: string;
  costBasisVnd: number;
  bidValueVnd: number;
  unrealizedPnlVnd: number;
  totalChi: number;
  nhanBidPerChi: number;
  source: "LOT_EVENT" | "SNAPSHOT" | "CURRENT";
}

/**
 * Xây dựng chuỗi thời gian NAV thực tế (không dùng dữ liệu ngẫu nhiên):
 * Kết hợp các mốc mua/bán thực tế của từng lô vàng với các snapshot giá đã ghi nhận
 * và điểm định giá hiện tại theo giá Bid.
 */
export function buildGoldNavHistorySeries(
  portfolio: GoldPortfolioState
): GoldNavTimelinePoint[] {
  const pointMap = new Map<string, GoldNavTimelinePoint>();
  const sortedLots = [...portfolio.lots].sort((a, b) =>
    a.purchaseDate.localeCompare(b.purchaseDate)
  );
  const sortedSales = [...portfolio.sales].sort((a, b) =>
    a.saleDate.localeCompare(b.saleDate)
  );

  // Collect chronological event dates from actual lots and sales
  const eventDates = Array.from(
    new Set([
      ...sortedLots.map((l) => l.purchaseDate),
      ...sortedSales.map((s) => s.saleDate),
    ])
  ).sort((a, b) => a.localeCompare(b));

  const formatShortDate = (isoDate: string): string => {
    const parts = isoDate.split("-");
    if (parts.length !== 3) return isoDate;
    return `${parts[2]}/${parts[1]}/${parts[0].slice(2)}`;
  };

  for (const d of eventDates) {
    // Reconstruct portfolio holdings & cost basis as of date d
    let cumChi = 0;
    let cumCost = 0;
    let lastKnownPrice = 0;

    for (const lot of sortedLots) {
      if (lot.purchaseDate > d) break;
      cumChi += lot.quantityChi;
      cumCost += Math.round(lot.quantityChi * lot.unitBuyPricePerChi + (lot.makingFee || 0));
      lastKnownPrice = lot.unitBuyPricePerChi;
    }

    for (const sale of sortedSales) {
      if (sale.saleDate > d) break;
      cumChi = Math.max(0, cumChi - sale.totalSoldChi);
      cumCost = Math.max(0, cumCost - sale.costBasisAllocated);
      lastKnownPrice = sale.unitSellPricePerChi;
    }

    const estBidValue = Math.round(cumChi * lastKnownPrice);
    pointMap.set(d, {
      date: d,
      label: formatShortDate(d),
      costBasisVnd: cumCost,
      bidValueVnd: estBidValue,
      unrealizedPnlVnd: estBidValue - cumCost,
      totalChi: Number(cumChi.toFixed(3)),
      nhanBidPerChi: lastKnownPrice,
      source: "LOT_EVENT",
    });
  }

  // Overlay recorded priceHistory snapshots (more accurate mark-to-market Bid)
  for (const snap of portfolio.priceHistory ?? []) {
    pointMap.set(snap.date, {
      date: snap.date,
      label: formatShortDate(snap.date),
      costBasisVnd: snap.portfolioCostBasisVnd,
      bidValueVnd: snap.portfolioBidValueVnd,
      unrealizedPnlVnd: snap.portfolioBidValueVnd - snap.portfolioCostBasisVnd,
      totalChi: snap.totalRemainingChi,
      nhanBidPerChi: snap.nhan9999BidPerChi,
      source: "SNAPSHOT",
    });
  }

  // Always include live current mark-to-market point
  const metrics = computeGoldPortfolioMetrics(portfolio);
  const todayStr = (portfolio.updatedAt || new Date().toISOString()).slice(0, 10);
  pointMap.set(todayStr, {
    date: todayStr,
    label: "Hiện tại",
    costBasisVnd: metrics.totalCostBasis,
    bidValueVnd: metrics.totalLiquidationValueBid,
    unrealizedPnlVnd: metrics.unrealizedPnl,
    totalChi: metrics.totalRemainingChi,
    nhanBidPerChi: portfolio.quotes.NHAN_9999?.buyPricePerChi || metrics.weightedBidPerChi,
    source: "CURRENT",
  });

  return Array.from(pointMap.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export interface EvaluatedGoldAlert {
  rule: GoldAlertRule;
  triggered: boolean;
  currentValue: number;
  currentValueLabel: string;
  thresholdLabel: string;
  severity: "OPPORTUNITY" | "WARNING" | "PROFIT_TARGET";
  summary: string;
}

export function evaluateGoldAlerts(
  portfolio: GoldPortfolioState,
  metricsInput?: GoldPortfolioMetrics
): EvaluatedGoldAlert[] {
  const metrics = metricsInput ?? computeGoldPortfolioMetrics(portfolio);
  const rules = portfolio.alerts ?? createDefaultGoldAlerts(portfolio.updatedAt);

  return rules.map((rule) => {
    const quote = portfolio.quotes[rule.category] || portfolio.quotes.NHAN_9999;
    const premium = computeDomesticPremium(quote, portfolio.macro);
    const catLabel = GOLD_CATEGORY_META[rule.category].shortLabel;

    if (rule.condition === "TARGET_BID_ABOVE") {
      const currentValue = quote.buyPricePerChi;
      const triggered = rule.enabled && currentValue >= rule.threshold;
      return {
        rule,
        triggered,
        currentValue,
        currentValueLabel: `${(currentValue / 1_000_000).toFixed(2)} tr/chỉ`,
        thresholdLabel: `≥ ${(rule.threshold / 1_000_000).toFixed(2)} tr/chỉ`,
        severity: "PROFIT_TARGET",
        summary: triggered
          ? `${catLabel} giá thu mua đạt ${(currentValue / 1_000_000).toFixed(2)} tr/chỉ — đã chạm mục tiêu chốt lời.`
          : `Còn thiếu ${Math.max(0, Math.round((rule.threshold - currentValue) / 1000)).toLocaleString("vi-VN")}k/chỉ để đạt ngưỡng chốt lời.`,
      };
    }

    if (rule.condition === "WORLD_PREMIUM_BELOW_PCT") {
      const currentValue = premium.premiumOverWorldPct;
      const triggered = rule.enabled && currentValue <= rule.threshold;
      return {
        rule,
        triggered,
        currentValue,
        currentValueLabel: `${currentValue > 0 ? "+" : ""}${currentValue.toFixed(1)}%`,
        thresholdLabel: `≤ +${rule.threshold}%`,
        severity: "OPPORTUNITY",
        summary: triggered
          ? `Chênh lệch ${catLabel}/Thế giới đang ở ${currentValue.toFixed(1)}% (vùng hợp lý để tích sản DCA).`
          : `Chênh lệch hiện ở +${currentValue.toFixed(1)}%, cao hơn ngưỡng mua đẹp (${rule.threshold}%).`,
      };
    }

    if (rule.condition === "SPREAD_ABOVE_PCT") {
      const currentValue = premium.spreadPct;
      const triggered = rule.enabled && currentValue >= rule.threshold;
      return {
        rule,
        triggered,
        currentValue,
        currentValueLabel: `${currentValue.toFixed(2)}%`,
        thresholdLabel: `≥ ${rule.threshold}%`,
        severity: "WARNING",
        summary: triggered
          ? `Biên độ Mua–Bán ${catLabel} giãn lên ${currentValue.toFixed(2)}% — cân nhắc tránh chốt bán gấp.`
          : `Spread ${catLabel} ở mức ${currentValue.toFixed(2)}% (an toàn dưới ngưỡng ${rule.threshold}%).`,
      };
    }

    // UNREALIZED_PNL_PCT_ABOVE
    const currentValue = metrics.unrealizedPnlPct;
    const triggered = rule.enabled && currentValue >= rule.threshold;
    return {
      rule,
      triggered,
      currentValue,
      currentValueLabel: `${currentValue > 0 ? "+" : ""}${currentValue.toFixed(1)}%`,
      thresholdLabel: `≥ +${rule.threshold}%`,
      severity: "PROFIT_TARGET",
      summary: triggered
        ? `Danh mục đang lãi tạm tính +${currentValue.toFixed(1)}% — đạt mốc khóa lợi nhuận.`
        : `Lãi tạm tính hiện tại ${currentValue.toFixed(1)}% so với mốc mục tiêu +${rule.threshold}%.`,
    };
  });
}

export interface GoldVsMortgageBenchmarkResult {
  weightedAvgHoldingDays: number;
  actualSimpleReturnPct: number;
  actualAnnualizedReturnPct: number;
  skyoneFixedRatePct: number;
  skyoneFloatingRatePct: number;
  bankDepositRatePct: number;
  prepaymentPenaltyPct: number;
  currentSpreadPct: number;
  /** Tốc độ tăng giá vàng tối thiểu (%/năm) cần đạt để GIỮ VÀNG có lợi hơn BÁN VÀNG TRẢ NỢ TRƯỚC HẠN */
  breakEvenGoldGrowthVsFloatingPct: number;
  breakEvenGoldGrowthVsFixedPct: number;
  projectedGoldValue1YrVnd: number;
  projectedInterestSaved1YrIfPrepayVnd: number;
  netAdvantageHoldingGold1YrVnd: number;
  verdict: "HOLD_GOLD" | "NEUTRAL" | "PREPAY_MORTGAGE";
  verdictTitle: string;
  verdictDetail: string;
}

export function computeGoldVsMortgageBenchmark(
  portfolio: GoldPortfolioState,
  metricsInput?: GoldPortfolioMetrics,
  skyoneLoan?: MortgageContract | null,
  options?: {
    expectedGoldGrowthPct?: number;
    bankDepositRatePct?: number;
    prepaymentPenaltyPct?: number;
    referenceDateIso?: string;
  }
): GoldVsMortgageBenchmarkResult {
  const metrics = metricsInput ?? computeGoldPortfolioMetrics(portfolio);
  const refDateMs = Date.parse(
    options?.referenceDateIso || portfolio.updatedAt || new Date().toISOString()
  );

  // Weighted average holding days across active lots
  let weightedDaysNum = 0;
  let totalBasisWeight = 0;
  for (const ev of metrics.lotEvaluations) {
    const buyMs = Date.parse(ev.lot.purchaseDate);
    if (!Number.isFinite(buyMs) || ev.remainingCostBasis <= 0) continue;
    const days = Math.max(15, Math.round((refDateMs - buyMs) / (1000 * 60 * 60 * 24)));
    weightedDaysNum += days * ev.remainingCostBasis;
    totalBasisWeight += ev.remainingCostBasis;
  }
  const weightedAvgHoldingDays =
    totalBasisWeight > 0 ? Math.round(weightedDaysNum / totalBasisWeight) : 180;
  const yearsHeld = Math.max(0.15, weightedAvgHoldingDays / 365);

  const actualSimpleReturnPct = metrics.unrealizedPnlPct;
  const growthFactor = Math.max(0.1, 1 + actualSimpleReturnPct / 100);
  const actualAnnualizedReturnPct = Number(
    ((Math.pow(growthFactor, 1 / yearsHeld) - 1) * 100).toFixed(2)
  );

  const skyoneFixedRatePct = skyoneLoan?.fixedInterestRate ?? 5.5;
  const skyoneFloatingRatePct = Number(
    ((skyoneLoan?.floatingBaseRate ?? 7.0) + (skyoneLoan?.floatingSpread ?? 3.5)).toFixed(2)
  );
  const bankDepositRatePct = options?.bankDepositRatePct ?? 6.0;
  const prepaymentPenaltyPct = options?.prepaymentPenaltyPct ?? 1.0;

  const currentSpreadPct =
    metrics.totalAskReplacementValue > 0
      ? Number(((metrics.totalSpreadCostVnd / metrics.totalAskReplacementValue) * 100).toFixed(2))
      : 1.95;

  // Khi giữ vàng thêm 1 năm thay vì bán ngay trả nợ:
  // Nếu trả nợ ngay, bạn tiết kiệm được (lãi vay - phí phạt trả trước hạn) trên số tiền thu về (Bid).
  // Vì vậy để giữ vàng thắng trả nợ trong chân trời 1 năm, vàng phải tăng tối thiểu (r_loan - penalty).
  const breakEvenGoldGrowthVsFloatingPct = Number(
    Math.max(0, skyoneFloatingRatePct - prepaymentPenaltyPct).toFixed(2)
  );
  const breakEvenGoldGrowthVsFixedPct = Number(
    Math.max(0, skyoneFixedRatePct - prepaymentPenaltyPct).toFixed(2)
  );

  const expectedGoldGrowthPct = options?.expectedGoldGrowthPct ?? 9.0;
  const capitalVnd = metrics.totalLiquidationValueBid;
  const projectedGoldGain1YrVnd = Math.round(capitalVnd * (expectedGoldGrowthPct / 100));
  const projectedGoldValue1YrVnd = capitalVnd + projectedGoldGain1YrVnd;
  const projectedInterestSaved1YrIfPrepayVnd = Math.round(
    capitalVnd * (breakEvenGoldGrowthVsFloatingPct / 100)
  );
  const netAdvantageHoldingGold1YrVnd =
    projectedGoldGain1YrVnd - projectedInterestSaved1YrIfPrepayVnd;

  let verdict: GoldVsMortgageBenchmarkResult["verdict"] = "NEUTRAL";
  let verdictTitle = "Cân bằng giữa Giữ Vàng và Trả gốc SKYONE";
  let verdictDetail = `Kỳ vọng tăng giá vàng (${expectedGoldGrowthPct}%/năm) đang xấp xỉ ngưỡng hòa vốn lãi thả nổi sau phí phạt (${breakEvenGoldGrowthVsFloatingPct}%/năm). Nên chia đôi: giữ phần lõi phòng vệ, chốt một phần khi hết ân hạn 08/2028.`;

  if (expectedGoldGrowthPct >= breakEvenGoldGrowthVsFloatingPct + 1.5) {
    verdict = "HOLD_GOLD";
    verdictTitle = "Ưu tiên Giữ Vàng tích sản — Chi phí lãi vay thấp hơn kỳ vọng vàng";
    verdictDetail = `Kỳ vọng tăng giá vàng (${expectedGoldGrowthPct}%/năm) cao hơn ngưỡng hòa vốn trả nợ thả nổi (${breakEvenGoldGrowthVsFloatingPct}%/năm) và lãi cố định (${skyoneFixedRatePct}%/năm). Chỉ nên bán đúng số chỉ thiếu cho Nội thất Q3/2027.`;
  } else if (expectedGoldGrowthPct <= breakEvenGoldGrowthVsFloatingPct - 1.5) {
    verdict = "PREPAY_MORTGAGE";
    verdictTitle = "Cân nhắc Chốt một phần Vàng để tất toán gốc khi sang lãi thả nổi";
    verdictDetail = `Lãi vay thả nổi SKYONE (${skyoneFloatingRatePct}%/năm, hòa vốn ${breakEvenGoldGrowthVsFloatingPct}%/năm sau phí phạt) cao hơn kỳ vọng tăng giá vàng (${expectedGoldGrowthPct}%/năm). Bán vàng trả gốc tại mốc 08/2028 mang lại mức tiết kiệm chắc chắn không rủi ro.`;
  }

  return {
    weightedAvgHoldingDays,
    actualSimpleReturnPct,
    actualAnnualizedReturnPct,
    skyoneFixedRatePct,
    skyoneFloatingRatePct,
    bankDepositRatePct,
    prepaymentPenaltyPct,
    currentSpreadPct,
    breakEvenGoldGrowthVsFloatingPct,
    breakEvenGoldGrowthVsFixedPct,
    projectedGoldValue1YrVnd,
    projectedInterestSaved1YrIfPrepayVnd,
    netAdvantageHoldingGold1YrVnd,
    verdict,
    verdictTitle,
    verdictDetail,
  };
}

export interface NetWorthAllocationGuardrail {
  actualSharePct: number;
  targetSharePct: number;
  minBandPct: number;
  maxBandPct: number;
  deviationPct: number;
  status: "UNDERWEIGHT" | "BALANCED" | "OVERWEIGHT";
  deltaVndToTarget: number;
  deltaChiToTarget: number;
  headline: string;
}

export function computeNetWorthAllocationGuardrail(
  goldBidValueVnd: number,
  totalHouseholdNetWorthVnd: number,
  targetPct: number,
  nhan9999BidPerChiVnd: number
): NetWorthAllocationGuardrail {
  const safeNetWorth = Math.max(0, totalHouseholdNetWorthVnd);
  const safeTarget = Math.max(5, Math.min(50, targetPct || 15));
  const minBandPct = Math.max(0, safeTarget - 5);
  const maxBandPct = Math.min(60, safeTarget + 5);
  const actualSharePct =
    safeNetWorth > 0 ? Number(((goldBidValueVnd / safeNetWorth) * 100).toFixed(1)) : 0;
  const deviationPct = Number((actualSharePct - safeTarget).toFixed(1));

  const targetGoldVnd = Math.round(safeNetWorth * (safeTarget / 100));
  const deltaVndToTarget = targetGoldVnd - goldBidValueVnd; // >0 cần mua thêm, <0 đang dư tỷ trọng
  const deltaChiToTarget =
    nhan9999BidPerChiVnd > 0
      ? Number((Math.abs(deltaVndToTarget) / nhan9999BidPerChiVnd).toFixed(2))
      : 0;

  let status: NetWorthAllocationGuardrail["status"] = "BALANCED";
  let headline = `Tỷ trọng Vàng (${actualSharePct}%) nằm trong vùng an toàn ${minBandPct}% – ${maxBandPct}% Tài sản ròng.`;
  if (actualSharePct < minBandPct) {
    status = "UNDERWEIGHT";
    headline = `Tỷ trọng Vàng (${actualSharePct}%) thấp hơn mục tiêu ${safeTarget}% — có thể DCA thêm khoảng ${deltaChiToTarget} chỉ.`;
  } else if (actualSharePct > maxBandPct) {
    status = "OVERWEIGHT";
    headline = `Tỷ trọng Vàng (${actualSharePct}%) vượt trần ${maxBandPct}% — thuận lợi chốt lời ~${deltaChiToTarget} chỉ cho Quỹ nhận nhà.`;
  }

  return {
    actualSharePct,
    targetSharePct: safeTarget,
    minBandPct,
    maxBandPct,
    deviationPct,
    status,
    deltaVndToTarget,
    deltaChiToTarget,
    headline,
  };
}

function escapeGoldCsv(val: string): string {
  return `"${val.replace(/"/g, '""')}"`;
}

export function exportGoldVaultToCsv(
  portfolio: GoldPortfolioState,
  metricsInput?: GoldPortfolioMetrics
): void {
  const metrics = metricsInput ?? computeGoldPortfolioMetrics(portfolio);
  const headers = [
    "STT",
    "Phân loại",
    "Thương hiệu",
    "Độ tinh khiết",
    "Số seri",
    "Mã hóa đơn/Chứng nhận",
    "Cửa hàng mua",
    "Ngày mua",
    "Số chỉ gốc",
    "Còn nắm giữ (chỉ)",
    "Giá mua/chỉ (VND)",
    "Tiền công (VND)",
    "Giá vốn còn lại (VND)",
    "Giá Bid hiện tại/chỉ (VND)",
    "Giá trị thu mua Bid (VND)",
    "Lãi/Lỗ tạm tính (VND)",
    "Lãi/Lỗ (%)",
    "Nơi cất giữ",
    "Ghi chú",
  ];

  const rows = metrics.lotEvaluations.map((ev, idx) =>
    [
      String(idx + 1),
      escapeGoldCsv(GOLD_CATEGORY_META[ev.lot.category].label),
      escapeGoldCsv(ev.lot.brand),
      escapeGoldCsv(ev.lot.purityLabel || ""),
      escapeGoldCsv(ev.lot.serialNumber || ""),
      escapeGoldCsv(ev.lot.certificateCode || ""),
      escapeGoldCsv(ev.lot.storeName || ""),
      escapeGoldCsv(ev.lot.purchaseDate),
      String(ev.lot.quantityChi),
      String(ev.lot.remainingChi),
      String(ev.lot.unitBuyPricePerChi),
      String(ev.lot.makingFee || 0),
      String(ev.remainingCostBasis),
      String(ev.currentBidPerChi),
      String(ev.liquidationValueBid),
      String(ev.unrealizedPnl),
      `${ev.unrealizedPnlPct}%`,
      escapeGoldCsv(GOLD_STORAGE_LABELS[ev.lot.storageLocation]),
      escapeGoldCsv(ev.lot.invoiceNote || ""),
    ].join(",")
  );

  rows.push(
    [
      "",
      escapeGoldCsv("TỔNG CỘNG DANH MỤC ĐANG NẮM GIỮ"),
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      String(metrics.totalRemainingChi),
      String(metrics.weightedAvgCostPerChi),
      "",
      String(metrics.totalCostBasis),
      String(metrics.weightedBidPerChi),
      String(metrics.totalLiquidationValueBid),
      String(metrics.unrealizedPnl),
      `${metrics.unrealizedPnlPct}%`,
      "",
      "",
    ].join(",")
  );

  if (portfolio.sales.length > 0) {
    rows.push("");
    rows.push(escapeGoldCsv("LỊCH SỬ BÁN / CHỐT LỜI ĐÃ THỰC HIỆN"));
    rows.push(
      [
        "Ngày bán",
        "Loại vàng",
        "Số chỉ bán",
        "Giá bán Bid/chỉ (VND)",
        "Tiền thu về (VND)",
        "Giá vốn phân bổ (VND)",
        "Lãi/Lỗ thực nhận (VND)",
        "Mục đích",
        "Ghi chú",
      ]
        .map(escapeGoldCsv)
        .join(",")
    );
    for (const s of portfolio.sales) {
      rows.push(
        [
          escapeGoldCsv(s.saleDate),
          escapeGoldCsv(GOLD_CATEGORY_META[s.category].label),
          String(s.totalSoldChi),
          String(s.unitSellPricePerChi),
          String(s.totalProceeds),
          String(s.costBasisAllocated),
          String(s.realizedPnl),
          escapeGoldCsv(s.purpose),
          escapeGoldCsv(s.note || ""),
        ].join(",")
      );
    }
  }

  const csvContent = "\uFEFF" + [headers.map(escapeGoldCsv).join(","), ...rows].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `gold_vault_audit_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

