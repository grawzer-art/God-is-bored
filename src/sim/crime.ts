/** Criminalité et police de NORIA. Les délits sont de vrais événements : témoins (vue dégagée), signalements téléphoniques, niveau de recherche,
 *  policiers qui se déplacent, poursuivent et arrêtent, amendes, garde à vue, casier. Valable pour le joueur comme pour les PNJ (aucun script). */
import type { V2 } from './defs';
import * as L from './layout';
import { lineClear } from './movement';
import * as Shop from './shop';
import type { SimChar } from './simchar';
import { addEvent, learn } from './life';
import { dist, type World } from './world';

export interface Dispatch { id: number; t: number; pos: V2; kind: string; perp: number; sev: number; officer: number; closed: boolean }
export interface Report { due: number; pos: V2; perp: number; sev: number; kind: string; by: number }
export interface Wanted { level: number; heat: number; last: V2 | null }
export interface Record_ { arrests: number; fines: number; crimes: number; jailMin: number }

export const STATION_DOOR: V2 = { x: 75, y: 19 };      // trottoir devant le commissariat
export const CELL: V2 = { x: 79.5, y: 11.5 };          // cellule de garde à vue
const PATROL: V2[] = [{ x: 56, y: 21 }, { x: 70, y: 21 }, { x: 88, y: 21 }, { x: 54, y: 10 }, { x: 40, y: 21 }, { x: 24, y: 21 }, { x: 56, y: 34 }, { x: 78, y: 34 }, { x: 20, y: 34 }, { x: 62, y: 21 }];
const VISION = 13, ARREST_RANGE = 1.65;
/** Case praticable la plus proche d'une position (la cible peut être couchée dans un lit ou assise sur un canapé : cases non praticables). */
const reach = (w: World, p: V2): V2 => { const c = { x: Math.floor(p.x), y: Math.floor(p.y) }; return w.isWalkable(c) ? c : w.nearestFreeCell(c, 3); };
export const blankWanted = (): Wanted => ({ level: 0, heat: 0, last: null });
export const blankRecord = (): Record_ => ({ arrests: 0, fines: 0, crimes: 0, jailMin: 0 });
const moral = (c: SimChar) => 0.55 * c.trait('agreeableness') + 0.45 * c.trait('orderliness');
const awake = (c: SimChar) => !c.away && !c.isAsleep();
const nm = (c: SimChar) => (c.kind === 'avatar' ? "l'étranger" : c.first);

/** Les personnages qui voient la position p (éveillés, présents, à portée, sans mur entre eux). */
export function viewers(w: World, p: V2, except: number[], radius = 8): SimChar[] {
  return w.chars.filter((o) => !except.includes(o.id) && o.kind !== 'avatar' && awake(o) && dist(o.pos, p) <= radius && lineClear(o.pos, p));
}

/** Un délit vient d'être commis. `victim` : -1 si aucune personne précise (commerce). Les témoins réagissent ; certains préviennent la police. */
export function onCrime(w: World, perp: SimChar, kind: 'theft' | 'shoplift' | 'assault' | 'robbery', victim: number, pos: V2, sev: number, amount = 0) {
  w.record_.crimes += perp.kind === 'avatar' ? 1 : 0; perp.statAdd('crimes');
  const wits = viewers(w, pos, [perp.id], kind === 'shoplift' ? 14 : kind === 'robbery' ? 12 : 8);
  const ev = addEvent(w, { kind, actor: perp.id, target: victim >= 0 ? victim : (w.clerk?.id ?? -1), x: pos.x, y: pos.y, amount, sig: 0.8 });
  for (const o of wits) {
    w.showEmote(o, 'alert', 2.6); o.addMemory(w.clock, 'crime', kind === 'shoplift' ? `J'ai vu ${nm(perp)} partir sans payer.` : kind === 'robbery' ? `J'ai vu ${nm(perp)} braquer l'épicerie.` : `J'ai vu ${nm(perp)} commettre un vol.`, kind === 'robbery' ? -0.9 : -0.6, kind === 'robbery' ? 1 : 0.9, perp.id, { src: 'lived', ev: ev.id, conf: 1, subj: perp.id });
    if (o.kind === 'resident') learn(w, o, ev, 'lived', 1, -1, perp.id);
    if (o.kind === 'police') { alertOfficer(w, o, perp); continue; }
    const rel = w.getRel(o.id, perp.id); let p = o.kind === 'clerk' ? 0.97 : 0.2 + 0.5 * moral(o) + (o.id === victim ? 0.35 : 0);
    if (rel.aff > 40) p *= 0.3; if (o.trait('neuroticism') > 0.7 && rel.fear > 30) p *= 0.5;
    if (w.rng.randf() < Math.min(0.98, p)) w.reports.push({ due: w.clock + w.rng.range(3, 10), pos: { ...pos }, perp: perp.id, sev, kind, by: o.id });
  }
  w.emitLog(`${nm(perp)} ${kind === 'shoplift' ? 'quitte la boutique sans payer' : kind === 'robbery' ? 'braque l\'épicerie' : 'commet un vol'}${wits.length ? ` — vu par ${wits.map((o) => o.first).join(', ')}` : ' — personne ne semble avoir vu'}.`, 'drama', perp.id);
  return ev;
}
/** Un témoin (résident, qui connaît le coupable) prévient la police après coup. */
export function maybeReport(w: World, by: SimChar, perp: number, pos: V2, sev: number, p: number) {
  if (by.kind === 'police' || perp === by.id || w.rng.randf() > p) return; if (w.reports.some((r) => r.perp === perp && r.by === by.id && w.clock - r.due < 60)) return;
  w.reports.push({ due: w.clock + w.rng.range(8, 30), pos: { ...pos }, perp, sev, kind: 'theft', by: by.id });
}

