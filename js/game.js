/**
 * Estado del juego y acciones que lo modifican.
 * Flujo unidireccional: acción → state → notify() → render(). Solo este módulo muta `state`.
 */

import { defaultSettings, diceForLevel, isOperationId, TIMING } from './config.js';
import { createRound, makeAnswerOptions, resultPhrase, capCount } from './rules.js';
import { numberWord, feminineNumber } from './spanish.js';
import { say, stopVoice, playCount, playSuccess, playMiss, playTone, setAudioPreferences } from './audio.js';
import { saveSettings } from './storage.js';

/**
 * @typedef {'home'|'game'|'end'} Screen
 * @typedef {'play'|'helping'|'solved'} Phase  helping y solved ignoran los toques
 */

/**
 * @typedef {Object} GameState
 * @property {import('./config.js').Settings} settings
 * @property {Screen} screen
 * @property {number} roundNumber          rondas terminadas en la sesión
 * @property {import('./rules.js').Round | null} round
 * @property {number[]} answerOptions
 * @property {Phase} phase
 * @property {import('./mascot.js').Mood} mood
 * @property {number} bounceCount          cambia en cada acierto → salto de la mascota
 * @property {Map<string, number>} countedCaps   capId → número asignado
 * @property {Set<string>} removedCaps     Restar: guardadas en la caja
 * @property {Set<string>} highlightedCaps resaltadas durante la ayuda
 * @property {string[]} pile               Dividir: por repartir
 * @property {string[][]} plates           Dividir: contenido de cada plato
 * @property {number} nextPlate            Dividir: destino al tocar el montón
 * @property {boolean} distributed         Dividir: reparto terminado
 * @property {number | null} pulsingAnswer
 * @property {number | null} wrongAnswer
 * @property {number} wrongCount           cambia en cada error → re-dispara el temblor
 * @property {boolean} helpShown
 * @property {boolean} endButtonsVisible
 */

/** @type {GameState} */
export const state = {
  settings: defaultSettings(), // init() la reemplaza por la guardada
  screen: 'home',
  roundNumber: 0,
  round: null,
  answerOptions: [],
  phase: 'play',
  mood: 'happy',
  bounceCount: 0,
  countedCaps: new Map(),
  removedCaps: new Set(),
  highlightedCaps: new Set(),
  pile: [],
  plates: [],
  nextPlate: 0,
  distributed: false,
  pulsingAnswer: null,
  wrongAnswer: null,
  wrongCount: 0,
  helpShown: false,
  endButtonsVisible: false,
};

// --- Suscripción ------------------------------------------------------------

/** @typedef {(state: GameState) => void} Listener */

/** @type {Listener[]} */
const listeners = [];

/** @param {Listener} listener */
export function onChange(listener) {
  listeners.push(listener);
}

function notify() {
  listeners.forEach((listener) => listener(state));
}

// --- Tareas asíncronas ------------------------------------------------------
// Cada tarea captura roundId al empezar y se corta si cambió (nueva ronda,
// volver al inicio, abrir ajustes). Evita voces y timers huérfanos.

let roundId = 0;
/** @param {number} ms */
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
/** @param {number} id */
const isStale = (id) => id !== roundId;

// --- Navegación -------------------------------------------------------------

/** @param {import('./config.js').Settings} settings */
export function init(settings) {
  state.settings = settings;
  setAudioPreferences(settings);
  notify();
}

/** @param {number} level  viene de data-level: se valida */
export function setPreferredLevel(level) {
  if (level !== 2 && level !== 3 && level !== 4) return;
  state.settings.preferredLevel = level;
  saveSettings(state.settings);
  notify();
}

/** @param {string | undefined} operation  viene de data-operation: se valida */
export function startOperation(operation) {
  if (!isOperationId(operation)) return;
  const { settings } = state;
  settings.operation = operation;
  settings.dice = diceForLevel(operation, settings.preferredLevel);
  saveSettings(settings);
  startSession();
}

export function startSession() {
  state.roundNumber = 0;
  state.screen = 'game';
  startRound();
}

export function goHome() {
  roundId++;
  stopVoice();
  state.screen = 'home';
  state.mood = 'happy';
  notify();
}

/** Cancela las tareas en curso (p. ej. al abrir ajustes). */
export function pause() {
  roundId++;
  stopVoice();
}

/** @param {import('./config.js').Settings} newSettings */
export function applySettings(newSettings) {
  state.settings = newSettings;
  setAudioPreferences(newSettings);
  saveSettings(newSettings);
  startSession();
}

export function repeatPrompt() {
  if (state.round) say(state.round.speech);
}

// --- Rondas -----------------------------------------------------------------

