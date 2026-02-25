// Weapons System for PHLY
const WeaponSystem = {
  scene: null,
  bullets: [],
  missiles: [],
  bombs: [],
  rockets: [],

  gunHeat: 0,
  gunOverheated: false,
  gunOverheatCooldown: 5,
  gunOverheatTimer: 0,
  lastFireTime: 0,
  activeSlot: 0, // 0 = slot1, 1 = slot2
  ordnanceAmmo: [0, 0],

  // Countermeasure state
  flareCharges: 0,
  chaffCharges: 0,
  dircmActive: false,

  init(scene, loadout) {
    this.scene = scene;
    this.bullets = [];
    this.missiles = [];
    this.bombs = [];
    this.rockets = [];
    this.gunHeat = 0;
    this.gunOverheated = false;
    this.activeSlot = 0;

    // Init ordnance ammo
    const slots = [loadout.slot1, loadout.slot2];
    slots.forEach((slotId, idx) => {
      if (!slotId) { this.ordnanceAmmo[idx] = 0; return; }
      const ord = EQUIPMENT.ordnance.find(o => o.id === slotId);
      this.ordnanceAmmo[idx] = ord ? ord.qty : 0;
    });

    // Init countermeasures
    const cm = EQUIPMENT.countermeasures.find(c => c.id === loadout.countermeasures);
    if (cm) {
      if (cm.type === 'flare') { this.flareCharges = cm.charges; this.chaffCharges = 0; }
      else if (cm.type === 'chaff') { this.flareCharges = 0; this.chaffCharges = cm.charges; }
      else if (cm.type === 'ecm') {
        this.flareCharges = cm.charges.flare;
        this.chaffCharges = cm.charges.chaff;
        this.dircmActive = true;
      }
      else if (cm.type === 'dircm') { this.dircmActive = true; }
    }

    console.log('[PHLY][Weapons] Initialized. Ammo:', this.ordnanceAmmo, 'Flares:', this.flareCharges, 'Chaff:', this.chaffCharges);
  },

  fireGun(origin, direction, gunData, dt) {
    if (this.gunOverheated) return false;

    const fireInterval = 60 / gunData.rof;
    const now = performance.now() / 1000;
    if (now - this.lastFireTime < fireInterval) return false;
    this.lastFireTime = now;

    // Heat
    this.gunHeat = Math.min(1, this.gunHeat + gunData.heatRate);
    if (this.gunHeat >= 1) {
      this.gunOverheated = true;
      this.gunOverheatTimer = this.gunOverheatCooldown;
      console.log('[PHLY][Weapons] Gun OVERHEATED!');
      return false;
    }

    // Create bullet
    const bullet = {
      position: origin.clone(),
      velocity: direction.clone().multiplyScalar(gunData.bulletVel),
      damage: gunData.dmg,
      range: gunData.range,
      traveled: 0,
      tracerColor: gunData.tracerColor,
      splash: gunData.splash || 0,
      line: null,
      age: 0,
    };

    // Create tracer visual
    const points = [origin.clone(), origin.clone().add(direction.clone().multiplyScalar(5))];
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({ color: new THREE.Color(gunData.tracerColor), linewidth: 2, transparent: true, opacity: 0.9 });
    bullet.line = new THREE.Line(geo, mat);
    this.scene.add(bullet.line);
    this.bullets.push(bullet);

    // Muzzle flash VFX
    if (window.VFXSystem) VFXSystem.muzzleFlash(origin, gunData.tracerColor);

    return true;
  },

  fireOrdnance(origin, direction, loadout, aircraftQuat) {
    const slotId = this.activeSlot === 0 ? loadout.slot1 : loadout.slot2;
    if (!slotId || this.ordnanceAmmo[this.activeSlot] <= 0) return false;

    const ordData = EQUIPMENT.ordnance.find(o => o.id === slotId);
    if (!ordData) return false;

    this.ordnanceAmmo[this.activeSlot]--;

    if (ordData.type === 'ir_missile' || ordData.type === 'radar_missile') {
      this._fireMissile(origin, direction, ordData);
    } else if (ordData.type === 'bomb' || ordData.type === 'nuke') {
      this._dropBomb(origin, FlightPhysics.velocity.clone(), ordData);
    } else if (ordData.type === 'rockets') {
      this._fireRocket(origin, direction, ordData);
    } else if (ordData.type === 'recoilless') {
      this._fireRocket(origin, direction, ordData);
    }

    console.log(`[PHLY][Weapons] Fired ${ordData.name}. Remaining: ${this.ordnanceAmmo[this.activeSlot]}`);
    return true;
  },

  _fireMissile(origin, direction, ordData) {
    const missile = {
      position: origin.clone(),
      velocity: direction.clone().multiplyScalar(ordData.speed || 800),
      direction: direction.clone(),
      damage: ordData.dmg,
      blastRadius: ordData.blastR,
      range: ordData.range || 2000,
      traveled: 0,
      type: ordData.type,
      guidance: ordData.guidance,
      gLimit: ordData.gLim || 4,
      target: null,
      age: 0,
      mesh: null,
    };

    // Find target
    missile.target = this._findMissileTarget(origin, direction, ordData);

    // Create missile mesh
    const missileGeo = new THREE.CylinderGeometry(0.05, 0.05, 1.5, 6);
    missileGeo.rotateX(Math.PI / 2);
    const missileMat = new THREE.MeshPhongMaterial({ color: 0xdddddd, emissive: 0x332200, emissiveIntensity: 0.5 });
    missile.mesh = new THREE.Mesh(missileGeo, missileMat);
    missile.mesh.position.copy(origin);
    this.scene.add(missile.mesh);

    // Exhaust light
    const light = new THREE.PointLight(0xff6600, 2, 20);
    missile.mesh.add(light);
    missile.light = light;

    this.missiles.push(missile);

    if (window.AudioSystem) AudioSystem.playMissileLaunch();
  },

  _dropBomb(origin, inheritVel, ordData) {
    const bomb = {
      position: origin.clone(),
      velocity: inheritVel.clone(),
      damage: ordData.dmg,
      blastRadius: ordData.blastR,
      type: ordData.type,
      fuseTime: ordData.fuseTime || 0,
      age: 0,
      mesh: null,
      armed: ordData.fuseTime ? false : true,
    };

    const bombGeo = new THREE.SphereGeometry(ordData.type === 'nuke' ? 0.5 : 0.2, 6, 6);
    bombGeo.scale(1, 1, 2);
    const bombMat = new THREE.MeshPhongMaterial({ color: ordData.type === 'nuke' ? 0x444444 : 0x555555 });
    bomb.mesh = new THREE.Mesh(bombGeo, bombMat);
    bomb.mesh.position.copy(origin);
    this.scene.add(bomb.mesh);

    this.bombs.push(bomb);
  },

  _fireRocket(origin, direction, ordData) {
    const rocket = {
      position: origin.clone(),
      velocity: direction.clone().multiplyScalar(ordData.speed || 600),
      damage: ordData.dmg,
      blastRadius: ordData.blastR,
      range: ordData.range || 1500,
      traveled: 0,
      age: 0,
      mesh: null,
    };

    const rocketGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.8, 6);
    rocketGeo.rotateX(Math.PI / 2);
    const rocketMat = new THREE.MeshPhongMaterial({ color: 0xaaaaaa, emissive: 0x331100 });
    rocket.mesh = new THREE.Mesh(rocketGeo, rocketMat);
    rocket.mesh.position.copy(origin);
    this.scene.add(rocket.mesh);

    this.rockets.push(rocket);
  },

  _findMissileTarget(origin, direction, ordData) {
    // Find nearest enemy in front cone
    let bestTarget = null;
    let bestDot = 0.5; // Minimum forward dot product

    if (window.AIAirSystem) {
      for (const enemy of AIAirSystem.enemies) {
        if (enemy.hp <= 0) continue;
        const toEnemy = enemy.position.clone().sub(origin);
        const dist = toEnemy.length();
        if (dist > (ordData.range || 2000)) continue;
        toEnemy.normalize();
        const dot = direction.dot(toEnemy);
        if (dot > bestDot) {
          bestDot = dot;
          bestTarget = enemy;
        }
      }
    }

    if (window.AIGroundSystem) {
      for (const unit of AIGroundSystem.units) {
        if (unit.hp <= 0) continue;
        const toUnit = unit.position.clone().sub(origin);
        const dist = toUnit.length();
        if (dist > (ordData.range || 2000)) continue;
        toUnit.normalize();
        const dot = direction.dot(toUnit);
        if (dot > bestDot) {
          bestDot = dot;
          bestTarget = unit;
        }
      }
    }

    return bestTarget;
  },

  deployCountermeasures() {
    let deployed = false;
    if (this.flareCharges > 0) {
      this.flareCharges--;
      deployed = true;
      // Break IR missile locks
      for (const m of this.missiles) {
        if (m.guidance === 'ir' && m.target === 'player') {
          if (Math.random() < 0.85) m.target = null;
        }
      }
      if (window.VFXSystem) VFXSystem.spawnFlares(FlightPhysics.position);
      console.log(`[PHLY][Weapons] Flares deployed! Remaining: ${this.flareCharges}`);
    }
    if (this.chaffCharges > 0) {
      this.chaffCharges--;
      deployed = true;
      // Break radar missile locks
      for (const m of this.missiles) {
        if (m.guidance === 'radar' && m.target === 'player') {
          if (Math.random() < 0.80) m.target = null;
        }
      }
      console.log(`[PHLY][Weapons] Chaff deployed! Remaining: ${this.chaffCharges}`);
    }
    return deployed;
  },

  switchActiveSlot() {
    this.activeSlot = this.activeSlot === 0 ? 1 : 0;
    console.log(`[PHLY][Weapons] Switched to slot ${this.activeSlot + 1}`);
  },

  update(dt) {
    // Gun heat cooldown
    if (this.gunOverheated) {
      this.gunOverheatTimer -= dt;
      if (this.gunOverheatTimer <= 0) {
        this.gunOverheated = false;
        this.gunHeat = 0;
        console.log('[PHLY][Weapons] Gun cooled down');
      }
    } else {
      const gunData = EQUIPMENT.guns.find(g => g.id === Economy.loadout.gun);
      if (gunData) this.gunHeat = Math.max(0, this.gunHeat - gunData.coolRate * dt);
    }

    // Update bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      const move = b.velocity.clone().multiplyScalar(dt);
      b.position.add(move);
      b.traveled += move.length();
      b.age += dt;

      // Update tracer line
      if (b.line) {
        const points = [b.position.clone(), b.position.clone().sub(b.velocity.clone().normalize().multiplyScalar(Math.min(b.traveled, 15)))];
        b.line.geometry.setFromPoints(points);
      }

      // Hit detection
      let hit = false;
      if (b.isEnemyBullet) {
        // Enemy bullet -> check against player
        const distToPlayer = b.position.distanceTo(FlightPhysics.position);
        if (distToPlayer < 12 && !FlightPhysics.isDead) {
          FlightPhysics.takeDamage(b.damage);
          if (window.VFXSystem) VFXSystem.hitSpark(b.position);
          hit = true;
        }
      } else {
        // Player bullet -> check against enemies
        if (window.AIAirSystem) {
          hit = AIAirSystem.checkBulletHit(b);
        }
        if (!hit && window.AIGroundSystem) {
          hit = AIGroundSystem.checkBulletHit(b);
        }
      }

      // Terrain hit
      const terrainH = TerrainSystem.getTerrainHeight(b.position.x, b.position.z);
      if (b.position.y <= terrainH) hit = true;

      // Remove if out of range or hit
      if (b.traveled > b.range || b.age > 5 || hit) {
        if (b.line) {
          this.scene.remove(b.line);
          b.line.geometry.dispose();
          b.line.material.dispose();
        }
        this.bullets.splice(i, 1);
      }
    }

    // Update missiles
    for (let i = this.missiles.length - 1; i >= 0; i--) {
      const m = this.missiles[i];
      m.age += dt;

      // Guidance - resolve target position (handle 'player' string or enemy object)
      let targetPos = null;
      if (m.target === 'player') {
        targetPos = FlightPhysics.position;
      } else if (m.target && m.target.position && m.target.hp > 0) {
        targetPos = m.target.position;
      }

      if (targetPos) {
        const toTarget = targetPos.clone().sub(m.position);
        const dist = toTarget.length();
        if (dist < m.blastRadius * 2) {
          // Detonate
          this._detonateMissile(m);
          this._removeMissile(i);
          continue;
        }
        toTarget.normalize();
        const currentDir = m.velocity.clone().normalize();
        const maxTurn = m.gLimit * 9.81 * dt / m.velocity.length();
        const newDir = currentDir.lerp(toTarget, Math.min(1, maxTurn * 5));
        newDir.normalize();
        m.velocity.copy(newDir.multiplyScalar(m.velocity.length()));
      }

      // Apply gravity slightly
      m.velocity.y -= 2 * dt;

      m.position.add(m.velocity.clone().multiplyScalar(dt));
      m.traveled += m.velocity.length() * dt;

      if (m.mesh) {
        m.mesh.position.copy(m.position);
        m.mesh.lookAt(m.position.clone().add(m.velocity));
      }

      // Terrain hit
      const terrainH = TerrainSystem.getTerrainHeight(m.position.x, m.position.z);
      if (m.position.y <= terrainH || m.traveled > m.range || m.age > 30) {
        this._detonateMissile(m);
        this._removeMissile(i);
        continue;
      }

      // Proximity check against enemies
      let hitTarget = null;
      if (window.AIAirSystem) {
        for (const e of AIAirSystem.enemies) {
          if (e.hp <= 0) continue;
          if (e.position.distanceTo(m.position) < m.blastRadius) { hitTarget = e; break; }
        }
      }
      if (!hitTarget && window.AIGroundSystem) {
        for (const u of AIGroundSystem.units) {
          if (u.hp <= 0) continue;
          if (u.position.distanceTo(m.position) < m.blastRadius) { hitTarget = u; break; }
        }
      }
      if (hitTarget) {
        this._detonateMissile(m);
        this._removeMissile(i);
      }
    }

    // Update bombs
    for (let i = this.bombs.length - 1; i >= 0; i--) {
      const b = this.bombs[i];
      b.age += dt;
      b.velocity.y -= 9.81 * dt; // Gravity
      b.position.add(b.velocity.clone().multiplyScalar(dt));
      if (b.mesh) b.mesh.position.copy(b.position);

      // Nuke fuse
      if (b.type === 'nuke' && !b.armed && b.age >= b.fuseTime) {
        b.armed = true;
      }

      // Ground hit
      const terrainH = TerrainSystem.getTerrainHeight(b.position.x, b.position.z);
      if (b.position.y <= terrainH + 1) {
        if (b.armed || b.type !== 'nuke') {
          this._detonateBomb(b);
        }
        if (b.mesh) {
          this.scene.remove(b.mesh);
          b.mesh.geometry.dispose();
          b.mesh.material.dispose();
        }
        this.bombs.splice(i, 1);
      }
    }

    // Update rockets
    for (let i = this.rockets.length - 1; i >= 0; i--) {
      const r = this.rockets[i];
      r.age += dt;
      r.velocity.y -= 3 * dt;
      r.position.add(r.velocity.clone().multiplyScalar(dt));
      r.traveled += r.velocity.length() * dt;
      if (r.mesh) r.mesh.position.copy(r.position);

      const terrainH = TerrainSystem.getTerrainHeight(r.position.x, r.position.z);
      let detonate = r.position.y <= terrainH || r.traveled > (r.range || 1500) || r.age > 10;

      // Enemy proximity
      if (!detonate && window.AIAirSystem) {
        for (const e of AIAirSystem.enemies) {
          if (e.hp > 0 && e.position.distanceTo(r.position) < r.blastRadius + 3) { detonate = true; break; }
        }
      }
      if (!detonate && window.AIGroundSystem) {
        for (const u of AIGroundSystem.units) {
          if (u.hp > 0 && u.position.distanceTo(r.position) < r.blastRadius + 3) { detonate = true; break; }
        }
      }

      if (detonate) {
        if (window.VFXSystem) VFXSystem.explosion(r.position, r.blastRadius);
        if (window.AudioSystem) AudioSystem.playExplosion(r.position, r.blastRadius);
        // Damage nearby enemies
        this._splashDamage(r.position, r.blastRadius, r.damage);
        if (r.mesh) {
          this.scene.remove(r.mesh);
          r.mesh.geometry.dispose();
          r.mesh.material.dispose();
        }
        this.rockets.splice(i, 1);
      }
    }
  },

  _detonateMissile(m) {
    if (window.VFXSystem) VFXSystem.explosion(m.position, m.blastRadius);
    if (window.AudioSystem) AudioSystem.playExplosion(m.position, m.blastRadius);
    this._splashDamage(m.position, m.blastRadius, m.damage);
  },

  _removeMissile(idx) {
    const m = this.missiles[idx];
    if (m.mesh) {
      this.scene.remove(m.mesh);
      m.mesh.geometry.dispose();
      m.mesh.material.dispose();
    }
    this.missiles.splice(idx, 1);
  },

  _detonateBomb(b) {
    const radius = b.blastRadius;
    const isNuke = b.type === 'nuke';

    if (window.VFXSystem) {
      if (isNuke) {
        VFXSystem.nukeExplosion(b.position);
      } else {
        VFXSystem.explosion(b.position, radius);
      }
    }
    if (window.AudioSystem) AudioSystem.playExplosion(b.position, radius);
    this._splashDamage(b.position, radius, b.damage);
  },

  _splashDamage(center, radius, damage) {
    // Damage air enemies
    if (window.AIAirSystem) {
      for (const e of AIAirSystem.enemies) {
        if (e.hp <= 0) continue;
        const dist = e.position.distanceTo(center);
        if (dist < radius) {
          const falloff = 1 - dist / radius;
          const dmg = Math.floor(damage * falloff);
          AIAirSystem.damageEnemy(e, dmg);
        }
      }
    }
    // Damage ground units
    if (window.AIGroundSystem) {
      for (const u of AIGroundSystem.units) {
        if (u.hp <= 0) continue;
        const dist = u.position.distanceTo(center);
        if (dist < radius) {
          const falloff = 1 - dist / radius;
          const dmg = Math.floor(damage * falloff);
          AIGroundSystem.damageUnit(u, dmg);
        }
      }
    }
    // Damage player
    const playerDist = FlightPhysics.position.distanceTo(center);
    if (playerDist < radius) {
      const falloff = 1 - playerDist / radius;
      FlightPhysics.takeDamage(Math.floor(damage * falloff * 0.5));
    }
  },

  // For enemy firing at player
  fireEnemyBullet(origin, direction, damage, speed, range, tracerColor) {
    const bullet = {
      position: origin.clone(),
      velocity: direction.clone().multiplyScalar(speed),
      damage: damage,
      range: range,
      traveled: 0,
      tracerColor: tracerColor || '#ff4444',
      isEnemyBullet: true,
      age: 0,
      line: null,
    };
    const points = [origin.clone(), origin.clone().add(direction.clone().multiplyScalar(5))];
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({ color: new THREE.Color(tracerColor || '#ff4444'), transparent: true, opacity: 0.8 });
    bullet.line = new THREE.Line(geo, mat);
    this.scene.add(bullet.line);
    this.bullets.push(bullet);
  },

  // Fire enemy missile at player
  fireEnemyMissile(origin, direction, type, damage, blastR, range, speed) {
    const missile = {
      position: origin.clone(),
      velocity: direction.clone().multiplyScalar(speed || 800),
      direction: direction.clone(),
      damage: damage,
      blastRadius: blastR || 8,
      range: range || 2000,
      traveled: 0,
      type: type,
      guidance: type === 'ir_missile' ? 'ir' : 'radar',
      gLimit: type === 'ir_missile' ? 4 : 8,
      target: 'player',
      age: 0,
      mesh: null,
      isEnemy: true,
    };

    const missileGeo = new THREE.CylinderGeometry(0.05, 0.05, 1.2, 6);
    missileGeo.rotateX(Math.PI / 2);
    const missileMat = new THREE.MeshPhongMaterial({ color: 0xdd4444, emissive: 0x441100 });
    missile.mesh = new THREE.Mesh(missileGeo, missileMat);
    missile.mesh.position.copy(origin);
    this.scene.add(missile.mesh);

    this.missiles.push(missile);
    if (window.AudioSystem) AudioSystem.playMissileWarning();
  },

  getActiveSlotInfo(loadout) {
    const slotId = this.activeSlot === 0 ? loadout.slot1 : loadout.slot2;
    if (!slotId) return null;
    const ord = EQUIPMENT.ordnance.find(o => o.id === slotId);
    return ord ? { ...ord, ammo: this.ordnanceAmmo[this.activeSlot] } : null;
  },
};

window.WeaponSystem = WeaponSystem;
console.log('[PHLY] Weapons module loaded');
