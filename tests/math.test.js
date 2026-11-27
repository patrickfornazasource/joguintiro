import { test } from 'node:test';
import assert from 'node:assert/strict';
import { v3, add, sub, scale, dot, len, lenXZ, normalize, copy } from '../shared/math.js';

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} deveria ser ~${b}`);

test('v3 cria vetor e usa zero como padrão', () => {
  assert.deepEqual(v3(1, 2, 3), { x: 1, y: 2, z: 3 });
  assert.deepEqual(v3(), { x: 0, y: 0, z: 0 });
});

test('add soma componente a componente', () => {
  assert.deepEqual(add(v3(1, 2, 3), v3(4, -5, 6)), { x: 5, y: -3, z: 9 });
});

test('sub subtrai componente a componente', () => {
  assert.deepEqual(sub(v3(1, 2, 3), v3(4, -5, 6)), { x: -3, y: 7, z: -3 });
});

test('scale multiplica por número', () => {
  assert.deepEqual(scale(v3(1, -2, 3), 2), { x: 2, y: -4, z: 6 });
});

test('dot é o produto escalar', () => {
  assert.equal(dot(v3(1, 2, 3), v3(4, 5, 6)), 32);
  assert.equal(dot(v3(1, 0, 0), v3(0, 1, 0)), 0);
});

test('len é o comprimento 3D', () => {
  assert.equal(len(v3(3, 4, 0)), 5);
  assert.equal(len(v3(2, 3, 6)), 7);
  assert.equal(len(v3()), 0);
});

test('lenXZ ignora a altura (y)', () => {
  assert.equal(lenXZ(v3(3, 100, 4)), 5);
  assert.equal(lenXZ(v3(0, 9, 0)), 0);
});

test('normalize devolve comprimento 1 no mesmo sentido', () => {
  const n = normalize(v3(3, 4, 0));
  close(len(n), 1);
  close(n.x, 0.6);
  close(n.y, 0.8);
  assert.equal(n.z, 0);
});

test('normalize do vetor nulo devolve zero sem NaN', () => {
  assert.deepEqual(normalize(v3()), { x: 0, y: 0, z: 0 });
});

test('copy cria um vetor independente', () => {
  const a = v3(1, 2, 3);
  const b = copy(a);
  assert.deepEqual(b, a);
  assert.notEqual(b, a);
  b.x = 99;
  assert.equal(a.x, 1);
});

test('nenhuma função altera os argumentos', () => {
  const a = v3(1, 2, 3);
  const b = v3(4, 5, 6);
  add(a, b); sub(a, b); scale(a, 3); dot(a, b); len(a); lenXZ(a); normalize(a); copy(a);
  assert.deepEqual(a, { x: 1, y: 2, z: 3 });
  assert.deepEqual(b, { x: 4, y: 5, z: 6 });
});
