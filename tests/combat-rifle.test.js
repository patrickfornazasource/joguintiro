// F2-02: Rifle Cinético (GDD seções 3 e 6).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WEAPONS, MOVE, PHYSICS, PLAYER } from '../shared/constants.js';
import { box } from '../shared/maps/format.js';
import { createPlayer, stepPlayer, emptyInput } from '../shared/physics/player.js';
import { createCharge } from '../shared/combat/charge.js';
import { castRay, rayBox } from '../shared/combat/hitscan.js';
import { createWeapon, stepWeapon, fireWeapon, fireRifle, speedDamageMultiplier, rifleDamage, aimDir } from '../shared/combat/weapons.js';
import { createLocalPlayer } from '../src/player/localPlayer.js';
import { getMap } from '../shared/maps/index.js';

const DT = PHYSICS.FIXED_DT;
const floor = box(0, -0.5, 0, 400, 1, 400);
const FWD = { x: 0, y: 0, z: -1 }; // mira para -z
/** Alvo simples (corpo do tamanho do jogador), com vida. */
const target = (x, z, health = 100) => ({ pos: { x, y: 0, z }, height: PLAYER.HEIGHT, radius: PLAYER.RADIUS, health });

function shooter({ speed = 0, charge = 100 } = {}) {
  const player = createPlayer({ x: 0, y: 0, z: 0 });
  player.vel = { x: 0, y: 0, z: -speed };
  const c = createCharge();
  c.value = charge;
  return { player, charge: c, weapon: createWeapon('rifle') };
}
const aim = (dir = FWD) => ({ origin: { x: 0, y: PLAYER.EYE_HEIGHT, z: 0 }, dir });

test('raio: acerta a caixa certa e devolve a distância', () => {
  const b = box(0, 1, -10, 2, 2, 2); // face em z = -9
  assert.ok(Math.abs(rayBox({ x: 0, y: 1, z: 0 }, FWD, b, 100) - 9) < 1e-9);
  assert.equal(rayBox({ x: 5, y: 1, z: 0 }, FWD, b, 100), null, 'passa ao lado');
  assert.equal(rayBox({ x: 0, y: 1, z: 0 }, FWD, b, 5), null, 'fora do alcance');
});

test('acerta a primeira coisa no caminho: parede na frente do alvo bloqueia o tiro', () => {
  const s = shooter();
  const t = target(0, -20);
  const wall = box(0, 2, -10, 6, 4, 0.5);
  const r1 = fireRifle(s, aim(), { map: { boxes: [floor, wall] }, targets: [t] });
  assert.equal(r1.hit, 'box');
  assert.equal(t.health, 100, 'o alvo atrás da parede não leva dano');
  assert.ok(Math.abs(r1.point.z - -9.75) < 1e-9, `parou na parede: ${r1.point.z}`);
  const s2 = shooter();
  const r2 = fireRifle(s2, aim(), { map: { boxes: [floor] }, targets: [t] });
  assert.equal(r2.hit, 'target');
  assert.equal(t.health, 100 - WEAPONS.RIFLE_DAMAGE, 'sem parede, acerta o alvo');
  // O alvo mais perto leva o tiro; o de trás não.
  const near = target(0, -8);
  const far = target(0, -16);
  fireRifle(shooter(), aim(), { map: { boxes: [floor] }, targets: [far, near] });
  assert.equal(near.health, 80);
  assert.equal(far.health, 100);
});

test('gasta RIFLE_COST; sem Carga suficiente não atira (evento dryFire)', () => {
  const s = shooter({ charge: 25 });
  assert.equal(fireRifle(s, aim()).fired, true);
  assert.equal(s.charge.value, 25 - WEAPONS.RIFLE_COST);
  assert.ok(s.player.events.some((e) => e.type === 'shot'));
  const poor = shooter({ charge: WEAPONS.RIFLE_COST - 1 });
  const r = fireRifle(poor, aim());
  assert.equal(r.fired, false);
  assert.equal(r.reason, 'noCharge');
  assert.equal(poor.charge.value, WEAPONS.RIFLE_COST - 1, 'não gastou nada');
  assert.ok(poor.player.events.some((e) => e.type === 'dryFire'));
  assert.ok(!poor.player.events.some((e) => e.type === 'shot'));
});

