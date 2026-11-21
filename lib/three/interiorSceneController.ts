import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import {
  InteriorDesignScenario,
  InteriorDoorMode,
  InteriorFloorPattern,
  InteriorFurnitureItem,
  InteriorLightingZones,
  InteriorMepPoint,
  InteriorWallOverride,
} from "@/types/finance";
import {
  DEFAULT_LIGHTING_ZONES,
  INTERIOR_STYLE_PRESETS,
  SKYONE_A2_OPENINGS,
  SKYONE_A2_PLINTH_POLYGON,
  SKYONE_A2_ROOMS,
  SKYONE_A2_SHAFTS,
  SKYONE_A2_WALLS,
  WallSegmentSpec,
  createDefaultSkyOneA2MepPoints,
} from "@/lib/interiorFloorplan";
import {
  computeSurfaceElevationCm,
  resolveWalkthroughCollision,
  snapPositionToWalls,
} from "@/lib/interiorCadEngine";
import {
  createInteriorMaterialLibrary,
  InteriorMaterialLibrary,
} from "./interiorMaterials";
import {
  buildFurnitureMeshGroup,
  loadCustomGlbNormalized,
  tagFurnitureGroup,
} from "./interiorFurnitureFactory";

export type InteriorCameraPreset =
  | "DOLLHOUSE"
  | "ENTRANCE"
  | "LIVING_BALCONY"
  | "KITCHEN_DINING"
  | "MASTER_BEDROOM"
  | "ROOM_05_STUDIO";

export type InteriorTimeOfDay = "MORNING_08" | "NOON_12" | "AFTERNOON_1630" | "EVENING_20";

export type InteriorNavMode = "ORBIT" | "WALKTHROUGH";

export type InteriorInteractionMode = "FURNITURE" | "ARCHITECTURE";

export interface InteriorArchTarget {
  kind: "WALL" | "DOOR";
  id: string;
}

interface CameraPresetTarget {
  pos: [number, number, number];
  target: [number, number, number];
}

const CAMERA_PRESETS: Record<InteriorCameraPreset, CameraPresetTarget> = {
  DOLLHOUSE: { pos: [5.6, 7.6, 6.2], target: [0.1, 0.55, 0.1] },
  ENTRANCE: { pos: [0.55, 1.62, 3.15], target: [1.4, 1.15, -1.6] },
  LIVING_BALCONY: { pos: [2.1, 1.55, 1.45], target: [2.25, 1.12, -3.1] },
  KITCHEN_DINING: { pos: [1.25, 1.72, -0.35], target: [2.55, 1.0, 2.55] },
  MASTER_BEDROOM: { pos: [0.15, 1.62, -0.85], target: [-1.45, 0.95, -2.55] },
  ROOM_05_STUDIO: { pos: [-1.85, 1.62, 1.68], target: [-2.05, 1.02, 3.25] },
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
    sunPos: [7.8, 4.8, -8.8],
    sunColor: "#FFE6C2",
    sunIntensity: 2.35,
    hemiSky: "#F2F7FF",
    hemiGround: "#C9B9A6",
    hemiIntensity: 0.72,
    indoorIntensity: 0.42,
    exposure: 1.06,
  },
  NOON_12: {
    sunPos: [3.0, 11.5, -4.2],
    sunColor: "#FFFFFF",
    sunIntensity: 2.45,
    hemiSky: "#F8FAFF",
    hemiGround: "#B8AEA0",
    hemiIntensity: 0.85,
    indoorIntensity: 0.28,
    exposure: 1.05,
  },
  AFTERNOON_1630: {
    sunPos: [-6.8, 5.2, -5.8],
    sunColor: "#FFD4A0",
    sunIntensity: 1.72,
    hemiSky: "#F4E8DC",
    hemiGround: "#9C8F82",
    hemiIntensity: 0.65,
    indoorIntensity: 0.72,
    exposure: 1.02,
  },
  EVENING_20: {
    sunPos: [2.0, 8.0, -8.0],
    sunColor: "#93B4E8",
    sunIntensity: 0.34,
    hemiSky: "#3B4A68",
    hemiGround: "#2C2824",
    hemiIntensity: 0.42,
    indoorIntensity: 1.95,
    exposure: 0.98,
  },
};

export interface InteriorSceneCallbacks {
  onSelectItem: (id: string | null) => void;
  onItemMoved: (id: string, x: number, z: number, elevationCm?: number) => void;
  onSelectArchitecture?: (target: InteriorArchTarget | null) => void;
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
  return `${item.catalogKey}|${item.dimensionsCm.width}|${item.dimensionsCm.depth}|${item.dimensionsCm.height}|${item.materialFinish}|${item.mountType ?? "FLOOR"}|${item.elevationCm ?? "auto"}|${item.customGlbId ?? ""}|${stylePreset}`;
}

function computeArchSignature(scenario: InteriorDesignScenario): string {
  return JSON.stringify({
    s: scenario.stylePreset,
    w: scenario.wallOverrides ?? null,
    d: scenario.doorOverrides ?? null,
    f: scenario.roomFloorOverrides ?? null,
  });
}

/**
 * Tạo geometry rèm sóng lượn 3D hình sin chân thực thay cho khối hộp vuông.
 */
