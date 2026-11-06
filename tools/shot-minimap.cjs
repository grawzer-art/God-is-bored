const { chromium, devices } = require('playwright');
const URL = process.env.GAME_URL || 'http://localhost:5173/';
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ ...devices['iPhone 13 landscape'], viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 }); const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(String(e)));
  await pg.goto(URL + '?fresh&nohelp&human&simulate=700&speed=1&zoom=1.2'); await pg.waitForFunction(() => window.__gib && window.__gib.world, null, { timeout: 60000 }); await pg.waitForTimeout(2500);
  await pg.screenshot({ path: 'docs/shots/minimap-1.png' });
  await pg.click('#mmap'); await pg.waitForTimeout(600); await pg.screenshot({ path: 'docs/shots/minimap-2-grande.png' });
  console.log('nav', await pg.evaluate(() => window.__nav.list().join()), 'erreurs :', errs.length ? errs.join(' | ') : 'aucune'); await b.close();
})();
