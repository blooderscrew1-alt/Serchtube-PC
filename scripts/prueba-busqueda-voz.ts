/**
 * PRUEBAS DE REGRESIÓN — Búsqueda musical por voz (SerchTube Music)
 * ================================================================
 *
 * Cubre los casos pedidos sin depender de la red:
 *   · título y artista reconocidos correctamente
 *   · título con errores fonéticos / pronunciación española de títulos ingleses
 *   · artistas extranjeros dichos en español
 *   · dos canciones con títulos similares (no confundirlas)
 *   · música de un artista sin especificar canción
 *   · remix / versión en vivo
 *   · pedir una canción por un fragmento de la letra
 *   · reconocimiento incompleto
 *   · comandos de voz que NO deben interpretarse como búsquedas
 *
 * Uso: npm run prueba-voz     (o: npx tsx scripts/prueba-busqueda-voz.ts)
 */
import {
  analizarPeticionVoz,
  esPeticionMusical,
  generarVariantesConsulta,
  similitudFonetica,
  similitudTexto,
  normalizarBase,
  claveFonetica,
  bonificacionContexto
} from '../voiceQueryEngine.ts';

let pasadas = 0;
let falladas = 0;
const fallos: string[] = [];

function comprobar(nombre: string, condicion: boolean, detalle?: string) {
  if (condicion) {
    pasadas++;
    console.log(`  ✅ ${nombre}`);
  } else {
    falladas++;
    fallos.push(nombre);
    console.log(`  ❌ ${nombre}${detalle ? ` -> ${detalle}` : ''}`);
  }
}

function seccion(t: string) { console.log(`\n=== ${t} ===`); }

// ───────────────────────── 1. Análisis de intención
seccion('1. Interpretación de la petición (título / artista / intención)');

const casosCancion: Array<[string, string, string]> = [
  ['pon careless whisper de george michael', 'careless whisper', 'george michael'],
  ['pon sweet child o mine de guns n roses', 'sweet child o mine', 'guns n roses'],
  ['pon i will always love you de whitney houston', 'i will always love you', 'whitney houston'],
  ['pon another one bites the dust de queen', 'another one bites the dust', 'queen'],
  ['pon billie jean de michael jackson', 'billie jean', 'michael jackson'],
  ['pon the ringer de eminem', 'the ringer', 'eminem'],
  ['reproduce bonnie and clyde de eminem', 'bonnie and clyde', 'eminem'],
  ['quiero escuchar bohemian rhapsody de queen', 'bohemian rhapsody', 'queen'],
  ['pon la cancion de volver volver de vicente fernandez', 'volver volver', 'vicente fernandez']
];
for (const [frase, titulo, artista] of casosCancion) {
  const p = analizarPeticionVoz(frase);
  comprobar(`"${frase}"`, p.tipo === 'cancion' && p.titulo === titulo && p.artista === artista,
    `tipo=${p.tipo} titulo="${p.titulo}" artista="${p.artista}"`);
}

// ───────────────────────── 2. Comandos de control que NO son búsquedas
seccion('2. Comandos que NO deben buscarse como canciones');
for (const frase of ['pausa', 'pausar la musica', 'siguiente', 'siguiente cancion', 'sube el volumen', 'baja el volumen', 'silencia', 'detener', 'reanuda', 'apaga la pc']) {
  comprobar(`"${frase}" no es petición musical`, esPeticionMusical(frase) === false);
}
comprobar('"pon billie jean" sí es petición musical', esPeticionMusical('pon billie jean') === true);

// ───────────────────────── 3. Artista sin canción / éxitos / género
seccion('3. Música de un artista, éxitos, géneros y playlists');
const casosTipo: Array<[string, string]> = [
  ['pon musica de queen', 'artista'],
  ['pon los exitos de queen', 'exitos'],
  ['pon musica de cumbia', 'genero'],
  ['pon una playlist de rock', 'playlist'],
  ['pon una mezcla de salsa', 'mezcla']
];
for (const [frase, tipo] of casosTipo) {
  const p = analizarPeticionVoz(frase);
  comprobar(`"${frase}" -> tipo=${tipo}`, p.tipo === tipo, `detectado=${p.tipo}`);
}
comprobar('"pon musica de cumbia" detecta el género', analizarPeticionVoz('pon musica de cumbia').genero === 'cumbia');
comprobar('"pon musica de queen" NO queda como canción', analizarPeticionVoz('pon musica de queen').tipo !== 'cancion');

