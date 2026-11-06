// Sonde de performance détaillée (rendu LOGICIEL swiftshader : plancher pessimiste, PAS une mesure iPhone). Compare jour / nuit / pluie.
const { chromium, devices } = require('playwright');
const URL = process.env.GAME_URL || 'http://localhost:5173/';
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ ...devices['iPhone 13 landscape'], viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 }); const pg = await ctx.newPage();
  await pg.goto(URL + '?fresh&nohelp&god&speed=1&simulate=60&at=24,26&zoom=0.9'); await pg.waitForFunction(() => window.__gib && window.__gib.world); await pg.waitForTimeout(2000);
  const meas = () => pg.evaluate(() => new Promise((res) => { const ts = []; let last = performance.now(); const n0 = last; const f = () => { const t = performance.now(); ts.push(t - last); last = t; if (t - n0 < 4000) requestAnimationFrame(f); else { ts.shift(); const s = ts.reduce((a, c) => a + c, 0); res(+(1000 / (s / ts.length)).toFixed(1)); } }; requestAnimationFrame(f); }));
  console.log('jour', await meas());
  await pg.evaluate(() => { const w = window.__gib.world; w.clock = Math.floor(w.clock / 1440) * 1440 + 22 * 60; }); await pg.waitForTimeout(2500); console.log('nuit sec', await meas());
  await pg.evaluate(() => { const w = window.__gib.world; w.weather.kind = 'rain'; w.weather.until = w.clock + 600; }); await pg.waitForTimeout(2000); console.log('nuit pluie', await meas());
  await pg.evaluate(() => { const w = window.__gib.world; w.weather.kind = 'storm'; w.weather.until = w.clock + 600; }); await pg.waitForTimeout(2000); console.log('nuit orage', await meas());
  await pg.evaluate(() => { const g = window.__gib; g.sea.update = () => {}; g.sea.g.clear(); const w = g.world; w.weather.kind = 'clear'; w.weather.until = w.clock + 600; }); await pg.waitForTimeout(2000); console.log('nuit sec, mer figée', await meas());
  await b.close();
})();
