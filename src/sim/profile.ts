/** Profil du joueur (créateur de personnage) et état d'une NOUVELLE PARTIE : avatar, argent, appartement de départ, kit de meubles, quêtes, progression. */
import { World } from './world';
import type { Look } from './roster';
import * as Quests from './quests';

export interface Profile { first: string; last: string; nick: string; pronoun: '' | 'il' | 'elle' | 'iel'; age: number; traits: string[]; createdAt: number }
export const TRAITS: { id: string; label: string; desc: string; d: Partial<Record<'extraversion' | 'agreeableness' | 'neuroticism' | 'orderliness' | 'openness', number>> }[] = [
  { id: 'ambitieux', label: 'Ambitieux', desc: '+10 % sur les paies de petits boulots', d: { orderliness: 0.1, openness: 0.1 } },
  { id: 'sociable', label: 'Sociable', desc: 'Les conversations rapprochent plus vite', d: { extraversion: 0.2 } },
  { id: 'impulsif', label: 'Impulsif', desc: 'Moins de rigueur : décisions rapides', d: { orderliness: -0.2 } },
  { id: 'creatif', label: 'Créatif', desc: 'Ouvert aux idées neuves', d: { openness: 0.2 } },
  { id: 'charismatique', label: 'Charismatique', desc: 'Affection gagnée plus vite en dialogue', d: { agreeableness: 0.1, extraversion: 0.1 } },
  { id: 'solitaire', label: 'Solitaire', desc: 'Le besoin social baisse moins vite', d: { extraversion: -0.2 } },
  { id: 'rebelle', label: 'Rebelle', desc: 'Moins aimable, plus frondeur', d: { agreeableness: -0.2 } },
  { id: 'prudent', label: 'Prudent', desc: 'Plus rigoureux, moins anxieux', d: { orderliness: 0.2, neuroticism: -0.1 } },
];
export const MAX_TRAITS = 3;
export const defaultProfile = (): Profile => ({ first: 'Alex', last: 'Noria', nick: '', pronoun: '', age: 28, traits: [], createdAt: 0 });
export const clean = (s: string, n = 16) => s.replace(/[<>&"]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
export const hasTrait = (w: World, id: string) => !!w.profile?.traits.includes(id);
/** Multiplicateur d'affection gagnée par le joueur en dialogue. */
export const affinityMult = (w: World) => (hasTrait(w, 'charismatique') ? 1.25 : 1) * (hasTrait(w, 'sociable') ? 1.1 : 1);
/** Multiplicateur de paie des petits boulots. */
export const payMult = (w: World) => (hasTrait(w, 'ambitieux') ? 1.1 : 1);

/** Applique identité et apparence au personnage du joueur (en cours de partie ou à la création). */
export function applyProfile(w: World, p: Profile, look: Look) {
  const a = w.avatar; const prof: Profile = { ...p, first: clean(p.first) || 'Alex', last: clean(p.last), nick: clean(p.nick, 14), age: Math.max(18, Math.min(90, Math.round(p.age))), traits: p.traits.slice(0, MAX_TRAITS) };
  w.profile = prof; a.look = JSON.parse(JSON.stringify(look)); a.first = prof.nick || prof.first; a.name = `${prof.first} ${prof.last}`.trim(); a.age = prof.age;
  a.gender = prof.pronoun === 'elle' ? 'F' : prof.pronoun === 'il' ? 'M' : a.gender; a.bio = 'Nouvel arrivant à NORIA. Personne ne sait qui vous êtes vraiment.';
  const base = { extraversion: 0.6, agreeableness: 0.6, neuroticism: 0.3, orderliness: 0.5, openness: 0.7 } as Record<string, number>;
  for (const id of prof.traits) { const t = TRAITS.find((x) => x.id === id); if (t) for (const [k, v] of Object.entries(t.d)) base[k] = Math.max(0, Math.min(1, base[k] + (v ?? 0))); }
  a.traits = base as any; w.profileVersion++;
}
/** Nouvelle partie : monde neuf, avatar créé, appartement « Studio Noria » attribué, kit de départ, quêtes initialisées. */
export function newGame(p: Profile, look: Look, seed = Date.now() % 100000): World {
  const w = new World(seed); w.build(); for (let i = 0; i < 480; i++) w.tick(0.1);                 // la ville s'éveille
  w.clock = Math.floor(w.clock / 1440) * 1440 + 9 * 60; w.profile = { ...p, createdAt: w.clock }; applyProfile(w, w.profile, look);
  const a = w.avatar; a.money = 450; a.pos = { x: 66.5, y: 28.5 }; a.state = 'idle'; a.plan = []; a.away = false; a.needs = { hunger: 75, energy: 85, bladder: 80, hygiene: 85, social: 60, fun: 60 };
  w.avatarControlled = true; w.property = { id: 'studio_noria', name: 'Studio Noria', building: 'flats1', rent: 0, since: w.clock };
  w.stash = { floor_lamp: 1, plant: 2, coffee_table: 1, table: 1, bin: 1 };                         // kit de départ gratuit (en plus des meubles déjà installés : lit, canapé, télé, frigo…)
  Quests.init(w); return w;
}
