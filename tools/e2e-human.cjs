// Test de jeu du MODE HUMAIN dans un vrai navigateur : on marche, on entre au bar, on commande, on parle, on repasse en dieu.
const { chromium } = require('playwright');
const URL = process.env.GAME_URL || 'http://localhost:5173/';
let fails = 0, n = 0; const ok = (c, m) => { n++; if (!c) fails++; console.log(c ? '  [OK]   ' : '  [FAIL] ', m); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
  const pg = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage(); const errs = [];
  pg.on('console', (m) => m.type() === 'error' && errs.push(m.text())); pg.on('pageerror', (e) => errs.push(String(e)));
  await pg.goto(URL + '?fresh&nohelp&simulate=420'); await pg.waitForFunction(() => window.__gib && window.__gib.world, null, { timeout: 30000 }); await pg.waitForTimeout(1200);
  const E = (f, a) => pg.evaluate(f, a);
  const av = () => E(() => { const a = window.__gib.world.avatar; return { x: a.pos.x, y: a.pos.y, state: a.state, money: a.money, drunk: a.drunk, room: window.__gib.world.roomOf(a.pos) }; });
  const hold = async (keys, until, maxMs = 20000) => { for (const k of keys) await pg.keyboard.down(k); const t0 = Date.now(); while (Date.now() - t0 < maxMs) { if (await E(until)) break; await sleep(100); } for (const k of keys) await pg.keyboard.up(k); };

  console.log('\n== Descendre parmi les habitants');
  ok(await E(() => window.__gib.world.barOpen()), 'il est 21 h : le bar est ouvert');
  await pg.keyboard.press('g'); await pg.waitForTimeout(1200);
  ok(await E(() => window.__gib.mode === 'human' && window.__gib.world.avatarControlled), 'touche G : mode humain, avatar contrôlé');
  ok(await E(() => document.getElementById('ui').classList.contains('human') && getComputedStyle(document.getElementById('god')).display === 'none'), 'interface humaine affichée, panneaux de dieu masqués');
  ok((await E(() => document.getElementById('hhud').textContent)).includes('60 €'), 'bandeau : 60 € en poche');
  const t0 = await E(() => window.__gib.world.clock); await pg.waitForTimeout(1500); ok((await E(() => window.__gib.world.clock)) > t0, 'le monde continue d\'évoluer en mode humain');

  console.log('\n== Marcher dans le quartier (clavier)');
  const a0 = await av();
  await hold(['d', 's'], () => window.__gib.world.avatar.pos.x > 37.6, 25000);
  for (let i = 0; i < 20; i++) { const x = (await av()).x; if (x > 38.3 && x < 38.7) break; const k = x < 38.3 ? ['d', 's'] : ['a', 'w']; for (const q of k) await pg.keyboard.down(q); await sleep(60); for (const q of k) await pg.keyboard.up(q); await sleep(250); }
  const a1 = await av();
  ok(a1.x > a0.x + 15 && a1.room === 's', `D+S : l'avatar longe le trottoir (x ${a0.x.toFixed(1)} -> ${a1.x.toFixed(1)})`);
  await hold(['d', 'w'], () => window.__gib.world.roomOf(window.__gib.world.avatar.pos) === 'B', 8000); const a2 = await av();
  console.log('   a1', JSON.stringify(a1), 'a2', JSON.stringify(a2)); ok(a2.room === 'B', `entre dans le bar par la porte (pièce : ${a2.room})`);
  await hold(['d', 'w'], () => window.__gib.world.avatar.pos.y < 13.2, 6000); await pg.waitForTimeout(300);
  ok((await E(() => document.getElementById('hhud').textContent)).includes('bar'), 'le bandeau indique la pièce : bar');
  await pg.screenshot({ path: 'docs/shots/v2_a3_inbar.png' });

  console.log('\n== Parler au barman et commander');
  const pos = await E(() => { const g = window.__gib; const cv = g.chars[9]; return g.worldToScreen(cv.x, cv.y - 20); });
  ok(await E(() => !window.__gib.world.barman.away), 'le barman est à son poste');
  await pg.mouse.click(pos.x, pos.y); await pg.waitForFunction(() => document.getElementById('dlg').style.display === 'block', null, { timeout: 15000 });
  ok(true, 'clic sur le barman : l\'avatar s\'approche et la conversation s\'ouvre'); ok(await E(() => window.__gib.speedIndex === 0), 'le monde est en pause pendant la conversation');
  ok((await E(() => document.getElementById('dlg').textContent)).includes('Gaby'), 'dialogue avec Gaby');
  await pg.click('#dlg button:has-text("Commander")'); await pg.waitForTimeout(300);
  ok((await E(() => document.getElementById('dlg').textContent)).includes('Whisky'), 'la carte des boissons s\'affiche');
  const m0 = (await av()).money; await pg.click('#dlg button:has-text("Whisky")'); await pg.waitForTimeout(300); const a3 = await av();
  ok(a3.money === m0 - 7, `paiement : ${m0} € -> ${a3.money} €`); ok(a3.drunk > 20, `ivresse : ${a3.drunk.toFixed(0)} %`);
  ok(await E(() => window.__gib.world.stats.drinks === 1 && window.__gib.world.barman.money > 300), 'les données persistantes changent (ventes, caisse du barman)');
  await pg.screenshot({ path: 'docs/shots/v2_a4_dialog.png' });
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(400);
  ok(await E(() => document.getElementById('dlg').style.display === 'none' && window.__gib.speedIndex === 1), 'Échap : conversation fermée, le temps reprend');
  await pg.waitForTimeout(4000); ok((await E(() => window.__gib.world.avatar.stats.done_drink || 0)) >= 1, 'l\'avatar a bu son verre (animation réelle)');

  console.log('\n== Objets du décor');
  await E(() => { const w = window.__gib.world; const a = w.avatar; a.pos = { x: 42.5, y: 10.5 }; a.state = 'idle'; a.plan = []; });
  await pg.waitForTimeout(500); ok((await E(() => document.getElementById('prompt').textContent)).includes('jukebox'), 'invite d\'interaction : jukebox');
  await pg.keyboard.press('e'); await pg.waitForTimeout(800); ok(await E(() => window.__gib.world.musicUntil > window.__gib.world.clock), 'E : le jukebox joue (état persistant)');
  ok(await E(() => window.__gib.world.furn[window.__gib.world.furnById.get('jukebox')].on), 'le jukebox s\'allume');

  console.log('\n== Parler à un habitant');
  const target = await E(() => { const w = window.__gib.world; const r = w.residents.find((c) => !c.away && !c.isAsleep() && c.state !== 'chat'); return r ? r.id : -1; });
  ok(target >= 0, `un habitant est éveillé (id ${target})`);
  await E((id) => { const w = window.__gib.world; const npc = w.chars[id]; const a = w.avatar; w.getRel(id, a.id).aff = 10; a.state = 'idle'; a.plan = []; for (const [dx, dy] of [[0.3, 0.1], [-0.3, 0.1], [0.1, 0.3], [0.1, -0.3], [0.6, 0.6], [-0.6, -0.6]]) { a.pos = { x: npc.pos.x + dx, y: npc.pos.y + dy }; const l = window.__gib.canTalkTo(id); if (w.isWalkable(a.cell()) && l) return; } a.pos = { x: npc.pos.x, y: npc.pos.y }; }, target); await pg.waitForTimeout(500);
  const fam0 = await E((id) => window.__gib.world.getRel(id, 8).fam, target); const mem0 = await E((id) => window.__gib.world.chars[id].memories.length, target);
  console.log('   cible', await E((id) => { const g = window.__gib, w = g.world; const n = w.chars[id]; return JSON.stringify({ id, state: n.state, away: n.away, asleep: n.isAsleep(), d: Math.hypot(n.pos.x - w.avatar.pos.x, n.pos.y - w.avatar.pos.y).toFixed(2), canTalk: g.canTalkTo(id), av: w.avatar.state }); }, target));
  await pg.keyboard.press('e'); await pg.waitForFunction(() => document.getElementById('dlg').style.display === 'block' || document.getElementById('ctx').style.display === 'block', null, { timeout: 8000 }).catch(() => {});
  if (await E(() => document.getElementById('ctx').style.display === 'block')) await pg.click('#ctx button:has-text("Parler")');
  await pg.waitForFunction(() => document.getElementById('dlg').style.display === 'block'); ok(true, 'E : la conversation avec l\'habitant s\'ouvre');
  for (const label of ['Bavarder', 'Comment ça va', 'Bavarder', 'Plaisanter']) { await pg.click(`#dlg button:has-text("${label}")`); await pg.waitForTimeout(200); }
  const fam1 = await E((id) => window.__gib.world.getRel(id, 8).fam, target); const mem1 = await E((id) => window.__gib.world.chars[id].memories.length, target);
  ok(fam1 > fam0 + 6, `la familiarité augmente (${fam0.toFixed(0)} -> ${fam1.toFixed(0)})`); ok(mem1 > mem0 && (await E((id) => window.__gib.world.chars[id].memories.some((m) => m.other === 8), target)), 'l\'habitant garde un souvenir de vous');
  await pg.keyboard.press('Escape');
  await pg.keyboard.press('i'); await pg.waitForTimeout(200); ok(await E(() => document.getElementById('inv').style.display === 'block' && document.getElementById('inv').textContent.includes('Sandwich')), 'I : inventaire (objets, argent)'); await pg.keyboard.press('i');
  const h0 = (await E(() => window.__gib.world.avatar.needs.hunger)); await E(() => { window.__gib.world.avatar.needs.hunger = 20; });
  await pg.click('#hhud button[data-use="sandwich"]'); await pg.waitForTimeout(200); ok((await E(() => window.__gib.world.avatar.needs.hunger)) > 50 && (await E(() => window.__gib.world.avatar.inventory.sandwich)) === 0, `manger le sandwich : faim ${h0.toFixed(0)}→ restaurée, objet consommé`);

  console.log('\n== Retour en dieu : même monde');
  const keepX = (await av()).x; const money = (await av()).money; const clk = await E(() => window.__gib.world.clock);
  await pg.keyboard.press('g'); await pg.waitForTimeout(800);
  ok(await E(() => window.__gib.mode === 'god' && !window.__gib.world.avatarControlled && getComputedStyle(document.getElementById('god')).display !== 'none'), 'G : retour en mode dieu, panneaux divins revenus');
  ok((await av()).money === money, 'l\'argent de l\'avatar est conservé'); await pg.waitForTimeout(1500); ok((await E(() => window.__gib.world.clock)) > clk, 'le monde a continué');
  ok(Math.abs((await av()).x - keepX) < 0.5, 'l\'avatar reste là où vous l\'avez laissé (dans le quartier)');
  await pg.click('#portraits .pt:nth-child(1)'); await pg.waitForFunction(() => document.getElementById('charp').textContent.includes('Son avis sur vous'), null, { timeout: 8000 }).catch(() => {}); ok((await E(() => document.getElementById('charp').textContent)).includes('Son avis sur vous'), 'la fiche d\'un habitant montre ce qu\'il pense de vous');
  await pg.click('#charp #dgb'); await pg.waitForTimeout(500); ok((await E(() => document.getElementById('charp').textContent)).includes('score'), 'mode diagnostic : décisions expliquées (scores et raisons)');
  await pg.screenshot({ path: 'docs/shots/v2_a5_diag.png' });

  console.log('\n== Sauvegarde / chargement avec avatar');
  await pg.keyboard.press('g'); await pg.waitForTimeout(300); await pg.keyboard.press('F5'); await pg.waitForTimeout(300);
  await pg.goto(URL + '?load&nohelp&fresh'); await pg.waitForFunction(() => window.__gib && window.__gib.world, null, { timeout: 30000 }); await pg.waitForTimeout(800);
  ok(await E(() => window.__gib.mode === 'human'), 'rechargement : retour directement en mode humain');
  ok((await av()).money === money, 'argent restauré'); ok(await E(() => window.__gib.world.knownSecrets.length >= 0 && window.__gib.world.stats.drinks === 1), 'statistiques restaurées');
  console.log('\n== Erreurs de console'); ok(errs.length === 0, `aucune erreur JS (${errs.length})`); errs.slice(0, 5).forEach((e) => console.log('   ', e));
  console.log(`\n${n} vérifications, ${fails} échec(s)`); await b.close(); process.exit(fails ? 1 : 0);
})();
