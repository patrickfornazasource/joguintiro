// Medida do corrimão (ajustes pedidos pelo dono): entra no trilho a uma velocidade e mede a
// velocidade ao sair (pelo fim, pulando ou agachando). Usado pelos testes e pelo relato no PR.
import { PHYSICS } from '../../shared/constants.js';
import { box, rail } from '../../shared/maps/format.js';
import { createPlayer, stepPlayer, emptyInput } from '../../shared/physics/player.js';

const DT = PHYSICS.FIXED_DT;
/** Trilho com a inclinação do da estação 9 do treino: desce 2,9 m em 24,5 m, para -z. */
export const RAIL_FROM = { x: 0, y: 3.2, z: 0 };
export const RAIL_TO = { x: 0, y: 0.3, z: -24.5 };
export const railMap = {
  id: 'trilho',
  name: 'trilho',
  spawns: [],
  boxes: [box(0, -40.5, 0, 400, 1, 400), rail(RAIL_FROM, RAIL_TO)],
};

/**
 * Entra no trilho vindo do alto, a `speed` m/s na horizontal, com um ângulo `angleDeg` em relação
 * ao trilho (0 = alinhado). Sai pelo `exit`: 'fim', 'pulo' (no meio) ou 'agachar' (no meio).
 * @returns {{ entered: boolean, onRail: number, exitH: number, exitY: number }} velocidades (m/s)
 */
export function measureRail(speed, { angleDeg = 0, exit = 'fim', cfg } = {}) {
  const a = (angleDeg * Math.PI) / 180;
  const p = createPlayer({ x: Math.sin(a) * -0.3, y: 3.4, z: 0.4 }, cfg);
  p.vel = { x: Math.sin(a) * speed, y: -1, z: -Math.cos(a) * speed };
  let entered = false;
  let onRail = 0;
  let ridden = 0;
  for (let i = 0; i < 6 / DT; i++) {
    const act = p.rail && ridden > 0.4;
    const inp = { ...emptyInput(), yaw: 0, jump: act && exit === 'pulo', jumpPressed: act && exit === 'pulo', crouch: act && exit === 'agachar', crouchPressed: act && exit === 'agachar' };
    const was = !!p.rail;
    stepPlayer(p, inp, railMap, DT, cfg);
    if (p.rail) {
      entered = true;
      ridden += DT;
      if (!was) onRail = Math.abs(p.rail.v);
    }
    if (was && !p.rail) return { entered, onRail, exitH: Math.hypot(p.vel.x, p.vel.z), exitY: p.vel.y };
  }
  return { entered, onRail, exitH: Math.hypot(p.vel.x, p.vel.z), exitY: p.vel.y };
}
