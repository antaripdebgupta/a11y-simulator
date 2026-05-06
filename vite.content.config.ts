import { defineConfig } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { copyFileSync, mkdirSync, existsSync } from 'fs';
import type { Plugin } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const copyCssPlugin = (): Plugin => ({
  name: 'copy-content-css',
  apply: 'build',
  closeBundle() {
    const sourceCss = resolve(__dirname, 'src/content/styles/tab-order.css');
    const targetDir = resolve(__dirname, 'dist/content/styles');
    const targetCss = resolve(targetDir, 'tab-order.css');

    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true });
    }

    if (existsSync(sourceCss)) {
      copyFileSync(sourceCss, targetCss);
      console.log('✓ Copied tab-order.css to dist/content/styles/');
    }
  },
});

export default defineConfig({
  publicDir: false,
  plugins: [copyCssPlugin()],

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
