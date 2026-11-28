import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PHYSICS } from '../shared/constants.js';
import { validateMap } from '../shared/maps/format.js';
import { getMap } from '../shared/maps/index.js';
import { treino as M, TREINO_CORRIDOR as CO, TREINO_SLAM as S } from '../shared/maps/treino.js';
import { createPlayer, stepPlayer, emptyInput } from '../shared/physics/player.js';
import { createLocalPlayer } from '../src/player/localPlayer.js';
import { createCircuitTimer, formatTime, BEST_KEY_PREFIX } from '../src/ui/timer.js';
import { searchEscapes } from './helpers/escape-search.js';

const DT = PHYSICS.FIXED_DT;
const input = (over = {}) => ({ ...emptyInput(), ...over });
const has = (p, type) => p.events.some((e) => e.type === type);
const EAST_YAW = M.spawns[2].yaw; // olhando para +x

/** Jogador parado no ponto de nascimento da estação k (1 a 10). */
function atStation(k) {
  const s = M.spawns[k - 1];
  const p = createPlayer(s);
  stepPlayer(p, input({ yaw: s.yaw }), M, DT);
  return { p, yaw: s.yaw };
}

test('validateMap aceita o mapa de treino; ?mapa=treino o escolhe', () => {
  assert.deepEqual(validateMap(M).errors, []);
  assert.equal(getMap('treino'), M);
});

test('10 estações: 10 pontos de nascimento, 10 placas, cronômetro com largada e chegada', () => {
  assert.equal(M.spawns.length, 10);
  assert.equal(M.signs.length, 10);
  M.signs.forEach((s, i) => assert.ok(s.title.startsWith(`${i + 1} `), s.title));
  assert.ok(M.timer.start && M.timer.finish);
});

test('cada ponto de nascimento começa de pé, sem cair (estações jogáveis)', () => {
  for (let k = 1; k <= 10; k++) {
    const s = M.spawns[k - 1];
    const p = createPlayer(s);
    for (let i = 0; i < 30; i++) stepPlayer(p, emptyInput(), M, DT);
    assert.equal(p.onGround, true, `estação ${k}`);
    assert.ok(Math.abs(p.pos.y - s.y) < 1e-6, `estação ${k}: y ${p.pos.y}`);
  }
});

test('estação 4: entradas roteirizadas atravessam o corredor das 4 paredes sem tocar o chão', () => {
  const { p, yaw } = atStation(4);
  p.vel = { x: -1.5, y: 0, z: -12 }; // correndo para o corredor, puxando para a parede da esquerda
  let starts = 0;
  let touchedFloor = false;
  for (let i = 0; i < 6 / DT; i++) {
    let inp = input({ moveZ: 1, yaw, jump: i === 0, jumpPressed: i === 0 });
    // pula para a próxima parede 0,05 s depois de grudar; na última, só corre até o fim
    if (p.wallrun && p.wallrun.time > 0.05 && starts < CO.walls.length) inp = input({ moveZ: 1, yaw, jump: true, jumpPressed: true });
    stepPlayer(p, inp, M, DT);
    if (has(p, 'wallrunStart')) starts++;
    if (p.onGround && p.pos.y < 1) touchedFloor = true;
    if (i > 5 && p.onGround) break;
  }
  assert.equal(starts, 4, `paredes: ${starts}`);
  assert.equal(touchedFloor, false, 'não tocou o chão');
  assert.ok(Math.abs(p.pos.y - CO.height) < 1e-9 && p.pos.z < CO.endZ, `pousou na plataforma de chegada: ${p.pos.y}, ${p.pos.z}`);
});

