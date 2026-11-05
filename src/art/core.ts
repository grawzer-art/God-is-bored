/** Outils de dessin pixel-art sur Canvas 2D + génération des sols, murs fins et icônes (assets PROVISOIRES, procéduraux). */
export type C = [number, number, number];
export const c = (r: number, g: number, b: number): C => [r, g, b];
export const css = (col: C, a = 1) => `rgba(${Math.round(col[0] * 255)},${Math.round(col[1] * 255)},${Math.round(col[2] * 255)},${a})`;
export function shade(col: C, f: number): C {
  if (f >= 0) return [col[0] + (1 - col[0]) * f, col[1] + (1 - col[1]) * f, col[2] + (1 - col[2]) * f];
  const k = 1 + f; return [col[0] * k, col[1] * k, col[2] * k];
}
export const mix = (a: C, b: C, t: number): C => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export function hash2(x: number, y: number, s = 0): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 2147483647)) & 0x7fffffff;
  h = Math.imul(h ^ (h >> 13), 1274126177) & 0x7fffffff; h ^= h >> 16; return (h & 0xffff) / 65535;
}
export function canvas(w: number, h: number): HTMLCanvasElement { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; return cv; }
export const ctx2 = (cv: HTMLCanvasElement) => { const g = cv.getContext('2d', { willReadFrequently: true })!; g.imageSmoothingEnabled = false; return g; };

/** Rectangle pixel (sans lissage). */
export function rect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, col: C, a = 1) {
  g.fillStyle = css(col, a); g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}
export function px(g: CanvasRenderingContext2D, x: number, y: number, col: C, a = 1) { g.fillStyle = css(col, a); g.fillRect(Math.round(x), Math.round(y), 1, 1); }
export function line(g: CanvasRenderingContext2D, a: { x: number; y: number }, b: { x: number; y: number }, col: C, al = 1) {
  let x0 = Math.round(a.x), y0 = Math.round(a.y); const x1 = Math.round(b.x), y1 = Math.round(b.y);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let err = dx + dy;
  g.fillStyle = css(col, al);
  for (let i = 0; i < 400; i++) { g.fillRect(x0, y0, 1, 1); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
}
export function poly(g: CanvasRenderingContext2D, pts: { x: number; y: number }[], col: C, a = 1) {
  g.fillStyle = css(col, a); g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.closePath(); g.fill();
}
/** Supprime l'anticrénelage : alpha >= 50 % -> opaque, sinon transparent (rendu pixel net). */
export function crisp(cv: HTMLCanvasElement, noise = 0) {
  const g = ctx2(cv); const im = g.getImageData(0, 0, cv.width, cv.height); const d = im.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] >= 128) {
      d[i + 3] = 255;
      if (noise > 0) { const p = i >> 2; const n = 1 + (hash2(p % cv.width, (p / cv.width) | 0, 21) - 0.5) * noise; d[i] = Math.min(255, d[i] * n); d[i + 1] = Math.min(255, d[i + 1] * n); d[i + 2] = Math.min(255, d[i + 2] * n); }
    } else d[i + 3] = 0;
  }
  g.putImageData(im, 0, 0);
}
/** Contour sélectif : voisin opaque -> pixel de contour de sa teinte, assombrie. */
export function outline(cv: HTMLCanvasElement, dark = -0.62) {
  const g = ctx2(cv); const w = cv.width, h = cv.height; const im = g.getImageData(0, 0, w, h); const src = new Uint8ClampedArray(im.data); const d = im.data;
  const A = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : src[(y * w + x) * 4 + 3]);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4; if (src[i + 3] > 12) continue;
    for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) {
      if (A(x + dx, y + dy) > 128) { const j = ((y + dy) * w + (x + dx)) * 4; const k = 1 + dark; d[i] = src[j] * k; d[i + 1] = src[j + 1] * k; d[i + 2] = src[j + 2] * k; d[i + 3] = 255; break; }
    }
  }
  g.putImageData(im, 0, 0);
}

