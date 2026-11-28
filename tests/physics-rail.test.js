import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PHYSICS, MOVE } from '../shared/constants.js';
import { box, rail, railSegment, validateMap, BOX_TYPES as T } from '../shared/maps/format.js';
import { sandbox, STAIR_RAIL } from '../shared/maps/sandbox.js';
import { createPlayer, stepPlayer, emptyInput } from '../shared/physics/player.js';
import { searchEscapes } from './helpers/escape-search.js';

const DT = PHYSICS.FIXED_DT;
const input = (over = {}) => ({ ...emptyInput(), ...over });
const has = (p, type) => p.events.some((e) => e.type === type);
const reasonOf = (p) => p.events.find((e) => e.type === 'railEnd').reason;
const speed = (p) => Math.hypot(p.vel.x, p.vel.y, p.vel.z);
const floor = box(0, -0.5, 0, 400, 1, 400);
// Trilho descendo em -z: de (0, 6, 10) até (0, 1, -10) (inclinação de cerca de 14 graus).
const slope = rail({ x: 0, y: 6, z: 10 }, { x: 0, y: 1, z: -10 });
const map = { id: 't', name: 't', boxes: [floor, slope], spawns: [] };

/** Solta o jogador perto do trilho com a velocidade `vel` e roda até grudar (ou desistir). */
function dropOnRail(vel, m = map, at = { x: 0, y: 6.3, z: 9 }) {
  const p = createPlayer(at);
  p.vel = { ...vel };
  for (let i = 0; i < 30 && !p.rail; i++) stepPlayer(p, emptyInput(), m, DT);
  return p;
}

test('descer o corrimão termina mais rápido que entrou', () => {
  const p = dropOnRail({ x: 0, y: 0, z: -6 });
  assert.ok(p.rail, 'grudou');
  const entry = speed(p);
  let ended = false;
  for (let i = 0; i < 5 / DT && !ended; i++) {
    stepPlayer(p, emptyInput(), map, DT);
    ended = has(p, 'railEnd');
  }
  assert.ok(ended, 'chegou ao fim');
  assert.equal(reasonOf(p), 'end');
  assert.ok(speed(p) > entry + 3, `entrou a ${entry.toFixed(1)} m/s, saiu a ${speed(p).toFixed(1)} m/s`);
});

test('pular sai do trilho, para cima com RAIL_EXIT_UP', () => {
  const p = dropOnRail({ x: 0, y: 0, z: -6 });
  for (let i = 0; i < 10; i++) stepPlayer(p, emptyInput(), map, DT);
  const along = Math.hypot(p.vel.x, p.vel.z);
  stepPlayer(p, input({ jump: true, jumpPressed: true }), map, DT);
  assert.equal(p.rail, null);
  assert.equal(reasonOf(p), 'jump');
  assert.ok(Math.abs(p.vel.y - (MOVE.RAIL_EXIT_UP - MOVE.GRAVITY * DT)) < 1e-9, `para cima: ${p.vel.y}`);
  assert.ok(Math.abs(Math.hypot(p.vel.x, p.vel.z) - along) < 1e-9, 'mantém a velocidade na horizontal');
  assert.equal(has(p, 'doubleJump'), false, 'o mesmo aperto não vira pulo duplo');
});

test('agachar de novo solta do trilho', () => {
  const p = dropOnRail({ x: 0, y: 0, z: -6 });
  stepPlayer(p, input({ crouch: true, crouchPressed: true }), map, DT);
  assert.equal(p.rail, null);
  assert.equal(reasonOf(p), 'crouch');
});

test('no trilho: os pés ficam no segmento e o estado é "rail"', () => {
  const p = dropOnRail({ x: 0, y: 0, z: -6 });
  const seg = railSegment(slope);
  for (let i = 0; i < 60; i++) {
    stepPlayer(p, emptyInput(), map, DT);
    if (!p.rail) break;
    assert.equal(p.state, 'rail');
    const k = (p.pos.z - seg.from.z) / (seg.to.z - seg.from.z);
    assert.ok(Math.abs(p.pos.x) < 1e-9);
    assert.ok(Math.abs(p.pos.y - (seg.from.y + k * (seg.to.y - seg.from.y))) < 1e-9);
  }
});