function createPleatedCurtainGeometry(
  width: number,
  height: number,
  pleatCount = 8,
  amplitude = 0.032
): THREE.BufferGeometry {
  const segX = Math.max(12, pleatCount * 4);
  const segY = 4;
  const geo = new THREE.PlaneGeometry(width, height, segX, segY);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const u = (x + width / 2) / (width || 1);
    const wave = Math.sin(u * Math.PI * 2 * pleatCount) * amplitude;
    pos.setZ(i, wave);
  }
  geo.computeVertexNormals();
  return geo;
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
  private skyDomeMesh: THREE.Mesh;
  private skyDomeMat: THREE.MeshBasicMaterial;
  private wallMeshRecords: { mesh: THREE.Object3D; cutawaySide?: WallSegmentSpec["cutawaySide"] }[] = [];
  private archSelectableMap = new Map<string, THREE.Object3D>();
  private curtainControls: {
    leftDrape: THREE.Object3D;
    rightDrape: THREE.Object3D;
    openingWidth: number;
  }[] = [];

  // Lighting zone bindings
  private zoneLightMap: Record<keyof InteriorLightingZones, THREE.PointLight>;
  private zoneDownlightMeshes: Record<keyof InteriorLightingZones, THREE.Mesh[]> = {
    living: [],
    kitchen: [],
    master: [],
    room05: [],
  };
  private coveLedMesh: THREE.Mesh | null = null;

  // Incremental furniture & arch state
  private furnitureMap = new Map<string, THREE.Group>();
  private furnitureItemData = new Map<string, InteriorFurnitureItem>();
  private furnitureSignatureMap = new Map<string, string>();
  private customGlbHydratedMap = new Map<string, string>();
  private selectionBoxHelper: THREE.BoxHelper | null = null;
  private archSignature = "";
  private currentWallOverrides?: Record<string, InteriorWallOverride>;
  private currentDoorOverrides?: Record<string, InteriorDoorMode>;
  private currentFloorOverrides?: Record<string, InteriorFloorPattern>;
  private currentLightingZones: InteriorLightingZones = { ...DEFAULT_LIGHTING_ZONES };
  private currentCurtainOpenRatio = 0.85;

  // Lights
  private sunLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;

  // Interactive & Navigation state
  private navMode: InteriorNavMode = "ORBIT";
  private interactionMode: InteriorInteractionMode = "FURNITURE";
  private autoCutaway = true;
  private showMepLayer = false;
  private selectedItemId: string | null = null;
  private selectedArchTarget: InteriorArchTarget | null = null;
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
      preserveDrawingBuffer: false,
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

    this.camera = new THREE.PerspectiveCamera(42, width / height, 0.08, 80);
    this.camera.position.set(...CAMERA_PRESETS.DOLLHOUSE.pos);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = !this.isSoftwareGl;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.03;
    this.controls.minDistance = 1.3;
    this.controls.maxDistance = 16.5;
    this.controls.target.set(...CAMERA_PRESETS.DOLLHOUSE.target);
    this.controls.update();
    this.controls.addEventListener("change", this.handleControlsChange);

    // Lights — Upgraded 2048x2048 crisp diagonal sunlight shadows on real GPU
    this.hemiLight = new THREE.HemisphereLight("#F2F7FF", "#C9B9A6", 0.72);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight("#FFE6C2", 2.35);
    this.sunLight.position.set(7.8, 4.8, -8.8);
    this.sunLight.castShadow = !this.isSoftwareGl;
    this.sunLight.shadow.mapSize.set(this.isSoftwareGl ? 1024 : 2048, this.isSoftwareGl ? 1024 : 2048);
    this.sunLight.shadow.camera.near = 1;
    this.sunLight.shadow.camera.far = 26;
    this.sunLight.shadow.camera.left = -5.4;
    this.sunLight.shadow.camera.right = 5.4;
    this.sunLight.shadow.camera.top = 5.4;
    this.sunLight.shadow.camera.bottom = -5.4;
    this.sunLight.shadow.bias = -0.0003;
    this.sunLight.shadow.normalBias = 0.025;
    this.scene.add(this.sunLight);

    // 4-Zone Indoor Lights (Living, Kitchen, Master, Room 05)
    const createZoneLight = (x: number, y: number, z: number): THREE.PointLight => {
      const pLight = new THREE.PointLight("#FFE3B5", 0.42, 7.2, 1.8);
      pLight.position.set(x, y, z);
      this.scene.add(pLight);
      return pLight;
    };

    this.zoneLightMap = {
      living: createZoneLight(2.1, 2.55, -0.8),
      kitchen: createZoneLight(2.2, 2.55, 2.3),
      master: createZoneLight(-1.0, 2.45, -2.0),
      room05: createZoneLight(-1.85, 2.45, 2.6),
    };

    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.materialLib = createInteriorMaterialLibrary(
      initialScenario.stylePreset,
      maxAniso,
      this.isSoftwareGl
    );

    // 12A Floor Panoramic Sky Dome (visible inside rooms & walkthrough)
    this.skyDomeMat = new THREE.MeshBasicMaterial({
      map: this.materialLib.skyDomeTextures.MORNING_08,
      side: THREE.BackSide,
      depthWrite: false,
    });
    this.skyDomeMesh = new THREE.Mesh(new THREE.SphereGeometry(28, 32, 20), this.skyDomeMat);
    this.skyDomeMesh.position.set(0, 1.2, 0);
    this.skyDomeMesh.visible = false;
    this.scene.add(this.skyDomeMesh);

    this.applySceneBackdrop();

    this.scene.add(this.architectureGroup);
    this.scene.add(this.ceilingGroup);
    this.scene.add(this.furnitureGroup);
    this.mepGroup.visible = this.showMepLayer;
    this.scene.add(this.mepGroup);

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

  public requestRender(): void {
    if (this.disposed || this.renderScheduled) return;
    this.renderScheduled = true;
    this.rafId = requestAnimationFrame(this.renderFrame);
  }

  private updateCeilingAndSkyVisibility(): void {
    const insideRoomView = this.navMode === "WALKTHROUGH" || this.camera.position.y <= 4.15;
    this.ceilingGroup.visible = insideRoomView;
    this.skyDomeMesh.visible = insideRoomView;
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
      this.updateCeilingAndSkyVisibility();

      if (
        this.controls.enableDamping &&
        (this.camera.position.distanceToSquared(this.prevCamPos) > 1e-7 ||
          this.controls.target.distanceToSquared(this.prevTargetPos) > 1e-7)
      ) {
        keepRendering = true;
      }
    } else {
      const moved = this.updateWalkthroughMovement(dt);
      this.updateCeilingAndSkyVisibility();
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

  public setCameraFov(fov: number): void {
    const clamped = THREE.MathUtils.clamp(fov, 32, 65);
    this.camera.fov = clamped;
    this.camera.updateProjectionMatrix();
    this.requestRender();
  }

  public setInteractionMode(mode: InteriorInteractionMode): void {
    this.interactionMode = mode;
    if (mode === "ARCHITECTURE") {
      this.selectedItemId = null;
      this.callbacks.onSelectItem(null);
    } else {
      this.selectedArchTarget = null;
      this.callbacks.onSelectArchitecture?.(null);
    }
    this.refreshSelectionHelper();
    this.requestRender();
  }

  public setSelectedArchTarget(target: InteriorArchTarget | null): void {
    this.selectedArchTarget = target;
    this.refreshSelectionHelper();
    this.requestRender();
  }

  private tagArchObject(group: THREE.Object3D, kind: "WALL" | "DOOR", id: string): void {
    const key = `${kind}:${id}`;
    this.archSelectableMap.set(key, group);
    group.traverse((obj) => {
      obj.userData.archKind = kind;
      obj.userData.archId = id;
    });
  }

  /**
   * Dựng 1 đoạn tường chuẩn 99% A2:
   * - Tự động cắt lỗ cửa sổ/cửa đi
   * - Hỗ trợ 4 chế độ vách (SOLID / OPEN / GLASS_PARTITION / WOOD_SLAT) cho vách phi kết cấu
   * - Hỗ trợ ốp Accent Wall + ốp gạch Marble WC + len chân tường 10cm + nắp cắt kiến trúc màu tối
   * - Hỗ trợ góc bo cong WC kèm hộc giày âm cong LED 3000K + lam nhôm thông gió Lô gia 08
   */
  private buildWallSegment(wall: WallSegmentSpec): THREE.Group {
    const wallGroup = new THREE.Group();
    const dx = wall.x2 - wall.x1;
    const dz = wall.z2 - wall.z1;
    const length = Math.hypot(dx, dz);
    const angle = Math.atan2(dz, dx);
    const dirX = dx / (length || 1);
    const dirZ = dz / (length || 1);
    const midX = (wall.x1 + wall.x2) / 2;
    const midZ = (wall.z1 + wall.z2) / 2;

    const override = this.currentWallOverrides?.[wall.id];
    const effectiveMode = !wall.structural && override?.mode ? override.mode : "SOLID";

    // Resolve material: Accent Finish > WC Marble > Standard Wall
    let wallMat: THREE.Material =
      wall.roomSide === "WC" ? this.materialLib.wcMarbleWall : this.materialLib.wallMain;
    if (override?.accentFinish && override.accentFinish !== "DEFAULT") {
      wallMat = this.materialLib.accentWallMaterials[override.accentFinish] || wallMat;
    }

    // 1. Non-structural OPEN mode: top header beam only
    if (effectiveMode === "OPEN") {
      const beamH = 0.22;
      const beam = new THREE.Mesh(
        new THREE.BoxGeometry(length, beamH, wall.thickness),
        this.materialLib.wallMain
      );
      beam.position.set(midX, wall.height - beamH / 2, midZ);
      beam.rotation.y = -angle;
      beam.receiveShadow = true;
      wallGroup.add(beam);
      this.tagArchObject(wallGroup, "WALL", wall.id);
      return wallGroup;
    }

    // 2. Non-structural GLASS_PARTITION mode: slim black aluminum frame + clear tempered glass
    if (effectiveMode === "GLASS_PARTITION") {
      const frameT = 0.045;
      const topBar = new THREE.Mesh(
        new THREE.BoxGeometry(length, frameT, 0.06),
        this.materialLib.darkFrameMetal
      );
      topBar.position.set(midX, wall.height - frameT / 2, midZ);
      topBar.rotation.y = -angle;
      wallGroup.add(topBar);

      const botBar = new THREE.Mesh(
        new THREE.BoxGeometry(length, 0.08, 0.06),
        this.materialLib.darkFrameMetal
      );
      botBar.position.set(midX, 0.04, midZ);
      botBar.rotation.y = -angle;
      wallGroup.add(botBar);

      const glassPane = new THREE.Mesh(
        new THREE.BoxGeometry(length - 0.04, wall.height - 0.12, 0.016),
        this.materialLib.glassPartitionMat
      );
      glassPane.position.set(midX, 0.08 + (wall.height - 0.12) / 2, midZ);
      glassPane.rotation.y = -angle;
      wallGroup.add(glassPane);

      // Vertical slim mullions
      const panels = Math.max(2, Math.round(length / 0.55));
      for (let i = 0; i <= panels; i++) {
        const t = (length * i) / panels;
        const post = new THREE.Mesh(
          new THREE.BoxGeometry(0.032, wall.height, 0.055),
          this.materialLib.darkFrameMetal
        );
        post.position.set(wall.x1 + dirX * t, wall.height / 2, wall.z1 + dirZ * t);
        post.rotation.y = -angle;
        post.castShadow = true;
        wallGroup.add(post);
      }

      this.tagArchObject(wallGroup, "WALL", wall.id);
      return wallGroup;
    }

    // 3. Non-structural WOOD_SLAT mode: breathing oak louver slats
    if (effectiveMode === "WOOD_SLAT") {
      const topBar = new THREE.Mesh(
        new THREE.BoxGeometry(length, 0.06, 0.09),
        this.materialLib.finishes.WARM_OAK
      );
      topBar.position.set(midX, wall.height - 0.03, midZ);
      topBar.rotation.y = -angle;
      wallGroup.add(topBar);

      const botBar = new THREE.Mesh(
        new THREE.BoxGeometry(length, 0.07, 0.09),
        this.materialLib.finishes.WARM_OAK
      );
      botBar.position.set(midX, 0.035, midZ);
      botBar.rotation.y = -angle;
      wallGroup.add(botBar);

      const slatCount = Math.max(5, Math.floor(length / 0.085));
      for (let i = 0; i < slatCount; i++) {
        const t = 0.04 + ((length - 0.08) * i) / Math.max(1, slatCount - 1);
        const slat = new THREE.Mesh(
          new THREE.BoxGeometry(0.038, wall.height - 0.12, 0.075),
          this.materialLib.finishes.WARM_OAK
        );
        slat.position.set(wall.x1 + dirX * t, wall.height / 2, wall.z1 + dirZ * t);
        slat.rotation.y = -angle;
        slat.castShadow = true;
        slat.receiveShadow = true;
        wallGroup.add(slat);
      }

      this.tagArchObject(wallGroup, "WALL", wall.id);
      return wallGroup;
    }

    // 4. Loggia North Louver Wall (low curb + horizontal aluminum ventilation slats letting daylight in)
    if (wall.isLouverWall) {
      const curbH = 0.95;
      const curb = new THREE.Mesh(
        new THREE.BoxGeometry(length, curbH, wall.thickness),
        this.materialLib.wallMain
      );
      curb.position.set(midX, curbH / 2, midZ);
      curb.rotation.y = -angle;
      curb.castShadow = true;
      curb.receiveShadow = true;
      wallGroup.add(curb);

      // Side aluminum channels + 14 horizontal louver blades
      for (const endT of [0.02, length - 0.02]) {
        const frame = new THREE.Mesh(
          new THREE.BoxGeometry(0.04, wall.height - curbH, 0.06),
          this.materialLib.darkFrameMetal
        );
        frame.position.set(
          wall.x1 + dirX * endT,
          curbH + (wall.height - curbH) / 2,
          wall.z1 + dirZ * endT
        );
        frame.rotation.y = -angle;
        wallGroup.add(frame);
      }
      const bladeCount = 14;
      for (let i = 0; i < bladeCount; i++) {
        const by = curbH + 0.08 + ((wall.height - curbH - 0.16) * i) / (bladeCount - 1);
        const blade = new THREE.Mesh(
          new THREE.BoxGeometry(length - 0.06, 0.022, 0.055),
          this.materialLib.darkFrameMetal
        );
        blade.position.set(midX, by, midZ);
        blade.rotation.y = -angle;
        blade.rotation.x = 0.35;
        wallGroup.add(blade);
      }
      this.tagArchObject(wallGroup, "WALL", wall.id);
      return wallGroup;
    }

    // 5. Standard SOLID wall with window/door cutouts, skirting baseboard, and dark architectural top cap
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

    const addWallBox = (t0: number, t1: number, y0: number, y1: number, addCapAndSkirt = false) => {
      const segLen = t1 - t0;
      const segH = y1 - y0;
      if (segLen < 0.02 || segH < 0.02) return;
      const tMid = (t0 + t1) / 2;
      const wx = wall.x1 + dirX * tMid;
      const wz = wall.z1 + dirZ * tMid;

      const geo = new THREE.BoxGeometry(segLen, segH, wall.thickness);
      const mesh = new THREE.Mesh(geo, wallMat);
      mesh.position.set(wx, y0 + segH / 2, wz);
      mesh.rotation.y = -angle;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      wallGroup.add(mesh);

      // Architectural dark top section cap (visible in Dollhouse view)
      if (addCapAndSkirt && Math.abs(y1 - wall.height) < 0.02) {
        const cap = new THREE.Mesh(
          new THREE.BoxGeometry(segLen + 0.002, 0.018, wall.thickness + 0.004),
          this.materialLib.wallSectionCap
        );
        cap.position.set(wx, wall.height + 0.009, wz);
        cap.rotation.y = -angle;
        wallGroup.add(cap);
      }

      // 10cm Skirting Baseboard along interior floor edges (skipped in WC/Loggia)
      if (addCapAndSkirt && y0 < 0.02 && wall.roomSide !== "WC" && wall.roomSide !== "LOGGIA") {
        const skirt = new THREE.Mesh(
          new THREE.BoxGeometry(segLen, 0.095, wall.thickness + 0.016),
          this.materialLib.skirtingMat
        );
        skirt.position.set(wx, 0.0475, wz);
        skirt.rotation.y = -angle;
        skirt.receiveShadow = true;
        wallGroup.add(skirt);
      }
    };

    if (wallOpenings.length === 0) {
      addWallBox(0, length, 0, wall.height, true);
    } else {
      let cursor = 0;
      for (const seg of wallOpenings) {
        if (seg.tStart > cursor) {
          addWallBox(cursor, seg.tStart, 0, wall.height, true);
        }
        if (seg.op.sillHeight > 0.02) {
          addWallBox(seg.tStart, seg.tEnd, 0, seg.op.sillHeight, true);
        }
        const topY = seg.op.sillHeight + seg.op.height;
        if (wall.height > topY + 0.02) {
          addWallBox(seg.tStart, seg.tEnd, topY, wall.height, true);
        }
        cursor = seg.tEnd;
      }
      if (cursor < length) {
        addWallBox(cursor, length, 0, wall.height, true);
      }
    }

    // 6. Signature Curved SW WC Corner + Recessed Curved Shoe Cubby Niche (matching mat-bang-noi-that-2D)
    if (wall.isCurvedCorner) {
      const cornerRadius = 0.28;
      const cx = wall.x1;
      const cz = wall.z1 - cornerRadius;

      // Bottom plinth (0..0.09m)
      const lowerCyl = new THREE.Mesh(
        new THREE.CylinderGeometry(cornerRadius, cornerRadius, 0.09, 20, 1, false, Math.PI, Math.PI / 2),
        wallMat
      );
      lowerCyl.position.set(cx, 0.045, cz);
      wallGroup.add(lowerCyl);

      // Recessed oak backing core inside the curved shoe niche (0.09..0.54m)
      const nicheBack = new THREE.Mesh(
        new THREE.CylinderGeometry(cornerRadius - 0.14, cornerRadius - 0.14, 0.45, 16, 1, false, Math.PI, Math.PI / 2),
        this.materialLib.finishes.WARM_OAK
      );
      nicheBack.position.set(cx, 0.315, cz);
      wallGroup.add(nicheBack);

      // Oak shelf + warm LED strip + 3 neat shoe pairs displayed in the curved recess
      const shelf = new THREE.Mesh(
        new THREE.CylinderGeometry(cornerRadius - 0.02, cornerRadius - 0.02, 0.024, 18, 1, false, Math.PI, Math.PI / 2),
        this.materialLib.finishes.WARM_OAK
      );
      shelf.position.set(cx, 0.105, cz);
      wallGroup.add(shelf);

      const ledRing = new THREE.Mesh(
        new THREE.CylinderGeometry(cornerRadius - 0.04, cornerRadius - 0.04, 0.016, 16, 1, false, Math.PI, Math.PI / 2),
        this.materialLib.warmLedStrip
      );
      ledRing.position.set(cx, 0.525, cz);
      wallGroup.add(ledRing);

      // Stylized shoe silhouettes neatly tucked in the curved cubby
      for (let i = 0; i < 3; i++) {
        const theta = Math.PI + 0.25 + i * 0.46;
        const rMid = cornerRadius - 0.08;
        const shoe = new THREE.Mesh(
          new THREE.BoxGeometry(0.075, 0.065, 0.16),
          i % 2 === 0 ? this.materialLib.finishes.MATTE_CREAM : this.materialLib.finishes.CHARCOAL_SLATE
        );
        shoe.position.set(cx + Math.sin(theta) * rMid, 0.15, cz + Math.cos(theta) * rMid);
        shoe.rotation.y = theta;
        wallGroup.add(shoe);
      }

      // Upper curved wall shell (0.54..wall.height)
      const upperH = wall.height - 0.54;
      const upperCyl = new THREE.Mesh(
        new THREE.CylinderGeometry(cornerRadius, cornerRadius, upperH, 20, 1, false, Math.PI, Math.PI / 2),
        wallMat
      );
      upperCyl.position.set(cx, 0.54 + upperH / 2, cz);
      upperCyl.castShadow = true;
      upperCyl.receiveShadow = true;
      wallGroup.add(upperCyl);

      // Dark section cap on curved corner
      const capCyl = new THREE.Mesh(
        new THREE.CylinderGeometry(cornerRadius + 0.002, cornerRadius + 0.002, 0.018, 20, 1, false, Math.PI, Math.PI / 2),
        this.materialLib.wallSectionCap
      );
      capCyl.position.set(cx, wall.height + 0.009, cz);
      wallGroup.add(capCyl);
    }

    this.tagArchObject(wallGroup, "WALL", wall.id);
    return wallGroup;
  }

  private buildPleatedCurtainPair(
    parent: THREE.Group,
    openingWidth: number,
    curtainHeight: number,
    zOffset: number
  ): void {
    // Curtain track rod
    const rod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, openingWidth + 0.24, 10),
      this.materialLib.darkFrameMetal
    );
    rod.rotation.z = Math.PI / 2;
    rod.position.set(0, curtainHeight + 0.03, zOffset);
    parent.add(rod);

    // Inner sheer white voile curtain layer spanning full width
    const voileGeo = createPleatedCurtainGeometry(openingWidth + 0.06, curtainHeight, 12, 0.02);
    const voileMesh = new THREE.Mesh(voileGeo, this.materialLib.curtainVoileMat);
    voileMesh.position.set(0, curtainHeight / 2, zOffset - 0.04);
    parent.add(voileMesh);

    // Left & Right pleated heavy linen drapes pivoted at outer edges so scaling X opens/closes cleanly
    const halfW = (openingWidth + 0.16) / 2;
    const createSideDrape = (side: -1 | 1): THREE.Group => {
      const pivot = new THREE.Group();
      pivot.position.set(side * (openingWidth / 2 + 0.08), 0, zOffset + 0.03);
      const drapeGeo = createPleatedCurtainGeometry(halfW, curtainHeight + 0.04, 7, 0.035);
      const drapeMesh = new THREE.Mesh(drapeGeo, this.materialLib.curtainFabric);
      drapeMesh.position.set(-side * (halfW / 2), (curtainHeight + 0.04) / 2, 0);
      drapeMesh.castShadow = true;
      drapeMesh.receiveShadow = true;
      pivot.add(drapeMesh);
      parent.add(pivot);
      return pivot;
    };

    const leftDrape = createSideDrape(-1);
    const rightDrape = createSideDrape(1);
    this.curtainControls.push({ leftDrape, rightDrape, openingWidth });
  }

  private applyCurtainOpenRatioToMeshes(): void {
    // openRatio = 1 => curtains pulled tight to sides (scaleX = 0.26); openRatio = 0 => fully closed (scaleX = 1.0)
    const scaleX = THREE.MathUtils.lerp(1.0, 0.26, this.currentCurtainOpenRatio);
    for (const ctrl of this.curtainControls) {
      ctrl.leftDrape.scale.x = scaleX;
      ctrl.rightDrape.scale.x = scaleX;
    }
  }

  private applyLightingZonesToScene(): void {
    const cfg = TIME_LIGHTING[this.timeOfDay];
    const zones = this.currentLightingZones;

    (Object.keys(this.zoneLightMap) as (keyof InteriorLightingZones)[]).forEach((zoneKey) => {
      const isOn = zones[zoneKey];
      this.zoneLightMap[zoneKey].intensity = isOn ? cfg.indoorIntensity : 0;
      const mat = isOn ? this.materialLib.downlightOnMat : this.materialLib.downlightOffMat;
      for (const mesh of this.zoneDownlightMeshes[zoneKey]) {
        mesh.material = mat;
      }
    });

    if (this.coveLedMesh) {
      this.coveLedMesh.material = zones.living
        ? this.materialLib.coveLedMat
        : this.materialLib.downlightOffMat;
    }
  }

  private buildArchitecture(): void {
    disposeObjectTree(this.architectureGroup, true);
    this.architectureGroup.clear();
    disposeObjectTree(this.ceilingGroup, true);
    this.ceilingGroup.clear();
    this.wallMeshRecords = [];
    this.archSelectableMap.clear();
    this.curtainControls = [];
    this.zoneDownlightMeshes = { living: [], kitchen: [], master: [], room05: [] };
    this.coveLedMesh = null;

    // 0. Exact Stepped Polygonal Architectural Plinth matching SKYONE A2 real footprint
    const plinthShape = new THREE.Shape();
    SKYONE_A2_PLINTH_POLYGON.forEach((pt, idx) => {
      // Note: ShapeGeometry / ExtrudeGeometry lies on XY plane; when rotated -PI/2 around X, +Y maps to -Z
      if (idx === 0) plinthShape.moveTo(pt.x, -pt.z);
      else plinthShape.lineTo(pt.x, -pt.z);
    });
    plinthShape.closePath();

    const plinthGeo = new THREE.ExtrudeGeometry(plinthShape, {
      depth: 0.16,
      bevelEnabled: false,
    });
    const plinthMesh = new THREE.Mesh(plinthGeo, this.materialLib.wallCutawayCap);
    plinthMesh.rotation.x = -Math.PI / 2;
    plinthMesh.position.set(0, -0.175, 0);
    plinthMesh.receiveShadow = true;
    this.architectureGroup.add(plinthMesh);

    // 1. Individual Room Floors (8 CAD zones, with Herringbone wood support for Master & Room 05)
    for (const room of SKYONE_A2_ROOMS) {
      const floorGeo = new THREE.BoxGeometry(room.width, 0.02, room.depth);
      const patternOverride = this.currentFloorOverrides?.[room.id];
      let mat: THREE.Material;
      if (room.floorMaterial === "WOOD_TILE") {
        mat =
          patternOverride === "HERRINGBONE"
            ? this.materialLib.floorWoodHerringbone
            : this.materialLib.floorWoodTile;
      } else if (room.floorMaterial === "BATH_MARBLE") {
        mat = this.materialLib.floorBathMarble;
      } else if (room.floorMaterial === "LOGGIA_GREY") {
        mat = this.materialLib.floorLoggiaGrey;
      } else {
        mat = this.materialLib.floorLivingTile;
      }
      const mesh = new THREE.Mesh(floorGeo, mat);
      mesh.position.set(room.x, -0.01, room.z);
      mesh.receiveShadow = true;
      this.architectureGroup.add(mesh);
    }

    // 1b. Brushed Brass / Aluminum T-strip floor transitions at room thresholds
    const transitions: { x: number; z: number; w: number; d: number }[] = [
      { x: 0.2, z: -0.6, w: 0.78, d: 0.03 }, // Master threshold
      { x: -0.2, z: 0.55, w: 0.03, d: 0.76 }, // WC threshold
      { x: -0.15, z: 1.88, w: 0.03, d: 0.84 }, // Room 05 threshold
      { x: -2.65, z: 1.4, w: 0.85, d: 0.03 }, // Loggia threshold
    ];
    for (const tr of transitions) {
      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(tr.w, 0.005, tr.d),
        this.materialLib.floorTrimMetal
      );
      strip.position.set(tr.x, 0.0025, tr.z);
      this.architectureGroup.add(strip);
    }

    // 2. Structural & MEP Shafts (2 WC plumbing shafts + 1 Balcony corner shaft)
    for (const shaft of SKYONE_A2_SHAFTS) {
      const isWcShaft = shaft.id.startsWith("shaft_wc");
      const shaftMat = isWcShaft ? this.materialLib.wcMarbleWall : this.materialLib.wallMain;
      const sMesh = new THREE.Mesh(
        new THREE.BoxGeometry(shaft.width, shaft.height, shaft.depth),
        shaftMat
      );
      sMesh.position.set(shaft.x, shaft.height / 2, shaft.z);
      sMesh.castShadow = true;
      sMesh.receiveShadow = true;
      this.architectureGroup.add(sMesh);

      const sCap = new THREE.Mesh(
        new THREE.BoxGeometry(shaft.width + 0.004, 0.018, shaft.depth + 0.004),
        this.materialLib.wallSectionCap
      );
      sCap.position.set(shaft.x, shaft.height + 0.009, shaft.z);
      this.architectureGroup.add(sCap);
    }

    // 3. Walls
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

        this.tagArchObject(railGroup, "WALL", wall.id);
        this.architectureGroup.add(railGroup);
        this.wallMeshRecords.push({ mesh: railGroup, cutawaySide: wall.cutawaySide });
        continue;
      }

      const wallGroup = this.buildWallSegment(wall);
      this.architectureGroup.add(wallGroup);
      this.wallMeshRecords.push({ mesh: wallGroup, cutawaySide: wall.cutawaySide });
    }

    // 4. Openings (Main door Left-Hinge, Balcony sliding + wavy curtains, Master window + wavy curtains, Customizable Interior doors, Loggia door, WC window)
    for (const op of SKYONE_A2_OPENINGS) {
      const opGroup = new THREE.Group();
      opGroup.position.set(op.x, 0, op.z);
      opGroup.rotation.y = op.rotationY;

      if (op.kind === "MAIN_DOOR") {
        // Reversed to match mat-bang-noi-that-2D: Wide main leaf on LEFT, narrow fixed leaf on RIGHT
        const wideW = op.width * 0.66;
        const narrowW = op.width * 0.31;
        const leafL = new THREE.Mesh(
          new THREE.BoxGeometry(wideW, op.height, 0.06),
          this.materialLib.lecmaxWoodDoor
        );
        leafL.position.set(-op.width / 2 + wideW / 2, op.height / 2, 0);
        leafL.castShadow = true;
        opGroup.add(leafL);

        const leafR = new THREE.Mesh(
          new THREE.BoxGeometry(narrowW, op.height, 0.06),
          this.materialLib.lecmaxWoodDoor
        );
        leafR.position.set(op.width / 2 - narrowW / 2, op.height / 2, 0);
        leafR.castShadow = true;
        opGroup.add(leafR);

        // Hafele smart digital lock near right edge of wide left leaf
        const lock = new THREE.Mesh(
          new THREE.BoxGeometry(0.055, 0.26, 0.09),
          this.materialLib.darkFrameMetal
        );
        lock.position.set(-op.width / 2 + wideW - 0.08, 1.08, 0);
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

        // 2-Layer Pleated Wavy Curtains (Voile + Linen Drape)
        this.buildPleatedCurtainPair(opGroup, op.width, op.height + 0.2, 0.14);
        this.wallMeshRecords.push({ mesh: opGroup, cutawaySide: "NORTH" });
      } else if (op.kind === "INTERIOR_DOOR") {
        const doorMode: InteriorDoorMode = this.currentDoorOverrides?.[op.id] ?? "SWING_90";

        // Door jambs & header
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

        if (doorMode === "SWING_90") {
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
        } else if (doorMode === "SLIDING_POCKET") {
          // Black overhead sliding rail + barn/pocket door slid cleanly to side
          const rail = new THREE.Mesh(
            new THREE.BoxGeometry(op.width * 1.9, 0.055, 0.06),
            this.materialLib.darkFrameMetal
          );
          rail.position.set(op.width * 0.35, op.height + 0.07, 0.09);
          opGroup.add(rail);

          const slidingLeaf = new THREE.Mesh(
            new THREE.BoxGeometry(op.width * 0.94, op.height, 0.038),
            this.materialLib.interiorWoodDoor
          );
          slidingLeaf.position.set(op.width * 0.65, op.height / 2, 0.09);
          slidingLeaf.castShadow = true;
          opGroup.add(slidingLeaf);

          const pull = new THREE.Mesh(
            new THREE.BoxGeometry(0.024, 0.24, 0.052),
            this.materialLib.darkFrameMetal
          );
          pull.position.set(op.width * 0.26, 1.02, 0.09);
          opGroup.add(pull);
        }
        // OPEN_ARCH leaves the cased opening clean with no leaf

        if (op.customizableDoor) {
          this.tagArchObject(opGroup, "DOOR", op.id);
        }
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
          // 2-Layer Pleated Curtains on Master Bedroom Window
          this.buildPleatedCurtainPair(opGroup, op.width + 0.25, 2.58, 0.14);
          this.wallMeshRecords.push({ mesh: opGroup, cutawaySide: "NORTH" });
        }
      }

      this.architectureGroup.add(opGroup);
    }

    // 5. Stepped Gypsum Ceiling + Warm LED Cove + 4-Zone Recessed Downlights (auto-hidden in Dollhouse, shown in rooms/Walkthrough)
    const livingCeiling = new THREE.Mesh(
      new THREE.BoxGeometry(3.25, 0.08, 4.9),
      this.materialLib.ceilingMat
    );
    livingCeiling.position.set(2.0, 2.86, -0.2);
    this.ceilingGroup.add(livingCeiling);

    // Recessed stepped cove frame + glowing LED perimeter
    this.coveLedMesh = new THREE.Mesh(
      new THREE.BoxGeometry(2.55, 0.022, 4.15),
      this.materialLib.coveLedMat
    );
    this.coveLedMesh.position.set(2.0, 2.805, -0.2);
    this.ceilingGroup.add(this.coveLedMesh);

    const kitchenCeiling = new THREE.Mesh(
      new THREE.BoxGeometry(2.55, 0.08, 1.9),
      this.materialLib.ceilingMat
    );
    kitchenCeiling.position.set(2.38, 2.86, 2.7);
    this.ceilingGroup.add(kitchenCeiling);

    const corridorCeiling = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.08, 3.4),
      this.materialLib.ceilingMat
    );
    corridorCeiling.position.set(0.55, 2.86, 1.95);
    this.ceilingGroup.add(corridorCeiling);

    const masterCeiling = new THREE.Mesh(
      new THREE.BoxGeometry(3.18, 0.08, 3.05),
      this.materialLib.ceilingMat
    );
    masterCeiling.position.set(-0.95, 2.74, -2.1);
    this.ceilingGroup.add(masterCeiling);

    const room05Ceiling = new THREE.Mesh(
      new THREE.BoxGeometry(3.62, 0.08, 2.25),
      this.materialLib.ceilingMat
    );
    room05Ceiling.position.set(-1.8, 2.74, 2.5);
    this.ceilingGroup.add(room05Ceiling);

    const wcCeiling = new THREE.Mesh(
      new THREE.BoxGeometry(2.38, 0.08, 2.02),
      this.materialLib.ceilingMat
    );
    wcCeiling.position.set(-1.35, 2.58, 0.4);
    this.ceilingGroup.add(wcCeiling);

    const addDownlights = (
      zone: keyof InteriorLightingZones,
      coords: [number, number, number][]
    ) => {
      for (const [dx, dy, dz] of coords) {
        const rim = new THREE.Mesh(
          new THREE.CylinderGeometry(0.068, 0.068, 0.012, 14),
          this.materialLib.darkFrameMetal
        );
        rim.position.set(dx, dy, dz);
        this.ceilingGroup.add(rim);

        const bulb = new THREE.Mesh(
          new THREE.CylinderGeometry(0.052, 0.052, 0.016, 14),
          this.materialLib.downlightOnMat
        );
        bulb.position.set(dx, dy - 0.004, dz);
        this.ceilingGroup.add(bulb);
        this.zoneDownlightMeshes[zone].push(bulb);
      }
    };

    addDownlights("living", [
      [1.3, 2.79, -1.7],
      [2.8, 2.79, -1.7],
      [1.3, 2.79, 0.4],
      [2.8, 2.79, 0.4],
    ]);
    addDownlights("kitchen", [
      [2.1, 2.79, 2.35],
      [3.0, 2.79, 2.95],
      [0.55, 2.79, 2.65],
    ]);
    addDownlights("master", [
      [-1.7, 2.69, -2.6],
      [-0.2, 2.69, -2.6],
      [-1.0, 2.69, -1.3],
    ]);
    addDownlights("room05", [
      [-2.5, 2.69, 2.3],
      [-1.1, 2.69, 2.3],
      [-1.8, 2.69, 3.1],
    ]);

    this.applyCurtainOpenRatioToMeshes();
    this.applyLightingZonesToScene();
    this.updateCeilingAndSkyVisibility();
  }

  private syncMepMarkers(mepPoints: InteriorMepPoint[]): void {
    disposeObjectTree(this.mepGroup, true);
    this.mepGroup.clear();

    for (const pt of mepPoints) {
      const mat = this.materialLib.mepMaterials[pt.kind] || this.materialLib.mepMaterials.OUTLET_DOUBLE;
      const y = Math.max(0.15, Math.min(2.6, pt.heightCm / 100));

      const holder = new THREE.Group();
      holder.position.set(pt.x, y, pt.z);

      const box = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.09, 0.06), mat);
      holder.add(box);

      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, y, 8), mat);
      stem.position.set(0, -y / 2, 0);
      holder.add(stem);

      const floorRing = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.012, 14), mat);
      floorRing.position.set(0, -y + 0.008, 0);
      holder.add(floorRing);

      this.mepGroup.add(holder);
    }
  }

  private hydrateCustomGlbIfNeeded(item: InteriorFurnitureItem): void {
    if (item.catalogKey !== "custom_glb_model" || !item.customGlbId) return;
    const hydrateKey = `${item.customGlbId}|${item.dimensionsCm.width}|${item.dimensionsCm.depth}|${item.dimensionsCm.height}`;
    if (this.customGlbHydratedMap.get(item.id) === hydrateKey) return;
    this.customGlbHydratedMap.set(item.id, hydrateKey);

    void loadCustomGlbNormalized(item.customGlbId, item.dimensionsCm).then((loadedGroup) => {
      if (this.disposed || !loadedGroup) return;
      const currentMeta = this.furnitureItemData.get(item.id);
      const existing = this.furnitureMap.get(item.id);
      if (!currentMeta || !existing) return;

      const yElev = (currentMeta.elevationCm ?? 0) / 100;
      loadedGroup.position.set(currentMeta.position.x, yElev, currentMeta.position.z);
      loadedGroup.rotation.y = (currentMeta.rotationDeg * Math.PI) / 180;
      tagFurnitureGroup(loadedGroup, currentMeta);

      this.furnitureGroup.remove(existing);
      disposeObjectTree(existing, true);
      this.furnitureGroup.add(loadedGroup);
      this.furnitureMap.set(item.id, loadedGroup);
      this.refreshSelectionHelper();
      this.requestRender();
    });
  }

  public syncScenario(scenario: InteriorDesignScenario): void {
    if (this.disposed) return;

    this.currentWallOverrides = scenario.wallOverrides;
    this.currentDoorOverrides = scenario.doorOverrides;
    this.currentFloorOverrides = scenario.roomFloorOverrides;
    this.currentLightingZones = {
      ...DEFAULT_LIGHTING_ZONES,
      ...(scenario.lightingZones ?? {}),
    };
    this.currentCurtainOpenRatio = scenario.curtainOpenRatio ?? 0.85;

    const styleChanged = scenario.stylePreset !== this.materialLib.stylePreset;
    const nextArchSig = computeArchSignature(scenario);
    const archChanged = nextArchSig !== this.archSignature;

    if (styleChanged) {
      const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
      this.materialLib.dispose();
      this.materialLib = createInteriorMaterialLibrary(
        scenario.stylePreset,
        maxAniso,
        this.isSoftwareGl
      );
      this.skyDomeMat.map = this.materialLib.skyDomeTextures[this.timeOfDay];
      this.skyDomeMat.needsUpdate = true;
      this.applySceneBackdrop();

      disposeObjectTree(this.furnitureGroup, true);
      this.furnitureGroup.clear();
      this.furnitureMap.clear();
      this.furnitureSignatureMap.clear();
      this.furnitureItemData.clear();
      this.customGlbHydratedMap.clear();
    }

    if (styleChanged || archChanged) {
      this.archSignature = nextArchSig;
      this.buildArchitecture();
    } else {
      this.applyCurtainOpenRatioToMeshes();
      this.applyLightingZonesToScene();
    }

    const incomingIds = new Set(scenario.items.map((i) => i.id));

    for (const [id, group] of this.furnitureMap.entries()) {
      if (!incomingIds.has(id)) {
        this.furnitureGroup.remove(group);
        disposeObjectTree(group, true);
        this.furnitureMap.delete(id);
        this.furnitureSignatureMap.delete(id);
        this.furnitureItemData.delete(id);
        this.customGlbHydratedMap.delete(id);
      }
    }

    for (const item of scenario.items) {
      this.furnitureItemData.set(item.id, item);
      const sig = computeFurnitureSignature(item, scenario.stylePreset);
      const existing = this.furnitureMap.get(item.id);
      const prevSig = this.furnitureSignatureMap.get(item.id);

      if (existing && prevSig === sig) {
        const yElev = (item.elevationCm ?? 0) / 100;
        existing.position.set(item.position.x, yElev, item.position.z);
        existing.rotation.y = (item.rotationDeg * Math.PI) / 180;
        existing.userData.isLocked = Boolean(item.isLocked);
      } else {
        if (existing) {
          this.furnitureGroup.remove(existing);
          disposeObjectTree(existing, true);
          this.customGlbHydratedMap.delete(item.id);
        }
        const meshGroup = buildFurnitureMeshGroup(item, this.materialLib);
        this.furnitureGroup.add(meshGroup);
        this.furnitureMap.set(item.id, meshGroup);
        this.furnitureSignatureMap.set(item.id, sig);
        this.hydrateCustomGlbIfNeeded(item);
      }
    }

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

    if (this.interactionMode === "ARCHITECTURE" && this.selectedArchTarget) {
      const key = `${this.selectedArchTarget.kind}:${this.selectedArchTarget.id}`;
      const target = this.archSelectableMap.get(key);
      if (target) {
        this.selectionBoxHelper = new THREE.BoxHelper(target, 0x0d9488);
        this.scene.add(this.selectionBoxHelper);
      }
      return;
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
    this.renderer.toneMappingExposure = cfg.exposure;

    this.skyDomeMat.map = this.materialLib.skyDomeTextures[tod];
    this.skyDomeMat.needsUpdate = true;

    this.applyLightingZonesToScene();
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
    this.updateCeilingAndSkyVisibility();
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
      this.updateCeilingAndSkyVisibility();
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
    const prevHelperVisible = this.selectionBoxHelper?.visible ?? false;
    if (this.selectionBoxHelper) this.selectionBoxHelper.visible = false;
    this.renderer.render(this.scene, this.camera);
    const dataUrl = this.renderer.domElement.toDataURL("image/png");
    if (this.selectionBoxHelper) this.selectionBoxHelper.visible = prevHelperVisible;
    this.requestRender();
    return dataUrl;
  }

  /**
   * Xuất ảnh Render phối cảnh HD (tối đa 2x kích thước viewport, ẩn khung chọn kỹ thuật).
   */
  public captureHighResPng(scale = 2): string {
    const prevPixelRatio = this.renderer.getPixelRatio();
    const prevHelperVisible = this.selectionBoxHelper?.visible ?? false;
    if (this.selectionBoxHelper) this.selectionBoxHelper.visible = false;

    const targetRatio = this.isSoftwareGl ? 1.5 : Math.min(3, Math.max(1.5, scale));
    this.renderer.setPixelRatio(targetRatio);
    this.renderer.render(this.scene, this.camera);
    const dataUrl = this.renderer.domElement.toDataURL("image/png");

    this.renderer.setPixelRatio(prevPixelRatio);
    if (this.selectionBoxHelper) this.selectionBoxHelper.visible = prevHelperVisible;
    this.renderer.render(this.scene, this.camera);
    return dataUrl;
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

    // Architecture Editor Mode: click walls or customizable doors directly in 3D
    if (this.interactionMode === "ARCHITECTURE") {
      const archHits = this.raycaster.intersectObjects(this.architectureGroup.children, true);
      const validHit = archHits.find(
        (h) => h.object.visible && h.object.userData?.archKind && h.object.userData?.archId
      );
      if (validHit) {
        const target: InteriorArchTarget = {
          kind: validHit.object.userData.archKind as "WALL" | "DOOR",
          id: validHit.object.userData.archId as string,
        };
        this.selectedArchTarget = target;
        this.refreshSelectionHelper();
        this.callbacks.onSelectArchitecture?.(target);
        this.requestRender();
      }
      return;
    }

    // Furniture Mode: pick & drag
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
            this.dragOffset.set(group.position.x - hitPoint.x, 0, group.position.z - hitPoint.z);
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
      const snapped = snapPositionToWalls(itemMeta, rawX, rawZ, {
        snapToWall: true,
        wallOverrides: this.currentWallOverrides,
      });
      group.position.x = snapped.x;
      group.position.z = snapped.z;

      // Auto-snap Y onto supporting desk/table for SURFACE items
      if (
        itemMeta.mountType === "SURFACE" ||
        itemMeta.catalogKey === "dual_monitor_arm" ||
        itemMeta.catalogKey === "desk_lamp_screenbar"
      ) {
        const allItems = Array.from(this.furnitureItemData.values());
        const elevCm = computeSurfaceElevationCm(itemMeta, allItems, snapped.x, snapped.z);
        group.position.y = elevCm / 100;
      }

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
      const itemMeta = this.furnitureItemData.get(id);
      this.draggingId = null;
      this.controls.enabled = true;
      if (group && this.dragMoved) {
        const nextX = Number(group.position.x.toFixed(2));
        const nextZ = Number(group.position.z.toFixed(2));
        const isSurface =
          itemMeta?.mountType === "SURFACE" ||
          itemMeta?.catalogKey === "dual_monitor_arm" ||
          itemMeta?.catalogKey === "desk_lamp_screenbar";
        const nextElevCm = isSurface ? Math.round(group.position.y * 100) : undefined;
        this.callbacks.onItemMoved(id, nextX, nextZ, nextElevCm);
      }
      this.requestRender();
      return;
    }

    const dist = Math.hypot(e.clientX - this.pointerDownPos.x, e.clientY - this.pointerDownPos.y);
    if (dist < 6 && this.interactionMode === "FURNITURE") {
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
    // Only cutaway outer perimeter walls when zoomed out in Dollhouse view
    const isHighDollhouse = camPos.y > 4.15;
    if (!isHighDollhouse) {
      for (const rec of this.wallMeshRecords) {
        rec.mesh.visible = true;
      }
      return;
    }

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

    let forwardInput = -this.joystickVec.vz;
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

    const resolved = resolveWalkthroughCollision(
      prevX,
      prevZ,
      nextX,
      nextZ,
      0.24,
      this.currentWallOverrides
    );
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
    this.controls.dispose();

    const dom = this.renderer.domElement;
    dom.removeEventListener("pointerdown", this.handlePointerDown);
    dom.removeEventListener("pointermove", this.handlePointerMove);
    dom.removeEventListener("pointerup", this.handlePointerUp);
    dom.removeEventListener("webglcontextlost", this.handleContextLost);
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);

    if (this.selectionBoxHelper) {
      this.scene.remove(this.selectionBoxHelper);
      this.selectionBoxHelper.dispose();
    }
    disposeObjectTree(this.architectureGroup, true);
    disposeObjectTree(this.ceilingGroup, true);
    disposeObjectTree(this.furnitureGroup, true);
    disposeObjectTree(this.mepGroup, true);
    this.skyDomeMesh.geometry.dispose();
    this.skyDomeMat.dispose();
    this.materialLib.dispose();
    this.envRenderTarget.dispose();
    this.pmrem.dispose();
    this.renderer.dispose();
    if (dom.parentElement) {
      dom.parentElement.removeChild(dom);
    }
  }
}
