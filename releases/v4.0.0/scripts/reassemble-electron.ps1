param([string]$Only = '')
$ErrorActionPreference = 'Stop'
$utf8 = New-Object System.Text.UTF8Encoding($false)
$root = 'D:\autoclaw projects\Damascus-Emergency-Inventory-autoclaw'
$rel = Join-Path $root 'releases\v4.0.0'

function Rebuild-ElectronVariant {
  param([string]$Variant, [string]$WebSrc, [string]$ApiSrc)

  Write-Output "=== re-assembling electron variant: $Variant ==="
  $zipPath = Join-Path $rel "windows\Damascus-Emergency-Inventory-v4.0.0-Windows-$Variant.zip"
  if (-not (Test-Path $zipPath)) { throw "zip not found: $zipPath" }

  $work = Join-Path $env:TEMP ("dme-reassemble-" + $Variant)
  if (Test-Path $work) { Remove-Item $work -Recurse -Force }
  New-Item -ItemType Directory -Path $work -Force | Out-Null

  # 1) extract the current zip (skeleton + old asar)
  $ex = Join-Path $work 'extract'
  Expand-Archive -Path $zipPath -DestinationPath $ex -Force
  $appDir = Get-ChildItem $ex -Directory | Select-Object -First 1

  # 2) extract the old asar into a staging dir
  $stage = Join-Path $work 'asar-stage'
  Set-Location (Join-Path $root 'artifacts\web')
  $extractCmd = 'pnpm dlx @electron/asar extract "' + (Join-Path $appDir.FullName 'resources\app.asar') + '" "' + $stage + '" >nul 2>&1'
  cmd /c $extractCmd
  if (-not (Test-Path $stage)) { throw "asar extract failed for $Variant" }

  # 3) swap app/web + app/api + app/schema with the CURRENT builds
  Remove-Item (Join-Path $stage 'app') -Recurse -Force
  New-Item -ItemType Directory -Path (Join-Path $stage 'app') -Force | Out-Null
  Copy-Item $WebSrc (Join-Path $stage 'app\web') -Recurse -Force
  New-Item -ItemType Directory -Path (Join-Path $stage 'app\api') -Force | Out-Null
  Copy-Item (Join-Path $ApiSrc '*') (Join-Path $stage 'app\api') -Recurse -Force
  New-Item -ItemType Directory -Path (Join-Path $stage 'app\schema') -Force | Out-Null
  Copy-Item (Join-Path $root 'lib\db\desktop-schema.sql') (Join-Path $stage 'app\schema\desktop-schema.sql') -Force

  # 4) patch electron/main.cjs: FIXED preferred ports (41789 api / 41790 web)
  #    so the renderer origin is stable and localStorage (device id + license)
  #    persists across launches. Falls back to a random port if busy.
  $mainPath = Join-Path $stage 'electron\main.cjs'
  $main = [System.IO.File]::ReadAllText($mainPath, $utf8)
  $main = $main.Replace([string][char]13 + [string][char]10, [string][char]10)

  $oldFind = @'
function findAvailablePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      if (!address || typeof address === "string") {
        probe.close();
        reject(new Error("Could not determine an available local port."));
        return;
      }

      const port = address.port;
      probe.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}
'@
  $newFind = @'
function findAvailablePort() {
  // A FIXED preferred port keeps the renderer origin stable so localStorage
  // (device id + activation license) persists across launches. If the port
  // is busy we fall back to an OS-assigned one.
  return new Promise((resolve, reject) => {
    const startRandom = () => {
      const probe = net.createServer();
      probe.once("error", reject);
      probe.listen(0, "127.0.0.1", () => {
        const address = probe.address();
        if (!address || typeof address === "string") {
          probe.close();
          reject(new Error("Could not determine an available local port."));
          return;
        }
        const port = address.port;
        probe.close((error) => (error ? reject(error) : resolve(port)));
      });
    };
    const probe = net.createServer();
    probe.once("error", () => {
      probe.close();
      startRandom();
    });
    probe.listen(41789, "127.0.0.1", () => {
      const address = probe.address();
      if (!address || typeof address === "string") {
        probe.close();
        reject(new Error("Could not determine an available local port."));
        return;
      }
      const port = address.port;
      probe.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}
'@
  if ($main.Contains($oldFind)) { $main = $main.Replace($oldFind, $newFind) }
  elseif (-not $main.Contains("41789")) { throw "main.cjs port anchor missing AND fix not present for $Variant" }

  $oldSrv = @'
    localServer.once("error", reject);
    localServer.listen(0, "127.0.0.1", () => {
      const address = localServer.address();
      if (!address || typeof address === "string") {
        reject(new Error("Could not determine the desktop server port."));
        return;
      }
      resolve(address.port);
    });
'@
  $newSrv = @'
    const startRandom = () => {
      localServer.once("error", reject);
      localServer.listen(0, "127.0.0.1", () => {
        const address = localServer.address();
        if (!address || typeof address === "string") {
          reject(new Error("Could not determine the desktop server port."));
          return;
        }
        resolve(address.port);
      });
    };
    localServer.once("error", () => startRandom());
    localServer.listen(41790, "127.0.0.1", () => {
      const address = localServer.address();
      if (!address || typeof address === "string") {
        reject(new Error("Could not determine the desktop server port."));
        return;
      }
      resolve(address.port);
    });
'@
  if ($main.Contains($oldSrv)) { $main = $main.Replace($oldSrv, $newSrv) }
  elseif (-not $main.Contains("41790")) { throw "main.cjs server anchor missing AND fix not present for $Variant" }
  [System.IO.File]::WriteAllText($mainPath, $main, $utf8)

  # 5) repack the asar
  $newAsar = Join-Path $work 'app.asar'
  if (Test-Path $newAsar) { Remove-Item $newAsar -Force }
  Set-Location $stage
  $packCmd = 'pnpm dlx @electron/asar pack "' + $stage + '" "' + $newAsar + '" >nul 2>&1'
  cmd /c $packCmd
  if (-not (Test-Path $newAsar)) { throw "asar pack failed for $Variant" }

  # 6) replace the asar inside the extracted folder and re-zip
  Copy-Item $newAsar (Join-Path $appDir.FullName 'resources\app.asar') -Force
  Remove-Item $zipPath -Force
  Compress-Archive -Path $appDir.FullName -DestinationPath $zipPath -CompressionLevel Optimal
  Write-Output ("rebuilt zip: {0} ({1:N1} MB)" -f $zipPath, ((Get-Item $zipPath).Length/1MB))
  Remove-Item $work -Recurse -Force
}

# standard: web=dist/public, api=dist (with pglite assets)
if ($Only -ne 'Protected') { Rebuild-ElectronVariant -Variant 'Offline' -WebSrc (Join-Path $root 'artifacts\web\dist\public') -ApiSrc (Join-Path $root 'artifacts\api-server\dist') }
# protected: web=dist/protected-windows/public (noble fallback + gate marker), api=dist/protected
if ($Only -ne 'Offline') { Rebuild-ElectronVariant -Variant 'Protected' -WebSrc (Join-Path $root 'artifacts\web\dist\protected-windows\public') -ApiSrc (Join-Path $root 'artifacts\api-server\dist\protected') }

# regenerate checksums
$sums = Get-ChildItem (Join-Path $rel 'windows') -Filter '*.zip' | ForEach-Object {
  $hash = (Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLower()
  "$hash  $($_.Name)"
}
[System.IO.File]::WriteAllLines((Join-Path $rel 'windows\SHA256SUMS'), $sums, $utf8)
Write-Output 'SHA256SUMS regenerated'
