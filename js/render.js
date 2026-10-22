/**
 * Vista: state → HTML por zona, aplicado con updateZone() (dom.js).
 * - Colores vía data-vars, no style="": la CSP bloquea estilos inline.
 * - Sin escapeHTML: todo lo interpolado viene de config.js o son números.
 * - Sin onclick: data-action + delegación en main.js.
 */

import {
  OPERATIONS,
  HOME_THEME,
  LEVEL_NAMES,
  GENERAL_TIPS,
  ANSWER_COLORS,
  getCapColor,
  diceLabel,
  diceForLevel,
} from './config.js';
import { adultInstruction, capCount, resultPhrase } from './rules.js';
import { icon } from './icons.js';
import { mascotSVG } from './mascot.js';
import { updateZone } from './dom.js';

/** @typedef {import('./game.js').GameState} GameState */
/** @typedef {import('./config.js').Theme} Theme */

/**
 * Todos los ids existen en index.html.
 * @param {string} id
 * @returns {HTMLElement}
 */
const $ = (id) => /** @type {HTMLElement} */ (document.getElementById(id));

// --- Piezas -----------------------------------------------------------------

/**
 * Celdas con punto en la grilla 3×3 (0 = arriba a la izquierda).
 * @type {Record<number, number[]>}
 */
const PIP_POSITIONS = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

/** @param {{ value: number, color: string }} die */
function dieHTML({ value, color }) {
  const cells = Array.from({ length: 9 }, (_, i) =>
    PIP_POSITIONS[value].includes(i) ? '<span class="die__pip"></span>' : '<span></span>',
  ).join('');
  return `<div class="die" data-vars="--edge:${getCapColor(color).edge}" role="img" aria-label="Dado: ${value}">${cells}</div>`;
}

/**
 * @param {string} id
 * @param {string} colorId
 * @param {{ small?: boolean, action?: string, extra?: string, state: GameState }} options
 */
function capHTML(id, colorId, { small = false, action = 'tap-cap', extra = '', state }) {
  const color = getCapColor(colorId);
  const number = state.countedCaps.get(id);
  const classes = [
    'cap',
    small && 'cap--small',
    number && 'cap--counted',
    state.highlightedCaps.has(id) && 'cap--highlighted',
    state.removedCaps.has(id) && 'cap--removed',
  ]
    .filter(Boolean)
    .join(' ');
  const vars = `--cap-base:${color.base};--cap-shine:${color.shine};--cap-text:${color.text}`;
  return `<button type="button" class="${classes}" data-vars="${vars}" data-action="${action}" data-cap="${id}" ${extra}
    aria-label="Tapita ${color.singular}${number ? `, ${number}` : ''}">${number ?? ''}</button>`;
}

/**
 * Filas de hasta 5 (como un cartón de huevos): facilita la subitización.
 * @param {string} capsHTML
 * @param {string} colorId
 * @param {number} columns
 */
function capGroupHTML(capsHTML, colorId, columns) {
  return `<div class="cap-group" data-vars="--edge:${getCapColor(colorId).edge};--columns:${columns}">${capsHTML}</div>`;
}

/**
 * @param {import('./config.js').OperationId} operationId
 * @param {number} [size]
 */
function operationIcon(operationId, size = 24) {
  return icon(OPERATIONS[operationId].icon, { size, strokeWidth: 3 });
}

/** @param {Theme} theme */
function applyTheme(theme) {
  const root = document.documentElement.style;
  root.setProperty('--theme-main', theme.main);
  root.setProperty('--theme-dark', theme.dark);
  root.setProperty('--theme-light', theme.light);
  root.setProperty('--sky-top', theme.skyTop);
  root.setProperty('--sky-bottom', theme.skyBottom);
  root.setProperty('--hills', theme.hills);
}

// --- Inicio -----------------------------------------------------------------

