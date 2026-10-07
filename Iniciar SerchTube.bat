@echo off
setlocal
rem ============================================================================
rem  SerchTube Music - Arranque en UNA sola ventana del navegador
rem  Doble clic aqui. En la PRIMERA ejecucion manual queda registrado en el
rem  autoinicio de Windows: desde el proximo encendido arranca solo (servidor
rem  incluido) sin abrir consolas.
rem
rem  Abre en TU perfil de navegador de siempre: extensiones, ajustes y claves
rem  guardadas tal como los tenias, y el microfono sin preguntar.
rem
rem  Opciones: -Modo pestana | -SinNavegador | -SinAutoInicio | -QuitarAutoInicio
rem            -PedirPermisoMicro | -Navegador chrome | -Perfil dedicado
rem ============================================================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-serchtube.ps1" %*
if errorlevel 1 (
  echo.
  echo Hubo un problema al iniciar SerchTube. Revisa logs\lanzador.log y logs\servidor.log
  pause
  goto :fin
)
echo.
echo Esta ventana se cierra sola en unos segundos...
timeout /t 8 /nobreak >nul
:fin
endlocal
