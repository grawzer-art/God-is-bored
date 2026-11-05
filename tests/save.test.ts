import { describe, it, expect } from 'vitest';
import { World } from '../src/sim/world';
import * as Save from '../src/sim/save';

function mk() { const w = new World(1337); w.build(); for (let i = 0; i < 300; i++) w.tick(0.1); return w; }

describe('sauvegarde versionnée', () => {
  it('export puis import restituent la même partie', () => {
    const w = mk(); const text = Save.exportText(w, 'test');
    const r = Save.parseImport(text);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.summary.residents).toBe(w.residents.length);
    const w2 = Save.fromJSON(r.payload)!;
    expect(w2.clock).toBe(w.clock);
    expect(JSON.stringify(Save.toJSON(w2).rel)).toBe(JSON.stringify(Save.toJSON(w).rel));
  });
  it('accepte une ancienne sauvegarde brute (sans enveloppe)', () => {
    const w = mk(); const r = Save.parseImport(JSON.stringify(Save.toJSON(w)));
    expect(r.ok).toBe(true);
  });
  it('refuse un JSON invalide, un autre format, une somme de contrôle fausse', () => {
    expect(Save.parseImport('pas du json').ok).toBe(false);
    expect(Save.parseImport('{"format":"autre","payload":{}}').ok).toBe(false);
    expect(Save.parseImport('{"a":1}').ok).toBe(false);
    const env = JSON.parse(Save.exportText(mk()));
    env.payload.clock += 1;
    const r = Save.parseImport(JSON.stringify(env)); expect(r.ok).toBe(false);
  });
  it('refuse une charge utile mal formée même avec une somme valide', () => {
    const w = mk();
    const cases: ((p: any) => void)[] = [
      (p) => { p.chars[0].pos = { x: 'a', y: 2 }; },
      (p) => { delete p.chars[0].needs; },
      (p) => { p.chars[0].needs.hunger = NaN; },
      (p) => { p.chars = []; },
      (p) => { p.clock = -5; },
      (p) => { p.rel = 'x'; },
      (p) => { p.chars[1].id = p.chars[0].id; },
    ];
    for (const mutate of cases) {
      const payload = JSON.parse(JSON.stringify(Save.toJSON(w))); mutate(payload);
      const env = JSON.stringify({ format: Save.FILE_FORMAT, version: 1, checksum: Save.checksum(JSON.stringify(payload)), payload });
      expect(Save.parseImport(env).ok).toBe(false);
    }
  });
  it('refuse une version plus récente et un fichier trop gros', () => {
    const payload = { ...Save.toJSON(mk()), version: Save.SAVE_VERSION + 1 };
    const r = Save.parseImport(JSON.stringify(payload)); expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/plus récente/);
    expect(Save.parseImport(' '.repeat(Save.MAX_IMPORT_BYTES + 1)).ok).toBe(false);
  });
  it('applique les migrations en chaîne', () => {
    const old = { version: 1, marker: 'a' };
    (Save.MIGRATIONS as any)[1] = (d: any) => ({ ...d, marker: d.marker + 'b' });
    const saved = Save.SAVE_VERSION;
    try { expect(() => Save.migrate({ version: 0 })).toThrow(); expect(Save.migrate(old).marker).toBe(saved === 1 ? 'a' : 'ab'); }
    finally { delete (Save.MIGRATIONS as any)[1]; }
  });
});
