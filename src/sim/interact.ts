/** Interactions du mode humain : dialogues, achats, objets, inventaire. Fonctions pures sur le World : tout est persistant. */
import * as Quests from './quests';
import * as Profile from './profile';
import { ACT, EMOTIONS, NEEDS, type V2 } from './defs';
import { LINES_ARGUE, LINES_BAD, LINES_GREAT, LINES_OK } from './social';
import { roomAt } from './layout';
import type { SimChar } from './simchar';
import { dist, type World } from './world';
import { lineClear, nearestWalkable } from './movement';
import * as Life from './life';
import * as Home from './home';
import * as Shop from './shop';
import * as Crime from './crime';
import * as Combat from './combat';
import * as Romance from './romance';
import * as Fight from './fight';
import * as Debt from './debt';
import * as Garage from './garage';
import * as Camp from './campaign';
import * as Director from './director';

export const ITEMS: Record<string, { label: string; hunger?: number; fun?: number; gift: number; desc: string }> = {
  parcel: { label: 'Colis scellé', gift: 0, desc: 'Un colis à remettre en main propre. Ne l\'ouvrez pas.' },
  sandwich: { label: 'Sandwich', hunger: 35, gift: 2, desc: 'Un sandwich un peu écrasé.' },
  bonbons: { label: 'Bonbons', hunger: 5, fun: 8, gift: 3, desc: 'Un sachet de bonbons acidulés.' },
  briquet: { label: 'Briquet', gift: 0.5, desc: 'Un briquet. Il fonctionne encore.' },
  cle: { label: 'Clé à molette', gift: 0.5, desc: 'Un bon outil : +40 % de paye au garage.' },
  chips: { label: 'Chips', hunger: 14, fun: 4, gift: 1.5, desc: 'Un paquet de chips.' },
};
export const DRINKS: Record<string, { label: string; price: number; drunk: number; fun: number; energy?: number; hunger?: number; social: number }> = {
  eau: { label: 'Eau', price: 1, drunk: 0, fun: 1, social: 0 },
  cafe: { label: 'Café', price: 2, drunk: 0, fun: 3, energy: 14, social: 1 },
  biere: { label: 'Bière', price: 4, drunk: 12, fun: 10, social: 6 },
  cocktail: { label: 'Cocktail maison', price: 8, drunk: 20, fun: 18, social: 8 },
  whisky: { label: 'Whisky', price: 7, drunk: 28, fun: 14, social: 5 },
};
export const BAR_FOOD: Record<string, { label: string; price: number }> = { chips: { label: 'Chips', price: 3 } };

export interface Choice { id: string; label: string; enabled: boolean; hint?: string; arg?: string }
export interface Reply { line: string; close?: boolean; openBar?: boolean; openGift?: boolean }

const feel = (n: SimChar, f: string, m: string) => (n.gender === 'F' ? f : m);
const rel = (w: World, a: number, b: number) => w.getRel(a, b);
const clamp = (v: number, a = -100, b = 100) => Math.max(a, Math.min(b, v));
export const inBar = (w: World, c: SimChar) => w.roomOf(c.pos) === 'B' || w.roomOf(c.pos) === 'R';
export const relationLabelToPlayer = (w: World, npc: SimChar) => {
  const r = rel(w, npc.id, w.avatar.id);
  return r.fam < 15 ? 'Inconnu(e)' : r.aff >= 60 ? 'Ami(e) proche' : r.aff >= 30 ? 'Ami(e)' : r.aff <= -40 ? 'Hostile' : r.aff <= -15 ? 'Méfiant(e)' : 'Connaissance';
};

