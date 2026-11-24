import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const here = fileURLToPath(new URL('.', import.meta.url));
const web = resolve(here, 'web');

export default defineConfig({
  root: web,
  publicDir: false,
  resolve: {
    alias: {
      // Formate importieren Kern-Helfer über '@core/...'
      '@core': resolve(web, 'core'),
    },
  },
  build: {
    target: 'es2022',
    outDir: resolve(here, 'dist'),
    emptyOutDir: true,
    assetsInlineLimit: 0,
    rollupOptions: {
      input: {
        index: resolve(web, 'index.html'),
        screen: resolve(web, 'screen/index.html'),
        host: resolve(web, 'host/index.html'),
      },
    },
  },
  server: {
    fs: { allow: [here] },
  },
});