// ------------------------------------------------------------------ sols 64x32
const wood = (base: C, a: number, b: number, v: number, planks = 4, alongA = true): C => {
  const u = alongA ? a : b, w = alongA ? b : a; const bi = Math.floor(w * planks); const fb = w * planks - bi;
  const off = hash2(bi, v, 3); const piece = Math.floor(u + off); const aa = (((u + off) % 1) + 1) % 1;
  let col = shade(base, (hash2(bi, piece, v) - 0.5) * 0.13);
  col = shade(col, (hash2(Math.floor(u * 20), bi * 5 + piece, v + 9) - 0.5) * 0.06);
  if (fb < 0.07) col = shade(col, -0.28); else if (fb < 0.14) col = shade(col, 0.05);
  if (aa < 0.03) col = shade(col, -0.26);
  return col;
};
function floorColor(kind: string, a: number, b: number, v: number, x: number, y: number): C {
  switch (kind) {
    case 'wood_a': return wood(c(0.74, 0.55, 0.36), a, b, v);
    case 'wood_b': return wood(c(0.66, 0.5, 0.38), a, b, v);
    case 'wood_c': return wood(c(0.78, 0.62, 0.42), a, b, v);
    case 'wood_d': return wood(c(0.6, 0.44, 0.32), a, b, v);
    case 'wood_hall': return wood(c(0.5, 0.36, 0.27), a, b, v, 3);
    case 'threshold': { let col = wood(c(0.42, 0.3, 0.22), a, b, v, 3); if (Math.abs(a - 0.5) < 0.09) col = Math.abs(a - 0.5) > 0.03 ? c(0.72, 0.62, 0.4) : c(0.55, 0.46, 0.3); return col; }
    case 'tile_kitchen': {
      const ci = (Math.floor(a * 2) + Math.floor(b * 2)) % 2; let base: C = ci === 0 ? c(0.93, 0.9, 0.82) : c(0.58, 0.7, 0.62);
      const fa = (a * 2) % 1, fb = (b * 2) % 1; base = shade(base, (hash2(x, y, v) - 0.5) * 0.05);
      if (fa < 0.05 || fb < 0.05) return c(0.78, 0.76, 0.7); if (fa < 0.11 || fb < 0.11) return shade(base, 0.06); return base;
    }
    case 'tile_bath': {
      const ta = a * 4, tb = b * 4; const tone = hash2(Math.floor(ta), Math.floor(tb), v + 4);
      const base: C = (Math.floor(ta) + Math.floor(tb) + Math.floor(tone * 3)) % 2 === 0 ? c(0.82, 0.9, 0.94) : c(0.7, 0.84, 0.9);
      if (ta % 1 < 0.09 || tb % 1 < 0.09) return c(0.9, 0.94, 0.95); if (hash2(x, y, v) > 0.97) return c(1, 1, 1); return base;
    }
    case 'parquet': {
      const q = (Math.floor(a * 2) + Math.floor(b * 2)) % 2; const qa = (a * 2) % 1, qb = (b * 2) % 1;
      return q === 0 ? wood(c(0.5, 0.33, 0.22), qa, qb, v, 3, true) : wood(c(0.45, 0.29, 0.2), qa, qb, v + 7, 3, false);
    }
    case 'concrete': { let base = shade(c(0.56, 0.58, 0.6), (hash2(x, y, v) - 0.5) * 0.12); if (a < 0.03 || b < 0.03) base = shade(base, -0.12); return base; }
    case 'grass': {
      let col = shade(c(0.27, 0.44, 0.26), (hash2(x, y, v) - 0.5) * 0.18);
      if (hash2(x >> 1, y, v + 1) > 0.93) col = c(0.4, 0.58, 0.32); if (hash2(x, y >> 1, v + 2) > 0.96) col = c(0.2, 0.34, 0.2); return col;
    }
    case 'bar_floor': return wood(c(0.33, 0.22, 0.17), a, b, v, 4);
    case 'tile_dark': { const ta = a * 4, tb = b * 4; const base: C = (Math.floor(ta) + Math.floor(tb)) % 2 === 0 ? c(0.5, 0.55, 0.57) : c(0.42, 0.47, 0.5); if (ta % 1 < 0.08 || tb % 1 < 0.08) return c(0.3, 0.33, 0.35); return shade(base, (hash2(x, y, v) - 0.5) * 0.06); }
    case 'sidewalk': { let col = shade(c(0.66, 0.64, 0.6), (hash2(x, y, v) - 0.5) * 0.09); if (a < 0.035 || b < 0.035) col = shade(col, -0.2); else if (a < 0.07 || b < 0.07) col = shade(col, 0.05); return col; }
    case 'road': { let col = shade(c(0.2, 0.21, 0.24), (hash2(x, y, v) - 0.5) * 0.12); if (hash2(x >> 1, y >> 1, v + 3) > 0.96) col = shade(col, 0.15); return col; }
    case 'path': { let col = shade(c(0.62, 0.58, 0.52), (hash2(x, y, v) - 0.5) * 0.1); if ((a * 2) % 1 < 0.08 || (b * 2) % 1 < 0.08) col = shade(col, -0.18); return col; }
  }
  return c(1, 0, 1);
}
const floorCache = new Map<string, HTMLCanvasElement>();
export function floorTile(kind: string, variant: number): HTMLCanvasElement {
  const key = `${kind}_${variant}`; const hit = floorCache.get(key); if (hit) return hit;
  const cv = canvas(64, 32); const g = ctx2(cv); const im = g.createImageData(64, 32);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 64; x++) {
    const sx = x + 0.5 - 32, sy = y + 0.5; const a = (sx / 32 + sy / 16) * 0.5, b = (sy / 16 - sx / 32) * 0.5;
    if (a < 0 || a >= 1 || b < 0 || b >= 1) continue;
    const col = floorColor(kind, a, b, variant, x, y); const i = (y * 64 + x) * 4;
    im.data[i] = Math.max(0, Math.min(255, col[0] * 255)); im.data[i + 1] = Math.max(0, Math.min(255, col[1] * 255)); im.data[i + 2] = Math.max(0, Math.min(255, col[2] * 255)); im.data[i + 3] = 255;
  }
  g.putImageData(im, 0, 0); floorCache.set(key, cv); return cv;
}
export const FLOOR_STYLES: Record<string, string> = { a: 'wood_a', b: 'wood_b', c: 'wood_c', d: 'wood_d', h: 'wood_hall', k: 'tile_kitchen', l: 'parquet', w: 'tile_bath', u: 'concrete', door: 'threshold', B: 'bar_floor', R: 'tile_dark', s: 'sidewalk', r: 'road', g: 'grass' };

