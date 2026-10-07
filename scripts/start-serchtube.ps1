<#
  SerchTube Music - Lanzador de arranque en UNA sola ventana de Edge
  ==================================================================

  Que hace:
    1. Candado: si otro arranque de SerchTube esta en curso, no hace nada.
       (Dos instancias abriendo Edge con el mismo perfil son LA causa del mensaje
       "Microsoft Edge no puede leer ni escribir en el directorio de datos".)
    2. Comprueba si el servidor ya responde en el puerto 3000; si no, lo arranca oculto.
    3. Espera a que el perfil de Edge exista y sea ESCRIBIBLE antes de abrir nada.
    4. Si ya hay un Edge con nuestro perfil (aunque todavia no tenga ventana),
       espera a su ventana y la trae al frente: nunca abre un segundo.
    5. Abre Edge con perfil dedicado en modo app (una sola ventana, sin pestanas).
    6. Verifica que la ventana aparecio; si no, se autorepara: aparta el perfil
       dañado y reintenta con uno limpio.
    7. Registra el arranque automatico de Windows (una sola vez).

  Uso:
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts\start-serchtube.ps1
    powershell ... -File scripts\start-serchtube.ps1 -QuitarAutoInicio
    powershell ... -File scripts\start-serchtube.ps1 -SinAutoInicio
    powershell ... -File scripts\start-serchtube.ps1 -RepararPerfil
    powershell ... -File scripts\start-serchtube.ps1 -PerfilNormal   (usa tu Edge normal)
    powershell ... -File scripts\start-serchtube.ps1 -Modo pestana
    powershell ... -File scripts\start-serchtube.ps1 -SinNavegador
    powershell ... -File scripts\start-serchtube.ps1 -AutoconcederMicro
#>
[CmdletBinding()]
param(
  # 'app' = ventana sin pestanas (recomendado) | 'pestana' = una pestana normal
  [ValidateSet('app', 'pestana')]
  [string]$Modo = 'app',

  [int]$Puerto = 3000,

  # Perfil de Edge exclusivo de SerchTube: aislado de tu sesion normal del navegador
  [string]$PerfilEdge = (Join-Path $env:LOCALAPPDATA 'SerchTubeEdge'),

  # Usar el perfil normal de Edge (sin --user-data-dir): plan B si el perfil dedicado falla
  [switch]$PerfilNormal,

  # Cerrar Edge con nuestro perfil y apartar el perfil (se crea uno limpio)
  [switch]$RepararPerfil,

  [switch]$AutoconcederMicro,
  [switch]$SinNavegador,
  [switch]$SinAutoInicio,
  [switch]$QuitarAutoInicio,

  # Lo pone el guion silencioso cuando Windows lo lanza al iniciar sesion
  [switch]$AutoInicio,

  [int]$RetardoSegundos = 15,
  [int]$EsperaServidor = 120
)

$ErrorActionPreference = 'Stop'
$Raiz = Split-Path -Parent $PSScriptRoot
$Url = "http://localhost:$Puerto"
$NombreAutoInicio = 'SerchTube Music'
$TituloVentana = 'SerchTube Music'
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

function Get-ProcesosSerchTube {
  # Cualquier Edge abierto con NUESTRO perfil, tenga ventana o no.
  # Incluir los que aun no tienen ventana es lo que evita abrir un segundo Edge
  # (el segundo es el que muestra el error del directorio de datos).
  if ($PerfilNormal) { return @() }
  try {
    return @(Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" -ErrorAction Stop |
      Where-Object { $_.CommandLine -and $_.CommandLine -like "*$PerfilEdge*" })
  } catch {
    return @()
  }
}

