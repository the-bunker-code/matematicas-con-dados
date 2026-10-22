/**
 * Pruebas de game.js: el flujo que vive el niño (ayuda, aviso de cierre, final).
 *
 * Cómo se aísla el navegador, sin cambiar game.js:
 *   - speechSynthesis: un stub que anota cada frase en `spoken` y termina enseguida.
 *   - localStorage: uno en memoria (tests/helpers.js).
 *   - setTimeout: los temporizadores simulados de node:test. Así una sesión
 *     entera (con sus esperas de 700 ms, 2,8 s y 4 s) corre en milisegundos.
 * Web Audio no se simula: sin AudioContext, playTone() no hace nada.
 */

import { test, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { defaultSettings, TIMING } from '../js/config.js';
import { createMemoryStorage, useStorage } from './helpers.js';

/** Frases que dijo la voz, en orden. */
const spoken = /** @type {string[]} */ ([]);

// Los stubs tienen que existir ANTES de importar game.js, porque audio.js
// revisa al cargarse si hay speechSynthesis.
Object.assign(globalThis, {
  window: globalThis,
  SpeechSynthesisUtterance: class {
    /** @param {string} text */
    constructor(text) {
      this.text = text;
      /** @type {null | (() => void)} */
      this.onend = null;
    }
  },
  speechSynthesis: {
    getVoices: () => [],
    addEventListener: () => {},
    cancel: () => {},
    /** @param {{ text: string, onend: null | (() => void) }} utterance */
    speak(utterance) {
      spoken.push(utterance.text);
      queueMicrotask(() => utterance.onend?.());
    },
  },
});
useStorage(createMemoryStorage());

const game = await import('../js/game.js');
const { state } = game;

/** Deja correr las promesas pendientes (await say(), await wait()). */
const flush = () => new Promise((resolve) => setImmediate(resolve));

/**
 * Avanza el reloj simulado de a poco, dejando correr las promesas en cada paso.
 * @param {number} ms
 */
async function advance(ms) {
  for (let elapsed = 0; elapsed < ms; elapsed += 50) {
    mock.timers.tick(50);
    await flush();
  }
}

/** @param {Partial<import('../js/config.js').Settings>} changes */
function startWith(changes) {
  game.goHome();
  game.init({ ...defaultSettings(), ...changes });
  game.startSession();
}

const answer = () => /** @type {import('../js/rules.js').Round} */ (state.round).answer;
const wrongAnswer = () => /** @type {number} */ (state.answerOptions.find((value) => value !== answer()));

beforeEach(() => {
  mock.timers.enable({ apis: ['setTimeout'] });
  spoken.length = 0;
});
afterEach(() => mock.timers.reset());

test('Al equivocarse: la app ayuda, nunca dice "no" y la respuesta correcta late', async () => {
  startWith({ operation: 'contar', dice: 1, rounds: 5 });
  assert.equal(state.mood, 'idle', 'la mascota empieza tranquila');

  game.chooseAnswer(wrongAnswer());
  assert.equal(state.phase, 'helping');
  assert.equal(state.mood, 'think', 'la mascota piensa mientras ayuda');
  assert.equal(state.wrongCount, 1);

  await advance(15000);
  assert.equal(state.phase, 'play', 'vuelve a dejar tocar');
  assert.equal(state.pulsingAnswer, answer(), 'la respuesta correcta late');
  for (const phrase of spoken) {
    assert.doesNotMatch(phrase, /\bno\b/i, `frase con "no": ${phrase}`);
  }
});

test('Al acertar: la mascota se pone contenta y pasa a la siguiente ronda', async () => {
  startWith({ operation: 'sumar', dice: 2, rounds: 5 });
  const firstKey = state.round?.key;
  game.chooseAnswer(answer());
  assert.equal(state.phase, 'solved');
  assert.equal(state.mood, 'happy');
  assert.ok(spoken.at(-1)?.startsWith('Sí.'));

  await advance(TIMING.nextRoundDelay + 100);
  assert.equal(state.roundNumber, 1);
  assert.equal(state.phase, 'play');
  assert.notEqual(state.round?.key, firstKey);
});

test('Aviso de cierre: "Dos más y guardamos" y "La última y guardamos"', async () => {
  startWith({ operation: 'contar', dice: 1, rounds: 3 });
  game.chooseAnswer(answer());
  await advance(TIMING.nextRoundDelay + 100);
  assert.ok(spoken.at(-1)?.startsWith('Dos más y guardamos.'), spoken.at(-1));

  game.chooseAnswer(answer());
  await advance(TIMING.nextRoundDelay + 100);
  assert.ok(spoken.at(-1)?.startsWith('La última y guardamos.'), spoken.at(-1));
});

test('Sesión entera: la pantalla final y sus botones a los 4 segundos', async () => {
  startWith({ operation: 'contar', dice: 1, rounds: 3 });
  for (let i = 0; i < 3; i++) {
    game.chooseAnswer(answer());
    await advance(TIMING.nextRoundDelay + 100);
  }
  assert.equal(state.screen, 'end');
  assert.equal(state.endButtonsVisible, false, 'los botones todavía no aparecen');

  await advance(TIMING.endButtonsDelay - 500);
  assert.equal(state.endButtonsVisible, false);
  await advance(600);
  assert.equal(state.endButtonsVisible, true);
});

test('Volver al inicio a mitad de la ayuda la cancela: no quedan voces sueltas', async () => {
  startWith({ operation: 'contar', dice: 1, rounds: 5 });
  game.chooseAnswer(wrongAnswer());
  await advance(500);
  game.goHome();
  const spokenAtHome = spoken.length;

  await advance(15000);
  assert.equal(state.screen, 'home');
  assert.equal(spoken.length, spokenAtHome, 'nada habló después de volver al inicio');
  assert.equal(state.pulsingAnswer, null);
});

test('Dividir: repartir tocando el montón deja los platos iguales', async () => {
  startWith({ operation: 'dividir', dice: 2, rounds: 5 });
  while (state.pile.length > 0) game.tapPile();
  await advance(10000);
  assert.equal(state.distributed, true);
  const sizes = state.plates.map((plate) => plate.length);
  assert.ok(
    sizes.every((size) => size === answer()),
    `platos: ${sizes}`,
  );
});

test('Datos inválidos que llegan del HTML se ignoran sin romper el juego', () => {
  startWith({ operation: 'dividir', dice: 2, rounds: 5 });
  assert.doesNotThrow(() => game.tapPlate(Number('nada')));
  assert.doesNotThrow(() => game.tapPlate(99));
  assert.doesNotThrow(() => game.tapCap(undefined));

  const before = state.settings.operation;
  game.startOperation('toString');
  assert.equal(state.settings.operation, before);

  game.setPreferredLevel(9);
  assert.notEqual(state.settings.preferredLevel, 9);
});
