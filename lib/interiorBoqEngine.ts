import {
  InteriorBoqGroup,
  InteriorDesignScenario,
  InteriorFurnitureItem,
} from "@/types/finance";
import { SKYONE_A2_BOUNDS } from "./interiorFloorplan";
import { SKYONE_A12A07_VERIFIED_FACTS } from "@/system_context";

export const BOQ_GROUP_META: Record<
  InteriorBoqGroup,
  { label: string; shortLabel: string; color: string }
> = {
  WOOD_FURNITURE: {
    label: "Nội thất gỗ & Bàn ghế",
    shortLabel: "Nội thất gỗ",
    color: "#B45309",
  },
  APPLIANCES: {
    label: "Thiết bị điện máy",
    shortLabel: "Điện máy",
    color: "#2563EB",
  },
  FINISHING_DECOR: {
    label: "Hoàn thiện bổ sung & Decor",
    shortLabel: "Rèm / Đèn / Decor",
    color: "#10B981",
  },
  DEVELOPER_INCLUDED: {
    label: "CĐT Phú Đông bàn giao sẵn",
    shortLabel: "CĐT sẵn (0 đ)",
    color: "#64748B",
  },
};

export function calculateFurnitureItemCostVnd(item: InteriorFurnitureItem): number {
  if (item.source === "DEVELOPER_INCLUDED" || item.boqGroup === "DEVELOPER_INCLUDED") {
    return 0;
  }
  if (item.pricingRule === "PER_LINEAR_METER") {
    const linearMeters = Math.max(0.3, item.dimensionsCm.width / 100);
    return Math.round(linearMeters * item.unitPriceVnd);
  }
  if (item.pricingRule === "PER_SQUARE_METER") {
    const areaSqm = Math.max(
      0.2,
      (item.dimensionsCm.width / 100) * (item.dimensionsCm.height / 100)
    );
    return Math.round(areaSqm * item.unitPriceVnd);
  }
  return Math.round(item.unitPriceVnd);
}

export interface BoqUnifiedRow {
  id: string;
  origin: "3D_ITEM" | "EXTRA_LINE";
  name: string;
  roomId: string;
  boqGroup: InteriorBoqGroup;
  source: InteriorFurnitureItem["source"];
  specLabel: string;
  totalPriceVnd: number;
  procurementStatus: InteriorFurnitureItem["procurementStatus"];
  linkedTransactionId?: string;
  note?: string;
}

export interface ScenarioBoqSummary {
  scenarioId: string;
  rows: BoqUnifiedRow[];
  byGroup: Record<InteriorBoqGroup, number>;
  woodFurnitureTotal: number;
  appliancesTotal: number;
  finishingDecorTotal: number;
  developerIncludedCount: number;
  subtotalNewPurchase: number;
  contingencyAmount: number;
  grandTotalWithContingency: number;
  paidOrDepositedVnd: number;
  remainingToPayVnd: number;
  targetBudgetMinVnd: number;
  targetBudgetMaxVnd: number;
  budgetStatus: "UNDER_BUDGET" | "IN_TARGET_RANGE" | "OVER_BUDGET";
  varianceFromMaxVnd: number;
}

