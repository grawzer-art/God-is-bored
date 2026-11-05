/** LIVING NORIA — vie autonome des habitants : emplois et argent, sorties au bar, événements du monde (vol, dispute, aide, emploi),
 *  mémoire avec provenance (vécu / raconté / soupçonné), propagation des rumeurs, réactions et relations évolutives.
 *  Moteur local, déterministe (même graine = même histoire), sans réseau ni IA externe. Aucune dépendance au rendu.
 *
 *  Principe : rien n'est « raconté » sans effet. Chaque événement change l'argent, une relation, une intention, une habitude (évitement)
 *  ou la connaissance d'un habitant ; le journal (texte) ne fait que décrire ces changements. */
import { ACT, type V2 } from './defs';
import * as L from './layout';
import { lineClear } from './movement';
import type { Know, Shift, SimChar, Source } from './simchar';
import { dist, type Rel, type World, type WorldEvent } from './world';

// ------------------------------------------------------------------ paramètres
/** Emplois réels (hors carte) : horaires distincts pour que tout le monde ne suive pas le même emploi du temps. Clé = identifiant d'habitant. */
export const SHIFTS: Record<number, Shift> = {
  1: { from: 10, to: 16.5, pay: 95, place: 'le restaurant' },   // Mehdi, cuisinier
  2: { from: 15, to: 20, pay: 60, place: 'la fac' },            // Inès, doctorante (vacations)
  3: { from: 7.75, to: 15.5, pay: 90, place: 'un chantier' },   // Théo, plombier
  4: { from: 9, to: 18, pay: 150, place: "l'agence" },          // Aïcha, marketing
  7: { from: 11, to: 19, pay: 140, place: 'le bureau' },        // Karim, développeur
};
export const NEW_JOB: Shift = { from: 11, to: 17, pay: 55, place: 'la librairie' };
const STREET_IN: V2 = { x: 16, y: 19 };           // trottoir devant la porte de la maison
const HOME_IN: V2 = { x: 16, y: 16 };
export const MAX_KNOWN = 40, MAX_EVENTS = 80;
const NEAR = 18;                                   // rayon (cases) de simulation détaillée autour du joueur
export const moral = (c: SimChar) => 0.55 * c.trait('agreeableness') + 0.45 * c.trait('orderliness');
const clamp = (v: number, a = 0, b = 100) => Math.max(a, Math.min(b, v));
const nm = (c: SimChar) => (c.kind === 'avatar' ? "l'étranger" : c.first);
const inBuilding = (c: SimChar, name: string) => L.buildingAt(c.cell().x, c.cell().y)?.name === name;
const awake = (c: SimChar) => !c.away && !c.isAsleep();

// ------------------------------------------------------------------ initialisation
export function init(w: World) {
  for (const c of w.residents) { c.shift = SHIFTS[c.id] ? { ...SHIFTS[c.id] } : null; c.known = {}; c.intent = null; }
  for (const [k, r] of w.rel) { r.trust = clamp(45 + r.aff * 0.4 + (r.fam - 30) * 0.1); r.resp = clamp(45 + r.aff * 0.1); r.fear = 0; r.cd = 0; void k; }
}

// ------------------------------------------------------------------ événements et connaissance
export function addEvent(w: World, e: Omit<WorldEvent, 'id' | 't' | 'open'> & { open?: boolean }): WorldEvent {
  const ev: WorldEvent = { id: w.nextEvent++, t: w.clock, open: true, ...e }; w.events.push(ev);
  if (w.events.length > MAX_EVENTS) { let worst = 0, ws = 1e9; w.events.forEach((x, i) => { const s = x.sig * 100 + x.t * 0.0001 + (x.open ? 50 : 0); if (s < ws) { ws = s; worst = i; } }); w.events.splice(worst, 1); }
  return ev;
}
export const eventById = (w: World, id: number) => w.events.find((e) => e.id === id);
const sourceFr = (s: Source) => (s === 'lived' ? 'vécu' : s === 'told' ? 'raconté' : 'soupçonné');
export { sourceFr };

/** Texte d'un souvenir, selon la provenance (jamais l'identité d'un coupable que le personnage ne connaît pas). */
export function describe(w: World, ev: WorldEvent, c: SimChar, k: Know): string {
  const a = w.chars[ev.actor], t = w.chars[ev.target]; const who = k.culprit >= 0 ? nm(w.chars[k.culprit]) : "quelqu'un";
  const from = k.from >= 0 && w.chars[k.from] ? w.chars[k.from].first : '';
  switch (ev.kind) {
    case 'theft': {
      const victim = t === c ? 'On m\'a volé' : `${nm(t)} s'est fait voler`;
      if (k.src === 'lived') return t === c ? `On m'a volé ${ev.amount} €${k.culprit >= 0 ? ` — c'était ${who}.` : ', je ne sais pas qui.'}` : `J'ai vu ${who} voler ${nm(t)}.`;
      if (k.src === 'told') return `${from} m'a raconté que ${who} a volé ${nm(t)}.`;
      return `${victim}${k.culprit >= 0 ? `. Je soupçonne ${who}, sans preuve.` : '.'}`;
    }
    case 'dispute': return k.src === 'lived' ? (a === c || t === c ? `Dispute avec ${nm(a === c ? t : a)}.` : `J'ai vu ${nm(a)} et ${nm(t)} se disputer.`) : `${from} m'a dit que ${nm(a)} et ${nm(t)} se sont disputés.`;
    case 'help': return k.src === 'lived' ? (t === c ? `${nm(a)} m'a aidé quand j'en avais besoin.` : a === c ? `J'ai aidé ${nm(t)}.` : `J'ai vu ${nm(a)} aider ${nm(t)}.`) : `${from} m'a dit que ${nm(a)} a aidé ${nm(t)}.`;
    case 'job': return k.src === 'lived' && a === c ? `J'ai trouvé du travail à ${NEW_JOB.place}.` : `${from ? from + ' m\'a dit que ' : ''}${nm(a)} a trouvé du travail.`;
    case 'reconcile': return `${nm(a)} et ${nm(t)} se sont réconciliés.`;
  }
  return '…';
}
/** Résumé d'un événement tel que le raconte quelqu'un qui en connaît l'auteur (ou non) — pour le journal du dieu. */
function gist(w: World, ev: WorldEvent, k: Know, listener: number): string {
  const a = w.chars[ev.actor], t = w.chars[ev.target];
  switch (ev.kind) {
    case 'theft': return k.culprit >= 0 ? `que ${nm(w.chars[k.culprit])} ${t.id === listener ? "l'a volé" : 'a volé ' + nm(t)}${k.src === 'suspected' ? ' (un soupçon)' : ''}` : `que ${t.id === listener ? 'on lui a volé de l\'argent' : nm(t) + " s'est fait voler"}`;
    case 'dispute': return `la dispute entre ${nm(a)} et ${nm(t)}`;
    case 'help': return `que ${nm(a)} a aidé ${nm(t)}`;
    case 'job': return `que ${nm(a)} a trouvé du travail`;
    default: return `que ${nm(a)} et ${nm(t)} se sont réconciliés`;
  }
}
const kindWeight = (ev: WorldEvent, k: Know) => Math.min(1, ev.sig * (0.5 + 0.5 * k.conf));