test('cadência: um tiro a cada RIFLE_FIRE_INTERVAL', () => {
  const s = shooter();
  let shots = 0;
  for (let i = 0; i < 1 / DT; i++) {
    stepWeapon(s.weapon, DT);
    if (fireWeapon(s, aim()).fired) shots++;
  }
  assert.equal(shots, Math.round(1 / WEAPONS.RIFLE_FIRE_INTERVAL), `tiros em 1 s: ${shots}`);
  const s2 = shooter();
  assert.equal(fireRifle(s2, aim()).fired, true);
  assert.equal(fireRifle(s2, aim()).reason, 'cooldown', 'logo em seguida, espera');
});

test('dano pela velocidade: 1x até andar, sobe em linha reta, 3x em 30 m/s e TRAVA acima (45 m/s = 3x)', () => {
  const m = (v) => speedDamageMultiplier(v, WEAPONS.RIFLE_SPEED_MULT_MAX);
  assert.equal(m(0), 1);
  assert.equal(m(MOVE.WALK_SPEED), 1, 'a 9 m/s');
  const at20 = 1 + (WEAPONS.RIFLE_SPEED_MULT_MAX - 1) * ((20 - MOVE.WALK_SPEED) / (WEAPONS.DAMAGE_SPEED_FULL - MOVE.WALK_SPEED));
  assert.ok(Math.abs(m(20) - at20) < 1e-9, `a 20 m/s: ${m(20)}`);
  assert.equal(m(30), 3, 'a 30 m/s');
  assert.equal(m(45), 3, 'a 45 m/s (teto de velocidade): continua 3x');
  assert.equal(m(MOVE.MAX_SPEED), 3);
  assert.equal(rifleDamage(0), 20);
  assert.equal(rifleDamage(45), 60);
});

test('o dano é o da velocidade no momento do disparo: parado menor que a 25 m/s', () => {
  const slow = target(0, -20);
  const fast = target(0, -20);
  fireRifle(shooter({ speed: 0 }), aim(), { targets: [slow] });
  fireRifle(shooter({ speed: 25 }), aim(), { targets: [fast] });
  const dSlow = 100 - slow.health;
  const dFast = 100 - fast.health;
  assert.equal(dSlow, 20);
  assert.ok(dFast > 2 * dSlow, `a 25 m/s: ${dFast}`);
  // Só a horizontal conta: cair rápido não aumenta o dano.
  const falling = shooter();
  falling.player.vel = { x: 0, y: -40, z: 0 };
  const t = target(0, -20);
  fireRifle(falling, aim(), { targets: [t] });
  assert.equal(100 - t.health, 20);
});

test('coice: empurra na direção oposta à mira (pequeno), sem passar do limite de velocidade', () => {
  const s = shooter();
  fireRifle(s, aim(FWD));
  assert.ok(Math.abs(s.player.vel.z - WEAPONS.RIFLE_RECOIL) < 1e-9, `para trás (+z): ${s.player.vel.z}`);
  const side = shooter();
  fireRifle(side, aim({ x: 1, y: 0, z: 0 }));
  assert.ok(Math.abs(side.player.vel.x + WEAPONS.RIFLE_RECOIL) < 1e-9, 'mirando para +x, vai para -x');
  const fast = shooter();
  fast.player.vel = { x: 0, y: 0, z: MOVE.MAX_SPEED }; // já no teto, indo para +z (para trás)
  fireRifle(fast, aim(FWD));
  assert.ok(Math.hypot(fast.player.vel.x, fast.player.vel.z) <= MOVE.MAX_SPEED + 1e-9);
});

test('coice para cima: NEUTRO até a decisão do dono (limite vertical de impulsos de arma)', () => {
  // A ficha pede "atirar para baixo no ar sobe". Isso depende da dúvida 14 (limite vertical),
  // ainda sem resposta: por enquanto o coice só empurra na horizontal (RECOIL_VERTICAL_SCALE = 0).
  assert.equal(WEAPONS.RECOIL_VERTICAL_SCALE, 0);
  const s = shooter();
  s.player.vel = { x: 0, y: -3, z: 0 };
  fireRifle(s, aim(aimDir(0, -Math.PI / 2 + 0.01))); // quase reto para baixo
  assert.equal(s.player.vel.y, -3, 'não mudou a vertical');
  // Com a parte vertical ligada (como seria com a decisão), mirar para baixo empurra para cima.
  const on = shooter();
  fireRifle(on, aim({ x: 0, y: -1, z: 0 }), {}, { ...WEAPONS, RECOIL_VERTICAL_SCALE: 1 });
  assert.ok(Math.abs(on.player.vel.y - WEAPONS.RIFLE_RECOIL) < 1e-9);
});

