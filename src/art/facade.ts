/** Façades extérieures de la ville (composants réutilisables) : matériaux, étages, vitrines, fenêtres, balcons, usure.
 *  Tout est décrit par une `ExtSpec` ; `drawExterior` dessine, `panes` donne les vitres (réutilisées pour les fenêtres éclairées de nuit). */
import { hash2, mix, shade, type C } from './core';
const c = (r: number, g: number, b: number): C => [r, g, b];

export type Material = 'brick' | 'concrete' | 'plaster' | 'cream' | 'blue' | 'deco' | 'seaside';
export type Pane = 'none' | 'shop' | 'win';
export interface ExtSpec {
  m: Material; k: 'store' | 'cafe' | 'bar' | 'police' | 'apartment' | 'home';
  pane: Pane; v: number; /** variante (déterministe par cellule) */
  floors: number; /** nombre d'étages visibles */
  poster: number; /** 0 = rien ; sinon motif d'affiche / tag */
  cell: number; /** index de la cellule le long de la façade (rythme, usure) */
  awning: number; /** couleur de store (variante) */
}
export interface PaneRect { u0: number; u1: number; zb: number; zt: number; shop: boolean }
export type FP = (a: number, b: number, zb: number, zt: number, col: C, al?: number) => void;

const AWN: [C, C][] = [[c(0.78, 0.2, 0.22), c(0.95, 0.92, 0.88)], [c(0.2, 0.45, 0.62), c(0.95, 0.92, 0.88)], [c(0.25, 0.55, 0.36), c(0.95, 0.92, 0.88)], [c(0.9, 0.62, 0.15), c(0.98, 0.95, 0.85)]];
const SHUT: C[] = [c(0.28, 0.5, 0.4), c(0.3, 0.42, 0.62), c(0.58, 0.3, 0.26), c(0.5, 0.5, 0.52)];
const CURT: C[] = [c(0.95, 0.9, 0.78), c(0.86, 0.5, 0.5), c(0.6, 0.72, 0.9), c(0.7, 0.85, 0.65)];

/** Hauteur de la bande de sol (plinthe/vitrine) et des étages. */
export function storeys(h: number, k: ExtSpec['k']) {
  const floors = k === 'apartment' ? (h >= 130 ? 3 : 2) : k === 'home' ? (h >= 90 ? 2 : 1) : k === 'police' ? (h >= 100 ? 2 : 1) : 1;
  const top = h - 8; const sh = (top - 6) / floors; return { floors, sh };
}

/** Rectangles de vitre d'une façade (u : 0-1 le long de la cellule ; z : hauteur) */
export function panes(spec: ExtSpec, h: number): PaneRect[] {
  const out: PaneRect[] = [];
  if (spec.pane === 'shop') { out.push({ u0: 0.08, u1: 0.92, zb: 6, zt: Math.min(h * 0.55, h - 22), shop: true }); return out; }
  if (spec.pane === 'win') {
    const { floors, sh } = storeys(h, spec.k);
    for (let f = 0; f < floors; f++) { const zb = 6 + f * sh + sh * 0.3, zt = 6 + f * sh + sh * 0.84; out.push({ u0: 0.24, u1: 0.76, zb: spec.k === 'store' || spec.k === 'cafe' || spec.k === 'bar' ? Math.max(zb, h * 0.34) : zb, zt: spec.k === 'store' || spec.k === 'cafe' || spec.k === 'bar' ? Math.min(zt, h * 0.82) : zt, shop: false }); }
  }
  return out;
}

