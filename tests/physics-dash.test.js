import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PHYSICS, PLAYER, MOVE } from '../shared/constants.js';
import { box, BOX_TYPES as T } from '../shared/maps/format.js';
import { createPlayer, stepPlayer, emptyInput } from '../shared/physics/player.js';
import { startDash, stepDash } from '../shared/physics/dash.js';

const DT = PHYSICS.FIXED_DT;
const R = PLAYER.RADIUS;
const floor = box(0, -0.5, 0, 1000, 1, 1000);
const floorMap = { id: 't', name: 't', boxes: [floor], spawns: [] };
const skyMap = { id: 't', name: 't', boxes: [box(0, -500.5, 0, 1000, 1, 1000)], spawns: [] };
const input = (over = {}) => ({ ...emptyInput(), ...over });
const has = (p, type) => p.events.some((e) => e.type === type);
const speedXZ = (p) => Math.hypot(p.vel.x, p.vel.z);

/** Aperta Shift (com as teclas `over`) e roda até o dash terminar. Devolve se houve dash. */
function dashOnce(p, map, over = {}) {
  stepPlayer(p, input({ dashPressed: true, ...over }), map, DT);
  const did = has(p, 'dash');
  for (let i = 0; i < 40 && p.dash; i++) stepPlayer(p, input(over), map, DT);
  return did;
}

test('3 dashes seguidos funcionam; o 4º não', () => {
  const p = createPlayer({ x: 0, y: 0, z: 0 });
  stepPlayer(p, emptyInput(), floorMap, DT);
  assert.equal(p.dashCharges, MOVE.DASH_CHARGES);
  const results = [dashOnce(p, floorMap), dashOnce(p, floorMap), dashOnce(p, floorMap), dashOnce(p, floorMap)];
  assert.deepEqual(results, [true, true, true, false]);
  assert.equal(p.dashCharges, 0);
});

test('recarrega uma carga depois de 1,2 s', () => {
  // Um dash (3 -> 2 cargas): a carga volta exatamente 1,2 s depois.
  const p = createPlayer({ x: 0, y: 0, z: 0 });
  stepPlayer(p, emptyInput(), floorMap, DT);
  stepPlayer(p, input({ dashPressed: true }), floorMap, DT);
  assert.equal(p.dashCharges, MOVE.DASH_CHARGES - 1);
  let t = DT;
  while (p.dashCharges < MOVE.DASH_CHARGES && t < 3) {
    stepPlayer(p, emptyInput(), floorMap, DT);
    t += DT;
  }
  assert.ok(Math.abs(t - MOVE.DASH_RECHARGE) < 1.5 * DT, `recarregou em ${t.toFixed(3)} s`);
});

test('sem cargas, recarrega uma por vez a cada 1,2 s', () => {
  const p = createPlayer({ x: 0, y: 0, z: 0 });
  stepPlayer(p, emptyInput(), floorMap, DT);
  let t = 0;
  const charges = [];
  for (let k = 0; k < 3; k++) {
    stepPlayer(p, input({ dashPressed: true }), floorMap, DT);
    t += DT;
    while (p.dash) {
      stepPlayer(p, emptyInput(), floorMap, DT);
      t += DT;
    }
  }
  assert.equal(p.dashCharges, 0);
  while (t < 2 * MOVE.DASH_RECHARGE + 0.05) {
    stepPlayer(p, emptyInput(), floorMap, DT);
    t += DT;
    charges.push(p.dashCharges);
  }
  assert.equal(p.dashCharges, 2, 'duas cargas depois de 2 x 1,2 s desde o primeiro dash');
  assert.ok(charges.every((c, n) => n === 0 || c - charges[n - 1] <= 1), 'uma por vez');
});

