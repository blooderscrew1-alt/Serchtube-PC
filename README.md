<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/0c647d84-b0f4-46e5-afaa-4f3014fdd9a2

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Arranque en una sola ventana (Windows)

Al encender la PC, Edge puede restaurar las pestañas de la sesión anterior y
terminar abriendo SerchTube varias veces. Para que eso no pase, arranca siempre
desde el lanzador:

- Doble clic en `Iniciar SerchTube.bat`, o
- `npm run iniciar`, o
- `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\start-serchtube.ps1`

El lanzador ([scripts/start-serchtube.ps1](scripts/start-serchtube.ps1)):

1. Si el servidor ya responde en `http://localhost:3000/api/health`, no arranca
   otro (evita duplicar procesos y el error de puerto ocupado). Si no responde,
   lo inicia oculto y registra todo en `logs/servidor.log`.
2. Abre Edge con un **perfil dedicado** (`%LOCALAPPDATA%\SerchTubeEdge`, aislado
   de tu Edge normal) en **modo app**: una sola ventana, sin barra de pestañas y
   sin restaurar la sesión del navegador.
3. Si ya hay una ventana de SerchTube abierta con ese perfil, la trae al frente
   y **no abre otra**, así que puedes ejecutarlo cuantas veces quieras
   (arranque de Windows, doble clic, script propio).
4. Registra SerchTube en el **autoinicio de Windows** la primera vez que lo
   ejecutas (una sola vez; después no toca nada más).

## Arranque automático al encender la PC

Con la primera ejecución manual del `.bat` ya queda todo listo: el lanzador crea
un acceso directo en la carpeta **Inicio** del usuario
(`shell:startup\SerchTube Music.lnk`) que apunta a
[scripts/start-serchtube-silencioso.vbs](scripts/start-serchtube-silencioso.vbs).
Ese guion lanza el `.ps1` **sin ninguna ventana de consola**, espera 15 segundos
a que Windows termine de iniciar sesión, arranca el servidor si hace falta y abre
la única ventana de Edge. Ya no hay que abrir nada a mano ni apuntar accesos
directos propios.

- Desactivarlo: doble clic en `Quitar autoinicio de SerchTube.bat`
  (o `-QuitarAutoInicio`). Se puede volver a activar volviendo a ejecutar el
  `.bat` de arranque.
- No registrarlo nunca: `-SinAutoInicio`.
- Cambiar la espera del arranque: `-RetardoSegundos 25`.
- Traza de cada arranque: `logs/lanzador.log` (y `logs/servidor.log`).
- La entrada aparece en **Administrador de tareas → Aplicaciones de inicio** como
  `SerchTube Music`, y se puede desactivar también desde ahí.

Opciones:

- `-Modo pestana` → una pestaña normal en lugar de la ventana en modo app.
- `-AutoconcederMicro` → concede el micrófono automáticamente (modo kiosco/voz).
- `-SinNavegador` → solo comprueba/arranca el servidor, sin abrir Edge.
- `-SinAutoInicio` / `-QuitarAutoInicio` → no registrar / quitar del autoinicio.
- `-RepararPerfil` → cierra ese Edge y aparta el perfil dañado (crea uno limpio).
  También en `Reparar perfil de Edge.bat`.
- `-PerfilNormal` → usa tu perfil habitual de Edge (sin `--user-data-dir`), plan B.
- `-Puerto 3000`, `-PerfilEdge <ruta>`, `-EsperaServidor <segundos>`,
  `-RetardoSegundos <segundos>`.

### Una sola ventana, sin errores de "directorio de datos"

El lanzador evita el mensaje *"Microsoft Edge no puede leer ni escribir en el
directorio de datos"*, que aparece cuando **dos** Edge abren el mismo perfil a la
vez (típico al encender la PC: el autoinicio + Windows relanzando lo que estaba
abierto). Para eso:

- **Candado** (`Mutex`): si ya hay un arranque en curso, el segundo no hace nada.
- Detecta cualquier Edge con nuestro perfil **aunque todavía no tenga ventana**
  (antes se lanzaba un segundo por esa carrera) y espera a que aparezca.
- **Preflight**: comprueba que el perfil exista y se pueda escribir *antes* de
  abrir; si no, espera y reintenta.
- **Verificación + autoreparación**: si la ventana no aparece en 25 s, cierra ese
  Edge, aparta el perfil y reintenta con uno limpio.

## Multi Mic Monitor: arranque a prueba de fallos

`herramientas/multimic/` abre varios micrófonos a la vez. Al iniciar sesión,
Windows todavía está levantando el audio y los drivers virtuales; abrir varios
micrófonos ahí dejaba *streams* abiertos sin datos y el watchdog los reabría cada
6 s. Esa insistencia atascaba el motor de audio y **todos los micrófonos quedaban
sin volumen hasta reiniciar la PC**. Ahora:

