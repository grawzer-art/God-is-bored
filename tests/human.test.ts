import { describe, it, expect } from 'vitest';
import { World } from '../src/sim/world';
import * as L from '../src/sim/layout';
import { NEEDS } from '../src/sim/defs';
import * as I from '../src/sim/interact';
import { toJSON, fromJSON } from '../src/sim/save';

const mk = (seed = 7) => { const w = new World(seed); w.build(); return w; };
const run = (w: World, sec: number, dt = 0.1) => { for (let i = 0; i < sec / dt; i++) w.tick(dt); };
const at = (w: World, h: number) => { w.clock = Math.floor(w.clock / 1440) * 1440 + h * 60; };
const place = (w: World, x: number, y: number) => { const a = w.avatar; a.pos = { x, y }; a.state = 'idle'; a.plan = []; };

describe('quartier', () => {
  it('carte 52x24, bar et rue présents, portes reconnues', () => {
    expect(L.MAP.length).toBe(L.H); L.MAP.forEach((r) => expect(r.length).toBe(L.W));
    expect(L.roomAt(38, 12)).toBe('B'); expect(L.roomAt(10, 20)).toBe('r'); expect(L.roomAt(10, 19)).toBe('s'); expect(L.isDoor(38, 18)).toBe(true); expect(L.isDoor(16, 18)).toBe(true);
  });
  it('depuis la rue : toutes les interactions du bar et de la maison sont accessibles (aucune zone enclavée)', () => {
    const w = mk(); let bad = 0, total = 0; const from = { x: 16.5, y: 19.5 };
    for (const f of w.furn) for (const slot of f.slots) {
      const st = slot.stands.map((s) => ({ x: f.x + s[0], y: f.y + s[1] })).find((c) => w.isWalkable(c)); total++;
      if (!st || w.pathTo(from, st).length === 0) bad++;
    }
    expect(total).toBeGreaterThan(40); expect(bad).toBe(0);
  });
  it('les anciens index de meubles (sauvegardes) sont inchangés', () => {
    const w = mk(); expect(w.furn[0].def).toBe('bed_y'); expect(w.furnById.get('stove')).toBeDefined(); expect(w.furnById.get('bar_counter')).toBeGreaterThan(w.furnById.get('altar')!);
  });
});

describe('avatar : déplacement au clavier', () => {
  it('avance, glisse contre les murs, ne traverse rien, pas de téléportation', () => {
    const w = mk(); w.avatarControlled = true; place(w, 16.5, 20.5);
    let maxJump = 0, inSolid = 0;
    for (let i = 0; i < 4000; i++) {
      const phase = Math.floor(i / 250) % 8; const dirs = [[1, 0], [0, -1], [-1, 0], [0, 1], [1, -1], [-1, -1], [1, 1], [-1, 1]][phase];
      w.input = { dx: dirs[0], dy: dirs[1], run: i % 500 < 100 }; const p = { ...w.avatar.pos }; w.tick(0.05);
      maxJump = Math.max(maxJump, Math.hypot(w.avatar.pos.x - p.x, w.avatar.pos.y - p.y)); if (!w.isWalkable(w.avatar.cell())) inSolid++;
    }
    expect(maxJump).toBeLessThan(0.3); expect(inSolid).toBe(0);
  });
  it('un mur arrête l\'avatar (façade de la maison)', () => {
    const w = mk(); w.avatarControlled = true; place(w, 5.5, 19.5); w.input = { dx: 0, dy: -1, run: true }; // haut écran = nord-est/nord-ouest
    for (let i = 0; i < 400; i++) w.tick(0.05);
    expect(L.isWall(w.avatar.cell().x, w.avatar.cell().y)).toBe(false); expect(w.avatar.pos.y).toBeGreaterThan(17.9);
  });
  it('de la rue, on entre dans le bar par sa porte', () => {
    const w = mk(); place(w, 38.5, 19.5); w.avatarControlled = true; w.input = { dx: -1, dy: -1, run: false }; // vers la grille -y
    // dx,dy écran -> grille : gx=(dx+dy)/n, gy=(dy-dx)/n => (-1,-1) donne gx<0 ; on teste plutôt via la direction -y de la grille
    w.input = { dx: 1, dy: -1, run: false };
    let entered = false; for (let i = 0; i < 600; i++) { w.tick(0.05); if (w.roomOf(w.avatar.pos) === 'B') { entered = true; break; } }
    expect(entered).toBe(true);
  });
});

