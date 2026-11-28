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
import { moveAndCollide, fitsWithHeight } from './collide.js';
import { wishDir, accelerate, airAccelerate, applyFriction, redirectHorizontal } from './move.js';

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
    /** Tempo que ainda resta de tolerância de borda (s): COYOTE_TIME ao sair do chão, contando para baixo. */
    coyote: 0,
    /** Tempo que ainda resta de um aperto de pulo antecipado (s). */
    jumpBuffer: 0,
    /** Acontecimentos deste passo, para som e efeitos: [{ type: 'jump' }, ...]. Zerado a cada passo. */
    events: [],
    /** Está agachado ou deslizando? (F1-10) */
    crouching: false,
    /** Está deslizando? (F1-10) */
    sliding: false,
    /** Tempo até o próximo impulso de deslize valer (s). */
    slideCooldown: 0,
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
 * Pulo (F1-07): no chão, na tolerância de borda ou com aperto antecipado. No chão:
 * atrito (menos no passo do pulo) e aceleração na direção das teclas (F1-06). Depois: gravidade
 * (com limite de queda) e movimento pela velocidade, parando nas caixas do mapa.
 * @param {ReturnType<typeof createPlayer>} p estado do jogador (alterado no lugar)
 * @param {ReturnType<typeof emptyInput>} input entrada deste passo
 * @param {{ boxes: Array }} map mapa (shared/maps)
 * @param {number} dt duração do passo (s), normalmente PHYSICS.FIXED_DT
 * @returns o mesmo objeto p
 */
export function stepPlayer(p, input, map, dt) {
  p.events = [];

  // Relógios do pulo (F1-07): tolerância de borda e pulo antecipado.
  p.coyote = p.onGround ? MOVE.COYOTE_TIME : Math.max(0, p.coyote - dt);
  p.jumpBuffer = input.jumpPressed ? MOVE.JUMP_BUFFER : Math.max(0, p.jumpBuffer - dt);

  // Pula se: está no chão (ou acabou de sair da borda) E apertou agora ou há pouco,
  // ou está no chão segurando o pulo (bunny hop: pula de novo ao pousar).
  const canJump = p.onGround || p.coyote > 0;
  const wantsJump = p.jumpBuffer > 0 || (input.jump && p.onGround);
  const jumping = canJump && wantsJump;

  // Pulo duplo (F1-09): recarrega no chão; no ar, só com um aperto novo (segurar não gasta).
  if (p.onGround) p.jumpsLeft = MOVE.AIR_JUMPS;
  const doubleJumping = !jumping && !p.onGround && input.jumpPressed && p.jumpsLeft > 0;

  // Deslize e agachar (F1-10).
  updateCrouch(p, input, map, jumping, dt);

  // No chão (estado do passo anterior): atrito e aceleração na direção das teclas (F1-06).
  // No passo do pulo não há atrito: quem emenda pulos não perde velocidade.
  // No ar: sem atrito, com controle aéreo (air strafe, F1-08).
  const wish = wishDir(input);
  const amount = Math.hypot(wish.x, wish.z); // 0 a 1 (teclado: 0 ou 1)
  const dir = amount > 0 ? { x: wish.x / amount, y: 0, z: wish.z / amount } : null;
  if (p.sliding && !jumping) {
    // Deslize: atrito baixo e sem aceleração pelas teclas, só um leve direcionamento.
    const v = applyFriction(p.vel, MOVE.SLIDE_FRICTION, 0, dt);
    p.vel = redirectHorizontal(v, dir, Math.min(1, MOVE.SLIDE_STEER * dt));
  } else if (p.onGround || jumping) {
    const v = jumping ? { ...p.vel } : applyFriction(p.vel, MOVE.FRICTION, MOVE.STOP_SPEED, dt);
    const target = p.crouching ? MOVE.CROUCH_SPEED : MOVE.WALK_SPEED; // agachado anda devagar
    p.vel = dir ? accelerate(v, dir, target * amount, MOVE.GROUND_ACCEL, dt) : v;
  } else if (doubleJumping) {
    // Mistura a direção atual com a das teclas, sem perder velocidade.
    p.vel = redirectHorizontal(p.vel, dir, MOVE.DOUBLE_JUMP_REDIRECT);
  } else if (dir) {
    p.vel = airAccelerate(p.vel, dir, MOVE.WALK_SPEED * amount, MOVE.AIR_ACCEL, MOVE.AIR_WISH_CAP, dt);
  }

  if (jumping) {
    p.vel.y = MOVE.JUMP_SPEED;
    p.onGround = false;
    p.coyote = 0; // a tolerância de borda vale para um pulo só
    p.jumpBuffer = 0;
    p.events.push({ type: 'jump' });
  }

  if (doubleJumping) {
    p.vel.y = MOVE.DOUBLE_JUMP_SPEED;
    p.jumpsLeft -= 1;
    p.jumpBuffer = 0; // o aperto foi usado no pulo duplo: não vale como pulo antecipado no pouso
    p.events.push({ type: 'doubleJump' });
  }

  stepBody(p, map, dt);
  p.state = p.sliding ? 'slide' : !p.onGround ? 'air' : p.crouching ? 'crouch' : 'ground';
  return p;
}

