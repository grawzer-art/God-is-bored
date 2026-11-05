import { describe, it, expect } from 'vitest';
import { World } from '../src/sim/world';
import * as L from '../src/sim/layout';
import * as Shop from '../src/sim/shop';
import * as Crime from '../src/sim/crime';
import * as Act from '../src/sim/interact';
import { setupNoriaDemo } from '../src/sim/demo';
import * as City from '../src/sim/city';
import { toJSON, fromJSON } from '../src/sim/save';
import { MIN_PER_SEC } from '../src/sim/defs';

const mk = (seed = 1337) => { const w = new World(seed); w.build(); w.avatarControlled = true; return w; };
const run = (w: World, gameMin: number, each?: () => boolean | void) => { const n = Math.ceil(gameMin / (0.25 * MIN_PER_SEC)); for (let i = 0; i < n; i++) { w.tick(0.25); if (each?.()) return true; } return false; };
const put = (w: World, c: any, x: number, y: number) => { w.abortPlan(c, 't'); c.pos = { x, y }; c.state = 'idle'; c.plan = []; c.away = false; };
const day = (w: World, h: number) => { w.clock = (w.day() - 1) * 1440 + h * 60; };

describe('1. un quartier extérieur cohérent et des bâtiments à entrées fonctionnelles', () => {
  it('le monde est un seul réseau praticable : de la maison à chaque bâtiment, intérieur compris', () => {
    const w = mk(); const from = { x: 16.5, y: 20.5 };
    for (const [name, cell] of [['épicerie', { x: 61, y: 12 }], ['commissariat', { x: 75, y: 12 }], ['café', { x: 88, y: 13 }], ['hall Mouettes', { x: 62, y: 31 }], ['hall Orion', { x: 76, y: 28 }], ['hall Tilleuls', { x: 89, y: 28 }], ['parc', { x: 20, y: 28 }], ['rue du Marché', { x: 70, y: 34 }], ['cellule', { x: 79, y: 11 }], ['bar', { x: 38, y: 14 }]] as [string, { x: number; y: number }][]) {
      expect(w.isWalkable(cell), name + ' praticable').toBe(true); expect(w.pathTo(from, cell).length, 'chemin vers ' + name).toBeGreaterThan(0);
    }
  });
  it('chaque entrée est une porte réelle sur la façade, et mène à la bonne pièce', () => {
    for (const b of L.BUILDINGS.filter((x) => x.solid)) { const [dx, dy] = b.door!; expect(L.isDoor(dx, dy)).toBe(true); expect(L.isOutdoor(dx, dy + 1)).toBe(true); expect('MQTNOP'.includes(L.roomAt(dx, dy))).toBe(true); expect(L.buildingAt(dx, dy)?.name).toBe(b.name); }
    expect(L.roomAt(61, 12)).toBe('M'); expect(L.roomAt(75, 12)).toBe('Q'); expect(L.roomAt(88, 13)).toBe('T'); expect(L.roomAt(79, 11)).toBe('C');
  });
  it('aucun meuble dans un mur ni sur une porte ; tous les emplacements d\'usage sont atteignables', () => {
    const w = mk(); const from = { x: 16.5, y: 20.5 }; let bad = 0, unreachable = 0;
    for (const f of w.furn) { for (let i = 0; i < f.w; i++) for (let j = 0; j < f.d; j++) { if (f.blocks && (L.isWall(f.x + i, f.y + j) || L.isDoor(f.x + i, f.y + j))) bad++; } f.slots.forEach((sl) => { const st = sl.stands.map((s) => ({ x: f.x + s[0], y: f.y + s[1] })).find((c) => w.isWalkable(c)); if (st && L.buildingAt(st.x, st.y) && w.pathTo(from, st).length === 0) unreachable++; }); }
    expect(bad).toBe(0); expect(unreachable).toBe(0);
  });
  it('les nouveaux bâtiments ont leurs murs, toits et hauteurs ; la carte garde les coordonnées d\'origine', () => {
    expect(L.W).toBe(96); expect(L.H).toBe(40); expect(L.MAP.length).toBe(L.H); L.MAP.forEach((r) => expect(r.length).toBe(L.W));
    expect(L.MAP[18][16]).toBe('G'); expect(L.MAP[18][38]).toBe('E'); expect(L.roomAt(16, 17)).toBe('l'); // maison et bar d'origine à la même place
    for (const b of L.BUILDINGS.filter((x) => x.solid)) { expect(b.h).toBeGreaterThan(50); expect(b.roof).toBeTruthy(); }
  });
});

