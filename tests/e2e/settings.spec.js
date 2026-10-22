/**
 * Panel de ajustes: guardar, cancelar, foco y caja vacía.
 */

import { test, expect, gameState, STORAGE_KEY } from './fixtures.js';

/** @param {import('@playwright/test').Page} page */
const savedSettings = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null'), STORAGE_KEY);

test('Cancelar no cambia nada y devuelve el foco a la tuerca', async ({ page }) => {
  await page.goto('/');
  const gear = page.locator('#screen-home [data-action="open-settings"]');
  await gear.click();
  await expect(page.locator('#settings-dialog')).toBeVisible();

  await page.locator('label.pill', { hasText: /^\s*8\s*$/ }).click();
  await page.locator('#settings-cancel').click();

  await expect(page.locator('#settings-dialog')).toBeHidden();
  await expect(gear).toBeFocused();
  expect((await gameState(page)).rounds).toBe(5);
  expect(await savedSettings(page)).toBeNull();
});

test('Guardar aplica los ajustes, los recuerda y empieza a jugar', async ({ page }) => {
  await page.goto('/');
  await page.locator('#screen-home [data-action="open-settings"]').click();
  await page.locator('label.pill', { hasText: 'Sumar' }).click();
  await page.locator('label.pill', { hasText: /^\s*8\s*$/ }).click();
  await page.locator('#settings-save').click();

  await expect(page.locator('#screen-game')).toBeVisible();
  await expect(page.locator('#progress-text')).toHaveText('0 / 8');
  const saved = await savedSettings(page);
  expect(saved.rounds).toBe(8);
  expect(saved.operation).toBe('sumar');

  await page.reload();
  expect((await gameState(page)).rounds).toBe(8);
});

test('Con la caja vacía no se puede guardar', async ({ page }) => {
  await page.goto('/');
  await page.locator('#screen-home [data-action="open-settings"]').click();
  const save = page.locator('#settings-save');
  await expect(save).toBeEnabled();

  // Vaciar la caja color por color.
  for (const stepper of await page.locator('[data-settings-action="decrease"]').all()) {
    const color = await stepper.getAttribute('data-color');
    const decrease = page.locator(`[data-settings-action="decrease"][data-color="${color}"]`);
    while ((await decrease.locator('xpath=following-sibling::output[1]').textContent()) !== '0') await decrease.click();
  }
  await expect(save).toBeDisabled();
  await expect(page.locator('.settings-warning')).toBeVisible();

  await page.locator('[data-settings-action="increase"][data-color="green"]').click();
  await expect(save).toBeEnabled();
});

test('Cerrar los ajustes a mitad de una ronda vuelve al inicio', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-operation="contar"]').click();
  await page.locator('#screen-game [data-action="open-settings"]').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#screen-home')).toBeVisible();
  await expect(page.locator('#home-title')).toBeFocused();
});
