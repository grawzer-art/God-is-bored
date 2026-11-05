// Vérifie le rechargement à chaud : on modifie un fichier source PENDANT que la page tourne.
const { chromium } = require('playwright'); const fs = require('fs');
const URL = process.env.GAME_URL || 'http://localhost:5173/'; const FILE = 'src/ui/hud.ts';
(async () => {
  const orig = fs.readFileSync(FILE, 'utf8'); let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log(c ? '  [OK]   ' : '  [FAIL] ', m); };
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const pg = await b.newPage({ viewport: { width: 1280, height: 800 } });
  await pg.goto(URL + '?fresh&nohelp'); await pg.evaluate(() => localStorage.removeItem('gib:hot'));
  const tb = Date.now(); await pg.goto(URL + '?nohelp'); await pg.waitForFunction(() => window.__gib && window.__gib.world); console.log(`démarrage à froid du jeu : ${Date.now() - tb} ms (rendu logiciel, sans GPU)`); await pg.waitForTimeout(500);
  await pg.evaluate(() => window.__gib.setSpeed(3)); await pg.waitForTimeout(3000); await pg.evaluate(() => { window.__gib.selectChar(2); window.__gib.setSpeed(1); });
  const before = await pg.evaluate(() => ({ clock: window.__gib.world.clock, sel: window.__gib.selectedId, label: [...document.querySelectorAll('#speeds button')].map((x) => x.textContent).join(',') }));
  console.log('avant modification :', before);
  const t0 = Date.now(); const nav = pg.waitForNavigation({ timeout: 15000 });
  try {
    fs.writeFileSync(FILE, orig.replace("mk('Charger'", "mk('Charger ✓'"));
    await nav; await pg.waitForFunction(() => window.__gib && window.__gib.world); const dt = Date.now() - t0;
    const after = await pg.evaluate(() => ({ clock: window.__gib.world.clock, sel: window.__gib.selectedId, label: [...document.querySelectorAll('#speeds button')].map((x) => x.textContent).join(',') }));
    console.log('après modification :', after, `(${dt} ms entre l'enregistrement du fichier et le jeu relancé)`);
    ok(after.label.includes('Charger ✓'), 'la modification est visible dans le navigateur sans action manuelle');
    ok(dt < 8000, `rechargement complet en ${dt} ms (dont démarrage du jeu sans GPU)`);
    ok(after.clock >= before.clock, 'la partie en cours est conservée (même heure de jeu)');
    ok(after.sel === before.sel, 'le personnage sélectionné reste sélectionné');
  } finally { fs.writeFileSync(FILE, orig); }
  await pg.waitForTimeout(1500); const reverted = await pg.evaluate(() => [...document.querySelectorAll('#speeds button')].map((x) => x.textContent).join(','));
  ok(!reverted.includes('✓'), 'retour à la version d\'origine rechargé aussi'); await b.close(); process.exit(fails ? 1 : 0);
})();
