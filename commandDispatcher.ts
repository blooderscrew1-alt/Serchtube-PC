import { WebSocket } from 'ws';
import { distance } from 'fastest-levenshtein';
import { searchYouTubeMusic, cleanSearchQuery as cleanQueryEngine, type CatalogTrack } from './youtubeEngine.ts';
import { searchGoogleForVideo, correctQueryWithGoogle } from './googleSearchCorrector.ts';

// ============================================================================
// FLAG DE ACTIVACIÓN DE CORRECCIÓN INTELIGENTE (Tolerancia a errores de voz)
// Activada por defecto directamente en el código para fuzzy matching y corrección sin necesidad de variables de entorno
export const ENABLE_SMART_CORRECTION: boolean = true;

// ==========================================
// 1. TYPINGS & INTERFACES
// ==========================================

export interface IncomingSatellitePayload {
  type?: 'voice_command' | 'player_control' | 'command' | string;
  action?: string;
  query?: string;
  rawQuery?: string;
  volume?: number;
  value?: number;
  nodeId?: string;
  nodeName?: string;
  room?: string;
  timestamp?: number;
  payload?: any;
  [key: string]: any;
}

export type IntentType =
  | 'LOAD_VIDEO'
  | 'PAUSE'
  | 'RESUME'
  | 'NEXT'
  | 'PREV'
  | 'SET_VOLUME'
  | 'VOLUME_UP'
  | 'VOLUME_DOWN'
  | 'MUTE'
  | 'UNMUTE'
  | 'SEEK'
  | 'SEEK_RELATIVE'
  | 'REPEAT'
  | 'NON_STOP'
  | 'SHUFFLE'
  | 'SET_QUALITY'
  | 'SET_SPEED'
  | 'RELOAD_PLAYER'
  | 'FULLSCREEN_TOGGLE'
  | 'SHOW_QR'
  | 'SCREENSAVER_START'
  | 'SCREENSAVER_STOP'
  | 'UNKNOWN';

export interface ResolvedIntent {
  intent: IntentType;
  query?: string;
  cleanQuery?: string;
  volumeValue?: number;
  seekTime?: number;
  offset?: number;
  quality?: string;
  speed?: number;
  originalAction?: string;
  rawText?: string;
  confidence?: number;
}

export interface PlayerBrowserEvent {
  event: string;
  videoId?: string;
  title?: string;
  artist?: string;
  thumbnail?: string;
  duration?: string | number;
  items?: any[];
  value?: number;
  volume?: number;
  volumeValue?: number;
  rawPercent?: number;
  time?: number;
  seekTime?: number;
  position?: number;
  offset?: number;
  quality?: string;
  playbackQuality?: string;
  speed?: number;
  playbackSpeed?: number;
  nodeId?: string;
  fromNode?: string;
  timestamp?: number;
  [key: string]: any;
}

export interface CommandAck {
  type: 'command_ack';
  success: boolean;
  message: string;
  nodeId?: string;
  room?: string;
  timestamp?: number;
}

// ==========================================
// 3. STOPWORDS & QUERY CLEANING
// ==========================================

/**
 * Verifica si un texto normalizado corresponde a una orden pura de continuar / reanudar / play
 * sin contener el nombre de un artista o canción específica.
 */
export function isPureResumePhrase(cleanText: string): boolean {
  if (!cleanText || !cleanText.trim()) return false;

  // Normalizar acentos y eliminar signos de puntuación
  const normalized = cleanText
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'«»“”]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return false;

  // Quitar muletillas de activación
  const stripped = normalized
    .replace(/^(?:oye\s+serch|serch|asistente|por\s+favor)\s*/i, '')
    .replace(/\s*(?:por\s+favor)\s*$/i, '')
    .trim();

  if (!stripped) return false;

  // Frases exactas de reanudar / continuar / play / despausar
  const resumePhrasesRegex = /^(?:play|resume|unpause|reproducir|reproduce|reanudate|reanudar|reanuda|continuar|continua|sigue|seguir|dale\s+(?:al\s+)?play|pon\s+play|dar\s+play|darle\s+play|despausa|despausar|quitar?\s+(?:la\s+)?pausa|quitar?\s+(?:el\s+)?pause|sacar?\s+(?:la\s+)?pausa|iniciar?\s+reproduccion|reanudacion)(?:\s+(?:la\s+)?(?:musica|cancion|reproduccion|pista|audio))?$/i;

  if (resumePhrasesRegex.test(stripped)) {
    return true;
  }

  // Frases genéricas como "pon música", "toca música", "quiero escuchar música" (sin especificar artista ni tema)
  const genericMusicRegex = /^(?:pon|ponme|poner|toca|tocar|escuchar|escucha|quiero\s+escuchar|reproduce|reproducir)\s+(?:la\s+)?(?:musica|cancion|audio)$/i;
  if (genericMusicRegex.test(stripped)) {
    return true;
  }

  // Palabras solas que indican reanudar o reproducir
  if (/^(?:musica|audio|reproduccion)$/i.test(stripped)) {
    return true;
  }

  return false;
}

/**
 * Determina exhaustivamente si un comando recibido (de Android, Web o voz)
 * es una solicitud de reanudar la reproducción actual en pausa.
 */
export function isResumeCommand(rawText: string, rawAction: string): boolean {
  const normAction = (rawAction || '')
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  // Si la acción explícita es de pausa, volumen, mute, seek u otro control, NUNCA es resume
  if (['pause', 'stop', 'pausa', 'parar', 'detener', 'detente', 'alto', 'volume_set', 'volume_up', 'volume_down', 'vol_up', 'vol_down', 'volume', 'vol', 'mute', 'unmute', 'seek', 'seek_to', 'seek_relative', 'repeat', 'toggle_repeat', 'shuffle', 'non_stop', 'nonstop', 'set_quality', 'set_speed'].includes(normAction)) {
    return false;
  }

  // 1. Si la acción explícita es de reanudación
  if (['resume', 'reanudar', 'continuar', 'unpause', 'despausar', 'screensaver_stop', 'screensaver_off'].includes(normAction)) {
    return true;
  }

  // 2. Si la acción es play o reproducir
  if (['play', 'reproducir', 'reproduce'].includes(normAction)) {
    if (!rawText || !rawText.trim()) return true;
    if (isPureResumePhrase(rawText)) return true;
    return false;
  }

  // 3. Si la acción es genérica o vacía y el texto pronunciado o enviado es una frase de reanudar
  if (rawText && rawText.trim() && isPureResumePhrase(rawText)) {
    return true;
  }

  return false;
}

/**
 * Limpia stopwords y prefijos de órdenes de voz como:
 * "reproduce queen don't stop me now" -> "queen don't stop me now"
 * "pon la canción de mana oye mi amor" -> "mana oye mi amor"
 * "busca el video de bohemian rhapsody" -> "bohemian rhapsody"
 */
