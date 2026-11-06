/** Romance entre ADULTES (18+ uniquement, vérifié partout). Le consentement est une CONDITION du système : un refus est un refus, il ne s'« arrache » pas.
 *  Étapes : inconnus → flirt → rendez-vous (« dating ») → couple → rupture. Rien d'explicite : la soirée du couple est une ellipse.
 *  Le sentiment dépend des dimensions de la relation (attirance, affection, confiance, peur) et de la personnalité. Les PNJ peuvent aussi tomber amoureux entre eux. */
import type { SimChar } from './simchar';
import type { World } from './world';
import * as Quests from './quests';

export type State = 'dating' | 'couple' | 'ex';
export interface Romance { a: number; b: number; state: State; since: number; dates: number; last: number }
export const ADULT = 18;
const clamp = (v: number, a = 0, b = 100) => Math.max(a, Math.min(b, v));
const key = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);
export const adult = (c: SimChar) => c.age >= ADULT;
/** Orientation : celle du roster ; à défaut, déterminée de façon stable par l'identifiant. */
export function orientation(c: SimChar): string[] { if (c.attracted_to.length) return c.attracted_to; const m = c.id % 5; return m === 0 ? ['F'] : m === 1 ? ['M'] : ['M', 'F']; }
export const compatible = (a: SimChar, b: SimChar) => orientation(a).includes(b.gender) && orientation(b).includes(a.gender);
export const get = (w: World, a: number, b: number): Romance | undefined => w.romances[key(a, b)];
export const partnerOf = (w: World, c: SimChar): SimChar | null => { for (const r of Object.values(w.romances)) if (r.state !== 'ex' && (r.a === c.id || r.b === c.id)) return w.chars[r.a === c.id ? r.b : r.a]; return null; };
export const label = (r?: Romance) => (!r ? '' : r.state === 'couple' ? 'en couple' : r.state === 'dating' ? 'ils se fréquentent' : 'ex');

