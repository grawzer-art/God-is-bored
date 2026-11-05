/** Décision par utilité + plans + effets des activités. Port de Brain.gd. */
import { ACT, NEEDS, DIRS, type V2 } from './defs';
import { roomAt, buildingAt } from './layout';
import type { SimChar, Step } from './simchar';
import type { World } from './world';
import * as Social from './social';
import * as Life from './life';

export function isNight(c: SimChar, tod: number): boolean {
  let bt = 23 * 60 + c.chrono * 150;
  if (bt >= 1440) { bt -= 1440; return tod >= bt && tod < c.wake_target; }
  return tod >= bt || tod < c.wake_target;
}
export function urgentNeed(c: SimChar): string {
  if (c.needs.bladder < 8) return 'toilet';
  if (c.needs.hunger < 6) return 'eat';
  if (c.needs.energy < 5) return 'sleep';
  return '';
}
export function shouldWake(w: World, c: SimChar): boolean {
  const e = c.needs.energy;
  if (e >= 96) return true;
  if (c.needs.bladder < 8 || c.needs.hunger < 6) return true;
  if (c.slept_min < 120) return false;
  const t = w.tod();
  return t >= c.wake_target && t < c.wake_target + 360 && e >= 62;
}

export function decide(w: World, c: SimChar) {
  c.decision_cooldown = 0;
  if (c.whisper_act !== '' && w.clock < c.whisper_until) {
    const act = c.whisper_act; c.whisper_act = '';
    if (tryAct(w, c, act)) return;
  }
  if (Life.decide(w, c)) { c.statAdd('life_decisions'); return; }
  if (w.feastActive() && c.needs.hunger < 96 && (c.stats.feast_day ?? -1) !== w.day()) {
    const plan = planFeast(w, c);
    if (plan.length) { c.stats.feast_day = w.day(); c.plan = plan; w.startNextStep(c); return; }
  }
  const cands = scoreAll(w, c).sort((a, b) => b.score - a.score);
  let tries = 0;
  const record = (chosen: string, note: string) => {
    c.diag = { t: w.clock, chosen, why: note, cands: cands.slice(0, 6).map((x) => ({ act: x.act, score: Math.round(x.score * 10) / 10, why: explain(w, c, x.act) })) };
  };
  for (const cand of cands) {
    if (cand.score <= 0.5 || tries >= 5) break;
    tries++;
    if (tryAct(w, c, cand.act)) { record(cand.act, tries > 1 ? `${tries - 1} option(s) mieux notée(s) impossible(s) (meuble occupé ou inaccessible)` : 'meilleur score'); return; }
  }
  record('idle', 'aucune activité faisable');
  tryAct(w, c, 'idle');
  if (c.state === 'idle') c.decision_cooldown = 1.5;
}
/** Justification lisible d'un score (mode diagnostic). */
export function explain(w: World, c: SimChar, act: string): string {
  const n = c.needs; const hr = w.hour(); const night = isNight(c, w.tod()); const p = c.pref[act] ?? 0; const bits: string[] = [];
  const pc = (v: number) => `${Math.round(v)} %`;
  switch (act) {
    case 'sleep': bits.push(`énergie ${pc(n.energy)}`); if (night) bits.push(`heure du coucher (${c.chrono > 0.4 ? 'oiseau de nuit' : c.chrono < -0.4 ? 'lève-tôt' : 'rythme normal'})`); break;
    case 'nap': bits.push(`énergie basse ${pc(n.energy)} en journée`); break;
    case 'eat': bits.push(`faim ${pc(100 - n.hunger)} (nourri à ${pc(n.hunger)})`); if ((hr >= 7 && hr <= 9.5) || (hr >= 12 && hr <= 14.5) || (hr >= 19 && hr <= 21.5)) bits.push('heure de repas'); break;
    case 'toilet': bits.push(`vessie ${pc(n.bladder)}`); break;
    case 'shower': case 'wash': bits.push(`hygiène ${pc(n.hygiene)}`); if (hr < 11.5 && w.clock - c.last_shower > 840) bits.push('douche du matin'); break;
    case 'chat': bits.push(`besoin social ${pc(n.social)}`, `extraversion ${c.trait('extraversion').toFixed(2)}`); break;
    case 'tv': case 'read': case 'browse': bits.push(`loisirs ${pc(n.fun)}`); if (act === 'read') bits.push(`ouverture ${c.trait('openness').toFixed(2)}`); break;
    case 'tidy': case 'dishes': bits.push(`ordre ${c.trait('orderliness').toFixed(2)}`, `${w.mess.length} objet(s) au sol`); break;
    case 'water': bits.push('plantes assoiffées'); break;
    case 'pray': bits.push(`foi ${pc(c.faith)}`, `stress ${pc(c.stress)}`); break;
    case 'bath': bits.push('bain du soir', `loisirs ${pc(n.fun)}`); break;
    default: bits.push('repli par défaut');
  }
  if (night && !['sleep', 'toilet', 'eat', 'idle'].includes(act)) bits.push('nuit : score ×0,55');
  if (p) bits.push(`habitude apprise ${p > 0 ? '+' : ''}${p.toFixed(1)}`);
  return bits.join(' · ');
}
export function tryAct(w: World, c: SimChar, act: string): boolean {
  const plan = buildPlan(w, c, act);
  if (!plan.length) return false;
  c.plan = plan; c.statAdd('act_' + act); w.startNextStep(c); return true;
}
const P = (c: SimChar, a: string) => c.pref[a] ?? 0;

