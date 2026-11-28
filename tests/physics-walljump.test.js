import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PHYSICS, PLAYER, MOVE } from '../shared/constants.js';
import { box, BOX_TYPES as T } from '../shared/maps/format.js';
import { createPlayer, stepPlayer, emptyInput } from '../shared/physics/player.js';

const DT = PHYSICS.FIXED_DT;
const R = PLAYER.RADIUS;
const input = (over = {}) => ({ ...emptyInput(), ...over });
const has = (p, type) => p.events.some((e) => e.type === type);
const floor = box(0, -0.5, 0, 200, 1, 200);
// Duas paredes comuns paralelas, altas, com 2 m de vão entre as faces (x = -1 e x = 1).
const left = box(-1.25, 10, 0, 0.5, 20, 20);
const right = box(1.25, 10, 0, 0.5, 20, 20);
const shaft = { id: 't', name: 't', boxes: [floor, left, right], spawns: [] };

/** Jogador no chão, encostado na parede da esquerda. */
function inShaft() {
  const p = createPlayer({ x: -1 + R, y: 0, z: 0, yaw: 0 });
  stepPlayer(p, emptyInput(), shaft, DT);
  stepPlayer(p, emptyInput(), shaft, DT);
  assert.equal(p.onGround, true);
  assert.ok(p.wall, 'encostado');
  return p;
}

/**
 * Sobe entre as paredes: pula do chão e, a cada vez que encosta na parede do outro lado,
 * aperta Espaço. Para depois de `presses` apertos no ar. Devolve os eventos em ordem e a altura máxima.
 */
function climb(presses) {
  const p = inShaft();
  const events = [];
  let top = 0;
  let done = 0;
  let lastSide = -1; // começou na parede da esquerda (normal +x)
  stepPlayer(p, input({ jump: true, jumpPressed: true }), shaft, DT); // pulo do chão
  events.push(...p.events.map((e) => e.type));
  for (let i = 0; i < 4 / DT && done < presses; i++) {
    // Aperta quando encosta na parede do lado oposto ao último empurrão (ou na primeira, logo após sair do chão).
    const touching = p.wall && p.wall.age === 0;
    const side = touching ? Math.sign(p.wall.normal.x) : 0;
    const press = (touching && side !== lastSide && !p.onGround) || (done === 0 && i === 6);
    stepPlayer(p, input({ jump: press, jumpPressed: press }), shaft, DT);
    if (press) {
      done++;
      if (touching) lastSide = side;
    }
    events.push(...p.events.map((e) => e.type));
    top = Math.max(top, p.pos.y);
  }
  for (let i = 0; i < 1 / DT; i++) {
    stepPlayer(p, emptyInput(), shaft, DT);
    top = Math.max(top, p.pos.y);
  }
  return { p, events, top };
}

test('subir entre duas paredes paralelas com 3 pulos na parede', () => {
  const { events, top } = climb(3);
  assert.deepEqual(events.filter((e) => e !== 'jump'), ['wallJump', 'wallJump', 'wallJump']);
  const single = (MOVE.JUMP_SPEED * MOVE.JUMP_SPEED) / (2 * MOVE.GRAVITY);
  assert.ok(top > single + 1, `subiu até ${top.toFixed(2)} m (um pulo simples: ${single.toFixed(2)} m)`);
});

test('o 4º aperto não é pulo na parede: vira pulo duplo (se disponível)', () => {
  const { events } = climb(4);
  assert.deepEqual(events.filter((e) => e !== 'jump'), ['wallJump', 'wallJump', 'wallJump', 'doubleJump']);
});

test('sem pulo duplo disponível, o 4º aperto não faz nada', () => {
  const p = inShaft();
  stepPlayer(p, input({ jump: true, jumpPressed: true }), shaft, DT);
  p.jumpsLeft = 0;
  p.wallJumpsLeft = 0;
  for (let i = 0; i < 3; i++) stepPlayer(p, emptyInput(), shaft, DT);
  assert.ok(p.wall, 'encostado');
  stepPlayer(p, input({ jump: true, jumpPressed: true }), shaft, DT);
  assert.deepEqual(p.events, []);
});

test('pulo na parede: empurra para longe e para cima, mantém a velocidade ao longo dela', () => {
  const p = inShaft();
  stepPlayer(p, input({ jump: true, jumpPressed: true }), shaft, DT);
  for (let i = 0; i < 5; i++) stepPlayer(p, emptyInput(), shaft, DT);
  p.vel.z = -4; // andando ao longo da parede
  stepPlayer(p, input({ jump: true, jumpPressed: true }), shaft, DT);
  assert.ok(has(p, 'wallJump'));
  assert.ok(Math.abs(p.vel.x - MOVE.WALL_JUMP_OUT) < 1e-9, `para longe: ${p.vel.x}`);
  assert.equal(p.vel.z, -4);
  assert.ok(Math.abs(p.vel.y - (MOVE.WALL_JUMP_UP - MOVE.GRAVITY * DT)) < 1e-9, `para cima: ${p.vel.y}`);
  assert.equal(p.wallJumpsLeft, MOVE.WALL_JUMP_MAX - 1);
});