/** Peut-on seulement envisager une avance ? (sinon : message de refus de principe, jamais de tentative). */
export function blocked(w: World, from: SimChar, to: SimChar): string {
  if (!adult(from) || !adult(to)) return 'Impossible : cette relation n\'existe que entre adultes.';
  if (from.id === to.id || to.kind === 'police' && w.wanted.level > 0) return 'Pas maintenant.'; if (to.isAsleep()) return `${to.first} dort.`; if (to.state === 'ko') return `${to.first} est à terre.`;
  if (!compatible(from, to)) return `${to.first} ne ressent pas cela pour vous.`;
  const p = partnerOf(w, to); if (p && p.id !== from.id) return `${to.first} est déjà en couple avec ${p.first}.`;
  return '';
}
/** Disposition réelle de `npc` envers `from` (0..100) : attirance, affection, confiance ; la peur et la rancune l'abaissent. */
export function warmth(w: World, npc: SimChar, from: SimChar): number {
  const r = w.getRel(npc.id, from.id);
  return clamp(r.att * 0.45 + (r.aff + 100) / 2 * 0.25 + r.trust * 0.2 + npc.trait('openness') * 8 + npc.joy * 0.05 - r.fear * 0.7 - npc.anger * 0.3 - Math.max(0, -r.aff) * 0.3);
}
const stamp = (w: World, c: SimChar, k: string, v: number) => { c.stats['rom_' + k] = v; };
export interface Result { ok: boolean; line: string; refused?: boolean }
const refuse = (w: World, npc: SimChar, from: SimChar, soft: boolean): Result => {
  const r = w.getRel(npc.id, from.id); r.aff = clamp(r.aff - (soft ? 2 : 8), -100, 100); w.showEmote(npc, soft ? 'sweat' : 'anger', 2.5);
  npc.addMemory(w.clock, 'romance', soft ? `${from.kind === 'avatar' ? "Quelqu'un" : from.first} m'a fait des avances. Pas pour moi.` : `${from.kind === 'avatar' ? "Quelqu'un" : from.first} insiste malgré mon refus.`, soft ? -0.1 : -0.6, 0.6, from.id, { src: 'lived', conf: 1, subj: from.id });
  return { ok: false, refused: true, line: soft ? `${npc.first} sourit, gêné(e) : « C'est gentil, mais non. »` : `${npc.first} se ferme : « J'ai dit non. Arrêtez. »` };
};
/** Un refus récent rend toute nouvelle avance insistante : l'insistance est mal vécue et peut mener à un signalement. */
export function flirt(w: World, from: SimChar, npc: SimChar): Result {
  const why = blocked(w, from, npc); if (why) return { ok: false, line: why };
  const lastNo = npc.stats['rom_no_' + from.id] ?? -1e9; if (w.clock - lastNo < 1440) { npc.stats['rom_no_' + from.id] = w.clock; const res = refuse(w, npc, from, false); if (from.kind === 'avatar') Quests.emit(w, 'insist'); return res; }
  const wm = warmth(w, npc, from) + (from.drunk > 20 && from.kind === 'avatar' ? -4 : 0); const roll = w.rng.randf() * 22 - 11;
  if (wm + roll >= 34) {
    const r = w.getRel(npc.id, from.id); r.att = clamp(r.att + 9); r.aff = clamp(r.aff + 5, -100, 100); r.trust = clamp(r.trust + 2); const r2 = w.getRel(from.id, npc.id); r2.att = clamp(r2.att + 5); r2.aff = clamp(r2.aff + 3, -100, 100);
    w.showEmote(npc, 'heart', 3); npc.joy += 8; npc.addMemory(w.clock, 'romance', `${from.kind === 'avatar' ? "L'étranger" : from.first} m'a charmé(e) : ça m'a plu.`, 0.7, 0.7, from.id, { src: 'lived', conf: 1, subj: from.id });
    if (from.kind === 'avatar') Quests.emit(w, 'flirt'); return { ok: true, line: `${npc.first} rit, détourne le regard, puis vous le rend : « Vous ne manquez pas d'aplomb. »` };
  }
  npc.stats['rom_no_' + from.id] = w.clock; return refuse(w, npc, from, true);
}
export function canDate(w: World, from: SimChar, npc: SimChar): string {
  const why = blocked(w, from, npc); if (why) return why; const r = w.getRel(npc.id, from.id); if (get(w, from.id, npc.id)) return 'Vous vous fréquentez déjà.'; if (r.att < 25 || r.aff < 20) return 'Trop tôt : apprenez à vous connaître.'; return '';
}
export function date(w: World, from: SimChar, npc: SimChar): Result {
  const why = canDate(w, from, npc); if (why) return { ok: false, line: why };
  if (w.clock - (npc.stats['rom_no_' + from.id] ?? -1e9) < 1440) { npc.stats['rom_no_' + from.id] = w.clock; return refuse(w, npc, from, false); }
  if (warmth(w, npc, from) + w.rng.randf() * 14 - 7 < 38) { npc.stats['rom_no_' + from.id] = w.clock; return refuse(w, npc, from, true); }
  w.romances[key(from.id, npc.id)] = { a: from.id, b: npc.id, state: 'dating', since: w.clock, dates: 1, last: w.clock };
  const r = w.getRel(npc.id, from.id); r.att = clamp(r.att + 10); r.aff = clamp(r.aff + 10, -100, 100); r.trust = clamp(r.trust + 6); w.showEmote(npc, 'heart', 4); npc.joy += 14;
  for (const c of [from, npc]) { c.needs.social = clamp(c.needs.social + 25); c.needs.fun = clamp(c.needs.fun + 18); }
  npc.addMemory(w.clock, 'romance', `Premier rendez-vous avec ${from.kind === 'avatar' ? "l'étranger" : from.first}. Une belle soirée.`, 0.9, 0.9, from.id, { src: 'lived', conf: 1, subj: from.id });
  w.emitLog(`${from.kind === 'avatar' ? 'Vous' : from.first} et ${npc.first} se donnent rendez-vous.`, 'social', npc.id); if (from.kind === 'avatar') Quests.emit(w, 'date'); return { ok: true, line: `Vous passez la soirée sur la promenade avec ${npc.first}. Elle file trop vite. « On remet ça ? »` };
}
export function again(w: World, from: SimChar, npc: SimChar): Result {
  const rm = get(w, from.id, npc.id); if (!rm || rm.state === 'ex') return { ok: false, line: 'Vous ne vous fréquentez pas.' }; if (w.clock - rm.last < 720) return { ok: false, line: `${npc.first} : « Laissons-nous un peu de temps. »` };
  rm.dates++; rm.last = w.clock; const r = w.getRel(npc.id, from.id); r.att = clamp(r.att + 5); r.aff = clamp(r.aff + 5, -100, 100); r.trust = clamp(r.trust + 4); w.showEmote(npc, 'heart', 3); npc.joy += 8;
  npc.addMemory(w.clock, 'romance', `Un nouveau rendez-vous avec ${from.kind === 'avatar' ? "l'étranger" : from.first}.`, 0.7, 0.6, from.id, { src: 'lived', conf: 1, subj: from.id });
  return { ok: true, line: `Une nouvelle sortie avec ${npc.first}. Vous vous sentez à votre place.` };
}
export function canCouple(w: World, from: SimChar, npc: SimChar): string {
  const rm = get(w, from.id, npc.id); if (!rm || rm.state !== 'dating') return rm?.state === 'couple' ? 'Vous êtes déjà ensemble.' : 'Il faut d\'abord se fréquenter.'; if (rm.dates < 2) return 'Un deuxième rendez-vous d\'abord.'; return '';
}
export function ask(w: World, from: SimChar, npc: SimChar): Result {
  const why = canCouple(w, from, npc); if (why) return { ok: false, line: why };
  if (warmth(w, npc, from) < 55) return { ok: false, refused: true, line: `${npc.first} : « J'ai besoin de temps. Ne me brusquez pas. »` };
  const rm = get(w, from.id, npc.id)!; rm.state = 'couple'; rm.since = w.clock; rm.last = w.clock; const r = w.getRel(npc.id, from.id); r.att = clamp(r.att + 8); r.aff = clamp(r.aff + 10, -100, 100); r.trust = clamp(r.trust + 10); w.showEmote(npc, 'heart', 5); npc.joy += 25;
  npc.addMemory(w.clock, 'romance', `${from.kind === 'avatar' ? "L'étranger" : from.first} et moi, c'est officiel.`, 1, 1, from.id, { src: 'lived', conf: 1, subj: from.id });
  w.emitLog(`${from.kind === 'avatar' ? 'Vous' : from.first} et ${npc.first} sont maintenant en couple.`, 'social', npc.id); if (from.kind === 'avatar') Quests.emit(w, 'couple'); return { ok: true, line: `${npc.first} sourit : « Oui. Allez, c'est officiel. »` };
}
/** Ellipse : le couple passe la soirée ensemble (aucune scène). Nécessite que la disposition du/de la partenaire le permette à cet instant. */
export function evening(w: World, from: SimChar, npc: SimChar): Result {
  const rm = get(w, from.id, npc.id); if (!rm || rm.state !== 'couple') return { ok: false, line: 'Il faut être en couple.' }; if (w.clock - rm.last < 480) return { ok: false, line: `${npc.first} : « Pas ce soir, on se voit déjà beaucoup. »` };
  if (warmth(w, npc, from) < 50 || npc.needs.energy < 25 || npc.stress > 70) return { ok: false, refused: true, line: `${npc.first} : « Pas ce soir. J'ai besoin de souffler. » Vous acceptez sans insister.` };
  rm.last = w.clock; for (const c of [from, npc]) { c.needs.social = clamp(c.needs.social + 30); c.needs.fun = clamp(c.needs.fun + 15); c.stress = clamp(c.stress - 20); c.joy += 12; }
  const r = w.getRel(npc.id, from.id); r.att = clamp(r.att + 4); r.trust = clamp(r.trust + 4); w.showEmote(npc, 'heart', 4);
  npc.addMemory(w.clock, 'romance', `Une soirée tendre avec ${from.kind === 'avatar' ? "l'étranger" : from.first}.`, 0.8, 0.7, from.id, { src: 'lived', conf: 1, subj: from.id }); return { ok: true, line: '… La nuit tombe doucement sur NORIA. Vous vous réveillez de bonne humeur.' };
}
export function breakUp(w: World, from: SimChar, npc: SimChar): Result {
  const rm = get(w, from.id, npc.id); if (!rm || rm.state === 'ex') return { ok: false, line: 'Vous n\'êtes pas ensemble.' }; rm.state = 'ex'; rm.last = w.clock;
  const r = w.getRel(npc.id, from.id); r.aff = clamp(r.aff - 30, -100, 100); r.att = clamp(r.att - 25); r.trust = clamp(r.trust - 25); npc.joy -= 25; npc.stress += 20; w.showEmote(npc, 'sad', 5);
  npc.addMemory(w.clock, 'romance', `${from.kind === 'avatar' ? "L'étranger" : from.first} a rompu avec moi.`, -0.9, 1, from.id, { src: 'lived', conf: 1, subj: from.id }); w.emitLog(`${from.kind === 'avatar' ? 'Vous' : from.first} et ${npc.first} se séparent.`, 'drama', npc.id);
  return { ok: true, line: `${npc.first} baisse les yeux : « Je comprends. » C'est fini.` };
}

