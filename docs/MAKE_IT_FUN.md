# OPÉRATION MAKE IT FUN — rapport par lots

Branche : `overnight/noria-beach`. Tous les tests : iPhone 13 émulé (844×390) dans Chromium en rendu logiciel. **Aucun test sur un vrai iPhone, aucune mesure de fluidité sur appareil.**

## LOT 1 — Joystick (TERMINÉ ET TESTÉ)
- **Bug reproduit** sur l'ancien code (`npm run e2e:joystick`, 9 échecs sur 14 contrôles) : le personnage continuait à marcher après perte de focus, arrière-plan, ouverture de menu, changement de mode ; un pointeur « fantôme » rendait le joystick totalement mort.
- **Causes** : aucune remise à zéro hors événements de fin de toucher ; `syncInput` figé en mode Dieu ; identifiant de pointeur périmé jamais libéré ; `setPointerCapture` pouvant lever une exception ; touches clavier collées.
- **Correctif** : `GameScene.resetInput()` appelé à toute interruption, reprise d'identifiant périmé, filets de sécurité `pointerup/pointercancel/touchend/touchcancel` sur la fenêtre, même logique pour A/B. Détail : `docs/JOYSTICK_TEST_IPHONE.md` (+ scénario manuel iPhone réel, **à exécuter**).
- **Preuve** : 12 interruptions successives (annulation, blur, menu, relâché, arrière-plan, mode) → le personnage s'arrête toujours et le joystick répond de nouveau ; tout vert.
- Effet de bord corrigé : la touche **J** de combat ouvrait le journal ; les touches de combat sont maintenant **X** (attaque), **K** (garde), **L** (esquive).

