// Ajustes pedidos pelo dono depois da F1-20:
// A) corrida na parede em todas as paredes (cinza, ciano, externas);
// B) corrimão que preserva melhor a velocidade.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MOVE, PHYSICS } from '../shared/constants.js';
import { box, rail, BOX_TYPES as T } from '../shared/maps/format.js';
import { getMap } from '../shared/maps/index.js';
import { createPlayer, stepPlayer, emptyInput } from '../shared/physics/player.js';
import { climbShapes, searchClimb } from './helpers/climb-search.js';
import { treino } from '../shared/maps/treino.js';
import { PAD_TO_HIGH } from '../shared/maps/sandbox.js';
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

test('A: escalada medida por formato de parede (poço e canto sobem mais: cada parede nova recarrega)', () => {
  // Busca sorteada (mouse girando, Espaço em ritmos variados, dash), 700 tentativas por forma.
  // Números de uma busca maior (10 mil ou mais tentativas por forma, pés, m), feita neste PR:
  //   antes (só ciano): ~5,5 em todas as formas (mesma busca);
  //   agora: isolada 7,8; canto 10,4; poço 1,5 m 10,9; poço 2 m 10,7; poço 3 m 13,2;
  //   poço 4 m 11,3; U 14,5; quatro paredes 17,2.
  // Tetos (com folga): 1 parede 9 m; 2 paredes 14,5 m; 3 paredes 16 m; 4 paredes 19 m.
  // Se um teto estourar, a escalada aumentou: rever os mapas (paredes que não se pode escalar
  // precisam passar dessa altura ou não formar poço/canto).
  const shapes = climbShapes(T.SOLID);
  const ceiling = { isolada: 9, canto: 14.5, 'poco 1.5 m': 14.5, 'poco 2 m': 14.5, 'poco 3 m': 14.5, 'poco 4 m': 14.5, U: 16, 'quatro paredes': 19 };
  assert.deepEqual(Object.keys(shapes).sort(), Object.keys(ceiling).sort());
  const h = {};
  for (const [name, shape] of Object.entries(shapes)) {
    h[name] = searchClimb(shape, { tries: 700, seed: 3 }).height;
    assert.ok(h[name] < ceiling[name], `${name}: ${h[name].toFixed(2)} m (teto ${ceiling[name]} m)`);
  }
  // A busca precisa continuar forte (senão o teto acima não prova nada).
  assert.ok(h.isolada > 6, `isolada: ${h.isolada.toFixed(2)}`);
  assert.ok(h['poco 3 m'] > 9, `poço de 3 m: ${h['poco 3 m'].toFixed(2)}`);
  assert.ok(h['quatro paredes'] > 10, `quatro paredes: ${h['quatro paredes'].toFixed(2)}`);
  // Parede cinza e ciano dão o mesmo resultado (a mesma regra).
  const cyan = climbShapes(T.WALLRUN);
  assert.equal(searchClimb(cyan['poco 3 m'], { tries: 200, seed: 3 }).height, searchClimb(shapes['poco 3 m'], { tries: 200, seed: 3 }).height);
});

test('A: nos mapas de verdade a escalada não sai do mapa (Sandbox e treino)', () => {
  const sandbox = getMap('sandbox');
  const t = PAD_TO_HIGH.target;
  const cases = [
    [sandbox, 29, [...sandbox.spawns, { x: t.x, y: t.top, z: t.z }, { x: 26, y: 0, z: 26 }, { x: -26, y: 0, z: -26 }, { x: -22, y: 3, z: 0 }]],
    [treino, 100, [...treino.spawns, { x: 96, y: 0, z: 96 }, { x: -96, y: 0, z: -96 }, { x: 57, y: 0, z: 57 }, { x: 77, y: 0, z: -9 }]],
  ];
  for (const [map, limit, starts] of cases) {
    let best = 0;
    for (const [i, s] of starts.entries()) {
      const shape = { map, area: { x0: s.x - 2, x1: s.x + 2, z0: s.z - 2, z1: s.z + 2 } };
      const r = searchClimb(shape, { tries: 50, seed: i + 1, startY: s.y ?? 0, limit });
      assert.equal(r.escapes, 0, `${map.id}: saiu do mapa a partir de ${JSON.stringify(s)}`);
      best = Math.max(best, r.height);
    }
    // Paredes externas: 20 m nos dois mapas; a escalada fica abaixo (Sandbox ~15,5 m, treino ~12,9 m).
    assert.ok(best < 20 - 2, `${map.id}: altura máxima ${best.toFixed(2)} m`);
  }
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
