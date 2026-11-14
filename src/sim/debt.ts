/** Scénario émergent de Noria Beach : la dette de Tommy Blake envers Victor Kane (détective corrompu qui « récupère » pour un réseau).
 *  Ce n'est PAS une suite de fenêtres écrites : c'est un état du monde (somme due, échéance, étape, issue) que la simulation fait évoluer et que le joueur peut infléchir
 *  par la parole, l'argent, la menace, la bagarre, la police, un pouvoir divin ou en incarnant Tommy. Tout est mémorisé, sauvegardé et relie relations, souvenirs et réputation. */
import type { SimChar } from './simchar';
import { dist, type World } from './world';
import * as Fight from './fight';
import * as Quests from './quests';
import * as Crime from './crime';
import { MIN_PER_SEC } from './defs';

export type Stage = 'brewing' | 'threat' | 'resolved';
export interface Debt {
  stage: Stage; amount: number; due: number; threatAt: number; outcome: string; told: boolean; metVictor: boolean; helped: boolean; reported: boolean; reportAt: number;
  extended: number; vendetta: boolean; revengeAt: number; escalated: boolean; lastLine: number; log: string[]; offerAt: number;
}
export const AMOUNT = 5000;
export const blank = (w: World): Debt => ({ stage: 'brewing', amount: AMOUNT, due: (Math.floor(w.clock / 1440) + 1) * 1440 + 19.5 * 60, threatAt: 0, outcome: '', told: false, metVictor: false, helped: false, reported: false, reportAt: 0, extended: 0, vendetta: false, revengeAt: 0, escalated: false, lastLine: 0, log: [], offerAt: 0 });
export const tommy = (w: World) => w.chars.find((c) => c.name === 'Tommy Blake');
export const victor = (w: World) => w.chars.find((c) => c.name === 'Victor Kane');
export const elena = (w: World) => w.chars.find((c) => c.name === 'Elena Reyes');
export const active = (w: World) => w.debt.stage !== 'resolved';
export const isVictor = (c: SimChar) => c.name === 'Victor Kane';
export const isTommy = (c: SimChar) => c.name === 'Tommy Blake';
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const note = (w: World, s: string) => { w.debt.log.push(s); if (w.debt.log.length > 20) w.debt.log.shift(); w.emitLog(s, 'drama'); };
const say = (w: World, c: SimChar | undefined, text: string, secs = 5) => { if (!c) return; c.say = { text, until: w.clock + secs * MIN_PER_SEC }; };

// ------------------------------------------------------------------ réputation (plusieurs dimensions)
export const repBlank = () => ({ social: 0, romantic: 0, criminal: 0, pro: 0, police: 0 });
export type RepKey = 'social' | 'romantic' | 'criminal' | 'pro' | 'police';
export function rep(w: World, k: RepKey, d: number) { w.rep[k] = clamp((w.rep[k] ?? 0) + d, -100, 100); }

/** Règle de corruption : un signalement visant Kane peut « se perdre » (la police est parfois complice). */
export function shields(w: World, perp: SimChar): boolean {
  if (!isVictor(perp) || !active(w)) return false; const el = elena(w); const knowsHim = !!el && el.memories.some((m) => m.subj === perp.id && m.kind === 'suspicion');
  const shield = !knowsHim && w.rng.randf() < 0.6; if (shield) note(w, 'Un signalement contre Victor Kane se perd dans les dossiers du commissariat.'); return shield;
}

