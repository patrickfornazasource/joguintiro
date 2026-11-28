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
import { BOX_TYPES } from '../maps/format.js';
import { updateWall } from './walls.js';
import { updateWallrun, endWallrun } from './wallrun.js';
import { startDash, stepDash, rechargeDash } from './dash.js';
import { updateRail } from './rail.js';
import { wishDir, forwardOf, accelerate, airAccelerate, applyFriction, redirectHorizontal } from './move.js';

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
 * @param {typeof MOVE} [cfg] números do movimento (padrão: MOVE)
 */
export function createPlayer(spawn, cfg = MOVE) {
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
    /** Bloco em que está pisando (para dados do bloco, ex.: direção de uma plataforma de salto), ou null. */
    groundBox: null,
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
    /** Há quanto tempo está deslizando (s); vai no evento slideEnd como `duration` (bônus de Carga, F2-01). */
    slideTime: 0,
    /** Corrida na parede em andamento: { box, normal, time }, ou null (F1-12). */
    wallrun: null,
    /** Última parede em que correu e há quanto tempo saiu: { box, age }, ou null. */
    wallrunLast: null,
    /**
     * Paredes já usadas neste voo (corrida ou pulo na parede). Zera ao tocar o chão.
     * Correr numa parede desta lista não recarrega nada (GDD: recarga só em "parede nova").
     */
    wallsUsed: [],
    /** Golpe no chão em andamento: { startY } (altura em que começou), ou null (F1-14). */
    slam: null,
    /** Tempo que resta da janela do pulo de slam (s), e a altura da queda que o alimenta (m). */
    slamJumpWindow: 0,
    slamHeight: 0,
    /** Corrimão em andamento: { box, from, t, len, s, v }, ou null (F1-17). */
    rail: null,
    /** Último corrimão e há quanto tempo saiu: { box, age }, ou null. */
    railLast: null,
    /** Altura atual do corpo (m): PLAYER.HEIGHT em pé, PLAYER.CROUCH_HEIGHT agachado. */
    height: PLAYER.HEIGHT,

    // Campos reservados para as próximas tarefas (ainda sem efeito):
    /** Pulos extras disponíveis no ar (pulo duplo, F1-09). */
    jumpsLeft: 0,
    /** Pulos na parede ainda disponíveis (F1-13). Recarregam no chão ou ao correr numa parede. */
    wallJumpsLeft: cfg.WALL_JUMP_MAX,
    /** Último pulo na parede: { box, age } (para a espera da mesma parede), ou null. */
    lastWallJump: null,
    /**
     * Parede encostada agora ou lembrada (até MOVE.WALL_MEMORY s), ou null (F1-11).
     * { normal, type, side: 'left'|'right'|'front'|'back', distance, age }
     */
    wall: null,
    /** Tempo desde o último contato com parede (s). */
    wallAge: Infinity,
    /** Cargas de dash disponíveis (F1-15). */
    dashCharges: cfg.DASH_CHARGES,
    /** Tempo acumulado para recarregar a próxima carga de dash (s). */
    dashRecharge: 0,
    /** Dash em andamento: { dir, speed, remaining, before }, ou null. */
    dash: null,
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
 * @param {typeof MOVE} [cfg] números do movimento (F1-20). Padrão: MOVE (congelado). O painel de
 *   ajuste (F4) passa uma cópia editável; a física continua pura (só lê os números daqui).
 * @returns o mesmo objeto p
 */
export function stepPlayer(p, input, map, dt, cfg = MOVE) {
  p.events = [];

  // Relógios do pulo (F1-07): tolerância de borda e pulo antecipado.
  p.coyote = p.onGround ? cfg.COYOTE_TIME : Math.max(0, p.coyote - dt);
  p.jumpBuffer = input.jumpPressed ? cfg.JUMP_BUFFER : Math.max(0, p.jumpBuffer - dt);

  // Pula se: está no chão (ou acabou de sair da borda) E apertou agora ou há pouco,
  // ou está no chão segurando o pulo (bunny hop: pula de novo ao pousar).
  // Corrida na parede (F1-12): entrar, continuar, sair ou pular para fora. Tem prioridade.
  // Corrimão (F1-17): no trilho, a posição é dele (sem a física normal neste passo).
  rechargeDash(p, dt, cfg);
  const railing = updateRail(p, input, map, dt, cfg); // 'riding' | 'jumped' | 'released' | null
  if (railing === 'riding') {
    p.state = 'rail';
    return p;
  }
  const railJumped = railing === 'jumped';

  // Dash provisório (F1-15): Shift com carga, fora do slam. Interrompe a corrida na parede.
  if (!railJumped && input.dashPressed && !p.dash && !p.slam && p.dashCharges >= 1) {
    if (p.wallrun) endWallrun(p);
    const w = wishDir(input);
    const len = Math.hypot(w.x, w.z);
    const dashDir = len > 0 ? { x: w.x / len, y: 0, z: w.z / len } : forwardOf(input.yaw); // sem tecla: para frente
    p.dashCharges -= 1;
    startDash(p, dashDir, cfg.DASH_SPEED, cfg.DASH_TIME);
  }
  const dashing = stepDash(p, dt, cfg); // durante o dash, a velocidade é dele

  const wallrunning = dashing || railJumped ? null : updateWallrun(p, input, dt, cfg); // 'running' | 'jumped' | null
  // Pulo do trilho conta como "já cuidado" neste passo (como o pulo da corrida na parede).
  const onWall = wallrunning !== null || railJumped;

  const canJump = p.onGround || p.coyote > 0;
  const wantsJump = p.jumpBuffer > 0 || (input.jump && p.onGround);
  const jumping = !dashing && !onWall && !p.slam && canJump && wantsJump;

  // Golpe no chão (F1-14): agachar no ar (fora da corrida na parede) despenca em linha reta.
  p.slamJumpWindow = Math.max(0, p.slamJumpWindow - dt);
  // Soltar do corrimão agachando usa o aperto: não inicia o slam no mesmo passo (F1-17).
  if (railing !== 'released' && !dashing && !onWall && !jumping && !p.onGround && !p.slam && input.crouchPressed) {
    p.slam = { startY: p.pos.y };
    p.events.push({ type: 'slamStart' });
  }

  // Pulo na parede (F1-13): no ar, fora da corrida, encostado (ou na memória de 0,15 s) numa
  // parede, com um aperto novo. Tem prioridade sobre o pulo duplo. Máximo WALL_JUMP_MAX seguidos.
  if (p.onGround) p.wallJumpsLeft = cfg.WALL_JUMP_MAX;
  if (p.lastWallJump) p.lastWallJump.age += dt;
  const sameWallTooSoon = p.wall && p.lastWallJump && p.lastWallJump.box === p.wall.box
    && p.lastWallJump.age < cfg.WALL_JUMP_SAME_WALL_DELAY;
  const wallJumping = !dashing && !onWall && !p.slam && !jumping && !p.onGround && input.jumpPressed
    && p.wall !== null && !sameWallTooSoon && p.wallJumpsLeft > 0;

  // Pulo duplo (F1-09): recarrega no chão (e ao entrar na parede); no ar, só com um aperto novo.
  if (p.onGround) p.jumpsLeft = cfg.AIR_JUMPS;
  const doubleJumping = !dashing && !onWall && !p.slam && !jumping && !wallJumping && !p.onGround && input.jumpPressed
    && p.jumpsLeft > 0;

  // Deslize e agachar (F1-10).
  updateCrouch(p, input, map, jumping, dt, cfg);

  // No chão (estado do passo anterior): atrito e aceleração na direção das teclas (F1-06).
  // No passo do pulo não há atrito: quem emenda pulos não perde velocidade.
  // No ar: sem atrito, com controle aéreo (air strafe, F1-08).
  const wish = wishDir(input);
  const amount = Math.hypot(wish.x, wish.z); // 0 a 1 (teclado: 0 ou 1)
  const dir = amount > 0 ? { x: wish.x / amount, y: 0, z: wish.z / amount } : null;
  if (dashing) {
    // O dash já cuidou da velocidade neste passo.
  } else if (onWall) {
    // A corrida na parede já cuidou da velocidade neste passo.
  } else if (wallJumping) {
    // Empurra para longe da parede e para cima, mantendo a velocidade ao longo dela.
    const n = p.wall.normal;
    const into = p.vel.x * n.x + p.vel.z * n.z;
    p.vel.x = p.vel.x - into * n.x + n.x * cfg.WALL_JUMP_OUT;
    p.vel.z = p.vel.z - into * n.z + n.z * cfg.WALL_JUMP_OUT;
    p.vel.y = cfg.WALL_JUMP_UP;
    p.wallJumpsLeft -= 1;
    p.jumpBuffer = 0;
    p.coyote = 0;
    // A parede usada sai da memória e fica em espera (WALL_JUMP_SAME_WALL_DELAY).
    p.lastWallJump = { box: p.wall.box, age: 0 };
    if (!p.wallsUsed.includes(p.wall.box)) p.wallsUsed.push(p.wall.box); // parede usada neste voo
    p.wall = null;
    p.wallAge = Infinity;
    p.events.push({ type: 'wallJump' });
  } else if (p.slam) {
    // Slam: despenca em linha reta, sem velocidade horizontal e sem controle.
    p.vel = { x: 0, y: -cfg.SLAM_SPEED, z: 0 };
  } else if (p.sliding && !jumping) {
    // Deslize: atrito baixo e sem aceleração pelas teclas, só um leve direcionamento.
    const v = applyFriction(p.vel, cfg.SLIDE_FRICTION, 0, dt);
    p.vel = redirectHorizontal(v, dir, Math.min(1, cfg.SLIDE_STEER * dt));
  } else if (p.onGround || jumping) {
    const v = jumping ? { ...p.vel } : applyFriction(p.vel, cfg.FRICTION, cfg.STOP_SPEED, dt);
    const target = p.crouching ? cfg.CROUCH_SPEED : cfg.WALK_SPEED; // agachado anda devagar
    const wish = target * amount;
    const speed = Math.hypot(v.x, v.z);
    if (dir && jumping && speed < wish) {
      // Pulo parado ou devagar (bunny hop desde o começo): o pulo é o único passo de chão, então
      // a aceleração do chão vale de uma vez até a velocidade de andar (andando, ela chega lá em
      // ~1/GROUND_ACCEL s). Nunca passa da velocidade de andar: acima dela, nada muda.
      const a = accelerate(v, dir, wish, cfg.GROUND_ACCEL, 1 / cfg.GROUND_ACCEL);
      const h = Math.hypot(a.x, a.z);
      const k = h > wish ? wish / h : 1;
      p.vel = { x: a.x * k, y: a.y, z: a.z * k };
    } else {
      p.vel = dir ? accelerate(v, dir, wish, cfg.GROUND_ACCEL, dt) : v;
    }
  } else if (doubleJumping) {
    // Mistura a direção atual com a das teclas, sem perder velocidade.
    p.vel = redirectHorizontal(p.vel, dir, cfg.DOUBLE_JUMP_REDIRECT);
  } else if (dir) {
    p.vel = airAccelerate(p.vel, dir, cfg.WALK_SPEED * amount, cfg.AIR_ACCEL, cfg.AIR_WISH_CAP, dt);
  }

  if (jumping) {
    p.onGround = false;
    p.coyote = 0; // a tolerância de borda vale para um pulo só
    p.jumpBuffer = 0;
    if (p.slamJumpWindow > 0) {
      // Pulo de slam: mais alto quanto maior a queda do slam, até SLAM_JUMP_MAX.
      p.vel.y = Math.min(cfg.SLAM_JUMP_BASE + p.slamHeight * cfg.SLAM_JUMP_PER_METER, cfg.SLAM_JUMP_MAX);
      p.slamJumpWindow = 0;
      p.events.push({ type: 'slamJump', height: p.slamHeight });
    } else {
      p.vel.y = cfg.JUMP_SPEED;
      p.events.push({ type: 'jump' });
    }
  }

  if (doubleJumping) {
    p.vel.y = cfg.DOUBLE_JUMP_SPEED;
    p.jumpsLeft -= 1;
    p.jumpBuffer = 0; // o aperto foi usado no pulo duplo: não vale como pulo antecipado no pouso
    p.events.push({ type: 'doubleJump' });
  }

  // Slam cai a velocidade constante (sem gravidade somando); corrida na parede, gravidade reduzida.
  // Dash no ar e slam: sem gravidade somando; corrida na parede: gravidade reduzida.
  // Dash no chão: a gravidade continua (o chão a anula), para seguir pisando: sobe degraus
  // e pisa em plataformas de salto durante o arranco. No ar, o dash não perde altura.
  const airDash = dashing && !p.onGround;
  capHorizontalSpeed(p, cfg); // limite absoluto (F1-18)
  stepBody(p, map, dt, airDash || p.slam ? 0 : p.wallrun ? cfg.WALLRUN_GRAVITY_SCALE : 1, cfg);
  updateWall(p, map, dt, cfg); // detector de parede (F1-11)
  if (p.wallrun && p.onGround) endWallrun(p);
  if (p.slam && p.onGround) {
    // Bateu: registra a altura da queda e abre a janela do pulo de slam.
    const height = Math.max(0, p.slam.startY - p.pos.y);
    p.slam = null;
    p.slamHeight = height;
    p.slamJumpWindow = cfg.SLAM_JUMP_WINDOW;
    p.events.push({ type: 'slamLand', height });
  }
  if (p.onGround && p.groundType === BOX_TYPES.PAD) launchFromPad(p, p.groundBox, cfg);
  p.state = dashing ? 'dash' : p.slam ? 'slam' : p.wallrun ? 'wallrun' : p.sliding ? 'slide' : !p.onGround ? 'air' : p.crouching ? 'crouch' : 'ground';
  return p;
}

/**
 * Plataforma de salto (F1-16): ao pousar, lança. Com o campo `launch` do bloco ({x,y,z}, m/s),
 * a velocidade vira exatamente essa; sem ele, sobe a MOVE.PAD_SPEED mantendo a horizontal.
 * Conta como tocar o chão: recarrega pulo duplo e pulos na parede.
 */
function launchFromPad(p, pad, cfg) {
  if (pad && pad.launch) p.vel = { x: pad.launch.x, y: pad.launch.y, z: pad.launch.z };
  else p.vel.y = cfg.PAD_SPEED;
  p.onGround = false;
  p.coyote = 0;
  p.dash = null; // o lançamento vence um dash em andamento
  endSlide(p); // termina um deslize em andamento
  p.jumpsLeft = cfg.AIR_JUMPS;
  p.wallJumpsLeft = cfg.WALL_JUMP_MAX;
  p.wallsUsed = [];
  p.events.push({ type: 'pad', launch: { ...p.vel } });
}

/** Limita a velocidade horizontal a MOVE.MAX_SPEED, mantendo a direção (F1-18). */
export function capHorizontalSpeed(p, cfg = MOVE) {
  const h = Math.hypot(p.vel.x, p.vel.z);
  if (h > cfg.MAX_SPEED) {
    const k = cfg.MAX_SPEED / h;
    p.vel.x *= k;
    p.vel.z *= k;
  }
}

/** Termina o deslize (mantém agachado; quem decide levantar é updateCrouch). */
function endSlide(p) {
  if (!p.sliding) return;
  p.sliding = false;
  p.events.push({ type: 'slideEnd', duration: p.slideTime });
}

/**
 * Regras de agachar e deslizar (F1-10), antes do movimento do passo.
 * - Apertar agachar no chão acima de SLIDE_MIN_SPEED: desliza, com impulso se o tempo de espera passou.
 * - Deslizando: termina abaixo de CROUCH_SPEED (vira agachado), soltando a tecla, pulando ou saindo do chão.
 * - Agachado com a tecla solta: levanta só se couber em pé.
 */
function updateCrouch(p, input, map, jumping, dt, cfg) {
  p.slideCooldown = Math.max(0, p.slideCooldown - dt);
  const speed = Math.hypot(p.vel.x, p.vel.z);

  if (p.onGround && !jumping && input.crouchPressed && !p.sliding && speed > cfg.SLIDE_MIN_SPEED) {
    p.sliding = true;
    p.crouching = true;
    if (p.slideCooldown === 0) {
      const k = (speed + cfg.SLIDE_BOOST) / speed;
      p.vel.x *= k;
      p.vel.z *= k;
      p.slideCooldown = cfg.SLIDE_BOOST_COOLDOWN;
    }
    p.slideTime = 0;
    p.events.push({ type: 'slideStart' });
  } else if (p.sliding) {
    p.slideTime += dt;
    // Pulo no deslize (slide hop): sai com a velocidade do deslize (o passo do pulo não tem atrito).
    if (jumping || !p.onGround || !input.crouch || speed < cfg.CROUCH_SPEED) endSlide(p);
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
export function stepBody(p, map, dt, gravityScale = 1, cfg = MOVE) {
  // Gravidade sempre puxa, sem passar da velocidade máxima de queda. No chão, a colisão
  // zera a queda a cada passo; assim onGround fica estável (não pisca entre passos).
  // gravityScale < 1 reduz a gravidade (corrida na parede, F1-12).
  const before = p.vel.y;
  const after = Math.max(before - cfg.GRAVITY * gravityScale * dt, -cfg.MAX_FALL_SPEED);
  // Na vertical, a posição anda pela média da velocidade no passo (exato para gravidade
  // constante): a altura do pulo bate com a fórmula v² / 2g (F1-07).
  const average = (before + after) / 2;
  p.vel.y = average;
  moveAndCollide(p, map, dt, cfg); // para nas caixas do mapa (F1-03)
  // Se nada zerou a velocidade vertical (chão, teto, degrau), ela termina o passo em `after`.
  if (p.vel.y === average) p.vel.y = after;
  return p;
}
