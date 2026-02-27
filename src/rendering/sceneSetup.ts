import * as THREE from 'three';
import {
  TERRAIN_SIZE, TERRAIN_SEGMENTS,
  sampleHeightRaw, isRiverRaw, sampleForestRaw, sampleFieldVarRaw, sampleMicroRaw,
} from '@/utils/terrain';

export type BiomeType = 'temperate' | 'desert' | 'arctic' | 'volcanic' | 'tropical';

interface BiomePalette {
  abyss: THREE.Color;
  deepOcean: THREE.Color;
  ocean: THREE.Color;
  shallow: THREE.Color;
  sand: THREE.Color;
  grass: THREE.Color;
  wheat: THREE.Color;
  forest: THREE.Color;
  scrub: THREE.Color;
  rock: THREE.Color;
  mountain: THREE.Color;
  snow: THREE.Color;
  sky: THREE.Color;
  fog: THREE.Color;
}

const BIOME_PALETTES: Record<BiomeType, BiomePalette> = {
  temperate: {
    abyss: new THREE.Color(0x040d18),
    deepOcean: new THREE.Color(0x071f38),
    ocean: new THREE.Color(0x0e4060),
    shallow: new THREE.Color(0x1a7090),
    sand: new THREE.Color(0xd4c090),
    grass: new THREE.Color(0x5da040),
    wheat: new THREE.Color(0xb8a842),
    forest: new THREE.Color(0x2a6028),
    scrub: new THREE.Color(0x7a7a50),
    rock: new THREE.Color(0x7a7068),
    mountain: new THREE.Color(0x9a9490),
    snow: new THREE.Color(0xe8e8f0),
    sky: new THREE.Color(0x88cce8),
    fog: new THREE.Color(0x88cce8),
  },
  desert: {
    abyss: new THREE.Color(0x0a0808),
    deepOcean: new THREE.Color(0x1a1510),
    ocean: new THREE.Color(0x3a2a18),
    shallow: new THREE.Color(0x5a4a30),
    sand: new THREE.Color(0xe8d0a0),
    grass: new THREE.Color(0xc8b080),
    wheat: new THREE.Color(0xd8c090),
    forest: new THREE.Color(0xa89060),
    scrub: new THREE.Color(0xb8a070),
    rock: new THREE.Color(0x9a8060),
    mountain: new THREE.Color(0xaa9580),
    snow: new THREE.Color(0xf0e8d0),
    sky: new THREE.Color(0xe8c898),
    fog: new THREE.Color(0xd8b888),
  },
  arctic: {
    abyss: new THREE.Color(0x081828),
    deepOcean: new THREE.Color(0x0c2838),
    ocean: new THREE.Color(0x143850),
    shallow: new THREE.Color(0x2a5870),
    sand: new THREE.Color(0xd8e8f0),
    grass: new THREE.Color(0xb8d0e0),
    wheat: new THREE.Color(0xc8dce8),
    forest: new THREE.Color(0x98b8c8),
    scrub: new THREE.Color(0xc8d8e8),
    rock: new THREE.Color(0xd0dce8),
    mountain: new THREE.Color(0xe0e8f0),
    snow: new THREE.Color(0xf8f8ff),
    sky: new THREE.Color(0xc8d8e8),
    fog: new THREE.Color(0xb8c8d8),
  },
  volcanic: {
    abyss: new THREE.Color(0x180808),
    deepOcean: new THREE.Color(0x281010),
    ocean: new THREE.Color(0x381818),
    shallow: new THREE.Color(0x582828),
    sand: new THREE.Color(0x403030),
    grass: new THREE.Color(0x504038),
    wheat: new THREE.Color(0x604840),
    forest: new THREE.Color(0x403028),
    scrub: new THREE.Color(0x605040),
    rock: new THREE.Color(0x705850),
    mountain: new THREE.Color(0x886860),
    snow: new THREE.Color(0xc89070),
    sky: new THREE.Color(0xa86848),
    fog: new THREE.Color(0x985838),
  },
  tropical: {
    abyss: new THREE.Color(0x041820),
    deepOcean: new THREE.Color(0x082838),
    ocean: new THREE.Color(0x0c4858),
    shallow: new THREE.Color(0x188878),
    sand: new THREE.Color(0xf0e8c0),
    grass: new THREE.Color(0x48c858),
    wheat: new THREE.Color(0x88d868),
    forest: new THREE.Color(0x288838),
    scrub: new THREE.Color(0x68a858),
    rock: new THREE.Color(0x787860),
    mountain: new THREE.Color(0x909080),
    snow: new THREE.Color(0xd8e8d0),
    sky: new THREE.Color(0x68d8e8),
    fog: new THREE.Color(0x58c8d8),
  },
};

