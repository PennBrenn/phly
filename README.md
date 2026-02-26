# PHLY

A 3D flight combat game built with **Three.js**, **TypeScript**, and **Vite**. Features air and ground combat, data-driven configuration, difficulty scaling, and a full HUD with missile seeker mechanics.

---

## Features

- **Flight Physics** — Quaternion-based 6-DOF flight model with lift, drag, thrust, gravity, stall, and G-limit
- **Air Combat** — Guns, heat-seeking missiles with G-limited homing, seeker lock-on mechanic
- **Ground Combat** — Static and moving ground vehicles (tanks, SAMs) that follow terrain
- **Weapon Slots** — 4 weapon slots (keys 1-4), extensible per-plane via JSON config
- **Missile Seeker** — Hold Space to engage seeker (5-15s configurable), release to fire when locked
- **Countermeasures** — Chaff/flare system (X key) that can break missile locks
- **Enemy AI** — State machine (patrol → engage → fire → evade) with terrain avoidance, missile evasion, chaff deployment, and difficulty-scaled behavior
- **Difficulty System** — Easy / Normal / Hard / Ace — affects enemy health, maneuverability, fire rate, and whether enemies fire missiles
- **Out of Bounds** — Boundary system with warning timer and forced respawn
- **Mission System** — JSON-based missions defining enemy spawns, terrain seed, and bounds
- **Data-Driven Config** — All weapons, planes, and vehicles defined in JSON files for easy modding
- **Dynamic HUD** — Crosshair follows plane forward, missile lock ring, enemy markers with distance/health, seeker progress bar, weapon slots, OOB warning, chaff counter
- **Mouse Aim** — Flight-sim style intercept cursor with edge-of-screen camera panning
- **Visual Effects** — Post-processing (bloom, tone mapping), camera shake, crash system, damage vignette, explosions with fragments

---

## Controls

| Key | Action |
|-----|--------|
| **W/S** | Pitch down/up |
| **A/D** | Roll left/right |
| **Q/E** | Yaw left/right |
| **R/F** | Throttle up/down |
| **Left Mouse** | Fire selected weapon |
| **Space** (hold) | Engage missile seeker — release to fire when locked |
| **X** | Deploy chaff/flare |
| **1-4** | Select weapon slot |
| **Tab** | Toggle chase/cockpit camera |
| **Esc** | Settings menu |

---

## Architecture

PHLY uses a strict **State ↔ Simulation ↔ Rendering** separation:

```
Input → Game State ← Networking
            ↓
       Simulation
     (physics, AI, combat)
            ↓
       Rendering
    (Three.js, HUD, VFX)
```

- **State** (`src/state/`) — Pure data, zero Three.js imports
- **Simulation** (`src/simulation/`) — Physics, AI, combat logic — zero Three.js imports
- **Rendering** (`src/rendering/`) — Maps state to Three.js scene objects
- **Input** (`src/input/`) — Keyboard/mouse → state

---

## Data Configuration

All game entities are defined via JSON files in `public/data/`:

```
public/
├── data/
│   ├── weapons/         # cannon.json, sidewinder.json, chaff.json
│   ├── planes/          # delta.json (stats, weapon slots, model path)
│   └── vehicles/        # tank.json, sam.json (ground units)
├── missions/
│   └── mission1.json    # Enemy spawns, terrain seed, bounds, difficulty tuning
└── models/
    ├── planes/planes/delta.glb
    └── ground/tank.glb
```

### Weapon JSON Example
```json
{
  "id": "sidewinder",
  "type": "missile",
  "speed": 250,
  "turnRate": 2.5,
  "gLimit": 30,
  "damage": 50,
  "lockRange": 2000,
  "seekerTimeMin": 5,
  "seekerTimeMax": 15,
  "ammo": 4
}
```

### Plane JSON Example
```json
{
  "id": "delta",
  "maxSpeed": 360,
  "stallSpeed": 55,
  "health": 100,
  "weaponSlots": [
    { "slot": 1, "weaponId": "cannon" },
    { "slot": 2, "weaponId": "sidewinder" },
    { "slot": 3, "weaponId": "sidewinder" },
    { "slot": 4, "weaponId": "chaff" }
  ]
}
```

---

## File Structure

```
src/
├── core/app.ts              # Game loop, init, system wiring
├── state/
│   ├── gameState.ts         # Player, input, camera, bounds
│   └── combatState.ts       # Bullets, missiles, enemies, seeker, chaff, OOB
├── simulation/
│   ├── physics/
│   │   ├── flightPhysics.ts # Flight model, crash detection
│   │   └── oobSystem.ts     # Out of bounds tracking
│   ├── combat/
│   │   ├── bulletSystem.ts  # Gun firing, weapon slot integration
│   │   ├── missileSystem.ts # Seeker, G-limited homing, chaff, enemy missiles
│   │   └── collisionSystem.ts
│   └── ai/enemyAI.ts       # Air + ground AI, terrain avoidance, evasion
├── rendering/
│   ├── cameras.ts           # Chase/cockpit cam, shake, mouse-aim edge panning
│   ├── combatRenderer.ts    # Bullets, missiles, enemies (air + tank), explosions
│   ├── hud/hud.ts           # Full HUD: gauges, crosshair, seeker, slots, OOB
│   └── ...
├── input/inputManager.ts    # Keys, mouse, weapon slots, seeker, chaff
├── ui/settingsUI.ts         # Grouped settings: Graphics, Controls, Gameplay, Debug
├── utils/
│   ├── math.ts              # Vec3/Quat helpers
│   ├── terrain.ts           # Heightmap sampling
│   └── dataLoader.ts        # JSON config loader + cache
└── core/settings.ts         # Persistent settings with difficulty + seeker duration
```

---

## Difficulty Levels

| Setting | Easy | Normal | Hard | Ace |
|---------|------|--------|------|-----|
| Enemy Health | 70% | 100% | 150% | 200% |
| Enemy Maneuverability | 60% | 100% | 130% | 160% |
| Enemy Fire Rate | 50% | 100% | 150% | 200% |
| Enemy Missiles | No | Yes | Yes | Yes |
| Enemy Chaff | 0 | 2 | 4 | 6 |

---

## Development

```bash
npm install
npm run dev        # Starts Vite dev server on http://localhost:3000
npm run build      # Production build
```

## Tech Stack

- **Three.js** — 3D rendering
- **TypeScript** — Type safety
- **Vite** — Dev server & bundler
- **simplex-noise** — Procedural terrain generation