test('tem prioridade sobre o pulo duplo quando encostado', () => {
  const p = inShaft();
  stepPlayer(p, input({ jump: true, jumpPressed: true }), shaft, DT);
  for (let i = 0; i < 5; i++) stepPlayer(p, emptyInput(), shaft, DT);
  assert.equal(p.jumpsLeft, 1);
  stepPlayer(p, input({ jump: true, jumpPressed: true }), shaft, DT);
  assert.deepEqual(p.events.map((e) => e.type), ['wallJump']);
  assert.equal(p.jumpsLeft, 1, 'o pulo duplo continua guardado');
});

test('vale dentro da memória de parede (até 0,15 s depois de desencostar)', () => {
  const p = inShaft();
  stepPlayer(p, input({ jump: true, jumpPressed: true }), shaft, DT);
  for (let i = 0; i < 3; i++) stepPlayer(p, emptyInput(), shaft, DT);
  p.vel.x = 3; // se afasta da parede da esquerda
  for (let i = 0; i < 6; i++) stepPlayer(p, emptyInput(), shaft, DT); // 0,05 s
  assert.ok(p.wall && p.wall.age > 0, 'só na memória');
  stepPlayer(p, input({ jump: true, jumpPressed: true }), shaft, DT);
  assert.ok(has(p, 'wallJump'));
});

test('segurar Espaço não pula na parede (só um aperto novo)', () => {
  const p = inShaft();
  stepPlayer(p, input({ jump: true, jumpPressed: true }), shaft, DT);
  for (let i = 0; i < 20; i++) {
    stepPlayer(p, input({ jump: true }), shaft, DT);
    assert.equal(has(p, 'wallJump'), false);
  }
});

test('a mesma parede não serve para dois pulos seguidos (espera de 0,3 s)', () => {
  // Parede única: depois do pulo, o jogador se afasta; um novo aperto logo depois não é pulo na parede.
  const map = { id: 't', name: 't', boxes: [floor, left], spawns: [] };
  const p = createPlayer({ x: -1 + R, y: 0, z: 0 });
  stepPlayer(p, emptyInput(), map, DT);
  stepPlayer(p, input({ jump: true, jumpPressed: true }), map, DT);
  for (let i = 0; i < 4; i++) stepPlayer(p, emptyInput(), map, DT);
  stepPlayer(p, input({ jump: true, jumpPressed: true }), map, DT);
  assert.ok(has(p, 'wallJump'));
  stepPlayer(p, emptyInput(), map, DT);
  stepPlayer(p, input({ jump: true, jumpPressed: true }), map, DT);
  assert.deepEqual(p.events.map((e) => e.type), ['doubleJump']);
});

test('recarrega no chão', () => {
  const p = inShaft();
  stepPlayer(p, input({ jump: true, jumpPressed: true }), shaft, DT);
  for (let i = 0; i < 5; i++) stepPlayer(p, emptyInput(), shaft, DT);
  stepPlayer(p, input({ jump: true, jumpPressed: true }), shaft, DT);
  assert.ok(has(p, 'wallJump'));
  assert.equal(p.wallJumpsLeft, MOVE.WALL_JUMP_MAX - 1);
  for (let i = 0; i < 3 / DT && !p.onGround; i++) stepPlayer(p, emptyInput(), shaft, DT);
  stepPlayer(p, emptyInput(), shaft, DT);
  assert.equal(p.wallJumpsLeft, MOVE.WALL_JUMP_MAX);
});

test('recarrega ao correr numa parede (wallrun)', () => {
  const run = box(2.25, 0, 0, 0.5, 60, 400, T.WALLRUN);
  const map = { id: 't', name: 't', boxes: [box(0, -60.5, 0, 400, 1, 400), run], spawns: [] };
  const p = createPlayer({ x: 2 - R - 0.3, y: 10, z: 0, yaw: 0 });
  p.vel = { x: 2, y: 0, z: -10 };
  p.wallJumpsLeft = 0;
  for (let i = 0; i < 30 && !p.wallrun; i++) stepPlayer(p, input({ moveZ: 1, yaw: 0 }), map, DT);
  assert.ok(p.wallrun);
  assert.equal(p.wallJumpsLeft, MOVE.WALL_JUMP_MAX);
});