// ───────────────────────── 4. Variantes pedidas
seccion('4. Variantes pedidas explícitamente (remix / en vivo / instrumental)');
comprobar('remix detectado', analizarPeticionVoz('pon el remix de billie jean').variante === 'remix');
comprobar('en vivo detectado', analizarPeticionVoz('pon billie jean en vivo').variante === 'en_vivo');
comprobar('instrumental detectado', analizarPeticionVoz('pon billie jean instrumental').variante === 'instrumental');
comprobar('sin variante -> null', analizarPeticionVoz('pon billie jean de michael jackson').variante === null);

// ───────────────────────── 5. Fragmento de letra
seccion('5. Petición por fragmento de la letra');
const casosLetra: Array<[string, string]> = [
  ['pon la cancion que dice hello from the other side', 'hello from the other side'],
  ['busca la cancion que dice we dont need no education', 'we dont need no education'],
  ['pon la que dice is this the real life is this just fantasy', 'is this the real life is this just fantasy']
];
for (const [frase, fragmento] of casosLetra) {
  const p = analizarPeticionVoz(frase);
  comprobar(`"${frase}" -> fragmento`, p.tipo === 'fragmento_letra' && p.fragmentoLetra === fragmento,
    `tipo=${p.tipo} fragmento="${p.fragmentoLetra}"`);
}
const variantesLetra = generarVariantesConsulta(analizarPeticionVoz('pon la cancion que dice hello from the other side'), 4);
comprobar('la búsqueda por letra usa el fragmento',
  variantesLetra.some(v => normalizarBase(v.texto).includes('hello from the other side')));

// ───────────────────────── 6. Fonética español <-> inglés
seccion('6. Tolerancia fonética (títulos ingleses dichos en español)');
const paresFoneticos: Array<[string, string, number]> = [
  ['jalo', 'hello', 0.6],
  ['yimi hendrix', 'jimi hendrix', 0.7],
  ['mai guerl', 'my girl', 0.7],
  ['bilin yean', 'billie jean', 0.6],
  ['kuin', 'queen', 0.6],
  ['eminen', 'eminem', 0.7],
  ['suit chaild of main', 'sweet child o mine', 0.6]
];
for (const [dicho, real, minimo] of paresFoneticos) {
  const s = similitudFonetica(dicho, real);
  comprobar(`fonética "${dicho}" ~ "${real}" >= ${minimo}`, s >= minimo, `similitud=${s.toFixed(2)}`);
}
comprobar('el texto idéntico da similitud 1', similitudTexto('Billie Jean', 'billie jean') === 1);
comprobar('normalizar conserva palabras', normalizarBase('  Sweet Child O\' Mine (Remastered)  ') === 'sweet child o mine remastered');
comprobar('clave fonética unifica v/b', claveFonetica('victor') === claveFonetica('bictor'));
comprobar('clave fonética unifica j/h', claveFonetica('jalo') === claveFonetica('halo'));

// ───────────────────────── 7. Variantes de consulta
seccion('7. Generación de variantes (limitadas, sin redundancias)');
const peticionFonetica = analizarPeticionVoz('pon jalo de adele');
const vFon = generarVariantesConsulta(peticionFonetica, 4);
comprobar('se conserva la petición original como primera variante',
  normalizarBase(vFon[0].texto) === normalizarBase(peticionFonetica.limpia), `primera="${vFon[0].texto}"`);
comprobar('se generan variantes fonéticas', vFon.some(v => v.origen.startsWith('fonetica:')),
  `variantes=${JSON.stringify(vFon.map(v => v.texto))}`);
comprobar('no se superan las 4 variantes', vFon.length <= 4, `total=${vFon.length}`);
comprobar('sin variantes duplicadas',
  new Set(vFon.map(v => normalizarBase(v.texto))).size === vFon.length);
const peticionInvertida = analizarPeticionVoz('pon careless whisper de george michael');
comprobar('se propone la recombinación artista+título',
  generarVariantesConsulta(peticionInvertida, 4).some(v => /george michael/i.test(v.texto) && /careless whisper/i.test(v.texto)));

