/**
 * Datos fijos del juego: colores, operaciones, niveles, textos y tiempos.
 * Sin DOM: importable desde Node.
 */

/**
 * @typedef {Object} CapColor
 * @property {string} id
 * @property {string} plural    "azules"
 * @property {string} singular  "azul"
 * @property {string} base
 * @property {string} shine     brillo del degradado
 * @property {string} text      número sobre la tapita
 * @property {string} edge      borde de dado y grupo
 */

/** @type {CapColor[]} */
// prettier-ignore
export const CAP_COLORS = [
  { id: 'blue', plural: 'azules', singular: 'azul', base: '#1d4ed8', shine: '#3b82f6', text: '#ffffff', edge: '#1d4ed8' },
  { id: 'green', plural: 'verdes', singular: 'verde', base: '#15803d', shine: '#22c55e', text: '#ffffff', edge: '#15803d' },
  { id: 'white', plural: 'blancas', singular: 'blanca', base: '#cbd5e1', shine: '#ffffff', text: '#1e293b', edge: '#64748b' },
  { id: 'red', plural: 'rojas', singular: 'roja', base: '#b91c1c', shine: '#ef4444', text: '#ffffff', edge: '#b91c1c' },
  { id: 'orange', plural: 'naranjas', singular: 'naranja', base: '#c2410c', shine: '#f97316', text: '#ffffff', edge: '#c2410c' },
  { id: 'yellow', plural: 'amarillas', singular: 'amarilla', base: '#ca8a04', shine: '#facc15', text: '#422006', edge: '#ca8a04' },
  { id: 'lightblue', plural: 'celestes', singular: 'celeste', base: '#0279b8', shine: '#38bdf8', text: '#ffffff', edge: '#0279b8' },
  { id: 'turquoise', plural: 'turquesas', singular: 'turquesa', base: '#0f766e', shine: '#2dd4bf', text: '#ffffff', edge: '#0f766e' },
  { id: 'gray', plural: 'grises', singular: 'gris', base: '#475569', shine: '#94a3b8', text: '#ffffff', edge: '#475569' },
  { id: 'black', plural: 'negras', singular: 'negra', base: '#0f172a', shine: '#334155', text: '#ffffff', edge: '#0f172a' },
];

/**
 * Fallback: azul.
 * @param {string} id
 * @returns {CapColor}
 */
export function getCapColor(id) {
  return CAP_COLORS.find((color) => color.id === id) ?? CAP_COLORS[0];
}

/**
 * Inventario de la caja real de referencia.
 * @type {Record<string, number>}
 */
// prettier-ignore
export const DEFAULT_INVENTORY = {
  blue: 16, green: 11, white: 8, red: 7, orange: 6,
  yellow: 3, lightblue: 3, turquoise: 2, gray: 2, black: 1,
};

/**
 * Color fijo por operación: es el ancla visual del niño.
 * WCAG AA: texto sobre `main` siempre oscuro (--on-theme); `dark` ≥ 4,5:1 sobre blanco.
 * @typedef {Object} Theme
 * @property {string} main
 * @property {string} dark     textos y sombras
 * @property {string} light    fondos suaves
 * @property {string} skyTop
 * @property {string} skyBottom
 * @property {string} hills
 */

/** @type {Theme} */
// prettier-ignore
export const HOME_THEME = {
  main: '#ffa23a', dark: '#af630e', light: '#fff0d6',
  skyTop: '#ffe7b8', skyBottom: '#fff8ea', hills: '#b9e48f',
};

/**
 * @typedef {Object} Operation
 * @property {string} name
 * @property {import('./icons.js').IconName} icon
 * @property {import('./icons.js').IconName | ''} symbol  signo entre dados ('' en Contar)
 * @property {number} minDice
 * @property {number} maxDice
 * @property {Theme} theme
 * @property {string[]} adultTips
 */

/** @typedef {'contar'|'sumar'|'restar'|'multiplicar'|'dividir'} OperationId */

/**
 * En orden pedagógico (es el orden de las tarjetas).
 * @type {Record<OperationId, Operation>}
 */
