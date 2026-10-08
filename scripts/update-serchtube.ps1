<#
  SerchTube Music - Actualizar en un clic (sin volver a descargar ni reinstalar)
  ============================================================================

  Que hace:
    1. Comprueba que esta carpeta es el proyecto.
    2. Trae SOLO lo que cambio desde GitHub, con git (rapido, sin bajar todo).
       Tus claves (.env), tus registros (logs/) y node_modules/ NO se tocan.
    3. Ejecuta "npm install" UNICAMENTE si cambio package.json / package-lock.json /
       bun.lock o si falta node_modules. Si no cambio nada, no pierde tiempo.
    4. Reinicia el servidor si estaba corriendo, para que tome los cambios.
    5. Muestra un resumen: de que version a que version y que hizo.

  Si la carpeta NO es un repositorio git (la bajaste como ZIP), no hace falta Git:
  el script descarga el ZIP del repositorio y copia encima, conservando node_modules,
  .env y logs.

  Uso:
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts\update-serchtube.ps1
    powershell ... -File scripts\update-serchtube.ps1 -SinReiniciar
    powershell ... -File scripts\update-serchtube.ps1 -Forzar      (descarta cambios locales)
    powershell ... -File scripts\update-serchtube.ps1 -Rama otra-rama
    powershell ... -File scripts\update-serchtube.ps1 -SinDependencias

  Pensado para CUALQUIER PC con Windows: no depende de rutas ni de este equipo.
#>
[CmdletBinding()]
param(
  [string]$Rama = 'main',

  # Repositorio a usar cuando la carpeta no es un repo git (modo ZIP)
  [string]$Repo = 'https://github.com/blooderscrew1-alt/Serchtube-PC.git',

  [int]$Puerto = 3000,

  # Descarta los cambios locales de esta carpeta en vez de abortar
  [switch]$Forzar,

  # No tocar el servidor (util si lo manejas tú)
  [switch]$SinReiniciar,

  # Reiniciar el servidor aunque no haya cambios (para aplicar cambios a mano)
  [switch]$Reiniciar,

  # No ejecutar npm install aunque hayan cambiado las dependencias
  [switch]$SinDependencias,

  # Instalar lo que falte (Node.js / Git) con winget si es posible
  [switch]$InstalarRequisitos
)

$ErrorActionPreference = 'Stop'
$Raiz = Split-Path -Parent $PSScriptRoot
$LogDir = Join-Path $Raiz 'logs'
$NombreLog = 'actualizar.log'

