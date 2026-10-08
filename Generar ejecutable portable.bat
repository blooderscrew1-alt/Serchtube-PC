@echo off
setlocal
rem ============================================================================
rem  SerchTube Music - GENERAR EL EJECUTABLE PORTABLE
rem
rem  Crea  build\portable\SerchTube.exe  : un solo archivo que se copia a la PC
rem  host (la que NO tiene GitHub ni npm) y hace todo solo.
rem
rem    - Primera vez en esa PC : instala y abre SerchTube
rem    - Las siguientes veces  : actualiza conservando claves (.env) y registros
rem
rem  Requisito de la PC host: Windows + Node.js en el PATH.
rem  Opciones: -SinBuild (no recompilar el frontend) | -Salida <carpeta>
rem ============================================================================
title Generar SerchTube.exe (portable)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\build-portable.ps1" %*
echo.
pause
endlocal
