import { describe, it, expect } from 'vitest';
import { World } from '../src/sim/world';
import { setupTrioDemo, TRIO } from '../src/sim/demo';
import { brief, activityIcon } from '../src/sim/observe';
import { toJSON, fromJSON } from '../src/sim/save';
import { MIN_PER_SEC } from '../src/sim/defs';

const mk = () => { const w = new World(1337); w.build(); setupTrioDemo(w); return w; };
const run = (w: World, gameMin: number, each?: () => void) => { const n = Math.ceil(gameMin / (0.25 * MIN_PER_SEC)); for (let i = 0; i < n; i++) { w.tick(0.25); each?.(); } };
const A = (w: World) => w.chars[TRIO.A], B = (w: World) => w.chars[TRIO.B], C = (w: World) => w.chars[TRIO.C], P = (w: World) => w.chars[TRIO.partner];

describe('Démo vivante : les six étapes, avec les vrais systèmes', () => {
  it('1+2. décisions prises sans le joueur, déplacements visibles et cohérents', () => {
    const w = mk(); const walked: Record<number, number> = { 4: 0, 5: 0, 0: 0 }; const last: Record<number, { x: number; y: number }> = {}; for (const id of [4, 5, 0]) last[id] = { ...w.chars[id].pos };
    const used = new Set<string>(); const where = new Set<string>();
    run(w, 150, () => { for (const id of [4, 5, 0]) { const c = w.chars[id]; if (!c.away) { const d = Math.hypot(c.pos.x - last[id].x, c.pos.y - last[id].y); expect(d).toBeLessThan(0.6); walked[id] += d; if (c.state === 'use') used.add(c.use_act); } last[id] = { ...c.pos }; if (!c.away && ['walk', 'idle', 'chat'].includes(c.state)) expect(w.isWalkable({ x: Math.floor(c.pos.x), y: Math.floor(c.pos.y) })).toBe(true); where.add(w.roomOf(c.pos)); } });
    for (const id of [4, 5, 0]) expect(walked[id]).toBeGreaterThan(8);                  // chacun s'est réellement déplacé (pas de téléportation, pas de mur)
    expect(used.size).toBeGreaterThanOrEqual(3); expect(where.size).toBeGreaterThanOrEqual(3); // plusieurs activités, plusieurs pièces
    expect(w.residents.reduce((n, c) => n + (c.stats.act_eat ?? 0) + (c.stats.act_shower ?? 0) + (c.stats.act_tv ?? 0), 0)).toBeGreaterThan(0);
  });
  it('A : routine du matin — petit-déjeuner puis départ au travail à l\'heure (puis retour payé)', () => {
    const w = mk(); const seq: string[] = []; const m0 = A(w).money;
    run(w, 125, () => { const c = A(w); const k = c.away ? 'travail' : c.state === 'use' ? c.use_act : ''; if (k && seq[seq.length - 1] !== k) seq.push(k); });
    expect(seq.some((x) => ['eat', 'serve', 'snack', 'cook'].includes(x))).toBe(true);
    expect(A(w).away).toBe(true); expect(A(w).jobPhase).toBe('working'); expect(w.hour()).toBeLessThan(9.6); expect(w.hour()).toBeGreaterThan(8.2);
    expect(seq.findIndex((x) => ['eat', 'serve', 'snack', 'cook'].includes(x))).toBeLessThan(seq.indexOf('travail')); // le repas vient avant le départ
    run(w, 9.6 * 60); expect(A(w).away).toBe(false); expect(A(w).money).toBeGreaterThan(m0 + 100); // payée au retour
  });
  it('B : un besoin urgent interrompt la télé — il va manger, puis reprend sa soirée', () => {
    const w = mk(); expect(B(w).state).toBe('use'); expect(B(w).use_act).toBe('tv'); expect(B(w).needs.hunger).toBeLessThan(6);
    let ateAt = -1, leftTv = -1; run(w, 120, () => { const b = B(w); if (leftTv < 0 && !(b.state === 'use' && b.use_act === 'tv')) leftTv = w.clock; if (ateAt < 0 && b.state === 'use' && ['snack', 'eat', 'serve', 'cook'].includes(b.use_act)) ateAt = w.clock; });
    expect(leftTv).toBeGreaterThan(0); expect(ateAt).toBeGreaterThan(0); expect(ateAt - leftTv).toBeLessThan(45); expect(B(w).needs.hunger).toBeGreaterThan(20);
    expect(B(w).stats.act_eat + (B(w).stats.act_snack ?? 0) >= 1 || B(w).stats.done_snack >= 1 || B(w).stats.done_eat >= 1).toBe(true);
    const br = brief(w, B(w)); expect(br.need.length).toBeGreaterThan(0);
  });
  it('3+4+5. C engage spontanément la conversation ; l\'événement est mémorisé ; la relation change', () => {
    const w = mk(); const r0 = { ...w.getRel(TRIO.C, TRIO.partner) }; const r0b = { ...w.getRel(TRIO.partner, TRIO.C) }; let started = false;
    run(w, 120, () => { if (C(w).state === 'chat' || C(w).talking) started = true; });
    expect(started).toBe(true); expect(C(w).stats.chats ?? 0).toBeGreaterThanOrEqual(1);
    const m = C(w).memories.find((x) => x.other === TRIO.partner && x.kind === 'chat'); expect(m).toBeDefined(); expect(m!.text.length).toBeGreaterThan(5);   // événement mémorisé
    const r1 = w.getRel(TRIO.C, TRIO.partner); expect(Math.abs(r1.aff - r0.aff) + Math.abs(r1.fam - r0.fam) + Math.abs(r1.ten - r0.ten)).toBeGreaterThan(0.5); // conséquence sur la relation
    expect(r1.n).toBeGreaterThan(r0.n); expect(w.getRel(TRIO.partner, TRIO.C).n).toBeGreaterThan(r0b.n);   // des deux côtés
    expect(P(w).memories.some((x) => x.other === TRIO.C)).toBe(true);
  });
  it('6. conséquence encore présente après sauvegarde et rechargement', () => {
    const w = mk(); run(w, 130); const r = JSON.parse(JSON.stringify(w.getRel(TRIO.C, TRIO.partner))); const memC = JSON.stringify(C(w).memories); const money = A(w).money;
    const w2 = fromJSON(JSON.parse(JSON.stringify(toJSON(w))))!; expect(w2).not.toBeNull();
    expect(w2.getRel(TRIO.C, TRIO.partner)).toEqual(r); expect(JSON.stringify(w2.chars[TRIO.C].memories)).toBe(memC); expect(w2.chars[TRIO.A].money).toBe(money);
    expect(w2.chars[TRIO.A].away).toBe(A(w).away); expect(w2.chars[TRIO.A].jobPhase).toBe(A(w).jobPhase);
    run(w2, 120); expect(w2.getRel(TRIO.C, TRIO.partner).n).toBeGreaterThanOrEqual(r.n);                     // la vie continue sur la base rechargée
  });
  it('déterministe : deux lancements donnent exactement la même histoire', () => {
    const a = mk(), b = mk(); run(a, 200); run(b, 200); expect(a.journal.map((e) => e.text)).toEqual(b.journal.map((e) => e.text)); expect(JSON.stringify(a.getRel(0, 1))).toBe(JSON.stringify(b.getRel(0, 1)));
  });
});

