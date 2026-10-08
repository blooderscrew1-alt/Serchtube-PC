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

## Instalar en otra PC (una sola vez)

Todo el proyecto es **agnóstico del equipo**: no hay rutas, usuarios ni dispositivos
fijos, y los scripts de arranque/actualización hablan solo con GitHub (no con la PC
donde se desarrolló).

Requisitos de esa PC: **Node.js** (obligatorio) e **Internet**. Git es **opcional**
(sin Git, el actualizador descarga el ZIP de la rama; con Git la actualización es más
rápida y en un solo paso).

1. Trae el proyecto una vez:
   - con Git: `git clone https://github.com/blooderscrew1-alt/SerchTube-PC.git serchtube`
   - o descarga el ZIP de la rama y descomprímelo.
2. (Opcional) copia tu `.env` si quieres las mismas claves; si no, la app restaura las
   claves guardadas en el navegador de ese equipo.
3. Doble clic en **`Instalar en esta PC.bat`** (`scripts/install-serchtube.ps1`):
   comprueba Node.js/Git, crea el `.env` si falta, instala dependencias, registra el
   arranque automático y abre SerchTube.

Después, en esa PC, para actualizar: **`Actualizar SerchTube.bat`**.
Si falta Node.js o Git, el script lo avisa y puedes dejarlo instalar con
`-InstalarRequisitos` (usa winget).

Lo que **no** viaja entre PCs (es lo esperable): `node_modules/`, tus claves
(`.env`), los registros (`logs/`) y el perfil del navegador (extensiones, ajustes y
claves guardadas en `localStorage` son de cada equipo).

## PC host sin GitHub: un solo ejecutable (.exe)

Para una PC que **no tiene Git, ni npm, ni cuentas** hay un ejecutable único que hace
todo. Los ejecutables se publican en **GitHub Releases** (no dentro del repositorio,
para que este no crezca con binarios). Hay **dos variantes**:

| Variante | Tamaño | Necesita en la host |
|---|---|---|
| `SerchTube.exe` | **1,5 MB** | Windows + **Node.js** en el PATH |
| `SerchTube-con-Node.exe` | **34 MB** | solo **Windows** (Node va adentro) |

**Descarga directa** (el repositorio es público: no hace falta cuenta ni Git), con el
navegador de la PC host:

    https://github.com/blooderscrew1-alt/SerchTube-PC/releases/latest/download/SerchTube.exe
    https://github.com/blooderscrew1-alt/SerchTube-PC/releases/latest/download/SerchTube-con-Node.exe

Esas URLs son **fijas**: siempre apuntan a la última Release publicada.

Qué hace al ejecutarlo:

- **Primera vez en esa PC**: instala en `%LOCALAPPDATA%\SerchTube`, crea el acceso
  directo *SerchTube Music* en el Escritorio, registra el arranque automático y abre
  la app.
- **Las siguientes veces**: doble clic en el nuevo `.exe` → **actualiza** la
  instalación conservando tus claves (`.env`) y tus registros (`logs/`).
- **No necesita internet ni `node_modules`**: el servidor va empaquetado con todas
  sus dependencias dentro (un único `server.cjs` de ~3 MB) y el frontend ya compilado.
- Es **un solo archivo**: no hay que copiar carpetas ni ejecutar comandos.
- La variante con Node usa **su propio `node.exe`**: sirve incluso en PCs donde Node
  no está instalado (el lanzador lo detecta y lo usa automáticamente).

Generarlos y publicarlos (en la PC de desarrollo, después de cada cambio):

- doble clic en `Publicar ejecutables.bat` → compila los dos `.exe` y los sube a una
  Release nueva (etiqueta `portable-<commit>`). Ese es el camino normal.
- Solo generar, sin publicar:
  - `Generar ejecutable portable.bat` → el chico
  - `Generar ejecutable portable.bat -ConNode` → el que incluye Node (la primera vez
    descarga Node LTS ~30 MB y lo deja cacheado en `build\cache\`)
  - o `npm run portable` (con `-- -ConNode` para la variante grande)

Detalles útiles:

- Al ser un `.exe` sin firma digital, Windows puede mostrar *"Windows protegió tu
  PC"*: hay que pulsar **Más información → Ejecutar de todas formas**.
- Si algo falla en la host, el instalador deja la traza en
  `%TEMP%\serchtube-install.log`.
- En la host **no** hace falta Python ni Git.
- La publicación usa la credencial que Git ya tiene guardada para github.com; si no
  existe, se puede pasar un token con `-Token ghp_xxx` (permiso `repo`).

## Actualizar a la última versión (un clic)

No hace falta volver a descargar el proyecto ni reinstalar nada: esta carpeta ya
es un clon de git, y las actualizaciones se aplican encima.

- Doble clic en `Actualizar SerchTube.bat`, o
- `npm run actualizar`, o
- `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\update-serchtube.ps1`

Qué hace ([scripts/update-serchtube.ps1](scripts/update-serchtube.ps1)):

1. Trae **solo lo que cambió** (`git fetch` + `git pull`): no vuelve a bajar todo.
2. Ejecuta `npm install` **únicamente** si cambió `package.json` /
   `package-lock.json` / `bun.lock` o si falta `node_modules`. Si no, no pierde tiempo.
3. **Reinicia el servidor** (detecta el que escucha en el puerto) para que tome el
   código nuevo; si estaba apagado, lo arranca.
4. Muestra un resumen: versión anterior → nueva, dependencias y estado del servidor.

No toca tus claves (`.env`), tus registros (`logs/`) ni `node_modules/`.

Opciones: `-SinReiniciar`, `-Reiniciar` (forzar reinicio aunque no haya cambios),
`-Forzar` (descarta cambios locales), `-SinDependencias`, `-Rama <rama>`.

- Si tienes cambios locales sin guardar, los guarda en `git stash` y te indica cómo
  recuperarlos (`git stash pop`).
- Si la carpeta **no** es un repositorio git (la bajaste como ZIP), **no hace falta
  Git**: el script descarga el ZIP de la rama y copia encima conservando
  `node_modules`, `.env` y `logs`. Para pasar al modo git (más rápido y permite
  `-Forzar`), clona una vez y copia tu `.env`:
  `git clone https://github.com/blooderscrew1-alt/Serchtube-PC.git serchtube`

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
