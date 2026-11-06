/** Moteur de quêtes réutilisable. Les quêtes sont des DONNÉES (sérialisables) ; la progression écoute de vrais événements du moteur (`emit`) ; les récompenses agissent sur l'état du monde.
 *  Aucune quête ne bloque l'exploration ni les modes de jeu : elles guident et enrichissent. */
import type { World } from './world';

export type Cat = 'principale' | 'secondaire' | 'activite' | 'divin';
export interface ObjDef { id: string; text: string; ev: string; arg?: string | number; n?: number; where?: string }
export interface Reward { money?: number; rep?: number; unlock?: string[]; text?: string }
export interface QuestDef { id: string; title: string; desc: string; cat: Cat; chapter?: number; requires?: string[]; mode?: 'all' | 'ordered' | 'any'; objectives: ObjDef[]; reward: Reward; epilogue?: string[] }
export interface QState { st: 'active' | 'done'; p: number[]; tracked: boolean; t0: number; t1: number; def?: QuestDef; path?: string }
export interface Progress { reputation: number; chapters: string[]; discoveries: string[]; activities: number; unlocks: string[]; flags: Record<string, number | string> }
export interface Narration { title: string; lines: string[]; button: string }

const lastBMap = new WeakMap<World, string | null>();
const O = (id: string, text: string, ev: string, arg?: string | number, n = 1, where?: string): ObjDef => ({ id, text, ev, arg, n, where });
export const DEFS: QuestDef[] = [
  { id: 'c1m1', title: 'Bienvenue chez toi', desc: 'Prends possession de ton Studio Noria : un meuble, une couleur, et tu sauvegardes.', cat: 'principale', chapter: 1, mode: 'ordered',
    objectives: [O('in', "Être dans l'appartement", 'enter', 'flats1', 1, 'Studio Noria'), O('place', 'Placer un meuble', 'furn_placed', undefined, 1, 'Studio Noria · bouton Décorer'), O('style', 'Changer un mur ou un sol', 'style_changed', undefined, 1, 'Décorer › Sol & murs'), O('save', 'Sauvegarder', 'saved', undefined, 1, 'Menu › Sauvegarder')],
    reward: { money: 120, rep: 2, unlock: ['catalog2'], text: 'Nouveaux meubles au catalogue' } },
  { id: 'c1m2', title: 'Premier contact', desc: 'Sors dans la rue et fais connaissance avec un habitant.', cat: 'principale', chapter: 1, requires: ['c1m1'], mode: 'all',
    objectives: [O('out', 'Sortir dans la rue', 'outdoor', undefined, 1, 'Dehors'), O('talk', 'Parler à un habitant', 'talk', 'person', 1, 'Dans la rue'), O('sheet', 'Consulter sa fiche', 'sheet', undefined, 1, 'Dialogue › Consulter sa fiche'), O('choice', 'Faire un choix de dialogue', 'choice', undefined, 1, 'Dialogue')],
    reward: { money: 80, rep: 3, unlock: ['contact_first'], text: 'Une première relation est enregistrée' } },
  { id: 'c1m3', title: "L'argent ne tombe pas du ciel", desc: "Le commerçant de l'épicerie cherche quelqu'un pour une livraison au café.", cat: 'principale', chapter: 1, requires: ['c1m2'], mode: 'ordered',
    objectives: [O('shop', "Aller à l'épicerie", 'enter', 'store', 1, 'Mini-marché'), O('accept', 'Accepter la livraison', 'job_accept', undefined, 1, 'Commerçant › Travail'), O('deliver', 'Remettre le colis', 'job_deliver', undefined, 1, 'Café Culpa'), O('paid', 'Être payé', 'job_paid', undefined, 1)],
    reward: { rep: 3, unlock: ['job_board'], text: 'Livraisons à volonté chez le commerçant' } },
  { id: 'c1m4', title: 'Une ville pleine de possibilités', desc: 'Choisis ta voie : aider, livrer, sortir ou franchir la ligne.', cat: 'principale', chapter: 1, requires: ['c1m3'], mode: 'any',
    objectives: [O('help', 'Aider : offrir un objet à un habitant', 'gift', undefined, 1, 'Dialogue › Offrir'), O('deliv', 'Livrer : refaire une livraison', 'job_paid', undefined, 1, 'Commerçant › Travail'), O('social', 'Sortir : commander un verre au bar', 'drink', undefined, 1, 'Bar Le Zinc'), O('shady', 'Douteux : faire les poches à quelqu\'un', 'steal', undefined, 1, 'Un habitant endormi')],
    reward: { rep: 2, text: 'Ta voie dépend de ton choix' } },
  { id: 'c1m5', title: 'Le Créateur', desc: 'Tu te souviens de ce que tu es.', cat: 'principale', chapter: 1, requires: ['c1m4'], mode: 'ordered',
    objectives: [O('god', 'Passer en mode Dieu', 'god', undefined, 1, 'Redevenir dieu (G)'), O('obs', 'Observer un habitant', 'observe', undefined, 1, 'Toucher un habitant'), O('pow', 'Utiliser un pouvoir', 'power', undefined, 1, 'Pouvoirs'), O('back', 'Revenir dans ton avatar', 'descend', undefined, 1, 'Descendre'), O('see', 'Constater la conséquence', 'sheet', undefined, 1, 'Fiche de l\'habitant')],
    reward: { money: 200, rep: 5, unlock: ['divine_challenges'], text: 'Défis divins débloqués' },
    epilogue: ['Tu pensais commencer une nouvelle vie.', 'Mais tu as oublié une chose.', "C'est toi qui as créé ce monde."] },
  { id: 's1', title: 'Le livreur du front de mer', desc: "Tommy Blake traîne sur la plage le soir. Il a l'air d'avoir besoin d'un coup de main.", cat: 'secondaire', chapter: 1, requires: ['c1m2'], mode: 'ordered',
    objectives: [O('meet', 'Parler à Tommy Blake', 'talk', 'Tommy', 1, 'Noria Beach, le soir (ou Les Mouettes)'), O('gift', 'Lui offrir quelque chose', 'gift', undefined, 1, 'Dialogue › Offrir')],
    reward: { rep: 2, money: 40, text: 'Tommy se souviendra de vous' } },
  { id: 'd1', title: 'Main divine', desc: 'Bénis trois habitants.', cat: 'divin', requires: ['c1m5'], mode: 'all', objectives: [O('b', 'Bénir un habitant', 'power', 'bless', 3, 'Mode Dieu › Pouvoirs')], reward: { rep: 1, money: 50 } },
  { id: 'd2', title: 'Effacer les traces', desc: 'Fais oublier à des témoins ce qu\'ils ont vu.', cat: 'divin', requires: ['c1m5'], mode: 'all', objectives: [O('f', 'Effacer des souvenirs', 'power', 'forget', 1, 'Pouvoirs › Effacer les souvenirs')], reward: { rep: 1, money: 50 } },
  { id: 'd3', title: 'Fortune express', desc: 'Offre une fortune à un habitant et observe ce qu\'il en fait.', cat: 'divin', requires: ['c1m5'], mode: 'all', objectives: [O('g', 'Donner 10 000 € ou plus', 'power', 'rich', 1, 'Fiche › Modifier')], reward: { rep: 1 } },
  { id: 'a1', title: 'Livraisons du quartier', desc: 'Des livraisons payées chez le commerçant, quand tu veux.', cat: 'activite', requires: ['c1m3'], mode: 'all', objectives: [O('j', 'Effectuer une livraison', 'job_paid', undefined, 1, 'Mini-marché')], reward: { money: 10 } },
];
const byId = new Map(DEFS.map((d) => [d.id, d]));
export const defOf = (w: World, id: string): QuestDef | undefined => w.quests[id]?.def ?? byId.get(id);
export const newProgress = (): Progress => ({ reputation: 0, chapters: [], discoveries: [], activities: 0, unlocks: [], flags: {} });