function brick(fp: FP, h: number, base: C, cell: number) {
  fp(0, 1, 0, h, base);
  for (let z = 3, r = 0; z < h; z += 4, r++) { fp(0, 1, z, z + 0.6, shade(base, -0.2)); const off = r % 2 ? 0.125 : 0; for (let u = off; u < 1; u += 0.25) fp(u, u + 0.012, z - 4, z, shade(base, -0.16)); }
  for (let r = 0; r < 6; r++) { const u = hash2(cell, r, 5), z = 8 + hash2(cell, r, 9) * (h - 20); fp(u, Math.min(1, u + 0.18), z, z + 3.4, shade(base, hash2(cell, r, 3) > 0.5 ? 0.08 : -0.1), 0.9); }
}
function plaster(fp: FP, h: number, base: C, cell: number) {
  fp(0, 1, 0, h, base);
  for (let i = 0; i < 10; i += 2) fp(i / 10, (i + 1) / 10, 0, h, shade(base, 0.02));
  for (let r = 0; r < 4; r++) { const u = hash2(cell, r, 11) * 0.7, z = hash2(cell, r, 13) * (h - 20) + 8; fp(u, u + 0.2, z, z + 7, shade(base, -0.05), 0.8); }
}
function concrete(fp: FP, h: number, base: C, cell: number) {
  fp(0, 1, 0, h, base);
  for (let z = 22; z < h; z += 22) fp(0, 1, z, z + 0.8, shade(base, -0.16));
  fp(0, 0.015, 0, h, shade(base, -0.16)); fp(0.985, 1, 0, h, shade(base, -0.16));
  for (let r = 0; r < 3; r++) { const u = hash2(cell, r, 17) * 0.8, z = hash2(cell, r, 19) * (h - 30) + 6; fp(u, u + 0.12, z, z + 12, shade(base, -0.07), 0.8); }
}

/** Art déco californien : pilastres, couronnement en gradins, frise en chevrons turquoise. */
function deco(fp: FP, h: number, base: C, cell: number) {
  fp(0, 1, 0, h, base);
  const acc = c(0.2, 0.62, 0.62), gold = c(0.92, 0.76, 0.34);
  for (const u of [0.02, 0.49]) { fp(u, u + 0.07, 6, h - 12, shade(base, 0.14)); fp(u + 0.07, u + 0.09, 6, h - 12, shade(base, -0.2)); }
  fp(0, 1, h - 20, h - 14, acc); for (let u = 0; u < 1; u += 0.125) { fp(u, u + 0.0625, h - 20, h - 17, shade(acc, 0.22)); fp(u + 0.0625, u + 0.125, h - 17, h - 14, shade(acc, 0.22)); }
  fp(0, 1, h - 21, h - 20, gold);
  fp(0.1, 0.9, h - 3, h + 3, shade(base, 0.28)); fp(0.25, 0.75, h + 3, h + 7, shade(base, 0.34)); fp(0.4, 0.6, h + 7, h + 10, gold);
  for (let r = 0; r < 3; r++) { const u = hash2(cell, r, 31) * 0.7, z = hash2(cell, r, 33) * (h - 40) + 10; fp(u, u + 0.16, z, z + 5, shade(base, -0.05), 0.7); }
}
/** Architecture balnéaire : bandes horizontales pastel et frise de festons. */
function seaside(fp: FP, h: number, base: C, cell: number) {
  fp(0, 1, 0, h, base);
  for (let z = 6, i = 0; z < h - 10; z += 14, i++) { fp(0, 1, z, z + 7, i % 2 ? c(0.96, 0.95, 0.9) : c(0.42, 0.78, 0.84)); fp(0, 1, z + 7, z + 8, shade(base, -0.25)); }
  for (let u = 0; u < 1; u += 0.125) fp(u, u + 0.1, h - 14, h - 9, c(0.98, 0.62, 0.55));
  for (let r = 0; r < 3; r++) { const u = hash2(cell, r, 41) * 0.7, z = hash2(cell, r, 43) * (h - 40) + 10; fp(u, u + 0.12, z, z + 4, shade(base, 0.08), 0.8); }
}