/** Chaque jour : les PNJ adultes compatibles et très proches se mettent ensemble ; les couples négligés s'éloignent ; une infidélité connue est possible. */
export function daily(w: World) {
  const cs = w.chars.filter((c) => (c.kind === 'resident' || c.kind === 'citizen') && adult(c));
  for (const a of cs) for (const b of cs) {
    if (a.id >= b.id || !compatible(a, b) || get(w, a.id, b.id) || partnerOf(w, a) || partnerOf(w, b)) continue;
    const r1 = w.getRel(a.id, b.id), r2 = w.getRel(b.id, a.id); if (r1.att > 62 && r2.att > 62 && r1.aff > 50 && r2.aff > 50 && w.rng.randf() < 0.5) {
      w.romances[key(a.id, b.id)] = { a: a.id, b: b.id, state: 'couple', since: w.clock, dates: 3, last: w.clock }; w.emitLog(`${a.first} et ${b.first} sont maintenant en couple.`, 'social', a.id); a.joy += 15; b.joy += 15; w.showEmote(a, 'heart', 4); w.showEmote(b, 'heart', 4);
    }
  }
  for (const rm of Object.values(w.romances)) {
    if (rm.state === 'ex') continue; const a = w.chars[rm.a], b = w.chars[rm.b]; const idle = (w.clock - rm.last) / 1440;
    if (rm.a !== w.avatar.id && rm.b !== w.avatar.id) { const r1 = w.getRel(rm.a, rm.b), r2 = w.getRel(rm.b, rm.a); if (r1.fam > 20) { rm.last = w.clock; r1.att = clamp(r1.att + 0.4); r2.att = clamp(r2.att + 0.4); } if (r1.aff < 5 || r2.aff < 5) { rm.state = 'ex'; w.emitLog(`${a.first} et ${b.first} se séparent.`, 'drama', a.id); } continue; }
    if (idle > 4) { const other = rm.a === w.avatar.id ? b : a; const r = w.getRel(other.id, w.avatar.id); r.att = clamp(r.att - 3 * (idle - 4)); r.aff = clamp(r.aff - 2 * (idle - 4), -100, 100); if (r.att < 10 && rm.state === 'dating') { rm.state = 'ex'; w.emitLog(`${other.first} s'est éloigné(e) de vous : plus de nouvelles.`, 'drama', other.id); } }
  }
  void stamp;
}
