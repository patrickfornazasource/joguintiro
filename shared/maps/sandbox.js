// Mapa de testes da Fase 1: chão 60x60 m, paredes em volta, alguns blocos,
// uma escada simples e exemplos de cada tipo de bloco.
// Medidas em metros. O topo do chão fica em y = 0.
import { box, rail, BOX_TYPES as T } from './format.js';

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

/**
 * Plataforma de salto direcional e o alvo dela (F1-16), no lado leste perto de quem nasce.
 * `launch` é a velocidade de saída (m/s): dado do mapa, ajustado para pousar no alvo.
 */
export const PAD_TO_HIGH = Object.freeze({
  pad: { x: 8, z: 22 },
  launch: Object.freeze({ x: 20.7, y: 17, z: 0 }),
  target: { x: 25, z: 21, width: 6, depth: 8, top: 6 }, // plataforma alta: x de 22 a 28, z de 17 a 25
});

/**
 * Corrimão ao lado da escada simples (F1-17). Pontos dos pés: desce do alto (perto do fundo do
 * patamar, z = 12,5, 0,2 m acima dele) até perto do chão (z = 5), encostado por fora da borda
 * oeste do patamar (o corpo de quem desliza não encosta no patamar nem na escada).
 */
export const STAIR_RAIL = Object.freeze({
  from: Object.freeze({ x: -8.4, y: 1.7, z: 12.5 }),
  to: Object.freeze({ x: -8.4, y: 0.3, z: 5 }),
});

/** Altura das paredes externas do Sandbox (m). Ver o comentário nas paredes. */
export const OUTER_WALL_HEIGHT = 20;

export const sandbox = Object.freeze({
  id: 'sandbox',
  name: 'Sandbox (cinza)',
  boxes: [
    // Chão 60x60
    box(0, -0.5, 0, 60, 1, 60),
    // Paredes externas, 20 m de altura. Histórico: 6 m deixava sair do mapa (plataforma de salto e
    // plataforma alta de 6 m, mais escalada); na F1-16 subiram para 16 m. Com a corrida em todas
    // as paredes (pedido do dono), cada parede nova recarrega pulos: canto ou poço sobe até ~11 m
    // e a altura máxima no Sandbox foi a ~15,6 m. Por isso, 20 m (folga de segurança).
    // Ver a lição da escalada na seção F6 do docs/ROADMAP.md.
    box(0, OUTER_WALL_HEIGHT / 2, -29.5, 60, OUTER_WALL_HEIGHT, 1),
    box(0, OUTER_WALL_HEIGHT / 2, 29.5, 60, OUTER_WALL_HEIGHT, 1),
    box(-29.5, OUTER_WALL_HEIGHT / 2, 0, 1, OUTER_WALL_HEIGHT, 60),
    box(29.5, OUTER_WALL_HEIGHT / 2, 0, 1, OUTER_WALL_HEIGHT, 60),
    // Blocos soltos
    box(-8, 0.5, -6, 2, 1, 2),
    box(-12, 1, -10, 4, 2, 4),
    box(6, 1.5, -12, 3, 3, 3),
    box(14, 0.5, 8, 2, 1, 2),
    // Corredor de paredes de corrida
    box(18, 2.5, -4, 0.5, 5, 16, T.WALLRUN),
    box(22, 2.5, -4, 0.5, 5, 16, T.WALLRUN),
    // Plataforma de salto vertical (sem direção: só para cima)
    box(-16, 0.1, 12, 3, 0.2, 3, T.PAD),
    // Plataforma de salto direcional (F1-16): lança para +x até a plataforma alta (topo a 6 m)
    box(PAD_TO_HIGH.pad.x, 0.1, PAD_TO_HIGH.pad.z, 3, 0.2, 3, T.PAD, { launch: PAD_TO_HIGH.launch }),
    box(PAD_TO_HIGH.target.x, PAD_TO_HIGH.target.top / 2, PAD_TO_HIGH.target.z, PAD_TO_HIGH.target.width, PAD_TO_HIGH.target.top, PAD_TO_HIGH.target.depth),
    // Corrimão
    box(0, 1, -18, 10, 0.15, 0.15, T.RAIL),
    // Escada simples com patamar
    ...stairs(-6, 6, 3),
    // Corrimão da escada (F1-17): do alto do patamar até perto do chão, no lado oeste da escada
    rail(STAIR_RAIL.from, STAIR_RAIL.to),
    // Corredor de corrida na parede com "fosso" (F1-12)
    ...wallrunCorridor(),
  ],
  spawns: [
    { x: 0, y: 0, z: 20, yaw: 0 },
    { x: -14, y: 0, z: -20, yaw: -0.75 * Math.PI }, // era x = -20 (dentro do corredor da F1-12)
    { x: 20, y: 0, z: 20, yaw: 0.25 * Math.PI },
  ],
});
