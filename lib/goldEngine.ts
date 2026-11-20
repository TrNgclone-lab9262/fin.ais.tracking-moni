import {
  FamilyMember,
  GoldCategory,
  GoldLiquidationStrategy,
  GoldLot,
  GoldMacroContext,
  GoldPortfolioState,
  GoldPriceQuote,
  GoldSaleAllocation,
  GoldStorageLocation,
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
    updatedAt: nowIso,
  };
}
