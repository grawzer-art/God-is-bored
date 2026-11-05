/** FICHE D'HABITANT V2 : quatre onglets (Profil, Relations, Souvenirs, Secrets) lus dans l'état réel de la simulation, et actions (INCARNER, INFLUENCER, MODIFIER, RÉVÉLER).
 *  Rien n'est inventé à l'ouverture : seuls les souvenirs et connaissances enregistrés sont affichés. */
import type { GameScene } from '../view/scene';
import type { SimChar } from '../sim/simchar';
import * as God from '../sim/god';
import * as L from '../sim/layout';
import { NEEDS, ROOM_NAMES, EMOTIONS } from '../sim/defs';
import { GOALS } from '../sim/roster';
import { emotionIcon } from '../sim/world';
import { installTheme } from './theme';
import { iconCanvas } from '../art/core';

const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
const NEED_FR: Record<string, string> = { hunger: 'Faim', energy: 'Énergie', bladder: 'Vessie', hygiene: 'Hygiène', social: 'Social', fun: 'Loisirs' };
const col = (v: number) => (v > 66 ? '#7ee0a0' : v > 33 ? '#fccd5c' : '#ff8a8a');
const CSS = `
#fiche{position:absolute;z-index:40;pointer-events:auto;display:none;flex-direction:column;overflow:hidden;right:calc(var(--sr,0px) + 8px);top:calc(var(--st,0px) + 8px);bottom:calc(var(--sb,0px) + 8px);width:min(430px,48vw)}
#fiche .hd{display:flex;gap:10px;padding:10px 10px 6px;align-items:flex-start} #fiche .hd img.p{width:62px;height:74px;image-rendering:pixelated;object-fit:contain;background:rgba(0,0,0,.25);border-radius:10px}
#fiche .hd h3{margin:0;font-size:18px;color:#fff} #fiche .x{margin-left:auto}
#fiche .body{flex:1;overflow:auto;padding:4px 12px 10px;font-size:12.5px;line-height:1.45;-webkit-overflow-scrolling:touch}
#fiche .row{display:flex;gap:8px;align-items:center;margin:4px 0} #fiche .row span.l{width:74px;color:var(--gp-dim)} #fiche .row .gp-bar{flex:1}
#fiche .act{display:flex;flex-wrap:wrap;gap:6px;padding:8px;border-top:1px solid var(--gp-line-soft)} #fiche .act .gp-btn{flex:1;min-width:92px}
#fiche .pick{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}
#fiche .mem{margin:5px 0;padding:6px 8px;border-left:2px solid var(--gp-line);background:rgba(255,255,255,.04);border-radius:0 8px 8px 0}
@media (orientation:portrait){#fiche{left:calc(var(--sl,0px) + 6px);right:calc(var(--sr,0px) + 6px);width:auto;top:12%;bottom:calc(var(--sb,0px) + 6px)}}
`;
type Tab = 'profil' | 'relations' | 'souvenirs' | 'secrets';
export class FicheUi {
  private el: HTMLElement; private id = -1; private tab: Tab = 'profil'; private sub = ''; private acc = 0; private sig = '';
  constructor(private g: GameScene, root: HTMLElement) {
    installTheme(); const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    this.el = document.createElement('div'); this.el.id = 'fiche'; this.el.className = 'gp'; root.appendChild(this.el); this.watchPress();
  }
  /** Pas de redessin pendant un appui : sinon le toucher est perdu quand le contenu est remplacé. */
  private pressed = false;
  private watchPress() { this.el.addEventListener('pointerdown', () => (this.pressed = true)); const up = () => setTimeout(() => (this.pressed = false), 120); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up); }
  isOpen() { return this.id >= 0; }
  open(id: number, tab: Tab = 'profil') { this.id = id; this.tab = tab; this.sub = ''; this.sig = ''; this.render(true); this.el.style.display = 'flex'; this.g.hud.root.classList.add('fiche-open'); }
  close() { this.id = -1; this.el.style.display = 'none'; this.g.hud.root.classList.remove('fiche-open'); }
  update(dt: number) { if (this.id < 0) return; this.acc += dt; if (this.acc < 0.6) return; this.acc = 0; if (this.pressed) return; this.render(false); }
  private home(c: SimChar) { if (c.kind === 'resident') return 'La maison des colocataires'; const b = c.home ? L.buildingAt(Math.floor(c.home.x), Math.floor(c.home.y)) : undefined; return b?.title ?? (c.kind === 'avatar' ? 'Sans domicile fixe' : '—'); }
  private rels(c: SimChar) {
    const w = this.g.world; return w.chars.filter((o) => o.id !== c.id && o.kind !== 'dormant' && (o.kind !== 'avatar' || w.possess)).map((o) => ({ o, r: w.getRel(c.id, o.id) })).filter((x) => x.r.n > 0 || Math.abs(x.r.aff) > 8 || x.r.fam > 25)
      .sort((a, b) => Math.abs(b.r.aff) + b.r.trust * 0.2 - (Math.abs(a.r.aff) + a.r.trust * 0.2));
  }
  private label(r: { aff: number; att: number; trust: number; fear: number; ten: number }) {
    if (r.att > 0.6 && r.aff > 30) return ['Intérêt amoureux', '#ff9ac8']; if (r.aff > 35) return ['Ami(e)', '#7ee0a0']; if (r.aff < -25 || r.ten > 55) return ['Ennemi(e)', '#ff8a8a']; if (r.fear > 40) return ['Craint', '#ffb070']; return ['Connaissance', '#98a2b8'];
  }
  private render(force: boolean) {
    const w = this.g.world; const c = w.chars[this.id]; if (!c) { this.close(); return; } const god = this.g.mode === 'god'; const known = w.knownSecrets.includes(c.id);
    const bar = (v: number, cc: string) => `<div class="gp-bar"><i style="width:${Math.max(0, Math.min(100, v))}%;background:${cc}"></i></div>`; const ico = emotionIcon(c.emotion);
    let body = '';
    if (this.tab === 'profil') {
      const t = c.traits; body = `<div class="gp-sec">Humeur et activité</div><div>${esc(c.action_text || '—')} · ${c.away ? 'hors de la carte' : esc(ROOM_NAMES[w.roomOf(c.pos)] ?? '')}</div>
        <div class="gp-sec">Besoins</div>${NEEDS.map((n) => `<div class="row"><span class="l">${NEED_FR[n] ?? n}</span>${bar(c.needs[n], col(c.needs[n]))}</div>`).join('')}
        <div class="gp-sec">Personnalité</div>${Object.entries(God.TRAITS).map(([k, lab]) => `<div class="row"><span class="l">${lab}</span>${bar((t as any)[k] * 100, '#a78bfa')}</div>`).join('')}
        <div class="gp-sec">Objectif actuel</div><div>${esc(GOALS[c.goal.id]?.text ?? c.goal.id)} — ${Math.round(c.goal.progress)} %${c.goal.done ? ' ✔' : ''}</div>
        <div class="gp-sec">Statut</div><div>Foi ${Math.round(c.faith)} % · Stress ${Math.round(c.stress)} · Moral ${Math.round(c.mood)}${c.stats.debt ? ' · Dette ' + c.stats.debt + ' €' : ''}${w.wantedNpcs[c.id] ? ' · <b style="color:#ff8a8a">recherché(e)</b>' : ''}</div>
        <div class="gp-sec">Biographie</div><div class="dim">${esc(c.bio || '—')}</div>`;
    } else if (this.tab === 'relations') {
      const rs = this.rels(c); body = rs.length ? rs.map(({ o, r }) => { const [lab, cc] = this.label(r); return `<div class="mem" style="border-color:${cc}"><b>${esc(o.kind === 'avatar' ? "L'étranger" : o.first)}</b> <span style="color:${cc}">${lab}</span>
        <div class="row"><span class="l">Affection</span>${bar((r.aff + 100) / 2, r.aff >= 0 ? '#7ee0a0' : '#ff8a8a')}</div><div class="row"><span class="l">Confiance</span>${bar(r.trust, '#6aa8ff')}</div><div class="row"><span class="l">Peur</span>${bar(r.fear, '#ffb070')}</div><div class="row"><span class="l">Tension</span>${bar(r.ten, '#ff8a8a')}</div></div>`; }).join('') : '<div class="dim">Aucune relation marquée pour l\'instant.</div>';
    } else if (this.tab === 'souvenirs') {
      const ms = [...c.memories].sort((a, b) => b.t - a.t); const SRC: Record<string, string> = { lived: 'vécu', told: 'raconté', suspected: 'soupçon' };
      body = ms.length ? ms.map((m) => { const t = Math.floor(m.t) % 1440; return `<div class="mem"><span class="dim">J${Math.floor(m.t / 1440) + 1} ${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}${m.src ? ' · ' + SRC[m.src] : ''}${m.kind === 'miracle' ? ' · miracle' : m.kind === 'crime' ? ' · crime' : ''}</span><br>${esc(m.text)}</div>`; }).join('') : '<div class="dim">Aucun souvenir enregistré.</div>';
    } else {
      if (god || known) body = `<div class="gp-sec">Secret</div><div>${esc(c.secret || '—')}</div>${c.stats.debt ? `<div class="gp-sec">Dettes</div><div>${c.stats.debt} €</div>` : ''}<div class="gp-sec">Ce qu'il sait d'événements</div>${Object.entries(c.known).slice(-6).map(([id, k]) => { const ev = w.events.find((e) => e.id === Number(id)); return ev ? `<div class="mem">${esc(ev.kind)} · ${k.src}${k.culprit >= 0 ? ' · auteur : ' + esc(w.chars[k.culprit].first) : ''}</div>` : ''; }).join('') || '<div class="dim">Rien.</div>'}`;
      else body = '<div class="dim">Ses secrets vous sont cachés. Gagnez sa confiance en lui parlant : il finira peut-être par vous les confier.</div>';
    }
    // actions
    let act = '';
    if (god) {
      const sub = this.sub;
      if (sub === 'modifier') act = `<div class="pick"><button class="gp-btn gold" data-a="give:1000">+1 000 €</button><button class="gp-btn gold" data-a="give:100000">+100 000 €</button><button class="gp-btn" data-a="give:-500">−500 €</button>${Object.entries(God.TRAITS).map(([k, lab]) => `<button class="gp-btn" data-a="trait:${k}:0.15">${lab} +</button><button class="gp-btn" data-a="trait:${k}:-0.15">${lab} −</button>`).join('')}<button class="gp-btn" data-a="sub:">Retour</button></div>`;
      else if (sub === 'reveler') act = `<div class="small dim" style="width:100%">Révéler le secret de ${esc(c.first)} à :</div><div class="pick">${w.residents.filter((o) => o.id !== c.id).map((o) => `<button class="gp-btn" data-a="rev:${o.id}">${esc(o.first)}</button>`).join('')}<button class="gp-btn" data-a="sub:">Retour</button></div>`;
      else if (sub === 'influencer') act = `<div class="pick"><button class="gp-btn gold" data-a="bless">Bénir</button><button class="gp-btn" data-a="fate-me">Le rapprocher de vous</button>${Object.entries(God.WHISPERS).map(([k, lab]) => `<button class="gp-btn" data-a="whisper:${k}">${lab}</button>`).join('')}<button class="gp-btn" data-a="sub:">Retour</button></div>`;
      else act = `<button class="gp-btn gold" data-a="incarner" ${God.canPossess(w, c.id) === '' ? '' : 'disabled'}>INCARNER</button><button class="gp-btn" data-a="sub:influencer">INFLUENCER</button><button class="gp-btn" data-a="sub:modifier">MODIFIER</button><button class="gp-btn" data-a="sub:reveler" ${c.secret ? '' : 'disabled'}>RÉVÉLER</button>`;
    } else act = `<button class="gp-btn" data-a="talk">Parler</button><button class="gp-btn" data-a="follow">Suivre du regard</button>`;
    const sig = `${this.id}|${this.tab}|${this.sub}|${body.length}|${Math.round(c.money)}|${Math.round(c.mood)}|${c.action_text}|${god}|${known}|${body.slice(0, 80)}`; if (!force && sig === this.sig) return; this.sig = sig;
    const scroll = (this.el.querySelector('.body') as HTMLElement | null)?.scrollTop ?? 0;
    this.el.innerHTML = `<div class="hd"><img class="p" src="${this.g.chars[c.id].assets.portrait.toDataURL()}"><div style="flex:1"><h3>${esc(c.name)}</h3><div class="dim small">${c.age} ans · ${esc(c.job)}</div><div class="small">${esc(this.home(c))}</div><div class="small"><b style="color:var(--gp-gold)">${Math.round(c.money).toLocaleString('fr-FR')} €</b> · ${ico ? `<img src="${iconCanvas(ico).toDataURL()}" width="12" height="12" style="image-rendering:pixelated;vertical-align:-1px"> ` : ''}${esc(EMOTIONS[c.emotion] ?? c.emotion)}</div></div><button class="gp-btn x" data-a="close" aria-label="Fermer">✕</button></div>
      <div class="gp-tabs">${(['profil', 'relations', 'souvenirs', 'secrets'] as Tab[]).map((t) => `<button data-t="${t}" class="${t === this.tab ? 'on' : ''}">${t}</button>`).join('')}</div><div class="body">${body}</div><div class="act">${act}</div>`;
    (this.el.querySelector('.body') as HTMLElement).scrollTop = scroll;
    this.el.querySelectorAll<HTMLElement>('[data-t]').forEach((b) => (b.onclick = () => { this.tab = b.dataset.t as Tab; this.render(true); }));
    this.el.querySelectorAll<HTMLElement>('[data-a]').forEach((b) => (b.onclick = () => this.action(b.dataset.a!)));
  }
  private action(a: string) {
    const w = this.g.world; const c = w.chars[this.id]; const hud = this.g.hud; const [k, p, q] = a.split(':');
    switch (k) {
      case 'close': this.close(); return;
      case 'sub': this.sub = p ?? ''; break;
      case 'incarner': this.close(); this.g.incarnate(c.id); return;
      case 'give': God.give(w, c, Number(p)); hud.toast(`${Number(p) > 0 ? '+' : ''}${Number(p).toLocaleString('fr-FR')} € pour ${c.first}`); break;
      case 'trait': God.shiftTrait(w, c, p, Number(q)); hud.toast(`${God.TRAITS[p]} modifiée`); break;
      case 'rev': { const to = w.chars[Number(p)]; hud.toast(God.reveal(w, c, to) || 'Rien à révéler'); this.sub = ''; break; }
      case 'bless': hud.toast(God.bless(w, c) ? `${c.first} est béni(e)` : 'Impossible'); this.sub = ''; break;
      case 'fate-me': hud.toast(God.fate(w, c, w.avatar) ? `${c.first} se tourne vers vous` : 'Impossible (l\'un dort ?)'); this.sub = ''; break;
      case 'whisper': hud.toast(God.whisper(w, c, p) ? `Murmure : ${God.WHISPERS[p]}` : 'Impossible'); this.sub = ''; break;
      case 'talk': this.close(); this.g.world.avatarControlled && Act_talk(this.g, c); return;
      case 'follow': this.g.followSelected?.(); return;
    }
    this.render(true);
  }
}
import * as Act from '../sim/interact';
function Act_talk(g: GameScene, c: SimChar) { if (g.canTalkTo(c.id)) g.hud.openDialogue(c); else { g.hud.toast(`Approchez-vous de ${c.first} pour lui parler.`); Act.walkToNpc(g.world, g.world.avatar, c); } }
