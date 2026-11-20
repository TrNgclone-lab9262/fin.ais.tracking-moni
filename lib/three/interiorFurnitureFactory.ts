import * as THREE from "three";
import { InteriorFurnitureItem } from "@/types/finance";
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

function tagFurnitureGroup(group: THREE.Group, item: InteriorFurnitureItem): void {
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

/**
 * Dựng mô hình 3D tổ hợp (3–12 bộ phận) cho từng món nội thất chuẩn tỷ lệ 1 unit = 1 mét.
 * Pivot đặt tại đáy-tâm (y = 0) để di chuyển và xoay chính xác trên sàn căn hộ A.12A.07.
 */
export function buildFurnitureMeshGroup(
  item: InteriorFurnitureItem,
  lib: InteriorMaterialLibrary
): THREE.Group {
  const group = new THREE.Group();
  const w = Math.max(0.15, item.dimensionsCm.width / 100);
  const d = Math.max(0.06, item.dimensionsCm.depth / 100);
  const h = Math.max(0.02, item.dimensionsCm.height / 100);

  const primaryMat = lib.finishes[item.materialFinish] || lib.finishes.WARM_OAK;
  const oakMat = lib.finishes.WARM_OAK;
  const creamMat = lib.finishes.MATTE_CREAM;
  const darkMetal = lib.darkFrameMetal;

  switch (item.catalogKey) {
    case "sofa_3seat": {
      const legH = 0.12;
      const baseH = 0.24;
      const seatH = 0.14;
      const armW = Math.min(0.18, w * 0.1);
      // 4 tapered oak legs
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          addCylinder(group, 0.024, 0.018, legH, sx * (w / 2 - 0.12), legH / 2, sz * (d / 2 - 0.1), oakMat, 10);
        }
      }
      // Base plinth
      addBox(group, w - 0.04, baseH, d - 0.04, 0, legH + baseH / 2, 0, primaryMat);
      // 3 Seat cushions
      const innerW = w - armW * 2 - 0.04;
      const cushionW = innerW / 3 - 0.015;
      for (let i = -1; i <= 1; i++) {
        addBox(group, cushionW, seatH, d - 0.18, i * (cushionW + 0.015), legH + baseH + seatH / 2, 0.05, primaryMat);
      }
      // Backrest & 3 back pillows
      const backH = Math.max(0.32, h - legH - baseH);
      addBox(group, w, backH, 0.16, 0, legH + baseH + backH / 2 - 0.04, -d / 2 + 0.08, primaryMat);
      // Left & right arms
      addBox(group, armW, backH * 0.72, d - 0.06, -w / 2 + armW / 2, legH + baseH + backH * 0.32, 0, primaryMat);
      addBox(group, armW, backH * 0.72, d - 0.06, w / 2 - armW / 2, legH + baseH + backH * 0.32, 0, primaryMat);
      // 2 accent throw pillows
      const p1 = addBox(group, 0.36, 0.34, 0.1, -w / 2 + armW + 0.24, legH + baseH + seatH + 0.15, -d / 2 + 0.24, lib.finishes.SAGE_LINEN);
      p1.rotation.y = 0.22;
      const p2 = addBox(group, 0.34, 0.32, 0.1, w / 2 - armW - 0.24, legH + baseH + seatH + 0.14, -d / 2 + 0.24, oakMat);
      p2.rotation.y = -0.18;
      break;
    }

    case "accent_armchair":
    case "reading_lounge_chair": {
      const legH = 0.18;
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          addCylinder(group, 0.022, 0.016, legH, sx * (w * 0.38), legH / 2, sz * (d * 0.35), oakMat, 10);
        }
      }
      addBox(group, w * 0.88, 0.18, d * 0.86, 0, legH + 0.09, 0, primaryMat);
      const back = addBox(group, w * 0.86, h - legH - 0.14, 0.14, 0, legH + 0.18 + (h - legH - 0.18) / 2, -d * 0.34, primaryMat);
      back.rotation.x = -0.14;
      addBox(group, 0.11, 0.26, d * 0.78, -w * 0.42, legH + 0.25, -0.02, primaryMat);
      addBox(group, 0.11, 0.26, d * 0.78, w * 0.42, legH + 0.25, -0.02, primaryMat);
      // Cushion pillow
      addBox(group, w * 0.48, 0.28, 0.09, 0, legH + 0.3, -d * 0.18, creamMat);
      // Reading chair gets a compact ottoman in front
      if (item.catalogKey === "reading_lounge_chair") {
        addCylinder(group, 0.18, 0.16, 0.28, 0, 0.14, d * 0.62, primaryMat, 18);
      }
      break;
    }

    case "coffee_table": {
      const topH = 0.04;
      addBox(group, w, topH, d, 0, h - topH / 2, 0, lib.finishes.WHITE_MARBLE);
      addBox(group, w * 0.92, 0.05, d * 0.86, 0, h - topH - 0.025, 0, primaryMat);
      addBox(group, w * 0.78, 0.03, d * 0.7, 0, 0.14, 0, primaryMat);
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          addCylinder(group, 0.022, 0.018, h - topH, sx * (w * 0.41), (h - topH) / 2, sz * (d * 0.38), primaryMat, 12);
        }
      }
      // Small ceramic tray & decor book
      addCylinder(group, 0.12, 0.11, 0.02, -0.14, h + 0.01, 0.02, lib.terracottaPot, 16);
      addBox(group, 0.22, 0.03, 0.16, 0.16, h + 0.015, -0.03, lib.finishes.SAGE_LINEN);
      break;
    }

    case "area_rug": {
      addBox(group, w, Math.max(0.012, h), d, 0, Math.max(0.006, h / 2), 0, primaryMat, false);
      // Subtle geometric woven border
      addBox(group, w - 0.12, Math.max(0.014, h + 0.002), d - 0.12, 0, Math.max(0.007, h / 2), 0, lib.finishes.CREAM_BOUCLE, false);
      break;
    }

    case "tv_console_slat": {
      // Decorative floor-to-ceiling slatted wood wall behind TV
      addBox(group, w, h, 0.04, 0, h / 2, -d / 2 + 0.02, lib.slattedWood);
      // Vertical warm LED accent strip on right edge
      addBox(group, 0.025, h * 0.88, 0.03, w / 2 - 0.04, h / 2, -d / 2 + 0.045, lib.warmLedStrip, false);
      // Floating console cabinet
      const cabH = 0.32;
      addBox(group, w * 0.94, cabH, d - 0.04, 0, 0.22 + cabH / 2, 0.02, primaryMat);
      // Drawer seam accents
      addBox(group, w * 0.92, 0.012, 0.012, 0, 0.22 + cabH - 0.05, d / 2, darkMetal, false);
      break;
    }

    case "smart_tv": {
      // Mounted at ergonomic 1.05m bottom height above console
      const mountY = 1.02 + h / 2;
      addBox(group, w + 0.02, h + 0.02, Math.max(0.03, d * 0.6), 0, mountY, -0.01, darkMetal);
      addBox(group, w - 0.02, h - 0.02, 0.015, 0, mountY, 0.022, lib.screenDark, false);
      // Subtle screen reflection strip
      addBox(group, w * 0.45, h * 0.04, 0.006, 0, mountY - h * 0.36, 0.032, lib.screenGlow, false);
      break;
    }

    case "shoe_cabinet_tall":
    case "wardrobe_tall":
    case "wardrobe_compact": {
      // Main carcass
      addBox(group, w, h, d, 0, h / 2, 0, primaryMat);
      // Vertical door panel reveals
      const doorCount = w >= 1.7 ? 4 : w >= 1.1 ? 3 : 2;
      const doorW = w / doorCount;
      for (let i = 1; i < doorCount; i++) {
        addBox(group, 0.012, h - 0.08, 0.014, -w / 2 + i * doorW, h / 2, d / 2 + 0.004, darkMetal, false);
      }
      // Sleek handles
      for (let i = 0; i < doorCount; i++) {
        const hx = -w / 2 + i * doorW + (i % 2 === 0 ? doorW - 0.06 : 0.06);
        addBox(group, 0.016, 0.36, 0.024, hx, 1.15, d / 2 + 0.014, darkMetal, false);
      }
      // Open key-niche with warm LED for shoe cabinet
      if (item.catalogKey === "shoe_cabinet_tall") {
        addBox(group, w * 0.88, 0.34, d * 0.55, 0, 1.02, d * 0.25, oakMat);
        addBox(group, w * 0.82, 0.018, 0.02, 0, 1.17, d * 0.36, lib.warmLedStrip, false);
      }
      break;
    }

    case "dining_set_4": {
      // Dining table
      const topH = 0.04;
      addBox(group, w, topH, d, 0, h - topH / 2, 0, primaryMat);
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          addCylinder(group, 0.026, 0.02, h - topH, sx * (w / 2 - 0.09), (h - topH) / 2, sz * (d / 2 - 0.08), primaryMat, 10);
        }
      }
      // 4 minimalist dining chairs tucked cleanly on both sides
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
        addBox(chair, 0.42, 0.05, 0.4, 0, 0.45, 0, lib.finishes.CHARCOAL_SLATE);
        addBox(chair, 0.4, 0.36, 0.045, 0, 0.66, -0.18, primaryMat);
        for (const lx of [-0.17, 0.17]) {
          for (const lz of [-0.16, 0.16]) {
            addCylinder(chair, 0.015, 0.012, 0.44, lx, 0.22, lz, primaryMat, 8);
          }
        }
        group.add(chair);
      }
      break;
    }

    case "kitchen_l_hafele": {
      // Developer-delivered L-shaped kitchen (South sink run + East 3-zone Hafele induction hob run)
      const counterH = 0.85;
      const counterD = 0.6;
      // South lower cabinet (Sink side)
      addBox(group, w, counterH - 0.04, counterD, 0, (counterH - 0.04) / 2, d / 2 - counterD / 2, oakMat);
      addBox(group, w, 0.04, counterD + 0.02, 0, counterH - 0.02, d / 2 - counterD / 2, lib.kitchenGranite);
      // East lower cabinet (Hob side)
      addBox(group, counterD, counterH - 0.04, d - counterD, w / 2 - counterD / 2, (counterH - 0.04) / 2, -counterD / 2, oakMat);
      addBox(group, counterD + 0.02, 0.04, d - counterD, w / 2 - counterD / 2, counterH - 0.02, -counterD / 2, lib.kitchenGranite);
      // Upper glossy Acrylic cabinets (Hafele spec)
      const upperH = 0.78;
      const upperY = 1.52 + upperH / 2;
      addBox(group, w, upperH, 0.36, 0, upperY, d / 2 - 0.18, creamMat);
      addBox(group, 0.36, upperH, d - 0.36, w / 2 - 0.18, upperY, -0.18, creamMat);
      // Under-cabinet warm task LED
      addBox(group, w * 0.9, 0.016, 0.02, 0, 1.5, d / 2 - 0.32, lib.warmLedStrip, false);
      // Hafele 3-zone Induction Hob + Hood on East run
      addBox(group, 0.44, 0.015, 0.64, w / 2 - 0.32, counterH + 0.008, -0.25, lib.screenDark, false);
      addBox(group, 0.42, 0.12, 0.72, w / 2 - 0.24, 1.52, -0.25, lib.chromeMetal);
      // Hafele Stainless Sink + Faucet on South run
      addBox(group, 0.62, 0.02, 0.42, -0.22, counterH + 0.008, d / 2 - 0.3, lib.chromeMetal, false);
      addCylinder(group, 0.016, 0.016, 0.28, -0.22, counterH + 0.14, d / 2 - 0.08, lib.chromeMetal, 10);
      break;
    }

    case "wc_hafele_set": {
      // 3-zone Hafele bathroom: Top-left Toilet, Bottom-left Glass Shower Stall, Bottom-right Separate Lavabo
      // Toilet (north-west zone)
      addBox(group, 0.38, 0.42, 0.22, -w * 0.34, 0.56, -d * 0.32, creamMat);
      addCylinder(group, 0.18, 0.14, 0.4, -w * 0.12, 0.2, -d * 0.32, creamMat, 14);
      // Glass shower partition & Hafele rain shower (south-west zone)
      addBox(group, 0.02, 2.05, d * 0.46, -w * 0.08, 1.025, d * 0.16, lib.glassClear, false);
      addCylinder(group, 0.015, 0.015, 1.85, -w * 0.42, 1.12, d * 0.16, lib.chromeMetal, 10);
      addCylinder(group, 0.11, 0.11, 0.02, -w * 0.32, 2.02, d * 0.16, lib.chromeMetal, 14);
      // Separate Lavabo vanity + mirror (south-east zone)
      addBox(group, 0.68, 0.46, 0.44, w * 0.26, 0.58, d * 0.32, oakMat);
      addBox(group, 0.7, 0.04, 0.46, w * 0.26, 0.83, d * 0.32, lib.finishes.WHITE_MARBLE);
      addBox(group, 0.44, 0.08, 0.32, w * 0.26, 0.89, d * 0.3, creamMat);
      addBox(group, 0.64, 0.72, 0.025, w * 0.26, 1.48, d * 0.46, lib.glassClear, false);
      break;
    }

    case "bed_master_160":
    case "bed_compact_140": {
      const frameH = 0.28;
      const mattH = 0.22;
      // Platform storage bed base
      addBox(group, w, frameH, d, 0, frameH / 2, 0, primaryMat);
      // Upholstered headboard
      addBox(group, w + 0.04, h, 0.12, 0, h / 2, -d / 2 + 0.06, primaryMat);
      addBox(group, w - 0.08, h * 0.55, 0.06, 0, h * 0.62, -d / 2 + 0.14, lib.finishes.CREAM_BOUCLE);
      // Mattress
      addBox(group, w - 0.06, mattH, d - 0.16, 0, frameH + mattH / 2, 0.05, lib.beddingLight);
      // Folded duvet blanket on lower 60% of bed
      addBox(group, w - 0.03, mattH * 0.32, d * 0.56, 0, frameH + mattH + 0.02, d * 0.18, lib.finishes.SAGE_LINEN);
      // 2 Pillows
      addBox(group, w * 0.38, 0.12, 0.38, -w * 0.22, frameH + mattH + 0.06, -d / 2 + 0.36, creamMat);
      addBox(group, w * 0.38, 0.12, 0.38, w * 0.22, frameH + mattH + 0.06, -d / 2 + 0.36, creamMat);
      break;
    }

    case "nightstand": {
      addBox(group, w, h * 0.78, d, 0, h * 0.12 + (h * 0.78) / 2, 0, primaryMat);
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          addCylinder(group, 0.015, 0.012, h * 0.14, sx * (w * 0.38), h * 0.07, sz * (d * 0.38), darkMetal, 8);
        }
      }
      // Warm bedside lamp
      addCylinder(group, 0.06, 0.08, 0.14, 0, h + 0.07, 0, lib.terracottaPot, 12);
      addCylinder(group, 0.1, 0.12, 0.14, 0, h + 0.2, 0, lib.warmLedStrip, 14, false);
      break;
    }

    case "dual_workstation_desk": {
      // HERO PIECE FOR SCENARIO B — DUAL GROWTH STUDIO (2 PCs / 2 Laptops for Anh Chuột & Bé Mèo)
      const topH = 0.045;
      // Wide continuous oak tabletop
      addBox(group, w, topH, d, 0, h - topH / 2, 0, primaryMat);
      // Under-desk cable management modesty trough
      addBox(group, w * 0.88, 0.1, 0.12, 0, h - topH - 0.06, -d / 2 + 0.1, darkMetal);
      // Center shared storage pedestal drawer unit
      const pedW = 0.38;
      addBox(group, pedW, h - topH - 0.02, d - 0.1, 0, (h - topH - 0.02) / 2, 0, creamMat);
      addBox(group, pedW - 0.04, 0.012, 0.015, 0, h * 0.64, d / 2 - 0.04, darkMetal, false);
      addBox(group, pedW - 0.04, 0.012, 0.015, 0, h * 0.36, d / 2 - 0.04, darkMetal, false);
      // Sleek left & right steel A-frame legs
      for (const sx of [-1, 1]) {
        const lx = sx * (w / 2 - 0.05);
        addBox(group, 0.04, h - topH, 0.04, lx, (h - topH) / 2, -d / 2 + 0.06, darkMetal);
        addBox(group, 0.04, h - topH, 0.04, lx, (h - topH) / 2, d / 2 - 0.06, darkMetal);
        addBox(group, 0.04, 0.04, d - 0.12, lx, 0.06, 0, darkMetal);
      }

      // Station 1 (Left — Anh Chuột) & Station 2 (Right — Bé Mèo): 27" Monitor + Laptop + Keyboard + Mousepad + Monitor Lightbar
      const stationOffsets = [-w * 0.28, w * 0.28];
      for (const sx of stationOffsets) {
        // Desk mat
        addBox(group, 0.72, 0.008, 0.32, sx, h + 0.004, 0.12, lib.finishes.CHARCOAL_SLATE, false);
        // Monitor stand + 27-inch widescreen display
        addBox(group, 0.16, 0.018, 0.14, sx, h + 0.009, -0.16, darkMetal);
        addBox(group, 0.035, 0.24, 0.035, sx, h + 0.13, -0.19, darkMetal);
        addBox(group, 0.62, 0.36, 0.025, sx, h + 0.34, -0.16, lib.screenDark);
        addBox(group, 0.58, 0.32, 0.008, sx, h + 0.34, -0.145, lib.screenGlow, false);
        // Warm monitor lightbar on top of display
        addBox(group, 0.42, 0.018, 0.022, sx, h + 0.53, -0.14, lib.warmLedStrip, false);
        // Mechanical keyboard
        addBox(group, 0.34, 0.016, 0.12, sx - 0.04, h + 0.014, 0.13, creamMat);
        // Compact laptop on side riser
        const lapX = sx + (sx < 0 ? -0.34 : 0.34);
        addBox(group, 0.28, 0.015, 0.2, lapX, h + 0.01, -0.02, lib.chromeMetal);
        const lapScreen = addBox(group, 0.28, 0.19, 0.01, lapX, h + 0.1, -0.12, lib.screenDark);
        lapScreen.rotation.x = -0.22;
      }
      break;
    }

    case "single_desk": {
      const topH = 0.04;
      addBox(group, w, topH, d, 0, h - topH / 2, 0, primaryMat);
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          addBox(group, 0.035, h - topH, 0.035, sx * (w / 2 - 0.05), (h - topH) / 2, sz * (d / 2 - 0.05), darkMetal);
        }
      }
      // Laptop on desk
      addBox(group, 0.32, 0.015, 0.22, 0, h + 0.008, 0.02, lib.chromeMetal);
      const ls = addBox(group, 0.32, 0.21, 0.01, 0, h + 0.11, -0.09, lib.screenDark);
      ls.rotation.x = -0.2;
      break;
    }

    case "ergonomic_chair": {
      // 5-star caster wheel base
      const starY = 0.06;
      addCylinder(group, 0.032, 0.032, 0.34, 0, 0.23, 0, darkMetal, 12);
      for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2;
        const arm = addBox(group, 0.28, 0.028, 0.034, Math.cos(angle) * 0.14, starY, Math.sin(angle) * 0.14, darkMetal);
        arm.rotation.y = -angle;
      }
      // Contoured ergonomic seat
      addBox(group, w * 0.78, 0.07, d * 0.76, 0, 0.45, 0.02, primaryMat);
      // 3D Armrests
      for (const sx of [-1, 1]) {
        addBox(group, 0.035, 0.2, 0.04, sx * (w * 0.42), 0.56, 0.02, darkMetal);
        addBox(group, 0.07, 0.028, 0.24, sx * (w * 0.42), 0.67, 0.02, darkMetal);
      }
      // Tall breathable mesh backrest + headrest
      const back = addBox(group, w * 0.74, 0.54, 0.05, 0, 0.76, -d * 0.32, primaryMat);
      back.rotation.x = -0.1;
      const head = addBox(group, w * 0.46, 0.14, 0.045, 0, h - 0.07, -d * 0.36, primaryMat);
      head.rotation.x = 0.08;
      break;
    }

    case "tall_bookshelf_led": {
      // Back panel & side walls
      addBox(group, w, h, 0.03, 0, h / 2, -d / 2 + 0.015, primaryMat);
      addBox(group, 0.03, h, d, -w / 2 + 0.015, h / 2, 0, primaryMat);
      addBox(group, 0.03, h, d, w / 2 - 0.015, h / 2, 0, primaryMat);
      // Lower closed storage doors (bottom 78cm)
      addBox(group, w - 0.04, 0.78, d - 0.02, 0, 0.39, 0.01, creamMat);
      // 4 upper open display shelves + warm 3000K LED strips + decorative books
      const shelfYs = [0.8, 1.25, 1.7, 2.15, h - 0.02];
      const bookMats = [lib.finishes.SAGE_LINEN, lib.finishes.CHARCOAL_SLATE, lib.finishes.LIGHT_WALNUT, creamMat];
      shelfYs.forEach((sy, idx) => {
        addBox(group, w - 0.04, 0.03, d, 0, sy, 0, primaryMat);
        if (idx < 4) {
          addBox(group, w - 0.12, 0.014, 0.016, 0, sy + 0.41, -d / 2 + 0.06, lib.warmLedStrip, false);
          // Stack of stylized books on each shelf
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
      // Mounted at 1.32m above the dual workstation desk
      const mountY = 1.48;
      addBox(group, w, h, Math.max(0.03, d * 0.5), 0, mountY, 0, lib.pegboardMat);
      // Wooden frame trim
      addBox(group, w + 0.04, 0.03, 0.045, 0, mountY + h / 2, 0.005, oakMat);
      addBox(group, w + 0.04, 0.03, 0.045, 0, mountY - h / 2, 0.005, oakMat);
      // Mini floating shelf + goal cards + warm accent light
      addBox(group, w * 0.36, 0.02, 0.11, -w * 0.22, mountY - 0.15, 0.06, oakMat);
      addBox(group, 0.34, 0.24, 0.012, w * 0.22, mountY + 0.12, 0.03, lib.finishes.SAGE_LINEN, false);
      addBox(group, 0.28, 0.2, 0.012, -w * 0.18, mountY + 0.16, 0.03, creamMat, false);
      addBox(group, w * 0.85, 0.015, 0.02, 0, mountY + h / 2 - 0.03, 0.035, lib.warmLedStrip, false);
      break;
    }

    case "fridge_inverter": {
      addBox(group, w, h, d, 0, h / 2, 0, primaryMat);
      // Top-freezer / bottom-fridge door split + recessed handle
      addBox(group, w + 0.006, 0.016, 0.015, 0, h * 0.38, d / 2 + 0.005, darkMetal, false);
      addBox(group, 0.022, 0.42, 0.025, -w / 2 + 0.06, h * 0.58, d / 2 + 0.015, darkMetal, false);
      break;
    }

    case "washer_dryer": {
      addBox(group, w, h, d, 0, h / 2, 0, primaryMat);
      // Front drum glass door
      const drum = addCylinder(group, w * 0.32, w * 0.32, 0.04, 0, h * 0.48, d / 2 + 0.01, darkMetal, 20);
      drum.rotation.x = Math.PI / 2;
      const glass = addCylinder(group, w * 0.24, w * 0.24, 0.048, 0, h * 0.48, d / 2 + 0.014, lib.glassClear, 20, false);
      glass.rotation.x = Math.PI / 2;
      // Top control dial strip
      addBox(group, w * 0.92, 0.11, 0.02, 0, h - 0.08, d / 2 + 0.008, lib.finishes.CHARCOAL_SLATE, false);
      break;
    }

    case "ac_inverter": {
      // Wall-mounted high at y = 2.28m
      const mountY = 2.28;
      addBox(group, w, h, d, 0, mountY, 0, primaryMat);
      addBox(group, w * 0.9, 0.035, 0.02, 0, mountY - h * 0.32, d / 2 + 0.005, darkMetal, false);
      break;
    }

    case "floor_plant": {
      const potH = Math.min(0.36, h * 0.3);
      addCylinder(group, w * 0.38, w * 0.28, potH, 0, potH / 2, 0, lib.terracottaPot, 16);
      // Trunk
      addCylinder(group, 0.022, 0.03, h * 0.48, 0, potH + h * 0.22, 0, lib.finishes.LIGHT_WALNUT, 8);
      // Layered foliage clusters
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
      addBox(group, w, boxH, d, 0, boxH / 2, 0, lib.terracottaPot);
      for (let i = -1; i <= 1; i++) {
        const geo = new THREE.DodecahedronGeometry(Math.max(0.11, d * 0.55), 1);
        const bush = new THREE.Mesh(geo, lib.plantLeaf);
        bush.position.set(i * (w * 0.28), boxH + d * 0.38, 0);
        bush.castShadow = true;
        group.add(bush);
      }
      break;
    }

    default: {
      addBox(group, w, h, d, 0, h / 2, 0, primaryMat);
      break;
    }
  }

  group.position.set(item.position.x, 0, item.position.z);
  group.rotation.y = (item.rotationDeg * Math.PI) / 180;
  tagFurnitureGroup(group, item);
  return group;
}