/** @param {GameState} state */
function renderHome(state) {
  const { preferredLevel } = state.settings;
  updateZone($('home-mascot'), mascotSVG('happy'));

  updateZone(
    $('level-picker'),
    [2, 3, 4]
      .map(
        (level) => `
    <button type="button" class="level-button ${preferredLevel === level ? 'is-selected' : ''}"
      data-action="set-level" data-level="${level}" aria-pressed="${preferredLevel === level}">
      ${icon('dices', { size: 20 })}
      <span class="level-button__name">${LEVEL_NAMES[level]}</span>
      <span class="level-button__dice">${diceLabel(level)}</span>
    </button>`,
      )
      .join(''),
  );

  updateZone(
    $('operation-tiles'),
    Object.entries(OPERATIONS)
      .map(([id, operation]) => operationTileHTML(id, operation, preferredLevel))
      .join(''),
  );
}

/**
 * @param {string} id
 * @param {import('./config.js').Operation} operation
 * @param {number} preferredLevel
 */
function operationTileHTML(id, operation, preferredLevel) {
  const dice = diceForLevel(/** @type {import('./config.js').OperationId} */ (id), preferredLevel);
  return `
      <button type="button" class="operation-tile" data-action="start-operation" data-operation="${id}"
        data-vars="--tile-main:${operation.theme.main};--tile-dark:${operation.theme.dark}">
        <span class="operation-tile__icon">${operationIcon(/** @type {import('./config.js').OperationId} */ (id), 32)}</span>
        <span class="operation-tile__name">${operation.name}</span>
        <span class="operation-tile__dice">${diceLabel(dice)}</span>
      </button>`;
}

// --- Juego ------------------------------------------------------------------

// Contadores vistos en el último render: un cambio dispara la animación una vez.
let lastBounceCount = 0;
let lastWrongCount = 0;

/**
 * @param {GameState} state
 * @param {import('./rules.js').Round} round
 */
function renderTopBar(state, round) {
  const avatar = $('game-mascot');
  updateZone(avatar, mascotSVG(state.mood));
  // Reinicia la animación: quitar clase → forzar reflow → volver a ponerla.
  if (state.bounceCount !== lastBounceCount) {
    lastBounceCount = state.bounceCount;
    avatar.classList.remove('is-bouncing');
    void avatar.offsetWidth;
    avatar.classList.add('is-bouncing');
  }

  const { rounds } = state.settings;
  $('progress-fill').style.width = `${(100 * state.roundNumber) / rounds}%`;
  $('progress-text').textContent = `${state.roundNumber} / ${rounds}`;
  const progress = $('progress');
  progress.setAttribute('aria-valuenow', String(state.roundNumber));
  progress.setAttribute('aria-valuemax', String(rounds));
  progress.setAttribute('aria-valuetext', `${state.roundNumber} de ${rounds} rondas`);

  const operation = OPERATIONS[state.settings.operation];
  updateZone(
    $('operation-chip'),
    `
    <span class="operation-chip__icon">${operationIcon(state.settings.operation, 18)}</span>
    ${operation.name} · ${LEVEL_NAMES[state.settings.dice]}`,
  );
  $('prompt-text').textContent = round.prompt;
}

/**
 * Región aria-live. Solo se escribe si cambia: reescribir lo mismo hace que algunos lectores repitan.
 * @param {GameState} state
 * @param {import('./rules.js').Round} round
 */
function renderStatus(state, round) {
  const text = state.phase === 'solved' ? `Sí. ${resultPhrase(round)}` : round.prompt;
  const status = $('game-status');
  if (status.textContent !== text) status.textContent = text;
}

/**
 * @param {GameState} state
 * @param {import('./rules.js').Round} round
 */
