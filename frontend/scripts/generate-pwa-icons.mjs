/**
 * Generate PWA icons from SVG logo
 *
 * Creates PNG icons at required sizes:
 * - 180x180 for apple-touch-icon
 * - 192x192 for PWA manifest
 * - 512x512 for PWA manifest (splash screens)
 */

import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

// Read SVG content
const svgPath = join(publicDir, 'logo.svg');
const svgContent = readFileSync(svgPath, 'utf-8');

// Icon sizes to generate
const sizes = [
  { size: 180, name: 'apple-touch-icon.png' },
  { size: 192, name: 'icon-192x192.png' },
  { size: 512, name: 'icon-512x512.png' },
];

// Add a dark background to the SVG for better visibility on light backgrounds
// The logo uses teal colors on transparent background
const svgWithBackground = svgContent.replace(
  '<svg ',
  '<svg style="background-color: #050508" '
);

async function generateIcons() {
  console.log('Generating PWA icons from logo.svg...\n');

  for (const { size, name } of sizes) {
    const outputPath = join(publicDir, name);

    await sharp(Buffer.from(svgWithBackground))
      .resize(size, size)
      .png()
      .toFile(outputPath);

    console.log(`  Created ${name} (${size}x${size})`);
  }

  console.log('\nDone! Icons generated in public/');
}

generateIcons().catch(console.error);
