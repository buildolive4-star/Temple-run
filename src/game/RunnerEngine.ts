import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { soundSynth } from './audio';
import {
  loadGltfRunnerCharacter,
  setGltfCharacterState,
  type LoadedGltfCharacter,
} from './gltfCharacter';
import { loadTempleEnvironmentProps, type TempleEnvProps } from './envLoader';
import {
  createCoinModel,
  createGuardianModel,
  createObstacleModel,
  createPowerupModel,
  createRunnerModel,
  type GuardianRig,
  type RunnerRig,
} from './models';
import { createProceduralTextures, type ProceduralTextures } from './textures';
import {
  claimDailyMissionReward,
  loadDailyMissionsState,
  recordDailyMissionProgress,
  type MissionProgressDelta,
} from './missions';
import {
  INITIAL_HUD,
  type DailyMissionsSnapshot,
  type GamePhase,
  type HeroId,
  type HudSnapshot,
  type ObstacleKind,
  type PowerupKind,
} from './types';

const LANE_WIDTH = 2.4;
const LANE_XS = [-LANE_WIDTH, 0, LANE_WIDTH] as const;
const TRACK_WIDTH = 7.8;
const SEGMENT_LENGTH = 16;
const SEGMENT_COUNT = 11;
const RECYCLE_Z = 24;

const GRAVITY = -35;
const JUMP_VELOCITY = 13.8;
const FAST_FALL_VEL = -27;
const SLIDE_DURATION = 0.66;
const BASE_SPEED = 16.0;
const MAX_SPEED = 34.0;

// Reusable math scratch objects (zero per-frame GC)
const _mat4 = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _vec3 = new THREE.Vector3();
const _scale = new THREE.Vector3();
const _upAxis = new THREE.Vector3(0, 1, 0);

interface TrackSegment {
  group: THREE.Group;
  deckGroup: THREE.Group;
  gapGroup: THREE.Group;
  z: number;
  hasGap: boolean;
  gapStartLocal: number;
  gapEndLocal: number;
  flames: THREE.Mesh[];
}

interface ObstacleEntity {
  active: boolean;
  clearedScored: boolean;
  kind: ObstacleKind;
  lane: number;
  x: number;
  z: number;
  extraSpeed: number;
  mesh: THREE.Group;
  spinWheel: THREE.Object3D | null;
}

interface CoinEntity {
  active: boolean;
  lane: number;
  x: number;
  y: number;
  z: number;
  phaseOffset: number;
  mesh: THREE.Group;
}

interface PowerupEntity {
  active: boolean;
  kind: PowerupKind;
  lane: number;
  x: number;
  y: number;
  z: number;
  mesh: THREE.Group;
}

interface Particle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  scale: number;
  color: THREE.Color;
  mesh: THREE.Mesh;
}

export class RunnerEngine {
  private container: HTMLElement;
  private onHudUpdate: (snapshot: HudSnapshot) => void;

  private isSoftwareGl = false;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private textures!: ProceduralTextures;

  private runner!: RunnerRig;
  private customGlb: LoadedGltfCharacter | null = null;
  private heroId: HeroId = 'arjun';
  private customHeroName = '';
  private customHeroUid = '';
  private glbLoadSeq = 0;
  private guardian!: GuardianRig;
  private skyTemple!: THREE.Group;
  private introPedestal!: THREE.Group;
  private introRelicOrb!: THREE.Group;
  private motePoints!: THREE.Points;

  // Instanced fallback trees + detailed GLB flora & temple ruins props
  private foliageInstanced!: THREE.InstancedMesh;
  private trunkInstanced!: THREE.InstancedMesh;
  private treeData: Array<{ x: number; y: number; z: number; scale: number; rot: number }> = [];
  private envProps: TempleEnvProps | null = null;
  private scrollingEnvProps: Array<{ mesh: THREE.Object3D; z: number }> = [];

  // Pooled entities
  private segments: TrackSegment[] = [];
  private obstacleTemplates: Record<ObstacleKind, THREE.Group> = {} as Record<ObstacleKind, THREE.Group>;
  private powerupTemplates: Record<PowerupKind, THREE.Group> = {} as Record<PowerupKind, THREE.Group>;
  private obstacles: ObstacleEntity[] = [];
  private coins: CoinEntity[] = [];
  private powerups: PowerupEntity[] = [];
  private particles: Particle[] = [];

  // Shared materials / geometries to dispose cleanly
  private disposableGeos: THREE.BufferGeometry[] = [];
  private disposableMats: THREE.Material[] = [];

  // Simulation state
  private phase: GamePhase = 'title';
  private distance = 0;
  private score = 0;
  private runCoins = 0;
  private bestScore = 0;
  private bestDistance = 0;
  private coinCombo = 0;
  private coinComboTimer = 0;
  private speed = BASE_SPEED;
  private deathReason = '';
  private closeCalls = 0;
  private calloutText = '';
  private calloutKey = 0;
  private calloutTimer = 0;

  // Cutscene & Daily Mission state
  private cutsceneTime = 0;
  private cutsceneLabel = '';
  private cutsceneCaption = '';
  private cutsceneProgress = 0;
  private introRelicSnatched = false;
  private introGuardianRoared = false;
  private outroGuardianSlammed = false;
  private outroFellInAbyss = false;
  private missionsSnapshot: DailyMissionsSnapshot = loadDailyMissionsState();
  private newlyCompletedMission = '';
  private newlyCompletedTimer = 0;
  private missionSyncAccum = 0;
  private runDistSynced = 0;
  private runCoinsSynced = 0;
  private runAcrobatics = 0;
  private runAcrobaticsSynced = 0;
  private runCloseCallsSynced = 0;
  private runPowerups = 0;
  private runPowerupsSynced = 0;

  // Runner kinematics
  private targetLane = 1;
  private runnerX = 0;
  private runnerY = 0;
  private runnerVelY = 0;
  private isGrounded = true;
  private coyoteTimer = 0;
  private slideTimer = 0;
  private squashY = 1;
  private squashXZ = 1;
  private stridePhase = 0;
  private prevStepHalf = 0;

  // Hazards, buffs & juice
  private guardianThreat = 0.28;
  private invulnTimer = 0;
  private hitstopTimer = 0;
  private shakeIntensity = 0;
  private cameraBank = 0;
  private hasShield = false;
  private magnetTimer = 0;
  private boostTimer = 0;
  private titleTime = 0;
  private gameoverTime = 0;
  private spawnZCursor = -42;

  // Input buffering
  private jumpBuffer = 0;
  private slideBuffer = 0;
  private laneBuffer = 0;
  private laneBufferTimer = 0;
  private heldKeys = new Set<string>();

  // Pointer swipe tracking
  private pointerActive = false;
  private pointerStartX = 0;
  private pointerStartY = 0;
  private swipeConsumed = false;

  // Loop & throttling
  private frameId = 0;
  private disposed = false;
  private lastTime = 0;
  private hudEmitAccum = 0;

  constructor(container: HTMLElement, onHudUpdate: (snapshot: HudSnapshot) => void) {
    this.container = container;
    this.onHudUpdate = onHudUpdate;
    this.loadBestScores();
    this.initThree();
    this.buildWorld();
    this.bindEvents();
    this.resetWorldForTitle();
    this.emitHud(true);
    this.lastTime = performance.now();
    this.scheduleNextTick();
  }

  private loadBestScores(): void {
    try {
      this.bestScore = Number(localStorage.getItem('surya_run_best_score') || '0') || 0;
      this.bestDistance = Number(localStorage.getItem('surya_run_best_dist') || '0') || 0;
    } catch {
      this.bestScore = 0;
      this.bestDistance = 0;
    }
  }

  private saveBestScores(): void {
    try {
      localStorage.setItem('surya_run_best_score', String(Math.floor(this.bestScore)));
      localStorage.setItem('surya_run_best_dist', String(Math.floor(this.bestDistance)));
    } catch {
      // Ignore storage failures
    }
  }

