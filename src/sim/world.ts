/** Monde simulé : grille, mobilier, habitants, horloge. Port de World.gd. Indépendant du rendu. */
import * as Quests from './quests';
import type * as Home from './home';
import * as Possess from './possess';
import * as God from './god';
import { Traffic } from './traffic';
import { ACT, FURN, MIN_PER_SEC, NEEDS, NEED_DECAY, DIRS, type FurnDef, type SlotDef, type V2 } from './defs';
import * as L from './layout';
import { ROSTER, SEED_RELATIONS } from './roster';
import { Rng } from './rng';
import { SimChar, type Step } from './simchar';
import { AStar } from './astar';
import * as Brain from './brain';
import * as Social from './social';
import * as Life from './life';
import * as City from './city';
import * as Crime from './crime';
import { lineClear, screenDirToGrid, smoothPath, stepBody } from './movement';

export interface Furn { i: number; def: string; x: number; y: number; w: number; d: number; opts: L.FurnPlacement['opts']; id: string; users: number[]; on: boolean; water: number; slots: SlotDef[]; blocks: boolean; flat: boolean; gone?: boolean; ox?: number; oy?: number }
export interface Mess { id: number; kind: string; pos: V2; elev: number; t: number }
/** Relation orientée a -> b. aff = affection, trust = confiance, fear = peur, resp = respect, ten = tension ; l'hostilité se déduit de aff < 0 et ten. cd = date du dernier conflit (rancune). */
export interface Rel { aff: number; fam: number; att: number; ten: number; n: number; trust: number; fear: number; resp: number; cd: number }
/** Événement du monde persistant (vol, dispute, aide, emploi…). Les habitants n'en savent que ce qu'ils ont vécu ou appris (voir SimChar.known). */
export interface WorldEvent { id: number; t: number; kind: string; actor: number; target: number; x: number; y: number; amount: number; sig: number; open: boolean }
export interface LogEntry { t: number; text: string; kind: string; cid: number }
export interface Session { id: number; a: number; b: number; left: number; total: number; ambient: boolean; line: boolean; emote: number; turn: number }

export class World {
  rng: Rng; seed: number;
  clock = 6 * 60 + 52;
  chars: SimChar[] = []; furn: Furn[] = []; furnById = new Map<string, number>(); cellFurn = new Map<number, number>();
  astar!: AStar;
  mess: Mess[] = []; nextMessId = 1;
  /** Vie autonome : journal d'événements, minuteur, dernier vol, point d'attention du joueur (simulation détaillée près de lui). */
  /** Criminalité : niveau de recherche du joueur, casier, appels en attente, interventions, PNJ recherchés, garde à vue. */
  wanted: Crime.Wanted = Crime.blankWanted(); record_: Crime.Record_ = Crime.blankRecord(); dispatches: Crime.Dispatch[] = []; reports: Crime.Report[] = []; nextDispatch = 1; wantedNpcs: Record<number, number> = {}; jail: { until: number } | null = null;
  onArrest: ((o: SimChar, fine: number, minutes: number) => void) | null = null; onJailEnd: (() => void) | null = null;
  events: WorldEvent[] = []; nextEvent = 1; lifeAcc = 0; lastTheft = -99999; focus: V2 | null = null;
  rel = new Map<number, Rel>();
  sessions = new Map<number, Session>(); nextSession = 1;
  pot = 0; potCook = -1; potTime = 0; feastUntil = -1; musicUntil = -1; knownSecrets: number[] = [];
  godEnergy = 60; ennui = 30;
  journal: LogEntry[] = []; stats: Record<string, number> = {}; lastDay = 1; ambTimer = 0;
  /** Entrées du joueur (mode humain) : direction -1..1, course. Posées par l'interface à chaque image. */
  input: { dx: number; dy: number; run: boolean; mag?: number } = { dx: 0, dy: 0, run: false }; avatarControlled = false;
  onAvatarArrive: ((npc: SimChar) => void) | null = null;
  listeners: { log: ((e: LogEntry) => void)[]; emote: ((cid: number, icon: string) => void)[] } = { log: [], emote: [] };

  constructor(seed = 1337) { this.seed = seed; this.rng = new Rng(seed); }

