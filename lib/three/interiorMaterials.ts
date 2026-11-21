import * as THREE from "three";
import {
  InteriorMaterialFinish,
  InteriorMepPointKind,
  InteriorStylePreset,
  InteriorWallAccentFinish,
} from "@/types/finance";
import {
  INTERIOR_STYLE_PRESETS,
  MATERIAL_FINISH_META,
  MEP_KIND_META,
  WALL_ACCENT_META,
} from "@/lib/interiorFloorplan";

export type SkyDomeTimeKey = "MORNING_08" | "NOON_12" | "AFTERNOON_1630" | "EVENING_20";

function createCanvas(
  width: number,
  height: number
): [HTMLCanvasElement, CanvasRenderingContext2D | null] {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return [canvas, canvas.getContext("2d")];
}

function finalizeColorTexture(
  canvas: HTMLCanvasElement,
  repeatX: number,
  repeatY: number,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = Math.min(8, Math.max(1, maxAnisotropy));
  tex.needsUpdate = true;
  return tex;
}

/**
 * Linear-space (NoColorSpace) procedural data texture for Bump & Roughness maps.
 */
function finalizeLinearTexture(
  canvas: HTMLCanvasElement,
  repeatX: number,
  repeatY: number,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = Math.min(8, Math.max(1, maxAnisotropy));
  tex.needsUpdate = true;
  return tex;
}

function makeChangyihTileMaps(
  baseHex: string,
  maxAnisotropy: number
): { map: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture; roughnessMap: THREE.CanvasTexture } {
  const [canvas, ctx] = createCanvas(512, 512);
  if (ctx) {
    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, 512, 512);

    for (let i = 0; i < 48; i++) {
      const x = (i * 73) % 512;
      const y = (i * 137) % 512;
      const r = 36 + (i % 40);
      const grad = ctx.createRadialGradient(x, y, 4, x, y, r);
      grad.addColorStop(0, i % 2 === 0 ? "rgba(255,255,255,0.16)" : "rgba(180,170,155,0.08)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }

    ctx.strokeStyle = "rgba(148, 140, 128, 0.26)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(512, 0);
    ctx.moveTo(0, 256);
    ctx.lineTo(512, 256);
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 512);
    ctx.moveTo(256, 0);
    ctx.lineTo(256, 512);
    ctx.stroke();
  }

  const [bumpCanvas, bCtx] = createCanvas(512, 512);
  if (bCtx) {
    bCtx.fillStyle = "#E8E8E8";
    bCtx.fillRect(0, 0, 512, 512);
    bCtx.strokeStyle = "#505050";
    bCtx.lineWidth = 3.5;
    bCtx.beginPath();
    bCtx.moveTo(0, 0);
    bCtx.lineTo(512, 0);
    bCtx.moveTo(0, 256);
    bCtx.lineTo(512, 256);
    bCtx.moveTo(0, 0);
    bCtx.lineTo(0, 512);
    bCtx.moveTo(256, 0);
    bCtx.lineTo(256, 512);
    bCtx.stroke();
  }

  // Polished porcelain tile (~0.24 roughness) with matte grout seams (~0.88) to catch diagonal sunbeams
  const [roughCanvas, rCtx] = createCanvas(512, 512);
  if (rCtx) {
    rCtx.fillStyle = "#424242";
    rCtx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 36; i++) {
      const x = (i * 89) % 512;
      const y = (i * 151) % 512;
      rCtx.fillStyle = i % 2 === 0 ? "rgba(85,85,85,0.22)" : "rgba(50,50,50,0.2)";
      rCtx.fillRect(x, y, 42, 42);
    }
    rCtx.strokeStyle = "#DEDEDE";
    rCtx.lineWidth = 3.5;
    rCtx.beginPath();
    rCtx.moveTo(0, 0);
    rCtx.lineTo(512, 0);
    rCtx.moveTo(0, 256);
    rCtx.lineTo(512, 256);
    rCtx.moveTo(0, 0);
    rCtx.lineTo(0, 512);
    rCtx.moveTo(256, 0);
    rCtx.lineTo(256, 512);
    rCtx.stroke();
  }

  return {
    map: finalizeColorTexture(canvas, 3.5, 4.5, maxAnisotropy),
    bumpMap: finalizeLinearTexture(bumpCanvas, 3.5, 4.5, maxAnisotropy),
    roughnessMap: finalizeLinearTexture(roughCanvas, 3.5, 4.5, maxAnisotropy),
  };
}

