/** Observation : traduit l'état réel d'un habitant (plan, étape, besoins, intention) en texte et icône lisibles. Aucune dépendance au rendu.
 *  Tout ce qui est affiché ici est lu dans l'état de simulation — rien n'est inventé pour l'affichage. */
import { ACT, NEEDS, NEED_LABEL, ROOM_NAMES } from './defs';
import * as L from './layout';
import type { SimChar } from './simchar';
import type { World } from './world';

export const FURN_NAME: Record<string, string> = {
  fridge: 'le frigo', stove: 'la cuisinière', sink_k: "l'évier", table: 'la table', chair_s: 'une chaise', chair_n: 'une chaise', chair_e: 'une chaise', chair_w: 'une chaise',
  sofa_s: 'le canapé', armchair_e: 'le fauteuil', tv: 'la télé', bookshelf: 'la bibliothèque', plant: 'les plantes', toilet: 'les toilettes', shower: 'la douche', sink_b: 'le lavabo',
  bathtub: 'la baignoire', washer: 'la machine à laver', altar: "l'autel", bed_y: 'son lit', bed_yw: 'son lit', stool: 'un tabouret', bar_counter: 'le comptoir', jukebox: 'le jukebox',
};
const ICON: Record<string, string> = {
  eat: 'fork', snack: 'fork', serve: 'fork', feast: 'fork', cook: 'pan', tv: 'tv', read: 'book', browse: 'book', shower: 'bubbles', bath: 'bubbles', wash: 'bubbles', toilet: 'dots',
  tidy: 'broom', dishes: 'broom', laundry: 'broom', water: 'sweat', pray: 'pray', drink: 'beer', music: 'note', search: 'alert', chat: 'talk', nap: 'zzz',
};
const INTENT_ICON: Record<string, string> = { help: 'heart', confront: 'anger', tell: 'talk', apologize: 'smile', steal: 'dots' };

/** Prochaine activité prévue (la première étape « use » ou « wait » du plan, ou l'étape courante). */
function nextUse(c: SimChar): { act: string; furn: number } | null {
  for (const s of [c.step, ...c.plan]) if (s && (s.type === 'use' || s.type === 'wait') && s.act) return { act: s.act, furn: s.furn ?? -1 };
  return null;
}
/** Icône d'activité à afficher au-dessus de la tête ('' = rien). Pour un habitant qui marche, c'est CE QU'IL VA FAIRE. */
export function activityIcon(w: World, c: SimChar): string {
  if (c.away || c.isAsleep()) return '';
  if (c.talking || c.state === 'chat') return 'talk';
  if (c.state === 'use' && c.use_act) return ICON[c.use_act] ?? '';
  if (c.state === 'walk' || c.state === 'idle') {
    if (c.intent && c.intent.kind !== 'steal') return INTENT_ICON[c.intent.kind] ?? '';
    if (c.step?.type === 'depart' || c.plan.some((s) => s.type === 'depart')) return 'case';
    const n = nextUse(c); if (n) return ICON[n.act] ?? '';
    if (c.step?.type === 'approach') return 'talk';
  }
  return '';
}
export interface Brief { activity: string; dest: string; need: string; needValue: number; urgent: boolean; goal: string; icon: string }
const where = (c: SimChar) => ROOM_NAMES[L.roomAt(Math.floor(c.path_goal.x), Math.floor(c.path_goal.y))] ?? '';
/** Résumé lisible : activité actuelle, destination, besoin prioritaire. */
export function brief(w: World, c: SimChar): Brief {
  let activity = c.action_text || 'Réfléchit', dest = '—';
  if (c.away) { activity = c.jobPhase === 'searching' ? "Cherche du travail (hors de la carte)" : c.jobPhase === 'out' ? 'Est sorti(e) (hors de la carte)' : 'Au travail (hors de la carte)'; dest = c.jobUntil > 0 ? `Rentre vers ${hh(c.jobUntil)}` : '—'; }
  else if (c.isAsleep()) { activity = 'Dort'; dest = `Réveil prévu vers ${hh(c.wake_target)}`; }
  else if (c.state === 'chat' || c.talking) { activity = c.talk_with >= 0 && w.chars[c.talk_with] ? `Discute avec ${w.chars[c.talk_with].first}` : 'Discute'; dest = 'Reste sur place'; }
  else if (c.state === 'use') { activity = ACT[c.use_act]?.label ?? activity; const f = c.use_furn >= 0 ? w.furn[c.use_furn] : null; dest = f ? `Sur place (${FURN_NAME[f.def] ?? f.def}), encore ~${Math.max(1, Math.round(c.use_left))} min` : `Sur place, encore ~${Math.max(1, Math.round(c.use_left))} min`; }
  else if (c.state === 'walk') {
    const n = nextUse(c); const st = c.step; activity = 'Se déplace';
    if (st?.type === 'approach' || (!st && c.intent)) { const t = w.chars[st?.target ?? c.intent?.target ?? -1]; dest = t ? `Va voir ${t.first}` : 'Va voir quelqu\'un'; }
    else if (c.plan.some((s) => s.type === 'depart')) dest = c.jobPhase === 'searching' ? "Sort chercher du travail" : 'Sort pour aller travailler';
    else if (n) { const f = n.furn >= 0 ? w.furn[n.furn] : null; dest = `${ACT[n.act]?.label ?? n.act}${f ? ` — va vers ${FURN_NAME[f.def] ?? f.def}` : ''}`; }
    else dest = `Va vers : ${where(c) || 'un autre endroit'}`;
  }
  let need = '', nv = 101; for (const k of NEEDS) if (c.needs[k] < nv) { nv = c.needs[k]; need = NEED_LABEL[k]; }
  const goalName = c.goal.done ? 'accompli' : c.goal.id;
  return { activity, dest, need, needValue: nv, urgent: nv < 20, goal: goalName, icon: activityIcon(w, c) };
}
const hh = (clockMin: number) => { const t = Math.floor(clockMin % 1440); return `${Math.floor(t / 60)} h${String(t % 60).padStart(2, '0')}`; };
