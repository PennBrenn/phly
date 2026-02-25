// Landing & Crash System for PHLY
const LandingSystem = {
  isLanding: false,
  repairTimer: 0,
  rearmTimer: 0,
  totalRepairTime: 0,
  repairCost: 0,
  repairLevel: '',
  landingComplete: false,

  init() {
    this.isLanding = false;
    this.repairTimer = 0;
    this.rearmTimer = 0;
    this.landingComplete = false;
    console.log('[PHLY][Landing] Initialized');
  },

  attemptLanding() {
    if (FlightPhysics.isLanded || FlightPhysics.isDead) return false;
    if (!FlightPhysics.canLand()) return false;

    if (FlightPhysics.land()) {
      this.isLanding = true;
      const hpPct = FlightPhysics.getHpPct();
      const loadoutValue = Economy.getLoadoutValue();
      const repair = getRepairCost(hpPct, loadoutValue);

      this.repairLevel = repair.level;
      this.repairCost = repair.cost;
      this.totalRepairTime = repair.time;
      this.repairTimer = repair.time;
      this.rearmTimer = 12;
      this.landingComplete = false;

      console.log(`[PHLY][Landing] Landed. Repair: ${repair.level}, Cost: $${repair.cost}, Time: ${repair.time}s`);

      // Show landing overlay
      const overlay = document.getElementById('landing-overlay');
      if (overlay) overlay.classList.add('active');

      return true;
    }
    return false;
  },

  update(dt) {
    if (!this.isLanding) return;

    // Update repair timer
    if (this.repairTimer > 0) {
      this.repairTimer -= dt;
      if (this.repairTimer <= 0) this.repairTimer = 0;
    }

    // Update rearm timer
    if (this.rearmTimer > 0) {
      this.rearmTimer -= dt;
      if (this.rearmTimer <= 0) this.rearmTimer = 0;
    }

    // Check if repair and rearm complete
    if (this.repairTimer <= 0 && this.rearmTimer <= 0 && !this.landingComplete) {
      this.landingComplete = true;
      // Debit repair cost
      Economy.debitRepair(FlightPhysics.getHpPct());
      // Full heal
      FlightPhysics.hp = FlightPhysics.maxHp;
      // Rearm ordnance
      const loadout = Economy.getLoadout();
      if (loadout.slot1) {
        const o1 = EQUIPMENT.ordnance.find(o => o.id === loadout.slot1);
        if (o1) WeaponSystem.ordnanceAmmo[0] = o1.qty;
      }
      if (loadout.slot2) {
        const o2 = EQUIPMENT.ordnance.find(o => o.id === loadout.slot2);
        if (o2) WeaponSystem.ordnanceAmmo[1] = o2.qty;
      }
      // Restore countermeasures
      const cm = EQUIPMENT.countermeasures.find(c => c.id === loadout.countermeasures);
      if (cm) {
        if (cm.type === 'flare') WeaponSystem.flareCharges = cm.charges;
        else if (cm.type === 'chaff') WeaponSystem.chaffCharges = cm.charges;
        else if (cm.type === 'ecm') {
          WeaponSystem.flareCharges = cm.charges.flare;
          WeaponSystem.chaffCharges = cm.charges.chaff;
        }
      }
      WeaponSystem.gunHeat = 0;
      WeaponSystem.gunOverheated = false;

      console.log('[PHLY][Landing] Repair complete! HP restored, ordnance rearmed');
    }

    // Update UI
    this._updateUI();
  },

  takeoff() {
    if (!this.isLanding) return;

    // If repair not complete, no charge and no repair
    if (!this.landingComplete) {
      console.log('[PHLY][Landing] Takeoff before repair complete - no charge, no repair');
    }

    this.isLanding = false;
    FlightPhysics.takeoff();

    const overlay = document.getElementById('landing-overlay');
    if (overlay) overlay.classList.remove('active');
  },

  _updateUI() {
    const statusEl = document.getElementById('landing-status');
    const progressFill = document.getElementById('repair-progress-fill');
    const costDisplay = document.getElementById('repair-cost-display');

    if (statusEl) {
      if (this.landingComplete) {
        statusEl.textContent = 'REPAIR COMPLETE - Press W to takeoff';
        statusEl.style.color = '#4caf50';
      } else if (this.repairTimer > 0) {
        statusEl.textContent = `REPAIRING (${this.repairLevel})... ${Math.ceil(this.repairTimer)}s`;
        statusEl.style.color = '#ff9800';
      } else {
        statusEl.textContent = `REARMING... ${Math.ceil(this.rearmTimer)}s`;
        statusEl.style.color = '#4a9eff';
      }
    }

    if (progressFill) {
      const progress = this.totalRepairTime > 0
        ? (1 - this.repairTimer / this.totalRepairTime) * 100
        : 100;
      progressFill.style.width = `${progress}%`;
    }

    if (costDisplay) {
      costDisplay.textContent = `Cost: ${PHLYMath.formatCurrency(this.repairCost)}`;
    }
  },

  // Check and show crash overlay
  updateCrashOverlay(physics) {
    const crashOverlay = document.getElementById('crash-overlay');
    const crashText = document.getElementById('crash-text');
    const crashTimer = document.getElementById('crash-timer');

    if (physics.isCrashing) {
      if (crashOverlay) crashOverlay.classList.add('active');
      if (crashText) crashText.textContent = 'PULL UP';
      if (crashTimer) crashTimer.textContent = Math.ceil(physics.crashTimer);
    } else if (physics.isDead) {
      if (crashOverlay) crashOverlay.classList.add('active');
      if (crashText) {
        crashText.textContent = 'DESTROYED';
        crashText.style.color = '#f44336';
      }
      if (crashTimer) crashTimer.textContent = `Respawn: ${Math.ceil(physics.respawnTimer)}s`;
    } else {
      if (crashOverlay) crashOverlay.classList.remove('active');
    }
  },
};

window.LandingSystem = LandingSystem;
console.log('[PHLY] Landing module loaded');
