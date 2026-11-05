import { describe, it, expect } from 'vitest';
import { World } from '../src/sim/world';
import * as L from '../src/sim/layout';
import { NEEDS, MIN_PER_SEC } from '../src/sim/defs';
import { ROSTER, SEED_RELATIONS } from '../src/sim/roster';
import * as God from '../src/sim/god';
import { toJSON, fromJSON } from '../src/sim/save';

const mk = (seed: number) => { const w = new World(seed); w.build(); return w; };
const ticks = (days: number, dt = 0.25) => Math.floor((days * 1440) / (dt * MIN_PER_SEC));

describe('plan de la maison', () => {
  it('29x19, aucun chevauchement, accès libres et atteignables', () => {
    expect(L.MAP.length).toBe(L.H); L.MAP.forEach((r) => expect(r.length).toBe(L.W));
    const w = mk(1); const seen = new Set<string>(); let overlap = 0, bad = 0, unreachable = 0;
    for (const f of w.furn) {
      if (f.blocks) for (let cx = 0; cx < f.w; cx++) for (let cy = 0; cy < f.d; cy++) { const k = `${f.x + cx},${f.y + cy}`; if (L.isWall(f.x + cx, f.y + cy) || seen.has(k)) overlap++; seen.add(k); }
      for (const slot of f.slots) {
        const st = slot.stands.map((s) => ({ x: f.x + s[0], y: f.y + s[1] })).find((c) => w.isWalkable(c));
        if (!st) bad++; else if (w.pathTo({ x: 3.5, y: 8.5 }, st).length === 0) unreachable++;
      }
    }
    expect([overlap, bad, unreachable]).toEqual([0, 0, 0]);
  });
});

describe('construction', () => {
  it('huit adultes distincts, endormis dans leur lit', () => {
    const w = mk(7);
    expect(w.residents.length).toBe(8);
    expect(new Set(w.residents.map((c) => c.name)).size).toBe(8);
    expect(new Set(w.chars.map((c) => JSON.stringify(c.look))).size).toBe(w.chars.length); expect(w.chars.length).toBe(19); // 8 habitants + avatar + barman + commerçant + 2 policiers + 6 citoyens
    w.residents.forEach((c) => { expect(c.age).toBeGreaterThanOrEqual(18); expect(c.use_act).toBe('sleep'); });
    expect(new Set(w.residents.map((c) => c.bed_id)).size).toBe(8);
  });
});

describe('simulation autonome (3 jours)', () => {
  const w = mk(2024); const dt = 0.25;
  let maxJump = 0, inWall = 0, needOob = 0, oob = 0; const gone: Record<number, boolean> = {};
  const prev = w.chars.map((c) => ({ ...c.pos }));
  const t0 = performance.now();
  for (let i = 0; i < ticks(3); i++) {
    w.tick(dt);
    for (const c of w.chars) {
      if (c.away) { gone[c.id] = true; prev[c.id] = { ...c.pos }; continue; } if (gone[c.id]) { gone[c.id] = false; prev[c.id] = { ...c.pos }; } // réapparition à une porte (travail, garde à vue) : pas un saut
      maxJump = Math.max(maxJump, Math.hypot(c.pos.x - prev[c.id].x, c.pos.y - prev[c.id].y)); prev[c.id] = { ...c.pos };
      if (c.pos.x < 0 || c.pos.y < 0 || c.pos.x > L.W || c.pos.y > L.H) oob++;
      if (['walk', 'idle', 'chat'].includes(c.state) && !w.isWalkable(c.cell())) inWall++;
      for (const n of NEEDS) if (c.needs[n] < -0.001 || c.needs[n] > 100.001) needOob++;
    }
  }
  const ms = performance.now() - t0;
  it('aucune téléportation, personne dans un mur, besoins bornés', () => {
    console.log(`3 jours simulés en ${ms.toFixed(0)} ms`);
    expect(maxJump).toBeLessThanOrEqual(0.7); // 0,7 = un policier en poursuite (2,7 cases/s x 0,25 s) ; une téléportation dépasserait largement expect(inWall).toBe(0); expect(oob).toBe(0); expect(needOob).toBe(0);
    expect(w.stats.path_fail ?? 0).toBeLessThanOrEqual(5);
  });
  it('chacun mange, va aux toilettes, dort, varie ses activités', () => {
    for (const c of w.residents) {
      const meals = (c.stats.done_eat ?? 0) + (c.stats.done_snack ?? 0);
      const kinds = Object.keys(c.stats).filter((k) => k.startsWith('done_')).length;
      console.log(c.first.padEnd(8), 'repas', meals, 'WC', c.stats.done_toilet ?? 0, 'douche', c.stats.done_shower ?? 0, 'discussions', c.stats.chats ?? 0, 'souvenirs', c.memories.length);
      expect(meals).toBeGreaterThanOrEqual(3); expect(c.stats.done_toilet ?? 0).toBeGreaterThanOrEqual(2); expect(c.stats.sleeps ?? 0).toBeGreaterThanOrEqual(2); expect(kinds).toBeGreaterThanOrEqual(5);
      expect(c.memories.length).toBeGreaterThan(0);
    }
    expect(w.residents.filter((c) => (c.stats.done_shower ?? 0) >= 1).length).toBeGreaterThanOrEqual(7);
  });
  it('conversations, relations et préférences évoluent, désordre rangé', () => {
    expect(w.stats.chats).toBeGreaterThanOrEqual(15);
    const changed = SEED_RELATIONS.filter((r) => Math.abs(w.getRel(r[0], r[1]).aff - r[2]) > 0.5).length;
    expect(changed).toBeGreaterThanOrEqual(SEED_RELATIONS.length / 2);
    expect(w.residents.filter((c) => Object.values(c.pref).some((v) => Math.abs(v) > 2.5)).length).toBeGreaterThanOrEqual(3);
    expect(w.stats.tidied).toBeGreaterThanOrEqual(1);
  });
  it('sauvegarde / chargement fidèles, la partie continue sans téléportation', () => {
    const w2 = fromJSON(JSON.parse(JSON.stringify(toJSON(w))))!;
    expect(w2).not.toBeNull(); expect(w2.clock).toBeCloseTo(w.clock);
    w.chars.forEach((c, i) => { NEEDS.forEach((n) => expect(w2.chars[i].needs[n]).toBeCloseTo(c.needs[n], 3)); expect(w2.chars[i].memories.length).toBe(c.memories.length); });
    expect(w2.mess.length).toBe(w.mess.length);
    const p = w2.chars.map((c) => ({ ...c.pos })); let j = 0;
    for (let i = 0; i < 3000; i++) { w2.tick(0.25); w2.chars.forEach((c) => { j = Math.max(j, Math.hypot(c.pos.x - p[c.id].x, c.pos.y - p[c.id].y)); p[c.id] = { ...c.pos }; }); }
    expect(j).toBeLessThanOrEqual(0.7); expect(w2.clock).toBeGreaterThan(w.clock);
  });
});