function renderDiceRow(state, round) {
  const operation = OPERATIONS[round.operation];
  const between = operation.symbol
    ? `<span class="dice-row__symbol">${icon(operation.symbol, { size: 34, strokeWidth: 3.5 })}</span>`
    : '';
  let html;
  if (round.operation === 'dividir') {
    html = `<span class="dice-row__total">${round.total}</span>${between}${dieHTML(round.dice[0])}`;
  } else {
    html = round.dice.map(dieHTML).join(between);
  }
  const answer = state.phase === 'solved' ? round.answer : '?';
  html += `<span class="dice-row__symbol">${icon('equal', { size: 34, strokeWidth: 3.5 })}</span>
    <span class="result-box">${answer}</span>`;
  const row = $('dice-row');
  updateZone(row, html);
  // El CSS achica los dados según la cantidad en pantallas chicas.
  row.dataset.dice = String(round.dice.length);
}

/**
 * @param {GameState} state
 * @param {import('./rules.js').Round} round
 */
function renderTable(state, round) {
  const table = $('table-content');
  table.dataset.operation = round.operation;

  if (state.settings.realCaps) {
    updateZone(table, renderRealCapsInstruction(state, round));
  } else if (round.operation === 'dividir') {
    updateZone(table, renderDivision(state));
  } else {
    updateZone(table, renderGroups(state, round));
  }
}

/**
 * @param {GameState} state
 * @param {import('./rules.js').Round} round
 */
function renderRealCapsInstruction(state, round) {
  const needsConfirm = round.operation === 'dividir' && !state.distributed;
  return `
    <div class="real-caps">
      <span class="real-caps__icon">${icon('hand', { size: 44 })}</span>
      <p>${adultInstruction(round)}</p>
      ${needsConfirm ? '<button type="button" class="button button--primary" data-action="confirm-distributed">Ya repartimos</button>' : ''}
    </div>`;
}

/**
 * @param {GameState} state
 * @param {import('./rules.js').Round} round
 */
function renderGroups(state, round) {
  const small = capCount(round) > 15;
  let capIndex = 0;

  const groupsHTML = round.groups.map((group) => {
    const pilesHTML = group
      .map((pileOfCaps) => {
        const caps = pileOfCaps.map((color) => capHTML(`cap-${capIndex++}`, color, { small, state })).join('');
        return capGroupHTML(caps, pileOfCaps[0], Math.min(5, pileOfCaps.length));
      })
      .join('');
    // Multiplicar: cada grupo es un plato con montones.
    return round.operation === 'multiplicar'
      ? `<div class="plate plate--full" data-vars="--edge:${getCapColor(round.dice[0].color).edge}">${pilesHTML}</div>`
      : pilesHTML;
  });

  const plus = `<span class="table__symbol">${icon('plus', { size: 30, strokeWidth: 3.5 })}</span>`;
  let html = groupsHTML.join(round.operation === 'sumar' ? plus : '');

  if (round.operation === 'restar') {
    html += `<div class="storage-box" role="img" aria-label="Guardadas ${state.removedCaps.size} de ${round.removeTotal}">
      ${icon('package', { size: 26 })}<span aria-hidden="true">${state.removedCaps.size} / ${round.removeTotal}</span></div>`;
  }
  return html;
}

/** @param {GameState} state */
function renderDivision(state) {
  const pileHTML = state.pile.length
    ? capGroupHTML(
        state.pile.map((color, j) => capHTML(`pile-${j}`, color, { small: true, action: 'tap-pile', state })).join(''),
        state.pile[0],
        Math.min(8, state.pile.length),
      )
    : '';

  const platesHTML = state.plates
    .map((plate, p) => {
      const caps = plate
        .map((color, j) =>
          capHTML(`plate-${p}-${j}`, color, {
            small: true,
            // Durante el reparto, tocar una tapita del plato agrega otra a ese plato.
            action: state.distributed ? 'tap-cap' : 'tap-plate',
            extra: `data-plate="${p}"`,
            state,
          }),
        )
        .join('');
      // <div role="button">: un <button> no puede contener otros botones (las tapitas).
      return `<div class="plate" role="button" tabindex="0" data-action="tap-plate" data-plate="${p}" aria-label="Plato ${p + 1}, ${plate.length}">${caps}</div>`;
    })
    .join('');

  return `${pileHTML}<div class="plates">${platesHTML}</div>`;
}