// ------------------------------------------------------------------ murs fins
export interface FaceSpec { c: C; dec: 'none' | 'window' | 'picture' | 'door' | 'neon' | 'shopwin'; tiled: boolean; art: number }
const wallCache = new Map<string, HTMLCanvasElement>();
const T0 = 0.35, T1 = 0.65;
const specKey = (s: FaceSpec) => `${css(s.c)}${s.dec}${s.tiled}${s.art}`;
export function wallTex(h: number, mask: number, left: FaceSpec, right: FaceSpec, cap: C): HTMLCanvasElement {
  const key = `${h}|${mask}|${specKey(left)}|${specKey(right)}|${css(cap)}`; const hit = wallCache.get(key); if (hit) return hit;
  const cv = canvas(64, 32 + h); const g = ctx2(cv);
  const boxes: number[][] = [];
  if (mask & 1) boxes.push([0, T0, T0, T1]); if (mask & 2) boxes.push([T0, 0, T1, T0]); boxes.push([T0, T0, T1, T1]);
  if (mask & 4) boxes.push([T1, T0, 1, T1]); if (mask & 8) boxes.push([T0, T1, T1, 1]);
  if (mask === 0) boxes.length = 0, boxes.push([0.2, 0.2, 0.8, 0.8]);
  for (const b of boxes) wbox(g, h, b[0], b[1], b[2], b[3], left, right, cap);
  crisp(cv); wallCache.set(key, cv); return cv;
}
function wbox(g: CanvasRenderingContext2D, h: number, x0: number, y0: number, x1: number, y1: number, left: FaceSpec, right: FaceSpec, cap: C) {
  const P = (x: number, y: number, z: number) => ({ x: 32 + (x - y) * 32, y: h + (x + y) * 16 - z });
  face(g, h, 'sw', y1, x0, x1, left, P); face(g, h, 'se', x1, y0, y1, right, P);
  poly(g, [P(x0, y0, h), P(x1, y0, h), P(x1, y1, h), P(x0, y1, h)], cap);
  line(g, { ...P(x0, y1, h), y: P(x0, y1, h).y + 0.5 }, { ...P(x1, y1, h), y: P(x1, y1, h).y + 0.5 }, shade(cap, 0.1));
  line(g, { ...P(x1, y0, h), x: P(x1, y0, h).x - 0.5 }, { ...P(x1, y1, h), x: P(x1, y1, h).x - 0.5 }, shade(cap, -0.1));
}
function face(g: CanvasRenderingContext2D, h: number, kind: 'sw' | 'se', plane: number, u0: number, u1: number, spec: FaceSpec, P: (x: number, y: number, z: number) => { x: number; y: number }) {
  const at = (u: number, z: number) => (kind === 'sw' ? P(u, plane, z) : P(plane, u, z));
  const fp = (a: number, b: number, zb: number, zt: number, col: C, al = 1) => {
    const lo = Math.max(a, u0), hi = Math.min(b, u1); if (hi - lo <= 0.001) return; poly(g, [at(lo, zb), at(hi, zb), at(hi, zt), at(lo, zt)], col, al);
  };
  const tall = h >= 60; const mid = h >= 36; const base = spec.c;
  fp(0, 1, 0, h, base);
  for (let i = 0; i < 10; i += 2) fp(i / 10, (i + 1) / 10, 0, h, shade(base, 0.025));
  if (tall && !spec.tiled) { fp(0, 1, 0, h * 0.36, shade(base, -0.1)); for (let k = 0; k < 4; k++) fp((k + 0.46) / 4, (k + 0.54) / 4, 0, h * 0.36, shade(base, -0.2)); fp(0, 1, h * 0.355, h * 0.38, shade(base, 0.2)); }
  if (tall && spec.tiled) {
    fp(0, 1, 0, h * 0.88, c(0.85, 0.93, 0.95));
    for (let k = 0; k <= 8; k++) fp(k / 8 - 0.012, k / 8 + 0.012, 0, h * 0.88, c(0.93, 0.97, 0.98));
    for (let k = 0; k <= 12; k++) { const z = (h * 0.88 * k) / 12; fp(0, 1, z - 0.6, z + 0.6, c(0.93, 0.97, 0.98)); }
  }
  fp(0, 1, 0, tall ? 4 : 3, c(0.93, 0.91, 0.86)); fp(0, 1, 0, 1, c(0.76, 0.73, 0.68)); fp(0, 1, h - 2, h, shade(base, 0.15));
  if (spec.dec === 'shopwin' && mid) {
    // vitrine de bar : cadre sombre, verre chaud, reflets
    fp(0.1, 0.9, 5, h - 8, c(0.16, 0.1, 0.1)); fp(0.14, 0.86, 8, h - 11, c(0.95, 0.72, 0.4)); fp(0.14, 0.86, h * 0.55, h - 11, c(1, 0.82, 0.5));
    fp(0.2, 0.3, 8, h - 11, c(1, 0.92, 0.7), 0.5); fp(0.495, 0.505, 8, h - 11, c(0.16, 0.1, 0.1)); return;
  }
  if (!tall) return;
  if (spec.dec === 'neon') {
    fp(0.22, 0.78, h * 0.42, h * 0.84, c(0.08, 0.05, 0.12)); fp(0.25, 0.75, h * 0.45, h * 0.47, c(1, 0.3, 0.7)); fp(0.25, 0.75, h * 0.81, h * 0.83, c(1, 0.3, 0.7));
    fp(0.25, 0.27, h * 0.45, h * 0.83, c(1, 0.3, 0.7)); fp(0.73, 0.75, h * 0.45, h * 0.83, c(1, 0.3, 0.7)); fp(0.4, 0.6, h * 0.58, h * 0.7, c(0.3, 0.9, 1)); return;
  }
  if (spec.dec === 'window') {
    const zb = h * 0.36, zt = h * 0.8; const frame = c(0.93, 0.91, 0.86);
    fp(0.2, 0.8, zb, zt, frame);
    const gb = zb + 3, gt = zt - 3; const bands = 5;
    for (let k = 0; k < bands; k++) fp(0.26, 0.74, gb + ((gt - gb) * k) / bands, gb + ((gt - gb) * (k + 1)) / bands, mix(c(0.8, 0.92, 0.99), c(0.56, 0.78, 0.94), k / (bands - 1)));
    fp(0.26, 0.4, gt - 6, gt - 3, c(0.95, 0.98, 1)); fp(0.495, 0.505, gb, gt, frame); fp(0.26, 0.74, (gb + gt) / 2 - 0.5, (gb + gt) / 2 + 0.5, frame);
    fp(0.16, 0.84, zb - 3, zb, c(0.8, 0.72, 0.6));
  } else if (spec.dec === 'picture') {
    const zb = h * 0.5, zt = h * 0.78; fp(0.3, 0.7, zb, zt, c(0.32, 0.22, 0.16));
    const a = spec.art % 3; const top: C = a === 0 ? c(0.95, 0.7, 0.4) : a === 1 ? c(0.55, 0.7, 0.88) : c(0.88, 0.45, 0.45); const bot: C = a === 0 ? c(0.35, 0.5, 0.4) : a === 1 ? c(0.85, 0.8, 0.55) : c(0.95, 0.88, 0.75);
    fp(0.34, 0.66, zb + 2, (zb + zt) / 2, bot); fp(0.34, 0.66, (zb + zt) / 2, zt - 2, top);
  } else if (spec.dec === 'door') {
    fp(0.16, 0.84, 0, h * 0.92, c(0.88, 0.85, 0.78)); fp(0.2, 0.8, 0, h * 0.88, c(0.4, 0.26, 0.17));
    fp(0.26, 0.74, h * 0.1, h * 0.45, shade(c(0.4, 0.26, 0.17), -0.12)); fp(0.26, 0.74, h * 0.52, h * 0.82, shade(c(0.4, 0.26, 0.17), -0.12)); fp(0.68, 0.74, h * 0.46, h * 0.52, c(0.9, 0.78, 0.4));
  }
}

