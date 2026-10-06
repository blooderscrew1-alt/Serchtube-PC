import { VoicePersonality } from '../types';
import { AudioEngine } from './audioEngine';
import {
  synthesizeNeuralSpeech,
  isNeuralTtsSupported,
  DEFAULT_NEURAL_VOICE,
  NEURAL_VOICES,
  PERSONALITY_TTS_STYLES
} from './neuralTts';

export interface SpeechConfig {
  personality: VoicePersonality;
  voiceURI?: string;
  useEdgeReadAloudVoice?: boolean;
  /** Motor de voz: 'neural' = voces neuronales ultra-realistas de Microsoft (recomendado) */
  ttsEngine?: 'neural' | 'browser';
  /** Voz neuronal seleccionada, ej: 'es-MX-JorgeNeural' */
  neuralVoice?: string;
  /** Voice ID de ElevenLabs seleccionado (prioridad sobre Gemini) */
  elevenVoice?: string;
  /**
   * Orden de prioridad de motores de voz: el asistente intenta hablar con el
   * primero y, si falla o no hay cuota, baja al siguiente. Ej:
   * ['elevenlabs', 'gemini', 'edge'].
   */
  voicePriority?: ('elevenlabs' | 'gemini' | 'edge')[];
  speechRate: number;
  speechPitch: number;
  speechVolume?: number;
  duckingEnabled: boolean;
  continuousListening: boolean;
  wakeWordEnabled?: boolean;
  wakeWord?: string;
  satelliteMicOnly?: boolean;
  micFocusBoost?: boolean;
  postPlaybackCooldownMs?: number;
  audioInputDeviceId?: string; // ID del dispositivo de micrófono de entrada seleccionado
}

export function normalizeText(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents (música -> musica)
    .replace(/[^\w\s]/gi, "")       // Remove punctuation
    .trim();
}

/**
 * Distancia de Levenshtein simple para tolerancia fonética y typos en palabras clave
 */
function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

export interface WakeWordParseResult {
  hasWakeWord: boolean;
  commandText: string;
  isWakeWordOnly: boolean;
  matchedKeyword?: string;
}

/**
 * Variantes y deformaciones fonéticas habituales de la palabra "música"
 */
const MUSICA_VARIANTS = new Set([
  'musica', 'música', 'music', 'músic', 'musik', 'musicas', 'músicas',
  'musi', 'músi', 'musico', 'músico', 'musca', 'mujica', 'misica', 'nusica',
  'muica', 'muscia', 'musicaa', 'músicaa', 'musika', 'muzika', 'musika',
  'mussica', 'musica', 'mussika', 'musicá', 'musiká', 'músika', 'mucica',
  'mucisa', 'musisa', 'musira', 'muusica', 'musiica', 'musicaa', 'musíca',
  'musíka', 'musika', 'mhmusica', 'la musica', 'amusica'
]);

/**
 * ¿La palabra se parece suficiente a "musica" para considerarla la palabra de activación?
 * Tolerancia adaptada al reconocimiento real de voz (2 errores si empieza con "mu", 1 si no).
 */
function fuzzyMatchMusica(w: string): boolean {
  if (w.length < 4 || w.length > 9) return false;
  const dist = levenshteinDistance(w, 'musica');
  // Empieza con "mu" (lo más estable del audio): se toleran hasta 2 deformaciones
  if (w.startsWith('mu') && dist <= 2) return true;
  // Sin prefijo estable: exigir casi exactitud
  if (dist <= 1) return true;
  return false;
}

/**
 * Verbos y órdenes musicales directas que activan la acción sin necesidad de gritar "música"
 */
const DIRECT_MUSIC_VERBS = [
  'reproduce', 'reproducir', 'reproduceme', 'reprodúceme',
  'ponme', 'pon', 'ponte', 'poner', 'pón',
  'toca', 'tocar', 'tocame', 'tócame',
  'escuchar', 'escucha', 'quiero escuchar', 'quiero oir', 'quiero oír',
  'play', 'siguiente', 'anterior', 'pausa', 'pausar', 'reanuda', 'reanudar',
  'continua', 'continuar', 'sube volumen', 'baja volumen', 'silencio', 'silenciar'
];

