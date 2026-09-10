---
name: Inventory phase 0 and 2 gate
description: Environment and scope constraints for replayable inventory baseline and additive schema migration checks.
---

## Rule

Run the inventory baseline only against temporary Desktop/PGlite data, never against the
workspace data directory or a hosted database. In this workspace, `DATABASE_URL` may be
inherited even when Desktop mode is intended, so the baseline command must explicitly
remove it.

**Why:** The baseline guard is intentionally fail-closed to prevent a destructive or
misleading test from touching a hosted database; the Replit environment can expose a
database URL globally.

**How to apply:** Use `env -u DATABASE_URL pnpm run phase0:baseline` after generating
synthetic fixtures. Keep phase 3 import behavior deferred when only phases 0-2 are
requested; phase 2 is additive and preserves legacy item-level fields.