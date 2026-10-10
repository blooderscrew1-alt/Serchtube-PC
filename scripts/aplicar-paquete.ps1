<#
  SerchTube Music - Aplicar este paquete sobre la instalacion de la host
  =====================================================================

  Se ejecuta DESDE la carpeta donde descomprimiste el paquete (la que tiene dist\ y
  scripts\). Copia la version nueva sobre la instalacion, conservando tus claves (.env),
  tus registros (logs/) y node_modules/, y reinicia SerchTube.

  Uso:
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts\aplicar-paquete.ps1
    ... -Carpeta "D:\SerchTube"      (si la instalaste en otro sitio)
    ... -SinReiniciar                (solo copia, no reinicia)
#>
[CmdletBinding()]
param(
  [string]$Carpeta = (Join-Path $env:LOCALAPPDATA 'SerchTube'),
  [int]$Puerto = 3000,
  [switch]$SinReiniciar
)

$ErrorActionPreference = 'Stop'

function Paso([string]$m) { Write-Host "[SerchTube] $m" -ForegroundColor Cyan }
function Aviso([string]$m) { Write-Host "[SerchTube] $m" -ForegroundColor Yellow }
function Mal([string]$m) { Write-Host "[SerchTube] $m" -ForegroundColor Red }

# --------------------------------------------------- Origen = esta misma carpeta
$Origen = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path -LiteralPath (Join-Path $Origen 'dist\server.cjs'))) {
  Mal "Este paquete no trae 'dist\server.cjs'. Descomprime el ZIP completo y vuelve a intentarlo."
  exit 1
}
Paso "Paquete : $Origen"

# ------------------------------------------------------------- Destino (host)
if (-not (Test-Path -LiteralPath $Carpeta)) {
  Aviso "No existe '$Carpeta': se creara una instalacion nueva."
  New-Item -ItemType Directory -Force -Path $Carpeta | Out-Null
} else {
  Paso "Instalacion existente: $Carpeta"
}

# Respaldar .env y logs por si acaso (nunca se sobrescriben)
$respaldo = Join-Path $env:TEMP ("serchtube-respaldo-" + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Force -Path $respaldo | Out-Null
foreach ($f in @('.env', 'logs')) {
  $p = Join-Path $Carpeta $f
  if (Test-Path -LiteralPath $p) {
    Copy-Item -LiteralPath $p -Destination (Join-Path $respaldo $f) -Recurse -Force -ErrorAction SilentlyContinue
  }
}
Paso "Respaldo de .env y logs en: $respaldo"

# ------------------------------------------------------------------- Copia
Paso "Copiando archivos (se conservan node_modules, logs y .env)..."
$rc = Start-Process -FilePath 'robocopy.exe' -Wait -PassThru -WindowStyle Hidden -ArgumentList @(
  "`"$Origen`"", "`"$Carpeta`"",
  '/E',
  '/XD', 'node_modules', 'logs', '.git',
  '/XF', '.env*',
  '/NFL', '/NDL', '/NJH', '/NJS', '/NP'
)
# robocopy: 0-7 = exito, >=8 = error
if ($rc.ExitCode -ge 8) {
  Mal "La copia fallo (robocopy codigo $($rc.ExitCode))."
  exit 1
}
Paso "Copia terminada (robocopy codigo $($rc.ExitCode))."

# ------------------------------------------------------------ Dependencias
$pkgActual = Join-Path $Carpeta 'package.json'
if (-not (Test-Path -LiteralPath (Join-Path $Carpeta 'node_modules'))) {
  Aviso "No hay node_modules en la instalacion."
}
if (Test-Path -LiteralPath $pkgActual) {
  Paso "package.json actualizado."
}
if (Test-Path -LiteralPath (Join-Path $Carpeta 'dist\server.cjs')) {
  Paso "Servidor compilado (dist\server.cjs) listo: no hace falta compilar nada."
} else {
  Mal "Falta dist\server.cjs en la instalacion. Copia de nuevo el paquete completo."
  exit 1
}

# ---------------------------------------------------------------- Reinicio
if ($SinReiniciar) {
  Aviso "No se reinicia el servidor (-SinReiniciar)."
  exit 0
}

Paso "Reiniciando SerchTube..."
$pids = @()
try {
  $pids = @(Get-NetTCPConnection -LocalPort $Puerto -State Listen -ErrorAction SilentlyContinue |
            Select-Object -ExpandProperty OwningProcess -Unique)
} catch { }
foreach ($p in $pids) {
  try { Stop-Process -Id $p -Force -ErrorAction SilentlyContinue; Paso "Proceso $p detenido." } catch { }
}
Start-Sleep -Seconds 2

$lanzador = Join-Path $Carpeta 'scripts\start-serchtube.ps1'
if (Test-Path -LiteralPath $lanzador) {
  Start-Process -FilePath 'powershell.exe' -WindowStyle Hidden -ArgumentList @(
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$lanzador`"", '-SinAutoInicio'
  ) | Out-Null
  Start-Sleep -Seconds 8
  $ok = $false
  for ($i = 1; $i -le 12; $i++) {
    try {
      $r = Invoke-WebRequest -Uri "http://localhost:$Puerto/api/health" -UseBasicParsing -TimeoutSec 3
      if ([int]$r.StatusCode -eq 200) { $ok = $true; break }
    } catch { }
    Start-Sleep -Seconds 2
  }
  if ($ok) {
    Write-Host ""
    Write-Host "============= ACTUALIZADO =============" -ForegroundColor Green
    Write-Host " SerchTube responde en http://localhost:$Puerto"
    Write-Host " Tu .env y tus logs NO se tocaron."
    Write-Host "=======================================" -ForegroundColor Green
  } else {
    Aviso "El servidor tarda en responder. Revisa logs\servidor.log."
  }
} else {
  Mal "No encontre el lanzador '$lanzador'."
  exit 1
}
