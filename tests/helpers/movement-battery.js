// Bateria de movimentos roteirizados (F1-20): roda várias sequências de entrada em mapas de
// verdade e devolve uma "impressão digital" do que aconteceu (posições e eventos). Serve para
// provar que mudar um número no painel de ajuste muda o movimento. Usado pelos testes.
import { PHYSICS } from '../../shared/constants.js';
import { createPlayer, stepPlayer, emptyInput } from '../../shared/physics/player.js';

const DT = PHYSICS.FIXED_DT;

/**
 * Roteiros: cada um recebe (i = passo, p = jogador, yaw) e devolve a entrada do passo.
 * Cobrem andar, parar, pulo segurado, pulo duplo, deslize, slam, dash e pulos na parede.
 */
const SCRIPTS = {
  // Anda 1 s, solta (atrito e parada), anda de novo agachado.
  walkStop: (i, p, yaw) => ({ moveZ: i < 120 || i > 200 ? 1 : 0, crouch: i > 200, yaw }),
  // Bunny hop com curva (air strafe) e pulo duplo no meio.
  hop: (i, p, yaw) => {
    const t = i * DT;
    const press = i === 0 || Math.abs(t - 0.3) < DT / 2;
    return { moveZ: 1, moveX: i % 120 < 60 ? 1 : -1, yaw: yaw + Math.sin(t * 3) * 0.6, jump: true, jumpPressed: press };
  },
  // Corre, desliza (C), pula do deslize, slam no ar e pulo de slam.
  slideSlam: (i, p, yaw) => {
    const crouchPressed = i === 60 || i === 150;
    const jumpPressed = i === 100 || i === 175;
    return { moveZ: 1, yaw, crouch: (i >= 60 && i < 100) || i >= 150, crouchPressed, jump: jumpPressed, jumpPressed };
  },
  // Corre e usa o dash várias vezes (cargas e recarga), pulando entre eles.
  dashes: (i, p, yaw) => ({ moveZ: 1, moveX: 0.5, yaw, dashPressed: i % 50 === 10, jump: i % 90 === 0, jumpPressed: i % 90 === 0 }),
  // Pulos apertados toda hora: pulo na parede e corrida na parede quando houver parede.
  wallSpam: (i, p, yaw) => ({ moveZ: 1, moveX: i % 200 < 100 ? -1 : 1, yaw, jump: i % 15 === 0, jumpPressed: i % 15 === 0 }),
};

/**
 * Cenários especiais (mapa, ponto de partida, velocidade inicial e roteiro) para as mecânicas que
 * pedem um lugar certo: corrida na parede, corrimão, plataforma de salto, borda, parede para pular.
 * O roteiro recebe (i, p, yaw, mem), onde mem guarda o que o roteiro quiser entre os passos.
 */