  // ---------------------------------------------------------------- construction
  possess: Possess.PossessState | null = null; incarnations: Possess.Incarnation[] = [];
  profile: import('./profile').Profile | null = null; profileVersion = 0; property: { id: string; name: string; building: string; rent: number; since: number } | null = null;
  quests: Record<string, Quests.QState> = {}; progress: Quests.Progress = Quests.newProgress(); narrations: Quests.Narration[] = []; questLog: { t: number; text: string }[] = []; questToasts: string[] = []; questDone: string[] = [];
  job: { to: number; pay: number; t0: number } | null = null;
  traffic?: Traffic; till = 160; freePowers = true; laws: God.Laws = { police: true }; divine: God.DivineEntry[] = []; holdup: Crime.Holdup | null = null;
  build() {
    this.buildFurniture(); this.buildGrid(); this.buildChars(); this.buildExtras(); Life.init(this); this.traffic = new Traffic(this);
    for (const m of L.INITIAL_MESS) this.addMess(m[0], { x: m[1], y: m[2] }, 0);
    this.emitLog('Le jour se lève sur la maison. Huit habitants dorment encore.', 'info');
  }
  private key(x: number, y: number) { return y * 1000 + x; }
  /** Meubles rangés dans l'inventaire du joueur (def → quantité) ; `baseFurn` : nombre de meubles d'origine (les suivants ont été ajoutés par le joueur). */
  stash: Record<string, number> = {}; baseFurn = 0; homeEdit: { mode: 'move'; furn: number } | { mode: 'place'; def: string } | null = null;
  furnAt(x: number, y: number) { return this.cellFurn.get(this.key(x, y)) ?? -1; }
  reindexFurniture() { this.cellFurn.clear(); for (const f of this.furn) { f.slots = f.gone ? [] : FURN[f.def].slots; if (f.blocks && !f.gone) for (let cx = 0; cx < f.w; cx++) for (let cy = 0; cy < f.d; cy++) this.cellFurn.set(this.key(f.x + cx, f.y + cy), f.i); } this.buildGrid(); this.furnVersion++; }
  furnVersion = 0; hist: Home.Op[] = []; redo: Home.Op[] = []; decoMode = false;
  /** Sols et murs de l'appartement (id de style par pièce j/m/v) ; `styleVersion` force le redessin. */
  homeStyle: { floor: Record<string, string>; wall: Record<string, string> } = { floor: {}, wall: {} }; styleVersion = 0;
  addFurn(def: string, x: number, y: number, style = 0): Furn { const d: FurnDef = FURN[def]; const f: Furn = { i: this.furn.length, def, x, y, w: d.w, d: d.d, opts: { style }, id: '', users: d.slots.map(() => -1), on: false, water: 100, slots: d.slots, blocks: d.blocks, flat: !!d.flat }; this.furn.push(f); return f; }
  private buildFurniture() {
    this.furn = []; this.cellFurn.clear(); this.furnById.clear();
    for (const e of L.furniture()) {
      const d: FurnDef = FURN[e.def];
      const f: Furn = { i: this.furn.length, def: e.def, x: e.x, y: e.y, w: e.opts.w ?? d.w, d: e.opts.d ?? d.d, opts: e.opts, id: e.opts.id ?? '',
        users: d.slots.map(() => -1), on: false, water: 100, slots: d.slots, blocks: d.blocks, flat: !!d.flat };
      this.furn.push(f);
      if (f.id) this.furnById.set(f.id, f.i);
      if (f.blocks) for (let cx = 0; cx < f.w; cx++) for (let cy = 0; cy < f.d; cy++) this.cellFurn.set(this.key(f.x + cx, f.y + cy), f.i);
      f.ox = f.x; f.oy = f.y;
    }
    this.baseFurn = this.furn.length;
  }
  private buildGrid() {
    this.astar = new AStar(L.W, L.H);
    for (let y = 0; y < L.H; y++) for (let x = 0; x < L.W; x++) if (L.isWall(x, y) || this.cellFurn.has(this.key(x, y))) this.astar.setSolid(x, y, true);
  }
  private buildChars() {
    this.chars = [];
    ROSTER.forEach((r, i) => {
      const c = new SimChar();
      c.id = i; c.name = r.name; c.first = r.name.split(' ')[0]; c.age = r.age; c.gender = r.gender; c.job = r.job; c.bio = r.bio; c.secret = r.secret;
      c.traits = { ...r.traits }; c.chrono = r.chrono; c.likes = [...r.likes]; c.dislikes = [...r.dislikes]; c.attracted_to = [...r.attracted_to];
      c.fav_food = r.fav_food; c.look = { ...r.look }; c.bed_id = r.bed; c.wake_base = r.wake; c.wake_target = r.wake; c.faith = r.faith; c.needs = { ...r.needs };
      c.speed = 1.6 + this.rng.randf() * 0.25 - (c.age > 48 ? 0.2 : 0);
      r.likes.forEach((a) => (c.pref[a] = 2)); r.dislikes.forEach((a) => (c.pref[a] = -2));
      c.goal = { id: r.goal, progress: 0, done: false }; c.money = 20 + Math.floor(this.rng.randf() * 90);
      this.chars.push(c);
      const fi = this.furnById.get(c.bed_id)!; const f = this.furn[fi]; const slot = f.slots[0];
      c.use_furn = fi; c.use_slot = 0; c.use_act = 'sleep'; c.use_left = 9999; c.use_stand = this.firstStand(f, slot);
      f.users[0] = c.id; c.pos = this.anchorPos(f, slot); c.slept_min = 420; c.state = 'use'; c.pose = 'lie'; c.facing = 1; c.action_text = 'Dort';
    });
    for (const rr of SEED_RELATIONS) { const rl = this.getRel(rr[0], rr[1]); rl.aff = rr[2]; rl.fam = rr[3]; rl.att = rr[4]; }
    for (const a of this.chars) for (const b of this.chars) {
      if (a.id === b.id) continue;
      if (!this.rel.has(a.id * 100 + b.id)) { const rl = this.getRel(a.id, b.id); rl.aff = this.rng.int(-6, 12); rl.fam = this.rng.int(18, 38); }
    }
  }

