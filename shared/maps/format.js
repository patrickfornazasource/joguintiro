// Formato de mapa: caixas alinhadas aos eixos (AABB) e pontos de nascimento.
// Código puro (sem Three.js, sem DOM): usado pelo cliente, pelo servidor e pelos testes.
//
// Mapa: { id, name, boxes: [{ min:{x,y,z}, max:{x,y,z}, type, ...extra }], spawns: [{ x, y, z, yaw }] }
// Unidades: metros. y é a altura. yaw em radianos (0 = olhando para -z).
import { PHYSICS, PLAYER } from '../constants.js';

/** Tipos de bloco conhecidos. */
export const BOX_TYPES = Object.freeze({
  /** Bloco comum (chão, parede, obstáculo). */
  SOLID: 'solid',
  /** Parede de corrida: marcação visível na borda. */
  WALLRUN: 'wallrun',
  /** Plataforma de salto. */
  PAD: 'pad',
  /** Corrimão deslizável. */
  RAIL: 'rail',
  /** Tinta UV (reservado para a Fase 4). */
  UV: 'uv',
});

const KNOWN_TYPES = new Set(Object.values(BOX_TYPES));

/**
 * Cria uma caixa pelo centro e pelo tamanho.
 * @param {number} cx centro x (m)
 * @param {number} cy centro y (m)
 * @param {number} cz centro z (m)
 * @param {number} sx largura em x (m)
 * @param {number} sy altura em y (m)
 * @param {number} sz profundidade em z (m)
 * @param {string} [type] um de BOX_TYPES
 * @param {object} [extra] dados extras do bloco (ex.: força de uma plataforma)
 */
export function box(cx, cy, cz, sx, sy, sz, type = BOX_TYPES.SOLID, extra = {}) {
  return {
    ...extra,
    min: { x: cx - sx / 2, y: cy - sy / 2, z: cz - sz / 2 },
    max: { x: cx + sx / 2, y: cy + sy / 2, z: cz + sz / 2 },
    type,
  };
}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isVec = (v) => v && isNum(v.x) && isNum(v.y) && isNum(v.z);

/**
 * O corpo do jogador nascendo neste ponto (pés em s) invade a caixa?
 * Usa o tamanho do jogador; só encostar (até CONTACT_EPSILON) não conta.
 */
function inside(s, b) {
  const r = PLAYER.RADIUS;
  const e = PHYSICS.CONTACT_EPSILON;
  return s.x - r < b.max.x - e && s.x + r > b.min.x + e
    && s.y < b.max.y - e && s.y + PLAYER.HEIGHT > b.min.y + e
    && s.z - r < b.max.z - e && s.z + r > b.min.z + e;
}

/**
 * Confere se um mapa está bem formado.
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateMap(map) {
  const errors = [];
  if (!map || typeof map !== 'object') return { ok: false, errors: ['mapa ausente'] };
  if (typeof map.id !== 'string' || !map.id) errors.push('id ausente');
  if (typeof map.name !== 'string' || !map.name) errors.push('name ausente');

  if (!Array.isArray(map.boxes) || map.boxes.length === 0) {
    errors.push('boxes vazio');
  } else {
    map.boxes.forEach((b, i) => {
      if (!b || !isVec(b.min) || !isVec(b.max)) {
        errors.push(`caixa ${i}: min/max inválidos`);
        return;
      }
      for (const axis of ['x', 'y', 'z']) {
        if (!(b.min[axis] < b.max[axis])) errors.push(`caixa ${i}: invertida ou vazia no eixo ${axis}`);
      }
      if (!KNOWN_TYPES.has(b.type)) errors.push(`caixa ${i}: tipo desconhecido "${b.type}"`);
    });
  }

  if (!Array.isArray(map.spawns) || map.spawns.length === 0) {
    errors.push('nenhum ponto de nascimento');
  } else {
    map.spawns.forEach((s, i) => {
      if (!isVec(s) || !isNum(s.yaw)) {
        errors.push(`nascimento ${i}: x, y, z ou yaw inválidos`);
        return;
      }
      if (Array.isArray(map.boxes)) {
        const hit = map.boxes.findIndex((b) => b && isVec(b.min) && isVec(b.max) && inside(s, b));
        if (hit >= 0) errors.push(`nascimento ${i}: dentro da caixa ${hit}`);
      }
    });
  }

  return { ok: errors.length === 0, errors };
}
