import * as THREE from 'three';
import type { UpgradeState, LoadoutConfig } from '@/state/upgradeState';
import type { EconomyState } from '@/state/economyState';
import type { PlaneData, WeaponData } from '@/utils/dataLoader';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface HangarCallbacks {
  onSelectPlane: (planeId: string) => void;
  onChangeLoadout: (loadout: LoadoutConfig) => void;
  onPurchasePlane: (planeId: string) => void;
  onPurchaseWeapon: (weaponId: string) => void;
  onConfirm: () => void;
  onBack: () => void;
}

// ─── 3D Hangar Preview ─────────────────────────────────────────────────────────
class HangarPreview {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private planeModel: THREE.Group | null = null;
  private orbitAngle = 0;
  private animId = 0;
  private gltfLoader = new GLTFLoader();

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.shadowMap.enabled = true;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.5, 200);
    this.camera.position.set(12, 6, 12);
    this.camera.lookAt(0, 1, 0);

    this.buildHangarEnv();
    this.resize();
  }

  private buildHangarEnv(): void {
    // Floor
    const floorGeo = new THREE.PlaneGeometry(40, 40);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a2e, roughness: 0.8, metalness: 0.2,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Grid lines on floor
    const grid = new THREE.GridHelper(40, 40, 0x222244, 0x151530);
    grid.position.y = 0.01;
    this.scene.add(grid);

    // Back wall
    const wallGeo = new THREE.PlaneGeometry(40, 16);
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x0d0d1a, roughness: 0.9, metalness: 0.1,
    });
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.set(0, 8, -20);
    this.scene.add(wall);

    // Side walls
    const sideL = wall.clone();
    sideL.rotation.y = Math.PI / 2;
    sideL.position.set(-20, 8, 0);
    this.scene.add(sideL);
    const sideR = wall.clone();
    sideR.rotation.y = -Math.PI / 2;
    sideR.position.set(20, 8, 0);
    this.scene.add(sideR);

    // Ambient
    this.scene.add(new THREE.AmbientLight(0x506080, 1.8));

    // Key spotlight from above-front
    const spot1 = new THREE.SpotLight(0xaabbdd, 120, 60, Math.PI / 4, 0.4);
    spot1.position.set(5, 14, 8);
    spot1.target.position.set(0, 0, 0);
    spot1.castShadow = true;
    this.scene.add(spot1);
    this.scene.add(spot1.target);

    // Fill light from the left
    const spot2 = new THREE.SpotLight(0x8899bb, 60, 50, Math.PI / 3, 0.5);
    spot2.position.set(-10, 10, 5);
    spot2.target.position.set(0, 1, 0);
    this.scene.add(spot2);
    this.scene.add(spot2.target);

    // Rim light from behind
    const rim = new THREE.PointLight(0x6688cc, 25, 40);
    rim.position.set(0, 6, -8);
    this.scene.add(rim);

    // Extra front fill
    const front = new THREE.PointLight(0x778899, 15, 35);
    front.position.set(0, 4, 12);
    this.scene.add(front);
  }

  async loadPlane(planeId: string, modelPath?: string): Promise<void> {
    // Remove old
    if (this.planeModel) {
      this.scene.remove(this.planeModel);
      this.planeModel = null;
    }

    const path = modelPath ?? `/models/planes/${planeId}.glb`;
    try {
      const gltf = await new Promise<THREE.Group>((resolve, reject) => {
        this.gltfLoader.load(path, (g) => resolve(g.scene), undefined, reject);
      });

      gltf.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const m of mats) {
            if (m instanceof THREE.MeshStandardMaterial) {
              m.flatShading = true;
              m.needsUpdate = true;
            }
          }
          mesh.castShadow = true;
          mesh.receiveShadow = true;
        }
      });

      // Auto-scale to fit
      const box = new THREE.Box3().setFromObject(gltf);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      if (maxDim > 0) {
        const target = 8;
        gltf.scale.setScalar(target / maxDim);
      }
      // Center it
      const center = box.getCenter(new THREE.Vector3());
      gltf.position.sub(center.multiplyScalar(gltf.scale.x));
      gltf.position.y = 1.5;

      this.planeModel = gltf;
      this.scene.add(gltf);
    } catch {
      // Fallback: show primitive box plane
      this.showFallbackPlane();
    }
  }

  private showFallbackPlane(): void {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x667788, roughness: 0.6 });
    const wingMat = new THREE.MeshStandardMaterial({ color: 0x556677, roughness: 0.7 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 4), bodyMat);
    body.castShadow = true;
    group.add(body);

    const wings = new THREE.Mesh(new THREE.BoxGeometry(6, 0.1, 1.2), wingMat);
    wings.position.z = 0.3;
    wings.castShadow = true;
    group.add(wings);

    const tail = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 0.6), wingMat);
    tail.position.z = 1.8;
    tail.castShadow = true;
    group.add(tail);

    const vert = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.9, 0.6), wingMat);
    vert.position.set(0, 0.45, 1.8);
    vert.castShadow = true;
    group.add(vert);

    group.position.y = 1.5;
    this.planeModel = group;
    this.scene.add(group);
  }

  start(): void {
    const tick = () => {
      this.animId = requestAnimationFrame(tick);
      this.orbitAngle += 0.004;

      const r = 14;
      this.camera.position.set(
        Math.cos(this.orbitAngle) * r,
        5 + Math.sin(this.orbitAngle * 0.3) * 1,
        Math.sin(this.orbitAngle) * r,
      );
      this.camera.lookAt(0, 1.5, 0);

      this.renderer.render(this.scene, this.camera);
    };
    tick();
  }

  stop(): void {
    cancelAnimationFrame(this.animId);
  }

  resize(): void {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (w === 0 || h === 0) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    this.stop();
    this.renderer.dispose();
  }
}