test('dash no ar não perde altura durante DASH_TIME', () => {
  const p = createPlayer({ x: 0, y: 50, z: 0 });
  p.vel.y = -6; // caindo
  stepPlayer(p, input({ dashPressed: true }), skyMap, DT);
  const y0 = p.pos.y;
  let steps = 1;
  while (p.dash) {
    stepPlayer(p, emptyInput(), skyMap, DT);
    steps++;
    if (p.dash) assert.equal(p.pos.y, y0, 'mesma altura durante o dash');
  }
  assert.ok(Math.abs(steps * DT - MOVE.DASH_TIME) < 2 * DT, `durou ${(steps * DT).toFixed(3)} s`);
  // A queda foi zerada no dash; no passo em que ele termina, a gravidade volta (um passo).
  assert.ok(Math.abs(p.vel.y) <= MOVE.GRAVITY * DT + 1e-9, `vertical ao terminar: ${p.vel.y}`);
});

test('durante o dash: velocidade horizontal fixa na direção das teclas (relativas ao olhar)', () => {
  const p = createPlayer({ x: 0, y: 50, z: 0, yaw: 0 }); // olhando para -z: D (direita) = +x
  stepPlayer(p, input({ moveX: 1, yaw: 0, dashPressed: true }), skyMap, DT);
  assert.equal(p.state, 'dash');
  assert.ok(Math.abs(p.vel.x - MOVE.DASH_SPEED) < 1e-9 && Math.abs(p.vel.z) < 1e-9, `${p.vel.x}, ${p.vel.z}`);
  assert.deepEqual(p.events.find((e) => e.type === 'dash').dir, { x: 1, y: 0, z: 0 });
});

test('sem tecla, o dash vai para a frente do olhar', () => {
  const yaw = Math.PI / 2; // olhando para -x
  const p = createPlayer({ x: 0, y: 50, z: 0, yaw });
  stepPlayer(p, input({ yaw, dashPressed: true }), skyMap, DT);
  assert.ok(Math.abs(p.vel.x + MOVE.DASH_SPEED) < 1e-9, `vel.x ${p.vel.x}`);
});

test('no fim: mantém a maior entre a velocidade de antes e 70% da do dash', () => {
  const slow = createPlayer({ x: 0, y: 50, z: 0 });
  dashOnce(slow, skyMap);
  assert.ok(Math.abs(speedXZ(slow) - MOVE.DASH_SPEED * MOVE.DASH_END_SPEED_KEEP) < 1e-9, `parado antes: ${speedXZ(slow)}`);
  const fast = createPlayer({ x: 0, y: 50, z: 0 });
  fast.vel.z = -25;
  dashOnce(fast, skyMap);
  assert.ok(Math.abs(speedXZ(fast) - 25) < 1e-9, `rápido antes: ${speedXZ(fast)}`);
});

test('dash interrompe a corrida na parede; não acontece no slam', () => {
  const run = box(2.25, 0, 0, 0.5, 600, 400, T.WALLRUN);
  const map = { id: 't', name: 't', boxes: [box(0, -300.5, 0, 400, 1, 400), run], spawns: [] };
  const w = createPlayer({ x: 2 - R - 0.3, y: 10, z: 0, yaw: 0 });
  w.vel = { x: 2, y: 0, z: -10 };
  for (let i = 0; i < 30 && !w.wallrun; i++) stepPlayer(w, input({ moveZ: 1, yaw: 0 }), map, DT);
  assert.ok(w.wallrun);
  stepPlayer(w, input({ moveX: -1, yaw: 0, dashPressed: true }), map, DT);
  assert.ok(has(w, 'wallrunEnd') && has(w, 'dash'));
  assert.equal(w.wallrun, null);

  const s = createPlayer({ x: 0, y: 30, z: 0 });
  stepPlayer(s, input({ crouch: true, crouchPressed: true }), skyMap, DT);
  stepPlayer(s, input({ crouch: true, dashPressed: true }), skyMap, DT);
  assert.equal(has(s, 'dash'), false);
  assert.equal(s.state, 'slam');
  assert.equal(s.dashCharges, MOVE.DASH_CHARGES, 'não gastou carga');
});

