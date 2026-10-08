<#
  SerchTube Music - Instalar en ESTA PC (una sola vez)
  ===================================================

  Sirve para cualquier PC con Windows donde quieras correr SerchTube:
    1. Comprueba que esta carpeta es el proyecto.
    2. Verifica Node.js (obligatorio) y Git (opcional) e intenta instalarlos con
       winget si falta algo y lo pedis con -InstalarRequisitos.
    3. Crea el archivo .env a partir de .env.example si no existe (para pegar las
       claves; tambien se restauran solas desde el navegador si ya las tenías).
    4. Instala las dependencias (npm install).
    5. Registra el arranque automatico y abre SerchTube.

  Despues de esta primera vez, para actualizar solo hace falta
  "Actualizar SerchTube.bat" (un clic).

  Uso:
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts\install-serchtube.ps1
    powershell ... -File scripts\install-serchtube.ps1 -InstalarRequisitos
    powershell ... -File scripts\install-serchtube.ps1 -SinAbrir
#>
[CmdletBinding()]
param(
  # Instalar Node.js / Git con winget si faltan
  [switch]$InstalarRequisitos,

  # No abrir SerchTube al terminar
  [switch]$SinAbrir,

  # No registrar el arranque automatico de Windows
  [switch]$SinAutoInicio,

  [int]$Puerto = 3000
)

$ErrorActionPreference = 'Stop'
$Raiz = Split-Path -Parent $PSScriptRoot
$LogDir = Join-Path $Raiz 'logs'

function Write-Paso([string]$m) { Write-Host "[Instalar] $m" -ForegroundColor Cyan; Write-Registro $m }
function Write-Aviso([string]$m) { Write-Host "[Instalar] $m" -ForegroundColor Yellow; Write-Registro "AVISO: $m" }
function Write-Mal([string]$m) { Write-Host "[Instalar] $m" -ForegroundColor Red; Write-Registro "ERROR: $m" }
function Write-Registro([string]$m) {
  try {
    if (-not (Test-Path -LiteralPath $LogDir)) { New-Item -ItemType Directory -Force -Path $LogDir | Out-Null }
    Add-Content -LiteralPath (Join-Path $LogDir 'instalar.log') -Value ("[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $m)
  } catch { }
}
function Test-Comando([string]$nombre) { return [bool](Get-Command $nombre -ErrorAction SilentlyContinue) }
function Actualizar-Path {
  $env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
              [System.Environment]::GetEnvironmentVariable('Path', 'User')
}
function Instalar-ConWinget([string]$id, [string]$nombre) {
  if (-not (Test-Comando 'winget')) { return $false }
  Write-Paso "Instalando $nombre con winget ($id)..."
  try { & winget install --id $id -e --accept-source-agreements --accept-package-agreements --silent }
  catch { Write-Aviso "winget no pudo instalar $nombre."; return $false }
  Actualizar-Path
  return $true
}

Write-Paso "Equipo: $env:COMPUTERNAME | Carpeta: $Raiz"

# ------------------------------------------------------------- 1) Es el proyecto?
if (-not (Test-Path -LiteralPath (Join-Path $Raiz 'package.json')) -or
    -not (Test-Path -LiteralPath (Join-Path $Raiz 'server.ts'))) {
  Write-Mal "Esta carpeta no parece el proyecto de SerchTube (falta package.json o server.ts)."
  exit 1
}

# ----------------------------------------------------------------- 2) Requisitos
$faltan = @()
if (-not (Test-Comando 'node') -or -not (Test-Comando 'npm')) {
  $faltan += @{ Nombre = 'Node.js (incluye npm)'; Id = 'OpenJS.NodeJS.LTS'; Url = 'https://nodejs.org' }
}
if (-not (Test-Comando 'git')) { $faltan += @{ Nombre = 'Git (opcional)'; Id = 'Git.Git'; Url = 'https://git-scm.com/download/win' } }

if ($faltan.Count -gt 0) {
  foreach ($f in $faltan) { Write-Aviso "Falta $($f.Nombre)  ->  $($f.Url)" }
  if ($InstalarRequisitos) {
    foreach ($f in $faltan) { Instalar-ConWinget $f.Id $f.Nombre | Out-Null }
    if (-not (Test-Comando 'node')) { Write-Aviso "Node.js todavia no esta disponible: cierra esta ventana, ábrela de nuevo y ejecuta otra vez." }
  } elseif (Test-Comando 'winget') {
    Write-Paso "Puedo instalarlos yo: vuelve a ejecutar con -InstalarRequisitos"
  }
  if (-not (Test-Comando 'node') -or -not (Test-Comando 'npm')) {
    Write-Mal "Sin Node.js no se pueden instalar las dependencias ni arrancar la app."
    exit 1
  }
} else {
  Write-Paso "Requisitos OK (node, npm$(if (Test-Comando 'git') { ', git' }))."
}

# ---------------------------------------------------------------------- 3) .env
$envFile = Join-Path $Raiz '.env'
$envEjemplo = Join-Path $Raiz '.env.example'
if (-not (Test-Path -LiteralPath $envFile) -and (Test-Path -LiteralPath $envEjemplo)) {
  Copy-Item -LiteralPath $envEjemplo -Destination $envFile -Force
  Write-Paso "Creado .env a partir de .env.example: pega ahi tus claves (o déjalo asi)."
} elseif (Test-Path -LiteralPath $envFile) {
  Write-Paso ".env ya existe: no se toca."
}

# ------------------------------------------------------------- 4) Dependencias
if (-not (Test-Path -LiteralPath (Join-Path $Raiz 'node_modules'))) {
  Write-Paso "Instalando dependencias (puede tardar un par de minutos)..."
} else {
  Write-Paso "node_modules ya existe: se actualiza por si cambio algo..."
}
Push-Location $Raiz
try {
  & npm install --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { Write-Mal "'npm install' termino con error."; exit 1 }
} finally { Pop-Location }
Write-Paso "Dependencias listas."

# ------------------------------------ 5) Autoinicio + abrir (via el lanzador)
$lanzador = Join-Path $PSScriptRoot 'start-serchtube.ps1'
if (Test-Path -LiteralPath $lanzador) {
  $argumentos = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $lanzador, '-Puerto', "$Puerto")
  if ($SinAutoInicio) { $argumentos += '-SinAutoInicio' }
  if ($SinAbrir) { $argumentos += '-SinNavegador' }
  & powershell @argumentos
} else {
  Write-Aviso "No encontre scripts\start-serchtube.ps1: arranca la app con 'Iniciar SerchTube.bat'."
}

Write-Host ""
Write-Host "=============== LISTO ===============" -ForegroundColor Green
Write-Host " Esta PC ya puede correr SerchTube."
Write-Host " Para abrirlo:      Iniciar SerchTube.bat"
Write-Host " Para actualizarlo: Actualizar SerchTube.bat  (un clic)"
Write-Host " Claves: .env del proyecto o se restauran solas desde el navegador."
Write-Host "=====================================" -ForegroundColor Green
Write-Host ""
