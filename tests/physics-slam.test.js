import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PHYSICS, MOVE, VIEW } from '../shared/constants.js';
import { box, BOX_TYPES as T } from '../shared/maps/format.js';
import { createPlayer, stepPlayer, emptyInput } from '../shared/physics/player.js';
import { createLocalPlayer, slamShakeAmplitude } from '../src/player/localPlayer.js';

const DT = PHYSICS.FIXED_DT;
const floorMap = { id: 't', name: 't', boxes: [box(0, -0.5, 0, 400, 1, 400)], spawns: [{ x: 0, y: 0, z: 0, yaw: 0 }] };
const input = (over = {}) => ({ ...emptyInput(), ...over });
const has = (p, type) => p.events.some((e) => e.type === type);
const event = (p, type) => p.events.find((e) => e.type === type);

/** Tempo (s) até tocar o chão caindo de `h` m, com ou sem slam. */
function fallTime(h, slam) {
  const p = createPlayer({ x: 0, y: h, z: 0 });
  let t = 0;
  stepPlayer(p, input(slam ? { crouch: true, crouchPressed: true } : {}), floorMap, DT);
  t += DT;
  while (!p.onGround && t < 5) {
    stepPlayer(p, input(slam ? { crouch: true } : {}), floorMap, DT);
    t += DT;
  }
  return t;
}

/** Faz um slam de `h` m e devolve o jogador no passo em que bateu. */
function slamFrom(h, setup) {
  const p = createPlayer({ x: 0, y: h, z: 0 });
  setup?.(p);
  stepPlayer(p, input({ crouch: true, crouchPressed: true }), floorMap, DT);
  while (!p.onGround) stepPlayer(p, input({ crouch: true }), floorMap, DT);
  return p;
}

/** Altura máxima de um pulo dado agora (Espaço), até pousar. */
function jumpHeight(p) {
  const y0 = p.pos.y;
  stepPlayer(p, input({ jump: true, jumpPressed: true }), floorMap, DT);
  const evt = p.events.map((e) => e.type);
  let top = p.pos.y;
  for (let i = 0; i < 5 / DT && !p.onGround; i++) {
    stepPlayer(p, emptyInput(), floorMap, DT);
    top = Math.max(top, p.pos.y);
  }
  return { height: top - y0, events: evt };
}

test('slam de 10 m chega ao chão mais rápido que a queda livre', () => {
  const free = fallTime(10, false);
  const slam = fallTime(10, true);
  assert.ok(slam < free, `slam ${slam.toFixed(3)} s, queda livre ${free.toFixed(3)} s`);
  assert.ok(Math.abs(slam - 10 / MOVE.SLAM_SPEED) < 3 * DT, `slam a ${MOVE.SLAM_SPEED} m/s: ${slam.toFixed(3)} s`);
});

test('slam: despenca em linha reta (zera a velocidade horizontal) e muda o estado', () => {
  const p = createPlayer({ x: 0, y: 10, z: 0 });
  p.vel = { x: 8, y: 3, z: -5 };
  stepPlayer(p, input({ crouch: true, crouchPressed: true }), floorMap, DT);
  assert.ok(has(p, 'slamStart'));
  assert.equal(p.state, 'slam');
  assert.equal(p.vel.x, 0);
  assert.equal(p.vel.z, 0);
  assert.equal(p.vel.y, -MOVE.SLAM_SPEED);
  const x = p.pos.x;
  for (let i = 0; i < 5; i++) stepPlayer(p, input({ moveX: 1, crouch: true }), floorMap, DT);
  assert.equal(p.pos.x, x, 'sem controle no ar durante o slam');
});

test('ao bater: evento slamLand com a altura da queda e janela do pulo aberta', () => {
  const p = slamFrom(10);
  const land = event(p, 'slamLand');
  assert.ok(land);
  assert.ok(Math.abs(land.height - 10) < 1e-6, `altura ${land.height}`);
  assert.equal(p.slamJumpWindow, MOVE.SLAM_JUMP_WINDOW);
  assert.notEqual(p.state, 'slam');
});

test('pulo de slam depois de 10 m é mais alto que o pulo normal', () => {
  const normal = jumpHeight((() => {
    const q = createPlayer({ x: 0, y: 0, z: 0 });
    stepPlayer(q, emptyInput(), floorMap, DT);
    return q;
  })());
  const slam = jumpHeight(slamFrom(10));
  assert.deepEqual(slam.events, ['slamJump']);
  const v = Math.min(MOVE.SLAM_JUMP_BASE + 10 * MOVE.SLAM_JUMP_PER_METER, MOVE.SLAM_JUMP_MAX);
  const expected = (v * v) / (2 * MOVE.GRAVITY);
  assert.ok(Math.abs(slam.height - expected) / expected < 0.02, `pulo de slam ${slam.height.toFixed(2)} m (esperado ${expected.toFixed(2)})`);
  assert.ok(slam.height > normal.height + 1, `slam ${slam.height.toFixed(2)} m contra normal ${normal.height.toFixed(2)} m`);
});

