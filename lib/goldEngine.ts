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
  GoldSaleEvent,
  GoldStorageLocation,
  MortgageContract,
} from "@/types/finance";

export const GRAMS_PER_LUONG = 37.5;
export const GRAMS_PER_CHI = 3.75;
export const CHI_PER_LUONG = 10;
export const PHAN_PER_CHI = 10;
export const LY_PER_CHI = 100;
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

function roundToPrecision(value: number, precision: number): number {
  if (!Number.isFinite(value)) return 0;
  const safePrecision = Math.max(0, Math.min(8, Math.trunc(precision)));
  const factor = Math.pow(10, safePrecision);
  const rounded = Math.round((value + Number.EPSILON) * factor) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export type GoldWeightUnit = "CHI" | "LUONG" | "PHAN" | "LY" | "GRAM" | "TROY_OZ";

/**
 * Quy đổi nội bộ sang đơn vị Chỉ giữ nguyên độ chính xác IEEE-754 (không làm tròn sớm),
 * loại bỏ hoàn toàn sai số làm tròn kép (Zero Double-Rounding).
 */
function toExactChi(value: number, from: GoldWeightUnit): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  switch (from) {
    case "CHI":
      return value;
    case "LUONG":
      return value * CHI_PER_LUONG;
    case "PHAN":
      return value / PHAN_PER_CHI;
    case "LY":
      return value / LY_PER_CHI;
    case "GRAM":
      return value / GRAMS_PER_CHI;
    case "TROY_OZ":
      return (value * GRAMS_PER_TROY_OZ) / GRAMS_PER_CHI;
  }
}

function fromExactChi(exactChi: number, to: GoldWeightUnit): number {
  if (!Number.isFinite(exactChi) || exactChi < 0) return 0;
  switch (to) {
    case "CHI":
      return exactChi;
    case "LUONG":
      return exactChi / CHI_PER_LUONG;
    case "PHAN":
      return exactChi * PHAN_PER_CHI;
    case "LY":
      return exactChi * LY_PER_CHI;
    case "GRAM":
      return exactChi * GRAMS_PER_CHI;
    case "TROY_OZ":
      return (exactChi * GRAMS_PER_CHI) / GRAMS_PER_TROY_OZ;
  }
}

export function chiToLuong(chi: number, precision = 4): number {
  return roundToPrecision(fromExactChi(toExactChi(chi, "CHI"), "LUONG"), precision);
}

export function luongToChi(luong: number, precision = 4): number {
  return roundToPrecision(toExactChi(luong, "LUONG"), precision);
}

export function chiToGrams(chi: number, precision = 3): number {
  return roundToPrecision(fromExactChi(toExactChi(chi, "CHI"), "GRAM"), precision);
}

export function chiToPhan(chi: number, precision = 2): number {
  return roundToPrecision(fromExactChi(toExactChi(chi, "CHI"), "PHAN"), precision);
}

export function chiToTroyOz(chi: number, precision = 4): number {
  return roundToPrecision(fromExactChi(toExactChi(chi, "CHI"), "TROY_OZ"), precision);
}

export function gramsToChi(grams: number, precision = 4): number {
  return roundToPrecision(toExactChi(grams, "GRAM"), precision);
}

export function phanToChi(phan: number, precision = 4): number {
  return roundToPrecision(toExactChi(phan, "PHAN"), precision);
}

export function troyOzToChi(oz: number, precision = 4): number {
  return roundToPrecision(toExactChi(oz, "TROY_OZ"), precision);
}

export function convertGoldUnit(
  value: number,
  from: GoldWeightUnit,
  to: GoldWeightUnit,
  precision?: number
): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  const defaultPrecision =
    to === "GRAM" ? 3 : to === "PHAN" || to === "LY" ? 2 : 4;
  const targetPrecision = precision ?? defaultPrecision;
  if (from === to) return roundToPrecision(value, targetPrecision);
  const exactChi = toExactChi(value, from);
  const exactTarget = fromExactChi(exactChi, to);
  return roundToPrecision(exactTarget, targetPrecision);
}

export interface VietnameseGoldUnitDecomposition {
  luong: number;
  chi: number;
  phan: number;
  ly: number;
}

/**
 * Tách trọng lượng theo Chỉ sang bộ đơn vị đo lường vật lý Việt Nam (Lượng · Chỉ · Phân · Ly)
 * bằng số học nguyên theo đơn vị Ly (1 chỉ = 100 ly) để chống sai số dấu phẩy động.
 */
