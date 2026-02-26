import type { GameState } from '@/state/gameState';
import { vec3Normalize } from '@/utils/math';

export function updateOOBSystem(state: GameState): void {
  const dt = state.time.delta;
  const player = state.player;
  const bounds = state.bounds;
  const oob = state.combat.oob;

  const margin = bounds.warningMargin;
  const isOutX = player.position.x < bounds.minX + margin || player.position.x > bounds.maxX - margin;
  const isOutZ = player.position.z < bounds.minZ + margin || player.position.z > bounds.maxZ - margin;
  const isOutY = player.position.y > bounds.ceiling - margin;

  const hardOutX = player.position.x < bounds.minX || player.position.x > bounds.maxX;
  const hardOutZ = player.position.z < bounds.minZ || player.position.z > bounds.maxZ;
  const hardOutY = player.position.y > bounds.ceiling;
  const hardOOB = hardOutX || hardOutZ || hardOutY;

  oob.isOOB = isOutX || isOutZ || isOutY;

  if (hardOOB) {
    oob.oobTimer += dt;
  } else {
    oob.oobTimer = Math.max(0, oob.oobTimer - dt * 2);
  }

  // Direction back to center
  const cx = (bounds.minX + bounds.maxX) * 0.5;
  const cz = (bounds.minZ + bounds.maxZ) * 0.5;
  const cy = Math.min(player.position.y, bounds.ceiling * 0.5);
  const dx = cx - player.position.x;
  const dy = cy - player.position.y;
  const dz = cz - player.position.z;
  oob.warningDir = vec3Normalize({ x: dx, y: dy, z: dz });

  // Force kill if timer expires
  if (oob.oobTimer >= oob.oobMaxTime && !player.isDead) {
    player.isDead = true;
    player.crashTimer = 0;
    player.health = 0;
  }
}
