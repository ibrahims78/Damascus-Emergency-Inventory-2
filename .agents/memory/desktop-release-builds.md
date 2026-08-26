---
name: Desktop release builds
description: Build and packaging constraints for the Electron desktop release
---

The Electron desktop release is a nested package outside the pnpm workspace packages. Its dependencies must be installed with workspace isolation, and a portable Windows executable is the reliable Windows artifact in this environment.

**Why:** A normal `pnpm --dir releases/v1 install` reused the root workspace and left the nested package without its PGlite and Electron modules. Replit's Wine wrapper also could not execute the generated NSIS installer, while the portable target completed successfully.

**How to apply:** Use `pnpm --dir releases/v1 install --ignore-workspace` before packaging. Build the Linux targets and Windows portable target here; produce the NSIS installer on a Windows-capable CI runner if an installer is required.