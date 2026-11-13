/** Bagarres en temps réel dans la ville (« Tekken-lite ») : attaques rapides / puissantes, combos, garde, esquive, endurance, hitboxes en cône, recul, étourdissement, KO.
 *  Tout se passe dans le monde (aucun écran séparé). Le joueur pilote via `input` ; les PNJ par une IA à agressivité / compétence tirées de leur personnalité.
 *  Les conséquences (témoins, police, souvenirs, rancunes) passent par le système de délits existant. L'état de combat est transitoire (non sauvegardé), les blessures et souvenirs le sont. */
import type { V2 } from './defs';
import type { SimChar } from './simchar';
import { dist, type World } from './world';
import { stepBody, lineClear, screenDirToGrid } from './movement';
import * as Crime from './crime';
import * as Combat from './combat';
import * as Quests from './quests';
import * as Debt from './debt';

export type FState = 'idle' | 'windup' | 'active' | 'recover' | 'block' | 'dodge' | 'stun' | 'ko';
export type AtkKind = 'quick' | 'heavy';
export interface Fighter {
  id: number; state: FState; t: number; kind: AtkKind; step: number; comboT: number; hit: boolean; queued: AtkKind | ''; stamina: number; aim: V2; guard: boolean;
  dodgeDir: V2; dodgeCd: number; foes: Set<number>; target: number; ai: { aggr: number; skill: number } | null; think: number; atkCd: number; lastAction: number; fled: boolean; whiffed: number; stunFor?: number;
}
export interface FightFx { type: 'hit' | 'block' | 'dodge' | 'ko' | 'whiff' | 'guardbreak' | 'bolt'; x: number; y: number; heavy: boolean; att: number; tgt: number }
/** Réglages d'équilibrage (secondes de simulation). */
export const T = {
  quick: { wind: 0.1, active: 0.08, rec: 0.24, dmg: 6, stun: 0.3, range: 1.3, cost: 7, push: 0.45 },
  heavy: { wind: 0.34, active: 0.1, rec: 0.48, dmg: 13, stun: 0.55, range: 1.6, cost: 17, push: 0.95 },
  comboWin: 0.5, comboCancel: 0.1, dodgeT: 0.32, dodgeI: 0.22, dodgeDist: 1.5, dodgeCd: 0.55, dodgeCost: 12, arc: 0.5, body: 0.34, stamMax: 100, regen: 20, blockRegen: 6, blockDmg: 0.2, exitAfter: 6,
};
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const norm = (v: V2): V2 => { const n = Math.hypot(v.x, v.y); return n < 1e-6 ? { x: 1, y: 0 } : { x: v.x / n, y: v.y / n }; };
export const get = (w: World, id: number) => w.fighters.get(id);
export const active = (w: World, c: SimChar) => w.fighters.has(c.id);
export const playerFighting = (w: World) => w.fighters.has(w.avatar.id);

/** Profil d'IA : agressivité et compétence selon la personnalité (peu conciliant / peu anxieux → plus offensif et plus habile). */
export function profile(c: SimChar): { aggr: number; skill: number } {
  const special: Record<string, { aggr: number; skill: number }> = { 'Victor Kane': { aggr: 0.8, skill: 0.78 }, 'Tommy Blake': { aggr: 0.55, skill: 0.4 } };
  if (special[c.name]) return special[c.name];
  return { aggr: clamp(0.3 + (1 - c.trait('agreeableness')) * 0.4 + (c.anger / 100) * 0.2 + (c.drunk > 30 ? 0.1 : 0), 0.15, 0.95), skill: clamp(0.2 + (1 - c.trait('neuroticism')) * 0.3 + c.trait('orderliness') * 0.15 + (c.kind === 'police' ? 0.2 : 0), 0.15, 0.85) };
}
const mkFighter = (w: World, c: SimChar, ai: boolean): Fighter => ({ id: c.id, state: 'idle', t: 0, kind: 'quick', step: 0, comboT: 0, hit: false, queued: '', stamina: T.stamMax, aim: { x: 1, y: 0 }, guard: false, dodgeDir: { x: 1, y: 0 }, dodgeCd: 0, foes: new Set(), target: -1, ai: ai ? profile(c) : null, think: 0.2 + w.rng.randf() * 0.3, atkCd: 0.4, lastAction: 0, fled: false, whiffed: 0 });

