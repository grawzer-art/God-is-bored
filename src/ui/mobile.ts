/** Interface mobile (iPhone, paysage) : barre compacte, croix directionnelle, boutons A/B, menu temporaire, carte rapide, invitation à tourner.
 *  Active uniquement sur écran tactile de petite taille (ou ?mobile=1) : la version Mac est inchangée. */
import type { GameScene } from '../view/scene';
import type { Hud } from './hud';
import * as God from '../sim/god';
import * as Act from '../sim/interact';
import { brief } from '../sim/observe';
import { EMOTIONS, ROOM_NAMES } from '../sim/defs';
import { emotionIcon } from '../sim/world';
import { iconCanvas } from '../art/core';

const SAFE = 'max(env(safe-area-inset-left,0px),var(--safe-l,0px))';
const CSS = `
:root{--safe-l:0px;--safe-t:0px;--safe-r:0px;--safe-b:0px}
#ui.mobile{--sl:max(env(safe-area-inset-left,0px),var(--safe-l));--st:max(env(safe-area-inset-top,0px),var(--safe-t));--sr:max(env(safe-area-inset-right,0px),var(--safe-r));--sb:max(env(safe-area-inset-bottom,0px),var(--safe-b))}
#ui:not(.mobile) .mob{display:none!important}
#ui.mobile #clock,#ui.mobile #god,#ui.mobile #powers,#ui.mobile #portraits,#ui.mobile #feed,#ui.mobile #hhud,#ui.mobile #pause{display:none!important}
#ui.mobile #charp{display:none!important}
#ui.mobile.charp-open #charp{display:block!important;top:calc(var(--st) + 8px);bottom:calc(var(--sb) + 8px);right:calc(var(--sr) + 8px);width:min(340px,46vw);font-size:12px}
.mob{position:absolute;pointer-events:auto;touch-action:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
.mob.pill{background:rgba(12,14,22,.78);border:1px solid rgba(255,255,255,.12);border-radius:12px;color:#e6e9f2;font-size:12px}
.mbtn{font:inherit;color:#e6e9f2;background:rgba(12,14,22,.78);border:1px solid rgba(255,255,255,.16);border-radius:10px;min-width:44px;min-height:44px;padding:0 12px;touch-action:none;transition:none;-webkit-tap-highlight-color:transparent}
.mbtn:active,.mbtn.on,.mbtn.pressed,#ui.mobile .btn.pressed{transform:scale(.95);background:rgba(250,205,92,.35);border-color:#fccd5c}
#mtl{left:calc(var(--sl) + 8px);top:calc(var(--st) + 6px);display:flex;gap:6px;align-items:center;padding:3px 4px 3px 9px}
#mtl b{font-weight:600;color:#fff;white-space:nowrap}
#mtr{right:calc(var(--sr) + 8px);top:calc(var(--st) + 6px);display:flex;gap:6px}
#mtr .mbtn.mode{min-width:72px;font-weight:600;letter-spacing:.04em}
#mtr .mbtn.mode.human{background:rgba(250,205,92,.3);border-color:#fccd5c;color:#fff}
#dpad{left:calc(var(--sl) + 22px);bottom:calc(var(--sb) + 16px);width:128px;height:128px;opacity:.62;transition:opacity .15s;touch-action:none}
#dpad.on{opacity:.95}
#dpad .jbase{position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle,rgba(12,14,22,.28) 0 55%,rgba(12,14,22,.5) 100%);border:2px solid rgba(255,255,255,.26);pointer-events:none}
#dpad .jbase::before,#dpad .jbase::after{content:"";position:absolute;left:50%;top:50%;background:rgba(255,255,255,.14);transform:translate(-50%,-50%)}
#dpad .jbase::before{width:2px;height:70%} #dpad .jbase::after{width:70%;height:2px}
#dpad .jknob{position:absolute;left:50%;top:50%;width:54px;height:54px;margin:-27px 0 0 -27px;border-radius:50%;background:radial-gradient(circle at 40% 35%,rgba(255,255,255,.7),rgba(190,200,225,.45));border:2px solid rgba(255,255,255,.55);pointer-events:none;will-change:transform}
#dpad.on .jknob{background:radial-gradient(circle at 40% 35%,rgba(255,236,170,.9),rgba(250,205,92,.6));border-color:#fccd5c}
#abtn,#bbtn{width:64px;height:64px;border-radius:50%;font-size:24px;font-weight:700;display:grid;place-items:center;color:#fff;background:rgba(12,14,22,.78);border:2px solid rgba(255,255,255,.28);touch-action:none}
#abtn{right:calc(var(--sr) + 18px);bottom:calc(var(--sb) + 40px);border-color:#fccd5c;color:#fccd5c} #bbtn{right:calc(var(--sr) + 92px);bottom:calc(var(--sb) + 14px)}
#abtn.rdy{box-shadow:0 0 0 3px rgba(250,205,92,.35),0 0 14px rgba(250,205,92,.5)}
#abtn,#bbtn{opacity:.78} #abtn.on,#bbtn.on{opacity:1}
#ui.human #mspeed{display:none}
#abtn.on,#bbtn.on{background:rgba(250,205,92,.55);transform:scale(.92);color:#10131c}
#abtn small,#bbtn small{position:absolute;bottom:-15px;font-size:10px;font-weight:600;color:#e6e9f2;text-shadow:0 0 3px #000,0 0 3px #000;white-space:nowrap;letter-spacing:.03em}
#qcard{left:50%;transform:translateX(-50%);top:calc(var(--st) + 6px);display:none;align-items:center;gap:8px;padding:5px 8px;max-width:min(430px,calc(100vw - 260px))}
#qcard img.p{width:32px;height:38px;image-rendering:pixelated;object-fit:contain} #qcard .t{display:flex;flex-direction:column;line-height:1.25;min-width:0} #qcard .t b{color:#fff;font-size:13px} #qcard .t span{color:#98a2b8;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#msheet{left:50%;top:50%;transform:translate(-50%,-50%);width:min(560px,calc(100vw - var(--sl) - var(--sr) - 24px));max-height:calc(var(--vh,100vh) - var(--st) - var(--sb) - 20px);overflow:auto;display:none;padding:10px;z-index:12;touch-action:pan-y;-webkit-overflow-scrolling:touch}
#msheet h4{margin:0 0 8px;font-size:13px;color:#fccd5c;letter-spacing:.08em;text-transform:uppercase;display:flex;justify-content:space-between;align-items:center}
#msheet .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:7px} #msheet .grid .mbtn{min-height:48px;text-align:center} #msheet .pc{display:flex;flex-direction:column;align-items:center;gap:3px;padding:5px;min-height:76px;font-size:11px} #msheet .pc img{width:32px;height:38px;image-rendering:pixelated}
#msheet .feedl{font-size:12px;line-height:1.45}
#fclose{right:calc(var(--sr) + 14px);top:calc(var(--st) + 12px);display:none;z-index:13;min-width:44px} #ui.charp-open #fclose{display:block}
#rotate{position:fixed;inset:0;z-index:50;background:#0b0c12;color:#e6e9f2;display:none;flex-direction:column;align-items:center;justify-content:center;gap:14px;text-align:center;padding:24px;pointer-events:auto;touch-action:none}
#ui.mobile.portrait #rotate{display:flex} #rotate .ph{width:54px;height:92px;border:3px solid #fccd5c;border-radius:11px;animation:rot 2.4s ease-in-out infinite}
@keyframes rot{0%,20%{transform:rotate(0)}60%,100%{transform:rotate(-90deg)}}
#ui.mobile #fps{left:calc(var(--sl) + 14px);top:calc(var(--st) + 62px);font-size:11px;text-shadow:0 0 3px #000,0 0 3px #000}
#ui.mobile #toast{top:calc(var(--st) + 52px);font-size:12px;max-width:60vw} #ui.mobile #prompt{font-size:11px}
#ui.mobile #dlg{bottom:auto;top:calc(var(--st) + 6px);width:min(640px,calc(100vw - var(--sl) - var(--sr) - 24px));max-height:calc(var(--vh,100vh) - var(--st) - 12px);overflow:auto;touch-action:pan-y;font-size:12px;padding:8px 10px}
#ui.mobile #dlg .txt{font-size:13px;min-height:0;margin:2px 0 6px} #ui.mobile #dlg .choices{gap:5px} #ui.mobile #dlg .btn{min-height:44px} #ui.mobile #dlg img.pp{width:44px;height:52px} #ui.mobile #dlg .small.dim:last-child{display:none}
#ui.mobile #inv,#ui.mobile #ctx{touch-action:pan-y;max-height:calc(var(--vh,100vh) - 24px);overflow:auto} #ui.mobile #ctx{top:50%;min-width:min(300px,70vw)} #ui.mobile #ctx .btn{min-height:42px}
#ui.mobile #help{max-height:calc(var(--vh,100vh) - 20px);overflow:auto;font-size:12px;touch-action:pan-y} #ui.mobile #tag{font-size:11px}
#ui.mobile #mhud{display:flex}
#mhud{display:none;left:50%;transform:translateX(-50%);bottom:calc(var(--sb) + 8px);gap:10px;align-items:center;padding:4px 10px;pointer-events:none}
#mhud .m{color:#fccd5c;font-weight:700} #mhud .nb{width:46px;font-size:9px;color:#98a2b8} #mhud .nb .bar{height:4px}
#ui:not(.human) #mhud{display:none!important}
#abtn::after,#bbtn::after{content:"";position:absolute;inset:-5px;border-radius:50%}
#ui.mobile .panel,#ui.mobile .mob.pill{backdrop-filter:none;-webkit-backdrop-filter:none}
#ui.mobile .btn,#ui.mobile .mbtn{touch-action:manipulation}
#ui.mobile .btn{min-height:44px;transition:none}
`;
const esc = (s: string) => s.replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' } as Record<string, string>)[ch]);
/** Exécute fn dès la fin de l'événement en cours (tâche immédiate, sans le délai minimal de setTimeout). */
const later = (() => { const ch = new MessageChannel(); const q: (() => void)[] = []; ch.port1.onmessage = () => q.shift()?.(); return (fn: () => void) => { q.push(fn); ch.port2.postMessage(0); }; })();
const SPEEDS_LABEL = ['II', '1x', '2x', '3x', '8x'];

