/**
 * Sin internet: después de una visita, el service worker abre el juego igual.
 * También verifica que la página publicada no pida nada a otros sitios.
 */

import { test, expect } from './fixtures.js';

test.use({ serviceWorkers: 'allow' });

test('Ninguna petición sale del propio sitio', async ({ page }) => {
  /** @type {string[]} */
  const external = [];
  page.on('request', (request) => {
    if (!request.url().startsWith('http://localhost:')) external.push(request.url());
  });
  await page.goto('/');
  await page.locator('[data-operation="sumar"]').click();
  await expect(page.locator('#screen-game')).toBeVisible();
  expect(external).toEqual([]);
});

test('Con el service worker activo, el juego abre sin internet', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload(); // la segunda carga ya pasa por el service worker
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });

  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#screen-home')).toBeVisible();
  await page.locator('[data-operation="contar"]').click();
  await expect(page.locator('#screen-game')).toBeVisible();
  await context.setOffline(false);
});
