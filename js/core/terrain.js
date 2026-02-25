// Terrain chunk system for PHLY
const TerrainSystem = {
  noise: null,
  chunks: new Map(),
  chunkHeightCache: new Map(),
  treeInstances: null,
  waterMeshes: new Map(),
  scene: null,
  worldSeed: 42,
  activeRing: 3,
  playerChunkX: 0,
  playerChunkZ: 0,
  treeMeshConifer: null,
  treeMeshBroadleaf: null,

  init(scene, seed) {
    this.scene = scene;
    this.worldSeed = seed || LOBBY_DEFAULTS.worldSeed;
    this.noise = new SimplexNoise(this.worldSeed);
    this.activeRing = RENDER_DISTANCES[GAME_SETTINGS.graphics] || 3;
    this._createTreeTemplates();
    console.log('[PHLY][Terrain] Initialized with seed:', this.worldSeed, 'ring:', this.activeRing);
  },

  _createTreeTemplates() {
    // Conifer: trunk + 3 stacked cones
    const trunkGeo = new THREE.CylinderGeometry(0.3, 0.4, 4, 5);
    trunkGeo.translate(0, 2, 0);
    const cone1 = new THREE.ConeGeometry(3, 5, 6);
    cone1.translate(0, 7, 0);
    const cone2 = new THREE.ConeGeometry(2.2, 4, 6);
    cone2.translate(0, 10, 0);
    const cone3 = new THREE.ConeGeometry(1.4, 3, 6);
    cone3.translate(0, 12.5, 0);

    // Merge conifer
    const coniferParts = [trunkGeo, cone1, cone2, cone3];
    this.coniferGeo = THREE.BufferGeometryUtils
      ? THREE.BufferGeometryUtils.mergeGeometries(coniferParts)
      : this._mergeGeos(coniferParts);

    // Broadleaf: trunk + sphere
    const bTrunk = new THREE.CylinderGeometry(0.35, 0.5, 5, 5);
    bTrunk.translate(0, 2.5, 0);
    const canopy = new THREE.SphereGeometry(3.5, 6, 5);
    canopy.scale(1, 0.7, 1);
    canopy.translate(0, 7.5, 0);

    const broadleafParts = [bTrunk, canopy];
    this.broadleafGeo = THREE.BufferGeometryUtils
      ? THREE.BufferGeometryUtils.mergeGeometries(broadleafParts)
      : this._mergeGeos(broadleafParts);
  },

  _mergeGeos(geos) {
    // Simple geometry merger fallback
    let totalVerts = 0, totalIdx = 0;
    for (const g of geos) {
      totalVerts += g.attributes.position.count;
      if (g.index) totalIdx += g.index.count;
    }
    const positions = new Float32Array(totalVerts * 3);
    const normals = new Float32Array(totalVerts * 3);
    const indices = [];
    let vOff = 0, iOff = 0;
    for (const g of geos) {
      const pos = g.attributes.position.array;
      const norm = g.attributes.normal ? g.attributes.normal.array : new Float32Array(pos.length);
      positions.set(pos, vOff * 3);
      normals.set(norm, vOff * 3);
      if (g.index) {
        const idx = g.index.array;
        for (let i = 0; i < idx.length; i++) indices.push(idx[i] + vOff);
      }
      vOff += g.attributes.position.count;
    }
    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    if (indices.length > 0) merged.setIndex(indices);
    merged.computeVertexNormals();
    return merged;
  },

  getTerrainHeight(x, z) {
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const key = `${cx},${cz}`;
    const buf = this.chunkHeightCache.get(key);
    if (!buf) return this._fbmHeight(x, z);
    const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const gx = lx / CELL_SIZE;
    const gz = lz / CELL_SIZE;
    const i0 = Math.floor(gx), i1 = Math.min(i0 + 1, CHUNK_GRID - 1);
    const j0 = Math.floor(gz), j1 = Math.min(j0 + 1, CHUNK_GRID - 1);
    const tx = gx - i0, tz = gz - j0;
    const h00 = buf[j0 * CHUNK_GRID + i0], h10 = buf[j0 * CHUNK_GRID + i1];
    const h01 = buf[j1 * CHUNK_GRID + i0], h11 = buf[j1 * CHUNK_GRID + i1];
    return h00 * (1 - tx) * (1 - tz) + h10 * tx * (1 - tz) + h01 * (1 - tx) * tz + h11 * tx * tz;
  },

  getTerrainNormal(x, z, delta) {
    delta = delta || 4;
    const hL = this.getTerrainHeight(x - delta, z);
    const hR = this.getTerrainHeight(x + delta, z);
    const hD = this.getTerrainHeight(x, z - delta);
    const hU = this.getTerrainHeight(x, z + delta);
    const normal = new THREE.Vector3(hL - hR, 2 * delta, hD - hU);
    normal.normalize();
    return normal;
  },

  getSlopeAt(x, z) {
    const n = this.getTerrainNormal(x, z);
    return Math.acos(PHLYMath.clamp(n.y, 0, 1)) * 180 / Math.PI;
  },

  _fbmHeight(x, z) {
    const scale = 0.0008;
    let h = this.noise.fbm(x * scale, z * scale, 4, 2.0, 0.5);
    // Map -1..1 to terrain heights
    h = (h + 1) * 0.5; // 0..1
    // Base height mapping: low plains with occasional mountains
    if (h < 0.35) return h * 80 / 0.35; // 0-80m plains/beach
    if (h < 0.55) return 80 + (h - 0.35) * 320 / 0.2; // 80-400m grassland
    if (h < 0.75) return 400 + (h - 0.55) * 800 / 0.2; // 400-1200m highland
    if (h < 0.9) return 1200 + (h - 0.75) * 1000 / 0.15; // 1200-2200m mountain
    return 2200 + (h - 0.9) * 1800 / 0.1; // 2200-4000m peaks

  },

  _generateChunkHeights(cx, cz) {
    const heights = new Float32Array(CHUNK_GRID * CHUNK_GRID);
    const worldX = cx * CHUNK_SIZE;
    const worldZ = cz * CHUNK_SIZE;
    for (let j = 0; j < CHUNK_GRID; j++) {
      for (let i = 0; i < CHUNK_GRID; i++) {
        const x = worldX + i * CELL_SIZE;
        const z = worldZ + j * CELL_SIZE;
        heights[j * CHUNK_GRID + i] = this._fbmHeight(x, z);
      }
    }
    return heights;
  },

  _createChunkMesh(cx, cz, heights) {
    const geo = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, CHUNK_GRID - 1, CHUNK_GRID - 1);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position.array;
    const colors = new Float32Array(pos.length);

    for (let j = 0; j < CHUNK_GRID; j++) {
      for (let i = 0; i < CHUNK_GRID; i++) {
        const idx = j * CHUNK_GRID + i;
        const vidx = idx * 3;
        const h = heights[idx];
        pos[vidx + 1] = h;

        // Height-based coloring
        let r, g, b;
        if (h <= 0) { r = 0.04; g = 0.24; b = 0.38; }
        else if (h < 80) {
          const t = h / 80;
          r = PHLYMath.lerp(0.78, 0.49, t);
          g = PHLYMath.lerp(0.71, 0.78, t);
          b = PHLYMath.lerp(0.37, 0.31, t);
        } else if (h < 400) {
          r = 0.23; g = 0.49; b = 0.27;
        } else if (h < 1200) {
          const t = (h - 400) / 800;
          r = PHLYMath.lerp(0.23, 0.35, t);
          g = PHLYMath.lerp(0.49, 0.40, t);
          b = PHLYMath.lerp(0.27, 0.20, t);
        } else if (h < 2200) {
          r = 0.54; g = 0.54; b = 0.54;
        } else {
          const t = PHLYMath.clamp((h - 2200) / 800, 0, 1);
          r = PHLYMath.lerp(0.54, 0.92, t);
          g = PHLYMath.lerp(0.54, 0.92, t);
          b = PHLYMath.lerp(0.54, 0.92, t);
        }
        colors[vidx] = r;
        colors[vidx + 1] = g;
        colors[vidx + 2] = b;
      }
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    geo.attributes.position.needsUpdate = true;

    // Apply slope-based coloring
    const normals = geo.attributes.normal.array;
    for (let i = 0; i < CHUNK_GRID * CHUNK_GRID; i++) {
      const ny = normals[i * 3 + 1];
      const slope = Math.acos(PHLYMath.clamp(ny, 0, 1)) * 180 / Math.PI;
      if (slope > 35) {
        colors[i * 3] = 0.54;
        colors[i * 3 + 1] = 0.54;
        colors[i * 3 + 2] = 0.54;
      } else if (slope > 25) {
        const t = (slope - 25) / 10;
        colors[i * 3] = PHLYMath.lerp(colors[i * 3], 0.54, t);
        colors[i * 3 + 1] = PHLYMath.lerp(colors[i * 3 + 1], 0.54, t);
        colors[i * 3 + 2] = PHLYMath.lerp(colors[i * 3 + 2], 0.54, t);
      }
      // AO: darken concave areas
      const h = heights[i];
      let avgH = 0, count = 0;
      const row = Math.floor(i / CHUNK_GRID), col = i % CHUNK_GRID;
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          if (di === 0 && dj === 0) continue;
          const ni = col + di, nj = row + dj;
          if (ni >= 0 && ni < CHUNK_GRID && nj >= 0 && nj < CHUNK_GRID) {
            avgH += heights[nj * CHUNK_GRID + ni];
            count++;
          }
        }
      }
      if (count > 0) {
        avgH /= count;
        if (h < avgH) {
          const ao = PHLYMath.clamp((avgH - h) / 30, 0, 0.3);
          colors[i * 3] *= (1 - ao);
          colors[i * 3 + 1] *= (1 - ao);
          colors[i * 3 + 2] *= (1 - ao);
        }
      }
    }
    geo.attributes.color.needsUpdate = true;

    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(cx * CHUNK_SIZE + CHUNK_SIZE / 2, 0, cz * CHUNK_SIZE + CHUNK_SIZE / 2);
    mesh.receiveShadow = true;
    return mesh;
  },

  _createWaterMesh(cx, cz) {
    const geo = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, 32, 32);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uDeepColor: { value: new THREE.Color(0x0A3D62) },
        uShallowColor: { value: new THREE.Color(0x1A6D92) },
      },
      vertexShader: `
        uniform float uTime;
        varying vec2 vUv;
        varying vec3 vWorldPos;
        void main() {
          vUv = uv;
          vec3 pos = position;
          pos.y += sin(pos.x * 0.04 + uTime * 1.2) * 0.8 + sin(pos.z * 0.09 + uTime * 0.7) * 0.4;
          vWorldPos = (modelMatrix * vec4(pos, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uDeepColor;
        uniform vec3 uShallowColor;
        uniform float uTime;
        varying vec2 vUv;
        varying vec3 vWorldPos;
        void main() {
          float ripple = sin(vUv.x * 40.0 + uTime * 2.0) * sin(vUv.y * 40.0 + uTime * 1.5) * 0.5 + 0.5;
          vec3 col = mix(uDeepColor, uShallowColor, ripple * 0.3);
          float fresnel = pow(1.0 - abs(dot(normalize(cameraPosition - vWorldPos), vec3(0,1,0))), 3.0);
          col = mix(col, vec3(0.6, 0.8, 1.0), fresnel * 0.4);
          gl_FragColor = vec4(col, 0.85);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(cx * CHUNK_SIZE + CHUNK_SIZE / 2, -0.5, cz * CHUNK_SIZE + CHUNK_SIZE / 2);
    return mesh;
  },

  _spawnTrees(cx, cz, heights) {
    const key = `${cx},${cz}`;
    const density = Math.floor(GAME_SETTINGS.treeDensity * 500);
    if (density <= 0) return;

    // Seeded random for deterministic tree placement
    let seed = (cx * 73856093) ^ (cz * 19349663) ^ this.worldSeed;
    const srand = () => {
      seed = (seed * 16807 + 0) % 2147483647;
      return (seed & 0x7fffffff) / 0x7fffffff;
    };

    const matrices = [];
    const isConifer = [];

    for (let t = 0; t < density; t++) {
      const lx = srand() * CHUNK_SIZE;
      const lz = srand() * CHUNK_SIZE;
      const gi = Math.floor(lx / CELL_SIZE);
      const gj = Math.floor(lz / CELL_SIZE);
      if (gi >= CHUNK_GRID || gj >= CHUNK_GRID) continue;
      const h = heights[gj * CHUNK_GRID + gi];
      if (h < 20 || h > 1800) continue; // No trees in water or on peaks
      // Check slope
      const ni = Math.min(gi + 1, CHUNK_GRID - 1);
      const nj = Math.min(gj + 1, CHUNK_GRID - 1);
      const dh = Math.abs(heights[gj * CHUNK_GRID + ni] - h) + Math.abs(heights[nj * CHUNK_GRID + gi] - h);
      if (dh > 20) continue; // Too steep

      const worldX = cx * CHUNK_SIZE + lx;
      const worldZ = cz * CHUNK_SIZE + lz;
      const scale = 0.6 + srand() * 0.8;
      const rotY = srand() * Math.PI * 2;
      const conifer = h > 600 || srand() > 0.5;

      const m = new THREE.Matrix4();
      m.compose(
        new THREE.Vector3(worldX, h, worldZ),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY),
        new THREE.Vector3(scale, scale, scale)
      );
      matrices.push(m);
      isConifer.push(conifer);
    }

    if (matrices.length === 0) return;

    // Split into conifer and broadleaf instance meshes
    const coniferMatrices = matrices.filter((_, i) => isConifer[i]);
    const broadleafMatrices = matrices.filter((_, i) => !isConifer[i]);

    if (coniferMatrices.length > 0) {
      const cMat = new THREE.MeshLambertMaterial({ color: 0x1A5C2A });
      const cMesh = new THREE.InstancedMesh(this.coniferGeo, cMat, coniferMatrices.length);
      coniferMatrices.forEach((m, i) => cMesh.setMatrixAt(i, m));
      cMesh.instanceMatrix.needsUpdate = true;
      cMesh.castShadow = true;
      cMesh.frustumCulled = true;
      cMesh.userData.chunkKey = key;
      this.scene.add(cMesh);
      if (!this.chunks.has(key)) this.chunks.set(key, { meshes: [] });
      this.chunks.get(key).meshes.push(cMesh);
    }

    if (broadleafMatrices.length > 0) {
      const bMat = new THREE.MeshLambertMaterial({ color: 0x3D7A35 });
      const bMesh = new THREE.InstancedMesh(this.broadleafGeo, bMat, broadleafMatrices.length);
      broadleafMatrices.forEach((m, i) => bMesh.setMatrixAt(i, m));
      bMesh.instanceMatrix.needsUpdate = true;
      bMesh.castShadow = true;
      bMesh.frustumCulled = true;
      bMesh.userData.chunkKey = key;
      this.scene.add(bMesh);
      this.chunks.get(key).meshes.push(bMesh);
    }
  },

  loadChunk(cx, cz) {
    const key = `${cx},${cz}`;
    if (this.chunks.has(key)) return;

    const heights = this._generateChunkHeights(cx, cz);
    this.chunkHeightCache.set(key, heights);

    const mesh = this._createChunkMesh(cx, cz, heights);
    this.scene.add(mesh);

    // Water for chunks with low terrain
    let hasWater = false;
    for (let i = 0; i < heights.length; i += 16) {
      if (heights[i] <= 2) { hasWater = true; break; }
    }

    const chunkData = { meshes: [mesh], heights };
    this.chunks.set(key, chunkData);

    if (hasWater) {
      const water = this._createWaterMesh(cx, cz);
      this.scene.add(water);
      chunkData.meshes.push(water);
      this.waterMeshes.set(key, water);
    }

    // Spawn trees
    this._spawnTrees(cx, cz, heights);
  },

  unloadChunk(cx, cz) {
    const key = `${cx},${cz}`;
    const chunk = this.chunks.get(key);
    if (!chunk) return;
    for (const mesh of chunk.meshes) {
      this.scene.remove(mesh);
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) {
        if (Array.isArray(mesh.material)) mesh.material.forEach(m => m.dispose());
        else mesh.material.dispose();
      }
    }
    this.chunks.delete(key);
    this.chunkHeightCache.delete(key);
    this.waterMeshes.delete(key);
  },

  update(playerPos, time) {
    const pcx = Math.floor(playerPos.x / CHUNK_SIZE);
    const pcz = Math.floor(playerPos.z / CHUNK_SIZE);

    if (pcx !== this.playerChunkX || pcz !== this.playerChunkZ) {
      this.playerChunkX = pcx;
      this.playerChunkZ = pcz;

      // Determine needed chunks
      const needed = new Set();
      for (let dz = -this.activeRing; dz <= this.activeRing; dz++) {
        for (let dx = -this.activeRing; dx <= this.activeRing; dx++) {
          needed.add(`${pcx + dx},${pcz + dz}`);
        }
      }

      // Unload distant chunks
      for (const [key] of this.chunks) {
        if (!needed.has(key)) {
          const [cx, cz] = key.split(',').map(Number);
          this.unloadChunk(cx, cz);
        }
      }

      // Load new chunks
      for (const key of needed) {
        if (!this.chunks.has(key)) {
          const [cx, cz] = key.split(',').map(Number);
          this.loadChunk(cx, cz);
        }
      }
    }

    // Update water shader time
    for (const [, water] of this.waterMeshes) {
      if (water.material.uniforms) {
        water.material.uniforms.uTime.value = time;
      }
    }
  },

  // Find landing zones within radius
  findLandingZones(pos, radius) {
    const zones = [];
    const step = 200;
    for (let dx = -radius; dx < radius; dx += step) {
      for (let dz = -radius; dz < radius; dz += step) {
        const x = pos.x + dx;
        const z = pos.z + dz;
        if (Math.sqrt(dx * dx + dz * dz) > radius) continue;
        const slope = this.getSlopeAt(x, z);
        if (slope < 5) {
          const h = this.getTerrainHeight(x, z);
          if (h > 5) { // Not underwater
            zones.push({ x, z, h, slope });
          }
        }
      }
    }
    return zones;
  },
};

window.TerrainSystem = TerrainSystem;
console.log('[PHLY] Terrain module loaded');
