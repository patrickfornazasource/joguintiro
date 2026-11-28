// Corrida na parede (F1-12). Código puro (sem Three.js, sem DOM).
//
// Entrar: no ar, encostado agora numa parede `wallrun`, com velocidade ao longo dela
// acima de WALLRUN_MIN_SPEED (de frente para a parede não entra), e fora do tempo de
// espera para voltar à mesma parede. Ao entrar, recarrega o pulo duplo.
// Durante: velocidade só ao longo da parede (mais uma leve "cola" contra ela), gravidade
// reduzida (aplicada em stepBody), ganho de velocidade até WALLRUN_MAX_SPEED.
// Sair: tempo esgotado, velocidade baixa, fim da parede, tecla para longe dela, pousar,
// ou pular (empurra para fora e para cima, mantendo a velocidade ao longo da parede).
// Voltar à mesma parede: depois de sair por TEMPO ou VELOCIDADE BAIXA, só depois de tocar
// o chão ou de grudar em outra parede (o limite de ~1,5 s não pode ser renovado na mesma
// parede). Nas outras saídas (pulo, tecla, fim da parede), após WALLRUN_REATTACH_DELAY.
import { MOVE } from '../constants.js';
import { BOX_TYPES as T } from '../maps/format.js';
import { wishDir } from './move.js';

/** Parte horizontal da velocidade ao longo da parede (tira a componente na direção da normal). */
function alongWall(vel, n) {
  const into = vel.x * n.x + vel.z * n.z;
  return { x: vel.x - into * n.x, z: vel.z - into * n.z };
}

/**
 * Termina a corrida na parede (lembra a parede para a regra de voltar a ela).
 * @param {object} p jogador
 * @param {boolean} [exhausted] saiu por tempo ou velocidade baixa: a mesma parede fica
 *   bloqueada até tocar o chão ou grudar em outra parede
 */
export function endWallrun(p, exhausted = false) {
  if (!p.wallrun) return;
  p.wallrunLast = { box: p.wallrun.box, age: 0, exhausted };
  p.wallrun = null;
  p.events.push({ type: 'wallrunEnd' });
}

/** Velocidade do passo durante a corrida: ao longo da parede, ganhando velocidade, colada nela. */
function runAlong(p, dt) {
  const n = p.wallrun.normal;
  const t = alongWall(p.vel, n);
  const speed = Math.hypot(t.x, t.z);
  const next = speed < MOVE.WALLRUN_MAX_SPEED
    ? Math.min(speed + MOVE.WALLRUN_ACCEL * dt, MOVE.WALLRUN_MAX_SPEED)
    : speed; // já acima do máximo (chegou rápido): não acelera, mas também não freia
  const k = speed > 0 ? next / speed : 0;
  p.vel.x = t.x * k - n.x * MOVE.WALLRUN_STICK;
  p.vel.z = t.z * k - n.z * MOVE.WALLRUN_STICK;
}

/**
 * Regras da corrida na parede num passo, antes do movimento.
 * Usa p.wall (do detector, F1-11) do passo anterior.
 * @returns {'running'|'jumped'|null} 'running' correndo (já cuidou da velocidade),
 *   'jumped' pulou para fora neste passo, null fora da parede
 */
export function updateWallrun(p, input, dt) {
  if (p.wallrunLast) {
    p.wallrunLast.age += dt;
    if (p.onGround) p.wallrunLast.exhausted = false; // tocar o chão libera a parede de novo
  }

  const wish = wishDir(input);
  const amount = Math.hypot(wish.x, wish.z);

  if (p.wallrun) {
    const w = p.wallrun;
    w.time += dt;
    const n = w.normal;
    // Pular: sai em diagonal (para fora e para cima), mantendo a velocidade ao longo da parede.
    if (input.jumpPressed) {
      const t = alongWall(p.vel, n);
      p.vel.x = t.x + n.x * MOVE.WALLRUN_JUMP_OUT;
      p.vel.z = t.z + n.z * MOVE.WALLRUN_JUMP_OUT;
      p.vel.y = MOVE.WALLRUN_JUMP_UP;
      p.coyote = 0;
      p.jumpBuffer = 0;
      p.events.push({ type: 'wallrunJump' });
      endWallrun(p);
      return 'jumped';
    }
    const touching = p.wall && p.wall.age === 0 && p.wall.box === w.box;
    const t = alongWall(p.vel, n);
    const awayFromWall = amount > 0 && (wish.x * n.x + wish.z * n.z) / amount > MOVE.WALLRUN_RELEASE_DOT;
    const exhausted = w.time >= MOVE.WALLRUN_MAX_TIME || Math.hypot(t.x, t.z) < MOVE.WALLRUN_MIN_SPEED;
    if (p.onGround || !touching || exhausted || awayFromWall) {
      endWallrun(p, exhausted);
      return null;
    }
    runAlong(p, dt);
    return 'running';
  }

  // Entrar.
  const wall = p.wall;
  if (p.onGround || !wall || wall.age !== 0 || wall.type !== T.WALLRUN) return null;
  const last = p.wallrunLast;
  const sameWallBlocked = last && last.box === wall.box
    && (last.exhausted || last.age < MOVE.WALLRUN_REATTACH_DELAY);
  if (sameWallBlocked) return null;
  // A face precisa ter comprimento para correr: a ponta estreita de uma parede fina não serve.
  const faceAxis = wall.normal.x !== 0 ? 'z' : 'x';
  if (wall.box.max[faceAxis] - wall.box.min[faceAxis] < MOVE.WALLRUN_MIN_FACE) return null;
  const t = alongWall(p.vel, wall.normal);
  if (Math.hypot(t.x, t.z) < MOVE.WALLRUN_MIN_SPEED) return null; // devagar ou de frente

  p.wallrun = { box: wall.box, normal: { ...wall.normal }, time: 0 };
  p.wallrunLast = null; // grudar em outra parede libera a anterior
  p.vel.y = 0; // entra sem subir nem cair: depois só a gravidade reduzida
  p.jumpsLeft = MOVE.AIR_JUMPS; // correr na parede recarrega o pulo duplo (GDD)
  p.wallJumpsLeft = MOVE.WALL_JUMP_MAX; // e os pulos na parede (F1-13)
  p.jumpBuffer = 0;
  p.events.push({ type: 'wallrunStart' });
  runAlong(p, dt);
  return 'running';
}
