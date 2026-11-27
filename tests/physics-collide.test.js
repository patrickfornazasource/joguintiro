import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PHYSICS, PLAYER, MOVE } from '../shared/constants.js';
import { box, BOX_TYPES as T } from '../shared/maps/format.js';
import { overlaps, playerBox, moveAndCollide, isSolid } from '../shared/physics/collide.js';
import { createPlayer, stepPlayer, stepBody, emptyInput } from '../shared/physics/player.js';
import { sandbox } from '../shared/maps/sandbox.js';

const DT = PHYSICS.FIXED_DT;
const R = PLAYER.RADIUS;
const floor = box(0, -0.5, 0, 200, 1, 200);
const mapOf = (...boxes) => ({ id: 't', name: 't', boxes: [floor, ...boxes], spawns: [] });

/** Simula só gravidade e colisão (stepBody), sem atrito nem aceleração da F1-06. */
function run(p, map, seconds, each) {
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) {
    stepBody(p, map, DT);
    each?.(p, i);
  }
  return p;
}

test('overlaps: sobreposição de verdade conta; só encostar não conta', () => {
  const a = { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 1 } };
  assert.equal(overlaps(a, { min: { x: 0.5, y: 0.5, z: 0.5 }, max: { x: 2, y: 2, z: 2 } }), true);
  assert.equal(overlaps(a, { min: { x: 1, y: 0, z: 0 }, max: { x: 2, y: 1, z: 1 } }), false, 'encostando');
  assert.equal(overlaps(a, { min: { x: 1.00005, y: 0, z: 0 }, max: { x: 2, y: 1, z: 1 } }), false);
  assert.equal(overlaps(a, { min: { x: 0.999, y: 0, z: 0 }, max: { x: 2, y: 1, z: 1 } }), true, 'passou da folga');
});

test('playerBox: largura 2 x raio e altura do corpo, base nos pés', () => {
  const b = playerBox(createPlayer({ x: 1, y: 2, z: 3 }));
  assert.deepEqual(b.min, { x: 1 - R, y: 2, z: 3 - R });
  assert.deepEqual(b.max, { x: 1 + R, y: 2 + PLAYER.HEIGHT, z: 3 + R });
});

test('cai e para no chão', () => {
  const p = run(createPlayer({ x: 0, y: 5, z: 0 }), mapOf(), 2);
  assert.equal(p.pos.y, 0);
  assert.equal(p.vel.y, 0);
  assert.equal(p.onGround, true);
  assert.equal(p.groundType, 'solid');
});

test('parado no chão, onGround fica verdadeiro em todos os passos (sem piscar)', () => {
  const p = createPlayer({ x: 0, y: 0, z: 0 });
  const flags = [];
  run(p, mapOf(), 0.5, (q) => flags.push(q.onGround));
  assert.ok(flags.every(Boolean));
  assert.equal(p.pos.y, 0);
});

test('a 45 m/s contra uma parede fina de 0,2 m não atravessa', () => {
  const wall = box(5, 2, 0, 0.2, 4, 10);
  const p = createPlayer({ x: 0, y: 0, z: 0 });
  p.vel.x = 45;
  run(p, mapOf(wall), 1);
  assert.ok(p.pos.x <= wall.min.x - R + 1e-9, `atravessou: x = ${p.pos.x}`);
  assert.ok(Math.abs(p.pos.x - (wall.min.x - R)) < 1e-9, 'encostado na parede');
  assert.equal(p.vel.x, 0);
});

test('nem a 200 m/s, em qualquer ponto de partida, atravessa a parede fina', () => {
  const wall = box(5, 2, 0, 0.2, 4, 10);
  for (let start = 0; start < 1; start += 0.07) {
    const p = createPlayer({ x: start, y: 0, z: 0 });
    p.vel.x = 200;
    run(p, mapOf(wall), 0.2);
    assert.ok(p.pos.x < wall.min.x, `atravessou partindo de ${start}`);
  }
});

test('bater na parede registra o contato com a normal e o tipo', () => {
  const wall = box(5, 2, 0, 0.5, 4, 10, T.WALLRUN);
  const p = createPlayer({ x: 0, y: 0, z: 0 });
  p.vel.x = 20;
  let contact = null;
  run(p, mapOf(wall), 0.5, (q) => { contact ??= q.contact; });
  assert.deepEqual(contact.normal, { x: -1, y: 0, z: 0 });
  assert.equal(contact.type, 'wallrun');
});

