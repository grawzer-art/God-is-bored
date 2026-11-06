import Phaser from 'phaser';
import * as Weather from '../sim/weather';
import type { World } from '../sim/world';
import type { Lighting } from './lighting';

/** Pluie (traits qui tombent, tirés dans la zone visible) et éclairs d'orage (flash sur la carte de lumière). */
export class WeatherFx {
  g: Phaser.GameObjects.Graphics; drops: { u: number; v: number; s: number }[] = []; nextStrike = 5; dropsDrawn = 0;
  constructor(private scene: Phaser.Scene, private world: World, private lighting: Lighting, private low: () => boolean) {
    this.g = scene.add.graphics().setDepth(8100); for (let i = 0; i < 220; i++) this.drops.push({ u: Math.random(), v: Math.random(), s: 0.7 + Math.random() * 0.6 });
  }
  update(dt: number) {
    const wi = Weather.intensity(this.world); this.g.clear(); this.dropsDrawn = 0;
    this.lighting.flash = Math.max(0, this.lighting.flash - dt * 2.6);
    if (wi <= 0) { this.nextStrike = 4; return; }
    const n = Math.round(this.drops.length * wi * (this.low() ? 0.35 : 1)); const wv = this.scene.cameras.main.worldView; const z = this.scene.cameras.main.zoom;
    this.g.lineStyle(Math.max(1, 1.4 / z), 0xcfe3ff, 0.32 + 0.2 * wi);
    for (let i = 0; i < n; i++) {
      const d = this.drops[i]; d.v += dt * 1.9 * d.s; d.u -= dt * 0.28 * d.s; if (d.v > 1) { d.v -= 1; d.u = Math.random() + 0.1; } if (d.u < 0) d.u += 1.1;
      const x = wv.x + d.u * wv.width, y = wv.y + d.v * wv.height; this.g.lineBetween(x, y, x - 5 / z, y + 15 / z); this.dropsDrawn++;
    }
    if (this.world.weather.kind === 'storm') { this.nextStrike -= dt; if (this.nextStrike <= 0) { this.lighting.flash = 0.75; this.world.weather.strikes++; this.nextStrike = 4 + Math.random() * 8; } }
  }
}
