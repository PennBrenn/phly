import * as THREE from 'three';

const MAX_PARTICLES = 600;
const PARTICLE_LIFETIME = 2.5;
const EMIT_RATE = 80;
const AB_EMIT_RATE = 160;       // afterburner doubles emit rate
const SPREAD = 0.3;
const INITIAL_SIZE = 0.4;
const FINAL_SIZE = 3.0;
const INITIAL_OPACITY = 0.5;
const AB_INITIAL_SIZE = 0.6;
const AB_FINAL_SIZE = 2.0;

interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  age: number;
  maxAge: number;
  isAB: boolean;  // afterburner particle (orange tinted, shorter life)
}

export class ContrailSystem {
  private particles: Particle[] = [];
  private geometry: THREE.BufferGeometry;
  private material: THREE.PointsMaterial;
  private points: THREE.Points;
  private emitAccum = 0;

  // Engine offsets in local space — configurable from plane JSON
  private engineOffsets: THREE.Vector3[] = [
    new THREE.Vector3(-1.2, -0.1, 2.5),
    new THREE.Vector3(1.2, -0.1, 2.5),
  ];

  constructor(scene: THREE.Scene) {
    this.geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(MAX_PARTICLES * 3);
    const sizes = new Float32Array(MAX_PARTICLES);
    const alphas = new Float32Array(MAX_PARTICLES);

    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    this.geometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));

    this.material = new THREE.PointsMaterial({
      color: 0xcccccc,
      size: INITIAL_SIZE,
      transparent: true,
      opacity: INITIAL_OPACITY,
      depthWrite: false,
      sizeAttenuation: true,
      blending: THREE.NormalBlending,
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  /** Set engine positions from plane JSON data. */
  setEngineOffsets(offsets: { x: number; y: number; z: number }[]): void {
    this.engineOffsets = offsets.map(o => new THREE.Vector3(o.x, o.y, o.z));
  }

  update(
    dt: number,
    planePosition: THREE.Vector3,
    planeQuaternion: THREE.Quaternion,
    throttle: number,
    speed: number,
    afterburner = false,
  ): void {
    // Age and remove dead particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].age += dt;
      if (this.particles[i].age >= this.particles[i].maxAge) {
        this.particles.splice(i, 1);
      }
    }

    // Emit new particles based on throttle (more when in afterburner)
    const rate = afterburner ? AB_EMIT_RATE : EMIT_RATE;
    const emitThisFrame = rate * throttle * dt;
    this.emitAccum += emitThisFrame;

    while (this.emitAccum >= 1 && this.particles.length < MAX_PARTICLES) {
      this.emitAccum -= 1;

      for (const offset of this.engineOffsets) {
        if (this.particles.length >= MAX_PARTICLES) break;

        const worldOffset = offset.clone().applyQuaternion(planeQuaternion);
        const pos = planePosition.clone().add(worldOffset);

        pos.x += (Math.random() - 0.5) * SPREAD;
        pos.y += (Math.random() - 0.5) * SPREAD;
        pos.z += (Math.random() - 0.5) * SPREAD;

        const backward = new THREE.Vector3(0, 0, 1)
          .applyQuaternion(planeQuaternion)
          .multiplyScalar(speed * 0.05);
        const drift = new THREE.Vector3(
          (Math.random() - 0.5) * 0.5,
          Math.random() * 0.3,
          (Math.random() - 0.5) * 0.5,
        );

        this.particles.push({
          position: pos,
          velocity: backward.add(drift),
          age: 0,
          maxAge: afterburner
            ? PARTICLE_LIFETIME * 0.5 * (0.8 + Math.random() * 0.4)
            : PARTICLE_LIFETIME * (0.8 + Math.random() * 0.4),
          isAB: afterburner,
        });
      }
    }

    // Update particles
    const posAttr = this.geometry.getAttribute('position') as THREE.BufferAttribute;
    const posArray = posAttr.array as Float32Array;

    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (i < this.particles.length) {
        const p = this.particles[i];
        p.position.add(p.velocity.clone().multiplyScalar(dt));

        posArray[i * 3] = p.position.x;
        posArray[i * 3 + 1] = p.position.y;
        posArray[i * 3 + 2] = p.position.z;
      } else {
        posArray[i * 3] = 0;
        posArray[i * 3 + 1] = -10000;
        posArray[i * 3 + 2] = 0;
      }
    }

    posAttr.needsUpdate = true;

    // Update material based on particle mix
    if (this.particles.length > 0) {
      const abCount = this.particles.filter(p => p.isAB).length;
      const abRatio = abCount / this.particles.length;
      const avgRatio = this.particles.reduce((s, p) => s + p.age / p.maxAge, 0) / this.particles.length;
      this.material.opacity = INITIAL_OPACITY * (1 - avgRatio * 0.7);

      // Blend size and color between normal contrail and AB exhaust
      const sz0 = INITIAL_SIZE + abRatio * (AB_INITIAL_SIZE - INITIAL_SIZE);
      const sz1 = FINAL_SIZE + abRatio * (AB_FINAL_SIZE - FINAL_SIZE);
      this.material.size = sz0 + (sz1 - sz0) * avgRatio;

      // Tint orange when afterburner particles dominate
      if (abRatio > 0.3) {
        const r = 0.8 + abRatio * 0.2;
        const g = 0.5 + (1 - abRatio) * 0.3;
        const b = 0.2 + (1 - abRatio) * 0.6;
        this.material.color.setRGB(r, g, b);
      } else {
        this.material.color.setRGB(0.8, 0.8, 0.8);
      }
    }

    this.geometry.setDrawRange(0, this.particles.length);
  }
}
