import { GoogleGenAI } from '@google/genai';
import type { CatalogTrack } from './youtubeEngine.ts';

// ============================================================================
// SERCHTUBE MUSIC CONTEXT & GENRE COHERENCE ENGINE
// ============================================================================
// Garantiza que las listas de reproducción y recomendaciones automáticas (Non-Stop)
// sigan una línea musical 100% coherente con el artista, género y estilo solicitado,
// evitando saltos ilógicos (ej: de Eminem a música banda, o de Kendrick Lamar a baladas).
// ============================================================================

export interface MusicalContext {
  requestedArtist: string;
  requestedSong?: string | null;
  primaryGenre: string;
  subgenre: string;
  vibe: string;
  topArtistSongs: string[];
  coherentRelatedArtists: string[];
  coherentSearchTerms: string[];
}

// In-memory cache for fast, zero-latency subsequent queries
const contextCache = new Map<string, MusicalContext>();

// Lazy initialization of GoogleGenAI for server-side use
let genAIClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI | null {
  if (!genAIClient && process.env.GEMINI_API_KEY) {
    try {
      genAIClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    } catch (e) {
      console.warn('[MusicContextEngine] Error inicializando GoogleGenAI:', e);
    }
  }
  return genAIClient;
}

// ============================================================================
// 1. BASE DE CONOCIMIENTO LOCAL DE GÉNEROS Y ARTISTAS RELACIONADOS (Taxonomía)
// ============================================================================
export interface GenreCluster {
  genre: string;
  subgenre: string;
  vibe: string;
  artists: string[];
  sampleTracks: string[];
  conflictingClusters: string[];
  conflictingGenreKeywords: string[];
}

