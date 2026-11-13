import Phaser from 'phaser';
import type { World } from '../sim/world';
import { toScreen } from './iso';
import * as Sfx from '../start/sfx';

/** Effets visuels et sonores des bagarres : étoile d'impact, étincelle de garde, trace de coup dans le vide, texte K.O. / ESQUIVE, légère secousse de caméra (si le joueur est impliqué). */
export class FightFx {
  g: Phaser.GameObjects.Graphics; items: { x: number; y: number; t: number; dur: number; type: string; heavy: boolean }[] = []; texts: { o: Phaser.GameObjects.Text; t: number; dur: number; vy: number }[] = [];
  constructor(private scene: Phaser.Scene, private world: World, private low: () => boolean) { this.g = scene.add.graphics().setDepth(8200); }
  update(dt: number) {
    const w = this.world;
    for (const s of w.audio.splice(0)) { switch (s) { case 'swish': Sfx.swish(); break; case 'hit': Sfx.hit(); break; case 'hit_heavy': Sfx.hitHeavy(); break; case 'block': Sfx.blockSfx(); break; case 'ko': Sfx.ko(); break; case 'fight': Sfx.fightAlert(); break; } }
    for (const e of w.fightFx.splice(0)) {
      const p = toScreen(e.x, e.y); const involved = e.att === w.avatar.id || e.tgt === w.avatar.id;
      this.items.push({ x: p.x, y: p.y - 26, t: 0, dur: e.type === 'whiff' ? 0.14 : 0.22, type: e.type, heavy: e.heavy });
      if (e.type === 'hit' && involved && !this.low()) this.scene.cameras.main.shake(e.heavy ? 110 : 55, e.heavy ? 0.005 : 0.0025);
      const label = e.type === 'ko' ? 'K.O.' : e.type === 'dodge' ? 'ESQUIVE' : e.type === 'guardbreak' ? 'GARDE BRISÉE' : e.type === 'block' ? '' : '';
      if (label) { const o = this.scene.add.text(p.x, p.y - 56, label, { fontFamily: 'sans-serif', fontSize: e.type === 'ko' ? '20px' : '12px', fontStyle: 'bold', color: e.type === 'ko' ? '#ffd23c' : '#9fe8ff', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5).setDepth(8210); this.texts.push({ o, t: 0, dur: e.type === 'ko' ? 1.1 : 0.6, vy: -22 }); }
    }
    this.g.clear();
    for (const it of [...this.items]) {
      it.t += dt; if (it.t >= it.dur) { this.items.splice(this.items.indexOf(it), 1); continue; } const k = it.t / it.dur; const a = 1 - k;
      if (it.type === 'hit') { const n = it.heavy ? 10 : 7, r0 = (it.heavy ? 6 : 4) + k * (it.heavy ? 22 : 14); this.g.lineStyle(it.heavy ? 3 : 2, it.heavy ? 0xffd23c : 0xffffff, a); for (let i = 0; i < n; i++) { const an = (i / n) * Math.PI * 2 + 0.3; this.g.lineBetween(it.x + Math.cos(an) * r0 * 0.5, it.y + Math.sin(an) * r0 * 0.5, it.x + Math.cos(an) * r0, it.y + Math.sin(an) * r0 * 0.7); } this.g.fillStyle(0xffffff, a * 0.8); this.g.fillCircle(it.x, it.y, (it.heavy ? 7 : 4) * (1 - k * 0.6)); }
      else if (it.type === 'block' || it.type === 'guardbreak') { this.g.lineStyle(2, it.type === 'guardbreak' ? 0xff6a5a : 0x7fd0ff, a); this.g.strokeCircle(it.x, it.y, 6 + k * 12); this.g.lineBetween(it.x - 8, it.y - 8, it.x + 8, it.y + 8); }
      else if (it.type === 'whiff') { this.g.lineStyle(2, 0xffffff, a * 0.6); this.g.beginPath(); this.g.arc(it.x, it.y + 6, 12 + k * 6, -2.2, -0.9); this.g.strokePath(); }
      else if (it.type === 'dodge') { this.g.fillStyle(0x9fe8ff, a * 0.5); this.g.fillCircle(it.x, it.y + 6, 10 + k * 8); }
    }
    for (const t of [...this.texts]) { t.t += dt; if (t.t >= t.dur) { t.o.destroy(); this.texts.splice(this.texts.indexOf(t), 1); continue; } t.o.y += t.vy * dt; t.o.setAlpha(Math.min(1, (t.dur - t.t) * 3)); }
  }
}
