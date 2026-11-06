/** Météo de NORIA : ciel dégagé, pluie, orage. Le temps change tout seul (hasard propre à la météo, qui ne perturbe pas le reste de la simulation)
 *  ou sur ordre divin. Effets réels : les habitants évitent de flâner dehors sous la pluie, l'orage met en alerte (stress). */
import type { World } from './world';
export type Kind = 'clear' | 'rain' | 'storm';
export interface Weather { kind: Kind; until: number; seed: number; strikes: number }
export const LABEL: Record<Kind, string> = { clear: 'Ciel dégagé', rain: 'Pluie', storm: 'Orage' };
export const blank = (seed = 1): Weather => ({ kind: 'clear', until: 300 + (seed % 7) * 60, seed: (seed * 2654435761) >>> 0, strikes: 0 });
const next = (wx: Weather) => { wx.seed = (Math.imul(wx.seed, 1664525) + 1013904223) >>> 0; return wx.seed / 4294967296; };
export const isWet = (w: World) => w.weather.kind !== 'clear';
/** Intensité visuelle 0..1 (0 = sec). */
export const intensity = (w: World) => (w.weather.kind === 'storm' ? 1 : w.weather.kind === 'rain' ? 0.55 : 0);
export function set(w: World, kind: Kind, minutes = 150) { w.weather.kind = kind; w.weather.until = w.clock + minutes; w.emitLog(kind === 'clear' ? 'Le ciel se dégage sur NORIA.' : kind === 'rain' ? 'La pluie se met à tomber sur NORIA.' : 'Un orage éclate au-dessus de NORIA.', 'info'); }
export function tick(w: World, dmin: number) {
  const wx = w.weather; if (w.clock >= wx.until) {
    const r = next(wx);
    if (wx.kind === 'clear') { if (r < 0.28) set(w, 'rain', 80 + next(wx) * 140); else if (r < 0.33) set(w, 'storm', 40 + next(wx) * 60); else wx.until = w.clock + 240 + next(wx) * 480; }
    else if (wx.kind === 'rain') { if (r < 0.2) set(w, 'storm', 30 + next(wx) * 50); else set(w, 'clear', 300 + next(wx) * 400); }
    else set(w, r < 0.7 ? 'rain' : 'clear', 60 + next(wx) * 120);
  }
  if (wx.kind === 'storm' && dmin > 0) { for (const c of w.chars) if (!c.away && c.kind !== 'avatar' && c.trait('neuroticism') > 0.6) c.stress = Math.min(100, c.stress + 0.05 * dmin); }
}
