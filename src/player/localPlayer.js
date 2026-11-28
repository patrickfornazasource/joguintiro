// Jogador local: junta a entrada de cada passo, roda a física compartilhada e guarda
// a posição anterior e a atual para a câmera interpolar entre passos.
// Sem Three.js e sem DOM: testável no Node (a câmera é atualizada em main.js).
import { PLAYER, VIEW, MOVE, CHARGE } from '../../shared/constants.js';
import { createCharge, updateCharge, refillCharge } from '../../shared/combat/charge.js';
import { createPlayer, stepPlayer, emptyInput } from '../../shared/physics/player.js';
import { createStepSmoother } from '../core/stepSmoothing.js';
import { rightOf } from '../../shared/physics/move.js';
import { CAMERA, HUD } from '../config/camera.js';
import { isSolid } from '../../shared/physics/collide.js';

/** Chave do localStorage para o campo de visão escolhido. */
export const FOV_STORAGE_KEY = 'luzNegra.fov';

/**
 * Campo de visão base: ?fov= no endereço (e salvo), senão o salvo, senão o padrão.
 * Aceita de CAMERA.FOV_MIN_ALLOWED a CAMERA.FOV_MAX_ALLOWED graus.
 */
export function resolveFov(search, storage) {
  const valid = (v) => {
    const n = Number(v);
    return v !== null && v !== '' && Number.isFinite(n) && n >= CAMERA.FOV_MIN_ALLOWED && n <= CAMERA.FOV_MAX_ALLOWED ? n : null;
  };
  const fromUrl = valid(new URLSearchParams(search).get('fov'));
  if (fromUrl !== null) {
    try {
      storage?.setItem(FOV_STORAGE_KEY, String(fromUrl));
    } catch {
      // sem localStorage: vale só nesta sessão
    }
    return fromUrl;
  }
  let saved = null;
  try {
    saved = valid(storage?.getItem(FOV_STORAGE_KEY));
  } catch {
    saved = null;
  }
  return saved ?? CAMERA.FOV_BASE;
}

/** Campo de visão alvo para uma velocidade horizontal: abre até FOV_MAX em FOV_MAX_AT_SPEED. */
export function fovForSpeed(speed, base = CAMERA.FOV_BASE) {
  const k = Math.max(0, Math.min(1, speed / CAMERA.FOV_MAX_AT_SPEED));
  return base + (CAMERA.FOV_MAX - CAMERA.FOV_BASE) * k;
}

/** Faixa do velocímetro: 0 normal, 1 acima de 15 m/s, 2 acima de 25 m/s. */
export function speedTier(speed) {
  if (speed > HUD.SPEED_TIER_2) return 2;
  if (speed > HUD.SPEED_TIER_1) return 1;
  return 0;
}

/** Inclinação ao andar de lado no chão (rad): para o lado do movimento (D: direita). */
export function strafeTiltTarget(player, moveX) {
  if (!player.onGround || player.sliding || !moveX) return 0;
  return -Math.sign(moveX) * CAMERA.STRAFE_TILT;
}

/** Profundidade do afundamento ao pousar de uma queda de `height` m (0 até 3 m). */
export function landDipDepth(height) {
  if (height <= CAMERA.LAND_DIP_MIN_HEIGHT) return 0;
  return CAMERA.LAND_DIP_DEPTH * Math.min(1, height / CAMERA.LAND_DIP_FULL_HEIGHT);
}

/** Intensidade da tremida do slam (m): proporcional à altura da queda, até VIEW.SLAM_SHAKE em 10 m. */
export function slamShakeAmplitude(height) {
  return VIEW.SLAM_SHAKE * Math.min(1, Math.max(0, height) / 10);
}

/** Deslocamento da tremida: oscila rápido e some até o fim do tempo. Sem aleatório (repetível). */
function shakeOffset(shake) {
  if (shake.time <= 0 || shake.amp <= 0) return { x: 0, y: 0, z: 0 };
  const fade = shake.time / VIEW.SLAM_SHAKE_TIME;
  const t = shake.clock;
  return {
    x: shake.amp * fade * Math.sin(t * 97),
    y: shake.amp * fade * Math.sin(t * 131 + 1),
    z: shake.amp * fade * Math.sin(t * 113 + 2),
  };
}

