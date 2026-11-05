import Phaser from 'phaser';
import type { SimChar } from '../sim/simchar';
import type { World } from '../sim/world';
import { buildChar, POSES, CW, CH, FEET_Y, LW, LH, type CharAssets } from '../art/chars';
import { BLANKETS } from '../art/furn';
import { bubbleCanvas, iconCanvas, ringCanvas, shadowCanvas } from '../art/core';
import { texKey } from './texreg';
import { activityIcon } from '../sim/observe';
import { cellKey, toScreen, zOf } from './iso';

/** Représentation d'un habitant : lit SimChar, ne le modifie jamais. */
export class CharView {
  assets: CharAssets; body: Phaser.GameObjects.Image; face: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Image; ring: Phaser.GameObjects.Image;
  bubble: Phaser.GameObjects.Image; icon: Phaser.GameObjects.Image; zzz: Phaser.GameObjects.Image;
  act: Phaser.GameObjects.Image; actName = ''; t = 0; pop = 1; lastEmote = 0; x = 0; y = 0; z = 0;
  constructor(public scene: Phaser.Scene, public sim: SimChar, public world: World) {
    const bed = world.furnById.get(sim.bed_id); const style = bed !== undefined ? world.furn[bed].opts.style ?? 0 : 0;
    this.assets = buildChar(sim.id, sim.look, BLANKETS[style % 4]);
    this.shadow = scene.add.image(0, 0, texKey(scene, shadowCanvas())).setOrigin(0.5, 0.5);
    this.ring = scene.add.image(0, 0, texKey(scene, ringCanvas())).setOrigin(0.5, 0.5).setVisible(false);
    this.body = scene.add.image(0, 0, texKey(scene, this.assets.frames.stand.f[0])).setOrigin(0.5, FEET_Y / CH);
    this.face = scene.add.image(0, 0, texKey(scene, this.assets.faces.neutral)).setOrigin(0, 0);
    this.bubble = scene.add.image(0, 0, texKey(scene, bubbleCanvas())).setOrigin(0.5, 19 / 20).setVisible(false).setDepth(9000);
    this.icon = scene.add.image(0, 0, texKey(scene, iconCanvas('smile'))).setOrigin(0, 0).setVisible(false).setDepth(9001);
    this.zzz = scene.add.image(0, 0, texKey(scene, iconCanvas('zzz'))).setOrigin(0, 0).setVisible(false).setDepth(9001);
    this.act = scene.add.image(0, 0, texKey(scene, iconCanvas('dots'))).setOrigin(0.5, 1).setVisible(false).setDepth(8999);
  }
  expression(): string {
    switch (this.sim.emotion) {
      case 'joy': case 'content': case 'love': return 'happy'; case 'sad': case 'lonely': return 'sad'; case 'angry': case 'irritated': return 'angry';
      case 'tired': return 'tired'; case 'awe': case 'anxious': return 'surprised';
    }
    return 'neutral';
  }
  hitRect() { const s = this.sim; return s.pose === 'lie' ? { x: this.x - 28, y: this.y - 30, w: 56, h: 40 } : { x: this.x - 13, y: this.y - 46, w: 26, h: 52 }; }
  headPoint() { return this.sim.pose === 'lie' ? { x: this.x + 10, y: this.y - 34 } : { x: this.x, y: this.y - (this.sim.pose.startsWith('sit') ? 46 : 52) }; }
  zDepth(): number {
    const s = this.sim; const base = (s.pos.x + s.pos.y) * 16;
    if ((s.state === 'use' || s.state === 'enter' || s.state === 'exit') && s.use_furn >= 0) {
      const f = this.world.furn[s.use_furn]; let key = 0;
      if (s.pose === 'lie' || f.def === 'bathtub') { for (let cx = 0; cx < f.w; cx++) for (let cy = 0; cy < f.d; cy++) key = Math.max(key, cellKey(f.x + cx, f.y + cy)); }
      else { const a = this.world.anchorPos(f, f.slots[s.use_slot]); key = cellKey(Math.floor(a.x), Math.floor(a.y)); }
      return s.state === 'use' ? zOf(key) + 1 : Math.max(zOf(base), zOf(key) + 1);
    }
    return zOf(base);
  }
  setHidden(h: boolean) { for (const o of [this.body, this.face, this.shadow, this.ring, this.bubble, this.icon, this.zzz, this.act]) o.setVisible(!h && (o === this.body || o === this.shadow)); }
  /** dt = temps réel ; rate = vitesse de jeu (animations de marche accélérées jusqu'à ×3, sinon les jambes « glissent »). */
  update(dt: number, selected: boolean, hovered: boolean, rate = 1) {
    const s = this.sim; if (s.away) { this.setHidden(true); return; } this.t += dt * rate; let pose = s.pose; if (s.talking && (pose === 'stand' || s.state === 'chat')) pose = 'talk';
    const p = toScreen(s.pos.x, s.pos.y); this.x = Math.round(p.x); this.y = Math.round(p.y); const z = this.zDepth(); this.z = z;
    this.ring.setVisible(selected).setPosition(this.x, this.y).setDepth(z - 0.1);
    const tint = hovered ? 0xffffe0 : 0xffffff; this.body.setTint(tint); this.zzz.setVisible(false);
    if (pose === 'lie') {
      this.body.setTexture(texKey(this.scene, this.assets.lie[Math.floor(this.t * 0.7) % 2])).setOrigin(0.5, 0.5).setFlipX(false).setPosition(this.x, this.y - 11).setDepth(z);
      this.shadow.setVisible(false); this.face.setVisible(false); this.zzz.setVisible(true);
      const zt = (this.t * 0.5) % 1; this.zzz.setPosition(this.x + 22 + zt * 6, this.y - 44 - zt * 14).setAlpha(1 - zt * zt).setDepth(9001);
    } else {
      const front = s.facing === 0 || s.facing === 1; const flip = s.facing === 1 || s.facing === 2;
      const key = this.assets.frames[pose] ? pose : 'stand'; const lst = this.assets.frames[key][front ? 'f' : 'b'];
      const rate = key === 'walk' ? 8 : ['use', 'wash', 'talk', 'sit_eat'].includes(key) ? 3 : 1.4; const fi = Math.floor(this.t * rate) % lst.length;
      this.body.setTexture(texKey(this.scene, lst[fi])).setOrigin(0.5, FEET_Y / CH).setFlipX(flip).setPosition(this.x, this.y).setDepth(z);
      this.shadow.setVisible(true).setPosition(this.x, this.y - 1).setDepth(z - 0.2);
      const defs = POSES[key]; const bob = defs[fi % defs.length].bob;
      this.face.setVisible(front);
      if (front) this.face.setTexture(texKey(this.scene, this.assets.faces[this.expression()])).setFlipX(flip).setPosition(this.x - CW / 2 + 9, this.y - FEET_Y + 8 + bob - s.look.height).setDepth(z + 0.05);
    }
    this.updateBubble(dt, z); this.updateActivity(selected);
  }
  /** Icône d'activité discrète au-dessus de la tête : ce que fait l'habitant, ou ce qu'il va faire s'il marche (frigo → fourchette, porte → mallette…). */
  private updateActivity(selected: boolean) {
    const name = activityIcon(this.world, this.sim); const cz = (this.scene as any).cz ?? 1;
    if (!name || this.emoteLeft > 0 || this.sim.pose === 'lie' || !(selected || cz >= 0.75)) { this.act.setVisible(false); return; }
    if (name !== this.actName) { this.actName = name; this.act.setTexture(texKey(this.scene, iconCanvas(name))); }
    const h = this.headPoint(); this.act.setVisible(true).setScale(1.25).setAlpha(selected ? 1 : 0.88).setPosition(h.x, h.y - (selected ? 24 : 6) + Math.sin(this.t * 3) * 0.8); // plus haut quand l'étiquette du nom est affichée
  }
  /** Bulle d'émotion : durée en TEMPS RÉEL (sinon elle disparaît en 0,4 s à ×8 et on ne voit plus rien). */
  emoteLeft = 0; emoteName = '';
  private updateBubble(dt: number, _z: number) {
    const s = this.sim;
    if (s.emote_t > 0 && s.emote && s.emote_t > this.lastEmote) { this.pop = 0; this.emoteLeft = 3.2; this.emoteName = s.emote; }
    this.lastEmote = s.emote_t > 0 ? s.emote_t : 0;
    if (this.emoteLeft > 0) {
      this.emoteLeft -= dt; this.pop = Math.min(1, this.pop + dt * 7);
      const k = 0.4 + 0.6 * (1 - Math.pow(1 - this.pop, 3)); const off = s.pose === 'lie' ? { x: 18, y: -6 } : { x: 0, y: 0 };
      const bx = this.x + off.x, by = this.y - 50 + off.y + Math.sin(this.t * 4) * 1.2; const a = Math.max(0, Math.min(1, this.emoteLeft * 2));
      this.bubble.setVisible(true).setScale(k).setPosition(bx, by).setAlpha(a);
      this.icon.setVisible(true).setTexture(texKey(this.scene, iconCanvas(this.emoteName))).setScale(k).setPosition(bx + (3 - 9) * k, by + (1.5 - 19) * k).setAlpha(a);
    } else { this.bubble.setVisible(false); this.icon.setVisible(false); }
  }
}
export { LW, LH };
