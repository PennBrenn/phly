import * as THREE from 'three';
import {
  TERRAIN_SIZE, TERRAIN_SEGMENTS,
  sampleHeightRaw, isRiverRaw, sampleForestRaw, sampleFieldVarRaw,
} from '@/utils/terrain';

// ─── Biome palette ───────────────────────────────────────────────────────────
const C_ABYSS       = new THREE.Color(0x040d18);
const C_DEEP_OCEAN  = new THREE.Color(0x071f38);
const C_OCEAN       = new THREE.Color(0x0e4060);
const C_SHALLOW     = new THREE.Color(0x1a7090);
const C_SAND        = new THREE.Color(0xd4c090);
const C_GRASS       = new THREE.Color(0x5da040);
const C_WHEAT       = new THREE.Color(0xb8a842);
const C_FOREST      = new THREE.Color(0x2a6028);
const C_SCRUB       = new THREE.Color(0x7a7a50);
const C_ROCK        = new THREE.Color(0x7a7068);
const C_MOUNTAIN    = new THREE.Color(0x9a9490);
const C_SNOW        = new THREE.Color(0xe8e8f0);

function clamp01(v: number): number { return Math.max(0, Math.min(1, v)); }

export function createScene(): THREE.Scene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x88cce8);
  scene.fog = new THREE.FogExp2(0x88cce8, 0.000022);
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

export function createTerrain(scene: THREE.Scene): THREE.Mesh {
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
      tmp.copy(C_ABYSS);
    } else if (h < -200) {
      tmp.lerpColors(C_ABYSS, C_DEEP_OCEAN, clamp01((h + 600) / 400));
    } else if (h < -20) {
      tmp.lerpColors(C_DEEP_OCEAN, C_OCEAN, clamp01((h + 200) / 180));
    } else if (h < 5) {
      tmp.lerpColors(C_OCEAN, C_SHALLOW, clamp01((h + 20) / 25));
    } else if (h < 50) {
      // Beach / sand blending into grass (wide band)
      tmp.lerpColors(C_SAND, C_GRASS, clamp01((h - 5) / 45));
    } else if (h < 400) {
      // Lowlands — very soft blend between grass, forest, wheat
      const forestBlend = clamp01((fd - 0.4) * 2);
      const wheatBlend = clamp01((fv - 0.45) * 2);
      tmp.copy(C_GRASS);
      if (forestBlend > wheatBlend) {
        tmp.lerp(C_FOREST, forestBlend * 0.8);
      } else if (wheatBlend > 0.05) {
        tmp.lerp(C_WHEAT, wheatBlend * 0.5);
      }
    } else if (h < 900) {
      // Uplands — green fading smoothly to scrub (500-unit band)
      const t = clamp01((h - 400) / 500);
      const base = new THREE.Color().copy(C_GRASS).lerp(C_FOREST, clamp01(fd * 0.6));
      tmp.lerpColors(base, C_SCRUB, t);
    } else if (h < 1500) {
      // Mountain rock (600-unit band)
      const t = clamp01((h - 900) / 600);
      tmp.lerpColors(C_SCRUB, C_ROCK, t);
    } else if (h < 1900) {
      // High mountain
      const t = clamp01((h - 1500) / 400);
      tmp.lerpColors(C_ROCK, C_MOUNTAIN, t);
    } else {
      // Snow-capped peaks (wide 400-unit fade)
      const t = clamp01((h - 1900) / 400);
      tmp.lerpColors(C_MOUNTAIN, C_SNOW, t);
    }

    // River override (gentle water blend)
    if (river && h < 20 && h >= -20) {
      const waterBlend = clamp01(1 - h / 20);
      tmp.lerp(C_SHALLOW, waterBlend * 0.8);
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
