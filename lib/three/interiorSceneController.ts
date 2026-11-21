import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import {
  InteriorDesignScenario,
  InteriorFurnitureItem,
  InteriorMepPoint,
} from "@/types/finance";
import {
  INTERIOR_STYLE_PRESETS,
  SKYONE_A2_BOUNDS,
  SKYONE_A2_OPENINGS,
  SKYONE_A2_ROOMS,
  SKYONE_A2_WALLS,
  WallSegmentSpec,
  createDefaultSkyOneA2MepPoints,
} from "@/lib/interiorFloorplan";
import {
  resolveWalkthroughCollision,
  snapPositionToWalls,
} from "@/lib/interiorCadEngine";
import {
  createInteriorMaterialLibrary,
  InteriorMaterialLibrary,
} from "./interiorMaterials";
import { buildFurnitureMeshGroup } from "./interiorFurnitureFactory";

export type InteriorCameraPreset =
  | "DOLLHOUSE"
  | "ENTRANCE"
  | "LIVING_BALCONY"
  | "KITCHEN_DINING"
  | "MASTER_BEDROOM"
  | "ROOM_05_STUDIO";

export type InteriorTimeOfDay = "MORNING_08" | "NOON_12" | "AFTERNOON_1630" | "EVENING_20";

export type InteriorNavMode = "ORBIT" | "WALKTHROUGH";

interface CameraPresetTarget {
  pos: [number, number, number];
  target: [number, number, number];
}

const CAMERA_PRESETS: Record<InteriorCameraPreset, CameraPresetTarget> = {
  DOLLHOUSE: { pos: [5.6, 7.6, 6.2], target: [0.1, 0.55, 0.1] },
  ENTRANCE: { pos: [0.55, 1.65, 3.25], target: [1.4, 1.15, -1.6] },
  LIVING_BALCONY: { pos: [2.1, 1.55, 1.45], target: [2.25, 1.1, -3.1] },
  KITCHEN_DINING: { pos: [1.25, 1.75, -0.35], target: [2.55, 1.0, 2.55] },
  MASTER_BEDROOM: { pos: [0.15, 1.65, -0.85], target: [-1.45, 0.95, -2.55] },
  ROOM_05_STUDIO: { pos: [-1.85, 1.65, 1.68], target: [-2.05, 1.02, 3.25] },
};

interface TimeLightingConfig {
  sunPos: [number, number, number];
  sunColor: string;
  sunIntensity: number;
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  indoorIntensity: number;
  exposure: number;
}

const TIME_LIGHTING: Record<InteriorTimeOfDay, TimeLightingConfig> = {
  MORNING_08: {
    sunPos: [8.5, 5.2, -9.5],
    sunColor: "#FFE8C8",
    sunIntensity: 2.2,
    hemiSky: "#F2F7FF",
    hemiGround: "#C9B9A6",
    hemiIntensity: 0.72,
    indoorIntensity: 0.35,
    exposure: 1.06,
  },
  NOON_12: {
    sunPos: [3.2, 12.0, -4.5],
    sunColor: "#FFFFFF",
    sunIntensity: 2.35,
    hemiSky: "#F8FAFF",
    hemiGround: "#B8AEA0",
    hemiIntensity: 0.85,
    indoorIntensity: 0.25,
    exposure: 1.05,
  },
  AFTERNOON_1630: {
    sunPos: [-7.0, 5.5, -6.0],
    sunColor: "#FFD7A8",
    sunIntensity: 1.65,
    hemiSky: "#F4E8DC",
    hemiGround: "#9C8F82",
    hemiIntensity: 0.65,
    indoorIntensity: 0.65,
    exposure: 1.02,
  },
  EVENING_20: {
    sunPos: [2.0, 8.0, -8.0],
    sunColor: "#93B4E8",
    sunIntensity: 0.35,
    hemiSky: "#3B4A68",
    hemiGround: "#2C2824",
    hemiIntensity: 0.42,
    indoorIntensity: 1.85,
    exposure: 0.98,
  },
};

export interface InteriorSceneCallbacks {
  onSelectItem: (id: string | null) => void;
  onItemMoved: (id: string, x: number, z: number) => void;
  onContextLost?: () => void;
}

function disposeObjectTree(root: THREE.Object3D, keepSharedMaterials = true): void {
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments) {
      obj.geometry.dispose();
      if (!keepSharedMaterials) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    }
  });
}

function computeFurnitureSignature(
  item: InteriorFurnitureItem,
  stylePreset: string
): string {
  return `${item.catalogKey}|${item.dimensionsCm.width}|${item.dimensionsCm.depth}|${item.dimensionsCm.height}|${item.materialFinish}|${stylePreset}`;
}

export class InteriorSceneController {
  private container: HTMLElement;
  private callbacks: InteriorSceneCallbacks;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private pmrem: THREE.PMREMGenerator;
  private envRenderTarget: THREE.WebGLRenderTarget;
  private materialLib: InteriorMaterialLibrary;
  private isSoftwareGl: boolean;
  private isDarkMode = false;
  private disposed = false;

  // Groups
  private architectureGroup = new THREE.Group();
  private ceilingGroup = new THREE.Group();
  private furnitureGroup = new THREE.Group();
  private mepGroup = new THREE.Group();
  private wallMeshRecords: { mesh: THREE.Object3D; cutawaySide?: WallSegmentSpec["cutawaySide"] }[] = [];

  // Incremental furniture diff cache
  private furnitureMap = new Map<string, THREE.Group>();
  private furnitureItemData = new Map<string, InteriorFurnitureItem>();
  private furnitureSignatureMap = new Map<string, string>();
  private selectionBoxHelper: THREE.BoxHelper | null = null;

