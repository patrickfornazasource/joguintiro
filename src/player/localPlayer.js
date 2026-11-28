// Jogador local: junta a entrada de cada passo, roda a física compartilhada e guarda
// a posição anterior e a atual para a câmera interpolar entre passos.
// Sem Three.js e sem DOM: testável no Node (a câmera é atualizada em main.js).
import { PLAYER, VIEW } from '../../shared/constants.js';
import { createPlayer, stepPlayer, emptyInput } from '../../shared/physics/player.js';
import { createStepSmoother } from '../core/stepSmoothing.js';
import { rightOf } from '../../shared/physics/move.js';

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
 * Cria o jogador local.
 * @param {{ map: object, spawnIndex?: number, sensitivity?: number }} opts
 */
export function createLocalPlayer({ map, spawnIndex = 0, sensitivity = VIEW.MOUSE_SENSITIVITY }) {
  const spawn = map.spawns[spawnIndex] ?? map.spawns[0];
  const smoother = createStepSmoother();
  let player = createPlayer(spawn);
  let prev = { ...player.pos };
  let yaw = spawn.yaw ?? 0;
  let pitch = 0;
  let respawns = 0;
  let eyeHeight = PLAYER.EYE_HEIGHT; // altura do olho mostrada (suavizada ao agachar/levantar)
  let roll = 0; // inclinação da câmera (rad), suavizada (corrida na parede)
  let shake = { time: 0, amp: 0, clock: 0 }; // tremida curta ao bater o slam (F1-14)

  function respawn() {
    player = createPlayer(spawn);
    prev = { ...player.pos };
    smoother.reset();
    eyeHeight = PLAYER.EYE_HEIGHT;
    roll = 0;
    shake = { time: 0, amp: 0, clock: 0 };
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
      prev = { ...player.pos };
      stepPlayer(player, input, map, dt);
      const land = player.events.find((e) => e.type === 'slamLand');
      if (land) shake = { time: VIEW.SLAM_SHAKE_TIME, amp: slamShakeAmplitude(land.height), clock: 0 };
      if (player.pos.y < -PLAYER.RESPAWN_FALL_DEPTH) respawn();
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
      // Corrida na parede: câmera inclina suavemente para o lado oposto à parede.
      const tilt = wallrunTiltTarget(player, yaw);
      roll += (tilt - roll) * (1 - Math.exp(-VIEW.TILT_SMOOTH_RATE * Math.max(0, frameDt)));
      if (Math.abs(tilt - roll) < 1e-5) roll = tilt;
      return {
        x: lerp(prev.x, player.pos.x) + offset.x,
        y: feetY + eyeHeight + offset.y,
        z: lerp(prev.z, player.pos.z) + offset.z,
      };
    },
  };
}
