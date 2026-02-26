import * as THREE from 'three';
import type { GameState } from '@/state/gameState';
import {
  MAX_BULLETS, MAX_MISSILES, MAX_EXPLOSIONS,
  type EnemyState,
} from '@/state/combatState';

// ─── Bullet pool meshes ──────────────────────────────────────────────────────
const BULLET_GEO = new THREE.SphereGeometry(0.4, 4, 3);
const BULLET_MAT_PLAYER = new THREE.MeshBasicMaterial({ color: 0xffdd44 });
const BULLET_MAT_ENEMY = new THREE.MeshBasicMaterial({ color: 0xff4444 });

// ─── Missile mesh ────────────────────────────────────────────────────────────
const MISSILE_GEO = new THREE.CylinderGeometry(0.15, 0.3, 2.5, 5);
const MISSILE_MAT = new THREE.MeshLambertMaterial({ color: 0xdddddd });

// ─── Enemy plane geometry ────────────────────────────────────────────────────
function makeEnemyMesh(): THREE.Group {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0xcc3333 });
  const wingMat = new THREE.MeshLambertMaterial({ color: 0xaa2222 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 5), bodyMat);
  body.castShadow = true;
  g.add(body);

  const wings = new THREE.Mesh(new THREE.BoxGeometry(8, 0.15, 1.5), wingMat);
  wings.position.z = 0.5;
  wings.castShadow = true;
  g.add(wings);

  const tail = new THREE.Mesh(new THREE.BoxGeometry(3, 0.1, 0.8), wingMat);
  tail.position.z = 2.2;
  tail.castShadow = true;
  g.add(tail);

  const vStab = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.2, 0.8), wingMat);
  vStab.position.set(0, 0.6, 2.2);
  vStab.castShadow = true;
  g.add(vStab);

  g.traverse((child) => { child.frustumCulled = false; });
  return g;
}

// ─── Ground enemy (tank) primitive ──────────────────────────────────────────
function makeTankMesh(): THREE.Group {
  const g = new THREE.Group();
  const hullMat = new THREE.MeshLambertMaterial({ color: 0x556633 });
  const turretMat = new THREE.MeshLambertMaterial({ color: 0x445522 });

  const hull = new THREE.Mesh(new THREE.BoxGeometry(3.5, 1.2, 5.5), hullMat);
  hull.position.y = 0.6;
  hull.castShadow = true;
  g.add(hull);

  const turret = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.4, 0.8, 8), turretMat);
  turret.position.y = 1.6;
  turret.castShadow = true;
  g.add(turret);

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 3, 6), turretMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 1.6, -2);
  barrel.castShadow = true;
  g.add(barrel);

  // Tracks
  const trackMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
  const trackL = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 5.5), trackMat);
  trackL.position.set(-2, 0.4, 0);
  g.add(trackL);
  const trackR = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 5.5), trackMat);
  trackR.position.set(2, 0.4, 0);
  g.add(trackR);

  g.traverse((child) => { child.frustumCulled = false; });
  return g;
}

// ─── Fragment geometry for explosions ────────────────────────────────────────
const FRAG_GEO = new THREE.TetrahedronGeometry(0.6);
const FRAG_MAT = new THREE.MeshBasicMaterial({ color: 0xff6600 });

export class CombatRenderer {
  private bulletMeshes: THREE.Mesh[] = [];
  private missileMeshes: THREE.Mesh[] = [];
  private missileTrails: THREE.PointLight[] = [];
  private enemyMeshes: Map<number, THREE.Group> = new Map();
  private explosionGroups: { light: THREE.PointLight; fragments: THREE.Mesh[]; }[] = [];
  private muzzleFlash: THREE.PointLight;
  private muzzleTimer = 0;
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Pre-allocate bullet meshes
    for (let i = 0; i < MAX_BULLETS; i++) {
      const mesh = new THREE.Mesh(BULLET_GEO, BULLET_MAT_PLAYER.clone());
      mesh.visible = false;
      mesh.frustumCulled = false;
      scene.add(mesh);
      this.bulletMeshes.push(mesh);
    }

    // Pre-allocate missile meshes
    for (let i = 0; i < MAX_MISSILES; i++) {
      const mesh = new THREE.Mesh(MISSILE_GEO, MISSILE_MAT);
      mesh.visible = false;
      mesh.frustumCulled = false;
      scene.add(mesh);
      this.missileMeshes.push(mesh);

      const trail = new THREE.PointLight(0xff8800, 2, 40);
      trail.visible = false;
      scene.add(trail);
      this.missileTrails.push(trail);
    }

    // Pre-allocate explosion slots
    for (let i = 0; i < MAX_EXPLOSIONS; i++) {
      const light = new THREE.PointLight(0xff6600, 0, 80);
      light.visible = false;
      scene.add(light);

      const fragments: THREE.Mesh[] = [];
      for (let f = 0; f < 12; f++) {
        const fm = new THREE.Mesh(FRAG_GEO, FRAG_MAT);
        fm.visible = false;
        fm.frustumCulled = false;
        scene.add(fm);
        fragments.push(fm);
      }
      this.explosionGroups.push({ light, fragments });
    }

