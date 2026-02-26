import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export class PostProcessing {
  private composer: EffectComposer;
  private bloomPass: UnrealBloomPass;
  private bloomEnabled = true;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
  ) {
    // Use ACESFilmic on renderer — OutputPass will apply tone mapping + color space
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Build render target with HalfFloat precision for correct HDR bloom
    const rt = new THREE.WebGLRenderTarget(
      window.innerWidth,
      window.innerHeight,
      { type: THREE.HalfFloatType },
    );
    rt.texture.colorSpace = THREE.LinearSRGBColorSpace;

    this.composer = new EffectComposer(renderer, rt);

    this.composer.addPass(new RenderPass(scene, camera));

    // Subtle bloom
    const resolution = new THREE.Vector2(window.innerWidth, window.innerHeight);
    this.bloomPass = new UnrealBloomPass(resolution, 0.2, 0.4, 0.85);
    this.composer.addPass(this.bloomPass);

    // OutputPass handles tone mapping + sRGB conversion at the end of the chain
    this.composer.addPass(new OutputPass());
  }

  setBloomEnabled(enabled: boolean): void {
    this.bloomEnabled = enabled;
    this.bloomPass.enabled = enabled;
  }

  isBloomEnabled(): boolean {
    return this.bloomEnabled;
  }

  resize(width: number, height: number, pixelRatio: number): void {
    this.composer.setSize(width, height);
    this.composer.setPixelRatio(pixelRatio);
  }

  render(): void {
    this.composer.render();
  }
}