describe('2. une population qui circule', () => {
  it('19 personnages : 8 habitants, avatar, barman, commerçant, 2 policiers, 6 citoyens ; identifiants d\'origine inchangés', () => {
    const w = mk(); expect(w.chars.length).toBe(19); expect(w.residents.length).toBe(8); expect(w.police.length).toBe(2); expect(w.citizens.length).toBe(6); expect(w.clerk).toBeDefined();
    w.chars.forEach((c, i) => expect(c.id).toBe(i)); expect(w.avatar.id).toBe(8); expect(w.barman!.id).toBe(9); for (const c of w.citizens) expect(c.home).toBeTruthy();
  });
  it('les citoyens sortent de chez eux, circulent entre café, épicerie, parc et rues, travaillent, rentrent', () => {
    const w = mk(); const seen: Record<number, Set<string>> = {}; const walked: Record<number, number> = {}; const last: Record<number, { x: number; y: number }> = {};
    for (const c of w.citizens) { seen[c.id] = new Set(); walked[c.id] = 0; last[c.id] = { ...c.pos }; }
    run(w, 1440, () => { for (const c of w.citizens) { if (c.away) { last[c.id] = { ...c.pos }; continue; } const d = Math.hypot(c.pos.x - last[c.id].x, c.pos.y - last[c.id].y); if (d < 3) walked[c.id] += d; last[c.id] = { ...c.pos }; const b = L.buildingAt(Math.floor(c.pos.x), Math.floor(c.pos.y)); seen[c.id].add(b?.name ?? (c.pos.y > 23 && c.pos.y < 33 && c.pos.x < 50 ? 'park' : 'street')); if (!c.away && ['walk', 'idle', 'chat'].includes(c.state)) expect(w.isWalkable(c.cell())).toBe(true); } });
    for (const c of w.citizens) { expect(walked[c.id], c.first + ' a marché').toBeGreaterThan(25); expect(seen[c.id].size, c.first + ' lieux').toBeGreaterThanOrEqual(2); }
    const places = new Set<string>(); for (const id of Object.keys(seen)) seen[Number(id)].forEach((p) => places.add(p)); expect(places.has('cafe') && places.has('store') && places.has('park')).toBe(true);
    expect(w.citizens.some((c) => (c.stats.shifts ?? 0) > 0)).toBe(true);                                // un citoyen est allé au bureau et a été payé
  });
  it('des horaires différents, des besoins qui comptent : le citoyen affamé va manger', () => {
    const w = mk(); day(w, 11); const v = w.chars[15]; put(w, v, 40.5, 34.5); v.needs.hunger = 12; v.money = 40; v.decision_cooldown = 0; v.jobPhase = '';
    let ate = false; run(w, 160, () => { if (v.state === 'use' && v.use_act === 'eat') ate = true; }); expect(ate).toBe(true); expect(v.needs.hunger).toBeGreaterThan(30);
    expect(new Set(w.citizens.map((c) => c.jobUntil)).size).toBeGreaterThan(3);
  });
  it('les citoyens bavardent et créent des souvenirs', () => {
    const w = mk(); run(w, 1440); expect(w.citizens.reduce((n, c) => n + (c.stats.chats ?? 0), 0)).toBeGreaterThan(2); expect(w.citizens.some((c) => c.memories.length > 0)).toBe(true);
  });
});