/** Termina o deslize (mantém agachado; quem decide levantar é updateCrouch). */
function endSlide(p) {
  if (!p.sliding) return;
  p.sliding = false;
  p.events.push({ type: 'slideEnd' });
}

/**
 * Regras de agachar e deslizar (F1-10), antes do movimento do passo.
 * - Apertar agachar no chão acima de SLIDE_MIN_SPEED: desliza, com impulso se o tempo de espera passou.
 * - Deslizando: termina abaixo de CROUCH_SPEED (vira agachado), soltando a tecla, pulando ou saindo do chão.
 * - Agachado com a tecla solta: levanta só se couber em pé.
 */
function updateCrouch(p, input, map, jumping, dt) {
  p.slideCooldown = Math.max(0, p.slideCooldown - dt);
  const speed = Math.hypot(p.vel.x, p.vel.z);

  if (p.onGround && !jumping && input.crouchPressed && !p.sliding && speed > MOVE.SLIDE_MIN_SPEED) {
    p.sliding = true;
    p.crouching = true;
    if (p.slideCooldown === 0) {
      const k = (speed + MOVE.SLIDE_BOOST) / speed;
      p.vel.x *= k;
      p.vel.z *= k;
      p.slideCooldown = MOVE.SLIDE_BOOST_COOLDOWN;
    }
    p.events.push({ type: 'slideStart' });
  } else if (p.sliding) {
    // Pulo no deslize (slide hop): sai com a velocidade do deslize (o passo do pulo não tem atrito).
    if (jumping || !p.onGround || !input.crouch || speed < MOVE.CROUCH_SPEED) endSlide(p);
  }

  if (input.crouch && p.onGround && !jumping) p.crouching = true;

  // Levantar: só soltando a tecla (ou ao pular) e se houver espaço acima.
  if (p.crouching && !p.sliding && (!input.crouch || jumping) && fitsWithHeight(p, map, PLAYER.HEIGHT)) {
    p.crouching = false;
  }
  p.height = p.crouching ? PLAYER.CROUCH_HEIGHT : PLAYER.HEIGHT;
}

/**
 * Parte do passo que não depende da entrada: gravidade e colisão com o mapa.
 * Separada para testar a colisão sem as regras de movimento.
 */
export function stepBody(p, map, dt) {
  // Gravidade sempre puxa, sem passar da velocidade máxima de queda. No chão, a colisão
  // zera a queda a cada passo; assim onGround fica estável (não pisca entre passos).
  const before = p.vel.y;
  const after = Math.max(before - MOVE.GRAVITY * dt, -MOVE.MAX_FALL_SPEED);
  // Na vertical, a posição anda pela média da velocidade no passo (exato para gravidade
  // constante): a altura do pulo bate com a fórmula v² / 2g (F1-07).
  const average = (before + after) / 2;
  p.vel.y = average;
  moveAndCollide(p, map, dt); // para nas caixas do mapa (F1-03)
  // Se nada zerou a velocidade vertical (chão, teto, degrau), ela termina o passo em `after`.
  if (p.vel.y === average) p.vel.y = after;
  return p;
}
