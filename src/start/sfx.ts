/** Sons rétro originaux, synthétisés (WebAudio) : aucun fichier, aucune musique protégée. Volumes liés aux paramètres. iOS : le son ne démarre qu'après un premier toucher. */
import * as Settings from './settings';
let ctx: AudioContext | null = null; let musicTimer = 0; let musicOn = false;
function ac(): AudioContext | null { if (ctx) return ctx; try { const C = (window as any).AudioContext ?? (window as any).webkitAudioContext; ctx = new C(); } catch { ctx = null; } return ctx; }
/** À appeler dans un geste utilisateur (toucher) pour déverrouiller l'audio sur iOS. */
export function unlock() { const c = ac(); if (c && c.state === 'suspended') void c.resume(); }
function tone(freq: number, dur: number, type: OscillatorType = 'square', vol = 0.2, slide = 0, delay = 0, bus: 'sfx' | 'music' = 'sfx') {
  const c = ac(); if (!c || c.state !== 'running') return; const s = Settings.get(); const v = vol * s.master * (bus === 'sfx' ? s.sfx : 0.5); if (v <= 0.001) return;
  const o = c.createOscillator(), g = c.createGain(); o.type = type; const t0 = c.currentTime + delay; o.frequency.setValueAtTime(freq, t0); if (slide) o.frequency.linearRampToValueAtTime(freq + slide, t0 + dur);
  g.gain.setValueAtTime(v, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); o.connect(g).connect(c.destination); o.start(t0); o.stop(t0 + dur + 0.02);
}
function noise(dur: number, vol = 0.15, delay = 0) {
  const c = ac(); if (!c || c.state !== 'running') return; const s = Settings.get(); const v = vol * s.master * s.sfx; if (v <= 0.001) return; const n = Math.floor(c.sampleRate * dur); const buf = c.createBuffer(1, n, c.sampleRate); const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n); const src = c.createBufferSource(), g = c.createGain(); src.buffer = buf; g.gain.value = v; src.connect(g).connect(c.destination); src.start(c.currentTime + delay);
}
export const click = () => tone(660, 0.05, 'square', 0.12);
export const confirm = () => { tone(523, 0.07, 'square', 0.14); tone(784, 0.1, 'square', 0.14, 0, 0.07); };
export const back = () => tone(330, 0.07, 'square', 0.12, -80);
export const buy = () => { tone(880, 0.05, 'triangle', 0.16); tone(1175, 0.09, 'triangle', 0.16, 0, 0.05); };
export const quest = () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.12, 'square', 0.14, 0, i * 0.09)); };
/** Générique : montée rétro, claque et glitch. */
export function stinger() { tone(110, 0.28, 'sawtooth', 0.22, 220); tone(880, 0.06, 'square', 0.18, 0, 0.3); noise(0.12, 0.2, 0.32); tone(196, 0.09, 'square', 0.2, -120, 0.42); tone(98, 0.3, 'sawtooth', 0.2, -30, 0.48); }
/** Petite boucle d'ambiance au menu (arpège lent), arrêtable ; coupée si l'option musique est désactivée. */
const SEQ = [220, 262, 330, 262, 196, 247, 294, 247, 175, 220, 262, 220, 196, 247, 294, 392];
export function musicStart() {
  if (musicOn) return; musicOn = true; let i = 0; const step = () => { if (!musicOn) return; if (Settings.get().music) tone(SEQ[i % SEQ.length], 0.5, 'triangle', 0.1, 0, 0, 'music'); i++; musicTimer = window.setTimeout(step, 420); }; step();
}
export function musicStop() { musicOn = false; clearTimeout(musicTimer); }
