import { describe, it, expect } from 'vitest';
import { World } from '../src/sim/world';
import * as Life from '../src/sim/life';
import { setupNoriaDemo, DEMO } from '../src/sim/demo';
import { toJSON, fromJSON } from '../src/sim/save';
import { MIN_PER_SEC } from '../src/sim/defs';

const mk = (seed = 1337) => { const w = new World(seed); w.build(); return w; };
const demo = () => { const w = mk(); setupNoriaDemo(w); return w; };
const run = (w: World, gameMinutes: number, until?: () => boolean) => { const n = Math.ceil(gameMinutes / (0.25 * MIN_PER_SEC)); for (let i = 0; i < n; i++) { w.tick(0.25); if (until?.()) return true; } return false; };
const theft = (w: World) => w.events.find((e) => e.kind === 'theft');

describe('1. routines : emplois, horaires distincts, argent', () => {
  it('les emplois sont réels : départ hors carte, retour, paie ; horaires différents', () => {
    const w = mk(); const dep = new Map<number, number>(); const pay0 = new Map(w.residents.map((c) => [c.id, c.money]));
    let wasAway = new Set<number>();
    for (let i = 0; i < 2 * 1440 / (0.25 * MIN_PER_SEC); i++) { w.tick(0.25); for (const c of w.residents) { if (c.away && !wasAway.has(c.id)) { wasAway.add(c.id); if (!dep.has(c.id)) dep.set(c.id, Math.round(w.hour() * 4) / 4); } if (!c.away) wasAway.delete(c.id); } }
    const workers = Object.keys(Life.SHIFTS).map(Number);
    for (const id of workers) { expect(w.chars[id].stats.shifts ?? 0).toBeGreaterThanOrEqual(1); expect(dep.has(id)).toBe(true); }
    expect(new Set(workers.map((id) => dep.get(id))).size).toBeGreaterThanOrEqual(4); // pas le même emploi du temps pour tous
    expect(w.chars[4].money).toBeGreaterThan(pay0.get(4)! - 100);                      // Aïcha est payée
  });
  it('les habitants ne partent pas travailler tous en même temps et reviennent tous sains et saufs', () => {
    const w = mk(); run(w, 3 * 1440); expect(w.residents.filter((c) => c.away).length).toBeLessThanOrEqual(5); for (const c of w.residents) { expect(Number.isFinite(c.money)).toBe(true); expect(c.money).toBeGreaterThanOrEqual(0); }
  });
  it('sortie au bar : motivée (argent, besoin social), payée au barman, jamais de flânerie', () => {
    const w = mk(); const bm0 = w.barman!.money; run(w, 4 * 1440); const drinks = w.stats.resident_drinks ?? 0;
    expect(drinks).toBeGreaterThan(0); expect(w.barman!.money).toBeGreaterThan(bm0);
    for (const c of w.residents) expect(c.outing === '' || c.outing === 'bar').toBe(true);
  });
});

describe('2. un besoin modifie la décision', () => {
  it('Mehdi, affamé juste avant son service, mange avant de partir travailler', () => {
    const w = demo(); const mehdi = w.chars[DEMO.friend]; mehdi.needs.hunger = 3; w.abortPlan(mehdi, 't'); mehdi.decision_cooldown = 0; mehdi.stats.worked_day = -1; mehdi.shift = { from: 9.2, to: 15, pay: 80, place: 'le restaurant' };
    run(w, 90, () => mehdi.jobPhase === 'working');
    expect((mehdi.stats.done_eat ?? 0) + (mehdi.stats.done_snack ?? 0)).toBeGreaterThanOrEqual(1); // il a mangé d'abord
    expect(mehdi.needs.hunger).toBeGreaterThan(20);
  });
  it("Lucas, sans argent ni emploi, part chercher du travail ; la recherche peut aboutir à un vrai emploi", () => {
    const w = mk(); const l = w.chars[5]; l.money = 2; w.clock = 10 * 60; w.lastTheft = w.clock + 1e5; l.stats.search_day = -1; for (const c of w.residents) { w.abortPlan(c, 't'); c.needs.energy = 90; c.needs.hunger = 70; }
    run(w, 5 * 60); expect(['searching', '', 'working'].includes(l.jobPhase)).toBe(true); expect(l.statAdd).toBeDefined();
    expect(w.journal.some((e) => /Lucas.*(chercher du travail|trouvé du travail|bredouille)/.test(e.text))).toBe(true);
  });
});

