import { VoicePersonality } from '../types';

export function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

// Rich, cheerful, friendly, enthusiastic, and witty phrases for wake word greetings
// STRICT RULE: NEVER include the wake word ("música" / "musica") in greetings so the speakers don't reopen the mic
export const WAKE_GREETINGS: Record<VoicePersonality, string[]> = {
  // 🛡️ REGLA ESTRICTA: saludos SIEMPRE cortos (1-4 palabras). Los nodos satélite
  // también capturan la voz del asistente por sus micrófonos; frases largas
  // aumentan el riesgo de reactivarlos o de ser procesadas como comandos.
  animada: [
    "¡Dime!",
    "¡Te escucho!",
    "¡Aquí estoy!",
    "¡Dímelo!",
    "¿Qué ponemos?",
    "¡Epa! Dime.",
    "¡Listo!",
    "¡Sí, jefe?",
    "Adelante.",
    "¿Qué pongo?"
  ],
  directa: [
    "Dime.",
    "Te escucho.",
    "Aquí estoy.",
    "¿Qué ponemos?",
    "Listo.",
    "Adelante.",
    "Sí.",
    "¿Qué pongo?"
  ],
  conductor: [
    "Dime, conductor.",
    "Te escucho.",
    "Copiloto listo.",
    "¿Qué ponemos?",
    "Aquí estoy.",
    "Ruta clara. Dime."
  ],
  copiloto_rally: [
    "¡Copiloto listo!",
    "¡Dime!",
    "Te escucho.",
    "¡A fondo! Dime.",
    "¿Qué ponemos?"
  ],
  locutor_fm: [
    "Al aire. Dime.",
    "Te escuchamos.",
    "¿Qué suena?",
    "En antena. Dime.",
    "Adelante, oyente."
  ],
  calida: [
    "Dime.",
    "Te escucho.",
    "Aquí estoy.",
    "¿Qué ponemos?",
    "Claro, dime.",
    "Listo. Dime."
  ],
  jarvis: [
    "A su orden.",
    "Sistemas listos.",
    "Le escucho.",
    "Dígale.",
    "En línea. Adelante."
  ],
  zen: [
    "Te escucho.",
    "En calma. Dime.",
    "Aquí estoy.",
    "Dime con calma."
  ],
  formal: [
    "A su disposición.",
    "Le escucho.",
    "Dígame.",
    "Indique su orden."
  ],
  cyberpunk: [
    "Enlace abierto.",
    "Listo. Dime.",
    "Te escucho.",
    "Canal activo. Dime."
  ]
};