test('fora da janela, vira pulo normal', () => {
  const p = slamFrom(10);
  for (let i = 0; i < (MOVE.SLAM_JUMP_WINDOW + 0.05) / DT; i++) stepPlayer(p, emptyInput(), floorMap, DT);
  const r = jumpHeight(p);
  assert.deepEqual(r.events, ['jump']);
  const normal = (MOVE.JUMP_SPEED * MOVE.JUMP_SPEED) / (2 * MOVE.GRAVITY);
  assert.ok(Math.abs(r.height - normal) / normal < 0.02, `altura ${r.height.toFixed(2)} m`);
});

test('pulo de slam: quanto maior a queda, mais alto, até SLAM_JUMP_MAX', () => {
  const speedFor = (h) => {
    const p = slamFrom(h);
    stepPlayer(p, input({ jump: true, jumpPressed: true }), floorMap, DT);
    return p.vel.y + MOVE.GRAVITY * DT; // velocidade logo após o pulo (antes da gravidade do passo)
  };
  const a = speedFor(3);
  const b = speedFor(15);
  const c = speedFor(80);
  assert.ok(b > a, `${a} < ${b}`);
  assert.ok(Math.abs(c - MOVE.SLAM_JUMP_MAX) < 1e-6, `limite: ${c}`);
});

test('segurar Espaço ao bater (ou apertar logo antes) também faz o pulo de slam', () => {
  const p = createPlayer({ x: 0, y: 10, z: 0 });
  stepPlayer(p, input({ crouch: true, crouchPressed: true }), floorMap, DT);
  while (!p.onGround) stepPlayer(p, input({ crouch: true, jump: true }), floorMap, DT); // segurando Espaço
  stepPlayer(p, input({ jump: true }), floorMap, DT);
  assert.ok(has(p, 'slamJump'));
});

test('não faz slam no chão nem correndo na parede; no slam não há pulo duplo', () => {
  const g = createPlayer({ x: 0, y: 0, z: 0 });
  stepPlayer(g, emptyInput(), floorMap, DT);
  stepPlayer(g, input({ crouch: true, crouchPressed: true }), floorMap, DT);
  assert.equal(g.slam, null, 'no chão, C só agacha');

  const run = box(2.25, 0, 0, 0.5, 60, 400, T.WALLRUN);
  const map = { id: 't', name: 't', boxes: [box(0, -60.5, 0, 400, 1, 400), run], spawns: [] };
  const w = createPlayer({ x: 2 - 0.35 - 0.3, y: 10, z: 0, yaw: 0 });
  w.vel = { x: 2, y: 0, z: -10 };
  for (let i = 0; i < 30 && !w.wallrun; i++) stepPlayer(w, input({ moveZ: 1, yaw: 0 }), map, DT);
  assert.ok(w.wallrun);
  stepPlayer(w, input({ moveZ: 1, yaw: 0, crouch: true, crouchPressed: true }), map, DT);
  assert.equal(w.slam, null, 'correndo na parede, C não faz slam');

  const s = createPlayer({ x: 0, y: 20, z: 0 });
  s.jumpsLeft = 1;
  stepPlayer(s, input({ crouch: true, crouchPressed: true }), floorMap, DT);
  stepPlayer(s, input({ crouch: true, jump: true, jumpPressed: true }), floorMap, DT);
  assert.equal(has(s, 'doubleJump'), false);
  assert.equal(s.state, 'slam');
});

test('câmera: treme ao bater o slam, proporcional à queda, e para depois de SLAM_SHAKE_TIME', () => {
  assert.ok(Math.abs(slamShakeAmplitude(10) - VIEW.SLAM_SHAKE) < 1e-12);
  assert.ok(slamShakeAmplitude(2) < slamShakeAmplitude(10));
  assert.equal(slamShakeAmplitude(40), VIEW.SLAM_SHAKE);
  const map = { ...floorMap, spawns: [{ x: 0, y: 10, z: 0, yaw: 0 }] };
  const me = createLocalPlayer({ map });
  const keys = (...held) => ({ isDown: (a) => held.includes(a), pressed: (a) => held.includes(a) });
  me.step(keys('crouch'), DT);
  let landed = false;
  for (let i = 0; i < 2 / DT && !landed; i++) {
    me.step(keys(), DT);
    landed = me.player.events.some((e) => e.type === 'slamLand');
  }
  assert.ok(landed);
  me.eye(1, 0.01);
  const o = me.shakeOffset;
  assert.ok(Math.hypot(o.x, o.y, o.z) > 0, 'tremendo logo depois');
  me.eye(1, VIEW.SLAM_SHAKE_TIME);
  const after = me.shakeOffset;
  assert.deepEqual(after, { x: 0, y: 0, z: 0 }, 'parou');
});
