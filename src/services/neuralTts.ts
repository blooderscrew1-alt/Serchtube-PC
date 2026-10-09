/**
 * TTS Neuronal — voces ultra-realistas para el asistente de voz.
 *
 * Motor: endpoint propio `/api/tts` del servidor (server.ts), que sintetiza con
 * Gemini TTS (voces IA hiperrealistas; requiere GEMINI_API_KEY, que AI Studio
 * inyecta automáticamente al desplegar) y, si no hay key, responde con
 * Google Translate TTS (gratis, sin configuración).
 *
 * Si el endpoint no está disponible (app abierta sin servidor), SpeechService
 * cae automáticamente a las voces locales del navegador (speechSynthesis).
 */

import { VoicePersonality } from '../types';

export interface NeuralVoiceInfo {
  /** Identificador de la voz (voiceName de Gemini TTS), ej: 'Puck' */
  id: string;
  /** Nombre para mostrar, ej: 'Puck' */
  name: string;
  /** Descripción del carácter de la voz */
  description: string;
  gender: 'H' | 'M';
}

/**
 * Catálogo curado de voces neuronales de Gemini TTS (todas multilingües:
 * leen español de forma nativa y natural).
 */
export const NEURAL_VOICES: NeuralVoiceInfo[] = [
  { id: 'Puck', name: 'Puck', description: 'Alegre y animada', gender: 'H' },
  { id: 'Charon', name: 'Charon', description: 'Informativa, estilo noticiero', gender: 'H' },
  { id: 'Fenrir', name: 'Fenrir', description: 'Enérgica y viva', gender: 'H' },
  { id: 'Iapetus', name: 'Iapetus', description: 'Clara y nítida', gender: 'H' },
  { id: 'Sadachbia', name: 'Sadachbia', description: 'Vibrante y dinámica', gender: 'H' },
  { id: 'Zubenelgenubi', name: 'Zubé', description: 'Casual y relajada', gender: 'H' },
  { id: 'Achird', name: 'Achird', description: 'Amistosa y cercana', gender: 'H' },
  { id: 'Zephyr', name: 'Zephyr', description: 'Brillante y luminosa', gender: 'M' },
  { id: 'Kore', name: 'Kore', description: 'Firme y segura', gender: 'M' },
  { id: 'Leda', name: 'Leda', description: 'Joven y fresca', gender: 'M' },
  { id: 'Aoede', name: 'Aoede', description: 'Suave y agradable', gender: 'M' },
  { id: 'Autonoe', name: 'Autonoe', description: 'Optimista y brillante', gender: 'M' },
  { id: 'Sulafat', name: 'Sulafat', description: 'Cálida y acogedora', gender: 'M' },
  { id: 'Gacrux', name: 'Gacrux', description: 'Madura y serena', gender: 'M' }
];

export const DEFAULT_NEURAL_VOICE = 'Puck';

/** Agrupación por género para el selector de Ajustes */
export const NEURAL_VOICE_GROUPS: Array<{ label: string; voices: NeuralVoiceInfo[] }> = [
  { label: '♀ Voces femeninas', voices: NEURAL_VOICES.filter(v => v.gender === 'M') },
  { label: '♂ Voces masculinas', voices: NEURAL_VOICES.filter(v => v.gender === 'H') }
];

/**
 * Directiva de estilo (en español) que se envía al servidor para modular la
 * actitud de la voz neuronal según la personalidad del asistente.
 */
export const PERSONALITY_TTS_STYLES: Record<VoicePersonality, string> = {
  directa: 'Lee el siguiente texto en voz alta, en español, con un tono claro, directo y eficiente, como un asistente de voz profesional.',
  animada: 'Lee el siguiente texto en voz alta, en español, con mucha energía, alegría y entusiasmo contagioso.',
  formal: 'Lee el siguiente texto en voz alta, en español, con un tono formal, elegante y tranquilo.',
  zen: 'Lee el siguiente texto en voz alta, en español, con un tono muy tranquilo, suave y relajante.',
  conductor: 'Lee el siguiente texto en voz alta, en español, como un locutor de radio enérgico dirigiéndose al conductor.',
  jarvis: 'Lee el siguiente texto en voz alta, en español, como un mayordomo digital sofisticado, sereno y confiable.',
  copiloto_rally: 'Lee el siguiente texto en voz alta, en español, con la urgencia y energía de un copiloto de rally.',
  locutor_fm: 'Lee el siguiente texto en voz alta, en español, como un locutor profesional de radio FM con carisma.',
  calida: 'Lee el siguiente texto en voz alta, en español, con calidez, amabilidad y cercanía.',
  cyberpunk: 'Lee el siguiente texto en voz alta, en español, con un tono frío, futurista y ligeramente robótico pero natural.'
};

/** Devuelve true si el entorno actual puede consultar el endpoint neuronal */
export function isNeuralTtsSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof fetch === 'function' &&
    (window.location.protocol === 'http:' || window.location.protocol === 'https:')
  );
}

/**
 * Proveedor que respondió la última síntesis: 'gemini' (voces reales variadas)
 * o 'google-translate' (modo básico sin clave: voz única, sin tono/velocidad).
 */
