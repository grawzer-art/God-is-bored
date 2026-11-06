import Phaser from 'phaser';
import * as Weather from '../sim/weather';
import type { World } from '../sim/world';
import type { Lighting } from './lighting';
import { canvas, ctx2 } from '../art/core';
import { texKey } from './texreg';

/** Texture de pluie à répétition (bruit déterministe) : une seule image qui défile, bien moins coûteuse que des centaines de traits dessinés chaque image. */
function rainCanvas(): HTMLCanvasElement {
  const S = 160, cv = canvas(S, S), g = ctx2(cv); g.lineCap = 'butt'; let seed = 7;
  const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < 34; i++) {
    const x = rnd() * S, y = rnd() * S, len = 9 + rnd() * 10, a = 0.28 + rnd() * 0.34; g.strokeStyle = `rgba(214,232,255,${a})`; g.lineWidth = rnd() > 0.7 ? 2 : 1;
    for (const oy of [0, -S, S]) { g.beginPath(); g.moveTo(x, y + oy); g.lineTo(x - len * 0.32, y + len + oy); g.stroke(); g.beginPath(); g.moveTo(x - S, y + oy); g.lineTo(x - S - len * 0.32, y + len + oy); g.stroke(); }
  }
  return cv;
}

/** Pluie (couches de traits qui défilent à vitesses différentes, taille fixe à l'écran) et éclairs d'orage (flash sur la carte de lumière). */
export class WeatherFx {
  layers: Phaser.GameObjects.TileSprite[] = []; nextStrike = 5; dropsDrawn = 0;
  constructor(private scene: Phaser.Scene, private world: World, private lighting: Lighting, private low: () => boolean) {
    const key = texKey(scene, rainCanvas());
    for (let i = 0; i < 2; i++) { const t = scene.add.tileSprite(0, 0, 10, 10, key).setOrigin(0, 0).setDepth(8100 + i).setVisible(false); t.setData('speed', i === 0 ? 520 : 760); t.setData('dx', i === 0 ? 0 : 53); this.layers.push(t); }
  }
  update(dt: number) {
    const wi = Weather.intensity(this.world); this.lighting.flash = Math.max(0, this.lighting.flash - dt * 2.6); this.dropsDrawn = 0;
    if (wi <= 0) { this.nextStrike = 4; for (const t of this.layers) t.setVisible(false); return; }
    const cam = this.scene.cameras.main, wv = cam.worldView, z = cam.zoom; const nl = this.low() ? 1 : 2;
    this.layers.forEach((t, i) => {
      if (i >= nl) { t.setVisible(false); return; }
      t.setVisible(true).setPosition(wv.x, wv.y).setSize(wv.width + 2, wv.height + 2).setTileScale(1 / z, 1 / z).setAlpha(Math.min(1, 0.4 + 0.6 * wi) * (i === 0 ? 1 : 0.7));
      t.tilePositionY -= (t.getData('speed') as number) * dt * 0.5 * wi / z * z; t.tilePositionX += 130 * dt * wi * 0.5; t.tilePositionX += 0; this.dropsDrawn += 34 * 2;
    });
    if (this.world.weather.kind === 'storm') { this.nextStrike -= dt; if (this.nextStrike <= 0) { this.lighting.flash = 0.75; this.world.weather.strikes++; this.nextStrike = 4 + Math.random() * 8; } }
  }
}
