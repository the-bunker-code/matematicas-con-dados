/**
 * Pruebas de las reglas del juego.
 * Ejecutar con:  npm test   (o: node --test)
 *
 * Como rules.js es lógica pura, no hace falta navegador.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { OPERATIONS, CAP_COLORS, defaultSettings, totalCaps, clampDice, diceForLevel } from '../js/config.js';
import {
  createRound,
  makeAnswerOptions,
  fitsInBox,
  countCapsByColor,
  adultInstruction,
  resultPhrase,
  capCount,
} from '../js/rules.js';
import { seededRandom } from './helpers.js';

/** @typedef {import('../js/config.js').Settings} Settings */
/** @typedef {import('../js/config.js').OperationId} OperationId */

/** @param {number[]} list */
const sum = (list) => list.reduce((a, b) => a + b, 0);

/**
 * Ajustes por defecto con algunos cambios.
 * @param {Partial<Settings>} changes
 * @returns {Settings}
 */
const settingsWith = (changes) => ({ ...defaultSettings(), ...changes });

/** Una caja con 0 tapitas de cada color, para armar cajas de prueba. */
const emptyBox = () => Object.fromEntries(CAP_COLORS.map((c) => [c.id, 0]));

/**
 * Lo que debe decir la pantalla: "4 menos 2 es igual a…".
 * @param {number[]} numbers
 * @param {string} word
 */
const phrase = (numbers, word) => `${numbers.join(` ${word} `)} es igual a…`;

const OPERATION_IDS = /** @type {OperationId[]} */ (Object.keys(OPERATIONS));

for (const operation of OPERATION_IDS) {
  const info = OPERATIONS[operation];
  for (let dice = info.minDice; dice <= info.maxDice; dice++) {
    for (const faces of /** @type {const} */ ([3, 6])) {
      for (const realCaps of [false, true]) {
        test(`${operation} · ${dice} dados · caras 1-${faces} · ${realCaps ? 'tapitas reales' : 'en pantalla'}`, () => {
          const settings = settingsWith({ operation, dice, faces, realCaps });
          const random = seededRandom();
          let previousKey = '';

          for (let i = 0; i < 300; i++) {
            const round = createRound(settings, { previousKey, random });
            const used = sum(Object.values(countCapsByColor(round)));

            assert.ok(round.answer >= 0, 'la respuesta nunca es negativa');
            assert.ok(
              round.dice.every((d) => d.value >= 1 && d.value <= 6),
              'cada dado va de 1 a 6',
            );
            assert.equal(round.dice.length, operation === 'dividir' ? 1 : dice, 'cantidad de dados');
            assert.notEqual(round.key, previousKey, 'no repite la tirada anterior');
            if (realCaps) assert.ok(fitsInBox(round, settings.inventory), 'alcanzan las tapitas de cada color');

            if (operation === 'contar') {
              assert.equal(round.answer, sum(round.dice.map((d) => d.value)));
              assert.equal(round.groups.length, 1, 'un solo montón');
              assert.equal(round.groups[0].length, 1, 'un solo montón');
              assert.equal(used, round.answer);
              if (!realCaps) assert.equal(new Set(round.groups.flat(2)).size, 1, 'en pantalla, un solo color');
            }
            if (operation === 'sumar') {
              assert.equal(round.answer, sum(round.dice.map((d) => d.value)));
              assert.equal(used, round.answer);
              assert.equal(
                round.prompt,
                phrase(
                  round.dice.map((d) => d.value),
                  'más',
                ),
              );
            }
            if (operation === 'restar') {
              assert.equal(round.removeTotal, sum(round.toRemove ?? []));
              assert.equal(round.answer, (round.placed ?? 0) - (round.removeTotal ?? 0));
              assert.equal(round.prompt, phrase([round.placed ?? 0, ...(round.toRemove ?? [])], 'menos'));
            }
            if (operation === 'multiplicar') {
              assert.ok(round.answer <= totalCaps(settings.inventory), 'nunca más que la caja');
              assert.equal(used, round.answer);
              assert.equal(
                round.prompt,
                phrase(
                  round.dice.map((d) => d.value),
                  'por',
                ),
              );
            }
            if (operation === 'dividir') {
              assert.equal(round.total, (round.plateCount ?? 0) * round.answer);
              assert.equal(round.pile?.length, round.total);
              assert.equal(round.prompt, phrase([round.total ?? 0, round.plateCount ?? 0], 'entre'));
            }

            const options = makeAnswerOptions(round.answer, random);
            assert.equal(new Set(options).size, 3, 'tres respuestas distintas');
            assert.ok(options.includes(round.answer), 'incluye la correcta');
            assert.deepEqual(
              options,
              [...options].sort((a, b) => a - b),
              'ordenadas',
            );

            assert.ok(adultInstruction(round).length > 0);
            assert.ok(resultPhrase(round).length > 0);
            previousKey = round.key;
          }
        });
      }
    }
  }
}

test('Multiplicar no pasa de 3 dados, Dividir de 2 y Contar va de 2 a 4', () => {
  assert.equal(clampDice(settingsWith({ operation: 'multiplicar', dice: 4 })).dice, 3);
  assert.equal(clampDice(settingsWith({ operation: 'dividir', dice: 4 })).dice, 2);
  assert.equal(clampDice(settingsWith({ operation: 'contar', dice: 5 })).dice, 4);
  assert.equal(clampDice(settingsWith({ operation: 'contar', dice: 1 })).dice, 2);
});