describe('barman et ouverture', () => {
  it('absent le matin, à son poste le soir, parti la nuit tard', () => {
    const w = mk(); expect(w.barman!.away).toBe(true); expect(w.barOpen()).toBe(false);
    at(w, 18); run(w, 40); expect(w.barOpen()).toBe(true); expect(w.barman!.away).toBe(false);
    run(w, 20); const gb = w.barman!; expect(w.roomOf(gb.pos)).toBe('B'); expect(gb.pos.y).toBeLessThan(11); // derrière le comptoir
    at(w, 3.5); run(w, 120); expect(w.barman!.away).toBe(true);
  });
});

describe('commandes au bar', () => {
  const open = () => { const w = mk(); at(w, 21); run(w, 60); place(w, 36.5, 12.5); return w; };
  it('payer, boire, s\'enivrer : les données persistantes changent', () => {
    const w = open(); const a = w.avatar; const m0 = a.money, f0 = a.needs.fun; const g0 = w.barman!.money;
    const r = I.orderDrink(w, 'whisky'); expect(r.ok).toBe(true);
    expect(a.money).toBe(m0 - 7); expect(w.barman!.money).toBe(g0 + 7); expect(a.drunk).toBeGreaterThan(20); expect(a.needs.fun).toBeGreaterThan(f0); expect(w.stats.drinks).toBe(1);
    run(w, 8); expect(a.state).toBe('idle'); // a fini de boire (animation visible)
  });
  it('refus : fonds insuffisants, bar fermé, nourriture dans l\'inventaire', () => {
    const w = open(); w.avatar.money = 2; expect(I.orderDrink(w, 'cocktail').ok).toBe(false); expect(w.avatar.money).toBe(2);
    w.avatar.money = 20; const c0 = w.avatar.inventory.chips ?? 0; expect(I.orderDrink(w, 'chips').ok).toBe(true); expect(w.avatar.inventory.chips).toBe(c0 + 1);
    const w2 = mk(); at(w2, 10); expect(I.orderDrink(w2, 'biere').ok).toBe(false);
  });
  it('l\'ivresse se dissipe avec le temps', () => {
    const w = open(); w.avatar.drunk = 60; run(w, 200); expect(w.avatar.drunk).toBeLessThan(50);
  });
});

