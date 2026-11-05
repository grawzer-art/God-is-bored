/** MON APPARTEMENT : mode décoration (maquette finale) — catalogue par catégories, inventaire, pose sur grille, annuler / rétablir, sols et murs. Les achats et placements passent par `sim/home.ts`. */
import type { GameScene } from '../view/scene';
import * as Home from '../sim/home';
import { FURN } from '../sim/defs';
import { furnSprite } from '../art/furn';
import { installTheme } from './theme';

const CSS = `
#decobtn{position:absolute;z-index:6;pointer-events:auto;display:none;left:50%;transform:translateX(-50%);top:calc(var(--st,0px) + 10px);padding:8px 16px;border-radius:999px}
#deco{position:absolute;z-index:40;pointer-events:auto;display:none;flex-direction:column;overflow:hidden;right:calc(var(--sr,0px) + 8px);top:calc(var(--st,0px) + 8px);bottom:calc(var(--sb,0px) + 8px);width:min(400px,50vw)}
#deco .hd{display:flex;align-items:center;gap:6px;padding:8px 10px} #deco .hd b{flex:1;font-size:15px;color:#fff} #deco .hd .gp-btn{min-width:42px;padding:6px 10px}
#deco .body{flex:1;overflow:auto;padding:6px 10px 10px;-webkit-overflow-scrolling:touch} #deco .chips{display:flex;gap:6px;overflow-x:auto;padding-bottom:6px} #deco .chips .gp-btn{white-space:nowrap;min-height:34px;padding:4px 10px;font-size:12px} #deco .chips .gp-btn.on{border-color:var(--gp-gold);color:var(--gp-gold)}
#deco .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px} #deco .card{display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 4px;font-size:11px;text-align:center;min-height:92px} #deco .card canvas,#deco .card img{width:48px;height:40px;object-fit:contain;image-rendering:pixelated} #deco .card .pr{color:var(--gp-gold)}
#deco .sw{width:100%;height:26px;border-radius:6px;border:1px solid rgba(255,255,255,.2)}
#deco .inv{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}
`;
export class DecoUi {
  private btn: HTMLElement; private el: HTMLElement; private tab: 'mobilier' | 'sols' = 'mobilier'; private cat: Home.Cat = 'salon'; private room = 'j'; private acc = 0; private sig = '';
  constructor(private g: GameScene, root: HTMLElement) {
    installTheme(); const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    this.btn = document.createElement('button'); this.btn.id = 'decobtn'; this.btn.className = 'gp gp-btn gold'; this.btn.textContent = '✎ Décorer'; this.btn.onclick = () => this.enter(); root.appendChild(this.btn);
    this.el = document.createElement('div'); this.el.id = 'deco'; this.el.className = 'gp'; root.appendChild(this.el); this.el.addEventListener('pointerdown', () => (this.pressed = true)); const up = () => setTimeout(() => (this.pressed = false), 120); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  }
  private pressed = false;
  isOpen() { return this.g.world.decoMode; }
  enter() { const w = this.g.world; if (!Home.inApartment(w.avatar.cell().x, w.avatar.cell().y)) { this.g.hud.toast('Entrez dans votre appartement pour le décorer.'); return; } w.decoMode = true; w.homeEdit = null; this.sig = ''; this.render(); this.g.hud.toast('Mode décoration : touchez un meuble pour le déplacer'); }
  exit() { const w = this.g.world; w.decoMode = false; w.homeEdit = null; this.el.style.display = 'none'; }
  update(dt: number) {
    const w = this.g.world; const human = this.g.mode === 'human'; const inApt = human && Home.inApartment(w.avatar.cell().x, w.avatar.cell().y);
    this.btn.style.display = inApt && !w.decoMode && !this.g.hud.fiche.isOpen() ? 'block' : 'none'; if (w.decoMode && !inApt) this.exit();
    this.el.style.display = w.decoMode ? 'flex' : 'none'; if (!w.decoMode) return; this.acc += dt; if (this.acc < 0.4) return; this.acc = 0;
    const sig = `${w.avatar.money}|${JSON.stringify(w.stash)}|${w.hist.length}|${w.redo.length}|${JSON.stringify(w.homeStyle)}|${!!w.homeEdit}`; if (sig !== this.sig && !this.pressed) this.render();
  }
  private thumb(def: string) { const d = FURN[def]; const s = furnSprite(def, 0, 0, 0, d.w, d.d); return s.canvas.toDataURL(); }
  render() {
    const w = this.g.world; const hud = this.g.hud; this.sig = `${w.avatar.money}|${JSON.stringify(w.stash)}|${w.hist.length}|${w.redo.length}|${JSON.stringify(w.homeStyle)}|${!!w.homeEdit}`;
    const scroll = (this.el.querySelector('.body') as HTMLElement | null)?.scrollTop ?? 0; let body = '';
    if (this.tab === 'mobilier') {
      const inv = Object.entries(w.stash).filter(([, n]) => n > 0);
      body = `<div class="chips">${Home.CATS.map(([k, l]) => `<button class="gp-btn ${k === this.cat ? 'on' : ''}" data-cat="${k}">${l}</button>`).join('')}</div>
        <div class="grid">${Home.CATALOG.filter((c) => c.cat === this.cat).map((c) => `<button class="gp-btn card" data-buy="${c.def}" ${w.avatar.money < c.price ? 'disabled' : ''}><img src="${this.thumb(c.def)}"><span>${c.label}</span><span class="pr">€ ${c.price}</span></button>`).join('')}</div>
        <div class="gp-sec">Mon inventaire (touchez pour poser)</div><div class="inv">${inv.map(([d, n]) => `<button class="gp-btn card" data-pl="${d}" style="width:30%"><img src="${this.thumb(d)}"><span>${Home.label(d)} ×${n}</span></button>`).join('') || '<span class="dim small">Vide : achetez un meuble ci-dessus, ou rangez-en un de l\'appartement.</span>'}</div>`;
    } else {
      body = `<div class="chips">${[['j', 'Séjour'], ['m', 'Chambre'], ['v', 'Bains']].map(([k, l]) => `<button class="gp-btn ${k === this.room ? 'on' : ''}" data-room="${k}">${l}</button>`).join('')}</div>
        <div class="gp-sec">Sol</div><div class="grid">${Home.FLOORS.map((f) => `<button class="gp-btn card ${w.homeStyle.floor[this.room] === f.id ? 'on' : ''}" data-fl="${f.id}" ${w.avatar.money < f.price ? 'disabled' : ''}><span>${f.label}</span><span class="pr">${f.price ? '€ ' + f.price : 'gratuit'}</span></button>`).join('')}</div>
        <div class="gp-sec">Murs</div><div class="grid">${Home.WALLS.map((f) => `<button class="gp-btn card" data-wl="${f.id}" ${w.avatar.money < f.price ? 'disabled' : ''}><div class="sw" style="background:rgb(${f.col.map((v) => Math.round(v * 255)).join(',')})"></div><span>${f.label}</span><span class="pr">${f.price ? '€ ' + f.price : 'gratuit'}</span></button>`).join('')}</div>`;
    }
    this.el.innerHTML = `<div class="hd"><b>Mon appartement · € ${Math.round(w.avatar.money).toLocaleString('fr-FR')}</b><button class="gp-btn" data-x="undo" ${w.hist.length ? '' : 'disabled'} aria-label="Annuler">↶</button><button class="gp-btn" data-x="redo" ${w.redo.length ? '' : 'disabled'} aria-label="Rétablir">↷</button><button class="gp-btn gold" data-x="ok" aria-label="Valider">✔</button></div>
      <div class="gp-tabs"><button data-tab="mobilier" class="${this.tab === 'mobilier' ? 'on' : ''}">Mobilier</button><button data-tab="sols" class="${this.tab === 'sols' ? 'on' : ''}">Sol &amp; murs</button></div><div class="body">${w.homeEdit ? `<div class="gp-sec" style="color:#7ee0a0">${w.homeEdit.mode === 'move' ? 'Touchez la case de destination' : 'Touchez la case où poser'}</div>` : ''}${body}</div>`;
    (this.el.querySelector('.body') as HTMLElement).scrollTop = scroll; const q = <T extends HTMLElement>(sel: string, fn: (b: T) => void) => this.el.querySelectorAll<T>(sel).forEach((b) => (b.onclick = () => fn(b)));
    q('[data-tab]', (b) => { this.tab = b.dataset.tab as any; this.render(); }); q('[data-cat]', (b) => { this.cat = b.dataset.cat as Home.Cat; this.render(); }); q('[data-room]', (b) => { this.room = b.dataset.room!; this.render(); });
    q('[data-buy]', (b) => { hud.toast(Home.buy(w, b.dataset.buy!).msg); this.render(); }); q('[data-pl]', (b) => { w.homeEdit = { mode: 'place', def: b.dataset.pl! }; hud.toast(`Touchez la case où poser : ${Home.label(b.dataset.pl!)}`); this.render(); });
    q('[data-fl]', (b) => { hud.toast(Home.restyle(w, this.room, 'floor', b.dataset.fl!).msg); this.render(); }); q('[data-wl]', (b) => { hud.toast(Home.restyle(w, this.room, 'wall', b.dataset.wl!).msg); this.render(); });
    q('[data-x]', (b) => { const k = b.dataset.x; if (k === 'undo') hud.toast(Home.undo(w).msg); else if (k === 'redo') hud.toast(Home.redo(w).msg); else this.exit(); this.render(); });
  }
}