/** Déclenche une bagarre entre deux personnages : chacun devient combattant, les passants réagissent, le délit est enregistré. */
export function start(w: World, a: SimChar, b: SimChar, reason = ''): boolean {
  const ok = (c: SimChar) => c.kind === 'avatar' || c.kind === 'resident' || c.kind === 'citizen';
  if (a.id === b.id || !ok(a) || !ok(b) || a.away || b.away || a.state === 'ko' || b.state === 'ko' || w.jail) return false;
  for (const [x, y] of [[a, b], [b, a]] as [SimChar, SimChar][]) {
    let f = w.fighters.get(x.id); const fresh = !f;
    if (!f) { f = mkFighter(w, x, x.kind !== 'avatar'); w.fighters.set(x.id, f); w.abortPlan(x, 'fight'); if (x.state === 'use') w.endUse(x, false); x.state = 'idle'; x.talking = false; x.talk_with = -1; x.plan = []; }
    f.foes.add(y.id); if (f.target < 0 || fresh) f.target = y.id; f.lastAction = w.clock; f.aim = norm({ x: y.pos.x - x.pos.x, y: y.pos.y - x.pos.y });
  }
  panic(w, a, b);
  if (reason) w.emitLog(reason, 'drama', a.id);
  w.audio?.push('fight');
  return true;
}
/** Les passants réagissent : les peureux fuient, les autres regardent. La police est prévenue par le système de délits au premier coup. */
function panic(w: World, a: SimChar, b: SimChar) {
  for (const o of Crime.viewers(w, a.pos, [a.id, b.id], 8)) {
    if (o.kind === 'police' || w.fighters.has(o.id) || o.state === 'ko') continue; const brave = Combat.courage(o);
    if (brave < 0.5) { w.showEmote(o, 'sweat', 3); flee(w, o, a.pos); } else w.showEmote(o, 'alert', 3);
  }
}
function flee(w: World, c: SimChar, from: V2) {
  const dx = c.pos.x - from.x, dy = c.pos.y - from.y, d = Math.hypot(dx, dy) || 1; const cell = w.nearestFreeCell({ x: Math.floor(c.pos.x + (dx / d) * 12), y: Math.floor(c.pos.y + (dy / d) * 12) }, 6);
  w.abortPlan(c, 'panic'); c.action_text = 'Prend la fuite'; if (cell.x >= 0) { c.plan = [{ type: 'goto', cell } as any]; w.startNextStep(c); } c.decision_cooldown = 8;
}
export function end(w: World, c: SimChar) { const f = w.fighters.get(c.id); if (!f) return; w.fighters.delete(c.id); for (const o of w.fighters.values()) o.foes.delete(c.id); if (c.state !== 'ko') { c.pose = 'stand'; } c.decision_cooldown = 0.5; }

const foesAlive = (w: World, f: Fighter) => [...f.foes].map((id) => w.chars[id]).filter((o) => o && !o.away && o.state !== 'ko' && w.fighters.has(o.id));
/** Cible : la plus proche dans le cône de visée (joueur) ou l'ennemi courant (IA). */
export function targetOf(w: World, c: SimChar): SimChar | null {
  const f = w.fighters.get(c.id); if (!f) return null; const foes = foesAlive(w, f); if (!foes.length) return null;
  const cur = foes.find((o) => o.id === f.target); if (cur && dist(cur.pos, c.pos) < 4) return cur;
  foes.sort((p, q) => dist(p.pos, c.pos) - dist(q.pos, c.pos)); f.target = foes[0].id; return foes[0];
}

