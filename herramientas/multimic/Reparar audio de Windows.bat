@echo off
setlocal
chcp 65001 >nul
title Reparar audio de Windows - Multi Mic Monitor
echo.
echo  ==========================================================
echo   Reparar el audio de Windows (sin reiniciar la PC)
echo  ==========================================================
echo.
echo  Usalo si los microfonos dejaron de registrar volumen.
echo  Va a pedir permiso de administrador y el sonido se
echo  cortara 1-2 segundos.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath powershell.exe -Verb RunAs -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-Command','Restart-Service -Name Audiosrv -Force; Start-Sleep -Seconds 3; Restart-Service -Name AudioEndpointBuilder -Force -ErrorAction SilentlyContinue')"
echo  Listo: se reinicio el servicio de audio de Windows.
echo  Vuelve a Multi Mic Monitor y activa tus microfonos.
echo.
pause
endlocal
