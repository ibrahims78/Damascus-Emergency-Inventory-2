# Release notes 4.0.3 — Damascus Health Directorate packages

## Updates

- Updated the product identity to **Damascus Health Directorate**.
- Unified the official logo across the login screen, navigation, reports,
  printed transactions, Android startup assets, and Windows packaging.
- Set the application version to `4.0.3` and Android `versionCode=403`.
- Renamed the Windows and Android release packages to
  `Damascus-Health-Directorate`.
- Kept the legacy Android application ID and license product identifier only
  where required for upgrade and existing-license compatibility.
- Updated the Windows and Android activation tools to identify the new product
  while preserving the legacy license payload fields required by the runtime.

## Published files

- `Damascus-Health-Directorate-v4.0.3-Android-Offline.apk`
- `Damascus-Health-Directorate-v4.0.3-Android-Protected.apk`
- `Damascus-Health-Directorate-v4.0.3-Windows-Offline.zip`
- `Damascus-Health-Directorate-v4.0.3-Windows-Protected.zip`
- `SHA256SUMS-Android.txt`
- `SHA256SUMS-Windows.txt`

## Verification completed

- Standard and protected web bundles built successfully from `master`.
- Standard and protected API bundles built successfully.
- Both APKs report `versionName=4.0.3`, `versionCode=403`, and
  `compileSdk=35`.
- Both APKs report the visible application label
  `Damascus Health Directorate`.
- Both APKs pass Android v1 and v2 signature verification.
- Both Windows archives contain the renamed executable and `app.asar` with
  product version `4.0.3`.
- Windows and Android SHA-256 files were regenerated from the published files.

## Security and testing notes

- Public release assets do not contain private keys, Android keystores, or
  credentials.
- License signing material must remain in an encrypted vendor vault and must
  not be uploaded with the activation kit.
- Final interactive testing still requires a Windows machine and an Android
  device or emulator.