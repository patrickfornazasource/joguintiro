import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MOVE, PHYSICS, TUNING, CHARGE, WEAPONS } from '../shared/constants.js';
import { TUNING_GROUPS, CHARGE_TUNING_GROUPS, WEAPON_TUNING_GROUPS, TUNING_SETS, tuningItem, tuningRange, sanitizeMove, changedValues, tuningJson, tuningJsonAll } from '../shared/tuning.js';
import { treino } from '../shared/maps/treino.js';
import { getMap } from '../shared/maps/index.js';
import { createPlayer, stepPlayer, emptyInput } from '../shared/physics/player.js';
import { isSolid, playerBox, overlaps } from '../shared/physics/collide.js';
import { createLocalPlayer, mapArea } from '../src/player/localPlayer.js';
import { createStepSmoother } from '../src/core/stepSmoothing.js';
import { isTuningEnabled, loadTuning, saveTuning, TUNING_STORAGE_KEY } from '../src/ui/tuning.js';
import { movementFingerprint, specialFingerprint } from './helpers/movement-battery.js';
import { searchEscapes } from './helpers/escape-search.js';

const DT = PHYSICS.FIXED_DT;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sandbox = getMap('sandbox');
const memoryStorage = () => {
  const data = new Map();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)), removeItem: (k) => data.delete(k) };
};

test('o painel tem todos os valores de MOVE, cada um uma vez, nos grupos pedidos pela ficha', () => {
  const keys = TUNING_GROUPS.flatMap((g) => g.items.map(([k]) => k));
  assert.deepEqual([...keys].sort(), Object.keys(MOVE).sort());
  assert.equal(new Set(keys).size, keys.length, 'sem repetidos');
  assert.deepEqual(TUNING_GROUPS.map((g) => g.name), ['Chão', 'Pulo', 'Ar', 'Deslize', 'Parede', 'Slam', 'Dash', 'Plataformas', 'Corrimão']);
  for (const k of keys) {
    const it = tuningItem(k);
    assert.ok(it.label && it.unit, `${k}: nome e unidade`);
    assert.doesNotMatch(it.label, /[A-Z]{3,}|_/, `${k}: nome em português, sem nome de código`);
  }
});

test('faixas: de 0,25x a 3x do padrão; contagens inteiras; frações até 1', () => {
  assert.equal(TUNING.MIN_FACTOR, 0.25);
  assert.equal(TUNING.MAX_FACTOR, 3);
  assert.deepEqual(tuningRange('JUMP_SPEED'), { min: 2, max: 24, step: 0.01, base: 8 });
  assert.equal(tuningRange('AIR_JUMPS').min, 0);
  assert.equal(tuningRange('AIR_JUMPS').max, 3);
  assert.equal(tuningRange('AIR_JUMPS').step, 1);
  assert.equal(tuningRange('DOUBLE_JUMP_REDIRECT').max, 1);
  assert.equal(tuningRange('DASH_END_SPEED_KEEP').max, 1);
  for (const k of Object.keys(MOVE)) {
    const r = tuningRange(k);
    assert.ok(r.min <= MOVE[k] && MOVE[k] <= r.max && r.min >= 0 && r.step > 0, k);
  }
});

test('valores de fora são limpos: fora da faixa é cortado, inválido volta ao padrão, MOVE não muda', () => {
  const cfg = sanitizeMove({
    JUMP_SPEED: 1000,
    GRAVITY: -5,
    WALK_SPEED: Number.NaN,
    FRICTION: Infinity,
    DASH_SPEED: '30',
    AIR_JUMPS: 2.4,
    PAD_SPEED: null,
    CHAVE_QUE_NAO_EXISTE: 5,
  });
  assert.equal(cfg.JUMP_SPEED, 24);
  assert.equal(cfg.GRAVITY, 6);
  assert.equal(cfg.WALK_SPEED, MOVE.WALK_SPEED);
  assert.equal(cfg.FRICTION, MOVE.FRICTION);
  assert.equal(cfg.DASH_SPEED, MOVE.DASH_SPEED, 'texto não vale');
  assert.equal(cfg.AIR_JUMPS, 2);
  assert.equal(cfg.PAD_SPEED, MOVE.PAD_SPEED);
  assert.equal('CHAVE_QUE_NAO_EXISTE' in cfg, false);
  assert.deepEqual(Object.keys(cfg), Object.keys(MOVE));
  assert.ok(Object.isFrozen(MOVE) && !Object.isFrozen(cfg), 'a cópia é editável, o padrão não');
  assert.deepEqual(sanitizeMove(undefined), { ...MOVE });
  assert.deepEqual(changedValues(sanitizeMove({})), {});
});

