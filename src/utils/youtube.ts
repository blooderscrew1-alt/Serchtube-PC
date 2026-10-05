/**
 * Utility functions for extracting and validating YouTube video IDs and URLs.
 * Supports:
 * - https://www.youtube.com/watch?v=VIDEO_ID (with any parameters)
 * - https://youtu.be/VIDEO_ID (with any parameters)
 * - https://www.youtube.com/live/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 * - https://www.youtube.com/shorts/VIDEO_ID
 * - https://m.youtube.com/watch?v=VIDEO_ID
 * - Raw 11-character video IDs
 */

export function extractYouTubeId(input?: string): string {
  if (!input || !input.trim()) return '';
  const trimmed = input.trim();

  // If already exactly a clean 11-character YouTube video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  // 1. Check for standard youtu.be short links
  const shortMatch = trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/i);
  if (shortMatch && shortMatch[1]) {
    return shortMatch[1];
  }

  // 2. Check for ?v= or &v= parameter in URL
  const vParamMatch = trimmed.match(/[?&]v=([a-zA-Z0-9_-]{11})/i);
  if (vParamMatch && vParamMatch[1]) {
    return vParamMatch[1];
  }

  // 3. Check for /embed/, /v/, /live/, or /shorts/ paths
  const pathMatch = trimmed.match(/youtube\.com\/(?:embed|v|live|shorts)\/([a-zA-Z0-9_-]{11})/i);
  if (pathMatch && pathMatch[1]) {
    return pathMatch[1];
  }

  // 4. General match for any youtube.com URL containing an 11-character ID
  const generalMatch = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+?&v=|live\/|shorts\/))([a-zA-Z0-9_-]{11})/i);
  if (generalMatch && generalMatch[1]) {
    return generalMatch[1];
  }

  // 5. Fallback: search for any standalone 11-character token in the string
  const tokenMatch = trimmed.match(/(?:^|[^a-zA-Z0-9_-])([a-zA-Z0-9_-]{11})(?:[^a-zA-Z0-9_-]|$)/);
  if (tokenMatch && tokenMatch[1]) {
    return tokenMatch[1];
  }

  return trimmed;
}

export function isValidYouTubeId(id?: string): boolean {
  if (!id) return false;
  return /^[a-zA-Z0-9_-]{11}$/.test(id.trim());
}

export function getYouTubeThumbnail(idOrUrl?: string): string {
  const id = extractYouTubeId(idOrUrl);
  if (!isValidYouTubeId(id)) return '';
  return `https://img.youtube.com/vi/${id}/mqdefault.jpg`;
}

export function getYouTubeWatchUrl(idOrUrl?: string): string {
  const id = extractYouTubeId(idOrUrl);
  if (!isValidYouTubeId(id)) return '';
  return `https://www.youtube.com/watch?v=${id}`;
}

/**
 * Verifica si un texto corresponde a una orden de continuar / reanudar / play
 * en vez de una búsqueda de canción o artista.
 */
export function isPureResumePhrase(cleanText?: string): boolean {
  if (!cleanText) return true;

  const normalized = cleanText
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'«»“”]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return true;

  const stripped = normalized
    .replace(/^(?:oye\s+serch|serch|asistente|por\s+favor)\s*/i, '')
    .replace(/\s*(?:por\s+favor)\s*$/i, '')
    .trim();

  if (!stripped) return true;

  const resumePhrasesRegex = /^(?:play|resume|unpause|reproducir|reproduce|reanudate|reanudar|reanuda|continuar|continua|sigue|seguir|dale\s+(?:al\s+)?play|pon\s+play|dar\s+play|darle\s+play|despausa|despausar|quitar?\s+(?:la\s+)?pausa|quitar?\s+(?:el\s+)?pause|sacar?\s+(?:la\s+)?pausa|iniciar?\s+reproduccion|reanudacion)(?:\s+(?:la\s+)?(?:musica|cancion|reproduccion|pista|audio))?$/i;

  if (resumePhrasesRegex.test(stripped)) {
    return true;
  }

  const genericMusicRegex = /^(?:pon|ponme|poner|toca|tocar|escuchar|escucha|quiero\s+escuchar|reproduce|reproducir)\s+(?:la\s+)?(?:musica|cancion|audio)$/i;
  if (genericMusicRegex.test(stripped)) {
    return true;
  }

  if (/^(?:musica|audio|reproduccion)$/i.test(stripped)) {
    return true;
  }

  return false;
}
