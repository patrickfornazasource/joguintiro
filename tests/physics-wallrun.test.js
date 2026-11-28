import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PHYSICS, PLAYER, MOVE } from '../shared/constants.js';
import { box, BOX_TYPES as T, validateMap } from '../shared/maps/format.js';
import { sandbox, WALLRUN_CORRIDOR as C } from '../shared/maps/sandbox.js';
import { createPlayer, stepPlayer, emptyInput } from '../shared/physics/player.js';
import { updateWall } from '../shared/physics/walls.js';

const DT = PHYSICS.FIXED_DT;
const R = PLAYER.RADIUS;
const input = (over = {}) => ({ ...emptyInput(), ...over });
const has = (p, type) => p.events.some((e) => e.type === type);
const speedXZ = (p) => Math.hypot(p.vel.x, p.vel.z);

// Parede de corrida longa em x de 2 a 2,5 (face em x = 2), bem alta; chão bem abaixo.
const longWall = box(2.25, 0, 0, 0.5, 60, 400, T.WALLRUN);
const solidWall = box(2.25, 0, 0, 0.5, 60, 400, T.SOLID);
const deepFloor = box(0, -60.5, 0, 400, 1, 400);
const mapWith = (...boxes) => ({ id: 't', name: 't', boxes: [deepFloor, ...boxes], spawns: [] });

/** No ar a 10 m de altura, perto da parede em +x, correndo em -z a `speed` e indo um pouco para a parede. */
function nearWall(speed = 10, map = mapWith(longWall)) {
  const p = createPlayer({ x: 2 - R - 0.3, y: 10, z: 0, yaw: 0 });
  p.vel = { x: 2, y: 0, z: -speed };
  for (let i = 0; i < 30 && !p.wallrun; i++) stepPlayer(p, input({ moveZ: 1, yaw: 0 }), map, DT);
  return p;
}

test('corredor do Sandbox: entradas roteirizadas atravessam as 4 paredes sem tocar o chão', () => {
  assert.deepEqual(validateMap(sandbox).errors, []);
  const p = createPlayer({ x: C.start.x, y: C.height, z: C.start.z, yaw: 0 });
  stepPlayer(p, emptyInput(), sandbox, DT);
  assert.equal(p.onGround, true, 'em cima da plataforma de partida');
  p.vel = { x: -1.5, y: 0, z: -12 }; // correndo para o corredor, puxando para a parede da esquerda

  const starts = [];
  let touchedFloor = false;
  for (let i = 0; i < 6 / DT; i++) {
    let inp = input({ moveZ: 1, yaw: 0, jumpPressed: i === 0, jump: i === 0 });
    if (p.wallrun) {
      // Roteiro simples: pula para a próxima parede 0,05 s depois de grudar na atual.
      // Na última, não pula: corre até o fim dela e cai na plataforma de chegada, logo à frente.
      if (p.wallrun.time > 0.05 && starts.length < C.walls.length) inp = input({ moveZ: 1, yaw: 0, jumpPressed: true, jump: true });
    }
    stepPlayer(p, inp, sandbox, DT);
    if (has(p, 'wallrunStart')) starts.push(p.pos.z.toFixed(1));
    if (p.onGround && p.pos.y < 1) touchedFloor = true;
    if (p.onGround && p.pos.z < C.endZ) break;
  }
  assert.equal(starts.length, 4, `correu em ${starts.length} paredes (entradas em z = ${starts.join(', ')})`);
  // Cada entrada com folga antes da ponta final da parede (não "raspando" no fim).
  starts.forEach((z, k) => {
    const farEnd = C.walls[k].z - C.wallLength / 2;
    assert.ok(Number(z) > farEnd + 2, `parede ${k + 1}: entrou em z = ${z} (fim em ${farEnd})`);
  });
  assert.equal(touchedFloor, false, 'não tocou o chão (o fosso)');
  assert.equal(p.onGround, true);
  assert.ok(p.pos.z < C.endZ && Math.abs(p.pos.y - C.height) < 1e-9, `chegou na plataforma final: ${p.pos.z}, ${p.pos.y}`);
});

test('entra na corrida: estado, evento, sem subir nem cair, e recarrega o pulo duplo', () => {
  const map = mapWith(longWall);
  const p = createPlayer({ x: 2 - R - 0.3, y: 10, z: 0, yaw: 0 });
  p.vel = { x: 2, y: 3, z: -10 };
  p.jumpsLeft = 0;
  let started = false;
  for (let i = 0; i < 30 && !started; i++) {
    stepPlayer(p, input({ moveZ: 1, yaw: 0 }), map, DT);
    started = has(p, 'wallrunStart');
  }
  assert.ok(started);
  assert.equal(p.state, 'wallrun');
  assert.equal(p.jumpsLeft, MOVE.AIR_JUMPS, 'pulo duplo recarregado');
  assert.ok(Math.abs(p.vel.y) < 1, `vertical perto de zero: ${p.vel.y}`);
});

