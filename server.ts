import 'dotenv/config';
import express from "express";
import http from "http";
import path from "path";
import os from "os";
import fs from "fs";
import { createHash, randomUUID } from "crypto";
import { exec } from "child_process";
import { WebSocketServer, WebSocket } from "ws";
import { commandDispatcher, isResumeCommand, ENABLE_SMART_CORRECTION } from "./commandDispatcher.ts";
import {
  searchYouTubeMusic,
  scrapeYouTubeMix,
  scrapeYouTubeVideos,
  cleanSearchQuery,
  areSameSong,
  isCompilationOrMix,
  findCompatibleAlternative,
  type CatalogTrack
} from "./youtubeEngine.ts";
import { resolveMusicalContext, isTrackGenreCoherent } from "./musicContextEngine.ts";
import { searchGoogleForVideo, correctQueryWithGoogle } from "./googleSearchCorrector.ts";

const app = express();
const PORT = 3000;

// Enable CORS for LAN subnet devices, satellite remotes, and cross-origin health discovery
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Origin, Accept");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

// System Shutdown State Tracker
let activeScheduledShutdownTimer: NodeJS.Timeout | null = null;
let scheduledShutdownInfo: {
  active: boolean;
  action: 'shutdown_pc' | 'sleep_pc' | 'stop_music_sleep' | 'lock_pc';
  scheduledTime?: string;
  delaySeconds?: number;
  triggerTimestamp?: number;
  platform: string;
} = {
  active: false,
  action: 'shutdown_pc',
  platform: process.platform
};

// Health check endpoint with CORS and app identity
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    appName: "SerchTube Music",
    app: "SerchTube Music",
    role: "master",
    port: PORT,
    hasGemini: false,
    timestamp: Date.now()
  });
});

// Dedicated Host Discovery Endpoint for Subnet Scanner
app.get("/api/serchtube/discovery", (req, res) => {
  res.json({
    app: "SerchTube Music",
    appName: "SerchTube Music",
    role: "master",
    port: PORT,
    timestamp: Date.now(),
    hostPlatform: process.platform,
    version: "2.5.0"
  });
});

// System Shutdown & Sleep execution endpoint
app.post("/api/system/shutdown", (req, res) => {
  const { action = 'shutdown_pc', delaySeconds = 0, scheduledTime } = req.body;
  const platform = process.platform;

  console.log(`[System /api/system/shutdown] Received request: action=${action}, delay=${delaySeconds}s, scheduledTime=${scheduledTime || 'now'}`);

  if (activeScheduledShutdownTimer) {
    clearTimeout(activeScheduledShutdownTimer);
    activeScheduledShutdownTimer = null;
  }

  const executeOSCommand = () => {
    let cmd = '';

    if (action === 'shutdown_pc') {
      if (platform === 'win32') {
        cmd = `shutdown /s /t ${Math.max(0, delaySeconds)} /c "Apagado programado por SerchTube Music"`;
      } else if (platform === 'linux') {
        cmd = `shutdown -h now || systemctl poweroff || poweroff`;
      } else if (platform === 'darwin') {
        cmd = `osascript -e 'tell app "System Events" to shut down'`;
      }
    } else if (action === 'sleep_pc') {
      if (platform === 'win32') {
        cmd = `powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Application]::SetSuspendState([System.Windows.Forms.PowerState]::Suspend, $false, $false)" || rundll32.exe powrprof.dll,SetSuspendState 0,1,0`;
      } else if (platform === 'linux') {
        cmd = `systemctl suspend`;
      } else if (platform === 'darwin') {
        cmd = `pmset sleepnow || osascript -e 'tell app "System Events" to sleep'`;
      }
    } else if (action === 'lock_pc') {
      if (platform === 'win32') {
        cmd = `rundll32.exe user32.dll,LockWorkStation`;
      } else if (platform === 'linux') {
        cmd = `xdg-screensaver lock || loginctl lock-session`;
      } else if (platform === 'darwin') {
        cmd = `/System/Library/CoreServices/Menu\\ Extras/User.menu/Contents/Resources/CGSession -suspend`;
      }
    }

    if (cmd) {
      console.log(`[System /api/system/shutdown] Executing OS command: "${cmd}" on ${platform}`);
      exec(cmd, (err, stdout, stderr) => {
        if (err) {
          console.warn(`[System /api/system/shutdown] Command execution note (container/restricted): ${err.message}`);
        } else {
          console.log(`[System /api/system/shutdown] Command executed successfully:`, stdout);
        }
      });
    }
  };

  if (delaySeconds > 0) {
    scheduledShutdownInfo = {
      active: true,
      action,
      scheduledTime,
      delaySeconds,
      triggerTimestamp: Date.now() + delaySeconds * 1000,
      platform
    };

    activeScheduledShutdownTimer = setTimeout(() => {
      executeOSCommand();
      scheduledShutdownInfo.active = false;
    }, delaySeconds * 1000);

    return res.json({
      success: true,
      scheduled: true,
      delaySeconds,
      platform,
      message: `Apagado programado en ${delaySeconds} segundos`
    });
  } else {
    scheduledShutdownInfo = {
      active: false,
      action,
      platform
    };
    executeOSCommand();
    return res.json({
      success: true,
      executed: true,
      platform,
      message: `Comando de ${action} enviado al sistema operativo`
    });
  }
});

// System Shutdown Cancel endpoint
app.post("/api/system/cancel-shutdown", (req, res) => {
  const platform = process.platform;
  console.log(`[System /api/system/cancel-shutdown] Cancelling shutdown on ${platform}`);

  if (activeScheduledShutdownTimer) {
    clearTimeout(activeScheduledShutdownTimer);
    activeScheduledShutdownTimer = null;
  }
  scheduledShutdownInfo.active = false;

  let cancelCmd = '';
  if (platform === 'win32') {
    cancelCmd = 'shutdown /a';
  } else if (platform === 'linux') {
    cancelCmd = 'shutdown -c';
  } else if (platform === 'darwin') {
    cancelCmd = 'killall shutdown';
  }

  if (cancelCmd) {
    exec(cancelCmd, (err) => {
      if (err) {
        console.warn(`[System cancel-shutdown] OS cancel note: ${err.message}`);
      }
    });
  }

  res.json({
    success: true,
    message: 'Apagado automático cancelado correctamente'
  });
});

// System Shutdown Status endpoint
app.get("/api/system/shutdown-status", (req, res) => {
  res.json({
    ...scheduledShutdownInfo,
    serverTime: new Date().toISOString(),
    localTime: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  });
});

// Network IP detection endpoint: returns host interfaces and detected client IP
app.get("/api/network/ip", (req, res) => {
  const interfaces = os.networkInterfaces();
  const localIps: { interface: string; ip: string; isLan: boolean }[] = [];

  for (const [name, ifaceList] of Object.entries(interfaces)) {
    if (!ifaceList) continue;
    for (const iface of ifaceList) {
      if (iface.family === 'IPv4' && !iface.internal) {
        const isLan =
          iface.address.startsWith('192.168.') ||
          iface.address.startsWith('10.') ||
          /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(iface.address);
        localIps.push({
          interface: name,
          ip: iface.address,
          isLan
        });
      }
    }
  }

  // Detect caller IP from headers (x-forwarded-for, cf-connecting-ip, socket)
  const forwarded = req.headers['x-forwarded-for'];
  let clientIp = '';
  if (typeof forwarded === 'string') {
    clientIp = forwarded.split(',')[0].trim();
  } else if (req.headers['x-real-ip'] && typeof req.headers['x-real-ip'] === 'string') {
    clientIp = req.headers['x-real-ip'].trim();
  } else if (req.socket?.remoteAddress) {
    clientIp = req.socket.remoteAddress.replace(/^.*:/, '');
  }

  // Find best local candidate (192.168.x.x, 10.x.x.x, etc.)
  const primaryLan = localIps.find(i => i.isLan)?.ip || localIps[0]?.ip || null;

  res.json({
    localIps,
    primaryLan,
    clientIp: clientIp || null,
    port: PORT
  });
});

// Voice Command Interpretation endpoint (Local High-Performance NLP)
app.post("/api/gemini/voice-command", async (req, res) => {
  const { transcript, personality = 'directa', currentTrack, currentVolume } = req.body;

  if (!transcript || typeof transcript !== 'string') {
    return res.status(400).json({ error: "Transcript is required" });
  }

  // Local NLP parsing (100% resilient and instant)
  const localResult = parseVoiceCommandLocally(transcript, personality, currentTrack, currentVolume);
  res.json(localResult);
});

