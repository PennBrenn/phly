import * as THREE from 'three';
import { getTerrainHeight, getForestDensity, isWaterWorld } from '@/utils/terrain';

// ─── Shared geometries / materials (instanced for performance) ───────────────

function makePineTree(): THREE.Group {
  const g = new THREE.Group();
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5a3a1a });
  const leafMat  = new THREE.MeshLambertMaterial({ color: 0x2a5a20 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 3, 5), trunkMat);
  trunk.position.y = 1.5;
  trunk.castShadow = true;
  g.add(trunk);
  // Three cone tiers
  const tiers = [
    { r: 3.5, h: 5, y: 5 },
    { r: 2.5, h: 4, y: 7.5 },
    { r: 1.5, h: 3, y: 9.5 },
  ];
  for (const t of tiers) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(t.r, t.h, 6), leafMat);
    cone.position.y = t.y;
    cone.castShadow = true;
    g.add(cone);
  }
  return g;
}

function makeOakTree(): THREE.Group {
  const g = new THREE.Group();
  const trunkMat  = new THREE.MeshLambertMaterial({ color: 0x5a3a1a });
  const canopyMat = new THREE.MeshLambertMaterial({ color: 0x3a7a28 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 5, 5), trunkMat);
  trunk.position.y = 2.5;
  trunk.castShadow = true;
  g.add(trunk);
  const canopy = new THREE.Mesh(new THREE.IcosahedronGeometry(4.5, 0), canopyMat);
  canopy.position.y = 8;
  canopy.castShadow = true;
  g.add(canopy);
  return g;
}

// ─── RNG ─────────────────────────────────────────────────────────────────────

function seededRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function createTerrainProps(scene: THREE.Scene, treeDensity = 0.7): void {
  const rng = seededRng(42);

  const TREE_COUNT = Math.floor(2500 * treeDensity);
  const SPREAD     = 8000;

  // ── Trees ──────────────────────────────────────────────────────────────────
  for (let i = 0; i < TREE_COUNT; i++) {
    const wx = (rng() - 0.5) * SPREAD * 2;
    const wz = (rng() - 0.5) * SPREAD * 2;

    if (isWaterWorld(wx, wz)) continue;

    const fd = getForestDensity(wx, wz);
    const h  = getTerrainHeight(wx, wz);

    // Skip water, steep mountains
    if (h < 10 || h > 1000) continue;

    // Only plant trees where forest density is high enough
    // Use a threshold that creates natural forest patches
    const threshold = 0.45 + rng() * 0.2;
    if (fd < threshold) continue;

    const isPine = rng() > 0.4;
    const tree   = isPine ? makePineTree() : makeOakTree();

    const scale = 0.6 + rng() * 0.8;
    tree.scale.setScalar(scale);
    tree.position.set(wx, h, wz);
    tree.rotation.y = rng() * Math.PI * 2;

    scene.add(tree);
  }

}