// ------------------------------------------------------------------ commandes (joueur et IA)
const setState = (f: Fighter, s: FState) => { f.state = s; f.t = 0; };
const free = (f: Fighter) => f.state === 'idle' || f.state === 'block';
/** Attaque : démarre une frappe si l'état le permet (ou enchaîne un combo pendant la récupération). Retourne vrai si la commande est prise en compte. */
export function attack(w: World, c: SimChar, kind: AtkKind): boolean {
  const f = w.fighters.get(c.id); if (!f) return false; const spec = T[kind];
  if (f.state === 'stun' || f.state === 'ko' || f.state === 'dodge') return false;
  if (f.stamina < spec.cost) { if (!f.ai && w.rng.randf() < 1) w.showEmote(c, 'sweat', 1); return false; }
  if (f.state === 'windup' || f.state === 'active') { if (f.state === 'windup' || f.t < 0.05) f.queued = kind; return true; }
  if (f.state === 'recover') { if (f.comboT > 0 && f.t >= T.comboCancel) { f.step = Math.min(3, f.step + 1); startAttack(w, c, f, kind, true); return true; } f.queued = kind; return true; }
  if (f.state === 'idle' || f.state === 'block') { f.step = 1; startAttack(w, c, f, kind, false); return true; }
  return false;
}
function startAttack(w: World, c: SimChar, f: Fighter, kind: AtkKind, cancel: boolean) {
  f.kind = kind; f.hit = false; f.queued = ''; f.guard = false; f.stamina -= T[kind].cost; setState(f, 'windup'); if (cancel) f.t = T[kind].wind * 0.5;   // enchaîné : démarre plus vite
  const tg = targetOf(w, c); if (tg) f.aim = norm({ x: tg.pos.x - c.pos.x, y: tg.pos.y - c.pos.y }); c.facing = w.dirFrom(f.aim, c.facing); f.lastAction = w.clock; w.audio?.push('swish');
}
export function guard(w: World, c: SimChar, on: boolean) { const f = w.fighters.get(c.id); if (!f) return; f.guard = on; if (on && f.state === 'idle') setState(f, 'block'); if (!on && f.state === 'block') setState(f, 'idle'); }
/** Esquive : dash bref dans la direction demandée (grille), invulnérable un court instant. */
export function dodge(w: World, c: SimChar, dir?: V2): boolean {
  const f = w.fighters.get(c.id); if (!f || f.dodgeCd > 0 || f.stamina < T.dodgeCost || !(free(f) || f.state === 'recover')) return false;
  f.stamina -= T.dodgeCost; f.dodgeDir = dir && Math.hypot(dir.x, dir.y) > 0.1 ? norm(dir) : { x: -f.aim.x, y: -f.aim.y }; f.dodgeCd = T.dodgeCd; f.guard = false; f.queued = ''; setState(f, 'dodge'); f.lastAction = w.clock; return true;
}
/** Entrée du joueur (A rapide, A maintenu, B garde, B + direction esquive). */
export function input(w: World, cmd: 'quick' | 'heavy' | 'guard_on' | 'guard_off' | 'dodge', dir?: V2): boolean {
  const av = w.avatar; if (!w.fighters.has(av.id)) return false;
  switch (cmd) { case 'quick': return attack(w, av, 'quick'); case 'heavy': return attack(w, av, 'heavy'); case 'guard_on': guard(w, av, true); return true; case 'guard_off': guard(w, av, false); return true; case 'dodge': return dodge(w, av, dir); }
}
/** Le joueur engage la bagarre avec la personne la plus proche devant lui (clavier : touche d'attaque hors combat). */
export function initiate(w: World, att: SimChar, tgt?: SimChar): boolean {
  const t = tgt ?? w.chars.filter((o) => o.id !== att.id && !o.away && (o.kind === 'resident' || o.kind === 'citizen') && dist(o.pos, att.pos) < 2.2 && lineClear(att.pos, o.pos)).sort((a, b) => dist(a.pos, att.pos) - dist(b.pos, att.pos))[0];
  if (!t || t.kind === 'police') return false; if (!w.fighters.has(t.id)) { t.anger = Math.min(100, t.anger + 30); }
  const r = w.getRel(t.id, att.id); r.aff = clamp(r.aff - 20, -100, 100); r.ten = clamp(r.ten + 25, 0, 100);
  const ok = start(w, att, t, `${att.kind === 'avatar' ? 'Vous cherchez' : att.first + ' cherche'} la bagarre avec ${t.first}.`); if (ok && att.kind === 'avatar') Quests.emit(w, 'fight'); return ok;
}

