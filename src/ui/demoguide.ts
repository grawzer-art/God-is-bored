/** Guide de la démo vivante : trois lignes (A, B, C) lisant l'état réel des habitants, plus la relation modifiée. Toucher une ligne = suivre cet habitant. */
import type { GameScene } from '../view/scene';
import { brief } from '../sim/observe';
import { TRIO, TRIO_ROLE } from '../sim/demo';

const CSS = `
#dg{position:absolute;pointer-events:auto;z-index:6;display:none;left:16px;top:132px;width:300px;background:rgba(12,14,22,.84);border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:6px 8px;font-size:11px;line-height:1.3;color:#e6e9f2;touch-action:manipulation}
#ui.mobile #dg{left:calc(var(--sl) + 8px);top:calc(var(--st) + 58px);width:min(184px,26vw);font-size:10px;padding:3px 5px;border-radius:10px}
#dg h5{margin:0 0 2px;font-size:9px;letter-spacing:.08em;color:#fccd5c;text-transform:uppercase;display:flex;justify-content:space-between;cursor:pointer}
#dg .r{padding:2px 3px;border-radius:6px;margin:1px 0;cursor:pointer;min-height:18px} #dg .r.on{background:rgba(250,205,92,.18)}
#dg .l1{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#dg b.k{display:inline-block;width:13px;height:13px;line-height:13px;text-align:center;border-radius:50%;background:#fccd5c;color:#10131c;margin-right:3px;font-size:9px}
#dg .s{color:#98a2b8} #dg .n{color:#fccd5c} #dg .d{color:#98a2b8;font-size:9.5px;white-space:normal;margin:1px 0 0 16px}
#dg .rel{margin-top:2px;padding-top:2px;border-top:1px solid rgba(255,255,255,.1);font-size:9.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
`;
export class DemoGuide {
  el: HTMLElement; private acc = 0; private open = true; private rel0: { aff: number; trust: number } | null = null; private ids = [TRIO.A, TRIO.B, TRIO.C];
  constructor(private g: GameScene, root: HTMLElement) {
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    this.el = document.createElement('div'); this.el.id = 'dg'; root.appendChild(this.el);
    this.el.addEventListener('click', (e) => { if ((e.target as HTMLElement).closest('#dgh')) { this.open = !this.open; this.acc = 1; return; } const r = (e.target as HTMLElement).closest<HTMLElement>('[data-id]'); if (!r) return; const id = Number(r.dataset.id); g.selectChar(id, true); g.follow = true; g.hud.toast(`Caméra : suit ${g.world.chars[id].first}`); this.acc = 1; });
  }
  /** Mémorise l'état initial de la relation observée (Camille → son interlocuteur) au lancement de la démo. */
  reset() { const w = this.g.world; const r = w.getRel(TRIO.C, TRIO.partner); this.rel0 = { aff: r.aff, trust: r.trust }; this.acc = 1; }
  update(dt: number) {
    if (this.g.demoKind !== 'trio') { this.el.style.display = 'none'; return; }
    this.acc += dt; if (this.acc < 0.4) return; this.acc = 0; this.el.style.display = 'block'; if (!this.rel0) this.reset();
    const w = this.g.world; const L = ['A', 'B', 'C'];
    const rows = this.ids.map((id, i) => { const c = w.chars[id]; const b = brief(w, c); const sel = this.g.selectedId === id;
      return `<div class="r${sel ? ' on' : ''}" data-id="${id}"><div class="l1"><b class="k">${L[i]}</b><b>${c.first}</b> <span class="s">${b.activity === 'Se déplace' ? '→ ' + b.dest : b.activity}</span></div>${sel ? `<div class="d">${TRIO_ROLE[id]}<br>${b.dest}<br>${b.need} ${Math.round(b.needValue)} %</div>` : ''}</div>`; }).join('');
    const p = w.chars[TRIO.partner], c = w.chars[TRIO.C]; const r = w.getRel(c.id, p.id); const d = this.rel0 ? r.aff - this.rel0.aff : 0; const m = c.memories.filter((x) => x.other === p.id).slice(-1)[0];
    this.el.innerHTML = `<h5 id="dgh"><span>Démo vivante ${this.open ? '▾' : '▸'}</span><span>${w.clockLabel().replace('Jour 1 · ', '')}</span></h5>${this.open ? rows + `<div class="rel" title="${m ? m.text : ''}"><b>${c.first}→${p.first}</b> ${Math.round(r.aff)} <span style="color:${d > 0.4 ? '#7fd99a' : d < -0.4 ? '#ff8a8a' : '#98a2b8'}">(${d >= 0 ? '+' : ''}${d.toFixed(1)})</span> ${m ? '· ' + m.text : '· aucun échange'}</div>` : ''}`;
  }
}
