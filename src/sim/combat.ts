/** Combat de base (fiction adulte) : coups de poing, blessures réelles, KO, riposte ou fuite selon la personnalité, témoins et police via le système de délits.
 *  Aucune arme pour l'instant. Les PNJ blessés récupèrent lentement ; l'avatar mis KO se réveille chez lui, plus pauvre. */
import type { V2 } from './defs';
import type { SimChar } from './simchar';
import { dist, type World } from './world';
import * as Crime from './crime';
import * as Quests from './quests';
import { lineClear } from './movement';

export interface Fight { a: number; b: number; t: number; rounds: number }
export const REACH = 1.9, COOLDOWN = 0.9;
const nm = (c: SimChar) => (c.kind === 'avatar' ? 'vous' : c.first);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
/** Courage : rapport à la violence (peu névrosé, peu conciliant → riposte). */
export const courage = (c: SimChar) => clamp(0.5 * (1 - c.trait('neuroticism')) + 0.5 * (1 - c.trait('agreeableness')) + (c.anger > 40 ? 0.2 : 0), 0, 1);
export const isKO = (c: SimChar) => c.state === 'ko';

export function canFight(w: World, att: SimChar, tgt: SimChar): string {
  if (att.id === tgt.id) return 'Impossible.'; if (tgt.away) return 'Il n\'est pas là.'; if (isKO(att)) return 'Vous êtes à terre.';
  if (tgt.kind === 'police') return 'Frapper un agent… vous n\'êtes pas prêt(e) à en payer le prix.'; if (w.jail) return 'Pas en garde à vue.';
  if (dist(att.pos, tgt.pos) > REACH || !lineClear(att.pos, tgt.pos)) return 'Trop loin pour frapper.';
  if ((att.stats.punch_at ?? -1e9) > w.clock - COOLDOWN / 4) return 'Trop tôt pour un nouveau coup.'; return '';
}

