@echo off
setlocal
rem ============================================================================
rem  SerchTube Music - INSTALAR EN ESTA PC (una sola vez)
rem
rem  Sirve para cualquier PC con Windows: comprueba Node.js/Git, crea el .env si
rem  falta, instala dependencias, registra el arranque automatico y abre la app.
rem
rem  Despues de esto, para actualizar solo hace falta: Actualizar SerchTube.bat
rem
rem  Opciones: -InstalarRequisitos | -SinAbrir | -SinAutoInicio
rem ============================================================================
title Instalar SerchTube en esta PC
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\install-serchtube.ps1" %*
echo.
pause
endlocal
