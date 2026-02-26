import * as THREE from 'three';
import { createGameState } from '@/state/gameState';
import { updateFlightPhysics } from '@/simulation/physics/flightPhysics';
import { updateBulletSystem } from '@/simulation/combat/bulletSystem';
import { updateMissileSystem } from '@/simulation/combat/missileSystem';
import { updateCollisionSystem } from '@/simulation/combat/collisionSystem';
import { spawnEnemies, spawnGroundEnemy, updateEnemyAI } from '@/simulation/ai/enemyAI';
import { updateOOBSystem } from '@/simulation/physics/oobSystem';
import { loadWeapon, loadMission, preloadMissionData } from '@/utils/dataLoader';
import type { Difficulty } from '@/state/combatState';
import { InputManager } from '@/input/inputManager';
import { createScene, createLights, createTerrain } from '@/rendering/sceneSetup';
import { createTerrainProps } from '@/rendering/terrainProps';
import { PlayerMesh } from '@/rendering/playerMesh';
import { CameraController } from '@/rendering/cameras';
import { HUD } from '@/rendering/hud/hud';
import { PostProcessing } from '@/rendering/postProcessing';
import { CombatRenderer } from '@/rendering/combatRenderer';
import { DamageVignette } from '@/rendering/damageVignette';
import { ModelLoader } from '@/rendering/modelLoader';
import { LoadingScreen } from '@/rendering/loadingScreen';
import { ContrailSystem } from '@/rendering/contrailSystem';
import { loadPlane } from '@/utils/dataLoader';
import { loadSettings, saveSettings, type Settings } from '@/core/settings';
import { SettingsUI } from '@/ui/settingsUI';
import { MainMenu } from '@/ui/mainMenu';

const MODEL_PATH = '/models/planes/planes/delta.glb';

export class App {
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private sun!: THREE.DirectionalLight;
  private cameraController!: CameraController;
  private state = createGameState();
  private inputManager!: InputManager;
  private playerMesh!: PlayerMesh;
  private hud!: HUD;
  private clock!: THREE.Clock;
  private postProcessing!: PostProcessing;
  private combatRenderer!: CombatRenderer;
  private damageVignette!: DamageVignette;
  private contrailSystem!: ContrailSystem;
  private settingsUI!: SettingsUI;
  private mainMenu!: MainMenu;
  private settings: Settings;
  private started = false;
  private gameStarted = false; // true after menu dismissed
  private wasDead = false;
  private crashOverlay!: HTMLDivElement;

  constructor() {
    this.settings = loadSettings();
    this.init().catch((err) => console.error('[App] init failed:', err));
  }

  private async init(): Promise<void> {
    // Loading screen
    const loadingScreen = new LoadingScreen();

    // Loading manager
    const manager = new THREE.LoadingManager();
    manager.onProgress = (_url, loaded, total) => {
      loadingScreen.setProgress(loaded / total);
    };

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = this.settings.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const canvas = this.renderer.domElement;
    canvas.tabIndex = 0;
    document.getElementById('app')!.appendChild(canvas);
    canvas.focus();

    // Scene
    this.scene = createScene();
    const { sun } = createLights(this.scene, this.settings.shadows);
    this.sun = sun;
    createTerrain(this.scene);
    createTerrainProps(this.scene, this.settings.treeDensity);

    // Apply fog from settings
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.density = this.settings.fogDensity;
    }

    // Camera
    this.cameraController = new CameraController(
      window.innerWidth / window.innerHeight,
    );

    // Player mesh (starts with primitive fallback)
    this.playerMesh = new PlayerMesh();
    this.scene.add(this.playerMesh.group);

    // Try loading GLB model
    const modelLoader = new ModelLoader(manager);
    try {
      const model = await modelLoader.load(MODEL_PATH, {
        posX: this.settings.modelOffsetX,
        posY: this.settings.modelOffsetY,
        posZ: this.settings.modelOffsetZ,
        rotX: this.settings.modelRotX,
        rotY: this.settings.modelRotY,
        rotZ: this.settings.modelRotZ,
        scale: 1,
      });
      this.playerMesh.setModel(model);
    } catch {
      console.warn('Could not load plane model, using primitive fallback.');
      // Trigger 100% progress since no model to load
      loadingScreen.setProgress(1);
    }