describe('dialogues avec les habitants', () => {
  const awake = () => { const w = mk(); at(w, 12); run(w, 60); const npc = w.residents.find((c) => !c.isAsleep())!; return { w, npc }; };
  it('bavarder modifie relation, souvenir et besoin social', () => {
    const { w, npc } = awake(); const r = w.getRel(npc.id, w.avatar.id); const aff0 = r.aff, fam0 = r.fam, mem0 = npc.memories.length;
    for (let i = 0; i < 6; i++) I.choose(w, npc, 'chat');
    expect(r.fam).toBeGreaterThan(fam0 + 10); expect(npc.memories.length).toBeGreaterThan(mem0); expect(npc.memories.some((m) => m.other === w.avatar.id)).toBe(true);
    expect(r.aff).not.toBe(aff0);
  });
  it('question personnelle : refusée si inconnu, secret révélé si confiance', () => {
    const { w, npc } = awake(); const r = w.getRel(npc.id, w.avatar.id); r.aff = 0; r.fam = 5;
    const a0 = r.aff; I.choose(w, npc, 'secret'); expect(r.aff).toBeLessThan(a0); expect(w.knownSecrets).not.toContain(npc.id);
    r.aff = 60; r.fam = 60; const rep = I.choose(w, npc, 'secret'); expect(w.knownSecrets).toContain(npc.id); expect(rep.line).toContain(npc.secret);
  });
  it('argent : donner transfère ; emprunter dépend de l\'affinité', () => {
    const { w, npc } = awake(); const a = w.avatar; const m = a.money, nm = npc.money;
    I.choose(w, npc, 'give'); expect(a.money).toBe(m - 10); expect(npc.money).toBe(nm + 10);
    const r = w.getRel(npc.id, a.id); r.aff = 0; const before = a.money; I.choose(w, npc, 'ask_money'); expect(a.money).toBe(before);
    r.aff = 50; npc.money = 80; I.choose(w, npc, 'ask_money'); expect(a.money).toBe(before + 10); expect(a.stats.debt).toBe(10);
  });
  it('cadeau : consomme l\'objet et améliore la relation', () => {
    const { w, npc } = awake(); const a = w.avatar; const r = w.getRel(npc.id, a.id); const aff0 = r.aff, n0 = a.inventory.bonbons;
    I.choose(w, npc, 'give_item', 'bonbons'); expect(a.inventory.bonbons).toBe(n0 - 1); expect(r.aff).toBeGreaterThan(aff0);
  });
  it('humour noir : disponible selon le contexte, réception selon la personnalité', () => {
    const { w, npc } = awake(); npc.anger = 0; npc.mood = 10; at(w, 12); w.mess.length = 0;
    expect(I.dialogueOpen(w, npc).choices.find((c) => c.id === 'dark')!.enabled).toBe(false);
    npc.anger = 40; expect(I.dialogueOpen(w, npc).choices.find((c) => c.id === 'dark')!.enabled).toBe(true);
    const open = w.residents.find((c) => c.trait('openness') > 0.8 && c.trait('agreeableness') < 0.78) ?? w.residents.find((c) => c.name.startsWith('Camille'))!;
    const prude = w.residents.find((c) => c.trait('openness') < 0.3)!; const ro = w.getRel(open.id, w.avatar.id), rp = w.getRel(prude.id, w.avatar.id);
    ro.aff = 0; rp.aff = 0; I.choose(w, open, 'dark'); I.choose(w, prude, 'dark'); expect(ro.aff).toBeGreaterThan(rp.aff);
  });
  it('réveiller quelqu\'un qui dort le met en colère', () => {
    const w = mk(); const npc = w.residents[7]; expect(npc.isAsleep()).toBe(true); const r = w.getRel(npc.id, w.avatar.id); const a0 = r.aff;
    expect(I.dialogueOpen(w, npc).choices.map((c) => c.id)).toContain('wake'); I.choose(w, npc, 'wake'); expect(r.aff).toBeLessThan(a0); expect(npc.anger).toBeGreaterThan(20);
  });
  it('offrir un verre au bar', () => {
    const w = mk(); at(w, 21); run(w, 60); const npc = w.residents[0]; npc.pos = { x: 36.5, y: 13.5 }; npc.state = 'idle'; const m = w.avatar.money;
    expect(I.dialogueOpen(w, npc).choices.map((c) => c.id)).toContain('drink'); I.choose(w, npc, 'drink'); expect(w.avatar.money).toBe(m - 4); expect(npc.drunk).toBeGreaterThan(5);
  });
  it('le barman : carte, rumeurs', () => {
    const w = mk(); at(w, 21); run(w, 60); const gb = w.barman!; expect(I.dialogueOpen(w, gb).choices.find((c) => c.id === 'order')!.enabled).toBe(true);
    expect(I.choose(w, gb, 'order').openBar).toBe(true); expect(I.choose(w, gb, 'rumors').line.length).toBeGreaterThan(10);
  });
});

describe('objets et inventaire', () => {
  it('manger un sandwich restaure la faim et le consomme', () => {
    const w = mk(); w.avatar.needs.hunger = 30; const n = w.avatar.inventory.sandwich; I.useItem(w, 'sandwich'); expect(w.avatar.needs.hunger).toBeGreaterThan(60); expect(w.avatar.inventory.sandwich).toBe(n - 1);
  });
  it('interactions autour de l\'avatar : frigo -> grignoter modifie les besoins', () => {
    const w = mk(); at(w, 12); const a = w.avatar; a.needs.hunger = 20; place(w, 1.5, 11.5); // devant le frigo (1,10)
    const list = I.nearby(w, a); const it = list.find((x) => x.act === 'snack'); expect(it).toBeDefined(); I.useFurniture(w, a, it!);
    run(w, 30); expect(a.needs.hunger).toBeGreaterThan(30); expect(a.stats.done_snack).toBe(1);
  });
  it('marcher vers un habitant déclenche l\'événement d\'arrivée', () => {
    const w = mk(); at(w, 12); run(w, 90); const npc = w.residents.find((c) => !c.isAsleep())!; let got: number | null = null; w.onAvatarArrive = (n) => (got = n.id);
    place(w, 16.5, 19.5); I.walkToNpc(w, w.avatar, npc); for (let i = 0; i < 2400 && got === null; i++) w.tick(0.1); expect(got).toBe(npc.id);
  });
});

