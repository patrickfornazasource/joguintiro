// Painel de ajuste ao vivo do movimento (F1-20). Só aparece com ?ajuste=1 no endereço.
// F4 abre e fecha. Cada número de MOVE tem um controle deslizante (nome em português, unidade,
// valor padrão e um botão para voltar ao padrão). Mudar um controle muda o objeto `cfg`, que
// o jogador local passa para a física: vale no passo seguinte.
// Botões: Restaurar padrão, Copiar valores (JSON) e Salvar neste navegador.
// As regras (faixas, limpeza de valores, JSON) ficam em shared/tuning.js, sem DOM.
import GUI from 'lil-gui';
import { MOVE } from '../../shared/constants.js';
import { TUNING_GROUPS, tuningItem, tuningRange, sanitizeMove, changedValues, tuningJson } from '../../shared/tuning.js';

/** Chave do localStorage com os valores salvos (só os diferentes do padrão). */
export const TUNING_STORAGE_KEY = 'luzNegra.ajuste.move';

/** O painel de ajuste está ligado neste endereço (?ajuste=1)? */
export function isTuningEnabled(search) {
  return new URLSearchParams(search).get('ajuste') === '1';
}

/**
 * Números do movimento para o modo ajuste: o padrão com os valores salvos neste navegador por cima.
 * Valor salvo inválido ou fora da faixa é corrigido (sanitizeMove).
 * @returns {{ cfg: Record<string, number>, loaded: number }} loaded = quantos valores salvos valeram
 */
export function loadTuning(storage) {
  let saved = null;
  try {
    const text = storage?.getItem(TUNING_STORAGE_KEY);
    saved = text ? JSON.parse(text) : null;
  } catch {
    saved = null; // texto estragado: começa do padrão
  }
  const cfg = sanitizeMove(saved);
  return { cfg, loaded: Object.keys(changedValues(cfg)).length };
}

/** Guarda neste navegador só os valores diferentes do padrão. Devolve true se deu certo. */
export function saveTuning(storage, cfg) {
  try {
    storage.setItem(TUNING_STORAGE_KEY, JSON.stringify(changedValues(cfg)));
    return true;
  } catch {
    return false;
  }
}

/** Número para mostrar em português (vírgula decimal). */
const fmt = (v) => String(Number(v.toPrecision(6))).replace('.', ',');

