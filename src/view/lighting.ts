import Phaser from 'phaser';
import type { World } from '../sim/world';
import { FURN } from '../sim/defs';
import * as L from '../sim/layout';
import { glowCanvas } from '../art/core';
import { texKey } from './texreg';
import { toScreen } from './iso';

type RGB = [number, number, number];
const STOPS: [number, RGB][] = [
  [0, [0.27, 0.31, 0.52]], [5, [0.3, 0.34, 0.55]], [6.5, [0.8, 0.64, 0.66]], [8, [1, 0.93, 0.84]], [11, [1, 1, 0.98]], [16, [1, 0.97, 0.9]],
  [18.5, [1, 0.76, 0.56]], [20, [0.56, 0.44, 0.66]], [21.5, [0.34, 0.35, 0.56]], [24, [0.27, 0.31, 0.52]],
];
export function ambientAt(h: number): RGB {
  for (let i = 0; i < STOPS.length - 1; i++) { const [a, ca] = STOPS[i], [b, cb] = STOPS[i + 1]; if (h >= a && h <= b) { const t = (h - a) / (b - a); return [ca[0] + (cb[0] - ca[0]) * t, ca[1] + (cb[1] - ca[1]) * t, ca[2] + (cb[2] - ca[2]) * t]; } }
  return STOPS[0][1];
}
interface Light { x: number; y: number; r: number; color: number; energy: number; room?: string; kind: string; fid?: number }