// ------------------------------------------------------------------ résolution des coups
function applyHit(w: World, att: SimChar, af: Fighter, tgt: SimChar, tf: Fighter) {
  const spec = T[af.kind]; const finisher = af.kind === 'quick' && af.step >= 3; let dmg = spec.dmg * (af.kind === 'quick' ? [1, 1.25, 1.9][af.step - 1] ?? 1 : 1) * (0.88 + w.rng.randf() * 0.24); dmg += (att.look.build > 0 ? 1.5 : 0) - (tgt.look.build > 0 ? 1 : 0);
  const toAtt = norm({ x: att.pos.x - tgt.pos.x, y: att.pos.y - tgt.pos.y }); const heavy = af.kind === 'heavy' || finisher; const mid = { x: tgt.pos.x, y: tgt.pos.y };
  // esquive : invulnérable
  if (tf.state === 'dodge' && tf.t < T.dodgeI) { w.fightFx.push({ type: 'dodge', x: mid.x, y: mid.y, heavy: false, att: att.id, tgt: tgt.id }); w.showEmote(tgt, 'spark', 1); tf.whiffed++; af.hit = true; w.stats.fight_dodges = (w.stats.fight_dodges ?? 0) + 1; return; }
  // garde : de face seulement
  const front = tf.state === 'block' && (tf.aim.x * -toAtt.x + tf.aim.y * -toAtt.y) < 0.2;   // la garde regarde vers l'attaquant
  const blocking = tf.state === 'block' && ((tf.aim.x * toAtt.x + tf.aim.y * toAtt.y) > 0.1 || front);
  af.hit = true; w.stats.fight_hits = (w.stats.fight_hits ?? 0) + 1;
  if (blocking) {
    w.stats.fight_blocks = (w.stats.fight_blocks ?? 0) + 1;
    tf.stamina -= heavy ? 24 : 11; tgt.hp = Math.max(1, tgt.hp - dmg * T.blockDmg); push(w, tgt, toAtt, -0.2); w.fightFx.push({ type: 'block', x: mid.x, y: mid.y, heavy, att: att.id, tgt: tgt.id }); w.audio?.push('block');
    if (tf.stamina <= 0) { tf.stamina = 0; setState(tf, 'stun'); tf.guard = false; w.fightFx.push({ type: 'guardbreak', x: mid.x, y: mid.y, heavy: true, att: att.id, tgt: tgt.id }); w.showEmote(tgt, 'sweat', 2); }
    af.comboT = 0; return;
  }
  tgt.hp = Math.max(0, tgt.hp - dmg); tgt.stress += 6; tgt.anger = clamp(tgt.anger + 12, 0, 100);
  if (tf.state === 'windup' || tf.state === 'active' || tf.state === 'recover' || tf.state === 'idle' || tf.state === 'block') { setState(tf, 'stun'); tf.guard = false; tf.queued = ''; tf.step = 0; tf.comboT = 0; }
  tf.t = 0; tf.stunFor = finisher ? 0.7 : spec.stun; push(w, tgt, toAtt, -(finisher ? 1.15 : spec.push));
  w.fightFx.push({ type: 'hit', x: mid.x, y: mid.y, heavy, att: att.id, tgt: tgt.id }); w.audio?.push(heavy ? 'hit_heavy' : 'hit'); w.showEmote(tgt, 'anger', 1.2);
  af.comboT = T.comboWin; af.lastAction = w.clock; tf.lastAction = w.clock;
  // conséquences : relation, souvenir (une fois par échange), délit enregistré (témoins, police)
  const r = w.getRel(tgt.id, att.id); r.aff = clamp(r.aff - 4, -100, 100); r.fear = clamp(r.fear + 2, 0, 100);
  if (!(tgt.stats['assault_mem_' + att.id] > w.clock - 15)) { tgt.stats['assault_mem_' + att.id] = w.clock; tgt.addMemory(w.clock, 'assault', `${att.kind === 'avatar' ? "Quelqu'un" : att.first} m'a frappé(e).`, -0.9, 1, att.id, { src: 'lived', conf: 1, subj: att.id }); }
  if (!(att.stats['assault_ev_' + tgt.id] > w.clock - 20)) { att.stats['assault_ev_' + tgt.id] = w.clock; Crime.onCrime(w, att, 'assault', tgt.id, { ...tgt.pos }, 2); if (att.kind === 'avatar') { w.record_.assaults = (w.record_.assaults ?? 0) + 1; Quests.emit(w, 'assault'); Debt.rep(w, 'criminal', 1); Debt.rep(w, 'police', -1); Debt.rep(w, 'social', -0.5); } }
  if (tgt.hp <= 0) { Combat.knockOut(w, tgt, att); w.fightFx.push({ type: 'ko', x: mid.x, y: mid.y, heavy: true, att: att.id, tgt: tgt.id }); w.audio?.push('ko'); end(w, tgt); af.foes.delete(tgt.id); af.step = 0; af.comboT = 0; }
}
function push(w: World, c: SimChar, dir: V2, d: number) {
  const dd = -d; const sign = d < 0 ? 1 : -1; const steps = 4; for (let i = 0; i < steps; i++) { c.pos = stepBody(w, c.pos, dir.x * sign * dd / steps * 1, dir.y * sign * dd / steps * 1, w.chars.filter((o) => o.id !== c.id && !o.away).map((o) => o.pos), 0.3); }
}
/** Le coup est « actif » : vérifie la zone en cône devant l'attaquant (portée + angle) et touche la meilleure cible. */
function resolveStrike(w: World, att: SimChar, af: Fighter) {
  const spec = T[af.kind]; let best: SimChar | null = null, bd = 1e9;
  for (const o of w.chars) {
    if (o.id === att.id || o.away || o.state === 'enter' || o.state === 'exit' || o.state === 'ko' || !w.fighters.has(o.id)) continue; if (!af.foes.has(o.id)) continue;
    const dx = o.pos.x - att.pos.x, dy = o.pos.y - att.pos.y, d = Math.hypot(dx, dy); if (d > spec.range + T.body) continue;
    const dot = (dx * af.aim.x + dy * af.aim.y) / (d || 1); if (dot < T.arc && d > 0.5) continue; if (!lineClear(att.pos, o.pos)) continue;
    if (d < bd) { bd = d; best = o; }
  }
  if (!best) { w.fightFx.push({ type: 'whiff', x: att.pos.x + af.aim.x * 0.8, y: att.pos.y + af.aim.y * 0.8, heavy: af.kind === 'heavy', att: att.id, tgt: -1 }); af.hit = true; af.comboT = 0; af.step = 0; return; }
  applyHit(w, att, af, best, w.fighters.get(best.id)!);
}

