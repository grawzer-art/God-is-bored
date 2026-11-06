import { describe, it, expect } from 'vitest';
import { World } from '../src/sim/world';
import * as City from '../src/sim/city';
import * as R from '../src/sim/romance';
import * as Act from '../src/sim/interact';
import { toJSON, fromJSON } from '../src/sim/save';

function setup() {
  const w = new World(21); w.build(); City.populate(w); const av = w.avatar; const n = w.chars.find((x) => x.name === 'Noémie Rivière')!;
  av.gender = 'M'; av.age = 30; av.attracted_to = ['F']; n.gender = 'F'; n.age = 26; n.attracted_to = ['M']; n.away = false; n.state = 'idle'; n.joy = 10; n.anger = 0; n.stress = 10; n.needs.energy = 80;
  av.pos = { x: 20.5, y: 25.5 }; n.pos = { x: 21.3, y: 25.5 };
  return { w, av, n };
}
const warm = (w: World, a: any, b: any, v = 85) => { const r = w.getRel(b.id, a.id); r.att = v; r.aff = v; r.trust = v; r.fear = 0; r.fam = 80; };
describe('romance entre adultes', () => {
  it('jamais avec un mineur : aucune avance, aucune relation', () => {
    const { w, av, n } = setup(); warm(w, av, n); n.age = 17; expect(R.blocked(w, av, n)).toMatch(/adultes/); expect(R.flirt(w, av, n).ok).toBe(false); expect(R.date(w, av, n).ok).toBe(false);
    expect(Act.dialogueOpen(w, n).choices.some((c) => c.id === 'flirt' || c.id === 'date')).toBe(false); av.age = 17; n.age = 30; expect(R.blocked(w, av, n)).toMatch(/adultes/); expect(Object.keys(w.romances)).toHaveLength(0);
  });
  it('compatibilité : sans attirance mutuelle, rien n\'est proposé', () => {
    const { w, av, n } = setup(); n.attracted_to = ['F']; expect(R.compatible(av, n)).toBe(false); expect(R.flirt(w, av, n).ok).toBe(false); expect(Act.dialogueOpen(w, n).choices.some((c) => c.id === 'flirt')).toBe(false);
  });
  it('le consentement est une condition : peur ou rancune → refus ; insister aggrave', () => {
    const { w, av, n } = setup(); warm(w, av, n); w.getRel(n.id, av.id).fear = 80; const r1 = R.flirt(w, av, n); expect(r1.ok).toBe(false); expect(r1.refused).toBe(true);
    const aff0 = w.getRel(n.id, av.id).aff; const r2 = R.flirt(w, av, n); expect(r2.ok).toBe(false); expect(r2.line).toMatch(/non/i); expect(w.getRel(n.id, av.id).aff).toBeLessThan(aff0);
    expect(n.memories.some((m) => m.kind === 'romance')).toBe(true); w.getRel(n.id, av.id).fear = 0; expect(R.date(w, av, n).ok).toBe(false);
  });
  it('parcours : flirt → rendez-vous → sorties → couple → soirée (ellipse) → rupture', () => {
    const { w, av, n } = setup(); warm(w, av, n, 90); let ok = false; for (let i = 0; i < 12 && !ok; i++) { n.stats = {}; ok = R.flirt(w, av, n).ok; } expect(ok).toBe(true);
    n.stats = {}; expect(R.date(w, av, n).ok).toBe(true); expect(R.get(w, av.id, n.id)!.state).toBe('dating'); expect(R.again(w, av, n).ok).toBe(false); w.clock += 800; expect(R.again(w, av, n).ok).toBe(true);
    expect(R.ask(w, av, n).ok).toBe(true); expect(R.get(w, av.id, n.id)!.state).toBe('couple'); expect(R.partnerOf(w, n)!.id).toBe(av.id);
    w.clock += 600; const ev = R.evening(w, av, n); expect(ev.ok).toBe(true); expect(ev.line).not.toMatch(/\b(sexe|nus?|nue?s?|lit)\b/i);
    w.clock += 600; n.needs.energy = 10; expect(R.evening(w, av, n).ok).toBe(false);
    expect(R.breakUp(w, av, n).ok).toBe(true); expect(R.get(w, av.id, n.id)!.state).toBe('ex'); expect(R.partnerOf(w, n)).toBeNull();
  });
  it('un(e) partenaire exclusif : une autre personne se voit répondre qu\'il/elle est pris(e)', () => {
    const { w, av, n } = setup(); const other = w.chars.find((x) => x.name === 'Tommy Blake')!; other.gender = 'M'; other.attracted_to = ['F']; w.romances['x'] = { a: n.id, b: other.id, state: 'couple', since: 0, dates: 3, last: 0 };
    expect(R.blocked(w, av, n)).toMatch(/déjà en couple/);
  });
  it('sauvegarde conservée ; les PNJ très proches se mettent ensemble', () => {
    const { w, av, n } = setup(); warm(w, av, n, 90); w.romances['a'] = { a: av.id, b: n.id, state: 'dating', since: 0, dates: 1, last: 0 }; const w2 = fromJSON(JSON.parse(JSON.stringify(toJSON(w))))!; expect(w2.romances.a.state).toBe('dating');
    const w3 = new World(4); w3.build(); City.populate(w3); const a = w3.chars[0], b = w3.chars[1]; a.age = b.age = 30; a.gender = 'F'; b.gender = 'M'; a.attracted_to = ['M']; b.attracted_to = ['F'];
    for (const [x, y] of [[a, b], [b, a]] as any) { const r = w3.getRel(x.id, y.id); r.att = 80; r.aff = 80; } for (let i = 0; i < 10 && !R.partnerOf(w3, a); i++) R.daily(w3); expect(R.partnerOf(w3, a)?.id).toBe(b.id);
  });
});
