/** Ville : population (commis, policiers, citoyens), emplois du temps des citoyens, vie du commerçant. Les citoyens décident selon l'heure, leurs besoins,
 *  leur argent et leur personnalité ; ils habitent un immeuble, travaillent (sur place ou hors carte), fréquentent le café, l'épicerie et le parc. */
import { ACT, type V2 } from './defs';
import * as L from './layout';
import * as Shop from './shop';
import * as Social from './social';
import type { Look } from './roster';
import { SimChar } from './simchar';
import { dist, type Furn, type World } from './world';

type Where = 'home' | 'office' | 'cafeWork' | 'cafe' | 'store' | 'park' | 'route';
interface Spec { name: string; age: number; gender: 'F' | 'M'; job: string; bio: string; look: Look; traits: SimChar['traits']; money: number; home: 'flats1' | 'flats2' | 'flats3'; wage: number; sched: [number, number, Where][]; chrono: number }
const LK = (o: Partial<Look>): Look => ({ skin: 1, hair: 'short', hair_color: 'darkbrown', top: 'tee', top_color: 'gray', bottom: 'jeans', bottom_color: 'dark', shoes: 'brown', build: 0, height: 0, acc: 'none', ...o });
const T = (extraversion: number, agreeableness: number, neuroticism: number, orderliness: number, openness: number) => ({ extraversion, agreeableness, neuroticism, orderliness, openness });
export const DOORS: Record<string, V2> = { flats1: { x: 62, y: 33 }, flats2: { x: 76, y: 33 }, flats3: { x: 89, y: 33 } };   // trottoir devant la porte de chaque immeuble
export const OFFICE_EXIT: V2 = { x: 53, y: 1 };                                                                          // les employés de bureau partent par la rue Centrale, vers le nord
export const CAFE_POST: V2 = { x: 86, y: 11 }, STORE_POST: V2 = { x: 63, y: 15 }, STATION_DESK: V2 = { x: 72, y: 13 };

