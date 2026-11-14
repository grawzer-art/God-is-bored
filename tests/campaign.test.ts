import { describe, it, expect } from 'vitest';
import { World } from '../src/sim/world';
import * as Quests from '../src/sim/quests';
import * as Camp from '../src/sim/campaign';
import * as Debt from '../src/sim/debt';
import * as Act from '../src/sim/interact';
import * as Shop from '../src/sim/shop';
import * as Romance from '../src/sim/romance';
import * as Fight from '../src/sim/fight';
import { toJSON, fromJSON } from '../src/sim/save';

const by = (w: World, n: string) => w.chars.find((c) => c.name === n)!;
function setup(seed = 61) {
  const w = new World(seed); w.build(); const av = w.avatar; av.money = 1000; av.pos = { x: 20.5, y: 27.5 }; av.gender = 'M'; av.age = 30; w.input = { dx: 0, dy: 0, run: false } as any; w.clock = 1440 + 10 * 60; w.lastDay = w.day();
  for (const c of w.chars) if (c.kind !== 'avatar') { c.away = true; }
  Quests.init(w); for (const id of ['c1m1']) { Quests.refresh(w); w.quests[id].st = 'done'; } Quests.refresh(w); return { w, av };
}
const place = (w: World, name: string, x: number, y: number) => { const c = by(w, name); c.away = false; c.state = 'idle'; c.jobPhase = ''; c.plan = []; c.pos = { x, y }; c.decision_cooldown = 99; return c; };
const done = (w: World, id: string) => w.quests[id]?.st === 'done' && !w.quests[id].failed; const failed = (w: World, id: string) => !!w.quests[id]?.failed;
const finishChain = (w: World, upTo: string[]) => { for (const id of upTo) { Quests.refresh(w); if (w.quests[id]) { w.quests[id].st = 'done'; } Quests.refresh(w); } };
const ticks = (w: World, n: number, dt = 0.1) => { for (let i = 0; i < n; i++) { w.tick(dt); } };

