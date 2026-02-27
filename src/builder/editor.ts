import * as THREE from 'three';
import { setTerrainSeed, getTerrainHeight } from '@/utils/terrain';
import type { MissionData, MissionSpawnAir, MissionSpawnGround, MissionObjective, MissionBounds, DifficultyTuning } from '@/utils/dataLoader';

// ─── Types ───────────────────────────────────────────────────────────────────

export type PlacedObjectType = 'player_spawn' | 'air_enemy' | 'ground_enemy';

export interface PlacedObject {
  id: number;
  type: PlacedObjectType;
  vehicleId: string;
  position: THREE.Vector3;
  mesh: THREE.Mesh;
  // Air enemy specifics
  patrolIndex?: number;
  // Ground enemy specifics
  moving?: boolean;
  patrolRadius?: number;
}

export interface CatalogItem {
  type: PlacedObjectType;
  vehicleId: string;
  label: string;
  description: string;
  color: number;
  icon: string;
  defaultY: number;
}

const CATALOG: CatalogItem[] = [
  { type: 'player_spawn', vehicleId: 'player', label: 'Player Spawn', description: 'Starting position & heading for the player aircraft.', color: 0x00ff88, icon: '✈', defaultY: 2500 },
  { type: 'air_enemy', vehicleId: 'flanker', label: 'Flanker', description: 'Medium jack-of-all-trades aircraft. Guns, missiles, basic countermeasures.', color: 0xff4444, icon: '△', defaultY: 800 },
  { type: 'air_enemy', vehicleId: 'doomsday', label: 'Doomsday', description: 'Bomber with many turrets. No countermeasures. High threat.', color: 0xff6644, icon: '◇', defaultY: 1200 },
  { type: 'air_enemy', vehicleId: 'cobra', label: 'Cobra', description: 'Hypermaneuverable jet. Few missiles, advanced countermeasures.', color: 0xff8844, icon: '◆', defaultY: 600 },
  { type: 'air_enemy', vehicleId: 'axis', label: 'Axis', description: 'Interceptor. Extremely powerful missiles, basic countermeasures.', color: 0xffaa44, icon: '▽', defaultY: 900 },
  { type: 'ground_enemy', vehicleId: 'tank', label: 'Tank', description: 'Armored ground vehicle. Can patrol an area.', color: 0x88aa44, icon: '■', defaultY: 0 },
  { type: 'ground_enemy', vehicleId: 'sam', label: 'SAM Site', description: 'Surface-to-air missile launcher. Stationary threat.', color: 0xaa4444, icon: '▲', defaultY: 0 },
  { type: 'ground_enemy', vehicleId: 'aa_gun', label: 'AA Gun', description: 'Anti-aircraft gun emplacement. Rapid fire.', color: 0xaaaa44, icon: '✦', defaultY: 0 },
  { type: 'ground_enemy', vehicleId: 'boat', label: 'Patrol Boat', description: 'Naval patrol vessel. Spawns in water.', color: 0x4488aa, icon: '⛵', defaultY: 0 },
];

// ─── Default Level Data ──────────────────────────────────────────────────────

function defaultBounds(): MissionBounds {
  return { minX: -8000, maxX: 8000, minZ: -8000, maxZ: 8000, ceiling: 6000, warningMargin: 500 };
}

function defaultDifficulty(): Record<string, DifficultyTuning> {
  return {
    easy:   { airCount: 2, groundCount: 2, enemyHealthMul: 0.7, enemyManeuverMul: 0.6, enemyFireRateMul: 0.5 },
    normal: { airCount: 4, groundCount: 4, enemyHealthMul: 1.0, enemyManeuverMul: 1.0, enemyFireRateMul: 1.0 },
    hard:   { airCount: 6, groundCount: 4, enemyHealthMul: 1.5, enemyManeuverMul: 1.3, enemyFireRateMul: 1.5 },
    ace:    { airCount: 8, groundCount: 6, enemyHealthMul: 2.0, enemyManeuverMul: 1.6, enemyFireRateMul: 2.0 },
  };
}

// ─── Editor ──────────────────────────────────────────────────────────────────

export class LevelEditor {
  // Three.js
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.OrthographicCamera;
  private raycaster = new THREE.Raycaster();
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  // State
  private objects: PlacedObject[] = [];
  private nextId = 1;
  private selectedObject: PlacedObject | null = null;
  private activeCatalogItem: CatalogItem | null = null;
  private isDragging = false;
  private dragOffset = new THREE.Vector3();

  // Camera
  private cameraTarget = new THREE.Vector3(0, 0, 0);
  private cameraZoom = 0.08;
  private cameraAngle = 0; // radians, rotation around Y
  private cameraTilt = -Math.PI / 2; // look-down angle (-PI/2 = top-down)

  // Input
  private keys = new Set<string>();
  private mousePos = new THREE.Vector2();
  private isMiddleDown = false;
  private lastMouseX = 0;
  private lastMouseY = 0;

  // Level metadata
  private levelId = 'custom_level';
  private levelName = 'Custom Level';
  private levelDescription = 'A custom level.';
  private levelBiome = 'plains';
  private terrainSeed = 7742;
  private timeLimitSeconds = 300;
  private bounds = defaultBounds();
  private difficulty = defaultDifficulty();
  private objectives: MissionObjective[] = [
    { id: 'obj1', type: 'destroy_air', count: 3, label: 'Destroy 3 enemy aircraft' },
    { id: 'obj2', type: 'destroy_ground', count: 2, label: 'Destroy 2 ground targets' },
    { id: 'obj3', type: 'survive', label: 'Return alive' },
  ];
  private rewards = { credits: 500, score: 1000 };

  // Terrain mesh
  private terrainMesh: THREE.Mesh | null = null;
  private boundsMesh: THREE.LineSegments | null = null;
  private gridHelper: THREE.GridHelper | null = null;

  // UI elements
  private container!: HTMLDivElement;
  private sidebar!: HTMLDivElement;
  private propPanel!: HTMLDivElement;
  private toolbar!: HTMLDivElement;
  private viewport!: HTMLDivElement;
  private terrainCanvas!: HTMLCanvasElement;
  private statusBar!: HTMLDivElement;

