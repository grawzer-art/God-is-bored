/** Interactions du mode humain : dialogues, achats, objets, inventaire. Fonctions pures sur le World : tout est persistant. */
import { ACT, EMOTIONS, NEEDS, type V2 } from './defs';
import { LINES_ARGUE, LINES_BAD, LINES_GREAT, LINES_OK } from './social';
import { roomAt } from './layout';
import type { SimChar } from './simchar';
import { dist, type World } from './world';
import { lineClear, nearestWalkable } from './movement';
import * as Life from './life';
import * as Shop from './shop';
import * as Crime from './crime';

export const ITEMS: Record<string, { label: string; hunger?: number; fun?: number; gift: number; desc: string }> = {
  sandwich: { label: 'Sandwich', hunger: 35, gift: 2, desc: 'Un sandwich un peu écrasé.' },
  bonbons: { label: 'Bonbons', hunger: 5, fun: 8, gift: 3, desc: 'Un sachet de bonbons acidulés.' },
  briquet: { label: 'Briquet', gift: 0.5, desc: 'Un briquet. Il fonctionne encore.' },
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
  const av = w.avatar; const r = rel(w, npc.id, av.id); const ch: Choice[] = [];
  if (npc.kind === 'staff') {
    const h = npc.away;
    const greet = h ? "Le bar est fermé pour l'instant." : r.fam < 20 ? "Bonsoir. Qu'est-ce que je vous sers ?" : r.aff > 25 ? 'Tiens, un habitué ! La même chose ?' : 'Bonsoir. Je vous écoute.';
    ch.push({ id: 'order', label: 'Commander', enabled: !h && w.barOpen(), hint: 'carte des boissons' }, { id: 'rumors', label: 'Des nouvelles du quartier ?', enabled: !h },
      { id: 'chat', label: 'Bavarder', enabled: !h }, { id: 'bye', label: 'Au revoir', enabled: true });
    return { line: greet, choices: ch };
  }
  if (npc.kind === 'clerk') {
    const due = Shop.owed(av); const open = !npc.away;
    return { line: due > 0 ? `${npc.first} regarde vos articles : « Ça fait ${due} €. »` : r.fam < 20 ? "Bonjour. Je vous laisse regarder, hein." : 'Tiens, un habitué.', choices: [
      { id: 'pay', label: due > 0 ? `Payer mes articles (${due} €)` : 'Payer', enabled: open && due > 0 && av.money >= due, hint: due > 0 && av.money < due ? 'pas assez d\'argent' : due > 0 ? '' : 'rien à payer' },
      { id: 'chat', label: 'Bavarder', enabled: open }, { id: 'bye', label: 'Au revoir', enabled: true }] };
  }
  if (npc.kind === 'police') {
    const wanted = w.wanted.level > 0;
    return { line: wanted ? `${npc.first} vous fixe : « Vous êtes recherché(e). Ne bougez plus. »` : `${npc.first} vous salue d'un signe de tête : « Tout va bien ? »`, choices: [
      { id: 'surrender', label: 'Se rendre', enabled: wanted, hint: wanted ? 'amende réduite' : 'vous n\'êtes pas recherché(e)' }, { id: 'chat', label: 'Bavarder', enabled: true }, { id: 'bye', label: 'Partir', enabled: true }] };
  }
  if (npc.isAsleep()) return { line: `${npc.first} dort profondément.`, choices: [{ id: 'wake', label: 'Réveiller', enabled: true, hint: 'mauvaise idée' }, { id: 'steal', label: 'Fouiller ses poches', enabled: npc.money >= 5, hint: 'risqué si on vous voit' }, { id: 'bye', label: 'Laisser dormir', enabled: true }] };
  const line = npc.anger > 40 ? 'Pas maintenant. Je suis furieux' + feel(npc, 'se', '') + '.' : r.aff >= 40 ? `Ah, c'est ${av.first === 'Vous' ? 'vous' : av.first} ! ${feel(npc, 'Contente', 'Content')} de vous voir.` : r.fam < 15 ? `Oui ? Je ne crois pas vous connaître…` : r.aff <= -20 ? 'Qu\'est-ce que vous voulez ?' : 'Oui ?';
  const dark = w.mess.length >= 6 || npc.anger > 25 || npc.mood < -25 || (w.hour() > 23 || w.hour() < 4);
  ch.push({ id: 'how', label: 'Comment ça va ?', enabled: true }, { id: 'chat', label: 'Bavarder', enabled: true },
    { id: 'joke', label: 'Plaisanter', enabled: true }, { id: 'dark', label: 'Humour noir', enabled: dark, hint: dark ? 'contexte propice' : 'pas le bon moment' },
    { id: 'gift', label: 'Offrir quelque chose', enabled: Object.values(av.inventory).some((n) => n > 0) },
    { id: 'give', label: 'Donner 10 €', enabled: av.money >= 10 }, { id: 'ask_money', label: 'Emprunter 10 €', enabled: true, hint: r.aff >= 30 ? '' : 'peu probable' },
    { id: 'secret', label: 'Poser une question personnelle', enabled: true, hint: r.aff >= 45 && r.fam >= 40 ? '' : 'trop tôt ?' });
  if (inBar(w, npc) && w.barman && !w.barman.away) ch.push({ id: 'drink', label: 'Offrir un verre (4 €)', enabled: av.money >= 4 });
  ch.push({ id: 'steal', label: 'Faire les poches', enabled: npc.money >= 5, hint: 'très risqué' }, { id: 'bye', label: 'Partir', enabled: true });
  return { line, choices: ch };
}

