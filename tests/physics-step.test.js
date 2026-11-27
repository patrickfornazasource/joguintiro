import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PHYSICS, PLAYER, MOVE } from '../shared/constants.js';
import { box } from '../shared/maps/format.js';
import { moveAndCollide } from '../shared/physics/collide.js';
import { createPlayer, stepPlayer, emptyInput } from '../shared/physics/player.js';
import { sandbox } from '../shared/maps/sandbox.js';
import { createStepSmoother } from '../src/core/stepSmoothing.js';

const DT = PHYSICS.FIXED_DT;
const R = PLAYER.RADIUS;
const EPS = PHYSICS.CONTACT_EPSILON;
const floor = box(0, -0.5, 0, 200, 1, 200);
const mapOf = (...boxes) => ({ id: 't', name: 't', boxes: [floor, ...boxes], spawns: [] });

function run(p, map, seconds) {
  for (let i = 0; i < Math.round(seconds / DT); i++) stepPlayer(p, emptyInput(), map, DT);
  return p;
}

/** Jogador parado no chão (já assentado), andando em +x a `speed` m/s. */
function walker(x, speed, map) {
  const p = createPlayer({ x, y: 0, z: 0 });
  run(p, map, 0.05); // assenta no chão
  p.vel.x = speed;
  return p;
}

/** Escada em +x: `n` degraus de `rise` m de altura e `depth` m de profundidade. */
function stairs(x0, n, rise, depth) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const h = rise * (i + 1);
    out.push(box(x0 + depth * i + depth / 2, h / 2, 0, depth, h, 4));
  }
  return out;
}

test('escada de degraus de 0,3 m é subida andando', () => {
  const steps = stairs(2, 5, 0.3, 0.6); // topo em 1,5 m, termina em x = 5
  const landing = box(9, 0.75, 0, 8, 1.5, 4); // patamar depois da escada
  const map = mapOf(...steps, landing);
  const p = walker(0, 4, map);
  run(p, map, 1.5);
  assert.ok(p.pos.x > 5, `passou da escada: x = ${p.pos.x}`);
  assert.ok(Math.abs(p.pos.y - 1.5) < 1e-9, `em cima da escada: y = ${p.pos.y}`);
  assert.equal(p.onGround, true);
  assert.equal(p.vel.x, 4, 'não perdeu velocidade');
});

test('bloco de 0,6 m bloqueia', () => {
  const wall = box(3, 0.3, 0, 1, 0.6, 4);
  const p = walker(0, 4, mapOf(wall));
  run(p, mapOf(wall), 1.5);
  assert.ok(Math.abs(p.pos.x - (wall.min.x - R)) < 1e-9, `parou: x = ${p.pos.x}`);
  assert.equal(p.pos.y, 0);
  assert.equal(p.vel.x, 0);
});

test('limite: degrau de exatamente MOVE.STEP_HEIGHT sobe; um pouco mais alto, não', () => {
  const ok = box(3, MOVE.STEP_HEIGHT / 2, 0, 1, MOVE.STEP_HEIGHT, 4);
  const p1 = walker(0, 4, mapOf(ok));
  run(p1, mapOf(ok), 1);
  assert.ok(Math.abs(p1.pos.y - MOVE.STEP_HEIGHT) < 1e-9 || p1.pos.x > ok.max.x, 'subiu');
  const tall = MOVE.STEP_HEIGHT + 0.01;
  const no = box(3, tall / 2, 0, 1, tall, 4);
  const p2 = walker(0, 4, mapOf(no));
  run(p2, mapOf(no), 1);
  assert.equal(p2.pos.y, 0, 'não subiu');
  assert.equal(p2.vel.x, 0);
});

test('sem espaço acima (teto baixo), o degrau bloqueia', () => {
  const step = box(3, 0.15, 0, 2, 0.3, 4);
  const ceiling = box(3, 2.5, 0, 4, 1, 4); // cobre a borda do degrau; vão de 1,7 m acima dele (< 1,8 m)
  const map = mapOf(step, ceiling);
  const p = walker(0, 4, map);
  run(p, map, 1);
  assert.equal(p.pos.y, 0, 'não subiu');
  assert.ok(Math.abs(p.pos.x - (step.min.x - R)) < 1e-9);
});

test('no ar não sobe degrau: pulando contra o bloco, bate e para', () => {
  const step = box(3, 0.15, 0, 1, 0.3, 4);
  const p = createPlayer({ x: 2.6, y: 0.1, z: 0 }); // no ar, abaixo do topo do degrau
  p.vel.x = 4;
  p.vel.y = 2; // subindo
  moveAndCollide(p, mapOf(step), DT);
  assert.ok(p.pos.x <= step.min.x - R + 1e-9, 'bateu');
  assert.equal(p.vel.x, 0);
});

test('a escada do Sandbox (degraus de 0,25 m) é subida até o patamar', () => {
  // Escada do sandbox: x = -6, começa em z = 6 e sobe em +z até o patamar em 1,5 m.
  const p = createPlayer({ x: -6, y: 0, z: 3 });
  run(p, sandbox, 0.05);
  p.vel.z = 4;
  run(p, sandbox, 2);
  assert.ok(Math.abs(p.pos.y - 1.5) < 1e-9, `no patamar: y = ${p.pos.y}, z = ${p.pos.z}`);
});

