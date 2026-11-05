/** Portes : battants qui s'ouvrent à l'approche de tout personnage (rendu uniquement : la simulation garde les portes comme ouvertures libres,
 *  ce qui conserve les trajets, les sauvegardes et le comportement des habitants). Les passages larges (plusieurs cases de porte côte à côte) restent des arcades. */
import Phaser from 'phaser';
import * as L from '../sim/layout';
import type { World } from '../sim/world';
import { cellKey, toScreen, zOf } from './iso';

interface Door { x: number; y: number; alongX: boolean; sign: number; open: number; drawn: number; g: Phaser.GameObjects.Graphics }
const REACH = 1.5;

export class Doors {
  list: Door[] = [];
  constructor(private scene: Phaser.Scene, private world: World, private heightAt: (x: number, y: number) => number) {
    for (let y = 0; y < L.H; y++) for (let x = 0; x < L.W; x++) {
      if (!L.isDoor(x, y)) continue;
      const alongX = L.isWall(x - 1, y) && L.isWall(x + 1, y), alongY = L.isWall(x, y - 1) && L.isWall(x, y + 1);
      if (alongX === alongY) continue; // arcade (porte large) ou cas ambigu : pas de battant
      const g = scene.add.graphics().setDepth(zOf(cellKey(x, y)) + 2);
      const out = alongX ? L.isOutdoor(x, y + 1) : L.isOutdoor(x + 1, y); // le battant s'ouvre vers l'intérieur, jamais sur la rue
      this.list.push({ x, y, alongX, sign: out ? -1 : 1, open: 0, drawn: -1, g });
    }
  }
  /** 0 (fermée) .. 1 (grande ouverte) pour la porte de la case donnée ; -1 si aucun battant. */
  openness(x: number, y: number) { return this.list.find((d) => d.x === x && d.y === y)?.open ?? -1; }
  /** Force le redessin (la hauteur des murs a changé). */
  invalidate() { for (const d of this.list) d.drawn = -1; }
  update(dt: number) {
    const k = Math.min(1, dt * 9);
    for (const d of this.list) {
      const cx = d.x + 0.5, cy = d.y + 0.5; let near = false;
      for (const c of this.world.chars) if (!c.away && Math.hypot(c.pos.x - cx, c.pos.y - cy) < REACH) { near = true; break; }
      d.open += ((near ? 1 : 0) - d.open) * k; if (d.open < 0.01) d.open = 0; if (d.open > 0.99) d.open = 1;
      if (Math.abs(d.open - d.drawn) > 0.004) { d.drawn = d.open; this.draw(d); }
    }
  }
  private draw(d: Door) {
    const g = d.g; g.clear(); const h = Math.min(this.heightAt(d.x, d.y), 56); const th = d.open * (Math.PI * 0.44);
    // charnière et extrémité libre en coordonnées de grille ; le battant pivote de 0 (dans l'ouverture) à ~80° (vers la pièce)
    const hx = d.alongX ? d.x : d.x + 0.5, hy = d.alongX ? d.y + 0.5 : d.y;
    const ex = d.alongX ? hx + Math.cos(th) : hx + d.sign * Math.sin(th), ey = d.alongX ? hy + d.sign * Math.sin(th) : hy + Math.cos(th);
    const a = toScreen(hx, hy), b = toScreen(ex, ey);
    const pts = [{ x: a.x, y: a.y }, { x: b.x, y: b.y }, { x: b.x, y: b.y - h }, { x: a.x, y: a.y - h }];
    g.fillStyle(0x6b4a2f, 1); g.fillPoints(pts, true);
    g.fillStyle(0x8a6240, 1); g.fillPoints([{ x: a.x, y: a.y - 2 }, { x: b.x, y: b.y - 2 }, { x: b.x, y: b.y - h * 0.45 }, { x: a.x, y: a.y - h * 0.45 }].map((p, i) => ({ x: p.x + (i === 1 || i === 2 ? -1 : 1), y: p.y })), true);
    g.lineStyle(1, 0x2f1f12, 1); g.strokePoints(pts, true);
    const kx = a.x + (b.x - a.x) * 0.82, ky = a.y + (b.y - a.y) * 0.82 - h * 0.45; g.fillStyle(0xf2c761, 1); g.fillCircle(kx, ky, 1.6);
  }
}
