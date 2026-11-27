import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PHYSICS, MOVE, PLAYER } from '../shared/constants.js';
import { box } from '../shared/maps/format.js';
import { accelerate, applyFriction } from '../shared/physics/move.js';
import { createPlayer, stepPlayer, emptyInput } from '../shared/physics/player.js';

const DT = PHYSICS.FIXED_DT;
const floorMap = { id: 't', name: 't', boxes: [box(0, -0.5, 0, 400, 1, 400)], spawns: [] };
const speedOf = (p) => Math.hypot(p.vel.x, p.vel.z);
const input = (over = {}) => ({ ...emptyInput(), ...over });

/** Jogador parado e assentado no chão. */
function grounded() {
  const p = createPlayer({ x: 0, y: 0, z: 0 });
  stepPlayer(p, emptyInput(), floorMap, DT);
  assert.equal(p.onGround, true);
  return p;
}

/** Passos até `cond` ficar verdadeira (ou o limite); devolve o tempo em segundos. */
function timeUntil(p, inp, cond, maxSeconds = 5) {
  for (let i = 1; i <= maxSeconds / DT; i++) {
    stepPlayer(p, inp, floorMap, DT);
    if (cond(p)) return i * DT;
  }
  return Infinity;
}

test('de parado a 90% da velocidade em menos de 0,2 s', () => {
  const p = grounded();
  const t = timeUntil(p, input({ moveZ: 1 }), (q) => speedOf(q) >= 0.9 * MOVE.WALK_SPEED);
  assert.ok(t < 0.2, `levou ${t.toFixed(3)} s`);
});

test('de 9 m/s a parado em menos de 0,35 s', () => {
  const p = grounded();
  p.vel.x = MOVE.WALK_SPEED;
  const t = timeUntil(p, emptyInput(), (q) => speedOf(q) === 0);
  assert.ok(t < 0.35, `levou ${t.toFixed(3)} s`);
});

test('sem tecla, nunca acelera (parado ou andando)', () => {
  const still = grounded();
  for (let i = 0; i < 120; i++) {
    stepPlayer(still, emptyInput(), floorMap, DT);
    assert.equal(speedOf(still), 0);
  }
  const moving = grounded();
  moving.vel.z = 6;
  let last = speedOf(moving);
  for (let i = 0; i < 120; i++) {
    stepPlayer(moving, emptyInput(), floorMap, DT);
    assert.ok(speedOf(moving) <= last, 'velocidade só cai');
    last = speedOf(moving);
  }
});

test('segurando a tecla, a velocidade final é 9 m/s e não passa disso', () => {
  const p = grounded();
  let max = 0;
  for (let i = 0; i < 2 / DT; i++) {
    stepPlayer(p, input({ moveZ: 1 }), floorMap, DT);
    max = Math.max(max, speedOf(p));
  }
  assert.ok(Math.abs(speedOf(p) - MOVE.WALK_SPEED) < 1e-9, `final ${speedOf(p)}`);
  assert.ok(max <= MOVE.WALK_SPEED + 1e-9, `máximo ${max}`);
});

test('na diagonal a velocidade final é a mesma (9 m/s)', () => {
  const p = grounded();
  for (let i = 0; i < 2 / DT; i++) stepPlayer(p, input({ moveZ: 1, moveX: 1 }), floorMap, DT);
  assert.ok(Math.abs(speedOf(p) - MOVE.WALK_SPEED) < 1e-9);
});

test('trocar de direção: vira para o lado novo e fica praticamente em 9 m/s', () => {
  const p = grounded();
  for (let i = 0; i < 1 / DT; i++) stepPlayer(p, input({ moveZ: 1 }), floorMap, DT); // -z
  for (let i = 0; i < 1 / DT; i++) stepPlayer(p, input({ moveX: 1 }), floorMap, DT); // +x
  assert.ok(Math.abs(p.vel.x - MOVE.WALK_SPEED) < 0.05, `x ${p.vel.x}`);
  // A sobra no sentido antigo cai pelo atrito (proporcional): quase zero depois de 1 s.
  assert.ok(Math.abs(p.vel.z) < 0.05, `z ${p.vel.z}`);
  // Na troca, o total pode passar de 9 por uma fração mínima (próprio do modelo); o atrito segura.
  assert.ok(Math.hypot(p.vel.x, p.vel.z) <= MOVE.WALK_SPEED + 0.01);
});

test('no ar: sem atrito e sem aceleração (controle aéreo vem na F1-08)', () => {
  const p = createPlayer({ x: 0, y: 50, z: 0 });
  p.vel.x = 5;
  for (let i = 0; i < 60; i++) stepPlayer(p, input({ moveZ: 1 }), floorMap, DT);
  assert.equal(p.vel.x, 5);
  assert.equal(p.vel.z, 0);
});

test('andando contra a parede com a tecla segurada, fica encostado', () => {
  const wall = box(3, 2, 0, 0.5, 4, 10);
  const map = { ...floorMap, boxes: [...floorMap.boxes, wall] };
  const p = createPlayer({ x: 0, y: 0, z: 0 });
  for (let i = 0; i < 2 / DT; i++) stepPlayer(p, input({ moveX: 1, yaw: 0 }), map, DT);
  assert.ok(Math.abs(p.pos.x - (wall.min.x - PLAYER.RADIUS)) < 1e-9, `x ${p.pos.x}`);
  assert.equal(p.vel.x, 0);
});

test('accelerate: soma até o alvo na direção e não altera a entrada', () => {
  const v = { x: 0, y: -1, z: 0 };
  const dir = { x: 1, y: 0, z: 0 };
  const a = accelerate(v, dir, 9, 14, DT);
  assert.ok(Math.abs(a.x - 14 * 9 * DT) < 1e-12);
  assert.equal(a.y, -1, 'não mexe na queda');
  assert.deepEqual(v, { x: 0, y: -1, z: 0 }, 'entrada intacta');
  const near = accelerate({ x: 8.9, y: 0, z: 0 }, dir, 9, 14, DT);
  assert.ok(Math.abs(near.x - 9) < 1e-12, 'não passa do alvo');
  const fast = accelerate({ x: 20, y: 0, z: 0 }, dir, 9, 14, DT);
  assert.equal(fast.x, 20, 'já acima do alvo: não soma nem tira');
});

test('applyFriction: proporcional acima de STOP_SPEED, freio mínimo abaixo, nunca inverte', () => {
  const fast = applyFriction({ x: 9, y: 2, z: 0 }, 7, 3, DT);
  assert.ok(Math.abs(fast.x - 9 * (1 - 7 * DT)) < 1e-12);
  assert.equal(fast.y, 2, 'não mexe na queda');
  const slow = applyFriction({ x: 1, y: 0, z: 0 }, 7, 3, DT);
  assert.ok(Math.abs(slow.x - (1 - 3 * 7 * DT)) < 1e-12, 'freia como se estivesse a 3 m/s');
  const tiny = applyFriction({ x: 0.05, y: 0, z: -0.05 }, 7, 3, DT);
  assert.deepEqual([tiny.x, tiny.z], [0, 0], 'para sem inverter');
  assert.deepEqual(applyFriction({ x: 0, y: 0, z: 0 }, 7, 3, DT), { x: 0, y: 0, z: 0 });
});
