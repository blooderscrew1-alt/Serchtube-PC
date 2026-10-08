<#
  SerchTube Music - Generar el ejecutable portatil (SerchTube.exe)
  ================================================================

  Crea UN solo archivo .exe que se puede copiar a cualquier PC con Windows + Node.js,
  sin GitHub, sin npm y sin internet:

      build\portable\SerchTube.exe

  Que hace este script (se ejecuta en la PC de desarrollo):
    1. Compila el frontend (vite) y el servidor con TODAS sus dependencias adentro
       (un solo server.cjs de ~3 MB: en la PC host no hace falta node_modules).
    2. Arma un paquete con la app + el lanzador + el instalador.
    3. Lo comprime y genera el .exe con IExpress (viene incluido en Windows).

  Uso:
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts\build-portable.ps1
#>
[CmdletBinding()]
param(
  # Carpeta de salida del .exe
  [string]$Salida = '',
  # No volver a ejecutar el build de vite (usar el dist existente)
  [switch]$SinBuild,
  # Incluir Node.js dentro del paquete (para PCs que NO tienen Node instalado)
  [switch]$ConNode,
  # Version de Node a incluir (por defecto, la ultima LTS). Ej: v22.11.0
  [string]$NodeVersion = ''
)

$ErrorActionPreference = 'Stop'
$Raiz = Split-Path -Parent $PSScriptRoot
if (-not $Salida) { $Salida = Join-Path $Raiz 'build\portable' }

function Paso([string]$m) { Write-Host "[Portable] $m" -ForegroundColor Cyan }
function Aviso([string]$m) { Write-Host "[Portable] $m" -ForegroundColor Yellow }

Paso "Proyecto: $Raiz"
if (-not (Test-Path -LiteralPath (Join-Path $Raiz 'server.ts'))) {
  Write-Host "[Portable] Esta carpeta no parece el proyecto." -ForegroundColor Red
  exit 1
}

$npm = (Get-Command npm.cmd -ErrorAction SilentlyContinue)
if (-not $npm) { $npm = (Get-Command npm -ErrorAction SilentlyContinue) }
if (-not $npm) { Write-Host "[Portable] Falta npm." -ForegroundColor Red; exit 1 }

# ------------------------------------------------------------------ 1) Compilar
if (-not $SinBuild) {
  Paso "Compilando el frontend (vite)..."
  Push-Location $Raiz
  try {
    & $npm.Source run build | Out-Null
    if ($LASTEXITCODE -ne 0) { Write-Host "[Portable] 'npm run build' fallo." -ForegroundColor Red; exit 1 }
  } finally { Pop-Location }
} else {
  Aviso "Se usa el dist existente (-SinBuild)."
}
if (-not (Test-Path -LiteralPath (Join-Path $Raiz 'dist\index.html'))) {
  Write-Host "[Portable] No hay dist\index.html: ejecuta 'npm run build'." -ForegroundColor Red; exit 1
}

# ---------------------------- 2) Servidor con TODAS las dependencias adentro
Paso "Empaquetando el servidor con sus dependencias (sin node_modules)..."
Push-Location $Raiz
try {
  & $npm.Source exec -- esbuild server.ts --bundle --platform=node --format=cjs `
    --target=node20 --external:vite --external:bufferutil --external:utf-8-validate `
    "--outfile=dist/server.cjs" | Out-Null
  if ($LASTEXITCODE -ne 0) { Write-Host "[Portable] El empaquetado del servidor fallo." -ForegroundColor Red; exit 1 }
} finally { Pop-Location }
$tamServidor = (Get-Item (Join-Path $Raiz 'dist\server.cjs')).Length / 1MB
Paso ("servidor autocontenido: {0:N2} MB" -f $tamServidor)

# ------------------------------------------------------------- 3) Armar payload
$work = Join-Path $Raiz 'build\portable-work'
Remove-Item -Recurse -Force $work -ErrorAction SilentlyContinue
$appDir = Join-Path $work 'app'
$payloadDir = Join-Path $work 'payload'
New-Item -ItemType Directory -Force -Path $appDir, $payloadDir | Out-Null

Paso "Copiando la aplicacion al paquete..."
Copy-Item -LiteralPath (Join-Path $Raiz 'dist') -Destination (Join-Path $appDir 'dist') -Recurse -Force
New-Item -ItemType Directory -Force -Path (Join-Path $appDir 'scripts') | Out-Null
foreach ($f in @('start-serchtube.ps1', 'start-serchtube-silencioso.vbs')) {
  Copy-Item -LiteralPath (Join-Path $Raiz "scripts\$f") -Destination (Join-Path $appDir "scripts\$f") -Force
}
foreach ($f in @('.env.example', 'package.json')) {
  if (Test-Path -LiteralPath (Join-Path $Raiz $f)) {
    Copy-Item -LiteralPath (Join-Path $Raiz $f) -Destination (Join-Path $appDir $f) -Force
  }
}

