import * as THREE from 'three';

// Low-poly volumetric cloud system
export class CloudSystem {
  private clouds: THREE.Group[] = [];
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene, density: number = 0.5) {
    this.scene = scene;
    this.generateClouds(density);
  }

  private generateClouds(density: number): void {
    const cloudCount = Math.floor(80 * density);
    const cloudMaterial = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.7,
      flatShading: true,
    });

    const rng = this.seededRng(54321);

    for (let i = 0; i < cloudCount; i++) {
      const cloud = new THREE.Group();
      
      // Each cloud is made of 3-8 low-poly spheres clustered together
      const puffCount = 3 + Math.floor(rng() * 6);
      
      for (let j = 0; j < puffCount; j++) {
        const puff = new THREE.Mesh(
          new THREE.IcosahedronGeometry(8 + rng() * 12, 0), // low-poly sphere
          cloudMaterial
        );
        
        // Cluster puffs together
        puff.position.set(
          (rng() - 0.5) * 25,
          (rng() - 0.5) * 8,
          (rng() - 0.5) * 25
        );
        
        puff.scale.set(
          0.8 + rng() * 0.6,
          0.6 + rng() * 0.4,
          0.8 + rng() * 0.6
        );
        
        cloud.add(puff);
      }

      // Position clouds in the sky
      const x = (rng() - 0.5) * 32000;  // Doubled for 40km terrain
      const z = (rng() - 0.5) * 32000;
      const y = 400 + rng() * 600; // Clouds between 400-1000m altitude
      
      cloud.position.set(x, y, z);
      cloud.rotation.y = rng() * Math.PI * 2;
      
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
    // Gently drift clouds
    for (const cloud of this.clouds) {
      cloud.position.x += dt * 2;
      cloud.position.z += dt * 1;
      
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
