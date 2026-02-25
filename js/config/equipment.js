// Equipment definitions for PHLY
const EQUIPMENT = {
  fuselages: [
    { id: 'mk1', name: 'Mk.I Light Frame', hp: 350, drag: 0.02, slots: 2, cost: 0, handling: 0, special: 'Default aircraft', color: '#7a7a7a' },
    { id: 'mk2', name: 'Mk.II Interceptor', hp: 500, drag: 0.022, slots: 2, cost: 8000, handling: 0, special: 'Balanced', color: '#5a6a7a' },
    { id: 'mk3', name: 'Mk.III Strike', hp: 700, drag: 0.028, slots: 3, cost: 20000, handling: 0, special: 'Third weapon slot', color: '#4a5a4a' },
    { id: 'mk4', name: 'Mk.IV Heavy Bomber', hp: 1100, drag: 0.038, slots: 3, cost: 45000, handling: -0.15, special: '-15% handling. Highest HP', color: '#3a3a3a' },
    { id: 'mk5', name: 'Mk.V Stealth', hp: 450, drag: 0.015, slots: 2, cost: 75000, handling: 0, special: 'Enemy detection -40%', color: '#2a2a3a', stealthMod: 0.6 },
  ],
  wings: [
    { id: 'delta', name: 'Standard Delta', rollRate: 1.0, lift: 1.0, handling: 0, cost: 0, sweep: 45, taper: 0.3, span: 8, dihedral: 2 },
    { id: 'swept', name: 'Swept Back', rollRate: 1.3, lift: 0.7, handling: 0.10, cost: 5000, sweep: 55, taper: 0.4, span: 7, dihedral: 1 },
    { id: 'variable', name: 'Variable Sweep', rollRate: 1.2, lift: 1.1, handling: 0.15, cost: 18000, sweep: 40, taper: 0.35, span: 9, dihedral: 2 },
    { id: 'canard', name: 'Canard', rollRate: 1.5, lift: 1.3, handling: 0.25, cost: 32000, sweep: 30, taper: 0.5, span: 7.5, dihedral: 3 },
    { id: 'stub', name: 'Short Stub', rollRate: 0.6, lift: 0.5, handling: -0.20, cost: 2000, sweep: 20, taper: 0.8, span: 4, dihedral: 0 },
  ],
  engines: [
    { id: 'j69', name: 'J69 Turbojet', topSpeed: 200, climbRate: 35, afterburner: false, abBoost: 0, abDuration: 0, cost: 0 },
    { id: 'j85', name: 'J85 Twin', topSpeed: 255, climbRate: 55, afterburner: false, abBoost: 0, abDuration: 0, cost: 12000 },
    { id: 'f100', name: 'F100-PW Turbo', topSpeed: 333, climbRate: 80, afterburner: true, abBoost: 0.4, abDuration: 15, cost: 30000 },
    { id: 'rb199', name: 'RB199 Reheat', topSpeed: 403, climbRate: 110, afterburner: true, abBoost: 0.5, abDuration: 20, cost: 60000, detectMod: 1.3 },
    { id: 'scramjet', name: 'Scramjet Prototype', topSpeed: 611, climbRate: 150, afterburner: true, abBoost: 0.6, abDuration: 999, cost: 120000, reqFuselage: ['mk3','mk4'] },
  ],
  guns: [
    { id: 'g762', name: '7.62 AP', caliber: '7.62mm', rof: 1200, bulletVel: 900, dmg: 8, range: 1800, cost: 0, tracerColor: '#ffffaa', heatRate: 0.008, coolRate: 0.02 },
    { id: 'g50cal', name: '.50 cal API', caliber: '12.7mm', rof: 800, bulletVel: 920, dmg: 22, range: 2200, cost: 6000, tracerColor: '#ffffff', heatRate: 0.012, coolRate: 0.018 },
    { id: 'g20mm', name: '20mm HE', caliber: '20mm', rof: 600, bulletVel: 850, dmg: 55, range: 2500, cost: 15000, tracerColor: '#ccffcc', splash: 3, heatRate: 0.015, coolRate: 0.016 },
    { id: 'g30mm', name: '30mm Rotary', caliber: '30mm', rof: 2400, bulletVel: 780, dmg: 90, range: 2000, cost: 38000, tracerColor: '#ffaa44', heatRate: 0.025, coolRate: 0.012 },
    { id: 'g40mm', name: '40mm AP', caliber: '40mm', rof: 120, bulletVel: 820, dmg: 200, range: 3200, cost: 55000, tracerColor: '#ff8833', heatRate: 0.03, coolRate: 0.02 },
    { id: 'g105mm', name: '105mm HEAT', caliber: '105mm', rof: 20, bulletVel: 380, dmg: 800, range: 2800, cost: 110000, tracerColor: '#ff4400', heatRate: 0.05, coolRate: 0.015, recoilPenalty: 0.05 },
  ],
  ordnance: [
    { id: 'aim9', name: 'AIM-9 Sidewinder', type: 'ir_missile', qty: 4, guidance: 'ir', gLim: 4, blastR: 8, dmg: 420, handling: -0.02, cost: 3500, range: 2000, speed: 800 },
    { id: 'aim120', name: 'AIM-120 AMRAAM', type: 'radar_missile', qty: 2, guidance: 'radar', gLim: 8, blastR: 6, dmg: 500, handling: -0.05, cost: 18000, range: 12000, speed: 1200 },
    { id: 'bomb100', name: '100kg Iron Bomb', type: 'bomb', qty: 8, guidance: 'ballistic', blastR: 35, dmg: 900, handling: -0.08, cost: 800, perUnit: true },
    { id: 'bomb500', name: '500kg Iron Bomb', type: 'bomb', qty: 4, guidance: 'ballistic', blastR: 80, dmg: 2200, handling: -0.18, cost: 3000, perUnit: true },
    { id: 'rockets', name: 'Rocket Pod (x19)', type: 'rockets', qty: 19, guidance: 'unguided', blastR: 5, dmg: 180, handling: -0.05, cost: 4500, speed: 600 },
    { id: 'heat120', name: '120mm HEAT Rifle', type: 'recoilless', qty: 6, guidance: 'straight', blastR: 12, dmg: 950, handling: -0.10, cost: 22000, range: 900, speed: 400 },
    { id: 'nuke', name: 'B61 Tactical Nuke', type: 'nuke', qty: 1, guidance: 'ballistic_timer', blastR: 1200, dmg: 99999, handling: -0.30, cost: 2500000, fuseTime: 8 },
  ],
  countermeasures: [
    { id: 'none', name: 'None', type: 'none', charges: 0, cost: 0 },
    { id: 'flare16', name: 'Flare Pack (x16)', type: 'flare', charges: 16, cost: 4500, breakChance: 0.85 },
    { id: 'chaff16', name: 'Chaff Pack (x16)', type: 'chaff', charges: 16, cost: 5000, breakChance: 0.80 },
    { id: 'dircm', name: 'DIRCM Pod', type: 'dircm', charges: Infinity, cost: 28000, breakChance: 0.40, perSecond: true },
    { id: 'ecm', name: 'Full ECM Suite', type: 'ecm', charges: { flare: 8, chaff: 8 }, cost: 55000, breakChance: 0.90, hasDircm: true },
  ],
};