- Espera a que la lista de entradas esté **estable** (y a que `explorer` exista).
- **Calienta** el motor de audio antes de abrir nada.
- Abre los micrófonos **de a uno**, comprobando que entregan datos antes de seguir.
- **No abre dispositivos virtuales** (Steam Streaming, VB-Cable, Voicemeeter…) en
  el arranque, salvo que marques *"Abrir dispositivos virtuales al iniciar con
  Windows"*. A mano los podés abrir siempre.
- **Cuarentena**: un dispositivo que falla 4 veces seguidas se aísla y no se vuelve
  a abrir solo (aparece `⚠ Desactivado: …`); se reactiva con `⏻ Activar`.
- **Modo seguro**: si varios micrófonos se quedan sin datos a la vez, cierra todo,
  espera 45 s y reabre de a uno, en lugar de martillar el dispositivo.
- **Retroceso exponencial** en los reintentos (15 s → 30 → 60 → … máximo 5 min).
- Cierra todo y libera PortAudio al salir (`atexit` incluido).
- **Una sola copia**: un segundo ejecutable no arranca.

Herramientas de recuperación (no hace falta reiniciar la PC):

- `🛠 Reparar audio` (dentro de la app) o `herramientas/multimic/Reparar audio de Windows.bat`:
  reinicia el servicio de audio de Windows (pide administrador).
- `MultiMicMonitor.py --autotest`: prueba sin interfaz que los micrófonos
  configurados entregan datos de verdad.
- Traza completa en `%APPDATA%\MultiMicMonitor\multimic.log`.

## Despliegue en otras PC (no depende de este equipo)

Todo lo anterior es **genérico**: no hay rutas, dispositivos ni marcas fijas. El
equipo de desarrollo solo se usó para probarlo. Cómo validar cada PC objetivo:

1. **Informe del equipo** (no abre ningún dispositivo, cero riesgo):
   `python MultiMicMonitor.py --diagnostico`
   Guarda un `.txt` en `%APPDATA%\MultiMicMonitor\` con Windows, Python,
   sounddevice/PortAudio, APIs de audio, todas las entradas/salidas, cuáles
   parecen virtuales, los ajustes efectivos y la cuarentena.
2. **Prueba real de entradas** (abre cada una 2 s y dice si entregan datos):
   `python MultiMicMonitor.py --diagnostico --sondas`
   Si algo no entrega datos, el informe sugiere qué agregar a `virtual_extra`.
3. **Ajustar sin tocar código** — en `%APPDATA%\MultiMicMonitor\config.json`:

   | Ajuste | Para qué |
   |---|---|
   | `virtual_extra: ["mi_dsp", …]` | reconocer como virtuales dispositivos con otros nombres (por defecto: Steam Streaming, VB-Cable, Voicemeeter, OBS, NVIDIA Broadcast, Sound Mapper, Stereo Mix…) |
   | `abrir_virtuales: true` | abrirlos igual al iniciar con Windows |
   | `seg_espera_audio`, `seg_comprobar_datos`, `intentos_comprobar` | equipos lentos o rápidos |
   | `max_fallos`, `seg_modo_seguro`, `dias_cuarentena` | agresividad del aislamiento |

   La protección **no depende de esos nombres**: abrir de a uno + comprobar que
   llegan datos + cuarentena + modo seguro funcionan en cualquier equipo.

Y el lanzador también es genérico:

- **Navegador**: usa el que exista — **Edge, Chrome o Brave** (los tres son
  Chromium y aceptan `--app`/`--user-data-dir`), o el predeterminado del sistema
  si no hay ninguno. Forzarlo: `-Navegador edge|chrome|brave|predeterminado`.
  Cada navegador tiene su **propio** perfil dedicado (`SerchTubeEdge`,
  `SerchTubeEdge-Chrome`, …) para que no se mezclen.
- **Detección de ventana por título real**: un proceso de navegador puede tener
  varias ventanas (la app, otras del perfil personal, avisos), así que se busca la
  ventana "SerchTube Music" y recién ahí se considera que la app está abierta.
- **Servidor**: si existe `dist/server.cjs` lo usa (build de producción); si no,
  `npm run dev`. No hay rutas absolutas ni dependencia de este equipo.
- **Todo por parámetros**: `-Puerto`, `-PerfilEdge`, `-RetardoSegundos`,
  `-EsperaServidor`, `-Modo`, `-Navegador`, `-SinAutoInicio`, `-RepararPerfil`.