// ─── HangarUI ───────────────────────────────────────────────────────────────────
export class HangarUI {
  private container: HTMLDivElement;
  private _visible = false;
  private planeDataCache: Map<string, PlaneData> = new Map();
  private weaponDataCache: Map<string, WeaponData> = new Map();
  private preview: HangarPreview | null = null;
  private currentTab: 'planes' | 'weapons' = 'planes';
  private lastPreviewPlane = '';

  constructor(
    private _upgrades: UpgradeState,
    private _economy: EconomyState,
    private _callbacks: HangarCallbacks,
  ) {
    this.container = document.createElement('div');
    this.container.id = 'hangar-ui';
    this.injectStyles();
    document.body.appendChild(this.container);
  }

  private injectStyles(): void {
    if (document.getElementById('hangar-styles')) return;
    const s = document.createElement('style');
    s.id = 'hangar-styles';
    s.textContent = `
#hangar-ui{position:fixed;inset:0;background:#08081a;color:#fff;font-family:'Courier New',monospace;z-index:850;display:none;}
#hangar-ui.open{display:flex;flex-direction:row;}

/* Left: 3D preview */
.h-preview{flex:0 0 45%;position:relative;overflow:hidden;background:linear-gradient(180deg,#0a0a1e 0%,#0d0d24 100%);}
.h-preview canvas{width:100%!important;height:100%!important;display:block;}
.h-preview-info{position:absolute;bottom:24px;left:24px;z-index:2;}
.h-preview-name{font-size:28px;font-weight:bold;letter-spacing:3px;text-shadow:0 2px 12px rgba(0,0,0,0.7);}
.h-preview-desc{font-size:11px;opacity:0.5;margin-top:4px;max-width:300px;line-height:1.5;}
.h-preview-stats{margin-top:12px;width:240px;}

/* Right: panel */
.h-panel{flex:1;display:flex;flex-direction:column;overflow:hidden;}
.h-top-bar{display:flex;justify-content:space-between;align-items:center;padding:20px 24px 12px;border-bottom:1px solid rgba(255,255,255,0.06);}
.h-title{font-size:18px;font-weight:bold;letter-spacing:3px;}
.h-credits{font-size:13px;color:#ffdd44;letter-spacing:1px;}
.h-tabs{display:flex;gap:0;border-bottom:1px solid rgba(255,255,255,0.06);}
.h-tab{flex:1;padding:10px 0;text-align:center;font-size:12px;letter-spacing:2px;text-transform:uppercase;
  cursor:pointer;border-bottom:2px solid transparent;transition:all 0.15s;opacity:0.5;}
.h-tab:hover{opacity:0.8;background:rgba(255,255,255,0.02);}
.h-tab.active{opacity:1;border-bottom-color:rgba(100,160,255,0.7);}
.h-scroll{flex:1;overflow-y:auto;padding:16px 20px;}

/* Plane list */
.pl-item{display:flex;align-items:center;gap:14px;padding:12px 14px;border:1px solid rgba(255,255,255,0.06);
  border-radius:6px;margin-bottom:8px;cursor:pointer;transition:all 0.15s;background:rgba(255,255,255,0.01);}
.pl-item:hover{background:rgba(255,255,255,0.04);border-color:rgba(255,255,255,0.15);}
.pl-item.selected{border-color:rgba(100,160,255,0.6);background:rgba(100,160,255,0.06);}
.pl-item.locked{opacity:0.45;}
.pl-item.locked:hover{opacity:0.6;}
.pl-icon{width:40px;height:40px;border-radius:4px;background:rgba(255,255,255,0.04);display:flex;align-items:center;
  justify-content:center;font-size:18px;flex-shrink:0;}
.pl-info{flex:1;min-width:0;}
.pl-name{font-size:13px;font-weight:bold;letter-spacing:1px;}
.pl-sub{font-size:10px;opacity:0.4;margin-top:2px;}
.pl-right{text-align:right;flex-shrink:0;}
.pl-price{font-size:11px;color:#ffdd44;}
.pl-owned{font-size:10px;color:#44ff88;letter-spacing:1px;}
.pl-buy{padding:4px 12px;font-size:10px;border:1px solid rgba(255,220,0,0.3);background:rgba(255,220,0,0.06);
  color:#ffdd44;cursor:pointer;border-radius:3px;font-family:inherit;margin-top:4px;transition:all 0.15s;}
.pl-buy:hover{background:rgba(255,220,0,0.14);}
.pl-buy.na{opacity:0.35;cursor:not-allowed;}

/* Stat bars */
.st-row{display:flex;align-items:center;margin-bottom:5px;}
.st-lbl{width:48px;font-size:9px;text-transform:uppercase;opacity:0.5;letter-spacing:1px;}
.st-bg{flex:1;height:5px;background:rgba(255,255,255,0.07);border-radius:3px;overflow:hidden;}
.st-fill{height:100%;border-radius:3px;transition:width 0.4s ease;}
.st-fill.spd{background:linear-gradient(90deg,#44aaff,#2266cc);}
.st-fill.arm{background:linear-gradient(90deg,#44ff88,#228844);}
.st-fill.agi{background:linear-gradient(90deg,#ffaa44,#cc6622);}

/* Loadout section */
.lo-section{margin-top:16px;padding:14px;border:1px solid rgba(255,255,255,0.06);border-radius:6px;background:rgba(255,255,255,0.015);}
.lo-title{font-size:11px;font-weight:bold;letter-spacing:2px;opacity:0.5;margin-bottom:10px;text-transform:uppercase;}
.lo-row{display:flex;align-items:center;margin-bottom:6px;gap:8px;}
.lo-lbl{font-size:10px;width:40px;opacity:0.4;text-transform:uppercase;}
.lo-fixed{font-size:11px;opacity:0.6;}
.lo-sel{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);color:#fff;
  font-family:inherit;font-size:11px;padding:4px 8px;border-radius:3px;cursor:pointer;flex:1;min-width:0;}
.lo-sel option{background:#111;color:#fff;}

/* Weapon list */
.wl-cat{font-size:10px;letter-spacing:2px;text-transform:uppercase;opacity:0.3;margin:16px 0 8px;
  border-bottom:1px solid rgba(255,255,255,0.04);padding-bottom:4px;}
.wl-cat:first-child{margin-top:0;}
.wl-item{display:flex;align-items:center;gap:12px;padding:10px 12px;border:1px solid rgba(255,255,255,0.05);
  border-radius:5px;margin-bottom:6px;transition:all 0.15s;background:rgba(255,255,255,0.01);}
.wl-item:hover{background:rgba(255,255,255,0.03);}
.wl-item.locked{opacity:0.35;}
.wl-icon{width:32px;height:32px;border-radius:3px;background:rgba(255,255,255,0.04);display:flex;
  align-items:center;justify-content:center;font-size:14px;flex-shrink:0;}
.wl-info{flex:1;min-width:0;}
.wl-name{font-size:12px;font-weight:bold;letter-spacing:0.5px;}
.wl-stats{font-size:9px;opacity:0.4;margin-top:2px;}
.wl-right{text-align:right;flex-shrink:0;}

/* Bottom actions */
.h-actions{display:flex;gap:10px;padding:16px 20px;border-top:1px solid rgba(255,255,255,0.06);}
.h-btn{flex:1;padding:11px 0;text-align:center;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.03);
  color:#fff;font-family:inherit;font-size:13px;letter-spacing:2px;text-transform:uppercase;cursor:pointer;
  border-radius:4px;transition:all 0.15s;}
.h-btn:hover{background:rgba(255,255,255,0.08);border-color:rgba(255,255,255,0.35);}
.h-btn.primary{border-color:rgba(100,160,255,0.5);background:rgba(100,160,255,0.1);}
.h-btn.primary:hover{background:rgba(100,160,255,0.22);}
    `;
    document.head.appendChild(s);
  }

