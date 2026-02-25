// Economy system for PHLY
const Economy = {
  balance: 2000, // New pilot bonus
  killStreak: 0,
  groundStreak: 0,
  totalKills: 0,
  totalDeaths: 0,
  sessionKills: 0,
  ownedItems: new Set(['mk1', 'delta', 'j69', 'g762', 'none']),
  loadout: null,
  lastDamagingEnemyReward: 0,
  debtRecoveryRate: 2, // $/s when in debt

  init() {
    this.loadout = JSON.parse(JSON.stringify(DEFAULT_LOADOUT));
    // Load from localStorage as Supabase stub
    const saved = localStorage.getItem('phly_save');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        this.balance = data.balance ?? 2000;
        this.ownedItems = new Set(data.ownedItems || ['mk1', 'delta', 'j69', 'g762', 'none']);
        this.loadout = data.loadout || JSON.parse(JSON.stringify(DEFAULT_LOADOUT));
        this.totalKills = data.totalKills || 0;
        this.totalDeaths = data.totalDeaths || 0;
        console.log('[PHLY][Economy] Save loaded. Balance: $' + this.balance);
      } catch (e) {
        console.warn('[PHLY][Economy] Failed to load save, starting fresh');
      }
    } else {
      console.log('[PHLY][Economy] New pilot! Bonus $2,000 credited');
    }
    this.save();
  },

  save() {
    localStorage.setItem('phly_save', JSON.stringify({
      balance: this.balance,
      ownedItems: Array.from(this.ownedItems),
      loadout: this.loadout,
      totalKills: this.totalKills,
      totalDeaths: this.totalDeaths,
    }));
  },

  adjustBalance(delta, reason) {
    this.balance += delta;
    this.save();
    console.log(`[PHLY][Economy] ${reason}: ${delta >= 0 ? '+' : ''}$${delta} -> Balance: $${this.balance}`);
    return this.balance;
  },

  creditKill(enemyTier, isGround, difficulty, lobbyMultiplier) {
    difficulty = difficulty || 'medium';
    lobbyMultiplier = lobbyMultiplier || 1.0;
    const tierData = isGround
      ? ENEMY_TIERS.ground.find(t => t.id === enemyTier)
      : ENEMY_TIERS.air.find(t => t.id === enemyTier);
    if (!tierData) return 0;

    const baseReward = tierData.rewards[DIFFICULTY[difficulty].rewardKey];
    if (isGround) {
      this.groundStreak++;
    } else {
      this.killStreak++;
    }
    const streak = isGround ? this.groundStreak : this.killStreak;
    const streakMult = getStreakMultiplier(streak);
    const reward = Math.floor(baseReward * streakMult * lobbyMultiplier);

    this.totalKills++;
    this.sessionKills++;
    this.adjustBalance(reward, `Kill: ${tierData.name} (streak x${streakMult})`);
    return reward;
  },

  debitRepair(hpPct) {
    const loadoutValue = getLoadoutValue(this.loadout);
    const repair = getRepairCost(hpPct, loadoutValue);
    this.adjustBalance(-repair.cost, `Repair (${repair.level})`);
    return repair;
  },

  debitCrash() {
    const penalty = getCrashPenalty(this.lastDamagingEnemyReward);
    this.killStreak = 0;
    this.groundStreak = 0;
    this.totalDeaths++;
    this.adjustBalance(-penalty, 'Crash penalty');
    this.save();
    return penalty;
  },

  canAfford(cost) {
    return this.balance >= cost;
  },

  purchaseItem(category, itemId) {
    if (this.ownedItems.has(itemId)) return { success: false, reason: 'Already owned' };
    let item;
    switch (category) {
      case 'fuselages': item = EQUIPMENT.fuselages.find(e => e.id === itemId); break;
      case 'wings': item = EQUIPMENT.wings.find(e => e.id === itemId); break;
      case 'engines': item = EQUIPMENT.engines.find(e => e.id === itemId); break;
      case 'guns': item = EQUIPMENT.guns.find(e => e.id === itemId); break;
      case 'ordnance': item = EQUIPMENT.ordnance.find(e => e.id === itemId); break;
      case 'countermeasures': item = EQUIPMENT.countermeasures.find(e => e.id === itemId); break;
    }
    if (!item) return { success: false, reason: 'Item not found' };
    if (!this.canAfford(item.cost || (item.perUnit ? item.cost * item.qty : item.cost))) {
      return { success: false, reason: 'Insufficient funds' };
    }
    const cost = item.perUnit ? item.cost * item.qty : item.cost;
    this.adjustBalance(-cost, `Purchase: ${item.name}`);
    this.ownedItems.add(itemId);
    this.save();
    return { success: true, cost };
  },

  equipItem(slot, itemId) {
    if (!this.ownedItems.has(itemId) && itemId !== null) return false;
    this.loadout[slot] = itemId;
    this.save();
    console.log(`[PHLY][Economy] Equipped ${itemId} in slot ${slot}`);
    return true;
  },

  getLoadout() { return this.loadout; },
  getBalance() { return this.balance; },
  getLoadoutValue() { return getLoadoutValue(this.loadout); },

  // Debt recovery tick (call every second)
  tickDebtRecovery(dt) {
    if (this.balance < 0) {
      const recovery = Math.min(Math.abs(this.balance), this.debtRecoveryRate * dt);
      this.balance += recovery;
      if (this.balance >= 0) this.balance = 0;
    }
  },
};

window.Economy = Economy;
console.log('[PHLY] Economy module loaded');
