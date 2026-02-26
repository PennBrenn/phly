import * as THREE from 'three';
import { createGameState } from '@/state/gameState';
import { updateFlightPhysics } from '@/simulation/physics/flightPhysics';
import { InputManager } from '@/input/inputManager';
import { createScene, createLights, createTerrain } from '@/rendering/sceneSetup';
import { PlayerMesh } from '@/rendering/playerMesh';
import { CameraController } from '@/rendering/cameras';
import { HUD } from '@/rendering/hud/hud';

export class App {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private cameraController: CameraController;
  private state = createGameState();
  private inputManager: InputManager;
  private playerMesh: PlayerMesh;
  private hud: HUD;
  private clock: THREE.Clock;

  constructor() {
    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.getElementById('app')!.appendChild(this.renderer.domElement);

    // Scene
    this.scene = createScene();
    createLights(this.scene);
    createTerrain(this.scene);

    // Camera
    this.cameraController = new CameraController(
      window.innerWidth / window.innerHeight,
    );

    // Player mesh
    this.playerMesh = new PlayerMesh();
    this.scene.add(this.playerMesh.group);

    // Input
    this.inputManager = new InputManager();

    // HUD
    this.hud = new HUD();

    // Clock
    this.clock = new THREE.Clock();

    // Resize
    window.addEventListener('resize', this.onResize);

    // Prevent Tab from switching focus
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Tab') e.preventDefault();
    });

    // Start loop
    this.loop();
  }

  private loop = (): void => {
    requestAnimationFrame(this.loop);

    const dt = this.clock.getDelta();
    this.state.time.delta = dt;
    this.state.time.elapsed += dt;

    // 1. Input → state
    this.inputManager.update(this.state);

    // 2. Simulation (state only, no Three.js)
    updateFlightPhysics(this.state);

    // 3. Rendering (reads state → Three.js)
    this.playerMesh.syncToState(this.state.player);
    this.cameraController.update(this.state, this.playerMesh.group);

    this.hud.update(
      this.state.player.speed,
      this.state.player.altitude,
      this.state.player.throttle,
      this.state.player.isStalling,
      this.state.input.useMouseAim,
    );

    this.renderer.render(this.scene, this.cameraController.camera);
  };

  private onResize = (): void => {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.cameraController.resize(window.innerWidth / window.innerHeight);
  };
}