// Calculate total loadout value
function getLoadoutValue(loadout) {
  let val = 0;
  const f = EQUIPMENT.fuselages.find(e => e.id === loadout.fuselage);
  const w = EQUIPMENT.wings.find(e => e.id === loadout.wings);
  const en = EQUIPMENT.engines.find(e => e.id === loadout.engine);
  const g = EQUIPMENT.guns.find(e => e.id === loadout.gun);
  if (f) val += f.cost;
  if (w) val += w.cost;
  if (en) val += en.cost;
  if (g) val += g.cost;
  if (loadout.slot1) {
    const s1 = EQUIPMENT.ordnance.find(e => e.id === loadout.slot1);
    if (s1) val += s1.perUnit ? s1.cost * s1.qty : s1.cost;
  }
  if (loadout.slot2) {
    const s2 = EQUIPMENT.ordnance.find(e => e.id === loadout.slot2);
    if (s2) val += s2.perUnit ? s2.cost * s2.qty : s2.cost;
  }
  if (loadout.countermeasures) {
    const cm = EQUIPMENT.countermeasures.find(e => e.id === loadout.countermeasures);
    if (cm) val += cm.cost;
  }
  return val;
}

// Default starting loadout
const DEFAULT_LOADOUT = {
  fuselage: 'mk1',
  wings: 'delta',
  engine: 'j69',
  gun: 'g762',
  slot1: null,
  slot2: null,
  countermeasures: 'none',
};

window.EQUIPMENT = EQUIPMENT;
window.getLoadoutValue = getLoadoutValue;
window.DEFAULT_LOADOUT = DEFAULT_LOADOUT;
console.log('[PHLY] Equipment config loaded');
