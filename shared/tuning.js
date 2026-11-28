// Números do movimento ajustáveis ao vivo (F1-20). Código puro: sem DOM, sem Three.js.
// Lista cada valor de MOVE com nome em português, unidade e grupo, calcula a faixa dos controles
// (de TUNING.MIN_FACTOR x a TUNING.MAX_FACTOR x o padrão) e limpa valores vindos de fora
// (painel, valores salvos no navegador): fora da faixa é cortado, inválido volta ao padrão.
// O painel em si (lil-gui) fica em src/ui/tuning.js.
import { MOVE, CHARGE, WEAPONS, TUNING } from './constants.js';

/** Tipos de valor: número livre, inteiro (contagens) ou fração de 0 a 1. */
const NUM = 'número';
const INT = 'inteiro';
const FRAC = 'fração';

/**
 * Grupos do painel, na ordem em que aparecem. Cada item: [chave em MOVE, nome, unidade, tipo].
 * Toda chave de MOVE precisa aparecer aqui (um teste confere).
 */
export const TUNING_GROUPS = Object.freeze([
  {
    name: 'Chão',
    items: [
      ['WALK_SPEED', 'Velocidade de andar', 'm/s', NUM],
      ['GROUND_ACCEL', 'Aceleração no chão', '1/s', NUM],
      ['FRICTION', 'Atrito no chão', '1/s', NUM],
      ['STOP_SPEED', 'Velocidade de parada', 'm/s', NUM],
      ['CROUCH_SPEED', 'Velocidade agachado', 'm/s', NUM],
      ['STEP_HEIGHT', 'Altura de degrau', 'm', NUM],
      ['STEP_SMOOTH_RATE', 'Suavidade da câmera no degrau', '1/s', NUM],
      ['MAX_SPEED', 'Velocidade máxima (vale para tudo)', 'm/s', NUM],
    ],
  },
  {
    name: 'Pulo',
    items: [
      ['JUMP_SPEED', 'Força do pulo', 'm/s', NUM],
      ['GRAVITY', 'Gravidade', 'm/s²', NUM],
      ['MAX_FALL_SPEED', 'Velocidade máxima de queda', 'm/s', NUM],
      ['COYOTE_TIME', 'Tolerância de borda', 's', NUM],
      ['JUMP_BUFFER', 'Pulo antecipado', 's', NUM],
      ['AIR_JUMPS', 'Pulos duplos', 'pulos', INT],
      ['DOUBLE_JUMP_SPEED', 'Força do pulo duplo', 'm/s', NUM],
      ['DOUBLE_JUMP_REDIRECT', 'Pulo duplo vira para as teclas', '0 a 1', FRAC],
    ],
  },
  {
    name: 'Ar',
    items: [
      ['AIR_ACCEL', 'Controle no ar', '1/s', NUM],
      ['AIR_WISH_CAP', 'Ganho no air strafe', 'm/s', NUM],
    ],
  },
  {
    name: 'Deslize',
    items: [
      ['SLIDE_MIN_SPEED', 'Velocidade mínima para deslizar', 'm/s', NUM],
      ['SLIDE_BOOST', 'Impulso do deslize', 'm/s', NUM],
      ['SLIDE_FRICTION', 'Atrito no deslize', '1/s', NUM],
      ['SLIDE_BOOST_COOLDOWN', 'Espera entre impulsos', 's', NUM],
      ['SLIDE_STEER', 'Direção no deslize', '1/s', NUM],
    ],
  },
  {
    name: 'Parede',
    items: [
      ['WALLRUN_MIN_SPEED', 'Velocidade mínima para correr na parede', 'm/s', NUM],
      ['WALLRUN_MAX_TIME', 'Tempo máximo na parede', 's', NUM],
      ['WALLRUN_GRAVITY_SCALE', 'Gravidade na parede', '0 a 1', FRAC],
      ['WALLRUN_ACCEL', 'Ganho de velocidade na parede', 'm/s²', NUM],
      ['WALLRUN_MAX_SPEED', 'Velocidade máxima na parede', 'm/s', NUM],
      ['WALLRUN_JUMP_OUT', 'Pulo da corrida: para fora', 'm/s', NUM],
      ['WALLRUN_JUMP_UP', 'Pulo da corrida: para cima', 'm/s', NUM],
      ['WALLRUN_REATTACH_DELAY', 'Espera para voltar à mesma parede', 's', NUM],
      ['WALLRUN_STICK', 'Cola na parede', 'm/s', NUM],
      ['WALLRUN_RELEASE_DOT', 'Soltar ao puxar para fora', '0 a 1', FRAC],
      ['WALLRUN_MIN_FACE', 'Largura mínima da parede', 'm', NUM],
      ['WALL_JUMP_OUT', 'Pulo na parede: para fora', 'm/s', NUM],
      ['WALL_JUMP_UP', 'Pulo na parede: para cima', 'm/s', NUM],
      ['WALL_JUMP_MAX', 'Pulos na parede seguidos', 'pulos', INT],
      ['WALL_JUMP_SAME_WALL_DELAY', 'Espera para pular na mesma parede', 's', NUM],
      ['WALL_PROBE', 'Distância em que percebe a parede', 'm', NUM],
      ['WALL_MEMORY', 'Memória da parede', 's', NUM],
    ],
  },
  {
    name: 'Slam',
    items: [
      ['SLAM_SPEED', 'Velocidade da queda do slam', 'm/s', NUM],
      ['SLAM_JUMP_WINDOW', 'Janela do pulo de slam', 's', NUM],
      ['SLAM_JUMP_BASE', 'Pulo de slam: força base', 'm/s', NUM],
      ['SLAM_JUMP_PER_METER', 'Pulo de slam: extra por metro de queda', 'm/s por m', NUM],
      ['SLAM_JUMP_MAX', 'Pulo de slam: força máxima', 'm/s', NUM],
    ],
  },
  {
    name: 'Dash',
    items: [
      ['DASH_SPEED', 'Velocidade do dash', 'm/s', NUM],
      ['DASH_TIME', 'Duração do dash', 's', NUM],
      ['DASH_CHARGES', 'Cargas de dash', 'cargas', INT],
      ['DASH_RECHARGE', 'Tempo para recarregar uma carga', 's', NUM],
      ['DASH_END_SPEED_KEEP', 'Velocidade mantida ao fim do dash', '0 a 1', FRAC],
    ],
  },
  {
    name: 'Plataformas',
    items: [['PAD_SPEED', 'Força da plataforma de salto', 'm/s', NUM]],
  },
  {
    name: 'Corrimão',
    items: [
      ['RAIL_SNAP_DIST', 'Distância para grudar no corrimão', 'm', NUM],
      ['RAIL_GRAVITY_ACCEL', 'Aceleração na descida', 'm/s²', NUM],
      ['RAIL_MAX_SPEED', 'Velocidade máxima no corrimão', 'm/s', NUM],
      ['RAIL_EXIT_UP', 'Pulo do corrimão: para cima', 'm/s', NUM],
      ['RAIL_MIN_SPEED', 'Velocidade mínima para grudar', 'm/s', NUM],
      ['RAIL_REATTACH_DELAY', 'Espera para voltar ao mesmo corrimão', 's', NUM],
    ],
  },
]);