describe('Observation : tout ce qui est affiché vient de l\'état réel', () => {
  it('l\'icône d\'activité annonce ce que l\'habitant va faire, la destination suit son plan', () => {
    const w = mk(); let walkToUse = 0, checked = 0;
    run(w, 100, () => { for (const id of [4, 5, 0, 1]) { const c = w.chars[id]; if (c.away) continue; const br = brief(w, c); const ic = activityIcon(w, c);
      if (c.state === 'walk' && c.plan.some((s) => s.type === 'use' && (s.act === 'eat' || s.act === 'snack' || s.act === 'serve' || s.act === 'cook'))) { expect(['fork', 'pan']).toContain(ic); expect(br.dest).toMatch(/va vers/); walkToUse++; }
      if (c.state === 'use' && c.use_act === 'tv') expect(ic).toBe('tv'); if (c.isAsleep()) expect(ic).toBe(''); checked++; } });
    expect(checked).toBeGreaterThan(100); expect(walkToUse).toBeGreaterThan(0);
  });
  it('le besoin prioritaire est le plus bas des besoins ; « au travail » est annoncé pour les absents', () => {
    const w = mk(); const b = brief(w, B(w)); expect(b.need).toBe('Faim'); expect(b.urgent).toBe(true);
    const away = w.chars[2]; expect(away.away).toBe(true); expect(brief(w, away).activity).toMatch(/hors de la carte/); expect(brief(w, away).dest).toMatch(/Rentre vers/);
  });
});

