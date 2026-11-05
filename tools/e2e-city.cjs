// NORIA OPEN WORLD — première tranche jouable, dans le vrai jeu (iPhone émulé) : explorer, entrer, voler, être recherché, poursuivi, arrêté, libéré, sauvegarder.
const { chromium, devices } = require('playwright');
const URL = process.env.GAME_URL || 'http://localhost:5173/';
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log(c ? '  [OK]   ' : '  [FAIL] ', m); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }); const errs = [];
  const ctx = await b.newContext({ ...devices['iPhone 13 landscape'], viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 }); const pg = await ctx.newPage(); pg.on('pageerror', (e) => errs.push(String(e))); const cdp = await ctx.newCDPSession(pg);
  const E = (f, a) => pg.evaluate(f, a); const ready = () => pg.waitForFunction(() => window.__gib && window.__gib.world, null, { timeout: 60000 });
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  const tapXY = async (x, y) => { await touch('touchStart', [{ x, y, id: 1 }]); await sleep(60); await touch('touchEnd', []); await sleep(200); };
  const tapSel = async (sel) => { const r = await E((s) => { const q = document.querySelector(s).getBoundingClientRect(); return { x: (q.left + q.right) / 2, y: (q.top + q.bottom) / 2 }; }, sel); await tapXY(r.x, r.y); await sleep(250); };
  const cellXY = (x, y) => E(([a, c]) => window.__gib.cellToScreen(a, c), [x, y]);
  const waitFor = async (f, ms = 60000, a) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await E(f, a)) return true; await sleep(300); } return false; };
  const here = () => E(() => { const w = window.__gib.world; const a = w.avatar; return { x: a.pos.x, y: a.pos.y, room: w.roomOf(a.pos) }; });

  console.log('\n== 1. Une ville : grande carte, chargement par blocs, population');
  await pg.goto(URL + '?fresh&nohelp&simulate=100&speed=0'); await ready(); await pg.waitForTimeout(2500);
  const info = await E(() => { const g = window.__gib, w = g.world; return { n: w.chars.length, res: w.residents.length, cit: w.citizens.length, pol: w.police.length, clerk: !!w.clerk, chunks: g.floorChunks.size, hour: w.hour() }; });
  ok(info.n === 19 && info.res === 8 && info.cit === 6 && info.pol === 2 && info.clerk, `19 personnages : ${info.res} habitants, ${info.cit} citoyens, ${info.pol} policiers, un commerçant, l'avatar, le barman`);
  for (const [x, y] of [[10, 10], [75, 20], [90, 35], [20, 30], [60, 5]]) { await E(([x, y]) => { const g = window.__gib; const p = { x: (x - y) * 32, y: (x + y) * 16 }; g.tx = g.cx = p.x; g.ty = g.cy = p.y; g.tz = g.cz = 0.8; }, [x, y]); await pg.waitForTimeout(500); await E(() => window.__gib.updateFloorChunks(99)); }
  const ch = await E(() => window.__gib.floorChunks.size); ok(ch >= 1 && ch < 28, `sol chargé par blocs de 16×16 : ${ch} blocs en mémoire après un parcours de toute la carte (28 existent)`);

  console.log('\n== 2. DIEU → DESCENDRE au centre-ville');
  await E(() => window.__gib.focusZone('downtown')); await pg.waitForTimeout(1200);
  await tapSel('#mmenu'); await tapSel('#msheet [data-k="here"]'); await pg.waitForTimeout(1500);
  const d1 = await E(() => { const g = window.__gib; const a = g.world.avatar; return { mode: g.mode, x: a.pos.x, y: a.pos.y, ctrl: g.world.avatarControlled }; });
  ok(d1.mode === 'human' && d1.ctrl && d1.x > 60 && d1.x < 90 && d1.y > 15 && d1.y < 28, `l'avatar apparaît au centre-ville (${d1.x.toFixed(0)}, ${d1.y.toFixed(0)}) en mode humain`);

  console.log('\n== 3. Entrer dans l\'épicerie par la porte (toucher la porte)');
  await E(() => { const g = window.__gib; g.world.avatar.pos = { x: 61.5, y: 21.5 }; g.world.abortPlan(g.world.avatar, 't'); g.tz = g.cz = 1.4; g.setSpeed(1); }); await pg.waitForTimeout(2500);
  const door = await cellXY(61.5, 17.5); await tapXY(door.x, door.y);
  ok(await waitFor(() => window.__gib.world.avatar.state === 'walk' || window.__gib.world.avatar.cell().y < 19, 4000), 'toucher la porte : le personnage se met en route'); 
  ok(await waitFor(() => window.__gib.insideBuilding === 'store', 25000), 'il franchit la porte : on est dans l\'épicerie'); await pg.waitForTimeout(1500);
  const inside = await E(() => { const g = window.__gib; const r = g.roofs.find((q) => q.b.name === 'store'); return { roof: r.roof.alpha, room: g.world.roomOf(g.world.avatar.pos), clerk: !g.world.clerk.away }; });
  ok(inside.roof < 0.25 && inside.room === 'M', `toit effacé (opacité ${inside.roof.toFixed(2)}), pièce « Épicerie », commerçant ${inside.clerk ? 'présent' : 'absent'}`);
  await pg.screenshot({ path: 'docs/shots/city-e2e-1-epicerie.png' });

  console.log('\n== 4. Prendre un article sur le rayon (objet réellement porté)');
  const sh = await E(() => { const g = window.__gib; const f = g.world.furn.find((x) => x.id === 'shelf_b'); const nodes = g.furnNodes.get(f.i); const bb = nodes[1].getBounds(); const s = g.worldToScreen(bb.centerX, bb.centerY); return { x: s.x, y: s.y }; });
  await tapXY(sh.x, sh.y); await pg.waitForTimeout(500);
  const ctxOpen = await E(() => document.getElementById('ctx').style.display === 'block'); ok(ctxOpen, 'toucher le rayon : menu contextuel (plusieurs articles)');
  const labels = await E(() => [...document.querySelectorAll('#ctx button')].map((b) => b.textContent.trim())); ok(labels.length === 4 && /Prendre : /.test(labels[0]), 'articles proposés : ' + labels.join(' · '));
  await E(() => document.querySelector('#ctx button').click());
  ok(await waitFor(() => window.__gib.world.avatar.unpaid && Object.values(window.__gib.world.avatar.unpaid).some((v) => v > 0), 25000), 'l\'article est dans l\'inventaire, marqué non payé');
  ok(await waitFor(() => getComputedStyle(document.getElementById('unpaid')).display !== 'none', 8000), 'bandeau « articles non payés » affiché');
  await pg.screenshot({ path: 'docs/shots/city-e2e-2-rayon.png' });

  console.log('\n== 5. Sortir sans payer : témoin, appel, recherche, poursuite');
  await E(() => { const w = window.__gib.world; const c = w.clerk; c.away = false; if (c.state !== 'use') { c.pos = { x: 63.5, y: 15.5 }; } });
  const out = await cellXY(61.5, 20.5); await tapXY(out.x, out.y);
  ok(await waitFor(() => window.__gib.world.events.some((e) => e.kind === 'shoplift'), 30000), 'sortie sans payer : le délit est enregistré (événement du monde)');
  ok(await waitFor(() => window.__gib.world.wanted.level > 0, 40000), 'le commerçant a appelé : le joueur est recherché');
  ok(await waitFor(() => getComputedStyle(document.getElementById('wanted')).display === 'block', 4000), 'étoiles de recherche affichées');
  await E(() => window.__gib.setSpeed(3));
  ok(await waitFor(() => window.__gib.world.police.some((o) => o.task && (o.task.kind === 'respond' || o.task.kind === 'pursue')), 60000), 'un agent se met en route (mission réelle)');
  await pg.screenshot({ path: 'docs/shots/city-e2e-3-recherche.png' });

  console.log('\n== 6. Arrestation, garde à vue, libération, casier');
  const m0 = await E(() => window.__gib.world.avatar.money);
  ok(await waitFor(() => !!window.__gib.world.jail, 120000), 'l\'agent rattrape et arrête le joueur');
  await pg.waitForTimeout(800);
  const j = await E(() => { const w = window.__gib.world; return { money: w.avatar.money, room: w.roomOf(w.avatar.pos), rec: { ...w.record_ }, wanted: w.wanted.level, overlay: getComputedStyle(document.getElementById('jail')).display, mode: window.__gib.mode }; });
  ok(j.money < m0 && j.room === 'C' && j.rec.arrests === 1 && j.wanted === 0, `amende payée (${m0} → ${j.money} €), joueur en cellule, casier : ${j.rec.arrests} arrestation, ${j.rec.fines} € d'amendes`);
  ok(j.overlay === 'block', 'écran de garde à vue affiché'); await pg.screenshot({ path: 'docs/shots/city-e2e-4-cellule.png' });
  const before = await here(); await touch('touchStart', [{ x: 90, y: 300, id: 1 }]); await touch('touchMove', [{ x: 130, y: 300, id: 1 }]); await sleep(800); await touch('touchEnd', []); const after = await here(); ok(Math.hypot(after.x - before.x, after.y - before.y) < 0.1, 'enfermé : le joystick ne déplace plus le personnage');
  ok(await waitFor(() => !window.__gib.world.jail, 120000), 'libération après la durée de garde à vue'); await pg.waitForTimeout(500); const free = await here(); ok(free.room === 's', 'libéré devant le commissariat');

  console.log('\n== 7. Sauvegarde et rechargement : casier, argent, état du monde');
  await E(() => window.__gib.saveGame()); const snap = await E(() => { const w = window.__gib.world; return { rec: w.record_, money: w.avatar.money, ev: w.events.length, cit: w.citizens.map((c) => [Math.round(c.money)]).join() }; });
  await pg.goto(URL + '?load&nohelp&speed=0'); await ready(); await pg.waitForTimeout(1200);
  const snap2 = await E(() => { const w = window.__gib.world; return { rec: w.record_, money: w.avatar.money, ev: w.events.length, cit: w.citizens.map((c) => [Math.round(c.money)]).join(), n: w.chars.length, mode: window.__gib.mode }; });
  ok(JSON.stringify(snap.rec) === JSON.stringify(snap2.rec) && snap.money === snap2.money && snap.ev === snap2.ev && snap.cit === snap2.cit && snap2.n === 19, 'casier, argent, événements et citoyens identiques après rechargement');

  console.log('\n== 8. Des citoyens qui vivent dans les rues (rendu réel)');
  await pg.goto(URL + '?fresh&nohelp&simulate=130&zoom=0.7&at=70,24&speed=2'); await ready(); await pg.waitForTimeout(2500);
  const mv = {}; const p0 = {}; let vis = 0, samples = 0;
  for (let i = 0; i < 30; i++) { const s = await E(() => { const g = window.__gib; const o = {}; let v = 0; for (const c of g.world.citizens.concat(g.world.police)) { const cv = g.chars[c.id]; const sc = g.worldToScreen(cv.x, cv.y); const on = !c.away && sc.x > 0 && sc.x < innerWidth && sc.y > 0 && sc.y < innerHeight; if (on) v++; o[c.id] = { x: cv.x, y: cv.y, on }; } return { o, v }; }); vis += s.v; samples++; for (const id of Object.keys(s.o)) { p0[id] = p0[id] ?? s.o[id]; mv[id] = Math.max(mv[id] ?? 0, Math.hypot(s.o[id].x - p0[id].x, s.o[id].y - p0[id].y)); } await sleep(700); if (i === 10) await pg.screenshot({ path: 'docs/shots/city-e2e-5-rues.png' }); }
  const moving = Object.values(mv).filter((d) => d > 80).length; ok(moving >= 4, `${moving} citoyens/agents se déplacent visiblement (moyenne ${(vis / samples).toFixed(1)} visibles à l'écran)`);
  ok(errs.length === 0, 'aucune erreur JS ' + errs.slice(0, 2).join('|'));
  await b.close(); console.log(fails ? `\n${fails} ÉCHEC(S)` : '\nNORIA OPEN WORLD : tout est vert'); process.exit(fails ? 1 : 0);
})();
