// Vetores 3D simples como objetos {x, y, z}.
// Código puro: sem classes, sem Three.js, sem window/document.
// Todas as funções devolvem um vetor novo e não alteram os argumentos.

/** Cria um vetor. */
export function v3(x = 0, y = 0, z = 0) {
  return { x, y, z };
}

/** Soma a + b. */
export function add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

/** Subtração a - b. */
export function sub(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

/** Multiplica o vetor por um número. */
export function scale(a, s) {
  return { x: a.x * s, y: a.y * s, z: a.z * s };
}

/** Produto escalar. */
export function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

/** Comprimento do vetor. */
export function len(a) {
  return Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
}

/** Comprimento no plano horizontal (ignora y): velocidade no chão. */
export function lenXZ(a) {
  return Math.sqrt(a.x * a.x + a.z * a.z);
}

/** Vetor de mesmo sentido com comprimento 1. Vetor nulo devolve (0, 0, 0). */
export function normalize(a) {
  const l = len(a);
  return l > 0 ? scale(a, 1 / l) : v3();
}

/** Cópia independente do vetor. */
export function copy(a) {
  return { x: a.x, y: a.y, z: a.z };
}
