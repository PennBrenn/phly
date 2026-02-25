// Ground Enemy AI System for PHLY
const AIGroundSystem = {
  units: [],
  convoys: [],
  scene: null,
  maxUnits: 30,
  spawnTimer: 0,
  difficulty: 'medium',
  difficultyData: null,

  init(scene, settings) {
    this.scene = scene;
    this.units = [];
    this.convoys = [];
    this.maxUnits = settings.maxEnemies || 12;
    this.difficulty = settings.difficulty || 'medium';
    this.difficultyData = DIFFICULTY[this.difficulty];
    this.spawnTimer = 8;
    console.log(`[PHLY][AI-Ground] Init: max=${this.maxUnits}, diff=${this.difficulty}`);
  },

  update(dt, playerPos) {
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.units.length < this.maxUnits) {
      this._spawnGroundUnits(playerPos);
      this.spawnTimer = 15 + Math.random() * 15;
    }

    for (let i = this.units.length - 1; i >= 0; i--) {
      const unit = this.units[i];
      if (unit.hp <= 0) {
        unit.deathTimer -= dt;
        if (unit.deathTimer <= 0 && !unit.isWreckage) {
          this._convertToWreckage(unit);
        }
        if (unit.wreckageTimer !== undefined) {
          unit.wreckageTimer -= dt;
          if (unit.wreckageTimer <= 0) this._removeUnit(i);
        }
        continue;
      }
      this._updateGroundAI(unit, dt, playerPos);
      this._updateGroundMovement(unit, dt);
      if (unit.mesh) {
        unit.mesh.position.copy(unit.position);
        unit.mesh.quaternion.copy(unit.quaternion);
      }
    }

    // Update convoys
    for (const convoy of this.convoys) {
      const alive = convoy.trucks.filter(t => t.hp > 0).length;
      if (alive === 0 && !convoy.bonusAwarded) {
        convoy.bonusAwarded = true;
        const bonus = convoy.trucks.length * (200 + Math.floor(Math.random() * 300));
        Economy.adjustBalance(bonus, `Convoy Destroyed bonus`);
        if (convoy.hasCommand) Economy.adjustBalance(bonus, 'Command Vehicle convoy double bonus');
        console.log(`[PHLY][AI-Ground] Convoy destroyed! Bonus: $${bonus}`);
        if (window.HUD) HUD.killFlash('CONVOY DESTROYED', bonus);
      }
    }
  },

  _spawnGroundUnits(playerPos) {
    // Choose what to spawn
    const roll = Math.random();
    if (roll < 0.25) {
      this._spawnConvoy(playerPos);
    } else if (roll < 0.5) {
      this._spawnDefenseCluster(playerPos);
    } else {
      this._spawnSingleUnit(playerPos);
    }
  },

  _spawnSingleUnit(playerPos) {
    const tierWeights = [0.15, 0.15, 0.12, 0.12, 0.1, 0.08, 0.08, 0.05, 0.08, 0.07];
    let r = Math.random();
    let idx = 0;
    for (let i = 0; i < tierWeights.length; i++) {
      r -= tierWeights[i];
      if (r <= 0) { idx = i; break; }
    }
    const tierData = ENEMY_TIERS.ground[idx];

    const angle = Math.random() * Math.PI * 2;
    const dist = 1000 + Math.random() * 4000;
    const x = playerPos.x + Math.cos(angle) * dist;
    const z = playerPos.z + Math.sin(angle) * dist;

    // Check if water-only or static placement
    const terrainH = TerrainSystem.getTerrainHeight(x, z);
    if (tierData.waterOnly && terrainH > 0) return;
    if (!tierData.waterOnly && terrainH <= 0) return;
    if (tierData.speed === 0) {
      const slope = TerrainSystem.getSlopeAt(x, z);
      if (slope > 5) return;
    }

    this._createUnit(tierData, new THREE.Vector3(x, Math.max(terrainH, 0), z));
  },

  _spawnConvoy(playerPos) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 2000 + Math.random() * 3000;
    const startX = playerPos.x + Math.cos(angle) * dist;
    const startZ = playerPos.z + Math.sin(angle) * dist;
    const terrainH = TerrainSystem.getTerrainHeight(startX, startZ);
    if (terrainH <= 0) return;

    const truckCount = 3 + Math.floor(Math.random() * 4);
    const truckTier = ENEMY_TIERS.ground.find(t => t.id === 'truck');
    const convoy = { trucks: [], bonusAwarded: false, hasCommand: false };

    const dir = new THREE.Vector3(Math.cos(angle + Math.PI), 0, Math.sin(angle + Math.PI));

    for (let i = 0; i < truckCount; i++) {
      const offset = dir.clone().multiplyScalar(-i * 40);
      const pos = new THREE.Vector3(startX + offset.x, terrainH, startZ + offset.z);
      pos.y = TerrainSystem.getTerrainHeight(pos.x, pos.z);
      const unit = this._createUnit(truckTier, pos);
      unit.convoyDir = dir.clone();
      unit.isConvoyMember = true;
      convoy.trucks.push(unit);
    }

    // 20% chance of command vehicle on hard/elite
    if ((this.difficulty === 'hard' || this.difficulty === 'elite') && Math.random() < 0.2) {
      const cmdTier = ENEMY_TIERS.ground.find(t => t.id === 'command');
      const cmdOffset = dir.clone().multiplyScalar(-truckCount * 40);
      const cmdPos = new THREE.Vector3(startX + cmdOffset.x, terrainH, startZ + cmdOffset.z);
      cmdPos.y = TerrainSystem.getTerrainHeight(cmdPos.x, cmdPos.z);
      const cmd = this._createUnit(cmdTier, cmdPos);
      cmd.convoyDir = dir.clone();
      cmd.isConvoyMember = true;
      convoy.trucks.push(cmd);
      convoy.hasCommand = true;
    }

    this.convoys.push(convoy);
    console.log(`[PHLY][AI-Ground] Convoy spawned: ${truckCount} trucks${convoy.hasCommand ? ' + Command' : ''}`);
  },

  _spawnDefenseCluster(playerPos) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 2000 + Math.random() * 5000;
    const cx = playerPos.x + Math.cos(angle) * dist;
    const cz = playerPos.z + Math.sin(angle) * dist;
    const terrainH = TerrainSystem.getTerrainHeight(cx, cz);
    if (terrainH <= 5) return;
    const slope = TerrainSystem.getSlopeAt(cx, cz);
    if (slope > 10) return;

    // SAM + Radar + SPAAG cluster
    const clusterTypes = ['sam', 'radar', 'spaag'];
    for (const typeId of clusterTypes) {
      const tier = ENEMY_TIERS.ground.find(t => t.id === typeId);
      if (!tier) continue;
      const offsetAngle = Math.random() * Math.PI * 2;
      const offsetDist = 50 + Math.random() * 150;
      const x = cx + Math.cos(offsetAngle) * offsetDist;
      const z = cz + Math.sin(offsetAngle) * offsetDist;
      const h = TerrainSystem.getTerrainHeight(x, z);
      if (h > 0) this._createUnit(tier, new THREE.Vector3(x, h, z));
    }
    console.log('[PHLY][AI-Ground] Defense cluster spawned');
  },

  _createUnit(tierData, position) {
    const unit = {
      id: `gnd_${Date.now()}_${Math.random().toString(36).substr(2,4)}`,
      tier: tierData,
      hp: Math.floor(tierData.hp * this.difficultyData.hpMult),
      maxHp: Math.floor(tierData.hp * this.difficultyData.hpMult),
      position: position.clone(),
      velocity: new THREE.Vector3(),
      quaternion: new THREE.Quaternion(),
      heading: Math.random() * Math.PI * 2,
      speed: 0,
      maxSpeed: tierData.speed,
      state: AI_STATES.PATROL,
      stateTimer: 0,
      fireTimer: 0,
      lockTimer: 0,
      waypoints: [],
      currentWaypoint: 0,
      mesh: null,
      deathTimer: 2,
      isWreckage: false,
      wreckageTimer: undefined,
      baseReward: tierData.rewards[this.difficultyData.rewardKey],
      climbLimit: tierData.climbLimit,
      sightRange: tierData.sightRange,
      weaponRange: tierData.weaponRange,
      radarDishAngle: 0,
    };

    // Generate initial waypoints
    for (let i = 0; i < 6; i++) {
      const wp = this._generateWaypoint(position, tierData);
      if (wp) unit.waypoints.push(wp);
    }

    // Build mesh
    unit.mesh = AircraftBuilder.buildGroundUnit(tierData);
    unit.mesh.position.copy(position);
    this.scene.add(unit.mesh);

    this.units.push(unit);
    return unit;
  },

  _generateWaypoint(center, tierData) {
    for (let attempt = 0; attempt < 10; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 300 + Math.random() * 900;
      const x = center.x + Math.cos(angle) * dist;
      const z = center.z + Math.sin(angle) * dist;
      const h = TerrainSystem.getTerrainHeight(x, z);
      if (tierData.waterOnly && h > 0) continue;
      if (!tierData.waterOnly && h <= 0) continue;
      const slope = TerrainSystem.getSlopeAt(x, z);
      if (slope > tierData.climbLimit) continue;
      return new THREE.Vector3(x, Math.max(h, 0), z);
    }
    return null;
  },

  _updateGroundAI(unit, dt, playerPos) {
    const distToPlayer = unit.position.distanceTo(playerPos);
    unit.stateTimer += dt;

    // Command vehicle sight buff: boost nearby unit sight ranges
    if (unit.tier.sightBuff) {
      for (const other of this.units) {
        if (other === unit || other.hp <= 0) continue;
        if (other.position.distanceTo(unit.position) < unit.tier.sightBuff) {
          other._sightBuffed = true;
        }
      }
    }

    // Radar station extends sight
    if (unit.tier.sightBoost) {
      unit.radarDishAngle += dt * Math.PI * 0.2; // 6 RPM
      for (const other of this.units) {
        if (other === unit || other.hp <= 0) continue;
        if (other.position.distanceTo(unit.position) < unit.tier.boostRange) {
          other._radarBoosted = true;
        }
      }
    }

    const effectiveSight = unit.sightRange * (unit._radarBoosted ? 1.5 : 1) * (unit._sightBuffed ? 1.2 : 1);
    unit._radarBoosted = false;
    unit._sightBuffed = false;

    switch (unit.state) {
      case AI_STATES.PATROL: {
        if (distToPlayer < effectiveSight) {
          unit.state = AI_STATES.ALERT;
          unit.stateTimer = 0;
          // Alert nearby units
          for (const other of this.units) {
            if (other === unit || other.hp <= 0) continue;
            if (other.position.distanceTo(unit.position) < 3000 && other.state === AI_STATES.PATROL) {
              other.state = AI_STATES.ALERT;
              other.stateTimer = 0;
            }
          }
        }
        // Follow waypoints
        if (unit.waypoints.length > 0 && unit.maxSpeed > 0) {
          const wp = unit.waypoints[unit.currentWaypoint % unit.waypoints.length];
          const distToWp = PHLYMath.distXZ(unit.position, wp);
          if (distToWp < 30) {
            unit.currentWaypoint++;
            if (unit.currentWaypoint >= unit.waypoints.length) {
              // Generate new waypoints
              unit.waypoints = [];
              for (let i = 0; i < 6; i++) {
                const wp2 = this._generateWaypoint(unit.position, unit.tier);
                if (wp2) unit.waypoints.push(wp2);
              }
              unit.currentWaypoint = 0;
            }
          }
          unit.targetPos = wp;
          unit.targetSpeed = unit.maxSpeed * 0.6;
        }
        break;
      }
      case AI_STATES.ALERT: {
        // Stop and slew turret toward player
        unit.targetSpeed = 0;
        unit.lookAtTarget = playerPos.clone();

        if (distToPlayer < unit.weaponRange && unit.weaponRange > 0) {
          unit.state = AI_STATES.ENGAGE;
          unit.stateTimer = 0;
        }
        if (distToPlayer > effectiveSight && unit.stateTimer > 8) {
          unit.state = AI_STATES.PATROL;
          unit.stateTimer = 0;
        }
        break;
      }
      case AI_STATES.ENGAGE: {
        unit.lookAtTarget = playerPos.clone();

        // Fire weapons
        unit.fireTimer -= dt;
        if (unit.fireTimer <= 0 && distToPlayer < unit.weaponRange) {
          this._fireGroundWeapons(unit, playerPos, distToPlayer);
        }

        // SAM lock-on
        if (unit.tier.id === 'sam') {
          if (distToPlayer < unit.weaponRange) {
            unit.lockTimer += dt;
            if (unit.lockTimer >= (unit.tier.lockTime || 4)) {
              this._fireSAM(unit, playerPos);
              unit.lockTimer = 0;
            }
          } else {
            unit.lockTimer = 0;
          }
        }

        if (distToPlayer > unit.weaponRange * 1.2) {
          unit.state = AI_STATES.ALERT;
          unit.stateTimer = 0;
        }
        if (unit.hp <= 0) {
          unit.state = AI_STATES.DEAD;
        }
        break;
      }
      case AI_STATES.SUPPRESS: {
        unit.targetSpeed = 0;
        unit.fireTimer -= dt;
        if (unit.fireTimer <= 0 && distToPlayer < unit.weaponRange) {
          this._fireGroundWeapons(unit, playerPos, distToPlayer);
          unit.fireTimer = 0.5;
        }
        if (unit.stateTimer > 5) {
          unit.state = AI_STATES.PATROL;
          unit.stateTimer = 0;
        }
        break;
      }
    }

    // Convoy movement override
    if (unit.isConvoyMember && unit.state === AI_STATES.PATROL && unit.convoyDir) {
      unit.targetPos = unit.position.clone().add(unit.convoyDir.clone().multiplyScalar(200));
      unit.targetSpeed = unit.maxSpeed * 0.7;
    }
  },

  _updateGroundMovement(unit, dt) {
    if (unit.hp <= 0 || unit.maxSpeed === 0) return;

    const targetSpeed = unit.targetSpeed || 0;
    unit.speed = PHLYMath.lerp(unit.speed, targetSpeed, dt * 2);

    if (unit.targetPos && unit.speed > 0.1) {
      const toTarget = new THREE.Vector3(
        unit.targetPos.x - unit.position.x, 0,
        unit.targetPos.z - unit.position.z
      );
      const dist = toTarget.length();
      if (dist > 2) {
        toTarget.normalize();
        // Check slope ahead
        const aheadX = unit.position.x + toTarget.x * 16;
        const aheadZ = unit.position.z + toTarget.z * 16;
        const slope = TerrainSystem.getSlopeAt(aheadX, aheadZ);
        if (slope > unit.climbLimit) {
          // Pick new direction away from slope
          const perp = new THREE.Vector3(-toTarget.z, 0, toTarget.x);
          unit.targetPos = unit.position.clone().add(perp.multiplyScalar(200));
          return;
        }

        // Uphill speed penalty
        const currentH = TerrainSystem.getTerrainHeight(unit.position.x, unit.position.z);
        const aheadH = TerrainSystem.getTerrainHeight(aheadX, aheadZ);
        const slopeAngle = Math.atan2(aheadH - currentH, 16) * 180 / Math.PI;
        const slopePenalty = Math.max(0.3, 1 - slopeAngle / 90);

        // Heading
        unit.heading = Math.atan2(toTarget.x, toTarget.z);

        // Move
        const moveSpeed = unit.speed * slopePenalty;
        unit.position.x += toTarget.x * moveSpeed * dt;
        unit.position.z += toTarget.z * moveSpeed * dt;
      }
    }

    // Terrain following
    const h = TerrainSystem.getTerrainHeight(unit.position.x, unit.position.z);
    unit.position.y = Math.max(h, 0);

    // Water bob for boats
    if (unit.tier.waterOnly) {
      const time = performance.now() / 1000;
      unit.position.y = Math.sin(time * 1.2 + unit.position.x * 0.04) * 0.8 +
                         Math.sin(time * 0.7 + unit.position.z * 0.09) * 0.4;
    }

    // Orientation from terrain normal
    const normal = TerrainSystem.getTerrainNormal(unit.position.x, unit.position.z);
    const upQ = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
    const headingQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), unit.heading);
    unit.quaternion.copy(upQ).multiply(headingQ);
  },

  _fireGroundWeapons(unit, playerPos, dist) {
    const reactionTime = this.difficultyData.reactionTime;
    const spread = (1 - this.difficultyData.aimMult) * 0.08;

    switch (unit.tier.id) {
      case 'jeep':
      case 'command': {
        // .50 cal burst
        const dir = playerPos.clone().sub(unit.position).normalize();
        dir.x += PHLYMath.randRange(-spread, spread);
        dir.y += PHLYMath.randRange(-spread, spread);
        dir.z += PHLYMath.randRange(-spread, spread);
        WeaponSystem.fireEnemyBullet(unit.position.clone().add(new THREE.Vector3(0, 2, 0)), dir.normalize(), 22, 920, 900, '#ffaa44');
        unit.fireTimer = 0.075; // Burst fire
        break;
      }
      case 'ifv':
      case 'boat': {
        // 20mm autocannon burst
        const dir = playerPos.clone().sub(unit.position).normalize();
        dir.x += PHLYMath.randRange(-spread, spread);
        dir.y += PHLYMath.randRange(-spread * 0.5, spread * 0.5);
        dir.z += PHLYMath.randRange(-spread, spread);
        WeaponSystem.fireEnemyBullet(unit.position.clone().add(new THREE.Vector3(0, 2.5, 0)), dir.normalize(), 55, 850, 2200, '#ccffcc');
        unit.fireTimer = 0.15;
        break;
      }
      case 'spaag': {
        // Twin 30mm
        for (let b = 0; b < 2; b++) {
          const dir = playerPos.clone().sub(unit.position).normalize();
          dir.x += PHLYMath.randRange(-spread * 0.7, spread * 0.7);
          dir.y += PHLYMath.randRange(-spread * 0.3, spread * 0.3);
          dir.z += PHLYMath.randRange(-spread * 0.7, spread * 0.7);
          const offset = new THREE.Vector3(b === 0 ? -0.2 : 0.2, 2.5, 0);
          WeaponSystem.fireEnemyBullet(unit.position.clone().add(offset), dir.normalize(), 90, 780, 2500, '#ffaa44');
        }
        unit.fireTimer = 0.05;
        break;
      }
      case 'mbt': {
        // 105mm AP - slow projectile
        if (dist < 1200) {
          const dir = playerPos.clone().sub(unit.position).normalize();
          dir.x += PHLYMath.randRange(-spread * 0.3, spread * 0.3);
          dir.y += PHLYMath.randRange(-spread * 0.3, spread * 0.3);
          WeaponSystem.fireEnemyBullet(unit.position.clone().add(new THREE.Vector3(0, 2, 0)), dir.normalize(), 200, 400, 3500, '#ff8833');
          if (window.VFXSystem) VFXSystem.muzzleFlash(unit.position.clone().add(new THREE.Vector3(0, 2, 3)), '#ff8833');
          if (window.AudioSystem) AudioSystem.playExplosion(unit.position, 5);
        }
        unit.fireTimer = 4;
        break;
      }
      case 'howitzer': {
        // 155mm artillery - parabolic shell
        const leadTime = 4;
        const targetPos = playerPos.clone().add(FlightPhysics.velocity.clone().multiplyScalar(leadTime));
        // Fire high arc
        const toTarget = targetPos.clone().sub(unit.position);
        const hDist = Math.sqrt(toTarget.x * toTarget.x + toTarget.z * toTarget.z);
        const elevation = Math.atan2(hDist * 0.5, hDist) + Math.PI / 4;
        const dir = toTarget.normalize();
        dir.y = Math.tan(elevation);
        dir.normalize();
        // Create as a bomb with inherited velocity
        const shellVel = dir.multiplyScalar(300);
        const shell = {
          position: unit.position.clone().add(new THREE.Vector3(0, 2, 0)),
          velocity: shellVel,
          damage: 400,
          blastRadius: 40,
          type: 'bomb',
          fuseTime: 0,
          age: 0,
          mesh: null,
          armed: true,
        };
        const shellGeo = new THREE.SphereGeometry(0.15, 4, 4);
        const shellMat = new THREE.MeshPhongMaterial({ color: 0x444444 });
        shell.mesh = new THREE.Mesh(shellGeo, shellMat);
        shell.mesh.position.copy(shell.position);
        this.scene.add(shell.mesh);
        WeaponSystem.bombs.push(shell);
        if (window.VFXSystem) VFXSystem.muzzleFlash(unit.position.clone().add(new THREE.Vector3(0, 2, 0)), '#ffaa00');
        if (window.AudioSystem) AudioSystem.playExplosion(unit.position, 8);
        unit.fireTimer = 8 + Math.random() * 4;
        break;
      }
    }
  },

  _fireSAM(unit, playerPos) {
    // Check line of sight via height buffer ray march
    if (!this._checkLineOfSight(unit.position, playerPos)) return;

    const dir = playerPos.clone().sub(unit.position).normalize();
    WeaponSystem.fireEnemyMissile(
      unit.position.clone().add(new THREE.Vector3(0, 3, 0)),
      dir, 'radar_missile', 500, 6, 12000, 1200
    );
    if (window.AudioSystem) AudioSystem.playMissileWarning();
    console.log(`[PHLY][AI-Ground] SAM launched!`);
  },

  _checkLineOfSight(from, to) {
    // 16-step ray march against height buffer
    const steps = 16;
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = PHLYMath.lerp(from.x, to.x, t);
      const y = PHLYMath.lerp(from.y, to.y, t);
      const z = PHLYMath.lerp(from.z, to.z, t);
      const h = TerrainSystem.getTerrainHeight(x, z);
      if (y < h + 5) return false;
    }
    return true;
  },

  checkBulletHit(bullet) {
    if (bullet.isEnemyBullet) return false;
    for (const unit of this.units) {
      if (unit.hp <= 0) continue;
      const dist = bullet.position.distanceTo(unit.position);
      const hitRadius = unit.tier.id === 'mbt' ? 5 : (unit.tier.id === 'jeep' ? 3 : 4);
      if (dist < hitRadius) {
        this.damageUnit(unit, bullet.damage);
        if (window.VFXSystem) VFXSystem.hitSpark(bullet.position);
        return true;
      }
    }
    return false;
  },

  damageUnit(unit, amount) {
    unit.hp -= amount;
    if (unit.state === AI_STATES.PATROL) {
      unit.state = AI_STATES.SUPPRESS;
      unit.stateTimer = 0;
    }
    if (unit.hp <= 0) {
      unit.hp = 0;
      this._killUnit(unit);
    }
  },

  _killUnit(unit) {
    console.log(`[PHLY][AI-Ground] ${unit.tier.name} DESTROYED!`);
    const reward = Economy.creditKill(unit.tier.id, true, this.difficulty);
    if (window.VFXSystem) VFXSystem.explosion(unit.position, 10);
    if (window.AudioSystem) AudioSystem.playExplosion(unit.position, 10);
    if (window.HUD) HUD.killFlash(unit.tier.name, reward);
    if (window.MissionSystem) MissionSystem.trackKill(unit.tier.id, true);
    unit.state = AI_STATES.DEAD;
    unit.deathTimer = 2;
  },

  _convertToWreckage(unit) {
    unit.isWreckage = true;
    unit.wreckageTimer = 120;
    if (unit.mesh) {
      // Darken the mesh
      unit.mesh.traverse(child => {
        if (child.isMesh && child.material) {
          child.material = new THREE.MeshPhongMaterial({ color: 0x1a1a1a, flatShading: true });
        }
      });
      unit.mesh.scale.y *= 0.4;
    }
  },

  _removeUnit(idx) {
    if (idx < 0 || idx >= this.units.length) return;
    const unit = this.units[idx];
    if (unit.mesh) {
      this.scene.remove(unit.mesh);
      unit.mesh.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
          else child.material.dispose();
        }
      });
    }
    this.units.splice(idx, 1);
  },

  getNearestUnit(pos) {
    let nearest = null;
    let nearestDist = Infinity;
    for (const u of this.units) {
      if (u.hp <= 0) continue;
      const d = pos.distanceTo(u.position);
      if (d < nearestDist) { nearestDist = d; nearest = u; }
    }
    return nearest ? { unit: nearest, distance: nearestDist } : null;
  },

  getAliveCount() {
    return this.units.filter(u => u.hp > 0).length;
  },
};

window.AIGroundSystem = AIGroundSystem;
console.log('[PHLY] AI Ground module loaded');