test('dash contra a parede para nela (não atravessa)', () => {
  const wall = box(3, 2, 0, 0.3, 4, 10);
  const map = { id: 't', name: 't', boxes: [floor, wall], spawns: [] };
  const p = createPlayer({ x: 0, y: 0, z: 0, yaw: -Math.PI / 2 }); // olhando para +x
  stepPlayer(p, emptyInput(), map, DT);
  dashOnce(p, map, { yaw: -Math.PI / 2 });
  assert.ok(p.pos.x <= wall.min.x - R + 1e-9, `x = ${p.pos.x}`);
});

test('startDash e stepDash funcionam sozinhos (para a F2-12 reaproveitar com a arma)', () => {
  const p = createPlayer({ x: 0, y: 0, z: 0 });
  startDash(p, { x: 0, y: 0, z: 1 }, 10, 3 * DT);
  assert.ok(has(p, 'dash'));
  let n = 0;
  while (stepDash(p, DT)) n++;
  assert.equal(n, 3);
  assert.equal(p.dash, null);
  assert.ok(Math.abs(p.vel.z - 10 * MOVE.DASH_END_SPEED_KEEP) < 1e-9);
});

// Pedido da revisão da F1-14: travar a regra "sem pulo na parede durante o slam".
test('durante o slam, encostado numa parede, Espaço não faz pulo na parede', () => {
  const wall = box(1.25, 0, 0, 0.5, 600, 10); // face em x = 1
  const map = { id: 't', name: 't', boxes: [box(0, -300.5, 0, 400, 1, 400), wall], spawns: [] };
  const p = createPlayer({ x: 1 - R, y: 50, z: 0 }); // encostado na parede, no alto
  stepPlayer(p, emptyInput(), map, DT);
  assert.ok(p.wall && p.wall.age === 0, 'encostado');
  stepPlayer(p, input({ crouch: true, crouchPressed: true }), map, DT);
  assert.equal(p.state, 'slam');
  assert.ok(p.wall && p.wallJumpsLeft > 0, 'parede e pulos na parede disponíveis');
  stepPlayer(p, input({ crouch: true, jump: true, jumpPressed: true }), map, DT);
  assert.equal(has(p, 'wallJump'), false, 'sem pulo na parede no slam');
  assert.equal(p.state, 'slam');
  assert.equal(p.vel.y, -MOVE.SLAM_SPEED);
});

// Pedido da revisão da F1-15: travar a regra "sem pulo do chão durante o dash".
test('durante o dash no chão, Espaço não pula', () => {
  const p = createPlayer({ x: 0, y: 0, z: 0 });
  stepPlayer(p, emptyInput(), floorMap, DT);
  stepPlayer(p, input({ dashPressed: true }), floorMap, DT);
  assert.equal(p.state, 'dash');
  stepPlayer(p, input({ jump: true, jumpPressed: true }), floorMap, DT);
  assert.equal(has(p, 'jump'), false, 'sem pulo durante o dash');
  assert.equal(p.state, 'dash');
  assert.equal(p.vel.y, 0);
});

test('dash no chão continua pisando: sobe degrau baixo durante o arranco', () => {
  const step = box(3, 0.15, 0, 4, 0.3, 4); // degrau de 0,3 m em x de 1 a 5
  const map = { id: 't', name: 't', boxes: [floor, step], spawns: [] };
  const p = createPlayer({ x: 0, y: 0, z: 0, yaw: -Math.PI / 2 }); // olhando para +x
  stepPlayer(p, emptyInput(), map, DT);
  stepPlayer(p, input({ yaw: -Math.PI / 2, dashPressed: true }), map, DT);
  assert.equal(p.onGround, true, 'no chão durante o dash');
  for (let i = 0; i < 10 && p.dash; i++) stepPlayer(p, input({ yaw: -Math.PI / 2 }), map, DT);
  assert.ok(p.pos.x > 1.5, `passou da borda do degrau: x = ${p.pos.x}`);
  assert.ok(Math.abs(p.pos.y - 0.3) < 1e-9, `em cima do degrau: y = ${p.pos.y}`);
});