function clamp01(v: number): number { return Math.max(0, Math.min(1, v)); }

export function createScene(biome: BiomeType = 'temperate'): THREE.Scene {
  const palette = BIOME_PALETTES[biome];
  const scene = new THREE.Scene();
  scene.background = palette.sky;
  scene.fog = new THREE.FogExp2(palette.fog.getHex(), 0.000022);
  return scene;
}

export function createLights(scene: THREE.Scene, shadows = true): {
  sun: THREE.DirectionalLight;
  ambient: THREE.HemisphereLight;
} {
  const sun = new THREE.DirectionalLight(0xfff0dd, 2.2);
  sun.position.set(600, 800, 400);

  if (shadows) {
    sun.castShadow = true;
    sun.shadow.mapSize.width = 4096;
    sun.shadow.mapSize.height = 4096;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 5000;
    sun.shadow.camera.left = -1200;
    sun.shadow.camera.right = 1200;
    sun.shadow.camera.top = 1200;
    sun.shadow.camera.bottom = -1200;
    sun.shadow.bias = -0.0003;
    sun.shadow.normalBias = 0.02;
  }

  scene.add(sun);
  scene.add(sun.target);

  const ambient = new THREE.HemisphereLight(0xb0d8ff, 0x4a7a2a, 0.8);
  scene.add(ambient);

  return { sun, ambient };
}

