<#
  SerchTube Music - Instalador/actualizador PORTABLE (se ejecuta en la PC host)
  =============================================================================

  Lo lanza el ejecutable SerchTube.exe que genera scripts\build-portable.ps1.
  Hace todo sin pedir nada y sin necesitar GitHub ni npm:

    1. Copia la aplicacion a %LOCALAPPDATA%\SerchTube (sin pedir administrador).
    2. Conserva tus claves (.env) y tus registros (logs) si ya estaba instalada.
    3. Detiene el servidor anterior si estaba corriendo.
    4. Registra el arranque automatico, crea un acceso directo en el Escritorio y
       abre SerchTube.

  Requisitos de la PC host: Windows y Node.js en el PATH (nada mas).

  Uso (lo normal es que no lo ejecutes a mano):
    powershell -NoProfile -ExecutionPolicy Bypass -File Instalar-Portable.ps1
    powershell ... -File Instalar-Portable.ps1 -Carpeta "D:\SerchTube" -SinAutoInicio
#>
[CmdletBinding()]
param(
  # Carpeta donde instalar (por defecto %LOCALAPPDATA%\SerchTube)
  [string]$Carpeta = '',

  [int]$Puerto = 3000,

  # No registrar el arranque automatico de Windows
  [switch]$SinAutoInicio,

  # No abrir la ventana de SerchTube al terminar
  [switch]$SinAbrir,

  # No pausar al final (para pruebas automaticas)
  [switch]$SinPausa,

  # Nombre del zip/marker dentro del paquete (lo fija build-portable)
  [string]$Zip = 'SerchTube-App.zip'
)

$ErrorActionPreference = 'Stop'
$Origen = $PSScriptRoot                      # carpeta temporal donde se extrajo el .exe
if (-not $Origen) { $Origen = Split-Path -Parent $MyInvocation.MyCommand.Path }