test('correndo na parede, Espaço é o pulo da corrida (não gasta pulo na parede)', () => {
  const run = box(2.25, 0, 0, 0.5, 60, 400, T.WALLRUN);
  const map = { id: 't', name: 't', boxes: [box(0, -60.5, 0, 400, 1, 400), run], spawns: [] };
  const p = createPlayer({ x: 2 - R - 0.3, y: 10, z: 0, yaw: 0 });
  p.vel = { x: 2, y: 0, z: -10 };
  for (let i = 0; i < 30 && !p.wallrun; i++) stepPlayer(p, input({ moveZ: 1, yaw: 0 }), map, DT);
  stepPlayer(p, input({ moveZ: 1, yaw: 0, jump: true, jumpPressed: true }), map, DT);
  assert.ok(has(p, 'wallrunJump'));
  assert.equal(has(p, 'wallJump'), false);
  assert.equal(p.wallJumpsLeft, MOVE.WALL_JUMP_MAX);
});

test('depois da espera, a mesma parede volta a valer', () => {
  const map = { id: 't', name: 't', boxes: [floor, left], spawns: [] };
  const p = createPlayer({ x: -1 + R, y: 0, z: 0 });
  stepPlayer(p, emptyInput(), map, DT);
  stepPlayer(p, input({ jump: true, jumpPressed: true }), map, DT);
  for (let i = 0; i < 4; i++) stepPlayer(p, emptyInput(), map, DT);
  stepPlayer(p, input({ jump: true, jumpPressed: true }), map, DT);
  assert.ok(has(p, 'wallJump'));
  // Volta a encostar na mesma parede depois da espera (puxando o jogador de volta).
  for (let i = 0; i < MOVE.WALL_JUMP_SAME_WALL_DELAY / DT + 1; i++) {
    p.vel.x = -3;
    stepPlayer(p, emptyInput(), map, DT);
  }
  assert.ok(p.wall && p.wall.age === 0, 'encostado de novo');
  stepPlayer(p, input({ jump: true, jumpPressed: true }), map, DT);
  assert.ok(has(p, 'wallJump'), 'pulou de novo na mesma parede');
});

// Ajuste da revisão: entrar de novo na MESMA parede (sem tocar o chão ou outra parede)
// recarregava pulos na parede e pulo duplo, e dava para escalar sem limite (chegava a 20 m).
const lone = box(2.25, 10, 0, 0.5, 20, 60, T.WALLRUN); // parede ciano sozinha: x de 2 a 2,5
const loneMap = { id: 't', name: 't', boxes: [floor, lone], spawns: [] };

/** Encostado na parede ciano sozinha, segurando W com o olhar `deg` e apertando Espaço a cada `every` passos. */
function spam(deg, every, seconds) {
  const yaw = (deg * Math.PI) / 180;
  const p = createPlayer({ x: 2 - R, y: 0, z: 20, yaw });
  stepPlayer(p, emptyInput(), loneMap, DT);
  let top = 0;
  let paid = 0; // pulos na parede pagos neste voo (pulo na parede ou salto de corrida em parede já usada)
  let doubles = 0;
  const worst = { paid: 0, doubles: 0 };
  for (let i = 0; i < seconds / DT; i++) {
    const press = i % every === 0;
    const repeated = p.wallrun && !p.wallrun.fresh;
    stepPlayer(p, input({ moveZ: 1, yaw, jump: press, jumpPressed: press }), loneMap, DT);
    for (const e of p.events) {
      if (e.type === 'wallJump' || (e.type === 'wallrunJump' && repeated)) paid++;
      if (e.type === 'doubleJump') doubles++;
    }
    top = Math.max(top, p.pos.y);
    if (p.onGround) {
      worst.paid = Math.max(worst.paid, paid);
      worst.doubles = Math.max(worst.doubles, doubles);
      paid = 0;
      doubles = 0;
    }
  }
  return { top, ...worst };
}

test('parede ciano sozinha, W + Espaço sem parar: não passa de ~3,5 m (em qualquer ângulo)', () => {
  // Apertando sem parar (um aperto novo a cada 2 passos), olhando de 0 a 90 graus contra a parede.
  // O teto real é cerca de 3,8 m: pulo do chão, pulos na parede e pulo duplo, todos permitidos.
  for (let deg = 0; deg >= -90; deg -= 5) {
    const { top } = spam(deg, 2, 10);
    assert.ok(top <= 4, `olhando ${deg}°: subiu até ${top.toFixed(2)} m`);
  }
});

