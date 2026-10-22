/**
 * Reglas del juego: genera rondas (dados, tapitas, respuesta).
 * Lógica pura, sin DOM ni efectos: se prueba con `node --test`.
 */

import { getCapColor, totalCaps, CAP_COLORS } from './config.js';
import { numberWord, feminineNumber, joinWithAnd, capitalize } from './spanish.js';

/**
 * Inmutable durante la ronda; la interacción vive en game.js.
 * @typedef {Object} Round
 * @property {import('./config.js').OperationId} operation
 * @property {{value: number, color: string}[]} dice
 * @property {string[][][]} groups      grupos → montones → color de cada tapita
 * @property {number} answer
 * @property {string} prompt           texto en pantalla
 * @property {string} speech           lo que dice la voz
 * @property {number} [placed]         Restar: cuántas se ponen en la mesa
 * @property {number[]} [toRemove]     Restar: cuántas guarda cada dado
 * @property {number} [removeTotal]    Restar: total a guardar
 * @property {number} [plateCount]     Dividir: cuántos platos
 * @property {number} [total]          Dividir: cuántas tapitas se reparten
 * @property {string[]} [pile]         Dividir: colores del montón inicial
 * @property {string} key              evita repetir la tirada anterior
 */

/** @typedef {Omit<Round, 'operation' | 'key'>} RoundDraft  createRound completa operation y key */

/** @typedef {import('./config.js').Settings} Settings */
/** @typedef {() => number} RandomFn  [0, 1), inyectable para tests deterministas */

/**
 * Entero en [min, max].
 * @param {number} min
 * @param {number} max
 * @param {RandomFn} [random]
 */
export function randomInt(min, max, random = Math.random) {
  return min + Math.floor(random() * (max - min + 1));
}

/** @param {number[]} numbers */
const sum = (numbers) => numbers.reduce((a, b) => a + b, 0);
/** @param {number[]} numbers */
const product = (numbers) => numbers.reduce((a, b) => a * b, 1);

/**
 * Asigna colores de la caja a cada montón sin exceder el inventario.
 * Prioriza los colores de los dados y montones de un solo color.
 * @param {number[]} sizes        tamaño de cada montón
 * @param {string[]} preferred    colores preferidos, en orden
 * @param {Record<string, number>} inventory
 * @returns {string[][]}          colores de cada montón
 */
export function allocateColors(sizes, preferred, inventory) {
  const remaining = { ...inventory };
  const byCount = CAP_COLORS.map((c) => c.id).sort((a, b) => (inventory[b] ?? 0) - (inventory[a] ?? 0));
  const order = [...new Set([...preferred, ...byCount])];

  return sizes.map((size) => {
    const whole = order.find((color) => (remaining[color] ?? 0) >= size);
    if (whole) {
      remaining[whole] -= size;
      return Array(size).fill(whole);
    }
    // Ningún color alcanza solo: se mezclan.
    const mixed = [];
    for (let i = 0; i < size; i++) {
      const color = order.find((c) => (remaining[c] ?? 0) > 0) ?? order[0];
      if (remaining[color] > 0) remaining[color] -= 1;
      mixed.push(color);
    }
    return mixed;
  });
}

/**
 * @param {Pick<Round, 'groups' | 'pile'>} round
 * @returns {Record<string, number>}
 */
export function countCapsByColor(round) {
  /** @type {Record<string, number>} */
  const counts = {};
  const allCaps = [...round.groups.flat(2), ...(round.pile ?? [])];
  for (const color of allCaps) counts[color] = (counts[color] ?? 0) + 1;
  return counts;
}

/**
 * @param {Pick<Round, 'groups' | 'pile'>} round
 * @param {Record<string, number>} inventory
 */
export function fitsInBox(round, inventory) {
  return Object.entries(countCapsByColor(round)).every(([color, n]) => n <= (inventory[color] ?? 0));
}

/**
 * "4 menos 2 es igual a…". Cifras en pantalla (String), palabras en la voz (numberWord).
 * Masculino ("uno"): se habla de números, no de tapitas.
 * @param {number[]} numbers
 * @param {'más' | 'menos' | 'por' | 'entre'} word
 * @param {(n: number) => string} say
 */
function operationPhrase(numbers, word, say) {
  return `${numbers.map(say).join(` ${word} `)} es igual a…`;
}

// --- Builders: uno por operación. null = tirada descartada, createRound reintenta.

/**
 * @param {Settings} settings
 * @param {RandomFn} random
 * @returns {RoundDraft}
 */
function buildContar(settings, random) {
  const values = Array.from({ length: settings.dice }, () => randomInt(1, settings.faces, random));
  const answer = sum(values);
  // Un solo montón (agrupar es cosa de Sumar). Con tapitas reales, colores según la caja.
  const [caps] = settings.realCaps
    ? allocateColors([answer], settings.diceColors.slice(0, settings.dice), settings.inventory)
    : [Array(answer).fill(settings.diceColors[0])];
  return {
    dice: values.map((value, i) => ({ value, color: settings.diceColors[i] })),
    groups: [[caps]],
    answer,
    prompt: '¿Cuántas hay?',
    speech: '¿Cuántas hay?',
  };
}

