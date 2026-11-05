/** Navigation centralisée : pile des fenêtres ouvertes. Une seule fenêtre modale à la fois (pas d'empilement sauvage), Échap / Retour / ✕ passent tous par ici.
 *  Chaque panneau s'enregistre à l'ouverture (`open`) et se retire à la fermeture (`closed`). `blocksWorld()` empêche les toucher d'agir sur le monde derrière un menu. */
export interface NavEntry {
  id: string;
  /** Ferme réellement la fenêtre (retire ses interactions) ; doit appeler `closed(id)`. */
  close: () => void;
  /** Retour à l'étape précédente (sous-menu → menu). Absent : Retour = fermer. */
  back?: () => boolean | void;
  /** Fenêtre qui n'empêche pas d'agir sur le monde (mode décoration, ciblage d'un pouvoir). */
  world?: boolean;
  /** Fenêtre « enfant » : peut s'ouvrir au-dessus d'une autre (aperçu, confirmation) sans la fermer. */
  child?: boolean;
}
const stack: NavEntry[] = []; const lastOpen = new Map<string, number>();
export const list = () => stack.map((e) => e.id);
export const has = (id: string) => stack.some((e) => e.id === id);
export const top = () => stack[stack.length - 1];
/** Ouvre : ferme d'abord les autres fenêtres non « enfant » (jamais deux panneaux l'un sur l'autre). Un double appui sur l'ouverture est ignoré (300 ms). */
export function open(e: NavEntry): boolean {
  const now = performance.now(); if (has(e.id)) { stack.splice(stack.findIndex((x) => x.id === e.id), 1); } else if (now - (lastOpen.get(e.id) ?? -1e9) < 300) return false;
  lastOpen.set(e.id, now);
  if (!e.child) for (const o of [...stack]) if (!o.child && o.id !== e.id) { try { o.close(); } catch { /* ignoré */ } closed(o.id); }
  stack.push(e); return true;
}
export function closed(id: string) { const i = stack.findIndex((x) => x.id === id); if (i >= 0) stack.splice(i, 1); }
/** ✕ : ferme la fenêtre du dessus. */
export function closeTop(): boolean { const t = top(); if (!t) return false; try { t.close(); } catch { /* ignoré */ } closed(t.id); return true; }
/** Retour : étape précédente si la fenêtre en a une, sinon fermeture. */
export function back(): boolean { const t = top(); if (!t) return false; if (t.back) { const r = t.back(); if (r !== false) return true; } return closeTop(); }
export function closeAll() { let n = 0; while (stack.length && n++ < 20) closeTop(); }
export const blocksWorld = () => stack.some((e) => !e.world);
export const anyOpen = () => stack.length > 0;
/** Sécurité : retire toute entrée dont la fenêtre n'existe plus (ex. après rechargement du monde). */
export function reset() { stack.length = 0; }
let keysInstalled = false;
export function installKeys() { if (keysInstalled) return; keysInstalled = true; window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && back()) { e.preventDefault(); e.stopPropagation(); } }, true); }

(window as any).__nav = { list, back, closeTop, blocksWorld, anyOpen };
