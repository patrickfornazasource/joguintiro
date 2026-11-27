import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PHYSICS } from '../shared/constants.js';
import { advance } from '../shared/loop.js';
import { createLoop } from '../src/core/loop.js';

const STEP = PHYSICS.FIXED_DT;

/** Simula `seconds` de quadros a `fps` só com advance; devolve o total de passos. */
function simulate(fps, seconds = 1) {
  let acc = 0;
  let steps = 0;
  for (let i = 0; i < Math.round(fps * seconds); i++) {
    const r = advance(acc, 1 / fps, STEP);
    acc = r.acc;
    steps += r.steps;
  }
  return steps;
}

for (const fps of [30, 60, 144]) {
  test(`1 s a ${fps} FPS dá ~120 passos`, () => {
    const steps = simulate(fps);
    assert.ok(Math.abs(steps - 120) <= 1, `${fps} FPS deu ${steps} passos`);
  });
}

test('quadro de 1/60 s dá exatamente 2 passos sem sobra relevante', () => {
  const r = advance(0, 1 / 60, STEP);
  assert.equal(r.steps, 2);
  assert.ok(r.acc >= 0 && r.acc < 1e-9);
});

test('quadro curto acumula até completar um passo', () => {
  const a = advance(0, STEP / 2, STEP);
  assert.equal(a.steps, 0);
  const b = advance(a.acc, STEP / 2, STEP);
  assert.equal(b.steps, 1);
});

test('acumulador limitado a PHYSICS.MAX_ACCUMULATOR (aba volta do segundo plano)', () => {
  const r = advance(0, 5, STEP);
  assert.equal(r.steps, Math.floor(PHYSICS.MAX_ACCUMULATOR / STEP + 1e-9));
  assert.ok(r.acc < STEP);
});

test('quadro inválido (negativo ou NaN) não gera passos', () => {
  assert.deepEqual(advance(0, -1, STEP), { steps: 0, acc: 0 });
  assert.deepEqual(advance(0, NaN, STEP), { steps: 0, acc: 0 });
});

/** Roda createLoop com relógio falso a `fps` por `seconds`. */
function runLoop(fps, seconds) {
  let t = 0;
  let pending = null;
  let simulated = 0;
  let renders = 0;
  const loop = createLoop({
    step: STEP,
    update: (dt) => {
      simulated += dt;
    },
    render: (alpha) => {
      renders++;
      assert.ok(alpha >= 0 && alpha < 1, `alpha fora de 0 a 1: ${alpha}`);
    },
    now: () => t,
    raf: (cb) => {
      pending = cb;
    },
  });
  loop.start();
  for (let i = 0; i < Math.round(fps * seconds); i++) {
    t += 1000 / fps;
    const cb = pending;
    pending = null;
    cb();
  }
  loop.stop();
  return { simulated, renders };
}

test('createLoop: o jogo anda o mesmo tempo (cubo gira igual) a 30, 60 e 144 FPS', () => {
  for (const fps of [30, 60, 144]) {
    const { simulated, renders } = runLoop(fps, 2);
    assert.equal(renders, fps * 2);
    assert.ok(Math.abs(simulated - 2) <= STEP + 1e-9, `${fps} FPS simulou ${simulated} s`);
  }
});

test('createLoop: stop interrompe os quadros', () => {
  let pending = null;
  let updates = 0;
  let t = 0;
  const loop = createLoop({
    update: () => updates++,
    now: () => t,
    raf: (cb) => {
      pending = cb;
    },
  });
  loop.start();
  loop.stop();
  t += 100;
  pending();
  assert.equal(updates, 0);
  assert.equal(loop.running, false);
});