/** Jour/nuit : une carte de lumière (ambiance + halos additifs) multipliée sur la scène, comme Light2D de Godot. */
export class Lighting {
  rt!: Phaser.GameObjects.RenderTexture; stamp: Phaser.GameObjects.Image; lights: Light[] = []; darkness = 0; daylight = 1; flick = 0; active = 0;
  constructor(public scene: Phaser.Scene, public world: World) {
    this.stamp = scene.make.image({ key: texKey(scene, glowCanvas()), add: false }).setBlendMode(Phaser.BlendModes.ADD);
    this.rt = scene.add.renderTexture(0, 0, scene.scale.width, scene.scale.height).setOrigin(0, 0).setDepth(8000).setBlendMode(Phaser.BlendModes.MULTIPLY);
    const bounds = new Map<string, { x0: number; y0: number; x1: number; y1: number }>();
    for (let y = 0; y < L.H; y++) for (let x = 0; x < L.W; x++) { const r = L.roomAt(x, y); if (!r || L.OUTDOOR.includes(r)) continue; const b = bounds.get(r); if (!b) bounds.set(r, { x0: x, y0: y, x1: x, y1: y }); else { b.x0 = Math.min(b.x0, x); b.y0 = Math.min(b.y0, y); b.x1 = Math.max(b.x1, x); b.y1 = Math.max(b.y1, y); } }
    for (const [r, b] of bounds) {
      const sw = b.x1 - b.x0 + 1, sh = b.y1 - b.y0 + 1; const pts = r === 'h' ? [{ x: 4.5, y: 8 }, { x: 13.5, y: 8 }, { x: 22.5, y: 8 }] : [{ x: b.x0 + sw * 0.5 + 0.5, y: b.y0 + sh * 0.5 + 0.5 }];
      const rad = r === 'h' ? 330 : (Math.max(sw, sh) * 0.5 + 2.6) * 46;
      for (const p of pts) { const s = toScreen(p.x, p.y); this.lights.push({ x: s.x, y: s.y - 34, r: rad, color: r === 'B' ? 0xff9a55 : 0xffd694, energy: 0, room: r, kind: 'room' }); }
    }
    for (const f of world.furn) {
      const d = FURN[f.def];
      if (d.light) { const s = toScreen(f.x + f.w * 0.5, f.y + f.d * 0.5); const kind = f.def === 'nightstand' ? 'nightstand' : f.def === 'streetlamp' ? 'street' : f.def === 'bar_sign' ? 'sign' : f.def === 'jukebox' ? 'juke' : 'lamp'; this.lights.push({ x: s.x, y: s.y - d.light.h, r: 165 * d.light.r, color: kind === 'sign' ? 0xff5ec8 : kind === 'juke' ? 0xff4fa0 : kind === 'street' ? 0xffe2a0 : 0xffd185, energy: 0, room: L.roomAt(f.x, f.y), kind, fid: f.i }); }
      if (f.def === 'tv') { const s = toScreen(f.x + 1, f.y - 0.2); this.lights.push({ x: s.x, y: s.y - 26, r: 190, color: 0x80b8ff, energy: 0, kind: 'tv' }); }
      if (f.def === 'altar') { const s = toScreen(f.x + 0.5, f.y + 0.5); this.lights.push({ x: s.x, y: s.y - 26, r: 80, color: 0xffd973, energy: 0, kind: 'altar' }); }
    }
  }
  resize(w: number, h: number) { this.rt.setSize(w, h); }
  update(dt: number) {
    const w = this.world; const hour = w.hour(); const amb = ambientAt(hour); const lum = amb[0] * 0.3 + amb[1] * 0.59 + amb[2] * 0.11;
    this.darkness = Math.max(0, Math.min(1, (0.97 - lum) / 0.55)); this.daylight = Math.max(0, Math.min(1, (hour - 6.8) / 2)) * Math.max(0, Math.min(1, (19 - hour) / 2.5));
    const awake = new Set<string>(), asleep = new Set<string>(); for (const c of w.chars) { if (c.away) continue; (c.isAsleep() ? asleep : awake).add(w.roomOf(c.pos)); }
    const k = dt > 0 ? 1 - Math.exp(-dt * 2.5) : 1; this.flick += dt * 11; const dk = this.darkness;
    const tvOn = w.furn.some((f) => f.def === 'tv' && f.on);
    for (const l of this.lights) {
      let t = 0; const r = l.room ?? '';
      switch (l.kind) {
        case 'room': t = r === 'h' ? dk * (awake.has(r) ? 0.55 : 0.38) : 'abcd'.includes(r) ? dk * (awake.has(r) ? 0.8 : asleep.has(r) ? 0 : 0.1) : dk * (awake.has(r) ? 0.85 : 0.28); break;
        case 'nightstand': t = dk * (awake.has(r) ? 0.8 : asleep.has(r) ? 0 : 0.25); break;
        case 'lamp': t = dk * (hour < 23.8 && hour > 5 ? 0.85 : 0.25); break;
        case 'street': t = dk * 0.95; break;
        case 'sign': t = w.barOpen() ? dk * (0.8 + 0.12 * Math.sin(this.flick * 0.7) * Math.sin(this.flick * 2.9)) : 0; break;
        case 'juke': t = w.furn[l.fid!].on ? 0.6 + 0.25 * Math.sin(this.flick * 0.9) : dk * 0.1; break;
        case 'tv': t = tvOn ? 0.75 + 0.18 * Math.sin(this.flick) * Math.sin(this.flick * 0.37) + 0.06 * Math.sin(this.flick * 2.3) : 0; break;
        case 'altar': t = (0.35 + 0.1 * Math.sin(this.flick * 0.9)) * dk; break;
      }
      l.energy += (t - l.energy) * (l.kind === 'tv' ? Math.min(1, dt * 8) : k);
      if (l.kind === 'tv') this.tvColor = Phaser.Display.Color.Interpolate.ColorWithColor(new Phaser.Display.Color(128, 184, 255), new Phaser.Display.Color(217, 153, 255), 100, Math.floor((0.5 + 0.5 * Math.sin(this.flick * 0.5)) * 50));
    }
  }
  tvColor: any = null;
  /** Dessine la carte de lumière pour la caméra courante. */
  render() {
    const cam = this.scene.cameras.main; const z = cam.zoom; const wv = cam.worldView;
    this.rt.setPosition(wv.x, wv.y).setScale(1 / z);
    const a = ambientAt(this.world.hour()); this.rt.fill(Phaser.Display.Color.GetColor(a[0] * 255, a[1] * 255, a[2] * 255), 1);
    this.active = 0;
    for (const l of this.lights) {
      if (l.energy < 0.02) continue; this.active++;
      let col = l.color; if (l.kind === 'tv' && this.tvColor) col = Phaser.Display.Color.GetColor(this.tvColor.r, this.tvColor.g, this.tvColor.b);
      const sx = (l.x - wv.x) * z, sy = (l.y - wv.y) * z; const s = (l.r / 128) * z;
      if (sx < -l.r * z || sy < -l.r * z || sx > this.scene.scale.width + l.r * z || sy > this.scene.scale.height + l.r * z) continue;
      this.stamp.setTint(col).setAlpha(Math.min(1, l.energy)).setScale(s, s * 0.62).setOrigin(0.5, 0.5);
      this.rt.draw(this.stamp, sx, sy);
    }
  }
}
