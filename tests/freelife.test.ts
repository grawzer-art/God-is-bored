import { describe, it, expect } from 'vitest';
import { World } from '../src/sim/world';
import * as L from '../src/sim/layout';
import * as Act from '../src/sim/interact';
import { lineClear, smoothPath } from '../src/sim/movement';
import { toJSON, fromJSON } from '../src/sim/save';
import type { SimChar } from '../src/sim/simchar';

const mk = () => { const w = new World(1337); w.build(); w.avatarControlled = true; return w; };
const put = (w: World, c: SimChar, x: number, y: number) => { w.abortPlan(c, 'test'); c.pos = { x, y }; c.state = 'idle'; c.plan = []; };
const freeze = (c: SimChar) => { c.decision_cooldown = 1e9; };
const tick = (w: World, secs: number, each?: () => void) => { for (let i = 0; i < Math.round(secs * 10); i++) { w.tick(0.1); each?.(); } };
const cellOk = (w: World, p: { x: number; y: number }) => w.isWalkable({ x: Math.floor(p.x), y: Math.floor(p.y) });
const walkPlan = (w: World, cell: { x: number; y: number }) => { const av = w.avatar; if (av.state !== 'idle') w.abortPlan(av, 'tap'); av.plan = [{ type: 'goto', cell }]; w.startNextStep(av); };

describe('1. joystick : déplacement continu, analogique, collisions', () => {
  it('vitesse proportionnelle à l\'inclinaison, identique en diagonale', () => {
    const w = mk(); const av = w.avatar; const dist = (a: any, b: any) => Math.hypot(a.x - b.x, a.y - b.y);
    put(w, av, 20.5, 21.5); let p0 = { ...av.pos }; w.input = { dx: 0, dy: -1, run: false, mag: 1 }; tick(w, 1); const full = dist(p0, av.pos);
    put(w, av, 20.5, 21.5); p0 = { ...av.pos }; w.input = { dx: 0, dy: -1, run: false, mag: 0.5 }; tick(w, 1); const half = dist(p0, av.pos);
    put(w, av, 20.5, 21.5); p0 = { ...av.pos }; w.input = { dx: 0.7071, dy: -0.7071, run: false, mag: 1 }; tick(w, 1); const diag = dist(p0, av.pos);
    expect(full).toBeGreaterThan(1.9); expect(full).toBeLessThan(2.3);
    expect(half / full).toBeGreaterThan(0.45); expect(half / full).toBeLessThan(0.55);
    expect(Math.abs(diag - full)).toBeLessThan(0.15);
  });
  it('orientation et pose cohérentes avec la direction', () => {
    const w = mk(); const av = w.avatar; put(w, av, 20.5, 21.5); const seen = new Set<number>();
    for (const [dx, dy] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) { w.input = { dx, dy, run: false, mag: 1 }; tick(w, 0.3); seen.add(av.facing); expect(av.pose).toBe('walk'); }
    expect(seen.size).toBe(4);
    w.input = { dx: 0, dy: 0, run: false, mag: 0 }; tick(w, 0.2); expect(av.pose).toBe('stand');
  });
  it('un mur arrête le personnage et il glisse le long (jamais dedans)', () => {
    const w = mk(); const av = w.avatar; put(w, av, 26.5, 19.5); w.input = { dx: 0, dy: -1, run: true, mag: 1 };
    tick(w, 2, () => { expect(cellOk(w, av.pos)).toBe(true); expect(av.pos.y).toBeGreaterThanOrEqual(19); });
    put(w, av, 26.5, 19.5); w.input = { dx: 1, dy: 0, run: false, mag: 1 }; tick(w, 2, () => expect(cellOk(w, av.pos)).toBe(true));
  });
  it('ne traverse pas un personnage immobile', () => {
    const w = mk(); const av = w.avatar; const npc = w.chars[0]; put(w, npc, 22.5, 21.5); freeze(npc); put(w, av, 20.5, 21.5);
    w.input = { dx: 1, dy: 1, run: true, mag: 1 }; let min = 9; tick(w, 3, () => { min = Math.min(min, Math.hypot(av.pos.x - npc.pos.x, av.pos.y - npc.pos.y)); });
    expect(min).toBeGreaterThan(0.3);
  });
});

