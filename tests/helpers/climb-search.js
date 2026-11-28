// Busca de "escalada": até que altura os pés chegam junto de paredes muito altas, combinando
// corrida na parede, pulo da corrida, pulo duplo, pulos na parede e dash, com o mouse girando
// e o Espaço em ritmos variados. Usado pelos testes e para relatar números (não é código do jogo).
//
// Por que poços e cantos sobem mais: cada corrida numa parede NOVA (ainda não usada no voo)
// recarrega o pulo duplo e os pulos na parede. Com 2 ou mais paredes por perto, o jogador
// encadeia recargas. Com a corrida em todas as paredes (pedido do dono), isso vale também para
// paredes cinza.
import { PHYSICS, PLAYER } from '../../shared/constants.js';
import { box, BOX_TYPES as T } from '../../shared/maps/format.js';
import { createPlayer, stepPlayer, emptyInput } from '../../shared/physics/player.js';

const DT = PHYSICS.FIXED_DT;
const TOP = 80; // paredes bem altas: o que limita é o movimento, não o topo
const LEN = 20; // comprimento das paredes (m)
const THICK = 0.5;

/** Parede vertical: ao longo de z (em x fixo) ou ao longo de x (em z fixo), do chão até TOP. */
const wallZ = (x, z0, z1, type) => box(x, TOP / 2, (z0 + z1) / 2, THICK, TOP, z1 - z0, type);
const wallX = (z, x0, x1, type) => box((x0 + x1) / 2, TOP / 2, z, x1 - x0, TOP, THICK, type);

/**
 * Formas de parede. Cada uma tem o mapa e uma área de partida (dentro do poço, junto da parede...).
 * Poço de largura w: duas paredes paralelas (faces em x = -w/2 e x = +w/2), ao longo de z.
 */
export function climbShapes(type = T.SOLID) {
  const floor = box(0, -0.5, 0, 400, 1, 400);
  const map = (id, ...walls) => ({ id, name: id, spawns: [], boxes: [floor, ...walls] });
  const shaft = (w) => [wallZ(w / 2 + THICK / 2, -LEN / 2, LEN / 2, type), wallZ(-w / 2 - THICK / 2, -LEN / 2, LEN / 2, type)];
  const out = {
    isolada: { map: map('isolada', wallZ(THICK / 2, -LEN / 2, LEN / 2, type)), area: { x0: -3, x1: -0.4, z0: -8, z1: 8 } },
    canto: {
      map: map('canto', wallZ(THICK / 2, -LEN / 2, LEN / 2, type), wallX(-LEN / 2 - THICK / 2, -LEN, THICK, type)),
      area: { x0: -6, x1: -0.4, z0: -9.5, z1: 4 },
    },
  };
  for (const w of [1.5, 2, 3, 4]) {
    out[`poco ${w} m`] = { map: map(`poco${w}`, ...shaft(w)), area: { x0: -w / 2 + 0.36, x1: w / 2 - 0.36, z0: -8, z1: 8 } };
  }
  // U: poço de 3 m fechado num dos lados; quatro paredes: caixa de 4 x 8 m.
  out.U = { map: map('U', ...shaft(3), wallX(-LEN / 2 - THICK / 2, -2, 2, type)), area: { x0: -1.1, x1: 1.1, z0: -9.5, z1: 8 } };
  out['quatro paredes'] = {
    map: map('quatro', wallZ(2 + THICK / 2, -4, 4, type), wallZ(-2 - THICK / 2, -4, 4, type), wallX(-4 - THICK / 2, -2.5, 2.5, type), wallX(4 + THICK / 2, -2.5, 2.5, type)),
    area: { x0: -1.6, x1: 1.6, z0: -3.6, z1: 3.6 },
  };
  return out;
}

/** Gerador de números pseudoaleatórios com semente (busca repetível). */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Tenta subir `tries` vezes com roteiros sorteados. Cada roteiro: ponto e velocidade de partida,
 * giro do mouse (constante, vai e volta ou virando de lado de tempos em tempos), teclas de
 * direção trocando, Espaço num ritmo (ou só quando encosta / no alto do pulo) e dash às vezes.
 * @param {object} [opts] tries, seconds, seed, cfg; startY (altura de partida); limit (|x| ou |z|
 *   acima disto = saiu do mapa, para usar em mapas de verdade)
 * @returns {{ height: number, tries: number, escapes: number }} maior altura dos pés (m)
 */
export function searchClimb(shape, { tries = 400, seconds = 5, seed = 1, cfg, startY = 0, limit = Infinity } = {}) {
  const rand = rng(seed);
  const { map, area } = shape;
  let best = 0;
  let escapes = 0; // vezes que passou de |x| ou |z| > limit (saiu do mapa)
  for (let k = 0; k < tries; k++) {
    const yaw0 = rand() * Math.PI * 2;
    const p = createPlayer({ x: area.x0 + (area.x1 - area.x0) * rand(), y: startY, z: area.z0 + (area.z1 - area.z0) * rand(), yaw: yaw0 }, cfg);
    const speed = rand() * 20;
    const dir = rand() * Math.PI * 2;
    p.vel = { x: Math.cos(dir) * speed, y: 0, z: Math.sin(dir) * speed };
    const spin = (rand() - 0.5) * 8; // rad/s
    const flipEvery = 10 + Math.floor(rand() * 60); // passos entre viradas de olhar/teclas
    const jumpMode = Math.floor(rand() * 3); // 0 = ritmo fixo, 1 = ao encostar, 2 = no alto do pulo
    const jumpEvery = 4 + Math.floor(rand() * 30);
    const dashChance = rand() * 0.02;
    let yaw = yaw0;
    let moveX = rand() < 0.5 ? -1 : 1;
    let moveZ = rand() < 0.8 ? 1 : 0;
    for (let i = 0; i < seconds / DT; i++) {
      yaw += spin * DT;
      if (i % flipEvery === 0 && i > 0) {
        if (rand() < 0.5) moveX = -moveX;
        if (rand() < 0.3) yaw += (rand() < 0.5 ? 1 : -1) * Math.PI / 2;
        moveZ = rand() < 0.85 ? 1 : 0;
      }
      let jump = i === 0;
      if (jumpMode === 0) jump ||= i % jumpEvery === 0;
      else if (jumpMode === 1) jump ||= (p.wall !== null || p.wallrun !== null) && i % 6 === 0;
      else jump ||= !p.onGround && Math.abs(p.vel.y) < 1.2 && i % 3 === 0;
      if (p.wallrun && rand() < 0.03) jump = true; // sai da corrida em momentos variados
      const dash = rand() < dashChance;
      stepPlayer(p, { ...emptyInput(), moveX, moveZ, yaw, jump, jumpPressed: jump, dashPressed: dash }, map, DT, cfg);
      if (p.pos.y > best) best = p.pos.y;
      if (p.pos.y < -PLAYER.RESPAWN_FALL_DEPTH) break; // no jogo, renasce na estação
      if (Math.abs(p.pos.x) > limit || Math.abs(p.pos.z) > limit) {
        escapes++;
        if (!shape.escapeLog) shape.escapeLog = [];
        if (shape.escapeLog.length < 3) shape.escapeLog.push({ k, i, at: { ...p.pos }, best });
        break;
      }
      if (p.onGround && i > 30 && p.pos.y < 0.01 && rand() < 0.002) break;
    }
  }
  return { height: best, tries, escapes };
}