export function scoreAll(w: World, c: SimChar): { act: string; score: number }[] {
  const out: { act: string; score: number }[] = [];
  const n = c.needs; const tod = w.tod(); const hr = w.hour(); const night = isNight(c, tod);
  const ex = c.trait('extraversion'), order = c.trait('orderliness'), agree = c.trait('agreeableness'), open = c.trait('openness');
  const mealTime = (hr >= 7 && hr <= 9.5) || (hr >= 12 && hr <= 14.5) || (hr >= 19 && hr <= 21.5);
  let s = 0;
  if (n.energy < 88) { s = (88 - n.energy) * 1.25 + (night ? 38 : 0); if (!night && n.energy > 40) s *= 0.25; }
  out.push({ act: 'sleep', score: s });
  if (!night && n.energy < 58) out.push({ act: 'nap', score: (58 - n.energy) + P(c, 'nap') + order * -4 });
  let es = 0;
  if (n.hunger <= 72) { es = Math.pow((100 - n.hunger) / 100, 2) * 150; if (mealTime) es += 18; if (night && n.hunger > 30) es *= 0.6; }
  out.push({ act: 'eat', score: es + (es > 0 ? P(c, 'eat') : 0) });
  let ts = 0;
  if (n.bladder <= 75) { ts = Math.pow((100 - n.bladder) / 100, 3) * 170; if (n.bladder < 15) ts += 35; }
  out.push({ act: 'toilet', score: ts });
  let hs = 0;
  if (n.hygiene <= 82) {
    hs = Math.pow((100 - n.hygiene) / 100, 2) * 120;
    if (hr >= 6 && hr <= 11.5 && w.clock - c.last_shower > 14 * 60) hs += 28;
    if (w.clock - c.last_shower < 10 * 60) hs *= 0.15;
    if (night) hs *= 0.5;
  }
  out.push({ act: 'shower', score: hs + (hs > 0 ? P(c, 'shower') : 0) });
  if (n.hygiene < 70 && w.clock - c.last_shower > 180) out.push({ act: 'wash', score: (70 - n.hygiene) * 0.45 });
  if (hr >= 19.5 && hr <= 23.5 && n.fun < 70 && n.hygiene < 95) out.push({ act: 'bath', score: (100 - n.fun) * 0.32 + P(c, 'bath') * 2 + open * 5 });
  let soc = Math.pow((100 - n.social) / 100, 1.4) * 105 * (0.35 + 0.9 * ex);
  if (w.clock - c.last_chat < 40) soc *= 0.25;
  out.push({ act: 'chat', score: soc + P(c, 'chat') });
  const funBase = Math.pow((100 - n.fun) / 100, 1.8) * 105; const damp = night ? 0.45 : 1;
  out.push({ act: 'tv', score: funBase * (0.85 + (1 - order) * 0.35) * damp + P(c, 'tv') * 2 });
  out.push({ act: 'read', score: funBase * (0.6 + open * 0.55) * damp + P(c, 'read') * 2 });
  out.push({ act: 'browse', score: funBase * 0.35 * damp + P(c, 'browse') * 2 });
  if (!night) {
    let dish = 0, other = 0;
    for (const m of w.mess) m.kind === 'dishes' ? dish++ : other++;
    if (other > 0) out.push({ act: 'tidy', score: Math.pow(order, 1.5) * 7 * Math.min(other, 8) + P(c, 'tidy') * 2 });
    if (dish > 0) out.push({ act: 'dishes', score: (order * 0.9 + agree * 0.3) * 9 * Math.min(dish, 5) + P(c, 'dishes') * 2 });
    let thirsty = 100; for (const f of w.furn) if (f.def === 'plant') thirsty = Math.min(thirsty, f.water);
    if (thirsty < 55) out.push({ act: 'water', score: (60 - thirsty) * 0.35 * (order + agree) + P(c, 'water') * 2 });
    if (c.faith > 25) out.push({ act: 'pray', score: c.faith * 0.08 + (c.stress * 0.3 * c.faith) / 100 + P(c, 'pray') * 3 });
  }
  out.push({ act: 'idle', score: 13 });
  for (const e of out) {
    e.score += w.rng.randf() * 7;
    if (night && !['sleep', 'toilet', 'eat', 'idle'].includes(e.act)) e.score *= 0.55;
  }
  return out;
}

