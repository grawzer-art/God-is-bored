import { describe, it, expect } from 'vitest';
import { World } from '../src/sim/world';
import { FOUNDERS, DISTRICTS } from '../src/sim/founders';
import * as Quests from '../src/sim/quests';
import * as I from '../src/sim/interact';
import * as City from '../src/sim/city';

const mk = () => { const w = new World(7); w.build(); City.populate(w); return w; };
describe('habitants fondateurs', () => {
  it('10 fondateurs complets, 7 quartiers canoniques', () => {
    expect(FOUNDERS).toHaveLength(10); expect(DISTRICTS.map((d) => d.name)).toEqual(['Noria Beach', 'Downtown Noria', 'Mirage Strip', 'Golden Hills', 'South Noria', 'Blackwater Docks', 'Eden Campus']);
    for (const f of FOUNDERS) { expect(f.age).toBeGreaterThanOrEqual(18); expect(f.secret.length).toBeGreaterThan(5); expect(f.routine.length).toBeGreaterThan(0); expect(DISTRICTS.some((d) => d.name === f.district)).toBe(true); }
  });
  it('les fondateurs marqués actifs existent vraiment dans le monde', () => {
    const w = mk(); for (const f of FOUNDERS) { const c = w.chars.find((x) => x.name === f.name.replace(/^(Capitaine|Dr|Père) /, '')); expect(!!c).toBe(f.active); }
  });
  it('Tommy Blake : livreur de Noria Beach avec son secret', () => {
    const w = mk(); const t = w.chars.find((x) => x.name === 'Tommy Blake')!; expect(t.job).toBe('Livreur'); expect(t.secret).toMatch(/Victor Kane/); expect(w.chars.some((x) => x.name.includes('Ibrahim'))).toBe(false);
  });
  it('parler à Tommy fait avancer la quête secondaire', () => {
    const w = mk(); Quests.init(w); for (const id of ['c1m1', 'c1m2']) { Quests.refresh(w); w.quests[id].st = 'done'; } Quests.refresh(w); expect(w.quests.s1?.st).toBe('active');
    const t = w.chars.find((x) => x.name === 'Tommy Blake')!; I.noteTalk(w, t); expect(w.quests.s1.p[0]).toBe(1);
  });
});