// ------------------------------------------------------------------ mise à jour
/** Avance les minuteries de tous les combattants et résout les coups. `dt` en secondes de simulation. */
export function tick(w: World, dt: number) {
  if (w.fighters.size === 0) return; let rem = Math.min(dt, 0.5); while (rem > 1e-6) { const s = Math.min(rem, 0.05); step(w, s); rem -= s; }
}
function step(w: World, dt: number) {
  for (const [id, f] of [...w.fighters]) {
    const c = w.chars[id]; if (!c || c.away || c.state === 'ko' || w.jail) { w.fighters.delete(id); continue; }
    f.t += dt; f.dodgeCd = Math.max(0, f.dodgeCd - dt); f.comboT = Math.max(0, f.comboT - dt); if (f.comboT <= 0 && f.state !== 'recover' && f.state !== 'windup' && f.state !== 'active') f.step = 0;
    f.stamina = clamp(f.stamina + (f.state === 'block' ? T.blockRegen : f.state === 'idle' ? T.regen : f.state === 'recover' ? 6 : 0) * dt, 0, T.stamMax);
    switch (f.state) {
      case 'windup': if (f.t >= T[f.kind].wind) { setState(f, 'active'); resolveStrike(w, c, f); } break;
      case 'active': if (f.t >= T[f.kind].active) setState(f, 'recover'); break;
      case 'recover': if (f.t >= T[f.kind].rec) { if (f.queued && f.stamina >= T[f.queued].cost && f.comboT > 0) { const k = f.queued; f.step = Math.min(3, f.step + 1); startAttack(w, c, f, k, true); } else { f.queued = ''; setState(f, f.guard ? 'block' : 'idle'); } } break;
      case 'stun': if (f.t >= (f.stunFor ?? 0.3)) { setState(f, f.guard ? 'block' : 'idle'); } break;
      case 'dodge': { const sp = T.dodgeDist / T.dodgeT; c.pos = stepBody(w, c.pos, f.dodgeDir.x * sp * dt, f.dodgeDir.y * sp * dt, [], 0.3); if (f.t >= T.dodgeT) setState(f, f.guard ? 'block' : 'idle'); break; }
    }
    c.pose = poseOf(f, c);
    if (c.kind !== 'avatar') ai(w, c, f, dt);
    // sortie du combat : plus d'ennemi debout à portée, ou inactivité
    const foes = foesAlive(w, f); const near = foes.some((o) => dist(o.pos, c.pos) < 9);
    if (!foes.length || (c.kind === 'avatar' && !near && w.clock - f.lastAction > 0.1) || (w.clock - f.lastAction) * 60 > T.exitAfter * 60 * 3) end(w, c);
  }
}
/** Pose du sprite selon l'état de combat. */
function poseOf(f: Fighter, c: SimChar): string {
  switch (f.state) {
    case 'windup': return f.kind === 'heavy' ? 'f_h_wind' : 'f_q_wind'; case 'active': return f.kind === 'heavy' ? 'f_h_ext' : 'f_q_ext'; case 'recover': return f.kind === 'heavy' ? 'f_h_ext' : 'f_q_ext';
    case 'block': return 'f_guard'; case 'dodge': return 'f_dodge'; case 'stun': return 'f_hurt'; default: return c.pose === 'walk' ? 'walk' : 'f_stance';
  }
}
/** Marche du joueur en combat : vitesse réduite en garde, immobile pendant un coup. Retourne le multiplicateur de vitesse (0 = bloqué). */
export function moveMult(w: World, c: SimChar): number {
  const f = w.fighters.get(c.id); if (!f) return 1; switch (f.state) { case 'windup': case 'active': return 0.25; case 'recover': return 0.5; case 'stun': case 'dodge': return 0; case 'block': return 0.55; default: return 0.9; }
}
/** Met à jour l'orientation de visée du joueur d'après son déplacement. */
export function aimAvatar(w: World, c: SimChar, gx: number, gy: number) { const f = w.fighters.get(c.id); if (f && (f.state === 'idle' || f.state === 'block') && Math.hypot(gx, gy) > 0.1) f.aim = norm({ x: gx, y: gy }); }