# Log para poder diagnosticar si algo falla en la PC host
$LogInstalacion = Join-Path $env:TEMP 'serchtube-install.log'
function Registrar([string]$m) {
  try {
    Add-Content -LiteralPath $LogInstalacion -Value ("[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $m)
  } catch { }
}

function Write-Paso([string]$m) { Write-Host "[SerchTube] $m" -ForegroundColor Cyan; Registrar $m }
function Write-Aviso([string]$m) { Write-Host "[SerchTube] $m" -ForegroundColor Yellow; Registrar "AVISO: $m" }
function Write-Mal([string]$m) { Write-Host "[SerchTube] $m" -ForegroundColor Red; Registrar "ERROR: $m" }

if (-not $Carpeta) { $Carpeta = Join-Path $env:LOCALAPPDATA 'SerchTube' }

Remove-Item -LiteralPath $LogInstalacion -Force -ErrorAction SilentlyContinue
Registrar "=== Instalacion/actualizacion de SerchTube ==="
Registrar "Origen (extraccion): $Origen"
Registrar "PSScriptRoot: $PSScriptRoot"
Registrar "Carpeta destino: $Carpeta"
Registrar "Usuario: $env:USERNAME | Equipo: $env:COMPUTERNAME | PowerShell: $($PSVersionTable.PSVersion)"
Registrar "Node: $((Get-Command node -ErrorAction SilentlyContinue).Source)"

Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host "   SerchTube Music - Instalacion / Actualizacion" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""

# ------------------------------------------------------------- 1) Requisitos
$zip = Join-Path $Origen $Zip
if (-not (Test-Path -LiteralPath $zip)) {
  Write-Mal "No encuentro el paquete de la aplicacion ($Zip) en $Origen."
  Write-Mal "Contenido de esa carpeta:"
  foreach ($f in @(Get-ChildItem -LiteralPath $Origen -ErrorAction SilentlyContinue)) { Write-Mal "   - $($f.Name)" }
  Registrar "No se encontro $zip"
  if (-not $SinPausa) { Read-Host "`nPulsa ENTER para cerrar" }
  exit 1
}
Registrar "Paquete encontrado: $zip ($([math]::Round((Get-Item $zip).Length/1MB,2)) MB)"

# ¿El paquete trae su propio Node? (variante "con Node": no requiere nada instalado)
$traeNode = Test-Path -LiteralPath (Join-Path $Origen 'node-incluido.txt')
if (-not $traeNode) {
  try {
    Add-Type -AssemblyName System.IO.Compression.FileSystem -ErrorAction SilentlyContinue
    $z = [System.IO.Compression.ZipFile]::OpenRead($zip)
    try {
      $traeNode = [bool](@($z.Entries | Where-Object { $_.FullName -eq 'node.exe' }).Count)
    } finally { $z.Dispose() }
  } catch { $traeNode = $false }
}
Registrar "Node incluido en el paquete: $traeNode"

if ($traeNode) {
  Write-Paso "Este paquete incluye Node.js: no hace falta tenerlo instalado."
} else {
  $node = Get-Command node -ErrorAction SilentlyContinue
  if (-not $node) {
    Write-Mal "No encuentro Node.js en esta PC."
    Write-Mal "Pide el paquete que incluye Node, o instala Node desde https://nodejs.org (LTS)."
    if (-not $SinPausa) { Read-Host "`nPulsa ENTER para cerrar" }
    exit 1
  }
  Write-Paso "Node.js: $(node --version)  ($($node.Source))"
}

Write-Paso "Instalando en: $Carpeta"

# ------------------------------------------------- 2) Detener el servidor previo
function Get-PuertoPid {
  try {
    return @(Get-NetTCPConnection -LocalPort $Puerto -State Listen -ErrorAction SilentlyContinue |
      Select-Object -ExpandProperty OwningProcess -Unique)
  } catch { return @() }
}
$pids = @(Get-PuertoPid)
if ($pids.Count -gt 0) {
  Write-Paso "Deteniendo el servidor anterior (PID $($pids -join ', '))..."
  foreach ($p in $pids) { Stop-Process -Id $p -Force -ErrorAction SilentlyContinue }
  for ($i = 0; $i -lt 20; $i++) { Start-Sleep -Milliseconds 500; if (@(Get-PuertoPid).Count -eq 0) { break } }
}

# ------------------------------------------------- 3) Copiar la aplicacion
$cambiosGuardados = @()
foreach ($item in @('.env', 'logs')) {
  $ruta = Join-Path $Carpeta $item
  if (Test-Path -LiteralPath $ruta) { $cambiosGuardados += $item }
}
if ($cambiosGuardados.Count -gt 0) {
  Write-Paso "Conservando: $($cambiosGuardados -join ', ')"
}
if (-not (Test-Path -LiteralPath $Carpeta)) { New-Item -ItemType Directory -Force -Path $Carpeta | Out-Null }

# Se copia TODO menos .env y logs (asi no se pierden al actualizar)
$temp = Join-Path $env:TEMP ("serchtube-expand-" + [guid]::NewGuid().ToString('N').Substring(0, 8))
New-Item -ItemType Directory -Force -Path $temp | Out-Null
try {
  Expand-Archive -LiteralPath $zip -DestinationPath $temp -Force
  $excluir = @('.env', 'logs')
  Get-ChildItem -LiteralPath $temp -Force | ForEach-Object {
    if ($excluir -contains $_.Name) { return }
    $destino = Join-Path $Carpeta $_.Name
    if ($_.PSIsContainer) {
      if (Test-Path -LiteralPath $destino) { Remove-Item -Recurse -Force $destino }
      Copy-Item -LiteralPath $_.FullName -Destination $destino -Recurse -Force
    } else {
      Copy-Item -LiteralPath $_.FullName -Destination $destino -Force
    }
  }
  Write-Paso "Archivos de la aplicacion copiados."
} finally {
  Remove-Item -Recurse -Force $temp -ErrorAction SilentlyContinue
}

if (-not (Test-Path -LiteralPath (Join-Path $Carpeta '.env')) -and
    (Test-Path -LiteralPath (Join-Path $Carpeta '.env.example'))) {
  Copy-Item -LiteralPath (Join-Path $Carpeta '.env.example') -Destination (Join-Path $Carpeta '.env') -Force
  Write-Paso "Creado .env (puedes pegar tus claves; la app tambien las restaura desde el navegador)."
}

$version = 'sin-version'
$marcador = Join-Path $Carpeta 'serchtube-version.txt'
if (Test-Path -LiteralPath $marcador) { $version = (Get-Content -LiteralPath $marcador -TotalCount 1) }
Write-Paso "Version instalada: $version"

# ------------------------------------------------- 4) Acceso directo + arranque
$lanzador = Join-Path $Carpeta 'scripts\start-serchtube.ps1'
if (Test-Path -LiteralPath $lanzador) {
  try {
    $ws = New-Object -ComObject WScript.Shell
    $lnk = Join-Path ([Environment]::GetFolderPath('Desktop')) 'SerchTube Music.lnk'
    $acceso = $ws.CreateShortcut($lnk)
    $acceso.TargetPath = (Join-Path $env:SystemRoot 'System32\wscript.exe')
    $acceso.Arguments = '"' + (Join-Path $Carpeta 'scripts\start-serchtube-silencioso.vbs') + '"'
    $acceso.WorkingDirectory = $Carpeta
    $acceso.Description = 'Abre SerchTube Music'
    $acceso.Save()
    Write-Paso "Acceso directo creado en el Escritorio: 'SerchTube Music'"
  } catch {
    Write-Aviso "No se pudo crear el acceso directo del Escritorio: $($_.Exception.Message)"
  }

  $argumentos = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $lanzador, '-Puerto', "$Puerto")
  if ($SinAutoInicio) { $argumentos += '-SinAutoInicio' }
  if ($SinAbrir) { $argumentos += '-SinNavegador' }
  & powershell @argumentos
} else {
  Write-Mal "No encuentro el lanzador en $Carpeta\scripts. La instalacion quedo incompleta."
}

Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host " LISTO. SerchTube quedo instalado en:" -ForegroundColor Green
Write-Host "   $Carpeta"
Write-Host " Se abre solo al encender la PC y con el acceso"
Write-Host " directo 'SerchTube Music' del Escritorio."
Write-Host ""
Write-Host " Para ACTUALIZAR: ejecuta el nuevo SerchTube.exe"
Write-Host " (conserva tus claves y registros)."
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""
if (-not $SinPausa) { Read-Host "Pulsa ENTER para cerrar" }