test('estação 6: do alto da torre, slam no X e pulo de slam + duplo até a plataforma alta', () => {
  const p = createPlayer({ x: 73.4, y: S.perch.top, z: (S.perch.minZ + S.perch.maxZ) / 2, yaw: 0 });
  const yaw = 0; // indo para -z; a plataforma alta fica à direita (+x)
  stepPlayer(p, input({ yaw }), M, DT);
  let slammed = false;
  let landed = false;
  let doubled = false;
  let slamJump = false;
  for (let i = 0; i < 6 / DT; i++) {
    if (landed && p.onGround && p.pos.y > S.target.top - 0.1) break;
    let inp;
    if (!slammed && !p.onGround && p.pos.z < (S.spot.minZ + S.spot.maxZ) / 2 + 0.3) { // em cima do meio do X
      slammed = true;
      inp = input({ yaw, crouch: true, crouchPressed: true }); // C ao sair da torre: slam
    } else if (!slammed) inp = input({ moveZ: 1, yaw });
    else if (!landed && has(p, 'slamLand')) {
      landed = true;
      inp = input({ moveX: 1, yaw, jump: true, jumpPressed: true }); // pulo de slam, indo para a direita
    } else if (landed && !doubled && !p.onGround && p.vel.y < 0.5) {
      doubled = true;
      inp = input({ moveX: 1, yaw, jump: true, jumpPressed: true }); // pulo duplo no alto
    } else inp = input({ moveX: landed ? 1 : 0, yaw, crouch: !landed });
    stepPlayer(p, inp, M, DT);
    if (has(p, 'slamJump')) slamJump = true;
  }
  assert.ok(slamJump, 'fez o pulo de slam');
  assert.equal(p.onGround, true);
  assert.ok(Math.abs(p.pos.y - S.target.top) < 1e-9, `em cima da plataforma alta: y = ${p.pos.y}`);
});

test('estação 6: sem slam, pulo + pulo duplo do chão não alcança a plataforma alta', () => {
  const p = createPlayer({ x: 73.5, y: 0, z: (S.spot.minZ + S.spot.maxZ) / 2, yaw: 0 });
  stepPlayer(p, input({ yaw: 0 }), M, DT);
  let top = 0;
  stepPlayer(p, input({ moveX: 1, yaw: 0, jump: true, jumpPressed: true }), M, DT);
  let doubled = false;
  for (let i = 0; i < 2 / DT && !(i > 5 && p.onGround); i++) {
    const dbl = !doubled && p.vel.y < 0.5;
    if (dbl) doubled = true;
    stepPlayer(p, input({ moveX: 1, yaw: 0, jump: dbl, jumpPressed: dbl }), M, DT);
    top = Math.max(top, p.pos.y);
  }
  assert.ok(top < S.target.top, `chegou a ${top.toFixed(2)} m (a plataforma tem ${S.target.top} m)`);
});

test('estação 7: o vão pede pulo + duplo + dash (só pulo + duplo cai)', () => {
  const tryCross = (useDash) => {
    const { p, yaw } = atStation(7);
    let jumped = false;
    let doubled = false;
    let dashed = false;
    for (let i = 0; i < 5 / DT; i++) {
      if ((jumped && p.onGround && i > 5) || p.pos.y < -2) break;
      let inp = input({ moveZ: 1, yaw });
      if (!jumped && p.pos.x < 43.6 && p.onGround) {
        jumped = true;
        inp = input({ moveZ: 1, yaw, jump: true, jumpPressed: true });
      } else if (jumped && !doubled && p.vel.y < 0.5) {
        doubled = true;
        inp = input({ moveZ: 1, yaw, jump: true, jumpPressed: true });
      } else if (useDash && doubled && !dashed && p.vel.y < 0) {
        dashed = true;
        inp = input({ moveZ: 1, yaw, dashPressed: true });
      }
      stepPlayer(p, inp, M, DT);
    }
    return p.pos.x < 32 && p.pos.y > -0.1;
  };
  assert.equal(tryCross(true), true, 'com dash atravessa');
  assert.equal(tryCross(false), false, 'sem dash cai');
});