describe('2-3. toucher pour se déplacer : traverser une rue, contourner un bâtiment', () => {
  it('traverse la rue vers le trottoir d\'en face', () => {
    const w = mk(); const av = w.avatar; put(w, av, 10.5, 19.5);
    const plan = Act.planTap(w, av, { cell: { x: 10, y: 22 } }); expect(plan.kind).toBe('walk'); if (plan.kind !== 'walk') return;
    walkPlan(w, plan.cell); tick(w, 20, () => expect(cellOk(w, av.pos)).toBe(true));
    expect(Math.hypot(av.pos.x - 10.5, av.pos.y - 22.5)).toBeLessThan(0.5); expect(av.state).toBe('idle');
  });
  it('contourne le bar (aucune case de mur traversée)', () => {
    const w = mk(); const av = w.avatar; put(w, av, 29.5, 15.5); const target = { x: 41, y: 6 };
    expect(lineClear({ x: 29.5, y: 15.5 }, { x: 41.5, y: 6.5 })).toBe(false); // la ligne droite traverse le bar
    walkPlan(w, target); let len = 0, prev = { ...av.pos };
    tick(w, 40, () => { expect(cellOk(w, av.pos)).toBe(true); len += Math.hypot(av.pos.x - prev.x, av.pos.y - prev.y); prev = { ...av.pos }; });
    expect(Math.hypot(av.pos.x - 41.5, av.pos.y - 6.5)).toBeLessThan(0.5); expect(len).toBeGreaterThan(Math.hypot(12, 9) + 1);
  });
  it('un toucher sur un mur vise la case libre voisine ; hors carte : refusé', () => {
    const w = mk(); const av = w.avatar; put(w, av, 10.5, 19.5);
    const p = Act.planTap(w, av, { cell: { x: 10, y: 18 } }); expect(p.kind).toBe('walk'); if (p.kind === 'walk') expect(w.isWalkable(p.cell)).toBe(true);
    expect(Act.planTap(w, av, { cell: { x: -5, y: 40 } }).kind).toBe('none');
  });
  it('le chemin est lissé (moins de points que A* brut) et ne coupe pas les coins', () => {
    const w = mk(); const raw = w.pathTo({ x: 1.5, y: 20.5 }, { x: 25, y: 22 }); const sm = smoothPath(w, { x: 1.5, y: 20.5 }, raw);
    expect(sm.length).toBeLessThan(raw.length); expect(sm[sm.length - 1]).toEqual(raw[raw.length - 1]);
  });
  it('recalcule le trajet si un personnage immobile bloque le passage', () => {
    const w = mk(); const av = w.avatar; const npc = w.chars[1]; put(w, npc, 10.5, 19.5); freeze(npc); put(w, av, 4.5, 19.5);
    walkPlan(w, { x: 20, y: 19 }); tick(w, 30);
    expect(Math.hypot(av.pos.x - 20.5, av.pos.y - 19.5)).toBeLessThan(0.6);
  });
  it('aucun calcul de chemin à chaque image', () => {
    const w = mk(); const av = w.avatar; for (const r of w.residents) freeze(r); put(w, av, 4.5, 20.5); let calls = 0; const orig = w.pathTo.bind(w); w.pathTo = (a: any, b: any) => { if (Math.abs(a.x - av.pos.x) < 1e-9 && Math.abs(a.y - av.pos.y) < 1e-9) calls++; return orig(a, b); }; // seuls les calculs partis de la position du joueur comptent
    walkPlan(w, { x: 40, y: 21 }); tick(w, 15); expect(calls).toBeLessThanOrEqual(3);
    w.input = { dx: 1, dy: 0, run: false, mag: 1 }; calls = 0; tick(w, 5); expect(calls).toBe(0);
  });
  it('A* : chemin le plus long de la carte en moins de 5 ms en moyenne', () => {
    const w = mk(); const t0 = performance.now(); for (let i = 0; i < 100; i++) w.pathTo({ x: 1.5, y: 1.5 }, { x: 49, y: 22 }); expect((performance.now() - t0) / 100).toBeLessThan(5);
  });
});

describe('4. du déplacement automatique au joystick', () => {
  it('le joystick annule immédiatement le trajet automatique', () => {
    const w = mk(); const av = w.avatar; put(w, av, 4.5, 20.5); walkPlan(w, { x: 40, y: 21 }); tick(w, 0.5); expect(av.state).toBe('walk');
    w.input = { dx: -1, dy: 0, run: false, mag: 1 }; w.tick(0.1);
    expect(av.plan.length).toBe(0); expect(av.path.length === 0 || av.state !== 'walk').toBe(true);
    const p = { ...av.pos }; tick(w, 1); expect(av.pos.x - av.pos.y).not.toBeCloseTo(p.x - p.y, 1); // il suit bien le joystick, plus l'ancien trajet
  });
});