    // Post-processing
    this.postProcessing = new PostProcessing(
      this.renderer,
      this.scene,
      this.cameraController.camera,
    );
    this.postProcessing.setBloomEnabled(this.settings.bloom);

    // Combat renderer
    this.combatRenderer = new CombatRenderer(this.scene);
    this.damageVignette = new DamageVignette();

    // Contrail / engine exhaust system
    this.contrailSystem = new ContrailSystem(this.scene);
    // Load player plane data for engine offsets
    try {
      const planeData = await loadPlane('delta');
      if (planeData.engines && planeData.engines.length > 0) {
        this.contrailSystem.setEngineOffsets(planeData.engines);
      }
    } catch {
      console.warn('[App] Could not load plane data for engine offsets, using defaults.');
    }

    // Pre-load weapon data so getWeaponSync works during gameplay
    await Promise.all([
      loadWeapon('cannon'),
      loadWeapon('sidewinder'),
      loadWeapon('dart'),
      loadWeapon('chaff'),
    ]);

    // Apply initial difficulty from settings
    this.state.combat.difficulty = this.settings.difficulty as Difficulty;
    this.state.combat.seeker.seekDuration = this.settings.seekerDuration;

    // Load mission data and spawn enemies
    try {
      const mission = await loadMission('mission1');
      await preloadMissionData(mission);
      // Apply mission bounds
      this.state.bounds = { ...mission.bounds };
      // Spawn air enemies
      spawnEnemies(this.state, mission.difficulty[this.settings.difficulty]?.airCount ?? 4);
      // Spawn ground enemies
      const groundCount = mission.difficulty[this.settings.difficulty]?.groundCount ?? 2;
      for (let i = 0; i < Math.min(groundCount, mission.groundEnemies.length); i++) {
        const ge = mission.groundEnemies[i];
        spawnGroundEnemy(this.state, ge.position, ge.vehicleId, ge.moving, ge.patrolRadius);
      }
    } catch (err) {
      console.warn('[App] Could not load mission, using default spawns:', err);
      spawnEnemies(this.state, 4);
    }

    // Input
    this.inputManager = new InputManager();

    // HUD
    this.hud = new HUD();

    // Crash overlay
    this.crashOverlay = document.createElement('div');
    this.crashOverlay.id = 'crash-overlay';
    const os = this.crashOverlay.style;
    os.position = 'fixed';
    os.top = '0';
    os.left = '0';
    os.width = '100%';
    os.height = '100%';
    os.display = 'none';
    os.zIndex = '150';
    os.pointerEvents = 'none';
    os.background = 'radial-gradient(ellipse at center, transparent 20%, rgba(0,0,0,0.7) 100%)';
    os.fontFamily = "'Courier New', monospace";
    os.color = '#ff4444';
    os.textAlign = 'center';
    os.justifyContent = 'center';
    os.alignItems = 'center';
    os.flexDirection = 'column';
    this.crashOverlay.innerHTML = '<div style="font-size:48px;font-weight:bold;text-shadow:0 0 20px rgba(255,0,0,0.5)">CRASHED</div><div style="font-size:16px;opacity:0.7;margin-top:12px">Respawning...</div>';
    document.getElementById('app')!.appendChild(this.crashOverlay);

    // Settings UI
    this.settingsUI = new SettingsUI(this.settings, (s) => this.applySettings(s));

    // Clock
    this.clock = new THREE.Clock();

    // Resize
    window.addEventListener('resize', this.onResize);

