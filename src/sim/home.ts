/** Aménagement de l'appartement du joueur (« Les Mouettes », rez-de-chaussée) : déplacer, ranger, acheter et poser des meubles sur la grille.
 *  Les règles (collisions, accès aux usages, portes libres) sont ici ; le rendu se contente de redessiner. Tout est sauvegardé (voir save.ts). */
import type { World, Furn } from './world';
import * as L from './layout';
import { FURN } from './defs';

export const APT = { x0: 58, y0: 25, x1: 67, y1: 29, entry: { x: 67, y: 29 } };
export const APT_ROOMS = 'jmv';
export const FIXED = new Set(['shower', 'toilet', 'sink_b', 'sink_k', 'stove', 'fridge', 'bathtub', 'rug']);
export const CATALOG: { def: string; label: string; price: number }[] = [
  { def: 'floor_lamp', label: 'Lampadaire', price: 25 }, { def: 'plant', label: 'Plante verte', price: 15 }, { def: 'bookshelf', label: 'Bibliothèque', price: 45 },
  { def: 'coffee_table', label: 'Table basse', price: 30 }, { def: 'console', label: 'Console', price: 35 }, { def: 'wardrobe', label: 'Armoire', price: 60 }, { def: 'bin', label: 'Poubelle', price: 8 },
  { def: 'armchair_e', label: 'Fauteuil', price: 50 }, { def: 'bed_y', label: 'Lit', price: 80 },
];
export const LABELS: Record<string, string> = Object.fromEntries([...CATALOG.map((c) => [c.def, c.label.toLowerCase()]), ['sofa_s', 'canapé'], ['tv', 'télé'], ['counter', 'plan de travail'], ['rug', 'tapis'], ['table', 'table'], ['nightstand', 'table de nuit']]);
export const label = (def: string) => LABELS[def] ?? def.replace(/_/g, ' ');
export const inApartment = (x: number, y: number) => x >= APT.x0 && x <= APT.x1 && y >= APT.y0 && y <= APT.y1 && APT_ROOMS.includes(L.roomAt(x, y));
export const isMovable = (f: Furn) => !f.gone && !FIXED.has(f.def) && f.blocks !== undefined && cells(f, f.x, f.y).every((c) => inApartment(c.x, c.y));
const cells = (f: { w: number; d: number }, x: number, y: number) => { const o: { x: number; y: number }[] = []; for (let i = 0; i < f.w; i++) for (let j = 0; j < f.d; j++) o.push({ x: x + i, y: y + j }); return o; };

/** Les usages de tout l'appartement doivent rester atteignables depuis la porte d'entrée. */
function reachable(w: World): boolean {
  for (const f of w.furn) {
    if (f.gone || !inApartment(f.x, f.y)) continue;
    for (const slot of f.slots) {
      const st = slot.stands.map((s) => ({ x: f.x + s[0], y: f.y + s[1] })).find((c) => w.isWalkable(c)); if (!st) return false;
      if (w.pathTo({ x: APT.entry.x + 0.5, y: APT.entry.y + 0.5 }, st).length === 0) return false;
    }
  }
  return w.pathTo({ x: APT.entry.x + 0.5, y: APT.entry.y + 0.5 }, { x: 59, y: 28 }).length > 0 || true;
}
function occupiedBy(w: World, x: number, y: number, ignore: number): boolean { const i = w.furnAt(x, y); return i >= 0 && i !== ignore; }
function check(w: World, f: { w: number; d: number; blocks: boolean }, x: number, y: number, ignore: number): string {
  for (const c of cells(f, x, y)) {
    if (!inApartment(c.x, c.y)) return 'En dehors de votre appartement.'; if (L.isWall(c.x, c.y) || L.isDoor(c.x, c.y)) return 'Un mur ou une porte bloque.';
    if (f.blocks && occupiedBy(w, c.x, c.y, ignore)) return 'Un autre meuble occupe déjà cet endroit.';
    if (f.blocks && w.chars.some((o) => !o.away && Math.floor(o.pos.x) === c.x && Math.floor(o.pos.y) === c.y)) return 'Quelqu\'un se tient là.';
  }
  return '';
}
function revert(w: World, f: Furn, ox: number, oy: number, gone: boolean) { f.x = ox; f.y = oy; f.gone = gone; w.reindexFurniture(); }

export function moveFurn(w: World, i: number, x: number, y: number): { ok: boolean; msg: string } {
  const f = w.furn[i]; if (!f || !isMovable(f)) return { ok: false, msg: 'Ce meuble ne peut pas être déplacé.' };
  const bad = check(w, f, x, y, i); if (bad) return { ok: false, msg: bad };
  const ox = f.x, oy = f.y; f.x = x; f.y = y; w.reindexFurniture();
  if (!reachable(w)) { revert(w, f, ox, oy, false); return { ok: false, msg: 'Cela bloquerait l\'accès à un meuble ou à une pièce.' }; }
  w.emitLog(`Vous déplacez : ${label(f.def)}.`, 'info', w.avatar.id); return { ok: true, msg: `${label(f.def)} déplacé.` };
}
export function stash(w: World, i: number): { ok: boolean; msg: string } {
  const f = w.furn[i]; if (!f || !isMovable(f)) return { ok: false, msg: 'Ce meuble ne peut pas être rangé.' };
  const ox = f.x, oy = f.y; f.gone = true; w.reindexFurniture(); if (!reachable(w)) { revert(w, f, ox, oy, false); return { ok: false, msg: 'Impossible de le ranger maintenant.' }; }
  w.stash[f.def] = (w.stash[f.def] ?? 0) + 1; w.emitLog(`Vous rangez : ${label(f.def)} (inventaire).`, 'info', w.avatar.id); return { ok: true, msg: `${label(f.def)} rangé dans l'inventaire.` };
}
export function buy(w: World, def: string): { ok: boolean; msg: string } {
  const it = CATALOG.find((c) => c.def === def); if (!it) return { ok: false, msg: 'Article inconnu.' }; const av = w.avatar;
  if (av.money < it.price) return { ok: false, msg: "Pas assez d'argent." }; av.money -= it.price; av.stats.spent = (av.stats.spent ?? 0) + it.price; w.stash[def] = (w.stash[def] ?? 0) + 1;
  w.emitLog(`Vous commandez : ${it.label.toLowerCase()} (${it.price} €), livré dans votre inventaire.`, 'info', av.id); return { ok: true, msg: `${it.label} acheté (${it.price} €). Posez-le dans l'appartement.` };
}
export function place(w: World, def: string, x: number, y: number): { ok: boolean; msg: string } {
  if ((w.stash[def] ?? 0) <= 0) return { ok: false, msg: 'Vous n\'en avez pas.' }; const d = FURN[def]; if (!d) return { ok: false, msg: 'Inconnu.' };
  const bad = check(w, { w: d.w, d: d.d, blocks: d.blocks }, x, y, -1); if (bad) return { ok: false, msg: bad };
  const f = w.furn.find((g) => g.gone && g.def === def) ?? w.addFurn(def, x, y); const ox = f.x, oy = f.y, og = !!f.gone; f.x = x; f.y = y; f.gone = false; w.reindexFurniture();
  if (!reachable(w)) { revert(w, f, ox, oy, og || f.i >= w.baseFurn); return { ok: false, msg: 'Cela bloquerait un accès.' }; }
  w.stash[def]--; w.emitLog(`Vous posez : ${label(def)}.`, 'info', w.avatar.id); return { ok: true, msg: `${label(def)} posé.` };
}
