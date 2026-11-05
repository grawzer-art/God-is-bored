/** Interface GOD en HTML/CSS par-dessus le canvas (sobre, sombre, tactile). */
import type { GameScene } from '../view/scene';
import { SPEEDS } from '../view/scene';
import { NEEDS, NEED_LABEL, EMOTIONS, ROOM_NAMES, actLabel } from '../sim/defs';
import { GOALS } from '../sim/roster';
import * as God from '../sim/god';
import { goalText } from '../sim/social';
import { emotionIcon } from '../sim/world';
import type { SimChar } from '../sim/simchar';
import { iconCanvas } from '../art/core';
import { HumanUi, HUMAN_CSS } from './human';
import { MobileUi } from './mobile';
import { relationLabelToPlayer } from '../sim/interact';

const CSS = `
#ui .panel{pointer-events:auto}
.row{display:flex;gap:6px;align-items:center}
.btn{font:inherit;color:#e6e9f2;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:6px 10px;min-height:30px;cursor:pointer}
.btn:hover{background:rgba(255,255,255,.15)} .btn.on{background:rgba(250,205,92,.28);border-color:#fccd5c} .btn:disabled{opacity:.35;cursor:default}
.dim{color:#98a2b8} .gold{color:#fccd5c} .small{font-size:11px}
.bar{height:8px;border-radius:4px;background:rgba(255,255,255,.09);overflow:hidden}.bar>i{display:block;height:100%;border-radius:4px;transition:width .2s}
#clock{left:16px;top:14px} #clock .t{font-size:22px;font-weight:600;color:#fff}
#god{right:16px;top:14px;width:268px} #powers{right:16px;bottom:16px;width:620px;max-width:calc(100vw - 32px)}
#portraits{left:16px;bottom:16px;display:flex;gap:5px;padding:8px} .pt{position:relative;width:56px;height:84px;padding:2px;border-radius:8px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);cursor:pointer;color:#e6e9f2;font:inherit;font-size:11px;display:flex;flex-direction:column;align-items:center;justify-content:space-between}
.pt.sel{background:rgba(250,205,92,.2);border-color:#fccd5c} .pt img.p{width:44px;height:52px;image-rendering:pixelated;object-fit:contain} .pt .em{position:absolute;right:2px;top:2px;width:14px;height:14px;image-rendering:pixelated} .pt .bar{width:44px;height:5px}
#feed{left:16px;bottom:112px;width:440px;height:170px;overflow:hidden;font-size:12px;line-height:1.4;pointer-events:none;background:rgba(5,6,9,.62)}
#charp{right:16px;top:112px;bottom:112px;width:340px;overflow:auto;display:none;padding:12px}
#charp h3{margin:0;font-size:19px;color:#fff} #charp .sec{font-size:10px;letter-spacing:.08em;color:#fccd5c;margin:10px 0 3px;text-transform:uppercase}
#charp .need{display:flex;gap:8px;align-items:center;margin:3px 0} #charp .need span{width:62px;color:#98a2b8;font-size:12px} #charp .need .bar{flex:1}
#ui #toast,#ui #pause,#ui #fps{pointer-events:none}
#toast{left:50%;top:78px;transform:translateX(-50%);background:rgba(12,14,22,.9);padding:8px 14px;border-radius:10px;opacity:0;transition:opacity .3s;pointer-events:none}
#help{left:50%;top:50%;transform:translate(-50%,-50%);width:600px;max-width:calc(100vw - 32px);padding:18px 20px} #help h1{margin:0 0 6px;color:#fccd5c;font-size:26px}
#tag{position:absolute;pointer-events:none;color:#fff;font-size:12px;text-shadow:0 0 4px #000,0 0 4px #000;transform:translate(-50%,-100%);display:none}
#fps{left:18px;top:118px;color:#9bffb4;font-size:11px;display:none;pointer-events:none}
#menu{display:none;z-index:9} #menu div{padding:7px 12px;cursor:pointer;border-radius:6px} #menu div:hover{background:rgba(255,255,255,.12)}
#pause{left:50%;top:22px;transform:translateX(-50%);font-size:20px;color:#fff;opacity:.8;display:none;pointer-events:none}
@media (max-width:900px){#feed{display:none}#portraits{left:8px;right:8px;bottom:8px;overflow-x:auto}#powers{bottom:104px;right:8px;left:8px;width:auto}#charp{top:70px;bottom:196px;width:min(340px,calc(100vw - 16px));right:8px}#god{width:200px;right:8px}#clock{left:8px}}
@media (max-height:520px){
 #clock{left:6px;top:6px;padding:5px 8px}#clock .t{font-size:15px}#ph{display:none}#clock .btn{padding:3px 7px;min-height:24px;font-size:11px}
 #god{right:6px;top:6px;width:150px;padding:5px 8px}#god .small.dim{display:none}
 #portraits{left:4px;bottom:4px;right:auto;padding:4px;transform:scale(.72);transform-origin:bottom left;overflow:visible}
 #powers{left:auto;right:4px;bottom:4px;width:auto;max-width:46vw;padding:4px 6px}#powers #hint{display:none}#powers .btn{padding:3px 6px;min-height:24px;font-size:11px}
 #charp{top:54px;bottom:80px;width:250px;right:4px;font-size:11px}#help{width:min(560px,calc(100vw - 16px));max-height:calc(100vh - 16px);overflow:auto;padding:12px}
}
`;
const KIND: Record<string, string> = { info: '#9aa3b5', social: '#8ec5ff', talk: '#e8ecf5', drama: '#ff7b7b', goal: '#ffd666', god: '#c9a7ff' };
const iconUrl = (n: string) => iconCanvas(n).toDataURL();
const esc = (s: string) => s.replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' } as Record<string, string>)[ch]);
const needCol = (v: number) => (v > 60 ? '#73cc8c' : v > 30 ? '#f2c761' : '#eb6161');
const moodCol = (m: number) => (m > 20 ? '#73d18c' : m > -20 ? '#f2cc66' : '#eb6666');

