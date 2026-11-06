import Phaser from 'phaser';
import * as L from '../sim/layout';
import { toScreen } from './iso';
import { hash2 } from '../art/core';

/** Horizon urbain : rangées d'immeubles lointains (volumes isométriques voilés par la brume) tout autour de la carte jouable, pour que NORIA continue au-delà de ce qu'on voit.
 *  Purement décoratif (non simulé, aucun sol marchable) ; dessiné une fois par rangée, sous le sol. */
export class Skyline {
  g: Phaser.GameObjects.Graphics;
  constructor(scene: Phaser.Scene, private low: boolean) {
    this.g = scene.add.graphics().setDepth(-3100); this.draw();
  }
  private box(x: number, y: number, w: number, d: number, h: number, base: number[], haze: number, seed: number) {
    const g = this.g, P = (a: number, b: number, z: number) => { const s = toScreen(a, b); return { x: s.x, y: s.y - z }; };
    const mix = (c: number[], k: number) => { const hz = [0.36, 0.28, 0.5]; return Phaser.Display.Color.GetColor(((c[0] * (1 - haze) + hz[0] * haze) * k) * 255, ((c[1] * (1 - haze) + hz[1] * haze) * k) * 255, ((c[2] * (1 - haze) + hz[2] * haze) * k) * 255); };
    const quad = (pts: { x: number; y: number }[], col: number) => { g.fillStyle(col, 1); g.beginPath(); g.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y); g.closePath(); g.fillPath(); };
    quad([P(x, y + d, 0), P(x + w, y + d, 0), P(x + w, y + d, h), P(x, y + d, h)], mix(base, 0.92));
    quad([P(x + w, y, 0), P(x + w, y + d, 0), P(x + w, y + d, h), P(x + w, y, h)], mix(base, 0.68));
    quad([P(x, y, h), P(x + w, y, h), P(x + w, y + d, h), P(x, y + d, h)], mix(base, 1.12));
    // fenêtres allumées (quelques points chauds sur la face sud)
    const rows = Math.floor(h / 14), cols = Math.max(1, Math.floor(w * 1.4));
    for (let r = 1; r < rows; r++) for (let c = 0; c < cols; c++) if (hash2(seed + r, c, 9) > 0.62) { const a = x + (c + 0.35) * (w / cols), p = P(a, y + d, r * 14); g.fillStyle(0xffd488, 0.7 - haze * 0.4); g.fillRect(p.x - 1.5, p.y - 3, 3, 4); }
    if (h > 140 && hash2(seed, 5, 3) > 0.5) { const t = P(x + w * 0.5, y + d * 0.5, h); g.fillStyle(0xcfd2dd, 0.8); g.fillRect(t.x - 1, t.y - 22, 2, 22); g.fillStyle(0xff4a6a, 0.9); g.fillRect(t.x - 1, t.y - 24, 3, 3); }   // antenne à feu rouge
  }
  private draw() {
    const W = L.W, H = L.H; const PAL = [[0.72, 0.5, 0.42], [0.55, 0.58, 0.66], [0.8, 0.7, 0.55], [0.5, 0.42, 0.55], [0.66, 0.4, 0.38], [0.45, 0.6, 0.62]];
    const items: { k: number; fn: () => void }[] = [];
    const row = (axis: 'x' | 'y', fixed: number, from: number, to: number, layer: number, seed: number) => {
      let u = from; let i = 0; while (u < to) {
        const w = 3 + Math.floor(hash2(seed, i, 1) * 4), d = 3 + Math.floor(hash2(seed, i, 2) * 3), gap = hash2(seed, i, 3) > 0.75 ? 2 : 0; const h = 70 + hash2(seed, i, 4) * (layer === 0 ? 150 : 230) + (hash2(seed, i, 5) > 0.9 ? 160 : 0); const base = PAL[Math.floor(hash2(seed, i, 6) * PAL.length)];
        const bx = axis === 'x' ? u : fixed, by = axis === 'x' ? fixed : u; const bw = axis === 'x' ? w : d, bd = axis === 'x' ? d : w; const haze = layer === 0 ? 0.5 : 0.72; const sd = seed * 100 + i;
        items.push({ k: bx + by, fn: () => this.box(bx, by, bw, bd, h, base, haze, sd) }); u += w + gap; i++;
      }
    };
    const stepLayers = this.low ? [0] : [1, 0];
    for (const layer of stepLayers) {
      const off = layer === 0 ? 4 : 9;
      row('x', -off - 3, -12, W + 10, layer, 11 + layer);       // nord
      row('y', -off - 3, -12, H + 10, layer, 21 + layer);       // ouest
      row('y', W + off, -6, H + 10, layer, 31 + layer);         // est
      row('x', H + off, -6, W + 10, layer, 41 + layer);         // sud
    }
    items.sort((a, b) => a.k - b.k).forEach((it) => it.fn());
  }
}