  async preloadData(): Promise<void> {
    const fetches: Promise<void>[] = [];
    for (const p of this._upgrades.planes) {
      if (!this.planeDataCache.has(p.planeId)) {
        fetches.push(fetch(`/data/planes/${p.planeId}.json`).then(r => r.ok ? r.json() : null)
          .then(d => { if (d) this.planeDataCache.set(p.planeId, d); }).catch(() => {}));
      }
    }
    for (const w of this._upgrades.weapons) {
      if (!this.weaponDataCache.has(w.weaponId)) {
        fetches.push(fetch(`/data/weapons/${w.weaponId}.json`).then(r => r.ok ? r.json() : null)
          .then(d => { if (d) this.weaponDataCache.set(w.weaponId, d); }).catch(() => {}));
      }
    }
    await Promise.all(fetches);
  }

  show(): void {
    this._visible = true;
    this.render();
    this.container.classList.add('open');
    // Start 3D preview after DOM is laid out
    requestAnimationFrame(() => {
      this.initPreview();
    });
  }

  hide(): void {
    this._visible = false;
    this.container.classList.remove('open');
    if (this.preview) {
      this.preview.stop();
    }
  }

  isVisible(): boolean { return this._visible; }

  updateEconomy(economy: EconomyState): void {
    this._economy = economy;
    if (this._visible) this.render();
  }

