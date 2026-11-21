import {
  GoldPortfolioState,
  InteriorBoqGroup,
  InteriorBoqPaymentRecord,
  InteriorCameraPresetId,
  InteriorDesignScenario,
  InteriorExecutionPhase,
  InteriorFurnitureItem,
  InteriorPricingRule,
} from "@/types/finance";
import { simulateGoldLiquidation } from "./goldEngine";
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

export const EXECUTION_PHASE_META: Record<
  InteriorExecutionPhase,
  { label: string; shortLabel: string; description: string }
> = {
  PHASE_1_MOVE_IN: {
    label: "GĐ 1 · Nhận nhà bắt buộc",
    shortLabel: "GĐ 1 (Nhận nhà)",
    description: "Hạng mục thiết yếu để dọn vào ở ngay Q3/2027",
  },
  PHASE_2_UPGRADE: {
    label: "GĐ 2 · Nâng cấp sau 6–12 tháng",
    shortLabel: "GĐ 2 (Hoãn mua)",
    description: "Có thể trì hoãn để giữ lại tiền mặt & Kho Vàng lúc nhận nhà",
  },
};

export interface BoqUnifiedRow {
  id: string;
  origin: "3D_ITEM" | "EXTRA_LINE";
  name: string;
  roomId: string;
  boqGroup: InteriorBoqGroup;
  executionPhase: InteriorExecutionPhase;
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
  /** Value Engineering: chỉ các hạng mục Giai đoạn 1 (Nhận nhà bắt buộc) */
  phase1Subtotal: number;
  phase1ContingencyAmount: number;
  phase1GrandTotalWithContingency: number;
  phase2DeferredTotal: number;
  phase2ItemCount: number;
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
      executionPhase: item.executionPhase ?? "PHASE_1_MOVE_IN",
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
      executionPhase: ex.executionPhase ?? "PHASE_1_MOVE_IN",
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
            executionPhase: "PHASE_1_MOVE_IN",
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
            executionPhase: "PHASE_1_MOVE_IN",
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
          executionPhase: "PHASE_1_MOVE_IN",
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
          executionPhase: "PHASE_1_MOVE_IN",
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

  const allRows = [...itemRows, ...extraRows, ...archRenovationRows];
  const subtotalNewPurchase =
    byGroup.WOOD_FURNITURE + byGroup.APPLIANCES + byGroup.FINISHING_DECOR;
  const contingencyRate = (scenario.contingencyPercent || 0) / 100;
  const contingencyAmount = Math.round(subtotalNewPurchase * contingencyRate);
  const grandTotalWithContingency = subtotalNewPurchase + contingencyAmount;

  let phase1Subtotal = 0;
  let phase2DeferredTotal = 0;
  let phase2ItemCount = 0;
  for (const row of allRows) {
    if (row.source === "DEVELOPER_INCLUDED" || row.totalPriceVnd <= 0) continue;
    if (row.executionPhase === "PHASE_2_UPGRADE") {
      phase2DeferredTotal += row.totalPriceVnd;
      phase2ItemCount += 1;
    } else {
      phase1Subtotal += row.totalPriceVnd;
    }
  }
  const phase1ContingencyAmount = Math.round(phase1Subtotal * contingencyRate);
  const phase1GrandTotalWithContingency = phase1Subtotal + phase1ContingencyAmount;

  let budgetStatus: ScenarioBoqSummary["budgetStatus"] = "IN_TARGET_RANGE";
  if (grandTotalWithContingency < scenario.targetBudgetMinVnd) {
    budgetStatus = "UNDER_BUDGET";
  } else if (grandTotalWithContingency > scenario.targetBudgetMaxVnd) {
    budgetStatus = "OVER_BUDGET";
  }

