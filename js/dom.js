/**
 * Utilidades para renderizar con innerHTML:
 *   escapeHTML     texto seguro en contenido y atributos
 *   applyStyleVars variables CSS sin style="" (CSP)
 *   updateZone     re-render solo si cambió, preservando el foco
 */

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/**
 * @param {unknown} value
 * @returns {string}
 */
export function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (char) => HTML_ESCAPES[/** @type {keyof typeof HTML_ESCAPES} */ (char)]);
}

/**
 * data-vars="--edge:#1d4ed8" → element.style.setProperty. La CSP (_headers) bloquea
 * style="" pero permite CSSOM desde nuestro JS. Solo custom properties (--*).
 * @param {ParentNode} root
 */
export function applyStyleVars(root) {
  for (const element of root.querySelectorAll('[data-vars]')) {
    if (!(element instanceof HTMLElement || element instanceof SVGElement)) continue;
    for (const declaration of (element.dataset.vars ?? '').split(';')) {
      const [name, value] = declaration.split(':').map((part) => part.trim());
      if (name?.startsWith('--') && value) element.style.setProperty(name, value);
    }
  }
}

/** Identidad estable de un control entre re-renders. */
const IDENTITY_ATTRIBUTES = [
  'name',
  'value',
  'data-action',
  'data-cap',
  'data-plate',
  'data-value',
  'data-level',
  'data-operation',
  'data-settings-action',
  'data-color',
  'data-index',
];

/**
 * p. ej. [data-action="tap-cap"][data-cap="cap-3"]
 * @param {Element} element
 * @returns {string}
 */
function identitySelector(element) {
  return IDENTITY_ATTRIBUTES.filter((attribute) => element.hasAttribute(attribute))
    .map((attribute) => `[${attribute}="${CSS.escape(element.getAttribute(attribute) ?? '')}"]`)
    .join('');
}

const lastHTML = new WeakMap();

/**
 * Sin cambios → no toca el DOM (no reinicia animaciones).
 * Con cambios → innerHTML y devuelve el foco al mismo control; si ya no existe,
 * al primero con la misma acción. Sin esto el foco cae en <body> en cada toque.
 * @param {HTMLElement} zone
 * @param {string} html
 */
export function updateZone(zone, html) {
  if (lastHTML.get(zone) === html) return;
  lastHTML.set(zone, html);

  const active = document.activeElement;
  const hadFocus = active instanceof HTMLElement && active !== zone && zone.contains(active);
  const selector = hadFocus ? identitySelector(active) : '';
  const action = hadFocus ? active.getAttribute('data-action') : null;

  zone.innerHTML = html;
  applyStyleVars(zone);
  if (!hadFocus) return;

  const target =
    (selector && zone.querySelector(selector)) ||
    (action && zone.querySelector(`[data-action="${CSS.escape(action)}"]`)) ||
    zone.querySelector('button, [tabindex="0"], input, select');
  if (target instanceof HTMLElement) target.focus();
}
