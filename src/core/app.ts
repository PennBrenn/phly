import * as THREE from 'three';
import { createGameState } from '@/state/gameState';
import { updateFlightPhysics } from '@/simulation/physics/flightPhysics';
import { InputManager } from '@/input/inputManager';
import { createScene, createLights, createTerrain } from '@/rendering/sceneSetup';
import { createTerrainProps } from '@/rendering/terrainProps';
import { PlayerMesh } from '@/rendering/playerMesh';
import { CameraController } from '@/rendering/cameras';
import { HUD } from '@/rendering/hud/hud';
import { PostProcessing } from '@/rendering/postProcessing';
import { ModelLoader } from '@/rendering/modelLoader';
import { LoadingScreen } from '@/rendering/loadingScreen';
import { loadSettings, saveSettings, type Settings } from '@/core/settings';
import { SettingsUI } from '@/ui/settingsUI';

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
  private settingsUI!: SettingsUI;
  private settings: Settings;
  private started = false;

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

    // Input
    this.inputManager = new InputManager();

    // HUD
    this.hud = new HUD();

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

    // Hide loading screen and start
    loadingScreen.hide();
    this.started = true;
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

    // Apply mouse aim from settings
    this.state.input.useMouseAim = this.settings.useMouseAim;

    // Skip input/simulation when settings panel is open
    if (!this.settingsUI.isVisible()) {
      // 1. Input → state
      this.inputManager.update(this.state);

      // 2. Simulation (state only, no Three.js)
      updateFlightPhysics(this.state);
    }

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

    this.hud.update(
      this.state.player.speed,
      this.state.player.altitude,
      this.state.player.throttle,
      this.state.player.isStalling,
      this.state.input.useMouseAim,
    );

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