    // Muzzle flash
    this.muzzleFlash = new THREE.PointLight(0xffcc44, 0, 30);
    scene.add(this.muzzleFlash);
  }

  update(state: GameState): void {
    const dt = state.time.delta;
    const combat = state.combat;

    // ── Bullets ──────────────────────────────────────────────────────────
    for (let i = 0; i < MAX_BULLETS; i++) {
      const b = combat.bullets[i];
      const mesh = this.bulletMeshes[i];
      if (b.active) {
        mesh.visible = true;
        mesh.position.set(b.position.x, b.position.y, b.position.z);
        // Color: yellow for player, red for enemy
        (mesh.material as THREE.MeshBasicMaterial).color.setHex(b.ownerId === 0 ? 0xffdd44 : 0xff4444);
      } else {
        mesh.visible = false;
      }
    }

    // ── Muzzle flash ─────────────────────────────────────────────────────
    if (state.input.fire && combat.fireCooldown <= 0.02) {
      this.muzzleTimer = 0.04;
    }
    if (this.muzzleTimer > 0) {
      this.muzzleTimer -= dt;
      this.muzzleFlash.intensity = 4;
      // Position at plane nose
      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(
        new THREE.Quaternion(
          state.player.rotation.x, state.player.rotation.y,
          state.player.rotation.z, state.player.rotation.w,
        ),
      );
      this.muzzleFlash.position.set(
        state.player.position.x + fwd.x * 10,
        state.player.position.y + fwd.y * 10,
        state.player.position.z + fwd.z * 10,
      );
    } else {
      this.muzzleFlash.intensity = 0;
    }

    // ── Missiles ─────────────────────────────────────────────────────────
    for (let i = 0; i < MAX_MISSILES; i++) {
      const m = combat.missiles[i];
      const mesh = this.missileMeshes[i];
      const trail = this.missileTrails[i];
      if (m.active) {
        mesh.visible = true;
        trail.visible = true;
        mesh.position.set(m.position.x, m.position.y, m.position.z);
        mesh.quaternion.set(m.rotation.x, m.rotation.y, m.rotation.z, m.rotation.w);
        // Rotate cylinder to point forward (cylinder default is Y-up)
        mesh.rotateX(Math.PI / 2);
        trail.position.set(m.position.x, m.position.y, m.position.z);
        trail.intensity = 2 + Math.sin(state.time.elapsed * 20) * 0.5;
      } else {
        mesh.visible = false;
        trail.visible = false;
      }
    }

    // ── Enemies ──────────────────────────────────────────────────────────
    // Ensure meshes exist for all enemies
    for (const e of combat.enemies) {
      if (!this.enemyMeshes.has(e.id)) {
        const mesh = e.isGround ? makeTankMesh() : makeEnemyMesh();
        this.scene.add(mesh);
        this.enemyMeshes.set(e.id, mesh);
      }
    }

    for (const e of combat.enemies) {
      const mesh = this.enemyMeshes.get(e.id)!;

      if (e.aiMode === 'destroyed' && e.destroyedTimer > 4) {
        mesh.visible = false;
        continue;
      }

      mesh.visible = true;
      mesh.position.set(e.position.x, e.position.y, e.position.z);
      mesh.quaternion.set(e.rotation.x, e.rotation.y, e.rotation.z, e.rotation.w);

      // Hit flash: briefly make emissive red
      this.updateEnemyHitFlash(mesh, e);
    }

    // ── Explosions ───────────────────────────────────────────────────────
    for (let i = 0; i < MAX_EXPLOSIONS; i++) {
      const ex = combat.explosions[i];
      const group = this.explosionGroups[i];

      if (ex.active) {
        const t = ex.age / ex.maxAge; // 0→1
        group.light.visible = true;
        group.light.position.set(ex.position.x, ex.position.y, ex.position.z);
        group.light.intensity = (1 - t) * 8;
        group.light.distance = 40 + t * 60;
        group.light.color.setHex(t < 0.3 ? 0xffffaa : 0xff6600);

        for (let f = 0; f < group.fragments.length && f < ex.fragments.length; f++) {
          const fm = group.fragments[f];
          const fd = ex.fragments[f];
          fm.visible = t < 0.85;
          fm.position.set(fd.position.x, fd.position.y, fd.position.z);
          const scale = (1 - t) * 1.5;
          fm.scale.setScalar(Math.max(0.1, scale));
        }
      } else {
        group.light.visible = false;
        for (const fm of group.fragments) fm.visible = false;
      }
    }
  }

  private updateEnemyHitFlash(mesh: THREE.Group, enemy: EnemyState): void {
    const flash = enemy.hitFlashTimer > 0;
    mesh.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mat = (child as THREE.Mesh).material as THREE.MeshLambertMaterial;
        if (mat.emissive) {
          if (flash) {
            mat.emissive.setHex(0xff0000);
            mat.emissiveIntensity = 2;
          } else if (enemy.aiMode === 'destroyed') {
            mat.emissive.setHex(0x331100);
            mat.emissiveIntensity = 1;
          } else {
            mat.emissive.setHex(0x000000);
            mat.emissiveIntensity = 0;
          }
        }
      }
    });
  }
}