/** Un habitant apprend (ou renforce ce qu'il sait de) un événement. Renvoie true si c'est nouveau ou plus fiable. */
export function learn(w: World, c: SimChar, ev: WorldEvent, src: Source, conf: number, from: number, culprit: number): boolean {
  if (c.kind !== 'resident') return false;
  const cur = c.known[ev.id];
  const adds = !!cur && cur.culprit < 0 && culprit >= 0;                       // apprend QUI (alors qu'il savait seulement QUE)
  if (cur && !adds && cur.conf >= conf - 0.001 && !(cur.src === 'suspected' && src === 'lived')) return false;
  const k: Know = { src: adds && src === 'lived' ? 'lived' : adds ? 'told' : src, conf: adds ? Math.min(conf, 1) : conf, from, culprit, t: w.clock }; c.known[ev.id] = k;
  const ids = Object.keys(c.known).map(Number);
  if (ids.length > MAX_KNOWN) { let worst = -1, ws = 1e9; for (const id of ids) { const e2 = eventById(w, id); const s = e2 ? kindWeight(e2, c.known[id]) : -1; if (s < ws && id !== ev.id) { ws = s; worst = id; } } if (worst >= 0) delete c.known[worst]; }
  const neg = ev.kind === 'theft' || ev.kind === 'dispute';
  c.addMemory(w.clock, ev.kind, describe(w, ev, c, k), neg ? -0.6 * conf : 0.4, Math.min(1, 0.25 + ev.sig * 0.75) * (src === 'lived' ? 1 : 0.7), culprit, { src, ev: ev.id, conf, from, subj: culprit });
  return true;
}
export function harm(w: World, from: number, to: number, scale: number, d: Partial<Pick<Rel, 'aff' | 'trust' | 'fear' | 'resp' | 'ten'>>) {
  const r = w.getRel(from, to);
  if (d.aff) r.aff = clamp(r.aff + d.aff * scale, -100, 100);
  if (d.trust) r.trust = clamp(r.trust + d.trust * scale); if (d.fear) r.fear = clamp(r.fear + d.fear * scale);
  if (d.resp) r.resp = clamp(r.resp + d.resp * scale); if (d.ten) r.ten = clamp(r.ten + d.ten * scale);
}
/** Hostilité 0..100 d'un habitant envers un autre : affection négative et tension. */
export const hostility = (r: Rel) => clamp(Math.max(0, -r.aff) * 0.7 + r.ten * 0.5);

/** Habitants qui voient la position p : éveillés, présents, à portée de vue et sans mur entre eux. */
function onlookers(w: World, p: V2, except: number[], radius = 6.5): SimChar[] {
  return w.residents.filter((o) => !except.includes(o.id) && awake(o) && dist(o.pos, p) <= radius && lineClear(o.pos, p) && w.rng.randf() < 0.9);
}

