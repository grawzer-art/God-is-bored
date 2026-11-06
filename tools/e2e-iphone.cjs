// Expérience iPhone : plein écran, zones de sécurité (Dynamic Island), rotation, cibles tactiles, réactivité, gestes.
// Usage : GAME_URL=http://localhost:5173/ node tools/e2e-iphone.cjs
const { chromium, devices } = require('playwright');
const URL = process.env.GAME_URL || 'http://localhost:5173/';
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log(c ? '  [OK]   ' : '  [FAIL] ', m); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MODELS = [['iPhone SE', 667, 375, [0, 0, 0, 0]], ['iPhone 12 mini', 812, 375, [44, 0, 44, 21]], ['iPhone 15 Pro (Dynamic Island)', 852, 393, [59, 0, 59, 21]], ['iPhone 16 Pro', 874, 402, [62, 0, 62, 21]], ['iPhone 15 Pro Max', 932, 430, [59, 0, 59, 21]]];
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  for (const [name, w, h, [sl, st, sr, sb]] of MODELS) {
    console.log(`\n== ${name} ${w}x${h}, zones de sécurité G${sl} H${st} D${sr} B${sb}`);
    const ctx = await b.newContext({ ...devices['iPhone 13 landscape'], viewport: { width: w, height: h }, deviceScaleFactor: 2, acceptDownloads: true });
    const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(String(e)));
    const cdp = await ctx.newCDPSession(pg); let realEnv = true;
    try { await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: st, left: sl, bottom: sb, right: sr } }); } catch { realEnv = false; }
    await pg.goto(URL + '?fresh&nohelp' + (realEnv ? '' : `&safe=${sl},${st},${sr},${sb}`)); await pg.waitForFunction(() => window.__gib && window.__gib.world, null, { timeout: 60000 }); await pg.waitForTimeout(1200);
    const E = (f, a) => pg.evaluate(f, a);
    const rect = (sel) => E((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, cx: (r.left + r.right) / 2, cy: (r.top + r.bottom) / 2, w: r.width, h: r.height }; }, sel);
    const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
    const tap = async (sel, drift = 0) => { const r = await rect(sel); await touch('touchStart', [{ x: r.cx, y: r.cy, id: 1 }]); if (drift) { await touch('touchMove', [{ x: r.cx + drift, y: r.cy + drift / 2, id: 1 }]); } await sleep(40); await touch('touchEnd', []); await sleep(120); };
    ok(realEnv, realEnv ? 'zones de sécurité injectées via env(safe-area-inset-*) (comme iOS)' : 'repli : paramètre ?safe= (env() non émulable ici)');
    // plein écran
    const full = await E(() => { const c = document.querySelector('canvas').getBoundingClientRect(); const d = document.documentElement; return { cw: c.width, ch: c.height, cl: c.left, ct: c.top, sw: d.scrollWidth, sh: d.scrollHeight, iw: innerWidth, ih: innerHeight, bodyPos: getComputedStyle(document.body).position }; });
    ok(Math.abs(full.cw - w) < 1.5 && Math.abs(full.ch - h) < 1.5 && full.cl === 0 && full.ct === 0, `le canvas couvre tout l'écran (${Math.round(full.cw)}x${Math.round(full.ch)})`);
    ok(full.sw <= w && full.sh <= h && full.bodyPos === 'fixed', 'aucun débordement ni défilement de page');
    // zones de sécurité
    const names = ['#mtl', '#mtr', '#abtn', '#bbtn']; let inside = true;
    for (const sel of names) { const r = await rect(sel); if (r.l < sl - 0.5 || r.r > w - sr + 0.5 || r.t < st - 0.5 || r.b > h - sb + 0.5) { inside = false; console.log('      hors zone :', sel, JSON.stringify(r)); } }
    ok(inside, 'commandes essentielles (menu, mode, vitesse, croix, A, B) hors de la Dynamic Island et du bandeau du bas');
    // cibles tactiles
    const small = []; for (const sel of ['#mspeed', '#mmode', '#mmenu']) { const r = await rect(sel); if (r.w < 44 || r.h < 44) small.push(sel + ' ' + Math.round(r.w) + 'x' + Math.round(r.h)); }
    ok(small.length === 0, 'boutons du haut ≥ 44x44 px ' + small.join(','));
    const ab = await Promise.all(['#abtn', '#bbtn'].map(rect)); ok(ab.every((r) => r.w >= 64), 'A et B ≥ 64 px');
    // gestes / sélection
    const gest = await E(() => { const out = {}; for (const t of ['gesturestart', 'dblclick']) { const ev = new Event(t, { cancelable: true, bubbles: true }); document.body.dispatchEvent(ev); out[t] = ev.defaultPrevented; } const cs = getComputedStyle(document.getElementById('mmenu')); out.sel = cs.userSelect || cs.webkitUserSelect; out.ta = cs.touchAction; out.bsel = getComputedStyle(document.body).userSelect || getComputedStyle(document.body).webkitUserSelect; return out; });
    ok(gest.gesturestart && gest.dblclick, 'pincement de page et double-tap zoom bloqués'); ok(gest.bsel === 'none', 'sélection de texte désactivée'); ok(gest.ta === 'manipulation' || gest.ta === 'none', 'touch-action sans zoom (' + gest.ta + ')');
    // réactivité : retour visuel dès le toucher, action une seule fois
    await E(() => { window.__t = []; const el = document.getElementById('mmode'); document.addEventListener('pointerdown', () => { const t0 = performance.now(); requestAnimationFrame(() => window.__t.push({ pressed: el.classList.contains('pressed'), dt: performance.now() - t0 })); }, true); });
    let r = await rect('#mmode'); await touch('touchStart', [{ x: r.cx, y: r.cy, id: 1 }]); await sleep(120);
    const pressed = await E(() => document.getElementById('mmode').classList.contains('pressed')); await touch('touchEnd', []); await sleep(200);
    ok(pressed, 'retour visuel immédiat : le bouton est « enfoncé » dès le doigt posé');
    ok(await E(() => window.__gib.mode === 'human'), 'DIEU → HUMAIN : une seule pression suffit'); await tap('#mmode'); ok(await E(() => window.__gib.mode === 'god'), 'HUMAIN → DIEU : une seule pression suffit');
    const sp0 = await E(() => window.__gib.speedIndex); await tap('#mspeed', 14); ok(await E((s) => window.__gib.speedIndex !== s, sp0), 'toucher avec le doigt qui glisse de 14 px : action prise en compte, une seule fois');
    let n = 0; await E(() => { const o = window.__gib.cycleWalls.bind(window.__gib); window.__n = 0; window.__gib.cycleWalls = () => { window.__n++; return o(); }; });
    await tap('#mmenu'); ok(await E(() => document.getElementById('msheet').style.display === 'block'), 'Menu : s\'ouvre dès la première pression');
    await E(() => { document.querySelector('#msheet [data-k="murs"]').scrollIntoView?.(); }); await E(() => { const b = document.querySelector('#msheet [data-k="murs"]'); window.__bt = !!b; });
    if (await E(() => window.__bt)) { const rr = await E(() => { const r = document.querySelector('#msheet [data-k="murs"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }); await touch('touchStart', [{ x: rr.x, y: rr.y, id: 1 }]); await sleep(40); await touch('touchEnd', []); await sleep(800); ok((await E(() => window.__n)) === 1, 'bouton du menu (Murs) : exactement une action (pas de double déclenchement)'); }
    // export natif non bloqué par le raccourci tactile
    await tap('#mmenu'); const dl = pg.waitForEvent('download', { timeout: 6000 }).then(() => true, () => false);
    await E(() => Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true }));
    const er = await E(() => { const r = document.querySelector('#msheet [data-k="export"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }); await touch('touchStart', [{ x: er.x, y: er.y, id: 1 }]); await sleep(40); await touch('touchEnd', []);
    ok(await dl, 'Menu → Exporter fonctionne au toucher (clic natif conservé)');
    // rotation
    await pg.setViewportSize({ width: h, height: w }); await pg.waitForTimeout(700);
    ok(await E(() => getComputedStyle(document.getElementById('rotate')).display === 'flex'), 'portrait : écran « Tournez votre iPhone »');
    await pg.setViewportSize({ width: w, height: h }); await pg.waitForTimeout(1200);
    const back = await E(() => { const c = document.querySelector('canvas').getBoundingClientRect(); return { rot: getComputedStyle(document.getElementById('rotate')).display, cw: c.width, ch: c.height }; });
    ok(back.rot === 'none' && Math.abs(back.cw - w) < 1.5 && Math.abs(back.ch - h) < 1.5, 'retour en paysage : jeu réaffiché plein écran (' + Math.round(back.cw) + 'x' + Math.round(back.ch) + ')');
    if (name.includes('15 Pro (')) await pg.screenshot({ path: 'docs/shots/iphone-15pro.png' });
    ok(errs.length === 0, 'aucune erreur JS ' + errs.slice(0, 2).join('|'));
    await ctx.close();
  }
  await b.close(); console.log(fails ? `\n${fails} ÉCHEC(S)` : '\niPhone : tout est vert'); process.exit(fails ? 1 : 0);
})();