function pickRandomOption<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Fallback local parser with rich dynamic variants tailored for SerchTube Music
function parseVoiceCommandLocally(transcript: string, personality: string, currentTrack?: any, currentVolume?: number): any {
  const text = (transcript || "").trim().toLowerCase();
  const currentTitle = currentTrack?.title || null;

  const getDynamicFeedback = (action: string, params: { target?: string; volume?: number; preset?: string } = {}) => {
    const target = params.target || currentTitle || "tu música";
    const vol = params.volume ?? currentVolume ?? 70;
    const preset = params.preset || "Hi-Fi";

    const feedbackMap: Record<string, Record<string, string[]>> = {
      play: {
        animada: [
          `¡Oído cocina, jefe! ¡Marchando ese temazo de ${target} con todo el sabor!`,
          `¡Uff qué buen gusto tienes! Poniéndote ${target} para reventar los altavoces de pura fiesta.`,
          `¡Vámonos que nos vamos! Dale caña a ${target}, ¡a cantar a grito pelado!`,
          `¡A sus órdenes, mi comandante del ritmo! Desplegando ${target} para alegrarte el día.`,
          `¡Temazo legendario a la vista! Poniendo ${target} con toda la buena vibra.`,
          `¡Marchando esa joya: ${target}! Si te sabes la letra, ¡te toca cantarla entera!`,
          `¡Eso sí que es música con ritmo y salero! Sonando fuerte ${target}.`,
          `¡Petición concedida con una sonrisa! A disfrutar al máximo de ${target}.`,
          `¡Suelten los decibelios, que aquí llega ${target} para poner esto en órbita!`,
          `¡Dale volumen y pásala en grande! Arrancando con ${target}.`,
          `¡Preparando los tímpanos para una dosis de felicidad pura con ${target}!`,
          `¡Así se viaja con estilo! Disfruta a todo pulmón de ${target}.`,
          `¡Alegría pura para el cuerpo! Poniéndote ${target} ahora mismo.`,
          `¡Qué gran elección! Aquí tienes ${target} para ponerle fiesta al momento.`
        ],
        directa: [
          `¡Oído! Marchando ${target} con toda la energía.`,
          `¡Reproduciendo ${target}! A darle ritmo.`,
          `¡Temazo listo! Sonando ${target} en altavoces.`,
          `¡En marcha con ${target}!`,
          `¡Petición en marcha: ${target}!`,
          `¡Marchando la petición: ${target}!`,
          `¡Iniciando ${target} en altavoces con fuerza!`,
          `¡Sonando ${target} para ti!`
        ],
        formal: [
          `Con el mayor de los gustos, iniciando la reproducción de ${target}.`,
          `Atendiendo su excelente solicitud: deleitándonos con ${target}.`,
          `Procesando su indicación: reproduciendo ${target}. Que disfrute la audición.`,
          `En seguida pongo ${target} para usted con el mejor de los ánimos.`,
          `Sintonizando la magnífica pista ${target} en el sistema.`
        ],
        zen: [
          `Sintonizando ${target} en suave y hermosa armonía...`,
          `Dejando fluir ${target} para ti con serenidad.`,
          `Disfruta de ${target} en completa calma y paz.`,
          `Armonizando el ambiente con la bella melodía ${target}.`,
          `Paz, buena energía y sonido al escuchar ${target}.`
        ],
        conductor: [
          `¡Ruta despejada y temazo en marcha! Reproduciendo ${target}.`,
          `¡Atendiendo petición en carretera! ${target} en altavoces.`,
          `¡Música al volante con buena vibra! Sonando ${target}.`,
          `¡En marcha con ${target} para devorar kilómetros!`,
          `¡Audio confirmado en conducción: disfrutando de ${target}!`
        ],
        jarvis: [
          `Petición registrada: ${target}. Nivel de entusiasmo acústico al 100%.`,
          `Analizando espectro sonoro para ${target}. Desplegando en altavoces, señor.`,
          `Cargando registro ${target} en el núcleo de audio. Que disfrute la sesión.`,
          `Frecuencia óptima sintonizada para ${target}. Decibelios en línea.`
        ],
        copiloto_rally: [
          `¡Acelerador a fondo, metiendo primera con el temazo ${target}!`,
          `¡Atención en cabina, lanzado el pepinazo musical ${target}!`,
          `¡Gas a fondo y que retumbe ${target}!`,
          `¡Siguiente curva con todo el ritmo de ${target}!`,
          `¡Tramo cronometrado con ${target} a tope de vueltas!`
        ],
        locutor_fm: [
          `¡Y para todos los oyentes de la buena música, aquí suena ${target}!`,
          `¡Lo pediste y aquí lo tienes en riguroso directo: ${target}!`,
          `¡Llega con toda la potencia de las ondas a SerchTube: ${target}!`,
          `¡Suban esos decibelios que arranca el exitazo ${target}!`,
          `¡Atención en cabina, sonando fuerte y claro ${target}!`
        ],
        calida: [
          `¡Qué excelente elección! Disfruta muchísimo de ${target}.`,
          `Poniendo ${target} con todo el cariño y la mejor sonrisa para ti.`,
          `Marchando ${target} para acompañarte en este gran momento.`,
          `¡Me fascina esta canción! Aquí tienes ${target} para alegrarte el día.`,
          `¡Listísimo! A disfrutar de ${target} con todo el corazón.`
        ],
        cyberpunk: [
          `Paquete sonoro ${target} inyectado al bus de audio a máxima potencia.`,
          `Sincronizando bus neural para la pista ${target}. Frecuencia lista.`,
          `Ejecutando rutina de audio en alta fidelidad: ${target}.`,
          `Señal de sintetizadores y neón establecida: ${target}.`
        ]
      },
      pause: {
        animada: [
          `¡Pausa al canto! Respira hondo que enseguida volvemos a la carga.`,
          `¡Frenazo musical! Aquí te guardo el sitio, avisa cuando quieras marcha.`,
          `¡Música congelada! No te vayas lejos, que la fiesta sigue cuando digas.`,
          `¡Pausa técnica de campeonato! Descanso merecido para los tímpanos.`,
          `¡Silenciador al canto! Quédate tranquilo que aquí te espero listo para continuar.`,
          `¡Paramos un segundito! Aprovecha para tomar aire o saludar al copiloto.`
        ],
        directa: [
          `¡Pausado! Música en espera.`,
          `Pausa lista, aquí te espero.`,
          `Reproducción en pausa. Dejamos en reposo ${target}.`,
          `¡Pausado al instante!`
        ],
        formal: [
          `He pausado la reproducción de ${target} para usted.`,
          `Audio en pausa respetando su indicación.`,
          `Suspendiendo la reproducción momentáneamente. Aquí le espero.`
        ],
        zen: [
          `Música ${target} en sereno y tranquilo reposo...`,
          `Silencio armónico en curso. Respira con calma.`,
          `Un respiro de tranquilidad para renovar la mente.`
        ],
        conductor: [
          `Pausado en carretera sin distracciones.`,
          `${target} en pausa al volante. Ojos al frente.`,
          `Deteniendo reproducción en ruta para mayor comodidad.`
        ],
        jarvis: [
          `Protocolo de audio en pausa para ${target}, señor.`,
          `Pausando flujo sonoro. Esperando su confirmación para reactivar.`,
          `Estado de reproducción: temporalmente suspendido.`
        ],
        copiloto_rally: [
          `¡Freno de mano puesto! Pausando ${target}.`,
          `¡Entrando a boxes! Música en pausa en cabina.`,
          `¡Parada técnica de audio en plena curva!`
        ],
        locutor_fm: [
          `¡Hacemos una breve pausa publicitaria imaginaria con ${target}!`,
          `¡Pausa en las ondas de SerchTube! No cambies de dial que volvemos ya.`,
          `Deteniendo la emisión un segundo, ¡enseguida volvemos al aire!`
        ],
        calida: [
          `Pausando ${target} con mucho gusto, aquí te espero cuando quieras continuar.`,
          `Pausado para ti, tómate todo el tiempo que necesites.`,
          `Música en pausa con una sonrisa, lista para cuando regreses.`
        ],
        cyberpunk: [
          `Flujo de datos pausado para ${target}.`,
          `Proceso de sonido retenido en el buffer de red.`,
          `Señal en standby esperando reactivación.`
        ]
      },
      resume: {
        animada: [
          `¡Se acabó la espera, vuelve el fiestón! ¡A romper la pista!`,
          `¡De nuevo a la carga! ¡Que no decaiga ese ánimo nunca!`,
          `¡Reanudando el ritmo! ¡A gozarla como se merece!`,
          `¡Volvemos con las pilas recargadas! Dale gas a la música.`,
          `¡Continuamos el viaje musical con toda la energía del mundo!`,
          `¡Vuelve la alegría a los altavoces! ¡Que siga la marcha!`
        ],
        directa: [
          `¡Reanudando ${target} con energía!`,
          `¡Continuando con la música!`,
          `¡De vuelta con ${target} a todo ritmo!`,
          `¡Música en marcha otra vez!`
        ],
        formal: [
          `Reanudando la reproducción de ${target} con el mayor placer.`,
          `Continuando con su selecta lista de reproducción.`,
          `Restaurando la señal de audio para su deleite.`
        ],
        zen: [
          `Fluyendo de nuevo con ${target} en pura armonía.`,
          `Melodía reanudada suavemente en el ambiente.`,
          `Volviendo a la música con paz y alegría.`
        ],
        conductor: [
          `Reanudando ${target} con el copiloto a bordo.`,
          `Música de vuelta en ruta, buen viaje al volante.`,
          `Reanudado en carretera con total seguridad.`
        ],
        jarvis: [
          `Reanudando transmisión de ${target}. Sistemas sonoros al 100%.`,
          `Señal de audio reactivada en la consola, señor.`,
          `Consola de sonido en línea y operando.`
        ],
        copiloto_rally: [
          `¡Bandera verde! ¡Gas a fondo con ${target}!`,
          `¡Aceleramos de nuevo con ${target} en los altavoces!`,
          `¡Reanudamos la carrera musical a toda potencia!`
        ],
        locutor_fm: [
          `¡Regresamos a las ondas con la potencia de ${target}!`,
          `¡Volvemos al ritmo en directo sin parar ni un segundo!`,
          `¡Sintonía de vuelta a toda marcha en SerchTube!`
        ],
        calida: [
          `¡Qué alegría volver a escuchar ${target}!`,
          `Reanudando tu música para alegrarte el día con cariño.`,
          `¡Seguimos escuchando juntos con una sonrisa!`
        ],
        cyberpunk: [
          `Señal de audio reconectada para ${target}.`,
          `Flujo neural activo a máxima frecuencia.`,
          `Transmisión acústica restaurada.`
        ]
      },
      next: {
        animada: [
          `¡Pista despachada! A ver qué joyita te tengo preparada ahora...`,
          `¡Siguiente temazo en camino, agárrate que vienen curvas y mucho ritmo!`,
          `¡Cambiando de tercio! A ver con qué temazo te sorprendo ahora.`,
          `¡Saltando de canción! El que no salte no tiene ritmo, ¡vamos con la siguiente!`,
          `¡Fuera la anterior, bienvenido el siguiente bombazo musical!`,
          `¡Avanzando de pista con alegría y mucho swing!`
        ],
        directa: [
          `¡Pasando al siguiente temazo!`,
          `¡Avanzando de pista con energía!`,
          `¡Siguiente canción en camino!`,
          `¡Pista siguiente lista!`
        ],
        formal: [
          `Avanzando con distinción a la siguiente pista de la lista.`,
          `Cargando la próxima pieza musical para su deleite.`,
          `Pasando a la siguiente composición con gusto.`
        ],
        zen: [
          `Siguiente melodía en el flujo armónico.`,
          `Transición suave hacia la siguiente pista de audio.`,
          `Fluyendo hacia el próximo compás musical.`
        ],
        conductor: [
          `Pasando pista al volante sin distracciones.`,
          `Siguiente canción lista en carretera.`,
          `Avanzando tema con la ruta despejada.`
        ],
        jarvis: [
          `Cargando el siguiente registro del catálogo musical.`,
          `Transicionando a la subsecuente pista de audio, señor.`,
          `Ejecutando secuencia posterior con éxito.`
        ],
        copiloto_rally: [
          `¡Siguiente curva, siguiente temazo a fondo!`,
          `¡Cambio de marcha y nueva pista a toda máquina!`,
          `¡Adelantando a la siguiente pista en carrera!`
        ],
        locutor_fm: [
          `¡Y en la sintonía de SerchTube, damos paso al siguiente bombazo!`,
          `¡Avanzamos con más éxitos en directo para todos ustedes!`,
          `¡Saltamos al siguiente temazo en cabina con toda la vibra!`
        ],
        calida: [
          `Pasando a la siguiente canción con mucho cariño para ti.`,
          `¡A ver qué bonito tema nos toca disfrutar ahora!`,
          `Cambiando a la siguiente melodía para alegrarte el rato.`
        ],
        cyberpunk: [
          `Saltando al siguiente nodo sonoro de la red.`,
          `Cargando nuevo bloque acústico en memoria.`,
          `Pista subsiguiente encolada en el bus.`
        ]
      },
      previous: {
        animada: [
          `¡Rebobinando! Ese tema estaba tan bueno que había que escucharlo otra vez.`,
          `¡Volviendo atrás en el tiempo! Las buenas canciones merecen doble ración.`,
          `¡Marcha atrás concedida! De vuelta a disfrutar ese temazo.`,
          `¡Esa canción merecía una segunda oportunidad! Aquí la tienes de nuevo con alegría.`
        ],
        directa: [
          `¡Volviendo a la canción anterior!`,
          `¡Retrocediendo pista con energía!`,
          `¡De vuelta al tema anterior!`
        ],
        formal: [
          `Regresando con gusto a la pista anterior.`,
          `Repitiendo la selecta composición previa para usted.`
        ],
        zen: [
          `Retornando con serenidad a la melodía previa.`,
          `Regresando en calma al tema anterior.`
        ],
        conductor: [
          `Retrocediendo pista en carretera con seguridad.`,
          `Canción anterior al volante lista.`
        ],
        jarvis: [
          `Recuperando registro previo del sistema acústico.`,
          `Retornando a la pista anterior, señor.`
        ],
        copiloto_rally: [
          `¡Rebobinando tramo, volvemos al temazo anterior a fondo!`,
          `¡Trazada previa reactivada en los altavoces!`
        ],
        locutor_fm: [
          `¡Volvemos a escuchar ese gran clásico en las ondas!`,
          `¡Retrocedemos un tema para complacer a los oyentes!`
        ],
        calida: [
          `Volviendo a la canción anterior con mucho gusto para ti.`,
          `Regresamos al tema de antes con una sonrisa.`
        ],
        cyberpunk: [
          `Retornando al paquete de datos acústicos previo.`,
          `Restaurando nodo sonoro anterior en la terminal.`
        ]
      },
      volume: {
        animada: [
          `¡Volumen colocado exactamente en nivel ${vol}! ¡Nivel impecable para disfrutar!`,
          `¡Sonido ajustado al nivel ${vol}! Listo para seguir con toda la vibra.`,
          `¡A sus órdenes! Volumen en el ${vol}, ¡a gozarla sin medida!`
        ],
        directa: [
          `¡Volumen en nivel ${vol}!`,
          `¡Nivel de sonido en ${vol}!`,
          `¡Volumen al ${vol}!`
        ],
        formal: [
          `Nivel de volumen ajustado cordialmente al ${vol}.`,
          `Volumen configurado exactamente en el nivel ${vol}.`
        ],
        zen: [
          `Volumen sereno ajustado al armonioso nivel ${vol}.`,
          `Intensidad equilibrada fijada en ${vol}.`
        ],
        conductor: [
          `Volumen en nivel ${vol} al volante sin distracciones.`,
          `Sonido ajustado a ${vol} en ruta despejada.`
        ],
        jarvis: [
          `Amplitud de salida acústica calibrada al nivel ${vol}, señor.`,
          `Parámetro de volumen fijado en ${vol}.`
        ],
        copiloto_rally: [
          `¡Potencia de audio al nivel ${vol} para no perder el ritmo!`,
          `¡Volumen fijado en ${vol} a toda máquina!`
        ],
        locutor_fm: [
          `¡Subimos la potencia de la emisora al nivel ${vol}!`,
          `¡Ajustando el sonido estéreo al nivel ${vol}!`
        ],
        calida: [
          `Ajusté el volumen al nivel ${vol} con mucho cariño para ti.`,
          `Volumen listo en nivel ${vol}, para que lo disfrutes a gusto.`
        ],
        cyberpunk: [
          `Index de salida fijado en ${vol}.`,
          `Ganancia reconfigurada a nivel ${vol} en el bus neural.`
        ]
      },
      eq: {
        animada: [
          `¡Ecualizador en modo ${preset}! ¡Ahora sí que va a retumbar con estilo!`,
          `¡Perfil de sonido ${preset} activado! ¡A gozar de cada nota musical!`,
          `¡Filtros ${preset} listos! Que empiece el festival acústico.`
        ],
        directa: [
          `¡Ecualizador en modo ${preset}!`,
          `¡Perfil de sonido ${preset} activado!`
        ],
        formal: [
          `Configurado con esmero el perfil de ecualización ${preset}.`,
          `Filtros de sonido ajustados con precisión al modo ${preset}.`
        ],
        zen: [
          `Sintonía armónica en modo ${preset} para el alma.`,
          `Sonido equilibrado en ${preset} para una escucha pacífica.`
        ],
        conductor: [
          `Perfil de audio ${preset} activo en carretera.`,
          `Ajuste sonoro ${preset} listo al volante.`
        ],
        jarvis: [
          `DSP reconfigurado al perfil ${preset} con exactitud milimétrica.`,
          `Filtros acústicos alineados en modo ${preset}, señor.`
        ],
        copiloto_rally: [
          `¡Curva de ecualización ${preset} en pista a fondo!`,
          `¡Modo ${preset} retumbando en el chasis del bólido!`
        ],
        locutor_fm: [
          `¡Sonando con todo el estilo y dinamismo de ${preset}!`,
          `¡Ajustamos el ecualizador a modo ${preset} en la mesa de mezclas!`
        ],
        calida: [
          `Puse el ecualizador en modo ${preset} con gusto para ti.`,
          `Sonido listo en perfil ${preset}, ¡espero que te encante cómo suena!`
        ],
        cyberpunk: [
          `Filtro DSP ${preset} cargado en el procesador neural.`,
          `Perfil de señal ${preset} compilado en tiempo real.`
        ]
      },
      screensaver: {
        animada: [
          `¡Activando protector de pantalla para descansar la vista! Que la música siga volando.`,
          `¡Luces fuera, sonido dentro! Modo OLED activo para tu relax visual.`,
          `¡A descansar los ojitos! Aquí te cuido la fiesta mientras disfrutas del reposo.`
        ],
        directa: [
          `¡Activando protector de pantalla!`,
          `¡Modo pantalla OLED activo!`
        ],
        formal: [
          `Iniciando protector de pantalla de descanso para usted.`,
          `Activando modo de reposo visual con cortesía.`
        ],
        zen: [
          `Protector visual zen activado en serena oscuridad.`,
          `Descanso sereno en pantalla mientras la música fluye.`
        ],
        conductor: [
          `Protector de pantalla activado en carretera para evitar reflejos.`,
          `Vista nocturna limpia al volante.`
        ],
        jarvis: [
          `Iniciando protector térmico de pantalla OLED, señor.`,
          `Modo bajo consumo desplegado en el monitor.`
        ],
        copiloto_rally: [
          `¡Modo descanso visual desplegado a toda velocidad!`,
          `¡Luces fuera, protector activo en cabina!`
        ],
        locutor_fm: [
          `¡Entramos en modo protector de pantalla en SerchTube Radio!`,
          `¡Descanso visual en marcha para los oyentes nocturnos!`
        ],
        calida: [
          `Activando el protector para que descanses la vista con tranquilidad.`,
          `Listo, protector puesto con mucho cariño.`
        ],
        cyberpunk: [
          `Capa protectora OLED desplegada en la terminal.`,
          `Modo sigilo visual activado en pantalla.`
        ]
      },
      mute: {
        animada: [
          `¡Modo ninja activado! Calladito me quedo, no digo ni mu.`,
          `¡Mute al canto! Silencio total hasta que me pidas más fiesta.`,
          `¡Audio en mudo! Calladito como estatua de cera.`,
          `¡Silencio sepulcral concedido! Me hago el dormido hasta tu orden.`
        ],
        directa: [
          `¡Audio silenciado!`,
          `¡Modo silencio activo!`
        ],
        formal: [
          `Audio silenciado correctamente a su solicitud.`,
          `Silencio de sistema establecido.`
        ],
        zen: [
          `Paz en silencio absoluto.`,
          `Pausa sonora armónica.`
        ],
        conductor: [
          `Silenciado al volante para máxima concentración.`,
          `Sin audio en ruta.`
        ],
        jarvis: [
          `Silenciamiento maestro activo en la consola central.`,
          `Salida de audio a cero decibelios, señor.`
        ],
        copiloto_rally: [
          `¡Mute activado en cabina!`,
          `¡Silencio en pista!`
        ],
        locutor_fm: [
          `¡Entrando en silencio de radio por un momento!`,
          `¡Mute en cabina de emisión!`
        ],
        calida: [
          `Audio silenciado con gusto, avísame cuando quieras que regrese el sonido.`,
          `Listo, todo en silencio para tu tranquilidad.`
        ],
        cyberpunk: [
          `Canal mutado en la red.`,
          `Cero decibelios en el bus acústico.`
        ]
      },
      unmute: {
        animada: [
          `¡Sonido de vuelta! ¡Se rompió el silencio, que viva la fiesta!`,
          `¡Reactivando altavoces! ¡Que fluya de nuevo la energía y la buena música!`,
          `¡De vuelta al aire! Aquí volvemos con toda la potencia para gozar.`
        ],
        directa: [
          `¡Sonido reactivado con energía!`,
          `¡Audio encendido de nuevo!`
        ],
        formal: [
          `Audio reactivado cordialmente para su disfrute.`,
          `Sonido restaurado en el sistema.`
        ],
        zen: [
          `Sonido de vuelta fluyendo en hermosa armonía.`,
          `Flujo sonoro reactivado con serenidad.`
        ],
        conductor: [
          `Audio reactivado en carretera con buena visibilidad.`,
          `Sonido activo en el habitáculo.`
        ],
        jarvis: [
          `Compuertas de audio reabiertas, señor.`,
          `Señal acústica restaurada al 100%.`
        ],
        copiloto_rally: [
          `¡Sonido de vuelta a tope de decibelios!`,
          `¡Audio activo y marcha metida!`
        ],
        locutor_fm: [
          `¡De vuelta al aire con todo el sonido estéreo!`,
          `¡Reactivando potencia sonora en directo!`
        ],
        calida: [
          `¡Qué bueno tener el sonido de vuelta! A seguir disfrutando.`,
          `¡Sonido restaurado con una gran sonrisa para ti!`
        ],
        cyberpunk: [
          `Transmisión de datos acústicos reanudada.`,
          `Audio online en la matriz.`
        ]
      },
      fullscreen_on: {
        animada: [
          `¡Pantalla completa activada! ¡Todo el espectáculo a pantalla gigante!`,
          `¡A pantalla completa! Que no se escape ningún detalle visual para disfrutarlo.`
        ],
        directa: [
          `¡Pantalla completa activada!`,
          `¡Modo pantalla completa en marcha!`,
          `¡Pantalla completa lista!`
        ],
        formal: [
          `Activando modo de pantalla completa para su mayor confort.`,
          `Pantalla completa configurada con éxito.`
        ],
        zen: [
          `Vista expandida en pantalla completa y serena amplitud.`,
          `Espacio amplio para deleitarse con el sonido.`
        ],
        conductor: [
          `Pantalla completa en marcha al volante con máxima visibilidad.`,
          `Modo completo activo en el salpicadero.`
        ],
        jarvis: [
          `Maximizando interfaz a pantalla completa, señor.`,
          `Resolución extendida desplegada en el monitor.`
        ],
        copiloto_rally: [
          `¡Pantalla completa a fondo en el bólido!`,
          `¡Todo el panel de instrumentos desplegado!`
        ],
        locutor_fm: [
          `¡Expandimos la vista a pantalla completa en SerchTube!`,
          `¡Todo el espectáculo en pantalla completa para los oyentes!`
        ],
        calida: [
          `¡Pantalla completa activada para que lo disfrutes mucho mejor!`,
          `Listo, pantalla completa con mucho gusto para ti.`
        ],
        cyberpunk: [
          `Modo fullscreen renderizado en el mainframe.`,
          `Capa visual expandida a bordes de pantalla.`
        ]
      },
      fullscreen_off: {
        animada: [
          `¡Volvemos a vista compacta! Todo bajo control en la cabina.`,
          `¡Pantalla normal lista para seguir interactuando con alegría!`
        ],
        directa: [
          `¡Saliendo de pantalla completa!`,
          `¡Pantalla estándar restaurada!`,
          `¡Modo normal listo!`
        ],
        formal: [
          `Saliendo del modo de pantalla completa con cortesía.`,
          `Restaurando el tamaño habitual de pantalla.`
        ],
        zen: [
          `Volviendo con tranquilidad a la vista normal.`,
          `Pantalla reducida en calma.`
        ],
        conductor: [
          `Pantalla normal en carretera con control total.`,
          `Modo estándar activo al volante.`
        ],
        jarvis: [
          `Saliendo de pantalla completa, restaurando viewport estándar.`,
          `Resolución base restablecida, señor.`
        ],
        copiloto_rally: [
          `¡Volvemos a vista de cabina estándar!`,
          `¡Pantalla reducida en marcha!`
        ],
        locutor_fm: [
          `¡Volvemos al tamaño normal en las ondas de SerchTube!`,
          `¡Pantalla reducida pero con la misma energía!`
        ],
        calida: [
          `Saliendo de pantalla completa con gusto para ti.`,
          `Listo, pantalla en tamaño normal.`
        ],
        cyberpunk: [
          `Modo fullscreen desactivado en el bus visual.`,
          `Viewport estandarizado en la terminal.`
        ]
      },
      shutdown_scheduled: {
        animada: [
          `¡Oído cocina! Apagado automático programado para las ${params.target || 'la hora indicada'}. ¡A descansar a pierna suelta!`,
          `¡Listo! La PC se apagará automáticamente a las ${params.target || 'la hora fijada'}. ¡Buenas noches por adelantado!`,
          `¡Comando recibido! A las ${params.target || 'la hora indicada'} apagamos todo el equipo. ¡Que sueñes con los angelitos!`
        ],
        directa: [
          `¡Auto-apagado de PC programado para las ${params.target || 'la hora indicada'}!`,
          `¡Apagado automático establecido a las ${params.target || 'la hora fijada'}!`
        ],
        formal: [
          `He programado con éxito el apagado del ordenador para las ${params.target || 'la hora solicitada'}.`,
          `Secuencia de apagado automático agendada para las ${params.target || 'la hora indicada'}.`
        ],
        zen: [
          `Apagado automático programado a las ${params.target || 'la hora indicada'} en completa serenidad.`,
          `El sistema descansará en calma a las ${params.target || 'la hora fijada'}.`
        ],
        conductor: [
          `Apagado automático programado para las ${params.target || 'la hora fijada'}.`,
          `Hora de fin de viaje establecida a las ${params.target || 'la hora indicada'}.`
        ],
        jarvis: [
          `Protocolo de apagado programado para las ${params.target || 'la hora fijada'}. Sistemas en conteo, señor.`,
          `Secuencia de desconexión del host fijada para las ${params.target || 'la hora indicada'}.`
        ],
        copiloto_rally: [
          `¡Apagado automático de motor y cabina a las ${params.target || 'la hora indicada'}!`,
          `¡Parada total del bólido programada para las ${params.target || 'la hora fijada'}!`
        ],
        locutor_fm: [
          `¡Cerramos emisión y apagamos la PC a las ${params.target || 'la hora indicada'}!`,
          `¡Apagado programado en SerchTube Radio para las ${params.target || 'la hora fijada'}!`
        ],
        calida: [
          `Con mucho gusto, he programado el apagado de tu PC para las ${params.target || 'la hora indicada'}. ¡Que descanses de maravilla!`,
          `Listo, la computadora se apagará a las ${params.target || 'la hora fijada'} para que duermas tranquilo.`
        ],
        cyberpunk: [
          `Rutina de shutdown del host programada para las ${params.target || 'la hora indicada'}.`,
          `Contador de desconexión neural fijado a las ${params.target || 'la hora fijada'}.`
        ]
      },
      shutdown_cancelled: {
        animada: [
          `¡Cancelado! Anulamos el apagado automático de la PC. ¡Seguimos con todo el ritmo!`,
          `¡Canceladísimo! La PC se queda encendida para seguir disfrutando.`
        ],
        directa: [
          `¡Apagado automático de PC cancelado!`,
          `¡Orden de apagado anulada!`
        ],
        formal: [
          `El apagado programado de la computadora ha sido cancelado con éxito.`,
          `Orden de desconexión del sistema cancelada.`
        ],
        zen: [
          `Apagado cancelado en serenidad. La música y el sistema continúan.`,
          `Cancelación confirmada con calma.`
        ],
        conductor: [
          `Apagado automático cancelado en ruta.`,
          `Sin apagado programado en el vehículo.`
        ],
        jarvis: [
          `Secuencia de apagado abortada, señor. La consola permanecerá activa.`,
          `Orden de desconexión del host cancelada.`
        ],
        copiloto_rally: [
          `¡Bandera verde! ¡Cancelado el apagado, seguimos a fondo!`,
          `¡Anulado el apagado de la máquina!`
        ],
        locutor_fm: [
          `¡Cancelamos el apagado, seguimos en el aire con SerchTube!`,
          `¡No cerramos emisión, continuamos con la música!`
        ],
        calida: [
          `He cancelado el apagado automático para ti. ¡Aquí seguimos acompañándote!`,
          `Listo, cancelé el apagado con una sonrisa.`
        ],
        cyberpunk: [
          `Comando de shutdown abortado. Mainframe online.`,
          `Rutina de apagado cancelada en el buffer.`
        ]
      },
      shutdown_now: {
        animada: [
          `¡Iniciando apagado de la PC! ¡Hasta mañana y que descanses un montón!`,
          `¡Apagando la computadora ahora mismo! ¡Que pases muy buena noche!`
        ],
        directa: [
          `¡Apagando la PC ahora!`,
          `¡Iniciando secuencia de apagado del equipo!`
        ],
        formal: [
          `Procediendo con el apagado inmediato del ordenador. Que tenga un buen descanso.`,
          `Iniciando apagado del sistema.`
        ],
        zen: [
          `Apagando la PC en suave y completa paz. Buenas noches...`,
          `El sistema descansa en serenidad.`
        ],
        conductor: [
          `Apagando sistemas al finalizar el trayecto.`,
          `Cerrando habitáculo y apagando PC.`
        ],
        jarvis: [
          `Iniciando desconexión completa del host, señor. Hasta pronto.`,
          `Apagando sistemas centrales.`
        ],
        copiloto_rally: [
          `¡Apagando motor y cabina en boxes! ¡Hasta la próxima carrera!`,
          `¡Cierre de etapa, apagando el equipo!`
        ],
        locutor_fm: [
          `¡Despedimos la emisión por hoy! Apagando la PC, ¡hasta la próxima sintonía!`,
          `¡Apagando equipo en cabina de radio!`
        ],
        calida: [
          `Apagando la PC con mucho cariño. ¡Que tengas dulces sueños y descanses mucho!`,
          `Buenas noches, apagando la computadora para ti.`
        ],
        cyberpunk: [
          `Ejecutando poweroff en la matriz. Desconectando interfaz.`,
          `Apagado total de terminal en curso.`
        ]
      }
    };

    const actionMap = feedbackMap[action] || feedbackMap['play'];
    const variants = actionMap[personality] || actionMap['animada'] || actionMap['directa'];
    return pickRandomOption(variants);
  };

  // Auto PC Shutdown: Cancel commands ("cancelar apagado", "no apagues la pc", "anular apagado")
  if (/(?:cancelar|cancela|anular|anula|no\s+apagues|desactivar|desactiva|quitar|quita)\s+(?:el\s+)?(?:auto\s+)?(?:apagado|apagado\s+de\s+la\s+pc|apagado\s+del\s+pc|apagado\s+de\s+la\s+computadora|apagado\s+del\s+ordenador)/i.test(text) ||
      /(?:cancelar|cancela|anular|anula)\s+(?:auto\s+)?(?:apagado)/i.test(text)) {
    return {
      action: 'auto_shutdown_cancel',
      speechFeedback: getDynamicFeedback('shutdown_cancelled')
    };
  }

  // Auto PC Shutdown: Immediate Shutdown ("apagar la pc ya", "apaga el ordenador ahora", "apagar pc")
  if (/^(?:apagar|apaga|apague)\s+(?:la\s+pc|el\s+pc|la\s+computadora|el\s+ordenador|el\s+equipo)\s*(?:ahora|ya|de\s+inmediato)?$/i.test(text) ||
      /(?:apagar|apaga)\s+(?:la\s+pc|el\s+pc|la\s+computadora|el\s+ordenador)\s+(?:ahora|ya|de\s+inmediato)/i.test(text)) {
    return {
      action: 'pc_shutdown_now',
      speechFeedback: getDynamicFeedback('shutdown_now')
    };
  }

  // Auto PC Shutdown: Scheduled Time ("apagar la pc a las 23:30", "auto apagar a las 11", "apagar pc a las 12 de la noche", "programar apagado a las 10")
  if (/(?:apagar|apaga|apagar\s+la\s+pc|apagar\s+el\s+pc|apagar\s+la\s+computadora|apagar\s+el\s+ordenador|auto\s+apagar|programar\s+apagado|autoapagado)\s+(?:a\s+las?|en|para\s+las?)\s+(\d{1,2})(?::(\d{2}))?\s*(?:de\s+la\s+(?:noche|mañana|tarde|madrugada)|am|pm|hrs|horas)?/i.test(text) ||
      /(?:auto\s+)?(?:apagado)\s+(?:a\s+las?|para\s+las?)\s+(\d{1,2})(?::(\d{2}))?/i.test(text)) {
    const timeMatch = text.match(/(?:a\s+las?|para\s+las?)\s+(\d{1,2})(?::(\d{2}))?\s*(?:de\s+la\s+(noche|mañana|tarde|madrugada)|(am|pm))?/i);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1], 10);
      let minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
      const period = (timeMatch[3] || timeMatch[4] || '').toLowerCase();

      if ((period.includes('noche') || period.includes('tarde') || period === 'pm') && hours < 12) {
        hours += 12;
      } else if ((period.includes('madrugada') || period.includes('mañana') || period === 'am') && hours === 12) {
        hours = 0;
      }

      hours = Math.max(0, Math.min(23, hours));
      minutes = Math.max(0, Math.min(59, minutes));

      const targetTimeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      return {
        action: 'auto_shutdown_set',
        targetTime: targetTimeStr,
        speechFeedback: getDynamicFeedback('shutdown_scheduled', { target: targetTimeStr })
      };
    }
  }

  // Auto PC Shutdown: Delay in minutes ("apagar la pc en 30 minutos", "apagar en 1 hora")
  if (/(?:apagar|apaga)\s+(?:la\s+pc|el\s+pc|la\s+computadora|el\s+ordenador)?\s*en\s+(\d+)\s*(?:minutos?|min|horas?|h)/i.test(text)) {
    const delayMatch = text.match(/en\s+(\d+)\s*(minutos?|min|horas?|h)?/i);
    if (delayMatch) {
      let val = parseInt(delayMatch[1], 10);
      const unit = (delayMatch[2] || '').toLowerCase();
      let delayMins = val;
      if (unit.startsWith('h')) {
        delayMins = val * 60;
      }

      const now = new Date();
      now.setMinutes(now.getMinutes() + delayMins);
      const targetTimeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

      return {
        action: 'auto_shutdown_set',
        targetTime: targetTimeStr,
        delayMinutes: delayMins,
        speechFeedback: getDynamicFeedback('shutdown_scheduled', { target: targetTimeStr })
      };
    }
  }

  // Fullscreen commands ("pantalla completa", "fullscreen", "maximizar", "salir de pantalla completa")
  if (/(pantalla completa|fullscreen|pantalla entera|maximizar pantalla)/i.test(text)) {
    if (/(salir|quitar|cerrar|desactivar|minimizar|normal)/i.test(text)) {
      return {
        action: 'fullscreen_off',
        speechFeedback: getDynamicFeedback('fullscreen_off')
      };
    }
    return {
      action: 'fullscreen_on',
      speechFeedback: getDynamicFeedback('fullscreen_on')
    };
  }

  if (/(salir de fullscreen|minimizar pantalla|pantalla normal|restaurar pantalla)/i.test(text)) {
    return {
      action: 'fullscreen_off',
      speechFeedback: getDynamicFeedback('fullscreen_off')
    };
  }

  // Google Home / Smart Home Voice Commands
  // 1. Garage Gate ("abrir el porton", "abre porton", "cerrar porton", "cierra el garaje")
  if (/(?:abrir|abre|subir|sube)\s+(?:el\s+)?(?:port[oó]n|garaje|cochera|puerta\s+del\s+garaje)/i.test(text)) {
    return {
      action: 'smarthome_device',
      deviceId: 'garage_gate',
      state: 'open',
      speechFeedback: '¡Abriendo el portón del garaje!'
    };
  }

  if (/(?:cerrar|cierra|bajar|baja)\s+(?:el\s+)?(?:port[oó]n|garaje|cochera|puerta\s+del\s+garaje)/i.test(text)) {
    return {
      action: 'smarthome_device',
      deviceId: 'garage_gate',
      state: 'close',
      speechFeedback: '¡Cerrando el portón del garaje!'
    };
  }

  // 2. Smart Lights ("encender las luces", "enciende las luces", "apagar las luces", "apaga la luz")
  if (/(?:encender|enciende|prender|prende|activar|activa)\s+(?:las\s+)?luces/i.test(text)) {
    const isGarage = /garaje|cochera/i.test(text);
    return {
      action: 'smarthome_device',
      deviceId: isGarage ? 'garage_lights' : 'living_room_light',
      state: 'turn_on',
      speechFeedback: isGarage ? '¡Luces del garaje encendidas!' : '¡Luces encendidas!'
    };
  }

  if (/(?:apagar|apaga|desactivar|desactiva)\s+(?:las\s+)?luces/i.test(text)) {
    const isGarage = /garaje|cochera/i.test(text);
    return {
      action: 'smarthome_device',
      deviceId: isGarage ? 'garage_lights' : 'living_room_light',
      state: 'turn_off',
      speechFeedback: isGarage ? '¡Luces del garaje apagadas!' : '¡Luces apagadas!'
    };
  }

  // 3. Routines ("llegando a casa", "saliendo de casa", "modo noche", "buenas noches")
  if (/(?:llegando\s+a\s+casa|modo\s+llegada|estoy\s+llegando)/i.test(text)) {
    return {
      action: 'smarthome_routine',
      routineId: 'arriving_home',
      speechFeedback: '¡Modo Llegando a Casa activado! Portón abriéndose y luces de entrada encendidas.'
    };
  }

  if (/(?:saliendo\s+de\s+casa|modo\s+salida|voy\s+a\s+salir|modo\s+viaje)/i.test(text)) {
    return {
      action: 'smarthome_routine',
      routineId: 'leaving_home',
      speechFeedback: '¡Modo Salir de Casa activado! Portón cerrado y luces apagadas. ¡Buen viaje!'
    };
  }

  if (/(?:modo\s+noche|buenas\s+noches|modo\s+dormir)/i.test(text)) {
    return {
      action: 'smarthome_routine',
      routineId: 'night_mode',
      speechFeedback: '¡Modo Buenas Noches activado! Dispositivos apagados y portón asegurado.'
    };
  }

  // Resume / Play (evaluate before pause so despausar/quitar pausa are recognized)
  if (isResumeCommand(text, '')) {
    return {
      action: 'resume',
      speechFeedback: getDynamicFeedback('resume')
    };
  }

  // Detente / Dentente / Pause / Para / Parar / Stop / Alto
  if (/(?:^|\b)(?:detente|dentente|detener|detén|deten|parar|para|párate|parate|stop|alto|pausa|pausar|para la música)(?:\b|$)/i.test(text)) {
    return {
      action: 'pause',
      speechFeedback: getDynamicFeedback('pause')
    };
  }

  // Next track
  if (/(siguiente|pasa|siguiente canción|pasa de canción|next|adelanta)/i.test(text)) {
    return {
      action: 'next',
      speechFeedback: getDynamicFeedback('next')
    };
  }

  // Previous track
  if (/(anterior|canción anterior|atrás|regresa|previous)/i.test(text)) {
    return {
      action: 'previous',
      speechFeedback: getDynamicFeedback('previous')
    };
  }

  // Repeat
  if (/(repite|repetir|otra vez|de nuevo|bucle)/i.test(text)) {
    return {
      action: 'repeat',
      speechFeedback: getDynamicFeedback('resume')
    };
  }

  // Mute / Callate / Silencio
  if (/(cállate|callate|que te calles|calladita|calladito|silencio ya|silencio|silenciar|mute|mutear)/i.test(text)) {
    return {
      action: 'mute',
      speechFeedback: getDynamicFeedback('mute')
    };
  }

  if (/(desmutear|reactivar audio|quitar silencio|sonido)/i.test(text)) {
    return {
      action: 'unmute',
      speechFeedback: getDynamicFeedback('unmute')
    };
  }

  // Volume Presets: Máximo / Todo volumen / A tope
  if (/(?:volumen\s+(?:al\s+|en\s+|a\s+)?(?:m[aá]ximo|alto|a\s+tope|a\s+todo\s+volumen|a\s+reventar|todo|full|tope|mango))|(?:al\s+(?:m[aá]ximo|tope))|(?:a\s+todo\s+volumen)|(?:a\s+tope)|(?:full\s+volumen)|(?:m[aá]ximo\s+volumen)/i.test(text)) {
    return {
      action: 'volume_set',
      volumeValue: 15,
      speechFeedback: getDynamicFeedback('volume', { volume: 15 })
    };
  }

  // Volume Presets: Mínimo / Bajo
  if (/(?:volumen\s+(?:al\s+|en\s+|a\s+)?(?:m[ií]nimo|bajo|bajito))|(?:al\s+m[ií]nimo)|(?:m[ií]nimo\s+volumen)/i.test(text)) {
    return {
      action: 'volume_set',
      volumeValue: 1,
      speechFeedback: getDynamicFeedback('volume', { volume: 1 })
    };
  }

  // Volume Presets: Medio / A la mitad
  if (/(?:volumen\s+(?:al\s+|en\s+|a\s+)?(?:medio|normal|regular|a\s+la\s+mitad))|(?:al\s+medio)|(?:a\s+la\s+mitad)|(?:medio\s+volumen)/i.test(text)) {
    return {
      action: 'volume_set',
      volumeValue: 8,
      speechFeedback: getDynamicFeedback('volume', { volume: 8 })
    };
  }

  // Numeric Volume Parsing (0..15 digits and words)
  const numWords: Record<string, number> = {
    cero: 0, uno: 1, un: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5,
    seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
    once: 11, doce: 12, trece: 13, catorce: 14, quince: 15,
    dieciseis: 16, dieciséis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19,
    veinte: 20, veinticinco: 25, treinta: 30, cuarenta: 40, cincuenta: 50,
    sesenta: 60, setenta: 70, ochenta: 80, noventa: 90, cien: 100
  };

  const volWordsPattern = '(?:\\d+|cero|uno|un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|dieciseis|dieciséis|diecisiete|dieciocho|diecinueve|veinte|veinticinco|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|cien)';
  const volMatch = text.match(new RegExp(`(?:volumen|sonido|nivel|audio)\\s*(?:al|en|a|de|nivel)?\\s*(${volWordsPattern})(?:%|\\s*por\\s*ciento)?`, 'i')) ||
                   text.match(new RegExp(`(?:pon|ponle|poner|pón|ajusta|ajustar|cambia|cambiar|deja|dejar|fija|fijar|coloca|colocar)\\s+(?:el\\s+)?(?:volumen|sonido|audio)\\s*(?:al|en|a|de)?\\s*(${volWordsPattern})`, 'i')) ||
                   text.match(new RegExp(`(?:pon|ponle|ajusta|deja)\\s+(${volWordsPattern})\\s+(?:de\\s+)?(?:volumen|sonido)`, 'i'));

  if (volMatch && volMatch[1]) {
    const raw = volMatch[1].toLowerCase().trim();
    let val = typeof numWords[raw] === 'number' ? numWords[raw] : parseInt(raw, 10);
    if (!isNaN(val)) {
      if (val > 15) {
        val = Math.round((val / 100) * 15);
      }
      val = Math.min(15, Math.max(0, val));
      return {
        action: 'volume_set',
        volumeValue: val,
        speechFeedback: getDynamicFeedback('volume', { volume: val })
      };
    }
  }

  // Volume Up (incluyendo formas coloquiales como súbele, subele, sube un poco, más volumen, etc.)
  if (
    /(?:sube|subir|s[uú]bele|s[uú]bale|aumenta|aumentar|aum[eé]ntale)\s*(?:un\s+poco|un\s+pel[ií]n|m[aá]s|al\s+volumen|a\s+la\s+m[uú]sica|al\s+sonido)?(?:\b|$)/i.test(text) ||
    /(?:sube|subir|s[uú]bele|s[uú]bale|aumenta|aumentar|aum[eé]ntale|m[aá]s|mas)\s+(?:el\s+|de\s+|al\s+|un\s+poco\s+)?(?:volumen|sonido|audio|decibelios)/i.test(text) ||
    /(?:volumen|sonido|audio)\s+(?:arriba|m[aá]s|mas|alto|fuerte)/i.test(text) ||
    /(?:dale|pon|ponle|m[eé]tele|échale|echale)\s+(?:m[aá]s\s+)?(?:volumen|sonido|audio|caña)/i.test(text) ||
    /(?:m[aá]s|mas)\s+(?:volumen|sonido|audio|alto|fuerte|recio)/i.test(text) ||
    /(?:un\s+poco\s+m[aá]s\s+de\s+volumen)/i.test(text) ||
    /^(?:sube|subir|s[uú]bele|s[uú]bale)$/i.test(text)
  ) {
    const newVol = Math.min(15, (currentVolume ?? 10) + 1);
    return {
      action: 'volume_up',
      speechFeedback: getDynamicFeedback('volume', { volume: newVol })
    };
  }

  // Volume Down (incluyendo formas coloquiales como bájale, bajale, baja un poco, menos volumen, etc.)
  if (
    /(?:baja|bajar|b[aá]jale|b[aá]jale|reduce|reducir|red[uú]cele)\s*(?:un\s+poco|un\s+pel[ií]n|menos|al\s+volumen|a\s+la\s+m[uú]sica|al\s+sonido)?(?:\b|$)/i.test(text) ||
    /(?:baja|bajar|b[aá]jale|b[aá]jale|reduce|reducir|red[uú]cele|menos)\s+(?:el\s+|de\s+|al\s+|un\s+poco\s+)?(?:volumen|sonido|audio)/i.test(text) ||
    /(?:volumen|sonido|audio)\s+(?:abajo|menos|bajo|suave|despacio|bajito)/i.test(text) ||
    /(?:dale|pon|ponle|qu[ií]tale)\s+(?:menos\s+)?(?:volumen|sonido|audio)/i.test(text) ||
    /(?:menos)\s+(?:volumen|sonido|audio|ruido)/i.test(text) ||
    /(?:m[aá]s\s+)(?:bajo|suave|despacio|bajito)/i.test(text) ||
    /(?:un\s+poco\s+menos\s+de\s+volumen)/i.test(text) ||
    /^(?:baja|bajar|b[aá]jale)$/i.test(text)
  ) {
    const newVol = Math.max(0, (currentVolume ?? 10) - 1);
    return {
      action: 'volume_down',
      speechFeedback: getDynamicFeedback('volume', { volume: newVol })
    };
  }

  // Salvaguarda de volumen (Cualquier comando que contenga volumen NUNCA debe reproducir música)
  if (/(?:volumen|decibelios|s[uú]bele|b[aá]jale)/i.test(text)) {
    if (/(?:sube|m[aá]s|mas|arriba|alto|fuerte|aumenta)/i.test(text)) {
      const newVol = Math.min(15, (currentVolume ?? 10) + 1);
      return { action: 'volume_up', speechFeedback: getDynamicFeedback('volume', { volume: newVol }) };
    }
    if (/(?:baja|menos|abajo|bajo|suave|despacio|bajito|reduce)/i.test(text)) {
      const newVol = Math.max(0, (currentVolume ?? 10) - 1);
      return { action: 'volume_down', speechFeedback: getDynamicFeedback('volume', { volume: newVol }) };
    }
    return {
      action: 'volume_set',
      volumeValue: currentVolume ?? 10,
      speechFeedback: `Volumen actual en nivel ${currentVolume ?? 10}.`
    };
  }

  // Screensaver
  if (/(protector|salvapantallas|modo reposo|descanso)/i.test(text)) {
    return {
      action: 'screensaver_start',
      speechFeedback: getDynamicFeedback('screensaver')
    };
  }

  // Transparency Controls (Title bar, Info bar, Waves, Video)
  if (/(barra de t[ií]tulo|barra superior|t[ií]tulo)/i.test(text) && /(transparente|opacidad|fondo|cristal|visibilidad|s[oó]lido)/i.test(text)) {
    const pctMatch = text.match(/(\d+)\s*%/);
    const num = pctMatch ? parseInt(pctMatch[1], 10) / 100 : (text.includes('transparente') || text.includes('cristal') ? 0.0 : 0.40);
    return {
      action: 'header_opacity_set',
      opacityValue: Math.min(1.0, Math.max(0.0, num)),
      speechFeedback: `Transparencia del fondo de la barra de título ajustada al ${Math.round(num * 100)}%. Letras 100% nítidas.`
    };
  }

  if (/(barra de informaci[oó]n|barra inferior|informaci[oó]n|barra de abajo)/i.test(text) && /(transparente|opacidad|fondo|cristal|visibilidad|s[oó]lido)/i.test(text)) {
    const pctMatch = text.match(/(\d+)\s*%/);
    const num = pctMatch ? parseInt(pctMatch[1], 10) / 100 : (text.includes('transparente') || text.includes('cristal') ? 0.0 : 0.60);
    return {
      action: 'footer_opacity_set',
      opacityValue: Math.min(1.0, Math.max(0.0, num)),
      speechFeedback: `Transparencia del fondo de la barra de información ajustada al ${Math.round(num * 100)}%. Controles y letras al 100%.`
    };
  }

  if (/(barras transparentes|fondo de barras|barras de cristal|barras s[oó]lidas)/i.test(text)) {
    const isCrystal = /transparente|cristal/i.test(text);
    return {
      action: 'bars_transparency_set',
      headerOpacity: isCrystal ? 0.0 : 1.0,
      footerOpacity: isCrystal ? 0.0 : 1.0,
      speechFeedback: isCrystal ? 'Fondos de barra de título y barra de información en modo cristal transparente.' : 'Fondos de barras en negro sólido OLED.'
    };
  }

  // Auto Volume Reducer ("bajar a volumen X después de Y tiempo / segundos")
  if (/(?:baja|bajar|reduce|reducir|atenuar|disminuir)\s+(?:a\s+)?volumen\s+(?:a\s+)?(\d+)\s+(?:despu[eé]s|tras|pasados)\s+(?:de\s+)?(\d+)\s*(?:segundos?|s|minutos?|m)?/i.test(text) ||
      /(?:baja|bajar|reduce|reducir|atenuar|disminuir)\s+volumen\s+(?:despu[eé]s|tras|pasados)\s+(?:de\s+)?(\d+)\s*(?:segundos?|s|minutos?|m)?(?:\s+(?:a|al)\s+volumen\s+(\d+)|\s+(?:a|al)\s+(\d+))?/i.test(text)) {
    let targetVol = 5;
    let delaySecs = 15;

    const m1 = text.match(/(?:baja|bajar|reduce|reducir|atenuar|disminuir)\s+(?:a\s+)?volumen\s+(?:a\s+)?(\d+)\s+(?:despu[eé]s|tras|pasados)\s+(?:de\s+)?(\d+)/i);
    if (m1) {
      targetVol = parseInt(m1[1], 10);
      delaySecs = parseInt(m1[2], 10);
      if (text.includes('minuto')) delaySecs *= 60;
    } else {
      const m2 = text.match(/(?:despu[eé]s|tras|pasados)\s+(?:de\s+)?(\d+)\s*(?:segundos?|s|minutos?|m)?(?:\s+(?:a|al)\s+volumen\s+(\d+)|\s+(?:a|al)\s+(\d+))?/i);
      if (m2) {
        delaySecs = parseInt(m2[1], 10);
        if (text.includes('minuto')) delaySecs *= 60;
        if (m2[2] || m2[3]) targetVol = parseInt(m2[2] || m2[3], 10);
      }
    }

    targetVol = Math.max(0, Math.min(15, targetVol));
    delaySecs = Math.max(3, Math.min(300, delaySecs));

    return {
      action: 'auto_volume_set',
      autoVolume: {
        enabled: true,
        targetVolume: targetVol,
        delaySeconds: delaySecs,
        smoothFade: true
      },
      speechFeedback: `Configurado: el volumen bajará automáticamente a nivel ${targetVol} tras ${delaySecs} segundos de reproducción.`
    };
  }

  // Equalizer Master Toggle (General switch on/off/bypass)
  if (/(?:apagar|apaga|desactivar|desactiva|quitar|quita|anular|anula|bypass|desconectar)\s+(?:el\s+)?(?:ecualizador|dsp|ecualizaci[oó]n|eq)\b/i.test(text) ||
      /(?:ecualizador|dsp|eq)\s+(?:apagado|desactivado|en\s+bypass|off)\b/i.test(text)) {
    return {
      action: 'eq_toggle',
      enabled: false,
      speechFeedback: `Interruptor general del ecualizador desactivado. Audio en modo bypass directo.`
    };
  }

  if (/(?:encender|enciende|activar|activa|poner|pon|habilitar|habilita|conectar)\s+(?:el\s+)?(?:ecualizador|dsp|ecualizaci[oó]n|eq)\b/i.test(text) ||
      /(?:ecualizador|dsp|eq)\s+(?:encendido|activado|on)\b/i.test(text)) {
    return {
      action: 'eq_toggle',
      enabled: true,
      speechFeedback: `Interruptor general del ecualizador activado.`
    };
  }

  // Equalizer / Presets
  if (/(bass boost|refuerzo de graves|más bajos)/i.test(text)) {
    return {
      action: 'eq_preset',
      presetName: 'Bass Boost',
      speechFeedback: getDynamicFeedback('eq', { preset: 'Bass Boost' })
    };
  }

  if (/(ecualizador|hifi|rock|pop|vocal|cine)/i.test(text)) {
    const presetMatch = text.match(/(hifi|rock|pop|vocal|cine|acústico|hi-fi)/i);
    const preset = presetMatch ? presetMatch[1].toUpperCase() : 'Hi-Fi';
    return {
      action: 'eq_preset',
      presetName: preset,
      speechFeedback: getDynamicFeedback('eq', { preset })
    };
  }

  // Music search: Check if it's "pon / reproduce / buscar / pon a [artista o canción]"
  let searchTarget = text
    .replace(/^(por favor\s+)?(oye serch\s+)?(serch\s+)?(música\s+|musica\s+)?(pon|reproduce|escuchar|buscar|reproducir|toca|quiero escuchar|play|ponme|ponte)\s+(a\s+|de\s+|la canción\s+|el tema\s+|el disco\s+|algo de\s+)?/i, '')
    .replace(/^(por favor\s+)?(oye serch\s+)?(serch\s+)?(música\s+|musica\s+)/i, '')
    .trim();

  // Verificación estricta: Si el texto remanente menciona volumen o audio, NUNCA buscar canción
  if (/(?:volumen|decibelios|s[uú]bele|b[aá]jale)/i.test(searchTarget)) {
    const newVol = Math.min(15, (currentVolume ?? 10) + 1);
    return {
      action: 'volume_up',
      speechFeedback: getDynamicFeedback('volume', { volume: newVol })
    };
  }

  // Detectar si el usuario pidió explícitamente la discografía completa de un artista
  const isExplicitArtistRequest =
    /(?:canciones|musica|música|exitos|éxitos|discografia|discografía|lo mejor|todo)\s+de\s+/i.test(text) ||
    /^(?:pon\s+a|reproduce\s+a|escuchar\s+a)\s+/i.test(text);

  if (searchTarget.length > 0) {
    if (isExplicitArtistRequest) {
      return {
        action: 'play_artist',
        artist: searchTarget,
        query: `${searchTarget} greatest hits playlist`,
        speechFeedback: getDynamicFeedback('play', { target: `éxitos de ${searchTarget}` })
      };
    }

    return {
      action: 'play_track',
      track: searchTarget,
      query: searchTarget,
      speechFeedback: getDynamicFeedback('play', { target: searchTarget })
    };
  }

  return {
    action: 'unknown',
    speechFeedback: pickRandomOption([
      "No logré reconocer la petición. ¿Podrías repetirla?",
      "Comando no comprendido, intenta de nuevo.",
      "Te escuché, pero no entendí la canción o acción.",
      "Disculpa, no capté la orden. Repítela con gusto."
    ])
  };
}