test('parede ciano sozinha: em qualquer ritmo, cada voo respeita os limites do GDD', () => {
  // Por voo: no máximo 3 pulos na parede (GDD) e 2 pulos duplos (o do voo e 1 recarga ao
  // correr pela primeira vez naquela parede). Antes da correção chegava a 20 m.
  for (let deg = 0; deg >= -90; deg -= 15) {
    for (const every of [2, 4, 8, 20]) {
      const r = spam(deg, every, 20);
      assert.ok(r.paid <= MOVE.WALL_JUMP_MAX, `${deg}°/${every}: ${r.paid} pulos na parede num voo`);
      assert.ok(r.doubles <= 2 * MOVE.AIR_JUMPS, `${deg}°/${every}: ${r.doubles} pulos duplos num voo`);
      assert.ok(r.top < 7, `${deg}°/${every}: ${r.top.toFixed(2)} m`);
    }
  }
});

test('correr de novo na mesma parede no mesmo voo não recarrega; o salto gasta um pulo na parede', () => {
  const p = createPlayer({ x: 2 - R - 0.3, y: 10, z: 20, yaw: 0 });
  p.vel = { x: 2, y: 0, z: -10 };
  for (let i = 0; i < 30 && !p.wallrun; i++) stepPlayer(p, input({ moveZ: 1, yaw: 0 }), loneMap, DT);
  assert.ok(p.wallrun && p.wallrun.fresh, 'primeira corrida: parede nova');
  // Solta (tecla para longe), se afasta além da memória de parede, gasta o pulo duplo
  // e volta à mesma parede depois da espera.
  stepPlayer(p, input({ moveX: -1, yaw: 0 }), loneMap, DT);
  p.vel.x = -3;
  for (let i = 0; i < 0.2 / DT; i++) stepPlayer(p, emptyInput(), loneMap, DT);
  assert.equal(p.wall, null, 'longe da parede');
  stepPlayer(p, input({ jump: true, jumpPressed: true }), loneMap, DT);
  assert.ok(has(p, 'doubleJump'));
  assert.equal(p.jumpsLeft, 0);
  p.wallJumpsLeft = 1;
  let back = false;
  for (let i = 0; i < 2 / DT && !back; i++) {
    p.vel.x = 2;
    stepPlayer(p, input({ moveZ: 1, yaw: 0 }), loneMap, DT);
    back = !!p.wallrun;
  }
  assert.ok(back, 'voltou a correr na mesma parede');
  assert.equal(p.wallrun.fresh, false);
  assert.equal(p.jumpsLeft, 0, 'não recarregou o pulo duplo');
  assert.equal(p.wallJumpsLeft, 1, 'não recarregou os pulos na parede');
  stepPlayer(p, input({ moveZ: 1, yaw: 0, jump: true, jumpPressed: true }), loneMap, DT);
  assert.ok(has(p, 'wallrunJump'));
  assert.equal(p.wallJumpsLeft, 0, 'o salto gastou um pulo na parede');
});

test('sem pulos na parede numa parede repetida, Espaço só solta da parede (sem impulso)', () => {
  const p = createPlayer({ x: 2 - R - 0.3, y: 10, z: 20, yaw: 0 });
  p.vel = { x: 2, y: 0, z: -10 };
  for (let i = 0; i < 30 && !p.wallrun; i++) stepPlayer(p, input({ moveZ: 1, yaw: 0 }), loneMap, DT);
  p.wallrun.fresh = false; // simula a parede já usada neste voo
  p.wallJumpsLeft = 0;
  p.jumpsLeft = 0;
  const vy = p.vel.y;
  stepPlayer(p, input({ moveZ: 1, yaw: 0, jump: true, jumpPressed: true }), loneMap, DT);
  assert.equal(p.wallrun, null, 'soltou');
  assert.deepEqual(p.events.map((e) => e.type), ['wallrunEnd'], 'sem salto');
  assert.ok(p.vel.y <= vy, 'sem impulso para cima');
});

test('numa parede repetida sem pulos na parede, com pulo duplo disponível, Espaço vira pulo duplo', () => {
  const p = createPlayer({ x: 2 - R - 0.3, y: 10, z: 20, yaw: 0 });
  p.vel = { x: 2, y: 0, z: -10 };
  for (let i = 0; i < 30 && !p.wallrun; i++) stepPlayer(p, input({ moveZ: 1, yaw: 0 }), loneMap, DT);
  p.wallrun.fresh = false;
  p.wallJumpsLeft = 0;
  p.jumpsLeft = 1;
  stepPlayer(p, input({ moveZ: 1, yaw: 0, jump: true, jumpPressed: true }), loneMap, DT);
  assert.deepEqual(p.events.map((e) => e.type), ['wallrunEnd', 'doubleJump']);
});

test('tocar o chão faz a parede voltar a ser nova (recarrega na próxima corrida)', () => {
  const p = createPlayer({ x: 2 - R, y: 0, z: 20, yaw: 0 });
  p.wallsUsed = [lone];
  stepPlayer(p, emptyInput(), loneMap, DT);
  stepPlayer(p, emptyInput(), loneMap, DT);
  assert.deepEqual(p.wallsUsed, []);
});
