---
name: Workspace bootstrap after repository sync
description: Replit workspaces restored from GitHub may need dependency installation and development schema setup before workflows are healthy.
---

After syncing this monorepo into a fresh Replit workspace, install the locked pnpm dependencies and apply the development database schema before judging the application startup.

**Why:** A clean Git checkout can have no `node_modules`, and the provisioned development database can be reachable while still missing application tables; workflows may otherwise fail on missing `vite`, `esbuild`, or database relations.

**How to apply:** Run `pnpm install --frozen-lockfile`, then use the repository's development-only DB push command, and restart the managed API and web workflows.