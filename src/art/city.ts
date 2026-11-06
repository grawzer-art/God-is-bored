/** Art de la ville : toits d'immeubles, enseignes. Assets PROVISOIRES procéduraux (même esprit pixel art isométrique que le reste). */
import { c, canvas, crisp, ctx2, hash2, line, poly, shade, type C } from './core';

const hex = (h: string): C => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
const cache = new Map<string, { cv: HTMLCanvasElement; ox: number; oy: number }>();

export type RoofStyle = 'flat' | 'hip';
/** Annonces satiriques (toits, panneaux) : originales, sans marque réelle. */
export const ADS: { l1: string; l2: string; bg: string; fg: string }[] = [
  { l1: 'PURGATOIRE™', l2: 'vos péchés, notre métier', bg: '#2a1f4a', fg: '#ffd84a' },
  { l1: 'BANQUE DU DERNIER', l2: 'JUGEMENT — 0 % d\'espoir', bg: '#113a2e', fg: '#9bffd0' },
  { l1: 'ME GRIPPE, AVOCAT', l2: 'coupable ? pas chez nous', bg: '#4a1a1a', fg: '#ffe3c0' },
  { l1: 'SOUPE BÉNIE™', l2: 'garantie sans miracle', bg: '#1c3d5c', fg: '#fff2a8' },
  { l1: 'DIVINE ASSURANCE', l2: 'en cas de déluge, appelez', bg: '#5a1d4d', fg: '#ffd0f0' },
  { l1: 'CLINIQUE DU REPENTIR', l2: 'premier aveu offert', bg: '#25425a', fg: '#d6fff2' },
];
/** Panneau publicitaire : texte sur un plan vertical incliné (face sud-ouest). */
export function adCanvas(ad: number, w = 128, h = 40): HTMLCanvasElement {
  const A = ADS[ad % ADS.length]; const cv = canvas(w, h); const g = ctx2(cv); g.fillStyle = A.bg; g.fillRect(0, 0, w, h); g.fillStyle = A.fg; g.fillRect(0, 0, w, 2); g.fillRect(0, h - 2, w, 2);
  g.textBaseline = 'top'; g.font = 'bold 11px sans-serif'; g.fillText(A.l1, 6, 7, w - 12); g.font = '8px sans-serif'; g.globalAlpha = 0.9; g.fillText(A.l2, 6, 23, w - 12); return cv;
}