export function specialScenarios(maps) {
  const { treino, sandbox } = maps;
  return [
    // Estação 4 do treino: pula para a parede e espera a corrida acabar sozinha (tempo máximo).
    { name: 'paredeSegura', map: treino, start: treino.spawns[3], vel: { x: -1.5, y: 0, z: -12 }, seconds: 3,
      script: (i, p, yaw) => ({ moveZ: 1, moveX: -1, yaw, jump: i === 0, jumpPressed: i === 0 }) },
    // Estação 4: atravessa o corredor pulando de parede em parede.
    { name: 'paredePulos', map: treino, start: treino.spawns[3], vel: { x: -1.5, y: 0, z: -12 }, seconds: 3,
      script: (i, p, yaw) => {
        const jump = i === 0 || (p.wallrun && p.wallrun.time > 0.05);
        return { moveZ: 1, yaw, jump, jumpPressed: jump };
      } },
    // Estação 4: corre na parede, puxa para fora por um instante (W + D solta da parede da
    // esquerda) e volta a puxar para ela (regras de soltar e de voltar à mesma parede).
    { name: 'paredeSoltar', map: treino, start: treino.spawns[3], vel: { x: -1.5, y: 0, z: -12 }, seconds: 2,
      script: (i, p, yaw, mem) => {
        const release = !mem.released && p.wallrun && p.wallrun.time > 0.3;
        if (release) mem.released = true;
        return { moveZ: 1, moveX: release ? 0.4 : -1, yaw, jump: i === 0, jumpPressed: i === 0 };
      } },
    // Sandbox: pula de lado na ponta estreita (0,5 m) de uma parede fina (largura mínima da parede).
    { name: 'pontaParede', map: sandbox, start: { x: 15.2, y: 0, z: 4.5, yaw: -Math.PI / 2 }, vel: { x: 10, y: 0, z: -0.6 }, seconds: 1.5,
      script: (i, p, yaw) => ({ yaw, jump: i === 0, jumpPressed: i === 0 }) },
    // Sandbox: pula da parede e volta para ela (regra de voltar à mesma parede).
    { name: 'paredeVolta', map: sandbox, start: { x: 21, y: 0, z: 6, yaw: 0 }, vel: { x: 0, y: 0, z: -10 }, seconds: 2.5,
      script: (i, p, yaw, mem) => {
        if (p.wallrun && p.wallrun.time > 0.25 && !mem.jumped) {
          mem.jumped = true;
          return { moveZ: 1, yaw, jump: true, jumpPressed: true };
        }
        return { moveZ: 1, moveX: 1, yaw, jump: i === 0, jumpPressed: i === 0 };
      } },
    // Estação 9: sobe a escada, pega o corrimão, pula dele e cai de novo nele.
    { name: 'corrimao', map: treino, start: treino.spawns[8], seconds: 5,
      script: (i, p, yaw, mem) => {
        if (p.rail) mem.ride = (mem.ride ?? 0) + 1;
        const jump = mem.ride === 40;
        return { moveZ: 1, moveX: p.pos.y > 2.9 && p.pos.z > -39 ? 1 : 0, yaw, jump, jumpPressed: jump };
      } },
    // Sandbox: corrimão baixo (x de -5 a 5, z = -18, altura 1): pula e cai nele.
    // Chega devagar (4 m/s, sem apertar nada): testa a velocidade mínima para grudar.
    { name: 'corrimaoBaixo', map: sandbox, start: { x: -7, y: 0, z: -18, yaw: -Math.PI / 2 }, vel: { x: 4, y: 0, z: 0 }, seconds: 2,
      script: (i, p, yaw) => ({ yaw, jump: i === 0, jumpPressed: i === 0 }) },
    // Sandbox: plataforma de salto sem direção.
    { name: 'plataforma', map: sandbox, start: { x: -16, y: 0, z: 16, yaw: 0 }, seconds: 3,
      script: (i, p, yaw) => ({ moveZ: i < 60 ? 1 : 0, yaw }) },
    // Torre do slam: sai andando da borda e aperta pulo 0,05 s depois (tolerância de borda).
    { name: 'borda', map: treino, start: { x: 72, y: 8, z: -31.5, yaw: 0 }, seconds: 2,
      script: (i, p, yaw, mem) => {
        if (p.onGround) mem.air = 0;
        else mem.air = (mem.air ?? 0) + 1;
        const jump = mem.air === 6;
        return { moveZ: 1, yaw, jump, jumpPressed: jump };
      } },
    // Sandbox: pula colado na parede externa, afasta e aperta pulo logo depois (memória da parede).
    { name: 'memoriaParede', map: sandbox, start: { x: 28.55, y: 0, z: 0, yaw: 0 }, seconds: 2,
      script: (i, p, yaw) => {
        const jump = i === 0 || i === 40;
        return { moveX: -1, yaw, jump, jumpPressed: jump };
      } },
    // Estação 5 do treino (poço de 2 m): pulos na parede apertando Espaço a cada 0,1 s
    // (quantos seguidos e espera para pular de novo na mesma parede).
    { name: 'poco', map: treino, start: { x: 76.5, y: 0, z: -9, yaw: 0 }, seconds: 3,
      script: (i, p, yaw) => {
        const jump = i % 12 === 0;
        return { moveX: i % 240 < 120 ? -1 : 1, yaw, jump, jumpPressed: jump };
      } },
    // Sandbox: desliza curvando (direção no deslize) e desliza de novo logo depois (espera do impulso).
    { name: 'deslizes', map: sandbox, start: { x: 0, y: 0, z: 20, yaw: 0 }, vel: { x: 0, y: 0, z: -9 }, seconds: 2,
      script: (i, p, yaw) => {
        const crouchPressed = i === 10 || i === 90;
        return { moveZ: 1, moveX: 1, yaw, crouch: (i >= 10 && i < 70) || i >= 90, crouchPressed };
      } },
  ];
}

/** Roda os cenários especiais e devolve a impressão digital. */
export function specialFingerprint(maps, cfg = undefined) {
  const out = [];
  for (const sc of specialScenarios(maps)) {
    const p = createPlayer(sc.start, cfg);
    if (sc.vel) p.vel = { ...sc.vel };
    const yaw = sc.start.yaw ?? 0;
    const mem = {};
    const trace = [];
    for (let i = 0; i < sc.seconds / DT; i++) {
      stepPlayer(p, { ...emptyInput(), ...sc.script(i, p, yaw, mem) }, sc.map, DT, cfg);
      if (i % 6 === 0) trace.push(`${p.pos.x.toFixed(4)},${p.pos.y.toFixed(4)},${p.pos.z.toFixed(4)}`);
      for (const e of p.events) trace.push(e.type);
    }
    out.push(`${sc.name}:${trace.join(' ')}`);
  }
  return out.join('\n');
}

/**
 * Roda todos os roteiros a partir dos pontos de partida dados.
 * @param {object} map
 * @param {Array<{x,y,z,yaw?}>} starts
 * @param {object} [cfg] números do movimento (padrão MOVE)
 * @param {number} [seconds]
 * @returns {string} impressão digital (texto); igual = movimento idêntico
 */
export function movementFingerprint(map, starts, cfg = undefined, seconds = 3) {
  const out = [];
  for (const s of starts) {
    for (const [name, script] of Object.entries(SCRIPTS)) {
      const p = createPlayer(s, cfg);
      const yaw = s.yaw ?? 0;
      const trace = [];
      for (let i = 0; i < seconds / DT; i++) {
        stepPlayer(p, { ...emptyInput(), ...script(i, p, yaw) }, map, DT, cfg);
        if (i % 6 === 0) trace.push(`${p.pos.x.toFixed(4)},${p.pos.y.toFixed(4)},${p.pos.z.toFixed(4)}`);
        for (const e of p.events) trace.push(e.type);
      }
      out.push(`${name}:${trace.join(' ')}`);
    }
  }
  return out.join('\n');
}
