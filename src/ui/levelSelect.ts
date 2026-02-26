/**
 * Level Select UI — displays available missions with unlock status.
 *
 * Future: grid layout with mission thumbnails, difficulty selection,
 * score requirements for unlocking.
 */

import type { LevelManifest } from '@/levels/levelLoader';

export interface LevelSelectCallbacks {
  onSelectLevel: (levelId: string) => void;
  onBack: () => void;
}

export class LevelSelectUI {
  private container: HTMLDivElement | null = null;
  private _visible = false;

  constructor(
    private _levels: LevelManifest[],
    private _callbacks: LevelSelectCallbacks,
  ) {}

  show(): void {
    // TODO: build level grid DOM
    this._visible = true;
    console.log('[LevelSelect] Showing level select UI');
  }

  hide(): void {
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
    this._visible = false;
  }

  isVisible(): boolean { return this._visible; }

  /** Update level list (e.g. after unlocking a new one). */
  updateLevels(levels: LevelManifest[]): void {
    this._levels = levels;
    // TODO: refresh level cards
  }
}
