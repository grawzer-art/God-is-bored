# LIVING NORIA V1 — vie autonome des habitants

Moteur local, déterministe (même graine = même histoire), sans réseau ni service d'IA. Tout est dans `src/sim/` (aucune dépendance au rendu).

## Ce qui existait déjà (conservé)
Besoins, personnalités (5 traits), humeur/émotions, objectifs, relations orientées, souvenirs, décision par utilité (`brain.ts`), conversations (`social.ts`), pouvoirs divins, sauvegarde versionnée.

## Ce que LIVING NORIA ajoute (`life.ts`, `demo.ts`)
| Système | Effet réel sur la simulation |
|---|---|
| **Emplois** | 5 habitants ont des horaires distincts (Théo 7 h 45–15 h 30, Aïcha 9–18 h, Mehdi 10–16 h 30, Karim 11–19 h, Inès 15–20 h). Ils quittent la carte par la porte, reviennent, sont payés au prorata des heures. |
| **Argent** | Salaires, loyer/courses quotidiens (45 €), pension (Margaux), ventes ponctuelles (Camille), verres au bar (4 €, payés au barman). |
| **Recherche d'emploi** | Sans emploi et moins de 12 € : part chercher du travail (2 h 30–3 h 40) ; selon la personnalité, trouve un vrai emploi (horaires, paie) ou rentre bredouille et stressé. |
| **Sorties au bar** | Le soir, selon besoin social, loisirs, argent, amis présents : un habitant va au bar, boit (et paie), discute, puis rentre. Une fois par jour au plus. |
| **Mémoire avec provenance** | Chaque habitant sait, par événement : *vécu* (témoin), *raconté* (par qui, avec quelle confiance) ou *soupçonné* (sans preuve). Absent = ignore tout, y compris l'identité du coupable. 40 savoirs et 60 souvenirs max (les plus significatifs sont gardés). |
| **Relations bilatérales** | affection, confiance, peur, respect, tension (hostilité déduite). Une dispute laisse une rancune de 6 h de jeu (conversations plus difficiles, évitement), une réconciliation exige un geste (excuses) et peut être refusée. |
| **Événements du monde** | `theft`, `dispute`, `help`, `job`, `reconcile` : persistants, avec témoins, conséquences et rumeurs. |
| **Vol** | Un habitant fauché et peu scrupuleux (morale = 0,55·bienveillance + 0,45·ordre < 0,5) cible un colocataire riche, endormi ou absent, fouille sa chambre. Témoins : éveillés, à moins de 6,5 cases, sans mur entre eux. La victime découvre plus tard, ignore l'auteur et peut le soupçonner d'après ses rancunes. Le joueur peut aussi faire les poches (dialogue) : il est reconnu des seuls témoins. |
| **Rumeurs** | À chaque conversation, chacun peut raconter à l'autre ce qu'il sait et que l'autre ignore ; la crédibilité baisse à chaque maillon (et selon la confiance envers celui qui raconte). |
| **Réactions** | Selon la personnalité : prévenir la victime, confronter, protéger un ami (loyauté), avoir peur (stress, évitement). La victime confronte ou évite ; le coupable avoue et rend l'argent ou nie (dispute). Une accusation sans preuve peut être injuste. |
| **Aide spontanée** | Un ami aisé et bienveillant prête de l'argent, prépare un repas ou réconforte. |
| **Habitudes** | Évitement des personnes brouillées (conversations, coins de la maison). |
| **Simplification (LOD)** | Les habitants à plus de 18 cases du joueur (ou du centre de la caméra) font leurs pas de « vie » trois fois moins souvent. Les habitants hors carte sont simulés par minuteur. |

## Observer
* **Mode Dieu** : fiche d'un habitant → *Vie* (travail, argent, intention), *Ce qu'il sait* (provenance et confiance), *Confiance · peur · respect · hostilité*, souvenirs étiquetés *[vécu] [raconté] [soupçonné]*. Le journal décrit les actions (vols, rumeurs, confrontations…).
* **Démo** : `?demo=noria` ou **Menu → Démo NORIA** (partie en cours sauvegardée, autosave suspendue pendant la démo). Situation de départ : Lucas (sans emploi, 3 €) en froid avec Théo (au travail), Margaux range la chambre voisine. Le reste (vol, témoin, rumeur, confrontation, conséquences) découle des règles.
* **Poser le téléphone** : `npm run e2e:observe` joue une partie neuve 90 s à x8 sans intervention.

## Tests
`tests/living.test.ts` (20 tests : routines, besoin qui change la décision, interactions, conflit durable, témoin/absent, transmission, conséquences, soupçon, aide, réconciliation, sauvegarde, anciennes sauvegardes, LOD, limites, déterminisme) ; `tools/e2e-living.cjs` (démo dans le vrai jeu) ; `tools/e2e-observe.cjs`.

## Reste à développer
Reproduction/naissances (n'existe pas : population fixe de 8 habitants + joueur + barman), déformation progressive des rumeurs, habitants qui quittent définitivement NORIA, métiers sur la carte (les emplois se déroulent hors carte), police/justice, plus de lieux de sortie (un seul : le bar), décisions de groupe, apprentissage des habitudes sur plusieurs jours au-delà de l'évitement.