/**
 * Inclinação alvo da câmera (rad): correndo na parede, inclina para o lado oposto a ela,
 * proporcional a quanto a parede está de lado (de frente ou de costas não inclina).
 * Positivo = cabeça para a esquerda (parede à direita).
 */
export function wallrunTiltTarget(player, yaw) {
  if (!player.wallrun) return 0;
  const n = player.wallrun.normal;
  const r = rightOf(yaw);
  const wallOnRight = -(n.x * r.x + n.z * r.z); // 1 = parede bem à direita, -1 = à esquerda
  return VIEW.WALLRUN_TILT * wallOnRight;
}

/** Chave do localStorage para a sensibilidade escolhida. */
export const SENS_STORAGE_KEY = 'luzNegra.sens';

/** Sensibilidade válida? (número positivo e não absurdo) */
function validSens(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 && n < 0.1 ? n : null;
}

/**
 * Sensibilidade do mouse: ?sens= no endereço (e salva), senão a salva, senão a padrão.
 * @param {string} search ex.: '?sens=0.003'
 * @param {Storage|null} storage
 */
export function resolveSensitivity(search, storage) {
  const fromUrl = validSens(new URLSearchParams(search).get('sens'));
  if (fromUrl !== null) {
    try {
      storage?.setItem(SENS_STORAGE_KEY, String(fromUrl));
    } catch {
      // sem localStorage: vale só nesta sessão
    }
    return fromUrl;
  }
  let saved = null;
  try {
    saved = validSens(storage?.getItem(SENS_STORAGE_KEY));
  } catch {
    saved = null;
  }
  return saved ?? VIEW.MOUSE_SENSITIVITY;
}

/** Mantém o pitch entre -MAX_PITCH e +MAX_PITCH. */
export function clampPitch(pitch) {
  return Math.max(-VIEW.MAX_PITCH, Math.min(VIEW.MAX_PITCH, pitch));
}

/** Monta a entrada de um passo (formato de shared/physics/player.js) a partir do teclado. */
export function buildInput(keys, yaw, pitch) {
  const axis = (pos, neg) => (keys.isDown(pos) ? 1 : 0) - (keys.isDown(neg) ? 1 : 0);
  return {
    ...emptyInput(),
    moveX: axis('right', 'left'),
    moveZ: axis('forward', 'back'),
    yaw,
    pitch,
    jump: keys.isDown('jump'),
    jumpPressed: keys.pressed('jump'),
    crouch: keys.isDown('crouch'),
    crouchPressed: keys.pressed('crouch'),
    dashPressed: keys.pressed('dash'),
  };
}

/**
 * Retângulo (no plano) que cobre todas as caixas sólidas do mapa, paredes externas inclusive.
 * Quem passa dele saiu do mapa. Mapa sem caixas: sem limite.
 */
export function mapArea(map) {
  const solid = (map?.boxes ?? []).filter(isSolid);
  if (!solid.length) return null;
  return {
    minX: Math.min(...solid.map((b) => b.min.x)),
    maxX: Math.max(...solid.map((b) => b.max.x)),
    minZ: Math.min(...solid.map((b) => b.min.z)),
    maxZ: Math.max(...solid.map((b) => b.max.z)),
  };
}

/**
 * Cria o jogador local.
 * @param {{ map: object, spawnIndex?: number, sensitivity?: number, fovBase?: number, move?: object }} opts
 *   move: números do movimento (padrão MOVE). O painel de ajuste (F1-20) passa uma cópia
 *   editável; mudar um valor nela vale no passo seguinte.
 *   chargeCfg: números da Carga (padrão CHARGE; o painel F4 passa uma cópia editável, F2-01).
 */