test('gravidade reduzida: em 1 s cai bem menos que em queda livre', () => {
  const p = nearWall();
  assert.ok(p.wallrun);
  const y0 = p.pos.y;
  for (let i = 0; i < 1 / DT; i++) stepPlayer(p, input({ moveZ: 1, yaw: 0 }), mapWith(longWall), DT);
  assert.ok(p.wallrun, 'ainda correndo');
  const fall = y0 - p.pos.y;
  const expected = 0.5 * MOVE.GRAVITY * MOVE.WALLRUN_GRAVITY_SCALE;
  assert.ok(Math.abs(fall - expected) < 0.1, `caiu ${fall.toFixed(3)} m (esperado ~${expected.toFixed(3)}; livre seria 12)`);
});

test('ganha velocidade ao longo da parede até WALLRUN_MAX_SPEED', () => {
  const p = nearWall(10);
  const v0 = speedXZ(p);
  for (let i = 0; i < 1 / DT; i++) stepPlayer(p, input({ moveZ: 1, yaw: 0 }), mapWith(longWall), DT);
  const along = Math.abs(p.vel.z);
  assert.ok(Math.abs(along - (v0 + MOVE.WALLRUN_ACCEL * 1)) < 0.1, `de ${v0.toFixed(2)} para ${along.toFixed(2)}`);
  const fast = nearWall(15.5);
  for (let i = 0; i < 1 / DT && fast.wallrun; i++) stepPlayer(fast, input({ moveZ: 1, yaw: 0 }), mapWith(longWall), DT);
  assert.ok(Math.abs(fast.vel.z) <= MOVE.WALLRUN_MAX_SPEED + 1e-9, `máximo: ${Math.abs(fast.vel.z)}`);
});

test('dura no máximo WALLRUN_MAX_TIME', () => {
  const p = nearWall();
  let t = 0;
  while (p.wallrun && t < 5) {
    stepPlayer(p, input({ moveZ: 1, yaw: 0 }), mapWith(longWall), DT);
    t += DT;
  }
  assert.ok(Math.abs(t - MOVE.WALLRUN_MAX_TIME) < 2 * DT, `durou ${t.toFixed(3)} s`);
  assert.ok(has(p, 'wallrunEnd'));
});

test('pular sai em diagonal: para fora e para cima, mantendo a velocidade ao longo da parede', () => {
  const p = nearWall(10);
  stepPlayer(p, input({ moveZ: 1, yaw: 0 }), mapWith(longWall), DT);
  const along = p.vel.z;
  stepPlayer(p, input({ moveZ: 1, yaw: 0, jump: true, jumpPressed: true }), mapWith(longWall), DT);
  assert.ok(has(p, 'wallrunJump') && has(p, 'wallrunEnd'));
  assert.equal(p.wallrun, null);
  assert.ok(Math.abs(p.vel.x + MOVE.WALLRUN_JUMP_OUT) < 1e-9, `para fora: ${p.vel.x}`);
  assert.ok(Math.abs(p.vel.z - along) < 1e-9, 'ao longo da parede igual');
  assert.ok(p.vel.y > MOVE.WALLRUN_JUMP_UP - 0.3, `para cima: ${p.vel.y}`);
  assert.equal(p.jumpsLeft, MOVE.AIR_JUMPS, 'ainda tem o pulo duplo');
});

test('não entra: parede comum, devagar, de frente ou no chão', () => {
  assert.equal(nearWall(10, mapWith(solidWall)).wallrun, null, 'parede comum (solid)');
  assert.equal(nearWall(MOVE.WALLRUN_MIN_SPEED - 1).wallrun, null, 'devagar');
  const headOn = createPlayer({ x: 2 - R - 0.3, y: 10, z: 0, yaw: -Math.PI / 2 });
  headOn.vel = { x: 12, y: 0, z: 0 };
  for (let i = 0; i < 30; i++) stepPlayer(headOn, input(), mapWith(longWall), DT);
  assert.equal(headOn.wallrun, null, 'de frente para a parede');
  const ground = createPlayer({ x: 2 - R, y: 0, z: 0, yaw: 0 });
  const map = { id: 't', name: 't', boxes: [box(0, -0.5, 0, 400, 1, 400), longWall], spawns: [] };
  stepPlayer(ground, input(), map, DT);
  for (let i = 0; i < 30; i++) stepPlayer(ground, input({ moveZ: 1, yaw: 0 }), map, DT);
  assert.equal(ground.wallrun, null, 'andando no chão');
});

