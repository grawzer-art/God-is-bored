import { defineConfig } from 'vite';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { pwaPlugin } from './tools/pwa-plugin';

// Identifiant de build : commit git (ou celui fourni par Vercel) + date. Change à chaque déploiement.
const sha = (process.env.VERCEL_GIT_COMMIT_SHA ?? (() => { try { return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return 'local'; } })()).slice(0, 7);
const BUILD = `${sha}-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')}`;

// Origines autorisées pour le serveur de dev (CORS + WebSocket de rechargement à chaud) :
// localhost, les réseaux privés (Wi-Fi maison), les noms .local (Bonjour) et les propres adresses de cette machine.
const own = Object.values(os.networkInterfaces()).flat().filter((n) => n && n.family === 'IPv4').map((n) => n!.address.replace(/\./g, '\\.'));
const origin = new RegExp(`^https?://(localhost|127\\.0\\.0\\.1|\\[::1\\]|10\\.\\d+\\.\\d+\\.\\d+|192\\.168\\.\\d+\\.\\d+|172\\.(1[6-9]|2\\d|3[01])\\.\\d+\\.\\d+|[a-zA-Z0-9-]+\\.local${own.length ? '|' + own.join('|') : ''})(:\\d+)?$`);

export default defineConfig({
  define: { __BUILD__: JSON.stringify(BUILD) },
  plugins: [pwaPlugin(BUILD)],
  server: { host: '0.0.0.0', port: 5173, strictPort: true, allowedHosts: true, cors: { origin }, hmr: { overlay: true } },
  preview: { host: '0.0.0.0', port: 4173, allowedHosts: true },
  build: { target: 'es2022', chunkSizeWarningLimit: 2000 },
});
