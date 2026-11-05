// Captures du créateur de personnage (iPhone 13 émulé dans Chromium, pas un vrai iPhone).
const { chromium, devices } = require('playwright');
const URL = process.env.GAME_URL || 'http://localhost:5173/';
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }); const errs = [];
  const ctx = await b.newContext({ ...devices['iPhone 13 landscape'], viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 }); const pg = await ctx.newPage(); pg.on('pageerror', (e) => errs.push(String(e)));
  await pg.goto(URL + '?pwa=1'); await pg.waitForSelector('#skip', { timeout: 60000 }); await pg.click('#skip'); await pg.waitForSelector('[data-a="new"]'); await pg.click('[data-a="new"]'); await pg.waitForSelector('#creator'); await pg.waitForTimeout(500);
  const shot = async (n) => { await pg.waitForTimeout(400); await pg.screenshot({ path: `docs/shots/creator-${n}.png` }); };
  await shot('1-identite');
  await pg.evaluate(() => document.querySelector('[data-cat="hair"]').click()); await pg.evaluate(() => document.querySelector('[data-hair="afro"]').click()); await pg.evaluate(() => document.querySelector('[data-hc="pink"]').click()); await shot('2-cheveux');
  await pg.evaluate(() => document.querySelector('[data-cat="face"]').click()); await pg.evaluate(() => { document.querySelector('[data-beard="full"]').click(); document.querySelector('[data-eyes="3"]').click(); }); await shot('3-visage');
  await pg.evaluate(() => document.querySelector('[data-cat="cloth"]').click()); await pg.evaluate(() => document.querySelector('[data-set="streetwear:0"]').click()); await shot('4-vetements');
  await pg.evaluate(() => document.querySelector('[data-cat="tat"]').click()); await pg.evaluate(() => { document.querySelector('[data-tat="hand:1"]').click(); document.querySelector('[data-tat="face:0"]').click(); }); await shot('5-tatouages');
  await pg.evaluate(() => document.querySelector('[data-a="zoom"]').click()); await shot('6-zoom');
  console.log('errors:', errs.length, errs.slice(0, 2)); await b.close();
})();
