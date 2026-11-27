import * as THREE from 'three';
import { PHYSICS, PLAYER } from '../shared/constants.js';

const canvas = document.getElementById('game');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101014);

const camera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 0.1, 500);
camera.position.set(4, 3, 6);
camera.lookAt(0, 0.5, 0);

// Chão cinza 40x40
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(40, 40),
  new THREE.MeshStandardMaterial({ color: 0x808080 }),
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

// Um cubo
const cube = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshStandardMaterial({ color: 0xcccccc }),
);
cube.position.set(0, 0.5, 0);
scene.add(cube);

// Luzes
scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1));
const sun = new THREE.DirectionalLight(0xffffff, 1.5);
sun.position.set(5, 10, 7);
scene.add(sun);

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onResize);

function animate() {
  renderer.render(scene, camera);
  // Avisa o script de captura (npm run shot) que o primeiro quadro já foi desenhado.
  if (!window.__READY) window.__READY = true;
  requestAnimationFrame(animate);
}
animate();

console.info(`LUZ NEGRA: constantes carregadas (passo ${PHYSICS.FIXED_DT.toFixed(5)} s, altura ${PLAYER.HEIGHT} m)`);
