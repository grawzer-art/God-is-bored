// Captures d'audit visuel (avant/après) : plusieurs zones de NORIA à plusieurs heures. Usage : node tools/shot-audit.cjs <préfixe>
const { chromium, devices } = require('playwright');
const URL = process.env.GAME_URL || 'http://localhost:5173/';
const pre = process.argv[2] || 'audit';
const SPOTS = [['plage', '26,26', 0.9], ['avenue', '40,21', 0.9], ['centre', '72,21', 0.8], ['immeubles', '70,30', 0.8], ['tiki', '14,26', 1.1], ['hotel', '76,30', 0.8], ['club', '40,17', 0.9], ['nord', '50,8', 0.7], ['hotelF', '76,26', 0.5], ['bordN', '50,2', 0.55], ['bordO', '4,10', 0.55]];
const HOURS = [['midi', 12.5], ['couchant', 18.6], ['nuit', 22.3]];
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ ...devices['iPhone 13 landscape'], viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 }); const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(String(e)));
  for (const [sn, at, z] of SPOTS) {
    await pg.goto(URL + `?fresh&nohelp&god&speed=1&zoom=${z}&at=${at}&simulate=60`); await pg.waitForFunction(() => window.__gib && window.__gib.world, null, { timeout: 60000 }); await pg.waitForTimeout(1500);
    await pg.evaluate(() => { const e = document.querySelector('#gbar'); if (e) e.style.visibility = 'hidden'; });
    for (const [hn, h] of HOURS) {
      await pg.evaluate((h) => { const w = window.__gib.world; w.clock = Math.floor(w.clock / 1440) * 1440 + h * 60; }, h);
      await pg.waitForTimeout(2500); await pg.screenshot({ path: `docs/shots/${pre}-${sn}-${hn}.png` });
    }
  }
  console.log('erreurs :', errs.length ? errs.join(' | ') : 'aucune'); await b.close();
})();
