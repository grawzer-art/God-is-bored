/** Déplacement et visibilité : fonctions pures (sans rendu ni interface), réutilisables pour l'avatar, les PNJ, les véhicules…
 *  Repère : la grille (x, y) de la carte ; l'écran isométrique est tourné de 45° par rapport à elle. */
import type { V2 } from './defs';
import * as L from './layout';

export interface Walkable { isWalkable(cell: V2): boolean }
export const BODY_RADIUS = 0.2;

/** Direction écran (haut = -y, droite = +x) -> direction grille unitaire (isométrie : haut = (-1,-1), droite = (+1,-1)). */
export function screenDirToGrid(dx: number, dy: number): V2 {
  const gx = dx + dy, gy = dy - dx; const n = Math.hypot(gx, gy) || 1; return { x: gx / n, y: gy / n };
}
/** Le corps (carré de rayon r) tient-il en (x, y) sans toucher une case bloquée ? */
export function bodyFree(g: Walkable, x: number, y: number, r = BODY_RADIUS): boolean {
  for (const [ox, oy] of [[-r, -r], [r, -r], [-r, r], [r, r]]) if (!g.isWalkable({ x: Math.floor(x + ox), y: Math.floor(y + oy) })) return false;
  return true;
}
/** Avance de (vx, vy) en glissant le long des obstacles. `blockers` : positions de corps mobiles à ne pas chevaucher. */
export function stepBody(g: Walkable, pos: V2, vx: number, vy: number, blockers: V2[] = [], br = 0.36): V2 {
  const hit = (x: number, y: number) => blockers.some((b) => { const d = Math.hypot(b.x - x, b.y - y); return d < br && d < Math.hypot(b.x - pos.x, b.y - pos.y); });
  const nx = pos.x + vx, ny = pos.y + vy;
  if (bodyFree(g, nx, ny) && !hit(nx, ny)) return { x: nx, y: ny };
  if (bodyFree(g, nx, pos.y) && !hit(nx, pos.y)) return { x: nx, y: pos.y };
  if (bodyFree(g, pos.x, ny) && !hit(pos.x, ny)) return { x: pos.x, y: ny };
  return pos;
}
/** Aucun mur entre a et b : une interaction ne traverse pas les murs (les meubles ne bloquent pas, les portes sont des ouvertures). */
export function lineClear(a: V2, b: V2): boolean {
  const len = Math.hypot(b.x - a.x, b.y - a.y); const n = Math.max(1, Math.ceil(len / 0.1));
  for (let i = 0; i <= n; i++) { const t = i / n; if (L.isWall(Math.floor(a.x + (b.x - a.x) * t), Math.floor(a.y + (b.y - a.y) * t))) return false; }
  return true;
}
/** Segment praticable par le corps entier. */
export function segmentFree(g: Walkable, a: V2, b: V2, r = BODY_RADIUS): boolean {
  const len = Math.hypot(b.x - a.x, b.y - a.y); const n = Math.max(1, Math.ceil(len / 0.1));
  for (let i = 0; i <= n; i++) { const t = i / n; if (!bodyFree(g, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, r)) return false; }
  return true;
}
/** Raccourcit un chemin A* (centres de cases) : saute les points intermédiaires quand la ligne droite est libre. Garde le dernier point. */
export function smoothPath(g: Walkable, from: V2, path: V2[]): V2[] {
  if (path.length < 2) return path;
  const out: V2[] = []; let cur = from, i = 0;
  while (i < path.length) {
    let j = path.length - 1; while (j > i && !segmentFree(g, cur, path[j])) j--;
    out.push(path[j]); cur = path[j]; i = j + 1;
  }
  return out;
}
/** Case marchable la plus proche (anneaux croissants) ; {-1,-1} si aucune dans le rayon. */
export function nearestWalkable(g: Walkable, cell: V2, maxR = 2): V2 {
  for (let r = 0; r <= maxR; r++) {
    let best: V2 = { x: -1, y: -1 }, bd = 1e9;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const c = { x: cell.x + dx, y: cell.y + dy }; if (!g.isWalkable(c)) continue;
      const d = dx * dx + dy * dy; if (d < bd) { bd = d; best = c; }
    }
    if (best.x >= 0) return best;
  }
  return { x: -1, y: -1 };
}
