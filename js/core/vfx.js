// VFX System for PHLY - Explosions, Smoke, Fire, Tracers, Muzzle Flash
const VFXSystem = {
  scene: null,
  explosions: [],
  smokeParticles: [],
  flareEffects: [],
  flashLights: [],

  init(scene) {
    this.scene = scene;
    this.explosions = [];
    this.smokeParticles = [];
    this.flareEffects = [];
    this.flashLights = [];
    console.log('[PHLY][VFX] Initialized');
  },

  explosion(position, radius) {
    radius = radius || 10;
    const particleCount = Math.min(2000, Math.floor(radius * 80));
    const positions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    const lifetimes = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      positions[i3] = position.x + (Math.random() - 0.5) * 2;
      positions[i3 + 1] = position.y + (Math.random() - 0.5) * 2;
      positions[i3 + 2] = position.z + (Math.random() - 0.5) * 2;

      const speed = radius * (0.5 + Math.random() * 1.5);
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.6; // Hemisphere bias upward
      velocities[i3] = Math.sin(phi) * Math.cos(theta) * speed;
      velocities[i3 + 1] = Math.cos(phi) * speed + Math.random() * speed * 0.5;
      velocities[i3 + 2] = Math.sin(phi) * Math.sin(theta) * speed;

      // Start white-yellow
      colors[i3] = 1.0;
      colors[i3 + 1] = 0.9 + Math.random() * 0.1;
      colors[i3 + 2] = 0.3 + Math.random() * 0.4;

      sizes[i] = 2 + Math.random() * 4;
      lifetimes[i] = 0;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const mat = new THREE.PointsMaterial({
      size: 3,
      vertexColors: true,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    const points = new THREE.Points(geo, mat);
    this.scene.add(points);

    // Point light flash
    const light = new THREE.PointLight(0xff8800, radius * 2, radius * 5);
    light.position.copy(position);
    this.scene.add(light);

    this.explosions.push({
      points, geo, mat, light, velocities, lifetimes, positions,
      colors, sizes, particleCount, maxLife: 1.5 + radius * 0.05, age: 0,
    });
  },

  nukeExplosion(position) {
    // Massive explosion
    this.explosion(position, 200);
    // Secondary expanding ring
    setTimeout(() => this.explosion(position.clone().add(new THREE.Vector3(0, 100, 0)), 300), 500);
    // Screen flash
    const flash = document.getElementById('redout-overlay');
    if (flash) {
      flash.style.background = 'rgba(255,255,200,0.9)';
      setTimeout(() => { flash.style.background = 'rgba(255,255,200,0)'; }, 1500);
    }
    console.log('[PHLY][VFX] NUCLEAR DETONATION');
  },

  muzzleFlash(position, color) {
    const flashGeo = new THREE.PlaneGeometry(2, 2);
    const flashMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color || '#ffff88'),
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const flash = new THREE.Mesh(flashGeo, flashMat);
    flash.position.copy(position);
    // Always face camera
    flash.lookAt(FlightPhysics.position);
    this.scene.add(flash);

    const light = new THREE.PointLight(new THREE.Color(color || '#ffff88'), 8, 40);
    light.position.copy(position);
    this.scene.add(light);

    this.flashLights.push({ mesh: flash, light, age: 0, maxAge: 0.06 });
  },

  hitSpark(position) {
    const count = 8;
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      positions[i3] = position.x;
      positions[i3 + 1] = position.y;
      positions[i3 + 2] = position.z;
      velocities[i3] = (Math.random() - 0.5) * 20;
      velocities[i3 + 1] = (Math.random() - 0.5) * 20;
      velocities[i3 + 2] = (Math.random() - 0.5) * 20;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      size: 1.5, color: 0xffaa44, transparent: true, opacity: 1,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const points = new THREE.Points(geo, mat);
    this.scene.add(points);
    this.explosions.push({
      points, geo, mat, light: null, velocities,
      lifetimes: new Float32Array(count),
      positions, colors: null, sizes: null,
      particleCount: count, maxLife: 0.3, age: 0,
    });
  },

  emitSmoke(position, isFire) {
    const count = isFire ? 5 : 3;
    for (let i = 0; i < count; i++) {
      const particle = {
        position: position.clone().add(new THREE.Vector3(
          (Math.random() - 0.5) * 3,
          (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 3
        )),
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 5,
          3 + Math.random() * 5,
          (Math.random() - 0.5) * 5
        ),
        age: 0,
        maxAge: 1.5 + Math.random(),
        isFire,
        mesh: null,
      };

      const geo = new THREE.PlaneGeometry(isFire ? 1.5 : 2.5, isFire ? 1.5 : 2.5);
      const mat = new THREE.MeshBasicMaterial({
        color: isFire ? 0xff6600 : 0x222222,
        transparent: true,
        opacity: isFire ? 0.7 : 0.5,
        blending: isFire ? THREE.AdditiveBlending : THREE.NormalBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      particle.mesh = new THREE.Mesh(geo, mat);
      particle.mesh.position.copy(particle.position);
      this.scene.add(particle.mesh);
      this.smokeParticles.push(particle);
    }
  },

  spawnFlares(position) {
    const count = 8;
    for (let i = 0; i < count; i++) {
      const flare = {
        position: position.clone(),
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 30,
          -5 + Math.random() * 10,
          (Math.random() - 0.5) * 30
        ),
        age: 0,
        maxAge: 3,
        mesh: null,
        light: null,
      };
      const geo = new THREE.SphereGeometry(0.3, 4, 4);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffff88,
        transparent: true,
        opacity: 1,
        blending: THREE.AdditiveBlending,
      });
      flare.mesh = new THREE.Mesh(geo, mat);
      flare.mesh.position.copy(position);
      this.scene.add(flare.mesh);

      const light = new THREE.PointLight(0xffaa44, 3, 50);
      light.position.copy(position);
      this.scene.add(light);
      flare.light = light;

      this.flareEffects.push(flare);
    }
    console.log('[PHLY][VFX] Flares deployed');
  },

  update(dt) {
    // Update explosions
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const ex = this.explosions[i];
      ex.age += dt;
      const lifeRatio = ex.age / ex.maxLife;

      if (lifeRatio >= 1) {
        this.scene.remove(ex.points);
        ex.geo.dispose();
        ex.mat.dispose();
        if (ex.light) { this.scene.remove(ex.light); ex.light.dispose(); }
        this.explosions.splice(i, 1);
        continue;
      }

      const pos = ex.positions;
      const vel = ex.velocities;
      for (let j = 0; j < ex.particleCount; j++) {
        const j3 = j * 3;
        pos[j3] += vel[j3] * dt;
        pos[j3 + 1] += vel[j3 + 1] * dt;
        pos[j3 + 2] += vel[j3 + 2] * dt;
        // Slow down
        vel[j3] *= 0.97;
        vel[j3 + 1] *= 0.97;
        vel[j3 + 2] *= 0.97;
        vel[j3 + 1] -= 3 * dt; // Gravity

        // Color transition: white-yellow -> orange -> dark smoke
        if (ex.colors) {
          if (lifeRatio < 0.3) {
            ex.colors[j3] = 1.0;
            ex.colors[j3 + 1] = PHLYMath.lerp(0.9, 0.5, lifeRatio / 0.3);
            ex.colors[j3 + 2] = PHLYMath.lerp(0.5, 0.0, lifeRatio / 0.3);
          } else {
            const t = (lifeRatio - 0.3) / 0.7;
            ex.colors[j3] = PHLYMath.lerp(1.0, 0.15, t);
            ex.colors[j3 + 1] = PHLYMath.lerp(0.5, 0.12, t);
            ex.colors[j3 + 2] = PHLYMath.lerp(0.0, 0.1, t);
          }
        }
      }

      ex.geo.attributes.position.needsUpdate = true;
      if (ex.colors) ex.geo.attributes.color.needsUpdate = true;
      ex.mat.opacity = 1 - lifeRatio * 0.7;

      if (ex.light) {
        ex.light.intensity = Math.max(0, ex.light.intensity - dt * 20);
      }
    }

    // Update smoke particles
    for (let i = this.smokeParticles.length - 1; i >= 0; i--) {
      const p = this.smokeParticles[i];
      p.age += dt;
      if (p.age >= p.maxAge) {
        if (p.mesh) {
          this.scene.remove(p.mesh);
          p.mesh.geometry.dispose();
          p.mesh.material.dispose();
        }
        this.smokeParticles.splice(i, 1);
        continue;
      }
      p.position.add(p.velocity.clone().multiplyScalar(dt));
      p.velocity.x += (Math.random() - 0.5) * 10 * dt; // Turbulence
      p.velocity.z += (Math.random() - 0.5) * 10 * dt;
      if (p.mesh) {
        p.mesh.position.copy(p.position);
        p.mesh.material.opacity = (1 - p.age / p.maxAge) * (p.isFire ? 0.7 : 0.4);
        const scale = 1 + p.age * 2;
        p.mesh.scale.set(scale, scale, scale);
      }
    }

    // Update flares
    for (let i = this.flareEffects.length - 1; i >= 0; i--) {
      const f = this.flareEffects[i];
      f.age += dt;
      if (f.age >= f.maxAge) {
        if (f.mesh) { this.scene.remove(f.mesh); f.mesh.geometry.dispose(); f.mesh.material.dispose(); }
        if (f.light) { this.scene.remove(f.light); f.light.dispose(); }
        this.flareEffects.splice(i, 1);
        continue;
      }
      f.position.add(f.velocity.clone().multiplyScalar(dt));
      f.velocity.y -= 5 * dt;
      if (f.mesh) {
        f.mesh.position.copy(f.position);
        f.mesh.material.opacity = 1 - f.age / f.maxAge;
      }
      if (f.light) {
        f.light.position.copy(f.position);
        f.light.intensity = (1 - f.age / f.maxAge) * 3;
      }
    }

    // Update flash lights (muzzle flash)
    for (let i = this.flashLights.length - 1; i >= 0; i--) {
      const fl = this.flashLights[i];
      fl.age += dt;
      if (fl.age >= fl.maxAge) {
        if (fl.mesh) { this.scene.remove(fl.mesh); fl.mesh.geometry.dispose(); fl.mesh.material.dispose(); }
        if (fl.light) { this.scene.remove(fl.light); fl.light.dispose(); }
        this.flashLights.splice(i, 1);
      }
    }
  },

  // Cleanup all
  dispose() {
    for (const ex of this.explosions) {
      this.scene.remove(ex.points);
      ex.geo.dispose();
      ex.mat.dispose();
      if (ex.light) { this.scene.remove(ex.light); ex.light.dispose(); }
    }
    for (const p of this.smokeParticles) {
      if (p.mesh) { this.scene.remove(p.mesh); p.mesh.geometry.dispose(); p.mesh.material.dispose(); }
    }
    for (const f of this.flareEffects) {
      if (f.mesh) { this.scene.remove(f.mesh); f.mesh.geometry.dispose(); f.mesh.material.dispose(); }
      if (f.light) { this.scene.remove(f.light); f.light.dispose(); }
    }
    this.explosions = [];
    this.smokeParticles = [];
    this.flareEffects = [];
    this.flashLights = [];
  },
};

window.VFXSystem = VFXSystem;
console.log('[PHLY] VFX module loaded');
