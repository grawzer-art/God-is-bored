import { NEEDS, type Need, type V2 } from './defs';
import type { Look } from './roster';

/** Provenance d'un souvenir : vécu personnellement, raconté par un autre habitant, ou simple soupçon sans preuve. */
export type Source = 'lived' | 'told' | 'suspected';
export interface Memory { t: number; kind: string; text: string; v: number; w: number; other: number; src?: Source; ev?: number; conf?: number; from?: number; subj?: number }
/** Ce qu'un habitant sait d'un événement du monde. Absent = il l'ignore. `culprit` : -1 = auteur inconnu. */
export interface Know { src: Source; conf: number; from: number; culprit: number; t: number }
/** Intention en cours (aider, confronter, raconter, s'excuser, voler) : prioritaire sur l'emploi du temps ordinaire. */
export interface Intent { kind: 'help' | 'confront' | 'tell' | 'apologize' | 'steal'; target: number; ev: number; until: number }
/** Mission d'un policier : patrouille, intervention sur un lieu, poursuite d'une personne, fouille de la zone, retour au poste. */
export interface PoliceTask { kind: 'patrol' | 'respond' | 'pursue' | 'search' | 'return'; target: number; pos: V2; until: number; since: number; repath: number }
export interface Shift { from: number; to: number; pay: number; place: string }
export interface Goal { id: string; progress: number; done: boolean }
export interface Step { type: 'goto' | 'approach' | 'use' | 'wait' | 'depart'; cell?: V2; target?: number; furn?: number; slot?: number; act?: string; stand?: V2; dur?: number; mess?: number; t0?: number; recheck?: number }

/** État d'un habitant (aucune dépendance au rendu). */
export class SimChar {
  id = 0; name = ''; first = ''; age = 30; gender = 'F'; job = ''; bio = ''; secret = '';
  traits = { extraversion: 0.5, agreeableness: 0.5, neuroticism: 0.5, orderliness: 0.5, openness: 0.5 };
  chrono = 0; likes: string[] = []; dislikes: string[] = []; attracted_to: string[] = []; fav_food = '';
  look!: Look; bed_id = ''; wake_base = 480;
  needs = {} as Record<Need, number>;
  joy = 0; stress = 0; anger = 0; mood = 0; emotion = 'neutral'; emotion_override = ''; emotion_override_until = 0; faith = 30;
  pos: V2 = { x: 0, y: 0 }; facing = 1; state = 'idle'; pose = 'stand';
  plan: Step[] = []; step: Step | null = null; path: V2[] = []; path_i = 0; path_goal: V2 = { x: -1, y: -1 };
  tween_from: V2 = { x: 0, y: 0 }; tween_to: V2 = { x: 0, y: 0 }; tween_t = 0; tween_dur = 0.01; speed = 1.7; stuck_t = 0;
  use_furn = -1; use_slot = 0; use_act = ''; use_left = 0; use_stand: V2 = { x: 0, y: 0 }; use_target = -1;
  carry = ''; carry_cook = -1;
  wake_target = 480; slept_min = 0; last_shower = -9999; last_chat = -9999; last_meal = -9999; decision_cooldown = 0;
  whisper_act = ''; whisper_until = 0;
  talk_session = -1; talk_with = -1; talking = false;
  avoid: Record<number, number> = {}; pref: Record<string, number> = {};
  /** Ville (NORIA open world) : santé, articles non payés, domicile, emploi du temps, mission de police. */
  hp = 100; unpaid: Record<string, number> = {}; home: V2 | null = null; place = ''; agendaAt = 0; task: PoliceTask | null = null; dutyPost: V2 | null = null;
  /** Vie autonome : savoirs par événement, intention, emploi (horaires, paie), sortie en cours. */
  known: Record<number, Know> = {}; intent: Intent | null = null; shift: Shift | null = null;
  lifeAct = ''; lifeWhy = ''; jobPhase: '' | 'working' | 'searching' | 'out' | 'jail' = ''; jobUntil = 0; jobStart = 0; outing: '' | 'bar' = ''; outUntil = 0; lifeT = 0;
  memories: Memory[] = []; goal: Goal = { id: 'social', progress: 0, done: false }; goal_index = 0;
  emote = ''; emote_t = 0; action_text = ''; stats: Record<string, number> = {};
  /** resident = habitant autonome ; avatar = le dieu incarné (joueur) ; staff = employé (barman). */
  kind: 'resident' | 'avatar' | 'staff' | 'citizen' | 'police' | 'clerk' = 'resident'; away = false;
  money = 40; inventory: Record<string, number> = {}; drunk = 0;
  /** Dernière décision et ses justifications (mode diagnostic). */
  diag: { t: number; chosen: string; why: string; cands: { act: string; score: number; why: string }[] } | null = null;

  statAdd(k: string, v = 1) { this.stats[k] = (this.stats[k] ?? 0) + v; }
  trait(k: keyof SimChar['traits']) { return this.traits[k]; }
  cell(): V2 { return { x: Math.floor(this.pos.x), y: Math.floor(this.pos.y) }; }
  isAsleep() { return this.state === 'use' && this.use_act === 'sleep'; }
  need(k: Need) { return this.needs[k]; }
  addPref(act: string, v: number) { this.pref[act] = Math.max(-12, Math.min(12, (this.pref[act] ?? 0) + v)); }
  addMemory(t: number, kind: string, text: string, v: number, w: number, other = -1, extra: Partial<Memory> = {}) {
    this.memories.push({ t, kind, text, v, w, other, ...extra });
    if (this.memories.length > 60) {
      let worst = 0, ws = 1e9;
      this.memories.forEach((m, i) => { const s = m.w * 100 + m.t * 0.001; if (s < ws) { ws = s; worst = i; } });
      this.memories.splice(worst, 1);
    }
  }
  minNeed() { return Math.min(...NEEDS.map((n) => this.needs[n])); }
}
