import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PHYSICS, MOVE, PLAYER } from '../shared/constants.js';
import { box } from '../shared/maps/format.js';
import { createPlayer, stepPlayer, emptyInput } from '../shared/physics/player.js';

const DT = PHYSICS.FIXED_DT;
const floor = box(0, -0.5, 0, 4000, 1, 4000);
const floorMap = { id: 't', name: 't', boxes: [floor], spawns: [] };
const input = (over = {}) => ({ ...emptyInput(), ...over });
const speedOf = (p) => Math.hypot(p.vel.x, p.vel.z);
const has = (p, type) => p.events.some((e) => e.type === type);
// Olhando para -z (yaw 0): W anda para -z.
const W = { moveZ: 1, yaw: 0 };

/** Jogador no chão correndo a `speed` m/s em -z. */
function runner(speed, map = floorMap, at = { x: 0, z: 0 }) {
  const p = createPlayer({ x: at.x, y: 0, z: at.z });
  stepPlayer(p, emptyInput(), map, DT);
  p.vel.z = -speed;
  return p;
}

function steps(p, inp, seconds, map = floorMap) {
  for (let i = 0; i < Math.round(seconds / DT); i++) stepPlayer(p, inp, map, DT);
  return p;
}

test('apertar agachar correndo: começa o deslize com impulso e altura agachada', () => {
  const p = runner(10);
  stepPlayer(p, input({ ...W, crouch: true, crouchPressed: true }), floorMap, DT);
  assert.ok(has(p, 'slideStart'));
  assert.equal(p.state, 'slide');
  assert.equal(p.height, PLAYER.CROUCH_HEIGHT);
  assert.ok(Math.abs(speedOf(p) - (10 + MOVE.SLIDE_BOOST)) < 0.1, `velocidade ${speedOf(p)}`); // menos o atrito do passo
});

test('deslize a 10 m/s percorre mais que andar', () => {
  const walker = runner(10);
  const slider = runner(10);
  stepPlayer(slider, input({ ...W, crouch: true, crouchPressed: true }), floorMap, DT);
  stepPlayer(walker, input(W), floorMap, DT);
  steps(slider, input({ ...W, crouch: true }), 1);
  steps(walker, input(W), 1);
  const dSlide = -slider.pos.z;
  const dWalk = -walker.pos.z;
  assert.ok(dSlide > dWalk + 1, `deslize ${dSlide.toFixed(2)} m, andando ${dWalk.toFixed(2)} m`);
});

test('impulso não acumula antes do tempo de espera', () => {
  const p = runner(8);
  stepPlayer(p, input({ ...W, crouch: true, crouchPressed: true }), floorMap, DT);
  const afterFirst = speedOf(p);
  steps(p, input({ ...W }), 0.2); // solta (para de deslizar) e anda um pouco
  assert.equal(p.sliding, false);
  const before = speedOf(p);
  stepPlayer(p, input({ ...W, crouch: true, crouchPressed: true }), floorMap, DT);
  assert.ok(has(p, 'slideStart'), 'desliza de novo');
  assert.ok(speedOf(p) <= before + 1e-6, `sem impulso: ${before.toFixed(2)} -> ${speedOf(p).toFixed(2)}`);
  assert.ok(afterFirst > 8 + MOVE.SLIDE_BOOST - 0.1, 'o primeiro teve impulso');
});

test('depois do tempo de espera, o impulso volta', () => {
  const p = runner(8);
  stepPlayer(p, input({ ...W, crouch: true, crouchPressed: true }), floorMap, DT);
  steps(p, input(W), MOVE.SLIDE_BOOST_COOLDOWN + 0.05); // anda de pé (9 m/s)
  const before = speedOf(p);
  stepPlayer(p, input({ ...W, crouch: true, crouchPressed: true }), floorMap, DT);
  assert.ok(speedOf(p) > before + MOVE.SLIDE_BOOST - 0.1, `com impulso: ${before.toFixed(2)} -> ${speedOf(p).toFixed(2)}`);
});