export const CITIZENS: Spec[] = [
  { name: 'Noémie Rivière', age: 26, gender: 'F', job: 'Serveuse au café', bio: 'Rapide, souriante, elle connaît les secrets de tout le quartier.', home: 'flats1', wage: 70, money: 55, chrono: -0.3, traits: T(0.8, 0.75, 0.4, 0.6, 0.6),
    look: LK({ skin: 2, hair: 'bun', hair_color: 'black', top: 'tank', top_color: 'teal', bottom: 'skirt', bottom_color: 'navy', shoes: 'white', acc: 'earrings' }), sched: [[7.3, 16, 'cafeWork'], [16, 18.5, 'park'], [18.5, 21.5, 'cafe']] },
  { name: 'Victor Lang', age: 47, gender: 'M', job: 'Comptable', bio: 'Ponctuel jusqu\'à la manie. Prend son café à 7 h 45 pile.', home: 'flats2', wage: 130, money: 120, chrono: -0.5, traits: T(0.35, 0.5, 0.55, 0.9, 0.35),
    look: LK({ skin: 0, hair: 'short', hair_color: 'gray', top: 'blazer', top_color: 'gray', bottom: 'jeans', bottom_color: 'navy', shoes: 'black', acc: 'glasses' }), sched: [[7.4, 8.3, 'cafe'], [8.3, 17.6, 'office'], [17.8, 19.3, 'park'], [19.4, 20.8, 'cafe']] },
  { name: 'Sofia Marchetti', age: 33, gender: 'F', job: 'Photographe', bio: 'Flâne avec son appareil, cherche la lumière et les histoires.', home: 'flats3', wage: 0, money: 70, chrono: 0.2, traits: T(0.6, 0.65, 0.5, 0.35, 0.9),
    look: LK({ skin: 2, hair: 'bob', hair_color: 'blond', top: 'jacket', top_color: 'red', bottom: 'skirt', bottom_color: 'dark', shoes: 'brown', acc: 'shades' }), sched: [[8.5, 9.6, 'cafe'], [9.6, 11.2, 'park'], [11.2, 12.2, 'store'], [12.3, 13.6, 'cafe'], [13.7, 17, 'park'], [17, 18, 'store'], [18.2, 20.5, 'cafe']] },
  { name: 'Karl Weiss', age: 61, gender: 'M', job: 'Retraité', bio: 'Ancien instituteur. Parle de tout, écoute rarement.', home: 'flats1', wage: 0, money: 45, chrono: -0.7, traits: T(0.75, 0.6, 0.3, 0.7, 0.5),
    look: LK({ skin: 0, hair: 'bald', hair_color: 'silver', top: 'cardigan', top_color: 'green', bottom: 'jeans', bottom_color: 'dark', shoes: 'brown', acc: 'stubble' }), sched: [[6.8, 9.5, 'park'], [9.5, 10.3, 'store'], [10.4, 11.9, 'cafe'], [12, 16.5, 'park'], [16.6, 17.4, 'store'], [17.5, 19.5, 'cafe']] },
  { name: 'Yasmine Haddad', age: 22, gender: 'F', job: 'Étudiante', bio: 'Révise au café, rêve de partir, parle trop vite.', home: 'flats2', wage: 0, money: 30, chrono: 0.6, traits: T(0.55, 0.7, 0.65, 0.45, 0.85),
    look: LK({ skin: 3, hair: 'afro', hair_color: 'black', top: 'jacket', top_color: 'purple', bottom: 'jeans', bottom_color: 'light', shoes: 'white' }), sched: [[8.5, 11, 'cafe'], [11, 11.8, 'store'], [12, 13.5, 'park'], [13.6, 17.5, 'cafe'], [17.5, 20.5, 'park']] },
  { name: 'Ibrahim Keita', age: 39, gender: 'M', job: 'Livreur', bio: 'Toujours en mouvement, toujours à court d\'argent. Rend service, parfois contre mieux.', home: 'flats3', wage: 0, money: 3, chrono: -0.1, traits: T(0.5, 0.35, 0.6, 0.3, 0.5),
    look: LK({ skin: 4, hair: 'short', hair_color: 'black', top: 'jacket', top_color: 'red', bottom: 'jeans', bottom_color: 'dark', shoes: 'black', acc: 'beanie', build: 1 }), sched: [[7.6, 19.5, 'route'], [19.5, 21.2, 'park']] },
];
const POLICE: { name: string; gender: 'F' | 'M'; age: number; look: Look; patrol: boolean }[] = [
  { name: 'Léa Lemaire', gender: 'F', age: 34, patrol: true, look: LK({ skin: 1, hair: 'ponytail', hair_color: 'auburn', top: 'uniform', top_color: 'navy', bottom: 'jeans', bottom_color: 'dark', shoes: 'black', acc: 'cap' }) },
  { name: 'Sam Okafor', gender: 'M', age: 41, patrol: false, look: LK({ skin: 4, hair: 'short', hair_color: 'black', top: 'uniform', top_color: 'navy', bottom: 'jeans', bottom_color: 'dark', shoes: 'black', acc: 'cap', build: 1, height: 1 }) },
];

