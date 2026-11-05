# GOD IS BORED — IPHONE EXPERIENCE V2

Référence : la maquette « Interface iPhone (Vision finale) » à quatre écrans (Descendre, Mon appartement, Mode Dieu, Fiche d'habitant).
Principe : **un seul monde** (`World`), quatre portes d'entrée. Aucun écran n'a d'état propre : tout est lu et écrit dans la simulation.

## 1. Audit (avant refonte)
- INCARNER n'existait pas (le bouton « Descendre » ne faisait qu'activer l'avatar du joueur).
- La fiche d'habitant était un panneau unique à défilement (desktop) ; pas d'onglets, pas de secrets, pas d'actions sur un habitant précis.
- Mode Dieu : 4 pouvoirs à coût d'énergie ; pas de catégories.
- Appartement : déplacement/rangement par menu contextuel seulement.
- **Défaut de sauvegarde trouvé** : les traits de personnalité n'étaient pas enregistrés (recalculés depuis le roster au chargement). Corrigé.

## 2. Architecture ajoutée
| Brique | Fichier | Rôle |
|---|---|---|
| Design system | `ui/theme.ts` | jetons (verre anthracite, contour violet, accent or), `.gp`, `.gp-btn`, onglets, jauges |
| Fiche V2 | `ui/fiche.ts` | 4 onglets (Profil, Relations, Souvenirs, Secrets) + actions (INCARNER, INFLUENCER, MODIFIER, RÉVÉLER) |
| HUD Descendre | `ui/hudv2.ts` | puce avatar + quartier, argent, jauges Santé/Faim/Énergie (+Ivresse) |
| Barre divine | `ui/godbar.ts` | CRÉER · MODIFIER · ÉVÉNEMENTS · POUVOIRS · LOIS (seulement des actions réelles) |
| Décoration | `ui/deco.ts` + `sim/home.ts` | catalogue par catégories, inventaire, pose sur grille, annuler/rétablir, sols et murs |
| Incarnation | `sim/possess.ts` | prise de corps, sortie sans souvenir, journal des incarnations |
| Interventions | `sim/god.ts` | donner/retirer de l'argent, changer un trait, révéler un secret, scandale, effacer les souvenirs, téléportation |
| Lois | `sim/world.ts` (`laws`) | police active/suspendue ; pouvoirs illimités |

### Incarnation (comment ça marche)
Le corps possédé prend le rôle « avatar » (commandes, inventaire, crimes du joueur, recherche policière). L'avatar d'origine passe en `dormant`.
À la sortie : souvenirs et connaissances acquis pendant la possession sont **effacés chez le PNJ** ; les souvenirs des autres, l'argent, les blessures, les objets déplacés et les relations modifiées **restent** ; s'il était recherché, il l'est en tant que PNJ ; une entrée est ajoutée au journal des incarnations. L'état est sauvegardé.

## 3. Parcours vérifiés dans le vrai jeu (iPhone émulé, `npm run e2e:ui2`)
- **A** chez moi : bouton Décorer → catalogue → achat (solde débité) → pose sur grille → annuler/rétablir → sol et murs → valider → sortir dans la même rue.
- **B** en mode Descendre : dialogue → « Consulter sa fiche » → 4 onglets (données réelles) → fermer → gameplay.
- **C** mode Dieu : sélectionner → fiche → +100 000 € et trait modifié (changements réels, souvenir de miracle, journal divin).
- **D** INCARNER → le corps obéit au joystick → « Quitter ce corps » → autonomie retrouvée, aucun souvenir de la possession, journal tenu → sauvegarde/rechargement identiques.
- **E** (situation criminelle puis pouvoir divin) : couvert par `npm run e2e:scenario` (braquage, fuite, effacement des souvenirs, téléportation, sauvegarde).

## 4. Ce qui n'est PAS fait (et n'est donc pas proposé dans l'interface)
- Téléphone, véhicule conduisible (les voitures circulent mais ne se conduisent pas), combat, armes.
- Créer un humain / un bâtiment / un terrain ; invisibilité, foudre, contrôle mental, résurrection, manipulation du temps ; pannes et catastrophes ; lois de vieillissement et sociales.
- Rotation des meubles ; PNJ invités qui utilisent les meubles posés ; étage 3 de la maquette (un seul niveau jouable).
- Portrait : le jeu affiche toujours l'écran « Tournez votre iPhone ». Les panneaux ont des règles CSS portrait mais l'orientation reste paysage.
- Vue Dieu « maquette » avec phare, front de mer et quartiers nommés : la carte ne contient pas encore ces quartiers.
- Barre inférieure Descendre « Téléphone / Inventaire / Actions / Véhicule / Menu » : seuls Inventaire (B), Actions (A, appui long) et Menu existent.

## 5. Limites de test
Captures et tests : Chromium (iPhone 13 émulé, rendu logiciel). Pas de vrai iPhone, pas de mesure de fluidité sur appareil.
