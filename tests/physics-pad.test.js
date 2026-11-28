import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PHYSICS, MOVE } from '../shared/constants.js';
import { box, BOX_TYPES as T, validateMap } from '../shared/maps/format.js';
import { sandbox, PAD_TO_HIGH as H } from '../shared/maps/sandbox.js';
import { createPlayer, stepPlayer, emptyInput } from '../shared/physics/player.js';

const DT = PHYSICS.FIXED_DT;
const input = (over = {}) => ({ ...emptyInput(), ...over });
const has = (p, type) => p.events.some((e) => e.type === type);
const floor = box(0, -0.5, 0, 400, 1, 400);
const pad = box(0, 0.1, 0, 3, 0.2, 3, T.PAD); // topo em 0,2 m
const padMap = { id: 't', name: 't', boxes: [floor, pad], spawns: [] };

/** Solta o jogador acima do bloco e roda até a plataforma lançar. */
function dropOn(map, x = 0, z = 0, setup) {
  const p = createPlayer({ x, y: 1.5, z });
  setup?.(p);
  for (let i = 0; i < 2 / DT && !has(p, 'pad'); i++) stepPlayer(p, emptyInput(), map, DT);
  return p;
}

test('pousar na plataforma de salto lança para cima a PAD_SPEED', () => {
  const p = dropOn(padMap);
  assert.ok(has(p, 'pad'));
  assert.equal(p.vel.y, MOVE.PAD_SPEED);
  assert.equal(p.onGround, false);
  let top = 0;
  for (let i = 0; i < 3 / DT; i++) {
    stepPlayer(p, emptyInput(), padMap, DT);
    top = Math.max(top, p.pos.y);
  }
  const expected = 0.2 + (MOVE.PAD_SPEED * MOVE.PAD_SPEED) / (2 * MOVE.GRAVITY);
  assert.ok(Math.abs(top - expected) / expected < 0.02, `subiu até ${top.toFixed(2)} m (esperado ${expected.toFixed(2)})`);
});

test('plataforma sem direção mantém a velocidade horizontal', () => {
  const p = dropOn(padMap, 0, 0, (q) => { q.vel.x = 5; });
  assert.ok(has(p, 'pad'));
  assert.ok(Math.abs(p.vel.x - 5) < 0.5, `vel.x ${p.vel.x}`);
});

test('plataforma com direção (launch) usa exatamente a velocidade do mapa', () => {
  const launch = { x: 3, y: 10, z: -4 };
  const dirPad = box(0, 0.1, 0, 3, 0.2, 3, T.PAD, { launch });
  const p = dropOn({ id: 't', name: 't', boxes: [floor, dirPad], spawns: [] }, 0, 0, (q) => { q.vel.x = -2; });
  assert.deepEqual(p.vel, launch);
  assert.deepEqual(p.events.find((e) => e.type === 'pad').launch, launch);
});

test('recarrega o pulo duplo (e os pulos na parede)', () => {
  const p = dropOn(padMap, 0, 0, (q) => { q.jumpsLeft = 0; q.wallJumpsLeft = 0; });
  assert.equal(p.jumpsLeft, MOVE.AIR_JUMPS);
  assert.equal(p.wallJumpsLeft, MOVE.WALL_JUMP_MAX);
  for (let i = 0; i < 20; i++) stepPlayer(p, emptyInput(), padMap, DT);
  stepPlayer(p, input({ jump: true, jumpPressed: true }), padMap, DT);
  assert.ok(has(p, 'doubleJump'), 'pulo duplo disponível no voo do lançamento');
});

test('entrar andando na plataforma também lança', () => {
  const p = createPlayer({ x: -4, y: 0, z: 0, yaw: -Math.PI / 2 }); // olhando para +x
  let launched = false;
  for (let i = 0; i < 2 / DT && !launched; i++) {
    stepPlayer(p, input({ moveZ: 1, yaw: -Math.PI / 2 }), padMap, DT);
    launched = has(p, 'pad');
  }
  assert.ok(launched);
});

test('Sandbox: a plataforma direcional leva até a plataforma alta (simulação)', () => {
  assert.deepEqual(validateMap(sandbox).errors, []);
  // De vários pontos da plataforma (caindo em cima dela) e chegando andando com W: pousa no alvo.
  const yaw = -Math.PI / 2; // olhando para +x
  const cases = [
    { x: H.pad.x, y: 1, z: H.pad.z, walk: false },
    { x: H.pad.x - 1, y: 1, z: H.pad.z + 1, walk: false },
    { x: H.pad.x + 1, y: 1, z: H.pad.z - 1, walk: false },
    { x: H.pad.x - 5, y: 0, z: H.pad.z, walk: true },
  ];
  for (const c of cases) {
    const p = createPlayer({ x: c.x, y: c.y, z: c.z, yaw });
    let launched = false;
    for (let i = 0; i < 6 / DT; i++) {
      stepPlayer(p, c.walk && !launched ? input({ moveZ: 1, yaw }) : emptyInput(), sandbox, DT);
      if (has(p, 'pad')) launched = true;
      if (launched && p.onGround) break;
    }
    assert.ok(launched, 'lançou');
    assert.ok(Math.abs(p.pos.y - H.target.top) < 1e-9, `pousou na altura ${p.pos.y.toFixed(2)} (alvo ${H.target.top})`);
    const t = H.target;
    const inX = p.pos.x > t.x - t.width / 2 + 0.5 && p.pos.x < t.x + t.width / 2 - 0.5;
    const inZ = p.pos.z > t.z - t.depth / 2 && p.pos.z < t.z + t.depth / 2;
    assert.ok(inX && inZ, `em cima do alvo, com folga: ${p.pos.x.toFixed(2)}, ${p.pos.z.toFixed(2)}`);
  }
});

test('Sandbox: a plataforma vertical continua lá e lança só para cima', () => {
  const vertical = sandbox.boxes.find((b) => b.type === 'pad' && !b.launch);
  assert.ok(vertical);
  const cx = (vertical.min.x + vertical.max.x) / 2;
  const cz = (vertical.min.z + vertical.max.z) / 2;
  const p = dropOn(sandbox, cx, cz);
  assert.equal(p.vel.y, MOVE.PAD_SPEED);
  assert.equal(p.vel.x, 0);
});
