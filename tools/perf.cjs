// Mesure de performance (rendu LOGICIEL swiftshader dans Chromium : un plancher pessimiste, PAS une mesure iPhone). Rapporte FPS moyen, p95 du temps d'image et sprites actifs.
const { chromium, devices } = require('playwright');
const URL = process.env.GAME_URL || 'http://localhost:5173/';
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ ...devices['iPhone 13 landscape'], viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 }); const pg = await ctx.newPage();
  const out = [];
  for (const [name, q] of [['plage jour', 'at=24,26&zoom=0.9'], ['centre-ville jour', 'at=72,21&zoom=0.8'], ['plage nuit pluie', 'at=24,26&zoom=0.9&night'], ['vue large (zoom 0.5)', 'at=48,22&zoom=0.5']]) {
    await pg.goto(URL + `?fresh&nohelp&god&speed=1&simulate=60&${q.replace('&night', '')}`); await pg.waitForFunction(() => window.__gib && window.__gib.world, null, { timeout: 60000 }); await pg.waitForTimeout(2000);
    if (q.includes('night')) await pg.evaluate(() => { const w = window.__gib.world; w.clock = Math.floor(w.clock / 1440) * 1440 + 22 * 60; w.weather.kind = 'rain'; w.weather.until = w.clock + 600; });
    const r = await pg.evaluate(() => new Promise((res) => { const ts = []; let last = performance.now(); const n0 = performance.now(); const f = () => { const t = performance.now(); ts.push(t - last); last = t; if (t - n0 < 6000) requestAnimationFrame(f); else { ts.shift(); ts.sort((a, b) => a - b); const sum = ts.reduce((a, b) => a + b, 0); res({ fps: +(1000 / (sum / ts.length)).toFixed(1), p95: +ts[Math.floor(ts.length * 0.95)].toFixed(1), frames: ts.length, objs: window.__gib.children.list.length }); } }; requestAnimationFrame(f); }));
    out.push({ scène: name, ...r }); console.log(JSON.stringify({ scène: name, ...r }));
  }
  await b.close();
})();
