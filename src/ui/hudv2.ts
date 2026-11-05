/** HUD du mode Descendre (maquette finale) : puce avatar + quartier, argent, jauges vitales, état réel de l'avatar (ou du corps incarné). Aucune donnée inventée. */
import type { GameScene } from '../view/scene';
import { districtAt } from '../sim/layout';
import { inApartment } from '../sim/home';
import { installTheme } from './theme';

const CSS = `
#hv2{position:absolute;z-index:6;pointer-events:none;display:none;left:calc(var(--sl,0px) + 10px);top:calc(var(--st,0px) + 58px);gap:6px;flex-direction:column;align-items:flex-start}
#hv2 .chip{display:flex;gap:8px;align-items:center;padding:5px 12px 5px 5px;border-radius:999px} #hv2 .chip img{width:34px;height:34px;border-radius:50%;image-rendering:pixelated;background:rgba(0,0,0,.35);object-fit:cover;object-position:top}
#hv2 .chip b{display:block;font-size:13px;color:#fff;line-height:1.1} #hv2 .chip span{font-size:11px;color:var(--gp-dim)}
#hv2m{position:absolute;z-index:6;pointer-events:none;display:none;right:calc(var(--sr,0px) + 10px);top:calc(var(--st,0px) + 58px);flex-direction:column;gap:5px;align-items:flex-end}
#hv2m .money{padding:5px 14px;border-radius:999px;font-size:16px;font-weight:700;color:var(--gp-gold)} #hv2m .vit{width:112px;padding:6px 8px;border-radius:12px;display:flex;flex-direction:column;gap:4px;font-size:10px;color:var(--gp-dim)}
#hv2m .vit div{display:flex;align-items:center;gap:6px} #hv2m .vit .gp-bar{flex:1;height:6px} #hv2m .vit span{width:34px}
@media (min-width:900px){#hv2,#hv2m{top:118px}}
.human #hhud #hstat{display:none!important}
`;
export class HudV2 {
  private chip: HTMLElement; private right: HTMLElement; private acc = 0; private lastPort = -1;
  constructor(private g: GameScene, root: HTMLElement) {
    installTheme(); const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    this.chip = document.createElement('div'); this.chip.id = 'hv2'; root.appendChild(this.chip); this.right = document.createElement('div'); this.right.id = 'hv2m'; root.appendChild(this.right);
  }
  update(dt: number) {
    const human = this.g.mode === 'human'; this.chip.style.display = this.right.style.display = human ? 'flex' : 'none'; if (!human) return;
    this.acc += dt; if (this.acc < 0.25) return; this.acc = 0; const w = this.g.world; const av = w.avatar; const cv = this.g.chars[av.id]; if (!cv) return;
    if (this.lastPort !== av.id) { this.lastPort = av.id; this.chip.innerHTML = `<div class="chip gp"><img id="hv2p" src="${cv.assets.portrait.toDataURL()}"><div><b id="hv2n"></b><span id="hv2d"></span></div></div>`; }
    (this.chip.querySelector('#hv2n') as HTMLElement).textContent = w.possess ? av.first : 'Vous'; (this.chip.querySelector('#hv2d') as HTMLElement).textContent = `${inApartment(av.cell().x, av.cell().y) ? 'Mon appartement' : districtAt(av.pos.x, av.pos.y)} · ${w.clockLabel().replace('Jour', 'J')}`;
    const bar = (l: string, v: number, c: string) => `<div><span>${l}</span><div class="gp-bar"><i style="width:${Math.max(0, Math.min(100, v))}%;background:${c}"></i></div></div>`; const col = (v: number) => (v > 60 ? '#7ee0a0' : v > 30 ? '#fccd5c' : '#ff8a8a');
    this.right.innerHTML = `<div class="money gp">€ ${Math.round(av.money).toLocaleString('fr-FR')}</div><div class="vit gp">${bar('Santé', av.hp, col(av.hp))}${bar('Faim', av.needs.hunger, col(av.needs.hunger))}${bar('Énergie', av.needs.energy, col(av.needs.energy))}${av.drunk > 2 ? bar('Ivresse', av.drunk, '#d66bff') : ''}</div>`;
  }
}