  private initThree(): void {
    this.isSoftwareGl = (() => {
      try {
        const probe = document.createElement('canvas');
        const gl = probe.getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    const aspect = width / height;
    const isCompact = Math.min(width, height) < 640;

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 1.35));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    const horizonFogColor = new THREE.Color(0x283a3c);
    this.scene.background = horizonFogColor;
    this.scene.fog = new THREE.FogExp2(0x283a3c, 0.0092);

    const framing = this.getTargetCameraFraming(aspect);
    this.camera = new THREE.PerspectiveCamera(framing.fov, aspect, 0.2, 260);
    this.camera.position.set(0, framing.y, framing.z);
    this.camera.lookAt(0, framing.lookY, framing.lookZ);

    // Studio environment reflections via RoomEnvironment
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // Natural golden-hour tropical lighting rig (single shadow caster for mobile 60 FPS)
    const hemi = new THREE.HemisphereLight(0x8ec4db, 0x2a3322, 0.95);
    this.scene.add(hemi);

    const sunKey = new THREE.DirectionalLight(0xffe1b0, 2.1);
    sunKey.position.set(16, 28, 12);
    sunKey.castShadow = !this.isSoftwareGl;
    const shadowRes = isCompact ? 512 : 1024;
    sunKey.shadow.mapSize.set(shadowRes, shadowRes);
    sunKey.shadow.camera.near = 2;
    sunKey.shadow.camera.far = 70;
    sunKey.shadow.camera.left = -16;
    sunKey.shadow.camera.right = 16;
    sunKey.shadow.camera.top = 22;
    sunKey.shadow.camera.bottom = -16;
    sunKey.shadow.bias = -0.0006;
    sunKey.shadow.normalBias = 0.02;
    this.scene.add(sunKey);

    const rimLight = new THREE.DirectionalLight(0x5ca4c4, 0.65);
    rimLight.position.set(-14, 12, -24);
    this.scene.add(rimLight);

    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.textures = createProceduralTextures(maxAniso);
  }

  private getTargetCameraFraming(aspect: number): {
    fov: number;
    y: number;
    z: number;
    lookY: number;
    lookZ: number;
  } {
    if (aspect < 0.9) {
      return { fov: 68, y: 3.85, z: 7.3, lookY: 1.32, lookZ: -13.5 };
    }
    return { fov: 60, y: 4.25, z: 8.0, lookY: 1.45, lookZ: -12.0 };
  }

  private buildWorld(): void {
    // 0. Misty Golden-Hour Tropical Sky Dome (deep slate dusk -> emerald mist -> warm sunlit horizon)
    const skyGeo = new THREE.SphereGeometry(210, 24, 16);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        topColor: { value: new THREE.Color(0x132636) },
        midColor: { value: new THREE.Color(0x284044) },
        horizonColor: { value: new THREE.Color(0x7c6850) },
      },
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 midColor;
        uniform vec3 horizonColor;
        varying vec3 vWorldPos;
        void main() {
          float h = normalize(vWorldPos).y;
          vec3 col = mix(horizonColor, midColor, smoothstep(-0.04, 0.22, h));
          col = mix(col, topColor, smoothstep(0.22, 0.72, h));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    this.disposableGeos.push(skyGeo);
    this.disposableMats.push(skyMat);
    const skyDome = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(skyDome);

    // 1. Articulated Runner & Pursuing Guardian
    this.runner = createRunnerModel(this.textures);
    this.scene.add(this.runner.root);

    this.guardian = createGuardianModel(this.textures);
    this.scene.add(this.guardian.root);

    // 2. Distant Sun-Temple Complex Horizon Landmark & Intro Surya Altar
    this.skyTemple = this.createHorizonTemple();
    this.scene.add(this.skyTemple);

    this.createIntroPedestal();
    this.scene.add(this.introPedestal);

    // 3. Track Segments Pool (Solid + Broken Chasm variants)
    for (let i = 0; i < SEGMENT_COUNT; i++) {
      const seg = this.createTrackSegment(i);
      this.segments.push(seg);
      this.scene.add(seg.group);
    }

    // 4. Instanced Deep Rainforest Slope Trees (48 trees -> only 2 draw calls!)
    const treeCount = 48;
    const trunkGeo = new THREE.CylinderGeometry(0.24, 0.48, 8.6, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x33251a, roughness: 0.94 });
    const canopyGeo = new THREE.DodecahedronGeometry(3.1, 1);
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0x224426, roughness: 0.88 });
    this.disposableGeos.push(trunkGeo, canopyGeo);
    this.disposableMats.push(trunkMat, canopyMat);

    this.trunkInstanced = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
    this.foliageInstanced = new THREE.InstancedMesh(canopyGeo, canopyMat, treeCount);
    this.trunkInstanced.frustumCulled = false;
    this.foliageInstanced.frustumCulled = false;

    const paletteTint = new THREE.Color();
    for (let i = 0; i < treeCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const x = side * (11.5 + Math.random() * 14);
      const y = -6.2 + Math.random() * 4.4;
      const z = RECYCLE_Z - (i / treeCount) * (SEGMENT_COUNT * SEGMENT_LENGTH);
      const scale = 0.85 + Math.random() * 0.65;
      const rot = Math.random() * Math.PI * 2;
      this.treeData.push({ x, y, z, scale, rot });

      paletteTint.setHSL(0.31 + (Math.random() - 0.5) * 0.05, 0.36, 0.16 + Math.random() * 0.1);
      this.foliageInstanced.setColorAt(i, paletteTint);
    }
    if (this.foliageInstanced.instanceColor) {
      this.foliageInstanced.instanceColor.needsUpdate = true;
    }
    this.updateTreeMatrices();
    this.scene.add(this.trunkInstanced, this.foliageInstanced);

    // 4a. Grounded high-detail .glb coconut palms & stone temple statues along bridge ledges
    void this.initGlbEnvironmentProps();

    // 4b. Atmospheric Golden Sun-Motes drifting in the Temple Corridor
    const moteCount = 120;
    const motePos = new Float32Array(moteCount * 3);
    for (let i = 0; i < moteCount; i++) {
      motePos[i * 3] = (Math.random() - 0.5) * 14;
      motePos[i * 3 + 1] = 0.5 + Math.random() * 7.5;
      motePos[i * 3 + 2] = -Math.random() * 75 + 10;
    }
    const moteGeo = new THREE.BufferGeometry();
    moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
    const moteMat = new THREE.PointsMaterial({
      size: 0.22,
      map: this.textures.sparkleMap,
      color: 0xffd785,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.disposableGeos.push(moteGeo);
    this.disposableMats.push(moteMat);
    this.motePoints = new THREE.Points(moteGeo, moteMat);
    this.scene.add(this.motePoints);

    // 5. Obstacle Templates & Pool (includes sculpted Chakra Trap!)
    const kinds: ObstacleKind[] = ['low_barrier', 'high_arch', 'monolith', 'boulder', 'chakra_trap'];
    for (const kind of kinds) {
      this.obstacleTemplates[kind] = createObstacleModel(kind, this.textures);
    }

    for (let i = 0; i < 25; i++) {
      const kind = kinds[i % kinds.length];
      const mesh = this.obstacleTemplates[kind].clone();
      mesh.visible = false;
      this.scene.add(mesh);
      this.obstacles.push({
        active: false,
        clearedScored: false,
        kind,
        lane: 1,
        x: 0,
        z: 999,
        extraSpeed: 0,
        mesh,
        spinWheel: mesh.getObjectByName('spin_wheel') ?? null,
      });
    }

    // 6. Coin Pool (85 sculpted medallions)
    const coinTemplate = createCoinModel();
    for (let i = 0; i < 85; i++) {
      const mesh = coinTemplate.clone();
      mesh.visible = false;
      this.scene.add(mesh);
      this.coins.push({
        active: false,
        lane: 1,
        x: 0,
        y: 1.0,
        z: 999,
        phaseOffset: i * 0.35,
        mesh,
      });
    }

    // 7. Powerup Pool (cached templates for zero runtime allocation)
    const pKinds: PowerupKind[] = ['shield', 'magnet', 'boost'];
    for (const pk of pKinds) {
      this.powerupTemplates[pk] = createPowerupModel(pk);
    }
    for (let i = 0; i < 6; i++) {
      const kind = pKinds[i % pKinds.length];
      const mesh = this.powerupTemplates[kind].clone();
      mesh.visible = false;
      this.scene.add(mesh);
      this.powerups.push({
        active: false,
        kind,
        lane: 1,
        x: 0,
        y: 1.2,
        z: 999,
        mesh,
      });
    }

    // 8. Particle Burst Pool (95 pooled particles)
    const pGeo = new THREE.OctahedronGeometry(0.11, 0);
    this.disposableGeos.push(pGeo);
    for (let i = 0; i < 95; i++) {
      const pMat = new THREE.MeshBasicMaterial({ color: 0xffd15c, transparent: true, opacity: 1 });
      this.disposableMats.push(pMat);
      const mesh = new THREE.Mesh(pGeo, pMat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.particles.push({
        active: false,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 0.4,
        scale: 1,
        color: new THREE.Color(0xffd15c),
        mesh,
      });
    }

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }
  }

  private async initGlbEnvironmentProps(): Promise<void> {
    const props = await loadTempleEnvironmentProps();
    if (this.disposed) {
      props.dispose();
      return;
    }
    this.envProps = props;
    const span = SEGMENT_COUNT * SEGMENT_LENGTH;

    // Keep instanced background forest active (only 2 draw calls) for deep jungle density,
    // and layer a lean set of 14 crisp GLB palm trees + 6 grounded statues on stone plinths.
    if (props.palms.length > 0) {
      const palmCount = 14;
      for (let i = 0; i < palmCount; i++) {
        const template = props.palms[i % props.palms.length];
        const clone = template.clone();
        const side = i % 2 === 0 ? -1 : 1;
        const x = side * (7.9 + (i % 3) * 1.75);
        const y = -1.75 - (i % 3) * 0.55;
        const z = RECYCLE_Z - (i / palmCount) * span;
        const sc = 0.92 + (i % 3) * 0.16;
        clone.position.set(x, y, z);
        clone.scale.setScalar(sc);
        clone.rotation.y = (i * 1.47) % (Math.PI * 2);
        this.scene.add(clone);
        this.scrollingEnvProps.push({ mesh: clone, z });
      }
    }

    if (props.statue) {
      const plinthGeo = new THREE.BoxGeometry(1.7, 0.95, 1.7);
      const capGeo = new THREE.BoxGeometry(1.9, 0.22, 1.9);
      const plinthMat = new THREE.MeshStandardMaterial({
        map: this.textures.stonePillarMap,
        roughness: 0.9,
        metalness: 0.05,
      });
      this.disposableGeos.push(plinthGeo, capGeo);
      this.disposableMats.push(plinthMat);

      const statueCount = 6;
      for (let i = 0; i < statueCount; i++) {
        const wrapper = new THREE.Group();
        const plinth = new THREE.Mesh(plinthGeo, plinthMat);
        plinth.position.y = 0.475;
        plinth.receiveShadow = true;
        const cap = new THREE.Mesh(capGeo, plinthMat);
        cap.position.y = 1.05;
        cap.receiveShadow = true;

        const statueMesh = props.statue.clone();
        statueMesh.position.set(0, 1.14, 0);
        statueMesh.rotation.y = i % 2 === 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
        wrapper.add(plinth, cap, statueMesh);

        const side = i % 2 === 0 ? -1 : 1;
        const x = side * 5.05;
        const z = RECYCLE_Z - 10 - (i / statueCount) * span;
        wrapper.position.set(x, -0.1, z);
        this.scene.add(wrapper);
        this.scrollingEnvProps.push({ mesh: wrapper, z });
      }
    }
  }

  private createHorizonTemple(): THREE.Group {
    const g = new THREE.Group();
    const stoneMat = new THREE.MeshStandardMaterial({
      map: this.textures.stonePillarMap,
      color: 0x3b352d,
      roughness: 0.92,
      metalness: 0.04,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      map: this.textures.ornateGoldMap,
      color: 0x9c6e2c,
      emissive: 0x452200,
      emissiveIntensity: 0.28,
      roughness: 0.45,
      metalness: 0.55,
    });
    this.disposableMats.push(stoneMat, trimMat);

    // Central Grand Stepped Shikhara Sanctuary silhouetted in canyon mist
    const tiers = [
      { w: 54, h: 12, d: 54, y: 6 },
      { w: 40, h: 10, d: 40, y: 17 },
      { w: 28, h: 9, d: 28, y: 26.5 },
      { w: 18, h: 8, d: 18, y: 35 },
      { w: 10, h: 7, d: 10, y: 42.5 },
    ];
    for (let idx = 0; idx < tiers.length; idx++) {
      const t = tiers[idx];
      const geo = new THREE.BoxGeometry(t.w, t.h, t.d);
      this.disposableGeos.push(geo);
      const mesh = new THREE.Mesh(geo, stoneMat);
      mesh.position.y = t.y;
      g.add(mesh);

      if (idx === 2 || idx === 4) {
        const corniceGeo = new THREE.BoxGeometry(t.w + 1.4, 0.9, t.d + 1.4);
        this.disposableGeos.push(corniceGeo);
        const cornice = new THREE.Mesh(corniceGeo, trimMat);
        cornice.position.y = t.y + t.h * 0.5;
        g.add(cornice);
      }
    }

    // Twin Flanking Stepped Temple Gopuram Towers
    for (const sx of [-40, 40]) {
      const baseGeo = new THREE.BoxGeometry(18, 20, 18);
      const midGeo = new THREE.BoxGeometry(13, 10, 13);
      const capGeo = new THREE.BoxGeometry(7, 7, 7);
      this.disposableGeos.push(baseGeo, midGeo, capGeo);
      const base = new THREE.Mesh(baseGeo, stoneMat);
      base.position.set(sx, 10, 8);
      const mid = new THREE.Mesh(midGeo, stoneMat);
      mid.position.set(sx, 25, 8);
      const cap = new THREE.Mesh(capGeo, trimMat);
      cap.position.set(sx, 33.5, 8);
      g.add(base, mid, cap);
    }

    // Subtle Brass Kalasha Spire crowning the sanctuary (no giant glowing diamond)
    const spireGeo = new THREE.CylinderGeometry(0.4, 2.2, 8, 8);
    this.disposableGeos.push(spireGeo);
    const spire = new THREE.Mesh(spireGeo, trimMat);
    spire.position.y = 49.5;
    g.add(spire);

    g.position.set(0, -10, -172);
    return g;
  }

  private createIntroPedestal(): void {
    const g = new THREE.Group();
    const altarMat = new THREE.MeshStandardMaterial({
      map: this.textures.stonePillarMap,
      color: 0x5c4f41,
      roughness: 0.78,
      metalness: 0.12,
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xffd25a,
      emissive: 0xff9200,
      emissiveIntensity: 2.2,
      roughness: 0.18,
      metalness: 0.85,
    });
    this.disposableMats.push(altarMat, goldMat);

    const baseGeo = new THREE.CylinderGeometry(0.68, 0.86, 0.95, 8);
    const capGeo = new THREE.CylinderGeometry(0.76, 0.62, 0.22, 8);
    const idolGeo = new THREE.OctahedronGeometry(0.32, 0);
    const haloGeo = new THREE.TorusGeometry(0.45, 0.05, 8, 24);
    this.disposableGeos.push(baseGeo, capGeo, idolGeo, haloGeo);

    const base = new THREE.Mesh(baseGeo, altarMat);
    base.position.y = 0.475;
    base.castShadow = true;
    const cap = new THREE.Mesh(capGeo, altarMat);
    cap.position.y = 1.02;

    this.introRelicOrb = new THREE.Group();
    this.introRelicOrb.position.set(0, 1.55, 0);
    const idol = new THREE.Mesh(idolGeo, goldMat);
    const halo = new THREE.Mesh(haloGeo, goldMat);
    this.introRelicOrb.add(idol, halo);

    g.add(base, cap, this.introRelicOrb);
    g.position.set(0, 0, -5.5);
    g.visible = false;
    this.introPedestal = g;
  }

  private createCliffWallGeometry(): THREE.BufferGeometry {
    const geo = new THREE.BoxGeometry(9.5, 16.5, SEGMENT_LENGTH + 0.6, 4, 8, 5);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const strata = Math.sin(y * 0.95) * 0.45;
      const crag = Math.sin(y * 0.55 + z * 0.42) * 0.75 + Math.cos(x * 0.8 + z * 0.65) * 0.45;
      pos.setX(i, x + strata + crag);
      pos.setY(i, y + Math.sin(x * 0.4 + z * 0.5) * 0.35);
    }
    geo.computeVertexNormals();
    return geo;
  }

  private createTrackSegment(index: number): TrackSegment {
    const group = new THREE.Group();
    const deckGroup = new THREE.Group();
    const gapGroup = new THREE.Group();
    group.add(deckGroup, gapGroup);

    const roadMat = new THREE.MeshStandardMaterial({
      map: this.textures.flagstoneMap,
      bumpMap: this.textures.flagstoneBump,
      bumpScale: 0.065,
      roughness: 0.86,
      metalness: 0.05,
    });
    const stoneMat = new THREE.MeshStandardMaterial({
      map: this.textures.stonePillarMap,
      roughness: 0.9,
      metalness: 0.04,
    });
    const bronzeMat = new THREE.MeshPhysicalMaterial({
      map: this.textures.ornateGoldMap,
      color: 0x8d6328,
      roughness: 0.36,
      metalness: 0.82,
    });
    const cliffMat = new THREE.MeshStandardMaterial({
      map: this.textures.cliffRockMap,
      roughness: 0.95,
      metalness: 0.02,
    });
    const emberMat = new THREE.MeshStandardMaterial({
      color: 0xff7b24,
      emissive: 0xd93800,
      emissiveIntensity: 1.0,
      roughness: 0.55,
    });
    const flameCardMat = new THREE.MeshBasicMaterial({
      map: this.textures.flameMap,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const warnMat = new THREE.MeshStandardMaterial({
      color: 0xb86d24,
      emissive: 0x6e2700,
      emissiveIntensity: 0.45,
      roughness: 0.45,
    });
    const riverMat = new THREE.MeshStandardMaterial({
      color: 0x102930,
      roughness: 0.22,
      metalness: 0.65,
    });
    this.disposableMats.push(roadMat, stoneMat, bronzeMat, cliffMat, emberMat, flameCardMat, warnMat, riverMat);

    // Solid full deck
    const fullDeckGeo = new THREE.BoxGeometry(TRACK_WIDTH, 1.45, SEGMENT_LENGTH);
    this.disposableGeos.push(fullDeckGeo);
    const fullDeck = new THREE.Mesh(fullDeckGeo, roadMat);
    fullDeck.position.y = -0.725;
    fullDeck.receiveShadow = true;
    deckGroup.add(fullDeck);

    // Gap deck: front slab + back slab leaving a 5.0m chasm in center
    const halfSlabLen = (SEGMENT_LENGTH - 5.0) / 2;
    const halfSlabGeo = new THREE.BoxGeometry(TRACK_WIDTH, 1.45, halfSlabLen);
    const warnStripGeo = new THREE.BoxGeometry(TRACK_WIDTH - 0.5, 0.1, 0.45);
    this.disposableGeos.push(halfSlabGeo, warnStripGeo);

    const frontSlab = new THREE.Mesh(halfSlabGeo, roadMat);
    frontSlab.position.set(0, -0.725, SEGMENT_LENGTH / 2 - halfSlabLen / 2);
    frontSlab.receiveShadow = true;

    const backSlab = new THREE.Mesh(halfSlabGeo, roadMat);
    backSlab.position.set(0, -0.725, -SEGMENT_LENGTH / 2 + halfSlabLen / 2);
    backSlab.receiveShadow = true;

    const warnEdge = new THREE.Mesh(warnStripGeo, warnMat);
    warnEdge.position.set(0, 0.02, 2.72);
    gapGroup.add(frontSlab, backSlab, warnEdge);
    gapGroup.visible = false;

    // Reflective Canyon River Floor far below
    const abyssGeo = new THREE.PlaneGeometry(58, SEGMENT_LENGTH);
    this.disposableGeos.push(abyssGeo);
    const abyss = new THREE.Mesh(abyssGeo, riverMat);
    abyss.rotation.x = -Math.PI / 2;
    abyss.position.y = -12.5;
    group.add(abyss);

    // Carved Side Parapets, Fluted Temple Columns, Soft Ember Braziers & Layered Canyon Cliffs
    const parapetGeo = new THREE.BoxGeometry(0.58, 0.78, SEGMENT_LENGTH);
    const colGeo = new THREE.CylinderGeometry(0.42, 0.52, 6.0, 10);
    const plinthGeo = new THREE.BoxGeometry(1.25, 0.7, 1.25);
    const capitalGeo = new THREE.CylinderGeometry(0.76, 0.45, 0.6, 8);
    const brazierBowlGeo = new THREE.CylinderGeometry(0.4, 0.18, 0.34, 10);
    const emberGeo = new THREE.SphereGeometry(0.22, 8, 6);
    const flameCardGeo = new THREE.PlaneGeometry(0.68, 0.92);
    const cliffWallGeo = this.createCliffWallGeometry();
    this.disposableGeos.push(parapetGeo, colGeo, plinthGeo, capitalGeo, brazierBowlGeo, emberGeo, flameCardGeo, cliffWallGeo);

    const flames: THREE.Mesh[] = [];

    for (const side of [-1, 1]) {
      const parapet = new THREE.Mesh(parapetGeo, stoneMat);
      parapet.position.set(side * (TRACK_WIDTH / 2 + 0.2), 0.26, 0);
      parapet.castShadow = true;
      parapet.receiveShadow = true;
      group.add(parapet);

      // Ornate Fluted Temple Columns + Torana Archway on alternating segments
      if (index % 2 === 0) {
        const plinth = new THREE.Mesh(plinthGeo, stoneMat);
        plinth.position.set(side * (TRACK_WIDTH / 2 + 0.62), 0.35, 0);
        const col = new THREE.Mesh(colGeo, stoneMat);
        col.position.set(side * (TRACK_WIDTH / 2 + 0.62), 3.35, 0);
        col.castShadow = true;
        const cap = new THREE.Mesh(capitalGeo, bronzeMat);
        cap.position.set(side * (TRACK_WIDTH / 2 + 0.62), 6.5, 0);
        group.add(plinth, col, cap);
      }

      // Bronze Fire Brazier + Glowing Ember Coal Bed + Crossed Translucent Flame Cards
      const bx = side * (TRACK_WIDTH / 2 + 0.22);
      const bz = -4.5;
      const bowl = new THREE.Mesh(brazierBowlGeo, bronzeMat);
      bowl.position.set(bx, 0.82, bz);
      const ember = new THREE.Mesh(emberGeo, emberMat);
      ember.scale.set(1.15, 0.52, 1.15);
      ember.position.set(bx, 0.96, bz);
      group.add(bowl, ember);

      const flameA = new THREE.Mesh(flameCardGeo, flameCardMat);
      flameA.position.set(bx, 1.32, bz);
      flameA.rotation.y = Math.PI * 0.25;
      const flameB = new THREE.Mesh(flameCardGeo, flameCardMat);
      flameB.position.set(bx, 1.32, bz);
      flameB.rotation.y = -Math.PI * 0.25;
      group.add(flameA, flameB);
      flames.push(flameA, flameB);

      // Rugged Stratified Canyon Cliff Wall
      const cliff = new THREE.Mesh(cliffWallGeo, cliffMat);
      cliff.position.set(side * 12.6, -7.8, 0);
      if (side < 0) cliff.scale.x = -1;
      cliff.receiveShadow = true;
      group.add(cliff);
    }

    if (index % 2 === 0) {
      const archBeamGeo = new THREE.BoxGeometry(TRACK_WIDTH + 2.8, 0.9, 1.1);
      const archCrownGeo = new THREE.BoxGeometry(4.6, 0.65, 0.9);
      const finialGeo = new THREE.OctahedronGeometry(0.42, 0);
      this.disposableGeos.push(archBeamGeo, archCrownGeo, finialGeo);

      const archBeam = new THREE.Mesh(archBeamGeo, stoneMat);
      archBeam.position.set(0, 7.05, 0);
      archBeam.castShadow = true;
      const archCrown = new THREE.Mesh(archCrownGeo, bronzeMat);
      archCrown.position.set(0, 7.72, 0);
      const finial = new THREE.Mesh(finialGeo, bronzeMat);
      finial.position.set(0, 8.34, 0);
      group.add(archBeam, archCrown, finial);
    }

    return {
      group,
      deckGroup,
      gapGroup,
      z: 0,
      hasGap: false,
      gapStartLocal: -2.4,
      gapEndLocal: 2.4,
      flames,
    };
  }

  private updateTreeMatrices(): void {
    for (let i = 0; i < this.treeData.length; i++) {
      const t = this.treeData[i];
      _vec3.set(t.x, t.y + 3.6 * t.scale, t.z);
      _quat.setFromAxisAngle(_upAxis, t.rot);
      _scale.set(t.scale, t.scale, t.scale);
      _mat4.compose(_vec3, _quat, _scale);
      this.trunkInstanced.setMatrixAt(i, _mat4);

      _vec3.set(t.x, t.y + 7.6 * t.scale, t.z);
      _scale.set(t.scale * 1.2, t.scale * 0.92, t.scale * 1.2);
      _mat4.compose(_vec3, _quat, _scale);
      this.foliageInstanced.setMatrixAt(i, _mat4);
    }
    this.trunkInstanced.instanceMatrix.needsUpdate = true;
    this.foliageInstanced.instanceMatrix.needsUpdate = true;
    this.trunkInstanced.computeBoundingSphere();
    this.foliageInstanced.computeBoundingSphere();
  }

  private bindEvents(): void {
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleWindowBlur);

    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', this.handlePointerDown);
    window.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('pointerup', this.handlePointerUp);
    window.addEventListener('pointercancel', this.handlePointerUp);
  }

  private unbindEvents(): void {
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleWindowBlur);

    const el = this.renderer.domElement;
    el.removeEventListener('pointerdown', this.handlePointerDown);
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerup', this.handlePointerUp);
    window.removeEventListener('pointercancel', this.handlePointerUp);
  }

  private handleResize = (): void => {
    if (this.disposed) return;
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private handleWindowBlur = (): void => {
    this.heldKeys.clear();
    this.pointerActive = false;
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    const code = e.code;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code)) {
      e.preventDefault();
    }

    soundSynth.unlock();

    const isRepeat = this.heldKeys.has(code);
    this.heldKeys.add(code);
    if (isRepeat) return;

    if (this.phase === 'title' || this.phase === 'gameover') {
      if (code === 'Enter' || code === 'Space') {
        this.startNewRun();
      }
      return;
    }

    if (this.phase === 'intro_cutscene' || this.phase === 'outro_cutscene') {
      if (code === 'Space' || code === 'Enter' || code === 'Escape') {
        this.skipCutscene();
      }
      return;
    }

    if (code === 'Escape' || code === 'KeyP') {
      this.togglePause();
      return;
    }

    if (this.phase !== 'playing') return;

    if (code === 'ArrowLeft' || code === 'KeyA') {
      this.queueLaneMove(-1);
    } else if (code === 'ArrowRight' || code === 'KeyD') {
      this.queueLaneMove(1);
    } else if (code === 'ArrowUp' || code === 'KeyW' || code === 'Space') {
      this.jumpBuffer = 0.14;
    } else if (code === 'ArrowDown' || code === 'KeyS') {
      this.slideBuffer = 0.14;
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.heldKeys.delete(e.code);
  };

  private handlePointerDown = (e: PointerEvent): void => {
    soundSynth.unlock();
    if (this.phase === 'intro_cutscene' || this.phase === 'outro_cutscene') {
      this.skipCutscene();
      return;
    }
    if (this.phase !== 'playing') return;
    this.pointerActive = true;
    this.pointerStartX = e.clientX;
    this.pointerStartY = e.clientY;
    this.swipeConsumed = false;
  };

  private handlePointerMove = (e: PointerEvent): void => {
    if (!this.pointerActive || this.swipeConsumed || this.phase !== 'playing') return;
    const dx = e.clientX - this.pointerStartX;
    const dy = e.clientY - this.pointerStartY;
    const threshold = 24;

    if (Math.abs(dx) > threshold || Math.abs(dy) > threshold) {
      this.swipeConsumed = true;
      if (Math.abs(dx) > Math.abs(dy)) {
        this.queueLaneMove(dx < 0 ? -1 : 1);
      } else if (dy < 0) {
        this.jumpBuffer = 0.14;
      } else {
        this.slideBuffer = 0.14;
      }
    }
  };

  private handlePointerUp = (): void => {
    this.pointerActive = false;
    this.swipeConsumed = false;
  };

  private queueLaneMove(dir: -1 | 1): void {
    this.laneBuffer = dir;
    this.laneBufferTimer = 0.14;
  }

  public startNewRun(): void {
    soundSynth.unlock();
    soundSynth.playStart();

    this.distance = 0;
    this.score = 0;
    this.runCoins = 0;
    this.coinCombo = 0;
    this.coinComboTimer = 0;
    this.speed = BASE_SPEED;
    this.deathReason = '';
    this.closeCalls = 0;
    this.calloutText = '';
    this.calloutTimer = 0;
    this.newlyCompletedMission = '';
    this.newlyCompletedTimer = 0;
    this.missionSyncAccum = 0;
    this.runDistSynced = 0;
    this.runCoinsSynced = 0;
    this.runAcrobatics = 0;
    this.runAcrobaticsSynced = 0;
    this.runCloseCallsSynced = 0;
    this.runPowerups = 0;
    this.runPowerupsSynced = 0;

    this.targetLane = 1;
    this.runnerX = 0;
    this.runnerY = 0;
    this.runnerVelY = 0;
    this.isGrounded = true;
    this.coyoteTimer = 0;
    this.slideTimer = 0;
    this.squashY = 1;
    this.squashXZ = 1;

    this.guardianThreat = 0.20;
    this.invulnTimer = 0;
    this.hitstopTimer = 0;
    this.shakeIntensity = 0;
    this.cameraBank = 0;
    this.camera.rotation.z = 0;
    this.hasShield = false;
    this.magnetTimer = 0;
    this.boostTimer = 0;
    this.jumpBuffer = 0;
    this.slideBuffer = 0;
    this.laneBuffer = 0;
    this.laneBufferTimer = 0;

    this.clearEntities();
    this.layoutInitialSegments();

    // Enter Opening Cutscene (4.6s): Snatch Surya Relic -> Awaken Guardian -> Escape Dash
    this.phase = 'intro_cutscene';
    this.cutsceneTime = 0;
    this.cutsceneProgress = 0;
    this.cutsceneLabel = 'Prologue · The Sun Altar';
    this.cutsceneCaption = 'Claim the Golden Surya Seal before the temple wakes.';
    this.introRelicSnatched = false;
    this.introGuardianRoared = false;
    this.introPedestal.visible = true;
    this.introRelicOrb.visible = true;
    this.runner.root.position.set(0, 0, 1.5);
    this.runner.root.rotation.set(0, 0, 0);
    this.runner.bodyPivot.rotation.set(0, 0, 0);
    this.runner.squashRoot.visible = this.heroId !== 'custom_glb';
    if (this.customGlb) {
      this.customGlb.root.visible = true;
      this.customGlb.root.rotation.set(0, 0, 0);
    }
    this.guardian.root.position.set(0, 0, 9.5);
    this.guardian.bodyPivot.rotation.set(0, 0, 0);

    this.emitHud(true);
  }

  private beginActualRun(): void {
    this.phase = 'playing';
    this.cutsceneLabel = '';
    this.cutsceneCaption = '';
    this.cutsceneProgress = 0;
    this.introPedestal.visible = false;
    this.runner.root.position.set(0, 0, 0);
    this.runner.root.rotation.set(0, 0, 0);
    this.runner.bodyPivot.rotation.set(0, 0, 0);
    if (this.customGlb) {
      this.customGlb.root.rotation.set(0, 0, 0);
    }
    const framing = this.getTargetCameraFraming(this.camera.aspect);
    this.camera.fov = framing.fov;
    this.camera.position.set(0, framing.y, framing.z);
    this.camera.lookAt(0, framing.lookY, framing.lookZ);
    this.camera.updateProjectionMatrix();
    this.guardian.root.position.set(0, 0, 12.8);
    this.shakeIntensity = 0.14;

    this.clearEntities();
    this.layoutInitialSegments();
    this.spawnZCursor = -38;
    while (this.spawnZCursor > -135) {
      this.spawnNextPattern();
    }
    this.emitHud(true);
  }

  public skipCutscene(): void {
    if (this.phase === 'intro_cutscene') {
      this.beginActualRun();
    } else if (this.phase === 'outro_cutscene') {
      this.finishOutroToGameOver();
    }
  }

  public claimMission(missionId: string): void {
    const next = claimDailyMissionReward(this.missionsSnapshot, missionId);
    if (next !== this.missionsSnapshot) {
      this.missionsSnapshot = next;
      soundSynth.unlock();
      soundSynth.playMissionComplete();
      this.emitHud(true);
    }
  }

  public togglePause(): void {
    if (this.phase === 'playing') {
      this.phase = 'paused';
      this.emitHud(true);
    } else if (this.phase === 'paused') {
      this.phase = 'playing';
      this.lastTime = performance.now();
      this.emitHud(true);
    }
  }

  public returnToTitle(): void {
    this.phase = 'title';
    this.introPedestal.visible = false;
    this.resetWorldForTitle();
    this.emitHud(true);
  }

  public setHero(nextHero: Exclude<HeroId, 'custom_glb'>): void {
    this.glbLoadSeq += 1;
    this.heroId = nextHero;
    this.customHeroName = '';
    this.customHeroUid = '';
    if (this.customGlb) {
      this.runner.root.remove(this.customGlb.root);
      this.customGlb.dispose();
      this.customGlb = null;
    }

    const oldPos = this.runner.root.position.clone();
    const oldRot = this.runner.root.rotation.clone();
    this.scene.remove(this.runner.root);
    this.runner.root.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (m.isMesh) {
        m.geometry?.dispose();
        if (Array.isArray(m.material)) m.material.forEach((mat) => mat.dispose());
        else m.material?.dispose();
      }
    });

    this.runner = createRunnerModel(this.textures, nextHero);
    this.runner.root.position.copy(oldPos);
    this.runner.root.rotation.copy(oldRot);
    this.scene.add(this.runner.root);
    this.emitHud(true);
  }

  public async loadCustomGlbCharacter(url: string, displayName: string, uid = ''): Promise<void> {
    const seq = ++this.glbLoadSeq;
    const loaded = await loadGltfRunnerCharacter(url);
    if (this.disposed || seq !== this.glbLoadSeq) {
      loaded.dispose();
      return;
    }
    if (this.customGlb) {
      this.runner.root.remove(this.customGlb.root);
      this.customGlb.dispose();
    }
    this.customGlb = loaded;
    this.heroId = 'custom_glb';
    this.customHeroName = displayName;
    this.customHeroUid = uid;
    this.runner.squashRoot.visible = false;
    this.runner.root.add(loaded.root);
    this.emitHud(true);
  }

  private resetWorldForTitle(): void {
    this.distance = 0;
    this.score = 0;
    this.runCoins = 0;
    this.closeCalls = 0;
    this.calloutText = '';
    this.calloutTimer = 0;
    this.targetLane = 1;
    this.runnerX = 0;
    this.runnerY = 0;
    this.runnerVelY = 0;
    this.isGrounded = true;
    this.slideTimer = 0;
    this.guardianThreat = 0.45;
    this.hasShield = false;
    this.magnetTimer = 0;
    this.boostTimer = 0;
    this.camera.rotation.z = 0;
    this.clearEntities();
    this.layoutInitialSegments();
    this.runner.root.position.set(0, 0, 0);
    this.runner.root.rotation.set(0, 0, 0);
    this.runner.squashRoot.scale.set(1, 1, 1);
    this.runner.squashRoot.visible = this.heroId !== 'custom_glb';
    this.runner.bodyPivot.rotation.set(0, 0, 0);
    if (this.customGlb) {
      this.customGlb.root.visible = true;
      this.customGlb.root.scale.set(1, 1, 1);
      this.customGlb.root.rotation.set(0, 0, 0);
    }
  }

  private clearEntities(): void {
    for (const o of this.obstacles) {
      o.active = false;
      o.clearedScored = false;
      o.mesh.visible = false;
    }
    for (const c of this.coins) {
      c.active = false;
      c.mesh.visible = false;
    }
    for (const p of this.powerups) {
      p.active = false;
      p.mesh.visible = false;
    }
    for (const pt of this.particles) {
      pt.active = false;
      pt.mesh.visible = false;
    }
  }

  private layoutInitialSegments(): void {
    for (let i = 0; i < this.segments.length; i++) {
      const seg = this.segments[i];
      seg.z = RECYCLE_Z - SEGMENT_LENGTH * 0.5 - i * SEGMENT_LENGTH;
      seg.hasGap = false;
      seg.deckGroup.visible = true;
      seg.gapGroup.visible = false;
      seg.group.position.z = seg.z;
    }
  }

  private spawnNextPattern(): void {
    const z = this.spawnZCursor;
    const difficulty = Math.min(1, this.distance / 1100);
    const stepSpacing = THREE.MathUtils.lerp(20, 14.5, difficulty);

    if (this.isOverGap(z)) {
      const coinLane = Math.floor(Math.random() * 3);
      for (let k = -2; k <= 2; k++) {
        const arcY = 1.15 + Math.cos((k / 2.2) * (Math.PI / 2)) * 1.65;
        this.spawnCoin(coinLane, z + k * 1.4, arcY);
      }
      this.spawnZCursor -= stepSpacing;
      return;
    }

    const roll = Math.random();
    if (roll < 0.22) {
      const lane = Math.floor(Math.random() * 3);
      this.spawnObstacle('low_barrier', lane, z);
      for (let k = -1; k <= 1; k++) {
        this.spawnCoin(lane, z + k * 1.7, k === 0 ? 2.25 : 1.5);
      }
      this.spawnCoinLine((lane + 1) % 3, z - 2, 3, 1.0);
    } else if (roll < 0.42) {
      const lane = Math.floor(Math.random() * 3);
      this.spawnObstacle('high_arch', lane, z);
      this.spawnCoinLine(lane, z - 3, 4, 0.65);
    } else if (roll < 0.64) {
      const openLane = Math.floor(Math.random() * 3);
      const twoMonoliths = difficulty > 0.22 && Math.random() < 0.58;
      for (let l = 0; l < 3; l++) {
        if (l === openLane) continue;
        if (!twoMonoliths && l !== (openLane + 1) % 3) continue;
        this.spawnObstacle('monolith', l, z);
      }
      this.spawnCoinLine(openLane, z - 3, 4, 1.0);
    } else if (roll < 0.8 && difficulty > 0.08) {
      // Spinning Saw-Chakra Blade Trap (jump or dodge!)
      const lane = Math.floor(Math.random() * 3);
      this.spawnObstacle('chakra_trap', lane, z);
      this.spawnCoin(lane, z, 2.35);
      this.spawnCoinLine((lane + 1) % 3, z - 2, 3, 1.0);
    } else if (roll < 0.91 && difficulty > 0.16) {
      const lane = Math.floor(Math.random() * 3);
      this.spawnObstacle('boulder', lane, z - 10, 7.5 + difficulty * 5.0);
      this.spawnCoinLine((lane + 2) % 3, z - 2, 4, 1.0);
    } else {
      const l1 = Math.floor(Math.random() * 3);
      const l2 = (l1 + 1) % 3;
      this.spawnObstacle('low_barrier', l1, z);
      this.spawnObstacle('monolith', l2, z);
      this.spawnCoin((l1 + 2) % 3, z, 1.0);
    }

    if (Math.random() < 0.12) {
      const pKinds: PowerupKind[] = ['shield', 'magnet', 'boost'];
      const pKind = pKinds[Math.floor(Math.random() * pKinds.length)];
      const pLane = Math.floor(Math.random() * 3);
      this.spawnPowerup(pKind, pLane, z - 6.5);
    }

    this.spawnZCursor -= stepSpacing;
  }

  private spawnObstacle(kind: ObstacleKind, lane: number, z: number, extraSpeed = 0): void {
    const slot = this.obstacles.find((o) => !o.active);
    if (!slot) return;

    if (slot.kind !== kind) {
      this.scene.remove(slot.mesh);
      slot.mesh = this.obstacleTemplates[kind].clone();
      this.scene.add(slot.mesh);
      slot.spinWheel = slot.mesh.getObjectByName('spin_wheel') ?? null;
    }

    slot.active = true;
    slot.clearedScored = false;
    slot.kind = kind;
    slot.lane = lane;
    slot.x = LANE_XS[lane];
    slot.z = z;
    slot.extraSpeed = extraSpeed;
    slot.mesh.position.set(slot.x, 0, z);
    slot.mesh.rotation.set(0, 0, 0);
    slot.mesh.visible = true;
  }

  private spawnCoin(lane: number, z: number, y = 1.0): void {
    const slot = this.coins.find((c) => !c.active);
    if (!slot) return;
    slot.active = true;
    slot.lane = lane;
    slot.x = LANE_XS[lane];
    slot.y = y;
    slot.z = z;
    slot.mesh.position.set(slot.x, y, z);
    slot.mesh.visible = true;
  }

  private spawnCoinLine(lane: number, startZ: number, count: number, y: number): void {
    for (let i = 0; i < count; i++) {
      this.spawnCoin(lane, startZ - i * 1.9, y);
    }
  }

  private spawnPowerup(kind: PowerupKind, lane: number, z: number): void {
    const slot = this.powerups.find((p) => !p.active);
    if (!slot) return;
    if (slot.kind !== kind) {
      this.scene.remove(slot.mesh);
      slot.mesh = this.powerupTemplates[kind].clone();
      this.scene.add(slot.mesh);
    }
    slot.active = true;
    slot.kind = kind;
    slot.lane = lane;
    slot.x = LANE_XS[lane];
    slot.y = 1.25;
    slot.z = z;
    slot.mesh.position.set(slot.x, slot.y, z);
    slot.mesh.visible = true;
  }

  private spawnParticleBurst(x: number, y: number, z: number, colorHex: number, count: number, speedScale = 1): void {
    let spawned = 0;
    for (const p of this.particles) {
      if (p.active) continue;
      p.active = true;
      p.x = x + (Math.random() - 0.5) * 0.35;
      p.y = y + (Math.random() - 0.5) * 0.35;
      p.z = z + (Math.random() - 0.5) * 0.35;
      p.vx = (Math.random() - 0.5) * 6.8 * speedScale;
      p.vy = (1.6 + Math.random() * 5.2) * speedScale;
      p.vz = (Math.random() - 0.5) * 5.0 * speedScale;
      p.maxLife = 0.28 + Math.random() * 0.25;
      p.life = p.maxLife;
      p.scale = 0.75 + Math.random() * 0.85;
      p.color.setHex(colorHex);
      const mat = p.mesh.material as THREE.MeshBasicMaterial;
      mat.color.copy(p.color);
      mat.opacity = 1;
      p.mesh.position.set(p.x, p.y, p.z);
      p.mesh.visible = true;
      spawned++;
      if (spawned >= count) break;
    }
  }

  private triggerCallout(label: string, bonus: number): void {
    this.closeCalls += 1;
    this.score += bonus;
    this.calloutText = `${label} +${bonus}`;
    this.calloutKey += 1;
    this.calloutTimer = 1.15;
    this.emitHud(true);
  }

  private isOverGap(z: number): boolean {
    for (const seg of this.segments) {
      if (!seg.hasGap) continue;
      const localZ = z - seg.z;
      if (localZ > seg.gapStartLocal && localZ < seg.gapEndLocal) {
        return true;
      }
    }
    return false;
  }

  private scheduleNextTick(): void {
    if (this.disposed) return;
    if (this.isSoftwareGl) {
      this.afterDraw(() => this.tick());
    } else {
      this.frameId = requestAnimationFrame(() => this.tick());
    }
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
    if (!sync) {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private tick(): void {
    if (this.disposed) return;
    const now = performance.now();
    const rawDt = Math.max(0.001, (now - this.lastTime) / 1000);
    this.lastTime = now;
    const dt = Math.min(rawDt, 0.05);

    if (this.phase === 'title') {
      this.updateTitleScene(dt);
    } else if (this.phase === 'intro_cutscene') {
      this.updateIntroCutscene(dt);
    } else if (this.phase === 'playing') {
      this.updatePlaying(dt);
    } else if (this.phase === 'outro_cutscene') {
      this.updateOutroCutscene(dt);
    } else if (this.phase === 'gameover') {
      this.gameoverTime += dt;
      this.updateParticles(dt);
      this.updateFlames(dt);
      this.shakeIntensity = THREE.MathUtils.damp(this.shakeIntensity, 0, 7, dt);
      const orbitA = this.gameoverTime * 0.45;
      this.camera.position.x = THREE.MathUtils.damp(
        this.camera.position.x,
        this.runnerX + Math.sin(orbitA) * 4.8,
        4,
        dt,
      );
      this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, Math.cos(orbitA) * 5.2, 4, dt);
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, 3.2, 4, dt);
      this.applyCameraShake();
      this.camera.lookAt(this.runnerX, 0.85, 0);
    }

    this.renderer.render(this.scene, this.camera);
    this.scheduleNextTick();
  }

  private updateIntroCutscene(dt: number): void {
    const TOTAL = 4.6;
    this.cutsceneTime += dt;
    this.cutsceneProgress = Math.min(1, this.cutsceneTime / TOTAL);
    this.updateFlames(dt);
    this.updateMotes(dt, 2.2);
    this.updateParticles(dt);
    this.shakeIntensity = THREE.MathUtils.damp(this.shakeIntensity, 0, 7, dt);

    const t = this.cutsceneTime;
    this.introRelicOrb.rotation.y += dt * 3.4;
    this.introRelicOrb.position.y = 1.55 + Math.sin(t * 4.2) * 0.1;

    if (t < 1.75) {
      // Act 1: Hero dashes toward glowing Surya Seal on the altar
      const p = t / 1.75;
      const heroZ = THREE.MathUtils.lerp(1.5, -4.15, p);
      this.runner.root.position.set(0, 0, heroZ);
      this.runner.root.rotation.y = 0;

      this.stridePhase += dt * 11;
      this.applyCutsceneHeroRun(dt, true);

      this.camera.position.set(
        THREE.MathUtils.lerp(3.8, 2.1, p),
        THREE.MathUtils.lerp(2.2, 1.85, p),
        THREE.MathUtils.lerp(2.8, -1.6, p),
      );
      this.camera.lookAt(0, 1.35, -5.5);
    } else if (t < 3.35) {
      // Act 2: Seal snatched! Guardian awakens behind in fury
      if (!this.introRelicSnatched) {
        this.introRelicSnatched = true;
        this.introRelicOrb.visible = false;
        this.shakeIntensity = 0.28;
        this.spawnParticleBurst(0, 1.55, -5.5, 0xffd747, 24, 1.6);
        soundSynth.playPowerup('boost');
      }
      if (t > 2.05 && !this.introGuardianRoared) {
        this.introGuardianRoared = true;
        this.cutsceneLabel = 'Awakening · Stone Guardian';
        this.cutsceneCaption = 'The Sun Guardian awakens — outrun its ancient wrath!';
        this.shakeIntensity = 0.34;
        soundSynth.playCutsceneAwaken();
        this.emitHud(true);
      }

      const p = (t - 1.75) / 1.6;
      this.runner.root.position.set(0, 0, -4.15);
      this.runner.root.rotation.y = THREE.MathUtils.damp(this.runner.root.rotation.y, Math.PI * 0.72, 9, dt);
      this.applyCutsceneHeroRun(dt, false);

      const gZ = THREE.MathUtils.lerp(8.5, 2.8, p);
      this.guardian.root.position.set(0, 0, gZ);
      this.guardian.bodyPivot.position.y = 1.25 + Math.abs(Math.sin(t * 6.5)) * 0.16;
      this.guardian.leftArmPivot.rotation.x = -1.35 + Math.sin(t * 7) * 0.28;
      this.guardian.rightArmPivot.rotation.x = -1.35 - Math.sin(t * 7) * 0.28;
      this.guardian.crownRing.rotation.z += dt * 4.5;

      this.camera.position.set(
        THREE.MathUtils.lerp(-2.4, -3.1, p),
        THREE.MathUtils.lerp(1.6, 2.6, p),
        THREE.MathUtils.lerp(0.4, -1.0, p),
      );
      this.camera.lookAt(0, 1.85, gZ);
    } else {
      // Act 3: Hero whips forward and launches into the chase rig!
      if (this.cutsceneLabel !== 'Escape · Sprint') {
        this.cutsceneLabel = 'Escape · Temple Bridge';
        this.cutsceneCaption = 'Run! Dodge traps, vault chasms, and survive the ruins.';
        this.emitHud(true);
      }
      const p = Math.min(1, (t - 3.35) / 1.25);
      const ease = p * p * (3 - 2 * p);
      this.runner.root.rotation.y = THREE.MathUtils.damp(this.runner.root.rotation.y, 0, 12, dt);
      this.runner.root.position.set(0, 0, THREE.MathUtils.lerp(-4.15, 0, ease));
      this.stridePhase += dt * 15;
      this.applyCutsceneHeroRun(dt, true);

      const framing = this.getTargetCameraFraming(this.camera.aspect);
      this.guardian.root.position.set(0, 0, THREE.MathUtils.lerp(2.8, 12.8, ease));
      this.guardian.crownRing.rotation.z += dt * 2.4;

      this.camera.position.set(
        THREE.MathUtils.lerp(-3.1, 0, ease),
        THREE.MathUtils.lerp(2.6, framing.y, ease),
        THREE.MathUtils.lerp(-1.0, framing.z, ease),
      );
      this.camera.fov = THREE.MathUtils.lerp(68, framing.fov, ease);
      this.camera.updateProjectionMatrix();
      this.camera.lookAt(0, framing.lookY, THREE.MathUtils.lerp(0, framing.lookZ, ease));
    }

    this.applyCameraShake();

    if (this.cutsceneTime >= TOTAL) {
      this.beginActualRun();
      return;
    }

    this.hudEmitAccum += dt;
    if (this.hudEmitAccum >= 0.08) {
      this.hudEmitAccum = 0;
      this.emitHud(false);
    }
  }

  private applyCutsceneHeroRun(dt: number, running: boolean): void {
    if (this.customGlb && this.heroId === 'custom_glb') {
      this.runner.squashRoot.visible = false;
      setGltfCharacterState(this.customGlb, running ? 'run' : 'idle');
      if (running && !this.customGlb.hasRunClip) {
        this.customGlb.root.position.y = Math.abs(Math.cos(this.stridePhase)) * 0.1;
        this.customGlb.root.rotation.x = THREE.MathUtils.damp(this.customGlb.root.rotation.x, 0.22, 12, dt);
      } else {
        this.customGlb.root.position.y = 0;
        this.customGlb.root.rotation.x = THREE.MathUtils.damp(this.customGlb.root.rotation.x, 0, 12, dt);
      }
      this.customGlb.mixer?.update(dt);
      return;
    }

    this.runner.squashRoot.visible = true;
    if (running) {
      const swing = Math.sin(this.stridePhase);
      this.runner.bodyPivot.position.y = 0.96 + Math.abs(Math.cos(this.stridePhase)) * 0.09;
      this.runner.bodyPivot.rotation.x = THREE.MathUtils.damp(this.runner.bodyPivot.rotation.x, 0.22, 14, dt);
      this.runner.leftLegPivot.rotation.x = swing * 0.95;
      this.runner.leftKneePivot.rotation.x = -Math.max(0.1, -swing * 1.15);
      this.runner.rightLegPivot.rotation.x = -swing * 0.95;
      this.runner.rightKneePivot.rotation.x = -Math.max(0.1, swing * 1.15);
      this.runner.leftArmPivot.rotation.x = -swing * 0.85;
      this.runner.leftElbowPivot.rotation.x = -0.85;
      this.runner.rightArmPivot.rotation.x = swing * 0.85;
      this.runner.rightElbowPivot.rotation.x = -0.85;
    } else {
      this.runner.bodyPivot.position.y = 0.96 + Math.sin(this.cutsceneTime * 4) * 0.02;
      this.runner.bodyPivot.rotation.x = THREE.MathUtils.damp(this.runner.bodyPivot.rotation.x, -0.05, 10, dt);
      this.runner.leftLegPivot.rotation.x = 0.2;
      this.runner.rightLegPivot.rotation.x = -0.2;
      this.runner.leftKneePivot.rotation.x = -0.15;
      this.runner.rightKneePivot.rotation.x = -0.15;
      this.runner.leftArmPivot.rotation.x = -0.5;
      this.runner.rightArmPivot.rotation.x = 0.35;
    }
    this.runner.scarfSeg1.rotation.x = 0.45 + Math.sin(this.stridePhase * 1.3) * 0.18;
    this.runner.scarfSeg2.rotation.x = 0.2 + Math.sin(this.stridePhase * 1.3 - 0.8) * 0.22;
    this.runner.scarfSeg3.rotation.x = 0.15 + Math.sin(this.stridePhase * 1.3 - 1.6) * 0.25;
  }

  private updateOutroCutscene(dt: number): void {
    const TOTAL = 2.7;
    this.cutsceneTime += dt;
    this.cutsceneProgress = Math.min(1, this.cutsceneTime / TOTAL);
    this.updateParticles(dt * 0.45);
    this.updateFlames(dt * 0.45);
    this.shakeIntensity = THREE.MathUtils.damp(this.shakeIntensity, 0, 5, dt);

    const t = this.cutsceneTime;
    const p = Math.min(1, t / TOTAL);

    if (this.outroFellInAbyss) {
      this.runnerY -= dt * 7.5;
      this.runner.root.position.set(this.runnerX, this.runnerY, 0);
      this.runner.root.rotation.x += dt * 3.2;
      this.guardian.root.position.set(this.runnerX * 0.8, 0, THREE.MathUtils.damp(this.guardian.root.position.z, 2.9, 5, dt));
      this.guardian.leftArmPivot.rotation.x = -1.6;
      this.guardian.rightArmPivot.rotation.x = -1.6;
      this.guardian.crownRing.rotation.z += dt * 3.2;

      this.camera.position.set(
        this.runnerX + THREE.MathUtils.lerp(2.2, 3.6, p),
        THREE.MathUtils.lerp(3.2, 4.4, p),
        THREE.MathUtils.lerp(4.6, 6.2, p),
      );
      this.camera.lookAt(this.runnerX, Math.max(-4.5, this.runnerY + 0.5), -0.5);
    } else {
      // Guardian looms forward and slams the temple floor over the fallen hero
      this.guardian.root.position.x = THREE.MathUtils.damp(this.guardian.root.position.x, this.runnerX, 6, dt);
      this.guardian.root.position.z = THREE.MathUtils.damp(this.guardian.root.position.z, 1.95, 5, dt);
      this.guardian.crownRing.rotation.z += dt * 3.8;

      if (t < 1.05) {
        const lift = Math.min(1, t / 1.05);
        this.guardian.leftArmPivot.rotation.x = THREE.MathUtils.lerp(-0.4, -2.55, lift);
        this.guardian.rightArmPivot.rotation.x = THREE.MathUtils.lerp(-0.4, -2.55, lift);
        this.guardian.bodyPivot.position.y = 1.25 + lift * 0.25;
      } else {
        if (!this.outroGuardianSlammed) {
          this.outroGuardianSlammed = true;
          this.shakeIntensity = 0.52;
          this.spawnParticleBurst(this.runnerX, 0.35, 1.3, 0xff8c2b, 28, 1.8);
          soundSynth.playOutroSlam();
        }
        this.guardian.leftArmPivot.rotation.x = THREE.MathUtils.damp(this.guardian.leftArmPivot.rotation.x, -0.35, 18, dt);
        this.guardian.rightArmPivot.rotation.x = THREE.MathUtils.damp(this.guardian.rightArmPivot.rotation.x, -0.35, 18, dt);
        this.guardian.bodyPivot.position.y = THREE.MathUtils.damp(this.guardian.bodyPivot.position.y, 1.08, 16, dt);
      }

      const angle = p * 0.95;
      this.camera.position.set(
        this.runnerX + Math.sin(angle) * 5.2,
        THREE.MathUtils.lerp(2.1, 3.6, p),
        Math.cos(angle) * 5.4,
      );
      this.camera.lookAt(this.runnerX, 1.05, 0.6);
    }

    this.applyCameraShake();

    if (this.cutsceneTime >= TOTAL) {
      this.finishOutroToGameOver();
      return;
    }

    this.hudEmitAccum += dt;
    if (this.hudEmitAccum >= 0.08) {
      this.hudEmitAccum = 0;
      this.emitHud(false);
    }
  }

  private finishOutroToGameOver(): void {
    this.phase = 'gameover';
    this.gameoverTime = 0;
    this.cutsceneLabel = '';
    this.cutsceneCaption = '';
    this.cutsceneProgress = 0;
    this.emitHud(true);
  }

  private updateTitleScene(dt: number): void {
    this.titleTime += dt;
    this.updateFlames(dt);
    this.updateMotes(dt, 1.5);

    // Dramatic hero showcase sweep around the explorer (front 3/4 view so character armor & details shine)
    const panAngle = Math.sin(this.titleTime * 0.4) * 0.45;
    this.camera.position.set(
      Math.sin(panAngle) * 4.2,
      2.15 + Math.sin(this.titleTime * 0.5) * 0.16,
      4.4 + Math.cos(panAngle) * 0.9,
    );
    this.camera.rotation.z = 0;
    this.camera.lookAt(0, 1.18, -0.4);
    this.runner.root.rotation.y = THREE.MathUtils.damp(this.runner.root.rotation.y, Math.PI * 0.88, 8, dt);

    if (this.customGlb && this.heroId === 'custom_glb') {
      this.runner.squashRoot.visible = false;
      setGltfCharacterState(this.customGlb, 'idle');
      this.customGlb.mixer?.update(dt);
    } else {
      this.runner.squashRoot.visible = true;
      // Heroic breathing idle pose
      this.runner.bodyPivot.position.y = 0.96 + Math.sin(this.titleTime * 2.4) * 0.025;
      this.runner.leftArmPivot.rotation.x = 0.12 + Math.sin(this.titleTime * 2.4) * 0.05;
      this.runner.rightArmPivot.rotation.x = -0.12 - Math.sin(this.titleTime * 2.4) * 0.05;
      this.runner.leftElbowPivot.rotation.x = -0.45;
      this.runner.rightElbowPivot.rotation.x = -0.45;
      this.runner.leftLegPivot.rotation.x = 0;
      this.runner.rightLegPivot.rotation.x = 0;
      this.runner.leftKneePivot.rotation.x = 0;
      this.runner.rightKneePivot.rotation.x = 0;
      this.runner.scarfSeg1.rotation.x = 0.24 + Math.sin(this.titleTime * 4.2) * 0.1;
      this.runner.scarfSeg2.rotation.x = Math.sin(this.titleTime * 4.2 - 0.8) * 0.16;
      this.runner.scarfSeg3.rotation.x = Math.sin(this.titleTime * 4.2 - 1.6) * 0.2;
    }

    this.guardian.root.position.set(0, 0, 7.2);
    this.guardian.bodyPivot.position.y = 1.25 + Math.sin(this.titleTime * 2.0) * 0.04;
    this.guardian.crownRing.rotation.z += dt * 1.2;
  }

  private updatePlaying(dt: number): void {
    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      this.updateParticles(dt);
      this.applyCameraShake();
      return;
    }

    if (this.invulnTimer > 0) this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    if (this.magnetTimer > 0) this.magnetTimer = Math.max(0, this.magnetTimer - dt);
    if (this.boostTimer > 0) this.boostTimer = Math.max(0, this.boostTimer - dt);
    if (this.calloutTimer > 0) {
      this.calloutTimer -= dt;
      if (this.calloutTimer <= 0) this.calloutText = '';
    }
    if (this.coinComboTimer > 0) {
      this.coinComboTimer -= dt;
      if (this.coinComboTimer <= 0) this.coinCombo = 0;
    }

    const targetBaseSpeed = Math.min(MAX_SPEED, BASE_SPEED + this.distance * 0.012);
    const targetSpeed = this.boostTimer > 0 ? targetBaseSpeed * 1.54 : targetBaseSpeed;
    this.speed = THREE.MathUtils.damp(this.speed, targetSpeed, 6, dt);

    const worldStep = this.speed * dt;
    this.distance += worldStep;
    const multiplier = 1 + Math.floor(this.distance / 250);
    this.score += worldStep * 2.2 * multiplier;

    this.guardianThreat = Math.max(0.18, this.guardianThreat - dt * 0.055);

    if (this.jumpBuffer > 0) this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    if (this.slideBuffer > 0) this.slideBuffer = Math.max(0, this.slideBuffer - dt);
    if (this.laneBufferTimer > 0) {
      this.laneBufferTimer -= dt;
      if (this.laneBufferTimer <= 0) this.laneBuffer = 0;
    }

    if (this.laneBuffer !== 0) {
      const nextLane = THREE.MathUtils.clamp(this.targetLane + this.laneBuffer, 0, 2);
      if (nextLane !== this.targetLane) {
        this.targetLane = nextLane;
        soundSynth.playSwipe();
      }
      this.laneBuffer = 0;
      this.laneBufferTimer = 0;
    }

    const overGap = this.isOverGap(0);
    if (overGap && this.runnerY <= 0.02) {
      this.isGrounded = false;
    } else if (!overGap && this.runnerY <= 0.02 && this.runnerVelY <= 0) {
      if (!this.isGrounded && this.runnerVelY < -4) {
        soundSynth.playLand();
        this.squashY = 0.78;
        this.squashXZ = 1.22;
        this.spawnParticleBurst(this.runnerX, 0.1, 0, 0xcab38b, 6, 0.55);
      }
      this.runnerY = 0;
      this.runnerVelY = 0;
      this.isGrounded = true;
      this.coyoteTimer = 0.11;
    }

    if (!this.isGrounded && this.coyoteTimer > 0) {
      this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
    }

    if (this.newlyCompletedTimer > 0) {
      this.newlyCompletedTimer -= dt;
      if (this.newlyCompletedTimer <= 0) this.newlyCompletedMission = '';
    }

    this.missionSyncAccum += dt;
    if (this.missionSyncAccum >= 0.4) {
      this.missionSyncAccum = 0;
      this.syncDailyMissions(false);
    }

    if (this.jumpBuffer > 0 && (this.isGrounded || this.coyoteTimer > 0)) {
      this.runnerVelY = JUMP_VELOCITY;
      this.isGrounded = false;
      this.coyoteTimer = 0;
      this.slideTimer = 0;
      this.jumpBuffer = 0;
      this.runAcrobatics += 1;
      this.squashY = 1.26;
      this.squashXZ = 0.82;
      soundSynth.playJump();
      this.spawnParticleBurst(this.runnerX, 0.15, 0, 0xd8c39b, 7, 0.65);
    }

    if (this.slideBuffer > 0) {
      this.slideBuffer = 0;
      this.runAcrobatics += 1;
      if (this.isGrounded) {
        this.slideTimer = SLIDE_DURATION;
        this.squashY = 0.72;
        this.squashXZ = 1.2;
        soundSynth.playSlide();
      } else {
        this.runnerVelY = Math.min(this.runnerVelY, FAST_FALL_VEL);
        this.slideTimer = SLIDE_DURATION * 0.85;
        soundSynth.playSlide();
      }
    }

    if (this.slideTimer > 0) {
      this.slideTimer = Math.max(0, this.slideTimer - dt);
    }

    if (!this.isGrounded) {
      this.runnerVelY += GRAVITY * dt;
      this.runnerY += this.runnerVelY * dt;
    }

    if (this.runnerY < -4.2) {
      this.triggerCrash('Fell into the Ancient Abyss');
      return;
    }

    const targetX = LANE_XS[this.targetLane];
    const prevX = this.runnerX;
    this.runnerX = THREE.MathUtils.damp(this.runnerX, targetX, 16, dt);
    const lateralVel = (this.runnerX - prevX) / dt;

    this.squashY = THREE.MathUtils.damp(this.squashY, 1, 12, dt);
    this.squashXZ = THREE.MathUtils.damp(this.squashXZ, 1, 12, dt);

    this.animateRunner(dt, lateralVel, overGap);
    this.scrollTrack(worldStep);
    this.scrollTrees(worldStep);
    this.updateFlames(dt);
    this.updateMotes(dt, worldStep);

    this.spawnZCursor += worldStep;
    while (this.spawnZCursor > -135) {
      this.spawnNextPattern();
    }

    this.updateObstacles(dt, worldStep);
    if (this.phase !== 'playing') return;
    this.updateCoins(dt, worldStep);
    this.updatePowerups(dt, worldStep);
    this.updateParticles(dt);

    this.animateGuardian(dt);

    const framing = this.getTargetCameraFraming(this.camera.aspect);
    const targetCamX = this.runnerX * 0.54;
    const targetCamY = framing.y + Math.max(0, this.runnerY * 0.45);
    this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, targetCamX, 9, dt);
    this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, targetCamY, 8, dt);
    this.camera.position.z = THREE.MathUtils.damp(
      this.camera.position.z,
      this.boostTimer > 0 ? framing.z + 1.0 : framing.z,
      6,
      dt,
    );

    const targetFov =
      this.boostTimer > 0 ? framing.fov + 10 : framing.fov + Math.min(6, (this.speed - BASE_SPEED) * 0.3);
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 7, dt);
      this.camera.updateProjectionMatrix();
    }

    this.shakeIntensity = THREE.MathUtils.damp(this.shakeIntensity, 0, 10, dt);
    this.applyCameraShake();
    this.camera.lookAt(this.runnerX * 0.35, framing.lookY + this.runnerY * 0.3, framing.lookZ);

    // Subtle banking roll when weaving lanes (applied after lookAt!)
    const targetCamBank = THREE.MathUtils.clamp(-lateralVel * 0.0085, -0.075, 0.075);
    this.cameraBank = THREE.MathUtils.damp(this.cameraBank, targetCamBank, 10, dt);
    this.camera.rotation.z += this.cameraBank;

    this.hudEmitAccum += dt;
    if (this.hudEmitAccum >= 0.065) {
      this.hudEmitAccum = 0;
      this.emitHud(false);
    }
  }

  private applyCameraShake(): void {
    if (this.shakeIntensity > 0.004) {
      this.camera.position.x += (Math.random() - 0.5) * this.shakeIntensity;
      this.camera.position.y += (Math.random() - 0.5) * this.shakeIntensity;
    }
  }

  private animateRunner(dt: number, lateralVel: number, overGap: boolean): void {
    this.runner.root.position.set(this.runnerX, this.runnerY, 0);
    this.runner.squashRoot.scale.set(this.squashXZ, this.squashY, this.squashXZ);

    const blinkVisible = this.invulnTimer > 0 ? Math.floor(this.invulnTimer * 18) % 2 === 0 : true;
    if (this.customGlb && this.heroId === 'custom_glb') {
      this.runner.squashRoot.visible = false;
      this.customGlb.root.visible = blinkVisible;
      this.customGlb.root.scale.set(this.squashXZ, this.squashY, this.squashXZ);
      if (this.slideTimer > 0 && this.isGrounded) {
        setGltfCharacterState(this.customGlb, 'slide');
        this.customGlb.root.position.y = 0;
        this.customGlb.root.rotation.x = THREE.MathUtils.damp(this.customGlb.root.rotation.x, -0.65, 16, dt);
        this.customGlb.root.rotation.y = THREE.MathUtils.damp(this.customGlb.root.rotation.y, 0, 14, dt);
      } else if (!this.isGrounded) {
        setGltfCharacterState(this.customGlb, 'jump');
        this.customGlb.root.position.y = 0;
        this.customGlb.root.rotation.x = THREE.MathUtils.damp(this.customGlb.root.rotation.x, 0.15, 12, dt);
        this.customGlb.root.rotation.y = THREE.MathUtils.damp(this.customGlb.root.rotation.y, 0, 14, dt);
      } else {
        setGltfCharacterState(this.customGlb, 'run');
        if (!this.customGlb.hasRunClip) {
          this.customGlb.root.position.y = Math.abs(Math.cos(this.stridePhase)) * 0.11;
          this.customGlb.root.rotation.x = THREE.MathUtils.damp(this.customGlb.root.rotation.x, 0.22, 14, dt);
          this.customGlb.root.rotation.y = Math.sin(this.stridePhase) * 0.1;
        } else {
          this.customGlb.root.position.y = 0;
          this.customGlb.root.rotation.x = THREE.MathUtils.damp(this.customGlb.root.rotation.x, 0, 14, dt);
          this.customGlb.root.rotation.y = THREE.MathUtils.damp(this.customGlb.root.rotation.y, 0, 14, dt);
        }
      }
      this.customGlb.mixer?.update(dt);
    } else {
      this.runner.squashRoot.visible = blinkVisible;
    }

    this.runner.shieldDome.visible = this.hasShield;
    this.runner.shieldRing.visible = this.hasShield;
    if (this.hasShield) {
      this.runner.shieldDome.rotation.y += dt * 1.8;
      this.runner.shieldRing.rotation.x += dt * 2.4;
      this.runner.shieldRing.rotation.y -= dt * 1.6;
    }

    const boosting = this.boostTimer > 0;
    this.runner.boostRing.visible = boosting;
    this.runner.boostWings.visible = boosting;
    if (boosting) {
      this.runner.boostRing.rotation.z += dt * 7;
      this.runner.boostWings.rotation.x = Math.sin(performance.now() * 0.02) * 0.14;
      if (Math.random() < 0.6) {
        this.spawnParticleBurst(this.runnerX, 0.55 + this.runnerY, 0.4, 0xffae24, 1, 0.5);
      }
    }

    this.runner.contactShadow.visible = !overGap && this.runnerY >= -0.1;
    this.runner.contactShadow.position.y = -this.runnerY + 0.025;
    const shadowScale = Math.max(0.35, 1 - this.runnerY * 0.18);
    this.runner.contactShadow.scale.set(shadowScale, shadowScale, 1);

    const bank = THREE.MathUtils.clamp(-lateralVel * 0.032, -0.36, 0.36);
    this.runner.root.rotation.z = bank;

    if (this.slideTimer > 0 && this.isGrounded) {
      this.runner.bodyPivot.position.y = THREE.MathUtils.damp(this.runner.bodyPivot.position.y, 0.46, 18, dt);
      this.runner.bodyPivot.rotation.x = THREE.MathUtils.damp(this.runner.bodyPivot.rotation.x, -0.96, 18, dt);
      this.runner.leftLegPivot.rotation.x = 1.25;
      this.runner.leftKneePivot.rotation.x = -0.2;
      this.runner.rightLegPivot.rotation.x = 0.55;
      this.runner.rightKneePivot.rotation.x = -0.9;
      this.runner.leftArmPivot.rotation.x = -0.65;
      this.runner.leftElbowPivot.rotation.x = -0.5;
      this.runner.rightArmPivot.rotation.x = 0.65;
      this.runner.rightElbowPivot.rotation.x = -0.5;
      if (Math.random() < 0.45) {
        this.spawnParticleBurst(this.runnerX, 0.08, 0.25, 0xbca786, 1, 0.4);
      }
    } else if (!this.isGrounded) {
      this.runner.bodyPivot.position.y = 0.96;
      this.runner.bodyPivot.rotation.x = THREE.MathUtils.damp(this.runner.bodyPivot.rotation.x, 0.22, 12, dt);
      this.runner.leftLegPivot.rotation.x = 0.85;
      this.runner.leftKneePivot.rotation.x = -1.1;
      this.runner.rightLegPivot.rotation.x = -0.45;
      this.runner.rightKneePivot.rotation.x = -0.65;
      this.runner.leftArmPivot.rotation.x = -1.05;
      this.runner.leftElbowPivot.rotation.x = -0.55;
      this.runner.rightArmPivot.rotation.x = 0.6;
      this.runner.rightElbowPivot.rotation.x = -0.75;
    } else {
      this.stridePhase += dt * (this.speed * 0.92);
      const swing = Math.sin(this.stridePhase);
      const stepHalf = Math.floor(this.stridePhase / Math.PI);
      if (stepHalf !== this.prevStepHalf) {
        this.prevStepHalf = stepHalf;
        soundSynth.playStep();
      }

      this.runner.bodyPivot.position.y = 0.96 + Math.abs(Math.cos(this.stridePhase)) * 0.09;
      this.runner.bodyPivot.rotation.x = THREE.MathUtils.damp(this.runner.bodyPivot.rotation.x, 0.2, 14, dt);

      // Two-joint athletic leg stride (knee bends backwards on backswing!)
      this.runner.leftLegPivot.rotation.x = swing * 0.95;
      this.runner.leftKneePivot.rotation.x = -Math.max(0.1, -swing * 1.15);
      this.runner.rightLegPivot.rotation.x = -swing * 0.95;
      this.runner.rightKneePivot.rotation.x = -Math.max(0.1, swing * 1.15);

      // Two-joint pumping arms (elbows bent forward!)
      this.runner.leftArmPivot.rotation.x = -swing * 0.85;
      this.runner.leftElbowPivot.rotation.x = -0.85 - Math.max(0, -swing) * 0.45;
      this.runner.rightArmPivot.rotation.x = swing * 0.85;
      this.runner.rightElbowPivot.rotation.x = -0.85 - Math.max(0, swing) * 0.45;
    }

    // 3-segment cloth scarf trailing dynamically in the wind
    this.runner.scarfSeg1.rotation.x = 0.65 + Math.sin(this.stridePhase * 1.4) * 0.2;
    this.runner.scarfSeg2.rotation.x = 0.22 + Math.sin(this.stridePhase * 1.4 - 0.9) * 0.25;
    this.runner.scarfSeg3.rotation.x = 0.18 + Math.sin(this.stridePhase * 1.4 - 1.8) * 0.3;
  }

  private animateGuardian(dt: number): void {
    const chaseZ = THREE.MathUtils.lerp(15.2, 4.3, this.guardianThreat);
    this.guardian.root.position.z = THREE.MathUtils.damp(this.guardian.root.position.z, chaseZ, 6, dt);
    this.guardian.root.position.x = THREE.MathUtils.damp(this.guardian.root.position.x, this.runnerX * 0.82, 5, dt);

    const gCycle = this.stridePhase * 0.82;
    const gSwing = Math.sin(gCycle);
    this.guardian.bodyPivot.position.y = 1.25 + Math.abs(Math.cos(gCycle)) * 0.14;
    this.guardian.leftLegPivot.rotation.x = gSwing * 0.72;
    this.guardian.rightLegPivot.rotation.x = -gSwing * 0.72;
    this.guardian.leftArmPivot.rotation.x = -0.4 - gSwing * 0.58;
    this.guardian.leftElbowPivot.rotation.x = -0.55;
    this.guardian.rightArmPivot.rotation.x = -0.4 + gSwing * 0.58;
    this.guardian.rightElbowPivot.rotation.x = -0.55;
    this.guardian.crownRing.rotation.z += dt * 1.8;
  }

  private scrollTrack(worldStep: number): void {
    let minZ = Infinity;
    for (const seg of this.segments) {
      if (seg.z < minZ) minZ = seg.z;
    }

    for (const seg of this.segments) {
      seg.z += worldStep;
      if (seg.z > RECYCLE_Z) {
        seg.z = minZ - SEGMENT_LENGTH;
        minZ = seg.z;

        const allowGap = this.distance > 70;
        const makeGap = allowGap && Math.random() < 0.24;
        seg.hasGap = makeGap;
        seg.deckGroup.visible = !makeGap;
        seg.gapGroup.visible = makeGap;
      }
      seg.group.position.z = seg.z;
    }
  }

  private scrollTrees(worldStep: number): void {
    const span = SEGMENT_COUNT * SEGMENT_LENGTH;
    if (this.trunkInstanced.visible) {
      for (let i = 0; i < this.treeData.length; i++) {
        const t = this.treeData[i];
        t.z += worldStep;
        if (t.z > RECYCLE_Z + 6) {
          t.z -= span;
        }
      }
      this.updateTreeMatrices();
    }

    for (let i = 0; i < this.scrollingEnvProps.length; i++) {
      const p = this.scrollingEnvProps[i];
      p.z += worldStep;
      if (p.z > RECYCLE_Z + 8) {
        p.z -= span;
      }
      p.mesh.position.z = p.z;
    }
  }

  private updateMotes(dt: number, worldStep: number): void {
    const pos = this.motePoints.geometry.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    for (let i = 0; i < arr.length; i += 3) {
      arr[i + 1] += Math.sin(performance.now() * 0.002 + i) * dt * 0.35;
      arr[i + 2] += worldStep * 0.65;
      if (arr[i + 2] > 12) {
        arr[i + 2] = -68 - Math.random() * 12;
        arr[i] = (Math.random() - 0.5) * 14;
      }
    }
    pos.needsUpdate = true;
  }

  private updateFlames(dt: number): void {
    const t = performance.now() * 0.009;
    for (let i = 0; i < this.segments.length; i++) {
      const flames = this.segments[i].flames;
      for (let f = 0; f < flames.length; f++) {
        const flicker = 0.85 + Math.sin(t + i * 1.7 + f * 2.3) * 0.3;
        flames[f].scale.set(1, flicker, 1);
      }
    }
    void dt;
  }

  private updateObstacles(dt: number, worldStep: number): void {
    const isSliding = this.slideTimer > 0 && this.isGrounded;
    const playerMinY = this.runnerY;
    const playerMaxY = this.runnerY + (isSliding ? 0.82 : 1.72);
    const multiplier = 1 + Math.floor(this.distance / 250);

    for (const o of this.obstacles) {
      if (!o.active) continue;
      o.z += worldStep + o.extraSpeed * dt;
      o.mesh.position.z = o.z;

      if (o.kind === 'boulder') {
        o.mesh.rotation.x += (worldStep + o.extraSpeed * dt) * 1.1;
      } else if (o.kind === 'chakra_trap' && o.spinWheel) {
        o.spinWheel.rotation.x -= dt * 8.5;
      }

      if (o.z > 14) {
        o.active = false;
        o.mesh.visible = false;
        continue;
      }

      // Close-call detection right after passing Z = 0 cleanly!
      if (!o.clearedScored && o.z > 0.75) {
        o.clearedScored = true;
        const xDiff = Math.abs(this.runnerX - o.x);
        if ((o.kind === 'low_barrier' || o.kind === 'chakra_trap') && xDiff < 1.0 && this.runnerY > 0.85) {
          this.triggerCallout('CLEAN VAULT', 40 * multiplier);
        } else if (o.kind === 'high_arch' && xDiff < 1.05 && isSliding) {
          this.triggerCallout('SLIDE CLEAR', 40 * multiplier);
        } else if ((o.kind === 'monolith' || o.kind === 'boulder') && xDiff < 2.65) {
          this.triggerCallout('CLOSE CALL', 50 * multiplier);
        }
      }

      const zHalf = o.kind === 'boulder' ? 0.82 : 0.45;
      if (Math.abs(o.z) < zHalf + 0.28) {
        const xDiff = Math.abs(this.runnerX - o.x);
        const xLimit = o.kind === 'high_arch' || o.kind === 'low_barrier' || o.kind === 'chakra_trap' ? 1.04 : 0.82;

        if (xDiff < xLimit) {
          let yHit = false;
          if (o.kind === 'low_barrier') {
            yHit = playerMinY < 0.88;
          } else if (o.kind === 'chakra_trap') {
            yHit = playerMinY < 1.35;
          } else if (o.kind === 'high_arch') {
            yHit = playerMaxY > 1.24;
          } else {
            yHit = playerMinY < 2.85;
          }

          if (yHit) {
            if (this.boostTimer > 0) {
              o.active = false;
              o.mesh.visible = false;
              this.score += 120;
              this.shakeIntensity = 0.26;
              soundSynth.playCrash();
              this.spawnParticleBurst(o.x, 1.2, o.z, 0xffaa2b, 16, 1.5);
              continue;
            }

            if (this.invulnTimer > 0) continue;

            if (this.hasShield) {
              this.hasShield = false;
              this.invulnTimer = 1.25;
              this.hitstopTimer = 0.045;
              this.shakeIntensity = 0.28;
              o.active = false;
              o.mesh.visible = false;
              soundSynth.playShieldBreak();
              this.spawnParticleBurst(this.runnerX, 1.1, 0, 0x35e0a8, 18, 1.4);
              this.emitHud(true);
              continue;
            }

            const isEdgeGraze = xDiff > xLimit * 0.68 && this.guardianThreat < 0.72;
            if (isEdgeGraze) {
              this.invulnTimer = 1.15;
              this.guardianThreat = 0.94;
              this.hitstopTimer = 0.045;
              this.shakeIntensity = 0.3;
              o.active = false;
              o.mesh.visible = false;
              soundSynth.playStumble();
              this.spawnParticleBurst(this.runnerX, 0.9, 0, 0xff7733, 12, 1.1);
              this.emitHud(true);
            } else {
              const reasonMap: Record<ObstacleKind, string> = {
                low_barrier: 'Tripped on Spiked Barricade',
                high_arch: 'Struck by Hanging Blade Arch',
                monolith: 'Collided with Surya Idol Totem',
                boulder: 'Crushed by Runic Temple Boulder',
                chakra_trap: 'Sliced by Forged Chakra Trap',
              };
              this.triggerCrash(reasonMap[o.kind]);
              return;
            }
          }
        }
      }
    }
  }

  private updateCoins(dt: number, worldStep: number): void {
    const magnetActive = this.magnetTimer > 0;
    for (const c of this.coins) {
      if (!c.active) continue;
      c.z += worldStep;
      c.mesh.rotation.y += dt * 4.0;

      if (magnetActive && c.z > -15 && c.z < 3) {
        c.x = THREE.MathUtils.damp(c.x, this.runnerX, 11, dt);
        c.y = THREE.MathUtils.damp(c.y, this.runnerY + 1.0, 11, dt);
        c.z = THREE.MathUtils.damp(c.z, 0, 9, dt);
      }

      c.mesh.position.set(c.x, c.y + Math.sin(this.stridePhase * 0.5 + c.phaseOffset) * 0.08, c.z);

      if (c.z > 12) {
        c.active = false;
        c.mesh.visible = false;
        continue;
      }

      const dx = Math.abs(c.x - this.runnerX);
      const dy = Math.abs(c.y - (this.runnerY + 0.95));
      const dz = Math.abs(c.z);
      if (dx < 0.95 && dy < 1.15 && dz < 0.95) {
        c.active = false;
        c.mesh.visible = false;
        this.runCoins += 1;
        this.score += 25 * (1 + Math.floor(this.distance / 250));
        soundSynth.playCoin(this.coinCombo);
        this.coinCombo += 1;
        this.coinComboTimer = 0.9;
        this.spawnParticleBurst(c.x, c.y, c.z, 0xffd747, 6, 0.8);
      }
    }
  }

  private updatePowerups(dt: number, worldStep: number): void {
    for (const p of this.powerups) {
      if (!p.active) continue;
      p.z += worldStep;
      p.mesh.rotation.y += dt * 2.6;
      p.mesh.rotation.x += dt * 1.1;
      p.mesh.position.set(p.x, p.y + Math.sin(performance.now() * 0.005) * 0.14, p.z);

      if (p.z > 12) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }

      const dx = Math.abs(p.x - this.runnerX);
      const dy = Math.abs(p.y - (this.runnerY + 0.95));
      const dz = Math.abs(p.z);
      if (dx < 1.05 && dy < 1.25 && dz < 1.05) {
        p.active = false;
        p.mesh.visible = false;
        this.runPowerups += 1;
        if (p.kind === 'shield') {
          this.hasShield = true;
          this.spawnParticleBurst(p.x, p.y, p.z, 0x35e0a8, 14, 1.2);
        } else if (p.kind === 'magnet') {
          this.magnetTimer = INITIAL_HUD.powerups.magnetDuration;
          this.spawnParticleBurst(p.x, p.y, p.z, 0xff4961, 14, 1.2);
        } else {
          this.boostTimer = INITIAL_HUD.powerups.boostDuration;
          this.spawnParticleBurst(p.x, p.y, p.z, 0xffb72b, 16, 1.4);
        }
        soundSynth.playPowerup(p.kind);
        this.syncDailyMissions(true);
        this.emitHud(true);
      }
    }
  }

  private updateParticles(dt: number): void {
    for (const p of this.particles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }
      p.vy -= 14 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const ratio = p.life / p.maxLife;
      p.mesh.position.set(p.x, p.y, p.z);
      p.mesh.scale.setScalar(p.scale * ratio);
      p.mesh.rotation.x += dt * 6;
      p.mesh.rotation.y += dt * 5;
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = ratio;
    }
  }

  private syncDailyMissions(force: boolean): void {
    const distNow = Math.floor(this.distance);
    const distAdded = Math.max(0, distNow - this.runDistSynced);
    const coinsAdded = Math.max(0, this.runCoins - this.runCoinsSynced);
    const acroAdded = Math.max(0, this.runAcrobatics - this.runAcrobaticsSynced);
    const closeAdded = Math.max(0, this.closeCalls - this.runCloseCallsSynced);
    const powerAdded = Math.max(0, this.runPowerups - this.runPowerupsSynced);

    if (!force && distAdded < 8 && coinsAdded === 0 && acroAdded === 0 && closeAdded === 0 && powerAdded === 0) {
      return;
    }

    const delta: MissionProgressDelta = {
      distanceAdded: distAdded,
      singleRunDistance: distNow,
      coinsAdded,
      acrobaticsAdded: acroAdded,
      closeCallsAdded: closeAdded,
      powerupsAdded: powerAdded,
    };

    this.runDistSynced = distNow;
    this.runCoinsSynced = this.runCoins;
    this.runAcrobaticsSynced = this.runAcrobatics;
    this.runCloseCallsSynced = this.closeCalls;
    this.runPowerupsSynced = this.runPowerups;

    const { snapshot, completedTitle } = recordDailyMissionProgress(this.missionsSnapshot, delta);
    this.missionsSnapshot = snapshot;
    if (completedTitle) {
      this.newlyCompletedMission = completedTitle;
      this.newlyCompletedTimer = 3.2;
      soundSynth.playMissionComplete();
    }
  }

  private triggerCrash(reason: string): void {
    this.syncDailyMissions(true);
    this.deathReason = reason;
    this.hitstopTimer = 0.05;
    this.shakeIntensity = 0.55;
    this.cameraBank = 0;
    this.camera.rotation.z = 0;

    if (this.customGlb && this.heroId === 'custom_glb') {
      this.runner.squashRoot.visible = false;
      this.customGlb.root.visible = true;
      this.customGlb.root.rotation.x = -1.15;
    } else {
      this.runner.squashRoot.visible = true;
      this.runner.bodyPivot.rotation.x = -1.25;
    }
    soundSynth.playCrash();
    this.spawnParticleBurst(this.runnerX, Math.max(0.5, this.runnerY + 0.8), 0, 0xff6b2b, 24, 1.5);

    if (this.score > this.bestScore) {
      this.bestScore = Math.floor(this.score);
    }
    if (this.distance > this.bestDistance) {
      this.bestDistance = Math.floor(this.distance);
    }
    this.saveBestScores();

    // Launch Dramatic Ending Cutscene before Run Complete Modal
    this.phase = 'outro_cutscene';
    this.cutsceneTime = 0;
    this.cutsceneProgress = 0;
    this.outroGuardianSlammed = false;
    this.outroFellInAbyss = reason.includes('Abyss');
    this.cutsceneLabel = this.outroFellInAbyss ? 'Finale · The Abyss' : 'Finale · Captured';
    this.cutsceneCaption = this.outroFellInAbyss
      ? 'Swallowed by the canyon chasm — the temple keeps its secrets.'
      : 'The Stone Guardian overtakes the fallen explorer.';

    this.emitHud(true);
  }

  private emitHud(force: boolean): void {
    void force;
    const multiplier = 1 + Math.floor(this.distance / 250);
    this.onHudUpdate({
      phase: this.phase,
      heroId: this.heroId,
      customHeroName: this.customHeroName,
      customHeroUid: this.customHeroUid,
      distance: Math.floor(this.distance),
      score: Math.floor(this.score),
      coins: this.runCoins,
      bestScore: Math.floor(this.bestScore),
      bestDistance: Math.floor(this.bestDistance),
      multiplier,
      speedKmh: Math.round(this.speed * 2.8),
      guardianThreat: this.guardianThreat,
      closeCalls: this.closeCalls,
      calloutText: this.calloutText,
      calloutKey: this.calloutKey,
      cutsceneLabel: this.cutsceneLabel,
      cutsceneCaption: this.cutsceneCaption,
      cutsceneProgress: this.cutsceneProgress,
      newlyCompletedMission: this.newlyCompletedMission,
      missions: this.missionsSnapshot,
      powerups: {
        shield: this.hasShield,
        magnetRemaining: this.magnetTimer,
        magnetDuration: INITIAL_HUD.powerups.magnetDuration,
        boostRemaining: this.boostTimer,
        boostDuration: INITIAL_HUD.powerups.boostDuration,
      },
      deathReason: this.deathReason,
    });
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.unbindEvents();
    this.customGlb?.dispose();
    this.envProps?.dispose();
    this.textures.dispose();
    this.scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        m.geometry?.dispose();
        if (Array.isArray(m.material)) {
          m.material.forEach((mat) => mat.dispose());
        } else if (m.material) {
          m.material.dispose();
        }
      }
    });
    for (const g of this.disposableGeos) g.dispose();
    for (const m of this.disposableMats) m.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
