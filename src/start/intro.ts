/** Démarrage : générique GRAW STUDIO, menu principal, paramètres, crédits. Le monde NORIA tourne derrière le menu (même moteur, même rendu). */
import type { GameScene } from '../view/scene';
import * as Settings from './settings';
import type { Settings as SettingsT } from './settings';
import * as Sfx from './sfx';
import * as Save from '../sim/save';
import { drawText, textWidth, drawSprite, FINGER, SKIN_PAL, CROWN } from './pixel';
import { installTheme } from '../ui/theme';
import { openCreator } from './creator';

const CSS = `
#start{position:fixed;inset:0;z-index:100;display:none;color:#fff;font-family:Inter,system-ui,sans-serif;-webkit-user-select:none;user-select:none}
#start.black{background:#000} #start .splash{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#000} #start canvas{image-rendering:pixelated;max-width:96vw;max-height:80vh}
#start .skip{position:absolute;right:calc(env(safe-area-inset-right,0px) + 14px);bottom:calc(env(safe-area-inset-bottom,0px) + 12px);opacity:.55;font-size:12px;letter-spacing:.1em}
#start .menu{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:linear-gradient(180deg,rgba(40,10,70,.55) 0%,rgba(150,40,90,.28) 45%,rgba(255,120,60,.22) 70%,rgba(10,6,24,.82) 100%)}
#start .menu .logo{margin-bottom:4px}
@media (orientation:landscape) and (max-height:520px){#start .menu{flex-direction:row;gap:28px;padding:0 4vw}#start .menu .logo{margin:0;width:46vw!important}#start .btns{width:min(300px,38vw);gap:6px}#start .btns .gp-btn{min-height:38px;font-size:13px}} #start .btns{display:flex;flex-direction:column;gap:8px;width:min(300px,70vw)} #start .btns .gp-btn{min-height:46px;font-size:15px;letter-spacing:.08em;text-transform:uppercase;background:rgba(18,12,36,.82)}
#start .btns .gp-btn.main{border-color:var(--gp-gold);color:var(--gp-gold)} #start .btns .gp-btn[disabled]{opacity:.35}
#start .menu .ver{position:absolute;left:calc(env(safe-area-inset-left,0px) + 12px);bottom:calc(env(safe-area-inset-bottom,0px) + 8px);font-size:10px;opacity:.5}
#start .sheet{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55)} #start .sheet .gp{width:min(560px,90vw);max-height:86vh;overflow:auto;padding:14px 16px;display:flex;flex-direction:column;gap:10px}
#start .xclose{position:sticky;top:0;align-self:flex-end;z-index:2;min-width:44px;min-height:40px;padding:4px 10px;margin-bottom:-34px} #start .sheet h3{margin:0;font-size:17px;color:var(--gp-gold);letter-spacing:.08em;text-transform:uppercase} #start .row{display:flex;align-items:center;gap:10px;justify-content:space-between;font-size:13px} #start .row input[type=range]{width:46%}
#start .row .gp-btn{min-width:84px} #start .row .gp-btn.on{border-color:var(--gp-gold);color:var(--gp-gold)} #start .small{font-size:12px;color:var(--gp-dim);line-height:1.5}
`;
const PALM = [
  '..........ggg.gg........', '.......gggggggggggg.....', '....ggggggg.gggggggg....', '..gggg....gg....gggggg..', '.gg......ggg.......gggg.', 'g.......gg.gg.........g.', '........g..gg...........',
  '.......gg..gg...........', '.......g...ggg..........', '.......g....gg..........', '.......g....gg..........', '..........gg............', '..........gg............', '..........gg............', '..........gg............',
  '..........ggg...........', '..........ggg...........', '.........gggg...........', '.........gggg...........', '.........gggg...........', '.........gggg...........', '........ggggg...........',
];
export const hasValidSave = () => { try { const s = localStorage.getItem(Save.SAVE_KEY); if (!s) return false; return Save.validatePayload(Save.migrate(JSON.parse(s))) === null; } catch { return false; } };