test('subindo o trilho freia e volta descendo', () => {
  const q = dropOnRail({ x: 0, y: 0, z: 4 }, map, { x: 0, y: 1.3, z: -9 }); // entra embaixo, subindo
  assert.ok(q.rail, 'grudou subindo');
  let reversed = false;
  for (let i = 0; i < 4 / DT && q.rail; i++) {
    stepPlayer(q, emptyInput(), map, DT);
    if (q.vel.z < 0) reversed = true;
  }
  assert.ok(reversed, 'perdeu velocidade subindo e voltou a descer');
});

test('velocidade no trilho não passa de RAIL_MAX_SPEED', () => {
  const steep = rail({ x: 0, y: 80, z: 40 }, { x: 0, y: 1, z: -40 });
  const m = { id: 't', name: 't', boxes: [floor, steep], spawns: [] };
  const p = dropOnRail({ x: 0, y: 0, z: -10 }, m, { x: 0, y: 79.3, z: 39 }); // logo acima do trilho
  assert.ok(p.rail);
  let max = 0;
  for (let i = 0; i < 10 / DT && p.rail; i++) {
    stepPlayer(p, emptyInput(), m, DT);
    if (p.rail) max = Math.max(max, speed(p)); // só no trilho (ao sair, a gravidade volta)
  }
  assert.ok(max <= MOVE.RAIL_MAX_SPEED + 1e-9, `máximo ${max}`);
  assert.ok(max > MOVE.RAIL_MAX_SPEED - 0.5, 'chegou perto do máximo');
});

test('entrar: precisa de velocidade a favor do trilho e vir de cima', () => {
  // Devagar: trilho horizontal (a queda não soma a favor do trilho), abaixo de RAIL_MIN_SPEED.
  const flat = rail({ x: 0, y: 3, z: 5 }, { x: 0, y: 3, z: -5 });
  const flatMap = { id: 't', name: 't', boxes: [floor, flat], spawns: [] };
  assert.equal(dropOnRail({ x: 0, y: 0, z: -(MOVE.RAIL_MIN_SPEED - 1) }, flatMap, { x: 0, y: 3.05, z: 3 }).rail, null, 'devagar');
  assert.ok(dropOnRail({ x: 0, y: 0, z: -(MOVE.RAIL_MIN_SPEED + 1) }, flatMap, { x: 0, y: 3.05, z: 3 }).rail, 'rápido o bastante');
  assert.equal(dropOnRail({ x: -6, y: 0, z: 0 }, map, { x: 0.5, y: 6.3, z: 9 }).rail, null, 'atravessando de lado');
  const below = createPlayer({ x: 0, y: 4.5, z: 8 });
  below.vel = { x: 0, y: 6, z: -6 };
  for (let i = 0; i < 6; i++) stepPlayer(below, emptyInput(), map, DT);
  assert.equal(below.rail, null, 'vindo por baixo');
});

test('trilho baixo: andando no chão não gruda; deslizando gruda (e o deslize vira trilho)', () => {
  const low = rail({ x: 0, y: 0.3, z: 0 }, { x: 0, y: 0.3, z: -10 });
  const m = { id: 't', name: 't', boxes: [floor, low], spawns: [] };
  const walker = createPlayer({ x: 0, y: 0, z: 2, yaw: 0 });
  stepPlayer(walker, emptyInput(), m, DT);
  for (let i = 0; i < 60; i++) stepPlayer(walker, input({ moveZ: 1, yaw: 0 }), m, DT);
  assert.equal(walker.rail, null, 'andando');
  const slider = createPlayer({ x: 0, y: 0, z: 2, yaw: 0 });
  stepPlayer(slider, emptyInput(), m, DT);
  slider.vel.z = -10;
  stepPlayer(slider, input({ crouch: true, crouchPressed: true }), m, DT);
  for (let i = 0; i < 60 && !slider.rail; i++) stepPlayer(slider, input({ crouch: true }), m, DT);
  assert.ok(slider.rail, 'deslizando');
  assert.equal(slider.sliding, false);
});