function Write-Paso([string]$m) { Write-Host "[Actualizar] $m" -ForegroundColor Cyan; Write-Registro $m }
function Write-Aviso([string]$m) { Write-Host "[Actualizar] $m" -ForegroundColor Yellow; Write-Registro "AVISO: $m" }
function Write-Mal([string]$m) { Write-Host "[Actualizar] $m" -ForegroundColor Red; Write-Registro "ERROR: $m" }
function Write-Registro([string]$m) {
  try {
    if (-not (Test-Path -LiteralPath $LogDir)) { New-Item -ItemType Directory -Force -Path $LogDir | Out-Null }
    Add-Content -LiteralPath (Join-Path $LogDir $NombreLog) -Value ("[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $m)
  } catch { }
}
function Test-Comando([string]$nombre) { return [bool](Get-Command $nombre -ErrorAction SilentlyContinue) }
function Get-ServidorPid {
  try {
    return @(Get-NetTCPConnection -LocalPort $Puerto -State Listen -ErrorAction SilentlyContinue |
      Select-Object -ExpandProperty OwningProcess -Unique)
  } catch { return @() }
}
function Stop-Servidor {
  $pids = @(Get-ServidorPid)
  if ($pids.Count -eq 0) { return $false }
  foreach ($proceso in $pids) {
    try {
      $p = Get-Process -Id $proceso -ErrorAction SilentlyContinue
      if ($p) {
        Write-Paso "Deteniendo el servidor (PID $proceso, $($p.ProcessName))..."
        Stop-Process -Id $proceso -Force -ErrorAction SilentlyContinue
      }
    } catch { }
  }
  for ($i = 0; $i -lt 24; $i++) {
    Start-Sleep -Milliseconds 500
    if (@(Get-ServidorPid).Count -eq 0) { break }
  }
  return $true
}
function Start-Servidor {
  if (-not (Test-Path -LiteralPath $LogDir)) { New-Item -ItemType Directory -Force -Path $LogDir | Out-Null }
  $log = Join-Path $LogDir 'servidor.log'
  $metodos = @()
  if (Test-Path -LiteralPath (Join-Path $Raiz 'dist\server.cjs')) { $metodos += 'node dist\server.cjs' }
  $metodos += 'npm run dev'
  foreach ($metodo in $metodos) {
    Write-Paso "Arrancando el servidor con: $metodo"
    Start-Process -FilePath 'cmd.exe' -WorkingDirectory $Raiz -WindowStyle Hidden `
      -ArgumentList ('/c ' + $metodo + ' >> "' + $log + '" 2>&1')
    $limite = (Get-Date).AddSeconds(60)
    while ((Get-Date) -lt $limite) {
      try {
        $r = Invoke-WebRequest -Uri "http://localhost:$Puerto/api/health" -UseBasicParsing -TimeoutSec 3
        if ([int]$r.StatusCode -eq 200) { Write-Paso "Servidor listo en http://localhost:$Puerto"; return $true }
      } catch { }
      Start-Sleep -Milliseconds 800
    }
    Write-Aviso "'$metodo' no respondio; se prueba el siguiente metodo."
  }
  Write-Aviso "No se pudo confirmar el arranque. Revisa logs\servidor.log"
  return $false
}
function Get-HashArchivo([string]$ruta) {
  if (-not (Test-Path -LiteralPath $ruta)) { return '' }
  return (Get-FileHash -LiteralPath $ruta -Algorithm SHA256).Hash
}

function Instalar-ConWinget([string]$id, [string]$nombre) {
  if (-not (Test-Comando 'winget')) { return $false }
  Write-Paso "Instalando $nombre con winget ($id)..."
  try {
    & winget install --id $id -e --accept-source-agreements --accept-package-agreements --silent
  } catch {
    Write-Aviso "winget no pudo instalar $nombre."
    return $false
  }
  $env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
              [System.Environment]::GetEnvironmentVariable('Path', 'User')
  return $true
}

function Comprobar-Requisitos {
  # Node.js (obligatorio para correr/actualizar) y Git (opcional: sin el se usa el ZIP)
  $faltan = @()
  if (-not (Test-Comando 'node') -or -not (Test-Comando 'npm')) {
    $faltan += @{ Nombre = 'Node.js (incluye npm)'; Id = 'OpenJS.NodeJS.LTS'; Url = 'https://nodejs.org' }
  }
  if (-not (Test-Comando 'git')) {
    $faltan += @{ Nombre = 'Git'; Id = 'Git.Git'; Url = 'https://git-scm.com/download/win' }
  }
  if ($faltan.Count -eq 0) {
    Write-Paso "Requisitos OK (node, npm, git)."
    return
  }
  foreach ($f in $faltan) { Write-Aviso "Falta $($f.Nombre)  ->  $($f.Url)" }
  if ($InstalarRequisitos) {
    foreach ($f in $faltan) { Instalar-ConWinget $f.Id $f.Nombre | Out-Null }
    $siguen = @()
    if (-not (Test-Comando 'node') -or -not (Test-Comando 'npm')) { $siguen += 'Node.js' }
    if (-not (Test-Comando 'git')) { $siguen += 'Git' }
    if ($siguen.Count -gt 0) {
      Write-Aviso "Todavia faltan: $($siguen -join ', '). Cierra esta ventana, vuelve a abrirla y ejecuta de nuevo."
    } else {
      Write-Paso "Requisitos instalados."
    }
  } elseif (Test-Comando 'winget') {
    Write-Paso "Puedo instalarlos yo: vuelve a ejecutar con -InstalarRequisitos"
  }
}

# ------------------------------------------------------------------ 0) Entorno
Write-Paso "Proyecto: $Raiz"
if (-not (Test-Path -LiteralPath (Join-Path $Raiz 'package.json')) -or
    -not (Test-Path -LiteralPath (Join-Path $Raiz 'server.ts'))) {
  Write-Mal "Esta carpeta no parece el proyecto de SerchTube (falta package.json o server.ts)."
  exit 1
}

$esRepo = Test-Path -LiteralPath (Join-Path $Raiz '.git')

# ------------------------------------------- 0b) Requisitos (sirve en PC nuevas)
Comprobar-Requisitos

$antes = ''
$despues = ''
$antesTitulo = ''
$despuesTitulo = ''
$detras = 0
$cambiado = $false
$stasheado = $false
$depsSaltadas = $false
$hashPackageAntes = Get-HashArchivo (Join-Path $Raiz 'package.json')
$hashLockAntes = Get-HashArchivo (Join-Path $Raiz 'package-lock.json')

# ============================================================ MODO GIT (rapido)
if ($esRepo -and (Test-Comando 'git')) {
  $remoto = (git -C $Raiz remote get-url origin 2>$null)
  if (-not $remoto) { Write-Aviso "El repo no tiene remoto 'origin'." } else { Write-Paso "Repositorio: $remoto" }

  $sucio = @(git -C $Raiz status --porcelain)
  if ($sucio.Count -gt 0) {
    if ($Forzar) {
      Write-Aviso "Hay $($sucio.Count) archivo(s) con cambios locales: se descartan (-Forzar)."
      git -C $Raiz reset --hard --quiet | Out-Null
    } else {
      Write-Aviso "Hay $($sucio.Count) archivo(s) con cambios locales: se guardan temporalmente (git stash)."
      git -C $Raiz stash push -u -m "antes de actualizar $(Get-Date -Format 'yyyy-MM-dd HH:mm')" | Out-Null
      if ($LASTEXITCODE -ne 0) {
        Write-Mal "No pude guardar los cambios locales. Guardalos tú o ejecuta con -Forzar."
        exit 1
      }
      $stasheado = $true
      Write-Aviso "Tus cambios quedaron en 'git stash'. Para recuperarlos despues:  git stash pop"
    }
  }

  $antes = (git -C $Raiz rev-parse --short HEAD 2>$null)
  $antesTitulo = (git -C $Raiz log -1 --pretty=%s 2>$null)

  Write-Paso "Buscando actualizaciones en la rama '$Rama'..."
  git -C $Raiz fetch origin $Rama --quiet
  if ($LASTEXITCODE -ne 0) { Write-Mal "No se pudo consultar el repositorio (revisa internet)."; exit 1 }

  $cuenta = (git -C $Raiz rev-list --count "HEAD..origin/$Rama" 2>$null)
  if ($cuenta) { $detras = [int]$cuenta }

  if ($Forzar) {
    git -C $Raiz reset --hard "origin/$Rama" --quiet
  } else {
    git -C $Raiz pull --ff-only origin $Rama --quiet
    if ($LASTEXITCODE -ne 0) {
      Write-Mal "No se pudo actualizar con 'git pull' (cambios locales o historiales distintos)."
      Write-Mal "Solucion rapida: vuelve a ejecutar con -Forzar (descarta cambios locales de ESTA carpeta)."
      exit 1
    }
  }

  $despues = (git -C $Raiz rev-parse --short HEAD 2>$null)
  $despuesTitulo = (git -C $Raiz log -1 --pretty=%s 2>$null)
  $cambiado = ($antes -ne $despues)
}
# ================================================= MODO ZIP (sin git, o sin repo)
else {
  if ($esRepo) { Write-Aviso "No encontre Git: se actualiza bajando el ZIP del repositorio." }
  else { Write-Paso "Esta copia no es un repositorio git: se actualiza bajando el ZIP (una sola descarga)." }

  $urlZip = $Repo
  if ($urlZip -notmatch 'github\.com') { Write-Mal "Para el modo ZIP hace falta un repo de GitHub. Usa -Repo <url>."; exit 1 }
  $limpio = $urlZip -replace '\.git$', '' -replace '^https?://github\.com/', ''
  $partes = $limpio -split '/'
  if ($partes.Count -lt 2) { Write-Mal "No pude interpretar el repositorio: $Repo"; exit 1 }
  $zipUrl = "https://codeload.github.com/$($partes[0])/$($partes[1])/zip/refs/heads/$Rama"

  $temp = Join-Path $env:TEMP ("serchtube-update-" + [guid]::NewGuid().ToString('N').Substring(0, 8))
  New-Item -ItemType Directory -Force -Path $temp | Out-Null
  try {
    $zip = Join-Path $temp 'repo.zip'
    Write-Paso "Descargando $zipUrl"
    Invoke-WebRequest -Uri $zipUrl -OutFile $zip -UseBasicParsing -TimeoutSec 180
    Expand-Archive -LiteralPath $zip -DestinationPath $temp -Force
    $carpeta = Get-ChildItem -Path $temp -Directory | Where-Object { $_.Name -like "$($partes[1])-*" } | Select-Object -First 1
    if (-not $carpeta) { Write-Mal "El ZIP no tiene la estructura esperada."; exit 1 }
    $antes = (Get-HashArchivo (Join-Path $Raiz 'server.ts')).Substring(0, 8)
    Write-Paso "Copiando archivos nuevos (sin tocar node_modules, logs ni .env)..."
    # Se usa robocopy porque mezcla carpetas correctamente. Con Copy-Item, si la
    # carpeta destino ya existe, el contenido terminaria anidado (scripts\scripts).
    $rc = Start-Process -FilePath 'robocopy.exe' -Wait -PassThru -WindowStyle Hidden -ArgumentList @(
      "`"$($carpeta.FullName)`"", "`"$Raiz`"",
      '/E', '/XD', 'node_modules', 'logs', 'dist', '.git', '/XF', '.env*',
      '/NFL', '/NDL', '/NJH', '/NJS', '/NP', '/R:1', '/W:1'
    )
    if ($rc.ExitCode -ge 8) {
      Write-Mal "La copia de archivos fallo (robocopy codigo $($rc.ExitCode))."
      exit 1
    }
    Write-Registro "robocopy codigo $($rc.ExitCode)"
    $despues = (Get-HashArchivo (Join-Path $Raiz 'server.ts')).Substring(0, 8)
    $antesTitulo = "hash $antes"
    $despuesTitulo = "hash $despues"
    $cambiado = ($antes -ne $despues)
  } finally {
    Remove-Item -Recurse -Force $temp -ErrorAction SilentlyContinue
  }
}

