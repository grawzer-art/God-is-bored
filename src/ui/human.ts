/** Interface du mode humain : dialogues, carte du bar, cadeaux, inventaire, menu contextuel, bandeau d'état, invite d'interaction. */
import * as Home from '../sim/home';
import type { GameScene } from '../view/scene';
import * as I from '../sim/interact';
import { EMOTIONS, NEEDS, NEED_LABEL } from '../sim/defs';
import type { SimChar } from '../sim/simchar';
import { buildingAt } from '../sim/layout';

const esc = (s: string) => s.replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' } as Record<string, string>)[ch]);
export const HUMAN_CSS = `
#ui.human #god,#ui.human #powers,#ui.human #portraits,#ui.human #charp{display:none!important}
#ui:not(.human) #hhud,#ui:not(.human) #prompt{display:none!important}
#hhud{left:50%;bottom:16px;transform:translateX(-50%);display:flex;flex-direction:column;gap:8px;align-items:center;padding:8px 14px;max-width:calc(100vw - 24px)}
#hhud .m{font-size:18px;font-weight:600;color:#fccd5c;white-space:nowrap} #hhud .nb{display:flex;flex-direction:column;gap:3px;min-width:62px;font-size:10px;color:#98a2b8} #hhud .nb .bar{height:5px}
#hhud>div:first-child{min-width:104px} #hhud .items{display:flex;gap:5px;flex-wrap:wrap;justify-content:center}
#prompt{pointer-events:none;position:absolute;transform:translate(-50%,-100%);background:rgba(12,14,22,.92);border:1px solid rgba(252,205,92,.6);border-radius:8px;padding:4px 9px;font-size:12px;white-space:nowrap;display:none}
#prompt kbd{background:#fccd5c;color:#10131c;border-radius:4px;padding:0 5px;margin-right:5px;font-weight:700}
#dlg{left:50%;bottom:16px;transform:translateX(-50%);width:640px;max-width:calc(100vw - 24px);display:none;z-index:5}
#dlg .head{display:flex;gap:12px;align-items:flex-start} #dlg img.pp{width:66px;height:78px;image-rendering:pixelated;object-fit:contain}
#dlg .txt{white-space:pre-line;line-height:1.5;min-height:46px;margin:6px 0 8px;font-size:14px}
#dlg .choices{display:grid;grid-template-columns:1fr 1fr;gap:6px} #dlg .choices .btn{text-align:left} #dlg .hint{color:#98a2b8;font-size:11px;margin-left:6px}
#dlg .menu .btn{display:flex;justify-content:space-between;width:100%;margin-bottom:5px}
#inv{left:50%;top:50%;transform:translate(-50%,-50%);width:420px;max-width:calc(100vw - 24px);display:none;max-height:80vh;overflow:auto;z-index:4}
#ctx{left:50%;top:40%;transform:translate(-50%,-50%);min-width:260px;display:none;z-index:4} #ctx .btn{display:block;width:100%;text-align:left;margin:4px 0}
#flash{position:fixed;inset:0;pointer-events:none;opacity:0;z-index:20;background:radial-gradient(circle,rgba(255,236,170,.95),rgba(255,214,110,.55) 45%,rgba(255,214,110,0) 75%);transition:opacity .45s ease-out}
.drunk{filter:none}
`;
export class HumanUi {
  sig = ''; building = ''; open: SimChar | null = null; barMode = ''; prevSpeed = 1; last = ''; ctxItems: I.Interactable[] = []; hudAcc = 0;
  el!: { hhud: HTMLElement; prompt: HTMLElement; dlg: HTMLElement; inv: HTMLElement; ctx: HTMLElement; flash: HTMLElement };
  constructor(public g: GameScene, public root: HTMLElement) {
    const add = (id: string, cls: string, extra = '') => { const d = document.createElement('div'); d.id = id; d.className = cls; if (extra) d.setAttribute('style', extra); root.appendChild(d); return d; };
    this.el = { hhud: add('hhud', 'panel'), prompt: add('prompt', ''), dlg: add('dlg', 'panel'), inv: add('inv', 'panel'), ctx: add('ctx', 'panel'), flash: add('flash', '') };
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (this.open) this.close(); else { this.hideInv(); this.hideContext(); } } });
  }
  get w() { return this.g.world; }
  // ---- dialogue
  dialogueOpen() { return this.open !== null; }
  openDialogue(npc: SimChar) {
    if (this.open) return; this.open = npc; this.barMode = ''; this.prevSpeed = this.g.speedIndex; this.g.setSpeed(0); this.hideContext(); this.hideInv();
    const av = this.w.avatar; npc.facing = this.w.dirFrom({ x: av.pos.x - npc.pos.x, y: av.pos.y - npc.pos.y }, npc.facing);
    const d = I.dialogueOpen(this.w, npc); this.last = `${npc.first} : « ${d.line} »`; this.render(); this.el.dlg.style.display = 'block';
  }
  close() { if (!this.open) return; this.open = null; this.el.dlg.style.display = 'none'; this.g.setSpeed(this.prevSpeed || 1); }
  private choices: { id: string; arg?: string; enabled: boolean }[] = [];
  render() {
    const npc = this.open!; const w = this.w; const cv = this.g.chars[npc.id]; const rl = npc.kind === 'resident' ? I.relationLabelToPlayer(w, npc) : npc.job;
    let body = '';
    this.choices = [];
    if (this.barMode === 'bar') {
      body = `<div class="menu">${Object.entries(I.DRINKS).map(([id, d]) => this.opt(id, `${d.label}`, `${d.price} €`, w.avatar.money >= d.price)).join('')}${Object.entries(I.BAR_FOOD).map(([id, d]) => this.opt(id, d.label, `${d.price} €`, w.avatar.money >= d.price)).join('')}${this.opt('back', 'Retour', '', true)}</div>`;
    } else if (this.barMode === 'gift') {
      const items = Object.entries(w.avatar.inventory).filter(([, n]) => n > 0);
      body = `<div class="menu">${items.map(([id, n]) => this.opt('give_item:' + id, I.ITEMS[id]?.label ?? id, `×${n}`, true)).join('') || '<span class="dim">Vous n\'avez rien à offrir.</span>'}${this.opt('back', 'Retour', '', true)}</div>`;
    } else {
      const d = I.dialogueOpen(w, npc);
      const all = [...d.choices]; all.splice(Math.max(0, all.length - 1), 0, { id: 'sheet', label: 'Consulter sa fiche', hint: 'profil, relations, souvenirs', enabled: true } as any);
      body = `<div class="choices">${all.map((c) => this.opt(c.id, c.label, c.hint ?? '', c.enabled)).join('')}</div>`;
    }
    this.el.dlg.innerHTML = `<div class="head"><img class="pp" src="${cv.assets.portrait.toDataURL()}"><div style="flex:1"><div class="row" style="justify-content:space-between"><b style="font-size:17px;color:#fff">${esc(npc.name)}</b><span class="dim small">${esc(rl)} · ${EMOTIONS[npc.emotion] ?? ''}${npc.drunk > 15 ? ' · éméché' : ''}</span></div>
      <div class="txt">${esc(this.last)}</div></div></div>${body}<div class="small dim" style="margin-top:6px">Touches 1–9 : choisir · Échap : partir · Le monde est en pause pendant la conversation</div>`;
    this.el.dlg.querySelectorAll<HTMLButtonElement>('button[data-i]').forEach((b) => (b.onclick = () => this.pickDialogue(Number(b.dataset.i))));
  }
  private opt(id: string, label: string, hint: string, enabled: boolean) { const i = this.choices.length; this.choices.push({ id, enabled }); return `<button class="btn" data-i="${i}" ${enabled ? '' : 'disabled'}><span><span class="dim small">${i + 1}</span> ${esc(label)}</span><span class="hint">${esc(hint)}</span></button>`; }
  pickDialogue(i: number) {
    const npc = this.open; const c = this.choices[i]; if (!npc || !c || !c.enabled) return; const w = this.w;
    if (this.barMode) {
      if (c.id === 'back') { this.barMode = ''; this.render(); return; }
      if (this.barMode === 'bar') { const r = I.orderDrink(w, c.id); this.last = `${npc.first} : « ${r.ok ? 'Et voilà.' : 'Désolé.'} »\n${r.msg}`; }
      else { const id = c.id.split(':')[1]; const r = I.choose(w, npc, 'give_item', id); this.last = r.line; this.barMode = ''; }
      this.render(); return;
    }
    if (c.id === 'sheet') { this.close(); this.g.hud.fiche.open(npc.id); return; }
    const r = I.choose(w, npc, c.id); this.last = r.line;
    if (r.close) { this.close(); return; }
    if (r.openBar) this.barMode = 'bar'; else if (r.openGift) this.barMode = 'gift';
    this.render();
  }
  // ---- menu contextuel
  contextOpen() { return this.el.ctx.style.display === 'block'; }
  showContext(list: I.Interactable[]) { this.ctxItems = list.slice(0, 7); this.el.ctx.innerHTML = '<div class="small dim" style="margin-bottom:4px">Que faire ?</div>' + this.ctxItems.map((it, i) => `<button class="btn" data-c="${i}"><span class="dim small">${i + 1}</span> ${esc(it.label)}</button>`).join(''); this.el.ctx.querySelectorAll<HTMLButtonElement>('button').forEach((b) => (b.onclick = () => this.pickContext(Number(b.dataset.c)))); this.el.ctx.style.display = 'block'; }
  hideContext() { this.el.ctx.style.display = 'none'; }
  pickContext(i: number) { const it = this.ctxItems[i]; if (it) this.g.doInteract(it); }
  // ---- inventaire
  toggleInventory() { this.el.inv.style.display === 'block' ? this.hideInv() : this.showInv(); }
  hideInv() { this.el.inv.style.display = 'none'; }
  showInv() {
    const av = this.w.avatar; const items = Object.entries(av.inventory).filter(([, n]) => n > 0); const sec = this.w.knownSecrets.map((id) => this.w.chars[id]);
    this.el.inv.innerHTML = `<div class="row" style="justify-content:space-between"><b style="font-size:17px;color:#fff">Inventaire</b><span class="gold" style="font-size:17px">${av.money} €</span></div>
      <div style="margin-top:8px">${items.map(([id, n]) => `<div class="row" style="justify-content:space-between;margin:4px 0"><span>${I.ITEMS[id]?.label ?? id} ×${n}<br><span class="dim small">${I.ITEMS[id]?.desc ?? ''}</span></span><button class="btn" data-u="${id}">Utiliser</button></div>`).join('') || '<span class="dim">Vos poches sont vides.</span>'}</div>
      <div class="gold small" style="margin-top:10px">SECRETS APPRIS</div><div class="small">${sec.length ? sec.map((c) => `<div><b>${esc(c.first)}</b> : ${esc(c.secret)}</div>`).join('') : '<span class="dim">Aucun. Gagnez la confiance de quelqu\'un.</span>'}</div>
      ${buildingAt(av.cell().x, av.cell().y)?.name === 'flats1' || Home.inApartment(av.cell().x, av.cell().y) ? `<div class="gold small" style="margin-top:10px">AMÉNAGER MON APPARTEMENT</div><div class="small dim">Touchez un meuble : Déplacer / Ranger. Puis touchez la case voulue.</div>${Object.entries(this.w.stash).filter(([, n]) => n > 0).map(([d, n]) => `<div class="row" style="justify-content:space-between;margin:4px 0"><span>${Home.label(d)} ×${n}</span><button class="btn" data-pl="${d}">Poser</button></div>`).join('')}<div class="dim small" style="margin-top:4px">Catalogue (livraison immédiate)</div>${Home.CATALOG.map((c) => `<div class="row" style="justify-content:space-between;margin:3px 0"><span>${c.label} · ${c.price} €</span><button class="btn" data-by="${c.def}" ${av.money < c.price ? 'disabled' : ''}>Acheter</button></div>`).join('')}` : ''}
      ${av.stats.debt ? `<div class="small" style="margin-top:8px;color:#ff9a9a">Dettes : ${av.stats.debt} €</div>` : ''}<div class="small dim" style="margin-top:10px">I ou Échap : fermer</div>`;
    this.el.inv.querySelectorAll<HTMLButtonElement>('button[data-u]').forEach((b) => (b.onclick = () => { this.g.hud.toast(I.useItem(this.w, b.dataset.u!)); this.showInv(); }));
    this.el.inv.querySelectorAll<HTMLButtonElement>('button[data-by]').forEach((b) => (b.onclick = () => { this.g.hud.toast(Home.buy(this.w, b.dataset.by!).msg); this.showInv(); }));
    this.el.inv.querySelectorAll<HTMLButtonElement>('button[data-pl]').forEach((b) => (b.onclick = () => { this.w.homeEdit = { mode: 'place', def: b.dataset.pl! }; this.hideInv(); this.g.hud.toast(`Touchez la case où poser : ${Home.label(b.dataset.pl!)} (Échap : annuler)`); }));
    this.el.inv.style.display = 'block';
  }
  // ---- bandeau d'état + invite
  update(dt: number) {
    if (this.g.mode !== 'human') { this.el.prompt.style.display = 'none'; return; }
    const w = this.w; const av = w.avatar; const cv = this.g.chars[av.id];
    const b = buildingAt(av.cell().x, av.cell().y)?.name ?? ''; if (b !== this.building) { this.building = b; if (b === 'bar') this.g.hud.toast(`Le Cinquième Ciel — ${w.barOpen() ? 'ouvert, il y a de la musique' : 'fermé pour le moment'}`); else if (b === 'house') this.g.hud.toast('La maison des colocataires'); }
    const list = this.open || av.state !== 'idle' ? [] : I.nearby(w, av); const p = this.el.prompt;
    if (list.length) { const s = this.g.worldToScreen(cv.x, cv.y - 56); p.style.left = s.x + 'px'; p.style.top = s.y + 'px'; p.innerHTML = `<kbd>${this.g.hud.mobile?.active ? 'A' : 'E'}</kbd>${esc(list[0].label)}${list.length > 1 ? ` <span class="dim">(+${list.length - 1})</span>` : ''}`; p.style.display = 'block'; } else p.style.display = 'none';
    this.hudAcc += dt; if (this.hudAcc < 0.25) return; this.hudAcc = 0;
    const bar = (v: number, col: string) => `<div class="bar"><i style="width:${v}%;background:${col}"></i></div>`; const col = (v: number) => (v > 60 ? '#73cc8c' : v > 30 ? '#f2c761' : '#eb6161');
    const items = Object.entries(av.inventory).filter(([, n]) => n > 0);
    // structure stable : seuls les textes/barres sont mis à jour, les boutons ne sont recréés que si l'inventaire change (clics fiables)
    const sig = JSON.stringify(items);
    if (this.sig !== sig || !this.el.hhud.firstElementChild) {
      this.sig = sig; this.el.hhud.innerHTML = `<div id="hstat" style="display:flex;gap:14px;align-items:center"></div><div class="items">${items.map(([id, n]) => `<button class="btn" data-use="${id}" title="${I.ITEMS[id]?.desc ?? ''}">${I.ITEMS[id]?.label ?? id} ×${n}</button>`).join('')}<button class="btn" id="invb">Inventaire (I)</button></div>`;
      this.el.hhud.querySelectorAll<HTMLButtonElement>('button[data-use]').forEach((b) => (b.onclick = () => this.g.hud.toast(I.useItem(this.w, b.dataset.use!))));
      (this.el.hhud.querySelector('#invb') as HTMLElement).onclick = () => this.toggleInventory();
    }
    (this.el.hhud.querySelector('#hstat') as HTMLElement).style.display = 'none'; (this.el.hhud.querySelector('#hstat') as HTMLElement).innerHTML = `<div><div class="m">${av.money} €</div><div class="small dim">${esc(w.clockLabel())}</div><div class="small dim">${esc(roomName(w, av))}</div></div>
      ${NEEDS.map((n) => `<div class="nb"><span>${NEED_LABEL[n]}</span>${bar(av.needs[n], col(av.needs[n]))}</div>`).join('')}
      ${av.drunk > 2 ? `<div class="nb"><span>Ivresse</span>${bar(av.drunk, '#d66bff')}</div>` : ''}`;
  }
  flash(kind: 'descend' | 'ascend') { const f = this.el.flash; f.style.background = kind === 'descend' ? '' : 'radial-gradient(circle,rgba(190,210,255,.9),rgba(120,150,255,.45) 45%,rgba(120,150,255,0) 75%)'; f.style.transition = 'none'; f.style.opacity = '0.95'; void f.offsetWidth; f.style.transition = 'opacity .6s ease-out'; f.style.opacity = '0'; }
}
function roomName(w: any, c: SimChar) { const r = w.roomOf(c.pos); return ({ B: 'Dans le bar', R: 'Toilettes du bar', s: 'Sur le trottoir', r: 'Sur la route', g: 'Dehors', a: 'Chambre 1', b: 'Chambre 2', c: 'Chambre 3', d: 'Chambre 4', h: 'Couloir de la maison', k: 'Cuisine', l: 'Salon', w: 'Salle de bains', u: 'Buanderie' } as Record<string, string>)[r] ?? ''; }
