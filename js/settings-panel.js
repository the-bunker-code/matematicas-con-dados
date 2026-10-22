/**
 * Panel de ajustes del adulto, sobre <dialog> nativo (backdrop, Escape y foco gratis).
 * Edita un `draft`; solo "Guardar" lo aplica, así cancelar no deshace nada.
 * Sin escapeHTML: todo sale de config.js o de números ya normalizados.
 */

import {
  OPERATIONS,
  LEVEL_NAMES,
  CAP_COLORS,
  DEFAULT_INVENTORY,
  diceLabel,
  diceForLevel,
  clampDice,
  fixDiceColors,
  isOperationId,
  totalCaps,
} from './config.js';
import { icon } from './icons.js';
import { updateZone } from './dom.js';
import * as game from './game.js';

/** @typedef {import('./config.js').Settings} Settings */

/** Debe coincidir con storage.js. */
const MAX_CAPS_PER_COLOR = 50;

const dialog = () => /** @type {HTMLDialogElement} */ (document.getElementById('settings-dialog'));
const body = () => /** @type {HTMLElement} */ (document.getElementById('settings-body'));
const saveButton = () => /** @type {HTMLButtonElement} */ (document.getElementById('settings-save'));

/** @type {Settings} */
let draft = structuredClone(game.state.settings);
let openedFromHome = false;
let savedOnClose = false;

export function openSettings() {
  openedFromHome = game.state.screen === 'home';
  game.pause();
  draft = structuredClone(game.state.settings);
  renderPanel();
  dialog().showModal();
}

function closeSettings() {
  dialog().close();
}

// --- Vista ------------------------------------------------------------------

/**
 * @template {string | number | boolean} T
 * @typedef {{ value: T, label: string }} Option
 */

/**
 * Radios con estilo de pastilla; el nombre accesible lo da el <legend> de section().
 * @template {string | number | boolean} T
 * @param {string} name
 * @param {Option<T>[]} options
 * @param {T} current
 * @param {(value: T) => boolean} [isDisabled]
 */
function radioGroup(name, options, current, isDisabled = () => false) {
  const pills = options.map(({ value, label }) => {
    const disabled = isDisabled(value);
    return `
    <label class="pill ${disabled ? 'is-disabled' : ''}">
      <input type="radio" name="${name}" value="${value}" ${value === current ? 'checked' : ''} ${disabled ? 'disabled' : ''}>
      <span>${label}</span>
    </label>`;
  });
  return `<div class="pill-group">${pills.join('')}</div>`;
}

/**
 * @param {string} title
 * @param {string} content
 * @param {string} [note]
 */
function section(title, content, note = '') {
  return `
    <fieldset class="settings-section">
      <legend>${title}</legend>
      ${content}
      ${note ? `<p class="settings-note">${note}</p>` : ''}
    </fieldset>`;
}

/** @param {import('./config.js').CapColor} color */
function inventoryItemHTML(color) {
  const count = draft.inventory[color.id];
  return `
        <div class="inventory__item">
          <span class="inventory__swatch" data-vars="--cap-base:${color.base};--cap-shine:${color.shine}"></span>
          <span class="inventory__name" id="inventory-${color.id}">${color.plural}</span>
          <button type="button" class="stepper" data-settings-action="decrease" data-color="${color.id}" aria-label="Quitar una ${color.singular}">${icon('minus', { size: 16 })}</button>
          <output aria-labelledby="inventory-${color.id}">${count}</output>
          <button type="button" class="stepper" data-settings-action="increase" data-color="${color.id}" aria-label="Agregar una ${color.singular}">${icon('plus', { size: 16 })}</button>
        </div>`;
}

/**
 * Colores agotados quedan deshabilitados.
 * @param {string} current
 * @param {number} index
 */
function diceColorHTML(current, index) {
  const options = CAP_COLORS.map(
    (c) => `
            <option value="${c.id}" ${c.id === current ? 'selected' : ''} ${draft.inventory[c.id] ? '' : 'disabled'}>
              ${c.plural} (${draft.inventory[c.id]})</option>`,
  );
  return `
        <label class="settings-row"><span>Dado ${index + 1}</span>
          <select name="diceColor" data-index="${index}">${options.join('')}
          </select>
        </label>`;
}

