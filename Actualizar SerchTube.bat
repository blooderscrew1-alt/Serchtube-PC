@echo off
setlocal
rem ============================================================================
rem  SerchTube Music - ACTUALIZAR (un solo clic)
rem
rem  Baja solo lo que cambio desde GitHub, ejecuta "npm install" unicamente si
rem  cambiaron las dependencias y reinicia el servidor. No toca tus claves
rem  (.env), tus registros (logs) ni node_modules.
rem
rem  Opciones: -SinReiniciar | -Forzar | -Rama otra-rama | -SinDependencias
rem ============================================================================
title Actualizar SerchTube
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\update-serchtube.ps1" %*
echo.
pause
endlocal
