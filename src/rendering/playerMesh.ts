import * as THREE from 'three';
import type { PlayerState } from '@/state/gameState';

export class PlayerMesh {
  public group: THREE.Group;

  constructor() {
    this.group = new THREE.Group();

    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
    const wingMat = new THREE.MeshLambertMaterial({ color: 0x666666 });
    const accentMat = new THREE.MeshLambertMaterial({ color: 0xaaaaaa });

    // Fuselage
    const fuselage = new THREE.Mesh(new THREE.BoxGeometry(1, 0.8, 5), bodyMat);
    this.group.add(fuselage);

    // Main wings
    const wings = new THREE.Mesh(new THREE.BoxGeometry(8, 0.15, 1.5), wingMat);
    wings.position.set(0, 0, 0.5);
    this.group.add(wings);

    // Tail horizontal stabilizer
    const tailWing = new THREE.Mesh(new THREE.BoxGeometry(3, 0.1, 0.8), wingMat);
    tailWing.position.set(0, 0, 2.2);
    this.group.add(tailWing);

    // Vertical stabilizer
    const vStab = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.2, 0.8), wingMat);
    vStab.position.set(0, 0.6, 2.2);
    this.group.add(vStab);

    // Nose
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 1), accentMat);
    nose.position.set(0, 0, -2.5);
    this.group.add(nose);
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
