// Test PWA sur le build de production (vite preview) : manifest, icônes, service worker, hors-ligne, mise à jour, export/import.
// Usage : npm run e2e:pwa   (construit, sert dist/ sur :4173, joue le scénario, reconstruit une 2e version pour tester la mise à jour)
const { chromium, devices } = require('playwright');
const { execSync, spawn } = require('node:child_process');
const fs = require('node:fs');
const URL = 'http://localhost:4173/';
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log(c ? '  [OK]   ' : '  [FAIL] ', m); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const build = (sha) => execSync('npx vite build', { env: { ...process.env, VERCEL_GIT_COMMIT_SHA: sha }, stdio: 'ignore' });
(async () => {
  build('aaaaaaa');
  const srv = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { stdio: 'ignore' }); await sleep(2500);
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ ...devices['iPhone 13 landscape'], viewport: { width: 844, height: 390 }, serviceWorkers: 'allow', acceptDownloads: true });
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(String(e)));
  pg.on('dialog', (d) => d.accept());
  const ready = () => pg.waitForFunction(() => window.__gib && window.__gib.world, null, { timeout: 40000 });
  try {
    console.log('\n== Installation');
    const html = await (await ctx.request.get(URL)).text(); ok(/id="boot"/.test(html) && /safe-area-inset-top/.test(html), 'écran de chargement présent dans la page (avec zones de sécurité)');
    await pg.goto(URL);
    let navs = 0; pg.on('framenavigated', (f) => { if (f === pg.mainFrame()) navs++; });
    await ready(); await pg.evaluate(() => navigator.serviceWorker.ready); await pg.waitForTimeout(2500);
    ok(navs === 0, 'première visite : aucun rechargement automatique de la page');
    ok(await pg.waitForFunction(() => !document.getElementById('boot'), null, { timeout: 5000 }).then(() => true, () => false), 'écran de chargement retiré une fois le jeu prêt');
    const man = await pg.evaluate(async () => { const l = document.querySelector('link[rel=manifest]'); return l ? (await fetch(l.href)).json() : null; });
    ok(man && man.display === 'standalone' && man.orientation === 'landscape' && man.icons.length >= 3, 'manifest valide (standalone, paysage, icônes)');
    for (const p of ['/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon-maskable-512.png', '/icons/apple-touch-icon.png']) { const r = await ctx.request.get(URL.slice(0, -1) + p); ok(r.ok() && (r.headers()['content-type'] || '').includes('png'), 'icône ' + p); }
    ok(await pg.evaluate(() => !!document.querySelector('link[rel=apple-touch-icon]') && /black-translucent/.test(document.querySelector('meta[name=apple-mobile-web-app-status-bar-style]').content)), 'balises iOS (apple-touch-icon, barre d\'état translucide)');
    await pg.evaluate(() => navigator.serviceWorker.ready); await pg.reload(); await ready();
    ok(await pg.evaluate(() => !!navigator.serviceWorker.controller), 'service worker actif et aux commandes après rechargement');
    const v1 = await pg.evaluate(async () => (await (await fetch('/version.json', { cache: 'no-store' })).json()).build); ok(/^aaaaaaa-/.test(v1), 'version.json : ' + v1);

    console.log('\n== Hors-ligne');
    await pg.evaluate(() => { const g = window.__gib; g.world.godEnergy = 77; g.saveGame(); });
    await ctx.setOffline(true); await pg.reload(); await ready();
    ok(true, 'le jeu démarre sans réseau'); await ctx.setOffline(false);

    console.log('\n== Export / import');
    await pg.goto(URL + '?load'); await ready(); await pg.waitForTimeout(600);
    ok(await pg.evaluate(() => Math.abs(window.__gib.world.godEnergy - 77) < 3), 'la sauvegarde survit au service worker (localStorage intact)');
    const dl = pg.waitForEvent('download', { timeout: 8000 });
    await pg.evaluate(() => { Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true }); window.__gib.exportGame(); });
    const d = await dl; const path = '/tmp/gib-export.json'; await d.saveAs(path);
    const txt = fs.readFileSync(path, 'utf8'); const env = JSON.parse(txt);
    ok(env.format === 'god-is-bored-save' && env.payload && env.checksum, 'fichier exporté : ' + d.suggestedFilename());
    // import valide
    await pg.evaluate(() => { window.__gib.world.godEnergy = 5; });
    let fc = pg.waitForEvent('filechooser'); pg.evaluate(() => window.__gib.importGame()); (await fc).setFiles(path); await pg.waitForTimeout(800);
    ok(await pg.evaluate(() => Math.abs(window.__gib.world.godEnergy - 77) < 3), 'import valide : la partie est restaurée');
    ok(await pg.evaluate(() => localStorage.getItem('god-is-bored:backup') !== null), 'copie de secours de la partie précédente conservée');
    // import corrompu
    env.payload.clock += 5; fs.writeFileSync('/tmp/gib-bad.json', JSON.stringify(env));
    await pg.evaluate(() => { window.__gib.world.godEnergy = 12; });
    fc = pg.waitForEvent('filechooser'); pg.evaluate(() => window.__gib.importGame()); (await fc).setFiles('/tmp/gib-bad.json'); await pg.waitForTimeout(600);
    ok(await pg.evaluate(() => Math.round(window.__gib.world.godEnergy) === 12 && /refusé/.test(document.getElementById('toast').textContent)), 'import corrompu refusé, partie en cours intacte');
    fs.writeFileSync('/tmp/gib-junk.json', 'bonjour'); fc = pg.waitForEvent('filechooser'); pg.evaluate(() => window.__gib.importGame()); (await fc).setFiles('/tmp/gib-junk.json'); await pg.waitForTimeout(500);
    ok(await pg.evaluate(() => /refusé/.test(document.getElementById('toast').textContent)), 'fichier quelconque refusé');
    // menus iPhone
    await pg.evaluate(() => document.getElementById('mmenu').click()); await pg.waitForTimeout(300);
    ok(await pg.evaluate(() => [...document.querySelectorAll('#msheet [data-k]')].map((e) => e.textContent).join().includes('Exporter')), 'menu iPhone : Exporter / Importer disponibles');
    await pg.screenshot({ path: 'docs/shots/pwa-menu.png' }); await pg.evaluate(() => document.getElementById('mclose').click());

    console.log('\n== Mise à jour déployée');
    build('bbbbbbb'); // « nouveau déploiement » : sw.js et version.json changent
    await pg.evaluate(() => { document.dispatchEvent(new Event('visibilitychange')); }); // retour au premier plan de l'app
    await pg.waitForSelector('#upd', { timeout: 20000 }); ok(true, 'bandeau « Nouvelle version disponible » affiché');
    await pg.evaluate(() => { window.__gib.world.godEnergy = 61; });
    await Promise.all([pg.waitForNavigation({ timeout: 20000 }), pg.click('#upd-go')]); await ready();
    const v2 = await pg.evaluate(async () => (await (await fetch('/version.json', { cache: 'no-store' })).json()).build); ok(/^bbbbbbb-/.test(v2), 'nouvelle version servie : ' + v2);
    const keys = await pg.evaluate(() => caches.keys()); ok(keys.length === 1 && keys[0].startsWith('gib-bbbbbbb'), 'anciens caches supprimés : ' + keys.join());
    await pg.goto(URL + '?load'); await ready(); ok(await pg.evaluate(() => Math.round(window.__gib.world.godEnergy) === 61), 'la partie est sauvegardée automatiquement avant la mise à jour');
    ok(errs.length === 0, 'aucune erreur JavaScript ' + errs.slice(0, 2).join(' | '));
  } catch (e) { fails++; console.log('  [FAIL]  exception :', e.message); }
  await b.close(); srv.kill(); console.log(fails ? `\n${fails} ÉCHEC(S)` : '\nPWA : tout est vert'); process.exit(fails ? 1 : 0);
})();
