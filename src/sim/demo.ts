/** Situation de démonstration LIVING NORIA : un petit groupe, des conditions de départ réalistes, aucun résultat scénarisé.
 *  Lucas (sans emploi, presque sans argent, peu scrupuleux) est en froid avec Théo (parti travailler, de l'argent dans sa chambre) ;
 *  Margaux (retraitée, bienveillante) range la chambre voisine. Ce qui suit — vol éventuel, témoin, rumeur, confrontation,
 *  conséquences — découle des règles de vie (besoins, personnalité, relations, mémoire), pas d'un script. */
import type { World } from './world';

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
