# OPÉRATION NORIA — VISUAL OVERHAUL (rapport de session)

Référence : `docs/ref/DA_noria_reference.png`. Captures avant/après : `docs/shots/avant-*.png` (état de départ de la session) et `docs/shots/apres-*.png` (états successifs). Outil : `node tools/shot-audit.cjs <préfixe>` (4+ zones × midi / couchant / nuit, iPhone 13 paysage émulé).

## Audit (causes techniques des défauts)
1. **Nuit trop claire (cause réelle trouvée)** : les halos des lampadaires avaient un rayon de 330 px et s'additionnaient jusqu'à saturer à blanc la carte de lumière multipliée sur la scène. La luminosité moyenne de la plage « de nuit » n'était que 14 % sous celle de midi (mesure sur capture). Palette de nuit trop claire en plus.
2. **Pas de lumière colorée des commerces** : seules des enseignes de bar existaient.
3. **Plage vide et statique** : sable et mer sans mobilier balnéaire, océan figé.
4. **Voitures toutes identiques** (même carrosserie, seule la couleur changeait).
5. **Densité d'habitants limitée par la compatibilité des sauvegardes** : ajouter des citoyens change le nombre de personnages et casserait les sauvegardes existantes (chargement par index). Test tenté puis annulé : voir « Limites ».
6. Projection / profondeur : le tri par profondeur (`zOf`) et les collisions sont cohérents sur les parcours testés ; aucune régression constatée, pas de refonte (règle : ne pas remplacer un système stable).

## Réalisé (vérifié par captures et tests)
- **Éclairage** : palette jour/couchant/nuit retravaillée (couchant orangé → rose, nuit bleu profond), halos de lampadaires recalibrés. Mesure : plage nuit 48/52/70 contre 143/148/130 à midi.
- **Néons de commerces la nuit** : lumière colorée devant chaque bâtiment à enseigne (bar rose, café ambre, épicerie vert, police bleu, immeubles chauds).
- **Noria Beach** : bar tiki à néon, poste de maître-nageur, filet de volley, râtelier de planches de surf, stand de glaces cyan, serviettes, parasols, transats, palmiers dessinés à la main ; mer animée (reflets, vaguelettes, écume).
- **Voitures** : fourgon, pick-up, coupé bas, citadines, taxi à lanterne, berlines (silhouettes différentes selon le style).
- **Météo** : pluie par couches texturées qui défilent (une image au lieu de centaines de traits), éclairs, assombrissement, pouvoir divin, sauvegarde.
- **Mini-carte** et grande carte.

## Performance (mesurée, rendu LOGICIEL Chromium — pas un iPhone)
Voir `tools/perf.cjs` et `tools/perf-probe.cjs`. Résultats de départ de la session (avant optimisation de la pluie) : plage jour 28,8 FPS ; centre-ville jour 24,3 ; plage nuit + pluie 16,4 ; vue large 24,7. Ce rendu logiciel est un plancher très pessimiste : **aucune mesure sur iPhone réel n'a été faite, l'objectif de 30 FPS n'est donc pas validé.**

### Optimisations de cette session (mesure rendu logiciel, FPS moyen)
- Départ : jour 27,8 ; **nuit 13,8** (la nuit coûtait deux fois plus : cartes de lumière pleine résolution, fill-rate).
- Carte de lumière rendue à **demi-résolution** (lumière douce, quatre fois moins de pixels) : **nuit 20,4** (+48 %), aspect visuel inchangé.
- Pluie : de 220 traits dessinés par image à deux couches texturées qui défilent (une image chacune).
- Reste : nuit ≈ 20 FPS contre ≈ 28 FPS le jour en rendu logiciel ; les fenêtres éclairées (images additives par bâtiment) sont la piste suivante. **Toujours aucune mesure iPhone.**

## Non fait / limites (honnête)
- Pas de nouveaux types d'immeubles (art déco, hôtel, club) : les façades existantes (briques, plâtre, béton, vitrines à auvent, balcons) n'ont pas été étendues cette session.
- Pas de sprites de personnages refaits ni de nouvelles animations de marche.
- Densité d'habitants inchangée (voir audit 5). Il faudra introduire un format de sauvegarde versionné avec « citoyens supplémentaires » avant d'en ajouter.
- Quartiers 3 à 7 : données (`sim/founders.ts`), pas de zone jouable.
- Pas de mesure iPhone.
