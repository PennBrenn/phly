import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface ModelOffsets {
  posX: number;
  posY: number;
  posZ: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  scale: number;
}

const DEFAULT_OFFSETS: ModelOffsets = {
  posX: 0, posY: 0, posZ: 0,
  rotX: 0, rotY: 0, rotZ: 0,
  scale: 1,
};

export class ModelLoader {
  private loader: GLTFLoader;

  constructor(manager?: THREE.LoadingManager) {
    this.loader = new GLTFLoader(manager);
  }

  async load(
    url: string,
    offsets: Partial<ModelOffsets> = {},
  ): Promise<THREE.Group> {
    const o = { ...DEFAULT_OFFSETS, ...offsets };

    return new Promise((resolve, reject) => {
      this.loader.load(
        url,
        (gltf) => {
          const model = gltf.scene;

          // Apply flat shading to all mesh materials
          model.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              const materials = Array.isArray(mesh.material)
                ? mesh.material
                : [mesh.material];
              for (const mat of materials) {
                if (mat instanceof THREE.MeshStandardMaterial ||
                    mat instanceof THREE.MeshPhongMaterial ||
                    mat instanceof THREE.MeshLambertMaterial) {
                  mat.flatShading = true;
                  mat.needsUpdate = true;
                }
              }
              mesh.castShadow = true;
              mesh.receiveShadow = true;
            }
          });

          // Apply offsets
          model.position.set(o.posX, o.posY, o.posZ);
          model.rotation.set(o.rotX, o.rotY, o.rotZ);
          model.scale.setScalar(o.scale);

          resolve(model);
        },
        undefined,
        (err) => reject(err),
      );
    });
  }
}
