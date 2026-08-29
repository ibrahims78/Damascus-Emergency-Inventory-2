$ErrorActionPreference = 'Stop'
$utf8 = New-Object System.Text.UTF8Encoding($false)
$root = 'D:\autoclaw projects\Damascus-Emergency-Inventory-autoclaw'
$rel = Join-Path $root 'releases\v4.0.0'

function Rebuild-ElectronVariant {
  param([string]$Variant, [string]$WebSrc, [string]$ApiSrc)

  Write-Output "=== re-assembling electron variant: $Variant ==="
  $zipPath = Join-Path $rel "windows\Damascus-Emergency-Inventory-v4.0.0-Windows-$Variant.zip"
  if (-not (Test-Path $zipPath)) { throw "zip not found: $zipPath" }

  # 1) extract the current zip (skeleton + old asar)
  $ex = Join-Path $work "extract-$Variant"
  if (Test-Path $ex) { Remove-Item $ex -Recurse -Force }
  Expand-Archive -Path $zipPath -DestinationPath $ex -Force
  $appDir = Get-ChildItem $ex -Directory | Select-Object -First 1

  # 2) extract the old asar into a staging dir
  $stage = Join-Path $work "asar-stage-$Variant"
  if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
  Set-Location (Join-Path $root 'artifacts\web')
  pnpm dlx @electron/asar extract (Join-Path $appDir.FullName 'resources\app.asar') $stage 2>&1 | Out-Null
  if (-not (Test-Path $stage)) { throw "asar extract failed for $Variant" }

  # 3) swap app/web + app/api + app/schema with the CURRENT builds
  Remove-Item (Join-Path $stage 'app') -Recurse -Force
  New-Item -ItemType Directory -Path (Join-Path $stage 'app') -Force | Out-Null
  Copy-Item $WebSrc (Join-Path $stage 'app\web') -Recurse -Force
  New-Item -ItemType Directory -Path (Join-Path $stage 'app\api') -Force | Out-Null
  Copy-Item (Join-Path $ApiSrc '*') (Join-Path $stage 'app\api') -Recurse -Force
  New-Item -ItemType Directory -Path (Join-Path $stage 'app\schema') -Force | Out-Null
  Copy-Item (Join-Path $root 'lib\db\desktop-schema.sql') (Join-Path $stage 'app\schema\desktop-schema.sql') -Force

  # 4) repack the asar (same layout as v3.0.6)
  $newAsar = Join-Path $work "app-$Variant.asar"
  if (Test-Path $newAsar) { Remove-Item $newAsar -Force }
  Set-Location $stage
  pnpm dlx @electron/asar pack $stage $newAsar 2>&1 | Out-Null
  if (-not (Test-Path $newAsar)) { throw "asar pack failed for $Variant" }

  # 5) replace the asar inside the extracted folder and re-zip
  Copy-Item $newAsar (Join-Path $appDir.FullName 'resources\app.asar') -Force
  Remove-Item $zipPath -Force
  Compress-Archive -Path $appDir.FullName -DestinationPath $zipPath -CompressionLevel Optimal
  Write-Output ("rebuilt zip: {0} ({1:N1} MB)" -f $zipPath, ((Get-Item $zipPath).Length/1MB))
}

$work = Join-Path $env:TEMP 'dme-electron-reassemble'
if (Test-Path $work) { Remove-Item $work -Recurse -Force }
New-Item -ItemType Directory -Path $work -Force | Out-Null

# standard: web=dist/public, api=dist (with pglite assets)
Rebuild-ElectronVariant -Variant 'Offline' -WebSrc (Join-Path $root 'artifacts\web\dist\public') -ApiSrc (Join-Path $root 'artifacts\api-server\dist')
# protected: web=dist/protected-windows/public (noble fallback + gate marker), api=dist/protected
Rebuild-ElectronVariant -Variant 'Protected' -WebSrc (Join-Path $root 'artifacts\web\dist\protected-windows\public') -ApiSrc (Join-Path $root 'artifacts\api-server\dist\protected')

# regenerate checksums
$sums = Get-ChildItem (Join-Path $rel 'windows') -Filter '*.zip' | ForEach-Object {
  $hash = (Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLower()
  "$hash  $($_.Name)"
}
[System.IO.File]::WriteAllLines((Join-Path $rel 'windows\SHA256SUMS'), $sums, $utf8)
Write-Output 'SHA256SUMS regenerated'

Remove-Item $work -Recurse -Force
Write-Output 'done'
