@echo off
setlocal
rem ============================================================================
rem  SerchTube Music - Quitar del autoinicio de Windows
rem  Despues de esto, SerchTube ya no se abrira solo al encender la PC
rem  (puedes seguir abriendolo a mano con "Iniciar SerchTube.bat").
rem ============================================================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-serchtube.ps1" -QuitarAutoInicio
echo.
pause
endlocal
