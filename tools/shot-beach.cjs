// Captures de Noria Beach (rendu réel, iPhone 13 paysage émulé).
const { chromium, devices } = require('playwright');
const URL = process.env.GAME_URL || 'http://localhost:5173/';
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ ...devices['iPhone 13 landscape'], viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 }); const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(String(e)));
  for (const [name, q] of [['beach-1', 'zoom=0.85&at=24,27&speed=0&simulate=300'], ['beach-2', 'zoom=0.85&at=24,27&speed=0&simulate=1000']]) {
    await pg.goto(URL + '?fresh&nohelp&god&' + q); await pg.waitForFunction(() => window.__gib && window.__gib.world, null, { timeout: 60000 }); await pg.waitForTimeout(3500);
    await pg.screenshot({ path: `docs/shots/${name}.png` });
  }
  console.log('erreurs :', errs.length ? errs.join(' | ') : 'aucune'); await b.close();
})();
