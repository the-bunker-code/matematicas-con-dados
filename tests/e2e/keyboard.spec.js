/**
 * Uso solo con teclado: el foco nunca se pierde al redibujar y todo se puede activar.
 */

import { test, expect, gameState } from './fixtures.js';

/**
 * Presiona Tab hasta llegar a un elemento que cumpla el selector.
 * @param {import('@playwright/test').Page} page
 * @param {string} selector
 */
async function tabTo(page, selector) {
  for (let i = 0; i < 80; i++) {
    await page.keyboard.press('Tab');
    if (await page.evaluate((s) => document.activeElement?.matches(s) ?? false, selector)) return;
  }
  throw new Error(`Tab nunca llegó a ${selector}`);
}

/** @param {import('@playwright/test').Page} page */
const focusedAttribute = (page, /** @type {string} */ name) =>
  page.evaluate((n) => document.activeElement?.getAttribute(n) ?? null, name);

test('Contar con teclado: elegir, contar tapitas y responder sin perder el foco', async ({ page }) => {
  await page.goto('/');
  await tabTo(page, '[data-operation="contar"]');
  await page.keyboard.press('Enter');
  await expect(page.locator('#screen-game')).toBeVisible();
  await expect(page.locator('#prompt')).toBeFocused();

  await tabTo(page, '[data-action="tap-cap"]');
  const cap = await focusedAttribute(page, 'data-cap');
  await page.keyboard.press('Enter');
  expect((await gameState(page)).counted).toBe(1);
  expect(await focusedAttribute(page, 'data-cap'), 'el foco sigue en la misma tapita').toBe(cap);

  await page.keyboard.press(' ');
  expect((await gameState(page)).counted, 'Espacio repite el número, no cuenta otra').toBe(1);

  const { answer } = await gameState(page);
  await tabTo(page, `[data-action="choose-answer"][data-value="${answer}"]`);
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await gameState(page)).phase).toBe('solved');
});

test('Dividir con teclado: repartir con el montón y contar las tapitas de un plato', async ({ page }) => {
  await page.goto('/');
  await tabTo(page, '[data-operation="dividir"]');
  await page.keyboard.press('Enter');

  await tabTo(page, '[data-action="tap-pile"]');
  while (!(await gameState(page)).distributed && (await page.locator('[data-action="tap-pile"]').count()) > 0) {
    // Después de cada toque el foco pasa a otra tapita del montón.
    await page.keyboard.press('Enter');
  }
  await expect.poll(async () => (await gameState(page)).distributed, { timeout: 20_000 }).toBe(true);

  // Antes de la corrección, Enter sobre una tapita dentro de un plato no contaba.
  await page.locator('.plate .cap').first().focus();
  await page.keyboard.press('Enter');
  expect((await gameState(page)).counted).toBe(1);
  await expect(page.locator('.plate .cap').first()).toBeFocused();
});

test('Ajustes con teclado: el foco queda en el panel al cambiar opciones', async ({ page }) => {
  await page.goto('/');
  await tabTo(page, '#screen-home [data-action="open-settings"]');
  await page.keyboard.press('Enter');
  await expect(page.locator('#settings-dialog')).toBeVisible();

  await tabTo(page, 'input[name="faces"]');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('input[name="faces"][value="6"]')).toBeFocused();

  await tabTo(page, '[data-settings-action="increase"][data-color="blue"]');
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-settings-action="increase"][data-color="blue"]')).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(page.locator('#screen-home [data-action="open-settings"]')).toBeFocused();
});

test('Los botones del final no se pueden enfocar mientras están ocultos', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    // @ts-expect-error: es una URL del navegador (corre dentro de la página), no un archivo que TypeScript pueda abrir.
    const game = await import('/js/game.js');
    game.init({ ...game.state.settings, rounds: 3 });
  });
  await page.locator('[data-operation="contar"]').click();
  for (let i = 0; i < 3; i++) {
    const { answer, roundNumber } = await gameState(page);
    await page.locator(`[data-action="choose-answer"][data-value="${answer}"]`).click();
    await expect
      .poll(async () => {
        const s = await gameState(page);
        return s.screen === 'end' || s.roundNumber > roundNumber;
      })
      .toBe(true);
    if (i < 2) await expect.poll(async () => (await gameState(page)).phase, { timeout: 10_000 }).toBe('play');
  }
  await expect(page.locator('#screen-end')).toBeVisible({ timeout: 10_000 });
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement?.closest('#end-buttons') === null)).toBe(true);
  }
});
