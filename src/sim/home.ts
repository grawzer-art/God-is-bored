/** Aménagement de l'appartement du joueur (« Les Mouettes », rez-de-chaussée) : déplacer, ranger, acheter et poser des meubles sur la grille.
 *  Les règles (collisions, accès aux usages, portes libres) sont ici ; le rendu se contente de redessiner. Tout est sauvegardé (voir save.ts). */
import type { World, Furn } from './world';
import * as L from './layout';
import { FURN } from './defs';
import * as Quests from './quests';

export const APT = { x0: 58, y0: 25, x1: 67, y1: 29, entry: { x: 67, y: 29 } };
export const APT_ROOMS = 'jmv';
export const FIXED = new Set(['shower', 'toilet', 'sink_b', 'sink_k', 'stove', 'fridge', 'bathtub', 'rug']);
export type Cat = 'salon' | 'chambre' | 'cuisine' | 'bains' | 'deco' | 'eclairage' | 'rangement';
export const CATS: [Cat, string][] = [['salon', 'Salon'], ['chambre', 'Chambre'], ['cuisine', 'Cuisine'], ['bains', 'Bains'], ['deco', 'Décoration'], ['eclairage', 'Éclairage'], ['rangement', 'Rangement']];
export const LOCKED: Record<string, string> = { bookshelf: 'catalog2', console: 'catalog2', armchair_e: 'catalog2', wardrobe: 'catalog2', sofa_s: 'catalog2' };
export const CATALOG: { def: string; label: string; price: number; cat: Cat }[] = [
  { def: 'sofa_s', label: 'Canapé', price: 650, cat: 'salon' }, { def: 'tv', label: 'Télévision', price: 400, cat: 'salon' }, { def: 'coffee_table', label: 'Table basse', price: 30, cat: 'salon' }, { def: 'armchair_e', label: 'Fauteuil', price: 50, cat: 'salon' },
  { def: 'bed_y', label: 'Lit', price: 80, cat: 'chambre' }, { def: 'nightstand', label: 'Table de nuit', price: 40, cat: 'chambre' },
  { def: 'table', label: 'Table à manger', price: 90, cat: 'cuisine' }, { def: 'chair_s', label: 'Chaise', price: 30, cat: 'cuisine' }, { def: 'counter', label: 'Plan de travail', price: 40, cat: 'cuisine' }, { def: 'bin', label: 'Poubelle', price: 8, cat: 'cuisine' },
  { def: 'basket', label: 'Panier à linge', price: 12, cat: 'bains' },
  { def: 'plant', label: 'Plante verte', price: 15, cat: 'deco' }, { def: 'console', label: 'Console', price: 35, cat: 'deco' },
  { def: 'floor_lamp', label: 'Lampadaire', price: 25, cat: 'eclairage' },
  { def: 'wardrobe', label: 'Armoire', price: 60, cat: 'rangement' }, { def: 'bookshelf', label: 'Bibliothèque', price: 45, cat: 'rangement' },
];
/** Sols et murs proposés pour les pièces de l'appartement (j, m, v). */
export const FLOORS: { id: string; label: string; price: number }[] = [{ id: 'parquet', label: 'Parquet chevron', price: 0 }, { id: 'wood_a', label: 'Bois clair', price: 40 }, { id: 'wood_c', label: 'Bois miel', price: 40 }, { id: 'tile_kitchen', label: 'Carrelage damier', price: 60 }, { id: 'tile_bath', label: 'Carrelage bleu', price: 60 }, { id: 'concrete', label: 'Béton ciré', price: 50 }];
export const WALLS: { id: string; label: string; col: [number, number, number]; price: number }[] = [{ id: 'sable', label: 'Sable', col: [0.93, 0.86, 0.7], price: 0 }, { id: 'lilas', label: 'Lilas', col: [0.82, 0.76, 0.9], price: 30 }, { id: 'menthe', label: 'Menthe', col: [0.62, 0.84, 0.78], price: 30 }, { id: 'brique', label: 'Brique', col: [0.7, 0.4, 0.34], price: 30 }, { id: 'nuit', label: 'Bleu nuit', col: [0.36, 0.42, 0.62], price: 30 }, { id: 'rose', label: 'Rose poudré', col: [0.92, 0.72, 0.76], price: 30 }];
/** Historique d'aménagement (annuler / rétablir). Les achats ne sont pas annulés : les objets restent dans l'inventaire. */
export type Op = { t: 'rot'; i: number; from: string; to: string } | { t: 'move'; i: number; from: [number, number]; to: [number, number] } | { t: 'stash'; i: number; from: [number, number] } | { t: 'place'; i: number; to: [number, number] };
export function restyle(w: World, room: string, kind: 'floor' | 'wall', id: string): { ok: boolean; msg: string } {
  if (!APT_ROOMS.includes(room)) return { ok: false, msg: 'Pièce inconnue.' }; const it = kind === 'floor' ? FLOORS.find((f) => f.id === id) : WALLS.find((f) => f.id === id); if (!it) return { ok: false, msg: 'Inconnu.' };
  const cur = w.homeStyle[kind][room]; if (cur === id) return { ok: false, msg: 'Déjà posé.' }; const av = w.avatar; if (av.money < it.price) return { ok: false, msg: "Pas assez d'argent." };
  av.money -= it.price; w.homeStyle[kind][room] = id; w.styleVersion++; Quests.emit(w, 'style_changed'); w.emitLog(`Vous refaites ${kind === 'floor' ? 'le sol' : 'les murs'} : ${it.label}.`, 'info', av.id); return { ok: true, msg: `${it.label}${it.price ? ` (${it.price} €)` : ''}` };
}
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
  w.hist.push({ t: 'move', i, from: [ox, oy], to: [x, y] }); w.redo = []; w.emitLog(`Vous déplacez : ${label(f.def)}.`, 'info', w.avatar.id); return { ok: true, msg: `${label(f.def)} déplacé.` };
}
export function stash(w: World, i: number): { ok: boolean; msg: string } {
  const f = w.furn[i]; if (!f || !isMovable(f)) return { ok: false, msg: 'Ce meuble ne peut pas être rangé.' };
  const ox = f.x, oy = f.y; f.gone = true; w.reindexFurniture(); if (!reachable(w)) { revert(w, f, ox, oy, false); return { ok: false, msg: 'Impossible de le ranger maintenant.' }; }
  w.stash[f.def] = (w.stash[f.def] ?? 0) + 1; w.hist.push({ t: 'stash', i, from: [ox, oy] }); w.redo = []; w.emitLog(`Vous rangez : ${label(f.def)} (inventaire).`, 'info', w.avatar.id); return { ok: true, msg: `${label(f.def)} rangé dans l'inventaire.` };
}
export function buy(w: World, def: string): { ok: boolean; msg: string } {
  const it = CATALOG.find((c) => c.def === def); if (!it) return { ok: false, msg: 'Article inconnu.' }; const av = w.avatar; if (LOCKED[def] && !w.progress.unlocks.includes(LOCKED[def])) return { ok: false, msg: 'Pas encore disponible : terminez « Bienvenue chez toi ».' };
  if (av.money < it.price) return { ok: false, msg: "Pas assez d'argent." }; av.money -= it.price; av.stats.spent = (av.stats.spent ?? 0) + it.price; w.stash[def] = (w.stash[def] ?? 0) + 1;
  w.emitLog(`Vous commandez : ${it.label.toLowerCase()} (${it.price} €), livré dans votre inventaire.`, 'info', av.id); return { ok: true, msg: `${it.label} acheté (${it.price} €). Posez-le dans l'appartement.` };
}
export function place(w: World, def: string, x: number, y: number): { ok: boolean; msg: string } {
  if ((w.stash[def] ?? 0) <= 0) return { ok: false, msg: 'Vous n\'en avez pas.' }; const d = FURN[def]; if (!d) return { ok: false, msg: 'Inconnu.' };
  const bad = check(w, { w: d.w, d: d.d, blocks: d.blocks }, x, y, -1); if (bad) return { ok: false, msg: bad };
  const f = w.furn.find((g) => g.gone && g.def === def) ?? w.addFurn(def, x, y); const ox = f.x, oy = f.y, og = !!f.gone; f.x = x; f.y = y; f.gone = false; w.reindexFurniture();
  if (!reachable(w)) { revert(w, f, ox, oy, og || f.i >= w.baseFurn); return { ok: false, msg: 'Cela bloquerait un accès.' }; }
  w.stash[def]--; w.hist.push({ t: 'place', i: f.i, to: [x, y] }); w.redo = []; Quests.emit(w, 'furn_placed'); w.emitLog(`Vous posez : ${label(def)}.`, 'info', w.avatar.id); return { ok: true, msg: `${label(def)} posé.` };
}