function makeWoodPlankMaps(
  baseHex: string,
  maxAnisotropy: number
): { map: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture; roughnessMap: THREE.CanvasTexture } {
  const [canvas, ctx] = createCanvas(512, 512);
  const [bumpCanvas, bCtx] = createCanvas(512, 512);
  const [roughCanvas, rCtx] = createCanvas(512, 512);

  if (ctx) {
    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, 512, 512);
  }
  if (bCtx) {
    bCtx.fillStyle = "#D4D4D4";
    bCtx.fillRect(0, 0, 512, 512);
  }
  if (rCtx) {
    rCtx.fillStyle = "#8C8C8C";
    rCtx.fillRect(0, 0, 512, 512);
  }

  const plankH = 64;
  for (let row = 0; row < 8; row++) {
    const y = row * plankH;
    const shade = ((row % 3) - 1) * 8;
    if (ctx) {
      ctx.fillStyle =
        shade >= 0 ? `rgba(255,245,230,${0.03 * shade})` : `rgba(45,25,10,${-0.025 * shade})`;
      ctx.fillRect(0, y, 512, plankH);

      ctx.strokeStyle = "rgba(75, 45, 22, 0.16)";
      ctx.lineWidth = 1.2;
      for (let g = 0; g < 7; g++) {
        const gy = y + 6 + g * 8.5;
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.bezierCurveTo(
          170,
          gy + (((row + g) % 3) - 1) * 3,
          340,
          gy - ((row + g) % 2) * 2.5,
          512,
          gy
        );
        ctx.stroke();
      }
      ctx.strokeStyle = "rgba(62, 38, 18, 0.34)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      const jointX = ((row * 193) % 420) + 45;
      ctx.moveTo(jointX, y);
      ctx.lineTo(jointX, y + plankH);
      ctx.stroke();
    }

    if (bCtx) {
      bCtx.strokeStyle = "rgba(155, 155, 155, 0.55)";
      bCtx.lineWidth = 1.2;
      for (let g = 0; g < 7; g++) {
        const gy = y + 6 + g * 8.5;
        bCtx.beginPath();
        bCtx.moveTo(0, gy);
        bCtx.bezierCurveTo(
          170,
          gy + (((row + g) % 3) - 1) * 3,
          340,
          gy - ((row + g) % 2) * 2.5,
          512,
          gy
        );
        bCtx.stroke();
      }
      bCtx.strokeStyle = "#484848";
      bCtx.lineWidth = 2.5;
      bCtx.beginPath();
      bCtx.moveTo(0, y);
      bCtx.lineTo(512, y);
      const jointX = ((row * 193) % 420) + 45;
      bCtx.moveTo(jointX, y);
      bCtx.lineTo(jointX, y + plankH);
      bCtx.stroke();
    }

    if (rCtx) {
      rCtx.fillStyle = row % 2 === 0 ? "#828282" : "#969696";
      rCtx.fillRect(0, y, 512, plankH);
      rCtx.strokeStyle = "#DCDCDC";
      rCtx.lineWidth = 2.5;
      rCtx.beginPath();
      rCtx.moveTo(0, y);
      rCtx.lineTo(512, y);
      rCtx.stroke();
    }
  }

  return {
    map: finalizeColorTexture(canvas, 3, 3, maxAnisotropy),
    bumpMap: finalizeLinearTexture(bumpCanvas, 3, 3, maxAnisotropy),
    roughnessMap: finalizeLinearTexture(roughCanvas, 3, 3, maxAnisotropy),
  };
}

/**
 * Procedural Herringbone (sàn gỗ xương cá) maps for Master & Room 05 customization.
 */
function makeHerringboneWoodMaps(
  baseHex: string,
  maxAnisotropy: number
): { map: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture } {
  const [canvas, ctx] = createCanvas(512, 512);
  const [bumpCanvas, bCtx] = createCanvas(512, 512);

  if (ctx) {
    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, 512, 512);
  }
  if (bCtx) {
    bCtx.fillStyle = "#D8D8D8";
    bCtx.fillRect(0, 0, 512, 512);
  }

  const colW = 64;
  const rowH = 32;
  for (let col = -1; col < 10; col++) {
    const dir = col % 2 === 0 ? 1 : -1;
    for (let row = -2; row < 18; row++) {
      const x = col * colW;
      const y = row * rowH;
      const tone = ((col * 7 + row * 3) % 3) - 1;

      const drawChevron = (target: CanvasRenderingContext2D | null, isBump: boolean) => {
        if (!target) return;
        target.beginPath();
        if (dir > 0) {
          target.moveTo(x, y);
          target.lineTo(x + colW, y + rowH);
          target.lineTo(x + colW, y + rowH * 2);
          target.lineTo(x, y + rowH);
        } else {
          target.moveTo(x, y + rowH);
          target.lineTo(x + colW, y);
          target.lineTo(x + colW, y + rowH);
          target.lineTo(x, y + rowH * 2);
        }
        target.closePath();

        if (!isBump) {
          target.fillStyle =
            tone > 0
              ? "rgba(255,244,225,0.08)"
              : tone < 0
                ? "rgba(52,30,14,0.09)"
                : "rgba(255,255,255,0.01)";
          target.fill();
          target.strokeStyle = "rgba(62, 38, 18, 0.34)";
          target.lineWidth = 1.6;
          target.stroke();
        } else {
          target.fillStyle = tone > 0 ? "#E4E4E4" : tone < 0 ? "#C8C8C8" : "#D8D8D8";
          target.fill();
          target.strokeStyle = "#484848";
          target.lineWidth = 2;
          target.stroke();
        }
      };

      drawChevron(ctx, false);
      drawChevron(bCtx, true);
    }
  }

  return {
    map: finalizeColorTexture(canvas, 2.8, 2.8, maxAnisotropy),
    bumpMap: finalizeLinearTexture(bumpCanvas, 2.8, 2.8, maxAnisotropy),
  };
}

