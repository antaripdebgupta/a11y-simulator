import { defineConfig } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  publicDir: false,

  build: {
    outDir: 'dist',
    emptyOutDir: false,

    rollupOptions: {
      input: resolve(__dirname, 'src/content/index.ts'),

      output: {
        format: 'iife',
        inlineDynamicImports: true,
        entryFileNames: 'content/index.js',
      },
    },
  },

  base: './',
});