// ------------------------------------------------------------------ réactions
function setIntent(w: World, c: SimChar, kind: 'help' | 'confront' | 'tell' | 'apologize' | 'steal', target: number, ev: number, hours = 6) {
  if (c.kind !== 'resident' || c.intent && c.intent.kind !== kind && kind !== 'confront') return;
  c.intent = { kind, target, ev, until: w.clock + hours * 60 };
}
/** Ce que fait un habitant en apprenant un événement, selon sa personnalité, ses relations et la fiabilité de l'information. */
function react(w: World, c: SimChar, ev: WorldEvent, k: Know) {
  if (ev.kind !== 'theft' || c.kind !== 'resident') return;
  const victim = w.chars[ev.target]; const thief = k.culprit >= 0 ? w.chars[k.culprit] : null; const conf = k.conf;
  const trustMe = k.from >= 0 ? w.getRel(c.id, k.from).trust / 100 : 1;
  if (c === victim) {
    c.anger = clamp(c.anger + 28 * conf); c.stress = clamp(c.stress + 20 * conf); w.setEmotionFor(c, 'angry', 40);
    if (thief && thief !== c) {
      harm(w, c.id, thief.id, conf, { aff: -22, trust: -45, resp: -25, ten: 25, fear: thief.trait('agreeableness') < 0.35 ? 8 : 0 });
      const r = w.getRel(c.id, thief.id); r.cd = w.clock; c.avoid[thief.id] = w.clock + 1440 * 3;
      const bold = c.trait('neuroticism') < 0.65 && r.fear < 40;
      if (bold && conf >= 0.35) setIntent(w, c, 'confront', thief.id, ev.id, 8); else c.stress = clamp(c.stress + 8);
    }
    return;
  }
  if (thief && thief !== c) {
    const prior = w.getRel(c.id, thief.id).aff;
    harm(w, c.id, thief.id, conf * (0.5 + 0.5 * trustMe), { aff: -12, trust: -30, resp: -15, ten: 8, fear: c.trait('neuroticism') > 0.6 ? 5 : 0 });
    if (conf >= 0.5) c.avoid[thief.id] = Math.max(c.avoid[thief.id] ?? 0, w.clock + 1440);
    if (c.trait('neuroticism') > 0.6) c.stress = clamp(c.stress + 10 * conf);
    const loyal = prior > 40 && w.rng.randf() < 0.7;                       // protège un ami
    if (loyal) { c.addMemory(w.clock, 'secret', `J'ai su pour ${nm(thief)}, mais je ne dirai rien.`, -0.2, 0.5, thief.id, { src: k.src, ev: ev.id, conf }); return; }
    if (victim !== thief && !victim.known[ev.id] && c.trait('agreeableness') >= 0.4 && w.rng.randf() < 0.45 + 0.5 * c.trait('agreeableness')) setIntent(w, c, 'tell', victim.id, ev.id, 24);
    else if (k.src === 'lived' && c.trait('orderliness') >= 0.5 && c.trait('neuroticism') < 0.6 && w.rng.randf() < 0.5) setIntent(w, c, 'confront', thief.id, ev.id, 6);
  }
}

// ------------------------------------------------------------------ vol
function searchPlan(w: World, thief: SimChar, victim: SimChar) {
  const fi = w.furnById.get(victim.bed_id); if (fi === undefined) return false;
  const f = w.furn[fi]; const st = f.slots[0].stands.map((s) => ({ x: f.x + s[0], y: f.y + s[1] })).find((c) => w.isWalkable(c)); if (!st) return false;
  thief.plan = [{ type: 'goto', cell: st }, { type: 'wait', act: 'search', dur: w.rng.range(4, 6) }]; w.startNextStep(thief); return true;
}
/** Conclut un vol : transfert d'argent, événement du monde, témoins qui réagissent, victime qui découvrira plus tard. */
export function completeTheft(w: World, thief: SimChar, victim: SimChar, caughtByVictim = false): WorldEvent | null {
  const amount = Math.min(Math.floor(victim.money), Math.round(w.rng.range(18, 40))); if (amount <= 0) return null;
  victim.money -= amount; thief.money += amount; w.lastTheft = w.clock; thief.statAdd('thefts'); victim.statAdd('robbed');
  const ev = addEvent(w, { kind: 'theft', actor: thief.id, target: victim.id, x: thief.pos.x, y: thief.pos.y, amount, sig: 0.9 });
  thief.addMemory(w.clock, 'theft', `J'ai pris ${amount} € à ${nm(victim)}.`, -0.3, 0.8, victim.id, { src: 'lived', ev: ev.id, conf: 1, subj: thief.id });
  thief.stress = clamp(thief.stress + 12);
  const seen = onlookers(w, thief.pos, [thief.id]); const wit = new Set(seen.map((o) => o.id));
  if (caughtByVictim && awake(victim)) wit.add(victim.id);
  w.emitLog(`${nm(thief)} s'empare de ${amount} € appartenant à ${nm(victim)}${wit.size ? ' — sous les yeux de ' + [...wit].map((i) => w.chars[i].first).join(', ') : ' — personne ne semble avoir vu'}.`, 'drama', thief.id);
  for (const id of wit) { const o = w.chars[id]; if (learn(w, o, ev, 'lived', 1, -1, thief.id)) react(w, o, ev, o.known[ev.id]); }
  return ev;
}
/** Vol par le joueur (dialogue). Renvoie le résultat pour l'interface. */
export function playerSteal(w: World, av: SimChar, npc: SimChar): { ok: boolean; line: string } {
  if (npc.money < 5) return { ok: false, line: `${nm(npc)} n'a presque rien sur lui.` };
  const asleep = npc.isAsleep(); const p = asleep ? 0.9 : 0.45 - npc.trait('neuroticism') * 0.1 + (npc.trait('orderliness') < 0.4 ? 0.1 : 0);
  const caught = w.rng.randf() >= p;
  const ev = completeTheft(w, av, npc, caught);
  if (!ev) return { ok: false, line: 'Rien à prendre.' };
  if (caught) { npc.anger = clamp(npc.anger + 30); w.showEmote(npc, 'anger', 3); return { ok: true, line: `${npc.first} vous attrape la main : « Qu'est-ce que vous faites ?! » Vous avez pris ${ev.amount} € mais ${npc.first} vous a vu.` }; }
  return { ok: true, line: `Vous glissez ${ev.amount} € dans votre poche, sans bruit.` };
}
/** Appelé à la fin de l'activité « fouille » : le voleur agit s'il n'a pas été interrompu. */
export function onSearchEnd(w: World, c: SimChar, completed: boolean) {
  const it = c.intent; if (!it || it.kind !== 'steal') return; c.intent = null; const victim = w.chars[it.target];
  if (completed && victim && victim.money >= 10) completeTheft(w, c, victim);
}
function discoverTheft(w: World, c: SimChar) {
  for (const ev of w.events) {
    if (ev.kind !== 'theft' || ev.target !== c.id || !ev.open || c.known[ev.id] || w.clock - ev.t < 20) continue;
    // la victime constate la disparition : elle ignore l'auteur ; elle peut le soupçonner d'après ses rancunes, sans preuve
    let suspect = -1, ss = 18;
    for (const o of w.residents) { if (o.id === c.id) continue; const r = w.getRel(c.id, o.id); const s = -r.aff * 0.5 + r.ten * 0.45 + (o.money < 10 ? 8 : 0) - r.trust * 0.1; if (s > ss) { ss = s; suspect = o.id; } }
    const conf = suspect >= 0 ? Math.min(0.55, 0.2 + (ss - 18) / 100) : 0;
    learn(w, c, ev, suspect >= 0 ? 'suspected' : 'lived', suspect >= 0 ? conf : 1, -1, suspect);
    const k = c.known[ev.id]; if (k && k.culprit < 0) { c.anger = clamp(c.anger + 18); c.stress = clamp(c.stress + 15); }
    if (k) react(w, c, ev, k);
    w.emitLog(`${nm(c)} constate qu'on lui a pris ${ev.amount} €${suspect >= 0 ? ` et soupçonne ${nm(w.chars[suspect])}` : ''}.`, 'drama', c.id);
  }
}
function maybeSteal(w: World, c: SimChar) {
  if (c.intent || c.shift || c.money >= 8 || moral(c) >= 0.5 || w.clock - w.lastTheft < 1440 || c.needs.energy < 30) return;
  let best: SimChar | null = null, bs = 0;
  for (const o of w.residents) {
    if (o.id === c.id || o.money < 25) continue; const r = w.getRel(c.id, o.id);
    const watchers = w.residents.filter((x) => x.id !== c.id && x.id !== o.id && awake(x) && L.buildingAt(x.cell().x, x.cell().y)?.name === 'house').length;
    const s = o.money * 0.4 - r.aff * 0.3 - Math.max(0, r.trust - 40) * 0.3 - watchers * 2 + (o.isAsleep() || o.away ? 12 : -30);
    if (s > bs) { bs = s; best = o; }
  }
  if (!best) return;
  const exposed = w.residents.filter((o) => o.id !== c.id && Object.values(o.known).some((k) => k.culprit === c.id && k.conf >= 0.6)).length; // un voleur démasqué y réfléchit à deux fois
  if (w.rng.randf() < (exposed ? 0.3 : 1) * 0.35 * (1 - c.money / 8) * (1 - moral(c) * 1.4)) c.intent = { kind: 'steal', target: best.id, ev: -1, until: w.clock + 180 }; // le plan est construit au prochain choix d'activité (le personnage doit être libre)
}

