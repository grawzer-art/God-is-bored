/** Journal de quêtes (sections, suivi, historique), suivi d'objectif discret dans le HUD, et narrations (bienvenue, fin de chapitre). Lit l'état réel de `w.quests`. */
import type { GameScene } from '../view/scene';
import * as Q from '../sim/quests';
import { installTheme } from './theme';
import * as Sfx from '../start/sfx';
import * as Nav from './nav';

const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
const CSS = `
#qtrack{position:absolute;z-index:6;pointer-events:auto;display:none;left:calc(var(--sl,0px) + 10px);top:calc(var(--st,0px) + 104px);max-width:min(300px,38vw);padding:6px 10px;border-radius:12px;font-size:12px;line-height:1.35}
#qtrack b{color:var(--gp-gold);display:block;font-size:11px;letter-spacing:.06em;text-transform:uppercase} #qtrack .where{color:var(--gp-dim);font-size:11px}
@media (min-width:900px){#qtrack{top:168px}}
#journal{position:absolute;z-index:40;pointer-events:auto;display:none;flex-direction:column;overflow:hidden;right:calc(var(--sr,0px) + 8px);top:calc(var(--st,0px) + 58px);bottom:calc(var(--sb,0px) + 8px);width:min(440px,54vw)}
#journal .hd{display:flex;align-items:center;gap:6px;padding:8px 10px} #journal .hd b{flex:1;font-size:16px;color:#fff}
#journal .body{flex:1;overflow:auto;padding:6px 12px 12px;font-size:12.5px;line-height:1.45;-webkit-overflow-scrolling:touch}
#journal .gp-tabs button{font-size:10.5px;padding:8px 2px}
#journal .q{margin:8px 0;padding:8px 10px;border:1px solid var(--gp-line-soft);border-radius:12px;background:rgba(255,255,255,.04)} #journal .q h4{margin:0 0 2px;font-size:14px;color:#fff} #journal .q .rw{color:var(--gp-gold);font-size:11px}
#journal .o{display:flex;gap:6px;margin:2px 0} #journal .o i{font-style:normal;width:16px;color:var(--gp-dim)} #journal .o.ok{color:var(--gp-ok)} #journal .o .wh{color:var(--gp-dim);font-size:11px}
#journal .stat{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:6px} #journal .stat div{background:rgba(255,255,255,.05);border-radius:10px;padding:6px;text-align:center;font-size:11px;color:var(--gp-dim)} #journal .stat b{display:block;font-size:15px;color:var(--gp-gold)}
#narr{position:fixed;inset:0;z-index:90;display:none;align-items:center;justify-content:center;background:rgba(5,4,14,.92);color:#fff;text-align:center;padding:20px}
#narr .c{max-width:560px} #narr h2{margin:0 0 14px;color:var(--gp-gold);letter-spacing:.14em;font-size:22px} #narr p{margin:8px 0;font-size:16px;line-height:1.5;opacity:0;transform:translateY(8px);transition:opacity .6s,transform .6s} #narr p.on{opacity:1;transform:none} #narr .gp-btn{margin-top:18px;min-width:220px;min-height:46px;font-size:15px;letter-spacing:.08em;opacity:0;transition:opacity .5s} #narr .gp-btn.on{opacity:1}
.reduce-motion #narr p,.reduce-motion #narr .gp-btn{opacity:1;transform:none}
`;
type Sec = 'principale' | 'secondaire' | 'activite' | 'divin' | 'terminees';
const SECS: [Sec, string][] = [['principale', 'Principale'], ['secondaire', 'Secondaires'], ['activite', 'Activités'], ['divin', 'Défis divins'], ['terminees', 'Terminées']];
export class JournalUi {
  private el: HTMLElement; private tr: HTMLElement; private narr: HTMLElement; private sec: Sec = 'principale'; private acc = 0; private sig = ''; private shown = false; private narrOpen = false;
  constructor(private g: GameScene, root: HTMLElement) {
    installTheme(); const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    this.el = document.createElement('div'); this.el.id = 'journal'; this.el.className = 'gp'; root.appendChild(this.el);
    this.tr = document.createElement('div'); this.tr.id = 'qtrack'; this.tr.className = 'gp'; this.tr.onclick = () => this.open(); root.appendChild(this.tr);
    this.narr = document.createElement('div'); this.narr.id = 'narr'; document.body.appendChild(this.narr);
  }
  isOpen() { return this.shown; }
  open(sec?: Sec) { if (sec) this.sec = sec; this.shown = true; this.sig = ''; this.el.style.display = 'flex'; this.g.hud.root.classList.add('fiche-open'); this.el.classList.remove('anim-in'); void this.el.offsetWidth; this.el.classList.add('anim-in'); Nav.open({ id: 'journal', close: () => this.close() }); this.render(); }
  close() { this.shown = false; this.el.style.display = 'none'; this.g.hud.root.classList.remove('fiche-open'); Nav.closed('journal'); }
  toggle() { this.shown ? this.close() : this.open(); }
  private card(w: any, id: string, s: Q.QState, d: Q.QuestDef, finished: boolean) {
    const objs = d.objectives.map((o, i) => { const ok = s.p[i] >= (o.n ?? 1); return `<div class="o ${ok ? 'ok' : ''}"><i>${ok ? '✔' : '○'}</i><span>${esc(o.text)}${(o.n ?? 1) > 1 ? ` (${Math.min(s.p[i], o.n!)}/${o.n})` : ''}${!ok && o.where ? `<br><span class="wh">${esc(o.where)}</span>` : ''}</span></div>`; }).join('');
    const r = d.reward; const rw = [r.money ? `+${r.money} €` : '', r.rep ? `réputation ${r.rep > 0 ? '+' : ''}${r.rep}` : '', r.text ?? ''].filter(Boolean).join(' · ');
    return `<div class="q"><h4>${esc(d.title)}</h4><div class="dim small">${esc(d.desc)}</div>${d.mode === 'any' ? '<div class="small" style="color:var(--gp-gold)">Une seule voie suffit :</div>' : ''}${objs}${rw ? `<div class="rw">Récompense : ${esc(rw)}</div>` : ''}${finished ? '' : `<button class="gp-btn" style="margin-top:6px;min-height:32px;padding:4px 10px;font-size:12px" data-tr="${id}">${s.tracked ? 'Masquer le suivi' : 'Suivre'}</button>`}</div>`;
  }
  private render() {
    const w = this.g.world; const P = w.progress; let body = '';
    if (this.sec === 'terminees') { const dn = Q.completed(w); body = dn.length ? dn.map((x) => this.card(w, x.id, x.s, x.d, true)).join('') : '<div class="dim">Aucune quête terminée pour l\'instant.</div>'; }
    else { const list = Q.active(w, this.sec); body = list.length ? list.map((x) => this.card(w, x.id, x.s, x.d, false)).join('') : `<div class="dim">${this.sec === 'principale' && P.chapters.length >= 5 ? 'Chapitre 1 terminé. La suite de l\'histoire arrive : en attendant, explorez NORIA, décorez votre studio ou lancez-vous des défis divins.' : this.sec === 'divin' && !Q.unlocked(w, 'divine_challenges') ? 'Terminez le chapitre 1 pour débloquer les défis divins.' : this.sec === 'secondaire' ? 'Rien pour l\'instant : les demandes naissent de la vie du quartier.' : 'Rien en cours.'}</div>`; }
    const stats = `<div class="stat"><div><b>${Math.round(w.avatar.money)} €</b>Argent</div><div><b>${P.reputation}</b>Réputation</div><div><b>${P.chapters.length}/5</b>Missions du chapitre 1</div><div><b>${w.property ? 1 : 0}</b>Propriété</div><div><b>${P.activities}</b>Activités</div><div><b>${P.discoveries.length}</b>Lieux découverts</div></div>`;
    this.el.innerHTML = `<div class="hd"><b>Journal</b><button class="gp-btn" data-x="close" aria-label="Fermer">✕</button></div><div class="gp-tabs">${SECS.map(([k, l]) => `<button data-s="${k}" class="${k === this.sec ? 'on' : ''}">${l}</button>`).join('')}</div><div class="body">${stats}${body}</div>`;
    this.el.querySelectorAll<HTMLElement>('[data-s]').forEach((b) => (b.onclick = () => { this.sec = b.dataset.s as Sec; this.sig = ''; this.render(); }));
    this.el.querySelector('[data-x]')!.addEventListener('click', () => Nav.closeTop());
    this.el.querySelectorAll<HTMLElement>('[data-tr]').forEach((b) => (b.onclick = () => { const s = w.quests[b.dataset.tr!]; Q.track(w, b.dataset.tr!, !s.tracked); this.sig = ''; this.render(); }));
  }
  /** Narration plein écran (une à la fois). */
  private showNarr() {
    const w = this.g.world; const n = w.narrations[0]; if (!n) return; this.narrOpen = true; this.narr.style.display = 'flex'; Sfx.quest();
    this.narr.innerHTML = `<div class="c"><h2>${esc(n.title)}</h2>${n.lines.map((l) => `<p>${esc(l)}</p>`).join('')}<button class="gp-btn gold">${esc(n.button)}</button></div>`;
    const ps = [...this.narr.querySelectorAll('p')]; const btn = this.narr.querySelector('button')!; ps.forEach((p, i) => setTimeout(() => p.classList.add('on'), 400 + i * 900)); setTimeout(() => btn.classList.add('on'), 400 + ps.length * 900);
    const go = () => { Sfx.confirm(); w.narrations.shift(); this.narr.style.display = 'none'; this.narrOpen = false; }; btn.addEventListener('click', go); this.narr.addEventListener('dblclick', () => { ps.forEach((p) => p.classList.add('on')); btn.classList.add('on'); });
  }
  update(dt: number) {
    const w = this.g.world; if (!w.quests) return; this.acc += dt; if (this.acc < 0.3) return; this.acc = 0;
    const startUp = !!this.g.start && document.getElementById('start')?.style.display !== 'none' && document.getElementById('start')?.style.display !== ''; const busy = startUp || !!document.getElementById('creator');
    if (!busy && !this.narrOpen && w.narrations.length) this.showNarr();
    while (w.questToasts.length) { this.g.hud.toast(w.questToasts.shift()!); Sfx.quest(); }
    // suivi d'objectif discret (une seule ligne, uniquement en mode humain, jamais pendant une fenêtre)
    const human = this.g.mode === 'human'; const tracked = Q.active(w).find((x) => x.s.tracked); const cur = tracked ? Q.current(w, tracked.id) : null;
    const show = human && !!cur && !this.shown && !this.g.hud.fiche.isOpen() && !w.decoMode && !busy; this.tr.style.display = show ? 'block' : 'none';
    if (show && cur) { const h = `<b>${esc(tracked!.d.title)}</b>${esc(cur.text)}${cur.of > 1 ? ` (${cur.n}/${cur.of})` : ''}${cur.where ? `<div class="where">${esc(cur.where)}</div>` : ''}`; if (h !== this.sig) { this.sig = h; this.tr.innerHTML = h; } }
    if (this.shown) { const s = JSON.stringify([w.quests, w.progress.reputation, w.avatar.money]); if (s !== this.sig2) { this.sig2 = s; this.render(); } }
  }
  private sig2 = '';
}
