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

Al encender la PC, el navegador puede restaurar las pestañas de la sesión anterior
y terminar abriendo SerchTube varias veces. Para que eso no pase, arranca siempre
desde el lanzador:

- Doble clic en `Iniciar SerchTube.bat`, o
- `npm run iniciar`, o
- `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\start-serchtube.ps1`

El lanzador ([scripts/start-serchtube.ps1](scripts/start-serchtube.ps1)):

1. Si el servidor ya responde en `http://localhost:3000/api/health`, no arranca
   otro (evita duplicar procesos y el error de puerto ocupado). Si no responde,
   lo inicia oculto y registra todo en `logs/servidor.log`.
2. Abre el navegador en **modo app con TU PERFIL DE SIEMPRE** (por defecto):
   una sola ventana, sin barra de pestañas, y con **tus extensiones, tus ajustes y
   tus claves guardadas** tal como los tenías.
3. El **micrófono ya no pregunta**: el permiso se concede automáticamente en cada
   arranque. Para volver al comportamiento normal del navegador: `-PedirPermisoMicro`.
4. Si la ventana de la app ya está abierta, la trae al frente y **no abre otra**,
   así que puedes ejecutarlo cuantas veces quieras (arranque de Windows, doble
   clic, script propio).
5. Registra SerchTube en el **autoinicio de Windows** la primera vez que lo
   ejecutas (una sola vez; después no toca nada más).

## Arranque automático al encender la PC

Con la primera ejecución manual del `.bat` ya queda todo listo: el lanzador crea
un acceso directo en la carpeta **Inicio** del usuario
(`shell:startup\SerchTube Music.lnk`) que apunta a
[scripts/start-serchtube-silencioso.vbs](scripts/start-serchtube-silencioso.vbs).
Ese guion lanza el `.ps1` **sin ninguna ventana de consola**, espera 15 segundos
a que Windows termine de iniciar sesión, arranca el servidor si hace falta y abre
la única ventana del navegador. Ya no hay que abrir nada a mano ni apuntar accesos
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
- `-Navegador edge|chrome|brave|predeterminado` → fuerza el navegador (por defecto
  usa el que exista: Edge, Chrome o Brave).
- `-PedirPermisoMicro` → que el navegador pregunte el micrófono como siempre.
- `-Perfil dedicado` → perfil aparte, aislado, sin extensiones ni datos previos
  (modo kiosco). Con `-RepararPerfil` (o `Reparar perfil de Edge.bat`) se aparta el
  perfil dedicado y se crea uno limpio.
- `-SinNavegador` → solo comprueba/arranca el servidor, sin abrir el navegador.
- `-SinAutoInicio` / `-QuitarAutoInicio` → no registrar / quitar del autoinicio.
- `-Puerto 3000`, `-PerfilEdge <ruta>`, `-EsperaServidor <segundos>`,
  `-RetardoSegundos <segundos>`.

### Una sola ventana, sin errores de "directorio de datos"

El lanzador evita el mensaje *"no puede leer ni escribir en el directorio de datos"*,
que aparece cuando **dos** procesos abren el mismo perfil a la vez (típico al
encender la PC: el autoinicio + Windows relanzando lo que estaba abierto). Para eso:

- **Candado** (`Mutex`): si ya hay un arranque en curso, el segundo no hace nada.
- La ventana de la app se busca **por título exacto** entre las ventanas del
  navegador (un mismo proceso puede tener varias: la app, otras pestañas, avisos).
- En modo `-Perfil dedicado`: detecta procesos con ese perfil **aunque todavía no
  tengan ventana**, comprueba que el directorio se pueda escribir antes de abrir y,
  si la ventana no aparece en 25 s, aparta el perfil y reintenta con uno limpio.
