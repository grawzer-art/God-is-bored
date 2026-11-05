// « Posez votre téléphone » : partie neuve, aucun ordre, vitesse x8 pendant ~90 s réelles (~un jour et demi de jeu) sur iPhone émulé.
const { chromium, devices } = require('playwright');
const URL = process.env.GAME_URL || 'http://localhost:5173/';
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log(c ? '  [OK]   ' : '  [FAIL] ', m); };
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ ...devices['iPhone 13 landscape'], viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 }); const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(String(e)));
  await pg.goto(URL + '?fresh&nohelp'); await pg.waitForFunction(() => window.__gib && window.__gib.world, null, { timeout: 60000 }); await pg.waitForTimeout(1500);
  await pg.evaluate(() => { window.__gib.setSpeed(3); window.__t0 = window.__gib.world.clock; });
  await pg.waitForTimeout(90000);
  const r = await pg.evaluate(() => { const w = window.__gib.world; const j = w.journal.filter((e) => e.t >= window.__t0); const c = (re) => j.filter((e) => re.test(e.text)).length;
    return { hours: Math.round((w.clock - window.__t0) / 60), depart: c(/part travailler/), back: c(/rentre du travail/), chats: w.stats.chats, rumors: w.stats.rumors ?? 0, events: w.events.length, bar: c(/au bar/), drama: j.filter((e) => e.kind === 'drama').length, pay: w.residents.filter((x) => (x.stats.shifts ?? 0) > 0).length, nan: w.chars.some((x) => !Number.isFinite(x.money) || Object.values(x.needs).some((v) => !Number.isFinite(v))), fps: Math.round(window.__gib.game.loop.actualFps), pos: w.residents.every((x) => x.away || !['walk', 'idle', 'chat'].includes(x.state) || w.isWalkable({ x: Math.floor(x.pos.x), y: Math.floor(x.pos.y) })) }; });
  console.log('   bilan :', JSON.stringify(r));
  ok(r.hours >= 20, `${r.hours} heures de jeu écoulées sans intervention`); ok(r.depart >= 3 && r.back >= 3, `les habitants vont au travail et en reviennent (${r.depart} départs, ${r.back} retours)`);
  ok(r.pay >= 3, `${r.pay} habitants ont été payés`); ok(r.chats >= 8, `${r.chats} conversations spontanées`); ok(r.events >= 1, `${r.events} événements du monde (disputes, aides…)`);
  ok(!r.nan && r.pos, 'aucun état invalide, personne dans un mur'); ok(errs.length === 0, 'aucune erreur JS ' + errs.slice(0, 2).join('|'));
  await b.close(); console.log(fails ? `\n${fails} ÉCHEC(S)` : '\nOBSERVATION : tout est vert'); process.exit(fails ? 1 : 0);
})();
