/**
 * Hangar UI — plane selection, loadout configuration, and upgrades.
 *
 * Future: 3D plane preview with orbit camera,
 * weapon slot drag-and-drop, upgrade purchase flow.
 */

import type { UpgradeState, LoadoutConfig } from '@/state/upgradeState';
import type { EconomyState } from '@/state/economyState';

export interface HangarCallbacks {
  onSelectPlane: (planeId: string) => void;
  onChangeLoadout: (loadout: LoadoutConfig) => void;
  onPurchasePlane: (planeId: string) => void;
  onPurchaseUpgrade: (upgradeId: string) => void;
  onConfirm: () => void;
  onBack: () => void;
}

export class HangarUI {
  private container: HTMLDivElement | null = null;
  private _visible = false;

  constructor(
    private _upgrades: UpgradeState,
    private _economy: EconomyState,
    private _callbacks: HangarCallbacks,
  ) {}

  show(): void {
    // TODO: build hangar DOM, show plane list, loadout editor
    this._visible = true;
    console.log('[Hangar] Showing hangar UI');
  }

  hide(): void {
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
    this._visible = false;
  }

  isVisible(): boolean { return this._visible; }

  /** Update displayed economy values. */
  updateEconomy(economy: EconomyState): void {
    this._economy = economy;
    // TODO: refresh credit display
  }

  /** Update displayed upgrade state. */
  updateUpgrades(upgrades: UpgradeState): void {
    this._upgrades = upgrades;
    // TODO: refresh plane unlock states, loadout
  }
}
