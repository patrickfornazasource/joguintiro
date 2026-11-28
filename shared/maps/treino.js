// Mapa de treino (F1-19): o mapa do Teste humano #1.
// Uma volta com 10 estações em sequência, no sentido horário visto de cima:
//   corredor norte (indo para +x): 1 bunny hop, 2 air strafe sobre fosso, 3 deslize sob teto baixo;
//   corredor leste (indo para -z): 4 corrida na parede, 5 torre de pulo na parede, 6 slam;
//   corredor sul (indo para -x): 7 dash sobre um vão, 8 plataformas de salto;
//   corredor oeste (indo para +z): 9 escada com corrimão; e a volta fecha no começo (10 circuito).
// Medidas em metros; o topo do chão fica em y = 0. Quem cai num fosso renasce na estação mais perto.
import { box, rail, BOX_TYPES as T } from './format.js';

const HALF = 100; // o mapa vai de -100 a 100 em x e em z (faces internas das paredes)
const WALL_HEIGHT = 20; // paredes externas: bem acima de tudo que dá para alcançar
const WALL_BELOW = 40; // e bem abaixo do chão (mais que a queda até renascer, 30 m)
const CORE = 55; // bloco central de -55 a 55: separa os quatro corredores
const CORE_HEIGHT = 12;

// Direções (yaw) de quem anda em cada corredor: 0 olha para -z.
const EAST = -Math.PI / 2; // +x
const SOUTH = 0; // -z
const WEST = Math.PI / 2; // -x
const NORTH = Math.PI; // +z

/** Fossos: buracos no chão (sem fundo: cair neles leva de volta à estação). */
const HOLES = [
  { minX: -5, maxX: 1, minZ: 55, maxZ: HALF }, // 2: fosso do air strafe
  { minX: 1, maxX: 12, minZ: 55, maxZ: 74 }, // 2: continuação do fosso (força a curva para a direita)
  { minX: 32, maxX: 43, minZ: -HALF, maxZ: -55 }, // 7: vão do dash (11 m: só pulo + duplo + dash passa)
  { minX: -40, maxX: 0, minZ: -HALF, maxZ: -55 }, // 8: fosso das plataformas de salto
];

/** Chão com buracos: divide em retângulos e deixa de fora os que caem num buraco. */
function floorWithHoles(holes) {
  const xs = [...new Set([-HALF, HALF, ...holes.flatMap((h) => [h.minX, h.maxX])])].sort((a, b) => a - b);
  const zs = [...new Set([-HALF, HALF, ...holes.flatMap((h) => [h.minZ, h.maxZ])])].sort((a, b) => a - b);
  const inHole = (x, z) => holes.some((h) => x > h.minX && x < h.maxX && z > h.minZ && z < h.maxZ);
  const out = [];
  for (let j = 0; j < zs.length - 1; j++) {
    let i = 0;
    while (i < xs.length - 1) {
      const cz = (zs[j] + zs[j + 1]) / 2;
      if (inHole((xs[i] + xs[i + 1]) / 2, cz)) {
        i++;
        continue;
      }
      // junta células vizinhas da mesma faixa num retângulo só
      let k = i + 1;
      while (k < xs.length - 1 && !inHole((xs[k] + xs[k + 1]) / 2, cz)) k++;
      const x0 = xs[i];
      const x1 = xs[k];
      out.push(box((x0 + x1) / 2, -0.5, cz, x1 - x0, 1, zs[j + 1] - zs[j]));
      i = k;
    }
  }
  return out;
}

/** Escada reta: `count` degraus de `rise` m, subindo na direção `dir` (+1 ou -1 em z) a partir de z0. */
function stairsZ(x, z0, dir, count, rise, width) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const h = rise * (i + 1);
    out.push(box(x, h / 2, z0 + dir * (0.5 * i + 0.25), width, h, 0.5));
  }
  return out;
}

// ---- Estação 4: corredor de corrida na parede (o mesmo desenho testado no Sandbox) ----
export const TREINO_CORRIDOR = Object.freeze({
  x: 77,
  leftFace: 75, // indo para -z, a esquerda é o lado de x menor
  rightFace: 79,
  height: 3,
  start: { x: 76, z: 46 }, // em cima da plataforma de partida, encostado à esquerda
  walls: [
    { side: 'left', z: 38 },
    { side: 'right', z: 32 },
    { side: 'left', z: 26 },
    { side: 'right', z: 20 },
  ],
  wallLength: 8,
  endZ: 16, // a plataforma de chegada vai de z = 16 a 2 (longa: quem sai rápido da última parede pousa nela)
});

