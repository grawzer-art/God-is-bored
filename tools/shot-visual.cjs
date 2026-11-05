// Captures de la refonte visuelle : quartier pilote, jour et nuit, intérieurs, personnages.
const { chromium } = require('playwright');
const URL = process.env.GAME_URL || 'http://localhost:5173/';
const only = process.argv[2];
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } }); const pg = await ctx.newPage(); const errs = [];
  pg.on('pageerror', (e) => errs.push(String(e))); pg.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  const shot = async (name, q, fn, wait = 3500) => {
    if (only && !name.includes(only)) return;
    await pg.goto(URL + q); await pg.waitForFunction(() => window.__gib && window.__gib.world, null, { timeout: 60000 }); await pg.waitForTimeout(2000);
    if (fn) await pg.evaluate(fn); await pg.waitForTimeout(wait); await pg.screenshot({ path: `docs/shots/${name}.png` });
  };
  const hour = (h) => `window.__gib.world.time = ${h}`;
  await shot('vis-1-overview', '?fresh&nohelp&zoom=0.3&at=50,22&speed=0');
  await shot('vis-2-street-day', '?fresh&nohelp&zoom=0.9&at=70,22&speed=0');
  await shot('vis-3-street-night', '?fresh&nohelp&zoom=0.9&at=70,22&speed=0', () => { const w = window.__gib.world; w.clock = 1440 + 22 * 60; });
  await shot('vis-3b-bar-night', '?fresh&nohelp&zoom=1.1&at=40,20&speed=0', () => { window.__gib.world.clock = 1440 + 22 * 60; });
  await shot('vis-4-house', '?fresh&nohelp&zoom=0.6&at=14,10&speed=0');
  await shot('vis-5-bar-front', '?fresh&nohelp&zoom=1.1&at=40,20&speed=0');
  await shot('vis-6-people', '?fresh&nohelp&zoom=2.4&at=72,20&speed=1', () => { const w = window.__gib.world; w.clock = Math.floor(w.clock / 1440) * 1440 + 10 * 60; w.citizens.forEach((c, k) => { c.away = false; c.pos = { x: 69.5 + k * 1.6, y: 19.5 }; c.state = 'idle'; c.plan = []; c.decision_cooldown = 60; }); w.police.forEach((c, k) => { c.away = false; c.pos = { x: 73.5 + k * 1.6, y: 22.5 }; c.state = 'idle'; c.plan = []; c.decision_cooldown = 60; }); }, 1200);
  await shot('vis-7-apartment', '?fresh&nohelp&zoom=1.5&at=63,28&speed=0', () => { const g = window.__gib; g.world.avatar.pos = { x: 66.5, y: 28.5 }; g.descend(false); g.setSpeed(0); });
  console.log('errors:', errs.length, errs.slice(0, 3)); await b.close();
})();