export class StartFlow {
  private el: HTMLElement; private raf = 0; private pan = 0; private t0 = 0; private skipped = false; private done = false;
  constructor(private g: GameScene) {
    installTheme(); const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    this.el = document.createElement('div'); this.el.id = 'start'; document.body.appendChild(this.el);
  }
  /** Lance le parcours : générique puis menu. `skipSplash` : retour au menu sans générique (changement de mode, etc.). */
  run(skipSplash = false) {
    document.getElementById('ui')!.style.display = 'none'; this.el.style.display = 'block'; this.prepareWorld();
    if (skipSplash) this.menu(); else this.splash();
  }
  private prepareWorld() { const g = this.g, w = g.world; w.clock = Math.floor(w.clock / 1440) * 1440 + 19.7 * 60; g.setSpeed(1); g.mode === 'human' && g.ascend(false); g.focusZone('downtown'); g.tz = g.cz = 0.78; this.panLoop(); }
  private panLoop() { cancelAnimationFrame(this.raf); const step = () => { if (this.el.style.display === 'none') return; this.pan += 0.0006; if (!Settings.get().reduceMotion) { this.g.tx += Math.cos(this.pan) * 0.25; this.g.ty += Math.sin(this.pan * 0.7) * 0.12; } this.raf = requestAnimationFrame(step); }; step(); }
  private close() { cancelAnimationFrame(this.raf); this.el.style.display = 'none'; this.el.innerHTML = ''; document.getElementById('ui')!.style.display = ''; }

  // ------------------------------------------------------------------ générique GRAW STUDIO
  private splash() {
    this.el.className = 'black'; this.el.innerHTML = '<div class="splash"><canvas id="splashc"></canvas></div><button class="gp-btn skip" id="skip">PASSER ›</button>';
    const cv = this.el.querySelector('#splashc') as HTMLCanvasElement; const g = cv.getContext('2d')!; g.imageSmoothingEnabled = false;
    const reduce = Settings.get().reduceMotion; const TXT = 'GRAW STUDIO'; const S = 4; const W = 200, H = 120; cv.width = W * S; cv.height = H * S; cv.style.width = Math.min(innerWidth * 0.9, 560) + 'px'; cv.style.height = 'auto';
    const end = () => { if (this.skipped) return; this.skipped = true; Sfx.click(); this.menu(); };
    const kick = () => { Sfx.unlock(); end(); }; this.el.addEventListener('pointerdown', kick, { once: true }); this.el.querySelector('#skip')!.addEventListener('click', kick);
    this.skipped = false; let acc = 0, last = performance.now(); let stung = false; const total = reduce ? 1600 : 2500;
    const frame = () => {
      if (this.skipped) return; const now = performance.now(); acc += Math.min(now - last, 50); last = now; const t = acc; g.fillStyle = '#000'; g.fillRect(0, 0, cv.width, cv.height);
      const px = (n: number) => n * S;
      // logo : apparition à 0,3 s
      if (t > 300 || reduce) { const a = reduce ? 1 : Math.min(1, (t - 300) / 250); g.globalAlpha = a; const x = Math.floor((W - (6 * TXT.length - 1) * 2 + 0) / 2) * S; drawText(g, TXT, Math.floor((W * S - textWidth(TXT, 8)) / 2), px(80), 8, '#ffffff'); g.globalAlpha = 1; }
      // doigt : surgit à 0,8 s, par paliers de pixels
      if (t > 800 || reduce) {
        if (!stung && !reduce) { stung = true; Sfx.stinger(); }
        const k = reduce ? 1 : Math.min(1, (t - 800) / 350); const steps = Math.round(k * 5) / 5; const up = (1 - steps) * 26; const sc = 3; const fx = Math.floor((W * S - 16 * sc * S / 1) / 2);
        drawSprite(g, FINGER, Math.floor((W * S - 16 * 8) / 2), px(2) + Math.round(up) * 8, 8, SKIN_PAL); void fx; void sc;
      }
      if (t > 1300 || reduce) { g.globalAlpha = reduce ? 1 : Math.min(1, (t - 1300) / 300); drawText(g, 'PRESENTS', Math.floor((W * S - textWidth('PRESENTS', 3)) / 2), px(108), 3, '#9aa0b8'); g.globalAlpha = 1; }
      // pixels lumineux discrets
      if (!reduce) for (let i = 0; i < 6; i++) { const r = ((t * 0.003 + i * 13.7) % 1); g.fillStyle = `rgba(255,255,255,${0.15 + 0.2 * Math.abs(Math.sin(t * 0.004 + i))})`; g.fillRect(((i * 97 + Math.floor(t / 90) * 31) % W) * S, ((i * 53 + Math.floor(r * H)) % H) * S, S, S); }
      // glitch : 1,5 → 1,65 s (tranches décalées + canaux colorés)
      if (!reduce && t > 1500 && t < 1680) { const im = g.getImageData(0, 0, cv.width, cv.height); for (let k = 0; k < 5; k++) { const y0 = Math.floor(Math.random() * cv.height * 0.9), h = 8 + Math.floor(Math.random() * 40), dx = Math.floor((Math.random() - 0.5) * 80); g.putImageData(im, dx, 0, 0, y0, cv.width, h); } g.fillStyle = 'rgba(255,0,80,.12)'; g.fillRect(0, Math.random() * cv.height, cv.width, 6); }
      if (t > total) { end(); return; } this.raf = requestAnimationFrame(frame);
    };
    frame();
  }