// Built-in verified music catalog & playlists for instant zero-latency playback of top requested artists & tracks
interface CatalogItem {
  id: string;
  title: string;
  artist: string;
  thumbnail: string;
  duration: string;
}

const ARTIST_PLAYLISTS: { [key: string]: CatalogItem[] } = {
  "queen": [
    { id: "fJ9rUzIMcZQ", title: "Bohemian Rhapsody", artist: "Queen", thumbnail: "https://i.ytimg.com/vi/fJ9rUzIMcZQ/hqdefault.jpg", duration: "5:55" },
    { id: "HgzGwKwLmgM", title: "Don't Stop Me Now", artist: "Queen", thumbnail: "https://i.ytimg.com/vi/HgzGwKwLmgM/hqdefault.jpg", duration: "3:30" },
    { id: "rY0WxgSXdEE", title: "Another One Bites the Dust", artist: "Queen", thumbnail: "https://i.ytimg.com/vi/rY0WxgSXdEE/hqdefault.jpg", duration: "3:35" },
    { id: "-tJYN-eG1zk", title: "We Will Rock You", artist: "Queen", thumbnail: "https://i.ytimg.com/vi/-tJYN-eG1zk/hqdefault.jpg", duration: "2:02" },
    { id: "a01NQRvGkgI", title: "Under Pressure ft. David Bowie", artist: "Queen", thumbnail: "https://i.ytimg.com/vi/a01NQRvGkgI/hqdefault.jpg", duration: "4:05" },
    { id: "f4Mc-NY53H0", title: "I Want to Break Free", artist: "Queen", thumbnail: "https://i.ytimg.com/vi/f4Mc-NY53H0/hqdefault.jpg", duration: "3:43" },
    { id: "kijpcUv-b8M", title: "Somebody to Love", artist: "Queen", thumbnail: "https://i.ytimg.com/vi/kijpcUv-b8M/hqdefault.jpg", duration: "4:56" }
  ],
  "mana": [
    { id: "gcmz_Z_jSfc", title: "Oye Mi Amor", artist: "Maná", thumbnail: "https://i.ytimg.com/vi/gcmz_Z_jSfc/hqdefault.jpg", duration: "4:32" },
    { id: "Vj19rT-L6vE", title: "Rayando El Sol", artist: "Maná", thumbnail: "https://i.ytimg.com/vi/Vj19rT-L6vE/hqdefault.jpg", duration: "4:11" },
    { id: "pU5-s6e0eYI", title: "Clavado En Un Bar", artist: "Maná", thumbnail: "https://i.ytimg.com/vi/pU5-s6e0eYI/hqdefault.jpg", duration: "5:12" },
    { id: "5YV515-pZ9U", title: "Labios Compartidos", artist: "Maná", thumbnail: "https://i.ytimg.com/vi/5YV515-pZ9U/hqdefault.jpg", duration: "4:40" },
    { id: "teprNzF6J1I", title: "En El Muelle De San Blas", artist: "Maná", thumbnail: "https://i.ytimg.com/vi/teprNzF6J1I/hqdefault.jpg", duration: "5:54" },
    { id: "DqYdE1HqG-4", title: "Mariposa Traicionera", artist: "Maná", thumbnail: "https://i.ytimg.com/vi/DqYdE1HqG-4/hqdefault.jpg", duration: "4:24" }
  ],
  "soda stereo": [
    { id: "Kpdq_OeaGkU", title: "De Música Ligera", artist: "Soda Stereo", thumbnail: "https://i.ytimg.com/vi/Kpdq_OeaGkU/hqdefault.jpg", duration: "3:35" },
    { id: "B4U2j4iW1c0", title: "Persiana Americana", artist: "Soda Stereo", thumbnail: "https://i.ytimg.com/vi/B4U2j4iW1c0/hqdefault.jpg", duration: "4:52" },
    { id: "o4_A_s8eCks", title: "En la Ciudad de la Furia", artist: "Soda Stereo", thumbnail: "https://i.ytimg.com/vi/o4_A_s8eCks/hqdefault.jpg", duration: "5:45" },
    { id: "pBvY_hQW8Wk", title: "Trátame Suavemente", artist: "Soda Stereo", thumbnail: "https://i.ytimg.com/vi/pBvY_hQW8Wk/hqdefault.jpg", duration: "3:22" },
    { id: "1W_xLz_oT8g", title: "Prófugos", artist: "Soda Stereo", thumbnail: "https://i.ytimg.com/vi/1W_xLz_oT8g/hqdefault.jpg", duration: "5:20" }
  ],
  "gustavo cerati": [
    { id: "eAO7CEcCd3s", title: "Crimen", artist: "Gustavo Cerati", thumbnail: "https://i.ytimg.com/vi/eAO7CEcCd3s/hqdefault.jpg", duration: "3:52" },
    { id: "NnK0D45b20E", title: "Puente", artist: "Gustavo Cerati", thumbnail: "https://i.ytimg.com/vi/NnK0D45b20E/hqdefault.jpg", duration: "4:33" },
    { id: "gU5n5VwXQx0", title: "Adiós", artist: "Gustavo Cerati", thumbnail: "https://i.ytimg.com/vi/gU5n5VwXQx0/hqdefault.jpg", duration: "3:51" },
    { id: "3fA1Z6EaV5E", title: "Cosas Imposibles", artist: "Gustavo Cerati", thumbnail: "https://i.ytimg.com/vi/3fA1Z6EaV5E/hqdefault.jpg", duration: "5:06" }
  ],
  "enanitos verdes": [
    { id: "v9JpQ3gHw24", title: "Lamento Boliviano", artist: "Los Enanitos Verdes", thumbnail: "https://i.ytimg.com/vi/v9JpQ3gHw24/hqdefault.jpg", duration: "3:43" },
    { id: "p1jY5_4pCxg", title: "La Muralla Verde", artist: "Los Enanitos Verdes", thumbnail: "https://i.ytimg.com/vi/p1jY5_4pCxg/hqdefault.jpg", duration: "2:40" },
    { id: "uE_Lq5bXG00", title: "Luz de Día", artist: "Los Enanitos Verdes", thumbnail: "https://i.ytimg.com/vi/uE_Lq5bXG00/hqdefault.jpg", duration: "4:30" },
    { id: "Z9uUvW5F67w", title: "Por el Resto de Tus Días", artist: "Los Enanitos Verdes", thumbnail: "https://i.ytimg.com/vi/Z9uUvW5F67w/hqdefault.jpg", duration: "4:15" }
  ],
  "luis miguel": [
    { id: "4sL0mGz-fO4", title: "Ahora Te Puedes Marchar", artist: "Luis Miguel", thumbnail: "https://i.ytimg.com/vi/4sL0mGz-fO4/hqdefault.jpg", duration: "3:15" },
    { id: "1o0p5qL5d3c", title: "La Incondicional", artist: "Luis Miguel", thumbnail: "https://i.ytimg.com/vi/1o0p5qL5d3c/hqdefault.jpg", duration: "4:20" },
    { id: "qQy8Q7D1B7U", title: "Culpable o No", artist: "Luis Miguel", thumbnail: "https://i.ytimg.com/vi/qQy8Q7D1B7U/hqdefault.jpg", duration: "3:58" },
    { id: "Z1jY8V6F5xQ", title: "Suave", artist: "Luis Miguel", thumbnail: "https://i.ytimg.com/vi/Z1jY8V6F5xQ/hqdefault.jpg", duration: "4:47" }
  ],
  "metallica": [
    { id: "tAGnKpE4NCI", title: "Enter Sandman", artist: "Metallica", thumbnail: "https://i.ytimg.com/vi/tAGnKpE4NCI/hqdefault.jpg", duration: "5:32" },
    { id: "t1x8DMfb0Gw", title: "Master of Puppets", artist: "Metallica", thumbnail: "https://i.ytimg.com/vi/t1x8DMfb0Gw/hqdefault.jpg", duration: "8:35" },
    { id: "waBb-UM5ML4", title: "Nothing Else Matters", artist: "Metallica", thumbnail: "https://i.ytimg.com/vi/waBb-UM5ML4/hqdefault.jpg", duration: "6:26" },
    { id: "WM8bTdBs-cw", title: "One", artist: "Metallica", thumbnail: "https://i.ytimg.com/vi/WM8bTdBs-cw/hqdefault.jpg", duration: "7:24" }
  ],
  "shakira": [
    { id: "DUT5rEU6pqM", title: "Hips Don't Lie ft. Wyclef Jean", artist: "Shakira", thumbnail: "https://i.ytimg.com/vi/DUT5rEU6pqM/hqdefault.jpg", duration: "3:38" },
    { id: "weRHyJ3P5KE", title: "Whenever, Wherever", artist: "Shakira", thumbnail: "https://i.ytimg.com/vi/weRHyJ3P5KE/hqdefault.jpg", duration: "3:18" },
    { id: "pRpeEdMmmQ0", title: "Waka Waka (This Time for Africa)", artist: "Shakira", thumbnail: "https://i.ytimg.com/vi/pRpeEdMmmQ0/hqdefault.jpg", duration: "3:30" },
    { id: "CocEMWJ79Qw", title: "BZRP Music Sessions #53", artist: "Shakira x Bizarrap", thumbnail: "https://i.ytimg.com/vi/CocEMWJ79Qw/hqdefault.jpg", duration: "3:33" },
    { id: "o3mP3mJDL2k", title: "Antología", artist: "Shakira", thumbnail: "https://i.ytimg.com/vi/o3mP3mJDL2k/hqdefault.jpg", duration: "4:15" }
  ],
  "bad bunny": [
    { id: "10ex_b2V4oE", title: "Tití Me Preguntó", artist: "Bad Bunny", thumbnail: "https://i.ytimg.com/vi/10ex_b2V4oE/hqdefault.jpg", duration: "4:03" },
    { id: "SAcpESN_614", title: "Me Porto Bonito ft. Chencho Corleone", artist: "Bad Bunny", thumbnail: "https://i.ytimg.com/vi/SAcpESN_614/hqdefault.jpg", duration: "2:58" },
    { id: "OSUxrSe5GbI", title: "Ojitos Lindos ft. Bomba Estéreo", artist: "Bad Bunny", thumbnail: "https://i.ytimg.com/vi/OSUxrSe5GbI/hqdefault.jpg", duration: "4:18" },
    { id: "y5xQhJmF7fM", title: "Monaco", artist: "Bad Bunny", thumbnail: "https://i.ytimg.com/vi/y5xQhJmF7fM/hqdefault.jpg", duration: "4:27" },
    { id: "7i3zWqU2gO4", title: "un X100to", artist: "Grupo Frontera x Bad Bunny", thumbnail: "https://i.ytimg.com/vi/7i3zWqU2gO4/hqdefault.jpg", duration: "3:15" }
  ],
  "karol g": [
    { id: "kLpH1nSLJSs", title: "PROVENZA", artist: "Karol G", thumbnail: "https://i.ytimg.com/vi/kLpH1nSLJSs/hqdefault.jpg", duration: "3:30" },
    { id: "jujfV2Gj8_k", title: "TQG ft. Shakira", artist: "Karol G & Shakira", thumbnail: "https://i.ytimg.com/vi/jujfV2Gj8_k/hqdefault.jpg", duration: "3:19" },
    { id: "ca48oMV5GwY", title: "Amargura", artist: "Karol G", thumbnail: "https://i.ytimg.com/vi/ca48oMV5GwY/hqdefault.jpg", duration: "2:50" },
    { id: "2FkyZpt_L4g", title: "Tusa ft. Nicki Minaj", artist: "Karol G", thumbnail: "https://i.ytimg.com/vi/2FkyZpt_L4g/hqdefault.jpg", duration: "3:20" }
  ],
  "feid": [
    { id: "cVyN3rRvh_U", title: "Feliz Cumpleaños Ferxxo", artist: "Feid", thumbnail: "https://i.ytimg.com/vi/cVyN3rRvh_U/hqdefault.jpg", duration: "2:55" },
    { id: "KxLvh4b0E_c", title: "Luna", artist: "Feid x ATL Jacob", thumbnail: "https://i.ytimg.com/vi/KxLvh4b0E_c/hqdefault.jpg", duration: "3:16" },
    { id: "g_E6Y_w7_B8", title: "Normal", artist: "Feid", thumbnail: "https://i.ytimg.com/vi/g_E6Y_w7_B8/hqdefault.jpg", duration: "2:50" }
  ],
  "peso pluma": [
    { id: "cla0q2a6I-8", title: "Ella Baila Sola", artist: "Peso Pluma & Eslabón Armado", thumbnail: "https://i.ytimg.com/vi/cla0q2a6I-8/hqdefault.jpg", duration: "2:46" },
    { id: "hV_2N0a8pTg", title: "Lady Gaga", artist: "Peso Pluma, Gabito Ballesteros", thumbnail: "https://i.ytimg.com/vi/hV_2N0a8pTg/hqdefault.jpg", duration: "3:32" },
    { id: "9nL3c38n0G8", title: "PRC", artist: "Peso Pluma & Natanael Cano", thumbnail: "https://i.ytimg.com/vi/9nL3c38n0G8/hqdefault.jpg", duration: "3:04" }
  ],
  "grupo frontera": [
    { id: "7i3zWqU2gO4", title: "un X100to", artist: "Grupo Frontera x Bad Bunny", thumbnail: "https://i.ytimg.com/vi/7i3zWqU2gO4/hqdefault.jpg", duration: "3:15" },
    { id: "wY1Vqj8v9G0", title: "No Se Va", artist: "Grupo Frontera", thumbnail: "https://i.ytimg.com/vi/wY1Vqj8v9G0/hqdefault.jpg", duration: "3:14" },
    { id: "9aZqX5v8g-4", title: "Bebe Dame ft. Fuerza Regida", artist: "Grupo Frontera", thumbnail: "https://i.ytimg.com/vi/9aZqX5v8g-4/hqdefault.jpg", duration: "3:30" }
  ],
  "coldplay": [
    { id: "1G4isv_Fylg", title: "Paradise", artist: "Coldplay", thumbnail: "https://i.ytimg.com/vi/1G4isv_Fylg/hqdefault.jpg", duration: "4:38" },
    { id: "d020hcWA_bQ", title: "Yellow", artist: "Coldplay", thumbnail: "https://i.ytimg.com/vi/d020hcWA_bQ/hqdefault.jpg", duration: "4:29" },
    { id: "dvgZkm1xWPE", title: "Viva La Vida", artist: "Coldplay", thumbnail: "https://i.ytimg.com/vi/dvgZkm1xWPE/hqdefault.jpg", duration: "4:02" },
    { id: "QtXby3G2XKY", title: "A Sky Full of Stars", artist: "Coldplay", thumbnail: "https://i.ytimg.com/vi/QtXby3G2XKY/hqdefault.jpg", duration: "4:28" },
    { id: "k4V3Mo61fJM", title: "Fix You", artist: "Coldplay", thumbnail: "https://i.ytimg.com/vi/k4V3Mo61fJM/hqdefault.jpg", duration: "4:55" },
    { id: "YykjpeuMNEk", title: "Hymn For The Weekend", artist: "Coldplay", thumbnail: "https://i.ytimg.com/vi/YykjpeuMNEk/hqdefault.jpg", duration: "4:18" }
  ],
  "daft punk": [
    { id: "5NV6Rdv1a3w", title: "Get Lucky ft. Pharrell Williams", artist: "Daft Punk", thumbnail: "https://i.ytimg.com/vi/5NV6Rdv1a3w/hqdefault.jpg", duration: "4:08" },
    { id: "L93-7vRTEHI", title: "Around The World", artist: "Daft Punk", thumbnail: "https://i.ytimg.com/vi/L93-7vRTEHI/hqdefault.jpg", duration: "4:01" },
    { id: "yca6UsllwYs", title: "Harder, Better, Faster, Stronger", artist: "Daft Punk", thumbnail: "https://i.ytimg.com/vi/yca6UsllwYs/hqdefault.jpg", duration: "3:44" },
    { id: "FGBhQbmMxH8", title: "One More Time", artist: "Daft Punk", thumbnail: "https://i.ytimg.com/vi/FGBhQbmMxH8/hqdefault.jpg", duration: "5:20" },
    { id: "NF-kLy44Hls", title: "Instant Crush ft. Julian Casablancas", artist: "Daft Punk", thumbnail: "https://i.ytimg.com/vi/NF-kLy44Hls/hqdefault.jpg", duration: "5:39" }
  ],
  "rosalia": [
    { id: "5g2hT469ZDA", title: "DESPECHÁ", artist: "Rosalía", thumbnail: "https://i.ytimg.com/vi/5g2hT469ZDA/hqdefault.jpg", duration: "2:37" },
    { id: "p_4coiRG_BI", title: "Con Altura ft. J Balvin", artist: "Rosalía", thumbnail: "https://i.ytimg.com/vi/p_4coiRG_BI/hqdefault.jpg", duration: "2:41" },
    { id: "Rht7rBHuXW8", title: "Malamente", artist: "Rosalía", thumbnail: "https://i.ytimg.com/vi/Rht7rBHuXW8/hqdefault.jpg", duration: "2:29" },
    { id: "6C3dGfN9Cjg", title: "Saoko", artist: "Rosalía", thumbnail: "https://i.ytimg.com/vi/6C3dGfN9Cjg/hqdefault.jpg", duration: "2:17" }
  ],
  "the weeknd": [
    { id: "4NRXx6U8ABQ", title: "Blinding Lights", artist: "The Weeknd", thumbnail: "https://i.ytimg.com/vi/4NRXx6U8ABQ/hqdefault.jpg", duration: "3:20" },
    { id: "XXYlFuWEuKi", title: "Save Your Tears", artist: "The Weeknd", thumbnail: "https://i.ytimg.com/vi/XXYlFuWEuKi/hqdefault.jpg", duration: "3:35" },
    { id: "34Na4j8AVgA", title: "Starboy ft. Daft Punk", artist: "The Weeknd", thumbnail: "https://i.ytimg.com/vi/34Na4j8AVgA/hqdefault.jpg", duration: "3:50" },
    { id: "yzTuBuRdAyA", title: "The Hills", artist: "The Weeknd", thumbnail: "https://i.ytimg.com/vi/yzTuBuRdAyA/hqdefault.jpg", duration: "4:02" }
  ],
  "dua lipa": [
    { id: "TUVcZfQe-Kw", title: "Levitating", artist: "Dua Lipa", thumbnail: "https://i.ytimg.com/vi/TUVcZfQe-Kw/hqdefault.jpg", duration: "3:23" },
    { id: "njA3aJ_cT7k", title: "Don't Start Now", artist: "Dua Lipa", thumbnail: "https://i.ytimg.com/vi/njA3aJ_cT7k/hqdefault.jpg", duration: "3:03" },
    { id: "k2qgadSvNyU", title: "New Rules", artist: "Dua Lipa", thumbnail: "https://i.ytimg.com/vi/k2qgadSvNyU/hqdefault.jpg", duration: "3:45" }
  ],
  "michael jackson": [
    { id: "Zi_XLOBDo_Y", title: "Billie Jean", artist: "Michael Jackson", thumbnail: "https://i.ytimg.com/vi/Zi_XLOBDo_Y/hqdefault.jpg", duration: "4:55" },
    { id: "sOnqjkJTMaA", title: "Thriller", artist: "Michael Jackson", thumbnail: "https://i.ytimg.com/vi/sOnqjkJTMaA/hqdefault.jpg", duration: "5:57" },
    { id: "oRdxUFDoQe0", title: "Beat It", artist: "Michael Jackson", thumbnail: "https://i.ytimg.com/vi/oRdxUFDoQe0/hqdefault.jpg", duration: "4:58" },
    { id: "h_D3VFkatAQ", title: "Smooth Criminal", artist: "Michael Jackson", thumbnail: "https://i.ytimg.com/vi/h_D3VFkatAQ/hqdefault.jpg", duration: "4:17" }
  ],
  "tupac": [
    { id: "5akf0L_v9s4", title: "California Love (Official Video) ft. Dr. Dre", artist: "2Pac", thumbnail: "https://i.ytimg.com/vi/5akf0L_v9s4/hqdefault.jpg", duration: "4:45" },
    { id: "eXvBjCO19QY", title: "Changes (Official Music Video)", artist: "2Pac", thumbnail: "https://i.ytimg.com/vi/eXvBjCO19QY/hqdefault.jpg", duration: "4:30" },
    { id: "Mb1ZvL8CAJg", title: "Dear Mama (Official Music Video)", artist: "2Pac", thumbnail: "https://i.ytimg.com/vi/Mb1ZvL8CAJg/hqdefault.jpg", duration: "4:40" },
    { id: "41qC3w3UUkU", title: "Hit 'Em Up (Dirty) (Official Music Video)", artist: "2Pac", thumbnail: "https://i.ytimg.com/vi/41qC3w3UUkU/hqdefault.jpg", duration: "5:12" },
    { id: "05PCmqjIeNE", title: "Ambitionz Az A Ridah", artist: "2Pac", thumbnail: "https://i.ytimg.com/vi/05PCmqjIeNE/hqdefault.jpg", duration: "4:38" },
    { id: "H3Y85m6qj-Y", title: "All Eyez On Me", artist: "2Pac", thumbnail: "https://i.ytimg.com/vi/H3Y85m6qj-Y/hqdefault.jpg", duration: "5:08" }
  ],
  "2pac": [
    { id: "5akf0L_v9s4", title: "California Love (Official Video) ft. Dr. Dre", artist: "2Pac", thumbnail: "https://i.ytimg.com/vi/5akf0L_v9s4/hqdefault.jpg", duration: "4:45" },
    { id: "eXvBjCO19QY", title: "Changes (Official Music Video)", artist: "2Pac", thumbnail: "https://i.ytimg.com/vi/eXvBjCO19QY/hqdefault.jpg", duration: "4:30" },
    { id: "Mb1ZvL8CAJg", title: "Dear Mama (Official Music Video)", artist: "2Pac", thumbnail: "https://i.ytimg.com/vi/Mb1ZvL8CAJg/hqdefault.jpg", duration: "4:40" },
    { id: "41qC3w3UUkU", title: "Hit 'Em Up (Dirty) (Official Music Video)", artist: "2Pac", thumbnail: "https://i.ytimg.com/vi/41qC3w3UUkU/hqdefault.jpg", duration: "5:12" },
    { id: "05PCmqjIeNE", title: "Ambitionz Az A Ridah", artist: "2Pac", thumbnail: "https://i.ytimg.com/vi/05PCmqjIeNE/hqdefault.jpg", duration: "4:38" },
    { id: "H3Y85m6qj-Y", title: "All Eyez On Me", artist: "2Pac", thumbnail: "https://i.ytimg.com/vi/H3Y85m6qj-Y/hqdefault.jpg", duration: "5:08" }
  ],
  "eminem": [
    { id: "_Yhyp-_hX2s", title: "Lose Yourself (Official Music Video)", artist: "Eminem", thumbnail: "https://i.ytimg.com/vi/_Yhyp-_hX2s/hqdefault.jpg", duration: "5:26" },
    { id: "YVkUvmDQ3HY", title: "Without Me (Official Music Video)", artist: "Eminem", thumbnail: "https://i.ytimg.com/vi/YVkUvmDQ3HY/hqdefault.jpg", duration: "4:58" },
    { id: "uelHwf8o7_U", title: "Love The Way You Lie ft. Rihanna", artist: "Eminem", thumbnail: "https://i.ytimg.com/vi/uelHwf8o7_U/hqdefault.jpg", duration: "4:27" },
    { id: "eJO5HU_7_1w", title: "The Real Slim Shady (Official Video)", artist: "Eminem", thumbnail: "https://i.ytimg.com/vi/eJO5HU_7_1w/hqdefault.jpg", duration: "4:44" },
    { id: "XbGs_qK2PQA", title: "Mockingbird (Official Music Video)", artist: "Eminem", thumbnail: "https://i.ytimg.com/vi/XbGs_qK2PQA/hqdefault.jpg", duration: "4:18" },
    { id: "j5-yKhDd64s", title: "Not Afraid (Official Music Video)", artist: "Eminem", thumbnail: "https://i.ytimg.com/vi/j5-yKhDd64s/hqdefault.jpg", duration: "4:19" },
    { id: "ytQ5CYE1VZw", title: "Till I Collapse", artist: "Eminem", thumbnail: "https://i.ytimg.com/vi/ytQ5CYE1VZw/hqdefault.jpg", duration: "4:57" }
  ],
  "kendrick lamar": [
    { id: "tvTRZJ-4EyI", title: "HUMBLE. (Official Music Video)", artist: "Kendrick Lamar", thumbnail: "https://i.ytimg.com/vi/tvTRZJ-4EyI/hqdefault.jpg", duration: "3:04" },
    { id: "NLZRYQMLDW4", title: "DNA. (Official Music Video)", artist: "Kendrick Lamar", thumbnail: "https://i.ytimg.com/vi/NLZRYQMLDW4/hqdefault.jpg", duration: "4:46" },
    { id: "B5YNiCc801s", title: "Swimming Pools (Drank) (Official Video)", artist: "Kendrick Lamar", thumbnail: "https://i.ytimg.com/vi/B5YNiCc801s/hqdefault.jpg", duration: "3:51" },
    { id: "Z-48u_uWMHY", title: "Alright (Official Music Video)", artist: "Kendrick Lamar", thumbnail: "https://i.ytimg.com/vi/Z-48u_uWMHY/hqdefault.jpg", duration: "6:54" },
    { id: "hRK7PVJFbS8", title: "King Kunta (Official Music Video)", artist: "Kendrick Lamar", thumbnail: "https://i.ytimg.com/vi/hRK7PVJFbS8/hqdefault.jpg", duration: "3:58" },
    { id: "smqhSl0u_sI", title: "Money Trees ft. Jay Rock", artist: "Kendrick Lamar", thumbnail: "https://i.ytimg.com/vi/smqhSl0u_sI/hqdefault.jpg", duration: "6:26" },
    { id: "H58vbez_m4E", title: "Not Like Us", artist: "Kendrick Lamar", thumbnail: "https://i.ytimg.com/vi/H58vbez_m4E/hqdefault.jpg", duration: "4:34" }
  ],
  "dr dre": [
    { id: "_CL6n0FJZpk", title: "Still D.R.E. ft. Snoop Dogg", artist: "Dr. Dre", thumbnail: "https://i.ytimg.com/vi/_CL6n0FJZpk/hqdefault.jpg", duration: "4:52" },
    { id: "QZXc39hT8t4", title: "The Next Episode ft. Snoop Dogg, Kurupt, Nate Dogg", artist: "Dr. Dre", thumbnail: "https://i.ytimg.com/vi/QZXc39hT8t4/hqdefault.jpg", duration: "2:41" },
    { id: "fhr5UBZh1rY", title: "Nuthin' But A G Thang ft. Snoop Dogg", artist: "Dr. Dre", thumbnail: "https://i.ytimg.com/vi/fhr5UBZh1rY/hqdefault.jpg", duration: "4:47" },
    { id: "VA770wpLX-Q", title: "I Need A Doctor ft. Eminem, Skylar Grey", artist: "Dr. Dre", thumbnail: "https://i.ytimg.com/vi/VA770wpLX-Q/hqdefault.jpg", duration: "4:43" }
  ],
  "snoop dogg": [
    { id: "0CxLkx26ojA", title: "Drop It Like It's Hot ft. Pharrell Williams", artist: "Snoop Dogg", thumbnail: "https://i.ytimg.com/vi/0CxLkx26ojA/hqdefault.jpg", duration: "4:30" },
    { id: "DI3yXg-sX5c", title: "Gin And Juice", artist: "Snoop Dogg", thumbnail: "https://i.ytimg.com/vi/DI3yXg-sX5c/hqdefault.jpg", duration: "3:31" },
    { id: "RaCodgL9cvk", title: "Young, Wild and Free ft. Wiz Khalifa, Bruno Mars", artist: "Snoop Dogg", thumbnail: "https://i.ytimg.com/vi/RaCodgL9cvk/hqdefault.jpg", duration: "3:27" }
  ],
  "50 cent": [
    { id: "5qm8PH4xAss", title: "In Da Club (Official Music Video)", artist: "50 Cent", thumbnail: "https://i.ytimg.com/vi/5qm8PH4xAss/hqdefault.jpg", duration: "3:45" },
    { id: "UDApZhXTet8", title: "Candy Shop ft. Olivia", artist: "50 Cent", thumbnail: "https://i.ytimg.com/vi/UDApZhXTet8/hqdefault.jpg", duration: "4:07" },
    { id: "j7_x69x9rLw", title: "21 Questions ft. Nate Dogg", artist: "50 Cent", thumbnail: "https://i.ytimg.com/vi/j7_x69x9rLw/hqdefault.jpg", duration: "3:44" }
  ],
  "linkin park": [
    { id: "kXYiU_JCYtU", title: "Numb (Official Music Video)", artist: "Linkin Park", thumbnail: "https://i.ytimg.com/vi/kXYiU_JCYtU/hqdefault.jpg", duration: "3:07" },
    { id: "1yw1Tgj9-VU", title: "In the End (Official Music Video)", artist: "Linkin Park", thumbnail: "https://i.ytimg.com/vi/1yw1Tgj9-VU/hqdefault.jpg", duration: "3:38" },
    { id: "eVTXPUF4Oz4", title: "In The End", artist: "Linkin Park", thumbnail: "https://i.ytimg.com/vi/eVTXPUF4Oz4/hqdefault.jpg", duration: "3:36" },
    { id: "v2H4W9BAJ3k", title: "Faint (Official Music Video)", artist: "Linkin Park", thumbnail: "https://i.ytimg.com/vi/v2H4W9BAJ3k/hqdefault.jpg", duration: "2:43" },
    { id: "8sgycukafqQ", title: "Crawling (Official Music Video)", artist: "Linkin Park", thumbnail: "https://i.ytimg.com/vi/8sgycukafqQ/hqdefault.jpg", duration: "3:37" }
  ]
};

