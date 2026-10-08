<#
  SerchTube Music - Publicar los ejecutables en GitHub Releases
  ============================================================

  Crea (o actualiza) una Release en GitHub con los .exe como archivos adjuntos, para
  que el repositorio no crezca con binarios y la descarga tenga una URL fija:

      https://github.com/<usuario>/<repo>/releases/latest/download/SerchTube.exe
      https://github.com/<usuario>/<repo>/releases/latest/download/SerchTube-con-Node.exe

  Que hace:
    1. Compila y genera los .exe (llama a build-portable.ps1).
    2. Resuelve el token: -Token, o $env:GITHUB_TOKEN / $env:GH_TOKEN, o la
       credencial que git tiene guardada para github.com.
    3. Crea la Release con la etiqueta portable-<commit> (si ya existe, la reutiliza).
    4. Sube (o reemplaza) los adjuntos.
    5. Muestra las URLs finales.

  Uso:
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts\publicar-release.ps1
    powershell ... -File scripts\publicar-release.ps1 -SinCompilar
    powershell ... -File scripts\publicar-release.ps1 -SinVarianteNode
    powershell ... -File scripts\publicar-release.ps1 -Token ghp_xxx
#>
[CmdletBinding()]
param(
  # No recompilar: usa los .exe que ya esten en build\portable
  [switch]$SinCompilar,

  # No publicar la variante que incluye Node (34 MB)
  [switch]$SinVarianteNode,

  # Token de GitHub (si no se pasa, se busca en el entorno o en git)
  [string]$Token = '',

  # Rama de la que se toma la version
  [string]$Rama = 'main'
)

$ErrorActionPreference = 'Stop'
$Raiz = Split-Path -Parent $PSScriptRoot

function Paso([string]$m) { Write-Host "[Publicar] $m" -ForegroundColor Cyan }
function Aviso([string]$m) { Write-Host "[Publicar] $m" -ForegroundColor Yellow }
function Mal([string]$m) { Write-Host "[Publicar] $m" -ForegroundColor Red }

# ---------------------------------------------------------------- 1) Repositorio
$remoto = (git -C $Raiz remote get-url origin 2>$null)
if (-not $remoto -or $remoto -notmatch 'github\.com') {
  Mal "No encuentro un remoto de GitHub en este repositorio."
  exit 1
}
$limpio = $remoto -replace '\.git$', '' -replace '^https?://github\.com/', ''
$partes = $limpio -split '/'
$owner = $partes[0]; $repo = $partes[1]
Paso "Repositorio: $owner/$repo"

$commit = (git -C $Raiz rev-parse --short HEAD 2>$null)
if (-not $commit) { $commit = (Get-Date -Format 'yyyyMMddHHmm') }
$etiqueta = "portable-$commit"

# ---------------------------------------------------------------------- 2) Build
$salida = Join-Path $Raiz 'build\portable'
$exeChico = Join-Path $salida 'SerchTube.exe'
$exeNode = Join-Path $salida 'SerchTube-con-Node.exe'

if (-not $SinCompilar) {
  Paso "Generando el ejecutable chico..."
  & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'build-portable.ps1') | Out-Null
  if (-not (Test-Path -LiteralPath $exeChico)) { Mal "No se genero $exeChico"; exit 1 }
  if (-not $SinVarianteNode) {
    Paso "Generando el ejecutable con Node incluido (puede tardar)..."
    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'build-portable.ps1') -ConNode | Out-Null
  }
}

$adjuntos = @()
if (Test-Path -LiteralPath $exeChico) { $adjuntos += $exeChico }
if (-not $SinVarianteNode -and (Test-Path -LiteralPath $exeNode)) { $adjuntos += $exeNode }
if ($adjuntos.Count -eq 0) { Mal "No hay ningun .exe para publicar en $salida"; exit 1 }