if (-not $cambiado) {
  Write-Paso "Ya estas en la ultima version. No hay nada que aplicar."
} else {
  Write-Paso "Actualizado: $antes -> $despues"
  if ($detras -gt 0) { Write-Paso "  Commits nuevos: $detras" }
  if ($despuesTitulo) { Write-Paso "  Ultimo: $despuesTitulo" }
}

# ------------------------------------------------------- 1) Dependencias (npm)
$hashPackageDespues = Get-HashArchivo (Join-Path $Raiz 'package.json')
$hashLockDespues = Get-HashArchivo (Join-Path $Raiz 'package-lock.json')
$necesitaNpm = $false
if (-not (Test-Path -LiteralPath (Join-Path $Raiz 'node_modules'))) {
  Write-Paso "No hay node_modules: hay que instalar dependencias."
  $necesitaNpm = $true
} elseif ($cambiado -and ($hashPackageAntes -ne $hashPackageDespues -or $hashLockAntes -ne $hashLockDespues)) {
  Write-Paso "Cambiaron las dependencias (package.json / package-lock.json)."
  $necesitaNpm = $true
} else {
  Write-Paso "No hace falta 'npm install' (dependencias sin cambios)."
}

if ($necesitaNpm -and $SinDependencias) {
  Write-Aviso "Cambiaron las dependencias pero pediste -SinDependencias: ejecuta 'npm install' a mano."
  $depsSaltadas = $true
  $necesitaNpm = $false
}
if ($necesitaNpm) {
  if (-not (Test-Comando 'npm')) { Write-Mal "No encontre 'npm'. Instala Node.js (https://nodejs.org)."; exit 1 }
  Write-Paso "Instalando dependencias (puede tardar un minuto)..."
  Push-Location $Raiz
  try {
    & npm install --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { Write-Mal "'npm install' termino con error."; exit 1 }
    Write-Paso "Dependencias al dia."
  } finally { Pop-Location }
}