// Pedido da revisão: testes que travam a ordem dos eixos (X, Z, Y) e a folga em X.

test('ordem dos eixos: X antes de Z (canto de um bloco na diagonal)', () => {
  // Bloco ocupa x e z de 1 a 3. Jogador (0,5; 0,5) anda 0,3 m em x e em z num passo só.
  // X primeiro: x anda livre (z ainda fora do bloco); depois Z bate. Com Z primeiro seria o contrário.
  const block = { min: { x: 1, y: 0, z: 1 }, max: { x: 3, y: 2, z: 3 }, type: 'solid' };
  const p = createPlayer({ x: 0.5, y: 0, z: 0.5 });
  p.vel = { x: 0.3 / DT, y: 0, z: 0.3 / DT };
  moveAndCollide(p, { boxes: [block] }, DT);
  assert.ok(Math.abs(p.pos.x - 0.8) < 1e-9, `x andou livre: ${p.pos.x}`);
  assert.ok(Math.abs(p.pos.z - (1 - R)) < 1e-9, `z bateu: ${p.pos.z}`);
  assert.equal(p.vel.z, 0);
  assert.ok(p.vel.x > 0, 'x manteve a velocidade');
  assert.deepEqual(p.contact.normal, { x: 0, y: 0, z: -1 });
});

test('ordem dos eixos: horizontal antes de Y (cair na quina pousa em cima)', () => {
  // Bloco de 1 m de altura em x de 1 a 3. Jogador ao lado, pés logo acima do topo,
  // anda +0,3 em x e desce 0,1 num passo. X primeiro (livre, ainda acima do topo),
  // depois Y pousa no bloco. Com Y primeiro, desceria ao lado e X bateria na lateral.
  const block = { min: { x: 1, y: 0, z: -2 }, max: { x: 3, y: 1, z: 2 }, type: 'solid' };
  const p = createPlayer({ x: 0.5, y: 1.05, z: 0 });
  p.vel = { x: 0.3 / DT, y: -0.1 / DT, z: 0 };
  moveAndCollide(p, { boxes: [block] }, DT);
  assert.ok(Math.abs(p.pos.x - 0.8) < 1e-9, `x: ${p.pos.x}`);
  assert.equal(p.pos.y, 1, 'pousou em cima');
  assert.equal(p.onGround, true);
  assert.equal(p.contact, null, 'sem batida lateral');
});

test('ordem dos eixos: Z também antes de Y (mesma quina, andando em z)', () => {
  const block = { min: { x: -2, y: 0, z: 1 }, max: { x: 2, y: 1, z: 3 }, type: 'solid' };
  const p = createPlayer({ x: 0, y: 1.05, z: 0.5 });
  p.vel = { x: 0, y: -0.1 / DT, z: 0.3 / DT };
  moveAndCollide(p, { boxes: [block] }, DT);
  assert.ok(Math.abs(p.pos.z - 0.8) < 1e-9, `z: ${p.pos.z}`);
  assert.equal(p.pos.y, 1, 'pousou em cima');
  assert.equal(p.contact, null, 'sem batida lateral');
});

test('folga de 0,0001 m no eixo X: invadir menos que a folga não bate; mais, bate', () => {
  const wall = { min: { x: 1, y: 0, z: -2 }, max: { x: 2, y: 2, z: 2 }, type: 'solid' };
  const start = 1 - R - 0.1; // frente do jogador a 0,1 m da parede
  // Invade metade da folga: não conta como batida.
  const a = createPlayer({ x: start, y: 0, z: 0 });
  a.vel = { x: (0.1 + EPS / 2) / DT, y: 0, z: 0 };
  moveAndCollide(a, { boxes: [wall] }, DT);
  assert.equal(a.contact, null);
  assert.ok(a.pos.x > 1 - R, 'andou o movimento inteiro');
  // Invade o dobro da folga: bate e é empurrado para encostar.
  const b = createPlayer({ x: start, y: 0, z: 0 });
  b.vel = { x: (0.1 + EPS * 2) / DT, y: 0, z: 0 };
  moveAndCollide(b, { boxes: [wall] }, DT);
  assert.deepEqual(b.contact.normal, { x: -1, y: 0, z: 0 });
  assert.ok(Math.abs(b.pos.x - (1 - R)) < 1e-12);
});

test('câmera: ao subir um degrau, a imagem começa embaixo e alcança a física', () => {
  const s = createStepSmoother();
  assert.equal(s.update(0, true, DT), 0);
  const first = s.update(0.3, true, DT); // física subiu 0,3 m de uma vez
  assert.ok(first < 0.3 && first > 0, `começa abaixo: ${first}`);
  let y = first;
  for (let i = 0; i < 60; i++) y = s.update(0.3, true, DT); // 0,5 s
  assert.ok(Math.abs(y - 0.3) < 0.001, `alcançou: ${y}`);
});

test('câmera: pulo, queda e subidas grandes não são suavizados', () => {
  const s = createStepSmoother();
  s.update(0, true, DT);
  assert.equal(s.update(0.3, false, DT), 0.3, 'no ar (pulo) segue a física');
  s.reset();
  s.update(0, true, DT);
  assert.equal(s.update(2, true, DT), 2, 'subida maior que um degrau (ex.: renascer) segue a física');
  s.reset();
  s.update(1, true, DT);
  assert.equal(s.update(0.7, true, DT), 0.7, 'descer segue a física');
});
