// Física do jogador. Código puro (sem Three.js, sem DOM): o servidor roda o mesmo
// código na Fase 8, então o resultado é idêntico no cliente e no servidor.
//
// Unidades: metros, segundos, radianos. y é a altura.
//
// Formato da entrada de um passo (input), montado a partir do teclado e do mouse:
//   moveX         -1..1  esquerda (-1) / direita (+1)
//   moveZ         -1..1  trás (-1) / frente (+1)
//   yaw           radianos, para onde o jogador olha no plano (0 = olhando para -z)
//   pitch         radianos, olhar para cima (+) ou para baixo (-)
//   jump          boolean, pulo segurado
//   jumpPressed   boolean, pulo apertado neste passo
//   crouch        boolean, agachar/deslizar segurado
//   crouchPressed boolean, agachar/deslizar apertado neste passo
//   dashPressed   boolean, dash apertado neste passo
import { MOVE, PLAYER } from '../constants.js';
import { moveAndCollide } from './collide.js';

/** Entrada vazia (nada apertado), útil como padrão e em testes. */
export function emptyInput() {
  return {
    moveX: 0,
    moveZ: 0,
    yaw: 0,
    pitch: 0,
    jump: false,
    jumpPressed: false,
    crouch: false,
    crouchPressed: false,
    dashPressed: false,
  };
}

/**
 * Cria o estado de um jogador num ponto de nascimento.
 * @param {{ x: number, y: number, z: number, yaw?: number }} spawn
 */
export function createPlayer(spawn) {
  return {
    /** Posição dos pés (m). */
    pos: { x: spawn.x, y: spawn.y, z: spawn.z },
    /** Velocidade (m/s). */
    vel: { x: 0, y: 0, z: 0 },
    /** Para onde olha (rad). */
    yaw: spawn.yaw ?? 0,
    pitch: 0,
    /** Está apoiado no chão? (calculado pela colisão a cada passo) */
    onGround: false,
    /** Tipo do bloco em que está pisando ('solid', 'pad'...), ou null no ar. */
    groundType: null,
    /** Último contato lateral neste passo: { normal: {x,y,z}, type }, ou null (usado na F1-11). */
    contact: null,
    /** Está agachado ou deslizando? (F1-10) */
    crouching: false,
    /** Altura atual do corpo (m): PLAYER.HEIGHT em pé, PLAYER.CROUCH_HEIGHT agachado. */
    height: PLAYER.HEIGHT,

    // Campos reservados para as próximas tarefas (ainda sem efeito):
    /** Pulos extras disponíveis no ar (pulo duplo, F1-09). */
    jumpsLeft: 0,
    /** Parede em que está correndo ou encostado, ou null (F1-11 a F1-13). */
    wall: null,
    /** Cargas de dash disponíveis (F1-15). */
    dashCharges: 0,
    /** Estado de movimento: 'air', 'ground', 'slide', 'wallrun', 'slam'... (F1-06 em diante). */
    state: 'air',
  };
}

/**
 * Avança o jogador um passo fixo de simulação.
 * Por enquanto: gravidade (com limite de queda) e movimento pela velocidade, parando
 * nas caixas do mapa. A entrada ainda não é usada.
 * @param {ReturnType<typeof createPlayer>} p estado do jogador (alterado no lugar)
 * @param {ReturnType<typeof emptyInput>} input entrada deste passo
 * @param {{ boxes: Array }} map mapa (shared/maps)
 * @param {number} dt duração do passo (s), normalmente PHYSICS.FIXED_DT
 * @returns o mesmo objeto p
 */
export function stepPlayer(p, input, map, dt) {
  // Gravidade sempre puxa, sem passar da velocidade máxima de queda. No chão, a colisão
  // zera a queda a cada passo; assim onGround fica estável (não pisca entre passos).
  p.vel.y = Math.max(p.vel.y - MOVE.GRAVITY * dt, -MOVE.MAX_FALL_SPEED);
  // Integração semi-implícita: primeiro a velocidade, depois a posição (mais estável),
  // parando nas caixas do mapa (F1-03).
  moveAndCollide(p, map, dt);
  return p;
}