test('direção da mira: yaw 0 olha para -z; pitch para cima sobe; comprimento 1', () => {
  const d = aimDir(0, 0);
  assert.ok(Math.abs(d.z + 1) < 1e-12 && Math.abs(d.x) < 1e-12);
  const up = aimDir(0.7, 0.4);
  assert.ok(Math.abs(Math.hypot(up.x, up.y, up.z) - 1) < 1e-12);
  assert.ok(up.y > 0);
});

test('não acerta em si mesmo; o raio vai até o alcance e para', () => {
  const s = shooter();
  const r = fireRifle(s, aim(), { targets: [s.player] });
  assert.equal(r.hit, 'none');
  assert.ok(Math.abs(Math.hypot(r.point.x, r.point.y - PLAYER.EYE_HEIGHT, r.point.z) - WEAPONS.RIFLE_RANGE) < 1e-9);
});

test('jogador local: segurar o botão atira na cadência, gasta Carga e o painel F4 muda o dano ao vivo', () => {
  const weaponsCfg = { ...WEAPONS };
  const t = target(0, 0, 1000); // posto 6 m à frente de quem nasce (logo abaixo)
  const me = createLocalPlayer({ map: getMap('sandbox'), weaponsCfg, targets: [t] });
  t.pos = { x: me.player.pos.x, y: 0, z: me.player.pos.z - 6 };
  const keys = (pressed) => ({ isDown: (a) => a === 'fire', pressed: (a) => a === 'fire' && pressed });
  let shots = 0;
  for (let i = 0; i < 1 / DT; i++) {
    me.step(keys(i === 0), DT);
    shots += me.player.events.filter((e) => e.type === 'shot').length;
  }
  assert.equal(shots, 4, 'segurando 1 s: 4 tiros');
  assert.ok(Math.abs(1000 - t.health - 4 * WEAPONS.RIFLE_DAMAGE) < 1e-9, `dano: ${1000 - t.health}`);
  assert.ok(me.charge.value < 100 - 3 * WEAPONS.RIFLE_COST, `Carga gasta: ${me.charge.value}`);
  weaponsCfg.RIFLE_DAMAGE = 50; // como o painel F4 faria
  const before = t.health;
  for (let i = 0; i < 0.2 / DT; i++) me.step(keys(false), DT); // um tiro só (o próximo, em 1,0 s)
  assert.equal(before - t.health, 50);
});

test('jogador local: sem Carga, segurar o botão não atira e o aviso (dryFire) sai só no aperto', () => {
  const me = createLocalPlayer({ map: getMap('sandbox') });
  me.charge.value = 0;
  let dry = 0;
  let shots = 0;
  for (let i = 0; i < 0.5 / DT; i++) {
    me.step({ isDown: (a) => a === 'fire', pressed: (a) => a === 'fire' && i === 0 }, DT);
    dry += me.player.events.filter((e) => e.type === 'dryFire').length;
    shots += me.player.events.filter((e) => e.type === 'shot').length;
  }
  assert.equal(shots, 0);
  assert.equal(dry, 1);
});

test('coice horizontal não deixa sair do mapa: atirar para trás e para os lados no ar, nos dois mapas', () => {
  // Varredura de brechas: pular, pulo duplo e atirar sem parar em várias direções (o coice soma
  // velocidade horizontal). Com o coice só horizontal, a altura não muda e ninguém sai do mapa.
  for (const [map, limit] of [[getMap('sandbox'), 29], [getMap('treino'), 100]]) {
    let maxY = 0;
    for (const s of map.spawns) {
      for (let k = 0; k < 8; k++) {
        const yaw = (k * Math.PI) / 4;
        const p = createPlayer(s);
        const sh = { player: p, charge: createCharge(), weapon: createWeapon('rifle') };
        sh.charge.value = 1e9; // munição sem fim para procurar a brecha
        for (let i = 0; i < 4 / DT; i++) {
          const jump = i === 1 || i === 40;
          stepPlayer(p, { ...emptyInput(), moveZ: 1, yaw, jump, jumpPressed: jump }, map, DT);
          stepWeapon(sh.weapon, DT);
          fireRifle(sh, { origin: { x: p.pos.x, y: p.pos.y + 1.6, z: p.pos.z }, dir: aimDir(yaw + Math.PI, -0.6) }, { map });
          maxY = Math.max(maxY, p.pos.y);
          assert.ok(Math.abs(p.pos.x) <= limit && Math.abs(p.pos.z) <= limit, `${map.id}: saiu em ${p.pos.x}, ${p.pos.z}`);
        }
      }
    }
    assert.ok(maxY < 12, `${map.id}: altura máxima ${maxY.toFixed(2)} m`);
  }
});