/** Toit d'un bâtiment de w x d cases : retourne le canevas et le décalage de son coin haut-gauche par rapport à toScreen(x0, y0) (au niveau du sol, avant d'ajouter la hauteur). */
export function roofCanvas(w: number, d: number, colorHex: string, seed: number, style: RoofStyle = 'flat', extras = 'ac', ad = -1): { cv: HTMLCanvasElement; ox: number; oy: number } {
  const key = `${w}|${d}|${colorHex}|${seed}|${style}|${extras}|${ad}`; const hit = cache.get(key); if (hit) return hit;
  const base = hex(colorHex); const PAD = style === 'hip' ? Math.min(w, d) * 9 + 8 : 8 + (ad >= 0 ? 52 : 0) + (extras === 'mast' ? 30 : 0) + (extras === 'tank' ? 18 : 0) + (extras === 'terrace' ? 14 : 0);
  const P = (x: number, y: number, z = 0) => ({ x: (x - y) * 32 + d * 32 + 4, y: (x + y) * 16 + 4 + PAD - z });
  const cv = canvas((w + d) * 32 + 8, (w + d) * 16 + 14 + PAD); const g = ctx2(cv);
  const lo = shade(base, -0.28), hi = shade(base, 0.16), mid = base;
  if (style === 'hip') {
    // toit à quatre pans : avant-toit, tuiles en rangées, faîtage, cheminées
    const o = 0.3, ph = Math.min(w, d) * 9; const rx0 = Math.min(w, d) / 2, rx1 = w - Math.min(w, d) / 2, ry = d / 2;
    const A = P(-o, -o), B = P(w + o, -o), C2 = P(w + o, d + o), D = P(-o, d + o); const R1 = P(rx0, ry, ph), R2 = P(rx1, ry, ph);
    poly(g, [A, B, R2, R1], shade(mid, -0.18)); poly(g, [A, D, R1], shade(mid, -0.1));
    poly(g, [D, C2, R2, R1], mid); poly(g, [C2, B, R2], shade(mid, -0.24));
    // rangées de tuiles sur les deux pans visibles
    const rows = 9; for (let i = 1; i < rows; i++) { const t = i / rows; line(g, { x: D.x + (R1.x - D.x) * t, y: D.y + (R1.y - D.y) * t }, { x: C2.x + (R2.x - C2.x) * t, y: C2.y + (R2.y - C2.y) * t }, shade(mid, i % 2 ? -0.16 : 0.08), 0.8); line(g, { x: C2.x + (R2.x - C2.x) * t, y: C2.y + (R2.y - C2.y) * t }, { x: B.x + (R2.x - B.x) * t, y: B.y + (R2.y - B.y) * t }, shade(mid, -0.34), 0.7); }
    line(g, D, C2, shade(mid, -0.4)); line(g, C2, B, shade(mid, -0.5)); line(g, R1, R2, hi); line(g, D, R1, hi, 0.8);
    for (let k = 0; k < Math.max(1, Math.floor(w / 9)); k++) { // cheminées
      const cx = 2 + hash2(seed + k, 5) * (w - 6), cy = d * 0.58; const b0 = P(cx, cy, ph * 0.5), h = 16; const bw = 20;
      poly(g, [{ x: b0.x - bw / 2, y: b0.y }, { x: b0.x + bw / 2, y: b0.y }, { x: b0.x + bw / 2, y: b0.y - h }, { x: b0.x - bw / 2, y: b0.y - h }], c(0.58, 0.34, 0.3)); poly(g, [{ x: b0.x + 2, y: b0.y }, { x: b0.x + bw / 2, y: b0.y }, { x: b0.x + bw / 2, y: b0.y - h }, { x: b0.x + 2, y: b0.y - h }], c(0.42, 0.24, 0.22));
      poly(g, [{ x: b0.x - bw / 2 - 1, y: b0.y - h }, { x: b0.x + bw / 2 + 1, y: b0.y - h }, { x: b0.x + bw / 2 + 1, y: b0.y - h - 3 }, { x: b0.x - bw / 2 - 1, y: b0.y - h - 3 }], c(0.3, 0.3, 0.34));
    }
    for (let k = 0; k < 3; k++) { const lx = 3 + hash2(seed + k, 9) * (w - 8); const s0 = P(lx, d - 1.6, 5), sw = 22; poly(g, [{ x: s0.x - sw / 2, y: s0.y }, { x: s0.x + sw / 2, y: s0.y - 4 }, { x: s0.x + sw / 2, y: s0.y - 14 }, { x: s0.x - sw / 2, y: s0.y - 10 }], c(0.62, 0.8, 0.9)); }
    crisp(cv, 0.05); const out = { cv, ox: 0, oy: -PAD }; cache.set(key, out); return out;
  }
  // toit plat : corniche (épaisseur), dalle gravillonnée, acrotère, équipements
  poly(g, [P(0, d), P(w, d), { x: P(w, d).x, y: P(w, d).y + 6 }, { x: P(0, d).x, y: P(0, d).y + 6 }], lo);
  poly(g, [P(w, 0), P(w, d), { x: P(w, d).x, y: P(w, d).y + 6 }, { x: P(w, 0).x, y: P(w, 0).y + 6 }], shade(lo, -0.12));
  poly(g, [P(0, 0), P(w, 0), P(w, d), P(0, d)], mid);
  poly(g, [P(0.18, 0.18), P(w - 0.18, 0.18), P(w - 0.18, d - 0.18), P(0.18, d - 0.18)], shade(mid, 0.06));
  for (let i = 1; i < w; i++) line(g, P(i, 0.18), P(i, d - 0.18), shade(mid, -0.1), 0.55);
  for (let j = 1; j < d; j++) line(g, P(0.18, j), P(w - 0.18, j), shade(mid, -0.06), 0.4);
  // flaques, rapiéçages et salissures (usure)
  for (let k = 0; k < Math.floor(w * d / 10); k++) { const px0 = 0.6 + hash2(seed + k, 21) * (w - 1.6), py0 = 0.6 + hash2(seed + k, 23) * (d - 1.6); poly(g, [P(px0, py0), P(px0 + 0.9, py0), P(px0 + 0.9, py0 + 0.6), P(px0, py0 + 0.6)], shade(mid, hash2(seed + k, 25) > 0.5 ? -0.14 : 0.12), 0.75); }
  // acrotère : face intérieure des bords nord et ouest (plus claire), chaperon, gravillon
  poly(g, [P(0, 0), P(w, 0), P(w, 0.18), P(0, 0.18)], shade(mid, 0.28)); poly(g, [P(0, 0), P(0, d), P(0.18, d), P(0.18, 0)], shade(mid, 0.12));
  for (let k = 0; k < w * d * 5; k++) { const gx = 0.3 + hash2(seed + k, 31) * (w - 0.6), gy = 0.3 + hash2(seed + k, 33) * (d - 0.6); const q = P(gx, gy); g.fillStyle = hash2(seed + k, 35) > 0.5 ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.12)'; g.fillRect(Math.round(q.x), Math.round(q.y), 2, 1); }
  line(g, P(0, 0), P(w, 0), hi); line(g, P(0, 0), P(0, d), hi); line(g, P(w, 0), P(w, d), lo); line(g, P(0, d), P(w, d), lo);
  const n = Math.max(1, Math.floor((w * d) / 14));
  const box = (bx: number, by: number, bw: number, bd: number, bh: number, col: C) => {
    const A = P(bx, by), B = P(bx + bw, by), C2 = P(bx + bw, by + bd), D = P(bx, by + bd); const up = (q: { x: number; y: number }) => ({ x: q.x, y: q.y - bh });
    poly(g, [D, C2, up(C2), up(D)], shade(col, -0.12)); poly(g, [B, C2, up(C2), up(B)], shade(col, -0.3)); poly(g, [up(A), up(B), up(C2), up(D)], shade(col, 0.1));
  };
  for (let k = 0; k < n; k++) { const bx = 0.8 + hash2(seed + k, 3) * (w - 2.2), by = 0.8 + hash2(seed + k, 7) * (d - 2.2); box(bx, by, 0.9, 0.7, 7, c(0.7, 0.72, 0.76)); line(g, { x: P(bx, by + 0.7).x, y: P(bx, by + 0.7).y - 7 }, { x: P(bx + 0.9, by + 0.7).x, y: P(bx + 0.9, by + 0.7).y - 7 }, c(0.95, 0.96, 0.98), 0.5); }
  box(w - 2.4, 0.7, 1.3, 1.2, 9, shade(mid, 0.1)); // sortie d'escalier
  if (extras === 'tank') { const t = P(1.6, d - 2.2); for (let k = 0; k < 2; k++) { const tx = t.x + k * 22, ty = t.y; poly(g, [{ x: tx - 8, y: ty }, { x: tx + 8, y: ty }, { x: tx + 8, y: ty - 18 }, { x: tx - 8, y: ty - 18 }], c(0.55, 0.38, 0.28)); poly(g, [{ x: tx + 2, y: ty }, { x: tx + 8, y: ty }, { x: tx + 8, y: ty - 18 }, { x: tx + 2, y: ty - 18 }], c(0.4, 0.27, 0.2)); poly(g, [{ x: tx - 9, y: ty - 18 }, { x: tx, y: ty - 25 }, { x: tx + 9, y: ty - 18 }], c(0.3, 0.3, 0.34)); } }
  if (extras === 'terrace') { // rooftop d'hôtel : deck bois, piscine, parasols, transats, garde-corps vitré
    const deck = c(0.62, 0.46, 0.3); poly(g, [P(0.6, 0.6), P(w - 0.6, 0.6), P(w - 0.6, d - 0.6), P(0.6, d - 0.6)], deck);
    for (let i = 1; i < w - 1; i++) line(g, P(i, 0.6), P(i, d - 0.6), shade(deck, -0.14), 0.5);
    const px0 = 1.6, py0 = 1.4, pw = Math.min(5, w - 4), pd = Math.min(3, d - 3); poly(g, [P(px0 - 0.2, py0 - 0.2), P(px0 + pw + 0.2, py0 - 0.2), P(px0 + pw + 0.2, py0 + pd + 0.2), P(px0 - 0.2, py0 + pd + 0.2)], c(0.9, 0.92, 0.95)); poly(g, [P(px0, py0), P(px0 + pw, py0), P(px0 + pw, py0 + pd), P(px0, py0 + pd)], c(0.25, 0.75, 0.9));
    for (let k = 0; k < 4; k++) { const a = P(px0 + 0.4 + k * (pw / 4), py0 + 0.4 + (k % 2) * 0.8); line(g, a, { x: a.x + 5, y: a.y + 1 }, c(0.8, 0.95, 1), 0.7); }
    for (let k = 0; k < 3; k++) { const u = P(w - 2.6 + (k % 2) * 0.1, 1.4 + k * 1.3); line(g, u, { x: u.x, y: u.y - 16 }, c(0.9, 0.9, 0.9)); poly(g, [{ x: u.x - 11, y: u.y - 16 }, { x: u.x + 11, y: u.y - 16 }, { x: u.x + 6, y: u.y - 22 }, { x: u.x - 6, y: u.y - 22 }], [c(0.95, 0.4, 0.4), c(0.98, 0.8, 0.35), c(0.35, 0.75, 0.85)][k]); const l = P(w - 3.8, 1.4 + k * 1.3); poly(g, [{ x: l.x - 8, y: l.y }, { x: l.x + 8, y: l.y + 3 }, { x: l.x + 8, y: l.y - 1 }, { x: l.x - 8, y: l.y - 4 }], c(0.96, 0.96, 0.98)); }
    line(g, P(0.2, d - 0.2), P(w - 0.2, d - 0.2), c(0.6, 0.9, 0.95)); line(g, P(w - 0.2, 0.2), P(w - 0.2, d - 0.2), c(0.6, 0.9, 0.95)); line(g, P(w / 2 - 2, d - 0.5), P(w / 2 + 2, d - 0.5), c(1, 0.45, 0.8));
  }
  if (extras === 'mast') { const m = P(w * 0.5, d * 0.5); line(g, m, { x: m.x, y: m.y - 38 }, c(0.8, 0.82, 0.86)); for (let k = 0; k < 3; k++) line(g, { x: m.x - 8 + k, y: m.y - 14 - k * 8 }, { x: m.x + 8 - k, y: m.y - 14 - k * 8 }, c(0.8, 0.82, 0.86)); poly(g, [{ x: m.x - 1, y: m.y - 42 }, { x: m.x + 2, y: m.y - 42 }, { x: m.x + 2, y: m.y - 39 }, { x: m.x - 1, y: m.y - 39 }], c(0.95, 0.2, 0.2)); }
  if (ad >= 0) { // panneau publicitaire sur pieds, face sud-ouest
    const bw = Math.min(5, w - 3), a0 = P(1.4, d - 0.9), a1 = P(1.4 + bw, d - 0.9); const hb = 28, z0 = 12; const ac = adCanvas(ad, 128, 40);
    line(g, { x: a0.x + 6, y: a0.y }, { x: a0.x + 6, y: a0.y - z0 }, c(0.25, 0.26, 0.3)); line(g, { x: a1.x - 6, y: a1.y }, { x: a1.x - 6, y: a1.y - z0 }, c(0.25, 0.26, 0.3));
    g.save(); const sx = (a1.x - a0.x) / 128, sy = (a1.y - a0.y) / 128; g.transform(sx, sy, 0, hb / 40, a0.x, a0.y - z0 - hb); g.imageSmoothingEnabled = false; g.drawImage(ac, 0, 0); g.restore();
    line(g, { x: a0.x, y: a0.y - z0 - hb }, { x: a1.x, y: a1.y - z0 - hb }, c(0.9, 0.9, 0.94)); line(g, { x: a0.x, y: a0.y - z0 }, { x: a1.x, y: a1.y - z0 }, c(0.2, 0.2, 0.24));
  }
  crisp(cv, 0.04); const out = { cv, ox: 0, oy: -PAD }; cache.set(key, out); return out;
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
