import { describe, it, expect } from 'vitest';
import { World } from '../src/sim/world';
import * as City from '../src/sim/city';
import * as Debt from '../src/sim/debt';
import * as Fight from '../src/sim/fight';
import * as Act from '../src/sim/interact';
import * as God from '../src/sim/god';
import * as Possess from '../src/sim/possess';
import * as Quests from '../src/sim/quests';
import { toJSON, fromJSON } from '../src/sim/save';

function setup(seed = 41) {
  const w = new World(seed); w.build(); const t = Debt.tommy(w)!, v = Debt.victor(w)!, av = w.avatar;
  for (const o of w.chars) if (![av.id, t.id, v.id].includes(o.id)) o.away = true;
  for (const c of [t, v]) { w.abortPlan(c, 't'); c.away = false; c.state = 'idle'; c.jobPhase = 'out'; c.decision_cooldown = 99; c.hp = 100; }
  w.clock = 1440 + 19.6 * 60; w.lastDay = w.day(); w.debt.due = w.clock - 1; w.debt.amount = 5000; t.money = 20;
  t.pos = { x: 14.5, y: 27.5 }; v.pos = { x: 22.5, y: 27.5 }; av.pos = { x: 5.5, y: 27.5 }; w.input = { dx: 0, dy: 0, run: false } as any; Quests.init(w);
  return { w, t, v, av };
}
const run = (w: World, sec: number, dt = 0.1) => { for (let i = 0; i < Math.round(sec / dt); i++) w.tick(dt); };
describe('la dette de Tommy (scénario émergent)', () => {
  it('sans intervention : échéance, menace, bagarre, Tommy dépouillé, la dette continue', () => {
    const { w, t, v } = setup(); t.money = 800; run(w, 200);
    expect(w.debt.log.some((l) => /Victor Kane réclame/.test(l))).toBe(true); expect(w.stats.debt_beaten === 1 || w.debt.stage === 'threat' || w.debt.stage === 'brewing').toBe(true);
    for (let i = 0; i < 20 && w.stats.debt_beaten !== 1; i++) run(w, 30); expect(w.stats.debt_beaten).toBe(1); expect(t.money).toBeLessThan(800); expect(v.money).toBeGreaterThan(900); expect(w.debt.stage).toBe('brewing'); expect(w.debt.due).toBeGreaterThan(w.clock);
  });
  it('le joueur paie la dette : issue « payée par le joueur », reconnaissance de Tommy, réputation sociale', () => {
    const { w, t, v, av } = setup(); av.money = 6000; w.debt.helped = true; const r = Act.choose(w, t, 'd_pay_all'); expect(r.close).toBe(true); expect(w.debt.stage).toBe('resolved'); expect(w.debt.outcome).toBe('paid_by_player');
    expect(v.money).toBeGreaterThan(5000); expect(w.getRel(t.id, av.id).aff).toBeGreaterThan(20); expect(t.memories.some((m) => /payé ma dette/.test(m.text))).toBe(true); expect(w.rep.social).toBeGreaterThan(0);
  });
  it('manque d\'argent : refusé sans effet ; paiement partiel : la dette baisse et l\'échéance recule', () => {
    const { w, t, v, av } = setup(); av.money = 1500; w.debt.helped = true; expect(Act.dialogueOpen(w, t).choices.find((c) => c.id === 'd_pay_all')!.enabled).toBe(false);
    const due0 = w.debt.due; const r = Act.choose(w, v, 'v_pay_part'); expect(r.line).toMatch(/Il en reste 4000/); expect(w.debt.amount).toBe(4000); expect(w.debt.due).toBeGreaterThan(due0); expect(av.money).toBe(500);
  });
  it('miracle divin : si Tommy reçoit la somme, il paie lui-même', () => {
    const { w, t } = setup(); God.give(w, t, 6000); run(w, 3); expect(w.debt.stage).toBe('resolved'); expect(w.debt.outcome).toBe('paid_by_tommy');
  });
  it('négocier : un délai parfois accordé (échéance repoussée de deux jours), parfois refusé', () => {
    let got = 0, refused = 0; for (let s = 1; s < 25; s++) { const { w, v, av } = setup(s); av.traits.extraversion = 0.9; const due0 = w.debt.due; const r = Act.choose(w, v, 'v_delay'); if (w.debt.due > due0) { got++; expect(w.debt.due - due0).toBeGreaterThanOrEqual(2880); } else { refused++; expect(r.line).toMatch(/Non/); } }
    expect(got).toBeGreaterThan(0); expect(refused).toBeGreaterThan(0);
  });
  it('bagarre : Victor mis KO → rancune, vendetta, il revient régler ses comptes plus tard', () => {
    const { w, v, av } = setup(); v.pos = { x: 6.4, y: 27.5 }; Fight.start(w, av, v); w.fighters.get(v.id)!.ai = null; v.hp = 3; Fight.attack(w, av, 'quick'); run(w, 1.5); expect(v.state).toBe('ko');
    run(w, 5); expect(w.debt.vendetta).toBe(true); expect(w.stats.debt_vic_ko).toBe(1); expect(w.getRel(v.id, av.id).aff).toBeLessThan(-30);
    v.state = 'idle'; v.pose = 'stand'; v.hp = 100; v.pos = { x: 10.5, y: 27.5 }; av.pos = { x: 5.5, y: 27.5 }; w.clock = w.debt.revengeAt + 5; run(w, 2); expect(w.fighters.has(v.id) && w.fighters.has(av.id)).toBe(true);
  });
  it('police : Tommy signale Kane ; Elena enquête, ou le dossier est étouffé selon la corruption', () => {
    const outcomes = new Set<string>(); for (let s = 1; s < 30 && outcomes.size < 2; s++) { const { w, t, av } = setup(s); w.getRel(t.id, av.id).trust = 40; w.getRel(t.id, av.id).aff = 30; const r = Act.choose(w, t, 'd_police'); expect(r.close).toBe(true); expect(w.debt.reported).toBe(true); w.clock += 50; run(w, 2); outcomes.add(w.debt.stage === 'resolved' ? w.debt.outcome : 'shielded'); }
    expect(outcomes.has('police')).toBe(true); expect(outcomes.has('shielded')).toBe(true);
  });
  it('incarner Tommy : on paie Victor de sa poche (mêmes règles du monde)', () => {
    const { w, t, v } = setup(); const av0 = w.avatar; Possess.start(w, t.id); expect(w.avatar.name).toBe('Tommy Blake'); w.avatar.money = 6000; const ch = Act.dialogueOpen(w, v).choices.map((c) => c.id); expect(ch).toContain('v_pay_me');
    const r = Act.choose(w, v, 'v_pay_me'); expect(w.debt.stage).toBe('resolved'); void r; void av0;
  });
  it('parler à Victor fait avancer la quête ; sauvegarde et rechargement conservent l\'état', () => {
    const { w, t, v, av } = setup(); Quests.init(w); w.quests.c1m1 && (w.quests.c1m1.st = 'done'); Quests.refresh(w); w.quests.c1m2 && (w.quests.c1m2.st = 'done'); Quests.refresh(w); expect(w.quests.s2?.st).toBe('active');
    Act.choose(w, t, 'd_help'); Act.noteTalk(w, v); expect(w.quests.s2.p[0]).toBe(1); expect(w.quests.s2.p[1]).toBe(1); w.debt.extended = 2; w.rep.criminal = 12; const w2 = fromJSON(JSON.parse(JSON.stringify(toJSON(w))))!; expect(w2.debt.extended).toBe(2); expect(w2.debt.helped).toBe(true); expect(w2.rep.criminal).toBe(12); void av;
  });
});