# ---------------------------------------------------------- 2) Reiniciar servidor
$habiaServidor = (@(Get-ServidorPid).Count -gt 0)
if ($SinReiniciar) {
  Write-Paso "Servidor sin tocar (-SinReiniciar)."
} elseif (-not $cambiado -and -not $Reiniciar) {
  Write-Paso "No hubo cambios que aplicar: el servidor queda como estaba ($(if ($habiaServidor) { 'corriendo' } else { 'apagado' }))."
} else {
  if ($habiaServidor) {
    Stop-Servidor | Out-Null
    Write-Paso "Servidor detenido."
  } else {
    Write-Paso "El servidor estaba apagado: se arranca con el codigo nuevo."
  }
  Start-Servidor | Out-Null
}

# ------------------------------------------------------------------ 3) Resumen
Write-Host ""
Write-Host "================ RESUMEN ================" -ForegroundColor Green
Write-Host " Version anterior : $antes $(if ($antesTitulo) { "- $antesTitulo" })"
Write-Host " Version nueva    : $despues $(if ($despuesTitulo) { "- $despuesTitulo" })"
Write-Host " Dependencias     : $(if ($necesitaNpm) { 'instaladas ahora' } elseif ($depsSaltadas) { 'cambiaron (no instaladas por -SinDependencias)' } else { 'sin cambios' })"
Write-Host " Servidor         : $(if ($SinReiniciar) { 'sin tocar' } elseif (@(Get-ServidorPid).Count -gt 0) { 'corriendo' } else { 'detenido' })"
Write-Host " .env, logs y node_modules no se tocaron."
if ($stasheado) {
  Write-Host " TUS CAMBIOS LOCALES estan guardados en 'git stash'." -ForegroundColor Yellow
  Write-Host "   Para recuperarlos:  git stash pop" -ForegroundColor Yellow
}
Write-Host "=========================================" -ForegroundColor Green
if ($cambiado) { Write-Host "`n  Recarga la ventana de SerchTube (F5) para ver los cambios.`n" -ForegroundColor Yellow }