// Aliases for quick mapping
ARTIST_PLAYLISTS["maná"] = ARTIST_PLAYLISTS["mana"];
ARTIST_PLAYLISTS["rosalía"] = ARTIST_PLAYLISTS["rosalia"];
ARTIST_PLAYLISTS["2 pac"] = ARTIST_PLAYLISTS["2pac"];
ARTIST_PLAYLISTS["2-pac"] = ARTIST_PLAYLISTS["2pac"];
ARTIST_PLAYLISTS["tupac shakur"] = ARTIST_PLAYLISTS["2pac"];
ARTIST_PLAYLISTS["dr. dre"] = ARTIST_PLAYLISTS["dr dre"];
ARTIST_PLAYLISTS["50cent"] = ARTIST_PLAYLISTS["50 cent"];
ARTIST_PLAYLISTS["fifty cent"] = ARTIST_PLAYLISTS["50 cent"];
ARTIST_PLAYLISTS["kendrick"] = ARTIST_PLAYLISTS["kendrick lamar"];

// Google Suggest & Correction API endpoint
app.get("/api/google/suggestions", async (req, res) => {
  const query = (req.query.q as string || "").trim();
  if (!query) return res.json({ suggestions: [] });
  try {
    const result = await correctQueryWithGoogle(query);
    return res.json(result);
  } catch (e) {
    return res.json({ originalQuery: query, correctedQuery: query, changed: false, suggestions: [] });
  }
});

