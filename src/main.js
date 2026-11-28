import * as THREE from 'three';
import { PHYSICS, PLAYER, DEMO, VIEW, MOVE, CHARGE, WEAPONS } from '../shared/constants.js';
import { rifleDamage } from '../shared/combat/weapons.js';
import { createTracers } from './world/tracers.js';
import { createLoop } from './core/loop.js';
import { attachInput, ACTIONS } from './core/input.js';
import { createDebugPanel, createRateCounter } from './ui/debug.js';
import { getMap } from '../shared/maps/index.js';
import { validateMap } from '../shared/maps/format.js';
import { createMapMeshes } from './world/mapRenderer.js';
import { createLocalPlayer, resolveSensitivity, resolveFov } from './player/localPlayer.js';
import { createStartScreen } from './ui/startScreen.js';
import { createHud } from './ui/hud.js';
import { createSigns, createFloorMarks } from './world/signs.js';
import { createCircuitTimer, createTimerDisplay } from './ui/timer.js';
import { isTuningEnabled, loadTuning, createTuningPanel } from './ui/tuning.js';

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
scene.add(createSigns(map)); // placas com o nome de cada estação (mapa de treino)
scene.add(createFloorMarks(map)); // marcas no chão (X do slam, faixas do cronômetro)
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
// Campo de visão base: ?fov=100 no endereço muda e fica salvo (F1-18).
const fovBase = resolveFov(window.location.search, storage);

// Jogador local no primeiro ponto de nascimento do mapa.
// ?spawn=N começa na estação N (1 = primeiro ponto de nascimento do mapa).
const spawnParam = Number(new URLSearchParams(window.location.search).get('spawn'));
const spawnIndex = Number.isInteger(spawnParam) && spawnParam >= 1 && spawnParam <= map.spawns.length ? spawnParam - 1 : 0;
// Painel de ajuste ao vivo (F1-20): só com ?ajuste=1. Os números do movimento viram uma cópia
// editável (com os valores salvos neste navegador); sem ?ajuste=1, vale sempre o padrão.
const tuningOn = isTuningEnabled(window.location.search);
const tuning = tuningOn ? loadTuning(storage) : null;
const me = createLocalPlayer({ map, sensitivity, fovBase, spawnIndex, move: tuning ? tuning.cfg : MOVE, chargeCfg: tuning ? tuning.charge : CHARGE, weaponsCfg: tuning ? tuning.weapons : WEAPONS });
const tuningPanel = tuning ? createTuningPanel({ cfg: tuning.cfg, charge: tuning.charge, weapons: tuning.weapons, storage, loaded: tuning.loaded }) : null;
if (tuningPanel) {
  // Na fase de captura: os controles do painel (lil-gui) seguram as teclas apertadas neles,
  // e o F4 precisa funcionar também com o foco dentro do painel.
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'F4') return;
    e.preventDefault();
    if (!e.repeat) tuningPanel.toggle();
  }, true);
}
// Em desenvolvimento, o jogador local fica acessível no console (depuração e testes visuais).
if (import.meta.env.DEV) window.__me = me;
createStartScreen({ canvas, extra: tuningOn ? [['F4', 'painel de ajuste do movimento']] : [] });
const hud = createHud();
// Cronômetro do circuito (só em mapas com faixas de largada e chegada).
const circuit = map.timer ? createCircuitTimer(map.timer, { mapId: map.id, storage }) : null;
const timerDisplay = circuit ? createTimerDisplay() : null;
// R: volta para a estação (ponto de nascimento) mais perto.
window.addEventListener('keydown', (e) => {
  if (e.code !== 'KeyR' || e.repeat || !input.isLocked()) return;
  me.respawnNearest();
  circuit?.reset();
});
const deg = (rad) => Math.round((rad * 180) / Math.PI);
const tracers = createTracers(scene);
let lastFrame = performance.now();
// Diagnóstico do mouse no F3 (bug relatado: câmera travada na corrida na parede).
let lastFrameMouse = { x: 0, y: 0 };
let mouseSeen = 0;
const mouseRate = createRateCounter();

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
    // Traço de cada tiro deste passo (F2-02).
    for (const e of me.player.events) if (e.type === 'shot') tracers.add(e.origin, e.dir, e.point, e.weapon);
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
    lastFrameMouse = mouse;
    const eye = me.eye(alpha, frameDt);
    camera.position.set(eye.x, eye.y, eye.z);
    camera.rotation.set(me.pitch, me.yaw, me.roll);
    // Campo de visão abre com a velocidade (F1-18).
    if (Math.abs(camera.fov - me.fov) > 1e-3) {
      camera.fov = me.fov;
      camera.updateProjectionMatrix();
    }
    hud.update(me.speed);
    tracers.update(frameDt);
    if (circuit) {
      circuit.update(me.player.pos, now / 1000);
      timerDisplay.show(circuit);
    }
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
    debug.set('pulos na parede', `${p.wallJumpsLeft} de ${me.move.WALL_JUMP_MAX}`);
    debug.set('Carga (F2)', `${me.charge.value.toFixed(1)} de ${me.chargeCfg.CHARGE_MAX} (+${me.charge.rate.toFixed(1)}/s)`);
    debug.set('dano do Rifle agora', rifleDamage(me.speed, me.weaponsCfg, me.move).toFixed(1));
    debug.set('último tiro', me.lastShot ? `${me.lastShot.damage.toFixed(1)} de dano, acertou ${{ box: 'parede', target: 'alvo', none: 'nada' }[me.lastShot.hit]}` : '-');
    debug.set('dash (cargas)', `${p.dashCharges} de ${me.move.DASH_CHARGES}`);
    debug.set('estado', { ground: 'no chão', air: 'no ar', slide: 'deslizando', crouch: 'agachado', wallrun: 'correndo na parede', slam: 'golpe no chão', dash: 'dash', rail: 'no corrimão' }[p.state] ?? p.state);
    debug.set('olhar (graus)', `${deg(me.yaw)} / ${deg(me.pitch)}`);
    debug.set('inclinação da câmera (graus)', deg(me.roll));
    // Mouse: movimentos por segundo que chegam com o mouse travado (os que giram a câmera),
    // o movimento deste quadro e o último recebido. Se ficar 0 mexendo o mouse, o navegador
    // (ou o sistema) parou de mandar o mouse para o jogo.
    const ms = input.mouseStats;
    for (; mouseSeen < ms.locked; mouseSeen++) mouseRate.tick();
    mouseRate.sample(now);
    debug.set('mouse (movimentos/s)', mouseRate.measured ? mouseRate.rate.toFixed(0) : 'medindo...');
    debug.set('mouse neste quadro (pixels)', `${lastFrameMouse.x}, ${lastFrameMouse.y}`);
    debug.set('mouse último movimento (pixels)', `${ms.last.x}, ${ms.last.y}`);
    debug.set('mouse sem trava (movimentos)', ms.unlocked);
    debug.set('janela com foco', document.hasFocus() ? 'sim' : 'não');
    debug.set('sensibilidade', me.sensitivity.toFixed(4));
    debug.set('campo de visão (graus)', me.fov.toFixed(1));
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
