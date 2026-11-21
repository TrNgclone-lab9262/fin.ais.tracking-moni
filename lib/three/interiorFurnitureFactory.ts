import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { InteriorFurnitureItem } from "@/types/finance";
import { loadCustomGlbBuffer } from "@/lib/interiorGlbVault";
import { InteriorMaterialLibrary } from "./interiorMaterials";

function addBox(
  parent: THREE.Group,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  mat: THREE.Material,
  castShadow = true
): THREE.Mesh {
  const geo = new THREE.BoxGeometry(Math.max(0.01, w), Math.max(0.01, h), Math.max(0.01, d));
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addRoundedBox(
  parent: THREE.Group,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  mat: THREE.Material,
  radius = 0.032,
  segments = 3,
  castShadow = true
): THREE.Mesh {
  const safeW = Math.max(0.02, w);
  const safeH = Math.max(0.02, h);
  const safeD = Math.max(0.02, d);
  const maxR = Math.min(safeW, safeH, safeD) * 0.42;
  const geo = new RoundedBoxGeometry(safeW, safeH, safeD, segments, Math.min(radius, maxR));
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addCylinder(
  parent: THREE.Group,
  rTop: number,
  rBot: number,
  h: number,
  x: number,
  y: number,
  z: number,
  mat: THREE.Material,
  radialSegments = 16,
  castShadow = true
): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(rTop, rBot, Math.max(0.01, h), radialSegments);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export function tagFurnitureGroup(group: THREE.Group, item: InteriorFurnitureItem): void {
  group.name = `furniture_${item.id}`;
  group.userData = {
    furnitureId: item.id,
    catalogKey: item.catalogKey,
    isLocked: Boolean(item.isLocked),
  };
  group.traverse((obj) => {
    obj.userData.furnitureId = item.id;
  });
}

const NO_CONTACT_SHADOW_KEYS = new Set([
  "area_rug",
  "ac_inverter",
  "smart_tv",
  "pegboard_goal_wall",
  "wc_hafele_set",
  "wall_art_duo",
  "pendant_dining_light",
  "loggia_drying_rack",
  "fridge_top_cabinet",
  "dual_monitor_arm",
  "desk_lamp_screenbar",
]);

/**
 * Dựng mô hình 3D tổ hợp mịn (RoundedBoxGeometry / ExtrudeGeometry / TubeGeometry) cho 46+ món nội thất chuẩn tỷ lệ 1 unit = 1 mét.
 * Pivot đặt tại đáy-tâm (y = 0), cộng thêm `elevationCm / 100` cho đồ gắn tường hoặc đặt trên mặt bàn.
 */
export function buildFurnitureMeshGroup(
  item: InteriorFurnitureItem,
  lib: InteriorMaterialLibrary
): THREE.Group {
  const group = new THREE.Group();
  const w = Math.max(0.12, item.dimensionsCm.width / 100);
  const d = Math.max(0.04, item.dimensionsCm.depth / 100);
  const h = Math.max(0.02, item.dimensionsCm.height / 100);

  const primaryMat = lib.finishes[item.materialFinish] || lib.finishes.WARM_OAK;
  const oakMat = lib.finishes.WARM_OAK;
  const creamMat = lib.finishes.MATTE_CREAM;
  const darkMetal = lib.darkFrameMetal;

  let effectiveElevationY = (item.elevationCm ?? 0) / 100;

  switch (item.catalogKey) {
    case "sofa_3seat": {
      const legH = 0.12;
      const baseH = 0.22;
      const seatH = 0.15;
      const armW = Math.min(0.18, w * 0.1);
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          addCylinder(group, 0.024, 0.017, legH, sx * (w / 2 - 0.12), legH / 2, sz * (d / 2 - 0.1), oakMat, 12);
        }
      }
      addRoundedBox(group, w - 0.04, baseH, d - 0.04, 0, legH + baseH / 2, 0, primaryMat, 0.035);
      const innerW = w - armW * 2 - 0.04;
      const cushionW = innerW / 3 - 0.015;
      for (let i = -1; i <= 1; i++) {
        addRoundedBox(group, cushionW, seatH, d - 0.16, i * (cushionW + 0.015), legH + baseH + seatH / 2, 0.05, primaryMat, 0.045);
      }
      const backH = Math.max(0.34, h - legH - baseH);
      addRoundedBox(group, w, backH, 0.17, 0, legH + baseH + backH / 2 - 0.03, -d / 2 + 0.09, primaryMat, 0.05);
      // 3 plump back cushions
      for (let i = -1; i <= 1; i++) {
        const bc = addRoundedBox(
          group,
          cushionW * 0.96,
          backH * 0.78,
          0.13,
          i * (cushionW + 0.015),
          legH + baseH + seatH + backH * 0.34,
          -d / 2 + 0.2,
          primaryMat,
          0.045
        );
        bc.rotation.x = -0.14;
      }
      // Rounded armrests
      addRoundedBox(group, armW, backH * 0.72, d - 0.05, -w / 2 + armW / 2, legH + baseH + backH * 0.32, 0, primaryMat, 0.05);
      addRoundedBox(group, armW, backH * 0.72, d - 0.05, w / 2 - armW / 2, legH + baseH + backH * 0.32, 0, primaryMat, 0.05);
      // 2 organic throw pillows
      const p1 = addRoundedBox(group, 0.36, 0.34, 0.11, -w / 2 + armW + 0.24, legH + baseH + seatH + 0.16, -d / 2 + 0.27, lib.finishes.SAGE_LINEN, 0.045);
      p1.rotation.set(-0.15, 0.26, 0.08);
      const p2 = addRoundedBox(group, 0.34, 0.32, 0.11, w / 2 - armW - 0.24, legH + baseH + seatH + 0.15, -d / 2 + 0.27, oakMat, 0.045);
      p2.rotation.set(-0.14, -0.22, -0.06);
      break;
    }

    case "sofa_bed_smart": {
      const legH = 0.08;
      const baseH = 0.26;
      const seatH = 0.14;
      addRoundedBox(group, w, 0.06, d, 0, legH + 0.03, 0, oakMat, 0.015);
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          addCylinder(group, 0.022, 0.018, legH, sx * (w / 2 - 0.08), legH / 2, sz * (d / 2 - 0.08), oakMat, 10);
        }
      }
      // Pull-out trundle drawer front
      addRoundedBox(group, w - 0.06, baseH - 0.04, d - 0.06, 0, legH + 0.06 + (baseH - 0.04) / 2, 0, primaryMat, 0.03);
      addBox(group, w * 0.3, 0.02, 0.02, 0, legH + 0.16, d / 2 - 0.02, darkMetal, false);
      // Foldable mattress cushion
      addRoundedBox(group, w - 0.04, seatH, d - 0.1, 0, legH + baseH + seatH / 2, 0.03, primaryMat, 0.045);
      // Tufted backrest
      const backH = Math.max(0.32, h - legH - baseH - 0.04);
      const back = addRoundedBox(group, w - 0.02, backH, 0.16, 0, legH + baseH + backH / 2, -d / 2 + 0.09, primaryMat, 0.045);
      back.rotation.x = -0.12;
      // Two cylindrical bolster pillows on left & right
      for (const sx of [-1, 1]) {
        const bol = addCylinder(group, 0.09, 0.09, d * 0.56, sx * (w / 2 - 0.12), legH + baseH + seatH + 0.09, 0, lib.finishes.SAGE_LINEN, 14);
        bol.rotation.x = Math.PI / 2;
      }
      break;
    }

    case "accent_armchair":
    case "reading_lounge_chair": {
      const legH = 0.18;
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          addCylinder(group, 0.022, 0.015, legH, sx * (w * 0.36), legH / 2, sz * (d * 0.34), oakMat, 12);
        }
      }
      addRoundedBox(group, w * 0.88, 0.18, d * 0.86, 0, legH + 0.09, 0, primaryMat, 0.05);
      const back = addRoundedBox(group, w * 0.86, h - legH - 0.14, 0.15, 0, legH + 0.18 + (h - legH - 0.18) / 2, -d * 0.34, primaryMat, 0.055);
      back.rotation.x = -0.16;
      addRoundedBox(group, 0.12, 0.27, d * 0.78, -w * 0.42, legH + 0.25, -0.02, primaryMat, 0.045);
      addRoundedBox(group, 0.12, 0.27, d * 0.78, w * 0.42, legH + 0.25, -0.02, primaryMat, 0.045);
      addRoundedBox(group, w * 0.48, 0.28, 0.09, 0, legH + 0.3, -d * 0.18, creamMat, 0.035);
      if (item.catalogKey === "reading_lounge_chair") {
        addCylinder(group, 0.19, 0.16, 0.28, 0, 0.14, d * 0.62, primaryMat, 20);
      }
      break;
    }

    case "coffee_table": {
      const topH = 0.04;
      addRoundedBox(group, w, topH, d, 0, h - topH / 2, 0, lib.finishes.WHITE_MARBLE, 0.018);
      addRoundedBox(group, w * 0.92, 0.05, d * 0.86, 0, h - topH - 0.025, 0, primaryMat, 0.015);
      addRoundedBox(group, w * 0.78, 0.028, d * 0.7, 0, 0.14, 0, primaryMat, 0.01);
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          addCylinder(group, 0.022, 0.017, h - topH, sx * (w * 0.41), (h - topH) / 2, sz * (d * 0.38), primaryMat, 14);
        }
      }
      addCylinder(group, 0.12, 0.11, 0.02, -0.14, h + 0.01, 0.02, lib.terracottaPot, 18);
      addRoundedBox(group, 0.22, 0.03, 0.16, 0.16, h + 0.015, -0.03, lib.finishes.SAGE_LINEN, 0.008);
      break;
    }

    case "area_rug": {
      addRoundedBox(group, w, Math.max(0.012, h), d, 0, Math.max(0.006, h / 2), 0, primaryMat, 0.005, 2, false);
      addRoundedBox(group, w - 0.14, Math.max(0.014, h + 0.002), d - 0.14, 0, Math.max(0.007, h / 2), 0, lib.finishes.CREAM_BOUCLE, 0.005, 2, false);
      break;
    }

    case "tv_console_slat": {
      addBox(group, w, h, 0.04, 0, h / 2, -d / 2 + 0.02, lib.slattedWood);
      addBox(group, 0.025, h * 0.88, 0.03, w / 2 - 0.04, h / 2, -d / 2 + 0.045, lib.warmLedStrip, false);
      const cabH = 0.32;
      addRoundedBox(group, w * 0.94, cabH, d - 0.04, 0, 0.22 + cabH / 2, 0.02, primaryMat, 0.016);
      addBox(group, w * 0.92, 0.012, 0.012, 0, 0.22 + cabH - 0.05, d / 2, darkMetal, false);
      break;
    }

    case "smart_tv": {
      const mountY = item.elevationCm !== undefined ? h / 2 : 1.02 + h / 2;
      addRoundedBox(group, w + 0.02, h + 0.02, Math.max(0.03, d * 0.6), 0, mountY, -0.01, darkMetal, 0.008);
      addBox(group, w - 0.02, h - 0.02, 0.015, 0, mountY, 0.022, lib.screenDark, false);
      addBox(group, w * 0.45, h * 0.04, 0.006, 0, mountY - h * 0.36, 0.032, lib.screenGlow, false);
      break;
    }

    case "shoe_cabinet_tall":
    case "wardrobe_tall":
    case "wardrobe_compact": {
      addBox(group, w, h, d, 0, h / 2, 0, primaryMat);
      const doorCount = w >= 1.7 ? 4 : w >= 1.1 ? 3 : 2;
      const doorW = w / doorCount;
      for (let i = 1; i < doorCount; i++) {
        addBox(group, 0.012, h - 0.08, 0.014, -w / 2 + i * doorW, h / 2, d / 2 + 0.004, darkMetal, false);
      }
      for (let i = 0; i < doorCount; i++) {
        const hx = -w / 2 + i * doorW + (i % 2 === 0 ? doorW - 0.06 : 0.06);
        addBox(group, 0.016, 0.36, 0.024, hx, 1.15, d / 2 + 0.014, darkMetal, false);
      }
      if (item.catalogKey === "shoe_cabinet_tall") {
        addBox(group, w * 0.88, 0.34, d * 0.55, 0, 1.02, d * 0.25, oakMat);
        addBox(group, w * 0.82, 0.018, 0.02, 0, 1.17, d * 0.36, lib.warmLedStrip, false);
      }
      break;
    }

    case "fridge_top_cabinet": {
      if (item.elevationCm === undefined) effectiveElevationY = 1.85;
      addRoundedBox(group, w, h, d, 0, h / 2, 0, primaryMat, 0.012);
      addBox(group, 0.012, h - 0.04, 0.012, 0, h / 2, d / 2 + 0.004, darkMetal, false);
      addBox(group, 0.14, 0.014, 0.02, -w * 0.16, 0.08, d / 2 + 0.012, darkMetal, false);
      addBox(group, 0.14, 0.014, 0.02, w * 0.16, 0.08, d / 2 + 0.012, darkMetal, false);
      break;
    }

    case "dining_set_4": {
      const topH = 0.04;
      addRoundedBox(group, w, topH, d, 0, h - topH / 2, 0, primaryMat, 0.016);
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          addCylinder(group, 0.026, 0.02, h - topH, sx * (w / 2 - 0.09), (h - topH) / 2, sz * (d / 2 - 0.08), primaryMat, 12);
        }
      }
      const chairOffsets = [
        { x: -w * 0.26, z: -d / 2 - 0.16, rot: 0 },
        { x: w * 0.26, z: -d / 2 - 0.16, rot: 0 },
        { x: -w * 0.26, z: d / 2 + 0.16, rot: Math.PI },
        { x: w * 0.26, z: d / 2 + 0.16, rot: Math.PI },
      ];
      for (const c of chairOffsets) {
        const chair = new THREE.Group();
        chair.position.set(c.x, 0, c.z);
        chair.rotation.y = c.rot;
        addRoundedBox(chair, 0.42, 0.055, 0.4, 0, 0.45, 0, lib.finishes.CHARCOAL_SLATE, 0.02);
        addRoundedBox(chair, 0.4, 0.34, 0.045, 0, 0.66, -0.18, primaryMat, 0.02);
        for (const lx of [-0.17, 0.17]) {
          for (const lz of [-0.16, 0.16]) {
            addCylinder(chair, 0.015, 0.012, 0.44, lx, 0.22, lz, primaryMat, 10);
          }
        }
        group.add(chair);
      }
      break;
    }

    case "folding_dining_table": {
      const topH = 0.038;
      // Center fixed leaf + 2 hinged drop leaves
      addRoundedBox(group, w * 0.46, topH, d, 0, h - topH / 2, 0, primaryMat, 0.014);
      addRoundedBox(group, w * 0.26, topH * 0.92, d - 0.01, -w * 0.37, h - topH / 2, 0, primaryMat, 0.012);
      addRoundedBox(group, w * 0.26, topH * 0.92, d - 0.01, w * 0.37, h - topH / 2, 0, primaryMat, 0.012);
      // Central storage cabinet pillar
      addBox(group, w * 0.38, h - topH - 0.06, d * 0.78, 0, (h - topH) / 2, 0, creamMat);
      // Folding gate legs on sides
      for (const sx of [-1, 1]) {
        addCylinder(group, 0.018, 0.016, h - topH, sx * (w * 0.42), (h - topH) / 2, 0, oakMat, 10);
      }
      // 2 compact chairs
      for (const sz of [-1, 1]) {
        const chair = new THREE.Group();
        chair.position.set(0, 0, sz * (d / 2 + 0.16));
        chair.rotation.y = sz > 0 ? Math.PI : 0;
        addRoundedBox(chair, 0.4, 0.048, 0.38, 0, 0.45, 0, lib.finishes.CREAM_BOUCLE, 0.018);
        addRoundedBox(chair, 0.38, 0.3, 0.04, 0, 0.64, -0.17, oakMat, 0.016);
        for (const lx of [-0.15, 0.15]) {
          for (const lz of [-0.14, 0.14]) {
            addCylinder(chair, 0.014, 0.012, 0.44, lx, 0.22, lz, oakMat, 8);
          }
        }
        group.add(chair);
      }
      break;
    }

    case "mini_kitchen_island": {
      // Marble waterfall countertop + fluted wood base + 2 high bar stools
      addRoundedBox(group, w, 0.045, d, 0, h - 0.022, 0, lib.finishes.WHITE_MARBLE, 0.012);
      addBox(group, 0.04, h - 0.045, d, -w / 2 + 0.02, (h - 0.045) / 2, 0, lib.finishes.WHITE_MARBLE);
      addBox(group, 0.04, h - 0.045, d, w / 2 - 0.02, (h - 0.045) / 2, 0, lib.finishes.WHITE_MARBLE);
      addBox(group, w - 0.08, h - 0.06, d * 0.62, 0, (h - 0.06) / 2, -d * 0.14, lib.slattedWood);
      // 2 minimalist bar stools tucked on front overhang
      for (const sx of [-w * 0.24, w * 0.24]) {
        addCylinder(group, 0.16, 0.15, 0.05, sx, 0.63, d * 0.36, lib.finishes.CREAM_BOUCLE, 18);
        addCylinder(group, 0.018, 0.022, 0.62, sx, 0.31, d * 0.36, darkMetal, 10);
        addCylinder(group, 0.14, 0.15, 0.02, sx, 0.01, d * 0.36, darkMetal, 16);
      }
      break;
    }

    case "vanity_desk_mirror": {
      const deskH = 0.75;
      addRoundedBox(group, w, 0.12, d, 0, deskH - 0.06, 0, primaryMat, 0.016);
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          addCylinder(group, 0.016, 0.012, deskH - 0.1, sx * (w / 2 - 0.06), (deskH - 0.1) / 2, sz * (d / 2 - 0.05), darkMetal, 10);
        }
      }
      // Circular LED mirror mounted on desk back
      const mirR = Math.min(0.24, w * 0.28);
      const mirY = deskH + mirR + 0.08;
      const ring = addCylinder(group, mirR + 0.018, mirR + 0.018, 0.022, 0, mirY, -d / 2 + 0.05, lib.warmLedStrip, 24, false);
      ring.rotation.x = Math.PI / 2;
      const glass = addCylinder(group, mirR, mirR, 0.028, 0, mirY, -d / 2 + 0.052, lib.mirrorGlass, 24, false);
      glass.rotation.x = Math.PI / 2;
      // Round Boucle stool tucked under desk
      addCylinder(group, 0.17, 0.16, 0.1, 0, 0.4, d * 0.32, lib.finishes.CREAM_BOUCLE, 18);
      addCylinder(group, 0.15, 0.14, 0.35, 0, 0.175, d * 0.32, oakMat, 16);
      break;
    }

    case "kitchen_l_hafele": {
      const counterH = 0.85;
      const counterD = 0.6;
      addBox(group, w, counterH - 0.04, counterD, 0, (counterH - 0.04) / 2, d / 2 - counterD / 2, oakMat);
      addBox(group, w, 0.04, counterD + 0.02, 0, counterH - 0.02, d / 2 - counterD / 2, lib.kitchenGranite);
      addBox(group, counterD, counterH - 0.04, d - counterD, w / 2 - counterD / 2, (counterH - 0.04) / 2, -counterD / 2, oakMat);
      addBox(group, counterD + 0.02, 0.04, d - counterD, w / 2 - counterD / 2, counterH - 0.02, -counterD / 2, lib.kitchenGranite);
      // Glossy marble/glass backsplash between counter and upper cabinets
      addBox(group, w, 0.68, 0.02, 0, counterH + 0.34, d / 2 - 0.01, lib.wcMarbleWall, false);
      addBox(group, 0.02, 0.68, d, w / 2 - 0.01, counterH + 0.34, 0, lib.wcMarbleWall, false);
      // Upper glossy Acrylic cabinets (Hafele spec)
      const upperH = 0.78;
      const upperY = 1.52 + upperH / 2;
      addBox(group, w, upperH, 0.36, 0, upperY, d / 2 - 0.18, creamMat);
      addBox(group, 0.36, upperH, d - 0.36, w / 2 - 0.18, upperY, -0.18, creamMat);
      addBox(group, w * 0.9, 0.016, 0.02, 0, 1.5, d / 2 - 0.32, lib.warmLedStrip, false);
      addBox(group, 0.02, 0.016, d * 0.72, w / 2 - 0.32, 1.5, -0.18, lib.warmLedStrip, false);
      // Hafele 3-zone Induction Hob + Hood on East run
      addBox(group, 0.44, 0.015, 0.64, w / 2 - 0.32, counterH + 0.008, -0.25, lib.screenDark, false);
      addBox(group, 0.42, 0.12, 0.72, w / 2 - 0.24, 1.52, -0.25, lib.chromeMetal);
      // Hafele Stainless Sink + Swan-neck Faucet on South run
      addBox(group, 0.62, 0.02, 0.42, -0.22, counterH + 0.008, d / 2 - 0.3, lib.chromeMetal, false);
      addCylinder(group, 0.015, 0.015, 0.28, -0.22, counterH + 0.14, d / 2 - 0.08, lib.chromeMetal, 10);
      addBox(group, 0.025, 0.025, 0.14, -0.22, counterH + 0.28, d / 2 - 0.14, lib.chromeMetal, false);
      break;
    }

    case "wc_hafele_set": {
      // 3-zone Hafele bathroom:
      // 1. Top-left Toilet booth
      addRoundedBox(group, 0.38, 0.44, 0.2, -w * 0.26, 0.58, -d * 0.35, creamMat, 0.03);
      addCylinder(group, 0.18, 0.14, 0.38, -w * 0.1, 0.19, -d * 0.35, creamMat, 16);
      addRoundedBox(group, 0.38, 0.04, 0.34, -w * 0.1, 0.4, -d * 0.35, creamMat, 0.02);
      // 2. Bottom-left Frameless Tempered-Glass Shower Stall + Rain Shower
      addBox(group, 0.022, 2.08, d * 0.46, -w * 0.05, 1.04, d * 0.16, lib.glassClear, false);
      addBox(group, 0.035, 2.08, 0.035, -w * 0.05, 1.04, d * 0.39, lib.chromeMetal, false);
      addCylinder(group, 0.014, 0.014, 1.85, -w * 0.42, 1.12, d * 0.14, lib.chromeMetal, 10);
      addCylinder(group, 0.11, 0.11, 0.02, -w * 0.31, 2.02, d * 0.14, lib.chromeMetal, 16);
      // 3. Bottom-right Separate Recessed Lavabo + Illuminated Mirror
      addRoundedBox(group, 0.72, 0.46, 0.44, w * 0.26, 0.58, d * 0.32, oakMat, 0.016);
      addRoundedBox(group, 0.74, 0.04, 0.46, w * 0.26, 0.83, d * 0.32, lib.finishes.WHITE_MARBLE, 0.01);
      addRoundedBox(group, 0.46, 0.09, 0.32, w * 0.26, 0.89, d * 0.3, creamMat, 0.03);
      addCylinder(group, 0.014, 0.014, 0.16, w * 0.26, 0.92, d * 0.42, lib.chromeMetal, 10);
      addBox(group, 0.68, 0.76, 0.025, w * 0.26, 1.48, d * 0.47, lib.mirrorGlass, false);
      addBox(group, 0.66, 0.02, 0.02, w * 0.26, 1.88, d * 0.45, lib.warmLedStrip, false);
      break;
    }

    case "bed_master_160":
    case "bed_compact_140": {
      const frameH = 0.28;
      const mattH = 0.22;
      addRoundedBox(group, w, frameH, d, 0, frameH / 2, 0, primaryMat, 0.022);
      addRoundedBox(group, w + 0.04, h, 0.12, 0, h / 2, -d / 2 + 0.06, primaryMat, 0.025);
      addRoundedBox(group, w - 0.08, h * 0.55, 0.07, 0, h * 0.62, -d / 2 + 0.14, lib.finishes.CREAM_BOUCLE, 0.035);
      addRoundedBox(group, w - 0.06, mattH, d - 0.16, 0, frameH + mattH / 2, 0.05, lib.beddingLight, 0.05);
      addRoundedBox(group, w - 0.02, mattH * 0.34, d * 0.56, 0, frameH + mattH + 0.02, d * 0.18, lib.finishes.SAGE_LINEN, 0.035);
      addRoundedBox(group, w * 0.39, 0.13, 0.38, -w * 0.22, frameH + mattH + 0.06, -d / 2 + 0.36, creamMat, 0.048);
      addRoundedBox(group, w * 0.39, 0.13, 0.38, w * 0.22, frameH + mattH + 0.06, -d / 2 + 0.36, creamMat, 0.048);
      break;
    }

    case "tatami_podium_bed": {
      const podH = Math.max(0.28, h - 0.14);
      addRoundedBox(group, w, podH, d, 0, podH / 2, 0, primaryMat, 0.015);
      // 3 visible storage drawer reveals on front face
      for (let i = -1; i <= 1; i++) {
        addBox(group, w * 0.28, 0.018, 0.014, i * (w * 0.31), podH * 0.72, d / 2 + 0.006, darkMetal, false);
      }
      // Low Japanese futon mattress + warm linen blanket + 2 pillows
      addRoundedBox(group, w * 0.88, 0.13, d * 0.88, 0, podH + 0.065, 0, lib.beddingLight, 0.045);
      addRoundedBox(group, w * 0.86, 0.04, d * 0.5, 0, podH + 0.14, d * 0.16, lib.finishes.SAGE_LINEN, 0.02);
      addRoundedBox(group, w * 0.34, 0.1, 0.34, -w * 0.2, podH + 0.17, -d * 0.28, creamMat, 0.038);
      addRoundedBox(group, w * 0.34, 0.1, 0.34, w * 0.2, podH + 0.17, -d * 0.28, creamMat, 0.038);
      break;
    }

    case "nightstand": {
      addRoundedBox(group, w, h * 0.78, d, 0, h * 0.12 + (h * 0.78) / 2, 0, primaryMat, 0.018);
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          addCylinder(group, 0.015, 0.012, h * 0.14, sx * (w * 0.38), h * 0.07, sz * (d * 0.38), darkMetal, 10);
        }
      }
      addCylinder(group, 0.06, 0.08, 0.14, 0, h + 0.07, 0, lib.terracottaPot, 14);
      addCylinder(group, 0.1, 0.12, 0.14, 0, h + 0.2, 0, lib.warmLedStrip, 16, false);
      break;
    }

    case "dual_workstation_desk": {
      const topH = 0.045;
      addRoundedBox(group, w, topH, d, 0, h - topH / 2, 0, primaryMat, 0.014);
      addBox(group, w * 0.88, 0.1, 0.12, 0, h - topH - 0.06, -d / 2 + 0.1, darkMetal);
      const pedW = 0.38;
      addBox(group, pedW, h - topH - 0.02, d - 0.1, 0, (h - topH - 0.02) / 2, 0, creamMat);
      addBox(group, pedW - 0.04, 0.012, 0.015, 0, h * 0.64, d / 2 - 0.04, darkMetal, false);
      addBox(group, pedW - 0.04, 0.012, 0.015, 0, h * 0.36, d / 2 - 0.04, darkMetal, false);
      for (const sx of [-1, 1]) {
        const lx = sx * (w / 2 - 0.05);
        addBox(group, 0.04, h - topH, 0.04, lx, (h - topH) / 2, -d / 2 + 0.06, darkMetal);
        addBox(group, 0.04, h - topH, 0.04, lx, (h - topH) / 2, d / 2 - 0.06, darkMetal);
        addBox(group, 0.04, 0.04, d - 0.12, lx, 0.06, 0, darkMetal);
      }
      const stationOffsets = [-w * 0.28, w * 0.28];
      for (const sx of stationOffsets) {
        addBox(group, 0.72, 0.008, 0.32, sx, h + 0.004, 0.12, lib.finishes.CHARCOAL_SLATE, false);
        addBox(group, 0.16, 0.018, 0.14, sx, h + 0.009, -0.16, darkMetal);
        addBox(group, 0.035, 0.24, 0.035, sx, h + 0.13, -0.19, darkMetal);
        addBox(group, 0.62, 0.36, 0.025, sx, h + 0.34, -0.16, lib.screenDark);
        addBox(group, 0.58, 0.32, 0.008, sx, h + 0.34, -0.145, lib.screenGlow, false);
        addBox(group, 0.42, 0.018, 0.022, sx, h + 0.53, -0.14, lib.warmLedStrip, false);
        addBox(group, 0.34, 0.016, 0.12, sx - 0.04, h + 0.014, 0.13, creamMat);
        const lapX = sx + (sx < 0 ? -0.34 : 0.34);
        addBox(group, 0.28, 0.015, 0.2, lapX, h + 0.01, -0.02, lib.chromeMetal);
        const lapScreen = addBox(group, 0.28, 0.19, 0.01, lapX, h + 0.1, -0.12, lib.screenDark);
        lapScreen.rotation.x = -0.22;
      }
      break;
    }

    case "single_desk": {
      const topH = 0.04;
      addRoundedBox(group, w, topH, d, 0, h - topH / 2, 0, primaryMat, 0.014);
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          addBox(group, 0.035, h - topH, 0.035, sx * (w / 2 - 0.05), (h - topH) / 2, sz * (d / 2 - 0.05), darkMetal);
        }
      }
      addBox(group, 0.32, 0.015, 0.22, 0, h + 0.008, 0.02, lib.chromeMetal);
      const ls = addBox(group, 0.32, 0.21, 0.01, 0, h + 0.11, -0.09, lib.screenDark);
      ls.rotation.x = -0.2;
      break;
    }

    case "dual_monitor_arm": {
      if (item.elevationCm === undefined) effectiveElevationY = 0.75;
      // Desk clamp + pole
      addCylinder(group, 0.035, 0.035, 0.04, 0, 0.02, -d * 0.35, darkMetal, 12);
      addCylinder(group, 0.018, 0.018, h * 0.72, 0, h * 0.36, -d * 0.35, darkMetal, 10);
      // Dual curved-angled 27" monitors
      const monW = w * 0.46;
      const monH = h * 0.62;
      for (const sx of [-1, 1]) {
        const arm = addBox(group, w * 0.26, 0.024, 0.024, sx * (w * 0.13), h * 0.56, -d * 0.26, darkMetal);
        arm.rotation.y = sx * 0.2;
        const monGroup = new THREE.Group();
        monGroup.position.set(sx * (w * 0.24), h * 0.62, -d * 0.1);
        monGroup.rotation.y = -sx * 0.18;
        addBox(monGroup, monW, monH, 0.022, 0, 0, 0, lib.screenDark);
        addBox(monGroup, monW - 0.03, monH - 0.03, 0.008, 0, 0, 0.014, lib.screenGlow, false);
        group.add(monGroup);
      }
      break;
    }

    case "pc_tower_stand": {
      // Wheeled stand + Mid-tower glass side PC case + warm LED accent strip
      addBox(group, w + 0.03, 0.025, d + 0.03, 0, 0.05, 0, oakMat);
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          addCylinder(group, 0.018, 0.018, 0.035, sx * (w * 0.4), 0.018, sz * (d * 0.4), darkMetal, 8);
        }
      }
      addRoundedBox(group, w, h - 0.06, d, 0, 0.06 + (h - 0.06) / 2, 0, primaryMat, 0.012);
      addBox(group, 0.01, (h - 0.12) * 0.8, d * 0.78, w / 2 + 0.003, 0.06 + (h - 0.06) / 2, 0, lib.glassClear, false);
      addBox(group, 0.012, (h - 0.14) * 0.72, 0.015, w / 2 - 0.01, 0.06 + (h - 0.06) / 2, d * 0.32, lib.screenGlow, false);
      break;
    }

    case "desk_lamp_screenbar": {
      if (item.elevationCm === undefined) effectiveElevationY = 0.75;
      addCylinder(group, 0.07, 0.075, 0.02, 0, 0.01, -0.02, darkMetal, 16);
      const lowerArm = addCylinder(group, 0.009, 0.009, h * 0.55, 0, h * 0.28, -0.04, darkMetal, 8);
      lowerArm.rotation.x = -0.22;
      const upperArm = addCylinder(group, 0.008, 0.008, h * 0.48, 0, h * 0.72, 0.01, darkMetal, 8);
      upperArm.rotation.x = 0.32;
      addRoundedBox(group, w, 0.026, 0.035, 0, h - 0.03, 0.06, darkMetal, 0.01);
      addBox(group, w * 0.9, 0.012, 0.022, 0, h - 0.046, 0.06, lib.warmLedStrip, false);
      break;
    }

    case "rolling_file_cabinet": {
      const bodyH = h - 0.05;
      addRoundedBox(group, w, bodyH, d, 0, 0.05 + bodyH / 2, 0, primaryMat, 0.012);
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          addCylinder(group, 0.02, 0.02, 0.04, sx * (w * 0.36), 0.02, sz * (d * 0.38), darkMetal, 8);
        }
      }
      for (const ry of [0.25, 0.52, 0.78]) {
        addBox(group, w * 0.52, 0.016, 0.016, 0, 0.05 + bodyH * ry, d / 2 + 0.006, darkMetal, false);
      }
      break;
    }

    case "beanbag_lounger": {
      const sphereGeo = new THREE.SphereGeometry(Math.max(w, d) * 0.48, 22, 16);
      sphereGeo.scale(1, (h / Math.max(w, d)) * 1.15, 1.04);
      const body = new THREE.Mesh(sphereGeo, primaryMat);
      body.position.set(0, h * 0.44, 0);
      body.castShadow = true;
      body.receiveShadow = true;
      group.add(body);
      const backGeo = new THREE.SphereGeometry(Math.max(w, d) * 0.32, 16, 12);
      const back = new THREE.Mesh(backGeo, primaryMat);
      back.position.set(0, h * 0.66, -d * 0.16);
      back.castShadow = true;
      group.add(back);
      break;
    }

    case "ergonomic_chair": {
      const starY = 0.06;
      addCylinder(group, 0.032, 0.032, 0.34, 0, 0.23, 0, darkMetal, 12);
      for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2;
        const arm = addBox(group, 0.28, 0.028, 0.034, Math.cos(angle) * 0.14, starY, Math.sin(angle) * 0.14, darkMetal);
        arm.rotation.y = -angle;
      }
      addRoundedBox(group, w * 0.78, 0.075, d * 0.76, 0, 0.45, 0.02, primaryMat, 0.028);
      for (const sx of [-1, 1]) {
        addBox(group, 0.035, 0.2, 0.04, sx * (w * 0.42), 0.56, 0.02, darkMetal);
        addRoundedBox(group, 0.075, 0.03, 0.24, sx * (w * 0.42), 0.67, 0.02, darkMetal, 0.01);
      }
      const back = addRoundedBox(group, w * 0.74, 0.54, 0.055, 0, 0.76, -d * 0.32, primaryMat, 0.025);
      back.rotation.x = -0.1;
      const head = addRoundedBox(group, w * 0.46, 0.14, 0.05, 0, h - 0.07, -d * 0.36, primaryMat, 0.024);
      head.rotation.x = 0.08;
      break;
    }

    case "tall_bookshelf_led": {
      addBox(group, w, h, 0.03, 0, h / 2, -d / 2 + 0.015, primaryMat);
      addBox(group, 0.03, h, d, -w / 2 + 0.015, h / 2, 0, primaryMat);
      addBox(group, 0.03, h, d, w / 2 - 0.015, h / 2, 0, primaryMat);
      addBox(group, w - 0.04, 0.78, d - 0.02, 0, 0.39, 0.01, creamMat);
      const shelfYs = [0.8, 1.25, 1.7, 2.15, h - 0.02];
      const bookMats = [lib.finishes.SAGE_LINEN, lib.finishes.CHARCOAL_SLATE, lib.finishes.LIGHT_WALNUT, creamMat];
      shelfYs.forEach((sy, idx) => {
        addBox(group, w - 0.04, 0.03, d, 0, sy, 0, primaryMat);
        if (idx < 4) {
          addBox(group, w - 0.12, 0.014, 0.016, 0, sy + 0.41, -d / 2 + 0.06, lib.warmLedStrip, false);
          for (let b = 0; b < 5; b++) {
            const bx = -w * 0.34 + b * (w * 0.15);
            const bh = 0.22 + ((idx + b) % 3) * 0.04;
            addBox(group, 0.042, bh, 0.2, bx, sy + 0.015 + bh / 2, 0, bookMats[(idx + b) % bookMats.length]);
          }
        }
      });
      break;
    }

    case "pegboard_goal_wall": {
      const mountY = item.elevationCm !== undefined ? h / 2 : 1.48;
      addBox(group, w, h, Math.max(0.03, d * 0.5), 0, mountY, 0, lib.pegboardMat);
      addBox(group, w + 0.04, 0.03, 0.045, 0, mountY + h / 2, 0.005, oakMat);
      addBox(group, w + 0.04, 0.03, 0.045, 0, mountY - h / 2, 0.005, oakMat);
      addBox(group, w * 0.36, 0.02, 0.11, -w * 0.22, mountY - 0.15, 0.06, oakMat);
      addBox(group, 0.34, 0.24, 0.012, w * 0.22, mountY + 0.12, 0.03, lib.finishes.SAGE_LINEN, false);
      addBox(group, 0.28, 0.2, 0.012, -w * 0.18, mountY + 0.16, 0.03, creamMat, false);
      addBox(group, w * 0.85, 0.015, 0.02, 0, mountY + h / 2 - 0.03, 0.035, lib.warmLedStrip, false);
      break;
    }

    case "pendant_dining_light": {
      if (item.elevationCm === undefined) effectiveElevationY = 1.95;
      // Sleek linear pendant bar + 2 ceiling rods + underside warm LED strip
      addRoundedBox(group, w, 0.045, 0.06, 0, 0.022, 0, darkMetal, 0.012, 2, false);
      addBox(group, w * 0.94, 0.014, 0.036, 0, 0.004, 0, lib.warmLedStrip, false);
      const rodH = Math.max(0.35, h);
      addCylinder(group, 0.005, 0.005, rodH, -w * 0.36, rodH / 2 + 0.04, 0, darkMetal, 6, false);
      addCylinder(group, 0.005, 0.005, rodH, w * 0.36, rodH / 2 + 0.04, 0, darkMetal, 6, false);
      addBox(group, w * 0.78, 0.024, 0.07, 0, rodH + 0.04, 0, darkMetal, false);
      break;
    }

    case "floor_arc_lamp": {
      addCylinder(group, 0.15, 0.16, 0.06, 0, 0.03, -d * 0.24, lib.finishes.WHITE_MARBLE, 18);
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.06, -d * 0.24),
        new THREE.Vector3(0, h * 0.65, -d * 0.22),
        new THREE.Vector3(0, h * 0.96, 0),
        new THREE.Vector3(0, h * 0.9, d * 0.34),
      ]);
      const tubeGeo = new THREE.TubeGeometry(curve, 22, 0.013, 8, false);
      const tubeMesh = new THREE.Mesh(tubeGeo, lib.floorTrimMetal);
      tubeMesh.castShadow = true;
      group.add(tubeMesh);
      // Drum linen shade + warm bulb
      addCylinder(group, 0.14, 0.18, 0.2, 0, h * 0.82, d * 0.34, lib.finishes.CREAM_BOUCLE, 18);
      addCylinder(group, 0.08, 0.08, 0.08, 0, h * 0.78, d * 0.34, lib.warmLedStrip, 12, false);
      break;
    }

    case "wall_art_duo": {
      if (item.elevationCm === undefined) effectiveElevationY = 1.32;
      const gap = 0.08;
      const frameW = (w - gap) / 2;
      const artColors = [lib.finishes.SAGE_LINEN, lib.finishes.WARM_OAK];
      for (let i = 0; i < 2; i++) {
        const fx = i === 0 ? -(frameW / 2 + gap / 2) : frameW / 2 + gap / 2;
        // Oak frame
        addRoundedBox(group, frameW, h, 0.03, fx, h / 2, 0, oakMat, 0.006, 2, false);
        // Cream mat board
        addBox(group, frameW - 0.05, h - 0.05, 0.012, fx, h / 2, 0.014, creamMat, false);
        // Minimalist geometric accent art motif
        addRoundedBox(group, frameW * 0.56, h * 0.52, 0.008, fx, h * 0.52, 0.022, artColors[i], 0.01, 2, false);
        addCylinder(group, frameW * 0.16, frameW * 0.16, 0.01, fx + (i === 0 ? 0.06 : -0.06), h * 0.58, 0.026, lib.finishes.CHARCOAL_SLATE, 16, false);
      }
      break;
    }

    case "arch_full_mirror": {
      // Extruded arch wood frame + mirror surface + warm backlight strip
      const shape = new THREE.Shape();
      const hw = w / 2;
      const rectH = Math.max(0.4, h - hw);
      shape.moveTo(-hw, 0);
      shape.lineTo(hw, 0);
      shape.lineTo(hw, rectH);
      shape.absarc(0, rectH, hw, 0, Math.PI, false);
      shape.closePath();

      const frameGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.035, bevelEnabled: false });
      const frameMesh = new THREE.Mesh(frameGeo, primaryMat);
      frameMesh.position.set(0, 0, -0.018);
      frameMesh.castShadow = true;
      group.add(frameMesh);

      const innerShape = new THREE.Shape();
      const ihw = hw - 0.035;
      innerShape.moveTo(-ihw, 0.035);
      innerShape.lineTo(ihw, 0.035);
      innerShape.lineTo(ihw, rectH);
      innerShape.absarc(0, rectH, ihw, 0, Math.PI, false);
      innerShape.closePath();
      const glassGeo = new THREE.ShapeGeometry(innerShape);
      const glassMesh = new THREE.Mesh(glassGeo, lib.mirrorGlass);
      glassMesh.position.set(0, 0, 0.02);
      group.add(glassMesh);
      break;
    }

    case "loggia_drying_rack": {
      if (item.elevationCm === undefined) effectiveElevationY = 1.55;
      // Wall mounting brackets + 4 horizontal brushed aluminum drying bars
      addBox(group, 0.03, h, 0.03, -w / 2 + 0.04, h / 2, -d / 2 + 0.015, darkMetal, false);
      addBox(group, 0.03, h, 0.03, w / 2 - 0.04, h / 2, -d / 2 + 0.015, darkMetal, false);
      for (let i = 0; i < 4; i++) {
        const bz = -d / 2 + 0.06 + i * ((d - 0.08) / 3);
        const bar = addCylinder(group, 0.008, 0.008, w - 0.04, 0, h * 0.65, bz, lib.chromeMetal, 8, false);
        bar.rotation.z = Math.PI / 2;
      }
      break;
    }

    case "air_purifier": {
      const r = Math.min(w, d) * 0.48;
      addCylinder(group, r, r * 1.03, h, 0, h / 2, 0, primaryMat, 22);
      addCylinder(group, r * 0.78, r * 0.78, 0.018, 0, h + 0.005, 0, darkMetal, 18, false);
      addCylinder(group, r * 0.24, r * 0.24, 0.01, 0, h * 0.78, r * 0.96, lib.screenGlow, 14, false);
      break;
    }

    case "robot_vacuum_dock": {
      // Base charging tower + circular robot docked in front
      addRoundedBox(group, w * 0.82, h, d * 0.56, 0, h / 2, -d * 0.2, primaryMat, 0.025);
      addBox(group, w * 0.88, 0.025, d * 0.52, 0, 0.012, d * 0.22, darkMetal, false);
      addCylinder(group, w * 0.4, w * 0.4, 0.085, 0, 0.065, d * 0.18, creamMat, 22);
      addCylinder(group, 0.045, 0.045, 0.03, 0, 0.115, d * 0.18, darkMetal, 14);
      break;
    }

    case "dishwasher_compact": {
      addRoundedBox(group, w, h, d, 0, h / 2, 0, primaryMat, 0.014);
      addBox(group, w * 0.92, 0.085, 0.018, 0, h - 0.07, d / 2 + 0.006, lib.screenDark, false);
      addBox(group, w * 0.42, 0.016, 0.02, 0, h - 0.13, d / 2 + 0.012, lib.chromeMetal, false);
      break;
    }

    case "balcony_bistro_set": {
      // Round café table + 2 compact slatted teak chairs
      const tabR = Math.min(0.28, d * 0.48);
      addCylinder(group, tabR, tabR, 0.03, 0, h - 0.015, 0, primaryMat, 20);
      addCylinder(group, 0.02, 0.024, h - 0.03, 0, (h - 0.03) / 2, 0, darkMetal, 10);
      addCylinder(group, 0.16, 0.18, 0.02, 0, 0.01, 0, darkMetal, 16);
      for (const sx of [-1, 1]) {
        const cx = sx * (w * 0.36);
        const ch = new THREE.Group();
        ch.position.set(cx, 0, 0);
        ch.rotation.y = sx > 0 ? -Math.PI / 2 : Math.PI / 2;
        addRoundedBox(ch, 0.38, 0.035, 0.36, 0, 0.44, 0, primaryMat, 0.012);
        addRoundedBox(ch, 0.36, 0.32, 0.032, 0, 0.66, -0.16, primaryMat, 0.012);
        for (const lx of [-0.15, 0.15]) {
          for (const lz of [-0.14, 0.14]) {
            addCylinder(ch, 0.012, 0.01, 0.44, lx, 0.22, lz, darkMetal, 8);
          }
        }
        group.add(ch);
      }
      break;
    }

    case "fridge_inverter": {
      addRoundedBox(group, w, h, d, 0, h / 2, 0, primaryMat, 0.018);
      addBox(group, w + 0.006, 0.016, 0.015, 0, h * 0.38, d / 2 + 0.005, darkMetal, false);
      addBox(group, 0.022, 0.42, 0.025, -w / 2 + 0.06, h * 0.58, d / 2 + 0.015, darkMetal, false);
      break;
    }

    case "washer_dryer": {
      addRoundedBox(group, w, h, d, 0, h / 2, 0, primaryMat, 0.018);
      const drum = addCylinder(group, w * 0.32, w * 0.32, 0.04, 0, h * 0.48, d / 2 + 0.01, darkMetal, 20);
      drum.rotation.x = Math.PI / 2;
      const glass = addCylinder(group, w * 0.24, w * 0.24, 0.048, 0, h * 0.48, d / 2 + 0.014, lib.glassClear, 20, false);
      glass.rotation.x = Math.PI / 2;
      addBox(group, w * 0.92, 0.11, 0.02, 0, h - 0.08, d / 2 + 0.008, lib.finishes.CHARCOAL_SLATE, false);
      break;
    }

    case "ac_inverter": {
      const mountY = item.elevationCm !== undefined ? h / 2 : 2.28;
      addRoundedBox(group, w, h, d, 0, mountY, 0, primaryMat, 0.022);
      addBox(group, w * 0.9, 0.035, 0.02, 0, mountY - h * 0.32, d / 2 + 0.005, darkMetal, false);
      break;
    }

    case "floor_plant": {
      const potH = Math.min(0.36, h * 0.3);
      addCylinder(group, w * 0.38, w * 0.28, potH, 0, potH / 2, 0, lib.terracottaPot, 18);
      addCylinder(group, 0.022, 0.03, h * 0.48, 0, potH + h * 0.22, 0, lib.finishes.LIGHT_WALNUT, 10);
      const spheres: [number, number, number, number][] = [
        [0, potH + h * 0.46, 0, w * 0.44],
        [w * 0.22, potH + h * 0.38, w * 0.12, w * 0.3],
        [-w * 0.2, potH + h * 0.4, -w * 0.12, w * 0.32],
        [0.04, potH + h * 0.56, -0.05, w * 0.28],
      ];
      for (const [sx, sy, sz, sr] of spheres) {
        const geo = new THREE.DodecahedronGeometry(Math.max(0.08, sr), 1);
        const leaf = new THREE.Mesh(geo, lib.plantLeaf);
        leaf.position.set(sx, sy, sz);
        leaf.castShadow = true;
        leaf.receiveShadow = true;
        group.add(leaf);
      }
      break;
    }

    case "balcony_planter": {
      const boxH = Math.min(0.32, h * 0.48);
      addRoundedBox(group, w, boxH, d, 0, boxH / 2, 0, lib.terracottaPot, 0.018);
      for (let i = -1; i <= 1; i++) {
        const geo = new THREE.DodecahedronGeometry(Math.max(0.11, d * 0.55), 1);
        const bush = new THREE.Mesh(geo, lib.plantLeaf);
        bush.position.set(i * (w * 0.28), boxH + d * 0.38, 0);
        bush.castShadow = true;
        group.add(bush);
      }
      break;
    }

    case "custom_glb_model": {
      // Clean architectural bounding volume placeholder while async GLB loads (or if binary missing)
      addRoundedBox(group, w, h, d, 0, h / 2, 0, primaryMat, 0.02);
      break;
    }

    default: {
      addRoundedBox(group, w, h, d, 0, h / 2, 0, primaryMat, 0.02);
      break;
    }
  }

  const isElevated = effectiveElevationY > 0.02 || item.mountType === "WALL" || item.mountType === "SURFACE";
  if (!isElevated && !NO_CONTACT_SHADOW_KEYS.has(item.catalogKey)) {
    const shadowGeo = new THREE.PlaneGeometry(w * 1.16, d * 1.16);
    const shadowMesh = new THREE.Mesh(shadowGeo, lib.contactShadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.set(0, 0.004, 0);
    shadowMesh.renderOrder = 1;
    shadowMesh.castShadow = false;
    shadowMesh.receiveShadow = false;
    group.add(shadowMesh);
  }

  group.position.set(item.position.x, effectiveElevationY, item.position.z);
  group.rotation.y = (item.rotationDeg * Math.PI) / 180;
  tagFurnitureGroup(group, item);
  return group;
}