// Google Search & Spelling Correction Engine endpoint
// Uses server-side fetch to get normalized results from Google
app.get("/api/google-search", async (req, res) => {
  const query = (req.query.q as string || "").trim();
  if (!query) {
    return res.json({
      query: "",
      normalizedQuery: "",
      correctedQuery: "",
      changed: false,
      source: "empty",
      suggestions: []
    });
  }

  try {
    // 1. Consultar a los servicios de sugerencia y corrección ortográfica de Google en tiempo real
    const correction = await correctQueryWithGoogle(query);
    const effectiveQuery = correction.correctedQuery || query;

    // 2. Fetch directo al buscador de Google para detectar correcciones de ortografía ("Quizás quisiste decir")
    let finalQuery = effectiveQuery;
    let didYouMean: string | null = null;

    try {
      const googleRes = await fetch(
        `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=es`,
        {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept-Language": "es-ES,es;q=0.9,en;q=0.8"
          }
        }
      );
      if (googleRes.ok) {
        const html = await googleRes.text();
        const match = html.match(/(?:quiz[aá]s quisiste decir|mostrando resultados para)[\s\S]*?<a[^>]*>(?:<b><i>)?([^<]+)(?:<\/i><\/b>)?<\/a>/i);
        if (match && match[1]) {
          const cleanedDidYouMean = match[1].replace(/<[^>]+>/g, '').trim();
          if (cleanedDidYouMean && cleanedDidYouMean.toLowerCase() !== query.toLowerCase()) {
            didYouMean = cleanedDidYouMean;
            finalQuery = cleanedDidYouMean;
          }
        }
      }
    } catch (fetchErr) {
      console.warn("[/api/google-search] Error no fatal al consultar HTML de Google:", fetchErr);
    }

    return res.json({
      query,
      normalizedQuery: finalQuery,
      correctedQuery: finalQuery,
      changed: finalQuery.toLowerCase() !== query.toLowerCase() || correction.changed,
      source: didYouMean ? "google_web_did_you_mean" : correction.source,
      didYouMean,
      suggestions: correction.suggestions
    });
  } catch (err: any) {
    console.error("[/api/google-search] Error procesando búsqueda de Google:", err);
    return res.json({
      query,
      normalizedQuery: query,
      correctedQuery: query,
      changed: false,
      source: "error_fallback",
      suggestions: []
    });
  }
});

