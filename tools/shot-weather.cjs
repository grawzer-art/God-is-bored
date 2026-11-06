// Captures météo : pluie et orage sur Noria Beach (rendu réel).
const { chromium, devices } = require('playwright');
const URL = process.env.GAME_URL || 'http://localhost:5173/';
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ ...devices['iPhone 13 landscape'], viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 }); const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(String(e)));
  await pg.goto(URL + '?fresh&nohelp&god&zoom=0.85&at=30,26&speed=0&simulate=1260'); await pg.waitForFunction(() => window.__gib && window.__gib.world, null, { timeout: 60000 }); await pg.waitForTimeout(2500);
  await pg.screenshot({ path: 'docs/shots/weather-1-clair.png' });
  for (const k of ['rain', 'storm']) {
    await pg.evaluate((k) => { window.__w = window.__w || null; const w = window.__gib.world; w.weather.kind = k; w.weather.until = w.clock + 500; window.__gib.setSpeed(1); }, k); await pg.waitForTimeout(6000);
    if (k === 'storm') await pg.evaluate(() => { window.__gib.lighting.flash = 0; });
    await pg.screenshot({ path: `docs/shots/weather-${k === 'rain' ? 2 : 3}-${k}.png` });
    console.log(k, JSON.stringify(await pg.evaluate(() => ({ drops: window.__gib.wfx.dropsDrawn, wdim: window.__gib.lighting.wdim.toFixed(2), strikes: window.__gib.world.weather.strikes }))));
  }
  console.log('erreurs :', errs.length ? errs.join(' | ') : 'aucune'); await b.close();
})();
