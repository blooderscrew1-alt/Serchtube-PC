<#
  SerchTube Music - Limpiar Releases viejas de GitHub
  ==================================================

  Las Releases acumulan peso (cada una lleva ~36 MB entre los dos .exe). Este script
  conserva las N mas recientes y borra las anteriores (la Release y su etiqueta).

  Por seguridad, sin -Confirmar solo MUESTRA lo que haria (simulacion).

  Uso:
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts\limpiar-releases.ps1
    powershell ... -File scripts\limpiar-releases.ps1 -Conservar 3 -Confirmar
    powershell ... -File scripts\limpiar-releases.ps1 -Conservar 3 -Confirmar -SinBorrarTags
#>
[CmdletBinding()]
param(
  # Cuantas Releases recientes conservar
  [int]$Conservar = 5,
  # Token de GitHub (si no se pasa, se busca en el entorno o en la credencial de git)
  [string]$Token = '',
  # Borrar tambien la etiqueta de las Releases eliminadas
  [switch]$SinBorrarTags,
  # Sin este interruptor solo se muestra lo que se haria
  [switch]$Confirmar
)

$ErrorActionPreference = 'Stop'
$Raiz = Split-Path -Parent $PSScriptRoot

function Paso([string]$m) { Write-Host "[Releases] $m" -ForegroundColor Cyan }
function Aviso([string]$m) { Write-Host "[Releases] $m" -ForegroundColor Yellow }
function Mal([string]$m) { Write-Host "[Releases] $m" -ForegroundColor Red }

# ------------------------------------------------------------------ Repositorio
$remoto = (git -C $Raiz remote get-url origin 2>$null)
if (-not $remoto -or $remoto -notmatch 'github\.com') {
  Mal "No encuentro un remoto de GitHub en este repositorio."
  exit 1
}
$limpio = $remoto -replace '\.git$', '' -replace '^https?://github\.com/', ''
$partes = $limpio -split '/'
$owner = $partes[0]; $repo = $partes[1]
Paso "Repositorio: $owner/$repo"

# ------------------------------------------------------------------------ Token
if (-not $Token) { $Token = $env:GITHUB_TOKEN }
if (-not $Token) { $Token = $env:GH_TOKEN }
if (-not $Token) {
  $env:GIT_TERMINAL_PROMPT = '0'
  try {
    $cred = ("protocol=https`nhost=github.com`n`n" | git credential fill) 2>$null
    $linea = ($cred | Select-String '^password=').Line
    if ($linea) { $Token = $linea.Substring('password='.Length) }
  } catch { }
}
if (-not $Token) {
  Mal "No tengo token de GitHub (usa -Token ghp_xxx)."
  exit 1
}

$cab = @{
  Authorization          = "Bearer $Token"
  Accept                 = 'application/vnd.github+json'
  'X-GitHub-Api-Version' = '2022-11-28'
  'User-Agent'           = 'SerchTube-limpiar'
}
$api = "https://api.github.com/repos/$owner/$repo"

# --------------------------------------------------------------------- Releases
$crudo = Invoke-RestMethod -Uri "$api/releases?per_page=100" -Headers $cab -TimeoutSec 90
$todas = @()
foreach ($x in $crudo) { $todas += $x }
if ($todas.Count -eq 0) { Aviso "No hay Releases publicadas."; exit 0 }

$ordenadas = @($todas | Sort-Object -Property created_at -Descending)
$conservarN = [Math]::Max(1, $Conservar)
$conservarLista = @($ordenadas | Select-Object -First $conservarN)
$borrarLista = @()
for ($i = $conservarN; $i -lt $ordenadas.Count; $i++) { $borrarLista += $ordenadas[$i] }

$pesoConservar = ($conservarLista | ForEach-Object { ($_.assets | Measure-Object -Property size -Sum).Sum } | Measure-Object -Sum).Sum
$pesoBorrar = ($borrarLista | ForEach-Object { ($_.assets | Measure-Object -Property size -Sum).Sum } | Measure-Object -Sum).Sum

Paso ("Release mas reciente: {0}  (es la que responde a releases/latest/download)" -f $ordenadas[0].tag_name)
Write-Host ""
Write-Host "  SE CONSERVAN ($($conservarLista.Count)):" -ForegroundColor Green
foreach ($r in $conservarLista) { Write-Host ("    - {0}" -f $r.tag_name) -ForegroundColor Green }
Write-Host ""
if ($borrarLista.Count -eq 0) {
  Aviso "No hay nada que borrar."
  exit 0
}
Write-Host "  SE BORRARIAN ($($borrarLista.Count)):" -ForegroundColor Yellow
foreach ($r in $borrarLista) { Write-Host ("    - {0}" -f $r.tag_name) -ForegroundColor Yellow }
Write-Host ""
Paso ("Peso liberado aproximado: {0:N1} MB (se conservan {1:N1} MB)" -f ($pesoBorrar / 1MB), ($pesoConservar / 1MB))

if (-not $Confirmar) {
  Write-Host ""
  Aviso "Simulacion: no se borro nada. Vuelve a ejecutarlo con -Confirmar para borrar."
  exit 0
}

# ----------------------------------------------------------------------- Borrado
$borradas = 0
foreach ($r in $borrarLista) {
  try {
    Invoke-RestMethod -Method Delete -Uri "$api/releases/$($r.id)" -Headers $cab -TimeoutSec 90 | Out-Null
    $borradas++
    Paso "Borrada la Release $($r.tag_name)"
  } catch {
    Mal "No pude borrar $($r.tag_name): $($_.Exception.Message)"
    continue
  }
  if (-not $SinBorrarTags) {
    try {
      $ref = "tags/$([uri]::EscapeDataString($r.tag_name))"
      Invoke-RestMethod -Method Delete -Uri "$api/git/refs/$ref" -Headers $cab -TimeoutSec 60 | Out-Null
    } catch {
      Aviso "La etiqueta $($r.tag_name) no se pudo borrar (puede que no exista)."
    }
  }
}

Write-Host ""
Write-Host "============= LISTO =============" -ForegroundColor Green
Write-Host (" Releases borradas : {0}" -f $borradas)
Write-Host (" Peso liberado     : {0:N1} MB" -f ($pesoBorrar / 1MB))
Write-Host (" Release vigente   : {0}" -f $ordenadas[0].tag_name)
Write-Host  " URL de descarga   : https://github.com/$owner/$repo/releases/latest/download/SerchTube.exe"
Write-Host "=================================" -ForegroundColor Green
Write-Host ""
