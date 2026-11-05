/** Pouvoirs divins. Port de God.gd. */
import { ACT } from './defs';
import { NEEDS } from './defs';
import type { SimChar } from './simchar';
import type { World } from './world';

export const POWERS: Record<string, { label: string; cost: number; key: string; target: 'char' | 'two' | 'none'; desc: string }> = {
  bless: { label: 'Bénédiction', cost: 20, key: '1', target: 'char', desc: 'Apaise et réconforte un habitant : besoins améliorés, joie, foi.' },
  whisper: { label: 'Murmure', cost: 10, key: '2', target: 'char', desc: 'Souffle une idée à un habitant (obéit selon sa foi).' },
  fate: { label: 'Coup du destin', cost: 25, key: '3', target: 'two', desc: 'Force la rencontre de deux habitants.' },
  feast: { label: 'Festin céleste', cost: 40, key: '4', target: 'none', desc: 'Un banquet apparaît dans la cuisine : tout le monde est invité.' },
  forget: { label: 'Effacer les souvenirs', cost: 0, key: '5', target: 'none', desc: 'Les témoins proches oublient ce qu\'ils ont vu de vous : souvenirs, appels en attente et rumeurs.' },
  teleport: { label: 'Téléportation', cost: 0, key: '6', target: 'none', desc: 'Vous disparaissez et réapparaissez dans un lieu de la ville (les témoins le voient).' },
};
export const WHISPERS: Record<string, string> = { eat: 'Va manger', sleep: 'Va dormir', shower: 'Va te laver', chat: 'Va discuter', tv: 'Détends-toi devant la télé', tidy: 'Range un peu', pray: 'Prie un instant' };
export const cost = (p: string) => POWERS[p].cost;
/** Le créateur n'est pas limité par une jauge : `freePowers` (vrai par défaut) rend tous les pouvoirs gratuits. */
export const canAfford = (w: World, p: string) => w.freePowers || w.godEnergy >= cost(p);
function pay(w: World, p: string) { if (!w.freePowers) w.godEnergy -= cost(p); w.ennui = Math.max(0, w.ennui - 8); }
/** Journal des interventions divines (sauvegardé). */
export interface DivineEntry { t: number; power: string; target: number; text: string }
function note(w: World, power: string, target: number, text: string) { w.divine.push({ t: w.clock, power, target, text }); if (w.divine.length > 80) w.divine.shift(); w.emitLog(text, 'god', target); }
export const PLACES: Record<string, { label: string; x: number; y: number }> = {
  flat: { label: 'Mon appartement', x: 66.5, y: 28.5 }, street: { label: 'Avenue', x: 70.5, y: 19.5 }, store: { label: 'Épicerie', x: 61.5, y: 14.5 }, bar: { label: 'Bar', x: 38.5, y: 15.5 },
  station: { label: 'Commissariat', x: 75.5, y: 14.5 }, park: { label: 'Parc', x: 20.5, y: 28.5 }, house: { label: 'Maison', x: 14.5, y: 13.5 },
};
/** Efface chez les témoins proches (vue directe, ≤ 9 cases) ce qu'ils savent de `subject` : souvenirs de délit, connaissances d'événements, appels en attente. Retourne le nombre de personnes touchées. */
export function forget(w: World, center: { x: number; y: number }, subject: number): number {
  let hit = 0;
  for (const c of w.chars) {
    if (c.id === subject || c.away || c.kind === 'avatar' || Math.hypot(c.pos.x - center.x, c.pos.y - center.y) > 9) continue;
    const m0 = c.memories.length; c.memories = c.memories.filter((m) => !((m.subj === subject || m.other === subject) && (m.kind === 'crime' || m.kind === 'theft' || m.src === 'lived')));
    let k = 0; for (const id of Object.keys(c.known).map(Number)) { const ev = w.events.find((e) => e.id === id); if (ev && (ev.actor === subject || c.known[id].culprit === subject)) { delete c.known[id]; k++; } }
    const r0 = w.reports.length; w.reports = w.reports.filter((r) => !(r.by === c.id && r.perp === subject));
    if (c.memories.length !== m0 || k || w.reports.length !== r0) { hit++; const rl = w.getRel(c.id, subject); rl.fear = Math.max(0, rl.fear - 30); w.showEmote(c, 'dots', 3); c.addMemory(w.clock, 'miracle', "J'ai eu un vertige… j'ai perdu le fil de ce qui venait de se passer.", -0.2, 0.5); }
  }
  return hit;
}
export function doForget(w: World, subject: SimChar): number {
  if (!canAfford(w, 'forget')) return 0; pay(w, 'forget'); const n = forget(w, subject.pos, subject.id);
  note(w, 'forget', subject.id, n ? `Vous effacez les souvenirs de ${n} témoin(s).` : 'Personne ici n\'avait de souvenir à effacer.'); return n;
}
export function teleport(w: World, c: SimChar, place: string): boolean {
  const p = PLACES[place]; if (!p || !canAfford(w, 'teleport')) return false; const cell = { x: Math.floor(p.x), y: Math.floor(p.y) }; if (!w.isWalkable(cell)) return false;
  pay(w, 'teleport');
  for (const o of w.chars) if (o.id !== c.id && !o.away && o.kind !== 'avatar' && Math.hypot(o.pos.x - c.pos.x, o.pos.y - c.pos.y) < 8) { witness(w, o, false); o.addMemory(w.clock, 'miracle', `${c.kind === 'avatar' ? "L'étranger" : c.first} s'est volatilisé sous mes yeux.`, 0.2, 0.9, c.id, { src: 'lived', conf: 1, subj: c.id }); }
  if (c.state === 'use') w.endUse(c, false); w.abortPlan(c, 'teleport'); c.pos = { x: p.x, y: p.y }; c.state = 'idle'; c.plan = []; c.path = []; c.stuck_t = 0;
  note(w, 'teleport', c.id, `${c.kind === 'avatar' ? 'Vous vous téléportez' : c.first + ' est téléporté(e)'} : ${p.label}.`); return true;
}

