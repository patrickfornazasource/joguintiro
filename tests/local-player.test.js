import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PHYSICS, PLAYER, MOVE, VIEW } from '../shared/constants.js';
import { box } from '../shared/maps/format.js';
import { sandbox } from '../shared/maps/sandbox.js';
import { wishDir, forwardOf, rightOf } from '../shared/physics/move.js';
import {
  createLocalPlayer, buildInput, clampPitch, resolveSensitivity, SENS_STORAGE_KEY,
} from '../src/player/localPlayer.js';

const DT = PHYSICS.FIXED_DT;

/** Teclado falso: as ações em `held` estão seguradas. */
const keys = (...held) => ({ isDown: (a) => held.includes(a), pressed: () => false });

function walk(me, k, seconds) {
  for (let i = 0; i < Math.round(seconds / DT); i++) me.step(k, DT);
}

test('direções: yaw 0 olha para -z; direita é +x', () => {
  const f = forwardOf(0);
  const r = rightOf(0);
  assert.ok(Math.abs(f.x) < 1e-12 && f.z === -1);
  assert.ok(r.x === 1 && Math.abs(r.z) < 1e-12);
});

test('wishDir: diagonal não fica mais rápida', () => {
  const d = wishDir({ moveX: 1, moveZ: 1, yaw: 0 });
  assert.ok(Math.abs(Math.hypot(d.x, d.z) - 1) < 1e-12);
  assert.deepEqual(wishDir({ moveX: 0, moveZ: 0, yaw: 1 }), { x: 0, y: 0, z: 0 });
});

test('buildInput: W/S/A/D viram moveZ/moveX', () => {
  assert.equal(buildInput(keys('forward'), 0, 0).moveZ, 1);
  assert.equal(buildInput(keys('back'), 0, 0).moveZ, -1);
  assert.equal(buildInput(keys('forward', 'back'), 0, 0).moveZ, 0);
  assert.equal(buildInput(keys('right'), 0, 0).moveX, 1);
  assert.equal(buildInput(keys('left'), 0, 0).moveX, -1);
});

test('andar para frente no Sandbox: chega a 9 m/s em -z, no chão', () => {
  // Desde a F1-06 a física acelera até a velocidade (antes era 9 m/s na hora).
  const me = createLocalPlayer({ map: sandbox }); // nasce em (0, 0, 20) olhando para -z
  walk(me, keys(), 0.1);
  const z0 = me.player.pos.z;
  walk(me, keys('forward'), 1);
  const walked = z0 - me.player.pos.z;
  assert.ok(walked > 8 && walked < MOVE.WALK_SPEED, `andou ${walked} m`);
  assert.ok(Math.abs(me.player.vel.z + MOVE.WALK_SPEED) < 1e-9, `velocidade ${me.player.vel.z}`);
  assert.ok(Math.abs(me.player.vel.x) < 1e-9);
  assert.equal(me.player.onGround, true);
  assert.equal(me.player.pos.y, 0);
});

test('soltar as teclas: para em menos de 0,35 s (atrito da F1-06)', () => {
  const me = createLocalPlayer({ map: sandbox });
  walk(me, keys('forward'), 0.5);
  walk(me, keys(), 0.35);
  assert.equal(Math.hypot(me.player.vel.x, me.player.vel.z), 0);
});

test('girar o mouse muda a direção de andar', () => {
  const me = createLocalPlayer({ map: sandbox, sensitivity: VIEW.MOUSE_SENSITIVITY });
  me.look(-(Math.PI / 2) / VIEW.MOUSE_SENSITIVITY, 0); // 90° para a esquerda: frente vira -x
  walk(me, keys(), 0.05);
  const x0 = me.player.pos.x;
  walk(me, keys('forward'), 1);
  assert.ok(me.player.pos.x < x0 - 8, `foi para -x: ${me.player.pos.x}`);
});

test('pitch limitado a ±89°', () => {
  const me = createLocalPlayer({ map: sandbox });
  me.look(0, -1e6); // muito para cima
  assert.equal(me.pitch, VIEW.MAX_PITCH);
  me.look(0, 1e7);
  assert.equal(me.pitch, -VIEW.MAX_PITCH);
  assert.ok(Math.abs(VIEW.MAX_PITCH - (89 * Math.PI) / 180) < 1e-12);
  assert.equal(clampPitch(0.1), 0.1);
});

test('subir a escada do Sandbox andando', () => {
  // Escada: x = -6, de z = 6 subindo em +z até o patamar (1,5 m). Andar "para trás" = +z.
  const map = { ...sandbox, spawns: [{ x: -6, y: 0, z: 3, yaw: 0 }] };
  const me = createLocalPlayer({ map });
  walk(me, keys('back'), 0.9); // 9 m/s: chega ao patamar (z de 9 a 13) sem passar do fim
  assert.ok(Math.abs(me.player.pos.y - 1.5) < 1e-9, `y = ${me.player.pos.y}, z = ${me.player.pos.z}`);
});

test('não atravessa a parede externa', () => {
  const me = createLocalPlayer({ map: sandbox });
  walk(me, keys('back'), 3); // de z = 20 para +z, parede em z = 29
  assert.ok(Math.abs(me.player.pos.z - (29 - PLAYER.RADIUS)) < 1e-9, `z = ${me.player.pos.z}`);
});

test('cair do mapa: renasce no ponto de nascimento', () => {
  const map = { id: 't', name: 't', boxes: [box(0, -0.5, 0, 4, 1, 4)], spawns: [{ x: 0, y: 0, z: 0, yaw: 0.3 }] };
  const me = createLocalPlayer({ map });
  // Anda até sair da plataforma e cair; para no primeiro renascimento.
  for (let i = 0; i < 5 / DT && me.respawns === 0; i++) me.step(keys('forward'), DT);
  assert.equal(me.respawns, 1);
  assert.deepEqual(me.player.pos, { x: 0, y: 0, z: 0 });
  assert.deepEqual(me.player.vel, { x: 0, y: 0, z: 0 });
  assert.equal(me.yaw, 0.3);
});

test('olho: altura dos olhos e interpolação entre passos', () => {
  const me = createLocalPlayer({ map: sandbox });
  walk(me, keys(), 0.1);
  walk(me, keys('forward'), DT);
  const p = me.player;
  const a = me.eye(0, 0);
  const b = me.eye(1, 0);
  assert.ok(Math.abs(b.y - (p.pos.y + PLAYER.EYE_HEIGHT)) < 1e-9);
  assert.ok(Math.abs(b.z - p.pos.z) < 1e-12);
  assert.ok(p.vel.z < 0, 'começou a andar');
  assert.ok(Math.abs(a.z - (p.pos.z - p.vel.z * DT)) < 1e-9, 'alpha 0 = posição do passo anterior');
});

test('sensibilidade: ?sens= vale e é salva; inválida cai na salva ou na padrão', () => {
  const data = new Map();
  const storage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
  assert.equal(resolveSensitivity('', storage), VIEW.MOUSE_SENSITIVITY);
  assert.equal(resolveSensitivity('?sens=0.003', storage), 0.003);
  assert.equal(data.get(SENS_STORAGE_KEY), '0.003');
  assert.equal(resolveSensitivity('', storage), 0.003, 'lembra');
  assert.equal(resolveSensitivity('?sens=abc', storage), 0.003);
  assert.equal(resolveSensitivity('?sens=-1', null), VIEW.MOUSE_SENSITIVITY);
  const broken = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
  assert.equal(resolveSensitivity('?sens=0.004', broken), 0.004);
  assert.equal(resolveSensitivity('', broken), VIEW.MOUSE_SENSITIVITY);
});
