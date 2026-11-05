import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
// Build autonome : un seul fichier HTML (dist-single/index.html), jouable sans serveur.
export default defineConfig({ plugins: [viteSingleFile()], build: { outDir: 'dist-single', target: 'es2022', chunkSizeWarningLimit: 4000 } });
