---
name: Electron IndexedDB lifecycle
description: Durable constraints for the offline IndexedDB state store in Electron/Windows builds.
---

Offline IndexedDB connections must close on `versionchange`, and a failed state-load promise must be discarded before retrying.

**Why:** Electron can keep an older connection alive during an upgrade, while caching the rejected initialization promise makes every later mutation reuse the same failure and appear permanently stuck.

**How to apply:** Keep read/write transactions bounded by explicit timeouts, close database handles in `finally`, and reset cached initialization state after rejection.