  // ------------------------------------------------------------------ menu principal
  private menu() {
    cancelAnimationFrame(this.raf); this.el.className = ''; const hasSave = hasValidSave(); this.panLoop(); Sfx.musicStart();
    this.el.innerHTML = `<div class="menu"><canvas class="logo" id="logo"></canvas><div class="btns">
      <button class="gp-btn main" data-a="new">Nouvelle partie</button><button class="gp-btn" data-a="cont" ${hasSave ? '' : 'disabled'}>Continuer</button><button class="gp-btn" data-a="load">Charger une partie</button><button class="gp-btn" data-a="set">Paramètres</button><button class="gp-btn" data-a="cred">Crédits</button></div><div class="ver">GRAW STUDIO · NORIA</div>
      <canvas id="palmL" style="position:absolute;left:0;bottom:0"></canvas><canvas id="palmR" style="position:absolute;right:0;bottom:0;transform:scaleX(-1)"></canvas></div>`;
    this.drawLogo(); this.drawPalms();
    this.el.querySelectorAll<HTMLElement>('[data-a]').forEach((b) => (b.onclick = () => { Sfx.unlock(); Sfx.click(); this.action(b.dataset.a!); }));
  }
  private drawLogo() {
    const cv = this.el.querySelector('#logo') as HTMLCanvasElement; const S = 4; const W = 110, H = 34; cv.width = W * S; cv.height = H * S; cv.style.height = 'auto'; const g = cv.getContext('2d')!; g.imageSmoothingEnabled = false;
    drawSprite(g, CROWN, Math.floor((W * S - 11 * 5) / 2), 0, 5, { o: '#3a2400', y: '#fcd34d' }); const T = 'GOD IS BORED'; const sc = 6; const w = textWidth(T, sc); const x = Math.floor((cv.width - w) / 2), y = 5 * 6 + 8;
    drawText(g, T, x + 3, y + 3, sc, '#3b0a5c'); drawText(g, T, x, y, sc, '#fcd34d'); drawText(g, T, x, y - 1, sc, 'rgba(255,255,255,.35)');
  }
  private drawPalms() {
    for (const id of ['palmL', 'palmR']) {
      const cv = this.el.querySelector('#' + id) as HTMLCanvasElement; const S = 6; const W = 30, H = 34; cv.width = W * S; cv.height = H * S; cv.style.width = '120px'; cv.style.height = 'auto'; const g = cv.getContext('2d')!; g.fillStyle = '#120a24';
      const dot = (x: number, y: number, r = 0) => g.fillRect(Math.round(x) * S, Math.round(y) * S, (r + 1) * S, (r + 1) * S);
      for (let y = 33; y >= 10; y--) { const bend = Math.sin((33 - y) / 23 * 1.2) * 4; dot(14 + bend, y, y > 24 ? 2 : 1); }       // tronc légèrement courbé
      const hx = 14 + Math.sin(1.2) * 4 + 0.5, hy = 10;
      for (const [dx, len, droop] of [[-1, 12, 0.07], [-0.6, 10, 0.12], [0.2, 6, 0.2], [1, 12, 0.07], [0.7, 10, 0.12], [-0.2, 7, 0.2], [0, 6, 0.0]] as [number, number, number][]) {
        for (let i = 0; i < len; i++) { const x = hx + dx * i * 1.1, y = hy - (i < 3 ? i * 0.6 : 1.8) + droop * i * i * 0.35; dot(x, y, i < 6 ? 1 : 0); }
      }
    }
  }
  private action(a: string) {
    if (a === 'cont') { this.close(); Sfx.musicStop(); this.g.loadGame(); }
    else if (a === 'new') { if (hasValidSave()) this.confirmNew(); else this.startNew(); }
    else if (a === 'load') this.loadSheet(); else if (a === 'set') this.settingsSheet(); else if (a === 'cred') this.credits();
  }
  private sheet(html: string) { const s = document.createElement('div'); s.className = 'sheet'; s.innerHTML = `<div class="gp"><button class="gp-btn xclose" aria-label="Fermer">✕</button>${html}</div>`; s.querySelector('.xclose')!.addEventListener('click', () => { Sfx.back(); s.remove(); }); this.el.appendChild(s); s.addEventListener('pointerdown', (e) => { if (e.target === s) { Sfx.back(); s.remove(); } }); return s; }
  private confirmNew() {
    const s = this.sheet(`<h3>Nouvelle partie</h3><div class="small">Une sauvegarde existe déjà. Commencer une nouvelle partie <b>ne l'efface pas</b> tant que vous ne sauvegardez pas : une copie de secours est conservée. Continuer ?</div><div class="row"><button class="gp-btn" data-c="no">Annuler</button><button class="gp-btn gold" data-c="yes">Nouvelle partie</button></div>`);
    s.querySelector('[data-c="no"]')!.addEventListener('click', () => { Sfx.back(); s.remove(); }); s.querySelector('[data-c="yes"]')!.addEventListener('click', () => { Sfx.confirm(); try { const cur = localStorage.getItem(Save.SAVE_KEY); if (cur) localStorage.setItem(Save.BACKUP_KEY, cur); } catch { /* ignoré */ } s.remove(); this.startNew(); });
  }
  private startNew() { Sfx.musicStop(); this.el.style.display = 'none'; cancelAnimationFrame(this.raf); openCreator(this.g, { mode: 'new', onDone: () => { this.el.innerHTML = ''; document.getElementById('ui')!.style.display = ''; }, onCancel: () => { this.el.style.display = 'block'; document.getElementById('ui')!.style.display = 'none'; this.menu(); } }); }
  private loadSheet() {
    const has = hasValidSave(); const s = this.sheet(`<h3>Charger une partie</h3><div class="small">${has ? 'Sauvegarde sur cet appareil disponible.' : 'Aucune sauvegarde valide sur cet appareil.'}</div><div class="row"><span>Sauvegarde locale</span><button class="gp-btn" data-c="slot" ${has ? '' : 'disabled'}>Charger</button></div><div class="row"><span>Depuis un fichier (.json)</span><button class="gp-btn" data-c="file">Importer</button></div><div class="row"><span></span><button class="gp-btn" data-c="close">Fermer</button></div>`);
    s.querySelector('[data-c="slot"]')!.addEventListener('click', () => { Sfx.confirm(); s.remove(); this.close(); Sfx.musicStop(); this.g.loadGame(); }); s.querySelector('[data-c="file"]')!.addEventListener('click', async () => { await this.g.importGame(); if (hasValidSave()) { s.remove(); this.close(); Sfx.musicStop(); } });
    s.querySelector('[data-c="close"]')!.addEventListener('click', () => { Sfx.back(); s.remove(); });
  }
  private settingsSheet() {
    const S: any = Settings.get(); const sl = (k: keyof SettingsT, label: string, min: number, max: number, step: number) => `<div class="row"><span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${S[k] as number}" data-r="${k}"></div>`;
    const tg = (k: keyof SettingsT, label: string) => `<div class="row"><span>${label}</span><button class="gp-btn ${S[k] ? 'on' : ''}" data-t="${k}">${S[k] ? 'Activé' : 'Désactivé'}</button></div>`;
    const s = this.sheet(`<h3>Paramètres</h3>${sl('master', 'Volume général', 0, 1, 0.05)}${sl('sfx', 'Volume des effets', 0, 1, 0.05)}${tg('music', 'Musique du menu')}
      <div class="row"><span>Qualité graphique</span><span><button class="gp-btn ${S.quality === 'high' ? 'on' : ''}" data-q="high">Haute</button> <button class="gp-btn ${S.quality === 'low' ? 'on' : ''}" data-q="low">Économe</button></span></div>
      ${sl('uiScale', "Taille de l'interface", 0.8, 1.3, 0.05)}${sl('joy', 'Sensibilité du joystick', 0.5, 1.6, 0.05)}${tg('reduceMotion', 'Réduction des animations')}${tg('bigText', 'Texte agrandi')}${tg('contrast', 'Contraste renforcé')}
      <div class="small">Économe : désactive les effets de lumière coûteux. Le son ne démarre qu'après un premier toucher (règle d'iOS).</div><div class="row"><span></span><button class="gp-btn gold" data-c="ok">Fermer</button></div>`);
    s.querySelectorAll<HTMLInputElement>('[data-r]').forEach((i) => i.addEventListener('input', () => { Settings.set({ [i.dataset.r!]: Number(i.value) } as any); Sfx.click(); }));
    s.querySelectorAll<HTMLElement>('[data-t]').forEach((b) => (b.onclick = () => { const k = b.dataset.t as keyof SettingsT; Settings.set({ [k]: !Settings.get()[k] } as any); Sfx.click(); const on = !!Settings.get()[k]; b.classList.toggle('on', on); b.textContent = on ? 'Activé' : 'Désactivé'; if (k === 'music') { on ? Sfx.musicStart() : void 0; } }));
    s.querySelectorAll<HTMLElement>('[data-q]').forEach((b) => (b.onclick = () => { Settings.set({ quality: b.dataset.q as any }); s.remove(); this.settingsSheet(); }));
    s.querySelector('[data-c="ok"]')!.addEventListener('click', () => { Sfx.confirm(); s.remove(); });
  }
  private credits() { const s = this.sheet(`<h3>Crédits</h3><div class="small"><b style="color:#fff">GOD IS BORED</b> — un jeu GRAW STUDIO<br>Conception, code, pixel art procédural, sons synthétisés : tous les éléments sont originaux.<br>Moteur : Phaser 3 · Vite · TypeScript.<br>Aucune musique ni aucun asset de jeu commercial.</div><div class="row"><span></span><button class="gp-btn gold" data-c="ok">Fermer</button></div>`); s.querySelector('[data-c="ok"]')!.addEventListener('click', () => { Sfx.back(); s.remove(); }); }
}