# Version (commit de git si existe, si no la fecha)
$version = "build $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
try {
  $commit = (git -C $Raiz rev-parse --short HEAD 2>$null)
  if ($commit) { $version = "$commit ($(Get-Date -Format 'yyyy-MM-dd HH:mm'))" }
} catch { }
Set-Content -LiteralPath (Join-Path $appDir 'serchtube-version.txt') -Value $version -Encoding UTF8
Paso "Version: $version"

# ------------------------------------- 3b) Node incluido (variante -ConNode)
if ($ConNode) {
  $cache = Join-Path $Raiz 'build\cache'
  New-Item -ItemType Directory -Force -Path $cache | Out-Null

  if (-not $NodeVersion) {
    Paso "Consultando la ultima version LTS de Node.js..."
    try {
      $indice = Invoke-RestMethod -Uri 'https://nodejs.org/dist/index.json' -UseBasicParsing -TimeoutSec 90
      $lts = $indice | Where-Object { $_.lts } | Select-Object -First 1
      if ($lts) { $NodeVersion = $lts.version }
    } catch {
      Aviso "No pude consultar nodejs.org ($($_.Exception.Message))."
    }
  }
  if (-not $NodeVersion) {
    Write-Host "[Portable] No se pudo determinar la version de Node. Usa -NodeVersion vXX.Y.Z" -ForegroundColor Red
    exit 1
  }
  $v = $NodeVersion.TrimStart('v')
  $zipNode = Join-Path $cache "node-v$v-win-x64.zip"
  if (-not (Test-Path -LiteralPath $zipNode)) {
    $url = "https://nodejs.org/dist/v$v/node-v$v-win-x64.zip"
    Paso "Descargando Node.js $NodeVersion (~30 MB; se guarda en build\cache para la proxima)..."
    Invoke-WebRequest -Uri $url -OutFile $zipNode -UseBasicParsing -TimeoutSec 1800
  } else {
    Paso "Usando el Node ya descargado: node-v$v-win-x64.zip"
  }
  $tempNode = Join-Path $work 'node'
  Remove-Item -Recurse -Force $tempNode -ErrorAction SilentlyContinue
  Expand-Archive -LiteralPath $zipNode -DestinationPath $tempNode -Force
  $nodeExe = Get-ChildItem -Path $tempNode -Recurse -Filter 'node.exe' -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $nodeExe) {
    Write-Host "[Portable] No encontre node.exe dentro del ZIP de Node." -ForegroundColor Red
    exit 1
  }
  Copy-Item -LiteralPath $nodeExe.FullName -Destination (Join-Path $appDir 'node.exe') -Force
  Set-Content -LiteralPath (Join-Path $appDir 'node-incluido.txt') -Value "Node.js $NodeVersion incluido" -Encoding ASCII
  Set-Content -LiteralPath (Join-Path $payloadDir 'node-incluido.txt') -Value "Node.js $NodeVersion" -Encoding ASCII
  Paso ("Node.js $NodeVersion incluido (node.exe = {0:N1} MB)" -f ((Get-Item (Join-Path $appDir 'node.exe')).Length / 1MB))
  Remove-Item -Recurse -Force $tempNode -ErrorAction SilentlyContinue
}

# ------------------------------------------------------ 4) Zip + instalador
$zip = Join-Path $payloadDir 'SerchTube-App.zip'
Paso "Comprimiendo la aplicacion..."
Compress-Archive -Path (Join-Path $appDir '*') -DestinationPath $zip -CompressionLevel Optimal
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'portable-install.ps1') -Destination (Join-Path $payloadDir 'Instalar-Portable.ps1') -Force

$bat = Join-Path $payloadDir 'Instalar.bat'
@"
@echo off
cd /d "%~dp0"
echo [%date% %time%] Instalar.bat iniciado en %~dp0 >> "%TEMP%\serchtube-bat.log"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Instalar-Portable.ps1"
echo [%date% %time%] Instalar.bat termino con codigo %errorlevel% >> "%TEMP%\serchtube-bat.log"
"@ | Set-Content -LiteralPath $bat -Encoding ASCII

# ------------------------------------------------------------- 5) IExpress
$iexpress = Join-Path $env:SystemRoot 'System32\iexpress.exe'
if (-not (Test-Path -LiteralPath $iexpress)) {
  Aviso "No encontre IExpress. El paquete quedo en: $payloadDir"
  exit 0
}
# IExpress no tolera espacios NI en la ruta del .sed NI en la del destino:
# ambos se generan en una carpeta temporal sin espacios y luego se copia el .exe.
$nombreExe = 'SerchTube.exe'
if ($ConNode) { $nombreExe = 'SerchTube-con-Node.exe' }
$salidaTemp = Join-Path $env:TEMP ("serchtube-exe-" + (Get-Date -Format 'yyyyMMddHHmmss'))
New-Item -ItemType Directory -Force -Path $salidaTemp | Out-Null
$destinoTemp = Join-Path $salidaTemp $nombreExe

# Si el paquete trae Node, el instalador lo detecta por este archivo
$extraStrings = ''
$extraSource = ''
if (Test-Path -LiteralPath (Join-Path $payloadDir 'node-incluido.txt')) {
  $extraStrings = 'FILE3="node-incluido.txt"'
  $extraSource = '%FILE3%='
}