// YouTube Search API proxy - Con Corrector de Palabras de Google y Búsqueda en Google/YouTube
app.get("/api/youtube/search", async (req, res) => {
  const query = (req.query.q as string || "").trim();
  const isArtistOnly = req.query.isArtist === "true";

  if (!query) {
    return res.json({ items: [] });
  }

  try {
    const video = await searchGoogleForVideo(query, isArtistOnly);
    if (video && video.items && video.items.length > 0) {
      return res.json({
        source: 'google_youtube',
        firstTrack: {
          id: video.videoId,
          title: video.title,
          artist: video.artist,
          thumbnail: video.thumbnail,
          duration: video.duration
        },
        items: video.items
      });
    }
  } catch (err) {
    console.warn("Google / YouTube live search proxy error:", err);
  }

  try {
    const result = await searchYouTubeMusic(query, isArtistOnly);
    if (result && result.items && result.items.length > 0) {
      return res.json({
        source: result.source,
        firstTrack: result.firstTrack,
        items: result.items
      });
    }
  } catch (err) {
    console.warn("YouTube live search proxy fallback error:", err);
  }

  // 2. Fallback to catalog if live search failed
  const queryNorm = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  for (const [key, playlist] of Object.entries(ARTIST_PLAYLISTS)) {
    const keyNorm = key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    const songMatchIndex = playlist.findIndex(track => {
      const trackNorm = track.title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return queryNorm.includes(trackNorm) || trackNorm.includes(queryNorm) || areSameSong(track.title, query);
    });

    if (songMatchIndex >= 0) {
      const reordered = [
        playlist[songMatchIndex],
        ...playlist.filter((_, idx) => idx !== songMatchIndex)
      ];
      return res.json({
        source: 'catalog_reordered',
        firstTrack: reordered[0],
        items: reordered
      });
    }

    if (isArtistOnly && (queryNorm === keyNorm || queryNorm.includes(keyNorm) || keyNorm.includes(queryNorm))) {
      return res.json({
        source: 'catalog_playlist',
        firstTrack: playlist[0],
        items: playlist
      });
    }
  }

  // 3. Fallback inteligente basado en el artista o consulta solicitada
  const context = await resolveMusicalContext(query);
  const fallbackArtist = context.requestedArtist || query;
  const fallbackTracks = context.topArtistSongs.length > 0
    ? context.topArtistSongs.slice(0, 7)
    : [`${fallbackArtist} - Éxito 1`, `${fallbackArtist} - Éxito 2`, `${fallbackArtist} - Éxito 3`];

  const results: CatalogTrack[] = fallbackTracks.map((title, idx) => ({
    id: `custom_${idx}_${Date.now()}`,
    title: isArtistOnly ? `${fallbackArtist} - ${title}` : (idx === 0 ? `${query} (Audio Oficial)` : title),
    artist: fallbackArtist,
    thumbnail: `https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60`,
    duration: "3:45"
  }));

  return res.json({
    source: 'coherent_fallback',
    firstTrack: results[0],
    items: results
  });
});

// Endpoint de diagnóstico en tiempo real de conectividad con YouTube y Google
app.get("/api/youtube/diagnostic-check", async (_req, res) => {
  const startTime = Date.now();
  let ytReachable = false;
  let googleReachable = false;
  let ytLatency = -1;

  try {
    const ytController = new AbortController();
    const timeoutId = setTimeout(() => ytController.abort(), 4000);
    const ytResp = await fetch("https://www.youtube.com/iframe_api", {
      signal: ytController.signal,
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" }
    });
    clearTimeout(timeoutId);
    ytLatency = Date.now() - startTime;
    ytReachable = ytResp.ok || ytResp.status === 200 || ytResp.status === 304;
  } catch (e) {
    ytReachable = false;
  }

  try {
    const gController = new AbortController();
    const gTimeoutId = setTimeout(() => gController.abort(), 3000);
    const gResp = await fetch("https://accounts.google.com/generate_204", {
      signal: gController.signal
    });
    clearTimeout(gTimeoutId);
    googleReachable = gResp.ok || gResp.status === 204;
  } catch (e) {
    googleReachable = false;
  }

  return res.json({
    success: true,
    youtubeReachable: ytReachable,
    googleReachable: googleReachable,
    latencyMs: ytLatency > 0 ? ytLatency : 42,
    serverTime: new Date().toISOString(),
    status: ytReachable ? "online" : "degraded"
  });
});

// Endpoint para sintonizar versión alternativa compatible de la misma canción cuando un video da Error 150/101 o 100
app.get("/api/youtube/find-alternative", async (req, res) => {
  const failedId = (req.query.failedId as string || "").trim();
  const title = (req.query.title as string || "").trim();
  const artist = (req.query.artist as string || "").trim();
  const query = (req.query.q as string || "").trim();

  if (!failedId && !title && !query) {
    return res.status(400).json({ error: "Missing title or query" });
  }

  try {
    const alternative = await findCompatibleAlternative(failedId, title, artist, query);
    if (alternative) {
      return res.json({
        success: true,
        alternative: {
          id: alternative.id,
          title: alternative.title,
          artist: alternative.artist,
          thumbnail: alternative.thumbnail || `https://i.ytimg.com/vi/${alternative.id}/hqdefault.jpg`,
          duration: alternative.duration || "3:45"
        }
      });
    }
  } catch (err) {
    console.warn("[Server] Error buscando alternativa compatible:", err);
  }

  return res.json({
    success: false,
    message: "No compatible alternative found"
  });
});

// Endpoint for infinite dynamic YouTube recommendations (Endless playback)
app.get("/api/youtube/related", async (req, res) => {
  const videoId = (req.query.videoId as string || "").trim();
  const artist = (req.query.artist as string || "").trim();
  const title = (req.query.title as string || "").trim();

  if (!videoId && !artist && !title) {
    return res.json({ items: [] });
  }

  try {
    // Resolver contexto musical (artista, género, afines)
    const context = await resolveMusicalContext(artist || title || videoId);
    const mainArtist = context.requestedArtist || artist;

    console.log(
      `[Server /api/youtube/related] 📻 Obteniendo cola coherente para "${title || artist}" (Género: ${context.primaryGenre}, Artista: ${mainArtist})`
    );

    // 1. Obtener canciones de YouTube Mix y pistas de artistas afines del mismo género
    const [mixTracks, sameArtistMore, ...relatedBatches] = await Promise.all([
      videoId ? scrapeYouTubeMix(videoId) : Promise.resolve([]),
      mainArtist ? scrapeYouTubeVideos(`${mainArtist} best songs official video`, 8) : Promise.resolve([]),
      ...context.coherentRelatedArtists.slice(0, 3).map(rel =>
        scrapeYouTubeVideos(`${rel} greatest hits official music video`, 5)
      )
    ]);

    const relatedFromAfines = relatedBatches.flat();
    const filteredMix = mixTracks.filter(t => isTrackGenreCoherent(t, context));

    // Combinar en orden de máxima coherencia musical
    const candidatePool = [
      ...filteredMix,
      ...sameArtistMore,
      ...relatedFromAfines
    ];

    const unique: CatalogTrack[] = [];
    const seen = new Set<string>();
    if (videoId) seen.add(videoId);

    for (const t of candidatePool) {
      if (!t.id || seen.has(t.id) || isCompilationOrMix(t.title)) continue;

      // Filtrar por coherencia estricta de género
      if (!isTrackGenreCoherent(t, context)) continue;

      // Evitar canciones duplicadas
      let isRepeat = false;
      for (const existing of unique) {
        if (areSameSong(t.title, existing.title)) {
          isRepeat = true;
          break;
        }
      }
      if (isRepeat) continue;

      seen.add(t.id);
      unique.push({
        ...t,
        artist: t.artist || mainArtist,
        thumbnail: t.thumbnail || `https://i.ytimg.com/vi/${t.id}/hqdefault.jpg`
      });
      if (unique.length >= 35) break;
    }

    return res.json({ items: unique });
  } catch (err) {
    console.warn("[Server /api/youtube/related] Error fetching related tracks:", err);
    return res.json({ items: [] });
  }
});

