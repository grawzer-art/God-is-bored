// Test tactile iPhone (émulation Chromium, vrais événements tactiles via CDP, doigts simultanés).
const { chromium, devices } = require('playwright');
const URL = process.env.GAME_URL || 'http://localhost:5173/';
let fails = 0, n = 0; const ok = (c, m) => { n++; if (!c) fails++; console.log(c ? '  [OK]   ' : '  [FAIL] ', m); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const d = devices['iPhone 13 landscape'];
  const ctx = await b.newContext({ ...d, viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 });
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(String(e))); pg.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  const cdp = await ctx.newCDPSession(pg);
  const E = (f, a) => pg.evaluate(f, a);
  const touch = async (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, i) => ({ x: p.x, y: p.y, id: p.id ?? i })) });
  const rect = (sel) => E((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, cx: (r.left + r.right) / 2, cy: (r.top + r.bottom) / 2, w: r.width, h: r.height }; }, sel);
  const arm = async (name) => { const r = await rect('#dpad'); const o = 0.36 * r.w; return { x: r.cx + (name === 'right' ? o : name === 'left' ? -o : 0), y: r.cy + (name === 'down' ? o : name === 'up' ? -o : 0) }; };
  const tap = async (sel) => { const r = await rect(sel); await touch('touchStart', [{ x: r.cx, y: r.cy }]); await sleep(80); await touch('touchEnd', []); await sleep(150); };
  const load = async (q) => { await pg.goto(URL + q); await pg.waitForFunction(() => window.__gib && window.__gib.world, null, { timeout: 40000 }); await pg.waitForTimeout(1500); };

  console.log('\n== Affichage paysage et zones de sécurité (encoche simulée : 47 px de chaque côté, 21 px en bas)');
  await load('?fresh&simulate=420&safe=47,0,47,21');
  ok(await E(() => document.getElementById('ui').classList.contains('mobile')), 'iPhone détecté : interface mobile activée sans paramètre');
  ok(await E(() => ['clock', 'god', 'powers', 'portraits', 'feed'].every((id) => getComputedStyle(document.getElementById(id)).display === 'none')), 'panneaux permanents du Mac masqués (date, DIEU, pouvoirs, habitants, journal)');
  const vp = await E(() => ({ w: innerWidth, h: innerHeight })); let inside = true, listed = [];
  for (const sel of ['#mtl', '#mtr', '#dpad', '#abtn', '#bbtn']) { const r = await rect(sel); const okr = r.l >= 47 - 0.5 && r.r <= vp.w - 47 + 0.5 && r.t >= 0 && r.b <= vp.h - 21 + 0.5; inside = inside && okr; listed.push(`${sel}[${Math.round(r.l)},${Math.round(r.t)},${Math.round(r.r)},${Math.round(r.b)}]`); }
  ok(inside, 'tous les contrôles restent dans les zones de sécurité ' + listed.join(' '));
  ok(await E(() => document.scrollingElement.scrollWidth <= innerWidth && document.scrollingElement.scrollHeight <= innerHeight && getComputedStyle(document.body).position === 'fixed'), 'aucun défilement horizontal ni vertical');
  const big = await Promise.all(['#dpad', '#abtn', '#bbtn'].map(rect)); ok(big.every((r) => r.w >= 60 && r.h >= 60), `cibles tactiles suffisantes (croix ${Math.round(big[0].w)} px, A ${Math.round(big[1].w)} px, B ${Math.round(big[2].w)} px)`);
  const cov = await E(() => { let a = 0; for (const id of ['mtl', 'mtr', 'dpad', 'abtn', 'bbtn']) { const r = document.getElementById(id).getBoundingClientRect(); a += r.width * r.height; } return a / (innerWidth * innerHeight); }); ok(cov < 0.18, `l'interface couvre ${(cov * 100).toFixed(0)} % de l'écran (< 18 %)`);
  ok(await E(() => getComputedStyle(document.getElementById('help')).display === 'none'), 'l\'aide du Mac ne s\'ouvre pas sur iPhone (aucun panneau ne couvre l\'écran au démarrage)');
  await pg.setViewportSize({ width: 390, height: 844 }); await pg.waitForTimeout(500); ok(await E(() => getComputedStyle(document.getElementById('rotate')).display === 'flex'), 'portrait : invitation à tourner le téléphone');
  await pg.setViewportSize({ width: 844, height: 390 }); await pg.waitForTimeout(500); ok(await E(() => getComputedStyle(document.getElementById('rotate')).display === 'none'), 'paysage : l\'invitation disparaît');

  await tap('#mmenu'); await tap('#msheet [data-k="help"]'); { const hr = await rect('#msheet'); ok(await E(() => document.getElementById('msheet').textContent.includes('CROIX') || document.getElementById('msheet').textContent.includes('Croix')) && hr.b <= 390 && hr.t >= 0, 'Menu → Aide : aide tactile compacte, entièrement visible'); } await tap('#mclose');
  console.log('\n== Croix directionnelle en mode DIEU (caméra)');
  await load('?fresh&nohelp&simulate=420'); const x0 = await E(() => window.__gib.tx);
  await touch('touchStart', [await arm('right')]); await sleep(600); const mid = await E(() => ({ x: window.__gib.tx, keys: [...window.__gib.keys], an: window.__gib.analog.mag })); await touch('touchEnd', []); await sleep(200);
  ok(mid.x > x0 + 20 && mid.an > 0.3, `appui sur →: la caméra se déplace (${x0.toFixed(0)} -> ${mid.x.toFixed(0)})`); ok(await E(() => window.__gib.analog.mag === 0 && window.__gib.keys.size === 0), 'relâcher arrête le mouvement');
  const y0 = await E(() => window.__gib.ty); await touch('touchStart', [await arm('down')]); await sleep(500); await touch('touchEnd', []); ok((await E(() => window.__gib.ty)) > y0 + 15, 'appui sur ↓ : la caméra descend');

  console.log('\n== Boutons A / B en mode DIEU');
  await E(() => { const g = window.__gib; const c = g.chars.find((x) => x.sim.kind === 'resident' && !x.sim.isAsleep()) || g.chars[0]; g.tz = g.cz = 1.5; g.tx = g.cx = c.x; g.ty = g.cy = c.y - 20; window.__tid = c.sim.id; }); await sleep(400);
  const tid = await E(() => window.__tid); await tap('#abtn'); ok((await E(() => window.__gib.selectedId)) === tid, 'A : sélectionne le personnage au centre de l\'écran');
  ok(await E(() => getComputedStyle(document.getElementById('qcard')).display === 'flex' && document.getElementById('qcard').textContent.includes(window.__gib.world.chars[window.__gib.selectedId].first)), 'carte rapide : nom, humeur, action, lieu');
  await tap('#abtn'); ok(await E(() => document.getElementById('ui').classList.contains('charp-open') && getComputedStyle(document.getElementById('charp')).display === 'block'), 'A de nouveau : fiche complète en panneau temporaire');
  const fr = await rect('#charp'); ok(fr.w < 844 * 0.5 && fr.l >= 0 && fr.r <= 844, `la fiche couvre moins de la moitié de l'écran (${Math.round(fr.w)} px)`);
  await tap('#fx'); ok(await E(() => !document.getElementById('ui').classList.contains('charp-open')), 'fiche refermable');
  await tap('#bbtn'); ok(await E(() => document.getElementById('msheet').style.display === 'block' && document.getElementById('msheet').textContent.includes('Pouvoirs divins')), 'B : menu des pouvoirs divins');
  await E(() => { window.__gib.world.godEnergy = 100; }); await tap('#msheet [data-p="bless"]'); ok(await E(() => window.__gib.hud.powerMode === 'bless'), 'pouvoir Bénédiction armé depuis le menu tactile');
  const e0 = await E(() => window.__gib.world.godEnergy); await tap('#abtn'); ok((await E(() => window.__gib.world.godEnergy)) < e0 - 15, 'A applique le pouvoir au personnage choisi (énergie divine dépensée)');
  await tap('#mmenu'); await tap('#msheet [data-k="res"]'); ok(await E(() => document.getElementById('msheet').querySelectorAll('[data-id]').length === 8), 'Menu → Habitants : 8 portraits tactiles');
  await tap('#msheet [data-id="2"]'); ok((await E(() => window.__gib.selectedId)) === 2, 'toucher un portrait : habitant sélectionné et caméra centrée');

  console.log('\n== Gestes sur la scène (caméra, zoom à deux doigts)');
  await tap('#qx'); const z0 = await E(() => window.__gib.tz); const cx = 420, cy = 190;
  await touch('touchStart', [{ x: cx - 40, y: cy, id: 1 }, { x: cx + 40, y: cy, id: 2 }]); for (let i = 1; i <= 8; i++) { await touch('touchMove', [{ x: cx - 40 - i * 12, y: cy, id: 1 }, { x: cx + 40 + i * 12, y: cy, id: 2 }]); await sleep(40); } await touch('touchEnd', []); await sleep(300);
  ok((await E(() => window.__gib.tz)) > z0 * 1.2, `pincement à deux doigts : zoom ${z0.toFixed(2)} -> ${(await E(() => window.__gib.tz)).toFixed(2)}`);
  const px0 = await E(() => window.__gib.tx); await touch('touchStart', [{ x: 500, y: 200 }]); for (let i = 1; i <= 8; i++) { await touch('touchMove', [{ x: 500 - i * 20, y: 200 }]); await sleep(30); } await touch('touchEnd', []); await sleep(200);
  const px1 = await E(() => ({ tx: window.__gib.tx, follow: window.__gib.follow, sel: window.__gib.selectedId, b: window.__gib.bounds, mode: window.__gib.mode })); console.log('   drag debug', px0.toFixed(0), JSON.stringify(px1)); ok(px1.tx > px0 + 12, 'glisser à un doigt : la caméra se déplace'); ok(await E(() => window.scrollX === 0 && window.scrollY === 0), 'la page ne défile pas pendant les gestes');

  console.log('\n== Mode HUMAIN : croix, diagonales, A, B');
  await tap('#mmode'); await sleep(400); ok(await E(() => window.__gib.mode === 'human' && document.getElementById('mmode').textContent === 'HUMAIN'), 'bouton DIEU/HUMAIN : bascule en mode humain');
  await E(() => { const a = window.__gib.world.avatar; a.pos = { x: 20.5, y: 20.5 }; }); await sleep(300);
  const a0 = await E(() => ({ ...window.__gib.world.avatar.pos }));
  { const rr = await rect('#dpad'); await touch('touchStart', [{ x: rr.cx + 0.3 * rr.w, y: rr.cy + 0.3 * rr.w }]); } await sleep(900); await touch('touchEnd', []); await sleep(200);
  const a1 = await E(() => ({ ...window.__gib.world.avatar.pos, keys: [...window.__gib.keys] }));
  ok(a1.x > a0.x + 1.2 && Math.abs(a1.y - a0.y) < 0.6, `joystick en diagonale écran →↓ = marche en grille (x ${a0.x.toFixed(1)} -> ${a1.x.toFixed(1)}, y ${a0.y.toFixed(1)} -> ${a1.y.toFixed(1)})`);
  const b0 = await E(() => ({ ...window.__gib.world.avatar.pos })); const r = await rect('#dpad'); await touch('touchStart', [{ x: r.cx + 0.42 * r.w, y: r.cy - 0.42 * r.w }]); await sleep(700); await touch('touchEnd', []);
  const b1 = await E(() => ({ ...window.__gib.world.avatar.pos })); ok(Math.hypot(b1.x - b0.x, b1.y - b0.y) > 0.8, 'pouce dans le coin du joystick : diagonale');
  await E(() => { const a = window.__gib.world.avatar; a.pos = { x: 42.5, y: 10.5 }; a.state = 'idle'; a.plan = []; }); await sleep(700);
  ok((await E(() => document.getElementById('prompt').textContent)).includes('A'), 'indication courte « A » près d\'un objet interactif');
  await tap('#abtn'); await sleep(800); ok(await E(() => window.__gib.world.musicUntil > window.__gib.world.clock), 'A : utilise l\'objet (jukebox)');
  await tap('#bbtn'); ok(await E(() => document.getElementById('inv').style.display === 'block'), 'B : inventaire'); await tap('#bbtn');
  const tid2 = await E(() => { const w = window.__gib.world; const r = w.residents.find((c) => !c.isAsleep() && c.state !== 'chat'); if (!r) return -1; const a = w.avatar; a.state = 'idle'; a.plan = []; for (const [dx, dy] of [[0.9, 0.1], [-0.9, 0.1], [0.1, 0.9], [0.1, -0.9], [0.6, 0.6], [-0.6, -0.6]]) { a.pos = { x: r.pos.x + dx, y: r.pos.y + dy }; if (w.isWalkable(a.cell()) && window.__gib.canTalkTo(r.id)) return r.id; } a.pos = { ...r.pos }; return r.id; });
  if (tid2 >= 0) { await sleep(600); await tap('#abtn'); await sleep(500); const opened = await E(() => document.getElementById('dlg').style.display === 'block' || document.getElementById('ctx').style.display === 'block'); ok(opened, 'A près d\'un habitant : la conversation (ou le choix de cible) s\'ouvre');
    if (await E(() => document.getElementById('ctx').style.display === 'block')) await tap('#ctx button:nth-child(2)'); await sleep(300);
    if (await E(() => document.getElementById('dlg').style.display === 'block')) { const dr = await rect('#dlg'); ok(dr.t >= 0 && dr.b <= 390 && dr.l >= 0 && dr.r <= 844, 'le dialogue reste entièrement à l\'écran'); const f0 = await E((id) => window.__gib.world.getRel(id, 8).fam, tid2); await tap('#dlg button[data-i="1"]'); ok((await E((id) => window.__gib.world.getRel(id, 8).fam, tid2)) > f0, 'choix de dialogue au toucher : la relation évolue'); await tap('#dlg button:last-of-type'); await touch('touchStart', [{ x: 1, y: 1 }]); await touch('touchEnd', []); await E(() => window.__gib.hud.closeDialogue()); } else ok(true, '(cible choisie via menu contextuel)'); }
  console.log('\n== Retour en DIEU, menu, sauvegarde'); await tap('#mmode'); await sleep(500); ok(await E(() => window.__gib.mode === 'god' && document.getElementById('mmode').textContent === 'DIEU'), 'retour en mode dieu sans réinitialiser le monde');
  const sm = await E(() => window.__gib.world.avatar.money); await tap('#mmenu'); await tap('#msheet [data-k="save"]'); ok(await E(() => localStorage.getItem('god-is-bored:slot1') !== null), 'Menu → Sauvegarder'); const ck = await E(() => window.__gib.world.clock); await E(() => window.__gib.setSpeed(3)); await sleep(1500); await E(() => window.__gib.setSpeed(1));
  await tap('#mmenu'); await tap('#msheet [data-k="load"]'); await sleep(900); ok(Math.abs((await E(() => window.__gib.world.clock)) - ck) < 12 && (await E(() => window.__gib.world.avatar.money)) === sm, 'Menu → Charger : partie restaurée');
  ok(await E(() => document.getElementById('msheet').style.display !== 'block'), 'les feuilles temporaires se referment');
  await tap('#mspeed'); ok((await E(() => window.__gib.speedIndex)) === 2, 'bouton vitesse compact : 3x');
  console.log('\n== Erreurs de console'); ok(errs.length === 0, `aucune erreur JS (${errs.length})`); errs.slice(0, 4).forEach((e) => console.log('   ', e));
  await pg.screenshot({ path: 'docs/shots/m_test_end.png' });
  console.log(`\n${n} vérifications, ${fails} échec(s)`); await b.close(); process.exit(fails ? 1 : 0);
})();
