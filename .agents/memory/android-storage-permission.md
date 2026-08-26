---
name: Android storage permission continuation
description: Native file export behavior on Android versions that require legacy storage permission
---

On Android versions below 10, a native file export must retain the Capacitor plugin call while requesting `WRITE_EXTERNAL_STORAGE`, then continue the same save operation from the permission callback after the user grants access.

**Why:** Ending the plugin call immediately after showing the permission prompt made Excel template downloads appear to do nothing even after the user granted permission.

**How to apply:** Keep the permission alias declared on the native plugin, request it through Capacitor's retained-call API, reject only on denial, and resume the original filename/base64 save request on approval.