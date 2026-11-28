import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PHYSICS, MOVE } from '../shared/constants.js';
import { box, BOX_TYPES as T } from '../shared/maps/format.js';
import { createPlayer, stepPlayer, emptyInput, capHorizontalSpeed } from '../shared/physics/player.js';

const DT = PHYSICS.FIXED_DT;
const input = (over = {}) => ({ ...emptyInput(), ...over });
const speedXZ = (p) => Math.hypot(p.vel.x, p.vel.z);
const floor = box(0, -0.5, 0, 100000, 1, 100000);
const floorMap = { id: 't', name: 't', boxes: [floor], spawns: [] };
const sky = { id: 't', name: 't', boxes: [box(0, -5000.5, 0, 100000, 1, 100000)], spawns: [] };

test('o limite absoluto é MOVE.MAX_SPEED = 45 m/s (pedido pela ficha F1-18)', () => {
  assert.equal(MOVE.MAX_SPEED, 45);
});

test('velocidade horizontal acima do limite é cortada no passo, mantendo a direção', () => {
  const p = createPlayer({ x: 0, y: 100, z: 0 });
  p.vel = { x: 60, y: 0, z: -80 }; // 100 m/s
  stepPlayer(p, emptyInput(), sky, DT);
  assert.ok(Math.abs(speedXZ(p) - MOVE.MAX_SPEED) < 1e-9, `${speedXZ(p)}`);
  assert.ok(Math.abs(p.vel.x / p.vel.z - 60 / -80) < 1e-9, 'mesma direção');
});

test('o limite não mexe na queda (ela tem MAX_FALL_SPEED)', () => {
  const p = createPlayer({ x: 0, y: 1000, z: 0 });
  p.vel = { x: 45, y: 0, z: 0 };
  for (let i = 0; i < 4 / DT; i++) stepPlayer(p, emptyInput(), sky, DT);
  assert.equal(p.vel.y, -MOVE.MAX_FALL_SPEED);
  assert.ok(Math.abs(speedXZ(p) - 45) < 1e-9);
});

test('capHorizontalSpeed: abaixo do limite não muda nada', () => {
  const p = { vel: { x: 3, y: -7, z: 4 } };
  capHorizontalSpeed(p);
  assert.deepEqual(p.vel, { x: 3, y: -7, z: 4 });
});

test('air strafe ideal por muito tempo não passa de 45 m/s', () => {
  const p = createPlayer({ x: 0, y: 0, z: 0 });
  stepPlayer(p, emptyInput(), floorMap, DT);
  p.vel.z = -9;
  let max = 0;
  for (let i = 0; i < 40 / DT; i++) {
    const s = speedXZ(p);
    const gain = MOVE.AIR_ACCEL * MOVE.WALK_SPEED * DT;
    const th = Math.acos(Math.max(-1, Math.min(1, (MOVE.AIR_WISH_CAP - gain) / s)));
    const vx = p.vel.x / s;
    const vz = p.vel.z / s;
    const dx = vx * Math.cos(th) - vz * Math.sin(th);
    const dz = vx * Math.sin(th) + vz * Math.cos(th);
    stepPlayer(p, input({ moveX: 1, yaw: Math.atan2(-dz, dx), jump: true, jumpPressed: i === 0 }), floorMap, DT);
    max = Math.max(max, speedXZ(p));
  }
  assert.ok(max <= MOVE.MAX_SPEED + 1e-9, `máximo ${max}`);
  assert.ok(max > MOVE.MAX_SPEED - 1, 'chega ao limite');
});

test('deslize + pulo emendados por muito tempo não passam de 45 m/s', () => {
  const p = createPlayer({ x: 0, y: 0, z: 0, yaw: 0 });
  stepPlayer(p, emptyInput(), floorMap, DT);
  p.vel.z = -9;
  let max = 0;
  for (let i = 0; i < 60 / DT; i++) {
    // No chão: aperta agachar (deslize com impulso) e logo pula; no ar, segura W.
    const crouchNow = p.onGround && !p.sliding;
    const jumpNow = p.sliding;
    stepPlayer(p, input({ moveZ: 1, yaw: 0, crouch: crouchNow || p.sliding, crouchPressed: crouchNow, jump: jumpNow, jumpPressed: jumpNow }), floorMap, DT);
    max = Math.max(max, speedXZ(p));
  }
  assert.ok(max <= MOVE.MAX_SPEED + 1e-9, `máximo ${max}`);
});

test('dash, plataforma de salto e corrimão respeitam o limite', () => {
  const p = createPlayer({ x: 0, y: 100, z: 0 });
  p.vel = { x: 44, y: 0, z: 0 };
  stepPlayer(p, input({ dashPressed: true, moveX: 1, yaw: 0 }), sky, DT);
  for (let i = 0; i < 30; i++) stepPlayer(p, emptyInput(), sky, DT);
  assert.ok(speedXZ(p) <= MOVE.MAX_SPEED + 1e-9, `dash: ${speedXZ(p)}`);
  const pad = box(0, 0.1, 0, 3, 0.2, 3, T.PAD, { launch: { x: 80, y: 10, z: 0 } });
  const q = createPlayer({ x: 0, y: 1.5, z: 0 });
  const m = { id: 't', name: 't', boxes: [floor, pad], spawns: [] };
  for (let i = 0; i < 60; i++) stepPlayer(q, emptyInput(), m, DT);
  assert.ok(speedXZ(q) <= MOVE.MAX_SPEED + 1e-9, `plataforma: ${speedXZ(q)}`);
  assert.ok(MOVE.RAIL_MAX_SPEED <= MOVE.MAX_SPEED, 'o corrimão tem limite próprio menor');
});
