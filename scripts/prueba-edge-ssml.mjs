/**
 * Comprueba que SSML acepta realmente el servicio de "Leer en voz alta" de Edge:
 * pausas, énfasis, prosodia y estilos emocionales (mstts:express-as).
 *
 * Compara el tamaño del audio y si la peticion falla, para saber que se puede
 * implementar de verdad y que no.
 *
 * Uso: node scripts/prueba-edge-ssml.mjs [voz]
 */
import { createHash, randomUUID } from 'crypto';
import { WebSocket } from 'ws';

const TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const VERSION = '143.0.3650.75';
const MAJOR = VERSION.split('.')[0];
const WSS = 'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1';
const voz = process.argv[2] || 'es-MX-DaliaNeural';

function gec() {
  const W = 11644473600;
  let t = Date.now() / 1000 + W;
  t -= t % 300;
  return createHash('sha256').update(`${Math.floor(t * 1e7)}${TOKEN}`, 'ascii').digest('hex').toUpperCase();
}

function sintetizar(cuerpoInterno, etiqueta) {
  const idioma = (voz.match(/^[a-z]{2}-[A-Z]{2}/) || ['es-MX'])[0];
  // Caso especial: el estilo declarado en <speak> con el espacio de nombres mstts
  const esEstiloEnSpeak = typeof cuerpoInterno === 'string' && cuerpoInterno.startsWith('__EN_SPEAK__');
  const estilo = esEstiloEnSpeak ? cuerpoInterno.replace('__EN_SPEAK__', '') : '';
  const ssml = esEstiloEnSpeak
    ? `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xmlns:mstts='https://www.w3.org/2001/mstts' xml:lang='${idioma}'>` +
      `<voice name='${voz}'><mstts:express-as style='${estilo}'><prosody rate='+0%' pitch='+0Hz' volume='+0%'>${TEXTO}</prosody></mstts:express-as></voice></speak>`
    : `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${idioma}'>` +
      `<voice name='${voz}'>${cuerpoInterno}</voice></speak>`;
  const url = `${WSS}?TrustedClientToken=${TOKEN}&Sec-MS-GEC=${gec()}&Sec-MS-GEC-Version=1-${VERSION}&ConnectionId=${randomUUID()}`;
  return new Promise((resolve) => {
    const trozos = [];
    let hecho = false;
    const t0 = Date.now();
    const ws = new WebSocket(url, {
      headers: {
        Pragma: 'no-cache', 'Cache-Control': 'no-cache',
        Origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
        'Sec-WebSocket-Version': '13', 'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Accept-Language': 'en-US,en;q=0.9',
        'User-Agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${MAJOR}.0.0.0 Safari/537.36 Edg/${MAJOR}.0.0.0`
      }
    });
    const cerrar = (r) => { if (hecho) return; hecho = true; clearTimeout(t); try { ws.close(); } catch {} resolve(r); };
    const t = setTimeout(() => cerrar({ error: 'sin respuesta' }), 15000);
    ws.on('open', () => {
      const f = new Date().toString();
      ws.send(`X-Timestamp:${f}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n` +
        `{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}`);
      ws.send(`X-RequestId:${randomUUID().replace(/-/g, '')}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${f}Z\r\nPath:ssml\r\n\r\n${ssml}`);
    });
    ws.on('message', (data, bin) => {
      if (bin) {
        const b = Buffer.from(data);
        trozos.push(b.subarray(2 + b.readUInt16BE(0)));
      } else {
        const s = data.toString();
        if (s.includes('Path:turn.end')) {
          const audio = Buffer.concat(trozos);
          cerrar({ bytes: audio.length, ms: Date.now() - t0 });
        } else if (/error/i.test(s) && s.includes('Path:response')) {
          // El servicio avisa de SSML invalido por aqui
          const m = s.match(/"errorCode"\s*:\s*"?([^",}]+)"?/i);
          if (m) cerrar({ error: m[1] });
        }
      }
    });
    ws.on('error', (e) => cerrar({ error: e?.message }));
    ws.on('close', () => cerrar({ error: 'cerro sin audio' }));
  });
}

const TEXTO = 'Hola, esto es una prueba de expresiones. Segunda frase para comparar.';
const casos = [
  ['sin etiquetas', `<prosody rate='+0%' pitch='+0Hz' volume='+0%'>${TEXTO}</prosody>`],
  ['break fuera de prosody', `<prosody rate='+0%' pitch='+0Hz' volume='+0%'>Hola, esto es una prueba.</prosody><break time='800ms'/><prosody rate='+0%' pitch='+0Hz' volume='+0%'>Segunda frase.</prosody>`],
  ['break con espacio', `<prosody rate='+0%' pitch='+0Hz' volume='+0%'>Hola, esto es una prueba. <break time='800ms' /> Segunda frase.</prosody>`],
  ['break strength', `<prosody rate='+0%' pitch='+0Hz' volume='+0%'>Hola, esto es una prueba. <break strength='x-strong'/> Segunda frase.</prosody>`],
  ['prosody anidado (enfasis)', `<prosody rate='+0%' pitch='+0Hz' volume='+0%'>Hola, esto es <prosody volume='+30%' pitch='+8Hz'>una prueba</prosody> de expresiones. Segunda frase.</prosody>`],
  ['prosody hermanos (2 segmentos)', `<prosody rate='+0%' pitch='+0Hz' volume='+0%'>Hola, esto es una prueba.</prosody><prosody rate='-20%' pitch='-10Hz' volume='-30%'>Segunda frase, mas lenta y suave.</prosody>`],
  ['ellipsis (pausa real?)', `<prosody rate='+0%' pitch='+0Hz' volume='+0%'>Hola, esto es una prueba ... segunda frase para comparar.</prosody>`],
  ['estilo en speak: whispering', `__EN_SPEAK__whispering`],
  ['estilo en speak: angry', `__EN_SPEAK__angry`],
  ['estilo en speak: cheerful', `__EN_SPEAK__cheerful`],
  ['estilo en speak: sad', `__EN_SPEAK__sad`],
  ['estilo en speak: terrified', `__EN_SPEAK__terrified`],
];

console.log(`voz: ${voz}\n`);
for (const [etiqueta, cuerpo] of casos) {
  const r = await sintetizar(cuerpo, etiqueta);
  const estado = r.error ? `ERROR -> ${r.error}` : `OK  ${String(r.bytes).padStart(6)} bytes  ${String(r.ms).padStart(5)} ms`;
  console.log(`  ${etiqueta.padEnd(24)} ${estado}`);
}