/**
 * @param {GameState} state
 * @param {import('./rules.js').Round} round
 */
function renderAnswers(state, round) {
  const tray = $('answers');
  const hidden = round.operation === 'dividir' && !state.distributed;
  tray.hidden = hidden;
  if (hidden) return;

  const shake = state.wrongCount !== lastWrongCount;
  lastWrongCount = state.wrongCount;
  // aria-disabled, no disabled: conserva el foco. game.chooseAnswer() ya ignora el toque.
  const busy = state.phase === 'helping';

  const html = state.answerOptions
    .map((value, i) => {
      const classes = [
        'answer',
        state.phase === 'solved' && value === round.answer && 'is-correct',
        state.phase !== 'solved' && state.pulsingAnswer === value && 'is-pulsing',
        shake && state.wrongAnswer === value && 'is-shaking',
      ]
        .filter(Boolean)
        .join(' ');
      // Puntos bajo el número para quien aún no lee cifras.
      const dots = value <= 12 ? '<i></i>'.repeat(value) : '';
      return `
      <button type="button" class="${classes}" data-vars="--answer-color:${ANSWER_COLORS[i]}"
        data-action="choose-answer" data-value="${value}" aria-disabled="${busy}">
        <span class="answer__number">${value}</span>
        <span class="answer__dots" aria-hidden="true">${dots}</span>
      </button>`;
    })
    .join('');
  updateZone(tray, html);
}

/** @param {GameState} state */
function renderAdultTips(state) {
  const tips = [...OPERATIONS[state.settings.operation].adultTips, ...GENERAL_TIPS];
  updateZone($('adult-tips'), tips.map((tip) => `<li>${tip}</li>`).join(''));
}

/** @param {GameState} state */
function renderGame(state) {
  const { round } = state;
  if (!round) return;
  renderTopBar(state, round);
  renderStatus(state, round);
  renderDiceRow(state, round);
  renderTable(state, round);
  renderAnswers(state, round);
  renderAdultTips(state);
}

// --- Final ------------------------------------------------------------------

/** @param {GameState} state */
function renderEnd(state) {
  updateZone($('end-mascot'), mascotSVG('happy'));
  updateZone($('end-stars'), icon('star', { size: 44 }).repeat(state.settings.rounds));
  const buttons = $('end-buttons');
  buttons.classList.toggle('is-visible', state.endButtonsVisible);
  // inert: ocultos y fuera del orden de tabulación.
  buttons.inert = !state.endButtonsVisible;
}

// --- Foco entre pantallas ---------------------------------------------------

const SCREEN_FOCUS = { home: 'home-title', game: 'prompt', end: 'end-title' };

/** @type {GameState['screen'] | null} */
let lastScreen = null;

/**
 * Solo reubica el foco si quedó perdido (en body o en una pantalla oculta);
 * así no interfiere con el panel de ajustes.
 * @param {GameState['screen']} screen
 */
function moveFocusOnScreenChange(screen) {
  if (screen === lastScreen) return;
  const isFirstRender = lastScreen === null;
  lastScreen = screen;
  if (isFirstRender) return; // en la carga inicial decide el navegador

  const active = document.activeElement;
  const focusIsLost = !active || active === document.body || active.closest('[hidden]') !== null;
  if (focusIsLost) $(SCREEN_FOCUS[screen]).focus({ preventScroll: true });
}

// ----------------------------------------------------------------------------

/** @param {GameState} state */
export function render(state) {
  $('screen-home').hidden = state.screen !== 'home';
  $('screen-game').hidden = state.screen !== 'game';
  $('screen-end').hidden = state.screen !== 'end';

  if (state.screen === 'home') {
    applyTheme(HOME_THEME);
    renderHome(state);
  } else {
    applyTheme(OPERATIONS[state.settings.operation].theme);
    if (state.screen === 'game') renderGame(state);
    else renderEnd(state);
  }
  moveFocusOnScreenChange(state.screen);
}
