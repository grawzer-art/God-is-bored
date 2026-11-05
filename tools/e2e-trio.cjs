// DÉMO VIVANTE dans le vrai jeu (iPhone émulé) : on VOIT les habitants vivre — icônes, trajets, guide, suivi caméra, six étapes, sauvegarde, vitesses ×1/×2/×3.
const { chromium, devices } = require('playwright');
const URL = process.env.GAME_URL || 'http://localhost:5173/';
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log(c ? '  [OK]   ' : '  [FAIL] ', m); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const newCtx = (b) => b.newContext({ ...devices['iPhone 13 landscape'], viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 });
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }); const errs = [];
  let ctx = await newCtx(b); let pg = await ctx.newPage(); pg.on('pageerror', (e) => errs.push(String(e))); let cdp = await ctx.newCDPSession(pg);
  const E = (f, a) => pg.evaluate(f, a); const ready = () => pg.waitForFunction(() => window.__gib && window.__gib.world, null, { timeout: 60000 });
  const tap = async (sel) => { const r = await E((s) => { const q = document.querySelector(s).getBoundingClientRect(); return { x: (q.left + q.right) / 2, y: (q.top + q.bottom) / 2 }; }, sel); await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: r.x, y: r.y, id: 1 }] }); await sleep(60); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(350); };
  const waitFor = async (f, ms = 90000, a) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await E(f, a)) return true; await sleep(400); } return false; };

  console.log('\n== 0. Une partie ordinaire démarre déjà vivante');
  await pg.goto(URL + '?nohelp'); await ready(); await pg.waitForTimeout(1500);
  const st = await E(() => { const w = window.__gib.world; return { h: w.hour(), awake: w.residents.filter((c) => !c.away && !c.isAsleep()).length, away: w.residents.filter((c) => c.away).length }; });
  ok(st.h > 8 && st.h < 9.5, `la partie démarre vers ${Math.floor(st.h)} h ${Math.round((st.h % 1) * 60)} (et non à 6 h 52)`); ok(st.awake >= 3, `${st.awake} habitants éveillés dès le début, ${st.away} déjà partis travailler`);

  console.log('\n== 1. Lancer la démo depuis le menu de l\'iPhone');
  await pg.goto(URL + '?fresh&nohelp'); await ready(); await pg.waitForTimeout(1200); await tap('#mmenu'); await tap('#msheet [data-k="trio"]'); await pg.waitForTimeout(800);
  ok(await E(() => window.__gib.demoKind === 'trio' && window.__gib.speedIndex === 2 && getComputedStyle(document.getElementById('dg')).display === 'block'), 'démo vivante lancée (x2), guide A / B / C affiché');
  const rows = await E(() => [...document.querySelectorAll('#dg .r')].map((e) => e.textContent)); ok(rows.length === 3 && /Aïcha/.test(rows[0]) && /Lucas/.test(rows[1]) && /Camille/.test(rows[2]), 'le guide nomme les trois habitants : ' + rows.map((r) => r.slice(0, 30)).join(' | '));
  const gw = await E(() => { const r = document.getElementById('dg').getBoundingClientRect(); return { w: r.width, h: r.height, vw: innerWidth, vh: innerHeight }; }); ok(gw.w / gw.vw < 0.3 && gw.h / gw.vh < 0.5, `guide discret : ${Math.round((gw.w / gw.vw) * 100)} % de la largeur, ${Math.round((gw.h / gw.vh) * 100)} % de la hauteur`);
  await pg.screenshot({ path: 'docs/shots/trio-e2e-1.png' });

  console.log('\n== 2. Les habitants VIVENT à l\'écran (rendu réel)');
  const seen = { icons: new Set(), moved: {}, onscreen: 0, samples: 0, trail: 0 }; const p0 = {};
  await E(() => window.__gib.selectChar(5, false));
  for (let i = 0; i < 45; i++) {
    const s = await E(() => { const g = window.__gib; const out = { icons: [], pos: {}, vis: 0, trail: g.trailDots }; for (const id of [4, 5, 0, 1]) { const cv = g.chars[id]; const sc = g.worldToScreen(cv.x, cv.y); out.pos[id] = { x: sc.x, y: sc.y }; if (cv.act.visible) out.icons.push(cv.actName); if (sc.x > 0 && sc.x < innerWidth && sc.y > 0 && sc.y < innerHeight && !cv.sim.away) out.vis++; } return out; });
    s.icons.forEach((n) => seen.icons.add(n)); for (const id of Object.keys(s.pos)) { p0[id] = p0[id] ?? s.pos[id]; const w = Math.hypot(s.pos[id].x - p0[id].x, s.pos[id].y - p0[id].y); seen.moved[id] = Math.max(seen.moved[id] ?? 0, w); } seen.onscreen += s.vis; seen.samples++; if (s.trail > 3) seen.trail++;
    await sleep(500); if (i === 14) await pg.screenshot({ path: 'docs/shots/trio-e2e-2.png' });
  }
  ok(seen.icons.size >= 3, `icônes d'activité visibles au-dessus des têtes : ${[...seen.icons].join(', ')}`);
  ok(Object.values(seen.moved).filter((d) => d > 60).length >= 3, `au moins 3 habitants se sont visiblement déplacés à l'écran (px : ${Object.entries(seen.moved).map(([k, v]) => k + ':' + Math.round(v)).join(' ')})`);
  ok(seen.onscreen / seen.samples >= 2, `en moyenne ${(seen.onscreen / seen.samples).toFixed(1)} habitants visibles à l'écran à chaque instant`);
  ok(seen.trail >= 1, `le trajet en pointillés de l'habitant observé s'est affiché (${seen.trail} instants)`);

  console.log('\n== 3. Observer : fiche, destination, besoin prioritaire, suivi caméra');
  await tap('#dg .r[data-id="5"]'); await pg.waitForTimeout(800);
  ok(await E(() => window.__gib.selectedId === 5 && window.__gib.follow === true), 'toucher une ligne du guide sélectionne et suit l\'habitant');
  const card = await E(() => document.getElementById('qcard').innerText); ok(/Lucas/.test(card) && /(Faim|Loisirs|Énergie|Social|Hygiène|Vessie) \d+ %/.test(card), 'carte rapide : activité, destination, besoin prioritaire — « ' + card.replace(/\s+/g, ' ').slice(0, 90) + ' »');
  await tap('#qf'); await pg.waitForTimeout(700); const fiche = await E(() => document.getElementById('fiche').innerText); ok(/activité/i.test(fiche) && /besoins/i.test(fiche) && /objectif/i.test(fiche) && /souvenirs/i.test(fiche) && /relations/i.test(fiche), 'fiche V2 : activité, besoins, objectif, onglets relations et souvenirs');
  await pg.screenshot({ path: 'docs/shots/trio-e2e-3.png' }); await tap('#fiche [data-a="close"]');
  await E(() => { const g = window.__gib; g.follow = true; }); await pg.waitForTimeout(2500); const dist = await E(() => { const g = window.__gib; const cv = g.chars[5]; return Math.hypot(g.cameras.main.worldView.centerX - cv.x, g.cameras.main.worldView.centerY - (cv.y - 20)); }); ok(dist < 90, `la caméra suit Lucas (écart ${Math.round(dist)} px monde)`);
  await tap('#qs'); ok(await E(() => window.__gib.follow === false), 'le bouton « Suivre » arrête le suivi');

  console.log('\n== 4. Les six étapes de la démonstration, dans le jeu');
  const got = await waitFor(() => { const w = window.__gib.world; return w.chars[0].stats.chats >= 1 && w.chars[4].away; }, 120000);
  const s6 = await E(() => { const w = window.__gib.world; const B = w.chars[5], C = w.chars[0], A = w.chars[4]; const r = w.getRel(0, 1); return { got: C.stats.chats, mem: C.memories.filter((m) => m.other === 1).map((m) => m.text), aff: r.aff, n: r.n, ate: (B.stats.done_snack ?? 0) + (B.stats.done_eat ?? 0) + (B.stats.done_serve ?? 0), aAway: A.away, aPhase: A.jobPhase, hour: w.hour() }; });
  ok(got, `décisions autonomes observées jusqu'à ${Math.floor(s6.hour)} h ${Math.round((s6.hour % 1) * 60)}`); ok(s6.aAway && s6.aPhase === 'working', 'A (Aïcha) a suivi sa routine et est partie travailler'); ok(s6.ate >= 1, 'B (Lucas) a interrompu la télé pour manger (faim urgente)');
  ok(s6.got >= 1 && s6.mem.length >= 1, `C (Camille) a engagé spontanément la conversation ; souvenir : « ${s6.mem[0]} »`); ok(s6.n >= 1, `sa relation avec Mehdi a changé (affection ${Math.round(s6.aff)}, ${s6.n} échange(s))`);
  await tap('#mmenu'); await tap('#msheet [data-k="save"]'); await sleep(300);
  await pg.goto(URL + '?load&nohelp'); await ready(); await pg.waitForTimeout(800);
  const r2 = await E(() => { const w = window.__gib.world; const r = w.getRel(0, 1); return { aff: r.aff, n: r.n, mem: w.chars[0].memories.filter((m) => m.other === 1).map((m) => m.text), a: w.chars[4].away }; });
  ok(Math.abs(r2.aff - s6.aff) < 6 && r2.n >= s6.n && s6.mem.every((t, i) => r2.mem[i] === t) && r2.a === s6.aAway, `après sauvegarde et rechargement : relation (${Math.round(r2.aff)}), souvenirs et état de A conservés`);
  await ctx.close();

  console.log('\n== 5. Vitesses ×1, ×2, ×3 : le monde entier accélère, pas seulement l\'horloge');
  const res = {};
  for (const idx of [1, 2, 3]) {
    ctx = await newCtx(b); pg = await ctx.newPage(); pg.on('pageerror', (e) => errs.push(String(e))); await pg.goto(URL + '?fresh&nohelp&speed=' + idx); await ready(); await pg.waitForTimeout(1500);
    await E(() => { const g = window.__gib; g.setSpeed(g.speedIndex); window.__m = { c0: g.world.clock, d: 0, last: new Map(g.world.residents.map((c) => [c.id, { ...c.pos }])), dec: () => g.world.residents.reduce((m, c) => m + Object.entries(c.stats).filter(([k]) => k.startsWith('act_')).reduce((a, [, v]) => a + v, 0), 0) }; window.__m.d0 = window.__m.dec(); const f = () => { const m = window.__m; for (const c of g.world.residents) { const l = m.last.get(c.id); if (!c.away) m.d += Math.hypot(c.pos.x - l.x, c.pos.y - l.y); m.last.set(c.id, { ...c.pos }); } window.__raf = requestAnimationFrame(f); }; f(); });
    await pg.waitForTimeout(30000); res[idx] = await E(() => { cancelAnimationFrame(window.__raf); const g = window.__gib, m = window.__m; return { speed: g.speedIndex, clock: g.world.clock - m.c0, dist: m.d, dec: m.dec() - m.d0 }; }); await ctx.close();
  }
  console.log('   mesures sur 30 s réelles :', JSON.stringify(res));
  ok(res[2].clock / res[1].clock > 1.7 && res[2].clock / res[1].clock < 2.3, `horloge ×2 / ×1 = ${(res[2].clock / res[1].clock).toFixed(2)} (attendu ≈ 2)`); ok(res[3].clock / res[1].clock > 2.6 && res[3].clock / res[1].clock < 3.4, `horloge ×3 / ×1 = ${(res[3].clock / res[1].clock).toFixed(2)} (attendu ≈ 3)`);
  ok(res[2].dist / res[1].dist > 1.3 && res[3].dist / res[1].dist > 1.6, `trajets parcourus : ×2 = ${(res[2].dist / res[1].dist).toFixed(2)}, ×3 = ${(res[3].dist / res[1].dist).toFixed(2)} (relatifs à ×1)`);
  ok(res[2].dec > res[1].dec && res[3].dec > res[2].dec * 0.9, `décisions prises : ×1 = ${res[1].dec}, ×2 = ${res[2].dec}, ×3 = ${res[3].dec}`);
  ok(errs.length === 0, 'aucune erreur JS ' + errs.slice(0, 2).join('|'));
  await b.close(); console.log(fails ? `\n${fails} ÉCHEC(S)` : '\nDÉMO VIVANTE : tout est vert'); process.exit(fails ? 1 : 0);
})();
