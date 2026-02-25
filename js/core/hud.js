// HUD System for PHLY
const HUD = {
  elements: {},
  horizonCtx: null,
  minimapCtx: null,
  killFlashTimer: 0,
  minimapZoom: 20000, // 20km radius
  chatMessages: [],
  damageIndicators: { top: 0, bottom: 0, left: 0, right: 0 },

  init() {
    this.elements = {
      hud: document.getElementById('hud'),
      speed: document.getElementById('hud-speed'),
      altitude: document.getElementById('hud-altitude'),
      heading: document.getElementById('hud-heading'),
      gload: document.getElementById('hud-gload'),
      wallet: document.getElementById('hud-wallet'),
      killFlash: document.getElementById('hud-kill-flash'),
      lobbyCode: document.getElementById('hud-lobby-code'),
      ordnance: document.getElementById('hud-ordnance'),
      heatFill: document.getElementById('hud-heat-fill'),
      repairWarning: document.getElementById('hud-repair-warning'),
      damageState: document.getElementById('hud-damage-state'),
      playerList: document.getElementById('hud-player-list'),
      streak: document.getElementById('hud-streak'),
      leadDiamond: document.getElementById('hud-lead-diamond'),
      chatMessages: document.getElementById('chat-messages'),
    };

    // Horizon canvas
    const horizonCanvas = document.getElementById('hud-horizon-canvas');
    if (horizonCanvas) this.horizonCtx = horizonCanvas.getContext('2d');

    // Minimap canvas
    const minimapCanvas = document.getElementById('minimap-canvas');
    if (minimapCanvas) this.minimapCtx = minimapCanvas.getContext('2d');

    console.log('[PHLY][HUD] Initialized');
  },

  show() {
    if (this.elements.hud) this.elements.hud.classList.remove('hidden');
  },

  hide() {
    if (this.elements.hud) this.elements.hud.classList.add('hidden');
  },

  update(dt, physics, camera) {
    if (!this.elements.hud || this.elements.hud.classList.contains('hidden')) return;

    const speedKmh = physics.getSpeedKmh();
    let speedDisplay = Math.floor(speedKmh);
    let speedUnit = 'KM/H';
    if (GAME_SETTINGS.speedUnits === 'mph') { speedDisplay = Math.floor(speedKmh * 0.621371); speedUnit = 'MPH'; }
    else if (GAME_SETTINGS.speedUnits === 'knots') { speedDisplay = Math.floor(speedKmh * 0.539957); speedUnit = 'KTS'; }

    let altDisplay = Math.floor(physics.msl);
    let aglDisplay = Math.floor(physics.agl);
    let altUnit = 'M';
    if (GAME_SETTINGS.altitudeUnits === 'feet') {
      altDisplay = Math.floor(physics.msl * 3.28084);
      aglDisplay = Math.floor(physics.agl * 3.28084);
      altUnit = 'FT';
    }

    // Speed tape
    if (this.elements.speed) {
      let tape = '';
      const base = Math.floor(speedDisplay / 50) * 50;
      for (let s = base + 100; s >= base - 100; s -= 50) {
        const highlight = Math.abs(s - speedDisplay) < 25;
        tape += `<div style="color:${highlight ? '#ffb300' : 'rgba(0,255,100,0.5)'};font-size:${highlight ? '14px' : '11px'}">${s}</div>`;
      }
      tape += `<div style="font-size:9px;color:rgba(0,255,100,0.4);margin-top:4px">${speedUnit}</div>`;
      this.elements.speed.innerHTML = tape;
    }

    // Altitude tape
    if (this.elements.altitude) {
      let tape = '';
      const base = Math.floor(altDisplay / 100) * 100;
      for (let a = base + 200; a >= base - 200; a -= 100) {
        const highlight = Math.abs(a - altDisplay) < 50;
        tape += `<div style="color:${highlight ? '#ffb300' : 'rgba(0,255,100,0.5)'};font-size:${highlight ? '14px' : '11px'}">${a}</div>`;
      }
      tape += `<div style="font-size:10px;color:rgba(0,255,100,0.6)">AGL ${aglDisplay}${altUnit}</div>`;
      this.elements.altitude.innerHTML = tape;
    }

    // Heading compass
    if (this.elements.heading) {
      const h = Math.floor(physics.heading);
      const cardinals = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW', 360: 'N' };
      let headingStr = `${String(h).padStart(3, '0')}°`;
      for (const [deg, label] of Object.entries(cardinals)) {
        if (Math.abs(h - parseInt(deg)) < 10) { headingStr += ` ${label}`; break; }
      }
      this.elements.heading.textContent = headingStr;
    }

    // G-load
    if (this.elements.gload) {
      const g = physics.gLoad.toFixed(1);
      const color = physics.gLoad > 8 ? '#f44336' : (physics.gLoad > 5 ? '#ff9800' : 'rgba(0,255,100,0.9)');
      this.elements.gload.innerHTML = `<span style="color:${color}">${g}G</span>`;
    }

    // Wallet
    if (this.elements.wallet) {
      const bal = Economy.getBalance();
      const color = bal < 0 ? '#f44336' : '#4a9eff';
      this.elements.wallet.innerHTML = `<span style="color:${color}">${PHLYMath.formatCurrency(bal)}</span>`;
    }

    // Kill flash
    if (this.killFlashTimer > 0) {
      this.killFlashTimer -= dt;
      if (this.elements.killFlash) {
        this.elements.killFlash.style.opacity = Math.min(1, this.killFlashTimer * 3);
      }
    }

    // Ordnance panel
    if (this.elements.ordnance) {
      const loadout = Economy.getLoadout();
      const slotInfo = WeaponSystem.getActiveSlotInfo(loadout);
      let html = '';
      if (loadout.slot1) {
        const o1 = EQUIPMENT.ordnance.find(o => o.id === loadout.slot1);
        const active1 = WeaponSystem.activeSlot === 0;
        html += `<div style="color:${active1 ? '#4a9eff' : 'rgba(0,255,100,0.4)'}">[1] ${o1 ? o1.name : '?'}: ${WeaponSystem.ordnanceAmmo[0]}</div>`;
      }
      if (loadout.slot2) {
        const o2 = EQUIPMENT.ordnance.find(o => o.id === loadout.slot2);
        const active2 = WeaponSystem.activeSlot === 1;
        html += `<div style="color:${active2 ? '#4a9eff' : 'rgba(0,255,100,0.4)'}">[2] ${o2 ? o2.name : '?'}: ${WeaponSystem.ordnanceAmmo[1]}</div>`;
      }
      // Countermeasures
      html += `<div style="color:rgba(0,255,100,0.4);margin-top:4px">FL:${WeaponSystem.flareCharges} CH:${WeaponSystem.chaffCharges}</div>`;
      this.elements.ordnance.innerHTML = html;
    }

    // Heat bar
    if (this.elements.heatFill) {
      this.elements.heatFill.style.width = `${WeaponSystem.gunHeat * 100}%`;
    }

    // Damage state
    if (this.elements.damageState) {
      const hpPct = physics.getHpPct();
      if (hpPct < 1) {
        const hpColor = hpPct > 0.6 ? '#4caf50' : (hpPct > 0.3 ? '#ff9800' : '#f44336');
        this.elements.damageState.innerHTML =
          `<span style="color:${hpColor}">HP: ${physics.hp}/${physics.maxHp} (${Math.floor(hpPct * 100)}%)</span>`;
      } else {
        this.elements.damageState.textContent = '';
      }
    }

    // Streak
    if (this.elements.streak) {
      const airStreak = Economy.killStreak;
      const groundStreak = Economy.groundStreak;
      if (airStreak > 0 || groundStreak > 0) {
        const mult = getStreakMultiplier(Math.max(airStreak, groundStreak));
        this.elements.streak.textContent = `STREAK: ${airStreak + groundStreak} (x${mult})`;
      } else {
        this.elements.streak.textContent = '';
      }
    }

    // Repair warning near ground
    if (this.elements.repairWarning && GAME_SETTINGS.showRepairPreview) {
      if (physics.agl < 100 && !physics.isDead) {
        const loadoutValue = Economy.getLoadoutValue();
        const repair = getRepairCost(physics.getHpPct(), loadoutValue);
        this.elements.repairWarning.style.display = 'block';
        this.elements.repairWarning.textContent = `Est. Repair: ${PHLYMath.formatCurrency(repair.cost)} (${repair.level})`;
      } else {
        this.elements.repairWarning.style.display = 'none';
      }
    }

    // Artificial horizon
    this._drawHorizon(physics);

    // Lead indicator
    this._updateLeadIndicator(physics, camera);

    // Minimap
    this._drawMinimap(physics);

    // Chat auto-hide
    for (let i = this.chatMessages.length - 1; i >= 0; i--) {
      this.chatMessages[i].age += dt;
      if (this.chatMessages[i].age > 10) {
        this.chatMessages.splice(i, 1);
      }
    }
    this._updateChat();

    // Vignette G-load effect
    const vignette = document.getElementById('vignette-overlay');
    if (vignette) {
      const gIntensity = PHLYMath.clamp((physics.gLoad - 3) / 6, 0, 0.6);
      vignette.style.background = `radial-gradient(ellipse at center, transparent ${60 - gIntensity * 30}%, rgba(0,0,0,${0.4 + gIntensity}) 100%)`;
    }

    // Redout on high negative G
    const redout = document.getElementById('redout-overlay');
    if (redout && physics.gLoad > 7) {
      redout.style.background = `rgba(255,0,0,${(physics.gLoad - 7) * 0.1})`;
    } else if (redout) {
      redout.style.background = 'rgba(255,0,0,0)';
    }
  },

  _drawHorizon(physics) {
    if (!this.horizonCtx) return;
    const ctx = this.horizonCtx;
    const w = 200, h = 200;
    ctx.clearRect(0, 0, w, h);

    const pitchDeg = PHLYMath.radToDeg(physics.pitch);
    const rollDeg = PHLYMath.radToDeg(physics.roll);
    const cx = w / 2, cy = h / 2;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-physics.roll);

    // Sky/ground split
    const pitchOffset = pitchDeg * 2;
    ctx.fillStyle = 'rgba(100,160,255,0.15)';
    ctx.fillRect(-100, -100 - pitchOffset, 200, 100);
    ctx.fillStyle = 'rgba(100,80,50,0.15)';
    ctx.fillRect(-100, -pitchOffset, 200, 100);

    // Horizon line
    ctx.strokeStyle = 'rgba(0,255,100,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-80, -pitchOffset);
    ctx.lineTo(80, -pitchOffset);
    ctx.stroke();

    // Pitch ladder
    ctx.strokeStyle = 'rgba(0,255,100,0.3)';
    ctx.font = '8px Courier New';
    ctx.fillStyle = 'rgba(0,255,100,0.4)';
    for (let deg = -40; deg <= 40; deg += 10) {
      if (deg === 0) continue;
      const y = -pitchOffset - deg * 2;
      if (Math.abs(y) > 80) continue;
      const lineW = deg % 20 === 0 ? 40 : 20;
      ctx.beginPath();
      ctx.moveTo(-lineW, y);
      ctx.lineTo(lineW, y);
      ctx.stroke();
      ctx.fillText(`${deg}`, lineW + 3, y + 3);
    }

    ctx.restore();

    // Bank angle arc
    ctx.strokeStyle = 'rgba(0,255,100,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, 85, -Math.PI * 0.8, -Math.PI * 0.2);
    ctx.stroke();

    // Bank indicator triangle
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-physics.roll);
    ctx.fillStyle = 'rgba(0,255,100,0.6)';
    ctx.beginPath();
    ctx.moveTo(0, -85);
    ctx.lineTo(-5, -78);
    ctx.lineTo(5, -78);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Center fixed wings
    ctx.strokeStyle = 'rgba(0,255,100,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 30, cy);
    ctx.lineTo(cx - 10, cy);
    ctx.lineTo(cx - 10, cy + 5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + 30, cy);
    ctx.lineTo(cx + 10, cy);
    ctx.lineTo(cx + 10, cy + 5);
    ctx.stroke();
    // Center dot
    ctx.fillStyle = 'rgba(0,255,100,0.7)';
    ctx.beginPath();
    ctx.arc(cx, cy, 2, 0, Math.PI * 2);
    ctx.fill();
  },

  _updateLeadIndicator(physics, camera) {
    if (!this.elements.leadDiamond || !camera) return;

    const nearest = AIAirSystem.getNearestEnemy(physics.position);
    const nearestGround = AIGroundSystem.getNearestUnit(physics.position);

    let target = null;
    if (nearest && (!nearestGround || nearest.distance < nearestGround.distance)) {
      target = nearest.enemy;
    } else if (nearestGround) {
      target = nearestGround.unit;
    }

    if (!target || !target.position) {
      this.elements.leadDiamond.style.display = 'none';
      return;
    }

    const dist = physics.position.distanceTo(target.position);
    const gun = EQUIPMENT.guns.find(g => g.id === Economy.loadout.gun);
    if (!gun || dist > gun.range * 1.5) {
      this.elements.leadDiamond.style.display = 'none';
      return;
    }

    // Calculate lead position
    const bulletTime = dist / gun.bulletVel;
    const targetVel = target.velocity || new THREE.Vector3();
    const leadPos = target.position.clone().add(targetVel.clone().multiplyScalar(bulletTime));

    // Project to screen
    const projected = leadPos.clone().project(camera);
    if (projected.z > 1) {
      this.elements.leadDiamond.style.display = 'none';
      return;
    }

    const screenX = (projected.x * 0.5 + 0.5) * window.innerWidth;
    const screenY = (-projected.y * 0.5 + 0.5) * window.innerHeight;

    this.elements.leadDiamond.style.display = 'block';
    this.elements.leadDiamond.style.left = `${screenX - 6}px`;
    this.elements.leadDiamond.style.top = `${screenY - 6}px`;

    // Lock tone
    const centerDist = Math.sqrt((screenX - window.innerWidth / 2) ** 2 + (screenY - window.innerHeight / 2) ** 2);
    const lockQuality = PHLYMath.clamp(1 - centerDist / 200, 0, 1);
    if (lockQuality > 0.3 && window.AudioSystem) {
      AudioSystem.playLockTone(lockQuality);
    }
  },

  _drawMinimap(physics) {
    if (!this.minimapCtx) return;
    const ctx = this.minimapCtx;
    const w = 180, h = 180;
    const cx = w / 2, cy = h / 2;
    const scale = w / (this.minimapZoom * 2);

    ctx.fillStyle = 'rgba(0,10,20,0.8)';
    ctx.fillRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = 'rgba(0,255,100,0.1)';
    ctx.lineWidth = 0.5;
    const gridStep = 2000 * scale;
    for (let x = cx % gridStep; x < w; x += gridStep) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = cy % gridStep; y < h; y += gridStep) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // Range ring
    ctx.strokeStyle = 'rgba(0,255,100,0.15)';
    ctx.beginPath();
    ctx.arc(cx, cy, w * 0.4, 0, Math.PI * 2);
    ctx.stroke();

    // Enemy air (red dots)
    ctx.fillStyle = '#ff4444';
    for (const e of AIAirSystem.enemies) {
      if (e.hp <= 0) continue;
      const dx = (e.position.x - physics.position.x) * scale;
      const dz = (e.position.z - physics.position.z) * scale;
      if (Math.abs(dx) < w / 2 && Math.abs(dz) < h / 2) {
        ctx.beginPath();
        ctx.arc(cx + dx, cy + dz, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Enemy ground (orange dots)
    ctx.fillStyle = '#ff8800';
    for (const u of AIGroundSystem.units) {
      if (u.hp <= 0) continue;
      const dx = (u.position.x - physics.position.x) * scale;
      const dz = (u.position.z - physics.position.z) * scale;
      if (Math.abs(dx) < w / 2 && Math.abs(dz) < h / 2) {
        ctx.beginPath();
        ctx.arc(cx + dx, cy + dz, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Landing zones (green L)
    const lzs = TerrainSystem.findLandingZones(physics.position, 15000);
    ctx.fillStyle = '#44cc44';
    ctx.font = '8px Courier New';
    for (const lz of lzs.slice(0, 10)) {
      const dx = (lz.x - physics.position.x) * scale;
      const dz = (lz.z - physics.position.z) * scale;
      if (Math.abs(dx) < w / 2 && Math.abs(dz) < h / 2) {
        ctx.fillText('L', cx + dx - 3, cy + dz + 3);
      }
    }

    // Player (white triangle pointing in heading direction)
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(physics.heading * Math.PI / 180);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.lineTo(-3, 4);
    ctx.lineTo(3, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Scale label
    ctx.fillStyle = 'rgba(0,255,100,0.4)';
    ctx.font = '8px Courier New';
    ctx.fillText(`${Math.floor(this.minimapZoom / 1000)}km`, 3, h - 3);
  },

  killFlash(enemyName, reward) {
    if (this.elements.killFlash) {
      this.elements.killFlash.textContent = `${enemyName} +${PHLYMath.formatCurrency(reward)}`;
      this.elements.killFlash.style.opacity = '1';
      this.killFlashTimer = 2;
    }
  },

  addChatMessage(sender, text) {
    this.chatMessages.push({ sender, text, age: 0 });
    if (this.chatMessages.length > 10) this.chatMessages.shift();
    this._updateChat();
  },

  _updateChat() {
    if (!this.elements.chatMessages) return;
    let html = '';
    for (const msg of this.chatMessages) {
      const opacity = PHLYMath.clamp(1 - (msg.age - 5) / 5, 0.2, 1);
      html += `<div class="chat-msg" style="opacity:${opacity}"><span style="color:#4a9eff">${msg.sender}:</span> ${msg.text}</div>`;
    }
    this.elements.chatMessages.innerHTML = html;
  },

  setLobbyCode(code) {
    if (this.elements.lobbyCode) {
      this.elements.lobbyCode.textContent = code;
    }
  },

  toggleMinimapZoom() {
    if (this.minimapZoom === 20000) this.minimapZoom = 10000;
    else if (this.minimapZoom === 10000) this.minimapZoom = 40000;
    else this.minimapZoom = 20000;
  },

  showDamageIndicator(direction) {
    this.damageIndicators[direction] = 0.5;
  },
};

window.HUD = HUD;
console.log('[PHLY] HUD module loaded');
