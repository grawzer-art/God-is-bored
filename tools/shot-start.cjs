// Captures du parcours de démarrage (iPhone 13 émulé dans Chromium, pas un vrai iPhone).
const { chromium, devices } = require('playwright');
const URL = process.env.GAME_URL || 'http://localhost:5173/';
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }); const errs = [];
  const ctx = await b.newContext({ ...devices['iPhone 13 landscape'], viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 }); const pg = await ctx.newPage(); pg.on('pageerror', (e) => errs.push(String(e)));
  await pg.goto(URL + '?pwa=1'); await pg.waitForTimeout(900); await pg.screenshot({ path: 'docs/shots/start-1-logo.png' });
  await pg.waitForTimeout(700); await pg.screenshot({ path: 'docs/shots/start-2-doigt.png' });
  await pg.waitForTimeout(3500); await pg.screenshot({ path: 'docs/shots/start-3-menu.png' });
  console.log('errors:', errs.length, errs.slice(0, 2)); await b.close();
})();
