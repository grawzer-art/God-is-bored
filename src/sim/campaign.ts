/** NORIA — LES ROIS DU VIDE : logique des cinq premières missions (déclencheurs, actions jouables, conséquences). Chaque mission s'appuie sur l'état réel du monde (relations, mémoires, dette,
 *  combat, police) et non sur une suite de fenêtres : réussites, échecs et choix influencent relations, réputation et événements ultérieurs. Tout est sauvegardé (`w.camp`). */
import type { SimChar } from './simchar';
import { dist, type World } from './world';
import * as Quests from './quests';
import * as Debt from './debt';
import * as Fight from './fight';
import * as Crime from './crime';
import { MIN_PER_SEC } from './defs';

export interface Dispute { a: number; b: number; stage: 'argue' | 'fight' | 'over'; t0: number; fightAt: number; lines: number; calmed: boolean; by: string }
export interface Case { open: boolean; startAt: number; truth: boolean; lost: boolean; interrogated: boolean; cleaned: boolean; suspect: boolean }
export interface Camp { ambush: { stage: 0 | 1 | 2 | 3; at: number; outcome: string } | null; dispute: Dispute | null; case: Case | null; vip: boolean; tommyTrust: boolean; log: string[] }
export const blank = (): Camp => ({ ambush: null, dispute: null, case: null, vip: false, tommyTrust: false, log: [] });
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const by = (w: World, name: string) => w.chars.find((c) => c.name === name);
export const maya = (w: World) => by(w, 'Maya Torres'), roxanne = (w: World) => by(w, 'Roxanne Bell'), moe = (w: World) => by(w, 'Moe Dalton');
const note = (w: World, s: string) => { w.camp.log.push(s); if (w.camp.log.length > 30) w.camp.log.shift(); w.emitLog(s, 'drama'); };
const say = (w: World, c: SimChar | undefined, text: string, secs = 5) => { if (c) c.say = { text, until: w.clock + secs * MIN_PER_SEC }; };
/** Étape courante d'une mission (index du premier objectif non terminé) ; -1 si inactive. */
export function step(w: World, id: string): number { const st = w.quests?.[id]; if (!st || st.st !== 'active') return -1; const d = Quests.defOf(w, id)!; for (let i = 0; i < d.objectives.length; i++) if (st.p[i] < (d.objectives[i].n ?? 1)) return i; return -1; }
export const active = (w: World, id: string) => !!w.quests?.[id] && w.quests[id].st === 'active';
const present = (c: SimChar | undefined) => !!c && !c.away && c.state !== 'ko';

/** Fait venir un habitant à un endroit et l'y retient (il ne repart pas pendant `minutes`). */
export function summon(w: World, c: SimChar, at: { x: number; y: number }, minutes = 240) {
  w.abortPlan(c, 'campagne'); if (w.fighters.has(c.id)) Fight.end(w, c); c.away = false; c.jobPhase = ''; const cell = w.nearestFreeCell({ x: Math.floor(at.x), y: Math.floor(at.y) }, 4); c.pos = { x: cell.x + 0.5, y: cell.y + 0.5 }; c.state = 'idle'; c.pose = 'stand'; c.holdUntil = w.clock + minutes; c.decision_cooldown = 0.2;
}