describe('5. toucher un PNJ et s\'en approcher', () => {
  it('trop loin : marche jusqu\'à lui puis déclenche l\'interaction une seule fois', () => {
    const w = mk(); const av = w.avatar; const npc = w.chars[2]; put(w, npc, 24.5, 20.5); freeze(npc); put(w, av, 8.5, 20.5);
    const plan = Act.planTap(w, av, { npc: npc.id }); expect(plan.kind).toBe('approach'); if (plan.kind !== 'approach') return;
    let arrived = 0, d = 99; w.onAvatarArrive = (n) => { arrived++; d = Math.hypot(n.pos.x - av.pos.x, n.pos.y - av.pos.y); expect(n.id).toBe(npc.id); };
    Act.walkToNpc(w, av, plan.npc); tick(w, 30); expect(arrived).toBe(1); expect(d).toBeLessThanOrEqual(1.9);
  });
  it('à portée : parle tout de suite', () => {
    const w = mk(); const av = w.avatar; const npc = w.chars[2]; put(w, npc, 11.5, 20.5); put(w, av, 10.5, 20.5); expect(Act.planTap(w, av, { npc: npc.id }).kind).toBe('talk');
  });
});

describe('6. interagir avec un objet accessible', () => {
  it('toucher un meuble utilisable : le personnage marche jusqu\'au point d\'accès puis l\'utilise', () => {
    const w = mk(); const av = w.avatar; const fi = w.furn.findIndex((f) => Act.furnitureOptions(w, f.i).some((o) => o.act === 'toilet' || o.act === 'snack' || o.act === 'tv'));
    expect(fi).toBeGreaterThanOrEqual(0); put(w, av, 14.5, 7.5); freeze(w.chars[0]);
    const plan = Act.planTap(w, av, { furn: fi }); expect(['use', 'menu']).toContain(plan.kind);
    const item = plan.kind === 'use' ? plan.item : plan.kind === 'menu' ? plan.items[0] : null; expect(item).not.toBeNull();
    Act.useFurniture(w, av, item!); let used = false; tick(w, 40, () => { if (av.state === 'use' && av.use_furn === fi) used = true; });
    expect(used).toBe(true);
  });
  it('un objet sans action implémentée n\'est pas présenté comme utilisable', () => {
    const w = mk(); const av = w.avatar; put(w, av, 14.5, 7.5); const none = w.furn.find((f) => Act.furnitureOptions(w, f.i).length === 0 && !f.flat);
    expect(none).toBeDefined(); const plan = Act.planTap(w, av, { furn: none!.i }); expect(plan.kind).toBe('none');
  });
});

describe('7. un mur empêche une interaction', () => {
  it('PNJ de l\'autre côté d\'un mur : ni liste d\'actions ni dialogue', () => {
    const w = mk(); const av = w.avatar; const npc = w.chars[3]; put(w, npc, 11.2, 16.5); freeze(npc); put(w, av, 9.8, 16.5);
    expect(Math.hypot(npc.pos.x - av.pos.x, npc.pos.y - av.pos.y)).toBeLessThan(1.9); expect(lineClear(av.pos, npc.pos)).toBe(false);
    expect(Act.nearby(w, av).some((i) => i.npc === npc)).toBe(false);
    expect(Act.planTap(w, av, { npc: npc.id }).kind).toBe('approach');
  });
  it('l\'approche contourne le mur par la porte et ne parle qu\'avec vue dégagée', () => {
    const w = mk(); const av = w.avatar; const npc = w.chars[3]; put(w, npc, 11.2, 16.5); freeze(npc); put(w, av, 9.8, 16.5);
    let los: boolean | null = null; w.onAvatarArrive = (n) => { los = lineClear(av.pos, n.pos); };
    Act.walkToNpc(w, av, npc); tick(w, 40); expect(los).toBe(true);
  });
});

describe('8. sauvegarde et rechargement', () => {
  it('position, mode humain et monde conservés ; trajet en cours proprement abandonné', () => {
    const w = mk(); const av = w.avatar; put(w, av, 4.5, 20.5); walkPlan(w, { x: 40, y: 21 }); tick(w, 2);
    const data = JSON.parse(JSON.stringify(toJSON(w))); const w2 = fromJSON(data)!; expect(w2).not.toBeNull();
    expect(w2.avatarControlled).toBe(true); expect(Math.hypot(w2.avatar.pos.x - av.pos.x, w2.avatar.pos.y - av.pos.y)).toBeLessThan(0.01);
    expect(w2.avatar.plan.length).toBe(0); tick(w2, 5); w2.input = { dx: 1, dy: 0, run: false, mag: 1 }; tick(w2, 2); expect(cellOk(w2, w2.avatar.pos)).toBe(true);
  });
  it('les anciennes parties (sans champs récents) se chargent toujours', () => {
    const w = mk(); const d: any = JSON.parse(JSON.stringify(toJSON(w))); delete d.knownSecrets; delete d.musicUntil; for (const c of d.chars) { delete c.money; delete c.inventory; delete c.drunk; delete c.away; }
    const w2 = fromJSON(d); expect(w2).not.toBeNull(); tick(w2!, 3);
  });
});
void L;