test('estação 8: as plataformas de salto levam uma à outra até o outro lado', () => {
  const { p, yaw } = atStation(8);
  let pads = 0;
  for (let i = 0; i < 8 / DT; i++) {
    stepPlayer(p, input({ moveZ: pads ? 0 : 1, yaw }), M, DT);
    pads += p.events.filter((e) => e.type === 'pad').length;
    if ((pads >= 4 && p.onGround) || p.pos.y < -3) break;
  }
  assert.equal(pads, 4);
  assert.ok(p.pos.x < -40 && p.onGround && p.pos.y === 0, `do outro lado: ${p.pos.x}`);
});

test('cair num fosso: renasce na estação mais perto (e R faz o mesmo)', () => {
  const me = createLocalPlayer({ map: M, spawnIndex: 6 }); // estação 7
  const keys = (...held) => ({ isDown: (a) => held.includes(a), pressed: () => false });
  for (let i = 0; i < 8 / DT && me.respawns === 0; i++) me.step(keys('forward'), DT); // corre e cai no vão
  assert.equal(me.respawns, 1);
  assert.deepEqual(me.player.pos, { x: M.spawns[6].x, y: M.spawns[6].y, z: M.spawns[6].z }, 'de volta à estação 7');
  me.player.pos = { x: -70, y: 0, z: -30 }; // perto da estação 9
  me.respawnNearest();
  assert.deepEqual(me.player.pos, { x: M.spawns[8].x, y: M.spawns[8].y, z: M.spawns[8].z }, 'R: estação 9');
});

test('cronômetro: sair da largada começa, passar pelos corredores e chegar termina e guarda o melhor tempo', () => {
  const data = new Map();
  const storage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
  const t = createCircuitTimer(M.timer, { mapId: 'treino', storage });
  const startPos = { x: -92, y: 0, z: 77 };
  const outside = { x: -70, y: 0, z: 77 };
  const east = { x: 77, y: 0, z: 0 };
  const south = { x: 0, y: 0, z: -77 };
  const west = { x: -77, y: 0, z: -20 };
  const finishPos = { x: -77, y: 0, z: 45 };
  const lap = (t0, tEnd) => {
    t.update(startPos, t0);
    t.update(outside, t0 + 1);
    t.update(east, t0 + 10);
    t.update(south, t0 + 20);
    t.update(west, t0 + 30);
    return t.update(finishPos, tEnd);
  };
  assert.equal(t.update(startPos, 0), null);
  assert.equal(t.state, 'armed');
  assert.deepEqual(t.update(outside, 1), { type: 'start' });
  t.update(east, 10);
  t.update(south, 20);
  t.update(west, 30);
  assert.equal(t.update(finishPos, 61.5).type, 'finish');
  assert.equal(t.elapsed, 60.5);
  assert.equal(t.best, 60.5);
  assert.equal(data.get(BEST_KEY_PREFIX + 'treino'), '60.5');
  // Segunda volta mais lenta: não troca o recorde.
  const slow = lap(100, 200);
  assert.equal(slow.record, false);
  assert.equal(t.best, 60.5);
  // O recorde salvo volta ao abrir de novo.
  const again = createCircuitTimer(M.timer, { mapId: 'treino', storage });
  assert.equal(again.best, 60.5);
  // Chegar sem ter largado não conta.
  const fresh = createCircuitTimer(M.timer, { mapId: 'x', storage });
  assert.equal(fresh.update(finishPos, 5), null);
  assert.equal(formatTime(62.346), '1:02,35');
  assert.equal(formatTime(9.5), '9,50');
});