export function cleanSearchQuery(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';

  let text = raw.trim();

  // Normalize common assistant greetings & wake phrases
  text = text.replace(/^(?:oye\s+serch|serch|asistente|por\s+favor)\s*,?\s*/i, '');
  text = text.replace(/^(?:música|musica)\s*,?\s*/i, '');

  // Strip punctuation and surrounding quotes
  text = text.replace(/^["'«“]|["'»”]$/g, '').trim();

  // Strip leading action verbs (Spanish & English) - match with \s+ or end of string ($)
  const verbRegex = /^(?:reproduce|reproducir|reprodúceme|reproduceme|reprodúcela|reproducela|pon|ponme|ponte|poner|pón|escuchar|escucha|quiero\s+escuchar|quiero\s+oír|quiero\s+oir|toca|tocar|tócame|tocame|tócate|tocate|busca|buscar|búscame|buscame|encuentra|encontrar|play|search|reanudar|reanuda|continuar|continua|despausar|despausa|seguir|sigue)(?:\s+|$)/i;
  while (verbRegex.test(text)) {
    text = text.replace(verbRegex, '').trim();
  }

  // Strip filler noun phrases & connectors
  text = text.replace(/^(?:la\s+canción\s+de|la\s+cancion\s+de|el\s+tema\s+de|la\s+rola\s+de|el\s+video\s+de|el\s+disco\s+de|la\s+música\s+de|la\s+musica\s+de|algo\s+de|a\s+|de\s+|la\s+de\s+)/i, '').trim();
  text = text.replace(/^(?:la\s+canción|la\s+cancion|el\s+tema|la\s+música|la\s+musica|música|musica|canción|cancion|audio)(?:\s+|$)/i, '').trim();

  // Strip trailing punctuation
  text = text.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'«»“”]/g, ' ').trim();

  return text;
}

// ==========================================
// 4. BULLETPROOF COMMAND EXTRACTOR & INTENT RESOLVER
// ==========================================

/**
 * Extrae y normaliza de forma exhaustiva todos los campos de comandos
 * independientemente del formato del cliente (Android, Web, iOS, REST, etc.)
 */
export function extractCommandInfo(raw: any): {
  action: string;
  query: string;
  rawText: string;
  volume?: number;
  seekTime?: number;
  offset?: number;
  quality?: string;
  speed?: number;
  videoId?: string;
  items?: any[];
  title?: string;
  artist?: string;
  nodeId?: string;
  nodeName?: string;
  room?: string;
} {
  let payload = raw;
  if (typeof payload === 'string') {
    const trimmed = payload.trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        payload = JSON.parse(trimmed);
      } catch {
        payload = { query: trimmed, action: trimmed, rawQuery: trimmed };
      }
    } else {
      payload = { query: trimmed, action: trimmed, rawQuery: trimmed };
    }
  }

  if (!payload || typeof payload !== 'object') {
    return { action: '', query: '', rawText: '' };
  }

  // Desenvolver envolturas anidadas (payload.payload, payload.data, payload.body)
  const inner = (typeof payload.payload === 'object' && payload.payload !== null)
    ? payload.payload
    : (typeof payload.data === 'object' && payload.data !== null)
      ? payload.data
      : (typeof payload.body === 'object' && payload.body !== null)
        ? payload.body
        : {};

  // Extraer candidato de acción
  const rawAction = (
    payload.action ||
    payload.command ||
    payload.cmd ||
    payload.event ||
    payload.intent ||
    payload.name ||
    inner.action ||
    inner.command ||
    inner.cmd ||
    inner.event ||
    inner.intent ||
    inner.name ||
    (payload.type && !['voice_command', 'player_control', 'command', 'remote', 'message', 'request', 'satellite_command', 'event'].includes(String(payload.type).toLowerCase()) ? payload.type : '') ||
    (inner.type && !['voice_command', 'player_control', 'command', 'remote', 'message', 'request', 'satellite_command', 'event'].includes(String(inner.type).toLowerCase()) ? inner.type : '') ||
    ''
  );
  const action = String(rawAction).toLowerCase().trim();

  // Extraer texto / consulta / transcripción
  const rawTextCandidate = (
    payload.rawQuery ||
    payload.query ||
    payload.transcript ||
    payload.text ||
    payload.search ||
    payload.searchQuery ||
    payload.speech ||
    payload.title ||
    inner.rawQuery ||
    inner.query ||
    inner.transcript ||
    inner.text ||
    inner.search ||
    inner.searchQuery ||
    inner.speech ||
    inner.title ||
    ''
  );
  let rawText = String(rawTextCandidate).trim();

  const track = payload.track || payload.song || inner.track || inner.song || '';
  const artist = payload.artist || inner.artist || '';
  if (!rawText && (track || artist)) {
    rawText = [artist, track].filter(Boolean).join(' - ');
  }

  // Extraer volumen
  const volCandidate = (
    payload.volume ??
    payload.value ??
    payload.vol ??
    payload.volumeValue ??
    payload.val ??
    payload.level ??
    inner.volume ??
    inner.value ??
    inner.vol ??
    inner.volumeValue ??
    inner.val ??
    inner.level
  );
  let volume: number | undefined;
  if (typeof volCandidate === 'number') {
    volume = volCandidate;
  } else if (typeof volCandidate === 'string' && !isNaN(Number(volCandidate)) && volCandidate.trim() !== '') {
    volume = Number(volCandidate);
  }

  // Extraer tiempo / posición / seek
  const timeCandidate = (
    payload.seekTime ??
    payload.time ??
    payload.position ??
    payload.targetTime ??
    payload.seconds ??
    inner.seekTime ??
    inner.time ??
    inner.position ??
    inner.targetTime ??
    inner.seconds
  );
  let seekTime: number | undefined;
  if (typeof timeCandidate === 'number') {
    seekTime = timeCandidate;
  } else if (typeof timeCandidate === 'string' && !isNaN(Number(timeCandidate)) && timeCandidate.trim() !== '') {
    seekTime = Number(timeCandidate);
  }

  // Extraer desplazamiento relativo (offset)
  const offsetCandidate = (
    payload.offset ??
    payload.delta ??
    inner.offset ??
    inner.delta
  );
  let offset: number | undefined;
  if (typeof offsetCandidate === 'number') {
    offset = offsetCandidate;
  } else if (typeof offsetCandidate === 'string' && !isNaN(Number(offsetCandidate)) && offsetCandidate.trim() !== '') {
    offset = Number(offsetCandidate);
  }

  // Extraer calidad y velocidad
  const quality = (payload.quality || payload.playbackQuality || inner.quality || inner.playbackQuality) ? String(payload.quality || payload.playbackQuality || inner.quality || inner.playbackQuality) : undefined;
  const rawSpeed = payload.speed ?? payload.playbackSpeed ?? inner.speed ?? inner.playbackSpeed;
  const speed = typeof rawSpeed === 'number' ? rawSpeed : (typeof rawSpeed === 'string' && !isNaN(Number(rawSpeed)) ? Number(rawSpeed) : undefined);

  const videoId = payload.videoId || payload.id || inner.videoId || inner.id;
  const items = Array.isArray(payload.items) ? payload.items : (Array.isArray(inner.items) ? inner.items : undefined);
  const title = payload.title || inner.title || track;
  const finalArtist = payload.artist || inner.artist || artist;

  const nodeId = payload.nodeId || inner.nodeId;
  const nodeName = payload.nodeName || inner.nodeName;
  const room = payload.room || inner.room;

  return {
    action,
    query: rawText,
    rawText,
    volume,
    seekTime,
    offset,
    quality,
    speed,
    videoId: videoId ? String(videoId) : undefined,
    items,
    title: title ? String(title) : undefined,
    artist: finalArtist ? String(finalArtist) : undefined,
    nodeId,
    nodeName,
    room
  };
}

/**
 * Descifra la verdadera intención del satélite Android o cliente remoto.
 */