// ------------------------------------------------------------------ issues
function resolve(w: World, outcome: string, text: string) {
  const d = w.debt; d.stage = 'resolved'; d.outcome = outcome; note(w, text); const t = tommy(w), v = victor(w);
  if (t && v) { v.decision_cooldown = 0; w.fighters.has(v.id) && Fight.end(w, v); }
  Quests.emit(w, 'debt_resolved'); w.stats.debt_resolved = 1;
}
/** Remboursement (par Tommy, par le joueur, par miracle) : Victor est payé, le scénario se termine. */
export function pay(w: World, payer: SimChar, amount?: number): { ok: boolean; line: string } {
  const d = w.debt; const t = tommy(w), v = victor(w); if (!t || !v || d.stage === 'resolved') return { ok: false, line: 'Il n\'y a plus de dette.' };
  const sum = Math.min(amount ?? d.amount, d.amount); if (payer.money < sum) return { ok: false, line: `Il vous manque ${Math.round(sum - payer.money)} €.` };
  payer.money -= sum; v.money += sum; d.amount -= sum; const byPlayer = payer.kind === 'avatar' && !isTommy(payer);
  if (d.amount > 0) { d.due += 1440; note(w, `${payer.kind === 'avatar' ? 'Vous versez' : payer.first + ' verse'} ${Math.round(sum)} € à Victor Kane. Il reste ${Math.round(d.amount)} €.`); Quests.emit(w, 'debt_paid_part'); return { ok: true, line: `Kane compte les billets : « Il en reste ${Math.round(d.amount)}. Jeudi. »` }; }
  if (byPlayer) { rep(w, 'social', 6); const r = w.getRel(t.id, payer.id); r.aff = clamp(r.aff + 25, -100, 100); r.trust = clamp(r.trust + 25, 0, 100); t.addMemory(w.clock, 'help', `${payer.kind === 'avatar' ? "L'étranger" : payer.first} a payé ma dette à Victor Kane.`, 1, 1, payer.id, { src: 'lived', conf: 1, subj: payer.id }); }
  const rv = w.getRel(v.id, payer.id); rv.aff = clamp(rv.aff + 6, -100, 100);
  v.addMemory(w.clock, 'money', `La dette de Tommy Blake est soldée.`, 0.3, 0.6, t.id, { src: 'lived', conf: 1, subj: t.id });
  resolve(w, byPlayer ? 'paid_by_player' : isTommy(payer) ? 'paid_by_tommy' : 'paid', byPlayer ? `Vous soldez la dette de Tommy : Victor Kane empoche ${AMOUNT} € et s'en va.` : 'La dette de Tommy est soldée : Victor Kane le laisse tranquille.'); say(w, v, 'Un plaisir de faire affaire.', 5); say(w, t, 'Je… merci. Vraiment.', 5);
  return { ok: true, line: 'Kane range l\'argent : « Un plaisir de faire affaire. Tommy est libre. »' };
}
/** Négociation : un délai supplémentaire selon l'ascendant du joueur (relation, personnalité, réputation criminelle). */
export function negotiate(w: World, who: SimChar): { ok: boolean; line: string } {
  const d = w.debt; const v = victor(w), t = tommy(w); if (!v || !t || d.stage === 'resolved') return { ok: false, line: 'Rien à négocier.' };
  const r = w.getRel(v.id, who.id); const score = 0.25 + r.aff / 250 + r.fear / 300 + (w.rep.criminal > 10 ? 0.15 : 0) + who.trait('extraversion') * 0.15 + (who.money > 1500 ? 0.1 : 0) - (d.extended >= 2 ? 0.35 : 0);
  if (w.rng.randf() < clamp(score, 0.08, 0.8)) { d.extended++; d.due += 1440 * 2; d.stage = 'brewing'; d.escalated = false; w.fighters.has(v.id) && Fight.end(w, v); v.plan = []; note(w, `${who.kind === 'avatar' ? 'Vous obtenez' : who.first + ' obtient'} un délai de Victor Kane : deux jours de plus.`); Quests.emit(w, 'debt_delay'); say(w, v, 'Deux jours. Pas un de plus.', 5); return { ok: true, line: 'Kane soupire : « Deux jours. Pas un de plus. »' }; }
  r.aff = clamp(r.aff - 4, -100, 100); return { ok: false, line: 'Kane sourit sans chaleur : « Non. Je ne négocie pas. »' };
}
/** Tommy (ou le joueur) se rend à la police : Elena enquête… ou le dossier est étouffé. */
export function report(w: World, by: SimChar) {
  const d = w.debt; if (d.reported || d.stage === 'resolved') return; d.reported = true; d.reportAt = w.clock + 40; note(w, `${by.kind === 'avatar' ? 'Vous' : by.first} signale ${by.kind === 'avatar' ? 'le chantage de' : ''} Victor Kane au commissariat.`);
  const el = elena(w), t = tommy(w); if (t && el) { t.plan = [{ type: 'goto', cell: { x: Crime.STATION_DOOR.x, y: Crime.STATION_DOOR.y } } as any]; w.startNextStep(t); }
}
function resolveReport(w: World) {
  const d = w.debt; const v = victor(w), el = elena(w), t = tommy(w); if (!v || !el || !t) return; d.reportAt = 0;
  const shield = w.rng.randf() < 0.45; if (shield) { note(w, "Le signalement est classé sans suite. Victor Kane en est informé."); d.due = Math.min(d.due, w.clock + 120); d.escalated = false; v.addMemory(w.clock, 'threat', 'Tommy a parlé aux flics.', -0.7, 0.9, t.id, { src: 'told', conf: 0.9, subj: t.id }); rep(w, 'police', -2); return; }
  note(w, 'La capitaine Reyes ouvre une enquête sur Victor Kane.'); el.addMemory(w.clock, 'suspicion', 'Victor Kane utilise son badge pour faire pression sur des débiteurs.', -0.6, 0.9, v.id, { src: 'told', conf: 0.8, subj: v.id }); rep(w, 'police', 3);
  v.away = true; v.jobPhase = 'out'; v.jobUntil = w.clock + 1440 * 2; w.abortPlan(v, 'enquete'); w.fighters.has(v.id) && Fight.end(w, v); resolve(w, 'police', 'Victor Kane est suspendu le temps de l\'enquête : la dette de Tommy tombe d\'elle-même.');
}
/** Révélation divine/dialogue : le joueur apprend qui est Victor Kane. */
export function learnVictor(w: World, av: SimChar) { const v = victor(w); if (!v) return; if (!w.knownSecrets.includes(v.id)) w.knownSecrets.push(v.id); w.debt.metVictor = true; Quests.emit(w, 'debt_told'); w.stats.learn_victor = 1; void av; }