export function parseWakeWord(transcript: string, wakeWord: string = "música"): WakeWordParseResult {
  const normTranscript = normalizeText(transcript);
  const normWakeWord = normalizeText(wakeWord) || "musica";

  if (!normTranscript) {
    return { hasWakeWord: false, commandText: '', isWakeWordOnly: false };
  }

  // 1. Verificación directa de la palabra clave configurada (con límites de palabra:
  // "musicaa" debe tratarse como variante completa, no como "musica" + "a")
  const boundaryRegex = new RegExp(`(?:^|\\s)${normWakeWord}(?=\\s|$)`);
  const boundaryMatch = normTranscript.match(boundaryRegex);
  let wakeWordIndex = boundaryMatch ? boundaryMatch.index + boundaryMatch[0].indexOf(normWakeWord) : -1;
  let matchedLength = normWakeWord.length;
  let matchedKeyword = normWakeWord;

  // 2. Si la palabra configurada es "música" o similar, cotejar con las variantes fonéticas
  if (wakeWordIndex === -1 && (normWakeWord === 'musica' || normWakeWord === 'musicas')) {
    const words = normTranscript.split(/\s+/);
    let cumulativeOffset = 0;

    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      const wordIdx = normTranscript.indexOf(w, cumulativeOffset);
      cumulativeOffset = wordIdx + w.length;

      // Coincidencia con lista de variantes
      if (MUSICA_VARIANTS.has(w)) {
        wakeWordIndex = wordIdx;
        matchedLength = w.length;
        matchedKeyword = w;
        break;
      }

      // Palabra cortada por el motor: "mu sica", "mu si ca" -> unir con las siguientes
      let joined = w;
      for (let k = i + 1; k < Math.min(i + 3, words.length); k++) {
        joined += words[k];
        if (MUSICA_VARIANTS.has(joined) || fuzzyMatchMusica(joined)) {
          const joinedEnd = normTranscript.indexOf(words[k], cumulativeOffset) + words[k].length;
          wakeWordIndex = wordIdx;
          matchedLength = joinedEnd - wordIdx;
          matchedKeyword = joined;
          break;
        }
      }
      if (wakeWordIndex !== -1) break;

      // Tolerancia fonética amplia adaptada a voz real
      if (fuzzyMatchMusica(w)) {
        wakeWordIndex = wordIdx;
        matchedLength = w.length;
        matchedKeyword = w;
        break;
      }
    }
  }

  // 3. Soporte para prefijos habituales ("oye música", "hey música", "serch", "oye serch")
  if (wakeWordIndex === -1) {
    const conversationalPrefixes = ['oye musica', 'hey musica', 'hola musica', 'ok musica', 'oye serch', 'serchtube', 'serch'];
    for (const prefix of conversationalPrefixes) {
      const pIdx = normTranscript.indexOf(prefix);
      if (pIdx !== -1) {
        wakeWordIndex = pIdx;
        matchedLength = prefix.length;
        matchedKeyword = prefix;
        break;
      }
    }
  }

  // 4. Reconocimiento de órdenes directas con verbos musicales ("reproduce maná", "pon coldplay", "siguiente")
  // Permite que el usuario hable con naturalidad sin tener que gritar la palabra clave
  if (wakeWordIndex === -1) {
    for (const verb of DIRECT_MUSIC_VERBS) {
      if (normTranscript.startsWith(verb + ' ') || normTranscript === verb) {
        const cleanCommand = normTranscript.trim();
        return {
          hasWakeWord: true,
          commandText: cleanCommand,
          isWakeWordOnly: false,
          matchedKeyword: verb
        };
      }
    }
  }

  if (wakeWordIndex === -1) {
    return { hasWakeWord: false, commandText: '', isWakeWordOnly: false };
  }

  // Extract text after the wake word
  const afterWakeWord = normTranscript.slice(wakeWordIndex + matchedLength).trim();

  // Strip leading filler words if present ("de", "que", "por favor", etc.)
  const cleanCommand = afterWakeWord
    .replace(/^(de|que|por favor|a ver|y|me|nos)\s+/, '')
    .trim();

  const isWakeWordOnly = cleanCommand.length === 0;

  return {
    hasWakeWord: true,
    commandText: isWakeWordOnly ? '' : cleanCommand,
    isWakeWordOnly,
    matchedKeyword
  };
}

export class SpeechService {
  private static instance: SpeechService | null = null;
  private recognition: any = null;
  private isListening = false;
  private isRecognitionSupported = false;
  private isSynthesizing = false;
  private cachedVoices: SpeechSynthesisVoice[] = [];
  private onVoicesChangedCallbacks: Array<(voices: SpeechSynthesisVoice[]) => void> = [];

  // Hardware Audio Stream for AEC (Acoustic Echo Cancellation) & AGC (Auto Gain Control)
  private micStream: MediaStream | null = null;
  private commandCooldownUntil = 0;
  private ttsGuardUntil = 0;
  private lastSpokenText = '';
  private lastSpokenTimestamp = 0;
  private lastSpeakRequestAt = 0;

  private config: SpeechConfig = {
    personality: 'directa',
    speechRate: 1.0,
    speechPitch: 1.0,
    speechVolume: 1.0,
    duckingEnabled: true,
    continuousListening: true,
    useEdgeReadAloudVoice: true,
    ttsEngine: 'neural',
    neuralVoice: DEFAULT_NEURAL_VOICE,
    voicePriority: ['elevenlabs', 'gemini', 'edge'],
    wakeWordEnabled: true,
    wakeWord: 'música',
    micFocusBoost: true,
    postPlaybackCooldownMs: 4500
  };

  // Reproductor de audio neuronal (MP3) y secuencia para cancelar órdenes obsoletas
  private neuralAudioEl: HTMLAudioElement | null = null;
  private ttsSeq = 0;

  private onTranscriptCallback?: (transcript: string, isFinal: boolean) => void;
  private onStatusChangeCallback?: (status: 'listening' | 'idle' | 'speaking' | 'processing' | 'error') => void;
  private isProcessingCommand = false;
  /** Cola final pendiente dentro de la misma sesión de reconocimiento (une frases cortadas) */
  private finalTail = '';
  /**
   * Micrófono caliente: cuando el asistente acaba de detectar la palabra de activación
   * y espera el comando del usuario, la escucha NO se bloquea aunque el TTS esté hablando
   * (el saludo de bienvenida ya no se come la orden que viene detrás).
   */
  private awaitingCommand = false;
  /**
   * Watchdog de arranque: al encender la PC, Windows/Edge aún no tienen listos los
   * micrófonos cuando la app arranca (el reconocimiento falla con 'audio-capture' en
   * silencio). Se reintenta cada 3 s hasta 100 veces y además se reacciona al evento
   * 'devicechange' cuando los micrófonos por fin aparecen.
   */
  private micRetryTimer: any = null;
  private micRetryAttempts = 0;
  private deviceChangeListenerAttached = false;

  private constructor() {
    this.initRecognition();
    this.initVoices();
  }

