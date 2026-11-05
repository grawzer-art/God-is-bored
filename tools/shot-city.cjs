// Captures de la ville : vue d'ensemble, centre-ville, intérieurs (iPhone paysage et bureau).
const { chromium, devices } = require('playwright');
const URL = process.env.GAME_URL || 'http://localhost:5173/';
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } }); const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(String(e))); pg.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  const shot = async (name, q, wait = 2500, fn) => { await pg.goto(URL + q); await pg.waitForFunction(() => window.__gib && window.__gib.world, null, { timeout: 60000 }); await pg.waitForTimeout(wait); if (fn) { await pg.evaluate(fn); await pg.waitForTimeout(4500); } await pg.screenshot({ path: `docs/shots/${name}.png` }); };
  await shot('city-1-overview', '?fresh&nohelp&zoom=0.25&at=50,20&speed=0');
  await shot('city-2-downtown', '?fresh&nohelp&zoom=0.85&at=74,17&speed=0');
  await shot('city-3-store', '?fresh&nohelp&zoom=1.5&at=62,14&speed=0', 2500, () => { const g = window.__gib; g.world.avatar.pos = { x: 61.5, y: 16.5 }; g.descend(false); g.setSpeed(0); });
  await shot('city-4-police', '?fresh&nohelp&zoom=1.2&at=75,13&speed=0', 2500, () => { const g = window.__gib; g.world.avatar.pos = { x: 74.5, y: 15.5 }; g.descend(false); g.setSpeed(0); });
  await shot('city-5-cafe', '?fresh&nohelp&zoom=1.3&at=89,14&speed=0', 2500, () => { const g = window.__gib; g.world.avatar.pos = { x: 88.5, y: 15.5 }; g.descend(false); g.setSpeed(0); });
  console.log('errors:', errs.length, errs.slice(0, 3)); await b.close();
})();
