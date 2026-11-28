// F2-01: Sistema de Carga (GDD seção 3, Pilar 1).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHARGE, MOVE, PHYSICS } from '../shared/constants.js';
import { box, BOX_TYPES as T } from '../shared/maps/format.js';
import { createPlayer, stepPlayer, emptyInput } from '../shared/physics/player.js';
import { createCharge, updateCharge, addChargeBonus, spendCharge, refillCharge } from '../shared/combat/charge.js';
import { createLocalPlayer } from '../src/player/localPlayer.js';
import { getMap } from '../shared/maps/index.js';

const DT = PHYSICS.FIXED_DT;
const input = (over = {}) => ({ ...emptyInput(), ...over });
const floor = box(0, -0.5, 0, 2000, 1, 2000);
const floorMap = { id: 't', name: 't', boxes: [floor], spawns: [] };
const empty = () => {
  const c = createCharge();
  c.value = 0;
  return c;
};
/** Jogador "falso" só com o que a Carga lê. */
const fake = (speed, extra = {}) => ({ vel: { x: speed, y: 0, z: 0 }, wallrun: null, events: [], ...extra });

test('começa cheia (como ao renascer) e o máximo é 100 (GDD)', () => {
  assert.equal(CHARGE.CHARGE_MAX, 100);
  assert.equal(createCharge().value, 100);
});

test('parado: enche só o mínimo (CHARGE_IDLE_RATE por segundo)', () => {
  const c = empty();
  for (let i = 0; i < 1 / DT; i++) updateCharge(c, fake(0), DT);
  assert.ok(Math.abs(c.value - CHARGE.CHARGE_IDLE_RATE) < 1e-6, `${c.value}`);
  // Andando a 9 m/s (velocidade de andar) também só o mínimo.
  const w = empty();
  for (let i = 0; i < 1 / DT; i++) updateCharge(w, fake(MOVE.WALK_SPEED), DT);
  assert.ok(Math.abs(w.value - CHARGE.CHARGE_IDLE_RATE) < 1e-6, `${w.value}`);
});

test('em alta velocidade enche mais rápido: proporcional ao que passa da velocidade de andar', () => {
  const gainIn1s = (speed) => {
    const c = empty();
    for (let i = 0; i < 1 / DT; i++) updateCharge(c, fake(speed), DT);
    return c.value;
  };
  const at9 = gainIn1s(9);
  const at20 = gainIn1s(20);
  const at30 = gainIn1s(30);
  assert.ok(at20 > at9 && at30 > at20, `${at9} < ${at20} < ${at30}`);
  const expected20 = CHARGE.CHARGE_IDLE_RATE + (20 - MOVE.WALK_SPEED) * CHARGE.CHARGE_PER_SPEED;
  assert.ok(Math.abs(at20 - expected20) < 1e-6, `a 20 m/s: ${at20} (esperado ${expected20})`);
  // Só a horizontal conta: cair rápido não enche.
  const falling = empty();
  for (let i = 0; i < 1 / DT; i++) updateCharge(falling, { vel: { x: 0, y: -40, z: 0 }, wallrun: null, events: [] }, DT);
  assert.ok(Math.abs(falling.value - CHARGE.CHARGE_IDLE_RATE) < 1e-6);
});

test('correndo na parede: ganho extra (CHARGE_WALLRUN_RATE)', () => {
  const on = empty();
  const off = empty();
  for (let i = 0; i < 1 / DT; i++) {
    updateCharge(on, fake(12, { wallrun: { time: 0 } }), DT);
    updateCharge(off, fake(12), DT);
  }
  assert.ok(Math.abs(on.value - off.value - CHARGE.CHARGE_WALLRUN_RATE) < 1e-6, `${on.value - off.value}`);
});

test('bônus de pulo na parede, com um pulo na parede de verdade da física', () => {
  const wall = box(1.25, 5, 0, 0.5, 10, 20, T.SOLID);
  const map = { id: 't', name: 't', boxes: [floor, wall], spawns: [] };
  const p = createPlayer({ x: 0.6, y: 0, z: 0, yaw: 0 });
  stepPlayer(p, input(), map, DT);
  const c = empty();
  let jumps = 0;
  let bonusSeen = false;
  for (let i = 0; i < 2 / DT && jumps === 0; i++) {
    const press = i === 0 || i === 30;
    stepPlayer(p, input({ jump: press, jumpPressed: press }), map, DT);
    const before = c.value;
    updateCharge(c, p, DT);
    if (p.events.some((e) => e.type === 'wallJump')) {
      jumps++;
      const continuous = c.rate * DT;
      bonusSeen = Math.abs(c.value - before - continuous - CHARGE.CHARGE_WALLJUMP_BONUS) < 1e-6;
    }
  }
  assert.equal(jumps, 1, 'fez um pulo na parede');
  assert.ok(bonusSeen, 'ganhou o bônus do pulo na parede');
});

