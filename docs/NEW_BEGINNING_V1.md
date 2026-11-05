# GOD IS BORED — NEW BEGINNING V1

Parcours de démarrage reconstruit, sans toucher à la ville, au moteur, aux PNJ, aux pouvoirs divins ni aux anciennes sauvegardes.
Branche de restauration : `restore/pre-new-beginning` (état juste avant cette mise à jour).

## 1. Ce qui a été développé
| Phase | Contenu | Fichiers |
|---|---|---|
| A. Générique + menu | générique GRAW STUDIO (police pixel 5×7 et sprite de main créés pour le jeu, apparition à 0,3 s, doigt à 0,8 s, glitch à 1,5 s, son rétro synthétisé, PASSER, animations réduites respectées), menu (Nouvelle partie, Continuer, Charger, Paramètres, Crédits) sur le vrai monde NORIA au crépuscule | `start/intro.ts`, `start/pixel.ts`, `start/sfx.ts` |
| Paramètres | volume général, volume des effets, musique du menu, qualité (haute / économe), taille d'interface, sensibilité du joystick, réduction des animations, texte agrandi, contraste renforcé : tous appliqués | `start/settings.ts` |
| B. Créateur | identité (prénom, nom, pseudo, pronom, âge adulte), morphologie (8 teintes, 3 carrures, 3 tailles), visage (forme ×5, yeux ×5, sourcils ×4, nez ×4, bouche ×4, oreilles ×3, taches de rousseur, 3 cicatrices, 6 barbes), cheveux (13 coupes, 14 couleurs, barbe assortie ou non), vêtements (9 hauts, 3 bas, 20 couleurs, 7 chaussures, 18 tenues complètes en 6 styles), accessoires (10), tatouages (6 emplacements × 4 motifs), personnalité (8 traits, 3 au plus), aperçu pivotant, zoom visage, animations de test, aléatoire, réinitialisation par catégorie, préréglages | `start/creator.ts`, `art/chars.ts`, `sim/profile.ts` |
| C. Appartement | « Studio Noria » (gratuit) : séjour-cuisine, chambre, salle de bains, porte ; kit de départ + 450 € ; décoration complète (voir IPHONE_V2.md) + rotation des lits et chaises, changement de tenue depuis l'armoire, « Apparence » dans le menu | `sim/home.ts`, `ui/deco.ts` |
| D. Moteur de quêtes | quêtes en données pures, objectifs « tous / dans l'ordre / une voie suffit », événements réels du moteur, récompenses (argent, réputation, déblocages), quêtes émergentes, état sauvegardé | `sim/quests.ts` |
| E. Chapitre 1 | 5 missions jouables + 3 défis divins + 1 activité libre | `sim/quests.ts`, `sim/interact.ts` |
| Journal | 5 sections, suivi/masquage, historique, indicateurs, suivi d'objectif discret (une ligne), narrations plein écran | `ui/journal.ts` |

## 2. Avatar modulaire : ce qui est réel
Chaque combinaison est dessinée par les mêmes fonctions que dans le monde (`previewFigure` → `figure`/`face`) : ce que montre le créateur est exactement le personnage en jeu, sauvegardé avec la partie (`avatarLook`) et rechargé.
- Tatouages : visibles seulement là où la peau est visible (bras = manches courtes, jambes = short/jupe, torse = débardeur, mains, cou, visage).
- 13 coupes, 5 formes de visage… : **tous réellement dessinés**. Bibliothèque extensible : ajouter une coupe = un `case` dans `hair()`, un visage = une valeur dans `face()`.

## 3. Quêtes jouables (chapitre 1)
1. **Bienvenue chez toi** : être dans le studio → placer un meuble → changer un mur ou un sol → sauvegarder (dans l'ordre). +120 €, réputation, catalogue étendu.
2. **Premier contact** : sortir → parler à un habitant → consulter sa fiche → faire un choix de dialogue. +80 €. Conséquence réelle : relation et souvenir chez l'habitant.
3. **L'argent ne tombe pas du ciel** : épicerie → accepter la livraison → remettre le colis au destinataire (déplacement réel dans la ville) → être payé.
4. **Une ville pleine de possibilités** : une voie parmi quatre (aider, livrer, boire un verre au bar, faire les poches) ; récompenses et réputation différentes.
5. **Le Créateur** : mode Dieu → observer → pouvoir → revenir → constater la conséquence. Épilogue.
Défis divins : bénir 3 habitants, effacer des souvenirs, donner 10 000 €. Activité : livraisons payées. Événement émergent : un habitant affamé et sans argent demande de l'aide.

## 4. Honnêteté : ce qui n'est PAS fait
- **Pas de voix** (aucun système vocal) ; **proportions fines** du corps (sprite 28×48) ; **rotation** limitée aux lits et chaises (les autres meubles n'ont qu'un sprite).
- **Pas de palmiers dans la ville, ni de plage, ni de Noria Beach** : le décor du menu est le centre-ville existant au crépuscule, avec deux palmiers pixel art en avant-plan. La refonte urbaine californienne n'est pas faite.
- **Inviter des habitants dans l'appartement** : non implémenté.
- **Propriétés multiples** : seule la structure (`w.property`) existe.
- Les quêtes secondaires émergentes : un seul type (faim). Voisin, objet perdu, dispute, vengeance : à venir.
- Progression : réputation, activités, découvertes et chapitres existent ; « contacts » et « accès à certains lieux » sont des drapeaux sans effet de jeu pour l'instant. Seul le catalogue de meubles est réellement verrouillé/déverrouillé.
- Musique : une petite boucle d'ambiance synthétisée au menu uniquement. Sons : clics, validation, quête, générique.
- iOS : le son ne démarre qu'après un premier toucher, donc le jingle du générique peut être muet à la toute première ouverture.

## 5. Tests
- 127 tests unitaires (dont profil, nouvelle partie, quêtes, sauvegarde, anciennes sauvegardes).
- `npm run e2e:start` : les 19 étapes demandées, dans le vrai jeu (iPhone 13 émulé, rendu logiciel) : générique, menu, paramètres, créateur (cheveux, vêtements, tatouages, traits), appartement (achat, pose, mur), sortie, dialogue, fiche, livraison payée, choix de voie, mode Dieu et retour, sauvegarde, fermeture/réouverture par « Continuer ».
  Les déplacements longs et l'ouverture des dialogues utilisent les mêmes fonctions que le toucher (`walkTo`, `openDialogue`), pas des clics pixel par pixel sur la carte.
- Pas de vrai iPhone ; pas de mesure de fluidité sur appareil.

## 6. Assets manquants / à produire
Palmiers et végétation californienne, plage, villas, sprites de voiture de police ; coiffures supplémentaires (tresses variées, dreadlocks, cheveux attachés haut…) ; vêtements : robes longues, manteaux, tenues de sport spécifiques (sprites 28×48, 4 vues) ; tatouages grands formats ; sons et musiques originaux en fichiers (actuellement synthétisés).