export const GENRE_CLUSTERS: Record<string, GenreCluster> = {
  hip_hop: {
    genre: 'hip-hop / rap',
    subgenre: 'hip-hop / rap / west coast / east coast / trap',
    vibe: 'urban beats, lyrical flow, 808s and groove',
    artists: [
      'eminem', 'kendrick lamar', '2pac', 'tupac', 'the notorious b.i.g.', 'notorious big', 'biggie',
      'dr. dre', 'dr dre', '50 cent', 'snoop dogg', 'j. cole', 'j cole', 'drake', 'kanye west',
      'travis scott', 'jay-z', 'jay z', 'nas', 'dmx', 'ice cube', 'lil wayne', 'a$ap rocky', 'asap rocky',
      'outkast', 'wu-tang clan', 'wu tang clan', 'future', 'metro boomin', 'post malone', 'mac miller',
      'kid cudi', 'pusha t', 'schoolboy q', 'tyler, the creator', 'tyler the creator', 'childish gambino',
      'd12', 'nate dogg', 'busta rhymes', 'cypress hill', 'mobb deep', 'rakim', 'eazy-e', 'eazy e',
      'n.w.a', 'nwa', 'warren g', 'll cool j', 'ludacris', 'juice wrld', 'xxxtentacion', 'lil baby',
      'lil uzi vert', 'cardi b', 'nicki minaj', 'doja cat', 'jack harlow', '21 savage', 'gunna',
      'offset', 'quavo', 'young thug', 'roddy ricch', 'dave', 'stormzy', 'central cee', 'dillom',
      'canserbero', 'trueno', 'duki', 'wos', 'acru', 'nach', 'kase.o', 'kase o', 'violadores del verso',
      'residente', 'calle 13', 'santa fe klan', 'cartel de santa', 'geramx', 'gera mx', 'aleman', 'alemán', 'c-kan'
    ],
    sampleTracks: [
      'Lose Yourself', 'Without Me', 'The Real Slim Shady', 'Till I Collapse', 'Stan', 'Mockingbird',
      'HUMBLE.', 'DNA.', 'Swimming Pools', 'Alright', 'King Kunta', 'Money Trees', 'All the Stars', 'Not Like Us', 'Euphoria',
      'California Love', 'Changes', 'Dear Mama', 'Hit Em Up', 'Ambitionz Az A Ridah', 'All Eyez On Me',
      'In Da Club', 'Still D.R.E.', 'The Next Episode', 'Nuthin But A G Thang', 'Gin and Juice',
      'No Role Modelz', 'Middle Child', 'Gods Plan', 'Hotline Bling', 'Stronger', 'SICKO MODE', 'Empire State of Mind'
    ],
    conflictingClusters: ['regional_mexicano', 'baladas_pop_espanol', 'cumbia_vallenato', 'musica_infantil'],
    conflictingGenreKeywords: [
      'banda', 'mariachi', 'norteño', 'norteno', 'corridos', 'corridos tumbados', 'cumbia', 'bachata',
      'salsa romantica', 'balada romantica', 'balada', 'bolero', 'vals', 'infantil', 'ranchera', 'tango',
      'flamenco', 'chotis', 'polka', 'villancico', 'musica para dormir', 'sonora santanera', 'los angeles azules'
    ]
  },
  classic_rock: {
    genre: 'classic rock / 70s-80s rock',
    subgenre: 'classic rock / hard rock / arena rock',
    vibe: 'electric guitars, anthemic vocals, rock n roll drums',
    artists: [
      'queen', 'led zeppelin', 'pink floyd', 'ac/dc', 'acdc', 'the rolling stones', 'the beatles',
      'guns n roses', 'guns n\' roses', 'aerosmith', 'bon jovi', 'deep purple', 'scorpions',
      'dire straits', 'the police', 'david bowie', 'the who', 'the doors', 'eagles', 'fleetwood mac',
      'eric clapton', 'creedence clearwater revival', 'ccr', 'kiss', 'van halen', 'def leppard',
      'journey', 'toto', 'boston', 'kansas', 'foreignor', 'bad company', 'zz top', 'lynyrd skynyrd',
      'black sabbath', 'ozzy osbourne', 'meat loaf', 'bryan adams', 'billy joel', 'elton john', 'rod stewart'
    ],
    sampleTracks: [
      'Bohemian Rhapsody', 'Don\'t Stop Me Now', 'Another One Bites the Dust', 'We Will Rock You',
      'Sweet Child O\' Mine', 'November Rain', 'Livin\' on a Prayer', 'Back in Black', 'Highway to Hell',
      'Stairway to Heaven', 'Wish You Were Here', 'Comfortably Numb', 'Hotel California', 'Sultans of Swing'
    ],
    conflictingClusters: ['regional_mexicano', 'reggaeton_urban', 'cumbia_vallenato', 'k_pop'],
    conflictingGenreKeywords: [
      'reggaeton', 'trap latino', 'banda', 'cumbia', 'bachata', 'k-pop', 'kpop', 'corridos', 'dembow',
      'perreo', 'mambo', 'merengue', 'norteño'
    ]
  },
  latin_rock: {
    genre: 'latin rock / rock en español',
    subgenre: 'rock en español / 80s-90s latin rock',
    vibe: 'guitarras latinas, rock poético, acordes hispanos',
    artists: [
      'soda stereo', 'gustavo cerati', 'mana', 'maná', 'los enanitos verdes', 'enanitos verdes',
      'heroes del silencio', 'héroes del silencio', 'los prisioneros', 'caifanes', 'jaguares',
      'cafe tacvba', 'café tacvba', 'molotov', 'andres calamaro', 'andrés calamaro', 'los fabulosos cadillacs',
      'fabulosos cadillacs', 'jarabe de palo', 'charly garcia', 'charly garcía', 'fito paez', 'fito páez',
      'la ley', 'bunbury', 'enrique bunbury', 'los rodriguez', 'los abuelos de la nada', 'rata blanca',
      'mikel erentxun', 'duncan dhu', 'babasonicos', 'babasónicos', 'zoe', 'zoé', 'elefante', 'la oreja de van gogh',
      'estopa', 'los piojos', 'la renga', 'ataque 77', 'skai beilinson', 'indio solari', 'patricio rey'
    ],
    sampleTracks: [
      'De Música Ligera', 'Persiana Americana', 'En la Ciudad de la Furia', 'Crimen', 'Puente',
      'Oye Mi Amor', 'Rayando El Sol', 'Clavado En Un Bar', 'Lamento Boliviano', 'Entre Dos Tierras',
      'La Flaca', 'Mil Horas', 'Matador', 'Ingrata', 'Afuera', 'Tren Al Sur', 'Gimme Tha Power'
    ],
    conflictingClusters: ['regional_mexicano', 'k_pop', 'musica_infantil'],
    conflictingGenreKeywords: [
      'trap americano', 'k-pop', 'dembow', 'drill', 'dubstep', 'corridos bélicos', 'corridos tumbados'
    ]
  },
  alt_rock_grunge: {
    genre: 'alternative rock / 90s-2000s rock / grunge',
    subgenre: 'alternative / grunge / nu-metal / pop punk',
    vibe: 'distorted guitars, energetic rock rhythm, melodic vocals',
    artists: [
      'linkin park', 'nirvana', 'red hot chili peppers', 'rhcp', 'green day', 'foo fighters',
      'pearl jam', 'the offspring', 'blink-182', 'blink 182', 'system of a down', 'soad',
      'radiohead', 'muse', 'coldplay', 'the killers', 'arctic monkeys', 'audioslave', 'soundgarden',
      'alice in chains', 'smashing pumpkins', 'rage against the machine', 'sum 41', 'my chemical romance',
      'evanescence', 'papa roach', 'limp bizkit', 'incubus', 'franz ferdinand', 'placebo', 'the strokes',
      'fall out boy', 'paramore', 'three days grace', 'rise against', 'seether', 'shinedown', 'good charlotte'
    ],
    sampleTracks: [
      'Numb', 'In the End', 'Faint', 'Crawling', 'Smells Like Teen Spirit', 'Come as You Are',
      'Californication', 'Otherside', 'Can\'t Stop', 'Basket Case', 'Boulevard of Broken Dreams',
      'The Pretender', 'Everlong', 'Alive', 'Chop Suey!', 'Creep', 'Yellow', 'Mr. Brightside'
    ],
    conflictingClusters: ['regional_mexicano', 'baladas_pop_espanol', 'reggaeton_urban', 'cumbia_vallenato'],
    conflictingGenreKeywords: [
      'banda', 'mariachi', 'corridos', 'cumbia', 'bachata', 'reggaeton', 'dembow', 'balada romantica',
      'perreo', 'norteño', 'boleros'
    ]
  },
  salsa_tropical: {
    genre: 'salsa / música tropical caribeña',
    subgenre: 'salsa romantica / salsa brava / son cubano',
    vibe: 'clave, timbales, congas, metales de viento, sabor latino',
    artists: [
      'hector lavoe', 'héctor lavoe', 'frankie ruiz', 'eddie santiago', 'willie colon', 'willie colón',
      'marc anthony', 'hildemaro', 'oscar d leon', 'oscar d\'león', 'gilberto santa rosa',
      'grupo niche', 'joe arroyo', 'el gran combo', 'el gran combo de puerto rico', 'ruben blades',
      'rubén blades', 'celia cruz', 'cheo feliciano', 'ismael rivera', 'ismael miranda', 'luis enrique',
      'jerry rivera', 'tití rojas', 'tito nieves', 'lalo rodriguez', 'lalo rodríguez', 'david pabon',
      'david pabón', 'pedro arroyo', 'tony vega', 'rey ruiz', 'puerto rican power', 'la sonora ponceña',
      'orquesta guayacan', 'guayacán', 'victor manuelle', 'mandy vazquez', 'mandy vázquez', 'tito rojas'
    ],
    sampleTracks: [
      'Periódico De Ayer', 'El Cantante', 'Juanito Alimaña', 'Tú Con Él', 'Desnúdate Mujer',
      'La Rueda', 'Lluvia', 'Todo Empezó', 'Valió La Pena', 'Vivir Mi Vida', 'Una Vez Más',
      'Llorarás', 'Conciencia', 'Cali Pachanguero', 'Rebelión', 'Aguanilé', 'Pedro Navaja'
    ],
    conflictingClusters: ['metal_hardrock', 'alt_rock_grunge', 'k_pop'],
    conflictingGenreKeywords: [
      'heavy metal', 'death metal', 'hardstyle', 'grunge', 'black metal', 'country music', 'k-pop', 'punk rock'
    ]
  },
  reggaeton_urban: {
    genre: 'reggaeton / trap latino / urban',
    subgenre: 'reggaeton / perreo / latin trap',
    vibe: 'dembow beat, syncopated 4x4 latin groove, urban vocals',
    artists: [
      'bad bunny', 'daddy yankee', 'don omar', 'wisin & yandel', 'wisin y yandel', 'wisin', 'yandel',
      'rauw alejandro', 'feid', 'j balvin', 'maluma', 'ozuna', 'anuel aa', 'karol g', 'myke towers',
      'jhayco', 'jhay cortez', 'sech', 'chencho corleone', 'tego calderon', 'tego calderón', 'arcangel',
      'arcángel', 'zion & lennox', 'zion y lennox', 'plan b', 'nicky jam', 'farruko', 'mora', 'quevedo',
      'bizarrap', 'eladio carrion', 'eladio carrión', 'young miko', 'duki', 'trueno', 'tiago pzk',
      'ryan castro', 'blessd', 'cris mj', 'polima westcoast', 'saiko', 'milo j', 'de la ghetto'
    ],
    sampleTracks: [
      'Tití Me Preguntó', 'Me Porto Bonito', 'Ojitos Lindos', 'Monaco', 'Gasolina', 'Danza Kuduro',
      'Ella Me Levantó', 'Rakata', 'Todo De Ti', 'Desesperados', 'Feliz Cumpleaños Ferxxo', 'Provenza',
      'Bichota', 'Mi Gente', 'Hawái', 'Dile', 'Mayor Que Yo', 'Pepas', 'Bzrp Music Sessions'
    ],
    conflictingClusters: ['metal_hardrock', 'classic_rock', 'baladas_pop_espanol'],
    conflictingGenreKeywords: [
      'heavy metal', 'death metal', 'grunge', 'opera', 'musica clasica', 'country music', 'balada romantica antigua'
    ]
  },
  pop_international: {
    genre: 'pop / contemporary pop / dance pop',
    subgenre: 'mainstream pop / synth pop / r&b pop',
    vibe: 'catchy hooks, polished production, modern pop rhythms',
    artists: [
      'michael jackson', 'shakira', 'the weeknd', 'bruno mars', 'dua lipa', 'taylor swift',
      'billie eilish', 'ed sheeran', 'justin timberlake', 'katy perry', 'lady gaga', 'ariana grande',
      'rihanna', 'beyonce', 'beyoncé', 'madonna', 'britney spears', 'harry styles', 'adele',
      'sia', 'sam smith', 'maroon 5', 'justin bieber', 'selena gomez', 'miley cyrus', 'charlie puth',
      'shawn mendes', 'camila cabello', 'olivia rodrigo', 'sabrina carpenter', 'dua lipa', 'ava max'
    ],
    sampleTracks: [
      'Billie Jean', 'Thriller', 'Beat It', 'Smooth Criminal', 'Hips Don\'t Lie', 'Whenever, Wherever',
      'Blinding Lights', 'Starboy', 'Save Your Tears', 'Uptown Funk', 'Levitating', 'Don\'t Start Now',
      'Shape of You', 'Bad Guy', 'Rolling in the Deep', 'Can\'t Stop the Feeling'
    ],
    conflictingClusters: ['metal_hardrock', 'regional_mexicano'],
    conflictingGenreKeywords: [
      'death metal', 'grindcore', 'corridos tumbados', 'black metal', 'banda sinaloense pesada'
    ]
  },
  baladas_pop_espanol: {
    genre: 'baladas en español / pop romantico',
    subgenre: 'balada romantica / pop latino / cantautor',
    vibe: 'piano, guitarras acusticas, letras romanticas y emotivas',
    artists: [
      'luis miguel', 'alejandro sanz', 'chayanne', 'cristian castro', 'ricardo arjona',
      'juan gabriel', 'marco antonio solis', 'marco antonio solís', 'jose jose', 'josé josé',
      'roberto carlos', 'camilo sesto', 'julio iglesias', 'enrique iglesias', 'david bisbal',
      'pablo alboran', 'pablo alborán', 'manuel turizo', 'sebastian yatra', 'sebastián yatra',
      'morat', 'reik', 'camila', 'sin bandera', 'ha*ash', 'ha ash', 'jesse & joy', 'jesse y joy',
      'yuridia', 'mon laferte', 'rocio durcal', 'rocío dúrcal', 'ana gabriel', 'los temerarios',
      'bronco', 'franco de vita', 'ricardo montaner', 'alex ubago', 'la oreja de van gogh', 'amaia montero'
    ],
    sampleTracks: [
      'Ahora Te Puedes Marchar', 'La Incondicional', 'Culpable o No', 'Corazón Partío', 'Y Tú Te Vas',
      'Torero', 'Dejaría Todo', 'Azul', 'Por Amarte Así', 'Señora de las Cuatro Décadas', 'Querida',
      'Hasta Que Te Conocí', 'Si No Te Hubieras Ido', 'El Triste', 'Gavilán o Paloma', 'Vivir Así Es Morir de Amor'
    ],
    conflictingClusters: ['hip_hop', 'metal_hardrock', 'alt_rock_grunge'],
    conflictingGenreKeywords: [
      'gangsta rap', 'death metal', 'drill', 'hardcore techno', 'grindcore', 'trap pesado'
    ]
  },
  electronic_dance: {
    genre: 'electronic / dance / edm / synthwave',
    subgenre: 'house / french house / synthwave / edm',
    vibe: 'four-on-the-floor beat, synths, hypnotic basslines, electronic drops',
    artists: [
      'daft punk', 'avicii', 'calvin harris', 'david guetta', 'swedish house mafia',
      'the chemical brothers', 'deadmau5', 'tiesto', 'tiësto', 'fatboy slim', 'marshmello',
      'martin garrix', 'kygo', 'disclosure', 'justice', 'skrillex', 'alesso', 'armin van buuren',
      'kavinsky', 'the prodigy', 'pendulum', 'moby', 'zedd', 'dj snake', 'afrojack', 'steve aoki'
    ],
    sampleTracks: [
      'Get Lucky', 'Around The World', 'One More Time', 'Harder, Better, Faster, Stronger',
      'Wake Me Up', 'Levels', 'Summer', 'Titanium', 'Don\'t You Worry Child', 'Strobe'
    ],
    conflictingClusters: ['regional_mexicano', 'baladas_pop_espanol'],
    conflictingGenreKeywords: [
      'banda', 'mariachi', 'corridos', 'bachata tradicional', 'ranchera', 'bolero'
    ]
  },
  regional_mexicano: {
    genre: 'regional mexicano / banda / norteño',
    subgenre: 'banda sinaloense / norteño / mariachi / corridos',
    vibe: 'tubas, clarinetes, trompetas, acordeón, sentimiento regional',
    artists: [
      'banda ms', 'grupo firme', 'christian nodal', 'carin leon', 'carín león', 'julion alvarez',
      'julión álvarez', 'calibre 50', 'los angeles azules', 'los ángeles azules', 'la adictiva',
      'banda el recodo', 'gerardo ortiz', 'alfredo olivas', 'los dos carnales', 'pesado', 'intocable',
      'vicente fernandez', 'vicente fernández', 'alejandro fernandez', 'alejandro fernández',
      'pedro infante', 'jose alfredo jimenez', 'josé alfredo jiménez', 'los tigres del norte',
      'los tucanes de tijuana', 'fuerza regida', 'peso pluma', 'junior h', 'natanael cano',
      'eslabon armado', 'eslabón armado', 'grupo frontera', 'marca registrada', 'luis r conriquez',
      'gabito ballesteros', 'la arrolladora banda el limon', 'el fantasma', 'chuy lizarraga'
    ],
    sampleTracks: [
      'El Color de Tus Ojos', 'Ya Superame', 'Adiós Amor', 'Botella Tras Botella', 'Primera Cita',
      'Afuera Está Lloviendo', 'A Través del Vaso', '17 Años', 'Cómo Te Voy a Olvidar', 'El Rey',
      'Ella Baila Sola', 'Lady Gaga', 'un X100to', 'No Se Va', 'Bebe Dame'
    ],
    conflictingClusters: ['hip_hop', 'metal_hardrock', 'classic_rock', 'alt_rock_grunge', 'electronic_dance'],
    conflictingGenreKeywords: [
      'heavy metal', 'death metal', 'techno', 'drill rap', 'grunge', 'hard rock', 'synthwave'
    ]
  },
  metal_hardrock: {
    genre: 'heavy metal / metal / hard rock',
    subgenre: 'heavy metal / thrash metal / nu-metal',
    vibe: 'heavy riffs, double bass drums, aggressive guitar distortion',
    artists: [
      'metallica', 'iron maiden', 'megadeth', 'black sabbath', 'slipknot', 'judas priest',
      'pantera', 'avenged sevenfold', 'rammstein', 'slayer', 'motorhead', 'motörhead',
      'ozzy osbourne', 'system of a down', 'disturbed', 'korn', 'marilyn manson', 'anthrax',
      'sepultura', 'dio', 'mastodon', 'gojira', 'ghost', 'trivium', 'lamb of god'
    ],
    sampleTracks: [
      'Master of Puppets', 'Enter Sandman', 'The Trooper', 'Fear of the Dark', 'Holy Wars',
      'Paranoid', 'Iron Man', 'Duality', 'Breaking the Law', 'Walk', 'Cowboys from Hell', 'Du Hast'
    ],
    conflictingClusters: ['reggaeton_urban', 'regional_mexicano', 'baladas_pop_espanol', 'cumbia_vallenato'],
    conflictingGenreKeywords: [
      'reggaeton', 'banda', 'cumbia', 'bachata', 'k-pop', 'corridos', 'dembow', 'trap latino', 'perreo'
    ]
  }
};