/** Niveau de recherche du joueur : monte avec les délits signalés, retombe quand la police ne le voit plus. */
export function raiseWanted(w: World, sev: number, pos: V2) { const q = w.wanted; q.level = Math.min(3, Math.max(q.level, 0) + sev); q.heat = w.clock + 25 + 10 * q.level; q.last = { ...pos }; }

export function alertOfficer(w: World, o: SimChar, perp: SimChar) { w.showEmote(o, 'alert', 3); startTask(w, o, 'pursue', perp.id, { ...perp.pos }); }
function startTask(w: World, o: SimChar, kind: NonNullable<SimChar['task']>['kind'], target: number, pos: V2) {
  o.task = { kind, target, pos: { ...pos }, until: w.clock + (kind === 'search' ? 14 : 90), since: w.clock, repath: 0 };
  if (o.state === 'use') w.endUse(o, false); else if (o.state === 'walk') w.abortPlan(o, 'task');
  o.speed = kind === 'pursue' || kind === 'respond' ? 2.7 : 1.9;
}
const busy = (o: SimChar) => o.task?.kind === 'pursue' || (o.task?.kind === 'respond' && !!o.task && o.task.since > 0 && o.task.until > 0);

/** Traite les appels, affecte l'agent disponible le plus proche, entretient le niveau de recherche et la garde à vue. Appelé à chaque pas. */
export function tick(w: World, _dt: number, _dmin: number) {
  holdupTick(w); if (w.till < 220) w.till = Math.min(220, w.till + _dmin * 0.15);
  if (!w.laws.police && w.reports.length) w.reports.length = 0;    // loi divine : plus de police, plus d'appels traités
  if (w.reports.length) {
    const due = w.reports.filter((r) => w.clock >= r.due); w.reports = w.reports.filter((r) => w.clock < r.due);
    for (const r of due) {
      const caller = w.chars[r.by]; const d: Dispatch = { id: w.nextDispatch++, t: w.clock, pos: r.pos, kind: r.kind, perp: r.perp, sev: r.sev, officer: -1, closed: false }; w.dispatches.push(d);
      if (w.dispatches.length > 30) w.dispatches.shift();
      const who = w.chars[r.perp];
      w.emitLog(`${caller?.first ?? 'Quelqu\'un'} appelle la police${who ? ` : « c'est ${nm(who)} »` : ''}.`, 'drama', r.by);
      if (r.perp === w.avatar.id) raiseWanted(w, r.sev, r.pos); else if (r.perp >= 0) w.wantedNpcs[r.perp] = w.clock + 8 * 60;
      let best: SimChar | null = null, bd = 1e9; for (const o of w.police) { if (busy(o) || o.away) continue; const dd = dist(o.pos, r.pos); if (dd < bd) { bd = dd; best = o; } }
      if (best) { d.officer = best.id; startTask(w, best, 'respond', r.perp, r.pos); w.emitLog(`${best.first} part sur les lieux.`, 'info', best.id); }
    }
  }
  const q = w.wanted; if (q.level > 0 && w.clock > q.heat) { q.level--; q.heat = q.level > 0 ? w.clock + 15 : 0; if (q.level === 0) { q.last = null; w.emitLog('Les recherches vous concernant sont abandonnées.', 'info'); } }
  for (const k of Object.keys(w.wantedNpcs)) if (w.clock > w.wantedNpcs[Number(k)]) delete w.wantedNpcs[Number(k)];
  if (w.jail && w.clock >= w.jail.until) { const av = w.avatar; w.jail = null; av.pos = { x: STATION_DOOR.x + 0.5, y: STATION_DOOR.y + 0.5 }; av.state = 'idle'; av.plan = []; w.emitLog('Vous êtes libéré(e) du commissariat.', 'info'); w.onJailEnd?.(); }
  // sortie d'une boutique avec des articles non payés = vol à l'étalage
  for (const c of w.chars) if (c.kind !== 'police' && c.kind !== 'clerk' && Shop.hasUnpaid(c) && !Shop.inStore(c) && c.state !== 'enter' && c.state !== 'exit') shoplift(w, c);
}
function shoplift(w: World, c: SimChar) {
  const due = Shop.owed(c); c.unpaid = {}; if (due <= 0) return; const d = L.BUILDINGS.find((b) => b.name === 'store')!.door!; onCrime(w, c, 'shoplift', -1, { x: d[0] + 0.5, y: d[1] + 0.5 }, 1, due); // les témoins voient la sortie par la porte
}

// ---------------------------------------------------------------- policiers
/** Cerveau d'un agent : perception, mission en cours. Les déplacements eux-mêmes sont ceux de tout personnage (plans, A*). */
export function policeThink(w: World, o: SimChar, dt: number) {
  if (o.away) return; o.lifeT += dt;
  const t = o.task;
  // perception toutes les 0,4 s
  if (o.lifeT >= 0.4) {
    o.lifeT = 0;
    const cands: SimChar[] = []; if (w.wanted.level > 0 && !w.jail) cands.push(w.avatar); for (const k of Object.keys(w.wantedNpcs)) { const n = w.chars[Number(k)]; if (n && !n.away) cands.push(n); }
    for (const s of cands) {
      const d = dist(o.pos, s.pos); const sees = d <= VISION && lineClear(o.pos, s.pos);
      if (sees) { if (s.kind === 'avatar') { w.wanted.last = { ...s.pos }; w.wanted.heat = Math.max(w.wanted.heat, w.clock + 20); } if (!(o.task?.kind === 'pursue' && o.task.target === s.id)) { w.showEmote(o, 'alert', 2.5); startTask(w, o, 'pursue', s.id, { ...s.pos }); } if (d <= ARREST_RANGE) { arrest(w, o, s); return; } }
    }
  }
  const task = o.task;
  if (task?.kind === 'pursue') {
    const s = w.chars[task.target]; if (!s || s.away || (s.kind === 'avatar' && w.jail)) { endTask(w, o); return; }
    const sees = dist(o.pos, s.pos) <= VISION + 2 && lineClear(o.pos, s.pos); if (sees) { task.pos = { ...s.pos }; task.until = w.clock + 18; }
    task.repath -= dt; if (task.repath <= 0 && o.state !== 'enter' && o.state !== 'exit') { task.repath = 0.5; const cell = reach(w, task.pos); if (cell.x >= 0 && !(o.state === 'walk' && o.path_goal.x === cell.x && o.path_goal.y === cell.y)) { if (o.state === 'use') w.endUse(o, false); o.plan = [{ type: 'goto', cell }]; w.startNextStep(o); } }
    if (w.clock > task.until) { startTask(w, o, 'search', -1, task.pos); }
    return;
  }
  if (task?.kind === 'respond') {
    const s = task.target >= 0 ? w.chars[task.target] : null;
    // l'identité est connue : l'agent se rend là où se trouve la personne désignée (un résident chez lui, par exemple)
    if (s && !s.away && s.kind !== 'avatar') { task.repath -= dt; if (task.repath <= 0) { task.repath = 1.2; const cell = reach(w, s.pos); if (cell.x >= 0 && o.state !== 'enter' && o.state !== 'exit' && !(o.state === 'walk' && o.path_goal.x === cell.x && o.path_goal.y === cell.y)) { if (o.state === 'use') w.endUse(o, false); o.plan = [{ type: 'goto', cell }]; w.startNextStep(o); } } if (dist(o.pos, s.pos) <= ARREST_RANGE && lineClear(o.pos, s.pos)) arrest(w, o, s); return; }
    if (o.state === 'idle' || o.state === 'use') { if (dist(o.pos, task.pos) > 2.5) { const cell = w.nearestFreeCell({ x: Math.floor(task.pos.x), y: Math.floor(task.pos.y) }, 3); if (cell.x >= 0) { if (o.state === 'use') w.endUse(o, false); o.plan = [{ type: 'goto', cell }]; w.startNextStep(o); } } else startTask(w, o, 'search', -1, task.pos); }
    if (w.clock > task.until) endTask(w, o);
    return;
  }
  if (task?.kind === 'search') { if (o.state === 'idle') { o.plan = [{ type: 'wait', act: 'patrol', dur: 6 }]; w.startNextStep(o); } if (w.clock > task.until) endTask(w, o); return; }
  // patrouille / poste
  if (o.state === 'idle' || (o.state === 'use' && o.use_act === 'patrol' && o.use_left < 0.5)) {
    o.speed = 1.9;
    if (o.place === 'patrol' && (!task || task.kind === 'return' || task.kind === 'patrol')) { const p = PATROL[w.rng.int(0, PATROL.length - 1)]; const cell = { x: Math.floor(p.x), y: Math.floor(p.y) }; if (w.isWalkable(cell)) { o.plan = [{ type: 'goto', cell }, { type: 'wait', act: 'patrol', dur: w.rng.range(6, 14) }]; w.startNextStep(o); o.task = { kind: 'patrol', target: -1, pos: p, until: 0, since: w.clock, repath: 0 }; } }
    else if (o.place === 'desk') { const post = o.dutyPost!; if (Math.hypot(o.pos.x - (post.x + 0.5), o.pos.y - (post.y + 0.5)) > 0.3) o.plan = [{ type: 'goto', cell: post }, { type: 'wait', act: 'patrol', dur: 30 }]; else o.plan = [{ type: 'wait', act: 'patrol', dur: 30 }]; w.startNextStep(o); o.task = { kind: 'return', target: -1, pos: post, until: 0, since: w.clock, repath: 0 }; }
  }
}
function endTask(w: World, o: SimChar) { o.task = null; o.speed = 1.9; if (o.state === 'walk') w.abortPlan(o, 'task'); }

/** Arrestation. Le joueur paie l'amende, perd les articles volés et passe un temps en cellule ; un PNJ est retiré de la carte le temps de sa garde à vue. */
export function arrest(w: World, o: SimChar, s: SimChar, surrender = false) {
  endTask(w, o); o.statAdd('arrests');
  const level = s.kind === 'avatar' ? Math.max(1, w.wanted.level) : 1; const unpaid = Shop.owed(s);
  let fine = 30 * level + unpaid; if (surrender) fine = Math.round(fine * 0.7); fine = Math.min(Math.floor(s.money), fine); s.money -= fine; w.record_.fines += s.kind === 'avatar' ? fine : 0; o.money += 0;
  s.unpaid = {}; w.stats.arrests = (w.stats.arrests ?? 0) + 1; for (const d of w.dispatches) if (d.perp === s.id) d.closed = true; delete w.wantedNpcs[s.id];
  const ev = addEvent(w, { kind: 'arrest', actor: o.id, target: s.id, x: s.pos.x, y: s.pos.y, amount: fine, sig: 0.7 });
  for (const v of viewers(w, s.pos, [o.id, s.id], 9)) { v.addMemory(w.clock, 'arrest', `J'ai vu ${o.first} arrêter ${nm(s)}.`, 0, 0.7, s.id, { src: 'lived', ev: ev.id, conf: 1, subj: s.id }); if (v.kind === 'resident') learn(w, v, ev, 'lived', 1, -1, s.id); }
  if (s.kind === 'avatar') {
    const jailMin = (surrender ? 20 : 30) * level; w.record_.arrests++; w.record_.jailMin += jailMin; w.jail = { until: w.clock + jailMin }; w.wanted = blankWanted();
    if (s.state === 'use') w.endUse(s, false); w.abortPlan(s, 'arrest'); s.pos = { ...CELL }; s.state = 'idle'; s.plan = [];
    w.emitLog(`${o.first} vous arrête${surrender ? ' (vous vous êtes rendu(e))' : ''} : amende de ${fine} €, ${jailMin} min en garde à vue.`, 'drama', o.id); w.onArrest?.(o, fine, jailMin);
  } else {
    if (s.state === 'use') w.endUse(s, false); w.abortPlan(s, 'arrest'); s.intent = null; s.away = true; s.jobPhase = 'jail'; s.jobUntil = w.clock + 120; s.addMemory(w.clock, 'arrest', `J'ai été arrêté(e) par ${o.first} : amende de ${fine} €.`, -0.8, 0.95, o.id, { src: 'lived', conf: 1 });
    s.stress = Math.min(100, s.stress + 25); w.emitLog(`${o.first} arrête ${nm(s)} (amende ${fine} €, garde à vue).`, 'drama', o.id);
  }
}
void L;

// ---------------------------------------------------------------------------------------------------------------------
// Braquage : une situation physique en trois temps (menace → réaction du commerçant → butin / alarme), pas un bouton.
export interface Holdup { clerk: number; perp: number; t0: number; outcome: 'comply' | 'resist' | 'flee'; done: boolean }
const PANIC_FLEE = { x: 0, y: 0 };
/** Menace le commerçant. Son caractère décide : obéir (la plupart), résister (courageux, peu amène) ou s'enfuir donner l'alerte. */
export function startHoldup(w: World, perp: SimChar): { ok: boolean; line: string } {
  const clerk = w.clerk; if (!clerk || clerk.away) return { ok: false, line: 'Il n\'y a personne à menacer.' }; if (w.holdup) return { ok: false, line: 'Une scène est déjà en cours.' };
  const courage = 0.55 * (1 - clerk.trait('neuroticism')) + 0.45 * (1 - clerk.trait('agreeableness'));
  const roll = w.rng.randf(); const outcome: Holdup['outcome'] = roll < courage * 0.55 ? 'resist' : roll > 0.88 ? 'flee' : 'comply';
  w.holdup = { clerk: clerk.id, perp: perp.id, t0: w.clock, outcome, done: false };
  clerk.decision_cooldown = 99; if (clerk.state === 'use') w.endUse(clerk, false); w.showEmote(clerk, 'alert', 4);
  const d = L.BUILDINGS.find((b) => b.name === 'store')!.door!; const out = { x: d[0], y: d[1] + 1 };
  // les clients voient la scène : ils s'affolent et sortent
  for (const o of viewers(w, perp.pos, [perp.id, clerk.id], 12)) {
    if (o.kind === 'police') continue; w.showEmote(o, 'alert', 4); w.abortPlan(o, 'panic'); o.plan = [{ type: 'goto', cell: out } as any]; w.startNextStep(o); o.decision_cooldown = 6;
  }
  w.emitLog(`${nm(perp)} menace ${clerk.first} à la caisse.`, 'drama', perp.id);
  return { ok: true, line: `Vous menacez ${clerk.first} : « La caisse. Maintenant. »` };
}
/** Fait avancer le braquage : dénouement quelques secondes après la menace. */
export function holdupTick(w: World) {
  const h = w.holdup; if (!h || h.done) { if (h && w.clock - h.t0 > 12) w.holdup = null; return; }
  if (w.clock - h.t0 < 0.5) return; h.done = true; const perp = w.chars[h.perp], clerk = w.chars[h.clerk]; const pos = { x: clerk.pos.x, y: clerk.pos.y };
  clerk.decision_cooldown = 1;
  const near = dist(perp.pos, clerk.pos) <= 4.5;
  if (!near) { w.emitLog(`${nm(perp)} s'éloigne : la menace tourne court.`, 'info', perp.id); w.holdup = null; return; }
  const ev = onCrime(w, perp, 'robbery', clerk.id, pos, 3, 0);
  const rel = w.getRel(clerk.id, perp.id); rel.fear = Math.min(100, rel.fear + 50); rel.aff -= 40;
  clerk.addMemory(w.clock, 'crime', `${nm(perp)} m'a braqué à la caisse.`, -1, 1, perp.id, { src: 'lived', ev: ev.id, conf: 1, subj: perp.id });
  if (h.outcome === 'comply') {
    const loot = Math.min(w.till, Math.round(70 + w.rng.randf() * 90)); w.till -= loot; perp.money += loot; w.stats.holdup_loot = (w.stats.holdup_loot ?? 0) + loot; if (perp.kind === 'avatar') w.record_.crimes++;
    w.showEmote(clerk, 'sweat', 3); w.emitLog(`${clerk.first} vide la caisse en tremblant : ${loot} € pour ${nm(perp)}.`, 'drama', clerk.id);
    w.reports.push({ due: w.clock + 1.2, pos, perp: perp.id, sev: 3, kind: 'robbery', by: clerk.id });
  } else if (h.outcome === 'resist') {
    w.showEmote(clerk, 'anger', 3); w.emitLog(`${clerk.first} refuse et déclenche l'alarme : « Vous n'aurez rien ! »`, 'drama', clerk.id);
    w.reports.push({ due: w.clock + 0.1, pos, perp: perp.id, sev: 3, kind: 'robbery', by: clerk.id });
  } else {
    w.showEmote(clerk, 'sweat', 3); w.emitLog(`${clerk.first} se jette derrière le comptoir et appelle la police.`, 'drama', clerk.id);
    w.reports.push({ due: w.clock + 0.2, pos, perp: perp.id, sev: 3, kind: 'robbery', by: clerk.id });
  }
  void PANIC_FLEE; w.holdup = null;
}
