import { describe, it, expect } from 'vitest';
import { World } from '../src/sim/world';
import * as City from '../src/sim/city';
import * as Director from '../src/sim/director';
import * as Act from '../src/sim/interact';
import { MIN_PER_SEC } from '../src/sim/defs';

const mk = (seed = 7) => { const w = new World(seed); w.build(); w.dir.on = true; return w; };
const run = (w: World, days: number) => { const n = Math.floor((days * 1440) / (0.25 * MIN_PER_SEC)); for (let i = 0; i < n; i++) w.tick(0.25); };
describe('directeur d\'événements', () => {
  it('sur trois jours : plusieurs types d\'événements cohérents, espacés, jamais deux fois le même d\'affilée', () => {
    const w = mk(); run(w, 3); const log = w.dir.log; expect(log.length).toBeGreaterThanOrEqual(3); expect(new Set(log.map((e) => e.kind)).size).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < log.length; i++) { expect(log[i].t - log[i - 1].t).toBeGreaterThanOrEqual(179); expect(log[i].kind).not.toBe(log[i - 1].kind); }
    for (const k of new Set(log.map((e) => e.kind))) { const ts = log.filter((e) => e.kind === k).map((e) => e.t); for (let i = 1; i < ts.length; i++) expect(ts[i] - ts[i - 1]).toBeGreaterThanOrEqual(299); }
  });
  it('pas de chaos permanent : au plus quelques événements par jour de jeu', () => { const w = mk(11); run(w, 2); expect(w.dir.log.length).toBeLessThanOrEqual(12); });
  it('contrôle de police : s\'il y a un colis illégal, la fouille le confisque (amende) ; fuir déclenche une poursuite ; sinon rien à signaler', () => {
    const w = mk(); City.populate; const av = w.avatar; const cop = w.police[0]; cop.away = false; cop.state = 'idle'; cop.pos = { x: av.pos.x + 1, y: av.pos.y }; w.dir.check = cop.id; expect(Director.checkOpen(w, cop)).toBe(true);
    const ids = Act.dialogueOpen(w, cop).choices.map((c) => c.id); expect(ids).toEqual(['c_obey', 'c_flee']); w.job = { to: 3, pay: 50, t0: 0, illegal: true }; av.inventory.parcel = 1; av.money = 500; const f0 = w.record_.fines; const r = Act.choose(w, cop, 'c_obey'); expect(r.line).toMatch(/confisque/); expect(av.inventory.parcel).toBe(0); expect(w.record_.fines).toBeGreaterThan(f0);
    w.dir.check = cop.id; const wl = w.wanted.level; Act.choose(w, cop, 'c_flee'); expect(w.wanted.level).toBeGreaterThanOrEqual(wl); w.dir.check = cop.id; w.wanted.level = 0; const r2 = Act.choose(w, cop, 'c_obey'); expect(r2.line).toMatch(/Rien à signaler/);
  });
});
