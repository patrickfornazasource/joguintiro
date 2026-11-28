// Busca de "escalada" (pedido do dono, F1: corrida em todas as paredes): até que altura os pés
// chegam perto de paredes altas, combinando corrida na parede, pulo da corrida, pulo duplo,
// pulos na parede e dash. Usado pelos testes e para relatar números (não é código do jogo).
import { PHYSICS } from '../../shared/constants.js';
import { box, BOX_TYPES as T } from '../../shared/maps/format.js';
import { createPlayer, stepPlayer, emptyInput } from '../../shared/physics/player.js';

const DT = PHYSICS.FIXED_DT;
const WALL_TOP = 60; // paredes bem altas: o que limita é o movimento, não o topo

/** Cenários de parede: isolada, canto (duas paredes em L) e poço estreito (2 m). */
export function climbMaps(type = T.SOLID) {
  const floor = box(0, -0.5, 0, 400, 1, 400);
  return {
    isolada: { id: 'isolada', name: 'isolada', spawns: [], boxes: [floor, box(1.25, WALL_TOP / 2, -30, 0.5, WALL_TOP, 80, type)] },
    canto: { id: 'canto', name: 'canto', spawns: [], boxes: [floor, box(1.25, WALL_TOP / 2, -30, 0.5, WALL_TOP, 80, type), box(-20, WALL_TOP / 2, -40.25, 42, WALL_TOP, 0.5, type)] },
    poco: { id: 'poco', name: 'poco', spawns: [], boxes: [floor, box(1.25, WALL_TOP / 2, -30, 0.5, WALL_TOP, 80, type), box(-1.25, WALL_TOP / 2, -30, 0.5, WALL_TOP, 80, type)] },
  };
}

/**
 * Corre em -z junto da parede em x = 1 e tenta subir. Devolve a maior altura dos pés (m) e o
 * roteiro que chegou lá.
 */
export function searchClimb(map, cfg = undefined) {
  let best = { height: 0, how: null };
  for (const speed of [9, 13, 20, 30]) {
    for (const toWallAt of [0.15, 0.3]) { // quando puxar para a parede (s depois do pulo)
      for (const runJumpAt of [null, 0.1, 0.3, 0.6, 1.0]) { // pulo da corrida na parede (s na parede)
        for (const back of [false, true]) { // depois de sair, volta a puxar para a parede
          for (const spam of [0, 8, 14, 24]) { // Espaço a cada N passos (pulos na parede), 0 = nunca
            for (const dashAfter of [false, true]) {
              const p = createPlayer({ x: 0.3, y: 0, z: 0, yaw: 0 }, cfg);
              p.vel = { x: 0, y: 0, z: -speed };
              let t = 0;
              let ranFor = 0;
              let jumpedOff = false;
              let dashed = false;
              let doubled = false;
              for (let i = 0; i < 6 / DT; i++) {
                t += DT;
                if (p.wallrun) ranFor += DT;
                let moveX = t > toWallAt ? 1 : 0; // parede em +x (à direita olhando para -z)
                let jump = i === 0;
                if (p.wallrun && runJumpAt !== null && ranFor >= runJumpAt && !jumpedOff) {
                  jump = true;
                  jumpedOff = true;
                }
                if (jumpedOff && !back) moveX = 0;
                if (spam && i > 0 && i % spam === 0 && !p.wallrun) jump = true;
                if (jumpedOff && !doubled && p.vel.y < 0.5 && p.vel.y > -2 && !p.wallrun) {
                  jump = true;
                  doubled = true;
                }
                const dash = dashAfter && jumpedOff && !dashed && p.vel.y < 0;
                if (dash) dashed = true;
                stepPlayer(p, { ...emptyInput(), moveZ: 1, moveX, yaw: 0, jump, jumpPressed: jump, dashPressed: dash }, map, DT, cfg);
                if (p.pos.y > best.height) best = { height: p.pos.y, how: { speed, toWallAt, runJumpAt, back, spam, dashAfter } };
                if (p.onGround && i > 10) break;
              }
            }
          }
        }
      }
    }
  }
  return best;
}