// ------------------------------------------------------------------ rumeurs
/** a raconte à b un événement qu'il connaît et que b ignore (ou connaît moins bien). */
export function share(w: World, a: SimChar, b: SimChar, forced = -1): boolean {
  if (a.kind !== 'resident' || b.kind !== 'resident') return false;
  let pick = forced, bs = -1;
  if (pick < 0) {
    for (const key of Object.keys(a.known)) {
      const id = Number(key); const ev = eventById(w, id); if (!ev) continue; const k = a.known[id]; const kb = b.known[id];
      if (kb && kb.conf >= k.conf * 0.8 && !(kb.culprit < 0 && k.culprit >= 0)) continue;
      if (k.culprit === a.id) continue;                                        // on ne raconte pas ses propres méfaits
      if (k.culprit === b.id && k.src !== 'lived') continue;                   // et on n'accuse pas quelqu'un en face sur une rumeur
      const s = ev.sig * k.conf * (1 + Math.max(0, 1 - (w.clock - k.t) / 2880)); if (s > bs) { bs = s; pick = id; }
    }
    if (pick < 0) return false;
  }
  const ev = eventById(w, pick); const k = a.known[pick]; if (!ev || !k) return false;
  const rab = w.getRel(a.id, b.id), rba = w.getRel(b.id, a.id);
  const p = forced >= 0 ? 1 : clamp(0.12 + 0.42 * a.trait('extraversion') + 0.25 * rab.trust / 100 + 0.2 * ev.sig + (a.anger > 35 ? 0.15 : 0), 0.05, 0.92);
  if (w.rng.randf() >= p) return false;
  const conf = k.conf * (0.55 + 0.4 * rba.trust / 100);                        // la confiance en celui qui raconte pèse sur la crédibilité
  const src: Source = conf < 0.45 || k.src === 'suspected' ? 'suspected' : 'told';
  const isNew = learn(w, b, ev, src, conf, a.id, k.culprit);
  if (!isNew) return false;
  a.statAdd('told'); w.stats.rumors = (w.stats.rumors ?? 0) + 1;
  w.emitLog(`${nm(a)} raconte à ${nm(b)} ${gist(w, ev, k, b.id)}.`, 'social', a.id);
  w.showEmote(a, 'talk', 2);
  react(w, b, ev, b.known[pick]);
  return true;
}