/** `att` frappe `tgt` : dégâts, mémoire, relation, témoins, riposte. */
export function punch(w: World, att: SimChar, tgt: SimChar): { ok: boolean; line: string; dmg: number } {
  const why = canFight(w, att, tgt); if (why) return { ok: false, line: why, dmg: 0 };
  att.stats.punch_at = w.clock; att.statAdd('punches');
  const dmg = Math.round(clamp(7 + w.rng.randf() * 9 + (att.look.build > 0 ? 3 : 0) - (tgt.look.build > 0 ? 2 : 0), 4, 20));
  tgt.hp = Math.max(0, tgt.hp - dmg); tgt.stress += 15; tgt.anger = clamp(tgt.anger + 40, 0, 100); w.showEmote(tgt, 'anger', 2.5); w.showEmote(att, 'anger', 1.5);
  if (tgt.isAsleep()) w.endUse(tgt, false);
  if (att.kind !== 'avatar') att.facing = tgt.pos.x >= att.pos.x ? 1 : -1; tgt.facing = att.pos.x >= tgt.pos.x ? 1 : -1;
  const r = w.getRel(tgt.id, att.id); r.aff = clamp(r.aff - 35, -100, 100); r.fear = clamp(r.fear + 18, 0, 100); r.fam = Math.max(r.fam, 8);
  tgt.addMemory(w.clock, 'assault', `${att.kind === 'avatar' ? "Quelqu'un" : att.first} m'a frappé(e).`, -0.9, 1, att.id, { src: 'lived', conf: 1, subj: att.id });
  Crime.onCrime(w, att, 'assault', tgt.id, { ...tgt.pos }, 2);
  if (att.kind === 'avatar') { Quests.emit(w, 'assault'); w.record_.assaults = (w.record_.assaults ?? 0) + 1; w.stats.punches = (w.stats.punches ?? 0) + 1; }
  w.emitLog(`${att.kind === 'avatar' ? 'Vous frappez' : att.first + ' frappe'} ${tgt.kind === 'avatar' ? 'vous' : tgt.first} (−${dmg} PV).`, 'drama', tgt.id);
  if (tgt.hp <= 0) knockOut(w, tgt, att);
  else if (tgt.kind !== 'avatar' && tgt.kind !== 'police') react(w, tgt, att);
  return { ok: true, line: tgt.hp <= 0 ? `${tgt.kind === 'avatar' ? 'Vous' : tgt.first} s'effondre${tgt.kind === 'avatar' ? 'z' : ''}.` : `Coup au visage : −${dmg} PV.`, dmg };
}
function react(w: World, tgt: SimChar, att: SimChar) {
  if (w.fights.some((f) => f.a === tgt.id && f.b === att.id)) return;
  const fightBack = tgt.kind !== 'clerk' && w.rng.randf() < courage(tgt) * 0.95 && tgt.hp > 25;
  w.abortPlan(tgt, 'fight'); if (tgt.state === 'chat') { tgt.state = 'idle'; tgt.talk_with = -1; }
  if (fightBack) { w.fights.push({ a: tgt.id, b: att.id, t: 0.8, rounds: 0 }); tgt.action_text = `Riposte contre ${att.kind === 'avatar' ? 'vous' : att.first}`; w.emitLog(`${tgt.first} riposte !`, 'drama', tgt.id); }
  else flee(w, tgt, att.pos);
}
function flee(w: World, c: SimChar, from: V2) {
  const dx = c.pos.x - from.x, dy = c.pos.y - from.y, d = Math.hypot(dx, dy) || 1; const cell = w.nearestFreeCell({ x: Math.floor(c.pos.x + (dx / d) * 12), y: Math.floor(c.pos.y + (dy / d) * 12) }, 6);
  w.showEmote(c, 'sweat', 3); c.action_text = 'Prend la fuite'; if (cell.x >= 0) { c.plan = [{ type: 'goto', cell } as any]; w.startNextStep(c); } c.decision_cooldown = 8;
}
export function knockOut(w: World, c: SimChar, by?: SimChar) {
  w.fights = w.fights.filter((f) => f.a !== c.id && f.b !== c.id);
  w.emitLog(`${c.kind === 'avatar' ? 'Vous perdez connaissance' : c.first + ' est assommé(e)'}.`, 'drama', c.id);
  if (c.kind === 'avatar') { faint(w, c); return; }
  w.abortPlan(c, 'ko'); c.state = 'ko'; c.pose = 'lie'; c.action_text = 'Assommé(e)'; c.ko_until = w.clock + 25; c.hp = 0; w.showEmote(c, 'sweat', 4);
  if (by) c.addMemory(w.clock, 'assault', `${by.kind === 'avatar' ? "Quelqu'un" : by.first} m'a mis(e) KO.`, -1, 1, by.id, { src: 'lived', conf: 1, subj: by.id });
}
/** L'avatar est mis KO : il se réveille dans l'entrée de son immeuble, plus pauvre (on l'a dépouillé), à moitié en forme. */
function faint(w: World, av: SimChar) {
  const lost = Math.min(av.money, Math.round(av.money * 0.15)); av.money -= lost; av.hp = 40; w.input = { dx: 0, dy: 0, run: false } as any; w.abortPlan(av, 'ko');
  const cell = w.nearestFreeCell({ x: 62, y: 33 }, 3); if (cell.x >= 0) av.pos = { x: cell.x + 0.5, y: cell.y + 0.5 };
  w.fights = []; w.emitLog(`Vous reprenez connaissance devant chez vous. ${lost > 0 ? `Il manque ${lost} € dans vos poches.` : ''}`.trim(), 'info', av.id); w.record_.knockouts = (w.record_.knockouts ?? 0) + 1;
}

/** Avance les bagarres en cours, les KO et la guérison lente. `dt` en secondes réelles, `dmin` en minutes de jeu. */
export function tick(w: World, dt: number, dmin: number) {
  for (const c of w.chars) {
    if (c.state === 'ko' && w.clock >= c.ko_until) { c.state = 'idle'; c.pose = 'stand'; c.hp = 30; c.decision_cooldown = 1; w.emitLog(`${c.first} se relève, groggy.`, 'info', c.id); }
    if (c.hp < 100 && c.hp > 0 && c.state !== 'ko') c.hp = Math.min(100, c.hp + 0.35 * dmin);
  }
  for (const f of [...w.fights]) {
    const a = w.chars[f.a], b = w.chars[f.b]; if (!a || !b || a.away || b.away || isKO(a) || isKO(b) || f.rounds >= 4) { w.fights = w.fights.filter((x) => x !== f); continue; }
    f.t -= dt; if (f.t > 0) continue; f.t = COOLDOWN;
    if (dist(a.pos, b.pos) > REACH) { const c = { x: Math.floor(b.pos.x), y: Math.floor(b.pos.y) }; if (a.state !== 'walk') { a.plan = [{ type: 'goto', cell: c } as any]; w.startNextStep(a); } f.t = 0.5; continue; }
    f.rounds++; const r = punch(w, a, b); if (!r.ok) { f.rounds = 9; }
    if (a.hp < 22 && a.kind !== 'avatar') { w.fights = w.fights.filter((x) => x !== f); flee(w, a, b.pos); }
  }
}
