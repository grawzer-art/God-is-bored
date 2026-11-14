/** Garage de Léo (x85-93, y2-5) : travail rémunéré répétable (établi, voiture sur cric), horaires 8 h – 19 h, outil qui augmente la paye, lien avec Tommy.
 *  Le gain dépend de l'économie du monde (mult. de profil, outil possédé) et nourrit la réputation professionnelle. */
import type { SimChar } from './simchar';
import type { World } from './world';
import * as Profile from './profile';
import * as Quests from './quests';
import * as Debt from './debt';

export const leo = (w: World) => w.chars.find((c) => c.name === 'Léo Ferreira');
export const isLeo = (c: SimChar) => c.name === 'Léo Ferreira';
export const TOOL_PRICE = 40;
/** Pourquoi le garage est fermé (chaîne vide = ouvert). */
export function closedReason(w: World): string { const h = w.hour(); if (h < 8 || h >= 19) return 'fermé (8 h – 19 h)'; const l = leo(w); if (!l || l.away) return 'Léo n\'est pas là'; return ''; }
export function payFor(w: World, c: SimChar): number { return Math.round((28 + w.rng.randf() * 8) * Profile.payMult(w) * ((c.inventory.cle ?? 0) > 0 ? 1.4 : 1)); }
/** Fin d'une réparation : seul le joueur est payé (les PNJ travaillent pour leur salaire hors-champ). Réputation pro, relation avec Léo, quêtes. */
export function onRepairDone(w: World, c: SimChar) {
  if (c.kind !== 'avatar') return; const l = leo(w); const pay = payFor(w, c); c.money += pay; w.stats.garage_jobs = (w.stats.garage_jobs ?? 0) + 1; Debt.rep(w, 'pro', 1.5);
  if (l) { const r = w.getRel(l.id, c.id); r.aff = Math.min(100, r.aff + 2); r.fam = Math.min(100, r.fam + 3); r.resp = Math.min(100, r.resp + 2); }
  w.emitLog(`Réparation terminée : +${pay} €.`, 'info', c.id); Quests.emit(w, 'garage_job');
}
export function buyTool(w: World, av: SimChar): { ok: boolean; line: string } {
  if ((av.inventory.cle ?? 0) > 0) return { ok: false, line: 'Vous avez déjà une clé.' }; if (av.money < TOOL_PRICE) return { ok: false, line: `Il vous manque ${Math.round(TOOL_PRICE - av.money)} €.` };
  av.money -= TOOL_PRICE; av.inventory.cle = 1; Quests.emit(w, 'buy', 'cle'); Debt.rep(w, 'pro', 1); return { ok: true, line: 'Léo vous tend une clé à molette : « Prends-en soin. Ça te fera gagner du temps. »' };
}
