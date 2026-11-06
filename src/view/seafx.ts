import Phaser from 'phaser';
import * as L from '../sim/layout';
import { toScreen } from './iso';
import type { World } from '../sim/world';

/** Mer vivante : reflets qui scintillent et vaguelettes qui avancent vers le rivage, dessinés seulement sur la partie visible de l'océan (peu coûteux). */
export class SeaFx {
  g: Phaser.GameObjects.Graphics; t = 0; drawn = 0;
  constructor(private scene: Phaser.Scene, private world: World, private low: () => boolean) { this.g = scene.add.graphics().setDepth(-2990); }
  update(dt: number) {
    this.t += dt; this.g.clear(); this.drawn = 0; const cam = this.scene.cameras.main; const wv = cam.worldView; const B = L.BEACH;
    const a = toScreen(B.x0, B.sea0), b = toScreen(B.x1 + 1, B.sea1 + 1); if (b.x < wv.x - 80 || a.x > wv.right + 80) { /* diagonale : test large */ }
    const day = Math.max(0.25, this.world.hour() > 6 && this.world.hour() < 20 ? 1 : 0.35); const step = this.low() ? 3 : 1; const wet = this.world.weather.kind === 'clear' ? 1 : 1.6;
    for (let y = B.sea0; y <= B.sea1; y++) for (let x = B.x0; x <= B.x1; x += step) {
      const p = toScreen(x + 0.5, y + 0.5); if (p.x < wv.x - 40 || p.x > wv.right + 40 || p.y < wv.y - 30 || p.y > wv.bottom + 30) continue;
      const ph = Math.sin(this.t * 1.3 * wet + x * 0.9 + y * 1.7), ph2 = Math.sin(this.t * 0.7 + x * 1.9 - y * 0.8);
      if (ph > 0.82) { this.g.fillStyle(0xffffff, 0.35 * day * (ph - 0.82) / 0.18); this.g.fillRect(p.x - 5 + ph2 * 4, p.y - 1, 9, 2); this.drawn++; }
      else if (ph2 > 0.9) { this.g.fillStyle(0xbfeaff, 0.22 * day); this.g.fillRect(p.x - 3, p.y + 2, 6, 1); this.drawn++; }
    }
    // écume sur le sable mouillé : ligne qui avance et recule
    const f = (Math.sin(this.t * 0.9) + 1) * 0.5; this.g.lineStyle(2, 0xffffff, 0.22 + 0.2 * f);
    for (let x = B.x0; x <= B.x1; x += 1) { const p = toScreen(x, B.sea0 - 0.05 + f * 0.12), q = toScreen(x + 1, B.sea0 - 0.05 + f * 0.12); if (p.x < wv.x - 40 || p.x > wv.right + 40) continue; this.g.lineBetween(p.x, p.y, q.x, q.y); }
  }
}
