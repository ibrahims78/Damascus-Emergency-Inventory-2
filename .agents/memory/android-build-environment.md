---
name: Android build environment
description: Environment constraint affecting local Capacitor Android release builds
---

The base workspace does not expose an Android SDK with the required platform and build tools to Gradle, but a temporary SDK under /tmp can be provisioned with command-line tools, platform android-35, and build-tools 35.0.0 for release assembly. Keep android/local.properties ignored.

**Why:** The first release attempt stopped at SDK discovery (`SDK location not found`) after the web build and Capacitor sync completed successfully; provisioning the SDK in /tmp allowed the Android 3.0.0 release to build without committing SDK configuration.

**How to apply:** Before promising a new APK, verify `ANDROID_HOME` or `android/local.properties` points to an SDK containing the configured compile SDK and build tools. If the base image lacks one, provision a temporary SDK rather than committing local.properties. Do not relabel an older APK as a new release.