import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInputState, attachInput, BINDINGS, ACTIONS, MOUSE } from '../src/core/input.js';

test('todas as ações pedidas existem no mapa', () => {
  const expected = ['forward', 'back', 'left', 'right', 'jump', 'crouch', 'dash', 'fire',
    'altFire', 'scoreboard', 'weapon1', 'weapon2', 'weapon3'];
  assert.deepEqual([...ACTIONS].sort(), [...expected].sort());
  assert.ok(Object.isFrozen(BINDINGS));
});

test('isDown acompanha tecla segurada', () => {
  const s = createInputState();
  assert.equal(s.isDown('forward'), false);
  s.press('KeyW');
  assert.equal(s.isDown('forward'), true);
  s.release('KeyW');
  assert.equal(s.isDown('forward'), false);
});

test('pressed vale só para um passo', () => {
  const s = createInputState();
  s.press('Space');
  assert.equal(s.pressed('jump'), true);
  s.endStep();
  assert.equal(s.pressed('jump'), false, 'segurar não repete o aperto');
  assert.equal(s.isDown('jump'), true);
});

test('aperto rápido de espaço entre dois passos não se perde', () => {
  const s = createInputState();
  s.endStep(); // passo 1
  s.press('Space'); // aperta e solta antes do passo 2
  s.release('Space');
  assert.equal(s.isDown('jump'), false);
  assert.equal(s.pressed('jump'), true, 'o passo 2 ainda vê o pulo');
  s.endStep(); // passo 2 consumiu
  assert.equal(s.pressed('jump'), false);
});

test('quadro sem passo de simulação guarda o aperto para o próximo passo', () => {
  const s = createInputState();
  s.press('Space');
  s.release('Space');
  // nenhum endStep aqui (quadro rápido, 0 passos)
  assert.equal(s.pressed('jump'), true);
});

test('repetição automática do teclado não gera novo aperto', () => {
  const s = createInputState();
  s.press('Space');
  s.endStep();
  s.press('Space'); // keydown repetido com a tecla ainda segurada
  assert.equal(s.pressed('jump'), false);
});

test('Ctrl e C fazem a mesma coisa (agachar/deslizar)', () => {
  for (const code of ['ControlLeft', 'ControlRight', 'KeyC']) {
    const s = createInputState();
    s.press(code);
    assert.equal(s.isDown('crouch'), true, code);
    assert.equal(s.pressed('crouch'), true, code);
  }
});

test('segurar C e depois apertar Ctrl não conta como novo aperto', () => {
  const s = createInputState();
  s.press('KeyC');
  s.endStep();
  s.press('ControlLeft');
  assert.equal(s.pressed('crouch'), false);
  s.release('KeyC');
  assert.equal(s.isDown('crouch'), true, 'Ctrl ainda segura');
  s.release('ControlLeft');
  assert.equal(s.isDown('crouch'), false);
});

test('botões do mouse: esquerdo atira, direito descarga', () => {
  const s = createInputState();
  s.press(MOUSE.LEFT);
  s.press(MOUSE.RIGHT);
  assert.equal(s.pressed('fire'), true);
  assert.equal(s.pressed('altFire'), true);
});

test('teclas de arma, placar e dash', () => {
  const s = createInputState();
  for (const [code, action] of [['Digit1', 'weapon1'], ['Digit2', 'weapon2'], ['Digit3', 'weapon3'],
    ['Tab', 'scoreboard'], ['ShiftLeft', 'dash'], ['ShiftRight', 'dash']]) {
    s.press(code);
    assert.equal(s.isDown(action), true, code);
    s.release(code);
  }
});

test('tecla sem ação é ignorada', () => {
  const s = createInputState();
  s.press('KeyZ');
  assert.equal(s.isBound('KeyZ'), false);
  assert.equal(ACTIONS.some((a) => s.isDown(a)), false);
});

test('consumeMouseDelta soma e zera', () => {
  const s = createInputState();
  s.addMouseDelta(3, -2);
  s.addMouseDelta(4, 1);
  s.addMouseDelta(NaN, undefined);
  assert.deepEqual(s.consumeMouseDelta(), { x: 7, y: -1 });
  assert.deepEqual(s.consumeMouseDelta(), { x: 0, y: 0 });
});