export const OPERATIONS = {
  contar: {
    name: 'Contar',
    icon: 'pointer',
    symbol: '',
    minDice: 2,
    maxDice: 4,
    theme: {
      main: '#4f8ef7',
      dark: '#2f6fd8',
      light: '#dbe9ff',
      skyTop: '#c4e2ff',
      skyBottom: '#eef7ff',
      hills: '#a8dc86',
    },
    adultTips: [
      'Cuenta tú primero, despacio, tocando cada tapita. Luego le toca a ella o a él.',
      'Que toque y mueva cada tapita a un lado mientras cuenta: una tapita, un número.',
      'El último número que dice es cuántas hay. Repítelo: "uno, dos, tres... ¡hay tres!".',
      'Con más dados hay más tapitas, todas juntas en un montón. Si se pierde, que las ponga en fila.',
      'Cuando acierte 4 de 5 rondas varias noches seguidas, pasa a Sumar.',
    ],
  },
  sumar: {
    name: 'Sumar',
    icon: 'plus',
    symbol: 'plus',
    minDice: 2,
    maxDice: 4,
    theme: {
      main: '#ff7a4d',
      dark: '#ca4f27',
      light: '#ffe3d6',
      skyTop: '#ffdcc4',
      skyBottom: '#fff5ec',
      hills: '#ffc58f',
    },
    adultTips: [
      'Un grupo en cada mano. Di: "tres... y dos... ¡juntamos!" y une las manos.',
      'Cuenten todas juntas, tocando cada tapita.',
      'Empieza con 2 dados y caras 1 a 3. Sube cuando le salga sin ayuda varios días seguidos.',
    ],
  },
  restar: {
    name: 'Restar',
    icon: 'minus',
    symbol: 'minus',
    minDice: 2,
    maxDice: 4,
    theme: {
      main: '#ff5d8f',
      dark: '#d6396a',
      light: '#ffdbe7',
      skyTop: '#ffd6e5',
      skyBottom: '#fff1f6',
      hills: '#ffb6cd',
    },
    adultTips: [
      'El primer dado dice cuántas poner. Los demás, cuántas guardar.',
      'Que ella o él guarde las tapitas en la caja. Di: "guardamos dos".',
      'Luego cuenten solo las que quedan en la mesa. Si no queda ninguna, muestra la mesa vacía.',
    ],
  },
  multiplicar: {
    name: 'Multiplicar',
    icon: 'x',
    symbol: 'x',
    minDice: 2,
    maxDice: 3,
    theme: {
      main: '#a77bff',
      dark: '#8455ea',
      light: '#ece2ff',
      skyTop: '#e2d4ff',
      skyBottom: '#f7f2ff',
      hills: '#cbb4ff',
    },
    adultTips: [
      'El primer dado dice cuántos platos. El segundo, cuántas en cada plato.',
      'Con 3 dados: en cada plato van montones iguales.',
      'Arma los platos primero. Luego cuenten de plato en plato: "dos, cuatro, seis".',
      'Nunca pide más tapitas de las que hay en tu caja.',
    ],
  },
  dividir: {
    name: 'Dividir',
    icon: 'divide',
    symbol: 'divide',
    minDice: 2,
    maxDice: 2,
    theme: {
      main: '#5fbf3f',
      dark: '#38861f',
      light: '#def5d3',
      skyTop: '#d2f0c3',
      skyBottom: '#f2fbec',
      hills: '#a3dc84',
    },
    adultTips: [
      'Pon tantos platos como dice el dado.',
      'Ritmo: "una para este, una para este, una para este".',
      'La pregunta es cuántas hay en UN plato, no el total.',
    ],
  },
};

/**
 * Object.hasOwn y no `in`: 'toString' in OPERATIONS es true.
 * @param {unknown} id
 * @returns {id is OperationId}
 */
export function isOperationId(id) {
  return typeof id === 'string' && Object.hasOwn(OPERATIONS, id);
}

/**
 * Clave = preferredLevel = cantidad de dados.
 * @type {Record<number, string>}
 */
export const LEVEL_NAMES = { 2: 'Principiante', 3: 'Intermedio', 4: 'Avanzado' };

/**
 * Nivel → dados, acotado al rango de la operación (Dividir: siempre 2).
 * @param {OperationId} operation
 * @param {number} level
 */
export function diceForLevel(operation, level) {
  const { minDice, maxDice } = OPERATIONS[operation];
  return Math.min(maxDice, Math.max(minDice, level));
}

/** @param {number} count */
export function diceLabel(count) {
  return count === 1 ? '1 dado' : `${count} dados`;
}

export const GENERAL_TIPS = [
  'Si elige mal, no digas "no": la app cuenta en voz alta y marca la respuesta.',
  'Espera 5 segundos antes de ayudar.',
  'Sesiones cortas: al terminar, guarden juntos las tapitas.',
];

/** Por posición, no por valor (≥ 3:1 sobre blanco). */
export const ANSWER_COLORS = ['#a77bff', '#4f8ef7', '#fa5b8c'];

/** ms */
export const TIMING = {
  nextRoundDelay: 2800, // tras acertar
  demoStepDelay: 700, // por tapita en la ayuda
  demoGroupDelay: 1000, // por montón (Multiplicar)
  equalizeStepDelay: 1000, // por tapita movida (Dividir)
  endButtonsDelay: 4000,
};

/**
 * Persistidos en localStorage (ver storage.js).
 * @typedef {Object} Settings
 * @property {OperationId} operation
 * @property {number} dice        derivado de operation + preferredLevel
 * @property {2|3|4} preferredLevel
 * @property {3|6} faces
 * @property {3|5|8} rounds
 * @property {boolean} voice
 * @property {boolean} sound
 * @property {boolean} realCaps   tapitas físicas en la mesa en vez de en pantalla
 * @property {string[]} diceColors
 * @property {Record<string, number>} inventory
 */

/** @returns {Settings} */
export function defaultSettings() {
  return {
    operation: 'contar',
    dice: 2,
    preferredLevel: 2,
    faces: 3,
    rounds: 5,
    voice: true,
    sound: true,
    realCaps: false,
    diceColors: ['blue', 'green', 'red', 'orange'],
    inventory: { ...DEFAULT_INVENTORY },
  };
}

/**
 * @param {Settings} settings  muta y devuelve
 * @returns {Settings}
 */
export function clampDice(settings) {
  const { minDice, maxDice } = OPERATIONS[settings.operation];
  settings.dice = Math.min(maxDice, Math.max(minDice, settings.dice));
  return settings;
}

/**
 * Reemplaza colores de dado agotados por los más abundantes (dado i → i-ésimo).
 * Caja vacía: sin cambios.
 * @param {Settings} settings  muta y devuelve
 * @returns {Settings}
 */
export function fixDiceColors(settings) {
  const { inventory } = settings;
  const available = CAP_COLORS.map((color) => color.id)
    .filter((id) => inventory[id] > 0)
    .sort((a, b) => inventory[b] - inventory[a]);
  if (available.length === 0) return settings;

  settings.diceColors = settings.diceColors.map((id, i) => (inventory[id] > 0 ? id : available[i % available.length]));
  return settings;
}

/** @param {Record<string, number>} inventory */
export function totalCaps(inventory) {
  return Object.values(inventory).reduce((sum, count) => sum + count, 0);
}
