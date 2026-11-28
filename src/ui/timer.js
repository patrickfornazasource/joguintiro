// Cronômetro do circuito completo (F1-19).
// Lógica sem DOM (testável): sair da faixa de largada começa; entrar na faixa de chegada termina
// e guarda o melhor tempo no localStorage. Voltar à largada antes de terminar recomeça.
// Pontos de passagem (zones.checkpoints): a chegada só vale depois de passar por todos, na ordem.
// O mostrador (createTimerDisplay) fica no alto da tela, no meio.

/** Chave do localStorage para o melhor tempo, por mapa. */
export const BEST_KEY_PREFIX = 'luzNegra.best.';

const inside = (z, p) => p.x >= z.minX && p.x <= z.maxX && p.z >= z.minZ && p.z <= z.maxZ;

/**
 * Cria o cronômetro.
 * @param {{ start, finish }} zones faixas no chão ({ minX, maxX, minZ, maxZ })
 * @param {{ mapId: string, storage?: Storage|null }} opts
 */
export function createCircuitTimer(zones, { mapId, storage = null } = {}) {
  const key = BEST_KEY_PREFIX + mapId;
  let best = null;
  try {
    const saved = Number(storage?.getItem(key));
    best = Number.isFinite(saved) && saved > 0 ? saved : null;
  } catch {
    best = null;
  }
  let state = 'idle'; // 'idle' (fora), 'armed' (na largada), 'running', 'finished'
  let startAt = 0;
  let last = null; // último tempo terminado (s)
  let now = 0;
  const checkpoints = zones.checkpoints ?? [];
  let nextCheckpoint = 0; // índice do próximo ponto de passagem a visitar

  return {
    /**
     * Atualiza com a posição do jogador e o relógio (s). Devolve um evento quando há:
     * { type: 'start' } ou { type: 'finish', time, best, record }.
     */
    update(pos, t) {
      now = t;
      const inStart = inside(zones.start, pos);
      if (inStart) {
        state = 'armed';
        return null;
      }
      if (state === 'armed') {
        state = 'running';
        startAt = t;
        nextCheckpoint = 0;
        return { type: 'start' };
      }
      if (state === 'running' && nextCheckpoint < checkpoints.length && inside(checkpoints[nextCheckpoint], pos)) {
        nextCheckpoint++;
      }
      // Chegada antes de passar por todos os pontos de passagem não conta (a volta segue correndo).
      if (state === 'running' && nextCheckpoint === checkpoints.length && inside(zones.finish, pos)) {
        state = 'finished';
        last = t - startAt;
        const record = best === null || last < best;
        if (record) {
          best = last;
          try {
            storage?.setItem(key, String(best));
          } catch {
            // sem localStorage: o recorde vale só nesta sessão
          }
        }
        return { type: 'finish', time: last, best, record };
      }
      return null;
    },
    /** Cancela a volta em andamento (ex.: voltou para uma estação com R). */
    reset() {
      if (state === 'running') state = 'idle';
    },
    get state() {
      return state;
    },
    /** Tempo correndo agora (s), ou o último tempo terminado. */
    get elapsed() {
      if (state === 'running') return now - startAt;
      return last;
    },
    /** Quantos pontos de passagem já foram visitados nesta volta, e o total. */
    get progress() {
      return { done: state === 'running' || state === 'finished' ? nextCheckpoint : 0, total: checkpoints.length };
    },
    get best() {
      return best;
    },
  };
}

/** Formata segundos como "1:02,35" ou "42,10" (vírgula decimal, como em português). */
export function formatTime(s) {
  if (s === null || s === undefined) return '-';
  const m = Math.floor(s / 60);
  const rest = s - m * 60;
  const text = m > 0 ? `${m}:${rest.toFixed(2).padStart(5, '0')}` : rest.toFixed(2);
  return text.replace('.', ',');
}

/** Mostrador do cronômetro no alto da tela (só aparece em mapas com circuito). */
export function createTimerDisplay({ doc = document } = {}) {
  const el = doc.createElement('div');
  el.id = 'hud-timer';
  Object.assign(el.style, {
    position: 'fixed',
    top: '14px',
    left: '50%',
    transform: 'translateX(-50%)',
    font: '600 22px/1.3 ui-monospace, Consolas, monospace',
    color: '#f0f0f0',
    textShadow: '0 0 6px rgba(0, 0, 0, 0.8)',
    textAlign: 'center',
    pointerEvents: 'none',
    zIndex: '4',
  });
  doc.body.appendChild(el);
  return {
    el,
    show(timer) {
      const best = `melhor: ${formatTime(timer.best)}`;
      if (timer.state === 'running') {
        const { done, total } = timer.progress;
        const missing = done < total ? `  falta passar por ${total - done} corredor(es)` : '';
        el.textContent = `Circuito: ${formatTime(timer.elapsed)}  (${best})${missing}`;
      }
      else if (timer.state === 'finished') el.textContent = `Chegada: ${formatTime(timer.elapsed)}  (${best})`;
      else if (timer.state === 'armed') el.textContent = `Saia da faixa verde para começar  (${best})`;
      else el.textContent = timer.best === null ? '' : best;
    },
  };
}
