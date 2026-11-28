// Armas (F2-02: Rifle Cinético). Código puro (sem Three.js, sem DOM): o servidor da F3 e da F8
// roda o mesmo código.
//
// GDD seção 3: atirar gasta Carga; o dano escala com a velocidade no momento do disparo; todo
// disparo empurra o jogador na direção oposta à mira. Seção 6, Rifle: tiro instantâneo e
// preciso, custo baixo, dano médio que escala forte com a velocidade, coice pequeno.
//
// Coice: por enquanto só a parte HORIZONTAL (WEAPONS.RECOIL_VERTICAL_SCALE = 0), até a decisão
// do dono sobre o limite vertical de impulsos de arma (dúvida 14 das fichas da F2).
import { WEAPONS, MOVE } from '../constants.js';
import { spendCharge } from './charge.js';
import { castRay } from './hitscan.js';
import { capHorizontalSpeed } from '../physics/player.js';

/**
 * Multiplicador do dano pela velocidade horizontal: 1 até a velocidade de andar, sobe em linha
 * reta até `multMax` em WEAPONS.DAMAGE_SPEED_FULL e fica travado em `multMax` acima disso.
 * O HUD (F2-04) usa a mesma função para mostrar o "dano do próximo tiro".
 * @param {number} speed velocidade horizontal (m/s)
 * @param {number} multMax máximo da arma (ex.: WEAPONS.RIFLE_SPEED_MULT_MAX)
 */
export function speedDamageMultiplier(speed, multMax, cfg = WEAPONS, move = MOVE) {
  const span = cfg.DAMAGE_SPEED_FULL - move.WALK_SPEED;
  if (!(span > 0)) return speed > move.WALK_SPEED ? multMax : 1;
  const k = Math.max(0, Math.min(1, (speed - move.WALK_SPEED) / span));
  return 1 + (multMax - 1) * k;
}

/** Dano do Rifle numa velocidade horizontal (pontos de vida). */
export function rifleDamage(speed, cfg = WEAPONS, move = MOVE) {
  return cfg.RIFLE_DAMAGE * speedDamageMultiplier(speed, cfg.RIFLE_SPEED_MULT_MAX, cfg, move);
}

/** Estado da arma de um jogador: qual arma e o tempo até poder atirar de novo (s). */
export function createWeapon(id = 'rifle') {
  return { id, cooldown: 0 };
}

/** Avança os relógios da arma um passo. */
export function stepWeapon(weapon, dt) {
  weapon.cooldown = Math.max(0, weapon.cooldown - dt);
}

/** Direção da mira (comprimento 1) a partir do olhar: yaw 0 = -z, pitch + = para cima. */
export function aimDir(yaw, pitch) {
  const c = Math.cos(pitch);
  return { x: -Math.sin(yaw) * c, y: Math.sin(pitch), z: -Math.cos(yaw) * c };
}

/**
 * Coice: soma `amount` m/s na direção oposta à mira. A parte vertical é multiplicada por
 * RECOIL_VERTICAL_SCALE (hoje 0). Respeita o limite de velocidade horizontal (MOVE.MAX_SPEED).
 */
export function applyRecoil(player, dir, amount, cfg = WEAPONS, move = MOVE) {
  player.vel.x -= dir.x * amount;
  player.vel.z -= dir.z * amount;
  player.vel.y -= dir.y * amount * cfg.RECOIL_VERTICAL_SCALE;
  capHorizontalSpeed(player, move);
}

/**
 * Dispara o Rifle (se der). Gasta a Carga, acha o primeiro acerto, aplica o dano e o coice.
 * Põe um evento em `shooter.player.events`: 'shot' (com o resultado) ou 'dryFire' (sem Carga).
 * @param {{ player: object, charge: { value: number }, weapon: { cooldown: number } }} shooter
 * @param {{ origin: {x,y,z}, dir: {x,y,z} }} aim
 * @param {{ map?: object, targets?: Array }} world
 * @returns {{ fired: boolean, reason?: 'cooldown'|'noCharge', hit?: string, damage?: number,
 *   point?: {x,y,z}, target?: object }}
 */
export function fireRifle(shooter, aim, world = {}, cfg = WEAPONS, move = MOVE) {
  const { player, charge, weapon } = shooter;
  if (weapon.cooldown > 1e-9) return { fired: false, reason: 'cooldown' };
  if (!spendCharge(charge, cfg.RIFLE_COST)) {
    player.events.push({ type: 'dryFire', weapon: 'rifle' });
    return { fired: false, reason: 'noCharge' };
  }
  weapon.cooldown = cfg.RIFLE_FIRE_INTERVAL;
  const speed = Math.hypot(player.vel.x, player.vel.z); // velocidade no momento do disparo
  const damage = rifleDamage(speed, cfg, move);
  const hit = castRay(aim.origin, aim.dir, cfg.RIFLE_RANGE, { ...world, ignore: player });
  if (hit.kind === 'target' && typeof hit.target.health === 'number') {
    hit.target.health = Math.max(0, hit.target.health - damage);
  }
  applyRecoil(player, aim.dir, cfg.RIFLE_RECOIL, cfg, move);
  const result = { fired: true, hit: hit.kind, damage, point: hit.point, target: hit.target, speed };
  player.events.push({ type: 'shot', weapon: 'rifle', origin: { ...aim.origin }, dir: { ...aim.dir }, point: hit.point, hit: hit.kind, damage });
  return result;
}

/**
 * Dispara a arma atual de quem atira. Hoje só o Rifle; o Spray (F2-06) e a Lata (F2-07) entram
 * aqui, cada um com a sua regra.
 */
export function fireWeapon(shooter, aim, world = {}, cfg = WEAPONS, move = MOVE) {
  switch (shooter.weapon.id) {
    case 'rifle':
      return fireRifle(shooter, aim, world, cfg, move);
    default:
      throw new Error(`Arma desconhecida: ${shooter.weapon.id}`);
  }
}
