/** Sprites de personnages procéduraux (assets PROVISOIRES) : 2 vues (face/dos), poses animées, visages en calque, allongé, portrait. */
import { c, canvas, crisp, ctx2, hash2, outline, poly, px, rect, shade, type C } from './core';
import type { Look } from '../sim/roster';

export const CW = 28, CH = 48, FEET_Y = 45, LW = 60, LH = 44;
const SKINS: C[] = [c(0.97, 0.82, 0.71), c(0.91, 0.73, 0.56), c(0.78, 0.58, 0.41), c(0.6, 0.42, 0.3), c(0.42, 0.28, 0.2)];
const HAIRS: Record<string, C> = { auburn: c(0.62, 0.27, 0.14), black: c(0.11, 0.1, 0.13), darkbrown: c(0.24, 0.15, 0.11), gray: c(0.58, 0.58, 0.61), blond: c(0.9, 0.76, 0.42), silver: c(0.82, 0.82, 0.86) };
const COLORS: Record<string, C> = { yellow: c(0.95, 0.76, 0.22), green: c(0.33, 0.58, 0.4), purple: c(0.52, 0.36, 0.72), red: c(0.8, 0.22, 0.22), gray: c(0.52, 0.54, 0.58), teal: c(0.2, 0.56, 0.56), black: c(0.16, 0.16, 0.19), navy: c(0.18, 0.22, 0.42), denim: c(0.3, 0.45, 0.7), dark: c(0.22, 0.24, 0.32), light: c(0.6, 0.72, 0.88), brown: c(0.38, 0.26, 0.19), white: c(0.93, 0.93, 0.96) };
const SHOES: Record<string, C> = { white: c(0.92, 0.92, 0.95), brown: c(0.36, 0.24, 0.17), black: c(0.15, 0.15, 0.18) };

interface FrameDef { bob: number; ll?: number; rl?: number; la?: number; ra?: number; sp?: number; la_mode?: string; ra_mode?: string; arms?: string; ad?: number }
export const POSES: Record<string, FrameDef[]> = {
  stand: [{ bob: 0 }, { bob: -1 }],
  walk: [{ bob: 0, ll: 0, rl: 1, la: 1, ra: -1, sp: 1 }, { bob: -1, ll: 0, rl: 0, la: 0, ra: 0, sp: 0 }, { bob: 0, ll: 1, rl: 0, la: -1, ra: 1, sp: 1 }, { bob: -1, ll: 0, rl: 0, la: 0, ra: 0, sp: 0 }],
  sit: [{ bob: 6 }, { bob: 5 }],
  sit_eat: [{ bob: 6, ra_mode: 'eat' }, { bob: 6, ra_mode: 'eat_up' }],
  sit_read: [{ bob: 6, arms: 'book' }, { bob: 5, arms: 'book' }],
  use: [{ bob: 0, arms: 'use', ad: 0 }, { bob: 0, arms: 'use', ad: -1 }],
  talk: [{ bob: 0, ra_mode: 'gest' }, { bob: -1, ra_mode: 'gest2' }, { bob: 0, la_mode: 'gest', ra_mode: 'down' }],
  wash: [{ bob: 0, arms: 'wash', ad: 0 }, { bob: 0, arms: 'wash', ad: 1 }],
};
export interface CharAssets { frames: Record<string, { f: HTMLCanvasElement[]; b: HTMLCanvasElement[] }>; lie: HTMLCanvasElement[]; faces: Record<string, HTMLCanvasElement>; portrait: HTMLCanvasElement }
const cache = new Map<string, CharAssets>();
export const EXPRESSIONS = ['neutral', 'happy', 'sad', 'angry', 'tired', 'surprised'];

export function buildChar(cid: number, look: Look, blanket: C): CharAssets {
  const key = `${cid}|${JSON.stringify(look)}`; const hit = cache.get(key); if (hit) return hit;
  const out: CharAssets = { frames: {}, lie: [], faces: {}, portrait: canvas(1, 1) };
  for (const pose of Object.keys(POSES)) out.frames[pose] = { f: POSES[pose].map((fd) => figure(look, true, pose, fd)), b: POSES[pose].map((fd) => figure(look, false, pose, fd)) };
  out.lie = [lying(look, blanket, 0), lying(look, blanket, 1)];
  for (const e of EXPRESSIONS) out.faces[e] = face(look, e);
  out.portrait = portrait(look); cache.set(key, out); return out;
}
const skinOf = (l: Look) => SKINS[Math.max(0, Math.min(4, l.skin))];