// ------------------------------------------------------------------ conflits, aide, réconciliation
/** Dispute entre deux habitants : l'effet sur les relations est durable (rancune), les témoins en gardent le souvenir. */
export function quarrel(w: World, a: SimChar, b: SimChar, strength = 1, cause = '', fromChat = false) {
  for (const [x, y] of [[a, b], [b, a]] as [SimChar, SimChar][]) {
    // En conversation, Social.apply a déjà fait varier affection et tension : on ajoute seulement confiance, respect, peur (sinon double comptage)
    harm(w, x.id, y.id, strength, fromChat ? { trust: -10, resp: -5, fear: y.anger > 40 ? 6 : 1 } : { aff: -9, trust: -10, resp: -5, ten: 22, fear: y.anger > 40 ? 6 : 1 }); const r = w.getRel(x.id, y.id); r.cd = w.clock;
    x.anger = clamp(x.anger + (fromChat ? 4 : 26) * strength); x.stress = clamp(x.stress + (fromChat ? 2 : 12) * strength); x.avoid[y.id] = w.clock + 360 * (1 + strength); w.setEmotionFor(x, 'angry', 30);
  }
  w.showEmote(a, 'anger', 3); w.showEmote(b, 'anger', 3);
  const ev = addEvent(w, { kind: 'dispute', actor: a.id, target: b.id, x: a.pos.x, y: a.pos.y, amount: 0, sig: 0.45 + 0.2 * strength });
  const ids = new Set([a.id, b.id, ...onlookers(w, a.pos, [a.id, b.id]).map((o) => o.id)]);
  for (const id of ids) { const o = w.chars[id]; if (o.kind === 'resident') learn(w, o, ev, 'lived', 1, -1, -1); }
  if (cause) w.emitLog(cause, 'drama', a.id);
  for (const id of ids) if (id !== a.id && id !== b.id) { const o = w.chars[id]; const ra = w.getRel(o.id, a.id).aff, rb = w.getRel(o.id, b.id).aff; harm(w, o.id, ra < rb ? a.id : b.id, 0.5, { resp: -5, aff: -2 }); }
  return ev;
}
/** Confrontation après un vol : aveu et restitution, déni et dispute, ou accusation injuste. */
function confront(w: World, a: SimChar, b: SimChar, evId: number) {
  const ev = eventById(w, evId); const k = a.known[evId]; if (!ev || !k) return;
  const guilty = ev.kind === 'theft' && ev.actor === b.id; const rb = w.getRel(b.id, a.id);
  w.emitLog(`${nm(a)} confronte ${nm(b)} au sujet du vol.`, 'drama', a.id);
  if (guilty) {
    const conscience = 0.4 * b.trait('agreeableness') + 0.3 * b.faith / 100 + 0.3 * clamp(rb.aff + 50, 0, 100) / 100 + (k.src === 'lived' ? 0.1 : 0);
    if (conscience > 0.5 && b.money >= 1) {
      const back = Math.min(ev.amount, Math.floor(b.money)); b.money -= back; w.chars[ev.target].money += back; ev.open = false;
      harm(w, a.id, b.id, 1, { trust: 8, resp: 5, ten: -10 }); b.stress = clamp(b.stress + 10);
      b.addMemory(w.clock, 'theft', `J'ai avoué et rendu ${back} € à ${nm(w.chars[ev.target])}.`, -0.3, 0.7, a.id, { src: 'lived', ev: ev.id, conf: 1 });
      w.emitLog(`${nm(b)} avoue et rend ${back} € à ${nm(w.chars[ev.target])}.`, 'social', b.id); a.known[evId] = { ...k, t: w.clock };
      return;
    }
    quarrel(w, a, b, 1.3, `${nm(b)} nie en bloc ; la dispute éclate avec ${nm(a)}.`);
    harm(w, b.id, a.id, 1, { trust: -8, aff: -6 });
  } else {
    // accusation injuste : l'accusé est blessé, l'accusateur doute
    harm(w, b.id, a.id, 1, { aff: -14, trust: -25, resp: -12, ten: 25 }); b.anger = clamp(b.anger + 30); w.setEmotionFor(b, 'angry', 40); w.getRel(b.id, a.id).cd = w.clock;
    b.addMemory(w.clock, 'fight', `${nm(a)} m'a accusé à tort d'avoir volé.`, -0.8, 0.85, a.id, { src: 'lived', conf: 1 });
    k.conf *= 0.5; w.emitLog(`${nm(b)} se défend avec colère : ce n'est pas lui. ${nm(a)} commence à douter.`, 'drama', b.id);
    addEvent(w, { kind: 'dispute', actor: a.id, target: b.id, x: a.pos.x, y: a.pos.y, amount: 0, sig: 0.5 });
  }
}
function help(w: World, a: SimChar, b: SimChar) {
  let what = '';
  if (b.money < 6 && a.money >= 20) { const n = Math.min(15, Math.floor(a.money / 3)); a.money -= n; b.money += n; what = `prête ${n} € à ${nm(b)}`; }
  else if (b.needs.hunger < 24) { b.needs.hunger = Math.min(100, b.needs.hunger + 35); what = `prépare de quoi manger pour ${nm(b)}`; }
  else { b.stress = clamp(b.stress - 22); b.joy += 8; what = `réconforte ${nm(b)}`; }
  harm(w, b.id, a.id, 1, { trust: 8, aff: 8, resp: 6, fear: -2 }); harm(w, a.id, b.id, 1, { aff: 3, trust: 2 });
  w.showEmote(a, 'heart', 3); a.statAdd('helped'); a.stats['help_' + b.id] = w.clock;
  const ev = addEvent(w, { kind: 'help', actor: a.id, target: b.id, x: a.pos.x, y: a.pos.y, amount: 0, sig: 0.35 });
  for (const id of new Set([a.id, b.id, ...onlookers(w, a.pos, [a.id, b.id]).map((o) => o.id)])) learn(w, w.chars[id], ev, 'lived', 1, -1, a.id);
  w.emitLog(`${nm(a)} ${what}.`, 'social', a.id);
}
function apologize(w: World, a: SimChar, b: SimChar) {
  const rb = w.getRel(b.id, a.id); const ra = w.getRel(a.id, b.id);
  if (b.anger > 35 || rb.aff < -55) { rb.ten = clamp(rb.ten + 4); a.stress = clamp(a.stress + 6); w.emitLog(`${nm(b)} repousse les excuses de ${nm(a)}.`, 'drama', a.id); ra.cd = w.clock - 120; return; }
  for (const r of [ra, rb]) { r.ten = clamp(r.ten - 28); r.aff = clamp(r.aff + 12, -100, 100); r.trust = clamp(r.trust + 8); r.cd = 0; }
  a.joy += 6; b.joy += 6; w.showEmote(a, 'smile', 3); w.showEmote(b, 'smile', 3);
  const ev = addEvent(w, { kind: 'reconcile', actor: a.id, target: b.id, x: a.pos.x, y: a.pos.y, amount: 0, sig: 0.3 }); learn(w, a, ev, 'lived', 1, -1, -1); learn(w, b, ev, 'lived', 1, -1, -1);
  w.emitLog(`${nm(a)} s'excuse auprès de ${nm(b)} : ils se réconcilient.`, 'social', a.id);
}
/** Arrivée d'un habitant près de sa cible. Renvoie true si la rencontre est entièrement gérée ici (pas de conversation ordinaire). */
export function onArrive(w: World, c: SimChar, t: SimChar): boolean {
  const it = c.intent; if (!it || it.target !== t.id || c.kind !== 'resident') return false; c.intent = null;
  switch (it.kind) {
    case 'tell': share(w, c, t, it.ev); return false;
    case 'help': if (w.clock < it.until) help(w, c, t); return false;
    case 'apologize': apologize(w, c, t); return false;
    case 'confront': confront(w, c, t, it.ev); return true;
  }
  return false;
}
/** Après une conversation ordinaire : les deux habitants s'échangent des nouvelles ; une dispute devient un événement du monde. */
export function afterChat(w: World, a: SimChar, b: SimChar, kind: string) {
  if (kind === 'argument') { quarrel(w, a, b, 1, '', true); return; }
  share(w, a, b); share(w, b, a);
}
/** Rancune : une conversation récemment après une dispute se passe mal (effet décroissant sur 6 h de jeu). */
export function grudge(w: World, x: SimChar, y: SimChar): number {
  const r = w.getRel(x.id, y.id); if (!r.cd) return 0; const el = w.clock - r.cd; return el < 360 ? 0.14 * (1 - el / 360) : 0;
}

