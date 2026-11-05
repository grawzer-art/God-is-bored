# NORIA OPEN WORLD 18+ — audit, architecture et plan

## 1. Audit de départ
- Simulation pure (`src/sim`), rendu (`src/view`), HUD DOM (`src/ui`), art procédural (`src/art`) : séparation saine, conservée.
- Limites trouvées : carte 48×22 (une maison + un bar), sol dessiné en un seul canvas (limite iOS), aucun commerce, aucune loi, un seul « monde » de 10 personnages.

## 2. Architecture évolutive (ce qui a été posé)
| Brique | Fichiers | Principe |
|---|---|---|
| Carte en quartiers | `sim/layout.ts` | grille 96×40, bâtiments décrits comme des données (`BUILDINGS`), pièces à lettre unique (éclairage par pièce), portes `X` |
| Rendu par blocs | `view/scene.ts` | sol cuit par blocs 16×16, chargés du plus proche au plus lointain, déchargés hors champ |
| Bâtiments | `view/scene.ts`, `art/city.ts` | façades, toits, enseignes ; toit effacé à l'intérieur, murs retexturés seulement pour le bâtiment concerné |
| Population | `sim/city.ts` | citoyens (agenda domicile/travail/café/parc), commerçant, policiers |
| Commerce | `sim/shop.ts`, `sim/interact.ts` | article pris = objet porté, non payé ; sortir sans payer = vol |
| Crime & police | `sim/crime.ts` | événement → témoins (vue directe, distance) → appel retardé → dépêche → agent libre le plus proche → poursuite → arrestation → amende, garde à vue, casier |
| Recherche | HUD `ui/citylife.ts` | étoiles 0–3, décroissance de la chaleur, bandeau « non payé », écran de garde à vue |
| LOD | `sim/life.ts` | décisions 3× plus rares loin du point de vue |
| Sauvegarde | `sim/save.ts` | champs optionnels : les anciennes sauvegardes se chargent (10 → 19 personnages) |

## 3. Livré dans cette tranche (jouable, testé)
Centre-ville est (x57–94) avec épicerie, commissariat (cellule), café, 3 immeubles, parc ; rue Centrale et rue du Marché ; 6 citoyens, 1 commerçant, 2 policiers qui circulent ; vol à l'étalage avec témoin, appel, poursuite, arrestation, libération, casier ; DIEU → DESCENDRE « ici » ; sauvegarde du casier.

## 4. Pas encore fait (honnêtement)
INCARNER un PNJ ; véhicules ; agression/sang ; personnalisation de l'avatar, logement à posséder/meubler ; revente/commerce ; substances/addictions ; romance/jalousie/nudité contextuelle ; quartiers nocturne, industriel/port, civique, nature/côte ; voitures d'ambiance ; justice simplifiée ; abstraction des PNJ très lointains au-delà du LOD.

## 5. Tests
109 tests unitaires ; `npm run e2e:city` (taille/blocs, Dieu→Descendre, entrer dans l'épicerie, prendre un article, sortir sans payer, arrestation/libération, sauvegarde, citoyens visibles). Anciennes suites e2e : mobile, iphone, freelife, living, observe, trio, human, pwa vertes ; `e2e.cjs` (bureau, rendu logiciel) est instable en temps (un test différent échoue d'une exécution à l'autre, tous passent par intermittence).
Non testé : vrai iPhone, vrai GPU (le navigateur de test rend en logiciel).

## 6. Tranche suivante (proposition)
1. INCARNER (possession d'un PNJ, restitution sans mémoire, souvenirs des autres conservés).
2. Agression avec sang/blessures visibles, riposte et fuite des témoins, PNJ↔PNJ.
3. Domicile du joueur (clé, meubles posables) et argent (vente d'objets).
4. Véhicules animés, quartier port/industriel.
