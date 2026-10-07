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

Opciones:

- `-Modo pestana` → una pestaña normal en lugar de la ventana en modo app.
- `-AutoconcederMicro` → concede el micrófono automáticamente (modo kiosco/voz).
- `-SinNavegador` → solo comprueba/arranca el servidor, sin abrir Edge.
- `-Puerto 3000`, `-PerfilEdge <ruta>`, `-EsperaServidor <segundos>`.

Para el arranque automático, apunta tu acceso directo o script de la PC al
`.bat` (o al `.ps1`) en lugar de abrir Edge a mano.
