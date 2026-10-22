/**
 * Las 5 operaciones en todos sus niveles: se puede jugar y acertar una ronda,
 * y cada operación mantiene siempre su color (el ancla visual del niño).
 */

import { test, expect, solveRound, startOperation, gameState } from './fixtures.js';

/** Color principal de cada operación (config.js). No debe cambiar nunca. */
const THEME_MAIN = {
  contar: '#4f8ef7',
  sumar: '#ff7a4d',
  restar: '#ff5d8f',
  multiplicar: '#a77bff',
  dividir: '#5fbf3f',
};

/** [operación, nivel]. El nivel es el botón del inicio: 2 Principiante, 3 Intermedio, 4 Avanzado. */
const CASES = [
  ['contar', 2],
  ['contar', 3],
  ['contar', 4],
  ['sumar', 2],
  ['sumar', 3],
  ['sumar', 4],
  ['restar', 2],
  ['restar', 3],
  ['restar', 4],
  ['multiplicar', 2],
  ['multiplicar', 3],
  ['dividir', 2],
];

for (const [operation, level] of CASES) {
  test(`${operation} · nivel ${level}: se juega y se acierta`, async ({ page }) => {
    await page.goto('/');
    await startOperation(page, String(operation), Number(level));

    const main = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--theme-main'));
    expect(main.trim()).toBe(THEME_MAIN[/** @type {keyof typeof THEME_MAIN} */ (operation)]);
    await expect(page.locator('#dice-row .die').first()).toBeVisible();
    // Contar: Principiante 2 dados, Intermedio 3, Avanzado 4, y un solo montón de tapitas.
    if (operation === 'contar') {
      await expect(page.locator('#dice-row .die')).toHaveCount(Number(level));
      await expect(page.locator('#table-content .cap-group')).toHaveCount(1);
    }

    await solveRound(page);
    expect((await gameState(page)).roundNumber).toBe(1);
    // Ningún botón dentro de otro botón (HTML inválido y confuso para lectores de pantalla).
    await expect(page.locator('button button, [role="button"] [role="button"]')).toHaveCount(0);
  });
}
