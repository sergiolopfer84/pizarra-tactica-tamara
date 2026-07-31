# Copia de seguridad de todas las pizarras guardadas en Firestore.
#
# Descarga cada documento de la coleccion "pizarras" a la carpeta backups\.
# Si el contenido no ha cambiado desde la ultima copia no se guarda otra vez,
# para que la carpeta no se llene de archivos identicos.
#
# Uso:   powershell -ExecutionPolicy Bypass -File copia-pizarras.ps1
#
# La API key es la misma que ya viaja en app.js: no es un secreto, las reglas
# de Firestore son las que controlan el acceso. Los archivos descargados SI
# contienen datos reales de jugadores, por eso backups\ esta en .gitignore.

param(
  [int]$Conservar = 10   # copias distintas que se guardan de cada pizarra
)

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$proyecto = 'pizarra-tamara-2026'
$key      = 'AIzaSyBrysK7UDFDW_XpY1tSFnrQSX9rD8mbrrQ'
$base     = "https://firestore.googleapis.com/v1/projects/$proyecto/databases/(default)/documents/pizarras"
$dir      = Join-Path $PSScriptRoot 'backups'
$sello    = Get-Date -Format 'yyyyMMdd-HHmmss'
$utf8     = New-Object Text.UTF8Encoding($false)

if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }

Write-Host "Consultando $proyecto ..."
try {
  $lista = Invoke-RestMethod -Uri "$base`?key=$key&pageSize=300&mask.fieldPaths=writer" -Method Get
} catch {
  Write-Host "ERROR: no se ha podido consultar Firestore. $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}

if (-not $lista.documents) { Write-Host "No hay ninguna pizarra en la coleccion."; exit 0 }

$nuevas = 0; $iguales = 0
foreach ($doc in $lista.documents) {
  $id    = $doc.name.Split('/')[-1]
  $corto = $id.Substring(0, 8)

  try {
    $completo = Invoke-RestMethod -Uri "$base/$id`?key=$key" -Method Get
  } catch {
    Write-Host "  $corto  ERROR al descargar: $($_.Exception.Message)" -ForegroundColor Red
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
Write-Host "Listo: $nuevas copia(s) nueva(s), $iguales sin cambios.  Carpeta: $dir"