function makeBathMarbleMaps(
  maxAnisotropy: number,
  repeatX = 2.2,
  repeatY = 2.2
): { map: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture } {
  const [canvas, ctx] = createCanvas(512, 512);
  const [bumpCanvas, bCtx] = createCanvas(512, 512);
  if (ctx) {
    ctx.fillStyle = "#F3F5F7";
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = "rgba(130, 142, 158, 0.22)";
    ctx.lineWidth = 2.8;
    for (let i = 0; i < 7; i++) {
      ctx.beginPath();
      const startY = i * 82 + 16;
      ctx.moveTo(0, startY);
      ctx.bezierCurveTo(140, startY + 34, 310, startY - 38, 512, startY + 18);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(160, 170, 185, 0.28)";
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, 255, 255);
    ctx.strokeRect(256, 256, 255, 255);
  }
  if (bCtx) {
    bCtx.fillStyle = "#EAEAEA";
    bCtx.fillRect(0, 0, 512, 512);
    bCtx.strokeStyle = "#888888";
    bCtx.lineWidth = 2;
    bCtx.strokeRect(1, 1, 255, 255);
    bCtx.strokeRect(256, 256, 255, 255);
  }
  return {
    map: finalizeColorTexture(canvas, repeatX, repeatY, maxAnisotropy),
    bumpMap: finalizeLinearTexture(bumpCanvas, repeatX, repeatY, maxAnisotropy),
  };
}

function makeConcreteEffectMaps(
  maxAnisotropy: number
): { map: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture } {
  const [canvas, ctx] = createCanvas(512, 512);
  const [bumpCanvas, bCtx] = createCanvas(512, 512);

  if (ctx) {
    ctx.fillStyle = WALL_ACCENT_META.CONCRETE_EFFECT.hex;
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 95; i++) {
      const x = (i * 67) % 512;
      const y = (i * 123) % 512;
      const r = 24 + (i % 55);
      const grad = ctx.createRadialGradient(x, y, 2, x, y, r);
      grad.addColorStop(
        0,
        i % 2 === 0 ? "rgba(255,255,255,0.12)" : "rgba(58,56,52,0.11)"
      );
      grad.addColorStop(1, "rgba(128,128,128,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }
  if (bCtx) {
    bCtx.fillStyle = "#C8C8C8";
    bCtx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 120; i++) {
      const x = (i * 53) % 512;
      const y = (i * 107) % 512;
      bCtx.fillStyle = i % 2 === 0 ? "rgba(230,230,230,0.3)" : "rgba(95,95,95,0.28)";
      bCtx.fillRect(x, y, 28, 12);
    }
  }
  return {
    map: finalizeColorTexture(canvas, 2, 1.5, maxAnisotropy),
    bumpMap: finalizeLinearTexture(bumpCanvas, 2, 1.5, maxAnisotropy),
  };
}

function makeLoggiaTileTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas(256, 256);
  if (ctx) {
    ctx.fillStyle = "#8C939C";
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 180; i++) {
      const x = (i * 47) % 256;
      const y = (i * 97) % 256;
      ctx.fillStyle = i % 2 === 0 ? "rgba(255,255,255,0.08)" : "rgba(25,30,36,0.09)";
      ctx.fillRect(x, y, 3, 3);
    }
    ctx.strokeStyle = "rgba(45, 50, 58, 0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 128);
    ctx.lineTo(256, 128);
    ctx.moveTo(128, 0);
    ctx.lineTo(128, 256);
    ctx.stroke();
  }
  return finalizeColorTexture(canvas, 3.5, 5.5, maxAnisotropy);
}

function makeWoodGrainMaps(
  baseHex: string,
  maxAnisotropy: number
): { map: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture } {
  const [canvas, ctx] = createCanvas(256, 256);
  const [bumpCanvas, bCtx] = createCanvas(256, 256);
  if (ctx) {
    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = "rgba(60, 35, 15, 0.18)";
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 34; i++) {
      const y = i * 7.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(85, y + ((i % 3) - 1) * 3, 175, y - (i % 2) * 2.5, 256, y);
      ctx.stroke();
    }
  }
  if (bCtx) {
    bCtx.fillStyle = "#CCCCCC";
    bCtx.fillRect(0, 0, 256, 256);
    bCtx.strokeStyle = "rgba(110,110,110,0.6)";
    bCtx.lineWidth = 1.6;
    for (let i = 0; i < 34; i++) {
      const y = i * 7.5;
      bCtx.beginPath();
      bCtx.moveTo(0, y);
      bCtx.bezierCurveTo(85, y + ((i % 3) - 1) * 3, 175, y - (i % 2) * 2.5, 256, y);
      bCtx.stroke();
    }
  }
  return {
    map: finalizeColorTexture(canvas, 1.5, 1.5, maxAnisotropy),
    bumpMap: finalizeLinearTexture(bumpCanvas, 1.5, 1.5, maxAnisotropy),
  };
}

function makeFabricWeaveMaps(
  baseHex: string,
  maxAnisotropy: number
): { map: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture } {
  const [canvas, ctx] = createCanvas(128, 128);
  const [bumpCanvas, bCtx] = createCanvas(128, 128);
  if (ctx) {
    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, 128, 128);
  }
  if (bCtx) {
    bCtx.fillStyle = "#B8B8B8";
    bCtx.fillRect(0, 0, 128, 128);
  }
  for (let y = 0; y < 128; y += 4) {
    for (let x = 0; x < 128; x += 4) {
      const alt = ((x + y) / 4) % 2 === 0;
      if (ctx) {
        ctx.fillStyle = alt ? "rgba(255,255,255,0.09)" : "rgba(60,55,50,0.08)";
        ctx.fillRect(x, y, 2, 2);
      }
      if (bCtx) {
        bCtx.fillStyle = alt ? "#E8E8E8" : "#808080";
        bCtx.fillRect(x, y, 2, 2);
      }
    }
  }
  return {
    map: finalizeColorTexture(canvas, 4, 4, maxAnisotropy),
    bumpMap: finalizeLinearTexture(bumpCanvas, 4, 4, maxAnisotropy),
  };
}