/** Salutation et options selon l'état réel du personnage et sa relation avec vous. */
export function dialogueOpen(w: World, npc: SimChar): { line: string; choices: Choice[] } {
  if (Camp.ambushOpen(w, npc)) return { line: '« Tu portes quoi, là ? Un colis ? Pour Tommy, peut-être ? »', choices: campChoices(w, w.avatar, npc) };   // embuscade : seules les quatre réponses comptent
  const av = w.avatar; const r = rel(w, npc.id, av.id); const ch: Choice[] = [];
  if (npc.kind === 'staff') {
    const h = npc.away;
    const greet = h ? "Le bar est fermé pour l'instant." : r.fam < 20 ? "Bonsoir. Qu'est-ce que je vous sers ?" : r.aff > 25 ? 'Tiens, un habitué ! La même chose ?' : 'Bonsoir. Je vous écoute.';
    if (w.job && w.job.to === npc.id && av.inventory.parcel > 0) ch.unshift({ id: 'deliver', label: 'Remettre le colis', enabled: true, hint: `+${w.job.pay} €` });
    ch.push({ id: 'order', label: 'Commander', enabled: !h && w.barOpen(), hint: 'carte des boissons' }, { id: 'rumors', label: 'Des nouvelles du quartier ?', enabled: !h },
      { id: 'chat', label: 'Bavarder', enabled: !h }, { id: 'bye', label: 'Au revoir', enabled: true });
    return { line: greet, choices: ch };
  }
  if (npc.kind === 'clerk') {
    const due = Shop.owed(av); const open = !npc.away;
    return { line: due > 0 ? `${npc.first} regarde vos articles : « Ça fait ${due} €. »` : r.fam < 20 ? "Bonjour. Je vous laisse regarder, hein." : 'Tiens, un habitué.', choices: [
      { id: 'pay', label: due > 0 ? `Payer mes articles (${due} €)` : 'Payer', enabled: open && due > 0 && av.money >= due, hint: due > 0 && av.money < due ? 'pas assez d\'argent' : due > 0 ? '' : 'rien à payer' },
      { id: 'holdup', label: 'Menacer : « La caisse ! »', enabled: open && !w.holdup, hint: 'braquage : témoins, police, conséquences' },
      ...(Quests.done(w, 'c1m2') || Quests.unlocked(w, 'job_board') ? [{ id: 'job', label: w.job ? 'Livraison en cours…' : `Travail : livrer un colis (${Math.round(25 * Profile.payMult(w))} €)`, enabled: open && !w.job && !(av.inventory.parcel > 0), hint: w.job ? 'allez au café' : 'petit boulot payé' }] : []),
      { id: 'chat', label: 'Bavarder', enabled: open }, { id: 'bye', label: 'Au revoir', enabled: true }] };
  }
  if (npc.kind === 'police' && Director.checkOpen(w, npc)) return { line: `${npc.first} vous interpelle : « Contrôle de police. Vos papiers, et videz vos poches. »`, choices: [{ id: 'c_obey', label: 'Obtempérer', enabled: true }, { id: 'c_flee', label: 'Fuir', enabled: true, hint: 'poursuite' }] };
  if (npc.kind === 'police') {
    const wanted = w.wanted.level > 0;
    const caseOpen = npc.name === 'Elena Reyes' && !!w.camp.case?.open; return { line: caseOpen ? '« Asseyez-vous. Une bagarre au Zinc Club… vous y étiez ? »' : wanted ? `${npc.first} vous fixe : « Vous êtes recherché(e). Ne bougez plus. »` : `${npc.first} vous salue d'un signe de tête : « Tout va bien ? »`, choices: [...campChoices(w, av, npc), 
      { id: 'surrender', label: 'Se rendre', enabled: wanted, hint: wanted ? 'amende réduite' : 'vous n\'êtes pas recherché(e)' }, { id: 'chat', label: 'Bavarder', enabled: true }, { id: 'bye', label: 'Partir', enabled: true }] };
  }
  if (npc.isAsleep()) return { line: `${npc.first} dort profondément.`, choices: [{ id: 'wake', label: 'Réveiller', enabled: true, hint: 'mauvaise idée' }, { id: 'steal', label: 'Fouiller ses poches', enabled: npc.money >= 5, hint: 'risqué si on vous voit' }, { id: 'bye', label: 'Laisser dormir', enabled: true }] };
  let line = npc.anger > 40 ? 'Pas maintenant. Je suis furieux' + feel(npc, 'se', '') + '.' : r.aff >= 40 ? `Ah, c'est ${av.first === 'Vous' ? 'vous' : av.first} ! ${feel(npc, 'Contente', 'Content')} de vous voir.` : r.fam < 15 ? `Oui ? Je ne crois pas vous connaître…` : r.aff <= -20 ? 'Qu\'est-ce que vous voulez ?' : 'Oui ?';
  if (Debt.isTommy(npc) && Debt.active(w) && !w.debt.told && av.name !== npc.name) line = `« Putain, je dois ${w.debt.amount} balles à un mec. »`;
  if (Debt.isVictor(npc) && Debt.active(w) && w.debt.stage === 'threat') line = `« Ça ne vous regarde pas. Cinq mille, pour ce soir. »`;
  if (Debt.isTommy(npc) && Camp.step(w, 'r2') === 1) line = "« Écoute… j'ai un service à te demander. Un truc discret. »";
  if (Camp.ambushOpen(w, npc)) line = '« Tu portes quoi, là ? Un colis ? Pour Tommy, peut-être ? »';
  if (npc.name === 'Roxanne Bell' && Camp.step(w, 'r4') === 3) line = "« Ah, la nouvelle tête. Tu tombes bien : j'ai un petit problème dans ma salle. »";
  if (npc.name === 'Elena Reyes' && w.camp.case?.open) line = '« Asseyez-vous. Une bagarre au Zinc Club… vous y étiez ? »';
  const dark = w.mess.length >= 6 || npc.anger > 25 || npc.mood < -25 || (w.hour() > 23 || w.hour() < 4);
  ch.push({ id: 'how', label: 'Comment ça va ?', enabled: true }, { id: 'chat', label: 'Bavarder', enabled: true },
    { id: 'joke', label: 'Plaisanter', enabled: true }, { id: 'dark', label: 'Humour noir', enabled: dark, hint: dark ? 'contexte propice' : 'pas le bon moment' },
    { id: 'gift', label: 'Offrir quelque chose', enabled: Object.values(av.inventory).some((n) => n > 0) },
    { id: 'give', label: 'Donner 10 €', enabled: av.money >= 10 }, { id: 'ask_money', label: 'Emprunter 10 €', enabled: true, hint: r.aff >= 30 ? '' : 'peu probable' },
    { id: 'secret', label: 'Poser une question personnelle', enabled: true, hint: r.aff >= 45 && r.fam >= 40 ? '' : 'trop tôt ?' });
  if (inBar(w, npc) && w.barman && !w.barman.away) ch.push({ id: 'drink', label: 'Offrir un verre (4 €)', enabled: av.money >= 4 });
  if (w.job && w.job.to === npc.id && av.inventory.parcel > 0) ch.unshift({ id: 'deliver', label: 'Remettre le colis', enabled: true, hint: `+${w.job.pay} €` });
  ch.push({ id: 'steal', label: 'Faire les poches', enabled: npc.money >= 5, hint: 'très risqué' }, ...romanceChoices(w, av, npc), ...debtChoices(w, av, npc), ...campChoices(w, av, npc), ...garageChoices(w, av, npc), { id: 'punch', label: 'Frapper', enabled: true, hint: 'violence : témoins, police, riposte' }, { id: 'bye', label: 'Partir', enabled: true });
  return { line, choices: ch };
}

function remember(npc: SimChar, w: World, kind: string, text: string, v: number, wt: number) { npc.addMemory(w.clock, kind, text, v, wt, w.avatar.id); }
function bump(w: World, npc: SimChar, d: number, fam = 2, ten = 0) {
  if (d > 0) d *= Profile.affinityMult(w);
  const r = rel(w, npc.id, w.avatar.id); r.aff = clamp(r.aff + d); r.fam = clamp(r.fam + fam, 0, 100); r.ten = clamp(r.ten + ten, 0, 100); r.n++;
  const r2 = rel(w, w.avatar.id, npc.id); r2.aff = clamp(r2.aff + d * 0.6); r2.fam = clamp(r2.fam + fam, 0, 100);
}
const quality = (w: World, npc: SimChar) => {
  const r = rel(w, npc.id, w.avatar.id);
  let q = 0.28 + (0.3 * (r.aff + 100)) / 200 + (0.15 * (npc.mood + 100)) / 200 + 0.14 * npc.trait('agreeableness') + 0.08 * npc.trait('extraversion');
  q -= npc.anger * 0.004 + r.ten * 0.004 + Math.max(0, 30 - npc.needs.energy) * 0.005 + Math.max(0, 30 - npc.needs.hunger) * 0.004;
  if (npc.trait('extraversion') < 0.4 && npc.needs.social > 80) q -= 0.1;
  return q + w.rng.range(-0.15, 0.15);
};
const pickLine = (w: World, pool: string[][], who: 0 | 1) => w.rng.pick(pool)[who];

