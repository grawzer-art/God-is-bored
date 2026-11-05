// FREE LIFE : joystick, toucher pour se déplacer, interactions contextuelles, caméra, sauvegarde — sur iPhone émulé (vrais événements tactiles).
const { chromium, devices } = require('playwright');
const URL = process.env.GAME_URL || 'http://localhost:5173/';
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log(c ? '  [OK]   ' : '  [FAIL] ', m); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ ...devices['iPhone 13 landscape'], viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 });
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(String(e)));
  const cdp = await ctx.newCDPSession(pg); const E = (f, a) => pg.evaluate(f, a);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  const load = async (q) => { await pg.goto(URL + q); await pg.waitForFunction(() => window.__gib && window.__gib.world, null, { timeout: 60000 }); await pg.waitForTimeout(1200); };
  const pos = () => E(() => ({ ...window.__gib.world.avatar.pos, st: window.__gib.world.avatar.state }));
  const tapAt = async (x, y) => { await touch('touchStart', [{ x, y, id: 1 }]); await sleep(60); await touch('touchEnd', []); await sleep(150); };
  const cellXY = (gx, gy) => E(([a, b]) => window.__gib.cellToScreen(a, b), [gx, gy]);
  const place = (x, y) => E(([a, b]) => { const w = window.__gib.world; w.abortPlan(w.avatar, 't'); w.avatar.pos = { x: a, y: b }; w.avatar.state = 'idle'; }, [x, y]);
  const settle = async () => { await pg.waitForTimeout(1500); };
  const rect = (sel) => E((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { cx: (r.left + r.right) / 2, cy: (r.top + r.bottom) / 2, w: r.width }; }, sel);

  await load('?fresh&nohelp'); await E(() => { for (const c of window.__gib.world.chars) c.decision_cooldown = 1e9; });
  await E(() => document.getElementById('mmode').click()); await pg.waitForTimeout(500);
  ok(await E(() => window.__gib.mode === 'human'), 'mode HUMAIN actif (accès DIEU / HUMAIN conservé)');
  await E(() => { window.__gib.tz = window.__gib.cz = 2; }); await place(20.5, 21.5); await settle();

  console.log('\n== 1. Joystick');
  const jr = await rect('#dpad'); const p0 = await pos(); const t0 = Date.now();
  await touch('touchStart', [{ x: jr.cx, y: jr.cy, id: 1 }]); await touch('touchMove', [{ x: jr.cx + 0.42 * jr.w, y: jr.cy, id: 1 }]);
  const early = await E(() => window.__gib.world.input.mag); ok(early > 0.4, `entrée prise en compte immédiatement (mag ${early.toFixed(2)}, ${Date.now() - t0} ms après le toucher)`);
  await sleep(900); const p1 = await pos(); ok(Math.hypot(p1.x - p0.x, p1.y - p0.y) > 1.0, `le personnage marche (${Math.hypot(p1.x - p0.x, p1.y - p0.y).toFixed(1)} cases en ~1 s)`);
  ok(await E(() => document.querySelector('#dpad .jknob').style.transform !== ''), 'la manette suit le doigt');
  await touch('touchMove', [{ x: jr.cx + 0.1 * jr.w, y: jr.cy, id: 1 }]); await sleep(50); const slowMag = await E(() => window.__gib.world.input.mag); ok(slowMag < 0.3, `petite inclinaison = marche lente (mag ${slowMag.toFixed(2)})`);
  await touch('touchEnd', []); await sleep(150); const q0 = await pos(); await sleep(400); const q1 = await pos();
  ok(Math.hypot(q1.x - q0.x, q1.y - q0.y) < 0.05 && (await E(() => window.__gib.world.input.mag === 0 || window.__gib.world.input.dx === 0)), 'relâcher arrête net le personnage');
  ok(await E(() => { const c = window.__gib.world.avatar; return c.facing >= 0 && c.pose === 'stand'; }), 'pose debout, orientation conservée à l\'arrêt');
  const opa = await E(() => parseFloat(getComputedStyle(document.getElementById('dpad')).opacity)); ok(opa < 0.8, `joystick semi-transparent au repos (opacité ${opa})`);

  console.log('\n== 2. Traverser une rue en touchant la destination');
  await E(() => { window.__gib.tz = window.__gib.cz = 1.4; }); await place(10.5, 19.5); await settle();
  const tgt = await cellXY(10.5, 22.5); await tapAt(tgt.x, tgt.y); const mk = await E(() => !!window.__gib.dest);
  ok(mk, 'repère de destination affiché'); await sleep(2800); const c2 = await pos(); ok(Math.hypot(c2.x - 10.5, c2.y - 22.5) < 0.6 && c2.st === 'idle', `arrivé à destination (${c2.x.toFixed(1)}, ${c2.y.toFixed(1)})`);
  await sleep(600); ok(await E(() => window.__gib.dest === null), 'repère effacé à l\'arrivée');

  console.log('\n== 3. Contourner un bâtiment');
  await E(() => { window.__gib.tz = window.__gib.cz = 0.55; }); await place(29.5, 15.5); await settle();
  const far = await cellXY(41.5, 6.5); ok(far.x > 0 && far.x < 844 && far.y > 0 && far.y < 390, `destination au nord du bar visible à l'écran (${Math.round(far.x)}, ${Math.round(far.y)})`);
  await tapAt(far.x, far.y); let bad = 0, arrived = false;
  for (let i = 0; i < 70; i++) { await sleep(300); const ok2 = await E(() => { const a = window.__gib.world.avatar; return window.__gib.world.isWalkable({ x: Math.floor(a.pos.x), y: Math.floor(a.pos.y) }); }); if (!ok2) bad++; const q = await pos(); if (Math.hypot(q.x - 41.5, q.y - 6.5) < 0.6) { arrived = true; break; } }
  ok(bad === 0 && arrived, `le bar est contourné, aucun mur traversé, destination atteinte`);

  console.log('\n== 4. Du déplacement automatique au joystick');
  await E(() => { window.__gib.tz = window.__gib.cz = 1.4; }); await place(4.5, 20.5); await settle(); const f = await cellXY(12.5, 21.5); await tapAt(f.x, f.y);
  await sleep(500); ok((await pos()).st === 'walk', 'trajet automatique en cours');
  const jr2 = await rect('#dpad'); await touch('touchStart', [{ x: jr2.cx, y: jr2.cy, id: 1 }]); await touch('touchMove', [{ x: jr2.cx - 0.4 * jr2.w, y: jr2.cy, id: 1 }]); await sleep(120);
  const cancelled = await E(() => { const a = window.__gib.world.avatar; return { plan: a.plan.length, path: a.path.length, st: a.state }; }); await touch('touchEnd', []);
  ok(cancelled.plan === 0 && cancelled.st !== 'walk' || cancelled.plan === 0, `le joystick annule immédiatement le trajet (état ${cancelled.st})`);

  console.log('\n== 5. Toucher un PNJ');
  await E(() => { const w = window.__gib.world; const n = w.chars[2]; w.abortPlan(n, 't'); n.pos = { x: 18.5, y: 21.5 }; n.state = 'idle'; n.away = false; n.decision_cooldown = 1e9; }); await place(8.5, 21.5); await E(() => { window.__gib.tz = window.__gib.cz = 1.2; }); await settle();
  const np = await E(() => { const cv = window.__gib.chars[2]; return window.__gib.worldToScreen(cv.x, cv.y - 20); }); ok(np.x > 0 && np.x < 844, `PNJ visible à l'écran (${Math.round(np.x)}, ${Math.round(np.y)})`);
  await tapAt(np.x, np.y); await sleep(300); ok((await pos()).st === 'walk', 'le personnage s\'avance vers le PNJ (pas de dialogue à distance)');
  let dlg = false; for (let i = 0; i < 40 && !dlg; i++) { await sleep(300); dlg = await E(() => window.__gib.hud.dialogueOpen()); }
  const dd = await E(() => { const w = window.__gib.world; return Math.hypot(w.chars[2].pos.x - w.avatar.pos.x, w.chars[2].pos.y - w.avatar.pos.y); }); ok(dlg && dd <= 1.95, `dialogue ouvert une fois à portée (distance ${dd.toFixed(2)})`);
  await E(() => window.__gib.hud.closeDialogue());

  console.log('\n== 6. Interagir avec un meuble');
  await E(() => { window.__gib.setSpeed(1); const w = window.__gib.world; w.avatar.needs.hunger = 30; }); await E(() => { const w = window.__gib.world; const f = w.furn.find((x) => x.def === 'fridge'); const c = w.nearestFreeCell({ x: f.x + 2, y: f.y + 3 }, 4); w.abortPlan(w.avatar, 't'); w.avatar.pos = { x: c.x + 0.5, y: c.y + 0.5 }; w.avatar.state = 'idle'; window.__gib.tz = window.__gib.cz = 1.6; }); await settle();
  const fur = await E(() => { const g = window.__gib; const I = g.world; for (const [fi, nodes] of g.furnNodes) { const f = I.furn[fi]; if (f.def !== 'fridge') continue; const n = nodes[0]; const b = n.getBounds(); const s = g.worldToScreen(b.centerX, b.centerY); return { fi, x: s.x, y: s.y }; } return null; });
  console.log('   meuble de test :', JSON.stringify(fur));
  if (fur) { await tapAt(fur.x, fur.y); await sleep(300); const st = await E(() => ({ ctx: document.getElementById('ctx').style.display === 'block', walk: window.__gib.world.avatar.state })); ok(st.ctx || st.walk === 'walk' || st.walk === 'use', `toucher le frigo : ${st.ctx ? 'menu contextuel (plusieurs actions)' : 'le personnage s\'y rend'}`);
    if (st.ctx) { await E(() => document.querySelector('#ctx button').click()); }
    let used = false; for (let i = 0; i < 60 && !used; i++) { await sleep(300); used = await E((fi) => { const a = window.__gib.world.avatar; return a.state === 'use' && a.use_furn === fi; }, fur.fi); } ok(used, 'le personnage utilise le meuble une fois arrivé au point d\'accès'); }
  await settle();
  await E(() => { const w = window.__gib.world; const f = w.furn.find((x) => x.def === 'nightstand'); window.__ns = f ? f.i : -1; const c = w.nearestFreeCell({ x: f.x + 1, y: f.y + 2 }, 4); w.abortPlan(w.avatar, 't'); w.avatar.pos = { x: c.x + 0.5, y: c.y + 0.5 }; w.avatar.state = 'idle'; }); await settle();
  const ns = await E(() => { const g = window.__gib; const nodes = g.furnNodes.get(window.__ns); if (!nodes) return null; const b = nodes[0].getBounds(); return g.worldToScreen(b.centerX, b.centerY); });
  if (ns) { await tapAt(ns.x, ns.y); await sleep(300); const t = await E(() => document.getElementById('toast').textContent); ok(/Rien à faire/.test(t), `objet sans action : message honnête « ${t} »`); }

  console.log('\n== 7. Un mur empêche l\'interaction');
  await E(() => { const w = window.__gib.world; const n = w.chars[3]; w.abortPlan(n, 't'); n.pos = { x: 11.2, y: 16.5 }; n.state = 'idle'; n.away = false; n.decision_cooldown = 1e9; }); await place(9.8, 16.5); await E(() => { window.__gib.tz = window.__gib.cz = 2; }); await settle();
  const wn = await E(() => { const cv = window.__gib.chars[3]; return window.__gib.worldToScreen(cv.x, cv.y - 20); }); await tapAt(wn.x, wn.y); await sleep(250);
  const wl = await E(() => ({ dlg: window.__gib.hud.dialogueOpen(), st: window.__gib.world.avatar.state })); ok(!wl.dlg && wl.st === 'walk', 'PNJ derrière le mur : aucun dialogue immédiat, le personnage contourne par la porte');
  await E(() => window.__gib.world.abortPlan(window.__gib.world.avatar, 't'));

  console.log('\n== Caméra');
  await place(20.5, 21.5); await E(() => { window.__gib.tz = window.__gib.cz = 2; const c = window.__gib.camLimits(); window.__lim = c; }); await settle();
  await E(() => { window.__j = []; let last = null; const f = () => { const g = window.__gib; const cam = g.cameras.main; const c = { x: cam.worldView.centerX, y: cam.worldView.centerY }; if (last) window.__j.push(Math.hypot(c.x - last.x, c.y - last.y)); last = c; window.__raf = requestAnimationFrame(f); }; f(); });
  const jr3 = await rect('#dpad'); await touch('touchStart', [{ x: jr3.cx, y: jr3.cy, id: 1 }]); await touch('touchMove', [{ x: jr3.cx + 0.45 * jr3.w, y: jr3.cy + 0.45 * jr3.w, id: 1 }]); await sleep(2500); await touch('touchEnd', []);
  const cj = await E(() => { cancelAnimationFrame(window.__raf); const a = window.__j; return { max: Math.max(...a), n: a.length }; });
  ok(cj.max < 40, `déplacement de caméra fluide : saut maximal ${cj.max.toFixed(1)} px monde entre deux images (${cj.n} images)`);
  await E(() => { window.__gib.tz = window.__gib.cz = 2; const a = window.__gib.world.avatar; a.pos = { x: 50.5, y: 22.5 }; }); await settle();
  const lim = await E(() => { const g = window.__gib; const c = g.camLimits(); const cam = g.cameras.main; return { cx: cam.worldView.centerX, cy: cam.worldView.centerY, c }; });
  ok(lim.cx <= lim.c.x1 + 1.5 && lim.cx >= lim.c.x0 - 1.5 && lim.cy <= lim.c.y1 + 1.5 && lim.cy >= lim.c.y0 - 1.5, 'la caméra reste dans les limites du monde au bord de la carte');

  console.log('\n== 8. Sauvegarder et recharger');
  await place(23.5, 21.5); await E(() => window.__gib.saveGame()); await sleep(300);
  await load('?load&nohelp'); const sv = await E(() => ({ mode: window.__gib.mode, x: window.__gib.world.avatar.pos.x, y: window.__gib.world.avatar.pos.y }));
  ok(sv.mode === 'human' && Math.hypot(sv.x - 23.5, sv.y - 21.5) < 0.2, `partie rechargée : mode humain, position conservée (${sv.x.toFixed(1)}, ${sv.y.toFixed(1)})`);
  const jr4 = await rect('#dpad'); await touch('touchStart', [{ x: jr4.cx, y: jr4.cy, id: 1 }]); await touch('touchMove', [{ x: jr4.cx - 0.4 * jr4.w, y: jr4.cy, id: 1 }]); await sleep(500); await touch('touchEnd', []);
  const sv2 = await pos(); ok(Math.hypot(sv2.x - 23.5, sv2.y - 21.5) > 0.5, 'le joystick fonctionne après rechargement');

  const fps = await E(() => new Promise((r) => { let n = 0; const t = performance.now(); const f = () => { n++; if (performance.now() - t < 2000) requestAnimationFrame(f); else r(n / 2); }; f(); })); console.log(`   (info) images/s dans ce navigateur de test sans GPU : ${fps.toFixed(0)} — non représentatif d'un iPhone`);
  ok(errs.length === 0, 'aucune erreur JS ' + errs.slice(0, 2).join('|'));
  await b.close(); console.log(fails ? `\n${fails} ÉCHEC(S)` : '\nFREE LIFE : tout est vert'); process.exit(fails ? 1 : 0);
})();
