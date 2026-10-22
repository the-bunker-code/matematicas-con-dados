/**
 * Voz (Web Speech API) y tonos (Web Audio API), sin archivos de audio.
 * El audio requiere un gesto del usuario: unlockAudio() va en el primer toque.
 * Todo falla en silencio: sin audio, el juego sigue con el texto.
 */

let voiceEnabled = true;
let soundEnabled = true;

/** @param {{ voice: boolean, sound: boolean }} preferences */
export function setAudioPreferences({ voice, sound }) {
  voiceEnabled = voice;
  soundEnabled = sound;
}

// --- Voz --------------------------------------------------------------------

const hasSpeech = typeof window !== 'undefined' && 'speechSynthesis' in window;

/** Latinoamericano primero. */
const PREFERRED_LANGUAGES = ['es-mx', 'es-us', 'es-419', 'es-pe', 'es-co', 'es-ar', 'es-es', 'es'];

/** @type {SpeechSynthesisVoice | null} */
let spanishVoice = null;

/**
 * Privacidad: prioriza voces locales (localService); las remotas (p. ej. "Google…")
 * envían el texto a un servidor. Solo si no hay local se acepta remota
 * (el texto son frases del juego, nunca datos del niño).
 */
function pickSpanishVoice() {
  const voices = speechSynthesis.getVoices();
  /** @param {SpeechSynthesisVoice} voice @param {string} lang */
  const speaks = (voice, lang) => voice.lang.toLowerCase().replace('_', '-').startsWith(lang);

  for (const onlyLocal of [true, false]) {
    for (const lang of PREFERRED_LANGUAGES) {
      const match = voices.find((voice) => speaks(voice, lang) && (!onlyLocal || voice.localService));
      if (match) {
        spanishVoice = match;
        return;
      }
    }
  }
}

if (hasSpeech) {
  pickSpanishVoice();
  // getVoices() puede llegar vacío al inicio (Chrome/Safari); unlockAudio() reintenta.
  speechSynthesis.addEventListener('voiceschanged', pickSpanishVoice);
}

/**
 * Interrumpe por defecto: con toques rápidos se oye el último número, no una cola.
 * Resuelve al terminar, o a los 5 s (Safari a veces no emite onend).
 * @param {string} text
 * @param {{ interrupt?: boolean }} [options]
 * @returns {Promise<void>}
 */
export function say(text, { interrupt = true } = {}) {
  return new Promise((resolve) => {
    if (!voiceEnabled || !hasSpeech) return resolve();
    /** @type {ReturnType<typeof setTimeout> | undefined} */
    let fallback;
    const finish = () => {
      clearTimeout(fallback);
      resolve();
    };
    try {
      if (interrupt) speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = spanishVoice?.lang ?? 'es-MX';
      if (spanishVoice) utterance.voice = spanishVoice;
      utterance.rate = 0.9;
      utterance.pitch = 1.05;
      utterance.onend = finish;
      utterance.onerror = finish; // incluye 'interrupted' y 'canceled'
      speechSynthesis.speak(utterance);
      fallback = setTimeout(finish, 5000);
    } catch {
      finish();
    }
  });
}

export function stopVoice() {
  if (hasSpeech) speechSynthesis.cancel();
}

// --- Tonos ------------------------------------------------------------------

/** @type {AudioContext | null} */
let audioContext = null;

export function unlockAudio() {
  try {
    // webkitAudioContext: Safari < iOS 16.
    const AudioContextClass = window.AudioContext ?? /** @type {any} */ (window).webkitAudioContext;
    audioContext ??= new AudioContextClass();
    // Puede rechazar si aún no hay gesto válido; el próximo toque reintenta.
    if (audioContext?.state === 'suspended') audioContext.resume().catch(() => {});
  } catch {
    // Sin Web Audio: modo silencioso.
  }
  if (hasSpeech) pickSpanishVoice();
}

/**
 * Senoidal con caída exponencial.
 * @param {number} frequency  Hz
 * @param {number} [duration] s
 * @param {number} [volume]   0–1
 */
export function playTone(frequency, duration = 0.1, volume = 0.12) {
  if (!soundEnabled || !audioContext) return;
  try {
    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  } catch {
    // Un tono fallido no debe romper el juego.
  }
}

/** Acorde do-mi-sol arpegiado. */
export function playSuccess() {
  [523, 659, 784].forEach((note, i) => setTimeout(() => playTone(note, 0.18, 0.1), i * 110));
}

/** Grave y suave a propósito: no es un castigo. */
export function playMiss() {
  playTone(240, 0.14, 0.08);
}

/**
 * Sube con cada tapita: el número "se oye" crecer.
 * @param {number} n
 */
export function playCount(n) {
  playTone(330 + Math.min(n, 20) * 20, 0.08);
}
