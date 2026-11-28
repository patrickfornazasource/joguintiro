import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PHYSICS, MOVE } from '../shared/constants.js';
import { box } from '../shared/maps/format.js';
import { airAccelerate } from '../shared/physics/move.js';
import { createPlayer, stepPlayer, emptyInput } from '../shared/physics/player.js';

const DT = PHYSICS.FIXED_DT;
const floorMap = { id: 't', name: 't', boxes: [box(0, -0.5, 0, 100000, 1, 100000)], spawns: [] };
const input = (over = {}) => ({ ...emptyInput(), ...over });
const speedOf = (p) => Math.hypot(p.vel.x, p.vel.z);

/** Jogador no chão andando a `speed` m/s em -z (olhando para -z, yaw 0). */
function runner(speed) {
  const p = createPlayer({ x: 0, y: 0, z: 0 });
  stepPlayer(p, emptyInput(), floorMap, DT);
  p.vel.z = -speed;
  return p;
}

/** Roda até completar `jumps` pulos segurando Espaço; `choose(p)` dá a entrada de cada passo. */
function bhop(p, jumps, choose) {
  let count = 0;
  let maxSpeed = speedOf(p);
  for (let i = 0; i < 60 / DT && count < jumps; i++) {
    stepPlayer(p, { ...choose(p), jump: true, jumpPressed: i === 0 }, floorMap, DT);
    count += p.events.filter((e) => e.type === 'jump').length;
    maxSpeed = Math.max(maxSpeed, speedOf(p));
  }
  // termina o último pulo até pousar
  for (let i = 0; i < 2 / DT && !p.onGround; i++) {
    stepPlayer(p, choose(p), floorMap, DT);
    maxSpeed = Math.max(maxSpeed, speedOf(p));
  }
  return { count, maxSpeed };
}

test('segurando só W no ar, a velocidade não passa de WALK_SPEED', () => {
  const p = runner(MOVE.WALK_SPEED);
  const { count, maxSpeed } = bhop(p, 10, () => input({ moveZ: 1, yaw: 0 }));
  assert.equal(count, 10);
  assert.ok(maxSpeed <= MOVE.WALK_SPEED + 1e-9, `máximo ${maxSpeed}`);
});

test('parado no ar, segurando W, chega só até o teto do ar (AIR_WISH_CAP)', () => {
  const p = createPlayer({ x: 0, y: 100, z: 0 });
  for (let i = 0; i < 1 / DT; i++) stepPlayer(p, input({ moveZ: 1, yaw: 0 }), floorMap, DT);
  assert.ok(Math.abs(speedOf(p) - MOVE.AIR_WISH_CAP) < 1e-9, `velocidade ${speedOf(p)}`);
});

/**
 * Estratégia ideal simulada: a cada passo, strafe (D segurado) com o olhar girado para que
 * a direção desejada faça com a velocidade o ângulo que mais soma (técnica clássica):
 * a parte da velocidade nessa direção fica em AIR_WISH_CAP menos o ganho do passo.
 */
function optimalStrafe(p) {
  const s = speedOf(p);
  if (s < 1e-6) return input({ moveZ: 1, yaw: 0 });
  const gain = MOVE.AIR_ACCEL * MOVE.WALK_SPEED * DT;
  const cos = Math.max(-1, Math.min(1, (MOVE.AIR_WISH_CAP - gain) / s));
  const theta = Math.acos(cos);
  const vx = p.vel.x / s;
  const vz = p.vel.z / s;
  // gira a direção da velocidade por theta (sempre para o mesmo lado)
  const dx = vx * Math.cos(theta) - vz * Math.sin(theta);
  const dz = vx * Math.sin(theta) + vz * Math.cos(theta);
  // D (moveX = 1) aponta para "direita" = (cos yaw, -sin yaw): escolher o yaw que leva até (dx, dz).
  const yaw = Math.atan2(-dz, dx);
  return input({ moveX: 1, yaw });
}

test('estratégia ideal: 10 pulos começando a 9 m/s passam de 14 m/s', () => {
  const p = runner(MOVE.WALK_SPEED);
  const { count } = bhop(p, 10, optimalStrafe);
  assert.equal(count, 10);
  assert.ok(speedOf(p) > 14, `velocidade final ${speedOf(p).toFixed(2)} m/s`);
});

test('sem tecla no ar, a velocidade não muda', () => {
  const p = createPlayer({ x: 0, y: 100, z: 0 });
  p.vel.x = 7;
  p.vel.z = -3;
  for (let i = 0; i < 60; i++) stepPlayer(p, emptyInput(), floorMap, DT);
  assert.equal(p.vel.x, 7);
  assert.equal(p.vel.z, -3);
});

test('airAccelerate: soma no máximo o teto na direção, não altera a entrada', () => {
  const dir = { x: 1, y: 0, z: 0 };
  const v = { x: 0, y: -2, z: -9 };
  const a = airAccelerate(v, dir, 9, 12, 1.2, DT);
  assert.ok(Math.abs(a.x - Math.min(12 * 9 * DT, 1.2)) < 1e-12, `x ${a.x}`);
  assert.equal(a.z, -9);
  assert.equal(a.y, -2);
  assert.deepEqual(v, { x: 0, y: -2, z: -9 }, 'entrada intacta');
  const atCap = airAccelerate({ x: 1.2, y: 0, z: 0 }, dir, 9, 12, 1.2, DT);
  assert.equal(atCap.x, 1.2, 'já no teto: não soma');
  const ahead = airAccelerate({ x: 0, y: 0, z: -9 }, { x: 0, y: 0, z: -1 }, 9, 12, 1.2, DT);
  assert.equal(ahead.z, -9, 'para frente, já mais rápido que o teto: não soma');
});
