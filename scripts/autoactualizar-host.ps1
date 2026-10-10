<#
  SerchTube Music - Autoactualizacion desde GitHub (pensado para la host)
  ======================================================================

  Hace las dos cosas que necesita una PC que solo tiene Node.js (sin Git, sin
  herramientas de compilacion):

    1. Trae el codigo nuevo del repositorio (update-serchtube.ps1, modo ZIP).
    2. Descarga el SERVIDOR YA COMPILADO (dist) del ultimo Release y lo aplica.
       Esto es imprescindible: el lanzador ejecuta dist\server.cjs, y el modo ZIP
       no compila; sin este paso la app seguiria con el servidor anterior.

  Uso:
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts\autoactualizar-host.ps1
    ... -SinReiniciar     (solo descarga y aplica)
    ... -Silencioso       (sin mensajes, para tareas programadas)
#>
[CmdletBinding()]
param(
  [string]$Carpeta = (Join-Path $env:LOCALAPPDATA 'SerchTube'),
  [string]$Repo = 'https://github.com/blooderscrew1-alt/Serchtube-PC.git',
  [int]$Puerto = 3000,
  [switch]$SinReiniciar,
  [switch]$Silencioso
)

$ErrorActionPreference = 'Continue'

function Info([string]$m) { if (-not $Silencioso) { Write-Host "[AutoUpdate] $m" -ForegroundColor Cyan } }
function Aviso([string]$m) { if (-not $Silencioso) { Write-Host "[AutoUpdate] $m" -ForegroundColor Yellow } }

# ---------------------------------------------------- 1) Codigo del repositorio
$actualizador = Join-Path $PSScriptRoot 'update-serchtube.ps1'
if (Test-Path -LiteralPath $actualizador) {
  Info "Trayendo el codigo del repositorio..."
  try {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $actualizador `
        -SinDependencias -SinReiniciar -Forzar 2>&1 | ForEach-Object { if (-not $Silencioso) { Write-Host $_ } }
  } catch {
    Aviso "El actualizador de codigo fallo: $($_.Exception.Message)"
  }
} else {
  Aviso "No encontre update-serchtube.ps1 (sigo con el servidor compilado)."
}

# ------------------------------------- 2) Servidor YA COMPILADO desde el Release
$partes = ($Repo -replace '\.git$', '') -split '/'
$owner = $partes[$partes.Count - 2]
$repo = $partes[$partes.Count - 1]
$urlServidor = "https://github.com/$owner/$repo/releases/latest/download/SerchTube-servidor.zip"
$temp = Join-Path $env:TEMP ("serchtube-servidor-" + (Get-Date -Format 'yyyyMMdd-HHmmss'))
$zip = "$temp.zip"

Info "Descargando el servidor compilado del ultimo Release..."
$descargado = $false
try {
  Invoke-WebRequest -Uri $urlServidor -OutFile $zip -UseBasicParsing -TimeoutSec 180
  $descargado = (Test-Path -LiteralPath $zip) -and ((Get-Item $zip).Length -gt 100000)
} catch {
  Aviso "No pude descargar el servidor compilado ($($_.Exception.Message))."
}

if ($descargado) {
  New-Item -ItemType Directory -Force -Path $temp | Out-Null
  try {
    Expand-Archive -LiteralPath $zip -DestinationPath $temp -Force
    # El ZIP trae la carpeta dist\ en su raiz (o dentro de 'dist')
    $origenDist = $null
    foreach ($cand in @((Join-Path $temp 'dist'), (Join-Path $temp 'SerchTube-servidor\dist'))) {
      if (Test-Path -LiteralPath (Join-Path $cand 'server.cjs')) { $origenDist = $cand; break }
    }
    if (-not $origenDist) {
      $encontrado = Get-ChildItem -Path $temp -Recurse -Filter 'server.cjs' -ErrorAction SilentlyContinue | Select-Object -First 1
      if ($encontrado) { $origenDist = $encontrado.Directory.FullName }
    }
    if ($origenDist) {
      $destino = Join-Path $Carpeta 'dist'
      New-Item -ItemType Directory -Force -Path $destino | Out-Null
      $rc = Start-Process -FilePath 'robocopy.exe' -Wait -PassThru -WindowStyle Hidden -ArgumentList @(
        "`"$origenDist`"", "`"$destino`"", '/E', '/NFL', '/NDL', '/NJH', '/NJS', '/NP'
      )
      if ($rc.ExitCode -lt 8) {
        Info "Servidor compilado aplicado en $destino (robocopy $($rc.ExitCode))."
      } else {
        Aviso "La copia del servidor fallo (robocopy $($rc.ExitCode))."
      }
    } else {
      Aviso "El paquete descargado no traia dist\\server.cjs."
    }
  } catch {
    Aviso "No pude aplicar el servidor compilado: $($_.Exception.Message)"
  }
} else {
  Aviso "Sin servidor compilado: la app seguira con el dist que ya tenia."
}

Remove-Item -LiteralPath $zip -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $temp -Recurse -Force -ErrorAction SilentlyContinue

# ---------------------------------------------------------------- 3) Reinicio
if ($SinReiniciar) { Info "No se reinicia (-SinReiniciar)."; exit 0 }

$lanzador = Join-Path $Carpeta 'scripts\start-serchtube.ps1'
if (-not (Test-Path -LiteralPath $lanzador)) { Aviso "No encontre el lanzador."; exit 1 }

Info "Reiniciando SerchTube..."
try {
  foreach ($p in @(Get-NetTCPConnection -LocalPort $Puerto -State Listen -ErrorAction SilentlyContinue |
                   Select-Object -ExpandProperty OwningProcess -Unique)) {
    Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
  }
} catch { }
Start-Sleep -Seconds 2
Start-Process -FilePath 'powershell.exe' -WindowStyle Hidden -ArgumentList @(
  '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$lanzador`"", '-SinAutoInicio'
) | Out-Null
Start-Sleep -Seconds 6

# Comprobacion final
$ok = $false
for ($i = 1; $i -le 10; $i++) {
  try {
    $r = Invoke-WebRequest -Uri "http://localhost:$Puerto/api/health" -UseBasicParsing -TimeoutSec 3
    if ([int]$r.StatusCode -eq 200) { $ok = $true; break }
  } catch { }
  Start-Sleep -Seconds 2
}
Info $(if ($ok) { "SerchTube actualizado y respondiendo en http://localhost:$Puerto" } else { "El servidor tarda en responder; revisa logs\servidor.log." })
