import * as THREE from 'three';

// Enhanced volumetric cloud system with multiple layers and types
export class CloudSystem {
  private clouds: THREE.Group[] = [];
  private scene: THREE.Scene;
  private time = 0;

  constructor(scene: THREE.Scene, density: number = 0.5) {
    this.scene = scene;
    this.generateClouds(density);
  }

  private generateClouds(density: number): void {
    const cloudCount = Math.floor(100 * density);
    const rng = this.seededRng(54321);

    // Shared cloud materials with varying opacity for depth
    const cloudMats = [
      new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, flatShading: true }),
      new THREE.MeshLambertMaterial({ color: 0xf0f4ff, transparent: true, opacity: 0.45, flatShading: true }),
      new THREE.MeshLambertMaterial({ color: 0xe8ecf8, transparent: true, opacity: 0.35, flatShading: true }),
    ];

    // Shared geometries (reuse for performance)
    const geos = [
      new THREE.IcosahedronGeometry(1, 1),
      new THREE.IcosahedronGeometry(1, 0),
      new THREE.DodecahedronGeometry(1, 0),
    ];

    for (let i = 0; i < cloudCount; i++) {
      const cloud = new THREE.Group();
      
      // Vary cloud size: small wispy vs large cumulus
      const isLarge = rng() > 0.6;
      const puffCount = isLarge ? (6 + Math.floor(rng() * 8)) : (3 + Math.floor(rng() * 4));
      const baseSize = isLarge ? 12 : 7;
      const spread = isLarge ? 40 : 20;
      
      for (let j = 0; j < puffCount; j++) {
        const geo = geos[Math.floor(rng() * geos.length)];
        const mat = cloudMats[Math.floor(rng() * cloudMats.length)];
        const puff = new THREE.Mesh(geo, mat);
        
        puff.position.set(
          (rng() - 0.5) * spread,
          (rng() - 0.5) * (isLarge ? 12 : 5),
          (rng() - 0.5) * spread
        );
        
        const s = baseSize + rng() * baseSize * 0.8;
        puff.scale.set(
          s * (0.8 + rng() * 0.4),
          s * (0.5 + rng() * 0.3),
          s * (0.8 + rng() * 0.4)
        );
        
        cloud.add(puff);
      }

      // Multiple altitude layers
      const layer = rng();
      let y: number;
      if (layer < 0.5) {
        y = 500 + rng() * 500;     // Low clouds (500-1000m)
      } else if (layer < 0.85) {
        y = 1200 + rng() * 800;    // Mid clouds (1200-2000m)
      } else {
        y = 2500 + rng() * 1000;   // High wispy clouds (2500-3500m)
      }

      const x = (rng() - 0.5) * 36000;
      const z = (rng() - 0.5) * 36000;
      
      cloud.position.set(x, y, z);
      cloud.rotation.y = rng() * Math.PI * 2;
      cloud.userData.driftSpeed = 1.5 + rng() * 2.5;
      cloud.userData.bobPhase = rng() * Math.PI * 2;
      cloud.userData.baseY = y;
      
      this.clouds.push(cloud);
      this.scene.add(cloud);
    }
  }

  setDensity(density: number): void {
    // Remove existing clouds
    for (const cloud of this.clouds) {
      this.scene.remove(cloud);
      cloud.traverse(obj => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
        }
      });
    }
    this.clouds = [];
    
    // Generate new clouds with updated density
    this.generateClouds(density);
  }

  update(playerPos: THREE.Vector3, dt: number): void {
    this.time += dt;
    for (const cloud of this.clouds) {
      const speed = cloud.userData.driftSpeed || 2;
      cloud.position.x += dt * speed;
      cloud.position.z += dt * speed * 0.5;
      
      // Gentle vertical bobbing
      const baseY = cloud.userData.baseY || cloud.position.y;
      const phase = cloud.userData.bobPhase || 0;
      cloud.position.y = baseY + Math.sin(this.time * 0.15 + phase) * 3;
      
      // Wrap around if too far from player
      if (cloud.position.x - playerPos.x > 20000) cloud.position.x -= 40000;
      if (cloud.position.x - playerPos.x < -20000) cloud.position.x += 40000;
      if (cloud.position.z - playerPos.z > 20000) cloud.position.z -= 40000;
      if (cloud.position.z - playerPos.z < -20000) cloud.position.z += 40000;
    }
  }

  dispose(): void {
    for (const cloud of this.clouds) {
      this.scene.remove(cloud);
      cloud.traverse(obj => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (obj.material instanceof THREE.Material) {
            obj.material.dispose();
          }
        }
      });
    }
    this.clouds = [];
  }

  private seededRng(seed: number): () => number {
    let s = seed;
    return () => {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      return (s >>> 0) / 0xffffffff;
    };
  }
}