const rawMove = (w: World, i: number, x: number, y: number) => { const f = w.furn[i]; const ox = f.x, oy = f.y; f.x = x; f.y = y; w.reindexFurniture(); if (!reachable(w)) { revert(w, f, ox, oy, !!f.gone); return false; } return true; };
/** Rotation : cycle d'orientations des meubles qui en ont (lits : 2 sens ; chaises : 4 sens). Les autres meubles n'ont qu'un sprite pour l'instant. */
export const ROT: Record<string, string> = { bed_y: 'bed_yw', bed_yw: 'bed_y', chair_s: 'chair_e', chair_e: 'chair_n', chair_n: 'chair_w', chair_w: 'chair_s' };
export const canRotate = (def: string) => def in ROT;
function setDef(w: World, i: number, def: string) { const f = w.furn[i]; const d = FURN[def]; f.def = def; f.w = d.w; f.d = d.d; f.slots = d.slots; f.users = d.slots.map(() => -1); w.reindexFurniture(); }
export function rotate(w: World, i: number): { ok: boolean; msg: string } {
  const f = w.furn[i]; if (!f || !isMovable(f)) return { ok: false, msg: 'Ce meuble ne peut pas être manipulé.' }; const to = ROT[f.def]; if (!to) return { ok: false, msg: `${label(f.def)} : une seule orientation pour l'instant.` };
  const from = f.def; const d = FURN[to]; const bad = check(w, { w: d.w, d: d.d, blocks: d.blocks }, f.x, f.y, i); if (bad) return { ok: false, msg: bad };
  setDef(w, i, to); if (!reachable(w)) { setDef(w, i, from); return { ok: false, msg: 'Cela bloquerait un accès.' }; }
  w.hist.push({ t: 'rot', i, from, to }); w.redo = []; return { ok: true, msg: `${label(f.def)} pivoté.` };
}
/** Annule la dernière modification d'aménagement. */
export function undo(w: World): { ok: boolean; msg: string } {
  const op = w.hist.pop(); if (!op) return { ok: false, msg: 'Rien à annuler.' }; const f = w.furn[op.i]; let ok = true;
  if (op.t === 'rot') setDef(w, op.i, op.from);
  else if (op.t === 'move') ok = rawMove(w, op.i, op.from[0], op.from[1]);
  else if (op.t === 'stash') { f.gone = false; f.x = op.from[0]; f.y = op.from[1]; w.stash[f.def] = Math.max(0, (w.stash[f.def] ?? 0) - 1); w.reindexFurniture(); }
  else { f.gone = true; w.stash[f.def] = (w.stash[f.def] ?? 0) + 1; w.reindexFurniture(); }
  if (!ok) { w.hist.push(op); return { ok: false, msg: 'Impossible : la place est prise.' }; } w.redo.push(op); return { ok: true, msg: 'Modification annulée.' };
}
export function redo(w: World): { ok: boolean; msg: string } {
  const op = w.redo.pop(); if (!op) return { ok: false, msg: 'Rien à rétablir.' }; const f = w.furn[op.i]; let ok = true;
  if (op.t === 'rot') setDef(w, op.i, op.to);
  else if (op.t === 'move') ok = rawMove(w, op.i, op.to[0], op.to[1]);
  else if (op.t === 'stash') { f.gone = true; w.stash[f.def] = (w.stash[f.def] ?? 0) + 1; w.reindexFurniture(); }
  else { f.gone = false; f.x = op.to[0]; f.y = op.to[1]; w.stash[f.def] = Math.max(0, (w.stash[f.def] ?? 0) - 1); w.reindexFurniture(); }
  if (!ok) { w.redo.push(op); return { ok: false, msg: 'Impossible : la place est prise.' }; } w.hist.push(op); return { ok: true, msg: 'Modification rétablie.' };
}