  updateUpgrades(upgrades: UpgradeState): void {
    this._upgrades = upgrades;
    if (this._visible) this.render();
  }

  private initPreview(): void {
    const canvas = this.container.querySelector('#h-preview-canvas') as HTMLCanvasElement;
    if (!canvas) return;
    if (this.preview) this.preview.dispose();
    this.preview = new HangarPreview(canvas);
    this.preview.start();
    this.lastPreviewPlane = '';
    this.updatePreviewPlane();
  }

  private updatePreviewPlane(): void {
    const planeId = this._upgrades.selectedPlane;
    if (planeId === this.lastPreviewPlane || !this.preview) return;
    this.lastPreviewPlane = planeId;
    const pd = this.planeDataCache.get(planeId);
    this.preview.loadPlane(planeId, pd?.model);
  }

  private render(): void {
    const tab = this.currentTab;
    const credits = this._economy.credits;
    const selectedPlane = this._upgrades.selectedPlane;
    const pd = this.planeDataCache.get(selectedPlane);
    const spd = pd?.statSpeed ?? 5;
    const arm = pd?.statArmor ?? 5;
    const agi = pd?.statAgility ?? 5;

    this.container.innerHTML = `
      <div class="h-preview">
        <canvas id="h-preview-canvas"></canvas>
        <div class="h-preview-info">
          <div class="h-preview-name">${pd?.name ?? selectedPlane}</div>
          <div class="h-preview-desc">${pd?.description ?? ''}</div>
          <div class="h-preview-stats">
            <div class="st-row"><span class="st-lbl">Speed</span><div class="st-bg"><div class="st-fill spd" style="width:${spd * 10}%"></div></div></div>
            <div class="st-row"><span class="st-lbl">Armor</span><div class="st-bg"><div class="st-fill arm" style="width:${arm * 10}%"></div></div></div>
            <div class="st-row"><span class="st-lbl">Agility</span><div class="st-bg"><div class="st-fill agi" style="width:${agi * 10}%"></div></div></div>
          </div>
        </div>
      </div>
      <div class="h-panel">
        <div class="h-top-bar">
          <div class="h-title">HANGAR</div>
          <div class="h-credits">${credits.toLocaleString()} CR</div>
        </div>
        <div class="h-tabs">
          <div class="h-tab ${tab === 'planes' ? 'active' : ''}" data-tab="planes">Aircraft</div>
          <div class="h-tab ${tab === 'weapons' ? 'active' : ''}" data-tab="weapons">Ordnance</div>
        </div>
        <div class="h-scroll" id="h-scroll"></div>
        <div class="h-actions">
          <button class="h-btn" id="h-back">Back</button>
          <button class="h-btn primary" id="h-deploy">Deploy</button>
        </div>
      </div>
    `;

    // Tab switching
    this.container.querySelectorAll('.h-tab').forEach(t => {
      t.addEventListener('click', () => {
        this.currentTab = (t as HTMLElement).dataset.tab as 'planes' | 'weapons';
        this.render();
        requestAnimationFrame(() => this.initPreview());
      });
    });

    const scroll = this.container.querySelector('#h-scroll')!;
    if (tab === 'planes') {
      this.renderPlanes(scroll as HTMLElement, selectedPlane, credits);
    } else {
      this.renderWeapons(scroll as HTMLElement, credits);
    }

    this.container.querySelector('#h-back')!.addEventListener('click', () => {
      this.hide();
      this._callbacks.onBack();
    });
    this.container.querySelector('#h-deploy')!.addEventListener('click', () => {
      this.hide();
      this._callbacks.onConfirm();
    });
  }

