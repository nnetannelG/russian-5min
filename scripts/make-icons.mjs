// Renders the PWA icons from SVG. Run: npm run icons
import sharp from 'sharp';
import fs from 'node:fs';

const icon = (scale) => fs.readFileSync('public/icons/icon.svg', 'utf8').replace(/scale\([\d.]+\)/, `scale(${scale})`);

const jobs = [
  ['icon-192.png', 192, 1.12],
  ['icon-512.png', 512, 1.12],
  // Maskable icons get cropped to a circle or squircle, so the artwork stays inside the safe zone.
  ['icon-maskable-512.png', 512, 0.86],
];
for (const [name, size, scale] of jobs) {
  await sharp(Buffer.from(icon(scale)), { density: 300 }).resize(size, size).png().toFile('public/icons/' + name);
  console.log('wrote', name);
}