function Get-VentanasSerchTube {
  $encontradas = @()
  if ($PerfilNormal) {
    # Sin perfil dedicado no hay flag en la linea de comandos: se busca por titulo
    foreach ($wp in @(Get-Process msedge -ErrorAction SilentlyContinue)) {
      if ($wp.MainWindowHandle -ne 0 -and $wp.MainWindowTitle -like "*$TituloVentana*") { $encontradas += $wp }
    }
    return $encontradas
  }
  foreach ($p in @(Get-ProcesosSerchTube)) {
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

function Test-PerfilEscribible {
  try {
    if (Test-Path -LiteralPath $PerfilEdge -PathType Leaf) {
      # Hay un ARCHIVO con el nombre del perfil: Edge no puede usarlo
      $nuevo = Split-Path $PerfilEdge -Leaf
      Rename-Item -LiteralPath $PerfilEdge -NewName ("$nuevo.archivo-" + (Get-Date -Format 'yyyyMMdd-HHmmss')) -ErrorAction Stop
      Write-Aviso "Habia un archivo donde debe ir el perfil de Edge; se aparto."
    }
    if (-not (Test-Path -LiteralPath $PerfilEdge)) { New-Item -ItemType Directory -Force -Path $PerfilEdge | Out-Null }
    $prueba = Join-Path $PerfilEdge ('.escritura-' + [guid]::NewGuid().ToString('N') + '.tmp')
    Set-Content -LiteralPath $prueba -Value 'ok' -Encoding ASCII -ErrorAction Stop
    Remove-Item -LiteralPath $prueba -Force -ErrorAction SilentlyContinue
    return $true
  } catch {
    return $false
  }
}

function Reset-PerfilEdge {
  # Cierra cualquier Edge nuestro y aparta el perfil para que Edge cree uno limpio
  foreach ($p in @(Get-ProcesosSerchTube)) {
    Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
  }
  Start-Sleep -Seconds 2
  if (Test-Path -LiteralPath $PerfilEdge) {
    $nombre = Split-Path $PerfilEdge -Leaf
    try {
      Rename-Item -LiteralPath $PerfilEdge -NewName ("$nombre.bak-" + (Get-Date -Format 'yyyyMMdd-HHmmss')) -ErrorAction Stop
      Write-Aviso "Perfil de Edge apartado a '$nombre.bak-...' (se creara uno limpio)."
      return $true
    } catch {
      Write-Aviso "No se pudo apartar el perfil de Edge: $($_.Exception.Message)"
      return $false
    }
  }
  return $true
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

# ------------------------------------------------- 0) Candado de un solo lanzador
$Candado = New-Object System.Threading.Mutex($false, 'Local\SerchTubeLanzador')
$TengoElTurno = $false
try { $TengoElTurno = $Candado.WaitOne(0) } catch { $TengoElTurno = $true }
if (-not $TengoElTurno) {
  Write-Paso "Ya hay otro arranque de SerchTube en curso. Este no hace nada (evita duplicar Edge)."
  exit 0
}

try {
  # ------------------------------------------------- 1) Reparar perfil y salir
  if ($RepararPerfil) {
    if (Reset-PerfilEdge) {
      Write-Paso "Perfil de Edge reparado. Vuelve a ejecutar el arranque normal."
    }
    exit 0
  }

  if ($PerfilNormal) { Write-Aviso "Modo -PerfilNormal: se usara tu perfil habitual de Edge." }

  # ------------------------------------------------- 2) Quitar autoinicio y salir
  if ($QuitarAutoInicio) {
    if (Quitar-AutoInicio) {
      Write-Paso "Autoinicio de Windows eliminado: SerchTube ya no se abrira solo al encender la PC."
    } else {
      Write-Aviso "No habia autoinicio registrado de SerchTube."
    }
    exit 0
  }

  # ------------------------------------------- 3) Arranque automatico: dar tiempo
  if ($AutoInicio) {
    # Esperar a que el escritorio (explorer) exista: antes de eso, Edge falla
    for ($i = 0; $i -lt 60; $i++) {
      if (Get-Process explorer -ErrorAction SilentlyContinue) { break }
      Start-Sleep -Seconds 1
    }
    if ($RetardoSegundos -gt 0) {
      Write-Paso "Arranque automatico: esperando $RetardoSegundos s a que Windows termine de iniciar..."
      Start-Sleep -Seconds $RetardoSegundos
    }
  }

  # ---------------------------------------------------------------- 4) Servidor
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

  # ------------------------------------------------- 5) Arranque automatico (una vez)
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

  # --------------------------------------------------- 6) Ya hay una ventana abierta
  $procesos = @(Get-ProcesosSerchTube)
  if ($procesos.Count -gt 0) {
    Write-Paso "Ya hay un Edge de SerchTube abierto ($($procesos.Count) procesos). Esperando su ventana..."
    for ($i = 0; $i -lt 30; $i++) {
      $ventanas = @(Get-VentanasSerchTube)
      if ($ventanas.Count -gt 0) {
        Write-Paso "Ventana encontrada (PID $($ventanas[0].Id)). Se trae al frente; no se abre otra."
        Set-FocoVentana $ventanas[0].MainWindowHandle
        exit 0
      }
      if (@(Get-ProcesosSerchTube).Count -eq 0) { break }   # se cerro solo: seguimos
      Start-Sleep -Seconds 1
    }
    if (@(Get-ProcesosSerchTube).Count -gt 0) {
      Write-Aviso "El Edge de SerchTube sigue vivo pero sin ventana. NO se abre otro (eso es lo que mostraba el error del directorio de datos)."
      Write-Aviso "Si no ves la app, ejecuta: 'Reparar perfil de Edge.bat'"
      exit 0
    }
    Write-Paso "El proceso anterior termino; se abre uno nuevo."
  }

  # ------------------------------------------------------------- 7) Abrir Edge
  $edge = Get-EdgeExe
  if (-not $edge) {
    Write-Aviso "No encontre msedge.exe. Abre Edge a mano en $Url"
    exit 1
  }

  $usarPerfil = -not $PerfilNormal

  function New-ArgumentosEdge {
    $a = @('--no-first-run', '--no-default-browser-check', '--disable-session-crashed-bubble',
      '--hide-crash-restore-bubble', '--start-maximized')
    if ($usarPerfil) { $a = @("--user-data-dir=$PerfilEdge") + $a }
    if ($Modo -eq 'app') { $a += "--app=$Url" } else { $a += $Url }
    if ($AutoconcederMicro) { $a += '--use-fake-ui-for-media-stream' }
    return $a
  }

  for ($intento = 1; $intento -le 2; $intento++) {
    if ($usarPerfil) {
      $listo = $false
      for ($i = 0; $i -lt 20 -and -not $listo; $i++) {
        $listo = Test-PerfilEscribible
        if (-not $listo) { Start-Sleep -Seconds 2 }
      }
      if (-not $listo) {
        Write-Aviso "El perfil de Edge no se puede escribir todavia. Se autorepara."
        Reset-PerfilEdge | Out-Null
        if (-not (Test-PerfilEscribible)) {
          Write-Aviso "Sigue sin poder escribirse el perfil. Usa -PerfilNormal o revisa permisos de $PerfilEdge"
          exit 1
        }
      }
    }

    Write-Paso "Abriendo Edge (modo '$Modo', intento $intento) con perfil: $(if ($usarPerfil) { $PerfilEdge } else { 'normal (sin --user-data-dir)' })"
    Start-Process -FilePath $edge -ArgumentList (New-ArgumentosEdge) | Out-Null

    # Verificar que la ventana aparecio (si Edge se queja del perfil, no aparece)
    $aparecio = $false
    for ($i = 0; $i -lt 25; $i++) {
      Start-Sleep -Seconds 1
      if (@(Get-VentanasSerchTube).Count -gt 0) { $aparecio = $true; break }
    }
    if ($aparecio) {
      Write-Paso "Listo. Ventana unica de SerchTube abierta."
      exit 0
    }

    Write-Aviso "Edge no mostro la ventana en 25 s."
    if ($intento -eq 1 -and $usarPerfil) {
      Write-Aviso "Se autorepara el perfil (se aparta el actual y se crea uno limpio) y se reintenta."
      if (-not (Reset-PerfilEdge)) { Write-Aviso "No se pudo apartar el perfil; se reintenta igual." }
    }
  }

  Write-Aviso "No se pudo abrir la ventana de SerchTube. Prueba 'Reparar perfil de Edge.bat'."
  exit 1
} finally {
  if ($TengoElTurno) { try { $Candado.ReleaseMutex() } catch { } }
  $Candado.Dispose()
}
