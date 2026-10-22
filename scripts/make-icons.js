/**
 * Genera los íconos de la app a partir de la mascota (js/mascot.js).
 * Ejecutar con: node scripts/make-icons.js   (usa Playwright, que ya es devDependency)
 *
 * Crea:
 *   icons/icon.svg               favicon y manifest
 *   icons/icon-180.png           iPhone (apple-touch-icon)
 *   icons/icon-192.png           Android
 *   icons/icon-512.png           Android, pantalla de inicio
 *   icons/icon-maskable-512.png  Android con bordes recortados (deja margen alrededor)
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { mascotSVG } from '../js/mascot.js';

const BACKGROUND = '#ffa23a'; // el naranja del inicio

/**
 * La mascota sobre un cuadrado naranja.
 * @param {number} padding  margen alrededor de la mascota, de 0 a 50
 */
function iconSVG(padding) {
  const inner = mascotSVG('happy').replace('<svg viewBox="0 0 100 100" aria-hidden="true">', '').replace('</svg>', '');
  const scale = (100 - 2 * padding) / 100;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="${padding ? 0 : 22}" fill="${BACKGROUND}"/>
  <g transform="translate(${padding} ${padding}) scale(${scale})">${inner}</g>
</svg>
`;
}

await mkdir('icons', { recursive: true });
await writeFile('icons/icon.svg', iconSVG(6));

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [file, size, padding] of [
  ['icon-180.png', 180, 6],
  ['icon-192.png', 192, 6],
  ['icon-512.png', 512, 6],
  ['icon-maskable-512.png', 512, 16],
]) {
  await page.setViewportSize({ width: Number(size), height: Number(size) });
  await page.setContent(
    `<style>html,body{margin:0}svg{display:block;width:100vw;height:100vh}</style>${iconSVG(Number(padding))}`,
  );
  await page.screenshot({ path: `icons/${file}`, omitBackground: true });
}
await browser.close();
console.log('Íconos generados en icons/');