export function createLocalPlayer({ map, spawnIndex = 0, sensitivity = VIEW.MOUSE_SENSITIVITY, fovBase = CAMERA.FOV_BASE, move = MOVE, chargeCfg = CHARGE }) {
  let spawn = map.spawns[spawnIndex] ?? map.spawns[0];
  let lastGround = { x: spawn.x, z: spawn.z }; // último lugar onde pisou no chão
  const smoother = createStepSmoother(move);
  const area = mapArea(map);
  let outOfMap = 0; // vezes que saiu do mapa e voltou (rede de segurança)
  let player = createPlayer(spawn, move);
  const charge = createCharge(chargeCfg); // Carga Cinética (F2-01): começa cheia
  let prev = { ...player.pos };
  let yaw = spawn.yaw ?? 0;
  let pitch = 0;
  let respawns = 0;
  let eyeHeight = PLAYER.EYE_HEIGHT; // altura do olho mostrada (suavizada ao agachar/levantar)
  let roll = 0; // inclinação da câmera (rad), suavizada (corrida na parede)
  let shake = { time: 0, amp: 0, clock: 0 }; // tremida curta ao bater o slam (F1-14)
  let fov = fovBase; // campo de visão mostrado (suavizado), abre com a velocidade (F1-18)
  let moveX = 0; // tecla de lado do último passo (para a inclinação ao andar de lado)
  let airPeak = null; // ponto mais alto desde que saiu do chão (para o afundamento ao pousar)
  let dip = { time: 0, depth: 0 }; // afundamento da câmera ao pousar de alto

  /** Ponto de nascimento mais perto de (x, z) no plano. */
  function nearestSpawn(x, z) {
    let best = spawn;
    let bestD = Infinity;
    for (const s of map.spawns) {
      const d = (s.x - x) ** 2 + (s.z - z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best;
  }

  /**
   * Renasce num ponto. Padrão: o mais perto do último lugar onde pisou no chão (F1-19): quem cai
   * num fosso volta à estação em que estava, e não à seguinte (que pode estar mais perto do buraco).
   */
  function respawn(at = nearestSpawn(lastGround.x, lastGround.z)) {
    spawn = at;
    lastGround = { x: at.x, z: at.z };
    player = createPlayer(spawn, move);
    refillCharge(charge, chargeCfg); // GDD seção 11: renasce com Carga cheia
    prev = { ...player.pos };
    smoother.reset();
    eyeHeight = PLAYER.EYE_HEIGHT;
    roll = 0;
    shake = { time: 0, amp: 0, clock: 0 };
    fov = fovBase;
    airPeak = null;
    dip = { time: 0, depth: 0 };
    yaw = spawn.yaw ?? 0;
    pitch = 0;
    respawns++;
  }

  return {
    get player() {
      return player;
    },
    get yaw() {
      return yaw;
    },
    /** Campo de visão para desenhar (graus), atualizado em eye(). */
    get fov() {
      return fov;
    },
    /** Velocidade horizontal atual (m/s), para o velocímetro. */
    get speed() {
      return Math.hypot(player.vel.x, player.vel.z);
    },
    /** Afundamento atual da câmera ao pousar (m, positivo = para baixo). */
    get landDip() {
      if (dip.time <= 0) return 0;
      const k = dip.time / CAMERA.LAND_DIP_TIME; // 1 no pouso, 0 no fim
      return dip.depth * Math.sin(Math.PI * (1 - k)); // desce e volta, suave
    },
    /** Inclinação da câmera para desenhar (rad), atualizada em eye(). */
    get roll() {
      return roll;
    },
    get pitch() {
      return pitch;
    },
    get respawns() {
      return respawns;
    },
    /** Vezes que passou das paredes externas e voltou para a estação (rede de segurança). */
    get outOfMap() {
      return outOfMap;
    },
    /** Números do movimento em uso (MOVE, ou a cópia do painel de ajuste). */
    move,
    /** Carga Cinética (F2-01): { value, rate }. */
    charge,
    /** Números da Carga em uso (CHARGE, ou a cópia do painel de ajuste). */
    chargeCfg,
    /** Volta ao ponto de nascimento (estação) mais perto de onde está agora (tecla R). */
    respawnNearest() {
      respawn(nearestSpawn(player.pos.x, player.pos.z));
    },
    sensitivity,

    /** Gira a visão pelo movimento do mouse (pixels). Chamar a cada quadro. */
    look(dx, dy) {
      yaw -= dx * this.sensitivity; // mouse para a direita gira para a direita
      pitch = clampPitch(pitch - dy * this.sensitivity); // mouse para cima olha para cima
    },

    /** Um passo fixo de simulação. */
    step(keys, dt) {
      const input = buildInput(keys, yaw, pitch);
      player.yaw = yaw;
      player.pitch = pitch;
      moveX = input.moveX;
      prev = { ...player.pos };
      const wasOnGround = player.onGround;
      stepPlayer(player, input, map, dt, move);
      updateCharge(charge, player, dt, chargeCfg, move); // depois da física: lê velocidade e eventos
      // Afundamento ao pousar de alto (> 3 m): mede a queda desde o ponto mais alto no ar.
      if (!player.onGround) airPeak = Math.max(airPeak ?? player.pos.y, player.pos.y);
      if (player.onGround && !wasOnGround && airPeak !== null) {
        const depth = landDipDepth(airPeak - player.pos.y);
        if (depth > 0) dip = { time: CAMERA.LAND_DIP_TIME, depth };
        airPeak = null;
      }
      if (player.onGround) {
        airPeak = null;
        lastGround = { x: player.pos.x, z: player.pos.z };
      }
      const land = player.events.find((e) => e.type === 'slamLand');
      if (land) shake = { time: VIEW.SLAM_SHAKE_TIME, amp: slamShakeAmplitude(land.height), clock: 0 };
      if (player.pos.y < -PLAYER.RESPAWN_FALL_DEPTH) respawn();
      // Rede de segurança (F1-20): com números extremos no painel de ajuste, um pulo pode passar
      // por cima das paredes externas. Quem sai do mapa volta para a estação onde estava.
      else if (area && (player.pos.x < area.minX || player.pos.x > area.maxX || player.pos.z < area.minZ || player.pos.z > area.maxZ)) {
        outOfMap++;
        respawn();
      }
    },

    /**
     * Posição do olho para desenhar: interpola entre o passo anterior e o atual
     * (alpha de 0 a 1, vindo do laço) e suaviza a subida de degraus.
     */
    /** Deslocamento atual da tremida do slam (m), para testes e para a câmera. */
    get shakeOffset() {
      return shakeOffset(shake);
    },

    eye(alpha, frameDt) {
      shake.time = Math.max(0, shake.time - Math.max(0, frameDt));
      shake.clock += Math.max(0, frameDt);
      const offset = shakeOffset(shake);
      const lerp = (a, b) => a + (b - a) * alpha;
      const feetY = smoother.update(lerp(prev.y, player.pos.y), player.onGround, frameDt);
      // Agachar/deslizar: a física muda a altura de uma vez; a câmera desce/sobe suavemente.
      const target = player.crouching ? PLAYER.CROUCH_EYE_HEIGHT : PLAYER.EYE_HEIGHT;
      eyeHeight += (target - eyeHeight) * (1 - Math.exp(-VIEW.CROUCH_SMOOTH_RATE * Math.max(0, frameDt)));
      if (Math.abs(target - eyeHeight) < 1e-4) eyeHeight = target;
      // Inclinação: corrida na parede (lado oposto à parede) ou andar de lado no chão (±1,5°).
      const wallTilt = wallrunTiltTarget(player, yaw);
      const tilt = wallTilt !== 0 ? wallTilt : strafeTiltTarget(player, moveX);
      // Campo de visão abre com a velocidade (F1-18).
      const fovTarget = fovForSpeed(Math.hypot(player.vel.x, player.vel.z), fovBase);
      fov += (fovTarget - fov) * (1 - Math.exp(-CAMERA.FOV_SMOOTH_RATE * Math.max(0, frameDt)));
      if (Math.abs(fovTarget - fov) < 1e-3) fov = fovTarget;
      dip.time = Math.max(0, dip.time - Math.max(0, frameDt));
      roll += (tilt - roll) * (1 - Math.exp(-VIEW.TILT_SMOOTH_RATE * Math.max(0, frameDt)));
      if (Math.abs(tilt - roll) < 1e-5) roll = tilt;
      return {
        x: lerp(prev.x, player.pos.x) + offset.x,
        y: feetY + eyeHeight + offset.y - this.landDip,
        z: lerp(prev.z, player.pos.z) + offset.z,
      };
    },
  };
}
