import {
  InteriorDesignScenario,
  InteriorDoorMode,
  InteriorFurnitureItem,
  InteriorWallOverride,
} from "@/types/finance";
import {
  SKYONE_A2_BOUNDS,
  SKYONE_A2_OPENINGS,
  SKYONE_A2_SHAFTS,
  SKYONE_A2_WALLS,
  WallSegmentSpec,
} from "./interiorFloorplan";

/**
 * Trả về danh sách các bức tường còn tồn tại vật lý (loại bỏ các vách phi kết cấu đã đổi sang chế độ OPEN).
 */
export function getActiveWalls(
  wallOverrides?: Record<string, InteriorWallOverride>
): WallSegmentSpec[] {
  if (!wallOverrides) return [...SKYONE_A2_WALLS];
  return SKYONE_A2_WALLS.filter((wall) => {
    if (wall.structural) return true;
    const ov = wallOverrides[wall.id];
    return ov?.mode !== "OPEN";
  });
}

export interface FootprintBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  effW: number;
  effD: number;
}

export function getFootprintBounds(
  item: Pick<InteriorFurnitureItem, "position" | "rotationDeg" | "dimensionsCm">,
  overridePos?: { x: number; z: number }
): FootprintBounds {
  const posX = overridePos ? overridePos.x : item.position.x;
  const posZ = overridePos ? overridePos.z : item.position.z;
  const rad = (item.rotationDeg * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const wM = item.dimensionsCm.width / 100;
  const dM = item.dimensionsCm.depth / 100;
  const effW = wM * cos + dM * sin;
  const effD = wM * sin + dM * cos;

  return {
    minX: posX - effW / 2,
    maxX: posX + effW / 2,
    minZ: posZ - effD / 2,
    maxZ: posZ + effD / 2,
    effW,
    effD,
  };
}

/**
 * Axis-aligned bounding box of a CAD wall segment.
 */
export function getWallAabb(wall: WallSegmentSpec): {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  isHorizontal: boolean;
  isVertical: boolean;
} {
  const isHorizontal = Math.abs(wall.z1 - wall.z2) < 0.01;
  const isVertical = Math.abs(wall.x1 - wall.x2) < 0.01;
  const halfT = wall.thickness / 2;
  const minX = Math.min(wall.x1, wall.x2) - (isVertical ? halfT : 0);
  const maxX = Math.max(wall.x1, wall.x2) + (isVertical ? halfT : 0);
  const minZ = Math.min(wall.z1, wall.z2) - (isHorizontal ? halfT : 0);
  const maxZ = Math.max(wall.z1, wall.z2) + (isHorizontal ? halfT : 0);
  return { minX, maxX, minZ, maxZ, isHorizontal, isVertical };
}

export interface SnapToWallResult {
  x: number;
  z: number;
  snappedX: boolean;
  snappedZ: boolean;
  snappedWallIdX?: string;
  snappedWallIdZ?: string;
}

/**
 * Snap-to-Wall CAD helper:
 * - Khi kéo vật thể tiến gần mép tường (<= 12 cm), tự động hít phẳng mép (chừa 1 cm khe thi công).
 * - Vẫn cho phép kéo tự do qua vách ngăn để thử phương án giữa các phòng.
 * - Fallback về lưới kiến trúc 5 cm khi không ở gần tường.
 */
export function snapPositionToWalls(
  item: Pick<InteriorFurnitureItem, "position" | "rotationDeg" | "dimensionsCm">,
  rawX: number,
  rawZ: number,
  options?: {
    snapToWall?: boolean;
    thresholdM?: number;
    gridM?: number;
    wallOverrides?: Record<string, InteriorWallOverride>;
  }
): SnapToWallResult {
  const snapToWall = options?.snapToWall ?? true;
  const thresholdM = options?.thresholdM ?? 0.12;
  const gridM = options?.gridM ?? 0.05;
  const wallGap = 0.015; // 1.5 cm khe hở kỹ thuật (không đè vào tường)

  const b = getFootprintBounds(item, { x: rawX, z: rawZ });
  const halfW = b.effW / 2;
  const halfD = b.effD / 2;

  let bestX = Math.round(rawX / gridM) * gridM;
  let bestZ = Math.round(rawZ / gridM) * gridM;
  let snappedX = false;
  let snappedZ = false;
  let snappedWallIdX: string | undefined;
  let snappedWallIdZ: string | undefined;

  if (snapToWall) {
    let minDistX = thresholdM;
    let minDistZ = thresholdM;
    const activeWalls = getActiveWalls(options?.wallOverrides);

    for (const wall of activeWalls) {
      const wa = getWallAabb(wall);

      // Vertical wall -> snap X if item overlaps wall along Z span
      if (wa.isVertical) {
        const zOverlap = Math.min(b.maxZ, wa.maxZ + 0.15) - Math.max(b.minZ, wa.minZ - 0.15);
        if (zOverlap > 0.05) {
          // Item on the right side of wall (item.minX -> wa.maxX + gap)
          const candRightX = wa.maxX + wallGap + halfW;
          const distRight = Math.abs(rawX - candRightX);
          if (distRight <= minDistX) {
            minDistX = distRight;
            bestX = candRightX;
            snappedX = true;
            snappedWallIdX = wall.id;
          }
          // Item on the left side of wall (item.maxX -> wa.minX - gap)
          const candLeftX = wa.minX - wallGap - halfW;
          const distLeft = Math.abs(rawX - candLeftX);
          if (distLeft <= minDistX) {
            minDistX = distLeft;
            bestX = candLeftX;
            snappedX = true;
            snappedWallIdX = wall.id;
          }
        }
      }

      // Horizontal wall -> snap Z if item overlaps wall along X span
      if (wa.isHorizontal) {
        const xOverlap = Math.min(b.maxX, wa.maxX + 0.15) - Math.max(b.minX, wa.minX - 0.15);
        if (xOverlap > 0.05) {
          // Item below wall (item.minZ -> wa.maxZ + gap)
          const candBelowZ = wa.maxZ + wallGap + halfD;
          const distBelow = Math.abs(rawZ - candBelowZ);
          if (distBelow <= minDistZ) {
            minDistZ = distBelow;
            bestZ = candBelowZ;
            snappedZ = true;
            snappedWallIdZ = wall.id;
          }
          // Item above wall (item.maxZ -> wa.minZ - gap)
          const candAboveZ = wa.minZ - wallGap - halfD;
          const distAbove = Math.abs(rawZ - candAboveZ);
          if (distAbove <= minDistZ) {
            minDistZ = distAbove;
            bestZ = candAboveZ;
            snappedZ = true;
            snappedWallIdZ = wall.id;
          }
        }
      }
    }
  }

  const clampedX = Math.max(
    SKYONE_A2_BOUNDS.minX + Math.min(0.25, halfW),
    Math.min(SKYONE_A2_BOUNDS.maxX - Math.min(0.25, halfW), bestX)
  );
  const clampedZ = Math.max(
    SKYONE_A2_BOUNDS.minZ + Math.min(0.25, halfD),
    Math.min(SKYONE_A2_BOUNDS.maxZ - Math.min(0.25, halfD), bestZ)
  );

  return {
    x: Number(clampedX.toFixed(2)),
    z: Number(clampedZ.toFixed(2)),
    snappedX,
    snappedZ,
    snappedWallIdX,
    snappedWallIdZ,
  };
}

export interface SmartGuideLine {
  id: string;
  axis: "X" | "Z";
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  distanceCm: number;
}

/**
 * Tính các đường gióng đo khoảng cách (Smart Guides) từ vật thể đến bức tường gần nhất
 * theo 2 phương ngang (X) và dọc (Z) để hiển thị tức thời trên bản vẽ 2D CAD.
 */
export function computeSmartGuides(
  item: Pick<InteriorFurnitureItem, "position" | "rotationDeg" | "dimensionsCm">,
  overridePos?: { x: number; z: number },
  wallOverrides?: Record<string, InteriorWallOverride>
): SmartGuideLine[] {
  const b = getFootprintBounds(item, overridePos);
  const midX = (b.minX + b.maxX) / 2;
  const midZ = (b.minZ + b.maxZ) / 2;

  let nearestLeft: { dist: number; wallEdge: number } | null = null;
  let nearestRight: { dist: number; wallEdge: number } | null = null;
  let nearestTop: { dist: number; wallEdge: number } | null = null;
  let nearestBottom: { dist: number; wallEdge: number } | null = null;

  for (const wall of getActiveWalls(wallOverrides)) {
    const wa = getWallAabb(wall);

    if (wa.isVertical) {
      const zSpan = Math.min(b.maxZ, wa.maxZ) - Math.max(b.minZ, wa.minZ);
      if (zSpan > -0.15) {
        if (wa.maxX <= b.minX + 0.01) {
          const d = Math.max(0, b.minX - wa.maxX);
          if (!nearestLeft || d < nearestLeft.dist) {
            nearestLeft = { dist: d, wallEdge: wa.maxX };
          }
        } else if (wa.minX >= b.maxX - 0.01) {
          const d = Math.max(0, wa.minX - b.maxX);
          if (!nearestRight || d < nearestRight.dist) {
            nearestRight = { dist: d, wallEdge: wa.minX };
          }
        }
      }
    }

    if (wa.isHorizontal) {
      const xSpan = Math.min(b.maxX, wa.maxX) - Math.max(b.minX, wa.minX);
      if (xSpan > -0.15) {
        if (wa.maxZ <= b.minZ + 0.01) {
          const d = Math.max(0, b.minZ - wa.maxZ);
          if (!nearestTop || d < nearestTop.dist) {
            nearestTop = { dist: d, wallEdge: wa.maxZ };
          }
        } else if (wa.minZ >= b.maxZ - 0.01) {
          const d = Math.max(0, wa.minZ - b.maxZ);
          if (!nearestBottom || d < nearestBottom.dist) {
            nearestBottom = { dist: d, wallEdge: wa.minZ };
          }
        }
      }
    }
  }

  const guides: SmartGuideLine[] = [];

  // Choose the closer horizontal wall (Left vs Right) and vertical wall (Top vs Bottom)
  const chosenX =
    nearestLeft && nearestRight
      ? nearestLeft.dist <= nearestRight.dist
        ? { side: "left", ...nearestLeft }
        : { side: "right", ...nearestRight }
      : nearestLeft
        ? { side: "left", ...nearestLeft }
        : nearestRight
          ? { side: "right", ...nearestRight }
          : null;

  if (chosenX) {
    guides.push({
      id: `guide_x_${chosenX.side}`,
      axis: "X",
      x1: chosenX.side === "left" ? chosenX.wallEdge : b.maxX,
      z1: midZ,
      x2: chosenX.side === "left" ? b.minX : chosenX.wallEdge,
      z2: midZ,
      distanceCm: Math.round(chosenX.dist * 100),
    });
  }

  const chosenZ =
    nearestTop && nearestBottom
      ? nearestTop.dist <= nearestBottom.dist
        ? { side: "top", ...nearestTop }
        : { side: "bottom", ...nearestBottom }
      : nearestTop
        ? { side: "top", ...nearestTop }
        : nearestBottom
          ? { side: "bottom", ...nearestBottom }
          : null;

  if (chosenZ) {
    guides.push({
      id: `guide_z_${chosenZ.side}`,
      axis: "Z",
      x1: midX,
      z1: chosenZ.side === "top" ? chosenZ.wallEdge : b.maxZ,
      x2: midX,
      z2: chosenZ.side === "top" ? b.minZ : chosenZ.wallEdge,
      distanceCm: Math.round(chosenZ.dist * 100),
    });
  }

  return guides;
}

const WALL_OVERLAP_EXEMPT_KEYS = new Set([
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
  "kitchen_l_hafele",
  "wc_hafele_set",
]);

const SURFACE_SUPPORT_KEYS = new Set([
  "dual_workstation_desk",
  "single_desk",
  "coffee_table",
  "dining_set_4",
  "folding_dining_table",
  "nightstand",
  "vanity_desk_mirror",
  "tv_console_slat",
  "mini_kitchen_island",
]);

export function isWallOrSurfaceMounted(item: InteriorFurnitureItem): boolean {
  if (item.mountType === "WALL" || item.mountType === "SURFACE") return true;
  return WALL_OVERLAP_EXEMPT_KEYS.has(item.catalogKey);
}

/**
 * Tự động tìm cao độ mặt bàn/tủ bên dưới (cm) khi đặt hoặc kéo vật thể kiểu SURFACE (màn hình, đèn bàn...).
 */
export function computeSurfaceElevationCm(
  item: InteriorFurnitureItem,
  allItems: readonly InteriorFurnitureItem[],
  x = item.position.x,
  z = item.position.z
): number {
  const isSurface =
    item.mountType === "SURFACE" ||
    item.catalogKey === "dual_monitor_arm" ||
    item.catalogKey === "desk_lamp_screenbar";

  if (!isSurface) {
    return item.elevationCm ?? 0;
  }

  let bestHeightCm: number | null = null;
  for (const other of allItems) {
    if (other.id === item.id) continue;
    if (!SURFACE_SUPPORT_KEYS.has(other.catalogKey)) continue;
    const ob = getFootprintBounds(other);
    const pad = 0.06;
    if (x >= ob.minX - pad && x <= ob.maxX + pad && z >= ob.minZ - pad && z <= ob.maxZ + pad) {
      if (bestHeightCm === null || other.dimensionsCm.height > bestHeightCm) {
        bestHeightCm = other.dimensionsCm.height;
      }
    }
  }

  return bestHeightCm ?? item.elevationCm ?? 75;
}

/**
 * Kiểm tra vật thể đặt sàn có đang đè cắt xuyên qua bất kỳ đoạn vách ngăn / tường / hộp kỹ thuật nào không.
 * Cho phép dung sai mép 4cm để đồ hít sát tường không bị báo lỗi giả.
 */
export function detectItemWallOverlap(
  item: InteriorFurnitureItem,
  wallOverrides?: Record<string, InteriorWallOverride>
): { wallId: string; overlapCm: number } | null {
  if (isWallOrSurfaceMounted(item)) return null;

  const b = getFootprintBounds(item);
  const tolerance = 0.04;

  for (const wall of getActiveWalls(wallOverrides)) {
    const wa = getWallAabb(wall);
    const ox = Math.min(b.maxX, wa.maxX) - Math.max(b.minX, wa.minX);
    const oz = Math.min(b.maxZ, wa.maxZ) - Math.max(b.minZ, wa.minZ);
    if (ox > tolerance && oz > tolerance) {
      return {
        wallId: wall.id,
        overlapCm: Math.round(Math.min(ox, oz) * 100),
      };
    }
  }

  for (const shaft of SKYONE_A2_SHAFTS) {
    const sMinX = shaft.x - shaft.width / 2;
    const sMaxX = shaft.x + shaft.width / 2;
    const sMinZ = shaft.z - shaft.depth / 2;
    const sMaxZ = shaft.z + shaft.depth / 2;
    const ox = Math.min(b.maxX, sMaxX) - Math.max(b.minX, sMinX);
    const oz = Math.min(b.maxZ, sMaxZ) - Math.max(b.minZ, sMinZ);
    if (ox > tolerance && oz > tolerance) {
      return {
        wallId: shaft.id,
        overlapCm: Math.round(Math.min(ox, oz) * 100),
      };
    }
  }
  return null;
}

export interface ClearanceZoneOverlay {
  id: string;
  itemId: string;
  kind: "WARDROBE_SWING" | "CHAIR_PULLBACK";
  label: string;
  cx: number;
  cz: number;
  widthM: number;
  depthM: number;
  rotationDeg: number;
}

/**
 * Sinh các vùng thao tác công thái học cho lớp overlay 2D CAD:
 * - Khoảng mở cánh tủ quần áo 60 cm
 * - Khoảng lùi ghế bàn làm việc / bàn ăn 75–80 cm
 */
export function computeClearanceZones(scenario: InteriorDesignScenario): ClearanceZoneOverlay[] {
  const zones: ClearanceZoneOverlay[] = [];

  for (const item of scenario.items) {
    const rad = (item.rotationDeg * Math.PI) / 180;
    // In Three.js & SVG transform rotate(-rotationDeg), local +Z front vector maps to:
    // worldX = sin(rad), worldZ = cos(rad)
    const frontX = Math.sin(rad);
    const frontZ = Math.cos(rad);
    const wM = item.dimensionsCm.width / 100;
    const dM = item.dimensionsCm.depth / 100;

    if (item.catalogKey === "wardrobe_tall" || item.catalogKey === "wardrobe_compact") {
      const clearD = 0.6;
      const offset = dM / 2 + clearD / 2;
      zones.push({
        id: `cz_wardrobe_${item.id}`,
        itemId: item.id,
        kind: "WARDROBE_SWING",
        label: "Mở cánh 60cm",
        cx: item.position.x + frontX * offset,
        cz: item.position.z + frontZ * offset,
        widthM: wM,
        depthM: clearD,
        rotationDeg: item.rotationDeg,
      });
    } else if (item.catalogKey === "dual_workstation_desk" || item.catalogKey === "single_desk") {
      const clearD = 0.8;
      const offset = dM / 2 + clearD / 2;
      zones.push({
        id: `cz_desk_${item.id}`,
        itemId: item.id,
        kind: "CHAIR_PULLBACK",
        label: "Lùi ghế 80cm",
        cx: item.position.x + frontX * offset,
        cz: item.position.z + frontZ * offset,
        widthM: wM,
        depthM: clearD,
        rotationDeg: item.rotationDeg,
      });
    }
  }

  return zones;
}

/**
 * Chống xuyên tường cho chế độ Đi bộ 1.6m (First-Person Walkthrough):
 * Giải va chạm hình tròn bán kính `radius` với tất cả đoạn tường rắn trong SKYONE_A2_WALLS
 * (trừ cửa lùa ban công mở lối ra ban công). Trượt mượt theo mặt tường thay vì khựng đứng.
 */
export function resolveWalkthroughCollision(
  prevX: number,
  prevZ: number,
  nextX: number,
  nextZ: number,
  radius = 0.24,
  wallOverrides?: Record<string, InteriorWallOverride>
): { x: number; z: number; collided: boolean } {
  let x = Math.max(
    SKYONE_A2_BOUNDS.minX + radius + 0.08,
    Math.min(SKYONE_A2_BOUNDS.maxX - radius - 0.08, nextX)
  );
  let z = Math.max(
    SKYONE_A2_BOUNDS.minZ + radius + 0.08,
    Math.min(SKYONE_A2_BOUNDS.maxZ - radius - 0.08, nextZ)
  );
  let collided = false;
  const activeWalls = getActiveWalls(wallOverrides);

  // Iterative circle-vs-AABB resolution (2 passes for crisp corner sliding)
  for (let pass = 0; pass < 2; pass++) {
    for (const wall of activeWalls) {
      const wa = getWallAabb(wall);
      const closestX = Math.max(wa.minX, Math.min(x, wa.maxX));
      const closestZ = Math.max(wa.minZ, Math.min(z, wa.maxZ));
      const dx = x - closestX;
      const dz = z - closestZ;
      const distSq = dx * dx + dz * dz;

      if (distSq < radius * radius) {
        collided = true;
        if (distSq > 1e-6) {
          const dist = Math.sqrt(distSq);
          const push = radius - dist;
          x += (dx / dist) * push;
          z += (dz / dist) * push;
        } else {
          // Inside AABB fallback: push out along previous motion normal
          const pdx = prevX - (wa.minX + wa.maxX) / 2;
          const pdz = prevZ - (wa.minZ + wa.maxZ) / 2;
          if (wa.isVertical) {
            x = pdx >= 0 ? wa.maxX + radius : wa.minX - radius;
          } else {
            z = pdz >= 0 ? wa.maxZ + radius : wa.minZ - radius;
          }
        }
      }
    }

    // Resolve against 3 structural MEP shafts
    for (const shaft of SKYONE_A2_SHAFTS) {
      const minX = shaft.x - shaft.width / 2;
      const maxX = shaft.x + shaft.width / 2;
      const minZ = shaft.z - shaft.depth / 2;
      const maxZ = shaft.z + shaft.depth / 2;
      const closestX = Math.max(minX, Math.min(x, maxX));
      const closestZ = Math.max(minZ, Math.min(z, maxZ));
      const dx = x - closestX;
      const dz = z - closestZ;
      const distSq = dx * dx + dz * dz;
      if (distSq < radius * radius) {
        collided = true;
        if (distSq > 1e-6) {
          const dist = Math.sqrt(distSq);
          const push = radius - dist;
          x += (dx / dist) * push;
          z += (dz / dist) * push;
        }
      }
    }
  }

  // Clamp again after resolution
  x = Math.max(
    SKYONE_A2_BOUNDS.minX + radius + 0.08,
    Math.min(SKYONE_A2_BOUNDS.maxX - radius - 0.08, x)
  );
  z = Math.max(
    SKYONE_A2_BOUNDS.minZ + radius + 0.08,
    Math.min(SKYONE_A2_BOUNDS.maxZ - radius - 0.08, z)
  );

  return { x, z, collided };
}

/**
 * Helper kiểm tra khoảng mở cửa đi có bị vật thể chắn trong vòng cung 90° không.
 * Tự động bỏ qua nếu người dùng đã chuyển cửa sang SLIDING_POCKET hoặc OPEN_ARCH.
 */
export function checkDoorSwingCollision(
  item: InteriorFurnitureItem,
  doorOverrides?: Record<string, InteriorDoorMode>
): { openingId: string; openingLabel: string; isMainDoor: boolean } | null {
  if (item.source === "DEVELOPER_INCLUDED" || isWallOrSurfaceMounted(item)) {
    return null;
  }

  const b = getFootprintBounds(item);

  for (const op of SKYONE_A2_OPENINGS) {
    if (!op.swingArc) continue;
    const doorMode = doorOverrides?.[op.id] ?? "SWING_90";
    if (doorMode !== "SWING_90") continue;

    const { hingeX, hingeZ, radius, startAngleDeg, endAngleDeg } = op.swingArc;

    // Approximate the 90-degree door swing sector with its axis-aligned inner sweep box (inset 6cm)
    const a1 = (startAngleDeg * Math.PI) / 180;
    const a2 = (endAngleDeg * Math.PI) / 180;
    const midA = ((startAngleDeg + endAngleDeg) / 2) * (Math.PI / 180);
    const ptsX = [
      hingeX,
      hingeX + Math.cos(a1) * radius,
      hingeX + Math.cos(a2) * radius,
      hingeX + Math.cos(midA) * radius,
    ];
    const ptsZ = [
      hingeZ,
      hingeZ + Math.sin(a1) * radius,
      hingeZ + Math.sin(a2) * radius,
      hingeZ + Math.sin(midA) * radius,
    ];
    const sMinX = Math.min(...ptsX) + 0.06;
    const sMaxX = Math.max(...ptsX) - 0.06;
    const sMinZ = Math.min(...ptsZ) + 0.06;
    const sMaxZ = Math.max(...ptsZ) - 0.06;

    const ox = Math.min(b.maxX, sMaxX) - Math.max(b.minX, sMinX);
    const oz = Math.min(b.maxZ, sMaxZ) - Math.max(b.minZ, sMinZ);
    if (ox > 0.06 && oz > 0.06) {
      return {
        openingId: op.id,
        openingLabel: op.label,
        isMainDoor: op.kind === "MAIN_DOOR",
      };
    }
  }
  return null;
}