# ---------------------------------------------------------------------- 3) Token
if (-not $Token) { $Token = $env:GITHUB_TOKEN }
if (-not $Token) { $Token = $env:GH_TOKEN }
if (-not $Token) {
  Paso "Buscando la credencial que git tiene guardada para github.com..."
  $env:GIT_TERMINAL_PROMPT = '0'
  try {
    $cred = ("protocol=https`nhost=github.com`n`n" | git credential fill) 2>$null
    $linea = ($cred | Select-String '^password=').Line
    if ($linea) { $Token = $linea.Substring('password='.Length) }
  } catch { }
}
if (-not $Token) {
  Mal "No tengo token de GitHub."
  Mal "Crealo en https://github.com/settings/tokens (permiso 'repo') y volve a intentar con -Token ghp_xxx"
  exit 1
}

$cab = @{
  Authorization          = "Bearer $Token"
  Accept                 = 'application/vnd.github+json'
  'X-GitHub-Api-Version' = '2022-11-28'
  'User-Agent'           = 'SerchTube-publicar'
}
$api = "https://api.github.com/repos/$owner/$repo"

# --------------------------------------------------------------- 4) Release
$rel = $null
try {
  $rel = Invoke-RestMethod -Uri "$api/releases/tags/$etiqueta" -Headers $cab -TimeoutSec 60
  Paso "La Release '$etiqueta' ya existe: se actualizan los adjuntos."
} catch {
  $cuerpo = @{
    tag_name         = $etiqueta
    target_commitish = $Rama
    name             = "SerchTube portable $commit"
    body             = "Ejecutables de SerchTube Music (commit $commit).`n`n" +
                       "- SerchTube.exe: para PCs con Node.js instalado.`n" +
                       "- SerchTube-con-Node.exe: trae Node.js incluido, no necesita nada instalado.`n`n" +
                       "Descarga directa:`n" +
                       "- https://github.com/$owner/$repo/releases/latest/download/SerchTube.exe`n" +
                       "- https://github.com/$owner/$repo/releases/latest/download/SerchTube-con-Node.exe"
    draft            = $false
    prerelease       = $false
  } | ConvertTo-Json
  Paso "Creando la Release '$etiqueta'..."
  $rel = Invoke-RestMethod -Method Post -Uri "$api/releases" -Headers $cab -Body $cuerpo -ContentType 'application/json' -TimeoutSec 90
}

# -------------------------------------------------------------- 5) Adjuntos
foreach ($archivo in $adjuntos) {
  $nombre = Split-Path $archivo -Leaf
  $mb = [math]::Round((Get-Item $archivo).Length / 1MB, 2)
  $existente = @($rel.assets | Where-Object { $_.name -eq $nombre })
  foreach ($a in $existente) {
    Paso "Reemplazando el adjunto existente '$nombre'..."
    Invoke-RestMethod -Method Delete -Uri "$api/releases/assets/$($a.id)" -Headers $cab | Out-Null
  }
  Paso "Subiendo $nombre ($mb MB)..."
  $urlSubida = "https://uploads.github.com/repos/$owner/$repo/releases/$($rel.id)/assets?name=$nombre"
  $cabSubida = $cab.Clone()
  $cabSubida['Content-Type'] = 'application/octet-stream'
  Invoke-RestMethod -Method Post -Uri $urlSubida -Headers $cabSubida -InFile $archivo -TimeoutSec 1800 | Out-Null
}

# ----------------------------------------------------------------- 6) Resumen
Write-Host ""
Write-Host "============== PUBLICADO ==============" -ForegroundColor Green
Write-Host " Release : $($rel.html_url)"
Write-Host " Etiqueta: $etiqueta"
foreach ($archivo in $adjuntos) {
  Write-Host (" Adjunto : {0}" -f (Split-Path $archivo -Leaf))
}
Write-Host ""
Write-Host " URLs fijas (siempre apuntan a la ultima Release):" -ForegroundColor Green
Write-Host "   https://github.com/$owner/$repo/releases/latest/download/SerchTube.exe"
if (-not $SinVarianteNode) {
  Write-Host "   https://github.com/$owner/$repo/releases/latest/download/SerchTube-con-Node.exe"
}
Write-Host "=======================================" -ForegroundColor Green
Write-Host ""
