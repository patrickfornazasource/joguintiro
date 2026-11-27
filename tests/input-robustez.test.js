// Casos de navegador "difícil": tecla sem código físico e Shift/Ctrl sem evento de soltar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attachInput, resolveCode } from '../src/core/input.js';

test('resolveCode usa o código físico quando existe', () => {
  assert.equal(resolveCode({ code: 'KeyW', key: 'z' }), 'KeyW');
});

test('resolveCode: sem código, usa o caractere (teclado virtual ou remoto)', () => {
  assert.equal(resolveCode({ code: '', key: 'w' }), 'KeyW');
  assert.equal(resolveCode({ code: '', key: 'W' }), 'KeyW');
  assert.equal(resolveCode({ code: 'Unidentified', key: ' ' }), 'Space');
  assert.equal(resolveCode({ code: '', key: 'Shift' }), 'ShiftLeft');
  assert.equal(resolveCode({ code: '', key: 'Control' }), 'ControlLeft');
  assert.equal(resolveCode({ code: '', key: '2' }), 'Digit2');
  assert.equal(resolveCode({ code: '', key: 'x' }), '');
  assert.equal(resolveCode({}), '');
});

function setup() {
  const make = () => {
    const listeners = {};
    return {
      addEventListener: (t, fn) => (listeners[t] ||= []).push(fn),
      removeEventListener: () => {},
      fire(t, ev = {}) {
        const e = { preventDefault() {}, ...ev };
        for (const fn of listeners[t] || []) fn(e);
      },
    };
  };
  const win = make();
  const doc = { ...make(), pointerLockElement: null, hidden: false };
  Object.assign(doc, make());
  const canvas = make();
  return { win, input: attachInput({ canvas, target: win, doc }) };
}

test('tecla sem código físico é reconhecida e solta', () => {
  const { win, input } = setup();
  win.fire('keydown', { code: '', key: 'w' });
  assert.equal(input.isDown('forward'), true);
  win.fire('keyup', { code: '', key: 'w' });
  assert.equal(input.isDown('forward'), false);
});

test('Shift que perdeu o evento de soltar não fica preso', () => {
  const { win, input } = setup();
  win.fire('keydown', { code: 'ShiftLeft', key: 'Shift', shiftKey: true });
  assert.equal(input.isDown('dash'), true);
  // o "soltar" do Shift nunca chegou; o próximo evento diz shiftKey: false
  win.fire('keydown', { code: 'KeyW', key: 'w', shiftKey: false });
  assert.equal(input.isDown('dash'), false, 'dash não fica preso');
  assert.equal(input.isDown('forward'), true);
});

test('Ctrl que perdeu o evento de soltar não fica preso (movimento do mouse avisa)', () => {
  const { win, input } = setup();
  win.fire('keydown', { code: 'ControlLeft', key: 'Control', ctrlKey: true });
  assert.equal(input.isDown('crouch'), true);
  win.fire('mousemove', { ctrlKey: false, movementX: 0, movementY: 0 });
  assert.equal(input.isDown('crouch'), false);
});

test('Shift segurado de verdade continua valendo', () => {
  const { win, input } = setup();
  win.fire('keydown', { code: 'ShiftLeft', key: 'Shift', shiftKey: true });
  win.fire('keydown', { code: 'KeyW', key: 'W', shiftKey: true });
  assert.equal(input.isDown('dash'), true);
  assert.equal(input.isDown('forward'), true);
});

test('C segurado não é solto pelo indicador de Ctrl', () => {
  const { win, input } = setup();
  win.fire('keydown', { code: 'KeyC', key: 'c', ctrlKey: false });
  win.fire('mousemove', { ctrlKey: false });
  assert.equal(input.isDown('crouch'), true);
});

test('última tecla fica disponível para o painel', () => {
  const { win, input } = setup();
  assert.equal(input.lastKey, null);
  win.fire('keydown', { code: 'KeyZ', key: 'z' });
  assert.deepEqual(input.lastKey, { code: 'KeyZ', key: 'z' });
});