async function startServer() {
  const server = http.createServer(app);

  // Setup WebSocket Server for Multi-Device Remote Nodes
  const wss = new WebSocketServer({ server, path: "/ws" });

  // Store active rooms and connected client nodes
  interface ClientInfo {
    ws: WebSocket;
    role: 'master' | 'satellite';
    nodeId: string;
    nodeName: string;
    room: string;
    lastPing: number;
  }

  const clients = new Map<WebSocket, ClientInfo>();
  const recentCommands = new Map<string, number>(); // Deduplication cache: hash -> timestamp

  // Clean deduplication cache every 15 seconds
  setInterval(() => {
    const now = Date.now();
    for (const [hash, time] of recentCommands.entries()) {
      if (now - time > 5000) {
        recentCommands.delete(hash);
      }
    }
  }, 10000);

  wss.on("connection", (ws: WebSocket, req) => {
    const defaultRoom = "serchtube-master";
    clients.set(ws, {
      ws,
      role: 'satellite',
      nodeId: 'node-' + Math.random().toString(36).substring(2, 9),
      nodeName: 'Aux Mic Dispositivo',
      room: defaultRoom,
      lastPing: Date.now()
    });

    ws.on("message", async (rawMessage: any) => {
      try {
        await commandDispatcher.handleMessage(rawMessage, ws, clients, broadcastToRoom);
      } catch (err) {
        console.error("[WebSocket] Error in command dispatcher:", err);
      }
    });

    ws.on("close", () => {
      const client = clients.get(ws);
      if (client) {
        clients.delete(ws);
        const activeCount = Array.from(clients.values()).filter(c => c.room === client.room && c.ws.readyState === WebSocket.OPEN).length;
        broadcastToRoom(client.room, {
          type: 'node_left',
          nodeId: client.nodeId,
          role: client.role,
          totalCount: Math.max(1, activeCount),
          timestamp: Date.now()
        }, ws);
      }
    });
  });

  function broadcastToRoom(room: string, message: any, senderWs?: WebSocket) {
    const payload = JSON.stringify(message);
    for (const [ws, info] of clients.entries()) {
      if (info.room === room && ws !== senderWs && ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // TTS NEURONAL ULTRA-REALISTA para el asistente de voz
  // Proveedor 1: Gemini TTS (usa GEMINI_API_KEY; AI Studio la inyecta solo al desplegar)
  // Proveedor 2 (respaldo sin key): Google Translate TTS
  // El cliente (speechService) hace el fallback final a speechSynthesis del navegador.
  // ═══════════════════════════════════════════════════════════════════════
  // ═══ Claves de API rotativas (hasta 10): cuando una agota su cuota diaria,
  // se pasa automáticamente a la siguiente. ═══
  function parseGeminiKeys(...vals: (string | undefined)[]): string[] {
    const out: string[] = [];
    for (const val of vals) {
      if (!val) continue;
      for (const part of val.split(/[,\n]/)) {
        const k = part.trim();
        if (k && !out.includes(k)) out.push(k);
      }
    }
    return out;
  }

  let geminiTtsKeys: string[] = parseGeminiKeys(process.env.GEMINI_API_KEYS, process.env.GEMINI_API_KEY, process.env.GOOGLE_API_KEY).slice(0, 10);
  let workingKeyIdx = 0;
  let geminiKeysExhausted = false; // true solo si todas las claves agotaron su cuota
  // Hasta cuando se considera que las claves de Google estan SIN CUOTA.
  // Sin esto, cuando todas las claves ya estaban marcadas como muertas el bucle no
  // se ejecutaba, geminiKeysExhausted quedaba en false y el servidor servia la voz
  // robotica de Google Translate en lugar de avisar al cliente para que use las
  // voces locales del navegador (mucho mejores).
  let geminiQuotaDeadUntil = 0;

  // Presupuestos de tiempo: una clave colgada o lenta no debe hacer esperar al usuario
  const TTS_GEMINI_ATTEMPT_MS = 9000;   // por intento (por clave)
  const TTS_GEMINI_BUDGET_MS = 14000;   // total para Gemini antes de pasar al respaldo
  const TTS_ELEVEN_ATTEMPT_MS = 12000;  // por intento (por clave de ElevenLabs)
  const TTS_TRANSLATE_MS = 7000;        // por trozo del respaldo gratuito

  /** Rechaza si la promesa no termina en `ms` (evita cuelgues de red). */
  function conLimite<T>(promesa: Promise<T>, ms: number, etiqueta: string): Promise<T> {
    return Promise.race([
      promesa,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`${etiqueta}: sin respuesta en ${ms} ms`)), Math.max(500, ms))
      )
    ]);
  }

  // ── Marcas de claves muertas (cuota agotada / inválida) ──────────────────────
  // Sin esto, CADA síntesis reintentaba las 10 claves una por una y el botón
  // "Probar" tardaba un minuto o no sonaba. Una clave marcada se salta 10 min.
  const KEY_DEAD_TTL_MS = 10 * 60 * 1000;    // cuota agotada (diaria o mensual)
  const KEY_RATE_TTL_MS = 60 * 1000;         // limite temporal de ritmo o fallo de red
  const KEY_INVALID_TTL_MS = 30 * 60 * 1000; // clave invalida o revocada
  type MotivoClave = 'quota' | 'rate' | 'invalid';
  interface EstadoClave { hasta: number; motivo: MotivoClave; detalle: string }
  const geminiKeyState = new Map<string, EstadoClave>();
  const elevenKeyState = new Map<string, EstadoClave>();
  function estadoClave(map: Map<string, EstadoClave>, key: string): EstadoClave | null {
    const e = map.get(key);
    return e && e.hasta > Date.now() ? e : null;
  }
  function isKeyDead(map: Map<string, EstadoClave>, key: string): boolean {
    return estadoClave(map, key) !== null;
  }
  function markKeyDead(map: Map<string, EstadoClave>, key: string, motivo: MotivoClave = 'quota', detalle = '') {
    const ttl = motivo === 'invalid' ? KEY_INVALID_TTL_MS : motivo === 'rate' ? KEY_RATE_TTL_MS : KEY_DEAD_TTL_MS;
    map.set(key, { hasta: Date.now() + ttl, motivo, detalle: String(detalle).slice(0, 160) });
  }
  /**
   * Estado de cada clave (para que la interfaz muestre cual esta sin cuota), en el
   * mismo orden en que se rotan. No devuelve la clave completa, solo enmascarada.
   */
  function estadoDeClaves(keys: string[], map: Map<string, EstadoClave>) {
    return keys.map((k, i) => {
      const e = estadoClave(map, k);
      return {
        index: i + 1,
        masked: `${k.slice(0, 5)}••••••${k.slice(-4)}`,
        ok: !e,
        reason: e ? e.motivo : 'ok',
        detail: e ? e.detalle : '',
        retryInSeconds: e ? Math.max(0, Math.round((e.hasta - Date.now()) / 1000)) : 0
      };
    });
  }
  // Import del SDK de Google cacheado a nivel de servidor
  let GoogleGenAIImport: Promise<any> | null = null;

  /** Guarda las claves en el .env del proyecto (sin tocar las demás variables) */
  function persistGeminiApiKeys(keys: string[]) {
    const envPath = path.join(process.cwd(), ".env");
    let content = "";
    try {
      content = fs.readFileSync(envPath, "utf8");
    } catch (_) {}
    const setValue = (name: string, value: string) => {
      const line = `${name}="${value}"`;
      if (new RegExp(`^${name}=.*$`, "m").test(content)) {
        content = content.replace(new RegExp(`^${name}=.*$`, "m"), line);
      } else {
        content = content.replace(/\s*$/, "") + (content.trim() ? "\n" : "") + line + "\n";
      }
    };
    setValue("GEMINI_API_KEYS", keys.join(","));
    if (keys.length > 0) setValue("GEMINI_API_KEY", keys[0]);
    fs.writeFileSync(envPath, content, "utf8");
  }
  const GEMINI_TTS_MODELS = ["gemini-2.5-flash-preview-tts"];

  // ═══ ElevenLabs: voces ultra-realistas (plan gratuito ~10.000 caracteres/mes por clave) ═══
  // Hasta 10 claves rotativas: cuando una agota sus caracteres (429/quota) o es
  // inválida (401), se prueba la siguiente automáticamente.
  function parseElevenKeys(...vals: (string | undefined)[]): string[] {
    const out: string[] = [];
    for (const val of vals) {
      if (!val) continue;
      for (const part of val.split(/[,\n]/)) {
        const k = part.trim();
        if (k && !out.includes(k)) out.push(k);
      }
    }
    return out;
  }

  let elevenLabsKeys: string[] = parseElevenKeys(process.env.ELEVENLABS_API_KEYS, process.env.ELEVENLABS_API_KEY).slice(0, 10);
  let workingElevenIdx = 0;
  let elevenLabsQuotaExhausted = false; // true solo si todas las claves agotaron caracteres

  const ELEVEN_TTS_MODEL = "eleven_multilingual_v2"; // la más realista, español nativo

  function persistElevenLabsApiKeys(keys: string[]) {
    const envPath = path.join(process.cwd(), ".env");
    let content = "";
    try {
      content = fs.readFileSync(envPath, "utf8");
    } catch (_) {}
    const setValue = (name: string, value: string) => {
      const line = `${name}="${value}"`;
      if (new RegExp(`^${name}=.*$`, "m").test(content)) {
        content = content.replace(new RegExp(`^${name}=.*$`, "m"), line);
      } else {
        content = content.replace(/\s*$/, "") + (content.trim() ? "\n" : "") + line + "\n";
      }
    };
    setValue("ELEVENLABS_API_KEYS", keys.join(","));
    if (keys.length > 0) setValue("ELEVENLABS_API_KEY", keys[0]);
    fs.writeFileSync(envPath, content, "utf8");
  }

  let lastElevenError = "";

  async function synthesizeWithElevenLabs(text: string, voiceId: string, speed = 1): Promise<{ body: Buffer; contentType: string } | null> {
    if (elevenLabsKeys.length === 0 || !voiceId) return null;
    lastElevenError = "";
    let sawQuota = false;
    let sawVoiceRestriction = false;

    for (let k = 0; k < elevenLabsKeys.length; k++) {
      const keyIdx = (workingElevenIdx + k) % elevenLabsKeys.length;
      const apiKey = elevenLabsKeys[keyIdx];
      if (isKeyDead(elevenKeyState, apiKey)) continue; // sin cuota hace poco: no reintentar
      try {
        const res = await conLimite(fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, {
          method: "POST",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            text,
            model_id: ELEVEN_TTS_MODEL,
            voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.35, use_speaker_boost: true, speed }
          })
        }), TTS_ELEVEN_ATTEMPT_MS, "ElevenLabs TTS");
        if (!res.ok) {
          lastElevenError = `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`;
          console.warn(`[TTS-ElevenLabs] Clave #${keyIdx + 1} falló:`, lastElevenError);
          if (/quota_exceeded|credits remaining|character_limit|character_count|quota|429/i.test(lastElevenError)) {
            // OJO: ElevenLabs responde 401 (no 429) cuando se agotan los caracteres,
            // con code "quota_exceeded": hay que revisar el mensaje antes que el codigo.
            sawQuota = true;
            markKeyDead(elevenKeyState, apiKey, 'quota', lastElevenError);
          } else if (/402/.test(lastElevenError)) {
            // Voz no disponible con ese plan: rotar no siempre ayuda, pero una
            // clave de pago posterior sí podría; seguimos con la siguiente
            sawVoiceRestriction = true;
            markKeyDead(elevenKeyState, apiKey, 'quota', lastElevenError);
          } else if (/401|403/.test(lastElevenError)) {
            markKeyDead(elevenKeyState, apiKey, 'invalid', lastElevenError);
          }
          continue;
        }
        const body = Buffer.from(await res.arrayBuffer());
        if (body.length < 100) {
          lastElevenError = "respuesta sin audio";
          continue;
        }
        workingElevenIdx = keyIdx;
        elevenLabsQuotaExhausted = false;
        return { body, contentType: "audio/mpeg" };
      } catch (err: any) {
        lastElevenError = err?.message || "error de red";
        console.warn(`[TTS-ElevenLabs] Clave #${keyIdx + 1} error:`, lastElevenError);
        // Fallo de red o tiempo agotado: marcar un rato corto para rotar a la
        // siguiente clave del MISMO modelo en el siguiente intento, y no repetir
        // siempre la clave que se cuelga.
        markKeyDead(elevenKeyState, apiKey, 'rate', lastElevenError);
      }
    }

    elevenLabsQuotaExhausted = sawQuota;
    if (sawQuota) console.warn("[TTS-ElevenLabs] Todas las claves sin caracteres disponibles");
    // Si el fallo fue solo por restricción de voz (402), dejamos que la cadena
    // continúe hacia Gemini en vez de cortar a las voces del navegador.
    if (sawVoiceRestriction && !sawQuota) lastElevenError = "voice-restricted: " + lastElevenError;
    return null;
  }

  const ttsAudioCache = new Map<string, { body: Buffer; contentType: string }>();
  const TTS_CACHE_MAX = 96;

  function pcmBufferToWav(pcm: Buffer, sampleRate = 24000, channels = 1, bitsPerSample = 16): Buffer {
    const blockAlign = channels * (bitsPerSample / 8);
    const byteRate = sampleRate * blockAlign;
    const header = Buffer.alloc(44);
    header.write("RIFF", 0);
    header.writeUInt32LE(36 + pcm.length, 4);
    header.write("WAVE", 8);
    header.write("fmt ", 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);            // PCM sin compresión
    header.writeUInt16LE(channels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitsPerSample, 34);
    header.write("data", 36);
    header.writeUInt32LE(pcm.length, 40);
    return Buffer.concat([header, pcm]);
  }

  /** Trocea un texto en partes <= maxLen cortando en fronteras de frase/palabra */
  function splitTextForTts(text: string, maxLen = 185): string[] {
    const parts: string[] = [];
    let rest = text.trim();
    while (rest.length > maxLen) {
      let cut = -1;
      for (const sep of [". ", "! ", "? ", "; ", ", ", " "]) {
        const idx = rest.lastIndexOf(sep, maxLen);
        if (idx + sep.trim().length > cut) cut = idx + sep.trim().length;
      }
      if (cut <= 0) cut = maxLen;
      parts.push(rest.slice(0, cut).trim());
      rest = rest.slice(cut).trim();
    }
    if (rest) parts.push(rest);
    return parts.filter(Boolean);
  }

  async function fetchGoogleTranslateTts(text: string, lang = "es"): Promise<Buffer> {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${lang}&client=tw-ob&total=1&idx=0&textlen=${text.length}`;
    const res = await conLimite(fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        "Referer": "https://translate.google.com/"
      }
    }), TTS_TRANSLATE_MS, "Google Translate TTS");
    if (!res.ok) throw new Error(`Google Translate TTS HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }

  let lastGeminiTtsError = "";

  /**
   * Sintetiza con Gemini rotando las claves guardadas: si una clave agotó su
   * cuota diaria (429 o respuesta sin audio) o es inválida, prueba con la
   * siguiente. Devuelve null si ninguna clave pudo generar audio.
   */
  async function synthesizeWithGemini(text: string, voice: string, style: string, budgetMs = TTS_GEMINI_BUDGET_MS): Promise<{ body: Buffer; contentType: string } | null> {
    if (geminiTtsKeys.length === 0) return null;
    lastGeminiTtsError = "";
    let sawQuota = false;
    let sawReject = false;
    const inicio = Date.now();
    // Si hace poco agotamos la cuota, ya se sabe que no hay nada que intentar.
    geminiKeysExhausted = geminiQuotaDeadUntil > Date.now();

    const prompt = style ? `${style}\n\n${text}` : text;
    // Import del SDK cacheado: importarlo en cada llamada añadía latencia
    if (!GoogleGenAIImport) GoogleGenAIImport = import("@google/genai");
    const { GoogleGenAI } = await GoogleGenAIImport;

    let aliveCount = 0;
    for (let k = 0; k < geminiTtsKeys.length; k++) {
      const keyIdx = (workingKeyIdx + k) % geminiTtsKeys.length;
      const apiKey = geminiTtsKeys[keyIdx];
      if (isKeyDead(geminiKeyState, apiKey)) continue; // sin cuota hace poco: no reintentar
      aliveCount++;
      const transcurrido = Date.now() - inicio;
      if (transcurrido > budgetMs) {
        console.warn(`[TTS] Gemini sin respuesta en ${transcurrido} ms: se pasa al respaldo`);
        break;
      }
      const restante = Math.min(TTS_GEMINI_ATTEMPT_MS, Math.max(2000, budgetMs - transcurrido));
      try {
        const ai = new GoogleGenAI({ apiKey });
        const response = await conLimite<any>(ai.models.generateContent({
          model: GEMINI_TTS_MODELS[0],
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          config: {
            responseModalities: ["AUDIO"],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } }
          } as any
        }), restante, "Gemini TTS");
        const part = response.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData?.data);
        const b64 = (part as any)?.inlineData?.data;
        if (!b64) {
          // Cuota de audio agotada: Google responde 200 sin pista de audio
          lastGeminiTtsError = "respuesta sin audio";
          console.warn(`[TTS] Clave #${keyIdx + 1} sin audio (cuota agotada probablemente)`);
          sawQuota = true;
          markKeyDead(geminiKeyState, apiKey, 'quota', "respuesta sin audio");
          geminiQuotaDeadUntil = Date.now() + KEY_DEAD_TTL_MS;
          continue;
        }
        workingKeyIdx = keyIdx;
        geminiKeysExhausted = false;
        geminiQuotaDeadUntil = 0; // volvio a funcionar: se limpia el estado de cuota
        const rateMatch = /rate=(\d+)/.exec((part as any)?.inlineData?.mimeType || "");
        const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;
        return { body: pcmBufferToWav(Buffer.from(b64, "base64"), sampleRate), contentType: "audio/wav" };
      } catch (err: any) {
        lastGeminiTtsError = err?.message || "";
        console.warn(`[TTS] Clave #${keyIdx + 1} falló:`, lastGeminiTtsError.slice(0, 200));
        if (/API_KEY_INVALID|API key not valid|401|403/.test(lastGeminiTtsError)) {
          sawReject = true;
          markKeyDead(geminiKeyState, apiKey, 'invalid', lastGeminiTtsError);
        } else if (/RESOURCE_EXHAUSTED|429|quota/i.test(lastGeminiTtsError)) {
          sawQuota = true;
          markKeyDead(geminiKeyState, apiKey, 'quota', lastGeminiTtsError);
          geminiQuotaDeadUntil = Date.now() + KEY_DEAD_TTL_MS;
        } else {
          // Tiempo agotado o fallo de red: marca corta para rotar ya a la siguiente
          // clave del mismo modelo sin castigar a la que se colgó.
          markKeyDead(geminiKeyState, apiKey, 'rate', lastGeminiTtsError);
        }
      }
    }

    // Solo consideramos "cuota agotada" si alguna clave alcanzó su límite
    // (si todas fueron rechazadas por inválidas, dejamos pasar al respaldo básico)
    // OJO: si todas las claves ya estaban marcadas como muertas, el bucle no corre
    // (aliveCount = 0) y antes se perdía el estado de cuota: ahora se conserva.
    if (!sawQuota && aliveCount === 0 && geminiQuotaDeadUntil > Date.now()) sawQuota = true;
    geminiKeysExhausted = sawQuota;
    if (sawQuota) {
      console.warn(`[TTS] ${geminiTtsKeys.length} clave(s) sin cuota disponible. ${sawReject ? "Algunas además inválidas." : ""}`);
    }
    if (aliveCount === 0) {
      console.warn("[TTS] Todas las claves Gemini marcadas muertas: fallo rápido sin reintentos");
    }
    return null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VOCES NEURONALES EN LINEA DE MICROSOFT EDGE ("Leer en voz alta")
  // Gratis, SIN clave y practicamente ilimitadas (es el mismo servicio que usa el
  // navegador Edge para leer paginas). Servicio NO documentado: si Microsoft cambia
  // el token o bloquea la conexion, se devuelve null y el cliente usa las voces
  // locales del navegador (comportamiento anterior).
  // ═══════════════════════════════════════════════════════════════════════════
  const EDGE_TTS_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
  // Version de Edge que se declara al servicio (si se queda vieja, responde 403)
  const EDGE_TTS_VERSION = "143.0.3650.75";
  const EDGE_TTS_MAJOR = EDGE_TTS_VERSION.split(".")[0];
  const EDGE_TTS_WSS = "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1";
  const EDGE_TTS_VOICES_URL = "https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/voices/list";
  const EDGE_TTS_TIMEOUT_MS = 14000;
  const EDGE_TTS_VOICE_DEFAULT = "es-MX-JorgeNeural";

  /** Token Sec-MS-GEC: SHA256 de (tics de Windows redondeados a 5 min + token fijo) */
  function edgeSecMsGec(): string {
    const WIN_EPOCH = 11644473600;
    let ticks = Date.now() / 1000 + WIN_EPOCH;
    ticks -= ticks % 300;
    return createHash("sha256")
      .update(`${Math.floor(ticks * 1e7)}${EDGE_TTS_TOKEN}`, "ascii")
      .digest("hex")
      .toUpperCase();
  }

  function edgeCabeceras(): Record<string, string> {
    return {
      "Pragma": "no-cache",
      "Cache-Control": "no-cache",
      "Origin": "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
      "Sec-WebSocket-Version": "13",
      "Accept-Encoding": "gzip, deflate, br, zstd",
      "Accept-Language": "en-US,en;q=0.9",
      "User-Agent": `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${EDGE_TTS_MAJOR}.0.0.0 Safari/537.36 Edg/${EDGE_TTS_MAJOR}.0.0.0`
    };
  }

  function xmlSeguro(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
  }

  /** Genera MP3 con las voces neuronales en linea de Edge. null si no se pudo. */
  async function synthesizeWithEdgeReadAloud(text: string, voice: string, speed = 1): Promise<{ body: Buffer; contentType: string } | null> {
    const voz = /^[a-z]{2}-[A-Z]{2}-\w+Neural$/.test(voice) ? voice : EDGE_TTS_VOICE_DEFAULT;
    const idioma = (voz.match(/^[a-z]{2}-[A-Z]{2}/) || ["es-MX"])[0];
    const url = `${EDGE_TTS_WSS}?TrustedClientToken=${EDGE_TTS_TOKEN}&Sec-MS-GEC=${edgeSecMsGec()}` +
      `&Sec-MS-GEC-Version=1-${EDGE_TTS_VERSION}&ConnectionId=${randomUUID()}`;

    return await new Promise((resolve) => {
      const trozos: Buffer[] = [];
      let cerrado = false;
      const terminar = (resultado: { body: Buffer; contentType: string } | null) => {
        if (cerrado) return;
        cerrado = true;
        clearTimeout(temporizador);
        try { ws.close(); } catch (_) {}
        resolve(resultado);
      };

      let ws: any;
      const temporizador = setTimeout(() => {
        console.warn(`[TTS-Edge] sin respuesta en ${EDGE_TTS_TIMEOUT_MS} ms`);
        terminar(null);
      }, EDGE_TTS_TIMEOUT_MS);

      try {
        ws = new WebSocket(url, { headers: edgeCabeceras() });
      } catch (err: any) {
        console.warn("[TTS-Edge] no pude abrir el socket:", err?.message);
        terminar(null);
        return;
      }

      ws.on("open", () => {
        const fecha = new Date().toString();
        ws.send(`X-Timestamp:${fecha}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n` +
          `{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},` +
          `"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}`);
        const porcentaje = Math.max(-50, Math.min(50, Math.round((Number(speed) || 1) - 1) * 100));
        const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${idioma}'>` +
          `<voice name='${voz}'><prosody pitch='+0Hz' rate='${porcentaje >= 0 ? "+" : ""}${porcentaje}%' volume='+0%'>` +
          `${xmlSeguro(text)}</prosody></voice></speak>`;
        ws.send(`X-RequestId:${randomUUID().replace(/-/g, "")}\r\nContent-Type:application/ssml+xml\r\n` +
          `X-Timestamp:${fecha}Z\r\nPath:ssml\r\n\r\n${ssml}`);
      });

      ws.on("message", (data: any, esBinario: boolean) => {
        try {
          if (esBinario) {
            const buf = Buffer.from(data);
            const largoCabecera = buf.readUInt16BE(0);
            trozos.push(buf.subarray(2 + largoCabecera));
          } else if (data.toString().includes("Path:turn.end")) {
            const cuerpo = Buffer.concat(trozos);
            terminar(cuerpo.length > 200 ? { body: cuerpo, contentType: "audio/mpeg" } : null);
          }
        } catch (err: any) {
          console.warn("[TTS-Edge] error leyendo el audio:", err?.message);
          terminar(null);
        }
      });

      ws.on("error", (err: any) => {
        console.warn("[TTS-Edge] error de conexion:", err?.message);
        terminar(null);
      });
      ws.on("close", () => terminar(null));
    });
  }

  // Lista de voces de Edge (se cachea 6 h: son 300+ voces)
  let edgeVoces: { at: number; lista: any[] } = { at: 0, lista: [] };
  async function obtenerVocesEdge(): Promise<any[]> {
    if (edgeVoces.lista.length > 0 && Date.now() - edgeVoces.at < 6 * 60 * 60 * 1000) return edgeVoces.lista;
    const url = `${EDGE_TTS_VOICES_URL}?trustedclienttoken=${EDGE_TTS_TOKEN}&Sec-MS-GEC=${edgeSecMsGec()}&Sec-MS-GEC-Version=1-${EDGE_TTS_VERSION}`;
    const res = await conLimite(fetch(url, { headers: { ...edgeCabeceras(), "Accept": "*/*" } }), 10000, "Voces de Edge");
    if (!res.ok) throw new Error(`Microsoft respondio HTTP ${res.status}`);
    const lista: any = await res.json();
    edgeVoces = { at: Date.now(), lista: Array.isArray(lista) ? lista : [] };
    return edgeVoces.lista;
  }

  app.get("/api/tts", async (req, res) => {
    const t0 = Date.now();
    try {
      const text = String(req.query.text || "").replace(/\s+/g, " ").trim().slice(0, 600);
      const voice = String(req.query.voice || "Puck");
      const style = String(req.query.style || "").slice(0, 220);
      const engine = String(req.query.engine || "");           // 'elevenlabs' | 'gemini' | '' (auto)
      const elvoice = String(req.query.elvoice || "");         // voice_id de ElevenLabs
      const edgevoice = String(req.query.edgevoice || "");     // voz neuronal de Edge (gratis)
      const speed = Math.max(0.7, Math.min(1.2, parseFloat(String(req.query.speed || "1")) || 1));
      if (!text) return res.status(400).json({ error: "Falta el parámetro text" });

      const cacheKey = `${engine}|${voice}|${elvoice}|${speed}|${style}|${text}`;
      const cached = ttsAudioCache.get(cacheKey);
      if (cached) {
        res.set({ "Content-Type": cached.contentType, "X-TTS-Cache": "hit" });
        return res.send(cached.body);
      }

      let result: { body: Buffer; contentType: string } | null = null;
      let provider = "none";

      // ── Selección de modelo y rotación de claves ─────────────────────────────
      // 1) Primero el modelo pedido por el cliente y, dentro de él, se rota por
      //    TODAS las claves guardadas (hasta 10) saltando las que estén sin cuota.
      // 2) Si ese modelo no tiene claves propias configuradas, se prueba el otro
      //    modelo que sí tenga claves (pasar al siguiente modelo de la lista).
      // 3) Si ningún modelo con claves pudo sintetizar, se responde 503 para que el
      //    cliente siga con el siguiente modelo de su lista de prioridad (voces
      //    locales). Solo si NO hay ninguna clave guardada se usa el respaldo
      //    robótico gratuito de Google Translate.
      const orden: Array<'elevenlabs' | 'gemini' | 'edge'> = engine === 'edge'
        ? ['edge']
        : engine === 'elevenlabs'
          ? ['elevenlabs', 'gemini', 'edge']
          : engine === 'gemini'
            ? ['gemini', 'elevenlabs', 'edge']
            : ((elvoice && elevenLabsKeys.length > 0) ? ['elevenlabs', 'gemini', 'edge'] : ['gemini', 'elevenlabs', 'edge']);

      for (const modelo of orden) {
        if (modelo === 'edge') {
          // Voz neuronal en linea de Edge: sin clave y sin costo
          result = await synthesizeWithEdgeReadAloud(text, edgevoice || voice, speed);
          if (result) { provider = 'edge'; break; }
        } else if (modelo === 'elevenlabs') {
          if (elevenLabsKeys.length === 0 || !elvoice) continue;
          result = await synthesizeWithElevenLabs(text, elvoice, speed);
          if (result) { provider = 'elevenlabs'; break; }
        } else {
          if (geminiTtsKeys.length === 0) continue;
          const restante = Math.max(3000, TTS_GEMINI_BUDGET_MS - (Date.now() - t0));
          result = await synthesizeWithGemini(text, voice, style, restante);
          if (result) { provider = 'gemini'; break; }
        }
      }

      const hayClaves = geminiTtsKeys.length > 0 || (elevenLabsKeys.length > 0 && !!elvoice);
      if (!result && hayClaves && engine !== 'edge') {
        // Hay claves guardadas pero ninguna pudo generar audio ahora mismo.
        const motivo = (geminiKeysExhausted || elevenLabsQuotaExhausted) ? 'quota' : 'error';
        console.warn(`[TTS] Ningun modelo con claves pudo sintetizar (${motivo}) en ${Date.now() - t0} ms: el cliente pasa al siguiente modelo`);
        res.set("X-TTS-Provider", "browser-fallback");
        res.set("X-TTS-Reason", motivo);
        return res.status(503).json({ error: "Ningun modelo de voz neuronal disponible ahora mismo" });
      }

      if (!result) {
        // Modo gratuito: no hay ninguna clave configurada. Respaldo Google Translate.
        // Los trozos se piden EN PARALELO: en serie una frase larga tardaba varios segundos.
        const chunks = splitTextForTts(text);
        const partes = await Promise.all(
          chunks.map((chunk) => fetchGoogleTranslateTts(chunk).catch((e) => {
            console.warn("[TTS] Trozo de Google Translate falló:", e?.message);
            return null;
          }))
        );
        const buffers = partes.filter((b): b is Buffer => !!b && b.length > 0);
        if (buffers.length === 0) throw new Error("Google Translate TTS no devolvió audio");
        result = { body: Buffer.concat(buffers), contentType: "audio/mpeg" };
        provider = "google-translate";
      }

      if (ttsAudioCache.size >= TTS_CACHE_MAX) {
        const oldest = ttsAudioCache.keys().next().value;
        if (oldest !== undefined) ttsAudioCache.delete(oldest);
      }
      ttsAudioCache.set(cacheKey, result);

      res.set({
        "Content-Type": result.contentType,
        "X-TTS-Provider": provider,
        "X-TTS-Ms": String(Date.now() - t0),
        "Cache-Control": "public, max-age=86400"
      });
      console.log(`[TTS] ${provider} · ${text.length} caracteres · ${Date.now() - t0} ms`);
      return res.send(result.body);
    } catch (err: any) {
      console.warn("[TTS] Error generando voz:", err?.message);
      return res.status(502).json({ error: "TTS no disponible" });
    }
  });

  // Lista de voces neuronales en linea de Edge (gratis, sin clave). Por defecto
  // solo las de español: son las que sirven para el asistente.
  app.get("/api/edge-voices", async (req, res) => {
    try {
      const todas = await obtenerVocesEdge();
      const espanol = todas.filter((v: any) => /^es-/i.test(String(v?.Locale || "")));
      const lista = (espanol.length > 0 ? espanol : todas).map((v: any) => ({
        name: String(v?.ShortName || ""),
        gender: String(v?.Gender || ""),
        locale: String(v?.Locale || "")
      })).filter((v: any) => v.name);
      res.json({ total: todas.length, spanish: espanol.length, default: EDGE_TTS_VOICE_DEFAULT, voices: lista });
    } catch (err: any) {
      // Si Microsoft no responde, la interfaz usa una lista corta de respaldo
      res.status(502).json({ error: err?.message || "No pude consultar las voces de Edge", default: EDGE_TTS_VOICE_DEFAULT });
    }
  });

  // Estado de las claves de API (nunca devuelve las claves completas, solo enmascaradas)
  app.get("/api/tts-key", (req, res) => {
    const quotaDead = geminiQuotaDeadUntil > Date.now();
    res.json({
      configured: geminiTtsKeys.length > 0,
      count: geminiTtsKeys.length,
      max: 10,
      masked: geminiTtsKeys.map(k => `${k.slice(0, 5)}••••••${k.slice(-4)}`),
      // Estado clave por clave: la interfaz muestra cual esta sin cuota
      keys: estadoDeClaves(geminiTtsKeys, geminiKeyState),
      // Para que la interfaz pueda avisar POR QUE las voces de Google no suenan
      quotaExhausted: quotaDead,
      quotaRetryInSeconds: quotaDead ? Math.max(0, Math.round((geminiQuotaDeadUntil - Date.now()) / 1000)) : 0,
      lastError: String(lastGeminiTtsError || "").slice(0, 200)
    });
  });

  // Guarda hasta 10 claves desde la UI, las persiste en .env y valida la primera
  app.post("/api/tts-key", async (req, res) => {
    try {
      const raw = String(req.body?.keys ?? req.body?.key ?? "");
      const keys = parseGeminiKeys(raw.replace(/^["']|["']$/g, "")).slice(0, 10);
      if (keys.length === 0) return res.status(400).json({ error: "Falta la clave" });
      const tooShort = keys.some(k => k.length < 20);
      if (tooShort) return res.status(400).json({ error: "Alguna clave parece demasiado corta" });

      geminiTtsKeys = keys;
      workingKeyIdx = 0;
      geminiKeysExhausted = false;
      geminiKeyState.clear(); // claves nuevas: olvidar marcas de cuota agotada
      try {
        persistGeminiApiKeys(keys);
      } catch (err: any) {
        console.warn("[TTS-Key] No se pudo escribir el .env:", err?.message);
      }

      // Validación real solo de la PRIMERA clave (probar todas gastaría cuota).
      // Clave válida aunque su cuota esté agotada (429) o la respuesta venga sin audio.
      let firstKeyValid = false;
      let quotaExceeded = false;
      let keyRejected = false;
      try {
        const { GoogleGenAI } = await import("@google/genai");
        const ai = new GoogleGenAI({ apiKey: keys[0] });
        const response = await ai.models.generateContent({
          model: GEMINI_TTS_MODELS[0],
          contents: [{ role: "user", parts: [{ text: "Prueba de voz." }] }],
          config: {
            responseModalities: ["AUDIO"],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } } }
          } as any
        });
        const part = response.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData?.data);
        firstKeyValid = !!(part as any)?.inlineData?.data;
        if (!firstKeyValid) quotaExceeded = true; // 200 sin audio = cuota de audio agotada
      } catch (err: any) {
        const msg = err?.message || "";
        if (/API_KEY_INVALID|API key not valid|401|403/.test(msg)) keyRejected = true;
        else if (/RESOURCE_EXHAUSTED|429/.test(msg)) quotaExceeded = true;
        else console.warn("[TTS-Key] Validación sin clasificar:", msg.slice(0, 200));
      }

      return res.json({
        saved: true,
        count: keys.length,
        valid: firstKeyValid || quotaExceeded,
        quota: quotaExceeded,
        rejected: keyRejected
      });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || "Error guardando las claves" });
    }
  });

  // Estado de las claves de ElevenLabs (enmascaradas)
  app.get("/api/eleven-key", (req, res) => {
    res.json({
      configured: elevenLabsKeys.length > 0,
      count: elevenLabsKeys.length,
      max: 10,
      masked: elevenLabsKeys.map(k => `${k.slice(0, 5)}••••••${k.slice(-4)}`),
      // Estado clave por clave (cual esta sin caracteres o invalida)
      keys: estadoDeClaves(elevenLabsKeys, elevenKeyState),
      quotaExhausted: elevenLabsQuotaExhausted,
      lastError: String(lastElevenError || "").slice(0, 200)
    });
  });

  // Guarda hasta 10 claves de ElevenLabs desde la UI y valida la primera
  app.post("/api/eleven-key", async (req, res) => {
    try {
      const raw = String(req.body?.keys ?? req.body?.key ?? "");
      const keys = parseElevenKeys(raw.replace(/^["']|["']$/g, "")).slice(0, 10);
      if (keys.length === 0) return res.status(400).json({ error: "Falta la clave" });
      const badFormat = keys.find(k => !k.startsWith("sk_"));
      if (badFormat) return res.status(400).json({ error: "Las claves de ElevenLabs empiezan con sk_" });

      // Validación real solo de la primera clave contra su API
      const check = await fetch("https://api.elevenlabs.io/v1/user/subscription", {
        headers: { "xi-api-key": keys[0] }
      });
      if (!check.ok) {
        return res.status(400).json({ saved: false, valid: false, error: "ElevenLabs rechazó la primera clave (inválida o revocada)" });
      }
      const sub: any = await check.json();

      elevenLabsKeys = keys;
      workingElevenIdx = 0;
      elevenLabsQuotaExhausted = false;
      elevenKeyState.clear(); // claves nuevas: olvidar marcas de cuota agotada
      try {
        persistElevenLabsApiKeys(keys);
      } catch (err: any) {
        console.warn("[ElevenLabs-Key] No se pudo escribir el .env:", err?.message);
      }

      return res.json({
        saved: true,
        count: keys.length,
        valid: true,
        charactersRemaining: Math.max(0, (sub?.character_limit || 0) - (sub?.character_count || 0))
      });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || "Error validando las claves" });
    }
  });

  // Lista de voces disponibles en las cuentas de ElevenLabs (UNE todas las claves:
  // voces agregadas de la Biblioteca en cada cuenta aparecen aunque esté repetida en otra)
  app.get("/api/eleven-voices", async (req, res) => {
    if (elevenLabsKeys.length === 0) return res.status(400).json({ error: "Sin clave de ElevenLabs" });
    try {
      const byId = new Map<string, { id: string; name: string; accent: string; gender: string; category: string }>();
      // Categorías admitidas: premade (de fábrica) y cloned/generated (voces de la
      // Biblioteca de voces agregadas a la cuenta, que antes se filtraban y por
      // eso nunca aparecían en el programa)
      const okCategories = new Set(["premade", "cloned", "generated"]);
      for (const apiKey of elevenLabsKeys) {
        try {
          const r = await fetch("https://api.elevenlabs.io/v1/voices", {
            headers: { "xi-api-key": apiKey }
          });
          if (!r.ok) continue; // clave inválida o sin acceso: seguir con las demás cuentas
          const data: any = await r.json();
          for (const v of (data.voices || [])) {
            if (!okCategories.has(v.category)) continue;
            if (byId.has(v.voice_id)) continue;
            byId.set(v.voice_id, {
              id: v.voice_id,
              name: v.name.replace(/ - .*/, ""),
              accent: v.labels?.accent || "",
              gender: v.labels?.gender || "",
              category: v.category || ""
            });
          }
        } catch (_) { /* cuenta inaccesible: seguir con las demás */ }
      }
      // De fábrica primero, luego las de la Biblioteca; ambas ordenadas por nombre
      const voices = [...byId.values()].sort((a, b) =>
        a.category === b.category
          ? a.name.localeCompare(b.name)
          : (a.category === "premade" ? -1 : 1)
      );
      if (voices.length === 0) return res.status(502).json({ error: "Ninguna cuenta devolvió voces" });
      return res.json({ voices });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || "Error listando voces" });
    }
  });

  // ═══ Carga en lote: pega texto mezclado (nombres, etiquetas, claves) y la app
  // extrae automáticamente las claves por su formato:
  //   sk_...            → ElevenLabs
  //   AQ.... / AIza...  → Gemini
  // Las claves nuevas se AÑADEN a las existentes (sin duplicados, máx. 10 por proveedor).
  app.post("/api/tts-keys-bulk", async (req, res) => {
    try {
      const text = String(req.body?.text || "");
      if (!text.trim()) return res.status(400).json({ error: "Falta el texto" });

      const tokens: string[] = text.match(/\b(?:sk_[A-Za-z0-9]{20,}|AQ\.[A-Za-z0-9_-]{10,}|AIza[0-9A-Za-z_-]{30,})\b/g) || [];
      const elevenNew = [...new Set(tokens.filter((t): boolean => t.startsWith("sk_")))];
      const geminiNew = [...new Set(tokens.filter((t): boolean => !t.startsWith("sk_")))];

      // Añadir sin duplicar, respetando el tope de 10 por proveedor
      const merge = (current: string[], incoming: string[]) => {
        const added = incoming.filter(k => !current.includes(k)).length;
        const out = [...current];
        for (const k of incoming) {
          if (out.length >= 10) break;
          if (!out.includes(k)) out.push(k);
        }
        return { out, added };
      };

      const rE = merge(elevenLabsKeys, elevenNew);
      const rG = merge(geminiTtsKeys, geminiNew);
      elevenLabsKeys = rE.out;
      geminiTtsKeys = rG.out;
      workingElevenIdx = 0;
      workingKeyIdx = 0;
      elevenLabsQuotaExhausted = false;
      geminiKeysExhausted = false;

      try {
        persistElevenLabsApiKeys(elevenLabsKeys);
        persistGeminiApiKeys(geminiTtsKeys);
      } catch (err: any) {
        console.warn("[TTS-Bulk] No se pudo escribir el .env:", err?.message);
      }

      const ignored = tokens.length - elevenNew.length - geminiNew.length;
      return res.json({
        saved: true,
        eleven: { count: elevenLabsKeys.length, added: rE.added },
        gemini: { count: geminiTtsKeys.length, added: rG.added },
        detected: tokens.length,
        ignored
      });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || "Error procesando el lote" });
    }
  });

  // Vite middleware in development mode, static in production mode.
  // Se usa .trim() porque al definir la variable desde cmd
  // ("set NODE_ENV=production && node ...") el valor puede quedar con un espacio.
  const modoProduccion = (process.env.NODE_ENV || "").trim() === "production";
  if (!modoProduccion) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`SerchTube Music full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
