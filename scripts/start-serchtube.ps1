<#
  SerchTube Music - Lanzador de arranque en UNA sola ventana del navegador
  ======================================================================

  Que hace:
    1. Candado: si otro arranque de SerchTube esta en curso, no hace nada
       (evita dos instancias peleando por el mismo perfil).
    2. Comprueba si el servidor ya responde en el puerto 3000; si no, lo arranca oculto
       (primero el build de produccion dist\server.cjs, si existe; si no, npm run dev).
    3. Abre el navegador en modo app con TU PERFIL DE SIEMPRE (por defecto):
         - funcionan tus EXTENSIONES,
         - estan tus AJUSTES y tus CLAVES guardadas (localStorage),
         - el MICROFONO ya no pregunta: el permiso se concede automaticamente
           (se puede volver al comportamiento normal con -PedirPermisoMicro).
       Con -Perfil dedicado usa un perfil aparte (modo kiosco, sin extensiones
       ni datos previos), con preflight del directorio y autoreparacion.
    4. Si la ventana de la app ya esta abierta, la trae al frente y no abre otra.
    5. Verifica que la ventana aparecio; si no, lo registra y reintenta una vez.
    6. Registra el arranque automatico de Windows (una sola vez).

  Pensado para cualquier PC con Windows: no depende de rutas ni de dispositivos
  concretos. Se puede ajustar todo por parametros.

  Pensado para cualquier PC con Windows: no depende de rutas ni de dispositivos
  concretos. Se puede ajustar todo por parametros.

  Uso:
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts\start-serchtube.ps1
    powershell ... -File scripts\start-serchtube.ps1 -QuitarAutoInicio
    powershell ... -File scripts\start-serchtube.ps1 -SinAutoInicio
    powershell ... -File scripts\start-serchtube.ps1 -Navegador chrome
    powershell ... -File scripts\start-serchtube.ps1 -Modo pestana
    powershell ... -File scripts\start-serchtube.ps1 -SinNavegador
    powershell ... -File scripts\start-serchtube.ps1 -PedirPermisoMicro
    powershell ... -File scripts\start-serchtube.ps1 -Perfil dedicado -RepararPerfil
