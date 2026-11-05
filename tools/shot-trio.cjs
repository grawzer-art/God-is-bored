// Captures de la démo vivante sur iPhone émulé (paysage) : voir les habitants vivre.
const { chromium, devices } = require('playwright');
const URL = process.env.GAME_URL || 'http://localhost:5173/';
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ ...devices['iPhone 13 landscape'], viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 }); const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(String(e)));
  await pg.goto(URL + '?demo=trio&nohelp'); await pg.waitForFunction(() => window.__gib && window.__gib.world, null, { timeout: 60000 }); await pg.waitForTimeout(2500);
  await pg.screenshot({ path: 'docs/shots/trio-1-debut.png' });
  await pg.evaluate(() => window.__gib.selectChar(5, true)); await pg.waitForTimeout(2500); await pg.screenshot({ path: 'docs/shots/trio-2-lucas.png' });
  await pg.waitForTimeout(5000); await pg.evaluate(() => window.__gib.selectChar(4, true)); await pg.waitForTimeout(1500); await pg.screenshot({ path: 'docs/shots/trio-3-aicha.png' });
  console.log('errs', errs.length); await b.close();
})();
