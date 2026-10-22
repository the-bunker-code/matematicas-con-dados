/**
 * Mascota: tapita roja, siempre la misma (ancla visual).
 * Moods: idle (inicio de ronda), think (ayuda), happy (acierto).
 */

/** Polígono del borde dentado: alterna radio exterior e interior. */
function scallopedEdge(points = 22, outer = 48, inner = 44) {
  const coords = [];
  for (let i = 0; i < points * 2; i++) {
    const angle = (Math.PI * i) / points;
    const radius = i % 2 === 0 ? outer : inner;
    coords.push(`${(50 + radius * Math.cos(angle)).toFixed(1)},${(50 + radius * Math.sin(angle)).toFixed(1)}`);
  }
  return coords.join(' ');
}

const EDGE = scallopedEdge();
const INK = '#3b1d12';
const MOUTH = '#7a2a1a';

/** @typedef {'idle'|'happy'|'think'} Mood */

/** @type {Record<Mood, string>} */
const FACES = {
  idle: `
    <circle cx="37" cy="46" r="6.5" fill="${INK}"/><circle cx="63" cy="46" r="6.5" fill="${INK}"/>
    <circle cx="39" cy="44" r="2.4" fill="#fff"/><circle cx="65" cy="44" r="2.4" fill="#fff"/>
    <path d="M38 59 q12 10 24 0" stroke="${MOUTH}" stroke-width="4" fill="none" stroke-linecap="round"/>`,
  happy: `
    <path d="M29 46 q7 -9 14 0 M57 46 q7 -9 14 0" stroke="${INK}" stroke-width="4.5" fill="none" stroke-linecap="round"/>
    <path d="M35 58 q15 17 30 0 z" fill="${MOUTH}"/>
    <path d="M43 65 q7 5 14 0" fill="#ff8f86"/>`,
  think: `
    <circle cx="37" cy="45" r="6" fill="${INK}"/><circle cx="63" cy="45" r="6" fill="${INK}"/>
    <circle cx="35" cy="42" r="2.2" fill="#fff"/><circle cx="61" cy="42" r="2.2" fill="#fff"/>
    <path d="M29 34 l12 -3 M59 31 l12 3" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
    <ellipse cx="50" cy="63" rx="4.5" ry="4" fill="${MOUTH}"/>`,
};

/**
 * @param {Mood} [mood]
 * @returns {string}
 */
export function mascotSVG(mood = 'idle') {
  return `
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <polygon points="${EDGE}" fill="#d93b30"/>
      <circle cx="50" cy="50" r="39" fill="#ff5f52"/>
      <circle cx="50" cy="50" r="35" fill="none" stroke="#ffffff66" stroke-width="2" stroke-dasharray="3 4"/>
      <ellipse cx="36" cy="27" rx="12" ry="5.5" fill="#ffffff55" transform="rotate(-22 36 27)"/>
      ${FACES[mood] ?? FACES.idle}
      <ellipse cx="27" cy="58" rx="6" ry="4" fill="#ffaaa0"/>
      <ellipse cx="73" cy="58" rx="6" ry="4" fill="#ffaaa0"/>
    </svg>`;
}
