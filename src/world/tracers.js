// Traço do tiro (F2-02): uma linha do cano até onde o tiro bateu, que some rápido.
// Só visual. Os números visuais ficam aqui (não são balanceamento).
import * as THREE from 'three';

/** Quanto tempo o traço fica na tela (s). */
const TRACER_TIME = 0.12;
/** Deslocamento do início do traço em relação ao olho (m): um pouco abaixo e à direita, como um cano. */
const MUZZLE_DOWN = 0.18;
const MUZZLE_RIGHT = 0.22;

/** Cor do traço por arma. */
const COLORS = { rifle: 0x00e5ff };

export function createTracers(scene) {
  const live = [];
  return {
    /**
     * Acrescenta um traço.
     * @param {{x,y,z}} origin olho de quem atirou
     * @param {{x,y,z}} dir direção do tiro
     * @param {{x,y,z}} point onde bateu (ou o fim do alcance)
     * @param {string} [weapon]
     */
    add(origin, dir, point, weapon = 'rifle') {
      // Direita no plano, a partir da direção do tiro.
      const h = Math.hypot(dir.x, dir.z) || 1;
      const right = { x: -dir.z / h, z: dir.x / h };
      const start = new THREE.Vector3(origin.x + right.x * MUZZLE_RIGHT, origin.y - MUZZLE_DOWN, origin.z + right.z * MUZZLE_RIGHT);
      const end = new THREE.Vector3(point.x, point.y, point.z);
      const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
      const material = new THREE.LineBasicMaterial({ color: COLORS[weapon] ?? 0xffffff, transparent: true, opacity: 1 });
      const line = new THREE.Line(geometry, material);
      scene.add(line);
      live.push({ line, time: TRACER_TIME });
    },
    /** Some aos poucos; tira da cena ao acabar. Chamar a cada quadro. */
    update(frameDt) {
      for (let i = live.length - 1; i >= 0; i--) {
        const t = live[i];
        t.time -= Math.max(0, frameDt);
        t.line.material.opacity = Math.max(0, t.time / TRACER_TIME);
        if (t.time <= 0) {
          scene.remove(t.line);
          t.line.geometry.dispose();
          t.line.material.dispose();
          live.splice(i, 1);
        }
      }
    },
    get count() {
      return live.length;
    },
  };
}
