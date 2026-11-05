import { defineConfig } from 'vite';

// Serveur de dev : accessible depuis le Mac (localhost) ET l'iPhone (réseau local) grâce à host 0.0.0.0.
export default defineConfig({
  server: { host: '0.0.0.0', port: 5173, strictPort: true, allowedHosts: true, hmr: { overlay: true } },
  preview: { host: '0.0.0.0', port: 4173, allowedHosts: true },
  build: { target: 'es2022', chunkSizeWarningLimit: 2000 },
});