function startRound() {
  roundId++;
  const round = createRound(state.settings, { previousKey: state.round?.key });

  Object.assign(state, {
    round,
    answerOptions: makeAnswerOptions(round.answer),
    phase: 'play',
    mood: 'idle',
    countedCaps: new Map(),
    removedCaps: new Set(),
    highlightedCaps: new Set(),
    pile: round.operation === 'dividir' ? [...(round.pile ?? [])] : [],
    plates: round.operation === 'dividir' ? Array.from({ length: round.plateCount ?? 0 }, () => []) : [],
    nextPlate: 0,
    distributed: false,
    pulsingAnswer: null,
    wrongAnswer: null,
    helpShown: false,
  });
  notify();

  // Anticipa el cierre para que no tome por sorpresa.
  const roundsLeft = state.settings.rounds - state.roundNumber;
  let intro = '';
  if (state.settings.rounds >= 3 && roundsLeft === 2) intro = 'Dos más y guardamos. ';
  else if (roundsLeft === 1) intro = 'La última y guardamos. ';
  say(intro + round.speech);
}

function finishSession() {
  roundId++;
  const id = roundId;
  state.screen = 'end';
  state.mood = 'happy';
  state.endButtonsVisible = false;
  notify();
  say('Terminamos. Guardamos las tapitas.');
  // Botones diferidos: el cierre se siente como cierre.
  setTimeout(() => {
    if (isStale(id)) return;
    state.endButtonsVisible = true;
    notify();
  }, TIMING.endButtonsDelay);
}

// --- Toques -----------------------------------------------------------------

/**
 * Cuenta la tapita. En Restar, los primeros toques la guardan en la caja.
 * @param {string | undefined} capId  'cap-3' (mesa) o 'plate-1-0' (plato)
 */
export function tapCap(capId) {
  const { round, settings } = state;
  if (!round || !capId || state.phase !== 'play' || settings.realCaps) return;

  if (round.operation === 'restar' && tapCapWhileSubtracting(capId)) return;

  // Uno a uno: una tapita ya contada repite su número, no suma.
  const alreadyCounted = state.countedCaps.get(capId);
  if (alreadyCounted !== undefined) {
    say(numberWord(alreadyCounted));
    return;
  }

  // Dividir: el conteo es por plato.
  let number;
  if (round.operation === 'dividir') {
    const platePrefix = capId.split('-').slice(0, 2).join('-') + '-'; // 'plate-1-'
    number = [...state.countedCaps.keys()].filter((id) => id.startsWith(platePrefix)).length + 1;
  } else {
    number = state.countedCaps.size + 1;
  }

  state.countedCaps.set(capId, number);
  playCount(number);
  say(numberWord(number));
  notify();
}

/**
 * Restar: guarda o devuelve la tapita.
 * @param {string} capId
 * @returns {boolean} true si consumió el toque; false si debe contarse
 */
function tapCapWhileSubtracting(capId) {
  const { round, removedCaps } = state;
  if (!round?.removeTotal) return false;

  if (removedCaps.has(capId)) {
    removedCaps.delete(capId);
    state.countedCaps.clear(); // cambió lo que hay en la mesa: el conteo se invalida
    playTone(300, 0.08);
    notify();
    return true;
  }

  if (removedCaps.size < round.removeTotal) {
    removedCaps.add(capId);
    state.countedCaps.delete(capId);
    playTone(360 + removedCaps.size * 30, 0.08);
    say(feminineNumber(removedCaps.size));
    notify();

    if (removedCaps.size === round.removeTotal) {
      const id = roundId;
      setTimeout(() => {
        if (!isStale(id) && state.phase === 'play') say('¿Cuántas quedan?');
      }, 700);
    }
    return true;
  }

  return false;
}

/**
 * Dividir: mueve una tapita del montón al plato.
 * @param {number} plateIndex  viene de data-plate: se valida
 */
export function tapPlate(plateIndex) {
  const { round, pile, plates } = state;
  if (!round || round.operation !== 'dividir' || !plates[plateIndex]) return;
  if (state.phase !== 'play' || state.distributed || pile.length === 0) return;

  plates[plateIndex].push(/** @type {string} */ (pile.pop()));
  state.nextPlate = (plateIndex + 1) % plates.length;
  const count = plates[plateIndex].length;
  playCount(count);
  say(numberWord(count));
  notify();

  if (pile.length === 0) equalizePlates();
}

/** Dividir: el montón reparte en orden circular. */
export function tapPile() {
  tapPlate(state.nextPlate);
}

/** Dividir: si el reparto quedó desparejo, la app mueve tapitas hasta igualar. */
async function equalizePlates() {
  const id = roundId;
  state.phase = 'helping';
  notify();
  await wait(700);

  while (!isStale(id)) {
    const sizes = state.plates.map((plate) => plate.length);
    const biggest = sizes.indexOf(Math.max(...sizes));
    const smallest = sizes.indexOf(Math.min(...sizes));
    if (sizes[biggest] === sizes[smallest]) break;

    state.plates[smallest].push(/** @type {string} */ (state.plates[biggest].pop()));
    notify();
    say('Pasamos una.');
    await wait(TIMING.equalizeStepDelay);
  }
  if (isStale(id)) return;

  state.distributed = true;
  state.phase = 'play';
  notify();
  say(state.round?.speech ?? '');
}