// ------------------------------------------------------------------ crochets de mission
Quests.hooks.r1 = {
  start(w) { const t = Debt.tommy(w); if (t) summon(w, t, { x: 19.5, y: 27.5 }, 300); },
  done(w) { const t = Debt.tommy(w); if (!t) return; const r = w.getRel(t.id, w.avatar.id); r.aff = clamp(r.aff + 15, -100, 100); r.trust = clamp(r.trust + 15, 0, 100); w.camp.tommyTrust = true; t.addMemory(w.clock, 'help', "L'étranger m'a apporté à manger sans que je demande. Un type bien.", 0.9, 1, w.avatar.id, { src: 'lived', conf: 1, subj: w.avatar.id }); Debt.rep(w, 'social', 3); },
  fail(w) { const t = Debt.tommy(w); if (t) { const r = w.getRel(t.id, w.avatar.id); r.aff = clamp(r.aff - 8, -100, 100); t.addMemory(w.clock, 'letdown', "L'étranger avait dit qu'il passerait. Rien.", -0.4, 0.6, w.avatar.id, { src: 'lived', conf: 1, subj: w.avatar.id }); } },
};
Quests.hooks.r2 = {
  done(w) { w.debt.due += 1440; note(w, "Maya glisse que Tommy est « tranquille pour cette fois » : sa dette repousse l'échéance d'un jour."); Debt.rep(w, 'pro', 2); },
  fail(w) { w.debt.due = Math.min(w.debt.due, w.clock + 240); if (w.job?.campaign === 'r2') { w.job = null; w.avatar.inventory.parcel = 0; } const t = Debt.tommy(w); if (t) { const r = w.getRel(t.id, w.avatar.id); r.aff = clamp(r.aff - 10, -100, 100); } note(w, "Le colis n'est pas arrivé : l'échéance de Tommy se rapproche."); },
};
Quests.hooks.r3 = {
  start(w) { if (w.debt.stage === 'resolved') { Quests.emit(w, 'debt_threat'); Quests.emit(w, 'debt_resolved'); } else w.debt.due = Math.min(w.debt.due, w.clock + 90); },
  done(w) { const o = w.debt.outcome; if (o === 'paid_by_player') Debt.rep(w, 'social', 4); else if (o === 'police') Debt.rep(w, 'police', 3); else if (w.debt.vendetta) Debt.rep(w, 'criminal', 3); },
  fail(w) { const t = Debt.tommy(w); if (t) { const r = w.getRel(t.id, w.avatar.id); r.aff = clamp(r.aff - 6, -100, 100); } Debt.rep(w, 'social', -2); },
};
Quests.hooks.r4 = {
  done(w) { const r = roxanne(w); if (r) { const rl = w.getRel(r.id, w.avatar.id); rl.aff = clamp(rl.aff + 12, -100, 100); rl.trust = clamp(rl.trust + 10, 0, 100); r.addMemory(w.clock, 'help', "L'étranger a calmé ma salle sans casser mon club.", 0.9, 1, w.avatar.id, { src: 'lived', conf: 1, subj: w.avatar.id }); } w.camp.vip = true; Debt.rep(w, 'social', 3); },
  fail(w) { endDispute(w, 'échec'); const r = roxanne(w); if (r) { const rl = w.getRel(r.id, w.avatar.id); rl.aff = clamp(rl.aff - 8, -100, 100); } },
};
Quests.hooks.r5 = {
  start(w) { w.camp.case = { open: true, startAt: w.clock, truth: false, lost: false, interrogated: false, cleaned: false, suspect: false }; note(w, 'La capitaine Reyes convoque les témoins de la bagarre du Zinc.'); const el = Debt.elena(w); if (el) el.addMemory(w.clock, 'suspicion', 'Une bagarre au Zinc Club : je veux des noms.', -0.3, 0.8, -1); },
  done(w) { w.camp.case = null; Debt.rep(w, 'police', 1); },
  fail(w) { const el = Debt.elena(w); if (w.camp.case) w.camp.case.open = false; if (el) { el.away = false; Crime.arrest(w, el, w.avatar, false); } note(w, 'Les témoignages vous accablent : la capitaine Reyes vous arrête.'); Debt.rep(w, 'police', -4); },
};