export class MobileUi {
  active = false; el: Record<string, HTMLElement> = {}; sheet = ''; acc = 0; lastPower = '';
  constructor(public g: GameScene, public hud: Hud) {
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    const p = g.params.get('safe'); if (p) { const [l, t, r, b] = p.split(',').map(Number); const s = document.documentElement.style; s.setProperty('--safe-l', (l || 0) + 'px'); s.setProperty('--safe-t', (t || 0) + 'px'); s.setProperty('--safe-r', (r || 0) + 'px'); s.setProperty('--safe-b', (b || 0) + 'px'); }
    const root = hud.root; const add = (id: string, cls: string, html = '') => { const d = document.createElement('div'); d.id = id; d.className = cls; d.innerHTML = html; root.appendChild(d); this.el[id] = d; return d; };
    add('mtl', 'mob pill', '<b id="mclock">J1 07:00</b><button class="mbtn" id="mspeed">1x</button>');
    add('mtr', 'mob', '<button class="mbtn mode" id="mmode">DIEU</button><button class="mbtn" id="mmenu" aria-label="Menu">Menu</button>');
    add('dpad', 'mob', '<div class="jbase"></div><div class="jknob"></div>');
    add('abtn', 'mob', 'A<small id="alab"></small>'); add('bbtn', 'mob', 'B<small id="blab"></small>');
    add('qcard', 'mob pill'); add('msheet', 'mob panel scroll'); add('fclose', 'mob', '<button class="mbtn" id="fx">Fermer</button>'); add('mhud', 'mob pill');
    const rot = document.createElement('div'); rot.id = 'rotate'; rot.innerHTML = '<div class="ph"></div><b style="font-size:18px;color:#fccd5c">Tournez votre iPhone</b><div class="dim" style="font-size:13px;max-width:280px">GOD IS BORED se joue en paysage. Verrouillez la rotation de l\'écran dans le centre de contrôle si elle ne suit pas.</div>'; root.appendChild(rot);
    this.bindDpad(); this.bindAB(); this.bindTop();
    document.getElementById('fx')!.onclick = () => this.closeFiche();
    document.addEventListener('touchmove', (e) => { if (this.active && !(e.target as HTMLElement).closest('.scroll,#dlg,#inv,#ctx,#help,#charp')) e.preventDefault(); }, { passive: false });
    for (const ev of ['gesturestart', 'gesturechange', 'gestureend', 'dblclick']) document.addEventListener(ev, (e) => { if (this.active) e.preventDefault(); }, { passive: false } as any);
    this.bindFastTap();
    for (const ev of ['contextmenu', 'selectstart']) document.addEventListener(ev, (e) => { if (this.active) e.preventDefault(); });
    // iOS publie des dimensions périmées pendant la rotation : on re-mesure plusieurs fois.
    const settle = () => { this.refresh(); for (const d of [60, 180, 420, 800]) setTimeout(() => { this.g.scale.refresh(); this.refresh(); }, d); };
    window.addEventListener('resize', () => this.refresh()); window.addEventListener('orientationchange', settle); window.visualViewport?.addEventListener('resize', () => this.refresh()); matchMedia('(orientation: portrait)').addEventListener?.('change', () => this.refresh());
    this.refresh();
  }
  /** Réponse immédiate au toucher : retour visuel dès le doigt posé, action dès le doigt levé (sans attendre le « click » d'iOS), tolérance si le doigt glisse un peu. */
  private bindFastTap() {
    let down: { id: number; el: HTMLElement; x: number; y: number } | null = null; let suppress = 0;
    const clear = () => { document.querySelectorAll('.pressed').forEach((x) => x.classList.remove('pressed')); down = null; };
    document.addEventListener('pointerdown', (e) => {
      suppress = 0; if (!this.active || e.pointerType === 'mouse') return;
      const el = (e.target as HTMLElement).closest<HTMLElement>('.mbtn,.btn'); if (!el || (el as HTMLButtonElement).disabled) return;
      el.classList.add('pressed'); down = { id: e.pointerId, el, x: e.clientX, y: e.clientY };
    }, true);
    document.addEventListener('pointerup', (e) => {
      const d = down; clear(); if (!d || e.pointerId !== d.id) return;
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 24 || d.el.closest('[data-native]') || !d.el.isConnected) return; // data-native : export/import (le sélecteur de fichier exige un vrai « click »)
      suppress = performance.now() + 700; later(() => d.el.click()); // après tous les écouteurs de ce pointerup (sinon la scène le recevrait avec l'interface déjà changée)
    }, true);
    document.addEventListener('pointercancel', clear, true);
    document.addEventListener('click', (e) => { if (this.active && e.isTrusted && performance.now() < suppress) { e.stopPropagation(); e.preventDefault(); } }, true);
  }
  static detect(params: URLSearchParams): boolean {
    if (params.get('mobile') === '0') return false; if (params.has('mobile')) return true;
    return matchMedia('(pointer: coarse)').matches && Math.min(innerWidth, innerHeight) < 700;
  }
  refresh() {
    const was = this.active; this.active = MobileUi.detect(this.g.params); const r = this.hud.root;
    r.classList.toggle('mobile', this.active); r.classList.toggle('portrait', this.active && innerHeight > innerWidth * 1.05);
    if (this.active && !was) { this.g.fitCamera(); try { (screen.orientation as any)?.lock?.('landscape').catch(() => {}); } catch { /* Safari : verrouillage non garanti */ } }
    if (this.active) { this.updateLabels(); this.hud.onMode(this.g.mode); }
  }
  // ---- joystick virtuel analogique (toutes directions, vitesse proportionnelle à l'inclinaison ; un seul doigt, les autres boutons restent libres)
  private bindDpad() {
    const pad = this.el.dpad; const knob = pad.querySelector<HTMLElement>('.jknob')!; let id = -1; const DEAD = 0.12;
    const upd = (e: PointerEvent) => {
      const rc = pad.getBoundingClientRect(); const R = rc.width / 2; let vx = (e.clientX - rc.left - R) / R, vy = (e.clientY - rc.top - R) / R; const len = Math.hypot(vx, vy);
      if (len > 1) { vx /= len; vy /= len; }
      const m = Math.min(1, len); const mag = m < DEAD ? 0 : (m - DEAD) / (1 - DEAD);
      knob.style.transform = `translate(${vx * R * 0.62}px,${vy * R * 0.62}px)`;
      if (mag === 0) this.g.setAnalog(0, 0, 0); else { const l = Math.hypot(vx, vy) || 1; this.g.setAnalog(vx / l, vy / l, mag); }
    };
    const end = (e: PointerEvent) => { if (e.pointerId !== id) return; id = -1; pad.classList.remove('on'); knob.style.transform = ''; this.g.setAnalog(0, 0, 0); };
    pad.addEventListener('pointerdown', (e) => { if (id >= 0) return; e.preventDefault(); id = e.pointerId; pad.setPointerCapture(id); pad.classList.add('on'); upd(e); });
    pad.addEventListener('pointermove', (e) => { if (e.pointerId === id) upd(e); });
    pad.addEventListener('pointerup', end); pad.addEventListener('pointercancel', end); pad.addEventListener('lostpointercapture', end);
  }
  // ---- boutons A / B : appui court et appui long
  private bindAB() {
    const mk = (el: HTMLElement, tap: () => void, hold: () => void) => {
      let timer = 0, held = false, id = -1;
      el.addEventListener('pointerdown', (e) => { e.preventDefault(); if (id >= 0) return; id = e.pointerId; el.setPointerCapture(id); el.classList.add('on'); held = false; timer = window.setTimeout(() => { held = true; hold(); }, 450); });
      const end = (e: PointerEvent) => { if (e.pointerId !== id) return; id = -1; clearTimeout(timer); el.classList.remove('on'); if (!held && e.type === 'pointerup') tap(); };
      el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end); el.addEventListener('lostpointercapture', end);
    };
    mk(this.el.abtn, () => this.g.actionA(), () => this.g.actionAHold()); mk(this.el.bbtn, () => this.g.actionB(), () => this.g.actionBHold());
  }
  private bindTop() {
    document.getElementById('mspeed')!.onclick = () => { this.g.setSpeed((this.g.speedIndex + 1) % SPEEDS_LABEL.length); };
    document.getElementById('mmode')!.onclick = () => this.g.toggleMode();
    document.getElementById('mmenu')!.onclick = () => (this.sheet ? this.closeSheet() : this.openMenu());
  }
  // ---- feuilles temporaires
  closeSheet() { this.sheet = ''; this.el.msheet.style.display = 'none'; }
  private show(title: string, body: string) {
    this.sheet = title; this.el.msheet.innerHTML = `<h4><span>${title}</span><button class="mbtn" id="mclose">Fermer</button></h4>${body}`; this.el.msheet.style.display = 'block'; document.getElementById('mclose')!.onclick = () => this.closeSheet();
  }
  private bindBtns(sel: string, fn: (b: HTMLElement) => void) { this.el.msheet.querySelectorAll<HTMLElement>(sel).forEach((b) => (b.onclick = () => fn(b))); }
  openMenu() {
    const god = this.g.mode === 'god'; const items: [string, string][] = god ? [['res', 'Habitants'], ['pow', 'Pouvoirs'], ['lieux', 'Lieux'], ['here', 'Descendre ici'], ['journal', 'Journal'], ['murs', 'Murs'], ['save', 'Sauvegarder'], ['load', 'Charger'], ['export', 'Exporter'], ['import', 'Importer'], ['fps', 'Performances'], ['trio', 'Démo vivante'], ['demo', 'Démo vol'], ['help', 'Aide']] : [['inv', 'Inventaire'], ['pow', 'Pouvoirs'], ['journal', 'Journal'], ['lieux', 'Lieux'], ['save', 'Sauvegarder'], ['load', 'Charger'], ['export', 'Exporter'], ['import', 'Importer'], ['fps', 'Performances'], ['trio', 'Démo vivante'], ['demo', 'Démo vol'], ['help', 'Aide']];
    this.show('Menu', `<div class="grid">${items.map(([k, l]) => `<button class="mbtn" data-k="${k}"${k === 'export' || k === 'import' ? ' data-native' : ''}>${l}</button>`).join('')}</div>`);
    this.bindBtns('[data-k]', (b) => this.menuAction(b.dataset.k!));
  }
  private menuAction(k: string) {
    const g = this.g;
    switch (k) {
      case 'res': this.openResidents(); break; case 'pow': this.openPowers(); break; case 'lieux': this.openPlaces(); break; case 'journal': this.openJournal(); break;
      case 'murs': { const m = g.cycleWalls(); this.hud.toast('Murs : ' + ['bas', 'coupés', 'hauts'][m]); this.closeSheet(); break; }
      case 'save': g.saveGame(); this.closeSheet(); break; case 'load': this.closeSheet(); g.loadGame(); break; case 'export': this.closeSheet(); g.exportGame(); break; case 'import': this.closeSheet(); g.importGame(); break; case 'here': this.closeSheet(); g.descendHere(); break; case 'fps': this.hud.toggleFps(); this.closeSheet(); break; case 'demo': this.closeSheet(); g.startDemo(); break; case 'trio': this.closeSheet(); g.startTrio(); break; case 'help': this.openHelp(); break;
      case 'inv': this.closeSheet(); this.hud.toggleInventory(); break;
    }
  }
  openResidents() {
    const w = this.g.world; this.show('Habitants', `<div class="grid">${w.residents.map((c) => `<button class="mbtn pc" data-id="${c.id}"><img src="${this.g.chars[c.id].assets.portrait.toDataURL()}"><b>${esc(c.first)}</b><span class="dim">${esc(c.isAsleep() ? 'dort' : c.action_text)}</span></button>`).join('')}</div>`);
    this.bindBtns('[data-id]', (b) => { this.closeSheet(); this.g.selectChar(Number(b.dataset.id), true); });
  }
  openPowers() {
    const w = this.g.world; this.show('Pouvoirs divins', `<div class="small dim" style="margin-bottom:6px">${w.freePowers ? 'Vos pouvoirs n\'ont pas de limite.' : 'Énergie divine : <b class="gold">' + Math.floor(w.godEnergy) + ' / 100</b>.'} Choisissez, puis touchez un habitant (ou A sur le personnage au centre).</div><div class="grid">${Object.entries(God.POWERS).map(([id, d]) => `<button class="mbtn" data-p="${id}" ${God.canAfford(w, id) ? '' : 'disabled'} style="min-height:56px"><b>${d.label}</b><br><span class="dim small">${w.freePowers ? '' : d.cost + ' · '}${d.desc.slice(0, 56)}…</span></button>`).join('')}</div>`);
    this.bindBtns('[data-p]', (b) => { this.lastPower = b.dataset.p!; this.closeSheet(); this.hud.pickPower(b.dataset.p!); });
  }
  openPlaces() { this.show('Lieux', `<div class="grid">${['house|Maison', 'bar|Bar', 'street|Rue', 'downtown|Centre-ville', 'park|Parc'].map((s) => `<button class="mbtn" data-z="${s.split('|')[0]}">${s.split('|')[1]}</button>`).join('')}</div>`); this.bindBtns('[data-z]', (b) => { this.closeSheet(); this.g.focusZone(b.dataset.z as any); }); }
  openHelp() {
    this.show('Aide', `<div style="font-size:12px;line-height:1.55"><b class="gold">CROIX</b> : déplacer la caméra (DIEU) ou marcher (HUMAIN). Deux directions = diagonale.<br><b class="gold">A</b> : choisir un habitant (DIEU) · agir, parler, utiliser (HUMAIN). <span class="dim">Appui long : suivre / liste des cibles.</span><br><b class="gold">B</b> : pouvoirs (DIEU) · inventaire (HUMAIN). <span class="dim">Appui long : relancer le dernier pouvoir / courir.</span><br><b class="gold">Sur la scène</b> : un doigt glisse la caméra, deux doigts zooment, toucher un habitant ouvre sa carte rapide.<br><b class="gold">DIEU / HUMAIN</b> : changer de mode. <b class="gold">Menu</b> : habitants, lieux, journal, sauvegarde.</div>`);
  }
  openJournal() { this.show('Journal', `<div class="feedl">${this.g.world.journal.slice(-18).reverse().map((e) => { const t = Math.floor(e.t) % 1440; return `<div><span class="dim">${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}</span> ${esc(e.text)}</div>`; }).join('')}</div>`); }
  // ---- fiche complète / carte rapide
  openFiche() { if (this.g.selectedId < 0) return; this.hud.root.classList.add('charp-open'); this.hud.el.charp.style.display = 'block'; this.hud.acc = 1; }
  closeFiche() { this.hud.root.classList.remove('charp-open'); }
  onSelect(id: number) {
    this.closeFiche(); const q = this.el.qcard;
    if (id < 0 || this.g.mode !== 'god') { q.style.display = 'none'; return; }
    q.style.display = 'flex'; this.renderCard();
  }
  private renderCard() {
    const id = this.g.selectedId; if (id < 0) return; const c = this.g.world.chars[id]; const ico = emotionIcon(c.emotion); const bf = brief(this.g.world, c);
    this.el.qcard.innerHTML = `<img class="p" src="${this.g.chars[id].assets.portrait.toDataURL()}"><div class="t"><b>${esc(c.first)}</b><span>${ico ? `<img src="${iconCanvas(ico).toDataURL()}" width="11" height="11" style="image-rendering:pixelated;vertical-align:-1px"> ` : ''}${EMOTIONS[c.emotion] ?? ''} · ${esc(bf.activity)}</span><span>${esc(bf.dest)}</span><span class="dim">${esc(bf.need)} ${Math.round(bf.needValue)} %</span></div><button class="mbtn" id="qf">Fiche</button><button class="mbtn${this.g.follow ? ' on' : ''}" id="qs">Suivre</button><button class="mbtn" id="qp">Pouvoirs</button><button class="mbtn" id="qx" aria-label="Fermer">×</button>`;
    document.getElementById('qf')!.onclick = () => this.openFiche(); document.getElementById('qs')!.onclick = () => this.g.followSelected(); document.getElementById('qp')!.onclick = () => this.openPowers(); document.getElementById('qx')!.onclick = () => this.g.selectChar(-1);
  }
  // ---- mise à jour périodique
  updateLabels() {
    const human = this.g.mode === 'human'; const mm = document.getElementById('mmode')!; mm.textContent = human ? 'HUMAIN' : 'DIEU'; mm.classList.toggle('human', human);
    let alab = human ? 'agir' : 'choisir'; if (human && !this.g.hud.dialogueOpen()) { const n = Act.nearby(this.g.world, this.g.world.avatar)[0]; if (n) alab = n.kind === 'npc' ? 'parler' : 'utiliser'; }
    this.el.abtn.classList.toggle('rdy', human && alab !== 'agir'); document.getElementById('alab')!.textContent = alab; document.getElementById('blab')!.textContent = human ? 'inventaire' : 'pouvoirs';
    document.getElementById('mspeed')!.textContent = SPEEDS_LABEL[this.g.speedIndex];
  }
  update(dt: number) {
    if (!this.active) return; this.acc += dt; if (this.acc < 0.25) return; this.acc = 0; const w = this.g.world;
    const t = Math.floor(w.tod()); document.getElementById('mclock')!.textContent = `J${w.day()} ${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; this.updateLabels();
    if (this.g.mode === 'god' && this.g.selectedId >= 0 && this.el.qcard.style.display === 'flex') { const open = document.activeElement; void open; this.renderCard(); }
    if (this.g.mode === 'human') { const a = w.avatar; const col = (v: number) => (v > 60 ? '#73cc8c' : v > 30 ? '#f2c761' : '#eb6161'); const b = (n: string, v: number) => `<div class="nb">${n}<div class="bar"><i style="width:${v}%;background:${col(v)}"></i></div></div>`; this.el.mhud.innerHTML = `<span class="m">${a.money} €</span>${b('Faim', a.needs.hunger)}${b('Énergie', a.needs.energy)}${b('Social', a.needs.social)}${a.drunk > 2 ? b('Ivresse', 100 - a.drunk) : ''}`; this.el.mhud.style.display = 'flex'; } else this.el.mhud.style.display = 'none';
  }
}
void SAFE;
