// Placas e marcas no chão dos mapas (F1-19). Só visual, sem colisão.
// - Placas: texto em português desenhado num canvas e aplicado num plano.
// - Marcas: retângulos coloridos rentes ao chão (o X do slam, faixas do cronômetro).
import * as THREE from 'three';

/** Tamanho da placa no mundo (m) e resolução da textura (pixels por metro). */
const SIGN_WIDTH = 5;
const SIGN_HEIGHT = 1.6;
const PX_PER_M = 128;

/** Desenha o texto da placa num canvas e devolve a textura. */
function signTexture(doc, title, lines) {
  const canvas = doc.createElement('canvas');
  canvas.width = SIGN_WIDTH * PX_PER_M;
  canvas.height = SIGN_HEIGHT * PX_PER_M;
  const g = canvas.getContext('2d');
  g.fillStyle = 'rgba(10, 10, 16, 0.92)';
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.strokeStyle = '#00e5ff';
  g.lineWidth = 8;
  g.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);
  // Diminui a fonte até o texto mais largo caber (com margem dos dois lados).
  const maxWidth = canvas.width - 56;
  const fit = (style, size, texts) => {
    let px = size;
    g.font = `${style} ${px}px system-ui, sans-serif`;
    while (px > 16 && Math.max(...texts.map((t) => g.measureText(t).width)) > maxWidth) {
      px -= 2;
      g.font = `${style} ${px}px system-ui, sans-serif`;
    }
    return px;
  };
  g.textBaseline = 'top';
  g.fillStyle = '#00e5ff';
  fit('bold', 64, [title]);
  g.fillText(title, 28, 22);
  g.fillStyle = '#f0f0f0';
  const px = fit('', 40, lines.length ? lines : ['']);
  lines.forEach((line, i) => g.fillText(line, 28, 104 + i * (px + 8)));
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/**
 * Cria as placas de um mapa (`map.signs`), viradas para quem chega (yaw da direção de quem anda).
 * @param {{ signs?: Array<{x,y,z,yaw,title,lines}> }} map
 * @param {Document} [doc]
 */
export function createSigns(map, doc = document) {
  const group = new THREE.Group();
  group.name = 'placas';
  for (const s of map.signs ?? []) {
    const material = new THREE.MeshBasicMaterial({ map: signTexture(doc, s.title, s.lines ?? []), transparent: true });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(SIGN_WIDTH, SIGN_HEIGHT), material);
    plane.position.set(s.x, s.y, s.z);
    plane.rotation.y = s.yaw ?? 0; // o plano olha para +z; girar pelo yaw vira para quem vem andando
    group.add(plane);
  }
  return group;
}

/**
 * Marcas coloridas no chão: `map.marks` e as faixas do cronômetro (`map.timer`).
 * @param {{ marks?: Array, timer?: { start, finish } }} map
 */
export function createFloorMarks(map) {
  const group = new THREE.Group();
  group.name = 'marcas';
  const zones = [...(map.marks ?? [])];
  if (map.timer) {
    zones.push({ ...map.timer.start, color: '#2ecc40' });
    zones.push({ ...map.timer.finish, color: '#ff3b3b' });
  }
  for (const z of zones) {
    const w = z.maxX - z.minX;
    const d = z.maxZ - z.minZ;
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshBasicMaterial({ color: z.color ?? '#ffffff', transparent: true, opacity: 0.55 }),
    );
    plane.rotation.x = -Math.PI / 2;
    plane.position.set((z.minX + z.maxX) / 2, 0.02, (z.minZ + z.maxZ) / 2);
    group.add(plane);
  }
  return group;
}
