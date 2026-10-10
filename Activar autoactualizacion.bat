@echo off
setlocal
cd /d "%~dp0"
echo ============================================================
echo   SerchTube Music - Autoactualizacion en esta PC
echo ============================================================
echo.
echo  Esta PC revisara GitHub y se pondra al dia sola (cada 15 min
echo  y al iniciar sesion). No necesitas Git ni compilar nada.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\activar-autoactualizacion.ps1" %*
echo.
pause
