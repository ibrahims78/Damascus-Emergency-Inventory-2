$ErrorActionPreference = 'Stop'
$utf8 = New-Object System.Text.UTF8Encoding($false)
$root = 'D:\autoclaw projects\Damascus-Emergency-Inventory-autoclaw'
$rel = Join-Path $root 'releases\v4.0.0'
$template = Join-Path $rel 'scripts\main-template.cjs'

function Rebuild-ElectronVariant {
  param([string]$Variant, [string]$WebSrc, [string]$ApiSrc)

  Write-Output "=== re-assembling electron variant: $Variant ==="
  $zipPath = Join-Path $rel "windows\Damascus-Emergency-Inventory-v4.0.0-Windows-$Variant.zip"
  if (-not (Test-Path $zipPath)) { throw "zip not found: $zipPath" }

  $work = Join-Path $env:TEMP ("dme-rebuild-" + $Variant)
  if (Test-Path $work) { Remove-Item $work -Recurse -Force }
  New-Item -ItemType Directory -Path $work -Force | Out-Null

  # 1) extract the current zip (Electron skeleton)
  $ex = Join-Path $work 'extract'
  Expand-Archive -Path $zipPath -DestinationPath $ex -Force
  $appDir = Get-ChildItem $ex -Directory | Select-Object -First 1

  # 2) fresh staging from the CLEAN template (fixed ports baked in)
  $stage = Join-Path $work 'asar-stage'
  New-Item -ItemType Directory -Path (Join-Path $stage 'electron') -Force | Out-Null
  Copy-Item $template (Join-Path $stage 'electron\main.cjs') -Force
  $preloadSrc = Join-Path $root 'releases\v3\electron\preload.cjs'
  if (Test-Path $preloadSrc) { Copy-Item $preloadSrc (Join-Path $stage 'electron\preload.cjs') -Force }
  $pkgJson = '{"name":"damascus-emergency-inventory-desktop","productName":"Damascus Emergency Inventory","version":"4.0.0","main":"electron/main.cjs"}'
  [System.IO.File]::WriteAllText((Join-Path $stage 'package.json'), $pkgJson, $utf8)

  # 3) app/web + app/api + app/schema with the CURRENT builds
  New-Item -ItemType Directory -Path (Join-Path $stage 'app') -Force | Out-Null
  Copy-Item $WebSrc (Join-Path $stage 'app\web') -Recurse -Force
  New-Item -ItemType Directory -Path (Join-Path $stage 'app\api') -Force | Out-Null
  Copy-Item (Join-Path $ApiSrc '*') (Join-Path $stage 'app\api') -Recurse -Force
  New-Item -ItemType Directory -Path (Join-Path $stage 'app\schema') -Force | Out-Null
  Copy-Item (Join-Path $root 'lib\db\desktop-schema.sql') (Join-Path $stage 'app\schema\desktop-schema.sql') -Force

  # 4) repack the asar
  $newAsar = Join-Path $work 'app.asar'
  Set-Location (Join-Path $root 'artifacts\web')
  $packCmd = 'pnpm dlx @electron/asar pack "' + $stage + '" "' + $newAsar + '" >nul 2>&1'
  cmd /c $packCmd
  if (-not (Test-Path $newAsar)) { throw "asar pack failed for $Variant" }

  # 5) replace the asar inside the extracted folder and re-zip
  Copy-Item $newAsar (Join-Path $appDir.FullName 'resources\app.asar') -Force
  Remove-Item $zipPath -Force
  Compress-Archive -Path $appDir.FullName -DestinationPath $zipPath -CompressionLevel Optimal
  Write-Output ("rebuilt zip: {0} ({1:N1} MB)" -f $zipPath, ((Get-Item $zipPath).Length/1MB))
  Remove-Item $work -Recurse -Force -ErrorAction SilentlyContinue
}

Rebuild-ElectronVariant -Variant 'Offline' -WebSrc (Join-Path $root 'artifacts\web\dist\public') -ApiSrc (Join-Path $root 'artifacts\api-server\dist')
Rebuild-ElectronVariant -Variant 'Protected' -WebSrc (Join-Path $root 'artifacts\web\dist\protected-windows\public') -ApiSrc (Join-Path $root 'artifacts\api-server\dist\protected')

$sums = Get-ChildItem (Join-Path $rel 'windows') -Filter '*.zip' | ForEach-Object {
  $hash = (Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLower()
  "$hash  $($_.Name)"
}
[System.IO.File]::WriteAllLines((Join-Path $rel 'windows\SHA256SUMS'), $sums, $utf8)
Write-Output 'SHA256SUMS regenerated'
