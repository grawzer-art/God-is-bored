# Publier GOD IS BORED sur Vercel (PWA iPhone)

## Ce que fait le projet
- `npm run build` produit `dist/` : le jeu, `manifest.webmanifest`, les icônes, `sw.js` (service worker) et `version.json`.
- `vercel.json` règle les caches : `index.html`, `sw.js` et `version.json` ne sont **jamais** mis en cache ; `/assets/*` (noms hachés) l'est pour un an.
- À chaque déploiement, l'identifiant de build change (commit Git + date). L'app installée le détecte (retour au premier plan, puis toutes les 20 min) et propose « Nouvelle version disponible — Mettre à jour ». La partie est sauvegardée automatiquement avant le rechargement. Sinon, la nouvelle version s'applique à la prochaine ouverture.
- Les sauvegardes restent dans le `localStorage` : le service worker n'y touche jamais.

## Commandes utiles
| Commande | Rôle |
|---|---|
| `npm run dev` | jeu en local, rechargement à chaud |
| `npm run build` | contrôle des types + build de production |
| `npm run preview` | sert `dist/` sur http://localhost:4173 |
| `npm test` | tests unitaires |
| `npm run e2e:pwa` | test navigateur de la PWA (manifest, hors-ligne, mise à jour, export/import) |
| `npm run icons` | régénère les icônes dans `public/icons/` |

## Sauvegardes
- Menu → **Exporter** : fichier `god-is-bored-jourN-AAAA-MM-JJ.json` (Fichiers sur iPhone).
- Menu → **Importer** : le fichier est validé (format, somme de contrôle, structure, version) avant d'être accepté. La partie précédente est gardée comme copie de secours.
- Format versionné : pour changer la structure, incrémenter `SAVE_VERSION` dans `src/sim/save.ts` et ajouter l'étape dans `MIGRATIONS`.
- Chaque adresse (domaine) et chaque appareil a son propre stockage ; l'app installée sur l'écran d'accueil a un stockage séparé de Safari. Pour transférer une partie : Exporter puis Importer.
