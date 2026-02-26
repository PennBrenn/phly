import * as THREE from 'three';
import type { PlayerState } from '@/state/gameState';

export class PlayerMesh {
  public group: THREE.Group;
  private innerModel: THREE.Group | null = null;

  constructor() {
    this.group = new THREE.Group();
    this.group.frustumCulled = false;
    this.buildPrimitive();
  }

  private buildPrimitive(): void {
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
    const wingMat = new THREE.MeshLambertMaterial({ color: 0x666666 });
    const accentMat = new THREE.MeshLambertMaterial({ color: 0xaaaaaa });

    const prim = new THREE.Group();
    prim.name = 'primitive';

    const fuselage = new THREE.Mesh(new THREE.BoxGeometry(1, 0.8, 5), bodyMat);
    fuselage.castShadow = true;
    prim.add(fuselage);

    const wings = new THREE.Mesh(new THREE.BoxGeometry(8, 0.15, 1.5), wingMat);
    wings.position.set(0, 0, 0.5);
    wings.castShadow = true;
    prim.add(wings);

    const tailWing = new THREE.Mesh(new THREE.BoxGeometry(3, 0.1, 0.8), wingMat);
    tailWing.position.set(0, 0, 2.2);
    tailWing.castShadow = true;
    prim.add(tailWing);

    const vStab = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.2, 0.8), wingMat);
    vStab.position.set(0, 0.6, 2.2);
    vStab.castShadow = true;
    prim.add(vStab);

    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 1), accentMat);
    nose.position.set(0, 0, -2.5);
    nose.castShadow = true;
    prim.add(nose);

    this.innerModel = prim;
    this.group.add(prim);
  }

  setModel(model: THREE.Group): void {
    if (this.innerModel) {
      this.group.remove(this.innerModel);
    }
    this.innerModel = model;

    // Disable frustum culling on all children so model never disappears
    model.traverse((child) => { child.frustumCulled = false; });

    // Auto-scale: if the bounding box is huge (e.g. raw CAD units), normalise to ~12m wingspan
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 30 || maxDim < 2) {
      const targetSize = 12;
      model.scale.setScalar(targetSize / maxDim);
    }

    this.group.add(model);
  }

  getInnerModel(): THREE.Group | null {
    return this.innerModel;
  }

  syncToState(player: PlayerState): void {
    this.group.position.set(
      player.position.x,
      player.position.y,
      player.position.z,
    );
    this.group.quaternion.set(
      player.rotation.x,
      player.rotation.y,
      player.rotation.z,
      player.rotation.w,
    );
  }
}
