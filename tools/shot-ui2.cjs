// Captures de l'interface iPhone V2 (iPhone 13 émulé dans Chromium : PAS des captures d'un vrai iPhone).
const { chromium, devices } = require('playwright');
const URL = process.env.GAME_URL || 'http://localhost:5173/';
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }); const errs = [];
  const mk = async (opts) => { const ctx = await b.newContext({ ...devices['iPhone 13 landscape'], ...opts, deviceScaleFactor: 2 }); const pg = await ctx.newPage(); pg.on('pageerror', (e) => errs.push(String(e))); return pg; };
  const go = async (pg, q) => { await pg.goto(URL + q); await pg.waitForFunction(() => window.__gib && window.__gib.world, null, { timeout: 60000 }); await pg.waitForTimeout(2200); };
  let pg = await mk({ viewport: { width: 844, height: 390 } });
  await go(pg, '?fresh&nohelp&speed=0'); await pg.evaluate(() => { const g = window.__gib; g.world.clock = Math.floor(g.world.clock / 1440) * 1440 + 21 * 60 + 38; g.world.avatar.pos = { x: 70.5, y: 19.5 }; g.descend(false); g.setSpeed(0); g.tz = g.cz = 1.5; }); await pg.waitForTimeout(3000);
  await pg.screenshot({ path: 'docs/shots/ui2-10-descendre.png' });
  await pg.evaluate(() => { const g = window.__gib; g.ascend(false); g.focusZone('downtown'); g.setSpeed(0); }); await pg.waitForTimeout(2500);
  await pg.evaluate(() => { document.querySelector('#gbar [data-c="pouvoirs"]').click(); }); await pg.waitForTimeout(500);
  await pg.screenshot({ path: 'docs/shots/ui2-11-dieu-pouvoirs.png' });
  await pg.evaluate(() => { document.querySelector('#gbar [data-c="lois"]').click(); }); await pg.waitForTimeout(400); await pg.screenshot({ path: 'docs/shots/ui2-12-dieu-lois.png' });
  await pg.evaluate(() => { const g = window.__gib; document.querySelector('#gbar [data-c="lois"]').click(); g.selectChar(1, true); }); await pg.waitForTimeout(500); await pg.evaluate(() => window.__gib.hud.fiche.open(1)); await pg.waitForTimeout(600);
  await pg.screenshot({ path: 'docs/shots/ui2-13-fiche.png' });
  await pg.evaluate(() => { const g = window.__gib; g.hud.fiche.close(); g.world.avatar.pos = { x: 66.5, y: 28.5 }; g.world.avatar.money = 1200; g.descend(false); g.setSpeed(0); g.tz = g.cz = 1.7; }); await pg.waitForTimeout(2500);
  await pg.screenshot({ path: 'docs/shots/ui2-15-appartement.png' });
  await pg.evaluate(() => document.getElementById('decobtn').click()); await pg.waitForTimeout(700); await pg.screenshot({ path: 'docs/shots/ui2-16-decoration.png' });
  await pg.evaluate(() => { document.querySelector('#deco [data-tab="sols"]').click(); }); await pg.waitForTimeout(400); await pg.screenshot({ path: 'docs/shots/ui2-17-sols-murs.png' });
  await pg.context().close();
  pg = await mk({ viewport: { width: 390, height: 844 }, isMobile: true }); await go(pg, '?fresh&nohelp&speed=0'); await pg.evaluate(() => { window.__gib.selectChar(1, true); window.__gib.hud.fiche.open(1); }); await pg.waitForTimeout(800);
  await pg.screenshot({ path: 'docs/shots/ui2-14-fiche-portrait.png' });
  console.log('errors:', errs.length, errs.slice(0, 2)); await b.close();
})();
