// Busca de "saídas do mapa": a partir de pontos de partida, tenta várias combinações de
// direção, pulo, pulo duplo, pulo na parede e dash, e diz se o jogador passou das paredes
// externas. Usado pelos testes (não é código do jogo).
import { PHYSICS } from '../../shared/constants.js';
import { createPlayer, stepPlayer, emptyInput } from '../../shared/physics/player.js';

const DT = PHYSICS.FIXED_DT;

/**
 * @param {object} map
 * @param {Array<{x,y,z, run?: boolean}>} starts pontos de partida (run: começa correndo até o pad)
 * @param {number|{x: number, z: number}} limit metade do lado interno do mapa (m): |x| ou |z|
 *   maior que isso = saiu. Um número vale para os dois eixos.
 * @param {object} [cfg] números do movimento (padrão: MOVE), ex.: valores extremos do painel F4
 * @returns {{ tries: number, escapes: Array, maxHeight: number }}
 */
export function searchEscapes(map, starts, limit, cfg = undefined) {
  const lim = typeof limit === 'number' ? { x: limit, z: limit } : limit;
  const escapes = [];
  let tries = 0;
  let maxHeight = 0;
  const dirs = [...Array(8).keys()].map((k) => (k * Math.PI) / 4); // 8 direções (yaw)
  const doubleAt = [null, 0.25, 0.55]; // quando apertar o pulo duplo (s), ou nunca
  const dashAt = [null, 0.15, 0.45]; // quando dar o dash (s), ou nunca
  const wallSpam = [false, true]; // apertar Espaço a cada 0,1 s (pulos na parede)
  for (const s of starts) {
    for (const yaw of dirs) {
      for (const dj of doubleAt) {
        for (const ds of dashAt) {
          for (const spam of wallSpam) {
            tries++;
            const p = createPlayer({ x: s.x, y: s.y, z: s.z, yaw }, cfg);
            let t = 0;
            for (let i = 0; i < 4 / DT; i++) {
              t += DT;
              const press = i === 1 || (dj !== null && Math.abs(t - dj) < DT / 2)
                || (spam && i > 1 && i % 12 === 0);
              const dash = ds !== null && Math.abs(t - ds) < DT / 2;
              stepPlayer(p, { ...emptyInput(), moveZ: 1, yaw, jump: press, jumpPressed: press, dashPressed: dash }, map, DT, cfg);
              maxHeight = Math.max(maxHeight, p.pos.y);
              if (Math.abs(p.pos.x) > lim.x || Math.abs(p.pos.z) > lim.z) {
                escapes.push({ start: s, yaw, dj, ds, spam, at: { x: p.pos.x, y: p.pos.y, z: p.pos.z } });
                break;
              }
            }
          }
        }
      }
    }
  }
  return { tries, escapes, maxHeight };
}
