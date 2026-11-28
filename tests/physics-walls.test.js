import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PHYSICS, PLAYER, MOVE } from '../shared/constants.js';
import { box, BOX_TYPES as T } from '../shared/maps/format.js';
import { detectWall, updateWall } from '../shared/physics/walls.js';
import { createPlayer, stepPlayer, emptyInput } from '../shared/physics/player.js';

const DT = PHYSICS.FIXED_DT;
const R = PLAYER.RADIUS;
const floor = box(0, -0.5, 0, 200, 1, 200);
const mapOf = (...boxes) => ({ id: 't', name: 't', boxes: [floor, ...boxes], spawns: [] });
/** Parede alta em x = face, ocupando x de `face` a `face + 0,5`. */
const wallAtX = (face, type = T.SOLID) => box(face + 0.25, 2, 0, 0.5, 4, 10, type);
/** Jogador com a lateral direita do corpo a `gap` m da parede em x = 2 (olhando para -z: +x é a direita). */
const playerWithGap = (gap) => createPlayer({ x: 2 - R - gap, y: 0, z: 0, yaw: 0 });

test('detecta parede a 0,1 m', () => {
  const w = detectWall(playerWithGap(0.1), mapOf(wallAtX(2)));
  assert.ok(w, 'detectou');
  assert.deepEqual(w.normal, { x: -1, y: 0, z: 0 });
  assert.equal(w.type, 'solid');
  assert.ok(Math.abs(w.distance - 0.1) < 1e-9);
});

test('ignora parede a 0,3 m', () => {
  assert.equal(detectWall(playerWithGap(0.3), mapOf(wallAtX(2))), null);
});

test('encostado (distância 0) também detecta', () => {
  const w = detectWall(playerWithGap(0), mapOf(wallAtX(2)));
  assert.ok(w);
  assert.equal(w.distance, 0);
});

test('lado relativo ao olhar: direita, esquerda, frente e trás', () => {
  const map = mapOf(wallAtX(2));
  const at = (yaw) => detectWall(createPlayer({ x: 2 - R - 0.05, y: 0, z: 0, yaw }), map).side;
  assert.equal(at(0), 'right'); // olhando -z: a parede em +x fica à direita
  assert.equal(at(Math.PI), 'left'); // olhando +z
  assert.equal(at(-Math.PI / 2), 'front'); // olhando +x
  assert.equal(at(Math.PI / 2), 'back'); // olhando -x
});

test('nos 4 eixos do mundo: normal aponta da parede para o jogador', () => {
  const p = createPlayer({ x: 0, y: 0, z: 0 });
  const g = R + 0.05;
  const cases = [
    [box(g + 0.25, 2, 0, 0.5, 4, 4), { x: -1, y: 0, z: 0 }],
    [box(-g - 0.25, 2, 0, 0.5, 4, 4), { x: 1, y: 0, z: 0 }],
    [box(0, 2, g + 0.25, 4, 4, 0.5), { x: 0, y: 0, z: -1 }],
    [box(0, 2, -g - 0.25, 4, 4, 0.5), { x: 0, y: 0, z: 1 }],
  ];
  for (const [wall, normal] of cases) assert.deepEqual(detectWall(p, mapOf(wall)).normal, normal);
});

test('devolve a parede mais próxima', () => {
  const p = createPlayer({ x: 0, y: 0, z: 0 });
  const near = box(R + 0.05 + 0.25, 2, 0, 0.5, 4, 4, T.WALLRUN); // a 0,05 m em +x
  const far = box(-R - 0.12 - 0.25, 2, 0, 0.5, 4, 4); // a 0,12 m em -x
  const w = detectWall(p, mapOf(near, far));
  assert.equal(w.type, 'wallrun');
  assert.deepEqual(w.normal, { x: -1, y: 0, z: 0 });
});

test('degrau baixo, chão, plataforma de salto e corrimão não contam como parede', () => {
  const p = createPlayer({ x: 0, y: 0, z: 0 });
  const g = R + 0.05;
  assert.equal(detectWall(p, mapOf(box(g + 0.5, 0.2, 0, 1, 0.4, 4))), null, 'degrau de 0,4 m');
  assert.equal(detectWall(p, mapOf()), null, 'só o chão');
  assert.equal(detectWall(p, mapOf(box(g + 0.25, 2, 0, 0.5, 4, 4, T.PAD))), null, 'plataforma');
  assert.equal(detectWall(p, mapOf(box(g + 0.25, 1, 0, 0.5, 0.2, 4, T.RAIL))), null, 'corrimão');
});

test('Tinta UV ativa conta; inativa não', () => {
  const p = createPlayer({ x: 0, y: 0, z: 0 });
  const g = R + 0.05 + 0.25;
  assert.ok(detectWall(p, mapOf(box(g, 2, 0, 0.5, 4, 4, T.UV, { active: true }))));
  assert.equal(detectWall(p, mapOf(box(g, 2, 0, 0.5, 4, 4, T.UV, { active: false }))), null);
});

test('parede que não cobre o corpo na lateral (passou da quina) não conta', () => {
  const p = createPlayer({ x: 0, y: 0, z: 3 }); // a parede vai de z = -5 a 5; quina em z = 5
  const wall = box(R + 0.05 + 0.25, 2, 0, 0.5, 4, 10);
  assert.ok(detectWall(p, mapOf(wall)));
  p.pos.z = 5 + R + 0.01;
  assert.equal(detectWall(p, mapOf(wall)), null);
});

test('lembra a última parede por 0,15 s depois de desencostar', () => {
  const map = mapOf(wallAtX(2));
  const p = playerWithGap(0.05);
  updateWall(p, map, DT);
  assert.equal(p.wall.age, 0);
  p.pos.x -= 1; // afasta (sem parede perto)
  let t = 0;
  while (t < 0.1 - 1e-9) {
    updateWall(p, map, DT);
    t += DT;
  }
  assert.ok(p.wall, 'ainda lembra a 0,10 s');
  assert.ok(Math.abs(p.wall.age - 0.1) < 1e-9);
  while (t < MOVE.WALL_MEMORY - 1e-9) {
    updateWall(p, map, DT);
    t += DT;
  }
  assert.ok(p.wall, 'ainda lembra a 0,15 s');
  updateWall(p, map, DT);
  updateWall(p, map, DT);
  assert.equal(p.wall, null, 'esqueceu depois de 0,15 s');
});

test('no passo da física: encostar na parede preenche p.wall', () => {
  const map = mapOf(wallAtX(2, T.WALLRUN));
  const p = createPlayer({ x: 0, y: 0, z: 0, yaw: 0 });
  // Anda para a direita (D) até encostar.
  for (let i = 0; i < 2 / DT; i++) stepPlayer(p, { ...emptyInput(), moveX: 1, yaw: 0 }, map, DT);
  assert.ok(p.wall, 'parede detectada');
  assert.equal(p.wall.side, 'right');
  assert.equal(p.wall.type, 'wallrun');
  assert.equal(p.wall.age, 0);
});