function corridor() {
  const c = TREINO_CORRIDOR;
  const out = [...stairsZ(c.x, 54, -1, 12, 0.25, 3)]; // escada de acesso: de z = 54 até 48
  out.push(box(c.x, c.height / 2, 45, 4, c.height, 6)); // plataforma de partida (z de 42 a 48)
  for (const w of c.walls) {
    const x = w.side === 'left' ? c.leftFace - 0.25 : c.rightFace + 0.25;
    out.push(box(x, 4.5, w.z, 0.5, 9, c.wallLength, T.WALLRUN));
  }
  out.push(box(c.x, c.height / 2, 9, 4, c.height, 14)); // plataforma de chegada (z de 2 a 16)
  return out;
}

// ---- Estação 6: slam e pulo de slam ----
export const TREINO_SLAM = Object.freeze({
  perch: { minX: 70, maxX: 74, minZ: -34, maxZ: -30, top: 8 }, // torre (escada de 20 degraus)
  spot: { minX: 70, maxX: 74, minZ: -39, maxZ: -34 }, // onde bater o slam (marcado no chão)
  target: { minX: 74, maxX: 78, minZ: -39, maxZ: -34, top: 3.5 }, // plataforma alta ao lado
});

function slamStation() {
  const s = TREINO_SLAM;
  const out = [...stairsZ(72, -20, -1, 20, 0.4, 3)]; // escada até a torre (z de -20 a -30)
  out.push(box(72, s.perch.top / 2, -32, 4, s.perch.top, 4)); // torre
  out.push(box(76, s.target.top / 2, -36.5, 4, s.target.top, 5)); // plataforma alta
  // Parede na beira norte da plataforma: quem só desce da torre andando não cai em cima dela.
  out.push(box(76, 5, -33.8, 4, 10, 0.4));
  return out;
}