test('Niveles: 2, 3 y 4 dados, sin pasar el máximo de cada operación', () => {
  const dice = (/** @type {OperationId} */ operation) => [2, 3, 4].map((level) => diceForLevel(operation, level));
  assert.deepEqual(dice('contar'), [2, 3, 4]);
  assert.deepEqual(dice('sumar'), [2, 3, 4]);
  assert.deepEqual(dice('restar'), [2, 3, 4]);
  assert.deepEqual(dice('multiplicar'), [2, 3, 3]);
  assert.deepEqual(dice('dividir'), [2, 2, 2]);
});

test('Con una caja de 8 tapitas, la multiplicación nunca pide más de 8', () => {
  const inventory = { ...emptyBox(), blue: 8 };
  const settings = settingsWith({ operation: 'multiplicar', dice: 3, faces: 6, inventory });
  const random = seededRandom(7);
  for (let i = 0; i < 200; i++) {
    assert.ok(createRound(settings, { random }).answer <= 8);
  }
});

// [CAMBIO DE COMPORTAMIENTO] Antes, si ninguna tirada cabía en la caja, se
// aceptaba cualquiera. Con la caja de la foto y el dado 1 negro (hay 1 negra),
// Restar pedía más negras de las que hay en 200 de 200 rondas.
const SMALL_BOXES = [
  {
    name: 'caja de la foto con el dado 1 negro',
    inventory: defaultSettings().inventory,
    diceColors: ['black', 'blue', 'green', 'red'],
  },
  {
    name: '1 negra y 6 azules',
    inventory: { ...emptyBox(), black: 1, blue: 6 },
    diceColors: ['black', 'blue', 'blue', 'blue'],
  },
  { name: 'solo 4 azules', inventory: { ...emptyBox(), blue: 4 }, diceColors: ['blue', 'blue', 'blue', 'blue'] },
  { name: 'una sola tapita', inventory: { ...emptyBox(), green: 1 }, diceColors: ['green', 'green', 'green', 'green'] },
];

for (const box of SMALL_BOXES) {
  test(`Con tapitas reales y ${box.name}, ninguna ronda pide más de las que hay`, () => {
    for (const operation of OPERATION_IDS) {
      const info = OPERATIONS[operation];
      for (let dice = info.minDice; dice <= info.maxDice; dice++) {
        for (const faces of /** @type {const} */ ([3, 6])) {
          const settings = settingsWith({ ...box, operation, dice, faces, realCaps: true });
          const random = seededRandom(11);
          let previousKey = '';
          for (let i = 0; i < 100; i++) {
            const round = createRound(settings, { previousKey, random });
            assert.ok(
              fitsInBox(round, settings.inventory),
              `${operation} ${dice} dados, caras 1-${faces}: ${JSON.stringify(countCapsByColor(round))}`,
            );
            previousKey = round.key;
          }
        }
      }
    }
  });
}

test('Si ninguna tirada sirve, el último recurso es Contar con el color que más hay', () => {
  const settings = settingsWith({
    operation: 'restar',
    dice: 2,
    realCaps: true,
    inventory: { ...emptyBox(), black: 1 },
    diceColors: ['black', 'black', 'black', 'black'],
  });
  const round = createRound(settings, { random: seededRandom() });
  assert.equal(round.operation, 'contar');
  assert.deepEqual(round.dice, [{ value: 1, color: 'black' }]);
  assert.equal(capCount(round), 1);
});

test('Con la caja vacía y en pantalla, Multiplicar cae en Contar sin romperse', () => {
  const settings = settingsWith({ operation: 'multiplicar', dice: 2, inventory: emptyBox() });
  const round = createRound(settings, { random: seededRandom() });
  assert.equal(round.operation, 'contar');
  assert.ok(round.answer >= 1 && round.answer <= settings.faces);
});

test('resultPhrase usa "una" y "ninguna" donde corresponde', () => {
  assert.equal(resultPhrase({ operation: 'restar', answer: 0 }), 'No queda ninguna.');
  assert.equal(resultPhrase({ operation: 'restar', answer: 1 }), 'Queda una.');
  assert.equal(resultPhrase({ operation: 'restar', answer: 3 }), 'Quedan tres.');
  assert.equal(resultPhrase({ operation: 'dividir', answer: 1 }), 'Una en cada plato.');
  assert.equal(resultPhrase({ operation: 'sumar', answer: 1 }), 'Hay una.');
  assert.equal(resultPhrase({ operation: 'sumar', answer: 15 }), 'Hay 15.');
});

test('makeAnswerOptions con 0 y 1 nunca ofrece números negativos', () => {
  for (const answer of [0, 1]) {
    const random = seededRandom(answer);
    for (let i = 0; i < 50; i++) {
      const options = makeAnswerOptions(answer, random);
      assert.ok(options.every((n) => n >= 0));
      assert.ok(options.includes(answer));
    }
  }
});

test('allocateColors mezcla colores cuando ninguno alcanza solo, sin pasarse de la caja', async () => {
  const { allocateColors } = await import('../js/rules.js');
  const inventory = { blue: 2, green: 3, red: 2 };
  const piles = allocateColors([4, 3], ['blue'], inventory);
  assert.deepEqual(
    piles.map((pile) => pile.length),
    [4, 3],
  );
  assert.ok(fitsInBox({ groups: [piles] }, inventory), JSON.stringify(piles));
  assert.equal(piles[0][0], 'blue', 'empieza por el color preferido');
});

test('Una caja a la que le faltan colores cuenta esos colores como 0', () => {
  const round = createRound(settingsWith({ operation: 'contar', realCaps: true, inventory: { blue: 2 } }), {
    random: seededRandom(3),
  });
  assert.ok(fitsInBox(round, { blue: 2 }));
});

test('adultInstruction de una operación desconocida devuelve un texto vacío', () => {
  const round = createRound(settingsWith({ operation: 'contar' }), { random: seededRandom() });
  assert.equal(adultInstruction({ ...round, operation: /** @type {any} */ ('volar') }), '');
});
