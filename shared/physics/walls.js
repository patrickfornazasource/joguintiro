// Detector de parede (F1-11): base da corrida na parede (F1-12) e do pulo na parede (F1-13).
// Código puro (sem Three.js, sem DOM).
//
// Olha nos 4 eixos do mundo (+x, -x, +z, -z) uma faixa de MOVE.WALL_PROBE além do corpo
// e devolve a parede mais próxima. A faixa começa a MOVE.STEP_HEIGHT acima dos pés:
// degraus e obstáculos baixos (que se sobem andando) não contam como parede.
import { MOVE, PHYSICS, PLAYER } from '../constants.js';
import { BOX_TYPES as T } from '../maps/format.js';
import { forwardOf, rightOf } from './move.js';

/** Tipos que contam como parede: só `wallrun` permite correr; `solid` permite pulo na parede. */
const WALL_TYPES = new Set([T.SOLID, T.WALLRUN, T.UV]);

const DIRECTIONS = [
  { axis: 'x', sign: 1 },
  { axis: 'x', sign: -1 },
  { axis: 'z', sign: 1 },
  { axis: 'z', sign: -1 },
];

/** De que lado do jogador (pelo olhar) fica uma direção do mundo. */
export function sideOf(yaw, toWall) {
  const f = forwardOf(yaw);
  const r = rightOf(yaw);
  const front = f.x * toWall.x + f.z * toWall.z;
  const right = r.x * toWall.x + r.z * toWall.z;
  if (Math.abs(right) >= Math.abs(front)) return right > 0 ? 'right' : 'left';
  return front > 0 ? 'front' : 'back';
}

/**
 * Parede mais próxima encostada no jogador (até MOVE.WALL_PROBE de distância), ou null.
 * @param {object} p jogador (pos, height, yaw)
 * @param {{ boxes: Array }} map
 * @returns {{ normal: {x,y,z}, type: string, side: 'left'|'right'|'front'|'back', distance: number } | null}
 *   normal aponta da parede para o jogador; side é relativo ao olhar.
 */
export function detectWall(p, map, cfg = MOVE) {
  const r = PLAYER.RADIUS;
  const eps = PHYSICS.CONTACT_EPSILON;
  const yMin = p.pos.y + cfg.STEP_HEIGHT;
  const yMax = p.pos.y + p.height;
  let best = null;

  for (const b of map?.boxes ?? []) {
    if (!WALL_TYPES.has(b.type)) continue;
    if (b.type === T.UV && b.active === false) continue;
    // Altura: a parede precisa estar ao lado do corpo, acima da altura de degrau.
    if (!(b.min.y < yMax - eps && b.max.y > yMin + eps)) continue;

    for (const { axis, sign } of DIRECTIONS) {
      const other = axis === 'x' ? 'z' : 'x';
      // Na direção lateral (o outro eixo), a parede precisa cobrir o corpo.
      if (!(b.min[other] < p.pos[other] + r - eps && b.max[other] > p.pos[other] - r + eps)) continue;
      // Distância entre a face do corpo e a face da caixa, nesta direção.
      const distance = sign > 0 ? b.min[axis] - (p.pos[axis] + r) : p.pos[axis] - r - b.max[axis];
      if (distance < -eps || distance > cfg.WALL_PROBE) continue;
      if (best && distance >= best.distance) continue;
      const toWall = { x: axis === 'x' ? sign : 0, y: 0, z: axis === 'z' ? sign : 0 };
      best = {
        normal: { x: -toWall.x || 0, y: 0, z: -toWall.z || 0 }, // || 0 troca -0 por 0
        type: b.type,
        side: sideOf(p.yaw ?? 0, toWall),
        distance: Math.max(0, distance),
        box: b, // qual bloco é (para a regra de "mesma parede" da corrida na parede)
      };
    }
  }
  return best;
}

/**
 * Atualiza a parede do jogador a cada passo: a detectada agora, ou a última por até
 * MOVE.WALL_MEMORY segundos depois de desencostar (tolerância para o pulo na parede).
 * Preenche p.wall ({ ..., age } ou null) e p.wallAge (s desde o último contato).
 */
export function updateWall(p, map, dt, cfg = MOVE) {
  const now = detectWall(p, map, cfg);
  if (now) {
    p.wall = { ...now, age: 0 };
    p.wallAge = 0;
    return p.wall;
  }
  p.wallAge = (p.wallAge ?? Infinity) + dt;
  if (p.wall && p.wallAge <= cfg.WALL_MEMORY + 1e-9) {
    // Lado recalculado com o olhar atual (a normal não muda; o lado depende de para onde olha).
    const toWall = { x: -p.wall.normal.x, y: 0, z: -p.wall.normal.z };
    p.wall = { ...p.wall, age: p.wallAge, side: sideOf(p.yaw ?? 0, toWall) };
  } else {
    p.wall = null;
  }
  return p.wall;
}
