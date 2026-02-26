/**
 * Sync Loop — handles state interpolation and 20Hz broadcast.
 *
 * Future:
 * - Host: runs simulation, broadcasts authoritative state at 20Hz
 * - Client: receives snapshots, interpolates between them for smooth rendering
 * - Input: clients send input to host, host applies and includes in next snapshot
 */

import type { GameState } from '@/state/gameState';

export interface InterpolationBuffer {
  snapshots: { timestamp: number; state: Partial<GameState> }[];
  renderDelay: number; // ms behind latest snapshot (typically 100ms)
}

export function createInterpolationBuffer(): InterpolationBuffer {
  return {
    snapshots: [],
    renderDelay: 100,
  };
}

/** Push a new snapshot into the buffer. */
export function pushSnapshot(
  _buffer: InterpolationBuffer,
  _timestamp: number,
  _state: Partial<GameState>,
): void {
  // TODO: add snapshot, trim old ones (keep ~1s worth)
}

/** Interpolate between two snapshots for smooth client rendering. */
export function interpolateState(
  _buffer: InterpolationBuffer,
  _currentTime: number,
): Partial<GameState> | null {
  // TODO: find two snapshots bracketing (currentTime - renderDelay),
  // lerp positions/rotations, snap discrete state
  return null;
}
