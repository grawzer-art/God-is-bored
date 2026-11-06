import { describe, it, expect } from 'vitest';
import { World } from '../src/sim/world';
import * as City from '../src/sim/city';
import * as Weather from '../src/sim/weather';
import { toJSON, fromJSON } from '../src/sim/save';

const mk = (seed = 5) => { const w = new World(seed); w.build(); City.populate(w); return w; };
describe('météo', () => {
  it('le temps change tout seul sur plusieurs jours (déterministe)', () => {
    const run = () => { const w = mk(9); const seen = new Set<string>(); for (let i = 0; i < 20 * 1440; i += 10) { w.clock = i; Weather.tick(w, 10); seen.add(w.weather.kind); } return [...seen].sort().join(); };
    const a = run(); expect(a).toContain('clear'); expect(a).toContain('rain'); expect(run()).toBe(a);
  });
  it('ordre divin : la pluie assombrit et vide la plage, sauvegarde conservée', () => {
    const w = mk(); Weather.set(w, 'storm', 120); expect(Weather.isWet(w)).toBe(true); expect(Weather.intensity(w)).toBe(1);
    const w2 = fromJSON(JSON.parse(JSON.stringify(toJSON(w))))!; expect(w2.weather.kind).toBe('storm');
    const c = w.chars.find((x) => x.kind === 'citizen')!; c.away = false; c.pos = { x: 20.5, y: 26.5 }; c.state = 'idle'; c.plan = [];
    c.decision_cooldown = 0; for (let i = 0; i < 50; i++) { City.decide(w, c); } expect(c.plan.some((s: any) => s.act === 'rest')).toBe(false);
  });
});
