// Tiro instantâneo (hitscan, F2-02). Código puro (sem Three.js, sem DOM).
// Um raio sai de `origin` na direção `dir` e acha a primeira coisa no caminho: uma caixa sólida
// do mapa ou o corpo de um alvo (a caixa do corpo, como a colisão do jogador).
import { isSolid } from '../physics/collide.js';
import { PLAYER } from '../constants.js';

/**
 * Distância até onde o raio entra numa caixa (método das fatias), ou null se não acerta.
 * Começando dentro da caixa, devolve 0.
 * @param {{x,y,z}} o origem
 * @param {{x,y,z}} d direção (comprimento 1)
 * @param {{ min: {x,y,z}, max: {x,y,z} }} b
 * @param {number} maxDist
 */
export function rayBox(o, d, b, maxDist) {
  let tMin = 0;
  let tMax = maxDist;
  for (const a of ['x', 'y', 'z']) {
    if (Math.abs(d[a]) < 1e-12) {
      if (o[a] < b.min[a] || o[a] > b.max[a]) return null; // paralelo e fora da fatia
      continue;
    }
    let t1 = (b.min[a] - o[a]) / d[a];
    let t2 = (b.max[a] - o[a]) / d[a];
    if (t1 > t2) [t1, t2] = [t2, t1];
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return null;
  }
  return tMin;
}

/** Caixa do corpo de um alvo: { pos (pés), height?, radius? } (formato do jogador da física). */
export function targetBox(t) {
  const r = t.radius ?? PLAYER.RADIUS;
  const h = t.height ?? PLAYER.HEIGHT;
  return { min: { x: t.pos.x - r, y: t.pos.y, z: t.pos.z - r }, max: { x: t.pos.x + r, y: t.pos.y + h, z: t.pos.z + r } };
}

/**
 * Primeiro acerto do raio.
 * @param {{x,y,z}} origin
 * @param {{x,y,z}} dir comprimento 1
 * @param {number} maxDist (m)
 * @param {{ map?: { boxes: Array }, targets?: Array, ignore?: object }} world alvos com { pos, ... };
 *   `ignore` é quem atira (não acerta a si mesmo)
 * @returns {{ kind: 'box'|'target'|'none', dist: number, point: {x,y,z}, target?: object, box?: object }}
 */
export function castRay(origin, dir, maxDist, world = {}) {
  let best = { kind: 'none', dist: maxDist };
  for (const b of world.map?.boxes ?? []) {
    if (!isSolid(b)) continue;
    const t = rayBox(origin, dir, b, best.dist);
    if (t !== null && t < best.dist) best = { kind: 'box', dist: t, box: b };
  }
  for (const target of world.targets ?? []) {
    if (target === world.ignore || target.dead) continue;
    const t = rayBox(origin, dir, targetBox(target), best.dist);
    if (t !== null && t < best.dist) best = { kind: 'target', dist: t, target };
  }
  best.point = { x: origin.x + dir.x * best.dist, y: origin.y + dir.y * best.dist, z: origin.z + dir.z * best.dist };
  return best;
}
