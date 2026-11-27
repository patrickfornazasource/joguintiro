import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MOVE, PHYSICS, PLAYER } from '../shared/constants.js';
import { createPlayer, stepPlayer, emptyInput } from '../shared/physics/player.js';
import { sandbox } from '../shared/maps/sandbox.js';

const DT = PHYSICS.FIXED_DT;
const near = (got, want, tol, msg) =>
  assert.ok(Math.abs(got - want) <= Math.abs(want) * tol, `${msg}: ${got} (esperado ${want} ±${tol * 100}%)`);

/** Roda `seconds` de simulação em passos fixos. */
function run(p, seconds) {
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) stepPlayer(p, emptyInput(), sandbox, DT);
  return p;
}

test('createPlayer nasce no ponto, parado, em pé e com campos reservados', () => {
  const p = createPlayer({ x: 1, y: 2, z: 3, yaw: 0.5 });
  assert.deepEqual(p.pos, { x: 1, y: 2, z: 3 });
  assert.deepEqual(p.vel, { x: 0, y: 0, z: 0 });
  assert.equal(p.yaw, 0.5);
  assert.equal(p.onGround, false);
  assert.equal(p.crouching, false);
  assert.equal(p.height, PLAYER.HEIGHT);
  for (const k of ['jumpsLeft', 'wall', 'dashCharges', 'state']) assert.ok(k in p, k);
});

test('createPlayer não compartilha a posição com o ponto de nascimento', () => {
  const spawn = sandbox.spawns[0];
  const p = createPlayer(spawn);
  run(p, 0.1);
  assert.equal(spawn.y, 0, 'mapa não foi alterado');
});

test('1 s de queda livre bate com a fórmula física (tolerância 2%)', () => {
  const p = run(createPlayer({ x: 0, y: 100, z: 0 }), 1);
  const g = MOVE.GRAVITY;
  near(100 - p.pos.y, 0.5 * g * 1 * 1, 0.02, 'distância caída (½·g·t²)');
  near(-p.vel.y, g * 1, 0.02, 'velocidade (g·t)');
});

test('queda livre também bate em 0,5 s', () => {
  const p = run(createPlayer({ x: 0, y: 100, z: 0 }), 0.5);
  near(100 - p.pos.y, 0.5 * MOVE.GRAVITY * 0.25, 0.02, 'distância em 0,5 s');
});

test('velocidade de queda não passa de MOVE.MAX_FALL_SPEED', () => {
  const p = run(createPlayer({ x: 0, y: 1000, z: 0 }), 5);
  assert.equal(p.vel.y, -MOVE.MAX_FALL_SPEED);
});

test('pulo para cima sobe e desce de volta (lançamento vertical)', () => {
  const p = createPlayer({ x: 0, y: 0, z: 0 });
  p.vel.y = 12; // sobe até ~3 m e volta em 2·v/g = 1 s
  run(p, 2 * 12 / MOVE.GRAVITY);
  near(p.vel.y, -12, 0.02, 'volta com a mesma velocidade');
  assert.ok(Math.abs(p.pos.y) < 0.2, `volta perto da altura inicial: ${p.pos.y}`);
});

test('velocidade horizontal move o jogador e não muda sozinha (sem atrito ainda)', () => {
  const p = createPlayer({ x: 0, y: 50, z: 0 });
  p.vel.x = 3;
  p.vel.z = -2;
  run(p, 1);
  near(p.pos.x, 3, 0.02, 'x');
  near(p.pos.z, -2, 0.02, 'z');
  assert.equal(p.vel.x, 3);
});

test('no chão (onGround) a gravidade não acumula', () => {
  const p = createPlayer({ x: 0, y: 0, z: 0 });
  p.onGround = true;
  run(p, 1);
  assert.equal(p.vel.y, 0);
  assert.equal(p.pos.y, 0);
});

test('mesmo resultado sempre (determinístico, para cliente e servidor)', () => {
  const a = run(createPlayer({ x: 0, y: 30, z: 0 }), 1.3);
  const b = run(createPlayer({ x: 0, y: 30, z: 0 }), 1.3);
  assert.deepEqual(a, b);
});

test('emptyInput tem todos os campos documentados', () => {
  assert.deepEqual(Object.keys(emptyInput()).sort(), [
    'crouch', 'crouchPressed', 'dashPressed', 'jump', 'jumpPressed', 'moveX', 'moveZ', 'pitch', 'yaw',
  ]);
});
