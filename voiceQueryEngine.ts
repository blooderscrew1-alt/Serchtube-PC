/**
 * MOTOR DE PETICIONES DE VOZ Y RECUPERACIÓN DE CONSULTAS (SerchTube Music)
 * ======================================================================
 *
 * Este módulo es PURO (no importa nada del proyecto) para poder usarse tanto desde
 * youtubeEngine.ts como desde googleSearchCorrector.ts sin crear dependencias
 * circulares. Resuelve el problema de "el asistente no encuentra la canción que pedí":
 *
 *  1. Normaliza la petición sin destruir nombres propios.
 *  2. Analiza la INTENCIÓN real (canción concreta, artista, éxitos, género, playlist,
 *     mezcla o fragmento de letra) y la variante pedida (remix, en vivo, instrumental…).
 *  3. Compara fonéticamente español <-> inglés (quien habla español pronuncia los
 *     títulos ingleses con sonidos españoles: "jalo" ~ "hello", "uikid" ~ "wicked").
 *  4. Genera un número LIMITADO de variantes útiles, conservando siempre la petición
 *     original como referencia.
 *  5. Aporta una bonificación de contexto que los puntuadores existentes suman a su
 *     propia puntuación (título, artista, fonética, género, variante, duración).
 *
 * Lo que NO hace: traducir títulos, memorizar canciones ni corregir de forma
 * irreversible (una palabra rara puede ser un nombre artístico legítimo).
 */

// ─────────────────────────────────────────────────────────── Tipos

export type TipoPeticion =
  | 'cancion'
  | 'artista'
  | 'exitos'
  | 'genero'
  | 'playlist'
  | 'mezcla'
  | 'fragmento_letra'
  | 'no_musical';

export type VariantePedida =
  | 'remix' | 'en_vivo' | 'instrumental' | 'acustica' | 'cover'
  | 'karaoke' | 'slowed' | '8d' | null;

export interface PeticionVoz {
  /** Texto original tal cual se recibió (nunca se descarta) */
  original: string;
  /** Petición sin comandos: "pon", "reproduce", "quiero escuchar"… */
  limpia: string;
  tipo: TipoPeticion;
  /** Título pedido (si se pidió una canción concreta) */
  titulo?: string;
  /** Artista pedido */
  artista?: string;
  /** Género pedido ("música de cumbia") */
  genero?: string;
  /** Variante pedida explícitamente */
  variante: VariantePedida;
  /** Fragmento de letra ("la que dice hello from the other side") */
  fragmentoLetra?: string;
  /** Idioma probable de la petición hablada (no del título) */
  idiomaProbable: 'es' | 'en' | 'otro' | 'desconocido';
  /** Confianza del análisis (0..1) */
  confianza: number;
}

export interface ContextoPuntuacion {
  intent?: PeticionVoz;
  /** Lo que el usuario dijo (para similitud fonética contra el candidato) */
  consultaOriginal?: string;
  /** La variante concreta que produjo este candidato */
  variante?: string;
}

// ─────────────────────────────────────────────── Normalización

const DIACRITICOS = /[\u0300-\u036f]/g;

