// Hangar UI for PHLY
const HangarUI = {
  render() {
    const container = document.getElementById('hangar-content');
    if (!container) return;

    const loadout = Economy.getLoadout();
    const balance = Economy.getBalance();

    let html = '<h2>HANGAR</h2>';

    // Current loadout summary
    html += '<div class="hangar-section"><h3>CURRENT LOADOUT</h3>';
    html += `<div style="font-size:12px;color:#888;margin-bottom:16px">`;
    const fus = EQUIPMENT.fuselages.find(f => f.id === loadout.fuselage);
    const wing = EQUIPMENT.wings.find(w => w.id === loadout.wings);
    const eng = EQUIPMENT.engines.find(e => e.id === loadout.engine);
    const gun = EQUIPMENT.guns.find(g => g.id === loadout.gun);
    html += `Fuselage: <span style="color:#fff">${fus?.name}</span> | `;
    html += `Wings: <span style="color:#fff">${wing?.name}</span> | `;
    html += `Engine: <span style="color:#fff">${eng?.name}</span> | `;
    html += `Gun: <span style="color:#fff">${gun?.name}</span><br>`;
    const s1 = loadout.slot1 ? EQUIPMENT.ordnance.find(o => o.id === loadout.slot1) : null;
    const s2 = loadout.slot2 ? EQUIPMENT.ordnance.find(o => o.id === loadout.slot2) : null;
    const cm = EQUIPMENT.countermeasures.find(c => c.id === loadout.countermeasures);
    html += `Slot 1: <span style="color:#fff">${s1?.name || 'Empty'}</span> | `;
    html += `Slot 2: <span style="color:#fff">${s2?.name || 'Empty'}</span> | `;
    html += `CM: <span style="color:#fff">${cm?.name || 'None'}</span><br>`;
    html += `Total Value: <span style="color:#4a9eff">${PHLYMath.formatCurrency(Economy.getLoadoutValue())}</span>`;
    html += `</div></div>`;

    // Fuselages
    html += this._renderCategory('FUSELAGE', 'fuselages', EQUIPMENT.fuselages, loadout.fuselage, balance, (item) => {
      return `HP: ${item.hp} | Drag: ${item.drag} | Slots: ${item.slots}${item.special ? '<br>' + item.special : ''}`;
    });

    // Wings
    html += this._renderCategory('WINGS', 'wings', EQUIPMENT.wings, loadout.wings, balance, (item) => {
      return `Roll: ${item.rollRate}x | Lift: ${item.lift}x | Handling: ${item.handling >= 0 ? '+' : ''}${(item.handling * 100).toFixed(0)}%`;
    });

    // Engines
    html += this._renderCategory('ENGINE', 'engines', EQUIPMENT.engines, loadout.engine, balance, (item) => {
      return `Speed: ${Math.floor(item.topSpeed * 3.6)}km/h | Climb: ${item.climbRate}m/s${item.afterburner ? ' | AB: +' + (item.abBoost * 100) + '%' : ''}`;
    });

    // Guns
    html += this._renderCategory('GUN', 'guns', EQUIPMENT.guns, loadout.gun, balance, (item) => {
      return `${item.caliber} | ROF: ${item.rof}/min | Dmg: ${item.dmg} | Range: ${item.range}m`;
    });

    // Ordnance Slot 1
    html += this._renderOrdnanceSlot('ORDNANCE SLOT 1', 'slot1', loadout.slot1, balance);

    // Ordnance Slot 2
    html += this._renderOrdnanceSlot('ORDNANCE SLOT 2', 'slot2', loadout.slot2, balance);

    // Countermeasures
    html += this._renderCategory('COUNTERMEASURES', 'countermeasures', EQUIPMENT.countermeasures, loadout.countermeasures, balance, (item) => {
      if (item.type === 'none') return 'No countermeasures';
      return `Type: ${item.type} | Charges: ${typeof item.charges === 'object' ? 'FL:' + item.charges.flare + ' CH:' + item.charges.chaff : item.charges}`;
    });

    container.innerHTML = html;
    this._bindEvents();

    // Update wallet display
    const walletDisplay = document.getElementById('hangar-wallet-display');
    if (walletDisplay) walletDisplay.textContent = PHLYMath.formatCurrency(balance);

    // Back button
    const backBtn = document.getElementById('hangar-back');
    if (backBtn) {
      backBtn.onclick = () => MenuSystem.hideHangar();
    }
  },

  _renderCategory(title, category, items, equippedId, balance, statsFn) {
    let html = `<div class="hangar-section"><h3>${title}</h3><div class="hangar-grid">`;
    for (const item of items) {
      const isEquipped = item.id === equippedId;
      const isOwned = Economy.ownedItems.has(item.id);
      const canAfford = balance >= item.cost;
      const locked = !isOwned && !canAfford;

      html += `<div class="hangar-item ${isEquipped ? 'equipped' : ''} ${locked ? 'locked' : ''}"
        data-category="${category}" data-id="${item.id}" data-action="${isOwned ? 'equip' : 'buy'}">
        <div class="item-name">${item.name}</div>
        <div class="item-stats">${statsFn(item)}</div>
        <div class="item-cost ${isOwned ? 'owned' : ''}">
          ${isEquipped ? '✓ EQUIPPED' : isOwned ? 'OWNED - Click to equip' : PHLYMath.formatCurrency(item.cost)}
        </div>
      </div>`;
    }
    html += '</div></div>';
    return html;
  },

  _renderOrdnanceSlot(title, slotKey, equippedId, balance) {
    let html = `<div class="hangar-section"><h3>${title}</h3><div class="hangar-grid">`;

    // Empty option
    html += `<div class="hangar-item ${!equippedId ? 'equipped' : ''}"
      data-category="ordnance_slot" data-slot="${slotKey}" data-id="none" data-action="equip">
      <div class="item-name">Empty</div>
      <div class="item-stats">No ordnance</div>
      <div class="item-cost owned">${!equippedId ? '✓ EQUIPPED' : 'Click to unequip'}</div>
    </div>`;

    for (const item of EQUIPMENT.ordnance) {
      const isEquipped = item.id === equippedId;
      const isOwned = Economy.ownedItems.has(item.id);
      const totalCost = item.perUnit ? item.cost * item.qty : item.cost;
      const canAfford = balance >= totalCost;
      const locked = !isOwned && !canAfford;

      html += `<div class="hangar-item ${isEquipped ? 'equipped' : ''} ${locked ? 'locked' : ''}"
        data-category="ordnance_slot" data-slot="${slotKey}" data-id="${item.id}" data-action="${isOwned ? 'equip' : 'buy'}">
        <div class="item-name">${item.name}</div>
        <div class="item-stats">Type: ${item.type} | Qty: ${item.qty} | Dmg: ${item.dmg} | Blast: ${item.blastR}m<br>Handling: ${(item.handling * 100).toFixed(0)}%</div>
        <div class="item-cost ${isOwned ? 'owned' : ''}">
          ${isEquipped ? '✓ EQUIPPED' : isOwned ? 'OWNED - Click to equip' : PHLYMath.formatCurrency(totalCost)}
        </div>
      </div>`;
    }
    html += '</div></div>';
    return html;
  },

  _bindEvents() {
    const items = document.querySelectorAll('.hangar-item');
    items.forEach(item => {
      item.addEventListener('click', () => {
        const category = item.dataset.category;
        const id = item.dataset.id;
        const action = item.dataset.action;

        if (category === 'ordnance_slot') {
          const slot = item.dataset.slot;
          if (id === 'none') {
            Economy.equipItem(slot, null);
          } else if (Economy.ownedItems.has(id)) {
            Economy.equipItem(slot, id);
          } else {
            const result = Economy.purchaseItem('ordnance', id);
            if (result.success) {
              Economy.equipItem(slot, id);
              if (window.MissionSystem) MissionSystem.trackSpending(result.cost);
            } else {
              console.log(`[PHLY][Hangar] Purchase failed: ${result.reason}`);
            }
          }
        } else if (action === 'equip') {
          // Map category to loadout slot
          const slotMap = {
            fuselages: 'fuselage',
            wings: 'wings',
            engines: 'engine',
            guns: 'gun',
            countermeasures: 'countermeasures',
          };
          const slot = slotMap[category];
          if (slot) Economy.equipItem(slot, id);
        } else if (action === 'buy') {
          const result = Economy.purchaseItem(category, id);
          if (result.success) {
            const slotMap = {
              fuselages: 'fuselage',
              wings: 'wings',
              engines: 'engine',
              guns: 'gun',
              countermeasures: 'countermeasures',
            };
            const slot = slotMap[category];
            if (slot) Economy.equipItem(slot, id);
            if (window.MissionSystem) MissionSystem.trackSpending(result.cost);
          } else {
            console.log(`[PHLY][Hangar] Purchase failed: ${result.reason}`);
          }
        }

        this.render(); // Re-render
      });
    });
  },
};

window.HangarUI = HangarUI;
console.log('[PHLY] Hangar UI loaded');
