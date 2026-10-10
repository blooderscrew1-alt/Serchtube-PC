<#
  SerchTube Music - Activar la autoactualizacion en esta PC (la host)
  ==================================================================

  Crea una tarea programada que revisa GitHub y aplica la ultima version:
    - cada 15 minutos
    - y al iniciar sesion

  Con esto ya no hay que mover archivos a mano: cuando se publique un cambio, esta PC
  se pone al dia sola. No necesita Git ni GitHub ni compilar nada.

  Uso (una sola vez, en la host):
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts\activar-autoactualizacion.ps1
    ... -Carpeta "D:\SerchTube"      (si esta en otro sitio)
    ... -Minutos 30                  (otra frecuencia)
    ... -Quitar                      (desactiva la tarea)
#>
[CmdletBinding()]
param(
  [string]$Carpeta = (Join-Path $env:LOCALAPPDATA 'SerchTube'),
  [int]$Minutos = 15,
  [switch]$Quitar
)

$ErrorActionPreference = 'Stop'
$nombreTarea = 'SerchTube Autoactualizar'

function Paso([string]$m) { Write-Host "[AutoUpdate] $m" -ForegroundColor Cyan }
function Aviso([string]$m) { Write-Host "[AutoUpdate] $m" -ForegroundColor Yellow }
function Mal([string]$m) { Write-Host "[AutoUpdate] $m" -ForegroundColor Red }

if ($Quitar) {
  try {
    Unregister-ScheduledTask -TaskName $nombreTarea -Confirm:$false
    Paso "Autoactualizacion desactivada."
  } catch {
    Aviso "La tarea no estaba creada."
  }
  exit 0
}

if (-not (Test-Path -LiteralPath $Carpeta)) {
  Mal "No existe la instalacion '$Carpeta'. Instala o actualiza SerchTube primero."
  exit 1
}
$actualizador = Join-Path $Carpeta 'scripts\autoactualizar-host.ps1'
if (-not (Test-Path -LiteralPath $actualizador)) {
  # Compatibilidad: si la instalacion es anterior, se usa el actualizador normal
  $actualizador = Join-Path $Carpeta 'scripts\update-serchtube.ps1'
}
if (-not (Test-Path -LiteralPath $actualizador)) {
  Mal "No encontre el actualizador en '$Carpeta\scripts'."
  exit 1
}
Paso "Instalacion: $Carpeta"
Paso "Actualizador: $actualizador"

# ------------------------------------------------------------------- Tarea
$argumentos = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$actualizador`" -Silencioso"
$accion = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $argumentos

$disparadores = @()
# 1) Cada N minutos (con repeticion indefinida)
$t1 = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(2) `
      -RepetitionInterval (New-TimeSpan -Minutes $Minutos) `
      -RepetitionDuration ([TimeSpan]::MaxValue)
$disparadores += $t1
# 2) Al iniciar sesion
$disparadores += (New-ScheduledTaskTrigger -AtLogOn)

$ajustes = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 30)
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited

try {
  Register-ScheduledTask -TaskName $nombreTarea -Action $accion -Trigger $disparadores `
    -Settings $ajustes -Principal $principal -Description 'Actualiza SerchTube Music desde GitHub' -Force | Out-Null
  Paso "Tarea programada creada: '$nombreTarea'"
  Paso "Revisa cada $Minutos minutos y al iniciar sesion."
} catch {
  Mal "No pude crear la tarea: $($_.Exception.Message)"
  exit 1
}

# --------------------------------------------------------- Primera ejecucion
Paso "Ejecutando la primera actualizacion ahora..."
try {
  Start-ScheduledTask -TaskName $nombreTarea
  Start-Sleep -Seconds 5
  $info = Get-ScheduledTaskInfo -TaskName $nombreTarea
  Paso "Ultima ejecucion: $($info.LastRunTime) | resultado: $($info.LastTaskResult) (0 = correcto)"
} catch {
  Aviso "No pude lanzarla ahora: $($_.Exception.Message)"
}

Write-Host ""
Write-Host "=========== AUTOACTUALIZACION ACTIVA ===========" -ForegroundColor Green
Write-Host " Esta PC revisara y aplicara los cambios sola."
Write-Host " Desactivar:  .\Activar autoactualizacion.bat -Quitar"
Write-Host " (o: powershell -File scripts\activar-autoactualizacion.ps1 -Quitar)"
Write-Host "===============================================" -ForegroundColor Green