  return {
    scenarioId: scenario.id,
    rows: allRows,
    byGroup,
    woodFurnitureTotal: byGroup.WOOD_FURNITURE,
    appliancesTotal: byGroup.APPLIANCES,
    finishingDecorTotal: byGroup.FINISHING_DECOR,
    developerIncludedCount,
    subtotalNewPurchase,
    contingencyAmount,
    grandTotalWithContingency,
    phase1Subtotal,
    phase1ContingencyAmount,
    phase1GrandTotalWithContingency,
    phase2DeferredTotal,
    phase2ItemCount,
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
  basePhase1TotalVnd: number;
  comparePhase1TotalVnd: number;
  phase1DeltaVnd: number;
  ergonomicPassCountA: number;
  ergonomicPassCountB: number;
  ergonomicTotalChecks: number;
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
  const auditA = evaluateArchitecturalAudit(baseScenario);
  const auditB = evaluateArchitecturalAudit(compareScenario);

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
    basePhase1TotalVnd: baseBoq.phase1GrandTotalWithContingency,
    comparePhase1TotalVnd: compareBoq.phase1GrandTotalWithContingency,
    phase1DeltaVnd:
      compareBoq.phase1GrandTotalWithContingency - baseBoq.phase1GrandTotalWithContingency,
    ergonomicPassCountA: auditA.passCount,
    ergonomicPassCountB: auditB.passCount,
    ergonomicTotalChecks: auditA.totalChecks,
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
    "Giai đoạn (Value Engineering)",
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
      escapeCsvCell(EXECUTION_PHASE_META[row.executionPhase].shortLabel),
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
      escapeCsvCell("TỔNG DỰ TOÁN GIAI ĐOẠN 1 (NHẬN NHÀ BẮT BUỘC + DỰ PHÒNG)"),
      "",
      escapeCsvCell("GĐ 1"),
      "",
      "",
      "",
      String(summary.phase1GrandTotalWithContingency),
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

// ============================================================================
// PRIORITY 2 & 3 — QUANTITATIVE ARCHITECTURAL AUDIT & 4-MILESTONE PAYMENT PLAN
// ============================================================================

export interface ArchitecturalAuditCheck {
  id: string;
  title: string;
  measuredLabel: string;
  targetLabel: string;
  status: "PASS" | "WARNING" | "DANGER";
  detail: string;
  itemId?: string;
  cameraPreset: InteriorCameraPresetId;
}

export interface ArchitecturalAuditReport {
  checks: ArchitecturalAuditCheck[];
  passCount: number;
  warningCount: number;
  dangerCount: number;
  totalChecks: number;
  footprintCoveragePct: number;
}

/**
 * Kiểm định Công thái học & Kiến trúc định lượng (6 tiêu chí đo trực tiếp theo mm và % mặt bằng thực tế).
 */
export function evaluateArchitecturalAudit(
  scenario: InteriorDesignScenario
): ArchitecturalAuditReport {
  const warnings = evaluateErgonomicClearances(scenario);
  const floorItems = scenario.items.filter(
    (i) => !i.isHidden && !NON_COLLIDING_KEYS.has(i.catalogKey) && !isWallOrSurfaceMounted(i)
  );

  const checks: ArchitecturalAuditCheck[] = [];

  // 1. Kiểm tra va chạm tường, vượt biên & cung mở cửa 90°
  const structuralHits = warnings.filter(
    (w) =>
      w.id.startsWith("oob_") ||
      w.id.startsWith("wall_overlap_") ||
      w.id.startsWith("door_swing_") ||
      w.id.startsWith("overlap_")
  );
  const severeHits = structuralHits.filter((w) => w.severity === "DANGER");
  checks.push({
    id: "audit_collisions_doors",
    title: "Va chạm vật thể, vách ngăn & cung mở cửa 90°",
    measuredLabel:
      structuralHits.length === 0 ? "0 xung đột" : `${structuralHits.length} điểm xung đột`,
    targetLabel: "0 xung đột",
    status: severeHits.length > 0 ? "DANGER" : structuralHits.length > 0 ? "WARNING" : "PASS",
    detail:
      structuralHits.length === 0
        ? "Tất cả nội thất đặt sàn đều lọt lòng phòng và thông thoáng cung mở cửa."
        : structuralHits[0].message,
    itemId: structuralHits[0]?.itemId,
    cameraPreset: "DOLLHOUSE",
  });

  // 2. Khoảng cách mắt Sofa ↔ Smart TV (Phòng khách)
  const sofa = floorItems.find(
    (i) => i.catalogKey === "sofa_3seat" || i.catalogKey === "sofa_bed_smart"
  );
  const tv = scenario.items.find((i) => !i.isHidden && i.catalogKey === "smart_tv");
  if (sofa && tv) {
    const distMm = Math.round(
      Math.hypot(sofa.position.x - tv.position.x, sofa.position.z - tv.position.z) * 1000
    );
    const tvStatus: ArchitecturalAuditCheck["status"] =
      distMm < 1750 ? "DANGER" : distMm < 2000 || distMm > 3200 ? "WARNING" : "PASS";
    checks.push({
      id: "audit_sofa_tv",
      title: 'Khoảng cách nhìn Sofa ↔ Smart TV 55"',
      measuredLabel: `${distMm.toLocaleString("vi-VN")} mm`,
      targetLabel: "2.000 – 2.800 mm",
      status: tvStatus,
      detail:
        tvStatus === "PASS"
          ? "Khoảng cách nhìn chuẩn bảo vệ mắt và góc nhìn rộng 30° cho màn hình 55 inch."
          : "Nên kéo lùi Sofa hoặc chọn TV 50\"–55\" để đạt khoảng cách 2.000–2.800 mm.",
      itemId: tv.id,
      cameraPreset: "LIVING_BALCONY",
    });
  } else {
    checks.push({
      id: "audit_sofa_tv",
      title: 'Khoảng cách nhìn Sofa ↔ Smart TV 55"',
      measuredLabel: "Chưa đủ cặp đồ",
      targetLabel: "2.000 – 2.800 mm",
      status: "PASS",
      detail: "Thêm Sofa và Smart TV để hệ thống tự đo khoảng cách tầm mắt.",
      cameraPreset: "LIVING_BALCONY",
    });
  }

  // 3. Lối đi Sofa ↔ Bàn trà
  const coffee = floorItems.find((i) => i.catalogKey === "coffee_table");
  if (sofa && coffee) {
    const bs = getFootprintBounds(sofa);
    const bc = getFootprintBounds(coffee);
    const gapX = Math.max(bs.minX - bc.maxX, bc.minX - bs.maxX);
    const gapZ = Math.max(bs.minZ - bc.maxZ, bc.minZ - bs.maxZ);
    const clearMm = Math.round(Math.max(0, Math.max(gapX, gapZ)) * 1000);
    const coffeeStatus: ArchitecturalAuditCheck["status"] =
      clearMm < 320 ? "DANGER" : clearMm < 400 || clearMm > 680 ? "WARNING" : "PASS";
    checks.push({
      id: "audit_sofa_coffee",
      title: "Khe để chân Sofa ↔ Bàn trà",
      measuredLabel: `${clearMm.toLocaleString("vi-VN")} mm`,
      targetLabel: "400 – 550 mm",
      status: coffeeStatus,
      detail:
        coffeeStatus === "PASS"
          ? "Lối lách chân và tầm với lấy tách trà vừa vặn thoải mái."
          : "Điều chỉnh bàn trà cách mép sofa 400–550 mm để dễ đi lại.",
      itemId: coffee.id,
      cameraPreset: "LIVING_BALCONY",
    });
  } else {
    checks.push({
      id: "audit_sofa_coffee",
      title: "Khe để chân Sofa ↔ Bàn trà",
      measuredLabel: "Không đặt bàn trà",
      targetLabel: "400 – 550 mm",
      status: "PASS",
      detail: "Không gian phòng khách mở thoáng tối đa.",
      cameraPreset: "LIVING_BALCONY",
    });
  }

  // 4. Khoảng mở cánh Tủ áo Master ↔ Giường Master
  const masterBed = floorItems.find(
    (i) => i.catalogKey === "bed_master_160" || i.catalogKey === "bed_compact_140"
  );
  const masterWardrobe = floorItems.find(
    (i) => i.roomId === "room_master" && (i.catalogKey === "wardrobe_tall" || i.catalogKey === "wardrobe_compact")
  );
  if (masterBed && masterWardrobe) {
    const bBed = getFootprintBounds(masterBed);
    const bWard = getFootprintBounds(masterWardrobe);
    const gapZ = Math.max(bWard.minZ - bBed.maxZ, bBed.minZ - bWard.maxZ);
    const gapX = Math.max(bWard.minX - bBed.maxX, bBed.minX - bWard.maxX);
    const clearMm = Math.round(Math.max(0, Math.max(gapZ, gapX)) * 1000);
    const wardStatus: ArchitecturalAuditCheck["status"] =
      clearMm < 450 ? "DANGER" : clearMm < 580 ? "WARNING" : "PASS";
    checks.push({
      id: "audit_master_wardrobe",
      title: "Lối đi & mở cánh Tủ áo Master ↔ Giường",
      measuredLabel: `${clearMm.toLocaleString("vi-VN")} mm`,
      targetLabel: "≥ 580 mm (hoặc cửa lùa)",
      status: wardStatus,
      detail:
        wardStatus === "PASS"
          ? "Đủ không gian đứng thay đồ và mở cánh tủ quần áo."
          : "Khe tủ áo hơi hẹp — cân nhắc dùng tủ cánh lùa hoặc dịch giường sát vách kính.",
      itemId: masterWardrobe.id,
      cameraPreset: "MASTER_BEDROOM",
    });
  } else {
    checks.push({
      id: "audit_master_wardrobe",
      title: "Lối đi & mở cánh Tủ áo Master ↔ Giường",
      measuredLabel: "Thông thoáng",
      targetLabel: "≥ 580 mm",
      status: "PASS",
      detail: "Chưa phát sinh cản trở tủ quần áo tại phòng ngủ Master.",
      cameraPreset: "MASTER_BEDROOM",
    });
  }

  // 5. Tam giác công năng Bếp (Bếp chữ L ↔ Tủ lạnh ↔ Bàn ăn)
  const kitchen = floorItems.find((i) => i.catalogKey === "kitchen_l_hafele");
  const fridge = floorItems.find((i) => i.catalogKey === "fridge_inverter");
  const dining = floorItems.find(
    (i) => i.catalogKey === "dining_set_4" || i.catalogKey === "folding_dining_table"
  );
  if (kitchen && fridge && dining) {
    const d1 = Math.hypot(kitchen.position.x - fridge.position.x, kitchen.position.z - fridge.position.z);
    const d2 = Math.hypot(fridge.position.x - dining.position.x, fridge.position.z - dining.position.z);
    const d3 = Math.hypot(dining.position.x - kitchen.position.x, dining.position.z - kitchen.position.z);
    const perimeterMm = Math.round((d1 + d2 + d3) * 1000);
    const kitchenStatus: ArchitecturalAuditCheck["status"] =
      perimeterMm < 2400 || perimeterMm > 8500 ? "WARNING" : "PASS";
    checks.push({
      id: "audit_kitchen_triangle",
      title: "Chu vi Tam giác Bếp – Tủ lạnh – Bàn ăn",
      measuredLabel: `${perimeterMm.toLocaleString("vi-VN")} mm`,
      targetLabel: "2.400 – 8.500 mm",
      status: kitchenStatus,
      detail:
        kitchenStatus === "PASS"
          ? "Luồng di chuyển lấy thực phẩm, sơ chế và dọn mâm gọn gàng hợp lý."
          : "Bố cục bếp và bàn ăn khá xa/sát nhau, cân nhắc kéo gọn để tiện thao tác nấu nướng.",
      itemId: dining.id,
      cameraPreset: "KITCHEN_DINING",
    });
  } else {
    checks.push({
      id: "audit_kitchen_triangle",
      title: "Chu vi Tam giác Bếp – Tủ lạnh – Bàn ăn",
      measuredLabel: "Đạt cơ bản",
      targetLabel: "2.400 – 8.500 mm",
      status: "PASS",
      detail: "Cụm bếp bàn giao CĐT kết nối trực tiếp khu ăn uống.",
      cameraPreset: "KITCHEN_DINING",
    });
  }

  // 6. Tỷ lệ mật độ chiếm sàn (Footprint Coverage trên 51.0 m² thông thủy)
  const usableSqm = 51.0;
  let totalFootprintSqm = 0;
  for (const item of floorItems) {
    totalFootprintSqm += (item.dimensionsCm.width / 100) * (item.dimensionsCm.depth / 100);
  }
  const footprintCoveragePct = Number(((totalFootprintSqm / usableSqm) * 100).toFixed(1));
  const densityStatus: ArchitecturalAuditCheck["status"] =
    footprintCoveragePct > 55 ? "DANGER" : footprintCoveragePct > 48 ? "WARNING" : "PASS";
  checks.push({
    id: "audit_floor_density",
    title: "Mật độ chiếm sàn nội thất (trên 51,0 m²)",
    measuredLabel: `${footprintCoveragePct}% (${totalFootprintSqm.toFixed(1)} m²)`,
    targetLabel: "25% – 48% thông thoáng",
    status: densityStatus,
    detail:
      densityStatus === "PASS"
        ? "Tỷ lệ khoảng trống lưu thông lý tưởng cho căn hộ 2PN 51 m², giữ cảm giác rộng rãi."
        : "Mật độ đồ đặt sàn cao hơn 48% — nên rút gọn món phụ hoặc ưu tiên nội thất đa năng.",
    cameraPreset: "DOLLHOUSE",
  });

  const passCount = checks.filter((c) => c.status === "PASS").length;
  const warningCount = checks.filter((c) => c.status === "WARNING").length;
  const dangerCount = checks.filter((c) => c.status === "DANGER").length;

  return {
    checks,
    passCount,
    warningCount,
    dangerCount,
    totalChecks: checks.length,
    footprintCoveragePct,
  };
}

export interface ConstructionMilestoneItem {
  id: string;
  stageNumber: number;
  title: string;
  subtitle: string;
  weightPct: number;
  monthsFromNow: number;
  milestoneAmountVnd: number;
  alreadyPaidCoveredVnd: number;
  netCashDueVnd: number;
  availableCashAtStageVnd: number;
  cashUsedVnd: number;
  goldNeededVnd: number;
  suggestedGoldChiToSell: number;
  remainingCashAfterStageVnd: number;
  fundingStatus: "COVERED_BY_CASH" | "NEED_GOLD_LIQUIDATION" | "SHORTFALL";
}

export interface ConstructionMilestonesPlan {
  totalBoqTargetVnd: number;
  alreadyPaidVnd: number;
  totalNetDueVnd: number;
  totalGoldNeededVnd: number;
  totalGoldChiToSell: number;
  goldPortfolioRemainingChiAfterAll: number;
  milestones: ConstructionMilestoneItem[];
}

export interface ConstructionMilestonesInput {
  boqTotalVnd: number;
  boqPaidVnd: number;
  currentLiquidCashVnd: number;
  monthlyNetSurplusVnd: number;
  monthsUntilHandover: number;
  goldPortfolio: GoldPortfolioState;
}

/**
 * Lập lịch giải ngân 4 đợt thi công nội thất (30% - 40% - 20% - 10%) liên thông
 * trực tiếp dòng tiền thặng dư hàng tháng và mô phỏng bán vàng ít tốn Spread nhất.
 */
export function calculateConstructionMilestones(
  input: ConstructionMilestonesInput
): ConstructionMilestonesPlan {
  const totalBoq = Math.max(0, Math.round(input.boqTotalVnd));
  let paidPool = Math.min(totalBoq, Math.max(0, Math.round(input.boqPaidVnd)));
  const handoverMonth = Math.max(3, Math.round(input.monthsUntilHandover));
  const monthlySurplus = Math.max(0, Math.round(input.monthlyNetSurplusVnd));

  const stageSpecs = [
    {
      id: "ms_1_contract",
      stageNumber: 1,
      title: "Đợt 1 · Ký HĐ & Đặt cọc sản xuất xưởng",
      subtitle: "Chốt bản vẽ 2D/3D, đặt cọc ván gỗ An Cường & phụ kiện",
      weightPct: 30,
      monthsFromNow: Math.max(1, handoverMonth - 2),
    },
    {
      id: "ms_2_woodwork",
      stageNumber: 2,
      title: "Đợt 2 · Tập kết hàng thô & Lắp đặt gỗ",
      subtitle: "Thi công tủ bếp, tủ áo, giường, bàn làm việc Phòng 05",
      weightPct: 40,
      monthsFromNow: Math.max(2, handoverMonth - 1),
    },
    {
      id: "ms_3_appliances",
      stageNumber: 3,
      title: "Đợt 3 · Thiết bị điện máy, Rèm & Đèn",
      subtitle: "Lắp đặt điều hòa, tủ lạnh, máy giặt sấy, TV & rèm 2 lớp",
      weightPct: 20,
      monthsFromNow: handoverMonth,
    },
    {
      id: "ms_4_acceptance",
      stageNumber: 4,
      title: "Đợt 4 · Nghiệm thu bàn giao & Bảo hành",
      subtitle: "Kiểm tra danh mục 8 khu vực, bàn giao hồ sơ hoàn công",
      weightPct: 10,
      monthsFromNow: handoverMonth + 1,
    },
  ];

  let runningCash = Math.max(0, Math.round(input.currentLiquidCashVnd));
  let prevMonthMark = 0;
  let totalGoldNeededVnd = 0;
  let totalGoldChiToSell = 0;

  // Track virtual gold capacity across milestones using live Bid prices
  const nhanBid = input.goldPortfolio.quotes.NHAN_9999?.buyPricePerChi || 9_050_000;
  const fullGoldSim = simulateGoldLiquidation(
    input.goldPortfolio,
    totalBoq,
    "MIN_SPREAD_FIRST"
  );
  let remainingGoldBidBudget =
    fullGoldSim.totalProceedsVnd + fullGoldSim.remainingLiquidationValueVnd;
  let remainingGoldChi =
    fullGoldSim.totalSellChi + fullGoldSim.remainingChiAfterSale;

  const milestones: ConstructionMilestoneItem[] = stageSpecs.map((spec, idx) => {
    const milestoneAmountVnd =
      idx === stageSpecs.length - 1
        ? Math.max(
            0,
            totalBoq -
              stageSpecs
                .slice(0, -1)
                .reduce((s, prev) => s + Math.round((totalBoq * prev.weightPct) / 100), 0)
          )
        : Math.round((totalBoq * spec.weightPct) / 100);

    const alreadyPaidCoveredVnd = Math.min(paidPool, milestoneAmountVnd);
    paidPool -= alreadyPaidCoveredVnd;
    const netCashDueVnd = Math.max(0, milestoneAmountVnd - alreadyPaidCoveredVnd);

    const deltaMonths = Math.max(0, spec.monthsFromNow - prevMonthMark);
    prevMonthMark = spec.monthsFromNow;
    runningCash += deltaMonths * monthlySurplus;

    const availableCashAtStageVnd = runningCash;
    const cashUsedVnd = Math.min(availableCashAtStageVnd, netCashDueVnd);
    runningCash = Math.max(0, availableCashAtStageVnd - cashUsedVnd);

    const cashShortfallVnd = Math.max(0, netCashDueVnd - cashUsedVnd);
    let goldNeededVnd = 0;
    let suggestedGoldChiToSell = 0;
    let fundingStatus: ConstructionMilestoneItem["fundingStatus"] = "COVERED_BY_CASH";

    if (cashShortfallVnd > 0) {
      if (remainingGoldBidBudget >= cashShortfallVnd) {
        goldNeededVnd = cashShortfallVnd;
        suggestedGoldChiToSell =
          nhanBid > 0 ? Math.min(remainingGoldChi, Math.ceil((cashShortfallVnd / nhanBid) * 2) / 2) : 0;
        remainingGoldBidBudget = Math.max(0, remainingGoldBidBudget - goldNeededVnd);
        remainingGoldChi = Math.max(0, Number((remainingGoldChi - suggestedGoldChiToSell).toFixed(3)));
        fundingStatus = "NEED_GOLD_LIQUIDATION";
      } else {
        goldNeededVnd = remainingGoldBidBudget;
        suggestedGoldChiToSell = remainingGoldChi;
        remainingGoldBidBudget = 0;
        remainingGoldChi = 0;
        fundingStatus = "SHORTFALL";
      }
      totalGoldNeededVnd += goldNeededVnd;
      totalGoldChiToSell = Number((totalGoldChiToSell + suggestedGoldChiToSell).toFixed(3));
    }

    return {
      id: spec.id,
      stageNumber: spec.stageNumber,
      title: spec.title,
      subtitle: spec.subtitle,
      weightPct: spec.weightPct,
      monthsFromNow: spec.monthsFromNow,
      milestoneAmountVnd,
      alreadyPaidCoveredVnd,
      netCashDueVnd,
      availableCashAtStageVnd,
      cashUsedVnd,
      goldNeededVnd,
      suggestedGoldChiToSell,
      remainingCashAfterStageVnd: runningCash,
      fundingStatus,
    };
  });

  return {
    totalBoqTargetVnd: totalBoq,
    alreadyPaidVnd: Math.min(totalBoq, Math.max(0, Math.round(input.boqPaidVnd))),
    totalNetDueVnd: milestones.reduce((s, m) => s + m.netCashDueVnd, 0),
    totalGoldNeededVnd,
    totalGoldChiToSell,
    goldPortfolioRemainingChiAfterAll: Number(Math.max(0, remainingGoldChi).toFixed(3)),
    milestones,
  };
}