/**
 * Normaliza nombres de artistas o géneros para búsqueda en diccionario
 */
export function normalizeKey(str: string): string {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Encuentra el cluster de género localmente basado en el texto del usuario
 */
export function findLocalGenreCluster(query: string): { clusterKey: string; cluster: GenreCluster; matchedArtist?: string } | null {
  const normQuery = normalizeKey(query);
  if (!normQuery) return null;

  for (const [key, cluster] of Object.entries(GENRE_CLUSTERS)) {
    for (const artist of cluster.artists) {
      const normArtist = normalizeKey(artist);
      if (
        normQuery === normArtist ||
        normQuery.includes(normArtist) ||
        normArtist.includes(normQuery)
      ) {
        return { clusterKey: key, cluster, matchedArtist: artist };
      }
    }
  }

  // Comprobar si coincide con canciones icónicas del cluster
  for (const [key, cluster] of Object.entries(GENRE_CLUSTERS)) {
    for (const track of cluster.sampleTracks) {
      const normTrack = normalizeKey(track);
      if (normQuery.includes(normTrack) || normTrack.includes(normQuery)) {
        return { clusterKey: key, cluster };
      }
    }
  }

  return null;
}

// ============================================================================
// 2. ANALIZADOR INTELIGENTE DE CONTEXTO MUSICAL (Gemini AI + Local Fallback)
// ============================================================================

/**
 * Resuelve el contexto musical completo para cualquier artista o canción solicitada,
 * asegurando una lista coherente de canciones del mismo artista y artistas afines.
 */
export async function resolveMusicalContext(rawQuery: string): Promise<MusicalContext> {
  const cleanKey = normalizeKey(rawQuery);
  if (contextCache.has(cleanKey)) {
    return contextCache.get(cleanKey)!;
  }

  // 1. Taxonomía local ultrarrápida (0-1ms, sin llamadas remotas lentas)
  const localMatch = findLocalGenreCluster(rawQuery);
  if (localMatch) {
    const cluster = localMatch.cluster;
    const artistName = localMatch.matchedArtist || rawQuery;
    const otherArtistsInCluster = cluster.artists
      .filter(a => normalizeKey(a) !== normalizeKey(artistName))
      .slice(0, 8)
      .map(a => a.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '));

    const context: MusicalContext = {
      requestedArtist: artistName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      requestedSong: null,
      primaryGenre: cluster.genre,
      subgenre: cluster.subgenre,
      vibe: cluster.vibe,
      topArtistSongs: cluster.sampleTracks.slice(0, 10),
      coherentRelatedArtists: otherArtistsInCluster,
      coherentSearchTerms: [
        `${artistName} greatest hits playlist`,
        `${artistName} best songs official video`,
        `${cluster.genre} greatest hits`
      ]
    };

    contextCache.set(cleanKey, context);
    return context;
  }

  // 2. Si no hay coincidencia local y Gemini está disponible, consulta con timeout corto (máx 1.2s)
  const ai = getGenAI();
  if (ai) {
    try {
      const prompt = `You are SerchTube's expert music playlist curator.
Analyze the user's music request: "${rawQuery}".
Return a strict JSON object with this structure:
{
  "requestedArtist": "Name of the main artist (e.g., Kendrick Lamar, Eminem, Queen, Hildemaro, Soda Stereo)",
  "requestedSong": "Name of the specific song if mentioned, or null",
  "primaryGenre": "Main musical genre (e.g., hip-hop, classic rock, latin rock, salsa, reggaeton, alternative rock, pop, metal, regional mexicano, baladas)",
  "subgenre": "Specific subgenre/era (e.g., 2010s west coast hip-hop, 90s rap, salsa romantica, grunge, rock en español)",
  "vibe": "Brief musical vibe descriptor",
  "topArtistSongs": ["List 8 to 12 iconic hit songs by this EXACT artist"],
  "coherentRelatedArtists": ["List 8 to 10 closely related artists of the EXACT SAME genre, era, and style that sound great together without jarring transitions"],
  "coherentSearchTerms": ["List 4 targeted search terms for YouTube playlists of this exact vibe"]
}`;

      const geminiPromise = ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.2
        }
      });

      const response = await Promise.race([
        geminiPromise,
        new Promise<any>((_, reject) => setTimeout(() => reject(new Error('Gemini timeout')), 1200))
      ]);

      const responseText = response.text?.trim();
      if (responseText) {
        const parsed = JSON.parse(responseText);
        if (parsed.requestedArtist && Array.isArray(parsed.coherentRelatedArtists)) {
          const context: MusicalContext = {
            requestedArtist: parsed.requestedArtist || rawQuery,
            requestedSong: parsed.requestedSong || null,
            primaryGenre: parsed.primaryGenre || 'pop',
            subgenre: parsed.subgenre || 'general',
            vibe: parsed.vibe || 'music',
            topArtistSongs: Array.isArray(parsed.topArtistSongs) && parsed.topArtistSongs.length > 0
              ? parsed.topArtistSongs
              : [],
            coherentRelatedArtists: parsed.coherentRelatedArtists.filter(Boolean),
            coherentSearchTerms: Array.isArray(parsed.coherentSearchTerms) && parsed.coherentSearchTerms.length > 0
              ? parsed.coherentSearchTerms
              : [`${parsed.requestedArtist} greatest hits playlist`, `${parsed.primaryGenre} best hits`]
          };

          contextCache.set(cleanKey, context);
          return context;
        }
      }
    } catch {
      // Continuar con fallback genérico inmediato
    }
  }

  // 3. Fallback genérico ultrarrápido
  const context: MusicalContext = {
    requestedArtist: rawQuery,
    requestedSong: null,
    primaryGenre: 'pop',
    subgenre: 'general music',
    vibe: 'popular music',
    topArtistSongs: [],
    coherentRelatedArtists: [],
    coherentSearchTerms: [`${rawQuery} greatest hits playlist`, `${rawQuery} official music video`]
  };
  contextCache.set(cleanKey, context);
  return context;
}

