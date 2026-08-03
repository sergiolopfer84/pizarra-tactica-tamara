# Copia de seguridad de las pizarras guardadas en Firestore.
#
# Descarga a backups\ las pizarras cuyas claves de acceso estan listadas en
# claves.txt (una por linea). Si el contenido no ha cambiado desde la ultima
# copia no se guarda otra vez, para que la carpeta no se llene de archivos
# identicos.
#
# Antes bastaba con pedir la coleccion entera, pero las reglas ya no permiten
# "list": cualquiera podia descargarse todas las pizarras sin saber ninguna
# clave. Ahora se calcula el ID de cada pizarra igual que hace la app (sha256
# de la clave) y se baja una a una, que es lo que sigue permitiendo "get".
#
# Uso:   powershell -ExecutionPolicy Bypass -File copia-pizarras.ps1
#
# La API key es la misma que ya viaja en app.js: no es un secreto, las reglas
# de Firestore son las que controlan el acceso. Lo que SI es sensible son
# claves.txt (claves en claro) y backups\ (datos reales de jugadores): los dos
# estan en .gitignore y no deben subirse al repositorio.

param(
  [int]$Conservar = 10,                                       # copias distintas que se guardan de cada pizarra
  [string]$Claves = (Join-Path $PSScriptRoot 'claves.txt')    # archivo con las claves de acceso
)

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$proyecto = 'pizarra-tamara-2026'
$key      = 'AIzaSyBrysK7UDFDW_XpY1tSFnrQSX9rD8mbrrQ'
$base     = "https://firestore.googleapis.com/v1/projects/$proyecto/databases/(default)/documents/pizarras"
$dir      = Join-Path $PSScriptRoot 'backups'
$sello    = Get-Date -Format 'yyyyMMdd-HHmmss'
$utf8     = New-Object Text.UTF8Encoding($false)

# Mismo ID que calcula la app en connectBoard(). El separador es el punto medio
# U+00B7; se escribe como codigo y no literal para que el hash no dependa de con
# que codificacion se haya guardado este archivo.
$sal = "udt$([char]0xB7)pizarra$([char]0xB7)"
$sha = [Security.Cryptography.SHA256]::Create()
function Get-BoardId([string]$clave) {
  $bytes = [Text.Encoding]::UTF8.GetBytes($sal + $clave)
  ($sha.ComputeHash($bytes) | ForEach-Object { $_.ToString('x2') }) -join ''
}

if (-not (Test-Path $Claves)) {
  @(
    '# Una clave de acceso por linea. Las lineas que empiezan por # se ignoran.'
    '# Este archivo esta en .gitignore: no se sube al repositorio.'
  ) | Out-File -FilePath $Claves -Encoding utf8
  Write-Host "Se ha creado $Claves" -ForegroundColor Yellow
  Write-Host "Anade dentro las claves de las pizarras que quieras respaldar y vuelve a ejecutar."
  exit 0
}

$lista = @(Get-Content $Claves -Encoding UTF8 |
           ForEach-Object { $_.Trim() } |
           Where-Object { $_ -and -not $_.StartsWith('#') } |
           Select-Object -Unique)

if ($lista.Count -eq 0) {
  Write-Host "No hay ninguna clave en $Claves" -ForegroundColor Yellow
  exit 0
}

if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }

Write-Host "Consultando $proyecto ... ($($lista.Count) clave(s))"

$nuevas = 0; $iguales = 0; $fallos = 0
foreach ($clave in $lista) {
  $id    = Get-BoardId $clave
  $corto = $id.Substring(0, 8)

  try {
    $completo = Invoke-RestMethod -Uri "$base/$id`?key=$key" -Method Get
  } catch {
    $codigo = $null
    if ($_.Exception.Response) { $codigo = [int]$_.Exception.Response.StatusCode }
    if ($codigo -eq 404) {
      Write-Host "  $corto  no existe ninguna pizarra con esa clave" -ForegroundColor Yellow
    } else {
      Write-Host "  $corto  ERROR al descargar: $($_.Exception.Message)" -ForegroundColor Red
    }
    $fallos++
    continue
  }

  $json = $completo.fields.data.stringValue
  if (-not $json) { Write-Host "  $corto  vacia, se omite" -ForegroundColor DarkGray; continue }

  # Comparar con la copia mas reciente de esta misma pizarra
  $previas = @(Get-ChildItem (Join-Path $dir "*-$corto.json") -ErrorAction SilentlyContinue | Sort-Object Name)
  if ($previas.Count -gt 0) {
    $ultima = [IO.File]::ReadAllText($previas[-1].FullName, [Text.Encoding]::UTF8).TrimEnd("`r", "`n")
    if ($ultima -ceq $json) {
      Write-Host "  $corto  sin cambios desde $($previas[-1].Name.Substring(0,15))" -ForegroundColor DarkGray
      $iguales++
      continue
    }
  }

  $destino = Join-Path $dir "$sello-$corto.json"
  [IO.File]::WriteAllText($destino, $json, $utf8)

  $s = $json | ConvertFrom-Json
  $kb = [math]::Round($json.Length / 1024, 1)
  Write-Host ("  $corto  GUARDADA  {0} jugadores, {1} rivales, {2} KB" -f @($s.players).Count, @($s.rivals).Count, $kb) -ForegroundColor Green
  $nuevas++

  # Dejar solo las N copias distintas mas recientes
  $todas = @(Get-ChildItem (Join-Path $dir "*-$corto.json") | Sort-Object Name)
  if ($todas.Count -gt $Conservar) {
    $todas[0..($todas.Count - $Conservar - 1)] | Remove-Item -Force
  }
}

Write-Host ""
Write-Host "Listo: $nuevas copia(s) nueva(s), $iguales sin cambios, $fallos con error.  Carpeta: $dir"