test('não gruda de novo no mesmo trilho logo depois de pular dele', () => {
  const p = dropOnRail({ x: 0, y: 0, z: -6 });
  stepPlayer(p, input({ jump: true, jumpPressed: true }), map, DT);
  let again = false;
  for (let i = 0; i < MOVE.RAIL_REATTACH_DELAY / DT - 2; i++) {
    stepPlayer(p, emptyInput(), map, DT);
    if (p.rail) again = true;
  }
  assert.equal(again, false);
});

test('corrimão não barra o corpo (dá para atravessar andando)', () => {
  const bar = box(0, 1, -3, 10, 0.15, 0.15, T.RAIL); // barra horizontal a 1 m
  const m = { id: 't', name: 't', boxes: [floor, bar], spawns: [] };
  const p = createPlayer({ x: 0, y: 0, z: 0, yaw: 0 });
  stepPlayer(p, emptyInput(), m, DT);
  for (let i = 0; i < 1 / DT; i++) stepPlayer(p, input({ moveZ: 1, yaw: 0 }), m, DT);
  assert.ok(p.pos.z < -4, `passou: z = ${p.pos.z}`);
});

test('validateMap confere o corrimão', () => {
  const ok = { id: 't', name: 't', boxes: [floor, slope], spawns: [{ x: 5, y: 0, z: 0, yaw: 0 }] };
  assert.deepEqual(validateMap(ok).errors, []);
  const short = rail({ x: 0, y: 1, z: 0 }, { x: 0, y: 1, z: 0.2 });
  assert.equal(validateMap({ ...ok, boxes: [floor, short] }).ok, false);
  const broken = { ...slope, to: { x: NaN, y: 0, z: 0 } };
  assert.equal(validateMap({ ...ok, boxes: [floor, broken] }).ok, false);
});

test('Sandbox: saindo do patamar pela borda oeste, desce o corrimão da escada e sai mais rápido', () => {
  assert.deepEqual(validateMap(sandbox).errors, []);
  const p = createPlayer({ x: -7.6, y: 1.5, z: 12.6, yaw: 0 }); // no patamar, na borda oeste
  stepPlayer(p, emptyInput(), sandbox, DT);
  let entry = null;
  let exit = null;
  for (let i = 0; i < 4 / DT && exit === null; i++) {
    stepPlayer(p, input({ moveZ: 1, moveX: i >= 15 ? -1 : 0, yaw: 0 }), sandbox, DT);
    if (has(p, 'railStart')) entry = speed(p);
    if (has(p, 'railEnd')) exit = speed(p);
  }
  assert.ok(entry !== null, 'grudou no corrimão');
  assert.ok(exit > entry, `entrou a ${entry.toFixed(1)}, saiu a ${exit.toFixed(1)} m/s`);
  assert.ok(Math.abs(p.pos.x - STAIR_RAIL.to.x) < 1e-9 && p.pos.z < STAIR_RAIL.to.z + 0.2, 'chegou ao fim do corrimão');
});

test('Sandbox: a partir do corrimão e do patamar, nada sai do mapa', () => {
  const starts = [
    { x: -7.6, y: 1.5, z: 12.6 },
    { x: STAIR_RAIL.from.x, y: STAIR_RAIL.from.y + 0.3, z: STAIR_RAIL.from.z - 0.5 },
    { x: STAIR_RAIL.to.x, y: STAIR_RAIL.to.y + 0.3, z: STAIR_RAIL.to.z + 1 },
  ];
  const r = searchEscapes(sandbox, starts, 29);
  assert.deepEqual(r.escapes, [], `saiu em ${r.escapes.length} de ${r.tries}`);
});