  // Lights
  private sunLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private indoorLights: THREE.PointLight[] = [];

  // Interactive & Navigation state
  private navMode: InteriorNavMode = "ORBIT";
  private autoCutaway = true;
  private showMepLayer = false;
  private selectedItemId: string | null = null;
  private timeOfDay: InteriorTimeOfDay = "MORNING_08";

  // Smooth camera transition
  private animTargetPos: THREE.Vector3 | null = null;
  private animTargetLook: THREE.Vector3 | null = null;

  // Raycasting & dragging on floor plane
  private raycaster = new THREE.Raycaster();
  private floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private pointerDownPos = new THREE.Vector2();
  private draggingId: string | null = null;
  private dragOffset = new THREE.Vector3();
  private dragMoved = false;

  // Walkthrough controls (Keyboard + Mobile Touch Joystick)
  private pressedKeys = new Set<string>();
  private joystickVec = { vx: 0, vz: 0 };
  private walkYaw = 0;
  private walkPitch = 0;
  private isWalkLooking = false;
  private lastLookX = 0;
  private lastLookY = 0;

  // Render-on-Demand & SoftwareGL Fence Pacing
  private rafId: number | null = null;
  private renderScheduled = false;
  private lastFrameTime = performance.now();
  private prevCamPos = new THREE.Vector3();
  private prevTargetPos = new THREE.Vector3();
  private resizeObserver: ResizeObserver;