export function createTerrain(scene: THREE.Scene, biome: BiomeType = 'temperate'): THREE.Mesh {
  const palette = BIOME_PALETTES[biome];
  const geometry = new THREE.PlaneGeometry(
    TERRAIN_SIZE, TERRAIN_SIZE, TERRAIN_SEGMENTS, TERRAIN_SEGMENTS,
  );
  const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
  const count = posAttr.count;

  const colors = new Float32Array(count * 3);
  const colorAttr = new THREE.BufferAttribute(colors, 3);
  const tmp = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const px = posAttr.getX(i);
    const py = posAttr.getY(i);

    const h = sampleHeightRaw(px, py);
    posAttr.setZ(i, h);

    const river = isRiverRaw(px, py);
    const fd = sampleForestRaw(px, py);
    const fv = sampleFieldVarRaw(px, py);

    // ─── Smooth color blending by height + biome noise ─────────────────
    // All transitions use wide bands for gradual blending
    if (h < -600) {
      tmp.copy(palette.abyss);
    } else if (h < -200) {
      tmp.lerpColors(palette.abyss, palette.deepOcean, clamp01((h + 600) / 400));
    } else if (h < -20) {
      tmp.lerpColors(palette.deepOcean, palette.ocean, clamp01((h + 200) / 180));
    } else if (h < 5) {
      tmp.lerpColors(palette.ocean, palette.shallow, clamp01((h + 20) / 25));
    } else if (h < 50) {
      // Beach / sand blending into grass (wide band)
      tmp.lerpColors(palette.sand, palette.grass, clamp01((h - 5) / 45));
    } else if (h < 400) {
      // Lowlands — very soft blend between grass, forest, wheat
      const forestBlend = clamp01((fd - 0.4) * 2);
      const wheatBlend = clamp01((fv - 0.45) * 2);
      tmp.copy(palette.grass);
      if (forestBlend > wheatBlend) {
        tmp.lerp(palette.forest, forestBlend * 0.8);
      } else if (wheatBlend > 0.05) {
        tmp.lerp(palette.wheat, wheatBlend * 0.5);
      }
    } else if (h < 900) {
      // Uplands — green fading smoothly to scrub (500-unit band)
      const t = clamp01((h - 400) / 500);
      const base = new THREE.Color().copy(palette.grass).lerp(palette.forest, clamp01(fd * 0.6));
      tmp.lerpColors(base, palette.scrub, t);
    } else if (h < 1500) {
      // Mountain rock (600-unit band)
      const t = clamp01((h - 900) / 600);
      tmp.lerpColors(palette.scrub, palette.rock, t);
    } else if (h < 1900) {
      // High mountain
      const t = clamp01((h - 1500) / 400);
      tmp.lerpColors(palette.rock, palette.mountain, t);
    } else {
      // Snow-capped peaks (wide 400-unit fade)
      const t = clamp01((h - 1900) / 400);
      tmp.lerpColors(palette.mountain, palette.snow, t);
    }

    // River override (gentle water blend)
    if (river && h < 20 && h >= -20) {
      const waterBlend = clamp01(1 - h / 20);
      tmp.lerp(palette.shallow, waterBlend * 0.8);
    }

    // Micro-detail color variation: subtle brightness/hue shift per vertex
    // Only on land (above water), very gentle so it doesn't look noisy from altitude
    if (h > 5) {
      const mv = sampleMicroRaw(px, py);
      const shift = (mv - 0.5) * 0.06; // ±3% brightness variation
      tmp.r = clamp01(tmp.r + shift);
      tmp.g = clamp01(tmp.g + shift * 0.8);
      tmp.b = clamp01(tmp.b + shift * 0.5);
    }

    colors[i * 3]     = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }

  geometry.setAttribute('color', colorAttr);
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: false,
    roughness: 0.88,
    metalness: 0.0,
    envMapIntensity: 0.3,
  });

  const terrain = new THREE.Mesh(geometry, material);
  terrain.rotation.x = -Math.PI / 2;
  terrain.position.y = 0;
  terrain.receiveShadow = true;
  terrain.castShadow = true;
  scene.add(terrain);

  // ─── Water plane at sea level ──────────────────────────────────────────
  const waterGeo = new THREE.PlaneGeometry(TERRAIN_SIZE * 1.5, TERRAIN_SIZE * 1.5, 1, 1);
  const waterMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime:    { value: 0 },
      uColor:   { value: new THREE.Color(0x1070a0) },
      uOpacity: { value: 0.70 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3  uColor;
      uniform float uOpacity;
      uniform float uTime;
      varying vec2  vUv;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i),          hash(i + vec2(1,0)), u.x),
                   mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x), u.y);
      }

      void main() {
        vec2 uv = vUv * 80.0;
        float n  = noise(uv + vec2(uTime * 0.04,  uTime * 0.02));
        float n2 = noise(uv * 2.3 + vec2(-uTime * 0.03, uTime * 0.05));
        float ripple = (n * 0.6 + n2 * 0.4) * 0.08 - 0.04;
        vec3 col = uColor + ripple;
        gl_FragColor = vec4(col, uOpacity);
      }
    `,
  });
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0;
  water.renderOrder = 1;
  // Animate water ripples each frame
  water.onBeforeRender = (_, __, ___, ____, mat) => {
    if ((mat as THREE.ShaderMaterial).uniforms) {
      (mat as THREE.ShaderMaterial).uniforms.uTime.value += 0.016;
    }
  };
  scene.add(water);

  return terrain;
}
