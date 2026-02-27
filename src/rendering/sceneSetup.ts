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
  scene.fog = new THREE.FogExp2(palette.fog.getHex(), 0.000018);

  // Gradient sky dome
  const skyGeo = new THREE.SphereGeometry(25000, 32, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTopColor:    { value: new THREE.Color().copy(palette.sky).multiplyScalar(0.55) },
      uHorizonColor: { value: palette.sky.clone() },
      uBottomColor: { value: new THREE.Color().copy(palette.fog).multiplyScalar(1.1) },
      uSunColor:    { value: new THREE.Color(0xfff4e0) },
      uSunDir:      { value: new THREE.Vector3(0.4, 0.6, 0.3).normalize() },
    },
    vertexShader: `
      varying vec3 vWorldPos;
      void main() {
        vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uTopColor;
      uniform vec3 uHorizonColor;
      uniform vec3 uBottomColor;
      uniform vec3 uSunColor;
      uniform vec3 uSunDir;
      varying vec3 vWorldPos;
      void main() {
        vec3 dir = normalize(vWorldPos - cameraPosition);
        float y = dir.y;
        // Gradient: bottom → horizon → top
        vec3 col;
        if (y < 0.0) {
          col = mix(uBottomColor, uHorizonColor, clamp(y + 1.0, 0.0, 1.0));
        } else {
          float t = pow(clamp(y, 0.0, 1.0), 0.6);
          col = mix(uHorizonColor, uTopColor, t);
        }
        // Sun glow
        float sunDot = max(dot(dir, uSunDir), 0.0);
        col += uSunColor * pow(sunDot, 64.0) * 0.8;
        col += uSunColor * pow(sunDot, 8.0) * 0.15;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.renderOrder = -1;
  scene.add(sky);

  return scene;
}

export function createLights(scene: THREE.Scene, shadows = true): {
  sun: THREE.DirectionalLight;
  ambient: THREE.HemisphereLight;
} {
  const sun = new THREE.DirectionalLight(0xfff0dd, 2.2);
  sun.position.set(600, 1200, 400);

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
  const waterGeo = new THREE.PlaneGeometry(TERRAIN_SIZE * 1.5, TERRAIN_SIZE * 1.5, 128, 128);
  const waterMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime:      { value: 0 },
      uDeepColor: { value: new THREE.Color(0x061830) },
      uColor:     { value: new THREE.Color(0x1080b0) },
      uFoamColor: { value: new THREE.Color(0xc0e8ff) },
      uSkyColor:  { value: palette.sky.clone() },
      uOpacity:   { value: 0.82 },
      uSunDir:    { value: new THREE.Vector3(0.5, 0.7, 0.4).normalize() },
    },
    vertexShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      void main() {
        vUv = uv;
        vec3 pos = position;
        // Multi-octave wave displacement
        float t = uTime * 0.4;
        float wave1 = sin(pos.x * 0.008 + t) * cos(pos.y * 0.006 + t * 0.7) * 3.0;
        float wave2 = sin(pos.x * 0.02 + t * 1.3) * cos(pos.y * 0.015 - t * 0.9) * 1.2;
        float wave3 = sin(pos.x * 0.05 + t * 2.1) * sin(pos.y * 0.04 + t * 1.5) * 0.4;
        pos.z += wave1 + wave2 + wave3;
        // Approximate normal from wave derivatives
        float dx = cos(pos.x * 0.008 + t) * 0.008 * 3.0 + cos(pos.x * 0.02 + t * 1.3) * 0.02 * 1.2;
        float dy = cos(pos.y * 0.006 + t * 0.7) * 0.006 * 3.0 + cos(pos.y * 0.015 - t * 0.9) * 0.015 * 1.2;
        vNormal = normalize(vec3(-dx, -dy, 1.0));
        vWorldPos = (modelMatrix * vec4(pos, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3  uDeepColor;
      uniform vec3  uColor;
      uniform vec3  uFoamColor;
      uniform vec3  uSkyColor;
      uniform vec3  uSunDir;
      uniform float uOpacity;
      uniform float uTime;
      varying vec2  vUv;
      varying vec3  vWorldPos;
      varying vec3  vNormal;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1,0)), u.x),
                   mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x), u.y);
      }

      void main() {
        vec2 uv = vUv * 120.0;
        // Ripple noise layers
        float n1 = noise(uv + vec2(uTime * 0.06, uTime * 0.03));
        float n2 = noise(uv * 2.5 + vec2(-uTime * 0.04, uTime * 0.07));
        float n3 = noise(uv * 6.0 + vec2(uTime * 0.12, -uTime * 0.08));
        float ripple = n1 * 0.5 + n2 * 0.3 + n3 * 0.2;

        // Fresnel-like view angle effect
        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        float fresnel = pow(1.0 - max(dot(viewDir, vNormal), 0.0), 3.0);
        fresnel = clamp(fresnel, 0.15, 0.85);

        // Blend deep and surface color with ripple variation
        vec3 waterCol = mix(uDeepColor, uColor, ripple);
        // Mix sky reflection based on fresnel
        vec3 col = mix(waterCol, uSkyColor * 0.7, fresnel * 0.5);

        // Specular highlight from sun
        vec3 halfDir = normalize(uSunDir + viewDir);
        float spec = pow(max(dot(vNormal, halfDir), 0.0), 128.0);
        col += vec3(1.0, 0.95, 0.8) * spec * 0.6;

        // Foam on wave crests
        float foam = smoothstep(0.72, 0.85, ripple) * 0.3;
        col = mix(col, uFoamColor, foam);

        // Distance fade for opacity
        float dist = length(vWorldPos.xz - cameraPosition.xz);
        float distFade = clamp(dist / 15000.0, 0.0, 1.0);
        float alpha = mix(uOpacity, uOpacity * 0.5, distFade);

        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0;
  water.renderOrder = 1;
  water.onBeforeRender = (_, __, ___, ____, mat) => {
    if ((mat as THREE.ShaderMaterial).uniforms) {
      (mat as THREE.ShaderMaterial).uniforms.uTime.value += 0.016;
    }
  };
  scene.add(water);

  return terrain;
}