test('Copiar valores gera JSON válido, com os mudados (padrão e novo) e todos os valores', () => {
  const cfg = sanitizeMove({ JUMP_SPEED: 10, DASH_CHARGES: 4 });
  const data = JSON.parse(tuningJson(cfg));
  assert.deepEqual(data.alterados, {
    JUMP_SPEED: { nome: 'Força do pulo', padrao: 8, novo: 10 },
    DASH_CHARGES: { nome: 'Cargas de dash', padrao: 3, novo: 4 },
  });
  assert.deepEqual(sanitizeMove(data.todos), cfg, 'a lista completa volta igual');
});

test('?ajuste=1 liga o painel; salvar guarda só os mudados e volta ao abrir; salvo estragado é ignorado', () => {
  assert.equal(isTuningEnabled('?ajuste=1'), true);
  assert.equal(isTuningEnabled('?mapa=treino&ajuste=1'), true);
  assert.equal(isTuningEnabled(''), false);
  assert.equal(isTuningEnabled('?ajuste=0'), false);
  const storage = memoryStorage();
  assert.deepEqual(loadTuning(storage), { cfg: { ...MOVE }, charge: { ...CHARGE }, weapons: { ...WEAPONS }, loaded: 0 });
  const cfg = sanitizeMove({ JUMP_SPEED: 11 });
  assert.equal(saveTuning(storage, cfg), true);
  assert.deepEqual(JSON.parse(storage.data.get(TUNING_STORAGE_KEY)), { JUMP_SPEED: 11 });
  const again = loadTuning(storage);
  assert.equal(again.cfg.JUMP_SPEED, 11);
  assert.equal(again.loaded, 1);
  storage.setItem(TUNING_STORAGE_KEY, '{ isto não é json');
  assert.deepEqual(loadTuning(storage).cfg, { ...MOVE });
  storage.setItem(TUNING_STORAGE_KEY, JSON.stringify({ GRAVITY: 1e9 }));
  assert.equal(loadTuning(storage).cfg.GRAVITY, 72, 'salvo fora da faixa é cortado');
  assert.equal(saveTuning({ setItem() { throw new Error('cheio'); } }, cfg), false);
});

/** Pulo parado: altura máxima (m). */
function jumpPeak(me) {
  const keys = (...held) => ({ isDown: (a) => held.includes(a), pressed: (a) => held.includes(a) });
  for (let i = 0; i < 30; i++) me.step(keys(), DT); // assenta no chão
  const y0 = me.player.pos.y;
  me.step(keys('jump'), DT);
  let peak = 0;
  for (let i = 0; i < 2 / DT && !(i > 5 && me.player.onGround); i++) {
    me.step(keys(), DT);
    peak = Math.max(peak, me.player.pos.y - y0);
  }
  return peak;
}

test('ficha: mexer na força do pulo (JUMP_SPEED) no painel muda o pulo na hora, sem recriar o jogador', () => {
  const cfg = sanitizeMove(MOVE);
  const me = createLocalPlayer({ map: sandbox, move: cfg });
  const before = jumpPeak(me);
  assert.ok(Math.abs(before - (8 * 8) / (2 * 24)) < 0.02, `padrão: ${before.toFixed(3)} m`);
  const player = me.player;
  cfg.JUMP_SPEED = 12; // o painel muda o mesmo objeto
  const after = jumpPeak(me);
  assert.equal(me.player, player, 'mesmo jogador (não renasceu)');
  assert.ok(Math.abs(after - (12 * 12) / (2 * 24)) < 0.03, `com 12 m/s: ${after.toFixed(3)} m`);
  // Sem o painel, o padrão continua valendo (e é o MOVE congelado).
  assert.equal(createLocalPlayer({ map: sandbox }).move, MOVE);
});

