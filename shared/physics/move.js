// Direção de movimento desejada a partir da entrada. Código puro.
// Convenção: yaw = 0 olha para -z; yaw positivo gira para a esquerda (como a câmera do Three.js).

/** Vetor "para frente" no plano para um yaw. */
export function forwardOf(yaw) {
  return { x: -Math.sin(yaw), y: 0, z: -Math.cos(yaw) };
}

/** Vetor "para a direita" no plano para um yaw. */
export function rightOf(yaw) {
  return { x: Math.cos(yaw), y: 0, z: -Math.sin(yaw) };
}

/**
 * Direção desejada no plano (comprimento 0 a 1) a partir de moveX/moveZ e yaw.
 * Diagonal não fica mais rápida: o vetor é limitado a comprimento 1.
 * @param {{ moveX: number, moveZ: number, yaw: number }} input
 */
export function wishDir(input) {
  const f = forwardOf(input.yaw);
  const r = rightOf(input.yaw);
  let x = f.x * input.moveZ + r.x * input.moveX;
  let z = f.z * input.moveZ + r.z * input.moveX;
  const len = Math.hypot(x, z);
  if (len > 1) {
    x /= len;
    z /= len;
  }
  return { x: x || 0, y: 0, z: z || 0 }; // || 0 troca -0 por 0
}
