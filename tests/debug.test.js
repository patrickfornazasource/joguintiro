import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatValue, createRateCounter, createDebugPanel, STORAGE_KEY } from '../src/ui/debug.js';

test('formatValue: números, vetores, listas e vazio', () => {
  assert.equal(formatValue(3), '3');
  assert.equal(formatValue(1.23456), '1.23');
  assert.equal(formatValue({ x: 1, y: 2.5, z: -3 }), '(1, 2.50, -3)');
  assert.equal(formatValue(['jump', 'forward']), 'jump, forward');
  assert.equal(formatValue([]), '-');
  assert.equal(formatValue(undefined), '-');
  assert.equal(formatValue('sim'), 'sim');
});

test('contador: 60 eventos em 1 s dá 60 por segundo', () => {
  const c = createRateCounter(250);
  c.sample(0);
  for (let i = 1; i <= 60; i++) {
    c.tick();
    c.sample((i * 1000) / 60);
  }
  assert.ok(Math.abs(c.rate - 60) < 1, `taxa ${c.rate}`);
});

test('contador: 120 passos por segundo', () => {
  const c = createRateCounter(250);
  c.sample(0);
  for (let i = 1; i <= 240; i++) {
    c.tick();
    c.sample((i * 1000) / 120);
  }
  assert.ok(Math.abs(c.rate - 120) < 1, `taxa ${c.rate}`);
});

// Navegador falso.
function fakeEnv({ search = '', stored = null, storageThrows = false } = {}) {
  const listeners = {};
  const win = {
    addEventListener: (t, fn) => (listeners[t] ||= []).push(fn),
    removeEventListener: (t, fn) => (listeners[t] = (listeners[t] || []).filter((f) => f !== fn)),
    fire(t, ev) {
      const e = { defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...ev };
      for (const fn of listeners[t] || []) fn(e);
      return e;
    },
  };
  const data = new Map(stored === null ? [] : [[STORAGE_KEY, stored]]);
  const storage = storageThrows
    ? { getItem() { throw new Error('bloqueado'); }, setItem() { throw new Error('bloqueado'); } }
    : { getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, v) };
  const children = [];
  const doc = {
    createElement: () => ({ style: {}, textContent: '', remove() { children.splice(children.indexOf(this), 1); } }),
    body: { appendChild: (el) => children.push(el) },
  };
  return { win, doc, storage, data, children, search };
}

test('painel começa escondido e F3 alterna, lembrando a escolha', () => {
  const env = fakeEnv();
  const debug = createDebugPanel(env);
  assert.equal(debug.visible, false);
  assert.equal(debug.el.style.display, 'none');
  const e = env.win.fire('keydown', { code: 'F3' });
  assert.equal(e.defaultPrevented, true);
  assert.equal(debug.visible, true);
  assert.equal(debug.el.style.display, 'block');
  assert.equal(env.data.get(STORAGE_KEY), '1');
  env.win.fire('keydown', { code: 'F3' });
  assert.equal(debug.visible, false);
  assert.equal(env.data.get(STORAGE_KEY), '0');
});

test('segurar F3 (repetição) não fica piscando', () => {
  const env = fakeEnv();
  const debug = createDebugPanel(env);
  env.win.fire('keydown', { code: 'F3' });
  env.win.fire('keydown', { code: 'F3', repeat: true });
  assert.equal(debug.visible, true);
});

test('escolha salva abre o painel ligado', () => {
  const debug = createDebugPanel(fakeEnv({ stored: '1' }));
  assert.equal(debug.visible, true);
});

test('?debug=1 força o painel ligado', () => {
  const debug = createDebugPanel(fakeEnv({ search: '?debug=1' }));
  assert.equal(debug.visible, true);
});

test('localStorage bloqueado não quebra o painel', () => {
  const env = fakeEnv({ storageThrows: true });
  const debug = createDebugPanel(env);
  assert.equal(debug.visible, false);
  env.win.fire('keydown', { code: 'F3' });
  assert.equal(debug.visible, true);
});

test('valores aparecem e atualizam no máximo 4 vezes por segundo', () => {
  const env = fakeEnv({ search: '?debug=1' });
  const debug = createDebugPanel(env);
  debug.set('posição', { x: 1, y: 2, z: 3 });
  debug.frame(0);
  assert.match(debug.el.textContent, /posição: \(1, 2, 3\)/);
  assert.match(debug.el.textContent, /FPS: medindo\.\.\./, 'antes da 1ª medição não mostra 0');
  debug.set('posição', { x: 9, y: 9, z: 9 });
  debug.frame(100); // antes de 250 ms: não redesenha
  assert.match(debug.el.textContent, /\(1, 2, 3\)/);
  for (let t = 101; t <= 300; t += 1000 / 60) debug.frame(t);
  assert.match(debug.el.textContent, /\(9, 9, 9\)/, 'depois de 250 ms redesenha');
});

test('FPS e passos/s medidos: 60 quadros e 120 passos por segundo', () => {
  const debug = createDebugPanel(fakeEnv({ search: '?debug=1' }));
  for (let i = 0; i <= 120; i++) {
    debug.step();
    debug.step();
    debug.frame((i * 1000) / 60);
  }
  assert.match(debug.el.textContent, /^FPS: (59|60|61)$/m);
  assert.match(debug.el.textContent, /^passos\/s: (119|120|121)$/m);
});

test('remove e destroy', () => {
  const env = fakeEnv({ search: '?debug=1' });
  const debug = createDebugPanel(env);
  debug.set('a', 1);
  debug.remove('a');
  debug.frame(0);
  assert.doesNotMatch(debug.el.textContent, /a: 1/);
  debug.destroy();
  assert.equal(env.children.length, 0);
  env.win.fire('keydown', { code: 'F3' });
  assert.equal(debug.visible, true, 'depois de destroy, F3 não faz nada');
});