/** Copia texto para a área de transferência; sem permissão, tenta o jeito antigo. */
async function copyText(text, doc) {
  try {
    await doc.defaultView.navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = doc.createElement('textarea');
    area.value = text;
    doc.body.appendChild(area);
    area.select();
    let ok = false;
    try {
      ok = doc.execCommand('copy');
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }
}

/**
 * Cria o painel (começa fechado; F4 abre).
 * @param {{ cfg: Record<string, number>, storage?: Storage|null, loaded?: number, doc?: Document }} opts
 */
export function createTuningPanel({ cfg, storage = null, loaded = 0, doc = document }) {
  const gui = new GUI({ title: 'Ajuste do movimento (F4)', width: 520 });
  gui.domElement.id = 'painel-ajuste';
  Object.assign(gui.domElement.style, { maxHeight: '96vh', overflowY: 'auto', zIndex: '20' });
  gui.domElement.style.setProperty('--name-width', '58%');
  gui.hide();

  // Explicação e mensagens (no topo do painel).
  const help = doc.createElement('div');
  Object.assign(help.style, { padding: '6px 8px', lineHeight: '1.4', whiteSpace: 'normal', color: '#ddd' });
  help.textContent = 'Arraste ou digite um valor: vale na hora. Clique no jogo para testar (o painel continua aberto); '
    + 'para mexer de novo, aperte F4 (ou Esc). Valores em amarelo estão diferentes do padrão. ↺ volta aquele valor ao padrão.';
  const status = doc.createElement('div');
  Object.assign(status.style, { padding: '0 8px 6px', color: '#00e5ff', whiteSpace: 'normal' });
  gui.$children.prepend(help, status);
  const say = (text) => {
    status.textContent = text;
  };
  if (loaded > 0) say(`Valores salvos neste navegador carregados (${loaded} diferente(s) do padrão).`);

  const controllers = [];
  /** Pinta de amarelo os valores mudados. */
  const paint = (c) => {
    const changed = Math.abs(cfg[c.property] - MOVE[c.property]) > 1e-9;
    c.$name.style.color = changed ? '#ffd400' : '';
  };
  const refresh = () => {
    for (const c of controllers) {
      c.updateDisplay();
      paint(c);
    }
  };

  // Botões primeiro, para não precisar rolar.
  const actions = {
    restore() {
      Object.assign(cfg, sanitizeMove(MOVE));
      refresh();
      say('Todos os valores voltaram ao padrão. Para manter assim da próxima vez, clique em Salvar.');
    },
    async copy() {
      const ok = await copyText(tuningJson(cfg), doc);
      const n = Object.keys(changedValues(cfg)).length;
      say(ok
        ? `Valores copiados (${n} mudado(s)). Cole na conversa para mandar.`
        : 'Não deu para copiar sozinho. Tente de novo depois de clicar no painel.');
    },
    save() {
      const ok = storage && saveTuning(storage, cfg);
      say(ok
        ? 'Salvo neste navegador: os valores voltam quando abrir o jogo de novo com ?ajuste=1.'
        : 'Este navegador não deixou salvar.');
    },
  };
  gui.add(actions, 'restore').name('Restaurar padrão');
  gui.add(actions, 'copy').name('Copiar valores');
  gui.add(actions, 'save').name('Salvar neste navegador');

  for (const group of TUNING_GROUPS) {
    const folder = gui.addFolder(group.name);
    if (group.name !== 'Chão' && group.name !== 'Pulo') folder.close();
    for (const [key] of group.items) {
      const item = tuningItem(key);
      const r = tuningRange(key);
      const c = folder.add(cfg, key, r.min, r.max, r.step);
      // Nome, unidade e padrão; ↺ volta ao padrão só este valor.
      c.$name.textContent = '';
      const label = doc.createElement('span');
      label.textContent = `${item.label} (${item.unit}) `;
      const def = doc.createElement('small');
      def.textContent = `padrão ${fmt(MOVE[key])} `;
      def.style.opacity = '0.7';
      const reset = doc.createElement('button');
      reset.textContent = '↺';
      reset.title = `Voltar ao padrão (${fmt(MOVE[key])})`;
      Object.assign(reset.style, { cursor: 'pointer', padding: '0 4px', minWidth: '0', width: 'auto', height: 'auto', background: 'transparent', color: 'inherit', border: '1px solid #666', borderRadius: '3px' });
      reset.addEventListener('click', (e) => {
        e.stopPropagation();
        c.setValue(MOVE[key]);
      });
      c.$name.append(label, def, reset);
      c.$name.title = key; // nome no código, para quem for aplicar os valores
      // Nomes longos quebram a linha; coluna do nome com largura fixa (barras alinhadas).
      Object.assign(c.$name.style, { whiteSpace: 'normal', lineHeight: '1.25', width: '58%', minWidth: '58%', maxWidth: '58%', flexShrink: '0' });
      c.onChange((v) => {
        // Segurança extra: valor digitado fora da faixa (ou inválido) é corrigido na hora.
        const safe = sanitizeMove({ [key]: v })[key];
        if (safe !== v) c.setValue(safe);
        paint(c);
      });
      controllers.push(c);
      paint(c);
    }
  }

  // Os controles do painel seguram as teclas apertadas neles. Clicou fora do painel (voltou ao
  // jogo) ou o mouse travou no jogo: tira o foco do painel, senão W A S D não chegariam ao jogo.
  const releaseFocus = () => {
    if (gui.domElement.contains(doc.activeElement)) doc.activeElement.blur();
  };
  doc.addEventListener('mousedown', (e) => {
    if (!gui.domElement.contains(e.target)) releaseFocus();
  }, true);
  doc.addEventListener('pointerlockchange', () => {
    if (doc.pointerLockElement) releaseFocus();
  });

  return {
    gui,
    get open() {
      return !gui._hidden;
    },
    /**
     * F4. Fechado: abre e solta o mouse do jogo. Aberto jogando (mouse preso no jogo): só solta
     * o mouse, para voltar a mexer no painel. Aberto com o mouse solto: fecha.
     */
    toggle() {
      if (!gui._hidden && doc.pointerLockElement) {
        doc.exitPointerLock();
        return;
      }
      const opening = gui._hidden;
      gui.show(opening);
      if (opening && doc.pointerLockElement) doc.exitPointerLock();
      // Com o painel aberto, a tela "Clique para jogar" some (não fica atrás do painel).
      const start = doc.getElementById('start-screen');
      if (start) start.style.visibility = opening ? 'hidden' : '';
    },
    refresh,
  };
}