function renderPanel() {
  const operation = OPERATIONS[draft.operation];
  const levels = [2, 3, 4];
  const caps = totalCaps(draft.inventory);
  const operationOptions = Object.entries(OPERATIONS).map(([value, op]) => ({
    value,
    label: `${icon(op.icon, { size: 16, strokeWidth: 3 })} ${op.name}`,
  }));

  const html = [
    section('Operación', radioGroup('operation', operationOptions, draft.operation)),

    section(
      'Nivel',
      radioGroup(
        'dice',
        levels.map((d) => ({ value: d, label: `${LEVEL_NAMES[d]} · ${diceLabel(d)}` })),
        draft.dice,
        (d) => d > operation.maxDice,
      ),
      `Contar, Sumar y Restar: hasta 4 dados (en Contar, todas las tapitas en un montón). Multiplicar: hasta 3, y nunca más de ${caps} tapitas (las de tu caja). Dividir: 2.`,
    ),

    section(
      'Dados y sesión',
      `
      <div class="settings-row"><span>Caras del dado</span>
        ${radioGroup(
          'faces',
          [
            { value: 3, label: '1 a 3' },
            { value: 6, label: '1 a 6' },
          ],
          draft.faces,
        )}</div>
      <div class="settings-row"><span>Rondas</span>
        ${radioGroup(
          'rounds',
          [3, 5, 8].map((n) => ({ value: n, label: String(n) })),
          draft.rounds,
        )}</div>`,
      '"1 a 3" mantiene los números pequeños aunque haya más dados.',
    ),

    section(
      'Tapitas',
      radioGroup(
        'realCaps',
        [
          { value: false, label: 'En pantalla' },
          { value: true, label: 'Reales en la mesa' },
        ],
        draft.realCaps,
      ),
      '"Reales": la pantalla muestra los dados y le dice al adulto qué sacar de la caja. Es la mejor opción cuando hay un adulto al lado.',
    ),

    section(
      'Sonido',
      `
      <label class="switch"><input type="checkbox" name="voice" ${draft.voice ? 'checked' : ''}><span>Voz que cuenta</span></label>
      <label class="switch"><input type="checkbox" name="sound" ${draft.sound ? 'checked' : ''}><span>Sonidos</span></label>`,
    ),

    section(
      'Color fijo de cada dado',
      `<div class="dice-colors">${draft.diceColors.map(diceColorHTML).join('')}
      </div>`,
      'Mantener siempre el mismo color ayuda a reconocer cada dado.',
    ),

    section(
      `Mi caja de tapitas (${caps})`,
      `
      <div class="inventory">${CAP_COLORS.map(inventoryItemHTML).join('')}
      </div>
      <button type="button" class="link-button" data-settings-action="reset-inventory">Restaurar la caja de la foto</button>
      ${caps === 0 ? '<p class="settings-warning" role="alert">Agrega al menos una tapita para poder guardar.</p>' : ''}`,
      'Nunca pedirá más tapitas de las que hay.',
    ),
  ].join('');

  updateZone(body(), html);
  // Caja vacía: imposible cumplir "nunca más tapitas de las que hay".
  saveButton().disabled = caps === 0;
}

// --- Eventos del panel ------------------------------------------------------

/** @param {Event} event */
function onInputChange(event) {
  const input = event.target;
  if (!(input instanceof HTMLInputElement || input instanceof HTMLSelectElement)) return;
  switch (input.name) {
    case 'operation':
      if (!isOperationId(input.value)) return;
      draft.operation = input.value;
      draft.dice = diceForLevel(input.value, draft.preferredLevel);
      break;
    case 'dice': {
      const dice = Number(input.value);
      draft.dice = dice;
      if (dice === 2 || dice === 3 || dice === 4) draft.preferredLevel = dice;
      break;
    }
    case 'faces':
      draft.faces = input.value === '6' ? 6 : 3;
      break;
    case 'rounds':
      draft.rounds = input.value === '8' ? 8 : input.value === '3' ? 3 : 5;
      break;
    case 'realCaps':
      draft.realCaps = input.value === 'true';
      break;
    case 'voice':
    case 'sound':
      draft[input.name] = input instanceof HTMLInputElement && input.checked;
      break;
    case 'diceColor':
      draft.diceColors[Number(input.dataset.index)] = input.value;
      break;
    default:
      return;
  }
  renderPanel();
}

/** @param {MouseEvent} event */
function onPanelClick(event) {
  if (!(event.target instanceof Element)) return;
  const button = event.target.closest('[data-settings-action]');
  if (!(button instanceof HTMLElement)) return;
  const { settingsAction, color = '' } = button.dataset;

  if (settingsAction === 'increase') {
    draft.inventory[color] = Math.min(MAX_CAPS_PER_COLOR, draft.inventory[color] + 1);
  }
  if (settingsAction === 'decrease') draft.inventory[color] = Math.max(0, draft.inventory[color] - 1);
  if (settingsAction === 'reset-inventory') draft.inventory = { ...DEFAULT_INVENTORY };
  renderPanel();
}

/**
 * No inventa tapitas: con caja vacía el guardado ya está bloqueado (renderPanel).
 * @returns {Settings}
 */
function finalizeDraft() {
  return clampDice(fixDiceColors(draft));
}

/** Una sola vez, desde main.js. */
export function setupSettingsPanel() {
  const panel = dialog();
  body().addEventListener('change', onInputChange);
  body().addEventListener('click', onPanelClick);

  saveButton().addEventListener('click', () => {
    savedOnClose = true;
    game.applySettings(finalizeDraft());
    closeSettings();
  });
  document.getElementById('settings-cancel')?.addEventListener('click', closeSettings);
  document.getElementById('settings-home')?.addEventListener('click', () => {
    closeSettings();
    game.goHome();
  });

  // Cerrar sin guardar a mitad de ronda → inicio: la ronda quedó pausada al abrir.
  panel.addEventListener('close', () => {
    if (!savedOnClose && !openedFromHome && game.state.screen === 'game') game.goHome();
    savedOnClose = false;
  });

  // Clic en el backdrop. El <dialog> no tiene padding: un clic interno siempre cae en un hijo.
  panel.addEventListener('click', (event) => {
    if (event.target === panel) closeSettings();
  });
}
