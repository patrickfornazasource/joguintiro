// Suavização da câmera ao subir degraus.
// A física coloca o jogador em cima do degrau de uma vez (salto seco). Só a imagem
// é suavizada: a câmera começa na altura antiga e alcança a nova em pouco tempo.
// Sem DOM e sem Three.js: testável no Node. Usado pela câmera em primeira pessoa (F1-05).
import { MOVE } from '../../shared/constants.js';

/**
 * Cria o suavizador.
 * @param {number|object} [rate] rapidez (1/s), padrão MOVE.STEP_SMOOTH_RATE. Também aceita um
 *   objeto de números do movimento (ex.: o do painel de ajuste, F1-20): aí lê STEP_SMOOTH_RATE e
 *   STEP_HEIGHT dele a cada quadro, e um ajuste ao vivo vale na hora.
 * @param {number} [maxStep] maior subida tratada como degrau (m), padrão MOVE.STEP_HEIGHT
 */
export function createStepSmoother(rate = MOVE.STEP_SMOOTH_RATE, maxStep = MOVE.STEP_HEIGHT) {
  const cfg = typeof rate === 'object' && rate !== null ? rate : null;
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
      const r = cfg ? cfg.STEP_SMOOTH_RATE : rate;
      const most = cfg ? cfg.STEP_HEIGHT : maxStep;
      if (lastY !== null) {
        const rise = feetY - lastY;
        // Subida instantânea no chão do tamanho de um degrau: esconder o salto.
        if (onGround && rise > 0 && rise <= most + 1e-6) offset -= rise;
      }
      lastY = feetY;
      offset *= Math.exp(-r * Math.max(0, dt));
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
