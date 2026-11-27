// Desenha um mapa (shared/maps) em cinza, com cor por tipo de bloco e contorno
// nas arestas para facilitar a leitura das formas.
import * as THREE from 'three';
import { BOX_TYPES as T } from '../../shared/maps/format.js';

/** Cores por tipo (só visual). */
const STYLE = {
  [T.SOLID]: { color: 0x8a8a8a, edge: 0x2a2a2a },
  [T.WALLRUN]: { color: 0x8a8a8a, edge: 0x00e5ff, stripe: 0x00e5ff },
  [T.PAD]: { color: 0x2ecc40, edge: 0x0b4d18 },
  [T.RAIL]: { color: 0xff8c1a, edge: 0x6b3500 },
  [T.UV]: { color: 0x9b59ff, edge: 0x3a1a6b },
};

/** Altura da faixa ciano no topo das paredes de corrida (m). */
const STRIPE_HEIGHT = 0.15;

/**
 * Cria um grupo com as malhas do mapa.
 * @param {{ boxes: Array }} map
 * @returns {THREE.Group}
 */
export function createMapMeshes(map) {
  const group = new THREE.Group();
  group.name = `mapa:${map.id}`;
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const edges = new THREE.EdgesGeometry(geometry);
  const materials = new Map();
  const lineMaterials = new Map();
  const mat = (color) => {
    if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color }));
    return materials.get(color);
  };
  const lineMat = (color) => {
    if (!lineMaterials.has(color)) lineMaterials.set(color, new THREE.LineBasicMaterial({ color }));
    return lineMaterials.get(color);
  };

  for (const b of map.boxes) {
    const style = STYLE[b.type] ?? STYLE[T.SOLID];
    const size = new THREE.Vector3(b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z);
    const center = new THREE.Vector3(
      (b.min.x + b.max.x) / 2,
      (b.min.y + b.max.y) / 2,
      (b.min.z + b.max.z) / 2,
    );

    const mesh = new THREE.Mesh(geometry, mat(style.color));
    mesh.position.copy(center);
    mesh.scale.copy(size);
    mesh.userData.boxType = b.type;
    group.add(mesh);

    const outline = new THREE.LineSegments(edges, lineMat(style.edge));
    outline.position.copy(center);
    outline.scale.copy(size);
    group.add(outline);

    if (style.stripe) {
      // Faixa na borda de cima, um pouco mais grossa que a parede para aparecer dos dois lados.
      const stripe = new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({ color: style.stripe }),
      );
      stripe.position.set(center.x, b.max.y - STRIPE_HEIGHT / 2, center.z);
      stripe.scale.set(size.x * 1.02 + 0.02, STRIPE_HEIGHT, size.z * 1.02 + 0.02);
      group.add(stripe);
    }
  }
  return group;
}