// ------------------------------------------------------------------ R2 : embuscade de Victor
/** Victor Kane intercepte le joueur qui porte le colis : il s'approche et ouvre le dialogue (menti, avoué, remis ou bagarre). */
function ambushTick(w: World) {
  const a = w.camp.ambush; if (!a || a.stage >= 3) return; const v = Debt.victor(w); const av = w.avatar;
  if (!active(w, 'r2') || w.job?.campaign !== 'r2' || (av.inventory.parcel ?? 0) <= 0) { if (a.stage < 3) w.camp.ambush = null; return; }
  if (a.stage === 0) { if (w.clock >= a.at && present(v) && !w.fighters.has(v!.id) && w.debt.stage !== 'threat' && !av.away) { a.stage = 1; v!.holdUntil = w.clock + 120; w.abortPlan(v!, 'embuscade'); const cell = w.nearestFreeCell({ x: Math.floor(av.pos.x), y: Math.floor(av.pos.y) }, 3); if (cell.x >= 0) { v!.plan = [{ type: 'goto', cell } as any]; w.startNextStep(v!); } w.questToasts.push('Victor Kane vous a repéré…'); } return; }
  if (a.stage === 1 && v) {
    if (dist(v.pos, av.pos) < 2.1) { a.stage = 2; w.abortPlan(v, 'embuscade'); v.facing = w.dirFrom({ x: av.pos.x - v.pos.x, y: av.pos.y - v.pos.y }, v.facing); w.onAvatarArrive?.(v); }
    else if (v.state === 'idle') { const cell = w.nearestFreeCell({ x: Math.floor(av.pos.x), y: Math.floor(av.pos.y) }, 3); if (cell.x >= 0) { v.plan = [{ type: 'goto', cell } as any]; w.startNextStep(v); } }
  }
}
export const ambushOpen = (w: World, npc: SimChar) => !!w.camp.ambush && w.camp.ambush.stage === 2 && Debt.isVictor(npc);
/** Réponse du joueur à Victor : renvoie la réplique. */
export function ambushChoice(w: World, kind: 'lie' | 'truth' | 'give' | 'fight'): { line: string; close: boolean } {
  const a = w.camp.ambush!; const v = Debt.victor(w)!; const av = w.avatar; a.stage = 3; v.holdUntil = 0; const r = w.getRel(v.id, av.id);
  if (kind === 'lie') {
    const p = clamp(0.35 + av.trait('extraversion') * 0.3 + (w.rep.criminal > 10 ? 0.1 : 0), 0.15, 0.8);
    if (w.rng.randf() < p) { a.outcome = 'lie_ok'; return { line: `${v.first} te scrute, puis hausse les épaules : « Si tu le dis. Passe une bonne soirée. »`, close: true }; }
    a.outcome = 'lie_ko'; const tax = Math.min(av.money, 80); av.money -= tax; v.money += tax; r.aff = clamp(r.aff - 6, -100, 100); return { line: `${v.first} sourit : « Menteur. Disons que ça me coûte 80 € de me déranger pour rien. » Il vous laisse passer.`, close: true };
  }
  if (kind === 'truth') { a.outcome = 'truth'; if (w.job) w.job.pay = Math.round(w.job.pay / 2); Debt.rep(w, 'criminal', 1); return { line: `${v.first} ricane : « Pour Maya ? Intéressant. Je prends ma part : la moitié. » Il vous laisse filer avec le reste.`, close: true }; }
  if (kind === 'give') { a.outcome = 'give'; av.inventory.parcel = 0; w.job = null; const t = Debt.tommy(w); if (t) { const rt = w.getRel(t.id, av.id); rt.aff = clamp(rt.aff - 10, -100, 100); } Quests.emit(w, 'r2_lost'); return { line: `${v.first} prend le colis : « Bon choix. Tommy n'apprendra rien… de ma bouche. » Vous le regardez s'éloigner.`, close: true }; }
  a.outcome = 'fight'; Fight.start(w, v, av, `${v.first} n'aime pas qu'on lui tienne tête.`); return { line: `${v.first} soupire : « Mauvaise réponse. »`, close: true };
}

