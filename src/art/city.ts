/** Art de la ville : toits d'immeubles, enseignes. Assets PROVISOIRES procéduraux (même esprit pixel art isométrique que le reste). */
import { c, canvas, crisp, ctx2, hash2, line, poly, shade, type C } from './core';

const hex = (h: string): C => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
const cache = new Map<string, { cv: HTMLCanvasElement; ox: number; oy: number }>();

/** Toit d'un bâtiment de w x d cases : retourne le canevas et le décalage de son coin haut-gauche par rapport à toScreen(x0, y0) (au niveau du sol, avant d'ajouter la hauteur). */
export function roofCanvas(w: number, d: number, colorHex: string, seed: number): { cv: HTMLCanvasElement; ox: number; oy: number } {
  const key = `${w}|${d}|${colorHex}|${seed}`; const hit = cache.get(key); if (hit) return hit;
  const base = hex(colorHex); const P = (x: number, y: number) => ({ x: (x - y) * 32 + d * 32 + 4, y: (x + y) * 16 + 4 });
  const cv = canvas((w + d) * 32 + 8, (w + d) * 16 + 14); const g = ctx2(cv);
  const lo = shade(base, -0.28), hi = shade(base, 0.16), mid = base;
  // corniche (épaisseur) puis dalle
  poly(g, [P(0, d), P(w, d), { x: P(w, d).x, y: P(w, d).y + 6 }, { x: P(0, d).x, y: P(0, d).y + 6 }], lo);
  poly(g, [P(w, 0), P(w, d), { x: P(w, d).x, y: P(w, d).y + 6 }, { x: P(w, 0).x, y: P(w, 0).y + 6 }], shade(lo, -0.12));
  poly(g, [P(0, 0), P(w, 0), P(w, d), P(0, d)], mid);
  poly(g, [P(0.18, 0.18), P(w - 0.18, 0.18), P(w - 0.18, d - 0.18), P(0.18, d - 0.18)], shade(mid, 0.06));
  // joints de la couverture
  for (let i = 1; i < w; i++) line(g, P(i, 0.18), P(i, d - 0.18), shade(mid, -0.1), 0.55);
  for (let j = 1; j < d; j++) line(g, P(0.18, j), P(w - 0.18, j), shade(mid, -0.06), 0.4);
  // acrotère
  line(g, P(0, 0), P(w, 0), hi); line(g, P(0, 0), P(0, d), hi); line(g, P(w, 0), P(w, d), lo); line(g, P(0, d), P(w, d), lo);
  // équipements de toit : climatiseurs / lucarnes (positions déterministes)
  const n = Math.max(1, Math.floor((w * d) / 14));
  for (let k = 0; k < n; k++) {
    const bx = 0.8 + hash2(seed + k, 3) * (w - 2.2), by = 0.8 + hash2(seed + k, 7) * (d - 2.2); const bw = 0.9, bd = 0.7, bh = 7;
    const top = shade(c(0.82, 0.84, 0.86), 0.05);
    const A = P(bx, by), B = P(bx + bw, by), C2 = P(bx + bw, by + bd), D = P(bx, by + bd); const up = (q: { x: number; y: number }) => ({ x: q.x, y: q.y - bh });
    poly(g, [D, C2, up(C2), up(D)], c(0.62, 0.64, 0.68)); poly(g, [B, C2, up(C2), up(B)], c(0.5, 0.52, 0.56)); poly(g, [up(A), up(B), up(C2), up(D)], top);
    line(g, up(D), up(C2), c(0.95, 0.96, 0.98), 0.5);
  }
  crisp(cv, 0.04); const out = { cv, ox: 0, oy: 0 }; cache.set(key, out); return out;
}

/** Linteau + enseigne au-dessus d'une porte : face sud (parallélogramme incliné) de la cellule, du haut de la porte au haut de la façade. */
export function signCanvas(h: number, wallHex: string, title: string): HTMLCanvasElement {
  const z0 = 40, cv = canvas(64, 32 + h); const g = ctx2(cv); const wall = hex(wallHex);
  const P = (x: number, z: number) => ({ x: 32 + (x - 0.65) * 32, y: h + (x + 0.65) * 16 - z });
  poly(g, [P(0, z0), P(1, z0), P(1, h), P(0, h)], shade(wall, -0.05)); line(g, P(0, h), P(1, h), shade(wall, 0.2)); line(g, P(0, z0), P(1, z0), shade(wall, -0.35));
  const b0 = z0 + 3, b1 = h - 4; poly(g, [P(0.04, b0), P(0.96, b0), P(0.96, b1), P(0.04, b1)], c(0.13, 0.12, 0.16));
  g.save(); const o = P(0.07, b1 - 1); g.transform(1, 0.5, 0, 1, o.x, o.y); g.fillStyle = '#ffe9a8'; g.font = 'bold 6px sans-serif'; g.textBaseline = 'top';
  const t = title.length > 11 ? title.slice(0, 10) + '.' : title; g.fillText(t, 0, 0, 26); g.restore(); crisp(cv, 0.03); return cv;
}