export function decomposeChiToVietnameseUnits(chi: number): VietnameseGoldUnitDecomposition {
  if (!Number.isFinite(chi) || chi <= 0) {
    return { luong: 0, chi: 0, phan: 0, ly: 0 };
  }
  const totalLy = Math.round(chi * LY_PER_CHI);
  const luong = Math.floor(totalLy / (CHI_PER_LUONG * LY_PER_CHI));
  const remAfterLuong = totalLy % (CHI_PER_LUONG * LY_PER_CHI);
  const chiPart = Math.floor(remAfterLuong / LY_PER_CHI);
  const remAfterChi = remAfterLuong % LY_PER_CHI;
  const phan = Math.floor(remAfterChi / 10);
  const ly = remAfterChi % 10;
  return { luong, chi: chiPart, phan, ly };
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

/**
 * Xuất bán theo phương pháp Bình quân gia quyền (WAC — Weighted Average Cost):
 * Tính đơn giá vốn bình quân trên toàn bộ tồn kho đang nắm giữ của loại vàng,
 * trừ khối lượng theo thứ tự cũ -> mới nhưng phân bổ giá vốn chính xác theo đơn giá WAC.
 */
export function allocateWacGoldSale(
  lots: GoldLot[],
  category: GoldCategory,
  sellChi: number
): {
  allocations: GoldSaleAllocation[];
  updatedLots: GoldLot[];
  wacPerChi: number;
  ok: boolean;
  error?: string;
} {
  const candidates = lots
    .filter((l) => l.category === category && l.remainingChi > 0 && l.status !== "SOLD")
    .sort((a, b) => a.purchaseDate.localeCompare(b.purchaseDate));

  const available = candidates.reduce((s, l) => s + l.remainingChi, 0);
  if (sellChi <= 0 || sellChi > available + 0.0001) {
    return {
      allocations: [],
      updatedLots: lots,
      wacPerChi: 0,
      ok: false,
      error: `Số chỉ bán (${sellChi} chỉ) vượt quá tồn kho khả dụng (${available.toFixed(2)} chỉ).`,
    };
  }

  const totalCategoryBasis = candidates.reduce(
    (sum, lot) => sum + getLotRemainingCostBasis(lot),
    0
  );
  const wacPerChi = available > 0 ? totalCategoryBasis / available : 0;

  let left = sellChi;
  const allocations: GoldSaleAllocation[] = [];
  const updateMap = new Map<string, { remainingChi: number; status: GoldLot["status"] }>();

  for (const lot of candidates) {
    if (left <= 0.0001) break;
    const take = Math.min(lot.remainingChi, left);
    const allocatedBasis = Math.round(take * wacPerChi);
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

  return {
    allocations,
    updatedLots,
    wacPerChi: Math.round(wacPerChi),
    ok: true,
  };
}

/**
 * Thực thi bán nhiều lô 1 lượt từ danh sách bước mô phỏng thanh khoản.
 */
export function allocateBatchGoldSale(
  lots: GoldLot[],
  steps: Array<{ lotId: string; sellChi: number }>
): { allocations: GoldSaleAllocation[]; updatedLots: GoldLot[]; ok: boolean; error?: string } {
  if (steps.length === 0) {
    return { allocations: [], updatedLots: lots, ok: false, error: "Chưa có lô nào trong kế hoạch bán." };
  }
  let workingLots = [...lots];
  const allAllocations: GoldSaleAllocation[] = [];

  for (const step of steps) {
    const res = allocateSpecificLotSale(workingLots, step.lotId, step.sellChi);
    if (!res.ok) {
      return { allocations: [], updatedLots: lots, ok: false, error: res.error };
    }
    workingLots = res.updatedLots;
    allAllocations.push(...res.allocations);
  }

  return { allocations: allAllocations, updatedLots: workingLots, ok: true };
}

/**
 * Hoàn tác một sự kiện bán vàng: cộng trả chính xác remainingChi về từng lô bị trừ và cập nhật status.
 */
export function revertGoldSaleAllocation(
  lots: GoldLot[],
  saleEvent: GoldSaleEvent
): GoldLot[] {
  const restoreMap = new Map<string, number>();
  for (const alloc of saleEvent.allocations) {
    restoreMap.set(alloc.lotId, (restoreMap.get(alloc.lotId) || 0) + alloc.soldChi);
  }
  const nowIso = new Date().toISOString();
  return lots.map((lot) => {
    const restoreChi = restoreMap.get(lot.id);
    if (!restoreChi) return lot;
    const nextRemaining = Number(
      Math.min(lot.quantityChi, lot.remainingChi + restoreChi).toFixed(4)
    );
    const nextStatus: GoldLot["status"] =
      nextRemaining >= lot.quantityChi - 0.0001
        ? "HOLDING"
        : nextRemaining > 0.0001
          ? "PARTIAL_SOLD"
          : "SOLD";
    return {
      ...lot,
      remainingChi: nextRemaining,
      status: nextStatus,
      updatedAt: nowIso,
    };
  });
}

export interface GoldIntegrityIssue {
  code: string;
  severity: "WARNING" | "ERROR";
  message: string;
  entityId?: string;
}

export interface GoldIntegrityAuditReport {
  ok: boolean;
  errorCount: number;
  warningCount: number;
  issues: GoldIntegrityIssue[];
  summary: string;
}

/**
 * Kiểm toán toàn vẹn kế toán kho vàng chuẩn Bank-Grade theo đủ 7 nhóm bất biến:
 * 1. Định luật bảo toàn sổ cái: quantityChi - sum(soldAllocations) === remainingChi
 * 2. Biên tồn kho lô: 0 <= remainingChi <= quantityChi
 * 3. Nhất quán trạng thái lô: HOLDING / PARTIAL_SOLD / SOLD
 * 4. Toàn vẹn sự kiện bán: tổng phân bổ, phương trình P&L, tham chiếu lô mồ côi
 * 5. Tính duy nhất định danh: lot.id, sale.id, priceHistory.date
 * 6. Hợp lý bảng giá & vĩ mô: Bid <= Ask, giá dương hữu hạn, tỷ giá hợp lệ
 * 7. Chi phí & khối lượng lô hợp lệ: quantityChi > 0, unitBuyPricePerChi > 0, makingFee >= 0
 */
export function verifyGoldPortfolioIntegrity(
  portfolio: GoldPortfolioState
): GoldIntegrityAuditReport {
  const issues: GoldIntegrityIssue[] = [];
  const lotIds = new Set<string>();
  const duplicateLotIds = new Set<string>();
  const soldByLotId = new Map<string, number>();

  // Thu thập ID lô & kiểm tra trùng lặp (Bất biến #5)
  for (const lot of portfolio.lots) {
    if (lotIds.has(lot.id)) {
      if (!duplicateLotIds.has(lot.id)) {
        duplicateLotIds.add(lot.id);
        issues.push({
          code: "DUPLICATE_LOT_ID",
          severity: "ERROR",
          entityId: lot.id,
          message: `Phát hiện mã lô vàng trùng lặp (${lot.id}).`,
        });
      }
    } else {
      lotIds.add(lot.id);
    }
  }

  // Kiểm tra sự kiện bán & tổng hợp số chỉ đã phân bổ theo từng lô (Bất biến #4 & #5)
  const saleIds = new Set<string>();
  const duplicateSaleIds = new Set<string>();
  for (const sale of portfolio.sales) {
    if (saleIds.has(sale.id)) {
      if (!duplicateSaleIds.has(sale.id)) {
        duplicateSaleIds.add(sale.id);
        issues.push({
          code: "DUPLICATE_SALE_ID",
          severity: "ERROR",
          entityId: sale.id,
          message: `Phát hiện mã giao dịch bán vàng trùng lặp (${sale.id}).`,
        });
      }
    } else {
      saleIds.add(sale.id);
    }

    const sumAlloc = sale.allocations.reduce((s, a) => s + a.soldChi, 0);
    if (Math.abs(sumAlloc - sale.totalSoldChi) > 0.0005) {
      issues.push({
        code: "SALE_ALLOCATION_SUM_MISMATCH",
        severity: "ERROR",
        entityId: sale.id,
        message: `Giao dịch bán ${sale.saleDate} có tổng phân bổ (${roundToPrecision(sumAlloc, 4)} chỉ) khác tổng số chỉ bán (${sale.totalSoldChi} chỉ).`,
      });
    }

    const expectedPnl = sale.totalProceeds - sale.costBasisAllocated;
    if (Math.abs(expectedPnl - sale.realizedPnl) > 5) {
      issues.push({
        code: "SALE_PNL_EQUATION_MISMATCH",
        severity: "ERROR",
        entityId: sale.id,
        message: `Giao dịch bán ${sale.saleDate} sai phương trình P&L (Thu về - Giá vốn lệch ${Math.round(Math.abs(expectedPnl - sale.realizedPnl)).toLocaleString("vi-VN")}đ).`,
      });
    }

    for (const alloc of sale.allocations) {
      if (!lotIds.has(alloc.lotId)) {
        issues.push({
          code: "ORPHAN_SALE_ALLOCATION",
          severity: "WARNING",
          entityId: sale.id,
          message: `Giao dịch bán ${sale.saleDate} tham chiếu lô đã bị xóa (${alloc.lotId}).`,
        });
      } else {
        soldByLotId.set(alloc.lotId, (soldByLotId.get(alloc.lotId) ?? 0) + alloc.soldChi);
      }
    }
  }

  // Kiểm tra từng lô vàng (Bất biến #1, #2, #3, #7)
  for (const lot of portfolio.lots) {
    if (!Number.isFinite(lot.quantityChi) || lot.quantityChi <= 0) {
      issues.push({
        code: "NON_POSITIVE_LOT_QUANTITY",
        severity: "ERROR",
        entityId: lot.id,
        message: `Lô ${lot.brand} có khối lượng gốc không hợp lệ (${lot.quantityChi} chỉ).`,
      });
    }
    if (!Number.isFinite(lot.unitBuyPricePerChi) || lot.unitBuyPricePerChi <= 0) {
      issues.push({
        code: "NON_POSITIVE_UNIT_PRICE",
        severity: "ERROR",
        entityId: lot.id,
        message: `Lô ${lot.brand} có đơn giá mua không hợp lệ (${lot.unitBuyPricePerChi}).`,
      });
    }
    if (!Number.isFinite(lot.makingFee) || lot.makingFee < 0) {
      issues.push({
        code: "NEGATIVE_MAKING_FEE",
        severity: "ERROR",
        entityId: lot.id,
        message: `Lô ${lot.brand} có tiền công âm (${lot.makingFee}).`,
      });
    }

    if (lot.remainingChi < -0.0001) {
      issues.push({
        code: "NEGATIVE_REMAINING",
        severity: "ERROR",
        entityId: lot.id,
        message: `Lô ${lot.brand} có tồn kho âm (${lot.remainingChi} chỉ).`,
      });
    }
    if (lot.remainingChi > lot.quantityChi + 0.0001) {
      issues.push({
        code: "REMAINING_EXCEEDS_ORIGINAL",
        severity: "ERROR",
        entityId: lot.id,
        message: `Lô ${lot.brand} có tồn kho (${lot.remainingChi} chỉ) lớn hơn số mua gốc (${lot.quantityChi} chỉ).`,
      });
    }

    // Định luật bảo toàn sổ cái (#1)
    const soldFromLot = soldByLotId.get(lot.id) ?? 0;
    const expectedRemaining = Math.max(0, lot.quantityChi - soldFromLot);
    if (Math.abs(expectedRemaining - lot.remainingChi) > 0.0005) {
      issues.push({
        code: "LEDGER_CONSERVATION_MISMATCH",
        severity: "ERROR",
        entityId: lot.id,
        message: `Lô ${lot.brand} lệch sổ cái: mua ${lot.quantityChi} - đã bán ${roundToPrecision(soldFromLot, 4)} = ${roundToPrecision(expectedRemaining, 4)} chỉ, nhưng đang lưu ${lot.remainingChi} chỉ.`,
      });
    }

    // Nhất quán 3 trạng thái lô (#3)
    if (lot.remainingChi <= 0.0001 && lot.status !== "SOLD") {
      issues.push({
        code: "STATUS_MISMATCH_SOLD",
        severity: "WARNING",
        entityId: lot.id,
        message: `Lô ${lot.brand} đã bán hết nhưng trạng thái đang là ${lot.status} (cần SOLD).`,
      });
    } else if (
      lot.quantityChi > 0 &&
      Math.abs(lot.remainingChi - lot.quantityChi) <= 0.0001 &&
      lot.status !== "HOLDING"
    ) {
      issues.push({
        code: "STATUS_MISMATCH_HOLDING",
        severity: "WARNING",
        entityId: lot.id,
        message: `Lô ${lot.brand} còn nguyên khối lượng gốc nhưng trạng thái đang là ${lot.status} (cần HOLDING).`,
      });
    } else if (
      lot.remainingChi > 0.0001 &&
      lot.remainingChi < lot.quantityChi - 0.0001 &&
      lot.status !== "PARTIAL_SOLD"
    ) {
      issues.push({
        code: "STATUS_MISMATCH_PARTIAL",
        severity: "WARNING",
        entityId: lot.id,
        message: `Lô ${lot.brand} đã bán một phần nhưng trạng thái đang là ${lot.status} (cần PARTIAL_SOLD).`,
      });
    }
  }

  // Kiểm tra trùng ngày trong lịch sử giá (#5)
  if (portfolio.priceHistory && portfolio.priceHistory.length > 1) {
    const seenDates = new Set<string>();
    const dupDates = new Set<string>();
    for (const snap of portfolio.priceHistory) {
      if (seenDates.has(snap.date)) {
        if (!dupDates.has(snap.date)) {
          dupDates.add(snap.date);
          issues.push({
            code: "DUPLICATE_PRICE_SNAPSHOT_DATE",
            severity: "WARNING",
            entityId: snap.date,
            message: `Lịch sử giá vàng bị trùng mốc ngày ${snap.date}.`,
          });
        }
      } else {
        seenDates.add(snap.date);
      }
    }
  }

  // Kiểm tra bảng giá thị trường & thông số vĩ mô (#6)
  for (const cat of Object.keys(portfolio.quotes) as GoldCategory[]) {
    const quote = portfolio.quotes[cat];
    if (!quote) continue;
    if (
      !Number.isFinite(quote.buyPricePerChi) ||
      !Number.isFinite(quote.sellPricePerChi) ||
      quote.buyPricePerChi <= 0 ||
      quote.sellPricePerChi <= 0
    ) {
      issues.push({
        code: "INVALID_QUOTE_PRICE",
        severity: "ERROR",
        entityId: cat,
        message: `Bảng giá ${GOLD_CATEGORY_META[cat]?.shortLabel || cat} chứa giá Bid/Ask không hợp lệ.`,
      });
    } else if (quote.buyPricePerChi > quote.sellPricePerChi) {
      issues.push({
        code: "INVERTED_BID_ASK_SPREAD",
        severity: "ERROR",
        entityId: cat,
        message: `Bảng giá ${GOLD_CATEGORY_META[cat]?.shortLabel || cat} bị đảo chiều (Giá mua vào Bid > Giá bán ra Ask).`,
      });
    }
  }

  if (
    !portfolio.macro ||
    !Number.isFinite(portfolio.macro.worldXauUsdPerOz) ||
    portfolio.macro.worldXauUsdPerOz <= 0 ||
    !Number.isFinite(portfolio.macro.usdVndRate) ||
    portfolio.macro.usdVndRate <= 0
  ) {
    issues.push({
      code: "INVALID_MACRO_RATE",
      severity: "WARNING",
      entityId: "macro",
      message: "Thông số vĩ mô XAU/USD hoặc tỷ giá USD/VND không hợp lệ.",
    });
  }

  const errorCount = issues.filter((i) => i.severity === "ERROR").length;
  const warningCount = issues.filter((i) => i.severity === "WARNING").length;
  const ok = errorCount === 0;
  const summary =
    errorCount === 0 && warningCount === 0
      ? "Sổ cái Kho Vàng đạt chuẩn toàn vẹn tuyệt đối (0 lỗi · 0 cảnh báo)."
      : errorCount === 0
        ? `Sổ cái hợp lệ (0 lỗi nghiêm trọng · ${warningCount} cảnh báo cần lưu ý).`
        : `Phát hiện ${errorCount} lỗi kế toán và ${warningCount} cảnh báo cần đối soát.`;

  return {
    ok,
    errorCount,
    warningCount,
    issues,
    summary,
  };
}

/**
 * Tự động đối soát an toàn (Immutable): tính lại remainingChi & status cho từng lô từ sổ phân bổ bán,
 * khử trùng mốc ngày trong priceHistory mà không xóa bỏ lịch sử giao dịch.
 */
export function reconcileGoldPortfolioIntegrity(portfolio: GoldPortfolioState): {
  reconciledPortfolio: GoldPortfolioState;
  fixedLotIds: string[];
  remainingIssues: GoldIntegrityIssue[];
} {
  const soldByLotId = new Map<string, number>();
  for (const sale of portfolio.sales) {
    for (const alloc of sale.allocations) {
      soldByLotId.set(alloc.lotId, (soldByLotId.get(alloc.lotId) ?? 0) + alloc.soldChi);
    }
  }

  const fixedLotIds: string[] = [];
  const nextLots: GoldLot[] = portfolio.lots.map((lot) => {
    const soldChi = soldByLotId.get(lot.id) ?? 0;
    const expectedRemaining = roundToPrecision(Math.max(0, lot.quantityChi - soldChi), 4);
    const expectedStatus: GoldLot["status"] =
      expectedRemaining <= 0.0001
        ? "SOLD"
        : Math.abs(expectedRemaining - lot.quantityChi) <= 0.0001
          ? "HOLDING"
          : "PARTIAL_SOLD";

    if (
      Math.abs(lot.remainingChi - expectedRemaining) > 0.0001 ||
      lot.status !== expectedStatus
    ) {
      fixedLotIds.push(lot.id);
      return {
        ...lot,
        remainingChi: expectedRemaining,
        status: expectedStatus,
      };
    }
    return lot;
  });

  // Khử trùng priceHistory theo khóa ngày, ưu tiên bản ghi mới hơn
  let nextPriceHistory = portfolio.priceHistory;
  if (portfolio.priceHistory && portfolio.priceHistory.length > 1) {
    const byDate = new Map<string, GoldPriceSnapshot>();
    for (const snap of portfolio.priceHistory) {
      const prev = byDate.get(snap.date);
      if (!prev || snap.recordedAt.localeCompare(prev.recordedAt) > 0) {
        byDate.set(snap.date, snap);
      }
    }
    nextPriceHistory = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  }

  const reconciledPortfolio: GoldPortfolioState = {
    ...portfolio,
    lots: nextLots,
    priceHistory: nextPriceHistory,
  };

  const audit = verifyGoldPortfolioIntegrity(reconciledPortfolio);
  return {
    reconciledPortfolio,
    fixedLotIds,
    remainingIssues: audit.issues,
  };
}

export interface GoldStressTestScenario {
  id: string;
  label: string;
  xauShockPct: number;
  fxShockPct: number;
  spreadPct: number;
  projectedXauUsd: number;
  projectedUsdVnd: number;
  projectedBidValueVnd: number;
  deltaVsCurrentBidVnd: number;
  projectedUnrealizedPnlVnd: number;
  projectedUnrealizedPnlPct: number;
}

/**
 * Ma trận Stress-Test Giá Vàng: mô phỏng tác động của XAU/USD (±10%), USD/VND (±3%) và Spread (2.0%–3.5%)
 * lên Giá trị thu mua thực (Bid) và Lãi/Lỗ ròng của Kho Vàng hiện tại.
 */
export function computeGoldStressTestMatrix(
  portfolio: GoldPortfolioState,
  metricsInput?: GoldPortfolioMetrics
): GoldStressTestScenario[] {
  const baseMetrics = metricsInput ?? computeGoldPortfolioMetrics(portfolio);
  const baseXau = portfolio.macro.worldXauUsdPerOz || 2800;
  const baseFx = portfolio.macro.usdVndRate || 25450;
  const baseWorldPerChi = computeWorldGoldPricePerChiVnd(portfolio.macro) || 1;
  const baseBid = baseMetrics.totalLiquidationValueBid;
  const baseCost = baseMetrics.totalCostBasis;

  const specs: Array<{
    id: string;
    label: string;
    xauShockPct: number;
    fxShockPct: number;
    spreadPct: number;
  }> = [
    { id: "stress_bear_severe", label: "Sốc giảm sâu (XAU -10%, Tỷ giá -3%, Spread giãn 3,5%)", xauShockPct: -10, fxShockPct: -3, spreadPct: 3.5 },
    { id: "stress_bear_xau", label: "Vàng thế giới điều chỉnh (XAU -10%, Tỷ giá 0%, Spread 2,5%)", xauShockPct: -10, fxShockPct: 0, spreadPct: 2.5 },
    { id: "stress_spread_wide", label: "Biên độ Mua–Bán giãn rộng (XAU 0%, Tỷ giá 0%, Spread 3,5%)", xauShockPct: 0, fxShockPct: 0, spreadPct: 3.5 },
    { id: "stress_base", label: "Kịch bản cơ sở hiện tại (XAU 0%, Tỷ giá 0%, Spread 2,0%)", xauShockPct: 0, fxShockPct: 0, spreadPct: 2.0 },
    { id: "stress_fx_up", label: "USD/VND tăng nóng (XAU 0%, Tỷ giá +3%, Spread 2,0%)", xauShockPct: 0, fxShockPct: 3, spreadPct: 2.0 },
    { id: "stress_bull_xau", label: "Vàng bứt phá (XAU +10%, Tỷ giá 0%, Spread 2,0%)", xauShockPct: 10, fxShockPct: 0, spreadPct: 2.0 },
    { id: "stress_bull_combo", label: "Cộng hưởng tăng mạnh (XAU +10%, Tỷ giá +3%, Spread 2,0%)", xauShockPct: 10, fxShockPct: 3, spreadPct: 2.0 },
  ];

  return specs.map((sp) => {
    const projectedXauUsd = Math.round(baseXau * (1 + sp.xauShockPct / 100) * 10) / 10;
    const projectedUsdVnd = Math.round(baseFx * (1 + sp.fxShockPct / 100));
    const newWorldPerChi = computeWorldGoldPricePerChiVnd({
      worldXauUsdPerOz: projectedXauUsd,
      usdVndRate: projectedUsdVnd,
      updatedAt: portfolio.macro.updatedAt,
    });
    const priceMultiplier = newWorldPerChi / baseWorldPerChi;

    let projectedBidValueVnd = 0;
    for (const ev of baseMetrics.lotEvaluations) {
      const shockedAskPerChi = ev.currentAskPerChi * priceMultiplier;
      const shockedBidPerChi = Math.max(0, shockedAskPerChi * (1 - sp.spreadPct / 100));
      projectedBidValueVnd += Math.round(ev.lot.remainingChi * shockedBidPerChi);
    }

    const projectedUnrealizedPnlVnd = projectedBidValueVnd - baseCost;
    const projectedUnrealizedPnlPct =
      baseCost > 0 ? Number(((projectedUnrealizedPnlVnd / baseCost) * 100).toFixed(2)) : 0;

    return {
      id: sp.id,
      label: sp.label,
      xauShockPct: sp.xauShockPct,
      fxShockPct: sp.fxShockPct,
      spreadPct: sp.spreadPct,
      projectedXauUsd,
      projectedUsdVnd,
      projectedBidValueVnd,
      deltaVsCurrentBidVnd: projectedBidValueVnd - baseBid,
      projectedUnrealizedPnlVnd,
      projectedUnrealizedPnlPct,
    };
  });
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

const CSV_FORMULA_PREFIX_RE = /^[=+\-@\t\r]/;

/**
 * Bảo vệ chống CSV Formula Injection (CWE-1236) + escape RFC-4180 chuẩn Excel / Google Sheets.
 */
function escapeGoldCsv(val: string): string {
  const safeVal = CSV_FORMULA_PREFIX_RE.test(val) ? `'${val}` : val;
  return `"${safeVal.replace(/"/g, '""')}"`;
}

export interface GoldVaultCsvOptions {
  includeSoldLots?: boolean;
  maskSensitive?: boolean;
  generatedAtIso?: string;
}

/**
 * Hàm thuần túy (zero DOM) dựng nội dung CSV kiểm kê Kho Vàng (UTF-8 BOM, chống CWE-1236)
 * hỗ trợ tùy chọn xuất cả lô đã bán hết & che ẩn thông tin nhạy cảm khi bật Privacy Mode.
 */
export function buildGoldVaultCsvContent(
  portfolio: GoldPortfolioState,
  metricsInput?: GoldPortfolioMetrics,
  options?: GoldVaultCsvOptions
): string {
  const metrics = metricsInput ?? computeGoldPortfolioMetrics(portfolio);
  const includeSoldLots = options?.includeSoldLots ?? false;
  const maskSensitive = options?.maskSensitive ?? false;
  const generatedAt = options?.generatedAtIso ?? portfolio.updatedAt ?? new Date().toISOString();
  const worldPerChi = computeWorldGoldPricePerChiVnd(portfolio.macro);

  const maskText = (text: string | undefined): string => {
    if (!text) return "";
    return maskSensitive ? "•••" : text;
  };
  const maskMoney = (amount: number): string => (maskSensitive ? "•••" : String(amount));

  const metadataRows = [
    [
      escapeGoldCsv("BÁO CÁO KIỂM KÊ KHO TÍCH SẢN VÀNG — HOME MONI"),
      escapeGoldCsv(`Ngày xuất: ${generatedAt.slice(0, 10)}`),
      escapeGoldCsv(`XAU/USD: ${portfolio.macro.worldXauUsdPerOz} USD/oz`),
      escapeGoldCsv(`USD/VND: ${portfolio.macro.usdVndRate}`),
      escapeGoldCsv(`Quy đổi TG/chỉ: ${worldPerChi} VND`),
    ].join(","),
    "",
  ];

  const headers = [
    "STT",
    "Phân loại",
    "Thương hiệu",
    "Trạng thái",
    "Độ tinh khiết",
    "Số seri",
    "Mã hóa đơn/Chứng nhận",
    "Cửa hàng mua",
    "Ngày mua",
    "Số chỉ gốc",
    "Còn nắm giữ (chỉ)",
    "Còn nắm giữ (lượng)",
    "Còn nắm giữ (gram)",
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

  const activeRows = metrics.lotEvaluations.map((ev, idx) =>
    [
      String(idx + 1),
      escapeGoldCsv(GOLD_CATEGORY_META[ev.lot.category].label),
      escapeGoldCsv(ev.lot.brand),
      escapeGoldCsv(ev.lot.status),
      escapeGoldCsv(ev.lot.purityLabel || ""),
      escapeGoldCsv(maskText(ev.lot.serialNumber)),
      escapeGoldCsv(maskText(ev.lot.certificateCode)),
      escapeGoldCsv(maskText(ev.lot.storeName)),
      escapeGoldCsv(ev.lot.purchaseDate),
      String(ev.lot.quantityChi),
      String(ev.lot.remainingChi),
      String(convertGoldUnit(ev.lot.remainingChi, "CHI", "LUONG", 4)),
      String(convertGoldUnit(ev.lot.remainingChi, "CHI", "GRAM", 3)),
      maskMoney(ev.lot.unitBuyPricePerChi),
      maskMoney(ev.lot.makingFee || 0),
      maskMoney(ev.remainingCostBasis),
      String(ev.currentBidPerChi),
      maskMoney(ev.liquidationValueBid),
      maskMoney(ev.unrealizedPnl),
      `${ev.unrealizedPnlPct}%`,
      escapeGoldCsv(GOLD_STORAGE_LABELS[ev.lot.storageLocation]),
      escapeGoldCsv(maskText(ev.lot.invoiceNote)),
    ].join(",")
  );

  const soldRows: string[] = [];
  if (includeSoldLots) {
    const soldLots = portfolio.lots.filter((l) => l.remainingChi <= 0.0001 || l.status === "SOLD");
    soldLots.forEach((lot, idx) => {
      const quote = portfolio.quotes[lot.category];
      soldRows.push(
        [
          String(activeRows.length + idx + 1),
          escapeGoldCsv(GOLD_CATEGORY_META[lot.category].label),
          escapeGoldCsv(lot.brand),
          escapeGoldCsv("SOLD"),
          escapeGoldCsv(lot.purityLabel || ""),
          escapeGoldCsv(maskText(lot.serialNumber)),
          escapeGoldCsv(maskText(lot.certificateCode)),
          escapeGoldCsv(maskText(lot.storeName)),
          escapeGoldCsv(lot.purchaseDate),
          String(lot.quantityChi),
          "0",
          "0",
          "0",
          maskMoney(lot.unitBuyPricePerChi),
          maskMoney(lot.makingFee || 0),
          "0",
          String(quote?.buyPricePerChi ?? 0),
          "0",
          "0",
          "0%",
          escapeGoldCsv(GOLD_STORAGE_LABELS[lot.storageLocation]),
          escapeGoldCsv(maskText(lot.invoiceNote)),
        ].join(",")
      );
    });
  }

  const rows: string[] = [...activeRows, ...soldRows];

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
      "",
      String(metrics.totalRemainingChi),
      String(convertGoldUnit(metrics.totalRemainingChi, "CHI", "LUONG", 4)),
      String(convertGoldUnit(metrics.totalRemainingChi, "CHI", "GRAM", 3)),
      maskMoney(metrics.weightedAvgCostPerChi),
      "",
      maskMoney(metrics.totalCostBasis),
      String(metrics.weightedBidPerChi),
      maskMoney(metrics.totalLiquidationValueBid),
      maskMoney(metrics.unrealizedPnl),
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
        "Phương thức",
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
          escapeGoldCsv(s.allocationMode || "FIFO"),
          String(s.totalSoldChi),
          String(s.unitSellPricePerChi),
          maskMoney(s.totalProceeds),
          maskMoney(s.costBasisAllocated),
          maskMoney(s.realizedPnl),
          escapeGoldCsv(s.purpose),
          escapeGoldCsv(maskText(s.note)),
        ].join(",")
      );
    }
  }

  return (
    "\uFEFF" +
    [...metadataRows, headers.map(escapeGoldCsv).join(","), ...rows].join("\r\n")
  );
}

export function exportGoldVaultToCsv(
  portfolio: GoldPortfolioState,
  metricsInput?: GoldPortfolioMetrics,
  options?: GoldVaultCsvOptions
): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const csvContent = buildGoldVaultCsvContent(portfolio, metricsInput, options);
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