describe('pouvoirs divins', () => {
  it('bénédiction, murmure, destin, festin', () => {
    const w = mk(99); for (let i = 0; i < 600; i++) w.tick(0.25);
    const c = w.chars[0]; c.needs.hunger = 20; c.joy = 0; w.freePowers = false; w.godEnergy = 100; const f0 = c.faith;
    expect(God.bless(w, c)).toBe(true); expect(c.needs.hunger).toBeGreaterThan(30); expect(c.joy).toBeGreaterThan(20); expect(c.faith).toBeGreaterThan(f0);
    expect(w.godEnergy).toBeCloseTo(100 - God.cost('bless'), 0);
    w.godEnergy = 5; expect(God.bless(w, c)).toBe(false);
    w.godEnergy = 100; const t = w.chars[2]; t.faith = 100;
    for (let i = 0; i < 4 && !t.whisper_act; i++) God.whisper(w, t, 'pray');
    expect(t.whisper_act !== '' || (t.stats.act_pray ?? 0) > 0).toBe(true);
    for (let i = 0; i < 800; i++) w.tick(0.25);
    w.godEnergy = 100; const aw = w.chars.filter((x) => !x.isAsleep() && x.state !== 'chat'); const before = aw[0].stats.chats ?? 0;
    expect(God.fate(w, aw[0], aw[1])).toBe(true); for (let i = 0; i < 1600; i++) w.tick(0.25);
    expect(aw[0].stats.chats ?? 0).toBeGreaterThan(before);
    w.godEnergy = 100; w.chars.forEach((x) => { if (x.kind === "resident") x.needs.hunger = Math.min(x.needs.hunger, 55); }); expect(God.feast(w)).toBe(true); for (let i = 0; i < 1500; i++) w.tick(0.25);
    expect(w.chars.reduce((s, x) => s + (x.stats.done_feast ?? 0), 0)).toBeGreaterThanOrEqual(4);
  });
});

describe('déterminisme', () => {
  it('même graine => même histoire', () => {
    const a = mk(555), b = mk(555); for (let i = 0; i < 3000; i++) { a.tick(0.25); b.tick(0.25); }
    a.chars.forEach((c, i) => { expect(c.pos.x).toBeCloseTo(b.chars[i].pos.x, 6); NEEDS.forEach((n) => expect(c.needs[n]).toBeCloseTo(b.chars[i].needs[n], 6)); });
  });
  it('répartition des conversations plausible (dont des disputes)', () => {
    const k: Record<string, number> = { argument: 0, awkward: 0, pleasant: 0, great: 0 };
    for (const s of [1, 2, 3, 4]) { const w = mk(s); for (let i = 0; i < ticks(4); i++) w.tick(0.25); for (const x of Object.keys(k)) k[x] += w.stats['chat_' + x] ?? 0; }
    const tot = Object.values(k).reduce((a, b) => a + b, 0); console.log('conversations', k);
    expect(k.argument / tot).toBeGreaterThan(0.01); expect(k.argument / tot).toBeLessThan(0.25); expect(k.pleasant + k.great).toBeGreaterThan(tot * 0.4);
  });
});
void ROSTER;
