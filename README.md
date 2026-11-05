# GOD IS BORED — version web (Phaser 3 + TypeScript + Vite)

Simulation de vie adulte (18+) en 2.5D isométrique, **jouable dans Safari** avec rechargement à chaud.
Portage du projet Godot `god-is-bored-v1` (conservé intact). Analyse et recommandation : [docs/ANALYSE.md](docs/ANALYSE.md).

## V2 « Life, Sin & Chaos » — Phase A (quartier + mode humain)

Le jeu est désormais un petit **quartier** : la maison des huit colocataires, une rue avec trottoirs et passage piéton, lampadaires, jardin, et **le bar « Le Cinquième Ciel »** (comptoir, tabourets, tables, jukebox, piste de danse, toilettes, enseigne au néon, barman Gaby de 17 h 30 à 3 h).

- **Deux modes, un seul monde** : `G` (ou le bouton) pour *descendre* (mode humain) ou *redevenir dieu*. L'avatar, son argent, son inventaire, ce qu'il a appris et ce que les gens pensent de lui sont **dans la même simulation persistante** (sauvegarde, rechargement à chaud). Le monde continue d'évoluer dans les deux modes.
- **Mode humain** : ZQSD/WASD/flèches pour marcher (Maj : courir) avec collisions, clic pour aller quelque part ou vers quelqu'un, `E` pour interagir (menu si plusieurs choix), `I` inventaire. Entrer dans la maison ou le bar = franchir la porte. Interagir avec les meubles (frigo, canapé, toilettes, douche, jukebox, tabourets du bar…), parler aux habitants et au barman, commander (Eau, Café, Bière, Cocktail, Whisky, Chips), offrir un verre ou un objet, donner/emprunter de l'argent, plaisanter (y compris humour noir contextuel), poser une question personnelle (le secret n'est révélé que si la confiance existe), réveiller quelqu'un (mauvaise idée). Chaque choix modifie relations, souvenirs, besoins, argent, inventaire.
- **Mode diagnostic** : dans la fiche d'un habitant, **« pourquoi ? »** affiche sa dernière décision autonome : les activités candidates, leurs scores et la raison de chaque score (besoin, heure, personnalité, habitude apprise).
- **Hors périmètre de la Phase A** (volontairement) : les habitants ne vont pas encore d'eux-mêmes au bar et ne boivent pas (Phase B), pas de vol/police (Phase C), pas de véhicules (Phase D). Les lots vides du quartier (supérette, poste de police, trois autres habitations) ne sont **pas** encore construits.

Tests de la Phase A : `npm test` (33 tests de simulation, dont accessibilité du bar, collisions, dialogues, achats, persistance, compatibilité des anciennes sauvegardes) et `npm run e2e:human` (37 vérifications dans un vrai navigateur : marcher jusqu'au bar, commander, parler, repasser en dieu, recharger).

## Jouer et développer sur votre Mac (rechargement à chaud)

Prérequis : Node.js 20+.

```bash
cd god-is-bored-web
npm install
npm run dev
```

Ouvrez **http://localhost:5173/** dans Safari. Modifiez un fichier de `src/` et enregistrez : la page se recharge seule et **la partie reprend là où elle en était** (même heure, même personnage sélectionné).
Pour repartir de zéro : ajoutez `?fresh` à l'adresse.

**Sur iPhone** (même Wi‑Fi) : `npm run dev` affiche une ligne `Network: http://192.168.x.x:5173/` ; ouvrez cette adresse dans Safari sur l'iPhone.

## Contrôles

**Mode dieu** — molette / pincement : zoom · ZQSD / flèches / glisser : déplacer · clic ou toucher : sélectionner · double-clic : centrer · `F` : suivre · `Tab` : suivant · `Espace` : pause · `[` `]` : vitesse · `V` : murs · `1`–`4` : pouvoirs (`Échap` annule) · `F5`/`F9` : sauvegarder/charger · `H` : aide · `F3` : performances · `G` : descendre / redevenir dieu.

**Mode humain** — `ZQSD`/flèches : marcher · `Maj` : courir · `E` : interagir · `I` : inventaire · clic : aller vers · `1`–`9` : choix des dialogues · `Échap` : fermer · `G` : redevenir dieu.

Paramètres d'URL : `?fresh` `?seed=42` `?load` `?simulate=75` (avance de 75 s) `?speed=3` `?zoom=2` `?at=14,8` `?focus=3` `?walls=2` `?nohelp`.

## Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` | serveur de développement + hot reload (0.0.0.0:5173) |
| `npm test` | 9 tests de simulation (Vitest) |
| `npm run e2e:human` | test de jeu du mode humain (Playwright) |
| `npm run e2e` | test de jeu complet dans un vrai navigateur (Playwright, `GAME_URL` pour viser un autre serveur) |
| `node tools/hmr-test.cjs` | vérifie le rechargement à chaud et la conservation de la partie |
| `node tools/shot.cjs out.png "?simulate=75"` | capture d'écran réelle |
| `npm run build` / `npm run build:single` | build de production / un seul fichier HTML autonome (`dist-single/index.html`) |

(Les outils Playwright supposent `npm i -D playwright` ou une installation globale.)

## Architecture

```
src/sim/    simulation pure TypeScript (aucun rendu) : world, brain, social, god, save, astar, defs, layout, roster
src/art/    sprites PROCÉDURAUX sur Canvas 2D (assets provisoires) : core (sols, murs, icônes), furn, chars
src/view/   Phaser : scene (caméra, entrées, boucle), charview, lighting, iso
src/ui/     interface HTML/CSS
tests/      Vitest (simulation)    tools/  e2e, hmr-test, shot
```

⚠️ **Tous les graphismes sont provisoires** (générés par du code) ; voir l'inventaire du projet Godot `docs/ASSETS_PROVISOIRES.md`, le principe est identique.

## Limites connues

- Testé sous **Chromium** (Playwright, rendu logiciel). **Pas encore testé dans un vrai Safari ni sur un iPhone.**
- Pas de son. Pas de menu principal. Le contenu adulte (romance, tromperie, violence…) reste à construire sur les fondations en place.
