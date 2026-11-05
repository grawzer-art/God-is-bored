/** Conversations, relations, souvenirs, objectifs. Port de Social.gd. */
import { NEEDS, type V2 } from './defs';
import { GOALS, GOAL_CYCLE } from './roster';
import { roomAt } from './layout';
import type { SimChar } from './simchar';
import type { World, Session } from './world';
import { dist } from './world';
import * as Life from './life';
import { buildingAt } from './layout';

const CHATTABLE = ['clerk', 'patrol', 'look', 'rest', 'drink', 'shop', 'bartend', 'idle', 'tv', 'read', 'eat', 'feast', 'browse', 'tidy', 'water', 'dishes', 'cook', 'laundry', 'pray'];
export const LINES_GREAT = [
  ['Franchement, cette maison sans toi serait d\'un ennui mortel.', 'Ha ! Tu dis ça à tout le monde.'],
  ["Tu as une minute ? J'ai une histoire incroyable à te raconter.", 'Toujours. Raconte, raconte.'],
  ["Je repensais à ce qu'on disait l'autre soir. Tu avais raison.", "Je note la date : tu viens d'admettre quelque chose."],
  ['On devrait organiser une vraie soirée, pour une fois.', 'Avec la musique trop forte et les voisins furieux ? Je suis partant.'],
  ["J'ai fait un rêve étrange cette nuit, un grand œil qui nous regardait.", 'Tu devrais arrêter les films d\'horreur.'],
];
export const LINES_OK = [
  ['Tu as bien dormi ?', 'Moyennement. Le radiateur fait un bruit bizarre.'], ['Il reste du café ?', "Je crois que oui. Ou alors c'est de l'eau sale."],
  ["Tu as vu l'état de la cuisine ?", "Ne m'en parle pas."], ['Il fait froid ce matin, non ?', "On dirait. Ou alors c'est moi."],
  ['Ça te dit de regarder quelque chose ce soir ?', "Pourquoi pas. Si ce n'est pas encore un documentaire."],
];
export const LINES_BAD = [['Ah, c\'est toi.', 'Oui, c\'est moi. Quelle surprise.'], ['Tu pourrais faire attention à tes affaires, quand même.', 'Je les range quand j\'ai le temps.'], ["On n'a pas la même idée de la vie en collectivité.", 'Visiblement, non.']];
export const LINES_ARGUE = [
  ["J'en ai assez de ramasser derrière toi !", "Personne ne te l'a demandé !"], ['Tu fais toujours ça, tu ne penses jamais aux autres !', 'Et toi, tu es toujours en train de donner des leçons !'],
  ['Tu as pris mes affaires sans demander.', 'Parce que tu les laisses traîner partout !'], ['Ta musique, ta télé, tes horaires... c\'est insupportable.', 'Alors déménage, personne ne te retient.'],
];

