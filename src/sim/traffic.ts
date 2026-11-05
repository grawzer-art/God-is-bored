/** Circulation : voitures qui roulent sur l'avenue (deux voies), ralentissent devant un obstacle (voiture, piéton) et ne sont pas enregistrées dans les sauvegardes (régénérées).
 *  Générateur aléatoire PROPRE : n'influence pas la simulation des habitants. */
import type { World } from './world';
import * as L from './layout';

export interface Car { id: number; lane: number; x: number; dir: 1 | -1; v: number; vmax: number; style: number; stopped: boolean }
export const CAR_LEN = 3;
export class Traffic {
  cars: Car[] = []; private seed = 91237;
  private rnd() { this.seed = (Math.imul(this.seed, 1103515245) + 12345) & 0x7fffffff; return this.seed / 0x7fffffff; }
  constructor(private w: World) {
    // voie 20 : vers l'ouest ; voie 21 : vers l'est
    const per = 5; for (let lane = 20; lane <= 21; lane++) for (let i = 0; i < per; i++) {
      const dir: 1 | -1 = lane === 21 ? 1 : -1; this.cars.push({ id: this.cars.length, lane, x: (i + this.rnd() * 0.6) * (L.W / per), dir, v: 0, vmax: 2.6 + this.rnd() * 1.4, style: Math.floor(this.rnd() * 8), stopped: false });
    }
  }
  /** Fait apparaître une voiture (pouvoir CRÉER) sur une voie de l'avenue ; plafonné pour la fluidité. */
  spawn(): boolean { if (this.cars.length >= 16) return false; const lane = this.rnd() < 0.5 ? 20 : 21; const dir: 1 | -1 = lane === 21 ? 1 : -1; this.cars.push({ id: this.cars.length, lane, x: dir > 0 ? -CAR_LEN - 1 : L.W + 1, dir, v: 0, vmax: 2.6 + this.rnd() * 1.4, style: Math.floor(this.rnd() * 8), stopped: false }); return true; }
  tick(dt: number) {
    const W = L.W;
    for (const c of this.cars) {
      // distance libre devant : autres voitures de la voie, puis personnages sur la chaussée
      let gap = 1e9;
      for (const o of this.cars) { if (o === c || o.lane !== c.lane) continue; let d = (o.x - c.x) * c.dir; if (d < 0) d += W + CAR_LEN * 2; if (d > 0) gap = Math.min(gap, d - CAR_LEN); }
      for (const ch of this.w.chars) {
        if (ch.away || ch.state === 'enter' || ch.state === 'exit') continue; const cy = ch.pos.y; if (cy < c.lane - 0.3 || cy > c.lane + 1.3) continue;
        let d = (ch.pos.x - (c.dir > 0 ? c.x + CAR_LEN : c.x)) * c.dir; if (d > -0.2 && d < gap) gap = d;
      }
      const target = gap < 1.6 ? 0 : gap < 4.5 ? c.vmax * (gap - 1.6) / 2.9 : c.vmax;
      const acc = target < c.v ? 9 : 2.4; c.v += Math.sign(target - c.v) * Math.min(Math.abs(target - c.v), acc * dt); c.stopped = c.v < 0.05;
      c.x += c.dir * c.v * dt; if (c.dir > 0 && c.x > W + 3) c.x = -CAR_LEN - 1; if (c.dir < 0 && c.x < -CAR_LEN - 3) c.x = W + 1;
    }
  }
}
