$ErrorActionPreference = 'Stop'
$utf8 = New-Object System.Text.UTF8Encoding($false)
$root = 'D:\autoclaw projects\Damascus-Emergency-Inventory-autoclaw'
$rel = Join-Path $root 'releases\v4.0.0'
$baseAsarStage = Join-Path $root '.openclaw\tmp\asar-stage-v3'
$v3Extract = Join-Path $root '.openclaw\tmp\v306-extract\Damascus Emergency Inventory 3.0.6'

function Build-ElectronVariant {
  param([string]$Variant, [string]$WebSrc, [string]$ApiSrc)

  Write-Output "=== assembling electron variant: $Variant ==="
  $stage = Join-Path $rel "scripts\staging-electron-$Variant"
  if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
  Copy-Item $baseAsarStage $stage -Recurse -Force

  # 1) version bumps (package.json + main.cjs + preload.cjs)
  $pkgPath = Join-Path $stage 'package.json'
  $pkg = [System.IO.File]::ReadAllText($pkgPath, $utf8).Replace('"version": "3.0.6"', '"version": "4.0.0"')
  [System.IO.File]::WriteAllText($pkgPath, $pkg, $utf8)
  $mainPath = Join-Path $stage 'electron\main.cjs'
  $main = [System.IO.File]::ReadAllText($mainPath, $utf8).Replace('const RELEASE_VERSION = "3.0.6";', 'const RELEASE_VERSION = "4.0.0";')
  [System.IO.File]::WriteAllText($mainPath, $main, $utf8)
  $preloadPath = Join-Path $stage 'electron\preload.cjs'
  $preload = [System.IO.File]::ReadAllText($preloadPath, $utf8).Replace('3.0.6', '4.0.0')
  [System.IO.File]::WriteAllText($preloadPath, $preload, $utf8)

  # 2) replace app/web + app/api + app/schema with v4.0.0 builds
  Remove-Item (Join-Path $stage 'app') -Recurse -Force
  New-Item -ItemType Directory -Path (Join-Path $stage 'app') -Force | Out-Null
  Copy-Item $WebSrc (Join-Path $stage 'app\web') -Recurse -Force
  New-Item -ItemType Directory -Path (Join-Path $stage 'app\api') -Force | Out-Null
  Copy-Item (Join-Path $ApiSrc '*') (Join-Path $stage 'app\api') -Recurse -Force
  New-Item -ItemType Directory -Path (Join-Path $stage 'app\schema') -Force | Out-Null
  Copy-Item (Join-Path $root 'lib\db\desktop-schema.sql') (Join-Path $stage 'app\schema\desktop-schema.sql') -Force

  # 3) pack app.asar
  $asarOut = Join-Path $stage 'app.asar'
  if (Test-Path $asarOut) { Remove-Item $asarOut -Force }
  Push-Location $stage
  pnpm dlx @electron/asar pack $stage $asarOut 2>&1 | Out-Null
  Pop-Location
  if (-not (Test-Path $asarOut)) { throw "asar packing failed for $Variant" }
  Write-Output ("asar packed: {0:N1} MB" -f ((Get-Item $asarOut).Length/1MB))

  # 4) assemble the electron folder (skeleton from the extracted v3.0.6)
  $folder = Join-Path $rel "windows\staging-electron-$Variant\Damascus-Emergency-Inventory-4.0.0"
  New-Item -ItemType Directory -Path $folder -Force | Out-Null
  Copy-Item (Join-Path $v3Extract '*') $folder -Recurse -Force
  Remove-Item (Join-Path $folder 'resources\app.asar') -Force
  Copy-Item $asarOut (Join-Path $folder 'resources\app.asar') -Force

  # 5) zip
  $zipPath = Join-Path $rel "windows\Damascus-Emergency-Inventory-v4.0.0-Windows-$Variant.zip"
  if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
  Compress-Archive -Path $folder -DestinationPath $zipPath -CompressionLevel Optimal
  Write-Output ("zipped: {0} ({1:N1} MB)" -f $zipPath, ((Get-Item $zipPath).Length/1MB))
  Remove-Item (Split-Path $folder -Parent) -Recurse -Force
  Remove-Item $stage -Recurse -Force
}

Build-ElectronVariant -Variant 'Offline' -WebSrc (Join-Path $root 'artifacts\web\dist\public') -ApiSrc (Join-Path $root 'artifacts\api-server\dist')
Build-ElectronVariant -Variant 'Protected' -WebSrc (Join-Path $root 'artifacts\web\dist\protected-windows\public') -ApiSrc (Join-Path $root 'artifacts\api-server\dist\protected')

$sums = Get-ChildItem (Join-Path $rel 'windows') -Filter '*.zip' | ForEach-Object {
  $hash = (Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLower()
  "$hash  $($_.Name)"
}
[System.IO.File]::WriteAllLines((Join-Path $rel 'windows\SHA256SUMS'), $sums, $utf8)
Write-Output 'SHA256SUMS regenerated'