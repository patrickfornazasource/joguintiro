// Colisão do jogador com o mapa (caixas alinhadas aos eixos, AABB).
// Código puro (sem Three.js, sem DOM).
//
// O jogador é uma caixa: largura 2 x PLAYER.RADIUS em x e z, altura p.height,
// com a base nos pés (p.pos). O movimento é resolvido eixo a eixo: X, depois Z, depois Y.
// Se o deslocamento de um passo for maior que o raio, ele é dividido em sub-passos
// para o jogador não atravessar paredes finas em alta velocidade.
//
// Degraus (F1-04): andando no chão, se o bloco que barrou tiver o topo até
// MOVE.STEP_HEIGHT acima dos pés e houver espaço livre lá em cima, o jogador é
// colocado em cima dele em vez de parar. A física sobe de uma vez; a câmera suaviza
// (src/core/stepSmoothing.js).
import { MOVE, PHYSICS, PLAYER } from '../constants.js';
import { BOX_TYPES } from '../maps/format.js';

/**
 * Duas caixas se sobrepõem? Caixas que só se encostam (até CONTACT_EPSILON) não contam.
 * @param {{min:{x,y,z}, max:{x,y,z}}} a
 * @param {{min:{x,y,z}, max:{x,y,z}}} b
 */
export function overlaps(a, b, eps = PHYSICS.CONTACT_EPSILON) {
  return (
    a.min.x < b.max.x - eps &&
    a.max.x > b.min.x + eps &&
    a.min.y < b.max.y - eps &&
    a.max.y > b.min.y + eps &&
    a.min.z < b.max.z - eps &&
    a.max.z > b.min.z + eps
  );
}

/** Caixa do jogador na posição atual. */
export function playerBox(p) {
  const r = PLAYER.RADIUS;
  return {
    min: { x: p.pos.x - r, y: p.pos.y, z: p.pos.z - r },
    max: { x: p.pos.x + r, y: p.pos.y + p.height, z: p.pos.z + r },
  };
}

/** A caixa participa da colisão? Tinta UV inativa (active: false) é ignorada. */
export function isSolid(b) {
  return !(b.type === BOX_TYPES.UV && b.active === false);
}

const NORMALS = {
  x: (dir) => ({ x: -dir, y: 0, z: 0 }),
  z: (dir) => ({ x: 0, y: 0, z: -dir }),
};

/**
 * O jogador caberia com esta altura na posição atual? (ex.: para levantar do agachado)
 * @param {object} p jogador
 * @param {{ boxes: Array }} map
 * @param {number} height altura a testar (m)
 */
export function fitsWithHeight(p, map, height) {
  const r = PLAYER.RADIUS;
  const test = {
    min: { x: p.pos.x - r, y: p.pos.y, z: p.pos.z - r },
    max: { x: p.pos.x + r, y: p.pos.y + height, z: p.pos.z + r },
  };
  return !(map?.boxes ?? []).some((b) => isSolid(b) && overlaps(test, b));
}

/** Alguma caixa sobrepõe o jogador na posição atual? */
function blocked(p, boxes) {
  const pb = playerBox(p);
  return boxes.some((b) => overlaps(pb, b));
}

/**
 * Tenta subir no(s) bloco(s) que barraram o movimento horizontal.
 * Só vale se todos têm o topo até MOVE.STEP_HEIGHT acima dos pés e se o jogador
 * cabe em cima. Devolve true se subiu.
 */
function tryStepUp(p, boxes, hits) {
  const top = Math.max(...hits.map((b) => b.max.y));
  const rise = top - p.pos.y;
  if (!(rise > 0 && rise <= MOVE.STEP_HEIGHT)) return false;
  const oldY = p.pos.y;
  p.pos.y = top;
  if (blocked(p, boxes)) {
    p.pos.y = oldY; // sem espaço acima (teto baixo ou parede alta atrás)
    return false;
  }
  const ground = hits.find((b) => b.max.y === top);
  p.onGround = true;
  p.groundType = ground.type;
  p.groundBox = ground;
  if (p.vel.y < 0) p.vel.y = 0;
  return true;
}

/**
 * Move num eixo e empurra para fora de qualquer caixa atravessada. Devolve true se bateu.
 * @param {boolean} canStep pode subir degraus (estava no chão)
 */
function moveAxis(p, boxes, axis, delta, canStep) {
  if (delta === 0) return false;
  p.pos[axis] += delta;
  const dir = Math.sign(delta);
  const r = PLAYER.RADIUS;

  if (axis !== 'y' && canStep) {
    const pb = playerBox(p);
    const hits = boxes.filter((b) => overlaps(pb, b));
    if (hits.length && tryStepUp(p, boxes, hits)) return false;
  }

  let hit = false;
  for (const b of boxes) {
    if (!overlaps(playerBox(p), b)) continue;
    hit = true;
    if (axis === 'y') {
      if (dir < 0) {
        p.pos.y = b.max.y; // pés em cima da caixa
        p.onGround = true;
        p.groundType = b.type;
        p.groundBox = b;
      } else {
        p.pos.y = b.min.y - p.height; // cabeça embaixo da caixa
      }
      p.vel.y = 0;
    } else {
      p.pos[axis] = dir > 0 ? b.min[axis] - r : b.max[axis] + r;
      p.vel[axis] = 0;
      p.contact = { normal: NORMALS[axis](dir), type: b.type };
    }
  }
  return hit;
}

/**
 * Move o jogador pela velocidade durante dt, parando nas caixas do mapa.
 * Atualiza p.pos, p.vel, p.onGround, p.groundType e p.contact.
 * @param {object} p jogador (shared/physics/player.js)
 * @param {{ boxes: Array }} map
 * @param {number} dt (s)
 */
export function moveAndCollide(p, map, dt) {
  const wasOnGround = p.onGround;
  p.onGround = false;
  p.groundType = null;
  p.groundBox = null;
  p.contact = null;

  const boxes = (map?.boxes ?? []).filter(isSolid);
  const d = { x: p.vel.x * dt, y: p.vel.y * dt, z: p.vel.z * dt };
  const largest = Math.max(Math.abs(d.x), Math.abs(d.y), Math.abs(d.z));
  const subSteps = Math.max(1, Math.ceil(largest / PLAYER.RADIUS));
  const part = { x: d.x / subSteps, y: d.y / subSteps, z: d.z / subSteps };

  for (let i = 0; i < subSteps; i++) {
    for (const axis of ['x', 'z', 'y']) {
      // Depois de bater num eixo, para de andar nele no resto deste passo.
      // Degraus só andando: estava no chão no passo anterior ou pousou/subiu neste.
      const canStep = (wasOnGround || p.onGround) && p.vel.y <= 0;
      if (moveAxis(p, boxes, axis, part[axis], canStep)) part[axis] = 0;
    }
  }
  return p;
}