test('cronômetro: chegar sem passar pelas estações não conta (nem salva recorde)', () => {
  const data = new Map();
  const storage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
  // O atalho do Revisor: sair da faixa verde para o sul e entrar logo na vermelha (0,33 s).
  const u = createCircuitTimer(M.timer, { mapId: 'treino', storage });
  u.update({ x: -92, y: 0, z: 60 }, 0);
  assert.deepEqual(u.update({ x: -92, y: 0, z: 53 }, 0.2), { type: 'start' });
  assert.equal(u.update({ x: -92, y: 0, z: 45 }, 0.33), null, 'chegada sem passar pelos corredores não termina');
  assert.equal(u.state, 'running');
  assert.equal(u.best, null);
  assert.equal(data.size, 0, 'nada salvo');
  // Fora de ordem também não vale: oeste antes de leste e sul.
  u.update({ x: -77, y: 0, z: -20 }, 5);
  u.update({ x: 77, y: 0, z: 0 }, 10);
  u.update({ x: 0, y: 0, z: -77 }, 20);
  assert.equal(u.update({ x: -92, y: 0, z: 45 }, 30), null, 'faltou o oeste depois do sul');
  u.update({ x: -77, y: 0, z: -20 }, 40);
  assert.equal(u.update({ x: -92, y: 0, z: 45 }, 50).type, 'finish');
});

test('estação 3: por cima do teto baixo não passa (pulo, duplo e dash, sem deslizar)', () => {
  let passed = 0;
  let tries = 0;
  // Começa depois dos fossos da estação 2 (x > 12), correndo a 12 ou 20 m/s.
  for (let jumpX = 14; jumpX <= 21.5; jumpX += 0.5) {
    for (const z of [56, 65, 77.5, 90, 99]) {
      for (const [useDash, speed] of [[false, 12], [true, 12], [false, 20], [true, 20]]) {
        tries++;
        const p = createPlayer({ x: 13, y: 0, z, yaw: EAST_YAW });
        p.vel = { x: speed, y: 0, z: 0 };
        let jumped = false;
        let doubled = false;
        let dashed = false;
        for (let i = 0; i < 4 / DT; i++) {
          let inp = input({ moveZ: 1, yaw: EAST_YAW });
          if (!jumped && p.onGround && p.pos.x >= jumpX) {
            jumped = true;
            inp = input({ moveZ: 1, yaw: EAST_YAW, jump: true, jumpPressed: true });
          } else if (jumped && !doubled && p.vel.y < 0.5) {
            doubled = true;
            inp = input({ moveZ: 1, yaw: EAST_YAW, jump: true, jumpPressed: true });
          } else if (useDash && doubled && !dashed) {
            dashed = true;
            inp = input({ moveZ: 1, yaw: EAST_YAW, dashPressed: true });
          }
          stepPlayer(p, inp, M, DT);
          assert.equal(p.sliding, false);
          if (p.pos.x > 38) break;
        }
        if (p.pos.x > 38) passed++;
      }
    }
  }
  assert.equal(passed, 0, `${passed} de ${tries} passaram sem deslizar`);
  // Deslizando, passa.
  const { p, yaw } = atStation(3);
  p.vel = { x: 12, y: 0, z: 0 };
  let slid = false;
  for (let i = 0; i < 6 / DT && p.pos.x <= 38.5; i++) {
    const press = !slid && p.pos.x > 19;
    if (press) slid = true;
    stepPlayer(p, input({ moveZ: 1, yaw, crouch: slid, crouchPressed: press }), M, DT);
  }
  assert.ok(p.pos.x > 38.5, `deslizando atravessa: x = ${p.pos.x}`);
});

test('estação 9: roteiro simples (W na escada, no alto W + D) desce o corrimão', () => {
  for (const pullAt of [-38.9, -38.5, -37, -35]) {
    const { p, yaw } = atStation(9);
    let rode = false;
    for (let i = 0; i < 10 / DT; i++) {
      const right = p.pos.y > 2.9 && p.pos.z >= pullAt;
      stepPlayer(p, input({ moveZ: 1, moveX: right ? 1 : 0, yaw }), M, DT);
      if (has(p, 'railStart')) rode = true;
      if (has(p, 'railEnd')) break;
    }
    assert.ok(rode, `puxando D em z = ${pullAt}: pegou o corrimão`);
    assert.ok(p.pos.z > -16, `chegou ao fim do corrimão: z = ${p.pos.z.toFixed(2)}`);
  }
});

