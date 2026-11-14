/** Directeur d'événements léger : propose des situations COHÉRENTES à partir de l'état réel du monde (relations, argent, horaires, mémoires), jamais du chaos gratuit.
 *  Garde-fous : écart minimal entre deux événements, cooldown par type, jamais deux fois le même type d'affilée, une seule dispute à la fois, rien pendant un dialogue ou une bagarre du joueur.
 *  Le joueur peut intervenir (parler, calmer, frapper, appeler la police), ignorer ou observer. */
import type { SimChar } from './simchar';
import { dist, type World } from './world';
import * as Camp from './campaign';
import * as Fight from './fight';
import * as Crime from './crime';
import * as City from './city';
import * as Combat from './combat';
import * as Debt from './debt';
import { MIN_PER_SEC } from './defs';

export interface Dir { on: boolean; last: number; lastKind: string; cool: Record<string, number>; log: { t: number; kind: string; text: string }[]; check: number }
export const blank = (): Dir => ({ on: false, last: 0, lastKind: '', cool: {}, log: [], check: -1 });
const GAP = 180, EVAL = 12;
type Ev = { kind: string; cooldown: number; weight: number; run: (w: World) => string | null };
const adults = (w: World) => w.chars.filter((c) => (c.kind === 'resident' || c.kind === 'citizen') && c.age >= 18 && !c.away && c.state !== 'ko' && c.state !== 'enter' && c.state !== 'exit' && !w.fighters.has(c.id) && c.holdUntil <= w.clock);
const outdoors = (w: World, c: SimChar) => w.roomOf(c.pos) !== '' && 'srgynzq'.includes(w.roomOf(c.pos));
const near = (w: World, p: { x: number; y: number }, r = 26) => dist(w.avatar.pos, p) < r;
const say = (c: SimChar, w: World, text: string, secs = 5) => { c.say = { text, until: w.clock + secs * MIN_PER_SEC }; };

const EVENTS: Ev[] = [
  { kind: 'dispute', cooldown: 300, weight: 3, run: (w) => {
    if (Camp.disputeActive(w) || w.fighters.size) return null; const out = adults(w).filter((c) => outdoors(w, c) && !Debt.isTommy(c)); let best: [SimChar, SimChar] | null = null, bs = 0;
    for (const a of out) for (const b of out) { if (a.id >= b.id || dist(a.pos, b.pos) > 9) continue; const r = w.getRel(a.id, b.id), r2 = w.getRel(b.id, a.id); const s = (10 - r.aff - r2.aff) * 0.5 + (a.anger + b.anger) * 0.2 + (1 - a.trait('agreeableness')) * 8 + (1 - b.trait('agreeableness')) * 8 + (a.drunk + b.drunk) * 0.1; if (s > bs) { bs = s; best = [a, b]; } }
    if (!best || bs < 12) return null; const [a, b] = best; const mid = { x: (a.pos.x + b.pos.x) / 2, y: (a.pos.y + b.pos.y) / 2 }; const text = `${a.first} et ${b.first} se disputent dans la rue.`; return Camp.startDispute(w, a, b, mid, text, 30, false) ? text : null; } },
  { kind: 'shoplift', cooldown: 420, weight: 2, run: (w) => {
    const h = w.hour(); if (h < 9 || h > 19.5 || !w.clerk || w.clerk.away) return null; const c = adults(w).find((x) => x.kind === 'citizen' && x.money < 14 && (0.55 * x.trait('agreeableness') + 0.45 * x.trait('orderliness')) < 0.55 && x.state === 'idle'); if (!c) return null;
    c.money = Math.min(c.money, 3); c.stats['store_' + w.day()] = 0; if (!City.shopRun(w, c)) return null; return `${c.first}, fauché(e), file à l'épicerie : l'idée d'un coup lui trotte dans la tête.`; } },
  { kind: 'police_check', cooldown: 360, weight: 2, run: (w) => {
    const av = w.avatar; if (av.away || w.jail || w.fighters.size) return null; const cops = w.police.filter((p) => !p.away && p.state === 'idle' && dist(p.pos, av.pos) < 22); const cop = cops[0]; if (!cop) return null;
    const suspicious = w.wanted.level > 0 || (w.job?.illegal && (av.inventory.parcel ?? 0) > 0) || av.drunk > 60 || w.rep.criminal > 18; if (!suspicious) return null;
    w.dir.check = cop.id; w.abortPlan(cop, 'contrôle'); const cell = w.nearestFreeCell({ x: Math.floor(av.pos.x), y: Math.floor(av.pos.y) }, 3); if (cell.x >= 0) { cop.plan = [{ type: 'goto', cell } as any]; w.startNextStep(cop); } return `${cop.first} vous a repéré(e) et se dirige vers vous pour un contrôle.`; } },
  { kind: 'rumor', cooldown: 480, weight: 2, run: (w) => {
    const all = adults(w); const teller = all.find((c) => c.trait('extraversion') > 0.6 && c.kind !== 'police'); if (!teller) return null; const listener = all.find((c) => c.id !== teller.id && dist(c.pos, teller.pos) < 7); if (!listener) return null;
    const subject = all.find((c) => c.id !== teller.id && c.id !== listener.id && c.secret && c.secret.length > 8 && !listener.memories.some((m) => m.subj === c.id && m.kind === 'rumor')); if (!subject) return null;
    const text = `Rumeur : ${teller.first} murmure à ${listener.first} que ${subject.first} cache quelque chose.`; listener.addMemory(w.clock, 'rumor', `${teller.first} dit que ${subject.first} cache quelque chose.`, -0.2, 0.5, subject.id, { src: 'told', conf: 0.5, subj: subject.id }); const r = w.getRel(listener.id, subject.id); r.aff = Math.max(-100, r.aff - 3); r.trust = Math.max(0, r.trust - 3); return text; } },
  { kind: 'accident', cooldown: 600, weight: 1, run: (w) => {
    const tr = w.traffic; if (!tr || tr.cars.length < 2) return null; const c = tr.cars[Math.floor(w.rng.randf() * tr.cars.length)]; c.hold = w.clock + 6; const sx = c.x; const gather = adults(w).filter((x) => outdoors(w, x) && Math.abs(x.pos.x - sx) < 12 && Math.abs(x.pos.y - 20.5) < 5).slice(0, 3); for (const g of gather) w.showEmote(g, 'alert', 3); return 'Un accrochage bloque un moment l\'avenue : klaxons et curieux.'; } },
  { kind: 'meeting', cooldown: 420, weight: 1, run: (w) => {
    const all = adults(w).filter((c) => outdoors(w, c)); for (const a of all) for (const b of all) { if (a.id >= b.id || dist(a.pos, b.pos) > 6 || !compat(a, b) || (a.id === w.avatar.id || b.id === w.avatar.id)) continue; const r = w.getRel(a.id, b.id), r2 = w.getRel(b.id, a.id); if (r.att < 20 && r2.att < 20) continue; r.att = Math.min(100, r.att + 4); r2.att = Math.min(100, r2.att + 4); w.showEmote(a, 'heart', 3); w.showEmote(b, 'heart', 3); return `${a.first} et ${b.first} se croisent sur la promenade : quelque chose passe.`; } return null; } },
];
const compat = (a: SimChar, b: SimChar) => { const o = (c: SimChar) => (c.attracted_to.length ? c.attracted_to : c.id % 5 === 0 ? ['F'] : c.id % 5 === 1 ? ['M'] : ['M', 'F']); return o(a).includes(b.gender) && o(b).includes(a.gender); };

