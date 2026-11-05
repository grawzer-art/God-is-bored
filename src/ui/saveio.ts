/** Export / import des sauvegardes (fichier JSON) — partage iOS (Fichiers), téléchargement ailleurs. */
import type { World } from '../sim/world';
import * as Save from '../sim/save';

export const BUILD = typeof __BUILD__ !== 'undefined' ? __BUILD__ : 'dev';

export async function exportToFile(w: World): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const text = Save.exportText(w, BUILD);
  const name = `god-is-bored-jour${w.day()}-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File([text], name, { type: 'application/json' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare && nav.canShare({ files: [file] })) {
    try { await nav.share({ files: [file], title: 'Sauvegarde GOD IS BORED' }); return 'shared'; } catch (e: any) { if (e?.name === 'AbortError') return 'cancelled'; }
  }
  const url = URL.createObjectURL(file); const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000); return 'downloaded';
}

/** Ouvre le sélecteur de fichier ; résout avec le texte (ou null si annulé). */
export function pickFile(): Promise<string | null> {
  return new Promise((resolve) => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json'; inp.style.display = 'none'; document.body.appendChild(inp);
    inp.onchange = async () => { const f = inp.files?.[0]; inp.remove(); if (!f) return resolve(null); if (f.size > Save.MAX_IMPORT_BYTES) return resolve('x'.repeat(Save.MAX_IMPORT_BYTES + 1)); resolve(await f.text()); };
    inp.addEventListener('cancel', () => { inp.remove(); resolve(null); });
    inp.click();
  });
}