/** Nouvelle partie : toutes les quêtes sont créées, la première est active et suivie. */
export function init(w: World) {
  w.quests = {}; w.progress = newProgress(); w.narrations = [{ title: 'BIENVENUE À NORIA', lines: ['Ta nouvelle vie commence ici.', 'Dans cette ville, tout est possible.', "Fais-toi un nom, gagne de l'argent, rencontre des gens, développe ton influence…", "Et n'oublie pas : tu peux toujours redevenir Dieu."], button: "COMMENCER L'AVENTURE" }];
  lastBMap.set(w, inBuilding(w)); refresh(w); const first = w.quests.c1m1; if (first) { first.tracked = true; progressEv(w, 'enter', inBuilding(w) ?? ''); }
}
import { buildingAt } from './layout';
const inBuilding = (w: World) => { const c = w.avatar.cell(); return bAt(c.x, c.y); };
const bAt = (x: number, y: number) => { const b = buildingAt(x, y); return b ? b.name : null; };
export const done = (w: World, id: string) => w.quests[id]?.st === 'done';
/** Active les quêtes dont les prérequis sont remplis. */
export function refresh(w: World) {
  for (const d of DEFS) { if (w.quests[d.id]) continue; if ((d.requires ?? []).every((r) => done(w, r))) { w.quests[d.id] = { st: 'active', p: d.objectives.map(() => 0), tracked: d.cat === 'principale', t0: w.clock, t1: 0 }; if (d.id !== 'c1m1') toast(w, `Nouvelle quête : ${d.title}`); } }
}
function toast(w: World, text: string) { w.questLog.push({ t: w.clock, text }); if (w.questLog.length > 60) w.questLog.shift(); w.questToasts.push(text); }
const matches = (o: ObjDef, ev: string, arg: string | number | undefined) => o.ev === ev && (o.arg === undefined || o.arg === arg);
/** Un événement du moteur s'est produit : fait avancer les objectifs concernés. */
export function emit(w: World, ev: string, arg?: string | number) { if (!w.quests) return; progressEv(w, ev, arg); }
function progressEv(w: World, ev: string, arg?: string | number) {
  const seen = new Set(Object.entries(w.quests).filter(([, q]) => q.st === 'active').map(([id]) => id));    // une quête qui s'active à cause de cet événement ne le voit pas
  let changed = true; let guard = 0;
  while (changed && guard++ < 6) {
    changed = false;
    for (const [id, st] of Object.entries(w.quests)) {
      if (st.st !== 'active' || !seen.has(id)) continue; const d = defOf(w, id)!; const mode = d.mode ?? 'all';
      for (let i = 0; i < d.objectives.length; i++) {
        const o = d.objectives[i]; if (st.p[i] >= (o.n ?? 1)) continue; if (mode === 'ordered' && i > 0 && st.p[i - 1] < (d.objectives[i - 1].n ?? 1)) break;
        if (matches(o, ev, arg)) { st.p[i]++; if (st.p[i] >= (o.n ?? 1)) { toast(w, `✔ ${o.text}`); if (mode === 'any') st.path = o.id; } if (mode === 'ordered') break; }
      }
      const complete = mode === 'any' ? d.objectives.some((o, i) => st.p[i] >= (o.n ?? 1)) : d.objectives.every((o, i) => st.p[i] >= (o.n ?? 1));
      if (complete) { finish(w, id, st, d); changed = true; }
    }
  }
}
function finish(w: World, id: string, st: QState, d: QuestDef) {
  st.st = 'done'; st.t1 = w.clock; const r = d.reward; const a = w.avatar; const pr = w.progress;
  let money = r.money ?? 0, rep = r.rep ?? 0;
  if (id === 'c1m4') { if (st.path === 'deliv') money += 60; else if (st.path === 'shady') { money += 80; rep -= 5; } else if (st.path === 'help') rep += 3; else if (st.path === 'social') rep += 2; pr.flags.path = st.path ?? ''; }
  a.money += money; pr.reputation += rep; for (const u of r.unlock ?? []) if (!pr.unlocks.includes(u)) pr.unlocks.push(u); if (d.cat === 'activite') pr.activities++;
  if (d.chapter && !pr.chapters.includes(`c${d.chapter}:${id}`)) pr.chapters.push(`c${d.chapter}:${id}`);
  if (id === 'c1m2') { const npcId = Number(pr.flags.lastTalk ?? -1); const npc = w.chars[npcId]; if (npc) { const rl = w.getRel(npc.id, a.id); rl.aff = Math.min(100, rl.aff + 6); rl.fam = Math.min(100, rl.fam + 10); npc.addMemory(w.clock, 'meet', `${a.first} s'est présenté(e) : un nouveau venu dans le quartier.`, 0.4, 0.6, a.id, { src: 'lived', conf: 1, subj: a.id }); pr.flags.firstContact = npc.id; } }
  toast(w, `Quête terminée : ${d.title}${money ? ` · +${money} €` : ''}${rep ? ` · réputation ${rep > 0 ? '+' : ''}${rep}` : ''}`); w.questDone.push(id);
  if (d.epilogue) w.narrations.push({ title: 'CHAPITRE 1 TERMINÉ', lines: d.epilogue, button: 'CONTINUER' });
  refresh(w);
}
export const active = (w: World, cat?: Cat) => Object.entries(w.quests).filter(([, s]) => s.st === 'active').map(([id, s]) => ({ id, s, d: defOf(w, id)! })).filter((x) => !cat || x.d.cat === cat);
export const completed = (w: World) => Object.entries(w.quests).filter(([, s]) => s.st === 'done').map(([id, s]) => ({ id, s, d: defOf(w, id)! })).sort((a, b) => b.s.t1 - a.s.t1);
export const unlocked = (w: World, id: string) => !!w.progress?.unlocks.includes(id);
export function track(w: World, id: string, on: boolean) { const s = w.quests[id]; if (s) s.tracked = on; }
/** Objectif courant d'une quête (texte + progression). */
export function current(w: World, id: string) { const s = w.quests[id]; const d = defOf(w, id); if (!s || !d) return null; const mode = d.mode ?? 'all'; if (mode === 'any') return { text: d.objectives.map((o) => o.text).join(' · '), n: 0, of: 1, where: '' };
  for (let i = 0; i < d.objectives.length; i++) { const o = d.objectives[i]; if (s.p[i] < (o.n ?? 1)) return { text: o.text, n: s.p[i], of: o.n ?? 1, where: o.where ?? '' }; } return null; }