test('releaseAll solta tudo mas mantém o aperto guardado', () => {
  const s = createInputState();
  s.press('KeyW');
  s.press('Space');
  s.releaseAll();
  assert.equal(s.isDown('forward'), false);
  assert.equal(s.pressed('jump'), true);
});

// Parte do navegador com objetos falsos (sem DOM real).
function fakeTarget() {
  const listeners = {};
  return {
    listeners,
    addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
    removeEventListener(type, fn) { listeners[type] = (listeners[type] || []).filter((f) => f !== fn); },
    fire(type, ev = {}) {
      const e = { defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...ev };
      for (const fn of listeners[type] || []) fn(e);
      return e;
    },
  };
}

function setup() {
  const win = fakeTarget();
  const doc = { ...fakeTarget(), pointerLockElement: null, hidden: false };
  Object.assign(doc, fakeTarget());
  doc.pointerLockElement = null;
  const canvas = fakeTarget();
  canvas.requestPointerLock = () => {
    doc.pointerLockElement = canvas;
    doc.fire('pointerlockchange');
  };
  const input = attachInput({ canvas, target: win, doc });
  return { win, doc, canvas, input };
}

test('navegador: clique trava o ponteiro sem atirar; depois clique atira', () => {
  const { canvas, input } = setup();
  canvas.fire('mousedown', { button: 0 });
  assert.equal(input.isLocked(), true);
  assert.equal(input.pressed('fire'), false, 'clique de travar não atira');
  canvas.fire('mousedown', { button: 0 });
  assert.equal(input.pressed('fire'), true);
});

test('navegador: mouse só conta com ponteiro travado', () => {
  const { win, canvas, input } = setup();
  win.fire('mousemove', { movementX: 10, movementY: 5 });
  assert.deepEqual(input.consumeMouseDelta(), { x: 0, y: 0 });
  canvas.fire('mousedown', { button: 0 });
  win.fire('mousemove', { movementX: 10, movementY: 5 });
  assert.deepEqual(input.consumeMouseDelta(), { x: 10, y: 5 });
});

test('navegador: Esc (ponteiro solto) solta botões e teclas', () => {
  const { win, doc, canvas, input } = setup();
  canvas.fire('mousedown', { button: 0 });
  canvas.fire('mousedown', { button: 0 });
  win.fire('keydown', { code: 'KeyW' });
  doc.pointerLockElement = null;
  doc.fire('pointerlockchange');
  assert.equal(input.isLocked(), false);
  assert.equal(input.isDown('fire'), false);
  assert.equal(input.isDown('forward'), false);
});

test('navegador: teclas do jogo bloqueiam o padrão (Espaço, Tab, Ctrl); outras não', () => {
  const { win, input } = setup();
  for (const code of ['Space', 'Tab', 'ControlLeft', 'KeyC']) {
    assert.equal(win.fire('keydown', { code }).defaultPrevented, true, code);
  }
  assert.equal(win.fire('keydown', { code: 'F5' }).defaultPrevented, false);
  assert.equal(input.isDown('crouch'), true);
});

test('navegador: digitando num campo (painel de ajuste F4), as teclas são do campo, não do jogo', () => {
  const { win, input } = setup();
  for (const tagName of ['INPUT', 'TEXTAREA']) {
    const e = win.fire('keydown', { code: 'Digit1', target: { tagName } });
    assert.equal(e.defaultPrevented, false, `${tagName}: o número entra no campo`);
    win.fire('keydown', { code: 'KeyW', target: { tagName } });
  }
  assert.equal(input.isDown('weapon1'), false);
  assert.equal(input.isDown('forward'), false);
  win.fire('keydown', { code: 'KeyW', target: { tagName: 'CANVAS' } });
  assert.equal(input.isDown('forward'), true, 'fora de campos, vale para o jogo');
});

test('navegador: menu do botão direito bloqueado', () => {
  const { canvas } = setup();
  assert.equal(canvas.fire('contextmenu').defaultPrevented, true);
});

test('navegador: perder o foco solta as teclas', () => {
  const { win, input } = setup();
  win.fire('keydown', { code: 'KeyW' });
  win.fire('blur');
  assert.equal(input.isDown('forward'), false);
});

test('navegador: detach remove os ouvintes', () => {
  const { win, input } = setup();
  input.detach();
  win.fire('keydown', { code: 'KeyW' });
  assert.equal(input.isDown('forward'), false);
});