// ============================================================================
// 3. FILTRO ESTRICTO DE COHERENCIA DE GÉNERO
// ============================================================================

/**
 * Evalúa si una pista obtenida de YouTube encaja coherentemente en el contexto musical activo,
 * descartando tajantemente videos que pertenezcan a géneros incompatibles o listas de reproducción fuera de lugar.
 */
export function isTrackGenreCoherent(
  track: CatalogTrack,
  context: MusicalContext
): boolean {
  if (!track || !track.title) return false;

  const trackTitleNorm = normalizeKey(track.title);
  const trackArtistNorm = normalizeKey(track.artist || '');
  const reqArtistNorm = normalizeKey(context.requestedArtist);

  // 1. Si el track es del mismo artista solicitado, es 100% coherente
  if (reqArtistNorm && (trackTitleNorm.includes(reqArtistNorm) || trackArtistNorm.includes(reqArtistNorm))) {
    return true;
  }

  // 2. Si el track menciona a cualquiera de los artistas afines coherentes, es 100% coherente
  for (const rel of context.coherentRelatedArtists) {
    const relNorm = normalizeKey(rel);
    if (relNorm.length >= 3 && (trackTitleNorm.includes(relNorm) || trackArtistNorm.includes(relNorm))) {
      return true;
    }
  }

  // 3. Identificar el cluster activo del contexto
  const found = findLocalGenreCluster(context.requestedArtist);
  const activeClusterMatch = found
    ? found.cluster
    : Object.entries(GENRE_CLUSTERS).find(([_, c]) =>
        c.genre.toLowerCase().includes(context.primaryGenre.toLowerCase()) ||
        context.primaryGenre.toLowerCase().includes(c.genre.toLowerCase())
      )?.[1];

  // 4. Si el artista del track pertenece a un cluster en CONFLICTO directo, DESCARTARLO INMEDIATAMENTE
  if (activeClusterMatch) {
    // Verificar palabras prohibidas del cluster
    for (const forbidden of activeClusterMatch.conflictingGenreKeywords) {
      const forbidNorm = normalizeKey(forbidden);
      if (forbidNorm.length >= 4 && (trackTitleNorm.includes(forbidNorm) || trackArtistNorm.includes(forbidNorm))) {
        return false;
      }
    }

    // Verificar si el track coincide con algún artista de clusters incompatibles
    for (const conflictClusterKey of activeClusterMatch.conflictingClusters) {
      const conflictCluster = GENRE_CLUSTERS[conflictClusterKey];
      if (conflictCluster) {
        for (const conflictArtist of conflictCluster.artists) {
          const conflictArtistNorm = normalizeKey(conflictArtist);
          if (conflictArtistNorm.length >= 4 && (trackTitleNorm.includes(conflictArtistNorm) || trackArtistNorm.includes(conflictArtistNorm))) {
            return false;
          }
        }
      }
    }
  }

  // 5. Reglas de protección específicas para géneros populares:
  const genreLower = (context.primaryGenre || '').toLowerCase();

  // HIP-HOP / RAP: NUNCA permitir banda, regional mexicano, baladas en español, salsa, cumbia
  if (genreLower.includes('hip-hop') || genreLower.includes('rap') || genreLower.includes('trap')) {
    // Prohibir artistas de regional mexicano
    for (const artist of GENRE_CLUSTERS.regional_mexicano.artists) {
      const norm = normalizeKey(artist);
      if (trackTitleNorm.includes(norm) || trackArtistNorm.includes(norm)) return false;
    }
    // Prohibir baladas en español
    for (const artist of GENRE_CLUSTERS.baladas_pop_espanol.artists) {
      const norm = normalizeKey(artist);
      if (trackTitleNorm.includes(norm) || trackArtistNorm.includes(norm)) return false;
    }
    // Prohibir palabras clave ajenas
    const forbidden = ['banda', 'mariachi', 'corridos', 'cumbia', 'bachata', 'balada', 'vals', 'ranchera', 'bolero', 'los angeles azules', 'grupo firme', 'banda ms'];
    for (const kw of forbidden) {
      if (trackTitleNorm.includes(kw) || trackArtistNorm.includes(kw)) return false;
    }
  }

  // ROCK / CLASSIC ROCK: NUNCA permitir reggaeton, dembow, banda, corridos
  if (genreLower.includes('rock') || genreLower.includes('metal')) {
    for (const artist of GENRE_CLUSTERS.reggaeton_urban.artists) {
      const norm = normalizeKey(artist);
      if (trackTitleNorm.includes(norm) || trackArtistNorm.includes(norm)) return false;
    }
    for (const artist of GENRE_CLUSTERS.regional_mexicano.artists) {
      const norm = normalizeKey(artist);
      if (trackTitleNorm.includes(norm) || trackArtistNorm.includes(norm)) return false;
    }
    const forbidden = ['reggaeton', 'trap latino', 'banda', 'cumbia', 'bachata', 'dembow', 'perreo', 'corridos'];
    for (const kw of forbidden) {
      if (trackTitleNorm.includes(kw) || trackArtistNorm.includes(kw)) return false;
    }
  }

  // SALSA: NUNCA permitir metal pesado, grindcore, banda, música electrónica pesada
  if (genreLower.includes('salsa')) {
    for (const artist of GENRE_CLUSTERS.metal_hardrock.artists) {
      const norm = normalizeKey(artist);
      if (trackTitleNorm.includes(norm) || trackArtistNorm.includes(norm)) return false;
    }
    const forbidden = ['heavy metal', 'death metal', 'metal', 'hardstyle', 'grunge', 'k-pop', 'banda'];
    for (const kw of forbidden) {
      if (trackTitleNorm.includes(kw) || trackArtistNorm.includes(kw)) return false;
    }
  }

  // REGIONAL MEXICANO: NUNCA permitir death metal, drill rap americano, música clásica
  if (genreLower.includes('regional') || genreLower.includes('banda') || genreLower.includes('norteño') || genreLower.includes('corridos')) {
    const forbidden = ['death metal', 'black metal', 'drill rap', 'dubstep'];
    for (const kw of forbidden) {
      if (trackTitleNorm.includes(kw) || trackArtistNorm.includes(kw)) return false;
    }
  }

  return true;
}