    // Prevent Tab from switching focus
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Tab') e.preventDefault();
    });

    // Hide loading screen, show main menu
    loadingScreen.hide();
    this.started = true;

    // Main menu — game loop starts but simulation paused until menu dismissed
    this.mainMenu = new MainMenu(() => {
      this.gameStarted = true;
      this.clock.getDelta(); // flush accumulated delta
      canvas.focus();
    });
    this.mainMenu.onSettingsClick(() => {
      this.settingsUI.toggle();
    });

    this.loop();
  }

  private applySettings(s: Settings): void {
    this.settings = s;
    saveSettings(s);

    // Shadows
    this.renderer.shadowMap.enabled = s.shadows;
    this.sun.castShadow = s.shadows;

    // Bloom
    this.postProcessing.setBloomEnabled(s.bloom);

    // Fog
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.density = s.fogDensity;
    }

    // Model offsets (debug)
    const inner = this.playerMesh.getInnerModel();
    if (inner) {
      inner.position.set(s.modelOffsetX, s.modelOffsetY, s.modelOffsetZ);
      inner.rotation.set(s.modelRotX, s.modelRotY, s.modelRotZ);
    }
  }

  private loop = (): void => {
    if (!this.started) return;
    requestAnimationFrame(this.loop);

    const dt = this.clock.getDelta();
    this.state.time.delta = dt;
    this.state.time.elapsed += dt;

    // Apply settings to state each frame
    this.state.input.useMouseAim = this.settings.useMouseAim;
    this.state.combat.difficulty = this.settings.difficulty as Difficulty;
    this.state.combat.seeker.seekDuration = this.settings.seekerDuration;

    // Skip input/simulation when menu or settings panel is open
    const paused = !this.gameStarted || this.settingsUI.isVisible();
    if (!paused) {
      // 1. Input → state
      this.inputManager.update(this.state);

      // Weapon slot selection
      if (this.state.input.selectSlot > 0) {
        const slotExists = this.state.combat.weaponSlots.some(
          ws => ws.slot === this.state.input.selectSlot,
        );
        if (slotExists) {
          this.state.combat.selectedSlot = this.state.input.selectSlot;
        }
      }

      // 2. Simulation (state only, no Three.js)
      updateFlightPhysics(this.state);
      updateBulletSystem(this.state);
      updateMissileSystem(this.state);
      updateEnemyAI(this.state);
      updateCollisionSystem(this.state);
      updateOOBSystem(this.state);
    }

    // ── Crash transitions ──────────────────────────────────────────────────
    const isDead = this.state.player.isDead;
    if (isDead && !this.wasDead) {
      // Just died — trigger shake, show overlay
      this.cameraController.shake(3.5);
      this.crashOverlay.style.display = 'flex';
    } else if (!isDead && this.wasDead) {
      // Just respawned — hide overlay, reset camera
      this.crashOverlay.style.display = 'none';
      this.cameraController.resetTracking();
    }
    this.wasDead = isDead;

    // Hide player mesh when dead
    this.playerMesh.group.visible = !isDead;

    // 3. Rendering (reads state → Three.js)
    this.playerMesh.syncToState(this.state.player);
    this.cameraController.update(this.state, this.playerMesh.group);

    // Update shadow camera to follow player
    if (this.settings.shadows) {
      this.sun.position.set(
        this.state.player.position.x + 600,
        this.state.player.position.y + 1500,
        this.state.player.position.z + 400,
      );
      this.sun.target.position.set(
        this.state.player.position.x,
        this.state.player.position.y,
        this.state.player.position.z,
      );
      this.sun.target.updateMatrixWorld();
    }

    // Combat rendering
    this.combatRenderer.update(this.state);
    this.damageVignette.update(this.state.combat.playerDamageFlash);

    // Engine exhaust particles
    if (!isDead) {
      this.contrailSystem.update(
        dt,
        this.playerMesh.group.position,
        this.playerMesh.group.quaternion,
        this.state.player.throttle,
        this.state.player.speed,
        this.state.player.afterburner,
      );
    }

    this.hud.update(this.state, this.cameraController.camera);

    // Render via post-processing pipeline
    this.postProcessing.render();
  };

  private onResize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const pr = Math.min(window.devicePixelRatio, 2);
    this.renderer.setSize(w, h);
    this.cameraController.resize(w / h);
    this.postProcessing.resize(w, h, pr);
  };
}
