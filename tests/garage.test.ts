import { describe, it, expect } from 'vitest';
import { World } from '../src/sim/world';
import * as Act from '../src/sim/interact';
import * as Garage from '../src/sim/garage';
import * as L from '../src/sim/layout';
import { MIN_PER_SEC } from '../src/sim/defs';

const mk = (seed = 5) => { const w = new World(seed); w.build(); return w; };
const run = (w: World, min: number) => { const n = Math.floor(min / (0.25 * MIN_PER_SEC)); for (let i = 0; i < n; i++) w.tick(0.25); };
describe('garage de Léo', () => {
  it('bâtiment réel : porte, intérieur « W », établis et voiture sur cric atteignables', () => {
    const w = mk(); const b = L.BUILDINGS.find((x) => x.name === 'garage')!; expect(b.kind).toBe('garage'); expect(L.roomAt(b.door![0], b.door![1])).toBe('W'); expect(L.roomAt(88, 4)).toBe('W');
    const slots = w.furn.filter((f) => f.slots.some((s) => s.tags.includes('repair'))); expect(slots.length).toBeGreaterThanOrEqual(3); for (const f of slots) { const st = f.slots[0].stands.map((q) => ({ x: f.x + q[0], y: f.y + q[1] })).find((c) => w.isWalkable(c))!; expect(st).toBeTruthy(); expect(w.pathTo({ x: 89.5, y: 7.5 }, st).length).toBeGreaterThan(0); }
  });
  it('Léo travaille réellement dans la journée (établi), et le garage est fermé la nuit', () => {
    const w = mk(); w.clock = 8.2 * 60; run(w, 5 * 60); const l = Garage.leo(w)!; expect((l.stats.done_repair ?? 0) + (l.stats.cut_repair ?? 0) + (l.state === 'use' && l.use_act === 'repair' ? 1 : 0)).toBeGreaterThan(0);
    w.clock = 1440 + 22 * 60; expect(Garage.closedReason(w)).toMatch(/fermé/);
  });
  it('travailler : le joueur est payé, réputation pro et relation avec Léo montent ; la clé augmente la paye ; fermé la nuit', () => {
    const w = mk(); w.clock = 10 * 60; const av = w.avatar; const l = Garage.leo(w)!; l.away = false; const bench = w.furn.find((f) => f.id === 'garage_bench')!;
    const opts = Act.furnitureOptions(w, bench.i); const o = opts.find((x) => x.act === 'repair'); expect(o).toBeTruthy(); const m0 = av.money; Garage.onRepairDone(w, av); expect(av.money).toBeGreaterThanOrEqual(m0 + 27); expect(w.rep.pro).toBeGreaterThan(0); expect(w.getRel(l.id, av.id).aff).toBeGreaterThan(0);
    av.money = 100; expect(Garage.buyTool(w, av).ok).toBe(true); expect(av.money).toBe(60); const m1 = av.money; Garage.onRepairDone(w, av); expect(av.money - m1).toBeGreaterThanOrEqual(38); expect(Garage.buyTool(w, av).ok).toBe(false);
    w.clock = 22 * 60; av.pos = { x: bench.x + 0.5, y: bench.y + 1.5 }; expect(Act.furnitureOptions(w, bench.i).some((x) => /fermé/.test(x.label))).toBe(true);
  });
  it('le dialogue de Léo propose travail, outil et nouvelles de Tommy', () => {
    const w = mk(); w.clock = 10 * 60; const l = Garage.leo(w)!; l.away = false; const ids = Act.dialogueOpen(w, l).choices.map((c) => c.id); expect(ids).toContain('g_job'); expect(ids).toContain('g_tool'); w.avatar.money = 100; Act.choose(w, l, 'g_tool'); expect(w.avatar.inventory.cle).toBe(1);
  });
});
