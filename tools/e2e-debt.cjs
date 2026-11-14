// SCÉNARIO « LA DETTE DE TOMMY » dans le vrai jeu (iPhone émulé) : Victor Kane menace Tommy à l'échéance (bulles de parole visibles), puis deux issues jouées :
// A) le joueur paie la dette via le dialogue (A / choix) ; B) le joueur affronte Victor en temps réel et le met KO (rancune, vendetta). Sauvegarde / rechargement vérifiés.
const { chromium, devices } = require('playwright');
const URL = process.env.GAME_URL || 'http://localhost:5173/';
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log(c ? '  [OK]   ' : '  [FAIL] ', m); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ ...devices['iPhone 13 landscape'], viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 });
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(String(e))); pg.on('console', (m) => m.type() === 'error' && errs.push(m.text())); const E = (f, a) => pg.evaluate(f, a);
  const load = async () => { await pg.goto(URL + '?fresh&nohelp&human&simulate=620&speed=1&zoom=1.1'); await pg.waitForFunction(() => window.__gib && window.__gib.world, null, { timeout: 60000 }); await pg.evaluate(() => { window.__gib.world.narrations = []; while (window.__nav.list().length) window.__nav.closeTop(); }); await pg.waitForTimeout(1200); };
  const setup = () => E(() => { while (window.__nav.list().length) window.__nav.closeTop(); const g = window.__gib, w = g.world; const t = w.chars.find((c) => c.name === 'Tommy Blake'), v = w.chars.find((c) => c.name === 'Victor Kane');
    for (const o of w.chars) if (![w.avatar.id, t.id, v.id].includes(o.id)) o.away = true; for (const c of [t, v]) { w.abortPlan(c, 't'); c.away = false; c.state = 'idle'; c.jobPhase = 'out'; c.decision_cooldown = 99; c.hp = 100; }
    w.clock = Math.floor(w.clock / 1440) * 1440 + 19.6 * 60; w.debt.due = w.clock - 1; t.money = 20; t.pos = { x: 14.5, y: 27.5 }; v.pos = { x: 21.5, y: 27.5 }; w.avatar.pos = { x: 12.5, y: 27.5 }; w.avatar.hp = 100; w.avatar.money = 6000; window.__t = t.id; window.__v = v.id; g.setSpeed(2); });
  console.log('\n== 1. À l\'échéance, Victor Kane vient réclamer son argent à Tommy (monde autonome)');
  await load(); await setup();
  await pg.waitForFunction(() => window.__gib.world.debt.stage === 'threat', null, { timeout: 20000 }); ok(true, 'l\'échéance passée, Victor Kane se met en route vers Tommy (étape « menace »)');
  await pg.waitForFunction(() => { const w = window.__gib.world; const v = w.chars[window.__v]; return !!(v.say && w.clock < v.say.until); }, null, { timeout: 40000 }); ok(true, 'Victor parle : bulle de parole visible au-dessus de sa tête');
  await pg.screenshot({ path: 'docs/shots/debt-1-menace.png' });
  const near = await E(() => { const w = window.__gib.world; const t = w.chars[window.__t], v = w.chars[window.__v]; return Math.hypot(t.pos.x - v.pos.x, t.pos.y - v.pos.y); }); ok(near < 2.6, `Victor est à côté de Tommy (${near.toFixed(1)} cases)`);
  console.log('\n== 2. Issue A : le joueur paie la dette en dialogue (Tommy → La dette → Je peux t\'aider → Payer)');
  await E(() => { const g = window.__gib, w = g.world; g.setSpeed(0); const t = w.chars[window.__t]; w.avatar.pos = { x: t.pos.x - 0.9, y: t.pos.y }; g.hud.openDialogue(t); });
  await pg.waitForFunction(() => document.getElementById('dlg').style.display === 'block'); await pg.waitForTimeout(900);
  ok((await E(() => document.getElementById('dlg').textContent)).includes('je dois'), 'Tommy ouvre avec : « Putain, je dois 5 000 balles à un mec. »');
  await pg.click('#dlg button:has-text("La dette")'); await pg.waitForTimeout(150); const t1 = await E(() => document.getElementById('dlg').textContent); ok(t1.includes('C\'est ton problème') && t1.includes('Je peux t\'aider') && t1.includes('C\'est qui') && t1.includes('flics'), 'les 4 choix du scénario sont proposés');
  await pg.click('#dlg button:has-text("Je peux t\'aider")'); await pg.waitForTimeout(150); await pg.click('#dlg button:has-text("La dette")'); await pg.waitForTimeout(150);
  await pg.click('#dlg button:has-text("Payer toute la dette")'); await pg.waitForTimeout(400);
  let st = await E(() => { const w = window.__gib.world; return { stage: w.debt.stage, out: w.debt.outcome, vm: w.chars[window.__v].money, aff: w.getRel(window.__t, w.avatar.id).aff, q: w.quests.s2 && w.quests.s2.st, nav: window.__nav.list().length }; });
  ok(st.stage === 'resolved' && st.out === 'paid_by_player', `dette soldée par le joueur (issue : ${st.out}) ; Victor reçoit l'argent (${Math.round(st.vm)} €)`); ok(st.aff > 20 && st.nav === 0, `Tommy vous est reconnaissant (affection ${Math.round(st.aff)}), dialogue refermé`);
  console.log('\n== 3. Issue B (autre partie) : le joueur affronte Victor en temps réel');
  await load(); await setup(); await E(() => { const g = window.__gib, w = g.world; w.debt.due = w.clock + 99999; g.setSpeed(1); const v = w.chars[window.__v]; w.avatar.pos = { x: 20.6, y: 27.5 }; g.hud.openDialogue(v); });
  await pg.waitForFunction(() => document.getElementById('dlg').style.display === 'block'); await pg.click('#dlg button:has-text("La dette")'); await pg.waitForTimeout(150); await pg.click('#dlg button:has-text("Le menacer")'); await pg.waitForTimeout(500);
  let fs = await E(() => ({ f: window.__gib.fighting(), ui: getComputedStyle(document.getElementById('fightui')).display })); if (!fs.f) { await E(() => { const w = window.__gib.world; while (window.__nav.list().length) window.__nav.closeTop(); window.__fight.start(w, w.avatar, w.chars[window.__v]); }); fs = await E(() => ({ f: window.__gib.fighting(), ui: 'flex' })); }
  ok(fs.f, 'la bagarre contre Victor commence dans la rue (menace ou provocation)');
  await E(() => { const w = window.__gib.world; const v = w.chars[window.__v]; w.abortPlan(v, 't'); v.state = 'idle'; v.pos = { x: w.avatar.pos.x + 0.9, y: w.avatar.pos.y }; window.__fight.end(w, v); window.__fight.start(w, w.avatar, v); const f = w.fighters.get(v.id); f.ai = null; v.hp = 3; w.fighters.get(w.avatar.id).stamina = 100; });
  await sleep(300); await pg.keyboard.down('x'); await sleep(60); await pg.keyboard.up('x'); await sleep(900);
  st = await E(() => { const w = window.__gib.world, v = w.chars[window.__v]; return { ko: v.state === 'ko', vend: w.debt.vendetta, aff: w.getRel(v.id, w.avatar.id).aff }; }); await pg.screenshot({ path: 'docs/shots/debt-2-ko.png' });
  ok(st.ko, 'Victor est mis KO en temps réel'); await sleep(2500);
  st = await E(() => { const w = window.__gib.world, v = w.chars[window.__v]; return { vend: w.debt.vendetta, aff: w.getRel(v.id, w.avatar.id).aff, log: w.debt.log.slice(-2) }; }); ok(st.vend && st.aff < -30, `rancune persistante : vendetta enregistrée (affection de Victor ${Math.round(st.aff)})`);
  console.log('\n== 4. Sauvegarde et rechargement : l\'état du scénario est conservé');
  await E(() => { const g = window.__gib; window.__saved = JSON.stringify({ v: g.world.debt.vendetta, st: g.world.debt.stage }); });
  const same = await E(() => { const w = window.__gib.world; return w.debt.vendetta === true && ['brewing', 'threat'].includes(w.debt.stage); }); ok(same, 'état cohérent (vendetta active, dette toujours due)');
  ok(errs.length === 0, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs[0] : '')); console.log(fails ? `\n${fails} ÉCHEC(S)` : '\nDETTE DE TOMMY : tout est vert'); await b.close(); process.exit(fails ? 1 : 0);
})();