/** Minúsculas, sin acentos, sin puntuación, espacios simples. Conserva el texto. */
export function normalizarBase(texto: string): string {
  if (!texto) return '';
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(DIACRITICOS, '')
    .replace(/[^\p{L}\p{N}\s'’]/gu, ' ')
    .replace(/['’]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Distancia de Levenshtein con tope para no gastar tiempo en cadenas largas */
function levenshtein(a: string, b: string, tope = 12): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  if (Math.abs(a.length - b.length) > tope) return tope + 1;
  let previa = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) previa[j] = j;
  for (let i = 1; i <= a.length; i++) {
    const actual = [i];
    for (let j = 1; j <= b.length; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      actual[j] = Math.min(actual[j - 1] + 1, previa[j] + 1, previa[j - 1] + costo);
    }
    previa = actual;
  }
  return previa[b.length];
}

/** Similitud 0..1 por edición (sensible a diferencias reales, no borra matices) */
export function similitudTexto(a: string, b: string): number {
  const x = normalizarBase(a);
  const y = normalizarBase(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const dist = levenshtein(x, y, 14);
  const sim = 1 - dist / Math.max(x.length, y.length);
  return Math.max(0, Math.min(1, sim));
}

// ─────────────────────────────────── Fonética español <-> inglés

/**
 * Reglas de sonido que un hispanohablante aplica al pronunciar/escribir inglés
 * (y al revés). Se aplican a cada palabra para obtener una "clave de sonido".
 * No borran vocales ni reducen todo a lo mismo: solo unifican sonidos equivalentes.
 */
export function claveFonetica(palabra: string): string {
  let w = normalizarBase(palabra);
  if (!w) return '';
  // Dígrafos y equivalencias ES<->EN
  w = w
    .replace(/ph/g, 'f')
    .replace(/ck/g, 'k')
    .replace(/qu/g, 'k')
    .replace(/([kg])u(?=[aeio])/g, '$1')  // "kuin"~"queen", "guerl"~"girl"
    .replace(/gu(?=[ei])/g, 'g')
    .replace(/sh/g, 's')
    .replace(/th/g, 't')
    .replace(/ch/g, 'ch')
    .replace(/tion/g, 'sion')
    .replace(/oo/g, 'u')
    .replace(/ee/g, 'i')
    .replace(/ou/g, 'u')
    .replace(/ai/g, 'ei')
    .replace(/ei/g, 'ei')
    .replace(/y/g, 'i');
  // Consonantes equivalentes entre idiomas
  w = w
    .replace(/v/g, 'b')
    .replace(/z/g, 's')
    .replace(/c(?=[ei])/g, 's')
    .replace(/c/g, 'k')
    .replace(/x/g, 'ks')
    .replace(/w/g, 'u')
    .replace(/j/g, 'h')     // "j" española ~ "h" inglesa (jalo/hello)
    .replace(/gu(?=[ei])/g, 'g'); // "guerra/guerl" se mantiene con g (girl/guerl ~ igual)
  // "h" muda al inicio; dobles letras; "e" final muda del inglés
  w = w.replace(/^h/, '');
  w = w.replace(/(.)\1+/g, '$1');
  if (w.length > 3 && w.endsWith('e')) w = w.slice(0, -1);
  return w;
}

/** Clave de sonido de una frase completa (por palabras) */
export function claveFoneticaFrase(frase: string): string {
  return normalizarBase(frase).split(/\s+/).filter(Boolean).map(claveFonetica).join(' ');
}

function bigramas(s: string): Map<string, number> {
  const m = new Map<string, number>();
  for (let i = 0; i < s.length - 1; i++) {
    const g = s.slice(i, i + 2);
    m.set(g, (m.get(g) || 0) + 1);
  }
  return m;
}

/**
 * Esqueleto de consonantes de una palabra (sobre su clave fonética). Dos palabras
 * distintas que suenan igual al oído hispanohablante comparten consonantes aunque
 * cambien las vocales: "jalo"/"hello" -> "hl", "mai"/"my" -> "m", "guerl"/"girl" -> "grl".
 */
function esqueletoConsonantes(palabra: string): string {
  return claveFonetica(palabra).replace(/[aeiou]/g, '');
}

/** Coeficiente de Dice sobre bigramas (0..1) */
function dice(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const A = bigramas(a);
  const B = bigramas(b);
  let comunes = 0;
  let totalA = 0;
  let totalB = 0;
  for (const n of A.values()) totalA += n;
  for (const n of B.values()) totalB += n;
  for (const [g, n] of A) comunes += Math.min(n, B.get(g) || 0);
  const denom = totalA + totalB;
  return denom === 0 ? 0 : (2 * comunes) / denom;
}

/**
 * Similitud fonética global entre dos frases (0..1). Combina:
 *  - Dice sobre las claves de sonido (tolerante a escritura distinta),
 *  - mejor emparejamiento palabra a palabra por clave y por texto,
 *  - proporción de palabras cubiertas.
 */
export function similitudFonetica(a: string, b: string): number {
  const na = normalizarBase(a);
  const nb = normalizarBase(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;

  const fa = claveFoneticaFrase(na);
  const fb = claveFoneticaFrase(nb);
  const porSonido = dice(fa, fb);

  const pa = na.split(/\s+/).filter(w => w.length > 1);
  const pb = nb.split(/\s+/).filter(w => w.length > 1);
  if (pa.length === 0 || pb.length === 0) return porSonido;

  let suma = 0;
  let cubiertas = 0;
  for (const w of pa) {
    const kw = claveFonetica(w);
    const sw = esqueletoConsonantes(w);
    let mejor = 0;
    for (const v of pb) {
      const kv = claveFonetica(v);
      const sv = esqueletoConsonantes(v);
      // Mismo esqueleto de consonantes = señal fuerte de "suena igual" (0.85, no 1.0)
      const porEsqueleto = sw.length >= 1 && sw === sv ? 0.85 : 0;
      const s = Math.max(porEsqueleto, kv === kw ? 1 : 0, dice(kw, kv), similitudTexto(w, v) * 0.95);
      if (s > mejor) mejor = s;
    }
    suma += mejor;
    if (mejor >= 0.62) cubiertas++;
  }
  const promedio = suma / pa.length;
  const cobertura = cubiertas / pa.length;
  const global = Math.max(porSonido, promedio * 0.88 + cobertura * 0.12);
  return Math.max(0, Math.min(1, global));
}

// ────────────────────────────────────── Análisis de la petición

const COMANDOS_INICIALES = [
  'ponme', 'pon', 'poner', 'reproduce', 'reproducir', 'reproduci',
  'quiero escuchar', 'quiero oir', 'quiero oír', 'quiero que suene',
  'escuchame', 'escúchame', 'escucha', 'tocame', 'tócame', 'toca', 'tocar',
  'buscame', 'búscame', 'busca', 'buscar', 'dale play', 'dale', 'play',
  'vamos a escuchar', 'pasame', 'pásame', 'coloca', 'pon la', 'pon el', 'pon los', 'pon las'
];

const GENEROS = [
  'cumbia', 'salsa', 'bachata', 'reggaeton', 'reggaetón', 'merengue', 'vallenato', 'champeta',
  'rock', 'pop', 'balada', 'baladas', 'bolero', 'boleros', 'tango', 'flamenco', 'norteÑo', 'norteno',
  'banda', 'corrido', 'corridos', 'ranchera', 'grupera', 'mariachi', 'electrónica', 'electronica',
  'jazz', 'clásica', 'clasica', 'blues', 'metal', 'punk', 'reggae', 'ska', 'rap', 'hip hop',
  'trap', 'house', 'techno', 'soul', 'funk', 'disco', 'country', 'infantil', 'navideña', 'navidena'
];

const VARIANTES: Array<{ clave: VariantePedida; rx: RegExp; etiqueta: string }> = [
  { clave: 'remix', rx: /\b(remix|remezcla|remixeado)\b/i, etiqueta: 'remix' },
  { clave: 'en_vivo', rx: /\b(en vivo|live|directo|acustico en vivo|concierto)\b/i, etiqueta: 'en vivo' },
  { clave: 'instrumental', rx: /\b(instrumental|karaoke de|sin voz|pista)\b/i, etiqueta: 'instrumental' },
  { clave: 'acustica', rx: /\b(acustic[ao]|acoustic|version acustica)\b/i, etiqueta: 'acústica' },
  { clave: 'cover', rx: /\b(cover|version de|version|tributo|homenaje)\b/i, etiqueta: 'cover' },
  { clave: 'karaoke', rx: /\b(karaoke)\b/i, etiqueta: 'karaoke' },
  { clave: 'slowed', rx: /\b(slowed|ralentizado|reverb|reverberacion)\b/i, etiqueta: 'slowed' },
  { clave: '8d', rx: /\b8d\b/i, etiqueta: '8d audio' }
];

/** Palabras inglesas muy frecuentes (sirven para detectar peticiones en inglés) */
const PALABRAS_INGLES = new Set([
  'the', 'of', 'my', 'you', 'your', 'i', 'will', 'always', 'love', 'baby', 'girl', 'boy',
  'sweet', 'child', 'mine', 'hello', 'from', 'other', 'side', 'another', 'one', 'bites',
  'dust', 'careless', 'whisper', 'billie', 'jean', 'ringer', 'bonnie', 'clyde', 'queen',
  'guns', 'roses', 'michael', 'george', 'whitney', 'houston', 'jackson', 'eminem', 'never',
  'gonna', 'give', 'up', 'down', 'night', 'day', 'time', 'life', 'real', 'fantasy',
  'education', 'need', 'we', 'dont', 'do', 'is', 'this', 'just', 'be', 'to', 'and', 'in'
]);

const PALABRAS_ES = new Set([
  'de', 'la', 'el', 'los', 'las', 'un', 'una', 'y', 'que', 'con', 'para', 'por', 'del',
  'cancion', 'musica', 'tema', 'pon', 'reproduce', 'quiero', 'escuchar', 'busca', 'exitos',
  'mejores', 'playlist', 'lista', 'mix', 'en', 'vivo', 'version', 'letra', 'dice', 'como'
]);

function quitarComandos(texto: string): string {
  let t = normalizarBase(texto);
  let cambio = true;
  let guardas = 0;
  while (cambio && guardas < 6) {
    cambio = false;
    guardas++;
    for (const cmd of COMANDOS_INICIALES) {
      const rx = new RegExp(`^${cmd.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b\\s*`, 'i');
      if (rx.test(t)) {
        t = t.replace(rx, '').trim();
        cambio = true;
      }
    }
    // "la canción", "el tema", "una canción de" al inicio
    t = t.replace(/^(la|el|una|un)\s+(cancion|tema|rola|pieza|musica)\s+/i, '').trim();
    if (/^(cancion|tema|rola)\s+/.test(t)) {
      t = t.replace(/^(cancion|tema|rola)\s+/, '').trim();
      cambio = true;
    }
    // "musica" al inicio SOLO se quita si NO va seguida de "de"
    // ("musica de queen" es una petición de artista y debe conservarse)
    if (/^musica\s+(?!de\b)/.test(t)) {
      t = t.replace(/^musica\s+/, '').trim();
      cambio = true;
    }
    // "la cancion que dice …" -> el fragmento queda como consulta principal
    t = t.replace(/^(la|el|una|un)\s+(cancion|tema|rola)\s+que\s+(dice|diga|canta|suena)\s+/i, '').trim();
    // Artículo suelto al inicio: "el remix de billie jean" -> "remix de billie jean"
    if (/^(el|la|los|las|un|una)\s+\S/.test(t) && t.split(/\s+/).length > 2) {
      t = t.replace(/^(el|la|los|las|un|una)\s+/i, '').trim();
    }
    // "de" suelto al inicio (residuo de "la canción de …")
    if (/^(?:de|del)\s+/i.test(t) && t.split(/\s+/).length > 1) {
      t = t.replace(/^(?:de|del)\s+/i, '').trim();
      cambio = true;
    }
  }
  return t.trim();
}

/** Detecta el idioma probable de la petición HABLADA (no del título musical) */
function idiomaProbableDe(texto: string): PeticionVoz['idiomaProbable'] {
  const t = normalizarBase(texto);
  if (!t) return 'desconocido';
  const palabras = t.split(/\s+/).filter(Boolean);
  if (palabras.length < 2) return 'desconocido';
  let en = 0;
  let es = 0;
  for (const p of palabras) {
    if (PALABRAS_INGLES.has(p)) en++;
    if (PALABRAS_ES.has(p)) es++;
  }
  if (en > es && en >= 2) return 'en';
  if (es >= en && es >= 2) return 'es';
  return 'desconocido';
}

/**
 * ¿El texto parece una petición musical? Sirve para NO tratar comandos de control
 * (pausa, siguiente, volumen…) como búsquedas de canciones.
 */
export function esPeticionMusical(texto: string): boolean {
  const t = normalizarBase(texto);
  if (!t) return false;

  // ¿Empieza con una orden de MÚSICA ("pon…", "reproduce…") o con un CONTROL
  // ("pausa…", "siguiente…", "sube el volumen…")? Los controles nunca son búsquedas,
  // aunque digan "la música" o "la canción".
  const empiezaMusica = /^(pon|ponme|poner|reproduce|reproducir|reproduci|quiero|busca|buscame|buscar|toca|tocar|play|dale|escucha|escuchame|coloca|pasame|vamos)\b/.test(t);
  const empiezaControl = /^(pausa|pausar|pausado|pausando|deten|detener|para|parar|alto|stop|siguiente|next|anterior|prev|atras|adelante|sube|baja|silencia|silencio|mute|reanuda|continua|continúa|apaga|enciende|volumen)\b/.test(t);
  if (empiezaControl && !empiezaMusica) return false;

  // Comandos de control cortos en cualquier posición ("la pausa", "pon pausa" ya es raro)
  if (!empiezaMusica &&
      /\b(pausa|pausar|pausado|pausando|detener|deten|parar|alto|stop|siguiente|next|anterior|prev|volumen|silencia|silencio|mute|reanuda|continua|continúa|apaga)\b/.test(t) &&
      t.split(/\s+/).length <= 4) {
    return false;
  }
  return true;
}

/** Analiza la petición: intención, título, artista, género, variante y fragmento */
export function analizarPeticionVoz(textoOriginal: string): PeticionVoz {
  const original = (textoOriginal || '').trim();
  let limpia = quitarComandos(original);

  // Variante pedida explícitamente
  let variante: VariantePedida = null;
  for (const v of VARIANTES) {
    if (v.rx.test(limpia)) { variante = v.clave; break; }
  }
  // No restamos la palabra de la consulta: ayuda a que YouTube devuelva esa versión.

  // Fragmento de letra: "la canción que dice …", "la que dice …", "busca la que dice …"
  let fragmentoLetra: string | undefined;
  const rxLetra = /\b(?:la\s+)?(?:cancion|tema|rola)?\s*(?:que|q)\s+(?:dice|diga|canta|suena)\s+(.+)$/i;
  const mLetra = rxLetra.exec(limpia);
  if (mLetra && mLetra[1] && mLetra[1].trim().split(/\s+/).length >= 2) {
    fragmentoLetra = mLetra[1].trim();
  }

  // Género
  let genero: string | undefined;
  for (const g of GENEROS) {
    if (new RegExp(`\\b${g}\\b`, 'i').test(limpia)) { genero = g.replace('norteno', 'norteño').replace('electronica', 'electrónica').replace('clasica', 'clásica').replace('navidena', 'navideña'); break; }
  }

  // Tipo de petición
  let tipo: TipoPeticion = 'cancion';
  if (!esPeticionMusical(limpia)) tipo = 'no_musical';
  else if (fragmentoLetra) tipo = 'fragmento_letra';
  else if (/\b(exitos|éxitos|grandes exitos|grandes éxitos|hits|lo mejor de|best of|mas exitosas|más exitosas)\b/i.test(limpia)) tipo = 'exitos';
  else if (/\b(playlist|lista de reproduccion|lista de reproducción)\b/i.test(limpia)) tipo = 'playlist';
  else if (/\b(mezcla|mix de|recopilacion|recopilación)\b/i.test(limpia)) tipo = 'mezcla';
  else if (genero && /\b(musica|música|pon|reproduce|ponme|algo de)\b/i.test(limpia) && !/\bde\s+\w+\s+de\b/i.test(limpia)) tipo = 'genero';
  else if (/^(musica|música)\s+de\s+(.+)$/i.test(limpia)) tipo = 'artista';
  else if (/\bde\s+([\p{L}\p{N}'\s.&]+)$/iu.test(limpia) === false && /\b(musica|música)\s+de\b/i.test(limpia)) tipo = 'artista';

  // Separar título / artista con "de", "por" o " - "
  let titulo: string | undefined;
  let artista: string | undefined;
  let baseParaSplit = fragmentoLetra ? '' : limpia
    .replace(/^(musica|música|los exitos de|los éxitos de|grandes exitos de|grandes éxitos de|exitos de|éxitos de|lo mejor de|playlist de|mezcla de|mix de)\s*/i, '')
    .trim();
  // La variante pedida NO es parte del título: "el remix de careless whisper" -> "careless whisper"
  baseParaSplit = baseParaSplit
    .replace(/^(el|la|los|las|un|una)?\s*(remix|remezcla|version en vivo|en vivo|live|directo|instrumental|karaoke|acustic[ao]|acoustic|cover)\s+(de\s+|del\s+)?/i, '')
    .trim();

  /** ¿El texto sirve como título/artista? (no puede ser solo "de", "la", etc.) */
  const esUtil = (s?: string): boolean => {
    if (!s) return false;
    const nucleo = normalizarBase(s).replace(/\b(de|del|la|el|los|las|un|una|mi|tu)\b/g, ' ').trim();
    return nucleo.length >= 2;
  };

  if (baseParaSplit) {
    // Se toma el ÚLTIMO "de/por" como separador del artista (greedy), porque el
    // título puede contener "de" ("volver volver de vicente fernandez").
    const rxTituloArtista = /\b(.+)\s+(?:de|por|interpretada por)\s+([\p{L}\p{N}'\s.&]+)$/iu;
    const m = rxTituloArtista.exec(baseParaSplit);
    if (m && esUtil(m[1]) && esUtil(m[2])) {
      titulo = m[1].trim();
      artista = m[2].trim();
    } else {
      const mGuion = /^(.{2,})\s[-–—]\s(.{2,})$/.exec(baseParaSplit);
      if (mGuion && esUtil(mGuion[2])) { artista = mGuion[1].trim(); titulo = mGuion[2].trim(); }
    }
    if (/^(musica|música)\s+de\s+(.+)$/i.test(limpia)) {
      artista = limpia.replace(/^(musica|música)\s+de\s+/i, '').trim();
      titulo = undefined;
      if (tipo === 'cancion') tipo = 'artista';
    }
    if (tipo === 'artista' && !artista && esUtil(baseParaSplit)) {
      artista = baseParaSplit;
      titulo = undefined;
    }
    if (!titulo && !artista && tipo === 'cancion' && esUtil(baseParaSplit)) {
      // Sin separador claro: tratamos todo como título (puede ser un artista igualmente)
      titulo = baseParaSplit;
    }
  }

  // Si hay género y no hay título/artista, el "objetivo" es el género
  if (genero && tipo === 'genero') { titulo = undefined; }

  const idiomaProbable = idiomaProbableDe(limpia);
  let confianza = 0.5;
  if (titulo) confianza += 0.2;
  if (artista) confianza += 0.2;
  if (genero) confianza += 0.1;
  if (fragmentoLetra) confianza += 0.1;
  if (tipo === 'no_musical') confianza = 0;

  return {
    original,
    limpia,
    tipo,
    titulo,
    artista,
    genero,
    variante,
    fragmentoLetra,
    idiomaProbable,
    confianza: Math.max(0, Math.min(1, confianza))
  };
}

// ─────────────────────────────────── Variantes de consulta

/** Aplica reglas inversas (español -> grafía inglesa probable) a una palabra */
function reescrituraInglesa(palabra: string): string[] {
  const w = normalizarBase(palabra);
  if (w.length < 3) return [];
  const salidas = new Set<string>();
  const reglas: Array<[RegExp, string]> = [
    [/^j/, 'h'],            // jalo -> halo
    [/^y/, 'j'],
    [/h/g, 'j'],
    [/u/g, 'oo'],
    [/i/g, 'ee'],
    [/s/g, 'th'],
    [/b/g, 'v'],
    [/k/g, 'c'],
    [/f/g, 'ph'],
    [/ei/g, 'ai'],
    [/g(?=[ei])/g, 'gu'],
    [/s(?=[ei])/g, 'c'],
    [/t/g, 'th'],
    [/w/g, 'u'],
    // Duplicación de consonantes: es lo que convierte "halo" en "hallo" (~hello)
    [/l/g, 'll'],
    [/r/g, 'rr'],
    [/n/g, 'nn'],
    [/m/g, 'mm'],
    [/p/g, 'pp'],
    [/t(?=[aeiou])/g, 'tt'],
  ];
  salidas.add(w.replace(/^h/, ''));            // "hello" dicho "elo"
  for (const [rx, rep] of reglas) {
    const cand = w.replace(rx, rep);
    if (cand !== w) salidas.add(cand);
  }
  // Combinaciones de dos reglas sobre palabras cortas (bounded)
  const base = [...salidas];
  for (const a of base) {
    for (const [rx, rep] of reglas) {
      const cand = a.replace(rx, rep);
      if (cand !== a) salidas.add(cand);
      if (salidas.size > 8) break;
    }
    if (salidas.size > 8) break;
  }
  salidas.delete(w);
  return [...salidas].slice(0, 3);
}

/** Palabras que NO conviene reescribir (conectores, comandos, géneros) */
const NO_REESCRIBIR = new Set([
  ...COMANDOS_INICIALES.flatMap(c => c.split(' ')),
  ...PALABRAS_ES, 'de', 'la', 'el', 'los', 'las', 'mi', 'tu', 'su', 'y', 'o', 'a', 'en',
  'del', 'al', 'que', 'con', 'sin', 'por', 'para', 'es', 'son', 'un', 'una', 'unos', 'unas'
]);

/**
 * Genera variantes de búsqueda LIMITADAS y sin redundancias, conservando la
 * petición original como V0. Nunca corrige de forma irreversible: solo propone.
 */
export function generarVariantesConsulta(peticion: PeticionVoz, max: number = 4): Array<{ texto: string; origen: string }> {
  const salidas: Array<{ texto: string; origen: string }> = [];
  const vistos = new Set<string>();
  const agregar = (texto: string, origen: string) => {
    const limpio = (texto || '').replace(/\s+/g, ' ').trim();
    const clave = normalizarBase(limpio);
    if (!limpio || !clave || vistos.has(clave)) return;
    if (salidas.length >= max) return;
    vistos.add(clave);
    salidas.push({ texto: limpio, origen });
  };

  // V0: petición limpiada (la original siempre queda como referencia en `original`)
  agregar(peticion.limpia, 'peticion-original');

  // Fragmento de letra: se busca por el fragmento tal cual
  if (peticion.fragmentoLetra) {
    agregar(peticion.fragmentoLetra, 'fragmento-letra');
    return salidas;
  }

  const objetivo = [peticion.titulo, peticion.artista].filter(Boolean).join(' ').trim() || peticion.limpia;

  // V1: para GÉNERO/mezcla/playlist se busca "género + mix/exitos" (no "de", que YouTube
  // interpreta como un artista llamado igual que la frase)
  if (peticion.genero && (peticion.tipo === 'genero' || peticion.tipo === 'mezcla' || peticion.tipo === 'playlist')) {
    agregar(`${peticion.genero} mix exitos`, 'genero-mix');
  }

  // V2: si pidió una variante concreta, se asegura que aparezca explícita en la consulta
  // (va antes que las experimentales: es la intención real del usuario)
  if (peticion.variante) {
    const etiqueta = VARIANTES.find(v => v.clave === peticion.variante)?.etiqueta || peticion.variante;
    const base = [peticion.titulo, peticion.artista].filter(Boolean).join(' ').trim() || peticion.limpia;
    if (!new RegExp(etiqueta, 'i').test(base)) {
      agregar(`${base} ${etiqueta}`, `variante:${peticion.variante}`);
    }
  }

  // V2: recombinación título/artista (por si el reconocimiento los invirtió)
  if (peticion.titulo && peticion.artista) {
    agregar(`${peticion.artista} ${peticion.titulo}`, 'recombinacion-artista-titulo');
  }

  // V3: intención explícita de artista/éxitos/género
  if (peticion.tipo === 'artista' && peticion.artista) {
    agregar(`${peticion.artista} mix`, 'artista-mix');
    agregar(`${peticion.artista} canciones`, 'artista-canciones');
  } else if (peticion.tipo === 'exitos' && peticion.artista) {
    agregar(`${peticion.artista} grandes exitos`, 'exitos');
  } else if (peticion.tipo === 'genero' && peticion.genero) {
    agregar(`${peticion.genero} mix exitos`, 'genero-mix');
  }

  // V4: reescritura fonética (último recurso). Solo tiene sentido cuando se pidió una
  // CANCIÓN o un fragmento: un género, unos éxitos o "música de X" no se "fonetizan".
  if (peticion.tipo === 'cancion' || peticion.tipo === 'fragmento_letra') {
    const palabras = normalizarBase(objetivo).split(/\s+/).filter(w => w.length >= 4 && !NO_REESCRIBIR.has(w));
    for (const palabra of palabras) {
      for (const cand of reescrituraInglesa(palabra)) {
        agregar(objetivo.replace(new RegExp(`\\b${palabra}\\b`, 'i'), cand), `fonetica:${palabra}->${cand}`);
        if (salidas.length > max + 1) break;
      }
      if (salidas.length > 1) break;
    }
  }

  return salidas;
}

// ─────────────────────────────── Bonificación de contexto

function tokensSignificativos(texto: string): string[] {
  return normalizarBase(texto)
    .split(/\s+/)
    .filter(t => t.length > 1);
}

/**
 * Puntos que se SUMAN a la puntuación propia de los motores (y motivos legibles).
 * Señales: artista, título, fonética ES<->EN, género, variante pedida, fragmento.
 */
export function bonificacionContexto(
  item: { title?: string; artist?: string; duration?: string },
  contexto: ContextoPuntuacion
): { puntos: number; motivos: string[] } {
  const motivos: string[] = [];
  let puntos = 0;
  const titulo = item.title || '';
  const artista = item.artist || '';
  const combinado = `${titulo} ${artista}`;
  const peticion = contexto.intent;

  if (!peticion) return { puntos: 0, motivos };

  const normCombinado = normalizarBase(combinado);
  const esTopic = /-\s*topic$/i.test(artista);
  const canalOficial = esTopic || /vevo|official|records|music/i.test(artista);

  // 1) Artista pedido: fuerte si aparece en el canal/artista, leve si solo en el título
  if (peticion.artista) {
    const tokArtista = tokensSignificativos(peticion.artista);
    if (tokArtista.length > 0) {
      const normArtistaCanal = normalizarBase(artista);
      const normTitulo = normalizarBase(titulo);
      const enCanal = tokArtista.filter(t => normArtistaCanal.includes(t) || claveFoneticaFrase(normArtistaCanal).includes(claveFonetica(t))).length;
      const enTitulo = tokArtista.filter(t => normTitulo.includes(t)).length;
      const coberturaCanal = enCanal / tokArtista.length;
      const coberturaTitulo = enTitulo / tokArtista.length;
      if (coberturaCanal >= 0.6) {
        puntos += 420 + Math.round(coberturaCanal * 180);
        motivos.push(`artista en canal (${Math.round(coberturaCanal * 100)}%)`);
      } else if (coberturaTitulo >= 0.6 && !canalOficial) {
        puntos += 120;
        motivos.push('artista solo en el título (posible homenaje/tributo)');
      } else {
        const fon = similitudFonetica(peticion.artista, `${titulo} ${artista}`);
        if (fon >= 0.72) {
          puntos += 140;
          motivos.push(`artista fonéticamente similar (${fon.toFixed(2)})`);
        }
      }
    }
  }

  // 2) Título pedido
  if (peticion.titulo) {
    const tokTitulo = tokensSignificativos(peticion.titulo);
    const normTitulo = normalizarBase(titulo);
    const normFonTitulo = claveFoneticaFrase(normTitulo);
    if (tokTitulo.length > 0) {
      let cubiertos = 0;
      let fonCubiertos = 0;
      for (const t of tokTitulo) {
        if (normTitulo.includes(t)) cubiertos++;
        else if (normFonTitulo.includes(claveFonetica(t))) fonCubiertos++;
      }
      const cob = cubiertos / tokTitulo.length;
      const cobFon = (cubiertos + fonCubiertos * 0.85) / tokTitulo.length;
      if (cob >= 0.8) { puntos += 520; motivos.push(`título casi exacto (${Math.round(cob * 100)}%)`); }
      else if (cobFon >= 0.8) { puntos += 380; motivos.push(`título por sonido (${Math.round(cobFon * 100)}%)`); }
      else if (cobFon >= 0.55) { puntos += 160; motivos.push(`título parcial por sonido (${Math.round(cobFon * 100)}%)`); }
      else if (cob < 0.4 && cobFon < 0.5) { puntos -= 180; motivos.push('título pedido ausente'); }
    }
  }

  // 3) Similitud fonética global con lo que se dijo (ES<->EN)
  if (contexto.consultaOriginal) {
    const fon = similitudFonetica(contexto.consultaOriginal, titulo);
    if (fon >= 0.8) { puntos += 320; motivos.push(`muy similar a lo dicho (${fon.toFixed(2)})`); }
    else if (fon >= 0.62) { puntos += 150; motivos.push(`similar a lo dicho (${fon.toFixed(2)})`); }
  }

  // 4) Género: SOLO se cuenta si aparece en el TÍTULO. El motor a veces rellena el
  //    campo "artist" con el texto de la búsqueda ("musica de cumbia"), y puntuar eso
  //    hacía ganar candidatos que no eran del género.
  if (peticion.genero) {
    if (new RegExp(`\\b${peticion.genero}\\b`, 'i').test(normalizarBase(titulo))) {
      puntos += 320;
      motivos.push(`género ${peticion.genero} presente`);
    }
  }

  // 5) Variante pedida vs. variante del resultado
  const tieneRemix = /\bremix|remezcla\b/i.test(combinado);
  const tieneVivo = /\b(en vivo|live|directo|concert)\b/i.test(combinado);
  const tieneInstrumental = /\binstrumental|karaoke|pista\b/i.test(combinado);
  const tieneAcustica = /\bacustic|acústic\b/i.test(combinado);
  const tieneCover = /\bcover|tributo|version de\b/i.test(combinado);
  const tieneSlowed = /\bslowed|reverb|ralentiz|8d\b/i.test(combinado);

  if (peticion.variante) {
    const mapa: Record<string, boolean> = {
      remix: tieneRemix, en_vivo: tieneVivo, instrumental: tieneInstrumental,
      acustica: tieneAcustica, cover: tieneCover, slowed: tieneSlowed, '8d': tieneSlowed,
      karaoke: tieneInstrumental
    };
    if (mapa[peticion.variante]) {
      // Si pidió explícitamente esa versión, debe ganarle a la original
      puntos += 700;
      motivos.push(`variante pedida (${peticion.variante}) presente`);
    } else {
      puntos -= 300;
      motivos.push(`falta la variante pedida (${peticion.variante})`);
    }
  } else {
    // Sin variante pedida: se prefiere la original -> penalización leve (nunca -800)
    if (tieneRemix || tieneSlowed) { puntos -= 140; motivos.push('remix/slowed no pedido'); }
    if (tieneCover) { puntos -= 120; motivos.push('cover no pedido'); }
    if (tieneVivo) { puntos -= 60; motivos.push('en vivo no pedido'); }
    // Género/mezcla/playlist/artista: la recopilación SÍ es lo deseado
    if (peticion.tipo === 'genero' || peticion.tipo === 'mezcla' || peticion.tipo === 'playlist' || peticion.tipo === 'exitos') {
      if (/mix|recopilacion|recopilación|grandes exitos|grandes éxitos|playlist|compilacion|compilación|exitos|éxitos/i.test(combinado)) {
        puntos += 260;
        motivos.push('recopilación coherente con la petición');
      }
    }
  }

  // 6) Fragmento de letra: coincidencia de palabras del fragmento en metadatos
  if (peticion.fragmentoLetra) {
    const tokFrag = tokensSignificativos(peticion.fragmentoLetra).filter(t => t.length > 2);
    if (tokFrag.length > 0) {
      const normFrag = normalizarBase(peticion.fragmentoLetra);
      const normTituloFon = claveFoneticaFrase(titulo);
      const presentes = tokFrag.filter(t => normFrag.includes(t) && (normalizarBase(titulo).includes(t) || normTituloFon.includes(claveFonetica(t)))).length;
      if (presentes > 0) {
        puntos += 200 + presentes * 60;
        motivos.push(`coincidencia con la letra citada (${presentes})`);
      }
    }
  }

  return { puntos, motivos };
}