test('não levanta embaixo de teto baixo; levanta ao sair dele', () => {
  // Túnel em z de -6 a -12 com 1,4 m de vão (agachado cabe: 1,1 m; em pé não: 1,8 m).
  const ceiling = box(0, 1.9, -9, 6, 1, 6);
  const map = { ...floorMap, boxes: [floor, ceiling] };
  const p = runner(10, map);
  stepPlayer(p, input({ ...W, crouch: true, crouchPressed: true }), map, DT);
  // desliza até o meio do túnel
  for (let i = 0; i < 3 / DT && p.pos.z > -9; i++) stepPlayer(p, input({ ...W, crouch: true }), map, DT);
  assert.ok(p.pos.z <= -9 && p.pos.z > -12, `no túnel: z = ${p.pos.z}`);
  stepPlayer(p, input(W), map, DT); // solta a tecla embaixo do teto
  assert.equal(p.crouching, true, 'continua agachado');
  assert.equal(p.height, PLAYER.CROUCH_HEIGHT);
  for (let i = 0; i < 5 / DT && p.pos.z > -13; i++) stepPlayer(p, input(W), map, DT);
  assert.ok(p.pos.z <= -13, 'saiu do túnel andando agachado');
  stepPlayer(p, input(W), map, DT);
  assert.equal(p.crouching, false, 'levantou ao sair');
  assert.equal(p.height, PLAYER.HEIGHT);
});

test('abaixo de CROUCH_SPEED o deslize vira agachado; soltar a tecla levanta', () => {
  const p = runner(7);
  stepPlayer(p, input({ crouch: true, crouchPressed: true }), floorMap, DT);
  let ended = false;
  for (let i = 0; i < 5 / DT && !ended; i++) {
    stepPlayer(p, input({ crouch: true }), floorMap, DT);
    ended = has(p, 'slideEnd');
  }
  assert.ok(ended);
  assert.ok(speedOf(p) < MOVE.CROUCH_SPEED + 0.1);
  assert.equal(p.state, 'crouch');
  stepPlayer(p, emptyInput(), floorMap, DT);
  assert.equal(p.crouching, false);
  assert.equal(p.state, 'ground');
});

test('soltar a tecla no meio do deslize termina o deslize', () => {
  const p = runner(10);
  stepPlayer(p, input({ crouch: true, crouchPressed: true }), floorMap, DT);
  steps(p, input({ crouch: true }), 0.2);
  stepPlayer(p, emptyInput(), floorMap, DT);
  assert.ok(has(p, 'slideEnd'));
  assert.equal(p.sliding, false);
});

test('devagar, agachar só agacha (sem deslize) e anda a CROUCH_SPEED', () => {
  const p = runner(3);
  stepPlayer(p, input({ ...W, crouch: true, crouchPressed: true }), floorMap, DT);
  assert.equal(has(p, 'slideStart'), false);
  assert.equal(p.state, 'crouch');
  steps(p, input({ ...W, crouch: true }), 2);
  assert.ok(Math.abs(speedOf(p) - MOVE.CROUCH_SPEED) < 1e-6, `velocidade ${speedOf(p)}`);
});

test('slide hop: pular no deslize sai com a velocidade do deslize e em pé', () => {
  const p = runner(10);
  stepPlayer(p, input({ ...W, crouch: true, crouchPressed: true }), floorMap, DT);
  steps(p, input({ ...W, crouch: true }), 0.1);
  const before = speedOf(p);
  stepPlayer(p, input({ ...W, crouch: true, jump: true, jumpPressed: true }), floorMap, DT);
  assert.ok(has(p, 'jump') && has(p, 'slideEnd'));
  assert.ok(Math.abs(speedOf(p) - before) < 1e-6, `${before} -> ${speedOf(p)}`);
  assert.ok(before > MOVE.WALK_SPEED, 'mais rápido que andar');
  assert.equal(p.height, PLAYER.HEIGHT, 'levanta ao pular');
});

test('deslize: as teclas só direcionam levemente, sem acelerar', () => {
  const p = runner(10);
  stepPlayer(p, input({ crouch: true, crouchPressed: true }), floorMap, DT);
  const before = speedOf(p);
  stepPlayer(p, input({ moveX: 1, yaw: 0, crouch: true }), floorMap, DT); // aperta "direita" (+x)
  assert.ok(speedOf(p) < before, 'não acelera');
  const turned = Math.atan2(p.vel.x, -p.vel.z);
  assert.ok(turned > 0 && turned < 0.05, `virou só um pouco: ${turned}`);
});
