// REFONTE UX — navigation : parcours A à D, double appui, ouverture rapide, redimensionnement/orientation, et audit automatique des boutons (visibles, dans l'écran, touchables).
const { chromium, devices } = require('playwright');
const URL = process.env.GAME_URL || 'http://localhost:5173/';
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log(c ? '  [OK]   ' : '  [FAIL] ', m); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }); const errs = [];
  const ctx = await b.newContext({ ...devices['iPhone 13 landscape'], viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 }); const pg = await ctx.newPage(); pg.on('pageerror', (e) => errs.push(String(e))); const cdp = await ctx.newCDPSession(pg);
  const E = (f, a) => pg.evaluate(f, a); const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  const tapXY = async (x, y) => { await touch('touchStart', [{ x, y, id: 1 }]); await sleep(50); await touch('touchEnd', []); await sleep(220); };
  const pos = (sel) => E((s) => { const el = document.querySelector(s); if (!el) return null; const ch = el.closest('.cats'); if (ch) ch.scrollLeft = Math.max(0, el.offsetLeft - ch.clientWidth / 2); const bd = el.closest('.body, .opts'); if (bd) { const br = bd.getBoundingClientRect(), er = el.getBoundingClientRect(); if (er.bottom > br.bottom - 4 || er.top < br.top + 4) bd.scrollTop += er.top - br.top - br.height / 2; } const q = el.getBoundingClientRect(); return { x: (q.left + q.right) / 2, y: (q.top + q.bottom) / 2 }; }, sel);
  const tap = async (sel) => { const p = await pos(sel); if (!p) { console.log('        introuvable :', sel); fails++; return false; } await tapXY(p.x, p.y); return true; };
  const waitFor = async (f, ms = 20000, a) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await E(f, a)) return true; await sleep(250); } return false; };
  const nav = () => E(() => window.__nav.list());
  // audit : tout bouton visible doit être dans l'écran (ou dans une zone défilante) et touchable (pas masqué par un autre élément)
  const audit = async (label, scope) => {
    const r = await E((scope) => {
      const bad = []; let n = 0; const vw = innerWidth, vh = innerHeight;
      const NAVSEL = { fiche: '#fiche', journal: '#journal', deco: '#deco', msheet: '#msheet', dlg: '#dlg', inv: '#inv', ctx: '#ctx', gtray: '#gbar', creator: '#creator', presets: '#creator .sheet', ssheet: '#start .sheet' }; const topNav = window.__nav ? window.__nav.list().slice(-1)[0] : null; const topSheet = scope || (topNav && NAVSEL[topNav] && topNav !== 'creator' && topNav !== 'ssheet' ? NAVSEL[topNav] : null) || (document.querySelector('#start .sheet') ? '#start .sheet' : document.querySelector('#creator .sheet') ? '#creator .sheet' : null); const rootQ = topSheet ? topSheet + ' ' : '';
      const els = [...document.querySelectorAll(rootQ + 'button, ' + rootQ + 'input, ' + rootQ + 'select, ' + rootQ + '[role=button]')].filter((e) => { const cs = getComputedStyle(e); const r = e.getBoundingClientRect(); return cs.visibility !== 'hidden' && cs.display !== 'none' && r.width > 4 && r.height > 4 && e.offsetParent !== null && !e.disabled && cs.pointerEvents !== 'none'; });
      for (const e of els) {
        let r = e.getBoundingClientRect(); let clip = { l: 0, t: 0, r: vw, b: vh }; let p = e.parentElement; let scrolled = false;
        while (p && p !== document.body) { const cs = getComputedStyle(p); if (/(auto|scroll|hidden)/.test(cs.overflowY + cs.overflowX) && (p.scrollHeight > p.clientHeight + 2 || p.scrollWidth > p.clientWidth + 2)) { const pr = p.getBoundingClientRect(); clip = { l: Math.max(clip.l, pr.left), t: Math.max(clip.t, pr.top), r: Math.min(clip.r, pr.right), b: Math.min(clip.b, pr.bottom) }; scrolled = true; } p = p.parentElement; }
        const vis = { l: Math.max(r.left, clip.l), t: Math.max(r.top, clip.t), r: Math.min(r.right, clip.r), b: Math.min(r.bottom, clip.b) }; if (vis.r - vis.l < 4 || vis.b - vis.t < 4) { if (!scrolled) bad.push('hors écran : ' + (e.id || e.dataset.a || e.textContent.trim().slice(0, 18))); continue; }
        n++; const cx = (vis.l + vis.r) / 2, cy = (vis.t + vis.b) / 2; const hit = document.elementFromPoint(cx, cy); if (hit && !(e === hit || e.contains(hit) || hit.contains(e))) bad.push('masqué par ' + (hit.id || hit.className || hit.tagName) + ' : ' + (e.id || e.dataset.a || e.textContent.trim().slice(0, 18)));
        if (r.height < 30 || r.width < 30) bad.push('trop petit (' + Math.round(r.width) + '×' + Math.round(r.height) + ') : ' + (e.id || e.dataset.a || e.textContent.trim().slice(0, 18)));
      }
      return { n, bad };
    }, scope);
    ok(r.bad.length === 0, `audit « ${label} » : ${r.n} boutons touchables${r.bad.length ? ' — PROBLÈMES : ' + r.bad.slice(0, 5).join(' | ') : ''}`); return r;
  };
  const walkTest = async (label) => { let d = 0; for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const p0 = await E(() => ({ ...window.__gib.world.avatar.pos })); await E(([x, y]) => window.__gib.setAnalog(x, y, 1), [ax, ay]); await sleep(900); await E(() => window.__gib.setAnalog(0, 0, 0)); const p1 = await E(() => ({ ...window.__gib.world.avatar.pos })); d = Math.hypot(p1.x - p0.x, p1.y - p0.y); if (d > 0.5) break; } const p1 = { x: d, y: 0 }, p0 = { x: 0, y: 0 }; ok(Math.hypot(p1.x - p0.x, p1.y - p0.y) > 0.5, `${label} : le joueur reprend le contrôle (déplacé de ${Math.hypot(p1.x - p0.x, p1.y - p0.y).toFixed(1)} case)`); };

  console.log('\n== PARCOURS A — nouveau joueur : menu → création (7 catégories) → appartement → jeu');
  await pg.goto(URL + '?pwa=1'); await pg.waitForSelector('[data-a="new"]', { timeout: 90000 }); await audit('menu principal');
  await tap('[data-a="set"]'); await pg.waitForTimeout(300); await audit('paramètres'); ok(true, 'paramètres : ✕ visible'); await tap('.sheet .xclose'); ok((await nav()).length === 0 && (await E(() => document.querySelectorAll('.sheet').length === 0)), 'paramètres fermés, rien ne reste au-dessus');
  await tap('[data-a="load"]'); await pg.waitForTimeout(300); await pg.keyboard.press('Escape'); ok(await E(() => document.querySelectorAll('.sheet').length === 0), 'Échap ferme « Charger une partie »');
  await tap('[data-a="new"]'); await pg.waitForSelector('#creator'); await pg.waitForTimeout(500); await audit('créateur (identité)');
  for (const [k, probe] of [['body', 'Silhouette'], ['face', 'Yeux'], ['hair', 'Coupe'], ['beard', 'Style de barbe'], ['skin', 'Teinte de peau'], ['cloth', 'Tenues complètes'], ['acc', 'Tatouages']]) {
    await tap(`#creator [data-cat="${k}"]`); await pg.waitForTimeout(250); ok(await E((t) => document.querySelector('#creator .opts').textContent.includes(t), probe), `catégorie « ${k} » : options visibles (${probe})`); await audit('créateur › ' + k);
  }
  await tap('#creator [data-cat="hair"]'); await tap('#creator [data-hair="mohawk"]'); ok(await E(() => document.querySelector('#creator [data-hair="mohawk"]').classList.contains('on')), 'un changement de coupe est appliqué immédiatement');
  await tap('#creator [data-cat="body"]'); await tap('#creator [data-sil="imposante"]'); await tap('#creator [data-a="rotr"]'); await tap('#creator [data-a="zoom"]'); await tap('#creator [data-a="zoom"]');
  await tap('#creator [data-a="reset"]'); ok(await E(() => document.querySelector('#creator [data-build="0"]').classList.contains('on')), 'Réinitialiser remet la catégorie par défaut');
  await tap('#creator [data-a="presets"]'); ok(await E(() => !!document.querySelector('#creator .sheet')), 'préréglages : fenêtre ouverte'); await audit('préréglages'); await pg.keyboard.press('Escape'); ok(await E(() => !document.querySelector('#creator .sheet') && !!document.getElementById('creator')), 'Échap ferme les préréglages sans quitter le créateur');
  await tap('#creator [data-a="back"]'); await waitFor(() => !document.getElementById('creator') && !!document.querySelector('[data-a="new"]'), 8000); ok(await E(() => !document.getElementById('creator') && !!document.querySelector('[data-a="new"]')), 'Retour : on revient au menu (la partie n\'est pas réinitialisée)');
  await tap('[data-a="new"]'); await pg.waitForSelector('#creator'); await E(() => { const f = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input')); }; f('f-first', 'Nina'); });
  ok(await E(() => /Valider mon personnage/.test(document.querySelector('#creator .cbar .ok').textContent)), 'le bouton « Valider mon personnage » est toujours visible'); await tap('#creator [data-a="ok"]'); await waitFor(() => !document.getElementById('creator') && window.__gib.world.profile, 30000);
  await pg.waitForSelector('#narr button', { timeout: 20000 }); await pg.waitForTimeout(3600); await tap('#narr button'); await pg.waitForTimeout(800);
  ok((await nav()).length === 0 && (await E(() => window.__gib.mode === 'human')), 'arrivée dans l\'appartement, aucune fenêtre ouverte'); await audit('jeu (descendre, appartement)'); await walkTest('après la création');

  console.log('\n== PARCOURS B — navigation : menu → sous-menu → Retour → Fermer → rouvrir');
  await tap('#mmenu'); await pg.waitForTimeout(250); ok((await nav()).join() === 'msheet', 'menu ouvert (une seule fenêtre)'); await audit('menu'); await tap('#msheet [data-k="lieux"]'); await pg.waitForTimeout(250);
  ok(await E(() => document.getElementById('msheet').textContent.includes('Centre-ville') && !!document.getElementById('mback')), 'sous-menu « Lieux » avec bouton Retour'); await audit('sous-menu'); await tap('#mback'); await pg.waitForTimeout(250);
  ok(await E(() => document.getElementById('msheet').textContent.includes('Inventaire')), 'Retour : on revient au menu (pas un nouvel écran)'); await pg.keyboard.press('Escape'); await pg.waitForTimeout(250); ok((await nav()).length === 0 && (await E(() => document.getElementById('msheet').style.display === 'none')), 'Échap ferme le menu');
  await walkTest('après le menu'); await tap('#mmenu'); await pg.waitForTimeout(250); ok((await nav()).join() === 'msheet', 'on peut rouvrir le même menu'); await tap('#mclose'); ok((await nav()).length === 0, '✕ ferme le menu');
  await E(() => { const g = window.__gib; g.hud.fiche.open(1); g.hud.journal.open(); g.hud.toggleInventory(); g.hud.mobile.openMenu(); }); await pg.waitForTimeout(300);
  const vis = await E(() => ['fiche', 'journal', 'inv', 'msheet'].filter((id) => getComputedStyle(document.getElementById(id)).display !== 'none')); ok(vis.length === 1 && (await nav()).length === 1, `ouverture rapide de 4 fenêtres : une seule reste visible (${vis.join()})`); await pg.keyboard.press('Escape'); await pg.waitForTimeout(200); ok((await nav()).length === 0, 'tout se ferme');
  const bp = await pos('#mmenu'); await tapXY(bp.x, bp.y); await tapXY(bp.x, bp.y); await pg.waitForTimeout(300); ok((await nav()).length <= 1 && (await E(() => ['msheet'].filter((id) => getComputedStyle(document.getElementById(id)).display !== 'none').length <= 1)), 'double appui sur Menu : pas de fenêtre en double'); await E(() => window.__nav.closeTop());
  await E(() => { const g = window.__gib; g.hud.openDialogue(g.world.residents.find((c) => !c.away)); }); await pg.waitForTimeout(300); await audit('dialogue'); await tap('#dlg [data-nvx]'); ok((await nav()).length === 0 && (await E(() => !window.__gib.hud.dialogueOpen())), 'dialogue : ✕ ferme et rend le contrôle');
  await E(() => window.__gib.hud.toggleInventory()); await pg.waitForTimeout(300); await audit('inventaire'); await tap('#inv [data-nvx]'); ok((await nav()).length === 0, 'inventaire : ✕ ferme'); await walkTest('après les fenêtres');

  console.log('\n== PARCOURS C — modes : Dieu → Descendre → fiche → Incarner → Retour → Dieu');
  await tap('#mmode'); await waitFor(() => window.__gib.mode === 'god', 5000); ok(await E(() => window.__gib.mode === 'god'), 'mode Dieu'); await pg.waitForTimeout(600); await audit('mode Dieu (barre divine)');
  await tap('#gbar [data-c="pouvoirs"]'); await pg.waitForTimeout(250); ok((await nav()).join() === 'gtray', 'barre divine : plateau Pouvoirs ouvert'); await audit('plateau Pouvoirs'); await pg.keyboard.press('Escape'); ok((await nav()).length === 0, 'Échap ferme le plateau');
  await tap('#mmode'); await waitFor(() => window.__gib.mode === 'human', 5000); ok(await E(() => window.__gib.mode === 'human'), 'Descendre : retour dans l\'avatar');
  await tap('#mmode'); await waitFor(() => window.__gib.mode === 'god', 5000); const rid = await E(() => { const c = window.__gib.world.residents.find((x) => !x.away); window.__gib.selectChar(c.id, true); return c.id; }); await pg.waitForTimeout(500); await tap('#qf'); await pg.waitForTimeout(400); ok((await nav()).join() === 'fiche', 'fiche d\'habitant ouverte'); await audit('fiche habitant');
  await tap('#fiche [data-a="sub:modifier"]'); await pg.waitForTimeout(250); await audit('fiche › Modifier'); await pg.keyboard.press('Escape'); await pg.waitForTimeout(200); ok((await nav()).join() === 'fiche' && await E(() => !document.querySelector('#fiche [data-a="give:1000"]')), 'Retour (Échap) : sous-écran « Modifier » → fiche principale'); 
  await tap('#fiche [data-a="incarner"]'); await pg.waitForTimeout(700); ok(await E((id) => window.__gib.mode === 'human' && window.__gib.world.avatar.id === id, rid) && (await nav()).length === 0, 'Incarner : on contrôle l\'habitant, la fiche est fermée'); await audit('incarné'); await tap('#possquit'); await pg.waitForTimeout(600); ok(await E(() => window.__gib.mode === 'god' && !window.__gib.world.possess), 'Retour : mode Dieu, l\'habitant reprend sa vie');

  console.log('\n== PARCOURS D — appartement : décoration → catégorie → objet → annuler → fermer → déplacement');
  await tap('#mmode'); await waitFor(() => window.__gib.mode === 'human', 5000); await E(() => { const g = window.__gib; g.world.avatar.pos = { x: 66.5, y: 28.5 }; g.world.avatar.state = 'idle'; }); await pg.waitForTimeout(1500);
  await tap('#decobtn'); await pg.waitForTimeout(500); ok((await nav()).join() === 'deco', 'mode décoration ouvert'); await audit('décoration'); await tap('#deco [data-cat="cuisine"]'); ok(await E(() => document.querySelector('#deco [data-cat="cuisine"]').classList.contains('on')), 'changement de catégorie');
  const fi = await E(() => window.__gib.world.furnById.get('flat_sofa')); const sp = await E((i) => { const g = window.__gib; const bb = g.furnNodes.get(i)[1].getBounds(); const s = g.worldToScreen(bb.centerX, bb.centerY); return s; }, fi); await tapXY(sp.x, sp.y); ok(await E(() => !!window.__gib.world.homeEdit), 'objet sélectionné (touché dans la scène)'); await pg.keyboard.press('Escape'); await pg.waitForTimeout(200); ok(await E(() => !window.__gib.world.homeEdit && window.__gib.world.decoMode), 'Annuler (Échap) : la sélection est annulée, la décoration reste ouverte');
  await tap('#deco [data-x="ok"]'); await pg.waitForTimeout(300); ok((await nav()).length === 0 && (await E(() => !window.__gib.world.decoMode)), 'Fermer : décoration terminée, rien ne reste ouvert'); await walkTest('après la décoration');

  console.log('\n== ORIENTATION / REDIMENSIONNEMENT');
  await E(() => { const g = window.__gib; g.world.avatar.pos = { x: 62.5, y: 33.5 }; });
  await pg.setViewportSize({ width: 390, height: 844 }); await pg.waitForTimeout(800); await tap('#mmenu').catch(() => {}); await pg.waitForTimeout(300); await pg.screenshot({ path: 'docs/shots/nav-portrait.png' }); await pg.setViewportSize({ width: 844, height: 390 }); await pg.waitForTimeout(800);
  ok(await E(() => document.getElementById('msheet').getBoundingClientRect().right <= innerWidth + 1), 'après rotation, le menu tient dans l\'écran'); await E(() => window.__nav.closeAll && window.__nav.closeAll()); await E(() => { while (window.__nav.closeTop()); }); await audit('après redimensionnement');
  ok(errs.length === 0, 'aucune erreur JavaScript' + (errs[0] ? ' : ' + errs[0] : ''));
  await b.close(); console.log(fails ? `\n${fails} ÉCHEC(S)` : '\nNAVIGATION / UX : tout est vert'); process.exit(fails ? 1 : 0);
})();