$sed = Join-Path $salidaTemp 'serchtube.sed'
$sedTexto = @"
[Version]
Class=IEXPRESS
SEDVersion=3
[Options]
PackagePurpose=InstallApp
ShowInstallProgramWindow=0
HideExtractAnimation=1
UseLongFileName=1
InsideCompressed=0
CAB_FixedSize=0
CAB_ResvCodeSigning=0
RebootMode=N
InstallPrompt=%InstallPrompt%
DisplayLicense=%DisplayLicense%
FinishMessage=%FinishMessage%
TargetName=%TargetName%
FriendlyName=%FriendlyName%
AppLaunched=%AppLaunched%
PostInstallCmd=%PostInstallCmd%
AdminQuietInstCmd=%AdminQuietInstCmd%
UserQuietInstCmd=%UserQuietInstCmd%
SourceFiles=SourceFiles
[Strings]
InstallPrompt=
DisplayLicense=
FinishMessage=
TargetName=$destinoTemp
FriendlyName=SerchTube Music
AppLaunched=cmd.exe /c Instalar.bat
PostInstallCmd=<None>
AdminQuietInstCmd=
UserQuietInstCmd=
FILE0="SerchTube-App.zip"
FILE1="Instalar-Portable.ps1"
FILE2="Instalar.bat"
$extraStrings
[SourceFiles]
SourceFiles0=$payloadDir\
[SourceFiles0]
%FILE0%=
%FILE1%=
%FILE2%=
$extraSource
"@
Set-Content -LiteralPath $sed -Value $sedTexto -Encoding ASCII

Paso "Generando el .exe con IExpress... (los paquetes grandes tardan)"
$generado = $false
for ($intento = 1; $intento -le 3 -and -not $generado; $intento++) {
  if ($intento -gt 1) {
    Aviso "Reintentando el empaquetado (intento $intento)..."
    Remove-Item -LiteralPath $destinoTemp -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 3
  }
  $salidaIExpress = & $iexpress /N /Q $sed 2>&1
  # Se espera hasta 3 minutos: con Node incluido el paquete pesa ~35 MB
  for ($i = 0; $i -lt 180; $i++) {
    if (Test-Path -LiteralPath $destinoTemp) {
      $tam = (Get-Item -LiteralPath $destinoTemp).Length
      Start-Sleep -Seconds 2
      if ((Get-Item -LiteralPath $destinoTemp).Length -eq $tam -and $tam -gt 100kb) { $generado = $true; break }
    }
    Start-Sleep -Seconds 1
  }
  if (-not $generado -and $salidaIExpress) {
    Write-Host ($salidaIExpress | Select-Object -First 5) -ForegroundColor DarkGray
  }
}

if (-not $generado) {
  Write-Host "[Portable] IExpress no genero el archivo." -ForegroundColor Red
  Write-Host "[Portable] El paquete sin comprimir quedo en: $payloadDir" -ForegroundColor Yellow
  Write-Host "[Portable] Puedes generarlo a mano con:" -ForegroundColor Yellow
  Write-Host "           iexpress /N /Q `"$sed`"" -ForegroundColor Yellow
  exit 1
}

New-Item -ItemType Directory -Force -Path $Salida | Out-Null
$destino = Join-Path $Salida $nombreExe
# El .exe anterior puede estar en uso (antivirus, una prueba corriendo): se reintenta
$copiado = $false
for ($intento = 1; $intento -le 5 -and -not $copiado; $intento++) {
  try {
    Copy-Item -LiteralPath $destinoTemp -Destination $destino -Force -ErrorAction Stop
    $copiado = $true
  } catch {
    if ($intento -eq 1) {
      Aviso "No pude escribir $nombreExe (puede estar en uso). Reintentando..."
    }
    Start-Sleep -Seconds 3
  }
}
if (-not $copiado) {
  Write-Host "[Portable] No pude copiar el .exe a $destino (esta en uso)." -ForegroundColor Red
  Write-Host "[Portable] El paquete generado quedo en: $destinoTemp" -ForegroundColor Yellow
  exit 1
}
Remove-Item -Recurse -Force $salidaTemp -ErrorAction SilentlyContinue

$mb = (Get-Item $destino).Length / 1MB
Write-Host ""
Write-Host "=============== LISTO ===============" -ForegroundColor Green
Write-Host (" Ejecutable: {0}" -f $destino)
Write-Host (" Tamano    : {0:N2} MB" -f $mb)
Write-Host " Version   : $version"
Write-Host ""
Write-Host " Cópialo a la PC host y hacele doble clic:"
Write-Host "   - la primera vez  -> instala y abre SerchTube"
Write-Host "   - las siguientes  -> actualiza (conserva claves y registros)"
if ($ConNode) {
  Write-Host " Esta variante INCLUYE Node.js: la host no necesita nada instalado." -ForegroundColor Green
} else {
  Write-Host " Requisito de la host: Windows + Node.js en el PATH."
  Write-Host " (Si la host no tiene Node, usa la variante con -ConNode.)"
}
Write-Host "=====================================" -ForegroundColor Green
Write-Host ""