// ───────────────────────── 8. Puntuación: dos canciones parecidas y artista correcto
seccion('8. Selección del resultado correcto (no confundir título con artista)');
const peticion = analizarPeticionVoz('pon careless whisper de george michael');
const contexto = { intent: peticion, consultaOriginal: peticion.original };

const candidatoCorrecto = {
  id: 'a', title: 'George Michael - Careless Whisper (Official Video)', artist: 'George Michael', duration: '5:02', thumbnail: ''
};
const candidatoRemix = {
  id: 'b', title: 'Careless Whisper (Remix 2024)', artist: 'DJ Random', duration: '6:10', thumbnail: ''
};
const candidatoOtro = {
  id: 'c', title: 'Careless Whisper Karaoke Version', artist: 'Karaoke Hits', duration: '5:00', thumbnail: ''
};
const candidatoAjeno = {
  id: 'd', title: 'Whisper Something Careless', artist: 'Otra Banda', duration: '4:00', thumbnail: ''
};

const punt = (c: any) => bonificacionContexto(c, contexto).puntos;
comprobar('el oficial correcto puntúa más que el remix no pedido', punt(candidatoCorrecto) > punt(candidatoRemix),
  `${punt(candidatoCorrecto)} vs ${punt(candidatoRemix)}`);
comprobar('el oficial correcto puntúa más que el karaoke', punt(candidatoCorrecto) > punt(candidatoOtro),
  `${punt(candidatoCorrecto)} vs ${punt(candidatoOtro)}`);
comprobar('el oficial correcto puntúa más que una canción ajena', punt(candidatoCorrecto) > punt(candidatoAjeno),
  `${punt(candidatoCorrecto)} vs ${punt(candidatoAjeno)}`);

// Con variante pedida, el remix debe ganar
const peticionRemix = analizarPeticionVoz('pon el remix de careless whisper de george michael');
const ctxRemix = { intent: peticionRemix, consultaOriginal: peticionRemix.original };
comprobar('si se pide remix, el remix puntúa más que el oficial',
  bonificacionContexto(candidatoRemix, ctxRemix).puntos > bonificacionContexto(candidatoCorrecto, ctxRemix).puntos,
  `${bonificacionContexto(candidatoRemix, ctxRemix).puntos} vs ${bonificacionContexto(candidatoCorrecto, ctxRemix).puntos}`);

// Género: la recopilación sí es lo deseado
const petGenero = analizarPeticionVoz('pon musica de cumbia');
const ctxGenero = { intent: petGenero, consultaOriginal: petGenero.original };
const mixCumbia = { id: 'e', title: 'Cumbias Mix Exitos 2024', artist: 'Cumbia Mix', duration: '58:00', thumbnail: '' };
const cancionSuelta = { id: 'f', title: 'Sopa de Caracol', artist: 'Banda Blanca', duration: '4:00', thumbnail: '' };
comprobar('con género pedido, la recopilación puntúa mejor que un tema suelto',
  bonificacionContexto(mixCumbia, ctxGenero).puntos > bonificacionContexto(cancionSuelta, ctxGenero).puntos,
  `${bonificacionContexto(mixCumbia, ctxGenero).puntos} vs ${bonificacionContexto(cancionSuelta, ctxGenero).puntos}`);

// ───────────────────────── 9. Reconocimiento incompleto
seccion('9. Reconocimiento incompleto o confuso');
const incompleta = analizarPeticionVoz('pon la cancion de');
comprobar('una petición vacía no inventa título', !incompleta.titulo || incompleta.titulo.length === 0,
  `titulo="${incompleta.titulo}"`);
const muyCorta = analizarPeticionVoz('pon ai');
comprobar('petición muy corta se analiza sin romper', typeof muyCorta.limpia === 'string');
const ruido = analizarPeticionVoz('y entonces bueno pues este');
comprobar('frase de relleno no genera artista ni género falsos', !ruido.artista && !ruido.genero,
  `artista="${ruido.artista}" genero="${ruido.genero}"`);

// ───────────────────────── Resumen
console.log('\n' + '='.repeat(60));
console.log(`PRUEBAS: ${pasadas} correctas, ${falladas} fallidas`);
if (falladas > 0) {
  console.log('Fallos:');
  fallos.forEach(f => console.log('  - ' + f));
}
console.log('='.repeat(60));
process.exit(falladas === 0 ? 0 : 1);
