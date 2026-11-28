// HUD (F1-18): velocímetro grande no canto inferior direito, em m/s.
// A cor muda acima de 15 m/s e acima de 25 m/s (constantes em src/config/camera.js).
import { HUD } from '../config/camera.js';
import { speedTier } from '../player/localPlayer.js';

/**
 * Cria o velocímetro.
 * @param {{ doc?: Document }} [opts]
 */
export function createHud({ doc = document } = {}) {
  const el = doc.createElement('div');
  el.id = 'hud-speed';
  Object.assign(el.style, {
    position: 'fixed',
    right: '28px',
    bottom: '20px',
    font: '700 56px/1 ui-monospace, Consolas, monospace',
    color: HUD.SPEED_COLORS[0],
    textShadow: '0 0 8px rgba(0, 0, 0, 0.8)',
    pointerEvents: 'none',
    zIndex: '4',
    textAlign: 'right',
  });
  const value = doc.createElement('span');
  value.textContent = '0';
  const unit = doc.createElement('span');
  unit.textContent = ' m/s';
  Object.assign(unit.style, { fontSize: '20px', fontWeight: '400', opacity: '0.8' });
  el.append(value, unit);
  doc.body.appendChild(el);

  let lastText = '0';
  let lastTier = 0;
  return {
    el,
    /** Atualiza com a velocidade horizontal (m/s). */
    update(speed) {
      const text = String(Math.round(speed));
      if (text !== lastText) {
        value.textContent = text;
        lastText = text;
      }
      const tier = speedTier(speed);
      if (tier !== lastTier) {
        el.style.color = HUD.SPEED_COLORS[tier];
        lastTier = tier;
      }
    },
    get text() {
      return lastText;
    },
    get tier() {
      return lastTier;
    },
  };
}
