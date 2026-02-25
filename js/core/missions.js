// Daily Missions System for PHLY
const MissionSystem = {
  missions: [],
  lastRefreshDate: null,
  allCompleteBonus: 5000,

  init() {
    const saved = localStorage.getItem('phly_missions');
    const today = new Date().toISOString().split('T')[0];

    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.date === today) {
          this.missions = data.missions;
          this.lastRefreshDate = data.date;
          console.log('[PHLY][Missions] Loaded saved missions for today');
          return;
        }
      } catch (e) { /* regenerate */ }
    }

    this.generateDailyMissions();
    console.log('[PHLY][Missions] Generated new daily missions');
  },

  generateDailyMissions() {
    const today = new Date().toISOString().split('T')[0];
    this.lastRefreshDate = today;

    const allMissions = [
      { type: 'kill_count', desc: 'Shoot down 5 Scouts', target: 'scout', count: 5, isGround: false, reward: 1500 },
      { type: 'kill_count', desc: 'Shoot down 3 Interceptors', target: 'interceptor', count: 3, isGround: false, reward: 3000 },
      { type: 'kill_count', desc: 'Shoot down 2 Ace Pilots', target: 'ace', count: 2, isGround: false, reward: 8000 },
      { type: 'kill_count', desc: 'Shoot down 5 enemy aircraft', target: 'any_air', count: 5, isGround: false, reward: 2000 },
      { type: 'kill_count', desc: 'Destroy 3 ground vehicles', target: 'any_ground', count: 3, isGround: true, reward: 2500 },
      { type: 'kill_count', desc: 'Destroy 1 SAM Launcher', target: 'sam', count: 1, isGround: true, reward: 3500 },
      { type: 'kill_count', desc: 'Destroy 2 MBTs', target: 'mbt', count: 2, isGround: true, reward: 4000 },
      { type: 'weapon_specific', desc: 'Get 10 gun kills without missiles', gunOnly: true, count: 10, reward: 3000 },
      { type: 'weapon_specific', desc: 'Get 3 missile kills', missileOnly: true, count: 3, reward: 2500 },
      { type: 'survival', desc: 'Stay airborne for 10 minutes without landing', timeSeconds: 600, reward: 2500 },
      { type: 'survival', desc: 'Stay airborne for 20 minutes without landing', timeSeconds: 1200, reward: 5000 },
      { type: 'streak', desc: 'Achieve a 6-kill streak', streakTarget: 6, reward: 4000 },
      { type: 'streak', desc: 'Achieve a 10-kill streak', streakTarget: 10, reward: 8000 },
      { type: 'economy', desc: 'Earn $5,000 in one session', earnTarget: 5000, reward: 2000 },
      { type: 'economy', desc: 'Spend $10,000 in the Hangar today', spendTarget: 10000, reward: 2000 },
      { type: 'kill_count', desc: 'Destroy a convoy', target: 'truck', count: 3, isGround: true, reward: 3000 },
    ];

    // Shuffle and pick 3
    const shuffled = allMissions.sort(() => Math.random() - 0.5);
    this.missions = shuffled.slice(0, 3).map((m, idx) => ({
      ...m,
      id: idx,
      progress: 0,
      completed: false,
      claimed: false,
    }));

    this.save();
  },

  save() {
    localStorage.setItem('phly_missions', JSON.stringify({
      date: this.lastRefreshDate,
      missions: this.missions,
    }));
  },

  trackKill(enemyId, isGround) {
    for (const m of this.missions) {
      if (m.completed) continue;
      if (m.type === 'kill_count') {
        if (m.target === 'any_air' && !isGround) { m.progress++; }
        else if (m.target === 'any_ground' && isGround) { m.progress++; }
        else if (m.target === enemyId) { m.progress++; }

        if (m.progress >= m.count) {
          m.completed = true;
          this._completeMission(m);
        }
      }
      if (m.type === 'weapon_specific') {
        if (m.gunOnly) { m.progress++; }
        if (m.progress >= m.count) {
          m.completed = true;
          this._completeMission(m);
        }
      }
    }
    this._checkAllComplete();
    this.save();
  },

  trackStreak(streak) {
    for (const m of this.missions) {
      if (m.completed || m.type !== 'streak') continue;
      if (streak >= m.streakTarget) {
        m.progress = m.streakTarget;
        m.completed = true;
        this._completeMission(m);
      }
    }
    this._checkAllComplete();
    this.save();
  },

  trackAirtime(dt) {
    for (const m of this.missions) {
      if (m.completed || m.type !== 'survival') continue;
      m.progress += dt;
      if (m.progress >= m.timeSeconds) {
        m.completed = true;
        this._completeMission(m);
      }
    }
    this.save();
  },

  trackEarning(amount) {
    for (const m of this.missions) {
      if (m.completed || m.type !== 'economy' || !m.earnTarget) continue;
      m.progress += amount;
      if (m.progress >= m.earnTarget) {
        m.completed = true;
        this._completeMission(m);
      }
    }
    this.save();
  },

  trackSpending(amount) {
    for (const m of this.missions) {
      if (m.completed || m.type !== 'economy' || !m.spendTarget) continue;
      m.progress += amount;
      if (m.progress >= m.spendTarget) {
        m.completed = true;
        this._completeMission(m);
      }
    }
    this.save();
  },

  _completeMission(mission) {
    if (mission.claimed) return;
    mission.claimed = true;
    Economy.adjustBalance(mission.reward, `Mission complete: ${mission.desc}`);
    console.log(`[PHLY][Missions] COMPLETED: ${mission.desc} -> +$${mission.reward}`);
    if (window.HUD) HUD.killFlash(`MISSION: ${mission.desc}`, mission.reward);
  },

  _checkAllComplete() {
    const allDone = this.missions.every(m => m.completed);
    if (allDone && !this._allBonusClaimed) {
      this._allBonusClaimed = true;
      Economy.adjustBalance(this.allCompleteBonus, 'All daily missions bonus');
      console.log(`[PHLY][Missions] ALL MISSIONS COMPLETE! Bonus: +$${this.allCompleteBonus}`);
      if (window.HUD) HUD.killFlash('ALL MISSIONS COMPLETE!', this.allCompleteBonus);
    }
  },

  getMissions() { return this.missions; },

  renderMissionsUI() {
    const container = document.getElementById('missions-content');
    if (!container) return;

    let html = '<h2>DAILY MISSIONS</h2>';
    html += '<button class="menu-btn" id="missions-back" style="margin-bottom:20px">BACK</button>';

    for (const m of this.missions) {
      const pct = m.type === 'survival'
        ? Math.min(100, (m.progress / m.timeSeconds) * 100)
        : m.type === 'economy'
          ? Math.min(100, (m.progress / (m.earnTarget || m.spendTarget || 1)) * 100)
          : Math.min(100, (m.progress / m.count) * 100);

      html += `
        <div class="mission-card ${m.completed ? 'completed' : ''}">
          <div class="mission-desc">${m.desc}</div>
          <div class="mission-reward">${m.completed ? '✓ ' : ''}${PHLYMath.formatCurrency(m.reward)}</div>
          <div class="mission-progress">${Math.floor(pct)}%</div>
          <div class="mission-bar"><div class="mission-bar-fill" style="width:${pct}%"></div></div>
        </div>
      `;
    }

    const allDone = this.missions.every(m => m.completed);
    if (allDone) {
      html += `<div class="mission-card completed">
        <div class="mission-desc">ALL MISSIONS COMPLETE!</div>
        <div class="mission-reward">+${PHLYMath.formatCurrency(this.allCompleteBonus)} bonus</div>
      </div>`;
    }

    container.innerHTML = html;

    // Back button
    const backBtn = document.getElementById('missions-back');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        document.getElementById('missions-overlay').classList.remove('visible');
        document.getElementById('main-menu').classList.remove('hidden');
      });
    }
  },
};

window.MissionSystem = MissionSystem;
console.log('[PHLY] Missions module loaded');