// Generates enthusiastic, cheerful, friendly, and funny speech responses for any action
export function getEnthusiasticFeedback(
  action: string,
  target: string = '',
  personality: VoicePersonality = 'animada',
  extra?: { volume?: number; preset?: string }
): string {
  // 🛡️ Filtro estricto: Eliminar cualquier palabra clave como "música" del target
  // para que los altavoces de la PC nunca la digan y el micrófono no se vuelva a abrir.
  const sanitizedTarget = (target || '')
    .replace(/\b(?:la\s+)?m[uú]sica\s+de\b/gi, 'canciones de ')
    .replace(/\bla\s+m[uú]sica\b/gi, 'las canciones')
    .replace(/\b(?:m[uú]sica[s]?|m[uú]siquita|m[uú]sic[oó]n|music)\b/gi, 'canción')
    .trim();

  const cleanTarget = sanitizedTarget || 'tu selección';
  const vol = extra?.volume ?? 70;
  const preset = extra?.preset || 'Hi-Fi';

  const bank: Record<string, Record<string, string[]>> = {
    play: {
      animada: [
        `¡Oído cocina, jefe! ¡Marchando ese temazo de ${cleanTarget} con todo el sabor!`,
        `¡Uff qué buen gusto tienes! Poniéndote ${cleanTarget} para reventar los altavoces de pura fiesta.`,
        `¡Vámonos que nos vamos! Dale caña a ${cleanTarget}, ¡a cantar a grito pelado!`,
        `¡A sus órdenes, comandante del ritmo! Desplegando ${cleanTarget} para alegrarte el día.`,
        `¡Temazo legendario a la vista! Poniendo ${cleanTarget} con toda la buena vibra.`,
        `¡Marchando esa joya: ${cleanTarget}! Si te sabes la letra, ¡te toca cantarla entera!`,
        `¡Eso sí que es un temazo con ritmo y salero! Sonando fuerte ${cleanTarget}.`,
        `¡Petición concedida con una sonrisa! A disfrutar al máximo de ${cleanTarget}.`,
        `¡Suelten los decibelios, que aquí llega ${cleanTarget} para poner esto en órbita!`,
        `¡Dale volumen y pásala en grande! Arrancando con ${cleanTarget}.`,
        `¡Preparando los tímpanos para una dosis de felicidad pura con ${cleanTarget}!`,
        `¡Así se viaja con estilo! Disfruta a todo pulmón de ${cleanTarget}.`,
        `¡Alegría pura para el cuerpo! Poniéndote ${cleanTarget} ahora mismo.`,
        `¡Qué gran elección! Aquí tienes ${cleanTarget} para ponerle fiesta al momento.`
      ],
      directa: [
        `¡Oído! Marchando ${cleanTarget} con toda la energía.`,
        `¡Reproduciendo ${cleanTarget}! A darle ritmo.`,
        `¡Temazo listo! Sonando ${cleanTarget} en altavoces.`,
        `¡En marcha con ${cleanTarget}!`,
        `¡Petición en marcha: ${cleanTarget}!`
      ],
      calida: [
        `¡Qué maravillosa elección! Disfruta muchísimo de ${cleanTarget}.`,
        `Poniendo ${cleanTarget} con todo el cariño para acompañarte.`,
        `¡Me encanta esta canción! Aquí tienes ${cleanTarget} para alegrarte el momento.`,
        `Qué bonito tema has elegido. A disfrutar juntos de ${cleanTarget}.`
      ],
      copiloto_rally: [
        `¡Acelerador a fondo y temazo en cabina! ¡Lanzando ${cleanTarget}!`,
        `¡Curva cerrada con el ritmo de ${cleanTarget} a toda pastilla!`,
        `¡Gas a fondo y que ruja ${cleanTarget} en los altavoces!`
      ],
      locutor_fm: [
        `¡Y para todos ustedes en directo, aquí llega el gran éxito ${cleanTarget}!`,
        `¡Suban esos decibelios que arranca el temazo ${cleanTarget}!`,
        `¡Lo pediste en SerchTube y aquí lo tienes sonando a toda potencia: ${cleanTarget}!`
      ],
      conductor: [
        `Ruta despejada y temazo en marcha: reproduciendo ${cleanTarget}.`,
        `Audio al volante: sonando ${cleanTarget} para amenizar el trayecto.`,
        `Audio confirmado en cabina: ${cleanTarget} en altavoces.`
      ]
    },
    pause: {
      animada: [
        `¡Pausado! Aquí te espero.`,
        `¡Pausa al canto! En espera.`,
        `¡Reproducción en pausa!`,
        `¡Pausa lista, avísame cuando sigamos!`
      ],
      directa: [
        `¡Pausado!`,
        `Pausa lista.`,
        `Reproducción en pausa.`
      ],
      calida: [
        `Pausado con gusto, tómate tu tiempo.`,
        `Pista en pausa para ti.`,
        `Pausado, aquí te espero con agrado.`
      ],
      copiloto_rally: [
        `¡Pausa en cabina!`,
        `¡Audio en pausa!`
      ],
      locutor_fm: [
        `¡Pausa en las ondas de SerchTube!`,
        `¡Pausa en cabina de emisión!`
      ],
      formal: [
        `Reproducción pausada correctamente.`,
        `Pausa establecida con gusto.`
      ],
      zen: [
        `Pausa en serenidad.`,
        `Audio en pausa armónica.`
      ],
      conductor: [
        `Pausado en carretera.`,
        `Audio en pausa al volante.`
      ],
      jarvis: [
        `Reproducción pausada, señor.`,
        `Sistema en pausa.`
      ],
      cyberpunk: [
        `Canal en pausa.`,
        `Reproducción congelada en memoria.`
      ]
    },
    resume: {
      animada: [
        `¡Se acabó la espera, vuelve el fiestón! ¡A romper la pista!`,
        `¡De nuevo a la carga! ¡Que no decaiga ese ánimo nunca!`,
        `¡Reanudando el ritmo! ¡A gozarla como se merece!`,
        `¡Volvemos con las pilas recargadas! Dale gas al sonido.`,
        `¡Continuamos el viaje con toda la energía del mundo!`,
        `¡Vuelve la alegría a los altavoces! ¡Que siga la marcha!`
      ],
      directa: [
        `¡Reanudando con todo el ritmo!`,
        `¡De vuelta al sonido! Continuando con ${cleanTarget}.`,
        `¡Pista de nuevo en marcha!`
      ],
      calida: [
        `¡Qué alegría volver a escucharlo! Reanudando ${cleanTarget} para ti.`,
        `¡De vuelta con las canciones para alegrarte el día!`
      ],
      copiloto_rally: [
        `¡Bandera verde! ¡Gas a fondo con ${cleanTarget}!`,
        `¡Reanudamos la carrera con todo el sonido!`
      ],
      locutor_fm: [
        `¡Regresamos a las ondas con toda la potencia de ${cleanTarget}!`,
        `¡Volvemos al ritmo en directo sin parar!`
      ]
    },
    next: {
      animada: [
        `¡Pista despachada! A ver qué joyita te tengo preparada ahora...`,
        `¡Siguiente temazo en camino, agárrate que vienen curvas y mucho ritmo!`,
        `¡Cambiando de tercio! A ver con qué temazo te sorprendo ahora.`,
        `¡Saltando de canción! El que no salte no tiene ritmo, ¡vamos con la siguiente!`,
        `¡Fuera la anterior, bienvenido el siguiente bombazo!`,
        `¡Avanzando de pista con alegría y mucho swing!`
      ],
      directa: [
        `¡Pasando al siguiente temazo!`,
        `¡Siguiente canción en camino!`,
        `¡Avanzando de pista con energía!`
      ],
      calida: [
        `Pasando a la siguiente canción con mucho cariño para ti.`,
        `¡A ver qué bonito tema nos toca escuchar ahora!`
      ],
      copiloto_rally: [
        `¡Cambio de marcha y nuevo temazo en pista!`,
        `¡Adelantando a la siguiente canción a toda velocidad!`
      ],
      locutor_fm: [
        `¡Y en la sintonía de SerchTube, damos paso al siguiente exitazo!`,
        `¡Saltamos al próximo temazo en antena!`
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
        `¡Retrocediendo pista!`,
        `¡De vuelta al tema anterior!`
      ],
      calida: [
        `Volviendo a la canción anterior con mucho gusto para ti.`,
        `¡A disfrutar de nuevo de ese tema tan bonito!`
      ]
    },
    volume_up: {
      animada: [
        `¡Subiendo decibelios! ¡Que tiemblen las ventanas con este ritmo!`,
        `¡Más volumen para el cuerpo! ¡A tope con ese temazo!`,
        `¡Potencia arriba! ¡Que se enteren todos de nuestro buen gusto!`,
        `¡Subiendo la potencia sonora! ¡Esto se baila con ganas!`,
        `¡Más candela a los altavoces! A disfrutar a todo volumen.`
      ],
      directa: [
        `¡Subiendo volumen con energía!`,
        `¡Más volumen listo!`,
        `¡Decibelios arriba!`
      ],
      calida: [
        `Subiendo el volumen con gusto para que lo escuches de maravilla.`,
        `¡Un poquito más de volumen para disfrutarlo mejor!`
      ]
    },
    volume_down: {
      animada: [
        `¡Bajando un pelín el volumen para conversar como personas civilizadas!`,
        `¡Volumen bajado! Suavecito y relajado para cuidar esos oídos de oro.`,
        `¡Menos decibelios, más relax! Listo el volumen suave.`,
        `¡Bajando la potencia para que puedas charlar a gusto sin gritar!`
      ],
      directa: [
        `¡Volumen bajado!`,
        `¡Bajando potencia de sonido!`,
        `Nivel de sonido más suave.`
      ],
      calida: [
        `Bajando el volumen con gusto para que estés más cómodo.`,
        `Listo, volumen más suave y tranquilo.`
      ]
    },
    volume_set: {
      animada: [
        `¡Volumen colocado exactamente en nivel ${vol}! ¡Nivel impecable para disfrutar!`,
        `¡Sonido ajustado al nivel ${vol}! Listo para seguir con toda la vibra.`,
        `¡A sus órdenes! Volumen en el ${vol}, ¡a gozarla sin medida!`
      ],
      directa: [
        `¡Volumen en nivel ${vol}!`,
        `Nivel fijado en ${vol}.`
      ]
    },
    mute: {
      animada: [
        `¡Modo ninja activado! Calladito me quedo, no digo ni mu.`,
        `¡Mute al canto! Silencio total hasta que me pidas más fiesta.`,
        `¡Audio en mudo! Calladito como estatua de cera.`,
        `¡Silencio sepulcral! Me hago el dormido hasta que des la orden.`
      ],
      directa: [
        `¡Audio silenciado!`,
        `¡Modo silencio activo!`
      ],
      calida: [
        `Audio silenciado con gusto, avísame cuando quieras que regrese el sonido.`,
        `Listo, todo en silencio para tu tranquilidad.`
      ]
    },
    unmute: {
      animada: [
        `¡Sonido de vuelta! ¡Se rompió el silencio, que viva la fiesta!`,
        `¡Reactivando altavoces! ¡Que fluya de nuevo la energía y el buen sonido!`,
        `¡De vuelta al aire! Aquí volvemos con toda la potencia para gozar.`
      ],
      directa: [
        `¡Sonido reactivado!`,
        `¡Audio encendido de nuevo!`
      ],
      calida: [
        `¡Qué bueno tener el sonido de vuelta! A seguir disfrutando.`,
        `¡Sonido restaurado con mucho gusto!`
      ]
    },
    repeat: {
      animada: [
        `¡En bucle infinito! Cuando un tema es una obra de arte, ¡se repite sin culpa!`,
        `¡Otra vez la misma! Si te hace feliz, ¡la repetimos hasta que te la aprendas de memoria!`
      ],
      directa: [
        `¡Repitiendo temazo!`,
        `¡Canción en bucle!`
      ]
    },
    fullscreen_on: {
      animada: [
        `¡Pantalla completa activada! ¡Todo el espectáculo a pantalla gigante!`,
        `¡A pantalla completa! Que no se escape ningún detalle visual.`
      ],
      directa: [
        `¡Pantalla completa activada!`,
        `¡Modo pantalla completa!`
      ]
    },
    fullscreen_off: {
      animada: [
        `¡Volvemos a vista compacta! Todo bajo control en la cabina.`,
        `¡Pantalla reducida lista!`
      ],
      directa: [
        `¡Saliendo de pantalla completa!`,
        `Pantalla estándar.`
      ]
    },
    screensaver_start: {
      animada: [
        `¡Activando protector de pantalla para descansar la vista! Que el sonido siga volando.`,
        `¡Luces fuera, sonido dentro! Modo OLED activo para tu relax.`
      ],
      directa: [
        `¡Protector de pantalla activado!`,
        `Modo pantalla OLED activo.`
      ]
    },
    screensaver_stop: {
      animada: [
        `¡Bienvenido de vuelta a la luz! Aquí tienes de nuevo la consola lista.`,
        `¡Desactivando protector, pantalla lista para la acción!`
      ],
      directa: [
        `¡Protector desactivado!`,
        `Pantalla normal lista.`
      ]
    },
    show_qr: {
      animada: [
        `¡Aquí tienes el código QR! Tienes 10 segundos para escanear y conectar tu teléfono.`,
        `¡Desplegando código QR de vinculación por 10 segundos! ¡Apunta tu cámara!`
      ],
      directa: [
        `Mostrando código QR de vinculación durante 10 segundos.`,
        `Código QR en pantalla por 10 segundos.`
      ]
    }
  };

  const actionGroup = bank[action] || bank.play;
  const personalityList =
    actionGroup[personality] ||
    actionGroup.animada ||
    actionGroup.directa ||
    Object.values(actionGroup)[0];

  return pickRandom(personalityList);
}