  constructor(
    container: HTMLElement,
    initialScenario: InteriorDesignScenario,
    callbacks: InteriorSceneCallbacks,
    isDarkMode = false
  ) {
    this.container = container;
    this.callbacks = callbacks;
    this.isDarkMode = isDarkMode;

    const width = Math.max(320, container.clientWidth);
    const height = Math.max(260, container.clientHeight);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: false, // Disabled for optimal GPU performance; snapshot renders synchronously before toDataURL
      powerPreference: "high-performance",
    });

    const gl = this.renderer.getContext();
    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
    const rendererStr = debugInfo ? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)) : "";
    this.isSoftwareGl = /swiftshader|llvmpipe|software|mesa/i.test(rendererStr);

    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    this.renderer.domElement.style.touchAction = "none";
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();

    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    const roomEnv = new RoomEnvironment();
    this.envRenderTarget = this.pmrem.fromScene(roomEnv, 0.04);
    this.scene.environment = this.envRenderTarget.texture;
    roomEnv.dispose();

    this.camera = new THREE.PerspectiveCamera(42, width / height, 0.08, 65);
    this.camera.position.set(...CAMERA_PRESETS.DOLLHOUSE.pos);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = !this.isSoftwareGl;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.04;
    this.controls.minDistance = 1.6;
    this.controls.maxDistance = 16.5;
    this.controls.target.set(...CAMERA_PRESETS.DOLLHOUSE.target);
    this.controls.update();
    this.controls.addEventListener("change", this.handleControlsChange);

    // Lights
    this.hemiLight = new THREE.HemisphereLight("#F2F7FF", "#C9B9A6", 0.72);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight("#FFE8C8", 2.2);
    this.sunLight.position.set(8.5, 5.2, -9.5);
    this.sunLight.castShadow = !this.isSoftwareGl;
    this.sunLight.shadow.mapSize.set(1024, 1024);
    this.sunLight.shadow.camera.near = 1;
    this.sunLight.shadow.camera.far = 28;
    this.sunLight.shadow.camera.left = -6.5;
    this.sunLight.shadow.camera.right = 6.5;
    this.sunLight.shadow.camera.top = 6.5;
    this.sunLight.shadow.camera.bottom = -6.5;
    this.sunLight.shadow.bias = -0.0005;
    this.scene.add(this.sunLight);

    const indoorPositions: [number, number, number][] = [
      [2.1, 2.55, -0.8],
      [2.2, 2.55, 2.2],
      [-1.0, 2.45, -2.0],
      [-1.85, 2.45, 2.6],
    ];
    for (const [lx, ly, lz] of indoorPositions) {
      const pLight = new THREE.PointLight("#FFE3B5", 0.35, 7.5, 1.8);
      pLight.position.set(lx, ly, lz);
      this.scene.add(pLight);
      this.indoorLights.push(pLight);
    }

    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.materialLib = createInteriorMaterialLibrary(
      initialScenario.stylePreset,
      maxAniso,
      this.isSoftwareGl
    );
    this.applySceneBackdrop();

    this.scene.add(this.architectureGroup);
    this.scene.add(this.ceilingGroup);
    this.scene.add(this.furnitureGroup);
    this.mepGroup.visible = this.showMepLayer;
    this.scene.add(this.mepGroup);

    this.buildArchitecture();
    this.syncScenario(initialScenario);
    this.setTimeOfDay("MORNING_08");

    const dom = this.renderer.domElement;
    dom.addEventListener("pointerdown", this.handlePointerDown);
    dom.addEventListener("pointermove", this.handlePointerMove);
    dom.addEventListener("pointerup", this.handlePointerUp);
    dom.addEventListener("webglcontextlost", this.handleContextLost, false);
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);

    this.requestRender();
  }

  private handleControlsChange = (): void => {
    this.requestRender();
  };

  /**
   * Software WebGL GPU pacing so continuous camera motion never floods SwiftShader/llvmpipe.
   */
  private afterDraw(next: () => void): void {
    if (!this.isSoftwareGl) {
      next();
      return;
    }
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (typeof gl.fenceSync === "function") {
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      if (sync) {
        gl.flush();
        const poll = () => {
          if (this.disposed) {
            gl.deleteSync(sync);
            return;
          }
          const status = gl.clientWaitSync(sync, 0, 0);
          if (status === gl.ALREADY_SIGNALED || status === gl.CONDITION_SATISFIED) {
            gl.deleteSync(sync);
            next();
          } else {
            window.setTimeout(poll, 16);
          }
        };
        poll();
        return;
      }
    }
    window.setTimeout(next, 32);
  }

  /**
   * Coalesced Render-on-Demand scheduler: renders ONLY when camera, furniture, lights, or walkthrough moves.
   */
  public requestRender(): void {
    if (this.disposed || this.renderScheduled) return;
    this.renderScheduled = true;
    this.rafId = requestAnimationFrame(this.renderFrame);
  }

  private renderFrame = (now: number): void => {
    this.rafId = null;
    this.renderScheduled = false;
    if (this.disposed) return;

    const dt = Math.min(0.05, Math.max(0.001, (now - this.lastFrameTime) / 1000));
    this.lastFrameTime = now;

    let keepRendering = false;

    if (this.navMode === "ORBIT") {
      this.prevCamPos.copy(this.camera.position);
      this.prevTargetPos.copy(this.controls.target);

      if (this.animTargetPos && this.animTargetLook) {
        const alpha = 1 - Math.exp(-8 * dt);
        this.camera.position.lerp(this.animTargetPos, alpha);
        this.controls.target.lerp(this.animTargetLook, alpha);
        if (
          this.camera.position.distanceTo(this.animTargetPos) < 0.025 &&
          this.controls.target.distanceTo(this.animTargetLook) < 0.025
        ) {
          this.camera.position.copy(this.animTargetPos);
          this.controls.target.copy(this.animTargetLook);
          this.animTargetPos = null;
          this.animTargetLook = null;
        } else {
          keepRendering = true;
        }
      }

      this.controls.update();
      this.updateAutoCutaway();

      // If OrbitControls damping is still settling, schedule next frame until stopped
      if (
        this.controls.enableDamping &&
        (this.camera.position.distanceToSquared(this.prevCamPos) > 1e-7 ||
          this.controls.target.distanceToSquared(this.prevTargetPos) > 1e-7)
      ) {
        keepRendering = true;
      }
    } else {
      const moved = this.updateWalkthroughMovement(dt);
      if (moved || this.isWalkLooking) {
        keepRendering = true;
      }
    }

    this.renderer.render(this.scene, this.camera);

    if (keepRendering) {
      this.afterDraw(() => this.requestRender());
    }
  };

  private applySceneBackdrop(): void {
    const preset = INTERIOR_STYLE_PRESETS[this.materialLib.stylePreset];
    this.scene.background = new THREE.Color(
      this.isDarkMode ? preset.canvasBgDark : preset.canvasBgLight
    );
  }

  public setDarkMode(dark: boolean): void {
    this.isDarkMode = dark;
    this.applySceneBackdrop();
    this.requestRender();
  }

  public setShowMepLayer(visible: boolean): void {
    this.showMepLayer = visible;
    this.mepGroup.visible = visible;
    this.requestRender();
  }

  /**
   * Dựng 1 đoạn tường có tự động tách lỗ mở (window/door cutout: trái + phải + bệ dưới + đà trên)
   * để khắc phục triệt để tình trạng tường đặc chôn chìm khung cửa sổ (ví dụ cửa sổ PN Master & WC).
   */
  private buildWallWithCutouts(wall: WallSegmentSpec): THREE.Group {
    const wallGroup = new THREE.Group();
    const dx = wall.x2 - wall.x1;
    const dz = wall.z2 - wall.z1;
    const length = Math.hypot(dx, dz);
    const angle = Math.atan2(dz, dx);
    const dirX = dx / (length || 1);
    const dirZ = dz / (length || 1);

    // Find openings explicitly attached to this wall
    const wallOpenings = SKYONE_A2_OPENINGS.filter((op) => op.wallId === wall.id)
      .map((op) => {
        const tCenter = (op.x - wall.x1) * dirX + (op.z - wall.z1) * dirZ;
        return {
          op,
          tStart: Math.max(0.05, tCenter - op.width / 2),
          tEnd: Math.min(length - 0.05, tCenter + op.width / 2),
        };
      })
      .filter((seg) => seg.tEnd > seg.tStart + 0.05)
      .sort((a, b) => a.tStart - b.tStart);

    const addWallBox = (t0: number, t1: number, y0: number, y1: number) => {
      const segLen = t1 - t0;
      const segH = y1 - y0;
      if (segLen < 0.02 || segH < 0.02) return;
      const tMid = (t0 + t1) / 2;
      const geo = new THREE.BoxGeometry(segLen, segH, wall.thickness);
      const mesh = new THREE.Mesh(geo, this.materialLib.wallMain);
      mesh.position.set(wall.x1 + dirX * tMid, y0 + segH / 2, wall.z1 + dirZ * tMid);
      mesh.rotation.y = -angle;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      wallGroup.add(mesh);
    };

    if (wallOpenings.length === 0) {
      addWallBox(0, length, 0, wall.height);
    } else {
      let cursor = 0;
      for (const seg of wallOpenings) {
        if (seg.tStart > cursor) {
          addWallBox(cursor, seg.tStart, 0, wall.height);
        }
        // Sill wall below opening
        if (seg.op.sillHeight > 0.02) {
          addWallBox(seg.tStart, seg.tEnd, 0, seg.op.sillHeight);
        }
        // Lintel wall above opening
        const topY = seg.op.sillHeight + seg.op.height;
        if (wall.height > topY + 0.02) {
          addWallBox(seg.tStart, seg.tEnd, topY, wall.height);
        }
        cursor = seg.tEnd;
      }
      if (cursor < length) {
        addWallBox(cursor, length, 0, wall.height);
      }
    }

    if (wall.isCurvedCorner) {
      const cornerRadius = 0.28;
      const cornerCyl = new THREE.Mesh(
        new THREE.CylinderGeometry(
          cornerRadius,
          cornerRadius,
          wall.height,
          20,
          1,
          false,
          Math.PI,
          Math.PI / 2
        ),
        this.materialLib.wallMain
      );
      cornerCyl.position.set(wall.x1, wall.height / 2, wall.z1 - cornerRadius);
      cornerCyl.castShadow = true;
      cornerCyl.receiveShadow = true;
      wallGroup.add(cornerCyl);
    }

    return wallGroup;
  }

  private buildArchitecture(): void {
    disposeObjectTree(this.architectureGroup, true);
    this.architectureGroup.clear();
    disposeObjectTree(this.ceilingGroup, true);
    this.ceilingGroup.clear();
    this.wallMeshRecords = [];

    // Ground architectural plinth slab under apartment
    const plinthGeo = new THREE.BoxGeometry(
      SKYONE_A2_BOUNDS.totalWidth + 0.5,
      0.16,
      SKYONE_A2_BOUNDS.totalDepth + 0.5
    );
    const plinth = new THREE.Mesh(plinthGeo, this.materialLib.wallCutawayCap);
    plinth.position.set(0, -0.09, 0);
    plinth.receiveShadow = true;
    this.architectureGroup.add(plinth);

    // 1. Individual Room Floors (8 CAD zones)
    for (const room of SKYONE_A2_ROOMS) {
      const floorGeo = new THREE.BoxGeometry(room.width, 0.02, room.depth);
      const mat =
        room.floorMaterial === "WOOD_TILE"
          ? this.materialLib.floorWoodTile
          : room.floorMaterial === "BATH_MARBLE"
            ? this.materialLib.floorBathMarble
            : room.floorMaterial === "LOGGIA_GREY"
              ? this.materialLib.floorLoggiaGrey
              : this.materialLib.floorLivingTile;
      const mesh = new THREE.Mesh(floorGeo, mat);
      mesh.position.set(room.x, -0.01, room.z);
      mesh.receiveShadow = true;
      this.architectureGroup.add(mesh);
    }

    // 2. Walls (with segmented real cutouts for Master Window & WC Window)
    for (const wall of SKYONE_A2_WALLS) {
      if (wall.id === "w_north_balcony_rail") {
        const dx = wall.x2 - wall.x1;
        const length = Math.abs(dx);
        const midX = (wall.x1 + wall.x2) / 2;
        const midZ = (wall.z1 + wall.z2) / 2;

        const railGroup = new THREE.Group();
        const topRail = new THREE.Mesh(
          new THREE.BoxGeometry(length, 0.05, 0.07),
          this.materialLib.darkFrameMetal
        );
        topRail.position.set(midX, wall.height, midZ);
        railGroup.add(topRail);

        const bottomCurb = new THREE.Mesh(
          new THREE.BoxGeometry(length, 0.16, 0.1),
          this.materialLib.wallMain
        );
        bottomCurb.position.set(midX, 0.08, midZ);
        railGroup.add(bottomCurb);

        const balusterCount = 22;
        for (let i = 0; i <= balusterCount; i++) {
          const bx = wall.x1 + (length * i) / balusterCount;
          const bar = new THREE.Mesh(
            new THREE.BoxGeometry(0.022, wall.height - 0.16, 0.022),
            this.materialLib.darkFrameMetal
          );
          bar.position.set(bx, 0.16 + (wall.height - 0.16) / 2, midZ);
          railGroup.add(bar);
        }

        const shaft = new THREE.Mesh(
          new THREE.BoxGeometry(0.32, 2.8, 0.34),
          this.materialLib.wallMain
        );
        shaft.position.set(0.82, 1.4, -2.95);
        shaft.castShadow = true;
        shaft.receiveShadow = true;
        railGroup.add(shaft);

        this.architectureGroup.add(railGroup);
        this.wallMeshRecords.push({ mesh: railGroup, cutawaySide: wall.cutawaySide });
        continue;
      }

      const wallGroup = this.buildWallWithCutouts(wall);
      this.architectureGroup.add(wallGroup);
      this.wallMeshRecords.push({ mesh: wallGroup, cutawaySide: wall.cutawaySide });
    }

    // 3. Openings (Main door, Balcony sliding, Master window, Interior wood doors, Loggia door, WC window)
    for (const op of SKYONE_A2_OPENINGS) {
      const opGroup = new THREE.Group();
      opGroup.position.set(op.x, 0, op.z);
      opGroup.rotation.y = op.rotationY;

      if (op.kind === "MAIN_DOOR") {
        const leafL = new THREE.Mesh(
          new THREE.BoxGeometry(op.width * 0.68, op.height, 0.06),
          this.materialLib.lecmaxWoodDoor
        );
        leafL.position.set(-op.width * 0.16, op.height / 2, 0);
        opGroup.add(leafL);
        const leafR = new THREE.Mesh(
          new THREE.BoxGeometry(op.width * 0.3, op.height, 0.06),
          this.materialLib.lecmaxWoodDoor
        );
        leafR.position.set(op.width * 0.35, op.height / 2, 0);
        opGroup.add(leafR);
        const lock = new THREE.Mesh(
          new THREE.BoxGeometry(0.06, 0.26, 0.09),
          this.materialLib.darkFrameMetal
        );
        lock.position.set(op.width * 0.14, 1.08, 0);
        opGroup.add(lock);
        this.wallMeshRecords.push({ mesh: opGroup, cutawaySide: "SOUTH" });
      } else if (op.kind === "SLIDING_BALCONY") {
        const panelW = op.width / 3;
        for (let i = -1; i <= 1; i++) {
          const glass = new THREE.Mesh(
            new THREE.BoxGeometry(panelW - 0.04, op.height - 0.08, 0.025),
            this.materialLib.glassClear
          );
          glass.position.set(i * panelW, op.height / 2, i * 0.015);
          opGroup.add(glass);

          const frameL = new THREE.Mesh(
            new THREE.BoxGeometry(0.04, op.height, 0.05),
            this.materialLib.darkFrameMetal
          );
          frameL.position.set(i * panelW - panelW / 2 + 0.02, op.height / 2, i * 0.015);
          opGroup.add(frameL);
        }
        const header = new THREE.Mesh(
          new THREE.BoxGeometry(op.width + 0.08, 0.08, 0.12),
          this.materialLib.darkFrameMetal
        );
        header.position.set(0, op.height, 0);
        opGroup.add(header);

        for (const sx of [-1, 1]) {
          const curtain = new THREE.Mesh(
            new THREE.BoxGeometry(0.28, op.height + 0.12, 0.12),
            this.materialLib.curtainFabric
          );
          curtain.position.set(sx * (op.width / 2 - 0.12), (op.height + 0.12) / 2, 0.12);
          opGroup.add(curtain);
        }
        this.wallMeshRecords.push({ mesh: opGroup, cutawaySide: "NORTH" });
      } else if (op.kind === "INTERIOR_DOOR") {
        // Architectural door jambs + header + open wood door leaf pivoted at 35° so rooms stay walkable & legible
        const jambL = new THREE.Mesh(
          new THREE.BoxGeometry(0.045, op.height, 0.14),
          this.materialLib.interiorWoodDoor
        );
        jambL.position.set(-op.width / 2 + 0.02, op.height / 2, 0);
        opGroup.add(jambL);

        const jambR = new THREE.Mesh(
          new THREE.BoxGeometry(0.045, op.height, 0.14),
          this.materialLib.interiorWoodDoor
        );
        jambR.position.set(op.width / 2 - 0.02, op.height / 2, 0);
        opGroup.add(jambR);

        const headJamb = new THREE.Mesh(
          new THREE.BoxGeometry(op.width + 0.04, 0.06, 0.14),
          this.materialLib.interiorWoodDoor
        );
        headJamb.position.set(0, op.height + 0.03, 0);
        opGroup.add(headJamb);

        // Door leaf hinged open 65 degrees inward so walkthrough camera never clips a closed door
        const hingePivot = new THREE.Group();
        hingePivot.position.set(op.width / 2 - 0.04, 0, 0);
        hingePivot.rotation.y = 1.15;
        const leafW = op.width - 0.08;
        const leaf = new THREE.Mesh(
          new THREE.BoxGeometry(leafW, op.height - 0.03, 0.04),
          this.materialLib.interiorWoodDoor
        );
        leaf.position.set(-leafW / 2, (op.height - 0.03) / 2, 0);
        leaf.castShadow = true;
        hingePivot.add(leaf);
        const handle = new THREE.Mesh(
          new THREE.BoxGeometry(0.11, 0.025, 0.07),
          this.materialLib.darkFrameMetal
        );
        handle.position.set(-leafW + 0.11, 1.0, 0);
        hingePivot.add(handle);
        opGroup.add(hingePivot);
      } else {
        // Real open-cutout Windows & Loggia Glass Door with vertical mullions
        const glass = new THREE.Mesh(
          new THREE.BoxGeometry(op.width - 0.06, op.height - 0.06, 0.022),
          this.materialLib.glassClear
        );
        glass.position.set(0, op.sillHeight + op.height / 2, 0);
        opGroup.add(glass);

        const topBar = new THREE.Mesh(
          new THREE.BoxGeometry(op.width, 0.05, 0.12),
          this.materialLib.darkFrameMetal
        );
        topBar.position.set(0, op.sillHeight + op.height, 0);
        opGroup.add(topBar);

        const botBar = new THREE.Mesh(
          new THREE.BoxGeometry(op.width, 0.05, 0.12),
          this.materialLib.darkFrameMetal
        );
        botBar.position.set(0, op.sillHeight + 0.025, 0);
        opGroup.add(botBar);

        for (const sx of [-1, 1]) {
          const sideBar = new THREE.Mesh(
            new THREE.BoxGeometry(0.045, op.height, 0.12),
            this.materialLib.darkFrameMetal
          );
          sideBar.position.set(sx * (op.width / 2 - 0.02), op.sillHeight + op.height / 2, 0);
          opGroup.add(sideBar);
        }

        if (op.width >= 1.4) {
          const mullion = new THREE.Mesh(
            new THREE.BoxGeometry(0.035, op.height, 0.06),
            this.materialLib.darkFrameMetal
          );
          mullion.position.set(0, op.sillHeight + op.height / 2, 0);
          opGroup.add(mullion);
        }

        if (op.wallId === "w_north_master") {
          this.wallMeshRecords.push({ mesh: opGroup, cutawaySide: "NORTH" });
        }
      }

      this.architectureGroup.add(opGroup);
    }

    // 4. Stepped Living Cove Ceiling (visible in Walkthrough mode)
    const livingCeiling = new THREE.Mesh(
      new THREE.BoxGeometry(3.25, 0.08, 4.9),
      this.materialLib.ceilingMat
    );
    livingCeiling.position.set(2.0, 2.86, -0.2);
    this.ceilingGroup.add(livingCeiling);

    const coveLed = new THREE.Mesh(
      new THREE.BoxGeometry(2.5, 0.02, 4.1),
      this.materialLib.coveLedMat
    );
    coveLed.position.set(2.0, 2.81, -0.2);
    this.ceilingGroup.add(coveLed);

    const masterCeiling = new THREE.Mesh(
      new THREE.BoxGeometry(3.15, 0.08, 3.05),
      this.materialLib.ceilingMat
    );
    masterCeiling.position.set(-0.95, 2.74, -2.1);
    this.ceilingGroup.add(masterCeiling);

    const room05Ceiling = new THREE.Mesh(
      new THREE.BoxGeometry(3.6, 0.08, 2.25),
      this.materialLib.ceilingMat
    );
    room05Ceiling.position.set(-1.8, 2.74, 2.5);
    this.ceilingGroup.add(room05Ceiling);

    this.ceilingGroup.visible = this.navMode === "WALKTHROUGH";
  }

  private syncMepMarkers(mepPoints: InteriorMepPoint[]): void {
    disposeObjectTree(this.mepGroup, true);
    this.mepGroup.clear();

    for (const pt of mepPoints) {
      const mat = this.materialLib.mepMaterials[pt.kind] || this.materialLib.mepMaterials.OUTLET_DOUBLE;
      const y = Math.max(0.15, Math.min(2.6, pt.heightCm / 100));

      const holder = new THREE.Group();
      holder.position.set(pt.x, y, pt.z);

      // Glowing technical node + vertical reference stem down to floor
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.09, 0.06), mat);
      holder.add(box);

      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.008, 0.008, y, 8),
        mat
      );
      stem.position.set(0, -y / 2, 0);
      holder.add(stem);

      const floorRing = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.07, 0.012, 14),
        mat
      );
      floorRing.position.set(0, -y + 0.008, 0);
      holder.add(floorRing);

      this.mepGroup.add(holder);
    }
  }

  /**
   * Incremental Mesh Diffing by `item.id`:
   * - Position/Rotation changes update transform in-place (zero allocations, 60fps smooth).
   * - Dimension/Finish/Catalog changes rebuild ONLY that single item.
   * - Deleted items are cleanly disposed & removed.
   */
  public syncScenario(scenario: InteriorDesignScenario): void {
    if (this.disposed) return;

    const styleChanged = scenario.stylePreset !== this.materialLib.stylePreset;
    if (styleChanged) {
      const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
      this.materialLib.dispose();
      this.materialLib = createInteriorMaterialLibrary(
        scenario.stylePreset,
        maxAniso,
        this.isSoftwareGl
      );
      this.applySceneBackdrop();
      this.buildArchitecture();
      // Force rebuild of all furniture so they bind to the fresh material library
      disposeObjectTree(this.furnitureGroup, true);
      this.furnitureGroup.clear();
      this.furnitureMap.clear();
      this.furnitureSignatureMap.clear();
      this.furnitureItemData.clear();
    }

    const incomingIds = new Set(scenario.items.map((i) => i.id));

    // Remove deleted items
    for (const [id, group] of this.furnitureMap.entries()) {
      if (!incomingIds.has(id)) {
        this.furnitureGroup.remove(group);
        disposeObjectTree(group, true);
        this.furnitureMap.delete(id);
        this.furnitureSignatureMap.delete(id);
        this.furnitureItemData.delete(id);
      }
    }

    // Diff add / update items
    for (const item of scenario.items) {
      this.furnitureItemData.set(item.id, item);
      const sig = computeFurnitureSignature(item, scenario.stylePreset);
      const existing = this.furnitureMap.get(item.id);
      const prevSig = this.furnitureSignatureMap.get(item.id);

      if (existing && prevSig === sig) {
        // Fast-path transform update without rebuilding geometry
        existing.position.set(item.position.x, 0, item.position.z);
        existing.rotation.y = (item.rotationDeg * Math.PI) / 180;
        existing.userData.isLocked = Boolean(item.isLocked);
      } else {
        if (existing) {
          this.furnitureGroup.remove(existing);
          disposeObjectTree(existing, true);
        }
        const meshGroup = buildFurnitureMeshGroup(item, this.materialLib);
        this.furnitureGroup.add(meshGroup);
        this.furnitureMap.set(item.id, meshGroup);
        this.furnitureSignatureMap.set(item.id, sig);
      }
    }

    // Sync 3D MEP markers
    this.syncMepMarkers(scenario.mepPoints ?? createDefaultSkyOneA2MepPoints());

    this.refreshSelectionHelper();
    this.requestRender();
  }

  public setSelectedItem(id: string | null): void {
    this.selectedItemId = id;
    this.refreshSelectionHelper();
    this.requestRender();
  }

  private refreshSelectionHelper(): void {
    if (this.selectionBoxHelper) {
      this.scene.remove(this.selectionBoxHelper);
      this.selectionBoxHelper.dispose();
      this.selectionBoxHelper = null;
    }
    if (!this.selectedItemId) return;
    const target = this.furnitureMap.get(this.selectedItemId);
    if (!target) return;

    this.selectionBoxHelper = new THREE.BoxHelper(target, 0x0d9488);
    this.scene.add(this.selectionBoxHelper);
  }

  public setTimeOfDay(tod: InteriorTimeOfDay): void {
    this.timeOfDay = tod;
    const cfg = TIME_LIGHTING[tod];
    this.sunLight.position.set(...cfg.sunPos);
    this.sunLight.color.set(cfg.sunColor);
    this.sunLight.intensity = cfg.sunIntensity;
    this.hemiLight.color.set(cfg.hemiSky);
    this.hemiLight.groundColor.set(cfg.hemiGround);
    this.hemiLight.intensity = cfg.hemiIntensity;
    for (const light of this.indoorLights) {
      light.intensity = cfg.indoorIntensity;
    }
    this.renderer.toneMappingExposure = cfg.exposure;
    this.requestRender();
  }

  public setAutoCutaway(enabled: boolean): void {
    this.autoCutaway = enabled;
    if (!enabled) {
      for (const rec of this.wallMeshRecords) {
        rec.mesh.visible = true;
      }
    }
    this.requestRender();
  }

  public setNavMode(mode: InteriorNavMode): void {
    this.navMode = mode;
    this.ceilingGroup.visible = mode === "WALKTHROUGH";
    this.joystickVec = { vx: 0, vz: 0 };
    this.pressedKeys.clear();

    if (mode === "WALKTHROUGH") {
      this.controls.enabled = false;
      this.animTargetPos = null;
      this.animTargetLook = null;
      for (const rec of this.wallMeshRecords) {
        rec.mesh.visible = true;
      }
      this.camera.position.set(1.55, 1.6, 1.35);
      this.walkYaw = 0.28;
      this.walkPitch = -0.06;
      this.applyWalkCameraOrientation();
    } else {
      this.controls.enabled = true;
      this.applyCameraPreset("DOLLHOUSE");
    }
    this.requestRender();
  }

  public setWalkthroughJoystickVector(vx: number, vz: number): void {
    this.joystickVec.vx = THREE.MathUtils.clamp(vx, -1, 1);
    this.joystickVec.vz = THREE.MathUtils.clamp(vz, -1, 1);
    if (Math.abs(vx) > 0.02 || Math.abs(vz) > 0.02) {
      this.lastFrameTime = performance.now();
      this.requestRender();
    }
  }

  public applyCameraPreset(preset: InteriorCameraPreset): void {
    const cfg = CAMERA_PRESETS[preset];
    if (this.navMode === "WALKTHROUGH") {
      this.camera.position.set(cfg.pos[0], 1.6, cfg.pos[2]);
      const look = new THREE.Vector3(...cfg.target);
      const dir = look.sub(this.camera.position).normalize();
      this.walkYaw = Math.atan2(-dir.x, -dir.z);
      this.walkPitch = THREE.MathUtils.clamp(Math.asin(dir.y), -0.5, 0.5);
      this.applyWalkCameraOrientation();
      this.requestRender();
      return;
    }
    this.animTargetPos = new THREE.Vector3(...cfg.pos);
    this.animTargetLook = new THREE.Vector3(...cfg.target);
    this.lastFrameTime = performance.now();
    this.requestRender();
  }

  private applyWalkCameraOrientation(): void {
    const euler = new THREE.Euler(this.walkPitch, this.walkYaw, 0, "YXZ");
    this.camera.quaternion.setFromEuler(euler);
  }

  public captureSnapshotPng(): string {
    // Render synchronously right before reading pixels (safe with preserveDrawingBuffer: false)
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL("image/png");
  }

  public resize(): void {
    if (this.disposed) return;
    const width = Math.max(320, this.container.clientWidth);
    const height = Math.max(260, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.requestRender();
  }

  private getPointerNdc(e: PointerEvent): THREE.Vector2 {
    const rect = this.renderer.domElement.getBoundingClientRect();
    return new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
  }

  private handlePointerDown = (e: PointerEvent): void => {
    if (this.disposed) return;
    this.pointerDownPos.set(e.clientX, e.clientY);

    if (this.navMode === "WALKTHROUGH") {
      this.isWalkLooking = true;
      this.lastLookX = e.clientX;
      this.lastLookY = e.clientY;
      this.renderer.domElement.setPointerCapture?.(e.pointerId);
      return;
    }

    this.animTargetPos = null;
    this.animTargetLook = null;

    const ndc = this.getPointerNdc(e);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.furnitureGroup.children, true);

    if (hits.length > 0) {
      const hitId = hits[0].object.userData?.furnitureId as string | undefined;
      if (hitId) {
        this.selectedItemId = hitId;
        this.refreshSelectionHelper();
        this.callbacks.onSelectItem(hitId);
        this.requestRender();

        const group = this.furnitureMap.get(hitId);
        if (group && !group.userData.isLocked) {
          const hitPoint = new THREE.Vector3();
          if (this.raycaster.ray.intersectPlane(this.floorPlane, hitPoint)) {
            this.draggingId = hitId;
            this.dragMoved = false;
            this.dragOffset.copy(group.position).sub(hitPoint);
            this.controls.enabled = false;
            this.renderer.domElement.setPointerCapture?.(e.pointerId);
          }
        }
        return;
      }
    }
  };

  private handlePointerMove = (e: PointerEvent): void => {
    if (this.disposed) return;

    if (this.navMode === "WALKTHROUGH" && this.isWalkLooking) {
      const dx = e.clientX - this.lastLookX;
      const dy = e.clientY - this.lastLookY;
      this.lastLookX = e.clientX;
      this.lastLookY = e.clientY;
      this.walkYaw -= dx * 0.0045;
      this.walkPitch = THREE.MathUtils.clamp(this.walkPitch - dy * 0.004, -0.65, 0.55);
      this.applyWalkCameraOrientation();
      this.requestRender();
      return;
    }

    if (!this.draggingId) return;
    const group = this.furnitureMap.get(this.draggingId);
    const itemMeta = this.furnitureItemData.get(this.draggingId);
    if (!group || !itemMeta) return;

    const ndc = this.getPointerNdc(e);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hitPoint = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(this.floorPlane, hitPoint)) {
      const rawX = hitPoint.x + this.dragOffset.x;
      const rawZ = hitPoint.z + this.dragOffset.z;
      const snapped = snapPositionToWalls(itemMeta, rawX, rawZ, { snapToWall: true });
      group.position.x = snapped.x;
      group.position.z = snapped.z;
      this.dragMoved = true;
      if (this.selectionBoxHelper) {
        this.selectionBoxHelper.update();
      }
      this.requestRender();
    }
  };

  private handlePointerUp = (e: PointerEvent): void => {
    if (this.disposed) return;

    try {
      this.renderer.domElement.releasePointerCapture?.(e.pointerId);
    } catch {
      // ignore if pointer was not captured
    }

    if (this.navMode === "WALKTHROUGH") {
      this.isWalkLooking = false;
      return;
    }

    if (this.draggingId) {
      const id = this.draggingId;
      const group = this.furnitureMap.get(id);
      this.draggingId = null;
      this.controls.enabled = true;
      if (group && this.dragMoved) {
        this.callbacks.onItemMoved(
          id,
          Number(group.position.x.toFixed(2)),
          Number(group.position.z.toFixed(2))
        );
      }
      this.requestRender();
      return;
    }

    const dist = Math.hypot(e.clientX - this.pointerDownPos.x, e.clientY - this.pointerDownPos.y);
    if (dist < 6) {
      const ndc = this.getPointerNdc(e);
      this.raycaster.setFromCamera(ndc, this.camera);
      const hits = this.raycaster.intersectObjects(this.furnitureGroup.children, true);
      if (hits.length === 0 && this.selectedItemId) {
        this.selectedItemId = null;
        this.refreshSelectionHelper();
        this.callbacks.onSelectItem(null);
        this.requestRender();
      }
    }
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (this.navMode !== "WALKTHROUGH") return;
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement ||
      e.target instanceof HTMLSelectElement
    ) {
      return;
    }
    this.pressedKeys.add(e.code);
    this.lastFrameTime = performance.now();
    this.requestRender();
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.pressedKeys.delete(e.code);
  };

  private handleContextLost = (e: Event): void => {
    e.preventDefault();
    this.callbacks.onContextLost?.();
  };

  private updateAutoCutaway(): void {
    if (this.navMode === "WALKTHROUGH" || !this.autoCutaway) return;

    const camPos = this.camera.position;
    const hideSouth = camPos.z > 2.6;
    const hideNorth = camPos.z < -2.8;
    const hideEast = camPos.x > 3.2;
    const hideWest = camPos.x < -3.2;

    for (const rec of this.wallMeshRecords) {
      if (rec.cutawaySide === "SOUTH") rec.mesh.visible = !hideSouth;
      else if (rec.cutawaySide === "NORTH") rec.mesh.visible = !hideNorth;
      else if (rec.cutawaySide === "EAST") rec.mesh.visible = !hideEast;
      else if (rec.cutawaySide === "WEST") rec.mesh.visible = !hideWest;
      else rec.mesh.visible = true;
    }
  }

  private updateWalkthroughMovement(dt: number): boolean {
    if (this.navMode !== "WALKTHROUGH") return false;

    let forwardInput = -this.joystickVec.vz; // joystick up = negative Y = move forward
    let rightInput = this.joystickVec.vx;

    if (this.pressedKeys.has("KeyW") || this.pressedKeys.has("ArrowUp")) forwardInput += 1;
    if (this.pressedKeys.has("KeyS") || this.pressedKeys.has("ArrowDown")) forwardInput -= 1;
    if (this.pressedKeys.has("KeyD") || this.pressedKeys.has("ArrowRight")) rightInput += 1;
    if (this.pressedKeys.has("KeyA") || this.pressedKeys.has("ArrowLeft")) rightInput -= 1;

    const mag = Math.hypot(forwardInput, rightInput);
    if (mag < 0.02) return false;

    const normF = mag > 1 ? forwardInput / mag : forwardInput;
    const normR = mag > 1 ? rightInput / mag : rightInput;

    const speed = 2.35 * dt;
    const forward = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(0, this.walkYaw, 0));
    const right = new THREE.Vector3(1, 0, 0).applyEuler(new THREE.Euler(0, this.walkYaw, 0));

    const prevX = this.camera.position.x;
    const prevZ = this.camera.position.z;
    const nextX = prevX + (forward.x * normF + right.x * normR) * speed;
    const nextZ = prevZ + (forward.z * normF + right.z * normR) * speed;

    // Wall collision sliding against SKYONE A2 interior & perimeter walls
    const resolved = resolveWalkthroughCollision(prevX, prevZ, nextX, nextZ, 0.24);
    this.camera.position.x = resolved.x;
    this.camera.position.z = resolved.z;
    this.camera.position.y = 1.6;
    return true;
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    this.resizeObserver.disconnect();
    this.controls.removeEventListener("change", this.handleControlsChange);
    const dom = this.renderer.domElement;
    dom.removeEventListener("pointerdown", this.handlePointerDown);
    dom.removeEventListener("pointermove", this.handlePointerMove);
    dom.removeEventListener("pointerup", this.handlePointerUp);
    dom.removeEventListener("webglcontextlost", this.handleContextLost);
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);

    if (this.selectionBoxHelper) {
      this.selectionBoxHelper.dispose();
    }
    disposeObjectTree(this.architectureGroup, true);
    disposeObjectTree(this.ceilingGroup, true);
    disposeObjectTree(this.furnitureGroup, true);
    disposeObjectTree(this.mepGroup, true);
    this.materialLib.dispose();
    this.envRenderTarget.dispose();
    this.pmrem.dispose();
    this.controls.dispose();
    this.renderer.dispose();

    if (dom.parentElement === this.container) {
      this.container.removeChild(dom);
    }
  }
}