/** À chaque pas : détecte les entrées / sorties de bâtiments de l'avatar et génère des événements émergents. */
export function tick(w: World) {
  if (!w.quests) return; const a = w.avatar; if (a.away) return; const b = bAt(a.cell().x, a.cell().y); const room = w.roomOf(a.pos);
  const outdoors = 'srg'.includes(room); const key = b ?? (outdoors ? '#out' : null);
  const lastB = lastBMap.get(w) ?? null; if (key !== lastB) { lastBMap.set(w, key); if (key === '#out') progressEv(w, 'outdoor'); else if (key) { progressEv(w, 'enter', key); const pr = w.progress; if (!pr.discoveries.includes(key)) { pr.discoveries.push(key); } } }
  emergent(w);
}
const lastEm = new WeakMap<World, number>();
/** Événements émergents : un habitant a faim et n'a pas les moyens → quête secondaire dynamique « apporte-lui à manger » (dépend de l'état réel du monde). */
function emergent(w: World) {
  if (w.clock - (lastEm.get(w) ?? -1e9) < 120 || !done(w, 'c1m2')) return; lastEm.set(w, w.clock); if (Object.values(w.quests).filter((q) => q.st === 'active' && q.def).length >= 2) return;
  const needy = w.residents.find((c) => !c.away && !c.isAsleep() && c.needs.hunger < 22 && c.money < 25 && !w.quests[`h_${c.id}_${Math.floor(w.clock / 1440)}`]); if (!needy) return;
  const id = `h_${needy.id}_${Math.floor(w.clock / 1440)}`; const def: QuestDef = { id, title: `${needy.first} a faim`, desc: `${needy.first} n'a presque plus d'argent et se plaint d'avoir faim. Offre-lui de quoi manger.`, cat: 'secondaire', objectives: [O('feed', `Offrir de la nourriture à ${needy.first}`, 'gift', needy.id, 1, 'Dans le quartier')], reward: { money: 15, rep: 2, text: `${needy.first} s'en souviendra` } };
  w.quests[id] = { st: 'active', p: [0], tracked: false, t0: w.clock, t1: 0, def }; toast(w, `Nouvelle demande : ${def.title}`);
}