function figure(look: Look, front: boolean, pose: string, fd: FrameDef): HTMLCanvasElement {
  const cv = canvas(CW, CH); const g = ctx2(cv);
  const skin = skinOf(look), skinD = shade(skin, -0.14); const topC = COLORS[look.top_color] ?? c(0.5, 0.5, 0.5), botC = COLORS[look.bottom_color] ?? c(0.2, 0.2, 0.3);
  const shoeC = SHOES[look.shoes] ?? SHOES.white; const hairC = HAIRS[look.hair_color] ?? c(0.1, 0.1, 0.1);
  const s = fd.bob, sitting = pose.startsWith('sit'); const tw = 10 + 2 * look.build, tx0 = 14 - Math.floor(tw / 2), yoff = -look.height;
  if (['long', 'bob', 'braids'].includes(look.hair)) {
    const hy = 8 + s + yoff, hl = { long: 16, bob: 9, braids: 18 }[look.hair]!; rect(g, 8, hy, 12, hl, shade(hairC, -0.22));
    if (look.hair === 'braids') for (let k = 0; k < 12; k += 2) rect(g, 8 + k, hy, 1, hl, shade(hairC, -0.35));
  }
  if (!(sitting && !front)) legs(g, look, sitting, fd, yoff, botC, look.bottom, skin, shoeC);
  const ty = 19 + s + yoff; rect(g, tx0, ty, tw, 13, topC);
  if (!sitting) { rect(g, tx0, 31 + yoff + Math.min(s, 0), tw, 2, botC); rect(g, tx0, 31 + yoff + Math.min(s, 0), tw, 1, shade(botC, -0.3)); }
  else rect(g, tx0, 31 + s + yoff - 1, tw, 2, botC);
  topDetails(g, look.top, topC, front, tx0, tw, ty, skin);
  rect(g, tx0, ty, 1, 12, shade(topC, 0.07)); rect(g, tx0 + tw - 1, ty, 1, 12, shade(topC, -0.2)); rect(g, tx0, ty + 11, tw, 1, shade(topC, -0.14));
  rect(g, 13, 17 + s + yoff, 2, 2, skinD);
  arms(g, pose, fd, tx0, tw, ty, topC, look.top, skin);
  const hy2 = 6 + s + yoff; rect(g, 9, hy2, 10, 11, skin); rect(g, 18, hy2 + 1, 1, 10, shade(skin, -0.09)); rect(g, 9, hy2 + 10, 10, 1, shade(skin, -0.07)); rect(g, 10, hy2 + 1, 1, 4, shade(skin, 0.05));
  px(g, 8, hy2 + 5, skinD); px(g, 19, hy2 + 5, skinD);
  if (front) {
    if (look.acc === 'beard') { const bc = shade(hairC, -0.1); rect(g, 9, hy2 + 7, 10, 4, bc); rect(g, 11, hy2 + 7, 6, 1, shade(bc, 0.1)); rect(g, 12, hy2 + 7, 4, 1, skin); rect(g, 12, hy2 + 8, 4, 1, shade(skin, -0.05)); }
    else if (look.acc === 'stubble') { for (let yy = hy2 + 7; yy < hy2 + 11; yy++) for (let xx = 9; xx < 19; xx++) if (hash2(xx, yy, 77) > 0.5) px(g, xx, yy, shade(skin, -0.28)); }
    else if (look.acc === 'earrings') { px(g, 8, hy2 + 7, c(0.95, 0.8, 0.3)); px(g, 19, hy2 + 7, c(0.95, 0.8, 0.3)); }
  }
  hair(g, look.hair, hairC, front, hy2, skin);
  if (look.acc === 'cap') { const cc = c(0.12, 0.17, 0.3); rect(g, 8, hy2 - 1, 12, 4, cc); rect(g, 8, hy2 - 1, 12, 1, shade(cc, 0.2)); if (front) { rect(g, 9, hy2 + 3, 10, 1, shade(cc, -0.3)); rect(g, 13, hy2, 2, 2, c(0.95, 0.8, 0.3)); } }
  if (look.acc === 'beanie') { const bc = c(0.7, 0.18, 0.2); rect(g, 8, hy2 - 3, 12, 5, bc); rect(g, 8, hy2 + 1, 12, 2, shade(bc, -0.2)); rect(g, 12, hy2 - 5, 4, 2, bc); for (let k = 8; k < 20; k += 2) px(g, k, hy2 - 1, shade(bc, 0.2)); }
  if (look.acc === 'shades' && front) { const sg = c(0.06, 0.06, 0.1); rect(g, 9, hy2 + 4, 10, 3, sg); px(g, 10, hy2 + 4, c(0.5, 0.6, 0.9)); px(g, 15, hy2 + 4, c(0.5, 0.6, 0.9)); }
  crisp(cv); outline(cv); return cv;
}
function legs(g: CanvasRenderingContext2D, look: Look, sitting: boolean, fd: FrameDef, yoff: number, botC: C, botStyle: string, skin: C, shoeC: C) {
  const spread = fd.sp ?? 0, ll = fd.ll ?? 0, rl = fd.rl ?? 0, legsTop = 32 + yoff, wide = look.build > 0 ? 1 : 0;
  const lx = 10 - wide - spread, rx = 14 + spread, lw = 4 + wide, rw = 4 + wide; const dark = shade(botC, -0.18), hi = shade(botC, 0.07);
  if (sitting) {
    const thY = 38; rect(g, lx, thY, lw + rw, 4, botC); rect(g, lx, thY, lw + rw, 1, hi); rect(g, lx + lw + rw - 1, thY, 1, 4, dark); rect(g, lx + lw - 1, thY + 1, 1, 3, dark); rect(g, lx, thY + 3, lw + rw, 1, dark);
    const lc = botStyle === 'shorts' || botStyle === 'skirt' ? skin : botC; const shin = thY + 4;
    rect(g, lx, shin, lw, 45 - shin, lc); rect(g, rx, shin, rw, 45 - shin, lc); rect(g, lx, shin, 1, 45 - shin, shade(lc, 0.06)); rect(g, rx + rw - 1, shin, 1, 45 - shin, shade(lc, -0.16));
    rect(g, lx - 1, 45, lw + 2, 2, shoeC); rect(g, rx, 45, rw + 1, 2, shoeC); rect(g, lx - 1, 47, lw + 2, 1, shade(shoeC, -0.38)); rect(g, rx, 47, rw + 1, 1, shade(shoeC, -0.38)); return;
  }
  const split = botStyle === 'shorts' || botStyle === 'skirt' ? 38 : 99;
  const leg = (x: number, w: number, yEnd: number) => {
    const bodyEnd = yEnd - 2;
    for (let yy = legsTop; yy < bodyEnd; yy++) { rect(g, x, yy, w, 1, yy < split ? botC : skin); px(g, x, yy, yy < split ? hi : shade(skin, 0.04)); px(g, x + w - 1, yy, yy < split ? dark : shade(skin, -0.14)); }
    rect(g, x - 1, bodyEnd, w + 2, 2, shoeC); rect(g, x - 1, yEnd - 1, w + 2, 1, shade(shoeC, -0.38)); px(g, x, bodyEnd, shade(shoeC, 0.18));
  };
  leg(lx, lw, 44 - ll); leg(rx, rw, 44 - rl);
  if (botStyle === 'skirt') { rect(g, 8, 31 + yoff, 12, 8, shade(botC, -0.02)); rect(g, 8, 37 + yoff, 12, 1, shade(botC, -0.2)); rect(g, 9, 32 + yoff, 1, 6, shade(botC, 0.08)); rect(g, 19, 32 + yoff, 1, 6, shade(botC, -0.18)); }
}
function topDetails(g: CanvasRenderingContext2D, style: string, col: C, front: boolean, tx0: number, tw: number, ty: number, skin: C) {
  switch (style) {
    case 'hoodie':
      rect(g, 11, ty - 1, 6, 3, shade(col, -0.12));
      if (front) { rect(g, 12, ty + 1, 4, 1, shade(skin, -0.12)); px(g, 12, ty + 3, c(0.95, 0.95, 0.95)); px(g, 15, ty + 3, c(0.95, 0.95, 0.95)); rect(g, tx0 + 2, ty + 8, tw - 4, 3, shade(col, -0.14)); rect(g, tx0 + 2, ty + 8, tw - 4, 1, shade(col, -0.24)); }
      else { rect(g, 10, ty - 2, 8, 4, shade(col, -0.08)); rect(g, 11, ty - 2, 6, 1, shade(col, 0.08)); } break;
    case 'sweater':
      rect(g, tx0, ty + 10, tw, 3, shade(col, -0.16)); for (let k = 0; k < tw; k += 2) rect(g, tx0 + k, ty + 10, 1, 3, shade(col, -0.26)); rect(g, 11, ty, 6, 1, shade(col, -0.15)); if (front) rect(g, 12, ty, 4, 1, shade(skin, -0.12)); break;
    case 'cardigan':
      if (front) { rect(g, 12, ty, 4, 12, c(0.93, 0.89, 0.8)); rect(g, 11, ty, 1, 12, shade(col, -0.25)); rect(g, 16, ty, 1, 12, shade(col, -0.25)); for (const k of [3, 6, 9]) px(g, 13, ty + k, c(0.4, 0.3, 0.2)); rect(g, 12, ty, 4, 1, shade(skin, -0.1)); }
      else rect(g, tx0, ty + 10, tw, 2, shade(col, -0.14)); break;
    case 'flannel':
      for (let yy = ty; yy < ty + 12; yy += 3) rect(g, tx0, yy, tw, 1, shade(col, -0.22)); for (let xx = tx0; xx < tx0 + tw; xx += 3) rect(g, xx, ty, 1, 12, shade(col, 0.1));
      if (front) { rect(g, 13, ty, 2, 12, shade(col, -0.2)); rect(g, 12, ty, 4, 1, shade(skin, -0.1)); } break;
    case 'blazer':
      rect(g, tx0, ty, tw, 12, shade(col, -0.04)); if (front) { rect(g, 12, ty, 4, 12, c(0.95, 0.95, 0.97)); rect(g, 13, ty + 1, 2, 7, c(0.7, 0.14, 0.2)); rect(g, 11, ty, 1, 8, shade(col, -0.3)); rect(g, 16, ty, 1, 8, shade(col, -0.3)); px(g, 12, ty + 9, c(0.9, 0.8, 0.4)); px(g, tx0 + 1, ty + 4, shade(col, 0.2)); }
      else { rect(g, tx0, ty + 9, tw, 3, shade(col, -0.14)); rect(g, 13, ty + 2, 1, 9, shade(col, -0.25)); } break;
    case 'jacket':
      rect(g, 11, ty - 1, 6, 2, shade(col, 0.1)); rect(g, tx0, ty + 10, tw, 2, shade(col, -0.25)); if (front) { rect(g, 13, ty, 2, 12, c(0.78, 0.78, 0.82)); rect(g, tx0 + 1, ty + 2, 2, 3, shade(col, 0.18)); rect(g, tx0 + tw - 3, ty + 6, 2, 3, shade(col, -0.2)); rect(g, 11, ty, 2, 2, shade(col, 0.1)); rect(g, 15, ty, 2, 2, shade(col, 0.1)); } else rect(g, tx0 + 1, ty + 3, tw - 2, 1, shade(col, -0.2)); break;
    case 'uniform':
      if (front) { rect(g, 12, ty, 4, 12, c(0.9, 0.92, 0.96)); rect(g, 13, ty, 2, 9, c(0.1, 0.1, 0.16)); rect(g, 11, ty, 1, 4, shade(col, -0.3)); rect(g, 16, ty, 1, 4, shade(col, -0.3)); rect(g, tx0 + tw - 4, ty + 3, 3, 3, c(0.95, 0.8, 0.25)); px(g, tx0 + 1, ty + 3, c(0.95, 0.95, 0.5)); rect(g, tx0, ty + 9, tw, 2, c(0.12, 0.12, 0.14)); px(g, 13, ty + 9, c(0.85, 0.75, 0.3)); px(g, 14, ty + 9, c(0.85, 0.75, 0.3)); }
      else { rect(g, tx0, ty + 9, tw, 2, c(0.12, 0.12, 0.14)); rect(g, tx0 + 1, ty + 1, tw - 2, 2, c(0.95, 0.9, 0.3), 0.9); } break;
    case 'tank': rect(g, tx0, ty, 2, 4, skin); rect(g, tx0 + tw - 2, ty, 2, 4, skin); if (front) rect(g, tx0 + 2, ty, tw - 4, 2, skin); rect(g, tx0, ty + 11, tw, 1, shade(col, -0.14)); break;
    case 'tee': if (front) { rect(g, 12, ty, 4, 1, shade(skin, -0.1)); rect(g, 12, ty + 1, 4, 1, shade(col, -0.1)); } else rect(g, 12, ty, 4, 1, shade(col, -0.1)); break;
  }
}
function arm(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, sleeve: C, sleeveLen: number, skin: C, outerLeft: boolean) {
  for (let yy = 0; yy < h; yy++) { const col = yy < sleeveLen ? sleeve : skin; rect(g, x, y + yy, w, 1, col); px(g, outerLeft ? x : x + w - 1, y + yy, shade(col, -0.17)); }
  rect(g, x, y + h - 2, w, 2, shade(skin, -0.05));
}
function arms(g: CanvasRenderingContext2D, _pose: string, fd: FrameDef, tx0: number, tw: number, ty: number, topC: C, topStyle: string, skin: C) {
  const st = topStyle === 'tee' || topStyle === 'tank' ? topStyle : 'long'; const slv = st === 'long' ? 12 : st === 'tee' ? 4 : 0;
  const la = fd.la ?? 0, ra = fd.ra ?? 0, lm = fd.la_mode ?? 'down', rm = fd.ra_mode ?? 'down', ad = fd.ad ?? 0; const lx = tx0 - 3, rx = tx0 + tw; const sk = shade(skin, -0.03);
  if (fd.arms === 'book') {
    arm(g, lx + 1, ty, 3, 8, topC, Math.min(slv, 8), skin, true); arm(g, rx - 1, ty, 3, 8, topC, Math.min(slv, 8), skin, false);
    rect(g, 11, ty + 7, 7, 5, c(0.55, 0.3, 0.3)); rect(g, 12, ty + 8, 5, 3, c(0.95, 0.93, 0.85)); rect(g, 14, ty + 8, 1, 3, c(0.7, 0.68, 0.6)); return;
  }
  if (fd.arms === 'use') {
    arm(g, lx + 1, ty, 3, 8, topC, Math.min(slv, 8), skin, true); arm(g, rx - 1, ty, 3, 8, topC, Math.min(slv, 8), skin, false);
    const hy = ty + 7 + ad; rect(g, lx + 3, hy, 3, 3, sk); rect(g, rx - 4, hy + 1 - ad * 2, 3, 3, sk); return;
  }
  if (fd.arms === 'wash') {
    rect(g, lx, ty, 3, 4, slv > 0 ? topC : skin); rect(g, rx, ty, 3, 4, slv > 0 ? topC : skin);
    arm(g, lx - 1, ty - 8 + ad, 3, 9, topC, Math.min(slv, 4), skin, true); arm(g, rx + 1, ty - 8 - ad, 3, 9, topC, Math.min(slv, 4), skin, false); return;
  }
  if (lm === 'gest') { arm(g, lx - 2, ty - 3, 3, 8, topC, Math.min(slv, 5), skin, true); rect(g, lx, ty + 2, 3, 4, slv > 0 ? topC : skin); } else arm(g, lx, ty + la, 3, 11, topC, slv, skin, true);
  if (rm === 'gest') { arm(g, rx + 2, ty - 3, 3, 8, topC, Math.min(slv, 5), skin, false); rect(g, rx, ty + 2, 3, 4, slv > 0 ? topC : skin); }
  else if (rm === 'gest2') { arm(g, rx + 2, ty - 1, 3, 8, topC, Math.min(slv, 5), skin, false); rect(g, rx, ty + 2, 3, 4, slv > 0 ? topC : skin); }
  else if (rm === 'eat') { arm(g, rx, ty, 3, 8, topC, slv, skin, false); rect(g, rx - 2, ty + 5, 3, 3, shade(skin, -0.04)); }
  else if (rm === 'eat_up') { arm(g, rx, ty, 3, 6, topC, slv, skin, false); rect(g, rx - 4, ty - 2, 4, 4, slv > 0 ? topC : skin); rect(g, rx - 5, ty - 4, 3, 3, shade(skin, -0.04)); px(g, rx - 6, ty - 4, c(0.85, 0.85, 0.9)); }
  else arm(g, rx, ty + ra, 3, 11, topC, slv, skin, false);
}
function hair(g: CanvasRenderingContext2D, style: string, hc: C, front: boolean, hy: number, skin: C) {
  const hl = shade(hc, 0.18), hd = shade(hc, -0.18); const lens: Record<string, number> = { long: 16, bob: 9, braids: 19 }; const lens2: Record<string, number> = { long: 17, bob: 10, braids: 20 };
  const spikes: [number, number][] = [[10, -4], [12, -5], [15, -4], [17, -3], [13, -4]];
  if (front) {
    if (style === 'bald') { px(g, 11, hy + 1, shade(skin, 0.12)); px(g, 12, hy, shade(skin, 0.12)); return; }
    rect(g, 9, hy - 2, 10, 4, hc); rect(g, 10, hy - 3, 8, 1, hc); rect(g, 11, hy - 3, 3, 1, hl); rect(g, 12, hy - 2, 2, 1, hl); px(g, 9, hy + 2, hc); px(g, 18, hy + 2, hc);
    if (style === 'short' || style === 'messy') { rect(g, 9, hy + 2, 1, 3, hc); rect(g, 18, hy + 2, 1, 3, hc); px(g, 11, hy + 2, hc); px(g, 15, hy + 2, hc); px(g, 16, hy + 2, hc); }
    if (style === 'messy') { for (const p of spikes) px(g, p[0], hy + p[1], hc); rect(g, 10, hy + 2, 3, 2, hc); rect(g, 15, hy + 2, 3, 1, hc); }
    if (style === 'bun') { rect(g, 12, hy - 6, 4, 3, hc); rect(g, 13, hy - 6, 2, 1, hl); px(g, 12, hy - 4, hd); }
    if (style === 'afro') { rect(g, 6, hy - 6, 16, 10, hc); rect(g, 7, hy - 7, 14, 1, hc); rect(g, 8, hy - 8, 12, 1, hc); rect(g, 7, hy + 4, 2, 5, hc); rect(g, 19, hy + 4, 2, 5, hc); for (const q of [[9, -6], [13, -7], [17, -5], [11, -3], [16, -2]]) px(g, q[0], hy + q[1], hl); for (const q of [[7, 0], [20, 1], [10, -4]]) px(g, q[0], hy + q[1], hd); }
    if (style === 'mohawk') { rect(g, 9, hy + 1, 10, 2, shade(hc, -0.3)); rect(g, 12, hy - 7, 4, 8, hc); rect(g, 13, hy - 8, 2, 1, hc); rect(g, 13, hy - 7, 1, 6, hl); }
    if (style === 'ponytail') { rect(g, 9, hy + 2, 1, 3, hc); rect(g, 18, hy + 2, 1, 3, hc); px(g, 11, hy + 2, hc); px(g, 16, hy + 2, hc); px(g, 12, hy + 2, hc); px(g, 20, hy + 2, hc); rect(g, 19, hy + 1, 2, 3, hd); rect(g, 20, hy + 4, 2, 8, hc); px(g, 20, hy + 3, c(0.9, 0.3, 0.3)); }
    if (lens[style]) {
      const n = lens[style]; rect(g, 8, hy, 2, n, hc); rect(g, 18, hy, 2, n, hc); rect(g, 8, hy, 1, n, hd); rect(g, 19, hy, 1, n, hd); px(g, 13, hy - 2, hd); px(g, 14, hy - 1, hd); rect(g, 10, hy + 1, 3, 2, hc); rect(g, 16, hy + 1, 2, 2, hc);
      if (style === 'braids') { for (let k = 0; k < n; k += 3) { px(g, 8, hy + k, c(0.9, 0.3, 0.3)); px(g, 19, hy + k, c(0.9, 0.3, 0.3)); } px(g, 8, hy + n - 1, c(0.9, 0.3, 0.3)); px(g, 19, hy + n - 1, c(0.9, 0.3, 0.3)); }
    }
  } else {
    if (style === 'bald') { rect(g, 9, hy, 10, 11, skin); rect(g, 10, hy + 1, 2, 2, shade(skin, 0.1)); return; }
    rect(g, 9, hy - 2, 10, 13, hc); rect(g, 10, hy - 3, 8, 1, hc); rect(g, 11, hy - 3, 4, 1, hl); rect(g, 18, hy, 1, 11, hd);
    if (['short', 'messy', 'bun'].includes(style)) rect(g, 11, hy + 9, 6, 2, skin);
    if (style === 'messy') for (const p of spikes) px(g, p[0], hy + p[1], hc);
    if (style === 'bun') { rect(g, 12, hy - 6, 4, 3, hc); rect(g, 13, hy - 6, 2, 1, hl); }
    if (style === 'afro') { rect(g, 6, hy - 6, 16, 14, hc); rect(g, 7, hy - 7, 14, 1, hc); rect(g, 8, hy - 8, 12, 1, hc); rect(g, 10, hy + 8, 8, 1, hc); rect(g, 20, hy, 1, 8, hd); rect(g, 10, hy - 5, 4, 1, hl); }
    if (style === 'mohawk') { rect(g, 12, hy - 7, 4, 10, hc); rect(g, 13, hy - 8, 2, 1, hc); rect(g, 9, hy + 1, 10, 2, shade(hc, -0.3)); }
    if (style === 'ponytail') { rect(g, 12, hy + 3, 5, 5, hc); rect(g, 13, hy + 8, 3, 8, hc); rect(g, 13, hy + 8, 1, 8, hd); px(g, 14, hy + 3, c(0.9, 0.3, 0.3)); }
    if (lens2[style]) {
      const n = lens2[style]; rect(g, 8, hy - 1, 12, n, hc); rect(g, 8, hy - 1, 1, n, hd); rect(g, 19, hy - 1, 1, n, hd); rect(g, 13, hy + 2, 1, n - 3, hd);
      if (style === 'braids') for (let k = 9; k < 19; k += 3) rect(g, k, hy + 2, 1, n - 3, hd);
    }
  }
}
function disc(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, col: C) { for (let y = Math.floor(cy - r) - 1; y < cy + r + 2; y++) for (let x = Math.floor(cx - r) - 1; x < cx + r + 2; x++) { const dx = x + 0.5 - cx, dy = y + 0.5 - cy; if (dx * dx + dy * dy <= r * r) px(g, x, y, col); } }
function para(g: CanvasRenderingContext2D, a: { x: number; y: number }, b: { x: number; y: number }, th: number, col: C) { poly(g, [{ x: a.x, y: a.y - th / 2 }, { x: b.x, y: b.y - th / 2 }, { x: b.x, y: b.y + th / 2 }, { x: a.x, y: a.y + th / 2 }], col); }
function lying(look: Look, blanket: C, f: number): HTMLCanvasElement {
  const cv = canvas(LW, LH); const g = ctx2(cv); const skin = skinOf(look), hairC = HAIRS[look.hair_color] ?? c(0.1, 0.1, 0.1), topC = COLORS[look.top_color] ?? c(0.5, 0.5, 0.5);
  if (['long', 'bob', 'braids'].includes(look.hair)) para(g, { x: 50, y: 15 }, { x: 43, y: 18.5 }, 8, shade(hairC, -0.1));
  para(g, { x: 46, y: 15.5 }, { x: 38, y: 19.5 }, 11, topC); para(g, { x: 46, y: 10.5 }, { x: 38, y: 14.5 }, 1.5, shade(topC, 0.14));
  disc(g, 50, 12, 5.2, skin); disc(g, 51.5, 13, 3, shade(skin, 0.06));
  if (look.hair !== 'bald') { disc(g, 49.5, 9.2, 5, hairC); disc(g, 52.5, 12.5, 2.2, skin); px(g, 50, 7, shade(hairC, 0.2)); px(g, 51, 7, shade(hairC, 0.2)); }
  px(g, 52, 12, c(0.15, 0.1, 0.12)); px(g, 53, 12, c(0.15, 0.1, 0.12));
  const th = 12 + f; para(g, { x: 41, y: 19 }, { x: 9, y: 35 }, th, shade(blanket, 0.16));
  para(g, { x: 41, y: 19 - th / 2 + 0.75 }, { x: 9, y: 35 - th / 2 + 0.75 }, 1.6, shade(blanket, 0.32)); para(g, { x: 41, y: 19 }, { x: 36, y: 21.5 }, th, shade(blanket, 0.22));
  crisp(cv); outline(cv); return cv;
}
function face(look: Look, expr: string): HTMLCanvasElement {
  const cv = canvas(10, 8); const g = ctx2(cv); const hairC = HAIRS[look.hair_color] ?? c(0.1, 0.1, 0.1); const skin = skinOf(look);
  const ink = c(0.12, 0.09, 0.13), brow = look.hair !== 'bald' ? shade(hairC, -0.15) : shade(skin, -0.45), mouth = c(0.55, 0.22, 0.25);
  switch (expr) {
    case 'tired': rect(g, 1, 3, 3, 1, ink); rect(g, 6, 3, 3, 1, ink); rect(g, 1, 1, 3, 1, brow); rect(g, 6, 1, 3, 1, brow); break;
    case 'surprised': rect(g, 2, 2, 1, 3, ink); rect(g, 7, 2, 1, 3, ink); rect(g, 1, 0, 3, 1, brow); rect(g, 6, 0, 3, 1, brow); break;
    case 'angry': rect(g, 2, 2, 1, 2, ink); rect(g, 7, 2, 1, 2, ink); for (const p of [[1, 0], [2, 1], [3, 1], [8, 0], [7, 1], [6, 1]]) px(g, p[0], p[1], brow); break;
    case 'sad': rect(g, 2, 2, 1, 2, ink); rect(g, 7, 2, 1, 2, ink); for (const p of [[1, 1], [2, 0], [3, 0], [8, 1], [7, 0], [6, 0]]) px(g, p[0], p[1], brow); break;
    default: rect(g, 2, 2, 1, 2, ink); rect(g, 7, 2, 1, 2, ink); rect(g, 1, 1, 3, 1, brow); rect(g, 6, 1, 3, 1, brow);
  }
  switch (expr) {
    case 'happy': px(g, 3, 5, mouth); px(g, 6, 5, mouth); rect(g, 4, 6, 2, 1, mouth); px(g, 1, 5, c(0.95, 0.55, 0.55), 0.7); px(g, 8, 5, c(0.95, 0.55, 0.55), 0.7); break;
    case 'sad': rect(g, 4, 5, 2, 1, mouth); px(g, 3, 6, mouth); px(g, 6, 6, mouth); break;
    case 'angry': rect(g, 3, 6, 4, 1, mouth); break;
    case 'surprised': rect(g, 4, 5, 2, 2, mouth); break;
    default: rect(g, 4, 6, 2, 1, mouth);
  }
  if (look.acc === 'glasses') { const gl = c(0.16, 0.13, 0.22); for (const gx of [0, 5]) { rect(g, gx, 1, 5, 1, gl); rect(g, gx, 4, 5, 1, gl); rect(g, gx, 1, 1, 4, gl); rect(g, gx + 4, 1, 1, 4, gl); } px(g, 5, 2, gl); px(g, 4, 2, gl); }
  return cv;
}
function portrait(look: Look): HTMLCanvasElement {
  const body = figure(look, true, 'stand', { bob: 0 }); const f = face(look, 'neutral'); const g = ctx2(body); g.drawImage(f, 9, 8 - look.height);
  const out = canvas(22, 26); ctx2(out).drawImage(body, 3, 0, 22, 26, 0, 0, 22, 26); return out;
}
