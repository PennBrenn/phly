// Enemy definitions for PHLY
const ENEMY_TIERS = {
  air: [
    { id: 'scout', name: 'Scout', hp: 120, speed: 180, weapons: ['g762'], ai: 'strafe_circle',
      rewards: { easy: 120, medium: 150, hard: 200, elite: 300 }, color: '#aa3333', detectionRange: 3000 },
    { id: 'interceptor', name: 'Interceptor', hp: 280, speed: 250, weapons: ['g50cal', 'aim9'], ai: 'head_on_merge',
      rewards: { easy: 400, medium: 550, hard: 750, elite: 1100 }, color: '#cc2222', detectionRange: 5000 },
    { id: 'strike', name: 'Strike Fighter', hp: 450, speed: 305, weapons: ['g20mm', 'aim120'], ai: 'bvr_merge',
      rewards: { easy: 900, medium: 1200, hard: 1600, elite: 2400 }, color: '#dd1111', detectionRange: 8000 },
    { id: 'heavy', name: 'Heavy Fighter', hp: 700, speed: 236, weapons: ['g30mm', 'aim120', 'aim120'], ai: 'boom_zoom',
      rewards: { easy: 1800, medium: 2500, hard: 3400, elite: 5000 }, color: '#881111', detectionRange: 6000 },
    { id: 'ace', name: 'Ace Pilot', hp: 600, speed: 333, weapons: ['g30mm', 'aim9'], ai: 'full_acm',
      rewards: { easy: 4000, medium: 6000, hard: 9000, elite: 15000 }, color: '#ff0000', detectionRange: 7000, hasEcm: true },
    { id: 'gunship', name: 'Gunship', hp: 1400, speed: 89, weapons: ['g40mm', 'g40mm', 'rockets'], ai: 'slow_suppression',
      rewards: { easy: 2200, medium: 3000, hard: 4500, elite: 7000 }, color: '#993333', detectionRange: 5000 },
    { id: 'bomber', name: 'Bomber', hp: 1800, speed: 194, weapons: ['g50cal_tail', 'bomb500'], ai: 'evasive_climb',
      rewards: { easy: 3000, medium: 4000, hard: 6000, elite: 10000 }, color: '#772222', detectionRange: 4000 },
  ],
  ground: [
    { id: 'jeep', name: 'Scout Jeep', hp: 80, speed: 18, weapons: ['g50mg'], weaponRange: 900, sightRange: 2000,
      climbLimit: 25, rewards: { easy: 80, medium: 110, hard: 150, elite: 220 }, color: '#4A5240' },
    { id: 'ifv', name: 'IFV (APC)', hp: 380, speed: 12.5, weapons: ['g20ac'], weaponRange: 2200, sightRange: 3500,
      climbLimit: 20, rewards: { easy: 350, medium: 500, hard: 700, elite: 1100 }, color: '#2E4028' },
    { id: 'mbt', name: 'MBT (Main Tank)', hp: 900, speed: 9.7, weapons: ['g105ap'], weaponRange: 3500, sightRange: 4000,
      climbLimit: 15, rewards: { easy: 1200, medium: 1800, hard: 2600, elite: 4000 }, color: '#8A7A50' },
    { id: 'spaag', name: 'SPAAG', hp: 300, speed: 11, weapons: ['g30x2'], weaponRange: 2500, sightRange: 5000,
      climbLimit: 20, rewards: { easy: 600, medium: 900, hard: 1300, elite: 2000 }, color: '#3A4A32' },
    { id: 'sam', name: 'SAM Launcher', hp: 250, speed: 6.9, weapons: ['sam_radar'], weaponRange: 12000, sightRange: 15000,
      climbLimit: 10, rewards: { easy: 1500, medium: 2200, hard: 3200, elite: 5000 }, color: '#4A4A3A', lockTime: 4 },
    { id: 'radar', name: 'Radar Station', hp: 200, speed: 0, weapons: [], weaponRange: 0, sightRange: 25000,
      climbLimit: 0, rewards: { easy: 500, medium: 700, hard: 1000, elite: 1500 }, color: '#5A5A4A', sightBoost: 1.5, boostRange: 10000 },
    { id: 'howitzer', name: 'Howitzer', hp: 350, speed: 0, weapons: ['arty155'], weaponRange: 8000, sightRange: 6000,
      climbLimit: 0, rewards: { easy: 900, medium: 1300, hard: 1900, elite: 3000 }, color: '#5A5040' },
    { id: 'truck', name: 'Convoy Truck', hp: 120, speed: 15.3, weapons: [], weaponRange: 0, sightRange: 0,
      climbLimit: 20, rewards: { easy: 150, medium: 200, hard: 280, elite: 420 }, color: '#6A6A50', isConvoy: true },
    { id: 'boat', name: 'Patrol Boat', hp: 280, speed: 22, weapons: ['g20ac', 'sam_short'], weaponRange: 3000, sightRange: 5000,
      climbLimit: 0, rewards: { easy: 400, medium: 600, hard: 850, elite: 1300 }, color: '#4A5A6A', waterOnly: true },
    { id: 'command', name: 'Command Vehicle', hp: 160, speed: 13.9, weapons: ['g50mg'], weaponRange: 1200, sightRange: 4000,
      climbLimit: 22, rewards: { easy: 1000, medium: 1500, hard: 2200, elite: 3500 }, color: '#3A4A3A', sightBuff: 3000 },
  ],
};

// AI states
const AI_STATES = {
  PATROL: 'patrol',
  PURSUE: 'pursue',
  ENGAGE: 'engage',
  EVADE: 'evade',
  RTB: 'rtb',
  // Ground-specific
  ALERT: 'alert',
  SUPPRESS: 'suppress',
  DEAD: 'dead',
};

// Difficulty multipliers
const DIFFICULTY = {
  easy: { hpMult: 0.8, aimMult: 0.5, reactionTime: 1.5, rewardKey: 'easy' },
  medium: { hpMult: 1.0, aimMult: 0.75, reactionTime: 1.0, rewardKey: 'medium' },
  hard: { hpMult: 1.2, aimMult: 0.9, reactionTime: 0.6, rewardKey: 'hard' },
  elite: { hpMult: 1.5, aimMult: 1.0, reactionTime: 0.3, rewardKey: 'elite' },
};

window.ENEMY_TIERS = ENEMY_TIERS;
window.AI_STATES = AI_STATES;
window.DIFFICULTY = DIFFICULTY;
console.log('[PHLY] Enemy config loaded');
