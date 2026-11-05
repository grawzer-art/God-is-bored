/** Barre divine (maquette finale) : CRÉER · MODIFIER · ÉVÉNEMENTS · POUVOIRS · LOIS. Chaque entrée appelle un vrai système ; ce qui n'existe pas encore n'est pas proposé. */
import type { GameScene } from '../view/scene';
import * as God from '../sim/god';
import { installTheme } from './theme';

const CSS = `
#gbar{position:absolute;z-index:7;display:none;left:50%;transform:translateX(-50%);bottom:calc(var(--sb,0px) + 6px);flex-direction:column;align-items:center;gap:6px;pointer-events:none;max-width:calc(100vw - var(--sl,0px) - var(--sr,0px) - 140px)}
#gbar .row{display:flex;gap:6px;padding:6px;pointer-events:auto} #gbar .row button{min-width:62px;display:flex;flex-direction:column;align-items:center;gap:1px;padding:6px 8px;font-size:11px;line-height:1.1} #gbar .row button b{font-size:17px;color:var(--gp-gold);font-weight:400}
#gbar .row button.on{border-color:var(--gp-gold);background:rgba(252,205,92,.16)}
#gbar .tray{display:none;flex-wrap:wrap;gap:6px;padding:8px;pointer-events:auto;justify-content:center;max-width:100%} #gbar .tray .hint{width:100%;text-align:center;font-size:11px;color:var(--gp-dim)}
`;
type Cat = 'creer' | 'modifier' | 'evenements' | 'pouvoirs' | 'lois';
const CATS: [Cat, string, string][] = [['creer', 'Créer', '✦'], ['modifier', 'Modifier', '✎'], ['evenements', 'Événements', '☄'], ['pouvoirs', 'Pouvoirs', '⚡'], ['lois', 'Lois', '⚖']];
export class GodBar {
  private el: HTMLElement; private tray: HTMLElement; private open: Cat | '' = ''; private acc = 0; private sig = '';
  constructor(private g: GameScene, root: HTMLElement) {
    installTheme(); const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    this.el = document.createElement('div'); this.el.id = 'gbar'; this.el.innerHTML = '<div class="tray gp"></div><div class="row gp"></div>'; root.appendChild(this.el); this.tray = this.el.querySelector('.tray')!;
    const row = this.el.querySelector('.row')!; row.innerHTML = CATS.map(([k, l, i]) => `<button class="gp-btn" data-c="${k}"><b>${i}</b>${l}</button>`).join('');
    row.querySelectorAll<HTMLElement>('[data-c]').forEach((b) => (b.onclick = () => { const c = b.dataset.c as Cat; this.open = this.open === c ? '' : c; this.sig = ''; this.render(); }));
  }
  private btn(label: string, fn: () => void, cls = '') { const b = document.createElement('button'); b.className = 'gp-btn ' + cls; b.textContent = label; b.onclick = () => { fn(); this.sig = ''; this.render(); }; return b; }
  private render() {
    this.el.querySelectorAll('.row button').forEach((b) => b.classList.toggle('on', (b as HTMLElement).dataset.c === this.open)); this.tray.innerHTML = ''; this.tray.style.display = this.open ? 'flex' : 'none'; if (!this.open) return;
    const w = this.g.world; const sel = this.g.selectedId >= 0 ? w.chars[this.g.selectedId] : null; const hud = this.g.hud; const t = this.tray;
    const hint = (s: string) => { const d = document.createElement('div'); d.className = 'hint'; d.textContent = s; t.appendChild(d); };
    if (this.open === 'creer') {
      hint('Créer'); t.appendChild(this.btn('Faire apparaître une voiture', () => hud.toast(w.traffic?.spawn() ? 'Une voiture entre dans l\'avenue' : 'Trop de voitures en circulation')));
      hint('Humain, objet, bâtiment, terrain : pas encore disponibles.');
    } else if (this.open === 'modifier') {
      if (!sel) hint('Sélectionnez d\'abord un habitant (touchez-le), puis modifiez-le.');
      else { hint(`${sel.name}`); t.appendChild(this.btn('Ouvrir sa fiche', () => hud.fiche.open(sel.id))); t.appendChild(this.btn('+1 000 €', () => { God.give(w, sel, 1000); hud.toast(`+1 000 € pour ${sel.first}`); }, 'gold')); t.appendChild(this.btn('+100 000 €', () => { God.give(w, sel, 100000); hud.toast(`+100 000 € pour ${sel.first}`); }, 'gold')); }
    } else if (this.open === 'evenements') {
      t.appendChild(this.btn('Festin céleste', () => hud.toast(God.feast(w) ? 'Un festin céleste apparaît !' : 'Un festin est déjà servi')));
      t.appendChild(this.btn('Scandale', () => { if (!sel) hud.toast('Sélectionnez d\'abord la personne visée'); else { const n = God.scandal(w, sel); hud.toast(n ? `Le secret de ${sel.first} se répand (${n} personnes)` : `${sel.first} n'a pas de secret à révéler`); } }));
      hint('Panne, catastrophe : pas encore disponibles.');
    } else if (this.open === 'pouvoirs') {
      for (const [id, d] of Object.entries(God.POWERS)) t.appendChild(this.btn(d.label, () => { this.open = ''; hud.pickPower(id); }));
    } else {
      t.appendChild(this.btn(`Police : ${w.laws.police ? 'active' : 'suspendue'}`, () => { w.laws.police = !w.laws.police; w.emitLog(`Loi divine : la police est ${w.laws.police ? 'rétablie' : 'suspendue'}.`, 'god'); hud.toast(w.laws.police ? 'La police reprend du service' : 'Plus aucun appel n\'est traité par la police'); }));
      t.appendChild(this.btn(`Pouvoirs : ${w.freePowers ? 'illimités' : 'limités par l\'énergie'}`, () => { w.freePowers = !w.freePowers; hud.toast(w.freePowers ? 'Vos pouvoirs n\'ont plus de limite' : 'Vos pouvoirs coûtent de l\'énergie divine'); }));
      hint('Vieillissement, règles sociales : pas encore disponibles.');
    }
  }
  update(dt: number) {
    const show = this.g.mode === 'god' && !!this.g.hud.mobile?.active && !this.g.hud.fiche.isOpen(); this.el.style.display = show ? 'flex' : 'none'; if (!show) return;
    this.acc += dt; if (this.acc < 0.5) return; this.acc = 0; if (this.open === 'modifier' || this.open === 'evenements') { const s = `${this.g.selectedId}`; if (s !== this.sig) { this.sig = s; this.render(); } }
  }
}