export function buildPlan(w: World, c: SimChar, act: string): Step[] {
  switch (act) {
    case 'sleep': return planBed(w, c);
    case 'nap': case 'tv': case 'read': case 'browse': case 'pray': case 'dishes': case 'bath': case 'shower': case 'wash': case 'water':
      return planTag(w, c, act, act, ['tv', 'read', 'nap'].includes(act));
    case 'toilet': {
      const p = planTag(w, c, 'toilet', 'toilet', false);
      if (p.length && w.rng.randf() < c.trait('orderliness') * 0.85) p.push(...planTag(w, c, 'wash', 'wash', false));
      return p;
    }
    case 'eat': return planEat(w, c);
    case 'tidy': return planTidy(w, c);
    case 'chat': { const t = Social.pickChatTarget(w, c); return t ? [{ type: 'approach', target: t.id }] : []; }
    case 'idle': return planIdle(w, c);
  }
  return [];
}
function planBed(w: World, c: SimChar): Step[] {
  const fi = w.furnById.get(c.bed_id); if (fi === undefined) return [];
  const f = w.furn[fi];
  if (f.users[0] !== -1 && f.users[0] !== c.id) return [];
  let stand: V2 | null = null;
  for (const s of f.slots[0].stands) { const cc = { x: f.x + s[0], y: f.y + s[1] }; if (w.isWalkable(cc)) { stand = cc; break; } }
  if (!stand) return [];
  return [{ type: 'goto', cell: stand }, { type: 'use', furn: fi, slot: 0, act: 'sleep', stand }];
}
function pickSlot(w: World, c: SimChar, tag: string, social: boolean, near?: V2) {
  // Phase A : un habitant n'utilise que les meubles de son bâtiment (les sorties au bar viendront avec leurs motivations)
  const home = buildingAt(c.cell().x, c.cell().y);
  const slots = w.freeSlots(tag).filter((s) => !home || buildingAt(s.stand.x, s.stand.y)?.name === home.name); let best: (typeof slots)[0] | null = null; let bs = -1e9;
  const origin = near ?? c.pos; const ex = c.trait('extraversion');
  for (const s of slots) {
    const st = { x: s.stand.x + 0.5, y: s.stand.y + 0.5 };
    let score = -Math.hypot(origin.x - st.x, origin.y - st.y) * 0.6 + w.rng.randf() * 2.5;
    for (const o of w.chars) if (o.id !== c.id && !o.away && (c.avoid[o.id] ?? 0) > w.clock && Math.hypot(o.pos.x - st.x, o.pos.y - st.y) < 2.6) score -= 7; // habitudes modifiées : on évite le coin de quelqu'un avec qui on est brouillé
    if (social) for (const o of w.chars) {
      if (o.id === c.id || o.state !== 'use' || o.isAsleep()) continue;
      if (Math.hypot(o.pos.x - st.x, o.pos.y - st.y) <= 2.3) score += w.getRel(c.id, o.id).aff * 0.07 * (0.3 + ex) + (ex - 0.45) * 3;
    }
    if (score > bs) { bs = score; best = s; }
  }
  return best;
}
function planTag(w: World, c: SimChar, tag: string, act: string, social: boolean): Step[] {
  const s = pickSlot(w, c, tag, social); if (!s) return [];
  return [{ type: 'goto', cell: s.stand }, { type: 'use', furn: s.f, slot: s.s, act, stand: s.stand }];
}
function planEat(w: World, c: SimChar): Step[] {
  const hunger = c.needs.hunger; const steps: Step[] = []; let origin = c.pos; let mode = 'seat';
  if (c.carry !== 'meal') {
    const stoves = w.freeSlots('cook').filter((s) => buildingAt(s.stand.x, s.stand.y)?.name === (buildingAt(c.cell().x, c.cell().y)?.name ?? 'house'));
    let cookP = 0.3 + c.trait('orderliness') * 0.4 + (c.likes.includes('cook') ? 0.3 : 0);
    if (c.likes.includes('snack')) cookP -= 0.25;
    if (w.pot > 0 && stoves.length && hunger < 75) mode = 'serve';
    else if (hunger >= 14 && stoves.length && w.rng.randf() < cookP) mode = 'cook';
    else mode = 'snack';
  }
  if (mode === 'snack') {
    const sn = pickSlot(w, c, 'snack', false); if (!sn) return [];
    return [{ type: 'goto', cell: sn.stand }, { type: 'use', furn: sn.f, slot: sn.s, act: 'snack', stand: sn.stand }];
  }
  if (mode === 'cook' || mode === 'serve') {
    const st = pickSlot(w, c, 'cook', false); if (!st) return [];
    steps.push({ type: 'goto', cell: st.stand }, { type: 'use', furn: st.f, slot: st.s, act: mode === 'cook' ? 'cook' : 'serve', stand: st.stand });
    origin = { x: st.stand.x + 0.5, y: st.stand.y + 0.5 };
  }
  const chair = pickSlot(w, c, 'eat', true, origin); if (!chair) return [];
  steps.push({ type: 'goto', cell: chair.stand }, { type: 'use', furn: chair.f, slot: chair.s, act: 'eat', stand: chair.stand });
  return steps;
}
export function planFeast(w: World, c: SimChar): Step[] {
  const chair = pickSlot(w, c, 'feast', true); if (!chair) return [];
  return [{ type: 'goto', cell: chair.stand }, { type: 'use', furn: chair.f, slot: chair.s, act: 'feast', stand: chair.stand }];
}
function planTidy(w: World, c: SimChar): Step[] {
  let best: (typeof w.mess)[0] | null = null; let bd = 1e9;
  for (const m of w.mess) { if (m.kind === 'dishes') continue; const d = Math.hypot(c.pos.x - m.pos.x, c.pos.y - m.pos.y); if (d < bd) { bd = d; best = m; } }
  if (!best) return [];
  const cell = w.nearestFreeCell({ x: Math.floor(best.pos.x), y: Math.floor(best.pos.y) }, 3); if (cell.x < 0) return [];
  return [{ type: 'goto', cell }, { type: 'wait', act: 'tidy', dur: w.rng.range(5, 9), mess: best.id }];
}
/** Quand rien ne presse, on ne tourne pas au hasard : on va à un point d'intérêt de la pièce (plantes, bibliothèque, frigo, plan de travail) et on y reste un moment. */
const POI = ['plant', 'bookshelf', 'fridge', 'counter', 'counter_w', 'console', 'sink_k', 'coffee_table'];
function planIdle(w: World, c: SimChar): Step[] {
  const base = c.cell(); const room = roomAt(base.x, base.y); let best: { cell: V2; d: number } | null = null;
  for (const f of w.furn) {
    if (!POI.includes(f.def) || roomAt(f.x, f.y) !== room) continue;
    const cell = w.nearestFreeCell({ x: f.x, y: f.y + 1 }, 2, true); if (cell.x < 0 || roomAt(cell.x, cell.y) !== room) continue;
    const d = Math.hypot(cell.x + 0.5 - c.pos.x, cell.y + 0.5 - c.pos.y); if (d < 1 || d > 12) continue;
    const score = d + w.rng.randf() * 6; if (!best || score < best.d) best = { cell, d: score };
  }
  if (best) return [{ type: 'goto', cell: best.cell }, { type: 'wait', act: 'look', dur: w.rng.range(5, 11) }];
  return [{ type: 'wait', act: 'idle', dur: 4 }];
}

