# GOD IS BORED V2 — GAMEPLAY REBORN (rapport d'étape)

Branche de travail : `overnight/noria-beach`. Tous les tests ci-dessous : iPhone 13 émulé (paysage 844×390) dans Chromium, rendu logiciel. **Aucun test sur un vrai iPhone ; aucune mesure de fluidité sur appareil.**

## Instructions de test local
```bash
npm install
npx vite --port 5173                       # jeu : http://localhost:5173/?fresh&nohelp&human
npx vitest run                              # 171 tests unitaires
NODE_PATH=$(npm root -g) npm run e2e:combat # idem : e2e:debt, e2e:god, e2e:romance, e2e:nav, e2e:mobile, e2e:start …
```
Clavier de développement : flèches/ZQSD = déplacement, **E** = interagir, **X** = attaquer (maintenu = coup puissant ; hors combat, X cherche la bagarre avec la personne devant soi), **K** = garde (maintenu), **L** = esquive (+ direction), **Échap/B** = retour, **G** = Dieu ⇄ Descendre.

## Ce qui est TERMINÉ ET TESTÉ
**Phase B — dialogues RPG** (`e2e:human`, `e2e:mobile`, `e2e:romance`)
- Boîte compacte en bas de l'écran (nom, portrait, texte qui s'écrit vite), options regroupées en catégories (Discuter ▸, Séduire ▸, Échanger ▸, Provoquer ▸, La dette ▸) pour éviter les listes géantes. **A** termine le texte puis valide l'option en surbrillance, la croix/le joystick haut-bas déplace la sélection, **B** revient (catégorie → menu → fermeture).

**Phase C — combat Tekken-lite en temps réel** (`tests/fight.test.ts` 15 tests, `e2e:combat`)
- Dans la rue, sans changer d'écran. A rapide / A maintenu (puissant) / B garde / direction + B esquive / A·A·A combo (3 coups, finisseur qui étourdit).
- Hitboxes en cône (portée + angle), recul, étourdissement, interruption d'un coup en préparation, garde de face (−80 %) avec endurance et rupture de garde, esquive à image d'invulnérabilité, KO + chute, endurance.
- IA des adversaires : s'approche, attaque, bloque, esquive, recule, fuit à bas PV ; agressivité et compétence tirées de la personnalité (Victor Kane : très compétent).
- Conséquences : témoins qui fuient ou regardent, signalements/police via le système de délits, souvenirs, rancune, réputation. Les PNJ se battent aussi entre eux. Blessures sauvegardées ; l'état de combat est transitoire.
- Retours : étoile d'impact, étincelle de garde, trace dans le vide, textes K.O./ESQUIVE, secousse de caméra, sons synthétisés, barres de vie (joueur + endurance, adversaire), compteur de combo.

**Phase D — mode Dieu et Incarner** (`e2e:god`)
- Pas de joystick en mode Dieu (caméra au doigt, pincer pour zoomer, toucher pour sélectionner), bouton ◐ pour masquer toute l'interface, bouton de vitesse, bouton Dieu/Descendre.
- Nouveaux pouvoirs réels : **Foudre** (dégâts sérieux jamais mortels, KO possible, témoins, souvenirs) et **Émotion** (joie, colère — peut déclencher une bagarre —, tristesse, calme, attirance). Chaîne choisir → cibler → **confirmer** → effet visible ; ✕ annule sans fenêtre fantôme.
- Incarner : même commandes que Descendre, vérifié sur Tommy Blake.

**Phase E — scénario émergent « La dette de Tommy »** (`tests/debt.test.ts` 12 tests, `e2e:debt`)
- État du monde (5 000 €, échéance, étape, issue) simulé : à l'échéance, **Victor Kane** (détective corrompu, ajouté en fin de liste de citoyens : les anciennes sauvegardes restent chargeables) vient réclamer l'argent à Tommy (bulles de parole visibles), puis perd patience et le frappe.
- Issues jouables : payer (total ou partiel), négocier un délai (réussite probabiliste selon relation/personnalité), menacer, bagarre temps réel (Victor KO → vendetta : il revient plus tard), police (Elena enquête ou le dossier est étouffé selon la corruption), miracle divin (si Tommy reçoit la somme, il paie), incarner Tommy (mêmes règles, on paie de sa poche).
- Dialogue de Tommy : « Putain, je dois 5 000 balles à un mec. » avec les 4 choix demandés. Quête secondaire, réputation multi-dimensions (sociale, romantique, criminelle, professionnelle, police) visible dans Menu › Réputation.

**Zinc Club (version minimale jouable)** (`tests/debt.test.ts`)
- Maya Torres (chanteuse) et Victor Kane fréquentent le club le soir. « Inviter à danser » (adultes, refus respecté), proposition illégale de Victor : colis à remettre au barman pour 300 € (réputation criminelle, soupçon policier si un agent voit l'échange).
- Flirt, rendez-vous, couple, soirée (ellipse), rupture : voir `docs/OVERNIGHT_NORIA.md` (consentement comme condition du système, adultes uniquement).

## IMPLÉMENTÉ MAIS NON VALIDÉ SUR APPAREIL
Tout le tactile (A maintenu, B + joystick pour l'esquive), la lisibilité des combats sur écran réel, les performances. Les effets sonores n'ont pas été écoutés (WebAudio non vérifiable en navigateur sans son).

## PARTIEL
- **Phase A** : la « croix directionnelle » est un joystick analogique (8+ directions, vitesse proportionnelle) et non une croix à quatre boutons ; caméra automatique, collisions, A contextuel, B retour : existants et testés.
- Dialogues : pas de cadre d'« écran de dialogue » avec défilement multi-pages ; le texte s'écrit mais la plupart des échanges tiennent en une réplique.
- Vie nocturne : danse et mission ; pas de bagarre de club déclenchée automatiquement, pas de rencontres de personnages supplémentaires.
- Scénario : une séquence de ≈15 min jouable à plusieurs issues ; non chronométrée sur parcours réels.

## NON COMMENCÉ
Véhicules conduisibles, cambriolage / vol de voiture / vandalisme, gangs organisés au-delà de Victor, armes, quartiers hors Noria Beach, mini-jeux, propagation de rumeurs spécifique au scénario (le moteur de rumeurs existant s'applique aux délits).

## Limites connues
- Tests e2e en rendu logiciel : quelques suites restent intermittentes (flaky) selon la charge de la machine (freelife, mobile).
- Les combats utilisent le générateur aléatoire du monde (déterministe à graine égale) mais la vitesse de jeu ×3 accélère aussi les combats.
