import {
  InteriorBoqGroup,
  InteriorBoqPaymentRecord,
  InteriorDesignScenario,
  InteriorFurnitureItem,
  InteriorPricingRule,
} from "@/types/finance";
import {
  DOOR_MODE_META,
  FLOOR_PATTERN_META,
  SKYONE_A2_BOUNDS,
  SKYONE_A2_OPENINGS,
  SKYONE_A2_ROOMS,
  SKYONE_A2_WALLS,
  WALL_ACCENT_META,
  WALL_MODE_META,
} from "./interiorFloorplan";
import {
  checkDoorSwingCollision,
  detectItemWallOverlap,
  getFootprintBounds,
  isWallOrSurfaceMounted,
} from "./interiorCadEngine";
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

export const BOQ_PAYMENT_STAGE_META: Record<
  InteriorBoqPaymentRecord["stage"],
  { label: string; shortLabel: string }
> = {
  DEPOSIT: { label: "Đặt cọc sản xuất", shortLabel: "Cọc" },
  DELIVERY: { label: "Thanh toán giao hàng", shortLabel: "Giao hàng" },
  ACCEPTANCE: { label: "Nghiệm thu hoàn công", shortLabel: "Nghiệm thu" },
  OTHER: { label: "Thanh toán khác", shortLabel: "Khác" },
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

function resolveRowPaidAmountVnd(
  totalPriceVnd: number,
  procurementStatus: InteriorFurnitureItem["procurementStatus"],
  payments?: InteriorBoqPaymentRecord[]
): number {
  if (totalPriceVnd <= 0) return 0;
  if (payments && payments.length > 0) {
    return payments.reduce((sum, p) => sum + Math.max(0, Math.round(p.amountVnd)), 0);
  }
  // Backwards compatibility for legacy items marked DEPOSITED/INSTALLED without payments[]
  if (procurementStatus === "INSTALLED" || procurementStatus === "DEPOSITED") {
    return totalPriceVnd;
  }
  return 0;
}

export interface BoqUnifiedRow {
  id: string;
  origin: "3D_ITEM" | "EXTRA_LINE";
  name: string;
  roomId: string;
  boqGroup: InteriorBoqGroup;
  source: InteriorFurnitureItem["source"];
  specLabel: string;
  pricingRule?: InteriorPricingRule;
  unitPriceVnd: number;
  quantity?: number;
  unit?: string;
  totalPriceVnd: number;
  paidAmountVnd: number;
  remainingAmountVnd: number;
  payments: InteriorBoqPaymentRecord[];
  procurementStatus: InteriorFurnitureItem["procurementStatus"];
  linkedTransactionId?: string;
  vendorName?: string;
  leadTimeDays?: number;
  warrantyMonths?: number;
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

    const payments = item.payments ?? [];
    const paidAmountVnd = resolveRowPaidAmountVnd(
      totalPriceVnd,
      item.procurementStatus,
      payments
    );
    const remainingAmountVnd = Math.max(0, totalPriceVnd - paidAmountVnd);
    paidOrDepositedVnd += paidAmountVnd;

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
      pricingRule: item.pricingRule,
      unitPriceVnd: item.unitPriceVnd,
      totalPriceVnd,
      paidAmountVnd,
      remainingAmountVnd,
      payments,
      procurementStatus: item.procurementStatus,
      linkedTransactionId: item.linkedTransactionId,
      vendorName: item.vendorName,
      leadTimeDays: item.leadTimeDays,
      warrantyMonths: item.warrantyMonths,
      note: item.note,
    };
  });

  const extraRows: BoqUnifiedRow[] = scenario.extraBoqItems.map((ex) => {
    const totalPriceVnd =
      ex.source === "DEVELOPER_INCLUDED" ? 0 : Math.round(ex.quantity * ex.unitPriceVnd);
    byGroup[ex.boqGroup] += totalPriceVnd;

    const payments = ex.payments ?? [];
    const paidAmountVnd = resolveRowPaidAmountVnd(
      totalPriceVnd,
      ex.procurementStatus,
      payments
    );
    const remainingAmountVnd = Math.max(0, totalPriceVnd - paidAmountVnd);
    paidOrDepositedVnd += paidAmountVnd;

    return {
      id: ex.id,
      origin: "EXTRA_LINE",
      name: ex.name,
      roomId: ex.roomId,
      boqGroup: ex.boqGroup,
      source: ex.source,
      specLabel: `${ex.quantity} ${ex.unit}`,
      unitPriceVnd: ex.unitPriceVnd,
      quantity: ex.quantity,
      unit: ex.unit,
      totalPriceVnd,
      paidAmountVnd,
      remainingAmountVnd,
      payments,
      procurementStatus: ex.procurementStatus,
      linkedTransactionId: ex.linkedTransactionId,
      vendorName: ex.vendorName,
      leadTimeDays: ex.leadTimeDays,
      warrantyMonths: ex.warrantyMonths,
      note: ex.note,
    };
  });

  // Hạng mục cải tạo kiến trúc tự động sinh khi người dùng tùy biến Vách / Accent Wall / Cửa lùa / Sàn xương cá
  const archRenovationRows: BoqUnifiedRow[] = [];

  if (scenario.wallOverrides) {
    for (const wall of SKYONE_A2_WALLS) {
      const ov = scenario.wallOverrides[wall.id];
      if (!ov) continue;

      if (!wall.structural && ov.mode && ov.mode !== "SOLID") {
        const meta = WALL_MODE_META[ov.mode];
        if (meta && meta.estimatedCostVnd > 0) {
          byGroup.FINISHING_DECOR += meta.estimatedCostVnd;
          archRenovationRows.push({
            id: `arch_wall_mode_${wall.id}`,
            origin: "EXTRA_LINE",
            name: `Cải tạo ${wall.label}: ${meta.label}`,
            roomId: wall.id === "w_kitchen_shield" ? "room_kitchen" : "room_05",
            boqGroup: "FINISHING_DECOR",
            source: "NEW_PURCHASE",
            specLabel: "1 hệ vách (tự động từ 3D)",
            unitPriceVnd: meta.estimatedCostVnd,
            quantity: 1,
            unit: "hệ",
            totalPriceVnd: meta.estimatedCostVnd,
            paidAmountVnd: 0,
            remainingAmountVnd: meta.estimatedCostVnd,
            payments: [],
            procurementStatus: "PLANNED",
            note: meta.description,
          });
        }
      }

      if (ov.accentFinish && ov.accentFinish !== "DEFAULT" && ov.mode !== "OPEN") {
        const acc = WALL_ACCENT_META[ov.accentFinish];
        if (acc && acc.estimatedCostVnd > 0) {
          byGroup.FINISHING_DECOR += acc.estimatedCostVnd;
          archRenovationRows.push({
            id: `arch_wall_accent_${wall.id}`,
            origin: "EXTRA_LINE",
            name: `Ốp điểm nhấn ${wall.label}: ${acc.label}`,
            roomId: "room_living_dining",
            boqGroup: "FINISHING_DECOR",
            source: "NEW_PURCHASE",
            specLabel: "1 mảng tường (tự động từ 3D)",
            unitPriceVnd: acc.estimatedCostVnd,
            quantity: 1,
            unit: "mảng",
            totalPriceVnd: acc.estimatedCostVnd,
            paidAmountVnd: 0,
            remainingAmountVnd: acc.estimatedCostVnd,
            payments: [],
            procurementStatus: "PLANNED",
            note: "Tự động đồng bộ từ tùy biến Accent Wall trong Studio",
          });
        }
      }
    }
  }

  if (scenario.doorOverrides) {
    for (const op of SKYONE_A2_OPENINGS) {
      const mode = scenario.doorOverrides[op.id];
      if (!mode || mode === "SWING_90") continue;
      const meta = DOOR_MODE_META[mode];
      if (meta && meta.estimatedCostVnd > 0) {
        byGroup.FINISHING_DECOR += meta.estimatedCostVnd;
        archRenovationRows.push({
          id: `arch_door_${op.id}`,
          origin: "EXTRA_LINE",
          name: `Đổi ${op.label} → ${meta.shortLabel}`,
          roomId:
            op.id === "op_master_door"
              ? "room_master"
              : op.id === "op_wc_door"
                ? "room_wc"
                : "room_05",
          boqGroup: "FINISHING_DECOR",
          source: "NEW_PURCHASE",
          specLabel: "1 bộ cửa (tự động từ 3D)",
          unitPriceVnd: meta.estimatedCostVnd,
          quantity: 1,
          unit: "bộ",
          totalPriceVnd: meta.estimatedCostVnd,
          paidAmountVnd: 0,
          remainingAmountVnd: meta.estimatedCostVnd,
          payments: [],
          procurementStatus: "PLANNED",
          note: meta.description,
        });
      }
    }
  }

  if (scenario.roomFloorOverrides) {
    for (const [roomId, pattern] of Object.entries(scenario.roomFloorOverrides)) {
      if (pattern !== "HERRINGBONE") continue;
      const meta = FLOOR_PATTERN_META[pattern];
      const room = SKYONE_A2_ROOMS.find((r) => r.id === roomId);
      if (meta && meta.estimatedCostVnd > 0) {
        byGroup.FINISHING_DECOR += meta.estimatedCostVnd;
        archRenovationRows.push({
          id: `arch_floor_${roomId}`,
          origin: "EXTRA_LINE",
          name: `Nâng cấp sàn ${room?.shortName ?? roomId}: ${meta.label}`,
          roomId,
          boqGroup: "FINISHING_DECOR",
          source: "NEW_PURCHASE",
          specLabel: "1 phòng (tự động từ 3D)",
          unitPriceVnd: meta.estimatedCostVnd,
          quantity: 1,
          unit: "phòng",
          totalPriceVnd: meta.estimatedCostVnd,
          paidAmountVnd: 0,
          remainingAmountVnd: meta.estimatedCostVnd,
          payments: [],
          procurementStatus: "PLANNED",
          note: "Lót sàn gỗ xương cá nâng chiều sâu thẩm mỹ căn hộ",
        });
      }
    }
  }

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
    rows: [...itemRows, ...extraRows, ...archRenovationRows],
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

