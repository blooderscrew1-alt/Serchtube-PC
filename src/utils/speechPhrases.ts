import { VoicePersonality } from '../types';

export function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

// Rich, cheerful, friendly, enthusiastic, and witty phrases for wake word greetings
// STRICT RULE: NEVER include the wake word ("música" / "musica") in greetings so the speakers don't reopen the mic
export const WAKE_GREETINGS: Record<VoicePersonality, string[]> = {
  animada: [
    "¡Dime, jefe supremo del ritmo! ¿Qué temazo marchamos hoy?",
    "¡A tus órdenes! Pídeme lo que quieras antes de que me ponga a cantar yo solo.",
    "¡Oído cocina! ¿Qué canción quieres que reviente los altavoces de alegría?",
    "¡Aquí estoy, vivito, coleando y con ganas de fiesta! ¿Qué escuchamos?",
    "¡Dímelo cantando o dímelo hablando, pero dime tu temazo ya!",
    "¡Uy, me llamaste! Dime qué temazo ponemos para alegrarte el día.",
    "¡Activado y con las pilas puestas! ¿Qué te apetece gozar hoy?",
    "¡A la orden, capitán del sonido! ¿Qué ritmo le echamos al asunto?",
    "¡Suelto el micrófono para ti! Pide esa canción que te pone la piel de gallina.",
    "¡Dime tú, que hoy pongo yo los temazos y tú la fiesta!",
    "¡Epa! Aquí estoy. Pide por esa boquita...",
    "¡Hola, estrella del camino! ¿Qué temazo va a sonar con todo hoy?",
    "¡Te escucho al cien por cien! Sorpréndeme con tu selección.",
    "¡Preparado! Pídeme lo que quieras y le damos caña al viaje.",
    "¡Sintonizado y listo para la marcha! Dime qué temita marchamos.",
    "¡Dime, genio del ritmo! ¿Con qué éxito deleitamos al público hoy?"
  ],
  directa: [
    "¡A tus órdenes! ¿Qué temazo ponemos?",
    "¡Oído! Dime qué canción marchamos.",
    "¡Listo para darle ritmo! Te escucho...",
    "¡Dime la canción y le damos caña!",
    "¡Aquí estoy! Dime qué escuchamos hoy.",
    "¡Venga ese comando! ¿Qué canción quieres?",
    "¡Al habla SerchTube! Dime tu tema favorito.",
    "¡Te escucho con ganas! ¿Qué ponemos?",
    "¡A la orden! Dime artista o canción.",
    "¡Preparado! Suelta tu orden."
  ],
  conductor: [
    "¡Al volante y atento a la ruta! Dime qué canción ponemos para amenizar el viaje.",
    "¡Copiloto en línea! Dime qué temazo suena en carretera hoy.",
    "¡Ruta despejada y oídos listos! ¿Qué temazo marchamos, conductor?",
    "¡Comando en carretera! Dime el artista o tema y mantén la vista al frente.",
    "¡En cabina y a la escucha! ¿Qué éxito te acompaña en este viaje?",
    "¡Rumbo al destino con el mejor ritmo! Te escucho, dime tu tema.",
    "¡Carretera y manta! Dime qué canción pongo para devorar kilómetros."
  ],
  copiloto_rally: [
    "¡A la escucha en cabina, dime qué temazo metemos a fondo!",
    "¡Copiloto listo, pídeme marcha y aceleramos con ritmo!",
    "¡Listos para acelerar en la siguiente curva! ¿Qué canción quieres?",
    "¡Bandera verde en el velocímetro! Pide canción y no sueltes el pedal.",
    "¡Gas a fondo y ritmo en los altavoces! ¿Qué tema marchamos, piloto?",
    "¡Tramo cronometrado con ritmo! Dime qué temazo lanzamos."
  ],
  locutor_fm: [
    "¡Sintonía abierta en SerchTube Radio! ¿Qué tema quieres que suene en las ondas hoy?",
    "¡Micrófono encendido en directo! Pide tu canción favorita, ¡somos todo oídos!",
    "¡En cabina y en antena! ¿Cuál es la petición estrella del día?",
    "¡Saludos a todos los oyentes de la cabina! Dime tu tema y lo pinchamos ya mismo.",
    "¡El mejor sonido de las ondas a tu servicio! Dime qué éxito suena hoy.",
    "¡Estás en el número uno del dial! Pide tu canción y sube los decibelios."
  ],
  calida: [
    "¡Hola! Qué gusto saludarte, ¿qué bonita canción te gustaría escuchar hoy?",
    "¡Te escucho con todo el gusto del mundo! Dime qué canción te alegra el día.",
    "¡Aquí estoy para acompañarte! Pídeme lo que quieras escuchar.",
    "¡Qué alegría tenerte aquí! Dime tu canción favorita y la disfrutamos juntos.",
    "¡Todo listo para ti! Cuéntame qué melodía te apetece hoy.",
    "¡Dime qué ponemos para que este momento sea inolvidable!"
  ],
  jarvis: [
    "Sistemas listos y optimizados. Indique la pieza sonora a decodificar.",
    "Módulo de voz activo y con los sensores calibrados. Le escucho, señor.",
    "Consola acústica a la espera de su instrucción. ¿Qué frecuencia desplegamos?",
    "Procesador auditivo en línea. Transmita el vector de audio requerido.",
    "Protocolo de entretenimiento iniciado. Indique qué obra interpretamos."
  ],
  zen: [
    "En calma y atención serena... te escucho con armonía. ¿Qué melodía te llama?",
    "Fluyendo en el momento presente... dime qué melodía necesita tu alma.",
    "Respirando hondo y en paz... comparte conmigo qué deseas escuchar.",
    "El ambiente está listo para recibir tu melodía. Dime con suavidad."
  ],
  formal: [
    "A su entera disposición. ¿Qué selecta pieza desea escuchar en este momento?",
    "Le escucho con la mayor cortesía y diligencia. Indique su petición.",
    "Un verdadero honor asistirle. ¿Qué canción o artista complacería sus oídos?",
    "Sistema preparado para satisfacer su selección. Le escucho con atención."
  ],
  cyberpunk: [
    "Enlace neuronal de audio abierto. Transmite el paquete sonoro a ejecutar.",
    "Canal de audio acoplado en la red. ¿Qué track de sintetizadores inyectamos?",
    "Puerto auditivo listo. Dime qué frecuencia de neón disparamos en cabina."
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
        `¡Pausa al canto! Respira hondo que enseguida volvemos a la carga.`,
        `¡Frenazo sonoro! Aquí te guardo el sitio, avisa cuando quieras marcha.`,
        `¡Pista congelada! No te vayas lejos, que la fiesta sigue cuando digas.`,
        `¡Pausa técnica de campeonato! Descanso merecido para los tímpanos.`,
        `¡Silenciador al canto! Quédate tranquilo que aquí te espero con las pilas puestas.`,
        `¡Paramos un segundito! Aprovecha para tomar aire o contar un chiste.`
      ],
      directa: [
        `¡Pausado! Pista en espera.`,
        `Pausa lista, aquí te espero.`,
        `Reproducción en pausa.`
      ],
      calida: [
        `Pausando ${cleanTarget} con gusto, tómate todo el tiempo que necesites.`,
        `Pista en pausa para ti, aquí te espero con una sonrisa.`,
        `Pausadito, avísame cuando quieras volver a escucharla.`
      ],
      copiloto_rally: [
        `¡Freno de mano puesto! ¡Parada técnica de audio en boxes!`,
        `¡Bandera amarilla! Audio en pausa en cabina.`
      ],
      locutor_fm: [
        `¡Hacemos una breve pausa publicitaria imaginaria con ${cleanTarget}!`,
        `¡Pausa en las ondas de SerchTube, enseguida volvemos!`
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
