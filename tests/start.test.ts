import { describe, it, expect } from 'vitest';
import { World } from '../src/sim/world';
import * as P from '../src/sim/profile';
import * as Q from '../src/sim/quests';
import * as Home from '../src/sim/home';
import * as Act from '../src/sim/interact';
import { toJSON, fromJSON } from '../src/sim/save';
import { MIN_PER_SEC } from '../src/sim/defs';

const look = () => ({ skin: 5, hair: 'afro', hair_color: 'pink', top: 'jacket', top_color: 'black', bottom: 'shorts', bottom_color: 'dark', shoes: 'red', build: 2, height: 1, acc: '', face: 2, eyes: 3, brows: 1, nose: 2, mouth: 1, ears: 1, freckles: true, scars: [2], beard: 'goatee', beard_color: '', accs: ['chain', 'watch'], acc_color: '', tattoos: [{ part: 'arm', motif: 2 }, { part: 'leg', motif: 1 }] });
const profile = (): P.Profile => ({ first: 'Sam', last: 'Dupont', nick: 'Sammy', pronoun: 'iel', age: 31, traits: ['charismatique', 'ambitieux'], createdAt: 0 });
const run = (w: World, gameMin: number) => { const n = Math.ceil(gameMin / (0.25 * MIN_PER_SEC)); for (let i = 0; i < n; i++) w.tick(0.25); };

describe('NOUVELLE PARTIE : état initial réel', () => {
  it('avatar créé, appartement attribué, argent, kit de départ, quêtes et narration initialisés', () => {
    const w = P.newGame(profile(), look() as any, 77);
    expect(w.avatar.first).toBe('Sammy'); expect(w.avatar.name).toBe('Sam Dupont'); expect(w.avatar.age).toBe(31); expect(w.avatar.look.hair).toBe('afro'); expect(w.avatar.look.tattoos!.length).toBe(2);
    expect(w.property?.name).toBe('Studio Noria'); expect(w.avatar.money).toBe(450); expect(w.stash.floor_lamp).toBe(1); expect(w.stash.plant).toBe(2);
    expect(Home.inApartment(w.avatar.cell().x, w.avatar.cell().y)).toBe(true); expect(w.quests.c1m1.st).toBe('active'); expect(w.quests.c1m1.tracked).toBe(true); expect(w.narrations.length).toBe(1); expect(w.avatarControlled).toBe(true);
    expect(w.avatar.traits.extraversion).toBeGreaterThan(0.65);     // charismatique : extraversion +
  });
  it('sauvegarde / chargement : profil, apparence, quêtes, kit et propriété conservés ; rien n\'est redonné', () => {
    const w = P.newGame(profile(), look() as any, 78); Home.place(w, 'floor_lamp', 60, 25); Home.restyle(w, 'j', 'floor', 'wood_a');
    const w2 = fromJSON(JSON.parse(JSON.stringify(toJSON(w))))!;
    expect(w2.profile?.nick).toBe('Sammy'); expect(w2.avatar.look.hair_color).toBe('pink'); expect(w2.avatar.look.tattoos!.map((t) => t.part)).toEqual(['arm', 'leg']); expect(w2.avatar.first).toBe('Sammy'); expect(w2.property?.id).toBe('studio_noria');
    expect(w2.quests.c1m1.p).toEqual(w.quests.c1m1.p); expect(w2.avatar.money).toBe(w.avatar.money); expect(w2.stash.plant).toBe(2); expect(w2.homeStyle.floor.j).toBe('wood_a'); expect(w2.narrations.length).toBe(1);
  });
  it('une ancienne sauvegarde (sans profil ni quêtes) se charge, sans relancer le créateur ni redonner de récompense', () => {
    const w = new World(5); w.build(); run(w, 120); const d: any = JSON.parse(JSON.stringify(toJSON(w))); for (const k of ['profile', 'avatarLook', 'property', 'quests', 'progress', 'questLog', 'questDone', 'narrations', 'job']) delete d[k];
    const w2 = fromJSON(d)!; expect(w2).not.toBeNull(); expect(w2.profile).toBeNull(); expect(w2.narrations.length).toBe(0); expect(Object.keys(w2.quests).length).toBeGreaterThan(0); expect(w2.progress.reputation).toBe(0);
  });
});

