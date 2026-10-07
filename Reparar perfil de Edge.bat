@echo off
setlocal
rem ============================================================================
rem  SerchTube Music - Reparar el perfil de Edge de SerchTube
rem  Usalo si al arrancar ves un mensaje de Edge tipo:
rem  "Microsoft Edge no puede leer ni escribir en el directorio de datos".
rem  Cierra ese Edge, aparta el perfil dañado (no borra nada: lo renombra)
rem  y la proxima vez se crea un perfil limpio.
rem ============================================================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-serchtube.ps1" -RepararPerfil
echo.
pause
endlocal
