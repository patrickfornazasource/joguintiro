import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PHYSICS, MOVE } from '../shared/constants.js';
import { box } from '../shared/maps/format.js';
import { redirectHorizontal } from '../shared/physics/move.js';
import { createPlayer, stepPlayer, emptyInput } from '../shared/physics/player.js';

const DT = PHYSICS.FIXED_DT;
const floorMap = { id: 't', name: 't', boxes: [box(0, -0.5, 0, 2000, 1, 2000)], spawns: [] };
const input = (over = {}) => ({ ...emptyInput(), ...over });
const speedOf = (p) => Math.hypot(p.vel.x, p.vel.z);
const has = (p, type) => p.events.some((e) => e.type === type);

/** Jogador que pulou do chão e está no ar há `airSteps` passos. */
function airborne(airSteps = 10, setup) {
  const p = createPlayer({ x: 0, y: 0, z: 0 });
  stepPlayer(p, emptyInput(), floorMap, DT);
  setup?.(p);
  stepPlayer(p, input({ jump: true, jumpPressed: true }), floorMap, DT);
  assert.ok(has(p, 'jump'));
  for (let i = 0; i < airSteps; i++) stepPlayer(p, emptyInput(), floorMap, DT);
  assert.equal(p.onGround, false);
  return p;
}

test('pulo duplo no ar: sobe de novo com DOUBLE_JUMP_SPEED e gera o evento', () => {
  const p = airborne(40); // já caindo
  assert.ok(p.vel.y < 0);
  stepPlayer(p, input({ jump: true, jumpPressed: true }), floorMap, DT);
  assert.deepEqual(p.events, [{ type: 'doubleJump' }]);
  assert.ok(Math.abs(p.vel.y - (MOVE.DOUBLE_JUMP_SPEED - MOVE.GRAVITY * DT)) < 1e-9, `vel.y ${p.vel.y}`);
  assert.equal(p.jumpsLeft, 0);
});

test('só um pulo extra por voo', () => {
  const p = airborne(10);
  let doubles = 0;
  for (let i = 0; i < 40; i++) {
    stepPlayer(p, input({ jump: true, jumpPressed: i % 4 === 0 }), floorMap, DT); // aperta várias vezes
    if (has(p, 'doubleJump')) doubles++;
    if (p.onGround) break;
  }
  assert.equal(doubles, 1);
});

test('segurar espaço não gasta o pulo duplo', () => {
  const p = airborne(1);
  for (let i = 0; i < 30; i++) {
    stepPlayer(p, input({ jump: true }), floorMap, DT); // segurando, sem aperto novo
    assert.equal(has(p, 'doubleJump'), false);
  }
  assert.equal(p.jumpsLeft, 1, 'continua disponível');
  stepPlayer(p, input({ jump: true, jumpPressed: true }), floorMap, DT);
  assert.ok(has(p, 'doubleJump'), 'um aperto novo usa');
});

test('recarrega ao tocar o chão', () => {
  const p = airborne(5);
  stepPlayer(p, input({ jump: true, jumpPressed: true }), floorMap, DT);
  assert.ok(has(p, 'doubleJump'));
  for (let i = 0; i < 3 / DT && !p.onGround; i++) stepPlayer(p, emptyInput(), floorMap, DT);
  assert.equal(p.onGround, true);
  stepPlayer(p, emptyInput(), floorMap, DT);
  assert.equal(p.jumpsLeft, MOVE.AIR_JUMPS);
  // novo voo: pulo duplo disponível de novo
  stepPlayer(p, input({ jump: true, jumpPressed: true }), floorMap, DT);
  for (let i = 0; i < 10; i++) stepPlayer(p, emptyInput(), floorMap, DT);
  stepPlayer(p, input({ jump: true, jumpPressed: true }), floorMap, DT);
  assert.ok(has(p, 'doubleJump'));
});

test('caindo de uma borda sem ter pulado também tem o pulo duplo', () => {
  const map = { id: 't', name: 't', boxes: [box(0, 9.5, 0, 4, 1, 4), box(0, -0.5, 0, 2000, 1, 2000)], spawns: [] };
  const p = createPlayer({ x: 0, y: 10, z: 0 });
  stepPlayer(p, emptyInput(), map, DT);
  const walkX = input({ moveZ: 1, yaw: -Math.PI / 2 }); // W olhando para +x
  for (let i = 0; i < 3 / DT && p.onGround; i++) stepPlayer(p, walkX, map, DT);
  assert.equal(p.onGround, false, 'saiu da borda');
  for (let i = 0; i < 30; i++) stepPlayer(p, emptyInput(), map, DT); // passou a tolerância de borda
  stepPlayer(p, input({ jump: true, jumpPressed: true }), map, DT);
  assert.deepEqual(p.events, [{ type: 'doubleJump' }]);
});

test('redireciona para as teclas mantendo a velocidade (90° para o lado)', () => {
  // Correndo em +x (olhando para +x: yaw = -90°) e apertando "esquerda" (A), que aponta para -z.
  const yaw = -Math.PI / 2;
  const p = airborne(10, (q) => { q.vel.x = 10; });
  const before = speedOf(p);
  stepPlayer(p, input({ moveX: -1, yaw, jump: true, jumpPressed: true }), floorMap, DT);
  assert.ok(has(p, 'doubleJump'));
  assert.ok(Math.abs(speedOf(p) - before) < 1e-9, `velocidade ${before} -> ${speedOf(p)}`);
  const angle = Math.atan2(-p.vel.z, p.vel.x); // quanto virou de +x para -z
  const expected = (Math.PI / 2) * MOVE.DOUBLE_JUMP_REDIRECT;
  assert.ok(Math.abs(angle - expected) < 1e-9, `virou ${(angle * 180 / Math.PI).toFixed(1)}°`);
});

test('sem tecla no pulo duplo, a direção não muda', () => {
  const p = airborne(10, (q) => { q.vel.x = 8; q.vel.z = -3; });
  const vx = p.vel.x;
  const vz = p.vel.z;
  stepPlayer(p, input({ jump: true, jumpPressed: true }), floorMap, DT);
  assert.equal(p.vel.x, vx);
  assert.equal(p.vel.z, vz);
});

test('o aperto do pulo duplo não vira pulo antecipado no pouso', () => {
  const p = airborne(70); // perto de pousar
  stepPlayer(p, input({ jump: true, jumpPressed: true }), floorMap, DT);
  assert.ok(has(p, 'doubleJump'));
  assert.equal(p.jumpBuffer, 0);
});

test('redirectHorizontal: fração 1 vira totalmente, 0 não vira, vertical intacta', () => {
  const v = { x: 10, y: 3, z: 0 };
  const left = { x: 0, y: 0, z: -1 };
  const full = redirectHorizontal(v, left, 1);
  assert.ok(Math.abs(full.x) < 1e-9 && Math.abs(full.z + 10) < 1e-9, `${full.x}, ${full.z}`);
  assert.equal(full.y, 3);
  assert.deepEqual(redirectHorizontal(v, left, 0), v);
  assert.deepEqual(redirectHorizontal(v, null, 1), v);
  assert.deepEqual(redirectHorizontal({ x: 0, y: 1, z: 0 }, left, 1), { x: 0, y: 1, z: 0 });
  assert.deepEqual(v, { x: 10, y: 3, z: 0 }, 'entrada intacta');
});