  private initVoices() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const updateVoices = () => {
        this.cachedVoices = window.speechSynthesis.getVoices();
        for (const cb of this.onVoicesChangedCallbacks) {
          try {
            cb(this.cachedVoices);
          } catch (_) {}
        }
      };

      this.cachedVoices = window.speechSynthesis.getVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = updateVoices;
      }
    }
  }

  public static getInstance(): SpeechService {
    if (!SpeechService.instance) {
      SpeechService.instance = new SpeechService();
    }
    return SpeechService.instance;
  }

  /**
   * Solicita explícitamente permisos de micrófono mediante getUserMedia y libera el track
   * de inmediato para que Web Speech API pueda capturar audio sin colisiones de hardware.
   */
  public async enableMicHardwareFocus(deviceId?: string): Promise<boolean> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return false;
    try {
      const chosenDevice = deviceId || this.config.audioInputDeviceId;
      if (chosenDevice === 'all' || chosenDevice === 'todos') {
        const devices = await this.getAudioInputDevices();
        if (devices.length > 0) {
          let anyOk = false;
          for (const dev of devices) {
            if (!dev.deviceId) continue;
            try {
              const stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: dev.deviceId } } });
              stream.getTracks().forEach(t => t.stop());
              anyOk = true;
            } catch (_) {}
          }
          if (anyOk) return true;
        }
      }
      const audioConstraint = (chosenDevice && chosenDevice !== 'default' && chosenDevice !== 'all' && chosenDevice !== 'todos')
        ? { deviceId: { exact: chosenDevice } }
        : true;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraint });
      stream.getTracks().forEach(t => t.stop());
      return true;
    } catch (e) {
      console.warn("[SpeechService] Aviso de micrófono:", e);
      return false;
    }
  }

  /**
   * Obtiene la lista completa de dispositivos de captura de audio (micrófonos) conectados.
   */
  public async getAudioInputDevices(): Promise<MediaDeviceInfo[]> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
      return [];
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter(d => d.kind === 'audioinput');
    } catch (err) {
      console.warn("[SpeechService] Error al enumerar micrófonos:", err);
      return [];
    }
  }

  public releaseMicHardwareFocus() {
    if (this.micStream) {
      try {
        this.micStream.getTracks().forEach(t => t.stop());
      } catch (_) {}
      this.micStream = null;
    }
  }

  /**
   * Establece un periodo de inmunidad/cooldown tras ejecutar una orden (ej: iniciar canción).
   * Durante este periodo se ignoran los audios capturados para evitar que los altavoces disparen órdenes falsas.
   */
  public setCommandCooldown(ms: number = 2500) {
    this.commandCooldownUntil = Date.now() + ms;
    this.resetSession();
  }

  public isInCooldown(): boolean {
    const now = Date.now();
    const isTtsSpeaking =
      this.isSynthesizing ||
      (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.speaking) ||
      now < this.ttsGuardUntil;
    return (now < this.commandCooldownUntil || isTtsSpeaking) && !this.isProcessingCommand;
  }

  private initRecognition() {
    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognitionClass) {
      this.isRecognitionSupported = true;
      try {
        this.recognition = new SpeechRecognitionClass();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        // Varias interpretaciones por frase: clave para rescatar la palabra de activación
        // cuando el motor la transcribe mal ("musika", "mujica", "mu sica"...)
        this.recognition.maxAlternatives = 5;

        // Dialecto español: priorizar es-MX si el navegador no reporta uno concreto
        const userLang = (typeof navigator !== 'undefined' && navigator.language && navigator.language.startsWith('es'))
          ? navigator.language
          : 'es-MX';
        this.recognition.lang = userLang;

        this.recognition.onstart = () => {
          this.isListening = true;
          this.finalTail = '';
          this.micRetryAttempts = 0;
          if (this.micRetryTimer) { clearTimeout(this.micRetryTimer); this.micRetryTimer = null; }
          if (this.config.wakeWordEnabled === false) {
            this.onStatusChangeCallback?.('listening');
          }
        };

        this.recognition.onspeechend = () => {
          // User paused speaking
        };

        this.recognition.onresult = (event: any) => {
          const now = Date.now();

          // 🛡️ INMUNIDAD ACÚSTICA CONTRA LA PROPIA VOZ DEL ASISTENTE (TTS Echo Suppression)
          // Descartar de raíz cualquier sonido si el asistente está hablando por síntesis de voz,
          // si está procesando una orden, o si estamos en la ventana de enfriamiento post-respuesta.
          // EXCEPCIÓN: si el micrófono está "caliente" (esperando comando tras la palabra clave),
          // la escucha continúa aunque el saludo del TTS siga sonando.
          const isTtsActive =
            this.isSynthesizing ||
            (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.speaking) ||
            now < this.ttsGuardUntil;

          if (this.isProcessingCommand || (!this.awaitingCommand && (now < this.commandCooldownUntil || isTtsActive))) {
            return;
          }

          let interimTranscript = '';
          let finalTranscript = '';
          // Alternativas del motor de reconocimiento (rescatan la palabra clave mal transcrita)
          const alternatives: string[] = [];

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const result = event.results[i];
            if (result.isFinal) {
              finalTranscript += result[0].transcript;
              for (let j = 1; j < result.length; ++j) {
                if (result[j] && result[j].transcript) alternatives.push(result[j].transcript);
              }
            } else {
              interimTranscript += result[0].transcript;
            }
          }

          // Acumular la cola de frases finales dentro de la misma sesión:
          // así "música" (final) + "eminem" (final, tras una pausa) se procesan JUNTOS
          const accumulatedFinal = (this.finalTail + ' ' + finalTranscript).trim();
          if (finalTranscript.trim()) {
            this.finalTail = accumulatedFinal;
          }

          const rawCandidate = (accumulatedFinal || interimTranscript).trim();
          if (!rawCandidate) return;

          let candidate = rawCandidate;

          // 🔁 Rescate por alternativas: si la interpretación principal no contiene la palabra
          // de activación pero una alternativa sí, usar esa alternativa como transcripción.
          if (this.config.wakeWordEnabled !== false && alternatives.length > 0) {
            const mainHit = parseWakeWord(candidate, this.config.wakeWord || 'música').hasWakeWord;
            if (!mainHit) {
              for (const alt of alternatives) {
                if (parseWakeWord(alt, this.config.wakeWord || 'música').hasWakeWord) {
                  console.log(`[SpeechService] 🔁 Alternativa rescatada: "${alt}" (principal: "${candidate}")`);
                  candidate = alt.trim();
                  break;
                }
              }
            }
          }

          // 🛡️ Filtro Semántico Antirruido de Eco:
          // Si el audio capturado coincide con la frase que el asistente acaba de decir
          const normCandidate = normalizeText(candidate);
          const normLastSpoken = normalizeText(this.lastSpokenText || '');
          if (
            this.lastSpokenText && now - this.lastSpokenTimestamp < 6000 &&
            normCandidate &&
            (normLastSpoken.includes(normCandidate) || normCandidate.includes(normLastSpoken))
          ) {
            console.log(`[SpeechService] 🔇 Eco de voz del asistente suprimido en micrófono: "${candidate}"`);
            return;
          }

          if (accumulatedFinal.trim()) {
            console.log("[SpeechService] 🎙️ Final:", accumulatedFinal.trim());
            this.onTranscriptCallback?.(accumulatedFinal.trim(), true);
            // Limpiar la cola tras emitir: si se conserva, el texto viejo se pega a la
            // siguiente frase y "música" sola se procesa como si ya trajera comando
            // (ejecución directa) en vez de activar la escucha con su animación.
            this.finalTail = '';
          } else if (interimTranscript.trim()) {
            this.onTranscriptCallback?.(interimTranscript.trim(), false);
          }
        };

        this.recognition.onerror = (event: any) => {
          console.warn("[SpeechService] Recognition event error:", event.error);
          if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            this.isListening = false;
            this.onStatusChangeCallback?.('error');
          }
          // 'audio-capture' (y también permisos fallidos al arrancar la PC): los micrófonos
          // aún no están listos -> programar reintentos en vez de quedarse muerto
          if (event.error === 'audio-capture' || event.error === 'service-not-allowed' || event.error === 'not-allowed') {
            this.scheduleMicRetry();
          }
        };

        this.recognition.onend = () => {
          this.isListening = false;
          // Auto-restart continuo y robusto: reintenta hasta 3 veces con retroceso,
          // porque Chrome/Edge corta la sesión de reconocimiento con frecuencia.
          if (this.config.continuousListening && !this.isProcessingCommand && !this.config.satelliteMicOnly) {
            let attempts = 0;
            const tryRestart = () => {
              if (!this.config.continuousListening || this.isListening || this.isProcessingCommand || this.config.satelliteMicOnly) return;
              attempts++;
              try {
                this.recognition.start();
              } catch (e) {
                if (attempts < 3) setTimeout(tryRestart, 250 * attempts);
              }
            };
            setTimeout(tryRestart, 250);
          } else if (!this.isProcessingCommand) {
            this.onStatusChangeCallback?.('idle');
          }
        };
      } catch (e) {
        console.warn("[SpeechService] Recognition init exception:", e);
      }
    }
  }

  /**
   * Explicitly requests microphone hardware permission via getUserMedia.
   * Crucial for browsers which require a user gesture before allowing audio capture.
   */
  public async requestMicPermission(deviceId?: string): Promise<{ granted: boolean; error?: string }> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return { granted: false, error: 'API de micrófono no disponible' };
    }
    try {
      const chosenDevice = deviceId || this.config.audioInputDeviceId;
      if (chosenDevice === 'all' || chosenDevice === 'todos') {
        const devices = await this.getAudioInputDevices();
        if (devices.length > 0) {
          let anyOk = false;
          for (const dev of devices) {
            if (!dev.deviceId) continue;
            try {
              const st = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: dev.deviceId } } });
              st.getTracks().forEach(t => t.stop());
              anyOk = true;
            } catch (_) {}
          }
          if (anyOk) return { granted: true };
        }
      }
      const audioConstraint = (chosenDevice && chosenDevice !== 'default' && chosenDevice !== 'all' && chosenDevice !== 'todos')
        ? { deviceId: { exact: chosenDevice } }
        : true;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraint });
      // Release tracks right away so Web Speech API can acquire the hardware
      stream.getTracks().forEach(t => t.stop());
      return { granted: true };
    } catch (err: any) {
      console.warn("Microphone permission prompt error:", err);
      return { granted: false, error: err?.message || 'Permiso denegado por el usuario o navegador' };
    }
  }

  /**
   * Genera un MediaStream mezclado con TODOS los micrófonos conectados en tiempo real
   */
  public async getMixedMicStream(): Promise<MediaStream | null> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return null;
    try {
      const devices = await this.getAudioInputDevices();
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass || devices.length === 0) {
        return await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      const audioCtx = new AudioCtxClass();
      const destination = audioCtx.createMediaStreamDestination();
      const activeStreams: MediaStream[] = [];

      for (const dev of devices) {
        if (!dev.deviceId) continue;
        try {
          const st = await navigator.mediaDevices.getUserMedia({
            audio: { deviceId: { exact: dev.deviceId } }
          });
          activeStreams.push(st);
          const src = audioCtx.createMediaStreamSource(st);
          src.connect(destination);
        } catch (e) {
          console.warn(`[SpeechService MultiMic] No se pudo abrir micrófono ${dev.label || dev.deviceId}:`, e);
        }
      }

      if (activeStreams.length === 0) {
        return await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      return destination.stream;
    } catch (e) {
      console.warn("[SpeechService MultiMic] Error mixing streams:", e);
      return null;
    }
  }

  public getIsSupported(): boolean {
    return this.isRecognitionSupported;
  }

  public getIsListening(): boolean {
    return this.isListening;
  }

  public setProcessingCommand(processing: boolean) {
    this.isProcessingCommand = processing;
    if (processing) {
      this.resetSession();
    } else {
      if (this.config.continuousListening && !this.isListening && !this.config.satelliteMicOnly) {
        setTimeout(() => {
          try {
            if (this.config.continuousListening && !this.isListening && !this.isProcessingCommand) {
              this.recognition?.start();
            }
          } catch (e) {}
        }, 200);
      }
    }
  }

  public getIsProcessingCommand(): boolean {
    return this.isProcessingCommand;
  }

  /**
   * Marca que la palabra de activación fue detectada y se espera un comando.
   * Mientras esté activa, el micrófono permanece abierto aunque el saludo del
   * asistente (TTS) siga sonando, de modo que "música ... eminem" con pausa no se pierda.
   */
  public setAwaitingCommand(awaiting: boolean) {
    this.awaitingCommand = awaiting;
  }

  public resetSession() {
    this.finalTail = '';
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch (e) {
        try {
          this.recognition.stop();
        } catch (_) {}
      }
    }
  }

  public updateConfig(newConfig: Partial<SpeechConfig>) {
    this.config = { ...this.config, ...newConfig };
    AudioEngine.getInstance().setDuckingEnabled(this.config.duckingEnabled);

    if (newConfig.satelliteMicOnly !== undefined) {
      if (newConfig.satelliteMicOnly) {
        this.stopListening();
      } else if (this.config.continuousListening) {
        this.startListening();
      }
    }

    if (newConfig.continuousListening !== undefined) {
      if (newConfig.continuousListening && !this.config.satelliteMicOnly) {
        this.startListening();
      } else {
        this.stopListening();
      }
    }
  }

  public getConfig(): SpeechConfig {
    return { ...this.config };
  }

  public setCallbacks(
    onTranscript: (transcript: string, isFinal: boolean) => void,
    onStatusChange: (status: 'listening' | 'idle' | 'speaking' | 'processing' | 'error') => void
  ) {
    this.onTranscriptCallback = onTranscript;
    this.onStatusChangeCallback = onStatusChange;
  }

  /**
   * Reintento periódico de arranque del micrófono (para el inicio de Windows,
   * cuando los dispositivos de audio tardan en aparecer).
   */
  private scheduleMicRetry() {
    if (this.micRetryTimer) return;
    this.micRetryAttempts++;
    if (this.micRetryAttempts > 100) {
      console.warn('[SpeechService] ⚠️ Watchdog de micrófono agotado (5 min). Usa devicechange o reinicia la escucha.');
      return;
    }
    this.micRetryTimer = setTimeout(() => {
      this.micRetryTimer = null;
      if (!this.config.continuousListening || this.isListening || this.isProcessingCommand || this.config.satelliteMicOnly) return;
      console.log(`[SpeechService] 🔄 Reintento de micrófono #${this.micRetryAttempts}...`);
      this.startListening();
    }, 3000);
  }

  /**
   * Escucha conexiones/desconexiones de micrófonos: si los dispositivos aparecen
   * tarde (inicio de la PC), la escucha se reactiva sola sin tocar nada.
   */
  private ensureDeviceChangeListener() {
    if (this.deviceChangeListenerAttached) return;
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.addEventListener) return;
    this.deviceChangeListenerAttached = true;
    navigator.mediaDevices.addEventListener('devicechange', () => {
      console.log('[SpeechService] 🔌 Cambio en dispositivos de audio detectado');
      if (this.config.continuousListening && !this.isListening && !this.isProcessingCommand && !this.config.satelliteMicOnly) {
        this.micRetryAttempts = 0;
        this.startListening();
      }
    });
  }

  public startListening() {
    if (this.config.satelliteMicOnly) return;
    if (!this.recognition) {
      this.initRecognition();
    }
    if (!this.recognition) return;
    this.ensureDeviceChangeListener();
    try {
      this.config.continuousListening = true;
      this.recognition.start();
    } catch (e) {
      // Ignored if already started
    }
    // Verificación post-arranque: si en 4 s no hay sesión activa, programar reintento
    // (cubre el caso de arranque de la PC donde start() no dispara error visible)
    if (!this.micRetryTimer && this.micRetryAttempts === 0) {
      setTimeout(() => {
        if (this.config.continuousListening && !this.isListening && !this.isProcessingCommand && !this.config.satelliteMicOnly) {
          this.scheduleMicRetry();
        }
      }, 4000);
    }
  }

  public stopListening() {
    this.config.continuousListening = false;
    if (this.micRetryTimer) { clearTimeout(this.micRetryTimer); this.micRetryTimer = null; }
    this.releaseMicHardwareFocus();
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {
        // Ignored
      }
    }
    this.isListening = false;
    this.onStatusChangeCallback?.('idle');
  }

  /**
   * Sanitiza cualquier texto antes de ser pronunciado por el sintetizador de voz (TTS).
   * REGLA ESTRICTA: NUNCA pronunciar la palabra clave de activación ("música", "musica" o wakeWord configurada)
   * para evitar que el micrófono de la PC escuche la propia voz de los altavoces y reabra la escucha accidentalmente.
   */
  public sanitizeTextForTTS(rawText: string): string {
    if (!rawText) return '';
    const wakeWord = this.config.wakeWord || 'música';
    const normWake = normalizeText(wakeWord);

    let sanitized = rawText;

    // Sustitución estricta e infalible de "música" y todas sus variantes por alternativas naturales y sonoras
    // para asegurar que los altavoces de la PC NUNCA pronuncien la palabra clave y no se abra el micrófono
    sanitized = sanitized.replace(/\b(?:reproduciendo|poniendo)\s+m[uú]sica\b/gi, 'reproduciendo tus canciones');
    sanitized = sanitized.replace(/\b(?:escuchar|oir|o[ií]r)\s+m[uú]sica\b/gi, 'escuchar tus temas');
    sanitized = sanitized.replace(/\bla\s+m[uú]sica\b/gi, 'las canciones');
    sanitized = sanitized.replace(/\bde\s+m[uú]sica\b/gi, 'de canciones');
    sanitized = sanitized.replace(/\btu\s+m[uú]sica\b/gi, 'tus temas');
    sanitized = sanitized.replace(/\bm[uú]sica\s+de\b/gi, 'canciones de');
    sanitized = sanitized.replace(/\bm[uú]sica\b/gi, 'canción');
    sanitized = sanitized.replace(/\bm[uú]sicas\b/gi, 'canciones');
    sanitized = sanitized.replace(/\bm[uú]siquita\b/gi, 'temita');
    sanitized = sanitized.replace(/\bm[uú]sic[oó]n\b/gi, 'temazo');
    sanitized = sanitized.replace(/\bmusic\b/gi, 'audio');
    sanitized = sanitized.replace(/\bmusical(?:es)?\b/gi, 'sonoro');

    // Si la palabra clave configurada es otra distinta (ej: "computadora", "serchtube"), evitar que la pronuncie también
    if (normWake && normWake !== 'musica' && normWake !== 'musicas' && normWake !== 'cancion') {
      const customRegex = new RegExp(`\\b${normWake}\\b`, 'gi');
      sanitized = sanitized.replace(customRegex, 'asistente');
    }

    return sanitized.replace(/\s+/g, ' ').trim();
  }

  /**
   * Multiplicadores de personalidad para velocidad y tono (afectan a ambos motores).
   */
  private getPersonalityMultipliers(): { rate: number; pitch: number } {
    switch (this.config.personality) {
      case 'animada': return { rate: 1.14, pitch: 1.12 };
      case 'formal': return { rate: 0.96, pitch: 0.95 };
      case 'zen': return { rate: 0.82, pitch: 0.88 };
      case 'conductor': return { rate: 1.16, pitch: 1.04 };
      case 'jarvis': return { rate: 1.08, pitch: 0.90 };
      case 'copiloto_rally': return { rate: 1.25, pitch: 1.15 };
      case 'locutor_fm': return { rate: 1.10, pitch: 1.05 };
      case 'calida': return { rate: 0.98, pitch: 1.08 };
      case 'cyberpunk': return { rate: 1.04, pitch: 0.82 };
      case 'directa':
      default: return { rate: 1.12, pitch: 1.0 };
    }
  }

  /** Detiene la reproducción de audio neuronal en curso (nueva orden o cancelación) */
  private stopNeuralPlayback() {
    if (this.neuralAudioEl) {
      try {
        this.neuralAudioEl.pause();
        if (this.neuralAudioEl.src.startsWith('blob:')) {
          URL.revokeObjectURL(this.neuralAudioEl.src);
        }
      } catch (_) {}
      this.neuralAudioEl = null;
    }
  }

  /**
   * Sintetiza y reproduce el texto con una voz neuronal ultra-realista de Microsoft
   * (canal "Leer en voz alta" de Edge). Devuelve false si no se pudo iniciar, para
   * que el llamador haga fallback a las voces del navegador.
   */
  private async speakWithNeural(sanitized: string, engine: 'elevenlabs' | 'gemini', finalRate: number, finalPitch: number, callId: number): Promise<boolean> {
    if (!isNeuralTtsSupported()) return false;
    // ElevenLabs solo si hay voz configurada (con clave guardada); si no, saltar al siguiente motor
    if (engine === 'elevenlabs' && !this.config.elevenVoice) return false;

    const voice = this.config.neuralVoice && NEURAL_VOICES.some(v => v.id === this.config.neuralVoice)
      ? this.config.neuralVoice
      : DEFAULT_NEURAL_VOICE;

    // Estilo de actitud vocal según la personalidad + ajuste fino de velocidad del usuario
    const baseStyle = PERSONALITY_TTS_STYLES[this.config.personality] || PERSONALITY_TTS_STYLES.directa;
    const ratePct = Math.round((finalRate - 1) * 100);
    const style = ratePct !== 0
      ? `${baseStyle} Velocidad de locución: ${ratePct > 0 ? 'un ' + Math.min(45, ratePct) + '% más rápida de lo normal' : 'un ' + Math.min(45, -ratePct) + '% más lenta de lo normal'}.`
      : baseStyle;

    const shouldAbort = () => callId !== this.ttsSeq;

    let blob: Blob;
    try {
      blob = await synthesizeNeuralSpeech(sanitized, engine === 'elevenlabs'
        ? { engine: 'elevenlabs', elvoice: this.config.elevenVoice, speed: finalRate, shouldAbort }
        : { engine: 'gemini', voice, style, shouldAbort }
      );
    } catch (err) {
      if (!shouldAbort()) {
        console.warn('[SpeechService] Voz neuronal no disponible, usando voz del navegador:', err);
      }
      return false;
    }

    if (shouldAbort()) return true; // Una orden más nueva tomó el control

    return new Promise<boolean>((resolve) => {
      let settled = false;
      const settle = (result: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(watchdog);
        this.isSynthesizing = false;
        this.lastSpokenTimestamp = Date.now();
        this.ttsGuardUntil = Date.now() + 900; // 900ms de decaimiento de eco acústico
        if (this.config.duckingEnabled) {
          AudioEngine.getInstance().stopDucking();
        }
        this.onStatusChangeCallback?.(this.isListening ? 'listening' : 'idle');
        resolve(result);
      };

      // Watchdog generoso: MP3 + onended/onerror de Audio son fiables, esto cubre cuelgues raros
      const watchdog = setTimeout(() => {
        this.stopNeuralPlayback();
        settle(true);
      }, 2000 + sanitized.length * 250);

      try {
        const audio = new Audio(URL.createObjectURL(blob));
        audio.volume = Math.max(0.1, Math.min(1.0, this.config.speechVolume ?? 1.0));
        this.neuralAudioEl = audio;

        audio.onended = () => {
          if (audio.src) { try { URL.revokeObjectURL(audio.src); } catch (_) {} }
          settle(true);
        };
        audio.onerror = () => {
          console.warn('[SpeechService] Error reproduciendo audio neuronal, cayendo a voz del navegador');
          if (audio.src) { try { URL.revokeObjectURL(audio.src); } catch (_) {} }
          settle(false);
        };

        const played = audio.play();
        if (played && typeof played.catch === 'function') {
          played.catch(() => {
            if (audio.src) { try { URL.revokeObjectURL(audio.src); } catch (_) {} }
            settle(false);
          });
        }
      } catch (err) {
        console.warn('[SpeechService] Excepción al reproducir audio neuronal:', err);
        settle(false);
      }
    });
  }

  /**
   * Text-To-Speech con perfiles de personalidad.
   * Motor por defecto: voces neuronales ultra-realistas de Microsoft (gratuitas),
   * con fallback automático a las voces del navegador (speechSynthesis).
   */
  /**
   * @param engineOverride Si se indica, habla SOLO con ese motor (sin cadena de
   * prioridad ni fallbacks). Útil para el botón "Probar" de cada puesto en Ajustes.
   */
  public async speak(text: string, engineOverride?: 'elevenlabs' | 'gemini' | 'edge'): Promise<void> {
    if (!text) return;

    // Sanitizar texto para que NUNCA mencione la palabra clave (ej: "música")
    const sanitized = this.sanitizeTextForTTS(text);
    if (!sanitized) return;

    // 🛡️ Antirrepetición audible: si el mismo texto se pide dos veces en <4.5s
    // (micro local + nodos satélite que capturan la misma orden), se dice UNA sola vez.
    const nowReq = Date.now();
    if (
      sanitized === this.lastSpokenText &&
      nowReq - this.lastSpeakRequestAt < 4500
    ) {
      console.log(`[SpeechService] 🔇 Respuesta duplicada suprimida (<4.5s): "${sanitized.slice(0, 60)}"`);
      return;
    }
    this.lastSpeakRequestAt = nowReq;

    // Detener cualquier locución anterior (neuronal o del navegador) y tomar el control
    const mySeq = ++this.ttsSeq;
    this.stopNeuralPlayback();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window &&
        (window.speechSynthesis.speaking || window.speechSynthesis.pending)) {
      try {
        window.speechSynthesis.cancel();
      } catch (_) {}
    }

    // Velocidad y tono finales = ajustes del usuario × personalidad
    const mult = this.getPersonalityMultipliers();
    const finalRate = (this.config.speechRate ?? 1.0) * mult.rate;
    const finalPitch = (this.config.speechPitch ?? 1.0) * mult.pitch;

    // Cadena de motores según el orden de prioridad configurado en Ajustes.
    // Cada motor se intenta en orden; el primero que genere audio habla.
    let chain = engineOverride
      ? [engineOverride]
      : (this.config.voicePriority || []).filter(e => e === 'elevenlabs' || e === 'gemini' || e === 'edge');
    if (chain.length === 0) {
      // Compatibilidad con configuraciones antiguas sin orden de prioridad
      chain = this.config.ttsEngine === 'browser'
        ? ['edge']
        : (this.config.elevenVoice ? ['elevenlabs', 'gemini', 'edge'] : ['gemini', 'edge']);
    }

    // Estado común del ciclo de habla (anti-eco + ducking) antes de sintetizar
    this.isSynthesizing = true;
    this.lastSpokenText = sanitized;
    this.lastSpokenTimestamp = Date.now();
    this.ttsGuardUntil = Date.now() + 15000; // Mantener inmunidad mientras se sintetiza y habla
    if (this.config.duckingEnabled) {
      AudioEngine.getInstance().startDucking(100);
    }
    this.onStatusChangeCallback?.('speaking');

    try {
      for (const engine of chain) {
        if (mySeq !== this.ttsSeq) return; // Una orden más nueva tomó el control

        if (engine === 'edge') {
          return await this.speakWithBrowser(sanitized, finalRate, finalPitch);
        }

        const started = await this.speakWithNeural(sanitized, engine, finalRate, finalPitch, mySeq);
        if (started) return;
      }
    } finally {
      // Si ningún motor de la cadena habló y no hay un intento más nuevo, restaurar ciclo
      if (mySeq === this.ttsSeq && (this.isSynthesizing)) {
        this.isSynthesizing = false;
        if (this.config.duckingEnabled) {
          AudioEngine.getInstance().stopDucking();
        }
      }
    }

    // Última línea de defensa: navegador si la cadena completa falló
    // (salvo en pruebas de un motor concreto, para oír exactamente ese motor)
    if (mySeq === this.ttsSeq && !chain.includes('edge') && !engineOverride) {
      return this.speakWithBrowser(sanitized, finalRate, finalPitch);
    }
  }

  /** TTS clásico con las voces locales del navegador (speechSynthesis) */
  private speakWithBrowser(sanitized: string, finalRate: number, finalPitch: number): Promise<void> {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        resolve();
        return;
      }

      // Duck audio while speaking
      if (this.config.duckingEnabled) {
        AudioEngine.getInstance().startDucking(100);
      }

      this.isSynthesizing = true;
      this.lastSpokenText = sanitized;
      this.lastSpokenTimestamp = Date.now();
      this.ttsGuardUntil = Date.now() + 15000; // Keep guard active while speaking
      this.onStatusChangeCallback?.('speaking');

      const utterance = new SpeechSynthesisUtterance(sanitized);

      utterance.rate = Math.max(0.5, Math.min(2.0, finalRate));
      utterance.pitch = Math.max(0.5, Math.min(2.0, finalPitch));
      utterance.volume = Math.max(0.1, Math.min(1.0, this.config.speechVolume ?? 1.0));

      // Choose preferred voice or Edge Natural / Neural voice if available
      // Fetch fresh voices directly from window.speechSynthesis to ensure active object references in Chromium/Edge
      const freshVoices = (typeof window !== 'undefined' && 'speechSynthesis' in window)
        ? window.speechSynthesis.getVoices()
        : [];
      const voices = (freshVoices && freshVoices.length > 0) ? freshVoices : this.getAvailableVoices();
      let matchedVoice: SpeechSynthesisVoice | undefined;

      if (this.config.voiceURI && this.config.voiceURI !== 'auto') {
        const target = this.config.voiceURI.trim().toLowerCase();
        matchedVoice = voices.find(v => v.name === this.config.voiceURI) ||
                       voices.find(v => v.voiceURI === this.config.voiceURI) ||
                       voices.find(v => v.name.toLowerCase() === target) ||
                       voices.find(v => v.voiceURI.toLowerCase() === target);
      }

      if (!matchedVoice) {
        // 1. Highest priority: Microsoft Edge "Leer en voz alta" / Online Natural Spanish voices
        const edgeNaturalSpanish = voices.filter(v =>
          (v.lang.startsWith('es') || /spanish/i.test(v.name)) &&
          (/online.*natural/i.test(v.name) || /microsoft.*natural/i.test(v.name) || /natural/i.test(v.name))
        );

        if (edgeNaturalSpanish.length > 0) {
          // Prefer Raul or Jorge or Alvaro or first
          matchedVoice = edgeNaturalSpanish.find(v => /raul|jorge|alvaro|elvira|paloma|dalia/i.test(v.name)) || edgeNaturalSpanish[0];
        } else {
          // 2. Secondary: Google or neural Spanish voices
          const neuralSpanish = voices.filter(v =>
            (v.lang.startsWith('es') || /spanish/i.test(v.name)) &&
            /neural|natural|google|premium|multilingual/i.test(v.name)
          );
          if (neuralSpanish.length > 0) {
            matchedVoice = neuralSpanish[0];
          } else {
            // 3. Any Spanish voice
            const spanishVoices = voices.filter(v => v.lang.startsWith('es') || /spanish/i.test(v.name));
            if (spanishVoices.length > 0) {
              matchedVoice = spanishVoices[0];
            }
          }
        }
      }

      if (matchedVoice) {
        utterance.voice = matchedVoice;
        utterance.lang = matchedVoice.lang || 'es-ES';
      } else {
        utterance.lang = 'es-ES';
      }

      let hasCompleted = false;
      const finishSpeaking = () => {
        if (hasCompleted) return;
        hasCompleted = true;
        this.isSynthesizing = false;
        this.lastSpokenTimestamp = Date.now();
        this.ttsGuardUntil = Date.now() + 900; // 900ms acoustic echo decay buffer
        if (this.config.duckingEnabled) {
          AudioEngine.getInstance().stopDucking();
        }
        this.onStatusChangeCallback?.(this.isListening ? 'listening' : 'idle');
        resolve();
      };

      utterance.onend = finishSpeaking;
      utterance.onerror = finishSpeaking;

      // Safety timeout: in case speechSynthesis hangs in browser without firing onend
      setTimeout(finishSpeaking, 4000);

      // Slight delay allows Chromium/Edge's internal audio dispatcher to stabilize after cancel()
      setTimeout(() => {
        try {
          window.speechSynthesis.speak(utterance);
        } catch (err) {
          console.warn("speechSynthesis.speak error:", err);
          finishSpeaking();
        }
      }, 20);
    });
  }

  public getAvailableVoices(): SpeechSynthesisVoice[] {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
    const directVoices = window.speechSynthesis.getVoices();
    if (directVoices && directVoices.length > 0) {
      this.cachedVoices = directVoices;
      return directVoices;
    }
    return this.cachedVoices;
  }

  public subscribeVoicesChanged(callback: (voices: SpeechSynthesisVoice[]) => void): () => void {
    this.onVoicesChangedCallbacks.push(callback);
    if (this.cachedVoices.length > 0) {
      try {
        callback(this.cachedVoices);
      } catch (_) {}
    }
    return () => {
      this.onVoicesChangedCallbacks = this.onVoicesChangedCallbacks.filter(cb => cb !== callback);
    };
  }
}
