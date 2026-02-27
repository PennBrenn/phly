import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { RGBShiftShader } from 'three/examples/jsm/shaders/RGBShiftShader.js';
import { VignetteShader } from 'three/examples/jsm/shaders/VignetteShader.js';

// Custom god-ray / radial light scattering shader
const GodRayScreenShader = {
  uniforms: {
    tDiffuse: { value: null },
    uSunScreenPos: { value: new THREE.Vector2(0.5, 0.3) },
    uIntensity: { value: 0.35 },
    uDecay: { value: 0.96 },
    uDensity: { value: 0.8 },
    uWeight: { value: 0.4 },
    uSamples: { value: 40 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2 uSunScreenPos;
    uniform float uIntensity;
    uniform float uDecay;
    uniform float uDensity;
    uniform float uWeight;
    uniform int uSamples;
    varying vec2 vUv;
    void main() {
      vec2 dir = vUv - uSunScreenPos;
      float dist = length(dir);
      dir = dir / float(uSamples) * uDensity;
      vec4 color = texture2D(tDiffuse, vUv);
      vec2 sampleCoord = vUv;
      float illumination = 1.0;
      for (int i = 0; i < 40; i++) {
        sampleCoord -= dir;
        vec4 s = texture2D(tDiffuse, clamp(sampleCoord, 0.0, 1.0));
        s *= illumination * uWeight;
        color += s;
        illumination *= uDecay;
      }
      // Blend with distance falloff so rays don't dominate when looking away
      float falloff = max(0.0, 1.0 - dist * 1.2);
      gl_FragColor = color + color * uIntensity * falloff;
    }
  `,
};

export class PostProcessing {
  private composer: EffectComposer;
  private bloomPass: UnrealBloomPass;
  private fxaaPass: ShaderPass;
  private rgbShiftPass: ShaderPass;
  private vignettePass: ShaderPass;
  private godRayPass: ShaderPass;
  private bloomEnabled = true;
  private godRaysEnabled = true;
  private camera: THREE.Camera;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
  ) {
    this.camera = camera;

    // Use ACESFilmic on renderer — OutputPass will apply tone mapping + color space
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Build render target with HalfFloat precision for correct HDR bloom
    const rt = new THREE.WebGLRenderTarget(
      window.innerWidth,
      window.innerHeight,
      { type: THREE.HalfFloatType },
    );
    rt.texture.colorSpace = THREE.LinearSRGBColorSpace;

    this.composer = new EffectComposer(renderer, rt);

    // 1. Render scene
    this.composer.addPass(new RenderPass(scene, camera));

    // 2. Bloom (subtle)
    const resolution = new THREE.Vector2(window.innerWidth, window.innerHeight);
    this.bloomPass = new UnrealBloomPass(resolution, 0.25, 0.4, 0.85);
    this.composer.addPass(this.bloomPass);

    // 3. God rays (screen-space radial light scatter)
    this.godRayPass = new ShaderPass(GodRayScreenShader);
    this.godRayPass.uniforms.uIntensity.value = 0.3;
    this.composer.addPass(this.godRayPass);

    // 4. Chromatic aberration (subtle RGB shift)
    this.rgbShiftPass = new ShaderPass(RGBShiftShader);
    this.rgbShiftPass.uniforms['amount'].value = 0.0012;
    this.rgbShiftPass.uniforms['angle'].value = 0.0;
    this.composer.addPass(this.rgbShiftPass);

    // 5. Vignette
    this.vignettePass = new ShaderPass(VignetteShader);
    this.vignettePass.uniforms['offset'].value = 1.0;
    this.vignettePass.uniforms['darkness'].value = 1.1;
    this.composer.addPass(this.vignettePass);

    // 6. FXAA
    this.fxaaPass = new ShaderPass(FXAAShader);
    const pr = Math.min(window.devicePixelRatio, 2);
    this.fxaaPass.uniforms['resolution'].value.set(
      1 / (window.innerWidth * pr),
      1 / (window.innerHeight * pr),
    );
    this.composer.addPass(this.fxaaPass);

    // 7. OutputPass handles tone mapping + sRGB conversion
    this.composer.addPass(new OutputPass());
  }

  setBloomEnabled(enabled: boolean): void {
    this.bloomEnabled = enabled;
    this.bloomPass.enabled = enabled;
  }

  isBloomEnabled(): boolean {
    return this.bloomEnabled;
  }

  setGodRaysEnabled(enabled: boolean): void {
    this.godRaysEnabled = enabled;
    if (!enabled) this.godRayPass.enabled = false;
  }

  setChromaticAberrationEnabled(enabled: boolean): void {
    this.rgbShiftPass.enabled = enabled;
  }

  setVignetteEnabled(enabled: boolean): void {
    this.vignettePass.enabled = enabled;
  }

  setFXAAEnabled(enabled: boolean): void {
    this.fxaaPass.enabled = enabled;
  }

  /** Update sun screen position for god rays. Call each frame with the sun's world position. */
  updateSunPosition(sunWorldPos: THREE.Vector3): void {
    const v = sunWorldPos.clone().project(this.camera);
    // Convert from NDC (-1..1) to UV (0..1)
    const sx = v.x * 0.5 + 0.5;
    const sy = v.y * 0.5 + 0.5;
    // Only enable god rays when sun is roughly on screen AND setting is on
    const onScreen = v.z < 1 && sx > -0.3 && sx < 1.3 && sy > -0.3 && sy < 1.3;
    this.godRayPass.enabled = this.godRaysEnabled && onScreen;
    if (onScreen) {
      this.godRayPass.uniforms.uSunScreenPos.value.set(sx, sy);
    }
  }

  resize(width: number, height: number, pixelRatio: number): void {
    // Guard against 0-size framebuffers (causes WebGL errors)
    if (width < 1 || height < 1) return;
    this.composer.setSize(width, height);
    this.composer.setPixelRatio(pixelRatio);
    this.fxaaPass.uniforms['resolution'].value.set(
      1 / (width * pixelRatio),
      1 / (height * pixelRatio),
    );
  }

  render(): void {
    this.composer.render();
  }
}
