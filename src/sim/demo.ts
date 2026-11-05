/** Situation de démonstration LIVING NORIA : un petit groupe, des conditions de départ réalistes, aucun résultat scénarisé.
 *  Lucas (sans emploi, presque sans argent, peu scrupuleux) est en froid avec Théo (parti travailler, de l'argent dans sa chambre) ;
 *  Margaux (retraitée, bienveillante) range la chambre voisine. Ce qui suit — vol éventuel, témoin, rumeur, confrontation,
 *  conséquences — découle des règles de vie (besoins, personnalité, relations, mémoire), pas d'un script. */
import type { World } from './world';
import * as Brain from './brain';

export const DEMO = { thief: 5, victim: 3, witness: 6, friend: 1, absent: 0 } as const; // Lucas, Théo, Margaux, Mehdi, Camille

export function setupNoriaDemo(w: World) {
  w.clock = 9 * 60; w.lastDay = w.day();
  const R = w.chars;
  const free = (x: number, y: number) => { const c = w.nearestFreeCell({ x, y }, 4); return { x: c.x + 0.5, y: c.y + 0.5 }; };
  const wake = (id: number, x: number, y: number) => { const c = R[id]; w.abortPlan(c, 'demo'); c.pos = free(x, y); c.state = 'idle'; c.needs.energy = Math.max(c.needs.energy, 78); c.needs.hunger = Math.max(c.needs.hunger, 55); c.slept_min = 480; c.decision_cooldown = 1 + id * 0.3; return c; };
  // Théo travaille (chantier) : absent jusqu'à 15 h 30, avec de l'argent dans sa chambre. Aïcha aussi (jusqu'à 18 h).
  for (const [id, until, pay] of [[3, 15.5 * 60, 150], [4, 18 * 60, 80]] as [number, number, number][]) {
    const c = R[id]; w.abortPlan(c, 'demo'); c.away = true; c.jobPhase = 'working'; c.jobStart = w.clock - 60; c.jobUntil = until; c.stats.worked_day = 1; c.money = pay; c.state = 'idle';
  }
  const lucas = wake(DEMO.thief, 14, 12); lucas.money = 3; lucas.shift = null;
  lucas.intent = { kind: 'steal', target: DEMO.victim, ev: -1, until: w.clock + 240 };
  const margaux = wake(DEMO.witness, 24.5, 3.5); margaux.plan = [{ type: 'wait', act: 'tidy', dur: 55 }]; w.startNextStep(margaux);
  wake(DEMO.friend, 4, 12).needs.hunger = 62; wake(DEMO.absent, 14, 12);
  wake(7, 14, 14); // Karim (travaille à 11 h)
  w.lastTheft = -99999;
  w.emitLog('Démonstration LIVING NORIA : Lucas est à court d\'argent, Théo est au travail, Margaux range sa chambre.', 'god');
}

/** DÉMO VIVANTE — trois habitants, trois façons de vivre, uniquement avec les vrais systèmes (besoins, utilité, trajets, conversations, relations, mémoire).
 *  A (Aïcha) : routine du matin → petit-déjeuner (elle se sert, mange à table), puis départ au travail à l'heure.
 *  B (Lucas) : installé devant la télé, sa faim devient urgente → il interrompt tout pour aller manger.
 *  C (Camille) : besoin de compagnie très fort → engage spontanément la conversation, ce qui modifie sa relation et laisse un souvenir.
 *  Les cinq autres sont sortis pour la journée (hors carte) : rien d'autre ne perturbe l'observation. Aucun message ni mouvement préenregistré. */
export const TRIO = { A: 4, B: 5, C: 0, partner: 1 } as const; // partner : Mehdi, voisin de Camille (ami) — son interlocuteur naturel
export const TRIO_ROLE: Record<number, string> = { 4: 'Routine du matin', 5: 'Besoin urgent : la faim', 0: 'Cherche de la compagnie' };
export function setupTrioDemo(w: World) {
  w.clock = 7 * 60 + 5; w.lastDay = w.day();
  const R = w.chars; const free = (x: number, y: number) => { const c = w.nearestFreeCell({ x, y }, 5); return { x: c.x + 0.5, y: c.y + 0.5 }; };
  for (const id of [2, 3, 6, 7]) { const c = R[id]; w.abortPlan(c, 'demo'); c.away = true; c.jobPhase = 'out'; c.jobUntil = w.clock + 12 * 60; c.stats.worked_day = 1; c.state = 'idle'; }
  const wake = (id: number, x: number, y: number) => { const c = R[id]; w.abortPlan(c, 'demo'); c.pos = free(x, y); c.state = 'idle'; c.needs.energy = 85; c.slept_min = 480; c.wake_target = c.wake_base = 400; c.decision_cooldown = 0.5 + id * 0.2; c.intent = null; return c; }; // levés tôt : le matin de la démo ne se rendort pas
  const a = wake(TRIO.A, 5, 13); a.needs.hygiene = 62; a.last_shower = w.clock - 90; a.needs.hunger = 28; a.needs.social = 70; a.needs.bladder = 70;
  const c0 = wake(TRIO.C, 7, 15); c0.needs.social = 5; c0.needs.hunger = 80; c0.needs.fun = 70; c0.needs.hygiene = 75; c0.needs.bladder = 70;
  const b = wake(TRIO.B, 15, 14); b.needs.hunger = 60; b.needs.social = 80; b.needs.hygiene = 70; b.needs.bladder = 70; b.needs.fun = 25; b.shift = null; b.money = 30;
  // Mehdi (le voisin) prépare un plat : il est joignable pour une conversation pendant ~25 min
  const m = wake(TRIO.partner, 3, 14); m.needs.hunger = 35; m.needs.social = 70; const cook = w.freeSlots('cook')[0]; if (cook) { m.plan = [{ type: 'goto', cell: cook.stand }, { type: 'use', furn: cook.f, slot: cook.s, act: 'cook', stand: cook.stand }]; w.startNextStep(m); }
  // Lucas s'installe devant la télé (décision réelle du cerveau), PUIS sa faim devient urgente : il lui faut interrompre la télé.
  Brain.tryAct(w, b, 'tv');
  for (let i = 0; i < 900 && !(b.state === 'use' && b.use_act === 'tv'); i++) w.tick(0.1);
  b.needs.hunger = 4; w.stats.trio_ready = 1;
  w.emitLog('Démo vivante : Aïcha (A) suit sa routine, Lucas (B) a une faim urgente, Camille (C) cherche de la compagnie.', 'god');
}
