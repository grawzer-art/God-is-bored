#!/usr/bin/env node
// Capture réelle : ouvre le jeu dans Chromium (WebGL logiciel), attend, enregistre une image et affiche les erreurs console.
// Usage : node tools/shot.cjs sortie.png "?simulate=75&nohelp" [attente_s] [largeur] [hauteur]
const { chromium } = require('playwright');
(async () => {
  const [out, q = '', wait = '3', W = '1440', H = '900'] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
  const pg = await b.newPage({ viewport: { width: +W, height: +H }, deviceScaleFactor: 1 });
  const errs = [];
  pg.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errs.push(`[${m.type()}] ${m.text()}`); });
  pg.on('pageerror', (e) => errs.push(`[pageerror] ${e}`));
  await pg.goto((process.env.GAME_URL || 'http://localhost:5173/') + q);
  await pg.waitForTimeout(+wait * 1000);
  await pg.screenshot({ path: out });
  console.log('capture:', out);
  errs.slice(0, 15).forEach((e) => console.log(e));
  await b.close();
})();
