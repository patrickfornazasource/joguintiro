// Dash (F1-15, provisório). Código puro (sem Three.js, sem DOM).
//
// Arranco curto e seco na horizontal: durante `time` segundos a velocidade horizontal fica
// fixa na direção do dash e não há gravidade. No fim, mantém a maior entre a velocidade de
// antes e MOVE.DASH_END_SPEED_KEEP x velocidade do dash.
// Por enquanto usa cargas que recarregam com o tempo; na F2-12 o dash vira um disparo da
// arma que gasta Carga e reaproveita startDash.
import { MOVE } from '../constants.js';

/**
 * Começa um dash (não confere nem gasta cargas: quem chama decide; ver tryDash).
 * @param {object} p jogador
 * @param {{x,y,z}} dir direção no plano, comprimento 1
 * @param {number} speed velocidade horizontal durante o dash (m/s)
 * @param {number} time duração (s)
 */
export function startDash(p, dir, speed, time) {
  p.dash = {
    dir: { x: dir.x, y: 0, z: dir.z },
    speed,
    remaining: time,
    before: Math.hypot(p.vel.x, p.vel.z), // velocidade horizontal antes do dash
  };
  p.events.push({ type: 'dash', dir: { ...p.dash.dir } });
}

/**
 * Avança o dash um passo. Durante o dash, fixa a velocidade (horizontal na direção, vertical 0).
 * No passo em que o tempo acaba, aplica a velocidade de saída e termina.
 * @returns {boolean} true se o dash cuidou da velocidade neste passo
 */
export function stepDash(p, dt, cfg = MOVE) {
  const d = p.dash;
  if (!d) return false;
  if (d.remaining <= 1e-9) {
    const keep = Math.max(d.before, d.speed * cfg.DASH_END_SPEED_KEEP);
    p.vel.x = d.dir.x * keep;
    p.vel.z = d.dir.z * keep;
    p.dash = null;
    return false;
  }
  p.vel.x = d.dir.x * d.speed;
  p.vel.z = d.dir.z * d.speed;
  p.vel.y = 0;
  d.remaining -= dt;
  return true;
}

/** Recarrega uma carga a cada MOVE.DASH_RECHARGE segundos, até MOVE.DASH_CHARGES. */
export function rechargeDash(p, dt, cfg = MOVE) {
  if (p.dashCharges >= cfg.DASH_CHARGES) {
    p.dashRecharge = 0;
    return;
  }
  p.dashRecharge += dt;
  if (p.dashRecharge >= cfg.DASH_RECHARGE - 1e-9) {
    p.dashCharges += 1;
    p.dashRecharge -= cfg.DASH_RECHARGE;
  }
}