// ------------------------------------------------------------------ boucle de vie (basse fréquence)
const isFar = (w: World, c: SimChar) => !!w.focus && dist(c.pos, w.focus) > NEAR;
/** Appelée à chaque pas de simulation ; travaille toutes les ~4 minutes de jeu (12 pour les habitants éloignés du joueur). */
export function tick(w: World, dmin: number) {
  w.lifeAcc += dmin; if (w.lifeAcc < 4) return; const step = w.lifeAcc; w.lifeAcc = 0;
  economy(w);
  for (const c of w.residents) {
    c.lifeT += step; const far = isFar(w, c); if (c.lifeT < (far ? 12 : 4)) continue; const dt = c.lifeT; c.lifeT = 0;
    w.stats[far ? 'life_far' : 'life_near'] = (w.stats[far ? 'life_far' : 'life_near'] ?? 0) + 1;
    if (c.intent && w.clock > c.intent.until) c.intent = null;
    if (c.away) continue;
    discoverTheft(w, c);
    if (c.isAsleep() || c.state === 'chat') continue;
    maybeHelp(w, c); maybeApologize(w, c); maybeSteal(w, c); interrupt(w, c); void dt;
  }
}
/** Vie quotidienne : loyer et courses chaque soir ; revenus hors emploi (pension de Margaux, ventes ponctuelles de Camille). Maintient l'argent significatif. */
export const DAILY_COST = 45;
function economy(w: World) {
  if (w.hour() < 21) return; const day = w.day();
  for (const c of w.residents) {
    if ((c.stats.cost_day ?? -1) === day) continue; c.stats.cost_day = day;
    if (c.id === 6) c.money += 35;                                   // pension
    if (c.id === 0 && w.rng.randf() < 0.3) { c.money += 60; c.joy += 10; w.emitLog('Camille vend une illustration (+60 €).', 'info', c.id); }
    c.money = Math.max(0, c.money - DAILY_COST);
  }
}
/** Une intention importante interrompt l'activité en cours (si elle est interruptible) dès que la cible est disponible : on n'attend pas la fin d'un repas de deux heures pour prévenir un ami. */
/** L'heure du travail est venue : on quitte une activité interruptible (télé, lecture…) pour partir à l'heure — routine régulière et visible. */
function workDue(w: World, c: SimChar): boolean {
  const s = c.shift; if (!s || c.jobPhase !== '' || c.away || c.isAsleep()) return false; const h = w.hour();
  return (c.stats.worked_day ?? -1) !== w.day() && h >= s.from - 0.4 && h < s.to - 3 && c.needs.energy >= 25 && inBuilding(c, 'house');
}
function interrupt(w: World, c: SimChar) {
  if (workDue(w, c)) {
    if (c.state === 'use' && ACT[c.use_act]?.interrupt && c.use_act !== 'sleep') { w.endUse(c, false); c.decision_cooldown = 0; }
    else if (c.state === 'walk' && c.step?.type !== 'approach' && !c.plan.some((x) => x.type === 'depart')) { w.abortPlan(c, 'work'); c.decision_cooldown = 0; }
    else if (c.state === 'idle') c.decision_cooldown = 0;
    return;
  }
  const it = c.intent; if (!it || it.kind === 'steal') return; const t = w.chars[it.target];
  if (!t || t.away || t.isAsleep() || c.needs.hunger < 10 || c.needs.bladder < 10) return;
  if (L.buildingAt(t.cell().x, t.cell().y)?.name !== L.buildingAt(c.cell().x, c.cell().y)?.name) return;
  if (c.state === 'use' && ACT[c.use_act]?.interrupt && c.use_act !== 'sleep') { w.endUse(c, false); c.decision_cooldown = 0; }
  else if (c.state === 'walk' && c.step?.type !== 'approach') { w.abortPlan(c, 'intent'); c.decision_cooldown = 0; }
  else if (c.state === 'idle') c.decision_cooldown = 0;
}
function maybeHelp(w: World, c: SimChar) {
  if (c.intent || c.money < 25 || c.trait('agreeableness') < 0.5 || c.needs.hunger < 30) return;
  for (const o of w.residents) {
    if (o.id === c.id || !awake(o) || (w.clock - (c.stats['help_' + o.id] ?? -9999)) < 360) continue;
    if (L.buildingAt(o.cell().x, o.cell().y)?.name !== L.buildingAt(c.cell().x, c.cell().y)?.name) continue;
    const r = w.getRel(c.id, o.id); if (r.aff < 35) continue;
    if ((o.money < 6 || o.needs.hunger < 22 || o.stress > 74) && w.rng.randf() < 0.5) { c.intent = { kind: 'help', target: o.id, ev: -1, until: w.clock + 120 }; return; }
  }
}
function maybeApologize(w: World, c: SimChar) {
  if (c.intent || c.trait('agreeableness') < 0.5 || c.anger > 12) return;
  for (const o of w.residents) {
    if (o.id === c.id || !awake(o)) continue; const r = w.getRel(c.id, o.id);
    if (r.cd > 0 && w.clock - r.cd > 300 && r.aff > -60 && w.rng.randf() < 0.3) { c.intent = { kind: 'apologize', target: o.id, ev: -1, until: w.clock + 180 }; return; }
  }
}