  start(): void {
    this.createUI();
    this.initThree();
    this.buildTerrain();
    this.buildGrid();
    this.buildBounds();
    this.bindInput();
    this.animate();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── UI Creation ───────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════

  private createUI(): void {
    const root = document.getElementById('editor-root')!;
    root.innerHTML = '';

    // Inject styles
    const style = document.createElement('style');
    style.textContent = `
      .ed-toolbar {
        height: 48px; background: #12122a; display: flex; align-items: center;
        padding: 0 12px; gap: 8px; border-bottom: 1px solid #2a2a4a;
        flex-shrink: 0; z-index: 10;
      }
      .ed-toolbar button, .ed-toolbar input, .ed-toolbar select {
        font-family: 'Courier New', monospace; font-size: 12px; color: #e0e0e0;
        background: #1e1e3a; border: 1px solid #3a3a5a; padding: 6px 12px;
        cursor: pointer; border-radius: 3px; transition: all 0.15s;
      }
      .ed-toolbar button:hover { background: #2a2a5a; border-color: #5a5a8a; }
      .ed-toolbar .sep { width: 1px; height: 28px; background: #2a2a4a; margin: 0 4px; }
      .ed-toolbar label { font-size: 11px; opacity: 0.6; margin-right: 4px; }
      .ed-toolbar input[type="text"], .ed-toolbar input[type="number"] { width: 80px; }
      .ed-body { display: flex; flex: 1; overflow: hidden; }
      .ed-sidebar {
        width: 220px; background: #14142e; overflow-y: auto; flex-shrink: 0;
        border-right: 1px solid #2a2a4a; padding: 8px;
      }
      .ed-sidebar h3 {
        font-size: 11px; text-transform: uppercase; letter-spacing: 2px;
        opacity: 0.5; margin: 12px 0 6px; padding: 0 4px;
      }
      .cat-item {
        display: flex; align-items: center; gap: 8px; padding: 8px;
        border: 1px solid transparent; border-radius: 4px; cursor: pointer;
        transition: all 0.15s; position: relative; margin-bottom: 2px;
      }
      .cat-item:hover { background: rgba(255,255,255,0.05); border-color: #3a3a5a; }
      .cat-item.active { background: rgba(100,140,255,0.15); border-color: rgba(100,140,255,0.5); }
      .cat-icon {
        width: 32px; height: 32px; border-radius: 4px; display: flex;
        align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0;
      }
      .cat-label { font-size: 12px; font-weight: bold; }
      .cat-desc { font-size: 10px; opacity: 0.5; margin-top: 2px; }
      .cat-tooltip {
        display: none; position: absolute; left: 100%; top: 0; width: 200px;
        background: #1a1a3a; border: 1px solid #3a3a5a; border-radius: 4px;
        padding: 10px; font-size: 11px; z-index: 100; pointer-events: none;
      }
      .cat-item:hover .cat-tooltip { display: block; }
      .ed-viewport { flex: 1; position: relative; overflow: hidden; }
      .ed-viewport canvas { width: 100%; height: 100%; }
      .ed-propanel {
        width: 260px; background: #14142e; overflow-y: auto; flex-shrink: 0;
        border-left: 1px solid #2a2a4a; padding: 12px;
      }
      .ed-propanel h3 {
        font-size: 11px; text-transform: uppercase; letter-spacing: 2px;
        opacity: 0.5; margin: 12px 0 6px;
      }
      .ed-propanel label { font-size: 11px; opacity: 0.7; display: block; margin-top: 8px; }
      .ed-propanel input, .ed-propanel select {
        width: 100%; padding: 5px 8px; margin-top: 3px;
        background: #1e1e3a; border: 1px solid #3a3a5a; border-radius: 3px;
        color: #e0e0e0; font-family: 'Courier New', monospace; font-size: 12px;
      }
      .ed-propanel .row { display: flex; gap: 6px; }
      .ed-propanel .row > div { flex: 1; }
      .prop-delete {
        margin-top: 12px; padding: 6px; width: 100%; background: #3a1a1a;
        border: 1px solid #5a2a2a; color: #ff6666; border-radius: 3px;
        cursor: pointer; font-family: 'Courier New', monospace; font-size: 12px;
      }
      .prop-delete:hover { background: #4a2020; }
      .ed-status {
        height: 24px; background: #0e0e20; display: flex; align-items: center;
        padding: 0 12px; font-size: 10px; opacity: 0.5; flex-shrink: 0;
        border-top: 1px solid #2a2a4a;
      }
      .terrain-preview-wrap { margin-top: 8px; }
      .terrain-preview-wrap canvas {
        width: 100%; height: 120px; border: 1px solid #3a3a5a; border-radius: 3px;
        image-rendering: pixelated;
      }
      .obj-list-item {
        display: flex; align-items: center; gap: 6px; padding: 4px 6px;
        border-radius: 3px; cursor: pointer; font-size: 11px; margin-bottom: 2px;
      }
      .obj-list-item:hover { background: rgba(255,255,255,0.05); }
      .obj-list-item.selected { background: rgba(100,140,255,0.2); }
      .obj-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    `;
    root.appendChild(style);

    // Toolbar
    this.toolbar = document.createElement('div');
    this.toolbar.className = 'ed-toolbar';
    this.toolbar.innerHTML = `
      <button id="ed-new" title="New Level">New</button>
      <button id="ed-import" title="Import JSON">Import</button>
      <button id="ed-export" title="Export JSON">Export</button>
      <div class="sep"></div>
      <button id="ed-test" title="Test in Game" style="color:#88ff88;border-color:#4a8a4a;">▶ Test</button>
      <div class="sep"></div>
      <label>Seed:</label>
      <input type="number" id="ed-seed" value="${this.terrainSeed}" style="width:70px;" />
      <label>Name:</label>
      <input type="text" id="ed-name" value="${this.levelName}" style="width:140px;" />
      <div class="sep"></div>
      <label>Bounds:</label>
      <input type="number" id="ed-bounds" value="${this.bounds.maxX}" style="width:60px;" title="Half-size of the play area" />
      <label>Ceiling:</label>
      <input type="number" id="ed-ceiling" value="${this.bounds.ceiling}" style="width:60px;" />
      <div style="flex:1;"></div>
      <button id="ed-back" title="Back to Game">← Back</button>
    `;
    root.appendChild(this.toolbar);

    // Body (sidebar + viewport + property panel)
    const body = document.createElement('div');
    body.className = 'ed-body';
    root.appendChild(body);

    // Sidebar
    this.sidebar = document.createElement('div');
    this.sidebar.className = 'ed-sidebar';
    this.buildCatalog();
    body.appendChild(this.sidebar);

    // Viewport
    this.viewport = document.createElement('div');
    this.viewport.className = 'ed-viewport';
    body.appendChild(this.viewport);

    // Property panel
    this.propPanel = document.createElement('div');
    this.propPanel.className = 'ed-propanel';
    this.updatePropPanel();
    body.appendChild(this.propPanel);

    // Status bar
    this.statusBar = document.createElement('div');
    this.statusBar.className = 'ed-status';
    this.statusBar.textContent = 'Ready — Click catalog item then click grid to place. WASD: Pan | Scroll: Zoom | Right-drag: Rotate';
    root.appendChild(this.statusBar);

    // Toolbar events
    this.toolbar.querySelector('#ed-new')!.addEventListener('click', () => this.newLevel());
    this.toolbar.querySelector('#ed-import')!.addEventListener('click', () => this.importLevel());
    this.toolbar.querySelector('#ed-export')!.addEventListener('click', () => this.exportLevel());
    this.toolbar.querySelector('#ed-test')!.addEventListener('click', () => this.testLevel());
    this.toolbar.querySelector('#ed-back')!.addEventListener('click', () => {
      window.location.href = '/';
    });

    const seedInput = this.toolbar.querySelector('#ed-seed') as HTMLInputElement;
    seedInput.addEventListener('change', () => {
      this.terrainSeed = parseInt(seedInput.value) || 0;
      this.buildTerrain();
      this.updateTerrainPreview();
    });

    const nameInput = this.toolbar.querySelector('#ed-name') as HTMLInputElement;
    nameInput.addEventListener('change', () => { this.levelName = nameInput.value; });

    const boundsInput = this.toolbar.querySelector('#ed-bounds') as HTMLInputElement;
    boundsInput.addEventListener('change', () => {
      const v = parseInt(boundsInput.value) || 8000;
      this.bounds = { minX: -v, maxX: v, minZ: -v, maxZ: v, ceiling: this.bounds.ceiling, warningMargin: 500 };
      this.buildBounds();
    });

    const ceilInput = this.toolbar.querySelector('#ed-ceiling') as HTMLInputElement;
    ceilInput.addEventListener('change', () => {
      this.bounds.ceiling = parseInt(ceilInput.value) || 6000;
    });
  }

  private buildCatalog(): void {
    this.sidebar.innerHTML = '';

    // Catalog section
    const catTitle = document.createElement('h3');
    catTitle.textContent = 'Object Catalog';
    this.sidebar.appendChild(catTitle);

    for (const item of CATALOG) {
      const div = document.createElement('div');
      div.className = 'cat-item';
      div.dataset.vehicleId = item.vehicleId;
      div.innerHTML = `
        <div class="cat-icon" style="background:${hexCss(item.color)}22;color:${hexCss(item.color)};">${item.icon}</div>
        <div>
          <div class="cat-label">${item.label}</div>
          <div class="cat-desc">${item.type.replace('_', ' ')}</div>
        </div>
        <div class="cat-tooltip">${item.description}<br><br><b>Click</b> then click grid to place.</div>
      `;
      div.addEventListener('click', () => {
        this.activeCatalogItem = item;
        this.selectedObject = null;
        this.updateCatalogSelection();
        this.updatePropPanel();
        this.setStatus(`Placing: ${item.label} — Click on the map to place.`);
      });
      this.sidebar.appendChild(div);
    }

    // Placed objects list
    const listTitle = document.createElement('h3');
    listTitle.textContent = 'Placed Objects';
    listTitle.style.marginTop = '20px';
    this.sidebar.appendChild(listTitle);

    const listContainer = document.createElement('div');
    listContainer.id = 'ed-obj-list';
    this.sidebar.appendChild(listContainer);

    // Terrain preview
    const terrainTitle = document.createElement('h3');
    terrainTitle.textContent = 'Terrain Preview';
    terrainTitle.style.marginTop = '20px';
    this.sidebar.appendChild(terrainTitle);

    const previewWrap = document.createElement('div');
    previewWrap.className = 'terrain-preview-wrap';
    this.terrainCanvas = document.createElement('canvas');
    this.terrainCanvas.width = 128;
    this.terrainCanvas.height = 128;
    previewWrap.appendChild(this.terrainCanvas);
    this.sidebar.appendChild(previewWrap);

    this.updateTerrainPreview();
  }

  private updateCatalogSelection(): void {
    this.sidebar.querySelectorAll('.cat-item').forEach(el => {
      const div = el as HTMLDivElement;
      div.classList.toggle('active', div.dataset.vehicleId === this.activeCatalogItem?.vehicleId);
    });
  }

  private updateObjectList(): void {
    const list = document.getElementById('ed-obj-list');
    if (!list) return;
    list.innerHTML = '';
    for (const obj of this.objects) {
      const cat = CATALOG.find(c => c.vehicleId === obj.vehicleId);
      const div = document.createElement('div');
      div.className = 'obj-list-item' + (this.selectedObject === obj ? ' selected' : '');
      div.innerHTML = `<div class="obj-dot" style="background:${hexCss(cat?.color ?? 0xffffff)}"></div>
        <span>${cat?.label ?? obj.vehicleId} #${obj.id}</span>`;
      div.addEventListener('click', () => {
        this.selectObject(obj);
      });
      list.appendChild(div);
    }
  }

  private updateTerrainPreview(): void {
    setTerrainSeed(this.terrainSeed);
    const ctx = this.terrainCanvas.getContext('2d')!;
    const w = this.terrainCanvas.width;
    const h = this.terrainCanvas.height;
    const halfSize = this.bounds.maxX;
    const img = ctx.createImageData(w, h);
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const wx = (px / w - 0.5) * 2 * halfSize;
        const wz = (py / h - 0.5) * 2 * halfSize;
        const ht = getTerrainHeight(wx, wz);
        const n = Math.max(0, Math.min(255, (ht / 3200) * 255 + 60));
        const i = (py * w + px) * 4;
        if (ht <= 0) {
          // Water
          img.data[i] = 20;
          img.data[i + 1] = 40 + n * 0.3;
          img.data[i + 2] = 80 + n * 0.5;
        } else {
          // Land
          img.data[i] = 30 + n * 0.3;
          img.data[i + 1] = 50 + n * 0.7;
          img.data[i + 2] = 20 + n * 0.2;
        }
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── Property Panel ────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════

  private updatePropPanel(): void {
    const p = this.propPanel;
    if (!this.selectedObject) {
      p.innerHTML = `
        <h3>Level Properties</h3>
        <label>ID</label><input id="pp-id" value="${this.levelId}" />
        <label>Description</label><input id="pp-desc" value="${this.levelDescription}" />
        <label>Biome</label>
        <select id="pp-biome">
          <option value="plains" ${this.levelBiome === 'plains' ? 'selected' : ''}>Plains</option>
          <option value="desert" ${this.levelBiome === 'desert' ? 'selected' : ''}>Desert</option>
          <option value="arctic" ${this.levelBiome === 'arctic' ? 'selected' : ''}>Arctic</option>
          <option value="islands" ${this.levelBiome === 'islands' ? 'selected' : ''}>Islands</option>
        </select>
        <label>Time Limit (sec)</label><input type="number" id="pp-time" value="${this.timeLimitSeconds}" />
        <label>Credits Reward</label><input type="number" id="pp-credits" value="${this.rewards.credits}" />
        <label>Score Reward</label><input type="number" id="pp-score" value="${this.rewards.score}" />
        <h3 style="margin-top:16px;">Difficulty</h3>
        <label>Normal: Air / Ground</label>
        <div class="row">
          <div><input type="number" id="pp-air-n" value="${this.difficulty.normal.airCount}" /></div>
          <div><input type="number" id="pp-gnd-n" value="${this.difficulty.normal.groundCount}" /></div>
        </div>
        <label>Hard: Air / Ground</label>
        <div class="row">
          <div><input type="number" id="pp-air-h" value="${this.difficulty.hard.airCount}" /></div>
          <div><input type="number" id="pp-gnd-h" value="${this.difficulty.hard.groundCount}" /></div>
        </div>

        <h3 style="margin-top:16px;">Statistics</h3>
        <div style="font-size:11px;opacity:0.7;line-height:1.8;">
          Air enemies: ${this.objects.filter(o => o.type === 'air_enemy').length}<br>
          Ground enemies: ${this.objects.filter(o => o.type === 'ground_enemy').length}<br>
          Player spawns: ${this.objects.filter(o => o.type === 'player_spawn').length}<br>
          Total objects: ${this.objects.length}
        </div>
      `;
      // Bind level prop events
      const bind = (id: string, cb: (v: string) => void) => {
        const el = p.querySelector('#' + id) as HTMLInputElement;
        if (el) el.addEventListener('change', () => cb(el.value));
      };
      bind('pp-id', v => { this.levelId = v; });
      bind('pp-desc', v => { this.levelDescription = v; });
      bind('pp-biome', v => { this.levelBiome = v; });
      bind('pp-time', v => { this.timeLimitSeconds = parseInt(v) || 300; });
      bind('pp-credits', v => { this.rewards.credits = parseInt(v) || 0; });
      bind('pp-score', v => { this.rewards.score = parseInt(v) || 0; });
      bind('pp-air-n', v => { this.difficulty.normal.airCount = parseInt(v) || 4; });
      bind('pp-gnd-n', v => { this.difficulty.normal.groundCount = parseInt(v) || 4; });
      bind('pp-air-h', v => { this.difficulty.hard.airCount = parseInt(v) || 6; });
      bind('pp-gnd-h', v => { this.difficulty.hard.groundCount = parseInt(v) || 4; });
      return;
    }

    const obj = this.selectedObject;
    const cat = CATALOG.find(c => c.vehicleId === obj.vehicleId);
    p.innerHTML = `
      <h3>${cat?.icon ?? '?'} ${cat?.label ?? obj.vehicleId}</h3>
      <label>Type</label><input value="${obj.type.replace('_', ' ')}" disabled />
      <label>Vehicle ID</label>
      <select id="pp-vehicle">${this.getVehicleOptions(obj)}</select>
      <label>Position X</label><input type="number" id="pp-px" value="${Math.round(obj.position.x)}" />
      <label>Position Y (altitude)</label><input type="number" id="pp-py" value="${Math.round(obj.position.y)}" />
      <label>Position Z</label><input type="number" id="pp-pz" value="${Math.round(obj.position.z)}" />
      ${obj.type === 'air_enemy' ? `
        <label>Patrol Index</label><input type="number" id="pp-patrol" value="${obj.patrolIndex ?? 0}" min="0" max="7" />
      ` : ''}
      ${obj.type === 'ground_enemy' ? `
        <label>Moving</label>
        <select id="pp-moving">
          <option value="true" ${obj.moving ? 'selected' : ''}>Yes</option>
          <option value="false" ${!obj.moving ? 'selected' : ''}>No</option>
        </select>
        <label>Patrol Radius</label><input type="number" id="pp-pradius" value="${obj.patrolRadius ?? 0}" />
      ` : ''}
      <button class="prop-delete" id="pp-delete">Delete Object</button>
    `;

    const bind = (id: string, cb: (v: string) => void) => {
      const el = p.querySelector('#' + id) as HTMLInputElement;
      if (el) el.addEventListener('change', () => cb(el.value));
    };
    bind('pp-vehicle', v => { obj.vehicleId = v; this.updateObjectMesh(obj); this.updateObjectList(); });
    bind('pp-px', v => { obj.position.x = parseFloat(v) || 0; obj.mesh.position.x = obj.position.x; });
    bind('pp-py', v => { 
      obj.position.y = parseFloat(v) || 0;
      // Update mesh Y: air enemies show at actual altitude, ground enemies offset
      if (obj.type === 'air_enemy') {
        obj.mesh.position.y = obj.position.y;
      } else if (obj.type === 'ground_enemy') {
        obj.mesh.position.y = obj.position.y + 20;
      }
    });
    bind('pp-pz', v => { obj.position.z = parseFloat(v) || 0; obj.mesh.position.z = obj.position.z; });
    bind('pp-patrol', v => { obj.patrolIndex = parseInt(v) || 0; });
    bind('pp-moving', v => { obj.moving = v === 'true'; });
    bind('pp-pradius', v => { obj.patrolRadius = parseInt(v) || 0; });

    p.querySelector('#pp-delete')?.addEventListener('click', () => {
      this.deleteObject(obj);
    });
  }

  private getVehicleOptions(obj: PlacedObject): string {
    const items = CATALOG.filter(c => c.type === obj.type);
    return items.map(c =>
      `<option value="${c.vehicleId}" ${c.vehicleId === obj.vehicleId ? 'selected' : ''}>${c.label}</option>`
    ).join('');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── Three.js Init ─────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════

  private initThree(): void {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setClearColor(0x0a0a1e);
    this.viewport.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x0a0a1e, 0.00003);

    // Orthographic camera
    const aspect = this.viewport.clientWidth / this.viewport.clientHeight;
    const frustum = 1000;
    this.camera = new THREE.OrthographicCamera(
      -frustum * aspect, frustum * aspect,
      frustum, -frustum, 0.1, 50000,
    );
    this.updateCameraPosition();

    // Lighting
    const ambient = new THREE.AmbientLight(0x667799, 0.6);
    this.scene.add(ambient);
    const sun = new THREE.DirectionalLight(0xffeedd, 1.0);
    sun.position.set(5000, 8000, 3000);
    this.scene.add(sun);

    // Resize
    const resize = () => {
      const w = this.viewport.clientWidth;
      const h = this.viewport.clientHeight;
      this.renderer.setSize(w, h);
      const a = w / h;
      const f = 1000 / this.cameraZoom;
      this.camera.left = -f * a;
      this.camera.right = f * a;
      this.camera.top = f;
      this.camera.bottom = -f;
      this.camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', resize);
    requestAnimationFrame(resize);
  }

  private updateCameraPosition(): void {
    const dist = 15000;
    const cx = this.cameraTarget.x + Math.sin(this.cameraAngle) * Math.cos(this.cameraTilt) * dist;
    const cy = this.cameraTarget.y + Math.sin(-this.cameraTilt) * dist;
    const cz = this.cameraTarget.z + Math.cos(this.cameraAngle) * Math.cos(this.cameraTilt) * dist;
    this.camera.position.set(cx, cy, cz);
    this.camera.lookAt(this.cameraTarget);

    const a = this.viewport.clientWidth / Math.max(this.viewport.clientHeight, 1);
    const f = 1000 / this.cameraZoom;
    this.camera.left = -f * a;
    this.camera.right = f * a;
    this.camera.top = f;
    this.camera.bottom = -f;
    this.camera.updateProjectionMatrix();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── Terrain & Grid ────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════

  private buildTerrain(): void {
    if (this.terrainMesh) {
      this.scene.remove(this.terrainMesh);
      this.terrainMesh.geometry.dispose();
      (this.terrainMesh.material as THREE.Material).dispose();
    }

    setTerrainSeed(this.terrainSeed);

    const size = 16000;
    const segs = 200;
    const geo = new THREE.PlaneGeometry(size, size, segs, segs);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = getTerrainHeight(x, z);
      pos.setY(i, Math.max(h, -5));

      // Color by height
      const t = Math.max(0, Math.min(1, h / 2000));
      if (h <= 0) {
        colors[i * 3] = 0.1; colors[i * 3 + 1] = 0.2 + t * 0.3; colors[i * 3 + 2] = 0.4 + t * 0.2;
      } else if (t < 0.15) {
        colors[i * 3] = 0.15 + t; colors[i * 3 + 1] = 0.35 + t * 2; colors[i * 3 + 2] = 0.1;
      } else if (t < 0.5) {
        colors[i * 3] = 0.2 + t * 0.3; colors[i * 3 + 1] = 0.25 + t * 0.5; colors[i * 3 + 2] = 0.1;
      } else {
        colors[i * 3] = 0.4 + t * 0.4; colors[i * 3 + 1] = 0.38 + t * 0.4; colors[i * 3 + 2] = 0.35 + t * 0.4;
      }
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    this.terrainMesh = new THREE.Mesh(geo, mat);
    this.scene.add(this.terrainMesh);

    // Water plane
    const waterGeo = new THREE.PlaneGeometry(20000, 20000);
    waterGeo.rotateX(-Math.PI / 2);
    const waterMat = new THREE.MeshLambertMaterial({ color: 0x1a3a5a, transparent: true, opacity: 0.6 });
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.position.y = -2;
    water.name = 'water';
    // Remove old water
    const oldWater = this.scene.getObjectByName('water');
    if (oldWater) this.scene.remove(oldWater);
    this.scene.add(water);
  }

  private buildGrid(): void {
    if (this.gridHelper) this.scene.remove(this.gridHelper);
    this.gridHelper = new THREE.GridHelper(16000, 160, 0x2a2a4a, 0x1a1a3a);
    this.gridHelper.position.y = 1;
    this.scene.add(this.gridHelper);
  }

  private buildBounds(): void {
    if (this.boundsMesh) {
      this.scene.remove(this.boundsMesh);
      this.boundsMesh.geometry.dispose();
    }
    const b = this.bounds;
    const h = b.ceiling;
    const verts = new Float32Array([
      b.minX, 0, b.minZ, b.maxX, 0, b.minZ,
      b.maxX, 0, b.minZ, b.maxX, 0, b.maxZ,
      b.maxX, 0, b.maxZ, b.minX, 0, b.maxZ,
      b.minX, 0, b.maxZ, b.minX, 0, b.minZ,
      // top
      b.minX, h, b.minZ, b.maxX, h, b.minZ,
      b.maxX, h, b.minZ, b.maxX, h, b.maxZ,
      b.maxX, h, b.maxZ, b.minX, h, b.maxZ,
      b.minX, h, b.maxZ, b.minX, h, b.minZ,
      // verticals
      b.minX, 0, b.minZ, b.minX, h, b.minZ,
      b.maxX, 0, b.minZ, b.maxX, h, b.minZ,
      b.maxX, 0, b.maxZ, b.maxX, h, b.maxZ,
      b.minX, 0, b.maxZ, b.minX, h, b.maxZ,
    ]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    const mat = new THREE.LineBasicMaterial({ color: 0x4488ff, transparent: true, opacity: 0.4 });
    this.boundsMesh = new THREE.LineSegments(geo, mat);
    this.scene.add(this.boundsMesh);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── Object Management ─────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════

  private createObjectMesh(item: CatalogItem): THREE.Mesh {
    let geo: THREE.BufferGeometry;
    if (item.type === 'player_spawn') {
      geo = new THREE.ConeGeometry(60, 120, 4);
      geo.rotateX(Math.PI / 2);
    } else if (item.type === 'air_enemy') {
      geo = new THREE.ConeGeometry(40, 100, 4);
      geo.rotateX(Math.PI / 2);
    } else {
      geo = new THREE.BoxGeometry(60, 40, 60);
    }
    const mat = new THREE.MeshLambertMaterial({ color: item.color, emissive: item.color, emissiveIntensity: 0.3 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = false;
    return mesh;
  }

  private placeObject(item: CatalogItem, worldPos: THREE.Vector3): PlacedObject {
    // Only one player spawn allowed
    if (item.type === 'player_spawn') {
      const existing = this.objects.find(o => o.type === 'player_spawn');
      if (existing) {
        existing.position.copy(worldPos);
        existing.position.y = item.defaultY;
        existing.mesh.position.set(worldPos.x, 10, worldPos.z);
        this.updateObjectList();
        this.selectObject(existing);
        return existing;
      }
    }

    // Determine actual Y position
    let actualY = item.defaultY;
    let meshY = 50; // Visual height above ground for air, slight offset for ground
    
    if (item.type === 'ground_enemy') {
      // Sample terrain height for ground objects
      if (item.vehicleId === 'boat' || item.vehicleId === 'cruiser' || item.vehicleId === 'carrier') {
        // Naval vessels: place at sea level (0), not seabed
        actualY = 0;
        meshY = 20; // Slight visual offset above water
      } else {
        // Land vehicles: use terrain height
        actualY = getTerrainHeight(worldPos.x, worldPos.z);
        meshY = actualY + 20; // Slight visual offset above terrain
      }
    } else if (item.type === 'air_enemy') {
      // Air enemies: mesh Y = actual altitude for proper visualization
      meshY = actualY;
    }

    const mesh = this.createObjectMesh(item);
    mesh.position.set(worldPos.x, meshY, worldPos.z);
    this.scene.add(mesh);

    const obj: PlacedObject = {
      id: this.nextId++,
      type: item.type,
      vehicleId: item.vehicleId,
      position: new THREE.Vector3(worldPos.x, actualY, worldPos.z),
      mesh,
      patrolIndex: item.type === 'air_enemy' ? 0 : undefined,
      moving: item.type === 'ground_enemy' ? false : undefined,
      patrolRadius: item.type === 'ground_enemy' ? 0 : undefined,
    };
    mesh.userData.objectId = obj.id;
    this.objects.push(obj);
    this.updateObjectList();
    this.selectObject(obj);
    return obj;
  }

  private selectObject(obj: PlacedObject): void {
    // Deselect previous
    if (this.selectedObject) {
      const cat = CATALOG.find(c => c.vehicleId === this.selectedObject!.vehicleId);
      (this.selectedObject.mesh.material as THREE.MeshLambertMaterial).emissiveIntensity = 0.3;
      if (cat) (this.selectedObject.mesh.material as THREE.MeshLambertMaterial).emissive.setHex(cat.color);
    }
    this.selectedObject = obj;
    this.activeCatalogItem = null;
    this.updateCatalogSelection();
    // Highlight
    (obj.mesh.material as THREE.MeshLambertMaterial).emissive.setHex(0xffffff);
    (obj.mesh.material as THREE.MeshLambertMaterial).emissiveIntensity = 0.5;
    this.updatePropPanel();
    this.updateObjectList();
    this.setStatus(`Selected: ${obj.vehicleId} #${obj.id}`);
  }

  private deleteObject(obj: PlacedObject): void {
    this.scene.remove(obj.mesh);
    obj.mesh.geometry.dispose();
    (obj.mesh.material as THREE.Material).dispose();
    this.objects = this.objects.filter(o => o !== obj);
    if (this.selectedObject === obj) this.selectedObject = null;
    this.updateObjectList();
    this.updatePropPanel();
    this.setStatus(`Deleted: ${obj.vehicleId} #${obj.id}`);
  }

  private updateObjectMesh(obj: PlacedObject): void {
    const cat = CATALOG.find(c => c.vehicleId === obj.vehicleId);
    if (cat) {
      (obj.mesh.material as THREE.MeshLambertMaterial).color.setHex(cat.color);
      (obj.mesh.material as THREE.MeshLambertMaterial).emissive.setHex(cat.color);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── Input Handling ────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════

  private bindInput(): void {
    const canvas = this.renderer.domElement;

    window.addEventListener('keydown', e => {
      this.keys.add(e.key.toLowerCase());
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (this.selectedObject) this.deleteObject(this.selectedObject);
      }
      if (e.key === 'Escape') {
        this.activeCatalogItem = null;
        this.selectedObject = null;
        this.updateCatalogSelection();
        this.updatePropPanel();
        this.setStatus('Selection cleared.');
      }
    });
    window.addEventListener('keyup', e => { this.keys.delete(e.key.toLowerCase()); });

    canvas.addEventListener('mousedown', e => {
      if (e.button === 2) {
        // Right click: rotate camera
        this.isMiddleDown = true;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        e.preventDefault();
        return;
      }
      if (e.button === 0) {
        this.handleLeftClick(e);
      }
    });

    canvas.addEventListener('mousemove', e => {
      const rect = canvas.getBoundingClientRect();
      this.mousePos.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mousePos.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      if (this.isMiddleDown) {
        const dx = e.clientX - this.lastMouseX;
        const dy = e.clientY - this.lastMouseY;
        this.cameraAngle += dx * 0.005;
        this.cameraTilt = Math.max(-Math.PI / 2, Math.min(-0.1, this.cameraTilt + dy * 0.005));
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        this.updateCameraPosition();
        return;
      }

      if (this.isDragging && this.selectedObject) {
        const worldPos = this.getWorldPosFromMouse();
        if (worldPos) {
          this.selectedObject.position.x = worldPos.x;
          this.selectedObject.position.z = worldPos.z;
          this.selectedObject.mesh.position.x = worldPos.x;
          this.selectedObject.mesh.position.z = worldPos.z;
          
          // Update Y for ground objects based on terrain
          if (this.selectedObject.type === 'ground_enemy') {
            const terrainY = getTerrainHeight(worldPos.x, worldPos.z);
            this.selectedObject.position.y = terrainY;
            this.selectedObject.mesh.position.y = terrainY + 20;
          }
        }
      }
    });

    canvas.addEventListener('mouseup', e => {
      if (e.button === 2) this.isMiddleDown = false;
      if (e.button === 0 && this.isDragging) {
        this.isDragging = false;
        this.updatePropPanel();
      }
    });

    canvas.addEventListener('wheel', e => {
      this.cameraZoom *= e.deltaY > 0 ? 0.9 : 1.1;
      this.cameraZoom = Math.max(0.005, Math.min(0.5, this.cameraZoom));
      this.updateCameraPosition();
      e.preventDefault();
    }, { passive: false });

    canvas.addEventListener('contextmenu', e => e.preventDefault());
  }

  private handleLeftClick(e: MouseEvent): void {
    const worldPos = this.getWorldPosFromMouse();
    if (!worldPos) return;

    // If catalog item is active, place it
    if (this.activeCatalogItem) {
      this.placeObject(this.activeCatalogItem, worldPos);
      return;
    }

    // Otherwise, try to select an existing object via raycasting
    this.raycaster.setFromCamera(this.mousePos, this.camera);
    const meshes = this.objects.map(o => o.mesh);
    const hits = this.raycaster.intersectObjects(meshes, false);
    if (hits.length > 0) {
      const hitMesh = hits[0].object as THREE.Mesh;
      const obj = this.objects.find(o => o.mesh === hitMesh);
      if (obj) {
        this.selectObject(obj);
        this.isDragging = true;
        return;
      }
    }

    // Clicked empty space — deselect
    this.selectedObject = null;
    this.updatePropPanel();
    this.updateObjectList();
  }

  private getWorldPosFromMouse(): THREE.Vector3 | null {
    this.raycaster.setFromCamera(this.mousePos, this.camera);
    const target = new THREE.Vector3();
    const hit = this.raycaster.ray.intersectPlane(this.groundPlane, target);
    return hit;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── Import / Export / Test ────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════

  private exportLevel(): MissionData {
    const playerSpawn = this.objects.find(o => o.type === 'player_spawn');
    const airEnemies: MissionSpawnAir[] = this.objects
      .filter(o => o.type === 'air_enemy')
      .map(o => ({
        vehicleId: o.vehicleId,
        position: { x: Math.round(o.position.x), y: Math.round(o.position.y), z: Math.round(o.position.z) },
        patrolIndex: o.patrolIndex ?? 0,
      }));
    const groundEnemies: MissionSpawnGround[] = this.objects
      .filter(o => o.type === 'ground_enemy')
      .map(o => ({
        vehicleId: o.vehicleId,
        position: { x: Math.round(o.position.x), y: Math.round(o.position.y), z: Math.round(o.position.z) },
        moving: o.moving ?? false,
        patrolRadius: o.patrolRadius ?? 0,
      }));

    const data: MissionData = {
      id: this.levelId,
      name: this.levelName,
      description: this.levelDescription,
      biome: this.levelBiome,
      terrainSeed: this.terrainSeed,
      objectives: [...this.objectives],
      rewards: { ...this.rewards },
      timeLimitSeconds: this.timeLimitSeconds,
      bounds: { ...this.bounds },
      playerSpawn: {
        position: playerSpawn
          ? { x: Math.round(playerSpawn.position.x), y: Math.round(playerSpawn.position.y), z: Math.round(playerSpawn.position.z) }
          : { x: 0, y: 2500, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        speed: 90,
      },
      airEnemies,
      groundEnemies,
      difficulty: JSON.parse(JSON.stringify(this.difficulty)),
    };

    // Download as JSON
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.levelId}.json`;
    a.click();
    URL.revokeObjectURL(url);

    this.setStatus(`Exported: ${this.levelId}.json (${airEnemies.length} air, ${groundEnemies.length} ground)`);
    return data;
  }

  private importLevel(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result as string) as MissionData;
          this.loadMissionData(data);
          this.setStatus(`Imported: ${data.name} (${data.airEnemies.length} air, ${data.groundEnemies.length} ground)`);
        } catch (err) {
          this.setStatus(`Import failed: ${err}`);
        }
      };
      reader.readAsText(file);
    });
    input.click();
  }

  private loadMissionData(data: MissionData): void {
    // Clear existing objects
    for (const obj of this.objects) {
      this.scene.remove(obj.mesh);
      obj.mesh.geometry.dispose();
      (obj.mesh.material as THREE.Material).dispose();
    }
    this.objects = [];
    this.nextId = 1;
    this.selectedObject = null;

    // Load metadata
    this.levelId = data.id;
    this.levelName = data.name;
    this.levelDescription = data.description;
    this.levelBiome = data.biome ?? 'plains';
    this.terrainSeed = data.terrainSeed;
    this.timeLimitSeconds = data.timeLimitSeconds ?? 300;
    this.bounds = { ...data.bounds };
    this.difficulty = JSON.parse(JSON.stringify(data.difficulty));
    if (data.rewards) this.rewards = { ...data.rewards };
    if (data.objectives) this.objectives = [...data.objectives];

    // Update UI inputs
    (this.toolbar.querySelector('#ed-seed') as HTMLInputElement).value = String(this.terrainSeed);
    (this.toolbar.querySelector('#ed-name') as HTMLInputElement).value = this.levelName;
    (this.toolbar.querySelector('#ed-bounds') as HTMLInputElement).value = String(this.bounds.maxX);
    (this.toolbar.querySelector('#ed-ceiling') as HTMLInputElement).value = String(this.bounds.ceiling);

    // Rebuild terrain
    this.buildTerrain();
    this.buildBounds();
    this.updateTerrainPreview();

    // Place player spawn
    const ps = data.playerSpawn;
    const playerCat = CATALOG.find(c => c.type === 'player_spawn')!;
    const playerMesh = this.createObjectMesh(playerCat);
    playerMesh.position.set(ps.position.x, 10, ps.position.z);
    this.scene.add(playerMesh);
    const playerObj: PlacedObject = {
      id: this.nextId++,
      type: 'player_spawn',
      vehicleId: 'player',
      position: new THREE.Vector3(ps.position.x, ps.position.y, ps.position.z),
      mesh: playerMesh,
    };
    playerMesh.userData.objectId = playerObj.id;
    this.objects.push(playerObj);

    // Place air enemies
    for (const ae of data.airEnemies) {
      const cat = CATALOG.find(c => c.vehicleId === ae.vehicleId && c.type === 'air_enemy')
        ?? CATALOG.find(c => c.type === 'air_enemy')!;
      const mesh = this.createObjectMesh(cat);
      // Air enemies: mesh Y = actual altitude for proper visualization
      mesh.position.set(ae.position.x, ae.position.y, ae.position.z);
      this.scene.add(mesh);
      const obj: PlacedObject = {
        id: this.nextId++,
        type: 'air_enemy',
        vehicleId: ae.vehicleId,
        position: new THREE.Vector3(ae.position.x, ae.position.y, ae.position.z),
        mesh,
        patrolIndex: ae.patrolIndex,
      };
      mesh.userData.objectId = obj.id;
      this.objects.push(obj);
    }

    // Place ground enemies
    for (const ge of data.groundEnemies) {
      const cat = CATALOG.find(c => c.vehicleId === ge.vehicleId && c.type === 'ground_enemy')
        ?? CATALOG.find(c => c.type === 'ground_enemy')!;
      const mesh = this.createObjectMesh(cat);
      // Ground enemies: sample terrain height if Y is 0 (legacy levels), otherwise use stored Y
      const terrainY = ge.position.y === 0 ? getTerrainHeight(ge.position.x, ge.position.z) : ge.position.y;
      mesh.position.set(ge.position.x, terrainY + 20, ge.position.z);
      this.scene.add(mesh);
      const obj: PlacedObject = {
        id: this.nextId++,
        type: 'ground_enemy',
        vehicleId: ge.vehicleId,
        position: new THREE.Vector3(ge.position.x, terrainY, ge.position.z),
        mesh,
        moving: ge.moving,
        patrolRadius: ge.patrolRadius,
      };
      mesh.userData.objectId = obj.id;
      this.objects.push(obj);
    }

    this.updateObjectList();
    this.updatePropPanel();
  }

  private testLevel(): void {
    const data = this.buildMissionData();
    // Store in sessionStorage and navigate to game
    sessionStorage.setItem('phly_test_level', JSON.stringify(data));
    window.location.href = '/?test=1';
  }

  private buildMissionData(): MissionData {
    const playerSpawn = this.objects.find(o => o.type === 'player_spawn');
    return {
      id: this.levelId,
      name: this.levelName,
      description: this.levelDescription,
      biome: this.levelBiome,
      terrainSeed: this.terrainSeed,
      objectives: [...this.objectives],
      rewards: { ...this.rewards },
      timeLimitSeconds: this.timeLimitSeconds,
      bounds: { ...this.bounds },
      playerSpawn: {
        position: playerSpawn
          ? { x: Math.round(playerSpawn.position.x), y: Math.round(playerSpawn.position.y), z: Math.round(playerSpawn.position.z) }
          : { x: 0, y: 2500, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        speed: 90,
      },
      airEnemies: this.objects
        .filter(o => o.type === 'air_enemy')
        .map(o => ({
          vehicleId: o.vehicleId,
          position: { x: Math.round(o.position.x), y: Math.round(o.position.y), z: Math.round(o.position.z) },
          patrolIndex: o.patrolIndex ?? 0,
        })),
      groundEnemies: this.objects
        .filter(o => o.type === 'ground_enemy')
        .map(o => ({
          vehicleId: o.vehicleId,
          position: { x: Math.round(o.position.x), y: Math.round(o.position.y), z: Math.round(o.position.z) },
          moving: o.moving ?? false,
          patrolRadius: o.patrolRadius ?? 0,
        })),
      difficulty: JSON.parse(JSON.stringify(this.difficulty)),
    };
  }

  private newLevel(): void {
    for (const obj of this.objects) {
      this.scene.remove(obj.mesh);
      obj.mesh.geometry.dispose();
      (obj.mesh.material as THREE.Material).dispose();
    }
    this.objects = [];
    this.nextId = 1;
    this.selectedObject = null;
    this.activeCatalogItem = null;
    this.levelId = 'custom_level';
    this.levelName = 'Custom Level';
    this.levelDescription = 'A custom level.';
    this.terrainSeed = Math.floor(Math.random() * 99999);
    this.bounds = defaultBounds();
    this.difficulty = defaultDifficulty();
    this.objectives = [
      { id: 'obj1', type: 'destroy_air', count: 3, label: 'Destroy 3 enemy aircraft' },
      { id: 'obj2', type: 'destroy_ground', count: 2, label: 'Destroy 2 ground targets' },
      { id: 'obj3', type: 'survive', label: 'Return alive' },
    ];
    this.rewards = { credits: 500, score: 1000 };

    (this.toolbar.querySelector('#ed-seed') as HTMLInputElement).value = String(this.terrainSeed);
    (this.toolbar.querySelector('#ed-name') as HTMLInputElement).value = this.levelName;
    (this.toolbar.querySelector('#ed-bounds') as HTMLInputElement).value = String(this.bounds.maxX);
    (this.toolbar.querySelector('#ed-ceiling') as HTMLInputElement).value = String(this.bounds.ceiling);

    this.buildTerrain();
    this.buildBounds();
    this.updateTerrainPreview();
    this.updateObjectList();
    this.updatePropPanel();
    this.setStatus('New level created.');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── Game Loop ─────────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════

  private animate = (): void => {
    requestAnimationFrame(this.animate);

    // WASD camera panning
    const panSpeed = 200 / this.cameraZoom;
    const dt = 0.016;
    if (this.keys.has('w')) {
      this.cameraTarget.x -= Math.sin(this.cameraAngle) * panSpeed * dt;
      this.cameraTarget.z -= Math.cos(this.cameraAngle) * panSpeed * dt;
    }
    if (this.keys.has('s')) {
      this.cameraTarget.x += Math.sin(this.cameraAngle) * panSpeed * dt;
      this.cameraTarget.z += Math.cos(this.cameraAngle) * panSpeed * dt;
    }
    if (this.keys.has('a')) {
      this.cameraTarget.x -= Math.cos(this.cameraAngle) * panSpeed * dt;
      this.cameraTarget.z += Math.sin(this.cameraAngle) * panSpeed * dt;
    }
    if (this.keys.has('d')) {
      this.cameraTarget.x += Math.cos(this.cameraAngle) * panSpeed * dt;
      this.cameraTarget.z -= Math.sin(this.cameraAngle) * panSpeed * dt;
    }
    if (this.keys.has('q')) this.cameraAngle -= 1.5 * dt;
    if (this.keys.has('e')) this.cameraAngle += 1.5 * dt;

    if (this.keys.has('w') || this.keys.has('s') || this.keys.has('a') || this.keys.has('d') ||
        this.keys.has('q') || this.keys.has('e')) {
      this.updateCameraPosition();
    }

    this.renderer.render(this.scene, this.camera);
  };

  private setStatus(msg: string): void {
    this.statusBar.textContent = msg;
  }
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function hexCss(hex: number): string {
  return '#' + hex.toString(16).padStart(6, '0');
}
