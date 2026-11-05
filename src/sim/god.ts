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
};
export const WHISPERS: Record<string, string> = { eat: 'Va manger', sleep: 'Va dormir', shower: 'Va te laver', chat: 'Va discuter', tv: 'Détends-toi devant la télé', tidy: 'Range un peu', pray: 'Prie un instant' };
export const cost = (p: string) => POWERS[p].cost;
export const canAfford = (w: World, p: string) => w.godEnergy >= cost(p);
function pay(w: World, p: string) { w.godEnergy -= cost(p); w.ennui = Math.max(0, w.ennui - 8); }

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
