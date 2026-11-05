/** Sauvegarde JSON versionnée dans localStorage. */
import { World } from './world';
import { NEEDS } from './defs';
import { poseFor } from './world';
import { ACT } from './defs';

export const SAVE_VERSION = 1;
export const SAVE_KEY = 'god-is-bored:slot1';

export function toJSON(w: World) {
  return {
    version: SAVE_VERSION, seed: w.seed, clock: w.clock, godEnergy: w.godEnergy, ennui: w.ennui, pot: w.pot, potCook: w.potCook, potTime: w.potTime,
    feastUntil: w.feastUntil, musicUntil: w.musicUntil, knownSecrets: w.knownSecrets, avatarControlled: w.avatarControlled, nextMessId: w.nextMessId, rng: w.rng.state, stats: w.stats,
    rel: [...w.rel.entries()], furn: w.furn.map((f) => ({ water: f.water })), mess: w.mess.map((m) => ({ ...m })),
    journal: w.journal.slice(-60),
    chars: w.chars.map((c) => ({
      id: c.id, pos: c.pos, facing: c.facing, needs: c.needs, joy: c.joy, stress: c.stress, anger: c.anger, faith: c.faith, wake_target: c.wake_target,
      slept_min: c.slept_min, last_shower: c.last_shower, last_chat: c.last_chat, last_meal: c.last_meal, carry: c.carry, carry_cook: c.carry_cook,
      avoid: c.avoid, pref: c.pref, memories: c.memories, goal: c.goal, goal_index: c.goal_index, stats: c.stats,
      state: c.state, away: c.away, money: c.money, inventory: c.inventory, drunk: c.drunk, use_furn: c.use_furn, use_slot: c.use_slot, use_act: c.use_act, use_left: c.use_left,
    })),
  };
}
export function fromJSON(d: any): World | null {
  if (!d || d.version !== SAVE_VERSION) return null;
  const w = new World(d.seed); w.build(); w.journal = [];
  w.clock = d.clock; w.lastDay = w.day(); w.godEnergy = d.godEnergy; w.ennui = d.ennui; w.pot = d.pot; w.potCook = d.potCook; w.potTime = d.potTime;
  w.feastUntil = d.feastUntil; w.musicUntil = d.musicUntil ?? -1; w.knownSecrets = d.knownSecrets ?? []; w.avatarControlled = !!d.avatarControlled; w.nextMessId = d.nextMessId; w.rng.state = d.rng; w.stats = { ...d.stats };
  w.rel = new Map(d.rel);
  d.furn.forEach((f: any, i: number) => { if (w.furn[i]) w.furn[i].water = f.water; });
  w.mess = d.mess.map((m: any) => ({ ...m }));
  for (const f of w.furn) f.users = f.users.map(() => -1);
  for (const cd of d.chars) {
    const c = w.chars[cd.id]; if (!c) continue;
    c.away = cd.away ?? c.away; c.money = cd.money ?? c.money; c.inventory = cd.inventory ? { ...cd.inventory } : c.inventory; c.drunk = cd.drunk ?? 0;
    Object.assign(c, { pos: { ...cd.pos }, facing: cd.facing, joy: cd.joy, stress: cd.stress, anger: cd.anger, faith: cd.faith, wake_target: cd.wake_target, slept_min: cd.slept_min,
      last_shower: cd.last_shower, last_chat: cd.last_chat, last_meal: cd.last_meal, carry: cd.carry, carry_cook: cd.carry_cook,
      avoid: { ...cd.avoid }, pref: { ...cd.pref }, memories: cd.memories.map((m: any) => ({ ...m })), goal: { ...cd.goal }, goal_index: cd.goal_index, stats: { ...cd.stats } });
    for (const n of NEEDS) c.needs[n] = cd.needs[n];
    c.plan = []; c.talking = false; c.talk_with = -1; c.use_furn = -1; c.use_act = ''; c.state = 'idle'; c.pose = 'stand'; c.emotion = 'neutral';
    if (cd.state === 'use' && cd.use_furn >= 0 && cd.use_furn < w.furn.length) {
      const f = w.furn[cd.use_furn];
      if (f.users[cd.use_slot] === -1) {
        const slot = f.slots[cd.use_slot];
        f.users[cd.use_slot] = c.id; c.use_furn = cd.use_furn; c.use_slot = cd.use_slot; c.use_act = cd.use_act; c.use_left = cd.use_left;
        c.use_stand = w.firstStand(f, slot); c.state = 'use'; c.pos = w.anchorPos(f, slot);
        c.pose = poseFor(slot.pose, ACT[c.use_act].pose); c.facing = slot.face ?? c.facing; c.action_text = ACT[c.use_act].label;
      }
    }
    if (c.state === 'idle') {
      const cell = c.cell();
      if (!w.isWalkable(cell)) { const alt = w.nearestFreeCell(cell, 4); if (alt.x >= 0) c.pos = { x: alt.x + 0.5, y: alt.y + 0.5 }; }
      c.decision_cooldown = 0.3;
    }
  }
  for (const e of d.journal ?? []) w.journal.push(e);
  return w;
}
export function save(w: World): boolean { try { localStorage.setItem(SAVE_KEY, JSON.stringify(toJSON(w))); return true; } catch { return false; } }
export function hasSave(): boolean { try { return localStorage.getItem(SAVE_KEY) !== null; } catch { return false; } }
export function load(): World | null { try { const s = localStorage.getItem(SAVE_KEY); return s ? fromJSON(JSON.parse(s)) : null; } catch { return null; } }