/**
 * @param {Settings} settings
 * @param {RandomFn} random
 * @returns {RoundDraft}
 */
function buildSumar(settings, random) {
  const values = Array.from({ length: settings.dice }, () => randomInt(1, settings.faces, random));
  const colors = settings.diceColors;
  return {
    dice: values.map((value, i) => ({ value, color: colors[i] })),
    groups: values.map((value, i) => [Array(value).fill(colors[i])]),
    answer: sum(values),
    prompt: operationPhrase(values, 'más', String),
    speech: operationPhrase(values, 'más', numberWord),
  };
}

/**
 * @param {Settings} settings
 * @param {RandomFn} random
 * @returns {RoundDraft | null}
 */
function buildRestar(settings, random) {
  const color = settings.diceColors[0];
  const removeDice = settings.dice - 1;
  // Con 3+ dados, 1–3 caras no dejan margen para restar.
  const faces = settings.dice >= 3 ? 6 : settings.faces;
  const maxPerDie = Math.max(1, Math.floor(faces / removeDice));

  const toRemove = Array.from({ length: removeDice }, () => randomInt(1, maxPerDie, random));
  const removeTotal = sum(toRemove);
  if (removeTotal > faces) return null;

  const placed = randomInt(Math.max(2, removeTotal), faces, random);
  // Reduce los resultados en cero.
  if (placed === removeTotal && random() < 0.7) return null;

  return {
    dice: [{ value: placed, color }, ...toRemove.map((value) => ({ value, color }))],
    groups: [[Array(placed).fill(color)]],
    placed,
    toRemove,
    removeTotal,
    answer: placed - removeTotal,
    prompt: operationPhrase([placed, ...toRemove], 'menos', String),
    speech: operationPhrase([placed, ...toRemove], 'menos', numberWord),
  };
}

/**
 * @param {Settings} settings
 * @param {RandomFn} random
 * @returns {RoundDraft | null}
 */
function buildMultiplicar(settings, random) {
  const values = Array.from({ length: settings.dice }, () => randomInt(1, settings.faces, random));
  if (values[0] < 2) values[0] = 2; // al menos dos platos

  const answer = product(values);
  if (answer > totalCaps(settings.inventory)) return null;

  // 2 dados: platos × tapitas · 3 dados: platos × montones × tapitas
  const [plateCount, second, third] = values;
  const pilesPerPlate = settings.dice === 3 ? second : 1;
  const pileSize = settings.dice === 3 ? third : second;

  const pileSizes = Array(plateCount * pilesPerPlate).fill(pileSize);
  const piles = allocateColors(pileSizes, settings.diceColors.slice(0, settings.dice), settings.inventory);
  const groups = [];
  for (let p = 0; p < plateCount; p++) {
    groups.push(piles.slice(p * pilesPerPlate, (p + 1) * pilesPerPlate));
  }

  return {
    dice: values.map((value, i) => ({ value, color: settings.diceColors[i] })),
    groups,
    answer,
    prompt: operationPhrase(values, 'por', String),
    speech: operationPhrase(values, 'por', numberWord),
  };
}

/**
 * @param {Settings} settings
 * @param {RandomFn} random
 * @returns {RoundDraft | null}
 */
function buildDividir(settings, random) {
  // Se genera al revés (platos × por plato) para que la división sea exacta.
  const plateCount = randomInt(2, Math.max(2, settings.faces), random);
  const perPlate = randomInt(1, settings.faces, random);
  const total = plateCount * perPlate;
  if (total > totalCaps(settings.inventory)) return null;

  const [pile] = allocateColors([total], settings.diceColors.slice(0, 2), settings.inventory);
  return {
    dice: [{ value: plateCount, color: settings.diceColors[0] }],
    groups: [],
    plateCount,
    total,
    pile,
    answer: perPlate,
    prompt: operationPhrase([total, plateCount], 'entre', String),
    speech: operationPhrase([total, plateCount], 'entre', numberWord),
  };
}

/** @type {Record<import('./config.js').OperationId, (settings: Settings, random: RandomFn) => RoundDraft | null>} */
const BUILDERS = {
  contar: buildContar,
  sumar: buildSumar,
  restar: buildRestar,
  multiplicar: buildMultiplicar,
  dividir: buildDividir,
};

/** @param {Pick<Round, 'dice' | 'total' | 'answer'>} round */
function roundKey(round) {
  return `${round.dice.map((d) => d.value + d.color).join(',')}|${round.total ?? ''}|${round.answer}`;
}

/**
 * Invariante: con tapitas reales nunca pide más de las que hay en la caja.
 * Degrada en orden: tirada nueva que quepa → repetida que quepa → countingFallback.
 * @param {Settings} settings
 * @param {{ previousKey?: string, random?: RandomFn }} [options]
 * @returns {Round}
 */