test('deslize longo dá bônus; deslize curto não (duração vem do evento slideEnd da física)', () => {
  const slide = (seconds) => {
    const p = createPlayer({ x: 0, y: 0, z: 0, yaw: 0 });
    stepPlayer(p, input(), floorMap, DT);
    p.vel = { x: 0, y: 0, z: -14 };
    const c = empty();
    let end = null;
    let bonus = 0;
    for (let i = 0; i < 3 / DT && !end; i++) {
      const t = i * DT;
      const crouch = t < seconds;
      stepPlayer(p, input({ moveZ: 1, yaw: 0, crouch, crouchPressed: i === 0 }), floorMap, DT);
      const before = c.value;
      updateCharge(c, p, DT);
      end = p.events.find((e) => e.type === 'slideEnd') ?? null;
      if (end) bonus = c.value - before - c.rate * DT;
    }
    return { end, bonus };
  };
  const long = slide(0.8);
  assert.ok(long.end && Math.abs(long.end.duration - 0.8) < 0.02, `deslize longo: ${long.end?.duration}`);
  assert.ok(Math.abs(long.bonus - CHARGE.CHARGE_LONG_SLIDE_BONUS) < 1e-6, `bônus ${long.bonus}`);
  const short = slide(0.3);
  assert.ok(short.end && short.end.duration < CHARGE.CHARGE_LONG_SLIDE_TIME, `deslize curto: ${short.end?.duration}`);
  assert.ok(Math.abs(short.bonus) < 1e-6, `sem bônus: ${short.bonus}`);
});

test('teto de 100: nem o ganho nem os bônus passam do máximo', () => {
  const c = createCharge();
  c.value = 99;
  updateCharge(c, fake(45, { wallrun: {}, events: [{ type: 'wallJump' }, { type: 'slideEnd', duration: 5 }] }), 1);
  assert.equal(c.value, 100);
  assert.equal(addChargeBonus(c, 50), 0);
  c.value = 95;
  assert.equal(addChargeBonus(c, 50), 5);
  assert.equal(c.value, 100);
});

test('gastar: sem Carga suficiente não gasta nada; com Carga, gasta o valor certo', () => {
  const c = createCharge();
  c.value = 9;
  assert.equal(spendCharge(c, 10), false);
  assert.equal(c.value, 9);
  assert.equal(spendCharge(c, 9), true);
  assert.equal(c.value, 0);
  assert.equal(spendCharge(c, -5), false, 'valor negativo não vale');
  assert.equal(spendCharge(c, Number.NaN), false, 'valor inválido não vale');
});

test('jogador local: a Carga enche correndo, volta cheia ao renascer e segue o painel F4 ao vivo', () => {
  const chargeCfg = { ...CHARGE };
  const me = createLocalPlayer({ map: getMap('sandbox'), chargeCfg });
  me.charge.value = 0;
  const keys = (...held) => ({ isDown: (a) => held.includes(a), pressed: () => false });
  for (let i = 0; i < 1 / DT; i++) me.step(keys('forward'), DT);
  const walked = me.charge.value;
  assert.ok(walked > 0 && walked < CHARGE.CHARGE_IDLE_RATE + 0.5, `andando 1 s: ${walked}`);
  chargeCfg.CHARGE_IDLE_RATE = 20; // como o painel F4 faria
  const before = me.charge.value;
  for (let i = 0; i < 1 / DT; i++) me.step(keys(), DT);
  assert.ok(me.charge.value - before > 19, `com 20/s no painel: ${me.charge.value - before}`);
  me.charge.value = 5;
  me.respawnNearest();
  assert.equal(me.charge.value, 100, 'renasce com Carga cheia');
});

test('refillCharge enche até o máximo', () => {
  const c = empty();
  refillCharge(c);
  assert.equal(c.value, CHARGE.CHARGE_MAX);
});
