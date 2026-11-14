// RÉGRESSION JOYSTICK : le personnage ne continue JAMAIS à marcher quand le joueur relâche (ou quand le toucher est interrompu), et le joystick reste réactif après des interruptions répétées.
// Scénarios : relâchement normal, toucher annulé, fin de toucher perdue (perte de focus, arrière-plan), ouverture de menu en tenant, changement de mode en tenant, multitouch avec A,
// identifiant de pointeur périmé, clavier + perte de focus, 12 interruptions successives. iPhone 13 émulé, vrais événements tactiles (CDP).
const { chromium, devices } = require('playwright');
const URL = process.env.GAME_URL || 'http://localhost:5173/';
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log(c ? '  [OK]   ' : '  [FAIL] ', m); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ ...devices['iPhone 13 landscape'], viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 });
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(String(e))); pg.on('console', (m) => m.type() === 'error' && errs.push(m.text())); const E = (f, a) => pg.evaluate(f, a);
  const cdp = await ctx.newCDPSession(pg); const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  const rect = (sel) => E((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { cx: (r.left + r.right) / 2, cy: (r.top + r.bottom) / 2, w: r.width }; }, sel);
  const pos = () => E(() => ({ ...window.__gib.world.avatar.pos }));
  const mv = (a, b2) => Math.hypot(a.x - b2.x, a.y - b2.y);
  await pg.goto(URL + '?fresh&nohelp&human&simulate=620&speed=1&zoom=1.2'); await pg.waitForFunction(() => window.__gib && window.__gib.world, null, { timeout: 60000 }); await pg.evaluate(() => { window.__gib.world.narrations = []; while (window.__nav.list().length) window.__nav.closeTop(); }); await pg.waitForTimeout(1500);
  const open = () => E(() => { while (window.__nav.list().length) window.__nav.closeTop(); const g = window.__gib, w = g.world; for (const c of w.chars) if (c.kind !== 'avatar') c.away = true; w.avatar.pos = { x: 20.5, y: 27.5 }; w.abortPlan(w.avatar, 't'); w.avatar.state = 'idle'; g.setSpeed(1); g.resetInput && g.resetInput('test'); });
  await open(); const pad = await rect('#dpad'); const arm = { x: pad.cx, y: pad.cy - 0.36 * pad.w };   // pousser vers le haut (chemin dégagé sur la plage)
  const press = (id = 1, x = arm.x, y = arm.y) => touch('touchStart', [{ x, y, id }]);
  const assertStops = async (label, wait = 350) => { await sleep(wait); const p1 = await pos(); await sleep(600); const p2 = await pos(); ok(mv(p1, p2) < 0.05, `${label} : le personnage s'arrête (dérive ${mv(p1, p2).toFixed(3)} case)`); return p2; };
  const assertMoves = async (label) => { await open(); const p0 = await pos(); await press(); await sleep(600); const p1 = await pos(); ok(mv(p0, p1) > 0.5, `${label} : le joystick répond (${mv(p0, p1).toFixed(2)} case parcourue)`); await touch('touchEnd', []); await sleep(150); };

  console.log('\n== 1. Relâchement normal');
  const p0 = await pos(); await press(); await sleep(700); const pm = await pos(); ok(mv(p0, pm) > 0.8, `appuyer fait marcher (${mv(p0, pm).toFixed(2)} case)`); await touch('touchEnd', []); await assertStops('relâché');
  ok(await E(() => window.__gib.analog.mag === 0 && window.__gib.world.input.dx === 0 && window.__gib.world.input.dy === 0 && !document.getElementById('dpad').classList.contains('on')), 'état interne remis à zéro (analogique, entrée du monde, voyant)');

  console.log('\n== 2. Toucher annulé par le système (touchCancel)');
  await open(); await press(); await sleep(400); await touch('touchCancel', []); await assertStops('toucher annulé'); await assertMoves('après annulation');

  console.log('\n== 3. Fin de toucher perdue : perte de focus, puis retour depuis l\'arrière-plan');
  await open(); await press(); await sleep(400); await E(() => window.dispatchEvent(new Event('blur'))); await assertStops('perte de focus (le doigt est resté posé)'); await touch('touchEnd', []); await assertMoves('après perte de focus');
  await open(); await press(); await sleep(400); await E(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); Object.defineProperty(document, 'hidden', { value: false, configurable: true }); }); await assertStops('passage en arrière-plan'); await touch('touchEnd', []); await assertMoves('après retour d\'arrière-plan');

  console.log('\n== 4. Ouverture d\'un menu en tenant le joystick');
  await open(); await press(); await sleep(400); await E(() => window.__gib.hud.mobile.openMenu()); await assertStops('menu ouvert en tenant'); await touch('touchEnd', []); await E(() => window.__nav.closeTop()); await sleep(200); await assertMoves('après fermeture du menu');
  await open(); await press(); await sleep(300); await E(() => { const w = window.__gib.world; const n = w.residents[0]; n.away = false; n.pos = { x: w.avatar.pos.x + 1, y: w.avatar.pos.y }; window.__gib.hud.openDialogue(n); }); await assertStops('dialogue ouvert en tenant'); await touch('touchEnd', []); await E(() => { window.__gib.hud.closeDialogue(); }); await sleep(200); await assertMoves('après dialogue');

  console.log('\n== 5. Changement de mode en tenant');
  await open(); await press(); await sleep(400); await E(() => window.__gib.toggleMode()); await sleep(300); await E(() => window.__gib.toggleMode()); await sleep(500); await assertStops('aller-retour Dieu / Descendre en tenant'); await touch('touchEnd', []); await assertMoves('après changement de mode');

  console.log('\n== 6. Multitouch : joystick tenu pendant que A est pressé');
  await open(); await E(() => { window.__gib.world.avatar.pos = { x: 12.5, y: 27.5 }; }); const ab = await rect('#abtn'); await press(1); await sleep(300); await touch('touchStart', [{ x: arm.x, y: arm.y, id: 1 }, { x: ab.cx, y: ab.cy, id: 2 }]); await sleep(120); await touch('touchEnd', [{ x: ab.cx, y: ab.cy, id: 2 }]); await sleep(300);
    const pa = await pos(); await sleep(500); const pb = await pos(); ok(mv(pa, pb) > 0.4, 'le joystick reste actif quand le doigt de A se lève'); await touch('touchEnd', []); await assertStops('puis tout relâché');

  console.log('\n== 7. Identifiant de pointeur périmé (fin de toucher jamais reçue)');
  await open(); await E(() => { const pad = document.getElementById('dpad'); const r = pad.getBoundingClientRect(); pad.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 77, clientX: r.left + r.width * 0.8, clientY: r.top + r.height / 2, bubbles: true, isPrimary: true })); });
  await sleep(100); await E(() => (window.__gib.resetInput && window.__gib.resetInput('test'))); await assertMoves('après un pointeur fantôme (le joystick reprend la main)');
  await open(); await E(() => { const pad = document.getElementById('dpad'); const r = pad.getBoundingClientRect(); pad.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 78, clientX: r.left + r.width * 0.8, clientY: r.top + r.height / 2, bubbles: true, isPrimary: true })); });
  await sleep(100); const q0 = await pos(); await press(); await sleep(600); const q1 = await pos(); ok(mv(q0, q1) > 0.5, 'un pointeur fantôme resté « tenu » ne bloque pas un nouveau toucher'); await touch('touchEnd', []); await assertStops('relâché après reprise');

  console.log('\n== 8. Clavier : touche tenue puis perte de focus');
  await open(); const k0 = await pos(); await pg.keyboard.down('w'); await sleep(500); const k1 = await pos(); await E(() => window.dispatchEvent(new Event('blur'))); await sleep(200); await assertStops('flèche tenue puis perte de focus'); await pg.keyboard.up('w'); ok(mv(k0, k1) > 0.3, 'le clavier avait bien fait avancer le personnage');

  console.log('\n== 9. Douze interruptions successives : le joystick reste réactif');
  const kinds = ['cancel', 'blur', 'menu', 'end', 'hidden', 'mode']; let good = 0;
  for (let i = 0; i < 12; i++) {
    await open(); const a0 = await pos(); await press(); await sleep(350); const a1 = await pos(); const kind = kinds[i % kinds.length];
    if (kind === 'cancel') await touch('touchCancel', []); else if (kind === 'blur') await E(() => window.dispatchEvent(new Event('blur'))); else if (kind === 'menu') await E(() => window.__gib.hud.mobile.openMenu());
    else if (kind === 'end') await touch('touchEnd', []); else if (kind === 'hidden') await E(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); Object.defineProperty(document, 'hidden', { value: false, configurable: true }); }); else await E(() => { window.__gib.toggleMode(); window.__gib.toggleMode(); });
    await sleep(300); const s1 = await pos(); await sleep(500); const s2 = await pos(); if (kind !== 'end') await touch('touchEnd', []).catch(() => {}); await E(() => { while (window.__nav.list().length) window.__nav.closeTop(); });
    const stopped = mv(s1, s2) < 0.05; const moved = mv(a0, a1) > 0.3; if (stopped && moved) good++; else console.log(`     interruption ${i + 1} (${kind}) : mouvement ${mv(a0, a1).toFixed(2)}, dérive ${mv(s1, s2).toFixed(3)}`);
  }
  ok(good === 12, `${good}/12 interruptions : le personnage s'arrête toujours et le joystick répond de nouveau`);
  ok(errs.length === 0, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs[0] : '')); console.log(fails ? `\n${fails} ÉCHEC(S)` : '\nJOYSTICK : tout est vert'); await b.close(); process.exit(fails ? 1 : 0);
})();
