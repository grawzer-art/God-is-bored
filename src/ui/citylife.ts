/** Interface de la ville : niveau de recherche (étoiles), articles non payés, garde à vue, bandeau d'arrestation. Lit l'état réel du monde. */
import type { GameScene } from '../view/scene';
import * as Shop from '../sim/shop';

const CSS = `
#wanted{position:absolute;right:calc(var(--sr,0px) + 12px);top:calc(var(--st,0px) + 60px);display:none;pointer-events:none;background:rgba(40,12,16,.86);border:1px solid rgba(255,90,90,.6);border-radius:10px;padding:4px 9px;font-size:12px;color:#ffd0d0;z-index:7}
#wanted b{color:#ff6a6a;letter-spacing:.12em;font-size:15px}
#unpaid{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(var(--sb,0px) + 64px);display:none;pointer-events:none;background:rgba(40,30,8,.9);border:1px solid rgba(252,205,92,.7);border-radius:10px;padding:4px 10px;font-size:12px;color:#ffe9a8;z-index:7;white-space:nowrap}
#possbadge{position:absolute;pointer-events:auto;left:50%;transform:translateX(-50%);top:calc(var(--st,0px) + 8px);display:none;z-index:9;background:rgba(30,18,50,.92);border:1px solid rgba(180,140,255,.8);border-radius:999px;padding:5px 6px 5px 14px;font-size:12px;color:#e6d9ff;align-items:center;gap:8px}
#possbadge button{background:rgba(252,205,92,.18);border:1px solid rgba(252,205,92,.7);color:#fccd5c;border-radius:999px;padding:6px 12px;font-size:12px;min-height:30px}
#jail{position:absolute;inset:0;display:none;pointer-events:none;background:repeating-linear-gradient(90deg,rgba(0,0,0,.55) 0 18px,rgba(0,0,0,.18) 18px 24px);z-index:8;color:#fff;text-align:center}
#jail .t{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:rgba(10,12,20,.88);border:1px solid rgba(255,255,255,.25);border-radius:14px;padding:12px 18px;font-size:14px;line-height:1.5}
#jail b{color:#fccd5c;font-size:16px}
#arrestbanner{position:absolute;left:50%;top:30%;transform:translateX(-50%);display:none;pointer-events:none;z-index:9;background:rgba(20,26,60,.94);border:2px solid #5d7be0;border-radius:12px;padding:10px 20px;font-size:18px;font-weight:700;color:#fff;letter-spacing:.06em;text-align:center}
`;
export class CityHud {
  private acc = 0; private wanted: HTMLElement; private unpaid: HTMLElement; private jail: HTMLElement; private banner: HTMLElement; private poss: HTMLElement; private bt = 0;
  constructor(private g: GameScene, root: HTMLElement) {
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    const mk = (id: string) => { const d = document.createElement('div'); d.id = id; root.appendChild(d); return d; };
    this.wanted = mk('wanted'); this.unpaid = mk('unpaid'); this.jail = mk('jail'); this.banner = mk('arrestbanner'); this.poss = mk('possbadge'); this.poss.innerHTML = '<span id="possname"></span><button id="possquit">Quitter ce corps</button>'; this.poss.querySelector('button')!.onclick = () => this.g.ascend(true);
  }
  show(text: string, secs = 3.2) { this.banner.innerHTML = text; this.banner.style.display = 'block'; this.bt = secs; }
  update(dt: number) {
    if (this.bt > 0) { this.bt -= dt; if (this.bt <= 0) this.banner.style.display = 'none'; }
    this.acc += dt; if (this.acc < 0.25) return; this.acc = 0; const w = this.g.world; const av = w.avatar; const human = this.g.mode === 'human';
    if (human && w.possess) { this.poss.style.display = 'flex'; this.poss.querySelector('#possname')!.textContent = `INCARNÉ : ${av.first}`; } else this.poss.style.display = 'none';
    const lvl = w.wanted.level; const chased = w.police.some((o) => o.task?.kind === 'pursue' && o.task.target === av.id);
    if (human && lvl > 0 && !w.jail) { this.wanted.style.display = 'block'; this.wanted.innerHTML = `<b>${'★'.repeat(lvl)}${'☆'.repeat(3 - lvl)}</b> Recherché(e)${chased ? ' · <b style="font-size:12px">POLICE EN POURSUITE</b>' : ''}`; } else this.wanted.style.display = 'none';
    const owed = Shop.owed(av); if (human && owed > 0 && !w.jail) { this.unpaid.style.display = 'block'; this.unpaid.textContent = `Articles non payés : ${owed} € — passez à la caisse (ou partez sans payer…)`; } else this.unpaid.style.display = 'none';
    if (w.jail) { const left = Math.max(0, Math.ceil(w.jail.until - w.clock)); this.jail.style.display = 'block'; this.jail.innerHTML = `<div class="t"><b>GARDE À VUE</b><br>Libération dans ${left} min de jeu<br><span style="color:#98a2b8;font-size:12px">Casier : ${w.record_.arrests} arrestation(s) · amendes ${w.record_.fines} €</span></div>`; } else this.jail.style.display = 'none';
  }
}