describe('3. boutique, vol, témoins, police', () => {
  const scene = () => { const w = mk(); day(w, 11); const av = w.avatar; put(w, av, 61.5, 13.5); av.money = 60; w.clerk!.away = false; return { w, av }; };
  it('prendre un article sur un rayon l\'ajoute à l\'inventaire, non payé ; payer règle la dette sans délit', () => {
    const { w, av } = scene(); const fi = w.furn.findIndex((f) => f.id === 'shelf_a'); const opts = Act.furnitureOptions(w, fi); expect(opts.length).toBe(3); expect(opts[0].label).toMatch(/Prendre : Sandwich \(3 €\)/);
    Act.useFurniture(w, av, opts[0]); run(w, 40, () => Shop.owed(av) > 0); expect(av.unpaid.sandwich).toBe(1); expect(av.inventory.sandwich).toBe(2);
    const m0 = av.money; expect(Shop.pay(w, av)).toBe(3); expect(av.money).toBe(m0 - 3); expect(Shop.owed(av)).toBe(0); put(w, av, 61.5, 20.5); run(w, 3); expect(w.events.some((e) => e.kind === 'shoplift')).toBe(false);
  });
  it('sortir sans payer est un délit : le commerçant témoin appelle, un agent intervient, le joueur est recherché', () => {
    const { w, av } = scene(); const clerk = w.clerk!; put(w, clerk, 63.5, 15.5); av.unpaid = { sandwich: 1 }; av.inventory.sandwich = 2;
    put(w, av, 61.5, 19.5); run(w, 1); const ev = w.events.find((e) => e.kind === 'shoplift'); expect(ev).toBeDefined(); expect(ev!.actor).toBe(av.id); expect(Shop.owed(av)).toBe(0);
    expect(run(w, 15, () => w.wanted.level > 0)).toBe(true); expect(w.reports.length + w.dispatches.length).toBeGreaterThan(0);
    expect(w.dispatches.length).toBeGreaterThan(0); expect(w.dispatches[0].perp).toBe(av.id);
    expect(run(w, 30, () => w.police.some((o) => o.task && (o.task.kind === 'respond' || o.task.kind === 'pursue')))).toBe(true);
  });
  it('un délit sans témoin ne déclenche rien', () => {
    const w = mk(); day(w, 3); for (const c of w.chars) if (c.kind !== 'avatar') { c.away = true; c.jobUntil = 1e9; c.jobPhase = 'out'; }
    const av = w.avatar; put(w, av, 61.5, 19.5); av.unpaid = { chips: 1 }; run(w, 20); expect(w.events.some((e) => e.kind === 'shoplift')).toBe(true); expect(w.reports.length + w.dispatches.length).toBe(0); expect(w.wanted.level).toBe(0);
  });
  it('l\'agent poursuit le joueur recherché, l\'arrête : amende, garde à vue en cellule, casier, puis libération', () => {
    const { w, av } = scene(); const off = w.police[0]; put(w, off, 70.5, 20.5); put(w, w.police[1], 75.5, 15.5); put(w, av, 66.5, 20.5); w.wanted.level = 1; w.wanted.heat = w.clock + 60; w.wanted.last = { x: 66.5, y: 20.5 }; av.money = 100;
    let pursued = false; expect(run(w, 40, () => { if (off.task?.kind === 'pursue') pursued = true; return !!w.jail; })).toBe(true); expect(pursued).toBe(true);
    expect(av.money).toBeLessThan(100); expect(w.record_.arrests).toBe(1); expect(w.record_.fines).toBeGreaterThan(0); expect(w.wanted.level).toBe(0); expect(L.roomAt(Math.floor(av.pos.x), Math.floor(av.pos.y))).toBe('C');
    const before = { ...av.pos }; w.input = { dx: 1, dy: 0, run: false, mag: 1 }; run(w, 5); expect(av.pos).toEqual(before);   // enfermé : le joystick ne fait rien
    expect(run(w, 120, () => !w.jail)).toBe(true); expect(L.roomAt(Math.floor(av.pos.x), Math.floor(av.pos.y))).toBe('s');
  });
  it('un joueur qui court plus vite que l\'agent peut lui échapper ; la recherche retombe ensuite', () => {
    const { w, av } = scene(); const off = w.police[0]; put(w, off, 60.5, 20.5); put(w, w.police[1], 20.5, 21.5); put(w, av, 66.5, 20.5); w.wanted.level = 1; w.wanted.heat = w.clock + 40; w.wanted.last = { x: 66.5, y: 20.5 };
    w.input = { dx: 1, dy: 0.0, run: true, mag: 1 }; let caught = false; run(w, 7, () => { if (w.jail) caught = true; const a = w.avatar; if (a.pos.x > 90 || a.pos.y > 38) w.input = { dx: -1, dy: 0, run: true, mag: 1 }; }); expect(caught).toBe(false);
    w.input = { dx: 0, dy: 0, run: false, mag: 0 }; put(w, av, 90.5, 38.5); put(w, off, 20.5, 20.5); put(w, w.police[1], 20.5, 21.5); expect(run(w, 200, () => w.wanted.level === 0)).toBe(true);
  });
  it('se rendre : amende réduite, sans poursuite', () => {
    const { w, av } = scene(); const off = w.police[0]; put(w, off, 62.5, 21.5); put(w, av, 62.5, 20.5); w.wanted.level = 2; av.money = 200; const c0 = av.money;
    const r = Act.choose(w, off, 'surrender'); expect(r.close).toBe(true); expect(w.jail).not.toBeNull(); expect(c0 - av.money).toBe(Math.round(60 * 0.7));
  });
  it('entre PNJ, sans le joueur : le vol d\'un habitant, vu et signalé, fait venir la police jusqu\'au coupable qui est arrêté', () => {
    const w = new World(1337); w.build(); setupNoriaDemo(w); const lucas = w.chars[5], mar = w.chars[6];
    expect(run(w, 120, () => w.events.some((e) => e.kind === 'theft'))).toBe(true); const ev = w.events.find((e) => e.kind === 'theft')!;
    Crime.maybeReport(w, mar, lucas.id, { x: ev.x, y: ev.y }, 1, 1);                                        // le témoin décide d'appeler (la probabilité dépend de sa morale ; ici forcée)
    expect(run(w, 200, () => w.police.some((o) => o.task && o.task.target === lucas.id))).toBe(true);
    expect(run(w, 400, () => (lucas.stats.arrests ?? 0) > 0 || lucas.jobPhase === 'jail')).toBe(true); expect(lucas.money).toBeLessThan(30 + 3 + 40);
    expect(w.events.some((e) => e.kind === 'arrest' && e.target === lucas.id)).toBe(true); expect(run(w, 400, () => !lucas.away)).toBe(true);
  });
  it('un citoyen fauché peu scrupuleux vole à l\'étalage : la police l\'arrête sans intervention du joueur (démonstration de la société autonome)', () => {
    const w = mk(); const ib = w.chars[18]; day(w, 10.5); ib.money = 1; ib.away = false; put(w, ib, 56.5, 21.5); ib.jobPhase = ''; w.clerk!.away = false; put(w, w.clerk!, 63.5, 15.5); put(w, ib, 61.5, 19.5); expect(City.shopRun(w, ib)).toBe(true);
    for (const c of w.chars) if (c.kind === 'citizen' && c.id !== 18) { c.away = true; c.jobUntil = 1e9; c.jobPhase = 'out'; }
    let stole = false, arrested = false; run(w, 400, () => { if (w.events.some((e) => e.kind === 'shoplift' && e.actor === 18)) stole = true; if (w.events.some((e) => e.kind === 'arrest' && e.target === 18)) { arrested = true; return true; } return false; });
    expect(stole).toBe(true); expect(arrested).toBe(true); expect(ib.away).toBe(true); expect(ib.money).toBeLessThanOrEqual(1);
  });
});

