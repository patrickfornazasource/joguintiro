// Leitura de teclado e mouse.
//
// Duas partes:
// 1. createInputState(): lógica pura (sem DOM), testável com eventos falsos.
// 2. attachInput(): liga essa lógica aos eventos do navegador (teclas, mouse,
//    trava do ponteiro, menu de contexto).
//
// Passo fixo: pressed(acao) fica verdadeiro desde o aperto até o fim do próximo
// passo de simulação (endStep). Assim um toque rápido entre dois passos não se perde,
// e o aperto vale para um passo só.

/** Nome usado para os botões do mouse no mapa de ações (MouseEvent.button). */
export const MOUSE = Object.freeze({ LEFT: 'Mouse0', MIDDLE: 'Mouse1', RIGHT: 'Mouse2' });

/**
 * Mapa de ações para teclas (KeyboardEvent.code) e botões do mouse.
 * Ctrl e C fazem a mesma coisa: Ctrl+W fecha a aba no navegador, então C é a opção segura.
 */
export const BINDINGS = Object.freeze({
  forward: ['KeyW'],
  back: ['KeyS'],
  left: ['KeyA'],
  right: ['KeyD'],
  jump: ['Space'],
  crouch: ['ControlLeft', 'ControlRight', 'KeyC'],
  dash: ['ShiftLeft', 'ShiftRight'],
  fire: [MOUSE.LEFT],
  altFire: [MOUSE.RIGHT],
  scoreboard: ['Tab'],
  weapon1: ['Digit1'],
  weapon2: ['Digit2'],
  weapon3: ['Digit3'],
});

/** Lista de ações conhecidas. */
export const ACTIONS = Object.freeze(Object.keys(BINDINGS));

/**
 * Estado de entrada sem DOM.
 * @param {Record<string, string[]>} [bindings]
 */
export function createInputState(bindings = BINDINGS) {
  const codeToActions = new Map();
  for (const [action, codes] of Object.entries(bindings)) {
    for (const code of codes) {
      if (!codeToActions.has(code)) codeToActions.set(code, []);
      codeToActions.get(code).push(action);
    }
  }

  const held = new Set(); // códigos (teclas/botões) segurados agora
  const latched = new Set(); // ações apertadas ainda não consumidas por um passo
  let mouseX = 0;
  let mouseY = 0;

  function actionDown(action) {
    for (const code of bindings[action] || []) if (held.has(code)) return true;
    return false;
  }

  /** Um código foi apertado. Ignora repetição automática do teclado. */
  function press(code) {
    if (held.has(code)) return;
    const actions = codeToActions.get(code) || [];
    const wasDown = actions.map(actionDown);
    held.add(code);
    actions.forEach((action, i) => {
      if (!wasDown[i]) latched.add(action);
    });
  }

  /** Um código foi solto. O aperto guardado continua até o próximo passo. */
  function release(code) {
    held.delete(code);
  }

  return {
    press,
    release,
    /** Solta tudo (janela perdeu o foco, ponteiro destravado). Apertos guardados ficam. */
    releaseAll() {
      held.clear();
    },
    /** Soma movimento do mouse (pixels). */
    addMouseDelta(dx, dy) {
      mouseX += Number.isFinite(dx) ? dx : 0;
      mouseY += Number.isFinite(dy) ? dy : 0;
    },
    /** A ação está segurada agora? */
    isDown(action) {
      return actionDown(action);
    },
    /** A ação foi apertada desde o último passo de simulação? */
    pressed(action) {
      return latched.has(action);
    },
    /** Movimento do mouse acumulado desde a última chamada (e zera). */
    consumeMouseDelta() {
      const d = { x: mouseX, y: mouseY };
      mouseX = 0;
      mouseY = 0;
      return d;
    },
    /** Chamar no fim de cada passo de simulação: consome os apertos guardados. */
    endStep() {
      latched.clear();
    },
    /** Uma tecla (KeyboardEvent.code) está ligada a alguma ação? */
    isBound(code) {
      return codeToActions.has(code);
    },
  };
}

/**
 * Liga o estado de entrada aos eventos do navegador.
 * Clique no canvas trava o ponteiro; Esc solta (comportamento do navegador).
 * @param {{ canvas: HTMLElement, target?: Window, doc?: Document, bindings?: object }} opts
 */
export function attachInput({ canvas, target = window, doc = document, bindings = BINDINGS }) {
  const state = createInputState(bindings);
  const isLocked = () => doc.pointerLockElement === canvas;

  const onKeyDown = (e) => {
    if (!state.isBound(e.code)) return;
    // Evita rolagem (Espaço), troca de foco (Tab) e atalhos com Ctrl quando possível.
    e.preventDefault();
    state.press(e.code);
  };
  const onKeyUp = (e) => {
    if (!state.isBound(e.code)) return;
    e.preventDefault();
    state.release(e.code);
  };
  const onCanvasMouseDown = (e) => {
    if (!isLocked()) {
      // O primeiro clique só trava o ponteiro, não conta como tiro.
      e.preventDefault();
      // O Chrome recusa a trava logo após o Esc (e rejeita a promessa): ignorar sem erro.
      canvas.requestPointerLock?.()?.catch?.(() => {});
      return;
    }
    state.press(`Mouse${e.button}`);
  };
  const onMouseUp = (e) => state.release(`Mouse${e.button}`);
  const onMouseMove = (e) => {
    if (isLocked()) state.addMouseDelta(e.movementX, e.movementY);
  };
  const onContextMenu = (e) => e.preventDefault();
  const onBlur = () => state.releaseAll();
  const onVisibility = () => {
    if (doc.hidden) state.releaseAll();
  };
  const onLockChange = () => {
    if (!isLocked()) {
      state.releaseAll();
      state.consumeMouseDelta();
    }
  };

  target.addEventListener('keydown', onKeyDown);
  target.addEventListener('keyup', onKeyUp);
  target.addEventListener('mouseup', onMouseUp);
  target.addEventListener('mousemove', onMouseMove);
  target.addEventListener('blur', onBlur);
  canvas.addEventListener('mousedown', onCanvasMouseDown);
  canvas.addEventListener('contextmenu', onContextMenu);
  doc.addEventListener('visibilitychange', onVisibility);
  doc.addEventListener('pointerlockchange', onLockChange);

  return {
    isDown: state.isDown,
    pressed: state.pressed,
    consumeMouseDelta: state.consumeMouseDelta,
    endStep: state.endStep,
    isLocked,
    detach() {
      target.removeEventListener('keydown', onKeyDown);
      target.removeEventListener('keyup', onKeyUp);
      target.removeEventListener('mouseup', onMouseUp);
      target.removeEventListener('mousemove', onMouseMove);
      target.removeEventListener('blur', onBlur);
      canvas.removeEventListener('mousedown', onCanvasMouseDown);
      canvas.removeEventListener('contextmenu', onContextMenu);
      doc.removeEventListener('visibilitychange', onVisibility);
      doc.removeEventListener('pointerlockchange', onLockChange);
    },
  };
}
