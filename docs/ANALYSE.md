# Analyse : Godot (export web) ou Phaser 3 + TypeScript + Vite ?

*Contexte : jouer dans Safari (Mac, puis iPhone), voir chaque modification de code immédiatement, souris + clavier. Je n'ai aucune trace du projet SPARROW dans cette conversation : le critère « comme SPARROW » est interprété d'après votre description (serveur local, hot reload, Safari).*

## Option A — garder Godot 4 et l'exporter en web

| Critère | Constat |
|---|---|
| Boucle de développement | **Pas de hot reload dans le navigateur.** Chaque changement = ré-export web (`--export-release Web`) puis rechargement. Godot ne remplace pas du GDScript à chaud dans un build web. On peut servir le dossier exporté avec un petit serveur et un watcher qui ré-exporte, mais le délai est de l'ordre de la dizaine de secondes, pas de la seconde. |
| Mise en place | Il faut les modèles d'export Godot (plusieurs centaines de Mo) installés sur la machine qui exporte. Non téléchargés ni testés ici. |
| Poids du jeu | Le moteur WebAssembly pèse plusieurs dizaines de Mo avant compression (ordre de grandeur connu de Godot 4, **non mesuré ici**). |
| Safari / iPhone | Le build multi-thread exige les en-têtes COOP/COEP (`SharedArrayBuffer`) ; Godot 4.3 propose un export mono-thread qui évite cela. La mémoire d'un onglet iPhone est limitée : risque réel avec un gros wasm. |
| Intégration au web | Canvas isolé ; communication avec la page via `JavaScriptBridge`. UI en `Control` Godot. |
| Atout | **Tout est déjà écrit et testé** (rendu, lumière, 120 vérifications). |

## Option B — Phaser 3 + TypeScript + Vite

| Critère | Constat (mesuré ici) |
|---|---|
| Boucle de développement | **Rechargement à chaud automatique.** Test réel : un fichier modifié pendant que la page tourne → la page se recharge seule et **la partie reprend à la même heure de jeu, avec le même personnage sélectionné** (l'état est sauvegardé juste avant le rechargement). Délai mesuré : ~5 s dans mon bac à sable *sans GPU* (dont ~2 s de démarrage du jeu) ; nettement moins sur un Mac. |
| Poids | 1,6 Mo (387 Ko compressé) pour tout le jeu, Phaser inclus. |
| Démarrage | ~2 s sans GPU ; 32 images/s en rendu purement logiciel. |
| Safari / iPhone | Pur JavaScript + WebGL/Canvas, aucune exigence d'en-têtes. Gestes tactiles (glisser, pincer) et pincement trackpad Safari gérés. **Testé sous Chromium uniquement** (pas de WebKit/Safari réel ici). |
| Interface | HTML/CSS par-dessus le canvas : sélection de texte, accessibilité, mises en page responsives (mode compact iPhone paysage testé en capture). |
| Tests | Simulation testable en pur TypeScript (Vitest), jeu testé de bout en bout dans un vrai navigateur (Playwright) : clics, clavier, tactile, sauvegarde. |
| Coût | Il a fallu **porter** le code (≈ 5 800 lignes de GDScript → ≈ 2 500 lignes de TypeScript). Fait et vérifié. |

## Recommandation : **Option B (Phaser 3 + TypeScript + Vite)**

C'est la seule des deux qui donne ce que vous demandez : modifier, enregistrer, voir. Elle est aussi plus légère et plus sûre sur iPhone. Le projet Godot **reste intact** (`/home/user/god-is-bored-v1`) : il sert de référence de design et reste jouable sur Mac si vous le souhaitez.

## Ce qui a été préservé (portage fidèle)

La simulation est de la logique pure, sans rendu, donc portée 1:1 avec les mêmes paramètres et les mêmes règles :

| Système Godot (GDScript) | Équivalent web (TypeScript) |
|---|---|
| `Defs`, `HouseLayout`, `Roster` | `sim/defs.ts`, `sim/layout.ts`, `sim/roster.ts` — mêmes huit personnages, même plan, mêmes meubles |
| `World` (grille, A*, plans, horloge, besoins, humeur) | `sim/world.ts`, `sim/astar.ts` |
| `Brain` (décision par utilité, plans, effets) | `sim/brain.ts` |
| `Social` (conversations, relations, **souvenirs**, objectifs) | `sim/social.ts` |
| `God` (4 pouvoirs, ennui divin) | `sim/god.ts` |
| `SaveSystem` | `sim/save.ts` (localStorage) |
| Art procédural (sols, murs fins, meubles, personnages, icônes) | `art/*.ts` sur Canvas 2D |
| Éclairage jour/nuit (Light2D) | `view/lighting.ts` : carte de lumière multipliée sur la scène |
| HUD Godot | `ui/hud.ts` en HTML/CSS |

Mêmes contrôles de qualité : 3 jours simulés sans téléportation, besoins bornés, personne dans un mur, chacun mange/dort/se lave/discute, relations et préférences qui évoluent, déterminisme par graine, sauvegarde fidèle, pouvoirs divins. Différence connue : le générateur aléatoire n'est pas celui de Godot, donc une même graine ne raconte pas la même histoire dans les deux versions.
