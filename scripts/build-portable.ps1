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
  [switch]$SinBuild
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
  Write-Host "[Portable] No hay dist\index.html: corre 'npm run build'." -ForegroundColor Red; exit 1
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
$salidaTemp = Join-Path $env:TEMP ("serchtube-exe-" + (Get-Date -Format 'yyyyMMddHHmmss'))
New-Item -ItemType Directory -Force -Path $salidaTemp | Out-Null
$destinoTemp = Join-Path $salidaTemp 'SerchTube.exe'

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
[SourceFiles]
SourceFiles0=$payloadDir\
[SourceFiles0]
%FILE0%=
%FILE1%=
%FILE2%=
"@
Set-Content -LiteralPath $sed -Value $sedTexto -Encoding ASCII

Paso "Generando el .exe con IExpress..."
$salidaIExpress = & $iexpress /N /Q $sed 2>&1
Start-Sleep -Seconds 2
if (-not (Test-Path -LiteralPath $destinoTemp)) {
  # Algunas versiones necesitan unos segundos mas
  for ($i = 0; $i -lt 20 -and -not (Test-Path -LiteralPath $destinoTemp); $i++) { Start-Sleep -Seconds 1 }
}
if (-not (Test-Path -LiteralPath $destinoTemp)) {
  Write-Host "[Portable] IExpress no genero el archivo." -ForegroundColor Red
  if ($salidaIExpress) { Write-Host ($salidaIExpress | Select-Object -First 5) -ForegroundColor DarkGray }
  Write-Host "[Portable] El paquete sin comprimir quedo en: $payloadDir" -ForegroundColor Yellow
  exit 1
}

New-Item -ItemType Directory -Force -Path $Salida | Out-Null
$destino = Join-Path $Salida 'SerchTube.exe'
Copy-Item -LiteralPath $destinoTemp -Destination $destino -Force
Remove-Item -Recurse -Force $salidaTemp -ErrorAction SilentlyContinue

$mb = (Get-Item $destino).Length / 1MB
Write-Host ""
Write-Host "=============== LISTO ===============" -ForegroundColor Green
Write-Host (" Ejecutable: {0}" -f $destino)
Write-Host (" Tamano    : {0:N2} MB" -f $mb)
Write-Host " Version   : $version"
Write-Host ""
Write-Host " Copialo a la PC host y hacele doble clic:"
Write-Host "   - la primera vez  -> instala y abre SerchTube"
Write-Host "   - las siguientes  -> actualiza (conserva claves y registros)"
Write-Host " Requisito de la host: Windows + Node.js en el PATH."
Write-Host "=====================================" -ForegroundColor Green
Write-Host ""