  private renderPlanes(el: HTMLElement, selectedPlane: string, credits: number): void {
    let html = '';
    for (const pu of this._upgrades.planes) {
      const pd = this.planeDataCache.get(pu.planeId);
      const name = pd?.name ?? pu.planeId;
      const sel = pu.planeId === selectedPlane;
      const locked = !pu.unlocked;
      const canBuy = credits >= pu.purchasePrice;
      const spd = pd?.statSpeed ?? 5;
      const arm = pd?.statArmor ?? 5;
      const agi = pd?.statAgility ?? 5;

      html += `<div class="pl-item ${sel ? 'selected' : ''} ${locked ? 'locked' : ''}" data-plane="${pu.planeId}">
        <div class="pl-icon">${locked ? '&#128274;' : '&#9992;'}</div>
        <div class="pl-info">
          <div class="pl-name">${name}</div>
          <div class="pl-sub">SPD ${spd} / ARM ${arm} / AGI ${agi}</div>
        </div>
        <div class="pl-right">
          ${locked
            ? `<div class="pl-price">${pu.purchasePrice.toLocaleString()} CR</div>
               <button class="pl-buy ${canBuy ? '' : 'na'}" data-buy-plane="${pu.planeId}">${canBuy ? 'BUY' : 'NEED CR'}</button>`
            : sel ? '<div class="pl-owned">EQUIPPED</div>' : '<div class="pl-owned">OWNED</div>'}
        </div>
      </div>`;
    }

    // Loadout
    html += this.buildLoadoutHTML();
    el.innerHTML = html;

    // Events
    el.querySelectorAll('.pl-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = (item as HTMLElement).dataset.plane!;
        const pu = this._upgrades.planes.find(p => p.planeId === id);
        if (pu?.unlocked) {
          this._upgrades.selectedPlane = id;
          this._upgrades.loadout.planeId = id;
          this._callbacks.onSelectPlane(id);
          this.render();
          requestAnimationFrame(() => {
            this.initPreview();
          });
        }
      });
    });

    el.querySelectorAll('[data-buy-plane]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._callbacks.onPurchasePlane((btn as HTMLElement).dataset.buyPlane!);
      });
    });

    el.querySelectorAll('.lo-sel').forEach(sel => {
      sel.addEventListener('change', () => {
        const slot = parseInt((sel as HTMLSelectElement).dataset.slot!);
        const weaponId = (sel as HTMLSelectElement).value;
        const ws = this._upgrades.loadout.weaponSlots.find(w => w.slot === slot);
        if (ws) ws.weaponId = weaponId;
        this._callbacks.onChangeLoadout(this._upgrades.loadout);
      });
    });
  }

  private buildLoadoutHTML(): string {
    const loadout = this._upgrades.loadout;
    const missiles = this._upgrades.weapons.filter(w => {
      if (!w.unlocked) return false;
      const wd = this.weaponDataCache.get(w.weaponId);
      return wd?.type === 'missile';
    });

    let html = '<div class="lo-section"><div class="lo-title">Loadout</div>';
    for (const ws of loadout.weaponSlots) {
      const isGun = ws.slot === 1;
      const isCM = ws.slot === 4;
      const wd = this.weaponDataCache.get(ws.weaponId);
      const label = isGun ? 'GUN' : isCM ? 'CM' : `MSL${ws.slot - 1}`;

      if (isGun || isCM) {
        html += `<div class="lo-row"><span class="lo-lbl">${label}</span><span class="lo-fixed">${wd?.name ?? ws.weaponId}</span></div>`;
      } else {
        html += `<div class="lo-row"><span class="lo-lbl">${label}</span>
          <select class="lo-sel" data-slot="${ws.slot}">
            ${missiles.map(m => {
              const md = this.weaponDataCache.get(m.weaponId);
              return `<option value="${m.weaponId}" ${m.weaponId === ws.weaponId ? 'selected' : ''}>${md?.name ?? m.weaponId}</option>`;
            }).join('')}
          </select></div>`;
      }
    }
    html += '</div>';
    return html;
  }

  private renderWeapons(el: HTMLElement, credits: number): void {
    // Group by type
    const guns: typeof this._upgrades.weapons = [];
    const missiles: typeof this._upgrades.weapons = [];
    const cms: typeof this._upgrades.weapons = [];

    for (const wu of this._upgrades.weapons) {
      const wd = this.weaponDataCache.get(wu.weaponId);
      const type = wd?.type ?? 'missile';
      if (type === 'gun') guns.push(wu);
      else if (type === 'countermeasure') cms.push(wu);
      else missiles.push(wu);
    }

    const renderGroup = (label: string, items: typeof this._upgrades.weapons) => {
      if (items.length === 0) return '';
      let html = `<div class="wl-cat">${label}</div>`;
      for (const wu of items) {
        const wd = this.weaponDataCache.get(wu.weaponId);
        const name = wd?.name ?? wu.weaponId;
        const locked = !wu.unlocked;
        const canBuy = credits >= wu.purchasePrice;

        let statsText = '';
        if (wd?.damage) statsText += `DMG ${wd.damage}`;
        if (wd?.speed) statsText += `${statsText ? ' | ' : ''}SPD ${wd.speed}`;
        if (wd?.turnRate) statsText += `${statsText ? ' | ' : ''}TRN ${wd.turnRate}`;
        if (wd?.fireRate) statsText += `${statsText ? ' | ' : ''}ROF ${wd.fireRate}`;
        if (wd?.ammo) statsText += `${statsText ? ' | ' : ''}AMO ${wd.ammo}`;

        const icon = wd?.type === 'gun' ? '&#128299;' : wd?.type === 'countermeasure' ? '&#10024;' : '&#127915;';

        html += `<div class="wl-item ${locked ? 'locked' : ''}">
          <div class="wl-icon">${icon}</div>
          <div class="wl-info">
            <div class="wl-name">${name}</div>
            ${statsText ? `<div class="wl-stats">${statsText}</div>` : ''}
          </div>
          <div class="wl-right">
            ${locked
              ? `<div class="pl-price">${wu.purchasePrice.toLocaleString()} CR</div>
                 <button class="pl-buy ${canBuy ? '' : 'na'}" data-buy-weapon="${wu.weaponId}">${canBuy ? 'BUY' : 'NEED CR'}</button>`
              : `<div class="pl-owned">OWNED</div>`}
          </div>
        </div>`;
      }
      return html;
    };

    el.innerHTML = renderGroup('Missiles', missiles) + renderGroup('Guns', guns) + renderGroup('Countermeasures', cms);

    el.querySelectorAll('[data-buy-weapon]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._callbacks.onPurchaseWeapon((btn as HTMLElement).dataset.buyWeapon!);
      });
    });
  }
}
