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
    4. Registra el arranque automatico en Windows (una sola vez): al encender la PC
       SerchTube arranca solo, sin consolas visibles, via el guion silencioso
       scripts\start-serchtube-silencioso.vbs (acceso directo en la carpeta Inicio).

  Uso:
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts\start-serchtube.ps1
    powershell ... -File scripts\start-serchtube.ps1 -QuitarAutoInicio
    powershell ... -File scripts\start-serchtube.ps1 -SinAutoInicio
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

  # No tocar el arranque automatico de Windows
  [switch]$SinAutoInicio,

  # Quitar SerchTube del arranque automatico de Windows y salir
  [switch]$QuitarAutoInicio,

  # Lo pone el guion silencioso cuando Windows lo lanza al iniciar sesion
  [switch]$AutoInicio,

  # En modo autoinicio: espera para que Windows termine de iniciar sesion
  [int]$RetardoSegundos = 15,

  [int]$EsperaServidor = 120
)

$ErrorActionPreference = 'Stop'
$Raiz = Split-Path -Parent $PSScriptRoot
$Url = "http://localhost:$Puerto"
$NombreAutoInicio = 'SerchTube Music'
$VbsSilencioso = Join-Path $PSScriptRoot 'start-serchtube-silencioso.vbs'
$ClaveRun = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'

# Contenido del guion silencioso, por si alguien borro el archivo del repo
$GuionVbs = @'
' SerchTube Music - arranque silencioso para el autoinicio de Windows
' Lo usa (y recrea) scripts\start-serchtube.ps1. No hace falta abrirlo a mano.
Option Explicit
Dim fso, sh, raiz, ps1, cmd
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh  = CreateObject("WScript.Shell")
' ...\<proyecto>\scripts\start-serchtube-silencioso.vbs -> dos niveles arriba = raiz
raiz = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
ps1  = raiz & "\scripts\start-serchtube.ps1"
If Not fso.FileExists(ps1) Then WScript.Quit 1
cmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & ps1 & """ -AutoInicio"
sh.Run cmd, 0, False
'@

function Write-Paso([string]$Mensaje) {
  Write-Host "[SerchTube] $Mensaje" -ForegroundColor Cyan
  Write-Registro $Mensaje
}
function Write-Aviso([string]$Mensaje) {
  Write-Host "[SerchTube] $Mensaje" -ForegroundColor Yellow
  Write-Registro "AVISO: $Mensaje"
}
function Write-Registro([string]$Mensaje) {
  try {
    $dir = Join-Path $Raiz 'logs'
    if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    Add-Content -LiteralPath (Join-Path $dir 'lanzador.log') -Value ("[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Mensaje)
  } catch { }
}

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

function Get-RutaAccesoInicio {
  Join-Path ([Environment]::GetFolderPath('Startup')) "$NombreAutoInicio.lnk"
}

function Get-WScriptExe {
  $w = Join-Path $env:SystemRoot 'System32\wscript.exe'
  if (Test-Path -LiteralPath $w) { return $w }
  return 'wscript.exe'
}

function Get-ComandoAutoInicio {
  '"' + (Get-WScriptExe) + '" "' + $VbsSilencioso + '"'
}

function Registrar-AutoInicio {
  # Devuelve $true si lo registro ahora, $false si ya estaba bien puesto
  if (-not (Test-Path -LiteralPath $VbsSilencioso)) {
    Set-Content -LiteralPath $VbsSilencioso -Value $GuionVbs -Encoding ASCII
  }

  $lnk = Get-RutaAccesoInicio
  if (Test-Path -LiteralPath $lnk) {
    try {
      $sh = New-Object -ComObject WScript.Shell
      $actual = $sh.CreateShortcut($lnk)
      $apunta = ($actual.Arguments -like "*$VbsSilencioso*")
      if ($apunta -and (Test-Path -LiteralPath $actual.TargetPath)) { return $false }
    } catch { }
  }

  try {
    $sh = New-Object -ComObject WScript.Shell
    $acceso = $sh.CreateShortcut($lnk)
    $acceso.TargetPath = (Get-WScriptExe)
    $acceso.Arguments = '"' + $VbsSilencioso + '"'
    $acceso.WorkingDirectory = $Raiz
    $acceso.WindowStyle = 7
    $acceso.Description = 'Arranca SerchTube Music: servidor + una sola ventana de Edge'
    $acceso.Save()
    Remove-ItemProperty -Path $ClaveRun -Name $NombreAutoInicio -ErrorAction SilentlyContinue
    return $true
  } catch {
    # Respaldo: clave Run del usuario (por si la carpeta Inicio no se puede escribir)
    if (-not (Test-Path -LiteralPath $ClaveRun)) { New-Item -Path $ClaveRun -Force | Out-Null }
    Set-ItemProperty -Path $ClaveRun -Name $NombreAutoInicio -Value (Get-ComandoAutoInicio)
    return $true
  }
}

function Quitar-AutoInicio {
  $quitado = $false
  $lnk = Get-RutaAccesoInicio
  if (Test-Path -LiteralPath $lnk) {
    Remove-Item -LiteralPath $lnk -Force -ErrorAction SilentlyContinue
    $quitado = $true
  }
  try {
    if (Get-ItemProperty -Path $ClaveRun -Name $NombreAutoInicio -ErrorAction Stop) {
      Remove-ItemProperty -Path $ClaveRun -Name $NombreAutoInicio -ErrorAction SilentlyContinue
      $quitado = $true
    }
  } catch { }
  return $quitado
}

# ------------------------------------------------- 0) Quitar autoinicio y salir
if ($QuitarAutoInicio) {
  if (Quitar-AutoInicio) {
    Write-Paso "Autoinicio de Windows eliminado: SerchTube ya no se abrira solo al encender la PC."
  } else {
    Write-Aviso "No habia autoinicio registrado de SerchTube."
  }
  exit 0
}

# ------------------------------------------- 1) Arranque automatico: dar tiempo
if ($AutoInicio -and $RetardoSegundos -gt 0) {
  Write-Paso "Arranque automatico al iniciar Windows: esperando $RetardoSegundos s antes de abrir la app..."
  Start-Sleep -Seconds $RetardoSegundos
}

# ---------------------------------------------------------------- 2) Servidor
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

# ------------------------------------------------- 3) Arranque automatico (una vez)
if ($SinAutoInicio) {
  Write-Paso "Autoinicio de Windows sin cambios (-SinAutoInicio)."
} else {
  try {
    if (Registrar-AutoInicio) {
      Write-Paso "Registrado en el autoinicio de Windows: desde el proximo encendido SerchTube se abre solo."
      Write-Paso "  Acceso directo: $(Get-RutaAccesoInicio)"
      Write-Paso "  Para desactivarlo: 'Quitar autoinicio de SerchTube.bat'"
    } else {
      Write-Paso "El autoinicio de Windows ya estaba configurado."
    }
  } catch {
    Write-Aviso "No se pudo registrar el autoinicio: $($_.Exception.Message)"
  }
}

if ($SinNavegador) {
  Write-Paso "Modo prueba (-SinNavegador): no se abre Edge."
  exit 0
}

# --------------------------------------------------- 4) Una sola ventana ya abierta
$abiertas = @(Get-VentanasSerchTube)
if ($abiertas.Count -gt 0) {
  Write-Paso "Ya hay una ventana de SerchTube abierta (PID $($abiertas[0].Id)). Se trae al frente; no se abre otra."
  Set-FocoVentana $abiertas[0].MainWindowHandle
  exit 0
}

# ------------------------------------------------------------- 5) Abrir Edge
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
