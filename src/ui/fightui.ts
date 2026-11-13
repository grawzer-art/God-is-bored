/** Interface de bagarre minimaliste : barre de vie et d'endurance du joueur, barre de vie de l'adversaire ciblé, compteur de combo. Visible seulement pendant une bagarre. */
import type { GameScene } from '../view/scene';
import * as Fight from '../sim/fight';
import { installTheme } from './theme';

const CSS = `
#fightui{position:absolute;z-index:6;left:50%;transform:translateX(-50%);top:calc(var(--st,0px) + 6px);display:none;gap:10px;pointer-events:none;align-items:stretch;width:min(430px,calc(100vw - var(--sl,0px) - var(--sr,0px) - 340px))}
#fightui .fp{flex:1;padding:5px 9px;border-radius:12px;display:flex;flex-direction:column;gap:3px;min-width:0} #fightui .fp b{font-size:11px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#fightui .hp,#fightui .st{height:7px;border-radius:4px;background:rgba(255,255,255,.12);overflow:hidden} #fightui .hp i{display:block;height:100%;background:linear-gradient(90deg,#4be08a,#a8f070);transition:width .12s} #fightui .st{height:4px} #fightui .st i{display:block;height:100%;background:#ffd23c;transition:width .1s}
#fightui .en .hp i{background:linear-gradient(90deg,#ff5a5a,#ff9a5a)} #fightui .cmb{position:absolute;left:50%;transform:translateX(-50%);top:46px;font-weight:800;font-size:16px;color:#ffd23c;text-shadow:0 0 4px #000,0 0 4px #000;display:none;white-space:nowrap}
#ui.hud-hidden #fightui{display:none!important}
`;
export class FightUi {
  private el: HTMLElement; private acc = 0;
  constructor(private g: GameScene, root: HTMLElement) {
    installTheme(); const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    this.el = document.createElement('div'); this.el.id = 'fightui'; this.el.innerHTML = '<div class="fp gp me"><b></b><div class="hp"><i></i></div><div class="st"><i></i></div></div><div class="fp gp en"><b></b><div class="hp"><i></i></div></div><div class="cmb"></div>'; root.appendChild(this.el);
  }
  update(dt: number) {
    const on = this.g.fighting(); this.el.style.display = on ? 'flex' : 'none'; if (!on) return; this.acc += dt; if (this.acc < 0.08) return; this.acc = 0;
    const w = this.g.world, av = w.avatar, f = w.fighters.get(av.id)!; const foe = Fight.targetOf(w, av);
    const me = this.el.querySelector('.me')!; (me.querySelector('b') as HTMLElement).textContent = `${av.first === 'Vous' ? 'Vous' : av.first}`; (me.querySelector('.hp i') as HTMLElement).style.width = `${Math.max(0, av.hp)}%`; (me.querySelector('.st i') as HTMLElement).style.width = `${f.stamina}%`;
    const en = this.el.querySelector('.en') as HTMLElement; en.style.visibility = foe ? 'visible' : 'hidden'; if (foe) { (en.querySelector('b') as HTMLElement).textContent = foe.first; (en.querySelector('.hp i') as HTMLElement).style.width = `${Math.max(0, foe.hp)}%`; }
    const cmb = this.el.querySelector('.cmb') as HTMLElement; if (f.comboT > 0 && f.step >= 2) { cmb.style.display = 'block'; cmb.textContent = `COMBO ×${f.step}`; } else cmb.style.display = 'none';
    en.classList.add('en');
  }
}