describe('7. sauvegardes', () => {
  it('niveau de recherche, casier, garde à vue, appels, articles non payés et missions de police survivent à la sauvegarde ; la partie continue', () => {
    const w = mk(); day(w, 11); const av = w.avatar; put(w, av, 61.5, 19.5); av.unpaid = { sandwich: 2 }; put(w, w.clerk!, 63.5, 15.5); run(w, 12);
    w.record_.arrests = 2; w.record_.fines = 80; w.wanted.level = 2; w.wanted.heat = w.clock + 50; av.unpaid = { chips: 1 };
    const d = JSON.parse(JSON.stringify(toJSON(w))); const w2 = fromJSON(d)!; expect(w2).not.toBeNull();
    expect(w2.wanted).toEqual(w.wanted); expect(w2.record_).toEqual(w.record_); expect(w2.dispatches).toEqual(w.dispatches); expect(w2.avatar.unpaid).toEqual({ chips: 1 }); expect(w2.chars.length).toBe(19);
    for (const c of w.citizens) { expect(w2.chars[c.id].home).toEqual(c.home); expect(w2.chars[c.id].money).toBe(c.money); }
    run(w2, 600); expect(w2.chars.every((c) => Number.isFinite(c.pos.x))).toBe(true);
    w.jail = { until: w.clock + 30 }; const w3 = fromJSON(JSON.parse(JSON.stringify(toJSON(w))))!; expect(w3.jail).toEqual(w.jail);
  });
  it('les anciennes parties (10 personnages, carte d\'origine) se chargent dans la nouvelle ville', () => {
    const w = mk(); run(w, 300); const d: any = JSON.parse(JSON.stringify(toJSON(w))); delete d.crime; d.chars = d.chars.slice(0, 10); for (const c of d.chars) { delete c.hp; delete c.unpaid; delete c.task; delete c.place; delete c.home; delete c.dutyPost; }
    const w2 = fromJSON(d)!; expect(w2).not.toBeNull(); expect(w2.chars.length).toBe(19); expect(w2.citizens.length).toBe(6); run(w2, 600); expect(w2.residents.every((c) => Number.isFinite(c.money))).toBe(true);
  });
});

describe('8. performance', () => {
  it('3 jours de ville complète en moins de 12 s ; population constante ; mémoires bornées', () => {
    const w = mk(); const t = performance.now(); run(w, 3 * 1440); expect(performance.now() - t).toBeLessThan(12000); expect(w.chars.length).toBe(19);
    for (const c of w.chars) { expect(c.memories.length).toBeLessThanOrEqual(60); for (const v of Object.values(c.needs)) expect(Number.isFinite(v)).toBe(true); }
  });
});