/** Proposition illégale de Victor au club : un colis à remettre au barman, 300 €, « sans questions ». Réponse du joueur dans la fenêtre de temps suivante. */
export function offerJob(w: World) { w.debt.offerAt = w.clock; }
export const offerOpen = (w: World) => w.debt.offerAt > 0 && w.clock - w.debt.offerAt < 180;
export function acceptJob(w: World, av: SimChar): { ok: boolean; line: string } {
  const bm = w.barman; if (!bm || w.job) return { ok: false, line: 'Pas maintenant : vous avez déjà une course en cours.' };
  av.inventory.parcel = 1; w.job = { to: bm.id, pay: 300, t0: w.clock, illegal: true }; w.debt.offerAt = 0; rep(w, 'criminal', 2); Quests.emit(w, 'job_illegal');
  return { ok: true, line: "Kane glisse un paquet scellé dans votre main : « Au barman du Zinc. Discret. Si la police s'en mêle, vous ne me connaissez pas. »" };
}
// ------------------------------------------------------------------ simulation
let acc = new WeakMap<World, number>();
export function tick(w: World, dt: number) {
  const a = (acc.get(w) ?? 0) + dt; if (a < 0.5) { acc.set(w, a); return; } acc.set(w, 0);
  const d = w.debt; const t = tommy(w), v = victor(w); if (!d || !t || !v || d.stage === 'resolved') return;
  const hour = w.hour(); const present = (c: SimChar) => !c.away && c.state !== 'ko' && c.state !== 'enter' && c.state !== 'exit';
  if (v.state === 'ko' && !d.vendetta && !w.fighters.has(v.id)) { afterFight(w); return; }
  if (d.reportAt > 0 && w.clock >= d.reportAt) resolveReport(w);
  if (w.debt.stage === 'resolved') return;
  // miracle ou économies : Tommy rembourse tout seul s'il en a les moyens
  if (t.money >= d.amount) { pay(w, t); return; }
  if (d.stage === 'brewing') {
    if (d.vendetta && w.clock >= d.revengeAt && present(v) && w.avatar && !w.avatar.away && w.avatar.kind === 'avatar' && !w.fighters.has(v.id)) { d.vendetta = false; note(w, 'Victor Kane revient pour régler ses comptes avec vous.'); Fight.start(w, v, w.avatar, 'Victor Kane vous cherche.'); return; }
    if (w.clock >= d.due && hour >= 17.5 && hour < 24 && present(t) && present(v) && !w.fighters.has(t.id) && !w.fighters.has(v.id)) {
      d.stage = 'threat'; d.threatAt = w.clock; d.escalated = false; d.lastLine = -1; w.abortPlan(v, 'dette'); v.decision_cooldown = 99; v.plan = [];
      note(w, 'Victor Kane cherche Tommy Blake : l\'échéance est passée.'); if (dist(w.avatar.pos, t.pos) < 30) { w.questToasts.push('Victor Kane s\'approche de Tommy…'); Quests.emit(w, 'debt_threat'); }
    }
    return;
  }
  // étape « menace »
  if (!present(v) || !present(t)) { if (!present(t) && t.state === 'ko') afterFight(w); return; }
  const el = w.clock - d.threatAt; const dd = dist(v.pos, t.pos);
  if (w.fighters.has(v.id) || w.fighters.has(t.id)) { return; }
  if (dd > 2.0) { // Victor rejoint Tommy
    const cell = w.nearestFreeCell({ x: Math.floor(t.pos.x), y: Math.floor(t.pos.y) }, 2); if (v.state === 'idle' && cell.x >= 0) { v.plan = [{ type: 'goto', cell } as any]; w.startNextStep(v); v.decision_cooldown = 99; } d.threatAt = Math.max(d.threatAt, w.clock - 0.5 * 0 ); return;
  }
  if (d.escalated) { afterFight(w); return; }
  v.facing = w.dirFrom({ x: t.pos.x - v.pos.x, y: t.pos.y - v.pos.y }, v.facing); t.facing = w.dirFrom({ x: v.pos.x - t.pos.x, y: v.pos.y - t.pos.y }, t.facing); v.decision_cooldown = 99; t.decision_cooldown = 99;
  const ph = d.lastLine; const e0 = w.clock - d.threatAt;
  if (ph < 0) { d.lastLine = 0; d.threatAt = w.clock; say(w, v, `Tommy. ${AMOUNT} €. Ce soir.`, 6); w.showEmote(t, 'sweat', 4); t.addMemory(w.clock, 'threat', 'Victor Kane me réclame 5 000 €. Il a l\'air sérieux.', -0.8, 1, v.id, { src: 'lived', conf: 1, subj: v.id }); note(w, 'Victor Kane réclame 5 000 € à Tommy. « Ce soir. »'); }
  else if (ph === 0 && e0 > 8) { d.lastLine = 1; say(w, t, 'Je… j\'ai pas tout. Donne-moi du temps !', 5); }
  else if (ph === 1 && e0 > 14) { d.lastLine = 2; say(w, v, 'Le temps, c\'est ce que tu n\'as plus.', 5); w.showEmote(v, 'anger', 4); }
  else if (ph === 2 && e0 > 22) { d.lastLine = 3; d.escalated = true; Fight.start(w, v, t, 'Victor Kane perd patience : il s\'en prend à Tommy.'); }
  void el;
}
/** Après la bagarre : issue selon qui est à terre ou a fui. */
function afterFight(w: World) {
  const d = w.debt; const t = tommy(w)!, v = victor(w)!; if (w.fighters.has(t.id) || w.fighters.has(v.id)) return;
  if (t.state === 'ko' || t.hp < 25) { const taken = Math.min(t.money, d.amount); t.money -= taken; v.money += taken; d.amount -= taken; d.due = w.clock + 1440 * 2; d.stage = 'brewing'; d.escalated = false; note(w, `Victor Kane fouille Tommy : ${Math.round(taken)} € de moins, et la dette continue (${Math.round(d.amount)} €).`); v.decision_cooldown = 1; rep(w, 'criminal', 0); w.stats.debt_beaten = 1; Quests.emit(w, 'debt_beaten'); return; }
  if (v.state === 'ko' || v.hp < 20) { d.vendetta = true; d.revengeAt = w.clock + 1440; d.stage = 'brewing'; d.due = w.clock + 1440 * 3; d.escalated = false; note(w, 'Victor Kane est à terre. Il n\'oubliera pas ça.'); w.getRel(v.id, w.avatar.id).aff = -60; w.stats.debt_vic_ko = 1; Quests.emit(w, 'debt_resolved'); return; }
  d.stage = 'brewing'; d.escalated = false; d.due = w.clock + 600; note(w, 'La bagarre s\'est éteinte sans vainqueur : Victor Kane reviendra.');
}