let lastProvider: 'gemini' | 'google-translate' | 'desconocido' = 'desconocido';
const providerListeners: Array<(p: string) => void> = [];

export function getNeuralProvider(): string {
  return lastProvider;
}

export function subscribeNeuralProvider(cb: (p: string) => void): () => void {
  providerListeners.push(cb);
  return () => {
    const i = providerListeners.indexOf(cb);
    if (i >= 0) providerListeners.splice(i, 1);
  };
}

function setProvider(p: string) {
  const normalized = p === 'gemini' ? 'gemini' : p === 'google-translate' ? 'google-translate' : 'desconocido';
  if (normalized === lastProvider) return;
  lastProvider = normalized;
  for (const cb of providerListeners) {
    try { cb(normalized); } catch (_) {}
  }
}

// ---------------------------------------------------------------------------
// Caché de audio (respuestas repetidas suenan al instante)
// ---------------------------------------------------------------------------

const MAX_CACHE_ENTRIES = 48;
const audioCache = new Map<string, Blob>();

function cacheKey(voice: string, style: string, text: string): string {
  return `${voice}|${style}|${text}`;
}

function cachePut(key: string, blob: Blob) {
  if (audioCache.size >= MAX_CACHE_ENTRIES) {
    const oldest = audioCache.keys().next().value;
    if (oldest !== undefined) audioCache.delete(oldest);
  }
  audioCache.set(key, blob);
}

// ---------------------------------------------------------------------------
// Síntesis
// ---------------------------------------------------------------------------

export interface NeuralSynthesisOptions {
  /** Motor neuronal: 'elevenlabs', 'gemini' o 'edge' (voces en línea de Microsoft, gratis) */
  engine?: 'elevenlabs' | 'gemini' | 'edge';
  /** Voz neuronal, ej: 'Puck' (Gemini) */
  voice?: string;
  /** Voz de ElevenLabs (voice_id) */
  elvoice?: string;
  /** Directiva de estilo (ver PERSONALITY_TTS_STYLES) */
  style?: string;
  /**
   * Actitud general para el motor de Edge ('excited', 'calm', 'soft'…), derivada de
   * la personalidad del asistente. Se aplica a los tramos sin etiqueta propia.
   */
  expr?: string;
  /** Multiplicador de velocidad (ElevenLabs; 1.0 = normal) */
  speed?: number;
  /** Permite abortar una síntesis en curso (p.ej. llegó una orden más nueva) */
  shouldAbort?: () => boolean;
  /** Milisegundos máximos de espera (por defecto 15000) */
  timeoutMs?: number;
}

/**
 * Sintetiza `text` con el motor neuronal del servidor y devuelve el audio
 * (WAV de Gemini o MP3 de Google Translate). Lanza error si el servidor no
 * responde; el llamador debe estar preparado para hacer fallback a
 * speechSynthesis del navegador.
 */
export async function synthesizeNeuralSpeech(text: string, options: NeuralSynthesisOptions = {}): Promise<Blob> {
  const cleanText = (text || '').trim();
  if (!cleanText) throw new Error('Texto vacío');

  if (!isNeuralTtsSupported()) {
    throw new Error('TTS neuronal no disponible en este contexto (se requiere servidor http/https)');
  }

  const voice = options.voice || DEFAULT_NEURAL_VOICE;
  const style = options.style || '';
  const engine = options.engine || 'gemini';
  const elvoice = options.elvoice || '';

  const key = cacheKey(`${engine}|${voice}|${elvoice}`, style, cleanText);
  const cached = audioCache.get(key);
  if (cached) return cached;

  const controller = new AbortController();
  const t0 = Date.now();
  // El servidor tiene su propio presupuesto (Gemini 14 s y luego respaldo): el
  // cliente espera un poco mas y, si no llega nada, la cadena pasa a la voz local.
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? (engine === 'gemini' ? 18000 : 15000));
  // Cancelación cooperativa: si llega una orden más nueva, aborta el fetch
  const abortPoll = options.shouldAbort
    ? setInterval(() => { if (options.shouldAbort!()) controller.abort(); }, 250)
    : null;

  try {
    const params = new URLSearchParams({ text: cleanText, voice, engine });
    if (style) params.set('style', style);
    if (options.expr) params.set('expr', options.expr);
    if (elvoice) params.set('elvoice', elvoice);
    if (options.speed && options.speed !== 1) params.set('speed', String(options.speed));

    const res = await fetch(`/api/tts?${params.toString()}`, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`Servidor TTS respondió HTTP ${res.status}`);
    }
    const proveedor = res.headers.get('X-TTS-Provider') || 'desconocido';
    setProvider(proveedor);
    const blob = await res.blob();
    if (blob.size < 100) {
      throw new Error('Respuesta TTS vacía o inválida');
    }
    const msServidor = res.headers.get('X-TTS-Ms');
    console.log(`[TTS] ${engine} listo en ${Date.now() - t0} ms (proveedor: ${proveedor}${msServidor ? `, servidor: ${msServidor} ms` : ''})`);
    cachePut(key, blob);
    return blob;
  } finally {
    clearTimeout(timeout);
    if (abortPoll) clearInterval(abortPoll);
  }
}
