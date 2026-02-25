// Flight Physics for PHLY
const FlightPhysics = {
  // Player state
  position: new THREE.Vector3(0, 500, 0),
  velocity: new THREE.Vector3(0, 0, 50),
  rotation: new THREE.Euler(0, 0, 0, 'YXZ'),
  quaternion: new THREE.Quaternion(),
  angularVelocity: new THREE.Vector3(0, 0, 0),
  _prevVelocity: new THREE.Vector3(0, 0, 50),
  _smoothG: 1.0,
  throttle: 0.5,
  afterburnerActive: false,
  afterburnerFuel: 1.0,
  speed: 50,
  hp: 350,
  maxHp: 350,
  gLoad: 1.0,
  agl: 500, // Above Ground Level
  msl: 500, // Mean Sea Level
  heading: 0,
  pitch: 0,
  roll: 0,
  isLanded: false,
  isCrashing: false,
  crashTimer: 0,
  crashRecoveryWindow: 4.0,
  isDead: false,
  respawnTimer: 0,

  // Derived from loadout
  maxSpeed: 200,
  dragCoeff: 0.02,
  liftCoeff: 1.0,
  rollRateBase: 2.0,
  handlingMod: 0,
  climbRate: 35,

  init(loadout) {
    const fus = EQUIPMENT.fuselages.find(f => f.id === loadout.fuselage) || EQUIPMENT.fuselages[0];
    const wing = EQUIPMENT.wings.find(w => w.id === loadout.wings) || EQUIPMENT.wings[0];
    const eng = EQUIPMENT.engines.find(e => e.id === loadout.engine) || EQUIPMENT.engines[0];

    this.maxHp = fus.hp;
    this.hp = fus.hp;
    this.dragCoeff = fus.drag;
    this.maxSpeed = eng.topSpeed;
    this.climbRate = eng.climbRate;
    this.liftCoeff = wing.lift;
    this.rollRateBase = wing.rollRate * 2.0;
    this.handlingMod = fus.handling + wing.handling;

    // Ordnance handling penalty
    if (loadout.slot1) {
      const o1 = EQUIPMENT.ordnance.find(o => o.id === loadout.slot1);
      if (o1) this.handlingMod += o1.handling;
    }
    if (loadout.slot2) {
      const o2 = EQUIPMENT.ordnance.find(o => o.id === loadout.slot2);
      if (o2) this.handlingMod += o2.handling;
    }

    this.afterburnerAvailable = eng.afterburner;
    this.afterburnerBoost = eng.abBoost;
    this.afterburnerDuration = eng.abDuration;
    this.afterburnerFuel = 1.0;

    // Spawn safely above terrain
    const spawnTerrainH = TerrainSystem.getTerrainHeight(0, 0);
    this.position.set(0, Math.max(500, spawnTerrainH + 300), 0);
    this.velocity.set(0, 0, this.maxSpeed * 0.3);
    this.rotation.set(0, 0, 0);
    this.quaternion.setFromEuler(this.rotation);
    this.throttle = 0.5;
    this.isLanded = false;
    this.isCrashing = false;
    this.isDead = false;

    console.log(`[PHLY][Physics] Init: HP=${this.maxHp}, MaxSpeed=${this.maxSpeed}m/s, Handling=${(1+this.handlingMod).toFixed(2)}`);
  },

  update(dt, input) {
    if (this.isDead) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) this.respawn();
      return;
    }
    if (this.isLanded) return;

    const handling = Math.max(0.2, 1 + this.handlingMod);
    const pitchRate = 1.5 * handling;
    const yawRate = 0.8 * handling;
    const rollRate = this.rollRateBase * handling;

    // Throttle
    this.throttle = PHLYMath.clamp(this.throttle + input.throttleDelta * dt * 2, 0, 1);

    // Afterburner
    if (input.afterburner && this.afterburnerAvailable && this.afterburnerFuel > 0) {
      this.afterburnerActive = true;
      this.afterburnerFuel -= dt / this.afterburnerDuration;
    } else {
      this.afterburnerActive = false;
      this.afterburnerFuel = Math.min(1.0, this.afterburnerFuel + dt / (this.afterburnerDuration * 2));
    }

    // Rotation input - clamp to sane range
    const clampedPitch = PHLYMath.clamp(input.pitch, -1.5, 1.5);
    const clampedRoll = PHLYMath.clamp(input.roll, -1.5, 1.5);
    const clampedYaw = PHLYMath.clamp(input.yaw, -1, 1);
    const pitchInput = clampedPitch * pitchRate * dt;
    const rollInput = clampedRoll * rollRate * dt;
    const yawInput = clampedYaw * yawRate * dt;

    // Apply rotation
    const pitchQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), pitchInput);
    const rollQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -rollInput);
    const yawQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yawInput);

    this.quaternion.multiply(pitchQ);
    this.quaternion.multiply(rollQ);
    this.quaternion.multiply(yawQ);
    this.quaternion.normalize();

    // Extract angles
    this.rotation.setFromQuaternion(this.quaternion, 'YXZ');
    this.pitch = this.rotation.x;
    this.roll = this.rotation.z;
    this.heading = PHLYMath.radToDeg(-this.rotation.y);
    if (this.heading < 0) this.heading += 360;

    // Forward direction
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.quaternion);

    // Thrust
    let thrust = this.throttle * this.maxSpeed * 0.8;
    if (this.afterburnerActive) thrust *= (1 + this.afterburnerBoost);

    // Drag
    const speedSq = this.velocity.lengthSq();
    const dragForce = this.dragCoeff * speedSq * 0.001;

    // Lift
    const aoa = Math.asin(PHLYMath.clamp(-forward.y, -1, 1));
    const liftMag = this.liftCoeff * this.speed * 0.015 * Math.cos(aoa);
    const liftDir = up.clone();

    // Gravity
    const gravity = new THREE.Vector3(0, -9.81, 0);

    // Acceleration
    const accel = new THREE.Vector3();
    accel.addScaledVector(forward, thrust * 0.5);
    accel.addScaledVector(this.velocity.clone().normalize(), -dragForce);
    accel.addScaledVector(liftDir, liftMag);
    accel.add(gravity);

    // Integrate
    this.velocity.addScaledVector(accel, dt);

    // Speed limit
    this.speed = this.velocity.length();
    const effectiveMaxSpeed = this.afterburnerActive ? this.maxSpeed * (1 + this.afterburnerBoost) : this.maxSpeed;
    if (this.speed > effectiveMaxSpeed) {
      this.velocity.multiplyScalar(effectiveMaxSpeed / this.speed);
      this.speed = effectiveMaxSpeed;
    }

    // Position
    this.position.addScaledVector(this.velocity, dt);

    // G-load calculation - based on velocity direction change, not raw input
    const accelMag = this.velocity.clone().sub(this._prevVelocity).length() / Math.max(dt, 0.001);
    const rawG = 1 + (accelMag / 9.81) * 0.15; // scale down significantly
    this._smoothG = PHLYMath.lerp(this._smoothG, rawG, dt * 3); // smooth over time
    this.gLoad = PHLYMath.clamp(this._smoothG, 0.2, 12);
    this._prevVelocity.copy(this.velocity);

    // Terrain collision check
    const terrainH = TerrainSystem.getTerrainHeight(this.position.x, this.position.z);
    this.msl = this.position.y;
    this.agl = this.position.y - terrainH;

    // Crash detection
    if (this.agl < 15 && !this.isCrashing) {
      const sinkRate = -this.velocity.y;
      const pitchAngle = Math.abs(PHLYMath.radToDeg(this.pitch));
      if (sinkRate > 8 || pitchAngle > 70) {
        this.isCrashing = true;
        this.crashTimer = this.crashRecoveryWindow;
        console.log('[PHLY][Physics] CRASH WARNING! Recovery window active');
      }
    }

    // Update crash timer
    if (this.isCrashing) {
      this.crashTimer -= dt;
      // Check if recovered
      const sinkRate = -this.velocity.y;
      if (this.agl > 30 && sinkRate < 5) {
        this.isCrashing = false;
        console.log('[PHLY][Physics] Crash recovered!');
      }
      if (this.crashTimer <= 0) {
        this.triggerCrash();
      }
    }

    // Hard ground collision
    if (this.position.y < terrainH + 2) {
      if (this.speed > PHLYMath.kmhToMs(280) || Math.abs(this.velocity.y) > 3) {
        this.triggerCrash();
      } else {
        // Attempt landing
        this.position.y = terrainH + 2;
        this.velocity.y = 0;
      }
    }

    // Keep above water
    if (this.position.y < 5) {
      if (terrainH <= 0) {
        this.triggerCrash();
      }
    }
  },

  triggerCrash() {
    if (this.isDead) return;
    this.isDead = true;
    this.isCrashing = false;
    const penalty = Economy.debitCrash();
    this.respawnTimer = 5;
    console.log(`[PHLY][Physics] CRASHED! Penalty: $${penalty}. Respawning in 5s`);
  },

  respawn() {
    this.isDead = false;
    this.hp = Math.floor(this.maxHp * 0.5);
    const rx = this.position.x + PHLYMath.randRange(-2000, 2000);
    const rz = this.position.z + PHLYMath.randRange(-2000, 2000);
    const terrH = TerrainSystem.getTerrainHeight(rx, rz);
    this.position.set(rx, Math.max(800, terrH + 400), rz);
    this.velocity.set(0, 0, this.maxSpeed * 0.3);
    this.quaternion.identity();
    this.rotation.set(0, 0, 0);
    this.isCrashing = false;
    this.throttle = 0.5;
    console.log('[PHLY][Physics] Respawned with 50% HP');
  },

  takeDamage(amount, enemyBaseReward) {
    if (this.isDead) return;
    this.hp -= amount;
    if (enemyBaseReward) Economy.lastDamagingEnemyReward = enemyBaseReward;
    if (this.hp <= 0) {
      this.hp = 0;
      this.triggerCrash();
    }
    console.log(`[PHLY][Physics] Took ${amount} damage. HP: ${this.hp}/${this.maxHp}`);
  },

  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  },

  getHpPct() { return this.hp / this.maxHp; },
  getSpeedKmh() { return PHLYMath.msToKmh(this.speed); },

  // Check if landing conditions are met
  canLand() {
    if (this.isDead) return false;
    const terrainH = TerrainSystem.getTerrainHeight(this.position.x, this.position.z);
    const agl = this.position.y - terrainH;
    if (agl > 20) return false;
    const slope = TerrainSystem.getSlopeAt(this.position.x, this.position.z);
    if (slope > 5) return false;
    const speedKmh = this.getSpeedKmh();
    if (speedKmh > 280) return false;
    const sinkRate = Math.abs(this.velocity.y);
    if (sinkRate > 3) return false;
    const rollDeg = Math.abs(PHLYMath.radToDeg(this.roll));
    if (rollDeg > 10) return false;
    return true;
  },

  land() {
    if (!this.canLand()) return false;
    this.isLanded = true;
    this.velocity.set(0, 0, 0);
    const terrainH = TerrainSystem.getTerrainHeight(this.position.x, this.position.z);
    this.position.y = terrainH + 2;
    console.log('[PHLY][Physics] Landed successfully');
    return true;
  },

  takeoff() {
    this.isLanded = false;
    this.velocity.copy(new THREE.Vector3(0, 5, this.maxSpeed * 0.3).applyQuaternion(this.quaternion));
    console.log('[PHLY][Physics] Taking off');
  },

  // Crash state penalties
  getCrashStatePenalties() {
    if (!this.isCrashing) return { thrustMult: 1, rollMult: 1 };
    return { thrustMult: 0.6, rollMult: 0.6 };
  },
};

window.FlightPhysics = FlightPhysics;
console.log('[PHLY] Physics module loaded');