  get residents(): SimChar[] { return this.chars.filter((c) => c.kind === 'resident'); }
  get avatar(): SimChar { return this.chars.find((c) => c.kind === 'avatar')!; }
  get barman(): SimChar | undefined { return this.chars.find((c) => c.kind === 'staff'); }
  get clerk(): SimChar | undefined { return this.chars.find((c) => c.kind === 'clerk'); }
  get police(): SimChar[] { return this.chars.filter((c) => c.kind === 'police'); }
  get citizens(): SimChar[] { return this.chars.filter((c) => c.kind === 'citizen'); }

  /** Crée l'avatar du dieu (à la rue, devant la maison) et le barman (absent hors horaires). */
  private buildExtras() {
    const mk = (id: number, name: string, kind: 'avatar' | 'staff', look: any, gender: 'F' | 'M', job: string, bio: string, secret: string, money: number): SimChar => {
      const c = new SimChar();
      c.id = id; c.name = name; c.first = name.split(' ')[0]; c.kind = kind; c.age = 33; c.gender = gender; c.job = job; c.bio = bio; c.secret = secret; c.look = look;
      c.needs = { hunger: 70, energy: 90, bladder: 70, hygiene: 80, social: 60, fun: 60 }; c.money = money; c.faith = 0; c.speed = 1.9; c.pos = { x: 16.5, y: 19.5 };
      c.traits = { extraversion: 0.6, agreeableness: 0.6, neuroticism: 0.3, orderliness: 0.5, openness: 0.7 };
      this.chars.push(c); return c;
    };
    const av = mk(8, 'Vous', 'avatar', { skin: 2, hair: 'messy', hair_color: 'darkbrown', top: 'hoodie', top_color: 'navy', bottom: 'jeans', bottom_color: 'dark', shoes: 'black', build: 0, height: 0, acc: 'none' },
      'M', 'Dieu incarné', 'Vous êtes descendu parmi eux. Personne ne sait qui vous êtes.', '', 60);
    av.inventory = { sandwich: 1, bonbons: 2, briquet: 1 };
    const gb = mk(9, 'Gaby Marchetti', 'staff', { skin: 3, hair: 'short', hair_color: 'black', top: 'tank', top_color: 'black', bottom: 'jeans', bottom_color: 'dark', shoes: 'black', build: 1, height: 1, acc: 'beard' },
      'M', 'Barman', "Tient « Le Cinquième Ciel » depuis dix ans. Voit tout, ne dit presque rien.", 'Il sert parfois des verres gratuits à ceux qui ont l\'air de ne plus rien avoir.', 300);
    gb.traits = { extraversion: 0.7, agreeableness: 0.65, neuroticism: 0.3, orderliness: 0.7, openness: 0.5 }; gb.away = true; gb.pos = { x: 38.5, y: 19.5 }; gb.use_stand = { x: 38, y: 19 };
    for (const o of this.chars) if (o.kind === 'resident') for (const x of [av, gb]) { const r = this.getRel(o.id, x.id); r.aff = 0; r.fam = x === gb ? 12 : 2; const r2 = this.getRel(x.id, o.id); r2.aff = 0; r2.fam = x === gb ? 12 : 2; }
    City.populate(this);
  }

