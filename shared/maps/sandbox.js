// Mapa de testes da Fase 1: chão 60x60 m, paredes em volta, alguns blocos,
// uma escada simples e exemplos de cada tipo de bloco.
// Medidas em metros. O topo do chão fica em y = 0.
import { box, BOX_TYPES as T } from './format.js';

const STEP_RISE = 0.25; // altura de cada degrau (m)
const STEP_DEPTH = 0.5; // profundidade de cada degrau (m)
const STEP_COUNT = 6;

/** Escada subindo em +z a partir de (x, z0), com largura w, terminando num patamar. */
function stairs(x, z0, w) {
  const steps = [];
  for (let i = 0; i < STEP_COUNT; i++) {
    const h = STEP_RISE * (i + 1);
    steps.push(box(x, h / 2, z0 + STEP_DEPTH * i + STEP_DEPTH / 2, w, h, STEP_DEPTH));
  }
  const top = STEP_RISE * STEP_COUNT;
  const zEnd = z0 + STEP_DEPTH * STEP_COUNT;
  steps.push(box(x, top / 2, zEnd + 2, 4, top, 4)); // patamar 4x4 m
  return steps;
}

/**
 * Corredor de corrida na parede (F1-12), no lado oeste do mapa, indo para -z.
 * Plataforma de partida (topo a 3 m, z de 2 a 8) com escada de acesso, quatro paredes
 * `wallrun` de 8 m alternadas (esquerda, direita, esquerda, direita) e plataforma de
 * chegada. O "fosso" é o chão, 3 m abaixo: atravessar sem tocá-lo.
 */
export const WALLRUN_CORRIDOR = Object.freeze({
  x: -22, // centro do corredor
  leftFace: -24, // face das paredes da esquerda (para quem vai para -z)
  rightFace: -20, // face das paredes da direita
  height: 3, // topo das plataformas
  start: { x: -23, z: 6 }, // ponto de partida sugerido, em cima da plataforma
  walls: [
    { side: 'left', z: -2 },
    { side: 'right', z: -8 },
    { side: 'left', z: -14 },
    { side: 'right', z: -20 },
  ],
  wallLength: 8,
  endZ: -24, // a plataforma de chegada começa aqui (vai até -29)
});

function wallrunCorridor() {
  const c = WALLRUN_CORRIDOR;
  const out = [];
  // Escada de acesso: sobe em -z, de z = 14 até a plataforma (12 degraus de 0,25 m).
  const steps = c.height / STEP_RISE;
  for (let i = 0; i < steps; i++) {
    const h = STEP_RISE * (i + 1);
    out.push(box(c.x, h / 2, 14 - STEP_DEPTH * i - STEP_DEPTH / 2, 3, h, STEP_DEPTH));
  }
  out.push(box(c.x, c.height / 2, 5, 4, c.height, 6)); // plataforma de partida (z de 2 a 8)
  for (const w of c.walls) {
    const x = w.side === 'left' ? c.leftFace - 0.25 : c.rightFace + 0.25;
    out.push(box(x, 4.5, w.z, 0.5, 9, c.wallLength, T.WALLRUN));
  }
  out.push(box(c.x, c.height / 2, -26.5, 4, c.height, 5)); // plataforma de chegada (z de -24 a -29)
  return out;
}

export const sandbox = Object.freeze({
  id: 'sandbox',
  name: 'Sandbox (cinza)',
  boxes: [
    // Chão 60x60
    box(0, -0.5, 0, 60, 1, 60),
    // Paredes externas (6 m de altura)
    box(0, 3, -29.5, 60, 6, 1),
    box(0, 3, 29.5, 60, 6, 1),
    box(-29.5, 3, 0, 1, 6, 60),
    box(29.5, 3, 0, 1, 6, 60),
    // Blocos soltos
    box(-8, 0.5, -6, 2, 1, 2),
    box(-12, 1, -10, 4, 2, 4),
    box(6, 1.5, -12, 3, 3, 3),
    box(14, 0.5, 8, 2, 1, 2),
    // Corredor de paredes de corrida
    box(18, 2.5, -4, 0.5, 5, 16, T.WALLRUN),
    box(22, 2.5, -4, 0.5, 5, 16, T.WALLRUN),
    // Plataforma de salto
    box(-16, 0.1, 12, 3, 0.2, 3, T.PAD),
    // Corrimão
    box(0, 1, -18, 10, 0.15, 0.15, T.RAIL),
    // Escada simples com patamar
    ...stairs(-6, 6, 3),
    // Corredor de corrida na parede com "fosso" (F1-12)
    ...wallrunCorridor(),
  ],
  spawns: [
    { x: 0, y: 0, z: 20, yaw: 0 },
    { x: -14, y: 0, z: -20, yaw: -0.75 * Math.PI }, // era x = -20 (dentro do corredor da F1-12)
    { x: 20, y: 0, z: 20, yaw: 0.25 * Math.PI },
  ],
});
