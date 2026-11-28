import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PHYSICS } from '../shared/constants.js';
import { box } from '../shared/maps/format.js';
import { CAMERA, HUD } from '../src/config/camera.js';
import {
  createLocalPlayer, fovForSpeed, speedTier, strafeTiltTarget, landDipDepth, resolveFov, FOV_STORAGE_KEY,
} from '../src/player/localPlayer.js';
import { createHud } from '../src/ui/hud.js';

const DT = PHYSICS.FIXED_DT;
const floor = box(0, -0.5, 0, 400, 1, 400);
const keys = (...held) => ({ isDown: (a) => held.includes(a), pressed: () => false });

test('campo de visão: 90 parado, abre com a velocidade e chega a 112 em 30 m/s', () => {
  assert.equal(CAMERA.FOV_BASE, 90);
  assert.equal(CAMERA.FOV_MAX, 112);
  assert.equal(fovForSpeed(0), 90);
  assert.equal(fovForSpeed(15), 101);
  assert.equal(fovForSpeed(30), 112);
  assert.equal(fovForSpeed(45), 112, 'não passa do máximo');
  assert.equal(fovForSpeed(30, 100), 122, 'com ?fov=100, abre o mesmo tanto');
});

test('campo de visão do jogador acompanha a velocidade suavemente', () => {
  const map = { id: 't', name: 't', boxes: [floor], spawns: [{ x: 0, y: 0, z: 0, yaw: 0 }] };
  const me = createLocalPlayer({ map });
  me.step(keys(), DT);
  me.eye(1, 1 / 60);
  assert.equal(me.fov, 90);
  me.player.vel.x = 30;
  me.eye(1, 1 / 60);
  assert.ok(me.fov > 90 && me.fov < 112, `suave: ${me.fov}`);
  for (let i = 0; i < 120; i++) me.eye(1, 1 / 60);
  assert.equal(me.fov, 112);
});

test('velocímetro: cor muda acima de 15 e de 25 m/s', () => {
  assert.equal(speedTier(10), 0);
  assert.equal(speedTier(15), 0);
  assert.equal(speedTier(15.1), 1);
  assert.equal(speedTier(25.1), 2);
  const els = [];
  const fakeDoc = {
    createElement: () => {
      const e = { style: {}, textContent: '', append(...c) { this.children = c; } };
      els.push(e);
      return e;
    },
    body: { appendChild() {} },
  };
  const hud = createHud({ doc: fakeDoc });
  hud.update(9.4);
  assert.equal(hud.text, '9');
  assert.equal(hud.el.style.color, HUD.SPEED_COLORS[0]);
  hud.update(18);
  assert.equal(hud.el.style.color, HUD.SPEED_COLORS[1]);
  hud.update(31.6);
  assert.equal(hud.text, '32');
  assert.equal(hud.el.style.color, HUD.SPEED_COLORS[2]);
});

test('inclinação ao andar de lado no chão: ±1,5 graus; no ar ou deslizando, não', () => {
  const ground = { onGround: true, sliding: false };
  assert.ok(Math.abs(strafeTiltTarget(ground, 1) + CAMERA.STRAFE_TILT) < 1e-12, 'D: inclina para a direita');
  assert.ok(Math.abs(strafeTiltTarget(ground, -1) - CAMERA.STRAFE_TILT) < 1e-12, 'A: para a esquerda');
  assert.equal(strafeTiltTarget(ground, 0), 0);
  assert.equal(strafeTiltTarget({ onGround: false, sliding: false }, 1), 0);
  assert.equal(strafeTiltTarget({ onGround: true, sliding: true }, 1), 0);
  assert.ok(Math.abs(CAMERA.STRAFE_TILT - (1.5 * Math.PI) / 180) < 1e-12);
  // No jogador: andando com D no chão, a câmera inclina.
  const map = { id: 't', name: 't', boxes: [floor], spawns: [{ x: 0, y: 0, z: 0, yaw: 0 }] };
  const me = createLocalPlayer({ map });
  me.step(keys(), DT);
  for (let i = 0; i < 30; i++) {
    me.step(keys('right'), DT);
    me.eye(1, 1 / 60);
  }
  assert.ok(me.roll < 0 && me.roll >= -CAMERA.STRAFE_TILT - 1e-9, `roll ${me.roll}`);
});

test('afundamento ao pousar: só de mais de 3 m, maior quanto maior a queda', () => {
  assert.equal(landDipDepth(2.9), 0);
  assert.equal(landDipDepth(3), 0);
  assert.ok(landDipDepth(5) > 0);
  assert.ok(landDipDepth(8) > landDipDepth(5));
  assert.equal(landDipDepth(30), CAMERA.LAND_DIP_DEPTH);
  const fall = (h) => {
    const map = { id: 't', name: 't', boxes: [floor], spawns: [{ x: 0, y: h, z: 0, yaw: 0 }] };
    const me = createLocalPlayer({ map });
    for (let i = 0; i < 3 / DT && !me.player.onGround; i++) me.step(keys(), DT);
    me.eye(1, CAMERA.LAND_DIP_TIME / 2); // meio do afundamento
    return me.landDip;
  };
  assert.equal(fall(2), 0, 'pulo comum: sem afundamento');
  assert.ok(fall(6) > 0.01, `queda de 6 m: ${fall(6)}`);
});

test('?fov= muda o campo de visão base e fica salvo; valores fora da faixa são ignorados', () => {
  const data = new Map();
  const storage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
  assert.equal(resolveFov('', storage), 90);
  assert.equal(resolveFov('?fov=100', storage), 100);
  assert.equal(data.get(FOV_STORAGE_KEY), '100');
  assert.equal(resolveFov('', storage), 100, 'lembra');
  assert.equal(resolveFov('?fov=10', storage), 100, 'fora da faixa');
  assert.equal(resolveFov('?fov=abc', null), 90);
  const broken = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
  assert.equal(resolveFov('?fov=95', broken), 95);
});
