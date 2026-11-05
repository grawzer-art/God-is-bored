/** INCARNER : le joueur prend le corps d'un habitant (n'importe quel PNJ). Le PNJ cesse d'être autonome ; à la sortie il reprend sa vie SANS souvenir personnel de la période,
 *  alors que les autres gardent leurs souvenirs et que blessures, argent, objets déplacés, relations modifiées restent. Un journal des incarnations est conservé.
 *  Mécanisme : le corps possédé prend le rôle « avatar » (donc commandes, inventaire, crimes du joueur…) ; l'avatar d'origine dort (`dormant`, hors carte visible). */
import type { World } from './world';
import type { SimChar } from './simchar';

export interface PossessState { npc: number; kind: SimChar['kind']; since: number; known: number[]; money: number; away: boolean }
export interface Incarnation { npc: number; t0: number; t1: number; text: string }

export function canPossess(w: World, id: number): string {
  const c = w.chars[id]; if (!c) return 'Personne ici.'; if (w.possess) return 'Vous occupez déjà un corps.';
  if (c.kind === 'avatar' || c.kind === 'dormant') return 'C\'est vous.'; if (c.away) return `${c.first} n'est pas dans le quartier.`; return '';
}
export function start(w: World, id: number): { ok: boolean; msg: string } {
  const bad = canPossess(w, id); if (bad) return { ok: false, msg: bad };
  const c = w.chars[id]; const a = w.avatar;
  if (a.state === 'use') w.endUse(a, false); w.abortPlan(a, 'possess'); a.kind = 'dormant'; a.away = true; a.state = 'idle'; a.plan = [];
  if (c.state === 'use') w.endUse(c, false); w.abortPlan(c, 'possess'); c.task = null; c.intent = null; c.state = 'idle'; c.plan = [];
  w.possess = { npc: c.id, kind: c.kind, since: w.clock, known: Object.keys(c.known).map(Number), money: c.money, away: false };
  c.kind = 'avatar'; w.input = { dx: 0, dy: 0, run: false }; w.emitLog(`Vous prenez possession de ${c.first}.`, 'god', c.id);
  return { ok: true, msg: `Vous êtes ${c.first}.` };
}
export function end(w: World): { ok: boolean; msg: string } {
  const st = w.possess; if (!st) return { ok: false, msg: '' }; const c = w.chars[st.npc]; w.possess = null;
  // le PNJ ne garde aucun souvenir personnel de la période
  const lost = c.memories.filter((m) => m.t >= st.since).length; c.memories = c.memories.filter((m) => m.t < st.since);
  for (const id of Object.keys(c.known).map(Number)) if (!st.known.includes(id)) delete c.known[id];
  const crimes = w.wanted.level > 0; if (crimes) { w.wantedNpcs[c.id] = w.clock + 8 * 60; w.wanted.level = 0; w.wanted.heat = 0; }
  if (c.state === 'use') w.endUse(c, false); w.abortPlan(c, 'release'); c.kind = st.kind; c.state = 'idle'; c.plan = []; c.decision_cooldown = 0; c.diag = null; c.pose = 'stand';
  const a = w.chars.find((x) => x.kind === 'dormant'); if (a) { a.kind = 'avatar'; a.away = false; a.pos = { ...c.pos }; a.pos.x += 0.7; if (!w.isWalkable({ x: Math.floor(a.pos.x), y: Math.floor(a.pos.y) })) a.pos = { ...c.pos }; }
  const dm = Math.round(c.money - st.money); const text = `Incarnation de ${c.first} (${Math.round(w.clock - st.since)} min) : argent ${dm >= 0 ? '+' : ''}${dm} €${crimes ? ', recherché(e) : la police s\'intéresse à lui/elle' : ''} ; ${lost} souvenir(s) personnel(s) oublié(s).`;
  w.incarnations.push({ npc: c.id, t0: st.since, t1: w.clock, text }); if (w.incarnations.length > 40) w.incarnations.shift(); w.emitLog(text, 'god', c.id);
  c.addMemory(w.clock, 'miracle', 'Un vertige… j\'ai l\'impression d\'avoir perdu un moment.', -0.1, 0.4);
  return { ok: true, msg: `${c.first} reprend sa vie, sans souvenir de ce qui vient de se passer.` };
}
/** Restaure l'état de possession d'une sauvegarde (les rôles ne sont pas stockés dans les personnages). */
export function restore(w: World, st: PossessState | null | undefined) {
  if (!st || !w.chars[st.npc]) return; const c = w.chars[st.npc]; const a = w.chars.find((x) => x.kind === 'avatar'); if (!a || a === c) return;
  a.kind = 'dormant'; a.away = true; c.kind = 'avatar'; w.possess = { ...st };
}