describe('NORIA — LES ROIS DU VIDE', () => {
  it('Mission 1 · Bienvenue à Noria : plage, Tommy, sandwich acheté, sandwich offert → récompense et confiance', () => {
    const { w, av } = setup(); expect(w.quests.r1?.st).toBe('active'); const t = by(w, 'Tommy Blake'); expect(t.away).toBe(false); const aff0 = w.getRel(t.id, av.id).aff; const m0 = av.money;
    w.tick(0.1); Quests.tick(w); expect(Camp.step(w, 'r1')).toBe(1); Act.noteTalk(w, t); expect(Camp.step(w, 'r1')).toBe(2);
    av.unpaid = { sandwich: 1 }; expect(Shop.pay(w, av)).toBeGreaterThan(0); expect(Camp.step(w, 'r1')).toBe(3); av.inventory.sandwich = 1; t.pos = { x: 21.2, y: 27.5 }; Act.choose(w, t, 'give_item', 'sandwich');
    expect(done(w, 'r1')).toBe(true); expect(w.getRel(t.id, av.id).aff).toBeGreaterThan(aff0 + 10); expect(av.money).toBeGreaterThan(m0 + 50); expect(w.camp.tommyTrust).toBe(true); expect(w.quests.r2?.st).toBe('active');
  });
  it('Mission 1 échouée : trop tard → Tommy plus distant, mais la campagne continue', () => {
    const { w, av } = setup(); const t = by(w, 'Tommy Blake'); const aff0 = w.getRel(t.id, av.id).aff; w.clock += 500; w.tick(0.1); expect(failed(w, 'r1')).toBe(true); expect(w.getRel(t.id, av.id).aff).toBeLessThan(aff0); expect(w.quests.r2?.st).toBe('active');
  });
  it('Mission 2 · Un petit service : colis de Tommy à Maya ; Victor intercepte ; mentir, avouer, céder ou se battre', () => {
    for (const choice of ['truth', 'give', 'fight', 'lie'] as const) {
      const { w, av } = setup(); finishChain(w, ['r1']); expect(w.quests.r2.st).toBe('active'); const t = place(w, 'Tommy Blake', 21.2, 27.5); const m = place(w, 'Maya Torres', 30.5, 27.5); const v = place(w, 'Victor Kane', 28.5, 27.5);
      Act.noteTalk(w, t); expect(Act.dialogueOpen(w, t).choices.some((c) => c.id === 'r2_accept')).toBe(true); Act.choose(w, t, 'r2_accept'); expect(w.job!.to).toBe(m.id); expect(av.inventory.parcel).toBe(1); expect(Camp.step(w, 'r2')).toBe(2);
      w.clock += 30; v.pos = { x: 27.5, y: 27.5 }; w.debt.due = w.clock + 5000; for (let i = 0; i < 60 && w.camp.ambush!.stage < 2; i++) { w.tick(0.1); if (w.camp.ambush!.stage === 1) v.pos = { x: av.pos.x + 1.2, y: av.pos.y }; }
      expect(w.camp.ambush!.stage).toBe(2); expect(Act.dialogueOpen(w, v).choices.map((c) => c.id)).toEqual(expect.arrayContaining(['a_lie', 'a_truth', 'a_give', 'a_fight'])); const due0 = w.debt.due; Act.choose(w, v, 'a_' + choice);
      if (choice === 'give') { expect(failed(w, 'r2')).toBe(true); expect(w.debt.due).toBeLessThan(due0); continue; }
      if (choice === 'fight') { expect(w.fighters.has(v.id)).toBe(true); Fight.end(w, v); Fight.end(w, av); }
      av.pos = { x: m.pos.x - 1, y: m.pos.y }; m.state = 'idle'; Act.choose(w, m, 'deliver'); expect(done(w, 'r2')).toBe(true); expect(w.camp.log.some((l) => /repousse l'échéance/.test(l))).toBe(true); void due0;
    }
  });
  it('Mission 3 · Les mauvaises fréquentations : payer la dette sauve la soirée ; laisser Tommy se faire battre fait échouer', () => {
    { const { w, av } = setup(); finishChain(w, ['r1', 'r2']); expect(w.quests.r3.st).toBe('active'); const t = place(w, 'Tommy Blake', 14.5, 27.5), v = place(w, 'Victor Kane', 22.5, 27.5); av.pos = { x: 12.5, y: 27.5 }; w.clock = 1440 + 19.6 * 60; w.lastDay = w.day(); w.debt.due = w.clock - 1; t.money = 20;
      for (let i = 0; i < 80 && w.debt.stage !== 'threat'; i++) w.tick(0.1); expect(w.debt.stage).toBe('threat'); expect(Camp.step(w, 'r3')).toBe(1); w.debt.helped = true; av.money = 6000; Act.choose(w, t, 'd_pay_all'); expect(done(w, 'r3')).toBe(true); }
    { const { w, av } = setup(); finishChain(w, ['r1', 'r2']); const t = place(w, 'Tommy Blake', 14.5, 27.5), v = place(w, 'Victor Kane', 15.5, 27.5); av.pos = { x: 3.5, y: 27.5 }; w.clock = 1440 + 19.6 * 60; w.lastDay = w.day(); w.debt.due = w.clock - 1; t.money = 800;
      for (let i = 0; i < 4000 && !w.stats.debt_beaten; i++) w.tick(0.1); expect(w.stats.debt_beaten).toBe(1); expect(failed(w, 'r3')).toBe(true); expect(w.quests.r4?.st).toBe('active'); }
  });
  it('Mission 4 · Une nuit au Mirage : entrer après 22 h, Maya, danser, Roxanne, régler la dispute (parole ou videur)', () => {
    const { w, av } = setup(); w.clock = 1440 + 23 * 60; w.lastDay = w.day(); finishChain(w, ['r1', 'r2', 'r3']); expect(w.quests.r4.st).toBe('active'); const bar = { x: 36.5, y: 14.5 };
    const m = place(w, 'Maya Torres', bar.x + 1, bar.y), r = place(w, 'Roxanne Bell', bar.x - 2, bar.y), mo = place(w, 'Moe Dalton', bar.x + 3, bar.y), v = place(w, 'Victor Kane', bar.x + 4, bar.y + 1); const mar = place(w, 'Marcus Rivera', bar.x - 3, bar.y + 1); void mar; void mo;
    av.pos = { x: 38.5, y: 14.5 }; w.tick(0.1); w.tick(0.1); expect(Camp.step(w, 'r4')).toBe(1); Act.noteTalk(w, m); expect(Camp.step(w, 'r4')).toBe(2); m.traits.extraversion = 1; av.drunk = 0; let ok = false; for (let i = 0; i < 25 && !ok; i++) ok = Romance.dance(w, av, m).ok; expect(ok).toBe(true); expect(Camp.step(w, 'r4')).toBe(3);
    Act.noteTalk(w, r); const ch = Act.dialogueOpen(w, r).choices.map((c) => c.id); expect(ch).toContain('r4_accept'); Act.choose(w, r, 'r4_accept'); expect(Camp.disputeActive(w)).toBe(true); expect(Camp.step(w, 'r4')).toBe(4);
    const d = w.camp.dispute!; const a = w.chars[d.a]; for (let i = 0; i < 400 && w.quests.r4.st === 'active'; i++) { if (i === 3) { const res = Camp.callBouncer(w); expect(res.ok).toBe(true); } w.tick(0.1); }
    expect(done(w, 'r4')).toBe(true); expect(w.camp.vip).toBe(true); void a;
  });
  it('Mission 5 · Personne n\'a rien vu : mentir ne suffit pas ; faire taire le témoin (argent) ou tout avouer mènent à des issues différentes', () => {
    const mk = () => { const { w, av } = setup(); finishChain(w, ['r1', 'r2', 'r3', 'r4']); const el = place(w, 'Elena Reyes', 20.5, 26.5); const wit = place(w, 'Noémie Rivière', 21.5, 27.5); wit.addMemory(w.clock, 'assault', 'Il a frappé quelqu\'un au Zinc.', -0.8, 1, av.id, { src: 'lived', conf: 1, subj: av.id }); Quests.refresh(w); return { w, av, el, wit }; };
    { const { w, av, el, wit } = mk(); expect(w.quests.r5.st).toBe('active'); expect(Camp.exposure(w)).toBe(1); Act.noteTalk(w, el); expect(Camp.step(w, 'r5')).toBe(1); const r = Act.choose(w, el, 'e_lie'); expect(r.line).toMatch(/1 personne/); expect(Camp.exposure(w)).toBe(1);
      av.money = 500; w.chars.forEach((c) => (c.away = true)); wit.away = false; el.away = false; let ok = false; for (let i = 0; i < 20 && !ok; i++) { const res = Act.choose(w, wit, 'w_silence_pay'); ok = !res.line.includes('police'); } expect(Camp.exposure(w)).toBe(0); w.tick(0.1); w.tick(0.6); expect(done(w, 'r5')).toBe(true); }
    { const { w, av, el } = mk(); Act.noteTalk(w, el); const f0 = w.record_.fines; const r = Act.choose(w, el, 'e_truth'); expect(r.line).toMatch(/honnête/); expect(done(w, 'r5')).toBe(true); expect(w.record_.fines).toBeGreaterThan(f0); expect(w.rep.police).toBeGreaterThan(0); }
    { const { w, av, el } = mk(); Act.noteTalk(w, el); Act.choose(w, el, 'e_deny'); const arrests = w.record_.arrests; w.clock += 700; w.tick(0.1); expect(failed(w, 'r5')).toBe(true); expect(w.record_.arrests).toBeGreaterThan(arrests); void av; }
  });
  it('la progression de campagne est sauvegardée et rechargée', () => {
    const { w } = setup(); finishChain(w, ['r1', 'r2']); w.camp.vip = true; w.camp.tommyTrust = true; w.quests.r3.p[0] = 1; const w2 = fromJSON(JSON.parse(JSON.stringify(toJSON(w))))!; expect(w2.quests.r2.st).toBe('done'); expect(w2.quests.r3.st).toBe('active'); expect(w2.quests.r3.p[0]).toBe(1); expect(w2.camp.vip).toBe(true);
  });
});
