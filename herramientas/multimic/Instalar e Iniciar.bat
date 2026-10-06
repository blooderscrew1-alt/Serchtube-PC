@echo off
chcp 65001 >nul
title Multi Mic Monitor - Instalador
cd /d "%~dp0"

echo.
echo  ==========================================
echo   Multi Mic Monitor - Instalador e inicio
echo  ==========================================
echo.

rem 1) Buscar Python (py launcher o python directo)
set "PYEXE="
py -3 --version >nul 2>&1 && set "PYEXE=py -3"
if not defined PYEXE (
    python --version >nul 2>&1 && set "PYEXE=python"
)
if not defined PYEXE (
    echo  [X] No hay Python instalado en esta PC.
    echo      Se abrira la pagina de descarga de Python.
    echo      Instala la version 3.x marcando "Add Python to PATH" y vuelve a intentar.
    start "" https://www.python.org/downloads/
    pause
    exit /b 1
)
echo  [OK] Python encontrado:
%PYEXE% --version

rem 2) Instalar la libreria de audio si falta
echo  [..] Verificando libreria de audio (sounddevice)...
%PYEXE% -c "import sounddevice" >nul 2>&1
if errorlevel 1 (
    echo  [..] Instalando sounddevice...
    %PYEXE% -m pip install --upgrade sounddevice
)
%PYEXE% -c "import sounddevice" >nul 2>&1
if errorlevel 1 (
    echo  [X] No se pudo instalar sounddevice. Revisa tu conexion a internet.
    pause
    exit /b 1
)
echo  [OK] sounddevice listo.

rem 3) Crear acceso directo en el Escritorio (solo si no existe)
set "PYW="
for /f "delims=" %%P in ('%PYEXE% -c "import sys,os;print(os.path.join(os.path.dirname(sys.executable),'pythonw.exe'))"') do set "PYW=%%P"
if not exist "%PYW%" set "PYW=%PYEXE%"
set "LNK=%USERPROFILE%\Desktop\Multi Mic Monitor.lnk"
if not exist "%LNK%" if exist "%PYW%" (
    powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%LNK%'); $s.TargetPath = '%PYW%'; $s.Arguments = '\"%CD%\MultiMicMonitor.py\"'; $s.WorkingDirectory = '%CD%'; $s.Save()" >nul 2>&1
    if exist "%LNK%" echo  [OK] Acceso directo creado en el Escritorio.
)

rem 4) Iniciar el programa (el propio script instala lo que falte y abre su ventana)
echo  [OK] Abriendo Multi Mic Monitor...
start "" %PYEXE% "%CD%\MultiMicMonitor.py"
exit /b 0
