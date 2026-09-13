Damascus Health Directorate
Protected Activation Kit v4.0.3
================================

This distribution contains the public activation tools and verification
material for Damascus Health Directorate v4.0.3. Private signing keys,
Android keystores, passwords, and credentials are intentionally excluded.
Keep those materials in a separate encrypted vendor vault.

Contents
--------
- windows/KeyGenerator-v4.0.3-P-Windows.py
  English-only Windows license generator.
- android/KeyGenerator-v4.0.3-P-Android.py
  English-only Android license generator.
- license-public-key.b64 and key-id.txt
  Public verification material and the platform key identifiers.

Issue a license
---------------

1. Open a terminal in the platform folder.
2. Run the matching generator:

   Windows:
     python KeyGenerator-v4.0.3-P-Windows.py

   Android:
     python KeyGenerator-v4.0.3-P-Android.py

3. Enter the exact device ID shown by the protected application.
4. Enter an expiry date as YYYY-MM-DD, or press Enter for no expiry.
5. Send the generated license-*.txt file to the authorized customer.

The generated license is bound to the selected platform, device ID, signing
key, and application version 4.0.3. Do not edit the file after generation.

Compatibility
-------------

The Android application ID remains syrian.emergency.inventory so existing
installations can receive updates. This is an internal technical identifier;
the visible product name is Damascus Health Directorate.

Security
--------

- Never place private keys, the Android keystore, or credentials in this kit.
- Keep signing material in an encrypted vendor vault.
- If a private key is exposed, stop issuing licenses and prepare a planned
  key rotation with a new protected build.