export function calculateScenarioBoq(scenario: InteriorDesignScenario): ScenarioBoqSummary {
  const byGroup: Record<InteriorBoqGroup, number> = {
    WOOD_FURNITURE: 0,
    APPLIANCES: 0,
    FINISHING_DECOR: 0,
    DEVELOPER_INCLUDED: 0,
  };

  let developerIncludedCount = 0;
  let paidOrDepositedVnd = 0;

  const itemRows: BoqUnifiedRow[] = scenario.items.map((item) => {
    const totalPriceVnd = calculateFurnitureItemCostVnd(item);
    byGroup[item.boqGroup] += totalPriceVnd;
    if (item.source === "DEVELOPER_INCLUDED") {
      developerIncludedCount += 1;
    }
    if (
      totalPriceVnd > 0 &&
      (item.procurementStatus === "DEPOSITED" || item.procurementStatus === "INSTALLED")
    ) {
      paidOrDepositedVnd += totalPriceVnd;
    }

    const dimText = `${item.dimensionsCm.width}×${item.dimensionsCm.depth}×${item.dimensionsCm.height} cm`;
    const ruleTag =
      item.pricingRule === "PER_LINEAR_METER"
        ? ` · ${(item.dimensionsCm.width / 100).toFixed(2)} md`
        : item.pricingRule === "PER_SQUARE_METER"
          ? ` · ${((item.dimensionsCm.width * item.dimensionsCm.height) / 10000).toFixed(2)} m²`
          : "";

    return {
      id: item.id,
      origin: "3D_ITEM",
      name: item.name,
      roomId: item.roomId,
      boqGroup: item.boqGroup,
      source: item.source,
      specLabel: `${dimText}${ruleTag}`,
      totalPriceVnd,
      procurementStatus: item.procurementStatus,
      linkedTransactionId: item.linkedTransactionId,
      note: item.note,
    };
  });

  const extraRows: BoqUnifiedRow[] = scenario.extraBoqItems.map((ex) => {
    const totalPriceVnd =
      ex.source === "DEVELOPER_INCLUDED" ? 0 : Math.round(ex.quantity * ex.unitPriceVnd);
    byGroup[ex.boqGroup] += totalPriceVnd;
    if (
      totalPriceVnd > 0 &&
      (ex.procurementStatus === "DEPOSITED" || ex.procurementStatus === "INSTALLED")
    ) {
      paidOrDepositedVnd += totalPriceVnd;
    }

    return {
      id: ex.id,
      origin: "EXTRA_LINE",
      name: ex.name,
      roomId: ex.roomId,
      boqGroup: ex.boqGroup,
      source: ex.source,
      specLabel: `${ex.quantity} ${ex.unit}`,
      totalPriceVnd,
      procurementStatus: ex.procurementStatus,
      linkedTransactionId: ex.linkedTransactionId,
      note: ex.note,
    };
  });

  const subtotalNewPurchase =
    byGroup.WOOD_FURNITURE + byGroup.APPLIANCES + byGroup.FINISHING_DECOR;
  const contingencyAmount = Math.round(
    subtotalNewPurchase * ((scenario.contingencyPercent || 0) / 100)
  );
  const grandTotalWithContingency = subtotalNewPurchase + contingencyAmount;

  let budgetStatus: ScenarioBoqSummary["budgetStatus"] = "IN_TARGET_RANGE";
  if (grandTotalWithContingency < scenario.targetBudgetMinVnd) {
    budgetStatus = "UNDER_BUDGET";
  } else if (grandTotalWithContingency > scenario.targetBudgetMaxVnd) {
    budgetStatus = "OVER_BUDGET";
  }

  return {
    scenarioId: scenario.id,
    rows: [...itemRows, ...extraRows],
    byGroup,
    woodFurnitureTotal: byGroup.WOOD_FURNITURE,
    appliancesTotal: byGroup.APPLIANCES,
    finishingDecorTotal: byGroup.FINISHING_DECOR,
    developerIncludedCount,
    subtotalNewPurchase,
    contingencyAmount,
    grandTotalWithContingency,
    paidOrDepositedVnd,
    remainingToPayVnd: Math.max(0, grandTotalWithContingency - paidOrDepositedVnd),
    targetBudgetMinVnd: scenario.targetBudgetMinVnd,
    targetBudgetMaxVnd: scenario.targetBudgetMaxVnd,
    budgetStatus,
    varianceFromMaxVnd: scenario.targetBudgetMaxVnd - grandTotalWithContingency,
  };
}

export interface ErgonomicWarning {
  id: string;
  severity: "WARNING" | "DANGER";
  itemId: string;
  itemName: string;
  message: string;
}

