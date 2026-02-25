// Air Enemy AI System for PHLY
const AIAirSystem = {
  enemies: [],
  scene: null,
  maxEnemies: 12,
  spawnRate: 3, // per minute
  spawnTimer: 0,
  difficulty: 'medium',
  difficultyData: null,

  init(scene, settings) {
    this.scene = scene;
    this.enemies = [];
    this.maxEnemies = settings.maxEnemies || 12;
    this.spawnRate = settings.spawnRate || 3;
    this.difficulty = settings.difficulty || 'medium';
    this.difficultyData = DIFFICULTY[this.difficulty];
    this.spawnTimer = 5; // Initial delay
    console.log(`[PHLY][AI-Air] Init: max=${this.maxEnemies}, rate=${this.spawnRate}/min, diff=${this.difficulty}`);
  },

  update(dt, playerPos) {
    // Spawn timer
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.enemies.length < this.maxEnemies) {
      this.spawnEnemy(playerPos);
      this.spawnTimer = 60 / this.spawnRate;
    }

    // Update each enemy
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (enemy.hp <= 0) {
        enemy.deathTimer -= dt;
        if (enemy.deathTimer <= 0) {
          this._removeEnemy(i);
        }
        continue;
      }
      this._updateAI(enemy, dt, playerPos);
      this._updateMovement(enemy, dt);
      if (enemy.mesh) {
        enemy.mesh.position.copy(enemy.position);
        enemy.mesh.quaternion.copy(enemy.quaternion);
      }
    }
  },

  spawnEnemy(playerPos) {
    // Choose tier based on difficulty weighting
    const tierWeights = {
      easy: [0.4, 0.25, 0.15, 0.1, 0.02, 0.04, 0.04],
      medium: [0.25, 0.25, 0.2, 0.12, 0.05, 0.06, 0.07],
      hard: [0.1, 0.2, 0.25, 0.18, 0.1, 0.08, 0.09],
      elite: [0.05, 0.1, 0.2, 0.25, 0.18, 0.1, 0.12],
    };
    const weights = tierWeights[this.difficulty] || tierWeights.medium;
    let r = Math.random();
    let tierIdx = 0;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r <= 0) { tierIdx = i; break; }
    }
    const tierData = ENEMY_TIERS.air[tierIdx];

    // Spawn position: random direction from player, 3-8km away, at altitude
    const angle = Math.random() * Math.PI * 2;
    const dist = 3000 + Math.random() * 5000;
    const spawnPos = new THREE.Vector3(
      playerPos.x + Math.cos(angle) * dist,
      300 + Math.random() * 800,
      playerPos.z + Math.sin(angle) * dist
    );

    const enemy = {
      id: `air_${Date.now()}_${Math.random().toString(36).substr(2,4)}`,
      tier: tierData,
      hp: Math.floor(tierData.hp * this.difficultyData.hpMult),
      maxHp: Math.floor(tierData.hp * this.difficultyData.hpMult),
      position: spawnPos,
      velocity: new THREE.Vector3(0, 0, tierData.speed * 0.5),
      quaternion: new THREE.Quaternion(),
      speed: tierData.speed * 0.5,
      maxSpeed: tierData.speed,
      state: AI_STATES.PATROL,
      stateTimer: 0,
      fireTimer: 0,
      missileTimer: 0,
      patrolTarget: this._randomPatrolPoint(spawnPos),
      detectionRange: tierData.detectionRange,
      mesh: null,
      deathTimer: 3,
      baseReward: tierData.rewards[this.difficultyData.rewardKey],
      hasEcm: tierData.hasEcm || false,
      smokeTrail: null,
    };

    // Build mesh
    enemy.mesh = AircraftBuilder.buildEnemy(tierData, tierData.color);
    enemy.mesh.position.copy(spawnPos);
    this.scene.add(enemy.mesh);

    this.enemies.push(enemy);
    console.log(`[PHLY][AI-Air] Spawned ${tierData.name} at dist ${Math.floor(dist)}m`);
  },

  _randomPatrolPoint(center) {
    return new THREE.Vector3(
      center.x + PHLYMath.randRange(-4000, 4000),
      300 + Math.random() * 600,
      center.z + PHLYMath.randRange(-4000, 4000)
    );
  },

  _updateAI(enemy, dt, playerPos) {
    const distToPlayer = enemy.position.distanceTo(playerPos);
    const toPlayer = playerPos.clone().sub(enemy.position).normalize();

    enemy.stateTimer += dt;

    switch (enemy.state) {
      case AI_STATES.PATROL: {
        // Check if player in detection range
        if (distToPlayer < enemy.detectionRange) {
          enemy.state = AI_STATES.PURSUE;
          enemy.stateTimer = 0;
          console.log(`[PHLY][AI-Air] ${enemy.tier.name} detected player, pursuing`);
        }
        // Move toward patrol target
        const distToTarget = enemy.position.distanceTo(enemy.patrolTarget);
        if (distToTarget < 200) {
          enemy.patrolTarget = this._randomPatrolPoint(enemy.position);
        }
        enemy.targetDir = enemy.patrolTarget.clone().sub(enemy.position).normalize();
        enemy.targetSpeed = enemy.maxSpeed * 0.5;
        break;
      }
      case AI_STATES.PURSUE: {
        // Head toward player
        enemy.targetDir = toPlayer.clone();
        enemy.targetSpeed = enemy.maxSpeed * 0.8;

        // Check weapon range
        const weaponRange = this._getWeaponRange(enemy);
        if (distToPlayer < weaponRange) {
          enemy.state = AI_STATES.ENGAGE;
          enemy.stateTimer = 0;
        }
        if (distToPlayer > enemy.detectionRange * 1.5) {
          enemy.state = AI_STATES.PATROL;
          enemy.stateTimer = 0;
          enemy.patrolTarget = this._randomPatrolPoint(enemy.position);
        }
        break;
      }
      case AI_STATES.ENGAGE: {
        const weaponRange = this._getWeaponRange(enemy);
        enemy.targetSpeed = enemy.maxSpeed * 0.9;

        // Lead targeting
        const timeToHit = distToPlayer / 900;
        const leadPos = playerPos.clone().add(FlightPhysics.velocity.clone().multiplyScalar(timeToHit * this.difficultyData.aimMult));
        enemy.targetDir = leadPos.sub(enemy.position).normalize();

        // Fire weapons
        enemy.fireTimer -= dt;
        if (enemy.fireTimer <= 0 && distToPlayer < weaponRange) {
          this._fireWeapons(enemy, playerPos, distToPlayer);
          enemy.fireTimer = this.difficultyData.reactionTime;
        }

        // Missile fire
        enemy.missileTimer -= dt;
        if (enemy.missileTimer <= 0 && distToPlayer < (enemy.tier.detectionRange || 5000)) {
          this._fireMissiles(enemy, playerPos, distToPlayer);
          enemy.missileTimer = 8 + Math.random() * 8;
        }

        // State transitions
        if (enemy.hp < enemy.maxHp * 0.25) {
          enemy.state = AI_STATES.EVADE;
          enemy.stateTimer = 0;
        }
        if (distToPlayer > weaponRange * 1.5) {
          enemy.state = AI_STATES.PURSUE;
          enemy.stateTimer = 0;
        }

        // AI-specific behaviors
        this._applyAIBehavior(enemy, dt, playerPos, distToPlayer);
        break;
      }
      case AI_STATES.EVADE: {
        // Hard break away from player
        const awayDir = enemy.position.clone().sub(playerPos).normalize();
        // Terrain hugging
        const terrainH = TerrainSystem.getTerrainHeight(enemy.position.x, enemy.position.z);
        const targetAlt = terrainH + 50 + Math.random() * 100;
        awayDir.y = (targetAlt - enemy.position.y) * 0.01;
        enemy.targetDir = awayDir.normalize();
        enemy.targetSpeed = enemy.maxSpeed;

        // Deploy countermeasures
        if (enemy.hasEcm && Math.random() < 0.02) {
          // Flares/chaff (visual only for enemies)
          if (window.VFXSystem) VFXSystem.spawnFlares(enemy.position);
        }

        if (distToPlayer > enemy.detectionRange) {
          enemy.state = AI_STATES.RTB;
          enemy.stateTimer = 0;
        }
        break;
      }
      case AI_STATES.RTB: {
        // Fly to despawn point
        const despawnDir = new THREE.Vector3(
          Math.cos(enemy.id.charCodeAt(0)),
          0.1,
          Math.sin(enemy.id.charCodeAt(1))
        ).normalize();
        enemy.targetDir = despawnDir;
        enemy.targetSpeed = enemy.maxSpeed * 0.7;

        if (enemy.stateTimer > 30 || distToPlayer > 20000) {
          this._removeEnemy(this.enemies.indexOf(enemy));
          return;
        }
        break;
      }
    }
  },

  _applyAIBehavior(enemy, dt, playerPos, dist) {
    switch (enemy.tier.ai) {
      case 'strafe_circle':
        // Circle strafe around player
        if (dist < 800) {
          const perp = new THREE.Vector3(-enemy.targetDir.z, 0, enemy.targetDir.x);
          enemy.targetDir.lerp(perp, 0.3).normalize();
        }
        break;
      case 'head_on_merge':
        // Head-on pass then hard turn
        if (dist < 300) {
          enemy.targetDir.y += 0.5;
          enemy.targetDir.normalize();
        }
        break;
      case 'boom_zoom':
        // Dive from above, then climb away
        if (enemy.position.y < playerPos.y + 200 && dist < 1500) {
          enemy.targetDir.y = 0.6;
          enemy.targetDir.normalize();
          enemy.targetSpeed = enemy.maxSpeed;
        } else if (enemy.position.y > playerPos.y + 500) {
          enemy.targetDir.y = -0.4;
          enemy.targetDir.normalize();
        }
        break;
      case 'bvr_merge':
        // Stay at range, fire missiles, close only if needed
        if (dist < 1500 && dist > 800) {
          // Maintain distance
          const lateral = new THREE.Vector3(-enemy.targetDir.z, 0, enemy.targetDir.x);
          enemy.targetDir.lerp(lateral, 0.5).normalize();
        }
        break;
      case 'full_acm':
        // Advanced combat maneuvering
        if (dist < 500) {
          // Scissors maneuver
          const t = enemy.stateTimer * 3;
          enemy.targetDir.x += Math.sin(t) * 0.3;
          enemy.targetDir.z += Math.cos(t) * 0.3;
          enemy.targetDir.normalize();
        }
        break;
      case 'slow_suppression':
        // Stay in area, suppress with heavy fire
        enemy.targetSpeed = enemy.maxSpeed * 0.4;
        break;
      case 'evasive_climb':
        // Climb when threatened
        if (dist < 2000) {
          enemy.targetDir.y = 0.4;
          enemy.targetDir.normalize();
        }
        break;
    }
  },

  _updateMovement(enemy, dt) {
    if (enemy.hp <= 0) return;

    // Smooth rotation toward target direction
    const targetDir = enemy.targetDir || new THREE.Vector3(0, 0, 1);
    const currentDir = new THREE.Vector3(0, 0, 1).applyQuaternion(enemy.quaternion);
    const turnRate = 1.5 * dt;
    const newDir = currentDir.lerp(targetDir, turnRate).normalize();

    // Set quaternion from direction
    const lookTarget = enemy.position.clone().add(newDir);
    const lookMatrix = new THREE.Matrix4().lookAt(enemy.position, lookTarget, new THREE.Vector3(0, 1, 0));
    enemy.quaternion.setFromRotationMatrix(lookMatrix);

    // Speed adjustment
    enemy.speed = PHLYMath.lerp(enemy.speed, enemy.targetSpeed || enemy.maxSpeed * 0.5, dt * 0.5);

    // Velocity
    enemy.velocity = newDir.multiplyScalar(enemy.speed);
    enemy.position.add(enemy.velocity.clone().multiplyScalar(dt));

    // Keep above terrain
    const terrainH = TerrainSystem.getTerrainHeight(enemy.position.x, enemy.position.z);
    if (enemy.position.y < terrainH + 30) {
      enemy.position.y = terrainH + 30;
      enemy.velocity.y = Math.max(enemy.velocity.y, 10);
    }

    // Smoke trail when damaged
    if (enemy.hp < enemy.maxHp * 0.5 && window.VFXSystem) {
      VFXSystem.emitSmoke(enemy.position, enemy.hp < enemy.maxHp * 0.2);
    }
  },

  _getWeaponRange(enemy) {
    const gun = EQUIPMENT.guns.find(g => g.id === enemy.tier.weapons[0]);
    return gun ? gun.range : 1500;
  },

  _fireWeapons(enemy, playerPos, dist) {
    const gunId = enemy.tier.weapons[0];
    const gun = EQUIPMENT.guns.find(g => g.id === gunId);
    if (!gun) return;
    if (dist > gun.range) return;

    const dir = playerPos.clone().sub(enemy.position).normalize();
    // Add inaccuracy based on difficulty
    const spread = (1 - this.difficultyData.aimMult) * 0.05;
    dir.x += PHLYMath.randRange(-spread, spread);
    dir.y += PHLYMath.randRange(-spread, spread);
    dir.z += PHLYMath.randRange(-spread, spread);
    dir.normalize();

    WeaponSystem.fireEnemyBullet(
      enemy.position.clone().add(dir.clone().multiplyScalar(5)),
      dir, gun.dmg, gun.bulletVel, gun.range, '#ff4444'
    );
  },

  _fireMissiles(enemy, playerPos, dist) {
    const hasIR = enemy.tier.weapons.includes('aim9');
    const hasRadar = enemy.tier.weapons.includes('aim120');

    if (hasRadar && dist > 3000 && dist < 12000) {
      const dir = playerPos.clone().sub(enemy.position).normalize();
      WeaponSystem.fireEnemyMissile(
        enemy.position.clone(), dir, 'radar_missile', 500, 6, 12000, 1200
      );
      console.log(`[PHLY][AI-Air] ${enemy.tier.name} fired AMRAAM`);
    } else if (hasIR && dist < 2000) {
      const dir = playerPos.clone().sub(enemy.position).normalize();
      WeaponSystem.fireEnemyMissile(
        enemy.position.clone(), dir, 'ir_missile', 420, 8, 2000, 800
      );
      console.log(`[PHLY][AI-Air] ${enemy.tier.name} fired Sidewinder`);
    }
  },

  checkBulletHit(bullet) {
    if (bullet.isEnemyBullet) return false; // handled in WeaponSystem.update

    // Player bullet -> check enemies
    for (const enemy of this.enemies) {
      if (enemy.hp <= 0) continue;
      const dist = bullet.position.distanceTo(enemy.position);
      if (dist < 12) {
        this.damageEnemy(enemy, bullet.damage);
        if (window.VFXSystem) VFXSystem.hitSpark(bullet.position);
        return true;
      }
    }
    return false;
  },

  damageEnemy(enemy, amount) {
    enemy.hp -= amount;
    if (enemy.hp <= 0) {
      enemy.hp = 0;
      this._killEnemy(enemy);
    }
  },

  _killEnemy(enemy) {
    console.log(`[PHLY][AI-Air] ${enemy.tier.name} DESTROYED!`);
    const reward = Economy.creditKill(enemy.tier.id, false, this.difficulty);

    // Explosion VFX
    if (window.VFXSystem) VFXSystem.explosion(enemy.position, 15);
    if (window.AudioSystem) AudioSystem.playExplosion(enemy.position, 15);

    // HUD flash
    if (window.HUD) HUD.killFlash(enemy.tier.name, reward);

    // Mission tracking
    if (window.MissionSystem) MissionSystem.trackKill(enemy.tier.id, false);

    enemy.deathTimer = 3;
    if (enemy.mesh) enemy.mesh.visible = false;
  },

  _removeEnemy(idx) {
    if (idx < 0 || idx >= this.enemies.length) return;
    const enemy = this.enemies[idx];
    if (enemy.mesh) {
      this.scene.remove(enemy.mesh);
      enemy.mesh.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
          else child.material.dispose();
        }
      });
    }
    this.enemies.splice(idx, 1);
  },

  // Get nearest enemy for lead indicator
  getNearestEnemy(pos) {
    let nearest = null;
    let nearestDist = Infinity;
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      const d = pos.distanceTo(e.position);
      if (d < nearestDist) { nearestDist = d; nearest = e; }
    }
    return nearest ? { enemy: nearest, distance: nearestDist } : null;
  },

  getAliveCount() {
    return this.enemies.filter(e => e.hp > 0).length;
  },
};

window.AIAirSystem = AIAirSystem;
console.log('[PHLY] AI Air module loaded');