describe('CHAPITRE 1 : missions branchées sur de vrais événements du moteur', () => {
  it('mission 1 : meuble posé, sol changé, partie sauvegardée → récompense unique', () => {
    const w = P.newGame(profile(), look() as any, 79); const m0 = w.avatar.money;
    expect(w.quests.c1m1.p[0]).toBe(1);                                   // déjà dans l'appartement
    Quests_emit_saved(w); expect(w.quests.c1m1.p[3]).toBe(0);             // « sauvegarder » ne compte pas avant les étapes précédentes (ordre)
    expect(Home.place(w, 'floor_lamp', 60, 25).ok).toBe(true); expect(Home.restyle(w, 'j', 'wall', 'lilas').ok).toBe(true); Quests_emit_saved(w);
    expect(w.quests.c1m1.st).toBe('done'); expect(w.avatar.money).toBe(m0 - 30 + 120); expect(w.progress.unlocks).toContain('catalog2'); expect(w.quests.c1m2.st).toBe('active');
    const m1 = w.avatar.money; Quests_emit_saved(w); expect(w.avatar.money).toBe(m1);   // pas de seconde récompense
    const w2 = fromJSON(JSON.parse(JSON.stringify(toJSON(w))))!; expect(w2.quests.c1m1.st).toBe('done'); expect(w2.avatar.money).toBe(w.avatar.money);
  });
  it('mission 2 → 5 : contact, livraison réelle, choix de voie, rôle de Créateur ; relations et argent mis à jour', () => {
    const w = P.newGame(profile(), look() as any, 80); const complete1 = () => { Home.place(w, 'floor_lamp', 60, 25); Home.restyle(w, 'j', 'wall', 'lilas'); Quests_emit_saved(w); }; complete1();
    const av = w.avatar; const res = w.residents.find((c) => !c.away && !c.isAsleep())!;
    // mission 2
    av.pos = { x: 62.5, y: 33.5 }; run(w, 2); expect(w.quests.c1m2.p[0]).toBe(1);            // sorti dans la rue (détecté par la simulation)
    res.pos = { x: 63.5, y: 33.5 }; res.away = false; Act.noteTalk(w, res); Act.choose(w, res, 'how'); Q_emit(w, 'sheet');
    expect(w.quests.c1m2.st).toBe('done'); expect(w.getRel(res.id, av.id).fam).toBeGreaterThan(5); expect(res.memories.some((m) => m.kind === 'meet')).toBe(true);
    // mission 3 : livraison réelle (colis → destinataire → paie)
    const clerk = w.clerk!; clerk.away = false; av.pos = { x: 61.5, y: 14.5 }; run(w, 1); expect(w.quests.c1m3.p[0]).toBe(1);
    const m0 = av.money; Act.choose(w, clerk, 'job'); expect(av.inventory.parcel).toBe(1); expect(w.job).not.toBeNull(); const to = w.chars[w.job!.to]; to.away = false; av.pos = { x: to.pos.x + 1, y: to.pos.y }; 
    Act.choose(w, to, 'deliver'); expect(av.inventory.parcel).toBe(0); expect(av.money).toBeGreaterThan(m0); expect(w.quests.c1m3.st).toBe('done'); expect(w.progress.unlocks).toContain('job_board');
    // mission 4 : voie « aider »
    av.inventory.sandwich = 1; Act.choose(w, res, 'give_item', 'sandwich'); expect(w.quests.c1m4.st).toBe('done'); expect(w.progress.flags.path).toBe('help');
    // mission 5 : Créateur
    for (const e of ['god', 'observe', 'power', 'descend', 'sheet']) Q_emit(w, e); expect(w.quests.c1m5.st).toBe('done'); expect(w.progress.unlocks).toContain('divine_challenges'); expect(w.narrations.some((n) => n.title.includes('CHAPITRE'))).toBe(true);
    expect(w.progress.chapters.length).toBe(5); expect(w.quests.d1.st).toBe('active');
  });
  it('les objectifs d\'une quête « ordered » ne comptent pas dans le désordre', () => { const w = P.newGame(profile(), look() as any, 81); Q_emit(w, 'style_changed'); expect(w.quests.c1m1.p[2]).toBe(0); });
  it('un événement émergent dépend de l\'état réel : habitant affamé et sans argent → demande d\'aide', () => {
    const w = P.newGame(profile(), look() as any, 82); w.quests.c1m2 = { st: 'done', p: [1, 1, 1, 1], tracked: false, t0: 0, t1: 0 }; const r = w.residents.find((c) => !c.away && !c.isAsleep())!; r.needs.hunger = 10; r.money = 3; w.clock += 200; Q.tick(w);
    expect(Object.keys(w.quests).some((k) => k.startsWith('h_' + r.id))).toBe(true);
    const id = Object.keys(w.quests).find((k) => k.startsWith('h_' + r.id))!; w.avatar.inventory.sandwich = 1; Act.choose(w, r, 'give_item', 'sandwich'); expect(w.quests[id].st).toBe('done');
  });
});
function Quests_emit_saved(w: World) { Q.emit(w, 'saved'); }
function Q_emit(w: World, e: string) { Q.emit(w, e); }
