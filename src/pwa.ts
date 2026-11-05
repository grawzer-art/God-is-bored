/** Enregistrement du service worker et détection des mises à jour (production uniquement). */
import * as Save from './sim/save';
import { BUILD } from './ui/saveio';

const CHECK_MS = 20 * 60 * 1000;
let banner: HTMLElement | null = null;
let reloading = false;

function autosave() { try { const g = (window as any).__gib; if (g?.world) Save.save(g.world); } catch { /* ignore */ } }

function showBanner(apply: () => void) {
  if (banner) return;
  banner = document.createElement('div'); banner.id = 'upd';
  banner.innerHTML = '<span>Nouvelle version disponible</span><button id="upd-go">Mettre à jour</button><button id="upd-later" class="ghost">Plus tard</button>';
  document.body.appendChild(banner);
  banner.querySelector<HTMLElement>('#upd-go')!.onclick = () => { autosave(); apply(); };
  banner.querySelector<HTMLElement>('#upd-later')!.onclick = () => { banner?.remove(); banner = null; setTimeout(() => (document.hidden ? 0 : check()), CHECK_MS); };
}
let check: () => void = () => {};

export function initPwa() {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;
  window.addEventListener('load', async () => {
    let reg: ServiceWorkerRegistration;
    try { reg = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }); } catch { return; }
    const apply = () => { const w = reg.waiting; if (w) w.postMessage('SKIP_WAITING'); else location.reload(); };
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloading) return; reloading = true; autosave(); location.reload(); });
    const watch = (w: ServiceWorker | null) => { if (!w) return; w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) showBanner(apply); }); };
    if (reg.waiting && navigator.serviceWorker.controller) showBanner(apply);
    reg.addEventListener('updatefound', () => watch(reg.installing));
    // Filet de sécurité : version.json comparé au build en cours (au cas où le navigateur tarde à voir le nouveau sw.js).
    check = () => {
      reg.update().catch(() => {});
      fetch('/version.json', { cache: 'no-store' }).then((r) => r.json()).then((v) => { if (v?.build && v.build !== BUILD && !reg.waiting && !reg.installing) reg.update().catch(() => {}); }).catch(() => {});
    };
    document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
    setInterval(() => { if (!document.hidden) check(); }, CHECK_MS);
    check();
  });
}