// ------------------------------------------------------------------ icônes 10x10 (émotes)
const PAL: Record<string, C> = { k: c(0.15, 0.12, 0.18), r: c(0.9, 0.25, 0.3), p: c(1, 0.65, 0.72), w: c(1, 1, 1), y: c(1, 0.85, 0.25), o: c(1, 0.6, 0.2), b: c(0.35, 0.6, 0.95), c: c(0.55, 0.85, 1), g: c(0.4, 0.75, 0.4), n: c(0.55, 0.38, 0.25), s: c(0.62, 0.65, 0.72), d: c(0.35, 0.37, 0.45), v: c(0.62, 0.45, 0.9) };
const ART: Record<string, string[]> = {
  heart: ['..........', '.rr....rr.', 'rrrr..rrrr', 'rwrrrrrrrr', 'rrrrrrrrrr', '.rrrrrrrr.', '..rrrrrr..', '...rrrr...', '....rr....', '..........'],
  zzz: ['cccccc....', '...cc.....', '..cc......', '.cccccc...', '......ccc.', '.......c..', '......ccc.', '..........', '..........', '..........'],
  fork: ['.s.s.s..ww', '.s.s.s..ww', '.s.s.s..ww', '.sssss..ww', '..sss...ww', '..sss...ww', '..sss...ww', '..sss...ww', '..sss...ww', '..........'],
  cloud: ['..........', '..sssss...', '.sssssss..', 'ssssssssss', 'ssssssssss', '.ssssssss.', '..b..b..b.', '.b..b..b..', '..b..b....', '..........'],
  anger: ['..........', '.rr....rr.', '.rrr..rrr.', '..rrrrrr..', '...rrrr...', '..rrrrrr..', '.rrr..rrr.', '.rr....rr.', '..........', '..........'],
  note: ['....vvvv..', '....v..v..', '....v..v..', '....v..v..', '....v.vv..', '.vvv..vv..', 'vvvvv.....', 'vvvv......', '.vv.......', '..........'],
  smile: ['..yyyyyy..', '.yyyyyyyy.', 'yykyyykyyy', 'yykyyykyyy', 'yyyyyyyyyy', 'ykyyyyyyky', 'yykkkkkkyy', '.yyyyyyyy.', '..yyyyyy..', '..........'],
  spark: ['....y.....', '....y.....', '...yyy....', 'yyyywyyyy.', '...yyy....', '....y..y..', '.......y..', '......yyy.', '.......y..', '..........'],
  sun: ['....o.....', '.o..o..o..', '..oyyyo...', '.oyyyyyo..', 'ooyyyyyoo.', '.oyyyyyo..', '..oyyyo...', '.o..o..o..', '....o.....', '..........'],
  dots: ['..........', '..........', '..........', '.ss.ss.ss.', '.ss.ss.ss.', '..........', '..........', '..........', '..........', '..........'],
  talk: ['.wwwwwwww.', 'wwwwwwwwww', 'wwkwwkwwkw', 'wwwwwwwwww', '.wwwwwwww.', '...ww.....', '..ww......', '..........', '..........', '..........'],
  sweat: ['....cc....', '...cccc...', '..cwcccc..', '..ccccbc..', '..cccbbc..', '...cbbc...', '....cc....', '..........', '..........', '..........'],
  bubbles: ['..cc......', '.cwcc.cc..', '.cccc.cwc.', '..cc..ccc.', '......cc..', '..cc......', '.cwcc.....', '.cccc.....', '..cc......', '..........'],
  pray: ['....yy....', '...yyyy...', '....yy....', '...wwww...', '..wwwwww..', '..wwwwww..', '...wwww...', '..........', '..........', '..........'],
};
export const ICON_NAMES = Object.keys(ART);
const iconCache = new Map<string, HTMLCanvasElement>();
export function iconCanvas(name: string): HTMLCanvasElement {
  const hit = iconCache.get(name); if (hit) return hit;
  const rows = ART[name] ?? ART.dots; const cv = canvas(12, 12); const g = ctx2(cv);
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (PAL[ch]) px(g, x + 1, y + 1, PAL[ch]); }));
  outline(cv, -0.55); iconCache.set(name, cv); return cv;
}
export function bubbleCanvas(): HTMLCanvasElement {
  const cv = canvas(18, 20); const g = ctx2(cv); const edge = c(0.18, 0.16, 0.24), fill = c(0.97, 0.97, 1);
  for (let y = 0; y < 15; y++) for (let x = 0; x < 18; x++) {
    if ((x < 2 && y < 2) || (x > 15 && y < 2) || (x < 2 && y > 12) || (x > 15 && y > 12)) continue;
    const e = x === 0 || x === 17 || y === 0 || y === 14 || ((x === 1 || x === 16) && (y === 1 || y === 13)); px(g, x, y, e ? edge : fill);
  }
  for (let k = 0; k < 4; k++) { px(g, 7 + (k >> 1), 15 + k, edge); if (k > 0) px(g, 10 - (k >> 1), 15 + k, edge); if (k < 3) { px(g, 8, 15 + k, fill); px(g, 9, 15 + k, fill); } }
  return cv;
}
export function shadowCanvas(): HTMLCanvasElement {
  const cv = canvas(24, 12); const g = ctx2(cv);
  for (let y = 0; y < 12; y++) for (let x = 0; x < 24; x++) { const dx = (x + 0.5 - 12) / 12, dy = (y + 0.5 - 6) / 6, d = dx * dx + dy * dy; if (d < 1) px(g, x, y, c(0, 0, 0), 0.3 * (1 - d * 0.55)); }
  return cv;
}
export function ringCanvas(): HTMLCanvasElement {
  const cv = canvas(40, 20); const g = ctx2(cv);
  for (let y = 0; y < 20; y++) for (let x = 0; x < 40; x++) { const dx = (x + 0.5 - 20) / 19.5, dy = (y + 0.5 - 10) / 9.5, d = dx * dx + dy * dy; if (d < 1 && d > 0.68) px(g, x, y, c(1, 0.92, 0.5), 0.95); else if (d <= 0.68 && d > 0.5) px(g, x, y, c(1, 0.92, 0.5), 0.18); }
  return cv;
}
export function glowCanvas(): HTMLCanvasElement {
  const cv = canvas(256, 256); const g = cv.getContext('2d')!; const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); return cv;
}