function windowFrame(fp: FP, p: PaneRect, v: number, night: boolean) {
  const frame = c(0.95, 0.94, 0.9), dark = c(0.22, 0.24, 0.3);
  fp(p.u0 - 0.04, p.u1 + 0.04, p.zb - 1, p.zt + 1, frame); fp(p.u0, p.u1, p.zb + 1, p.zt - 1, dark);
  const bands = 5, gb = p.zb + 1, gt = p.zt - 1;
  for (let k = 0; k < bands; k++) fp(p.u0 + 0.03, p.u1 - 0.03, gb + ((gt - gb) * k) / bands, gb + ((gt - gb) * (k + 1)) / bands, night ? c(0.2, 0.26, 0.38) : mix(c(0.82, 0.93, 0.99), c(0.5, 0.74, 0.92), k / (bands - 1)));
  fp(p.u0 + 0.03, p.u0 + 0.14, gt - 7, gt - 2, c(1, 1, 1), 0.55);
  fp((p.u0 + p.u1) / 2 - 0.012, (p.u0 + p.u1) / 2 + 0.012, gb, gt, frame); fp(p.u0 + 0.03, p.u1 - 0.03, (gb + gt) / 2 - 0.5, (gb + gt) / 2 + 0.5, frame);
  fp(p.u0 - 0.07, p.u1 + 0.07, p.zb - 3, p.zb - 1, c(0.72, 0.68, 0.62));
  const m = v % 4;
  if (m === 0) { fp(p.u0 + 0.03, p.u0 + 0.2, gb, gt, CURT[(v >> 2) % 4], 0.85); fp(p.u1 - 0.2, p.u1 - 0.03, gb, gt, CURT[(v >> 2) % 4], 0.85); }
  else if (m === 1) { const sc = SHUT[(v >> 2) % 4]; fp(p.u0 - 0.2, p.u0 - 0.04, p.zb - 1, p.zt + 1, sc); fp(p.u1 + 0.04, p.u1 + 0.2, p.zb - 1, p.zt + 1, sc); for (let z = p.zb + 2; z < p.zt; z += 3) { fp(p.u0 - 0.2, p.u0 - 0.04, z, z + 0.6, shade(sc, -0.25)); fp(p.u1 + 0.04, p.u1 + 0.2, z, z + 0.6, shade(sc, -0.25)); } }
  else if (m === 2) { fp(p.u0 - 0.05, p.u1 + 0.05, p.zb - 6, p.zb - 3, c(0.45, 0.3, 0.2)); for (let u = p.u0; u < p.u1; u += 0.09) fp(u, u + 0.06, p.zb - 8, p.zb - 6, [c(0.9, 0.3, 0.35), c(0.98, 0.8, 0.3), c(0.35, 0.7, 0.4)][Math.floor(u * 17) % 3]); }
  else { fp(p.u0 + 0.02, p.u1 - 0.02, gt - 5, gt - 1, c(0.82, 0.84, 0.9), 0.9); fp(p.u0 + 0.28, p.u0 + 0.5, p.zb - 6, p.zb - 1, c(0.8, 0.82, 0.86)); fp(p.u0 + 0.3, p.u0 + 0.48, p.zb - 5, p.zb - 2, c(0.5, 0.52, 0.56)); } /* clim */
}

function storefront(fp: FP, h: number, spec: ExtSpec, p: PaneRect) {
  const frame = c(0.18, 0.15, 0.17);
  fp(0.03, 0.97, 0, p.zt + 2, frame); fp(0.06, 0.94, p.zb, p.zt, c(0.62, 0.8, 0.88));
  // marchandises derrière la vitre
  const k = spec.k;
  for (let i = 0; i < 4; i++) {
    const u0 = 0.1 + i * 0.2, hh = 5 + hash2(spec.cell, i, 3) * 8;
    const col = k === 'bar' ? [c(0.8, 0.5, 0.2), c(0.3, 0.6, 0.35), c(0.7, 0.2, 0.3)][i % 3] : k === 'cafe' ? [c(0.92, 0.84, 0.7), c(0.8, 0.5, 0.35), c(0.95, 0.9, 0.8)][i % 3] : [c(0.9, 0.4, 0.3), c(0.95, 0.8, 0.3), c(0.4, 0.65, 0.9), c(0.5, 0.8, 0.45)][i % 4];
    fp(u0, u0 + 0.14, p.zb + 3, p.zb + 3 + hh, col); fp(u0, u0 + 0.14, p.zb + 3 + hh, p.zb + 4 + hh, shade(col, 0.25));
  }
  fp(0.06, 0.94, p.zb + 2, p.zb + 3, c(0.5, 0.36, 0.26)); // tablette
  fp(0.1, 0.3, p.zt - 8, p.zt - 1, c(1, 1, 1), 0.45); fp(0.49, 0.51, p.zb, p.zt, frame);
  // soubassement
  fp(0.03, 0.97, 0, p.zb, shade(frame, 0.1)); fp(0.03, 0.97, p.zb - 1, p.zb, c(0.7, 0.66, 0.6));
  // store à festons au-dessus de la vitrine
  const [a, b] = AWN[spec.awning % 4]; const za = p.zt + 2, zt = Math.min(h - 8, za + 9);
  for (let s = 0; s < 6; s++) { const u0 = s / 6, u1 = (s + 1) / 6; fp(u0, u1, za, zt, s % 2 ? b : a); fp(u0, u1, za - 2, za, s % 2 ? b : a); fp(u0 + 0.02, u1 - 0.02, za - 3, za - 2, s % 2 ? b : a); }
  fp(0, 1, zt, zt + 1.4, shade(a, -0.35));
}

