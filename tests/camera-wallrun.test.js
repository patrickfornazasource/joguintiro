// Bug relatado pelo dono: "quando uso a corrida na parede, a câmera fica travada, e depois de sair
// também". Estes testes travam o comportamento certo: o mouse gira a câmera durante a corrida na
// parede e depois de cada jeito de sair dela (pulo, fim do tempo, soltar e cair, pulo na parede).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PHYSICS, VIEW, MOVE } from '../shared/constants.js';
import { box, BOX_TYPES as T } from '../shared/maps/format.js';
import { getMap } from '../shared/maps/index.js';
import { createLocalPlayer } from '../src/player/localPlayer.js';

const DT = PHYSICS.FIXED_DT;
const FRAME = 1 / 60;
// Chão grande e uma parede de corrida longa à esquerda de quem vai para -z (face em x = -1).
const longWall = box(-1.25, 4, -50, 0.5, 8, 140, T.WALLRUN); // z de -120 a 20
const map = {
  id: 't',
  name: 't',
  boxes: [box(0, -0.5, -60, 60, 1, 160), longWall],
  spawns: [{ x: -0.5, y: 0, z: 10, yaw: 0 }],
};
// Poço estreito (2 m) para pulos na parede.
const shaft = {
  id: 't2',
  name: 't2',
  boxes: [box(0, -0.5, 0, 40, 1, 40), box(-1.25, 10, 0, 0.5, 20, 6), box(1.25, 10, 0, 0.5, 20, 6)],
  spawns: [{ x: -0.6, y: 0, z: 0, yaw: 0 }],
};

const keys = (held, pressed = []) => ({ isDown: (a) => held.includes(a), pressed: (a) => pressed.includes(a) });

/** Mexe o mouse (como o jogo faz a cada quadro) e diz quanto o olhar mudou. */
function turn(me, dx, dy) {
  const before = { yaw: me.yaw, pitch: me.pitch };
  me.look(dx, dy);
  me.eye(1, FRAME);
  return { yaw: me.yaw - before.yaw, pitch: me.pitch - before.pitch };
}

/** O mouse gira a câmera exatamente na proporção da sensibilidade. */
function assertTurns(me, label) {
  const d = turn(me, 50, -20);
  assert.ok(Math.abs(d.yaw - -50 * me.sensitivity) < 1e-12, `${label}: girou para os lados (${d.yaw})`);
  assert.ok(Math.abs(d.pitch - 20 * me.sensitivity) < 1e-12, `${label}: olhou para cima (${d.pitch})`);
  turn(me, -50, 20); // volta o olhar
}

/** Corre e pula na parede longa; devolve o jogador já correndo nela. */
function startWallrun(height = 0) {
  const me = createLocalPlayer({ map });
  me.player.vel = { x: 0, y: 0, z: -11 };
  me.step(keys(['forward'], ['jump']), DT);
  me.player.pos.y += height; // mais alto: a corrida dura o tempo todo sem chegar ao chão
  // Puxa para a parede perto do alto do pulo (grudar logo no começo deixaria a corrida baixa).
  for (let i = 0; i < 160 && !me.player.wallrun; i++) {
    if (i === 30) me.player.vel.x = -2; // desvia para a parede (como quem pulou de lado)
    me.step(keys(i > 30 ? ['forward', 'left'] : ['forward']), DT);
    me.eye(1, DT);
  }
  assert.ok(me.player.wallrun, 'entrou na corrida na parede');
  return me;
}

/** Dá alguns quadros e confere que a inclinação da câmera voltou a zero fora da parede. */
function settle(me, held = ['forward']) {
  for (let i = 0; i < 240; i++) {
    me.step(keys(held), DT);
    me.eye(1, DT);
  }
}