// ------------------------------------------------------------------ R4 : dispute au club
const patrons = (w: World) => w.chars.filter((c) => (c.kind === 'resident' || c.kind === 'citizen') && c.age >= 18 && !c.away && c.state !== 'ko' && !w.fighters.has(c.id) && !Debt.isTommy(c));
/** Lance une dispute entre deux personnages (au club ou dans la rue) : ils s'accrochent verbalement, puis se battent si personne ne calme le jeu. */
export function startDispute(w: World, a: SimChar, b: SimChar, at: { x: number; y: number }, text: string, delayMin = 25, teleport = true): boolean {
  if (w.camp.dispute && w.camp.dispute.stage !== 'over') return false;
  if (teleport) { for (const [c, dx] of [[a, -0.55], [b, 0.55]] as [SimChar, number][]) summon(w, c, { x: at.x + dx, y: at.y }, delayMin + 60); }
  else for (const [c, o] of [[a, b], [b, a]] as [SimChar, SimChar][]) { w.abortPlan(c, 'dispute'); c.holdUntil = w.clock + delayMin + 60; const cell = w.nearestFreeCell({ x: Math.floor(o.pos.x), y: Math.floor(o.pos.y) }, 2); if (cell.x >= 0 && dist(c.pos, o.pos) > 2) { c.plan = [{ type: 'goto', cell } as any]; w.startNextStep(c); } }
  a.anger = clamp(a.anger + 35, 0, 100); b.anger = clamp(b.anger + 35, 0, 100); w.camp.dispute = { a: a.id, b: b.id, stage: 'argue', t0: w.clock, fightAt: w.clock + delayMin, lines: 0, calmed: false, by: text }; note(w, text); return true;
}
export const disputeActive = (w: World) => !!w.camp.dispute && w.camp.dispute.stage !== 'over';
export const inDispute = (w: World, c: SimChar) => !!w.camp.dispute && w.camp.dispute.stage === 'argue' && (w.camp.dispute.a === c.id || w.camp.dispute.b === c.id);
export function endDispute(w: World, why: string) { const d = w.camp.dispute; if (!d || d.stage === 'over') return; d.stage = 'over'; for (const id of [d.a, d.b]) { const c = w.chars[id]; if (c) c.holdUntil = 0; } if (why !== 'échec') Quests.emit(w, 'dispute_end'); note(w, `La dispute est terminée (${why}).`); }
/** Calmer le jeu : chances selon l'ascendant, la personnalité de l'interlocuteur et sa colère. */
export function calm(w: World, npc: SimChar): { ok: boolean; line: string } {
  const d = w.camp.dispute!; const r = w.getRel(npc.id, w.avatar.id); const p = clamp(0.35 + r.aff / 220 + w.avatar.trait('extraversion') * 0.2 + npc.trait('agreeableness') * 0.25 - npc.anger / 250, 0.1, 0.85);
  if (w.rng.randf() < p) { d.calmed = true; for (const id of [d.a, d.b]) { const c = w.chars[id]; c.anger = Math.max(0, c.anger - 40); } Debt.rep(w, 'social', 2); endDispute(w, 'calmée par la parole'); return { ok: true, line: `${npc.first} expire : « Ouais… ouais, t'as raison. On arrête. »` }; }
  npc.anger = clamp(npc.anger + 15, 0, 100); d.fightAt = Math.min(d.fightAt, w.clock + 4); return { ok: false, line: `${npc.first} se braque : « Toi, mêle-toi de tes affaires ! »` };
}
/** Appeler le videur : Moe sépare les deux fauteurs de troubles (sans ménagement). */
export function callBouncer(w: World): { ok: boolean; line: string } {
  const d = w.camp.dispute; const m = moe(w); if (!d || d.stage === 'over' || !m || m.away) return { ok: false, line: 'Moe n\'est pas là.' }; const target = w.chars[w.rng.randf() < 0.5 ? d.a : d.b];
  summon(w, m, { x: target.pos.x + 1, y: target.pos.y + 1 }, 20); Fight.start(w, m, target, `Moe Dalton intervient : il remet ${target.first} à sa place.`); d.stage = 'fight'; Debt.rep(w, 'pro', 1); return { ok: true, line: 'Vous faites signe à Moe. Il traverse la salle sans un mot.' };
}
function disputeTick(w: World) {
  const d = w.camp.dispute; if (!d || d.stage === 'over') return; const a = w.chars[d.a], b = w.chars[d.b];
  if (d.stage === 'argue') {
    if (d.lines === 0 && w.clock > d.t0 + 1) { d.lines = 1; say(w, a, 'Répète un peu, pour voir !', 5); w.showEmote(a, 'anger', 3); }
    else if (d.lines === 1 && w.clock > d.t0 + 8) { d.lines = 2; say(w, b, "T'as un problème ? Dehors !", 5); w.showEmote(b, 'anger', 3); }
    else if (w.clock >= d.fightAt) { d.stage = 'fight'; Fight.start(w, a, b, `${a.first} et ${b.first} en viennent aux mains.`); }
  } else if (d.stage === 'fight') {
    if (!w.fighters.has(a.id) && !w.fighters.has(b.id) && w.clock > d.fightAt + 0.3) endDispute(w, a.state === 'ko' || b.state === 'ko' ? 'KO' : 'ils se séparent');
  }
}