/** Applique le choix du joueur. Modifie besoins, relations, souvenirs, argent, inventaire. */
/** Destinataire d'une livraison : la serveuse du café si elle est là, sinon un autre citoyen présent. */
export function pickDeliveryTarget(w: World): SimChar | null { const cs = w.citizens.filter((c) => !c.away); return cs.find((c) => c.job.toLowerCase().includes('café')) ?? cs[0] ?? null; }
/** Une conversation s'ouvre avec `npc` : événements de quête (parler à un habitant). */
export function noteTalk(w: World, npc: SimChar) { if (npc.kind === 'resident' || npc.kind === 'citizen') { Quests.emit(w, 'talk', 'person'); w.progress.flags.lastTalk = npc.id; } Quests.emit(w, 'talk', npc.id); Quests.emit(w, 'talk', npc.first); }
/** Choix de la campagne « Les Rois du vide » : proposés selon l'état réel des missions et du monde. */
function campChoices(w: World, av: SimChar, npc: SimChar): Choice[] {
  const out: Choice[] = [];
  if (Camp.ambushOpen(w, npc)) return [{ id: 'a_lie', label: '« Rien d\'intéressant. »', enabled: true }, { id: 'a_truth', label: '« Un colis pour Maya. »', enabled: true, hint: 'il prend la moitié' }, { id: 'a_give', label: 'Lui donner le colis', enabled: true, hint: 'Tommy ne le saura pas… de lui' }, { id: 'a_fight', label: '« Dégage. »', enabled: true, hint: 'bagarre' }];
  if (Debt.isTommy(npc) && Camp.step(w, 'r2') === 1) out.push({ id: 'r2_accept', label: '« D\'accord, je le fais. »', enabled: !w.job, hint: w.job ? 'vous avez déjà une course' : 'colis pour Maya, au Zinc' }, { id: 'r2_refuse', label: '« Pas mon problème. »', enabled: true });
  if (npc.name === 'Roxanne Bell' && Camp.step(w, 'r4') === 3) out.push({ id: 'r4_accept', label: '« Je m\'en occupe. »', enabled: true, hint: 'une dispute couve' });
  if (Camp.inDispute(w, npc)) out.push({ id: 'dp_calm', label: 'Calmer le jeu', enabled: true, hint: 'parole' }, { id: 'dp_moe', label: 'Appeler Moe (videur)', enabled: true });
  if (w.camp.case?.open) {
    if (npc.name === 'Elena Reyes') out.push({ id: 'e_lie', label: '« Je n\'étais pas là. »', enabled: true }, { id: 'e_deny', label: '« J\'y étais, je n\'ai rien vu. »', enabled: true }, { id: 'e_truth', label: '« J\'ai tout vu : c\'est moi. »', enabled: true, hint: 'amende, dossier classé' }, { id: 'e_silent', label: 'Ne rien dire', enabled: true });
    if (Debt.isVictor(npc)) out.push({ id: 'e_bribe', label: 'Payer pour égarer le dossier (500 €)', enabled: av.money >= 500, hint: 'il vous devra… et vous lui devrez' });
    if (Camp.witnesses(w).some((x) => x.id === npc.id)) out.push({ id: 'w_silence', label: 'Le convaincre de se taire', enabled: true, hint: 'risqué' }, { id: 'w_silence_pay', label: 'Payer 100 € pour son silence', enabled: av.money >= 100 });
  }
  return out;
}
/** Léo, le garagiste : travail, outil, nouvelles de Tommy. */
function garageChoices(w: World, av: SimChar, npc: SimChar): Choice[] {
  if (!Garage.isLeo(npc)) return []; const r = rel(w, npc.id, av.id);
  return [{ id: 'g_job', label: 'Tu as du boulot ?', enabled: true }, { id: 'g_tool', label: `Acheter une clé à molette (${Garage.TOOL_PRICE} €)`, enabled: (av.inventory.cle ?? 0) === 0 && av.money >= Garage.TOOL_PRICE, hint: '+40 % de paye' }, { id: 'g_tommy', label: 'Et Tommy ?', enabled: r.fam >= 5 }];
}
/** Choix de la dette de Tommy (scénario émergent) : proposés selon l'état réel du monde et la personne que l'on incarne. */
function debtChoices(w: World, av: SimChar, npc: SimChar): Choice[] {
  if (!Debt.active(w)) return []; const d = w.debt; const out: Choice[] = [];
  if (Debt.isTommy(npc) && !Debt.isTommy(av)) {
    out.push({ id: 'd_ignore', label: "« C'est ton problème. »", enabled: true }, { id: 'd_help', label: '« Je peux t\'aider. »', enabled: true }, { id: 'd_who', label: '« C\'est qui, ce mec ? »', enabled: true }, { id: 'd_police', label: '« Va voir les flics. »', enabled: !d.reported });
    if (d.helped) out.push({ id: 'd_pay_all', label: `Payer toute la dette (${d.amount} €)`, enabled: av.money >= d.amount, hint: av.money >= d.amount ? '' : `il manque ${Math.round(d.amount - av.money)} €` }, { id: 'd_pay_part', label: 'Lui donner 1 000 €', enabled: av.money >= 1000 });
  } else if (Debt.isVictor(npc)) {
    const night = w.hour() >= 19 || w.hour() < 4; if (!Debt.isTommy(av) && night && !w.job) out.push({ id: 'v_job', label: 'Une proposition ?', enabled: true, hint: 'discrétion exigée' });
    if (Debt.offerOpen(w)) out.push({ id: 'v_job_yes', label: 'Accepter le colis (300 €)', enabled: !w.job }, { id: 'v_job_no', label: 'Refuser', enabled: true });
    if (Debt.isTommy(av)) out.push({ id: 'v_pay_me', label: `Payer (${d.amount} €)`, enabled: av.money >= d.amount }, { id: 'v_pay_part', label: 'Verser 1 000 €', enabled: av.money >= 1000 }, { id: 'v_delay', label: 'Demander un délai', enabled: true });
    else out.push({ id: 'v_ask', label: "« Qu'est-ce que vous voulez à Tommy ? »", enabled: true }, { id: 'v_pay', label: `Payer la dette de Tommy (${d.amount} €)`, enabled: av.money >= d.amount }, { id: 'v_pay_part', label: 'Verser 1 000 €', enabled: av.money >= 1000 }, { id: 'v_delay', label: 'Négocier un délai', enabled: true }, { id: 'v_threat', label: 'Le menacer', enabled: true });
  }
  return out;
}
/** Choix de romance proposés seulement entre adultes compatibles (le reste n'apparaît pas). */
function romanceChoices(w: World, av: SimChar, npc: SimChar): Choice[] {
  if (npc.kind !== 'resident' && npc.kind !== 'citizen') return []; if (!Romance.adult(av) || !Romance.adult(npc) || !Romance.compatible(av, npc)) return [];
  const rm = Romance.get(w, av.id, npc.id); const out: Choice[] = [];
  if (inBar(w, npc) && (w.hour() >= 20 || w.hour() < 4)) out.push({ id: 'dance', label: 'Inviter à danser', enabled: true, hint: 'Zinc Club' });
  if (!rm || rm.state === 'ex') { out.push({ id: 'flirt', label: 'Flirter', enabled: true, hint: 'un non est un non' }); if (!rm) out.push({ id: 'date', label: 'Proposer un rendez-vous', enabled: Romance.canDate(w, av, npc) === '', hint: Romance.canDate(w, av, npc) || 'adultes consentants' }); }
  else { out.push({ id: 'date', label: 'Proposer une sortie', enabled: true }); if (rm.state === 'dating') out.push({ id: 'couple', label: 'Proposer de sortir ensemble', enabled: Romance.canCouple(w, av, npc) === '', hint: Romance.canCouple(w, av, npc) }); else out.push({ id: 'evening', label: 'Passer la soirée ensemble', enabled: true, hint: 'si l\'autre en a envie' }); out.push({ id: 'breakup', label: 'Rompre', enabled: true }); }
  return out;
}
export function choose(w: World, npc: SimChar, id: string, arg = ''): Reply {
  if (id !== 'bye' && id !== 'sheet') Quests.emit(w, 'choice');
  const av = w.avatar; const r = rel(w, npc.id, av.id); w.stats.player_talks = (w.stats.player_talks ?? 0) + 1;
  switch (id) {
    case 'bye': return { line: npc.kind === 'staff' ? 'Bonne soirée.' : 'À plus tard.', close: true };
    case 'holdup': { const r = Crime.startHoldup(w, av); return { line: r.line, close: r.ok }; }
    case 'job': {
      if (w.job || (av.inventory.parcel ?? 0) > 0) return { line: 'Tu as déjà un colis à livrer.' }; const to = pickDeliveryTarget(w); if (!to) return { line: "Je n'ai personne à qui l'envoyer pour l'instant. Repasse plus tard." };
      w.job = { to: to.id, pay: Math.round(25 * Profile.payMult(w)), t0: w.clock }; av.inventory.parcel = 1; Quests.emit(w, 'job_accept'); w.emitLog(`${npc.first} vous confie un colis pour ${to.first}.`, 'info', av.id);
      return { line: `${npc.first} : « Ce colis est pour ${to.first}${to.kind === 'citizen' && to.job ? ' (' + to.job.toLowerCase() + ')' : ''}. Tu le trouveras ${to.away ? 'plus tard' : 'dans le quartier'} — le café, d'habitude. ${w.job.pay} € à la livraison. »`, close: true };
    }
    case 'deliver': {
      if (!w.job || w.job.to !== npc.id || (av.inventory.parcel ?? 0) <= 0) return { line: 'Ce colis n\'est pas pour moi.' }; const pay = w.job.pay; const tip = npc.trait('agreeableness') > 0.6 ? 3 : 0;
      const illegal = !!w.job.illegal; if (!illegal) Debt.rep(w, 'pro', 2); av.inventory.parcel = 0; w.job = null; av.money += pay + tip; if (illegal) { Debt.rep(w, 'criminal', 4); const cops = Crime.viewers(w, av.pos, [av.id], 9).filter((o) => o.kind === 'police'); if (cops.length) { Crime.onCrime(w, av, 'theft', -1, { ...av.pos }, 1); for (const c of cops) c.addMemory(w.clock, 'suspicion', 'Un colis louche a changé de mains au Zinc.', -0.5, 0.7, av.id, { src: 'lived', conf: 0.7, subj: av.id }); Debt.rep(w, 'police', -3); } else w.emitLog('Le colis change de mains sans histoire.', 'info', av.id); } w.stats.jobs_done = (w.stats.jobs_done ?? 0) + 1; bump(w, npc, 4, 4); remember(npc, w, 'help', `${av.first === 'Vous' ? 'Quelqu\'un' : av.first} m'a livré un colis.`, 0.3, 0.5);
      Quests.emit(w, 'job_deliver'); Quests.emit(w, 'job_paid'); Quests.emit(w, 'delivered', npc.first); w.emitLog(`Livraison effectuée : +${pay + tip} €.`, 'info', av.id); return { line: `${npc.first} : « Merci, c'est bien celui que j'attendais. » Vous touchez ${pay}${tip ? ' + ' + tip + ' € de pourboire' : ' €'}.`, close: true };
    }
    case 'pay': { const n = Shop.pay(w, av); return { line: n > 0 ? `Vous payez ${n} €. « Merci, bonne journée. »` : "Vous n'avez rien à payer." }; }
    case 'surrender': { const off = npc.kind === 'police' ? npc : w.police[0]; Crime.arrest(w, off, av, true); return { line: 'Vous levez les mains. On vous emmène.', close: true }; }
    case 'steal': { const r = Life.playerSteal(w, av, npc); if (r.ok) Quests.emit(w, 'steal'); return { line: r.line, close: r.ok && npc.isAsleep() }; }
    case 'dance': { const r = Romance.dance(w, av, npc); return { line: r.line }; }
    case 'flirt': { const r = Romance.flirt(w, av, npc); return { line: r.line }; }
    case 'date': { const r = Romance.get(w, av.id, npc.id) ? Romance.again(w, av, npc) : Romance.date(w, av, npc); return { line: r.line }; }
    case 'couple': { const r = Romance.ask(w, av, npc); return { line: r.line }; }
    case 'evening': { const r = Romance.evening(w, av, npc); return { line: r.line, close: r.ok }; }
    case 'breakup': { const r = Romance.breakUp(w, av, npc); return { line: r.line, close: r.ok }; }
    case 'r2_accept': { const m = Camp.maya(w); if (!m) return { line: 'Tommy secoue la tête : « Laisse tomber. »' }; av.inventory.parcel = 1; w.job = { to: m.id, pay: 150, t0: w.clock, campaign: 'r2' }; w.camp.ambush = { stage: 0, at: w.clock + 20, outcome: '' }; Quests.emit(w, 'r2_take'); bump(w, npc, 4, 3); return { line: `${npc.first} te glisse un paquet scellé : « Au Zinc, à Maya. Elle sait. Si on te demande ce que c'est : un cadeau. Merci, vraiment. »`, close: true }; }
    case 'r2_refuse': { bump(w, npc, -5, 1); Quests.fail(w, 'r2', 'refusé'); return { line: `${npc.first} serre les dents : « OK. Je me débrouillerai. »`, close: true }; }
    case 'a_lie': case 'a_truth': case 'a_give': case 'a_fight': { const r = Camp.ambushChoice(w, id.slice(2) as any); return { line: r.line, close: r.close }; }
    case 'r4_accept': { const a = Debt.victor(w); const b = Camp.maya(w) && w.chars.find((c) => c.name === 'Marcus Rivera'); const cand = [a, b].filter((x): x is SimChar => !!x); const pair = cand.length >= 2 ? cand : [...cand, ...w.chars.filter((c) => (c.kind === 'resident' || c.kind === 'citizen') && !cand.includes(c) && c.age >= 18 && !c.away).slice(0, 2 - cand.length)]; if (pair.length < 2) return { line: `${npc.first} hausse les épaules : « Finalement, ça s'est arrangé. »`, close: true }; Camp.startDispute(w, pair[0], pair[1], { x: 36.5, y: 13.5 }, `${pair[0].first} et ${pair[1].first} s'accrochent au Zinc Club.`); Quests.emit(w, 'r4_accept'); return { line: `${npc.first} : « ${pair[0].first} et ${pair[1].first}, près de la piste. Calme ça avant que Moe ne s'en charge. Il est moins diplomate que toi. »`, close: true }; }
    case 'dp_calm': { const r = Camp.calm(w, npc); return { line: r.line, close: r.ok }; }
    case 'dp_moe': { const r = Camp.callBouncer(w); return { line: r.line, close: r.ok }; }
    case 'e_lie': case 'e_deny': case 'e_truth': case 'e_silent': { const r = Camp.interrogate(w, id.slice(2) as any); return { line: r.line, close: r.close }; }
    case 'e_bribe': { const r = Camp.bribeVictor(w); return { line: r.line, close: r.ok }; }
    case 'w_silence': case 'w_silence_pay': { const r = Camp.silence(w, npc, id === 'w_silence_pay'); return { line: r.line, close: r.ok }; }
    case 'c_obey': case 'c_flee': { const r = Director.checkAnswer(w, npc, id === 'c_obey'); return { line: r.line, close: r.close }; }
    case 'g_job': { const c = Garage.closedReason(w); return { line: c ? `${npc.first} : « On est ${c}. Reviens quand on est ouverts. »` : `${npc.first} : « L'établi du fond est libre, et la voiture sur le cric attend. Chaque réparation : une trentaine d'euros. Plus vite tu es bon, plus je te confie. »` }; }
    case 'g_tool': { const r = Garage.buyTool(w, av); if (r.ok) bump(w, npc, 2, 2); return { line: r.line }; }
    case 'g_tommy': { bump(w, npc, 1, 3); return { line: `${npc.first} sourit : « Tommy ? Un bon gars, mais il court après les problèmes. Il rêve d'ouvrir son propre garage. Je lui garde un établi… tant qu'il ne m'attire pas d'ennuis. »` }; }
    case 'd_ignore': { Debt.learnVictor(w, av); w.debt.told = true; Quests.emit(w, 'debt_told'); bump(w, npc, -6, 1); Debt.rep(w, 'social', -1); return { line: `${npc.first} serre la mâchoire : « Génial. Merci pour le soutien. »` }; }
    case 'd_help': { w.debt.told = true; w.debt.helped = true; Quests.emit(w, 'debt_told'); bump(w, npc, 5, 3); return { line: `${npc.first} : « Sérieux ? C'est ${w.debt.amount} € pour un certain Victor Kane. Il me tombera dessus ce soir ou demain. Il traîne sur la plage le soir, ou au Zinc. »` }; }
    case 'd_who': { Debt.learnVictor(w, av); w.debt.told = true; npc.addMemory(w.clock, 'confidence', "J'ai parlé de Victor Kane à quelqu'un.", -0.1, 0.5, av.id); return { line: `${npc.first} baisse la voix : « Victor Kane. Détective. Il se balade avec son badge et fait le sale boulot d'un réseau. Si tu le croises, fais gaffe. »` }; }
    case 'd_police': { const r = rel(w, npc.id, av.id); if (r.trust + r.aff >= 35) { Debt.report(w, npc); return { line: `${npc.first} hésite, puis souffle : « Les flics… OK. J'y vais. Si je ne reviens pas, c'est que ça a mal tourné. »`, close: true }; } r.fear = clamp(r.fear + 3); return { line: `${npc.first} ricane nerveusement : « T'es fou ? Il EST flic. Personne ne me croira. »` }; }
    case 'd_pay_all': { const r = Debt.pay(w, av); if (r.ok) bump(w, npc, 10, 4); return { line: r.ok ? `${npc.first} est bouche bée : « Tu viens de… Merci. Je te le revaudrai. »` : r.line, close: r.ok }; }
    case 'd_pay_part': { av.money -= 1000; npc.money += 1000; bump(w, npc, 8, 3); if (npc.money >= w.debt.amount) Debt.pay(w, npc); return { line: `${npc.first} prend les billets : « Je… merci. Ça aide. Ça ne suffit pas, mais ça aide. »` }; }
    case 'v_job': { Debt.offerJob(w); return { line: `${npc.first} baisse la voix : « J'ai un colis à faire passer au barman du Zinc. Trois cents euros, pas de questions. Vous êtes preneur ? »` }; }
    case 'v_job_yes': { const r = Debt.acceptJob(w, av); return { line: r.line, close: r.ok }; }
    case 'v_job_no': { w.debt.offerAt = 0; bump(w, npc, -1, 1); return { line: `${npc.first} hausse les épaules : « Dommage. Je trouverai quelqu'un d'autre. »` }; }
    case 'v_ask': { w.debt.metVictor = true; Quests.emit(w, 'debt_told'); w.debt.told = true; bump(w, npc, -1, 3); return { line: `${npc.first} ajuste sa veste : « Une affaire entre Tommy et moi. Cinq mille. Je suis très patient… jusqu'à un certain point. »` }; }
    case 'v_pay': case 'v_pay_me': { const r = Debt.pay(w, av); return { line: r.line, close: r.ok && w.debt.stage === 'resolved' }; }
    case 'v_pay_part': { const r = Debt.pay(w, av, 1000); return { line: r.line }; }
    case 'v_delay': { const r = Debt.negotiate(w, av); return { line: r.line, close: r.ok }; }
    case 'v_threat': { const r = rel(w, npc.id, av.id); if (w.rng.randf() < 0.15 + Math.max(0, w.rep.criminal) / 200) { w.debt.due += 1440; r.fear = clamp(r.fear + 20); Debt.rep(w, 'criminal', 2); w.fighters.has(npc.id) && Fight.end(w, npc); return { line: `${npc.first} te fixe un long moment : « Un jour de plus. Pas parce que j'ai peur. »`, close: true }; } Fight.start(w, npc, av, `${npc.first} ne se laisse pas menacer.`); return { line: `${npc.first} sourit : « Mauvaise idée. »`, close: true }; }
    case 'punch': { if (dist(av.pos, npc.pos) > 3.2) return { line: 'Trop loin pour chercher la bagarre.' }; if (Fight.initiate(w, av, npc)) return { line: `Vous cherchez la bagarre avec ${npc.first}. A : coup · A maintenu : coup puissant · B : garde`, close: true }; return { line: `${npc.first} n'est pas du genre à se battre ici.` }; }
    case 'wake': {
      bump(w, npc, -6, 1, 15); npc.anger = clamp(npc.anger + 25, 0, 100); remember(npc, w, 'wake', 'Quelqu\'un m\'a réveillé en pleine nuit.', -0.6, 0.6); w.showEmote(npc, 'anger', 3);
      if (npc.state === 'use' && npc.use_act === 'sleep') w.endUse(npc, false); w.emitLog(`${npc.first} est réveillé${feel(npc, 'e', '')} de mauvaise humeur par ${av.first.toLowerCase()}.`, 'drama', npc.id);
      return { line: `${npc.first} grogne, les yeux mi-clos : « …Qu'est-ce que vous faites là ? »`, close: true };
    }
    case 'how': {
      const e = npc.emotion; const mouth: Record<string, string> = { joy: 'Ça va super, vraiment !', content: 'Plutôt bien, merci.', neutral: 'Ça va. Et vous ?', tired: 'Crevé' + feel(npc, 'e', '') + '…', hungry: "J'ai une faim de loup.", lonely: feel(npc, 'Un peu seule', 'Un peu seul') + ', à vrai dire.', bored: "Je m'ennuie ferme.", irritated: "Bof. Ça m'énerve.", angry: 'Mal. Très mal.', sad: 'Pas terrible…', anxious: "Stressé" + feel(npc, 'e', '') + ', un peu.', dirty: "J'aurais bien besoin d'une douche.", love: 'Je ne sais pas… la tête ailleurs.', awe: 'Étrange. Comme si quelqu\'un veillait sur nous.' };
      if (r.aff < -20) return { line: 'Ça ne vous regarde pas.' };
      bump(w, npc, 0.8, 1); remember(npc, w, 'talk', 'Vous avez pris de mes nouvelles.', 0.2, 0.15);
      return { line: `« ${mouth[e] ?? 'Ça va.'} »  (${EMOTIONS[e] ?? e})` };
    }
    case 'chat': {
      const q = quality(w, npc); const kind = q < 0.31 ? 'argument' : q < 0.47 ? 'awkward' : q >= 0.7 ? 'great' : 'pleasant';
      const pool = kind === 'great' ? LINES_GREAT : kind === 'pleasant' ? LINES_OK : kind === 'awkward' ? LINES_BAD : LINES_ARGUE;
      const d = kind === 'great' ? 5 : kind === 'pleasant' ? 2.5 : kind === 'awkward' ? -1 : -7;
      bump(w, npc, d, 3, kind === 'argument' ? 20 : kind === 'awkward' ? 4 : -4); npc.needs.social = Math.min(100, npc.needs.social + (kind === 'argument' ? 3 : 12)); npc.joy += kind === 'great' ? 12 : kind === 'pleasant' ? 5 : 0;
      av.needs.social = Math.min(100, av.needs.social + (kind === 'argument' ? 2 : 10));
      if (kind === 'argument') { npc.anger = clamp(npc.anger + 22, 0, 100); w.showEmote(npc, 'anger', 3); remember(npc, w, 'fight', 'Dispute avec l\'inconnu qui me parlait.', -0.7, 0.7); w.emitLog(`${npc.first} se dispute avec ${av.first.toLowerCase()}.`, 'drama', npc.id); }
      else { remember(npc, w, 'talk', kind === 'great' ? 'Super discussion avec l\'étranger.' : 'Discussion avec l\'étranger.', kind === 'great' ? 0.6 : 0.2, 0.3); if (kind === 'great') w.showEmote(npc, 'smile', 3); }
      return { line: `Vous : « ${pickLine(w, pool, 0)} »\n${npc.first} : « ${pickLine(w, pool, 1)} »` };
    }
    case 'joke': {
      const p = 0.3 + 0.35 * npc.trait('openness') + 0.15 * (npc.mood > 0 ? 1 : 0) + 0.1 * npc.trait('extraversion') - npc.anger * 0.004;
      if (w.rng.randf() < p) { bump(w, npc, 3, 2); npc.joy += 10; w.showEmote(npc, 'note', 3); remember(npc, w, 'joke', 'L\'étranger m\'a fait rire.', 0.5, 0.35); return { line: `Vous : « Un dieu entre dans un bar… il se commande un miracle, on lui répond : "Désolé, c'est la maison qui régale." »\n${npc.first} éclate de rire.` }; }
      bump(w, npc, -1, 1); remember(npc, w, 'joke', 'Une blague qui n\'a pas pris.', -0.1, 0.15); return { line: `Vous : « Une blague, quelqu'un ? »\n${npc.first} vous regarde, impassible. Un ange passe.` };
    }
    case 'dark': {
      const ctx = w.mess.length >= 6 ? 'cette maison est tellement sale que même les cafards ont déménagé' : npc.anger > 25 ? 'au moins, la colère, ça fait des économies de chauffage' : 'la nuit, tout le monde ressemble à sa pire version, moi compris';
      if (npc.trait('openness') > 0.55 && npc.trait('agreeableness') < 0.78 && r.aff > -25) { bump(w, npc, 4, 3); npc.joy += 14; w.showEmote(npc, 'note', 3); remember(npc, w, 'joke', 'Une blague noire, très noire. Je l\'adore.', 0.6, 0.4); return { line: `Vous : « ${ctx[0].toUpperCase() + ctx.slice(1)}. »\n${npc.first} s'étouffe de rire : « Oh, vous êtes terrible ! »` }; }
      bump(w, npc, -6, 2, 12); npc.anger = clamp(npc.anger + 10, 0, 100); w.showEmote(npc, 'anger', 3); remember(npc, w, 'joke', 'Une blague de très mauvais goût.', -0.6, 0.5);
      return { line: `Vous : « ${ctx[0].toUpperCase() + ctx.slice(1)}. »\n${npc.first} se fige : « Ce n'est pas drôle du tout. »` };
    }
    case 'secret': {
      if (r.aff >= 45 && r.fam >= 40) {
        if (!w.knownSecrets.includes(npc.id)) w.knownSecrets.push(npc.id); bump(w, npc, 1, 4); remember(npc, w, 'secret', 'J\'ai confié mon secret à l\'étranger.', 0.1, 0.8); npc.stress += 6;
        w.emitLog(`${npc.first} se confie à ${av.first.toLowerCase()}.`, 'social', npc.id);
        return { line: `${npc.first} baisse la voix : « Promettez de n'en parler à personne… ${npc.secret} »` };
      }
      bump(w, npc, -2, 0, 6); remember(npc, w, 'secret', 'Un inconnu a posé des questions indiscrètes.', -0.3, 0.3);
      return { line: `${npc.first} recule : « Ça ne vous regarde pas. On se connaît à peine. »` };
    }
    case 'give': {
      if (av.money < 10) return { line: "Vous n'avez pas assez d'argent." };
      av.money -= 10; npc.money += 10; bump(w, npc, npc.money < 40 ? 6 : 3, 2); npc.joy += 8; remember(npc, w, 'money', 'L\'étranger m\'a donné de l\'argent sans rien demander.', 0.5, 0.5); w.stats.money_given = (w.stats.money_given ?? 0) + 10;
      return { line: `Vous donnez 10 € à ${npc.first}. « Merci… vraiment. »` };
    }
    case 'ask_money': {
      if (r.aff >= 30 && npc.money >= 15) { npc.money -= 10; av.money += 10; bump(w, npc, -1, 1); av.stats.debt = (av.stats.debt ?? 0) + 10; remember(npc, w, 'money', 'J\'ai prêté 10 € à l\'étranger. Il faudra qu\'il les rende.', 0, 0.5); return { line: `${npc.first} sort un billet : « Tenez. Mais vous me les rendez. »  (+10 €)` }; }
      bump(w, npc, -3, 0, 6); remember(npc, w, 'money', 'Un inconnu m\'a demandé de l\'argent.', -0.3, 0.3);
      return { line: r.aff < 30 ? `${npc.first} lève un sourcil : « Je ne vous connais pas assez pour ça. »` : `${npc.first} secoue la tête : « Je suis à sec, désolé. »` };
    }
    case 'gift': return { line: 'Que voulez-vous offrir ?', openGift: true };
    case 'give_item': {
      const it = ITEMS[arg]; if (!it || (av.inventory[arg] ?? 0) <= 0) return { line: 'Vous n\'avez plus cet objet.' }; if (arg === 'parcel') return { line: 'Ce colis n\'est pas à offrir : il doit être livré.' };
      av.inventory[arg]--; const want = (arg === 'sandwich' && npc.needs.hunger < 50) || (arg === 'bonbons' && npc.likes.includes('snack')) ? 2 : 1;
      bump(w, npc, it.gift * want, 2); npc.joy += 5 * want; if (it.hunger) npc.needs.hunger = Math.min(100, npc.needs.hunger + it.hunger); w.showEmote(npc, 'heart', 3); remember(npc, w, 'gift', `L'étranger m'a offert : ${it.label.toLowerCase()}.`, 0.4, 0.4);
      Quests.emit(w, 'gift', npc.id); Quests.emit(w, 'gift_to', npc.first); return { line: `Vous offrez : ${it.label}. ${npc.first} sourit : « C'est gentil. »` };
    }
    case 'drink': {
      const d = DRINKS.biere; if (av.money < d.price) return { line: "Vous n'avez pas assez d'argent." };
      av.money -= d.price; npc.drunk = Math.min(100, npc.drunk + d.drunk); npc.needs.fun = Math.min(100, npc.needs.fun + d.fun); npc.needs.social = Math.min(100, npc.needs.social + d.social);
      bump(w, npc, 4, 3); npc.joy += 8; w.showEmote(npc, 'note', 3); remember(npc, w, 'drink', 'L\'étranger m\'a offert un verre au bar.', 0.5, 0.5); w.stats.drinks_offered = (w.stats.drinks_offered ?? 0) + 1;
      w.emitLog(`Vous offrez une bière à ${npc.first}.`, 'social', npc.id); return { line: `Vous offrez une bière à ${npc.first}. « À la vôtre ! »` };
    }
    case 'order': return { line: 'Voici la carte.', openBar: true };
    case 'rumors': {
      const recent = w.journal.filter((e) => e.kind === 'drama' && w.clock - e.t < 1440).slice(-3).map((e) => e.text);
      bump(w, npc, 0.5, 2); return { line: recent.length ? `Gaby essuie un verre : « On dit que… ${recent.join(' ; ')} »` : 'Gaby hausse les épaules : « Rien de spécial. Un quartier tranquille. Pour l\'instant. »' };
    }
  }
  return { line: '…' };
}

