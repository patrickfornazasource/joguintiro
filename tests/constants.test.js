import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../shared/constants.js';

const GROUPS = ['PHYSICS', 'PLAYER', 'MOVE', 'NET'];

test('todos os grupos existem e estão congelados', () => {
  for (const name of GROUPS) {
    assert.ok(C[name], `${name} deveria existir`);
    assert.ok(Object.isFrozen(C[name]), `${name} deveria estar congelado`);
  }
});

test('não dá para mudar um valor por engano', () => {
  assert.throws(() => {
    'use strict';
    C.PLAYER.HEIGHT = 99;
  }, TypeError);
  assert.equal(C.PLAYER.HEIGHT, 1.8);
});

test('todos os números são finitos e positivos', () => {
  for (const name of GROUPS) {
    for (const [key, value] of Object.entries(C[name])) {
      if (typeof value !== 'number') continue;
      assert.ok(Number.isFinite(value), `${name}.${key} deveria ser finito`);
      assert.ok(value > 0, `${name}.${key} deveria ser positivo`);
    }
  }
});

test('proporções do jogador fazem sentido', () => {
  const P = C.PLAYER;
  assert.ok(P.CROUCH_HEIGHT < P.HEIGHT, 'agachado mais baixo que em pé');
  assert.ok(P.EYE_HEIGHT < P.HEIGHT, 'olho abaixo do topo da cabeça');
  assert.ok(P.CROUCH_EYE_HEIGHT < P.CROUCH_HEIGHT, 'olho agachado abaixo do topo');
  assert.ok(P.RADIUS * 2 < P.CROUCH_HEIGHT, 'cápsula cabe agachada');
});

test('passo fixo da física é 1/120 s', () => {
  assert.equal(C.PHYSICS.FIXED_DT, 1 / 120);
});