// ------------------------------------------------------------------ emploi, sorties : appelé par le cerveau avant le choix d'activité ordinaire
export function homeCell(w: World): V2 { const c = w.nearestFreeCell(HOME_IN, 4); return c.x >= 0 ? c : HOME_IN; }
export function decide(w: World, c: SimChar): boolean {
  if (c.kind !== 'resident' || c.away) return false;
  const h = w.hour(); const day = w.day();
  // intention prioritaire
  const it = c.intent;
  if (it) {
    if (w.clock > it.until) c.intent = null;
    else if (it.kind === 'steal') { const v = w.chars[it.target]; if (!v || !searchPlan(w, c, v)) c.intent = null; else { c.lifeAct = 'Fouiller une chambre'; c.lifeWhy = `à court d'argent (${Math.round(c.money)} €), peu scrupuleux, ${v.first} est riche et absent ou endormi`; return true; } }
    else {
      const t = w.chars[it.target];
      if (t && !t.away && !t.isAsleep() && c.needs.hunger > 8 && c.needs.bladder > 8) { c.plan = [{ type: 'approach', target: t.id }]; w.startNextStep(c); if (c.state === 'walk') { c.lifeAct = { help: 'Aller aider', confront: 'Aller confronter', tell: 'Aller raconter', apologize: "Aller s'excuser", steal: 'Voler' }[it.kind]; c.lifeWhy = `intention en cours envers ${t.first}`; return true; } }
      if (t && t.isAsleep() && w.clock - it.until < 0) { /* attend qu'il se réveille */ }
    }
  }
  const urgent = c.needs.bladder < 10 || c.needs.hunger < 8 || c.needs.energy < 6; if (urgent) return false;
  // sortie au bar en cours
  if (c.outing === 'bar') {
    const inB = inBuilding(c, 'bar');
    if (w.clock > c.outUntil || !w.barOpen() || c.needs.energy < 22 || c.money < 4 || c.needs.bladder < 14) { c.outing = ''; goHome(w, c); c.lifeAct = 'Rentrer'; c.lifeWhy = 'la soirée au bar est finie (heure, fatigue ou argent)'; return true; }
    if (!inB) { c.lifeAct = 'Aller au bar'; c.lifeWhy = 'sortie du soir en cours'; return planDrink(w, c) || (goHome(w, c), c.outing = '', true); }
    if (c.money >= 4 && w.rng.randf() < 0.55) { c.lifeAct = 'Reprendre un verre'; c.lifeWhy = `au bar, ${Math.round(c.money)} € en poche`; return planDrink(w, c); }
    return false;
  }
  // travail
  const s = c.shift;
  if (s && !c.isAsleep() && c.jobPhase === '' && (c.stats.worked_day ?? -1) !== day && h >= s.from - 0.4 && h < s.to - 3 && c.needs.energy >= 25 && inBuilding(c, 'house')) {
    c.stats.worked_day = day; c.jobPhase = 'working'; c.jobStart = w.clock; c.jobUntil = w.clock - w.tod() + s.to * 60;
    w.emitLog(`${c.first} part travailler (${s.place}).`, 'info', c.id); c.lifeAct = 'Partir travailler'; c.lifeWhy = `service à ${Math.floor(s.from)} h, ${s.place}`; depart(w, c); return true;
  }
  // recherche d'emploi
  if (!s && c.money < 12 && c.jobPhase === '' && (c.stats.search_day ?? -1) !== day && h >= 9.5 && h < 15 && c.needs.energy >= 35 && inBuilding(c, 'house') && c.needs.hunger > 25) {
    c.stats.search_day = day; c.jobPhase = 'searching'; c.jobStart = w.clock; c.jobUntil = w.clock + w.rng.range(150, 220);
    w.emitLog(`${c.first} n'a presque plus d'argent et part chercher du travail.`, 'info', c.id); c.lifeAct = 'Chercher du travail'; c.lifeWhy = `plus que ${Math.round(c.money)} € et pas d'emploi`; depart(w, c); return true;
  }
  // sortie du soir
  if (c.jobPhase === '' && h >= 18.2 && h < 22.5 && w.barOpen() && w.barman && !w.barman.away && (c.stats.bar_day ?? -1) !== day && c.money >= 8 && c.needs.energy > 40 && c.needs.hunger > 25 && inBuilding(c, 'house') && !c.isAsleep()) {
    const friends = w.chars.filter((o) => o.id !== c.id && !o.away && inBuilding(o, 'bar') && w.getRel(c.id, o.id).aff > 15).length;
    const u = (100 - c.needs.social) * 0.45 * (0.35 + c.trait('extraversion')) + (100 - c.needs.fun) * 0.35 + friends * 6 + (c.chrono > 0 ? 5 : 0) + w.rng.randf() * 10;
    if (u > 40) { c.stats.bar_day = day; c.outing = 'bar'; c.outUntil = w.clock + w.rng.range(70, 160); w.emitLog(`${c.first} sort prendre un verre au bar.`, 'info', c.id); if (planDrink(w, c)) { c.lifeAct = 'Sortir au bar'; c.lifeWhy = `soirée : besoin social ${Math.round(c.needs.social)} %, loisirs ${Math.round(c.needs.fun)} %, ${Math.round(c.money)} €`; return true; } c.outing = ''; }
    else c.stats.bar_day = day;
  }
  return false;
}
function depart(w: World, c: SimChar) {
  const st = w.nearestFreeCell(STREET_IN, 3); c.plan = [{ type: 'goto', cell: st.x >= 0 ? st : STREET_IN }, { type: 'depart' }]; w.startNextStep(c);
}
function goHome(w: World, c: SimChar) { c.plan = [{ type: 'goto', cell: homeCell(w) }]; w.startNextStep(c); }
function planDrink(w: World, c: SimChar): boolean {
  const slots = w.freeSlots('drink').filter((s) => w.furn[s.f].def === 'stool' && L.buildingAt(s.stand.x, s.stand.y)?.name === 'bar');
  let best: (typeof slots)[0] | null = null, bd = 1e9; for (const s of slots) { const d = dist(c.pos, { x: s.stand.x + 0.5, y: s.stand.y + 0.5 }) + w.rng.randf() * 3; if (d < bd) { bd = d; best = s; } }
  if (!best) return false;
  c.plan = [{ type: 'goto', cell: best.stand }, { type: 'use', furn: best.f, slot: best.s, act: 'drink', stand: best.stand, dur: w.rng.range(22, 45) }]; w.startNextStep(c); return c.state !== 'idle';
}
/** Un habitant paie sa consommation au barman. */
export function onDrink(w: World, c: SimChar) {
  if (c.kind !== 'resident' || !inBuilding(c, 'bar')) return; if (c.money >= 4) { c.money -= 4; if (w.barman) w.barman.money += 4; }
  c.drunk = Math.min(100, c.drunk + 8); c.statAdd('bar_drinks'); w.stats.resident_drinks = (w.stats.resident_drinks ?? 0) + 1;
}
/** Habitant hors de la carte : rentre à l'heure prévue, avec la paie ou le résultat de sa recherche d'emploi. */
export function updateAway(w: World, c: SimChar) {
  if (w.clock < c.jobUntil) return;
  c.away = false; const st = w.nearestFreeCell(STREET_IN, 3); c.pos = { x: (st.x >= 0 ? st.x : STREET_IN.x) + 0.5, y: (st.y >= 0 ? st.y : STREET_IN.y) + 0.5 };
  c.state = 'idle'; c.plan = []; c.step = null; c.pose = 'stand'; c.decision_cooldown = 0.3;
  if (c.jobPhase === 'out') { c.addMemory(w.clock, 'work', 'Journée dehors.', 0, 0.1, -1); }
  else if (c.jobPhase === 'working' && c.shift) {
    const hours = Math.max(0, (w.clock - c.jobStart) / 60); const pay = Math.round(c.shift.pay * Math.min(1, hours / (c.shift.to - c.shift.from)));
    c.money += pay; c.statAdd('shifts'); c.needs.energy = Math.max(0, c.needs.energy - 6); c.needs.social = Math.min(100, c.needs.social + 15); c.needs.hunger = Math.min(100, c.needs.hunger + 25); // déjeune sur place
    c.addMemory(w.clock, 'work', `Journée de travail à ${c.shift.place} : +${pay} €.`, 0.1, 0.2, -1);
    w.emitLog(`${c.first} rentre du travail (+${pay} €).`, 'info', c.id);
  } else if (c.jobPhase === 'searching') {
    const p = 0.4 + 0.3 * c.trait('openness') + 0.2 * c.trait('agreeableness') - 0.2 * c.trait('neuroticism') * c.stress / 100;
    if (w.rng.randf() < p) {
      c.shift = { ...NEW_JOB }; const ev = addEvent(w, { kind: 'job', actor: c.id, target: c.id, x: c.pos.x, y: c.pos.y, amount: 0, sig: 0.5 }); learn(w, c, ev, 'lived', 1, -1, c.id);
      c.joy += 25; c.stress = clamp(c.stress - 15); w.showEmote(c, 'smile', 3); w.emitLog(`${c.first} a trouvé du travail (${NEW_JOB.place}) !`, 'social', c.id);
    } else { c.stress = clamp(c.stress + 12); c.joy = Math.max(0, c.joy - 8); c.addMemory(w.clock, 'work', "Recherche d'emploi sans résultat.", -0.4, 0.5, -1); w.emitLog(`${c.first} rentre bredouille de sa recherche d'emploi.`, 'info', c.id); }
  }
  c.jobPhase = ''; goHome(w, c);
}
