import * as THREE from 'three';
import { PHYSICS, PLAYER, DEMO, VIEW, MOVE } from '../shared/constants.js';
import { createLoop } from './core/loop.js';
import { attachInput, ACTIONS } from './core/input.js';
import { createDebugPanel } from './ui/debug.js';
import { getMap } from '../shared/maps/index.js';
import { validateMap } from '../shared/maps/format.js';
import { createMapMeshes } from './world/mapRenderer.js';
import { createLocalPlayer, resolveSensitivity } from './player/localPlayer.js';
import { createStartScreen } from './ui/startScreen.js';

const canvas = document.getElementById('game');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101014);

// Mapa escolhido por ?mapa=<id> no endereço (padrão: sandbox).
const mapId = new URLSearchParams(window.location.search).get('mapa');
const map = getMap(mapId);
if (mapId && mapId !== map.id) console.warn(`Mapa "${mapId}" não existe; usando "${map.id}".`);
const check = validateMap(map);
if (!check.ok) throw new Error(`Mapa "${map.id}" inválido: ${check.errors.join('; ')}`);
scene.add(createMapMeshes(map));
console.info(`LUZ NEGRA: mapa "${map.name}" (${map.boxes.length} caixas)`);

// Câmera em primeira pessoa (posição e direção vêm do jogador local a cada quadro).
const camera = new THREE.PerspectiveCamera(VIEW.FOV, window.innerWidth / window.innerHeight, 0.05, 500);
camera.rotation.order = 'YXZ'; // gira primeiro para os lados (yaw), depois para cima/baixo (pitch)

// Cubo girando no alto do centro do mapa: sinal visual de que o jogo está rodando.
const cube = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshStandardMaterial({ color: 0xcccccc }),
);
cube.position.set(0, 3, 0);
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

// Sensibilidade do mouse: ?sens=0.003 no endereço muda e fica salva.
let storage = null;
try {
  storage = window.localStorage;
} catch {
  storage = null;
}
const sensitivity = resolveSensitivity(window.location.search, storage);

// Jogador local no primeiro ponto de nascimento do mapa.
const me = createLocalPlayer({ map, sensitivity });
// Em desenvolvimento, o jogador local fica acessível no console (depuração e testes visuais).
if (import.meta.env.DEV) window.__me = me;
createStartScreen({ canvas });
const deg = (rad) => Math.round((rad * 180) / Math.PI);
let lastFrame = performance.now();

// Nomes das ações em português, só para exibir no painel.
const ACTION_LABELS = {
  forward: 'frente',
  back: 'trás',
  left: 'esquerda',
  right: 'direita',
  jump: 'pulo',
  crouch: 'agachar',
  dash: 'dash',
  fire: 'tiro',
  altFire: 'tiro alternativo',
  scoreboard: 'placar',
  weapon1: 'arma 1',
  weapon2: 'arma 2',
  weapon3: 'arma 3',
};
const keyText = (k) => (k ? `${k.code || '(sem código)'} / ${k.key === ' ' ? 'Espaço' : k.key}` : '-');

const loop = createLoop({
  step: PHYSICS.FIXED_DT,
  // Lógica em passos fixos: mesma física em qualquer FPS.
  update(dt) {
    cube.rotation.y += DEMO.CUBE_SPIN_SPEED * dt;
    me.step(input, dt);
    // Fim do passo: os apertos (pressed) deste passo já foram vistos.
    input.endStep();
    debug.step();
  },
  render(alpha) {
    const now = performance.now();
    const frameDt = (now - lastFrame) / 1000;
    lastFrame = now;
    // Mouse a cada quadro (resposta imediata); posição interpolada entre passos.
    const mouse = input.consumeMouseDelta();
    me.look(mouse.x, mouse.y);
    const eye = me.eye(alpha, frameDt);
    camera.position.set(eye.x, eye.y, eye.z);
    camera.rotation.set(me.pitch, me.yaw, me.roll);
    renderer.render(scene, camera);
    const p = me.player;
    debug.set('posição', p.pos);
    debug.set('velocidade (m/s)', Math.hypot(p.vel.x, p.vel.z));
    debug.set('queda (m/s)', p.vel.y);
    debug.set('no chão', p.onGround ? 'sim' : 'não');
    const SIDES = { left: 'esquerda', right: 'direita', front: 'frente', back: 'trás' };
    debug.set('parede', p.wall
      ? `${SIDES[p.wall.side]} (${p.wall.type})${p.wall.age > 0 ? ` lembrada ${p.wall.age.toFixed(2)} s` : ''}`
      : '-');
    debug.set('pulo duplo', p.jumpsLeft > 0 ? 'disponível' : 'usado');
    debug.set('pulos na parede', `${p.wallJumpsLeft} de ${MOVE.WALL_JUMP_MAX}`);
    debug.set('dash (cargas)', `${p.dashCharges} de ${MOVE.DASH_CHARGES}`);
    debug.set('estado', { ground: 'no chão', air: 'no ar', slide: 'deslizando', crouch: 'agachado', wallrun: 'correndo na parede', slam: 'golpe no chão', dash: 'dash' }[p.state] ?? p.state);
    debug.set('olhar (graus)', `${deg(me.yaw)} / ${deg(me.pitch)}`);
    debug.set('sensibilidade', me.sensitivity.toFixed(4));
    debug.set('renasceu', me.respawns);
    debug.set('chamadas de desenho', renderer.info.render.calls);
    debug.set('triângulos', renderer.info.render.triangles);
    debug.set('teclas', ACTIONS.filter((a) => input.isDown(a)).map((a) => ACTION_LABELS[a] ?? a));
    // Diagnóstico: a última tecla que o navegador entregou (código físico / caractere).
    debug.set('última tecla', keyText(input.lastKey));
    debug.set('mouse travado', input.isLocked() ? 'sim' : 'não');
    debug.frame(performance.now());
    // Avisa o script de captura (npm run shot) que o primeiro quadro já foi desenhado.
    if (!window.__READY) window.__READY = true;
  },
});
loop.start();

console.info(`LUZ NEGRA: constantes carregadas (passo ${PHYSICS.FIXED_DT.toFixed(5)} s, altura ${PLAYER.HEIGHT} m)`);
