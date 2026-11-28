// Ajustes pedidos pelo dono depois da F1-20:
// A) corrida na parede em todas as paredes (cinza, ciano, externas);
// B) corrimão que preserva melhor a velocidade.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MOVE, PHYSICS } from '../shared/constants.js';
import { box, rail, BOX_TYPES as T } from '../shared/maps/format.js';
import { getMap } from '../shared/maps/index.js';
import { createPlayer, stepPlayer, emptyInput } from '../shared/physics/player.js';
import { climbMaps, searchClimb } from './helpers/climb-search.js';
import { measureRail } from './helpers/rail-measure.js';

const DT = PHYSICS.FIXED_DT;

test('A: corre nas paredes cinza do Sandbox e na parede externa', () => {
  const sandbox = getMap('sandbox');
  // Parede externa leste (face em x = 29): correndo em -z junto dela, pulando de lado.
  const p = createPlayer({ x: 28.3, y: 0, z: 0, yaw: 0 });
  p.vel = { x: 0, y: 0, z: -11 };
  let ran = false;
  for (let i = 0; i < 2 / DT && !ran; i++) {
    if (i === 30) p.vel.x = 2; // perto do alto do pulo, desvia para a parede (pulo de lado)
    stepPlayer(p, { ...emptyInput(), moveZ: 1, moveX: i > 30 ? 1 : 0, yaw: 0, jump: i === 0, jumpPressed: i === 0 }, sandbox, DT);
    if (p.wallrun) ran = true;
  }
  assert.ok(ran, 'correu na parede externa (cinza)');
  assert.equal(p.wallrun.box.type, T.SOLID);
});

test('A: escalada continua abaixo de 5,5 m (parede isolada, canto e poço estreito)', () => {
  // Medido nesta mudança (pés, m): isolada 3,87; canto 4,63; poço 3,31.
  // Antes, só nas paredes cinza: isolada 3,13; canto 3,13; poço 4,97.
  const maps = climbMaps(T.SOLID);
  const heights = Object.fromEntries(Object.entries(maps).map(([k, m]) => [k, searchClimb(m).height]));
  for (const [k, h] of Object.entries(heights)) assert.ok(h < 5.5, `${k}: ${h.toFixed(2)} m`);
  // Parede cinza e ciano agora dão o mesmo resultado (a mesma regra).
  const cyan = climbMaps(T.WALLRUN);
  for (const k of Object.keys(maps)) assert.equal(searchClimb(cyan[k]).height, heights[k], k);
});

test('B: o corrimão mantém a velocidade de entrada (tabela do PR)', () => {
  for (const s of [3, 9, 13, 20, 28, 39]) {
    for (const angleDeg of [0, 30]) {
      const r = measureRail(s, { angleDeg });
      assert.ok(r.entered, `${s} m/s, ${angleDeg}°: entrou`);
      assert.ok(Math.abs(r.onRail - s) < 0.15, `${s} m/s, ${angleDeg}°: no trilho ${r.onRail.toFixed(2)}`);
      assert.ok(r.exitH >= s - 0.05, `${s} m/s, ${angleDeg}°: saiu a ${r.exitH.toFixed(2)} (descida acelera)`);
    }
  }
  assert.equal(MOVE.RAIL_MAX_SPEED, MOVE.MAX_SPEED, 'o teto do trilho acompanha o limite geral');
});

test('B: sair pulando ou agachando não corta a velocidade horizontal', () => {
  for (const s of [9, 20, 39]) {
    for (const exit of ['pulo', 'agachar']) {
      const r = measureRail(s, { exit });
      assert.ok(r.exitH >= s - 0.05, `${s} m/s, ${exit}: ${r.exitH.toFixed(2)}`);
    }
    const j = measureRail(s, { exit: 'pulo' });
    assert.ok(j.exitY > 0, 'o pulo sai para cima');
  }
});

test('B: sem brecha de ganho: trilho plano não acelera e subida freia', () => {
  const floor = box(0, -40.5, 0, 400, 1, 400);
  const ride = (from, to, speed) => {
    const m = { id: 't', name: 't', spawns: [], boxes: [floor, rail(from, to)] };
    const p = createPlayer({ x: 0, y: from.y + 0.2, z: from.z + 0.3 });
    p.vel = { x: 0, y: -1, z: -speed };
    let last = null;
    for (let i = 0; i < 6 / DT; i++) {
      const was = !!p.rail;
      stepPlayer(p, emptyInput(), m, DT);
      if (p.rail) last = Math.abs(p.rail.v);
      if (was && !p.rail) return { exit: Math.hypot(p.vel.x, p.vel.z, p.vel.y), last };
    }
    return { exit: null, last };
  };
  const flat = ride({ x: 0, y: 3, z: 0 }, { x: 0, y: 3, z: -20 }, 15);
  assert.ok(Math.abs(flat.exit - 15) < 0.2, `plano: ${flat.exit.toFixed(2)} (entrou a 15)`);
  const up = ride({ x: 0, y: 1, z: 0 }, { x: 0, y: 5, z: -20 }, 15);
  assert.ok(up.exit < 15, `subida freia: ${up.exit.toFixed(2)}`);
});
