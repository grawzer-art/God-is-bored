/** Interface mobile (iPhone, paysage) : barre compacte, croix directionnelle, boutons A/B, menu temporaire, carte rapide, invitation à tourner.
 *  Active uniquement sur écran tactile de petite taille (ou ?mobile=1) : la version Mac est inchangée. */
import type { GameScene } from '../view/scene';
import type { Hud } from './hud';
import * as God from '../sim/god';
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
.mbtn{font:inherit;color:#e6e9f2;background:rgba(12,14,22,.78);border:1px solid rgba(255,255,255,.16);border-radius:10px;min-width:38px;min-height:34px;padding:0 10px;touch-action:none;-webkit-tap-highlight-color:transparent}
.mbtn:active,.mbtn.on{background:rgba(250,205,92,.35);border-color:#fccd5c}
#mtl{left:calc(var(--sl) + 8px);top:calc(var(--st) + 6px);display:flex;gap:6px;align-items:center;padding:3px 4px 3px 9px}
#mtl b{font-weight:600;color:#fff;white-space:nowrap}
#mtr{right:calc(var(--sr) + 8px);top:calc(var(--st) + 6px);display:flex;gap:6px}
#mtr .mbtn.mode{min-width:72px;font-weight:600;letter-spacing:.04em}
#mtr .mbtn.mode.human{background:rgba(250,205,92,.3);border-color:#fccd5c;color:#fff}
#dpad{left:calc(var(--sl) + 18px);bottom:calc(var(--sb) + 14px);width:132px;height:132px}
#dpad::before{content:"";position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle,rgba(12,14,22,.35) 0 38%,rgba(12,14,22,.12) 70%,transparent 72%);pointer-events:none}
#dpad i{position:absolute;width:44px;height:44px;border-radius:10px;background:rgba(12,14,22,.72);border:1px solid rgba(255,255,255,.2);display:grid;place-items:center;pointer-events:none}
#dpad i::after{content:"";border:7px solid transparent;border-bottom:11px solid #e6e9f2;border-top:0;display:block}
#dpad i.u{left:44px;top:0} #dpad i.d{left:44px;bottom:0;transform:rotate(180deg)} #dpad i.l{left:0;top:44px;transform:rotate(-90deg)} #dpad i.r{right:0;top:44px;transform:rotate(90deg)}
#dpad i.on{background:rgba(250,205,92,.5);border-color:#fccd5c;transform-origin:center}
#dpad i.on.d{transform:rotate(180deg) scale(.94)} #dpad i.on.l{transform:rotate(-90deg) scale(.94)} #dpad i.on.r{transform:rotate(90deg) scale(.94)} #dpad i.on.u{transform:scale(.94)}
#abtn,#bbtn{width:64px;height:64px;border-radius:50%;font-size:24px;font-weight:700;display:grid;place-items:center;color:#fff;background:rgba(12,14,22,.78);border:2px solid rgba(255,255,255,.28);touch-action:none}
#abtn{right:calc(var(--sr) + 18px);bottom:calc(var(--sb) + 40px);border-color:#fccd5c;color:#fccd5c} #bbtn{right:calc(var(--sr) + 92px);bottom:calc(var(--sb) + 14px)}
#abtn.on,#bbtn.on{background:rgba(250,205,92,.55);transform:scale(.92);color:#10131c}
#abtn small,#bbtn small{position:absolute;bottom:-15px;font-size:10px;font-weight:600;color:#e6e9f2;text-shadow:0 0 3px #000,0 0 3px #000;white-space:nowrap;letter-spacing:.03em}
#qcard{left:50%;transform:translateX(-50%);top:calc(var(--st) + 6px);display:none;align-items:center;gap:8px;padding:5px 8px;max-width:min(430px,calc(100vw - 260px))}
#qcard img.p{width:32px;height:38px;image-rendering:pixelated;object-fit:contain} #qcard .t{display:flex;flex-direction:column;line-height:1.25;min-width:0} #qcard .t b{color:#fff;font-size:13px} #qcard .t span{color:#98a2b8;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#msheet{left:50%;top:50%;transform:translate(-50%,-50%);width:min(560px,calc(100vw - var(--sl) - var(--sr) - 24px));max-height:calc(100vh - var(--st) - var(--sb) - 20px);overflow:auto;display:none;padding:10px;z-index:12;touch-action:pan-y;-webkit-overflow-scrolling:touch}
#msheet h4{margin:0 0 8px;font-size:13px;color:#fccd5c;letter-spacing:.08em;text-transform:uppercase;display:flex;justify-content:space-between;align-items:center}
#msheet .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:7px} #msheet .grid .mbtn{min-height:44px;text-align:center} #msheet .pc{display:flex;flex-direction:column;align-items:center;gap:3px;padding:5px;min-height:76px;font-size:11px} #msheet .pc img{width:32px;height:38px;image-rendering:pixelated}
#msheet .feedl{font-size:12px;line-height:1.45}
#fclose{right:calc(var(--sr) + 14px);top:calc(var(--st) + 12px);display:none;z-index:13;min-width:34px} #ui.charp-open #fclose{display:block}
#rotate{position:fixed;inset:0;z-index:50;background:#0b0c12;color:#e6e9f2;display:none;flex-direction:column;align-items:center;justify-content:center;gap:14px;text-align:center;padding:24px;pointer-events:auto;touch-action:none}
#ui.mobile.portrait #rotate{display:flex} #rotate .ph{width:54px;height:92px;border:3px solid #fccd5c;border-radius:11px;animation:rot 2.4s ease-in-out infinite}
@keyframes rot{0%,20%{transform:rotate(0)}60%,100%{transform:rotate(-90deg)}}
#ui.mobile #toast{top:calc(var(--st) + 52px);font-size:12px;max-width:60vw} #ui.mobile #prompt{font-size:11px}
#ui.mobile #dlg{bottom:auto;top:calc(var(--st) + 6px);width:min(640px,calc(100vw - var(--sl) - var(--sr) - 24px));max-height:calc(100vh - var(--st) - 12px);overflow:auto;touch-action:pan-y;font-size:12px;padding:8px 10px}
#ui.mobile #dlg .txt{font-size:13px;min-height:0;margin:2px 0 6px} #ui.mobile #dlg .choices{gap:5px} #ui.mobile #dlg .btn{min-height:38px} #ui.mobile #dlg img.pp{width:44px;height:52px} #ui.mobile #dlg .small.dim:last-child{display:none}
#ui.mobile #inv,#ui.mobile #ctx{touch-action:pan-y;max-height:calc(100vh - 24px);overflow:auto} #ui.mobile #ctx{top:50%;min-width:min(300px,70vw)} #ui.mobile #ctx .btn{min-height:42px}
#ui.mobile #help{max-height:calc(100vh - 20px);overflow:auto;font-size:12px;touch-action:pan-y} #ui.mobile #tag{font-size:11px}
#ui.mobile #mhud{display:flex}
#mhud{display:none;left:50%;transform:translateX(-50%);bottom:calc(var(--sb) + 8px);gap:10px;align-items:center;padding:4px 10px;pointer-events:none}
#mhud .m{color:#fccd5c;font-weight:700} #mhud .nb{width:46px;font-size:9px;color:#98a2b8} #mhud .nb .bar{height:4px}
#ui:not(.human) #mhud{display:none!important}
`;
const esc = (s: string) => s.replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' } as Record<string, string>)[ch]);
const SPEEDS_LABEL = ['II', '1x', '3x', '8x'];

export class MobileUi {
  active = false; el: Record<string, HTMLElement> = {}; ptrDirs = new Map<number, Set<string>>(); lastDirs = new Set<string>(); sheet = ''; acc = 0; lastPower = '';
  constructor(public g: GameScene, public hud: Hud) {
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    const p = g.params.get('safe'); if (p) { const [l, t, r, b] = p.split(',').map(Number); const s = document.documentElement.style; s.setProperty('--safe-l', (l || 0) + 'px'); s.setProperty('--safe-t', (t || 0) + 'px'); s.setProperty('--safe-r', (r || 0) + 'px'); s.setProperty('--safe-b', (b || 0) + 'px'); }
    const root = hud.root; const add = (id: string, cls: string, html = '') => { const d = document.createElement('div'); d.id = id; d.className = cls; d.innerHTML = html; root.appendChild(d); this.el[id] = d; return d; };
    add('mtl', 'mob pill', '<b id="mclock">J1 07:00</b><button class="mbtn" id="mspeed">1x</button>');
    add('mtr', 'mob', '<button class="mbtn mode" id="mmode">DIEU</button><button class="mbtn" id="mmenu" aria-label="Menu">Menu</button>');
    add('dpad', 'mob', '<i class="u"></i><i class="d"></i><i class="l"></i><i class="r"></i>');
    add('abtn', 'mob', 'A<small id="alab"></small>'); add('bbtn', 'mob', 'B<small id="blab"></small>');
    add('qcard', 'mob pill'); add('msheet', 'mob panel scroll'); add('fclose', 'mob', '<button class="mbtn" id="fx">Fermer</button>'); add('mhud', 'mob pill');
    const rot = document.createElement('div'); rot.id = 'rotate'; rot.innerHTML = '<div class="ph"></div><b style="font-size:18px;color:#fccd5c">Tournez votre iPhone</b><div class="dim" style="font-size:13px;max-width:280px">GOD IS BORED se joue en paysage. Verrouillez la rotation de l\'écran dans le centre de contrôle si elle ne suit pas.</div>'; root.appendChild(rot);
    this.bindDpad(); this.bindAB(); this.bindTop();
    document.getElementById('fx')!.onclick = () => this.closeFiche();
    document.addEventListener('touchmove', (e) => { if (this.active && !(e.target as HTMLElement).closest('.scroll')) e.preventDefault(); }, { passive: false });
    for (const ev of ['contextmenu', 'selectstart']) document.addEventListener(ev, (e) => { if (this.active) e.preventDefault(); });
    window.addEventListener('resize', () => this.refresh()); window.addEventListener('orientationchange', () => setTimeout(() => this.refresh(), 250)); matchMedia('(orientation: portrait)').addEventListener?.('change', () => this.refresh());
    this.refresh();
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
  // ---- croix directionnelle (glisser le pouce possible ; plusieurs doigts = directions cumulées)
  private bindDpad() {
    const pad = this.el.dpad; const arms: Record<string, HTMLElement> = { up: pad.querySelector('.u')!, down: pad.querySelector('.d')!, left: pad.querySelector('.l')!, right: pad.querySelector('.r')! };
    const dirsAt = (e: PointerEvent) => { const rc = pad.getBoundingClientRect(); const vx = (e.clientX - rc.left - rc.width / 2) / (rc.width / 2), vy = (e.clientY - rc.top - rc.height / 2) / (rc.height / 2); const s = new Set<string>(); if (vy < -0.32) s.add('up'); if (vy > 0.32) s.add('down'); if (vx < -0.32) s.add('left'); if (vx > 0.32) s.add('right'); return s; };
    const apply = () => {
      const all = new Set<string>(); this.ptrDirs.forEach((s) => s.forEach((d) => all.add(d)));
      for (const d of ['up', 'down', 'left', 'right']) { const was = this.lastDirs.has(d), now = all.has(d); if (was !== now) this.g.setVirtualKey('arrow' + d, now); arms[d].classList.toggle('on', now); }
      this.lastDirs = all;
    };
    pad.addEventListener('pointerdown', (e) => { e.preventDefault(); pad.setPointerCapture(e.pointerId); this.ptrDirs.set(e.pointerId, dirsAt(e)); apply(); });
    pad.addEventListener('pointermove', (e) => { if (this.ptrDirs.has(e.pointerId)) { this.ptrDirs.set(e.pointerId, dirsAt(e)); apply(); } });
    const end = (e: PointerEvent) => { if (this.ptrDirs.delete(e.pointerId)) apply(); };
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
    document.getElementById('mspeed')!.onclick = () => { this.g.setSpeed(this.g.speedIndex === 0 ? 1 : this.g.speedIndex === 1 ? 2 : this.g.speedIndex === 2 ? 3 : 0); };
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
    const god = this.g.mode === 'god'; const items: [string, string][] = god ? [['res', 'Habitants'], ['pow', 'Pouvoirs'], ['lieux', 'Lieux'], ['journal', 'Journal'], ['murs', 'Murs'], ['save', 'Sauvegarder'], ['load', 'Charger'], ['export', 'Exporter'], ['import', 'Importer'], ['help', 'Aide']] : [['inv', 'Inventaire'], ['journal', 'Journal'], ['lieux', 'Lieux'], ['save', 'Sauvegarder'], ['load', 'Charger'], ['export', 'Exporter'], ['import', 'Importer'], ['help', 'Aide']];
    this.show('Menu', `<div class="grid">${items.map(([k, l]) => `<button class="mbtn" data-k="${k}">${l}</button>`).join('')}</div>`);
    this.bindBtns('[data-k]', (b) => this.menuAction(b.dataset.k!));
  }
  private menuAction(k: string) {
    const g = this.g;
    switch (k) {
      case 'res': this.openResidents(); break; case 'pow': this.openPowers(); break; case 'lieux': this.openPlaces(); break; case 'journal': this.openJournal(); break;
      case 'murs': { const m = g.cycleWalls(); this.hud.toast('Murs : ' + ['bas', 'coupés', 'hauts'][m]); this.closeSheet(); break; }
      case 'save': g.saveGame(); this.closeSheet(); break; case 'load': this.closeSheet(); g.loadGame(); break; case 'export': this.closeSheet(); g.exportGame(); break; case 'import': this.closeSheet(); g.importGame(); break; case 'help': this.openHelp(); break;
      case 'inv': this.closeSheet(); this.hud.toggleInventory(); break;
    }
  }
  openResidents() {
    const w = this.g.world; this.show('Habitants', `<div class="grid">${w.residents.map((c) => `<button class="mbtn pc" data-id="${c.id}"><img src="${this.g.chars[c.id].assets.portrait.toDataURL()}"><b>${esc(c.first)}</b><span class="dim">${esc(c.isAsleep() ? 'dort' : c.action_text)}</span></button>`).join('')}</div>`);
    this.bindBtns('[data-id]', (b) => { this.closeSheet(); this.g.selectChar(Number(b.dataset.id), true); });
  }
  openPowers() {
    const w = this.g.world; this.show('Pouvoirs divins', `<div class="small dim" style="margin-bottom:6px">Énergie divine : <b class="gold">${Math.floor(w.godEnergy)} / 100</b> · choisissez, puis touchez un habitant (ou A sur le personnage au centre).</div><div class="grid">${Object.entries(God.POWERS).map(([id, d]) => `<button class="mbtn" data-p="${id}" ${God.canAfford(w, id) ? '' : 'disabled'} style="min-height:56px"><b>${d.label}</b><br><span class="dim small">${d.cost} · ${d.desc.slice(0, 44)}…</span></button>`).join('')}</div>`);
    this.bindBtns('[data-p]', (b) => { this.lastPower = b.dataset.p!; this.closeSheet(); this.hud.pickPower(b.dataset.p!); });
  }
  openPlaces() { this.show('Lieux', `<div class="grid">${['house|Maison', 'bar|Bar', 'street|Rue'].map((s) => `<button class="mbtn" data-z="${s.split('|')[0]}">${s.split('|')[1]}</button>`).join('')}</div>`); this.bindBtns('[data-z]', (b) => { this.closeSheet(); this.g.focusZone(b.dataset.z as any); }); }
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
    const id = this.g.selectedId; if (id < 0) return; const c = this.g.world.chars[id]; const ico = emotionIcon(c.emotion);
    this.el.qcard.innerHTML = `<img class="p" src="${this.g.chars[id].assets.portrait.toDataURL()}"><div class="t"><b>${esc(c.first)}</b><span>${ico ? `<img src="${iconCanvas(ico).toDataURL()}" width="11" height="11" style="image-rendering:pixelated;vertical-align:-1px"> ` : ''}${EMOTIONS[c.emotion] ?? ''} · ${esc(c.isAsleep() ? 'dort' : c.action_text)}</span><span>${esc(ROOM_NAMES[this.g.world.roomOf(c.pos)] ?? '')}</span></div><button class="mbtn" id="qf">Fiche</button><button class="mbtn" id="qp">Pouvoirs</button><button class="mbtn" id="qx" aria-label="Fermer">×</button>`;
    document.getElementById('qf')!.onclick = () => this.openFiche(); document.getElementById('qp')!.onclick = () => this.openPowers(); document.getElementById('qx')!.onclick = () => this.g.selectChar(-1);
  }
  // ---- mise à jour périodique
  updateLabels() {
    const human = this.g.mode === 'human'; const mm = document.getElementById('mmode')!; mm.textContent = human ? 'HUMAIN' : 'DIEU'; mm.classList.toggle('human', human);
    document.getElementById('alab')!.textContent = human ? 'agir' : 'choisir'; document.getElementById('blab')!.textContent = human ? 'inventaire' : 'pouvoirs';
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