export interface ScenarioDiffEntry {
  key: string;
  name: string;
  boqGroup: InteriorBoqGroup;
  kind: "ONLY_IN_BASE" | "ONLY_IN_COMPARE" | "CHANGED_COST";
  baseCostVnd: number;
  compareCostVnd: number;
  deltaVnd: number;
  baseSpec?: string;
  compareSpec?: string;
}

export interface ScenarioDiffSummary {
  baseScenarioId: string;
  compareScenarioId: string;
  baseTotalVnd: number;
  compareTotalVnd: number;
  netDeltaVnd: number;
  groupDeltas: Record<InteriorBoqGroup, number>;
  entries: ScenarioDiffEntry[];
}

/**
 * Đối chiếu chênh lệch chi tiết từng hạng mục giữa 2 Phương án (VD: PA-A vs PA-B).
 */
export function compareInteriorScenarios(
  baseScenario: InteriorDesignScenario,
  compareScenario: InteriorDesignScenario
): ScenarioDiffSummary {
  const baseBoq = calculateScenarioBoq(baseScenario);
  const compareBoq = calculateScenarioBoq(compareScenario);

  const baseMap = new Map<string, BoqUnifiedRow>();
  for (const r of baseBoq.rows) {
    baseMap.set(`${r.origin}_${r.id}`, r);
  }
  const compareMap = new Map<string, BoqUnifiedRow>();
  for (const r of compareBoq.rows) {
    compareMap.set(`${r.origin}_${r.id}`, r);
  }

  const entries: ScenarioDiffEntry[] = [];
  const allKeys = new Set([...baseMap.keys(), ...compareMap.keys()]);

  for (const key of allKeys) {
    const a = baseMap.get(key);
    const b = compareMap.get(key);
    if (a && !b) {
      entries.push({
        key,
        name: a.name,
        boqGroup: a.boqGroup,
        kind: "ONLY_IN_BASE",
        baseCostVnd: a.totalPriceVnd,
        compareCostVnd: 0,
        deltaVnd: -a.totalPriceVnd,
        baseSpec: a.specLabel,
      });
    } else if (!a && b) {
      entries.push({
        key,
        name: b.name,
        boqGroup: b.boqGroup,
        kind: "ONLY_IN_COMPARE",
        baseCostVnd: 0,
        compareCostVnd: b.totalPriceVnd,
        deltaVnd: b.totalPriceVnd,
        compareSpec: b.specLabel,
      });
    } else if (a && b && a.totalPriceVnd !== b.totalPriceVnd) {
      entries.push({
        key,
        name: b.name,
        boqGroup: b.boqGroup,
        kind: "CHANGED_COST",
        baseCostVnd: a.totalPriceVnd,
        compareCostVnd: b.totalPriceVnd,
        deltaVnd: b.totalPriceVnd - a.totalPriceVnd,
        baseSpec: a.specLabel,
        compareSpec: b.specLabel,
      });
    }
  }

  entries.sort((x, y) => Math.abs(y.deltaVnd) - Math.abs(x.deltaVnd));

  return {
    baseScenarioId: baseScenario.id,
    compareScenarioId: compareScenario.id,
    baseTotalVnd: baseBoq.grandTotalWithContingency,
    compareTotalVnd: compareBoq.grandTotalWithContingency,
    netDeltaVnd: compareBoq.grandTotalWithContingency - baseBoq.grandTotalWithContingency,
    groupDeltas: {
      WOOD_FURNITURE: compareBoq.byGroup.WOOD_FURNITURE - baseBoq.byGroup.WOOD_FURNITURE,
      APPLIANCES: compareBoq.byGroup.APPLIANCES - baseBoq.byGroup.APPLIANCES,
      FINISHING_DECOR: compareBoq.byGroup.FINISHING_DECOR - baseBoq.byGroup.FINISHING_DECOR,
      DEVELOPER_INCLUDED: 0,
    },
    entries,
  };
}