test('câmera gira durante a corrida na parede (a cada quadro, várias vezes)', () => {
  const me = startWallrun();
  for (let i = 0; i < 30 && me.player.wallrun; i++) {
    me.step(keys(['forward', 'left']), DT);
    assertTurns(me, `quadro ${i}`);
  }
  assert.ok(me.player.wallrun, 'ainda na parede');
  assert.ok(Math.abs(me.roll) > 0, 'a câmera inclina na parede');
});

test('câmera gira depois de sair da parede pulando', () => {
  const me = startWallrun();
  for (let i = 0; i < 20; i++) me.step(keys(['forward', 'left']), DT);
  me.step(keys(['forward'], ['jump']), DT);
  assert.ok(me.player.events.some((e) => e.type === 'wallrunJump'), 'pulou da parede');
  assertTurns(me, 'logo depois do pulo');
  settle(me, []);
  assertTurns(me, 'depois de pousar');
  assert.ok(Math.abs(me.roll) < 1e-3, `inclinação voltou a zero: ${me.roll}`);
});

test('câmera gira depois de a corrida acabar pelo tempo máximo', () => {
  const me = startWallrun(5);
  let t = 0;
  while (me.player.wallrun && t < 3) {
    me.step(keys(['forward', 'left']), DT);
    me.eye(1, DT);
    t += DT;
  }
  assert.equal(me.player.wallrun, null);
  assert.ok(t >= MOVE.WALLRUN_MAX_TIME - 0.1, `acabou pelo tempo (${t.toFixed(2)} s)`);
  assertTurns(me, 'logo depois do fim');
  settle(me, ['forward']); // (A segurado no chão inclina 1,5° de propósito: solta o A)
  assertTurns(me, 'no chão depois');
  assert.ok(Math.abs(me.roll) < 1e-3, `inclinação voltou a zero: ${me.roll}`);
});

test('câmera gira depois de soltar da parede e cair', () => {
  const me = startWallrun();
  for (let i = 0; i < 10; i++) me.step(keys(['forward', 'left']), DT);
  me.step(keys(['right']), DT); // puxa para longe da parede: solta
  assert.equal(me.player.wallrun, null, 'soltou');
  assertTurns(me, 'caindo');
  settle(me, []);
  assert.equal(me.player.onGround, true);
  assertTurns(me, 'no chão');
  assert.ok(Math.abs(me.roll) < 1e-3, `inclinação voltou a zero: ${me.roll}`);
});

test('câmera gira durante e depois de pulos na parede (poço estreito)', () => {
  const me = createLocalPlayer({ map: shaft });
  me.step(keys([], ['jump']), DT);
  let wallJumps = 0;
  for (let i = 0; i < 240; i++) {
    const press = i % 24 === 12;
    me.step(keys(['left'], press ? ['jump'] : []), DT);
    if (me.player.events.some((e) => e.type === 'wallJump')) wallJumps++;
    if (i % 6 === 0) assertTurns(me, `passo ${i}`);
  }
  assert.ok(wallJumps >= 1, `pulos na parede: ${wallJumps}`);
  settle(me, []);
  assertTurns(me, 'no chão');
});

test('no corredor do Sandbox (o do relato): gira durante e depois, e a inclinação some', () => {
  const sandbox = getMap('sandbox');
  const me = createLocalPlayer({ map: sandbox });
  me.player.pos = { x: -23.5, y: 3, z: 6 };
  me.player.vel = { x: 0, y: 0, z: -11 };
  me.step(keys(['forward'], ['jump']), DT);
  let ran = false;
  for (let i = 0; i < 300; i++) {
    me.step(keys(i > 30 ? ['forward', 'left'] : ['forward']), DT);
    if (me.player.wallrun) {
      ran = true;
      assertTurns(me, `na parede, passo ${i}`);
    }
  }
  assert.ok(ran, 'correu na parede do corredor');
  settle(me, []);
  assertTurns(me, 'depois');
  assert.ok(Math.abs(me.roll) < 1e-3, `inclinação voltou a zero: ${me.roll}`);
  assert.ok(Math.abs(me.pitch) <= VIEW.MAX_PITCH);
});
