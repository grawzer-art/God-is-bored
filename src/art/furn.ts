/** Mobilier et accessoires : boîtes isométriques, UN sprite par cellule (tri en profondeur exact). Assets PROVISOIRES procéduraux. */
import { c, canvas, crisp, ctx2, hash2, line, mix, poly, shade, type C } from './core';

export const PAD: Record<string, number> = {
  bed_y: 28, bed_yw: 28, nightstand: 34, wardrobe: 66, rug: 4, fridge: 58, counter: 38, counter_w: 38, stove: 64, sink_k: 44, table: 34,
  chair_s: 34, chair_n: 34, chair_e: 34, chair_w: 34, sofa_s: 40, armchair_e: 40, tv: 40, coffee_table: 18, bookshelf: 62, plant: 48, floor_lamp: 74,
  toilet: 34, shower: 78, sink_b: 70, bathtub: 26, washer: 40, basket: 24, bench: 22, coat_rack: 76, shoe_rack: 20, console: 50, bin: 22, altar: 40,
  back_shelf: 70, bar_counter: 44, stool: 30, jukebox: 60, bar_table: 34, streetlamp: 100, street_bench: 30, bar_sign: 104, shelf3: 62, shelf4: 62, shop_counter: 46, desk: 42, park_bench: 30, bush: 40, tree: 120, m_clothes: 12, m_book: 12, m_cup: 14, m_pizza: 12, m_trash: 16, m_dishes: 14, m_feast0: 30, m_feast1: 30, m_feast2: 30,
};
const OVERLAYS = ['shower', 'bathtub'];
const WOOD = c(0.66, 0.47, 0.3), WOOD_D = c(0.4, 0.27, 0.18), WOOD_L = c(0.82, 0.64, 0.44), WHITE = c(0.93, 0.93, 0.95), STEEL = c(0.7, 0.74, 0.78), STONE = c(0.86, 0.84, 0.8);
export const BLANKETS: C[] = [c(0.34, 0.52, 0.8), c(0.38, 0.68, 0.54), c(0.8, 0.36, 0.38), c(0.92, 0.72, 0.34)];
const RUGS: C[][] = [[c(0.62, 0.28, 0.28), c(0.9, 0.8, 0.6)], [c(0.28, 0.4, 0.58), c(0.88, 0.86, 0.78)], [c(0.3, 0.5, 0.4), c(0.92, 0.88, 0.72)], [c(0.7, 0.52, 0.28), c(0.86, 0.74, 0.56)], [c(0.35, 0.55, 0.5), c(0.93, 0.9, 0.8)], [c(0.55, 0.25, 0.3), c(0.8, 0.62, 0.45)], [c(0.3, 0.45, 0.7), c(0.85, 0.9, 0.95)], [c(0.8, 0.2, 0.6), c(0.1, 0.09, 0.2)]];

export interface FurnSprite { canvas: HTMLCanvasElement; pad: number; overlay: HTMLCanvasElement | null }
const cache = new Map<string, FurnSprite>();
let G: CanvasRenderingContext2D; let PADV = 0; let CI = 0; let CJ = 0;

export function furnSprite(def: string, style: number, i: number, j: number, w: number, d: number): FurnSprite {
  const key = `${def}|${style}|${i}|${j}|${w}|${d}`; const hit = cache.get(key); if (hit) return hit;
  const pad = PAD[def] ?? 40; const cv = canvas(64, 32 + pad); G = ctx2(cv); PADV = pad; CI = i; CJ = j;
  paint(def, style, w, d, false); crisp(cv, 0.05);
  let ov: HTMLCanvasElement | null = null;
  if (OVERLAYS.includes(def)) { ov = canvas(64, 32 + pad); G = ctx2(ov); paint(def, style, w, d, true); }
  const out = { canvas: cv, pad, overlay: ov }; cache.set(key, out); return out;
}

/** Boîte isométrique en coordonnées de pièce, découpée sur la cellule courante. */
function B(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, base: C, _noise = 0, emissive = false) {
  const cx0 = Math.max(x0, CI) - CI, cx1 = Math.min(x1, CI + 1) - CI, cy0 = Math.max(y0, CJ) - CJ, cy1 = Math.min(y1, CJ + 1) - CJ;
  if (cx1 - cx0 <= 0.002 || cy1 - cy0 <= 0.002 || z1 <= z0) return;
  const drawSE = x1 <= CI + 1 + 1e-4, drawSW = y1 <= CJ + 1 + 1e-4;
  const top = emissive ? base : shade(base, 0.15), sw = base, se = emissive ? base : shade(base, -0.22);
  const p = (lx: number, ly: number, z: number) => ({ x: 32 + (lx - ly) * 32, y: PADV + (lx + ly) * 16 - z });
  if (drawSW) poly(G, [p(cx0, cy1, z0), p(cx1, cy1, z0), p(cx1, cy1, z1), p(cx0, cy1, z1)], sw);
  if (drawSE) poly(G, [p(cx1, cy0, z0), p(cx1, cy1, z0), p(cx1, cy1, z1), p(cx1, cy0, z1)], se);
  poly(G, [p(cx0, cy0, z1), p(cx1, cy0, z1), p(cx1, cy1, z1), p(cx0, cy1, z1)], top);
  if (!emissive) {
    const off = (q: { x: number; y: number }, dx: number, dy: number) => ({ x: q.x + dx, y: q.y + dy });
    if (drawSW) line(G, off(p(cx0, cy1, z1), 0, 0.5), off(p(cx1, cy1, z1), 0, 0.5), shade(top, 0.1));
    if (drawSE) line(G, off(p(cx1, cy0, z1), -0.5, 0.5), off(p(cx1, cy1, z1), -0.5, 0.5), shade(top, 0.02));
    if (drawSW && drawSE && z1 - z0 > 3) line(G, off(p(cx1, cy1, z0), 0, -0.5), off(p(cx1, cy1, z1), 0, 0.5), shade(sw, 0.1));
  }
}