/** Dividir con tapitas reales: el adulto confirma el reparto. */
export function confirmDistributed() {
  if (state.round?.operation !== 'dividir' || state.distributed || state.phase !== 'play') return;
  state.distributed = true;
  notify();
  say(state.round.speech);
}

/** @param {number} value */
export function chooseAnswer(value) {
  const { round } = state;
  if (!round || state.phase !== 'play') return;

  if (value === round.answer) {
    celebrate(round);
    return;
  }

  playMiss();
  state.wrongAnswer = value;
  state.wrongCount++;
  // Sin "no": un tono suave y, una vez por ronda, la ayuda.
  if (!state.helpShown) {
    state.helpShown = true;
    showHelp();
  }
  notify();
}

/** @param {import('./rules.js').Round} round */
function celebrate(round) {
  const id = roundId;
  state.phase = 'solved';
  state.roundNumber++;
  state.mood = 'happy';
  state.bounceCount++;
  playSuccess();
  notify();
  say(`Sí. ${resultPhrase(round)}`);

  setTimeout(() => {
    if (isStale(id)) return;
    if (state.roundNumber >= state.settings.rounds) finishSession();
    else startRound();
  }, TIMING.nextRoundDelay);
}

// --- Ayuda ------------------------------------------------------------------

/** Cuenta en voz alta y deja latiendo la respuesta correcta. */
async function showHelp() {
  const id = roundId;
  const { round, settings } = state;
  if (!round) return;
  state.phase = 'helping';
  state.mood = 'think';
  notify();

  // Con tapitas reales la ayuda es del adulto, en la mesa.
  if (settings.realCaps) {
    await say('Contamos juntos con las tapitas.');
    await wait(1800);
    if (isStale(id)) return;
    return endHelp();
  }

  await wait(400);
  if (isStale(id)) return;

  if (round.operation === 'restar') {
    await removeMissingCaps(id);
    if (isStale(id)) return;
  }

  state.countedCaps.clear();
  notify();

  if (round.operation === 'multiplicar') await countByPiles(id);
  else await countOneByOne(id);
  if (isStale(id)) return;

  state.highlightedCaps.clear();
  notify();
  await say(resultPhrase(round));
  if (isStale(id)) return;
  endHelp();
}

function endHelp() {
  state.pulsingAnswer = state.round?.answer ?? null;
  state.phase = 'play';
  notify();
}

/**
 * Restar: completa las tapitas por guardar, desde la última.
 * @param {number} id  roundId al empezar la ayuda
 */
async function removeMissingCaps(id) {
  const { round, removedCaps } = state;
  if (!round?.placed || !round.removeTotal) return;
  for (let i = round.placed - 1; i >= 0 && removedCaps.size < round.removeTotal; i--) {
    const capId = `cap-${i}`;
    if (removedCaps.has(capId)) continue;
    removedCaps.add(capId);
    notify();
    say(feminineNumber(removedCaps.size));
    await wait(800);
    if (isStale(id)) return;
  }
}

/** @param {number} id  roundId al empezar la ayuda */
async function countOneByOne(id) {
  const { round } = state;
  if (!round) return;
  let capIds;
  if (round.operation === 'dividir') {
    // Los platos son iguales: basta contar uno.
    capIds = state.plates[0].map((_, j) => `plate-0-${j}`);
  } else {
    capIds = Array.from({ length: capCount(round) }, (_, i) => `cap-${i}`).filter(
      (capId) => !state.removedCaps.has(capId),
    );
  }

  for (const capId of capIds) {
    state.countedCaps.set(capId, state.countedCaps.size + 1);
    state.highlightedCaps = new Set([capId]);
    notify();
    say(numberWord(state.countedCaps.size));
    await wait(TIMING.demoStepDelay);
    if (isStale(id)) return;
  }
}

/**
 * Multiplicar: cuenta por montones ("dos, cuatro, seis").
 * @param {number} id  roundId al empezar la ayuda
 */
async function countByPiles(id) {
  let capIndex = 0;
  let runningTotal = 0;
  for (const plate of state.round?.groups ?? []) {
    for (const pileOfCaps of plate) {
      const ids = [];
      for (let j = 0; j < pileOfCaps.length; j++) {
        runningTotal++;
        const capId = `cap-${capIndex++}`;
        state.countedCaps.set(capId, runningTotal);
        ids.push(capId);
      }
      state.highlightedCaps = new Set(ids);
      notify();
      say(numberWord(runningTotal));
      await wait(TIMING.demoGroupDelay);
      if (isStale(id)) return;
    }
  }
}