test('a física não lê MOVE direto: todo número do movimento vem da configuração injetada', () => {
  const dir = path.join(ROOT, 'shared', 'physics');
  const code = fs.readdirSync(dir).filter((f) => f.endsWith('.js')).map((f) => {
    const text = fs.readFileSync(path.join(dir, f), 'utf8');
    // Tira comentários; sobra só código.
    return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  }).join('\n');
  assert.doesNotMatch(code, /\bMOVE\.[A-Z]/, 'nenhum MOVE.ALGO no código da física');
  const smoothing = fs.readFileSync(path.join(ROOT, 'src', 'core', 'stepSmoothing.js'), 'utf8');
  for (const k of Object.keys(MOVE)) {
    assert.ok(code.includes(`cfg.${k}`) || smoothing.includes(`cfg.${k}`), `${k} é lido de cfg`);
  }
});

test('cada número do painel muda o movimento (no mínimo ou no máximo da faixa)', () => {
  const maps = { treino, sandbox };
  const fp = (c) => movementFingerprint(treino, treino.spawns, c, 2)
    + movementFingerprint(sandbox, sandbox.spawns, c, 2)
    + specialFingerprint(maps, c);
  const base = fp(undefined);
  assert.equal(fp(sanitizeMove(MOVE)), base, 'a cópia do padrão anda igual ao padrão');
  const dead = [];
  for (const key of Object.keys(MOVE)) {
    if (key === 'STEP_SMOOTH_RATE') continue; // só a câmera (teste abaixo)
    const r = tuningRange(key);
    const changes = (v) => fp({ ...sanitizeMove(MOVE), [key]: v }) !== base;
    if (!changes(r.max) && !changes(r.min)) dead.push(key);
  }
  assert.deepEqual(dead, [], 'valores sem efeito no movimento');
});

test('suavidade da câmera no degrau e altura de degrau: o suavizador lê os valores ao vivo', () => {
  const cfg = sanitizeMove(MOVE);
  const s = createStepSmoother(cfg);
  s.update(0, true, 0);
  const slow = s.update(0.4, true, 0.05) - 0.4;
  s.reset();
  cfg.STEP_SMOOTH_RATE = 45;
  s.update(0, true, 0);
  const fast = s.update(0.4, true, 0.05) - 0.4;
  assert.ok(fast > slow, `mais rápido alcança antes: ${fast} > ${slow}`);
  s.reset();
  cfg.STEP_HEIGHT = 0.2; // 0,4 m não é mais degrau: sem suavizar
  s.update(0, true, 0);
  assert.equal(s.update(0.4, true, 0.05), 0.4);
});