function makeSlattedWoodMaps(
  baseHex: string,
  maxAnisotropy: number
): { map: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture } {
  const [canvas, ctx] = createCanvas(256, 256);
  const [bumpCanvas, bCtx] = createCanvas(256, 256);
  const slatCount = 14;
  const step = 256 / slatCount;
  if (ctx) {
    ctx.fillStyle = "#2A2420";
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < slatCount; i++) {
      ctx.fillStyle = baseHex;
      ctx.fillRect(i * step + 2, 0, step - 4, 256);
      ctx.fillStyle = "rgba(255,245,230,0.12)";
      ctx.fillRect(i * step + 2, 0, 2.5, 256);
    }
  }
  if (bCtx) {
    bCtx.fillStyle = "#303030";
    bCtx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < slatCount; i++) {
      bCtx.fillStyle = "#F0F0F0";
      bCtx.fillRect(i * step + 2, 0, step - 4, 256);
    }
  }
  return {
    map: finalizeColorTexture(canvas, 2, 1, maxAnisotropy),
    bumpMap: finalizeLinearTexture(bumpCanvas, 2, 1, maxAnisotropy),
  };
}

function makePegboardTexture(baseHex: string, maxAnisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas(256, 128);
  if (ctx) {
    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, 256, 128);
    ctx.fillStyle = "rgba(70, 68, 64, 0.45)";
    for (let y = 12; y < 120; y += 16) {
      for (let x = 12; x < 248; x += 16) {
        ctx.beginPath();
        ctx.arc(x, y, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  return finalizeColorTexture(canvas, 1, 1, maxAnisotropy);
}

function makeDarkGraniteTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas(256, 256);
  if (ctx) {
    ctx.fillStyle = "#222927";
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 240; i++) {
      const x = (i * 61) % 256;
      const y = (i * 113) % 256;
      ctx.fillStyle = i % 3 === 0 ? "rgba(220,235,228,0.12)" : "rgba(10,14,12,0.22)";
      ctx.fillRect(x, y, 2.5, 2.5);
    }
  }
  return finalizeColorTexture(canvas, 2, 2, maxAnisotropy);
}

function makeContactShadowTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas(128, 128);
  if (ctx) {
    ctx.clearRect(0, 0, 128, 128);
    const grad = ctx.createRadialGradient(64, 64, 14, 64, 64, 62);
    grad.addColorStop(0, "rgba(15, 23, 42, 0.46)");
    grad.addColorStop(0.58, "rgba(15, 23, 42, 0.24)");
    grad.addColorStop(0.84, "rgba(15, 23, 42, 0.08)");
    grad.addColorStop(1, "rgba(15, 23, 42, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Procedural 12A-floor panoramic sky dome texture with soft distant urban horizon glow.
 */
function makeSkyDomeTexture(timeKey: SkyDomeTimeKey): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas(512, 256);
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    if (timeKey === "MORNING_08") {
      grad.addColorStop(0.0, "#5B9BD5");
      grad.addColorStop(0.36, "#A6D1F2");
      grad.addColorStop(0.52, "#FDECD0");
      grad.addColorStop(0.62, "#E5DED4");
      grad.addColorStop(1.0, "#BDB8B0");
    } else if (timeKey === "NOON_12") {
      grad.addColorStop(0.0, "#3A82C8");
      grad.addColorStop(0.38, "#93C5EE");
      grad.addColorStop(0.53, "#EBF4FB");
      grad.addColorStop(0.64, "#D7DCE2");
      grad.addColorStop(1.0, "#B2B8C0");
    } else if (timeKey === "AFTERNOON_1630") {
      grad.addColorStop(0.0, "#4E6A96");
      grad.addColorStop(0.34, "#D69E7A");
      grad.addColorStop(0.52, "#F9CBA0");
      grad.addColorStop(0.62, "#C8B6A8");
      grad.addColorStop(1.0, "#9E948C");
    } else {
      grad.addColorStop(0.0, "#0A1224");
      grad.addColorStop(0.38, "#182742");
      grad.addColorStop(0.52, "#2D3C58");
      grad.addColorStop(0.62, "#1C2434");
      grad.addColorStop(1.0, "#101520");
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 256);

    // Subtle distant Dĩ An / Thủ Đức high-rise skyline band right on horizon (y ~ 132)
    const horizonY = 136;
    ctx.fillStyle =
      timeKey === "EVENING_20" ? "rgba(14, 20, 34, 0.85)" : "rgba(120, 134, 152, 0.22)";
    for (let i = 0; i < 42; i++) {
      const bx = i * 13;
      const bw = 7 + (i % 5) * 2;
      const bh = 6 + ((i * 19) % 18);
      ctx.fillRect(bx, horizonY - bh, bw, bh + 4);
      // Warm evening city lights on distant towers
      if (timeKey === "EVENING_20") {
        ctx.fillStyle = "rgba(253, 211, 132, 0.55)";
        for (let wy = horizonY - bh + 2; wy < horizonY - 2; wy += 4) {
          if ((i + wy) % 3 === 0) {
            ctx.fillRect(bx + 2, wy, 2, 1.5);
          }
        }
        ctx.fillStyle = "rgba(14, 20, 34, 0.85)";
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export interface InteriorMaterialLibrary {
  stylePreset: InteriorStylePreset;
  textures: THREE.Texture[];
  materials: THREE.Material[];
  wallMain: THREE.MeshStandardMaterial;
  wallCutawayCap: THREE.MeshStandardMaterial;
  wallSectionCap: THREE.MeshStandardMaterial;
  wcMarbleWall: THREE.MeshStandardMaterial;
  skirtingMat: THREE.MeshStandardMaterial;
  floorTrimMetal: THREE.MeshStandardMaterial;
  ceilingMat: THREE.MeshStandardMaterial;
  coveLedMat: THREE.MeshStandardMaterial;
  downlightOnMat: THREE.MeshStandardMaterial;
  downlightOffMat: THREE.MeshStandardMaterial;
  floorLivingTile: THREE.MeshStandardMaterial;
  floorWoodTile: THREE.MeshStandardMaterial;
  floorWoodHerringbone: THREE.MeshStandardMaterial;
  floorBathMarble: THREE.MeshStandardMaterial;
  floorLoggiaGrey: THREE.MeshStandardMaterial;
  glassClear: THREE.Material;
  glassPartitionMat: THREE.Material;
  darkFrameMetal: THREE.MeshStandardMaterial;
  lecmaxWoodDoor: THREE.MeshStandardMaterial;
  interiorWoodDoor: THREE.MeshStandardMaterial;
  slattedWood: THREE.MeshStandardMaterial;
  kitchenGranite: THREE.MeshStandardMaterial;
  pegboardMat: THREE.MeshStandardMaterial;
  chromeMetal: THREE.MeshStandardMaterial;
  mirrorGlass: THREE.MeshStandardMaterial;
  screenDark: THREE.MeshStandardMaterial;
  screenGlow: THREE.MeshStandardMaterial;
  plantLeaf: THREE.MeshStandardMaterial;
  terracottaPot: THREE.MeshStandardMaterial;
  beddingLight: THREE.MeshStandardMaterial;
  warmLedStrip: THREE.MeshStandardMaterial;
  curtainFabric: THREE.MeshStandardMaterial;
  curtainVoileMat: THREE.MeshStandardMaterial;
  contactShadowMat: THREE.MeshBasicMaterial;
  accentWallMaterials: Record<InteriorWallAccentFinish, THREE.MeshStandardMaterial>;
  skyDomeTextures: Record<SkyDomeTimeKey, THREE.CanvasTexture>;
  mepMaterials: Record<InteriorMepPointKind, THREE.MeshStandardMaterial>;
  finishes: Record<InteriorMaterialFinish, THREE.MeshStandardMaterial>;
  dispose: () => void;
}

export function createInteriorMaterialLibrary(
  stylePreset: InteriorStylePreset,
  maxAnisotropy: number,
  isSoftwareGl = false
): InteriorMaterialLibrary {
  const palette = INTERIOR_STYLE_PRESETS[stylePreset];
  const textures: THREE.Texture[] = [];
  const materials: THREE.Material[] = [];

  const trackTex = <T extends THREE.Texture>(t: T): T => {
    textures.push(t);
    return t;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };

  const livingTileMaps = makeChangyihTileMaps(palette.livingTileColor, maxAnisotropy);
  trackTex(livingTileMaps.map);
  trackTex(livingTileMaps.bumpMap);
  trackTex(livingTileMaps.roughnessMap);

  const woodFloorMaps = makeWoodPlankMaps(palette.woodFloorColor, maxAnisotropy);
  trackTex(woodFloorMaps.map);
  trackTex(woodFloorMaps.bumpMap);
  trackTex(woodFloorMaps.roughnessMap);

  const herringboneMaps = makeHerringboneWoodMaps(palette.woodFloorColor, maxAnisotropy);
  trackTex(herringboneMaps.map);
  trackTex(herringboneMaps.bumpMap);

  const bathMarbleMaps = makeBathMarbleMaps(maxAnisotropy, 2.2, 2.2);
  trackTex(bathMarbleMaps.map);
  trackTex(bathMarbleMaps.bumpMap);

  const wcWallMarbleMaps = makeBathMarbleMaps(maxAnisotropy, 1.6, 1.8);
  trackTex(wcWallMarbleMaps.map);
  trackTex(wcWallMarbleMaps.bumpMap);

  const concreteMaps = makeConcreteEffectMaps(maxAnisotropy);
  trackTex(concreteMaps.map);
  trackTex(concreteMaps.bumpMap);

  const loggiaTileTex = trackTex(makeLoggiaTileTexture(maxAnisotropy));

  const warmOakMaps = makeWoodGrainMaps(MATERIAL_FINISH_META.WARM_OAK.hex, maxAnisotropy);
  trackTex(warmOakMaps.map);
  trackTex(warmOakMaps.bumpMap);

  const walnutMaps = makeWoodGrainMaps(MATERIAL_FINISH_META.LIGHT_WALNUT.hex, maxAnisotropy);
  trackTex(walnutMaps.map);
  trackTex(walnutMaps.bumpMap);

  const creamBoucleMaps = makeFabricWeaveMaps(MATERIAL_FINISH_META.CREAM_BOUCLE.hex, maxAnisotropy);
  trackTex(creamBoucleMaps.map);
  trackTex(creamBoucleMaps.bumpMap);

  const sageLinenMaps = makeFabricWeaveMaps(MATERIAL_FINISH_META.SAGE_LINEN.hex, maxAnisotropy);
  trackTex(sageLinenMaps.map);
  trackTex(sageLinenMaps.bumpMap);

  const slattedMaps = makeSlattedWoodMaps(palette.primaryWoodHex, maxAnisotropy);
  trackTex(slattedMaps.map);
  trackTex(slattedMaps.bumpMap);

  const pegboardTex = trackTex(makePegboardTexture("#EAE3D7", maxAnisotropy));
  const graniteTex = trackTex(makeDarkGraniteTexture(maxAnisotropy));
  const contactShadowTex = trackTex(makeContactShadowTexture());

  const skyDomeTextures: Record<SkyDomeTimeKey, THREE.CanvasTexture> = {
    MORNING_08: trackTex(makeSkyDomeTexture("MORNING_08")),
    NOON_12: trackTex(makeSkyDomeTexture("NOON_12")),
    AFTERNOON_1630: trackTex(makeSkyDomeTexture("AFTERNOON_1630")),
    EVENING_20: trackTex(makeSkyDomeTexture("EVENING_20")),
  };

  const wallMain = trackMat(
    new THREE.MeshStandardMaterial({
      color: palette.wallColor,
      roughness: 0.86,
      metalness: 0.02,
    })
  );

  const wallCutawayCap = trackMat(
    new THREE.MeshStandardMaterial({
      color: "#D8D2C8",
      roughness: 0.88,
      metalness: 0.0,
    })
  );

  const wallSectionCap = trackMat(
    new THREE.MeshStandardMaterial({
      color: "#3F454F",
      roughness: 0.78,
      metalness: 0.08,
    })
  );

  const wcMarbleWall = trackMat(
    new THREE.MeshStandardMaterial({
      map: wcWallMarbleMaps.map,
      bumpMap: wcWallMarbleMaps.bumpMap,
      bumpScale: 0.005,
      roughness: 0.24,
      metalness: 0.06,
    })
  );

  const skirtingMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: "#EDE8DF",
      roughness: 0.48,
      metalness: 0.04,
    })
  );

  const floorTrimMetal = trackMat(
    new THREE.MeshStandardMaterial({
      color: "#C5A87A",
      roughness: 0.28,
      metalness: 0.85,
    })
  );

  const ceilingMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: palette.ceilingColor,
      roughness: 0.9,
      metalness: 0.0,
    })
  );

  const coveLedMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: "#FFF4DC",
      emissive: new THREE.Color("#FFE0A3"),
      emissiveIntensity: 0.9,
      roughness: 0.35,
    })
  );

  const downlightOnMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: "#FFF8E7",
      emissive: new THREE.Color("#FFE6B0"),
      emissiveIntensity: 1.25,
      roughness: 0.25,
    })
  );

  const downlightOffMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: "#CBD5E1",
      roughness: 0.4,
      metalness: 0.2,
    })
  );

  const floorLivingTile = trackMat(
    new THREE.MeshStandardMaterial({
      map: livingTileMaps.map,
      bumpMap: livingTileMaps.bumpMap,
      bumpScale: 0.007,
      roughnessMap: livingTileMaps.roughnessMap,
      roughness: 0.72,
      metalness: 0.06,
    })
  );

  const floorWoodTile = trackMat(
    new THREE.MeshStandardMaterial({
      map: woodFloorMaps.map,
      bumpMap: woodFloorMaps.bumpMap,
      bumpScale: 0.014,
      roughnessMap: woodFloorMaps.roughnessMap,
      roughness: 0.86,
      metalness: 0.04,
    })
  );

  const floorWoodHerringbone = trackMat(
    new THREE.MeshStandardMaterial({
      map: herringboneMaps.map,
      bumpMap: herringboneMaps.bumpMap,
      bumpScale: 0.015,
      roughness: 0.56,
      metalness: 0.05,
    })
  );

  const floorBathMarble = trackMat(
    new THREE.MeshStandardMaterial({
      map: bathMarbleMaps.map,
      bumpMap: bathMarbleMaps.bumpMap,
      bumpScale: 0.006,
      roughness: 0.24,
      metalness: 0.06,
    })
  );

  const floorLoggiaGrey = trackMat(
    new THREE.MeshStandardMaterial({
      map: loggiaTileTex,
      roughness: 0.78,
      metalness: 0.04,
    })
  );

  const glassClear = trackMat(
    isSoftwareGl
      ? new THREE.MeshStandardMaterial({
          color: "#CFE6F5",
          transparent: true,
          opacity: 0.28,
          roughness: 0.1,
          metalness: 0.12,
          depthWrite: false,
        })
      : new THREE.MeshPhysicalMaterial({
          color: "#CFE6F5",
          transparent: true,
          opacity: 0.28,
          roughness: 0.08,
          metalness: 0.08,
          transmission: 0.32,
          depthWrite: false,
        })
  );

  const glassPartitionMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: "#D8EBF4",
      transparent: true,
      opacity: 0.34,
      roughness: 0.12,
      metalness: 0.14,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );

  const darkFrameMetal = trackMat(
    new THREE.MeshStandardMaterial({
      color: palette.metalHex,
      roughness: 0.34,
      metalness: 0.72,
    })
  );

  const lecmaxWoodDoor = trackMat(
    new THREE.MeshStandardMaterial({
      map: walnutMaps.map,
      bumpMap: walnutMaps.bumpMap,
      bumpScale: 0.01,
      color: "#8E5E3B",
      roughness: 0.48,
      metalness: 0.08,
    })
  );

  const interiorWoodDoor = trackMat(
    new THREE.MeshStandardMaterial({
      map: warmOakMaps.map,
      bumpMap: warmOakMaps.bumpMap,
      bumpScale: 0.008,
      color: palette.primaryWoodHex,
      roughness: 0.56,
      metalness: 0.04,
    })
  );

  const slattedWood = trackMat(
    new THREE.MeshStandardMaterial({
      map: slattedMaps.map,
      bumpMap: slattedMaps.bumpMap,
      bumpScale: 0.028,
      roughness: 0.58,
      metalness: 0.04,
    })
  );

  const kitchenGranite = trackMat(
    new THREE.MeshStandardMaterial({
      map: graniteTex,
      roughness: 0.22,
      metalness: 0.14,
    })
  );

  const pegboardMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: pegboardTex,
      roughness: 0.65,
      metalness: 0.08,
    })
  );

  const chromeMetal = trackMat(
    new THREE.MeshStandardMaterial({
      color: "#D1D5DB",
      roughness: 0.18,
      metalness: 0.9,
    })
  );

  const mirrorGlass = trackMat(
    new THREE.MeshStandardMaterial({
      color: "#E4EDF5",
      roughness: 0.06,
      metalness: 0.92,
    })
  );

  const screenDark = trackMat(
    new THREE.MeshStandardMaterial({
      color: "#111827",
      roughness: 0.16,
      metalness: 0.22,
    })
  );

  const screenGlow = trackMat(
    new THREE.MeshStandardMaterial({
      color: "#1E293B",
      emissive: new THREE.Color("#38BDF8"),
      emissiveIntensity: 0.34,
      roughness: 0.18,
      metalness: 0.12,
    })
  );

  const plantLeaf = trackMat(
    new THREE.MeshStandardMaterial({
      color: "#4F7953",
      roughness: 0.72,
      metalness: 0.02,
    })
  );

  const terracottaPot = trackMat(
    new THREE.MeshStandardMaterial({
      color: "#D6CEC2",
      roughness: 0.78,
      metalness: 0.04,
    })
  );

  const beddingLight = trackMat(
    new THREE.MeshStandardMaterial({
      map: creamBoucleMaps.map,
      bumpMap: creamBoucleMaps.bumpMap,
      bumpScale: 0.012,
      color: "#F3EFE9",
      roughness: 0.88,
      metalness: 0.0,
    })
  );

  const warmLedStrip = trackMat(
    new THREE.MeshStandardMaterial({
      color: "#FFF1CE",
      emissive: new THREE.Color("#FBBF24"),
      emissiveIntensity: 0.78,
      roughness: 0.35,
    })
  );

  const curtainFabric = trackMat(
    new THREE.MeshStandardMaterial({
      map: creamBoucleMaps.map,
      bumpMap: creamBoucleMaps.bumpMap,
      bumpScale: 0.014,
      color: "#E8E0D4",
      roughness: 0.92,
      metalness: 0.0,
      side: THREE.DoubleSide,
    })
  );

  const curtainVoileMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: "#FAF9F6",
      transparent: true,
      opacity: 0.38,
      roughness: 0.95,
      metalness: 0.0,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );

  const contactShadowMat = trackMat(
    new THREE.MeshBasicMaterial({
      map: contactShadowTex,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    })
  );

  const accentWallMaterials: Record<InteriorWallAccentFinish, THREE.MeshStandardMaterial> = {
    DEFAULT: wallMain,
    CONCRETE_EFFECT: trackMat(
      new THREE.MeshStandardMaterial({
        map: concreteMaps.map,
        bumpMap: concreteMaps.bumpMap,
        bumpScale: 0.018,
        roughness: 0.84,
        metalness: 0.04,
      })
    ),
    WOOD_SLAT_PANEL: slattedWood,
    MARBLE_PVC: wcMarbleWall,
    TINTED_MIRROR: trackMat(
      new THREE.MeshStandardMaterial({
        color: "#7F6C5D",
        roughness: 0.08,
        metalness: 0.88,
      })
    ),
    SAGE_PAINT: trackMat(
      new THREE.MeshStandardMaterial({
        color: WALL_ACCENT_META.SAGE_PAINT.hex,
        roughness: 0.85,
        metalness: 0.02,
      })
    ),
    WARM_BEIGE_PAINT: trackMat(
      new THREE.MeshStandardMaterial({
        color: WALL_ACCENT_META.WARM_BEIGE_PAINT.hex,
        roughness: 0.85,
        metalness: 0.02,
      })
    ),
  };

  const mepMaterials: Record<InteriorMepPointKind, THREE.MeshStandardMaterial> = {
    OUTLET_DOUBLE: trackMat(
      new THREE.MeshStandardMaterial({
        color: MEP_KIND_META.OUTLET_DOUBLE.colorHex,
        emissive: new THREE.Color(MEP_KIND_META.OUTLET_DOUBLE.colorHex),
        emissiveIntensity: 0.38,
        roughness: 0.35,
      })
    ),
    NETWORK_LAN: trackMat(
      new THREE.MeshStandardMaterial({
        color: MEP_KIND_META.NETWORK_LAN.colorHex,
        emissive: new THREE.Color(MEP_KIND_META.NETWORK_LAN.colorHex),
        emissiveIntensity: 0.38,
        roughness: 0.35,
      })
    ),
    AC_DRAIN: trackMat(
      new THREE.MeshStandardMaterial({
        color: MEP_KIND_META.AC_DRAIN.colorHex,
        emissive: new THREE.Color(MEP_KIND_META.AC_DRAIN.colorHex),
        emissiveIntensity: 0.38,
        roughness: 0.35,
      })
    ),
    WATER_DRAIN: trackMat(
      new THREE.MeshStandardMaterial({
        color: MEP_KIND_META.WATER_DRAIN.colorHex,
        emissive: new THREE.Color(MEP_KIND_META.WATER_DRAIN.colorHex),
        emissiveIntensity: 0.38,
        roughness: 0.35,
      })
    ),
    LIGHT_SWITCH: trackMat(
      new THREE.MeshStandardMaterial({
        color: MEP_KIND_META.LIGHT_SWITCH.colorHex,
        emissive: new THREE.Color(MEP_KIND_META.LIGHT_SWITCH.colorHex),
        emissiveIntensity: 0.38,
        roughness: 0.35,
      })
    ),
  };

  const finishes: Record<InteriorMaterialFinish, THREE.MeshStandardMaterial> = {
    WARM_OAK: trackMat(
      new THREE.MeshStandardMaterial({
        map: warmOakMaps.map,
        bumpMap: warmOakMaps.bumpMap,
        bumpScale: 0.012,
        roughness: MATERIAL_FINISH_META.WARM_OAK.roughness,
        metalness: MATERIAL_FINISH_META.WARM_OAK.metalness,
      })
    ),
    LIGHT_WALNUT: trackMat(
      new THREE.MeshStandardMaterial({
        map: walnutMaps.map,
        bumpMap: walnutMaps.bumpMap,
        bumpScale: 0.012,
        roughness: MATERIAL_FINISH_META.LIGHT_WALNUT.roughness,
        metalness: MATERIAL_FINISH_META.LIGHT_WALNUT.metalness,
      })
    ),
    CREAM_BOUCLE: trackMat(
      new THREE.MeshStandardMaterial({
        map: creamBoucleMaps.map,
        bumpMap: creamBoucleMaps.bumpMap,
        bumpScale: 0.018,
        roughness: MATERIAL_FINISH_META.CREAM_BOUCLE.roughness,
        metalness: MATERIAL_FINISH_META.CREAM_BOUCLE.metalness,
      })
    ),
    SAGE_LINEN: trackMat(
      new THREE.MeshStandardMaterial({
        map: sageLinenMaps.map,
        bumpMap: sageLinenMaps.bumpMap,
        bumpScale: 0.016,
        roughness: MATERIAL_FINISH_META.SAGE_LINEN.roughness,
        metalness: MATERIAL_FINISH_META.SAGE_LINEN.metalness,
      })
    ),
    MATTE_CREAM: trackMat(
      new THREE.MeshStandardMaterial({
        color: MATERIAL_FINISH_META.MATTE_CREAM.hex,
        roughness: MATERIAL_FINISH_META.MATTE_CREAM.roughness,
        metalness: MATERIAL_FINISH_META.MATTE_CREAM.metalness,
      })
    ),
    CHARCOAL_SLATE: trackMat(
      new THREE.MeshStandardMaterial({
        color: MATERIAL_FINISH_META.CHARCOAL_SLATE.hex,
        roughness: MATERIAL_FINISH_META.CHARCOAL_SLATE.roughness,
        metalness: MATERIAL_FINISH_META.CHARCOAL_SLATE.metalness,
      })
    ),
    WHITE_MARBLE: trackMat(
      new THREE.MeshStandardMaterial({
        map: bathMarbleMaps.map,
        bumpMap: bathMarbleMaps.bumpMap,
        bumpScale: 0.006,
        roughness: MATERIAL_FINISH_META.WHITE_MARBLE.roughness,
        metalness: MATERIAL_FINISH_META.WHITE_MARBLE.metalness,
      })
    ),
    BRUSHED_TITANIUM: trackMat(
      new THREE.MeshStandardMaterial({
        color: MATERIAL_FINISH_META.BRUSHED_TITANIUM.hex,
        roughness: MATERIAL_FINISH_META.BRUSHED_TITANIUM.roughness,
        metalness: MATERIAL_FINISH_META.BRUSHED_TITANIUM.metalness,
      })
    ),
  };

  return {
    stylePreset,
    textures,
    materials,
    wallMain,
    wallCutawayCap,
    wallSectionCap,
    wcMarbleWall,
    skirtingMat,
    floorTrimMetal,
    ceilingMat,
    coveLedMat,
    downlightOnMat,
    downlightOffMat,
    floorLivingTile,
    floorWoodTile,
    floorWoodHerringbone,
    floorBathMarble,
    floorLoggiaGrey,
    glassClear,
    glassPartitionMat,
    darkFrameMetal,
    lecmaxWoodDoor,
    interiorWoodDoor,
    slattedWood,
    kitchenGranite,
    pegboardMat,
    chromeMetal,
    mirrorGlass,
    screenDark,
    screenGlow,
    plantLeaf,
    terracottaPot,
    beddingLight,
    warmLedStrip,
    curtainFabric,
    curtainVoileMat,
    contactShadowMat,
    accentWallMaterials,
    skyDomeTextures,
    mepMaterials,
    finishes,
    dispose: () => {
      for (const m of materials) m.dispose();
      for (const t of textures) t.dispose();
    },
  };
}
