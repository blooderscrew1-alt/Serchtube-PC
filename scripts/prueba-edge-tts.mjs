/**
 * Prueba del protocolo de voces neuronales EN LINEA de Microsoft Edge
 * ("Leer en voz alta"). Servicio no documentado: sirve para comprobar que
 * responde y que el audio llega bien antes de integrarlo en el servidor.
 *
 * Uso: node scripts/prueba-edge-tts.mjs [salida.mp3] [voz]
 */
import { createHash, randomUUID } from 'crypto';
import { writeFileSync } from 'fs';
import { WebSocket } from 'ws';

const TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
// Version de Edge que se declara (debe ser reciente; edge-tts usa la ultima)
const CHROMIUM_FULL_VERSION = '143.0.3650.75';
const CHROMIUM_MAJOR = CHROMIUM_FULL_VERSION.split('.')[0];
const GEC_VERSION = `1-${CHROMIUM_FULL_VERSION}`;
const URL_BASE = 'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1';

const salida = process.argv[2] || 'edge-prueba.mp3';
const voz = process.argv[3] || 'es-MX-JorgeNeural';
const texto = 'Hola, soy la voz neuronal en linea de Microsoft Edge. Esta es una prueba del asistente.';

function secMsGec() {
  const WIN_EPOCH = 11644473600;
  let ticks = Date.now() / 1000 + WIN_EPOCH;
  ticks -= ticks % 300;
  return createHash('sha256').update(`${Math.floor(ticks * 1e7)}${TOKEN}`, 'ascii').digest('hex').toUpperCase();
}

const url = `${URL_BASE}?TrustedClientToken=${TOKEN}&Sec-MS-GEC=${secMsGec()}&Sec-MS-GEC-Version=${GEC_VERSION}&ConnectionId=${randomUUID()}`;
console.log('conectando a Microsoft...');
const ws = new WebSocket(url, {
  headers: {
    Pragma: 'no-cache',
    'Cache-Control': 'no-cache',
    Origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
    'Sec-WebSocket-Version': '13',
    'Accept-Encoding': 'gzip, deflate, br, zstd',
    'Accept-Language': 'en-US,en;q=0.9',
    'User-Agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROMIUM_MAJOR}.0.0.0 Safari/537.36 Edg/${CHROMIUM_MAJOR}.0.0.0`
  }
});

const trozos = [];
const t0 = Date.now();
const idioma = (voz.match(/^[a-z]{2}-[A-Z]{2}/) || ['es-MX'])[0];
let listo = false;

const fin = () => { try { ws.close(); } catch {} };
const timeout = setTimeout(() => { console.log('FALLO: sin respuesta en 15 s'); listo = true; fin(); process.exit(1); }, 15000);

ws.on('open', () => {
  console.log('conectado; enviando configuracion y SSML');
  ws.send(`X-Timestamp:${new Date().toString()}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}`);
  const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${idioma}'><voice name='${voz}'><prosody pitch='+0Hz' rate='+0%' volume='+0%'>${texto}</prosody></voice></speak>`;
  ws.send(`X-RequestId:${randomUUID().replace(/-/g, '')}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${new Date().toString()}Z\r\nPath:ssml\r\n\r\n${ssml}`);
});

ws.on('message', (data, esBinario) => {
  if (esBinario) {
    const buf = Buffer.from(data);
    const largoCabecera = buf.readUInt16BE(0);
    trozos.push(buf.subarray(2 + largoCabecera));
  } else {
    const txt = data.toString();
    if (txt.includes('Path:turn.end')) {
      clearTimeout(timeout);
      const audio = Buffer.concat(trozos);
      if (audio.length < 200) { console.log('FALLO: audio vacio'); listo = true; fin(); process.exit(1); }
      writeFileSync(salida, audio);
      console.log(`OK: ${audio.length} bytes (${(audio.length / 1024).toFixed(1)} KB) en ${Date.now() - t0} ms -> ${salida}`);
      listo = true;
      fin();
      process.exit(0);
    }
  }
});

ws.on('error', (e) => { clearTimeout(timeout); console.log('FALLO (error):', e?.message); process.exit(1); });
ws.on('close', (code) => { clearTimeout(timeout); if (!listo) { console.log(`FALLO: cerro sin audio (codigo ${code})`); process.exit(1); } });
