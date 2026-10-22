/**
 * La experiencia del niño que no se puede romper:
 * ayuda sin "no", aviso de cierre, botones del final a los 4 s y la mascota.
 */

import { test, expect, gameState, presetSettings, solveRound, spoken, startOperation } from './fixtures.js';

test('Respuesta equivocada: ayuda completa, sin "no", y la correcta late', async ({ page }) => {
  await page.goto('/');
  await startOperation(page, 'sumar', 2);
  const { answer } = await gameState(page);
  const wrong = page.locator(`[data-action="choose-answer"]:not([data-value="${answer}"])`).first();
  await wrong.click();

  await expect.poll(async () => (await gameState(page)).mood).toBe('think');
  await expect(page.locator('.answer[aria-disabled="true"]')).toHaveCount(3); // mientras ayuda
  await expect(page.locator(`.answer.is-pulsing[data-value="${answer}"]`)).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.cap--counted')).toHaveCount(Number(answer));

  for (const phrase of await spoken(page)) expect(phrase).not.toMatch(/\bno\b/i);
});

test('Sesión entera: "dos más y guardamos" y la pantalla final con botones a los 4 s', async ({ page }) => {
  await presetSettings(page, { rounds: 3 });
  await page.goto('/');
  await startOperation(page, 'contar');
  await expect(page.locator('#progress')).toHaveAttribute('aria-valuemax', '3');

  await solveRound(page);
  expect((await spoken(page)).at(-1)).toMatch(/^Dos más y guardamos\./);
  await solveRound(page);
  expect((await spoken(page)).at(-1)).toMatch(/^La última y guardamos\./);
  await solveRound(page);

  await expect(page.locator('#screen-end')).toBeVisible();
  await expect(page.locator('#end-stars .icon')).toHaveCount(3);
  const buttons = page.locator('#end-buttons');
  await expect(buttons).toHaveJSProperty('inert', true);
  await page.waitForTimeout(3000);
  await expect(buttons).toHaveJSProperty('inert', true);
  await expect(buttons).toHaveJSProperty('inert', false, { timeout: 2000 });
  await expect(buttons).toHaveCSS('opacity', '1');

  await page.locator('[data-action="play-again"]').click();
  await expect(page.locator('#screen-game')).toBeVisible();
});

test('La mascota tiene sus 3 expresiones y siempre es la misma', async ({ page }) => {
  // Con "reducir movimiento" la respuesta correcta no late: Playwright solo hace
  // clic en elementos quietos. De paso verifica que la preferencia se respeta.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await startOperation(page, 'contar');
  const mascot = page.locator('#game-mascot svg polygon');
  await expect(mascot).toHaveAttribute('fill', '#d93b30');
  expect((await gameState(page)).mood).toBe('idle');

  const { answer } = await gameState(page);
  await page.locator(`[data-action="choose-answer"]:not([data-value="${answer}"])`).first().click();
  await expect.poll(async () => (await gameState(page)).mood).toBe('think');
  await expect(page.locator(`.answer.is-pulsing`)).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.answer.is-pulsing')).toHaveCSS('animation-name', 'none');

  await page.locator(`[data-action="choose-answer"][data-value="${answer}"]`).click();
  await expect.poll(async () => (await gameState(page)).mood).toBe('happy');
  await expect(mascot).toHaveAttribute('fill', '#d93b30');
});

test('Tapitas reales: la instrucción nunca pide más tapitas de las que hay', async ({ page }) => {
  // Caja de la foto, pero el dado 1 es negro y solo hay 1 negra.
  await presetSettings(page, { realCaps: true, diceColors: ['black', 'blue', 'green', 'red'] });
  await page.goto('/');
  await startOperation(page, 'restar', 2);
  await expect(page.locator('.real-caps p')).not.toContainText(/negras/);
});
