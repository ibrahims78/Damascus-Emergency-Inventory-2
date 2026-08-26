---
name: Android restore WebView fallback
description: Compatibility rule for encrypted backup parsing in Capacitor Android
---

Capacitor Android WebViews may not reliably start module Web Workers for bundled local assets. Encrypted restore parsing must have a direct main-thread fallback for native WebViews, worker startup errors, and worker stalls.

**Why:** The reported Android screen remained in the restore loading state; the supplied package itself was valid and decrypted successfully with the supplied password.

**How to apply:** Keep the worker for regular browsers, but detect native Capacitor, handle worker errors, and use a bounded fallback rather than allowing the restore promise to remain pending.