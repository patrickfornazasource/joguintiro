// Painel de depuração (tecla F3).
// Mostra FPS, passos de simulação por segundo, chamadas de desenho e qualquer
// informação publicada por outros módulos com debug.set(chave, valor).
// Abrir com ?debug=1 no endereço força o painel ligado (usado por npm run shot).

/** Intervalo de atualização do texto do painel (ms): 4 vezes por segundo. */
const REFRESH_MS = 250;
/** Chave usada para lembrar se o painel estava ligado. */
export const STORAGE_KEY = 'luzNegra.debug';

/** Formata um valor para o painel: números com 2 casas, vetores {x,y,z}, listas. */
export function formatValue(value) {
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(2);
  if (Array.isArray(value)) return value.length ? value.map(formatValue).join(', ') : '-';
  if (value && typeof value === 'object' && 'x' in value && 'y' in value && 'z' in value) {
    return `(${formatValue(value.x)}, ${formatValue(value.y)}, ${formatValue(value.z)})`;
  }
  if (value === undefined || value === null || value === '') return '-';
  return String(value);
}

/**
 * Contador de eventos por segundo (quadros, passos). Sem DOM, testável.
 * tick() a cada evento; sample(agoraMs) devolve a taxa quando a janela fecha.
 */
export function createRateCounter(windowMs = REFRESH_MS) {
  let count = 0;
  let start = null;
  let rate = 0;
  let measured = false;
  return {
    tick() {
      count++;
    },
    /** Atualiza e devolve a taxa (por segundo) se a janela já passou. */
    sample(nowMs) {
      if (start === null) start = nowMs;
      const elapsed = nowMs - start;
      if (elapsed >= windowMs) {
        rate = (count * 1000) / elapsed;
        measured = true;
        count = 0;
        start = nowMs;
      }
      return rate;
    },
    get rate() {
      return rate;
    },
    /** Já fechou pelo menos uma janela de medição? */
    get measured() {
      return measured;
    },
  };
}

/** Texto de uma taxa: "medindo..." até a primeira medição. */
function rateText(counter) {
  return counter.measured ? counter.rate.toFixed(0) : 'medindo...';
}

/** Lê a escolha salva; navegadores sem localStorage (ou bloqueado) não quebram o jogo. */
function readStored(storage) {
  try {
    return storage?.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeStored(storage, on) {
  try {
    storage?.setItem(STORAGE_KEY, on ? '1' : '0');
  } catch {
    // sem localStorage: só não lembra a escolha
  }
}

/**
 * Cria o painel.
 * @param {{ doc?: Document, win?: Window, storage?: Storage, search?: string }} [opts]
 */
export function createDebugPanel({
  doc = document,
  win = window,
  storage = (() => {
    try {
      return win.localStorage;
    } catch {
      return null;
    }
  })(),
  search = win.location?.search ?? '',
} = {}) {
  const values = new Map();
  const fps = createRateCounter();
  const sps = createRateCounter();
  let lastRefresh = -Infinity;

  const forced = new URLSearchParams(search).get('debug') === '1';
  let visible = forced || readStored(storage);

  const el = doc.createElement('pre');
  el.id = 'debug-panel';
  Object.assign(el.style, {
    position: 'fixed',
    top: '8px',
    left: '8px',
    margin: '0',
    padding: '6px 8px',
    font: '12px/1.4 ui-monospace, Consolas, monospace',
    color: '#e8e8e8',
    background: 'rgba(0, 0, 0, 0.6)',
    borderRadius: '4px',
    pointerEvents: 'none',
    whiteSpace: 'pre',
    zIndex: '10',
    display: visible ? 'block' : 'none',
  });
  doc.body.appendChild(el);

  function render() {
    const lines = [
      'LUZ NEGRA  (F3 esconde)',
      `FPS: ${rateText(fps)}`,
      `passos/s: ${rateText(sps)}`,
    ];
    for (const [key, value] of values) lines.push(`${key}: ${formatValue(value)}`);
    el.textContent = lines.join('\n');
  }

  function setVisible(on) {
    visible = on;
    el.style.display = on ? 'block' : 'none';
    writeStored(storage, on);
    if (on) render();
  }

  const onKeyDown = (e) => {
    if (e.code !== 'F3') return;
    e.preventDefault(); // F3 abre a busca em alguns navegadores
    if (!e.repeat) setVisible(!visible);
  };
  win.addEventListener('keydown', onKeyDown);

  return {
    /** Publica uma informação no painel. */
    set(key, value) {
      values.set(key, value);
    },
    /** Remove uma informação. */
    remove(key) {
      values.delete(key);
    },
    /** Chamar a cada passo de simulação. */
    step() {
      sps.tick();
    },
    /** Chamar a cada quadro desenhado (nowMs = performance.now()). */
    frame(nowMs) {
      fps.tick();
      fps.sample(nowMs);
      sps.sample(nowMs);
      if (visible && nowMs - lastRefresh >= REFRESH_MS) {
        lastRefresh = nowMs;
        render();
      }
    },
    toggle() {
      setVisible(!visible);
    },
    get visible() {
      return visible;
    },
    el,
    destroy() {
      win.removeEventListener('keydown', onKeyDown);
      el.remove();
    },
  };
}
