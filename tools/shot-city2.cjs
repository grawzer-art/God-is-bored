// Captures : vie du centre-ville, délit, recherche, poursuite, arrestation (rendu réel).
const { chromium, devices } = require('playwright');
const URL = process.env.GAME_URL || 'http://localhost:5173/';
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ ...devices['iPhone 13 landscape'], viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 }); const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(String(e)));
  await pg.goto(URL + '?fresh&nohelp&simulate=190&zoom=0.8&at=66,24&speed=0'); await pg.waitForFunction(() => window.__gib && window.__gib.world, null, { timeout: 60000 }); await pg.waitForTimeout(3500);
  await pg.screenshot({ path: 'docs/shots/city-6-vie.png' });
  await pg.evaluate(() => { const g = window.__gib, w = g.world; const av = w.avatar; w.abortPlan(av, 't'); av.pos = { x: 61.5, y: 14.5 }; w.clerk.away = false; w.clerk.pos = { x: 63.5, y: 15.5 }; w.clerk.state = 'idle'; g.descend(false); g.tz = g.cz = 1.5; g.setSpeed(1); });
  await pg.waitForTimeout(3000);
  // prendre un article sur le rayon
  await pg.evaluate(() => { const g = window.__gib, w = g.world; const fi = w.furn.findIndex((f) => f.id === 'shelf_a'); const f = w.furn[fi]; const sl = f.slots[0]; const st = { x: f.x + sl.stands[0][0], y: f.y + sl.stands[0][1] }; w.avatar.plan = [{ type: 'goto', cell: st }, { type: 'use', furn: fi, slot: 0, act: 'shop', stand: st }]; w.startNextStep(w.avatar); });
  await pg.waitForTimeout(5500); await pg.screenshot({ path: 'docs/shots/city-7-rayon.png' });
  await pg.evaluate(() => { const g = window.__gib, w = g.world; w.avatar.plan = [{ type: 'goto', cell: { x: 61, y: 19 } }]; w.startNextStep(w.avatar); w.input = { dx: 0, dy: 0, run: false }; });
  await pg.waitForTimeout(9000); await pg.screenshot({ path: 'docs/shots/city-8-poursuite.png' });
  await pg.evaluate(() => { window.__gib.setSpeed(3); }); await pg.waitForTimeout(14000);
  await pg.screenshot({ path: 'docs/shots/city-9-suite.png' });
  console.log(JSON.stringify(await pg.evaluate(() => { const w = window.__gib.world; return { wanted: w.wanted, jail: w.jail, rec: w.record_, owed: Object.keys(w.avatar.unpaid), police: w.police.map((o) => [o.first, o.task && o.task.kind, o.state]), hour: w.hour().toFixed(1) }; })), 'errors', errs.length, errs.slice(0, 2)); await b.close();
})();
