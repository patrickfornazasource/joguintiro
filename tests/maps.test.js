import { test } from 'node:test';
import assert from 'node:assert/strict';
import { box, validateMap, BOX_TYPES } from '../shared/maps/format.js';
import { sandbox } from '../shared/maps/sandbox.js';
import { getMap, MAPS, DEFAULT_MAP_ID } from '../shared/maps/index.js';

const minimal = (over = {}) => ({
  id: 't',
  name: 'teste',
  boxes: [box(0, -0.5, 0, 10, 1, 10)],
  spawns: [{ x: 0, y: 0, z: 0, yaw: 0 }],
  ...over,
});

test('box calcula min e max pelo centro e tamanho', () => {
  const b = box(1, 2, 3, 2, 4, 6, BOX_TYPES.PAD, { power: 1 });
  assert.deepEqual(b.min, { x: 0, y: 0, z: 0 });
  assert.deepEqual(b.max, { x: 2, y: 4, z: 6 });
  assert.equal(b.type, 'pad');
  assert.equal(b.power, 1);
  assert.equal(box(0, 0, 0, 1, 1, 1).type, 'solid');
});

test('validateMap aceita o sandbox', () => {
  const r = validateMap(sandbox);
  assert.deepEqual(r.errors, []);
  assert.equal(r.ok, true);
});

test('sandbox: chão 60x60 com topo em y = 0 e todos os tipos de exemplo', () => {
  const floor = sandbox.boxes[0];
  assert.equal(floor.max.x - floor.min.x, 60);
  assert.equal(floor.max.z - floor.min.z, 60);
  assert.equal(floor.max.y, 0);
  const types = new Set(sandbox.boxes.map((b) => b.type));
  for (const t of ['solid', 'wallrun', 'pad', 'rail']) assert.ok(types.has(t), t);
});

test('sandbox: nascimentos dentro das paredes e em cima do chão', () => {
  for (const s of sandbox.spawns) {
    assert.ok(Math.abs(s.x) < 29 && Math.abs(s.z) < 29, `fora: ${s.x},${s.z}`);
    assert.ok(s.y >= 0);
  }
});

test('validateMap aceita um mapa mínimo', () => {
  assert.equal(validateMap(minimal()).ok, true);
});

test('validateMap rejeita caixa invertida', () => {
  const bad = { min: { x: 1, y: 0, z: 0 }, max: { x: 0, y: 1, z: 1 }, type: 'solid' };
  const r = validateMap(minimal({ boxes: [bad] }));
  assert.equal(r.ok, false);
  assert.match(r.errors.join(), /invertida.*x/);
});

test('validateMap rejeita caixa de tamanho zero', () => {
  const r = validateMap(minimal({ boxes: [box(0, 0, 0, 1, 0, 1)] }));
  assert.equal(r.ok, false);
});

test('validateMap rejeita tipo desconhecido', () => {
  const r = validateMap(minimal({ boxes: [box(0, -0.5, 0, 10, 1, 10, 'lava')] }));
  assert.equal(r.ok, false);
  assert.match(r.errors.join(), /tipo desconhecido "lava"/);
});

test('validateMap rejeita mapa sem nascimento', () => {
  assert.equal(validateMap(minimal({ spawns: [] })).ok, false);
  assert.equal(validateMap(minimal({ spawns: undefined })).ok, false);
});

test('validateMap rejeita nascimento dentro de uma caixa', () => {
  const r = validateMap(minimal({ spawns: [{ x: 0, y: -0.5, z: 0, yaw: 0 }] }));
  assert.equal(r.ok, false);
  assert.match(r.errors.join(), /dentro da caixa 0/);
});

test('validateMap rejeita números inválidos, id e nome ausentes, mapa vazio', () => {
  assert.equal(validateMap(minimal({ spawns: [{ x: NaN, y: 0, z: 0, yaw: 0 }] })).ok, false);
  assert.equal(validateMap(minimal({ spawns: [{ x: 0, y: 0, z: 0 }] })).ok, false);
  assert.equal(validateMap(minimal({ boxes: [] })).ok, false);
  assert.equal(validateMap(minimal({ id: '' })).ok, false);
  assert.equal(validateMap(minimal({ name: undefined })).ok, false);
  assert.equal(validateMap(null).ok, false);
});

test('getMap: escolhe pelo id e cai no padrão quando não existe', () => {
  assert.equal(getMap('sandbox'), sandbox);
  assert.equal(getMap('nao-existe'), MAPS[DEFAULT_MAP_ID]);
  assert.equal(getMap(null), MAPS[DEFAULT_MAP_ID]);
});

test('todos os mapas registrados são válidos', () => {
  for (const [id, map] of Object.entries(MAPS)) {
    assert.equal(map.id, id);
    assert.deepEqual(validateMap(map).errors, [], id);
  }
});
