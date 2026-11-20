import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { InteriorDesignScenario } from "@/types/finance";
import {
  INTERIOR_STYLE_PRESETS,
  SKYONE_A2_BOUNDS,
  SKYONE_A2_OPENINGS,
  SKYONE_A2_ROOMS,
  SKYONE_A2_WALLS,
  WallSegmentSpec,
} from "@/lib/interiorFloorplan";
import { createInteriorMaterialLibrary, InteriorMaterialLibrary } from "./interiorMaterials";
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

// Ban công khu 03 hướng Đông / Đông Nam (nắng sáng dịu chiếu sâu từ phía -Z/+X)
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
  private wallMeshRecords: { mesh: THREE.Object3D; cutawaySide?: WallSegmentSpec["cutawaySide"] }[] = [];
  private furnitureMap = new Map<string, THREE.Group>();
  private selectionBoxHelper: THREE.BoxHelper | null = null;

  // Lights
  private sunLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private indoorLights: THREE.PointLight[] = [];

  // Interactive & Navigation state
  private navMode: InteriorNavMode = "ORBIT";
  private autoCutaway = true;
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

  // Walkthrough controls
  private pressedKeys = new Set<string>();
  private walkYaw = 0;
  private walkPitch = 0;
  private isWalkLooking = false;
  private lastLookX = 0;
  private lastLookY = 0;

  // Render loop
  private rafId: number | null = null;
  private lastFrameTime = performance.now();
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
      preserveDrawingBuffer: true, // needed for crisp PNG snapshot export
      powerPreference: "high-performance",
    });

    // Software WebGL detection (SwiftShader / llvmpipe / Mesa)
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

    // PMREM RoomEnvironment for physically grounded reflections on glass/metal/porcelain
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    const roomEnv = new RoomEnvironment();
    this.envRenderTarget = this.pmrem.fromScene(roomEnv, 0.04);
    this.scene.environment = this.envRenderTarget.texture;
    roomEnv.dispose();

    this.camera = new THREE.PerspectiveCamera(42, width / height, 0.08, 65);
    this.camera.position.set(...CAMERA_PRESETS.DOLLHOUSE.pos);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.075;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.04;
    this.controls.minDistance = 1.6;
    this.controls.maxDistance = 16.5;
    this.controls.target.set(...CAMERA_PRESETS.DOLLHOUSE.target);
    this.controls.update();

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

    // Warm indoor architectural lights (Living, Kitchen, Master, Room 05 Dual Studio)
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

    // Material library + Architecture + Furniture
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.materialLib = createInteriorMaterialLibrary(initialScenario.stylePreset, maxAniso);
    this.applySceneBackdrop();

    this.scene.add(this.architectureGroup);
    this.scene.add(this.ceilingGroup);
    this.scene.add(this.furnitureGroup);

    this.buildArchitecture();
    this.syncScenario(initialScenario);
    this.setTimeOfDay("MORNING_08");

    // Events
    const dom = this.renderer.domElement;
    dom.addEventListener("pointerdown", this.handlePointerDown);
    dom.addEventListener("pointermove", this.handlePointerMove);
    dom.addEventListener("pointerup", this.handlePointerUp);
    dom.addEventListener("webglcontextlost", this.handleContextLost, false);
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);

    this.startLoop();
  }

  private applySceneBackdrop(): void {
    const preset = INTERIOR_STYLE_PRESETS[this.materialLib.stylePreset];
    this.scene.background = new THREE.Color(
      this.isDarkMode ? preset.canvasBgDark : preset.canvasBgLight
    );
  }

  public setDarkMode(dark: boolean): void {
    this.isDarkMode = dark;
    this.applySceneBackdrop();
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

    // 2. Walls (20 CAD wall segments including curved corner on w_wc_south + balcony railing)
    for (const wall of SKYONE_A2_WALLS) {
      const dx = wall.x2 - wall.x1;
      const dz = wall.z2 - wall.z1;
      const length = Math.hypot(dx, dz);
      const midX = (wall.x1 + wall.x2) / 2;
      const midZ = (wall.z1 + wall.z2) / 2;
      const angle = Math.atan2(dz, dx);

      if (wall.id === "w_north_balcony_rail") {
        // 1.4m iron balustrade + top rail + technical shaft on left
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

        // Boxed technical pipe shaft at left balcony corner (spec 03)
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

      const wallGroup = new THREE.Group();
      const geo = new THREE.BoxGeometry(length, wall.height, wall.thickness);
      const mesh = new THREE.Mesh(geo, this.materialLib.wallMain);
      mesh.position.set(midX, wall.height / 2, midZ);
      mesh.rotation.y = -angle;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      wallGroup.add(mesh);

      // Rounded safety corner column on WC-to-Room05 wall (spec 05: "Tường bo góc an toàn cho con trẻ")
      if (wall.isCurvedCorner) {
        const cornerRadius = 0.28;
        const cornerCyl = new THREE.Mesh(
          new THREE.CylinderGeometry(cornerRadius, cornerRadius, wall.height, 20, 1, false, Math.PI, Math.PI / 2),
          this.materialLib.wallMain
        );
        cornerCyl.position.set(wall.x1, wall.height / 2, wall.z1 - cornerRadius);
        cornerCyl.castShadow = true;
        cornerCyl.receiveShadow = true;
        wallGroup.add(cornerCyl);
      }

      this.architectureGroup.add(wallGroup);
      this.wallMeshRecords.push({ mesh: wallGroup, cutawaySide: wall.cutawaySide });
    }

    // 3. Openings (Lecmax 1.2m main door, 2.4m 3-panel balcony sliding door + curtains, Master window, Loggia door, WC window)
    for (const op of SKYONE_A2_OPENINGS) {
      const opGroup = new THREE.Group();
      opGroup.position.set(op.x, 0, op.z);
      opGroup.rotation.y = op.rotationY;

      if (op.kind === "MAIN_DOOR") {
        // Lecmax 2-leaf wood-grain steel fire door + Hafele smart lock
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
        // Hafele Smart Lock module
        const lock = new THREE.Mesh(
          new THREE.BoxGeometry(0.06, 0.26, 0.09),
          this.materialLib.darkFrameMetal
        );
        lock.position.set(op.width * 0.14, 1.08, 0);
        opGroup.add(lock);
        this.wallMeshRecords.push({ mesh: opGroup, cutawaySide: "SOUTH" });
      } else if (op.kind === "SLIDING_BALCONY") {
        // 3-panel aluminum glass sliding door (2.4m wide)
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

        // Soft 2-layer curtains tucked neatly on both edges
        for (const sx of [-1, 1]) {
          const curtain = new THREE.Mesh(
            new THREE.BoxGeometry(0.28, op.height + 0.12, 0.12),
            this.materialLib.curtainFabric
          );
          curtain.position.set(sx * (op.width / 2 - 0.12), (op.height + 0.12) / 2, 0.12);
          opGroup.add(curtain);
        }
        this.wallMeshRecords.push({ mesh: opGroup, cutawaySide: "NORTH" });
      } else {
        // Windows & Loggia Glass Door
        const glass = new THREE.Mesh(
          new THREE.BoxGeometry(op.width - 0.06, op.height - 0.06, 0.025),
          this.materialLib.glassClear
        );
        glass.position.set(0, op.sillHeight + op.height / 2, 0);
        opGroup.add(glass);

        const topBar = new THREE.Mesh(
          new THREE.BoxGeometry(op.width, 0.05, 0.08),
          this.materialLib.darkFrameMetal
        );
        topBar.position.set(0, op.sillHeight + op.height, 0);
        opGroup.add(topBar);

        const botBar = new THREE.Mesh(
          new THREE.BoxGeometry(op.width, 0.05, 0.08),
          this.materialLib.darkFrameMetal
        );
        botBar.position.set(0, op.sillHeight + 0.025, 0);
        opGroup.add(botBar);
      }

      this.architectureGroup.add(opGroup);
    }

    // 4. Stepped Living Cove Ceiling (2.85m) + Warm LED strip (visible in Walkthrough mode)
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

    // Hide ceiling in Orbit Dollhouse mode so user sees clearly inside apartment
    this.ceilingGroup.visible = this.navMode === "WALKTHROUGH";
  }

  public syncScenario(scenario: InteriorDesignScenario): void {
    if (this.disposed) return;

    // Rebuild material library if style preset changed
    if (scenario.stylePreset !== this.materialLib.stylePreset) {
      const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
      this.materialLib.dispose();
      this.materialLib = createInteriorMaterialLibrary(scenario.stylePreset, maxAniso);
      this.applySceneBackdrop();
      this.buildArchitecture();
    }

    // Clear and rebuild furniture meshes cleanly
    disposeObjectTree(this.furnitureGroup, true);
    this.furnitureGroup.clear();
    this.furnitureMap.clear();

    for (const item of scenario.items) {
      const meshGroup = buildFurnitureMeshGroup(item, this.materialLib);
      this.furnitureGroup.add(meshGroup);
      this.furnitureMap.set(item.id, meshGroup);
    }

    this.refreshSelectionHelper();
  }

  public setSelectedItem(id: string | null): void {
    this.selectedItemId = id;
    this.refreshSelectionHelper();
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
  }

  public setAutoCutaway(enabled: boolean): void {
    this.autoCutaway = enabled;
    if (!enabled) {
      for (const rec of this.wallMeshRecords) {
        rec.mesh.visible = true;
      }
    }
  }

  public setNavMode(mode: InteriorNavMode): void {
    this.navMode = mode;
    this.ceilingGroup.visible = mode === "WALKTHROUGH";

    if (mode === "WALKTHROUGH") {
      this.controls.enabled = false;
      this.animTargetPos = null;
      this.animTargetLook = null;
      // Show all walls in first-person walkthrough
      for (const rec of this.wallMeshRecords) {
        rec.mesh.visible = true;
      }
      // Start at living-room eye level looking toward Room 05 & Balcony
      this.camera.position.set(1.55, 1.6, 1.35);
      this.walkYaw = 0.28;
      this.walkPitch = -0.06;
      this.applyWalkCameraOrientation();
    } else {
      this.controls.enabled = true;
      this.applyCameraPreset("DOLLHOUSE");
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
      return;
    }
    this.animTargetPos = new THREE.Vector3(...cfg.pos);
    this.animTargetLook = new THREE.Vector3(...cfg.target);
  }

  private applyWalkCameraOrientation(): void {
    const euler = new THREE.Euler(this.walkPitch, this.walkYaw, 0, "YXZ");
    this.camera.quaternion.setFromEuler(euler);
  }

  public captureSnapshotPng(): string {
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
      return;
    }

    // Cancel camera animation on manual interaction
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

        const group = this.furnitureMap.get(hitId);
        if (group && !group.userData.isLocked) {
          const hitPoint = new THREE.Vector3();
          if (this.raycaster.ray.intersectPlane(this.floorPlane, hitPoint)) {
            this.draggingId = hitId;
            this.dragMoved = false;
            this.dragOffset.copy(group.position).sub(hitPoint);
            this.controls.enabled = false;
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
      return;
    }

    if (!this.draggingId) return;
    const group = this.furnitureMap.get(this.draggingId);
    if (!group) return;

    const ndc = this.getPointerNdc(e);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hitPoint = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(this.floorPlane, hitPoint)) {
      const rawX = hitPoint.x + this.dragOffset.x;
      const rawZ = hitPoint.z + this.dragOffset.z;
      // Snap to 5cm architectural grid & clamp inside A.12A.07 bounds
      const snappedX = THREE.MathUtils.clamp(
        Math.round(rawX * 20) / 20,
        SKYONE_A2_BOUNDS.minX + 0.25,
        SKYONE_A2_BOUNDS.maxX - 0.25
      );
      const snappedZ = THREE.MathUtils.clamp(
        Math.round(rawZ * 20) / 20,
        SKYONE_A2_BOUNDS.minZ + 0.25,
        SKYONE_A2_BOUNDS.maxZ - 0.25
      );
      group.position.x = snappedX;
      group.position.z = snappedZ;
      this.dragMoved = true;
      if (this.selectionBoxHelper) {
        this.selectionBoxHelper.update();
      }
    }
  };

  private handlePointerUp = (e: PointerEvent): void => {
    if (this.disposed) return;

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
      return;
    }

    // Deselect if clicked empty floor (tiny movement)
    const dist = Math.hypot(e.clientX - this.pointerDownPos.x, e.clientY - this.pointerDownPos.y);
    if (dist < 6) {
      const ndc = this.getPointerNdc(e);
      this.raycaster.setFromCamera(ndc, this.camera);
      const hits = this.raycaster.intersectObjects(this.furnitureGroup.children, true);
      if (hits.length === 0 && this.selectedItemId) {
        this.selectedItemId = null;
        this.refreshSelectionHelper();
        this.callbacks.onSelectItem(null);
      }
    }
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (this.navMode !== "WALKTHROUGH") return;
    this.pressedKeys.add(e.code);
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
    // Hide perimeter walls directly between camera and apartment center when viewing in Dollhouse mode
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

  private updateWalkthroughMovement(dt: number): void {
    if (this.navMode !== "WALKTHROUGH" || this.pressedKeys.size === 0) return;

    const speed = 2.4 * dt;
    const forward = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(0, this.walkYaw, 0));
    const right = new THREE.Vector3(1, 0, 0).applyEuler(new THREE.Euler(0, this.walkYaw, 0));

    if (this.pressedKeys.has("KeyW") || this.pressedKeys.has("ArrowUp")) {
      this.camera.position.addScaledVector(forward, speed);
    }
    if (this.pressedKeys.has("KeyS") || this.pressedKeys.has("ArrowDown")) {
      this.camera.position.addScaledVector(forward, -speed);
    }
    if (this.pressedKeys.has("KeyD") || this.pressedKeys.has("ArrowRight")) {
      this.camera.position.addScaledVector(right, speed);
    }
    if (this.pressedKeys.has("KeyA") || this.pressedKeys.has("ArrowLeft")) {
      this.camera.position.addScaledVector(right, -speed);
    }

    this.camera.position.x = THREE.MathUtils.clamp(
      this.camera.position.x,
      SKYONE_A2_BOUNDS.minX + 0.35,
      SKYONE_A2_BOUNDS.maxX - 0.35
    );
    this.camera.position.z = THREE.MathUtils.clamp(
      this.camera.position.z,
      SKYONE_A2_BOUNDS.minZ + 0.35,
      SKYONE_A2_BOUNDS.maxZ - 0.35
    );
    this.camera.position.y = 1.6;
  }

  private startLoop(): void {
    const tick = (now: number) => {
      if (this.disposed) return;
      this.rafId = requestAnimationFrame(tick);

      const dt = Math.min(0.05, (now - this.lastFrameTime) / 1000);
      this.lastFrameTime = now;

      if (this.navMode === "ORBIT") {
        if (this.animTargetPos && this.animTargetLook) {
          this.camera.position.lerp(this.animTargetPos, 0.12);
          this.controls.target.lerp(this.animTargetLook, 0.12);
          if (
            this.camera.position.distanceTo(this.animTargetPos) < 0.04 &&
            this.controls.target.distanceTo(this.animTargetLook) < 0.04
          ) {
            this.camera.position.copy(this.animTargetPos);
            this.controls.target.copy(this.animTargetLook);
            this.animTargetPos = null;
            this.animTargetLook = null;
          }
        }
        this.controls.update();
        this.updateAutoCutaway();
      } else {
        this.updateWalkthroughMovement(dt);
      }

      this.renderer.render(this.scene, this.camera);
    };

    this.rafId = requestAnimationFrame(tick);
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    this.resizeObserver.disconnect();
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