function mkChar(w: World, id: number, name: string, kind: SimChar['kind'], gender: 'F' | 'M', age: number, job: string, look: Look, traits: SimChar['traits'], money: number, pos: V2, bio: string): SimChar {
  const c = new SimChar(); c.id = id; c.name = name; c.first = name.split(' ')[0]; c.kind = kind; c.gender = gender; c.age = age; c.job = job; c.look = look; c.traits = traits; c.money = money; c.bio = bio;
  c.needs = { hunger: 62 + (id % 5) * 6, energy: 85, bladder: 70, hygiene: 75, social: 50 + (id % 4) * 8, fun: 55 + (id % 3) * 8 }; c.faith = 20; c.speed = 1.7 + (id % 4) * 0.06; c.pos = { ...pos }; c.chrono = 0; c.wake_base = c.wake_target = 420;
  w.chars.push(c); return c;
}
/** Crée la population de la ville (identifiants 10 et suivants : les parties existantes gardent leurs 10 premiers habitants). */
export function populate(w: World) {
  let id = w.chars.length; // 10
  const clerk = mkChar(w, id++, 'Nono Bellamy', 'clerk', 'M', 62, 'Épicier', LK({ skin: 2, hair: 'bald', hair_color: 'gray', top: 'cardigan', top_color: 'green', bottom: 'jeans', bottom_color: 'dark', shoes: 'brown', acc: 'glasses', build: 1 }), T(0.6, 0.55, 0.4, 0.8, 0.4), 250, { x: 61.5, y: 19.5 }, "Tient l'épicerie depuis trente ans. Retient les visages, pas les noms.");
  clerk.away = true; clerk.jobPhase = 'out'; clerk.place = 'store'; clerk.dutyPost = { ...STORE_POST };
  for (const p of POLICE) { const c = mkChar(w, id++, p.name, 'police', p.gender, p.age, 'Agent de police', p.look, T(0.5, 0.55, 0.3, 0.9, 0.35), 90, { x: 75.5, y: 15.5 }, 'Patrouille de NORIA. A tout vu, ne dit pas tout.'); c.dutyPost = { ...STATION_DESK }; c.speed = 2.0; c.place = p.patrol ? 'patrol' : 'desk'; }
  const door = (k: string) => DOORS[k];
  CITIZENS.forEach((sp, i) => {
    const c = mkChar(w, id++, sp.name, 'citizen', sp.gender, sp.age, sp.job, sp.look, sp.traits, sp.money, door(sp.home), sp.bio);
    c.home = { ...door(sp.home) }; c.place = sp.home; c.chrono = sp.chrono; c.shift = sp.wage > 0 ? { from: sp.sched[0][0], to: sp.sched[0][1], pay: sp.wage, place: sp.job } : null;
    c.away = true; c.jobPhase = 'out'; c.jobUntil = (Math.floor(w.clock / 1440) * 1440) + sp.sched[0][0] * 60 + (i % 3) * 7;   // chacun sort de chez lui à sa propre heure
    if (c.jobUntil < w.clock) c.jobUntil = w.clock + 5 + i * 3;
  });
  // les habitants ont des relations de départ avec les nouveaux venus : inconnus
  for (const c of w.chars) if (c.id >= 10) for (const o of w.chars) if (o.id !== c.id && o.id < 10 && o.kind === 'resident') { const r = w.getRel(o.id, c.id); r.aff = 0; r.fam = 4; const r2 = w.getRel(c.id, o.id); r2.aff = 0; r2.fam = 4; }
}

// ---------------------------------------------------------------- emploi du temps
const sched = (c: SimChar) => CITIZENS.find((s) => s.name === c.name)!;
function entryAt(c: SimChar, h: number): { from: number; to: number; where: Where } | null { for (const [a, b, wh] of sched(c).sched) if (h >= a && h < b) return { from: a, to: b, where: wh }; return null; }
function nextStart(c: SimChar, h: number): number { const s = sched(c).sched; for (const [a] of s) if (a > h) return a; return s[0][0] + 24; }

const inBuilding = (c: SimChar, name: string) => L.buildingAt(c.cell().x, c.cell().y)?.name === name;
const isPark = (c: Furn) => c.def === 'park_bench' || c.def === 'lounger';
function nearestSlot(w: World, c: SimChar, tag: string, ok: (f: Furn) => boolean) {
  let best: { f: number; s: number; stand: V2 } | null = null, bd = 1e9;
  for (const s of w.freeSlots(tag)) { const f = w.furn[s.f]; if (!ok(f)) continue; const d = dist(c.pos, { x: s.stand.x + 0.5, y: s.stand.y + 0.5 }) + w.rng.randf() * 4; if (d < bd) { bd = d; best = s; } }
  return best;
}
const moral = (c: SimChar) => 0.55 * c.trait('agreeableness') + 0.45 * c.trait('orderliness');

