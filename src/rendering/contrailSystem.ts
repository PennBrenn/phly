import * as THREE from 'three';

const MAX_PARTICLES = 400;
const PARTICLE_LIFETIME = 2.5; // seconds
const EMIT_RATE = 80; // particles per second at full throttle
const SPREAD = 0.3;
const INITIAL_SIZE = 0.4;
const FINAL_SIZE = 3.0;
const INITIAL_OPACITY = 0.5;

interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  age: number;
  maxAge: number;
}

export class ContrailSystem {
  private particles: Particle[] = [];
  private geometry: THREE.BufferGeometry;
  private material: THREE.PointsMaterial;
  private points: THREE.Points;
  private emitAccum = 0;

  // Engine offsets in local space (left and right engine)
  private engineOffsets = [
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

  update(
    dt: number,
    planePosition: THREE.Vector3,
    planeQuaternion: THREE.Quaternion,
    throttle: number,
    speed: number,
  ): void {
    // Age and remove dead particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].age += dt;
      if (this.particles[i].age >= this.particles[i].maxAge) {
        this.particles.splice(i, 1);
      }
    }

    // Emit new particles based on throttle
    const emitThisFrame = EMIT_RATE * throttle * dt;
    this.emitAccum += emitThisFrame;

    while (this.emitAccum >= 1 && this.particles.length < MAX_PARTICLES) {
      this.emitAccum -= 1;

      for (const offset of this.engineOffsets) {
        if (this.particles.length >= MAX_PARTICLES) break;

        const worldOffset = offset.clone().applyQuaternion(planeQuaternion);
        const pos = planePosition.clone().add(worldOffset);

        // Add some random spread
        pos.x += (Math.random() - 0.5) * SPREAD;
        pos.y += (Math.random() - 0.5) * SPREAD;
        pos.z += (Math.random() - 0.5) * SPREAD;

        // Particle velocity: slight drift backward + upward
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
          maxAge: PARTICLE_LIFETIME * (0.8 + Math.random() * 0.4),
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
        // Hide unused particles far away
        posArray[i * 3] = 0;
        posArray[i * 3 + 1] = -10000;
        posArray[i * 3 + 2] = 0;
      }
    }

    posAttr.needsUpdate = true;

    // Update material opacity based on average particle age
    if (this.particles.length > 0) {
      const avgRatio = this.particles.reduce((s, p) => s + p.age / p.maxAge, 0) / this.particles.length;
      this.material.opacity = INITIAL_OPACITY * (1 - avgRatio * 0.7);
      this.material.size = INITIAL_SIZE + (FINAL_SIZE - INITIAL_SIZE) * avgRatio;
    }

    this.geometry.setDrawRange(0, this.particles.length);
  }
}