/** Gerador de números pseudoaleatórios com semente (testes repetíveis). */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('nenhum valor da faixa quebra a física: posição válida, fora das paredes e dentro do mapa', () => {
  const rand = rng(2026);
  const configs = [sanitizeMove({}), sanitizeMove(Object.fromEntries(Object.keys(MOVE).map((k) => [k, 1e9]))),
    sanitizeMove(Object.fromEntries(Object.keys(MOVE).map((k) => [k, -1e9])))];
  for (let c = 0; c < 21; c++) {
    configs.push(sanitizeMove(Object.fromEntries(Object.keys(MOVE).map((k) => {
      const r = tuningRange(k);
      const pick = rand();
      return [k, pick < 0.2 ? r.min : pick > 0.8 ? r.max : r.min + (r.max - r.min) * rand()];
    }))));
  }
  const problems = [];
  let outOfMap = 0;
  for (const [ci, cfg] of configs.entries()) {
    for (const map of [treino, sandbox]) {
      const solids = map.boxes.filter(isSolid);
      const area = mapArea(map);
      const me = createLocalPlayer({ map, move: cfg, spawnIndex: ci % map.spawns.length });
      let held = [];
      let yaw = 0;
      for (let i = 0; i < 1500; i++) {
        if (i % 20 === 0) {
          held = ['forward', 'back', 'left', 'right', 'jump', 'crouch'].filter(() => rand() < 0.35);
          yaw = rand() * Math.PI * 2;
        }
        const pressed = ['jump', 'crouch', 'dash'].filter(() => rand() < 0.08);
        me.look(-(yaw - me.yaw) / me.sensitivity, 0);
        me.step({ isDown: (a) => held.includes(a), pressed: (a) => pressed.includes(a) }, DT);
        const p = me.player;
        const nums = [p.pos.x, p.pos.y, p.pos.z, p.vel.x, p.vel.y, p.vel.z];
        if (!nums.every(Number.isFinite)) problems.push(`config ${ci}, ${map.id}, passo ${i}: número inválido`);
        else if (solids.some((b) => overlaps(playerBox(p), b))) problems.push(`config ${ci}, ${map.id}, passo ${i}: dentro de um bloco`);
        else if (p.pos.x < area.minX || p.pos.x > area.maxX || p.pos.z < area.minZ || p.pos.z > area.maxZ) problems.push(`config ${ci}, ${map.id}, passo ${i}: fora do mapa`);
        if (problems.length) break;
      }
      outOfMap += me.outOfMap;
      if (problems.length) break;
    }
    if (problems.length) break;
  }
  assert.deepEqual(problems, []);
  assert.ok(outOfMap >= 0);
});

test('valores extremos que jogam por cima das paredes: quem sai do mapa volta para a estação', () => {
  // Pulo no máximo e gravidade no mínimo: sobe dezenas de metros (paredes do treino: 20 m).
  const cfg = sanitizeMove({ JUMP_SPEED: 1e9, GRAVITY: 0, DOUBLE_JUMP_SPEED: 1e9, AIR_ACCEL: 1e9, AIR_WISH_CAP: 1e9 });
  const r = searchEscapes(treino, [{ x: -92, y: 0, z: 77 }], 100, cfg);
  assert.ok(r.escapes.length > 0, 'sem a rede de segurança, dá para passar por cima das paredes');
  // Com o jogador local (o do jogo), quem passa das paredes volta para a estação.
  const me = createLocalPlayer({ map: treino, move: cfg });
  const area = mapArea(treino);
  me.look((me.yaw - Math.PI / 2) / me.sensitivity, 0); // vira para o oeste (parede externa a 8 m)
  for (let i = 0; i < 20 / DT; i++) {
    // Segura W e pula uma vez, bem alto.
    me.step({ isDown: (k) => k === 'forward', pressed: (k) => k === 'jump' && i === 1 }, DT);
    const p = me.player.pos;
    assert.ok(p.x >= area.minX && p.x <= area.maxX && p.z >= area.minZ && p.z <= area.maxZ, `passo ${i}: ${p.x}, ${p.z}`);
    if (me.outOfMap > 0) break;
  }
  assert.ok(me.outOfMap > 0, 'saiu e voltou');
  assert.deepEqual(me.player.pos, { x: treino.spawns[0].x, y: treino.spawns[0].y, z: treino.spawns[0].z }, 'de volta à estação 1');
  // Com os números padrão, a rede de segurança nunca é usada no treino (varredura da F1-19).
  assert.deepEqual(searchEscapes(treino, [{ x: -92, y: 0, z: 77 }], 100).escapes, []);
});

test('mapArea cobre as paredes externas; mapa vazio não tem limite', () => {
  assert.deepEqual(mapArea(treino), { minX: -101, maxX: 101, minZ: -101, maxZ: 101 });
  assert.equal(mapArea({ boxes: [] }), null);
  const p = createPlayer({ x: 0, y: 0, z: 0 });
  stepPlayer(p, emptyInput(), { boxes: [] }, DT);
  assert.ok(Number.isFinite(p.pos.y));
});

