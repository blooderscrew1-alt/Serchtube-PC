<#
  SerchTube Music - Lanzador de arranque en UNA sola ventana de Edge
  ==================================================================

  Que hace:
    1. Comprueba si el servidor de SerchTube ya responde en el puerto 3000.
       - Si responde, NO arranca otro servidor (evita el clasico "puerto ocupado").
       - Si no responde, lo arranca oculto y espera a que este listo.
    2. Abre Edge con un PERFIL DEDICADO (--user-data-dir) en modo app:
       - Al ser un perfil propio, Edge no restaura las pestanas de tu sesion normal,
         que es la causa habitual de que al encender la PC se abran varias.
       - En modo app no hay barra de pestanas: es una sola ventana con la app.
    3. Si ya hay una ventana de SerchTube abierta con ese perfil, NO abre otra:
       la trae al frente. Asi, por mas veces que se ejecute (arranque, doble clic,
       script de la PC), nunca se acumulan ventanas ni pestanas.

  Uso:
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts\start-serchtube.ps1
    powershell ... -File scripts\start-serchtube.ps1 -Modo pestana
    powershell ... -File scripts\start-serchtube.ps1 -SinNavegador      (solo servidor)
    powershell ... -File scripts\start-serchtube.ps1 -AutoconcederMicro (kiosco 100% voz)
#>
[CmdletBinding()]
param(
  # 'app' = ventana sin pestanas (recomendado) | 'pestana' = una pestana normal con perfil dedicado
  [ValidateSet('app', 'pestana')]
  [string]$Modo = 'app',

  [int]$Puerto = 3000,

  # Perfil de Edge exclusivo de SerchTube: aislado de tu sesion normal del navegador
  [string]$PerfilEdge = (Join-Path $env:LOCALAPPDATA 'SerchTubeEdge'),

  # Concede permisos de microfono/camara automaticamente (util en modo kiosco)
  [switch]$AutoconcederMicro,

  # Solo comprobar/arrancar el servidor, sin abrir el navegador
  [switch]$SinNavegador,

  [int]$EsperaServidor = 120
)

$ErrorActionPreference = 'Stop'
$Raiz = Split-Path -Parent $PSScriptRoot
$Url = "http://localhost:$Puerto"
$TituloVentana = 'SerchTube Music'

function Write-Paso([string]$Mensaje) { Write-Host "[SerchTube] $Mensaje" -ForegroundColor Cyan }
function Write-Aviso([string]$Mensaje) { Write-Host "[SerchTube] $Mensaje" -ForegroundColor Yellow }

function Test-Servidor {
  try {
    $r = Invoke-WebRequest -Uri "$Url/api/health" -UseBasicParsing -TimeoutSec 3
    return [int]$r.StatusCode -eq 200
  } catch {
    return $false
  }
}

function Get-EdgeExe {
  $candidatos = @()
  if (${env:ProgramFiles(x86)}) { $candidatos += (Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe') }
  if ($env:ProgramFiles) { $candidatos += (Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe') }
  if ($env:LOCALAPPDATA) { $candidatos += (Join-Path $env:LOCALAPPDATA 'Microsoft\Edge\Application\msedge.exe') }
  foreach ($ruta in @(
      'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe',
      'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe')) {
    try {
      $p = (Get-ItemProperty -Path $ruta -ErrorAction Stop).'(default)'
      if ($p) { $candidatos += $p }
    } catch { }
  }
  foreach ($c in $candidatos) { if ($c -and (Test-Path -LiteralPath $c)) { return $c } }
  return $null
}

function Get-VentanasSerchTube {
  # Ventanas de Edge abiertas con NUESTRO perfil dedicado (el proceso raiz lleva el flag)
  $encontradas = @()
  try {
    $procesos = Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" -ErrorAction Stop |
      Where-Object { $_.CommandLine -and $_.CommandLine -like "*$PerfilEdge*" }
  } catch {
    $procesos = @()
  }
  foreach ($p in $procesos) {
    $wp = Get-Process -Id $p.ProcessId -ErrorAction SilentlyContinue
    if ($wp -and $wp.MainWindowHandle -ne 0) { $encontradas += $wp }
  }
  return $encontradas
}

function Set-FocoVentana($Handle) {
  try {
    if (-not ('SerchTube.Nativo' -as [type])) {
      Add-Type -Namespace 'SerchTube' -Name 'Nativo' -MemberDefinition @'
[System.Runtime.InteropServices.DllImport("user32.dll")] public static extern bool SetForegroundWindow(System.IntPtr hWnd);
[System.Runtime.InteropServices.DllImport("user32.dll")] public static extern bool ShowWindow(System.IntPtr hWnd, int nCmdShow);
'@
    }
    [void][SerchTube.Nativo]::ShowWindow($Handle, 9)   # SW_RESTORE
    [void][SerchTube.Nativo]::SetForegroundWindow($Handle)
  } catch { }
}

# ---------------------------------------------------------------- 1) Servidor
Write-Paso "Proyecto: $Raiz"

if (Test-Servidor) {
  Write-Paso "El servidor ya responde en $Url (no se inicia otro)."
} else {
  Write-Paso "El servidor no responde. Iniciandolo oculto..."
  $logDir = Join-Path $Raiz 'logs'
  if (-not (Test-Path -LiteralPath $logDir)) { New-Item -ItemType Directory -Force -Path $logDir | Out-Null }
  $log = Join-Path $logDir 'servidor.log'
  $comando = '/c npm run dev >> "' + $log + '" 2>&1'
  Start-Process -FilePath 'cmd.exe' -ArgumentList $comando -WorkingDirectory $Raiz -WindowStyle Hidden

  $limite = (Get-Date).AddSeconds($EsperaServidor)
  while ((Get-Date) -lt $limite -and -not (Test-Servidor)) { Start-Sleep -Milliseconds 800 }

  if (Test-Servidor) {
    Write-Paso "Servidor listo en $Url."
  } else {
    Write-Aviso "El servidor no respondio en $EsperaServidor s. Revisa el registro: $log"
  }
}

if ($SinNavegador) {
  Write-Paso "Modo prueba (-SinNavegador): no se abre Edge."
  exit 0
}

# --------------------------------------------------- 2) Una sola ventana ya abierta
$abiertas = @(Get-VentanasSerchTube)
if ($abiertas.Count -gt 0) {
  Write-Paso "Ya hay una ventana de SerchTube abierta (PID $($abiertas[0].Id)). Se trae al frente; no se abre otra."
  Set-FocoVentana $abiertas[0].MainWindowHandle
  exit 0
}

# ------------------------------------------------------------- 3) Abrir Edge
$edge = Get-EdgeExe
if (-not $edge) {
  Write-Aviso "No encontre msedge.exe. Abre Edge a mano en $Url"
  exit 1
}

$argumentos = @(
  "--user-data-dir=$PerfilEdge",
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-session-crashed-bubble',
  '--hide-crash-restore-bubble',
  '--start-maximized'
)
if ($Modo -eq 'app') { $argumentos += "--app=$Url" } else { $argumentos += $Url }
if ($AutoconcederMicro) { $argumentos += '--use-fake-ui-for-media-stream' }

Write-Paso "Abriendo Edge en modo '$Modo' con perfil dedicado:"
Write-Paso "  $PerfilEdge"
Start-Process -FilePath $edge -ArgumentList $argumentos
Write-Paso "Listo. Ventana unica de SerchTube abierta."