test('nada sai do mapa a partir das estações (varredura: pulo, duplo, dash, pulo na parede)', () => {
  const starts = M.spawns.map((s) => ({ x: s.x, y: s.y, z: s.z }));
  starts.push({ x: 73.4, y: S.perch.top, z: (S.perch.minZ + S.perch.maxZ) / 2 }); // alto da torre do slam
  starts.push({ x: 77, y: 3.5, z: -16.5 }); // alto da torre de pulo na parede
  const r = searchEscapes(M, starts, 100); // faces internas das paredes externas em ±100
  assert.deepEqual(r.escapes, [], `saiu em ${r.escapes.length} de ${r.tries}`);
});

test('estação 6, como a placa ensina: "Bateu: Espaço já segurando D. No alto: Espaço de novo" (24 saídas)', () => {
  // Achados do Testador e do Revisor: o segundo Espaço logo em seguida não chega, e pular do slam
  // sem D quase nunca chega. A placa e o roteiro agora dizem: Espaço ao bater JÁ segurando D e,
  // no alto, Espaço de novo. Quem esqueceu o D: D + Shift na descida.
  // 24 saídas: 8 posições na torre x 3 pontos do X (onde aperta C).
  const run = (x, zSlam, { holdD = true, early = false, shift = false } = {}) => {
    const p = createPlayer({ x, y: S.perch.top, z: -31.5, yaw: 0 });
    stepPlayer(p, input({ yaw: 0 }), M, DT);
    let slammed = false;
    let landed = false;
    let doubled = false;
    let dashed = false;
    let since = 0;
    for (let i = 0; i < 6 / DT; i++) {
      let inp;
      if (!slammed) {
        slammed = !p.onGround && p.pos.z < zSlam;
        inp = slammed ? input({ yaw: 0, crouch: true, crouchPressed: true }) : input({ yaw: 0, moveZ: 1 });
      } else if (!landed) {
        landed = has(p, 'slamLand');
        inp = landed ? input({ yaw: 0, moveX: holdD ? 1 : 0, jump: true, jumpPressed: true }) : input({ yaw: 0, crouch: true });
      } else {
        since += DT;
        const now = !doubled && !p.onGround && (early ? since >= 0.15 : p.vel.y < 0.5);
        if (now) doubled = true;
        // "D + Shift na descida": já descendo, abaixo da altura da plataforma, ainda antes dela.
        const dash = shift && doubled && !dashed && p.vel.y < 0 && p.pos.y < S.target.top + 0.4 && p.pos.x < 73.7;
        if (dash) dashed = true;
        inp = input({ yaw: 0, moveX: holdD || doubled ? 1 : 0, jump: now, jumpPressed: now, dashPressed: dash });
      }
      stepPlayer(p, inp, M, DT);
      if (landed && doubled && p.onGround) return p.pos.y > S.target.top - 0.1;
    }
    return false;
  };
  const xs = [70.4, 70.85, 71.3, 71.75, 72.2, 72.65, 73.1, 73.55];
  const zs = [-35, -36.5, -38];
  const count = (opts) => xs.reduce((n, x) => n + zs.filter((z) => run(x, z, opts)).length, 0);
  assert.equal(count(), 24, 'seguindo a placa (D desde o pulo de slam, Espaço no alto): 24 de 24');
  const noD = count({ holdD: false });
  const noDShift = count({ holdD: false, shift: true });
  assert.ok(noD <= 8, `sem D no pulo de slam quase não chega: ${noD} de 24`);
  assert.ok(noDShift >= 18, `esqueceu o D, mas fez D + Shift na descida: ${noDShift} de 24`);
  assert.equal(run(72, -36.5, { early: true }), false, 'com o segundo Espaço rápido demais (0,15 s), não chega');
});