/** Commande d'une boisson / nourriture par le joueur au bar. */
export function orderDrink(w: World, id: string): { ok: boolean; msg: string } {
  const av = w.avatar; const gb = w.barman;
  if (!gb || gb.away || !w.barOpen()) return { ok: false, msg: 'Le bar est fermé.' };
  const food = BAR_FOOD[id]; const d = DRINKS[id]; const price = food ? food.price : d?.price; if (price === undefined) return { ok: false, msg: 'Inconnu.' };
  if (av.money < price) return { ok: false, msg: "Vous n'avez pas assez d'argent." };
  av.money -= price; gb.money += price; w.stats.drinks = (w.stats.drinks ?? 0) + 1; av.stats.spent = (av.stats.spent ?? 0) + price;
  if (food) { av.inventory[id] = (av.inventory[id] ?? 0) + 1; w.emitLog(`Vous achetez des ${food.label.toLowerCase()} (${price} €).`, 'info', av.id); return { ok: true, msg: `${food.label} ajouté à votre inventaire.` }; }
  av.drunk = Math.min(100, av.drunk + d.drunk); av.needs.fun = Math.min(100, av.needs.fun + d.fun); av.needs.social = Math.min(100, av.needs.social + d.social);
  if (d.energy) av.needs.energy = Math.min(100, av.needs.energy + d.energy);
  av.plan = [{ type: 'wait', act: 'drink', dur: 6 }]; if (av.state === 'idle') w.startNextStep(av);
  w.emitLog(`Vous commandez : ${d.label.toLowerCase()} (${price} €).`, 'info', av.id); w.showEmote(av, d.drunk > 0 ? 'note' : 'smile', 3);
  gb.addMemory(w.clock, 'customer', `Un client a commandé : ${d.label.toLowerCase()}.`, 0.1, 0.1, av.id);
  const r = rel(w, gb.id, av.id); r.aff = clamp(r.aff + 0.8); r.fam = clamp(r.fam + 1.5, 0, 100); Quests.emit(w, 'drink');
  return { ok: true, msg: `${d.label} — ${price} €. Santé !` };
}

