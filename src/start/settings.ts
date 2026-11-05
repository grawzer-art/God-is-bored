/** Paramètres du joueur (persistants, appliqués réellement) : volumes, musique, qualité, taille d'interface, sensibilité du joystick, animations réduites, accessibilité. */
export interface Settings { master: number; sfx: number; music: boolean; quality: 'high' | 'low'; uiScale: number; joy: number; reduceMotion: boolean; bigText: boolean; contrast: boolean; }
const KEY = 'god-is-bored:settings';
const DEF: Settings = { master: 0.8, sfx: 0.9, music: true, quality: 'high', uiScale: 1, joy: 1, reduceMotion: false, bigText: false, contrast: false };
let cur: Settings | null = null; const subs: (() => void)[] = [];
export function get(): Settings {
  if (cur) return cur; let s: Partial<Settings> = {}; try { s = JSON.parse(localStorage.getItem(KEY) ?? '{}'); } catch { /* ignoré */ }
  const sysReduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  cur = { ...DEF, reduceMotion: sysReduce, ...s }; return cur;
}
export function set(p: Partial<Settings>) { cur = { ...get(), ...p }; try { localStorage.setItem(KEY, JSON.stringify(cur)); } catch { /* ignoré */ } apply(); subs.forEach((f) => f()); }
export function onChange(f: () => void) { subs.push(f); }
/** Applique les réglages visuels au document (échelle d'interface, texte, contraste, animations). */
export function apply() {
  const s = get(); const r = document.documentElement; r.style.setProperty('--ui-scale', String(s.uiScale)); r.classList.toggle('reduce-motion', s.reduceMotion); r.classList.toggle('big-text', s.bigText); r.classList.toggle('hi-contrast', s.contrast);
  let st = document.getElementById('gib-settings-css'); if (!st) { st = document.createElement('style'); st.id = 'gib-settings-css'; document.head.appendChild(st); }
  st.textContent = `#ui{zoom:var(--ui-scale,1)}.big-text #ui{font-size:115%}.hi-contrast .gp,.hi-contrast .panel{background:rgba(0,0,0,.95)!important;border-color:#fff!important}.reduce-motion *{animation-duration:.001s!important;transition-duration:.001s!important}`;
}
