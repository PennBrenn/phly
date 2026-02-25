// Procedural Aircraft Builder for PHLY
const AircraftBuilder = {
  build(loadout, color, isEnemy) {
    color = color || '#7a7a7a';
    const group = new THREE.Group();
    const fuselageData = EQUIPMENT.fuselages.find(f => f.id === loadout.fuselage) || EQUIPMENT.fuselages[0];
    const wingData = EQUIPMENT.wings.find(w => w.id === loadout.wings) || EQUIPMENT.wings[0];
    const engineData = EQUIPMENT.engines.find(e => e.id === loadout.engine) || EQUIPMENT.engines[0];

    const baseColor = new THREE.Color(isEnemy ? '#aa2222' : color);
    const darkColor = new THREE.Color(baseColor).multiplyScalar(0.6);
    const accentColor = new THREE.Color(isEnemy ? '#ff4444' : '#4a9eff');

    // === FUSELAGE ===
    const fuselageLength = 10 + fuselageData.hp / 200;
    const fuselageWidth = 1.2 + fuselageData.slots * 0.15;
    const fuselageHeight = 1.0 + fuselageData.hp / 800;
    const fuselageGeo = new THREE.BoxGeometry(fuselageWidth, fuselageHeight, fuselageLength, 4, 2, 8);
    // Taper nose and tail
    const fPos = fuselageGeo.attributes.position;
    for (let i = 0; i < fPos.count; i++) {
      const z = fPos.getZ(i);
      const normalizedZ = (z / (fuselageLength / 2)); // -1 to 1
      let taper = 1.0;
      if (normalizedZ > 0.3) {
        taper = 1.0 - PHLYMath.smoothstep(0.3, 1.0, normalizedZ) * 0.7; // Nose taper
      } else if (normalizedZ < -0.5) {
        taper = 1.0 - PHLYMath.smoothstep(-0.5, -1.0, normalizedZ) * 0.4; // Tail taper
      }
      fPos.setX(i, fPos.getX(i) * taper);
      fPos.setY(i, fPos.getY(i) * taper);
    }
    fPos.needsUpdate = true;
    fuselageGeo.computeVertexNormals();
    const fuselageMat = new THREE.MeshPhongMaterial({ color: baseColor, flatShading: false });
    const fuselageMesh = new THREE.Mesh(fuselageGeo, fuselageMat);
    group.add(fuselageMesh);

    // Nose stripe marking
    const stripeGeo = new THREE.BoxGeometry(fuselageWidth * 1.01, fuselageHeight * 1.01, 0.3);
    const stripeMat = new THREE.MeshPhongMaterial({ color: accentColor });
    const stripe = new THREE.Mesh(stripeGeo, stripeMat);
    stripe.position.z = fuselageLength * 0.35;
    group.add(stripe);

    // === COCKPIT CANOPY ===
    const canopyGeo = new THREE.SphereGeometry(0.6, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    const canopyMat = new THREE.MeshPhongMaterial({
      color: 0x88bbff, transparent: true, opacity: 0.4,
      shininess: 100, specular: 0xaaddff, side: THREE.DoubleSide,
    });
    const canopy = new THREE.Mesh(canopyGeo, canopyMat);
    canopy.position.set(0, fuselageHeight / 2 + 0.1, fuselageLength * 0.15);
    canopy.scale.set(1, 0.6, 1.5);
    group.add(canopy);

    // === WINGS ===
    const wingSpan = wingData.span;
    const wingChord = 2.5 * (1 - wingData.taper * 0.3);
    const wingThickness = 0.15;
    const sweepRad = PHLYMath.degToRad(wingData.sweep);
    const dihedralRad = PHLYMath.degToRad(wingData.dihedral);

    for (let side = -1; side <= 1; side += 2) {
      const wingGeo = new THREE.BoxGeometry(wingSpan / 2, wingThickness, wingChord, 8, 1, 4);
      const wPos = wingGeo.attributes.position;
      for (let i = 0; i < wPos.count; i++) {
        const x = wPos.getX(i);
        const normalizedX = x / (wingSpan / 4);
        // Taper
        const taperScale = 1.0 - Math.abs(normalizedX) * wingData.taper * 0.5;
        wPos.setZ(i, wPos.getZ(i) * taperScale);
        // Sweep
        wPos.setZ(i, wPos.getZ(i) - Math.abs(normalizedX) * Math.tan(sweepRad) * 0.5);
        // Dihedral
        wPos.setY(i, wPos.getY(i) + Math.abs(normalizedX) * Math.sin(dihedralRad) * 2);
      }
      wPos.needsUpdate = true;
      wingGeo.computeVertexNormals();
      const wingMat = new THREE.MeshPhongMaterial({ color: baseColor });
      const wing = new THREE.Mesh(wingGeo, wingMat);
      wing.position.set(side * wingSpan / 4, 0, -fuselageLength * 0.05);
      group.add(wing);

      // Wing tip color
      const tipGeo = new THREE.BoxGeometry(0.3, wingThickness * 1.5, wingChord * 0.3);
      const tipMat = new THREE.MeshPhongMaterial({ color: accentColor });
      const tip = new THREE.Mesh(tipGeo, tipMat);
      tip.position.set(side * wingSpan / 2 * 0.95, wingData.dihedral * 0.05, -fuselageLength * 0.05);
      group.add(tip);

      // Aileron
      const aileronGeo = new THREE.BoxGeometry(wingSpan * 0.15, 0.08, 0.6);
      const aileronMat = new THREE.MeshPhongMaterial({ color: darkColor });
      const aileron = new THREE.Mesh(aileronGeo, aileronMat);
      aileron.position.set(side * wingSpan * 0.35, 0, -fuselageLength * 0.05 - wingChord * 0.35);
      aileron.userData.isAileron = true;
      aileron.userData.side = side;
      group.add(aileron);
    }

    // === TAIL ===
    // Vertical stabilizer
    const vStabGeo = new THREE.BoxGeometry(0.12, 2.5, 2);
    const vStabMat = new THREE.MeshPhongMaterial({ color: baseColor });
    const vStab = new THREE.Mesh(vStabGeo, vStabMat);
    vStab.position.set(0, 1.5, -fuselageLength * 0.42);
    group.add(vStab);

    // Tail flash
    const tailFlashGeo = new THREE.BoxGeometry(0.13, 1.2, 0.4);
    const tailFlashMat = new THREE.MeshPhongMaterial({ color: accentColor });
    const tailFlash = new THREE.Mesh(tailFlashGeo, tailFlashMat);
    tailFlash.position.set(0, 2.0, -fuselageLength * 0.42);
    group.add(tailFlash);

    // Horizontal stabilizers
    for (let side = -1; side <= 1; side += 2) {
      const hStabGeo = new THREE.BoxGeometry(2.5, 0.1, 1.5);
      const hStabMat = new THREE.MeshPhongMaterial({ color: baseColor });
      const hStab = new THREE.Mesh(hStabGeo, hStabMat);
      hStab.position.set(side * 1.5, 0.2, -fuselageLength * 0.42);
      group.add(hStab);
    }

    // === CANARD (if canard wings) ===
    if (wingData.id === 'canard') {
      for (let side = -1; side <= 1; side += 2) {
        const canardGeo = new THREE.BoxGeometry(1.8, 0.08, 0.8);
        const canardMat = new THREE.MeshPhongMaterial({ color: baseColor });
        const canardWing = new THREE.Mesh(canardGeo, canardMat);
        canardWing.position.set(side * 1.2, 0.1, fuselageLength * 0.25);
        group.add(canardWing);
      }
    }

    // === ENGINE NOZZLE ===
    const nozzleGeo = new THREE.CylinderGeometry(0.5, 0.65, 1.5, 8, 1, true);
    const nozzleMat = new THREE.MeshPhongMaterial({ color: 0x333333, side: THREE.DoubleSide });
    const nozzle = new THREE.Mesh(nozzleGeo, nozzleMat);
    nozzle.rotation.x = Math.PI / 2;
    nozzle.position.set(0, 0, -fuselageLength / 2 - 0.3);
    group.add(nozzle);

    // Engine glow light
    const engineLight = new THREE.PointLight(0xff6600, 0.5, 15);
    engineLight.position.set(0, 0, -fuselageLength / 2 - 1);
    group.add(engineLight);
    group.userData.engineLight = engineLight;
    group.userData.nozzlePos = new THREE.Vector3(0, 0, -fuselageLength / 2 - 1);

    // === GUN MUZZLE POSITION ===
    group.userData.muzzlePos = new THREE.Vector3(0, -0.3, fuselageLength / 2 + 0.5);
    group.userData.fuselageLength = fuselageLength;

    // === ORDNANCE HARDPOINTS ===
    group.userData.hardpoints = [
      new THREE.Vector3(-wingSpan * 0.25, -0.5, 0),
      new THREE.Vector3(wingSpan * 0.25, -0.5, 0),
    ];
    if (fuselageData.slots >= 3) {
      group.userData.hardpoints.push(new THREE.Vector3(0, -0.7, -1));
    }

    // Add visible ordnance pylons
    if (loadout.slot1 || loadout.slot2) {
      const slots = [loadout.slot1, loadout.slot2];
      slots.forEach((slotId, idx) => {
        if (!slotId) return;
        const ord = EQUIPMENT.ordnance.find(o => o.id === slotId);
        if (!ord) return;
        const hp = group.userData.hardpoints[idx];
        // Pylon
        const pylonGeo = new THREE.BoxGeometry(0.15, 0.4, 0.8);
        const pylonMat = new THREE.MeshPhongMaterial({ color: 0x444444 });
        const pylon = new THREE.Mesh(pylonGeo, pylonMat);
        pylon.position.copy(hp).add(new THREE.Vector3(0, -0.1, 0));
        group.add(pylon);

        // Ordnance mesh
        if (ord.type === 'ir_missile' || ord.type === 'radar_missile') {
          const missileGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.8, 6);
          missileGeo.rotateX(Math.PI / 2);
          const missileMat = new THREE.MeshPhongMaterial({ color: 0xdddddd });
          const missile = new THREE.Mesh(missileGeo, missileMat);
          missile.position.copy(hp).add(new THREE.Vector3(0, -0.35, 0));
          group.add(missile);
        } else if (ord.type === 'bomb') {
          const bombGeo = new THREE.SphereGeometry(0.2, 6, 6);
          bombGeo.scale(1, 1, 2);
          const bombMat = new THREE.MeshPhongMaterial({ color: 0x444444 });
          const bomb = new THREE.Mesh(bombGeo, bombMat);
          bomb.position.copy(hp).add(new THREE.Vector3(0, -0.35, 0));
          group.add(bomb);
        }
      });
    }

    group.userData.loadout = loadout;
    group.userData.fuselageData = fuselageData;
    group.userData.wingData = wingData;
    group.userData.engineData = engineData;

    // Scale the whole aircraft
    group.scale.set(1.5, 1.5, 1.5);

    return group;
  },

  buildEnemy(tierData, color) {
    // Build a simplified enemy aircraft mesh
    const loadout = {
      fuselage: 'mk1',
      wings: 'delta',
      engine: 'j69',
      gun: tierData.weapons[0] || 'g762',
      slot1: null, slot2: null, countermeasures: 'none',
    };
    // Adjust based on tier
    if (tierData.hp > 500) loadout.fuselage = 'mk2';
    if (tierData.hp > 900) loadout.fuselage = 'mk3';
    if (tierData.speed > 280) loadout.engine = 'j85';
    if (tierData.speed > 330) loadout.engine = 'f100';
    if (tierData.weapons.includes('aim9')) loadout.slot1 = 'aim9';
    if (tierData.weapons.includes('aim120')) loadout.slot1 = 'aim120';
    return this.build(loadout, color || tierData.color, true);
  },

  // Build ground unit mesh
  buildGroundUnit(tierData) {
    const group = new THREE.Group();
    const color = new THREE.Color(tierData.color);
    const darkColor = new THREE.Color(color).multiplyScalar(0.7);
    const mat = new THREE.MeshPhongMaterial({ color, flatShading: true });
    const darkMat = new THREE.MeshPhongMaterial({ color: darkColor, flatShading: true });

    switch (tierData.id) {
      case 'jeep':
      case 'command': {
        // Body
        const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.8, 3.5), mat);
        body.position.y = 0.7;
        group.add(body);
        // Windscreen frame
        const ws = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 0.1), darkMat);
        ws.position.set(0, 1.2, 1.2);
        group.add(ws);
        // Wheels
        for (let x = -1; x <= 1; x += 2) {
          for (let z = -1; z <= 1; z += 2) {
            const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.2, 8), darkMat);
            wheel.rotation.z = Math.PI / 2;
            wheel.position.set(x * 1.0, 0.35, z * 1.2);
            group.add(wheel);
          }
        }
        // Gun mount
        const gunMount = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.8, 6), darkMat);
        gunMount.position.set(0, 1.5, 0.5);
        gunMount.rotation.x = -0.2;
        group.add(gunMount);
        // Command vehicle antenna
        if (tierData.id === 'command') {
          const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 3, 4), darkMat);
          antenna.position.set(0.5, 2.5, -0.5);
          group.add(antenna);
          const pod = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 1.0), mat);
          pod.position.set(0, 1.5, -0.8);
          group.add(pod);
        }
        break;
      }
      case 'ifv': {
        // Hull
        const hull = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.0, 5), mat);
        hull.position.y = 0.8;
        group.add(hull);
        // Turret
        const turret = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 1.5), mat);
        turret.position.set(0, 1.6, 0.5);
        group.add(turret);
        // Barrel
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.5, 6), darkMat);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 1.7, 2.2);
        group.add(barrel);
        // Track rollers
        for (let side = -1; side <= 1; side += 2) {
          for (let i = 0; i < 5; i++) {
            const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.15, 8), darkMat);
            roller.rotation.z = Math.PI / 2;
            roller.position.set(side * 1.3, 0.25, -1.5 + i * 0.8);
            group.add(roller);
          }
        }
        break;
      }
      case 'mbt': {
        // Wide low hull
        const hull = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.8, 6), mat);
        hull.position.y = 0.7;
        group.add(hull);
        // Rounded turret
        const turret = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.7, 2.0), mat);
        turret.position.set(0, 1.4, 0.2);
        group.add(turret);
        // Main gun
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 5, 8), darkMat);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 1.5, 3.0);
        group.add(barrel);
        // Bore evacuator
        const bore = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), darkMat);
        bore.position.set(0, 1.5, 2.0);
        group.add(bore);
        // Tracks
        for (let side = -1; side <= 1; side += 2) {
          for (let i = 0; i < 6; i++) {
            const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.2, 8), darkMat);
            roller.rotation.z = Math.PI / 2;
            roller.position.set(side * 1.6, 0.3, -2 + i * 0.9);
            group.add(roller);
          }
        }
        break;
      }
      case 'spaag': {
        // IFV hull base
        const hull = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.0, 5), mat);
        hull.position.y = 0.8;
        group.add(hull);
        // AA turret
        const turret = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.5, 1.0), mat);
        turret.position.set(0, 1.6, 0.3);
        group.add(turret);
        // Twin barrels
        for (let side = -1; side <= 1; side += 2) {
          const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.5, 6), darkMat);
          barrel.rotation.x = Math.PI / 2 - 0.25;
          barrel.position.set(side * 0.2, 1.8, 2.0);
          group.add(barrel);
        }
        break;
      }
      case 'sam': {
        // Truck cab
        const cab = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.2, 2.0), mat);
        cab.position.set(0, 1.0, 1.5);
        group.add(cab);
        // Flat bed
        const bed = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.3, 4.0), mat);
        bed.position.set(0, 0.5, -0.5);
        group.add(bed);
        // Launch tubes
        const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.8, 8), darkMat);
        pedestal.position.set(0, 1.0, -0.5);
        group.add(pedestal);
        for (let i = 0; i < 2; i++) {
          const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 3, 8), darkMat);
          tube.rotation.x = -Math.PI / 4;
          tube.position.set(0, 1.8 + i * 0.5, -0.5 - i * 0.5);
          group.add(tube);
        }
        // Wheels
        for (let x = -1; x <= 1; x += 2) {
          for (let z = -1; z <= 1; z += 2) {
            const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.2, 8), darkMat);
            wheel.rotation.z = Math.PI / 2;
            wheel.position.set(x * 1.1, 0.4, z * 1.5);
            group.add(wheel);
          }
        }
        break;
      }
      case 'radar': {
        // Mast
        const mast = new THREE.Mesh(new THREE.BoxGeometry(0.3, 6, 0.3), darkMat);
        mast.position.y = 3;
        group.add(mast);
        // Dish
        const dish = new THREE.Mesh(new THREE.BoxGeometry(3, 1.5, 0.1), mat);
        dish.position.set(0, 5.5, 0);
        dish.userData.isRadarDish = true;
        group.add(dish);
        // Base
        const base = new THREE.Mesh(new THREE.BoxGeometry(2, 0.5, 2), mat);
        base.position.y = 0.25;
        group.add(base);
        // Pulse light
        const light = new THREE.PointLight(0xff6600, 0.5, 30);
        light.position.set(0, 5.5, 0.5);
        group.add(light);
        group.userData.radarLight = light;
        break;
      }
      case 'howitzer': {
        // Trail legs
        for (let side = -1; side <= 1; side += 2) {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 3), darkMat);
          leg.position.set(side * 0.8, 0.1, -1.5);
          leg.rotation.y = side * 0.4;
          group.add(leg);
        }
        // Shield
        const shield = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 1.5, 8, 1, false, -Math.PI / 2, Math.PI), darkMat);
        shield.rotation.x = Math.PI / 2;
        shield.position.set(0, 0.8, 0.2);
        group.add(shield);
        // Barrel
        const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 4), darkMat);
        barrel.rotation.x = -0.5;
        barrel.position.set(0, 1.5, 2.5);
        group.add(barrel);
        group.userData.barrelMesh = barrel;
        break;
      }
      case 'truck': {
        // Cab
        const cab = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.5, 2.0), mat);
        cab.position.set(0, 1.2, 2.0);
        group.add(cab);
        // Cargo bed
        const bed = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.15, 4.0), mat);
        bed.position.set(0, 0.6, -0.5);
        group.add(bed);
        // Side planks
        for (let side = -1; side <= 1; side += 2) {
          const plank = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 4.0), mat);
          plank.position.set(side * 1.0, 1.0, -0.5);
          group.add(plank);
        }
        // Wheels
        for (let x = -1; x <= 1; x += 2) {
          for (let z = 0; z < 3; z++) {
            const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.2, 8), darkMat);
            wheel.rotation.z = Math.PI / 2;
            wheel.position.set(x * 1.1, 0.35, 1.5 - z * 1.5);
            group.add(wheel);
          }
        }
        break;
      }
      case 'boat': {
        // Hull
        const hullGeo = new THREE.BoxGeometry(2.5, 1.0, 8);
        const hPos = hullGeo.attributes.position;
        for (let i = 0; i < hPos.count; i++) {
          const z = hPos.getZ(i);
          if (z > 2) {
            const taper = 1 - (z - 2) / 6;
            hPos.setX(i, hPos.getX(i) * Math.max(0.2, taper));
          }
        }
        hPos.needsUpdate = true;
        hullGeo.computeVertexNormals();
        const hull = new THREE.Mesh(hullGeo, mat);
        hull.position.y = 0.3;
        group.add(hull);
        // Superstructure
        const superStr = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.2, 2.0), mat);
        superStr.position.set(0, 1.4, -0.5);
        group.add(superStr);
        // Funnel
        const funnel = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 1.0, 6), darkMat);
        funnel.position.set(0, 2.2, -0.5);
        group.add(funnel);
        // Turret
        const turret = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.4, 0.8), darkMat);
        turret.position.set(0, 1.4, 2.0);
        group.add(turret);
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.5, 6), darkMat);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 1.6, 3.0);
        group.add(barrel);
        break;
      }
      default: {
        // Generic box
        const box = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 3), mat);
        box.position.y = 0.5;
        group.add(box);
      }
    }

    group.userData.tierData = tierData;
    return group;
  },

  // Create wreckage mesh (blackened, flattened)
  buildWreckage(originalGroup) {
    const wreckage = new THREE.Group();
    const wreckMat = new THREE.MeshPhongMaterial({ color: 0x1a1a1a, flatShading: true });
    originalGroup.traverse(child => {
      if (child.isMesh) {
        const clone = child.clone();
        clone.material = wreckMat;
        clone.scale.y *= 0.3; // Flatten
        wreckage.add(clone);
      }
    });
    wreckage.rotation.z = PHLYMath.randRange(-0.3, 0.3);
    wreckage.rotation.x = PHLYMath.randRange(-0.2, 0.2);
    return wreckage;
  },
};

window.AircraftBuilder = AircraftBuilder;
console.log('[PHLY] Aircraft builder loaded');