export function resolveIntent(payload: IncomingSatellitePayload): ResolvedIntent {
  const extracted = extractCommandInfo(payload);
  const originalAction = extracted.action;
  const rawText = extracted.rawText;

  const lowerText = rawText.toLowerCase();
  const lowerAction = originalAction.toLowerCase();

  // 1. Reproducción directa por videoId
  if (extracted.videoId) {
    return {
      intent: 'LOAD_VIDEO',
      query: extracted.title || extracted.videoId,
      cleanQuery: extracted.title || extracted.videoId,
      originalAction: originalAction || 'load_video',
      rawText
    };
  }

  // 2. REANUDAR / PLAY (cuando está en pausa o se pide continuar/reproducir/despausar)
  if (isResumeCommand(rawText, originalAction)) {
    return { intent: 'RESUME', originalAction: originalAction || 'resume', rawText };
  }

  // 3. PAUSA / STOP
  if (
    ['pause', 'stop', 'pausa', 'parar', 'detener', 'detente', 'alto'].includes(lowerAction) ||
    /(?:^|\b)(?:pausa|pausar|para|parar|detente|dentente|detener|alto|stop|para la música)(?:\b|$)/i.test(lowerText)
  ) {
    return { intent: 'PAUSE', originalAction: originalAction || 'pause', rawText };
  }

  // 3. SILENCIO / MUTE
  if (
    ['mute', 'mutear', 'silencio', 'silenciar'].includes(lowerAction) ||
    /(?:^|\b)(?:silencio|silenciar|cállate|callate|que te calles|mute|mutear)(?:\b|$)/i.test(lowerText)
  ) {
    return { intent: 'MUTE', originalAction: originalAction || 'mute', rawText };
  }

  // 4. UNMUTE / ACTIVAR AUDIO
  if (
    ['unmute', 'desmutear', 'reactivar_audio', 'reactivar audio', 'sonido'].includes(lowerAction) ||
    /(?:^|\b)(?:desmutear|reactivar audio|quitar silencio|activa sonido|sonido)(?:\b|$)/i.test(lowerText)
  ) {
    return { intent: 'UNMUTE', originalAction: originalAction || 'unmute', rawText };
  }

  // 5. SIGUIENTE CANCIÓN
  if (
    ['next', 'siguiente', 'skip', 'adelantar', 'salta', 'pasar'].includes(lowerAction) ||
    /(?:^|\b)(?:siguiente|pasa de canción|pasa la canción|siguiente canción|next|adelanta|salta)(?:\b|$)/i.test(lowerText)
  ) {
    return { intent: 'NEXT', originalAction: originalAction || 'next', rawText };
  }

  // 6. CANCIÓN ANTERIOR
  if (
    ['prev', 'previous', 'anterior', 'atras', 'atrás', 'regresa'].includes(lowerAction) ||
    /(?:^|\b)(?:anterior|canción anterior|cancion anterior|pista anterior|atrás|atras|regresa|previous|prev)(?:\b|$)/i.test(lowerText)
  ) {
    return { intent: 'PREV', originalAction: originalAction || 'prev', rawText };
  }

// Spanish number words mapping for spoken volume
const SPANISH_NUMBER_WORDS: Record<string, number> = {
  'cero': 0, 'uno': 1, 'un': 1, 'una': 1, 'dos': 2, 'tres': 3, 'cuatro': 4, 'cinco': 5,
  'seis': 6, 'siete': 7, 'ocho': 8, 'nueve': 9, 'diez': 10, 'once': 11, 'doce': 12,
  'trece': 13, 'catorce': 14, 'quince': 15, 'dieciseis': 16, 'dieciséis': 16,
  'diecisiete': 17, 'dieciocho': 18, 'diecinueve': 19, 'veinte': 20, 'veinticinco': 25,
  'treinta': 30, 'cuarenta': 40, 'cincuenta': 50, 'sesenta': 60, 'setenta': 70,
  'ochenta': 80, 'noventa': 90, 'cien': 100
};

function parseVolumeNumber(raw: string): number | null {
  const trimmed = raw.trim().toLowerCase();
  if (SPANISH_NUMBER_WORDS[trimmed] !== undefined) {
    return SPANISH_NUMBER_WORDS[trimmed];
  }
  const num = parseInt(trimmed, 10);
  return isNaN(num) ? null : num;
}

  // 7. SILENCIO / MUTE
  if (
    ['mute', 'mutear', 'silencio', 'silenciar'].includes(lowerAction) ||
    /(?:^|\b)(?:silencio|silenciar|cállate|callate|que te calles|calladita|calladito|mute|mutear|ponlo en mudo|en mudo|modo mudo)(?:\b|$)/i.test(lowerText)
  ) {
    return { intent: 'MUTE', originalAction: originalAction || 'mute', rawText };
  }

  // 8. UNMUTE / ACTIVAR AUDIO
  if (
    ['unmute', 'desmutear', 'reactivar_audio', 'reactivar audio', 'sonido', 'reactiva_sonido'].includes(lowerAction) ||
    /(?:^|\b)(?:desmutear|desmutea|reactivar audio|reactiva audio|quitar silencio|activa sonido|activar sonido|reactiva sonido|sonido|quitar el mudo)(?:\b|$)/i.test(lowerText)
  ) {
    return { intent: 'UNMUTE', originalAction: originalAction || 'unmute', rawText };
  }

  // 9. FIJAR VOLUMEN - PRESETS
  if (
    /(?:volumen\s+(?:al\s+|en\s+|a\s+)?(?:m[aá]ximo|alto|a\s+tope|a\s+todo\s+volumen|a\s+reventar|todo|full|tope|mango))|(?:al\s+(?:m[aá]ximo|tope))|(?:a\s+todo\s+volumen)|(?:a\s+tope)|(?:full\s+volumen)|(?:m[aá]ximo\s+volumen)/i.test(lowerText)
  ) {
    return { intent: 'SET_VOLUME', volumeValue: 15, originalAction: originalAction || 'volume_set', rawText };
  }
  if (
    /(?:volumen\s+(?:al\s+|en\s+|a\s+)?(?:m[ií]nimo|bajo|bajito))|(?:al\s+m[ií]nimo)|(?:m[ií]nimo\s+volumen)/i.test(lowerText)
  ) {
    return { intent: 'SET_VOLUME', volumeValue: 1, originalAction: originalAction || 'volume_set', rawText };
  }
  if (
    /(?:volumen\s+(?:al\s+|en\s+|a\s+)?(?:medio|normal|regular|a\s+la\s+mitad))|(?:al\s+medio)|(?:a\s+la\s+mitad)|(?:medio\s+volumen)/i.test(lowerText)
  ) {
    return { intent: 'SET_VOLUME', volumeValue: 8, originalAction: originalAction || 'volume_set', rawText };
  }

  // 10. FIJAR VOLUMEN - NUMÉRICO (Dígitos y palabras en español, escala nativa 0-15)
  if (typeof extracted.volume === 'number' && !isNaN(extracted.volume)) {
    let vol = extracted.volume;
    if (vol > 15) {
      vol = Math.round((vol / 100) * 15);
    }
    vol = Math.min(15, Math.max(0, vol));
    return {
      intent: 'SET_VOLUME',
      volumeValue: vol,
      originalAction: originalAction || 'volume_set',
      rawText
    };
  }

  const volWordsPattern = '(?:\\d+|cero|uno|un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|dieciseis|dieciséis|diecisiete|dieciocho|diecinueve|veinte|veinticinco|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|cien)';
  const volNumericRegex = new RegExp(`(?:volumen|sonido|nivel|audio)\\s*(?:al|en|a|de|nivel)?\\s*(${volWordsPattern})(?:%|\\s*por\\s*ciento)?`, 'i');
  const setVolVerbRegex = new RegExp(`(?:pon|ponle|poner|pón|ajusta|ajustar|cambia|cambiar|deja|dejar|fija|fijar|coloca|colocar)\\s+(?:el\\s+)?(?:volumen|sonido|audio)\\s*(?:al|en|a|de)?\\s*(${volWordsPattern})`, 'i');
  const quickVolSetRegex = new RegExp(`(?:pon|ponle|ajusta|deja)\\s+(${volWordsPattern})\\s+(?:de\\s+)?(?:volumen|sonido)`, 'i');

  const volNumMatch = lowerText.match(volNumericRegex) || lowerText.match(setVolVerbRegex) || lowerText.match(quickVolSetRegex);
  if (volNumMatch && volNumMatch[1]) {
    const parsed = parseVolumeNumber(volNumMatch[1]);
    if (parsed !== null) {
      let finalVol15 = parsed;
      if (parsed > 15) {
        finalVol15 = Math.round((parsed / 100) * 15);
      }
      finalVol15 = Math.min(15, Math.max(0, finalVol15));
      return {
        intent: 'SET_VOLUME',
        volumeValue: finalVol15,
        originalAction: originalAction || 'volume_set',
        rawText
      };
    }
  }

  // 11. SUBIR VOLUMEN
  if (
    ['volume_up', 'volumeup', 'vol_up', 'volup', 'subir_volumen', 'sube_volumen', 'subir', 'sube', 'mas_volumen', 'más_volumen', 'up', 'vol+', 'volume+', 'vol_plus', 'volume_plus', 'step_up'].includes(lowerAction) ||
    /(?:sube|subir|s[uú]bele|s[uú]bale|aumenta|aumentar|aum[eé]ntale)\s*(?:un\s+poco|un\s+pel[ií]n|m[aá]s|al\s+volumen|a\s+la\s+m[uú]sica|al\s+sonido)?(?:\b|$)/i.test(lowerText) ||
    /(?:sube|subir|s[uú]bele|s[uú]bale|aumenta|aumentar|aum[eé]ntale|m[aá]s|mas)\s+(?:el\s+|de\s+|al\s+|un\s+poco\s+)?(?:volumen|sonido|audio|decibelios)/i.test(lowerText) ||
    /(?:volumen|sonido|audio)\s+(?:arriba|m[aá]s|mas|alto|fuerte)/i.test(lowerText) ||
    /(?:dale|pon|ponle|m[eé]tele|échale|echale)\s+(?:m[aá]s\s+)?(?:volumen|sonido|audio|caña)/i.test(lowerText) ||
    /(?:m[aá]s|mas)\s+(?:volumen|sonido|audio|alto|fuerte|recio)/i.test(lowerText) ||
    /(?:un\s+poco\s+m[aá]s\s+de\s+volumen)/i.test(lowerText) ||
    /^(?:sube|subir|s[uú]bele|s[uú]bale)$/i.test(lowerText)
  ) {
    return {
      intent: 'VOLUME_UP',
      volumeValue: typeof extracted.volume === 'number' ? extracted.volume : undefined,
      originalAction: originalAction || 'volume_up',
      rawText
    };
  }

  // 12. BAJAR VOLUMEN
  if (
    ['volume_down', 'volumedown', 'vol_down', 'voldown', 'bajar_volumen', 'baja_volumen', 'bajar', 'baja', 'menos_volumen', 'down', 'vol-', 'volume-', 'vol_minus', 'volume_minus', 'step_down'].includes(lowerAction) ||
    /(?:baja|bajar|b[aá]jale|b[aá]jale|reduce|reducir|red[uú]cele)\s*(?:un\s+poco|un\s+pel[ií]n|menos|al\s+volumen|a\s+la\s+m[uú]sica|al\s+sonido)?(?:\b|$)/i.test(lowerText) ||
    /(?:baja|bajar|b[aá]jale|b[aá]jale|reduce|reducir|red[uú]cele|menos)\s+(?:el\s+|de\s+|al\s+|un\s+poco\s+)?(?:volumen|sonido|audio)/i.test(lowerText) ||
    /(?:volumen|sonido|audio)\s+(?:abajo|menos|bajo|suave|despacio|bajito)/i.test(lowerText) ||
    /(?:dale|pon|ponle|qu[ií]tale)\s+(?:menos\s+)?(?:volumen|sonido|audio)/i.test(lowerText) ||
    /(?:menos)\s+(?:volumen|sonido|audio|ruido)/i.test(lowerText) ||
    /(?:m[aá]s\s+)(?:bajo|suave|despacio|bajito)/i.test(lowerText) ||
    /(?:un\s+poco\s+menos\s+de\s+volumen)/i.test(lowerText) ||
    /^(?:baja|bajar|b[aá]jale)$/i.test(lowerText)
  ) {
    return {
      intent: 'VOLUME_DOWN',
      volumeValue: typeof extracted.volume === 'number' ? extracted.volume : undefined,
      originalAction: originalAction || 'volume_down',
      rawText
    };
  }

  // 13. SALVAGUARDA DE VOLUMEN (Si menciona volumen/audio pero no encajó arriba, JAMÁS buscar como canción)
  if (/(?:volumen|decibelios|s[uú]bele|b[aá]jale)/i.test(lowerText) || lowerAction.includes('volumen') || lowerAction.includes('volume')) {
    if (/(?:sube|m[aá]s|mas|arriba|alto|fuerte|aumenta)/i.test(lowerText)) {
      return { intent: 'VOLUME_UP', originalAction: originalAction || 'volume_up', rawText };
    }
    if (/(?:baja|menos|abajo|bajo|suave|despacio|bajito|reduce)/i.test(lowerText)) {
      return { intent: 'VOLUME_DOWN', originalAction: originalAction || 'volume_down', rawText };
    }
    return { intent: 'SET_VOLUME', volumeValue: 50, originalAction: originalAction || 'volume_set', rawText };
  }

  // 14. PROTECTOR DE PANTALLA
  if (
    ['screensaver', 'screensaver_start', 'protector', 'salvapantallas'].includes(lowerAction) ||
    /(?:protector|salvapantallas|modo reposo|descanso visual|pantalla negra)/i.test(lowerText)
  ) {
    return { intent: 'SCREENSAVER_START', originalAction: originalAction || 'screensaver_start', rawText };
  }
  if (['screensaver_stop', 'screensaver_off'].includes(lowerAction)) {
    return { intent: 'RESUME', originalAction: originalAction || 'resume', rawText };
  }

  // 15. SEEK / POSICIÓN TEMPORAL (Deslizador de barra de progreso)
  if (
    ['seek', 'seek_to', 'seekto', 'position', 'posicion', 'posicionar', 'ir_a', 'ir_al_segundo'].includes(lowerAction) ||
    /(?:^|\b)(?:adelanta|avanza|retrocede|salta|ve|ve al|ir al|ponlo en|minuto|segundo)\s+(\d+)/i.test(lowerText)
  ) {
    let targetTime = extracted.seekTime;
    if (targetTime === undefined) {
      const matchMinSec = lowerText.match(/(?:minuto|min)\s*(\d+)(?:\s*(?:con|y)?\s*(\d+)(?:\s*segundos?)?)?/i);
      if (matchMinSec) {
        const mins = parseInt(matchMinSec[1], 10) || 0;
        const secs = parseInt(matchMinSec[2], 10) || 0;
        targetTime = mins * 60 + secs;
      } else {
        const matchSec = lowerText.match(/(?:segundo|al segundo)\s*(\d+)/i);
        if (matchSec) {
          targetTime = parseInt(matchSec[1], 10) || 0;
        }
      }
    }
    return {
      intent: 'SEEK',
      seekTime: targetTime !== undefined ? targetTime : 0,
      originalAction: originalAction || 'seek',
      rawText
    };
  }

  // 16. SEEK RELATIVE
  if (
    ['seek_relative', 'seekrelative', 'forward', 'rewind', 'adelantar_segundos', 'retroceder_segundos'].includes(lowerAction) ||
    /(?:adelanta|avanza)\s+(\d+)\s+segundos?/i.test(lowerText) ||
    /(?:retrocede|atr[aá]s)\s+(\d+)\s+segundos?/i.test(lowerText)
  ) {
    let targetOffset = extracted.offset;
    if (targetOffset === undefined) {
      const matchFwd = lowerText.match(/(?:adelanta|avanza)\s+(\d+)/i);
      if (matchFwd) targetOffset = parseInt(matchFwd[1], 10) || 10;
      const matchRwd = lowerText.match(/(?:retrocede|atr[aá]s)\s+(\d+)/i);
      if (matchRwd) targetOffset = -(parseInt(matchRwd[1], 10) || 10);
    }
    return {
      intent: 'SEEK_RELATIVE',
      offset: targetOffset !== undefined ? targetOffset : 10,
      originalAction: originalAction || 'seek_relative',
      rawText
    };
  }

  // 17. REPEAT / MODO REPETICIÓN
  if (
    ['repeat', 'toggle_repeat', 'repetir', 'repetir_cancion', 'repetir_pista', 'bucle', 'loop'].includes(lowerAction) ||
    /(?:^|\b)(?:repetir|repite|repite la canci[oó]n|modo bucle|modo loop|loop)(?:\b|$)/i.test(lowerText)
  ) {
    return { intent: 'REPEAT', originalAction: originalAction || 'repeat', rawText };
  }

  // 18. NON-STOP / MODO CONTINUO
  if (
    ['non_stop', 'nonstop', 'toggle_non_stop', 'infinito', 'modo_continuo', 'sin_parar'].includes(lowerAction) ||
    /(?:^|\b)(?:non stop|non-stop|modo continuo|sin parar|m[uú]sica infinita)(?:\b|$)/i.test(lowerText)
  ) {
    return { intent: 'NON_STOP', originalAction: originalAction || 'non_stop', rawText };
  }

  // 19. SHUFFLE / ALEATORIO
  if (
    ['shuffle', 'aleatorio', 'mezclar', 'modo_aleatorio'].includes(lowerAction) ||
    /(?:^|\b)(?:aleatorio|modo aleatorio|mezclar|mezcla|shuffle)(?:\b|$)/i.test(lowerText)
  ) {
    return { intent: 'SHUFFLE', originalAction: originalAction || 'shuffle', rawText };
  }

  // 20. SET_QUALITY / CALIDAD DE VIDEO
  if (
    ['set_quality', 'quality', 'cambiar_calidad', 'calidad', 'calidad_video', 'resolucion'].includes(lowerAction) ||
    /(?:calidad|resoluci[oó]n)\s+(?:a\s+|en\s+)?(hd|full\s*hd|4k|720|1080|480|360|240|144|auto|m[aá]xima|alta)/i.test(lowerText)
  ) {
    return {
      intent: 'SET_QUALITY',
      quality: extracted.quality || 'auto',
      originalAction: originalAction || 'set_quality',
      rawText
    };
  }

  // 21. SET_SPEED / VELOCIDAD
  if (
    ['set_speed', 'speed', 'cambiar_velocidad', 'velocidad', 'velocidad_reproduccion'].includes(lowerAction) ||
    /(?:velocidad)\s+(?:a\s+|en\s+)?([0-9.]+)/i.test(lowerText)
  ) {
    return {
      intent: 'SET_SPEED',
      speed: typeof extracted.speed === 'number' ? extracted.speed : 1.0,
      originalAction: originalAction || 'set_speed',
      rawText
    };
  }

  // 22. RELOAD_PLAYER / RECARGAR REPRODUCTOR
  if (
    ['reload_player', 'reload', 'recargar', 'recargar_coche', 'recargar_reproductor', 'reiniciar_player'].includes(lowerAction) ||
    /(?:recargar reproductor|recarga el reproductor|recargar coche|recarga el coche|reiniciar reproductor)/i.test(lowerText)
  ) {
    return { intent: 'RELOAD_PLAYER', originalAction: originalAction || 'reload_player', rawText };
  }

  // 23. FULLSCREEN_TOGGLE / PANTALLA COMPLETA
  if (
    ['fullscreen_toggle', 'fullscreen', 'toggle_fullscreen', 'pantalla_completa', 'modo_pantalla_completa'].includes(lowerAction) ||
    /(?:pantalla completa|modo inmersivo|maximizar pantalla|pantalla coche)/i.test(lowerText)
  ) {
    return { intent: 'FULLSCREEN_TOGGLE', originalAction: originalAction || 'fullscreen_toggle', rawText };
  }

  // 24. SHOW_QR / MOSTRAR CÓDIGO QR DE VINCULACIÓN ("música: muestra QR" y todas sus variantes)
  if (
    ['show_qr', 'showqr', 'display_qr', 'qr_code', 'mostrar_qr', 'muestra_qr', 'ver_qr', 'abrir_qr', 'qr', 'qrcode'].includes(lowerAction) ||
    /(?:^|\b)(?:m[uú]sica[:\s,]*)?(?:muestra|mostrar|abre|abrir|enseña|enseñar|ver|pon|poner|sacar?|despliega|desplegar|pop\s*up)\s+(?:el\s+)?(?:c[oó]digo\s+)?qr(?:\b|$)/i.test(lowerText) ||
    /(?:^|\b)(?:m[uú]sica[:\s,]*)?(?:c[oó]digo\s+qr|qr\s+code|vincular\s+(?:m[oó]vil|tel[eé]fono|celular)|conectar\s+(?:m[oó]vil|tel[eé]fono|celular)|c[oó]digo\s+de\s+vinculaci[oó]n|vinculaci[oó]n\s+qr)(?:\b|$)/i.test(lowerText) ||
    /^(?:m[uú]sica[:\s,]*)?(?:qr|codigo qr|código qr|muestra qr|mostrar qr|ver qr|abrir qr|abre qr|pon qr|enseña qr|vincular|conectar|vinculacion)$/i.test(lowerText)
  ) {
    return { intent: 'SHOW_QR', originalAction: originalAction || 'show_qr', rawText };
  }

  // 25. BÚSQUEDA Y REPRODUCCIÓN (Música / Artistas / Canciones)
  // Conjunto exhaustivo de acciones de control para que NUNCA se interpreten como búsquedas de canciones
  const CONTROL_ACTIONS = new Set([
    'play', 'search', 'voice_command', 'player_control', 'command', '',
    'seek', 'seek_to', 'seekto', 'seek_relative', 'position', 'posicion',
    'pause', 'stop', 'resume', 'reanudar', 'next', 'prev', 'previous',
    'mute', 'unmute', 'volume_set', 'volume_up', 'volume_down', 'volume', 'vol',
    'repeat', 'toggle_repeat', 'shuffle', 'non_stop', 'nonstop', 'toggle_non_stop',
    'fullscreen_toggle', 'fullscreen', 'toggle_fullscreen',
    'show_qr', 'showqr', 'display_qr', 'qr_code', 'mostrar_qr', 'muestra_qr', 'ver_qr', 'abrir_qr', 'qr', 'qrcode',
    'reload_player', 'reload', 'set_quality', 'quality', 'set_speed', 'speed',
    'screensaver_start', 'screensaver_stop', 'screensaver_toggle',
    'state_update', 'ping', 'pong', 'register', 'register_master', 'register_satellite',
    'quick_search', 'search_music'
  ]);

  const searchCandidate = rawText || (
    !CONTROL_ACTIONS.has(lowerAction) ? originalAction : ''
  );

  // Verificación estricta: Si el texto sigue conteniendo intenciones de volumen, NUNCA buscar en YouTube
  if (/(?:volumen|decibelios|s[uú]bele|b[aá]jale)/i.test(searchCandidate)) {
    return { intent: 'VOLUME_UP', originalAction: originalAction || 'volume_up', rawText };
  }

  const cleaned = cleanSearchQuery(searchCandidate);

  if (cleaned.length > 0) {
    return {
      intent: 'LOAD_VIDEO',
      query: searchCandidate,
      cleanQuery: cleaned,
      originalAction: originalAction || 'play',
      rawText: searchCandidate
    };
  }

  // Si después de limpiar no quedó texto pero vino una orden de reproducción/play/resume
  if (lowerAction === 'play' || lowerAction === 'reproducir' || lowerAction === 'resume' || lowerAction === 'reanudar') {
    return { intent: 'RESUME', originalAction: originalAction || 'resume', rawText };
  }

  return { intent: 'UNKNOWN', originalAction, rawText };
}

