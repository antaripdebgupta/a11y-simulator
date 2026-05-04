import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve, join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { Plugin } from 'vite';
import { renameSync, existsSync, mkdirSync, rmSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const moveHtmlPlugin = (): Plugin => ({
  name: 'move-html',
  apply: 'build',
  closeBundle() {
    const distPath = resolve(__dirname, 'dist');
    const srcPath = join(distPath, 'src');

    if (existsSync(srcPath)) {
      const popupHtml = join(srcPath, 'popup', 'index.html');
      const sidepanelHtml = join(srcPath, 'sidepanel', 'index.html');

      if (existsSync(popupHtml)) {
        const targetPopup = join(distPath, 'popup');
        if (!existsSync(targetPopup)) {
          mkdirSync(targetPopup, { recursive: true });
        }
        renameSync(popupHtml, join(targetPopup, 'index.html'));
      }

      if (existsSync(sidepanelHtml)) {
        const targetSidepanel = join(distPath, 'sidepanel');
        if (!existsSync(targetSidepanel)) {
          mkdirSync(targetSidepanel, { recursive: true });
        }
        renameSync(sidepanelHtml, join(targetSidepanel, 'index.html'));
      }

      rmSync(srcPath, { recursive: true, force: true });
    }
  },
});

export default defineConfig({
  plugins: [react(), moveHtmlPlugin()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/index.html'),
        sidepanel: resolve(__dirname, 'src/sidepanel/index.html'),
        background: resolve(__dirname, 'src/background/index.ts'),
        content: resolve(__dirname, 'src/content/index.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          const name = chunkInfo.name;
          if (name === 'background' || name === 'content') {
            return `${name}/index.js`;
          }
          return `${name}/[name].js`;
        },
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const name = assetInfo.name || '';
          if (name.endsWith('.css')) {
            return '[name]/[name][extname]';
          }
          return 'assets/[name][extname]';
        },
      },
    },
  },
  publicDir: 'public',
  base: './',
});
