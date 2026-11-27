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
  /** Quem cair mais que isto abaixo do chão (y = 0) renasce no ponto de nascimento (m). */
  RESPAWN_FALL_DEPTH: 30,
});

/** Movimento: valores preenchidos ao longo das tarefas da Fase 1. */
export const MOVE = Object.freeze({
  /** Gravidade (m/s²). Mais forte que a real (9,8) para pulos rápidos e secos. */
  GRAVITY: 24,
  /** Velocidade máxima de queda (m/s). */
  MAX_FALL_SPEED: 50,
  /** Altura máxima de degrau que o jogador sobe só andando (m). Acima disso, bloqueia. */
  STEP_HEIGHT: 0.45,
  /**
   * Rapidez com que a câmera alcança a nova altura depois de subir um degrau (1/s).
   * A física sobe de uma vez; só a imagem é suavizada. Maior = mais rápido.
   */
  STEP_SMOOTH_RATE: 15,
  /** Velocidade de andar no chão (m/s): o alvo da aceleração. */
  WALK_SPEED: 9,
  /** Aceleração no chão (1/s): quanto da velocidade alvo é somado por segundo (x WALK_SPEED). */
  GROUND_ACCEL: 14,
  /** Atrito no chão (1/s): fração da velocidade perdida por segundo. */
  FRICTION: 7,
  /** Abaixo desta velocidade (m/s), o atrito freia como se fosse esta: para de vez, sem "patinar". */
  STOP_SPEED: 3,
  /** Velocidade para cima no pulo (m/s). Altura máxima = JUMP_SPEED² / (2 x GRAVITY), cerca de 1,33 m. */
  JUMP_SPEED: 8,
  /** Tolerância de borda (s): ainda dá para pular este tempo depois de sair do chão. */
  COYOTE_TIME: 0.1,
  /** Pulo antecipado (s): apertar até este tempo antes de tocar o chão também pula. */
  JUMP_BUFFER: 0.1,
});

/** Câmera e mouse. */
export const VIEW = Object.freeze({
  /** Sensibilidade padrão do mouse (rad por pixel). Ajustável por ?sens= no endereço. */
  MOUSE_SENSITIVITY: 0.0022,
  /** Limite para olhar para cima ou para baixo (rad). 89° evita virar de cabeça para baixo. */
  MAX_PITCH: (89 * Math.PI) / 180,
  /** Campo de visão vertical da câmera (graus). */
  FOV: 90,
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