test('sai ao apertar a tecla para longe da parede', () => {
  const p = nearWall();
  stepPlayer(p, input({ moveX: -1, yaw: 0 }), mapWith(longWall), DT); // A = para longe da parede em +x
  assert.equal(p.wallrun, null);
  assert.ok(has(p, 'wallrunEnd'));
});

test('sai no fim da parede', () => {
  const short = box(2.25, 0, -3, 0.5, 60, 6, T.WALLRUN); // z de -6 a 0
  const map = mapWith(short);
  const p = createPlayer({ x: 2 - R - 0.3, y: 10, z: 0.5, yaw: 0 });
  p.vel = { x: 2, y: 0, z: -10 };
  let ran = false;
  for (let i = 0; i < 1.5 / DT; i++) {
    stepPlayer(p, input({ moveZ: 1, yaw: 0 }), map, DT);
    ran ||= !!p.wallrun;
  }
  assert.ok(ran, 'correu');
  assert.equal(p.wallrun, null, 'saiu depois do fim');
  assert.ok(p.pos.z < -6, `passou do fim: ${p.pos.z}`);
});

test('não volta a correr na mesma parede antes do tempo de espera; outra parede pode na hora', () => {
  const map = mapWith(longWall);
  const p = nearWall(10, map);
  stepPlayer(p, input({ moveX: -1, yaw: 0 }), map, DT); // solta
  assert.equal(p.wallrun, null);
  // volta a encostar logo em seguida, indo para a parede
  p.vel.x = 3;
  let reentered = 0;
  let t = 0;
  for (; t < MOVE.WALLRUN_REATTACH_DELAY - 2 * DT; t += DT) {
    stepPlayer(p, input({ moveZ: 1, yaw: 0 }), map, DT);
    if (p.wallrun) reentered++;
  }
  assert.equal(reentered, 0, 'mesma parede: ainda não');
  for (let i = 0; i < 10 && !p.wallrun; i++) stepPlayer(p, input({ moveZ: 1, yaw: 0 }), map, DT);
  assert.ok(p.wallrun, 'depois do tempo de espera, volta');

  // Outra parede (do outro lado) pode na hora.
  const other = box(-2.25, 0, 0, 0.5, 60, 400, T.WALLRUN);
  const two = mapWith(longWall, other);
  const q = nearWall(10, two);
  stepPlayer(q, input({ moveX: -1, yaw: 0 }), two, DT); // solta da parede em +x
  q.pos.x = -2 + R + 0.1; // leva para perto da outra parede
  q.vel.x = -3;
  for (let i = 0; i < 10 && !q.wallrun; i++) stepPlayer(q, input({ moveZ: 1, yaw: 0 }), two, DT);
  assert.ok(q.wallrun, 'parede diferente: entra na hora');
  assert.equal(q.wallrun.box, other);
});

test('parede lembrada: o lado é recalculado com o olhar atual (nota da revisão da F1-11)', () => {
  const map = mapWith(longWall);
  const p = createPlayer({ x: 2 - R - 0.05, y: 10, z: 0, yaw: 0 });
  updateWall(p, map, DT);
  assert.equal(p.wall.side, 'right');
  p.pos.x -= 1; // desencosta
  p.yaw = Math.PI; // vira para trás
  updateWall(p, map, DT);
  assert.ok(p.wall.age > 0, 'é lembrança');
  assert.equal(p.wall.side, 'left', 'lado de acordo com o olhar atual');
  assert.deepEqual(p.wall.normal, { x: -1, y: 0, z: 0 });
});

test('parede longa (200 m): no máximo 1,5 s seguidos na mesma parede', () => {
  // Ajuste da revisão: antes, saindo aos 1,5 s, a "cola" mantinha o contato e a corrida
  // recomeçava na mesma parede 0,3 s depois (3 entradas, 4,5 s na parede).
  const wall200 = box(2.25, 0, 0, 0.5, 60, 200, T.WALLRUN);
  const map = mapWith(wall200);
  const p = createPlayer({ x: 2 - R - 0.3, y: 30, z: 90, yaw: 0 });
  p.vel = { x: 2, y: 0, z: -12 };
  let starts = 0;
  let onWall = 0;
  let longest = 0;
  let current = 0;
  for (let i = 0; i < 6 / DT; i++) {
    stepPlayer(p, input({ moveZ: 1, yaw: 0 }), map, DT); // só segurando W
    if (has(p, 'wallrunStart')) starts++;
    if (p.wallrun) {
      onWall += DT;
      current += DT;
      longest = Math.max(longest, current);
    } else current = 0;
  }
  assert.equal(starts, 1, `entradas na mesma parede: ${starts}`);
  assert.ok(onWall <= MOVE.WALLRUN_MAX_TIME + DT, `tempo na parede: ${onWall.toFixed(2)} s`);
  assert.ok(longest <= MOVE.WALLRUN_MAX_TIME + DT);
});

