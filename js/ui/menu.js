// Main Menu System for PHLY
const MenuSystem = {
  currentScreen: 'loading', // loading, menu, game, hangar, settings, missions

  init() {
    this._bindButtons();
    console.log('[PHLY][Menu] Initialized');
  },

  _bindButtons() {
    const btnQuickPlay = document.getElementById('btn-quick-play');
    const btnHangar = document.getElementById('btn-hangar');
    const btnSettings = document.getElementById('btn-settings');
    const btnDaily = document.getElementById('btn-daily');

    if (btnQuickPlay) {
      btnQuickPlay.addEventListener('click', () => {
        this.startGame();
      });
    }

    if (btnHangar) {
      btnHangar.addEventListener('click', () => {
        this.showHangar();
      });
    }

    if (btnSettings) {
      btnSettings.addEventListener('click', () => {
        this.showSettings();
      });
    }

    if (btnDaily) {
      btnDaily.addEventListener('click', () => {
        this.showMissions();
      });
    }
  },

  showLoading() {
    this.currentScreen = 'loading';
    document.getElementById('loading-screen').classList.remove('hidden');
    document.getElementById('main-menu').classList.add('hidden');
  },

  updateLoadingBar(progress, status) {
    const bar = document.getElementById('loading-bar');
    const statusEl = document.getElementById('loading-status');
    if (bar) bar.style.width = `${progress}%`;
    if (statusEl) statusEl.textContent = status;
  },

  showMenu() {
    this.currentScreen = 'menu';
    document.getElementById('loading-screen').classList.add('hidden');
    document.getElementById('main-menu').classList.remove('hidden');
    document.getElementById('hud').classList.add('hidden');

    // Update wallet display
    const walletEl = document.getElementById('menu-wallet');
    if (walletEl) walletEl.textContent = PHLYMath.formatCurrency(Economy.getBalance());
  },

  startGame() {
    this.currentScreen = 'game';
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    if (window.Game) Game.start();
  },

  showHangar() {
    this.currentScreen = 'hangar';
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('hangar-overlay').classList.add('visible');
    if (window.HangarUI) HangarUI.render();
  },

  hideHangar() {
    document.getElementById('hangar-overlay').classList.remove('visible');
    if (this.currentScreen === 'hangar') {
      this.showMenu();
    }
  },

  showSettings() {
    this.currentScreen = 'settings';
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('settings-overlay').classList.add('visible');
    if (window.SettingsUI) SettingsUI.render();
  },

  hideSettings() {
    document.getElementById('settings-overlay').classList.remove('visible');
    if (this.currentScreen === 'settings') {
      this.showMenu();
    } else if (this.currentScreen === 'game') {
      // Return to game
    }
  },

  showMissions() {
    this.currentScreen = 'missions';
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('missions-overlay').classList.add('visible');
    if (window.MissionSystem) MissionSystem.renderMissionsUI();
  },

  hideMissions() {
    document.getElementById('missions-overlay').classList.remove('visible');
    this.showMenu();
  },

  returnToMenu() {
    if (window.Game) Game.stop();
    this.showMenu();
  },

  isInGame() {
    return this.currentScreen === 'game';
  },
};

window.MenuSystem = MenuSystem;
console.log('[PHLY] Menu module loaded');