#>
[CmdletBinding()]
param(
  # 'app' = ventana sin pestanas (recomendado) | 'pestana' = una pestana normal
  [ValidateSet('app', 'pestana')]
  [string]$Modo = 'app',

  [int]$Puerto = 3000,

  # 'normal' (recomendado) = usa TU perfil de siempre: extensiones, ajustes y claves
  #                          guardadas (localStorage) tal como los tenías.
  # 'dedicado'             = perfil aparte (kiosco): sin extensiones ni datos previos.
  [ValidateSet('normal', 'dedicado')]
  [string]$Perfil = 'normal',

  # Perfil dedicado (solo si $Perfil = 'dedicado')
  [string]$PerfilEdge = (Join-Path $env:LOCALAPPDATA 'SerchTubeEdge'),

  # Alias historico: fuerza el perfil normal
  [switch]$PerfilNormal,

  # auto (el que exista: Edge, Chrome o Brave) | edge | chrome | brave | predeterminado
  [ValidateSet('auto', 'edge', 'chrome', 'brave', 'predeterminado')]
  [string]$Navegador = 'auto',

  # Cerrar el navegador con nuestro perfil dedicado y apartarlo (se crea uno limpio)
  [switch]$RepararPerfil,

  # Por defecto el micrófono se concede solo (no pregunta en cada arranque).
  # Con este interruptor se comporta como un navegador normal: pregunta.
  [switch]$PedirPermisoMicro,

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
if ($PerfilNormal) { $Perfil = 'normal' }
$UsarPerfilDedicado = ($Perfil -eq 'dedicado')
# Perfil que se usa de verdad (solo en modo dedicado; cada navegador el suyo)
$PerfilReal = $PerfilEdge

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

function Get-Navegadores {
  # Devuelve TODOS los navegadores Chromium instalados, en orden de preferencia.
  # Cada uno es @{ Exe = <ruta>; Nombre = 'Edge' | 'Chrome' | 'Brave' }.
  # Los tres aceptan los mismos modificadores (--app, --user-data-dir).
  $candidatos = @()
  $familia = @(
    @{ Nombre = 'Edge'; Rel = 'Microsoft\Edge\Application\msedge.exe' },
    @{ Nombre = 'Chrome'; Rel = 'Google\Chrome\Application\chrome.exe' },
    @{ Nombre = 'Brave'; Rel = 'BraveSoftware\Brave-Browser\Application\brave.exe' }
  )
  foreach ($f in $familia) {
    foreach ($base in @(${env:ProgramFiles(x86)}, $env:ProgramFiles, $env:LOCALAPPDATA)) {
      if ($base) { $candidatos += @{ Exe = (Join-Path $base $f.Rel); Nombre = $f.Nombre } }
    }
  }
  foreach ($par in @(@('msedge.exe', 'Edge'), @('chrome.exe', 'Chrome'), @('brave.exe', 'Brave'))) {
    foreach ($hive in @(
        "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\$($par[0])",
        "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\$($par[0])")) {
      try {
        $p = (Get-ItemProperty -Path $hive -ErrorAction Stop).'(default)'
        if ($p) { $candidatos += @{ Exe = $p; Nombre = $par[1] } }
      } catch { }
    }
  }

  $instalados = @()
  foreach ($c in $candidatos) {
    if (-not $c.Exe -or -not (Test-Path -LiteralPath $c.Exe)) { continue }
    if ($instalados | Where-Object { $_.Nombre -eq $c.Nombre }) { continue }   # sin repetidos
    $instalados += $c
  }
  return $instalados
}

function Get-VentanaNavegadorPorTitulo {
  # HWND de cualquier ventana de navegador con el titulo de la app
  $pids = @(Get-Process msedge, chrome, brave -ErrorAction SilentlyContinue |
    ForEach-Object { [int]$_.Id })
  if ($pids.Count -eq 0) { return [IntPtr]::Zero }
  return (BuscarVentanaPorTitulo $pids)
}

function Get-ProcesosSerchTube {
  # Cualquier navegador abierto con NUESTRO perfil dedicado, tenga ventana o no.
  # Incluir los que aun no tienen ventana es lo que evita abrir un segundo
  # (el segundo es el que muestra el error del directorio de datos).
  if (-not $UsarPerfilDedicado) { return @() }
  try {
    # Coincidencia EXACTA del perfil: "...\SerchTubeEdge" no debe coincidir con
    # "...\SerchTubeEdge-Brave" (si no, se confundirian dos navegadores).
    $patron = [regex]::Escape($PerfilReal) + '([" ]|$)'
    return @(Get-CimInstance Win32_Process -ErrorAction Stop |
      Where-Object {
        $_.Name -in @('msedge.exe', 'chrome.exe', 'brave.exe') -and
        $_.CommandLine -and $_.CommandLine -like '*--user-data-dir=*' -and
        $_.CommandLine -match $patron
      })
  } catch {
    return @()
  }
}

function Initialize-Ventanas {
  # Un proceso de navegador puede tener VARIAS ventanas (la de la app, otras del
  # perfil personal, avisos de traduccion...). MainWindowTitle no sirve: hay que
  # recorrer las ventanas y buscar la que tiene el titulo de la app.
  if (-not ('SerchTube.Ventanas' -as [type])) {
    Add-Type -Namespace 'SerchTube' -Name 'Ventanas' -MemberDefinition @'
[DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, System.IntPtr lParam);
public delegate bool EnumWindowsProc(System.IntPtr hWnd, System.IntPtr lParam);
[DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(System.IntPtr hWnd, out uint pid);
[DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowTextW(System.IntPtr hWnd, System.Text.StringBuilder t, int n);
[DllImport("user32.dll")] public static extern bool IsWindowVisible(System.IntPtr hWnd);
[DllImport("user32.dll")] public static extern bool SetForegroundWindow(System.IntPtr hWnd);
[DllImport("user32.dll")] public static extern bool ShowWindow(System.IntPtr hWnd, int nCmdShow);
[DllImport("user32.dll")] public static extern bool PostMessage(System.IntPtr hWnd, uint msg, System.IntPtr w, System.IntPtr l);
'@
  }
}

function BuscarVentanaPorTitulo([int[]]$Pids) {
  # HWND de la ventana visible cuyo titulo es EXACTAMENTE el de la app. Se compara
  # exacto porque una pestaña cualquiera puede tener "SerchTube" en el titulo.
  if (-not $Pids -or $Pids.Count -eq 0) { return [IntPtr]::Zero }
  Initialize-Ventanas
  $script:hwndApp = [IntPtr]::Zero
  $cb = [SerchTube.Ventanas+EnumWindowsProc] {
    param($h, $l)
    $pidVentana = [uint32]0
    [void][SerchTube.Ventanas]::GetWindowThreadProcessId($h, [ref]$pidVentana)
    if ($Pids -contains [int]$pidVentana -and [SerchTube.Ventanas]::IsWindowVisible($h)) {
      $sb = New-Object System.Text.StringBuilder 512
      [void][SerchTube.Ventanas]::GetWindowTextW($h, $sb, 512)
      if ($sb.ToString().Trim() -eq $TituloVentana) {
        $script:hwndApp = $h
        return $false        # encontrada: se corta la enumeracion
      }
    }
    return $true
  }
  [void][SerchTube.Ventanas]::EnumWindows($cb, [IntPtr]::Zero)
  return $script:hwndApp
}

function Get-VentanasSerchTube {
  # HWND de la ventana de la app ([IntPtr]::Zero si no esta).
  if ($UsarPerfilDedicado) {
    $pids = @(Get-ProcesosSerchTube | ForEach-Object { [int]$_.ProcessId })
  } else {
    # Perfil normal: se busca en las ventanas del navegador elegido (o de todos)
    $pids = @(Get-Process msedge, chrome, brave -ErrorAction SilentlyContinue |
      ForEach-Object { [int]$_.Id })
  }
  return (BuscarVentanaPorTitulo $pids)
}

function Set-FocoVentana($Handle) {
  try {
    Initialize-Ventanas
    [void][SerchTube.Ventanas]::ShowWindow($Handle, 9)   # SW_RESTORE
    [void][SerchTube.Ventanas]::SetForegroundWindow($Handle)
  } catch { }
}

function Test-PerfilEscribible {
  try {
    if (Test-Path -LiteralPath $PerfilReal -PathType Leaf) {
      # Hay un ARCHIVO con el nombre del perfil: el navegador no puede usarlo
      $nuevo = Split-Path $PerfilReal -Leaf
      Rename-Item -LiteralPath $PerfilReal -NewName ("$nuevo.archivo-" + (Get-Date -Format 'yyyyMMdd-HHmmss')) -ErrorAction Stop
      Write-Aviso "Habia un archivo donde debe ir el perfil; se aparto."
    }
    if (-not (Test-Path -LiteralPath $PerfilReal)) { New-Item -ItemType Directory -Force -Path $PerfilReal | Out-Null }
    $prueba = Join-Path $PerfilReal ('.escritura-' + [guid]::NewGuid().ToString('N') + '.tmp')
    Set-Content -LiteralPath $prueba -Value 'ok' -Encoding ASCII -ErrorAction Stop
    Remove-Item -LiteralPath $prueba -Force -ErrorAction SilentlyContinue
    return $true
  } catch {
    return $false
  }
}

function Reset-PerfilEdge {
  # Cierra el navegador de NUESTRO perfil dedicado y aparta el perfil.
  # Primero se le pide a la ventana de la app que se cierre sola (asi guarda sus
  # preferencias) y solo si no se cierra se fuerza el proceso.
  $hwnd = Get-VentanasSerchTube
  if ($hwnd -ne [IntPtr]::Zero) {
    Initialize-Ventanas
    [void][SerchTube.Ventanas]::PostMessage($hwnd, 0x0010, [IntPtr]::Zero, [IntPtr]::Zero)   # WM_CLOSE
    for ($i = 0; $i -lt 10; $i++) {
      Start-Sleep -Milliseconds 500
      if (@(Get-ProcesosSerchTube).Count -eq 0) { break }
    }
  }
  foreach ($p in @(Get-ProcesosSerchTube)) {
    Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
  }
  Start-Sleep -Seconds 2
  if (Test-Path -LiteralPath $PerfilReal) {
    $nombre = Split-Path $PerfilReal -Leaf
    try {
      Rename-Item -LiteralPath $PerfilReal -NewName ("$nombre.bak-" + (Get-Date -Format 'yyyyMMdd-HHmmss')) -ErrorAction Stop
      Write-Aviso "Perfil apartado a '$nombre.bak-...' (se creara uno limpio)."
      return $true
    } catch {
      Write-Aviso "No se pudo apartar el perfil: $($_.Exception.Message)"
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
    if (-not $UsarPerfilDedicado) {
      Write-Aviso "El modo reparar es para el perfil DEDICADO. Con el perfil normal no hay nada que reparar."
      exit 0
    }
    $cand = $null
    $inst = @(Get-Navegadores)
    if ($inst.Count -gt 0) { $cand = $inst[0] }
    if ($cand -and $cand.Nombre -ne 'Edge') {
      $PerfilReal = "$PerfilEdge-$($cand.Nombre)"
    }
    if (Reset-PerfilEdge) {
      Write-Paso "Perfil dedicado apartado ($PerfilReal). Vuelve a ejecutar el arranque normal."
    }
    exit 0
  }

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

    # Se prueban en orden: build de produccion (no necesita herramientas de dev)
    # y, si no existe, el servidor de desarrollo del proyecto.
    # Si el paquete portable trae su propio Node (node.exe junto a la app), se usa ese:
    # asi funciona en PCs donde Node no esta instalado ni en el PATH.
    $nodeCmd = 'node'
    $nodeIncluido = Join-Path $Raiz 'node.exe'
    if (Test-Path -LiteralPath $nodeIncluido) {
      $nodeCmd = '"' + $nodeIncluido + '"'
      Write-Paso "Usando el Node incluido en la carpeta de la app."
    }

    $arranques = @()
    if (Test-Path -LiteralPath (Join-Path $Raiz 'dist\server.cjs')) {
      # NODE_ENV=production: sirve el frontend ya compilado (no usa vite).
      # OJO: las comillas de "NODE_ENV=production" son necesarias: sin ellas cmd
      # agrega un espacio al valor y el servidor entra en modo desarrollo.
      $arranques += 'set "NODE_ENV=production" && ' + $nodeCmd + ' dist\server.cjs'
    }
    if (Get-Command npm -ErrorAction SilentlyContinue) { $arranques += 'npm run dev' }

    $topePorIntento = [Math]::Max(20, [int]($EsperaServidor / $arranques.Count))
    foreach ($metodo in $arranques) {
      Write-Paso "Iniciando el servidor con: $metodo"
      Start-Process -FilePath 'cmd.exe' -ArgumentList ('/c ' + $metodo + ' >> "' + $log + '" 2>&1') -WorkingDirectory $Raiz -WindowStyle Hidden
      $fin = (Get-Date).AddSeconds($topePorIntento)
      while ((Get-Date) -lt $fin -and -not (Test-Servidor)) { Start-Sleep -Milliseconds 800 }
      if (Test-Servidor) { break }
      Write-Aviso "'$metodo' no respondio en $topePorIntento s; se prueba el siguiente metodo."
    }

    if (Test-Servidor) {
      Write-Paso "Servidor listo en $Url."
    } else {
      Write-Aviso "El servidor no respondio. Revisa el registro: $log"
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
    Write-Paso "Modo prueba (-SinNavegador): no se abre el navegador."
    exit 0
  }

  # ------------------------------------------ 6) Elegir navegador y su perfil
  # Sirve Edge, Chrome o Brave (los tres son Chromium: mismos modificadores).
  # Si no hay ninguno, se abre la URL con el navegador predeterminado del sistema.
  $instalados = @(Get-Navegadores)
  $nav = $null
  if ($Navegador -eq 'auto') {
    if ($instalados.Count -gt 0) { $nav = $instalados[0] }
  } elseif ($Navegador -ne 'predeterminado') {
    $nav = $instalados | Where-Object { $_.Nombre.ToLower() -eq $Navegador } | Select-Object -First 1
    if (-not $nav) {
      $lista = 'ninguno'
      if ($instalados.Count -gt 0) { $lista = ($instalados | ForEach-Object { $_.Nombre }) -join ', ' }
      Write-Aviso "Pediste '$Navegador' y no esta instalado. Instalados: $lista."
    }
  }

  if (-not $nav) {
    # Sin navegador Chromium conocido: se usa el predeterminado del sistema, pero
    # primero se mira si la app ya esta abierta (para no abrir pestanas de mas).
    $ya = Get-VentanaNavegadorPorTitulo
    if ($ya -ne [IntPtr]::Zero) {
      Write-Paso "Ya hay una ventana de SerchTube abierta. Se trae al frente; no se abre otra."
      Set-FocoVentana $ya
      exit 0
    }
    Write-Aviso "No hay Edge, Chrome ni Brave: se abre $Url con el navegador predeterminado del sistema."
    Write-Aviso "En ese modo no puedo garantizar una sola ventana ni el aislamiento del perfil."
    Start-Process $Url
    exit 0
  }

  if ($UsarPerfilDedicado -and $nav.Nombre -ne 'Edge') {
    # Cada navegador tiene su propio directorio de datos (no se pueden mezclar)
    $PerfilReal = "$PerfilEdge-$($nav.Nombre)"
  }
  Write-Paso "Navegador: $($nav.Nombre)  ($($nav.Exe))"
  if ($UsarPerfilDedicado) {
    Write-Paso "Perfil dedicado (sin extensiones ni datos previos): $PerfilReal"
  } else {
    Write-Paso "Perfil: el tuyo de siempre (extensiones, ajustes y claves guardadas)"
    if (-not $PedirPermisoMicro) { Write-Paso "Microfono: permiso concedido automaticamente (no preguntara)" }
  }

  # --------------------------------------------------- 7) Ya hay una ventana abierta
  $procesos = @(Get-ProcesosSerchTube)
  if ($procesos.Count -gt 0) {
    Write-Paso "Ya hay un SerchTube abierto en ese perfil ($($procesos.Count) procesos). Esperando su ventana..."
    for ($i = 0; $i -lt 30; $i++) {
      $hwnd = Get-VentanasSerchTube
      if ($hwnd -ne [IntPtr]::Zero) {
        Write-Paso "Ventana encontrada. Se trae al frente; no se abre otra."
        Set-FocoVentana $hwnd
        exit 0
      }
      if (@(Get-ProcesosSerchTube).Count -eq 0) { break }   # se cerro solo: seguimos
      Start-Sleep -Seconds 1
    }
    if (@(Get-ProcesosSerchTube).Count -gt 0) {
      # El navegador quedo vivo pero sin ventana (p. ej. modo segundo plano).
      # No es un error: al lanzarlo de nuevo, Chromium reutiliza ESE proceso y abre
      # la ventana, sin competir por el directorio de datos.
      Write-Aviso "El navegador sigue vivo sin ventana (segundo plano): se pide abrir la ventana al mismo proceso."
    }
    Write-Paso "El proceso anterior termino; se abre uno nuevo."
  } elseif (-not $UsarPerfilDedicado) {
    # Perfil normal: si la ventana de la app ya esta, no se abre otra
    $ya = Get-VentanasSerchTube
    if ($ya -ne [IntPtr]::Zero) {
      Write-Paso "Ya hay una ventana de SerchTube abierta. Se trae al frente; no se abre otra."
      Set-FocoVentana $ya
      exit 0
    }
  }

  function New-ArgumentosNavegador {
    $a = @('--no-first-run', '--no-default-browser-check', '--disable-session-crashed-bubble',
      '--hide-crash-restore-bubble', '--disable-background-mode', '--start-maximized')
    if ($UsarPerfilDedicado) { $a = @("--user-data-dir=`"$PerfilReal`"") + $a }
    if ($Modo -eq 'app') { $a += "--app=$Url" } else { $a += $Url }
    if (-not $PedirPermisoMicro) { $a += '--use-fake-ui-for-media-stream' }
    return $a
  }

  for ($intento = 1; $intento -le 2; $intento++) {
    if ($UsarPerfilDedicado) {
      $listo = $false
      for ($i = 0; $i -lt 20 -and -not $listo; $i++) {
        $listo = Test-PerfilEscribible
        if (-not $listo) { Start-Sleep -Seconds 2 }
      }
      if (-not $listo) {
        Write-Aviso "El perfil no se puede escribir todavia. Se autorepara."
        Reset-PerfilEdge | Out-Null
        if (-not (Test-PerfilEscribible)) {
          Write-Aviso "Sigue sin poder escribirse el perfil. Usa -Perfil normal o revisa permisos de $PerfilReal"
          exit 1
        }
      }
    }

    Write-Paso "Abriendo $($nav.Nombre) (modo '$Modo', intento $intento) con perfil: $(if ($UsarPerfilDedicado) { $PerfilReal } else { 'el tuyo de siempre' })"
    Start-Process -FilePath $nav.Exe -ArgumentList (New-ArgumentosNavegador) | Out-Null

    # Verificar que la ventana de la app aparecio (buscando por titulo)
    $aparecio = $false
    for ($i = 0; $i -lt 25; $i++) {
      Start-Sleep -Seconds 1
      if ((Get-VentanasSerchTube) -ne [IntPtr]::Zero) { $aparecio = $true; break }
    }
    if ($aparecio) {
      Write-Paso "Listo. Ventana unica de SerchTube abierta."
      exit 0
    }

    Write-Aviso "$($nav.Nombre) no mostro la ventana en 25 s."
    if ($intento -eq 1 -and $UsarPerfilDedicado) {
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

