import type { Plugin } from 'vite';
import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

/** Génère dist/sw.js (liste de précache + identifiant de build) et dist/version.json après chaque build. */
export function pwaPlugin(build: string): Plugin {
  let outDir = 'dist';
  const walk = (d: string): string[] => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
  return {
    name: 'gib-pwa', apply: 'build',
    configResolved(c) { outDir = c.build.outDir; },
    closeBundle() {
      const files = walk(outDir).map((p) => '/' + relative(outDir, p).replace(/\\/g, '/')).filter((p) => p !== '/sw.js' && p !== '/version.json');
      const precache = ['/', ...files.filter((p) => p !== '/index.html')];
      writeFileSync(join(outDir, 'version.json'), JSON.stringify({ build }));
      writeFileSync(join(outDir, 'sw.js'), SW.replace('__BUILD__', JSON.stringify(build)).replace('__PRECACHE__', JSON.stringify(precache)));
    },
  };
}

const SW = `/* GOD IS BORED — service worker (généré au build). Ne touche jamais au localStorage (les sauvegardes). */
const BUILD = __BUILD__;
const CACHE = 'gib-' + BUILD;
const PRECACHE = __PRECACHE__;
self.addEventListener('install', (e) => {
  // Pas de skipWaiting automatique : la nouvelle version attend que le joueur accepte (ou la prochaine ouverture) pour ne pas couper une partie.
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE.map((u) => new Request(u, { cache: 'reload' })))));
});
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('gib-') && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener('message', (e) => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('fetch', (e) => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url); if (url.origin !== location.origin) return;
  if (url.pathname === '/sw.js' || url.pathname === '/version.json') return; // toujours réseau
  if (req.mode === 'navigate') { // page : réseau d'abord (nouvelle version immédiate), cache si hors-ligne
    e.respondWith((async () => {
      try {
        const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 4000);
        const r = await fetch(req, { signal: ctl.signal, cache: 'no-cache' }); clearTimeout(t);
        if (r.ok) { const c = await caches.open(CACHE); c.put('/', r.clone()); }
        return r;
      } catch { return (await caches.match('/')) || Response.error(); }
    })()); return;
  }
  if (url.pathname.startsWith('/assets/')) { // fichiers au nom haché : jamais périmés, cache d'abord
    e.respondWith((async () => {
      const hit = await caches.match(req); if (hit) return hit;
      const r = await fetch(req); if (r.ok) (await caches.open(CACHE)).put(req, r.clone()); return r;
    })()); return;
  }
  e.respondWith((async () => { // icônes, manifest : cache puis rafraîchissement en arrière-plan
    const hit = await caches.match(req);
    const net = fetch(req).then(async (r) => { if (r.ok) (await caches.open(CACHE)).put(req, r.clone()); return r; }).catch(() => null);
    return hit || (await net) || Response.error();
  })());
});
`;
