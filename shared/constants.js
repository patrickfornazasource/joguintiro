// Painel de números do jogo LUZ NEGRA.
// Todo número de balanceamento mora aqui (regra do CLAUDE.md).
// Código puro: sem Three.js, sem window/document. Usado pelo cliente e pelo servidor.

/** Simulação física. */
export const PHYSICS = Object.freeze({
  /** Passo fixo da simulação (s). 1/120 = 120 atualizações por segundo. */
  FIXED_DT: 1 / 120,
  /** Folga da colisão (m): caixas que só se encostam não contam como sobrepostas. */
  CONTACT_EPSILON: 0.0001,
  /**
   * Tempo máximo acumulado de uma vez no laço do jogo (s). Se um quadro demorar
   * mais (ex.: aba voltou do segundo plano), o excesso é descartado para não travar.
   */
  MAX_ACCUMULATOR: 0.25,
});

/** Corpo do jogador. */
export const PLAYER = Object.freeze({
  /** Raio da cápsula de colisão (m). */
  RADIUS: 0.35,
  /** Altura em pé (m). */
  HEIGHT: 1.8,
  /** Altura agachado ou deslizando (m). */
  CROUCH_HEIGHT: 1.1,
  /** Altura dos olhos em pé, medida dos pés (m). */
  EYE_HEIGHT: 1.6,
  /** Altura dos olhos agachado, medida dos pés (m). */
  CROUCH_EYE_HEIGHT: 0.95,
  /** Vida máxima (pontos de vida). */
  MAX_HEALTH: 100,
});

/** Movimento: valores preenchidos ao longo das tarefas da Fase 1. */
export const MOVE = Object.freeze({
  /** Gravidade (m/s²). Mais forte que a real (9,8) para pulos rápidos e secos. */
  GRAVITY: 24,
  /** Velocidade máxima de queda (m/s). */
  MAX_FALL_SPEED: 50,
});

/** Rede. */
export const NET = Object.freeze({
  /** Taxa de envio de estado do servidor (Hz, vezes por segundo). */
  TICK_RATE: 20,
});

/** Cena de demonstração da Fase 0 (sai quando o mapa real chegar). */
export const DEMO = Object.freeze({
  /** Velocidade de giro do cubo de teste (rad/s). PI/2 = um quarto de volta por segundo. */
  CUBE_SPIN_SPEED: Math.PI / 2,
});