## LOT 2 — Intérieurs (PARTIEL)
Audit des bâtiments (accessible / intérieur / habitants / activités / horaires / rôle) :
| Bâtiment | Accès | Contenu et activités | État |
|---|---|---|---|
| Studio Noria (Les Mouettes) | oui | lit, douche, garde-robe (tenues), cuisine, canapé/TV, stockage, **décoration complète** | complet (existant) |
| Supérette | oui | rayons, caisse, commerçant, achats, **vol à l'étalage et réactions**, braquage | complet (existant) |
| Café | oui | tables, serveuse, clients, conversations | existant (peu d'événements dédiés) |
| Zinc Club / Mirage | oui | bar, piste (tapis), jukebox qui s'allume la nuit, videur Moe, Maya, Roxanne, danse, flirt, mission, dispute | **construit cette session** |
| **Garage de Léo** | oui | établis, voiture sur cric, outils, comptoir, **travail rémunéré répétable**, clé à molette (+40 % de paye), Léo, Tommy y travaille de 12 h à 15 h | **construit cette session** |
| Commissariat | oui | bureaux, cellule, Elena Reyes (interrogatoire) | existant |
| Hôtel Pacifica | hall seulement | lobby (réception) ; étages non accessibles | partiel |
| Immeubles d'arrière-plan | non | décor | volontairement non entrables |

## LOT 4 — Garage et économie (TERMINÉ ET TESTÉ en unitaire ; capture réelle)
`tests/garage.test.ts` : bâtiment réel, établis atteignables, Léo travaille, paye du joueur, outil, fermé la nuit. Captures `docs/shots/garage-*.png`.

## LOT 3 / 6 — Campagne « NORIA — LES ROIS DU VIDE » (TERMINÉ ET TESTÉ en unitaire + e2e partiel)
Moteur étendu : délais (`limit`), échecs (`failOn`, délai dépassé) marqués « échouée » dans le journal, crochets de mission (`start/done/fail`), événements de zone (plage, club la nuit, garage…), `buy`, `gift_to`, `delivered`, `club_social`, `dispute_end`, `case_clean`. Sauvegardé avec la partie ; les parties existantes reçoivent les missions.

| Mission | Déclencheur | Actions jouables | Succès / échec / conséquences |
|---|---|---|---|
| **1 · Bienvenue à Noria** | appartement prêt | descendre sur la plage, trouver Tommy (il est amené sur la plage), acheter un sandwich à la caisse, le lui offrir | +60 €, Tommy vous fait confiance ; échec (trop tard) : Tommy plus distant |
| **2 · Un petit service** | fin de la 1 | colis de Tommy pour Maya ; **Victor Kane vous intercepte** (mentir / avouer : il prend la moitié / lui donner : mission perdue / se battre en temps réel) ; livraison au Zinc | réussite : l'échéance de la dette de Tommy recule d'un jour ; échec : elle se rapproche, Tommy vous en veut |
| **3 · Les mauvaises fréquentations** | fin de la 2 | la dette de Tommy (scénario émergent) : payer, négocier, menacer, bagarre, police, miracle, incarner Tommy | échec si Tommy est passé à tabac ; sinon réputations et vendetta selon l'issue |
| **4 · Une nuit au Mirage** | fin de la 3 | entrer après 22 h, parler à Maya, **danser ou flirter**, accepter le service de Roxanne, **régler la dispute** (parole, appeler Moe le videur, ou frapper) | +250 €, Roxanne vous apprécie (VIP) ; échec si vous finissez KO |
| **5 · Personne n'a rien vu** | fin de la 4 | interrogatoire d'Elena (mentir / nier / se taire / tout avouer), **faire taire les témoins** (parole ou 100 €), **payer Victor 500 €** pour égarer le dossier, ou pouvoir divin d'effacement | si aucun témoin ne vous cite : « personne n'a rien vu » ; sinon (délai dépassé) arrestation |
Tests : `tests/campaign.test.ts` (les 5 missions, leurs branches, échecs, sauvegarde), `tools/e2e-campaign.cjs` (journal, mission 1 jouée, offre, embuscade, interrogatoire dans le vrai jeu).

## LOT 7 — Directeur d'événements (TERMINÉ ET TESTÉ en unitaire)
`sim/director.ts` : disputes de rue (entre habitants qui se supportent mal), vol à l'étalage par un client fauché, **contrôle de police** (colis illégal, recherche, ivresse), rumeurs, accrochages, rapprochements. Garde-fous testés : écart ≥ 3 h entre événements, cooldown par type, jamais deux fois le même d'affilée, une dispute à la fois, rien pendant un dialogue. Actif dans les parties réelles (pas dans les démos ni les tests unitaires).

## LOT 5 — Dialogues, flirt, relations, club (existant + compléments)
Dialogues RPG compacts, flirt/rendez-vous/couple/soirée en ellipse/rupture (adultes, consentement respecté), danse, vie nocturne (musique, videur), réputation en 5 dimensions (Menu › Réputation).

## NON FAIT / LIMITES
- **Conduite de véhicules** : non commencée (les voitures circulent mais ne se conduisent pas).
- Cambriolage, vol de voiture, vandalisme : non commencés (vol à l'étalage, braquage et recel existent).
- Hôtel : étages non accessibles. Café : peu d'événements propres.
- Les missions sont jouables et testées, mais **l'équilibrage** (difficulté, durée des délais) n'a pas été éprouvé par un joueur humain : critère « quinze minutes sans impression de démo » **non validé**.
- Missions 3 à 5 : pas de test e2e complet dans le vrai jeu (testées en simulation et par morceaux).
- Marcus Rivera et Lena Carter existent comme habitants (hôtel/plage, secrets, routines) mais n'ont pas encore de mission propre.
- Aucun test sur iPhone réel.

## Batterie de non-régression (20 suites e2e + 185 tests unitaires)
Tout vert. Un défaut réel a été trouvé et corrigé pendant la batterie : près du garage, A affichait trois fois « Garage : fermé » depuis la rue (menu contextuel parasite qui coupait le joystick). Le message n'apparaît plus que depuis l'intérieur du garage et une seule fois ; `e2e:joystick` repasse au vert (3 échecs avant, 0 après) et le test unitaire du garage vérifie le message depuis l'intérieur.