describe('persistance : mêmes données dans les deux modes', () => {
  it('argent, inventaire, ivresse, secrets connus et relations survivent à la sauvegarde', () => {
    const w = mk(); at(w, 21); run(w, 60); const a = w.avatar; a.money = 123; a.inventory.chips = 4; a.drunk = 33; w.knownSecrets = [3]; w.getRel(0, a.id).aff = 41;
    const w2 = fromJSON(JSON.parse(JSON.stringify(toJSON(w))))!; const a2 = w2.avatar;
    expect(a2.money).toBe(123); expect(a2.inventory.chips).toBe(4); expect(Math.round(a2.drunk)).toBe(33); expect(w2.knownSecrets).toEqual([3]); expect(w2.getRel(0, a2.id).aff).toBe(41);
    expect(w2.barman!.away).toBe(w.barman!.away);
  });
  it('les habitants ne sortent que pour une raison (travail, sortie au bar, retour) : jamais de flânerie au hasard dans la rue (Phase A, mise à jour LIVING NORIA)', () => {
    const w = mk(3); let strays = 0, outTicks = 0;
    for (let i = 0; i < 17280; i++) { w.tick(0.25); for (const c of w.residents) if (!c.away && ['s', 'r', 'g', 'B', 'R'].includes(w.roomOf(c.pos))) { outTicks++; if (c.outing !== 'bar' && c.state === 'idle') strays++; } }
    expect(strays).toBeLessThan(40); /* quelques instants d'arrêt (trajet recalculé, croisement) sont normaux ; jamais de flânerie prolongée */ expect(outTicks).toBeGreaterThan(0); // ils sortent bien (trajets, bar), mais toujours motivés
  });
  it('le monde continue d\'évoluer, avatar contrôlé ou non (3 jours, aucun mur traversé)', () => {
    for (const ctrl of [false, true]) {
      const w = mk(11); w.avatarControlled = ctrl; let inWall = 0, jump = 0; const prev = w.chars.map((c) => ({ ...c.pos }));
      for (let i = 0; i < 17280; i++) {
        if (ctrl) w.input = { dx: Math.sin(i / 70), dy: Math.cos(i / 90), run: false };
        w.tick(0.25); for (const c of w.chars) { if (c.away) { prev[c.id] = { ...c.pos }; continue; } jump = Math.max(jump, Math.hypot(c.pos.x - prev[c.id].x, c.pos.y - prev[c.id].y)); prev[c.id] = { ...c.pos }; if (['walk', 'idle', 'chat'].includes(c.state) && !w.isWalkable(c.cell())) inWall++; }
      }
      expect(inWall).toBe(0); expect(jump).toBeLessThan(1.4); // 1.4 : apparition du barman à la porte (pas de saut des habitants)
      expect(w.residents.every((c) => (c.stats.done_eat ?? 0) + (c.stats.done_snack ?? 0) >= 3)).toBe(true); for (const c of w.chars) for (const n of NEEDS) expect(c.needs[n]).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('compatibilité des sauvegardes V1', () => {
  it('une sauvegarde sans avatar ni barman se recharge, avec avatar et barman créés par défaut', () => {
    const w = mk(5); run(w, 120); const d = JSON.parse(JSON.stringify(toJSON(w)));
    d.chars = d.chars.filter((c: any) => c.id < 8).map((c: any) => { delete c.money; delete c.inventory; delete c.drunk; delete c.away; return c; }); delete d.musicUntil; delete d.knownSecrets; delete d.avatarControlled;
    const w2 = fromJSON(d)!; expect(w2).not.toBeNull(); expect(w2.avatar.money).toBe(60); expect(w2.barman).toBeDefined(); expect(w2.residents.length).toBe(8);
    expect(w2.clock).toBeCloseTo(w.clock); run(w2, 300); expect(w2.residents.every((c) => ['idle', 'walk', 'use', 'enter', 'exit', 'chat'].includes(c.state))).toBe(true);
  });
});
