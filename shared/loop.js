// Lógica pura do laço com passo fixo (sem Three.js, sem DOM).
import { PHYSICS } from './constants.js';

/**
 * Soma o tempo de um quadro ao acumulador e diz quantos passos fixos rodar.
 * @param {number} acc tempo que sobrou do quadro anterior (s)
 * @param {number} frameDt duração do quadro atual (s)
 * @param {number} step tamanho do passo fixo (s)
 * @param {number} [maxAcc] limite do acumulador (s), evita a "espiral da morte"
 * @returns {{steps: number, acc: number}} passos a rodar e tempo que sobra
 */
export function advance(acc, frameDt, step, maxAcc = PHYSICS.MAX_ACCUMULATOR) {
  const dt = Number.isFinite(frameDt) && frameDt > 0 ? frameDt : 0;
  let total = Math.min(acc + dt, maxAcc);
  // Tolerância minúscula para erros de arredondamento (ex.: 1/60 = 2 passos de 1/120).
  const steps = Math.floor(total / step + 1e-9);
  total = Math.max(0, total - steps * step);
  return { steps, acc: total };
}
