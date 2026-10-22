/** Entrada: carga ajustes, conecta estado → render y enruta data-action. */

import * as game from './game.js';
import { render } from './render.js';
import { loadSettings } from './storage.js';
import { unlockAudio } from './audio.js';
import { openSettings, setupSettingsPanel } from './settings-panel.js';
import { icon } from './icons.js';

/**
 * data-action → handler. Botón nuevo: data-action en el HTML + una entrada aquí.
 * @type {Record<string, (element: HTMLElement) => void>}
 */
const ACTIONS = {
  'open-settings': () => openSettings(),
  'set-level': (el) => game.setPreferredLevel(Number(el.dataset.level)),
  'start-operation': (el) => {
    unlockAudio(); // primer gesto del usuario
    game.startOperation(el.dataset.operation);
  },
  'repeat-prompt': () => game.repeatPrompt(),
  'tap-cap': (el) => game.tapCap(el.dataset.cap),
  'tap-pile': () => game.tapPile(),
  'tap-plate': (el) => game.tapPlate(Number(el.dataset.plate)),
  'confirm-distributed': () => game.confirmDistributed(),
  'choose-answer': (el) => game.chooseAnswer(Number(el.dataset.value)),
  'go-home': () => game.goHome(),
  'play-again': () => game.startSession(),
};

/** @param {HTMLElement} element */
function runAction(element) {
  const handler = ACTIONS[element.dataset.action ?? ''];
  if (handler) handler(element);
}

/**
 * Respeta aria-disabled además de disabled (ver renderAnswers).
 * @param {HTMLElement} element
 */
function isEnabled(element) {
  return (
    !(element instanceof HTMLButtonElement && element.disabled) && element.getAttribute('aria-disabled') !== 'true'
  );
}

// Delegación: un listener para todo; closest() cubre clics en hijos y nodos re-renderizados.
document.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return;
  const element = event.target.closest('[data-action]');
  if (element instanceof HTMLElement && isEnabled(element)) runAction(element);
});

// Enter/Espacio para <div role="button"> (platos). Solo con foco en el plato:
// las tapitas internas son <button> y el navegador ya las activa.
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const element = event.target;
  if (!(element instanceof HTMLElement) || !element.matches('[role="button"][data-action]')) return;
  event.preventDefault(); // evita el scroll con Espacio
  runAction(element);
});

// Íconos estáticos: <span data-icon="settings"> → SVG.
document.querySelectorAll('[data-icon]').forEach((element) => {
  if (element instanceof HTMLElement) {
    element.innerHTML = icon(/** @type {import('./icons.js').IconName} */ (element.dataset.icon));
  }
});

document.getElementById('boot-message')?.remove();

game.onChange(render);
setupSettingsPanel();
game.init(loadSettings());

// Offline (sw.js). Requiere contexto seguro; si falla, el juego solo pierde el modo offline.
if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
