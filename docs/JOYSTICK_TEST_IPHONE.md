# Joystick — diagnostic, correctif et test manuel sur iPhone réel

## Diagnostic (reproduit sur l'ancien code par `npm run e2e:joystick`, 9 échecs sur 14 contrôles)
Causes trouvées :
1. **Aucune remise à zéro hors événements de fin de toucher** : perte de focus, passage en arrière-plan, ouverture d'un menu, changement de mode (Dieu ⇄ Descendre) laissaient `analog` / `world.input` non nuls → le personnage continuait à marcher doigt levé (dérive de 0,6 à 1,3 case mesurée).
2. **`syncInput()` quittait sans rien faire en mode Dieu** : l'entrée restait figée à sa dernière valeur et reprenait au retour en mode humain.
3. **Identifiant de pointeur périmé** : si un `pointerup` était perdu (geste système iOS), l'identifiant du joystick restait « tenu » et **ignorait tous les toucher suivants** (joystick mort, 0,00 case parcourue). `setPointerCapture` pouvait aussi lever une exception qui laissait l'état corrompu.
4. Touches clavier restées enfoncées si la fenêtre perdait le focus.

## Correctif
- `GameScene.resetInput()` : vide clavier, joystick, boutons A/B, garde de combat et entrée du monde. Appelée à : `blur`, `pagehide`, `visibilitychange` (caché), `orientationchange`, `contextmenu`, ouverture de toute fenêtre non « monde » (Nav), `descend`, `ascend`, `incarnate`, `replaceWorld`.
- `syncInput()` met l'entrée du monde à zéro hors du mode humain.
- Joystick (`ui/mobile.ts`) : `release()` idempotent ; reprise de main si l'identifiant est périmé (`hasPointerCapture`) ; `setPointerCapture` protégé ; filets de sécurité `pointerup`/`pointercancel`/`touchend`/`touchcancel` au niveau de la fenêtre ; même logique pour A et B (une garde tenue est relâchée).
- Aucun blocage supplémentaire des gestes système.

## Preuve de test (`npm run e2e:joystick`, iPhone 13 émulé, vrais événements tactiles CDP)
Relâchement normal · toucher annulé (touchCancel) · perte de focus · arrière-plan · menu ouvert en tenant · dialogue ouvert en tenant · aller-retour Dieu/Descendre en tenant · multitouch avec A · pointeur fantôme · clavier + perte de focus · **12 interruptions successives (annulation, blur, menu, relâché, arrière-plan, mode) : le personnage s'arrête toujours et le joystick répond de nouveau**. Résultat actuel : tout vert ; avant correctif : échecs listés ci-dessus.

## Scénario de test manuel sur iPhone RÉEL (à faire, non validé sur appareil)
1. Ouvrir https://god-is-bored.vercel.app (Safari ou icône d'écran d'accueil), mode Descendre.
2. Pousser le joystick, **relâcher** : le personnage doit s'arrêter immédiatement. Répéter 20 fois, vite.
3. Tenir le joystick puis **balayer depuis le bas** (retour accueil) ou **bord gauche** (retour) puis revenir dans le jeu : le personnage ne doit pas marcher seul.
4. Tenir le joystick, **verrouiller / déverrouiller** l'écran : arrêt à la reprise.
5. Tenir le joystick et toucher **A** de l'autre pouce : pas de blocage ; relâcher les deux : arrêt.
6. Tenir le joystick et toucher **Menu** : le menu s'ouvre, le personnage s'arrête ; fermer le menu : le joystick répond.
7. Tenir le joystick et passer **Dieu ⇄ Descendre** : au retour, aucun déplacement fantôme.
8. Poser **trois doigts** (geste multitâche iOS) puis relâcher : le joystick doit répondre au toucher suivant.
9. Faire pivoter l'iPhone pendant que le joystick est tenu : arrêt.
Noter l'appareil, la version d'iOS, et tout cas où le personnage continue seul : joindre une courte vidéo.