// ==========================================
// 5. YOUTUBE SEARCH & RESOLUTION ENGINE
// ==========================================

export async function searchYouTubeVideo(
  searchQuery: string,
  isArtistOnly: boolean = false
): Promise<{
  videoId: string;
  title: string;
  artist: string;
  thumbnail: string;
  duration: string;
  items?: CatalogTrack[];
} | null> {
  const query = searchQuery.trim();
  if (!query) return null;

  // Búsqueda y resolución exacta mediante el buscador de Google y su corrector de palabras
  try {
    const video = await searchGoogleForVideo(query, isArtistOnly);
    if (video) {
      console.log(`[CommandDispatcher] 🎬 Video resuelto con Google para "${query}": "${video.title}" (${video.videoId}) - Artista: "${video.artist}"`);
      return video;
    }
  } catch (err) {
    console.error("[CommandDispatcher] Error en searchGoogleForVideo:", err);
  }

  // Fallback con searchYouTubeMusic directo si el corrector de Google tuvo alguna incidencia
  try {
    const result = await searchYouTubeMusic(query, isArtistOnly);
    if (result && result.firstTrack) {
      return {
        videoId: result.firstTrack.id,
        title: result.firstTrack.title,
        artist: result.firstTrack.artist,
        thumbnail: result.firstTrack.thumbnail,
        duration: result.firstTrack.duration,
        items: result.items
      };
    }
  } catch (err) {
    console.error("[CommandDispatcher] Error en searchYouTubeVideo fallback:", err);
  }

  return null;
}

