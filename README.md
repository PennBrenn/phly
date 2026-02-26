# PHLY

A 3D multiplayer flight combat game built with **Three.js**, **TypeScript**, and **Vite**.

---

## Architecture Overview

PHLY uses a strict **State ↔ Simulation ↔ Rendering** separation. This decoupling is the single most important architectural decision — it ensures that multiplayer state synchronization (Step 7) can serialize and transmit game data without touching Three.js objects.

### The Core Principle: State Owns the Truth

```
┌───────────┐      ┌──────────────┐      ┌────────────┐
│   Input    │─────▶│  Game State   │◀────▶│ Networking  │
│ (keyboard, │      │ (pure data)   │      │ (serialize  │
│  mouse)    │      │               │      │  & sync)    │
└───────────┘      └──────┬───────┘      └────────────┘
                          │
                   ┌──────▼───────┐
                   │  Simulation   │
                   │ (physics, AI, │
                   │  combat)      │
                   └──────┬───────┘
                          │ reads state
                   ┌──────▼───────┐
                   │  Rendering    │
                   │ (Three.js,    │
                   │  HUD, VFX)    │
                   └──────────────┘
```

- **State** (`src/state/`) — Pure TypeScript data: positions (`{x,y,z}`), rotations (`{x,y,z,w}`), health, ammo, velocities. **Zero Three.js imports.** This is what gets serialized for multiplayer.
- **Simulation** (`src/simulation/`) — Reads and writes to State. Computes physics, AI decisions, collision results, mission logic. Also has **zero Three.js imports**.
- **Rendering** (`src/rendering/`) — Subscribes to State each frame and maps data onto Three.js meshes, cameras, lights, and particles. This is the **only** layer that touches Three.js scene objects.
- **Input** (`src/input/`) — Captures keyboard/mouse events and writes to the State store.
- **Networking** (`src/networking/`) — Serializes State snapshots and sends/receives them over WebRTC. Because State is plain data, serialization is trivial.

### Why This Matters for Multiplayer

When two players connect:
1. The **Host** runs the full Simulation loop and owns authoritative State.
2. Every 50ms (20Hz), the Host serializes its State and sends it to the Client.
3. The **Client** receives State, interpolates between snapshots, and its Rendering layer draws the result.
4. Neither side ever sends Three.js objects — only plain numbers and IDs.

---

## File Structure

```
phly/
├── public/                  # Static assets served by Vite
│   ├── models/              # .glb 3D models
│   ├── textures/            # Terrain, skybox, UI textures
│   └── audio/               # Sound effects, music
│
├── src/
│   ├── main.ts              # Entry point — bootstraps the App
│   │
│   ├── core/                # App lifecycle, game loop, clock
│   │   └── app.ts           # Creates scene, starts loop, owns managers
│   │
│   ├── state/               # Pure data store (NO Three.js imports)
│   │   ├── gameState.ts     # Master state: players, enemies, bullets, objectives
│   │   └── settings.ts      # User preferences (quality, controls, loadout)
│   │
│   ├── simulation/          # Game logic operating on state (NO Three.js imports)
│   │   ├── physics/         # Thrust, lift, drag, gravity, stall, quaternion rotation
│   │   ├── combat/          # Bullet/missile updates, collision detection, damage
│   │   ├── ai/              # Enemy state machines (patrol, engage, fire)
│   │   └── missions/        # Objective tracking, win/lose conditions, scoring
│   │
│   ├── rendering/           # Three.js visuals — reads from state
│   │   ├── sceneSetup.ts    # Lights, fog, sky, terrain mesh
│   │   ├── playerMesh.ts    # Maps player state → Three.js mesh
│   │   ├── enemyRenderer.ts # Maps enemy state → Three.js meshes
│   │   ├── effects.ts       # EffectComposer, bloom, SMAA, tone mapping
│   │   ├── particles.ts     # Contrails, explosions, muzzle flash
│   │   ├── cameras.ts       # Chase cam, cockpit cam logic
│   │   └── hud/             # HTML/CSS overlay (speed, altitude, objectives)
│   │
│   ├── input/               # Keyboard & mouse capture → writes to state
│   │   └── inputManager.ts  # Key bindings, mouse aim toggle, sensitivity
│   │
│   ├── networking/          # Multiplayer sync (Step 7)
│   │   ├── peerManager.ts   # PeerJS connection, room codes via Vercel KV
│   │   ├── syncLoop.ts      # 20Hz state broadcast & interpolation
│   │   └── protocol.ts      # Message types, serialization format
│   │
│   ├── ui/                  # HTML overlay screens
│   │   ├── mainMenu.ts      # Title screen, cinematic camera flyby
│   │   ├── hangar.ts        # Plane/loadout selection
│   │   ├── settings.ts      # Quality presets, controls, debug mode
│   │   └── loading.ts       # Loading screen with progress bar
│   │
│   ├── levels/              # Level data & loader
│   │   ├── levelLoader.ts   # Parses level JSON → spawns entities in state
│   │   └── levels/          # JSON level definitions
│   │
│   ├── assets/              # Asset loading utilities
│   │   └── modelLoader.ts   # GLTFLoader wrapper, flat shading, offset config
│   │
│   ├── utils/               # Shared helpers
│   │   ├── math.ts          # Lerp, clamp, quaternion helpers
│   │   └── pool.ts          # Generic object pool
│   │
│   └── workers/             # Web Workers for heavy computation
│
├── tests/                   # Unit & integration tests
├── tools/                   # Build scripts, level editor (Step 8)
├── models/                  # Source model files (pre-public)
│
├── index.html               # Vite entry HTML
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## Roadmap

| Step | Description | Status |
|------|-------------|--------|
| 0 | Architecture & file structure | ✅ |
| 1-2 | Core loop, flight physics, input, cameras, HUD | ⬜ |
| 3 | Model loading, post-processing, terrain, settings, loading screen | ⬜ |
| 4 | Combat: bullets, missiles, collision, AI, explosions | ⬜ |
| 5-6 | Main menu, hangar, loadout, level loader, missions | ⬜ |
| 7 | Multiplayer: PeerJS, Vercel KV rooms, 20Hz sync, interpolation | ⬜ |
| 8 | Top-down level editor (`/builder` route) | ⬜ |

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
- **PeerJS** — WebRTC multiplayer (Step 7)
- **Vercel KV** — Room code persistence (Step 7)
