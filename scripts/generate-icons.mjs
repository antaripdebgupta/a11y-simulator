/**
 * Generates PNG extension icons from the LogoIcon SVG at 16, 32, 48, and 128 px.
 * Run once: node scripts/generate-icons.mjs
 */
import sharp from 'sharp';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '../public/icons');

mkdirSync(OUT_DIR, { recursive: true });

// The LogoIcon SVG – keep in sync with src/popup/Popup.tsx LogoIcon
const svgTemplate = (size) => `
<svg width="${size}" height="${size}" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="28" height="28" rx="6" fill="#1d4ed8"/>
  <circle cx="14" cy="9" r="2.5" fill="white"/>
  <path d="M8 15.5c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="white" stroke-width="1.8" stroke-linecap="round"/>
  <path d="M14 15.5v-3" stroke="white" stroke-width="1.8" stroke-linecap="round"/>
  <path d="M11.5 19.5h5" stroke="white" stroke-width="1.8" stroke-linecap="round"/>
</svg>`.trim();

const SIZES = [16, 32, 48, 128];

for (const size of SIZES) {
  const svg = svgTemplate(size);
  const outPath = join(OUT_DIR, `icon${size}.png`);
  await sharp(svg).resize(size, size).png().toFile(outPath);
  console.log(`✓ ${outPath}`);
}

console.log('Icons generated successfully.');
