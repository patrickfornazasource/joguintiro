import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PHYSICS, MOVE } from '../shared/constants.js';
import { box } from '../shared/maps/format.js';
import { createPlayer, stepPlayer, emptyInput } from '../shared/physics/player.js';

const DT = PHYSICS.FIXED_DT;
const floorMap = { id: 't', name: 't', boxes: [box(0, -0.5, 0, 2000, 1, 2000)], spawns: [] };
const input = (over = {}) => ({ ...emptyInput(), ...over });
const speedOf = (p) => Math.hypot(p.vel.x, p.vel.z);

/** Jogador parado e assentado no chão. */
function grounded(x = 0) {
  const p = createPlayer({ x, y: 0, z: 0 });
  stepPlayer(p, emptyInput(), floorMap, DT);
  assert.equal(p.onGround, true);
  return p;
}

test('pular: sobe até cerca de 1,33 m (fórmula v² / 2g)', () => {
  const p = grounded();
  stepPlayer(p, input({ jump: true, jumpPressed: true }), floorMap, DT);
  assert.deepEqual(p.events, [{ type: 'jump' }]);
  let top = 0;
  for (let i = 0; i < 2 / DT; i++) {
    stepPlayer(p, emptyInput(), floorMap, DT);
    top = Math.max(top, p.pos.y);
  }
  const expected = (MOVE.JUMP_SPEED * MOVE.JUMP_SPEED) / (2 * MOVE.GRAVITY);
  assert.ok(Math.abs(expected - 1.333) < 0.001, `fórmula ${expected}`);
  assert.ok(Math.abs(top - expected) / expected < 0.02, `altura ${top.toFixed(4)} m`);
  assert.equal(p.onGround, true, 'pousou de volta');
});

test('evento jump só no passo do pulo', () => {
  const p = grounded();
  stepPlayer(p, input({ jump: true, jumpPressed: true }), floorMap, DT);
  assert.equal(p.events.length, 1);
  stepPlayer(p, input({ jump: true }), floorMap, DT);
  assert.deepEqual(p.events, []);
});

test('bunny hop: 10 pulos emendados a 12 m/s terminam com pelo menos 11,9 m/s', () => {
  const p = grounded();
  p.vel.x = 12;
  let jumps = 0;
  for (let i = 0; i < 10 / DT && jumps < 10; i++) {
    // Segurando espaço o tempo todo; só o primeiro passo é "apertou agora".
    stepPlayer(p, input({ jump: true, jumpPressed: i === 0 }), floorMap, DT);
    jumps += p.events.filter((e) => e.type === 'jump').length;
  }
  assert.equal(jumps, 10);
  assert.ok(speedOf(p) >= 11.9, `velocidade ${speedOf(p)}`);
});

test('sem segurar espaço, o pouso freia (atrito volta)', () => {
  const p = grounded();
  p.vel.x = 12;
  stepPlayer(p, input({ jump: true, jumpPressed: true }), floorMap, DT);
  for (let i = 0; i < 1.5 / DT; i++) stepPlayer(p, emptyInput(), floorMap, DT);
  assert.ok(speedOf(p) < 1, `velocidade ${speedOf(p)}`);
});

/** Plataforma até x = 5; jogador corre em +x e sai da borda. Devolve o jogador no passo em que saiu. */
function offTheEdge() {
  const map = { id: 't', name: 't', boxes: [box(0, -0.5, 0, 10, 1, 4)], spawns: [] };
  const p = createPlayer({ x: 3, y: 0, z: 0 });
  stepPlayer(p, emptyInput(), map, DT);
  p.vel.x = 6;
  for (let i = 0; i < 2 / DT && p.onGround; i++) stepPlayer(p, input({ moveX: 1 }), map, DT);
  assert.equal(p.onGround, false, 'saiu da borda');
  return { p, map };
}

function jumpAfter(seconds) {
  const { p, map } = offTheEdge();
  for (let i = 0; i < Math.round(seconds / DT); i++) stepPlayer(p, input({ moveX: 1 }), map, DT);
  stepPlayer(p, input({ moveX: 1, jump: true, jumpPressed: true }), map, DT);
  return p.events.some((e) => e.type === 'jump');
}

test('tolerância de borda: pula 0,08 s depois de sair; 0,15 s depois, não', () => {
  assert.equal(jumpAfter(0.08), true);
  assert.equal(jumpAfter(0.15), false);
});

test('tolerância de borda vale para um pulo só', () => {
  const { p, map } = offTheEdge();
  stepPlayer(p, input({ jump: true, jumpPressed: true }), map, DT);
  assert.equal(p.events.length, 1);
  stepPlayer(p, input({ jump: true, jumpPressed: true }), map, DT);
  // Desde a F1-09 o segundo aperto no ar é o pulo duplo, não um segundo pulo normal.
  assert.deepEqual(p.events, [{ type: 'doubleJump' }], 'segundo aperto: pulo duplo, não outro pulo normal');
  stepPlayer(p, input({ jump: true, jumpPressed: true }), map, DT);
  assert.deepEqual(p.events, [], 'terceiro aperto no ar não pula');
});

/** Cai de 2 m; aperta espaço `before` segundos antes de tocar o chão e solta. Pulou ao pousar? */
function bufferedJump(before) {
  // Tempo de queda de 2 m, simulado para achar o passo exato do pouso.
  const probe = createPlayer({ x: 0, y: 2, z: 0 });
  let landStep = 0;
  while (!probe.onGround) {
    stepPlayer(probe, emptyInput(), floorMap, DT);
    landStep++;
  }
  const pressStep = landStep - Math.round(before / DT);
  const p = createPlayer({ x: 0, y: 2, z: 0 });
  let jumped = false;
  for (let i = 1; i <= landStep + 3; i++) {
    stepPlayer(p, input({ jumpPressed: i === pressStep, jump: i === pressStep }), floorMap, DT);
    jumped ||= p.events.some((e) => e.type === 'jump');
  }
  return jumped;
}

test('pulo antecipado: apertar 0,08 s antes de tocar o chão pula; 0,15 s antes, não', () => {
  assert.equal(bufferedJump(0.08), true);
  assert.equal(bufferedJump(0.15), false);
});

test('no ar, apertar espaço não pula (ainda sem pulo duplo)', () => {
  const p = createPlayer({ x: 0, y: 10, z: 0 });
  for (let i = 0; i < 30; i++) stepPlayer(p, emptyInput(), floorMap, DT);
  stepPlayer(p, input({ jump: true, jumpPressed: true }), floorMap, DT);
  assert.deepEqual(p.events, []);
  assert.ok(p.vel.y < 0);
});

test('pular embaixo de um teto baixo: bate a cabeça e volta', () => {
  const map = { ...floorMap, boxes: [...floorMap.boxes, box(0, 2.5, 0, 4, 1, 4)] }; // teto em 2 m
  const p = createPlayer({ x: 0, y: 0, z: 0 });
  stepPlayer(p, emptyInput(), map, DT);
  stepPlayer(p, input({ jump: true, jumpPressed: true }), map, DT);
  let top = 0;
  for (let i = 0; i < 1 / DT; i++) {
    stepPlayer(p, emptyInput(), map, DT);
    top = Math.max(top, p.pos.y);
  }
  assert.ok(top + p.height <= 2 + 1e-9, `cabeça passou do teto: ${top + p.height}`);
  assert.equal(p.onGround, true);
});