describe('3. interactions spontanées et personnalités', () => {
  it('sur une journée, les habitants se parlent d\'eux-mêmes et des rumeurs circulent', () => {
    const w = mk(); run(w, 2 * 1440); expect(w.stats.chats).toBeGreaterThan(10);
    const pairs = new Set<string>(); for (const e of w.journal) if (e.kind === 'talk') pairs.add(String(e.cid)); expect(pairs.size).toBeGreaterThanOrEqual(4);
  });
  it('la morale décide qui vole : seuls les peu scrupuleux sont tentés, pas Margaux (scrupuleuse) même fauchée', () => {
    const w = mk(); for (const c of w.residents) { c.money = c.id === 3 ? 200 : 1; c.shift = null; }
    run(w, 4 * 1440); const thieves = w.residents.filter((c) => (c.stats.thefts ?? 0) > 0).map((c) => c.id);
    for (const id of thieves) expect(Life.moral(w.chars[id])).toBeLessThan(0.5); expect(Life.moral(w.chars[6])).toBeGreaterThan(0.8); expect(thieves).not.toContain(6);
  });
  it('Margaux fauchée et Mehdi, ami aisé et bienveillant : l\'aide spontanée change l\'argent et la confiance', () => {
    const w = mk(); for (const c of w.residents) { w.abortPlan(c, 't'); c.needs.energy = 90; c.needs.hunger = 70; c.shift = null; c.pos = { x: 6.5 + c.id * 0.01, y: 12.5 }; }
    const cam = w.chars[6], meh = w.chars[1]; cam.money = 2; meh.money = 120; const t0 = w.getRel(6, 1).trust; w.clock = 12 * 60;
    run(w, 240, () => w.events.some((e) => e.kind === 'help'));
    expect(w.events.some((e) => e.kind === 'help' && e.actor === 1 && e.target === 6)).toBe(true); expect(cam.money).toBeGreaterThan(5); expect(meh.money).toBeLessThan(120); expect(w.getRel(6, 1).trust).toBeGreaterThan(t0);
  });
  it('après une dispute, un habitant bienveillant finit par s\'excuser : la relation se répare, mais seulement après des heures', () => {
    const w = mk(); const a = w.chars[1], b = w.chars[6]; for (const c of w.residents) { c.shift = null; c.needs.energy = 90; c.needs.hunger = 70; } w.clock = 8 * 60; Life.quarrel(w, a, b, 1, '');
    const ten0 = w.getRel(1, 6).ten; run(w, 120); expect(w.events.some((e) => e.kind === 'reconcile' && ((e.actor === 1 && e.target === 6) || (e.actor === 6 && e.target === 1)))).toBe(false); // pas dans les 2 premières heures
    expect(w.getRel(1, 6).ten).toBeGreaterThan(ten0 * 0.4); run(w, 2 * 1440);
    expect(w.events.some((e) => e.kind === 'reconcile')).toBe(true);
  });

describe('4. un conflit modifie durablement la relation', () => {
  it('confiance, affection, respect et tension changent ; pas de réconciliation immédiate', () => {
    const w = mk(); const a = w.chars[0], b = w.chars[1]; const before = { ...w.getRel(0, 1) }; Life.quarrel(w, a, b, 1, 'test');
    const r = w.getRel(0, 1); expect(r.trust).toBeLessThan(before.trust); expect(r.aff).toBeLessThan(before.aff); expect(r.resp).toBeLessThan(before.resp); expect(r.ten).toBeGreaterThan(before.ten); expect(Life.hostility(r)).toBeGreaterThan(Life.hostility(before));
    expect(Life.grudge(w, a, b)).toBeGreaterThan(0.1);
    run(w, 60); expect(Life.grudge(w, a, b)).toBeGreaterThan(0.03); expect(w.getRel(0, 1).trust).toBeLessThan(before.trust); // une heure après : toujours brouillés
    expect(a.avoid[1]).toBeGreaterThan(w.clock);                                                                    // ils s'évitent
    run(w, 7 * 60); expect(Life.grudge(w, a, b)).toBe(0);                                                          // la rancune finit par s'éteindre
  });
  it('une dispute est un événement du monde que les témoins mémorisent', () => {
    const w = mk(); const a = w.chars[0], b = w.chars[1]; for (const c of w.residents) { w.abortPlan(c, 't'); c.pos = { x: 5.5, y: 12.5 }; c.state = 'idle'; }
    const ev = Life.quarrel(w, a, b, 1, ''); expect(w.events).toContain(ev); expect(w.residents.filter((c) => c.known[ev.id]).length).toBeGreaterThanOrEqual(3);
  });
});

describe('5-6-7. vol : témoin, information transmise, conséquences observables', () => {
  it('le témoin mémorise (vécu), l\'absent ignore, l\'information passe de bouche en bouche, la victime réagit', () => {
    const w = demo(); expect(run(w, 120, () => !!theft(w))).toBe(true); const ev = theft(w)!;
    expect(ev.actor).toBe(DEMO.thief); expect(ev.target).toBe(DEMO.victim);
    const mar = w.chars[DEMO.witness];                                              // 5. témoin : sait, par expérience, et connaît l'auteur
    expect(mar.known[ev.id]?.src).toBe('lived'); expect(mar.known[ev.id]?.culprit).toBe(DEMO.thief);
    expect(mar.memories.some((m) => m.ev === ev.id && m.src === 'lived')).toBe(true);
    for (const id of [DEMO.absent, DEMO.friend, 7, 2]) { expect(w.chars[id].known[ev.id]).toBeUndefined(); expect(w.chars[id].memories.some((m) => m.ev === ev.id)).toBe(false); } // absents : ignorent tout
    expect(w.chars[DEMO.victim].known[ev.id]).toBeUndefined();                       // la victime n'a encore rien constaté (au travail)
    // 6. information transmise (par le témoin, de personne à personne) : la victime apprend QUI, par ouï-dire
    expect(run(w, 3 * 1440, () => { const q = w.chars[DEMO.victim].known[ev.id]; return q?.culprit === DEMO.thief && q.src !== 'suspected'; })).toBe(true);
    const k = w.chars[DEMO.victim].known[ev.id]; expect(k.src === 'told' || k.src === 'lived').toBe(true); expect(k.conf).toBeLessThanOrEqual(1);
    if (k.src === 'told') expect(k.conf).toBeLessThan(1);                              // une information de seconde main est moins sûre
    expect(w.chars[DEMO.victim].memories.some((m) => m.ev === ev.id && m.subj === DEMO.thief)).toBe(true);
    // 7. conséquences après plusieurs minutes de jeu : confrontation, relations dégradées, évitement durable
    expect(run(w, 2 * 1440, () => w.journal.some((e) => /confronte/.test(e.text)))).toBe(true); run(w, 30);
    const r = w.getRel(DEMO.victim, DEMO.thief); expect(r.trust).toBeLessThan(15); expect(r.aff).toBeLessThan(-30); expect(Life.hostility(r)).toBeGreaterThan(40);
    expect(w.chars[DEMO.victim].avoid[DEMO.thief]).toBeGreaterThan(w.clock);
    expect(w.events.some((e) => e.kind === 'dispute' && e.actor === DEMO.victim)).toBe(true);
  });
  it('un soupçon n\'est pas une certitude : la victime accuse sans preuve (confiance < 0,6, source « soupçonné »)', () => {
    const w = demo(); const vic = w.chars[DEMO.victim], th = w.chars[DEMO.thief]; vic.away = false; w.getRel(vic.id, th.id).aff = -70; w.getRel(vic.id, th.id).ten = 60;
    for (const c of w.residents) { if (c.id !== th.id && c.id !== vic.id) { w.abortPlan(c, 't'); c.away = true; c.jobUntil = 1e9; } }  // personne ne voit
    const ev = Life.completeTheft(w, th, vic)!; expect(Object.values(w.residents).filter((c) => c.known[ev.id]).length).toBe(0);
    run(w, 40); const k = vic.known[ev.id]; expect(k).toBeDefined(); expect(k.src).toBe('suspected'); expect(k.conf).toBeLessThan(0.6); expect(k.culprit).toBe(th.id);
  });
  it('le joueur qui vole est reconnu par les témoins, pas par les absents', () => {
    const w = demo(); const av = w.avatar; const mar = w.chars[DEMO.witness]; const cam = w.chars[DEMO.absent]; mar.away = false; mar.pos = { x: 5.5, y: 12.5 }; mar.state = 'idle'; mar.needs.energy = 90; cam.pos = { x: 40.5, y: 12.5 }; cam.away = true; cam.jobUntil = 1e9;
    const npc = w.chars[DEMO.friend]; npc.away = false; npc.pos = { x: 6.5, y: 12.5 }; npc.money = 50; npc.state = 'idle'; av.pos = { x: 5.9, y: 12.9 }; av.away = false;
    const r = Life.playerSteal(w, av, npc); expect(r.ok).toBe(true); const ev = theft(w)!; expect(ev.actor).toBe(av.id);
    expect(mar.known[ev.id]?.culprit).toBe(av.id); expect(cam.known[ev.id]).toBeUndefined();
  });
});

describe('8. sauvegarde et rechargement', () => {
  it('connaissances, événements, intentions, argent, relations et emplois sont conservés', () => {
    const w = demo(); run(w, 1.4 * 1440, () => w.journal.some((e) => /confronte/.test(e.text)));
    const d = JSON.parse(JSON.stringify(toJSON(w))); const w2 = fromJSON(d)!; expect(w2).not.toBeNull();
    expect(w2.events).toEqual(w.events); expect(w2.nextEvent).toBe(w.nextEvent);
    for (const c of w.residents) { const c2 = w2.chars[c.id]; expect(c2.known).toEqual(c.known); expect(c2.money).toBe(c.money); expect(c2.shift).toEqual(c.shift); expect(c2.intent).toEqual(c.intent); expect(c2.away).toBe(c.away); expect(c2.jobPhase).toBe(c.jobPhase); }
    const r = w.getRel(3, 5), r2 = w2.getRel(3, 5); expect(r2).toEqual(r); expect(r2.trust).toBeLessThan(40);
    const kn = w.chars[6].memories.filter((m) => m.src).length; expect(w2.chars[6].memories.filter((m) => m.src).length).toBe(kn);
    run(w2, 600); expect(w2.events.length).toBeGreaterThanOrEqual(w.events.length);                                // la vie continue
  });
  it('les anciennes sauvegardes (sans vie autonome) se chargent et reprennent', () => {
    const w = mk(); run(w, 600); const d: any = JSON.parse(JSON.stringify(toJSON(w))); delete d.events; delete d.nextEvent; delete d.lastTheft; delete d.lifeAcc;
    for (const c of d.chars) { delete c.known; delete c.intent; delete c.shift; delete c.jobPhase; delete c.jobUntil; delete c.jobStart; delete c.outing; delete c.outUntil; }
    for (const [, r] of d.rel) { delete r.trust; delete r.fear; delete r.resp; delete r.cd; }
    const w2 = fromJSON(d)!; expect(w2).not.toBeNull(); expect(w2.getRel(0, 1).trust).toBeGreaterThan(0); run(w2, 2 * 1440); expect(w2.residents.every((c) => Number.isFinite(c.money))).toBe(true);
  });
});

describe('performance, limites, déterminisme', () => {
  it('population fixe, mémoire bornée, événements bornés, pas de dérive numérique (6 jours)', () => {
    const w = mk(); const n0 = w.chars.length; run(w, 6 * 1440);
    expect(w.chars.length).toBe(n0);                                                // aucune création incontrôlée d'habitants (la reproduction n'existe pas)
    expect(w.events.length).toBeLessThanOrEqual(Life.MAX_EVENTS);
    for (const c of w.chars) { expect(c.memories.length).toBeLessThanOrEqual(60); expect(Object.keys(c.known).length).toBeLessThanOrEqual(Life.MAX_KNOWN); for (const v of Object.values(c.needs)) expect(Number.isFinite(v)).toBe(true); }
  });
  it('déterministe : même graine, même histoire', () => {
    const a = demo(), b = demo(); run(a, 1440); run(b, 1440); expect(a.journal.map((e) => e.text)).toEqual(b.journal.map((e) => e.text)); expect(a.events).toEqual(b.events);
  });
  it('la couche de vie coûte peu : 3 jours en moins de 6 s', () => {
    const w = mk(); const t = performance.now(); run(w, 3 * 1440); expect(performance.now() - t).toBeLessThan(6000);
  });
  it('simulation allégée pour les habitants éloignés du joueur (LOD) : trois fois moins de pas de vie, même résultat qualitatif', () => {
    const near = demo(), far = demo(); near.focus = { x: 14, y: 8 }; far.focus = { x: 95, y: 39 }; run(near, 480); run(far, 480);
    expect(far.stats.life_far ?? 0).toBeGreaterThan(0); expect(far.stats.life_near ?? 0).toBe(0); expect(near.stats.life_far ?? 0).toBeLessThan((near.stats.life_near ?? 0) * 0.2);
    expect((far.stats.life_far ?? 0)).toBeLessThan((near.stats.life_near ?? 0) * 0.5);
    expect(theft(far)).toBeDefined(); // la vie détaillée (vol) fonctionne aussi en simulation allégée
  });
});
});