// ------------------------------------------------------------------ IA adverse
function ai(w: World, c: SimChar, f: Fighter, dt: number) {
  if (!f.ai) return; f.atkCd = Math.max(0, f.atkCd - dt); f.think -= dt; const foe = targetOf(w, c); if (!foe) return;
  const ff = w.fighters.get(foe.id)!; const d = dist(foe.pos, c.pos); const toFoe = norm({ x: foe.pos.x - c.pos.x, y: foe.pos.y - c.pos.y });
  if (f.state === 'idle' || f.state === 'block') f.aim = toFoe; c.facing = w.dirFrom(f.state === 'idle' ? toFoe : f.aim, c.facing);
  // fuite : peu de PV, peu d'agressivité
  if (c.hp < 10 + (1 - f.ai.aggr) * 20 && f.state !== 'stun' && !f.fled) { f.fled = true; w.emitLog(`${c.first} en a assez et prend la fuite.`, 'drama', c.id); const foes = [...f.foes]; end(w, c); for (const id of foes) { const o = w.chars[id]; if (o) { const of = w.fighters.get(o.id); of?.foes.delete(c.id); } } flee(w, c, foe.pos); return; }
  if (f.state === 'stun' || f.state === 'windup' || f.state === 'active' || f.state === 'dodge') return;
  // réaction défensive à une attaque adverse imminente
  if (f.think <= 0) {
    f.think = 0.16 + w.rng.randf() * 0.2;
    if ((ff.state === 'windup') && d < 2.2) { if (w.rng.randf() < f.ai.skill * 0.4) { dodge(w, c, { x: -toFoe.x + (w.rng.randf() - 0.5), y: -toFoe.y + (w.rng.randf() - 0.5) }); return; } if (w.rng.randf() < f.ai.skill * 0.7) { guard(w, c, true); f.think = 0.5; return; } }
    else if (f.guard && ff.state !== 'active') { if (w.rng.randf() < 0.55) guard(w, c, false); }
  }
  if (f.state === 'block' && f.guard) return;
  if (f.state === 'recover') { if (f.comboT > 0 && f.step < 3 && f.t >= T.comboCancel && w.rng.randf() < f.ai.skill * 1.4 * dt * 6) attack(w, c, 'quick'); return; }
  // approche / recul
  if (d > T[ f.step ? 'quick' : 'quick'].range + 0.1) { const sp = 2.1 * (0.7 + f.ai.aggr * 0.5) * dt; c.pos = stepBody(w, c.pos, toFoe.x * sp, toFoe.y * sp, w.chars.filter((o) => o.id !== c.id && o.id !== foe.id && !o.away).map((o) => o.pos), 0.3); c.pose = 'walk'; return; }
  if (d < 0.8 && w.rng.randf() < 0.02) { const sp = 1.4 * dt; c.pos = stepBody(w, c.pos, -toFoe.x * sp, -toFoe.y * sp, [], 0.3); }
  // attaque
  if (f.atkCd <= 0 && w.rng.randf() < f.ai.aggr * dt * 3.2) { const heavy = w.rng.randf() < 0.18 + f.ai.aggr * 0.12 && f.stamina > 30; if (attack(w, c, heavy ? 'heavy' : 'quick')) f.atkCd = (1.05 - f.ai.aggr * 0.55) + w.rng.randf() * 0.5; }
}
