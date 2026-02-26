import * as THREE from 'three';

export function createScene(): THREE.Scene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.Fog(0x87ceeb, 500, 5000);
  return scene;
}

export function createLights(scene: THREE.Scene): {
  sun: THREE.DirectionalLight;
  ambient: THREE.HemisphereLight;
} {
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(200, 400, 200);
  scene.add(sun);

  const ambient = new THREE.HemisphereLight(0x87ceeb, 0x556b2f, 0.6);
  scene.add(ambient);

  return { sun, ambient };
}

export function createTerrain(scene: THREE.Scene): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(10000, 10000, 1, 1);
  const material = new THREE.MeshLambertMaterial({ color: 0x3b7a3b });
  const terrain = new THREE.Mesh(geometry, material);
  terrain.rotation.x = -Math.PI / 2;
  terrain.position.y = 0;
  scene.add(terrain);
  return terrain;
}
