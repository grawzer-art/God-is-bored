// Captures du garage de Léo : façade, intérieur (mode Descendre, Léo et Tommy au travail).
const { chromium, devices } = require('playwright');
const URL = process.env.GAME_URL || 'http://localhost:5173/';
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ ...devices['iPhone 13 landscape'], viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 }); const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(String(e)));
  await pg.goto(URL + '?fresh&nohelp&human&speed=1&zoom=1.1&at=89,7&simulate=60'); await pg.waitForFunction(() => window.__gib && window.__gib.world, null, { timeout: 60000 }); await pg.waitForTimeout(1500);
  await pg.evaluate(() => { window.__gib.world.narrations = []; const g = window.__gib, w = g.world; w.clock = Math.floor(w.clock / 1440) * 1440 + 10.5 * 60; for (const n of ['Léo Ferreira', 'Tommy Blake']) { const c = w.chars.find((x) => x.name === n); c.away = false; c.jobPhase = ''; c.state = 'idle'; c.decision_cooldown = 0; c.pos = { x: 89.5, y: 7.5 }; } w.avatar.pos = { x: 89.5, y: 8.5 }; });
  await pg.waitForTimeout(3500); await pg.screenshot({ path: 'docs/shots/garage-1-facade.png' });
  await pg.evaluate(() => { const w = window.__gib.world; w.avatar.pos = { x: 89.5, y: 4.5 }; }); await pg.waitForTimeout(3500); await pg.screenshot({ path: 'docs/shots/garage-2-interieur.png' });
  console.log(JSON.stringify(await pg.evaluate(() => { const w = window.__gib.world; return w.chars.filter((c) => ['Léo Ferreira', 'Tommy Blake'].includes(c.name)).map((c) => [c.name, c.state, c.use_act, c.pos.x.toFixed(1), c.pos.y.toFixed(1)]); })), 'erreurs :', errs.length ? errs.join('|') : 'aucune'); await b.close();
})();
