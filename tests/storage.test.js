/**
 * Pruebas de storage.js: lo que llega de localStorage no es confiable.
 * localStorage se reemplaza por uno en memoria (tests/helpers.js).
 */

import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { normalizeSettings, loadSettings, saveSettings, STORAGE_KEY } from '../js/storage.js';
import { defaultSettings, CAP_COLORS } from '../js/config.js';
import { createMemoryStorage, useStorage } from './helpers.js';

/** @type {() => void} */
let restore = () => {};
afterEach(() => restore());

test('Los ajustes guardados se corrigen si vienen mal', () => {
  const fixed = normalizeSettings({
    operation: 'volar', // no existe
    dice: 9,
    faces: 4, // solo 3 o 6
    rounds: 5,
    diceColors: ['red', 'morado'], // 'morado' no existe
    inventory: { yellow: 99, blue: -3 },
  });
  assert.equal(fixed.operation, 'contar');
  assert.equal(fixed.dice, 4); // Contar llega hasta 4 dados
  assert.equal(fixed.faces, 3);
  assert.deepEqual(fixed.diceColors, ['red', 'green', 'red', 'orange']);
  assert.equal(fixed.inventory.yellow, 50);
  assert.equal(fixed.inventory.blue, 0);
});

test('Un objeto v1 real, guardado por la versión 1.0.0, se lee igual', () => {
  // Copiado de localStorage después de jugar con la versión 1.0.0.
  const v1 = {
    operation: 'restar',
    dice: 3,
    preferredLevel: 3,
    faces: 6,
    rounds: 8,
    voice: false,
    sound: true,
    realCaps: true,
    diceColors: ['green', 'blue', 'red', 'orange'],
    inventory: {
      blue: 16,
      green: 11,
      white: 8,
      red: 7,
      orange: 6,
      yellow: 3,
      lightblue: 3,
      turquoise: 2,
      gray: 2,
      black: 1,
    },
  };
  assert.deepEqual(normalizeSettings(structuredClone(v1)), v1);
});

test('Claves heredadas del prototipo no pasan como operación', () => {
  for (const operation of ['toString', 'constructor', '__proto__', 'hasOwnProperty', 'valueOf']) {
    const fixed = normalizeSettings(JSON.parse(`{"operation":"${operation}","dice":2}`));
    assert.equal(fixed.operation, 'contar', operation);
    assert.equal(fixed.dice, 2, operation); // 2 dados es válido en Contar
  }
});

test('__proto__ dentro de la caja no contamina nada', () => {
  const fixed = normalizeSettings(JSON.parse('{"inventory":{"__proto__":{"polluted":true},"blue":5}}'));
  assert.equal(fixed.inventory.blue, 5);
  assert.equal(Object.keys(fixed.inventory).length, CAP_COLORS.length);
  assert.equal(/** @type {any} */ ({}).polluted, undefined);
});

test('Tipos equivocados se descartan', () => {
  const fixed = normalizeSettings({
    operation: ['sumar'],
    dice: '3',
    preferredLevel: 7,
    rounds: '8',
    voice: 'false',
    realCaps: 1,
    diceColors: 'blue',
    inventory: [1, 2, 3],
  });
  assert.deepEqual(fixed, defaultSettings());
});

test('Valores que no son objetos devuelven los ajustes por defecto', () => {
  for (const raw of [null, undefined, 42, 'texto', [], true]) {
    assert.deepEqual(normalizeSettings(raw), defaultSettings());
  }
});

test('Un dado con un color sin tapitas toma el color que más hay', () => {
  const inventory = Object.fromEntries(CAP_COLORS.map((c) => [c.id, 0]));
  inventory.blue = 4;
  inventory.red = 9;
  const fixed = normalizeSettings({ diceColors: ['black', 'blue', 'green', 'red'], inventory });
  assert.deepEqual(fixed.diceColors, ['red', 'blue', 'red', 'red']);
});

test('Con la caja vacía no se puede jugar con tapitas reales', () => {
  const inventory = Object.fromEntries(CAP_COLORS.map((c) => [c.id, 0]));
  const fixed = normalizeSettings({ realCaps: true, inventory });
  assert.equal(fixed.realCaps, false);
});

test('saveSettings y loadSettings: lo guardado se vuelve a leer igual', () => {
  restore = useStorage(createMemoryStorage());
  const settings = {
    ...defaultSettings(),
    operation: /** @type {const} */ ('sumar'),
    dice: 3,
    rounds: /** @type {const} */ (8),
  };
  saveSettings(settings);
  assert.deepEqual(loadSettings(), settings);
});

test('loadSettings sin nada guardado devuelve los valores por defecto', () => {
  restore = useStorage(createMemoryStorage());
  assert.deepEqual(loadSettings(), defaultSettings());
});

test('loadSettings con JSON roto no rompe el juego', () => {
  const storage = createMemoryStorage();
  storage.setItem(STORAGE_KEY, '{"operation": "sumar",');
  restore = useStorage(storage);
  assert.deepEqual(loadSettings(), defaultSettings());
});

test('Si el navegador no deja usar localStorage, el juego sigue', () => {
  restore = useStorage(createMemoryStorage({ failing: true }));
  assert.doesNotThrow(() => saveSettings(defaultSettings()));
  assert.deepEqual(loadSettings(), defaultSettings());
});
