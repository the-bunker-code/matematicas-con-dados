/**
 * Persistencia de ajustes en localStorage. Nada identifica al niño (PRIVACY.md).
 * localStorage puede fallar (incógnito, cuota): ante error, valores por defecto.
 */

import { defaultSettings, clampDice, fixDiceColors, isOperationId, CAP_COLORS, DEFAULT_INVENTORY } from './config.js';

/** Cambio de esquema → :v2 + migración en normalizeSettings (con test de un v1 real). */
export const STORAGE_KEY = 'matematica-con-dados:v1';

const MAX_CAPS_PER_COLOR = 50;

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
const isPlainObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

/** @param {unknown} id */
const isCapColorId = (id) => CAP_COLORS.some((color) => color.id === id);

/**
 * Entrada no confiable (editable a mano): parte de los defaults y copia solo
 * los campos que pasan una validación cerrada.
 * @param {unknown} raw
 * @returns {import('./config.js').Settings}
 */
export function normalizeSettings(raw) {
  const settings = defaultSettings();
  if (!isPlainObject(raw)) return settings;

  if (isOperationId(raw.operation)) settings.operation = raw.operation;
  if (Number.isInteger(raw.dice)) settings.dice = /** @type {number} */ (raw.dice);
  if (raw.preferredLevel === 2 || raw.preferredLevel === 3 || raw.preferredLevel === 4) {
    settings.preferredLevel = raw.preferredLevel;
  }
  if (raw.faces === 3 || raw.faces === 6) settings.faces = raw.faces;
  if (raw.rounds === 3 || raw.rounds === 5 || raw.rounds === 8) settings.rounds = raw.rounds;
  if (typeof raw.voice === 'boolean') settings.voice = raw.voice;
  if (typeof raw.sound === 'boolean') settings.sound = raw.sound;
  if (typeof raw.realCaps === 'boolean') settings.realCaps = raw.realCaps;

  if (Array.isArray(raw.diceColors)) {
    raw.diceColors.slice(0, 4).forEach((id, i) => {
      if (isCapColorId(id)) settings.diceColors[i] = id;
    });
  }

  settings.inventory = { ...DEFAULT_INVENTORY };
  if (isPlainObject(raw.inventory)) {
    // Itera colores conocidos, no claves de entrada: inmune a "__proto__".
    for (const { id } of CAP_COLORS) {
      const count = raw.inventory[id];
      if (Number.isInteger(count)) {
        settings.inventory[id] = Math.min(MAX_CAPS_PER_COLOR, Math.max(0, /** @type {number} */ (count)));
      }
    }
  }

  // Caja vacía: tapitas reales no es jugable.
  if (Object.values(settings.inventory).every((count) => count === 0)) settings.realCaps = false;

  return clampDice(fixDiceColors(settings));
}

/** @returns {import('./config.js').Settings} */
export function loadSettings() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return normalizeSettings(saved ? JSON.parse(saved) : null);
  } catch {
    return defaultSettings(); // JSON inválido o storage bloqueado
  }
}

/** @param {import('./config.js').Settings} settings */
export function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Sin storage: los ajustes viven solo en memoria.
  }
}
