import * as P from '../shared/physics/player.js';
import * as C from '../shared/constants.js';
import { sandbox } from '../shared/maps/sandbox.js';
const DT = C.PHYSICS.FIXED_DT; const I = (o = {}) => ({ ...P.emptyInput(), ...o });
const run = (name, x, jumpAt, side) => {
  const p = P.createPlayer({ x, y: 1.5, z: 12.6, yaw: 0 }); P.stepPlayer(p, I(), sandbox, DT);
  const log = [];
  for (let i = 0; i < 4 / DT; i++) {
    const base = { moveZ: 1, yaw: 0, moveX: i >= side ? -1 : 0 };
    const inp = i === jumpAt ? I({ ...base, jump: true, jumpPressed: true }) : I(base);
    P.stepPlayer(p, inp, sandbox, DT);
    for (const e of p.events) if (e.type.startsWith('rail')) log.push(`${e.type}${e.reason ? '(' + e.reason + ')' : ''} z=${p.pos.z.toFixed(1)} y=${p.pos.y.toFixed(2)} v=${Math.hypot(p.vel.x, p.vel.y, p.vel.z).toFixed(1)}`);
    if (p.events.some(e => e.type === 'railEnd')) break;
  }
  console.log(name, log.join(' | ') || 'não entrou');
};
run('andando pela borda e saindo para a esquerda:', -7.6, -1, 15);
run('pulando de lado:', -7.4, 10, 10);
run('do meio do patamar, pulando de lado:', -6, 5, 5);
