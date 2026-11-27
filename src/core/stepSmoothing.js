// Suavização da câmera ao subir degraus.
// A física coloca o jogador em cima do degrau de uma vez (salto seco). Só a imagem
// é suavizada: a câmera começa na altura antiga e alcança a nova em pouco tempo.
// Sem DOM e sem Three.js: testável no Node. Usado pela câmera em primeira pessoa (F1-05).
import { MOVE } from '../../shared/constants.js';

/**
 * Cria o suavizador.
 * @param {number} [rate] rapidez (1/s), padrão MOVE.STEP_SMOOTH_RATE
 * @param {number} [maxStep] maior subida tratada como degrau (m), padrão MOVE.STEP_HEIGHT
 */
export function createStepSmoother(rate = MOVE.STEP_SMOOTH_RATE, maxStep = MOVE.STEP_HEIGHT) {
  let lastY = null;
  let offset = 0; // quanto a imagem está abaixo da física (m, negativo)

  return {
    /**
     * Altura dos pés para desenhar neste quadro.
     * @param {number} feetY altura dos pés na física (m)
     * @param {boolean} onGround o jogador está no chão
     * @param {number} dt tempo desde o último quadro (s)
     */
    update(feetY, onGround, dt) {
      if (lastY !== null) {
        const rise = feetY - lastY;
        // Subida instantânea no chão do tamanho de um degrau: esconder o salto.
        if (onGround && rise > 0 && rise <= maxStep + 1e-6) offset -= rise;
      }
      lastY = feetY;
      offset *= Math.exp(-rate * Math.max(0, dt));
      if (Math.abs(offset) < 1e-4) offset = 0;
      return feetY + offset;
    },
    /** Esquece o histórico (ex.: ao renascer). */
    reset() {
      lastY = null;
      offset = 0;
    },
  };
}
