// Corrimão deslizável (F1-17). Código puro (sem Three.js, sem DOM).
//
// Um bloco `rail` é um trilho reto entre `from` e `to` (pontos dos pés do jogador).
// Entrar: deslizando ou no ar, com os pés perto do trilho (menos de RAIL_SNAP_DIST) e
// velocidade a favor dele (acima de RAIL_MIN_SPEED). No trilho, os pés ficam presos ao
// segmento e a gravidade projetada acelera na descida (e freia na subida), até RAIL_MAX_SPEED.
// Entra com toda a velocidade horizontal (mesmo chegando em diagonal).
// Sair: fim do trilho ou um novo aperto de agachar (mantém a velocidade e a direção do trilho),
// ou pulo (sai para cima com RAIL_EXIT_UP, sem perder a velocidade horizontal).
import { MOVE } from '../constants.js';
import { BOX_TYPES as T, railSegment } from '../maps/format.js';

const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;

/** Ponto do trilho mais perto de `p` (pés). */
function closest(seg, pos) {
  const d = sub(seg.to, seg.from);
  const len = Math.hypot(d.x, d.y, d.z);
  const t = { x: d.x / len, y: d.y / len, z: d.z / len };
  const s = Math.max(0, Math.min(len, dot(sub(pos, seg.from), t)));
  const point = { x: seg.from.x + t.x * s, y: seg.from.y + t.y * s, z: seg.from.z + t.z * s };
  return { s, len, t, point, dist: Math.hypot(pos.x - point.x, pos.y - point.y, pos.z - point.z) };
}

/** Termina o trilho (lembra qual foi, para não grudar de novo na hora). */
function endRail(p, reason) {
  p.railLast = { box: p.rail.box, age: 0 };
  p.rail = null;
  p.events.push({ type: 'railEnd', reason });
}

/** Posição e velocidade no trilho a partir de s (distância desde `from`) e da velocidade com sinal. */
function placeOnRail(p) {
  const r = p.rail;
  p.pos = { x: r.from.x + r.t.x * r.s, y: r.from.y + r.t.y * r.s, z: r.from.z + r.t.z * r.s };
  p.vel = { x: r.t.x * r.v, y: r.t.y * r.v, z: r.t.z * r.v };
}

/**
 * Regras do corrimão num passo.
 * @returns {'riding'|'jumped'|'released'|null} 'riding' no trilho (a posição já foi tratada; não
 *   rodar a física normal), 'jumped' pulou para fora neste passo, 'released' soltou agachando
 *   neste passo, null fora do trilho
 */
export function updateRail(p, input, map, dt, cfg = MOVE) {
  if (p.railLast) p.railLast.age += dt;

  if (p.rail) {
    const r = p.rail;
    if (input.jumpPressed) {
      // Pulo: sai para cima com RAIL_EXIT_UP e mantém TODA a velocidade do trilho na horizontal,
      // na direção do trilho (num trilho inclinado, a parte que descia vira horizontal: o pulo
      // não corta a velocidade; pedido do dono).
      const h = Math.hypot(r.t.x, r.t.z);
      const k = h > 1e-9 ? r.v / h : 0;
      p.vel = { x: r.t.x * k, y: cfg.RAIL_EXIT_UP, z: r.t.z * k };
      p.coyote = 0;
      p.jumpBuffer = 0;
      endRail(p, 'jump');
      return 'jumped';
    }
    if (input.crouchPressed) {
      endRail(p, 'crouch'); // agachar de novo solta do trilho (cai com a velocidade que tinha)
      return 'released'; // o aperto de agachar já foi usado: não vira golpe no chão neste passo
    }
    // Gravidade projetada: acelera descendo, freia subindo (v com sinal: + em direção a `to`).
    r.v -= cfg.RAIL_GRAVITY_ACCEL * r.t.y * dt;
    r.v = Math.max(-cfg.RAIL_MAX_SPEED, Math.min(cfg.RAIL_MAX_SPEED, r.v));
    r.s += r.v * dt;
    if (r.s < 0 || r.s > r.len) {
      r.s = Math.max(0, Math.min(r.len, r.s));
      placeOnRail(p); // na ponta, com a velocidade do trilho
      endRail(p, 'end');
      return null;
    }
    placeOnRail(p);
    p.onGround = false;
    return 'riding';
  }

  // Entrar.
  if (p.dash || p.slam || p.wallrun) return null;
  if (p.onGround && !p.sliding) return null; // no chão, só deslizando
  for (const b of map?.boxes ?? []) {
    if (b.type !== T.RAIL) continue;
    if (p.railLast && p.railLast.box === b && p.railLast.age < cfg.RAIL_REATTACH_DELAY) continue;
    const seg = railSegment(b);
    const c = closest(seg, p.pos);
    if (c.dist > cfg.RAIL_SNAP_DIST) continue;
    // No ar, por baixo do trilho não gruda. Deslizando no chão, basta estar perto (trilho baixo).
    if (!p.onGround && p.pos.y < c.point.y - 0.2) continue;
    const along = dot(p.vel, c.t);
    if (Math.abs(along) < cfg.RAIL_MIN_SPEED) continue; // precisa vir a favor do trilho
    // Entra com TODA a velocidade horizontal (não só a parte a favor do trilho): chegar em
    // diagonal não perde velocidade, só muda de direção (pedido do dono). O sentido é o de `along`.
    const entry = Math.max(Math.abs(along), Math.hypot(p.vel.x, p.vel.z));
    if (p.sliding) {
      p.sliding = false;
      p.events.push({ type: 'slideEnd' });
    }
    p.rail = { box: b, from: seg.from, t: c.t, len: c.len, s: c.s, v: Math.min(entry, cfg.RAIL_MAX_SPEED) * Math.sign(along) };
    placeOnRail(p);
    p.onGround = false;
    p.events.push({ type: 'railStart' });
    return 'riding';
  }
  return null;
}
