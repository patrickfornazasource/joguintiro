// Movimento no chão: direção desejada, aceleração e atrito. Código puro (sem Three.js, sem DOM).
// Modelo clássico de arena: acelera na direção desejada até a velocidade alvo;
// o atrito tira uma fração da velocidade por segundo.
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

/**
 * Acelera na direção desejada sem passar da velocidade alvo nessa direção.
 * Não altera `vel`: devolve uma velocidade nova.
 * @param {{x,y,z}} vel velocidade atual (m/s)
 * @param {{x,y,z}} dir direção desejada, comprimento 1
 * @param {number} wishSpeed velocidade alvo (m/s)
 * @param {number} accel aceleração (1/s, multiplicada por wishSpeed)
 * @param {number} dt (s)
 */
export function accelerate(vel, dir, wishSpeed, accel, dt) {
  const current = vel.x * dir.x + vel.y * dir.y + vel.z * dir.z; // velocidade já na direção
  const missing = wishSpeed - current;
  if (missing <= 0) return { ...vel };
  const add = Math.min(accel * wishSpeed * dt, missing);
  return { x: vel.x + dir.x * add, y: vel.y + dir.y * add, z: vel.z + dir.z * add };
}

/**
 * Aceleração no ar (air strafe, técnica clássica dos jogos de arena).
 * Igual a `accelerate`, mas o "quanto falta" é calculado com a velocidade desejada limitada
 * a `wishCap`, enquanto a força usa o valor cheio. Resultado: andar só para frente no ar
 * não acelera além do que já tem, mas mirar levemente de lado (A/D + mouse) soma velocidade.
 * Não altera `vel`: devolve uma velocidade nova.
 * @param {{x,y,z}} vel (m/s)
 * @param {{x,y,z}} dir direção desejada, comprimento 1
 * @param {number} wishSpeed velocidade desejada cheia (m/s)
 * @param {number} accel aceleração no ar (1/s, multiplicada por wishSpeed)
 * @param {number} wishCap teto para o cálculo do "quanto falta" (m/s)
 * @param {number} dt (s)
 */
export function airAccelerate(vel, dir, wishSpeed, accel, wishCap, dt) {
  const current = vel.x * dir.x + vel.y * dir.y + vel.z * dir.z;
  const missing = Math.min(wishSpeed, wishCap) - current;
  if (missing <= 0) return { ...vel };
  const add = Math.min(accel * wishSpeed * dt, missing);
  return { x: vel.x + dir.x * add, y: vel.y + dir.y * add, z: vel.z + dir.z * add };
}

/**
 * Vira a direção horizontal da velocidade em direção a `dir` sem mudar o módulo.
 * Gira a fração `fraction` (0 a 1) do ângulo entre as duas direções. A vertical não muda.
 * Sem velocidade horizontal ou sem direção, devolve uma cópia sem mudanças.
 * @param {{x,y,z}} vel (m/s)
 * @param {{x,y,z}|null} dir direção desejada no plano, comprimento 1
 * @param {number} fraction 0 = não vira, 1 = vira totalmente
 */
export function redirectHorizontal(vel, dir, fraction) {
  const speed = Math.hypot(vel.x, vel.z);
  if (!dir || speed < 1e-9) return { ...vel };
  const from = Math.atan2(vel.z, vel.x);
  const to = Math.atan2(dir.z, dir.x);
  let diff = to - from;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff <= -Math.PI) diff += 2 * Math.PI;
  const angle = from + diff * Math.max(0, Math.min(1, fraction));
  return { x: Math.cos(angle) * speed, y: vel.y, z: Math.sin(angle) * speed };
}

/**
 * Atrito no plano (x, z): tira friction x velocidade por segundo; abaixo de stopSpeed,
 * freia como se estivesse a stopSpeed (para de vez). Nunca inverte o sentido.
 * Não altera `vel`: devolve uma velocidade nova (y fica igual).
 * @param {{x,y,z}} vel (m/s)
 * @param {number} friction (1/s)
 * @param {number} stopSpeed (m/s)
 * @param {number} dt (s)
 */
export function applyFriction(vel, friction, stopSpeed, dt) {
  const speed = Math.hypot(vel.x, vel.z);
  if (speed < 1e-6) return { x: 0, y: vel.y, z: 0 };
  const drop = Math.max(speed, stopSpeed) * friction * dt;
  const k = Math.max(speed - drop, 0) / speed;
  return { x: vel.x * k || 0, y: vel.y, z: vel.z * k || 0 }; // || 0 troca -0 por 0
}
