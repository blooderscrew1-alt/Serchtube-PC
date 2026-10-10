@echo off
setlocal
cd /d "%~dp0"
echo ============================================================
echo   SerchTube Music - Aplicar este paquete en esta PC
echo ============================================================
echo.
echo  Se conservan tus claves (.env) y tus registros (logs).
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\aplicar-paquete.ps1" %*
echo.
pause
