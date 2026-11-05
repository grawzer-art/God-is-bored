// NEW BEGINNING V1 — parcours complet dans le vrai jeu (iPhone 13 émulé, rendu logiciel) : générique → menu → créateur → appartement → décor → rue → chapitre 1 → mode Dieu → sauvegarde → réouverture.
const { chromium, devices } = require('playwright');
const URL = process.env.GAME_URL || 'http://localhost:5173/';
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log(c ? '  [OK]   ' : '  [FAIL] ', m); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }); const errs = [];
  const ctx = await b.newContext({ ...devices['iPhone 13 landscape'], viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 }); const pg = await ctx.newPage(); pg.on('pageerror', (e) => errs.push(String(e))); const cdp = await ctx.newCDPSession(pg);
  const E = (f, a) => pg.evaluate(f, a); const ready = () => pg.waitForFunction(() => window.__gib && window.__gib.world, null, { timeout: 90000 });
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  const tapXY = async (x, y) => { await touch('touchStart', [{ x, y, id: 1 }]); await sleep(60); await touch('touchEnd', []); await sleep(250); };
  const tapSel = async (sel) => { if (!(await E((s) => !!document.querySelector(s), sel))) { console.log('        sélecteur introuvable :', sel); fails++; return false; } const r = await E((s) => { const el = document.querySelector(s); const ch = el.closest('.chips, .cats'); if (ch) ch.scrollLeft = Math.max(0, el.offsetLeft - ch.clientWidth / 2); const bd = el.closest('.body, .opts'); if (bd) { const br = bd.getBoundingClientRect(), er = el.getBoundingClientRect(); if (er.bottom > br.bottom - 4 || er.top < br.top + 4) bd.scrollTop += er.top - br.top - br.height / 2; } const q = el.getBoundingClientRect(); return { x: (q.left + q.right) / 2, y: (q.top + q.bottom) / 2 }; }, sel); await tapXY(r.x, r.y); await sleep(200); return true; };
  const waitFor = async (f, ms = 30000, a) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await E(f, a)) return true; await sleep(300); } return false; };
  const pickDlg = (id) => E((i) => { const h = window.__gib.hud.human; const k = h.choices.findIndex((c) => c.id === i && c.enabled); if (k < 0) return false; window.__gib.hud.pickDialogue(k); return true; }, id);
  const q = (id) => E((i) => { const s = window.__gib.world.quests[i]; return s ? s.st : null; }, id);

  console.log('\n== 1-3. Ouvrir le jeu : GRAW STUDIO, puis le menu');
  await pg.goto(URL + '?pwa=1'); await pg.waitForSelector('#splashc', { timeout: 90000 }); ok(true, 'le générique GRAW STUDIO s\'affiche (canvas pixel art)'); await pg.waitForTimeout(700); await pg.screenshot({ path: 'docs/shots/start-1-logo.png' });
  await pg.waitForSelector('[data-a="new"]', { timeout: 20000 }); ok(true, 'le menu principal apparaît après le générique'); await pg.screenshot({ path: 'docs/shots/start-3-menu.png' });
  ok(await E(() => document.querySelector('[data-a="cont"]').disabled), '« Continuer » est inactif tant qu\'aucune sauvegarde valide n\'existe');
  await tapSel('[data-a="set"]'); ok(await E(() => document.querySelectorAll('.sheet input[type=range]').length >= 4), 'Paramètres : curseurs réels (volumes, interface, joystick)'); await E(() => { const i = document.querySelector('.sheet [data-r="joy"]'); i.value = '1.4'; i.dispatchEvent(new Event('input')); }); ok(await E(() => JSON.parse(localStorage.getItem('god-is-bored:settings')).joy === 1.4), 'un réglage est enregistré et appliqué'); await tapSel('.sheet .xclose'); ok(await E(() => document.querySelectorAll('.sheet').length === 0), 'la fenêtre se referme (bouton ✕ toujours visible)');

  console.log('\n== 4-7. Nouvelle partie : créateur de personnage');
  await tapSel('[data-a="new"]'); try { await pg.waitForSelector('#creator', { timeout: 8000 }); } catch (e) { console.log('ERRS', errs, await E(() => JSON.stringify({ sheets: document.querySelectorAll('.sheet').length, start: document.getElementById('start').style.display, html: document.getElementById('start').innerHTML.slice(0, 200) }))); throw e; } ok(true, 'le créateur de personnage s\'ouvre');
  await E(() => { const f = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input')); }; f('f-first', 'Sam'); f('f-last', 'Dupont'); f('f-nick', 'Sammy'); });
  await tapSel('#creator [data-pn="iel"]'); await tapSel('#creator [data-cat="hair"]'); await tapSel('#creator [data-hair="afro"]'); await tapSel('#creator [data-hc="pink"]');
  await tapSel('#creator [data-cat="cloth"]'); await tapSel('#creator [data-os="streetwear"]'); await tapSel('#creator [data-set="streetwear:2"]');
  await tapSel('#creator [data-cat="tat"]'); await tapSel('#creator [data-tat="hand:1"]'); await tapSel('#creator [data-tat="face:0"]'); await tapSel('#creator [data-cat="pers"]'); await tapSel('#creator [data-tr="charismatique"]'); await tapSel('#creator [data-tr="ambitieux"]');
  await tapSel('#creator [data-a="rotr"]'); await tapSel('#creator [data-a="zoom"]'); await pg.screenshot({ path: 'docs/shots/start-4-createur.png' }); await tapSel('#creator [data-a="zoom"]');
  await tapSel('#creator [data-a="presets"]'); await tapSel('.sheet [data-p="save"]'); ok(await E(() => JSON.parse(localStorage.getItem('gib:presets') || '[]').length === 1), 'préréglage enregistré'); await tapSel('.sheet [data-p="close"]');
  await tapSel('#creator [data-a="ok"]'); await waitFor(() => !document.getElementById('creator') && window.__gib.world.profile, 30000);
  const st0 = await E(() => { const w = window.__gib.world, a = w.avatar; return { nick: a.first, name: a.name, hair: a.look.hair, hc: a.look.hair_color, tats: (a.look.tattoos || []).map((t) => t.part), traits: w.profile.traits, prop: w.property && w.property.name, room: w.roomOf(a.pos), money: a.money, mode: window.__gib.mode, quest: w.quests.c1m1 && w.quests.c1m1.st }; });
  ok(st0.nick === 'Sammy' && st0.name === 'Sam Dupont' && st0.hair === 'afro' && st0.hc === 'pink' && st0.tats.join() === 'hand,face' && st0.traits.join() === 'charismatique,ambitieux', `l'avatar créé est celui du jeu : ${st0.name} (${st0.nick}), cheveux ${st0.hair}/${st0.hc}, tatouages ${st0.tats.join('+')}`);
  ok(st0.prop === 'Studio Noria' && st0.mode === 'human' && st0.quest === 'active', `arrivée dans le ${st0.prop}, mode humain, mission 1 active`);

  console.log('\n== 8. Introduction narrative : BIENVENUE À NORIA');
  await pg.waitForSelector('#narr button', { timeout: 20000 }); await pg.waitForTimeout(4200); await pg.screenshot({ path: 'docs/shots/start-5-intro.png' }); ok(await E(() => document.getElementById('narr').textContent.includes('BIENVENUE À NORIA') && document.getElementById('narr').textContent.includes('redevenir Dieu')), 'texte d\'introduction affiché'); await tapSel('#narr button'); ok(await E(() => document.getElementById('narr').style.display === 'none'), 'COMMENCER L\'AVENTURE : on passe directement au jeu');
  await pg.waitForTimeout(1500); await pg.screenshot({ path: 'docs/shots/start-6-appartement.png' });

  console.log('\n== 9-10. Appartement : acheter et placer un meuble, modifier un mur, sauvegarder');
  await tapSel('#decobtn'); await pg.waitForTimeout(500); await tapSel('#deco [data-cat="deco"]'); const m0 = await E(() => window.__gib.world.avatar.money); await tapSel('#deco [data-buy="plant"]');
  ok(await E((m) => window.__gib.world.avatar.money === m - 15 && window.__gib.world.stash.plant === 3, m0), 'achat réel : 15 € débités, plante dans l\'inventaire');
  await tapSel('#deco [data-pl="plant"]'); const spot = await E(() => window.__gib.cellToScreen(60.5, 25.5)); await tapXY(spot.x, spot.y); await pg.waitForTimeout(400);
  ok(await E(() => window.__gib.world.furn.some((f) => f.def === 'plant' && !f.gone && f.x === 60 && f.y === 25)), 'le meuble est posé sur la grille'); await tapSel('#deco [data-tab="sols"]'); await tapSel('#deco [data-wl="lilas"]');
  ok(await E(() => window.__gib.world.homeStyle.wall.j === 'lilas'), 'couleur de mur modifiée'); await tapSel('#deco [data-x="ok"]'); await pg.screenshot({ path: 'docs/shots/start-7-decor.png' });
  await tapSel('#mmenu'); await tapSel('#msheet [data-k="save"]'); await pg.waitForTimeout(400);
  ok((await q('c1m1')) === 'done', 'mission 1 terminée (meuble + mur + sauvegarde) : récompense reçue'); ok(await E(() => window.__gib.world.avatar.money > 400 && window.__gib.world.progress.unlocks.includes('catalog2')), 'argent et déblocage du catalogue enregistrés');

  console.log('\n== 11-12. Sortir dans NORIA, parler à un habitant');
  await E(() => { const g = window.__gib; g.setSpeed(3); g.walkTo({ x: 63, y: 33 }); }); ok(await waitFor(() => window.__gib.world.avatar.cell().y >= 33 && window.__gib.insideBuilding === '', 60000), 'l\'avatar sort de l\'immeuble : la rue est visible');
  const tgt = await E(() => { const w = window.__gib.world; const c = w.citizens.find((x) => !x.away) || w.residents.find((x) => !x.away); return c ? c.id : -1; }); ok(tgt >= 0, 'un habitant est présent dans la ville');
  await E((id) => { const g = window.__gib; g.setSpeed(2); const n = g.world.chars[id]; require_walk(g, n); function require_walk(g, n) { window.__walk = setInterval(() => { const a = g.world.avatar; if (g.hud.dialogueOpen()) return; if (Math.hypot(a.pos.x - n.pos.x, a.pos.y - n.pos.y) > 1.9 && a.state === 'idle') g.world.pathTo && g.walkTo({ x: Math.floor(n.pos.x), y: Math.floor(n.pos.y) }); else if (Math.hypot(a.pos.x - n.pos.x, a.pos.y - n.pos.y) <= 1.9) { g.hud.openDialogue(n); clearInterval(window.__walk); } }, 600); } }, tgt);
  ok(await waitFor(() => window.__gib.hud.dialogueOpen(), 120000), 'on rejoint l\'habitant : la conversation s\'ouvre'); await pg.screenshot({ path: 'docs/shots/start-8-dialogue.png' });
  await pickDlg('sheet'); await pg.waitForTimeout(600); ok(await E(() => getComputedStyle(document.getElementById('fiche')).display === 'flex'), 'sa fiche s\'ouvre'); await tapSel('#fiche [data-a="close"]');
  await E((id) => window.__gib.hud.openDialogue(window.__gib.world.chars[id]), tgt); await pg.waitForTimeout(300); await pickDlg('how'); await pg.waitForTimeout(300); await E(() => window.__gib.hud.closeDialogue());
  ok((await q('c1m2')) === 'done', 'mission 2 terminée : première relation enregistrée'); ok(await E((id) => window.__gib.world.getRel(id, window.__gib.world.avatar.id).fam > 5 && window.__gib.world.chars[id].memories.some((m) => m.kind === 'meet'), tgt), 'relation et souvenir de l\'habitant enregistrés');

  console.log('\n== 13-14. Première vraie quête de travail : livraison payée');
  await E(() => { const g = window.__gib; g.setSpeed(3); g.walkTo({ x: 61, y: 15 }); }); ok(await waitFor(() => window.__gib.insideBuilding === 'store', 120000), 'on entre dans le commerce'); await E(() => window.__gib.setSpeed(1));
  await E(() => { const g = window.__gib; const c = g.world.clerk; c.away = false; g.hud.openDialogue(c); }); await pg.waitForTimeout(300); const m1 = await E(() => window.__gib.world.avatar.money); ok(await pickDlg('job'), 'le commerçant propose un travail'); await pg.waitForTimeout(300);
  ok(await E(() => window.__gib.world.avatar.inventory.parcel === 1 && !!window.__gib.world.job), 'colis confié ; destinataire choisi'); await E(() => window.__gib.hud.closeDialogue()); const dest = await E(() => window.__gib.world.job.to);
  await E((id) => { const g = window.__gib; g.setSpeed(3); window.__walk2 = setInterval(() => { const a = g.world.avatar, n = g.world.chars[id]; if (g.hud.dialogueOpen()) return; if (!n || n.away) return; if (Math.hypot(a.pos.x - n.pos.x, a.pos.y - n.pos.y) <= 1.9) { g.hud.openDialogue(n); clearInterval(window.__walk2); } else if (a.state === 'idle') g.walkTo({ x: Math.floor(n.pos.x), y: Math.floor(n.pos.y) }); }, 600); }, dest);
  ok(await waitFor(() => window.__gib.hud.dialogueOpen(), 180000), 'on retrouve le destinataire en marchant jusqu\'à lui'); ok(await pickDlg('deliver'), 'remise du colis'); await pg.waitForTimeout(400);
  ok((await q('c1m3')) === 'done' && (await E((m) => window.__gib.world.avatar.money > m, m1)), 'mission 3 terminée : paiement reçu'); await E(() => window.__gib.hud.closeDialogue());

  console.log('\n== Mission 4 : choisir sa voie (aider un habitant)');
  await E((id) => { const g = window.__gib; g.world.avatar.inventory.bonbons = 2; g.hud.openDialogue(g.world.chars[id]); }, tgt); await pg.waitForTimeout(300); ok(await pickDlg('gift'), 'offrir un objet'); await pg.waitForTimeout(300);
  await E(() => { const h = window.__gib.hud.human; const k = h.choices.findIndex((c) => String(c.id).startsWith('give_item')); if (k >= 0) window.__gib.hud.pickDialogue(k); }); await pg.waitForTimeout(400); await E(() => window.__gib.hud.closeDialogue());
  ok((await q('c1m4')) === 'done' && (await E(() => window.__gib.world.progress.flags.path === 'help')), 'mission 4 terminée : voie « aider » enregistrée');

  console.log('\n== 15-16. Mode Dieu puis retour dans l\'avatar (mission 5)');
  await E(() => window.__gib.setSpeed(1)); await tapSel('#mmode'); await waitFor(() => window.__gib.mode === 'god', 5000); ok(await E(() => window.__gib.mode === 'god'), 'mode Dieu'); await pg.screenshot({ path: 'docs/shots/start-9-dieu.png' });
  await E((id) => window.__gib.selectChar(id, true), tgt); await pg.waitForTimeout(500); await E(() => window.__gib.hud.pickPower('bless')); await E((id) => window.__gib.hud.onWorldClick(id, 300, 200), tgt); await pg.waitForTimeout(400);
  await tapSel('#mmode'); await waitFor(() => window.__gib.mode === 'human', 5000); ok(await E(() => window.__gib.mode === 'human' && window.__gib.world.avatar.kind === 'avatar'), 'retour dans son avatar'); await E((id) => window.__gib.hud.fiche.open(id), tgt); await pg.waitForTimeout(500); await E(() => window.__gib.hud.fiche.close());
  ok((await q('c1m5')) === 'done', 'mission 5 terminée : conséquence constatée'); ok(await E(() => document.getElementById('narr').textContent.includes('C\'est toi qui as créé ce monde')), 'fin de chapitre : « C\'est toi qui as créé ce monde »'); await pg.screenshot({ path: 'docs/shots/start-10-fin-chapitre.png' }); await tapSel('#narr button');
  await E(() => window.__gib.hud.journal.open('principale')); await pg.waitForTimeout(400); await pg.screenshot({ path: 'docs/shots/start-11-journal.png' }); ok(await E(() => document.getElementById('journal').textContent.includes('Journal')), 'le journal liste les quêtes'); await E(() => window.__gib.hud.journal.close());

  console.log('\n== 17-19. Sauvegarder, fermer, rouvrir : « Continuer »');
  await tapSel('#mmenu'); await tapSel('#msheet [data-k="save"]'); await pg.waitForTimeout(400);
  const snap = await E(() => { const w = window.__gib.world, a = w.avatar; return { name: a.name, hair: a.look.hair, hc: a.look.hair_color, tats: (a.look.tattoos || []).length, plant: w.furn.some((f) => f.def === 'plant' && !f.gone && f.x === 60 && f.y === 25), wall: w.homeStyle.wall.j, done: Object.entries(w.quests).filter(([, s]) => s.st === 'done').map(([k]) => k).sort().join(), money: Math.round(a.money), rep: w.progress.reputation }; });
  await pg.goto(URL + '?pwa=1'); await pg.waitForSelector('[data-a="new"]', { timeout: 90000 }); ok(await E(() => !document.querySelector('[data-a="cont"]').disabled), '« Continuer » est maintenant actif');
  await tapSel('[data-a="cont"]'); await waitFor(() => window.__gib && window.__gib.world.profile && !document.getElementById('start').style.display || document.getElementById('start').style.display === 'none', 30000); await pg.waitForTimeout(1500);
  const s2 = await E(() => { const w = window.__gib.world, a = w.avatar; return { name: a.name, hair: a.look.hair, hc: a.look.hair_color, tats: (a.look.tattoos || []).length, plant: w.furn.some((f) => f.def === 'plant' && !f.gone && f.x === 60 && f.y === 25), wall: w.homeStyle.wall.j, done: Object.entries(w.quests).filter(([, s]) => s.st === 'done').map(([k]) => k).sort().join(), money: Math.round(a.money), rep: w.progress.reputation, creator: !!document.getElementById('creator'), narr: window.__gib.world.narrations.length }; });
  ok(!s2.creator, 'le créateur n\'est pas relancé'); ok(s2.name === snap.name && s2.hair === snap.hair && s2.hc === snap.hc && s2.tats === snap.tats, `avatar conservé : ${s2.name}, ${s2.hair}/${s2.hc}, ${s2.tats} tatouages`); ok(s2.plant && s2.wall === snap.wall, 'meubles et couleur de mur conservés');
  ok(s2.done === snap.done && s2.money === snap.money && s2.rep === snap.rep, `quêtes terminées conservées (${s2.done.split(',').length}), argent ${s2.money} €, réputation ${s2.rep} : aucune récompense redonnée`);
  ok(errs.length === 0, 'aucune erreur JavaScript' + (errs[0] ? ' : ' + errs[0] : ''));
  await b.close(); console.log(fails ? `\n${fails} ÉCHEC(S)` : '\nNEW BEGINNING V1 : parcours complet vert'); process.exit(fails ? 1 : 0);
})();