function paint(def: string, style: number, w: number, d: number, overlay: boolean) {
  const E = true;
  switch (def) {
    case 'bed_y': case 'bed_yw': {
      const bl = BLANKETS[style % 4];
      B(0.05, 0.03, 0, 0.95, 1.97, 6, WOOD_D); B(0.05, 0.03, 6, 0.95, 0.15, 24, WOOD); B(0.05, 1.85, 6, 0.95, 1.97, 13, WOOD);
      B(0.1, 0.15, 6, 0.9, 1.85, 11, c(0.94, 0.93, 0.9)); B(0.1, 0.62, 11, 0.9, 1.85, 13.5, bl); B(0.1, 0.62, 13.5, 0.9, 0.7, 14.5, shade(bl, 0.25));
      B(0.2, 0.19, 11, 0.8, 0.52, 15, c(0.97, 0.97, 0.99)); break;
    }
    case 'nightstand':
      B(0.14, 0.14, 0, 0.86, 0.86, 18, WOOD); B(0.22, 0.86, 9, 0.78, 0.88, 15, WOOD_D); B(0.46, 0.88, 11, 0.54, 0.9, 13, c(0.9, 0.8, 0.5));
      B(0.4, 0.4, 18, 0.6, 0.6, 21, c(0.3, 0.25, 0.22)); B(0.3, 0.3, 21, 0.7, 0.7, 32, c(1, 0.88, 0.6), 0, E); break;
    case 'wardrobe': {
      const wc = mix(WOOD, [c(0.55, 0.4, 0.3), c(0.7, 0.55, 0.4), c(0.5, 0.45, 0.4), c(0.62, 0.42, 0.32)][style % 4], 0.6);
      B(0.04, 0.1, 0, w - 0.04, 0.97, 62, wc); B(0, 0.06, 62, w, 1, 66, shade(wc, 0.1));
      for (let k = 0; k < w; k++) { B(k + 0.47, 0.97, 4, k + 0.53, 0.99, 59, WOOD_D); B(k + 0.36, 0.97, 28, k + 0.42, 1, 40, c(0.9, 0.8, 0.5)); B(k + 0.58, 0.97, 28, k + 0.64, 1, 40, c(0.9, 0.8, 0.5)); }
      break;
    }
    case 'fridge':
      B(0.08, 0.08, 0, 0.92, 0.92, 56, c(0.9, 0.92, 0.94)); B(0.08, 0.92, 36, 0.92, 0.935, 37, c(0.55, 0.58, 0.62));
      B(0.78, 0.93, 40, 0.84, 0.96, 52, c(0.45, 0.48, 0.52)); B(0.78, 0.93, 14, 0.84, 0.96, 32, c(0.45, 0.48, 0.52)); break;
    case 'counter': case 'counter_w':
      B(0.04, 0.04, 0, 0.96, 0.96, 27, c(0.62, 0.52, 0.42)); B(0, 0, 27, 1, 1, 30, STONE);
      if (def === 'counter') { B(0.47, 0.96, 4, 0.53, 0.975, 24, WOOD_D); B(0.3, 0.96, 20, 0.36, 0.99, 24, STEEL); B(0.64, 0.96, 20, 0.7, 0.99, 24, STEEL); }
      else { B(0.96, 0.47, 4, 0.975, 0.53, 24, WOOD_D); B(0.96, 0.3, 20, 0.99, 0.36, 24, STEEL); B(0.96, 0.64, 20, 0.99, 0.7, 24, STEEL); }
      break;
    case 'stove':
      B(0.04, 0.04, 0, 0.96, 0.96, 29, c(0.8, 0.82, 0.85)); B(0.14, 0.96, 6, 0.86, 0.975, 22, c(0.16, 0.17, 0.2)); B(0.2, 0.975, 20, 0.8, 1, 22, STEEL);
      B(0.04, 0.04, 29, 0.96, 0.96, 30, c(0.22, 0.23, 0.26));
      for (const bx of [0.26, 0.62]) for (const by of [0.24, 0.6]) B(bx, by, 30, bx + 0.18, by + 0.18, 31, c(0.1, 0.1, 0.12));
      B(0.04, 0.04, 30, 0.96, 0.12, 52, c(0.92, 0.9, 0.84)); B(0.1, 0.04, 50, 0.9, 0.55, 60, STEEL); B(0.34, 0.04, 60, 0.66, 0.3, 64, c(0.6, 0.63, 0.66)); break;
    case 'sink_k':
      B(0.04, 0.04, 0, 0.96, 0.96, 27, c(0.62, 0.52, 0.42)); B(0, 0, 27, 1, 1, 30, STONE); B(0.47, 0.96, 4, 0.53, 0.975, 24, WOOD_D);
      B(0.18, 0.2, 29.5, 0.82, 0.8, 30.5, c(0.45, 0.5, 0.55)); B(0.45, 0.08, 30, 0.55, 0.16, 42, STEEL); B(0.45, 0.08, 40, 0.55, 0.38, 42, STEEL); break;
    case 'table':
      for (const lx of [0.1, w - 0.22]) for (const ly of [0.1, d - 0.22]) B(lx, ly, 0, lx + 0.12, ly + 0.12, 22, WOOD_D);
      B(0.04, 0.04, 22, w - 0.04, d - 0.04, 25, c(0.74, 0.55, 0.36)); B(0.55, 0.45, 25, w - 0.55, d - 0.45, 25.6, c(0.92, 0.88, 0.8)); B(1.35, 0.8, 25.6, 1.65, 1.2, 29, c(0.85, 0.45, 0.3)); break;
    case 'chair_s': case 'chair_n': case 'chair_e': case 'chair_w': {
      const cc = c(0.72, 0.54, 0.36);
      for (const lx of [0.2, 0.7]) for (const ly of [0.2, 0.7]) B(lx, ly, 0, lx + 0.1, ly + 0.1, 10, WOOD_D);
      B(0.16, 0.16, 10, 0.84, 0.84, 13, c(0.78, 0.45, 0.38));
      if (def === 'chair_s') B(0.16, 0.1, 13, 0.84, 0.22, 32, cc); else if (def === 'chair_n') B(0.16, 0.78, 13, 0.84, 0.9, 32, cc);
      else if (def === 'chair_e') B(0.1, 0.16, 13, 0.22, 0.84, 32, cc); else B(0.78, 0.16, 13, 0.9, 0.84, 32, cc);
      break;
    }
    case 'sofa_s': {
      const sc = [c(0.8, 0.42, 0.3), c(0.3, 0.52, 0.55), c(0.55, 0.45, 0.65)][style % 3];
      B(0, 0.1, 0, w, 0.98, 10, shade(sc, -0.15)); B(0, 0.1, 10, w, 0.34, 36, sc); B(0, 0.1, 10, 0.2, 0.98, 25, shade(sc, 0.02)); B(w - 0.2, 0.1, 10, w, 0.98, 25, shade(sc, 0.02));
      for (let k = 0; k < w; k++) { const kx0 = k + (k === 0 ? 0.2 : 0), kx1 = k + 1 - (k === w - 1 ? 0.2 : 0); B(kx0, 0.34, 10, kx1, 0.98, 15.5, shade(sc, 0.1)); B(kx0 + 0.1, 0.34, 15.5, kx1 - 0.1, 0.5, 31, shade(sc, 0.16)); }
      break;
    }
    case 'armchair_e': {
      const ac = c(0.78, 0.6, 0.3);
      B(0.06, 0.08, 0, 0.98, 0.92, 10, shade(ac, -0.15)); B(0.3, 0.18, 10, 0.97, 0.82, 15.5, shade(ac, 0.1)); B(0.06, 0.08, 10, 0.34, 0.92, 38, ac); B(0.06, 0.08, 10, 0.98, 0.26, 25, ac); B(0.06, 0.74, 10, 0.98, 0.92, 25, ac); break;
    }
    case 'tv':
      B(0.1, 0.15, 0, w - 0.1, 0.85, 10, WOOD_D); B(0.22, 0.28, 10, w - 0.22, 0.72, 36, c(0.1, 0.1, 0.12)); B(0.7, 0.72, 16, w - 0.7, 0.74, 30, c(0.18, 0.18, 0.2)); B(0.45, 0.4, 36, w - 0.45, 0.6, 38, c(0.14, 0.14, 0.16)); break;
    case 'coffee_table':
      for (const [lx, ly] of [[0.08, 0.14], [w - 0.18, 0.14], [0.08, 0.76], [w - 0.18, 0.76]]) B(lx, ly, 0, lx + 0.1, ly + 0.1, 11, WOOD_D);
      B(0.04, 0.1, 11, w - 0.04, 0.9, 14, c(0.6, 0.42, 0.3)); break;
    case 'bookshelf':
      B(0.05, 0.1, 0, w - 0.05, 0.97, 58, WOOD_D); B(0, 0.06, 58, w, 1, 62, WOOD);
      for (let shelf = 0; shelf < 3; shelf++) {
        const zb = 4 + shelf * 18; B(0.1, 0.96, zb + 13, w - 0.1, 0.99, zb + 14.5, WOOD);
        let bx = 0.12, n = 0;
        while (bx < w - 0.22) {
          const bw = 0.06 + hash2(n, shelf, style) * 0.05, bh = 8 + hash2(n, shelf + 7, style) * 5, hue = hash2(n, shelf + 3, style + 5);
          B(bx, 0.96, zb, bx + bw, 0.99, zb + bh, hsv(hue, 0.45 + hash2(n, shelf, 2) * 0.3, 0.6 + hash2(n, 4, shelf) * 0.3)); bx += bw + 0.005; n++;
        }
      }
      break;
    case 'plant': {
      const l1 = c(0.3, 0.58, 0.3), l2 = c(0.42, 0.7, 0.36);
      B(0.3, 0.3, 0, 0.7, 0.7, 13, c(0.78, 0.42, 0.28)); B(0.27, 0.27, 12, 0.73, 0.73, 15, c(0.82, 0.48, 0.32)); B(0.32, 0.32, 15, 0.68, 0.68, 16, c(0.3, 0.2, 0.14));
      if (style === 0) { B(0.22, 0.28, 16, 0.58, 0.64, 34, l1); B(0.42, 0.36, 22, 0.8, 0.72, 42, l2); B(0.3, 0.52, 18, 0.62, 0.82, 33, shade(l1, 0.08)); }
      else { B(0.46, 0.46, 16, 0.54, 0.54, 34, c(0.35, 0.24, 0.16)); B(0.24, 0.24, 30, 0.76, 0.76, 46, l1); B(0.3, 0.3, 44, 0.7, 0.7, 47, l2); }
      break;
    }
    case 'floor_lamp': B(0.38, 0.38, 0, 0.62, 0.62, 3, c(0.25, 0.22, 0.2)); B(0.47, 0.47, 3, 0.53, 0.53, 56, c(0.3, 0.27, 0.24)); B(0.28, 0.28, 52, 0.72, 0.72, 72, c(1, 0.88, 0.62), 0, E); break;
    case 'toilet':
      B(0.2, 0.3, 0, 0.8, 0.92, 15, WHITE); B(0.18, 0.32, 15, 0.82, 0.92, 17, shade(WHITE, 0.03)); B(0.24, 0.4, 17, 0.76, 0.84, 17.5, c(0.75, 0.78, 0.82));
      B(0.2, 0.06, 0, 0.8, 0.32, 29, WHITE); B(0.18, 0.05, 29, 0.82, 0.34, 31, shade(WHITE, 0.04)); B(0.45, 0.1, 31, 0.55, 0.16, 33, STEEL); break;
    case 'shower':
      if (!overlay) {
        B(0.04, 0.04, 0, 0.96, 0.96, 2, c(0.75, 0.86, 0.92)); B(0.04, 0.04, 2, 0.96, 0.12, 76, c(0.86, 0.93, 0.95)); B(0.04, 0.04, 2, 0.12, 0.96, 76, c(0.8, 0.9, 0.93));
        B(0.4, 0.1, 62, 0.6, 0.4, 66, STEEL); B(0.47, 0.1, 56, 0.53, 0.16, 66, STEEL); B(0.1, 0.1, 40, 0.22, 0.2, 42, STEEL);
      } else {
        const p = (lx: number, ly: number, z: number) => ({ x: 32 + (lx - ly) * 32, y: PADV + (lx + ly) * 16 - z });
        poly(G, [p(0.04, 0.96, 2), p(0.96, 0.96, 2), p(0.96, 0.96, 74), p(0.04, 0.96, 74)], c(0.75, 0.9, 1), 0.22);
        poly(G, [p(0.96, 0.04, 2), p(0.96, 0.96, 2), p(0.96, 0.96, 74), p(0.96, 0.04, 74)], c(0.7, 0.85, 0.95), 0.16);
        B(0.03, 0.95, 2, 0.08, 1, 76, STEEL); B(0.93, 0.95, 2, 0.99, 1, 76, STEEL); B(0.93, 0.03, 2, 0.99, 0.08, 76, STEEL); B(0.03, 0.95, 74, 0.99, 1, 77, STEEL);
      }
      break;
    case 'sink_b':
      B(0.08, 0.08, 0, 0.92, 0.92, 25, c(0.88, 0.9, 0.92)); B(0.04, 0.04, 25, 0.96, 0.96, 28, WHITE); B(0.22, 0.24, 28, 0.78, 0.78, 28.6, c(0.7, 0.8, 0.86));
      B(0.46, 0.1, 28, 0.54, 0.16, 38, STEEL); B(0.46, 0.1, 36, 0.54, 0.34, 38, STEEL); B(0.14, 0.04, 40, 0.86, 0.09, 68, c(0.62, 0.78, 0.9)); B(0.1, 0.03, 38, 0.9, 0.1, 40, WOOD_L); B(0.1, 0.03, 66, 0.9, 0.1, 70, WOOD_L); break;
    case 'bathtub': {
      const tw = c(0.94, 0.95, 0.97);
      if (!overlay) {
        B(0.02, 0.04, 0, w - 0.02, 0.2, 22, tw); B(0.02, 0.04, 0, 0.18, 0.96, 22, tw); B(w - 0.18, 0.04, 0, w - 0.02, 0.96, 22, tw);
        B(0.18, 0.2, 0, w - 0.18, 0.8, 14, c(0.55, 0.78, 0.92)); B(0.18, 0.2, 14, w - 0.18, 0.8, 15, c(0.7, 0.88, 0.98)); B(0.3, 0.06, 22, 0.4, 0.18, 30, STEEL);
      } else B(0.02, 0.8, 0, w - 0.02, 0.96, 22, tw);
      break;
    }
    case 'washer':
      B(0.06, 0.06, 0, 0.94, 0.94, 36, c(0.91, 0.92, 0.94)); B(0.24, 0.94, 6, 0.76, 0.96, 28, c(0.55, 0.62, 0.7)); B(0.3, 0.96, 10, 0.7, 0.975, 24, c(0.25, 0.3, 0.38));
      B(0.08, 0.94, 30, 0.92, 0.955, 35, c(0.7, 0.72, 0.76)); B(0.7, 0.955, 31, 0.8, 0.965, 34, c(0.4, 0.8, 0.5)); break;
    case 'basket': B(0.2, 0.2, 0, 0.8, 0.8, 15, c(0.74, 0.58, 0.38)); B(0.24, 0.24, 15, 0.76, 0.76, 19, [c(0.8, 0.4, 0.4), c(0.4, 0.55, 0.8), c(0.9, 0.85, 0.7)][(CI + CJ + style) % 3]); break;
    case 'bench':
      for (const lx of [0.12, w - 0.24]) { B(lx, 0.28, 0, lx + 0.12, 0.4, 12, WOOD_D); B(lx, 0.62, 0, lx + 0.12, 0.74, 12, WOOD_D); }
      B(0.05, 0.2, 12, w - 0.05, 0.8, 15, WOOD); B(0.25, 0.28, 15, w - 0.25, 0.72, 17.5, c(0.55, 0.6, 0.72)); break;
    case 'coat_rack':
      B(0.42, 0.42, 0, 0.58, 0.58, 3, WOOD_D); B(0.47, 0.47, 3, 0.53, 0.53, 74, WOOD_D); B(0.3, 0.47, 66, 0.7, 0.53, 69, WOOD_D);
      B(0.56, 0.4, 36, 0.8, 0.6, 66, c(0.62, 0.32, 0.32)); B(0.2, 0.42, 44, 0.42, 0.58, 66, c(0.3, 0.4, 0.55)); break;
    case 'shoe_rack':
      B(0.1, 0.1, 0, 0.9, 0.9, 4, WOOD_D); B(0.1, 0.1, 4, 0.9, 0.9, 9, WOOD); B(0.1, 0.1, 9, 0.9, 0.9, 11, WOOD_D);
      B(0.18, 0.55, 11, 0.4, 0.8, 15, c(0.85, 0.85, 0.88)); B(0.5, 0.55, 11, 0.74, 0.8, 15, c(0.35, 0.25, 0.2)); B(0.2, 0.55, 4, 0.44, 0.8, 8.5, c(0.2, 0.2, 0.25)); break;
    case 'console':
      for (const [lx, ly] of [[0.1, 0.26], [w - 0.22, 0.26], [0.1, 0.62], [w - 0.22, 0.62]]) B(lx, ly, 0, lx + 0.12, ly + 0.12, 26, WOOD_D);
      B(0.05, 0.2, 26, w - 0.05, 0.8, 30, WOOD); B(0.4, 0.4, 30, 0.6, 0.6, 33, c(0.3, 0.26, 0.22)); B(0.34, 0.34, 33, 0.66, 0.66, 44, c(1, 0.88, 0.62), 0, E); break;
    case 'bin': B(0.3, 0.3, 0, 0.7, 0.7, 17, c(0.52, 0.55, 0.58)); B(0.27, 0.27, 17, 0.73, 0.73, 19, c(0.4, 0.43, 0.46)); break;
    case 'altar':
      B(0.2, 0.2, 0, 0.8, 0.8, 17, c(0.86, 0.84, 0.8)); B(0.14, 0.14, 17, 0.86, 0.86, 20, c(0.95, 0.93, 0.85));
      B(0.28, 0.3, 20, 0.36, 0.38, 28, c(0.98, 0.95, 0.85)); B(0.28, 0.3, 28, 0.36, 0.38, 31, c(1, 0.82, 0.3), 0, E);
      B(0.62, 0.5, 20, 0.7, 0.58, 27, c(0.98, 0.95, 0.85)); B(0.62, 0.5, 27, 0.7, 0.58, 30, c(1, 0.82, 0.3), 0, E); B(0.44, 0.44, 20, 0.56, 0.56, 25, c(0.95, 0.78, 0.25), 0, E); break;
    case 'back_shelf': {
      B(0.05, 0.1, 0, w - 0.05, 0.97, 24, c(0.3, 0.19, 0.14)); B(0.04, 0.08, 24, w - 0.04, 0.16, 66, c(0.55, 0.7, 0.8)); B(0.0, 0.06, 66, w, 0.6, 69, WOOD_D);
      for (const zs of [34, 48]) { B(0.04, 0.16, zs - 1.5, w - 0.04, 0.55, zs, WOOD); for (let k = 0; k < w * 5; k++) { const x = 0.1 + k * 0.2; if (x > w - 0.2) break; B(x, 0.3, zs, x + 0.09, 0.39, zs + 6 + hash2(k, zs) * 8, hsv(hash2(k, zs, 5), 0.55, 0.55 + hash2(k, zs, 9) * 0.4)); } }
      B(0.04, 0.16, 24, w - 0.04, 0.6, 27, WOOD_D); break;
    }
    case 'shelf3': case 'shelf4': {
      B(0.04, 0.1, 0, w - 0.04, 0.9, 6, c(0.36, 0.3, 0.26)); B(0.02, 0.06, 6, w - 0.02, 0.18, 56, c(0.42, 0.33, 0.27));
      const cols = [c(0.9, 0.35, 0.3), c(0.95, 0.8, 0.3), c(0.35, 0.65, 0.85), c(0.45, 0.78, 0.45), c(0.85, 0.55, 0.25)];
      for (const zs of [20, 34, 48]) { B(0.02, 0.1, zs - 1.5, w - 0.02, 0.9, zs, c(0.5, 0.4, 0.3)); for (let k = 0; k < w * 4; k++) { const x = 0.06 + k * 0.25; if (x > w - 0.2) break; B(x, 0.45, zs, x + 0.17, 0.78, zs + 7 + hash2(k, zs) * 5, cols[(k + zs) % cols.length]); } }
      B(0.0, 0.06, 56, w, 0.95, 60, c(0.5, 0.2, 0.18)); break;
    }
    case 'shop_counter':
      B(0, 0.1, 0, w, 0.95, 30, c(0.55, 0.45, 0.34)); B(0, 0.95, 4, w, 0.975, 28, c(0.8, 0.75, 0.6)); B(0, 0.04, 30, w, 1, 34, c(0.86, 0.84, 0.8));
      B(0.4, 0.35, 34, 1.0, 0.7, 40, c(0.25, 0.28, 0.32)); B(0.5, 0.4, 40, 0.9, 0.6, 46, c(0.2, 0.6, 0.45), 0, true); if (w > 2) { B(2.2, 0.4, 34, 2.6, 0.7, 40, c(0.9, 0.4, 0.3)); B(2.9, 0.4, 34, 3.3, 0.7, 38, c(0.95, 0.8, 0.3)); } break;
    case 'desk':
      B(0.04, 0.12, 0, w - 0.04, 0.9, 28, c(0.4, 0.42, 0.5)); B(0, 0.08, 28, w, 0.95, 31, c(0.62, 0.64, 0.7)); B(0.2, 0.3, 31, 0.8, 0.6, 33, c(0.12, 0.14, 0.18)); B(0.28, 0.34, 33, 0.72, 0.56, 38, c(0.2, 0.55, 0.8), 0, true); break;
    case 'park_bench':
      for (const lx of [0.1, w - 0.22]) { B(lx, 0.32, 0, lx + 0.12, 0.4, 10, c(0.2, 0.2, 0.22)); B(lx, 0.6, 0, lx + 0.12, 0.68, 10, c(0.2, 0.2, 0.22)); }
      B(0.04, 0.3, 10, w - 0.04, 0.7, 13, c(0.5, 0.34, 0.22)); B(0.04, 0.28, 13, w - 0.04, 0.36, 28, c(0.5, 0.34, 0.22)); break;
    case 'bar_counter':
      B(0, 0.1, 0, w, 0.95, 28, c(0.36, 0.2, 0.14)); B(0, 0.95, 5, w, 0.975, 7, c(0.85, 0.7, 0.35)); B(0, 0.96, 2, w, 0.99, 4.5, c(0.8, 0.65, 0.3));
      for (let k = 0; k < w; k++) B(k + 0.12, 0.95, 10, k + 0.88, 0.965, 24, c(0.3, 0.17, 0.12));
      B(0, 0, 28, w, 1, 31, c(0.55, 0.34, 0.2));
      for (let k = 0; k < w; k++) if (k % 2 === 0) { B(k + 0.35, 0.3, 31, k + 0.45, 0.4, 36, c(0.8, 0.9, 0.95)); B(k + 0.62, 0.55, 31, k + 0.7, 0.63, 34, c(0.9, 0.7, 0.3)); } break;
    case 'stool':
      B(0.3, 0.3, 0, 0.7, 0.7, 2, STEEL); B(0.46, 0.46, 2, 0.54, 0.54, 18, STEEL); B(0.24, 0.24, 18, 0.76, 0.76, 22, c(0.7, 0.18, 0.24)); break;
    case 'jukebox':
      B(0.1, 0.12, 0, 0.9, 0.9, 44, c(0.55, 0.14, 0.3)); B(0.16, 0.9, 8, 0.84, 0.92, 32, c(1, 0.82, 0.4), 0, true); B(0.2, 0.92, 12, 0.8, 0.935, 28, c(0.2, 0.1, 0.16));
      B(0.12, 0.14, 44, 0.88, 0.88, 52, c(0.95, 0.65, 0.2)); B(0.3, 0.92, 33, 0.7, 0.94, 36, c(0.4, 1, 0.9), 0, true); break;
    case 'bar_table':
      B(0.3, 0.3, 0, 0.7, 0.7, 2, WOOD_D); B(0.44, 0.44, 2, 0.56, 0.56, 20, WOOD_D); B(0.08, 0.08, 20, 0.92, 0.92, 23, c(0.42, 0.27, 0.18)); B(0.44, 0.44, 23, 0.56, 0.56, 27, c(1, 0.85, 0.55), 0, true); break;
    case 'streetlamp':
      B(0.38, 0.38, 0, 0.62, 0.62, 5, c(0.18, 0.2, 0.22)); B(0.46, 0.46, 5, 0.54, 0.54, 88, c(0.2, 0.22, 0.25)); B(0.28, 0.44, 86, 0.56, 0.56, 90, c(0.2, 0.22, 0.25)); B(0.14, 0.38, 82, 0.46, 0.62, 88, c(1, 0.9, 0.62), 0, true); break;
    case 'street_bench':
      for (const lx of [0.1, w - 0.22]) { B(lx, 0.32, 0, lx + 0.12, 0.4, 10, c(0.2, 0.2, 0.22)); B(lx, 0.6, 0, lx + 0.12, 0.68, 10, c(0.2, 0.2, 0.22)); }
      B(0.04, 0.3, 10, w - 0.04, 0.7, 13, c(0.5, 0.34, 0.22)); B(0.04, 0.28, 13, w - 0.04, 0.36, 28, c(0.5, 0.34, 0.22)); break;
    case 'bar_sign': {
      B(0.46, 0.52, 0, 0.54, 0.6, 72, c(0.16, 0.16, 0.2)); B(0.06, 0.44, 62, 0.94, 0.62, 98, c(0.1, 0.05, 0.14)); B(0.1, 0.62, 66, 0.9, 0.64, 70, c(1, 0.3, 0.7), 0, true); B(0.1, 0.62, 90, 0.9, 0.64, 94, c(1, 0.3, 0.7), 0, true);
      B(0.1, 0.62, 66, 0.14, 0.64, 94, c(1, 0.3, 0.7), 0, true); B(0.86, 0.62, 66, 0.9, 0.64, 94, c(1, 0.3, 0.7), 0, true);
      if (CI === 0 && CJ === 0) { const px0 = 32 + (0.2 - 0.66) * 32, py0 = PADV + (0.2 + 0.66) * 16 - 88; G.save(); G.transform(1, 0.5, 0, 1, px0, py0); G.fillStyle = '#7de8ff'; G.font = 'bold 15px sans-serif'; G.fillText('BAR', 1, 8); G.restore(); }
      break;
    }
    case 'bush': {
      const g1 = c(0.24, 0.48, 0.28); B(0.15, 0.15, 0, 0.85, 0.85, 14, g1); B(0.25, 0.25, 12, 0.78, 0.78, 24, shade(g1, 0.1));
      if (style % 2 === 0) { B(0.58, 0.18, 14, 0.7, 0.3, 18, c(0.95, 0.55, 0.65)); B(0.22, 0.6, 16, 0.34, 0.72, 20, c(0.98, 0.85, 0.4)); }
      break;
    }
    case 'tree': { const g2 = c(0.22, 0.46, 0.27); B(0.4, 0.4, 0, 0.6, 0.6, 44, c(0.4, 0.28, 0.2)); B(0, 0, 34, 1, 1, 62, g2); B(0.1, 0.1, 58, 0.9, 0.9, 86, shade(g2, 0.08)); B(0.2, 0.2, 82, 0.8, 0.8, 108, shade(g2, 0.16)); break; }
    case 'm_clothes': B(0.26, 0.28, 0, 0.72, 0.64, 3, [c(0.85, 0.35, 0.35), c(0.35, 0.55, 0.85), c(0.9, 0.85, 0.5)][style % 3]); B(0.4, 0.2, 0, 0.62, 0.46, 3.5, c(0.28, 0.32, 0.45)); B(0.55, 0.55, 0, 0.7, 0.7, 2, c(0.9, 0.9, 0.9)); break;
    case 'm_book': B(0.3, 0.28, 0, 0.64, 0.72, 3, c(0.72, 0.3, 0.32)); B(0.32, 0.3, 3, 0.62, 0.7, 3.6, c(0.95, 0.93, 0.85)); break;
    case 'm_cup': B(0.42, 0.42, 0, 0.58, 0.58, 7, WHITE); B(0.44, 0.44, 7, 0.56, 0.56, 7.5, c(0.35, 0.22, 0.14)); break;
    case 'm_pizza': B(0.2, 0.2, 0, 0.8, 0.8, 3, c(0.82, 0.66, 0.44)); B(0.3, 0.3, 3, 0.68, 0.68, 4, c(0.88, 0.45, 0.25)); B(0.4, 0.4, 4, 0.48, 0.48, 4.6, c(0.7, 0.2, 0.2)); break;
    case 'm_trash': B(0.34, 0.34, 0, 0.66, 0.66, 6, c(0.6, 0.62, 0.64)); B(0.4, 0.4, 6, 0.6, 0.6, 9, c(0.92, 0.92, 0.92)); break;
    case 'm_dishes': B(0.28, 0.28, 0, 0.72, 0.72, 1.6, WHITE); B(0.3, 0.3, 1.6, 0.7, 0.7, 3.2, shade(WHITE, -0.05)); B(0.34, 0.34, 3.2, 0.66, 0.66, 4.6, WHITE); B(0.5, 0.5, 4.6, 0.58, 0.58, 5.6, c(0.8, 0.35, 0.25)); break;
    case 'm_feast0': B(0.1, 0.1, 0, 0.9, 0.9, 1.5, c(0.98, 0.84, 0.35), 0, E); B(0.22, 0.22, 1.5, 0.78, 0.78, 6, c(0.72, 0.42, 0.22)); B(0.34, 0.34, 6, 0.66, 0.66, 8, c(0.85, 0.55, 0.28)); break;
    case 'm_feast1': B(0.1, 0.1, 0, 0.9, 0.9, 1.5, c(0.98, 0.84, 0.35), 0, E); B(0.2, 0.2, 1.5, 0.5, 0.5, 6, c(0.85, 0.25, 0.25)); B(0.5, 0.45, 1.5, 0.8, 0.75, 6, c(0.55, 0.78, 0.3)); B(0.3, 0.5, 1.5, 0.55, 0.8, 5, c(0.95, 0.75, 0.25)); break;
    case 'm_feast2': B(0.4, 0.4, 0, 0.6, 0.6, 13, c(0.55, 0.15, 0.25)); B(0.1, 0.1, 0, 0.3, 0.3, 9, c(0.98, 0.95, 0.85)); B(0.1, 0.1, 9, 0.3, 0.3, 12, c(1, 0.8, 0.3), 0, E); B(0.62, 0.62, 0, 0.9, 0.9, 5, c(0.88, 0.7, 0.38)); break;
  }
}
function hsv(h: number, s: number, v: number): C {
  const i = Math.floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return ([c(v, t, p), c(q, v, p), c(p, v, t), c(p, q, v), c(t, p, v), c(v, p, q)][i % 6]);
}
const rugCache = new Map<string, HTMLCanvasElement>();
export function rugCanvas(w: number, d: number, style: number): HTMLCanvasElement {
  const key = `${w}|${d}|${style}`; const hit = rugCache.get(key); if (hit) return hit;
  const [border, field] = RUGS[style % RUGS.length]; const iw = (w + d) * 32 + 2, ih = (w + d) * 16 + 2; const cv = canvas(iw, ih); const g = ctx2(cv); const im = g.createImageData(iw, ih);
  for (let y = 0; y < ih; y++) for (let x = 0; x < iw; x++) {
    const sx = x + 0.5 - d * 32, sy = y + 0.5; const gx = (sx / 32 + sy / 16) * 0.5, gy = (sy / 16 - sx / 32) * 0.5;
    if (gx < 0 || gy < 0 || gx >= w || gy >= d) continue;
    const e = Math.min(Math.min(gx, w - gx), Math.min(gy, d - gy)); let col = field;
    if (e < 0.12) col = shade(border, -0.15); else if (e < 0.3) col = border; else if (e < 0.38) col = shade(field, 0.1);
    else { col = (Math.floor(gx * 3) + Math.floor(gy * 3)) % 2 === 0 ? field : shade(field, -0.07); if (Math.abs((gx * 2) % 1 - 0.5) < 0.05 && Math.abs((gy * 2) % 1 - 0.5) < 0.12) col = border; }
    col = shade(col, (hash2(x, y, 31) - 0.5) * 0.05); const i = (y * iw + x) * 4;
    im.data[i] = col[0] * 255; im.data[i + 1] = col[1] * 255; im.data[i + 2] = col[2] * 255; im.data[i + 3] = 255;
  }
  g.putImageData(im, 0, 0); rugCache.set(key, cv); return cv;
}