export function createRound(settings, { previousKey = '', random = Math.random } = {}) {
  const build = BUILDERS[settings.operation];

  /** @returns {Round | null} */
  const tryBuild = () => {
    const draft = build(settings, random);
    if (!draft) return null;
    const round = { operation: settings.operation, ...draft, key: '' };
    round.key = roundKey(round);
    return round;
  };
  /** @param {Round} round */
  const fits = (round) => !settings.realCaps || fitsInBox(round, settings.inventory);

  for (let attempt = 0; attempt < 120; attempt++) {
    const round = tryBuild();
    if (round && round.key !== previousKey && fits(round)) return round;
  }
  for (let attempt = 0; attempt < 200; attempt++) {
    const round = tryBuild();
    if (round && fits(round)) return round;
  }
  return countingFallback(settings, random);
}

/**
 * Contar con el color más abundante: siempre cabe.
 * @param {Settings} settings
 * @param {RandomFn} random
 * @returns {Round}
 */
function countingFallback(settings, random) {
  const { inventory } = settings;
  const color = CAP_COLORS.map((c) => c.id).sort((a, b) => (inventory[b] ?? 0) - (inventory[a] ?? 0))[0];
  // En pantalla la caja puede estar vacía: el límite son las caras.
  const max = settings.realCaps ? Math.min(settings.faces, inventory[color] ?? 0) : settings.faces;
  const value = randomInt(1, Math.max(1, max), random);
  /** @type {Round} */
  const round = {
    operation: 'contar',
    dice: [{ value, color }],
    groups: [[Array(value).fill(color)]],
    answer: value,
    prompt: '¿Cuántas hay?',
    speech: '¿Cuántas hay?',
    key: '',
  };
  round.key = roundKey(round);
  return round;
}

/**
 * Tres opciones ordenadas; distractores a ±1–2 para que haya que contar.
 * @param {number} answer
 * @param {RandomFn} [random]
 * @returns {number[]}
 */
export function makeAnswerOptions(answer, random = Math.random) {
  const nearby = [answer - 2, answer - 1, answer + 1, answer + 2].filter((n) => n >= 0);
  // Fisher-Yates
  for (let i = nearby.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [nearby[i], nearby[j]] = [nearby[j], nearby[i]];
  }
  return [answer, nearby[0], nearby[1]].sort((a, b) => a - b);
}

/**
 * Frase de cierre (acierto o fin de ayuda).
 * @param {Pick<Round, 'operation' | 'answer'>} round
 */
export function resultPhrase(round) {
  const a = round.answer;
  if (round.operation === 'restar') {
    if (a === 0) return 'No queda ninguna.';
    return a === 1 ? 'Queda una.' : `Quedan ${numberWord(a)}.`;
  }
  if (round.operation === 'dividir') return `${capitalize(feminineNumber(a))} en cada plato.`;
  return a === 1 ? 'Hay una.' : `Hay ${numberWord(a)}.`;
}

/**
 * "3 azules", "1 verde"
 * @param {string} colorId
 * @param {number} n
 */
function capsPhrase(colorId, n) {
  const color = getCapColor(colorId);
  return `${n} ${n === 1 ? color.singular : color.plural}`;
}

/** @param {Round} round */
function colorsPhrase(round) {
  return joinWithAnd(Object.entries(countCapsByColor(round)).map(([c, n]) => capsPhrase(c, n)));
}

/**
 * Modo tapitas reales: qué preparar en la mesa.
 * @param {Round} round
 */
export function adultInstruction(round) {
  const [first] = round.dice;
  switch (round.operation) {
    case 'contar':
      return `Saca ${colorsPhrase(round)} y ponlas en un montón. Cuenten juntos tocando cada una.`;
    case 'sumar':
      return `Saca ${joinWithAnd(round.dice.map((d) => capsPhrase(d.color, d.value)))}, cada color en su grupo. Luego júntalas y cuenten todas.`;
    case 'restar':
      return `Pon ${capsPhrase(first.color, round.placed ?? 0)} en la mesa. Que guarde ${(round.toRemove ?? []).join(' y luego ')} en la caja. Cuenten las que quedan.`;
    case 'multiplicar': {
      const v = round.dice.map((d) => d.value);
      return v.length === 3
        ? `Arma ${v[0]} platos. En cada plato, ${v[1]} montones de ${v[2]}. Usa: ${colorsPhrase(round)}.`
        : `Arma ${v[0]} platos con ${v[1]} tapitas en cada uno. Usa: ${colorsPhrase(round)}.`;
    }
    case 'dividir':
      return `Saca ${round.total} tapitas (${colorsPhrase(round)}) y ${round.plateCount} platos. Que las reparta una por una.`;
    default:
      return '';
  }
}

/** @param {Pick<Round, 'groups'>} round */
export function capCount(round) {
  return round.groups.flat(2).length;
}