function planLeaveToHome(w: World, c: SimChar, until: number) { const h = c.home!; c.jobPhase = 'out'; c.jobUntil = until; c.plan = [{ type: 'goto', cell: h }, { type: 'depart' }]; w.startNextStep(c); }
function planCafe(w: World, c: SimChar): boolean {
  const hungry = c.needs.hunger < 58 && c.money >= 5; const chatty = c.trait('extraversion') > 0.55 && c.needs.social < 65 && c.money >= 3;
  const tag = hungry ? 'eat' : chatty ? 'drink' : 'read'; const act = hungry ? 'eat' : chatty ? 'drink' : 'read';
  const s = nearestSlot(w, c, tag, (f) => L.buildingAt(f.x, f.y)?.name === 'cafe') ?? nearestSlot(w, c, 'read', (f) => L.buildingAt(f.x, f.y)?.name === 'cafe');
  if (!s) return false; const a = s === undefined ? 'read' : (w.furn[s.f].slots[s.s].tags.includes(act) ? act : 'read');
  c.plan = [{ type: 'goto', cell: s.stand }, { type: 'use', furn: s.f, slot: s.s, act: a, stand: s.stand, dur: w.rng.range(a === 'eat' ? 22 : 28, a === 'eat' ? 32 : 70) }]; w.startNextStep(c); return true;
}
function planPark(w: World, c: SimChar): boolean {
  const s = nearestSlot(w, c, 'sit', isPark); if (!s) return false;
  c.plan = [{ type: 'goto', cell: s.stand }, { type: 'use', furn: s.f, slot: s.s, act: 'rest', stand: s.stand, dur: w.rng.range(25, 65) }]; w.startNextStep(c); return true;
}
/** Course à l'épicerie (aussi utilisée par les tests) : rayon, article, caisse — sauf un client fauché et peu scrupuleux, qui ressort sans payer. */
export function shopRun(w: World, c: SimChar): boolean { c.stats['store_' + w.day()] = 0; return planStore(w, c); }
function planStore(w: World, c: SimChar): boolean {
  const day = w.day(); if (c.stats['store_' + day]) return false; c.stats['store_' + day] = 1;
  const shelves = w.furn.filter((f) => Shop.SHELF_ITEMS[f.id]); if (!shelves.length) return false;
  const f = shelves[w.rng.int(0, shelves.length - 1)]; const slot = w.rng.int(0, (Shop.SHELF_ITEMS[f.id].length) - 1); const sl = f.slots[slot]; const st = { x: f.x + sl.stands[0][0], y: f.y + sl.stands[0][1] };
  const steps: SimChar['plan'] = [{ type: 'goto', cell: st }, { type: 'wait', act: 'shop', dur: w.rng.range(3, 6), mess: Shop.encode(f.i, slot) }];
  const broke = c.money < 4 && moral(c) < 0.5;                                   // fauché et peu scrupuleux : pas de passage en caisse
  if (!broke) steps.push({ type: 'goto', cell: Shop.CASH_CELL }, { type: 'wait', act: 'pay', dur: 2 });
  c.plan = steps; w.startNextStep(c); return true;
}
function planRoute(w: World, c: SimChar): boolean {
  const spots: V2[] = [{ x: 56.5, y: 21.5 }, { x: 70.5, y: 21.5 }, { x: 87.5, y: 21.5 }, { x: 60.5, y: 34.5 }, { x: 78.5, y: 34.5 }, { x: 40.5, y: 34.5 }, { x: 20.5, y: 34.5 }, { x: 33.5, y: 21.5 }];
  const here = c.cell(); const opts = spots.filter((p) => Math.hypot(p.x - here.x, p.y - here.y) > 10); const p = opts[w.rng.int(0, opts.length - 1)]; const cell = { x: Math.floor(p.x), y: Math.floor(p.y) };
  if (!w.isWalkable(cell)) return false; c.plan = [{ type: 'goto', cell }, { type: 'wait', act: 'look', dur: w.rng.range(3, 8) }]; w.startNextStep(c); return true;
}
function planCafeWork(w: World, c: SimChar): boolean {
  const here = c.cell(); if (Math.hypot(here.x - CAFE_POST.x, here.y - CAFE_POST.y) > 0.9 || !inBuilding(c, 'cafe')) c.plan = [{ type: 'goto', cell: CAFE_POST }, { type: 'wait', act: 'bartend', dur: w.rng.range(40, 90) }];
  else c.plan = [{ type: 'wait', act: 'bartend', dur: w.rng.range(40, 90) }]; w.startNextStep(c); return true;
}

