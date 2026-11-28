// Carga Cinética (F2-01). Código puro (sem Three.js, sem DOM): o servidor da F3 e da F8 roda
// o mesmo código.
//
// GDD seção 3, Pilar 1: cada jogador tem uma barra de Carga (0 a 100). Ela enche com a
// velocidade horizontal acima da velocidade de andar (quanto mais rápido, mais rápido enche) e,
// parado, enche muito devagar. A corrida na parede gera Carga. Bônus: pulo na parede e deslize
// longo (o painel de Tinta UV, na Fase 4, usa addChargeBonus). Atirar gasta Carga (F2-02).
// Ao renascer, a Carga começa cheia (seção 11).
//
// A Carga não mexe na física: lê o estado e os eventos do passo do jogador (player.events).
import { CHARGE, MOVE } from '../constants.js';

/**
 * Estado da Carga de um jogador. Começa cheia (como ao renascer).
 * @param {typeof CHARGE} [cfg]
 */
export function createCharge(cfg = CHARGE) {
  return {
    /** Carga atual (pontos, 0 a CHARGE_MAX). */
    value: cfg.CHARGE_MAX,
    /** Ganho contínuo no último passo (pontos/s), para o painel F3. Bônus não entram aqui. */
    rate: 0,
  };
}

const clamp = (state, cfg) => {
  state.value = Math.max(0, Math.min(cfg.CHARGE_MAX, state.value));
};

/**
 * Avança a Carga um passo, depois da física do jogador.
 * @param {ReturnType<typeof createCharge>} state alterado no lugar
 * @param {object} player jogador da física (vel, wallrun, events)
 * @param {number} dt (s)
 * @param {typeof CHARGE} [cfg] números da Carga (o painel F4 passa uma cópia editável)
 * @param {typeof MOVE} [move] números do movimento (velocidade de andar)
 * @returns {number} quanto a Carga mudou neste passo (pontos)
 */
export function updateCharge(state, player, dt, cfg = CHARGE, move = MOVE) {
  const before = state.value;
  const speed = Math.hypot(player.vel.x, player.vel.z);
  let rate = cfg.CHARGE_IDLE_RATE + Math.max(0, speed - move.WALK_SPEED) * cfg.CHARGE_PER_SPEED;
  if (player.wallrun) rate += cfg.CHARGE_WALLRUN_RATE;
  state.rate = rate;
  state.value += rate * dt;
  for (const e of player.events ?? []) {
    if (e.type === 'wallJump') state.value += cfg.CHARGE_WALLJUMP_BONUS;
    else if (e.type === 'slideEnd' && (e.duration ?? 0) >= cfg.CHARGE_LONG_SLIDE_TIME) state.value += cfg.CHARGE_LONG_SLIDE_BONUS;
  }
  clamp(state, cfg);
  return state.value - before;
}

/**
 * Bônus avulso de Carga (ex.: painel de Tinta UV, Fase 4). Respeita o máximo.
 * @returns {number} quanto entrou de fato
 */
export function addChargeBonus(state, amount, cfg = CHARGE) {
  const before = state.value;
  state.value += Math.max(0, amount);
  clamp(state, cfg);
  return state.value - before;
}

/**
 * Gasta Carga (tiro, F2-02 em diante). Sem Carga suficiente, não gasta nada.
 * @returns {boolean} se deu para gastar
 */
export function spendCharge(state, amount) {
  if (!(amount >= 0) || state.value + 1e-9 < amount) return false;
  state.value = Math.max(0, state.value - amount);
  return true;
}

/** Enche a Carga (ao renascer). */
export function refillCharge(state, cfg = CHARGE) {
  state.value = cfg.CHARGE_MAX;
}
