/**
 * Pruebas de spanish.js: números y frases que dice la voz.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { numberWord, feminineNumber, joinWithAnd, capitalize } from '../js/spanish.js';
import { escapeHTML } from '../js/dom.js';

test('numberWord: en palabras hasta el doce, cifras desde el 13', () => {
  assert.equal(numberWord(0), 'cero');
  assert.equal(numberWord(3), 'tres');
  assert.equal(numberWord(12), 'doce');
  assert.equal(numberWord(13), '13');
  assert.equal(numberWord(-1), '-1');
});

test('feminineNumber: "una" tapita, no "uno"', () => {
  assert.equal(feminineNumber(1), 'una');
  assert.equal(feminineNumber(2), 'dos');
});

test('joinWithAnd: listas de 0, 1, 2 y 3 elementos', () => {
  assert.equal(joinWithAnd([]), '');
  assert.equal(joinWithAnd(['a']), 'a');
  assert.equal(joinWithAnd(['a', 'b']), 'a y b');
  assert.equal(joinWithAnd(['a', 'b', 'c']), 'a, b y c');
});

test('capitalize: primera letra en mayúscula', () => {
  assert.equal(capitalize('dos platos'), 'Dos platos');
  assert.equal(capitalize(''), '');
});

test('escapeHTML: un texto nunca se convierte en etiquetas ni cierra un atributo', () => {
  assert.equal(escapeHTML('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
  assert.equal(escapeHTML("Tapita d'oro & más"), 'Tapita d&#39;oro &amp; más');
  assert.equal(escapeHTML(5), '5');
});