  // ---------------------------------------------------------------- utilitaires
  tod() { return this.clock % 1440; }
  hour() { return this.tod() / 60; }
  day() { return Math.floor(this.clock / 1440) + 1; }
  clockLabel() { const t = Math.floor(this.tod()); return `Jour ${this.day()} · ${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; }
  getRel(a: number, b: number): Rel {
    const k = a * 100 + b;
    let r = this.rel.get(k);
    if (!r) { r = { aff: 0, fam: 15, att: 0, ten: 0, n: 0, trust: 45, fear: 0, resp: 45, cd: 0 }; this.rel.set(k, r); }
    else if (r.trust === undefined) { r.trust = Math.max(0, Math.min(100, 45 + r.aff * 0.4)); r.fear = 0; r.resp = Math.max(0, Math.min(100, 45 + r.aff * 0.1)); r.cd = 0; } // anciennes sauvegardes
    return r;
  }
  relLabel(a: number, b: number) {
    const r = this.getRel(a, b);
    if (r.aff >= 55 && r.att >= 40) return 'Intérêt amoureux';
    if (r.aff >= 60) return 'Ami proche';
    if (r.aff >= 30) return 'Ami';
    if (r.aff <= -50) return 'Ennemi';
    if (r.aff <= -20) return 'Tension';
    if (r.fam < 20) return 'Presque inconnu';
    return 'Colocataire';
  }
  roomOf(p: V2) { return L.roomAt(Math.floor(p.x), Math.floor(p.y)); }
  emitLog(text: string, kind = 'info', cid = -1) {
    const e: LogEntry = { t: this.clock, text, kind, cid };
    this.journal.push(e); if (this.journal.length > 400) this.journal.shift();
    this.listeners.log.forEach((f) => f(e));
  }
  isWalkable(c: V2) { return c.x >= 0 && c.y >= 0 && c.x < L.W && c.y < L.H && !this.astar.isSolid(c.x, c.y); }
  anchorPos(f: Furn, slot: SlotDef): V2 {
    if (slot.anchor) return { x: f.x + slot.anchor[0], y: f.y + slot.anchor[1] };
    const s = this.firstStand(f, slot); return { x: s.x + 0.5, y: s.y + 0.5 };
  }
  firstStand(f: Furn, slot: SlotDef): V2 {
    for (const s of slot.stands) { const c = { x: f.x + s[0], y: f.y + s[1] }; if (this.isWalkable(c)) return c; }
    return { x: f.x + slot.stands[0][0], y: f.y + slot.stands[0][1] };
  }
  freeSlots(tag: string) {
    const out: { f: number; s: number; stand: V2 }[] = [];
    for (const f of this.furn) f.slots.forEach((slot, si) => {
      if (!slot.tags.includes(tag) || f.users[si] !== -1) return;
      for (const s of slot.stands) { const c = { x: f.x + s[0], y: f.y + s[1] }; if (this.isWalkable(c)) { out.push({ f: f.i, s: si, stand: c }); break; } }
    });
    return out;
  }
  pathTo(from: V2, to: V2): V2[] {
    let a = { x: Math.max(0, Math.min(L.W - 1, Math.floor(from.x))), y: Math.max(0, Math.min(L.H - 1, Math.floor(from.y))) };
    if (!this.isWalkable(to)) return [];
    if (this.astar.isSolid(a.x, a.y)) { const alt = this.nearestFreeCell(a, 3); if (alt.x < 0) return []; a = alt; }
    return this.astar.path(a, to).map((p) => ({ x: p.x + 0.5, y: p.y + 0.5 }));
  }
  nearDoor(c: V2) { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (L.isDoor(c.x + dx, c.y + dy)) return true; return false; }
  nearestFreeCell(cell: V2, maxR = 4, avoidDoor = false): V2 {
    for (let r = 0; r <= maxR; r++) {
      let best = { x: -1, y: -1 }, bd = 1e9;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const c = { x: cell.x + dx, y: cell.y + dy };
        if (!this.isWalkable(c) || (avoidDoor && this.nearDoor(c))) continue;
        const d = dx * dx + dy * dy; if (d < bd) { bd = d; best = c; }
      }
      if (best.x >= 0) return best;
    }
    return { x: -1, y: -1 };
  }
  addMess(kind: string, p: V2, elev: number) { const m = { id: this.nextMessId++, kind, pos: p, elev, t: this.clock }; this.mess.push(m); return m.id; }
  removeMess(id: number) { const i = this.mess.findIndex((m) => m.id === id); if (i >= 0) { this.mess.splice(i, 1); return true; } return false; }
  findMess(id: number) { return this.mess.find((m) => m.id === id); }
  dirFrom(v: V2, current: number): number {
    const ax = Math.abs(v.x), ay = Math.abs(v.y);
    if (ax > ay * 1.3) return v.x > 0 ? 0 : 2;
    if (ay > ax * 1.3) return v.y > 0 ? 1 : 3;
    if (v.x > 0 && v.y > 0) return current === 0 || current === 1 ? current : 1;
    if (v.x < 0 && v.y < 0) return current === 2 || current === 3 ? current : 3;
    if (v.x > 0 && v.y < 0) return current === 3 ? 3 : 0;
    return current === 2 ? 2 : 1;
  }

  // ---------------------------------------------------------------- boucle
  tick(dt: number) {
    const dmin = dt * MIN_PER_SEC;
    this.clock += dmin;
    if (this.day() !== this.lastDay) { this.lastDay = this.day(); this.emitLog(`Jour ${this.day()}.`, 'info'); this.chars.forEach((c) => (c.stats.days = this.day())); }
    this.updateWorld(dmin);
    for (const c of this.chars) this.updateChar(c, dt, dmin);
    Life.tick(this, dmin); Crime.tick(this, dt, dmin); this.traffic?.tick(dt); Quests.tick(this);
    Social.updateSessions(this, dmin);
    Social.ambient(this, dmin);
  }
  private updateWorld(dmin: number) {
    for (const f of this.furn) {
      if (f.def === 'jukebox') f.on = this.musicUntil > this.clock;
      if (f.def === 'tv') f.on = this.chars.some((c) => c.state === 'use' && c.use_act === 'tv');
      else if (f.def === 'plant') f.water = Math.max(0, f.water - 0.012 * dmin);
    }
    if (this.pot > 0 && this.clock - this.potTime > 180) this.pot = 0;
    const bm = this.barman; if (bm && !bm.away && bm.state === 'use' && bm.use_act === 'bartend') bm.facing = 1;
    const res = this.residents; let faithful = 0; for (const c of res) faithful += c.faith;
    const boredMult = 1.35 + (0.35 - 1.35) * (this.ennui / 100);
    this.godEnergy = Math.min(100, this.godEnergy + (0.05 + (faithful / (res.length * 100)) * 0.07) * dmin * boredMult);
    this.ennui = Math.max(0, Math.min(100, this.ennui + 0.025 * dmin));
    if (this.feastUntil > 0 && this.clock > this.feastUntil) { this.feastUntil = -1; this.emitLog("Le festin céleste s'évanouit en laissant des miettes.", 'god'); }
  }
  feastActive() { return this.feastUntil > 0 && this.clock < this.feastUntil; }

  updateChar(c: SimChar, dt: number, dmin: number) {
    if (c.kind === 'dormant') return;
    if (c.kind === 'staff') { this.updateStaff(c, dt, dmin); return; }
    if (c.kind === 'avatar') { this.updateAvatar(c, dt, dmin); return; }
    if (c.kind === 'clerk') { City.updateClerk(this, c, dt, dmin); this.runStates(c, dt, dmin); return; }
    if (c.kind === 'police') { Crime.policeThink(this, c, dt); this.runStates(c, dt, dmin); return; }
    this.updateNeeds(c, dmin); this.updateMood(c, dt, dmin);
    if (c.away) { Life.updateAway(this, c); return; } // hors de la carte (travail, recherche d'emploi) : simulation abstraite
    if (c.emote_t > 0) c.emote_t -= dt;
    c.decision_cooldown = Math.max(0, c.decision_cooldown - dt);
    switch (c.state) {
      case 'idle': c.pose = 'stand'; c.action_text = 'Réfléchit'; if (c.decision_cooldown <= 0) { if (c.kind === 'citizen') City.decide(this, c); else Brain.decide(this, c); } break;
      case 'walk': this.doWalk(c, dt); break;
      case 'enter': case 'exit': this.doTween(c, dt); break;
      case 'use': this.doUse(c, dmin); break;
      case 'chat': c.pose = 'stand'; c.action_text = c.talk_with >= 0 ? `Discute avec ${this.chars[c.talk_with].first}` : 'Discute'; break;
    }
  }
  /** Déplacements et activités en cours (commun à tous les personnages non joueurs). */
  private runStates(c: SimChar, dt: number, dmin: number) {
    if (c.state === 'walk') this.doWalk(c, dt); else if (c.state === 'use') this.doUse(c, dmin); else if (c.state === 'enter' || c.state === 'exit') this.doTween(c, dt);
  }
  private updateNeeds(c: SimChar, dmin: number) {
    const h = dmin / 60;
    const asleep = c.isAsleep();
    const rate = c.state === 'use' ? ACT[c.use_act]?.rate ?? {} : {};
    const company = c.talking || c.state === 'chat';
    for (const n of NEEDS) {
      let decay = NEED_DECAY[n];
      if (n === 'social') { decay *= 0.5 + c.trait('extraversion'); if (company) decay = -4; }
      if (asleep) decay *= 0.3;
      let delta = -decay; if (rate[n] !== undefined) delta += rate[n]!;
      c.needs[n] = Math.max(0, Math.min(100, c.needs[n] + delta * h));
    }
  }
  private updateMood(c: SimChar, _dt: number, dmin: number) {
    const neuro = c.trait('neuroticism');
    c.joy = Math.max(0, c.joy - 0.45 * dmin); c.anger = Math.max(0, c.anger - 0.6 * dmin);
    c.stress = Math.max(0, c.stress - 0.3 * (1.25 - neuro) * dmin);
    if (c.minNeed() < 15) c.stress = Math.min(100, c.stress + 0.22 * dmin);
    const mc = this.mess.length;
    if (mc >= 5) c.stress = Math.min(100, c.stress + 0.05 * c.trait('orderliness') * (mc - 4) * dmin);
    const w = { hunger: 0.22, energy: 0.2, bladder: 0.14, hygiene: 0.12, social: 0.18, fun: 0.14 };
    let m = 0;
    for (const n of NEEDS) { m += (c.needs[n] - 50) * w[n]; if (c.needs[n] < 20) m -= (20 - c.needs[n]) * 0.7; }
    m = m * 1.5 + c.joy * 0.6 - c.stress * 0.4 - c.anger * 0.5;
    c.mood = Math.max(-100, Math.min(100, m));
    let e = this.pickEmotion(c);
    if (c.emotion_override && this.clock < c.emotion_override_until) e = c.emotion_override;
    if (e !== c.emotion) {
      c.emotion = e; const icon = emotionIcon(e);
      if (icon && c.emote_t <= 0 && !c.isAsleep()) this.showEmote(c, icon);
    }
  }
  private pickEmotion(c: SimChar): string {
    const n = c.needs;
    if (c.anger > 45) return 'angry';
    if (c.anger > 25 || (c.stress > 55 && c.mood < -10)) return 'irritated';
    if (n.energy < 18) return 'tired'; if (n.hunger < 18) return 'hungry'; if (n.hygiene < 20) return 'dirty';
    if (c.stress > 55 && c.trait('neuroticism') > 0.6) return 'anxious';
    if (n.social < 22) return 'lonely'; if (n.fun < 20) return 'bored';
    if (c.joy > 40) return 'joy'; if (c.mood < -35) return 'sad'; if (c.mood > 22) return 'content';
    return 'neutral';
  }
  showEmote(c: SimChar, icon: string, secs = 3.5) { c.emote = icon; c.emote_t = secs; this.listeners.emote.forEach((f) => f(c.id, icon)); }
  setEmotionFor(c: SimChar, e: string, minutes: number) { c.emotion_override = e; c.emotion_override_until = this.clock + minutes; }

  // ---------------------------------------------------------------- avatar (mode humain)
  barOpen() { const h = this.hour(); return h >= 17.5 || h < 3; }
  private updateAvatar(c: SimChar, dt: number, dmin: number) {
    const saveNeeds = { ...c.needs };
    this.updateNeeds(c, dmin); this.updateMood(c, dt, dmin);
    // le dieu incarné se fatigue deux fois moins vite qu'un mortel
    for (const n of NEEDS) { const d = c.needs[n] - saveNeeds[n]; if (d < 0 && c.state !== 'use') c.needs[n] = saveNeeds[n] + d * 0.5; }
    c.drunk = Math.max(0, c.drunk - 1.2 * dmin / 60 * 10);
    if (c.emote_t > 0) c.emote_t -= dt;
    if (this.jail) { c.pose = 'stand'; c.state = 'idle'; c.plan = []; c.action_text = 'En garde à vue'; return; }
    if (!this.avatarControlled) { if (c.state === 'idle') c.pose = 'stand'; this.runAvatarState(c, dt, dmin); return; }
    const { dx, dy } = this.input; const moving = dx !== 0 || dy !== 0;
    if (moving && (c.state === 'use' || c.state === 'walk')) { if (c.state === 'use') this.endUse(c, false); else this.abortPlan(c, 'player'); }
    if (moving && c.state === 'idle') this.moveAvatar(c, dt);
    else if (c.state === 'idle') c.pose = 'stand';
    else this.runAvatarState(c, dt, dmin);
  }
  private runAvatarState(c: SimChar, dt: number, dmin: number) {
    switch (c.state) {
      case 'walk': this.doWalk(c, dt); break; case 'enter': case 'exit': this.doTween(c, dt); break; case 'use': this.doUse(c, dmin); break;
      case 'idle': break;
    }
  }
  /** Déplacement libre (clavier ou joystick analogique `input.mag` 0..1) avec collisions : glisse le long des murs, ne chevauche pas les autres personnages. */
  moveAvatar(c: SimChar, dt: number) {
    const { dx, dy } = this.input; const n = Math.hypot(dx, dy); if (n === 0) return;
    const g = screenDirToGrid(dx, dy); const mag = Math.max(0.25, Math.min(1, this.input.mag ?? 1));
    const sp = this.avatarSpeed() * mag; const wob = c.drunk > 35 ? Math.sin(this.clock * 4) * 0.35 * (c.drunk / 100) : 0;
    const vx = g.x * sp * dt, vy = g.y * sp * dt; const px = vx - vy * wob, py = vy + vx * wob;
    const others = this.chars.filter((o) => o.id !== c.id && !o.away && o.state !== 'enter').map((o) => o.pos);
    c.pos = stepBody(this, c.pos, px, py, others);
    c.facing = this.dirFrom({ x: px, y: py }, c.facing); c.pose = 'walk'; c.action_text = 'Se déplace';
  }
  /** Vitesse de marche du joueur (case/s) : marche, course, ivresse. Identique au joystick et au déplacement automatique. */
  avatarSpeed() { const av = this.avatar; return (this.input.run ? 3.1 : 2.1) * (av.drunk > 40 ? 0.8 : 1); }
  // ---------------------------------------------------------------- employé (barman)
  private updateStaff(c: SimChar, dt: number, dmin: number) {
    const open = this.barOpen(); const post = { x: 36, y: 10 };
    if (c.away) {
      if (open && this.hour() >= 17.3 || (open && this.hour() < 3)) { c.away = false; c.pos = { x: 38.5, y: 19.5 }; c.state = 'idle'; c.plan = []; c.action_text = 'Arrive au travail'; }
      else return;
    }
    if (c.state === 'idle') {
      if (open) { if (Math.hypot(c.pos.x - (post.x + 0.5), c.pos.y - (post.y + 0.5)) > 0.2) c.plan = [{ type: 'goto', cell: post }, { type: 'wait', act: 'bartend', dur: 9999 }]; else c.plan = [{ type: 'wait', act: 'bartend', dur: 9999 }]; this.startNextStep(c); }
      else if (c.pos.y < 19) { c.plan = [{ type: 'goto', cell: { x: 38, y: 17 } }, { type: 'goto', cell: { x: 38, y: 19 } }]; this.startNextStep(c); }
      else { c.away = true; c.state = 'idle'; }
    } else if (c.state === 'use' && !open && c.use_act === 'bartend') { this.endUse(c, true); }
    if (c.state === 'walk') this.doWalk(c, dt); else if (c.state === 'use') this.doUse(c, dmin); else if (c.state === 'enter' || c.state === 'exit') this.doTween(c, dt);
    if (c.state === 'use' && c.use_act === 'bartend') c.pose = 'use';
  }

  // ---------------------------------------------------------------- exécuteur de plans
  abortPlan(c: SimChar, _reason = '') {
    c.plan = []; c.step = null; c.path = []; c.statAdd('aborts');
    if (c.use_furn >= 0) { this.release(c); if (c.state !== 'idle') c.pos = { x: c.use_stand.x + 0.5, y: c.use_stand.y + 0.5 }; }
    c.state = 'idle'; c.pose = 'stand'; c.decision_cooldown = 0.6;
  }
  release(c: SimChar) {
    if (c.use_furn >= 0) { const f = this.furn[c.use_furn]; if (c.use_slot < f.users.length && f.users[c.use_slot] === c.id) f.users[c.use_slot] = -1; }
    c.use_furn = -1; c.use_act = '';
  }
  startNextStep(c: SimChar) {
    if (c.plan.length === 0) { c.state = 'idle'; c.pose = 'stand'; c.step = null; c.decision_cooldown = 0.4 + this.rng.randf() * 0.8; return; }
    const s = c.plan.shift()!; c.step = s;
    switch (s.type) {
      case 'goto': this.beginWalk(c, s.cell!); break;
      case 'approach': {
        const t = this.chars[s.target!]; const cell = Social.approachCell(this, c, t);
        s.t0 = this.clock; s.recheck = 0;
        if (cell.x < 0) { this.abortPlan(c, 'no approach'); return; }
        this.beginWalk(c, cell); break;
      }
      case 'depart': c.away = true; c.state = 'idle'; c.plan = []; c.step = null; c.pose = 'stand'; c.action_text = c.jobPhase === 'searching' ? 'Cherche du travail' : 'Au travail'; break;
      case 'use': this.beginUse(c, s); break;
      case 'wait':
        c.state = 'use'; c.use_act = s.act ?? 'idle'; c.use_left = s.dur ?? 5; c.pose = 'stand'; c.use_furn = -1; c.use_target = s.mess ?? -1; c.action_text = ACT[c.use_act]?.label ?? ''; break;
      default: this.startNextStep(c);
    }
  }
  private beginWalk(c: SimChar, cell: V2) {
    const cur = c.cell();
    if (cur.x === cell.x && cur.y === cell.y) {
      const center = { x: cell.x + 0.5, y: cell.y + 0.5 };
      if (Math.hypot(c.pos.x - center.x, c.pos.y - center.y) < 0.08) { this.startNextStep(c); return; }
      c.path = [center]; c.path_i = 0; c.state = 'walk'; c.path_goal = cell; return;
    }
    const p = this.pathTo(c.pos, cell);
    if (p.length === 0) { this.stats.path_fail = (this.stats.path_fail ?? 0) + 1; this.abortPlan(c, 'no path'); return; }
    if (p.length > 1) p.shift();
    c.path = c.kind === 'avatar' ? smoothPath(this, c.pos, p) : p; c.path_i = 0; c.path_goal = cell; c.state = 'walk'; c.stuck_t = 0;
  }
  private doWalk(c: SimChar, dt: number) {
    c.pose = 'walk';
    const st = c.step;
    if (st && st.type === 'approach') {
      st.recheck = (st.recheck ?? 0) - dt;
      const t = this.chars[st.target!];
      if (!Social.canBeApproached(this, t) || this.clock - (st.t0 ?? 0) > 90) { this.abortPlan(c, 'target gone'); c.last_chat = this.clock - 30; return; }
      if (dist(c.pos, t.pos) <= ((t.kind === 'staff' || t.kind === 'clerk') ? 2.6 : 1.45) && (c.kind !== 'avatar' || lineClear(c.pos, t.pos))) { if (c.kind === 'avatar') { this.abortPlan(c, 'arrived'); c.facing = this.dirFrom({ x: t.pos.x - c.pos.x, y: t.pos.y - c.pos.y }, c.facing); this.onAvatarArrive?.(t); } else if (!Life.onArrive(this, c, t)) Social.beginChat(this, c, t); return; }
      if (st.recheck! <= 0) {
        st.recheck = 0.7; const cell = Social.approachCell(this, c, t);
        if (cell.x >= 0 && (cell.x !== c.path_goal.x || cell.y !== c.path_goal.y)) {
          const p = this.pathTo(c.pos, cell);
          if (p.length) { if (p.length > 1) p.shift(); c.path = p; c.path_i = 0; c.path_goal = cell; }
        }
      }
    }
    if (c.path_i >= c.path.length) { this.finishWalk(c); return; }
    const target = c.path[c.path_i];
    const d = { x: target.x - c.pos.x, y: target.y - c.pos.y }; const dd = Math.hypot(d.x, d.y); const move = (c.kind === 'avatar' ? this.avatarSpeed() : c.speed) * dt;
    if (dd > 0.001) c.facing = this.dirFrom(d, c.facing);
    const k = Math.min(dd, 0.6) / Math.max(dd, 0.001);
    const ahead = { x: c.pos.x + d.x * k, y: c.pos.y + d.y * k };
    for (const o of this.chars) {
      if (o.id === c.id || o.state === 'walk') continue;
      if (dist(o.pos, ahead) < 0.42 && dist(o.pos, c.pos) > 0.2) {
        c.stuck_t += dt;
        if (c.stuck_t > 1.0 && c.stuck_t < 1.1 && c.path_goal.x >= 0) this.repathAround(c, o);
        if (c.stuck_t < 4.0) return;
      }
    }
    c.stuck_t = 0;
    if (dd <= move) { c.pos = { x: target.x, y: target.y }; c.path_i++; if (c.path_i >= c.path.length) this.finishWalk(c); }
    else { c.pos = { x: c.pos.x + (d.x / dd) * move, y: c.pos.y + (d.y / dd) * move }; }
  }
  private repathAround(c: SimChar, o: SimChar) {
    const oc = o.cell();
    if ((oc.x === c.path_goal.x && oc.y === c.path_goal.y) || !this.isWalkable(oc)) return;
    this.astar.setSolid(oc.x, oc.y, true);
    const p = this.pathTo(c.pos, c.path_goal);
    this.astar.setSolid(oc.x, oc.y, false);
    if (p.length) { if (p.length > 1) p.shift(); c.path = p; c.path_i = 0; this.stats.repaths = (this.stats.repaths ?? 0) + 1; }
  }
  private finishWalk(c: SimChar) {
    if (c.step && c.step.type === 'approach') {
      const t = this.chars[c.step.target!];
      if (dist(c.pos, t.pos) <= ((t.kind === 'staff' || t.kind === 'clerk') ? 2.6 : 1.9) && (c.kind !== 'avatar' || lineClear(c.pos, t.pos))) { if (c.kind === 'avatar') { this.abortPlan(c, 'arrived'); this.onAvatarArrive?.(t); } else if (!Life.onArrive(this, c, t)) Social.beginChat(this, c, t); } else this.abortPlan(c, 'approach failed');
      return;
    }
    this.startNextStep(c);
  }
  private beginUse(c: SimChar, s: Step) {
    const f = this.furn[s.furn!]; const si = s.slot!; const slot = f.slots[si];
    if (f.users[si] !== -1 && f.users[si] !== c.id) { this.abortPlan(c, 'slot busy'); return; }
    f.users[si] = c.id; c.use_furn = f.i; c.use_slot = si; c.use_act = s.act!;
    const dur = ACT[c.use_act].dur;
    c.use_left = s.dur !== undefined ? s.dur : this.rng.range(dur[0], dur[1]);
    c.use_target = s.mess ?? -1; c.use_stand = s.stand ?? c.cell();
    const anchor = this.anchorPos(f, slot);
    if (dist(anchor, c.pos) > 0.06) {
      c.state = 'enter'; c.tween_from = { ...c.pos }; c.tween_to = anchor; c.tween_t = 0; c.tween_dur = Math.max(0.3, dist(c.pos, anchor) / 1.5);
      c.pose = 'walk'; c.facing = this.dirFrom({ x: anchor.x - c.pos.x, y: anchor.y - c.pos.y }, c.facing);
    } else this.enterUseState(c);
  }
  private doTween(c: SimChar, dt: number) {
    c.tween_t += dt; const k = Math.max(0, Math.min(1, c.tween_t / c.tween_dur));
    c.pos = { x: c.tween_from.x + (c.tween_to.x - c.tween_from.x) * k, y: c.tween_from.y + (c.tween_to.y - c.tween_from.y) * k };
    if (k >= 1) { if (c.state === 'enter') this.enterUseState(c); else { this.release(c); this.startNextStep(c); } }
  }
  enterUseState(c: SimChar) {
    const f = this.furn[c.use_furn]; const slot = f.slots[c.use_slot]; const act = ACT[c.use_act];
    c.state = 'use'; c.pose = poseFor(slot.pose, act.pose); c.facing = slot.face ?? c.facing; c.action_text = act.label;
    Brain.onActStart(this, c);
  }
  private doUse(c: SimChar, dmin: number) {
    const act = ACT[c.use_act];
    if (c.use_act === 'sleep') { c.slept_min += dmin; if (Brain.shouldWake(this, c)) this.endUse(c, true); return; }
    c.use_left -= dmin;
    if (c.use_left <= 0) { this.endUse(c, true); return; }
    if (act.interrupt && !c.talking && Brain.urgentNeed(c) !== '') this.endUse(c, false);
  }
  endUse(c: SimChar, completed: boolean) {
    Brain.onActEnd(this, c, completed);
    if (c.use_furn < 0) { c.use_act = ''; if (!completed) c.plan = []; this.startNextStep(c); return; }
    const f = this.furn[c.use_furn]; const slot = f.slots[c.use_slot];
    const anchor = this.anchorPos(f, slot); const stand = { x: c.use_stand.x + 0.5, y: c.use_stand.y + 0.5 };
    if (!completed) c.plan = [];
    if (dist(anchor, stand) > 0.06) {
      c.state = 'exit'; c.tween_from = { ...c.pos }; c.tween_to = stand; c.tween_t = 0; c.tween_dur = Math.max(0.3, dist(c.pos, stand) / 1.5);
      c.pose = 'walk'; c.facing = this.dirFrom({ x: stand.x - c.pos.x, y: stand.y - c.pos.y }, c.facing);
    } else { this.release(c); this.startNextStep(c); }
  }
}
export const dist = (a: V2, b: V2) => Math.hypot(a.x - b.x, a.y - b.y);
export function poseFor(slotPose: string, actPose: string): string {
  let p = slotPose === 'sit' && actPose.startsWith('sit') ? actPose : slotPose;
  if (slotPose === 'use' || slotPose === 'stand') p = actPose !== 'sit' ? actPose : 'use';
  return p;
}
export function emotionIcon(e: string): string {
  return ({ joy: 'note', content: 'smile', tired: 'zzz', hungry: 'fork', lonely: 'cloud', bored: 'dots', irritated: 'anger', angry: 'anger', sad: 'cloud', anxious: 'sweat', dirty: 'bubbles', love: 'heart', awe: 'spark' } as Record<string, string>)[e] ?? '';
}
export { DIRS };
