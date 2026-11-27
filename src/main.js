import * as THREE from 'three';
import { PHYSICS, PLAYER, DEMO } from '../shared/constants.js';
import { createLoop } from './core/loop.js';
import { attachInput, ACTIONS } from './core/input.js';
import { createDebugPanel } from './ui/debug.js';

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

// Teclado e mouse. Clique na tela trava o ponteiro; Esc solta.
const input = attachInput({ canvas });
// Em desenvolvimento, deixa a entrada acessível no console do navegador para depuração.
if (import.meta.env.DEV) window.__input = input;

// Painel de depuração: F3 liga e desliga; ?debug=1 no endereço já abre ligado.
const debug = createDebugPanel();
debug.set('jogador', 'ainda não existe (Fase 1)');

const loop = createLoop({
  step: PHYSICS.FIXED_DT,
  // Lógica em passos fixos: o cubo gira na mesma velocidade em qualquer FPS.
  update(dt) {
    cube.rotation.y += DEMO.CUBE_SPIN_SPEED * dt;
    // Fim do passo: os apertos (pressed) deste passo já foram vistos.
    input.endStep();
    debug.step();
  },
  render() {
    renderer.render(scene, camera);
    debug.set('chamadas de desenho', renderer.info.render.calls);
    debug.set('triângulos', renderer.info.render.triangles);
    debug.set('teclas', ACTIONS.filter((a) => input.isDown(a)));
    debug.set('mouse travado', input.isLocked() ? 'sim' : 'não');
    debug.frame(performance.now());
    // Avisa o script de captura (npm run shot) que o primeiro quadro já foi desenhado.
    if (!window.__READY) window.__READY = true;
  },
});
loop.start();

console.info(`LUZ NEGRA: constantes carregadas (passo ${PHYSICS.FIXED_DT.toFixed(5)} s, altura ${PLAYER.HEIGHT} m)`);
