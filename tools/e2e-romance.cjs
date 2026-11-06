// ROMANCE : dialogue → Flirter / rendez-vous, consentement, fiche (♥, attirance) — dans le vrai jeu (iPhone émulé).
const { chromium, devices } = require('playwright');
const URL = process.env.GAME_URL || 'http://localhost:5173/';
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log(c ? '  [OK]   ' : '  [FAIL] ', m); };
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ ...devices['iPhone 13 landscape'], viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 });
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(String(e))); const E = (f, a) => pg.evaluate(f, a);
  await pg.goto(URL + '?fresh&nohelp&human&simulate=700&speed=1&zoom=1.2'); await pg.waitForFunction(() => window.__gib && window.__gib.world, null, { timeout: 60000 }); await pg.waitForTimeout(1500);
  const open = async () => { await E(() => { while (window.__nav.list().length) window.__nav.closeTop(); const g = window.__gib, w = g.world; const n = w.chars.find((c) => c.name === 'Noémie Rivière'); w.abortPlan(n, 't'); n.away = false; n.state = 'idle'; n.decision_cooldown = 99; w.avatar.pos = { x: 20.5, y: 26.5 }; n.pos = { x: 21.3, y: 26.5 }; window.__n = n.id; g.hud.openDialogue(n); }); await pg.waitForFunction(() => document.getElementById('dlg').style.display === 'block'); };
  await E(() => { const w = window.__gib.world, n = w.chars.find((c) => c.name === 'Noémie Rivière'); w.avatar.gender = 'M'; w.avatar.age = 30; w.avatar.attracted_to = ['F']; n.gender = 'F'; n.age = 26; n.attracted_to = ['M']; const r = w.getRel(n.id, w.avatar.id); r.att = 90; r.aff = 90; r.trust = 90; r.fear = 0; r.fam = 80; });
  await open(); const txt = await E(() => document.getElementById('dlg').textContent);
  ok(txt.includes('Flirter') && txt.includes('rendez-vous'), 'adultes compatibles : « Flirter » et « Proposer un rendez-vous » sont proposés');
  await pg.click('#dlg button:has-text("Proposer un rendez-vous")'); await pg.waitForTimeout(500);
  const s1 = await E(() => { const w = window.__gib.world; const r = Object.values(w.romances)[0]; return { st: r && r.state, txt: document.getElementById('dlg').textContent }; });
  ok(s1.st === 'dating', `rendez-vous accepté : ${s1.st}`); ok(/Proposer une sortie/.test(s1.txt), 'le dialogue propose maintenant une sortie');
  await E(() => { const g = window.__gib; g.hud.fiche.open(window.__n); }); await pg.waitForTimeout(400); await pg.click('#fiche [data-t="relations"]'); await pg.waitForTimeout(300);
  ok((await E(() => document.getElementById('fiche').textContent)).includes('se fréquentent'), 'la fiche affiche le statut amoureux et l\'attirance');
  await E(() => { while (window.__nav.list().length) window.__nav.closeTop(); const w = window.__gib.world, n = w.chars[window.__n]; n.age = 17; });
  await open(); const t2 = await E(() => document.getElementById('dlg').textContent); ok(!t2.includes('Flirter') && !t2.includes('sortie'), 'aucune option romantique avec un mineur');
  ok(errs.length === 0, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs[0] : '')); console.log(fails ? `\n${fails} ÉCHEC(S)` : '\nROMANCE : tout est vert'); await b.close(); process.exit(fails ? 1 : 0);
})();
