# OPERATION NORIA — OVERNIGHT BUILD (rapport)

Branche : `overnight/noria-beach` (fusionnée dans `main` par paliers). Tests : iPhone 13 émulé dans Chromium (rendu logiciel). **Aucun test sur un vrai iPhone**, aucune mesure de fluidité sur appareil.

## TERMINÉ ET TESTÉ
- **P0 Navigation** : pile unique (`ui/nav.ts`), ✕ / Retour / Échap cohérents, pas de fenêtres empilées, pas de clic à travers, anti double-appui sur les boutons. `npm run e2e:nav` (parcours A–D, ouverture rapide, orientation, audit des boutons).
- **P1 Parcours complet** : logo → menu → nouvelle partie → créateur (9 catégories) → appartement → Noria Beach → première mission → sauvegarde → reprise. `npm run e2e:start`.
- **P2 Noria Beach** : promenade, sable, sable mouillé, océan non praticable, palmiers dessinés à la main, parasols, transats, bancs. Nom de quartier « Noria Beach ». Captures `docs/shots/beach-*.png`.
- **P3 Fondateurs** : `sim/founders.ts` (10 fondateurs : âge, quartier, métier, personnalité, ambition, secret, routine ; 7 quartiers canoniques). Tommy Blake (livreur, Noria Beach, secret lié à Victor Kane) et la capitaine Elena Reyes existent dans la simulation. Quête secondaire « Le livreur du front de mer ».
- **P5 Combat de base** : `sim/combat.ts` — coups de poing (dialogue › Frapper), blessures réelles, KO (PNJ allongé, se relève), riposte ou fuite selon la personnalité, témoins et police via le système de délits, KO du joueur (réveil chez lui, 15 % de l'argent perdu). `npm run e2e:combat`.
- Tests unitaires : 136 (Vitest). Batteries e2e : voir `/tmp/battery7.log` (copie dans le rapport final).

## IMPLÉMENTÉ MAIS NON VALIDÉ SUR APPAREIL
- Toute l'interface tactile (iPhone réel : sécurité des zones, gestes, performances).

## PARTIEL
- Fondateurs : 3 sur 10 présents dans le monde (Tommy Blake, Elena Reyes ; Maya Torres, Flex Rivera, Dr Carter, Roxanne Bell, Victor Kane, Elliot Park, Ghost Walker, Père Elijah sont des données prêtes mais sans quartier construit).
- Combat : poings uniquement ; pas d'armes, pas de combat entre PNJ spontané (seulement riposte).
- Sauvegarde : l'état KO n'est pas sauvegardé (le personnage se relève au chargement).

## NON COMMENCÉ
- Mirage Strip, Golden Hills, South Noria, Blackwater Docks, Eden Campus (seulement données).
- Romance entre adultes, dialogues adultes, naissances/familles/générations, mystère « Le Voile » en jeu, véhicules conduisibles, vraie économie (loyers, impôts), cycle jour/mois/année configurable.
- Portrait iPhone (le jeu reste en paysage).