export interface RecentSatelliteCommand {
  intent: IntentType;
  query?: string;
  cleanQuery?: string;
  volumeValue?: number;
  originalAction?: string;
  nodeId: string;
  nodeName: string;
  room: string;
  timestamp: number;
}

/**
 * Comprueba si dos peticiones musicales (LOAD_VIDEO) corresponden a la misma orden
 * que fue escuchada simultáneamente por dos o más teléfonos nodos micrófono satélite.
 */
export function areMusicQueriesEquivalent(queryA: string, queryB: string): boolean {
  if (!queryA || !queryB) return false;
  const normA = queryA.trim().toLowerCase();
  const normB = queryB.trim().toLowerCase();

  if (!normA || !normB) return false;

  // 1. Coincidencia idéntica
  if (normA === normB) return true;

  // 2. Contención de subcadena significativa (mínimo 4 caracteres)
  if (normA.length >= 4 && normB.length >= 4) {
    if (normA.includes(normB) || normB.includes(normA)) {
      return true;
    }
  }

  // 3. Tolerancia Levenshtein a ligeras diferencias fonéticas o de transcripción entre teléfonos
  const dist = distance(normA, normB);
  const maxLen = Math.max(normA.length, normB.length);
  if (dist <= 3 || (maxLen > 0 && dist / maxLen <= 0.30)) {
    return true;
  }

  return false;
}

// ==========================================
// 6. COMMAND DISPATCHER CLASS
// ==========================================

export class CommandDispatcher {
  private recentCommands: RecentSatelliteCommand[] = [];
  private roomActiveTurns: Map<string, { timestamp: number; nodeId: string; nodeName: string; intent: string; query?: string }> = new Map();