export const treino = Object.freeze({
  id: 'treino',
  name: 'Treino (10 estações)',
  boxes: [
    ...floorWithHoles(HOLES),
    // Paredes externas e bloco central (separa os corredores e força a volta)
    // (as paredes descem até 40 m abaixo do chão: quem cai num fosso não passa por baixo delas)
    box(0, (WALL_HEIGHT - WALL_BELOW) / 2, -HALF - 0.5, 2 * HALF + 2, WALL_HEIGHT + WALL_BELOW, 1),
    box(0, (WALL_HEIGHT - WALL_BELOW) / 2, HALF + 0.5, 2 * HALF + 2, WALL_HEIGHT + WALL_BELOW, 1),
    box(-HALF - 0.5, (WALL_HEIGHT - WALL_BELOW) / 2, 0, 1, WALL_HEIGHT + WALL_BELOW, 2 * HALF + 2),
    box(HALF + 0.5, (WALL_HEIGHT - WALL_BELOW) / 2, 0, 1, WALL_HEIGHT + WALL_BELOW, 2 * HALF + 2),
    box(0, CORE_HEIGHT / 2, 0, 2 * CORE, CORE_HEIGHT, 2 * CORE),

    // 3: teto baixo (vão de 1,4 m: em pé não passa, deslizando passa). O bloco sobe até a altura
    // das paredes externas: não dá para passar por cima pulando.
    box(30, (1.4 + WALL_HEIGHT) / 2, 77.5, 16, WALL_HEIGHT - 1.4, 45),

    // 4: corredor de corrida na parede
    ...corridor(),

    // 5: torre de pulo na parede (duas paredes com 2 m de vão) e a plataforma no alto (3,5 m)
    box(75.75, 5, -9, 0.5, 10, 10), // z de -14 a -4
    box(78.25, 5, -9, 0.5, 10, 10),
    box(77, 1.75, -16.5, 4, 3.5, 5), // z de -19 a -14

    // 6: slam
    ...slamStation(),

    // 8: plataformas de salto no fosso (rentes ao chão), cada uma lança até a próxima
    ...[-2, -12, -22, -32].map((x) => box(x, -0.1, -77, 4, 0.2, 8, T.PAD, { launch: { x: -10, y: 12, z: 0 } })),

    // 9: escada (topo a 3 m) e corrimão descendo para +z. O corrimão começa logo no topo da
    // escada: sair pela beira direita em qualquer ponto do patamar pega o corrimão.
    ...stairsZ(-77, -45, 1, 12, 0.25, 3),
    box(-77, 1.5, -36, 4, 3, 6), // patamar (z de -39 a -33)
    rail({ x: -79.4, y: 3.2, z: -38.5 }, { x: -79.4, y: 0.3, z: -14 }),
  ],
  // Um ponto de nascimento por estação (1 a 10), no começo de cada uma.
  spawns: [
    { x: -92, y: 0, z: 77, yaw: EAST }, // 1
    { x: -25, y: 0, z: 71, yaw: EAST }, // 2
    { x: 16, y: 0, z: 80, yaw: EAST }, // 3
    { x: 76, y: 3, z: 46, yaw: SOUTH }, // 4 (em cima da plataforma de partida)
    { x: 77, y: 0, z: 0.5, yaw: SOUTH }, // 5
    { x: 72, y: 0, z: -17, yaw: SOUTH }, // 6
    { x: 62, y: 0, z: -77, yaw: WEST }, // 7
    { x: 14, y: 0, z: -77, yaw: WEST }, // 8
    { x: -77, y: 0, z: -58, yaw: NORTH }, // 9
    { x: -92, y: 0, z: 62, yaw: EAST }, // 10 (circuito completo: começa na faixa de largada)
  ],
  // Placas: nome da estação e teclas (desenhadas em src/world/signs.js).
  signs: [
    { x: -86, y: 2.6, z: 77, yaw: EAST, title: '1 · Bunny hop', lines: ['Segure W + Espaço: os pulos emendam', 'sozinhos e a velocidade não cai.'] },
    { x: -19, y: 2.6, z: 71, yaw: EAST, title: '2 · Air strafe na curva', lines: ['Pule no fim e curve para a DIREITA:', 'segure D e vire o mouse. Espaço no ar ajuda.'] },
    { x: 21.9, y: 2.6, z: 80, yaw: EAST, title: '3 · Deslize', lines: ['Corra e aperte C antes do túnel baixo:', 'em pé não passa, deslizando passa.'] },
    { x: 81.6, y: 3.6, z: 40, yaw: SOUTH, title: '4 · Corrida na parede', lines: ['Encostado à esquerda, corra, pule e puxe A.', 'Na parede, espere um instante e Espaço.'] },
    { x: 82.5, y: 2.6, z: -8.5, yaw: Math.atan2(-5.5, 9), title: '5 · Pulo na parede', lines: ['Entre no vão e pule. Encostado: Espaço', 'de novo (até 3). Suba na plataforma.'] },
    { x: 72, y: 5.2, z: -24, yaw: SOUTH, title: '6 · Slam e pulo de slam', lines: ['Suba a torre e caia no X amarelo com C.', 'Ao bater: Espaço, e Espaço no ar. Vá para a direita.'] },
    { x: 56, y: 2.6, z: -77, yaw: WEST, title: '7 · Dash', lines: ['O vão é grande demais para um pulo só.', 'Pule, Espaço no ar (duplo) e Shift (dash).'] },
    { x: 8, y: 2.6, z: -77, yaw: WEST, title: '8 · Plataformas de salto', lines: ['Pise na plataforma verde.', 'Uma lança na outra até o outro lado.'] },
    { x: -77, y: 2.6, z: -51, yaw: NORTH, title: '9 · Escada com corrimão', lines: ['Suba a escada segurando W e, no alto,', 'puxe D (direita): você desce o corrimão.'] },
    { x: -86, y: 2.6, z: 62, yaw: EAST, title: '10 · Circuito completo', lines: ['Saia da faixa verde: o tempo começa.', 'Dê a volta toda até a faixa vermelha.'] },
  ],
  // Cronômetro do circuito: sair da faixa de largada começa; entrar na de chegada termina, mas só
  // depois de passar, na ordem, pelos corredores leste (estações 4 a 6), sul (7 e 8) e oeste (9).
  timer: {
    start: { minX: -100, maxX: -84, minZ: 55, maxZ: 100 },
    finish: { minX: -100, maxX: -55, minZ: 38, maxZ: 52 },
    checkpoints: [
      { minX: 55, maxX: 100, minZ: -55, maxZ: 55 }, // corredor leste
      { minX: -55, maxX: 55, minZ: -100, maxZ: -55 }, // corredor sul
      { minX: -100, maxX: -55, minZ: -55, maxZ: 30 }, // corredor oeste
    ],
  },
  // Marcas visuais no chão (sem colisão): o X do slam e a faixa na entrada do túnel do deslize.
  marks: [
    { ...TREINO_SLAM.spot, color: '#ffd400' },
    { minX: 19, maxX: 22, minZ: 55, maxZ: 100, color: '#00e5ff' },
  ],
});