/** Décision d'un citoyen : besoin urgent > conversation spontanée > emploi du temps. Appelée quand il est libre. */
export function decide(w: World, c: SimChar) {
  c.decision_cooldown = 0; const h = w.hour();
  if (Shop.hasUnpaid(c) === false && Object.values(c.inventory).some((n) => n > 0) && !inBuilding(c, 'store')) Shop.consume(c);   // il mange ce qu'il a acheté (ou volé)
  const e = entryAt(c, h); const where: Where = e?.where ?? 'home';
  // besoins urgents
  if (c.needs.hunger < 25 && c.money >= 5 && where !== 'home' && where !== 'office' && planCafe(w, c)) { c.statAdd('act_urgent'); return; }
  if (c.needs.energy < 12 && where !== 'home') { planLeaveToHome(w, c, w.clock + 240); return; }
  // conversation spontanée avec quelqu'un d'à côté
  if (where !== 'home' && c.needs.social < 72 && w.clock - c.last_chat > 45 && w.rng.randf() < 0.45 + 0.3 * c.trait('extraversion')) {
    let best: SimChar | null = null, bs = -1e9;
    for (const o of w.chars) { if (o.id === c.id || o.away || !['resident', 'citizen', 'clerk'].includes(o.kind) || !Social.canBeApproached(w, o)) continue; const d = dist(o.pos, c.pos); if (d > 7) continue; const r = w.getRel(c.id, o.id); if ((c.avoid[o.id] ?? 0) > w.clock) continue; const s = r.aff * 0.3 + r.fam * 0.1 - d + w.rng.randf() * 4; if (s > bs) { bs = s; best = o; } }
    if (best) { c.plan = [{ type: 'approach', target: best.id }]; w.startNextStep(c); if (c.state !== 'idle') return; }
  }
  switch (where) {
    case 'home': { const until = w.clock - w.tod() + nextStart(c, h) * 60; planLeaveToHome(w, c, until); return; }
    case 'office': { const sp = sched(c); const until = w.clock - w.tod() + (e?.to ?? 17) * 60; c.jobPhase = 'working'; c.jobUntil = until; c.jobStart = w.clock; c.shift = { from: e?.from ?? 8.3, to: e?.to ?? 17, pay: sp.wage, place: sp.job }; c.plan = [{ type: 'goto', cell: { x: OFFICE_EXIT.x, y: OFFICE_EXIT.y } }, { type: 'depart' }]; w.startNextStep(c); w.emitLog(`${c.first} part au bureau.`, 'info', c.id); return; }
    case 'cafeWork': if (planCafeWork(w, c)) return; break;
    case 'cafe': if (planCafe(w, c)) return; break;
    case 'store': if (planStore(w, c)) return; if (planPark(w, c)) return; break;
    case 'park': if (planPark(w, c)) return; break;
    case 'route': if (w.rng.randf() < 0.18 && planStore(w, c)) return; if (w.rng.randf() < 0.2 && planCafe(w, c)) return; if (planRoute(w, c)) return; break;
  }
  if (planPark(w, c) || planCafe(w, c)) return;
  c.plan = [{ type: 'wait', act: 'look', dur: 4 }]; w.startNextStep(c);
}

/** Le commerçant : présent de 7 h 45 à 21 h derrière sa caisse, absent sinon. */
export function updateClerk(w: World, c: SimChar, dt: number, dmin: number) {
  const open = w.hour() >= 7.75 && w.hour() < 21; const post = c.dutyPost!;
  if (c.away) { if (!open) return; c.away = false; c.jobPhase = ''; c.pos = { x: 61.5, y: 19.5 }; c.state = 'idle'; c.plan = []; c.action_text = 'Ouvre la boutique'; }
  if (c.state === 'idle') {
    if (open) { if (Math.hypot(c.pos.x - (post.x + 0.5), c.pos.y - (post.y + 0.5)) > 0.25) c.plan = [{ type: 'goto', cell: post }, { type: 'wait', act: 'clerk', dur: 9999 }]; else c.plan = [{ type: 'wait', act: 'clerk', dur: 9999 }]; w.startNextStep(c); }
    else if (c.pos.y < 19) { c.plan = [{ type: 'goto', cell: { x: 61, y: 19 } }, { type: 'depart' }]; w.startNextStep(c); }
    else { c.away = true; c.state = 'idle'; }
  } else if (c.state === 'use' && !open && c.use_act === 'clerk') w.endUse(c, true);
  void dt; void dmin;
}
void ACT;