export function canBeApproached(w: World, t: SimChar): boolean {
  if (t.away) return false; // hors de la carte (travail, recherche d'emploi)
  if (t.talking || t.isAsleep()) return false;
  if (t.state === 'idle') return true;
  if (t.state === 'chat') return false;
  if (t.state === 'walk') return t.minNeed() > 25;
  if (t.state === 'use') return CHATTABLE.includes(t.use_act);
  return false;
}
export function approachCell(w: World, c: SimChar, t: SimChar): V2 {
  const base = t.cell(); let best = { x: -1, y: -1 }; let bs = 1e9; const troom = w.roomOf(t.pos);
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    if (dx === 0 && dy === 0) continue;
    const cc = { x: base.x + dx, y: base.y + dy };
    if (!w.isWalkable(cc)) continue;
    const center = { x: cc.x + 0.5, y: cc.y + 0.5 };
    const dt = dist(center, t.pos); if (dt > 2.1 || dt < 0.7) continue;
    if (w.chars.some((o) => o.id !== c.id && dist(o.pos, center) < 0.75 && o.state !== 'walk')) continue;
    let score = dist(c.pos, center) + dt * 1.5;
    if (roomAt(cc.x, cc.y) !== troom) score += 8;
    if (score < bs) { bs = score; best = cc; }
  }
  return best;
}
export function pickChatTarget(w: World, c: SimChar): SimChar | null {
  let best: SimChar | null = null; let bs = -1e9; const hostile = c.anger > 38;
  for (const o of w.chars) {
    if (o.id === c.id || o.kind !== 'resident' || !canBeApproached(w, o)) continue;
    const hb = buildingAt(c.cell().x, c.cell().y)?.name; if (hb && buildingAt(o.cell().x, o.cell().y)?.name !== hb) continue; // pas de traversée de rue pour bavarder
    if ((c.avoid[o.id] ?? 0) > w.clock && !hostile) continue;
    const r = w.getRel(c.id, o.id);
    let score = hostile ? -r.aff * 0.5 + w.rng.randf() * 5
      : r.aff * 0.45 + r.fam * 0.1 + r.att * 0.15 + (o.likes.includes('chat') ? 4 : 0) + o.trait('extraversion') * 5 + w.rng.randf() * 7;
    score -= dist(c.pos, o.pos) * 0.7;
    if (score > bs) { bs = score; best = o; }
  }
  return best;
}
export function beginChat(w: World, a: SimChar, b: SimChar) {
  if (!canBeApproached(w, b)) { w.abortPlan(a, 'chat unavailable'); a.last_chat = w.clock - 30; return; }
  const rb = w.getRel(b.id, a.id);
  let p = 0.55 + 0.25 * rb.aff / 100 + 0.2 * b.trait('extraversion') + (b.mood / 100) * 0.2;
  if ((b.avoid[a.id] ?? 0) > w.clock) p -= 0.35;
  if (b.state === 'use' && ['tv', 'read'].includes(b.use_act)) p -= 0.12;
  p = Math.max(0.12, Math.min(0.97, p));
  if (w.rng.randf() > p) {
    a.stress += 4; const ra = w.getRel(a.id, b.id); ra.aff = Math.max(-100, ra.aff - 1.5);
    a.avoid[b.id] = w.clock + 90; a.addMemory(w.clock, 'rebuff', `${b.first} m'a envoyé balader.`, -0.3, 0.35, b.id);
    a.statAdd('rebuffed'); w.showEmote(a, 'dots', 2.5); w.emitLog(`${b.first} a repoussé ${a.first}.`, 'social', a.id);
    w.abortPlan(a, 'refused'); a.last_chat = w.clock - 20; return;
  }
  openSession(w, a, b, false);
}
function openSession(w: World, a: SimChar, b: SimChar, ambient: boolean) {
  const id = w.nextSession++; const left = ambient ? w.rng.range(6, 12) : w.rng.range(10, 24);
  w.sessions.set(id, { id, a: a.id, b: b.id, left, total: left, ambient, line: false, emote: 0, turn: 0 });
  for (const x of [a, b]) { x.talking = true; x.talk_session = id; }
  a.talk_with = b.id; b.talk_with = a.id;
  if (!ambient) {
    a.plan = []; a.step = null; a.path = []; a.state = 'chat'; a.pose = 'stand'; a.facing = w.dirFrom({ x: b.pos.x - a.pos.x, y: b.pos.y - a.pos.y }, a.facing);
    if (b.state === 'idle' || b.state === 'walk') {
      b.plan = []; b.step = null; b.path = []; b.state = 'chat'; b.pose = 'stand'; b.facing = w.dirFrom({ x: a.pos.x - b.pos.x, y: a.pos.y - b.pos.y }, b.facing);
    } else if (b.state === 'use' && b.use_furn < 0) b.facing = w.dirFrom({ x: a.pos.x - b.pos.x, y: a.pos.y - b.pos.y }, b.facing);
  }
}
export function updateSessions(w: World, dmin: number) {
  for (const s of [...w.sessions.values()]) {
    const a = w.chars[s.a], b = w.chars[s.b]; let broken = false;
    for (const x of [a, b]) {
      if (x.state !== 'use' && x.state !== 'chat') broken = true;
      if (x.isAsleep()) broken = true;
      if (x.needs.bladder < 7 || x.needs.hunger < 5) broken = true;
    }
    if (dist(a.pos, b.pos) > 3.2) broken = true;
    s.left -= dmin; s.emote -= dmin;
    if (s.emote <= 0 && !broken) {
      s.emote = 2.4; const sp = s.turn % 2 === 0 ? a : b; s.turn++; w.showEmote(sp, 'talk', 1.6);
      if (a.state === 'chat') a.facing = w.dirFrom({ x: b.pos.x - a.pos.x, y: b.pos.y - a.pos.y }, a.facing);
      if (b.state === 'chat') b.facing = w.dirFrom({ x: a.pos.x - b.pos.x, y: a.pos.y - b.pos.y }, b.facing);
    }
    if (s.left <= s.total * 0.6 && !s.line) s.line = true;
    if (s.left <= 0 || broken) endSession(w, s, broken && s.left > 0);
  }
}
function endSession(w: World, s: Session, interrupted: boolean) {
  const a = w.chars[s.a], b = w.chars[s.b]; w.sessions.delete(s.id);
  for (const x of [a, b]) {
    x.talking = false; x.talk_with = -1; x.talk_session = -1;
    if (x.state === 'chat') { x.state = 'idle'; x.pose = 'stand'; x.decision_cooldown = 0.6; }
  }
  let strength = s.ambient ? 0.5 : 1; if (interrupted) strength *= 0.4;
  resolve(w, a, b, strength, s.ambient);
}
function quality(w: World, x: SimChar, y: SimChar): number {
  const r = w.getRel(x.id, y.id);
  const compat = 1 - (Math.abs(x.trait('extraversion') - y.trait('extraversion')) * 0.35 + Math.abs(x.trait('openness') - y.trait('openness')) * 0.3 + Math.abs(x.trait('orderliness') - y.trait('orderliness')) * 0.45);
  let shared = 0;
  for (const l of x.likes) if (y.likes.includes(l)) shared += 0.05;
  for (const l of x.dislikes) if (y.likes.includes(l)) shared -= 0.03;
  let q = 0.3 * compat + (0.3 * (r.aff + 100)) / 200 + (0.15 * (x.mood + 100)) / 200 + 0.12 * y.trait('agreeableness') + 0.02 + shared;
  q -= x.anger * 0.004 + y.anger * 0.003 + r.ten * 0.004 + x.stress * 0.0015;
  q -= Math.max(0, -r.aff - 8) * 0.006;
  q -= x.trait('neuroticism') * x.stress * 0.002;
  q -= Math.max(0, 30 - x.needs.energy) * 0.006; q -= Math.max(0, 30 - x.needs.hunger) * 0.004;
  if (x.trait('extraversion') < 0.4 && x.needs.social > 80) q -= 0.1;
  q -= Math.max(0, 0.55 - Math.min(x.trait('agreeableness'), y.trait('agreeableness'))) * 0.35;
  if (w.mess.length >= 4) q -= 0.05 * x.trait('orderliness');
  if (w.getRel(x.id, y.id).fam < 20) q += 0.12; // entre inconnus, on reste poli
  q += 0.05; // équilibrage : la ville réduit les occasions de conversations agréables (travail, sorties), on garde des disputes plausibles
  q -= Life.grudge(w, x, y); q -= Math.max(0, w.getRel(x.id, y.id).fear - 30) * 0.003; // rancune après une dispute, peur
  return q + w.rng.range(-0.2, 0.2);
}
export function resolve(w: World, a: SimChar, b: SimChar, strength: number, _ambient: boolean) {
  const qa = quality(w, a, b), qb = quality(w, b, a), q = (qa + qb) / 2;
  let kind = 'pleasant';
  if (q < 0.31) kind = 'argument'; else if (q < 0.47) kind = 'awkward'; else if (q >= 0.7) kind = 'great';
  apply(w, a, b, qa, kind, strength); apply(w, b, a, qb, kind, strength);
  for (const x of [a, b]) { x.statAdd('chats'); x.statAdd('chat_' + kind); }
  if (strength >= 0.5 || kind === 'argument') Life.afterChat(w, a, b, kind); // rumeurs échangées / dispute enregistrée comme événement du monde
  w.stats.chats = (w.stats.chats ?? 0) + 1; w.stats['chat_' + kind] = (w.stats['chat_' + kind] ?? 0) + 1;
  if (strength >= 0.5 || kind === 'argument' || kind === 'great') {
    const pool = kind === 'great' ? LINES_GREAT : kind === 'pleasant' ? LINES_OK : kind === 'awkward' ? LINES_BAD : LINES_ARGUE;
    const lines = w.rng.pick(pool); const tag = kind === 'awkward' ? '…' : kind === 'argument' ? '!' : '';
    w.emitLog(`${tag}${a.first} : « ${lines[0]} »`, 'talk', a.id); w.emitLog(`${tag}${b.first} : « ${lines[1]} »`, 'talk', b.id);
  }
  if (kind === 'argument') {
    w.emitLog(`Dispute entre ${a.first} et ${b.first} !`, 'drama', a.id); w.ennui = Math.max(0, w.ennui - 12 * strength);
    w.showEmote(a, 'anger', 3); w.showEmote(b, 'anger', 3);
  } else if (kind === 'great') {
    w.emitLog(`${a.first} et ${b.first} ont une conversation formidable.`, 'social', a.id); w.ennui = Math.max(0, w.ennui - 4 * strength);
    w.showEmote(a, w.getRel(a.id, b.id).att > 25 ? 'heart' : 'smile', 3); w.showEmote(b, w.getRel(b.id, a.id).att > 25 ? 'heart' : 'smile', 3);
  } else if (kind === 'pleasant') w.ennui = Math.max(0, w.ennui - 1.5 * strength);
}
function apply(w: World, x: SimChar, y: SimChar, qx: number, kind: string, mult: number) {
  const r = w.getRel(x.id, y.id);
  let d = (qx - 0.48) * 16; if (kind === 'great') d += 2;
  r.aff = Math.max(-100, Math.min(100, r.aff + d * mult)); r.fam = Math.min(100, r.fam + 2.2 * mult); r.n++;
  if (kind === 'argument') { r.ten = Math.min(100, r.ten + 22 * mult); r.aff = Math.max(-100, r.aff - 6 * mult); }
  else if (kind === 'awkward') r.ten = Math.min(100, r.ten + 4 * mult);
  else r.ten = Math.max(0, r.ten - 5 * mult);
  if ((kind === 'great' || kind === 'pleasant') && x.attracted_to.includes(y.gender)) r.att = Math.max(0, Math.min(100, r.att + Math.max(0, qx - 0.45) * 7 * mult * (0.4 + w.rng.randf())));
  const gain = kind === 'argument' ? 4 : (8 + 32 * qx) * mult;
  x.needs.social = Math.min(100, x.needs.social + gain);
  x.joy = Math.max(0, x.joy + (qx - 0.45) * 34 * mult); x.last_chat = w.clock;
  if (x.trait('extraversion') < 0.4) x.stress = Math.min(100, x.stress + 3 * mult);
  x.addPref('chat', (qx - 0.5) * 0.7 * mult);
  if (kind === 'great') x.addMemory(w.clock, 'chat', `Super conversation avec ${y.first}.`, 0.7, 0.6, y.id);
  else if (kind === 'pleasant') x.addMemory(w.clock, 'chat', `Discussion agréable avec ${y.first}.`, 0.3, 0.3, y.id);
  else if (kind === 'awkward') x.addMemory(w.clock, 'chat', `Échange gênant avec ${y.first}.`, -0.2, 0.3, y.id);
  else {
    x.anger = Math.min(100, x.anger + 30 * mult); x.stress = Math.min(100, x.stress + 14 * mult); x.avoid[y.id] = w.clock + 360;
    x.addMemory(w.clock, 'fight', `Grosse dispute avec ${y.first} !`, -0.9, 0.9, y.id); w.setEmotionFor(x, 'angry', 30);
  }
  if (kind === 'great' || kind === 'pleasant') { goalEvent(w, x, 'chat_ok'); if (kind === 'great') goalEvent(w, x, 'chat_great'); }
}
export function ambient(w: World, dmin: number) {
  w.ambTimer += dmin; if (w.ambTimer < 8) return; w.ambTimer = 0;
  const ok = (x: SimChar) => x.kind === 'resident' && !x.talking && x.state === 'use' && !x.isAsleep() && ['eat', 'feast', 'tv', 'read', 'cook', 'tidy'].includes(x.use_act);
  for (let i = 0; i < w.chars.length; i++) {
    const a = w.chars[i]; if (!ok(a)) continue;
    for (let j = i + 1; j < w.chars.length; j++) {
      const b = w.chars[j]; if (!ok(b) || dist(a.pos, b.pos) > 2.4) continue;
      let p = 0.2 + 0.3 * (a.trait('extraversion') + b.trait('extraversion')) * 0.5 + w.getRel(a.id, b.id).aff / 300;
      if (a.use_act === 'feast') p += 0.35;
      if (w.rng.randf() < p) { openSession(w, a, b, true); break; }
    }
  }
}
export function onMealDone(w: World, c: SimChar) {
  if (c.carry_cook >= 0 && c.carry_cook !== c.id) {
    const cook = w.chars[c.carry_cook]; const r = w.getRel(c.id, cook.id); r.aff = Math.min(100, r.aff + 2.5);
    cook.joy += 8; goalEvent(w, cook, 'shared_meal');
    c.addMemory(w.clock, 'meal', `${cook.first} a cuisiné pour moi, c'était délicieux.`, 0.5, 0.4, cook.id);
    w.emitLog(`${c.first} remercie ${cook.first} pour le repas.`, 'social', c.id);
  }
  c.carry_cook = -1;
}
export function onPrayer(w: World, c: SimChar) {
  c.faith = Math.min(100, c.faith + 2.5); c.stress = Math.max(0, c.stress - 18); c.joy += 4; w.godEnergy = Math.min(100, w.godEnergy + 4);
  w.showEmote(c, 'spark', 3); c.addMemory(w.clock, 'prayer', "Un moment de calme devant l'autel.", 0.3, 0.2);
  if (w.rng.randf() < 0.4) w.emitLog(`${c.first} prie en silence. Vous sentez sa prière.`, 'god', c.id);
  goalEvent(w, c, 'pray');
}
export function goalText(c: SimChar) { const info = GOALS[c.goal.id] ?? { text: '?', target: 1 }; return `${info.text}  (${c.goal.progress}/${info.target})`; }
export function goalEvent(w: World, c: SimChar, kind: string) {
  const g = c.goal; if (g.done) return;
  const info = GOALS[g.id]; const inc = () => (g.progress += 1);
  switch (g.id) {
    case 'friend': if (kind === 'chat_ok' && w.residents.some((o) => o.id !== c.id && w.getRel(c.id, o.id).aff >= 60)) g.progress = 1; break;
    case 'popular': if (kind === 'chat_ok') g.progress = w.residents.filter((o) => o.id !== c.id && w.getRel(c.id, o.id).aff >= 40).length; break;
    case 'cook': if (kind === 'shared_meal') inc(); break;
    case 'read': if (kind === 'read') inc(); break;
    case 'tidy': if (kind === 'tidy') inc(); break;
    case 'fun': if (kind === 'tv') inc(); break;
    case 'respect': if (kind === 'chat_great' || kind === 'chat_ok') inc(); break;
    case 'clean': if (kind === 'shower') inc(); break;
    case 'faith': if (kind === 'pray') inc(); break;
    case 'social': if (kind === 'chat_ok') inc(); break;
  }
  if (g.progress >= info.target) {
    g.done = true; c.joy += 30; w.showEmote(c, 'spark', 4); c.addMemory(w.clock, 'goal', `Objectif atteint : ${info.text}`, 0.9, 0.95); c.statAdd('goals_done');
    w.emitLog(`${c.first} a atteint son objectif : ${info.text}`, 'goal', c.id);
    for (let i = 0; i < 6; i++) {
      const nid = GOAL_CYCLE[c.goal_index % GOAL_CYCLE.length]; c.goal_index++;
      if (nid !== g.id) { c.goal = { id: nid, progress: 0, done: false }; break; }
    }
  }
}
export { NEEDS };