export class Hud {
  root = document.getElementById('ui')!; el: Record<string, HTMLElement> = {}; human!: HumanUi; mobile!: MobileUi; modeBtn!: HTMLElement; powerMode = ''; powerFirst = -1; acc = 0; toastT = 0; helpT = 14; selected = -1; feed: { t: number; text: string; kind: string }[] = [];
  constructor(public g: GameScene) {
    const st = document.createElement('style'); st.textContent = CSS + HUMAN_CSS; document.head.appendChild(st);
    this.root.innerHTML = `
      <div id="clock" class="panel"><div class="row" style="align-items:baseline"><span class="t" id="ck">Jour 1</span><span class="dim" id="ph"></span></div>
        <div class="row" style="margin-top:6px" id="speeds"></div></div>
      <div id="god" class="panel"><div class="row" style="justify-content:space-between"><b class="gold small">DIEU</b><span class="small" id="ge"></span></div><div class="bar" style="margin:5px 0 8px"><i id="gb" style="background:#fccd5c"></i></div>
        <div class="row small dim" style="justify-content:space-between"><span>Ennui divin</span><span id="fa"></span></div><div class="bar" style="margin-top:4px;height:6px"><i id="eb" style="background:#a380f2"></i></div></div>
      <div id="feed" class="panel"></div>
      <div id="portraits" class="panel"></div>
      <div id="powers" class="panel"><div class="small dim" id="hint" style="margin-bottom:6px"></div><div class="row" id="pw"></div></div>
      <div id="charp" class="panel"></div>
      <div id="toast" class="panel"></div><div id="pause" class="panel" style="background:none;border:none">PAUSE</div><div id="fps" class="panel" style="background:none;border:none"></div>
      <div id="tag"></div><div id="menu" class="panel" style="position:absolute"></div>
      <div id="help" class="panel"><h1>GOD IS BORED</h1><div>Vous êtes un dieu. Huit adultes vivent sous ce toit. Observez… ou intervenez.</div>
        <div style="margin:10px 0;line-height:1.7;font-size:13px"><span class="dim">CAMÉRA</span> molette / pincement : zoom · ZQSD, flèches ou glisser : déplacer · F : suivre<br><span class="dim">SÉLECTION</span> clic sur un habitant ou son portrait · Tab : suivant · double-clic : centrer<br><span class="dim">TEMPS</span> Espace : pause · [ ] : vitesse · V : murs bas / coupés / hauts<br><span class="dim">POUVOIRS</span> 1 Bénédiction · 2 Murmure · 3 Coup du destin (2 clics) · 4 Festin céleste · Échap annule<br><span class="dim">SAUVEGARDE</span> F5 sauvegarder · F9 charger (auto toutes les 2 min)</div>
        <div class="gold" style="font-size:13px">La simulation tourne seule. Votre énergie divine se régénère plus vite quand ils croient en vous — ou prient.</div><div class="row" style="margin-top:12px"><button class="btn" id="go">Commencer</button><span class="dim small">H ou F1 : aide · F3 : performances</span></div></div>`;
    for (const id of ['clock', 'god', 'feed', 'portraits', 'powers', 'charp', 'toast', 'pause', 'fps', 'tag', 'menu', 'help', 'ck', 'ph', 'speeds', 'ge', 'gb', 'fa', 'eb', 'hint', 'pw', 'go']) this.el[id] = document.getElementById(id)!;
    ['II', '1x', '3x', '8x'].forEach((l, i) => { const b = document.createElement('button'); b.className = 'btn'; b.textContent = l; b.onclick = () => g.setSpeed(i); this.el.speeds.appendChild(b); });
    const mk = (label: string, fn: () => void, tip = '') => { const b = document.createElement('button'); b.className = 'btn'; b.textContent = label; b.title = tip; b.onclick = fn; this.el.speeds.appendChild(b); };
    mk('Descendre (G)', () => g.toggleMode(), 'Incarner un humain / redevenir dieu'); this.modeBtn = this.el.speeds.lastElementChild as HTMLElement;
    mk('Maison', () => g.focusZone('house')); mk('Bar', () => g.focusZone('bar')); mk('Rue', () => g.focusZone('street'));
    mk('Murs', () => { const m = g.cycleWalls(); this.toast('Murs : ' + ['bas', 'coupés', 'hauts'][m]); }, 'V'); mk('Sauver', () => g.saveGame(), 'F5'); mk('Charger', () => g.loadGame(), 'F9'); mk('Exporter', () => g.exportGame(), 'Fichier JSON'); mk('Importer', () => g.importGame(), 'Fichier JSON');
    for (const [id, d] of Object.entries(God.POWERS)) { const b = document.createElement('button'); b.className = 'btn'; b.style.flex = '1'; b.textContent = `${d.key} ${d.label} (${d.cost})`; b.title = d.desc; b.dataset.id = id; b.onclick = () => this.pickPower(id); this.el.pw.appendChild(b); }
    this.el.go.onclick = () => { this.el.help.style.display = 'none'; this.helpT = 1e9; };
    if (g.params.has('nohelp')) this.el.help.style.display = 'none';
    this.buildPortraits(); this.human = new HumanUi(g, this.root); this.mobile = new MobileUi(g, this); if (this.mobile.active) { this.el.help.style.display = 'none'; this.helpT = 1e9; this.toast('Croix : caméra · A : choisir · B : pouvoirs · Menu : le reste'); } this.rebind(); this.onSpeed(g.speedIndex);
    document.addEventListener('pointerdown', (e) => { if (!(e.target as HTMLElement).closest('#menu')) this.el.menu.style.display = 'none'; });
  }
  get w() { return this.g.world; }
  onMode(m: 'god' | 'human') { this.mobile?.updateLabels(); if (m === 'human') this.mobile?.onSelect(-1); this.root.classList.toggle('human', m === 'human'); this.modeBtn.textContent = m === 'human' ? 'Redevenir dieu (G)' : 'Descendre (G)'; this.modeBtn.classList.toggle('on', m === 'human'); }
  openDialogue(n: SimChar) { this.human.openDialogue(n); } closeDialogue() { this.human.close(); } dialogueOpen() { return this.human.dialogueOpen(); } pickDialogue(i: number) { this.human.pickDialogue(i); }
  contextOpen() { return this.human.contextOpen(); } showContext(l: any) { this.human.showContext(l); } hideContext() { this.human.hideContext(); } pickContext(i: number) { this.human.pickContext(i); }
  toggleInventory() { this.human.toggleInventory(); } flash(k: 'descend' | 'ascend') { this.human.flash(k); } cancelPower() { this.powerMode = ''; this.powerFirst = -1; }
  diagOpen = false; panelFor = -1;
  rebind() {
    this.w.listeners.log.push((e) => { this.feed.push(e); if (this.feed.length > 8) this.feed.shift(); this.renderFeed(); });
    this.feed = this.w.journal.slice(-8); this.renderFeed(); this.onSpeed(this.g.speedIndex); this.onSelect(-1);
  }
  buildPortraits() {
    const box = this.el.portraits; box.innerHTML = '';
    this.g.chars.filter((cv) => cv.sim.kind === 'resident').forEach((cv) => {
      const b = document.createElement('button'); b.className = 'pt'; b.title = `${cv.sim.name} — ${cv.sim.job}`;
      b.innerHTML = `<img class="p" src="${cv.assets.portrait.toDataURL()}"><span>${cv.sim.first}</span><div class="bar"><i></i></div><img class="em" style="display:none">`;
      b.onclick = () => { if (this.powerMode) this.onWorldClick(cv.sim.id, 0, 0); else this.g.selectChar(cv.sim.id, true); }; box.appendChild(b);
    });
  }
  renderFeed() {
    this.el.feed.innerHTML = this.feed.map((e) => { const t = Math.floor(e.t) % 1440; const hh = String(Math.floor(t / 60)).padStart(2, '0'), mm = String(t % 60).padStart(2, '0'); const col = KIND[e.kind] ?? '#9aa3b5'; return `<div><span style="color:#6f7890">${hh}:${mm}</span> <span style="color:${col};${e.kind === 'talk' ? 'font-style:italic' : ''}">${esc(e.text)}</span></div>`; }).join('');
  }
  toast(msg: string) { this.el.toast.textContent = msg; this.el.toast.style.opacity = '1'; this.toastT = 2.6; }
  onSpeed(i: number) { [...this.el.speeds.children].slice(0, 4).forEach((b, k) => b.classList.toggle('on', k === i)); }
  onSelect(id: number) {
    this.selected = id; this.el.charp.style.display = id >= 0 && !this.mobile?.active ? 'block' : 'none'; this.mobile?.onSelect(id);
    [...this.el.portraits.children].forEach((b, k) => b.classList.toggle('sel', k === id)); this.acc = 1;
  }
  pickPower(id: string) {
    if (!God.POWERS[id]) return;
    if (!God.canAfford(this.w, id)) { this.toast(`Pas assez d'énergie divine (${God.cost(id)} requis)`); return; }
    if (God.POWERS[id].target === 'none') { if (id === 'feast' && God.feast(this.w)) this.toast('Un festin céleste apparaît !'); this.powerMode = ''; }
    else { this.powerMode = this.powerMode === id ? '' : id; this.powerFirst = -1; }
    this.syncPowers();
  }
  escape() { if (this.powerMode) { this.powerMode = ''; this.powerFirst = -1; this.syncPowers(); } else if (this.el.help.style.display !== 'none') this.el.help.style.display = 'none'; else this.g.selectChar(-1); this.el.menu.style.display = 'none'; }
  toggleHelp() { if (this.mobile?.active) { this.mobile.sheet === 'Aide' ? this.mobile.closeSheet() : this.mobile.openHelp(); return; } this.el.help.style.display = this.el.help.style.display === 'none' ? 'block' : 'none'; this.helpT = 1e9; }
  toggleFps() { this.el.fps.style.display = this.el.fps.style.display === 'block' ? 'none' : 'block'; }
  syncPowers() {
    [...this.el.pw.children].forEach((b) => { const el = b as HTMLButtonElement; const id = el.dataset.id!; el.classList.toggle('on', this.powerMode === id); el.disabled = !God.canAfford(this.w, id) && this.powerMode !== id; });
    const h = this.el.hint;
    if (!this.powerMode) { h.textContent = 'Pouvoirs divins : choisissez, puis cliquez sur un habitant'; h.style.color = ''; this.g.game.canvas.style.cursor = 'default'; }
    else { const d = God.POWERS[this.powerMode]; h.textContent = `${d.label} : ${d.target === 'two' ? (this.powerFirst < 0 ? 'cliquez le premier habitant' : 'cliquez le second') : 'cliquez un habitant'} (Échap pour annuler)`; h.style.color = '#fccd5c'; this.g.game.canvas.style.cursor = 'crosshair'; }
  }
  onWorldClick(id: number, sx: number, sy: number) {
    if (!this.powerMode) { this.g.selectChar(id, false); return; }
    if (id < 0) return; const c = this.w.chars[id];
    switch (this.powerMode) {
      case 'bless': if (God.bless(this.w, c)) this.toast(`${c.first} est béni(e)`); this.powerMode = ''; break;
      case 'whisper': {
        const m = this.el.menu; m.innerHTML = ''; Object.entries(God.WHISPERS).forEach(([k, label]) => { const d = document.createElement('div'); d.textContent = label; d.onclick = () => { God.whisper(this.w, c, k); this.powerMode = ''; m.style.display = 'none'; this.syncPowers(); }; m.appendChild(d); });
        m.style.left = Math.min(sx || 300, innerWidth - 240) + 'px'; m.style.top = Math.min(sy || 300, innerHeight - 260) + 'px'; m.style.display = 'block'; break;
      }
      case 'fate':
        if (this.powerFirst < 0) this.powerFirst = id;
        else if (this.powerFirst !== id) { const a = this.w.chars[this.powerFirst]; this.toast(God.fate(this.w, a, c) ? `Le destin rapproche ${a.first} et ${c.first}` : "Impossible (l'un dort ?)"); this.powerMode = ''; this.powerFirst = -1; } break;
    }
    this.syncPowers();
  }
  update(dt: number) {
    this.human.update(dt); this.mobile.update(dt); this.el.pause.style.display = this.g.speedIndex === 0 && !this.human.dialogueOpen() ? 'block' : 'none';
    this.acc += dt;
    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT < 0.5) this.el.toast.style.opacity = String(Math.max(0, this.toastT * 2)); }
    if (this.helpT < 1e8) { this.helpT -= dt; if (this.helpT < 0) { this.el.help.style.display = 'none'; this.helpT = 1e9; } }
    const show = this.g.hoverId >= 0 ? this.g.hoverId : this.selected;
    if (show >= 0) { const cv = this.g.chars[show]; const hp = cv.headPoint(); const s = this.g.worldToScreen(hp.x, hp.y); const t = this.el.tag; t.textContent = cv.sim.first; t.style.left = s.x + 'px'; t.style.top = s.y - 6 + 'px'; t.style.display = 'block'; } else this.el.tag.style.display = 'none';
    if (this.acc < 0.2) return; this.acc = 0; const w = this.w;
    this.el.ck.textContent = w.clockLabel(); const h = w.hour(); this.el.ph.textContent = h < 5.5 || h >= 21.5 ? 'Nuit' : h < 8 ? 'Aube' : h < 12 ? 'Matin' : h < 18 ? 'Après-midi' : 'Soirée';
    this.el.ge.textContent = `${Math.floor(w.godEnergy)} / 100`; (this.el.gb as HTMLElement).style.width = w.godEnergy + '%'; (this.el.eb as HTMLElement).style.width = w.ennui + '%';
    this.el.fa.textContent = `Foi moyenne ${Math.floor(w.residents.reduce((s, c) => s + c.faith, 0) / w.residents.length)} %`; this.syncPowers();
    [...this.el.portraits.children].forEach((b, k) => {
      const c = w.residents[k]; const i = b.querySelector('.bar i') as HTMLElement; i.style.width = (c.mood + 100) / 2 + '%'; i.style.background = moodCol(c.mood);
      const em = b.querySelector('img.em') as HTMLImageElement; const ico = c.isAsleep() ? 'zzz' : emotionIcon(c.emotion); em.style.display = ico ? 'block' : 'none'; if (ico) em.src = iconUrl(ico);
    });
    if (this.selected >= 0) this.renderPanel(w.chars[this.selected]);
    if (this.el.fps.style.display === 'block') this.el.fps.textContent = `${Math.round(this.g.game.loop.actualFps)} FPS · ${this.g.lighting.active} lumières actives · ${w.mess.length} objets au sol`;
  }
  diagHtml(c: SimChar) {
    const d = c.diag; if (!d) return '<div class="small dim">Aucune décision enregistrée pour l\'instant.</div>';
    const age = Math.round(this.w.clock - d.t);
    return `<div class="small dim">Il y a ${age} min de jeu · choisi : <b class="gold">${esc(actLabel(d.chosen))}</b> (${esc(d.why)})</div>` + d.cands.map((x, i) => `<div class="small" style="margin:3px 0"><b style="color:${x.act === d.chosen ? '#fccd5c' : '#c4cad8'}">${i + 1}. ${esc(actLabel(x.act))}</b> <span class="dim">score ${x.score}</span><br><span class="dim">${esc(x.why)}</span></div>`).join('');
  }
  traits(c: SimChar) {
    const o: string[] = []; const t = c.traits;
    o.push(t.extraversion > 0.62 ? 'Extraverti(e)' : t.extraversion < 0.38 ? 'Réservé(e)' : 'Sociable'); o.push(t.agreeableness > 0.65 ? 'Bienveillant(e)' : t.agreeableness < 0.38 ? 'Sec / frondeur' : 'Pondéré(e)');
    if (t.neuroticism > 0.62) o.push('Anxieux(se)'); else if (t.neuroticism < 0.32) o.push('Serein(e)'); if (t.orderliness > 0.65) o.push('Ordonné(e)'); else if (t.orderliness < 0.32) o.push('Désordonné(e)');
    if (t.openness > 0.7) o.push('Curieux(se)'); if (c.chrono > 0.5) o.push('Oiseau de nuit'); else if (c.chrono < -0.5) o.push('Lève-tôt'); return o.join(' · ');
  }
  renderPanel(c: SimChar) {
    const w = this.w; const bar = (v: number, col: string) => `<div class="bar" style="flex:1"><i style="width:${v}%;background:${col}"></i></div>`; const ico = emotionIcon(c.emotion);
    const prefs = Object.entries(c.pref); const likes = prefs.filter((p) => p[1] >= 3).sort((a, b) => b[1] - a[1]).slice(0, 3).map((p) => actLabel(p[0]).toLowerCase()); const dis = prefs.filter((p) => p[1] <= -3).sort((a, b) => a[1] - b[1]).slice(0, 3).map((p) => actLabel(p[0]).toLowerCase());
    const rels = w.chars.filter((o) => o.id !== c.id && !o.away).map((o) => ({ o, r: w.getRel(c.id, o.id) })).sort((a, b) => Math.abs(b.r.aff) - Math.abs(a.r.aff)).slice(0, 5);
    const mems = [...c.memories].sort((a, b) => b.t - a.t).slice(0, 5);
    const info = GOALS[c.goal.id];
    const partA = `<div class="row" style="align-items:flex-start;gap:10px"><img src="${this.g.chars[c.id].assets.portrait.toDataURL()}" style="width:66px;height:78px;image-rendering:pixelated;object-fit:contain">
      <div style="flex:1"><h3>${c.name}</h3><div class="dim small">${c.age} ans · ${c.job} · ${c.gender === 'F' ? 'Femme' : 'Homme'}</div>
      <div class="row gold" style="margin-top:3px">${ico ? `<img src="${iconUrl(ico)}" width="18" height="18" style="image-rendering:pixelated">` : ''}<span>${EMOTIONS[c.emotion] ?? c.emotion}</span></div>
      <div class="small">${esc(c.action_text)} — ${ROOM_NAMES[w.roomOf(c.pos)] ?? ''}</div></div></div>
      <div class="dim small" style="margin-top:8px">${esc(c.bio)}</div><div class="gold small" style="margin-top:4px">${this.traits(c)}</div>
      <div class="small" style="margin-top:6px">Plat préféré : ${c.fav_food}${likes.length ? `<br>Prend goût à : ${likes.join(', ')}` : ''}${dis.length ? `<br>Évite de plus en plus : ${dis.join(', ')}` : ''}</div>
      <div class="sec">Besoins</div>${NEEDS.map((n) => `<div class="need"><span>${NEED_LABEL[n]}</span>${bar(c.needs[n], needCol(c.needs[n]))}</div>`).join('')}
      <div class="need"><span>Humeur</span>${bar((c.mood + 100) / 2, moodCol(c.mood))}</div><div class="need"><span>Foi en Dieu</span>${bar(c.faith, '#fccd5c')}</div>
      <div class="sec">Objectif</div><div class="small">${c.goal.done ? '[Accompli] ' : ''}${esc(goalText(c))}</div>
      <div class="sec">Relation avec vous</div><div class="small">Son avis sur vous : <b>${relationLabelToPlayer(w, c)}</b> <span class="dim">(${Math.round(w.getRel(c.id, w.avatar.id).aff)})</span></div>
      <div class="sec">Relations</div><div class="small">${rels.map(({ o, r }) => `<div><span style="color:${r.aff > 25 ? '#7fd99a' : r.aff < -15 ? '#ff8a8a' : '#c4cad8'}">${o.first}</span> ${o.kind === 'resident' ? w.relLabel(c.id, o.id) : o.kind === 'avatar' ? 'Son avis sur vous : ' + relationLabelToPlayer(w, c) : 'Barman'} <span class="dim">(${r.aff >= 0 ? '+' : ''}${Math.round(r.aff)})</span></div>`).join('')}</div>
      <div class="sec">Souvenirs récents</div><div class="small">${mems.length ? mems.map((m) => { const t = Math.floor(m.t) % 1440; return `<div><span class="dim">J${Math.floor(m.t / 1440) + 1} ${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}</span> <span style="color:${m.v > 0.15 ? '#7fd99a' : m.v < -0.15 ? '#ff8a8a' : '#c4cad8'}">${esc(m.text)}</span></div>`; }).join('') : '<span class="dim">Rien de marquant pour l\'instant.</span>'}</div>`;
    const partB = `<div class="sec">Secret</div><div class="small dim">${c.faith >= 55 ? esc(c.secret) : "Cet habitant ne vous fait pas encore assez confiance pour vous confier ses secrets. (Foi ≥ 55)"}</div>`;
    if (this.panelFor !== c.id || !this.el.charp.querySelector('#cpA')) { this.panelFor = c.id; this.el.charp.innerHTML = '<div id="cpA"></div><div class="sec">Décision <button class="btn" id="dgb" style="padding:1px 7px;min-height:20px;font-size:11px"></button></div><div id="cpD"></div><div id="cpB"></div>'; const d0 = this.el.charp.querySelector('#dgb') as HTMLElement; d0.onclick = () => { this.diagOpen = !this.diagOpen; this.acc = 1; }; }
    (this.el.charp.querySelector('#cpA') as HTMLElement).innerHTML = partA; (this.el.charp.querySelector('#cpD') as HTMLElement).innerHTML = this.diagOpen ? this.diagHtml(c) : ''; (this.el.charp.querySelector('#cpB') as HTMLElement).innerHTML = partB; (this.el.charp.querySelector('#dgb') as HTMLElement).textContent = this.diagOpen ? 'masquer' : 'pourquoi ?';
    void info; void SPEEDS;
  }
}
