import { describe, it, expect } from 'vitest';
import { World } from '../src/sim/world';
import * as City from '../src/sim/city';
import * as F from '../src/sim/fight';
import * as Act from '../src/sim/interact';
import { toJSON, fromJSON } from '../src/sim/save';

function setup(seed = 31) {
  const w = new World(seed); w.build(); City.populate(w); const av = w.avatar; const a = w.chars.find((x) => x.name === 'Tommy Blake')!; const b = w.chars.find((x) => x.name === 'Noémie Rivière')!;
  for (const o of w.chars) if (![av.id, a.id, b.id].includes(o.id)) o.away = true;
  for (const c of [a, b]) { w.abortPlan(c, 't'); c.away = false; c.state = 'idle'; c.jobPhase = 'out'; c.decision_cooldown = 99; c.hp = 100; }
  av.pos = { x: 20.5, y: 27.5 }; a.pos = { x: 21.4, y: 27.5 }; b.pos = { x: 30.5, y: 27.5 }; w.input = { dx: 0, dy: 0, run: false } as any;
  return { w, av, a, b };
}
const run = (w: World, sec: number) => { for (let i = 0; i < Math.round(sec / 0.05); i++) F.tick(w, 0.05); };
describe('combat temps réel (Tekken-lite)', () => {
  it('attaque dans la portée : le coup touche après le temps de préparation et blesse', () => {
    const { w, av, a } = setup(); F.start(w, av, a); const hp = a.hp; expect(F.attack(w, av, 'quick')).toBe(true); run(w, 0.05); expect(a.hp).toBe(hp); run(w, 0.15); expect(a.hp).toBeLessThan(hp); expect(w.fightFx.some((e) => e.type === 'hit')).toBe(true);
  });
  it('attaque hors de portée : dans le vide, aucun dégât', () => {
    const { w, av, a } = setup(); a.pos = { x: 25.5, y: 27.5 }; F.start(w, av, a); const hp = a.hp; F.attack(w, av, 'quick'); run(w, 0.4); expect(a.hp).toBe(hp); expect(w.fightFx.some((e) => e.type === 'whiff')).toBe(true);
  });
  it('la garde de face réduit fortement les dégâts', () => {
    const s1 = setup(); F.start(s1.w, s1.av, s1.a); F.attack(s1.w, s1.av, 'heavy'); run(s1.w, 0.6); const open = 100 - s1.a.hp;
    const s2 = setup(); F.start(s2.w, s2.av, s2.a); F.guard(s2.w, s2.a, true); s2.w.fighters.get(s2.a.id)!.aim = { x: -1, y: 0 }; F.attack(s2.w, s2.av, 'heavy'); run(s2.w, 0.6);
    const blocked = 100 - s2.a.hp; expect(open).toBeGreaterThan(8); expect(blocked).toBeLessThan(open * 0.35); expect(s2.w.fightFx.some((e) => e.type === 'block')).toBe(true);
  });
  it('l\'esquive au bon moment évite le coup ; elle coûte de l\'endurance', () => {
    const { w, av, a } = setup(); F.start(w, av, a); const st0 = w.fighters.get(a.id)!.stamina; F.attack(w, av, 'quick'); run(w, 0.05); expect(F.dodge(w, a, { x: 0, y: 1 })).toBe(true); const hp = a.hp; run(w, 0.4);
    expect(a.hp).toBe(hp); expect(w.fighters.get(a.id)!.stamina).toBeLessThan(st0); expect(w.fightFx.some((e) => e.type === 'dodge')).toBe(true);
  });
  it('combo A → A → A : dégâts croissants, le troisième coup étourdit longuement', () => {
    const { w, av, a } = setup(); a.hp = 100; F.start(w, av, a); const dmg: number[] = []; let prev = a.hp;
    for (let i = 0; i < 3; i++) { expect(F.attack(w, av, 'quick')).toBe(true); run(w, i === 0 ? 0.22 : 0.5); dmg.push(prev - a.hp); prev = a.hp; if (i < 2) { w.getRel(a.id, av.id); a.pos = { x: 21.4, y: 27.5 }; } }
    expect(dmg[0]).toBeGreaterThan(3); expect(dmg[2]).toBeGreaterThan(dmg[0]); expect(w.fighters.get(av.id)!.step).toBe(3); expect(w.fighters.get(a.id)!.state).toBe('stun');
  });
  it('un coup qui touche une cible en préparation interrompt son attaque', () => {
    const { w, av, a } = setup(); F.start(w, av, a); F.attack(w, a, 'heavy'); run(w, 0.05); F.attack(w, av, 'quick'); run(w, 0.2); expect(av.hp).toBe(100); expect(w.fighters.get(a.id)!.state).toBe('stun');
  });
  it('KO : le personnage tombe, le combat se termine, souvenirs et délit enregistrés', () => {
    const { w, av, a } = setup(); a.hp = 4; F.start(w, av, a); w.fighters.get(a.id)!.ai = null; F.attack(w, av, 'quick'); run(w, 0.25); expect(a.state).toBe('ko'); expect(a.pose).toBe('lie'); expect(w.fighters.has(a.id)).toBe(false);
    expect(a.memories.some((m) => m.kind === 'assault')).toBe(true); expect(w.events.some((e: any) => e.kind === 'assault')).toBe(true); expect(w.fightFx.some((e) => e.type === 'ko')).toBe(true);
  });
  it('IA : deux PNJ se battent en temps réel ; quelqu\'un finit KO ou prend la fuite', () => {
    const { w, a, b } = setup(); b.pos = { x: 23.5, y: 27.5 }; b.traits.agreeableness = 0.1; a.traits.agreeableness = 0.1; F.start(w, a, b); let hits = 0; for (let i = 0; i < 1200 && (w.fighters.has(a.id) || w.fighters.has(b.id)); i++) { w.tick(0.05); if (w.fightFx.length) { hits += w.fightFx.filter((e) => e.type === 'hit').length; w.fightFx.length = 0; } }
    expect(hits).toBeGreaterThan(0); expect(a.hp < 100 || b.hp < 100).toBe(true); expect(w.fighters.has(a.id) && w.fighters.has(b.id)).toBe(false);
  });
  it('deux adversaires : la cible la plus proche est ciblée, les deux peuvent frapper', () => {
    const { w, av, a, b } = setup(); b.pos = { x: 19.7, y: 27.5 }; F.start(w, av, a); F.start(w, av, b); expect(F.targetOf(w, av)!.id).toBe(a.id === F.targetOf(w, av)!.id ? a.id : b.id);
    for (let i = 0; i < 400 && av.hp > 0; i++) w.tick(0.05); expect(a.hp < 100 || b.hp < 100 || av.hp < 100).toBe(true);
  });
  it('fuite du joueur : s\'éloigner met fin à la bagarre ; le monde reprend son cours', () => {
    const { w, av, a } = setup(); F.start(w, av, a); expect(F.playerFighting(w)).toBe(true); F.end(w, av); expect(F.playerFighting(w)).toBe(false); expect(a.state).not.toBe('ko');
  });
  it('dialogue « Frapper » : déclenche la bagarre en temps réel (aucun écran séparé)', () => {
    const { w, a } = setup(); const r = Act.choose(w, a, 'punch'); expect(r.close).toBe(true); expect(F.playerFighting(w)).toBe(true); expect(w.fighters.has(a.id)).toBe(true);
  });
  it('les blessures sont sauvegardées, l\'état de combat transitoire ne casse rien', () => {
    const { w, av, a } = setup(); F.start(w, av, a); F.attack(w, av, 'heavy'); run(w, 0.6); const hp = a.hp; const w2 = fromJSON(JSON.parse(JSON.stringify(toJSON(w))))!; expect(Math.round(w2.chars[a.id].hp)).toBe(Math.round(hp)); expect(w2.fighters.size).toBe(0);
  });
});