describe('Temps accéléré : les décisions, trajets et conséquences suivent la vitesse', () => {
  const stepRun = (dt: number, gameMin: number) => { const w = mk(); const n = Math.ceil(gameMin / (dt * MIN_PER_SEC)); let dist = 0; const last = new Map(w.residents.map((c) => [c.id, { ...c.pos }])); for (let i = 0; i < n; i++) { w.tick(dt); for (const c of w.residents) { if (!c.away) dist += Math.hypot(c.pos.x - last.get(c.id)!.x, c.pos.y - last.get(c.id)!.y); last.set(c.id, { ...c.pos }); } } const dec = w.residents.reduce((m, c) => m + Object.entries(c.stats).filter(([k]) => k.startsWith('act_')).reduce((a, [, v]) => a + v, 0), 0); return { w, dist, dec }; };
  it('le résultat ne dépend pas de la taille des pas de simulation (donc de la vitesse choisie ni de la fluidité d\'affichage)', () => {
    const fine = stepRun(0.05, 180), mid = stepRun(0.1, 180), coarse = stepRun(0.25, 180);
    for (const r of [mid, coarse]) { expect(Math.abs(r.dec - fine.dec)).toBeLessThanOrEqual(Math.max(4, fine.dec * 0.25)); expect(Math.abs(r.dist / fine.dist - 1)).toBeLessThan(0.3); expect(Math.abs(r.w.getRel(0, 1).aff - fine.w.getRel(0, 1).aff)).toBeLessThan(25); }
    expect(fine.dec).toBeGreaterThan(8);
  });
  it('à ×1, ×2, ×3 pendant la même durée réelle : le temps de jeu, les trajets et les décisions augmentent proportionnellement', () => {
    const real = 60; // 60 s réelles simulées, pas de 1/30 s
    const at = (speed: number) => { const w = mk(); const c0 = w.clock; const dt = (1 / 30) * speed; const n = real * 30; let dist = 0; const last = new Map(w.residents.map((c) => [c.id, { ...c.pos }])); for (let i = 0; i < n; i++) { let rem = dt; while (rem > 1e-9) { const st = Math.min(rem, 0.1); w.tick(st); rem -= st; } if (i % 3 === 0) for (const c of w.residents) { if (!c.away) dist += Math.hypot(c.pos.x - last.get(c.id)!.x, c.pos.y - last.get(c.id)!.y); last.set(c.id, { ...c.pos }); } }
      const dec = w.residents.reduce((m, c) => m + Object.entries(c.stats).filter(([k]) => k.startsWith('act_')).reduce((a, [, v]) => a + v, 0), 0); return { clock: w.clock - c0, dist, dec }; };
    const s1 = at(1), s2 = at(2), s3 = at(3);
    expect(s2.clock / s1.clock).toBeCloseTo(2, 1); expect(s3.clock / s1.clock).toBeCloseTo(3, 1);
    expect(s2.dist / s1.dist).toBeGreaterThan(1.5); expect(s2.dist / s1.dist).toBeLessThan(2.6); expect(s3.dist / s1.dist).toBeGreaterThan(1.9); expect(s3.dist / s1.dist).toBeLessThan(3.8);
    console.log('ÉCHELLE', JSON.stringify({ s1, s2, s3 })); expect(s2.dec / s1.dec).toBeGreaterThan(1.25); expect(s3.dec / s1.dec).toBeGreaterThan(1.6); // décisions : petit échantillon, bornes larges
  });
});