test('deslizar ao longo da parede mantém a componente paralela', () => {
  const wall = box(5, 2, 0, 0.5, 4, 100);
  const p = createPlayer({ x: 0, y: 0, z: 0 });
  p.vel.x = 10;
  p.vel.z = -6;
  run(p, mapOf(wall), 1);
  assert.equal(p.vel.x, 0, 'parou na direção da parede');
  assert.equal(p.vel.z, -6, 'manteve a velocidade ao longo da parede');
  assert.ok(Math.abs(p.pos.z - -6) < 0.01, `andou ao longo da parede: z = ${p.pos.z}`);
});

test('parede em z também bloqueia, com normal em z', () => {
  const wall = box(0, 2, -5, 10, 4, 0.3);
  const p = createPlayer({ x: 0, y: 0, z: 0 });
  p.vel.z = -30;
  let contact = null;
  run(p, mapOf(wall), 0.5, (q) => { contact ??= q.contact; });
  assert.ok(Math.abs(p.pos.z - (wall.max.z + R)) < 1e-9);
  assert.deepEqual(contact.normal, { x: 0, y: 0, z: 1 });
});

test('bater a cabeça no teto zera a subida', () => {
  const ceiling = box(0, 2.5, 0, 10, 0.2, 10); // embaixo em y = 2,4
  const p = createPlayer({ x: 0, y: 0, z: 0 });
  p.vel.y = 10;
  stepPlayer(p, emptyInput(), mapOf(ceiling), DT);
  run(p, mapOf(ceiling), 0.2);
  assert.ok(p.pos.y + p.height <= ceiling.min.y + 1e-9, 'cabeça não passou do teto');
});

test('cair a 50 m/s numa plataforma fina de 0,2 m não atravessa', () => {
  const plat = box(0, 10, 0, 4, 0.2, 4);
  const p = createPlayer({ x: 0, y: 60, z: 0 });
  p.vel.y = -MOVE.MAX_FALL_SPEED;
  run(p, mapOf(plat), 2);
  assert.equal(p.pos.y, plat.max.y);
  assert.equal(p.onGround, true);
});

test('pousar numa plataforma de salto informa o tipo do chão', () => {
  const pad = box(0, 0.1, 0, 3, 0.2, 3, T.PAD);
  const p = run(createPlayer({ x: 0, y: 3, z: 0 }), mapOf(pad), 1);
  assert.equal(p.groundType, 'pad');
  assert.ok(Math.abs(p.pos.y - 0.2) < 1e-9);
});

test('Tinta UV inativa é atravessada; ativa (ou sem campo active) bloqueia', () => {
  const off = box(5, 2, 0, 0.5, 4, 10, T.UV, { active: false });
  const on = box(5, 2, 0, 0.5, 4, 10, T.UV, { active: true });
  const plain = box(5, 2, 0, 0.5, 4, 10, T.UV);
  assert.equal(isSolid(off), false);
  assert.equal(isSolid(on), true);
  assert.equal(isSolid(plain), true);
  for (const [b, passes] of [[off, true], [on, false], [plain, false]]) {
    const p = createPlayer({ x: 0, y: 0, z: 0 });
    p.vel.x = 20;
    run(p, mapOf(b), 0.5);
    assert.equal(p.pos.x > b.max.x, passes, `active=${b.active}`);
  }
});

test('andar no chão não bate no próprio chão', () => {
  const p = createPlayer({ x: 0, y: 0, z: 0 });
  p.vel.x = 8;
  run(p, mapOf(), 1);
  assert.ok(Math.abs(p.pos.x - 8) < 0.01, `x = ${p.pos.x}`);
  assert.equal(p.contact, null);
});

test('moveAndCollide sem mapa só anda', () => {
  const p = createPlayer({ x: 0, y: 0, z: 0 });
  p.vel.x = 1;
  moveAndCollide(p, null, 1);
  assert.equal(p.pos.x, 1);
});

test('no Sandbox: nasce, cai e fica de pé no chão sem atravessar nada', () => {
  for (const spawn of sandbox.spawns) {
    const p = run(createPlayer({ ...spawn, y: spawn.y + 2 }), sandbox, 2);
    assert.equal(p.pos.y, 0);
    assert.equal(p.onGround, true);
  }
});

test('no Sandbox: correr reto até a parede externa para nela', () => {
  const p = createPlayer({ x: 0, y: 0, z: 20 });
  p.vel.z = 40;
  run(p, sandbox, 2);
  assert.ok(Math.abs(p.pos.z - (29 - R)) < 1e-9, `z = ${p.pos.z}`);
});