const sharedGltfLoader = new GLTFLoader();

/**
 * Nạp file .glb / .gltf từ IndexedDB Vault và tự động chuẩn hóa kích thước về đúng W×D×H (cm),
 * căn đáy-tâm tại (0, 0, 0) để đặt chuẩn xác vào căn hộ A.12A.07.
 */
export async function loadCustomGlbNormalized(
  customGlbId: string,
  dimensionsCm: { width: number; depth: number; height: number }
): Promise<THREE.Group | null> {
  const buffer = await loadCustomGlbBuffer(customGlbId);
  if (!buffer) return null;

  return new Promise((resolve) => {
    sharedGltfLoader.parse(
      buffer.slice(0),
      "",
      (gltf) => {
        const root = gltf.scene || gltf.scenes?.[0];
        if (!root) {
          resolve(null);
          return;
        }
        const wrapper = new THREE.Group();
        const box = new THREE.Box3().setFromObject(root);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);

        const targetW = Math.max(0.1, dimensionsCm.width / 100);
        const targetH = Math.max(0.1, dimensionsCm.height / 100);
        const targetD = Math.max(0.1, dimensionsCm.depth / 100);

        const sx = size.x > 1e-4 ? targetW / size.x : 1;
        const sy = size.y > 1e-4 ? targetH / size.y : 1;
        const sz = size.z > 1e-4 ? targetD / size.z : 1;

        root.position.set(-center.x, -box.min.y, -center.z);
        const scaler = new THREE.Group();
        scaler.scale.set(sx, sy, sz);
        scaler.add(root);

        scaler.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.castShadow = true;
            obj.receiveShadow = true;
          }
        });

        wrapper.add(scaler);
        resolve(wrapper);
      },
      () => {
        resolve(null);
      }
    );
  });
}
