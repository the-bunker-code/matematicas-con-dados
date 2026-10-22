/** Helpers de texto en español para la voz y la UI. */

// prettier-ignore
const NUMBER_WORDS = [
  'cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis',
  'siete', 'ocho', 'nueve', 'diez', 'once', 'doce',
];

/**
 * 3 → "tres", 20 → "20" (desde 13, cifra: los motores TTS la leen bien).
 * @param {number} n
 */
export function numberWord(n) {
  return n >= 0 && n < NUMBER_WORDS.length ? NUMBER_WORDS[n] : String(n);
}

/**
 * Concordancia con "tapita": 1 → "una".
 * @param {number} n
 */
export function feminineNumber(n) {
  return n === 1 ? 'una' : numberWord(n);
}

/**
 * ['a', 'b', 'c'] → "a, b y c"
 * @param {string[]} items
 */
export function joinWithAnd(items) {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} y ${items.at(-1)}`;
}

/**
 * "dos platos" → "Dos platos"
 * @param {string} text
 */
export function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