// ------------------------------------------------------------------ R5 : l'enquête d'Elena
/** Témoins qui se souviennent d'une agression ou d'un délit commis par le joueur. */
export function witnesses(w: World): SimChar[] {
  const av = w.avatar; return w.chars.filter((c) => c.id !== av.id && (c.kind === 'resident' || c.kind === 'citizen' || c.kind === 'staff' || c.kind === 'clerk') && c.memories.some((m) => m.subj === av.id && (m.kind === 'assault' || m.kind === 'crime') && w.clock - m.t < 4320));
}
export const exposure = (w: World) => (w.camp.case?.lost ? 0 : witnesses(w).length);
export function interrogate(w: World, kind: 'lie' | 'deny' | 'truth' | 'silent'): { line: string; close: boolean } {
  const cs = w.camp.case!; const el = Debt.elena(w)!; cs.interrogated = true; const e = exposure(w); const r = w.getRel(el.id, w.avatar.id);
  Quests.emit(w, 'talk', 'Elena');
  if (kind === 'truth') { cs.truth = true; const fine = Math.min(Math.floor(w.avatar.money), 100); w.avatar.money -= fine; w.record_.fines += fine; Debt.rep(w, 'police', 4); r.aff = clamp(r.aff + 12, -100, 100); r.trust = clamp(r.trust + 12, 0, 100); cs.cleaned = true; Quests.emit(w, 'case_clean'); return { line: `${el.first} hoche la tête : « Au moins vous êtes honnête. Amende de ${fine} €, et je classe. Ne recommencez pas. »`, close: true }; }
  if (e === 0) { return { line: `${el.first} feuillette le dossier : « Aucun témoin ne vous cite. Étrange, pour une bagarre pareille. Bonne journée. »`, close: true }; }
  cs.suspect = true; if (kind === 'silent') { r.aff = clamp(r.aff - 3, -100, 100); return { line: `${el.first} : « Vous avez le droit de vous taire. Eux, ils parlent. Revenez avec un meilleur souvenir. »`, close: true }; }
  r.aff = clamp(r.aff - 4, -100, 100); return { line: `${el.first} vous fixe : « ${kind === 'lie' ? "Vous n'étiez pas là… et pourtant" : "Vous n'avez rien vu… et pourtant"}, ${e} personne${e > 1 ? 's' : ''} ${e > 1 ? 'vous mentionnent' : 'vous mentionne'}. Je vous laisse jusqu'à ce soir pour réfléchir. »`, close: true };
}
/** Convaincre un témoin de se taire (gratuit : chances selon relation et peur ; payant : presque sûr). */
export function silence(w: World, npc: SimChar, pay: boolean): { ok: boolean; line: string } {
  const av = w.avatar; const r = w.getRel(npc.id, av.id); if (pay && av.money < 100) return { ok: false, line: 'Il vous manque de l\'argent.' };
  const p = pay ? 0.85 - npc.trait('orderliness') * 0.3 : clamp(0.2 + r.aff / 160 + r.fear / 220 + npc.trait('agreeableness') * 0.15, 0.05, 0.75);
  if (pay) { av.money -= 100; npc.money += 100; }
  if (w.rng.randf() < p) { npc.memories = npc.memories.filter((m) => !(m.subj === av.id && (m.kind === 'assault' || m.kind === 'crime'))); Debt.rep(w, 'criminal', 2); r.aff = clamp(r.aff + (pay ? 1 : 4), -100, 100); return { ok: true, line: `${npc.first} baisse les yeux : « D'accord. Je n'ai rien vu. »` }; }
  r.aff = clamp(r.aff - 6, -100, 100); npc.anger = clamp(npc.anger + 15, 0, 100); npc.addMemory(w.clock, 'threat', `L'étranger a tenté de me faire taire.`, -0.7, 0.8, av.id, { src: 'lived', conf: 1, subj: av.id }); return { ok: false, line: `${npc.first} se braque : « Je dirai ce que j'ai vu. À la police, s'il le faut. »` };
}
/** Payer Victor Kane pour égarer le dossier (le dossier disparaît, mais vous lui devez une faveur). */
export function bribeVictor(w: World): { ok: boolean; line: string } {
  const av = w.avatar; const v = Debt.victor(w)!; if (!w.camp.case?.open) return { ok: false, line: 'Il n\'y a pas de dossier à égarer.' }; if (av.money < 500) return { ok: false, line: 'Il vous manque de l\'argent (500 €).' };
  av.money -= 500; v.money += 500; if (w.rng.randf() < 0.7) { w.camp.case.lost = true; Debt.rep(w, 'criminal', 4); const r = w.getRel(v.id, av.id); r.aff = clamp(r.aff + 8, -100, 100); note(w, 'Le dossier de la bagarre du Zinc disparaît des archives.'); return { ok: true, line: `${v.first} empoche l'enveloppe : « Quel dossier ? Vous me devez une faveur, maintenant. »` }; }
  return { ok: false, line: `${v.first} empoche l'enveloppe : « Elena le garde sous clé. Dommage. Pas de remboursement. »` };
}
function caseTick(w: World) {
  const cs = w.camp.case; if (!cs || !cs.open) return; if (step(w, 'r5') === 1 && exposure(w) === 0 && !cs.cleaned) { cs.cleaned = true; Quests.emit(w, 'case_clean'); note(w, 'Plus aucun témoin ne vous accuse : personne n\'a rien vu.'); }
}

// ------------------------------------------------------------------ boucle
let acc = new WeakMap<World, number>();
export function tick(w: World, dt: number) {
  const a = (acc.get(w) ?? 0) + dt; if (a < 0.5) { acc.set(w, a); return; } acc.set(w, 0); if (!w.camp) return;
  ambushTick(w); disputeTick(w); caseTick(w);
}