  constructor() {
    // Purgar periódicamente el historial de deduplicación cada 15s (retener últimos 10s)
    const timer = setInterval(() => {
      const now = Date.now();
      this.recentCommands = this.recentCommands.filter(entry => now - entry.timestamp <= 10000);
      for (const [roomKey, turn] of this.roomActiveTurns.entries()) {
        if (now - turn.timestamp > 10000) {
          this.roomActiveTurns.delete(roomKey);
        }
      }
    }, 15000);
    if (typeof timer.unref === 'function') {
      timer.unref();
    }
  }

  /**
   * Deduplica peticiones concurrentes provenientes de múltiples teléfonos nodos micrófono
   * satélite cuando escuchan y transcriben la misma orden en el habitáculo/sala.
   * Retorna el registro coincidente si la orden debe ser descartada por duplicidad, o null si debe procesarse.
   */
  public findConcurrentDuplicate(
    resolved: ResolvedIntent,
    nodeId: string,
    room: string,
    now: number = Date.now()
  ): RecentSatelliteCommand | null {
    // Ventana de deduplicación multi-nodo: 4000ms (4 segundos)
    // Absorbe las diferencias de latencia de VAD, ASR y red entre múltiples teléfonos
    const DEDUP_WINDOW_MS = 4000;

    for (const prev of this.recentCommands) {
      if (prev.room !== room) continue;
      const elapsed = now - prev.timestamp;
      if (elapsed > DEDUP_WINDOW_MS) continue;

      // 1. Comandos de volumen y mute: NUNCA descartar con ventana de 4s (permitir ajustes rápidos del usuario)
      if (
        resolved.intent === 'VOLUME_UP' ||
        resolved.intent === 'VOLUME_DOWN' ||
        resolved.intent === 'MUTE' ||
        resolved.intent === 'UNMUTE'
      ) {
        if (prev.intent === resolved.intent && elapsed < 80) {
          return prev;
        }
        continue;
      }

      if (resolved.intent === 'SET_VOLUME') {
        if (prev.intent === 'SET_VOLUME' && prev.volumeValue === resolved.volumeValue && elapsed < 80) {
          return prev;
        }
        continue;
      }

      // 2. Comandos de control de transporte y estado (next, prev, pause, resume, etc.)
      const isControlIntent =
        resolved.intent === 'NEXT' ||
        resolved.intent === 'PREV' ||
        resolved.intent === 'PAUSE' ||
        resolved.intent === 'RESUME' ||
        resolved.intent === 'REPEAT' ||
        resolved.intent === 'SHUFFLE' ||
        resolved.intent === 'SCREENSAVER_START' ||
        resolved.intent === 'SCREENSAVER_STOP';

      if (isControlIntent && prev.intent === resolved.intent) {
        return prev;
      }

      // 3. Petición musical de canción / artista (LOAD_VIDEO)
      if (resolved.intent === 'LOAD_VIDEO' && prev.intent === 'LOAD_VIDEO') {
        const queryA = resolved.cleanQuery || resolved.query || '';
        const queryB = prev.cleanQuery || prev.query || '';
        if (areMusicQueriesEquivalent(queryA, queryB)) {
          return prev;
        }
      }

      // 4. Acciones personalizadas de fallback
      if (
        resolved.intent === 'UNKNOWN' &&
        prev.intent === 'UNKNOWN' &&
        resolved.originalAction &&
        resolved.originalAction === prev.originalAction
      ) {
        return prev;
      }
    }

    return null;
  }

  /**
   * Procesa el mensaje recibido de WebSocket en texto plano / buffer con try/catch seguro.
   */
  public async handleMessage(
    data: any,
    senderWs: WebSocket,
    clientsMap: Map<WebSocket, any>,
    broadcastToRoom: (room: string, message: any, senderWs?: WebSocket) => void
  ): Promise<void> {
    let messageString: string;

    // Conversión segura de Buffer o texto a string
    try {
      if (typeof data === 'string') {
        messageString = data;
      } else if (Buffer.isBuffer(data)) {
        messageString = data.toString('utf-8');
      } else if (typeof data === 'object' && data !== null) {
        messageString = JSON.stringify(data);
      } else {
        messageString = String(data);
      }
    } catch (err) {
      console.error("[CommandDispatcher] Error decodificando flujo WebSocket:", err);
      return;
    }

    // Parseo seguro: maneja JSON formal, JSON anidado y texto plano
    let payload: any;
    if (typeof data === 'object' && data !== null && !Buffer.isBuffer(data)) {
      payload = data;
    } else {
      const trimmed = messageString.trim();
      if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        try {
          payload = JSON.parse(trimmed);
        } catch {
          payload = { action: trimmed, query: trimmed, rawQuery: trimmed };
        }
      } else {
        // Texto plano directo (ej: "pause", "play queen", "next", "subir volumen")
        payload = { action: trimmed, query: trimmed, rawQuery: trimmed };
      }
    }

    if (!payload || typeof payload !== 'object') return;

    // Actualiza metadatos del cliente remitente si vienen en el payload
    const currentClient = clientsMap.get(senderWs);
    const room = payload.room || currentClient?.room || 'serchtube-master';
    const nodeId = payload.nodeId || currentClient?.nodeId || 'android-satellite';
    const nodeName = payload.nodeName || currentClient?.nodeName || 'Satélite Android';

    if (currentClient) {
      if (payload.room) currentClient.room = payload.room;
      if (payload.nodeId) currentClient.nodeId = payload.nodeId;
      if (payload.nodeName) currentClient.nodeName = payload.nodeName;
    }

    // Ignora o maneja paquetes de registro o latidos
    if (payload.type === 'ping') {
      if (senderWs.readyState === WebSocket.OPEN) {
        senderWs.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      }
      return;
    }

    if (payload.type === 'register_satellite' || payload.type === 'register_master') {
      if (currentClient) {
        currentClient.role = payload.type === 'register_master' ? 'master' : 'satellite';
        currentClient.nodeId = nodeId;
        currentClient.nodeName = nodeName || currentClient.nodeName;
        currentClient.room = room;
      }
      const activeCount = Array.from(clientsMap.values()).filter(
        (c: any) => c && c.room === room && c.ws && c.ws.readyState === WebSocket.OPEN
      ).length;
      senderWs.send(
        JSON.stringify({
          type: 'registration_confirmed',
          role: currentClient?.role || 'satellite',
          nodeId,
          room,
          connectedCount: Math.max(1, activeCount)
        })
      );
      broadcastToRoom(room, {
        type: 'node_joined',
        nodeId,
        nodeName,
        role: currentClient?.role || 'satellite',
        totalCount: Math.max(1, activeCount),
        timestamp: Date.now()
      }, senderWs);
      return;
    }

    // Satellite mic speech activity event (triggers orb pulse on Master)
    if (payload.type === 'satellite_mic_event') {
      broadcastToRoom(room, payload, senderWs);
      return;
    }

    // Si es un ACK, actualización de estado o cola emitida por el Master, retransmite a la sala
    if (
      payload.type === 'state_update' ||
      payload.type === 'playback_state' ||
      payload.type === 'command_ack' ||
      payload.type === 'playlist_queue' ||
      payload.type === 'queue_update'
    ) {
      broadcastToRoom(room, payload, senderWs);
      return;
    }

    // ----------------------------------------------------
    // Descifrado de la Intención (Fallback Inteligente)
    // ----------------------------------------------------
    const resolved = resolveIntent(payload);

    // ----------------------------------------------------
    // Arbitraje de Turno Único Multi-Nodo (Primero en llegar de todos gana):
    // Solo aplica para peticiones musicales o búsquedas por voz.
    // Los controles de volumen y silencio NUNCA se bloquean.
    // ----------------------------------------------------
    const now = Date.now();
    const isVolumeControl =
      resolved.intent === 'SET_VOLUME' ||
      resolved.intent === 'VOLUME_UP' ||
      resolved.intent === 'VOLUME_DOWN' ||
      resolved.intent === 'MUTE' ||
      resolved.intent === 'UNMUTE';

    if (!isVolumeControl) {
      const activeTurn = this.roomActiveTurns.get(room);
      if (activeTurn && (now - activeTurn.timestamp < 4000)) {
        const elapsed = now - activeTurn.timestamp;
        console.log(
          `[CommandDispatcher] 🛡️ Arbitro de Turno Único: Orden "${resolved.intent}" de ${nodeName} (${nodeId}) descartada. Turno en curso ganado hace ${elapsed}ms por ${activeTurn.nodeName} (${activeTurn.nodeId}).`
        );

        this.sendAck(senderWs, {
          type: 'command_ack',
          success: true,
          message: `Turno en curso: ya se procesa la petición de ${activeTurn.nodeName}`,
          nodeId,
          room
        });
        return;
      }
    }