export function onActStart(w: World, c: SimChar) {
  if (c.use_act === 'sleep') {
    c.slept_min = 0; c.wake_target = c.wake_base + w.rng.range(-25, 25); c.statAdd('sleeps');
    if (w.tod() > 600 || w.tod() < 180) w.emitLog(`${c.first} va se coucher.`, 'info', c.id);
  } else if (c.use_act === 'cook') w.emitLog(`${c.first} se met aux fourneaux.`, 'info', c.id);
  else if (c.use_act === 'drink') Life.onDrink(w, c);
}
export function onActEnd(w: World, c: SimChar, completed: boolean) {
  const act = c.use_act; c.statAdd((completed ? 'done_' : 'cut_') + act);
  if (act === 'search') Life.onSearchEnd(w, c, completed);
  switch (act) {
    case 'sleep':
      if (completed) {
        w.emitLog(`${c.first} se réveille.`, 'info', c.id); w.showEmote(c, 'sun', 3);
        if (c.needs.energy > 80) c.joy += 6;
        if (w.rng.randf() < (1 - c.trait('orderliness')) * 0.45)
          w.addMess('clothes', { x: c.use_stand.x + 0.5 + w.rng.range(-0.3, 0.3), y: c.use_stand.y + 0.5 + w.rng.range(-0.2, 0.3) }, 0);
      }
      break;
    case 'cook':
      c.carry = 'meal'; c.carry_cook = c.id; c.last_meal = w.clock;
      if (c.trait('agreeableness') > 0.7 || c.likes.includes('cook')) {
        w.pot = 2; w.potCook = c.id; w.potTime = w.clock;
        w.emitLog(`${c.first} a préparé un grand plat (${c.fav_food}) : il y en a pour les autres.`, 'info', c.id);
      }
      break;
    case 'serve': c.carry = 'meal'; c.carry_cook = w.potCook; w.pot = Math.max(0, w.pot - 1); break;
    case 'snack': c.last_meal = w.clock; if (c.likes.includes('snack')) c.joy += 5; break;
    case 'eat': case 'feast':
      c.carry = ''; c.last_meal = w.clock; spawnDishes(w, c);
      if (act === 'eat') Social.onMealDone(w, c); else c.joy += 12;
      break;
    case 'shower': c.last_shower = w.clock; if (completed) { c.joy += 3; Social.goalEvent(w, c, 'shower'); } break;
    case 'tv': case 'read': case 'browse': case 'bath': case 'nap':
      if (completed) { c.addPref(act, c.mood > -10 ? 0.35 : -0.15); Social.goalEvent(w, c, act); } break;
    case 'tidy':
      if (completed && c.use_target >= 0) { w.removeMess(c.use_target); Social.goalEvent(w, c, 'tidy'); c.addPref('tidy', 0.1); w.stats.tidied = (w.stats.tidied ?? 0) + 1; }
      break;
    case 'dishes':
      if (completed) {
        let removed = 0;
        for (const m of [...w.mess]) if (m.kind === 'dishes' && removed < 3) { w.removeMess(m.id); removed++; }
        if (removed > 0) { Social.goalEvent(w, c, 'tidy'); w.stats.tidied = (w.stats.tidied ?? 0) + removed; }
      }
      break;
    case 'water': if (completed && c.use_furn >= 0) w.furn[c.use_furn].water = 100; break;
    case 'pray': if (completed) Social.onPrayer(w, c); break;
  }
  c.use_target = -1;
  if (c.use_furn < 0) c.use_act = '';
}
function spawnDishes(w: World, c: SimChar) {
  if (c.use_furn < 0) return;
  const f = w.furn[c.use_furn]; const slot = f.slots[c.use_slot]; const dir = DIRS[slot.face ?? 1];
  const a = w.anchorPos(f, slot); const p = { x: a.x + dir.x * 0.78, y: a.y + dir.y * 0.78 };
  for (const m of w.mess) if (m.kind === 'dishes' && Math.hypot(m.pos.x - p.x, m.pos.y - p.y) < 0.35) return;
  w.addMess('dishes', p, 14);
}
export { NEEDS, ACT };