test('F2-01: o painel tem o grupo "Carga" com todos os números da Carga, menos o máximo (fixo pelo GDD)', () => {
  const keys = CHARGE_TUNING_GROUPS.flatMap((g) => g.items.map(([k]) => k));
  assert.deepEqual(CHARGE_TUNING_GROUPS.map((g) => g.name), ['Carga']);
  assert.deepEqual([...keys].sort(), Object.keys(CHARGE).filter((k) => k !== 'CHARGE_MAX').sort());
  for (const k of keys) assert.ok(tuningItem(k).label && tuningItem(k).unit, k);
  // Chaves únicas entre os conjuntos (os valores salvos ficam juntos).
  const all = TUNING_SETS.flatMap((set) => set.groups.flatMap((g) => g.items.map(([k]) => k)));
  assert.equal(new Set(all).size, all.length);
  // O máximo não muda pelo painel nem por valor salvo.
  const c = sanitizeMove({ CHARGE_MAX: 300, CHARGE_IDLE_RATE: 1000, CHARGE_PER_SPEED: 1.2 }, CHARGE);
  assert.equal(c.CHARGE_MAX, 100);
  assert.equal(c.CHARGE_IDLE_RATE, CHARGE.CHARGE_IDLE_RATE * TUNING.MAX_FACTOR);
  assert.equal(c.CHARGE_PER_SPEED, 1.2);
});

test('F2-01: salvar e carregar guarda movimento e Carga juntos; Copiar valores traz os dois', () => {
  const storage = memoryStorage();
  const cfg = sanitizeMove({ JUMP_SPEED: 10 });
  const charge = sanitizeMove({ CHARGE_IDLE_RATE: 4 }, CHARGE);
  assert.equal(saveTuning(storage, cfg, charge), true);
  assert.deepEqual(JSON.parse(storage.data.get(TUNING_STORAGE_KEY)), { JUMP_SPEED: 10, CHARGE_IDLE_RATE: 4 });
  const back = loadTuning(storage);
  assert.equal(back.cfg.JUMP_SPEED, 10);
  assert.equal(back.charge.CHARGE_IDLE_RATE, 4);
  assert.equal(back.loaded, 2);
  const data = JSON.parse(tuningJsonAll([{ cfg, base: MOVE }, { cfg: charge, base: CHARGE }]));
  assert.deepEqual(Object.keys(data.alterados).sort(), ['CHARGE_IDLE_RATE', 'JUMP_SPEED']);
  assert.equal(data.todos.CHARGE_MAX, 100);
  assert.equal(data.todos.WALK_SPEED, MOVE.WALK_SPEED);
});

test('F2-02: o painel tem o grupo "Rifle" com todos os números das armas, menos a parte vertical do coice (fixa)', () => {
  const keys = WEAPON_TUNING_GROUPS.flatMap((g) => g.items.map(([k]) => k));
  assert.deepEqual([...keys].sort(), Object.keys(WEAPONS).filter((k) => k !== 'RECOIL_VERTICAL_SCALE').sort());
  for (const k of keys) assert.ok(tuningItem(k).label && tuningItem(k).unit, k);
  const all = TUNING_SETS.flatMap((set) => set.groups.flatMap((g) => g.items.map(([k]) => k)));
  assert.equal(new Set(all).size, all.length, 'chaves únicas entre os conjuntos');
  // A parte vertical do coice não muda por valor salvo (até a decisão do dono).
  assert.equal(sanitizeMove({ RECOIL_VERTICAL_SCALE: 1, RIFLE_DAMAGE: 30 }, WEAPONS).RECOIL_VERTICAL_SCALE, 0);
  assert.equal(sanitizeMove({ RIFLE_DAMAGE: 30 }, WEAPONS).RIFLE_DAMAGE, 30);
  const storage = memoryStorage();
  assert.equal(saveTuning(storage, sanitizeMove({}), sanitizeMove({}, CHARGE), sanitizeMove({ RIFLE_COST: 15 }, WEAPONS)), true);
  assert.equal(loadTuning(storage).weapons.RIFLE_COST, 15);
});