let acc = new WeakMap<World, number>();
export function tick(w: World, dt: number) {
  const a = (acc.get(w) ?? 0) + dt * MIN_PER_SEC; if (a < EVAL) { acc.set(w, a); return; } acc.set(w, 0); const d = w.dir; if (!d || !d.on || w.jail) return;
  if (w.clock - d.last < GAP || w.hud_busy) return;
  const cands = EVENTS.filter((e) => (d.cool[e.kind] ?? 0) <= w.clock && e.kind !== d.lastKind); let total = cands.reduce((s, e) => s + e.weight, 0); if (!total) return;
  let r = w.rng.randf() * total; for (const e of cands) { r -= e.weight; if (r > 0) continue; const text = e.run(w); if (text) { d.last = w.clock; d.lastKind = e.kind; d.cool[e.kind] = w.clock + e.cooldown; d.log.push({ t: w.clock, kind: e.kind, text }); if (d.log.length > 40) d.log.shift(); w.emitLog(text, 'drama'); if (dist(w.avatar.pos, w.avatar.pos) >= 0) w.questToasts.push(text); w.stats['dir_' + e.kind] = (w.stats['dir_' + e.kind] ?? 0) + 1; } else d.cool[e.kind] = w.clock + 45; return; }
}
/** Contrôle de police : réponse du joueur (obtempérer = fouille ; fuir = poursuite). */
export function checkAnswer(w: World, cop: SimChar, obey: boolean): { line: string; close: boolean } {
  const av = w.avatar; w.dir.check = -1; cop.holdUntil = 0;
  if (!obey) { Crime.raiseWanted(w, 1, av.pos); Crime.alertOfficer(w, cop, av); Debt.rep(w, 'police', -3); Debt.rep(w, 'criminal', 2); return { line: `${cop.first} crie : « Police ! Ne bougez plus ! » Vous détalez.`, close: true }; }
  const illegal = !!w.job?.illegal && (av.inventory.parcel ?? 0) > 0;
  if (illegal) { av.inventory.parcel = 0; w.job = null; const fine = Math.min(Math.floor(av.money), 150); av.money -= fine; w.record_.fines += fine; Debt.rep(w, 'criminal', -1); Debt.rep(w, 'police', -2); return { line: `${cop.first} fouille votre sac : « Un colis scellé, sans facture. Je le confisque. Amende : ${fine} €. »`, close: true }; }
  if (w.wanted.level > 0) { Crime.arrest(w, cop, av, true); return { line: 'Vous levez les mains. On vous emmène.', close: true }; }
  Debt.rep(w, 'police', 1); return { line: `${cop.first} hoche la tête : « Rien à signaler. Bonne soirée. »`, close: true };
}
export const checkOpen = (w: World, npc: SimChar) => npc.kind === 'police' && w.dir.check === npc.id;
void Combat; void Fight;