function getFootprintBounds(item: InteriorFurnitureItem): {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
} {
  const rad = (item.rotationDeg * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const wM = item.dimensionsCm.width / 100;
  const dM = item.dimensionsCm.depth / 100;
  const effW = wM * cos + dM * sin;
  const effD = wM * sin + dM * cos;

  return {
    minX: item.position.x - effW / 2,
    maxX: item.position.x + effW / 2,
    minZ: item.position.z - effD / 2,
    maxZ: item.position.z + effD / 2,
  };
}

const NON_COLLIDING_KEYS = new Set([
  "area_rug",
  "ac_inverter",
  "smart_tv",
  "pegboard_goal_wall",
]);

export function evaluateErgonomicClearances(
  scenario: InteriorDesignScenario
): ErgonomicWarning[] {
  const warnings: ErgonomicWarning[] = [];
  const floorItems = scenario.items.filter((i) => !NON_COLLIDING_KEYS.has(i.catalogKey));

  // 1. Kiểm tra vượt biên mặt bằng căn hộ A.12A.07
  for (const item of floorItems) {
    const b = getFootprintBounds(item);
    if (
      b.minX < SKYONE_A2_BOUNDS.minX - 0.05 ||
      b.maxX > SKYONE_A2_BOUNDS.maxX + 0.05 ||
      b.minZ < SKYONE_A2_BOUNDS.minZ - 0.05 ||
      b.maxZ > SKYONE_A2_BOUNDS.maxZ + 0.05
    ) {
      warnings.push({
        id: `oob_${item.id}`,
        severity: "DANGER",
        itemId: item.id,
        itemName: item.name,
        message: `${item.name} đang chạm hoặc vượt ra ngoài biên tường căn hộ.`,
      });
    }

    // 2. Kiểm tra cản trở vùng mở cửa chính Lecmax 1.2m (x: 0.0..1.1, z: 2.8..3.6)
    if (
      item.source !== "DEVELOPER_INCLUDED" &&
      b.maxX > 0.15 &&
      b.minX < 1.05 &&
      b.maxZ > 2.85
    ) {
      warnings.push({
        id: `door_main_${item.id}`,
        severity: "DANGER",
        itemId: item.id,
        itemName: item.name,
        message: `${item.name} đang chắn khoảng mở cánh cửa chính Lecmax 1.2m.`,
      });
    }

    // 3. Kiểm tra cản trở lối mở cửa kính lùa Ban công (x: 1.2..3.2, z: -2.65..-2.15)
    if (
      item.roomId === "room_living_dining" &&
      b.minZ < -2.35 &&
      b.maxX > 1.3 &&
      b.minX < 3.1
    ) {
      warnings.push({
        id: `door_balcony_${item.id}`,
        severity: "WARNING",
        itemId: item.id,
        itemName: item.name,
        message: `${item.name} quá sát cửa lùa ban công 2.4m (nên chừa >= 30cm kéo rèm & lối ra).`,
      });
    }
  }

  // 4. Kiểm tra va chạm giữa 2 vật thể đặt sàn trong cùng khu vực
  for (let i = 0; i < floorItems.length; i++) {
    for (let j = i + 1; j < floorItems.length; j++) {
      const a = floorItems[i];
      const bItem = floorItems[j];
      // Bỏ qua cặp ghế công thái học sát bàn đôi hoặc tab đầu giường sát giường
      const isDeskChairPair =
        (a.catalogKey === "dual_workstation_desk" && bItem.catalogKey === "ergonomic_chair") ||
        (bItem.catalogKey === "dual_workstation_desk" && a.catalogKey === "ergonomic_chair");
      if (isDeskChairPair) continue;

      const ba = getFootprintBounds(a);
      const bb = getFootprintBounds(bItem);
      const overlapX = Math.min(ba.maxX, bb.maxX) - Math.max(ba.minX, bb.minX);
      const overlapZ = Math.min(ba.maxZ, bb.maxZ) - Math.max(ba.minZ, bb.minZ);
      if (overlapX > 0.08 && overlapZ > 0.08) {
        warnings.push({
          id: `overlap_${a.id}_${bItem.id}`,
          severity: "DANGER",
          itemId: a.id,
          itemName: a.name,
          message: `${a.name} đang chồng lấn với ${bItem.name} (${Math.round(Math.min(overlapX, overlapZ) * 100)} cm).`,
        });
      }
    }
  }

  // 5. Kiểm tra lối đi phòng khách (giữa Sofa và Bàn trà)
  const sofa = floorItems.find((i) => i.catalogKey === "sofa_3seat");
  const coffee = floorItems.find((i) => i.catalogKey === "coffee_table");
  if (sofa && coffee) {
    const bs = getFootprintBounds(sofa);
    const bc = getFootprintBounds(coffee);
    const gapCm = Math.round((bs.minX - bc.maxX) * 100);
    if (gapCm >= 0 && gapCm < 35) {
      warnings.push({
        id: "clearance_sofa_coffee",
        severity: "WARNING",
        itemId: coffee.id,
        itemName: coffee.name,
        message: `Khoảng cách Sofa ↔ Bàn trà hiện chỉ ${gapCm} cm (khuyến nghị công thái học 40–50 cm).`,
      });
    }
  }

  return warnings;
}

export interface HandoverReadinessInput {
  liquidCashVnd: number;
  monthlyNetSurplusVnd: number;
  goldLiquidationValueBidVnd: number;
  goldNhan9999BidPerChiVnd: number;
  interiorBoqTotalVnd: number;
  includePinkBook5Pct: boolean;
  monthsUntilHandover?: number;
}

export interface HandoverReadinessResult {
  monthsUntilHandover: number;
  maintenanceFee2PctVnd: number;
  pinkBook5PctVnd: number;
  interiorBoqTotalVnd: number;
  totalHandoverNeedVnd: number;
  currentLiquidCashVnd: number;
  projectedCashSurplusVnd: number;
  projectedCashAtHandoverVnd: number;
  goldLiquidationValueBidVnd: number;
  totalResourcesWithGoldVnd: number;
  cashOnlyGapVnd: number;
  combinedSurplusOrGapVnd: number;
  readinessPctCashOnly: number;
  readinessPctWithGold: number;
  suggestedGoldChiToSell: number;
  status: "READY_CASH_ONLY" | "READY_WITH_GOLD" | "NEED_MORE_SAVINGS";
}

export function calculateHandoverReadiness(
  input: HandoverReadinessInput
): HandoverReadinessResult {
  const monthsUntilHandover = Math.max(1, input.monthsUntilHandover ?? 9); // Từ T11/2026 -> T08/2027 = 9 tháng
  const maintenanceFee2PctVnd = SKYONE_A12A07_VERIFIED_FACTS.pricing.maintenanceFee2Pct; // 28.925.479 đ
  const pinkBook5PctVnd = input.includePinkBook5Pct
    ? SKYONE_A12A07_VERIFIED_FACTS.bidvLoan.pinkBook5PctAmount // 72.313.698 đ
    : 0;
  const totalHandoverNeedVnd =
    maintenanceFee2PctVnd + pinkBook5PctVnd + Math.max(0, input.interiorBoqTotalVnd);

  const safeCash = Math.max(0, input.liquidCashVnd);
  const projectedCashSurplusVnd = Math.max(0, input.monthlyNetSurplusVnd) * monthsUntilHandover;
  const projectedCashAtHandoverVnd = safeCash + projectedCashSurplusVnd;
  const totalResourcesWithGoldVnd =
    projectedCashAtHandoverVnd + Math.max(0, input.goldLiquidationValueBidVnd);

  const cashOnlyGapVnd = Math.max(0, totalHandoverNeedVnd - projectedCashAtHandoverVnd);
  const combinedSurplusOrGapVnd = totalResourcesWithGoldVnd - totalHandoverNeedVnd;

  const readinessPctCashOnly =
    totalHandoverNeedVnd > 0
      ? Math.min(100, Number(((projectedCashAtHandoverVnd / totalHandoverNeedVnd) * 100).toFixed(1)))
      : 100;
  const readinessPctWithGold =
    totalHandoverNeedVnd > 0
      ? Math.min(100, Number(((totalResourcesWithGoldVnd / totalHandoverNeedVnd) * 100).toFixed(1)))
      : 100;

  const suggestedGoldChiToSell =
    cashOnlyGapVnd > 0 && input.goldNhan9999BidPerChiVnd > 0
      ? Math.ceil((cashOnlyGapVnd / input.goldNhan9999BidPerChiVnd) * 2) / 2
      : 0;

  let status: HandoverReadinessResult["status"] = "READY_CASH_ONLY";
  if (cashOnlyGapVnd === 0) {
    status = "READY_CASH_ONLY";
  } else if (combinedSurplusOrGapVnd >= 0) {
    status = "READY_WITH_GOLD";
  } else {
    status = "NEED_MORE_SAVINGS";
  }

  return {
    monthsUntilHandover,
    maintenanceFee2PctVnd,
    pinkBook5PctVnd,
    interiorBoqTotalVnd: Math.max(0, input.interiorBoqTotalVnd),
    totalHandoverNeedVnd,
    currentLiquidCashVnd: safeCash,
    projectedCashSurplusVnd,
    projectedCashAtHandoverVnd,
    goldLiquidationValueBidVnd: Math.max(0, input.goldLiquidationValueBidVnd),
    totalResourcesWithGoldVnd,
    cashOnlyGapVnd,
    combinedSurplusOrGapVnd,
    readinessPctCashOnly,
    readinessPctWithGold,
    suggestedGoldChiToSell,
    status,
  };
}

function escapeCsvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export function exportBoqToCsv(scenario: InteriorDesignScenario, summary: ScenarioBoqSummary): void {
  const headers = [
    "STT",
    "Hạng mục",
    "Nhóm BOQ",
    "Nguồn",
    "Quy cách / Kích thước",
    "Thành tiền (VND)",
    "Trạng thái",
    "Ghi chú",
  ];

  const statusLabels: Record<InteriorFurnitureItem["procurementStatus"], string> = {
    PLANNED: "Dự kiến",
    QUOTED: "Đã báo giá",
    DEPOSITED: "Đã đặt cọc",
    INSTALLED: "Đã nghiệm thu",
  };

  const rows = summary.rows.map((row, idx) =>
    [
      String(idx + 1),
      escapeCsvCell(row.name),
      escapeCsvCell(BOQ_GROUP_META[row.boqGroup].label),
      escapeCsvCell(row.source === "DEVELOPER_INCLUDED" ? "CĐT Bàn Giao" : "Mua / Đóng mới"),
      escapeCsvCell(row.specLabel),
      String(row.totalPriceVnd),
      escapeCsvCell(statusLabels[row.procurementStatus]),
      escapeCsvCell(row.note || ""),
    ].join(",")
  );

  rows.push(
    ["", escapeCsvCell(`Dự phòng phát sinh (${scenario.contingencyPercent}%)`), "", "", "", String(summary.contingencyAmount), "", ""].join(",")
  );
  rows.push(
    ["", escapeCsvCell("TỔNG DỰ TOÁN TRỌN GÓI (VNĐ)"), "", "", "", String(summary.grandTotalWithContingency), "", ""].join(",")
  );

  const csvContent = "\uFEFF" + [headers.map(escapeCsvCell).join(","), ...rows].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `skyone_a12a07_boq_phuong_an_${scenario.code.toLowerCase()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