test('depois de esgotar o tempo, a mesma parede volta a valer ao tocar o chão', () => {
  const wall200 = box(2.25, 0, 0, 0.5, 60, 200, T.WALLRUN);
  const map = { id: 't', name: 't', boxes: [box(0, -0.5, 0, 400, 1, 400), wall200], spawns: [] };
  const p = createPlayer({ x: 2 - R - 0.3, y: 6, z: 90, yaw: 0 });
  p.vel = { x: 2, y: 0, z: -12 };
  for (let i = 0; i < 2 / DT && !(p.wallrunLast && p.wallrunLast.exhausted); i++) stepPlayer(p, input({ moveZ: 1, yaw: 0 }), map, DT);
  assert.ok(p.wallrunLast.exhausted, 'esgotou o tempo');
  for (let i = 0; i < 3 / DT && !p.onGround; i++) stepPlayer(p, input({ moveZ: 1, yaw: 0 }), map, DT);
  assert.equal(p.onGround, true, 'tocou o chão');
  stepPlayer(p, input({ moveZ: 1, yaw: 0 }), map, DT);
  assert.equal(p.wallrunLast.exhausted, false, 'liberada');
  // pula de novo, encostado e correndo: volta a grudar
  p.vel.z = -12;
  stepPlayer(p, input({ moveZ: 1, yaw: 0, jump: true, jumpPressed: true }), map, DT);
  let again = false;
  for (let i = 0; i < 30 && !again; i++) {
    stepPlayer(p, input({ moveZ: 1, yaw: 0 }), map, DT);
    again = !!p.wallrun;
  }
  assert.ok(again, 'grudou de novo na mesma parede');
});

test('depois de esgotar o tempo, grudar em outra parede vale na hora (e libera a primeira)', () => {
  const a = box(2.25, 0, 0, 0.5, 60, 200, T.WALLRUN);
  const b = box(-2.25, 0, 0, 0.5, 60, 200, T.WALLRUN);
  const map = mapWith(a, b);
  const p = createPlayer({ x: 2 - R - 0.3, y: 30, z: 90, yaw: 0 });
  p.vel = { x: 2, y: 0, z: -12 };
  for (let i = 0; i < 2 / DT && !(p.wallrunLast && p.wallrunLast.exhausted); i++) stepPlayer(p, input({ moveZ: 1, yaw: 0 }), map, DT);
  assert.ok(p.wallrunLast.exhausted);
  p.pos.x = -2 + R + 0.1; // leva para perto da outra parede
  p.vel.x = -3;
  for (let i = 0; i < 10 && !p.wallrun; i++) stepPlayer(p, input({ moveZ: 1, yaw: 0 }), map, DT);
  assert.ok(p.wallrun, 'outra parede: grudou');
  assert.equal(p.wallrun.box, b);
  assert.equal(p.wallrunLast, null, 'a primeira foi liberada');
});

test('bater na ponta estreita de uma parede fina não vira corrida na parede (F1-13)', () => {
  // Parede de 0,5 m de espessura ao longo de z; a "ponta" é a face de 0,5 m em z = 4.
  const thin = box(0, 0, 0, 0.5, 60, 8, T.WALLRUN); // x de -0,25 a 0,25; z de -4 a 4
  const map = mapWith(thin);
  // Vindo de +z direto na ponta, deslizando de lado (em +x) rápido.
  const p = createPlayer({ x: 0, y: 10, z: 4 + R + 0.2, yaw: 0 });
  p.vel = { x: 8, y: 0, z: -6 };
  let ranOnTip = false;
  for (let i = 0; i < 20; i++) {
    stepPlayer(p, input({ moveZ: 1, yaw: 0 }), map, DT);
    ranOnTip ||= !!p.wallrun;
  }
  assert.equal(ranOnTip, false, 'não correu na ponta em nenhum momento');
  // Na face longa da mesma parede, corre normalmente.
  const q = createPlayer({ x: 0.25 + R + 0.2, y: 10, z: 2, yaw: 0 });
  q.vel = { x: -2, y: 0, z: -10 };
  let ran = false;
  for (let i = 0; i < 20 && !ran; i++) {
    stepPlayer(q, input({ moveZ: 1, yaw: 0 }), map, DT);
    ran = !!q.wallrun;
  }
  assert.ok(ran, 'na face longa corre');
});
