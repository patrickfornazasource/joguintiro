// Laço do jogo com passo fixo: a lógica roda sempre em passos iguais
// (PHYSICS.FIXED_DT), não importa quantos quadros por segundo o computador desenha.
import { PHYSICS } from '../../shared/constants.js';
import { advance } from '../../shared/loop.js';

export { advance };

/**
 * Cria o laço.
 * @param {object} opts
 * @param {number} [opts.step] passo fixo (s), padrão PHYSICS.FIXED_DT
 * @param {(dt: number) => void} opts.update roda N vezes por quadro, sempre com dt = step
 * @param {(alpha: number) => void} [opts.render] roda 1 vez por quadro; alpha (0 a 1) é
 *   quanto do próximo passo já passou (para interpolação futura)
 * @param {() => number} [opts.now] relógio em ms (padrão performance.now), trocável em testes
 * @param {(cb: Function) => any} [opts.raf] agenda o próximo quadro (padrão requestAnimationFrame)
 */
export function createLoop({
  step = PHYSICS.FIXED_DT,
  update,
  render = () => {},
  now = () => performance.now(),
  raf = (cb) => requestAnimationFrame(cb),
}) {
  let acc = 0;
  let last = 0;
  let running = false;

  function frame() {
    if (!running) return;
    const t = now();
    const result = advance(acc, (t - last) / 1000, step);
    last = t;
    acc = result.acc;
    for (let i = 0; i < result.steps; i++) update(step);
    render(acc / step);
    raf(frame);
  }

  return {
    start() {
      if (running) return;
      running = true;
      acc = 0;
      last = now();
      raf(frame);
    },
    stop() {
      running = false;
    },
    get running() {
      return running;
    },
  };
}
