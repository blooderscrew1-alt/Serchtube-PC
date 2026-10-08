@echo off
setlocal
rem ============================================================================
rem  SerchTube Music - PUBLICAR LOS EJECUTABLES EN GITHUB RELEASES
rem
rem  Compila, genera los .exe y los sube como adjuntos de una Release, para que:
rem    - el repositorio no crezca con binarios
rem    - la descarga tenga URL fija:
rem        https://github.com/blooderscrew1-alt/Serchtube-PC/releases/latest/download/SerchTube.exe
rem        https://github.com/blooderscrew1-alt/Serchtube-PC/releases/latest/download/SerchTube-con-Node.exe
rem
rem  Opciones: -SinCompilar | -SinVarianteNode | -Token ghp_xxx
rem ============================================================================
title Publicar ejecutables en GitHub Releases
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\publicar-release.ps1" %*
echo.
pause
endlocal
