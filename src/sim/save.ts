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
// ---------------------------------------------------------------------------
// Migrations : MIGRATIONS[n] transforme une sauvegarde de version n en version n+1.
// À chaque évolution du format, incrémenter SAVE_VERSION et ajouter l'étape ici : les anciennes parties restent chargeables.
export const MIGRATIONS: Record<number, (d: any) => any> = {};
/** Met une sauvegarde à la version courante. Lève une Error lisible si impossible. */
export function migrate(d: any): any {
  if (!d || typeof d !== 'object' || !Number.isInteger(d.version) || d.version < 1) throw new Error('Version de sauvegarde inconnue.');
  if (d.version > SAVE_VERSION) throw new Error('Cette sauvegarde vient d\'une version plus récente du jeu. Mettez le jeu à jour.');
  let cur = d;
  while (cur.version < SAVE_VERSION) {
    const step = MIGRATIONS[cur.version];
    if (!step) throw new Error(`Aucune migration depuis la version ${cur.version}.`);
    cur = { ...step(cur), version: cur.version + 1 };
  }
  return cur;
}

// ---------------------------------------------------------------------------
// Fichier d'export (enveloppe JSON) + validation à l'import.
export const FILE_FORMAT = 'god-is-bored-save';
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
export const BACKUP_KEY = 'god-is-bored:backup';
export interface SaveSummary { day: number; residents: number; version: number }
export type ImportResult = { ok: true; payload: any; summary: SaveSummary } | { ok: false; error: string };

/** Somme de contrôle FNV-1a 32 bits (détecte une corruption ou une édition accidentelle, pas une protection anti-triche). */
export function checksum(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}
export function exportText(w: World, build = ''): string {
  const payload = toJSON(w);
  return JSON.stringify({ format: FILE_FORMAT, version: SAVE_VERSION, build, exportedAt: new Date().toISOString(), summary: { day: w.day(), residents: w.residents.length }, checksum: checksum(JSON.stringify(payload)), payload }, null, 1);
}
const fin = (v: any) => typeof v === 'number' && Number.isFinite(v);
const isPos = (p: any) => p && fin(p.x) && fin(p.y);
/** Contrôle de structure d'une charge utile (déjà migrée). Renvoie un message d'erreur ou null. */
export function validatePayload(d: any): string | null {
  if (!d || typeof d !== 'object') return 'Contenu illisible.';
  if (d.version !== SAVE_VERSION) return 'Version de sauvegarde incompatible.';
  for (const k of ['seed', 'clock', 'godEnergy', 'ennui', 'pot', 'potCook', 'potTime', 'feastUntil', 'nextMessId']) if (!fin(d[k])) return `Champ invalide : ${k}.`;
  if (!fin(d.rng) && typeof d.rng !== 'number') return 'Champ invalide : rng.';
  if (d.clock < 0 || d.clock > 1e9) return 'Horloge hors limites.';
  if (!d.stats || typeof d.stats !== 'object') return 'Statistiques manquantes.';
  if (!Array.isArray(d.rel) || d.rel.some((e: any) => !Array.isArray(e) || e.length !== 2)) return 'Relations invalides.';
  if (!Array.isArray(d.furn) || !Array.isArray(d.mess) || !Array.isArray(d.chars)) return 'Listes manquantes.';
  if (d.chars.length < 1 || d.chars.length > 64) return 'Nombre d\'habitants invalide.';
  const ids = new Set<number>();
  for (const c of d.chars) {
    if (!c || !Number.isInteger(c.id) || c.id < 0 || ids.has(c.id)) return 'Identifiant d\'habitant invalide.';
    ids.add(c.id);
    if (!isPos(c.pos)) return `Position invalide (habitant ${c.id}).`;
    if (!c.needs || NEEDS.some((n) => !fin(c.needs[n]))) return `Besoins invalides (habitant ${c.id}).`;
    if (!Array.isArray(c.memories) || !c.goal || typeof c.goal !== 'object' || !c.avoid || !c.pref || !c.stats) return `Données incomplètes (habitant ${c.id}).`;
    for (const k of ['joy', 'stress', 'anger', 'faith']) if (!fin(c[k])) return `Champ invalide : ${k} (habitant ${c.id}).`;
  }
  return null;
}
/** Analyse un fichier importé : enveloppe ou ancienne sauvegarde brute. N'altère rien. */
export function parseImport(text: string): ImportResult {
  try {
    if (text.length > MAX_IMPORT_BYTES) return { ok: false, error: 'Fichier trop volumineux.' };
    let raw: any; try { raw = JSON.parse(text); } catch { return { ok: false, error: 'Ce fichier n\'est pas un JSON valide.' }; }
    let payload = raw;
    if (raw && raw.format !== undefined) {
      if (raw.format !== FILE_FORMAT) return { ok: false, error: 'Ce fichier n\'est pas une sauvegarde de GOD IS BORED.' };
      if (!raw.payload) return { ok: false, error: 'Sauvegarde vide.' };
      if (raw.checksum !== checksum(JSON.stringify(raw.payload))) return { ok: false, error: 'Fichier corrompu ou modifié (somme de contrôle invalide).' };
      payload = raw.payload;
    } else if (!raw || !Array.isArray(raw.chars)) return { ok: false, error: 'Ce fichier n\'est pas une sauvegarde de GOD IS BORED.' };
    payload = migrate(payload);
    const bad = validatePayload(payload); if (bad) return { ok: false, error: bad };
    const w = fromJSON(payload); if (!w) return { ok: false, error: 'La partie n\'a pas pu être reconstruite.' };
    return { ok: true, payload, summary: { day: w.day(), residents: w.residents.length, version: payload.version } };
  } catch (e: any) { return { ok: false, error: e?.message ?? 'Fichier invalide.' }; }
}
/** Écrit la charge utile validée dans le slot, en gardant l'ancienne partie dans BACKUP_KEY. */
export function commitImport(payload: any): boolean {
  try {
    const prev = localStorage.getItem(SAVE_KEY); if (prev) localStorage.setItem(BACKUP_KEY, prev);
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload)); return true;
  } catch { return false; }
}
export function restoreBackup(): World | null { try { const s = localStorage.getItem(BACKUP_KEY); return s ? fromJSON(migrate(JSON.parse(s))) : null; } catch { return null; } }
export function hasBackup(): boolean { try { return localStorage.getItem(BACKUP_KEY) !== null; } catch { return false; } }

export function save(w: World): boolean { try { localStorage.setItem(SAVE_KEY, JSON.stringify(toJSON(w))); return true; } catch { return false; } }
export function hasSave(): boolean { try { return localStorage.getItem(SAVE_KEY) !== null; } catch { return false; } }
export function load(): World | null { try { const s = localStorage.getItem(SAVE_KEY); return s ? fromJSON(migrate(JSON.parse(s))) : null; } catch { return null; } }