/**
 * Grupo da Carga (F2-01). `CHARGE_MAX` fica fora: o GDD fixa a barra em 0 a 100.
 * Toda outra chave de CHARGE precisa aparecer aqui (um teste confere).
 */
export const CHARGE_TUNING_GROUPS = Object.freeze([
  {
    name: 'Carga',
    items: [
      ['CHARGE_IDLE_RATE', 'Carga parado', 'pontos/s', NUM],
      ['CHARGE_PER_SPEED', 'Carga por m/s acima de andar', 'pontos/s por m/s', NUM],
      ['CHARGE_WALLRUN_RATE', 'Carga extra na corrida na parede', 'pontos/s', NUM],
      ['CHARGE_WALLJUMP_BONUS', 'Bônus por pulo na parede', 'pontos', NUM],
      ['CHARGE_LONG_SLIDE_TIME', 'Deslize longo a partir de', 's', NUM],
      ['CHARGE_LONG_SLIDE_BONUS', 'Bônus por deslize longo', 'pontos', NUM],
    ],
  },
]);

/**
 * Grupo das armas (F2-02: Rifle). `RECOIL_VERTICAL_SCALE` fica fora (fixo em 0 até a decisão do
 * dono sobre o limite vertical de impulsos de arma). Toda outra chave de WEAPONS aparece aqui.
 */
export const WEAPON_TUNING_GROUPS = Object.freeze([
  {
    name: 'Rifle',
    items: [
      ['RIFLE_COST', 'Rifle: custo por tiro', 'pontos de Carga', NUM],
      ['RIFLE_DAMAGE', 'Rifle: dano parado ou andando', 'pontos de vida', NUM],
      ['RIFLE_SPEED_MULT_MAX', 'Rifle: dano máximo pela velocidade', 'vezes', NUM],
      ['DAMAGE_SPEED_FULL', 'Velocidade do dano máximo (todas as armas)', 'm/s', NUM],
      ['RIFLE_FIRE_INTERVAL', 'Rifle: tempo entre tiros', 's', NUM],
      ['RIFLE_RANGE', 'Rifle: alcance', 'm', NUM],
      ['RIFLE_RECOIL', 'Rifle: coice (empurrão para trás)', 'm/s', NUM],
    ],
  },
]);

