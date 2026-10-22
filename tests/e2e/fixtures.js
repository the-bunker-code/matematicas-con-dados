/**
 * Base común de los recorridos con Playwright.
 *
 * - La voz se reemplaza por un stub que anota cada frase en window.__spoken
 *   y termina enseguida. Así las pruebas pueden revisar qué dijo la app.
 * - Cualquier error o advertencia en la consola hace fallar la prueba.
 */

import { test as base, expect } from '@playwright/test';

export const STORAGE_KEY = 'matematica-con-dados:v1';

export const test = base.extend({
  page: async ({ page }, use) => {
    /** @type {string[]} */
    const consoleProblems = [];
    page.on('console', (message) => {
      // Este aviso lo escribe Playwright cuando bloquea el service worker (ver playwright.config.js).
      if (message.text() === 'Service Worker registration blocked by Playwright') return;
      if (message.type() === 'error' || message.type() === 'warning') consoleProblems.push(message.text());
    });
    page.on('pageerror', (error) => consoleProblems.push(error.message));

    await page.addInitScript(() => {
      const spoken = /** @type {string[]} */ ([]);
      Object.defineProperty(window, '__spoken', { value: spoken });
      Object.defineProperty(window, 'speechSynthesis', {
        configurable: true,
        value: {
          getVoices: () => [],
          addEventListener: () => {},
          cancel: () => {},
          /** @param {SpeechSynthesisUtterance} utterance */
          speak(utterance) {
            spoken.push(utterance.text);
            setTimeout(() => utterance.onend?.(/** @type {any} */ ({})), 30);
          },
        },
      });
    });

    await use(page);
    expect(consoleProblems, 'consola sin errores ni advertencias').toEqual([]);
  },
});

export { expect };

/**
 * Lee el estado del juego desde el propio módulo (mismo objeto que usa la página).
 * @param {import('@playwright/test').Page} page
 */
export async function gameState(page) {
  return page.evaluate(async () => {
    // @ts-expect-error: es una URL del navegador (corre dentro de la página), no un archivo que TypeScript pueda abrir.
    const { state } = await import('/js/game.js');
    return {
      screen: state.screen,
      phase: state.phase,
      mood: state.mood,
      answer: state.round?.answer ?? null,
      operation: state.round?.operation ?? null,
      roundNumber: state.roundNumber,
      distributed: state.distributed,
      rounds: state.settings.rounds,
      counted: state.countedCaps.size,
    };
  });
}

/** @param {import('@playwright/test').Page} page */
export const spoken = (page) => page.evaluate(() => /** @type {any} */ (window).__spoken.slice());

/**
 * Guarda ajustes antes de cargar la página, como si el adulto ya los hubiera elegido.
 * @param {import('@playwright/test').Page} page
 * @param {Record<string, unknown>} settings
 */
export async function presetSettings(page, settings) {
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [STORAGE_KEY, JSON.stringify(settings)]);
}

/**
 * Elige nivel y operación desde el inicio.
 * @param {import('@playwright/test').Page} page
 * @param {string} operation
 * @param {number} [level]
 */
export async function startOperation(page, operation, level = 2) {
  await page.locator(`[data-action="set-level"][data-level="${level}"]`).click();
  await page.locator(`[data-operation="${operation}"]`).click();
  await expect(page.locator('#screen-game')).toBeVisible();
}

/**
 * Dividir en pantalla: toca el montón hasta repartir todo y espera a que se igualen los platos.
 * @param {import('@playwright/test').Page} page
 */
export async function distributeAll(page) {
  const pile = page.locator('[data-action="tap-pile"]');
  while ((await pile.count()) > 0) await pile.first().click();
  await expect(page.locator('#answers')).toBeVisible({ timeout: 20_000 });
}

/**
 * Responde bien la ronda actual y espera a que empiece la siguiente (o el final).
 * @param {import('@playwright/test').Page} page
 */
export async function solveRound(page) {
  const before = await gameState(page);
  if (before.operation === 'dividir' && !before.distributed) await distributeAll(page);
  await page.locator(`[data-action="choose-answer"][data-value="${before.answer}"]`).click();
  await expect.poll(async () => (await gameState(page)).phase).toBe('solved');
  await expect
    .poll(
      async () => {
        const now = await gameState(page);
        return now.screen === 'end' || (now.phase === 'play' && now.roundNumber === before.roundNumber + 1);
      },
      { timeout: 10_000 },
    )
    .toBe(true);
}
