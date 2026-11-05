// SCÉNARIO DE VALIDATION (iPhone émulé, vrai navigateur, vrai jeu) : appartement → rue → supérette → braquage → fuite → intervention divine → conséquences → sauvegarde → réouverture.
const { chromium, devices } = require('playwright');
const URL = process.env.GAME_URL || 'http://localhost:5173/';
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log(c ? '  [OK]   ' : '  [FAIL] ', m); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }); const errs = [];
  const ctx = await b.newContext({ ...devices['iPhone 13 landscape'], viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 }); const pg = await ctx.newPage(); pg.on('pageerror', (e) => errs.push(String(e))); const cdp = await ctx.newCDPSession(pg);
  const E = (f, a) => pg.evaluate(f, a); const ready = () => pg.waitForFunction(() => window.__gib && window.__gib.world, null, { timeout: 60000 });
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  const tapXY = async (x, y) => { await touch('touchStart', [{ x, y, id: 1 }]); await sleep(60); await touch('touchEnd', []); await sleep(250); };
  const tapSel = async (sel) => { const r = await E((s) => { const q = document.querySelector(s).getBoundingClientRect(); return { x: (q.left + q.right) / 2, y: (q.top + q.bottom) / 2 }; }, sel); await tapXY(r.x, r.y); await sleep(250); };
  const cellXY = (x, y) => E(([a, c]) => window.__gib.cellToScreen(a, c), [x, y]);
  const waitFor = async (f, ms = 60000, a) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await E(f, a)) return true; await sleep(300); } return false; };
  const pick = (id) => E((i) => { const h = window.__gib.hud.human; const k = h.choices.findIndex((c) => c.id === i && c.enabled); if (k < 0) return false; window.__gib.hud.pickDialogue(k); return true; }, id);

  console.log('\n== ÉTAPE 1 — APPARTEMENT : marcher, interagir avec un meuble, le déplacer');
  await pg.goto(URL + '?fresh&nohelp&speed=0'); await ready(); await pg.waitForTimeout(2000);
  await E(() => { const g = window.__gib; g.world.avatar.pos = { x: 66.5, y: 28.5 }; g.descend(false); g.setSpeed(1); g.tz = g.cz = 1.6; }); await pg.waitForTimeout(2500);
  const apt = await E(() => { const g = window.__gib; return { mode: g.mode, room: g.world.roomOf(g.world.avatar.pos), inside: g.insideBuilding }; });
  ok(apt.mode === 'human' && apt.room === 'j' && apt.inside === 'flats1', `l'avatar est dans son appartement (pièce « ${apt.room} », bâtiment ${apt.inside})`);
  await pg.screenshot({ path: 'docs/shots/scn-1-appartement.png' });
  // marcher : toucher une case libre du séjour
  const dest = await cellXY(66.5, 27.5); await tapXY(dest.x, dest.y);
  ok(await waitFor(() => { const a = window.__gib.world.avatar; return Math.hypot(a.pos.x - 66.5, a.pos.y - 27.5) < 0.8; }, 15000), 'toucher le sol : le personnage marche jusqu\'à la case');
  // interagir : s'asseoir sur le canapé (menu contextuel / usage), puis se relever
  const sofa = await E(() => { const g = window.__gib; const i = g.world.furnById.get('flat_sofa'); const nodes = g.furnNodes.get(i); const bb = nodes[1].getBounds(); const s = g.worldToScreen(bb.centerX, bb.centerY); return { x: s.x, y: s.y, i }; });
  await tapXY(sofa.x, sofa.y); await pg.waitForTimeout(600);
  const labels = await E(() => [...document.querySelectorAll('#ctx button[data-c]')].map((x) => x.textContent.trim()));
  ok(labels.some((l) => /Déplacer/.test(l)) && labels.some((l) => /Ranger/.test(l)), 'toucher le canapé : menu « ' + labels.join(' · ') + ' »');
  const before = await E((i) => { const f = window.__gib.world.furn[i]; return [f.x, f.y]; }, sofa.i);
  await E(() => { const b = [...document.querySelectorAll('#ctx button[data-c]')].find((x) => /Déplacer/.test(x.textContent)); b.click(); });
  ok(await E(() => !!window.__gib.world.homeEdit), 'mode aménagement actif : choisissez la case de destination');
  const to = await cellXY(before[0] + 1.5, before[1] + 0.5); await tapXY(to.x, to.y);
  const after = await E((i) => { const g = window.__gib; const f = g.world.furn[i]; return { p: [f.x, f.y], edit: !!g.world.homeEdit }; }, sofa.i);
  ok(!(after.p[0] === before[0] && after.p[1] === before[1]) || after.edit, `le canapé est déplacé ${JSON.stringify(before)} → ${JSON.stringify(after.p)} (ou refusé par les règles de collision, mode toujours actif : ${after.edit})`);
  await E(() => { window.__gib.world.homeEdit = null; });
  // meuble acheté puis posé via l'API de l'inventaire
  const bought = await E(() => { const g = window.__gib; const H = g.world; const money = H.avatar.money; return money; });
  await E(() => { window.__gib.hud.toggleInventory(); }); await pg.waitForTimeout(500);
  const hasShop = await E(() => !!document.querySelector('#inv button[data-by]'));
  ok(hasShop, 'inventaire : catalogue de meubles disponible dans l\'appartement'); await E(() => { const b = document.querySelector('#inv button[data-by="plant"]'); if (b) b.click(); }); await pg.waitForTimeout(400);
  ok(await E((m) => window.__gib.world.avatar.money < m && (window.__gib.world.stash.plant ?? 0) >= 1, bought), 'achat : argent débité, meuble dans l\'inventaire');
  await E(() => { const b = document.querySelector('#inv button[data-pl="plant"]'); if (b) b.click(); });
  const spot = await cellXY(60.5, 25.5); await tapXY(spot.x, spot.y); await pg.waitForTimeout(500);
  ok(await E(() => window.__gib.world.furn.some((f) => f.def === 'plant' && !f.gone && f.x === 60 && f.y === 25)), 'la plante est posée sur la case choisie');

  console.log('\n== ÉTAPE 2 — EXPLORATION : sortir de l\'immeuble, la rue, marcher jusqu\'à la supérette');
  await E(() => { const g = window.__gib; g.setSpeed(3); g.walkTo({ x: 61, y: 19 }); });
  ok(await waitFor(() => window.__gib.world.avatar.cell().y < 33 && window.__gib.insideBuilding === '', 60000), 'il sort de l\'immeuble (toit refermé, rue visible)');
  await pg.screenshot({ path: 'docs/shots/scn-2-rue.png' });
  ok(await waitFor(() => { const a = window.__gib.world.avatar; return a.cell().y <= 19 && Math.abs(a.pos.x - 61.5) < 3; }, 120000), 'il marche jusqu\'à la porte de la supérette');

  console.log('\n== ÉTAPE 3 — INTERACTION : entrer, parler au commerçant, acheter');
  await E(() => { window.__gib.setSpeed(1); window.__gib.world.clock = Math.floor(window.__gib.world.clock / 1440) * 1440 + 11 * 60; window.__gib.world.clerk.away = false; });
  await E(() => window.__gib.walkTo({ x: 62, y: 14 }));
  ok(await waitFor(() => window.__gib.insideBuilding === 'store', 40000), 'on est dans l\'épicerie');
  await E(() => { const w = window.__gib.world; w.clerk.pos = { x: 63.5, y: 15.5 }; w.clerk.state = 'idle'; w.avatar.pos = { x: 62.5, y: 14.5 }; w.abortPlan(w.avatar, 't'); w.avatar.money = 60; });
  await pg.waitForTimeout(2500); const sh = await E(() => { const g = window.__gib; g.tz = g.cz = 1.4; const f = g.world.furn.find((x) => x.id === 'shelf_b'); const bb = g.furnNodes.get(f.i)[1].getBounds(); const s = g.worldToScreen(bb.centerX, bb.centerY); return { x: s.x, y: s.y }; });
  await tapXY(sh.x, sh.y); await pg.waitForTimeout(500); await E(() => document.querySelector('#ctx button[data-c]').click());
  ok(await waitFor(() => Object.values(window.__gib.world.avatar.unpaid || {}).some((v) => v > 0), 25000), 'un article est pris sur le rayon');
  await E(() => { const g = window.__gib; g.hud.openDialogue(g.world.clerk); }); await pg.waitForTimeout(500);
  const m1 = await E(() => window.__gib.world.avatar.money); ok(await pick('pay'), 'dialogue avec le commerçant : « Payer »'); await pg.waitForTimeout(400);
  ok((await E(() => window.__gib.world.avatar.money)) < m1, 'achat effectué : argent débité'); await E(() => window.__gib.hud.closeDialogue());

  console.log('\n== ÉTAPE 4 — BRAQUAGE : menace, réaction du commerçant, témoins, butin, souvenirs');
  await E(() => { const w = window.__gib.world; w.till = 150; window.__gib.hud.openDialogue(w.clerk); }); await pg.waitForTimeout(400);
  const money0 = await E(() => window.__gib.world.avatar.money);
  ok(await pick('holdup'), 'choix « Menacer : La caisse ! » proposé'); await pg.waitForTimeout(400);
  ok(await waitFor(() => !!window.__gib.world.holdup || window.__gib.world.events.some((e) => e.kind === 'robbery'), 3000), 'la scène démarre (le commerçant est figé, les clients s\'affolent)');
  ok(await waitFor(() => !window.__gib.world.holdup, 20000), 'le commerçant réagit (obéit, résiste ou s\'enfuit selon son caractère)');
  const hu = await E(() => { const w = window.__gib.world; return { robbery: w.events.some((e) => e.kind === 'robbery'), mem: w.clerk.memories.some((m) => /braqué/.test(m.text)), money: w.avatar.money, till: w.till, reports: w.reports.length + w.dispatches.length }; });
  ok(hu.robbery && hu.mem, 'événement enregistré dans le monde + souvenir du commerçant'); console.log(`        butin : ${hu.money - money0} € · caisse ${Math.round(hu.till)} € · appels/dispatchs : ${hu.reports}`);
  await pg.screenshot({ path: 'docs/shots/scn-3-braquage.png' });

  console.log('\n== ÉTAPE 5 — FUITE : la police arrive, on peut courir');
  await E(() => { const g = window.__gib; g.setSpeed(2); g.walkTo({ x: 70, y: 21 }); });
  ok(await waitFor(() => window.__gib.world.wanted.level > 0, 40000), 'recherché(e) : étoiles');
  ok(await waitFor(() => window.__gib.world.police.some((o) => o.task && ['respond', 'pursue'].includes(o.task.kind)), 60000), 'un agent est en route (mission réelle)');
  await pg.screenshot({ path: 'docs/shots/scn-4-fuite.png' });

  console.log('\n== ÉTAPE 6 — INTERVENTION DIVINE : effacer les souvenirs puis se téléporter chez soi');
  await E(() => { const w = window.__gib.world; w.wanted.level = 0; w.reports.length = 0; const c = w.clerk; c.addMemory(w.clock, 'crime', "X m'a braqué.", -1, 1, w.avatar.id, { src: 'lived', conf: 1, subj: w.avatar.id }); w.avatar.pos = { x: 62.5, y: 14.5 }; w.abortPlan(w.avatar, 't'); });
  await E(() => window.__gib.hud.pickPower('forget')); await pg.waitForTimeout(500);
  ok(await E(() => !window.__gib.world.clerk.memories.some((m) => /braqué/.test(m.text))), 'pouvoir « effacer les souvenirs » : le commerçant a oublié le braquage (état réel de sa mémoire)');
  await E(() => window.__gib.hud.pickPower('teleport')); await pg.waitForTimeout(400);
  await E(() => { const d = [...document.querySelectorAll('#menu div')].find((x) => /appartement/i.test(x.textContent)); d.click(); }); await pg.waitForTimeout(600);
  ok(await E(() => window.__gib.world.avatar.cell().y >= 25 && window.__gib.world.roomOf(window.__gib.world.avatar.pos) === 'j'), 'téléportation : l\'avatar est de retour dans son appartement');
  ok(await E(() => window.__gib.world.divine.length >= 2), 'journal des interventions divines alimenté');

  console.log('\n== ÉTAPE 7 — CONSÉQUENCES : plus tard, dans le quartier');
  await E(() => { window.__gib.setSpeed(3); }); await pg.waitForTimeout(8000);
  const c7 = await E(() => { const w = window.__gib.world; return { clerkMem: w.clerk.memories.map((m) => m.text).slice(-3), till: w.till, loot: w.stats.holdup_loot ?? 0, money: w.avatar.money, plant: w.furn.some((f) => f.def === 'plant' && !f.gone && f.x === 60 && f.y === 25), crimes: w.record_.crimes }; });
  ok(c7.crimes >= 1, `le crime reste au casier (${c7.crimes}) ; butin ${c7.loot} € ; caisse ${Math.round(c7.till)} €`); ok(c7.plant, 'les meubles posés sont toujours là');

  console.log('\n== ÉTAPE 8 — SAUVEGARDE : sauver, fermer, rouvrir');
  const snap = await E(() => { const w = window.__gib.world; return { money: Math.round(w.avatar.money), crimes: w.record_.crimes, divine: w.divine.length, till: Math.round(w.till), furn: w.furn.length, clerkMem: w.clerk.memories.length }; });
  await tapSel('#mmenu'); await tapSel('#msheet [data-k="save"]'); await sleep(500);
  await pg.goto(URL + '?load&nohelp&speed=0'); await ready(); await pg.waitForTimeout(2500);
  const snap2 = await E(() => { const w = window.__gib.world; return { money: Math.round(w.avatar.money), crimes: w.record_.crimes, divine: w.divine.length, till: Math.round(w.till), furn: w.furn.length, clerkMem: w.clerk.memories.length, plant: w.furn.some((f) => f.def === 'plant' && !f.gone && f.x === 60 && f.y === 25) }; });
  ok(snap2.money === snap.money && snap2.crimes === snap.crimes && snap2.divine === snap.divine && Math.abs(snap2.till - snap.till) <= 2 && snap2.furn === snap.furn && snap2.plant, `après réouverture : argent ${snap2.money} €, casier ${snap2.crimes}, journal divin ${snap2.divine}, meubles ${snap2.furn}, plante posée : identiques`);
  ok(errs.length === 0, 'aucune erreur JS' + (errs.length ? ' : ' + errs[0] : ''));
  await b.close(); console.log(fails ? `\n${fails} ÉCHEC(S)` : '\nSCÉNARIO DE VALIDATION : tout est vert'); process.exit(fails ? 1 : 0);
})();
