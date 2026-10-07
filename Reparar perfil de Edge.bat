@echo off
setlocal
rem ============================================================================
rem  SerchTube Music - Reparar el perfil DEDICADO del navegador
rem  Solo sirve si arrancas con -Perfil dedicado (modo kiosco). Con el perfil
rem  normal (el de siempre) no hay nada que reparar.
rem  Usalo si ves un mensaje tipo "no puede leer ni escribir en el directorio de
rem  datos": cierra ese navegador, aparta el perfil (no borra: lo renombra) y la
rem  proxima vez se crea uno limpio.
rem ============================================================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-serchtube.ps1" -Perfil dedicado -RepararPerfil
echo.
pause
endlocal