export function useItem(w: World, id: string): string {
  const av = w.avatar; const it = ITEMS[id]; if (!it || (av.inventory[id] ?? 0) <= 0) return 'Rien à utiliser.';
  if (!it.hunger && !it.fun) return it.desc;
  av.inventory[id]--; if (it.hunger) av.needs.hunger = Math.min(100, av.needs.hunger + it.hunger); if (it.fun) av.needs.fun = Math.min(100, av.needs.fun + it.fun);
  w.showEmote(av, 'smile', 2.5); av.plan = [{ type: 'wait', act: 'drink', dur: 3 }]; if (av.state === 'idle') w.startNextStep(av); return `Vous consommez : ${it.label.toLowerCase()}.`;
}

const shelfLabel = (w: World, fi: number, si: number) => { const it = Shop.shelfItem(w, fi, si); return it ? `Prendre : ${Shop.itemLabel(it)} (${Shop.PRICE[it]} €)` : 'Prendre un article'; };
export interface Interactable { kind: 'npc' | 'furn' | 'home' | 'sheet'; label: string; d: number; npc?: SimChar; furn?: number; slot?: number; act?: string; stand?: V2 }
const FURN_ACTS: Record<string, string> = { shop: 'shop', snack: 'snack', cook: 'cook', toilet: 'toilet', shower: 'shower', wash: 'wash', tv: 'tv', read: 'read', nap: 'nap', bath: 'bath', browse: 'browse', water: 'water', dishes: 'dishes', pray: 'pray', music: 'music', drink: 'drink', repair: 'repair' };
const FURN_LABELS: Record<string, string> = { repair: 'Travailler au garage (+30 €)', snack: 'Fouiller dans le frigo', cook: 'Cuisiner', toilet: 'Aller aux toilettes', shower: 'Prendre une douche', wash: 'Se laver les mains', tv: 'S\'asseoir et regarder la télé', read: 'Lire', nap: 'Faire une sieste', bath: 'Prendre un bain', browse: 'Feuilleter un livre', water: 'Arroser la plante', dishes: 'Faire la vaisselle', pray: 'Se recueillir devant l\'autel', music: 'Mettre un morceau sur le jukebox', drink: 'S\'asseoir au bar' };
/** Tout ce que l'avatar peut faire autour de lui, avec distance. */
export function nearby(w: World, av: SimChar, reach = 1.9): Interactable[] {
  const out: Interactable[] = [];
  for (const o of w.chars) { if (o.id === av.id || o.away) continue; const d = dist(o.pos, av.pos); if (d <= reach + ((o.kind === 'staff' || o.kind === 'clerk') ? 0.9 : 0.4) && lineClear(av.pos, o.pos)) { out.push({ kind: 'npc', label: `Parler à ${o.first}`, d, npc: o }); out.push({ kind: 'sheet', label: `Consulter la fiche de ${o.first}`, d: d + 0.7, npc: o }); } }
  for (const f of w.furn) f.slots.forEach((slot, si) => {
    if (f.users[si] !== -1) return;
    for (const tag of slot.tags) {
      const act = FURN_ACTS[tag]; if (!act || !ACT[act]) continue; if (act === 'repair' && Garage.closedReason(w)) { out.push({ kind: 'furn', label: `Garage : ${Garage.closedReason(w)}`, d: 9, furn: f.i, slot: si, act: 'idle', stand: slot.stands.map((s) => ({ x: f.x + s[0], y: f.y + s[1] })).find((c) => w.isWalkable(c)) ?? { x: f.x, y: f.y + 1 } } as any); continue; }
      const st = slot.stands.map((s) => ({ x: f.x + s[0], y: f.y + s[1] })).find((c) => w.isWalkable(c)); if (!st) continue;
      const d = dist({ x: st.x + 0.5, y: st.y + 0.5 }, av.pos); if (d > reach || !lineClear(av.pos, { x: st.x + 0.5, y: st.y + 0.5 })) continue;
      if (act === 'drink' && f.def !== 'stool') continue;
      out.push({ kind: 'furn', label: tag === 'shop' ? shelfLabel(w, f.i, si) : FURN_LABELS[tag] ?? ACT[act].label, d, furn: f.i, slot: si, act, stand: st }); break;
    }
  });
  return out.sort((a, b) => a.d - b.d);
}
/** Lance l'usage d'un meuble par l'avatar (marche jusqu'au point d'accès puis utilise). */
export function useFurniture(w: World, av: SimChar, it: Interactable) {
  if (it.kind !== 'furn') return; const f = w.furn[it.furn!];
  if (it.act === 'music') { av.plan = [{ type: 'goto', cell: it.stand! }, { type: 'use', furn: it.furn, slot: it.slot, act: 'music', stand: it.stand }]; w.musicUntil = w.clock + 25; w.emitLog('Vous lancez un morceau sur le jukebox.', 'info', av.id); }
  else av.plan = [{ type: 'goto', cell: it.stand! }, { type: 'use', furn: it.furn, slot: it.slot, act: it.act, stand: it.stand }];
  if (av.state === 'idle') w.startNextStep(av); void f;
}
/** Marche vers un habitant ; à l'arrivée World.onAvatarArrive est appelé. */
export function walkToNpc(w: World, av: SimChar, npc: SimChar) { if (av.state !== 'idle') w.abortPlan(av, 'new'); av.plan = [{ type: 'approach', target: npc.id }]; w.startNextStep(av); }
export function describeLocation(w: World, c: SimChar) { const r = roomAt(Math.floor(c.pos.x), Math.floor(c.pos.y)); return r; }
export { NEEDS };

