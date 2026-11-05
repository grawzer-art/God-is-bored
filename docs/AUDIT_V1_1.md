# Audit V1.1 — l'intelligence des habitants, état réel du code

Mesures faites sur une partie neuve de 16 h de jeu (06 h 52 → 22 h 52, 8 habitants, graine 1337) avant V1.1 :
~100 décisions au total (≈ 6 par heure de jeu), 10 conversations, 27–47 % du temps en marche, 27–50 % hors carte (travail), 5–40 % endormis.

## Réellement opérationnel (effet sur la simulation)
| Capacité | Preuve dans le code |
|---|---|
| Décisions autonomes | `brain.ts` : score d'utilité par activité (besoins, heure, personnalité, habitudes apprises) ; `decide()` à chaque fin d'activité |
| Besoins qui influencent les actions | 6 besoins qui déclinent (`updateNeeds`) ; un besoin urgent interrompt l'activité (`urgentNeed` → `endUse`) |
| Destinations cohérentes | plans `goto` → `use` sur de vrais meubles (frigo, douche, canapé…), A* sur la carte, portes, trajets maison ↔ rue ↔ bar ↔ travail |
| Interactions spontanées | décision « chat » (approche + session de conversation), conversations ambiantes entre voisins |
| Souvenirs | `memories` (60 max, élagage par poids) ; événements du monde avec provenance (LIVING NORIA V1) |
| Relations modifiées par les événements | `Social.apply` + `Life` : affection, confiance, peur, respect, tension, rancune |
| Simulation indépendante du joueur | `World.tick` ne dépend pas de l'avatar ; le joueur n'est qu'un habitant de plus (`kind: 'avatar'`) |

## Simulé surtout par du texte / peu efficace
* Le **contenu** des conversations est une réplique tirée au hasard (`LINES_*`) : seule la *qualité* (agréable / gênante / dispute) est calculée et agit sur les relations.
* Les souvenirs ordinaires (« discussion agréable… ») sont descriptifs : leur effet passe par les valeurs déjà modifiées (affection, évitement, préférences), pas par le texte.
* Le journal décrit ; il ne décide de rien.

## Manquait (cause de l'impression « ville statique »)
1. Rien n'indiquait **ce que fait** ou **où va** un habitant : pas d'icône d'activité, pas de trajet, pas de destination lisible.
2. Une partie neuve commençait à 6 h 52 : presque tout le monde dormait.
3. Beaucoup d'habitants hors carte (travail) sans moyen de voir qu'ils sont « partis ».
4. L'inactivité se traduisait par une errance aléatoire dans la pièce.
5. Les bulles d'émotion duraient en temps de **jeu** (0,4 s réelle à ×8).
6. Vitesses ×1 / ×3 / ×8 seulement ; animations de marche non accélérées.
7. Peu de conversations (≈ 10 en 16 h).

## Corrigé dans V1.1
Icônes d'activité au-dessus des têtes (ce qu'ils font, ou vont faire) · trajet en pointillés + destination de l'habitant observé · fiche et carte rapide : activité, destination, besoin prioritaire, objectif, humeur, relations, souvenirs marquants · bouton « Suivre » · démarrage à 8 h 30 à ×2 · bulles en temps réel · vitesses ×1, ×2, ×3, ×8 · animations proportionnelles à la vitesse · errance remplacée par des points d'intérêt · départ au travail à l'heure (interrompt une activité interruptible) · plus de besoin social → plus de conversations · démo vivante à trois habitants.