export interface ErgonomicWarning {
  id: string;
  severity: "WARNING" | "DANGER";
  itemId: string;
  itemName: string;
  message: string;
}

const NON_COLLIDING_KEYS = new Set([
  "area_rug",
  "ac_inverter",
  "smart_tv",
  "pegboard_goal_wall",
  "wall_art_duo",
  "pendant_dining_light",
  "loggia_drying_rack",
  "fridge_top_cabinet",
  "dual_monitor_arm",
  "desk_lamp_screenbar",
]);

export function evaluateErgonomicClearances(
  scenario: InteriorDesignScenario
): ErgonomicWarning[] {
  const warnings: ErgonomicWarning[] = [];
  const floorItems = scenario.items.filter(
    (i) => !NON_COLLIDING_KEYS.has(i.catalogKey) && !isWallOrSurfaceMounted(i)
  );

  for (const item of floorItems) {
    const b = getFootprintBounds(item);

    // 1. Vượt biên mặt bằng căn hộ A.12A.07
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

    // 2. Đè lên vách ngăn phòng / tường nội bộ (Cảnh báo đỏ theo quyết định thiết kế)
    const wallHit = detectItemWallOverlap(item, scenario.wallOverrides);
    if (wallHit) {
      warnings.push({
        id: `wall_overlap_${item.id}`,
        severity: "DANGER",
        itemId: item.id,
        itemName: item.name,
        message: `${item.name} đang đè lên vách ngăn/tường (${wallHit.overlapCm} cm) — kéo nhẹ để hít sát mép tường.`,
      });
    }

    // 3. Cản trở cung mở cửa 90° (Cửa chính Lecmax, Master, Phòng 05, WC, Lô gia)
    const doorHit = checkDoorSwingCollision(item, scenario.doorOverrides);
    if (doorHit) {
      warnings.push({
        id: `door_swing_${doorHit.openingId}_${item.id}`,
        severity: doorHit.isMainDoor ? "DANGER" : "WARNING",
        itemId: item.id,
        itemName: item.name,
        message: `${item.name} đang chắn cung mở 90° của ${doorHit.openingLabel}.`,
      });
    }

    // 4. Cản trở lối mở cửa kính lùa Ban công (x: 1.2..3.2, z: -2.65..-2.15)
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

  // 5. Va chạm giữa 2 vật thể đặt sàn
  for (let i = 0; i < floorItems.length; i++) {
    for (let j = i + 1; j < floorItems.length; j++) {
      const a = floorItems[i];
      const bItem = floorItems[j];
      const isDeskChairPair =
        ((a.catalogKey === "dual_workstation_desk" || a.catalogKey === "single_desk") &&
          bItem.catalogKey === "ergonomic_chair") ||
        ((bItem.catalogKey === "dual_workstation_desk" || bItem.catalogKey === "single_desk") &&
          a.catalogKey === "ergonomic_chair");
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

  // 6. Công thái học Phòng khách: Sofa ↔ Bàn trà & Mắt ↔ Smart TV 55"
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

  const tv = scenario.items.find((i) => i.catalogKey === "smart_tv");
  if (sofa && tv) {
    const eyeToTvCm = Math.round(
      Math.hypot(sofa.position.x - tv.position.x, sofa.position.z - tv.position.z) * 100
    );
    if (eyeToTvCm < 175) {
      warnings.push({
        id: "ergo_tv_too_close",
        severity: "WARNING",
        itemId: tv.id,
        itemName: tv.name,
        message: `Khoảng cách Sofa ↔ Smart TV 55" chỉ ${eyeToTvCm} cm (nên giữ 200–270 cm để bảo vệ mắt).`,
      });
    }
  }

  // 7. Khoảng mở cánh tủ quần áo Master (>= 55cm tới giường)
  const masterBed = floorItems.find((i) => i.catalogKey === "bed_master_160");
  const masterWardrobe = floorItems.find((i) => i.catalogKey === "wardrobe_tall");
  if (masterBed && masterWardrobe) {
    const bBed = getFootprintBounds(masterBed);
    const bWard = getFootprintBounds(masterWardrobe);
    const gapCm = Math.round((bWard.minZ - bBed.maxZ) * 100);
    if (gapCm >= 0 && gapCm < 50) {
      warnings.push({
        id: "clearance_master_wardrobe",
        severity: "WARNING",
        itemId: masterWardrobe.id,
        itemName: masterWardrobe.name,
        message: `Khoảng mở cánh Tủ áo Master ↔ Giường chỉ ${gapCm} cm (nên >= 55 cm hoặc đổi sang cánh lùa).`,
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
  /** Tổng dự toán BOQ (Gross) hoặc số còn phải trả nếu không truyền interiorBoqPaidVnd */
  interiorBoqTotalVnd: number;
  /** Số tiền nội thất đã thanh toán/đặt cọc thực tế (đã trừ khỏi liquidCashVnd) — tránh tính trùng */
  interiorBoqPaidVnd?: number;
  includePinkBook5Pct: boolean;
  monthsUntilHandover?: number;
}

export interface HandoverReadinessResult {
  monthsUntilHandover: number;
  maintenanceFee2PctVnd: number;
  pinkBook5PctVnd: number;
  /** Tổng BOQ trọn gói (trước khi trừ phần đã chi) */
  interiorBoqGrossTotalVnd: number;
  /** Số tiền BOQ đã thanh toán/đặt cọc */
  interiorBoqPaidVnd: number;
  /** Phần BOQ còn phải chi thêm (= max(0, gross - paid)) */
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
  const monthsUntilHandover = Math.max(1, input.monthsUntilHandover ?? 9);
  const maintenanceFee2PctVnd = SKYONE_A12A07_VERIFIED_FACTS.pricing.maintenanceFee2Pct; // 28.925.479 đ
  const pinkBook5PctVnd = input.includePinkBook5Pct
    ? SKYONE_A12A07_VERIFIED_FACTS.bidvLoan.pinkBook5PctAmount // 72.313.698 đ
    : 0;

  const interiorBoqGrossTotalVnd = Math.max(0, input.interiorBoqTotalVnd);
  const interiorBoqPaidVnd = Math.min(
    interiorBoqGrossTotalVnd,
    Math.max(0, input.interiorBoqPaidVnd ?? 0)
  );
  const interiorBoqRemainingVnd = Math.max(0, interiorBoqGrossTotalVnd - interiorBoqPaidVnd);

  // Loại bỏ double-counting: chỉ cộng phần BOQ còn phải chi thêm vào nhu cầu tiền mặt còn lại
  const totalHandoverNeedVnd =
    maintenanceFee2PctVnd + pinkBook5PctVnd + interiorBoqRemainingVnd;

  const safeCash = Math.max(0, input.liquidCashVnd);
  const projectedCashSurplusVnd = Math.max(0, input.monthlyNetSurplusVnd) * monthsUntilHandover;
  const projectedCashAtHandoverVnd = safeCash + projectedCashSurplusVnd;
  const totalResourcesWithGoldVnd =
    projectedCashAtHandoverVnd + Math.max(0, input.goldLiquidationValueBidVnd);

  const cashOnlyGapVnd = Math.max(0, totalHandoverNeedVnd - projectedCashAtHandoverVnd);
  const combinedSurplusOrGapVnd = totalResourcesWithGoldVnd - totalHandoverNeedVnd;

  const readinessPctCashOnly =
    totalHandoverNeedVnd > 0
      ? Math.min(
          100,
          Number(((projectedCashAtHandoverVnd / totalHandoverNeedVnd) * 100).toFixed(1))
        )
      : 100;
  const readinessPctWithGold =
    totalHandoverNeedVnd > 0
      ? Math.min(
          100,
          Number(((totalResourcesWithGoldVnd / totalHandoverNeedVnd) * 100).toFixed(1))
        )
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
    interiorBoqGrossTotalVnd,
    interiorBoqPaidVnd,
    interiorBoqTotalVnd: interiorBoqRemainingVnd,
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
    "Đơn giá (VND)",
    "Thành tiền (VND)",
    "Đã thanh toán (VND)",
    "Còn lại (VND)",
    "Nhà cung cấp",
    "Lead time (ngày)",
    "Bảo hành (tháng)",
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
      String(row.unitPriceVnd),
      String(row.totalPriceVnd),
      String(row.paidAmountVnd),
      String(row.remainingAmountVnd),
      escapeCsvCell(row.vendorName || ""),
      row.leadTimeDays ? String(row.leadTimeDays) : "",
      row.warrantyMonths ? String(row.warrantyMonths) : "",
      escapeCsvCell(statusLabels[row.procurementStatus]),
      escapeCsvCell(row.note || ""),
    ].join(",")
  );

  rows.push(
    [
      "",
      escapeCsvCell(`Dự phòng phát sinh (${scenario.contingencyPercent}%)`),
      "",
      "",
      "",
      "",
      String(summary.contingencyAmount),
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ].join(",")
  );
  rows.push(
    [
      "",
      escapeCsvCell("TỔNG DỰ TOÁN TRỌN GÓI (VNĐ)"),
      "",
      "",
      "",
      "",
      String(summary.grandTotalWithContingency),
      String(summary.paidOrDepositedVnd),
      String(summary.remainingToPayVnd),
      "",
      "",
      "",
      "",
      "",
    ].join(",")
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
