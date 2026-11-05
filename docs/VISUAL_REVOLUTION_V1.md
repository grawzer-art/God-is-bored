# NORIA VISUAL REVOLUTION V1 — audit, architecture, quartier pilote

Direction artistique validée : **pixel art isométrique ultra-détaillé** (pas de 3D). Référence : la planche « Habbo × GTA × Les Sims × RimWorld + tu es le Dieu de leur monde » (phase 1 = quartier pilote).

## 1. Audit graphique
- Pourquoi les bâtiments ressemblaient à des « rectangles ouverts » : la maison et le bar étaient des coupes d'intérieur sans façade ni toit ; les immeubles du centre-ville n'avaient qu'un étage, une seule texture de mur et un toit gris translucide en mode Dieu (effet « verre »).
- Rendu : sprites générés par code (canvas), un sprite par cellule pour le mobilier, murs texturés par cellule, sol cuit par blocs de 16×16. Compatible avec collisions, A* et sauvegardes : rien de tout cela n'a été changé côté simulation, sauf l'ajout de meubles et de pièces (index de meubles existants inchangés).
- Décision : évolution progressive (composants réutilisables), pas de refonte du moteur.

## 2. Ce qui a été fait (réellement intégré au jeu)
| Domaine | Réalisation | Fichiers |
|---|---|---|
| Façades | module `facade.ts` : matériaux (brique avec joints/rangs décalés, béton à panneaux, enduit), plinthe, bandeaux d'étage, corniche à denticules, 1 à 3 étages selon la hauteur, vitrines de commerce avec store à festons et marchandises, fenêtres à 4 variantes (rideaux, volets, jardinière, climatiseur), balcons, affiches / tags / tuyaux / boîtiers pour casser la répétition | `art/facade.ts`, `art/core.ts` |
| Toits | toit à quatre pans à tuiles (maison) avec cheminées et lucarnes ; toits plats avec acrotère, gravillon, flaques, réservoirs, mât radio, climatiseurs ; panneaux publicitaires satiriques sur pied | `art/city.ts` |
| Bâtiments fermés | maison et bar deviennent des « coques » (`shell`) : façade + toit à l'extérieur, intérieur inchangé | `sim/layout.ts`, `view/scene.ts` |
| Intérieurs | en mode Dieu un bâtiment s'ouvre « comme une maison de poupée » quand il masque le centre de l'écran (hystérésis de zoom) ; en mode humain il s'ouvre quand on y entre ; plan en coupe (murs bas) pour voir la rue derrière | `view/scene.ts` |
| Appartement | « Les Mouettes » : séjour-cuisine, chambre, salle de bains, couloir ; portes intérieures, meubles utilisables | `sim/layout.ts` |
| Rue | 10 nouveaux objets (borne d'incendie, boîte aux lettres, kiosque, cabine, distributeur, jardinières, râteliers à vélos, bennes, panneaux d'affichage, voitures garées) ; enseignes satiriques (MINI-MARCHÉ, CAFÉ CULPA, FOYER BONHEUR™, LES MOUETTES™) | `art/furn.ts`, `sim/defs.ts` |
| Circulation | 10 voitures sur l'avenue (2 voies, sens opposés), freinent devant voitures et piétons ; générateur aléatoire séparé (n'influence pas les habitants) ; non sauvegardées | `sim/traffic.ts`, `view/scene.ts` |
| Personnages | nouveaux hauts (blazer, veste, uniforme de police), coiffures (afro, crête, queue-de-cheval), accessoires (bonnet, lunettes noires) ; citoyens et policiers redessinés | `art/chars.ts`, `sim/city.ts` |
| Nuit | fenêtres éclairées (un canevas additif par bâtiment, certaines éteintes), vitrines allumées | `view/scene.ts` |

## 3. Limites restantes
- Pas d'outil de dessin externe : tous les assets sont **procéduraux** (provisoires). Méthode réaliste d'intégration pour des sprites faits à la main : atlas PNG par bâtiment/personnage chargé à la place des fonctions `drawExterior`/`figure` ; les clés de cache (matériau, kind, variante) sont déjà stables.
- Les étages supérieurs ne sont pas visitables (un seul niveau jouable) ; la planche de référence montre des appartements empilés visibles en coupe : à traiter par une « tranche verticale » dédiée.
- Pas encore de boîte de nuit, de banque, de palmiers, de graffitis grands formats, de voitures de police, ni de néons de quartier distincts.
- Animations de marche : 4 directions par miroir, pas d'animation de vol/combat.
- Performances : mesurées en rendu logiciel (pas de GPU, pas d'iPhone). Voir le rapport de livraison.

## 4. Généralisation à toute NORIA
1. Décrire chaque bâtiment en données (`BUILDINGS` : matériau, étages, kind, enseigne, toit) — fait pour 8 bâtiments.
2. Quartiers : riche (enduit, balcons, voitures de luxe), pauvre (béton, tags, bennes), festif (néons, club), industriel/port (conteneurs, grues), criminel (ruelles, entrepôts) = jeux de paramètres de `ExtSpec` + palettes.
3. Remplacer progressivement les assets procéduraux par des atlas peints, sans changer la simulation.
4. Étages visitables, puis boîte de nuit, banque (braquage), voitures de police.