// ---------------------------------------------------------------------------
// Interaction par toucher : on décrit CE QUI est touché (PNJ, meuble, case), l'interface n'a qu'à exécuter le plan renvoyé.
// Pensé pour être réutilisé tel quel avec d'autres cibles (bâtiments, véhicules, pouvoirs divins) : il suffit d'ajouter un `kind`.
export type TapTarget = { npc?: number; furn?: number; cell?: V2 };
export type TapPlan =
  | { kind: 'none'; msg: string }
  | { kind: 'walk'; cell: V2 }
  | { kind: 'talk'; npc: SimChar }
  | { kind: 'approach'; npc: SimChar }
  | { kind: 'use'; item: Interactable }
  | { kind: 'menu'; items: Interactable[] };

/** Toutes les actions réellement implémentées pour un meuble donné, où que se trouve le joueur (la marche est gérée par le plan). */
export function furnitureOptions(w: World, furnIdx: number): Interactable[] {
  const f = w.furn[furnIdx]; const out: Interactable[] = []; if (!f) return out;
  if (Home.isMovable(f)) out.push({ kind: 'home', label: `Déplacer : ${Home.label(f.def)}`, d: 5, furn: f.i, act: 'move' }, ...(Home.canRotate(f.def) ? [{ kind: 'home' as const, label: `Pivoter : ${Home.label(f.def)}`, d: 5, furn: f.i, act: 'rotate' }] : []), { kind: 'home', label: `Ranger : ${Home.label(f.def)}`, d: 5, furn: f.i, act: 'stash' });
  if (f.def === 'wardrobe' && !f.gone && Home.inApartment(f.x, f.y)) out.push({ kind: 'home', label: 'Changer de tenue', d: 1, furn: f.i, act: 'outfit' });
  f.slots.forEach((slot, si) => {
    if (f.users[si] !== -1) return;
    for (const tag of slot.tags) {
      const act = FURN_ACTS[tag]; if (!act || !ACT[act]) continue; if (act === 'repair' && Garage.closedReason(w)) { out.push({ kind: 'furn', label: `Garage : ${Garage.closedReason(w)}`, d: 9, furn: f.i, slot: si, act: 'idle', stand: slot.stands.map((s) => ({ x: f.x + s[0], y: f.y + s[1] })).find((c) => w.isWalkable(c)) ?? { x: f.x, y: f.y + 1 } } as any); continue; }
      if (act === 'drink' && f.def !== 'stool') continue;
      const st = slot.stands.map((s) => ({ x: f.x + s[0], y: f.y + s[1] })).find((c) => w.isWalkable(c)); if (!st) continue;
      out.push({ kind: 'furn', label: tag === 'shop' ? shelfLabel(w, f.i, si) : FURN_LABELS[tag] ?? ACT[act].label, d: 0, furn: f.i, slot: si, act, stand: st });
    }
  });
  return out;
}
/** Décide quoi faire d'un toucher dans le monde. Aucune interaction n'est déclenchée à distance ni à travers un mur. */
export function planTap(w: World, av: SimChar, t: TapTarget): TapPlan {
  if (t.npc !== undefined && t.npc !== av.id) {
    const npc = w.chars[t.npc]; if (!npc || npc.away) return { kind: 'none', msg: 'Personne ici.' };
    const near = dist(npc.pos, av.pos) <= ((npc.kind === 'staff' || npc.kind === 'clerk') ? 2.6 : 1.9) && lineClear(av.pos, npc.pos);
    if (near) return { kind: 'talk', npc };
    return { kind: 'approach', npc };
  }
  if (t.furn !== undefined) {
    const opts = furnitureOptions(w, t.furn);
    if (opts.length === 0) return { kind: 'none', msg: w.furn[t.furn]?.def ? 'Rien à faire avec ça.' : '' };
    const reachable = opts.filter((o) => o.kind === 'home' || w.pathTo(av.pos, o.stand!).length > 0 || (Math.floor(av.pos.x) === o.stand!.x && Math.floor(av.pos.y) === o.stand!.y));
    if (reachable.length === 0) return { kind: 'none', msg: "Impossible d'y accéder." };
    return reachable.length === 1 ? { kind: 'use', item: reachable[0] } : { kind: 'menu', items: reachable };
  }
  if (t.cell) {
    let c = t.cell; if (!w.isWalkable(c)) c = nearestWalkable(w, c, 2);
    if (c.x < 0) return { kind: 'none', msg: '' };
    if (w.pathTo(av.pos, c).length === 0 && !(Math.floor(av.pos.x) === c.x && Math.floor(av.pos.y) === c.y)) return { kind: 'none', msg: "Impossible d'y aller." };
    return { kind: 'walk', cell: c };
  }
  return { kind: 'none', msg: '' };
}