/** Corps de la façade ; renvoie sans dessiner d'ouvertures si `pane` vaut « none ». */
export function drawExterior(fp: FP, h: number, base: C, spec: ExtSpec, night = false) {
  switch (spec.m) { case 'brick': brick(fp, h, base, spec.cell); break; case 'concrete': concrete(fp, h, base, spec.cell); break; case 'deco': deco(fp, h, base, spec.cell); break; case 'seaside': seaside(fp, h, base, spec.cell); break; default: plaster(fp, h, base, spec.cell); }
  // plinthe, bandeau d'étage, corniche
  fp(0, 1, 0, 5, shade(base, -0.22)); fp(0, 1, 5, 6, shade(base, 0.12)); fp(0, 1, 0, 1, c(0.2, 0.2, 0.22), 0.5);
  const { floors, sh } = storeys(h, spec.k);
  for (let f = 1; f < floors; f++) { const z = 6 + f * sh - 3; fp(0, 1, z, z + 3, shade(base, 0.2)); fp(0, 1, z - 1, z, shade(base, -0.28)); }
  fp(0, 1, h - 7, h - 3, shade(base, 0.2)); fp(0, 1, h - 3, h, shade(base, 0.32)); fp(0, 1, h - 8, h - 7, shade(base, -0.3));
  for (let d = 0; d < 8; d++) fp(d / 8 + 0.01, d / 8 + 0.06, h - 10, h - 8, shade(base, 0.12));
  // ouvertures
  const ps = panes(spec, h);
  if (spec.pane === 'shop') storefront(fp, h, spec, ps[0]);
  else if (spec.pane === 'win') {
    ps.forEach((p, i) => windowFrame(fp, p, spec.v + i * 5, night));
    if ((spec.k === 'apartment') && floors > 1 && spec.v % 3 === 0) { // balcon à l'étage
      const p = ps[ps.length - 1]; fp(0.12, 0.88, p.zb - 8, p.zb - 3, shade(base, 0.3)); fp(0.12, 0.88, p.zb - 3, p.zb - 2, shade(base, -0.4));
      for (let u = 0.14; u < 0.88; u += 0.1) fp(u, u + 0.02, p.zb - 3, p.zb + 7, c(0.15, 0.16, 0.2)); fp(0.12, 0.88, p.zb + 7, p.zb + 8.4, c(0.15, 0.16, 0.2));
    }
  } else {
    // pan de mur plein : affiche, tag, tuyau, boîtier — évite la répétition
    const q = spec.poster;
    if (q === 1) { fp(0.3, 0.7, 22, 46, c(0.95, 0.9, 0.7)); fp(0.34, 0.66, 26, 42, [c(0.85, 0.25, 0.3), c(0.25, 0.5, 0.8), c(0.3, 0.7, 0.4)][spec.v % 3]); fp(0.4, 0.6, 31, 33, c(1, 1, 1), 0.8); }
    else if (q === 2) { for (let k2 = 0; k2 < 5; k2++) fp(0.2 + k2 * 0.12, 0.28 + k2 * 0.12, 14 + (k2 % 2) * 5, 20 + (k2 % 3) * 6, [c(0.95, 0.25, 0.65), c(0.3, 0.9, 0.9), c(0.98, 0.85, 0.2)][k2 % 3]); }
    else if (q === 3) { fp(0.82, 0.88, 6, h - 8, shade(base, -0.35)); fp(0.8, 0.9, h * 0.5, h * 0.5 + 2, shade(base, -0.5)); }
    else if (q === 4) { fp(0.3, 0.7, 20, 36, c(0.38, 0.4, 0.44)); fp(0.33, 0.67, 23, 33, c(0.22, 0.24, 0.28)); fp(0.45, 0.55, 26, 28, c(0.9, 0.2, 0.2)); }
  }
}
