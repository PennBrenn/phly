import * as THREE from 'three';
import { createGameState } from '@/state/gameState';
import { updateFlightPhysics } from '@/simulation/physics/flightPhysics';
import { updateBulletSystem } from '@/simulation/combat/bulletSystem';
import { updateMissileSystem } from '@/simulation/combat/missileSystem';
import { updateCollisionSystem } from '@/simulation/combat/collisionSystem';
import { updateEnemyAI } from '@/simulation/ai/enemyAI';
import { updateOOBSystem } from '@/simulation/physics/oobSystem';
import { loadWeapon, loadMission, preloadMissionData, loadPlane, getWeaponSync } from '@/utils/dataLoader';
import type { MissionData, PlaneData } from '@/utils/dataLoader';
import type { Difficulty } from '@/state/combatState';
import { InputManager } from '@/input/inputManager';
import { createScene, createLights, createTerrain } from '@/rendering/sceneSetup';
import { createTerrainProps } from '@/rendering/terrainProps';
import { setTerrainSeed } from '@/utils/terrain';
import { PlayerMesh } from '@/rendering/playerMesh';
import { CameraController } from '@/rendering/cameras';
import { HUD } from '@/rendering/hud/hud';
import { PostProcessing } from '@/rendering/postProcessing';
import { CombatRenderer } from '@/rendering/combatRenderer';
import { DamageVignette } from '@/rendering/damageVignette';
import { ModelLoader } from '@/rendering/modelLoader';
import { LoadingScreen } from '@/rendering/loadingScreen';
import { ContrailSystem } from '@/rendering/contrailSystem';
import { ObjectiveTracker } from '@/rendering/hud/objectiveTracker';
import { loadSettings, saveSettings, type Settings } from '@/core/settings';
import { SettingsUI } from '@/ui/settingsUI';
import { MainMenu } from '@/ui/mainMenu';
import { PauseMenu } from '@/ui/pauseMenu';
import { HangarUI } from '@/ui/hangar';
import { LevelSelectUI } from '@/ui/levelSelect';
import { MissionCompleteUI } from '@/ui/missionComplete';
import { loadLevelManifest, applyMissionToState } from '@/levels/levelLoader';
import type { LevelManifest } from '@/levels/levelLoader';
import { loadEconomy, saveEconomy, calculateReward } from '@/state/economyState';
import type { EconomyState } from '@/state/economyState';
import { loadUpgradeState, saveUpgradeState } from '@/state/upgradeState';
import type { UpgradeState } from '@/state/upgradeState';
import { loadProgress, saveProgress, getMissionProgress } from '@/state/progressState';
import type { ProgressState } from '@/state/progressState';
import { PeerManager } from '@/networking/peerManager';
import { encode, packPlayer, unpackPlayer } from '@/networking/protocol';
import type { NetMessage, LoadoutPayload, PlayerStatePayload, EnemyStatePayload, EnemyNetState, KillEventPayload } from '@/networking/protocol';
import { SyncTimer, createInterpBuffer, pushPlayerSnapshot, pushEnemySnapshot, interpolatePlayer, interpolateEnemies } from '@/networking/syncLoop';
import type { InterpBuffer } from '@/networking/syncLoop';
import { MultiplayerMenu } from '@/ui/multiplayerMenu';
import { DisconnectOverlay } from '@/ui/disconnectOverlay';
import type { RemotePlayerState } from '@/state/gameState';

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
  private objectiveTracker!: ObjectiveTracker;
  private settingsUI!: SettingsUI;
  private pauseMenu!: PauseMenu;
  private mainMenu!: MainMenu;
  private hangarUI!: HangarUI;
  private levelSelectUI!: LevelSelectUI;
  private missionCompleteUI!: MissionCompleteUI;
  private settings: Settings;
  private economy!: EconomyState;
  private upgrades!: UpgradeState;
  private progress!: ProgressState;
  private levels: LevelManifest[] = [];
  private started = false;
  private gameStarted = false;
  private wasDead = false;
  private crashOverlay!: HTMLDivElement;
  private modelLoader!: ModelLoader;
  private canvas!: HTMLCanvasElement;
  // Mission tracking
  private activeMission: MissionData | null = null;
  private missionTimer = 0;
  private missionAirKills = 0;
  private missionGroundKills = 0;
  private missionDamageTaken = 0;
  private missionStartHealth = 100;
  private prevAirKillCount = 0;
  private prevGroundKillCount = 0;
  // Cinematic menu camera
  private menuCamAngle = 0;
  // Networking
  private peerManager: PeerManager | null = null;
  private syncTimer = new SyncTimer();
  private interpBuffer: InterpBuffer = createInterpBuffer();
  private remotePlayerMesh: PlayerMesh | null = null;
  private multiplayerMenu!: MultiplayerMenu;
  private disconnectOverlay!: DisconnectOverlay;
  private isMultiplayer = false;
  private playerName = 'Pilot';

  constructor() {
    this.settings = loadSettings();
    this.economy = loadEconomy();
    this.upgrades = loadUpgradeState();
    this.progress = loadProgress();
    this.init().catch((err) => console.error('[App] init failed:', err));
  }

  private async init(): Promise<void> {
    const loadingScreen = new LoadingScreen();
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
    this.canvas = this.renderer.domElement;
    this.canvas.tabIndex = 0;
    document.getElementById('app')!.appendChild(this.canvas);
    this.canvas.focus();

    // Scene — random seed each session for varied menu backgrounds
    setTerrainSeed(Math.floor(Math.random() * 999999));
    this.scene = createScene();
    const { sun } = createLights(this.scene, this.settings.shadows);
    this.sun = sun;
    createTerrain(this.scene);
    createTerrainProps(this.scene, this.settings.treeDensity);
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.density = this.settings.fogDensity;
    }

    // Camera
    this.cameraController = new CameraController(window.innerWidth / window.innerHeight);

    // Player mesh
    this.playerMesh = new PlayerMesh();
    this.scene.add(this.playerMesh.group);
    this.playerMesh.group.visible = false;

    // Model loader
    this.modelLoader = new ModelLoader(manager);

    // Post-processing
    this.postProcessing = new PostProcessing(this.renderer, this.scene, this.cameraController.camera);
    this.postProcessing.setBloomEnabled(this.settings.bloom);
    this.postProcessing.setGodRaysEnabled(this.settings.godRays);
    this.postProcessing.setChromaticAberrationEnabled(this.settings.chromaticAberration);
    this.postProcessing.setVignetteEnabled(this.settings.vignette);
    this.postProcessing.setFXAAEnabled(this.settings.fxaa);

    // Combat renderer & vignette
    this.combatRenderer = new CombatRenderer(this.scene);
    this.damageVignette = new DamageVignette();

    // Contrails
    this.contrailSystem = new ContrailSystem(this.scene);

    // Objective tracker
    this.objectiveTracker = new ObjectiveTracker();
    this.objectiveTracker.hide();

    // Pre-load base weapon data
    await Promise.all([
      loadWeapon('cannon'), loadWeapon('chaff'), loadWeapon('mini'),
    ]).catch(() => {});

    // Input
    this.inputManager = new InputManager();

    // HUD
    this.hud = new HUD();

    // Crash overlay
    this.crashOverlay = document.createElement('div');
    this.crashOverlay.id = 'crash-overlay';
    const os = this.crashOverlay.style;
    os.position = 'fixed'; os.top = '0'; os.left = '0'; os.width = '100%'; os.height = '100%';
    os.display = 'none'; os.zIndex = '150'; os.pointerEvents = 'none';
    os.background = 'radial-gradient(ellipse at center, transparent 20%, rgba(0,0,0,0.7) 100%)';
    os.fontFamily = "'Courier New', monospace"; os.color = '#ff4444'; os.textAlign = 'center';
    os.justifyContent = 'center'; os.alignItems = 'center'; os.flexDirection = 'column';
    this.crashOverlay.innerHTML = '<div style="font-size:48px;font-weight:bold;text-shadow:0 0 20px rgba(255,0,0,0.5)">CRASHED</div><div style="font-size:16px;opacity:0.7;margin-top:12px">Respawning...</div>';
    document.getElementById('app')!.appendChild(this.crashOverlay);

    // Settings UI
    this.settingsUI = new SettingsUI(this.settings, (s) => this.applySettings(s));
    // setOnClose is deferred via arrow function so mainMenu ref is resolved at call time
    this.settingsUI.setOnClose(() => {
      if (this.gameStarted && this.mainMenu && !this.mainMenu.isVisible()) this.pauseMenu.show();
    });

    // Pause menu
    this.pauseMenu = new PauseMenu({
      onResume: () => { this.canvas.focus(); },
      onSettings: () => { this.settingsUI.show(); },
      onMainMenu: () => { window.location.reload(); },
    });

    // Load level manifest
    this.levels = await loadLevelManifest();

    // Hangar UI (standalone loadout builder)
    this.hangarUI = new HangarUI(this.upgrades, this.economy, {
      onSelectPlane: (_id) => { saveUpgradeState(this.upgrades); },
      onChangeLoadout: (_lo) => { saveUpgradeState(this.upgrades); },
      onPurchasePlane: (id) => { this.buyPlane(id); },
      onPurchaseWeapon: (id) => { this.buyWeapon(id); },
      onConfirm: () => { this.hangarUI.hide(); this.mainMenu.show(); },
      onBack: () => { this.mainMenu.show(); },
    });
    await this.hangarUI.preloadData();

    // Level Select UI
    this.levelSelectUI = new LevelSelectUI(this.levels, this.progress, {
      onSelectLevel: (id) => { this.startMission(id); },
      onBack: () => { this.mainMenu.show(); },
    });

    // Mission Complete UI
    this.missionCompleteUI = new MissionCompleteUI(() => {
      window.location.reload();
    });

    // Multiplayer Menu
    this.multiplayerMenu = new MultiplayerMenu();

    // Disconnect overlay
    this.disconnectOverlay = new DisconnectOverlay(
      () => {
        // Continue solo
        this.isMultiplayer = false;
        this.syncTimer.stop();
        this.peerManager?.disconnect();
        this.peerManager = null;
        this.removeRemotePlayer();
        this.canvas.focus();
      },
      () => {
        // Quit to menu
        window.location.reload();
      },
    );

    // Debug callbacks
    this.settingsUI.setDebugCallbacks({
      onUnlockAll: () => {
        for (const p of this.upgrades.planes) p.unlocked = true;
        for (const w of this.upgrades.weapons) w.unlocked = true;
        this.progress.unlockedMissionIds = this.levels.map(l => l.id);
        this.economy.credits = Math.max(this.economy.credits, 99999);
        saveUpgradeState(this.upgrades);
        saveEconomy(this.economy);
        saveProgress(this.progress);
        this.hangarUI.updateUpgrades(this.upgrades);
        this.hangarUI.updateEconomy(this.economy);
      },
      onResetProgress: () => {
        localStorage.removeItem('phly-economy');
        localStorage.removeItem('phly-upgrades');
        localStorage.removeItem('phly-progress');
        window.location.reload();
      },
      onSkipMission: () => {
        if (this.activeMission) {
          this.completeMission(true);
        }
      },
    });

    // Clock
    this.clock = new THREE.Clock();

    // Resize
    window.addEventListener('resize', this.onResize);

    // Escape key handling
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Tab') e.preventDefault();
      if (e.code === 'Escape') {
        e.preventDefault();
        const anyMenuOpen = this.hangarUI?.isVisible() || this.levelSelectUI?.isVisible()
          || this.missionCompleteUI?.isVisible() || this.mainMenu?.isVisible()
          || this.multiplayerMenu?.isVisible() || this.disconnectOverlay?.isVisible();
        if (this.settingsUI.isVisible()) {
          this.settingsUI.hide();
          // Only show pause if we're mid-game (no other overlay open)
          if (this.gameStarted && !anyMenuOpen) this.pauseMenu.show();
        } else if (this.pauseMenu.isVisible()) {
          this.pauseMenu.hide();
          this.canvas.focus();
        } else if (this.gameStarted && !anyMenuOpen) {
          this.pauseMenu.show();
        }
      }
    });

    // Apply difficulty
    this.state.combat.difficulty = this.settings.difficulty as Difficulty;
    this.state.combat.seeker.seekDuration = this.settings.seekerDuration;

    loadingScreen.hide();
    this.started = true;
    console.debug('[Debug][App] Initialization complete');

    // Main menu: Singleplayer → Level Select, Loadout → Hangar, Multiplayer → MP Menu
    this.mainMenu = new MainMenu(() => {
      this.levelSelectUI.show();
    });
    this.mainMenu.onSettingsClick(() => { this.settingsUI.toggle(); });
    this.mainMenu.onMultiplayerClick(() => { this.openMultiplayerMenu(); });
    this.mainMenu.onLoadoutClick(() => { this.hangarUI.show(); });

    this.loop();
  }

  private buyPlane(planeId: string): void {
    const pu = this.upgrades.planes.find(p => p.planeId === planeId);
    if (!pu || pu.unlocked) return;
    if (this.economy.credits < pu.purchasePrice) return;
    console.debug('[Debug][App] Purchasing plane:', planeId, 'cost:', pu.purchasePrice);
    this.economy.credits -= pu.purchasePrice;
    pu.unlocked = true;
    saveEconomy(this.economy);
    saveUpgradeState(this.upgrades);
    this.hangarUI.updateEconomy(this.economy);
    this.hangarUI.updateUpgrades(this.upgrades);
  }

  private buyWeapon(weaponId: string): void {
    const wu = this.upgrades.weapons.find(w => w.weaponId === weaponId);
    if (!wu || wu.unlocked) return;
    if (this.economy.credits < wu.purchasePrice) return;
    console.debug('[Debug][App] Purchasing weapon:', weaponId, 'cost:', wu.purchasePrice);
    this.economy.credits -= wu.purchasePrice;
    wu.unlocked = true;
    saveEconomy(this.economy);
    saveUpgradeState(this.upgrades);
    this.hangarUI.updateEconomy(this.economy);
    this.hangarUI.updateUpgrades(this.upgrades);
  }

  private async startMission(missionId: string): Promise<void> {
    try {
      const mission = await loadMission(missionId);
      await preloadMissionData(mission);
      this.activeMission = mission;

      // Load selected plane data and apply stats
      const planeId = this.upgrades.loadout.planeId;
      let planeData: PlaneData | null = null;
      try { planeData = await loadPlane(planeId); } catch { /* fallback */ }

      // Apply plane stats to game state
      if (planeData) {
        this.state.player.health = planeData.health;
        this.missionStartHealth = planeData.health;
        // Set engine offsets
        if (planeData.engines?.length) {
          this.contrailSystem.setEngineOffsets(planeData.engines);
        }
      }

      // Apply loadout weapon slots — slot 1 is always the plane's gun
      const lo = this.upgrades.loadout;
      this.state.combat.weaponSlots = lo.weaponSlots.map(ws => {
        // Override slot 1 with the plane's gun (from plane data, not loadout)
        const weaponId = ws.slot === 1 && planeData?.gun ? planeData.gun : ws.weaponId;
        // Determine ammo: guns = infinite, missiles from data, chaff = 12
        let ammo = -1;
        try {
          const wData = getWeaponSync(weaponId);
          if (wData) {
            if (wData.type === 'gun') ammo = -1;
            else if (wData.type === 'countermeasure') ammo = 12;
            else ammo = wData.ammo ?? 2;
          }
        } catch { /* fallback */ }
        return { slot: ws.slot, weaponId, ammo, cooldown: 0 };
      });
      this.state.combat.selectedSlot = 2;

      // Pre-load loadout weapons + plane gun
      if (planeData?.gun) {
        try { await loadWeapon(planeData.gun); } catch { /* skip */ }
      }
      for (const ws of lo.weaponSlots) {
        try { await loadWeapon(ws.weaponId); } catch { /* skip */ }
      }

      // Try loading plane model
      try {
        const modelPath = planeData?.model ?? `/models/planes/${planeId}.glb`;
        const model = await this.modelLoader.load(modelPath, {
          posX: this.settings.modelOffsetX, posY: this.settings.modelOffsetY,
          posZ: this.settings.modelOffsetZ, rotX: this.settings.modelRotX,
          rotY: this.settings.modelRotY, rotZ: this.settings.modelRotZ, scale: 1,
        });
        this.playerMesh.setModel(model);
      } catch {
        console.warn('[App] Could not load plane model, using primitive fallback.');
      }

      // Apply mission to state
      applyMissionToState(this.state, mission, this.settings.difficulty);

      // Setup objectives
      if (mission.objectives?.length) {
        this.objectiveTracker.setObjectives(mission.objectives);
        this.objectiveTracker.show();
      }

      // Reset mission trackers
      this.missionTimer = 0;
      this.missionAirKills = 0;
      this.missionGroundKills = 0;
      this.missionDamageTaken = 0;
      this.prevAirKillCount = 0;
      this.prevGroundKillCount = 0;

      // Increment attempt count
      const mp = getMissionProgress(this.progress, missionId);
      mp.attempts++;
      saveProgress(this.progress);

      // Start the game
      console.debug('[Debug][App] Starting mission:', missionId, 'plane:', planeId);
      this.gameStarted = true;
      this.playerMesh.group.visible = true;
      if (this.remotePlayerMesh) this.remotePlayerMesh.group.visible = true;
      this.clock.getDelta();
      this.canvas.focus();

      // Start multiplayer sync if connected
      if (this.isMultiplayer && this.peerManager) {
        this.startSyncLoop();
        // Re-send loadout now that mission is starting
        const lo: LoadoutPayload = {
          planeId: this.upgrades.loadout.planeId,
          modelPath: `/models/planes/${this.upgrades.loadout.planeId}.glb`,
          weaponSlots: this.upgrades.loadout.weaponSlots.map(ws => ({ slot: ws.slot, weaponId: ws.weaponId })),
          playerName: this.playerName,
        };
        this.peerManager.send(encode('loadout_sync', lo));
      }
    } catch (err) {
      console.error('[App] Failed to start mission:', err);
    }
  }

  private completeMission(won: boolean): void {
    if (!this.activeMission) return;
    console.debug('[Debug][App] Mission complete:', this.activeMission.id, 'won:', won);
    const mission = this.activeMission;
    this.gameStarted = false;
    this.syncTimer.stop();
    if (this.remotePlayerMesh) this.remotePlayerMesh.group.visible = false;

    if (won) {
      const reward = calculateReward(
        mission.rewards?.credits ?? 500,
        mission.rewards?.score ?? 1000,
        this.missionAirKills,
        this.missionGroundKills,
        this.missionDamageTaken,
        this.missionTimer,
        mission.timeLimitSeconds ?? 300,
        this.missionStartHealth,
      );

      // Apply rewards
      this.economy.credits += reward.credits;
      this.economy.totalScore += reward.score;
      this.economy.missionsCompleted++;
      this.economy.killsAir += this.missionAirKills;
      this.economy.killsGround += this.missionGroundKills;
      saveEconomy(this.economy);

      // Update progress
      const mp = getMissionProgress(this.progress, mission.id);
      mp.completed = true;
      if (!mp.bestGrade || reward.grade < mp.bestGrade) mp.bestGrade = reward.grade;
      if (mp.bestTime === 0 || this.missionTimer < mp.bestTime) mp.bestTime = this.missionTimer;

      // Unlock next mission
      const sorted = [...this.levels].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex(l => l.id === mission.id);
      if (idx >= 0 && idx + 1 < sorted.length) {
        const nextId = sorted[idx + 1].id;
        if (!this.progress.unlockedMissionIds.includes(nextId)) {
          this.progress.unlockedMissionIds.push(nextId);
        }
      }
      saveProgress(this.progress);

      this.missionCompleteUI.showWin(mission.name, reward);
    } else {
      this.missionCompleteUI.showLose(mission.name);
    }

    this.objectiveTracker.hide();
    this.activeMission = null;
  }

  // ─── Multiplayer ─────────────────────────────────────────────────────────────

  private openMultiplayerMenu(): void {
    console.log('[MP] Opening multiplayer menu');

    const cancelAndReturn = () => {
      console.log('[MP] Cancel / cleanup');
      this.peerManager?.disconnect();
      this.peerManager = null;
      this.isMultiplayer = false;
      this.multiplayerMenu.hide();
      this.mainMenu.show();
    };

    const createPeerManager = (): PeerManager => {
      return new PeerManager({
        onHostReady: (code) => {
          console.log('[MP] onHostReady, code:', code);
          this.multiplayerMenu.showHostWaiting(code);
        },
        onConnected: (remotePeerId) => {
          console.log('[MP] onConnected, peer:', remotePeerId);
          this.isMultiplayer = true;
          this.multiplayerMenu.hide();
          // Send our loadout to the remote peer
          const lo: LoadoutPayload = {
            planeId: this.upgrades.loadout.planeId,
            modelPath: `/models/planes/${this.upgrades.loadout.planeId}.glb`,
            weaponSlots: this.upgrades.loadout.weaponSlots.map(ws => ({ slot: ws.slot, weaponId: ws.weaponId })),
            playerName: this.playerName,
          };
          this.peerManager!.send(encode('loadout_sync', lo));
          this.levelSelectUI.show();
        },
        onMessage: (msg) => this.handleNetMessage(msg),
        onDisconnected: (_remotePeerId) => {
          console.log('[MP] Peer disconnected');
          if (this.gameStarted && this.isMultiplayer) {
            this.disconnectOverlay.show();
          }
        },
        onError: (err) => {
          console.error('[MP] PeerManager error:', err);
          this.peerManager = null;
          this.multiplayerMenu.showError('Connection error: ' + err);
        },
      });
    };

    this.multiplayerMenu.show({
      onHost: (username) => {
        console.log('[MP] Host requested, username:', username);
        this.playerName = username;
        // Menu already transitioned to "Connecting to server..." synchronously
        this.peerManager = createPeerManager();
        this.peerManager.hostRoom().catch((err) => {
          console.error('[MP] hostRoom failed:', err);
          this.peerManager = null;
          this.multiplayerMenu.showError('Failed to create room: ' + String(err));
        });
      },
      onJoin: (code, username) => {
        console.log('[MP] Join requested, code:', code, 'username:', username);
        this.playerName = username;
        // Menu already transitioned to "Connecting to host..." synchronously
        this.peerManager = createPeerManager();
        this.peerManager.joinRoom(code).catch((err) => {
          console.error('[MP] joinRoom failed:', err);
          this.peerManager = null;
          this.multiplayerMenu.showError('Failed to join: ' + String(err));
        });
      },
      onBack: () => {
        console.log('[MP] Back to main menu');
        this.mainMenu.show();
      },
      onCancel: () => {
        cancelAndReturn();
      },
    });
  }

  private handleNetMessage(msg: NetMessage): void {
    switch (msg.t) {
      case 'loadout_sync': {
        const lo = msg.d as LoadoutPayload;
        this.spawnRemotePlayer(lo);
        break;
      }
      case 'player_state': {
        const ps = msg.d as PlayerStatePayload;
        pushPlayerSnapshot(this.interpBuffer, msg.ts, ps);
        break;
      }
      case 'enemy_state': {
        const es = msg.d as EnemyStatePayload;
        pushEnemySnapshot(this.interpBuffer, msg.ts, es.enemies);
        break;
      }
      case 'kill_event': {
        const ke = msg.d as KillEventPayload;
        const enemy = this.state.combat.enemies.find(e => e.id === ke.enemyId);
        if (enemy && enemy.aiMode !== 'destroyed') {
          enemy.aiMode = 'destroyed';
          enemy.health = 0;
          enemy.destroyedTimer = 0;
        }
        break;
      }
      case 'mission_start': {
        // Client receives mission start from host (future: auto-sync mission selection)
        break;
      }
      case 'ping': {
        this.peerManager?.send(encode('pong', null));
        break;
      }
      default:
        break;
    }
  }

  private startSyncLoop(): void {
    this.syncTimer.start(20, () => {
      if (!this.peerManager || !this.gameStarted) return;

      // Send our player state
      const ps = packPlayer(this.state.player);
      this.peerManager.send(encode('player_state', ps));

      // Host also broadcasts enemy state
      if (this.peerManager.isHost) {
        const enemies: EnemyNetState[] = this.state.combat.enemies
          .filter(e => e.aiMode !== 'destroyed')
          .map(e => ({
            id: e.id,
            p: e.position,
            r: e.rotation,
            v: e.velocity,
            spd: e.speed,
            hp: e.health,
            mode: e.aiMode,
            isGround: e.isGround,
          }));
        const payload: EnemyStatePayload = { enemies };
        this.peerManager.send(encode('enemy_state', payload));
      }
    });
  }

  private async spawnRemotePlayer(loadout: LoadoutPayload): Promise<void> {
    // Create remote player state
    const rp: RemotePlayerState = {
      peerId: 'remote',
      player: {
        position: { x: 50, y: 2500, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        velocity: { x: 0, y: 0, z: -90 },
        speed: 90,
        altitude: 2500,
        throttle: 1,
        health: 100,
        isStalling: false,
        smoothPitch: 0, smoothYaw: 0, smoothRoll: 0,
        gForce: 1,
        isDead: false,
        crashTimer: 0,
        afterburner: false,
        afterburnerFuel: 1.0,
      },
      planeId: loadout.planeId,
      modelPath: loadout.modelPath,
      playerName: loadout.playerName,
    };

    this.state.remotePlayers = [rp];

    // Create remote player mesh
    this.remotePlayerMesh = new PlayerMesh();
    this.scene.add(this.remotePlayerMesh.group);
    this.remotePlayerMesh.group.visible = false;

    // Try loading remote player's plane model
    try {
      const model = await this.modelLoader.load(loadout.modelPath);
      this.remotePlayerMesh.setModel(model);
    } catch {
      console.warn('[MP] Could not load remote plane model, using primitive.');
    }

    // Reset interpolation buffer
    this.interpBuffer = createInterpBuffer();
  }

  private removeRemotePlayer(): void {
    if (this.remotePlayerMesh) {
      this.scene.remove(this.remotePlayerMesh.group);
      this.remotePlayerMesh = null;
    }
    this.state.remotePlayers = [];
  }

  private applySettings(s: Settings): void {
    console.debug('[Debug][App] Applying settings update');
    this.settings = s;
    saveSettings(s);
    this.renderer.shadowMap.enabled = s.shadows;
    this.sun.castShadow = s.shadows;
    this.postProcessing.setBloomEnabled(s.bloom);
    this.postProcessing.setGodRaysEnabled(s.godRays);
    this.postProcessing.setChromaticAberrationEnabled(s.chromaticAberration);
    this.postProcessing.setVignetteEnabled(s.vignette);
    this.postProcessing.setFXAAEnabled(s.fxaa);
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.density = s.fogDensity;
    }
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

    this.state.input.useMouseAim = this.settings.useMouseAim;
    this.state.combat.difficulty = this.settings.difficulty as Difficulty;
    this.state.combat.seeker.seekDuration = this.settings.seekerDuration;

    // Apply cheats
    if (this.settings.cheatInfCredits) {
      this.economy.credits = 99999;
    }
    if (this.settings.cheatGodMode && this.gameStarted) {
      this.state.player.health = Math.max(this.state.player.health, 100);
      this.state.player.isDead = false;
    }

    // Check if any overlay is up
    const anyOverlay = this.hangarUI.isVisible() || this.levelSelectUI.isVisible()
      || this.settingsUI.isVisible() || this.pauseMenu.isVisible()
      || this.missionCompleteUI.isVisible() || this.multiplayerMenu?.isVisible()
      || this.disconnectOverlay?.isVisible();
    const paused = !this.gameStarted || anyOverlay || this.mainMenu.isVisible();

    if (!paused) {
      // Input
      this.inputManager.update(this.state);
      if (this.state.input.selectSlot > 0) {
        const slotExists = this.state.combat.weaponSlots.some(ws => ws.slot === this.state.input.selectSlot);
        if (slotExists) this.state.combat.selectedSlot = this.state.input.selectSlot;
      }

      // Simulation
      updateFlightPhysics(this.state);
      updateBulletSystem(this.state);
      updateMissileSystem(this.state);
      updateEnemyAI(this.state);
      updateCollisionSystem(this.state);
      updateOOBSystem(this.state);

      // Mission tracking
      if (this.activeMission) {
        this.missionTimer += dt;

        // Count kills
        const destroyed = this.state.combat.enemies.filter(e => e.aiMode === 'destroyed');
        const airDestroyed = destroyed.filter(e => !e.isGround).length;
        const groundDestroyed = destroyed.filter(e => e.isGround).length;
        this.missionAirKills = airDestroyed;
        this.missionGroundKills = groundDestroyed;

        // Track damage
        this.missionDamageTaken = this.missionStartHealth - this.state.player.health;

        // Update objective progress
        if (this.activeMission.objectives) {
          for (const obj of this.activeMission.objectives) {
            if (obj.type === 'destroy_air') {
              this.objectiveTracker.updateProgress(obj.id, airDestroyed);
            } else if (obj.type === 'destroy_ground') {
              this.objectiveTracker.updateProgress(obj.id, groundDestroyed);
            } else if (obj.type === 'survive') {
              this.objectiveTracker.updateProgress(obj.id, this.state.player.isDead ? 0 : 1);
            }
          }
        }

        // Timer
        const timeLimit = this.activeMission.timeLimitSeconds ?? 300;
        this.objectiveTracker.updateTimer(timeLimit - this.missionTimer);

        // Check win condition
        if (this.objectiveTracker.allComplete()) {
          this.completeMission(true);
        }

        // Check time-up loss
        if (this.missionTimer > timeLimit) {
          this.completeMission(false);
        }
      }
    }

    // Crash transitions
    const isDead = this.state.player.isDead;
    if (isDead && !this.wasDead) {
      this.cameraController.shake(3.5);
      this.crashOverlay.style.display = 'flex';
    } else if (!isDead && this.wasDead) {
      this.crashOverlay.style.display = 'none';
      this.cameraController.resetTracking();
    }
    this.wasDead = isDead;

    // Cinematic menu camera when not in game
    if (!this.gameStarted) {
      this.menuCamAngle += dt * 0.08;
      const r = 800;
      const camX = Math.cos(this.menuCamAngle) * r;
      const camZ = Math.sin(this.menuCamAngle) * r;
      this.cameraController.camera.position.set(camX, 400 + Math.sin(this.menuCamAngle * 0.5) * 100, camZ);
      this.cameraController.camera.lookAt(0, 200, 0);
    } else {
      this.playerMesh.group.visible = !isDead;
      this.playerMesh.syncToState(this.state.player);
      this.cameraController.update(this.state, this.playerMesh.group);

      // Remote player interpolation + rendering
      if (this.isMultiplayer && this.remotePlayerMesh && this.state.remotePlayers.length > 0) {
        const rp = this.state.remotePlayers[0];
        const hasData = interpolatePlayer(this.interpBuffer, Date.now(), rp.player);
        this.remotePlayerMesh.group.visible = hasData && !rp.player.isDead;
        if (hasData) {
          this.remotePlayerMesh.syncToState(rp.player);
        }
        // Client: interpolate enemies from host snapshots
        if (this.peerManager?.isClient) {
          interpolateEnemies(this.interpBuffer, Date.now(), this.state.combat.enemies);
        }
      }
    }

    // Shadow camera follow
    if (this.settings.shadows && this.gameStarted) {
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

    // Contrails
    if (this.gameStarted && !isDead) {
      this.contrailSystem.update(
        dt,
        this.playerMesh.group.position,
        this.playerMesh.group.quaternion,
        this.state.player.throttle,
        this.state.player.speed,
        this.state.player.afterburner,
      );
    }

    if (this.gameStarted) {
      this.hud.setVisible(true);
      this.hud.update(this.state, this.cameraController.camera);
    } else {
      this.hud.setVisible(false);
    }

    this.postProcessing.updateSunPosition(this.sun.position);
    this.postProcessing.render();
  };

  private onResize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (w < 1 || h < 1) return; // Guard against 0-size (causes WebGL errors)
    const pr = Math.min(window.devicePixelRatio, 2);
    this.renderer.setSize(w, h);
    this.cameraController.resize(w / h);
    this.postProcessing.resize(w, h, pr);
  };
}
