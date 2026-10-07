@echo off
setlocal
rem ============================================================================
rem  SerchTube Music - Arranque en UNA sola ventana de Edge
rem  Doble clic aqui, o apunta a este .bat el acceso directo / script de la PC.
rem  Opciones: -Modo pestana | -SinNavegador | -AutoconcederMicro
rem ============================================================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-serchtube.ps1" %*
if errorlevel 1 (
  echo.
  echo Hubo un problema al iniciar SerchTube. Revisa logs\servidor.log
  pause
)
endlocal