function remember(npc: SimChar, w: World, kind: string, text: string, v: number, wt: number) { npc.addMemory(w.clock, kind, text, v, wt, w.avatar.id); }
function bump(w: World, npc: SimChar, d: number, fam = 2, ten = 0) {
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
export function choose(w: World, npc: SimChar, id: string, arg = ''): Reply {
  const av = w.avatar; const r = rel(w, npc.id, av.id); w.stats.player_talks = (w.stats.player_talks ?? 0) + 1;
  switch (id) {
    case 'bye': return { line: npc.kind === 'staff' ? 'Bonne soirée.' : 'À plus tard.', close: true };
    case 'pay': { const n = Shop.pay(w, av); return { line: n > 0 ? `Vous payez ${n} €. « Merci, bonne journée. »` : "Vous n'avez rien à payer." }; }
    case 'surrender': { const off = npc.kind === 'police' ? npc : w.police[0]; Crime.arrest(w, off, av, true); return { line: 'Vous levez les mains. On vous emmène.', close: true }; }
    case 'steal': { const r = Life.playerSteal(w, av, npc); return { line: r.line, close: r.ok && npc.isAsleep() }; }
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
      const it = ITEMS[arg]; if (!it || (av.inventory[arg] ?? 0) <= 0) return { line: 'Vous n\'avez plus cet objet.' };
      av.inventory[arg]--; const want = (arg === 'sandwich' && npc.needs.hunger < 50) || (arg === 'bonbons' && npc.likes.includes('snack')) ? 2 : 1;
      bump(w, npc, it.gift * want, 2); npc.joy += 5 * want; if (it.hunger) npc.needs.hunger = Math.min(100, npc.needs.hunger + it.hunger); w.showEmote(npc, 'heart', 3); remember(npc, w, 'gift', `L'étranger m'a offert : ${it.label.toLowerCase()}.`, 0.4, 0.4);
      return { line: `Vous offrez : ${it.label}. ${npc.first} sourit : « C'est gentil. »` };
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
  const r = rel(w, gb.id, av.id); r.aff = clamp(r.aff + 0.8); r.fam = clamp(r.fam + 1.5, 0, 100);
  return { ok: true, msg: `${d.label} — ${price} €. Santé !` };
}

export function useItem(w: World, id: string): string {
  const av = w.avatar; const it = ITEMS[id]; if (!it || (av.inventory[id] ?? 0) <= 0) return 'Rien à utiliser.';
  if (!it.hunger && !it.fun) return it.desc;
  av.inventory[id]--; if (it.hunger) av.needs.hunger = Math.min(100, av.needs.hunger + it.hunger); if (it.fun) av.needs.fun = Math.min(100, av.needs.fun + it.fun);
  w.showEmote(av, 'smile', 2.5); av.plan = [{ type: 'wait', act: 'drink', dur: 3 }]; if (av.state === 'idle') w.startNextStep(av); return `Vous consommez : ${it.label.toLowerCase()}.`;
}

const shelfLabel = (w: World, fi: number, si: number) => { const it = Shop.shelfItem(w, fi, si); return it ? `Prendre : ${Shop.itemLabel(it)} (${Shop.PRICE[it]} €)` : 'Prendre un article'; };
export interface Interactable { kind: 'npc' | 'furn'; label: string; d: number; npc?: SimChar; furn?: number; slot?: number; act?: string; stand?: V2 }
const FURN_ACTS: Record<string, string> = { shop: 'shop', snack: 'snack', cook: 'cook', toilet: 'toilet', shower: 'shower', wash: 'wash', tv: 'tv', read: 'read', nap: 'nap', bath: 'bath', browse: 'browse', water: 'water', dishes: 'dishes', pray: 'pray', music: 'music', drink: 'drink' };
const FURN_LABELS: Record<string, string> = { snack: 'Fouiller dans le frigo', cook: 'Cuisiner', toilet: 'Aller aux toilettes', shower: 'Prendre une douche', wash: 'Se laver les mains', tv: 'S\'asseoir et regarder la télé', read: 'Lire', nap: 'Faire une sieste', bath: 'Prendre un bain', browse: 'Feuilleter un livre', water: 'Arroser la plante', dishes: 'Faire la vaisselle', pray: 'Se recueillir devant l\'autel', music: 'Mettre un morceau sur le jukebox', drink: 'S\'asseoir au bar' };
/** Tout ce que l'avatar peut faire autour de lui, avec distance. */
export function nearby(w: World, av: SimChar, reach = 1.9): Interactable[] {
  const out: Interactable[] = [];
  for (const o of w.chars) { if (o.id === av.id || o.away) continue; const d = dist(o.pos, av.pos); if (d <= reach + ((o.kind === 'staff' || o.kind === 'clerk') ? 0.9 : 0.4) && lineClear(av.pos, o.pos)) out.push({ kind: 'npc', label: `Parler à ${o.first}`, d, npc: o }); }
  for (const f of w.furn) f.slots.forEach((slot, si) => {
    if (f.users[si] !== -1) return;
    for (const tag of slot.tags) {
      const act = FURN_ACTS[tag]; if (!act || !ACT[act]) continue;
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
  f.slots.forEach((slot, si) => {
    if (f.users[si] !== -1) return;
    for (const tag of slot.tags) {
      const act = FURN_ACTS[tag]; if (!act || !ACT[act]) continue;
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
    const reachable = opts.filter((o) => w.pathTo(av.pos, o.stand!).length > 0 || (Math.floor(av.pos.x) === o.stand!.x && Math.floor(av.pos.y) === o.stand!.y));
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
