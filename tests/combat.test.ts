import { describe, it, expect } from 'vitest';
import { World } from '../src/sim/world';
import * as City from '../src/sim/city';
import * as Combat from '../src/sim/combat';
import * as Act from '../src/sim/interact';

function setup() {
  const w = new World(11); w.build(); City.populate(w);
  const t = w.chars.find((x) => x.name === 'Tommy Blake')!; const av = w.avatar;
  w.abortPlan(av, 't'); w.abortPlan(t, 't'); t.away = false; t.state = 'idle'; t.jobPhase = 'out';
  av.pos = { x: 20.5, y: 25.5 }; t.pos = { x: 21.3, y: 25.5 };
  for (const o of w.chars) if (o.id !== av.id && o.id !== t.id) o.away = true;
  return { w, t, av };
}
describe('combat de base', () => {
  it('un coup blesse réellement, crée un souvenir, une relation dégradée et un délit', () => {
    const { w, t, av } = setup(); const hp0 = t.hp; const r = Combat.punch(w, av, t);
    expect(r.ok).toBe(true); expect(t.hp).toBeLessThan(hp0); expect(t.memories.some((m) => m.kind === 'assault')).toBe(true);
    expect(w.getRel(t.id, av.id).aff).toBeLessThan(0); expect(w.record_.assaults).toBe(1); expect(w.events.some((e: any) => e.kind === 'assault')).toBe(true);
  });
  it('trop loin ou trop tôt : refusé ; un agent de police ne peut pas être frappé', () => {
    const { w, t, av } = setup(); t.pos = { x: 30.5, y: 25.5 }; expect(Combat.punch(w, av, t).ok).toBe(false);
    t.pos = { x: 21.3, y: 25.5 }; expect(Combat.punch(w, av, t).ok).toBe(true); expect(Combat.punch(w, av, t).ok).toBe(false);
    const cop = w.chars.find((x) => x.kind === 'police')!; cop.away = false; cop.pos = { x: 21.2, y: 25.5 }; expect(Combat.punch(w, av, cop).ok).toBe(false);
  });
  it('coups répétés : KO puis relèvement', () => {
    const { w, t, av } = setup(); t.hp = 10; const r = Combat.punch(w, av, t);
    expect(r.ok).toBe(true); expect(t.state).toBe('ko'); expect(t.pose).toBe('lie'); w.clock += 30; Combat.tick(w, 0.1, 0.1); expect(t.state).toBe('idle'); expect(t.hp).toBeGreaterThan(0);
  });
  it('la victime courageuse riposte, la craintive fuit ; l\'avatar KO se réveille chez lui moins riche', () => {
    const { w, t, av } = setup(); t.traits.neuroticism = 0.05; t.traits.agreeableness = 0.05; t.anger = 60; Combat.punch(w, av, t);
    expect(w.fights.length).toBe(1); const hp0 = av.hp; for (let i = 0; i < 40; i++) Combat.tick(w, 0.3, 0.05); expect(av.hp).toBeLessThan(hp0);
    av.hp = 3; av.money = 100; w.fights = []; t.pos = { x: av.pos.x + 0.8, y: av.pos.y }; t.stats.punch_at = -1e9; t.state = 'idle'; Combat.punch(w, t, av); expect(av.hp).toBe(40); expect(av.money).toBeLessThan(100); expect(w.record_.knockouts).toBe(1);
  });
  it('le choix « Frapper » existe dans le dialogue et agit sur le monde', () => {
    const { w, t } = setup(); const d = Act.dialogueOpen(w, t); expect(d.choices.some((c) => c.id === 'punch')).toBe(true);
    const res = Act.choose(w, t, 'punch'); expect(t.hp).toBeLessThan(100); expect(res.close).toBe(true);
  });
});