    const duplicateMatch = this.findConcurrentDuplicate(resolved, nodeId, room, now);

    if (duplicateMatch) {
      const elapsed = now - duplicateMatch.timestamp;
      console.log(
        `[CommandDispatcher] 🛡️ Deduplicación multi-nodo: Orden "${resolved.intent}" de ${nodeName} (${nodeId}) descartada porque ya fue procesada hace ${elapsed}ms desde ${duplicateMatch.nodeName} (${duplicateMatch.nodeId}).`
      );

      this.sendAck(senderWs, {
        type: 'command_ack',
        success: true,
        message: duplicateMatch.intent === 'LOAD_VIDEO'
          ? `Orden ya recibida y sincronizada desde ${duplicateMatch.nodeName}`
          : `Comando ${resolved.intent} ya ejecutado`,
        nodeId,
        room
      });
      return;
    }

    // Registrar el turno actual solo para peticiones musicales (nunca para volumen)
    if (!isVolumeControl) {
      this.roomActiveTurns.set(room, {
        timestamp: now,
        nodeId,
        nodeName,
        intent: resolved.intent,
        query: resolved.cleanQuery || resolved.query
      });
    }

    // Registrar la orden admitida para proteger contra peticiones concurrentes de otros nodos satélite
    this.recentCommands.push({
      intent: resolved.intent,
      cleanQuery: resolved.cleanQuery,
      query: resolved.query,
      volumeValue: resolved.volumeValue,
      originalAction: resolved.originalAction,
      nodeId,
      nodeName,
      room,
      timestamp: now
    });

    console.log(`[CommandDispatcher] Intención resuelta: ${resolved.intent} | Query limpia: "${resolved.cleanQuery || ''}" | Node: ${nodeId}`);