export function bless(w: World, c: SimChar): boolean {
  if (!canAfford(w, 'bless')) return false;
  pay(w, 'bless');
  for (const n of NEEDS) if (!(n === 'energy' && c.isAsleep())) c.needs[n] = Math.min(100, c.needs[n] + 18);
  c.joy += 30; c.stress = Math.max(0, c.stress - 25); c.anger = Math.max(0, c.anger - 30);
  witness(w, c, true); w.emitLog(`Vous bénissez ${c.first}.`, 'god', c.id); return true;
}
export function whisper(w: World, c: SimChar, act: string): boolean {
  if (!canAfford(w, 'whisper') || !WHISPERS[act]) return false;
  pay(w, 'whisper');
  const obey = 0.3 + (c.faith / 100) * 0.65; c.faith = Math.min(100, c.faith + 1);
  if (w.rng.randf() < obey && !c.isAsleep()) {
    c.whisper_act = act; c.whisper_until = w.clock + 120;
    if (c.state === 'idle' || (c.state === 'use' && ACT[c.use_act].interrupt)) { if (c.state === 'use') w.endUse(c, false); c.decision_cooldown = 0; }
    w.emitLog(`${c.first} entend une voix : « ${WHISPERS[act]} ».`, 'god', c.id); w.showEmote(c, 'spark', 2.5);
    c.addMemory(w.clock, 'whisper', `J'ai entendu une voix me dire : ${WHISPERS[act].toLowerCase()}.`, 0.1, 0.5);
  } else w.emitLog(`${c.first} n'écoute pas votre murmure.`, 'god', c.id);
  return true;
}
export function fate(w: World, a: SimChar, b: SimChar): boolean {
  if (a.id === b.id || !canAfford(w, 'fate') || a.isAsleep() || b.isAsleep()) return false;
  pay(w, 'fate');
  for (const x of [a, b]) { if (x.state === 'use') w.endUse(x, false); else if (x.state === 'walk' || x.state === 'idle') { x.plan = []; x.state = 'idle'; } }
  delete a.avoid[b.id]; delete b.avoid[a.id]; b.state = 'idle';
  a.plan = [{ type: 'approach', target: b.id }]; a.decision_cooldown = 99; w.startNextStep(a); b.decision_cooldown = 5;
  w.emitLog(`Le destin rapproche ${a.first} et ${b.first}.`, 'god', a.id); w.showEmote(a, 'spark', 3); w.showEmote(b, 'spark', 3); return true;
}
export function feast(w: World): boolean {
  if (!canAfford(w, 'feast') || w.feastActive()) return false;
  pay(w, 'feast'); w.feastUntil = w.clock + 75; w.emitLog('Un festin céleste apparaît dans la cuisine !', 'god');
  for (const c of w.residents) {
    witness(w, c, false); c.faith = Math.min(100, c.faith + 3);
    c.addMemory(w.clock, 'miracle', "Un festin est apparu de nulle part. Quelqu'un veille sur nous ?", 0.6, 0.85);
    if (c.state === 'use' && !c.isAsleep() && ACT[c.use_act].interrupt) w.endUse(c, false);
    if (c.state === 'idle') c.decision_cooldown = 0.2 + w.rng.randf() * 1.5;
  }
  return true;
}
function witness(w: World, c: SimChar, direct: boolean) {
  c.faith = Math.min(100, c.faith + (direct ? 4 : 1));
  const open = c.trait('openness'), neuro = c.trait('neuroticism');
  if (neuro > 0.65 && !direct) { c.stress += 10; w.setEmotionFor(c, 'anxious', 25); }
  else if (open > 0.55 || direct) { w.setEmotionFor(c, 'awe', 20); w.showEmote(c, 'spark', 3); }
  else c.joy += 6;
  if (direct) c.addMemory(w.clock, 'miracle', "J'ai senti une présence bienveillante.", 0.8, 0.9);
}