/**
 * Conjuntos de números do painel: cada um com o objeto padrão (congelado) e os grupos.
 * Chaves são únicas entre os conjuntos (assim os valores salvos podem ficar juntos).
 */
export const TUNING_SETS = Object.freeze([
  { id: 'MOVE', base: MOVE, groups: TUNING_GROUPS },
  { id: 'CHARGE', base: CHARGE, groups: CHARGE_TUNING_GROUPS },
  { id: 'WEAPONS', base: WEAPONS, groups: WEAPON_TUNING_GROUPS },
]);

/** Item da lista por chave: { key, label, unit, kind, group }. */
const BY_KEY = new Map();
for (const set of TUNING_SETS) {
  for (const g of set.groups) {
    for (const [key, label, unit, kind] of g.items) BY_KEY.set(key, { key, label, unit, kind, group: g.name });
  }
}

/** Descrição de um valor (nome, unidade, tipo, grupo), ou undefined se não existe. */
export function tuningItem(key) {
  return BY_KEY.get(key);
}

/** Passo do controle: inteiros de 1 em 1; os outros com 3 algarismos de precisão. */
function stepFor(value, kind) {
  if (kind === INT) return 1;
  return 10 ** (Math.floor(Math.log10(Math.abs(value))) - 2);
}

/**
 * Faixa do controle de um valor: { min, max, step, base }.
 * De MIN_FACTOR x a MAX_FACTOR x o padrão; inteiros arredondados; frações até 1.
 */
export function tuningRange(key, base = MOVE) {
  const item = BY_KEY.get(key);
  const def = base[key];
  const kind = item?.kind ?? NUM;
  let min = def * TUNING.MIN_FACTOR;
  let max = def * TUNING.MAX_FACTOR;
  if (kind === INT) {
    min = Math.round(min);
    max = Math.round(max);
  }
  if (kind === FRAC) max = Math.min(max, 1);
  return { min, max, step: stepFor(def, kind), base: def };
}

/**
 * Monta um objeto completo de números (do movimento, ou de outro conjunto via `base`) a partir de
 * valores quaisquer: chave faltando, não numérica ou não finita fica com o padrão; fora da faixa
 * é cortada; inteiros são arredondados; chaves que não existem em `base` são ignoradas; chaves
 * que não estão no painel (ex.: CHARGE_MAX) ficam sempre no padrão.
 * @param {object|null|undefined} values
 * @returns {Record<string, number>} cópia nova e editável
 */
export function sanitizeMove(values, base = MOVE) {
  const out = {};
  for (const key of Object.keys(base)) {
    if (!BY_KEY.has(key)) {
      out[key] = base[key]; // fora do painel: fixo
      continue;
    }
    const { min, max } = tuningRange(key, base);
    const raw = values?.[key];
    let v = typeof raw === 'number' && Number.isFinite(raw) ? raw : base[key];
    v = Math.min(max, Math.max(min, v));
    if (BY_KEY.get(key)?.kind === INT) v = Math.round(v);
    out[key] = v;
  }
  return out;
}

/** Valores diferentes do padrão: { CHAVE: valor }. */
export function changedValues(cfg, base = MOVE) {
  const out = {};
  for (const key of Object.keys(base)) {
    if (Math.abs(cfg[key] - base[key]) > 1e-9) out[key] = cfg[key];
  }
  return out;
}

/**
 * Texto para "Copiar valores": JSON com os valores mudados (com o padrão de cada um) e a lista
 * completa ("todos", que pode ser lida de volta por sanitizeMove).
 */
export function tuningJson(cfg, base = MOVE) {
  return tuningJsonAll([{ cfg, base }]);
}

/**
 * Como tuningJson, juntando vários conjuntos ([{ cfg, base }], ex.: movimento e Carga) num texto.
 * As chaves são únicas entre os conjuntos.
 */
export function tuningJsonAll(sets) {
  const alterados = {};
  const todos = {};
  for (const { cfg, base } of sets) {
    for (const [key, value] of Object.entries(changedValues(cfg, base))) {
      alterados[key] = { nome: BY_KEY.get(key)?.label ?? key, padrao: base[key], novo: value };
    }
    for (const key of Object.keys(base)) todos[key] = cfg[key];
  }
  return JSON.stringify({ alterados, todos }, null, 2);
}