    // ----------------------------------------------------
    // Ejecución y Despacho según la Intención
    // ----------------------------------------------------
    switch (resolved.intent) {
      case 'LOAD_VIDEO': {
        const queryToSearch = resolved.cleanQuery || resolved.query || '';
        const payloadAny = payload as any;
        const directVideoId = payloadAny.videoId || payloadAny.command?.videoId || payloadAny.data?.videoId;
        try {
          const video = directVideoId
            ? {
                videoId: directVideoId,
                title: payloadAny.title || payloadAny.command?.title || queryToSearch,
                artist: payloadAny.artist || payloadAny.command?.artist || 'Artista',
                thumbnail: payloadAny.thumbnail || payloadAny.command?.thumbnail || `https://i.ytimg.com/vi/${directVideoId}/hqdefault.jpg`,
                duration: payloadAny.duration || '3:45',
                items: payloadAny.items
              }
            : await searchYouTubeVideo(queryToSearch);
          if (video) {
            const browserPayload: PlayerBrowserEvent = {
              event: 'LOAD_VIDEO',
              videoId: video.videoId,
              title: video.title,
              artist: video.artist,
              thumbnail: video.thumbnail,
              duration: video.duration,
              items: video.items,
              nodeId,
              fromNode: nodeName,
              timestamp: Date.now()
            };

            // Despacha evento al navegador donde corre el iframe de YouTube
            this.dispatchToBrowserPlayer(room, browserPayload, clientsMap, broadcastToRoom);

            // Confirmación Inmediata (ACK) para poner la app Android en verde
            const songName = video.artist ? `${video.artist} - ${video.title}` : video.title;
            this.sendAck(senderWs, {
              type: 'command_ack',
              success: true,
              message: `Reproduciendo: ${songName}`,
              nodeId,
              room
            });
          } else {
            this.sendAck(senderWs, {
              type: 'command_ack',
              success: false,
              message: `No se encontró audio para "${queryToSearch}"`,
              nodeId,
              room
            });
          }
        } catch (err: any) {
          console.error("[CommandDispatcher] Error en búsqueda de video:", err);
          this.sendAck(senderWs, {
            type: 'command_ack',
            success: false,
            message: `Error al buscar "${queryToSearch}"`,
            nodeId,
            room
          });
        }
        break;
      }

      case 'PAUSE': {
        this.dispatchToBrowserPlayer(room, { event: 'PAUSE', nodeId, fromNode: nodeName }, clientsMap, broadcastToRoom);
        this.sendAck(senderWs, {
          type: 'command_ack',
          success: true,
          message: 'Música en pausa',
          nodeId,
          room
        });
        break;
      }

      case 'RESUME': {
        this.dispatchToBrowserPlayer(room, { event: 'RESUME', nodeId, fromNode: nodeName }, clientsMap, broadcastToRoom);
        this.sendAck(senderWs, {
          type: 'command_ack',
          success: true,
          message: 'Reanudando reproducción',
          nodeId,
          room
        });
        break;
      }

      case 'NEXT': {
        this.dispatchToBrowserPlayer(room, { event: 'NEXT', nodeId, fromNode: nodeName }, clientsMap, broadcastToRoom);
        this.sendAck(senderWs, {
          type: 'command_ack',
          success: true,
          message: 'Siguiente canción',
          nodeId,
          room
        });
        break;
      }

      case 'PREV': {
        this.dispatchToBrowserPlayer(room, { event: 'PREV', nodeId, fromNode: nodeName }, clientsMap, broadcastToRoom);
        this.sendAck(senderWs, {
          type: 'command_ack',
          success: true,
          message: 'Canción anterior',
          nodeId,
          room
        });
        break;
      }

      case 'SET_VOLUME': {
        let target15 = resolved.volumeValue !== undefined ? resolved.volumeValue : 8;
        if (target15 > 15) {
          target15 = Math.round((target15 / 100) * 15);
        }
        target15 = Math.max(0, Math.min(15, target15));
        const rawPercent = Math.round((target15 / 15) * 100);

        this.dispatchToBrowserPlayer(room, {
          event: 'SET_VOLUME',
          value: target15,
          volume: target15,
          volumeValue: target15,
          rawPercent,
          nodeId,
          fromNode: nodeName
        }, clientsMap, broadcastToRoom);

        // Retransmitir actualización directa a los teléfonos satélite para mantener los controles sincronizados
        broadcastToRoom(room, {
          type: 'state_update',
          payload: {
            volume: target15,
            isMuted: false
          }
        }, senderWs);

        this.sendAck(senderWs, {
          type: 'command_ack',
          success: true,
          message: `Volumen en ${target15}/15`,
          nodeId,
          room
        });
        break;
      }

      case 'VOLUME_UP': {
        this.dispatchToBrowserPlayer(room, {
          event: 'VOLUME_UP',
          value: resolved.volumeValue,
          volume: resolved.volumeValue,
          volumeValue: resolved.volumeValue,
          nodeId,
          fromNode: nodeName
        }, clientsMap, broadcastToRoom);
        this.sendAck(senderWs, {
          type: 'command_ack',
          success: true,
          message: 'Subiendo volumen',
          nodeId,
          room
        });
        break;
      }

      case 'VOLUME_DOWN': {
        this.dispatchToBrowserPlayer(room, {
          event: 'VOLUME_DOWN',
          value: resolved.volumeValue,
          volume: resolved.volumeValue,
          volumeValue: resolved.volumeValue,
          nodeId,
          fromNode: nodeName
        }, clientsMap, broadcastToRoom);
        this.sendAck(senderWs, {
          type: 'command_ack',
          success: true,
          message: 'Bajando volumen',
          nodeId,
          room
        });
        break;
      }

      case 'MUTE': {
        this.dispatchToBrowserPlayer(room, { event: 'MUTE', nodeId, fromNode: nodeName }, clientsMap, broadcastToRoom);
        broadcastToRoom(room, {
          type: 'state_update',
          payload: { isMuted: true }
        }, senderWs);
        this.sendAck(senderWs, {
          type: 'command_ack',
          success: true,
          message: 'Audio silenciado',
          nodeId,
          room
        });
        break;
      }

      case 'UNMUTE': {
        this.dispatchToBrowserPlayer(room, { event: 'UNMUTE', nodeId, fromNode: nodeName }, clientsMap, broadcastToRoom);
        broadcastToRoom(room, {
          type: 'state_update',
          payload: { isMuted: false }
        }, senderWs);
        this.sendAck(senderWs, {
          type: 'command_ack',
          success: true,
          message: 'Sonido reactivado',
          nodeId,
          room
        });
        break;
      }

      case 'SCREENSAVER_START': {
        this.dispatchToBrowserPlayer(room, { event: 'SCREENSAVER_START', nodeId, fromNode: nodeName }, clientsMap, broadcastToRoom);
        this.sendAck(senderWs, {
          type: 'command_ack',
          success: true,
          message: 'Protector de pantalla activado',
          nodeId,
          room
        });
        break;
      }

      case 'SCREENSAVER_STOP': {
        this.dispatchToBrowserPlayer(room, { event: 'SCREENSAVER_STOP', nodeId, fromNode: nodeName }, clientsMap, broadcastToRoom);
        this.sendAck(senderWs, {
          type: 'command_ack',
          success: true,
          message: 'Protector de pantalla desactivado',
          nodeId,
          room
        });
        break;
      }

      case 'SEEK': {
        const seekTime = resolved.seekTime !== undefined ? resolved.seekTime : (payload.seekTime ?? payload.time ?? payload.position ?? 0);
        this.dispatchToBrowserPlayer(room, {
          event: 'SEEK',
          time: seekTime,
          seekTime,
          position: seekTime,
          nodeId,
          fromNode: nodeName
        }, clientsMap, broadcastToRoom);
        this.sendAck(senderWs, {
          type: 'command_ack',
          success: true,
          message: `Posición ajustada a ${Math.round(seekTime)}s`,
          nodeId,
          room
        });
        break;
      }

      case 'SEEK_RELATIVE': {
        const offset = resolved.offset !== undefined ? resolved.offset : (payload.offset ?? 10);
        this.dispatchToBrowserPlayer(room, {
          event: 'SEEK_RELATIVE',
          offset,
          nodeId,
          fromNode: nodeName
        }, clientsMap, broadcastToRoom);
        this.sendAck(senderWs, {
          type: 'command_ack',
          success: true,
          message: offset >= 0 ? `Adelantando ${offset}s` : `Retrocediendo ${Math.abs(offset)}s`,
          nodeId,
          room
        });
        break;
      }

      case 'REPEAT': {
        this.dispatchToBrowserPlayer(room, {
          event: 'REPEAT',
          nodeId,
          fromNode: nodeName
        }, clientsMap, broadcastToRoom);
        this.sendAck(senderWs, {
          type: 'command_ack',
          success: true,
          message: 'Modo repetición alternado',
          nodeId,
          room
        });
        break;
      }

      case 'NON_STOP': {
        this.dispatchToBrowserPlayer(room, {
          event: 'NON_STOP',
          nodeId,
          fromNode: nodeName
        }, clientsMap, broadcastToRoom);
        this.sendAck(senderWs, {
          type: 'command_ack',
          success: true,
          message: 'Modo Non-Stop alternado',
          nodeId,
          room
        });
        break;
      }

      case 'SHUFFLE': {
        this.dispatchToBrowserPlayer(room, {
          event: 'SHUFFLE',
          nodeId,
          fromNode: nodeName
        }, clientsMap, broadcastToRoom);
        this.sendAck(senderWs, {
          type: 'command_ack',
          success: true,
          message: 'Lista mezclada en orden aleatorio',
          nodeId,
          room
        });
        break;
      }

      case 'SET_QUALITY': {
        const quality = resolved.quality || payload.quality || payload.playbackQuality || 'auto';
        this.dispatchToBrowserPlayer(room, {
          event: 'SET_QUALITY',
          quality,
          playbackQuality: quality,
          nodeId,
          fromNode: nodeName
        }, clientsMap, broadcastToRoom);
        this.sendAck(senderWs, {
          type: 'command_ack',
          success: true,
          message: `Calidad de video cambiada a ${quality}`,
          nodeId,
          room
        });
        break;
      }

      case 'SET_SPEED': {
        const speed = resolved.speed !== undefined ? resolved.speed : (payload.speed ?? 1.0);
        this.dispatchToBrowserPlayer(room, {
          event: 'SET_SPEED',
          speed,
          playbackSpeed: speed,
          nodeId,
          fromNode: nodeName
        }, clientsMap, broadcastToRoom);
        this.sendAck(senderWs, {
          type: 'command_ack',
          success: true,
          message: `Velocidad cambiada a ${speed}x`,
          nodeId,
          room
        });
        break;
      }

      case 'RELOAD_PLAYER': {
        this.dispatchToBrowserPlayer(room, {
          event: 'RELOAD_PLAYER',
          nodeId,
          fromNode: nodeName
        }, clientsMap, broadcastToRoom);
        this.sendAck(senderWs, {
          type: 'command_ack',
          success: true,
          message: 'Recargando reproductor en el vehículo',
          nodeId,
          room
        });
        break;
      }

      case 'FULLSCREEN_TOGGLE': {
        this.dispatchToBrowserPlayer(room, {
          event: 'FULLSCREEN_TOGGLE',
          nodeId,
          fromNode: nodeName
        }, clientsMap, broadcastToRoom);
        this.sendAck(senderWs, {
          type: 'command_ack',
          success: true,
          message: 'Pantalla completa alternada',
          nodeId,
          room
        });
        break;
      }

      case 'SHOW_QR': {
        this.dispatchToBrowserPlayer(room, {
          event: 'SHOW_QR',
          duration: 10,
          nodeId,
          fromNode: nodeName
        }, clientsMap, broadcastToRoom);
        this.sendAck(senderWs, {
          type: 'command_ack',
          success: true,
          message: 'Mostrando código QR de vinculación por 10 segundos',
          nodeId,
          room
        });
        break;
      }

      default: {
        const fallbackAction = (resolved.originalAction || payload.action || '').trim();
        if (fallbackAction) {
          const eventName = fallbackAction.toUpperCase();
          this.dispatchToBrowserPlayer(room, {
            event: eventName,
            nodeId,
            fromNode: nodeName,
            ...payload
          }, clientsMap, broadcastToRoom);

          this.sendAck(senderWs, {
            type: 'command_ack',
            success: true,
            message: `Comando ${fallbackAction} procesado`,
            nodeId,
            room
          });
        } else {
          console.warn(`[CommandDispatcher] Mensaje no ejecutable recibido de ${nodeId}:`, messageString?.slice(0, 100));
          this.sendAck(senderWs, {
            type: 'command_ack',
            success: false,
            message: 'Comando no reconocido o vacío',
            nodeId,
            room
          });
        }
        break;
      }
    }
  }

  /**
   * Despacha el evento al reproductor web (Browser) donde corre el iframe de YouTube.
   * Busca clientes registrados con role === 'master' en la sala, o cualquier master disponible.
   */
  public dispatchToBrowserPlayer(
    room: string,
    eventData: PlayerBrowserEvent,
    clientsMap: Map<WebSocket, any>,
    broadcastToRoom: (room: string, message: any) => void
  ): void {
    const rawPayload = JSON.stringify(eventData);
    let sentCount = 0;

    // 1. Busca masters específicos en la sala
    for (const [ws, info] of clientsMap.entries()) {
      if (ws.readyState === WebSocket.OPEN && info.role === 'master' && info.room === room) {
        ws.send(rawPayload);
        sentCount++;
      }
    }

    // 2. Si no hay master con esa sala exacta, busca cualquier cliente master conectado
    if (sentCount === 0) {
      for (const [ws, info] of clientsMap.entries()) {
        if (ws.readyState === WebSocket.OPEN && info.role === 'master') {
          ws.send(rawPayload);
          sentCount++;
        }
      }
    }

    // 3. Si aún no hay masters registrados, difunde a toda la sala como salvaguarda
    if (sentCount === 0) {
      broadcastToRoom(room, eventData);
    }

    console.log(`[CommandDispatcher] Evento despachado al reproductor: ${eventData.event} (destinatarios directos: ${sentCount})`);
  }

  /**
   * Envía confirmación inmediata (ACK) de vuelta al WebSocket del satélite Android.
   */
  public sendAck(ws: WebSocket, ack: CommandAck): void {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    try {
      ws.send(
        JSON.stringify({
          type: 'command_ack',
          success: ack.success,
          message: ack.message,
          nodeId: ack.nodeId,
          room: ack.room,
          timestamp: Date.now()
        })
      );
    } catch (err) {
      console.warn("[CommandDispatcher] Error enviando ACK:", err);
    }
  }
}

// Instancia singleton por defecto
export const commandDispatcher = new CommandDispatcher();
